# Playground Client

Provides a [PlaygroundClient](https://wordpress.github.io/wordpress-playground/api/client/) that can be used to control a WordPress Playground iframe.

In browser applications, consume the client over HTTP from the same Playground deployment that serves `remote.html`:

```js
import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

const client = await startPlaygroundWeb({
	// An iframe pointing to https://playground.wordpress.net/remote.html:
	iframe: document.getElementById('wp'),
	remoteUrl: `https://playground.wordpress.net/remote.html`,
});

const response = await client.run({
	// wp-load.php is only required if you want to interact with WordPress.
	code: '<?php require_once "/wordpress/wp-load.php"; $posts = get_posts(); echo "Post Title: " . $posts[0]->post_title;',
});
console.log(response.text);
```

Loading the client from `https://playground.wordpress.net/client/index.js` keeps it in sync with the remote Playground runtime. The client and the iframe communicate over an internal protocol, and backwards compatibility is guaranteed by serving a matching client and remote from the same deployment.

## npm package

The npm package exists for projects that want to install `@wp-playground/client` through a package manager, bundle it with their application, or use its TypeScript declarations locally.

Prefer the direct `https://playground.wordpress.net/client/index.js` import for browser applications that use the hosted Playground runtime. An npm-installed client can drift from the `remote.html` it controls, and that may expose protocol mismatches between the parent page and iframe. If you use the npm package, make sure the client and remote runtime are versioned together.

The npm package ships comprehensive types for the client API. In TypeScript, your editor can show the available methods after `client.`.

## TypeScript declarations

The published npm package ships one bundled declaration file, `index.d.ts`. That file is generated from `src/index.ts` and inlines the Playground and PHP-WASM types that are reachable from the public client API.

This is intentional. `@wp-playground/client` exposes types such as Blueprints, PHP responses, mounts, and filesystem options that are implemented across several packages in this monorepo. Consumers should not need to install or resolve those internal workspace packages just to type-check code that imports `@wp-playground/client`.

The build verifies this by checking that the published package contains a single declaration file and that `index.d.ts` does not import from other packages.

Known limitation: The bundled declarations are not yet guaranteed to pass `skipLibCheck: false` in every TypeScript and DOM library combination. The rollup includes lower-level Playground APIs, and strict declaration checking may still surface environment-specific type issues such as Node `Buffer` references or `File.stream()` compatibility. These issues do not affect the usual `PlaygroundClient` API usage.

Once you have a [PlaygroundClient](https://wordpress.github.io/wordpress-playground/api/client/) instance, you can use it to control the playground:

```ts
await client.writeFile('/index.php', '<?php echo "Hi!"; ');
await client.run({
	scriptPath: '/index.php',
});

console.log(await client.readFileAsText('/index.php'));

await client.request({
	url: '/index.php',
	method: 'POST',
	body: {
		foo: 'bar',
	},
});
```

To see all the available methods, check out the [PlaygroundClient](https://wordpress.github.io/wordpress-playground/api/client/) interface.
