# Cloudflare Workers PHP-WASM memory gate

This isolated experiment is the first acceptance gate for [issue #69](https://github.com/WordPress/wordpress-playground/issues/69). It loads the current PHP 8.5.8 Asyncify artifact, executes PHP, and returns deterministic JSON. It does not include WordPress, SQLite, Durable Objects, R2, MDI, or persistent storage.

The Worker imports `packages/php-wasm/web-builds/8-5/asyncify/php_8_5.js` and passes Wrangler's precompiled import of its `8_5_8/php_8_5.wasm` file to the loader's `instantiateWasm` hook. This avoids browser XHR/fetch acquisition and satisfies workerd's precompiled-Wasm contract. The binary remains owned by the PHP-WASM build and is not copied here.

## Setup and local development

The root dependency graph is required because the Worker imports source from the monorepo's PHP-WASM packages. Use Node 22 from `.nvmrc`:

```sh
nvm use
npm ci
npm exec -- wrangler dev --config packages/playground/cloudflare-worker/wrangler.jsonc
```

Local workerd is useful for loader and response wiring only. It is not evidence that the remote Cloudflare isolate stays within its memory limit.

The remote ZIP probe exercises range decoding across many PHP, JSON, HTML, CSS,
JavaScript, font, and image entries from the current WordPress archive. Use an
isolated persistence directory to avoid reusing incompatible Miniflare state:

```sh
npm exec -- wrangler dev --config packages/playground/cloudflare-worker/wrangler.jsonc --persist-to /tmp/playground-cloudflare-worker
curl --fail --show-error 'http://127.0.0.1:8787/?probe=remote-zip'
```

Success returns `includesVersion: true` and at least 100 `decodedEntries`.

## Remote acceptance gate

Package without deploying:

```sh
npm exec -- wrangler deploy --dry-run --config packages/playground/cloudflare-worker/wrangler.jsonc
```

Upload an authenticated preview version without routing production traffic:

```sh
npm exec -- wrangler versions upload --preview-alias memory-gate --config packages/playground/cloudflare-worker/wrangler.jsonc
```

Wrangler prints the versioned and aliased preview URLs after the upload. The Worker must already exist, and Cloudflare authentication plus a paid Workers plan are required because this bundle exceeds the free plan's compressed Worker size limit.

For a normal account deployment, authenticate separately and run:

```sh
npm exec -- wrangler deploy --config packages/playground/cloudflare-worker/wrangler.jsonc
```

Call the URL printed by Wrangler with a unique `run` query parameter. Success is JSON with `marker` equal to `cloudflare-php-wasm-memory-gate`, a PHP 8.5.8 `php_version`, and request/isolate correlation fields. Only that real remote response is a memory acceptance result for issue #69. An isolate-memory deployment or request failure is negative evidence.

Cloudflare intentionally freezes `performance.now()` and `Date.now()` during CPU and Wasm execution, so in-Worker elapsed timers are not valid performance evidence. Stream preview logs in another terminal and correlate each request's unique `run` query value with Cloudflare's authoritative invocation `CPUTimeMs` and `WallTimeMs`. The response's `isolate_id` and `initialized_for_request` identify cold and warm execution:

```sh
npm exec -- wrangler tail playground-php-wasm-memory-gate --format json
curl --fail --show-error 'https://<preview-url>/?run=cold-1'
curl --fail --show-error 'https://<preview-url>/?run=warm-1'
```

Repeated requests may reach different isolates. A response with `initialized_for_request: false` proves warm reuse of the named `isolate_id`; a later cold isolate does not by itself prove memory eviction.

Clean up a normal deployment after recording the result:

```sh
npm exec -- wrangler delete playground-php-wasm-memory-gate
```

## Limits under test

The raw PHP 8.5 Asyncify Wasm artifact is 21,019,221 bytes (about 20.0 MiB), below Cloudflare's 25 MiB individual static asset limit. This Worker intentionally uses a Wasm module import rather than Static Assets because the Emscripten loader needs a synchronous `WebAssembly.Module` in its `instantiateWasm` callback. Cloudflare's compressed Worker bundle limit still applies; record the dry-run compressed size alongside the raw Wasm size. The remote isolate memory limit remains the only acceptance gate.
