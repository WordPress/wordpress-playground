---
title: Guide de démarrage rapide pour les développeurs
slug: /developers/build-your-first-app
description: Guide pratique pour intégrer WordPress, installer des extensions, prévisualiser des PRs et créer des applications avec les APIs Playground.
---

<!--
# Quick Start Guide for Developers
-->

# Guide de démarrage rapide pour les développeurs

<!--
WordPress Playground was created as a programmable tool. Below you'll find a few examples of what you can do with it. Each discussed API is described in detail in the [APIs section](/developers/apis/):
-->

WordPress Playground a été créé comme un outil programmable. Vous trouverez ci-dessous quelques exemples de ce que vous pouvez faire avec. Chaque API discutée est décrite en détail dans la [section APIs](/developers/apis/) :

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
## Embed WordPress on your website
-->

## Intégrer WordPress sur votre site

<!--
Playground can be embedded on your website using the HTML `<iframe>` tag as follows:
-->

Playground peut être intégré sur votre site en utilisant la balise HTML `<iframe>` comme suit :

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

<!--
Every visitor will get their own private WordPress instance for free. You can then customize it using one of the [Playground APIs](/developers/apis/).
-->

Chaque visiteur obtiendra sa propre instance WordPress privée gratuitement. Vous pouvez ensuite la personnaliser en utilisant l'une des [APIs de Playground](/developers/apis/).

import PlaygroundWpNetWarning from '@site/docs/\_fragments/\_playground_wp_net_may_stop_working.md';

<PlaygroundWpNetWarning />

<!--
## Control the embedded website
-->

## Contrôler le site intégré

<!--
WordPress Playground provides three APIs you can use to control the iframed website. All the examples in this section are built using one of these:
-->

WordPress Playground fournit trois APIs que vous pouvez utiliser pour contrôler le site en iframe. Tous les exemples de cette section sont construits en utilisant l’une d'entre elles :

import APIList from '@site/docs/\_fragments/\_api_list.mdx';

<APIList />

<!--
Learn more about each of these APIs in the [APIs overview section](/developers/apis/).
-->

Apprenez-en plus sur chacune de ces APIs dans la [section aperçu des APIs](/developers/apis/).

<!--
## Showcase a plugin or theme from WordPress directory
-->

## Présenter un plugin ou thème du répertoire WordPress

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!--
You can install plugins and themes from the WordPress directory with only URL parameters. This iframe preinstalls the `coblocks` and `friends` plugins and the `pendant` theme.
-->

Vous pouvez installer des plugins et thèmes du répertoire WordPress avec seulement des paramètres d'URL. Cet iframe préinstalle les plugins `coblocks` et `friends` et le thème `pendant`.

<ThisIsQueryApi />

```html
<iframe src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

<!--
## Showcase any plugin or theme
-->

## Présenter n'importe quel plugin ou thème

<!--
What if your plugin is not in the WordPress directory?
-->

Et si votre extension ne figure pas dans le répertoire de WordPress ?

<!--
You can still showcase it on Playground by using [JSON Blueprints](/blueprints). For example, this Blueprint would download and install a plugin and a theme from your website and also import some starter content:
-->

Vous pouvez toujours la présenter avec Playground en utilisant les [JSON Blueprints](/blueprints). Par exemple, ce Blueprint téléchargerait et installerait une extension et un thème depuis votre site et importerait également un contenu de démarrage :

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

<!--
See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

Consultez [débuter avec les Blueprints](/blueprints/getting-started) pour en savoir plus.

<!--
## Preview pull requests from your repository
-->

## Prévisualiser les pull requests de votre dépôt

<!--
You can preview repository code two ways: directly with `git:directory`, or by pointing to a `.zip` from your CI pipeline. Here's the `git:directory` approach using [Blueprints](/blueprints):
-->

Vous pouvez prévisualiser le code du dépôt de deux manières : directement avec `git:directory`, ou en pointant vers un `.zip` de votre pipeline CI. Voici l'approche `git:directory` utilisant les [Blueprints](/blueprints) :

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/my-user/my-repo",
				"ref": "refs/pull/1/head",
				"refType": "refname"
			},
			"options": {
				"activate": true
			},
			"progress": {
				"caption": "Installing plugin from my-user/my-repo PR #1"
			}
		}
	]
}
```

Dans le code ci-dessus, un plugin sera installé à partir d'un dépôt situé à l'URL indiquée, et la référence pour trouver la branche est `refType` ; dans ce cas, il utilisera `refname`, mais il peut également utiliser `branch`, `tag` et `commit`.

