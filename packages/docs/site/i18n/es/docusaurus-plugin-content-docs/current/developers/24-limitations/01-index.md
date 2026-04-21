---
slug: /developers/limitations
description: Conoce las limitaciones actuales de WordPress Playground, incluidos los comportamientos específicos del navegador, el almacenamiento temporal por diseño, las peculiaridades de los iframes y la compatibilidad con WP-CLI.
---

<!--
description: Learn about the current limitations of WordPress Playground, including browser-specific behaviors, temporary storage by design, iframe quirks, and WP-CLI support.
-->

# Limitaciones

<!--
# Limitations
-->

WordPress Playground está en desarrollo activo y tiene algunas limitaciones que conviene tener en cuenta al ejecutarlo y al desarrollar con él.

<!--
WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it.
-->

Puedes seguir el estado de estos temas en el [tablero del proyecto Playground](https://github.com/orgs/WordPress/projects/180).

<!--
You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180).
-->

## En el navegador

<!--
## In the browser
-->

### Temporal por diseño

<!--
### Temporary by design
-->

Playground crea instancias nuevas de WordPress en cada carga de página. Al actualizar la página del navegador se descartan todos los cambios en la base de datos, los archivos subidos y las demás modificaciones.

<!--
Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications.
-->

**Por qué ocurre**: Playground transmite WordPress directamente al navegador en lugar de servirlo desde un servidor tradicional. Cada actualización empieza desde cero.

<!--
**Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate.
-->

**Para conservar tu trabajo:**

<!--
**To persist your work:**
-->

- **Guardar**: activa el almacenamiento del navegador con el botón «Save» (arriba a la derecha, junto a la barra de direcciones) antes de actualizar la página con la barra del navegador.
- **Para desarrollo**: usa [Playground CLI](/developers/local-development/wp-playground-cli), que admite almacenamiento local persistente

<!--
- **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar.
- **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage
-->

:::tip
El botón de actualización integrado en Playground solo vuelve a cargar el contenido de WordPress: conserva el estado de PHP/WP. El botón de actualización del navegador (F5 o Cmd+R) destruye toda la instancia.
:::

