---
slug: /developers/limitations
<!-- description: Learn about the current limitations of WordPress Playground, including browser-specific behaviors, temporary storage by design, iframe quirks, and WP-CLI support. -->
description: Conoce las limitaciones actuales de WordPress Playground, incluyendo comportamientos específicos del navegador, almacenamiento temporal por diseño, peculiaridades de iframe y soporte de WP-CLI.
---

<!-- # Limitations -->

# Limitaciones

<!-- WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it. -->

WordPress Playground está en desarrollo activo y tiene algunas limitaciones que debes tener en cuenta al ejecutarlo y desarrollar con él.

<!-- You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180). -->

Puedes seguir el estado de estos problemas en el [tablero del proyecto Playground](https://github.com/orgs/WordPress/projects/180).

<!-- ## In the browser -->

## En el navegador

<!-- ### Temporary by design -->

### Temporal por diseño

<!-- Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications. -->

Playground crea instancias frescas de WordPress en cada carga de página. Actualizar la página del navegador descarta todos los cambios en la base de datos, archivos subidos y modificaciones.

<!-- **Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate. -->

**Por qué sucede esto**: Playground transmite WordPress directamente a tu navegador en lugar de servirlo desde un servidor tradicional. Cada actualización comienza desde cero.

<!-- **To persist your work:** -->

**Para conservar tu trabajo:**

<!-- - **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar. -->
<!-- - **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage -->

- **Guardar**: Activa el almacenamiento del navegador mediante el botón "Guardar" (arriba a la derecha, junto a la barra de direcciones), antes de actualizar la página a través de la barra del navegador.
- **Para desarrollo**: Usa [Playground CLI](/developers/local-development/wp-playground-cli) que soporta almacenamiento local persistente

<!-- :::tip -->
<!-- The dedicated refresh button inside Playground only reloads WordPress content—it preserves your PHP/WP state. The browser's refresh button (F5 or Cmd+R) destroys the entire instance. -->
<!-- ::: -->

:::tip
El botón de actualización dedicado dentro de Playground solo recarga el contenido de WordPress—preserva tu estado de PHP/WP. El botón de actualización del navegador (F5 o Cmd+R) destruye la instancia completa.
:::

![Refresh Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<blockquote>
<figure>
<!-- <figcaption><i>1. Exporting Playground:</i></figcaption> -->
<figcaption><i>1. Exportando Playground:</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

</figure>

<figure>
<!-- <figcaption><i>2. Save button:</i></figcaption> -->
<figcaption><i>2. Botón Guardar:</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

</figure>
</blockquote>

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

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

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
