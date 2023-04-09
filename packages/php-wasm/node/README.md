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
import {
	loadPHPRuntime,
	getPHPLoaderModule,
	PHP,
	PHPServer,
} from '@php-wasm/node';
const php = new PHP(await loadPHPRuntime(await getPHPLoaderModule('8.0')), {
	documentRoot: new URL('./', import.meta.url).pathname,
});

// Create and run a script directly
php.writeFile('./index.php', `<?php echo "Hello " . $_POST['name']; ?>`);
await php.run({ scriptPath: './index.php' });

// Or use the familiar HTTP concepts:
const response = await php.request({
	method: 'POST',
	url: '/index.php',
	data: { name: 'John' },
});
```
