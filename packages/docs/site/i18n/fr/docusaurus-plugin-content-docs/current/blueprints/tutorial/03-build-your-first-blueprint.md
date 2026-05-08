---
title: Construisez votre premier blueprint
slug: /blueprints/tutorial/build-your-first-blueprint
description: Un tutoriel pas à pas pour construire votre premier blueprint. Apprenez à installer des thèmes, des extensions et à importer un contenu de site.
---

Construisons un blueprint élémentaire qui :

<!-- Let's build an elementary Blueprint that -->

1. Crée un nouveau site WordPress
2. Définit le titre du site par « Mon premier blueprint »
3. Installe le thème _Adventurer_
4. Installe l’extension _Hello Dolly_ depuis le répertoire WordPress
5. Installe une extension personnalisée
6. Modifie le contenu du site

<!--
1. Creates a new WordPress site
2. Sets the site title to "My first Blueprint"
3. Installs the _Adventurer_ theme
4. Installs the _Hello Dolly_ plugin from the WordPress plugin directory
5. Installs a custom plugin
6. Changes the site content
-->

## 1. Créer un nouveau site WordPress

<!-- ## 1. Create a new WordPress site -->

Commençons par créer un fichier `blueprint.json` avec le contenu suivant :

<!-- Let's start by creating a `blueprint.json` file with the following contents: -->

```json
{}
```

On pourrait penser que rien ne se passe, mais ce blueprint lance déjà un site WordPress avec la dernière version.

<!-- It may seem like nothing is happening, but this Blueprint already spins up a WordPress site with the latest major version. -->

[<kbd> &nbsp; Lancer blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{})

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{}) -->

:::tip **Auto-complétion**

Si vous utilisez un IDE tel que VS Code ou PHPStorm, vous pouvez utiliser le [Schéma JSON Blueprint](https://playground.wordpress.net/blueprint-schema.json) pour activer l'auto-complétion pendant votre développement. Ajoutez la ligne qui suit au début de votre fichier `blueprint.json` :

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json"
}
```

:::

<!--
**Autocomplete**

If you use an IDE, like VS Code or PHPStorm, you can use the [Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json) for an autocompleted Blueprint development experience. Add the following line at the top of your `blueprint.json` file:
-->

Voici ce à quoi ça ressemble dans VS Code :

<!-- Here’s what it looks like in VS Code: -->

![Visualisation de l’autocompletion](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/schema-autocompletion.webp)

<!-- ![Autocompletion visualized](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/schema-autocompletion.webp) -->

## 2. Définir le titre du site par « Mon premier blueprint »

<!-- ## 2. Set the site title to "My first Blueprint" -->

Les blueprints correspondent à une suite d’[étapes](/blueprints/steps) qui définissent comment construire un site WordPress. Avant d’écrire la première étape, déclarez une liste vide d’étapes :

<!-- Blueprints consist of a series of [steps](/blueprints/steps) that define how to build a WordPress site. Before you write the first step, declare an empty list of steps: -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": []
}
```

Ce blueprint n’est pas vraiment intéressant, il crée le même site par défaut que le blueprint ci-dessus. Faisons quelque chose pour y remédier !

<!-- This Blueprint isn't very exciting—it creates the same default site as the empty Blueprint above. Let's do something about it! -->

WordPress conserve le titre du site dans l’option `blogname`. Ajoutez votre première étape et définissez cette option avec « Mon premier blueprint » :

