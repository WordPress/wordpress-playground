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

## File locking without native binaries

`fs-ext-extra-prebuilt` is optional and accepts patch updates so fresh installs
can pick up newly published binaries. If its native addon cannot load, PHP uses
JavaScript locks. CLI workers share one lock manager, including blocking lock
requests. A blocking request waits in the requesting worker; the shared manager
continues serving lock and unlock requests from other workers.
If a shared-to-exclusive whole-file upgrade must wait, it drops that handle's
shared lock first so two upgrading readers cannot keep each other blocked.
A failed nonblocking upgrade keeps its shared lock.

The fallback identifies files by their device and inode numbers, not their
paths. Hard links share locks, and replacing a file at the same path does not
carry the old file's locks over to the replacement. A caller-supplied
`fileLockManager` receives these opaque file keys in place of paths in fallback
mode. File-handle identities are retained for cleanup after close or unlink.

These locks only coordinate runtimes using the same manager. They do not lock
against separate CLI runs, native PHP, SQLite tools, or other host programs.
Use private site files in this mode. Keep the native addon available when other
programs may access the same writable files. The fallback is silent by default.
Native-loading details are logged at debug level.

As with native synchronous locks, do not wait for a conflicting lock held by
another runtime on the same JS thread: that thread cannot release the lock while
it is blocked. Put concurrently running PHP instances in separate workers and
pass them the same shared lock manager.
