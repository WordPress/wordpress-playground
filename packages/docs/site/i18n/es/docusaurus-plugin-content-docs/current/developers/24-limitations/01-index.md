---
slug: /developers/limitations
description: Conoce las limitaciones actuales de WordPress Playground, incluidos los comportamientos específicos del navegador, las restricciones de persistencia y recuperación, las peculiaridades de iframe y la compatibilidad con WP-CLI.
---

<!-- # Limitations -->

# Limitaciones

<!-- WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it. -->

WordPress Playground está en desarrollo activo y tiene algunas limitaciones que debes tener en cuenta al ejecutarlo y desarrollar con él.

<!-- You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180). -->

Puedes seguir el estado de estos problemas en el [tablero del proyecto Playground](https://github.com/orgs/WordPress/projects/180).

<!-- ## In the browser -->

## En el navegador

<!-- ### Browser storage and recovery -->

### Almacenamiento y recuperación en el navegador

<!-- Playground runs WordPress in the browser. New Playgrounds are autosaved when -->
<!-- browser storage and saving are available, and they appear in **Your -->
<!-- Playgrounds**. Playground keeps up to five recent autosaves. After five exist, -->
<!-- creating another deletes the oldest one. Autosaves are recovery points, not -->
<!-- long-term backups. Store an autosave permanently or export a ZIP when you want -->
<!-- to keep it. -->

Playground ejecuta WordPress en el navegador. Los Playgrounds nuevos se guardan automáticamente cuando el almacenamiento y el guardado del navegador están disponibles, y aparecen en **Tus Playgrounds**. Playground conserva hasta cinco autoguardados recientes. Cuando ya existen cinco, crear otro elimina el más antiguo. Los autoguardados son puntos de recuperación, no copias de seguridad a largo plazo. Almacena un autoguardado permanentemente o exporta un ZIP cuando quieras conservarlo.

<!-- Use these storage modes deliberately: -->

Usa estos modos de almacenamiento de forma deliberada:

<!-- - **Autosaved**: stored in browser storage and retained only while it is one of up to five recent autosaves. -->
<!-- - **Saved**: stored permanently in browser storage or saved to a local directory. -->
<!-- - **Temporary**: created with `?storage=temp` or when saving is unavailable. It is discarded when the tab closes or the browser page refreshes. -->

- **Guardado automáticamente**: se almacena en el navegador y solo se conserva mientras sea uno de los cinco autoguardados recientes.
- **Guardado**: se almacena permanentemente en el navegador o se guarda en un directorio local.
- **Temporal**: se crea con `?storage=temp` o cuando el guardado no está disponible. Se descarta al cerrar la pestaña o actualizar la página del navegador.

<!-- The Playground **Refresh page** button reloads the WordPress page inside the current Playground. Browser refresh (Cmd+R or F5) reloads the whole Playground app. A stored or autosaved Playground can recover after that reload, but a temporary Playground cannot. -->

El botón **Actualizar página** de Playground vuelve a cargar la página de WordPress dentro del Playground actual. La actualización del navegador (Cmd+R o F5) vuelve a cargar toda la aplicación Playground. Un Playground almacenado o autoguardado puede recuperarse después, pero uno temporal no.

<!-- ![The Dock controls for refreshing WordPress, opening storage choices, and exporting the Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp) -->

![Los controles del Dock para actualizar WordPress, abrir las opciones de almacenamiento y exportar el Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp)

<!-- Browser storage still belongs to the browser. Storage pressure, private browsing, profile changes, or clearing site data can remove it. Export a ZIP when you need a portable backup. -->

El almacenamiento del navegador sigue perteneciendo al navegador. La presión de almacenamiento, la navegación privada, los cambios de perfil o el borrado de los datos del sitio pueden eliminarlo. Exporta un ZIP cuando necesites una copia de seguridad portátil.

<!-- ![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp) -->

![El panel Tus Playgrounds con el Playground actual](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!-- ### Browser support -->

### Compatibilidad con navegadores

<!-- WordPress Playground is designed to work across all major desktop and mobile browsers. This includes: -->

WordPress Playground está diseñado para funcionar en todos los principales navegadores de escritorio y móviles. Esto incluye:

<!-- - **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers -->
<!-- - **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants -->

- **Navegadores de escritorio**: Chrome, Firefox, Safari, Edge y otros navegadores basados en Chromium
- **Navegadores móviles**: Safari (iOS), Chrome (Android) y otras variantes de navegadores móviles

<!-- Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version. -->

Playground aprovecha las tecnologías web modernas y debería funcionar de manera consistente en estos entornos de navegador. Sin embargo, algunas funciones avanzadas pueden tener diferentes niveles de soporte dependiendo del navegador específico y su versión.

<!-- ### Performance expectations -->

### Expectativas de rendimiento

<!-- Loading times vary based on what Playground needs to set up: -->

Los tiempos de carga varían según lo que Playground necesita configurar:

<!-- ![Playground performance graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp) -->

![Gráfico de rendimiento de Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

<!-- **Factors that affect performance:** -->

**Factores que afectan el rendimiento:**

<!-- - **Plugin size**: Large plugins take longer to install at runtime -->
<!-- - **Network speed**: WASM files are 15-30MB -->
<!-- - **Device memory**: Low-memory devices may experience slowdowns -->
<!-- - **Browser**: Chrome/Edge perform best; Safari slightly slower -->

- **Tamaño del plugin**: Los plugins grandes tardan más en instalarse en tiempo de ejecución
- **Velocidad de red**: Los archivos WASM son de 15-30MB
- **Memoria del dispositivo**: Los dispositivos con poca memoria pueden experimentar ralentizaciones
- **Navegador**: Chrome/Edge tienen mejor rendimiento; Safari es ligeramente más lento

<!-- <blockquote> -->
<!-- <strong>Note:</strong> Opera Mini support is not currently confirmed. -->
<!-- </blockquote> -->

<blockquote>
<!-- <strong>Note:</strong> Opera Mini support is not currently confirmed. -->
<strong>Nota:</strong> El soporte para Opera Mini no está confirmado actualmente.
</blockquote>

<!-- ## When developing with Playground -->

## Al desarrollar con Playground

<!-- ### Iframe quirks -->

### Peculiaridades del iframe

<!-- Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on. -->

Playground renderiza WordPress en un [`iframe`](/developers/architecture/browser-iframe-rendering), por lo que hacer clic en enlaces con `target="_top"` recargará la página en la que estás trabajando.

<!-- Also, JavaScript popups originating in the `iframe` may not always display. -->

Además, los popups de JavaScript que se originan en el `iframe` pueden no mostrarse siempre.

<!-- ### Run WordPress PHP functions -->

### Ejecutar funciones PHP de WordPress

<!-- Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you'd need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php): -->

Playground soporta la ejecución de código PHP en Blueprints usando el [paso `runPHP`](/blueprints/steps#RunPHPStep). Para ejecutar funciones PHP específicas de WordPress, primero necesitas requerir [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

<!-- ### Using WP-CLI -->

### Usando WP-CLI

<!-- You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible. -->

Puedes ejecutar comandos `wp-cli` a través del paso [`wp-cli`](/blueprints/steps#WPCLIStep) de Blueprints. Sin embargo, como Playground se ejecuta en el navegador, no soporta la [lista completa](https://developer.wordpress.org/cli/commands/) de comandos disponibles. Aunque no existe una lista definitiva de comandos soportados, experimentar en [la demo en línea](https://playground.wordpress.net/demos/wp-cli.html) te ayudará a evaluar lo que es posible.
