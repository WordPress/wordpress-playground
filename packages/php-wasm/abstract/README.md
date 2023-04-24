# php-wasm-abstract

Common abstraction for @php-wasm/node and @php-wasm/web.

This package is not published on NPM and is not intended for direct consumption
by anything else than @php-wasm/node and @php-wasm/web.

The idea is that PHP for Node and PHP for Web share a lot of common code, but
they are not the same. The common code is abstracted away in this package, but
it's not useful for anything else. @php-wasm/node and @php-wasm/web provide
the actual implementations and are free to re-export or override anything
from this package.
