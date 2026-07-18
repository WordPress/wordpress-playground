# Private `@wp-playground/cli-native` package

This package is an unpublished integration experiment. It exercises the npm
launcher and JavaScript API without publishing an npm package, a native host,
or a CI artifact.

## Outcome

The private npm tarball contains:

- the ESM, CommonJS, type declaration, and `wp-playground-cli` entrypoints;
- the portable PHP WASIp2 component;
- the SQLite integration and WAL assets; and
- manifests, licenses, and notices.

It must not contain `wp-playground-native`, a `.cwasm`, a native package
archive, Cargo output, or a public download URL. The package has
`"private": true`, no `publishConfig`, no publish target, and no lifecycle
download script.

The platform-specific `wp-playground-native` test host is served by a temporary
localhost fixture. A caller must set `WP_PLAYGROUND_NATIVE_HOST_BASE_URL`.
There is intentionally no default while the package is private. The launcher
downloads the gzip-compressed host, verifies the compressed and executable
SHA-256 values from the packaged manifest, and caches the executable under:

```text
${WP_PLAYGROUND_NATIVE_CACHE_DIR:-~/.wordpress-playground/native}/
  <host-version>/<target>/<executable-sha256>/wp-playground-native[.exe]
```

The launcher rejects unsupported targets and Linux musl before attempting a
request. Downloads are bounded, lock-coordinated, written to a temporary file,
and atomically installed. A partial or unverified executable is never run.

`wp-playground-cli runtime install` acquires the host and prewarms the
FastStartup and Optimized Wasmtime caches. Ordinary commands do the same work
lazily. Compilation is per engine-profile cache miss, not per worker or
request.

For a running server, `playground.cli(argv, { env, cwd })` is a real PHP CLI
session, not an HTTP-SAPI emulation. It reserves one configured worker slot,
creates a fresh interruptible component, streams stdout and stderr live, and
returns PHP's exit code. Every PHP 7.4–8.5 component includes Phar and executes
the bundled WP-CLI archive. No npm package, host binary, or Wasm artifact is
published by this work.

## Compatibility boundary

`compatibility.json` is authoritative for native commands, programmatic
options, CLI flags, package exports, server members, worker methods, and
events. Programmatic options and CLI flags remain separate inventories because
their names and command applicability differ. Unsupported capabilities must
return an explicit error before downloading or spawning the native host; they
must never be accepted and ignored. A schema-declared no-op represents an
upstream programmatic compatibility quirk, not an unsupported capability.
Tests compare these inventories with the
upstream CLI declarations and the Rust parser so additions cannot drift
silently. `additionalNativeCommands` records the narrow intentional exception:
Redis and Memcached selection is accepted on `start`, which normalizes to the
native server command before launch.

The unsupported programmatic `internalCookieStore` integration declares
`allowFalse` in the schema. Its exact disabled value is omitted because it
requests no native capability; `true`, other values, unknown disabled options,
and out-of-scope commands still reject before acquisition. Redis and Memcached
follow the Node CLI's JSPI default when omitted: direct library calls enable
them only when the current runtime exposes `WebAssembly.Suspending`, while the
npm executable also emulates the successful Node 23+ JSPI respawn without
starting a second process. Explicit `true` and `false` always win and become
positive or negative CLI flags. Xdebug remains disabled when omitted. Xdebug
configuration objects remain in the drop-in
TypeScript surface but reject before acquisition; native v1 has no
deterministic mapping for their settings.
Studio also passes its server `port` through the programmatic
`run-blueprint` path even though that one-shot command never binds a listener.
The schema records this single accepted no-op command explicitly and removes
the value before argv construction; ordinary command-scope mismatches still
reject.

The executable npm entry point and `parseOptionsAndRunCLI()` share the same
schema-driven argv preflight. It recognizes direct flags, `--flag=value`, and
every yargs-generated `--no-*` and camel-case spelling. It snapshots a dense
ordinary argv array, rejects malformed commands and declared command-scope
mismatches, and never treats `--` as a way around compatibility checks. Full
value and arity parsing for supported flags remains the Rust parser's
responsibility. For network-extension defaults, actual JSPI support always
wins. Without it, the executable emulates the upstream respawn only on Node
23+; a truthy `PLAYGROUND_NO_JSPI_RESPAWN`, Bun, Deno, or an already-present
but ineffective `--experimental-wasm-jspi` leaves the extensions disabled.
The library calls a private schema-v1 argv probe in the native
host before execution. That probe loads no runtime assets and returns only a
bounded, exact-key JSON validation result containing the command, port, and
site URL needed by the Node server wrapper; it does not reproduce yargs in
JavaScript. Non-exact mixed camel/negation spellings are family-normalized
only for preflight rejection; they are not separately enumerated or accepted,
and `--noFoo` is not reinterpreted as `--no-foo`. The compatibility test
derives root exports, externally
accessible common server/worker members, option objects, programmatic and CLI
command applicability, and generated aliases from the upstream TypeScript AST
and checker; it does not maintain a second hand-written upstream list. `php`
is classified at the command level, so its nested option scopes are
intentionally unreachable and omitted from native command-applicability lists.

