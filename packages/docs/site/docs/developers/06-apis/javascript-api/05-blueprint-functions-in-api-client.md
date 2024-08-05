---
slug: /developers/apis/javascript-api/blueprint-functions-in-api-client
---

# Blueprints Functions and the API Client

Every Blueprint step you can declare in the JSON object also provides a handler function that can be used directly.

For example:

```ts
import { startPlaygroundWeb, login, installPlugin } from 'https://playground.wordpress.net/client/index.js';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://playground.wordpress.net/remote.html`,
});
await client.isReady();

await login(client, {
	username: 'admin',
	password: 'password',
});

await installPlugin(client, {
	// Resources can only be used with JSON Blueprints.
	// If you use functions, you must provide the resolved
	// file.
	pluginZipFile: await fetch(pluginUrl),
});
```

For more information and live examples visit the [Blueprints Steps page](../../../blueprints/05-steps.md).
