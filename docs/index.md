<!--meta-description
WordPress.wasm is a client-side WordPress that runs without a PHP server thanks to the magic of WebAssembly.
-->

# Introduction

- [What is WordPress.wasm?](#what-is-wordpress-wasm?)
- [Getting started](#getting-started)
- [Hello world](#hello-world)

---

### What is WordPress.wasm?

WordPress.wasm is a client-side WordPress that runs without a PHP server thanks to the magic of WebAssembly.

See the [live demo](https://wasm.wordpress.net/wordpress-browser.html).

WordPress.wasm can power:

* Runeditable code examples in your documentation or course
* Plugin and theme demos in a private WordPress instance where the user is already logged in as admin
* Easily switching PHP and WordPress version when testing
* Replaying and fixing the failed CI tests right in the browser

Intrigued? See [the full announcement post on make.wordpress.org](https://make.wordpress.org/core/2022/09/23/client-side-webassembly-wordpress-with-no-server/).

WordPress.wasm provides a strong foundation for the above use-cases but does not implement them just yet. This project is still in its early days and needs contributors. Become a contributor today and help us make these tools a reality!

---

### Getting started

The best way to play with WordPress.wasm is to clone and modify this repository. Seriously. There is no npm package or an easy-to-use public API just yet. We'll get there soon.

Run the following commands to get started:

```js
git clone https://github.com/WordPress/wordpress-wasm
cd wordpress-wasm
npm install
npm run dev
```

A browser should open and take you to your very own client-side WordPress at http://127.0.0.1:8777/wordpress-browser.html! 

From here you can start playing with the code – [src/web/](https://github.com/WordPress/wordpress-wasm/tree/trunk/src) is a good place to start.

## Repository structure

WordPress.wasm consists of:

* PHP to WASM compilation pipeline
* WordPress bundler
* A JavaScript library to run WordPress in the browser
* A JavaScript library to run WordPress in Node.js

### PHP to WASM compilation pipeline

WordPress cannot run without PHP, so this repo embeds a set of scripts to compile PHP to a `.wasm` file. You'll find them in `wasm-build/php`. 

#### Running the build scripts

PHP builds can be conveniently triggered using npm scripts:

* `npm run build:php:web` compiles PHP to a web-optimized `.wasm` binary
* `npm run build:php:node` compiles PHP to a node.js-optimized `.wasm` binary

The `.wasm` binaries are standalone. The web version doesn't require the node.js binary and vice versa.

Here's what the build scripts do:

1. Build the docker image
2. Build the php.wasm binary
3. Copy php.wasm to a target directory

#### Building the docker image

`Dockerfile` is the heart of the reproducible build recipe. It prepares all the pre-requisites for building the final `php.wasm` file:
 
* Installs the required software packages
* Retrieves the source code of sqlite3 and PHP
* Applies the required patches found in the `docker-build-files` dir
* Compiles PHP using [emscripten](https://emscripten.org/)
* Compiles a lightweight `pib_eval.c` API for easily running PHP from JavaScript

`Dockerfile` can also be configured using the `--build-arg` feature:

```bash
docker build . 
  --build-arg PHP_VERSION=$PHP_VERSION \ # e.g. 8.0.24
  --build-arg WITH_LIBXML="no"           # yes or no
```

Once the docker image is built, we're ready to build the final `php.wasm` file.

#### Building the php.wasm binary

The relevant php.wasm libraries are bundled with emscripten using a target-specific configuration.
For example, the web version is built using a command similar to this one:  

```bash
docker run \
        -v `pwd`/preload:/preload \
        -v `pwd`/docker-output:/output \
        wasm-wordpress-php-builder:latest \
        emcc -Oz \
        -o /output/php-web.js \
        --llvm-lto 2                     \
        -s EXPORTED_FUNCTIONS='["_pib_init", "_pib_destroy", "_pib_run"]' \
        -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "UTF8ToString", "lengthBytesUTF8", "FS", "PROXYFS"]' \
        -s MAXIMUM_MEMORY=-1             \
        -s INITIAL_MEMORY=1024MB \
        -s ALLOW_MEMORY_GROWTH=1         \
        -s ASSERTIONS=0                  \
        -s ERROR_ON_UNDEFINED_SYMBOLS=0  \
        -s EXPORT_NAME="'PHP'"           \
        -s MODULARIZE=1                  \
        -s INVOKE_RUN=0                  \
        -s USE_ZLIB=1                    \
                /root/lib/pib_eval.o /root/lib/libphp7.a \
        --pre-js /preload/php-web-pre-script.js \
        -s ENVIRONMENT=web \
        -s FORCE_FILESYSTEM=1
```

TBD

#### Copy `php.wasm` to a target directory

### WordPress bundler

TBD

### A JavaScript library to run WordPress in the browser

TBD

### A JavaScript library to run WordPress in Node.js

TBD
