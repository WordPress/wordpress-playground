# Running PHP apps in the browser with ServiceWorkers and Worker Threads

The [`php-wasm-web`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/web/) module provides a framework for running real PHP applications inside the web browser:

-   **Browser tab orchestrates everything** – The browser tab is the main program. Closing or reloading it means destroying the entire execution environment.
-   **Iframe-based rendering** – Every response produced by the PHP server must be rendered in an iframe to avoid reloading the browser tab when the user clicks on a link.
-   **PHP Worker Thread** – The PHP server is slow and must run in a worker thread, otherwise handling requests freezes the website UI.
-   **Service Worker routing** – All HTTP requests originating in that iframe must be intercepted by a Service worker and passed on to the PHP worker thread for rendering.

See also the [API Reference](api/web.html)

## Browser tab orchestrates the execution

The main `index.html` ties the entire application together. It starts all the concurrent processes and displays the PHP responses. The app only lives as long as the main `index.html`.

Keep this point in mind as you read through the rest of the docs. At this point it may seem obvious, by the lines may get blurry later on. This package runs code outside of the browser tab using Web Workers, Service Workers, and, in the future, Shared Workers. Some of these workers may keep running even after the browser tab with `index.html` is closed.

### Boot sequence

Here's what a boot sequence for a minimal app looks like:

