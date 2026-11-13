# App and WordPress origins on WP Cloud

The app runs at `https://playground.wordpress.net`; rendered WordPress runs at
`https://wpsandbox.wordpress.net`. PHP WASM, saved files, OPFS, and picked directory
handles remain on the app origin.

Both hosts serve the same static files directly through Nginx. Dedicated app and
sandbox workers enforce their roles and route browser requests. App entry pages
reject the sandbox origin before starting app code; the transport helper rejects
the app origin. Each worker also rejects installation on the wrong origin.
These checks prevent our entry points from running in the wrong context. They are
not a server-side restriction on fetching public files.

Top-level GET navigations to scoped URLs that no sandbox worker handled, such as a
new Safari tab, reach the server. The sandbox host redirects them to the same path
and query on the app origin, which serves the selected release's trusted
`wordpress-popup.html` wrapper; its iframe loads the original sandbox URL. The app
worker serves the same wrapper for scoped app navigations. Other scoped requests
return 404, so iframes never redirect and a missing runtime cannot nest wrappers.

The app worker owns release routing, platform caches, offline startup, and
rejection of app-origin scoped WordPress requests. The sandbox worker owns
WordPress HTTP transport, static-file backfill, and response transformations. It
never trusts WordPress-writable CacheStorage for platform code. Its helper HTML
is generated from trusted worker code and imports the selected immutable release's
stable bridge module through the sandbox origin.

Shared scripts and WordPress static files use the requesting origin's URLs. Their
bytes can be identical on both hosts without sharing browser storage or requiring
internal CORS headers. Existing external SDK consumers retain their CORS behavior.

The root `index.html` bootstrap is the single atomic release selector. Public
release directories and root-scope worker loaders are immutable and retained.
Startup checks worker role, protocol, release, activation, and document control.
An existing app document retains its selected asset paths when another tab
activates a newer worker. Offline startup can reuse its installed worker and
cached release. No referrer or new embedder declaration is required.

See the [hosting guide](../README.md) for file placement, deployment, HTTP
requirements, verification, and rollback. The single `apply-update.sh` installs
both hosts; Personal WP keeps its existing independent deployment path.

## Remaining boundaries

The same-origin policy separates WordPress from an existing app document's OPFS
and APIs. WordPress still shares its own origin and browser storage with other
Playgrounds, and can request other running sites' known scopes. This is not
per-site authorization.

The split also does not prevent WordPress from embedding a fresh app-origin API
document and connecting to that API. Blanket denial of app files on the sandbox
hostname would not close that separate route. Do not treat this split as complete
protection against every route to saved files or native directory handles.
