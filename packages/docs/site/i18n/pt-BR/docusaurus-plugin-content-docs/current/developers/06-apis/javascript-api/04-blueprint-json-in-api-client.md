---
slug: /developers/apis/javascript-api/blueprint-json-in-api-client
---

<!-- # Blueprints JSON and the API Client -->

# Blueprints em JSON e o cliente da API

<!-- The Playground API client can be initialized with a [JSON Blueprint](/blueprints). This is a convenient way of preconfiguring it in any way you like without worrying about progress bars and fetching remote files. -->

Você pode inicializar o cliente da API do Playground com um [Blueprint em JSON](/blueprints). Assim, você pode pré-configurar o Playground como quiser, sem precisar gerenciar barras de progresso nem baixar arquivos remotos.

<!-- Add an iframe with the `wp` ID to your page: -->

Adicione à sua página um iframe com o ID `wp`:

```html
<iframe id="wp"></iframe>
```

```ts
import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

const iframe = document.querySelector<HTMLIFrameElement>('iframe#wp');
if (!iframe) {
	throw new Error('Could not find <iframe id="wp"> on the page.');
}

const client = await startPlaygroundWeb({
	iframe,
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

<!-- To run a JSON Blueprint during initialization, pass it in the `blueprint` option of `startPlaygroundWeb()`. -->

Para executar um Blueprint em JSON durante a inicialização, passe-o na opção `blueprint` de `startPlaygroundWeb()`.

<!-- If this is sufficient for your needs, read more about [JSON Blueprints](/blueprints). -->

Se essa abordagem atender às suas necessidades, saiba mais sobre [Blueprints em JSON](/blueprints).

<!-- If you need to work with an already initialized client, you should look into [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client). -->

Se precisar trabalhar com um cliente já inicializado, consulte as [funções de Blueprint](/developers/apis/javascript-api/blueprint-functions-in-api-client).
