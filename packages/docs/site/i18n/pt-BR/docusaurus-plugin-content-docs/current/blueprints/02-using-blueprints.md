---
title: Usando Blueprints
slug: /blueprints/using-blueprints
description: Descubra as diferentes maneiras de usar Blueprints, incluindo via fragmento de URL, parâmetro de consulta, pacotes e API JavaScript.
---

# Usando Blueprints

<!-- You can use Blueprints in one of the following ways: -->

Você pode usar Blueprints de uma das seguintes maneiras:

<!-- -   By passing them as a URL fragment to the Playground. -->

- Passando-os como um fragmento de URL para o Playground.
    <!-- -   By loading them from a URL using the `blueprint-url` parameter. -->
- Carregando-os de uma URL usando o parâmetro `blueprint-url`.
    <!-- -   By using Blueprint bundles (ZIP files or directories). -->
- Usando pacotes de Blueprint (arquivos ZIP ou diretórios).
    <!-- -   By using the JavaScript API. -->
- Usando a API JavaScript.

## Fragmento de URL {#url-fragment}

<!-- The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`. -->

A maneira mais fácil de começar a usar Blueprints é colar um no "fragmento" de URL no site do WordPress Playground, por exemplo `https://playground.wordpress.net/#{"preferredVersions...`.

<!-- For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint: -->

Por exemplo, para criar um Playground com versões específicas do WordPress e PHP, você usaria o seguinte Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}
```

<!-- And then you would go to `https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`. -->

E então você iria para
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.

:::tip

<!-- In Javascript, you can get a compact version of any blueprint JSON with [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) -->

Em Javascript, você pode obter uma versão compacta de qualquer Blueprint JSON com [`JSON.stringify`](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) e [`JSON.parse`](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)

<!-- Example: -->

Exemplo:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = JSON.stringify(JSON.parse(blueprintJson)); // {"preferredVersions":{"php":"8.3","wp":"6.5"}}
const encodedBlueprint = encodeURIComponent(minifiedBlueprintJson);
const playgroundUrl = `https://playground.wordpress.net/#${encodedBlueprint}`;
```

:::

<!-- You won't have to paste links to follow along. We'll use code examples with a "Try it out" button that will automatically run the examples for you: -->

Você não precisará colar links para acompanhar. Usaremos exemplos de código com um botão "Experimente" que executará automaticamente os exemplos para você:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}} />

### Fragmentos de Blueprint codificados

<!-- When you create Playground links from JavaScript or automation tools, encode the minified JSON once with `encodeURIComponent()` and append it after `#`: -->

Ao criar links do Playground a partir de JavaScript ou ferramentas de automação, codifique o JSON minificado uma vez com `encodeURIComponent()` e adicione-o depois de `#`:

```js
const blueprint = {
	$schema: 'https://playground.wordpress.net/blueprint-schema.json',
	preferredVersions: {
		php: '8.3',
		wp: '6.5',
	},
};
const playgroundUrl = `https://playground.wordpress.net/#${encodeURIComponent(JSON.stringify(blueprint))}`;
```

<!-- Playground also supports Base64-encoded Blueprints. Base64 is useful when a platform modifies JSON fragments or when you want a compact, copyable link. For example, that's the above Blueprint in Base64 format: -->

O Playground também oferece suporte a Blueprints codificados em Base64. Base64 é útil quando uma plataforma modifica fragmentos JSON ou quando você quer um link compacto e fácil de copiar. Por exemplo, este é o Blueprint acima em formato Base64: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

<!-- To run it, go to https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19 -->

Para executá-lo, acesse https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

:::tip

<!-- In JavaScript, You can get any blueprint JSON in [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) with global function `btoa()`. -->

Em JavaScript, você pode obter qualquer Blueprint JSON em [formato Base64](https://developer.mozilla.org/pt-BR/docs/Glossary/Base64#javascript_support) com a função global `btoa()`.

<!-- Example: -->

Exemplo:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = btoa(blueprintJson); // eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
```

:::

### Carregar Blueprint de uma URL

<!-- When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this: -->

Quando seu Blueprint ficar muito grande, você pode carregá-lo através do parâmetro de consulta `?blueprint-url` na URL, assim:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

<!-- Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin): -->

Observe que o Blueprint deve estar publicamente acessível e servido com [o cabeçalho correto `Access-Control-Allow-Origin`](https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```

#### Pacotes de Blueprint

<!-- The `?blueprint-url` parameter now also supports Blueprint bundles in ZIP format. A Blueprint bundle is a ZIP file that contains a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint. -->

O parâmetro `?blueprint-url` agora também oferece suporte a pacotes de Blueprint em formato ZIP. Um pacote de Blueprint é um arquivo ZIP que contém um arquivo `blueprint.json` no nível raiz, junto com quaisquer recursos adicionais referenciados pelo Blueprint.

<!-- For example, you can load a Blueprint bundle like this: -->

Por exemplo, você pode carregar um pacote de Blueprint assim:

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

<!-- When using a Blueprint bundle, you can reference bundled resources using the `bundled` resource type: -->

Ao usar um pacote de Blueprint, você pode referenciar recursos empacotados usando o tipo de recurso `bundled`:

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		}
	]
}
```

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

Para mais informações sobre pacotes de Blueprint, consulte a documentação de [Pacotes de Blueprint](/blueprints/bundles).

## API JavaScript {#javascript-api}

<!-- You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen: -->

Você também pode usar Blueprints com a API JavaScript usando a função `startPlaygroundWeb()` do pacote `@wp-playground/client`. Aqui está um pequeno exemplo independente que você pode executar no JSFiddle ou CodePen:

```html
<iframe id="wp-playground" style="width: 1200px; height: 800px"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp-playground'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
		blueprint: {
			landingPage: '/wp-admin/',
			preferredVersions: {
				php: '8.3',
				wp: 'latest',
			},
			steps: [
				{
					step: 'login',
					username: 'admin',
					password: 'password',
				},
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'friends',
					},
				},
			],
		},
	});

	const response = await client.run({
		// wp-load.php is only required if you want to interact with WordPress.
		code: '<?php require_once "/wordpress/wp-load.php"; $posts = get_posts(); echo "Post Title: " . $posts[0]->post_title;',
	});
	console.log(response.text);
</script>
```
