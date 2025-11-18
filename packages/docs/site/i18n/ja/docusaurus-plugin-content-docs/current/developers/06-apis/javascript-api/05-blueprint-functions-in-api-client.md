---
slug: /developers/apis/javascript-api/blueprint-functions-in-api-client
---

# ブループリントの機能と API クライアント

<!--
# Blueprints Functions and the API Client
-->

JSON オブジェクト内で宣言できるすべてのブループリントステップには、直接使用できるハンドラー関数も用意されています。

<!--
Every Blueprint step you can declare in the JSON object also provides a handler function that can be used directly.
-->

例えば：

<!--
For example:
-->

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

詳細情報や実際の使用例については、[ブループリントの手順ページ](/blueprints/steps)をご覧ください。

<!--
For more information and live examples visit the [Blueprints Steps page](/blueprints/steps).
-->
