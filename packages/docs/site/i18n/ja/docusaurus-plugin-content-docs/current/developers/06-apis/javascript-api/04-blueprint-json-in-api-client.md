---
slug: /developers/apis/javascript-api/blueprint-json-in-api-client
---

# ブループリント JSON と API クライアント

<!--
# Blueprints JSON and the API Client
-->

Playground API クライアントは、[JSON ブループリント](/blueprints)を使用して初期化できます。これは、プログレスバーやリモートファイルの取得などを気にすることなく、好きなように事前に設定できる便利な方法です。

<!--
The Playground API client can be initialized with a [JSON Blueprint](/blueprints). This is a convenient way of preconfiguring it in any way you like without worrying about progress bars and fetching remote files:
-->

```ts
import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://playground.wordpress.net/remote.html`,
	blueprint: {
		preferredVersions: {
			wp: '6.3',
			php: '8.3',
		},
		steps: [
			{ step: 'login' },
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'gutenberg',
				},
			},
		],
	},
});
await client.isReady();
```

JSON ブループリントの実行は、API クライアントの初期化時にのみ可能です。

<!--
Running a JSON Blueprint is only possible during the initialization of the API client.
-->

これがあなたのニーズを満たすのであれば、[JSON ブループリント](/blueprints)について詳しくお読みください。

<!--
If this is sufficient for your needs, read more about [JSON Blueprints](/blueprints).
-->

既に初期化済みのクライアントを操作する必要がある場合は、[ブループリント関数](/developers/apis/javascript-api/blueprint-functions-in-api-client)を参照してください。

<!--
If you need to work with an already initialized client, you should look into [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client).
-->
