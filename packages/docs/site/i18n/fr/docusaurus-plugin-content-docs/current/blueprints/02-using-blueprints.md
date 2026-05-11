---
title: Utiliser les Blueprints
slug: /blueprints/using-blueprints
description: Découvrez les différentes façons d’utiliser les Blueprints, notamment avec un fragment d’URL, un paramètre de requête, des paquets et l’API JavaScript.
---

<!--
title: Using Blueprints
description: Discover the different ways to use Blueprints, including via URL fragment, query parameter, bundles, and the JavaScript API.
-->

<!--
# Using Blueprints
-->

# Utiliser les Blueprints

<!--
You can use Blueprints in one of the following ways:
-->

Vous pouvez utiliser les Blueprints de l’une des façons suivantes :

<!--
- By passing them as a URL fragment to the Playground.
- By loading them from a URL using the `blueprint-url` parameter.
- By using Blueprint bundles (ZIP files or directories).
- By using the JavaScript API.
-->

- En les passant comme fragment d’URL au Playground.
- En les chargeant depuis une URL avec le paramètre `blueprint-url`.
- En utilisant des paquets Blueprint (fichiers ZIP ou répertoires).
- En utilisant l’API JavaScript.

<!--
## URL Fragment
-->

## Fragment d’URL {#url-fragment}

<!--
The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`.
-->

La façon la plus simple de commencer à utiliser les Blueprints est d’en coller un dans le « fragment » d’URL du site WordPress Playground, par exemple `https://playground.wordpress.net/#{"preferredVersions...`.

<!--
For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint:
-->

Par exemple, pour créer un Playground avec des versions spécifiques de WordPress et de PHP, vous utiliseriez le Blueprint suivant :

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

Vous iriez ensuite à
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.

:::tip

<!--
In Javascript, you can get a compact version of any blueprint JSON with [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
Example:
-->

En JavaScript, vous pouvez obtenir une version compacte de n’importe quel JSON de Blueprint avec [`JSON.stringify`](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) et [`JSON.parse`](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).
Exemple :

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

Vous n’aurez pas besoin de coller de liens pour suivre. Nous utiliserons des exemples de code avec un bouton « Essayer » qui exécutera automatiquement les exemples pour vous :

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

### Fragments de Blueprint encodés

<!--
When you create Playground links from JavaScript or automation tools, encode the minified JSON once with `encodeURIComponent()` and append it after `#`:
-->

Lorsque vous créez des liens Playground depuis JavaScript ou des outils d’automatisation, encodez le JSON minifié une seule fois avec `encodeURIComponent()` et ajoutez-le après `#` :

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

Playground prend également en charge les Blueprints encodés en Base64. Base64 est utile lorsqu’une plateforme modifie les fragments JSON ou lorsque vous voulez un lien compact et facile à copier. Par exemple, voici le Blueprint ci-dessus au format Base64 : `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

<!--
To run it, go to https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
-->

Pour l’exécuter, allez sur https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

:::tip

<!--
In JavaScript, You can get any blueprint JSON in [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) with global function `btoa()`.

Example:
-->

En JavaScript, vous pouvez convertir n’importe quel JSON de Blueprint au [format Base64](https://developer.mozilla.org/fr/docs/Glossary/Base64#javascript_support) avec la fonction globale `btoa()`.

Exemple :

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

### Charger un Blueprint depuis une URL

<!--
When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:
-->

Lorsque votre Blueprint devient trop difficile à gérer, vous pouvez le charger avec le paramètre de requête `?blueprint-url` dans l’URL, comme ceci :

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

<!--
Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):
-->

Notez que le Blueprint doit être accessible publiquement et servi avec [le bon en-tête `Access-Control-Allow-Origin`](https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin) :

```
Access-Control-Allow-Origin: *
```

<!--
#### Blueprint Bundles
-->

#### Paquets Blueprint

<!--
The `?blueprint-url` parameter now also supports Blueprint bundles in ZIP format. A Blueprint bundle is a ZIP file that contains a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

Le paramètre `?blueprint-url` prend désormais aussi en charge les paquets Blueprint au format ZIP. Un paquet Blueprint est un fichier ZIP qui contient un fichier `blueprint.json` à la racine, ainsi que toutes les ressources supplémentaires référencées par le Blueprint.

<!--
For example, you can load a Blueprint bundle like this:
-->

Par exemple, vous pouvez charger un paquet Blueprint comme ceci :

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

<!--
When using a Blueprint bundle, you can reference bundled resources using the `bundled` resource type:
-->

Lorsque vous utilisez un paquet Blueprint, vous pouvez référencer les ressources incluses avec le type de ressource `bundled` :

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

Pour en savoir plus sur les paquets Blueprint, consultez la documentation [Paquets Blueprint](/blueprints/bundles).

<!--
## JavaScript API
-->

## API JavaScript {#javascript-api}

<!--
You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen:
-->

Vous pouvez aussi utiliser les Blueprints avec l’API JavaScript grâce à la fonction `startPlaygroundWeb()` du paquet `@wp-playground/client`. Voici un petit exemple autonome que vous pouvez exécuter sur JSFiddle ou CodePen :

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
