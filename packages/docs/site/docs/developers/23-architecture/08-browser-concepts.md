---
slug: /developers/architecture/browser-concepts
---

# Running PHP apps in the browser with ServiceWorkers and Worker Threads

On a high level, WordPress Playground works in web browsers as follows:

- The `index.html` file on playground.wordpress.net loads the `remote.html` file via an `<iframe src="/remote.html">`.
- `remote.html` starts a Worker Thread and a ServiceWorker and sends back the download progress information.
- The Worker Thread starts PHP and populates the filesystem with a WordPress patched to run on SQLite.
- The ServiceWorker starts intercepting all HTTP requests and forwarding them to the Worker Thread.
- `remote.html` creates an `<iframe src="/index.php">`, and the Service Worker forwards the `index.php` request to the Worker Thread where the WordPress homepage is rendered.

Visually, it looks like this:

![Architecture overview](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/architecture-overview.webp)

## High-level ideas

The [`@php-wasm/web`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/web/) is built on top of the following ideas:

- [**Browser tab orchestrates everything**](/developers/architecture/browser-tab-orchestrates-execution) – The browser tab is the main program. Closing or reloading it means destroying the entire execution environment.
- [**Iframe-based rendering**](/developers/architecture/browser-iframe-rendering) – Every response produced by the PHP server must be rendered in an iframe to avoid reloading the browser tab when the user clicks on a link.
- [**PHP Worker Thread**](/developers/architecture/browser-php-worker-threads) – The PHP server is slow and must run in a web worker, otherwise handling requests freezes the website UI.
- [**Service Worker routing**](/developers/architecture/browser-service-workers) – All HTTP requests originating in that iframe must be intercepted by a Service worker and passed on to the PHP worker thread for rendering.


## Isomorphic (Universal) Packages

Isomorphic (or universal) JavaScript packages are modules that can run both in the browser and in a Node.js environment without modification.

This allows developers to reuse the same code across frontend and backend, improving consistency and reducing duplication.

### Advantages

- Portability: Works in both browser and server environments  
- Code reuse: Same logic can be shared  
- Consistency: Behavior remains the same everywhere  

### Limitations

- Cannot directly use environment-specific APIs (like `window` or `fs`)  
- May require conditional logic  

### Example

#### Isomorphic Code
```js
export function greet(name) {
  return `Hello, ${name}!`;
}

### Browser-only Code
```bash
document.getElementById("app").innerHTML = "Hello!";

### Node.js-only Code
```bash
const fs = require("fs");
fs.readFileSync("file.txt");

---

## Save file

If nano:
- Press `CTRL + X`
- Press `Y`
- Press `Enter`

---

## ✅ 6. Check changes

```bash
git status