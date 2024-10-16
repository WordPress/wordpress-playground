---
slug: /developers/architecture/wasm-php-compiling
---

# Compiling PHP

The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)

In broad strokes, that `Dockerfile`:

-   Installs all the necessary linux packages (like `build-essential`)
-   Downloads PHP and the required libraries, e.g. `sqlite3`.
-   Applies a few patches.
-   Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
-   Compiles `php_wasm.c` – a convenient API for JavaScript.
-   Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
-   Transforms the Emscripten's default `php.js` output into an ESM module with additional features.

To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile).

### Building

To build all PHP versions, run `nx recompile-php:all php-wasm-web` (or `php-wasm-node`) in the repository root. You'll find the output files in `packages/php-wasm/php-web/public`. To build a specific version, run `nx recompile-php:all php-wasm-node --PHP_VERSION=8.0 --WITH_JSPI=yes` (and repeat with `--WITH_JSPI=no`).

### PHP extensions

PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile).

Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded.

If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.

### C API exposed to JavaScript

The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are:

-   `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
-   `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
-   `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another.

Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more.

### Build configuration

The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message:

```sh
nx recompile-php php-wasm-web
```

**Supported build options:**

-   `PHP_VERSION` – The PHP version to build, default: `8.0.24`. This value must point to an existing branch of the <https://github.com/php/php-src.git> repository when prefixed with `PHP-`. For example, `7.4.0` is valid because the branch `PHP-7.4.0` exists, but just `7` is invalid because there's no branch `PHP-7`. The PHP versions that are known to work are `7.4.*` and `8.0.*`. Others likely work as well but they haven't been tried.
-   `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
-   `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
-   `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
-   `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.
