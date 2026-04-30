# wp_mysql_parser PHP.wasm extension

This directory contains PHP.wasm side-module artifacts for the
`wp_mysql_parser` Rust extension used by the SQLite Database Integration PR
#388 stack.

Expected layout:

```text
manifest.json
wp_mysql_parser-php8.4-asyncify.so
wp_mysql_parser-php8.4-jspi.so
```

The manifest uses the runtime extension manifest shape consumed by
`loadNodeRuntime()` / `loadWebRuntime()`:

```json
{
	"name": "wp_mysql_parser",
	"version": "pr388",
	"mode": "php-extension",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"asyncMode": "jspi",
			"file": "wp_mysql_parser-php8.4-jspi.so"
		}
	]
}
```

The PHP 8.4 asyncify artifact is covered by
`php-wasm-node:test-wp-mysql-parser-extension-asyncify`. The CI test loads the
manifest, boots the PR388 SQLite driver bundle, and compares the PHP lexer with
the native lexer over 5000 long SQL queries. The JSPI artifact is exercised by
the matching JSPI target on Node 24.
