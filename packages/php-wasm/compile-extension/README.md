# @php-wasm/compile-extension

Builds a PHP extension source directory into PHP.wasm side modules for a PHP
version and async-mode matrix.

```bash
npx @php-wasm/compile-extension \
	--source ./ext-src \
	--name wp_mysql_parser \
	--php-versions 8.1,8.2,8.3,8.4 \
	--async-modes jspi,asyncify \
	--out ./dist
```

The command writes one `.so` per matrix entry and a `manifest.json` that can be
consumed by PHP.wasm extension-loading helpers.

Docker is required. The build reuses the `packages/php-wasm/compile` base image
and its PHP patch set, then runs `phpize`, `emconfigure`, and `emmake` inside
the container.

## Languages

The CLI auto-detects the source language:

- A `Cargo.toml` next to the source ⇒ **Rust** (built via `cargo build
  --target=wasm32-unknown-emscripten`, see [Rust extensions](#rust-extensions)).
- A `config.m4` next to the source ⇒ **C** (built via `phpize` + `emconfigure`).

Override with `--language=rust|c` if the auto-detect picks the wrong one.

## Rust extensions

Pass a Rust crate that uses [`ext-php-rs`](https://crates.io/crates/ext-php-rs)
with `crate-type = ["cdylib"]`:

```toml
[package]
name = "wp_mysql_parser"
version = "0.1.0"
edition = "2021"

[lib]
name = "wp_mysql_parser"
crate-type = ["cdylib"]

[dependencies]
ext-php-rs = "0.12"
```

Then run the helper exactly as for a C extension:

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--php-versions 8.4 \
	--async-modes jspi
```

Under the hood, the helper layers a Rust toolchain onto the base PHP-cross
image (`Dockerfile.rust-ext`), adds the `wasm32-unknown-emscripten` target,
and runs `cargo build --release` with `-C link-arg=-sSIDE_MODULE=1` plus the
matching JSPI/Asyncify flags. `bindgen` (driven by `ext-php-rs`'s `build.rs`)
runs on the host CPU against the cross-compiled PHP headers staged at
`/usr/local/include/php`.

PHP 8.0+ is required for Rust extensions because `ext-php-rs` does not target
the PHP 7 ABI.

## Loading the result

Host the entire output directory somewhere static and pass the manifest URL to
the runtime:

```ts
import { loadExtension } from '@php-wasm/universal';

await loadExtension(php, {
	manifestUrl: 'https://example.com/wp_mysql_parser/manifest.json',
});
```

The loader chooses the artifact whose `phpVersion` and `asyncMode` match the
running PHP.wasm runtime, downloads it, verifies `sha256` when present, stages
the `.so`, and installs a preload script that calls PHP's `dl()` before user
code runs. It also writes an `.ini` file and registers the extension scan
directory so the artifact follows the same layout as bundled Playground
extensions.

Call `loadExtension()` before the first `php.run()` or request so the helper can
enable dynamic loading before PHP startup.

## Dependencies

The helper can only link WebAssembly objects built with the same Emscripten
toolchain and async mode as the PHP runtime. Native host libraries from
`/usr/lib`, Homebrew, apt, or npm packages cannot be linked into the `.so`.

For dependencies already built by Playground, build the matching target and pass
the mounted path under `/php-wasm-compile`:

```bash
make -C packages/php-wasm/compile libz_jspi

npx @php-wasm/compile-extension \
	--source ./zlib-probe \
	--name zlib_probe \
	--php-versions 8.3 \
	--async-modes jspi \
	--extra-cflags "-I/php-wasm-compile/libz/jspi/dist/root/lib/include" \
	--extra-ldflags "/php-wasm-compile/libz/jspi/dist/root/lib/lib/libz.a"
```

For dependencies that are not in `packages/php-wasm/compile`, either:

- Vendor the dependency source under your extension and build it from
  `config.m4`, using paths under `/build` after the helper copies `/src`.
- Build the dependency with Emscripten before running the helper, place the
  resulting headers and `.a` archive under the extension source directory, and
  pass `/build/...` paths through `--extra-cflags` and `--extra-ldflags`.
- Add a Docker layer that builds the dependency with Emscripten, then pass the
  resulting include and archive paths through `--extra-cflags`,
  `--extra-ldflags`, and `--config-args`.

For example, if an extension vendors an external library that is not provided by
Playground and stores its Emscripten build output under
`vendor/string-score/install`, pass the copied `/build` paths:

```bash
npx @php-wasm/compile-extension \
	--source ./external-lib-probe \
	--name external_lib_probe \
	--php-versions 8.3 \
	--async-modes asyncify \
	--extra-cflags "-I/build/vendor/string-score/install/include" \
	--extra-ldflags "/build/vendor/string-score/install/lib/libstring_score.a"
```

If the dependency uses CMake, build it as a static archive with Emscripten and
store the install tree under the extension source directory:

```bash
# Run this inside the same Emscripten toolchain used for the target PHP.wasm
# version and async mode.
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
	--php-versions 8.3 \
	--async-modes asyncify \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

For plain Makefile dependencies, force the Makefile to use Emscripten tools and
link the resulting archive the same way:

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
	--php-versions 8.3 \
	--async-modes asyncify \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

The final PHP extension still needs to be a `phpize` extension with `config.m4`.
If an extension is CMake-only or Makefile-only and produces the final `.so`
without `phpize`, add a thin `config.m4` wrapper that builds the PHP extension
and treats the CMake/Make output as dependency code. A fully custom final build
script is outside v1.

Keep the dependency async mode aligned with the extension. A `jspi` side module
must link `jspi` dependency archives; an `asyncify` side module must link
`asyncify` dependency archives.

`--extra-cflags` is visible during `./configure`. `--extra-ldflags` is applied
to the final side-module link so dependency archives do not break Autoconf's
compiler smoke tests. If an extension's `config.m4` insists on link-probing a
dependency, pass explicit `--config-args` to select the known dependency path or
patch the extension's build recipe to use the WebAssembly archive directly.
Static `.a` archives passed via `--extra-ldflags` are force-linked with
`--whole-archive` so the side module contains the dependency code it needs.

## Troubleshooting

`Could not detect the extension name`

Pass `--name` explicitly, or make sure `config.m4` contains `PHP_ARG_ENABLE`,
`PHP_ARG_WITH`, or `PHP_NEW_EXTENSION` for the extension.

`configure: error: ... not found`

The dependency headers or libraries are not visible inside the container. Use
paths under `/build` for files copied from `--source`, or
`/php-wasm-compile/<dependency>/<mode>/dist/root/lib` for Playground-built
dependencies.

`undefined symbol` when loading the extension

The extension references a function that is not exported by the PHP main module
or was not linked from a WebAssembly dependency archive. Add the dependency
archive to `--extra-ldflags`, or rebuild the main PHP.wasm runtime if the symbol
must come from PHP core.

`WebAssembly.LinkError` or startup crashes

Check that the artifact async mode matches the runtime. Build `jspi` artifacts
for JSPI runtimes and `asyncify` artifacts for Asyncify runtimes.

`wasm-ld: unknown file type` or `file not recognized`

One of the linked libraries is a native host library. Rebuild that dependency
with Emscripten and link the resulting `.a` file.

`bad export type for 'stdin'` or another C runtime global

The side module pulled in a dependency object that expects a mutable C runtime
global the main PHP.wasm module does not export. Rebuild the dependency with the
unused feature disabled, link a smaller archive that excludes that object, or
move the dependency into the main PHP.wasm build so the global is provided by
the runtime.

`phpize` cannot find headers

The helper image builds and installs a minimal matching PHP source tree before
running `phpize`. If an extension includes headers from optional PHP extensions,
copy or generate those headers in the Docker layer or include them in the
extension source.
