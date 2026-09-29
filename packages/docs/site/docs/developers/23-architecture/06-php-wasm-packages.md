---
title: PHP.wasm packages
slug: /developers/architecture/php-wasm-packages
description: Learn how the shared API, platform adapters, and version-specific PHP.wasm packages fit together.
---

# PHP.wasm packages

The PHP.wasm npm packages separate the shared JavaScript API, platform-specific
setup, and compiled PHP binaries. Most applications should use a platform
adapter. Applications that prioritize a smaller installation can instead load
one version-specific package through the lower-level API.

## Package layers

| Package                                      | Responsibility                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@php-wasm/universal`                        | Provides the environment-independent `PHP` class, `loadPHPRuntime()`, and shared request and filesystem APIs. It does not select a Node.js or browser build. |
| `@php-wasm/node`                             | Provides `loadNodeRuntime(version)` and Node.js-specific runtime setup, including networking, file locking, and filesystem helpers.                          |
| `@php-wasm/web`                              | Provides `loadWebRuntime(version)` and browser-specific runtime, networking, storage, and worker helpers.                                                    |
| `@php-wasm/node-X-Y` and `@php-wasm/web-X-Y` | Contain the WebAssembly binaries and loaders for one PHP minor version, plus version-matched extension artifacts where available.                            |

An application creates the `PHP` object from `@php-wasm/universal`. The Node.js
or web adapter configures the environment, selects a PHP version, and imports
the corresponding version package. For example, `loadNodeRuntime('8.4')`
selects `@php-wasm/node-8-4`.

The API uses dotted versions such as `8.4`, while npm package names use a
hyphenated suffix such as `8-4`.

## Convenient platform loaders

Use a platform adapter when you need its runtime integrations or may select
different PHP versions at runtime. For Node.js:

```bash
npm install @php-wasm/universal @php-wasm/node
```

```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.4'));
```

In a browser, use `@php-wasm/web` and `loadWebRuntime('8.4')` instead.

The platform adapters can dispatch to every supported PHP version, and their
published dependency graph includes the corresponding version packages. This
is convenient, but it is not the smallest installation when an application
only needs one PHP version.

## Load one PHP version directly

For the smallest dependency footprint, omit the platform adapter and install
`@php-wasm/universal` with one version-specific package:

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

These packages are published together. Keep their npm release versions
aligned.

Then load its compiled module through the low-level API:

```js
import { PHP, loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from '@php-wasm/node-8-4';

const loaderModule = await getPHPLoaderModule();
const runtimeId = await loadPHPRuntime(loaderModule);
const php = new PHP(runtimeId);

const response = await php.runStream({
	code: '<?php echo "Hello from PHP " . PHP_VERSION;',
});
console.log(await response.stdoutText);
```

For a browser build, use the corresponding package, such as
`@php-wasm/web-8-4`, with the same `getPHPLoaderModule()` and
`loadPHPRuntime()` flow. Configure the browser bundler to emit imported
`.wasm` and `.so` files as assets, as described in the
[`@php-wasm/web` bundler guidance](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adapt package references in that configuration to the version-specific name;
for example, exclude `@php-wasm/web-8-4` instead of `@php-wasm/web`.

Here, a smaller footprint means installing one PHP minor version instead of
the full supported matrix. Each version package still includes the compiled
variants and version-matched artifacts required for that PHP version.

This direct approach is intentionally lower-level. It bypasses the setup
performed by `loadNodeRuntime()` or `loadWebRuntime()`, including platform
networking, Node.js file locking, extension loading, and other
environment-specific integrations. Use it when the shared `PHP` API and
in-memory filesystem are sufficient, or when your application supplies the
required Emscripten configuration itself.

See the [supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
to choose the matching package suffix.

## Which approach should you choose?

- Use `@php-wasm/node` or `@php-wasm/web` for platform-specific runtime setup,
  helpers, and the simplest version-selection API.
- Load `@php-wasm/node-X-Y` or `@php-wasm/web-X-Y` directly when installation
  size matters more than the platform adapter's conveniences.
