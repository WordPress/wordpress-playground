---
slug: /developers/apis/javascript-api
---

# JavaScript API

WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress.

<div class="callout callout-info">

**API here doesn't mean "REST API"**

WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API.

</div>

## Quick start

To use the JavaScript API, you'll need:

- An `<iframe>` element
- The Playground JavaScript client, loaded from `playground.wordpress.net` or installed from npm

### Load the client from playground.wordpress.net

You can load the client directly from `https://playground.wordpress.net/client/index.js`. No npm installation or build step is required. Use a `<script type="module">` element so you can import the client and use `await`.

Save the following example as `index.html` and serve it from a local web server, or paste it into an online HTML editor such as CodePen or JSFiddle:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	// Let's wait until Playground is fully loaded
	await client.isReady();
</script>
```

The import loads the JavaScript client into your page. `startPlaygroundWeb()` then loads WordPress in the iframe using `remoteUrl` and returns a client you can use to control it.

<div class="callout callout-info">

**/remote.html is a special URL**

`/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about [the difference between `/` and `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html).

Use `https://playground.wordpress.net/remote.html` for `remoteUrl` to connect to Playground. WordPress pages load from `wpsandbox.wordpress.net` automatically. You don't need to configure that address.

</div>

### Install the client from npm

If your application uses a bundler, install the client package:

```bash
npm install @wp-playground/client
```

Then replace the URL import in the example above with this import in your JavaScript module:

```javascript
const { startPlaygroundWeb } = await import('@wp-playground/client');
```

Keep `remoteUrl` set to `https://playground.wordpress.net/remote.html` to use the hosted Playground runtime.

## Controlling the website

Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that:

- [Playground API Client](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client)

## Debugging and testing

For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`.

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion.
