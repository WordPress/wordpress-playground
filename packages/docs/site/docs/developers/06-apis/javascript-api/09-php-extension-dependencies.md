---
title: PHP extension dependencies
slug: /developers/apis/javascript-api/php-extension-dependencies
description: Link WebAssembly dependencies when building custom PHP.wasm extensions.
---

# PHP extension dependencies

Custom PHP.wasm extensions can only link WebAssembly code built with the same
Emscripten toolchain and async mode as the PHP runtime. Native host libraries
from `/usr/lib`, Homebrew, apt, or npm packages cannot be linked into the final
`.so`.

Build dependencies as static WebAssembly archives and pass their headers and
archives to `@php-wasm/compile-extension`.

## Playground-built dependencies

Some libraries already have recipes in `packages/php-wasm/compile`. Build the
matching async-mode target and pass the mounted path inside the helper
container:

```bash
make -C packages/php-wasm/compile libz_jspi

npx @php-wasm/compile-extension \
	--source ./zlib-probe \
	--name zlib_probe \
	--php-versions 8.4 \
	--async-modes jspi \
	--extra-cflags "-I/php-wasm-compile/libz/jspi/dist/root/lib/include" \
	--extra-ldflags "/php-wasm-compile/libz/jspi/dist/root/lib/lib/libz.a"
```

Use the `jspi` archive for JSPI builds and the `asyncify` archive for Asyncify
builds.

## Vendored dependencies

If the dependency is not built by Playground, vendor the source under your
extension directory and build it with Emscripten before the extension is linked.
Paths from `--source` are available under `/build` inside the helper container:

```bash
npx @php-wasm/compile-extension \
	--source ./external-lib-probe \
	--name external_lib_probe \
	--php-versions 8.4 \
	--async-modes asyncify \
	--extra-cflags "-I/build/vendor/string-score/install/include" \
	--extra-ldflags "/build/vendor/string-score/install/lib/libstring_score.a"
```

`--extra-cflags` is visible during `./configure`. `--extra-ldflags` is applied
to the final side-module link so dependency archives do not break Autoconf's
compiler smoke tests.

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
	--async-modes asyncify \
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
	--async-modes asyncify \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

The final PHP extension still needs a `phpize` build recipe. If the extension
itself is CMake-only or Makefile-only, add a thin `config.m4` wrapper that
builds the PHP extension and treats the CMake or Make output as dependency
code.

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

Check that the artifact async mode matches the runtime. Build JSPI artifacts
for JSPI runtimes and Asyncify artifacts for Asyncify runtimes.

`wasm-ld: unknown file type` or `file not recognized`

One of the linked libraries is a native host library. Rebuild that dependency
with Emscripten and link the resulting `.a` file.

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
