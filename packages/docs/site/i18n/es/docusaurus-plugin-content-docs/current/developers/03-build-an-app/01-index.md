---
title: Guía de inicio rápido para desarrolladores
slug: /developers/build-your-first-app
description: Guía práctica para incrustar WordPress, instalar plugins, previsualizar PRs y construir aplicaciones con las APIs de Playground.
---

<!--
# Quick Start Guide for Developers
-->

# Guía de inicio rápido para desarrolladores

<!--
WordPress Playground was created as a programmable tool. Below you'll find a few examples of what you can do with it. Each discussed API is described in detail in the [APIs section](/developers/apis/):
-->

WordPress Playground fue creado como una herramienta programable. A continuación encontrarás algunos ejemplos de lo que puedes hacer con él. Cada API discutida se describe en detalle en la [sección de APIs](/developers/apis/):

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
## Embed WordPress on your website
-->

## Incrustar WordPress en tu sitio web

<!--
Playground can be embedded on your website using the HTML `<iframe>` tag as follows:
-->

Playground puede incrustarse en tu sitio web usando la etiqueta HTML `<iframe>` de la siguiente manera:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

<!--
Every visitor will get their own private WordPress instance for free. You can then customize it using one of the [Playground APIs](/developers/apis/).
-->

Cada visitante obtendrá su propia instancia privada de WordPress de forma gratuita. Luego puedes personalizarla usando una de las [APIs de Playground](/developers/apis/).

<div class="callout callout-warning">

**Careful with the demo site**

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

</div>

<!--
## Control the embedded website
-->

## Controlar el sitio web incrustado

<!--
WordPress Playground provides three APIs you can use to control the iframed website. All the examples in this section are built using one of these:
-->

WordPress Playground proporciona tres APIs que puedes usar para controlar el sitio web incrustado. Todos los ejemplos en esta sección están construidos usando una de estas:

- [Query API](/developers/apis/query-api) enable basic operations using only query parameters
- [Blueprints API](/blueprints) give you a great degree of control with a simple JSON file
- [JavaScript API](/developers/apis/javascript-api) give you full control via a JavaScript client from an npm package

<!--
Learn more about each of these APIs in the [APIs overview section](/developers/apis/).
-->

Aprende más sobre cada una de estas APIs en la [sección de descripción general de APIs](/developers/apis/).

<!--
## Showcase a plugin or theme from WordPress directory
-->

## Mostrar un plugin o tema del directorio de WordPress

<!--
You can install plugins and themes from the WordPress directory with only URL parameters. This iframe preinstalls the `coblocks` and `friends` plugins and the `pendant` theme.
-->

Puedes instalar plugins y temas del directorio de WordPress solo con parámetros de URL. Este iframe preinstala los plugins `coblocks` y `friends` y el tema `pendant`.

This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).