:::tip
Vous pouvez automatiser ce processus à l'aide de l'[Action GitHub pour générer des liens de prévisualisation](/guides/github-action-pr-preview), ce qui permettra de le simplifier.
:::

<!--
Loading a `.zip` file is another alternative for previewing your project. See the [live example of Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html).
-->

Charger un fichier `.zip` est une autre alternative pour prévisualiser votre projet. Consultez l'[exemple en direct du visualiseur de PR Gutenberg](https://playground.wordpress.net/gutenberg.html).

<!--
To use Playground as a PR previewer, you need:
-->

Pour utiliser Playground comme visualiseur de PR, vous avez besoin :

<!--
-   A CI pipeline that bundles your plugin or theme
-   Public access to the generated `.zip` file
-->

-   D'un pipeline CI qui empaquette votre plugin ou thème
-   D'un accès public au fichier `.zip` généré

<!--
Those zip bundles aren't any different from regular WordPress Plugins, which means you can install them in Playground using the [JSON Blueprints](/blueprints) API. Once you expose an endpoint like https://your-site.com/pull-request-1234.zip, the following Blueprint will do the rest:
-->

Ces archives zip ne sont pas différentes des extensions WordPress classiques, ce qui signifie que vous pouvez les installer dans Playground en utilisant l'API [JSON Blueprints](/blueprints). Une fois que vous exposez un point de terminaison comme `https://your-site.com/pull-request-1234.zip`, le Blueprint suivant fera le reste :

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

<!--
The official Playground demo uses this technique to preview pull requests from the Gutenberg repository:
-->

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

<!--
### Preview WordPress Core and Gutenberg Branches or PRs
-->

### Prévisualiser les branches ou PRs de WordPress Core et Gutenberg

<!--
You can preview specific pull requests from WordPress Core and Gutenberg repositories using Query API parameters. Gutenberg branches also have an alternative to preview them with the parameter `gutenberg-branch`. This is useful for testing the latest trunk changes or specific feature branches without creating a PR.
-->

Vous pouvez prévisualiser des pull requests spécifiques des dépôts WordPress Core et Gutenberg en utilisant les paramètres de l'API Query. Les branches Gutenberg ont également une alternative pour les prévisualiser avec le paramètre `gutenberg-branch`. Ceci est utile pour tester les derniers changements du trunk ou des branches de fonctionnalités spécifiques sans créer de PR.

<!--
-   Preview a specific WordPress Core PR: `https://playground.wordpress.net/?core-pr=9500`
-   Preview a specific Gutenberg PR: `https://playground.wordpress.net/?gutenberg-pr=73010`
-   Preview the Gutenberg trunk branch: `https://playground.wordpress.net/?gutenberg-branch=trunk`
-->

-   Prévisualiser un PR WordPress Core spécifique : `https://playground.wordpress.net/?core-pr=9500`
-   Prévisualiser un PR Gutenberg spécifique : `https://playground.wordpress.net/?gutenberg-pr=73010`
-   Prévisualiser la branche trunk de Gutenberg : `https://playground.wordpress.net/?gutenberg-branch=trunk`

<!--
## Build a compatibility testing environment
-->

## Construire un environnement de test de compatibilité

<!--
Test your plugin across PHP and WordPress versions by configuring them in Playground. This helps you verify compatibility before release.
-->

Testez votre extension sur différentes versions de PHP et WordPress en les configurant dans Playground. Cela vous aide à vérifier la compatibilité avant la publication.

<!--
With the Query API, you'd simply add the `php` and `wp` query parameters to the URL:
-->

Avec l'API Query, vous ajouteriez simplement les paramètres de requête `php` et `wp` à l'URL :

```html
<iframe src="https://playground.wordpress.net/?php=8.3&wp=6.1"></iframe>
```

<!--
With JSON Blueprints, you'd use the `preferredVersions` property:
-->

Avec les Blueprints JSON, vous utiliseriez la propriété `preferredVersions` :

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.1"
	}
}
```

<!--
## Run PHP code in the browser
-->

## Exécuter du code PHP dans le navigateur

<!--
The JavaScript API provides the `run()` method which you can use to run PHP code in the browser:
-->

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

<!--
Combine that with a code editor like Monaco or CodeMirror, and you'll get live code snippets like in [this article](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)!
-->

Combinez cela avec un éditeur de code comme Monaco ou CodeMirror, et vous obtiendrez des extraits de code en direct comme dans [cet article](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/) !
