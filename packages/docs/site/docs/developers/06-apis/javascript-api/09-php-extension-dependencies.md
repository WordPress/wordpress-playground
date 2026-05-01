---
title: PHP extension dependencies
slug: /developers/apis/javascript-api/php-extension-dependencies
description: Link WebAssembly dependencies when building custom PHP.wasm extensions.
---

# PHP extension dependencies

Custom PHP.wasm extensions can only link WebAssembly code built with the same
Emscripten toolchain and JSPI ABI as the PHP runtime. Native host libraries from
`/usr/lib`, Homebrew, apt, or npm packages cannot be linked into the final
`.so`.

Build dependencies as static WebAssembly archives and pass their headers and
archives to `@php-wasm/compile-extension`.

## Playground-built dependencies

Some libraries already have recipes in `packages/php-wasm/compile`. Build the
JSPI target and pass the mounted path inside the helper container:

```bash
make -C packages/php-wasm/compile libz_jspi

npx @php-wasm/compile-extension \
	--source ./zlib-probe \
	--name zlib_probe \
	--php-versions 8.4 \
	--extra-cflags "-I/php-wasm-compile/libz/jspi/dist/root/lib/include" \
	--extra-ldflags "/php-wasm-compile/libz/jspi/dist/root/lib/lib/libz.a"
```

Use the `jspi` archive for custom extension builds.

## Vendored dependencies

If the dependency is not built by Playground, vendor the source under your
extension directory and build it with Emscripten before the extension is linked.
Paths from `--source` are available under `/build` inside the helper container:

```bash
npx @php-wasm/compile-extension \
	--source ./external-lib-probe \
	--name external_lib_probe \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/string-score/install/include" \
	--extra-ldflags "/build/vendor/string-score/install/lib/libstring_score.a"
```

`--extra-cflags` is visible during `./configure`. `--extra-ldflags` is applied
to the final side-module link so dependency archives do not break Autoconf's
compiler smoke tests.

## Prebuilt static archives

Use `--extra-ldflags` to link prebuilt static archives such as a Rust
`staticlib`. The helper detects `.a` entries in `--extra-ldflags` and
force-links them into the final side module with `--whole-archive`.

```bash
npx @php-wasm/compile-extension \
	--source ./my-rust-extension \
	--name my_rust_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/include" \
	--extra-ldflags "/build/target/wasm32-unknown-emscripten/release/libmy_rust_extension.a"
```

The extension still needs a small `phpize` wrapper. A common Rust pattern is:

- `config.m4` declares the PHP extension and builds a tiny C shim with
  `PHP_NEW_EXTENSION`.
- `_shim.c` defines the PHP module entry and calls exported Rust functions over
  C ABI.
- `--extra-ldflags` points at the Rust `staticlib` archive under `/build`.

Do not use `PHP_ADD_LIBRARY_WITH_PATH` for a sibling `.a` archive in
`config.m4`. PHP's libtool setup can look for a matching `.so`, fail to link
the archive into the side module, and still leave a build artifact behind. Pass
static archives through `--extra-ldflags` instead.

## CMake dependencies

Build CMake dependencies as static archives with Emscripten and store the
install tree under the extension source directory:

```bash
source /root/emsdk/emsdk_env.sh

emcmake cmake \
	-S vendor/libfoo \
	-B vendor/libfoo/build \
	-DCMAKE_BUILD_TYPE=Release \
	-DCMAKE_INSTALL_PREFIX="$PWD/vendor/libfoo/install" \
	-DBUILD_SHARED_LIBS=OFF

emmake cmake --build vendor/libfoo/build --target install

npx @php-wasm/compile-extension \
	--source . \
	--name my_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

## Makefile dependencies

Force Makefile dependencies to use Emscripten tools:

```bash
source /root/emsdk/emsdk_env.sh

emmake make -C vendor/libfoo \
	CC=emcc \
	CXX=em++ \
	AR=emar \
	RANLIB=emranlib \
	PREFIX="$PWD/vendor/libfoo/install" \
	install

