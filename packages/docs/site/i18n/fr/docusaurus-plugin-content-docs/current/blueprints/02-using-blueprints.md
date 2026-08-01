---
title: Utiliser les Blueprints
slug: /blueprints/using-blueprints
description: Découvrez les différentes façons d’utiliser les Blueprints, notamment avec un fragment d’URL, un paramètre de requête, des bundles et l’API JavaScript.
---

<!-- title: Using Blueprints -->

<!-- description: Discover the different ways to use Blueprints, including via URL fragment, query parameter, bundles, and the JavaScript API. -->

<!-- # Using Blueprints -->

# Utiliser les Blueprints

<!-- You can use Blueprints in one of the following ways: -->

Vous pouvez utiliser les Blueprints de l’une des manières suivantes :

<!--
- By passing them as a URL fragment to the Playground.
- By loading them from a URL using the `blueprint-url` parameter.
- By using Blueprint bundles (ZIP files or directories).
- By using the JavaScript API.
-->

- En les passant comme fragment d’URL au Playground.
- En les chargeant depuis une URL avec le paramètre `blueprint-url`.
- En utilisant des bundles de Blueprint (fichiers ZIP ou répertoires).
- En utilisant l’API JavaScript.

<!-- ## URL Fragment -->

## Fragment d’URL

<!-- The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`. -->

La façon la plus simple de commencer avec les Blueprints consiste à en coller
un dans le "fragment" de l’URL sur le site WordPress Playground, par exemple
`https://playground.wordpress.net/#{"preferredVersions...`.

<!-- For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint: -->

Par exemple, pour créer un Playground avec des versions précises de WordPress
et de PHP, vous utiliseriez le Blueprint suivant :

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

Puis vous iriez sur
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.

<!--
<div class="callout callout-tip">

In Javascript, you can get a compact version of any blueprint JSON with [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
Example:
-->

<div class="callout callout-tip">

En JavaScript, vous pouvez obtenir une version compacte de n’importe quel JSON
de Blueprint avec [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) et [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
Exemple :

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

Vous n’aurez pas à coller de liens pour suivre. Nous utiliserons des exemples
de code avec un bouton "Try it out" qui exécutera automatiquement les exemples
pour vous :

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}} />

<!-- ### Encoded Blueprint fragments -->

### Fragments de Blueprint encodés

<!-- When you create Playground links from JavaScript or automation tools, encode the minified JSON once with `encodeURIComponent()` and append it after `#`: -->

Lorsque vous créez des liens Playground depuis JavaScript ou des outils
d’automatisation, encodez une seule fois le JSON minifié avec
`encodeURIComponent()` et ajoutez-le après `#` :

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

