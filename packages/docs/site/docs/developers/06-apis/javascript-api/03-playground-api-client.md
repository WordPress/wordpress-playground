---
slug: /developers/apis/javascript-api/playground-api-client
---

# Playground API Client

The `PlaygroundClient` object implements the `UniversalPHP` interface. All the methods from that interface are also available in Node.js and same-process PHP instances (Playground runs PHP in a web worker).

Broadly speaking, you can use the client to perform three types of operations:

- Running PHP code
- Customizing `PHP.ini`
- Managing files and directories

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

## Running PHP code

The two methods you can use to run PHP code are:

- [`run()`](#the-run-method) - runs PHP code and returns the output
- [`request()`](#the-request-method) - makes an HTTP request to the website

In Node.js, you can also use the [`cli()`](#the-cli-method) method to run PHP in a CLI mode.

### The `run()` method

<!-- The handbook imports static/handbook/playground-api-client.md, generated
from this page and TypeDoc by bin/generate-handbook-api-client.js. Keep the
TSDocstring components here so the generated API descriptions stay in sync. -->

import TSDocstring from '@site/src/components/TSDocstring';

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "run" ]} />

### The `request()` method

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "request" ]} />

## Customizing `PHP.ini`

The API client also allows you to change the `php.ini` file:

```ts
await setPhpIniEntries(client, {
	display_errors: 'On',
	error_reporting: 'E_ALL',
});
```

## Managing files and directories

The `client` object provides you with a low-level API for managing files and directories in the PHP filesystem:

```ts
await client.mkdirTree('/wordpress/test');
// Create a new PHP file
await client.writeFile(
	'/wordpress/test/index.php',
	`<?php
     echo "Hello, world!<br/>";
     // List all the files in current directory
     print_r(glob(__DIR__ . '/*'));
  `
);
// Create files named 1, 2, and 3
await client.writeFile('/wordpress/test/1', '');
await client.writeFile('/wordpress/test/2', '');
await client.writeFile('/wordpress/test/3', '');
// Remove the file named 1
await client.unlink('/wordpress/test/1');
// Navigate to our PHP file
await client.goTo('/test/index.php');
```

For a complete list of these methods, refer to the `PlaygroundClient` interface.

## Sending messages to JavaScript

You can pass messages from PHP to JavaScript using the `post_message_to_js()` function. It accepts one argument:

- `$data` (string) – Data to pass to JavaScript.

For example, here's how you would send a message with a JSON-encoded post ID and title:

```TypeScript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

php.onMessage(
	// The data is always passed as a string
	function (data: string) {
		// Let's decode and log the data:
		console.log(JSON.parse(data));
	}
);

// Now that we have a listener in place, let's
// dispatch a message:
await php.runStream({
	code: `<?php
        post_message_to_js(
            json_encode([
                'post_id' => '15',
                'post_title' => 'This is a blog post!'
            ])
        );
    `,
});

// You will see the following output in the console:
// { post_id: '15', post_title: 'This is a blog post!' }
```

## The `cli()` method

In Node.js, you also have access to the `cli()` method that runs PHP in a CLI mode:

```ts
// Run PHP in a CLI mode
client.cli(['-r', 'echo "Hello, world!";']);
// Outputs "Hello, world!"
```

Once `cli()` method finishes running, the PHP instance is no longer usable and should be discarded. This is because PHP internally cleans up all the resources and calls `exit()`.
