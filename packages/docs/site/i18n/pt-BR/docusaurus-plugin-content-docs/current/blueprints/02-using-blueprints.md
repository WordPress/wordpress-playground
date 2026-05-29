---
title: Como usar Blueprints
slug: /blueprints/using-blueprints
description: Conheça as diferentes maneiras de usar Blueprints, inclusive por fragmento de URL, parâmetro de consulta, pacotes e API JavaScript.
---

<!-- title: Using Blueprints -->

<!-- description: Discover the different ways to use Blueprints, including via URL fragment, query parameter, bundles, and the JavaScript API. -->

<!-- # Using Blueprints -->

# Como usar Blueprints

<!-- You can use Blueprints in one of the following ways: -->

Você pode usar Blueprints de uma das seguintes maneiras:

<!--
- By passing them as a URL fragment to the Playground.
- By loading them from a URL using the `blueprint-url` parameter.
- By using Blueprint bundles (ZIP files or directories).
- By using the JavaScript API.
-->

- Passando-os como um fragmento de URL para o Playground.
- Carregando-os a partir de uma URL usando o parâmetro `blueprint-url`.
- Usando pacotes de Blueprint (arquivos ZIP ou diretórios).
- Usando a API JavaScript.

<!-- ## URL Fragment -->

## Fragmento de URL

<!-- The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`. -->

A maneira mais fácil de começar a usar Blueprints é colar um deles no
"fragmento" da URL no site do WordPress Playground, por exemplo
`https://playground.wordpress.net/#{"preferredVersions...`.

<!-- For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint: -->

Por exemplo, para criar um Playground com versões específicas do WordPress e do
PHP, use o seguinte Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}
```

<!--
And then you would go to
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.
-->

E então acesse
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.

<!--
<div class="callout callout-tip">

In Javascript, you can get a compact version of any blueprint JSON with [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
Example:
-->

<div class="callout callout-tip">

Em JavaScript, você pode obter uma versão compacta de qualquer JSON de Blueprint
com [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) e [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
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

</div>

<!-- You won't have to paste links to follow along. We'll use code examples with a "Try it out" button that will automatically run the examples for you: -->

Você não precisará colar links para acompanhar. Usaremos exemplos de código com
um botão "Try it out", que executará automaticamente os exemplos para você:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}} />

<!-- ### Encoded Blueprint fragments -->

### Fragmentos de Blueprint codificados

<!-- When you create Playground links from JavaScript or automation tools, encode the minified JSON once with `encodeURIComponent()` and append it after `#`: -->

Ao criar links do Playground a partir de JavaScript ou ferramentas de automação,
codifique o JSON minificado uma vez com `encodeURIComponent()` e adicione-o
depois de `#`:

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

<!-- Playground also supports Base64-encoded Blueprints. Base64 is useful when a platform modifies JSON fragments or when you want a compact, copyable link. For example, that's the above Blueprint in Base64 format: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`. -->

O Playground também aceita Blueprints codificados em Base64. Base64 é útil
quando uma plataforma modifica fragmentos JSON ou quando você quer um link
compacto e fácil de copiar. Por exemplo, este é o Blueprint acima em formato
Base64: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

<!-- To run it, go to https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19 -->

Para executá-lo, acesse https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

<!-- #### URIError: URI malformed -->

#### URIError: URI malformed

<!--
If a Playground link fails with `URIError: URI malformed`, the encoded
Blueprint fragment is usually malformed. Common causes include an invalid `%`
escape, a fragment that was encoded twice, or JSON pasted into the URL without
encoding.
-->

Se um link do Playground falhar com `URIError: URI malformed`, o fragmento de
Blueprint codificado geralmente está malformado. Causas comuns incluem um escape
`%` inválido, um fragmento codificado duas vezes ou JSON colado na URL sem
codificação.

<!-- Rebuild the link from the original Blueprint object and encode it once: -->

Reconstrua o link a partir do objeto Blueprint original e codifique-o uma vez:

