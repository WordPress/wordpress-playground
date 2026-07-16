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
enumerated. Programmatic calls synchronously snapshot and validate
plain-object, dense-array, Blueprint, mount, constant, enum, numeric,
command-scope, NUL, 256-worker, and Blueprint-size/depth constraints before
acquisition. See `compatibility.json` for the CLI contract.
