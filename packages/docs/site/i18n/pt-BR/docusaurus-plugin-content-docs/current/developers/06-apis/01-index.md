---
title: Visão geral das APIs
slug: /developers/apis/
---

<!-- ## WordPress Playground APIs overview -->

## Visão geral das APIs do WordPress Playground {#wordpress-playground-apis-overview}

<!-- WordPress Playground exposes a few APIs that you can use to interact with the Playground: -->

O WordPress Playground oferece algumas APIs que você pode usar para interagir com o Playground:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- ### Query API -->

### Query API {#query-api}

<!-- Basic operations can be done by adjusting the URL, for example here's how you can preinstall a coblocks plugin: -->

Operações básicas podem ser feitas ajustando a URL. Por exemplo, veja como pré-instalar o plugin coblocks:

[https://playground.wordpress.net/?plugin=coblocks](https://playground.wordpress.net/?plugin=coblocks)

<!-- Or a theme: -->

Ou um tema:

[https://playground.wordpress.net/?theme=pendant](https://playground.wordpress.net/?theme=pendant)

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/). Once you have a URL that you like, you can embed it in your website using an iframe:
-->

Isso se chama [Query API](/developers/apis/query-api/), e você pode saber mais sobre ela [aqui](/developers/apis/query-api/). Quando tiver uma URL de que goste, você pode incorporá-la ao seu site usando um iframe:

```html
<iframe style="width: 800px; height: 500px;" src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

<div class="callout callout-info">

<!-- Check the [Query API](/developers/apis/query-api) section for more info. -->

Consulte a seção [Query API](/developers/apis/query-api) para mais informações.

</div>

<!-- ### Blueprints -->

### Blueprints {#blueprints}

<!--
If you need more control over your Playground, you can use JSON Blueprints. For example, here's how to create a post and install a plugin:
-->

Se você precisar de mais controle sobre o seu Playground, pode usar Blueprints em JSON. Por exemplo, veja como criar um post e instalar um plugin:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
display={`{
  "steps": [
    {
      "step": "login"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "friends"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1)); ?>"
    }
  ]
}` }
blueprint={{
		"steps": [
            {
                "step": "login"
            },
            {
            step: 'installPlugin',
                pluginData: {
                    resource: 'wordpress.org/plugins',
                    slug: 'friends',
                },
            },
			{
				"step": "runPHP",
				"code": `<?php
require_once '/wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

<p></p>

<div class="callout callout-info">

<!--
Blueprints play a significant role in WordPress Playground, so they have their own dedicated documentation hub. Learn more about JSON Blueprints at the [Blueprints Docs Hub](/blueprints).
-->

Os Blueprints têm um papel importante no WordPress Playground, por isso têm uma central de documentação própria. Saiba mais sobre os Blueprints em JSON na [Central de documentação de Blueprints](/blueprints).

</div>

<!-- ### Sites API -->

### Sites API {#sites-api}

<!--
The Playground website at [playground.wordpress.net](https://playground.wordpress.net) exposes a `window.playgroundSites` object for managing the sites shown in the Dock's **Playgrounds** pane — listing them, creating new ones, persisting temporary sites to OPFS or local disk, switching between them, and changing PHP version or networking.
-->

O site do Playground em [playground.wordpress.net](https://playground.wordpress.net) oferece um objeto `window.playgroundSites` para gerenciar os sites exibidos no painel **Playgrounds** do Dock: listá-los, criar novos, salvar sites temporários no OPFS ou no disco local, alternar entre eles e mudar a versão do PHP ou o acesso à rede.

```javascript
await playgroundSites.createNewTemporarySite('demo', { phpVersion: '8.4' });
await playgroundSites.saveInBrowser('My demo site');
const client = playgroundSites.getClient();
```

<div class="callout callout-info">

<!-- Check the [Sites API](/developers/apis/sites-api) section for more info. -->

Consulte a seção [Sites API](/developers/apis/sites-api) para mais informações.

</div>

<!-- ### JavaScript API -->

### JavaScript API {#javascript-api}

<!--
The `@wp-playground/client` package provides a JavaScript API you can use to fully control your Playground instance. Here's a simple example of what you can do:
-->

O pacote `@wp-playground/client` oferece uma API JavaScript que você pode usar para controlar totalmente a sua instância do Playground. Veja um exemplo simples do que é possível fazer:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
	});
	// Let's wait until Playground is fully loaded
	await client.isReady();
