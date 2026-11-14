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
bypass inspection. Malformed XML fails closed because browsers can execute a valid prefix before a later parse error.
The exact path and SHA-256 exceptions in `../../wordpress-builds/build/static-document-exceptions.json`
cover only reviewed upstream SVG defects: duplicate `fill` attributes in dashboard backgrounds
and JSX-style opacity attributes in six sides icons. Changed bytes require another review.
Passive XML/editor namespaces are ignored while their HTML/SVG/MathML descendants are inspected.
`playground-wordpress-builds:validate-static-documents` caches this scan through Nx by assets,
policy, reviewed exceptions and dependency lockfile. Asset refreshes and publication depend on it;
Vite outputs do not repeat it.
Internal DTD subsets and arbitrary external DTDs are rejected; only WordPress's
fixed legacy SVG font declaration is allowed.

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
   a build made for another release path, and any app page without its origin
   check (the sandbox origin for `wordpress-bridge.html`, the app origin otherwise).
   Checks both public hosts and Nginx's hidden-path deny rule.
2. Records the release in its private lifecycle metadata, so retention also removes
   an upload that fails before activation. Moves the build into
   `/srv/htdocs/.playground-releases/.staging-<id>/`, which the probes verified, then:
    - moves its PHP endpoints to `/srv/htdocs/.playground-releases/<id>/files/`,
      because Nginx would run them on both hosts if they stayed public;
    - writes the release's `custom-redirects-lib.php`, MIME map, and PHP entry.
3. Renames the staging directory to `/srv/htdocs/releases/<id>/`.
4. Records the complete root inventory and backs up every affected existing file under
   `~/website-backups/<id>/`, including files being removed. Records newly added files as absent.
5. Replaces the root `custom-redirects.php`, copies the release's entry pages to
   the web root, writes a root `/sw.js` that imports `/releases/<id>/sw.js`, and
   writes `release.json` naming the release, previous release, installation time and owned root files.
   Removes root files dropped by the new release and their empty parent directories.
   Any activation error restores the snapshot and removes newly introduced files. Each file is replaced through a
   same-directory rename. Pages needing custom headers, such as the no-store
   `index.html` and `api.html`, are not copied; PHP serves them from the release.
6. Purges the WP Cloud edge cache.

Inactive releases expire after 30 days by default (`PLAYGROUND_RELEASE_RETENTION_DAYS`),
measured from when they become inactive, with the active release and its previous rollback
release always protected. Private lifecycle metadata records `inactiveSince`; reactivation
clears it, so a long-lived deployment still gets a full window after replacement.
Activation and rollback record these transitions before replacing root files, independently
of edge purge or cleanup succeeding. Failed activation attempts can extend retention; they
cannot cause the next activation to inherit an expired inactivity timestamp. Cleanup removes
public assets, private PHP, any leftover staging directory and corresponding backups together after successful activation and its edge purge. Cleanup failures are reported after
the purge so they cannot leave stale entry responses cached.
Older tabs may need to reload after expiry. Legacy releases without installation metadata
need a one-time operator audit; the installer does not guess their ages.

`/builder/builder.html` remains PHP-served with no-store, leaving no root builder directory
that would capture `/builder/` ahead of its existing canonical redirect. The release's large
assets still use direct static serving.

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

Roll back with the same installer, naming the deployment whose pre-activation snapshot to restore:

```sh
PLAYGROUND_RELEASE_ID=<current-id> PLAYGROUND_ROLLBACK_BACKUP=<current-id> \
  ~/website-deployment/apply-update.sh \
  https://playground.wordpress.net https://wpsandbox.wordpress.net
```

The inventory restores replaced and deleted files and removes files introduced since the
snapshot, including the first transition from the PHP-only layout. It purges edge responses
after restoration. Rollback requires the target release to remain on disk.

For urgent revocation, first activate or restore a known-safe release, then remove the vulnerable
ID from both `releases/` and `.playground-releases/` and its backup, and purge the edge cache.
Do not wait for retention when a retained bundle is vulnerable. Already loaded documents and
browser caches cannot be recalled; a security fix may also need a worker-driven forced reload.
Retention bounds availability of old code; it is not a security revocation mechanism.

The preview models the observed WP Cloud static responses without adding Cache-Control.
The live Nginx and CDN policy remains a rollout check: test root HTML/worker revalidation,
release-file MIME types, ranges and actual cache lifetime on a staging host before enabling
production. Retained URLs are immutable on disk, without assuming a one-year edge lifetime.

Helpers and workers can overlap during retention. The v1 request/response envelope (`scope`,
`requestId`, `bodyPort`) stays compatible; new runtime release metadata is optional, with absent
metadata using legacy app-host asset aliases. A frozen v1 helper fixture tests the newer worker.
Version the handshake before making an incompatible protocol change.

This split does not stop WordPress from embedding a fresh app/API document, and
running Playgrounds still share one WordPress origin, without per-site HTTP
authorization.