![The boot sequence](https://raw.githubusercontent.com/wordpress/wordpress-playground/trunk/pages/boot-sequence.png)

The main app initiates the Iframe, the Service Worker, and the Worker Thread. Note how the main app doesn't use the PHP stack directly – it's all handled in the Worker Thread.

Here's what that boot sequence looks like in code:

**/index.html**:

```js
<script src="/app.ts"></script>
<iframe id="my-app"></iframe>
```

**/app.ts**:

```ts
import { consumeAPI, PHPClient, recommendedWorkerBackend, registerServiceWorker, spawnPHPWorkerThread } from '@php-wasm/web';

const workerUrl = '/worker-thread.js';

export async function startApp() {
	const phpClient = consumeAPI<PHPClient>(
		spawnPHPWorkerThread(
			'/worker-thread.js', // Valid Worker script URL
			recommendedWorkerBackend, // "webworker" or "iframe", see the docstring
			{ phpVersion: '7.4' } // Startup options
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

**/worker-thread.js**:

```js
import {
	PHP,
	PHPClient,
	setURLScope,
	exposeAPI,
	parseWorkerStartupOptions,
} from '@php-wasm/web';

// Random scope
const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(import.meta.url, scope).toString();

const { phpVersion } = parseWorkerStartupOptions<{ phpVersion?: string }>();
const php = await PHP.load('8.0', {
	requestHandler: {
		documentRoot: '/',
		absoluteUrl: scopedSiteUrl
	}
});

// Expose the API to app.ts:
// It will listens to commands issued by the main app and
// the requests from the Service Worker.
const [setApiReady, ] = exposeAPI( new PHPClient( php ) );
setApiReady();
```

**/service-worker.js**:

```js
import { initializeServiceWorker } from '@php-wasm/web';

// Intercepts all HTTP traffic on the current domain and
// passes it to the Worker Thread.
initializeServiceWorker();
```

Keep reading to learn how all these pieces fit together.

### Data flow

Here's what happens whenever the iframe issues a same-domain request:

![The data flow](https://raw.githubusercontent.com/wordpress/wordpress-playground/trunk/pages/data-flow.png)

A step-by-step breakown:

1.  The request is intercepted by the Service Worker
2.  The Service Worker passes it to the Worker Thread
3.  The Worker Thread calls `PHP.request` to convert that request to a response
4.  The Worker Thread passes the response to the Service Worker
5.  The Service Worker provides the browser with a response

At this point, if the request was triggered by user clicking on a link, the browser will render PHPRequestHandler's response inside the iframe.

## Iframe-based rendering

All the PHPRequestHandler responses must be rendered in an iframe to avoid reloading the page. Remember, the entire setup only lives as long as the main `index.html`. We want to avoid reloading the main app at all cost.

In our app example above, `index.php` renders the following HTML:

```html
<a href="page.php">Go to page.php</a>
```

Imagine our `index.html` rendered it in a `<div>` instead of an `<iframe>`. As soon as you clicked on that link, the browser would try to navigate from `index.html` to `page.php`. However, `index.html` runs the entire PHP app including the Worker Thread, the PHPRequestHandler, and the traffic control connecting them to the Service Worker. Navigating away from it would destroy the app.

Now, consider an iframe with the same link in it:

```html
<iframe srcdoc='<a href="page.php">Go to page.php</a>'></iframe>
```

This time, clicking the link the browser to load `page.php` **inside the iframe**. The top-level index.html where the PHP application runs remains unaffected. This is why iframes are a crucial part of the `@php-wasm/web` setup.

### Iframes caveats

-   `target="_top"` isn't handled yet. This means that clicking on `<a target="_top">Click here</a>` will reload the main browser tab.
-   JavaScript popup windows originating in the iframe may not work correctly yet.

## PHP Worker Threads

PHP is always ran in a separate thread we'll call a "Worker Thread." This happens to ensure the PHP runtime doesn't slow down the website.

Imagine the following code:

```js
<button onclick="for(let i=0;i<100000000;i++>) {}">Freeze the page</button>
<input type="text" />
```

As soon as you click that button the browser will freeze and you won't be able to type in the input. That's just how browsers work. Whether it's a for loop or a PHP server, running intensive tasks slows down the user interface.

### Initiating the worker thread

Worker threads are separate programs that can process heavy tasks outside of the main application. They must be initiated by the main JavaScript program living in the browser tab. Here's how:

```ts
const phpClient = consumeAPI<PHPClient>(
	spawnPHPWorkerThread(
		'/worker-thread.js', // Valid Worker script URL
		recommendedWorkerBackend // "webworker" or "iframe", see the docstring
	)
);
await phpClient.isReady();
await phpClient.run({ code: `<?php echo "Hello from the thread!";` });
```

Worker threads can use any multiprocessing technique like an iframe, WebWorker, or a SharedWorker (not implemented). See the next sections to learn more about the supported backends.

### Controlling the worker thread

The main application controls the worker thread by sending and receiving messages. This is implemented via a backend-specific flavor of `postMessage` and `addEventListener('message', fn)`.

Exchanging messages is the only way to control the worker threads. Remember – it is separate programs. The main app cannot access any functions or variables defined inside of the worker thread.

Conveniently, [consumeAPI](api/web.consumeapi.html) returns an easy-to-use API object that exposes specific worker thread features and handles the message exchange internally.

### Worker thread backends

Worker threads can use any multiprocessing technique like an iframe, WebWorker, or a SharedWorker. This package provides two backends out of the box:

#### `webworker`

Spins a new `Worker` instance with the given Worker Thread script. This is the classic solution for multiprocessing in the browser and it almost became the only, non-configurable backend. The `iframe` backend is handy to work around webworkers limitations in the browsers. For example, [Firefox does not support module workers](https://github.com/mdn/content/issues/24402) and [WASM used to crash webworkers in Chrome](https://github.com/WordPress/wordpress-playground/issues/1).

Example usage:

```ts
const phpClient = consumeAPI<PHPClient>(spawnPHPWorkerThread('/worker-thread.js', 'webworker'));
```

#### `iframe`

Loads the PHPRequestHandler in a new iframe to avoid crashes in browsers based on Google Chrome.

The browser will **typically** run an iframe in a separate thread in one of the two cases:

1.  The `iframe-worker.html` is served with the `Origin-Agent-Cluster: ?1` header. If you're running the Apache webserver, this package ships a `.htaccess` that will add the header for you.
2.  The `iframe-worker.html` is served from a different origin. For convenience, you could point a second domain name to the same server and directory and use it just for the `iframe-worker.html`.

Pick your favorite option and make sure to use it for serving the `iframe-worker.html`.

Example usage:

**/app.ts**:

```ts
const phpClient = consumeAPI<PHPClient>(spawnPHPWorkerThread('/iframe-worker.html?script=/worker-thread.js', 'iframe'));
```

**/iframe-worker.html** (Also provided in `@php-wasm/web` package):

```js
<!DOCTYPE html>
<html>
  <head></head>
  <body style="padding: 0; margin: 0">
    <script>
      const script = document.createElement('script');
      script.type = 'module';
      script.src = getEscapeScriptName();
      document.body.appendChild(script);

	  function getEscapeScriptName() {
		// Grab ?script= query parameter and securely escape it
	  }
    </script>
  </body>
</html>

```

## Service Workers

[A Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) is used to handle the HTTP traffic using the in-browser PHPRequestHandler.

Imagine your PHP script renders the following page [in the iframe viewport](#iframe-based-rendering):

```html
<html>
	<head>
		<title>John's Website</title>
	</head>
	<body>
		<a href="/">Homepage</a>
		<a href="/blog">Blog</a>
		<a href="/contact">Contact</a>
	</body>
</html>
```

When the user clicks, say the `Blog` link, the browser would normally send a HTTP request to the remote server to fetch the `/blog` page and then display it instead of the current iframe contents. However, our app isn't running on the remote server. The browser would just display a 404 page.

Enter [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) – a tool to intercept the HTTP requests and handle them inside the browser.

### Service Worker setup

The main application living in `/index.html` is responsible for registering the service worker.

Here's the minimal setup:

**/app.js:**

```js
import { registerServiceWorker } from '@php-wasm/web';

function main() {
	await registerServiceWorker(
		phpClient,
		"default", // PHP instance scope
		"/sw.js",  // Must point to a valid Service Worker implementation.
		"1"        // Service worker version, used for reloading the script.
	);

}
```

You will also need a separate `/service-worker.js` file that actually intercepts and routes the HTTP requests. Here's what a minimal implementation looks like:

**/service-worker.js**:

```js
import { initializeServiceWorker } from '@php-wasm/web';

// Intercepts all HTTP traffic on the current domain and
// passes it to the Worker Thread.
initializeServiceWorker();
```

## Cross-process communication

`@php-wasm/web` uses the [Comlink](https://github.com/GoogleChromeLabs/comlink) library to turns the one-way `postMessage` available in JavaScript into a two-way communication channel.

If `postMessage` sounds unfamiliar, it's what JavaScript threads use to communicate. Please review the [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) before continuing.

By default, `postMessage` does not offer any request/response mechanics. You may send messages to another thread and you may independently receive messages from it, but you can't send a message and await a response to that specific message.

To quote the [Comlink](https://github.com/GoogleChromeLabs/comlink) library documentation:

**main.js**

```js
import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
async function init() {
	const worker = new Worker('worker.js');
	// WebWorkers use `postMessage` and therefore work with Comlink.
	const obj = Comlink.wrap(worker);
	alert(`Counter: ${await obj.counter}`);
	await obj.inc();
	alert(`Counter: ${await obj.counter}`);
}
init();
```

**worker.js**

```js
importScripts('https://unpkg.com/comlink/dist/umd/comlink.js');
// importScripts("../../../dist/umd/comlink.js");

const obj = {
	counter: 0,
	inc() {
		this.counter++;
	},
};

Comlink.expose(obj);
```

In our case, the exposed object is the [PHPClient](/docs/api/web.phpclient.html) instance.

## Scopes

Scopes keep your app working when you open it in two different different browser tabs.

The Service Worker passes the intercepted HTTP requests to the PHPRequestHandler for rendering. Technically, it sends a message through a [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) which then gets delivered to every browser tab where the application is open. This is undesirable, slow, and leads to unexpected behaviors.

Unfortunately, the Service Worker cannot directly communicate with the relevant Worker Thread – see [PR #31](https://github.com/WordPress/wordpress-playground/pull/31) and [issue #9](https://github.com/WordPress/wordpress-playground/issues/9) for more details.

Scopes enable each browser tab to:

-   Brand the outgoing HTTP requests with a unique tab id
-   Ignore any `BroadcastChannel` messages with a different id

Technically, a scope is a string included in the `PHPRequestHandler.absoluteUrl`. For example:

-   In an **unscoped app**, `/index.php` would be available at `http://localhost:8778/wp-login.php`
-   In an **scoped app**, `/index.php` would be available at `http://localhost:8778/scope:96253/wp-login.php`

The service worker is aware of this concept and will attach the `/scope:` found in the request URL to the related `BroadcastChannel` communication.

To use scopes, initiate the worker thread with a scoped `absoluteUrl`:

```js
import {
	PHP,
	setURLScope,
	exposeAPI,
	parseWorkerStartupOptions,
} from '@php-wasm/web';

// Don't use the absoluteURL directly:
const absoluteURL = 'http://127.0.0.1'

// Instead, set the scope first:
const scope = Math.random().toFixed(16)
const scopedURL = setURLScope(absoluteURL, scope).toString()

const { phpVersion } = parseWorkerStartupOptions<{ phpVersion?: string }>();
const php = await PHP.load('8.0', {
	requestHandler: {
		documentRoot: '/',
		absoluteUrl: scopedSiteUrl
	}
});

// Expose the API to app.ts:
const [setApiReady, ] = exposeAPI( php );
setApiReady();
```
