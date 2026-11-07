# playground-remote

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build playground-remote` to build the library.

## Development

`npm run dev` starts this package in the website's `wordpress-frame` Vite mode.
The website proxies its trusted module requests from port 5400 to this server
while keeping the app Host header. Direct browser requests to port 4400 can load
only the WordPress HTTP helper and worker loaders. They cannot load the PHP/API
documents or arbitrary source modules. The helper imports its code from the app
port so it still knows which parent may send PHP responses.

`nx dev playground-remote` remains a standalone same-origin server. Personal WP,
sync, and non-loopback forwarded hosts also retain their previous routing.
See the [website development guide](../website/README.md#development).

## Runtime entry points

`remote.html` exposes public PHP/virtual-filesystem operations through an explicit
facade. It cannot assign OPFS directories or attach to shared runtimes.
`app-runtime.html` is the separate app-only endpoint: it checks its actual
app-origin parent before starting PHP and restricts RPC/port grants to that parent
at the configured app origin. The SDK selects it only through
`startPlaygroundWebForApp()`, which returns `AppPlaygroundClient`.

Only the app connection can submit storage mounts. Native OPFS handles are opened
inside the PHP worker and never need to cross contexts. Both documents share CSS,
startup/error rendering, and runtime implementation; their thin entry modules fix
the access policy. A URL flag cannot change it. Never forward a worker/class object
through window RPC or fall back from the app-only endpoint to public access.

## Running unit tests

Run `nx test playground-remote` to execute the unit tests via [Jest](https://jestjs.io).
