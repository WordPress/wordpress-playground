# WordPress-only origin prototype

The user stays on `http://playground.localhost:9500`, with the usual SPA and dock.
With `?reprint`, rendered WordPress pages use `http://wp.playground.localhost:9500`.
Both names resolve to loopback in Chromium. This server uses port 9500 so it does
not replace normal development on 5400 or the full-app prototype on 9400.

```text
playground.localhost:9500
  SPA / dock
    remote.html
      PHP worker -> root-origin OPFS or selected native directory
      hidden wp-origin transport frame
      WordPress iframe -> wp.playground.localhost:9500/scope:<site>/
```

## Run

Use Node 24. From the repository root:

```sh
npm ci
npx nx run playground-website:sync-reprint
npx nx run playground-website:build:wordpress-frame
npx nx run playground-website:preview:wordpress-frame
```

Open <http://playground.localhost:9500/?reprint&wp=6.9&php=8.3>.
Without `?reprint`, WordPress stays on the app origin. This is a built preview;
source changes require rebuilding and restarting. It binds to `127.0.0.1` only.
The `playground.localhost` hostname enables this built-preview setup. Normal builds
on other origins retain their existing behavior. `npm run dev` now uses the same
opt-in through the existing loopback Vite ports: app on 5400, WordPress on 4400. Source changes do not need a build there; see the
[website development guide](../../README.md#development).
This work is separate from PR #4357.

The normal WP Cloud deployment builds with
`VITE_WORDPRESS_SITE_URL=https://wasm.wordpress.net` and
`PLAYGROUND_APP_ORIGIN=https://playground.wordpress.net`. The latter produces a
small `wordpress-sandbox/` document root whose loaders import shared app bundles.
The built preview and upgrade-test server serve the same directory layout,
generated with their respective app addresses.
Host checks live in `custom-redirects-lib.php`; the single `apply-update.sh`
script installs the private build and its public entry. See the [deployment guide](../../../website-deployment/wordpress-frame/README.md).

## Boundaries

- With `?reprint`, the app, `remote.html`, PHP worker, and all directory handles remain same-origin.
  The top-level app can use its normal native folder picker. The save controls
  check the PHP iframe's origin, not the rendered WordPress URL. No popup or
  cross-origin filesystem protocol is added.
- The WordPress origin registers a service worker through a small helper page.
  Requests travel through that helper to the assigned PHP worker. Responses keep
  the existing streamed-body transport.
- The WordPress service worker generates the helper HTML and thumbnail-worker
  loader itself. It never loads platform code from WordPress-origin CacheStorage,
  which every WordPress page can modify. The initial helper document comes from
  the server; both paths load the same app-origin script bundle. Shared asset URLs
  and HTTP-cache reuse are unchanged, including during a warm offline startup.
- The helper can request HTTP responses for its assigned URL scope and read the
  public static-asset directory name. It cannot invoke arbitrary PHP client
  methods, mount a directory, or choose a different runtime.
- Window-backed client APIs accept messages only from their connected window.
  A child WordPress frame cannot use an existing parent API connection. The root
  HTTP server never serves scoped WordPress responses.
- Public scripts, PHP WASM, and WordPress downloads use identical root-origin
  URLs. The WordPress service worker imports its public code from that origin.
  The root keeps its existing on-demand asset cache, shared by every PHP worker.
  Eager offline prefetch is disabled. Root-origin scoped requests return 404
  for opted-in sites. The same app service worker also serves ordinary sites'
  app-origin scoped pages; each opted-in runtime explicitly rejects its app-origin
  HTTP route. Tabs do not install competing service-worker modes.

## External embeds

Existing plain iframes and SDK calls work without a referrer or new URL parameters.
This includes nested external embeds and app HTML served from the offline cache.
For example, an external page can keep this iframe unchanged:

```html
<iframe src="http://playground.localhost:9500/" referrerpolicy="no-referrer"></iframe>
```

No referrer-based framing allowlist is installed. Requiring every external frame
to identify its origin would break existing embeds that hide their referrer.

## Limits

This is a rollout flag, not a separate storage area. Ordinary, single-origin
WordPress pages can still read app-origin OPFS and alter its CacheStorage,
including data or assets used by opted-in sessions. Reopening a saved Reprint
clone without `?reprint` runs its WordPress code on the app origin again. The
startup choice survives SPA navigation but is not stored in site metadata.
The restrictions below apply to WordPress rendered on the sandbox origin.

**All opted-in Playgrounds share the WordPress origin.** Its OPFS, IndexedDB, cookies, and
other browser storage are not separated per Playground. This is deliberately a
first step, not the per-site isolation offered by the full-app prototype.
Sites can still request each other's scoped HTTP URLs. Excluding platform code
from WordPress-writable caches does not add per-site HTTP authorization.

WordPress cannot directly read an existing parent document or its OPFS, and
cannot call its connected PHP API. However, WordPress can still embed a fresh
app/API document and connect to that new document. Closing that route without
breaking external embeds remains unresolved. Do not treat this prototype as
complete protection for saved files or native directory handles.

PHP still runs in the root-origin WASM host with its assigned filesystem mounts. A compromise of that host is not contained to one site's
browser storage. This is not a sandbox for arbitrary root-origin JavaScript or
untrusted PHP extensions.

The `wp` child domain is not a complete cookie boundary: parent-domain cookies
can span both hosts. Offline startup needs a second online load to cache app
entry documents fetched before the app service worker took control. Production
deployment uses the WP Cloud handler described above. No saved-site migration or
account-token flow is changed.

Database-tool popups keep an app-origin top-level document and render WordPress
inside it. WebKit partitions service workers by the top-level origin, so opening
the WordPress origin directly would lose the running site's transport. The popup
accepts only scoped WordPress URLs and exposes no PHP or filesystem API.
phpMyAdmin disables its frame-breaking script only in the split-origin runtime;
its document still runs in the sandboxed WordPress-origin iframe.

## Check

Stop the preview first; Playwright starts its own server on 9500:

```sh
npx playwright install chromium
npx nx run playground-website:e2e:wordpress-frame --args='wordpress-frame.spec.ts --project=chromium'
```

The browser checks cover direct parent OPFS access, rejected child PHP API calls,
restricted helper methods, saved-site switching without replacing the SPA,
shared PHP/WordPress downloads, cache-poisoning attempts against the helper and
thumbnail-worker loader, warm offline startup, editor saves, the same-origin
directory-handle path, current-URL reporting, two-way app/WordPress messages,
outside-click dismissal, and cross-origin OAuth popups. The folder test
substitutes an OPFS handle for the OS picker. It does not
verify native permission prompts. For that check, select a disposable directory
outside Documents/iCloud from the normal Save panel, write a file, and reopen the
saved site. The picker should open from the main app, without a guide popup.

The API boundary check confirms that WordPress cannot use an existing parent
API connection or read the parent or top-level document and storage APIs.
The OPFS check writes a private file from `remote.html`,
attempts reads and same-path writes/deletes from WordPress, and confirms that
both root-origin documents still read the unchanged private file.

## CI

CI runs the entire existing website E2E suite once, against the WordPress-only
origin setup. Chromium, Firefox and WebKit each use three regular shards and one
single-worker storage lane: 12 browser jobs, not a second matrix for the old
same-origin setup. The real source-site Reprint import runs once in its dedicated
Chromium lane. No website test files are excluded. CI serves both prototype hosts on
port 80, because WordPress multisite rejects custom ports. The local preview
stays on 9500; multisite needs a default-port server instead.

The suite uses the shared `@storage` and `@reprint-import` routing. The extra
boundary checks run in the storage lane. Failure reports include traces and
screenshots. Existing browser skips remain unchanged. New OPFS and directory-handle
checks use Chromium, matching the regular storage suite; HTTP/API boundary checks,
editor saves, thumbnails and popups still run in all three browsers.

Deployment and offline tests use `playground.localhost:7999` and
`wp.playground.localhost:7999` when they switch to the new release. The bundled
old releases still exercise the upgrade from the old architecture. This matters:
running those tests on plain localhost would leave the origin split disabled.

Known areas to check in the full suite:

- Offline reload needs both origins' bootstrap documents and service workers.
  Eager offline prefetch is currently disabled in the prototype.
- APIs that assume the WordPress document and remote.html share an origin,
  including editor media, thumbnails, navigation and WebMCP.
- Saved-site imports, reloads and native directory mounts. The automated folder
  check uses an OPFS handle; actual OS picker prompts still need a manual check.
- Remote access and account flows. External embeds have browser checks for the
  default and hidden referrers, unchanged SDK loading, nested external frames,
  and cached HTML. Blocking fresh app/API frames remains unresolved.

To run the same full suite locally, build the normal CI fixtures first, then the
prototype. Set `PLAYWRIGHT_TEST_GROUP` to `regular`, `storage`, or `reprint-import`
and run this configuration. The import lane also needs its source-site server.
For a single existing test, pass its filename to `e2e:wordpress-frame`.
