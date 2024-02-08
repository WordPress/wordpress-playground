# Playground Client

Provides a [PlaygroundClient](https://wordpress.github.io/wordpress-playground/api/client/) that can be used to control a WordPress Playground iframe:

```ts
import { startPlaygroundWeb } from '@wp-playground/client';

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

Using TypeScript is highly recommended as this package ships with comprehensive types – hit ctrl+space in your IDE after `client.` and you'll see all the available methods.

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
