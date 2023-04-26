# Playground Client

Provides a [PlaygroundClient](https://wordpress.github.io/wordpress-playground/interfaces/_wp_playground_client.PlaygroundClient.html) that can be used to control a WordPress Playground iframe:

```ts
import { startPlaygroundWeb } from '@wp-playground/client';

const client = await startPlaygroundWeb({
	// An iframe pointing to https://playground.wordpress.net/remote.html:
	iframe: document.getElementById('wp'),
	remoteUrl: `https://playground.wordpress.net/remote.html`,
});

const response = await client.run({
	code: '<?php echo "Hi!"; ',
});
console.log(response.text);
```

Using TypeScript is highly recommended as this package ships with comprehensive types – hit ctrl+space in your IDE after `client.` and you'll see all the available methods.

Once you have a [PlaygroundClient](https://wordpress.github.io/wordpress-playground/interfaces/_wp_playground_client.PlaygroundClient.html) instance, you can use it to control the playground:

```ts
await client.writeFile('/index.php', '<?php echo "Hi!"; ');
await client.run({
	scriptPath: '/index.php',
});

console.log(await client.readFileAsText('/index.php'));

await client.request({
	url: '/index.php',
	method: 'POST',
	formData: {
		foo: 'bar',
	},
});
```

To see all the available methods, check out the [PlaygroundClient](https://wordpress.github.io/wordpress-playground/interfaces/_wp_playground_client.PlaygroundClient.html) interface.
