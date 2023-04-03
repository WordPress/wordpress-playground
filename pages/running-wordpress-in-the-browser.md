# Running WordPress in the browser

This document is specific to hosting your own Playground. If you only wish to consume the API, use the [`connectPlayground`](/functions/_wp_playground_client.connectPlayground.htmll) function:

```ts
const playgroundClient = connectPlayground(
	iframe,
	`https://playground.wordpress.net/remote.html`
);
```

## Hosting your own Playground

WordPress runs using the framework described in [running PHP apps in the browser](./using-php-in-the-browser.html).

## WordPress-specific Worker Thread and ServiceWorker setup

The [`playground remote`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/playground/remote/remote.html) application starts the Worker Thread using the `bootPlaygroundRemote()` function:

```js
import { bootPlaygroundRemote() } from './boot-playground-remote';
const playgroundClient = await bootPlaygroundRemote();
```

The `bootPlaygroundRemote` utility is a thin wrapper over [`consumeAPI`](/functions/_php_wasm_web.consumeAPI.html), [`spawnPHPWorkerThread`](/functions/_php_wasm_web.spawnPHPWorkerThread.html), and [`registerServiceWorker`](/functions/_php_wasm_web.registerServiceWorker.html). It initializes a [custom Worker Thread](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/playground/remote/src/lib/worker-thread.ts) and a [custom Service Worker](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/playground/remote/service-worker.ts) and returns a [`PlaygroundClient`](/interfaces/_wp_playground_client.PlaygroundClient.html) instance.

PHP runtime and WordPress files are initialized in the Worker Thread script.

Once `bootPlaygroundRemote` finishes, you can use the [`PlaygroundClient`](/interfaces/_wp_playground_client.PlaygroundClient.html) it returned to interact with PHP and WordPress.

For example, you can run PHP code using the `run` method:

```js
const result = await playgroundClient.run({
	code: `<?php echo "Hello, world!";`,
});
console.log(result);
// { stdout: Uint8Array(["Hello, world!"]), stderr: [''], exitCode: 0 }
```

You can also dispatch HTTP requests to WordPress as follows:

```js
const response = await playgroundClient.request({
	relativeUrl: '/wp-login.php',
	method: 'GET',
});
console.log(response.statusCode);
// 200
console.log(response.body);
// ... the rendered wp-login.php page ...
```

For more details see the [`PlaygroundClient`](./api/playground-client.php.html) and the [running PHP apps in the browser](./using-php-in-the-browser.html) documentation pages.

## WordPress automations

The `@wp-playground/client` module provides helpers for common tasks.

### Logging the user in

```js
import { login } from '@wp-playground/client';

// Authenticate the user by sending a POST request to
// /wp-login.php (via workerThread.HTTPRequest()):
await login(playgroundClient, 'admin', 'password');
```

### Installing plugins

```js
import { login, installPlugin } from '@wp-playground/client';

// Login as an admin first
await login(playgroundClient, 'admin', 'password');

// Download the plugin file
const pluginResponse = await fetch('/my-plugin.zip');
const blob = await pluginResponse.blob();
const pluginFile = new File([blob], 'my-plugin.zip);

// Install the plugin by uploading the zip file to
// /wp-admin/plugin-install.php?tab=upload
await installPlugin(playgroundClient, pluginFile);
```

### Installing plugins and themes from the WordPress.org directory with a PHP proxy

The browser cannot simply download a WordPress theme or plugin zip file from the wordpress.org directory because of the cross-origin request policy restrictions. This repository provides a [PHP proxy script](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/playground/website/plugin-proxy.php) that exposes plugins and themes on the same domain where the WordPress Playground website is hosted.
