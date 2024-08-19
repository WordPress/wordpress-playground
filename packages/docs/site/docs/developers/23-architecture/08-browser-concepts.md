# Running PHP apps in the browser with ServiceWorkers and Worker Threads

On a high level, WordPress Playground works in web browsers as follows:

-   The `index.html` file on playground.wordpress.net loads the `remote.html` file via an `<iframe src="/remote.html">`.
-   `remote.html` starts a Worker Thread and a ServiceWorker and sends back the download progress information.
-   The Worker Thread starts PHP and populates the filesystem with a WordPress patched to run on SQLite.
-   The ServiceWorker starts intercepting all HTTP requests and forwarding them to the Worker Thread.
-   `remote.html` creates an `<iframe src="/index.php">`, and the Service Worker forwards the `index.php` request to the Worker Thread where the WordPress homepage is rendered.

Visually, it looks like this:

![Architecture overview](@site/static/img/architecture-overview.png)

## High-level ideas

The [`@php-wasm/web`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/web/) is built on top of the following ideas:

-   [**Browser tab orchestrates everything**](./09-browser-tab-orchestrates-execution.md) – The browser tab is the main program. Closing or reloading it means destroying the entire execution environment.
-   [**Iframe-based rendering**](./10-browser-iframe-rendering.md) – Every response produced by the PHP server must be rendered in an iframe to avoid reloading the browser tab when the user clicks on a link.
-   [**PHP Worker Thread**](./11-browser-php-worker-threads.md) – The PHP server is slow and must run in a web worker, otherwise handling requests freezes the website UI.
-   [**Service Worker routing**](./12-browser-service-workers.md) – All HTTP requests originating in that iframe must be intercepted by a Service worker and passed on to the PHP worker thread for rendering.