`runCLI()` takes its own descriptor-safe, null-prototype snapshot before its
first await. Known optional properties with `undefined` are omitted; unknown
properties still reject. Supported properties are constrained to their
declared command, workers are capped at 256 (including `auto` resolution), and
all user-controlled strings reject NUL bytes.

The npm package mirrors the public JavaScript surface of
`@wp-playground/cli` for the native capability subset:

- `runCLI` and `parseOptionsAndRunCLI`;
- `LogVerbosity`, `resolveWorkerCount`, and `mergeDefinedConstants`;
- `internalsKeyForTesting` and `CLIArgsValidationError`; and
- the `RunCLIArgs`, `RunCLIServer`, `CLIExitResult`, `CLIServerResult`,
  `ParseCLIResult`, `PlaygroundCliWorker`, and `WorkerType` types.

`spawnWorkerThread` and `SpawnedWorker` are intentionally excluded because
they expose the Emscripten implementation rather than the CLI contract.
The control bridge exposes `ready`, `shutdown`, `request.end`,
`request.error`, and `filesystem.write` events. It maps the native lifecycle
to one `runtime.initialized` and one `runtime.beforeExit` event per logical
proxy and supports the upstream `*` listener. Listener registration and
removal are awaitable, matching the pooled worker shape used by Studio. PHP
worker `message`/`sendmail.spawned` events and `onMessage()` remain explicitly
unsupported rather than installing inert listeners.

For `start` and `server`, `runCLI()` returns a real Node `http.Server`, its URL,
an authenticated native Playground RPC proxy, the native worker count, and an
idempotent asynchronous disposer. The Node server proxies the public port to
the native server's private loopback listener. Direct command-line execution
does not use this proxy. `parseOptionsAndRunCLI()` returns `{ exitCode }` for
validation, help, version, and successful one-shot commands; for `start` and
`server` it returns an async-disposable `CLIServerResult` whose testing
internals contain that real `RunCLIServer`. It never calls `process.exit()` or
installs persistent signal policy.

The native control listener is loopback-only and requires a random bearer
token. Its temporary handshake contains protocol version, control and site
URLs, PID, document root, and worker count. The handshake lives in a private
temporary directory, and the client verifies its PID and loopback endpoints.
The token is removed from the host environment before any browser process can
be spawned and must never be logged.

Control requests are authenticated before body allocation, limited to 64
concurrent connections, and capped at 128 MiB of encoded JSON. Base64 leaves
roughly 96 MiB for one binary `writeFile()` or request payload. Protocol v2
streams response headers, stdout, and stderr as NDJSON frames of at most 64 KiB
through a bounded eight-frame queue. Cancellation discards an active streamed
HTTP companion or drops a fresh CLI Store and releases its capacity slot. The
Node client keeps eight frames per output channel in
memory and lazily spools overflow to private temporary files, so an unread
stderr stream cannot deadlock completion or cause unbounded RAM growth. See
[`CONTROL_PROTOCOL.md`](./CONTROL_PROTOCOL.md) for the complete wire contract.

## Method inventory

The root module exports `runCLI`, `parseOptionsAndRunCLI`,
`CLIArgsValidationError`, `LogVerbosity`, `resolveWorkerCount`,
`mergeDefinedConstants`, `internalsKeyForTesting`, the structured parse-result
types, and the native error types. Host acquisition, manifest parsing, process
spawning, the argv probe, and raw control clients are package internals.

`RunCLIServer` exposes the real Node `server`, its public `serverUrl`, the
`playground` API, the native worker count under `internalsKeyForTesting`, and
idempotent asynchronous disposal.

`runCLI` accepts Blueprint paths, inline JSON, and Studio's readable filesystem
bundle. For a bundle it materializes only `/blueprint.json`; top-level
`preferredVersions` become the validated native PHP/WordPress arguments and
top-level `constants` become a leading `defineWpConfigConsts` step. Bundle
resources referenced by other Blueprint steps are not materialized in native
v1.

The native v1 `playground` API supports:

