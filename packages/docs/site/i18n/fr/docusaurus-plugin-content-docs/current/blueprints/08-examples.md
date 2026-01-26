
---
sidebar_position: 8
title: Exemples
slug: /blueprints/examples
description: Une galerie d’exemples pratiques de Blueprint pour diverses tâches, telles que l’installation de thèmes, l’exécution de PHP et l’activation de fonctionnalités.
---

<!-- title: Examples -->
<!-- description: A gallery of practical Blueprint examples for various tasks, such as installing themes, running PHP, and enabling features. -->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# Exemples de Blueprints
<!-- # Blueprints Examples -->
:::tip
Consultez la [Galerie de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) pour découvrir des exemples de code réels utilisant WordPress Playground pour lancer un site WordPress avec une variété de configurations.

<!-- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups. -->

:::

Voyons quelques-unes des choses intéressantes que vous pouvez faire avec les Blueprints.

<!-- Let's see some cool things you can do with Blueprints. -->

## Installer un thème et une extension

<!-- ## Install a Theme and a Plugin -->

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "coblocks"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "pendant"
			}
		}
	]
}} />

## L’objet `meta`

<!-- ## The `meta` object -->

L’objet optionnel `meta` fournit des informations descriptives sur votre Blueprint. Bien qu’il n’affecte pas l’exécution du Blueprint, ces informations sont cruciales pour l’affichage dans les galeries, les sélecteurs de Blueprint et les outils intégrés tels que [WordPress Studio](https://developer.wordpress.com/studio/) et la [Galerie de Blueprints](https://wordpress.github.io/blueprints/).

<!-- The optional `meta` object provides descriptive information about your Blueprint. While it doesn't affect how the Blueprint executes, this information is crucial for display purposes in galleries, Blueprint selectors, and integrated tools like [WordPress Studio](https://developer.wordpress.com/studio/) and [Blueprints Gallery](https://wordpress.github.io/blueprints/). -->

### Propriétés

<!-- ### Properties -->

| Champ             | Type            | Description                                                 |
| :---------------- | :-------------- | :---------------------------------------------------------- |
| **`title`**       | `string`        | Un nom court et lisible pour le Blueprint.                  |
| **`description`** | `string`        | Un bref résumé expliquant la configuration.                 |
| **`author`**      | `string`        | Le nom ou l’identifiant de l’auteur/autrice.                |
| **`categories`**  | `array<string>` | Balises utilisées pour filtrer et regrouper les Blueprints. |

<!-- | Field             | Type            | Description                                      |
| :---------------- | :-------------- | :----------------------------------------------- |
| **`title`**       | `string`        | A short, human-readable name for the Blueprint.  |
| **`description`** | `string`        | A brief summary explaining the setup.            |
| **`author`**      | `string`        | The name or handle of the creator.               |
| **`categories`**  | `array<string>` | Tags used for filtering and grouping Blueprints. | -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"meta": {
		"title": "Configuration par défaut du Playground",
		"description": "Une configuration de base pour un nouveau site WordPress avec les dernières versions.",
		"author": "Équipe Playground",
		"categories": ["starter", "default"]
	},
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	}
}
```

## Exécuter du code PHP personnalisé

<!-- ## Run custom PHP code -->

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array( 'post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1 )); "
		}
	]
}` }
blueprint={{
		"steps": [
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

## Activer une option sur la page des expérimentations Gutenberg

<!-- ## Enable an option on the Gutenberg Experiments page -->

Ici : activez la fonctionnalité « nouvelles vues administrateur ».

<!-- Here: Switch on the "new admin views" feature. -->

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
		}
	]
}`}
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
			}
		]
}} />

## Comment travailler avec WP-CLI depuis le terminal et Playground

<!-- ## How to work with WP-CLI from the terminal and Playground -->

Vous pouvez exécuter des commandes WP-CLI sur une instance Playground depuis votre terminal ou directement dans un Blueprint.

<!-- You can run WP-CLI commands on a Playground instance either from your terminal or directly within a Blueprint. -->

Pour utiliser votre terminal, vous devez d’abord monter le répertoire `/wordpress/` et vous assurer que l’intégration de la base de données SQLite est configurée. Ceci est nécessaire car la base de données interne de Playground ne persiste pas sur un site monté, vous devez donc installer explicitement l’extension de base de données via un Blueprint. Cela permet à WP-CLI de reconnaître l’installation WordPress et de se connecter à sa base de données.

<!-- To use your terminal, you must first mount the `/wordpress/` directory and ensure the SQLite database integration is configured. This is because Playground's internal database doesn't persist on a mounted site, so you must explicitly install the database plugin via a Blueprint. This allows WP-CLI to recognize the WordPress installation and connect to its database. -->

:::note
Si vous exécutez des commandes WP-CLI en tant qu'étapes dans votre fichier Blueprint, cette configuration manuelle n'est pas nécessaire.

<!-- If you run WP-CLI commands as steps within your Blueprint file, this manual setup is not needed. -->

:::

L’extrait de Blueprint suivant gère cette configuration :

<!-- The following Blueprint snippet handles this setup: -->

<BlueprintExample blueprint={{
    "plugins": [ "sqlite-database-integration" ]
}} />

Pour une explication détaillée de pourquoi cela est nécessaire, consultez la section [Dépanner et déboguer les Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites).

<!-- For a detailed explanation of why this is needed, refer to the [Troubleshoot and Debug Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites) section. -->

## Présenter une démo de produit

<!-- ## Showcase a product demo -->

<BlueprintExample noButton blueprint={{
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
		},
		{
			"step": "setSiteOptions",
			"options": {
				"some_required_option_1": "your_favorite_values",
				"some_required_option_2": "your_favorite_values"
			}
		}
	]
}} />

## Activer le réseau

<!-- ## Enable networking -->

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/plugin-install.php",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		}
	]
}} />

## Charger du code PHP à chaque requête (mu-plugin)

<!-- ## Load PHP code on every request (mu-plugin) -->

Utilisez l’étape `writeFile` pour ajouter du code à un mu-plugin qui s’exécute à chaque requête.

<!-- Use the `writeFile` step to add code to a mu-plugin that runs on every request. -->

<BlueprintExample blueprint={{
	"landingPage": "/category/uncategorized/",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
			"data": "<?php add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
		}
	]
}} />

## Éditeur de code (comme un bloc Gutenberg)

<!-- ## Code editor (as a Gutenberg block) -->

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin/post.php?post=4&action=edit",
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "interactive-code-block"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'WordPress Playground block demo!','post_content' => '<!-- wp:wordpress-playground/playground /-->', 'post_status' => 'publish', 'post_type' => 'post',]);"
    }
  ]
}} />

Vous pouvez partager vos propres exemples de Blueprint dans [ce wiki dédié](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).

<!-- You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples). -->

## Charger une ancienne version de WordPress

<!-- ## Load an older WordPress version -->

Playground ne contient qu’un nombre limité de versions récentes de WordPress. Si vous avez besoin d’utiliser une version plus ancienne, ce Blueprint peut vous aider : modifiez le numéro de version dans `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` de `6.2.1` à la version que vous souhaitez charger.

<!-- Playground only ships with a few recent WordPress releases. If you need to use an older version, this Blueprint can help you: change the version number in `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` from `6.2.1` to the release you want to load. -->

**Note :** la version la plus ancienne de WordPress prise en charge est `6.2.1`, suivant l’extension d’intégration SQLite.

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin",
  "preferredVersions": {
    "wp": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip",
    "php": "8.3"
  },
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    }
  ]
}} />

## Exécuter WordPress depuis trunk ou un commit spécifique

<!-- ## Run WordPress from trunk or a specific commit. -->

WordPress Playground peut exécuter `trunk` (le dernier commit), le HEAD d’une branche spécifique ou un commit spécifique du référentiel GitHub [WordPress/WordPress](https://github.com/WordPress/WordPress).

<!-- WordPress Playground can run `trunk` (the latest commit), the HEAD of a specific branch or a specific commit from the [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub repository. -->

Vous pouvez spécifier la référence dans `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`.

<!-- You can specify the reference in `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`. -->

Pour spécifier le dernier commit d’une branche particulière, vous pouvez changer la référence au numéro de version de la branche, par exemple `6.6`. Pour exécuter un commit spécifique, vous pouvez utiliser le hash du commit depuis [WordPress/WordPress](https://github.com/WordPress/WordPress), par exemple `7d7a52367dee9925337e7d901886c2e9b21f70b6`.

<!-- To specify the latest commit of a particular branch, you can change the reference to the branch version number, eg `6.6`. To run a specific commit, you can use the commit hash from [WordPress/WordPress](https://github.com/WordPress/WordPress), eg `7d7a52367dee9925337e7d901886c2e9b21f70b6`. -->

**Note :** la version la plus ancienne prise en charge de WordPress est `6.2.1`, suite à l’extension d’intégration SQLite.

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

<BlueprintExample blueprint={{
    "landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.3",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

## Utilisation des lots Blueprint

<!-- ## Using Blueprint Bundles -->

Voici un exemple de Blueprint qui utilise des ressources groupées à partir d’un lot Blueprint :

<!-- Here's an example of a Blueprint that uses bundled resources from a Blueprint bundle: -->

```json
{
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/my-theme.zip"
			},
			"activate": true
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/my-plugin.zip"
			},
			"activate": true
		},
		{
			"step": "writeFile",
			"path": "/wordpress/custom-page.html",
			"data": {
				"resource": "bundled",
				"path": "/assets/custom-page.html"
			}
		}
	]
}
```

Ce lot de Blueprint serait un fichier zip contenant les fichiers suivants :

<!-- This Blueprint bundle would be zip file containing the following files: -->

- `/blueprint.json` - La déclaration du blueprint décrite ci-dessus
  <!-- - `/blueprint.json` - The blueprint declaration outlined above -->
- `/my-theme.zip` - Un paquet de thème
  <!-- - `/my-theme.zip` - A theme package -->
- `/my-plugin.zip` - Un paquet d’extension
  <!-- - `/my-plugin.zip` - A plugin package -->
- `/assets/custom-page.html` - Un fichier HTML personnalisé
  <!-- - `/assets/custom-page.html` - A custom HTML file -->

Vous pouvez utiliser ce lot Blueprint en :

<!-- You can use this Blueprint bundle by: -->

1. Créant un fichier ZIP avec ces fichiers et le blueprint.json
 <!-- 1. Creating a ZIP file with these files and the blueprint.json -->
2. Hébergeant le fichier ZIP sur un serveur
 <!-- 2. Hosting the ZIP file on a server -->
3. Le chargeant avec `?blueprint-url=https://example.com/my-blueprint-bundle.zip`
 <!-- 3. Loading it with `?blueprint-url=https://example.com/my-blueprint-bundle.zip` -->

Pour plus d’informations sur les lots de Blueprint, consultez la documentation des [Bundles Blueprint](/blueprints/bundles).

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

:::info
Traduction automatisée, relecture et corrections par [@beryldlg](https://profiles.wordpress.org/beryldlg/)

Dernière mise à jour le 21 janvier 2026
:::
