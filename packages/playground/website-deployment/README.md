# Hosting playground.wordpress.net on WP Cloud

WP Cloud's Nginx serves the website's static files directly. The app and sandbox
hostnames expose the same public files. The browser selects an immutable release
and installs a dedicated worker for its origin before starting application code.
PHP handles native endpoints and exceptional legacy URLs; it does not stream
ordinary runtime downloads, scripts, styles, or WordPress static files.

## Public files and release selection

`apply-update.sh` installs this layout:

```text
/srv/htdocs/
├── index.html                       # Small bootstrap and authoritative release selector
├── bootstrap.js
├── remote.html, api.html            # Stable bootstrap documents
├── wordpress-bridge.html            # Sandbox bootstrap document
├── app-sw-release.<id>.js            # Immutable root-scope worker loaders
├── sandbox-sw-release.<id>.js
├── assets/                          # Retained hashed aliases for older clients
├── releases/release.<id>/            # Immutable public static build
│   ├── index.html, remote.html, api.html, assets/, wp-<version>/, ...
│   ├── release.json
│   ├── app-sw.js, sandbox-sw.js
│   └── wordpress-bridge.html, wordpress-bridge.js
├── custom-redirects.php              # WP Cloud's native PHP/fallback entry
└── .playground-releases/release.<id>/ # Nginx-protected native PHP and support files
```

The JSON in `index.html` names the selected release and both configured origins.
The installer uploads all immutable files and root-level worker loaders before
atomically replacing this one selector document. Native PHP requests read the
same selector, so their endpoint code comes from the selected release too.
Previous releases, loaders, and rollback backups are retained.

The bootstrap revalidates `/`, checks its expected origin, installs the selected
worker with root scope, and checks its role, protocol, and release through a
message handshake. It waits for document control before loading application
HTML. A failed installation or verification produces a startup error. Document
URLs, query parameters, fragments, and existing SDK iframe URLs remain intact.

Using `/` for selection also lets workers installed before this deployment find
the new bootstrap: those workers already fetch `/` network-first. A new selector
URL could otherwise be retained by their cache-first handler.

Application HTML names immutable resource URLs. The app worker also records each
document's selected release for remaining root-relative downloads. Those records
survive worker replacement and restart. Installing a newer worker in another tab
must not redirect an existing document's assets into a different release.

## Hostnames and response behavior

Both hostnames must map to this WP Cloud site with valid TLS. Keep
`canonicalize_aliases=false`; the sandbox must not redirect to the app hostname.
Nginx must deny hidden files, including `.playground-releases/` and encoded path
variants. The installer checks readable probes on both hosts before publishing.
It rejects incomplete uploads and build symlinks. Native PHP source is removed
from the public release and kept behind the deny rule.

Shared files are requested through the executing origin. Sandbox worker modules,
transport code, thumbnail resources, and WordPress static fallbacks therefore do
not require CORS. External SDK and download consumers still need their existing
CORS contracts. Stable compatibility URLs without a public file continue through
`custom-redirects-lib.php`, which supplies their redirects and headers.

Verify these properties against the actual WP Cloud static server before rollout:

- Correct JavaScript, WASM, CSS, and archive MIME types.
- Byte ranges and HEAD for large runtime downloads.
- Identity bytes for random-access `*store.zip` archives; do not transparently
  compress these responses.
- HTML and worker framing behavior compatible with existing external embeds.
- Revalidation of the root bootstrap and selection document. Immutable release
  files and loaders may be cached for a long time. Deployment purges the edge.

The original PHP static-file range handler remains for Personal WP and exceptional
fallback requests. Its bounded and open-ended GET ranges, HEAD behavior, and
unsupported-range handling are tested by
`npm exec -- nx run playground-website:test:static-file-ranges`.

## Deploy, verify, and roll back

Build with `PLAYGROUND_APP_ORIGIN=https://playground.wordpress.net` and
`VITE_WORDPRESS_SITE_URL=https://wpsandbox.wordpress.net`, then pass those same
origins to the existing single installer:

```sh
~/website-deployment/apply-update.sh \
  https://playground.wordpress.net https://wpsandbox.wordpress.net
```

A failure before selector activation restores the previous public entry documents.
An edge-purge failure reports an error and leaves the new coherent release active.
The first migration from the private-static layout can briefly interrupt startup
while the stable bootstrap documents and entry are installed.

For later deployments, restore the desired backup's `index.html` through a
same-directory temporary file and rename, then purge the edge. Retain the public
and private release and worker loaders it selects. Rolling back the first layout
migration additionally requires restoring the previous `custom-redirects.php` and
public-file layout from its backup; remove new bootstrap entries that did not
exist in that layout. Never delete a release still named by an active selector,
rollback backup, or supported running client.

Run the installation and HTTP contracts with Node 24 and PHP:

```sh
npm exec -- nx run playground-website:test:wordpress-frame-router
```

The test models Nginx static delivery before real PHP fallback and verifies that
ordinary static requests on either hostname invoke no PHP handler. It also checks
preflight rejection, upload validation, activation failure recovery, retained
releases, ranges, HEAD, native endpoints, redirects, and purge failure behavior.
It cannot verify the live WP Cloud Nginx, TLS, or edge configuration.

Personal WP retains its separate `my-wordpress-net/apply-update.sh`, no-argument
PHP handler, public-file layout, endpoint setup, and schema updates.

## Secrets

Native endpoints continue receiving secrets from WP Cloud Persistent Data through
`playground_maybe_set_environment()`. No server secret is written to the selector
or public static release. Personal WP's stats dashboard uses
`MYWP_EVENT_DASHBOARD_GITHUB_USERS` and its configured GitHub OAuth credentials.
