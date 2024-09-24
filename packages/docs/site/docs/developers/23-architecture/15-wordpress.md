---
slug: /developers/architecture/wordpress
---

# WordPress support

WordPress, as a PHP application, can run on PHP WebAssembly. However, there are a few caveats.

## SQLite

First, WordPress requires MySQL. However, there isn't a WebAssembly version of MySQL you could run in the browser. WordPress Playground, therefore, ships PHP with the [native SQLite driver](https://www.php.net/manual/en/ref.pdo-sqlite.php) and leans on SQLite.

But how can WordPress run on a different database?

Behind the scenes, the official [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) plugin intercepts all MySQL queries and rewrites them in SQLite dialect. The x.0 release ships [a new WordPress Playground-informed translation layer](https://github.com/WordPress/sqlite-database-integration/pull/9) that allows WordPress on SQLite to pass 99% of the WordPress unit test suite.

## WordPress in the browser

You can use any WordPress build in the browser. For convenience and to reduce the data transfer size, WordPress Playground ships a few [minified WordPress releases](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground/wordpress-builds) that you can use in the browser.

## WordPress in Node.js

In Node.js, you'll typically want to [mount WordPress](/developers/architecture/wasm-php-filesystem) from a disk directory.
