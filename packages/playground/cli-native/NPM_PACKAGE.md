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

## Compatibility boundary

`compatibility.json` is authoritative for native commands, programmatic
options, CLI flags, package exports, server members, worker methods, and
events. Programmatic options and CLI flags remain separate inventories because
their names and command applicability differ. Unsupported capabilities must
return an explicit error before downloading or spawning the native host; they
must never be accepted and ignored. Tests compare these inventories with the
upstream CLI declarations and the Rust parser so additions cannot drift
silently.

The executable npm entry point and `parseOptionsAndRunCLI()` share the same
schema-driven argv preflight. It recognizes direct flags, `--flag=value`, and
every yargs-generated `--no-*` and camel-case spelling. It snapshots a dense
ordinary argv array, rejects malformed commands and declared command-scope
mismatches, and never treats `--` as a way around compatibility checks. Full
value and arity parsing for supported flags remains the Rust parser's
responsibility. The library calls a private schema-v1 argv probe in the native
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
`request.error`, and `filesystem.write` events. PHP worker `message` events
are not implemented; `runtime.initialized`, `runtime.beforeExit`, `message`,
and `onMessage()` reject explicitly instead of installing inert listeners.

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
through a bounded eight-frame queue. Cancellation interrupts and recycles only
the active PHP worker. The Node client keeps eight frames per output channel in
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

The native v1 `playground` API supports:

- `request`, real incremental `requestStreamed`, and `run`;
- `mkdir`, `mkdirTree`, `readFileAsText`, `readFileAsBuffer`, `writeFile`,
  `unlink`, `mv`, recursive `rmdir`, `listFiles`, `isDir`, `isFile`, and
  `fileExists`;
- `chdir`, `cwd`, `defineConstant`, `pathToInternalUrl`, and
  `internalUrlToPath`; and
- supported event listeners and asynchronous disposal.

## Non-goals

`cli`, `onMessage`, runtime hot-swapping, Emscripten worker construction,
dynamic PHP extensions, guest networking, Blueprint v2, and cross-process WAL
coordination are explicit non-goals for native v1.

## Array-shape documentation inventory

- `RunCLIArgs._` preserves positional token order; index zero is normally the
  command. It must be a dense, ordinary array of strings with no extra keys.
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

## Completion matrix

