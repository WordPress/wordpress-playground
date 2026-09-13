---
slug: /developers/architecture/wasm-php-compiling
---

# Compiling PHP

The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)

In broad strokes, that `Dockerfile`:

- Installs all the necessary linux packages (like `build-essential`)
- Downloads PHP and the required libraries, e.g. `sqlite3`.
- Applies a few patches.
- Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
- Compiles `php_wasm.c` – a convenient API for JavaScript.
- Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
- Transforms the Emscripten's default `php.js` output into an ESM module with additional features.

To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

## Building

With Docker running and the repository dependencies installed, run these commands from the repository root:

```sh
# Build all supported PHP versions for the web, in both JSPI and Asyncify modes.
npx nx recompile-php:all php-wasm-web

# Build only PHP 8.4 for the web, in JSPI mode.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```

Replace `php-wasm-web` with `php-wasm-node` to build for Node.js, or `recompile-php:jspi` with `recompile-php:asyncify` to build the Asyncify variant. The output goes to `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` or `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.

## Debug builds

Use `--WITH_DEBUG=yes` to build PHP.wasm with readable JavaScript output and DWARF debug information for stepping through C code in a WebAssembly debugger:

```sh
# Build PHP 8.4 for debugging in the browser.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Build PHP 8.4 for debugging in Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```

The same option works with `recompile-php:asyncify`. Debug builds produce larger files and run more slowly than optimized builds. They replace the selected version's artifacts in the output directory described above. Rebuild with `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` to restore an optimized build.

For WebAssembly source maps, use `--WITH_SOURCEMAPS=yes`:

```sh
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_SOURCEMAPS=yes
```

This generates a `php.wasm.map` file and copies the source files needed for debugging into the build output. For web builds, the source map URL points to the local development server at `http://127.0.0.1:5400`; run `npm run dev` to serve it.

### Emscripten options

The build script translates these options into compiler flags in the [PHP Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):

| Flag           | Purpose                                                                                                | When Playground uses it                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `-O0`          | Disables optimization of the final WebAssembly and JavaScript output.                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`, replacing the default `-O3`. |
| `-g2`          | Keeps function names and readable JavaScript, without retaining DWARF information in the final module. | Node.js builds when neither debug option is enabled.                    |
| `-g3`          | Retains DWARF information for source-level debugging.                                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`.                              |
| `-gsource-map` | Generates a WebAssembly source map from compiler debug information.                                    | `WITH_SOURCEMAPS=yes`.                                                  |

See the [Emscripten compiler reference](https://emscripten.org/docs/tools_reference/emcc.html) for details on these flags.

### Runtime assertions

Debug information and runtime assertions are separate settings. Playground explicitly passes `-s ASSERTIONS=0`, including in debug builds, so `--WITH_DEBUG=yes` does not enable extra runtime checks.

To investigate a runtime failure with assertions, change that setting in the PHP Dockerfile's final `emcc` command and rebuild. Emscripten documents `-s ASSERTIONS=1` for runtime checks and `-s ASSERTIONS=2` for additional, slower checks. There is no `WITH_ASSERTIONS` build option. See the [Emscripten assertions reference](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).

## PHP next builds

Playground can also run the next PHP version from the php-src development branch in the web runtime. These builds are published separately from the main repository because the generated WebAssembly files are large and change often.

The nightly refresh workflow builds the php-src development branch, writes the web artifacts to the gitignored `packages/playground/website/public/php-next/` directory, and publishes the result to the `php-next-builds` branch. Website deploys and the local dev server sync that branch before serving `?php=next`.

To refresh the local copy manually, run:

```sh
npm run sync:php-next
```

To rebuild the web artifacts locally from the php-src development branch, run:

```sh
npm run recompile:php:web:next
```

`php=next` currently ships web main modules only. Matching extension side modules and Playground CLI support are separate follow-up work.

## PHP extensions

PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded.

If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.

PHP.wasm can also load dynamic `.so` extensions before PHP starts. Built-in
dynamic extensions such as `intl`, `xdebug`, `redis`, and `memcached` are
distributed with the Node package, and external extensions can be supplied with
a manifest that selects the artifact matching the active PHP version and async
mode. See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for the runtime API.

## C API exposed to JavaScript

The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are:

- `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
- `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
- `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another.

Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more.

## Build configuration

The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message:

```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```

**Selected build options:**

This list highlights debug and basic build settings. For the full set of options, run the help command above; see [the build script](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/build.js) for platform-specific defaults.

- `WITH_DEBUG` – `yes` or `no`. Build with DWARF debug information and disable final optimization. See [Debug builds](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` or `no`. Generate WebAssembly source maps and disable final optimization. See [Debug builds](#debug-builds).
- `PHP_VERSION` – The PHP version to build. Use a major/minor version such as `8.4` to select its latest release from [the supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/supported-php-versions.mjs), or an exact release such as `8.4.25`. The build clones the corresponding `php-<version>` tag from php-src.
- `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
- `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
- `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
- `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.
