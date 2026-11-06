# Two-origin static release preview

The app stays on `http://playground.wordpress.localhost:9500`; rendered WordPress uses
`http://wpsandbox.wordpress.localhost:9500`. Both names resolve to loopback in Chromium.
The public static tree is shared, while browser execution, OPFS, and caches remain
separated by origin.

These are sibling hostnames, matching the production app/sandbox relationship.
For native hostname resolution, add this line to `/etc/hosts`:

```text
127.0.0.1 playground.wordpress.localhost wpsandbox.wordpress.localhost
```

```text
app origin
  static bootstrap -> selected release's SPA
    remote.html -> PHP worker -> app OPFS / picked directory
      hidden sandbox-origin HTTP transport frame
      visible sandbox-origin WordPress frame
```

## Build and run

Use Node 24 and PHP. From the repository root:

```sh
nvm use
npm ci
npm exec -- nx run playground-website:sync-reprint
npm exec -- nx run playground-website:build:wordpress-frame
npm exec -- nx run playground-website:preview:wordpress-frame
```

Open <http://playground.wordpress.localhost:9500/?wp=6.9&php=8.3>.
Source changes require rebuilding; this is not the Vite development server. It
binds to `127.0.0.1` on port 9500 and does not replace normal development on 5400
and 4400. Normal Vite development retains those fixed ports and source reloads.

## Released interactive code block integration

After building, run the downstream plugin check with Playwright:

```sh
npm exec -- nx run playground-website:e2e:wordpress-frame -- --project=chromium interactive-code-block.spec.ts --retries=0
```

The test installs the real WordPress.org `interactive-code-block` plugin (the
`wordpress-playground-block` package in `WordPress/playground-tools`) in a separate
Node-hosted WordPress server on an ephemeral port. It publishes a post containing
the block, activates its preview, edits and runs PHP, checks the downloaded ZIP,
and opens the full-page view. The embedding page, app iframe, and rendered
WordPress have distinct origins. No SDK or RPC methods are mocked.

`playwright/wordpress-frame/interactive-code-block-release.json` pins the plugin
version, download URL, and SHA-256. The verified ZIP is cached in
`node_modules/.cache/playground-e2e/`. To update the fixture, change the version,
URL, and checksum together. The installed plugin's JavaScript keeps its compiled
logic; only literal `https://playground.wordpress.net` origins are replaced with
the app origin under test, including SDK imports and the full-page URL. The test
rejects accidental requests to the production app. Its worker fixture disposes
the WordPress server and PHP workers on completion or failure.

This spec belongs to the existing regular split-origin CI group and runs against
the same built release as the other website tests. It complements the separate
full-page block implementation and tests in `website-extras`.

## Installed preview layout

The build assembles `wordpress-frame-upload/`, then invokes the production
`website-deployment/apply-update.sh` in loopback-only mode. That mode accepts only
local hostnames and skips public-host preflight and edge purging because the local
server is not running yet. It installs a public release under
`dist/packages/playground/wordpress-frame-public/`. Upgrade tests get another
installation under `wasm-wordpress-net-new/` configured for port 7999.

The preview serves static files before any fallback, on both hostnames. It adds
CORS only for external SDK/schema compatibility, not internal sandbox assets.
Native PHP endpoints are not executed by this Express preview. The production
installer/HTTP contract test exercises real PHP fallback separately.

## Startup and release boundaries

The root `index.html` is a small static release selector and bootstrap. Startup
revalidates `/`, installs the dedicated app or sandbox worker, and verifies its
origin, role, protocol, release, activation, and control before loading app code.
A root-level immutable loader gives each worker root scope without special
response headers. Release assets use immutable public URLs, and root-relative app
downloads retain their document's selected release across worker replacement and
restart.

The app worker handles platform assets, app offline startup, and app-origin
scoped-request rejection. The sandbox worker handles WordPress HTTP requests,
response transformations, and sandbox static fallbacks. Its HTTP helper exposes
only requests for the assigned scope and public asset-directory metadata. PHP
APIs, OPFS, and picked directory handles remain on the app origin.

Sandbox helper HTML is generated from trusted worker code using a stable module
inside the requested retained release. WordPress-writable CacheStorage is never
used to load platform code. Other sandbox platform assets use their same-origin
HTTP URLs and browser HTTP cache. The app keeps its separate CacheStorage for
on-demand downloads; split-origin mode does not eagerly prefetch unused runtimes.

App entry pages and workers reject the wrong configured origin. Both hosts may
still fetch the same public static files. Serving the same bytes on the sandbox
does not give those documents access to app-origin storage.

Standalone builds without a sandbox retain a combined compatibility `sw.js`,
assembled from the shared handlers. Personal WP's explicit SharedWorker mode and
separate deployment remain independent of this static release layout.

## Embeds and remaining limits

Existing iframe and SDK embeds work without referrers or new origin declarations:

```html
<iframe src="http://playground.wordpress.localhost:9500/" referrerpolicy="no-referrer"></iframe>
```

WordPress cannot directly read an existing app parent document, its OPFS, or its
connected PHP API. WordPress can still embed a fresh app-origin API document and
connect to that new API. The split is not complete protection against every route
to saved files or native directory handles.

All Playgrounds share the sandbox origin's storage and can request other running
sites' known scopes. The HTTP scope selects a runtime; it is not per-site
authorization. PHP still runs on the app origin with its assigned filesystem
mounts. Parent-domain cookies are not separated merely by using these hostnames.

Database-tool popups use an app-origin wrapper containing a scoped sandbox frame,
so browsers keep the same storage partition as the running app. Local-directory
save checks use an OPFS-backed substitute for automation; verify the actual OS
folder picker manually before rollout.

## Verification

```sh
npm exec -- nx run playground-website:test:wordpress-frame-router
npm exec -- nx run playground-website:e2e:wordpress-frame
```

Browser checks cover multiple tabs and releases, installed-worker migration,
wrong-origin startup, saved-site reopening, external embeds, direct parent/OPFS
access, sandbox cache poisoning, offline startup, static backfill, popups, post
saving, thumbnails, and app-origin directory handles. The existing website suite
also runs through this preview. Storage-tagged tests run in their existing shared
lane; no second navigation or routing list is maintained.

Screenshots for agent work belong under the workspace's `.context/` directory.
See the [WP Cloud hosting guide](../../../website-deployment/README.md) for server
requirements, activation, rollback, and the checks that require a real deployment.