- `request`, real incremental `requestStreamed`, `run`, and PHP-only `cli`;
- `mkdir`, `mkdirTree`, `readFileAsText`, `readFileAsBuffer`, `writeFile`,
  `unlink`, `mv`, recursive regular-file/directory `cp`, recursive `rmdir`,
  `listFiles`, `isDir`, `isFile`, and `fileExists`;
- `chdir`, `cwd`, `defineConstant`, `pathToInternalUrl`, and
  `internalUrlToPath`; and
- supported event listeners. Asynchronous disposal belongs to the returned
  `RunCLIServer`, not to the worker proxy.

## Non-goals

The top-level `wp-playground-native php` command, non-PHP `playground.cli()`
commands, stdin injection beyond PHP's inherited empty input, `onMessage`,
runtime hot-swapping, Emscripten worker construction, dynamic PHP extensions,
guest TCP listeners, guest UDP, Blueprint v2, Blueprint-adjacent resource
resolution, and cross-process WAL coordination are explicit non-goals for
native v1. Guest TCP connect and DNS lookup are enabled for Node parity.

The native package accepts PHP 7.4, 8.0, 8.1, 8.2, 8.3, 8.4, and 8.5 with the
supported Studio sandbox filesystem layouts. Studio currently offers PHP
8.2–8.5 in its selector and deliberately keeps stored legacy sandbox sites on
PHP 7.4–8.1 runnable; the integration proof exercises both paths. Studio's mounted
phpMyAdmin bundle and URL alias are supported, including file-backed sessions
shared across the native worker pool. The bundled Redis and Memcached PHP
client extensions follow the Node/JSPI selection gate, but native v1 does not
launch their backing services. Bundled Xdebug is a boolean
selection; Xdebug option objects remain outside the native boundary. Other
configurations retain the Node Playground implementation.

Unmodified Studio requests Redis and Memcached only when its JSPI capability
gate succeeds. Its Node 24 process manager supplies the experimental JSPI flag,
which is the production path used for final Studio evidence; a Node 22 test-only
override can prove downstream argument plumbing but is not production support
on Node 22. Only running-site `studio wp` commands call the replacement's
`playground.cli()`. Studio's stopped-site and explicit-PHP-version WP-CLI paths
instantiate `@php-wasm/node` directly and remain outside the drop-in package.

## Array-shape documentation inventory

- `RunCLIArgs._` preserves positional token order; index zero is normally the
  command. It must be a dense, ordinary array of strings with no extra keys.
- `playground.cli()` argv is a separately snapshotted dense ordinary
  `string[]`. It must contain 1–4,096 own data-property entries, preserve empty
  non-command arguments, contain no symbols/accessors/extra keys/NUL, and have
  basename-exact `php` at index zero. Each UTF-8 entry is at most 1 MiB and
  argv plus env plus cwd is at most 8 MiB.
- CLI options are an exact plain `{ env?, cwd? }` record. `env` is an exact
  plain `Record<string, string>` with at most 4,096 own data properties;
  names are non-empty, contain neither `=` nor NUL, and values may be empty but
  not contain NUL. `cwd` is an optional non-empty VFS string resolved inside a
  mounted preopen. JavaScript snapshots records before the RPC; Rust decodes
  and validates the shape again before component allocation.
- Mount arrays contain ordered `{ hostPath, vfsPath }` records. Before-install
  mounts execute before ordinary mounts. Records must be plain objects with
  exactly those two non-empty string fields.
- `define`, `define-bool`, and `define-number` are plain records with string,
  boolean, and finite-number values respectively; a constant name may occur in
  only one record.
- Inline Blueprints are JSON-safe plain records: cycles, sparse arrays,
  non-finite numbers, symbols, accessors, custom prototypes, functions,
  `undefined`, and `BigInt` reject before acquisition. Snapshots are limited to
  64 levels, 100,000 values, and 16 MiB of serialized UTF-8 JSON.
- Studio Blueprint bundles must expose `read` and the returned file must expose
  `stream` as data-property methods. Only `/blueprint.json` is read. Its stream
  is an ordered sequence of `Uint8Array` chunks, capped at 16 MiB and decoded
  as strict UTF-8 before the same JSON-shape limits are reapplied.
- Public request headers are `Record<string, string>`. Wire headers are ordered
  `{ name, value }[]` records so duplicates survive. Public response headers
  are lowercase `Record<string, string[]>` values in arrival order.
- Multipart bodies are `Record<string, string | Uint8Array | File>` and retain
  property insertion order.
