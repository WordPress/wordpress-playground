# WebAssembly PHP for Node.js

This package ships WebAssembly PHP binaries and the JavaScript API optimized for Node.js. It comes with the following PHP extensions:

- SQLite
- Libzip
- Libpng
- CLI
- OpenSSL
- MySQL

It uses the host filesystem directly and can access the network if you plug in a custom
WS proxy.

Here's how to use it:

```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

const output = await php.runStream({
	code: '<?php phpinfo(); ?>',
});

console.log(await output.stdoutText);
```

## Loading PHP extensions

Pass `extensions` to `loadNodeRuntime()` to load optional PHP extensions before
PHP starts:

```js
const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
```

`@php-wasm/node` ships `intl`, `xdebug`, `redis`, and `memcached`. It can also
load external JSPI `.so` artifacts from a manifest:

```js
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

In Node.js, `manifestUrl` may be a local path, a `file:` URL, or an HTTP(S)
URL. Relative local paths are resolved from the current working directory.
Relative artifact files in the manifest are resolved against the manifest
location.

Set `loadWithIniDirective: false` to stage a Wasm artifact without registering
it in php.ini.

External extensions are only supported when the Node.js runtime has JSPI
available. Asyncify support is limited to the bundled extensions shipped with
this package.

The older `withIntl`, `withXdebug`, `withRedis`, and `withMemcached` loader
options still work, but new code should use `extensions`.

## Attribution

`@php-wasm/node` started as a fork of the original PHP to WebAssembly build published by Oraoto in https://github.com/oraoto/pib and modified by Sean Morris in https://github.com/seanmorris/php-wasm.
