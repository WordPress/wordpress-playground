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
[https://playground.wordpress.net/](https://playground.wordpress.net/) is a versatile web tool that allows developers to run WordPress in a browser without needing a server. This environment is particularly useful for testing plugins, themes, and other WordPress features quickly and efficiently.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) es una herramienta web versátil que permite a los desarrolladores ejecutar WordPress en un navegador sin necesidad de un servidor. Este entorno es particularmente útil para probar plugins, temas y otras características de WordPress de manera rápida y eficiente.

<!--
Some key features:

-   **Browser-based**: No local server setup required.
-   **Instant Setup**: Run WordPress with a single click.
-   **Testing Environment**: Ideal for testing plugins and themes.
-->

Algunas características clave:

-   **Basado en navegador**: No se requiere configuración de servidor local.
-   **Configuración instantánea**: Ejecuta WordPress con un solo clic.
-   **Entorno de prueba**: Ideal para probar plugins y temas.

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

La [API de parámetros de consulta](/developers/apis/query-api/) te permite cargar directamente configuraciones específicas en una instancia de Playground. Esto incluye establecer una versión particular de WordPress, tema o plugin. También puedes definir configuraciones más complejas usando blueprints (consulta [ejemplos aquí](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

<!--
From the Playground website, some toolbars are also available to customize your Playground instance and provide quick access to some resources and utilities.
-->

Desde el sitio web de Playground, también hay algunas barras de herramientas disponibles para personalizar tu instancia de Playground y proporcionar acceso rápido a algunos recursos y utilidades.

![Playground Toolbar Snapshot](@site/static/img/about/toolbar-playground.webp)

<!--
## Customize Playground
-->

## Personalizar Playground

<!--
On the toolbar, you'll find:

-   **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
-   **Playground Manager**: This panel lets you manage WordPress Playground instances, allowing you to save, import, and export them.
-->

En la barra de herramientas, encontrarás:

-   **Configuración de Playground**: Un panel para configurar tu instancia actual, como las versiones de PHP y WordPress.
-   **Administrador de Playground**: Este panel te permite administrar instancias de WordPress Playground, permitiéndote guardar, importar y exportarlas.

<!--
### Playground Settings
-->

### Configuración de Playground

![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)

<!--
The options available from the **Playground Settings Panel**, correspond to the following [Query API options](/developers/apis/query-api#available-options):

-   `language`: Sets the WordPress instance language.
-   `multisite`: Enables WordPress multisite support.
-   `networking`: Grants network access, allowing fetches from the WordPress plugin directory and internal WordPress APIs.
-   `php`: Specifies the PHP version for the instance.
-   `wp`: Defines the WordPress version.
-->

Las opciones disponibles desde el **Panel de Configuración de Playground**, corresponden a las siguientes [opciones de la API de consulta](/developers/apis/query-api#available-options):

-   `language`: Establece el idioma de la instancia de WordPress.
-   `multisite`: Habilita el soporte multisitio de WordPress.
-   `networking`: Otorga acceso a la red, permitiendo obtener datos del directorio de plugins de WordPress y las APIs internas de WordPress.
-   `php`: Especifica la versión de PHP para la instancia.
-   `wp`: Define la versión de WordPress.

<!--
## Playground Manager
-->

## Administrador de Playground

![Playground settings panel allow users to manage multiple instances](@site/static/img/about/playground-manager-panel.webp)

<!--
This panel enables users to manage Playground instances. It displays a list of saved Playgrounds and provides access to the current Playground's settings, along with a **Save Button** to store your configurations locally in your browser for later reloading.
-->

Este panel permite a los usuarios administrar instancias de Playground. Muestra una lista de Playgrounds guardados y proporciona acceso a la configuración del Playground actual, junto con un **Botón Guardar** para almacenar tus configuraciones localmente en tu navegador para volver a cargarlas más tarde.

![Save Playground Button](@site/static/img/about/playground-manager-save-instance.webp)

<!--
Once you click on save, an instance will be stored with a generated name to be revisited anytime. The Playground Manager also has options to export(Additional actions menu) and import(Import actions menu) WordPress Playground instances:
-->

Una vez que hagas clic en guardar, se almacenará una instancia con un nombre generado para ser revisitada en cualquier momento. El Administrador de Playground también tiene opciones para exportar (menú de acciones adicionales) e importar (menú de acciones de importación) instancias de WordPress Playground:

<!--
### Additional actions menu
-->

### Menú de acciones adicionales

![Additional actions Menu](@site/static/img/about/playground-manager-additional-actions.webp)

<!--
-   **Export Pull Request to GitHub**: This option allows you to export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Check [here](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) a demo of using this option.
-   **Download as .zip**: Creates a `.zip` file with the setup of the Playground instance, including any themes or plugins installed. This `.zip` won't include content and database changes.
-   **Report error**: If you have any issues with WordPress Playground, you can report them using the form available from this option. You can help resolve issues with Playground by sharing the error details with the development team behind Playground.
-   **View Blueprint**: This option will open the current blueprint used for the Playground instance in the [Blueprints Builder tool](https://playground.wordpress.net/builder/builder.html). From this tool, you'll be able to edit the blueprint online and run a new Playground instance with your edited version of the blueprint.
-->

-   **Exportar Pull Request a GitHub**: Esta opción te permite exportar plugins de WordPress, temas y directorios completos de wp-content como pull requests a cualquier repositorio público de GitHub. Mira [aquí](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) una demostración del uso de esta opción.
-   **Descargar como zip**: Crea un fichero `.zip` con la configuración de la instancia de Playground, incluidos los temas o plugins instalados. Este `.zip` no incluirá contenido ni cambios en la base de datos.
-   **Reportar error**: Si tienes algún problema con WordPress Playground, puedes reportarlo usando el formulario disponible desde esta opción. Puedes ayudar a resolver problemas con Playground compartiendo los detalles del error con el equipo de desarrollo detrás de Playground.
-   **Ver Blueprint**: Esta opción abrirá el blueprint actual utilizado para la instancia de Playground en la [herramienta Blueprints Builder](https://playground.wordpress.net/builder/builder.html). Desde esta herramienta podrás editar el blueprint en línea y ejecutar una nueva instancia de Playground con tu versión editada del blueprint.

<span id="edit-the-blueprint"></span>

[![snapshot of Builder mode of WordPress Playground](@site/static/img/about/blueprint-builder.webp)](https://playground.wordpress.net/builder/builder.html)

<!--
### Import actions menu
-->

### Menú de acciones de importación

![Import actions Menu](@site/static/img/about/playground-manager-import-actions.webp)

<!--
-   **Import from .zip**: Allows you to recreate a Playground instance using any `.zip` file generated with the "Download as .zip" option.
-   **Preview a Gutenberg PR**: Allows testers to run branches from the Gutenberg repository to test pull requests instantly.
-   **Import from GitHub**: This option allows you to import plugins, themes, and wp-content directories directly from your public GitHub repositories. To enable this feature, connect your GitHub account with WordPress Playground.
-->

-   **Importar desde zip**: Te permite recrear una instancia de Playground usando cualquier fichero `.zip` generado con la opción "Descargar como zip".
-   **Previsualizar un PR de Gutenberg**: Permite a los testers ejecutar ramas del repositorio de Gutenberg para probar pull requests instantáneamente.
-   **Importar desde GitHub**: Esta opción te permite importar plugins, temas y directorios de wp-content directamente desde tus repositorios públicos de GitHub. Para habilitar esta función, conecta tu cuenta de GitHub con WordPress Playground.

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
