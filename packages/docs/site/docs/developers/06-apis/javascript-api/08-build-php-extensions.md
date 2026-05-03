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

The manifest records the extension name, artifact matrix, relative `.so` file
paths, and `sha256` hashes:

```json
{
	"name": "wp_mysql_parser",
	"version": "0.1.0",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"file": "wp_mysql_parser-php8.4-jspi.so",
			"sha256": "..."
		}
	]
}
```

Host the whole output directory from the same static location. Relative
artifact paths are resolved from the manifest URL.

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
verifies `sha256` when present, writes a generated `.ini` file, and starts PHP
with the extension scan directory configured.

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
				sha256: '...',
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

## Using the helper from a downstream repository

`@php-wasm/compile-extension` is not yet published to npm. Until it is, run it
from a checkout of `WordPress/wordpress-playground`. CI jobs that build a
single extension only need a few packages from the monorepo, so a
sparse-checkout keeps the clone small and the install step fast.

Example GitHub Actions step that pulls just the packages the helper needs to
build a JSPI side module for PHP `8.0` through `8.5`:

```yaml
- name: Check out wordpress-playground
  uses: actions/checkout@v4
  with:
    repository: WordPress/wordpress-playground
    ref: trunk
    path: wordpress-playground
    sparse-checkout-cone-mode: false
    sparse-checkout: |
      /package.json
      /package-lock.json
      /nx.json
      /tsconfig.base.json
      /packages/meta/
      /packages/nx-extensions/
      /packages/php-wasm/cli-util/
      /packages/php-wasm/compile-extension/
      /packages/php-wasm/compile/
      /packages/php-wasm/fs-journal/
      /packages/php-wasm/logger/
      /packages/php-wasm/node/
      /packages/php-wasm/node-builds/8-0/
      /packages/php-wasm/node-builds/8-1/
      /packages/php-wasm/node-builds/8-2/
      /packages/php-wasm/node-builds/8-3/
      /packages/php-wasm/node-builds/8-4/
      /packages/php-wasm/node-builds/8-5/
      /packages/php-wasm/progress/
      /packages/php-wasm/scopes/
      /packages/php-wasm/stream-compression/
      /packages/php-wasm/universal/
      /packages/php-wasm/util/

- name: Install Playground deps
  working-directory: wordpress-playground
  run: npm ci --ignore-scripts
```

Adjust the `node-builds` lines to the PHP versions the matrix builds. Add
`/packages/php-wasm/node-builds/7-4/` when the matrix includes PHP `7.4`, and
drop entries for versions you do not need. The helper resolves headers and
side-module link inputs from `packages/php-wasm/compile`, so keep that
package included even when the build itself runs inside the helper's Docker
image.

Run the helper from the `wordpress-playground` checkout. `npm ci
--ignore-scripts` does not build the package's bin script, so until
`@php-wasm/compile-extension` is published to npm, invoke the CLI source
directly through Node's type-stripping flags:

```bash
cd wordpress-playground

node \
	--experimental-strip-types \
	--experimental-transform-types \
	--disable-warning=ExperimentalWarning \
	--import "$PWD/packages/meta/src/node-es-module-loader/register.mts" \
	./packages/php-wasm/compile-extension/src/cli.ts \
	--source ../my-extension \
	--name my_extension \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--out ../my-extension/dist
```

`--source` and any archives listed in `--extra-ldflags` are copied into the
container under `/build`, so the extension source does not need to live
inside the `wordpress-playground` checkout. Pass a relative or absolute path
that points at the extension directory in the downstream repository.

When you build the matrix in GitHub Actions, set `strategy.max-parallel: 1`
on the WASM job. Parallel Docker builds on hosted runners frequently hit
apt-mirror flakes during the base image build.

For native dependencies, see
[PHP extension dependencies](/developers/apis/javascript-api/php-extension-dependencies).