- Binary wire values always use `{ encoding: "base64", data: string }`.
- Stream output is an NDJSON sequence rather than one JSON array. Output frame
  sequence numbers increase globally across stdout and stderr.
- Environment and `$_SERVER` values are public records and deterministic WIT
  entry arrays with unique keys.
- `listFiles()` returns a lexicographically sorted `string[]`; `prependPath`
  is applied before returning.
- The native target tuple is fixed to glibc Linux, macOS, and Windows on x64
  and ARM64.

Malformed array members, duplicate compatibility entries, unexpected object
keys, invalid stream sequences, and untagged binary values reject explicitly.

## Guard/trust-boundary inventory

The implementation validates, in order: argv/programmatic compatibility and
all argument shapes, enums, ranges, and record values; platform and manifest
metadata; HTTPS/loopback download URLs and redirects; compressed and
executable hashes and sizes; cache paths and acquisition locks; handshake PID,
permissions, token, and loopback URLs; authenticated control headers and body
limits; public proxy request targets; VFS and symlink boundaries; streamed
frame/header size, sequence, and backpressure; private overflow-spool ownership
and cleanup; temporary PHP script ownership; and process-local WAL resource
limits. Native argv-probe stdout and stderr are independently bounded, and its
schema version, exact keys, status, command, port, site URL, exit code, and
message types are checked before the result crosses into the library API. The
publication verifier separately rejects publish metadata,
lifecycle downloads, public URLs, native payloads, `.cwasm`, release assets,
and native CI uploads.

Blueprint bundle method access never invokes an accessor: data-property
methods are captured through a bounded prototype walk before the first await,
and Proxy owners, files, and streams reject. The bundle object is not retained
in the validated argument object. Stream bytes, UTF-8, parsed JSON, translated
preferred versions/constants, and the translated serialized size are all
validated before host acquisition.

Extension selection crosses the npm/Rust boundary as three booleans only.
JavaScript rejects non-booleans (including Xdebug option objects) before host
acquisition, derives only omitted Redis/Memcached values from the JSPI gate,
and serializes explicit false values as `--no-*`; the Rust parser
independently enforces flag arity and command scope, defaults all selections to
false, and copies the immutable selection into every HTTP and CLI worker
constructor. Any enabled selection chooses the extended component variant;
the no-JSPI default path keeps the base component. Guest networking permits DNS and
outbound TCP connect for client parity while TCP bind and UDP remain denied.

CLI crosses three explicit trust boundaries. The npm boundary uses descriptor
inspection only, invokes no getters, rejects proxies whose inspection traps,
and snapshots argv/options/env before its first await. The Rust control
boundary independently enforces command basename, counts, UTF-8 byte budgets,
NUL/environment-name rules, exact fields, and mounted cwd resolution. The C
component boundary copies all strings into owned NUL-terminated buffers,
rejects invalid lists and environment names, applies cwd only after validation,
and permits CLI only once on a fresh instance. For servers, `run-blueprint`,
and `build-snapshot`, `/tmp` and `/internal/shared` are private host-owned 0700
roots; `/tmp` remains guest-writable while `/internal/shared` is guest-read-only.
Nested file and directory mounts are copied into those private roots with
create-new file semantics and symlink-resistant parents; nested symlinks and
special filesystem entries reject. Runtime and
control writes use one shared same-directory atomic-replacement helper,
including `MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)` on Windows.

General filesystem RPC mounts have a narrower guarantee. Paths are normalized,
resolved against the mount table, and checked under the configured symlink
policy, and final `writeFile` replacement is atomic. Recursive `cp` merges
regular-file/directory trees, rejects source and destination symlinks instead
of recreating them, detects physical self-copy through mount aliases, and
notifies runtime configuration tracking for every copied file. Resolution and
use are not held under a directory descriptor or `cap-std` capability,
however, so a concurrent guest or host actor can swap a parent after
validation. `followSymlinks: true` widens that exposure intentionally. The
private, guest-read-only `/internal/shared` root is protected from this class
of guest-controlled parent swap; general user mounts are not claimed to be
TOCTOU-hardened.

Recursive `cp` is a synchronous, non-cancellable control operation. It copies
through the resolved host tree rather than replaying more-specific nested VFS
mount overlays, and it is not transactional: children copied before a later
entry fails remain at the destination. A client disconnect does not roll back
completed filesystem writes.

## Failure and interruption taxonomy

JavaScript and Rust preserve these error families instead of collapsing them
into generic protocol failures: configuration, unsupported behavior, download,
integrity, cache, spawn, startup, authentication, invalid request, request too
large, busy, protocol, I/O, runtime, aborted, and process exit. PHP nonzero
execution retains its structured `PHPExecutionFailureError` response.

