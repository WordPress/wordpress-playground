# php-wasm compile

This package contains the scripts to compile PHP and its dependencies to WebAssembly.

## Libraries

This package ships pre-built WebAssembly libraries required by PHP. The libraries are built using the [Emscripten](https://emscripten.org/) compiler.

To remove the pre-built libraries, run `make clean`.

To rebuild the pre-built libraries, run `make all`.

## PHP

To build PHP, run `node build.js` and pass at least the following arguments:

```bash
node build.js --PHP_VERSION=7.4 --output-dir=php-build --PLATFORM=node
```

## Browser socket scheduling

PHP's `select()` yields to JavaScript between socket reads. Emscripten's
zero-delay timer used to add a browser timer delay on each yield. The browser
loaders now use `scheduler.postTask()` for zero-delay sleeps, while preserving
timed sleeps and the timer fallback when that API is unavailable. This changes
the JavaScript loader only; the WASM binaries are unchanged.

Chrome / PHP 8.3 measurements on 2026-09-23, using curl's default receive buffer:

| Download                                       | Before |   After | Browser fetch |
| ---------------------------------------------- | -----: | ------: | ------------: |
| Local HTTP, 16 MiB                             | 10.9 s | 0.036 s |       0.119 s |
| WordPress 6.8 zip over HTTPS, 28,551,129 bytes | 44.8 s |  1.45 s |       0.777 s |

The before/after columns use the Playground worker. Browser fetch uses the same
CORS proxy for HTTPS. An Asyncify runtime also downloaded the HTTPS file in
1.24 s. Downloading it into a PHP file took 1.38 s and matched the native curl
SHA-256. These are download benchmarks, not full-site import times; file
processing and database import still add work.

Run `npm exec -- nx test php-wasm-compile` for scheduling checks against the
compiler source and every checked-in browser loader. For a manual speed check,
time PHP curl downloading a fixed-size local response and the public WordPress
zip into `/tmp`, then compare against browser fetch and native curl. Use a fresh
Playground runtime after changing the loader. Check both JSPI and Asyncify, and
verify that `usleep(125000)` still waits at least 125 ms.
