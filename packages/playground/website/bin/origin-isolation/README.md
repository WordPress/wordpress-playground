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
the launcher. New Playground, ZIP import, and settings that create a new site
allocate a fresh subdomain. Saving a
temporary site, renaming, and opening tools stay in the same document. Switching
sites requires a top-level navigation because the next site has another origin.

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
  an unused site origin accepts a one-time setup, including ZIP bytes. It does
  not expose file reads, exports, directory handles, or deletion of other sites.
- The Playgrounds pane shows other origins as links, not local site records.
  Rename/delete publish metadata; file operations remain on the current origin.
- The launcher serves no `remote.html` or `api.html`. Site documents reject
  cross-origin framing. Only the narrow metadata/setup page permits it.
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
Normal CI still uses its normal single-origin build.

This runner uses one worker and no retries so failures remain visible. Version
settings tests now check the running PHP/WordPress version, not just a dropdown.
The ZIP-return tests accept a cross-origin link as well as the normal local
button. The runner also includes `playwright/origin-isolation/` checks for message
boundaries, fresh-origin creation, rename/delete, offline reload, static-host
routing, and disabled login. Normal CI does not include those prototype tests.

JSON results, screenshots, and failure traces are written under
`dist/origin-isolation-e2e/`. The existing suite still includes contracts that the
prototype deliberately does not offer: several sites in one OPFS bucket,
no-navigation creation of a second site, global-start-page autosave prompts, and
site-origin OAuth. These need separate-origin product behavior and tests, not a
weaker isolation guard. Passing the custom cache check does not cover them.

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

HTTP caching is still best-effort. Chromium's memory-cache implementation caps a
single entry at one eighth of the cache budget; the default budget reaches 50 MiB
on machines with enough memory. Brotli brings the tested PHP WASM below that
6.25 MiB entry limit. The already-compressed WordPress static ZIP remains larger.
See [Chromium's memory cache implementation](https://raw.githubusercontent.com/chromium/chromium/main/net/disk_cache/memory/mem_backend_impl.cc).
We do not add a shared storage broker or split the ZIP into custom chunks just to
work around a private-mode cache limit.

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

## Local run: 2026-09-24

Chromium 149.0.7827.55, PHP 8.3, WordPress 6.9, fresh profiles:

- The custom isolation/cache check passes with normal cache partitioning enabled.
- Site A fetched 30,593,430 bytes of shared response bodies. Site B fetched zero
  repeated bytes, including no repeat download of the WordPress ZIP or PHP WASM.
- In a separate private context, site B fetched the 18,812,006-byte WordPress ZIP
  again. PHP WASM was reused. That run also fetched 10,097 bytes of thumbnail
  scripts; late first-use requests are tracked separately from repeat transfers.
- Saved-file reopening, save/rename/tool SPA continuity, temporary-to-saved
  conversion, fresh-origin creation, and runtime resume offsets pass.
- All 511 remote/website unit tests and both packages' lint/type checks pass.
- All eight origin-boundary browser tests pass, including rename/delete
  publication, used-origin retirement, and a saved file surviving offline reload.

These measurements exclude each site's small HTML documents and worker wrappers.
A zero repeat-byte count means the browser reused prior downloads, not that the
second site did not use those assets. Cache eviction can change the result.

## Local run: 2026-09-23

Chromium 151.0.7922.34, PHP 8.3, WordPress 6.9, fresh profiles:

| Context            | First site shared response bodies | Second site shared response bodies |
| ------------------ | --------------------------------: | ---------------------------------: |
| Persistent profile |                  30,603,695 bytes |                            0 bytes |
| Private context    |                  30,593,045 bytes |                   18,812,025 bytes |

The private context downloaded only the WordPress static ZIP again, once.
PHP WASM and the app bundles were reused. The ZIP is still above the private
HTTP cache's per-entry limit; eliminating this remaining transfer needs a
different archive layout or a shared download service. Neither is part of this
prototype. A 304 service-worker revalidation had no response body. These numbers
exclude each site's small HTML documents and worker wrappers.

All browser checks passed, including OPFS isolation from inside WordPress,
saved-file persistence, save/rename/tool SPA continuity, temporary-to-saved
conversion, fresh-origin creation, and compressed-runtime resume offsets.
The build, lint/type checks for remote and website, 52 remote tests, 33 OPFS
tests, 24 routing tests, and 4 site-management API tests passed.

## Earlier local run: 2026-09-22

Chromium 151.0.7922.34 passed the browser check before compression was added.
Site B transferred **0 bytes of shared asset response bodies** after site A;
only the shared service-worker module was revalidated with a 304 response.
Per-origin HTML and small worker wrappers are still fetched. OPFS isolation,
persistence, temporary-to-saved conversion, and the New Playground action passed.
