# Split-origin staging on WP Cloud

This router is separate from the production deployment scripts. Do not run the
normal `apply-update.sh` against an existing staging WordPress installation: its
web-root sync deletes files absent from the build.

The intended production hosts are:

- App: `https://playground.wordpress.net`
- WordPress: `https://wasm.wordpress.net`

For staging, replace both origins below with two hostnames mapped to a separate
WP Cloud site. This PR does not enable the router in the production deployment.

Both hostnames need domain mappings and valid TLS. WP Cloud must serve aliases
without redirecting them to the primary domain (`canonicalize_aliases=false`).
`wasm.wordpress.net` currently redirects to the app. Before activation, remove
that redirect and test the helper and service-worker URLs in a browser with the
old redirect cached. Changing the server does not clear a browser's cached 301.

## Build and install

Build with Node 24, setting the WordPress origin at build time:

```sh
VITE_WORDPRESS_SITE_URL=https://wasm.wordpress.net \
  npx nx run playground-website:build:wordpress-frame
npx nx run playground-website:test:wordpress-frame-router
```

Merge the current `dist/packages/playground/{remote,website,website-extras}`
outputs into a **fresh** release directory. Include the client output under
`client/`, and the Blueprint schema and WP-CLI PHAR as in the normal website
assembly. Do not reuse an old merged directory; it may retain stale chunks.

Upload the release under `/srv/htdocs/.playground-releases/<commit>/files`.
WP Cloud blocks HTTP access to hidden paths, while PHP can read them. The SSH
home directory is not mounted in web PHP, so `~/playground-releases` cannot be
used by the request handler. Beside `files/`, put this `router.php`,
the existing `custom-redirects-lib.php`, and
`packages/php-wasm/universal/src/lib/mime-types.json`.

Back up any existing `/srv/htdocs/custom-redirects.php`. Install a small entry
file there which returns for CLI requests, requires the private release's
`router.php`, and calls:

```php
playground_serve_wordpress_frame(
    '/srv/htdocs/.playground-releases/<commit>/files',
    'https://playground.wordpress.net',
    'https://wasm.wordpress.net'
);
```

Use the uploaded release’s absolute path in both the `require` and the call.
Keep the previous release and entry file for rollback. Do not put configuration
or account secrets in the public build.

On a server with an older public build, first move its files to a private backup
outside `/srv/htdocs`. Keep the platform’s managed `__wp__` fallback. An old
public HTML file or script would otherwise bypass the new router and its host
checks. This staging setup replaces the public site; back up its configuration
and content too.

## Why direct release URLs must be blocked

Nginx serves existing public files before `custom-redirects.php` can inspect the
host or attach headers. The hidden release directory must therefore remain
blocked by Nginx. Before uploading HTML, create a harmless text file under that
directory and confirm HTTP 403 through both hosts, including percent-encoded
dots and slashes. Do not activate the router if any direct release URL works.

Normal build URLs then pass through the PHP host checks. No alternate public
path may bypass the host checks or expose files reserved for the app origin.

The WordPress host serves only the helper, service-worker loader, and marked
thumbnail-worker loader. Scoped WordPress pages come from its browser service
worker. Other requests return 404. The app host serves the shared assets, trusted
HTML, and the existing native PHP endpoints; it rejects scoped site URLs.

The router streams assets and supports range requests. Public asset responses
permit CORS and caching. HTML responses use `private, no-store`. Existing
external iframe and SDK embeds need no referrer or new URL parameters. Confirm
the actual public headers;
platform redirects or cached headers can bypass the intended response path.

## Check and roll back

Test both hosts without bypassing TLS verification. Confirm that neither
redirects, WordPress runs on the configured sandbox origin, and the dock stays
on the configured app origin.
Repeat the direct-parent OPFS canary and saved-site switch checks from the local
browser suite. An unchanged external iframe with `referrerpolicy="no-referrer"`
must still load.

This router does not block WordPress from embedding a fresh app/API document.
That route to saved storage remains unresolved; this staging build is not complete
protection for saved files or native directory handles. Native folder prompts still need a manual
check. OAuth and logging credentials are not installed by this staging upload.

To roll back the first deployment, remove the newly installed
`custom-redirects.php` and restore its backup if one existed. For later releases,
restore the previous entry file. If the first deployment moved a public build
aside, restore those files from the private backup too. No WordPress database
change is needed. Restore the previous alias setting separately if required.
