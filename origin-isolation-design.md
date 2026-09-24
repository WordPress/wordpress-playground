# Playground origin isolation

## Current decision: prototype the full app on each site origin

The earlier recommendation below is superseded. Native file handles cannot cross
origins, and moving only remote.html would add a filesystem bridge and change
local-directory access. The prototype instead moves index.html with remote.html,
PHP, and WordPress. Site changes navigate the top-level page. Saving, renaming,
and opening tools keep the current page alive. Public assets use a shared origin.

See `packages/playground/website/bin/origin-isolation/README.md` for commands,
checks, and limits. The rest of this document records the earlier alternative
and the constraints that led to this change.

## Earlier investigation: keep the SPA on one origin

Design investigation, 2026-09-22. Source reviewed: local `origin/trunk` at
`fe9b2f94172`. This section predates the local prototype.

## Answer

Suppose Alice has saved a shop and then opens a link that runs an unknown plugin.
The plugin must be able to change its new Playground. It must not be able to open
Alice's shop database, call the site manager, or read the SPA's tokens.

Keep the SPA at `playground.wordpress.net`. Put each Playground's existing
`remote.html`, PHP worker, service worker, and WordPress frames together on a
different origin. There is no need to move the SPA between subdomains.

```text
playground.wordpress.net
  SPA, site picker, trusted storage access, account tokens
    |
    +-- private, site-limited message channel
    |
    +-- site-<random-id>.playground-site.wordpress.net
          remote.html
          PHP worker + in-memory filesystem
          service worker
          WordPress frame + Gutenberg frames

static.playground.wordpress.net
  identical, versioned public asset URLs used by every runtime
```

