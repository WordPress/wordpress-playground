# @php-wasm/compile-extension

Builds a PHP extension source directory into PHP.wasm JSPI side modules for a
PHP version matrix.

```bash
npx @php-wasm/compile-extension \
	--source ./ext-src \
	--name wp_mysql_parser \
	--php-versions 8.4 \
	--out ./dist
```

The command writes one JSPI `.so` per PHP version and a `manifest.json` that
can be consumed by PHP.wasm extension-loading helpers. The manifest matches
the `PHPExtensionManifest` shape from `@php-wasm/universal`:

```json
{
	"name": "wp_mysql_parser",
	"version": "0.1.0",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "wp_mysql_parser-php8.4-jspi.so"
		}
	]
}
```

To stage sidecar files (data directories, web UI assets, ICU data, etc.) under
an absolute VFS prefix, pass `--extra-files <hostDir>:<vfsRoot>`. The host
directory is copied next to the manifest and recorded under `extraFiles.nodes`:

```bash
npx @php-wasm/compile-extension \
	--source ./spx-src \
	--name spx \
	--php-versions 8.2 \
	--extra-files ./web-ui:/internal/shared/spx \
	--out ./dist
```

Empty directories are recorded as `type: "directory"` nodes so the loader
creates them before PHP starts.

The supported `--php-versions` are `7.4` and `8.0` through `8.5`.

Docker is required. The CLI lazily fetches the small PHP.wasm Docker asset set
needed to prepare the Emscripten base image and all `compile/php/php*.patch`
files, then runs `phpize`, `emconfigure`, and `emmake` inside the container.

## Running in CI

The package only needs Docker and Node. It does not require a checkout of
`WordPress/wordpress-playground`. A typical GitHub Actions job:

```yaml
- uses: actions/checkout@v4

- uses: actions/setup-node@v4
  with:
    node-version: '24'

- run: |
    npx --yes @php-wasm/compile-extension \
      --source ./my-extension \
      --name my_extension \
      --php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
      --out ./dist/my-extension
```

In a matrix workflow, set `strategy.max-parallel: 1` on the WASM job —
parallel Docker builds on hosted runners often hit apt-mirror flakes during
the base image build.

On first use, a published `@php-wasm/compile-extension` package fetches Docker
assets from the matching `WordPress/wordpress-playground` tag, such as
`v3.1.27` for package version `3.1.27`. When running from a Playground
workspace, it uses local workspace assets when available and otherwise fetches
from `trunk`. Fetched assets are cached under
`~/.cache/php-wasm/compile-extension/docker-assets`, or under
`PHP_WASM_COMPILE_EXTENSION_CACHE_DIR` when that environment variable is set.

## Preparing the build image

Advanced workflows may need to run another build step inside the same
Emscripten/PHP image before compiling the final phpize extension. For example,
a Rust extension can build a `wasm32-unknown-emscripten` `staticlib` first and
then pass that archive through `--extra-ldflags`.

Use `--prepare-image` to build the package-owned Docker image and exit without
compiling an extension source directory:

```bash
npx @php-wasm/compile-extension \
	--prepare-image \
	--php-versions 8.4 \
	--jobs 1
```

For PHP `8.4`, the prepared image tag is
`playground-php-wasm:compile-extension-php8-4-jspi`.

## Loading the result

Host the entire output directory somewhere static and pass the manifest URL to
the runtime through the startup-time `extensions` option:

```ts
import { loadNodeRuntime } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://example.com/wp_mysql_parser/manifest.json',
				},
			},
		],
	})
);
```

The loader chooses the artifact whose `phpVersion` matches the running
PHP.wasm runtime, downloads it, stages the `.so`, writes a startup `.ini`
file, copies any `extraFiles` declared in the manifest, and registers the
extension scan directory before PHP starts.

In Node.js, `manifestUrl` may also be a local path:

```ts
const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: './dist/wp_mysql_parser/manifest.json',
				},
			},
		],
	})
);
```

Pass a direct `.so` URL when the caller chooses the artifact instead of a
manifest:

```ts
const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: [
			{
				name: 'wp_mysql_parser',
				source: {
					format: 'url',
					url: 'https://example.com/extensions/wp_mysql_parser-php8.4-jspi.so',
				},
			},
		],
	})
);
```

Use `loadWithIniDirective: 'zend_extension'` for Zend extensions such as
Xdebug. Use `extraFiles` and `env` for sidecar files needed by the extension.

## Dependencies

The helper can only link WebAssembly objects built with the same Emscripten
toolchain and JSPI ABI as the PHP runtime. Native host libraries from
`/usr/lib`, Homebrew, apt, or npm packages cannot be linked into the `.so`.

