# WordPress Playground Native CLI

This package contains the native CLI binary:

```bash
wp-playground-native start [options]
wp-playground-native server [options]
wp-playground-native run-blueprint [options] [blueprint.json]
wp-playground-native build-snapshot [options]
wp-playground-native php [options] <script.php>
```

The current implementation layer is a Node-free runtime for the core local
development flow:

- compatible parsing for the planned `start`, `server`, `run-blueprint`,
  `build-snapshot`, and `php` option surface;
- `start` normalization into `server` configuration;
- mount parsing and VFS path normalization;
- typed PHP constants via `--define`, `--define-bool`, and
  `--define-number`, including the Node CLI's default `WP_DEBUG*` constants;
- auto-mount detection for plugin, theme, `wp-content`, and full WordPress directories;
- persistent site path hashing compatible with the Node CLI convention;
- a checked-in PHP asset manifest with paths and SHA-256 checksums;
- PHP CLI execution through Wasmtime, including manually mounted VFS paths such
  as PHAR tools under `/tools`, and shared WordPress preparation/startup when
  WordPress installation is not explicitly skipped;
- PHP outbound HTTP(S) over native TCP sockets for loopback, IPv4, and IPv6
  hosts, with a bundled CA roots file exposed through php.ini;
- a native HTTP bridge for mounted PHP document roots, including PHP response
  body/header capture and a request worker pool;
- default `server`/`start` port fallback compatible with the Node CLI: an
  occupied implicit `9400` falls back to an ephemeral port, while explicit
  `--port` conflicts fail;
- bundled WordPress extraction, remote WordPress release/ZIP downloads, and
  install-before-serve according to the selected WordPress install mode;
- SQLite integration setup through the bundled SQLite Database Integration plugin;
- basic Blueprint-on-start source resolution for local/remote JSON and ZIP
  files, with these v1 steps: `setSiteOptions`, `activatePlugin`,
  `activateTheme`, `installPlugin`, `installTheme`, `importWxr`, legacy
  `importFile`, `importWordPressFiles`, `setSiteLanguage`, `runPHP`,
  `runPHPWithOptions`, `request`, `runWpInstallationWizard`, `writeFile`,
  `writeFiles`, `runSql`, `wp-cli`, `unzip`, `defineWpConfigConsts`,
  `defineSiteUrl`, `enableMultisite`, `updateUserMeta`, `resetData`, `mkdir`,
  `rm`, `rmdir`, `cp`, and `mv`;
- native Blueprint file operations against mounted VFS paths, including
  `writeFile` string data plus `literal`, `vfs`, `url`, WordPress.org, and
  bundled file resources, `zip` wrappers for supported file resources and
  literal/Git directory trees, and `writeFiles` literal directory trees plus
  `git:directory` resources;
- Blueprint `runSql` execution through WordPress and the bundled SQLite query
  stream parser, with SQL supplied by file resources;
- Blueprint `runPHPWithOptions` with `code` or mounted `scriptPath`, plus
  `relativeUri`, `protocol`, `method`, string headers/body/env, and `$_SERVER`
  entries;
- Blueprint `request` dispatch against the mounted WordPress tree with path or
  absolute URLs, string/Uint8Array bodies, string headers, multipart form object
  bodies, and 2xx/3xx status enforcement;
- Blueprint `importWxr` WXR content import, including automatic
  `wordpress-importer` plugin installation before the first import step and the
  deprecated `importFile` alias;
- Blueprint `importWordPressFiles`, including `pathInZip`, Playground export
  manifest handling, preserved Playground-specific `wp-content` paths, database
  carry-over rules, database upgrade, and scoped URL rewrite;
- Blueprint `setSiteLanguage`, including `WPLANG`, the WordPress option, the
  core language pack, and best-effort plugin/theme language packs;
- Blueprint `runWpInstallationWizard`, including the current v1 compatibility
  behavior where `adminPassword` also fills the submitted `user_name`;
- Blueprint `wp-cli` using `/tmp/wp-cli.phar` by default, auto-downloaded from
  Playground's compressed WP-CLI endpoint when missing, with string/array command
  parsing and legacy `wordpress/...` argument path rewriting;
- Blueprint `extraLibraries: ["wp-cli"]`, which stages the default WP-CLI PHAR
  during startup even when no `wp-cli` step is present;
