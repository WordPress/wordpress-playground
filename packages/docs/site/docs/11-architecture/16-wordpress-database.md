---
title: How does it work?
---

## Database is supported via MySQL<->SQLite translation layer

WordPress requires MySQL. However, there isn't a WebAssembly version of MySQL you could run in the browser. WordPress Playground therefore ships PHP with the [native SQLite driver](https://www.php.net/manual/en/ref.pdo-sqlite.php) and leans on SQLite.

But how can WordPress run on a different database?

Behind the scenes, the official [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) plugin intercepts all MySQL queries and rewrites them in SQLite dialect. The 2.0 release ships [a new WordPress Playground-informed translation layer](https://github.com/WordPress/sqlite-database-integration/pull/9) that allows WordPress on SQLite to pass 99% of the WordPress unit test suite.
