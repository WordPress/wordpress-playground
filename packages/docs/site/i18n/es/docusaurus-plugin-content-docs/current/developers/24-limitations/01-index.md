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

## En el navegador {#in-the-browser}

<!--
## In the browser {#in-the-browser}
-->

### Temporal por diseño {#temporary-by-design}

<!--
### Temporary by design {#temporary-by-design}
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

<!--
:::tip
The dedicated refresh button inside Playground only reloads WordPress content—it preserves your PHP/WP state. The browser's refresh button (F5 or Cmd+R) destroys the entire instance.
:::
-->

![Botón Actualizar Playground](@site/static/img/refresh-playground-button.webp)

<!--
![Refresh Playground Button](@site/static/img/refresh-playground-button.webp)
-->

<blockquote>
<figure>
<figcaption><i>1. Exportar Playground:</i></figcaption>

<!--
<figcaption><i>1. Exporting Playground:</i></figcaption>
-->

![Save Button](@site/static/img/export-playground.webp)

</figure>

<figure>
<figcaption><i>2. Botón Save:</i></figcaption>

<!--
<figcaption><i>2. Save button:</i></figcaption>
-->

![Save Button](@site/static/img/saving-playground.webp)

</figure>
</blockquote>

### Compatibilidad con navegadores {#browser-support}

<!--
### Browser support {#browser-support}
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

### Expectativas de rendimiento {#performance-expectations}

<!--
### Performance expectations {#performance-expectations}
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

![Save Button](@site/static/img/playground-performance-graph.webp)

<!--
![Save Button](@site/static/img/playground-performance-graph.webp)
-->

**Factores que influyen en el rendimiento:**

<!--
**Factors that affect performance:**
-->

- **Tamaño del plugin**: los plugins grandes tardan más en instalarse en tiempo de ejecución
- **Velocidad de red**: los archivos WASM rondan los 5-15 MB por versión de PHP (reducidos de forma notable por la optimización de compilación `MAIN_MODULE=2`)
- **Memoria del dispositivo**: la asignación inicial de memoria WASM es de 64 MB y crece dinámicamente si hace falta. Los dispositivos con poca memoria pueden ir más lentos
- **Navegador**: Chrome y Edge suelen ir mejor; Safari, un poco más lento

<!--
- **Plugin size**: Large plugins take longer to install at runtime
- **Network speed**: WASM files are approximately 5-15MB per PHP version (reduced significantly by the MAIN_MODULE=2 build optimization)
- **Device memory**: Initial WASM memory allocation is 64MB, growing dynamically as needed. Low-memory devices may experience slowdowns
- **Browser**: Chrome/Edge perform best; Safari slightly slower
-->

<blockquote>
<strong>Nota:</strong> El soporte de Opera Mini no está confirmado por ahora.
</blockquote>

<!--
<blockquote>
<strong>Note:</strong> Opera Mini support is not currently confirmed.
</blockquote>
-->

## Al desarrollar con Playground {#when-developing-with-playground}

<!--
## When developing with Playground {#when-developing-with-playground}
-->

### Particularidades del iframe {#iframe-quirks}

<!--
### Iframe quirks {#iframe-quirks}
-->

Playground muestra WordPress en un [`iframe`](/developers/architecture/browser-iframe-rendering), así que al hacer clic en enlaces con `target="_top"` se recarga la página en la que trabajas.

<!--
Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on.
-->

Además, las ventanas emergentes de JavaScript que originan en el `iframe` no siempre se muestran.

<!--
Also, JavaScript popups originating in the `iframe` may not always display.
-->

### Ejecutar funciones PHP de WordPress {#run-wordpress-php-functions}

<!--
### Run WordPress PHP functions {#run-wordpress-php-functions}
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

### Uso de WP-CLI {#using-wp-cli}

<!--
### Using WP-CLI {#using-wp-cli}
-->

Puedes ejecutar comandos `wp-cli` mediante el [paso `wp-cli`](/blueprints/steps#WPCLIStep) de Blueprints. Como Playground se ejecuta en el navegador, no admite la [lista completa](https://developer.wordpress.org/cli/commands/) de comandos disponibles. No hay una lista cerrada de comandos soportados; probar [la demo en línea](https://playground.wordpress.net/demos/wp-cli.html) ayuda a ver qué es posible.

<!--
You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible.
-->

Si usas [Playground CLI](/developers/local-development/wp-playground-cli), el comando `php` ofrece WP-CLI completo ejecutando los scripts directamente contra el runtime PHP en WASM.

<!--
When using the [Playground CLI](/developers/local-development/wp-playground-cli), the `php` command provides full WP-CLI support by running scripts directly against the WASM PHP runtime.
-->

## Mejoras recientes {#recent-improvements}

<!--
## Recent improvements {#recent-improvements}
-->

Varias limitaciones anteriores se han abordado en versiones recientes:

<!--
Several previous limitations have been addressed in recent releases:
-->

- **Descargas de archivos grandes (>2 GB)**: Exportaciones y descargas ahora se transmiten en streaming en lugar de cargarse en memoria, lo que permite exportar sitios grandes (p. ej. copias de All-in-One WP Migration) que antes fallaban.
- **Subidas de archivos cURL en PHP**: Las subidas multipart con `CURLFile` ya funcionan bien en el navegador. Se han resuelto el bloqueo de `Expect: 100-continue` y los problemas de reenvío multipart del proxy CORS.
- **Respuestas PHP largas**: El service worker ahora transmite las respuestas PHP en lugar de almacenarlas en búfer, eliminando el tiempo de espera de 25 segundos que hacía fallar importaciones de sitios y otras operaciones largas.
- **Errores de descarga**: Si fallan las descargas de WASM o scripts (por red, bloqueadores de anuncios, etc.), Playground muestra un modal de error útil en lugar de una página en blanco.

<!--
- **Large file downloads (>2GB)**: File exports and downloads now stream directly instead of buffering in memory, enabling large site exports (e.g., All-in-One WP Migration backups) that previously failed.
- **PHP curl file uploads**: Multipart form uploads via `CURLFile` now work correctly in the browser. The `Expect: 100-continue` deadlock and CORS proxy multipart forwarding issues have been resolved.
- **Long-running PHP responses**: The service worker now streams PHP responses instead of buffering them, eliminating the 25-second timeout that previously caused site imports and other long-running operations to fail.
- **Download error handling**: When WASM or script downloads fail (due to network issues, ad blockers, etc.), Playground now displays a helpful error modal instead of a blank page.
-->
