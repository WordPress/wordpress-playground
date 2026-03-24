# WebAssembly PHP for the web

This package ships WebAssembly PHP binaries and the JavaScript API optimized for the web and a low bundle size. It comes with the Libzip extension and the SQLite extension.

Here's how to use it:

```js
import { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

// loadWebRuntime() calls import('php.wasm') and import('icu.dat') internally.
// Your bundler must resolve import('php.wasm') as a static file URL.
// If you use Webpack, you can use the file-loader to do so.
const php = new PHP(await loadWebRuntime('8.3'));

let response;

php.writeFile('/test.php', `<?php echo "Hello, World!"; ?>`);

// Run a script directly:
response = await php.runStream({
	scriptPath: '/test.php',
});

console.log(await response.stdoutText);
// You will see the following output in the browser console:
// Hello, World!

php.mkdir('/www');
php.writeFile('/www/index.php', `<?php echo "Hello " . $_POST['name']; ?>`);

// Or use the familiar HTTP concepts:
const handler = new PHPRequestHandler({ phpFactory: async () => php });

response = await handler.request({
	method: 'POST',
	url: 'index.php',
	body: { name: 'John' },
});

console.log(response.text);
// You will see the following output in the browser console:
// Hello John
```

## Attribution

`@php-wasm/web` started as a fork of the original PHP to WebAssembly build published by Oraoto in https://github.com/oraoto/pib and modified by Sean Morris in https://github.com/seanmorris/php-wasm.
