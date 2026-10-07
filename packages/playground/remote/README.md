# playground-remote

This library was generated with [Nx](https://nx.dev).

## Shared WordPress tabs

PHP runs in a SharedWorker when the browser provides one. Each WordPress page
connects through a hidden `remote.html` frame. Closing the original Playground
tab leaves PHP and its in-memory files available to the other connected tabs.
Service-worker requests go through one port, so opening more tabs does not repeat
PHP writes.

Full-page navigation in the last remaining tab needs the `extendedLifetime`
SharedWorker option. [Chromium 148 and newer support it](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker/SharedWorker#browser_compatibility). WebKit currently stops PHP
during that navigation. Browsers without SharedWorker keep the dedicated-worker
path and still need the original Playground tab. This does not restore temporary
sites after all their tabs have closed and the browser has stopped PHP.

## Building

Run `nx build playground-remote` to build the library.

## Running unit tests

Run `nx test playground-remote` to execute the unit tests via [Jest](https://jestjs.io).