The lazy-fetched asset set includes only the Docker files required for the PHP
extension build itself. It does not include prebuilt Playground dependency
archives such as `libz`, `libxml2`, or `libpng`.

For dependencies:

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
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/string-score/install/include" \
	--extra-ldflags "/build/vendor/string-score/install/lib/libstring_score.a"
```

Prebuilt static archives, including Rust `staticlib` archives, should also be
passed through `--extra-ldflags`. The helper detects `.a` entries and
force-links them into the final side module with `--whole-archive`:

```bash
npx @php-wasm/compile-extension \
	--source ./my-rust-extension \
	--name my_rust_extension \
	--php-versions 8.4 \
	--extra-ldflags "/build/target/wasm32-unknown-emscripten/release/libmy_rust_extension.a"
```

Do not use `PHP_ADD_LIBRARY_WITH_PATH` for sibling `.a` archives in
`config.m4`. PHP's libtool setup can look for a matching `.so`, fail to link
the archive into the side module, and still leave a build artifact behind. Use
`--extra-ldflags` for static archives instead.

If the dependency uses CMake, build it as a static archive with Emscripten and
store the install tree under the extension source directory:

```bash
# Run this inside the same Emscripten toolchain used for the target PHP.wasm
# version and JSPI ABI.
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
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

The final PHP extension still needs to be a `phpize` extension with `config.m4`.
If an extension is CMake-only or Makefile-only and produces the final `.so`
without `phpize`, add a thin `config.m4` wrapper that builds the PHP extension
and treats the CMake/Make output as dependency code. A fully custom final build
script is outside v1.

Rust extensions should wrap the Rust crate with a small `config.m4` and C shim
that defines the PHP module entry and calls exported Rust functions over C ABI.
The helper image includes a host `php` CLI for build scripts such as
`ext-php-rs`, exports `BINDGEN_EXTRA_CLANG_ARGS` for the PHP.wasm target and
sysroot, and sets `CFLAGS_wasm32_unknown_emscripten=-fPIC` for `cc-rs` build
scripts. Rust `staticlib` archives must still be built with `panic=abort` and a
nightly rebuilt standard library:

```bash
RUSTFLAGS="-C panic=abort" cargo +nightly build \
	--release \
	--target wasm32-unknown-emscripten \
	-Zbuild-std=std,panic_abort
```

Keep dependencies aligned with the custom extension target. Custom extensions
are JSPI-only, so link `jspi` dependency archives.

`ext-php-rs` `0.15` depends on PHP 8 Zend APIs and does not compile against
PHP `7.4` headers, so Rust extensions built on top of `ext-php-rs` `0.15`
should restrict `--php-versions` to `8.0` through `8.5`. The helper itself
still supports PHP `7.4` for non-Rust extensions and for Rust extensions that
bind Zend directly through `bindgen`.

`--extra-cflags` is visible during `./configure`. `--extra-ldflags` is applied
to the final side-module link so dependency archives do not break Autoconf's
compiler smoke tests. If an extension's `config.m4` insists on link-probing a
dependency, pass explicit `--config-args` to select the known dependency path or
patch the extension's build recipe to use the WebAssembly archive directly.
Static `.a` archives passed via `--extra-ldflags` are force-linked with
`--whole-archive` so the side module contains the dependency code it needs.

When developing inside the WordPress Playground monorepo, the CLI still prefers
the workspace Docker assets. In that monorepo-only workflow, dependency archives
built under `packages/php-wasm/compile` are mounted at `/php-wasm-compile`.
Package consumers should not need that path in CI.

## Troubleshooting

`Could not detect the extension name`

Pass `--name` explicitly, or make sure `config.m4` contains `PHP_ARG_ENABLE`,
`PHP_ARG_WITH`, or `PHP_NEW_EXTENSION` for the extension.

`configure: error: ... not found`

The dependency headers or libraries are not visible inside the container. Use
paths under `/build` for files copied from `--source`. The
`/php-wasm-compile/<dependency>/<mode>/dist/root/lib` paths are only available
when running inside a WordPress Playground monorepo checkout with those
dependency archives already built.

`undefined symbol` when loading the extension

The extension references a function that is not exported by the PHP main module
or was not linked from a WebAssembly dependency archive. Add the dependency
archive to `--extra-ldflags`, or rebuild the main PHP.wasm runtime if the symbol
must come from PHP core.

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
global the main PHP.wasm module does not export. Rebuild the dependency with the
unused feature disabled, link a smaller archive that excludes that object, or
move the dependency into the main PHP.wasm build so the global is provided by
the runtime.

`phpize` cannot find headers

The helper image builds and installs a minimal matching PHP source tree before
running `phpize`. If an extension includes headers from optional PHP extensions,
copy or generate those headers in the Docker layer or include them in the
extension source.
