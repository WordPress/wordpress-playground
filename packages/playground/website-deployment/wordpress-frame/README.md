# Two-host deployment on WP Cloud

The normal website deployment serves:

- App: `https://playground.wordpress.net`
- Rendered WordPress: `https://wpsandbox.wordpress.net`

Every WordPress frame uses the sandbox. The SPA, PHP, OPFS, and picked
directory handles stay on the app origin. Existing saved sites use the same
app-origin files when reopened; no storage migration is needed.

Both hostnames map to one web root, and Nginx serves its existing files directly
on both. Only requests for missing files run PHP. All request handling for those
lives in `../custom-redirects-lib.php`; there is no separate router to install.
Personal WP keeps its existing entry and separate deployment script.

## Before the first deployment

Both names must map to the same WP Cloud site and have valid TLS. Set
`canonicalize_aliases=false` so WP Cloud does not redirect the sandbox to the
app. The deployment refuses to proceed if a normal service-worker URL redirects
or returns an unexpected status.

Nginx must deny direct HTTP access to hidden files and
`/srv/htdocs/.playground-releases/`, including encoded paths. The deployment
script creates harmless, readable text probes in both locations and requires
HTTP 403 through both hosts before installing anything. PHP cannot create this
Nginx rule.

Do not run this deployment script on an unrelated WordPress installation.

## What the deployment does

The website deployment workflow configures both origins in its job environment
and chooses a unique release ID for each build:

```yaml
VITE_PLAYGROUND_APP_ORIGIN: https://playground.wordpress.net
VITE_WORDPRESS_SITE_URL: https://wpsandbox.wordpress.net
```

With `PLAYGROUND_RELEASE_ID` set, Vite builds with base `/releases/<id>/`, so
every asset URL names its release. It also adds an inline check to the top of
every app HTML page, including copied public pages, which stops the page before
any script loads unless it runs on its intended origin: the WordPress request
helper on the sandbox, everything else on
the app origin. Both hostnames serve every file, so this check is what keeps app
pages off the sandbox host and the helper off the app host.

The build also parses WordPress HTML, XHTML, SVG (including SVGZ), and XML documents and rejects
active content using DOMPurify. This includes event attributes, encoded script
URLs, embedded documents, SVG animation, and XML stylesheet instructions. It
checks the parsed tree without rewriting the original template or image bytes.
XML documents must use UTF-8; unsupported encodings fail the build rather than
bypass inspection. Malformed UTF-8 XML remains an inert browser error document.

The workflow builds the self-hosting download separately, without a release base
or production origins, before building the WP Cloud release.

The SSH step passes the same release ID and origins to `apply-update.sh`. A
manual deployment must pass the values used for its build:

```sh
PLAYGROUND_RELEASE_ID=<id> ~/website-deployment/apply-update.sh \
  https://playground.wordpress.net https://wpsandbox.wordpress.net
```

`apply-update.sh`:

1. Rejects non-canonical origins, matching hostnames, a missing entry document,
   a build made for another release path, and pages without the app-origin
   check. Checks both public hosts and Nginx's hidden-path deny rule.
2. Moves the build into a hidden staging directory, then:
    - moves its PHP endpoints to `/srv/htdocs/.playground-releases/<id>/files/`,
      because Nginx would run them on both hosts if they stayed public;
    - writes the release's `custom-redirects-lib.php`, MIME map, and PHP entry.
3. Renames the staging directory to `/srv/htdocs/releases/<id>/`.
4. Backs up each root file it is about to replace under `~/website-backups/<id>/`.
5. Replaces the root `custom-redirects.php`, copies the release's entry pages to
   the web root, writes a root `/sw.js` that imports `/releases/<id>/sw.js`, and
   writes `release.json` naming the release. Each file is replaced through a
   same-directory rename. Pages needing custom headers, such as the no-store
   `index.html` and `api.html`, are not copied; PHP serves them from the release.
6. Purges the WP Cloud edge cache.

Previous releases, their private PHP directories, and backups stay in place, so
open tabs keep loading the files their release names. Nothing removes old
releases yet; clean up obsolete ones manually after checking which root files
and backups still refer to them.

## Requests that reach PHP

On the app host, missing paths use the existing `playground_handle_request()`
logic: rewrites, redirects, directory indexes, MIME types, custom headers, cache
exceptions, HEAD requests, and native PHP environment setup. Static files come
from the active public release; PHP endpoints from its private directory. This
keeps the custom headers on stable public URLs such as `/client/index.js`.

On the sandbox host, PHP serves the active release's request helper for the
versioned `/wordpress-bridge-<build-version>.html` URLs that older clients use,
and returns 404 for everything else. No app redirects or PHP endpoints run there.

Top-level GET navigations to scoped paths that no sandbox worker handled, such as
a new Safari tab, redirect from the sandbox to the same path and query on the app.
The app serves the active release's `wordpress-popup.html` wrapper there, whose
iframe loads the original sandbox URL. Other scoped requests return 404, so
iframes never redirect and a missing runtime cannot nest wrappers.

## Moving from the PHP-served layout

The previous layout served every file through PHP from a hidden release. The
first deployment of this layout adds the public release, root copies, and root
`/sw.js` next to it and replaces `custom-redirects.php`; the old hidden releases
stay in place. Browsers update their existing `/sw.js` registrations on both hosts
to the new loader, which chooses its role by origin. Tabs opened before the switch
can no longer load their old root `/assets/` chunks, as with any earlier deployment.

## Verify and roll back

The HTTP contract test runs `apply-update.sh` against a temporary web root and
serves it like WP Cloud: existing public files directly, hidden paths denied, and
missing paths through the installed PHP entry. Only the public WP Cloud probes
are stubbed; the test does not prove the live Nginx or TLS setup. Run it with
Node 24 and PHP:

```sh
npm exec -- nx run playground-website:test:wordpress-frame-router
```

After deployment, verify on both HTTPS hosts: Nginx MIME types (including
`application/wasm`), byte ranges, archive compression, framing, and edge caching.
Confirm the dock stays on the app host and WordPress uses the sandbox host, and
that app pages loaded on the sandbox host stop with an error.

To roll back a later deployment, copy the root files from that deployment's
backup back into place through same-directory renames, then purge the edge
cache. Keep the releases they name. To undo the first deployment of this layout,
restore the previous `custom-redirects.php` and also remove the root copies,
root `/sw.js`, `release.json`, and `releases/` directory, because Nginx serves
existing files before PHP runs.

This split does not stop WordPress from embedding a fresh app/API document, and
running Playgrounds still share one WordPress origin, without per-site HTTP
authorization.
