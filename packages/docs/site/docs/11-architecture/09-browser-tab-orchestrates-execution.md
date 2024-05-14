# Browser tab orchestrates the execution

The main `index.html` ties the entire application together. It starts all the concurrent processes and displays the PHP responses. The app only lives as long as the main `index.html`.

Keep this point in mind as you read through the rest of the docs. At this point it may seem obvious, by the lines may get blurry later on. This package runs code outside of the browser tab using Web Workers, Service Workers, and, in the future, Shared Workers. Some of these workers may keep running even after the browser tab with `index.html` is closed.

## Boot sequence

Here's what a boot sequence for a minimal app looks like:

![The boot sequence](@site/static/img/boot-sequence.png)

The main app initiates the Iframe, the Service Worker, and the Worker Thread. Note how the main app doesn't use the PHP stack directly – it's all handled in the Worker Thread.

Here's what that boot sequence looks like in code:

**/index.html**:

```js
<script src="/app.ts"></script>
<iframe id="my-app"></iframe>
```

**/app.ts**:

```ts
import { consumeAPI, PHPClient, registerServiceWorker, spawnPHPWorkerThread } from '@php-wasm/web';

const workerUrl = '/worker-thread.js';

export async function startApp() {
	const phpClient = consumeAPI<PlaygroundWorkerEndpoint>(
		await spawnPHPWorkerThread(
			workerUrl, // Valid Worker script URL
			{
				wpVersion: 'latest',
				phpVersion: '7.4', // Startup options
			}
		)
	);

	// Await the two-way communication channel
	await phpClient.isReady();

	// Must point to a valid Service Worker script:
	await registerServiceWorker(
		phpClient,
		'default', // PHP instance scope, keep reading to learn more.
		'/sw.js', // Valid Service Worker script URL.
		'1' // Service worker version, used for reloading the script.
	);

	// Create a few PHP files to browse:
	await workerThread.writeFile('/index.php', '<a href="page.php">Go to page.php</a>');
	await workerThread.writeFile('/page.php', '<?php echo "Hello from PHP!"; ?>');

	// Navigate to index.php:
	document.getElementById('my-app').src = playground.pathToInternalUrl('/index.php');
}
startApp();
```

Keep reading to learn how all these pieces fit together.

### Data flow

Here's what happens whenever the iframe issues a same-domain request:

![The data flow](@site/static/img/data-flow.png)

A step-by-step breakdown:

1.  The request is intercepted by the Service Worker
2.  The Service Worker passes it to the Worker Thread
3.  The Worker Thread calls `PHP.request` to convert that request to a response
4.  The Worker Thread passes the response to the Service Worker
5.  The Service Worker provides the browser with a response

At this point, if the request was triggered by user clicking on a link, the browser will render PHPRequestHandler's response inside the iframe.
