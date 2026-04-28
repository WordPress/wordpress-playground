# wp_mysql_parser PHP.wasm extension

This directory contains PHP.wasm side-module artifacts for the PR #388
`wp_mysql_parser` Rust extension.

Expected layout:

```text
manifest.json
wp_mysql_parser-php8.4-asyncify.so
wp_mysql_parser-php8.4-jspi.so
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

The PHP 8.4 asyncify artifact was smoke-tested locally with
`extension_loaded('wp_mysql_parser')` and native lexer/parser class existence
checks. The JSPI artifact is built with the same ABI flags plus JSPI side-module
flags; local JSPI execution requires a Node runtime with `WebAssembly.Suspending`.
