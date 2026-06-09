---
slug: /developers/apis/javascript-api
---

# JavaScript API

WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress.

<div class="callout callout-info">

<strong>API here doesn't mean "REST API"</strong>

WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is <strong>not</strong> a network-based REST API.

</div>

## Quick start

To use the JavaScript API, you'll need:

- An `<iframe>` element
- The `@wp-playground/client` package (from npm or a CDN)

Here's the shortest example of how to use the JavaScript API in a HTML page:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	// Use unpkg for convenience
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
	});
	// Let's wait until Playground is fully loaded
	await client.isReady();
</script>
```

<div class="callout callout-info">

<strong>/remote.html is a special URL</strong>

<code>/remote.html</code> is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about the difference between <code>/</code> and <code>/remote.html</code> and <a href="/developers/apis/javascript-api/-html-vs-remote-html">on this page</a>.

</div>

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