Expected argv validation returns `CLIExitResult` with exit code 1; successful
help, version, and supported one-shot execution return exit code 0. Server
startup returns `CLIServerResult`. Unsupported native-v1 capabilities and
genuine acquisition, spawn, signal, startup, protocol, and runtime failures
reject with their structured error family instead of being flattened into a
CLI exit. Only the executable entry point translates child exit and signal
state into process behavior.

Download aborts remove partial files and release locks. Startup failure closes
the proxy, kills the child, and removes the handshake directory. Stream cancel,
disconnect, and output failure interrupt and discard the active lazy stream
Store; the logical worker's fast buffered Store remains available, and a later
stream rebuilds its interruptible companion. The first stream compiles that
epoch-enabled artifact lazily; cancellation is checked before and after this
one-time compile, but cannot interrupt Wasmtime compilation itself.
Stream-spool I/O failures abort with a structured I/O error; consumed,
cancelled, errored, and abandoned spools are removed. SIGINT/SIGTERM handlers
are removed after child completion. Repeated disposal and cancellation after
completion are no-ops, and cleanup never masks the initiating error. Tokens,
authorization headers, child environments, and spool contents must never
appear in errors or logs.

Blueprint read, stream, UTF-8, JSON, and translation failures remain invalid
requests and occur before acquisition. A failed or oversized active Blueprint
stream is cancelled and its reader lock is released; cancellation failure does
not mask the initiating validation error.

CLI failures remain distinguishable: malformed/trapping JavaScript inputs and
invalid Rust shapes are `INVALID_REQUEST`; non-`php` commands are
`UNSUPPORTED`; mount/cwd, copy filesystem-state, and atomic-write failures are
`IO`; component compile, instantiate, trap, or output-channel failures are `RUNTIME`; explicit cancel,
disconnect, and closed full-queue completion are `ABORTED`; and PHP's own
nonzero status is the streamed `exitCode`, not a host transport failure.
Cancellation is checked while waiting for capacity, during output
backpressure, through Wasmtime epoch interruption, and while blocked in
`wasi:io/poll` (including PHP `sleep`). An arbitrary synchronous host operation
may still finish before the Store observes cancellation. A cancelled transient
CLI Store is never reused; its capacity-only or withheld-worker lease is
released, and the next CLI call receives a fresh Store. Queue closure after a
cancel synthesizes exactly one aborted terminal frame, so a client that keeps
reading cannot hang waiting for completion.

## Completion matrix

