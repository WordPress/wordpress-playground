---
title: Building PHP extensions
slug: /developers/apis/javascript-api/build-php-extensions
description: Build PHP extension source directories into PHP.wasm .so artifacts and manifests.
---

# Building PHP extensions

Use `@php-wasm/compile-extension` when you have a `phpize` extension source
directory and want a distributable PHP.wasm `.so` plus a manifest that
`loadNodeRuntime()` and `loadWebRuntime()` can load before PHP starts.

The source directory must contain a normal PHP extension build recipe, usually
`config.m4` and the C or C++ files referenced from it.

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.4 \
	--out ./dist/wp_mysql_parser
```

Docker is required. The helper reuses the PHP.wasm compile image, builds a
matching PHP source tree, and runs `phpize`, `emconfigure`, and `emmake` with
the side-module flags expected by PHP.wasm.

Custom extensions are built for JSPI runtimes. The helper does not build
Asyncify side modules.

## Output

The output directory contains one JSPI artifact for each PHP version plus
`manifest.json`:

```text
dist/wp_mysql_parser/
|-- manifest.json
`-- wp_mysql_parser-php8.4-jspi.so
```

The manifest matches the `PHPExtensionManifest` shape from
`@php-wasm/universal`. It records the extension name, the artifact matrix,
and a `sourcePath` for each artifact relative to the manifest URL:

```json
{
	"name": "wp_mysql_parser",
	"version": "0.1.0",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "wp_mysql_parser-php8.4-jspi.so"
		}
	]
}
```

Host the whole output directory from the same static location. Relative
artifact paths are resolved from the manifest URL.

### Sidecar files

Pass `--extra-files <hostDir>:<vfsRoot>` to stage data directories, web UI
assets, ICU data, or anything else the extension needs at runtime. The host
directory is copied next to the manifest, and each entry is recorded under
`extraFiles.nodes` with a `vfsPath` relative to `vfsRoot` and a `sourcePath`
relative to the manifest URL:

```bash
npx @php-wasm/compile-extension \
	--source ./spx-src \
	--name spx \
	--php-versions 8.2 \
	--extra-files ./web-ui:/internal/shared/spx \
	--out ./dist/spx
```

Empty directories are recorded as `type: "directory"` nodes so the loader
creates them before PHP starts. Multiple `--extra-files` entries are
allowed, but they must agree on `vfsRoot` — the manifest format stores a
single root per group.

## Loading in Node.js

Pass the manifest to the startup-time `extensions` option:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: './dist/wp_mysql_parser/manifest.json',
				},
			},
		],
	})
);
```

Node.js accepts local paths, `file:` URLs, and HTTP(S) URLs for `manifestUrl`.
The loader selects the artifact whose `phpVersion` matches the runtime,
stages the `.so`, copies any `extraFiles` declared in the manifest, writes a
generated `.ini` file, and starts PHP with the extension scan directory
configured.

## Loading in the browser

In the browser, host the output directory and pass an absolute URL:

```ts
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

const php = new PHP(
	await loadWebRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: new URL('/extensions/wp_mysql_parser/manifest.json', location.href),
				},
			},
		],
	})
);
```

Serve the `.so` artifacts with a static-file server that permits cross-origin
requests from the page that creates the runtime.

## Direct artifacts

Use a manifest when you publish a matrix. If the caller already picked the
artifact, use `format: 'url'` instead:

```ts
await loadWebRuntime('8.4', {
	extensions: [
		{
			source: {
				format: 'url',
				name: 'wp_mysql_parser',
				url: new URL('https://cdn.example.com/wp_mysql_parser-php8.4-jspi.so'),
			},
		},
	],
});
```

## Compatibility

Build every PHP version you plan to support. A `.so` built for PHP 8.4 cannot
be loaded into PHP 8.3. Custom extension artifacts are JSPI-only and must be
loaded by a JSPI runtime.

The helper supports PHP `7.4` and `8.0` through `8.5`. Pass the matrix as a
comma-separated list:

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--out ./dist/wp_mysql_parser
```

Extension loading is startup-only. Declare custom extensions in the
`extensions` option before the runtime is created.

## Running the helper in CI

The helper is published as `@php-wasm/compile-extension` on npm and only
needs Docker and Node. A typical GitHub Actions job:

```yaml
- uses: actions/checkout@v4

- uses: actions/setup-node@v4
  with:
    node-version: '24'

- name: Build the extension matrix
  run: |
    npx --yes @php-wasm/compile-extension \
      --source ./my-extension \
      --name my_extension \
      --php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
      --out ./dist/my-extension
```

When you build the matrix in GitHub Actions, set `strategy.max-parallel: 1`
on the WASM job. Parallel Docker builds on hosted runners frequently hit
apt-mirror flakes during the base image build.

For native dependencies, see
[PHP extension dependencies](/developers/apis/javascript-api/php-extension-dependencies).
