---
sidebar_position: 2
---

# Playground API Client

The `PlaygroundClient` object implements the `UniversalPHP` interface. All the methods from that interface are also available in Node.js and same-process PHP instances (Playground runs PHP in a web worker).

Broadly speaking, you can use the client to perform three types of operations:

-   Running PHP code
-   Customizing PHP.ini
-   Managing files and directories

## Running PHP code

The two methods you can use to run PHP code are:

-   [`run()`](#the-run-method) - runs PHP code and returns the output
-   [`request()`](#the-request-method) - makes an HTTP request to the website

In Node.js, you can also use the [`cli()`](#the-cli-method) method to run PHP in a CLI mode.

### The run() method

import TSDocstring from '@site/src/components/TSDocstring';

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "run" ]} />

### The request() method

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "request" ]} />

## Customizing PHP.ini

The API client also allows you to change the php.ini file:

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

For a full list of these methods, consult the PlaygroundClient interface.

## Sending messages to JavaScript

You can pass messages from PHP to JavaScript using the `post_message_to_js()` function. It accepts one argument:

-   `$data` (string) – Data to pass to JavaScript.

For example, here's how you would send a message with a JSON-encoded post ID and title:

```ts
const php = await PHP.load('8.0');

php.onMessage(
	// The data is always passed as a string
	function (data: string) {
		// Let's decode and log the data:
		console.log(JSON.parse(data));
	}
);

// Now that we have a listener in place, let's
// dispatch a message:
await php.run({
	code: `<?php
        post_message_to_js(
            json_encode([
                'post_id' => '15',
                'post_title' => 'This is a blog post!'
            ])
        ));
    `,
});

// You will see the following output in the console:
// { post_id: '15', post_title: 'This is a blog post!' }
```

## The cli() method

In Node.js, you also have access to the `cli()` method that runs PHP in a CLI mode:

```ts
// Run PHP in a CLI mode
client.cli(['-r', 'echo "Hello, world!";']);
// Outputs "Hello, world!"
```

Once cli() method finishes running, the PHP instance is no\* longer usable and should be discarded. This is because PHP internally cleans up all the resources and calls exit().
