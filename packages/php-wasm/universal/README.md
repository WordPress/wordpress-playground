# Shared PHP.wasm runtime API

`@php-wasm/universal` contains the runtime pieces shared by `@php-wasm/node`,
`@php-wasm/web`, and the Playground client packages.

Most applications should start with `loadNodeRuntime()` from `@php-wasm/node`
or `loadWebRuntime()` from `@php-wasm/web`. Use this package directly when you
need the lower-level PHP request handler, filesystem helpers, or extension
staging primitives.

## PHP extension manifests

External PHP extensions are loaded before PHP starts. They are supported in
JSPI runtimes only. A manifest lets a package publish one extension name with
artifacts for the PHP version matrix:

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

`sourcePath` may be absolute, or relative to the manifest URL. If you pass an
inline manifest instead of `manifestUrl`, pass `baseUrl` to choose where
relative artifact files are resolved from.

Asyncify extension loading is reserved for bundled extensions shipped with the
PHP.wasm packages, such as `intl`, `xdebug`, `redis`, and `memcached`.

## Lower-level extension staging

`resolvePHPExtension()` turns bytes, a direct artifact URL, or a manifest into a
`ResolvedPHPExtension`. `withResolvedPHPExtensions()` then augments Emscripten
options so the extension `.so`, generated `.ini`, sidecar files, and environment
variables are ready before PHP scans its `.ini` files. When
`loadWithIniDirective` is `false`, the `.so` and sidecar files are still staged
but no `.ini` file or `PHP_INI_SCAN_DIR` entry is generated.

```ts
import { resolvePHPExtension, withResolvedPHPExtensions } from '@php-wasm/universal';

const extension = await resolvePHPExtension({
	phpVersion: '8.4',
	source: {
		format: 'manifest',
		manifestUrl: new URL('https://cdn.example.com/wp_mysql_parser/manifest.json'),
	},
});

const emscriptenOptions = withResolvedPHPExtensions({}, [extension]);
```

Direct bytes skip URL resolution:

```ts
await resolvePHPExtension({
	phpVersion: '8.4',
	name: 'wp_mysql_parser',
	source: { format: 'so', bytes },
});
```
