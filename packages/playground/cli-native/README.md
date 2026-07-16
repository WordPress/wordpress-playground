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
- Playground supplies typed header, response-body, and stderr callbacks.
  Streamed requests opt into the header callback before body output, so the
  private npm bridge can expose a genuinely incremental response. Buffered
  requests read headers from the final typed response without the extra host
  callback.
- Playground supplies descriptor-based whole-file and byte-range locks because
  WASI does not yet expose the locking operations SQLite needs.
- Each PHP worker owns an independent fast Wasmtime Store and persistent PHP
  instance around one shared compiled component. A streamed control request
  lazily adds an epoch-enabled companion Store to that logical worker so
  CPU-bound cancellation does not instrument ordinary HTTP or buffered RPC.
  Poisoning and recycling discard both Stores; only the fast Store is rebuilt
  eagerly.

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
- protocol-v2 incremental response streaming with bounded backpressure,
  cancellation, and worker recovery;
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

Run the complete current-platform gate from the repository root:

```bash
npm exec -- nx run playground-cli-native:verify --output-style=stream
```

That target runs formatting, Clippy, TypeScript, Rust, npm, benchmark-script,
full native-process/WAL, packaged WordPress, Blueprint, snapshot, clean npm
install, and existing Node CLI regression checks. The Rust suite loads the
checked-in component rather than an optional `/tmp` fixture. The explicit
native-process suite runs serially and verifies overlapping SQLite readers, a
reserved writer with a concurrent reader, WAL persistence and flushing,
packaged WordPress, editor, Blueprint, snapshot, and file-lock behavior.

See [`NPM_PACKAGE.md`](./NPM_PACKAGE.md) for the private package boundary,
completion matrix, and the exact verification coverage.

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

Compare the full performance inventory against the accepted npm-integration
baseline with a 5% direction-aware regression limit:

```bash
npm exec -- nx run playground-cli-native:benchmark-regression -- \
  --baseline-ref=66c69684 --candidate-ref=HEAD --max-regression-pct=5
```

This covers public, mixed, and admin throughput and CPU/request; warm-idle PSS,
peak-active PSS, and peak cgroup memory; and Site Editor TTFB, first meaningful
paint, and fully loaded time. The correctness verifier remains deterministic
and separate from this host-sensitive performance run. Every derived CPU round
is matched to its raw fixed-count load by workload, round, authentication scope,
request count, elapsed time, and successful request rate before aggregation.

Automatic collection is Linux-only. It requires systemd and `systemd-run`, a
unified cgroup-v2 hierarchy, passwordless `sudo` for transient units and cgroup
counters, and at least 12 logical CPUs online and available to the process. By
default the server is pinned to CPUs 0-5 and the client to CPUs 6-11; overrides
must remain ordered,
non-overlapping sets of exactly six CPUs and become part of the exact comparison
fingerprint. Set them with `WP_PLAYGROUND_NATIVE_BENCHMARK_SERVER_CPUS` and
`WP_PLAYGROUND_NATIVE_BENCHMARK_CLIENT_CPUS`. It also requires Chromium through
`PLAYWRIGHT_EXECUTABLE_PATH` or a discoverable `chromium`, `chromium-browser`,
or `google-chrome` executable. The random loopback port on `127.0.0.1` must be
usable. Outbound HTTPS is needed when Git submodules, Cargo dependencies, or
runtime assets are absent from local caches; WordPress itself is prevented from
making outbound HTTP requests during the measurement.

To compare already collected snapshots on macOS, Windows, or a smaller host,
use portable results-file mode:

```bash
node packages/playground/cli-native/scripts/benchmark-regression.mjs \
  --baseline-results=/path/to/baseline.json \
  --candidate-results=/path/to/candidate.json \
  --max-regression-pct=5
```

Results-file mode needs only Node.js and can run from outside a Git checkout.
Supplying either ref additionally opts into exact revision verification and
therefore requires a Git checkout containing that ref. Snapshot schema v1 keeps
the human-facing `revisionLabel` separate from `resolvedCommit`; the latter may
be `null` for label-only comparisons but must be the full hexadecimal Git commit
for ref verification.

## Runtime assets

The binary discovers assets beside the executable, under
`share/wp-playground-native`, or in the source tree. Set
`WP_PLAYGROUND_NATIVE_ASSET_ROOT` to override discovery.

Release packaging verifies every source checksum, pairs each bundled WordPress
archive with its matching `wordpress-static.zip`, and can precompile the PHP
component for the target platform. Precompiled artifacts are always loaded by
the same Wasmtime engine configuration that created them.
