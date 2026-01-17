# WebAssembly PHP for Node.js

This package ships WebAssembly PHP binaries and the JavaScript API optimized for Node.js. It comes with the following PHP extensions:

-   SQLite
-   Libzip
-   Libpng
-   CLI
-   OpenSSL
-   MySQL

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

## Dynamic Extensions

The following extensions can be loaded dynamically at runtime using loader options:

### Memcached

The Memcached extension enables PHP to communicate with Memcached servers:

```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { withMemcached: true }));

const output = await php.runStream({
	code: `<?php
$memcached = new Memcached();
$memcached->addServer('127.0.0.1', 11211);
$memcached->set('key', 'value');
echo $memcached->get('key');
?>`,
});

console.log(await output.stdoutText);
```

**Note:** Network connections require a WebSocket-to-TCP proxy. See the networking documentation for details.

## Attribution

`@php-wasm/node` started as a fork of the original PHP to WebAssembly build published by Oraoto in https://github.com/oraoto/pib and modified by Sean Morris in https://github.com/seanmorris/php-wasm.