- Blueprint `enableMultisite` using the native WP-CLI runner; as in WordPress
  core, the effective `--site-url` must not include a custom port;
- Blueprint `unzip` extraction from file resources or deprecated `zipPath`
  into mounted VFS paths;
- WordPress state startup steps for site options, user meta, and SQLite-backed
  content reset;
- Blueprint `defineWpConfigConsts` with `define-before-run` host constants and
  `rewrite-wp-config` mutations through WordPress' config transformer;
- URL, WordPress.org, bundled, `zip`-wrapped literal/Git directory, direct
  `git:directory`, and single-file PHP Blueprint plugin installs with
  `ifAlreadyInstalled`, `targetFolderName`, and default activation behavior;
- Blueprint `installTheme` supports `importStarterContent` through WordPress'
  Customizer starter-content flow;
- auto-mount startup activation for mounted plugins, themes, `wp-content`, and
  full WordPress directories;
- opt-in `--follow-symlinks` support for mounted host paths, including PHP
  filesystem access, static routing, native Blueprint file steps, and snapshot
  export, while keeping symlink escapes blocked by default;
- `--login` auto-login through the Playground internal mu-plugin and first
  request stale-cookie clearing;
- native PHP worker pools for `server`/`start` requests. The default worker
  count follows the Node CLI convention of `min(6, max(1, CPUs - 1))`, but
  creates only one PHP worker up front and lazily instantiates more workers
  when concurrent requests need them. `--workers=auto` uses
  `max(1, CPUs - 1)` without the default cap, and `--workers=<n>` uses the
  fixed positive integer eagerly unless `WP_PLAYGROUND_NATIVE_LAZY_WORKERS` is
  enabled. Native workers schedule an idle recycle after every 16 PHP
  requests by default to bound asyncify heap high-water RSS, and recycle
  immediately after requests that grow wasm linear memory past 90 MiB. Extra
  lazily spawned workers retire when their current request finishes, keeping
  only one warm worker after request bursts. Set
  `WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER`,
  `WP_PLAYGROUND_NATIVE_RECYCLE_WASM_MEMORY_MIB`, or
  `WP_PLAYGROUND_NATIVE_WORKER_RECYCLE_IDLE_MS` to override this for
  benchmarking; set `WP_PLAYGROUND_NATIVE_RECYCLE_WASM_MEMORY_MIB=0` to disable
  the memory threshold.
- OPcache policy selection through `--opcache=validate|revalidate|immutable|middle|low-memory|off`.
  `validate` is the default and preserves normal timestamp checks,
  `revalidate` checks timestamps at most once per minute, and `immutable`
  disables timestamp checks for warm-request benchmark runs or immutable code
  trees. `middle` and `low-memory` keep immutable timestamp behavior with
  progressively smaller OPcache heaps for memory benchmarking. The immutable
  profiles also enable host path/stat caching because live PHP file edits are
  already outside those profiles' freshness contract. `off` disables OPcache
  for diagnostics.
- native advisory file locks for host-backed files across PHP workers, covering
  `flock()` and byte-range `fcntl()` lock requests used by WordPress and
  SQLite.
- standalone `run-blueprint` execution through the same native WordPress boot
  and Blueprint v1 startup-step interpreter used by `server`/`start`, without
  opening a listener.
- standalone `build-snapshot` execution through the same native WordPress boot
  and Blueprint v1 startup-step interpreter, writing a ZIP of the visible
  `/wordpress` VFS tree to `--outfile` (default `wordpress.zip`).

The first PHP wasm compile may still take noticeable time on a cold machine.
The native host enables Wasmtime's filesystem cache under
`~/.wordpress-playground/wasmtime` and reuses compiled modules within each
process so subsequent CLI runs and server workers avoid recompiling the same
PHP wasm payload.

For a single-worker comparison against native PHP, use PHP 8.5 with
`--workers=1 --opcache=middle`; this keeps PHP wasm warm request latency closest
to native PHP while the shorter worker recycle delay returns idle RSS near the
native process after high-memory requests. Immediate post-burst RSS still
depends on PHP wasm linear-memory high water and needs PHP wasm asset rebuilds
for further reduction.

