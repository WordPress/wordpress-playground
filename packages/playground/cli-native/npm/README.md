# `@wp-playground/cli-native`

This is a private, experimental command-line replacement for
`@wp-playground/cli`. It is developed and tested as part of the repository but
is not published to npm or any other package registry.

The package contains the portable PHP 7.4–8.5 WASIp2 components and SQLite
integration. Every base and extended component includes zlib and
`gzinflate()`, which WordPress's HTTP client requires.
It deliberately contains no platform executable and no precompiled `.cwasm`.
Set `WP_PLAYGROUND_NATIVE_HOST_BASE_URL` to a controlled HTTPS location (or a
loopback integration-test server) containing the exact host named by
`native-host-manifest.json`.

An explicitly experimental GitHub prerelease may provide this private npm
tarball together with separate macOS x64 and ARM64 gzip host assets. Install
the tarball by URL and set `WP_PLAYGROUND_NATIVE_HOST_BASE_URL` to that
prerelease's download directory, including the trailing slash. This does not
make the package public on npm, does not configure a default production host,
and does not place a native executable inside the npm package.

```bash
wp-playground-cli runtime install
wp-playground-cli start --skip-browser
```

The first command downloads, verifies, caches, and asks the custom
`wp-playground-native` host to prewarm PHP. It never downloads the generic
Wasmtime CLI. Normal commands perform the same setup lazily.

The JavaScript API mirrors the supported subset of `@wp-playground/cli`.
Unsupported features reject with `ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED`; they
are never silently ignored. The bin and `parseOptionsAndRunCLI()` apply the
same `compatibility.json` preflight before host acquisition, including
`--flag=value` and yargs-generated `--no-*` and camel-case aliases. Supported
flag value parsing remains native. Mixed camel/negation forms are normalized
only far enough to reject the known option family; they are not accepted or
enumerated. `parseOptionsAndRunCLI()` uses the native host's no-runtime,
schema-v1 argv probe and returns a `CLIExitResult` for validation and one-shot
commands or an async-disposable `CLIServerResult` for `start` and `server`;
library calls never terminate the Node process. Programmatic calls
synchronously snapshot and validate
plain-object, dense-array, Blueprint, mount, constant, enum, numeric,
command-scope, NUL, 256-worker, and Blueprint-size/depth constraints before
acquisition. Studio's readable Blueprint bundle shape is accepted by reading
only its bounded, strict-UTF-8 `/blueprint.json`; supported top-level preferred
versions and constants are translated to native arguments and steps. The
schema's explicitly listed unsupported booleans accept only `false` as a
no-capability value; enabled and unknown options still reject. Omitted Redis
and Memcached selections follow the Node CLI's JSPI gate; direct library calls
use current `WebAssembly.Suspending` support, and the executable emulates the
successful Node 23+ JSPI respawn. Explicit `true` and `false` are preserved as
`--<name>` or `--no-<name>`. Xdebug defaults off. Xdebug configuration
objects reject before acquisition because native v1 has no deterministic
mapping for their settings. The executable honors the upstream respawn
opt-out, Bun/Deno exclusion, and already-attempted experimental-flag guard.
See `compatibility.json` for the CLI contract.

The returned Playground worker implements `cli(argv, { env, cwd })` for PHP
commands. It exposes a streamed PHP response with live stdout/stderr, the real
CLI exit code, PHAR/WP-CLI support, bounded backpressure, and cancellation.
Commands other than a basename-exact `php` reject before crossing the control
boundary.

For WordPress Studio integration, the current native path supports PHP 7.4,
8.0, 8.1, 8.2, 8.3, 8.4, and 8.5 with the supported Studio sandbox filesystem
layouts. Studio currently offers PHP 8.2–8.5 for new selections and reopens
stored legacy sandbox sites on PHP 7.4–8.1.
phpMyAdmin is supported when Studio mounts its bundle at `/tools/phpmyadmin`;
the native host serves it at the requested URL prefix and shares its
file-backed sessions across workers. The bundled Redis and Memcached PHP client
extensions follow Node/JSPI default selection, but native v1 does not launch
their services. Bundled Xdebug accepts boolean selection;
Xdebug option objects remain unsupported. Guest TCP connect and DNS lookup are
enabled; TCP bind and UDP remain denied. Blueprint resources adjacent to the
Blueprint file are not resolved yet. Callers must retain the Node Playground
path for configurations outside that boundary.

Unmodified Studio requests Redis and Memcached only when its JSPI capability
gate succeeds. Node 24 supplies that production gate; Node 22 continues to use
the base component unless a test-only Studio harness override is applied. That
override proves argument plumbing only and does not add Node 22 production
support.