| Area                  | Completion criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Proof                                                                                                                                                                                                                                                                                                                                                         | Status                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Publication           | No npm/GitHub release path, native release asset, or native CI artifact upload exists.                                                                                                                                                                                                                                                                                                                                                                                                    | `verify:private-boundary` inspects package/project metadata and workflows.                                                                                                                                                                                                                                                                                    | Implemented                   |
| Package metadata      | The private package exposes the bin, ESM/CJS, and types, with no lifecycle or publish scripts.                                                                                                                                                                                                                                                                                                                                                                                            | Package build/tests, boundary verification, and clean `npm pack`/install.                                                                                                                                                                                                                                                                                     | Implemented                   |
| Package contents      | Raw PHP and SQLite/WAL assets are present; host binaries, `.cwasm`, source, and Cargo output are absent.                                                                                                                                                                                                                                                                                                                                                                                  | Source-hash, recursive boundary, and tarball packlist checks.                                                                                                                                                                                                                                                                                                 | Implemented                   |
| Target selection      | Six supported glibc/macOS/Windows architecture targets map exactly; musl and unknown targets reject before download.                                                                                                                                                                                                                                                                                                                                                                      | Manifest unit tests and six-runner CI matrix.                                                                                                                                                                                                                                                                                                                 | Implemented; CI proof pending |
| Acquisition/cache     | Downloads are bounded, verified, atomically installed, concurrency-safe, reusable offline, and repairable.                                                                                                                                                                                                                                                                                                                                                                                | Downloader fault tests plus two-process acquisition/restart tests.                                                                                                                                                                                                                                                                                            | Implemented                   |
| PHP preparation       | npm carries raw Wasm; `runtime install` prewarms both profiles and workers share engine caches.                                                                                                                                                                                                                                                                                                                                                                                           | Package boundary, installed prewarm, and worker-pool smokes.                                                                                                                                                                                                                                                                                                  | Implemented                   |
| Component artifacts   | Clean O2/GOTO PHP 7.4–8.5 base and extended components include zlib/`gzinflate()` and match every digest in the asset manifest; extended components provide the pinned Redis, Memcached, and per-series Xdebug releases.                                                                                                                                                                                                                                                                  | Strict patch application, component validation, manifest verification, direct `sha256sum`, two-clean-build byte comparison, and the full real-protocol runtime matrix.                                                                                                                                                                                        | Verified locally              |
| CLI mechanics         | argv/cwd/env/stdio/signals/exits are preserved and unsupported syntax rejects before acquisition.                                                                                                                                                                                                                                                                                                                                                                                         | Schema preflight, argv-probe, compatibility, installed-bin, and Node CLI regression tests.                                                                                                                                                                                                                                                                    | Implemented                   |
| Library/module        | Result types, disposal, ESM/CJS/declarations/helpers, and bin behavior survive lifecycle-disabled tarball installation.                                                                                                                                                                                                                                                                                                                                                                   | Type/declaration consumer, lifecycle, failure, listener, and installed package smokes.                                                                                                                                                                                                                                                                        | Implemented                   |
| One-shot commands     | Blueprint/snapshot complete natively; nested Studio files are staged in private roots for the command lifetime; the top-level native `php` command remains explicitly unsupported.                                                                                                                                                                                                                                                                                                        | Packaged command smokes, managed-root regressions, and compatibility tests.                                                                                                                                                                                                                                                                                   | Implemented                   |
| Server/Playground API | Server lifecycle plus protocol-v2 request/stream/run/CLI/filesystem/property/event behavior maps without silently accepting message events.                                                                                                                                                                                                                                                                                                                                               | API/control tests, live installed proxy smoke, real CLI/HTTP cancellation tests.                                                                                                                                                                                                                                                                              | Implemented                   |
| PHP CLI ABI           | Fresh components run real PHP CLI with exact argv/env/cwd, bounded live output, exits, Phar/WP-CLI, capacity parity, cancellation, and SAPI isolation.                                                                                                                                                                                                                                                                                                                                    | ABI validator, two byte-identical clean builds, and real-process `-r`/help/error/PHAR/php.ini/concurrency/CPU-loop/sleep-cancel/recovery smoke.                                                                                                                                                                                                               | Verified locally              |
| Studio boundary       | Native compatibility covers PHP 7.4–8.5 and the supported Studio sandbox layouts: Studio selects its offered PHP 8.2–8.5 releases and reopens stored legacy PHP 7.4–8.1 sites. WordPress's post editor and Site Editor, phpMyAdmin, shared sessions, and JSPI-defaulted or explicit Redis/Memcached plus explicit Xdebug selection work on native-package paths; stopped-site/explicit-version WP-CLI, services, Node 22 JSPI gating, and Xdebug option objects retain the Node boundary. | The unchanged child contract plus ordinary `studio create`, `studio start`, editor/phpMyAdmin, running-site `studio wp`, restart, offered-version selection, legacy-version reopen, exact extension versions, and Xdebug selection pass in two fresh bounded reports: unmodified Node 22 base gating and unmodified Node 24 production JSPI/extension gating. | Verified locally              |
| Trust boundaries      | Managed roots resist symlink staging and keep `/internal/shared` guest-read-only; general mount RPCs state their parent-swap limitation.                                                                                                                                                                                                                                                                                                                                                  | Managed-root/no-mutation and real guest-write/symlink tests; filesystem protocol tests.                                                                                                                                                                                                                                                                       | Implemented                   |
| Failure lifecycle     | Acquisition/startup/child/port/cancel/disconnect/disposal failures release resources without hiding the initiating error.                                                                                                                                                                                                                                                                                                                                                                 | Downloader/server lifecycle, auth/protocol/interruption, and clean-install tests.                                                                                                                                                                                                                                                                             | Implemented                   |
| Native compatibility  | Schema-v2 methods/options/exports/events are implemented or rejected as declared; disabled booleans and Studio Blueprint bundles preserve their no-capability shape while descriptor/Proxy/prototype/alias/NUL/stream/mutation bypasses reject.                                                                                                                                                                                                                                           | AST/checker inventories, bypass tests, and Rust compatibility matrix.                                                                                                                                                                                                                                                                                         | Implemented                   |
| WordPress/WAL         | Front end, authenticated post editor and Site Editor, Blueprint/snapshot, concurrency, SQLite locks, xShm/WAL flush, and WAL reopen persistence work.                                                                                                                                                                                                                                                                                                                                     | Installed-package WordPress/editor smokes, Studio matrix, and serial ignored native process suite.                                                                                                                                                                                                                                                            | Verified locally              |
| Benchmark tooling     | Throughput, CPU/request, memory, and Site Editor timings compare to a named baseline with directional thresholds.                                                                                                                                                                                                                                                                                                                                                                         | Python/Node metric tests and `benchmark-regression`.                                                                                                                                                                                                                                                                                                          | Implemented                   |
| Platforms             | The complete target passes on six native runners without uploading fixture hosts or tarballs.                                                                                                                                                                                                                                                                                                                                                                                             | Linux/macOS/Windows x64/arm64 CI matrix.                                                                                                                                                                                                                                                                                                                      | CI verification pending       |

