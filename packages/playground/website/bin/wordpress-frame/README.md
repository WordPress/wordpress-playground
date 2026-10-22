# WordPress-only origin prototype

The user stays on `http://playground.localhost:9500`, with the usual SPA and dock.
Only rendered WordPress pages use `http://wp.playground.localhost:9500`.
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

Open <http://playground.localhost:9500/?wp=6.9&php=8.3>. This is a built preview;
source changes require rebuilding and restarting. It binds to `127.0.0.1` only.
The `playground.localhost` hostname enables the experiment. Normal builds on other origins
retain their existing behavior. This work is separate from PR #4357.

## Boundaries

- The app, `remote.html`, PHP worker, and all directory handles remain same-origin.
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
  Eager offline prefetch is disabled. Root-origin scoped requests return 404,
  including requests intercepted by its service worker.

## External embeds

Existing plain iframes and SDK calls work without a referrer or new URL parameters.
This includes nested external embeds and app HTML served from the offline cache.
For example, an external page can keep this iframe unchanged:

```html
<iframe
  src="http://playground.localhost:9500/"
  referrerpolicy="no-referrer"
></iframe>
```

No referrer-based framing allowlist is installed. Requiring every external frame
to identify its origin would break existing embeds that hide their referrer.

## Limits

**All Playgrounds share the WordPress origin.** Its OPFS, IndexedDB, cookies, and
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
deployment is not included. No saved-site migration or account-token flow is changed.

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

The browser checks cover direct parent OPFS and API access, unchanged external
embeds with hidden referrers, cached HTML, and poisoned WordPress helper and
thumbnail cache entries. The OPFS check creates a private file on the app origin, attempts
reads and writes from WordPress, and checks that the private file is unchanged.

## CI

CI runs the existing website suite on its normal origin. Each browser also runs a
split-origin storage lane, including the new boundary checks. Regular split-origin
shards and the workflow checks are added by the next PR in the stack.

The preview uses port 9500. CI uses port 80 because WordPress multisite rejects
custom ports.
