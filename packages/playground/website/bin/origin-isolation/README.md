# Full-app origin isolation prototype

Each site runs `index.html`, `remote.html`, PHP, the service worker, and WordPress
on one local origin. Native directory handles stay on that origin. No filesystem
bridge is added.

```text
playground.localhost:9400
  launcher and a localStorage list of links; no Playground runtime

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

Create two Playgrounds from the launcher. Return to the launcher to switch.
The app's New Playground action also allocates a fresh subdomain. Saving a
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
- Reopening a site origin selects its existing site. Creating a second site on
  that origin is blocked. Its New action goes through the launcher instead.
- The launcher serves no `remote.html` or `api.html`. Site documents reject
  cross-origin framing. There is no cross-site file or catalogue message API.

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
- Unused PHP/WordPress versions and the offline manifest are not requested.

Results are written to `dist/origin-isolation-results.json`.

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

- The launcher's list contains generated links and launch numbers. It is not yet
  the app's global site catalogue; rename/delete are not synchronized into it.
- ZIP/GitHub imports and recreating a site with changed settings are blocked once
  a site exists. They need a fresh-origin handoff before they can be enabled.
- No offline support, old-origin data migration, or account/OAuth integration.
  Do not sign in or store account tokens in this prototype. User code can access
  its own app document and that origin's storage.
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
