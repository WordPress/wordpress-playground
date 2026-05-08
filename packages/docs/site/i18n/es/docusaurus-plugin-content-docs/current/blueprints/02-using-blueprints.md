---
title: Usar Blueprints
slug: /blueprints/using-blueprints
description: Descubre las diferentes formas de usar Blueprints, incluso mediante fragmento de URL, parámetro de consulta, paquetes y la API de JavaScript.
---

<!--
title: Using Blueprints
description: Discover the different ways to use Blueprints, including via URL fragment, query parameter, bundles, and the JavaScript API.
-->

<!--
# Using Blueprints
-->

# Usar Blueprints

<!--
You can use Blueprints in one of the following ways:
-->

Puedes usar Blueprints de una de las siguientes formas:

<!--
- By passing them as a URL fragment to the Playground.
- By loading them from a URL using the `blueprint-url` parameter.
- By using Blueprint bundles (ZIP files or directories).
- By using the JavaScript API.
-->

- Pasándolos como fragmento de URL al Playground.
- Cargándolos desde una URL con el parámetro `blueprint-url`.
- Usando paquetes de Blueprint (archivos ZIP o directorios).
- Usando la API de JavaScript.

<!--
## URL Fragment
-->

## Fragmento de URL {#url-fragment}

<!--
The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`.
-->

La forma más sencilla de empezar a usar Blueprints es pegar uno en el "fragmento" de URL del sitio de WordPress Playground, por ejemplo `https://playground.wordpress.net/#{"preferredVersions...`.

<!--
For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint:
-->

Por ejemplo, para crear un Playground con versiones específicas de WordPress y PHP, usarías el siguiente Blueprint:

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

Luego irías a
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.

:::tip

<!--
In Javascript, you can get a compact version of any blueprint JSON with [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
Example:
-->

En JavaScript, puedes obtener una versión compacta de cualquier JSON de Blueprint con [`JSON.stringify`](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) y [`JSON.parse`](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).
Ejemplo:

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

<!--
You won't have to paste links to follow along. We'll use code examples with a "Try it out" button that will automatically run the examples for you:
-->

No tendrás que pegar enlaces para seguir el tutorial. Usaremos ejemplos de código con un botón "Pruébalo" que ejecutará automáticamente los ejemplos por ti:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}} />

<!--
### Encoded Blueprint fragments
-->

### Fragmentos de Blueprint codificados

<!--
When you create Playground links from JavaScript or automation tools, encode the minified JSON once with `encodeURIComponent()` and append it after `#`:
-->

Cuando crees enlaces de Playground desde JavaScript o herramientas de automatización, codifica el JSON minificado una sola vez con `encodeURIComponent()` y añádelo después de `#`:

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

<!--
Playground also supports Base64-encoded Blueprints. Base64 is useful when a platform modifies JSON fragments or when you want a compact, copyable link. For example, that's the above Blueprint in Base64 format: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.
-->

Playground también admite Blueprints codificados en Base64. Base64 es útil cuando una plataforma modifica fragmentos JSON o cuando quieres un enlace compacto y fácil de copiar. Por ejemplo, este es el Blueprint anterior en formato Base64: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

<!--
To run it, go to https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
-->

Para ejecutarlo, ve a https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

:::tip

<!--
In JavaScript, You can get any blueprint JSON in [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) with global function `btoa()`.

Example:
-->

En JavaScript, puedes convertir cualquier JSON de Blueprint a [formato Base64](https://developer.mozilla.org/es/docs/Glossary/Base64#javascript_support) con la función global `btoa()`.

Ejemplo:

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

<!--
### Load Blueprint from a URL
-->

### Cargar Blueprint desde una URL

<!--
When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:
-->

Cuando tu Blueprint sea demasiado difícil de manejar, puedes cargarlo mediante el parámetro de consulta `?blueprint-url` en la URL, así:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

<!--
Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):
-->

Ten en cuenta que el Blueprint debe ser accesible públicamente y servirse con [el encabezado `Access-Control-Allow-Origin` correcto](https://developer.mozilla.org/es/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```

<!--
#### Blueprint Bundles
-->

#### Paquetes de Blueprint

<!--
The `?blueprint-url` parameter now also supports Blueprint bundles in ZIP format. A Blueprint bundle is a ZIP file that contains a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

El parámetro `?blueprint-url` ahora también admite paquetes de Blueprint en formato ZIP. Un paquete de Blueprint es un archivo ZIP que contiene un archivo `blueprint.json` en el nivel raíz, junto con cualquier recurso adicional al que haga referencia el Blueprint.

<!--
For example, you can load a Blueprint bundle like this:
-->

Por ejemplo, puedes cargar un paquete de Blueprint así:

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

<!--
When using a Blueprint bundle, you can reference bundled resources using the `bundled` resource type:
-->

Al usar un paquete de Blueprint, puedes referenciar recursos incluidos en el paquete con el tipo de recurso `bundled`:

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

<!--
For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation.
-->

Para obtener más información sobre los paquetes de Blueprint, consulta la documentación de [Paquetes de Blueprint](/blueprints/bundles).

<!--
## JavaScript API
-->

## API de JavaScript {#javascript-api}

<!--
You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen:
-->

También puedes usar Blueprints con la API de JavaScript mediante la función `startPlaygroundWeb()` del paquete `@wp-playground/client`. Aquí tienes un ejemplo pequeño y autónomo que puedes ejecutar en JSFiddle o CodePen:

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