The domain names are examples, not a deployment decision. A different subdomain
is a different origin even when it remains part of the same browser-defined
site. That distinction permits storage separation without necessarily splitting
the HTTP cache. [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy),
[Chrome's cache model](https://developer.chrome.com/blog/http-cache-partitioning/).

Switching the active Playground changes an iframe, not the top-level document.
The SPA and its loaded modules stay alive. A runtime that was stopped must still
boot again; avoiding a page reload does not eliminate that work.

## Why this split is smaller than moving the whole app

The boundary already largely exists:

- [The website selects `remote.html`](./packages/playground/website/src/lib/config.ts).
- [The client connects through messages](./packages/playground/client/src/blueprints-v1-handler.ts).
- [The remote registers its service worker and starts its PHP worker](./packages/playground/remote/src/lib/boot-playground-remote.ts).
- WordPress, Gutenberg, navigation tracking, and their service worker can stay on
  the same origin inside that remote. They do not need separate cross-origin
  links between those components.

`allow-same-origin` can stay on the WordPress iframe. It preserves the origin of
the iframe's URL; it does not make a subdomain iframe share its parent's origin.
Removing it creates an opaque origin and breaks the service-worker design.
[Iframe sandbox rules](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox).

Moving only rendered WordPress HTML is another possible design, but requires a
new request relay from its service worker back to a PHP runtime on the trusted
origin. It also leaves the PHP runtime beside all saved data. That needs a
separate audit of its exposed methods, mounts, extensions, and JS callbacks.
This investigation did not establish a direct PHP-to-JavaScript escape.
Moving the existing remote as a unit avoids depending on such an audit for the
browser-origin boundary.

## The remaining storage choice

### A. Each runtime origin stores its own site

The parent stores only the catalogue and origin mapping. A site's files live in
that site's OPFS. Temporary Playgrounds get fresh random IDs; saving retains the
same ID. A display-name change must not change the storage origin.

This is the smallest storage boundary: the browser separates the files. A site
can enumerate its own OPFS, but not the SPA's or another site's OPFS.

The cost is moving today's saved files out of the parent origin. Export, delete,
storage reporting, and background management need messages to each site origin.
Migration must copy and verify data before removing the original. Do not run
untrusted code on the old shared origin during the migration.

Local-folder mounts still need a bridge. The parent cannot send a native
`FileSystemDirectoryHandle` into a different origin: deserialization must fail.
A cross-origin iframe also cannot simply show the directory picker itself.
[File handle serialization](https://fs.spec.whatwg.org/#filesystemhandle),
[File picker restrictions](https://wicg.github.io/file-system-access/#showing-a-file-picker).

### B. Keep today's storage; give each runtime one limited file channel

Keep `/sites/site-<slug>` and local-folder handles on the trusted origin. Before
starting a runtime, the SPA binds one private channel to the selected site's
directory. The runtime can read or change files through that channel, but it
never receives an OPFS root, a native directory handle, or a site selector.

For example, the channel for Alice's shop accepts `read('wp-config.php')` within
the shop. It has no `readFromSite('another-site', ...)` operation. Validation must
also reject path escapes, including both paths in a rename.

This is application-enforced separation rather than separate browser storage
for the saved files. Its safety depends on a small, reviewed file service.
The code in the runtime has no direct access to the parent's OPFS; it receives
only the intended site's data.

This fits today's storage implementation better than a synchronous remote disk
would. [The current mount](./packages/php-wasm/web/src/lib/directory-handle-mount.ts)
already copies files into PHP's in-memory filesystem and later writes batches
of changes back to storage. PHP can continue reading memory synchronously.
Only initial transfer and persistence need to cross the channel. Preserve the
existing flush, retry, and stop behavior; do not replace it with an unchecked
stream of writes.

**Recommendation:** use the whole-remote origin split in either case. If keeping
existing saved sites, local-folder mounts, and central management unchanged is
part of the first release, prototype B. The same limited storage service can
serve both OPFS and selected local folders. If native per-origin saved storage is
the priority, choose A and budget for migration and site-management changes.
Neither choice is just a `remoteUrl` change.

## Download public assets once where the browser permits it

Every runtime should request the exact same public URLs, such as
`https://static.playground.wordpress.net/releases/<build-id>/php-8.4.wasm`.
Do not substitute the runtime hostname or add a site ID to these URLs.

Use immutable, versioned assets with suitable CORS headers. Never overwrite
their contents, and retain old releases while pages may still reference them.
This is a deployment change as well as a loader change.

Two details in this repository matter:

1. [The current cache](./packages/playground/remote/src/lib/offline-mode-cache.ts)
   fetches with `cache: 'no-store'` and uses origin-local CacheStorage. Copying
   that design to every subdomain would download assets again. Its comments
   describe real stale-release failures. Keep those constraints and use a
   separate policy for immutable public assets; do not blindly remove the
   cache bypass from entry documents or mutable resources.
2. [The runtime site URL](./packages/playground/remote/src/lib/config.ts) comes
   from `import.meta.url`. After moving code to a static host, that becomes the
   asset origin. The runtime origin must instead come from the runtime context.
   Worker entry URLs need the same separation from asset URLs.

Keep a small bootstrap document and worker entry scripts on each runtime
origin. A service worker must register from its own origin; a static CDN URL
cannot directly replace its registration URL. Those small scripts can load
shared code under the browser's supported module/CORS rules. The current
`updateViaCache: 'none'` also requires review for shared service-worker imports.
[Service worker registration rules](https://github.com/w3c/ServiceWorker/blob/main/explainer.md).

An asset server's service worker does not automatically intercept every request
to that server from unrelated clients. Shared HTTP caching and shared
CacheStorage are different mechanisms. If shared offline storage is required,
use an explicit trusted asset service, limited to known public build assets.
Do not let runtimes write executable assets into a cache used by the SPA or
other sites.

The browser can evict cached data, and different top-level embedding websites
may use different cache partitions. The practical promise is to avoid
per-Playground duplicate fetching by design, not to guarantee a file is never
downloaded again. Fetch only the requested PHP/WordPress versions and features;
full offline prefetch should remain a distinct choice.

## Security work that the domain change does not replace

- Bind channels to a particular iframe, exact origin, and runtime session.
  Validate the handshake, then use private MessagePorts. Retire a channel on
  navigation or destruction. Never accept a child-supplied site ID as permission.
- Treat every runtime-origin document as untrusted, including `remote.html`:
  WordPress code on that origin can interact with it. Give it no global site
  manager, credential getter, arbitrary file path, or unrestricted fetch proxy.
- [The generic API transport](./packages/php-wasm/universal/src/lib/api.ts) and
  [its window endpoint](./packages/php-wasm/universal/src/lib/comlink-sync.ts)
  currently use broad window messaging defaults. The window endpoint does not
  filter `event.source`. A MessagePort acquired through an unvalidated bootstrap
  is not sufficient protection.
- [The lightweight export endpoint](./packages/playground/website/src/lib/boot-playground-api.ts)
  accepts a saved-site slug. Audit its embedding and authorization rules too;
  isolating the WordPress frame must not leave another route to export arbitrary
  saved sites. The same applies to the Sites API, remote access, and token-using
  callbacks.
- A new Blueprint link must create a new site. It must not silently execute in
  an existing saved site because of a URL parameter or redirect. Protect runtime
  boot/API access from an attacker embedding another site's bootstrap page.
- Stop serving user content on the SPA origin. Include old scoped URLs, old
  tabs/service workers, `remote.html`, and API compatibility routes in rollout.
  Already-compromised browser state is a separate recovery problem.
- Sibling subdomains are not a complete cookie barrier. Host-only cookies do
  not spread to children; `Domain` cookies do. A sibling runtime tree avoids a
  cookie scoped to `playground.wordpress.net`, but not one scoped to
  `wordpress.net`. Use host-only credentials, appropriate cookie prefixes, and
  protect state-changing requests rather than relying on SameSite alone.
  [Cookie scope](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#domain).
- Do not relax `document.domain`. CORS for public assets must not become blanket
  CORS permission for saved files or privileged APIs.

This protects one site from another. A plugin explicitly run inside Alice's
shop can still read that shop's database through PHP. That is within its granted
access; origin separation cannot make such a plugin safe for that same site.

## Browser probe

A small standalone probe passed in Chromium `151.0.7922.34` on 2026-09-22. It used
fresh browser storage and three runtime/shell origins under `pg.localhost`, plus
a shared asset host. Localhost supplied a secure context without bypassing
certificate checks. Playwright's flag disabling storage partitioning was removed.

| Check | Observation |
| --- | --- |
| Runtime reads parent DOM | `SecurityError` |
| Each runtime enumerates OPFS | Starts empty; cannot see the shell marker or the other runtime marker |
| Dedicated worker reads OPFS | Sees only its runtime's marker |
| Native parent directory handle sent to child | Receiver gets `messageerror` |
| Two runtime service workers | Both serve their own synthetic responses |
| Shared window module, worker module, service-worker payload, fetch payload | One network download each across two runtimes |
| Local worker/service-worker entry scripts | Two downloads each: one per runtime origin |
| SPA lifetime | Original shell marker survives; top-level document requested once |
| Previously visited runtime reopened offline | Works with its bootstrap cached by its service worker |
| Brand-new runtime origin opened offline | Navigation fails |

Probe files and the final JSON are in `/private/tmp/playground-origin-probe/`.
This checks browser building blocks, not WordPress boot or the proposed file
service. It is not a Firefox, Safari, or production HTTPS compatibility result.
The 2020 Chrome cache article explains the model; the local probe checks one
installed Chromium version rather than assuming that article covers every
current browser.

The offline result is a real design constraint. A parent service worker cannot
bootstrap an arbitrary new origin while offline. A central asset cache alone
does not solve the first navigation. Supporting new offline Playgrounds needs
an explicit plan, such as a finite set of previously prepared origins with a
careful reuse policy, or a different offline mode. Do not reuse an untrusted
origin for another saved site without addressing its retained state.

## Smallest next implementation and its checks

1. Put the existing remote on one test subdomain while keeping the SPA fixed.
   Verify actual WordPress boot, navigation, Blueprint v1/v2, and Gutenberg.
2. Use two simultaneous runtime origins. Verify hostile JS cannot reach parent
   storage, the other site's files/API, or global exports; test forged messages,
   navigation, redirects, and malicious Blueprint links targeting saved sites.
3. Implement the chosen persistence route. Verify save/reopen, local folders,
   crash recovery, final flush, deletion, export, and site switching.
4. Move immutable public assets to identical shared URLs. Measure cold start,
   second-site start, version changes, and deployment overlap by counting actual
   network transfers, not merely resource entries in DevTools.
5. Test Chrome, Firefox, and Safari, including embeds with third-party storage
   blocked. Check media-processing isolation headers, downloads, uploads,
   permissions, and offline behavior. SharedArrayBuffer must not cross the
   parent/runtime origin boundary.
6. Preserve small UI behaviors that currently read nested DOM. For example,
   [outside-click detection](./packages/playground/website/src/components/ensure-playground-site/listen-for-pointer-down-across-iframes.ts)
   will need an unprivileged event message instead of direct document access.

Existing `<iframe src="https://playground.wordpress.net">` embeds can keep that
outer URL and receive an isolated runtime inside. Direct `remote.html` API users
need a compatible bootstrap/relay path. Third-party embedding may have different
storage partitions from a top-level visit; it must not silently gain access to
the user's saved top-level sites.
