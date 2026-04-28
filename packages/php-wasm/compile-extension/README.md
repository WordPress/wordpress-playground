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
make -C packages/php-wasm/compile libxml2_jspi

npx @php-wasm/compile-extension \
	--source ./xml-probe \
	--name xml_probe \
	--php-versions 8.3 \
	--async-modes jspi \
	--extra-cflags "-I/php-wasm-compile/libxml2/jspi/dist/root/lib/include/libxml2 -I/php-wasm-compile/libz/jspi/dist/root/lib/include" \
	--extra-ldflags "/php-wasm-compile/libxml2/jspi/dist/root/lib/lib/libxml2.a /php-wasm-compile/libz/jspi/dist/root/lib/lib/libz.a"
```

For dependencies that are not in `packages/php-wasm/compile`, either:

- Vendor the dependency source under your extension and build it from
  `config.m4`, using paths under `/build` after the helper copies `/src`.
- Add a Docker layer that builds the dependency with Emscripten, then pass its
  include and archive paths through `--extra-cflags`, `--extra-ldflags`, and
  `--config-args`.

Keep the dependency async mode aligned with the extension. A `jspi` side module
must link `jspi` dependency archives; an `asyncify` side module must link
`asyncify` dependency archives.

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

`phpize` cannot find headers

The helper image builds and installs a minimal matching PHP source tree before
running `phpize`. If an extension includes headers from optional PHP extensions,
copy or generate those headers in the Docker layer or include them in the
extension source.
