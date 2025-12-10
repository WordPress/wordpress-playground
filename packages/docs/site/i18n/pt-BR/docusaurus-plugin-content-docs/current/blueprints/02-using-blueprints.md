---
title: Usando Blueprints
slug: /blueprints/using-blueprints
description: Descubra as diferentes maneiras de usar Blueprints, incluindo via fragmento de URL, parâmetro de consulta, pacotes e API JavaScript.
---

# Usando Blueprints

Você pode usar Blueprints de uma das seguintes maneiras:

-   Passando-os como um fragmento de URL para o Playground.
-   Carregando-os de uma URL usando o parâmetro `blueprint-url`.
-   Usando pacotes de Blueprint (arquivos ZIP ou diretórios).
-   Usando a API JavaScript.

## Fragmento de URL

A maneira mais fácil de começar a usar Blueprints é colar um no "fragmento" de URL no site do WordPress Playground, por exemplo `https://playground.wordpress.net/#{"preferredVersions...`.

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

E então você iria para
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.

:::tip
Em Javascript, você pode obter uma versão compacta de qualquer Blueprint JSON com [`JSON.stringify`](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) e [`JSON.parse`](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
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
```

:::

Você não precisará colar links para acompanhar. Usaremos exemplos de código com um botão "Experimente" que executará automaticamente os exemplos para você:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}} />

### Blueprints codificados em Base64

Algumas ferramentas, incluindo GitHub, podem não formatar o Blueprint corretamente quando colado na URL. Nesses casos, codifique seu Blueprint em Base64 e anexe-o à URL. Por exemplo, este é o Blueprint acima em formato Base64: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

Para executá-lo, acesse https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

:::tip
Em JavaScript, você pode obter qualquer Blueprint JSON em [formato Base64](https://developer.mozilla.org/pt-BR/docs/Glossary/Base64#javascript_support) com a função global `btoa()`.

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

Quando seu Blueprint ficar muito grande, você pode carregá-lo através do parâmetro de consulta `?blueprint-url` na URL, assim:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Observe que o Blueprint deve estar publicamente acessível e servido com [o cabeçalho correto `Access-Control-Allow-Origin`](https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```

#### Pacotes de Blueprint

O parâmetro `?blueprint-url` agora também oferece suporte a pacotes de Blueprint em formato ZIP. Um pacote de Blueprint é um arquivo ZIP que contém um arquivo `blueprint.json` no nível raiz, junto com quaisquer recursos adicionais referenciados pelo Blueprint.

Por exemplo, você pode carregar um pacote de Blueprint assim:

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

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

Para mais informações sobre pacotes de Blueprint, consulte a documentação de [Pacotes de Blueprint](/blueprints/bundles).

## API JavaScript

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
		// wp-load.php é obrigatório apenas se você deseja interagir com o WordPress.
		code: '<?php require_once "/wordpress/wp-load.php"; $posts = get_posts(); echo "Post Title: " . $posts[0]->post_title;',
	});
	console.log(response.text);
</script>
```
