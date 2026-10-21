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

## Embedding with separate WordPress origins

The WordPress-origin prototype keeps the app and SDK endpoints on the app origin.
Existing iframe URLs and SDK calls work without a referrer or new URL parameters,
including nested external embeds. See the
[prototype boundaries and limits](../website/bin/wordpress-frame/README.md#limits).

## SharedWorker runtime

`startPlaygroundWeb()` uses a dedicated worker by default. Applications can opt into
sharing one PHP runtime across tabs on the same origin and browser storage partition.
Serve the matching client and remote runtime from the application's own deployment:

```js
const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: new URL('/remote.html', window.location.href).href,
	workerMode: 'shared',
	scope: 'my-site',
});
```

Shared mode requires browser SharedWorker support and an explicit `scope`. Tabs using
the same scope and build share the initialized site; use different scopes for independent
runtimes. Only the initializing connection runs its startup Blueprint. Closing its tab
once initialization finishes does not interrupt the other tabs. The main Playground
website continues to use dedicated workers.

By default, both version options use the remote runtime's build version. Applications
that check deployments themselves can pass `sharedWorkerVersion` for the current deployment
and `sharedWorkerClientVersion` for the build loaded by the connecting application. If they
differ, the tab must reload before connecting. A new deployment discovers the previous
worker through localStorage and waits for its shutdown confirmation before replacement.
If that identity is lost or the worker cannot be reached, a replacement may start while
the previous runtime is still running; there is no ownership lock.

The embedding application must handle same-origin `playground-reload-required` messages
from its remote iframe and offer a tab reload. The message's `ready` field indicates
whether shutdown is complete; otherwise wait for `playground-runtime-closed` before
allowing reload. A `shared-runtime-retirement-error` message reports a retirement failure.
Validate the message origin and source against the embedded remote iframe.

`await client.shutdownSharedRuntime()` explicitly retires the runtime for all connected
tabs: it rejects new work, drains active operations, flushes OPFS, and disposes PHP. It
rejects if retirement fails and is a no-op in dedicated mode. The
`shouldRunStartupBlueprint()` and `finishSharedRuntimeInitialization()` methods are
internal startup coordination hooks; applications should let `startPlaygroundWeb()` call them.

## Saved-site export API

`startPlaygroundAPI()` exposes an API for working with Playgrounds without booting WordPress, PHP, workers, or a service worker. Currently, it only supports exporting saved OPFS sites.

To export a saved OPFS site:

- The API endpoint must share the origin and browser storage partition used to save the site.
- In WebKit, saving and exporting must use the same top-level origin, including its scheme, host, and port. A site saved while Playground is the top-level page is not visible to an API iframe embedded under a different top-level origin.

The `/api.html` entry point is part of the full Playground website deployment. It is not included in the `@wp-playground/remote` npm package.

```js
import { startPlaygroundAPI } from 'https://playground.wordpress.net/client/index.js';

const iframe = document.createElement('iframe');
iframe.hidden = true;
iframe.sandbox.add('allow-scripts');
iframe.sandbox.add('allow-same-origin');
document.body.appendChild(iframe);

const api = await startPlaygroundAPI({
	iframe,
	apiUrl: 'https://playground.wordpress.net/api.html',
});
const zip = await api.exportSavedSiteAsZip('my-site', {
	excludePatterns: ['/*', '!/wp-content/', '!/wp-content/**'],
});
```

The optional `excludePatterns` use gitignore semantics: matching paths are excluded, later patterns take precedence, and a leading `!` re-includes a path. When `excludePatterns` is omitted, the ZIP contains the complete saved site.

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
