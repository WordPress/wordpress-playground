---
sidebar_position: 5
slug: /developers/apis/query-api
description: Esta página detalla la Query API de WordPress Playground, que permite configurar una instancia de WP mediante parámetros de URL.
---

<!--
# Query API
-->

# API de consulta (Query API)

<!--
WordPress Playground exposes a simple API that you can use to configure the Playground in the browser.
-->

WordPress Playground expone una API sencilla que puedes usar para configurar la instancia de Playground en el navegador.

<!--
It works by passing configuration options as query parameters to the Playground URL. For example, to install the pendant theme, you would use the following URL:
-->

Funciona pasando opciones de configuración como parámetros de consulta en la URL de Playground. Por ejemplo, para instalar el tema pendant, usarías la siguiente URL:

```text
https://playground.wordpress.net/?theme=pendant
```

<!--
You can go ahead and try it out. The Playground will automatically install the theme and log you in as an admin. You may even embed this URL in your website using an `<iframe>` tag:
-->

Puedes probarlo ahora mismo. Playground instalará automáticamente el tema e iniciará sesión como administrador. También puedes incrustar esta URL en tu sitio con una etiqueta `<iframe>`:

```html
<iframe src="https://playground.wordpress.net/?theme=pendant"></iframe>
```

<!--
## Available options
-->

## Opciones disponibles

| Opción             | Valor predeterminado  | Descripción                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`              | `8.5`                 | Carga la versión de PHP indicada. Acepta `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` o `latest`.                                                                                                                                                                                                                                                                                                                                                 |
| `wp`               | `latest`              | Carga la versión de WordPress indicada. Acepta las tres últimas versiones principales. A partir del 1 de junio de 2024, son `6.3`, `6.4` o `6.5`. También puedes usar los valores genéricos `latest`, `nightly` o `beta`.                                                                                                                                                                                                                            |
| `blueprint-url`    |                       | URL del Blueprint que se usará para configurar esta instancia de Playground.                                                                                                                                                                                                                                                                                                                                                                         |
| `networking`       | `yes`                 | Activa o desactiva la compatibilidad de red en Playground. Acepta `yes` o `no`.                                                                                                                                                                                                                                                                                                                                                                      |
| `plugin`           |                       | Instala el plugin indicado. Usa el nombre del plugin según la URL del directorio de plugins de WordPress. Por ejemplo, si la URL es `https://wordpress.org/plugins/wp-lazy-loading/`, el nombre sería `wp-lazy-loading`. Puedes preinstalar varios plugins con `plugin=coblocks&plugin=wp-lazy-loading&…`. Instalar un plugin inicia sesión automáticamente como admin. Puedes instalar más de un plugin repitiendo el parámetro `plugin` en la URL. |
| `theme`            |                       | Instala el tema indicado. Usa el nombre del tema según la URL del directorio de temas. Por ejemplo, si la URL es `https://wordpress.org/themes/disco/`, el nombre sería `disco`. Instalar un tema inicia sesión automáticamente como admin. Puedes instalar varios temas repitiendo el parámetro `theme` en la URL.                                                                                                                                  |
| `url`              | `/wp-admin/`          | Carga la página inicial de WordPress indicada en esta instancia de Playground.                                                                                                                                                                                                                                                                                                                                                                       |
| `mode`             | `browser-full-screen` | Determina cómo se muestra la instancia de WordPress: envuelta en una interfaz de navegador o a ancho completo para una experiencia continua. Acepta `browser-full-screen` o `seamless`.                                                                                                                                                                                                                                                              |
| `lazy`             |                       | Diferir la carga de los recursos de Playground hasta que alguien pulse el botón "Ejecutar". No acepta valores. Si se añade `lazy` como parámetro de URL, la carga se diferirá.                                                                                                                                                                                                                                                                       |
| `login`            | `yes`                 | Inicia sesión como administrador. Acepta `yes` o `no`.                                                                                                                                                                                                                                                                                                                                                                                               |
| `multisite`        | `no`                  | Activa el modo multisitio de WordPress. Acepta `yes` o `no`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `import-site`      |                       | Importa archivos del sitio y la base de datos desde un ZIP indicado por URL.                                                                                                                                                                                                                                                                                                                                                                         |
| `import-wxr`       |                       | Importa el contenido del sitio desde un archivo WXR indicado por URL. Usa el plugin WordPress Importer; el usuario admin de WordPress debe tener sesión iniciada.                                                                                                                                                                                                                                                                                    |
| `site-slug`        |                       | Selecciona qué sitio cargar desde el almacenamiento del navegador. Si el sitio no existe, se pedirá guardar uno nuevo con el slug indicado.                                                                                                                                                                                                                                                                                                          |
| `language`         | `en_US`               | Establece el idioma de la instancia de WordPress. Debe usarse junto con `networking=yes`; de lo contrario WordPress no podrá descargar traducciones.                                                                                                                                                                                                                                                                                                 |
| `core-pr`          |                       | Instala un PR concreto del core en https://github.com/WordPress/wordpress-develop. Acepta el número del PR. Por ejemplo, `core-pr=6883`.                                                                                                                                                                                                                                                                                                             |
| `gutenberg-pr`     |                       | Instala un PR concreto de Gutenberg en https://github.com/WordPress/gutenberg. Acepta el número del PR. Por ejemplo, `gutenberg-pr=65337`.                                                                                                                                                                                                                                                                                                           |
| `gutenberg-branch` |                       | Instala una rama concreta de https://github.com/WordPress/gutenberg. Acepta el nombre de la rama. Por ejemplo, `gutenberg-branch=trunk`.                                                                                                                                                                                                                                                                                                             |
| `page-title`       |                       | Personaliza el título de la pestaña del navegador. Útil para identificar distintas instancias de Playground al trabajar con varias pestañas. El parámetro se conserva al navegar entre sitios.                                                                                                                                                                                                                                                       |
| `can-save`         |                       | Por defecto se permite guardar Playgrounds en el ordenador o el navegador del usuario. Para desactivar la posibilidad de guardar, añade `?can-save=no` y las opciones de guardar desaparecerán de la interfaz.                                                                                                                                                                                                                                       |
| `mcp`              | `no`                  | Inicia el puente del servidor MCP (Model Context Protocol), permitiendo que clientes MCP externos conecten y controlen la instancia de Playground. Acepta `yes` o `no`.                                                                                                                                                                                                                                                                              |
| `mcp-port`         | `7999`                | Define el puerto WebSocket de puente MCP para comunicarse con el servidor MCP. Debe usarse junto con `mcp=yes`. Por ejemplo, `mcp=yes&mcp-port=8080`.                                                                                                                                                                                                                                                                                                |
| `overlay`          |                       | Abre una superposición de interfaz al cargar la página. Actualmente admite `blueprints` para abrir la Galería de Blueprints directamente. Por ejemplo, `?overlay=blueprints`. El parámetro se elimina de la URL al cerrar la superposición.                                                                                                                                                                                                          |

