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

## Running unit tests

Run `nx test playground-remote` to execute the unit tests via [Jest](https://jestjs.io).
