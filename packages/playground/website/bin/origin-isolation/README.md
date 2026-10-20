# Full-app origin isolation prototype

Each site runs `index.html`, `remote.html`, PHP, the service worker, and WordPress
on one local origin. Native directory handles stay on that origin. No filesystem
bridge is added.

```text
playground.localhost:9400
  address bar, iframe shell, and display-only catalogue; no Playground runtime

site-<random UUID>.playground.localhost:9400
  iframe: SPA with dock → remote.html → WordPress
                   → PHP worker → this origin's OPFS

static.playground.localhost:9400/<release>/
  shared JS, CSS, WASM, SQLite, and WordPress assets
```

## Run

Use Node 24, as specified by the repository's `.nvmrc`. From the repository root:

```sh
npm ci
npx nx run playground-website:build:origin-isolation
npx nx run playground-website:preview:origin-isolation
```

Open <http://playground.localhost:9400> in Chrome. Chromium resolves these
`*.localhost` names to loopback and treats them as secure contexts. No `/etc/hosts`
changes, certificate installation, or browser security exceptions are needed.
The server binds only to `127.0.0.1:9400`.

The build uses the existing Vite configurations, with a shared asset base. It
writes the usual website/remote build directories and a local release descriptor
in `dist/origin-isolation.json`. Rebuild and restart the server after source
changes. This is a production-style build, without HMR.

The root opens the full Playground UI in a per-site iframe. Use **New** and
**Playgrounds** in the dock. New Playground, ZIP import, edited Blueprint runs,
and settings that create a new site replace only that iframe. The root document
and address stay on `playground.localhost:9400`. Save, rename, and tools keep the
current app and runtime mounted. Switching sites reloads the iframe's app, not
the browser tab.

Saved-site links use `?site=<UUID>` on the root. The selector opens a site only
if it appears in this browser's catalogue. It cannot select another person's
saved files. Setup-sharing actions omit that selector and use a root URL with
the Blueprint/settings. A saved-site selector cannot also inject a Blueprint or
runtime settings into that site's files.

## Guided local-directory setup

1. Open **Store permanently**, select **Save in a local directory**, and choose
   **Choose…**. The main pane explains why a separate window is needed.
2. In the popup, choose a directory and approve read/write access. The handle is
   stored in that site's IndexedDB. Playground has not started copying the site yet.
3. In the same popup, choose **Allow ongoing access**, then Chrome's **Allow on
   every visit**. One-time access is not enough for a framed app after its popup
   closes.
4. The popup checks access after leaving the site's top-level origin. If access
   ended, it offers retry or cancel instead of returning an unusable handle.
5. When setup succeeds, the popup closes and the Save pane shows the directory.
   Press **Save** to copy the current Playground there. The app and its runtime
   were not reloaded during permission setup.

The popup briefly visits a root helper between permission steps. This discards
its picker document and permits a stored-handle permission request. After the
second approval it returns to the root helper, which embeds a site-origin check.
The check sends a completion notice through a same-origin BroadcastChannel. Only
then does the running app load the native handle from its own IndexedDB. The
root receives no handle, filename, file bytes, or file-operation API.

The helper uses `noopener` and has no connection to the app's API. Root/helper
messages carry only the site origin, request ID, step, and permission result.
Choose a separate physical directory for each Playground. Giving two sites the
same directory (or a parent/child pair) explicitly lets both edit overlapping
files; an origin boundary cannot undo those user grants.

Approving access lets code in that Playground use the directory right away.
The Save button starts copying the WordPress files. Cancelling does not save
the site or switch its storage, but does not revoke a browser grant already
given. A blocked popup produces an instruction to allow popups. If a saved site's grant expires, its error view
offers **Reconnect directory** through the same guide before mounting its files.
A second top-level window on the same site origin can keep a one-time grant
alive during verification. Close old direct-site tabs when testing expiry;
Chrome may revoke access later regardless of this initial check.

The CI guide tests use disposable OPFS handles to exercise completion, rejected
one-time access, retry, and cancellation without OS dialogs. They do not verify
Chrome's native permission prompt. The one-window native flow must also be
checked in headed Chrome with a real disposable directory; the experiment below
records the separate two-window native check.

