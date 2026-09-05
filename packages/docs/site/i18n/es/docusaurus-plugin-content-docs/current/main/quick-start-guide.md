---
title: Guía de inicio rápido
slug: /quick-start-guide
description: Una guía de 5 minutos para comenzar con Playground. Aprende a probar plugins, probar temas y usar diferentes versiones de WP/PHP.
---

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
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

Esta página te guiará a través de cada una de ellas. Si prefieres aprender de forma visual, aquí tienes un video. Algunos detalles de la interfaz del video son anteriores al Dock; sigue los pasos escritos para usar la interfaz actual.

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## Inicia un nuevo sitio de WordPress

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

Abre la [demostración oficial en playground.wordpress.net](https://playground.wordpress.net/) para iniciar WordPress en tu navegador.

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

Puedes crear páginas, subir plugins, instalar temas, importar contenido y hacer la mayoría de las cosas que harías en un sitio de WordPress normal.

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

Cuando el almacenamiento del navegador está disponible, los Playgrounds nuevos se guardan automáticamente. Puedes encontrar hasta cinco autoguardados recientes en **Tus Playgrounds**, desde el Dock. Si necesitas un sitio que se descarte al actualizar, abre Playground con `?storage=temp`.

<div class="callout callout-info">

<!--
**WordPress Playground is private**
-->

**WordPress Playground es privado**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

Playground se ejecuta localmente en tu navegador. No sube tu sitio a ningún lugar salvo que elijas una acción como **Exportar a GitHub**. Cuando termines, puedes almacenar el Playground permanentemente, exportarlo como ZIP o empezar de nuevo desde **Nuevo Playground**.

</div>

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

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Esto se denomina [API de consultas](/developers/apis/query-api/) y puedes obtener más información [aquí](/developers/apis/query-api/).

<!--
## Store a Playground in browser storage
-->

## Almacenar un Playground en el navegador

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

Haz clic en el estado **Guardado automáticamente** o **Sin guardar** del Dock para abrir **Almacenar permanentemente** y elige **Guardar en el almacenamiento del navegador**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![El panel Almacenar permanentemente con el nombre del Playground y el botón Guardar](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

Un Playground guardado en el navegador aparece en **Tus Playgrounds**. Los autoguardados también aparecen allí, pero Playground solo conserva hasta cinco autoguardados recientes. Almacena un Playground permanentemente cuando quieras conservarlo más allá del ciclo de vida de los autoguardados.

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

El almacenamiento del navegador sigue perteneciendo al navegador. Exporta un ZIP cuando necesites un archivo que puedas mover, archivar o restaurar más adelante.

<!--
## Export a portable ZIP
-->

## Exportar un ZIP portátil

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Abre **Exportar** desde el Dock y usa **Descargar como .zip**.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![El panel Exportar con Descargar como .zip resaltado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

El archivo exportado contiene los archivos, la base de datos, los plugins, los temas, las subidas y las ediciones actuales. Puedes restaurarlo en Playground o alojarlo en un servidor compatible con PHP y SQLite.

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

El archivo de base de datos SQLite se incluye en `wp-content/database/.ht.sqlite`. Los archivos que empiezan por un punto están ocultos de forma predeterminada en la mayoría de los sistemas operativos, por lo que quizá tengas que habilitar los archivos ocultos en tu administrador de archivos.

<!--
## Restore a ZIP
-->

## Restaurar un ZIP

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Abre **Nuevo Playground** desde el Dock, elige **Importar ZIP** y selecciona el archivo ZIP.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![El panel Nuevo Playground con Importar ZIP seleccionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

Esto restaura los archivos y la base de datos del ZIP en un Playground nuevo.

<!--
## Use a specific WordPress or PHP version
-->

## Usar una versión específica de WordPress o PHP

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

Abre **Ajustes del sitio** desde el Dock para elegir las opciones de WordPress, PHP, idioma, multisitio y conexión de red.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![El panel Ajustes del sitio](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
<div class="callout callout-info">

**Test your plugin or theme**

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

</div>
-->

<div class="callout callout-info">

<!--
**Test your plugin or theme**
-->

**Prueba tu plugin o tema**

<!--
Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

Las pruebas de compatibilidad con tantas versiones de WordPress y PHP siempre fueron un dolor de cabeza. WordPress Playground hace este proceso sin esfuerzo: ¡úsalo a tu favor!

</div>

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
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Esto se denomina [API de consultas](/developers/apis/query-api/) y puedes obtener más información [aquí](/developers/apis/query-api/).

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

Usa `php=next` para probar la siguiente versión de PHP compilada desde la rama de desarrollo de php-src. Por ejemplo, consulta la [vista previa de las funciones de PHP 8.6](https://playground.wordpress.net/php-8-6.html).

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Para aprender más sobre la preparación de contenido para demostraciones, consulta la [guía de proporcionar contenido para tu demostración](/guides/providing-content-for-your-demo).

<!--
<div class="callout callout-info">

**Major versions only**

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work.

</div>
-->

<div class="callout callout-info">

<!--
**Major versions only**
-->

**Solo versiones principales**

<!--
You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

Puedes especificar versiones principales como `wp=6.2` o `php=8.1` y esperar la versión más reciente en esa línea. Sin embargo, no puedes solicitar versiones menores antiguas, por lo que ni `wp=6.1.2` ni `php=7.4.9` funcionarán.

</div>

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

Esto es diferente de restaurar un ZIP de Playground. Un archivo WXR importa contenido de WordPress en un sitio existente. Un ZIP de Playground restaura los archivos y la base de datos en un Playground nuevo.

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
