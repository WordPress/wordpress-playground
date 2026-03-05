---
title: Guía de inicio rápido
slug: /quick-start-guide
description: Una guía de 5 minutos para comenzar con Playground. Aprende a probar plugins, probar temas y usar diferentes versiones de WP/PHP.
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!--
# Start using WordPress Playground in 5 minutes
-->

# Comienza a usar WordPress Playground en 5 minutos

<!--
WordPress Playground can help you with any of the following:
-->

WordPress Playground puede ayudarte con cualquiera de las siguientes tareas:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video:
-->

Esta página te guiará a través de cada una de ellas. Ah, y si eres un aprendiz visual, aquí hay un video:

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## Inicia un nuevo sitio de WordPress

<!--
Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site.
-->

Cada vez que visitas la [demostración oficial en playground.wordpress.net](https://playground.wordpress.net/), obtienes un sitio de WordPress nuevo.

<!--
You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress.
-->

Luego puedes crear páginas, subir plugins, temas, importar tu propio sitio y hacer la mayoría de las cosas que harías en un WordPress normal.

<!--
It's that easy to start!
-->

¡Es así de fácil comenzar!

<!--
The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page!
-->

Todo el sitio vive en tu navegador y se elimina cuando cierras la pestaña. ¿Quieres empezar de nuevo? ¡Solo actualiza la página!

<!--
:::info WordPress Playground is private

Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over!

:::
-->

:::info WordPress Playground es privado

Todo lo que construyes permanece en tu navegador y **no** se envía a ninguna parte. Una vez que termines, puedes exportar tu sitio como un archivo zip. ¡O simplemente actualiza la página y comienza de nuevo!

:::

<!--
## Try a block, a theme, or a plugin
-->

## Prueba un bloque, un tema o un plugin

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

Puedes subir cualquier plugin o tema que desees en [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Para ahorrar algunos clics, puedes preinstalar plugins o temas del directorio de plugins de WordPress agregando un parámetro `plugin` o `theme` a la URL. Por ejemplo, para instalar el plugin coblocks, puedes usar esta URL:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

O esta URL para preinstalar el tema `pendant`:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

En caso de que desees instalar múltiples temas y plugins, es posible repetir los parámetros `theme` o `plugin`:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

También puedes mezclar y combinar estos parámetros e incluso agregar múltiples plugins:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

<!--
## Save your site
-->

## Guarda tu sitio

<!--
To keep your WordPress Playground site for longer than a single browser session, you can export it as a `.zip` file.

1. Open the Playground site manager panel:
-->

Para mantener tu sitio de WordPress Playground por más tiempo que una sola sesión del navegador, puedes exportarlo como un archivo `.zip`.

1. Abre el panel del administrador de sitios de Playground:

![Site Manager](@site/static/img/site-manager/open-site-manager.webp)

<!--
2. Use the "Download as .zip" button in the additional actions menu
-->

2. Usa el botón "Descargar como .zip" en el menú de acciones adicionales

![Export button](@site/static/img/site-manager/export-zip-file.webp)

<!--
The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there.
-->

El archivo exportado contiene el sitio completo que has construido. Podrías alojarlo en cualquier servidor que admita PHP y SQLite. Todos los archivos principales de WordPress, plugins, temas y todo lo demás que hayas agregado a tu sitio están allí.

<!--
The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager.
-->

El archivo de base de datos SQLite también está incluido en la exportación, lo encontrarás en `wp-content/database/.ht.sqlite`. Ten en cuenta que los archivos que comienzan con un punto están ocultos por defecto en la mayoría de los sistemas operativos, por lo que es posible que necesites habilitar la opción "Mostrar archivos ocultos" en tu administrador de archivos.

<!--
## Restore a saved site
-->

## Restaura un sitio guardado

<!--
You can restore the saved site using the "Import from .zip" button in the Playground dashboard panel:
-->

Puedes restaurar el sitio guardado usando el botón "Importar desde .zip" en el panel del tablero de Playground:

<!--
1. Open the Playground dashboard panel:
-->

1. Abre el panel del tablero de Playground:

![Open Playground Dashboard](@site/static/img/dashboard/open-playground-dashboard.webp)

<!--
1. Use the "Import .zip" button at the end of the "Start a new Playground" section
-->

1. Usa el botón "Importar .zip" al final de la sección "Iniciar un nuevo Playground"

![Open Playground Dashboard](@site/static/img/dashboard/import-playground.webp)

<!--
## Use a specific WordPress or PHP version
-->

## Usa una versión específica de WordPress o PHP

<!--
The quickest way to change the version of WordPress or PHP is by using the settings panel on the [official demo site](https://playground.wordpress.net/):
-->

La forma más rápida de cambiar la versión de WordPress o PHP es usando el panel de configuración en el [sitio de demostración oficial](https://playground.wordpress.net/):

![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp)

<!--
:::info Test your plugin or theme

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

:::
-->

:::info Prueba tu plugin o tema

Las pruebas de compatibilidad con tantas versiones de WordPress y PHP siempre fueron un dolor de cabeza. WordPress Playground hace este proceso sin esfuerzo: ¡úsalo a tu favor!

:::

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:

-   https://playground.wordpress.net/?wp=6.5
-   https://playground.wordpress.net/?php=8.3
-   https://playground.wordpress.net/?php=8.2&wp=6.2
-->

También puedes usar los [parámetros de consulta](/developers/apis/query-api) `wp` y `php` para abrir Playground con las versiones correctas ya cargadas:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Para aprender más sobre la preparación de contenido para demostraciones, consulta la [guía de proporcionar contenido para tu demostración](/guides/providing-content-for-your-demo).

<!--
:::info Major versions only

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work.

:::
-->

:::info Solo versiones principales

Puedes especificar versiones principales como `wp=6.2` o `php=8.1` y esperar la versión más reciente en esa línea. Sin embargo, no puedes solicitar versiones menores antiguas, por lo que ni `wp=6.1.2` ni `php=7.4.9` funcionarán.

:::

<!--
## Import a WXR file
-->

## Importa un archivo WXR

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

Puedes importar un archivo de exportación de WordPress cargando un archivo WXR en [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

También puedes usar [Blueprints JSON](/blueprints). Consulta [comenzando con Blueprints](/blueprints/getting-started) para aprender más.

<!--
This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site.
-->

Esto es diferente de la función de importación descrita anteriormente. La función de importación exporta todo el sitio, incluida la base de datos. Esta función de importación importa un archivo WXR en un sitio existente.

<!--
## Build apps with WordPress Playground
-->

## Construye aplicaciones con WordPress Playground

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), setup plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

WordPress Playground es programable, lo que significa que puedes [construir aplicaciones de WordPress](/developers/build-your-first-app), configurar demostraciones de plugins e incluso usarlo como un [entorno de desarrollo local](/developers/local-development/) sin configuración.

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

Para aprender más sobre el desarrollo con WordPress Playground, consulta la sección de [inicio rápido de desarrollo](/developers/build-your-first-app).