<!-- WordPress stores the site title in the `blogname` option. Add your first step and set that option to "My first Blueprint": -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": [
		{
			"step": "setSiteOptions",
			"options": {
				"blogname": "Mon premier blueprint"
			}
		}
	]
}
```

[<kbd> &nbsp; Lancer blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwic3RlcHMiOlt7InN0ZXAiOiJzZXRTaXRlT3B0aW9ucyIsIm9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifX1dfQ==)

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwic3RlcHMiOlt7InN0ZXAiOiJzZXRTaXRlT3B0aW9ucyIsIm9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifX1dfQ==) -->

L’[étape `setSiteOptions`](/blueprints/steps#SetSiteOptionsStep) définit les options du site dans la base de données WordPress. Cet objet `options` contient les paires clé-valeur à définir. Dans ce cas, vous avez changé la valeur de la clé `blogname` en "Mon premier blueprint". Vous pouvez en apprendre plus sur les étapes existantes dans le [Référentiel API des étapes blueprint](/blueprints/steps).

<!-- The [`setSiteOptions` step](/blueprints/steps#SetSiteOptionsStep) specifies the site options in the WordPress database. The `options` object contains the key-value pairs to set. In this case, you changed the value of the `blogname` key to "My first Blueprint". You can read more about all available steps in the [Blueprint Steps API Reference](/blueprints/steps). -->

### Forme courte

<!-- ### Shorthands -->

Vous pouvez définir certaines étapes en utilisant la forme courte. Par exemple, vous pouvez écrire l’étape `setSiteOptions` ainsi :

<!-- You can specify some steps using a shorthand syntax. For example, you could write the `setSiteOptions` step like this: -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"siteOptions": {
		"blogname": "Mon premier blueprint"
	}
}
```

La forme courte et la syntaxe par étapes sont équivalentes. Chaque étape définie avec la forme courte est automatiquement ajoutée au début du tableau `steps` dans un ordre arbitraire. Laquelle choisir ? Utilisez la forme courte lorsque la concision est votre principale préoccupation, utilisez les étapes lorsque vous avez besoin d’un meilleur contrôle sur l’ordre d’exécution.

<!--
The shorthand syntax and the step syntax correspond with each other. Every step specified with the shorthand syntax is automatically added at the beginning of the `steps` array in an arbitrary order. Which should you choose? Use shorthands when brevity is your main concern, use steps when you need more control over the order of execution.
-->

## 3. Installer le thème _Adventurer_

<!-- ## 3. Install the _Adventurer_ theme -->

