# Third-party notices

The private `@wp-playground/cli-native` test package contains generated runtime
assets from these projects:

- PHP, distributed under the PHP License 3.01. The reproducible WASIp2 build
  inputs are in `packages/php-wasm/compile/php-wasi`.
- SQLite Database Integration for WordPress, distributed under GPL-2.0-or-later.

The separately built `wp-playground-native` test host embeds Wasmtime, which is
distributed under Apache-2.0 with the LLVM exception. The host is not included
in the npm tarball and is not published by this project.

The repository source and build definitions are the corresponding-source
location for these private verification artifacts.
