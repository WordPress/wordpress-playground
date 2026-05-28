---
sidebar_position: 1
title: Formato de datos de Blueprint
slug: /blueprints/data-format
description: Una visión general del formato de datos de Blueprint. Aprende sobre propiedades clave como landingPage, preferredVersions y steps.
---

<!-- title: Blueprint data Format -->

<!-- description: An overview of the Blueprint data format. Learn about key properties like landingPage, preferredVersions, and steps. -->

<!-- # Blueprint data format -->

# Formato de datos de Blueprint

<!-- A Blueprint JSON file can have many different properties that will be used to define your Playground instance. The most important properties are detailed below. -->

Un archivo JSON de Blueprint puede tener muchas propiedades diferentes que se
usarán para definir tu instancia de Playground. Las propiedades más importantes
se detallan a continuación.

<!-- Here's an example that uses many of them: -->

Este es un ejemplo que usa muchas de ellas:

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

## Esquema JSON

<!-- JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get auto-completion and validation in your editor. Just set the `$schema` property to the following: -->

Los archivos JSON pueden ser tediosos de escribir y fáciles de equivocarse.
Para ayudar con eso, Playground proporciona un archivo de
[esquema JSON](https://playground.wordpress.net/blueprint-schema.json) que
puedes usar para obtener autocompletado y validación en tu editor. Solo tienes
que definir la propiedad `$schema` así:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

<!-- ## Landing page -->

## Página de destino

<!-- The `landingPage` property tells Playground which URL to navigate to after the Blueprint has been run. This is a great tool, especially when creating theme or plugin demos. Often, you will want to start Playground in the Site Editor or have a specific post open in the Post Editor. Make sure you use a relative path. -->

La propiedad `landingPage` indica a Playground a qué URL navegar después de que
se haya ejecutado el Blueprint. Es una gran herramienta, especialmente al crear
demos de temas o plugins. A menudo querrás iniciar Playground en el Editor del
sitio o abrir una entrada específica en el Editor de entradas. Asegúrate de usar
una ruta relativa.

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

<!-- ## Preferred versions -->

## Versiones preferidas

<!-- The `preferredVersions` property declares your preferred PHP and WordPress versions. It can contain the following properties: -->

La propiedad `preferredVersions` declara tus versiones preferidas de PHP y
WordPress. Puede contener las siguientes propiedades:

<!--
- `php` (string): Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, or `latest`. Minor versions like `7.4.1` are not supported.
- `wp` (string): Loads the specified WordPress version. Accepts the last seven major WordPress versions. As of April 28, 2026, that's `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8`, or `6.9`. You can also use the generic values `latest`, `beta`, or `nightly` (alias `trunk`). `beta` resolves to the most recent Beta or Release Candidate of an active release cycle; `nightly`/`trunk` builds straight from the WordPress development branch.
-->

- `php` (string): Carga la versión de PHP especificada. Acepta `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` o `latest`. Las versiones menores como `7.4.1` no son compatibles.
- `wp` (string): Carga la versión de WordPress especificada. Acepta las últimas siete versiones principales de WordPress. Al 28 de abril de 2026, son `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8` o `6.9`. También puedes usar los valores genéricos `latest`, `beta` o `nightly` (alias `trunk`). `beta` se resuelve a la Beta o Release Candidate más reciente de un ciclo de lanzamiento activo; `nightly`/`trunk` se compila directamente desde la rama de desarrollo de WordPress.

```js
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.7"
	},
}
```

<!-- ## Features -->

## Características

<!-- You can use the `features` property to turn on or off certain features of the Playground instance. It can contain the following properties: -->

Puedes usar la propiedad `features` para activar o desactivar ciertas
características de la instancia de Playground. Puede contener las siguientes
propiedades:

<!-- - `networking`: Defaults to `true`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead. You will need this property enabled if you want the user to be able to install plugins or themes. -->

- `networking`: Su valor predeterminado es `true`. Activa o desactiva el soporte de red para Playground. Si está activado, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) y funciones similares de WordPress usarán realmente `fetch()` para hacer solicitudes HTTP. Si está desactivado, fallarán de inmediato. Necesitarás esta propiedad activada si quieres que la persona usuaria pueda instalar plugins o temas.