```html
<iframe src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

<!--
## Showcase any plugin or theme
-->

## Mostrar cualquier plugin o tema

<!--
What if your plugin is not in the WordPress directory?
-->

¿Qué pasa si tu plugin no está en el directorio de WordPress?

<!--
You can still showcase it on Playground by using [JSON Blueprints](/blueprints). For example, this Blueprint would download and install a plugin and a theme from your website and also import some starter content:
-->

Aún puedes mostrarlo en Playground usando [Blueprints JSON](/blueprints). Por ejemplo, este Blueprint descargaría e instalaría un plugin y un tema desde tu sitio web y también importaría contenido inicial:

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

Consulta [primeros pasos con Blueprints](/blueprints/getting-started) para aprender más.

<!--
## Preview pull requests from your repository
-->

## Previsualizar pull requests de tu repositorio

<!--
You can preview repository code two ways: directly with `git:directory`, or by pointing to a `.zip` from your CI pipeline. Here's the `git:directory` approach using [Blueprints](/blueprints):
-->

Puedes previsualizar código del repositorio de dos maneras: directamente con `git:directory`, o apuntando a un `.zip` de tu pipeline de CI. Aquí está el enfoque `git:directory` usando [Blueprints](/blueprints):

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

En el código anterior, se instalará un complemento desde un repositorio ubicado en `url`, y la referencia para encontrar la rama es `refType`; en este caso, se utilizará `refname`, pero también se puede utilizar `branch`, `tag` y `commit`.

<div class="callout callout-tip">

Puedes automatizar este proceso usando la [Acción de GitHub para generar enlaces de vista previa](/guides/github-action-pr-preview), lo que te ayudará a agilizarlo.

</div>

<!--
Loading a `.zip` file is another alternative for previewing your project. See the [live example of Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html).
-->

Cargar un archivo `.zip` es otra alternativa para previsualizar tu proyecto. Consulta el [ejemplo en vivo del previsualizador de PR de Gutenberg](https://playground.wordpress.net/gutenberg.html).

<!--
To use Playground as a PR previewer, you need:
-->

Para usar Playground como un previsualizador de PR, necesitas:

<!--
-   A CI pipeline that bundles your plugin or theme
-   Public access to the generated `.zip` file
-->

- Un pipeline de CI que empaquete tu plugin o tema
- Acceso público al archivo `.zip` generado

<!--
Those zip bundles aren't any different from regular WordPress Plugins, which means you can install them in Playground using the [JSON Blueprints](/blueprints) API. Once you expose an endpoint like https://your-site.com/pull-request-1234.zip, the following Blueprint will do the rest:
-->

Esos paquetes zip no son diferentes de los plugins regulares de WordPress, lo que significa que puedes instalarlos en Playground usando la API de [Blueprints JSON](/blueprints). Una vez que expongas un endpoint como https://your-site.com/pull-request-1234.zip, el siguiente Blueprint hará el resto:

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

La demo oficial de Playground usa esta técnica para previsualizar pull requests del repositorio de Gutenberg:

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

### Previsualizar ramas o PRs de WordPress Core y Gutenberg

<!--
You can preview specific pull requests from WordPress Core and Gutenberg repositories using Query API parameters. Gutenberg branches also have an alternative to preview them with the parameter `gutenberg-branch`. This is useful for testing the latest trunk changes or specific feature branches without creating a PR.
-->

Puedes previsualizar pull requests específicos de los repositorios de WordPress Core y Gutenberg usando parámetros de la API Query. Las ramas de Gutenberg también tienen una alternativa para previsualizarlas con el parámetro `gutenberg-branch`. Esto es útil para probar los últimos cambios de trunk o ramas de características específicas sin crear un PR.

<!--
-   Preview a specific WordPress Core PR: `https://playground.wordpress.net/?core-pr=9500`
-   Preview a specific Gutenberg PR: `https://playground.wordpress.net/?gutenberg-pr=73010`
-   Preview the Gutenberg trunk branch: `https://playground.wordpress.net/?gutenberg-branch=trunk`
-->

- Previsualizar un PR específico de WordPress Core: `https://playground.wordpress.net/?core-pr=9500`
- Previsualizar un PR específico de Gutenberg: `https://playground.wordpress.net/?gutenberg-pr=73010`
- Previsualizar la rama trunk de Gutenberg: `https://playground.wordpress.net/?gutenberg-branch=trunk`

<!--
## Build a compatibility testing environment
-->

## Construir un entorno de pruebas de compatibilidad

<!--
Test your plugin across PHP and WordPress versions by configuring them in Playground. This helps you verify compatibility before release.
-->

Prueba tu plugin en diferentes versiones de PHP y WordPress configurándolas en Playground. Esto te ayuda a verificar la compatibilidad antes del lanzamiento.

<!--
With the Query API, you'd simply add the `php` and `wp` query parameters to the URL:
-->

Con la API Query, simplemente agregarías los parámetros de consulta `php` y `wp` a la URL:

```html
<iframe src="https://playground.wordpress.net/?php=8.3&wp=6.1"></iframe>
```

<!--
With JSON Blueprints, you'd use the `preferredVersions` property:
-->

Con Blueprints JSON, usarías la propiedad `preferredVersions`:

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

## Ejecutar código PHP en el navegador

<!--
The JavaScript API provides the `run()` method which you can use to run PHP code in the browser:
-->

La API de JavaScript proporciona el método `run()` que puedes usar para ejecutar código PHP en el navegador:

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

¡Combina eso con un editor de código como Monaco o CodeMirror, y obtendrás fragmentos de código en vivo como en [este artículo](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)!
