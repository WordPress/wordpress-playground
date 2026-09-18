---
sidebar_position: 1
title: Format des données Blueprint
slug: /blueprints/data-format
description: Vue d’ensemble du format de données Blueprint. Découvrez les propriétés clés comme landingPage, preferredVersions et steps.
---

<!-- title: Blueprint data Format -->

<!-- description: An overview of the Blueprint data format. Learn about key properties like landingPage, preferredVersions, and steps. -->

<!-- # Blueprint data format -->

# Format des données Blueprint

<!-- A Blueprint JSON file can have many different properties that will be used to define your Playground instance. The most important properties are detailed below. -->

Un fichier JSON de Blueprint peut contenir de nombreuses propriétés différentes
qui seront utilisées pour définir votre instance Playground. Les propriétés les
plus importantes sont détaillées ci-dessous.

<!-- Here's an example that uses many of them: -->

Voici un exemple qui en utilise plusieurs :

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
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

<!-- ## JSON schema -->

## Schéma JSON

<!-- JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get auto-completion and validation in your editor. Just set the `$schema` property to the following: -->

Les fichiers JSON peuvent être fastidieux à écrire et il est facile de s’y
tromper. Pour vous aider, Playground fournit un fichier
[schéma JSON](https://playground.wordpress.net/blueprint-schema.json) que vous
pouvez utiliser pour obtenir l’autocomplétion et la validation dans votre
éditeur. Définissez simplement la propriété `$schema` comme suit :

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

<!-- ## Landing page -->

## Page d’arrivée

<!-- The `landingPage` property tells Playground which URL to navigate to after the Blueprint has been run. This is a great tool, especially when creating theme or plugin demos. Often, you will want to start Playground in the Site Editor or have a specific post open in the Post Editor. Make sure you use a relative path. -->

La propriété `landingPage` indique à Playground vers quelle URL naviguer après
l’exécution du Blueprint. C’est un excellent outil, en particulier lors de la
création de démos de thèmes ou d’extensions. Souvent, vous voudrez démarrer
Playground dans l’éditeur de site ou ouvrir un article précis dans l’éditeur
d’articles. Assurez-vous d’utiliser un chemin relatif.

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

<!-- ## Preferred versions -->

## Versions préférées

<!-- The `preferredVersions` property declares your preferred PHP and WordPress versions. It can contain the following properties: -->

La propriété `preferredVersions` déclare vos versions préférées de PHP et de
WordPress. Elle peut contenir les propriétés suivantes :

<!--
- `php` (string): Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, or `latest`. Minor versions like `7.4.1` are not supported.
- `wp` (string): Loads the specified WordPress version. Accepts the last seven major WordPress versions. As of April 28, 2026, that's `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8`, or `6.9`. You can also use the generic values `latest`, `beta`, or `nightly` (alias `trunk`). `beta` resolves to the most recent Beta or Release Candidate of an active release cycle; `nightly`/`trunk` builds straight from the WordPress development branch.
-->

- `php` (string) : charge la version PHP indiquée. Accepte `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` ou `latest`. Les versions mineures comme `7.4.1` ne sont pas prises en charge.
- `wp` (string) : charge la version WordPress indiquée. Accepte les sept dernières versions majeures de WordPress. Au 28 avril 2026, il s’agit de `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8` ou `6.9`. Vous pouvez aussi utiliser les valeurs génériques `latest`, `beta` ou `nightly` (alias `trunk`). `beta` correspond à la bêta ou Release Candidate la plus récente d’un cycle de publication actif ; `nightly`/`trunk` est construit directement depuis la branche de développement de WordPress.

```js
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.7"
	},
}
```

<!-- ## Features -->

## Fonctionnalités

<!-- You can use the `features` property to turn on or off certain features of the Playground instance. It can contain the following properties: -->

Vous pouvez utiliser la propriété `features` pour activer ou désactiver
certaines fonctionnalités de l’instance Playground. Elle peut contenir les
propriétés suivantes :

<!-- - `networking`: Defaults to `true`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead. You will need this property enabled if you want the user to be able to install plugins or themes. -->

- `networking` : vaut `true` par défaut. Active ou désactive la prise en charge réseau de Playground. Si elle est activée, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) et les fonctions WordPress similaires utiliseront réellement `fetch()` pour effectuer des requêtes HTTP. Si elle est désactivée, elles échoueront immédiatement. Cette propriété doit être activée si vous voulez que l’utilisateur puisse installer des extensions ou des thèmes.

```js
{
	"features": {
		"networking": false
	},
}
```

<!-- ## Extra libraries -->

## Bibliothèques supplémentaires

