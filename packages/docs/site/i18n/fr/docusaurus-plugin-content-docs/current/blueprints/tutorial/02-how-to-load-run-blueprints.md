---
title: Comment exécuter des Blueprints
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: Découvrez les différentes méthodes pour charger et exécuter des Blueprints, notamment avec un fragment d’URL ou le paramètre blueprint-url.
---

<!--
title: How to run Blueprints
description: Learn the various methods for loading and running Blueprints, including using a URL fragment or the blueprint-url parameter.
-->

<!--
# How to load and run Blueprints
-->

# Comment charger et exécuter des Blueprints

<!--
## URL fragment
-->

## Fragment d’URL

<!--
The fastest way to run Blueprints is to paste one into the URL "fragment" of a WordPress Playground website. Just add a `#` after the `.net/`.
-->

La façon la plus rapide d’exécuter des Blueprints consiste à en coller un dans le « fragment » d’URL d’un site WordPress Playground. Ajoutez simplement un `#` après `.net/`.

<!--
Let's say you want to create a Playground with specific versions of WordPress and PHP using the following Blueprint:
-->

Supposons que vous vouliez créer un Playground avec des versions spécifiques de WordPress et de PHP avec le Blueprint suivant :

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

<!--
To run it, go to `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. You can also use the button below:
-->

Pour l’exécuter, allez sur `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. Vous pouvez aussi utiliser le bouton ci-dessous :

[<kbd> &nbsp; Exécuter le Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

<!--
Use this method to run the example code in the next chapter, [**Build your first Blueprint**](/blueprints/tutorial/build-your-first-blueprint).
-->

Utilisez cette méthode pour exécuter l’exemple de code du chapitre suivant, [**Créer votre premier Blueprint**](/blueprints/tutorial/build-your-first-blueprint).

<!--
### Encoded Blueprint fragments
-->

### Fragments de Blueprint encodés

<!--
When you build a Playground link from JavaScript or an automation tool, encode the Blueprint JSON once with `encodeURIComponent(JSON.stringify(blueprint))` and append it after `#`.
-->

Lorsque vous créez un lien Playground depuis JavaScript ou un outil d’automatisation, encodez le JSON du Blueprint une seule fois avec `encodeURIComponent(JSON.stringify(blueprint))` et ajoutez-le après `#`.

<!--
Playground also supports [Base64-encoded Blueprints](https://www.base64encode.org), which are useful when a platform modifies JSON fragments or when you want a compact, copyable link. For example, that's the above Blueprint in Base64 format: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.
-->

Playground prend également en charge les [Blueprints encodés en Base64](https://www.base64encode.org), qui sont utiles lorsqu’une plateforme modifie les fragments JSON ou lorsque vous voulez un lien compact et facile à copier. Par exemple, voici le Blueprint ci-dessus au format Base64 : `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

<!--
To run it, go to [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)
-->

Pour l’exécuter, allez sur [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)

<!--
### Load Blueprint from a URL
-->

### Charger un Blueprint depuis une URL

<!--
When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:
-->

Lorsque votre Blueprint devient trop difficile à gérer, vous pouvez le charger avec le paramètre de requête `?blueprint-url` dans l’URL, comme ceci :

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

<!--
Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):
-->

Notez que le Blueprint doit être accessible publiquement et servi avec [le bon en-tête `Access-Control-Allow-Origin`](https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin) :

```
Access-Control-Allow-Origin: *
```
