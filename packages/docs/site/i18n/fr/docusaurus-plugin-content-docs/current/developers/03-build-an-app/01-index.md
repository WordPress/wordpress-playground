---
title: Guide de démarrage rapide pour les développeurs et développeuses
slug: /developers/build-your-first-app
description: Guide pratique pour intégrer WordPress, installer des extensions, prévisualiser des PRs et créer des app avec les APIs Playground.
---

<!-- # Quick Start Guide for Developers -->

# Guide de démarrage rapide pour les développeurs et développeuses

<!-- WordPress Playground was created as a programmable tool. Below you'll find a few examples of what you can do with it. Each discussed API is described in detail in the [APIs section](/developers/apis/): -->

WordPress Playground a été créé comme un outil programmable. Vous trouverez ci-dessous quelques exemples de ce que vous pouvez faire avec. Chaque API discutée est décrite en détail dans la [section APIs](/developers/apis/) :

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- ## Embed WordPress on your website -->

## Intégrer WordPress sur votre site

<!-- Playground can be embedded on your website using the HTML `<iframe>` tag as follows: -->

Playground peut être intégré sur votre site en utilisant la balise HTML `<iframe>` comme suit :

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

<!-- Every visitor will get their own private WordPress instance for free. You can then customize it using one of the [Playground APIs](/developers/apis/). -->

Chaque visiteur obtiendra sa propre instance WordPress privée gratuitement. Vous pouvez ensuite la personnaliser en utilisant l'une des [APIs Playground](/developers/apis/).

:::caution Careful with the demo site

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

:::

<!-- ## Control the embedded website -->

## Contrôler le site intégré

<!-- WordPress Playground provides three APIs you can use to control the iframed website. All the examples in this section are built using one of these: -->

WordPress Playground fournit trois APIs que vous pouvez utiliser pour contrôler le site en iframe. Tous les exemples de cette section sont construits en utilisant l’une d’entre elles :

- [Query API](/developers/apis/query-api) enable basic operations using only query parameters
- [Blueprints API](/blueprints) give you a great degree of control with a simple JSON file
- [JavaScript API](/developers/apis/javascript-api) give you full control via a JavaScript client from an npm package

<!-- Learn more about each of these APIs in the [APIs overview section](/developers/apis/). -->

En savoir plus sur chacune de ces APIs dans la [section de présentation des APIs](/developers/apis/).

<!-- ## Showcase a plugin or theme from WordPress directory -->

## Présenter une extension ou un thème du répertoire WordPress

<!-- You can install plugins and themes from the WordPress directory with only URL parameters. This iframe preinstalls the `coblocks` and `friends` plugins and the `pendant` theme. -->

Vous pouvez installer des extensions et des thèmes du répertoire WordPress avec seulement des paramètres d’URL. Cet iframe préinstalle les extensions `coblocks` et `friends` ainsi que le thème `pendant`.

This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).

```html
<iframe src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

<!-- ## Showcase any plugin or theme -->

## Présenter n’importe quelle extension ou thème

<!-- What if your plugin is not in the WordPress directory? -->

Et si votre extension n’est pas présente dans le répertoire WordPress ?

<!-- You can still showcase it on Playground by using [JSON Blueprints](/blueprints). For example, this Blueprint would download and install a plugin and a theme from your website and also import some starter content: -->

Vous pouvez toujours la présenter sur Playground en utilisant les [JSON Blueprints](/blueprints). Par exemple, ce Blueprint téléchargerait et installerait une extension et un thème depuis votre site et importerait également un contenu de démarrage :

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/your-plugin.zip"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://your-site.com/your-theme.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://your-site.com/starter-content.wxr"
			}
		}
	]
}
```

<!-- See [getting started with Blueprints](/blueprints/getting-started) to learn more. -->

Voir [commencer avec les Blueprints](/blueprints/getting-started) pour en savoir plus.

<!-- ## Preview pull requests from your repository -->

## Prévisualiser les pull requests de votre dépôt

<!-- You can preview repository code two ways: directly with `git:directory`, or by pointing to a `.zip` from your CI pipeline. Here’s the `git:directory` approach using [Blueprints](/blueprints): -->

Vous pouvez prévisualiser le code du dépôt de deux manières : directement avec `git:directory`, ou en pointant vers un `.zip` de votre pipeline CI. Voici l’approche `git:directory` utilisant les [Blueprints](/blueprints) :

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/my-user/my-repo",
				"ref": "add-feature-xyz",
				"refType": "branch"
			}
		}
	]
}
```

<!-- `git:directory` requires no CI configuration. Using a direct .zip URL performs better because Playground downloads a single file, but requires CI setup. -->

`git:directory` ne nécessite aucune configuration CI. L’utilisation d’une URL .zip directe offre de meilleures performances car Playground télécharge un seul fichier, mais nécessite une configuration CI.

<!-- See the [live example of Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html). -->

Voir l’[exemple en direct du prévisualiseur de PR Gutenberg](https://playground.wordpress.net/gutenberg.html).

<!-- To use Playground as a PR previewer, you need: -->

Pour utiliser Playground comme prévisualiseur de PR, vous avez besoin :

<!-- -   A CI pipeline that bundles your plugin or theme -->
<!-- -   Public access to the generated `.zip` file -->

- D’un pipeline CI qui empaquette votre extension ou thème
- D’un accès public au fichier `.zip` généré

<!-- Those zip bundles aren't any different from regular WordPress Plugins, which means you can install them in Playground using the [JSON Blueprints](/blueprints) API. Once you expose an endpoint like https://your-site.com/pull-request-1234.zip, the following Blueprint will do the rest: -->

Ces archives zip ne sont pas différentes des extensions WordPress classiques, ce qui signifie que vous pouvez les installer dans Playground en utilisant l’API [JSON Blueprints](/blueprints). Une fois que vous exposez un point de terminaison comme https://your-site.com/pull-request-1234.zip, le Blueprint ci-dessous fera le reste :

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/pull-request-1234.zip"
			}
		}
	]
}
```

