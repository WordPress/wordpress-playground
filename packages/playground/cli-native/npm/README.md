# `@wp-playground/cli-native`

This is a private, experimental command-line replacement for
`@wp-playground/cli`. It is developed and tested as part of the repository but
is not published to npm or any other package registry.

The package contains the portable PHP WASIp2 component and SQLite integration.
It deliberately contains no platform executable and no precompiled `.cwasm`.
Set `WP_PLAYGROUND_NATIVE_HOST_BASE_URL` to a controlled HTTPS location (or a
loopback integration-test server) containing the exact host named by
`native-host-manifest.json`.

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
no-capability value; enabled and unknown options still reject. See
`compatibility.json` for the CLI contract.

The returned Playground worker implements `cli(argv, { env, cwd })` for PHP
commands. It exposes a streamed PHP response with live stdout/stderr, the real
CLI exit code, PHAR/WP-CLI support, bounded backpressure, and cancellation.
Commands other than a basename-exact `php` reject before crossing the control
boundary.

For WordPress Studio integration, the current native path is intentionally
narrow: PHP 8.2, the exact supported Studio mount layout, and no phpMyAdmin,
Redis, or Memcached/JSPI features. Blueprint resources adjacent to the
Blueprint file are not resolved yet. Callers must retain the Node Playground
path for configurations outside that boundary.
