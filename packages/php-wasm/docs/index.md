# php-wasm: Use PHP in JavaScript

This package enables running PHP in Javascript. Here's how:

```js
import { createPHP } from 'php-wasm';

const PHPLoaderModule = await import('/php.js');
const php = await createPHP(PHPLoaderModule);
console.log(
    php.run(`<?php echo "Hello from PHP!";`).stdout
);
// Output: "Hello from PHP!"
```

`php-wasm` consists of:

* PHP to WebAssembly build pipeline 
* JavaScript bindings for the WebAssembly PHP
* PHP server implementation in JavaScript

## PHP to WebAssembly build pipeline

The pipeline lives in [`wasm/Dockerfile`](https://github.com/WordPress/wordpress-wasm/blob/trunk/packages/php-wasm/wasm/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)

In broad strokes, that `Dockerfile`:

* Installs all the necessary linux packages (like `build-essential`)
* Downloads PHP and the required libraries, e.g. `sqlite3`.
* Applies a few patches.
* Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
* Compiles `php_wasm.c` – a convenient API for JavaScript.
* Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
* Transforms the Emscripten's default `php.js` output into an ESM module with additional features.

To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-wasm/blob/trunk/packages/php-wasm/wasm/Dockerfile).

### PHP extensions

PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-wasm/blob/trunk/packages/php-wasm/wasm/Dockerfile).

Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded. 

If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.

### WASM API exposed to JavaScript

The API exposed to JavaScript lives in the [`wasm/build-assets/php_wasm.c`](https://github.com/WordPress/wordpress-wasm/blob/trunk/packages/php-wasm/wasm/build-assets/php_wasm.c) file. It isn't very well documented yet so you'll need to consult that file directly to learn more.

<!-- TODO document it there and include the reference here -->

### Configuration options

The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). For example, to change the PHP version, specify the `PHP_VERSION` option during the build:

```sh
docker build . --build-arg PHP_VERSION=7.4.0
```

**Supported options:**

* `PHP_VERSION` – The PHP version to build, default: `8.0.24`. This value must point to an existing branch of the https://github.com/php/php-src.git repository when prefixed with `PHP-`. For example, `7.4.0` is valid because the branch `PHP-7.4.0` exists, but just `7` is invalid because there's no branch `PHP-7`. The PHP versions that are known to work are `7.4.*` and `8.0.*`. Others likely work as well but they haven't been tried.
* `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
* `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
* `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
* `WITH_VRZNO` – `yes` or `no`, default: `yes` when PHP_VERSION is 7.*. Whether to build with [the `vrzno` PHP extension](https://github.com/seanmorris/vrzno/fork) that enables running JavaScript code from PHP.
* `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.


## JavaScript bindings

All the JavaScript code live in the `src` subdirectory.

To build the JavaScript module, run `npm run build:js` in the repo root.

A low-level PHP JavaScript class with eval for executing PHP code and FS utils like writeFile for runtime managing the

### Running the PHP code


**Capturing the output**

`run()` returns
```js
{
      exitCode,
      stdout: this.stdout.join("\n"),
      stderr: this.stderr,
}
```

### Managing the filesystem

### Uploading files

## PHP server implementation in JavaScript

A PHPServer JavaScript class for dispatching HTTP requests – both to run the PHP files AND to download static files
A PHPBrowser JavaScript class to consume the above using an iframe


```js
import { createPHP, PHPServer } from 'php-wasm';

const PHPLoaderModule = await import('/php.js');
const php = await createPHP(PHPLoaderModule);

// Create a file to serve
php.mkdirTree('/www');
php.writeFile('/www/index.php', '<?php echo "Hi from PHP!"; ');

// Create a server:
const server = new PHPServer(php, {
    documentRoot: '/www',
    // This is to populate $_SERVER['SERVER_NAME'] etc.
    // PHPServer does not actually bind to any address or port –
    // it only provides an HTTP request handler.
    absoluteUrl: 'http://127.0.0.1'
});

console.log(
   server.request({ path: '/index.php' }).body
);
// Output: "Hi from PHP!"
```

Which downloads the assembly file, creates a virtual heap, and exposes named native functions conveniently wrapped to accept and return JavaScript data types.