<!-- The official Playground demo uses this technique to preview pull requests from the Gutenberg repository: -->

La démo officielle de Playground utilise cette technique pour prévisualiser les pull requests du dépôt Gutenberg :

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
blueprint={{
	"landingPage": "/wp-admin/plugins.php?test=42test",
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "mkdir",
			"path": "/wordpress/pr"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/pr/pr.zip",
			"data": {
				"resource": "url",
				"url": "/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&pr=60819",
				"caption": "Downloading Gutenberg PR 47739"
			},
			"progress": {
				"weight": 2,
				"caption": "Applying Gutenberg PR 47739"
			}
		},
		{
			"step": "unzip",
			"zipPath": "/wordpress/pr/pr.zip",
			"extractToPath": "/wordpress/pr"
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "vfs",
				"path": "/wordpress/pr/gutenberg.zip"
			}
		}
	]
	}} />

<!-- ### Preview WordPress Core and Gutenberg Branches or PRs -->

### Prévisualiser les branches ou PRs de WordPress Core et Gutenberg

<!-- You can preview specific branches or pull requests from WordPress Core and Gutenberg repositories using Query API parameters. This is useful for testing the latest trunk changes or specific feature branches without creating a PR. -->

Vous pouvez prévisualiser des branches ou pull requests spécifiques des dépôts WordPress Core et Gutenberg en utilisant les paramètres de la Query API. C’est utile pour tester les dernières modifications du trunk ou des branches de fonctionnalités spécifiques sans créer de PR.

<!-- -   Preview WordPress Core trunk branch: `https://playground.wordpress.net/?core-branch=trunk` -->
<!-- -   Preview a specific WordPress Core PR: `https://playground.wordpress.net/?core-pr=9500` -->
<!-- -   Preview the Gutenberg trunk branch: `https://playground.wordpress.net/?gutenberg-branch=trunk` -->
<!-- -   Preview a specific Gutenberg PR: `https://playground.wordpress.net/?gutenberg-pr=73010` -->

- Prévisualiser la branche trunk de WordPress Core : `https://playground.wordpress.net/?core-branch=trunk`
- Prévisualiser une PR spécifique de WordPress Core : `https://playground.wordpress.net/?core-pr=9500`
- Prévisualiser la branche trunk de Gutenberg : `https://playground.wordpress.net/?gutenberg-branch=trunk`
- Prévisualiser une PR spécifique de Gutenberg : `https://playground.wordpress.net/?gutenberg-pr=73010`

<!-- ## Build a compatibility testing environment -->

## Créer un environnement de test de compatibilité

<!-- Test your plugin across PHP and WordPress versions by configuring them in Playground. This helps you verify compatibility before release. -->

Testez votre extension sur différentes versions de PHP et WordPress en les configurant dans Playground. Cela vous aide à vérifier la compatibilité avant publication.

<!-- With the Query API, you'd simply add the `php` and `wp` query parameters to the URL: -->

Avec la Query API, vous ajouteriez simplement les paramètres de requête `php` et `wp` à l’URL :

```html
<iframe src="https://playground.wordpress.net/?php=8.3&wp=6.1"></iframe>
```

<!-- With JSON Blueprints, you'd use the `preferredVersions` property: -->

Avec les Blueprints JSON, vous utiliseriez la propriété `preferredVersions` :

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.1"
	}
}
```

<!-- ## Run PHP code in the browser -->

## Exécuter du code PHP dans le navigateur

<!-- The JavaScript API provides the `run()` method which you can use to run PHP code in the browser: -->

L'API JavaScript fournit la méthode `run()` que vous pouvez utiliser pour exécuter du code PHP dans le navigateur :

```html
<iframe id="wp"></iframe>
<script type="module">
	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	await client.isReady;
	await client.run({
		code: `<?php
		require("/wordpress/wp-load.php");

		update_option("blogname", "Playground is really cool!");
		echo "Site title updated!";
		`,
	});
	client.goTo('/');
</script>
```

<!-- Combine that with a code editor like Monaco or CodeMirror, and you'll get live code snippets like in [this article](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)! -->

Combinez cela avec un éditeur de code comme Monaco ou CodeMirror, et vous obtiendrez des extraits de code en direct comme dans [cet article](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/) !

<div class="callout callout-info">

Traduction automatisée, relecture et corrections par [@beryldlg](https://profiles.wordpress.org/beryldlg/)

Dernière mise à jour le 21 janvier 2026

</div>
