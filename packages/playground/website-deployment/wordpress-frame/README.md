# Two-host deployment on WP Cloud

The normal website deployment serves:

- App: `https://playground.wordpress.net`
- Rendered WordPress: `https://wpsandbox.wordpress.net`

Every WordPress frame uses the sandbox, whether or not the URL contains
`?reprint`. That flag still controls Reprint UI, not origin selection. The SPA,
PHP, OPFS, and picked directory handles stay on the app origin. Existing saved
sites use the same app-origin files when reopened; no storage migration is needed.
Shared scripts, PHP WASM, and WordPress downloads keep their app-host asset URLs.
The server's host rules do not depend on the query.

All request handling lives in `../custom-redirects-lib.php`. There is no separate
router to install. `apply-update.sh` installs the build and writes the small
public `custom-redirects.php` entry that calls `playground_handle_request()` with
the selected private build directory and configured sandbox origin. Personal WP
keeps its existing entry and separate deployment script.

## Before the first deployment

Both names must map to the same WP Cloud site and have valid TLS. Set
`canonicalize_aliases=false` so WP Cloud does not redirect the sandbox to the
app. The deployment refuses to proceed if a normal service-worker URL redirects
or returns an unexpected status.

Nginx must deny direct HTTP access to hidden files and
`/srv/htdocs/.playground-releases/`, including encoded paths. The deployment
script creates harmless, readable text probes in both locations and requires
HTTP 403 through both hosts before moving the build. It verifies TLS and never
follows redirects. A failed check leaves the active entry and public build
untouched. PHP cannot create this Nginx rule.

Do not run this deployment script on an unrelated WordPress installation. The
first deployment moves existing public files out of the web root.

## What the deployment does

The website deployment workflow configures both origins in its job environment:

```yaml
PLAYGROUND_APP_ORIGIN: https://playground.wordpress.net
VITE_WORDPRESS_SITE_URL: https://wpsandbox.wordpress.net
```

Vite reads `VITE_WORDPRESS_SITE_URL` for the browser build. The SSH step passes
those same two values to `apply-update.sh`. This one script performs the complete
deployment; there is no separate installer. It rejects invalid HTTPS origins or
matching hostnames before moving files. It writes the sandbox origin into that
release's PHP entry; the build has already written the app origin into the
sandbox files. Neither depends on request input or server environment.
The PHP library and deployment script contain no production-domain defaults.

The workflow rebuilds rather than reusing an Nx result made with a different
origin. The existing upload steps send the build, deployment scripts, and MIME
map to the server. A manual deployment must pass the same origins used for its
build:

```sh
~/website-deployment/apply-update.sh \
  https://playground.wordpress.net https://wpsandbox.wordpress.net
```

`apply-update.sh`:

1. Checks the required entry documents and service worker are present. Checks
   both public hosts and Nginx's private-path deny rule.
2. Installs the complete build under
   `/srv/htdocs/.playground-releases/release.<random>/files/`. The same release
   contains `custom-redirects-lib.php` and the generated `mime-types.php` map.
3. Saves the previous public entry and any old public build files under
   `~/website-backups/release.<random>/`. Keeps the platform's `__wp__` fallback.
   Hidden server files and directories stay in place. They are blocked by Nginx,
   and some, such as editor swap files, cannot be removed by the SSH account.
   If a move or the entry rename fails, restores the old public files so the
   unchanged entry can still run. The restore leaves existing permissions and
   directory timestamps alone; WP Cloud does not allow changing those on htdocs.
4. Replaces the public `custom-redirects.php` in one rename. Its paths select
   that exact release, so an in-flight PHP request continues using the previous
   release while later requests use the new one.
5. Purges the WP Cloud edge cache. A purge failure reports an error but leaves
   the new release active. Restoring public files at that point would bypass
   the sandbox host rule.

The first move from public files to a private build can briefly interrupt
requests. Later deployments keep previous private releases in place. Neither
old releases nor rollback backups are deleted automatically; remove obsolete
ones only after checking which entry files still refer to them.

Web PHP cannot read the SSH home directory. The release stays under `htdocs`
behind Nginx's deny rule, while backups stay outside public serving. Public HTML
or scripts left outside the private release would bypass the hostname checks.

The app host uses the existing `playground_handle_request()` logic for rewrites,
conditional and unconditional redirects, directory indexes, MIME types, custom
headers, cache exceptions, HEAD requests, and native PHP environment setup.
There is no replacement app handler or new app-side PHP allowlist. Their credentials still come from WP Cloud persistent data via
`playground_maybe_set_environment()`. The HTTP server returns 404 for scoped WordPress paths; the app service worker
rejects their app-origin aliases; WordPress responses are served only on the sandbox.
The build creates a separate document root inside the private build:

```text
files/
├── index.html, remote.html, api.html, assets/, ...
└── wordpress-sandbox/
    ├── wordpress-bridge.html
    ├── sw.js
    └── assets/<hashed-thumbnail-worker>.js
```

Only the contents of `wordpress-sandbox/` are served on the sandbox hostname.
Build-keyed `/wordpress-bridge-<build-version>.html` URLs map to that directory's
existing `wordpress-bridge.html`. This is the only alias: it cannot select app
documents or PHP. A previous browser worker lets the new build's helper URL
reach the server, so its obsolete script URL cannot block worker updates.
The helper already contains app-origin script and preload URLs. The small worker
files import the shared app-origin bundles. Vite finds the thumbnail worker from
its source-file mapping, so its changing hash does not need a PHP URL exception.
PHP serves these files as-is and returns 404 for missing files or paths escaping
that directory. No app redirects or native PHP execution run on this host. Its
WordPress pages come from the browser's service worker.
Other sandbox requests return 404.

Assets use the same app-host URLs for all Playgrounds, with CORS and caching.
Files are streamed, with byte ranges for resumable runtime downloads. Existing
app cache exceptions remain in effect, including no-store for the app/API entry
pages and identity encoding for static ZIP archives. Sandbox bootstrap responses
use `private, no-store`. Existing external iframe and SDK embeds need no referrer or
new URL parameters.

## Verify and roll back

The HTTP contract test builds the sandbox directory, runs `apply-update.sh` in a
temporary directory, then starts PHP with the installed public entry. It checks refused deployments,
old-file removal, protected hidden files, permission-preserving rollback,
configured non-production hosts, the app redirect/header/PHP
rules, shared assets, ranges, HEAD/OPTIONS, symlink and traversal rejection,
release switching, cache purging, and retained rollback files. Only the public
WP Cloud probes are stubbed; the test does not prove the live Nginx or TLS setup.
Run it with Node 24 and PHP:

```sh
npm exec -- nx run playground-website:test:wordpress-frame-router
```

After deployment, check both HTTPS hosts without bypassing TLS verification.
With and without `?reprint`, confirm the dock stays on the app host and WordPress
uses the sandbox host. Open both URLs together and check their pages and
database-tool popups still work.
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
