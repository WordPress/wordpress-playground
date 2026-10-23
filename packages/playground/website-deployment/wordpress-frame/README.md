# Two-host deployment on WP Cloud

The normal website deployment serves:

- App: `https://playground.wordpress.net`
- Rendered WordPress: `https://wasm.wordpress.net`

All request handling lives in `../custom-redirects-lib.php`. There is no separate
router to install. `apply-update.sh` installs the build and writes the small
public `custom-redirects.php` entry that calls `playground_handle_request()` with
the selected private build directory. Personal WP keeps its existing entry and
separate deployment script.

## Before the first deployment

Both names must map to the same WP Cloud site and have valid TLS. Set
`canonicalize_aliases=false` so WP Cloud does not redirect the sandbox to the
app. The deployment refuses to proceed if a normal service-worker URL redirects
or returns an unexpected status.

`wasm.wordpress.net` currently redirects to the app. Changing the server does not
clear a browser's cached 301. Before activation, test the helper and service-worker
URLs in a browser with that old redirect cached. Purging the server's edge cache
does not purge browsers' redirect caches.

Nginx must deny direct HTTP access to `/srv/htdocs/.playground-releases/`,
including encoded paths. The installer creates a harmless text probe there and
requires HTTP 403 through both hosts before uploading the build into that
location. It verifies TLS and never follows redirects. A failed check leaves
the active entry and public build untouched. PHP cannot create this Nginx rule.

Do not run this deployment script on an unrelated WordPress installation. The
first deployment moves existing public files out of the web root.

## What the deployment does

The website deployment workflow builds the normal merged website with
`VITE_WORDPRESS_SITE_URL=https://wasm.wordpress.net`. It rebuilds rather than
reusing an Nx result made with a different origin. The existing upload steps
send the build, deployment scripts, and MIME map to the server.

`apply-update.sh` runs `install-release.sh`, which:

1. Checks the required entry documents and service worker are present. Checks
   both public hosts and Nginx's private-path deny rule.
2. Installs the complete build under
   `/srv/htdocs/.playground-releases/release.<random>/files/`. The same release
   contains `custom-redirects-lib.php` and `mime-types.json`.
3. Saves the previous public entry and any old public build files under
   `~/website-backups/release.<random>/`. Keeps the platform's `__wp__` fallback.
4. Replaces the public `custom-redirects.php` in one rename. Its paths select
   that exact release, so an in-flight PHP request continues using the previous
   release while later requests use the new one.
5. Purges the WP Cloud edge cache.

The first move from public files to a private build can briefly interrupt
requests. Later deployments keep previous private releases in place. Neither
old releases nor rollback backups are deleted automatically; remove obsolete
ones only after checking which entry files still refer to them.

Web PHP cannot read the SSH home directory. The release stays under `htdocs`
behind Nginx's deny rule, while backups stay outside public serving. Public HTML
or scripts left outside the private release would bypass the hostname checks.

The app host serves trusted HTML, shared assets, and the existing allowed native
PHP endpoints. Their credentials still come from WP Cloud persistent data via
`playground_maybe_set_environment()`. Scoped WordPress paths return 404.
The sandbox serves only the request-helper page and service-worker/thumbnail
worker loaders. Its WordPress pages come from the browser's service worker.
Other sandbox requests return 404.

Assets use the same app-host URLs for all Playgrounds, with CORS and caching.
Files are streamed, with byte ranges for resumable runtime downloads. HTML uses
`private, no-store`. Existing external iframe and SDK embeds need no referrer or
new URL parameters.

## Verify and roll back

The HTTP contract test runs the real installer in a temporary directory, then
starts PHP with the installed public entry. It checks refused deployments,
old-file removal, both hosts, a native PHP endpoint, shared assets, ranges,
HEAD/OPTIONS, release switching, and retained rollback files. Only the public
WP Cloud probes are stubbed; the test does not prove the live Nginx or TLS setup.
Run it with Node 24 and PHP:

```sh
npm exec -- nx run playground-website:test:wordpress-frame-router
```

After deployment, check both HTTPS hosts without bypassing TLS verification.
Confirm the dock stays on the app host and WordPress uses the sandbox host.
Test a post save, saved-site switching, a database-tool popup, and a disposable
local folder outside Documents/iCloud. An unchanged external iframe with
`referrerpolicy="no-referrer"` must still load. Repeat the direct-parent OPFS
canary check from the browser suite.

For a later deployment, copy the previous `custom-redirects.php` from the named
backup into a temporary file under `htdocs`, then rename it over the active
entry. Keep the private release it points to. To undo the first deployment, also
restore the old public files from that backup. Purge the WP Cloud edge cache
after rollback. No WordPress database change is needed. Restore the alias setting
separately if required.

This split does not stop WordPress from embedding a fresh app/API document.
That route to saved storage remains unresolved; this is not complete protection
for saved files or native directory handles. Running Playgrounds still share one
WordPress origin, without per-site HTTP authorization.
