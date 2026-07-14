# WordPress Playground Wasmtime CLI

This package contains an experimental, Node-free WordPress Playground runtime
for native development:

```bash
wp-playground-native start [options]
wp-playground-native server [options]
wp-playground-native run-blueprint [options] [blueprint.json]
wp-playground-native build-snapshot [options]
```

## Architecture

PHP 8.2 is built as a persistent WASIp2 component. The Rust host composes it
with Wasmtime's synchronous WASI implementation instead of reproducing the
Emscripten and Node.js syscall layer.

The native-specific boundary is intentionally small:

- Wasmtime supplies the standard filesystem, clocks, random, environment, and
  other WASI interfaces.
- Playground supplies a binary output interface for response body and stderr;
  HTTP status and headers return as typed WIT values.
- Playground supplies descriptor-based whole-file and byte-range locks because
  WASI does not yet expose the locking operations SQLite needs.
- Each PHP worker owns an independent Wasmtime Store and persistent PHP
  instance around one shared compiled component.

This gives concurrent requests real parallel execution. SQLite transactions
still coordinate through native advisory locks, including independent workers
inside the same process.

SQLite uses its `unix` VFS so shared readers and a reserved writer can overlap
through the host fcntl/OFD bridge. WAL mode keeps a private wal-index mirror in
each component and atomically exchanges changed ranges with a canonical image
owned by the native CLI process at SQLite lock and barrier boundaries. This
coordinates workers within one CLI process; separate CLI processes must not
concurrently open the same mounted database in WAL mode.

The component build and its inputs live in
`packages/php-wasm/compile/php-wasi`. Its checked-in output is selected by
`assets/php-assets.json`; no JavaScript loader is packaged by the native CLI.

## Run locally

Build and start a persistent WordPress site:

```bash
cargo run --release \
  --manifest-path packages/playground/cli-native/Cargo.toml -- \
  start --workers=4 --skip-browser
```

Serve an existing directory without installing WordPress:

```bash
cargo run --release \
  --manifest-path packages/playground/cli-native/Cargo.toml -- \
  server --skip-wordpress-install --skip-sqlite-setup \
  --mount-dir-before-install "$PWD/site" /wordpress
```

The default port is `9400`. If that implicit port is occupied, `start` and
`server` choose an ephemeral port; an explicitly requested occupied port is an
error.

When `--workers` is omitted, the server starts one PHP worker, scales up to the
default worker limit as concurrent requests arrive, and keeps extra workers
warm for 10 seconds after their last request. Set
`WP_PLAYGROUND_NATIVE_LAZY_WORKER_IDLE_TIMEOUT_MS` to tune that idle timeout.
Passing `--workers=<n>` or `--workers=auto` eagerly creates and retains the
requested pool. Workers recycle after 3,000 requests by default; use
`WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER` to set a different bound.

Run `wp-playground-native --help` or
`wp-playground-native <command> --help` for command-specific options. Help is
handled before PHP or WordPress assets are loaded.

## Supported workflow

The component path supports:

- `start` and `server`, including a configurable persistent worker pool;
- bundled or downloaded WordPress releases and the SQLite integration plugin;
- persistent site storage, mounts, auto-mounting, snapshots, and auto-login;
- Blueprint startup through the native v1 step interpreter;
- typed WordPress constants and generated runtime PHP configuration;
- safe WordPress archive extraction with the matching static asset overlay;
- worker recovery after PHP fatal errors and request-count recycling;
- binary request bodies and response bodies;
- concurrent SQLite access using real host file locks.

Current component constraints are explicit:

- PHP 8.2 is the only native component build.
- Intl, Redis, Memcached, Xdebug, and dynamic PHP side modules are not included.
- OPcache is not included in the current component build.
- The standalone native `php` command is deferred until the component exposes
  a real CLI-session ABI. SAPI execution is not used to imitate `php -r`,
  stdin, PHAR, or PHP's argument parser.
- PHP-initiated outbound networking is not enabled yet. Host-side WordPress and
  Blueprint downloads continue to use the Rust downloader.
- The v1 interpreter rejects unsupported behavioral top-level Blueprint fields
  (`landingPage`, `preferredVersions`, `features`, `constants`, and `plugins`)
  instead of silently ignoring them; express behavior with supported startup
  steps and explicit CLI flags.

The browser and Node.js runtimes are not replaced by compiling this Rust host
to Wasm. Wasmtime depends on native JIT, virtual memory, and OS handles. The
portable unit is the PHP component: Node and browser support can adopt it with
their own WASI capability adapters while retaining thin platform-specific
JavaScript hosts.

## Build the PHP component

The reproducible Linux build runs in Docker:

```bash
packages/php-wasm/compile/php-wasi/docker.sh build
packages/php-wasm/compile/php-wasi/docker.sh validate
```

The build pins PHP, SQLite, WASI SDK, WIT tools, source checksums, the container
base image, and `SOURCE_DATE_EPOCH`. Validation checks the component model and
published manifest checksum. CI also rebuilds the checked-in component and
requires a byte-for-byte match.

## Test

```bash
cargo fmt --manifest-path packages/playground/cli-native/Cargo.toml -- --check
cargo clippy --manifest-path packages/playground/cli-native/Cargo.toml \
  --all-targets -- -D warnings
cargo test --manifest-path packages/playground/cli-native/Cargo.toml
python3 -m unittest discover \
  -s packages/playground/cli-native/scripts/tests -p 'test_*.py'
node --test \
  packages/playground/cli-native/scripts/tests/benchmark-site-editor.test.mjs

# Full process, concurrency, packaged WordPress, Blueprint, and snapshot smokes:
cargo test --manifest-path packages/playground/cli-native/Cargo.toml \
  --test native_server -- --ignored --test-threads=1
```

The Rust suite loads the checked-in component rather than an optional `/tmp`
fixture. It covers typed request transfer, header/body separation, fatal-error
recovery, parallel workers, and two concurrent `BEGIN IMMEDIATE` SQLite
transactions through the guest lock bridge. The ignored native-server suite
also verifies overlapping SQLite readers, a reserved writer with a concurrent
reader, packaged WordPress, Blueprint, snapshot, editor, and lock smokes.

## Benchmark the Site Editor

Start matched WordPress installations under Node Playground CLI, this runtime,
and nginx/native PHP, then run:

```bash
node packages/playground/cli-native/scripts/benchmark-site-editor.mjs \
  --target 'Node Playground CLI=http://127.0.0.1:9401' \
  --target Wasmtime=http://127.0.0.1:9400 \
  --target 'nginx/native PHP=http://127.0.0.1:8081' \
  --storage-state ./wordpress-auth.json
```

The report includes median and p95 navigation TTFB, first contentful paint,
first meaningful Site Editor paint, and fully loaded time. Meaningful paint is
the later of first contentful paint and the first visible editor UI. Fully loaded means
the load event, visible editor UI, ready fonts, and a bounded network-quiet
window; known WordPress long-lived requests are excluded explicitly. JSON and
TSV reports are written for later comparison.

## Runtime assets

The binary discovers assets beside the executable, under
`share/wp-playground-native`, or in the source tree. Set
`WP_PLAYGROUND_NATIVE_ASSET_ROOT` to override discovery.

Release packaging verifies every source checksum, pairs each bundled WordPress
archive with its matching `wordpress-static.zip`, and can precompile the PHP
component for the target platform. Precompiled artifacts are always loaded by
the same Wasmtime engine configuration that created them.
