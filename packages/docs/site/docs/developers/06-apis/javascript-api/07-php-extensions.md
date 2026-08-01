---
title: Loading PHP extensions
slug: /developers/apis/javascript-api/php-extensions
description: Load bundled and external PHP.wasm extensions in Node.js and browser runtimes.
---

# Loading PHP extensions

PHP reads extension declarations while it starts. In PHP.wasm, that means
extensions must be declared before `loadNodeRuntime()` or `loadWebRuntime()`
creates the runtime.

Use the `extensions` array for both bundled extensions and external `.so`
artifacts.

Use external PHP.wasm extensions when the code that must be fast or native-like
is too hot for PHP userland, but you still want to ship it with a Playground
demo, CLI workflow, or embedded app. The same manifest can be loaded by the
JavaScript API, the Playground web Query API, and Playground CLI.

External extensions are JSPI side modules. If the browser or Node.js build does
not expose JSPI, PHP.wasm rejects the extension request instead of starting
with a partially loaded runtime.

## Bundled extensions

`@php-wasm/node` ships `intl`, `xdebug`, `redis`, and `memcached`:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
```

`@php-wasm/web` currently ships `intl`:

```ts
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

const php = new PHP(
	await loadWebRuntime('8.4', {
		extensions: ['intl'],
	})
);
```

The old `withIntl`, `withXdebug`, `withRedis`, and `withMemcached` options are
still accepted where they already existed. New code should use `extensions`
because it also supports external extensions.

## External extensions

An external extension needs a WebAssembly `.so` built for the same PHP version
as the PHP.wasm JSPI runtime. Publish the artifact with a manifest:

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

`sourcePath` may be an absolute URL or a path relative to the manifest URL. If
the manifest lives at
`https://cdn.example.com/extensions/wp_mysql_parser/manifest.json`, the
`sourcePath` above resolves to
`https://cdn.example.com/extensions/wp_mysql_parser/wp_mysql_parser-php8.4-jspi.so`.

If the extension ships sidecar assets (UI files, data, empty directories), list
them under `extraFiles`. Each `node` declares its final VFS path as
`vfsRoot + vfsPath`:

```json
{
	"name": "spx",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "spx-php8.4-jspi.so",
			"extraFiles": {
				"vfsRoot": "/internal/shared/spx",
				"nodes": [
					{ "vfsPath": "data", "type": "directory" },
					{ "vfsPath": "ui/index.html", "sourcePath": "ui/index.html" }
				]
			}
		}
	]
}
```

In Node.js, `manifestUrl` may be a local path, a `file:` URL, or an HTTP(S)
URL. Relative local paths are resolved from the current working directory:

```ts
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

Node.js applies the same local-path support to direct artifact URLs and inline
manifest `baseUrl` values.

External extensions are only supported when JSPI is available. Asyncify support
is limited to the bundled extensions shipped with the PHP.wasm packages, such
as `intl`, `xdebug`, `redis`, and `memcached`.

In the browser, pass an absolute URL or construct one with the base URL you want:

```ts
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

If you already have the manifest object in memory, pass `baseUrl` so relative
artifact files can still be resolved:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			source: {
				format: 'manifest',
				manifest,
				baseUrl: 'https://cdn.example.com/extensions/wp_mysql_parser/',
			},
		},
	],
});
```

If you already have the `.so` bytes, skip the manifest:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'wp_mysql_parser',
			source: {
				format: 'so',
				bytes,
			},
		},
	],
});
```

Use a direct artifact URL when the caller, not a manifest, chooses the artifact:

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

## Try published PHP.wasm extensions

Two projects publish ready-to-use manifests you can inspect before building
your own:

