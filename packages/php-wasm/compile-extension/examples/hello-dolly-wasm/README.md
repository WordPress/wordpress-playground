# Hello Dolly as a WASM WordPress plugin

This example mirrors the classic Hello Dolly plugin shape, but moves the
greeting provider into a PHP.wasm extension. WordPress still loads a normal PHP
bootstrap as an mu-plugin; that bootstrap registers WordPress hooks and calls a
PHP function exposed by the WASM extension.

## Files

- `extension/hello_dolly_wasm.c` defines the native PHP function
  `hello_dolly_wasm_get_lyric()`.
- `extension/config.m4` is the standard `phpize` extension build file.
- `bootstrap.php` contains the WordPress integration code.
- `wasm-wordpress-plugin.json` tells Playground how to load the extension and
  which WordPress hooks to register.

## Build

Docker is required because `@php-wasm/compile-extension` builds inside the same
Emscripten/PHP toolchain used by PHP.wasm.

From this directory:

```bash
npx @php-wasm/compile-extension \
	--source ./extension \
	--name hello_dolly_wasm \
	--php-versions 8.4 \
	--out ./dist
```

The command writes `./dist/manifest.json` and one `.so` artifact per requested
PHP version.

## Run in Playground CLI

```bash
npx @wp-playground/cli@latest server \
	--php=8.4 \
	--wasm-wordpress-plugin=./wasm-wordpress-plugin.json
```

The descriptor loads `./dist/manifest.json`, installs `bootstrap.php` as an
mu-plugin, and registers:

- `admin_notices` -> `hello_dolly_wasm_render`
- `admin_head` -> `hello_dolly_wasm_css`

Open `/wp-admin/` to see a random Hello Dolly-style greeting rendered by
WordPress, with the greeting text supplied by the WASM extension.
