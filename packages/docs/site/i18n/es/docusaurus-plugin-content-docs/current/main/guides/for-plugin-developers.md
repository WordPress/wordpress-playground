---
title: WordPress Playground para Desarrolladores de Plugins
slug: /guides/for-plugin-developers
description: Una guía para desarrolladores de plugins sobre cómo usar Playground para construir, probar y crear convincentes demostraciones en vivo para sus plugins.
---

<!--
The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment.

This guide will show you how to use WordPress Playground to improve your plugin development workflow, create live demos to showcase your plugin, and simplify your plugin testing and review.
-->

El WordPress Playground es una herramienta innovadora que permite a los desarrolladores de plugins construir, probar y mostrar sus plugins directamente en un entorno de navegador.

Esta guía te mostrará cómo usar WordPress Playground para mejorar tu flujo de trabajo de desarrollo de plugins, crear demostraciones en directo para mostrar tu plugin y simplificar las pruebas y revisiones de tu plugin.

<!--
:::info

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section.

:::
-->

:::info

Descubre cómo [Construir](/about/build), [Probar](/about/test) y [Lanzar](/about/launch) tus productos con WordPress Playground en la sección [Acerca de Playground](/about).

:::

<!--
## Launching a Playground instance with a plugin
-->

## Lanzando una instancia de Playground con un plugin

<!--
### Plugin in the WordPress themes directory
-->

### El Plugin en el directorio de plugins de WordPress