```js
const playgroundUrl = `https://playground.wordpress.net/#${encodeURIComponent(JSON.stringify(blueprint))}`;
```

<!-- If another tool changes URL fragments, use a Base64-encoded Blueprint instead. -->

Se outra ferramenta alterar fragmentos de URL, use um Blueprint codificado em
Base64.

<!--
<div class="callout callout-tip">

In JavaScript, You can get any blueprint JSON in [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) with global function `btoa()`.
-->

<div class="callout callout-tip">

Em JavaScript, você pode obter qualquer JSON de Blueprint no
[formato Base64](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support)
com a função global `btoa()`.

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

</div>

<!-- ### Load Blueprint from a URL -->

### Carregar Blueprint de uma URL

<!-- When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this: -->

Quando o Blueprint ficar grande demais, você pode carregá-lo pelo parâmetro de
consulta `?blueprint-url` na URL, assim:

<!-- [https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json) -->

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

<!-- Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin): -->

Observe que o Blueprint deve estar publicamente acessível e ser servido com o
[cabeçalho `Access-Control-Allow-Origin` correto](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```

<!-- When a Blueprint URL fails with `BlueprintFetchError`, check these details: -->

Quando uma URL de Blueprint falhar com `BlueprintFetchError`, verifique estes
detalhes:

<!--
- The URL must return a JSON file or a Blueprint ZIP bundle, not an HTML page.
- GitHub URLs should use `raw.githubusercontent.com`, not `github.com/.../blob/...`.
- GitLab URLs should use the raw file URL, not a `/-/blob/` page.
- The file must be reachable without login, cookies, VPN access, or a temporary browser session.
- Draft releases, expired CI artifacts, and temporary tunnel URLs can stop working even if the Blueprint was valid earlier.
- If you host the file yourself, configure CORS so `https://playground.wordpress.net` can fetch it.
-->

- A URL deve retornar um arquivo JSON ou um pacote ZIP de Blueprint, não uma página HTML.
- URLs do GitHub devem usar `raw.githubusercontent.com`, não `github.com/.../blob/...`.
- URLs do GitLab devem usar a URL de arquivo bruto, não uma página `/-/blob/`.
- O arquivo deve estar acessível sem login, cookies, VPN ou sessão temporária do navegador.
- Releases em rascunho, artefatos de CI expirados e URLs temporárias de túnel podem parar de funcionar mesmo que o Blueprint fosse válido antes.
- Se você hospedar o arquivo, configure CORS para que `https://playground.wordpress.net` possa buscá-lo.

<!-- #### Blueprint Bundles -->

#### Pacotes de Blueprint

<!-- The `?blueprint-url` parameter now also supports Blueprint bundles in ZIP format. A Blueprint bundle is a ZIP file that contains a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint. -->

O parâmetro `?blueprint-url` agora também aceita pacotes de Blueprint no formato
ZIP. Um pacote de Blueprint é um arquivo ZIP que contém um arquivo
`blueprint.json` no nível raiz, junto com quaisquer recursos adicionais
referenciados pelo Blueprint.

<!-- For example, you can load a Blueprint bundle like this: -->

Por exemplo, você pode carregar um pacote de Blueprint assim:

<!-- [https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip) -->

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

<!-- When using a Blueprint bundle, you can reference bundled resources using the `bundled` resource type: -->

Ao usar um pacote de Blueprint, você pode referenciar recursos empacotados com
o tipo de recurso `bundled`:

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

Para saber mais sobre pacotes de Blueprint, consulte a documentação de
[Pacotes de Blueprint](/blueprints/bundles).

<!-- ## JavaScript API -->

## API JavaScript

<!-- You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen: -->

Você também pode usar Blueprints com a API JavaScript usando a função
`startPlaygroundWeb()` do pacote `@wp-playground/client`. Veja um exemplo
pequeno e independente que você pode executar no JSFiddle ou no CodePen:

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
