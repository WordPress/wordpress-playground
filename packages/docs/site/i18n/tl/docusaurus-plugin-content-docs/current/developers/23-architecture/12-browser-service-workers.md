---
slug: /developers/architecture/browser-service-workers
---

# Service Workers

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

Enter [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) – a tool to intercept the HTTP requests and handle them inside the browser:

![Service worker data flow](@site/static/img/workers-diagram.png)

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
