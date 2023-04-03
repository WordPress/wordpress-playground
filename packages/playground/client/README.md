# Playground Client

Provides a WordPress Playground client you can bind to a Playground iframe 
to control the embedded WordPress site. Here's how to use it:

```ts
import { connectPlayground } from '@wp-playground/client';

const client = await connectPlayground(
	// An iframe pointing to https://playground.wordpress.net/remote.html
	document.getElementById('wp')! as HTMLIFrameElement
);
await client.isReady();
await client.goTo('/wp-admin/');

const result = await client.run({
	code: '<?php echo "Hi!"; ',
});
console.log(new TextDecoder().decode(result.body));
```
