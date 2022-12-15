# WordPress Playground

WordPress Playground is a WordPress running in the browser without a PHP server.

[Try the demo](https://developer.wordpress.org/playground/demo/) to experiment with an anonymous WordPress website where you can test-drive plugins and themes.

## Getting started

### Embedding the WordPress Playground demo

You can embed WordPress Playground using an iframe. **Note this is an experimental feature that may break or change without a warning.**

```html
<iframe
    style="width: 800px; height: 500px;"
    src="https://wasm.wordpress.net/wordpress.html?mode=seamless"
></iframe>
```

Learn more about the configuration options and JavaScript API at [embedding WordPress Playground on other websites](./embedding-wordpress-playground-on-other-websites.md).

### Setting up your local development environment

To customize WordPress Playground and build on top of it, you will need to work directly with the GitHub repository. Don't worry, **you don't need to know WebAssembly.** Most of the meaningful work happens in the JavaScript and PHP land.

Start by creating a local development environment:

```js
git clone https://github.com/WordPress/wordpress-playground
cd wordpress-playground
npm install
npm run dev
```

A browser should open and take you to your very own WordPress Playground at `http://127.0.0.1:8777/wordpress.html`!

## Architecture overview

![Architecture overview](https://raw.githubusercontent.com/wordpress/wordpress-playground/trunk/docs/boot-sequence.png)

In broad strokes:

* `wordpress.html` starts the Worker Thread and a ServiceWorker
* The Worker Thread starts PHP and populates the filesystem with WordPress files
* The ServiceWorker starts intercepting all HTTP requests and forwarding them to the Worker Thread
* `wordpress.html` creates an `<iframe src="/index.php">` where the WordPress homepage is rendered

## Next steps

Dig into the specific parts of the project:

* [Compiling PHP to WebAssembly and using it in JavaScript](./using-php-in-javascript.md)
* [Running PHP apps in the browser with ServiceWorkers and Worker Threads](./using-php-in-the-browser.md)
* [Bundling WordPress for the browser](./bundling-wordpress-for-the-browser.md)
* [Running WordPress in the browser](./running-wordpress-in-the-browser.md)
* [Embedding WordPress Playground on other websites](./embedding-wordpress-playground-on-other-websites.md)
* [Implementing a live WordPress code editor](./wordpress-plugin-ide.md)
