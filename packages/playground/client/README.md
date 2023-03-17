# Playground Client

You can connect to the Playground instance using the JavaScript client:

```ts
import { connectPlayground } from '@wp-playground/client';

const client = await connectPlayground(
    document.getElementById('wp')! as HTMLIFrameElement,
    `https://wasm.wordpress.net/remote.html`
);
await client.isReady();
await client.goTo('/wp-admin/');

const result = await client.run({
    code: '<?php echo "Hi!"; ',
});
console.log(new TextDecoder().decode(result.body));
```

## Building

Run `nx build playground-client` to build the library.

## Running unit tests

Run `nx test playground-client` to execute the unit tests via [Jest](https://jestjs.io).