```js
{
	"features": {
		"networking": false
	},
}
```

<!-- ## Extra libraries -->

## Bibliotecas adicionales

<!-- You can preload extra libraries into the Playground instance. The following libraries are supported: -->

Puedes precargar bibliotecas adicionales en la instancia de Playground. Las
siguientes bibliotecas son compatibles:

<!-- - `wp-cli`: Enables WP-CLI support for Playground. If included, WP-CLI will be installed during boot. If not included, you will get an error message when trying to run WP-CLI commands using the JS API. WP-CLI will be installed by default if the blueprint contains any `wp-cli` steps. -->

- `wp-cli`: Activa el soporte de WP-CLI para Playground. Si se incluye, WP-CLI se instalará durante el arranque. Si no se incluye, recibirás un mensaje de error al intentar ejecutar comandos WP-CLI con la API JS. WP-CLI se instalará de forma predeterminada si el Blueprint contiene cualquier etapa `wp-cli`.

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

<!-- ## Steps -->

## Etapas

<!-- Arguably the most powerful property, `steps` allows you to configure the Playground instance with preinstalled themes, plugins, demo content, and more. The following example logs the user in with a dedicated username and password. It then installs and activates the Gutenberg plugin. [Learn more about steps](/blueprints/steps). -->

Probablemente la propiedad más potente, `steps` te permite configurar la
instancia de Playground con temas, plugins, contenido de demo y mucho más ya
instalado. El siguiente ejemplo inicia sesión con un nombre de usuario y una
contraseña dedicados. Luego instala y activa el plugin Gutenberg.
[Aprende más sobre las etapas](/blueprints/steps).

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

## Errores comunes de ubicación de propiedades

<!--
Blueprint validation errors often come from putting a valid property in the
wrong object.
-->

Los errores de validación de Blueprint a menudo aparecen al colocar una
propiedad válida en el objeto equivocado.

<!-- ### Activate a plugin or theme -->

### Activar un plugin o tema

<!--
`activate` belongs inside `options`, not inside `pluginData`, `themeData`, or
directly on the step.
-->

`activate` debe estar dentro de `options`, no dentro de `pluginData`,
`themeData` ni directamente en la etapa.

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

### Instalar plugins con el atajo

<!--
The `plugins` shorthand is a top-level Blueprint property. Do not put it inside
`preferredVersions`.
-->

El atajo `plugins` es una propiedad de nivel superior de Blueprint. No lo
coloques dentro de `preferredVersions`.

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

### Usar una sola forma de instalación de plugin

<!--
For an `installPlugin` step, use `pluginData`. Do not mix `pluginData` with
older examples or custom objects such as `pluginZipFile`.
-->

Para una etapa `installPlugin`, usa `pluginData`. No mezcles `pluginData` con
ejemplos antiguos u objetos personalizados como `pluginZipFile`.

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

El recurso `wordpress.org/plugins` necesita un `slug` separado. No escribas el
slug dentro del valor de `resource`, como `"wordpress.org/plugins/woocommerce"`.

<!-- ### Keep `preferredVersions` limited to versions -->

### Mantener `preferredVersions` limitado a versiones

<!--
`preferredVersions` only accepts `php` and `wp`. Use `features` for networking,
`plugins` or `installPlugin` for plugins, and `steps` for ordered setup tasks.
-->

`preferredVersions` solo acepta `php` y `wp`. Usa `features` para networking,
`plugins` o `installPlugin` para plugins, y `steps` para tareas de configuración
ordenadas.

<!-- ### Use explicit steps when order matters -->

### Usar etapas explícitas cuando importa el orden

<!--
Shorthands such as `plugins`, `login`, `siteOptions`, and `constants` are
expanded before the `steps` array. If one action must happen before another,
write both actions as explicit steps in the order you need.
-->

Atajos como `plugins`, `login`, `siteOptions` y `constants` se expanden antes
del array `steps`. Si una acción debe ocurrir antes que otra, escribe ambas
acciones como etapas explícitas en el orden que necesitas.
