# PHP WASI Preview 2 component

This directory builds PHP 8.2.32 as a persistent WASI Preview 2 component. Each
component instance is one long-lived PHP worker: PHP module startup runs once,
while request startup and shutdown run around every `handle-request` call. A
host can create as many isolated instances as it needs, matching the worker
model used by PHP-FPM without sharing unsafe Zend globals between requests.

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
byte-identical `php-wasi-component.wasm`.

```sh
docker build -t playground-php-wasi packages/php-wasm/compile/php-wasi
docker run --rm \
  -v "$PWD/packages/php-wasm/compile/php-wasi/dist:/work/dist" \
  playground-php-wasi
```

For an existing toolchain with the versions in `versions.env`:

```sh
JOBS=16 packages/php-wasm/compile/php-wasi/build.sh
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

`PHP_WASI_OPT_LEVEL` accepts `O2` or `O3`; `PHP_WASI_VM_KIND` accepts
`HYBRID` or `GOTO`. GOTO generation runs the PHP CLI with `-n`, requires the
same PHP major/minor as `PHP_VERSION`, and verifies the generated executor and
opcode metadata against hashes pinned in `versions.env`. The selected
optimization level applies consistently to PHP, SQLite, the component SAPI,
generated bindings, and the final link.

The build uses `make -j$JOBS` for both SQLite and PHP and produces:

- `dist/php-wasi-component.wasm`
- `dist/libphp.a`
- `dist/libsqlite3.a`

The WordPress profile statically enables `filter`, OPcache, PDO, `pdo_sqlite`,
and `sqlite3`. Each persistent component owns a process-local OPcache arena;
there is no cross-worker shared memory. WASI validation retains nanosecond file
timestamps so same-second edits are visible immediately, while OPcache's
default file-update protection avoids caching a file during a write. SQLite is
built with FTS5, URI support, column metadata, and loadable extensions disabled.
Its WASI VFS can mirror WAL shared-memory regions through a host-provided
`sqlite-wal-shm` component interface.

## Component ABI

The component exports:

```wit
record entry {
  key: string,
  value: string,
}

record request {
  script-path: string,
  request-uri: string,
  method: string,
  host: string,
  port: u32,
  body: list<u8>,
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
```

Filesystem roots are not passed through this API. They are capabilities fixed
by the host's preopened directories when a worker is created.

The component model validates and lifts the strings, lists, options, and
records. The SAPI derives the query string from `request-uri`; `body` remains
binary-safe, and `server-entries` and `env` are copied into each PHP request.

Binary response data is sent through `wordpress:php-wasi/output@0.1.0` on the
`stdout` and `stderr` channels. HTTP status and headers are returned as typed
fields on `response`, preserving duplicate headers without a private envelope.

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

Unsupported capabilities fail explicitly. Dynamic libraries, subprocesses,
shell pipes, mail transport, ownership/mode changes, and Fibers do not pretend
to succeed. Temporary files use random names and `O_EXCL` inside a preopen.
Hosts using the raw component should provide a writable `/tmp` preopen for PHP
temporary files. The native Playground backend provides it to every worker.

## Validation

`build.sh` finishes by running:

```sh
packages/php-wasm/compile/php-wasi/validate.sh \
  packages/php-wasm/compile/php-wasi/dist/php-wasi-component.wasm
```

This runs full-feature WebAssembly validation (which catches pathological
functions exceeding Wasmtime's local limit) and verifies the resolved WASI
0.2.6, request/output, lock, and SQLite WAL shared-memory interfaces. The
scripts in `tests/smoke` cover
normal output and temp files, header-only redirects and cookies, a fatal
bailout, recovery on the same worker, WASI-backed cryptographic randomness,
filter validation and password hashing, and transactional/concurrent PDO
SQLite writes. The native component tests additionally verify that OPcache is
loaded, repeated requests hit the same instance-local cache, mounted script
edits revalidate, and a manual cache reset leaves the worker usable.

With the native server running against this directory at `/site` and
`/wordpress`, execute the HTTP suite with:

```sh
packages/php-wasm/compile/php-wasi/tests/smoke/run.sh http://127.0.0.1:PORT
```