The native CLI is still pre-release. `git:directory` resources use GitHub/GitLab
archive downloads for the common no-metadata path; resources that request `.git`
metadata or use another HTTP(S) Git host require a `git` executable on `PATH`.
Browser-grade performance is still in progress.
The Node CLI compatibility contract for native v1 is tracked in
`compatibility.json`; parser tests validate representative supported and
intentionally unsupported rows.

Build and test with:

```bash
cargo build --manifest-path packages/playground/cli-native/Cargo.toml
cargo test --manifest-path packages/playground/cli-native/Cargo.toml
cargo clippy --manifest-path packages/playground/cli-native/Cargo.toml --all-targets -- -D warnings
cargo run --manifest-path packages/playground/cli-native/Cargo.toml --release --bin package-native-cli -- --smoke-php-version=8.3
```

Runtime assets are discovered without npm or Node.js. By default, the binary
looks for an asset root next to the executable, under
`share/wp-playground-native`, and finally in the source tree used to build this
package. Set `WP_PLAYGROUND_NATIVE_ASSET_ROOT` to override discovery.
Native PHP support starts at PHP 7.4 and currently covers PHP 7.4, 8.0, 8.1,
8.2, 8.3, 8.4, and 8.5.

An asset root may use the source-tree layout with
`packages/playground/cli-native/assets/php-assets.json`, a packaged layout with
`assets/php-assets.json`, or a flat `php-assets.json`. Manifest file paths are
resolved relative to that asset root, so release archives must include the PHP
wasm files, WordPress ZIPs, and SQLite integration ZIPs at the paths referenced
by the manifest and native asset loaders.

The native runtime dispatches PHP according to the runtime selected in the
packaged asset manifest. Runtime variants are artifact choices, not startup
flags: `--php-version` can choose among PHP versions already included in a
package, but it cannot switch an asyncify artifact into a Wasmtime async
artifact. The checked-in manifest defaults to asyncify for PHP 7.4 through 8.4
and uses the Wasmtime async runtime for PHP 8.5.

By default, release packages include every supported PHP version listed in the
asset manifest. Use repeatable `--php-version=<version>` only for intentionally
filtered development packages; omitting it is the release path.

Create a self-contained package with:

```bash
cargo build --manifest-path packages/playground/cli-native/Cargo.toml --release --bins
cargo run --manifest-path packages/playground/cli-native/Cargo.toml --release --bin package-native-cli
```

The package helper writes `bin/wp-playground-native` plus
`share/wp-playground-native`, then creates a ZIP archive and a matching
`.zip.sha256` checksum sidecar. Package smokes verify the checksum, extract the
archive, disable source-tree fallback with
`WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK=1`, and runs `php -v` from the
extracted binary:

```bash
cargo run --manifest-path packages/playground/cli-native/Cargo.toml --release --bin package-native-cli -- --php-version=8.3 --skip-wordpress-assets --smoke-php-version=8.3
```

The full package smoke includes bundled WordPress and SQLite assets, extracts
the archive, starts the extracted binary as a server, fetches the installed
WordPress homepage, verifies SQLite database creation, and can also run a
standalone Blueprint and snapshot export through the packaged binary:

```bash
cargo run --manifest-path packages/playground/cli-native/Cargo.toml --release --bin package-native-cli -- --smoke-wordpress-server=8.3 --smoke-run-blueprint=8.3 --smoke-build-snapshot=8.3 --smoke-wordpress-version=6.9
```

CI builds complete package archives and checksums across macOS, Linux, and
Windows, uploads them as workflow artifacts, and runs `php -v` from the packaged
binary for every supported PHP version on every native target. It also runs the
heavier packaged WordPress server, `run-blueprint`, and `build-snapshot` smokes
with PHP 8.3 on every native target, plus PHP 8.5 on Linux x64 to exercise the
Wasmtime async runtime through full WordPress startup.

Benchmark WordPress server latency and RSS against system PHP with:

```bash
bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
```

The benchmark packages PHP 8.5 by default, bootstraps comparable WordPress 6.9
sites, runs home/search/post/editor requests through `wp-playground-native` and
native `php -S`, then prints raw metrics plus ratios against native PHP. Tune
sample counts and worker recycling with environment variables:

```bash
SAMPLES=12 WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER=400 \
  bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
```

