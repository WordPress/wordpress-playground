---
title: Instancia Web
slug: /web-instance
description: Una guía detallada de la interfaz web en playground.wordpress.net, incluidos el Dock, la persistencia, la configuración y las herramientas del sitio.
---

<!--
# WordPress Playground web instance
-->

# Instancia web de WordPress Playground

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) ejecuta WordPress en tu navegador sin necesidad de un servidor. La página abre un Playground, muestra el sitio de WordPress y reúne las herramientas del sitio en el **Dock**.

<!--
![The Playground web instance with the Dock visible at the bottom of the page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![La instancia web de Playground con el Dock visible en la parte inferior de la página](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

El Dock incluye un campo de dirección, un estado de guardado, controles de diseño y accesos para crear, almacenar, inspeccionar y exportar Playgrounds.

<!--
## Customize Playground
-->

## Personalizar Playground

<!--
The Dock includes these destinations:
-->

El Dock incluye estos destinos:

<!--
- **New**: Start from the Blueprint gallery, a public Blueprint URL, a new
  Blueprint, a pull request preview, a GitHub repository, or an imported `.zip`
  file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language,
  networking, and multisite.
- **Database**: Inspect or download the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Inspect PHP errors, warnings, and notices.
- **Export**: Download a `.zip`, copy the original setup link, or export selected
  files to a GitHub pull request.
-->

- **Nuevo**: Empieza desde la galería de Blueprints, una URL pública de un Blueprint, un Blueprint nuevo, la vista previa de un pull request, un repositorio de GitHub o un archivo `.zip` importado.
- **Playgrounds**: Cambia entre Playgrounds recientes y guardados.
- **Blueprint**: Consulta, edita, exporta y ejecuta el Blueprint actual.
- **Ajustes del sitio**: Configura la versión de WordPress, la versión de PHP, el idioma, la conexión de red y multisitio.
- **Base de datos**: Inspecciona o descarga la base de datos SQLite y abre herramientas de base de datos.
- **Archivos**: Explora y edita archivos del sistema de archivos de WordPress.
- **Registros**: Inspecciona errores, advertencias y avisos de PHP.
- **Exportar**: Descarga un archivo `.zip`, copia el enlace de la configuración original o exporta archivos seleccionados a un pull request de GitHub.

<!--
## Navigate inside WordPress
-->

## Navegar dentro de WordPress

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

Usa el campo de dirección del Dock para abrir una ruta dentro del sitio de WordPress actual. Por ejemplo, introduce `/wp-admin/` para abrir el escritorio o `/wp-admin/plugins.php` para abrir la pantalla Plugins. **Actualizar página** vuelve a cargar la ruta actual de WordPress.

<!--
![The Refresh page button in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)
-->

![El botón Actualizar página en el Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

También puedes usar la [API de parámetros de consulta](/developers/apis/query-api/) para abrir Playground con una configuración específica, como una versión de WordPress, una versión de PHP, un plugin, un tema o un Blueprint.

<!--
## Understand the save status
-->

## Entender el estado de guardado

<!--
The status next to the address field tells you how the current Playground is stored:
-->

El estado situado junto al campo de dirección indica cómo está almacenado el Playground actual:

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- **Guardado automáticamente** significa que el Playground está almacenado en este navegador y se puede recuperar desde **Tus Playgrounds**. Playground conserva hasta cinco autoguardados recientes.
- **Guardado** significa que el Playground se almacenó de forma permanente en el navegador o se guardó en un directorio local.
- **Sin guardar** significa que el Playground no se ha guardado. Los Playgrounds temporales, incluidos los que usan `?storage=temp`, se pierden al cerrar o actualizar la pestaña.

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

Haz clic en **Guardado automáticamente** o **Sin guardar** para abrir **Almacenar permanentemente**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![El panel Almacenar permanentemente con el nombre del Playground y el botón Guardar](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

Almacenar permanentemente puede conservar un Playground autoguardado en el almacenamiento del navegador para que la limpieza de autoguardados ya no lo elimine. En los navegadores compatibles con la API de acceso al sistema de archivos, también puede guardar el Playground en un directorio local.

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

El almacenamiento del navegador sigue perteneciendo al navegador. Este puede eliminar los datos almacenados cuando lo requieran la presión de almacenamiento o los ajustes de privacidad. Exporta un ZIP cuando necesites una copia de seguridad portátil.

<!--
## Start a Playground
-->

## Iniciar un Playground

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Abre **Nuevo Playground** desde el Dock haciendo clic en **Nuevo**. El panel contiene **Galería de Blueprints**, **Desde una URL**, **Escribir un Blueprint**, **Vista previa de un PR**, **Desde GitHub** e **Importar ZIP**.

<!--
![The New Playground pane with the Blueprint gallery selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![El panel Nuevo Playground con la galería de Blueprints seleccionada](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

La galería de Blueprints comienza con **WordPress básico**, que crea una instalación limpia de WordPress. **Desde una URL** abre la URL pública de un Blueprint. **Escribir un Blueprint** abre un editor para un Blueprint nuevo. **Importar ZIP** restaura un ZIP exportado desde Playground.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![El panel Nuevo Playground con Importar ZIP seleccionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## Volver a Playgrounds recientes y guardados

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Abre **Tus Playgrounds** desde el Dock haciendo clic en **Playgrounds**. Allí aparecen el Playground actual, los autoguardados recientes y los Playgrounds que guardaste permanentemente.

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![El panel Tus Playgrounds con el Playground actual](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

Los Playgrounds autoguardados son puntos de recuperación. Playground conserva hasta cinco autoguardados recientes. Usa **Almacenar permanentemente** para conservar uno como Playground guardado.

<!--
## Change site settings
-->

## Cambiar los ajustes del sitio

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

Abre **Ajustes del sitio** para cambiar las opciones del entorno de ejecución y de WordPress.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![El panel Ajustes del sitio](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

La versión de PHP y la conexión de red se pueden aplicar a un Playground ya almacenado. La versión de WordPress, el idioma y multisitio cambian la propia instalación de WordPress, por lo que requieren un Playground nuevo.

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

Al ejecutar un Blueprint editado se conservan los Playgrounds almacenados y autoguardados. Un Playground temporal se descarta porque la nueva ejecución parte de una configuración limpia.

<!--
## Inspect the current Blueprint
-->

## Inspeccionar el Blueprint actual

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

Abre **Blueprint** para consultar y editar el Blueprint del Playground actual.

<!--
![The Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![El panel del editor de Blueprints](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

El editor puede ejecutar el Blueprint editado en un Playground nuevo. Si el Playground está almacenado o autoguardado, el original sigue disponible en **Tus Playgrounds**.

<!--
## Inspect files, database, and logs
-->

## Inspeccionar archivos, base de datos y registros

<!--
Open **Files** to browse and edit the current Playground files.
-->

Abre **Archivos** para explorar y editar los archivos del Playground actual.

<!--
![The Files pane with a WordPress file selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![El panel Archivos con un archivo de WordPress seleccionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

Abre **Base de datos** para usar herramientas de base de datos o descargar la base de datos SQLite.

<!--
![The Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![El panel Base de datos](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

Abre **Registros** para inspeccionar errores, advertencias y avisos de PHP.

<!--
![The PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![El panel del registro de errores de PHP](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## Exportar y compartir {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

Abre **Exportar** para descargar o compartir el Playground actual.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![El panel Exportar con Descargar como .zip resaltado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

**Descargar como .zip** exporta los archivos, la base de datos, los plugins, los temas, las subidas y las ediciones actuales. El ZIP se puede restaurar más adelante con **Nuevo → Importar ZIP**.

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

**Copiar el enlace de la configuración original** copia un enlace que solo vuelve a crear la configuración original. No incluye los cambios realizados después de iniciar el Playground.

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

**Exportar a GitHub** puede crear un pull request con archivos seleccionados del Playground actual.

<!--
## Change the Dock layout
-->

## Cambiar el diseño del Dock

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

El Dock se puede mostrar como panel flotante o como barra de ancho completo. Usa **Ancho completo** para cambiar de diseño.

<!--
| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![The full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |
-->

| Flotante                                                                                                                                                                    | Ancho completo                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![El Dock flotante predeterminado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![El diseño del Dock a ancho completo](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

Usa **Ocultar herramientas** para contraer el Dock y dejar visibles el campo de dirección y el estado de guardado. Usa **Mostrar herramientas** para volver a abrir la fila de herramientas.

<!--
![The Playground with Dock tools hidden](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)
-->

![Playground con las herramientas del Dock ocultas](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

En el escritorio puedes arrastrar el Dock flotante. Arrástralo más allá del borde izquierdo o derecho para plegarlo en un lanzador de esquina y haz clic en el lanzador para restaurar el Dock.

<!--
![The Dock folded into the corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)
-->

![El Dock plegado en el lanzador de esquina](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

En pantallas estrechas, el Dock usa un diseño móvil de ancho completo.

<!--
![The Dock on a mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)
-->

![El Dock en una pantalla móvil](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

El sitio [https://playground.wordpress.net](https://playground.wordpress.net) está disponible para apoyar a la comunidad, pero no hay garantías de que siga funcionando si el tráfico aumenta de forma significativa.

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

Si necesitas una disponibilidad determinada, debes [alojar tu propio WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
