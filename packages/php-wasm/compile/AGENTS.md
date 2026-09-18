# PHP-WASM Compile

This package compiles PHP and its C library dependencies to WebAssembly using
Emscripten and Docker. It is not a TypeScript package — it's a Makefile + Dockerfile
build pipeline.

## Build Flow

```
base-image (Emscripten + build tools)
    ↓
Makefile targets (compile C libraries to .a files)
    ↓
php/Dockerfile (compile PHP with extensions, linking libraries)
    ↓
build.js (orchestrate Docker builds, extract WASM output)
    ↓
Output: packages/php-wasm/{web,node}-builds/<version>/{asyncify,jspi}/
```

## Key Files

- `build.js` — Entry point. Parses arguments, builds base image, runs PHP Docker
  build, extracts WASM output. Invoked by NX targets in `php-wasm-web`/`php-wasm-node`.
- `Makefile` — Compiles all C libraries. Each library has Asyncify and JSPI targets.
  Run `make all` to rebuild everything, or target individual libraries like
  `make libz_jspi`.
- `base-image/Dockerfile` — Ubuntu + Emscripten toolchain. All other builds depend
  on this image (`playground-php-wasm:base`).
- `php/Dockerfile` — The main PHP compilation. ~2400 lines. Accepts 20+ `--build-arg`
  flags for extensions and configuration.

## Two Compilation Variants

Every library and the PHP binary are built in two variants:

- **Asyncify** — Older approach. Transforms synchronous C code to be pausable/resumable.
  Works in all browsers but adds overhead.
- **JSPI** (JavaScript Promise Integration) — Modern approach. Better performance,
  requires newer browsers. Uses `-fwasm-exceptions` and `-sSUPPORT_LONGJMP=wasm`.

Libraries are stored under `<library>/{asyncify,jspi}/dist/`.

### Asyncify and `ASYNCIFY_IMPORTS`

Asyncify lets synchronous C code pause and resume across JavaScript async
boundaries. This requires telling Emscripten which functions may appear on
the call stack during an async operation. In `php/Dockerfile`:

- **`ASYNCIFY_IMPORTS`** — Functions at the JS ↔ WASM boundary that trigger
  async pauses: `invoke_*` glue functions (indirect calls) and JS bridge
  functions like `js_open_process`, `js_fd_read`, `wasm_poll_socket`, etc.
- **`ASYNCIFY_ONLY`** — Internal PHP/library functions that may be on the
  stack when an async pause happens (~200+ functions covering networking,
  image processing, XML/SOAP, etc.).

If a function is missing from either list, the runtime crashes with
**`RuntimeError: unreachable`**. The `@php-wasm/universal` package detects
this and reports which functions may be missing.

To fix missing functions, use the automated workflow:

```bash
npm run fix-asyncify
```

This iteratively recompiles PHP, runs tests, detects crashes, adds the
missing functions to the Dockerfile, and repeats until all tests pass.

JSPI does not need these lists — it uses native stack switching and only
requires `JSPI_IMPORTS` (async boundary functions) and `JSPI_EXPORTS`
(WASM functions callable from JS), both much smaller.

## Custom PHP Extensions

Located in subdirectories of this package:

- `php-wasm-memory-storage/` — Workaround for Emscripten's incomplete mmap/munmap
- `php-wasm-dns-polyfill/` — DNS lookups for the WASM environment
- `php-post-message-to-js/` — JS ↔ PHP communication bridge
- `opcache/` — OPcache adapted for WASM (with version-specific patches for PHP 8.4+)

## Critical Constraints

- **Emscripten version is pinned** in `base-image/Dockerfile`. Changing it requires
  rebuilding ALL libraries from scratch. Do not upgrade without understanding the
  implications.
- **Library dist/ directories are committed** to the repository. They contain
  pre-built `.a` files and headers. Recompilation is rarely needed.
- **PHP version-specific patches** exist in `php/Dockerfile`, especially for OPcache
  (PHP 8.4 renamed configuration variables). Check version guards when adding support
  for new PHP versions.