<!--
With WordPress Playground, you can quickly launch a WordPress installation with almost any plugin available in the [WordPress Plugins Directory](https://wordpress.org/plugins/) installed and activated. All you need to do is to add the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) and use the slug of the plugin from the WordPress directory as a value. For example: https://playground.wordpress.net/?plugin=create-block-theme
-->

Con WordPress Playground, puedes lanzar rápidamente una instalación de WordPress con casi cualquier plugin disponible en el [Directorio de Plugins de WordPress](https://wordpress.org/plugins/) instalado y activado. Todo lo que necesitas hacer es añadir el parámetro de consulta `plugin` a la [URL de Playground](https://playground.wordpress.net) y usar el slug del plugin del directorio de WordPress como valor. Por ejemplo: https://playground.wordpress.net/?plugin=create-block-theme

<!--
:::tip
You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
:::
-->

:::tip
Puedes instalar y activar varios plugins a través de parámetros de consulta repitiendo el parámetro `plugin` para cada plugin que quieras instalar y activar en la instancia de Playground. Por ejemplo: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
:::

<!--
You can also load any plugin from the WordPress plugins directory by setting the [`installPlugin` step](/blueprints/steps#InstallPluginStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})
-->

También puedes cargar cualquier plugin del directorio de plugins de WordPress configurando [el paso `installPlugin`](/blueprints/steps#InstallPluginStep) de un [Blueprint](/blueprints/getting-started) pasándolo a la instancia de Playground.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd> &nbsp; Ejecuta el Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

<!--
Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

Los Blueprints pueden ser pasados a una instancia de Playground [de múltiples formas](/blueprints/using-blueprints).

<!--
### Plugin in a GitHub repository
-->

### Plugin en un repositorio de GitHub

<!--
A plugin stored in a GitHub repository can also be loaded in a Playground instance via Blueprints.

With the `pluginData` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`url` resource](/blueprints/steps/resources#urlreference) that points to the location of the `.zip` file containing the plugin you want to load in the Playground instance.

To avoid CORS issues, the Playground project provides a [GitHub proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your plugin.
-->

Un plugin almacenado en un repositorio de GitHub también puede ser cargado en una instancia de Playground a través de Blueprints.

Con la propiedad `pluginData` del [paso `installPlugin` del blueprint](/blueprints/steps#installPlugin), puedes definir un [`recurso url`](/blueprints/steps/resources#urlreference) que apunte a la ubicación del archivo `.zip` que contiene el plugin que deseas cargar en la instancia de Playground.

Para evitar problemas de CORS, el proyecto Playground proporciona un [proxy de GitHub](https://playground.wordpress.net/proxy) que te permite generar un `.zip` a partir de un repositorio (o incluso una carpeta dentro de un repositorio) que contiene tu plugin.

<!--
:::info
[GitHub proxy](https://playground.wordpress.net/proxy) is an incredibly useful tool to load plugins from GitHub repositories as it allows you to load a plugin from a specific branch, a specific directory, a specific commit or a specific PR.
:::
-->

:::info
[El proxy de GitHub](https://playground.wordpress.net/proxy) es una herramienta increíblemente útil para cargar plugins desde repositorios de GitHub, ya que te permite cargar un plugin desde una rama específica, un directorio específico, un commit específico o un PR específico.
:::

<!--
:::tip
If your plugin is hosted on GitHub, you can automatically add preview buttons to your pull requests using the Playground PR Preview GitHub Action. This lets reviewers test your changes instantly without any setup. See [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) for details.
:::
-->

:::tip
Si tu plugin está alojado en GitHub, puedes agregar automáticamente botones de vista previa a tus pull requests utilizando la GitHub Action llamada Playground PR Preview. Esto permite a los revisores probar tus cambios al instante sin ninguna configuración. Consulta [Agregar botones de vista previa de PR con GitHub Actions](/guides/github-action-pr-preview) para más detalles.
:::

<!--
For example, the following `blueprint.json` installs a plugin from a GitHub repository leveraging the https://github-proxy.com tool:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin%22}}]})
-->

Por ejemplo, el siguiente `blueprint.json` instala un plugin desde un repositorio de GitHub aprovechando la herramienta https://github-proxy.com:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin"
			}
		}
	]
}
```

[<kbd> &nbsp; Ejecuta el Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin%22}}]})

<!--
### Plugin from code in a file or gist in GitHub
-->

### Plugin desde el código en un archivo o gist en GitHub

<!--
By combining the [`writeFile`](/blueprints/steps#WriteFileStep) and [`activatePlugin`](/blueprints/steps#activatePlugin) steps you can also launch a WP Playground instance with a plugin built on the fly from code stored on a gist or [a file in GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})
-->

Al combinar los pasos [`writeFile`](/blueprints/steps#WriteFileStep) y [`activatePlugin`](/blueprints/steps#activatePlugin) también puedes lanzar una instancia de WP Playground con un plugin creado sobre la marcha a partir de código almacenado en un gist o [un archivo en GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

[<kbd> &nbsp; Ejecuta el Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})

<!--
:::info

The [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example in the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) shows how to load a plugin from code in a gist

:::
-->

:::info

El ejemplo de [Instalar plugin desde un gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) en la [Galería de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) muestra cómo cargar un plugin desde el código en un gist

<!--
## Setting up a demo for your plugin with Blueprints
-->

## Configurando una demo para tu plugin con Blueprints

<!--
When providing a link to a WordPress Playground instance with some plugins activated, you may also want to customize the initial setup for that Playground instance using those plugins. With Playground's [Blueprints](/blueprints/getting-started) you can load/activate plugins and configure the Playground instance.
-->

Cuando proporcionas un enlace a una instancia de WordPress Playlist con algunos plugins activados, es posible que también quieras personalizar la configuración inicial de esa instancia de Playground utilizando esos plugins. Con los [Blueprints](/blueprints/getting-started) de Playground puedes cargar/activar plugins y configurar la instancia de Playground.

:::tip

Algunas herramientas y recursos útiles proporcionados por el proyecto Playground para trabajar con blueprints son:

-   Consulta la [Galería de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar ejemplos de código del mundo real que utilizan WordPress Playground para lanzar un sitio de WordPress con una variedad de configuraciones.
-   La herramienta [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) proporciona una interfaz visual para arrastrar o hacer clic en los pasos para crear un blueprint para WordPress Playground. ¡También puedes crear tus propios pasos!
-   La herramienta [Blueprints builder](https://playground.wordpress.net/builder/builder.html) te permite editar tu blueprint en línea y ejecutarlo directamente en una instancia de Playground.

:::

<!--
Through properties and [`steps`](/blueprints/steps) in the Blueprint, you can configure the Playground instance's initial setup, providing your plugins with the content and configuration needed for showcasing your plugin's compelling features and functionality.
-->

A través de propiedades y [`steps`](/blueprints/steps)(pasos) en el Blueprint, puedes configurar el estado inicial de la instancia de Playground, proporcionando a tus plugins el contenido y la configuración necesarios para mostrar las características y convincentes funcionalidades de tu plugin.

<!--
:::info

A great demo with WordPress Playground might require that you load default content for your plugin and theme, including images and other assets. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

:::
-->

:::info

Una gran demo con WordPress Playground podría requerir que cargues contenido predeterminado para tu plugin y tema, incluyendo imágenes y otros recursos. Consulta la guía [Proporcionar contenido para tu demo](/guides/providing-content-for-your-demo) para obtener más información sobre esto.

:::

<!--
### `plugins`

If your plugin has dependencies on other plugins you can use the `plugins` shorthand to install yours along with any other needed plugins.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})
-->

### `plugins`

Si tu plugin tiene dependencias con otros plugins, puedes usar la clave `plugins` para instalar el tuyo junto con cualquier otro plugin necesario.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> &nbsp; Ejecuta el Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

<!--
### `landingPage`

If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shorthand to automatically redirect to any page in the Playground instance upon loading.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})
-->

### `landingPage`

Si tu plugin tiene una vista de configuración o un asistente de incorporación, puedes usar la clave `landingPage` para redirigir automáticamente a cualquier página en la instancia de Playground al cargarla.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Ejecuta el Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

<!--
### `writeFile`

With the [`writeFile` step](/blueprints/steps#writeFile) you can create any plugin file on the fly, referencing code from a \*.php file stored on a GitHub or Gist.

Here’s an example of a **[plugin that generates Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, placed in the `mu-plugins` folder to ensure the code runs automatically on load:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```
-->

### `writeFile`

Con el [paso `writeFile`](/blueprints/steps#writeFile) puedes crear cualquier archivo de un plugin sobre la marcha, haciendo referencia al código de un archivo \*.php almacenado en repositorio de GitHub o un Gist.

Aquí tienes un ejemplo de un **[plugin que genera Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, colocado en la carpeta `mu-plugins` para asegurar que el código se ejecute automáticamente al cargar:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```

<!--
## Plugin Development
-->

## Desarrollo de Plugins

<!--
### Local plugin development and testing with Playground
-->

### Desarrollo y pruebas locales de plugins con Playground

<!--
From a plugins' folder in your local development environment, you can quickly load locally a Playground instance with that plugin loaded and activated.

Use the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your plugin's root directory using your preferred command line program.

With [Visual Studio Code](https://code.visualstudio.com/) IDE, you can also use the [Visual Studio Code extension](/developers/local-development/vscode-extension) while working in the root directory of your plugin.

For example:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```
-->

Desde la carpeta de un plugin en tu entorno de desarrollo local, puedes cargar rápidamente una instancia de Playground con ese plugin cargado y activado.

Usa el [comando `@wp-playground/cli`](/developers/local-development/wp-playground-cli) desde el directorio raíz de tu plugin utilizando tu programa de línea de comandos preferido.

Con el IDE [Visual Studio Code](https://code.visualstudio.com/), también puedes usar la [extensión de Visual Studio Code](/developers/local-development/vscode-extension) mientras trabajas en el directorio raíz de tu plugin.

Por ejemplo:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```

<!--
### See your local changes in a Playground instance and directly create PRs in a GitHub repo with your changes
-->

### Ver tus cambios locales en una instancia de Playground y crear PRs directamente en un repositorio de GitHub con tus cambios

<!--
With Google Chrome you can synchronize a Playground instance with your local plugin's code and your plugin's GitHub repo. With this connection you can:

-   See live (in the Playground instance) your local changes
-   Create PRs in the GitHub repo with your changes

Here's a little demo of this workflow in action:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>
-->

Con Google Chrome puedes sincronizar una instancia de Playground con el código local de tu plugin y el repositorio de GitHub de tu plugin. Con esta conexión puedes:

-   Ver en directo (en la instancia de Playground) tus cambios locales
-   Crear PRs en el repositorio de GitHub con tus cambios

Aquí tienes una pequeña demostración de este flujo de trabajo en acción:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

<!--
:::info

Check [About Playground > Build > Synchronize your playground instance with a local folder and create GitHub Pull Requests](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) for more info.

:::
-->

:::info

Consulta [Acerca de Playground > Construye > Sincroniza tu instancia de playground con una carpeta local y crea Pull Requests en GitHub](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) para obtener más información.

:::
