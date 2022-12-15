# Running WordPress in the browser

WordPress runs using the framework described in [running PHP apps in the browser](./using-php-in-the-browser.md).

## WordPress-specific Worker Thread and ServiceWorker setup

The main [`src/wordpress-playground/wordpress.html`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress.html) application starts the Worker Thread using the `bootWordPress` function:

```js
import { bootWordPress } from './boot';
const workerThread = await bootWordPress();
```

The `bootWordPress` utility is a thin wrapper over [`spawnPHPWorkerThread`](./api/php-wasm-browser.spawnphpworkerthread.md) and [`registerServiceWorker`](./api/php-wasm-browser/registerServiceWorker). It initializes a [custom Worker Thread](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/worker-thread.ts) and a [custom Service Worker](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/service-worker.ts) and returns a [`SpawnedWorkerThread`](./api/php-wasm-browser.spawnedworkerthread.md) instance.

PHP runtime and WordPress files are initialized in the [Worker Thread script](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/worker-thread.ts), which itself is a thin wrapper over the [`initializeWorkerThread`](./api/php-wasm-browser.initializeworkerthread.md) function.

Once `bootWordPress` finishes, you can use the [`SpawnedWorkerThread`](./api/php-wasm-browser.spawnedworkerthread.md) it returned to interact with PHP and WordPress.

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

For more details see the [`SpawnedWorkerThread`](./api/php-wasm-browser.spawnedworkerthread.md) and the [running PHP apps in the browser](./using-php-in-the-browser.md) documentation pages.

## WordPress automations

The `src/wordpress-playground` module provides helpers for automating common tasks.

### Logging the user in

```js
import { login } from 'src/wordpress-playground/macros';

// Authenticate the user by sending a POST request to
// /wp-login.php (via workerThread.HTTPRequest()):
await login(workerThread, 'admin', 'password');
```

### Installing plugins

```js
import { login, installPlugin } from 'src/wordpress-playground/macros';

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

### Installing plugins and themes from the WordPress.org directory with a PHP proxy

The browser cannot simply download a WordPress theme or plugin zip file from the wordpress.org directory because of the cross-origin request policy restrictions. This repository provides a [PHP proxy script](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/plugin-proxy.php) that exposes plugins and themes on the same domain where WordPress Playground is hosted.