## Native-folder popup experiment

Open <http://playground.localhost:9400/folder-popup-probe.html> in Chrome.
This is a separate browser-API experiment, independent of the guided Save flow.

The root page embeds two random site origins. In site A, **Open folder popup**
opens a top-level window on that same site origin, with no opener reference.
**Choose folder** calls the real native picker with read/write access and stores
the resulting handle in that origin's IndexedDB. A same-origin BroadcastChannel
sends only a completion notice. The root page receives neither the handle nor
file operations.

To check it manually:

1. Create an empty disposable directory outside Documents/iCloud.
2. Use **Try picker inside iframe** in site A. Expect `SecurityError`.
3. Open site A's popup and choose the disposable directory. Approve access.
4. Keep the popup open and use **Check folder read/write** in site A. Expect
   `permission: "granted"` and `readBack`. This also retains the handle in memory.
   The probe writes only `folder-popup-probe.txt` inside the selected directory.
5. Close the popup. Both **Check retained handle** and **Check folder read/write**
   should now report `permission: "prompt"` and `NotAllowedError` for a one-time grant.
6. Use **Reload this frame** in site A, then open its popup again. In the popup,
   use **Renew stored permission** and select **Allow on every visit** in Chrome's
   permission prompt. Do not select the folder again.
7. Close the popup and check read/write in site A. Expect `granted` and `readBack`.
8. Site B and **Check root access** must both report `handle: null`.
9. Reload the root page and repeat the checks. The tab retains the same two site
   origins, so this checks restoration from IndexedDB rather than another picker.