- [SQLite Database Integration native extension](https://wordpress.github.io/sqlite-database-integration/native-extension/)
  publishes `wp_mysql_parser`, a native lexer/parser used by the SQLite
  Database Integration plugin.
- [PHP Toolkit Native APIs WASM releases](https://wordpress.github.io/php-toolkit/wp_native_apis-wasm-extension/)
  publishes `wp_native_apis`, an experimental extension for WordPress native
  APIs.

To try a published extension in Playground web, pass its manifest URL with the
`php-extension` Query API parameter. This loads the extension before PHP starts,
without writing any JavaScript:

```text
https://playground.wordpress.net/?php=8.5&php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json
```

Use `/latest/manifest.json` for a quick demo. Use one of the pinned manifest
URLs from the extension release page for reproducible demos, tests, and
documentation links.

Repeat the parameter to load more than one extension:

```text
https://playground.wordpress.net/?php=8.5&php-extension=https://example.com/one/manifest.json&php-extension=https://example.com/two/manifest.json
```

The Query API accepts absolute, root-relative, and page-relative manifest URLs.
After resolution, the manifest URL must use HTTP(S). For example, if your
Playground page is served from `https://example.com/tools/`, these are valid:

```text
?php-extension=https://cdn.example.com/wp_mysql_parser/manifest.json
?php-extension=/extensions/wp_mysql_parser/manifest.json
?php-extension=./extensions/wp_mysql_parser/manifest.json
```

The same manifest-loading path is documented in the
[Query API reference](/developers/apis/query-api).

The same manifest works in Playground CLI:

```bash
npx @wp-playground/cli@latest server \
	--php=8.5 \
	--php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json \
	--blueprint=https://wordpress.github.io/sqlite-database-integration/blueprint.json
```

When you embed Playground with `@wp-playground/client`, pass the same manifest
through the `extensions` option:

```html
<iframe id="wp"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json',
				},
			},
		],
	});

	await client.isReady();
</script>
```

Use the lower-level runtime API when you are building directly on
`@php-wasm/node` or `@php-wasm/web`:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.5', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json',
				},
			},
		],
	})
);
```

## Build your own extension

`@php-wasm/compile-extension` turns a normal `phpize` extension directory into
JSPI `.so` artifacts and a loadable manifest:

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--out ./dist/wp_mysql_parser
```

Host the whole output directory from one static location. The manifest lets the
runtime select the artifact that matches the active PHP version and load it
before PHP starts.

## Startup files

PHP loads extensions from `.ini` files it reads during startup. PHP.wasm builds
those files from the extension request before the runtime starts:

```ini
extension=/internal/shared/extensions/my_extension.so
my_extension.option=value
```

`loadWithIniDirective` chooses the first line of that generated `.ini` file.
Regular PHP extensions use `extension`. Zend extensions such as Xdebug use
`zend_extension`:

```ini
zend_extension=/internal/shared/extensions/xdebug.so
xdebug.mode=debug,develop
```

The remaining startup options describe what PHP.wasm writes before PHP starts:

- `iniEntries`: extra lines in the generated extension `.ini` file.
- `extraFiles`: sidecar files staged in the PHP virtual filesystem.
- `env`: environment variables set before PHP starts.
- `extensionDir`: the virtual directory for the `.so` and generated `.ini`
  files.

A Zend extension needs `zend_extension` and usually several `.ini` entries:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'my_debugger',
			loadWithIniDirective: 'zend_extension',
			iniEntries: {
				'my_debugger.mode': 'debug',
				'my_debugger.start_with_request': 'yes',
			},
			source: { format: 'so', bytes },
		},
	],
});
```

An extension with data files can stage them before PHP starts and point the
extension at their virtual path. `extraFiles` keys are absolute VFS paths:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'my_text_extension',
			source: { format: 'so', bytes },
			env: {
				MY_TEXT_DATA: '/internal/shared/my_text_extension',
			},
			extraFiles: {
				files: {
					'/internal/shared/my_text_extension/data.bin': dataBytes,
				},
			},
		},
	],
});
```

## Limits

Extension loading is startup-only. PHP.wasm writes a generated `.ini` file for
each extension, stages the `.so` and any sidecar files, updates
`PHP_INI_SCAN_DIR`, and then starts PHP. Loading an extension into an already
running PHP runtime with `dl()` is not supported by this API.

Legacy PHP builds do not support extension loading. The runtime will reject
extension requests for those PHP versions instead of starting with a partially
loaded configuration.