| Area                 | Completion criterion                                                                                                                                                                                                                                                                                             | Automated proof                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publication          | No npm/GitHub release configuration, native release asset, or native CI artifact upload exists.                                                                                                                                                                                                                  | `verify:private-boundary` inspects package/project metadata and both workflows.                                                                                                   |
| Package metadata     | The package is private, exposes the `wp-playground-cli` bin plus ESM/CJS/types, and has no lifecycle or publish scripts.                                                                                                                                                                                         | Vite build, package tests, boundary verification, and clean `npm pack`/install.                                                                                                   |
| Package contents     | Raw PHP and SQLite/WAL assets are present; host executable, `.cwasm`, source, and Cargo output are absent.                                                                                                                                                                                                       | Build-time source hashes, recursive boundary checks, and tarball packlist checks.                                                                                                 |
| Target selection     | Linux x64/arm64 glibc, macOS x64/arm64, and Windows x64/arm64 map exactly; musl and unknown targets reject before download.                                                                                                                                                                                      | Manifest unit tests plus the six-runner CI matrix.                                                                                                                                |
| Acquisition          | The fixture host is size-bounded, double-hashed, decompressed, permissioned, and atomically installed; redirects cannot downgrade to non-loopback HTTP.                                                                                                                                                          | Downloader integrity, redirect, truncation, oversize, and malformed-lock tests.                                                                                                   |
| Cache behavior       | Concurrent first launches perform one download; valid offline reuse works; corrupt files are repaired.                                                                                                                                                                                                           | Eight-way unit concurrency plus two-process clean-install concurrency and offline restart.                                                                                        |
| PHP preparation      | The npm payload contains raw Wasm only; `runtime install` prewarms both Wasmtime profiles and workers share the engine caches.                                                                                                                                                                                   | Package boundary plus installed `runtime install` and native worker-pool smokes.                                                                                                  |
| CLI mechanics        | argv, cwd, environment, stdio, signals, exit codes, supported parsing, and explicit unsupported diagnostics are preserved; unsupported commands, direct flags, `--flag=value`, and yargs `--no-*`/camel-case/mixed aliases reject before host acquisition.                                                       | Schema-driven preflight tests, native argument/compatibility tests, lifecycle-disabled installed-bin preflight with no host URL/cache creation, and existing Node CLI regression. |
| Library results      | Rust remains the authoritative argv parser; expected validation and successful one-shot calls return `CLIExitResult`, servers return a real disposable `CLIServerResult`, and genuine process/runtime failures reject without process termination or persistent signal listeners.                                | Native argv-probe tests, exact-schema/bounded-output process tests, result narrowing, server-wrapper disposal, failure propagation, and listener-cleanup tests.                   |
| Module mechanics     | ESM import, CommonJS require, declarations, helpers, and the bin work from a lifecycle-disabled tarball install.                                                                                                                                                                                                 | Vite declaration rollup, TypeScript, `npm install --ignore-scripts`, and installed ESM/CJS/bin smokes.                                                                            |
| One-shot commands    | Blueprint and snapshot commands finish after native completion; `php` remains an explicit native-v1 incompatibility.                                                                                                                                                                                             | Packaged Blueprint/snapshot smokes and compatibility parser tests.                                                                                                                |
| Server API           | `RunCLIServer` returns the real Node server and proxy URL, RPC worker, native count, and idempotent disposer; start/server port semantics match Node.                                                                                                                                                            | Server API lifecycle/port tests plus a live installed two-worker proxy smoke.                                                                                                     |
| Playground API       | Request, genuinely incremental streamed request, run, multipart and binary values, filesystem methods, properties, lifecycle events, and structured PHP failures map across protocol v2; message events reject explicitly.                                                                                       | Control-client and API-contract tests, Rust control tests, cancellation tests, and the live installed RPC smoke.                                                                  |
| Failure lifecycle    | Download/integrity, acquisition lock, host startup, handshake timeout, child exit, occupied port, stream cancellation/disconnect, and repeated disposal release their resources without masking the initiating error.                                                                                            | Downloader and server lifecycle tests, Rust auth/protocol/interruption tests, and clean-install cleanup.                                                                          |
| Native compatibility | Every command, option, root export, server member, externally accessible common worker method, and event in schema-v2 `compatibility.json` is implemented or rejected with its declared diagnostic; snapshots close accessor, prototype, alias, delimiter, NUL, and caller-mutation bypasses before acquisition. | TypeScript AST/checker inventories and bypass/TOCTOU tests plus Rust compatibility-matrix tests.                                                                                  |
| WordPress/WAL        | WordPress HTTP/editor, Blueprint, snapshot, concurrent worker, SQLite lock, xShm/WAL flush, and WAL reopen persistence paths pass.                                                                                                                                                                               | Packager smokes plus serial ignored `native_server` process tests.                                                                                                                |
| Benchmark tooling    | Throughput, CPU/request, warm/peak memory, and Site Editor timings can be compared against a named baseline with direction-aware thresholds; the candidate stays within 5% of `66c69684`.                                                                                                                        | Python/Node metric tests plus `benchmark-regression` result comparison and its fixture tests.                                                                                     |
| Platforms            | The same complete target passes on all six native runners without uploading its fixture host or tarball.                                                                                                                                                                                                         | Native CI matrix: Linux, macOS, and Windows on x64 and arm64.                                                                                                                     |

## Required tests

The aggregate verification target executes:

1. `fmt:check`, `lint`, and `typecheck`;
2. default Rust tests and npm unit/integration tests;
3. the serial ignored `native_server` WordPress, concurrency, lock, and WAL
   process suite;
4. Python metric tests and Node Site Editor benchmark tests;
5. private metadata, workflow, build-output, and tarball boundary checks;
6. a release native host build and package WordPress/Blueprint/snapshot smokes;
7. installation of the local tarball with lifecycle scripts disabled;
8. concurrent first acquisition, offline restart, both-profile runtime prewarm,
   installed ESM/CJS/bin checks, and a live Node proxy/control smoke; and
9. AST/checker drift checks against the upstream root exports, public common
   server/worker surfaces, option objects, command scopes, and every yargs
   boolean-negation and camel-case alias; descriptor/prototype/NUL/limit and
   pre-await caller-mutation bypass tests; native argv-probe schema, output
   bounds, validation/result, server disposal, and listener-cleanup tests; and
10. the existing `playground-cli:test-playground-cli` regression target.

## Verification commands

Run the complete current-platform gate from the repository root:

```bash
npm exec -- nx run playground-cli-native:verify --output-style=stream
```

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