Reloading the iframe before renewal matters. Chromium reuses a live grant for the
same path, including the user action that originally created it. Its
[restore-prompt eligibility check](https://github.com/chromium/chromium/blob/153.0.8010.54/chrome/browser/file_system_access/chrome_file_system_access_permission_context.cc#L3153-L3208)
requires a grant loaded from storage, unless the permission expired in the
background. Retaining the original picker handle can therefore yield another
one-time prompt. Reloading only the iframe was sufficient in this experiment;
the root document stayed mounted throughout permission renewal.

Do not substitute an OPFS handle for this test or disable browser origin/storage
checks: that would not test native folder permission. The full-app integration
and third-party embedding are not implemented by this experiment.

### Observed result: Chrome 153.0.8010.54 on macOS

The test used the real picker and permission prompts in a separate Chrome
profile, without permission overrides or browser security exceptions.

| Check                                                                       | Result                           |
| --------------------------------------------------------------------------- | -------------------------------- |
| Picker inside the cross-origin iframe                                       | `SecurityError`                  |
| Read/write while the popup remained open                                    | Passed                           |
| Retained handle after closing a one-time popup                              | `prompt`, `NotAllowedError`      |
| Handle restored from IndexedDB after that close                             | `prompt`, `NotAllowedError`      |
| Persistent renewal after reloading only the iframe                          | Granted; root document unchanged |
| Retained and restored handles after closing the persistent-permission popup | Read/write passed                |
| Root-page reload after persistent approval                                  | Read/write passed                |
| Browser restart after persistent approval                                   | Read/write passed                |
| Root and site B after approval and browser restart                          | No handle in their IndexedDB     |

The browser-restart check restored the same generated site origins, rather than
creating new sites. Chrome's saved extended-permission setting also confirmed the
persistent grant. Reads verified the content written through the native handle;
no handle or file operation passed through the root page.

This confirms a same-site popup flow with persistent access in the tested Chrome
version. One-time approval still requires a top-level site window to remain open.
The guided flow above delays loading the picker handle into the app so the app
need not reload. Its one-window native permission sequence still needs a headed
manual check; the two-window probe does not establish that result. Other browsers
and cross-site embedding remain unverified.

## Why index.html moves too

Alice saves a shop, then opens a link that runs an unknown plugin. The plugin
must get its own browser storage, not access to the shop's OPFS directory.
The whole app runs with that plugin on a fresh origin. Saving retains that origin;
creating another Playground does not.

Keeping index.html on a trusted origin and moving only remote.html would require
a file service between them. Native directory handles cannot cross origins, and
a cross-origin child cannot simply open the parent's local-folder picker. Moving
the app and runtime together keeps native file access within one origin and
avoids that new file service. Embedding this app keeps the address on the root.
Changing sites replaces the iframe document. Save, rename, and tools still use
the existing SPA document. Native picking requires the guided popup above.

User code can read its own app, files, and browser storage. This design separates
sites; it cannot protect a site from a plugin the user runs inside that site.
Do not put account tokens in that app. Production authentication needs a trusted
origin with narrow, user-approved operations, not a token getter for site code.

## What changed

- Runtime URLs come from the executing document/worker, not the JS asset URL.
- PHP, OPFS metadata, thumbnail, and service-worker entry scripts stay same-origin.
  Small local wrappers load their code from the shared static host.
- Shared asset URLs include a build-specific prefix and use immutable HTTP
  caching. The browser can reuse their bytes across same-site subdomains.
- CacheStorage misses for shared, release-qualified assets use the HTTP cache.
  Each site still gets its own CacheStorage copies, filled only as assets are
  requested. There is no eager offline prefetch of unused PHP/WordPress versions.
- JS, CSS, and WASM bundles use Brotli. Runtime resume requests use the original
  bytes, because their offsets refer to the decoded WASM, not its compressed form.
- Overlapping frame-load and API backfill calls share one pending ZIP download
  and unzip. A later call can retry or check the filesystem again.
- Reopening a site origin selects its existing saved site. A used origin without
  a saved site moves to a fresh origin, including temporary-site reloads and
  deletion. New-site API calls
  stage setup on a fresh origin, then navigate. `updateUrl: false` rejects this
  operation rather than creating another site in the same storage bucket.
- A small, separately built `/origin-isolation.html` accepts two operations:
  the root lists display metadata and lets a site update only its own entry;
  an unused site origin accepts a one-time setup, including ZIP bytes or a
  snapshot of an edited Blueprint bundle. Binary files and empty directories
  survive the transfer; filesystem backends and handles never cross origins. It does
  not expose file reads, exports, directory handles, or deletion of other sites.
- The Playgrounds pane shows other origins as links, not local site records.
  Rename/delete publish metadata; file operations remain on the current origin.
  Deletion waits for existing writes and refuses an in-progress initial save; it
  does not cancel an import or allow its background copy to recreate deleted files.
- The root serves no `remote.html` or `api.html`. App documents and service-worker
  WordPress responses permit framing by the root and their own origin only, and
  sever cross-origin opener references. A sibling site anywhere in the ancestor
  chain blocks framing. Same-origin WordPress/editor frames still work.
  The narrow metadata/setup page remains embeddable across site origins.
- Direct site URLs can reload offline after their app and runtime have been cached.
  The generated shell manifest follows static imports, not every PHP version or
  optional editor. A new origin still needs a network connection.
- Public client exports and thumbnails use site-scoped entry points. GitHub
  sign-in and token acceptance are disabled on site origins.

## Verify

Stop the preview server first; the test starts its own server on port 9400.
Install Playwright's Chromium if it is not installed:

```sh
npx playwright install chromium
npx nx run playground-website:test:origin-isolation
```

To use an existing Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
The test uses a fresh persistent profile with no cache-partitioning overrides.
It counts actual static-server responses, including worker and service-worker
requests. It checks:

- JavaScript running inside WordPress cannot read or remove another site's OPFS
  marker. Writing the same path in site B does not change site A's file.
- A PHP filesystem edit survives reopening site A.
- Save, rename, and tool actions keep the SPA mounted.
- Saving a temporary site keeps its origin and SPA mounted.
- New Playground allocates a different origin.
- Large shared assets are not downloaded again for site B.
- Compressed PHP WASM is reused across two sites in a separate private context.
- Overlapping backfill calls do not download the ZIP twice in private browsing.
- Compression preserves runtime resume bytes and public CORS/cache headers.
- Unused PHP/WordPress versions are not requested.
- Repeat transfers and first-use assets are counted separately for each site.

Results are written to `dist/origin-isolation-results.json`.

### Existing E2E tests

The custom check above is not the regular suite. To run existing Playwright
assertions against the prototype after building it, stop any preview on 9400 and run:

```sh
npx nx run playground-website:e2e:origin-isolation --args="--project=chromium"
```

This separate configuration starts only the prototype server. Its base URL is
`http://site-e2e.playground.localhost:9400/`. Existing tests target that app
directly. `root-shell.spec.ts` targets the root and looks inside its iframe.
The regular browser lanes still use the normal single-origin build.

This runner uses one worker and no retries so failures remain visible. Version
settings tests now check the running PHP/WordPress version, not just a dropdown.
The ZIP-return tests accept a cross-origin link as well as the normal local
button. The runner also includes `playwright/origin-isolation/` checks for message
boundaries, fresh-origin creation, edited multi-file Blueprint runs, rename/delete,
offline reload, static-host routing, and disabled login.

JSON results, screenshots, and failure traces are written under
`dist/origin-isolation-e2e/`. The existing suite still includes contracts that the
prototype deliberately does not offer: several sites in one OPFS bucket,
no-navigation creation of a second site, global-start-page autosave prompts, and
site-origin OAuth. These need separate-origin product behavior and tests, not a
weaker isolation guard. Passing the custom cache check does not cover them.

### CI coverage

The **Local subdomain isolation and shared cache** job builds this prototype and
runs three checks in Chromium:

1. `origins.spec.ts` and `root-shell.spec.ts`: catalogue messages, invalid setup payloads, setup replay,
   site creation and retirement, edited bundle transfer, saved/offline reload,
   frame/opener restrictions, static-host routing, disabled sign-in, root-shell
   navigation, and the directory guide protocol.
2. The existing ZIP import persistence test from `opfs.spec.ts`, including
   switching back to the source and reopening the imported site.
3. `test:origin-isolation`: OPFS isolation from WordPress, SPA continuity, and
   shared network bytes in a persistent profile and a private context.

The job uses the full Chromium version pinned by the repository's Playwright
dependency, including Document-Isolation-Policy support for editor frames.
The cache probe does not disable browser cache partitioning. The Linux runner uses
`--no-sandbox` for the cache probe because it restricts Chromium's process sandbox;
web origin checks and cache partitioning remain enabled. Local runs keep the
sandbox. Reports and traces are uploaded only when the job fails.

This is not a claim that the full existing suite passes under subdomains, or that
Firefox/WebKit support is complete. The regular three-browser lanes continue to
check the normal build.

## Message and browser boundaries

- The bridge accepts requests only from its immediate parent, on an exact site
  origin with the same scheme and port. Replies bind to the frame, origin, and
  request ID. A same-origin sibling frame is not the parent.
- Catalogue writes use the browser-supplied sender origin as their key. A payload
  cannot select another entry. Names are rendered as text, never HTML. The list
  intentionally exposes names and save state, but no file APIs or credentials.
- Setup accepts canonical destination URLs and canonical bundle paths. It copies
  only known fields, bytes, and directory entries. It rejects existing OPFS files;
  an IndexedDB transaction permits only one claim, including concurrent requests.
  Consuming the payload keeps the claim, so an empty temporary origin stays used.
- App and PHP responses use `frame-ancestors 'self' http://playground.localhost:9400`
  and `COOP: same-origin`. The PHP response adds a separate CSP policy, preserving
  any WordPress policy. Root documents reject framing. A site cannot nest another
  site's app through the root. The bridge never boots PHP or exposes app APIs.
- The root accepts navigation/URL messages only from the selected app window and
  its exact origin. Nested WordPress frames cannot send these messages directly.
  Targets must be root or canonical site URLs with the same scheme/port. The
  iframe sandbox does not grant permission to navigate the top-level tab.
- Directory handles stay in site-origin IndexedDB and same-origin workers. The
  permission helper never accepts file commands. It validates source window,
  origin, and request ID for the root/check messages. Other sites cannot frame
  the helper, join the channel, or read that IndexedDB.
- Shared assets use wildcard CORS without credentials. They are public build
  outputs, never user files. No HTML app runs on the asset host, including encoded
  or case-varied paths. Production must retain this distinction; CORS must not
  be broadened to site files or APIs.

The launcher and catalogue use no account-authentication cookies. Production
still needs a cookie review: sibling origins share a site, so SameSite alone is not a boundary
between them. Do not use parent-domain credential cookies or relax
`document.domain`. Existing production origins, old service workers, third-party
embeds, and account operations need a separate rollout review.

## Why the HTTP cache can be shared

Both sites request exactly the same URL, for example:

```text
http://static.playground.localhost:9400/<release>/assets/php_8_3-<hash>.wasm
```

The site origin must not be part of that asset URL. Serving identical files at
`site-a.../php.wasm` and `site-b.../php.wasm` would create separate cache entries.

Chrome partitions its HTTP cache by the top-level site and the requesting frame's
site. These sibling subdomains have the same scheme and registrable domain, so
they can share that partition. OPFS is keyed by origin and remains separate.
No Privacy Sandbox permission or cross-origin storage-handle transfer is needed.
See [Chrome's HTTP cache partitioning explanation](https://developer.chrome.com/blog/http-cache-partitioning/).

The shared host serves public build files only. Its responses use wildcard CORS,
not `Vary: Origin`; changing the site subdomain must not change the asset response.
Compressed responses vary only on `Accept-Encoding`. The release prefix and
immutable response headers make normal HTTP caching safe. Unversioned production
URLs retain their existing `no-store` behavior, including the Safari deployment
workaround. Production deployment of this design must retain old release assets
while clients still use them.

HTTP caching is best-effort. Brotli reduces transfer size and lets the tested PHP
WASM reuse the smaller private cache. The already-compressed WordPress ZIP may
still download again in private browsing. The probe reports those repeated bytes
separately. We do not add a shared storage broker or split the ZIP into custom
chunks just to guarantee private-mode reuse.

## Limits

This is a local architecture experiment, not a deployment-ready security change.

- The catalogue shares site names, origins, and save state with every site. These
  fields are not private. It never shares site files or account credentials.
  Open a site to rename or delete it; another origin cannot perform those actions.
- Global autosave retention is not implemented. A site's untrusted metadata must
  not grant permission to delete another site's files. Autosaves on other origins
  remain until removed there; there is no cross-origin pruning endpoint.
- Creation ends the old iframe document, while the root stays mounted. API promises and callbacks from that document
  do not transfer. An incoming setup is consumed once; reload during import may
  require importing the original ZIP again. The source site stays intact.
- A failed Blueprint run does not automatically return to its source origin.
  The source remains available through its catalogue link.
- URL-loaded ZIP Blueprint bundles can lose their resource files when saved-site
  metadata is refreshed. That existing persistence path still needs work. The
  origin-transfer tests cover files added through the editor, including binary
  data, and saved reloads after running that edited bundle.
- No old-origin data migration or account/OAuth integration. GitHub sign-in is
  blocked until authenticated import/export can run on a trusted origin. User
  code can access its own app document and that origin's storage.
- Older direct site URLs still work. Their catalogue entries refresh when those
  sites are opened.
- HTTP cache reuse is best-effort. Private browsing, eviction, and other browsers
  can cause downloads again. The private-mode check reports repeated transfers
  separately; it does not promise that the large WordPress ZIP will stay cached.
- CacheStorage remains per-origin, including copies written by the PHP loader.
  The experiment measures network reuse, not disk deduplication.
- Browser quotas and storage eviction policies still apply. Fresh subdomains
  cannot start offline. The new root shell has no offline service worker yet;
  direct saved-site URLs retain the existing offline path. Safari/Firefox and
  third-party embedding need separate testing.
- Production needs wildcard DNS/TLS, host routing, immutable asset deployment,
  a trusted catalogue, narrow cross-origin messages where needed, and an audit
  of cookies, credentials, exported APIs, and all new-site entry points.

## Reading the cache report

`dist/origin-isolation-results.json` records shared response-body bytes for the
first and second site, separating repeated URLs from assets first requested by
the second site. It also records the private-context run and range-resume check.

A zero repeat-byte count means that the second site used already-downloaded
assets. It does not mean that it used no shared assets. The measurement excludes
small per-origin HTML documents and worker wrappers, and does not measure disk
deduplication. Browser eviction can change later results.