Use the same script for peak-RSS PHP wasm rebuild experiments. For package-style
measurements, point `PACKAGE_ASSET_ROOT` at a rebuilt asset root that contains
`packages/playground/cli-native/assets/php-assets.json`; the script packages and
precompiles that root before measuring it, and packaged benchmark runs disable
source-tree asset fallback unless `WP_PLAYGROUND_NATIVE_ASSET_ROOT` is set. For
an already-built binary or direct runtime asset override, set
`WP_PLAYGROUND_NATIVE_BENCH_BIN` and `WP_PLAYGROUND_NATIVE_ASSET_ROOT` instead.
Labels keep result tables readable when comparing multiple runs:

```bash
PACKAGE_ASSET_ROOT=/tmp/php-wasm-emmalloc \
WASMTIME_LABEL=emmalloc \
NATIVE_PHP_BIN=/opt/homebrew/bin/php \
NATIVE_PHP_LABEL=macos-php \
  bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
```

Wasmtime stack sizing defaults to `2` MiB max wasm stack and `2` MiB async
stack. Package precompilation and the benchmarked server run both read the same
env values, so larger safety-margin profiles can be measured without changing
source:

```bash
WP_PLAYGROUND_NATIVE_MAX_WASM_STACK_MIB=8 \
WP_PLAYGROUND_NATIVE_ASYNC_STACK_MIB=16 \
WASMTIME_LABEL=stack-8-16 \
  bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
```

Wasmtime linear-memory reservation profiles are also available for measurement.
When package precompilation is enabled, `WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB`
and `WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB` must be the same for packaging and
runtime to reuse `.cwasm`; the benchmark script naturally does this when they
are exported on the same command. If a precompiled module is incompatible with
the active Wasmtime configuration, the runtime falls back to compiling the
`.wasm` asset. `WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_FOR_GROWTH_MIB` is a
runtime growth setting and can vary independently. Native server runs default
to non-moving linear memories for better optimized-code throughput; set
`WP_PLAYGROUND_NATIVE_MEMORY_MAY_MOVE=true` to restore Wasmtime's default moving
memory behavior for comparison:

```bash
WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB=256 \
WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB=16 \
WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_FOR_GROWTH_MIB=64 \
WASMTIME_LABEL=mem-256-16 \
  bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
```

For PHP ini experiments that should not become defaults until measured, append
directives with `WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND`:

```bash
WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND=$'realpath_cache_size=512K\noutput_buffering=4096' \
WASMTIME_LABEL=php-ini-tuned \
  bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
```

The most useful next variants are:

- allocator: rebuild the node asyncify PHP asset with `MALLOC=emmalloc`;
- light server profile: keep SQLite, OPcache, curl, OpenSSL, mbstring, iconv,
  libxml, and zip, then test removing server-path extras such as Imagick,
  MySQL, SOAP, EXIF, fileinfo, GD, and WS proxy support;
- compare every variant with the same `SAMPLES`, PHP version, WordPress
  version, and worker recycling settings.

Use `benchmark-php-wasm-variants.sh` on a machine with Node dependencies and
Docker available to build those variants and run the WordPress benchmark for
each one. It writes a temporary asset root per variant, generates a matching
`php-assets.json`, packages that root, and prints a combined table:

```bash
DRY_RUN=1 bash packages/playground/cli-native/scripts/benchmark-php-wasm-variants.sh

SAMPLES=12 VARIANTS="emmalloc-48:48MB:emmalloc dlmalloc-48:48MB:dlmalloc" \
  bash packages/playground/cli-native/scripts/benchmark-php-wasm-variants.sh
```

Variant entries are `label:INITIAL_MEMORY:MALLOC[:EXTRA_BUILD_ARGS]`, where
extra build args are comma-separated `build.js` options without leading `--`.
For example:

```bash
VARIANTS="light-48:48MB:emmalloc:WITH_GD=no,WITH_MYSQL=no,WITH_IMAGICK=no" \
  bash packages/playground/cli-native/scripts/benchmark-php-wasm-variants.sh
```

The helper defaults to `PHP_WASM_RUNTIME=wasmtime-async` and passes
`WITH_WASMTIME_ASYNC=yes` so native CLI variant runs match the Wasmtime async
runtime. Set `PHP_WASM_RUNTIME=asyncify` only when intentionally comparing the
older asyncify payload.
