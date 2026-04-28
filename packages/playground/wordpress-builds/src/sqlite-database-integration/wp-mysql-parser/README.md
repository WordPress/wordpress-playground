# wp_mysql_parser PHP.wasm extension

Place the compiled PHP.wasm side-module artifacts for the PR #388
`wp_mysql_parser` Rust extension in this directory.

Expected layout:

```text
manifest.json
wp_mysql_parser-php8.0-asyncify.so
wp_mysql_parser-php8.0-jspi.so
wp_mysql_parser-php8.1-asyncify.so
wp_mysql_parser-php8.1-jspi.so
...
```

The manifest must use the `@php-wasm/compile-extension` manifest format:

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