</script>
```

<div class="callout callout-info">

<!-- Check the [JavaScript API](/developers/apis/javascript-api/) section for more info. -->

Consulte a seção [JavaScript API](/developers/apis/javascript-api/) para mais informações.

</div>

<!-- ## Playground APIs Concepts -->

## Conceitos das APIs do Playground {#playground-apis-concepts}

<!--
WordPress Playground in the browser is all about links and iframes. Regardless of which API you choose, you will use it in one of the following ways:
-->

No navegador, o WordPress Playground gira em torno de links e iframes. Qualquer que seja a API escolhida, você vai usá-la de uma das seguintes formas:

<!-- ### Link to the Playground site -->

### Link para o site do Playground {#link-to-the-playground-site}

<!--
You can customize WordPress Playground by modifying the https://playground.wordpress.net/ link. You can, for example, create a post, request a specific plugin, or run any PHP code.
-->

Você pode personalizar o WordPress Playground modificando o link https://playground.wordpress.net/. É possível, por exemplo, criar um post, solicitar um plugin específico ou executar qualquer código PHP.

<!--
To prepare such a link, use either the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).
-->

Para preparar esse link, use a [Query API](/developers/apis/query-api) (fácil) ou a [API de Blueprints em JSON](/blueprints) (intermediária).

<!--
Once it's ready, simply post it on your site. It makes a great "Try it yourself" button in a tutorial, for example.
-->

Quando estiver pronto, basta publicá-lo no seu site. Ele funciona muito bem como um botão "Experimente você mesmo" em um tutorial, por exemplo.

<!-- #### Embed in an `<iframe>` -->

#### Incorporar em um `<iframe>` {#embed-in-an-iframe}

<!-- WordPress Playground can be embedded in your app using an `<iframe>`: -->

O WordPress Playground pode ser incorporado à sua aplicação usando um `<iframe>`:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

<!-- To customize that Playground instance, you can: -->

Para personalizar essa instância do Playground, você pode:

<!--
- Load it from special link prepared using the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).
- Control it using the [JavaScript API](/developers/apis/javascript-api/).
-->

- Carregá-la a partir de um link especial preparado com a [Query API](/developers/apis/query-api) (fácil) ou com a [API de Blueprints em JSON](/blueprints) (intermediária).
- Controlá-la usando a [JavaScript API](/developers/apis/javascript-api/).

<!--
The JavaScript API gives you the most control, but it is also the least convenient option as it requires loading the Playground Client library.
-->

A JavaScript API oferece o maior controle, mas também é a opção menos prática, pois exige carregar a biblioteca Playground Client.

<div class="callout callout-warning">

<!-- **Careful with the demo site** -->

**Cuidado com o site de demonstração**

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

O site https://playground.wordpress.net existe para apoiar a comunidade, mas não há garantia de que ele continuará funcionando se o tráfego crescer muito.

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

Se você precisa de uma disponibilidade garantida, deve [hospedar o seu próprio WordPress Playground](/developers/architecture/host-your-own-playground).

</div>

<!-- ### Browser APIs -->

### APIs no navegador {#browser-apis}

<!-- The following Playground APIs are available in the browser: -->

As seguintes APIs do Playground estão disponíveis no navegador:

<!--
- [Query API](/developers/apis/query-api) enable basic operations using only query parameters
- [Blueprints API](/blueprints) give you a great degree of control with a simple JSON file
- [Sites API](/developers/apis/sites-api) lets scripts running on playground.wordpress.net manage saved sites
- [JavaScript API](/developers/apis/javascript-api) give you full control via a JavaScript client from an npm package
-->

- A [Query API](/developers/apis/query-api) permite operações básicas usando apenas parâmetros na URL
- A [API de Blueprints](/blueprints) oferece um alto grau de controle com um simples arquivo JSON
- A [Sites API](/developers/apis/sites-api) permite que scripts executados em playground.wordpress.net gerenciem os sites salvos
- A [JavaScript API](/developers/apis/javascript-api) oferece controle total por meio de um cliente JavaScript de um pacote npm

<!-- ### In Node.js -->

### No Node.js {#in-nodejs}

<!-- The following Playground APIs are available in Node.js: -->

As seguintes APIs do Playground estão disponíveis no Node.js:

<!--
- [JSON Blueprints API](/blueprints)
- [JavaScript API](/developers/apis/javascript-api/)
-->

- [API de Blueprints em JSON](/blueprints)
- [JavaScript API](/developers/apis/javascript-api/)

<!--
These APIs are very similar to their web counterparts, but, unsurprisingly, they are not based or links or iframes.
-->

Essas APIs são muito parecidas com as versões para a web, mas, como era de se esperar, não são baseadas em links nem em iframes.
