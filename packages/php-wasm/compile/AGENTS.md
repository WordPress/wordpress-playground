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

## Library Dependency Graph

Libraries are compiled independently via Docker, then linked when building PHP.
Key dependencies (→ means "depends on"):

- `libgd` → `libz`, `libpng16`, `libjpeg`, `libwebp`, `libavif`
- `libcurl` → `libz`, `libopenssl`
- `libavif` → `libaom`
- `libImageMagick` → `libz`, `libjpeg`, `libpng16`, `libwebp`
- `libzip`, `libpng16`, `libjpeg`, `libwebp`, `libxml2`, `libopenssl`,
  `libsqlite3`, `libiconv` → `libz`
- `oniguruma`, `libaom` → (base image only)

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

## Common Tasks

### Rebuild a single library

```bash
cd packages/php-wasm/compile
make libz_asyncify        # or libz_jspi
```

### Rebuild all libraries

```bash
cd packages/php-wasm/compile
make all                  # builds all_asyncify + all_jspi
```

### Build PHP for a specific version and platform

```bash
node build.js --PHP_VERSION=8.4 --PLATFORM=web --JSPI
node build.js --PHP_VERSION=8.3 --PLATFORM=node
```

### Build PHP via NX (typical workflow)

```bash
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
npx nx recompile-php:asyncify php-wasm-node -- --PHP_VERSION=8.3
```

### Clean all library builds

```bash
cd packages/php-wasm/compile
make clean
```
