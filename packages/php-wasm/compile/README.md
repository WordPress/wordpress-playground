# php-wasm compile

This package contains the scripts to compile PHP and its dependencies to WebAssembly.

## Libraries

This package ships pre-built WebAssembly libraries required by PHP. The libraries are built using the [Emscripten](https://emscripten.org/) compiler.

To remove the pre-built libraries, run `make clean`.

To rebuild the pre-built libraries, run `make all`.

## PHP

To build PHP, run `node build.js` and pass at least the following arguments:

```bash
node build.js --PHP_VERSION=7.4 --output-dir=php-build --PLATFORM=node
```
