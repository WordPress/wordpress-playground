---
sidebar_position: 8
title: Ejemplos
slug: /blueprints/examples
description: Una galería de ejemplos prácticos de Blueprint para diversas tareas, como instalar temas, ejecutar PHP y habilitar características.
---

<!-- title: Examples -->
<!-- description: A gallery of practical Blueprint examples for various tasks, such as installing themes, running PHP, and enabling features. -->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# Ejemplos de Blueprints

<!-- # Blueprints Examples -->

:::tip
Consulta la [Galería de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar ejemplos de código del mundo real usando WordPress Playground para lanzar un sitio WordPress con una variedad de configuraciones.

<!-- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups. -->

:::

Veamos algunas cosas geniales que puedes hacer con Blueprints.

<!-- Let's see some cool things you can do with Blueprints. -->

## Instalar un Tema y un Plugin

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

## El objeto `meta`

<!-- ## The `meta` object -->

El objeto opcional `meta` proporciona información descriptiva sobre tu Blueprint. Aunque no afecta cómo se ejecuta el Blueprint, esta información es crucial para propósitos de visualización en galerías, selectores de Blueprint y herramientas integradas como [WordPress Studio](https://developer.wordpress.com/studio/) y [Galería de Blueprints](https://wordpress.github.io/blueprints/).

<!-- The optional `meta` object provides descriptive information about your Blueprint. While it doesn't affect how the Blueprint executes, this information is crucial for display purposes in galleries, Blueprint selectors, and integrated tools like [WordPress Studio](https://developer.wordpress.com/studio/) and [Blueprints Gallery](https://wordpress.github.io/blueprints/). -->

### Propiedades

<!-- ### Properties -->

| Campo             | Tipo            | Descripción                                         |
| :---------------- | :-------------- | :-------------------------------------------------- |
| **`title`**       | `string`        | Un nombre corto y legible para el Blueprint.        |
| **`description`** | `string`        | Un breve resumen explicando la configuración.       |
| **`author`**      | `string`        | El nombre o identificador del creador.              |
| **`categories`**  | `array<string>` | Etiquetas usadas para filtrar y agrupar Blueprints. |

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
		"title": "Configuración Predeterminada del Playground",
		"description": "Una configuración básica para un nuevo sitio WordPress con las versiones más recientes.",
		"author": "Equipo Playground",
		"categories": ["starter", "default"]
	},
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	}
}
```

## Ejecutar código PHP personalizado

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

## Habilitar una opción en la página de Experimentos de Gutenberg

<!-- ## Enable an option on the Gutenberg Experiments page -->

Aquí: Activa la función "nuevas vistas de administración".

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

## Cómo trabajar con WP-CLI desde la terminal y Playground

<!-- ## How to work with WP-CLI from the terminal and Playground -->

Puedes ejecutar comandos WP-CLI en una instancia de Playground desde tu terminal o directamente dentro de un Blueprint.

<!-- You can run WP-CLI commands on a Playground instance either from your terminal or directly within a Blueprint. -->

Para usar tu terminal, primero debes montar el directorio `/wordpress/` y asegurarte de que la integración de la base de datos SQLite esté configurada. Esto se debe a que la base de datos interna de Playground no persiste en un sitio montado, por lo que debes instalar explícitamente el plugin de base de datos a través de un Blueprint. Esto permite que WP-CLI reconozca la instalación de WordPress y se conecte a su base de datos.

<!-- To use your terminal, you must first mount the `/wordpress/` directory and ensure the SQLite database integration is configured. This is because Playground's internal database doesn't persist on a mounted site, so you must explicitly install the database plugin via a Blueprint. This allows WP-CLI to recognize the WordPress installation and connect to its database. -->

:::note
Si ejecutas comandos WP-CLI como pasos dentro de tu archivo Blueprint, esta configuración manual no es necesaria.

<!-- If you run WP-CLI commands as steps within your Blueprint file, this manual setup is not needed. -->

:::

El siguiente fragmento de Blueprint maneja esta configuración:

<!-- The following Blueprint snippet handles this setup: -->

<BlueprintExample blueprint={{
    "plugins": [ "sqlite-database-integration" ]
}} />

Para una explicación detallada de por qué esto es necesario, consulta la sección [Solucionar problemas y depurar Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites).

<!-- For a detailed explanation of why this is needed, refer to the [Troubleshoot and Debug Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites) section. -->

## Mostrar una demostración de producto

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

## Habilitar redes

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

## Cargar código PHP en cada solicitud (mu-plugin)

<!-- ## Load PHP code on every request (mu-plugin) -->

Usa el paso `writeFile` para agregar código a un mu-plugin que se ejecuta en cada solicitud.

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

## Editor de código (como un bloque Gutenberg)

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

Puedes compartir tus propios ejemplos de Blueprint en [esta wiki dedicada](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).

<!-- You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples). -->

## Cargar una versión antigua de WordPress

<!-- ## Load an older WordPress version -->

Playground solo incluye algunas versiones recientes de WordPress. Si necesitas usar una versión más antigua, este Blueprint puede ayudarte: cambia el número de versión en `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` de `6.2.1` a la versión que deseas cargar.

<!-- Playground only ships with a few recent WordPress releases. If you need to use an older version, this Blueprint can help you: change the version number in `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` from `6.2.1` to the release you want to load. -->

**Nota:** la versión más antigua compatible de WordPress es `6.2.1`, siguiendo el plugin de integración SQLite.

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

## Ejecutar WordPress desde trunk o un commit específico

<!-- ## Run WordPress from trunk or a specific commit. -->

WordPress Playground puede ejecutar `trunk` (el commit más reciente), el HEAD de una rama específica o un commit específico del repositorio GitHub [WordPress/WordPress](https://github.com/WordPress/WordPress).

<!-- WordPress Playground can run `trunk` (the latest commit), the HEAD of a specific branch or a specific commit from the [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub repository. -->

Puedes especificar la referencia en `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`.

<!-- You can specify the reference in `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`. -->

Para especificar el último commit de una rama específica, puedes cambiar la referencia al número de versión de la rama, por ejemplo `6.6`. Para ejecutar un commit específico, puedes usar el hash del commit de [WordPress/WordPress](https://github.com/WordPress/WordPress), por ejemplo `7d7a52367dee9925337e7d901886c2e9b21f70b6`.

<!-- To specify the latest commit of a particular branch, you can change the reference to the branch version number, eg `6.6`. To run a specific commit, you can use the commit hash from [WordPress/WordPress](https://github.com/WordPress/WordPress), eg `7d7a52367dee9925337e7d901886c2e9b21f70b6`. -->

**Nota:** la versión más antigua compatible de WordPress es `6.2.1`, siguiendo el plugin de integración SQLite.

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

<BlueprintExample blueprint={{
    "landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.3",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

## Usando Bundles de Blueprint

<!-- ## Using Blueprint Bundles -->

Aquí hay un ejemplo de un Blueprint que usa recursos empaquetados de un bundle de Blueprint:

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

Este bundle de Blueprint sería un archivo zip que contiene los siguientes archivos:

<!-- This Blueprint bundle would be zip file containing the following files: -->

- `/blueprint.json` - La declaración del blueprint descrita anteriormente
  <!-- - `/blueprint.json` - The blueprint declaration outlined above -->
- `/my-theme.zip` - Un paquete de tema
  <!-- - `/my-theme.zip` - A theme package -->
- `/my-plugin.zip` - Un paquete de plugin
  <!-- - `/my-plugin.zip` - A plugin package -->
- `/assets/custom-page.html` - Un archivo HTML personalizado
  <!-- - `/assets/custom-page.html` - A custom HTML file -->

Puedes usar este bundle de Blueprint:

<!-- You can use this Blueprint bundle by: -->

1. Creando un archivo ZIP con estos archivos y el blueprint.json
 <!-- 1. Creating a ZIP file with these files and the blueprint.json -->
2. Alojando el archivo ZIP en un servidor
 <!-- 2. Hosting the ZIP file on a server -->
3. Cargándolo con `?blueprint-url=https://example.com/my-blueprint-bundle.zip`
 <!-- 3. Loading it with `?blueprint-url=https://example.com/my-blueprint-bundle.zip` -->

Para más información sobre bundles de Blueprint, consulta la documentación de [Bundles de Blueprint](/blueprints/bundles).

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->