npx @php-wasm/compile-extension \
	--source . \
	--name my_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

The final PHP extension still needs a `phpize` build recipe. If the extension
itself is CMake-only or Makefile-only, add a thin `config.m4` wrapper that
builds the PHP extension and treats the CMake or Make output as dependency
code.

## Rust build systems

The helper image includes a host `php` CLI because `ext-php-rs` and similar
build systems often shell out to `php` for version detection. The host CLI is
only for build scripts. The compiled extension must still link against the
PHP.wasm headers and side-module ABI.

Rust extensions that use `bindgen` need the same target, sysroot, and Zend
defines as PHP.wasm. The helper exports `BINDGEN_EXTRA_CLANG_ARGS` with:

```bash
--target=wasm32-unknown-emscripten \
--sysroot=$EMSDK_SYSROOT \
-DZEND_ENABLE_ZVAL_LONG64 \
-D__x86_64__
```

If you build the Rust archive outside the helper container, set the same value
before running `cargo`.

Rust `cc-rs` build scripts also need position-independent objects for side
module linking. The helper exports target-specific compiler variables including
`CFLAGS_wasm32_unknown_emscripten=-fPIC` and
`CXXFLAGS_wasm32_unknown_emscripten=-fPIC`. Without `-fPIC`, the final link can
fail with an error like:

```text
R_WASM_MEMORY_ADDR_SLEB cannot be used against symbol ...; recompile with -fPIC
```

Rust's precompiled `std` for `wasm32-unknown-emscripten` is built with
unwinding support. That imports a `__cpp_exception` WebAssembly tag that
PHP.wasm does not export. Build Rust static libraries with `panic=abort` and a
nightly rebuilt standard library:

```bash
RUSTFLAGS="-C panic=abort" cargo +nightly build \
	--release \
	--target wasm32-unknown-emscripten \
	-Zbuild-std=std,panic_abort
```

Link the resulting `lib*.a` with `--extra-ldflags`.

## Troubleshooting

`configure: error: ... not found`

The dependency headers or libraries are not visible inside the container. Use
paths under `/build` for files copied from `--source`, or
`/php-wasm-compile/<dependency>/<mode>/dist/root/lib` for Playground-built
dependencies.

`undefined symbol` when loading the extension

The extension references a function that is not exported by the PHP main module
or was not linked from a WebAssembly dependency archive. Add the dependency
archive to `--extra-ldflags`, or rebuild the main PHP.wasm runtime if the
symbol must come from PHP core.

`WebAssembly.LinkError` or startup crashes

Check that the extension loads in a JSPI runtime. The custom extension helper
does not build Asyncify artifacts.

`wasm-ld: unknown file type` or `file not recognized`

One of the linked libraries is a native host library. Rebuild that dependency
with Emscripten and link the resulting `.a` file.

`R_WASM_MEMORY_ADDR_SLEB cannot be used against symbol`

A C or C++ object in a static archive was not compiled as position-independent
code. Rebuild it with `-fPIC`, or make sure Rust `cc-rs` sees
`CFLAGS_wasm32_unknown_emscripten=-fPIC`.

`__cpp_exception` is undefined when loading a Rust extension

The Rust archive was built against an unwinding `std`. Rebuild it with
`RUSTFLAGS="-C panic=abort"` and
`cargo +nightly build -Zbuild-std=std,panic_abort`.

`bad export type for 'stdin'` or another C runtime global

The side module pulled in a dependency object that expects a mutable C runtime
global the main PHP.wasm module does not export. Rebuild the dependency with
the unused feature disabled, link a smaller archive that excludes that object,
or move the dependency into the main PHP.wasm build so the global is provided
by the runtime.

`phpize` cannot find headers

The helper image builds and installs a minimal matching PHP source tree before
running `phpize`. If an extension includes headers from optional PHP
extensions, copy or generate those headers in the Docker layer or include them
in the extension source.
