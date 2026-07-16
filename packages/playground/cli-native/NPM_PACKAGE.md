# Private `@wp-playground/cli-native` package

This package is an unpublished integration experiment. It exercises the npm
launcher and JavaScript API without publishing an npm package, a native host,
or a CI artifact.

## Distribution boundary

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

`compatibility.json` is authoritative for native commands, options, and
Blueprint steps. Unsupported capabilities must return an explicit error; they
must never be accepted and ignored.

The npm package mirrors the public JavaScript surface of
`@wp-playground/cli` for the native capability subset:

- `runCLI` and `parseOptionsAndRunCLI`;
- `LogVerbosity`, `resolveWorkerCount`, and `mergeDefinedConstants`;
- `internalsKeyForTesting`; and
- the `RunCLIArgs`, `RunCLIServer`, `PlaygroundCliWorker`, and `WorkerType`
  types.

`spawnWorkerThread` and `SpawnedWorker` are intentionally excluded because
they expose the Emscripten implementation rather than the CLI contract.
The control bridge exposes `ready` and `shutdown` lifecycle events. PHP worker
`message` events are not implemented; `onMessage()` and message-event
subscriptions reject explicitly instead of installing inert listeners.

For `start` and `server`, `runCLI()` returns a real Node `http.Server`, its URL,
an authenticated native Playground RPC proxy, the native worker count, and an
idempotent asynchronous disposer. The Node server proxies the public port to
the native server's private loopback listener. Direct command-line execution
does not use this proxy.

The native control listener is loopback-only and requires a random bearer
token. Its temporary handshake contains protocol version, control and site
URLs, PID, document root, and worker count. The handshake lives in a private
temporary directory, and the client verifies its PID and loopback endpoints.
The token is removed from the host environment before any browser process can
be spawned and must never be logged.

Control requests are authenticated before body allocation, limited to 64
concurrent connections, and capped at 128 MiB of encoded JSON. Base64 leaves
roughly 96 MiB for one binary `writeFile()` or request payload; larger payloads
receive HTTP 413 until a future streaming-file protocol is added.

## Completion matrix

| Area                 | Completion criterion                                                                                                                                                                    | Automated proof                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Publication          | No npm/GitHub release configuration, native release asset, or native CI artifact upload exists.                                                                                         | `verify:private-boundary` inspects package/project metadata and both workflows.                                 |
| Package metadata     | The package is private, exposes the `wp-playground-cli` bin plus ESM/CJS/types, and has no lifecycle or publish scripts.                                                                | Vite build, package tests, boundary verification, and clean `npm pack`/install.                                 |
| Package contents     | Raw PHP and SQLite/WAL assets are present; host executable, `.cwasm`, source, and Cargo output are absent.                                                                              | Build-time source hashes, recursive boundary checks, and tarball packlist checks.                               |
| Target selection     | Linux x64/arm64 glibc, macOS x64/arm64, and Windows x64/arm64 map exactly; musl and unknown targets reject before download.                                                             | Manifest unit tests plus the six-runner CI matrix.                                                              |
| Acquisition          | The fixture host is size-bounded, double-hashed, decompressed, permissioned, and atomically installed; redirects cannot downgrade to non-loopback HTTP.                                 | Downloader integrity, redirect, truncation, oversize, and malformed-lock tests.                                 |
| Cache behavior       | Concurrent first launches perform one download; valid offline reuse works; corrupt files are repaired.                                                                                  | Eight-way unit concurrency plus two-process clean-install concurrency and offline restart.                      |
| PHP preparation      | The npm payload contains raw Wasm only; `runtime install` prewarms both Wasmtime profiles and workers share the engine caches.                                                          | Package boundary plus installed `runtime install` and native worker-pool smokes.                                |
| CLI mechanics        | argv, cwd, environment, stdio, signals, exit codes, supported parsing, and explicit unsupported diagnostics are preserved.                                                              | Process tests, native argument/compatibility tests, installed bin invocation, and existing Node CLI regression. |
| Module mechanics     | ESM import, CommonJS require, declarations, helpers, and the bin work from a lifecycle-disabled tarball install.                                                                        | Vite declaration rollup, TypeScript, `npm install --ignore-scripts`, and installed ESM/CJS/bin smokes.          |
| One-shot commands    | Blueprint and snapshot commands finish after native completion; `php` remains an explicit native-v1 incompatibility.                                                                    | Packaged Blueprint/snapshot smokes and compatibility parser tests.                                              |
| Server API           | `RunCLIServer` returns the real Node server and proxy URL, RPC worker, native count, and idempotent disposer; start/server port semantics match Node.                                   | Server API lifecycle/port tests plus a live installed two-worker proxy smoke.                                   |
| Playground API       | Request, buffered streamed request, run, filesystem, binary values, properties, lifecycle events, and structured PHP failures map across protocol v1; message events reject explicitly. | Control client tests, Rust control tests, and the live installed RPC smoke.                                     |
| Failure lifecycle    | Download/integrity, acquisition lock, host startup, handshake timeout, child exit, occupied port, and repeated disposal release their resources.                                        | Downloader and server lifecycle tests, Rust auth/protocol tests, and clean-install cleanup.                     |
| Native compatibility | Every `compatibility.json` entry is either parsed as supported or rejected with its declared diagnostic.                                                                                | Rust compatibility-matrix tests.                                                                                |
| WordPress/WAL        | WordPress HTTP/editor, Blueprint, snapshot, concurrent worker, SQLite lock, xShm/WAL flush, and WAL reopen persistence paths pass.                                                      | Packager smokes plus serial ignored `native_server` process tests.                                              |
| Benchmark tooling    | Site Editor metrics and table/report helpers remain deterministic.                                                                                                                      | Python benchmark-metric tests and Node Site Editor benchmark tests.                                             |
| Platforms            | The same complete target passes on all six native runners without uploading its fixture host or tarball.                                                                                | Native CI matrix: Linux, macOS, and Windows on x64 and arm64.                                                   |

## Required test groups

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
9. the existing `playground-cli:test-playground-cli` regression target.

Run the complete current-platform gate from the repository root:

```bash
npm exec -- nx run playground-cli-native:verify --output-style=stream
```

The six-platform CI matrix runs this exact target. Performance benchmarks are
intentionally separate from the deterministic correctness gate. Test tarballs,
fixture hosts, caches, and install roots stay in temporary runner directories
and are never uploaded.
