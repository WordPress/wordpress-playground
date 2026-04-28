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
