# php-wasm: PHP for JavaScript

This package enables using PHP in JavaScript. It provides:

* PHP to WebAssembly build pipeline 
* JavaScript bindings for WebAssembly
* PHP server implementation in JavaScript

Here's what a minimal hello world looks like:

```js
import { PHP, PHPServer } from 'php-wasm';

helloWorld();
// Output: "Hello from PHP!"

async function helloWorld() {
    const php = await startPHP();
    console.log(
        php.run(`<?php echo "Hello from PHP!";`).stdout
    );
}

async function startPHP() {
    // Download php-web.js – shipped separately from the main bundle
    await loadPHPwebjs();
    // window.PHPLoader is now available
    // Use it to download and run php.wasm:
    const php = new PHP();
    await php.init(PHPLoader);
    return php;
}

async function loadPHPwebjs() {
    const script = document.createElement('script');
    script.src = '/php-web.js';
    script.async = false;
    document.body.appendChild(script);
    await new Promise((resolve) => {
        script.onload = resolve;
    });
}
```

## PHP to WebAssembly build pipeline

The build pipeline lives in the `wasm` subdirectory.

PHP is compiled to WASM with [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.

A configurable PHP build pipeline for different targets (web, node.js)

The magic happens 

The [original recipe](https://github.com/seanmorris/php-wasm)

* SQLite support

Emscripten compilation yields two files: php.wasm, php-web.js, php-webworker.js.

To build the WebAssembly module, run:

```bash
npx gulp --gulpfile=wasm/gulpfile.js build
```

Which downloads the assembly file, creates a virtual heap, and exposes named native functions conveniently wrapped to accept and return JavaScript data types.

```js	
const php = new PHPWrapper();
console.log(
    await php.run(`<?php echo "Hello world";`).stdout
);
// "Hello world"
```

## JavaScript bindings

All the JavaScript code live in the `src` subdirectory.

To build the JavaScript module, run `npm run build:js` in the repo root.

A low-level PHP JavaScript class with eval for executing PHP code and FS utils like writeFile for runtime managing the
A PHPServer JavaScript class for dispatching HTTP requests – both to run the PHP files AND to download static files
A PHPBrowser JavaScript class to consume the above using an iframe

## PHP server implementation in JavaScript


```js
import { PHP, PHPServer } from 'php-wasm';

startPHPServer()
    .then(server => server.request({ path: '/index.php' })
    .then(response => console.log(response.body));
// Output: "Hi from PHP!"

async function startPHPServer() {
    // Start PHP using function from the "hello world" example
    const php = await startPHP();

    // Create a file to serve
    php.mkdirTree('/www');
    php.writeFile('/www/index.php', '<?php echo "Hi from PHP!"; ');

    // Create a server:
    return new PHPServer(php, {
        documentRoot: '/www',
        // This is to populate $_SERVER['SERVER_NAME'] etc.
        // PHPServer does not actually bind to any address or port –
        // it only provides an HTTP request handler.
        absoluteUrl: 'http://127.0.0.1'
    });
}
```