Playground prend aussi en charge les Blueprints encodés en Base64. Base64 est
utile lorsqu’une plateforme modifie les fragments JSON ou lorsque vous voulez
un lien compact et facile à copier. Par exemple, voici le Blueprint ci-dessus au
format Base64 : `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

<!-- To run it, go to https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19 -->

Pour l’exécuter, allez sur https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

<!-- #### URIError: URI malformed -->

#### URIError: URI malformed

<!--
If a Playground link fails with `URIError: URI malformed`, the encoded
Blueprint fragment is usually malformed. Common causes include an invalid `%`
escape, a fragment that was encoded twice, or JSON pasted into the URL without
encoding.
-->

Si un lien Playground échoue avec `URIError: URI malformed`, le fragment de
Blueprint encodé est généralement mal formé. Les causes courantes incluent un
échappement `%` invalide, un fragment encodé deux fois ou du JSON collé dans
l’URL sans encodage.

<!-- Rebuild the link from the original Blueprint object and encode it once: -->

Reconstruisez le lien depuis l’objet Blueprint d’origine et encodez-le une seule
fois :

```js
const playgroundUrl = `https://playground.wordpress.net/#${encodeURIComponent(JSON.stringify(blueprint))}`;
```

<!-- If another tool changes URL fragments, use a Base64-encoded Blueprint instead. -->

Si un autre outil modifie les fragments d’URL, utilisez plutôt un Blueprint
encodé en Base64.

<!--
<div class="callout callout-tip">

In JavaScript, You can get any blueprint JSON in [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) with global function `btoa()`.
-->

<div class="callout callout-tip">

En JavaScript, vous pouvez obtenir n’importe quel JSON de Blueprint au
[format Base64](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support)
avec la fonction globale `btoa()`.

<!-- Example: -->

Exemple :

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

### Charger un Blueprint depuis une URL

<!-- When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this: -->

Quand votre Blueprint devient trop volumineux, vous pouvez le charger avec le
paramètre de requête `?blueprint-url` dans l’URL, comme ceci :

<!-- [https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json) -->

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

<!-- Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin): -->

Notez que le Blueprint doit être accessible publiquement et servi avec le
[bon en-tête `Access-Control-Allow-Origin`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin) :

```
Access-Control-Allow-Origin: *
```

<!-- When a Blueprint URL fails with `BlueprintFetchError`, check these details: -->

Lorsqu’une URL de Blueprint échoue avec `BlueprintFetchError`, vérifiez ces
points :

<!--
- The URL must return a JSON file or a Blueprint ZIP bundle, not an HTML page.
- GitHub URLs should use `raw.githubusercontent.com`, not `github.com/.../blob/...`.
- GitLab URLs should use the raw file URL, not a `/-/blob/` page.
- The file must be reachable without login, cookies, VPN access, or a temporary browser session.
- Draft releases, expired CI artifacts, and temporary tunnel URLs can stop working even if the Blueprint was valid earlier.
- If you host the file yourself, configure CORS so `https://playground.wordpress.net` can fetch it.
-->

- L’URL doit renvoyer un fichier JSON ou un bundle ZIP de Blueprint, pas une page HTML.
- Les URL GitHub doivent utiliser `raw.githubusercontent.com`, pas `github.com/.../blob/...`.
- Les URL GitLab doivent utiliser l’URL du fichier brut, pas une page `/-/blob/`.
- Le fichier doit être accessible sans connexion, cookies, VPN ni session temporaire du navigateur.
- Les releases en brouillon, les artifacts CI expirés et les URL temporaires de tunnel peuvent cesser de fonctionner même si le Blueprint était valide auparavant.
- Si vous hébergez le fichier vous-même, configurez CORS pour que `https://playground.wordpress.net` puisse le récupérer.

<!-- #### Blueprint Bundles -->

#### Bundles de Blueprint

<!-- The `?blueprint-url` parameter now also supports Blueprint bundles in ZIP format. A Blueprint bundle is a ZIP file that contains a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint. -->

Le paramètre `?blueprint-url` prend maintenant aussi en charge les bundles de
Blueprint au format ZIP. Un bundle de Blueprint est un fichier ZIP qui contient
un fichier `blueprint.json` à la racine, avec les ressources supplémentaires
référencées par le Blueprint.

<!-- For example, you can load a Blueprint bundle like this: -->

Par exemple, vous pouvez charger un bundle de Blueprint comme ceci :

<!-- [https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip) -->

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

<!-- When using a Blueprint bundle, you can reference bundled resources using the `bundled` resource type: -->

Lorsque vous utilisez un bundle de Blueprint, vous pouvez référencer les
ressources incluses avec le type de ressource `bundled` :

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

Pour plus d’informations sur les bundles de Blueprint, consultez la
documentation des [Bundles de Blueprint](/blueprints/bundles).

<!-- ## JavaScript API -->

## API JavaScript

<!-- You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen: -->

Vous pouvez aussi utiliser les Blueprints avec l’API JavaScript grâce à la
fonction `startPlaygroundWeb()` du paquet `@wp-playground/client`. Voici un
petit exemple autonome que vous pouvez exécuter sur JSFiddle ou CodePen :

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
