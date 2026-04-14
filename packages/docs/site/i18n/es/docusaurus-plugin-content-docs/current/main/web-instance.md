---
title: Instancia Web
slug: /web-instance
description: Una guía detallada de la interfaz web en playground.wordpress.net, cubriendo la barra de herramientas, configuración y administrador de instancias.
---

<!--
# WordPress Playground web instance
-->

# Instancia web de WordPress Playground

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) lets developers run WordPress in a browser without a server. This environment makes testing plugins, themes, and features quick and easy.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) permite a los desarrolladores ejecutar WordPress en un navegador sin necesidad de un servidor. Este entorno hace que probar plugins, temas y funciones sea rápido y fácil.

<!--
Some key features:

- **Browser-based**: No local server setup required.
- **Instant Setup**: Run WordPress with a single click.
- **Testing Environment**: Ideal for testing plugins and themes.
-->

Algunas características clave:

- **Basado en navegador**: No se requiere configuración de servidor local.
- **Configuración instantánea**: Ejecuta WordPress con un solo clic.
- **Entorno de prueba**: Ideal para probar plugins y temas.

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

La [API de parámetros de consulta](/developers/apis/query-api/) te permite cargar directamente configuraciones específicas en una instancia de Playground. Esto incluye establecer una versión particular de WordPress, tema o plugin. También puedes definir configuraciones más complejas usando blueprints (consulta [ejemplos aquí](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

<!--
The Playground website includes toolbars that customize your instance and provide quick access to resources and utilities.
-->

El sitio web de Playground incluye barras de herramientas que personalizan tu instancia y proporcionan acceso rápido a recursos y utilidades.

![Playground Toolbar Snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-toolbar.webp)

<!--
## Customize Playground
-->

## Personalizar Playground

<!--
On the toolbar, you'll find:

- **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
- **Playground Dashboard**: This panel lets you manage WordPress Playground instances, save and export them, edit files from your WordPress instance, and create new Blueprints.
- **Playground Launch Panel**: The Launch Panel shows all the ways to launch a WordPress Playground instance.
-->

En la barra de herramientas, encontrarás:

- **Configuración de Playground**: Un panel para configurar tu instancia actual, como las versiones de PHP y WordPress.
- **Panel de Playground**: Este panel te permite administrar instancias de WordPress Playground, guardarlas, exportarlas, editar archivos de tu instancia de WordPress y crear nuevos Blueprints.
- **Panel de Lanzamiento de Playground**: El Panel de Lanzamiento muestra todas las formas de iniciar una instancia de WordPress Playground.

<!--
### Playground Settings
-->

### Configuración de Playground

![snapshot of customize Playground window at Playground instance](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-settings-panel.webp)

<!--
The **Playground Settings Panel** includes these [Query API options](/developers/apis/query-api#available-options):

- `wp`: Defines the WordPress version.
- `php`: Specifies the PHP version for the instance.
- `language`: Sets the WordPress instance language.
- `multisite`: Enables WordPress multisite support.
- `networking`: Enables network access to the WordPress Plugin Directory and WordPress APIs.
-->

El **Panel de Configuración de Playground** incluye estas [opciones de la API de consulta](/developers/apis/query-api#available-options):

- `wp`: Define la versión de WordPress.
- `php`: Especifica la versión de PHP para la instancia.
- `language`: Establece el idioma de la instancia de WordPress.
- `multisite`: Habilita el soporte multisitio de WordPress.
- `networking`: Habilita el acceso a la red para el Directorio de Plugins de WordPress y las APIs de WordPress.

<!--
## Playground Manager
-->

## Administrador de Playground

![Playground settings panel allow users to save export and edit the WordPress directly](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard.webp)

<!--
This panel lets you manage Playground instances and provides access to the following panels:

- **Settings**: To manage the current Playground's settings
- **File Browser**: Built-in IDE for editing files, uploading plugins and themes, and live editing. Playground auto-reloads changes in real time.
- **Blueprint**: A Blueprint editor for creating, saving, and running Blueprints in your Playground web instance.
- **Database**: Tools for managing the database with Adminer and phpMyAdmin, and downloading as a `.sqlite` file.
- **Logs**: Displays log messages when something goes wrong.
-->

Este panel te permite administrar instancias de Playground y proporciona acceso a los siguientes paneles:

- **Configuración**: Para administrar la configuración del Playground actual
- **Explorador de Archivos**: IDE integrado para editar archivos, subir plugins y temas, y edición en vivo. Playground recarga automáticamente los cambios en tiempo real.
- **Blueprint**: Un editor de Blueprint para crear, guardar y ejecutar Blueprints en tu instancia web de Playground.
- **Base de Datos**: Herramientas para administrar la base de datos con Adminer y phpMyAdmin, y descargar como archivo `.sqlite`.
- **Registros**: Muestra mensajes de registro cuando algo sale mal.

![Save Playground Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard-save.webp)

<!--
Click "Save" to create an instance and list it in the Playground Launch Panel. The Playground Dashboard also offers export and download options through the Additional actions menu:
-->

Haz clic en "Guardar" para crear una instancia y listarla en el Panel de Lanzamiento de Playground. El Panel de Playground también ofrece opciones de exportación y descarga a través del menú de Acciones adicionales:

<!--
### Additional actions menu
-->

### Menú de acciones adicionales

![Additional actions Menu](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/additional-options-playground-dashboard.webp)

<!--
- **Export Pull Request to GitHub**: Export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Watch a [demo of this feature](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Download as .zip**: Creates a `.zip` file with the setup of the Playground instance, including any themes or plugins installed. This `.zip` excludes content and database changes.
-->

- **Exportar Pull Request a GitHub**: Exporta plugins de WordPress, temas y directorios completos de wp-content como pull requests a cualquier repositorio público de GitHub. Mira una [demostración de esta función](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Descargar como .zip**: Crea un archivo `.zip` con la configuración de la instancia de Playground, incluidos los temas o plugins instalados. Este `.zip` no incluye contenido ni cambios en la base de datos.

<!--
### Blueprint Editor
-->

### Editor de Blueprint

![Blueprint editor WordPress Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-blueprint-editor.webp)

<!--
The Blueprint editor replaced the older Blueprint builder, offering the ability to manage multiple Blueprints and code validation.
-->

El editor de Blueprint reemplazó al antiguo constructor de Blueprint, ofreciendo la capacidad de administrar múltiples Blueprints y validación de código.

<!--
### Launch Playground Panel
-->

### Panel de Lanzamiento de Playground

![Playground Launch Panel](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dashboard/import-playground.webp)

<!--
This panel shows all the ways to launch WordPress Playground: import `.zip` files, load from GitHub repositories, and preview PRs from WordPress core and Gutenberg.

The Launch Panel also lists more than 40 blueprints from the Blueprint Gallery and your Saved Playgrounds.
-->

Este panel muestra todas las formas de lanzar WordPress Playground: importar archivos `.zip`, cargar desde repositorios de GitHub y previsualizar PRs de WordPress core y Gutenberg.

El Panel de Lanzamiento también lista más de 40 blueprints de la Galería de Blueprints y tus Playgrounds Guardados.

<!--
:::caution

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
-->

:::caution

El sitio en https://playground.wordpress.net está ahí para apoyar a la comunidad, pero no hay garantías de que continúe funcionando si el tráfico crece significativamente.

Si necesitas cierta disponibilidad, deberías [alojar tu propio WordPress Playground](/developers/architecture/host-your-own-playground).
:::