Adventurer est un thème open-source [disponible dans le répertoire de thèmes WordPress](https://wordpress.org/themes/adventurer/). Installons-le en utilisant l’[étape `installTheme`](/blueprints/steps#InstallThemeStep) :

<!-- Adventurer is an open-source theme [available in the WordPress theme directory](https://wordpress.org/themes/adventurer/). Let's install it using the [`installTheme` step](/blueprints/steps#InstallThemeStep): -->

```json
{
	"siteOptions": {
		"blogname": "My first blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; Lancer Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwib3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX1dfQ==)

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwib3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX1dfQ==) -->

Le site devrait maintenant ressembler à la capture d’écran ci-dessous :

<!-- The site should now look like the screenshot below: -->

![Site avec le thème Adventurer](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/installed-adventurer-theme.webp)

<!-- ![Site with the adventurer theme](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/installed-adventurer-theme.webp) -->

### Ressources

<!-- ### Resources -->

Le `themeData` définit une [ressource](/blueprints/steps/resources) et fait référence à un fichier externe nécessaire pour finaliser l’étape. Playground prend en charge différents types de ressources, et notamment

<!-- The `themeData` defines a [resource](/blueprints/steps/resources) and references an external file required to complete the step. Playground supports different types of resources, including -->

- `url`,
- `wordpress.org/themes`,
- `wordpress.org/plugins`,
- `vfs`(système de fichier virtuel), ou
- `literal`.

<!--
   `url`,
-   `wordpress.org/themes`,
-   `wordpress.org/plugins`,
-   `vfs`(virtual file system), or
-   `literal`.
-->

Cet exemple utilise la ressource `wordpress.org/themes`, qui nécessite un `slug` identique à celui utilisé dans le répertoire de thème WordPress :

<!-- The example uses the `wordpress.org/themes` resource, which requires a `slug` identical to the one used in WordPress theme directory: -->

Dans ce cas, `https://wordpress.org/themes/<slug>/` devient `https://wordpress.org/themes/adventurer/`.

<!-- In this case, `https://wordpress.org/themes/<slug>/` becomes `https://wordpress.org/themes/adventurer/`. -->

:::note
Pour en savoir plus sur les ressources prises en charge, consultez le [Référenciel API des ressources blueprint](/blueprints/steps/resources/).
:::

<!--
note
Learn more about the supported resources in the [Blueprint Resources API Reference](/blueprints/steps/resources/).
-->

## 4. Installer l’extension _Hello Dolly_

<!-- ## 4. Install the _Hello Dolly_ plugin -->

Une extension WordPress classique qui affiche des paroles aléatoires de la chanson « Hello, Dolly ! » au sein du tableau de bord d’administration. Installons-le à l’aide de l’étape [`installPlugin`](/blueprints/steps#InstallPluginStep) :

<!-- A classic WordPress plugin that displays random lyrics from the song "Hello, Dolly!" in the admin dashboard. Let's install it using the [`installPlugin` step](/blueprints/steps#InstallPluginStep): -->

```json
{
	"siteOptions": {
		"blogname": "Mon premier blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		}
	]
}
```

[<kbd> &nbsp; Lancer Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJzaXRlT3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX0seyJzdGVwIjoiaW5zdGFsbFBsdWdpbiIsInBsdWdpblppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3BsdWdpbnMiLCJzbHVnIjoiaGVsbG8tZG9sbHkifX1dfQ==)

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJzaXRlT3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX0seyJzdGVwIjoiaW5zdGFsbFBsdWdpbiIsInBsdWdpblppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3BsdWdpbnMiLCJzbHVnIjoiaGVsbG8tZG9sbHkifX1dfQ==) -->

L’extension Hello Dolly est maintenant installée et active.

<!-- The Hello Dolly plugin is now installed and activated. -->

Comme le `themeData`, le `pluginData` fait référence à un fichier externe nécessaire à l’étape. Cet exemple utilise la ressource `wordpress.org/plugins` pour installer l’extension avec le `slug` correspondant du répertoire d’extension de WordPress.

<!-- Like the `themeData`, the `pluginData` defines a reference to an external file required for the step. The example uses the `wordpress.org/plugins` resource to install the plugin with the matching `slug` from the WordPress plugin directory. -->

## 5. Installer une extension personnalisée

<!-- ## 5. Install a custom plugin -->

Installons une extension WordPress qui ajoute un message dans le tableau de bord :

<!-- Let's install a custom WordPress plugin that adds a message to the admin dashboard: -->

```php
<?php
/*
Plugin Name: "Hello" on the Dashboard
Description: A custom plugin to showcase WordPress Blueprints
Version: 1.0
Author: WordPress Contributors
*/

function my_custom_plugin() {
    echo '<h1>Hello from My Custom Plugin!</h1>';
}

add_action('admin_notices', 'my_custom_plugin');
```

Vous pouvez utiliser l’étape [installPlugin](/blueprints/steps#InstallPluginStep), mais cela nécessite la création d'un fichier ZIP. Démarrons avec quelque chose de différent pour voir si l’extension fonctionne :

<!-- You can use the [installPlugin](/blueprints/steps#InstallPluginStep), but that requires creating a ZIP file. Let's start with something different to see if the plugin works: -->

1. Créez un répertoire `wp-content/plugins/hello-from-the-dashboard` en utilisant l’[étape `mkdir`](/blueprints/steps#MkdirStep).
2. Écrivez un fichier `plugin.php` en utilisant l’[étape `writeFile`](/blueprints/steps#WriteFileStep).
3. Activez l’extension en utilisant l’[étape `activatePlugin`](/blueprints/steps#ActivatePluginStep).

<!--
1. Create a `wp-content/plugins/hello-from-the-dashboard` directory using the [`mkdir` step](/blueprints/steps#MkdirStep).
2. Write a `plugin.php` file using the [`writeFile` step](/blueprints/steps#WriteFileStep).
3. Activate the plugin using the [`activatePlugin` step](/blueprints/steps#ActivatePluginStep).
-->

Voici à quoi ça ressemble dans un blueprint :

<!-- Here's what that looks like in a Blueprint: -->

```jsonc
{
	// ...
	"steps": [
		// ...
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard",
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" on the Dashboard\nDescription: A custom plugin to showcase WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Hello from My Custom Plugin!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');",
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php",
		},
	],
}
```

La dernière chose à faire est de connecter l’utilisateur/utilisatrice en tant qu’administrateur/administratrice. Vous pouvez le faire à l’aide de la forme courte de l’[étape `login`](/blueprints/steps#LoginStep) :

<!-- The last thing to do is log the user in as an admin. You can do that with a shorthand of the [`login` step](/blueprints/steps#LoginStep): -->

```json
{
	"login": true,
	"steps": {
		// ...
	}
}
```

Voici le blueprint en entier :

<!-- Here's the complete Blueprint: -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" on the Dashboard\nDescription: A custom plugin to showcase WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Hello from My Custom Plugin!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');"
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php"
		}
	]
}
```

[<kbd> &nbsp; Lancer Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJsb2dpbiI6dHJ1ZSwic2l0ZU9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifSwic3RlcHMiOlt7InN0ZXAiOiJpbnN0YWxsVGhlbWUiLCJ0aGVtZVppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3RoZW1lcyIsInNsdWciOiJhZHZlbnR1cmVyIn19LHsic3RlcCI6Imluc3RhbGxQbHVnaW4iLCJwbHVnaW5aaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy9wbHVnaW5zIiwic2x1ZyI6ImhlbGxvLWRvbGx5In19LHsic3RlcCI6Im1rZGlyIiwicGF0aCI6Ii93b3JkcHJlc3Mvd3AtY29udGVudC9wbHVnaW5zL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQifSx7InN0ZXAiOiJ3cml0ZUZpbGUiLCJwYXRoIjoiL3dvcmRwcmVzcy93cC1jb250ZW50L3BsdWdpbnMvaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIiwiZGF0YSI6Ijw/cGhwXG4vKlxuUGx1Z2luIE5hbWU6IFwiSGVsbG9cIiBvbiB0aGUgRGFzaGJvYXJkXG5EZXNjcmlwdGlvbjogQSBjdXN0b20gcGx1Z2luIHRvIHNob3djYXNlIFdvcmRQcmVzcyBCbHVlcHJpbnRzXG5WZXJzaW9uOiAxLjBcbkF1dGhvcjogV29yZFByZXNzIENvbnRyaWJ1dG9yc1xuKi9cblxuZnVuY3Rpb24gbXlfY3VzdG9tX3BsdWdpbigpIHtcbiAgICBlY2hvICc8aDE+SGVsbG8gZnJvbSBNeSBDdXN0b20gUGx1Z2luITwvaDE+Jztcbn1cblxuYWRkX2FjdGlvbignYWRtaW5fbm90aWNlcycsICdteV9jdXN0b21fcGx1Z2luJyk7In0seyJzdGVwIjoiYWN0aXZhdGVQbHVnaW4iLCJwbHVnaW5QYXRoIjoiaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIn1dfQ==)

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJsb2dpbiI6dHJ1ZSwic2l0ZU9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifSwic3RlcHMiOlt7InN0ZXAiOiJpbnN0YWxsVGhlbWUiLCJ0aGVtZVppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3RoZW1lcyIsInNsdWciOiJhZHZlbnR1cmVyIn19LHsic3RlcCI6Imluc3RhbGxQbHVnaW4iLCJwbHVnaW5aaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy9wbHVnaW5zIiwic2x1ZyI6ImhlbGxvLWRvbGx5In19LHsic3RlcCI6Im1rZGlyIiwicGF0aCI6Ii93b3JkcHJlc3Mvd3AtY29udGVudC9wbHVnaW5zL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQifSx7InN0ZXAiOiJ3cml0ZUZpbGUiLCJwYXRoIjoiL3dvcmRwcmVzcy93cC1jb250ZW50L3BsdWdpbnMvaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIiwiZGF0YSI6Ijw/cGhwXG4vKlxuUGx1Z2luIE5hbWU6IFwiSGVsbG9cIiBvbiB0aGUgRGFzaGJvYXJkXG5EZXNjcmlwdGlvbjogQSBjdXN0b20gcGx1Z2luIHRvIHNob3djYXNlIFdvcmRQcmVzcyBCbHVlcHJpbnRzXG5WZXJzaW9uOiAxLjBcbkF1dGhvcjogV29yZFByZXNzIENvbnRyaWJ1dG9yc1xuKi9cblxuZnVuY3Rpb24gbXlfY3VzdG9tX3BsdWdpbigpIHtcbiAgICBlY2hvICc8aDE+SGVsbG8gZnJvbSBNeSBDdXN0b20gUGx1Z2luITwvaDE+Jztcbn1cblxuYWRkX2FjdGlvbignYWRtaW5fbm90aWNlcycsICdteV9jdXN0b21fcGx1Z2luJyk7In0seyJzdGVwIjoiYWN0aXZhdGVQbHVnaW4iLCJwbHVnaW5QYXRoIjoiaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIn1dfQ==) -->

Voici à quoi cela ressemble quand vous naviguez dans le tableau de bord :

<!-- That's what it looks like when you navigate to the dashboard: -->

![Site avec l’extension personnalisée](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/installed-custom-plugin.webp)

<!-- ![Site with the custom plugin](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/installed-custom-plugin.webp) -->

### Créer une extension et la compresser

<!-- ### Create a plugin and zip it -->

Encoder des fichiers PHP en `JSON` peut être utile pour des tests rapides, mais cela est peu pratique et difficile à lire. Au lieu de cela, créez un fichier contenant le code de l’extension, compressez-le et utilisez le fichier `ZIP` comme `resource` dans l’[étape `installPlugin`](/blueprints/steps#InstallPluginStep) pour l’installer (le chemin dans l’`URL` doit correspondre à celui de votre dépôt GitHub) :

<!-- Encoding PHP files as `JSON` can be useful for quick testing, but it's inconvenient and difficult to read. Instead, create a file with the plugin code, compress it, and use the `ZIP` file as the `resource` in the [`installPlugin` step](/blueprints/steps#InstallPluginStep) to install it (the path in the `URL` should match the one in your GitHub repository): -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
			}
		}
	]
}
```

Vous pouvez raccourcir encore davantage ce blueprint en utilisant la forme courte :

<!-- You can shorten that Blueprint even more using the shorthand syntax: -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; Lancer Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fV19)

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fV19) -->

## 6. Changer le contenu du site

<!-- ## 6. Change the site content -->

Enfin, supprimons le contenu par défaut du site et importons-en un nouveau à partir d’un fichier d’exportation WordPress (WXR).

<!-- Finally, let's delete the default content of the site and import a new one from a WordPress export file (WXR). -->

### Supprimer le vieux contenu

<!-- ### Delete the old content -->

Il n’existe pas d’étape blueprint permettant de supprimer le contenu par défaut, mais vous pouvez le faire à l’aide d’un extrait de code PHP :

<!-- There isn't a Blueprint step to delete the default content, but you can do that with a snippet of PHP code: -->

```php
<?php
require '/wordpress/wp-load.php';

// Delete all posts and pages
$posts = get_posts(array(
    'numberposts' => -1,
    'post_type' => array('post', 'page'),
    'post_status' => 'any'
));

foreach ($posts as $post) {
    wp_delete_post($post->ID, true);
}
```

Pour exécuter ce code pendant la configuration, utiliser l’[étape `runPHP`](/blueprints/steps#RunPHPStep) :

<!-- To run that code during the site setup, use the [`runPHP` step](/blueprints/steps#RunPHPStep): -->

```json
{
	// ...
	"steps": [
		// ...
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		}
	]
}
```

### Importer le nouveau contenu

<!-- ### Import the new content -->

Utilisons l’[étape `importWxr`](/blueprints/steps#ImportWXRStep) pour importer un fichier d’exportation WordPress (`WXR`) qui permet de tester les thèmes WordPress. Le fichier est disponible dans le répertoire [WordPress/theme-test-data](https://github.com/WordPress/theme-test-data) et vous pouvez y accéder via son adresse `raw.githubusercontent.com` : [https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml](https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml).

<!--
Let's use the [`importWxr` step](/blueprints/steps#ImportWXRStep) to import a WordPress export (`WXR`) file that helps test WordPress themes. The file is available in the [WordPress/theme-test-data](https://github.com/WordPress/theme-test-data) repository, and you can access it via its `raw.githubusercontent.com` address: [https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml](https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml).
-->

Voici à quoi ressemble la version finale du blueprint :

<!-- Here's what the final Blueprint looks like: -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml"
			}
		}
	]
}
```

[<kbd> &nbsp; Lancer Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2Fzc2V0cy9oZWxsby1mcm9tLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fSx7InN0ZXAiOiJydW5QSFAiLCJjb2RlIjoiPD9waHBcbnJlcXVpcmUgJy93b3JkcHJlc3Mvd3AtbG9hZC5waHAnO1xuXG4kcG9zdHMgPSBnZXRfcG9zdHMoYXJyYXkoXG4gICAgJ251bWJlcnBvc3RzJyA9PiAtMSxcbiAgICAncG9zdF90eXBlJyA9PiBhcnJheSgncG9zdCcsICdwYWdlJyksXG4gICAgJ3Bvc3Rfc3RhdHVzJyA9PiAnYW55J1xuKSk7XG5cbmZvcmVhY2ggKCRwb3N0cyBhcyAkcG9zdCkge1xuICAgIHdwX2RlbGV0ZV9wb3N0KCRwb3N0LT5JRCwgdHJ1ZSk7XG59In0seyJzdGVwIjoiaW1wb3J0V3hyIiwiZmlsZSI6eyJyZXNvdXJjZSI6InVybCIsInVybCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9Xb3JkUHJlc3MvdGhlbWUtdGVzdC1kYXRhL21hc3Rlci90aGVtZXVuaXR0ZXN0ZGF0YS53b3JkcHJlc3MueG1sIn19XX0=)

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2Fzc2V0cy9oZWxsby1mcm9tLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fSx7InN0ZXAiOiJydW5QSFAiLCJjb2RlIjoiPD9waHBcbnJlcXVpcmUgJy93b3JkcHJlc3Mvd3AtbG9hZC5waHAnO1xuXG4kcG9zdHMgPSBnZXRfcG9zdHMoYXJyYXkoXG4gICAgJ251bWJlcnBvc3RzJyA9PiAtMSxcbiAgICAncG9zdF90eXBlJyA9PiBhcnJheSgncG9zdCcsICdwYWdlJyksXG4gICAgJ3Bvc3Rfc3RhdHVzJyA9PiAnYW55J1xuKSk7XG5cbmZvcmVhY2ggKCRwb3N0cyBhcyAkcG9zdCkge1xuICAgIHdwX2RlbGV0ZV9wb3N0KCRwb3N0LT5JRCwgdHJ1ZSk7XG59In0seyJzdGVwIjoiaW1wb3J0V3hyIiwiZmlsZSI6eyJyZXNvdXJjZSI6InVybCIsInVybCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9Xb3JkUHJlc3MvdGhlbWUtdGVzdC1kYXRhL21hc3Rlci90aGVtZXVuaXR0ZXN0ZGF0YS53b3JkcHJlc3MueG1sIn19XX0=) -->

Et voilà. Félicitations, vous avez créé votre premier blueprint ! 🥳

<!-- And that's it. Congratulations on creating your first Blueprint! 🥳 -->

<div class="callout callout-info">

Traduction par [@quentinsauvaire](https://profiles.wordpress.org/quentinsauvaire/) et relecture par [@beryldlg](https://profiles.wordpress.org/beryldlg/)

Dernière mise à jour le 9 mars 2026

</div>