![Refresh Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<blockquote>
<figure>
<figcaption><i>1. Exportar Playground:</i></figcaption>

<!--
<figcaption><i>1. Exporting Playground:</i></figcaption>
-->

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

</figure>

<figure>
<figcaption><i>2. Botón Save:</i></figcaption>

<!--
<figcaption><i>2. Save button:</i></figcaption>
-->

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

</figure>
</blockquote>

### Compatibilidad con navegadores

<!--
### Browser support
-->

WordPress Playground está pensado para funcionar en los principales navegadores de escritorio y móviles. Esto incluye:

<!--
WordPress Playground is designed to work across all major desktop and mobile browsers. This includes:
-->

- **Navegadores de escritorio**: Chrome, Firefox, Safari, Edge y otros basados en Chromium
- **Navegadores móviles**: Safari (iOS), Chrome (Android) y otras variantes

<!--
- **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers
- **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants
-->

Playground aprovecha tecnologías web modernas y debería comportarse de forma coherente en estos entornos. No obstante, algunas funciones avanzadas pueden tener distinto nivel de soporte según el navegador y su versión.

<!--
Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version.
-->

### Expectativas de rendimiento

<!--
### Performance expectations
-->

Los tiempos de carga dependen de lo que Playground necesite preparar:

<!--
Loading times vary based on what Playground needs to set up:
-->

| Escenario                                | Tiempo de carga típico             |
| ---------------------------------------- | ---------------------------------- |
| WordPress nuevo (sin plugins)            | 5-10 segundos                      |
| Con plugins pequeños                     | 10-20 segundos                     |
| Con plugins grandes (p. ej. WooCommerce) | 30-60 segundos                     |
| En dispositivos móviles                  | 1,5-2× más lento que en escritorio |

<!--
| Scenario                               | Typical Load Time          |
| -------------------------------------- | -------------------------- |
| Fresh WordPress (no plugins)           | 5-10 seconds               |
| With small plugins                     | 10-20 seconds              |
| With large plugins (e.g., WooCommerce) | 30-60 seconds              |
| On mobile devices                      | 1.5-2x slower than desktop |
-->

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

**Factores que influyen en el rendimiento:**

<!--
**Factors that affect performance:**
-->

- **Tamaño del plugin**: los plugins grandes tardan más en instalarse en tiempo de ejecución
- **Velocidad de red**: los archivos WASM rondan los 15-30 MB por versión de PHP
- **Memoria del dispositivo**: la asignación inicial de memoria WASM es de 64 MB y crece dinámicamente si hace falta. Los dispositivos con poca memoria pueden ir más lentos
- **Navegador**: Chrome y Edge suelen ir mejor; Safari, un poco más lento

<!--
- **Plugin size**: Large plugins take longer to install at runtime
- **Network speed**: WASM files are 15-30MB
- **Device memory**: Initial WASM memory allocation is 64MB, growing dynamically as needed. Low-memory devices may experience slowdowns
- **Browser**: Chrome/Edge perform best; Safari slightly slower
-->

<blockquote>
<strong>Nota:</strong> el soporte de Opera Mini no está confirmado por ahora.
</blockquote>

<!--
<blockquote>
<strong>Note:</strong> Opera Mini support is not currently confirmed.
</blockquote>
-->

## Al desarrollar con Playground

<!-- ### Iframe quirks -->

### Peculiaridades del iframe

<!--
### Iframe quirks
-->

Playground muestra WordPress en un [`iframe`](/developers/architecture/browser-iframe-rendering), así que al hacer clic en enlaces con `target="_top"` se recarga la página en la que trabajas.

<!--
Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on.
-->

Además, las ventanas emergentes de JavaScript que se originan en el `iframe` no siempre se muestran.

<!-- ### Run WordPress PHP functions -->

### Ejecutar funciones PHP de WordPress

<!--
### Run WordPress PHP functions
-->

Playground permite ejecutar código PHP en Blueprints con el [paso `runPHP`](/blueprints/steps#RunPHPStep). Para usar funciones PHP de WordPress, primero hay que cargar [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):

<!--
Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you'd need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):
-->

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

<!-- ### Using WP-CLI -->

### Usando WP-CLI

Puedes ejecutar comandos de `wp-cli` mediante el paso [`wp-cli`](/blueprints/steps#WPCLIStep) de Blueprints. Sin embargo, como Playground se ejecuta en el navegador, no admite la [lista completa](https://developer.wordpress.org/cli/commands/) de comandos disponibles. No existe una lista definitiva de comandos compatibles, así que experimentar en [la demo en línea](https://playground.wordpress.net/demos/wp-cli.html) te ayudará a evaluar qué es posible.

Al usar [Playground CLI](/developers/local-development/wp-playground-cli), el comando `php` ofrece compatibilidad total con WP-CLI al ejecutar scripts directamente sobre el runtime de PHP WASM.

## Mejoras recientes {#recent-improvements}

Varias limitaciones anteriores se han resuelto en versiones recientes:

- **Descargas de archivos grandes (>2 GB)**: las exportaciones y descargas ahora se transmiten en streaming en lugar de almacenarse en memoria, lo que permite exportar sitios grandes (por ejemplo, copias de All-in-One WP Migration) que antes fallaban.
- **Subidas de archivos cURL en PHP**: las subidas multipart con `CURLFile` ahora funcionan correctamente en el navegador. Se han resuelto el bloqueo de `Expect: 100-continue` y los problemas de reenvío multipart del proxy CORS.
- **Respuestas PHP de larga duración**: el service worker ahora transmite las respuestas PHP en lugar de almacenarlas en búfer, eliminando el tiempo de espera de 25 segundos que antes hacía fallar las importaciones de sitios y otras operaciones largas.
- **Gestión de errores de descarga**: cuando fallan las descargas de WASM o scripts (por problemas de red, bloqueadores de anuncios, etc.), Playground ahora muestra un modal de error útil en lugar de una página en blanco.

<!--
- **Large file downloads (>2GB)**: File exports and downloads now stream directly instead of buffering in memory, enabling large site exports (e.g., All-in-One WP Migration backups) that previously failed.
- **PHP curl file uploads**: Multipart form uploads via `CURLFile` now work correctly in the browser. The `Expect: 100-continue` deadlock and CORS proxy multipart forwarding issues have been resolved.
- **Long-running PHP responses**: The service worker now streams PHP responses instead of buffering them, eliminating the 25-second timeout that previously caused site imports and other long-running operations to fail.
- **Download error handling**: When WASM or script downloads fail (due to network issues, ad blockers, etc.), Playground now displays a helpful error modal instead of a blank page.
-->
