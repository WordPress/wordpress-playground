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
import { PHP } from '@php-wasm/node';
const php = PHP.load('8.0', {
	requestHandler: {
		documentRoot: new URL('./', import.meta.url).pathname,
	},
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
console.log(response.text);
```

## Attribution

`@php-wasm/node` started as a fork of the original PHP to WebAssembly build published by Oraoto in https://github.com/oraoto/pib and modified by Sean Morris in https://github.com/seanmorris/php-wasm.