## Required tests

The aggregate verification target executes:

1. `fmt:check`, `lint`, and `typecheck`;
2. default Rust tests and npm unit/integration tests;
3. the serial ignored `native_server` WordPress, concurrency, lock, and WAL
   process suite, including real CLI SAPI/Phar/WP-CLI, help/invalid-option
   flushing, old/new php.ini generations across three eager workers, CLI
   CPU-loop and WASI-sleep cancellation, guest-read-only runtime files,
   fallback `/tmp` file-backed sessions across a worker handoff, and post-cancel
   recovery, plus explicit stream-resource destruction on every PHP version;
4. Python metric tests and Node Site Editor benchmark tests;
5. private metadata, workflow, build-output, and tarball boundary checks;
6. a release native host build and package WordPress/Blueprint/snapshot smokes;
7. installation of the local tarball with lifecycle scripts disabled;
8. concurrent first acquisition, offline restart, both-profile runtime prewarm,
   installed ESM/CJS/bin checks, and a live Node proxy/control smoke that calls
   `playground.cli()` and verifies argv environment, cwd, both output channels,
   and exit code; and
9. AST/checker drift checks against the upstream root exports, public common
   server/worker surfaces, option objects, command scopes, and every yargs
   boolean-negation and camel-case alias; descriptor/prototype/NUL/limit and
   pre-await caller-mutation bypass tests; native argv-probe schema, output
   bounds, validation/result, server disposal, listener-cleanup, extension
   default/positive/negative selection, Xdebug-object rejection, base/extended
   component routing, and TCP-connect/bind/UDP policy tests; and
10. the existing `playground-cli:test-playground-cli` regression target.

The repository gate validates the resolved
`wordpress:php-wasi/cli@0.1.0` export and exact argv/env/cwd/run field types,
plus the manifest entries and on-disk SHA-256 digests for all fourteen base and
extended components. Its component matrix also opens and explicitly releases a
stream resource on every PHP version; this guards PHP 7.4's signature-safe WASI
resource destructor. Applying every PHP patch to a clean pinned source archive
and comparing two clean build hashes for each version and variant is a separate
manual artifact-acceptance proof; it is not part of the Nx verification target.
The asset manifest is authoritative for the accepted SHA-256 digest of every
final component.
The external Studio tarball declaration typecheck and runtime harness are
separate from Nx. Fresh bounded reports from the same retained tarball, native
host fixture, and WP-CLI Phar pass under unmodified Node 22 and Node 24. The
harness proves 12 unchanged Studio child-contract stages and exercises a built
ordinary `studio` CLI creating a fresh sandbox, installing WordPress on first
start, rendering the front end, authenticated post editor, Site Editor, and
phpMyAdmin database tables, mutating state through `studio wp`, and preserving
WordPress, editor, phpMyAdmin, and SQLite state across stop/start. It also proves
Studio selection of PHP 8.2–8.5 and reopening stored legacy configurations on
PHP 7.4–8.1. Under unmodified Node 22 it verifies Studio's real base-component
gate with Redis and Memcached absent. Under Node 24 it starts isolated loopback
Redis and Memcached services and requires real protocol round trips through both
HTTP and `studio wp` for every PHP version. Both modes enable and observe Xdebug
through both paths. The Node 22 and Node 24 reports both have status `PASS`.

## Verification commands

Run the complete current-platform gate from the repository root:

```bash
npm exec -- nx run playground-cli-native:verify --output-style=stream
npm exec -- nx run playground-cli-native:verify:installed-package --output-style=stream
```

Run the full Studio proof twice from the Studio checkout with npm 11.13, using
the same final tarball, host fixture, and WP-CLI phar. First use unmodified Node
22 and write a base-gate report; then use Node 24 with `redis-server` and
`memcached` on `PATH` and write a production-JSPI report:

```bash
npm run cli:test-native-integration -- \
  --native-package-tarball /absolute/path/to/wp-playground-cli-native.tgz \
  --native-host-fixture /absolute/path/to/wp-playground-native-<target>.gz \
  --wp-cli-phar /absolute/path/to/wp-cli.phar \
  --log /absolute/path/to/verify-node22.log

# Repeat under Node 24 with redis-server and memcached on PATH.
npm run cli:test-native-integration -- \
  --native-package-tarball /absolute/path/to/wp-playground-cli-native.tgz \
  --native-host-fixture /absolute/path/to/wp-playground-native-<target>.gz \
  --wp-cli-phar /absolute/path/to/wp-cli.phar \
  --log /absolute/path/to/verify-node24.log
```

Both successful current reports have status `PASS` and contain passing entries
for the unchanged `playground-server-child` contract and the ordinary
`studio create`/`studio start`/WordPress editors/phpMyAdmin/`studio wp`/
`studio stop`/restart/PHP-version/Xdebug workflow. The Node 22 report records
the actual disabled network-extension gate; the Node 24 report records the
actual JSPI-enabled Redis and Memcached round trips.

During PHP CLI development, the focused evidence is:

```bash
for version in 7.4 8.0 8.1 8.2 8.3 8.4 8.5; do
  for variant in base extended; do
    PHP_WASI_PHP_VERSION="$version" PHP_WASI_VARIANT="$variant" \
      packages/php-wasm/compile/php-wasi/verify-published.sh
  done
done
nix --extra-experimental-features 'nix-command flakes' \
  shell nixpkgs#redis nixpkgs#memcached -c \
  packages/playground/cli-native/scripts/verify-php-runtime-matrix.sh
cargo test --manifest-path packages/playground/cli-native/Cargo.toml \
  control::tests -- --test-threads=1
cargo test --manifest-path packages/playground/cli-native/Cargo.toml \
  --test native_server native_control_runs_real_php_cli_sapi_with_phar_loaded \
  -- --ignored --exact --nocapture
cargo test --manifest-path packages/playground/cli-native/Cargo.toml \
  --test native_server \
  native_server_default_temp_sessions_survive_worker_handoffs_and_keep_pool_usable \
  -- --ignored --exact
npm exec -- vitest run --config packages/playground/cli-native/npm/vite.config.ts \
  packages/playground/cli-native/npm/tests/control.spec.ts \
  packages/playground/cli-native/npm/tests/compatibility.spec.ts
npm exec -- tsc -p packages/playground/cli-native/npm/tsconfig.json --noEmit
npm exec -- nx run playground-cli-native:verify:installed-package --output-style=stream
```

Before accepting component hashes, provision the pinned WASI SDK, PHP 8.2 host
tool, `wit-bindgen`, `wasm-tools`, autoconf, bison, re2c, and pkg-config, then
run the independent manual proof for every version and variant:

```bash
for version in 7.4 8.0 8.1 8.2 8.3 8.4 8.5; do
  for variant in base extended; do
    for run in a b; do
      PHP_WASI_PHP_VERSION="$version" PHP_WASI_VARIANT="$variant" \
      BUILD_DIR="/tmp/php-wasi-$version-$variant-$run" \
      DIST_DIR="/tmp/php-wasi-dist-$version-$variant-$run" \
        packages/php-wasm/compile/php-wasi/build.sh
    done
    cmp "/tmp/php-wasi-dist-$version-$variant-a/"*.wasm \
      "/tmp/php-wasi-dist-$version-$variant-b/"*.wasm
    cmp /tmp/php-wasi-dist-$version-$variant-a/libphp*.a \
      /tmp/php-wasi-dist-$version-$variant-b/libphp*.a
    cmp "/tmp/php-wasi-dist-$version-$variant-a/libsqlite3.a" \
      "/tmp/php-wasi-dist-$version-$variant-b/libsqlite3.a"
  done
done
```

Only after `cmp` succeeds should `assets/php-assets.json` be updated and the Nx
gates rerun. None of these commands publish or upload anything.

The six-platform CI matrix runs this exact target. Performance benchmarks are
intentionally separate from the deterministic correctness gate. Compare a
candidate with the accepted baseline using:

```bash
npm exec -- nx run playground-cli-native:benchmark-regression -- \
  --baseline-ref=66c69684 --candidate-ref=HEAD --max-regression-pct=5
```

The gate covers public, mixed, and admin throughput and CPU/request; warm-idle
PSS, peak PSS, and peak cgroup memory; and Site Editor TTFB, first meaningful
paint, and fully loaded time. Test tarballs, fixture hosts, caches, install
roots, and benchmark worktrees stay in temporary runner directories and are
never uploaded.