<!-- You can preload extra libraries into the Playground instance. The following libraries are supported: -->

Vous pouvez précharger des bibliothèques supplémentaires dans l’instance
Playground. Les bibliothèques suivantes sont prises en charge :

<!-- - `wp-cli`: Enables WP-CLI support for Playground. If included, WP-CLI will be installed during boot. If not included, you will get an error message when trying to run WP-CLI commands using the JS API. WP-CLI will be installed by default if the blueprint contains any `wp-cli` steps. -->

- `wp-cli` : active la prise en charge de WP-CLI pour Playground. Si elle est incluse, WP-CLI sera installé pendant le démarrage. Si elle n’est pas incluse, vous obtiendrez un message d’erreur en essayant d’exécuter des commandes WP-CLI avec l’API JS. WP-CLI sera installé par défaut si le Blueprint contient des étapes `wp-cli`.

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

<!-- ## Steps -->

## Étapes

<!-- Arguably the most powerful property, `steps` allows you to configure the Playground instance with preinstalled themes, plugins, demo content, and more. The following example logs the user in with a dedicated username and password. It then installs and activates the Gutenberg plugin. [Learn more about steps](/blueprints/steps). -->

Sans doute la propriété la plus puissante, `steps` vous permet de configurer
l’instance Playground avec des thèmes, des extensions, du contenu de démo
préinstallés, et plus encore. L’exemple suivant connecte l’utilisateur avec un
nom d’utilisateur et un mot de passe dédiés. Il installe et active ensuite
l’extension Gutenberg. [En savoir plus sur les étapes](/blueprints/steps).

```js
{
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
				"slug": "gutenberg"
			}
		},
	]
}
```

<!-- ## Common property placement mistakes -->

## Erreurs courantes de placement des propriétés

<!--
Blueprint validation errors often come from putting a valid property in the
wrong object.
-->

Les erreurs de validation de Blueprint viennent souvent d’une propriété valide
placée dans le mauvais objet.

<!-- ### Activate a plugin or theme -->

### Activer une extension ou un thème

<!--
`activate` belongs inside `options`, not inside `pluginData`, `themeData`, or
directly on the step.
-->

`activate` doit se trouver dans `options`, pas dans `pluginData`, `themeData` ni
directement sur l’étape.

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "gutenberg"
	},
	"options": {
		"activate": true
	}
}
```

<!-- ### Install plugins with the shorthand -->

### Installer des extensions avec le raccourci

<!--
The `plugins` shorthand is a top-level Blueprint property. Do not put it inside
`preferredVersions`.
-->

Le raccourci `plugins` est une propriété de premier niveau du Blueprint. Ne le
placez pas dans `preferredVersions`.

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["gutenberg"]
}
```

<!-- ### Use one plugin install shape -->

### Utiliser une seule forme d’installation d’extension

<!--
For an `installPlugin` step, use `pluginData`. Do not mix `pluginData` with
older examples or custom objects such as `pluginZipFile`.
-->

Pour une étape `installPlugin`, utilisez `pluginData`. Ne mélangez pas
`pluginData` avec d’anciens exemples ou des objets personnalisés comme
`pluginZipFile`.

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	},
	"options": {
		"activate": true
	}
}
```

<!--
The `wordpress.org/plugins` resource needs a separate `slug`. Do not write the
slug into the `resource` value, such as `"wordpress.org/plugins/woocommerce"`.
-->

La ressource `wordpress.org/plugins` nécessite un `slug` séparé. N’écrivez pas
le slug dans la valeur `resource`, comme `"wordpress.org/plugins/woocommerce"`.

<!-- ### Keep `preferredVersions` limited to versions -->

### Limiter `preferredVersions` aux versions

<!--
`preferredVersions` only accepts `php` and `wp`. Use `features` for networking,
`plugins` or `installPlugin` for plugins, and `steps` for ordered setup tasks.
-->

`preferredVersions` accepte uniquement `php` et `wp`. Utilisez `features` pour
le réseau, `plugins` ou `installPlugin` pour les extensions, et `steps` pour les
tâches de configuration ordonnées.

<!-- ### Use explicit steps when order matters -->

### Utiliser des étapes explicites lorsque l’ordre compte

<!--
Shorthands such as `plugins`, `login`, `siteOptions`, and `constants` are
expanded before the `steps` array. If one action must happen before another,
write both actions as explicit steps in the order you need.
-->

Les raccourcis comme `plugins`, `login`, `siteOptions` et `constants` sont
développés avant le tableau `steps`. Si une action doit avoir lieu avant une
autre, écrivez les deux actions sous forme d’étapes explicites dans l’ordre
nécessaire.
