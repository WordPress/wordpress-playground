# Use PHP in the browser

`php-wasm` makes running PHP code in JavaScript easy, but running PHP websites in the browser is more complex than just executing some code.

Say a PHP script renders a link and a user clicks that link. Normally, the browser sends a HTTP request to a server and reloads the page. What should happen when there is no server and reloading the page means losing all progress?

Enter `php-wasm-browser`! A set of tools to solve the common headaches of running PHP websites in the browser.

## Execution model

This package proposes:

* **Browser tab orchestrates the execution** – The browser tab is the main program. Closing or reloading it means destroying the entire execution environment.
* **Iframe-based rendering** – Every response produced by the PHP server must be rendered in an iframe to avoid reloading the browser tab on navigation.
* **PHP Worker Thread** – The PHP server is slow and must run in a worker thread, otherwise handling requests freezes the website UI.
* **Service Worker routing** – All HTTP requests originating in that iframe must be intercepted by a Service worker and passed on to the PHP worker thread for rendering.

That's a lot of information to take in! Keep reading for the detailed breakdown.

### Browser tab orchestrates the execution

### Iframe-based rendering

Imagine a simple HTML page:

```html
<a href="/">Click here</a>
```

#### Caveats

* `target="_top"` isn't handled yet. This means that clicking on `<a target="_top">Click here</a>` will reload the main browser tab.
* JavaScript popup windows originating in the iframe may not work correctly yet.

### PHP Worker Threads

The PHP Server is always ran in a separate thread called the "worker thread." This is to ensure the PHP runtime doesn't slow down the website.

Imagine the following code:

```js
<button onclick="for(let i=0;i<100000000;i++>) {}">Freeze the page</button>
<input type="text" />
```

As soon as you click that button the browser will freeze and you won't be able to type in the input. That's just how browsers work. Whether it's a for loop or a PHP server, running intensive tasks slows down the user interface.

#### Initiating the worker thread

Worker threads are separate programs that can process heavy tasks outside of the main application. They must be initiated by the main JavaScript program living in the browser tab. Here's how:

```js
const workerThread = await startPHPWorkerThread({
    // Multiprocessing backend:
    backend: webWorkerBackend('/worker-thread.js'),

    // PHPServer URL:
    absoluteUrl: 'http://127.0.0.1:8777/'
});
workerThread.eval(`<?php
    echo "Hello from the thread!";
`);
```

Worker threads can use any multiprocessing technique like an iframe, WebWorker, or a SharedWorker. See the next sections to learn more about the supported backends.

#### Controlling the worker thread

The main application controls the worker thread by sending and receiving messages. This is implemented via a backend-specific flavor of `postMessage` and `addEventListener('message', fn)`.

Exchanging messages is the only way to control the worker threads. Remember – it is separate programs. The main app cannot access any functions or variables defined inside of the worker thread.

Conveniently, `startPHPWorkerThread` returns an easy-to-use API object that exposes specific worker thread features and handles the message exchange internally. Here it is:

<!-- include the reference documentation -->

#### Worker thread implementation

A worker thread must live in a separate JavaScript file. Here's what a minimal implementation of that file looks like:

```js
import { initializeWorkerThread } from 'php-wasm-browser';
initializeWorkerThread();
```

It may not seem like much, but `initializeWorkerThread()` does a lot of
the heavy lifting. Here's its documentation:

<!-- include the initializeWorkerThread() reference documentation -->


#### Worker thread backends

Calling `startPHPWorkerThread` runs `initializeWorkerThread()` in a concurrent thread.

Worker threads can use any multiprocessing technique like an iframe, WebWorker, or a SharedWorker.

This package provides the following backends out of the box:

##### `webWorkerBackend`

<!-- include the reference documentation of webWorkerBackend -->

##### `iframeBackend`

<!-- Include the reference documentation of iframeBackend -->
<!-- Include information about the Double domain trick and  the Origin-Agent-Cluster feature -->

### Service Worker routing

#### Messaging layer

Request/reply protocol

#### Scopes
#### URL rewriting / server setup

## Utilities

### Progress monitor

