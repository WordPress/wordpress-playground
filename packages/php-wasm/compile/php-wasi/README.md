# PHP WASI Preview 2 component

This directory builds PHP 7.4 through 8.5 as persistent WASI Preview 2
components. PHP 8.2 is the default when no version is selected. Each component
instance has one mode. An HTTP instance is a long-lived PHP worker:
module startup runs once, while request startup and shutdown run around every
`handle-request` call. A fresh CLI instance instead runs PHP's real CLI SAPI
exactly once. A host can create as many isolated instances as it needs,
matching the worker model used by PHP-FPM without sharing unsafe Zend globals.

The build deliberately keeps the implementation in PHP and wasi-libc. It does
not recreate PHP's filesystem, stream, or request runtime in a host language.
The custom C SAPI is the small boundary that translates a typed component
request into PHP's SAPI globals and streams response bytes back to the host.

## Reproducible build

The target sources and cross-compilation/component tools, including wasi-sdk
33.0, Autoconf 2.72, wit-bindgen 0.55.0, and wasm-tools 1.241.2, are pinned
with SHA-256 checksums in `versions.env`. `SOURCE_DATE_EPOCH` is pinned to the
PHP release commit, and the container base is pinned by digest. The PHP
build-system string is normalized so a container's random hostname is not
embedded in the component. Two clean parallel builds must therefore produce a
byte-identical component for the same PHP version and variant.

```sh
docker build -t playground-php-wasi packages/php-wasm/compile/php-wasi
docker run --rm \
  -v "$PWD/packages/php-wasm/compile/php-wasi/dist:/work/dist" \
  playground-php-wasi
```

For an existing toolchain with the versions in `versions.env`:

```sh
JOBS=16 packages/php-wasm/compile/php-wasi/build.sh

PHP_WASI_PHP_VERSION=8.5 PHP_WASI_VARIANT=extended JOBS=16 \
  packages/php-wasm/compile/php-wasi/build.sh
```

The default profile is `O2/GOTO`, using PHP's fully threaded, all-inline
executor. The HYBRID alternative combines computed-goto dispatch with a mix of
inline and called opcode handlers. Performance experiments can select either
VM and/or `O3`. SQLite is always compiled with `THREADSAFE=1`, preserving its
mutex implementation and memory barriers:

```sh
PHP_WASI_OPT_LEVEL=O3 PHP_WASI_VM_KIND=GOTO \
  PHP_WASIP2_DIST_DIR=/tmp/php-wasi-o3-goto \
  packages/php-wasm/compile/php-wasi/docker.sh build
```

`PHP_WASI_PHP_VERSION` accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, or
`8.5`; `PHP_WASI_VARIANT` accepts `base` or `extended`.
`PHP_WASI_OPT_LEVEL` accepts `O2` or `O3`; `PHP_WASI_VM_KIND` accepts `HYBRID`
or `GOTO`. GOTO generation runs the pinned PHP 8.2 host CLI with `-n` and
verifies each PHP series' generated executor and opcode metadata against hashes
pinned in `versions.env`. The selected optimization level applies consistently
to PHP, SQLite, the component SAPI, generated bindings, and the final link.

The build uses `make -j$JOBS` for both SQLite and PHP. PHP 8.2 retains the
original filenames; other versions are versioned so an entire matrix can share
one output directory:

- `dist/php-wasi-component.wasm`
- `dist/php-wasi-extended-component.wasm`
- `dist/php-<series>-wasi-component.wasm`
- `dist/php-<series>-wasi-extended-component.wasm`
- `dist/libphp.a`
- `dist/libsqlite3.a`

The WordPress profile statically enables `ctype`, `filter`, `session`, Phar,
OPcache, PDO, `pdo_sqlite`, `sqlite3`, and zlib (including `gzinflate()`). The
extended variant additionally links Redis, Memcached, and Xdebug; the host
selects which of those extensions is registered for each worker, and all three
are disabled by default. Each
persistent component owns a process-local OPcache arena; there is no
cross-worker shared memory. WASI
validation retains nanosecond file timestamps so same-second edits are visible
immediately, while OPcache's default file-update protection avoids caching a
file during a write. SQLite is built with FTS5, URI support, column metadata,
and loadable extensions disabled. Its WASI VFS can mirror WAL shared-memory
regions through a host-provided `sqlite-wal-shm` component interface.

## Component ABI

The component exports:

```wit
interface handler {
  record entry { key: string, value: string }
  record request {
    script-path: string,
    request-uri: string,
    method: string,
    host: string,
    port: u32,
    body: list<u8>,
    stream-response: bool,
    content-type: option<string>,
    cookies: option<string>,
    server-entries: list<entry>,
    env: list<entry>,
  }
  record response {
    exit-status: s32,
    http-status: u16,
    headers: list<string>,
  }
  initialize: func(php-ini-path: string) -> result<_, string>;
  handle-request: func(request: request) -> result<response, string>;
}

interface cli {
  record entry { key: string, value: string }
  record request {
    argv: list<string>,
    env: list<entry>,
    cwd: option<string>,
  }
  run: func(request: request) -> result<s32, string>;
}
```

Filesystem roots are not passed through this API. They are capabilities fixed
by the host's preopened directories when a worker is created.