<!--
For example, the following code embeds a Playground with a preinstalled Gutenberg plugin and opens the post editor:
-->

Por ejemplo, el siguiente código incrusta un Playground con el plugin Gutenberg preinstalado y abre el editor de entradas:

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```

:::info Política CORS

<!--
To import files from a URL, such as a site zip package, they must be served with `Access-Control-Allow-Origin` header set. For reference, see: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).
-->

Para importar archivos desde una URL, como un paquete zip del sitio, deben servirse con el encabezado `Access-Control-Allow-Origin` configurado. Consulta: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).

:::

<!--
## GitHub Export Options
-->

## Opciones de exportación a GitHub

<!--
The following additional query parameters may be used to pre-configure the GitHub export form:
-->

Los siguientes parámetros de consulta adicionales pueden usarse para preconfigurar el formulario de exportación a GitHub:

- `gh-ensure-auth`: Si se establece en `yes`, Playground mostrará un modal para asegurar que el usuario esté autenticado en GitHub antes de continuar.
- `ghexport-repo-url`: URL del repositorio de GitHub de destino.
- `ghexport-pr-action`: Acción al exportar (crear o actualizar).
- `ghexport-playground-root`: Directorio raíz en Playground desde el que exportar.
- `ghexport-repo-root`: Directorio raíz en el repositorio a destino.
- `ghexport-content-type`: Tipo de contenido de la exportación (plugin, theme, wp-content, custom-paths).
- `ghexport-plugin`: Ruta del plugin. Cuando el tipo es `plugin`, preselecciona el plugin a exportar.
- `ghexport-theme`: Nombre del directorio del tema. Cuando el tipo es `theme`, preselecciona el tema a exportar.
- `ghexport-path`: Ruta relativa a `ghexport-playground-root`. Puede repetirse varias veces. Cuando el tipo es `custom-paths`, rellena la lista de rutas a exportar.
- `ghexport-commit-message`: Mensaje de commit al exportar.
- `ghexport-allow-include-zip`: Si se ofrece la opción de incluir un zip en la exportación a GitHub (`yes`, `no`). Opcional. Por defecto `yes`.
