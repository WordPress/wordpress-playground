---
slug: /developers/apis/javascript-api/blueprint-functions-in-api-client
---

<!-- # Blueprints Functions and the API Client -->

# Funções de Blueprints e o cliente da API

<!-- Every Blueprint step you can declare in the JSON object also provides a handler function that can be used directly. -->

Cada etapa de Blueprint que você pode declarar no objeto JSON também oferece uma função que pode ser chamada diretamente.

<!-- For example: -->

Por exemplo:

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
	pluginData: await fetch(pluginUrl),
});
```

<!-- For more information and live examples visit the [Blueprints Steps page](/blueprints/steps). -->

Para mais informações e exemplos interativos, consulte a [página de etapas de Blueprints](/blueprints/steps).
