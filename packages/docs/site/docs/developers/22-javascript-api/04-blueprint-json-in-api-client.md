---
sidebar_position: 3
---

# Blueprints JSON and the API Client

The Playground API client can be initialized with a [JSON Blueprint](../../blueprints/01-index.md). This is a convenient way of preconfiguring it in any way you like without worrying about progress bars and fetching remote files:

```ts
import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://playground.wordpress.net/remote.html`,
	blueprint: {
		preferredVersions: {
			wp: '6.3',
			php: '8.0',
		},
		// Optional: downloads additional PHP extensions like DOMDocument, mbstring, etc.
		extensionBundles: ['kitchen-sink'],
		steps: [
			{ step: 'login' },
			{
				step: 'installPlugin',
				pluginZipFile: {
					resource: 'wordpress.org/plugins',
					slug: 'gutenberg',
				},
			},
		],
	},
});
await client.isReady();
```

Running a JSON Blueprint is only possible during the initialization of the API client.

If this is sufficient for your needs, read more about [JSON Blueprints](../../blueprints/01-index.md).

If you need to work with an already initialized client, you should look into [Blueprint functions](./05-blueprint-functions-in-api-client.md).