The component model validates and lifts the strings, lists, options, and
records. The SAPI derives the query string from `request-uri`; `body` remains
binary-safe, and `server-entries` and `env` are copied into each PHP request.
`stream-response` is an internal host transport hint and is not registered as
a PHP request variable.

The CLI export copies argv and environment entries, optionally changes to the
requested preopened working directory, and invokes the selected upstream PHP CLI
entry point. PHP performs its normal option parsing, php.ini loading, PHAR
startup, stdout/stderr writes, shutdown, and exit-status selection. HTTP
initialization and CLI execution are mutually exclusive on an instance; hosts
must use a fresh component for each CLI call.

When `stream-response` is true, response status and headers are sent through
`wordpress:php-wasi/output@0.1.0` before the first body byte. Binary response
data then uses the interface's `stdout` and `stderr` channels. Buffered hosts
set `stream-response` to false and receive status and headers only through the
final `response` record, avoiding an otherwise redundant host callback. The
typed response fields preserve duplicate headers in both modes without a
private envelope.

PHP's normal request-shutdown sequence owns the final header commit. It runs
user shutdown callbacks before output-layer deactivation sends any still
pending headers, including redirects, cookies, and header-only responses. The
component therefore does not pre-send headers before `php_request_shutdown()`;
callbacks such as phpMyAdmin's renderer retain their normal opportunity to add
headers. The eventual commit uses the streaming callback or buffered response
fields described above.

All wasi-sdk imports resolve to WASI 0.2.6. Advisory locks use the typed
`wordpress-playground:filesystem-locks@0.1.0` import. `fcntl_bridge.c` preserves
wasi-libc's descriptor flags, adds `flock`, and implements POSIX byte-range
`F_GETLK`, `F_SETLK`, and `F_SETLKW` over that host interface. The bridge is
intentionally pinned to wasi-sdk 33's descriptor-table ABI.

## Correctness boundaries

The PHP patches retain Zend's real `setjmp`/`longjmp` bailout path through
LLVM's WebAssembly SJLJ lowering. A fatal PHP request therefore returns status
255 and does not poison the worker; a later request on the same component
instance can run normally.

PHP 7.4 adapts its integer-returning `zend_list_free()` function through an
exact `void(zend_refcounted *)` wrapper. This keeps the resource destructor
table's indirect-call signature valid in WebAssembly when a resource is
released.

WASI stream readiness is advisory: a nonblocking `recv()` can still return
`EAGAIN` after `poll()` reports a socket readable. PHP's blocking socket path
therefore resumes its normal poll/read loop for that transient result while
preserving nonblocking, buffered-data, and exact zero-timeout behavior. The
real Redis protocol test performs 128 set/get/delete cycles through both HTTP
and CLI execution so this boundary is exercised repeatedly rather than hidden
by a retry in the test harness.

Unsupported capabilities fail explicitly. Dynamic libraries, subprocesses,
shell pipes, mail transport, ownership/mode changes, and Fibers do not pretend
to succeed. Temporary files use random names and `O_EXCL` inside a preopen.
WASI capability filesystems have no process umask, so PHP's `umask()` returns
the deterministic integer value `0`; attempts to change it do not alter host
capabilities. Hosts using the raw component should provide a writable `/tmp`
preopen and configure `sys_temp_dir=/tmp`. The native Playground backend does
both for every worker and shares that mount across its pool, allowing fallback
file-backed session directories beneath `/tmp` to survive worker handoffs.

## Validation

`build.sh` finishes by running:

```sh
packages/php-wasm/compile/php-wasi/validate.sh \
  packages/php-wasm/compile/php-wasi/dist/php-wasi-component.wasm
```

This runs full-feature WebAssembly validation (which catches pathological
functions exceeding Wasmtime's local limit) and verifies the resolved WASI
0.2.6, HTTP handler, CLI, output, lock, and SQLite WAL shared-memory interfaces.
The scripts in `tests/smoke` cover normal output and temp files, ctype and
cross-request file-backed sessions, header-only redirects and cookies, a fatal
bailout, recovery on the same worker, WASI-backed cryptographic randomness,
filter validation and password hashing, and transactional/concurrent PDO
SQLite writes. The native component tests additionally verify that OPcache is
loaded, repeated requests hit the same instance-local cache, mounted script
edits revalidate, and a manual cache reset leaves the worker usable.
The native process smoke also runs `php -r`, help and invalid-option paths,
executes the bundled WP-CLI PHAR, checks php.ini generation invalidation across
concurrent workers and CLI, and cancels then recovers a CPU-bound CLI Store.

After all manifest artifacts are staged, run the complete PHP 7.4–8.5 base and
extended matrix. It validates each manifest digest, exact PHP and extension
version, explicit stream-resource release (including the PHP 7.4 destructor
regression), in-memory zlib compression and gzip file-wrapper ownership,
parallel/WAL behavior, Xdebug DBGp over HTTP and CLI, and real Redis and
Memcached round trips over both SAPIs. `redis-server` and `memcached` must be on
`PATH`; on NixOS the complete command is:

```sh
nix --extra-experimental-features 'nix-command flakes' shell \
  nixpkgs#redis nixpkgs#memcached -c \
  packages/playground/cli-native/scripts/verify-php-runtime-matrix.sh
```

With the native server running against this directory at `/site` and
`/wordpress`, execute the HTTP suite with:

```sh
packages/php-wasm/compile/php-wasi/tests/smoke/run.sh http://127.0.0.1:PORT
```
