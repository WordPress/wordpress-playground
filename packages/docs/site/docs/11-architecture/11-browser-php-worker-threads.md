# PHP Worker Threads

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

Conveniently, [consumeAPI](/api/web/function/consumeAPI) returns an easy-to-use API object that exposes specific worker thread features and handles the message exchange internally.

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

**/app.js**:

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
