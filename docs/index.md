# WordPress in the browser!

WordPress.wasm is a client-side WordPress that runs without a PHP server thanks to the magic of WebAssembly. [See the live demo!](https://wasm.wordpress.net/wordpress.html)

Related resources:

-   [Using PHP in Javascript](./using-php-in-javascript.md)
-   [Using PHP in the browser](./using-php-in-the-browser.md)
-   [Using WordPress in the browser](./using-wordpress-in-the-browser.md)
-   [Live editing WordPress plugins](./wordpress-plugin-ide.md)
-   [API Reference](./api)

## Getting started

You can run WordPress.wasm as follows:

```js
git clone https://github.com/WordPress/wordpress-wasm
cd wordpress-wasm
npm install
npm run dev
```

A browser should open and take you to your very own client-side WordPress at http://127.0.0.1:8777/wordpress.html!

## Creating your own WordPress.wasm app

As of today, the best way of building a WordPress.wasm app is by directly modifying the `wordpress-wasm` package. Unfortunately, there are no importable npm packages yet. They will get published, eventually, but so far all the efforts were focused on getting this project to work.

If you'd like to see public npm packages sooner than later, you are more than welcome to contribute!

## Basic usage

All the code examples in this sections will work only inside `packages/wordpress-wasm/src`.

### Controlling WordPress.wasm

The WordPress instance is controlled via the `workerThread` object:

```js
import { bootWordPress } from './';
const workerThread = await bootWordPress();
```

The `bootWordPress` utility downloads the WebAssembly runtime, starts it in a separate thread for performance reasons, and returns a `SpawnedWorkerThread` instance. The main application can control the WordPress instance through the `SpawnedWorkerThread` API.

For example, you can run PHP code using the `run` method:

```js
const result = await workerThread.run(`<?php echo "Hello, world!";`);
console.log(result);
// { stdout: "Hello, world!", stderr: [''], exitCode: 0 }
```

You can also dispatch HTTP requests to WordPress as follows:

```js
const response = await workerThread.HTTPRequest({
	path: workerThread.pathToInternalUrl('/wp-login.php'),
	method: 'GET',
});
console.log(response.statusCode);
// 200
console.log(response.body);
// ... the rendered wp-login.php page ...
```

For more details, see the `SpawnedWorkerThread` reference manual page and the architecture overview.

### Logging the user in

`wordpress-wasm` provides helpers to automate common use-cases, like logging the user in:

```js
import { login } from './macros';

// Authenticate the user by sending a POST request to
// /wp-login.php (via workerThread.HTTPRequest()):
await login(workerThread, 'admin', 'password');
```

### Installing plugins

You can install plugins using the `installPlugin()` helper:

```js
// Login as an admin first
await login(workerThread, 'admin', 'password');

// Download the plugin file
const pluginResponse = await fetch('/my-plugin.zip');
const blob = await pluginResponse.blob();
const pluginFile = new File([blob], 'my-plugin.zip);

// Install the plugin by uploading the zip file to
// /wp-admin/plugin-install.php?tab=upload
await installPlugin(workerThread, pluginFile);
```

## Advanced usage

To go beyond the basic usage, you'll need to understand the project architecture.

WordPress.wasm is made of the following building blocks:

### PHP in JavaScript

The `php-wasm` package enables running PHP in JavaScript. It consists of:

-   PHP to WebAssembly build pipeline
-   JavaScript bindings to run the WebAssembly PHP
-   PHP server implementation in JavaScript

See [using PHP in Javascript](./using-php-in-javascript.md) to learn:

-   How does the WebAssembly PHP work?
-   How to customize the PHP installation?
-   How to control the PHP runtime in JavaScript?

*   How to create and delete files in the PHP filesystem?
*   How does the PHP Server work?

### PHP in the browser

The `php-wasm-browser` package provides tools to run `php-wasm` in the browser:

![The boot sequence](https://raw.githubusercontent.com/wordpress/wordpress-wasm/trunk/docs/boot-sequence.png)

It consists of:

-   Tools to load PHP and any dependencies over the internet.
-   A Worker Thread implementation to offload the PHP runtime to.
-   A Service Worker implementation to route the browser traffic to PHP.
-   A messaging layer to wire all the processes together.
-   PHP initialization progress monitor.

See [using PHP in the browser](./using-php-in-the-browser.md) to learn more.

### WordPress in the browser

The `wordpress-wasm` package runs WordPress in the browser with the help of `php-wasm` and `php-wasm-browser`.

It consists of:

-   A page with "fake browser" UI where WordPress is displayed.
-   A bundler for packaging a WordPress installation as an Emscripten data dependency.
-   WordPress-specific setup for the Worker Thread and the Service Worker.
-   WordPress-specific automations for tasks like signing in or installing plugins.
-   A PHP proxy to download plugins from the WordPress.org directory.

See [using WordPress in the browser](./using-wordpress-in-the-browser.md) to learn more.
