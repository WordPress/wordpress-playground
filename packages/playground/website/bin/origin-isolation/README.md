# Full-app origin isolation prototype

Each site runs `index.html`, `remote.html`, PHP, the service worker, and WordPress
on one local origin. Native directory handles stay on that origin. No filesystem
bridge is added.

```text
playground.localhost:9400
  launcher and display-only catalogue; no Playground runtime

site-<random UUID>.playground.localhost:9400
  SPA → remote.html → WordPress
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

Create two Playgrounds from the launcher. Switch using the Playgrounds pane or
the launcher. New Playground, ZIP import, edited Blueprint runs, and settings that create a
new site allocate a fresh subdomain. Saving a
temporary site, renaming, and opening tools stay in the same document. Switching
sites requires a top-level navigation because the next site has another origin.

## Why index.html moves too

Alice saves a shop, then opens a link that runs an unknown plugin. The plugin
must get its own browser storage, not access to the shop's OPFS directory.
The whole app runs with that plugin on a fresh origin. Saving retains that origin;
creating another Playground does not.

Keeping index.html on a trusted origin and moving only remote.html would require
a file service between them. Native directory handles cannot cross origins, and
a cross-origin child cannot simply open the parent's local-folder picker. Moving
the app and runtime together keeps native file access within one origin and
avoids that new file service. The cost is a top-level navigation when changing
sites. Save, rename, and tools still use the existing SPA document.

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
  the launcher lists display metadata and lets a site update only its own entry;
  an unused site origin accepts a one-time setup, including ZIP bytes or a
  snapshot of an edited Blueprint bundle. Binary files and empty directories
  survive the transfer; filesystem backends and handles never cross origins. It does
  not expose file reads, exports, directory handles, or deletion of other sites.
- The Playgrounds pane shows other origins as links, not local site records.
  Rename/delete publish metadata; file operations remain on the current origin.
  Deletion waits for existing writes and refuses an in-progress initial save; it
  does not cancel an import or allow its background copy to recreate deleted files.
- The launcher serves no `remote.html` or `api.html`. App documents and
  service-worker WordPress responses reject cross-origin framing and sever
  cross-origin opener references. Same-origin WordPress/editor frames still work.
  The narrow metadata/setup page remains embeddable across origins.
- Saved sites can reload offline after their shell and runtime have been cached.
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
`http://site-e2e.playground.localhost:9400/`; navigating to the launcher root
instead would show the site list, not the app that these tests expect.
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

1. `origins.spec.ts`: catalogue messages, invalid setup payloads, setup replay,
   site creation and retirement, edited bundle transfer, saved/offline reload,
   frame/opener restrictions, static-host routing, and disabled sign-in.
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
- App and PHP responses use `frame-ancestors 'self'` and `COOP: same-origin`.
  The PHP response adds a separate CSP policy, preserving any WordPress policy.
  The bridge is the exception and never boots PHP or exposes app APIs.
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
- Creation ends the old document. API promises and callbacks from that document
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
- Older prototype launcher links remain as fallbacks. They do not gain full
  metadata synchronization until those sites are opened.
- HTTP cache reuse is best-effort. Private browsing, eviction, and other browsers
  can cause downloads again. The private-mode check reports repeated transfers
  separately; it does not promise that the large WordPress ZIP will stay cached.
- CacheStorage remains per-origin, including copies written by the PHP loader.
  The experiment measures network reuse, not disk deduplication.
- Browser quotas and storage eviction policies still apply. Fresh subdomains
  cannot start offline. Safari/Firefox and embedding need separate testing.
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
