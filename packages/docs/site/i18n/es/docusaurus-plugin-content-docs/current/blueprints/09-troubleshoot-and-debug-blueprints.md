---
title: Solucionar problemas y depurar
slug: /blueprints/troubleshoot-and-debug
description: Una guía con consejos y herramientas para ayudarte a solucionar problemas y depurar tus Blueprints, desde problemas comunes hasta herramientas del navegador.
---

<!--
title: Troubleshoot and debug
description: A guide with tips and tools to help you troubleshoot and debug your Blueprints, from common issues to browser tools.
-->

<!--
# Troubleshoot and debug Blueprints
-->

# Solucionar problemas y depurar Blueprints

<!--
When you build Blueprints, you might run into issues. Here are tips and tools to help you debug them:
-->

Cuando creas Blueprints, puedes encontrarte con problemas. Aquí tienes consejos y herramientas para ayudarte a depurarlos:

<!--
## Review Common gotchas
-->

## Revisa problemas comunes

<!--
- Require `wp-load`: to run a WordPress PHP function using the `runPHP` step, you’d need to require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). So, the value of the `code` key should start with `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`.
-->

- Requiere `wp-load`: para ejecutar una función PHP de WordPress usando el paso `runPHP`, tendrás que requerir [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). Por eso, el valor de la clave `code` debe empezar con `"<?php require_once('wordpress/wp-load.php'); RESTO_DE_TU_CÓDIGO"`.

<!--
## Common Issues and Solutions
-->

## Problemas comunes y soluciones

<!--
### Invalid Blueprint After Opening a Link
-->

### Blueprint no válido después de abrir un enlace

<!--
If Playground reports `Invalid blueprint`, read the detailed error message. It includes the underlying JSON parsing error when one is available.
-->

Si Playground informa `Invalid blueprint`, lee el mensaje de error detallado. Incluye el error de análisis JSON subyacente cuando está disponible.

<!--
If the message says the input still contains `%XX` escapes after decoding, the URL fragment was likely double-encoded. Rebuild the link from the original Blueprint object and encode it once with `encodeURIComponent(JSON.stringify(blueprint))`, or use Base64. Do not encode a fragment that is already encoded.
-->

Si el mensaje dice que la entrada todavía contiene secuencias de escape `%XX` después de decodificarla, es probable que el fragmento de URL se haya codificado dos veces. Reconstruye el enlace a partir del objeto Blueprint original y codifícalo una sola vez con `encodeURIComponent(JSON.stringify(blueprint))`, o usa Base64. No codifiques un fragmento que ya esté codificado.

<!--
### WP-CLI: Error Establishing a Database Connection on Mounted Sites
-->

### WP-CLI: error al establecer una conexión con la base de datos en sitios montados {#wp-cli-error-establishing-a-database-connection-on-mounted-sites}

<!--
When using `wp-cli` with a mounted Playground site (e.g., via `--mount-before-install`), you might encounter an "Error establishing a database connection." This happens because WordPress Playground loads the SQLite database integration plugin from its internal files by default, not from the mounted directory, meaning it's not persisted for external `wp-cli` calls.
-->

Al usar `wp-cli` con un sitio Playground montado (por ejemplo, mediante `--mount-before-install`), puedes encontrar un mensaje de "Error establishing a database connection". Esto ocurre porque WordPress Playground carga por defecto el plugin de integración de base de datos SQLite desde sus archivos internos, no desde el directorio montado, lo que significa que no se conserva para llamadas externas de `wp-cli`.

<!--
To resolve this, you need to explicitly install and configure the SQLite database integration plugin within your Blueprint.
-->

Para resolverlo, debes instalar y configurar explícitamente el plugin de integración de base de datos SQLite dentro de tu Blueprint.

<!--
**Solution:** Add the following steps to your Blueprint:
-->

**Solución:** añade los siguientes pasos a tu Blueprint:

```json
{
	"plugins": ["sqlite-database-integration"]
}
```

<!--
**Example Usage:**
-->

**Ejemplo de uso:**

<!--
To test this locally, combine the Blueprint with your Playground CLI command:
-->

Para probarlo localmente, combina el Blueprint con tu comando de Playground CLI:

```bash
mkdir wordpress
# Ensure your blueprint with the above steps is saved as, for example, './blueprint.json'
npx @wp-playground/cli server --mount-before-install=wordpress:/wordpress --blueprint=./blueprint.json
cd wordpress
wp post list
```

<!--
This will ensure the SQLite plugin is installed correctly and configured within your mounted WordPress site, allowing `wp-cli` commands to function correctly.
-->

Esto garantiza que el plugin SQLite se instale correctamente y se configure dentro de tu sitio WordPress montado, lo que permite que los comandos `wp-cli` funcionen correctamente.

<!--
## Blueprints Builder
-->

## Constructor de Blueprints

<!--
You can use an in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to build, validate, and preview your Blueprints in the browser.
-->

Puedes usar un [editor de Blueprints](https://playground.wordpress.net/builder/builder.html) en el navegador para crear, validar y previsualizar tus Blueprints.

:::danger Precaución

<!--
The editor is under development and the embedded Playground sometimes fails to load. To get around it, refresh the page. We're aware of that, and are working to improve the experience.
-->

El editor está en desarrollo y el Playground incrustado a veces no carga. Para solucionarlo, actualiza la página. Somos conscientes de ello y estamos trabajando para mejorar la experiencia.

:::

<!--
## Check for the Filesystem and Database
-->

## Revisa el sistema de archivos y la base de datos

<!--
Some blueprint steps (such as [`writeFile`](/blueprints/steps#WriteFileStep)) alter the internal Filesystem structure of the Playground instance and some others (such as [`runSql`](/blueprints/steps#runSql)) alter the internal WordPress database.
-->

Algunos pasos de Blueprint (como [`writeFile`](/blueprints/steps#WriteFileStep)) modifican la estructura interna del sistema de archivos de la instancia de Playground, y otros (como [`runSql`](/blueprints/steps#runSql)) modifican la base de datos interna de WordPress.

<!--
To check the final internal filesystem structure and database (after the blueprint steps have been applied) we can leverage some WordPress plugins that provide a SQL manager and a file explorer such as [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and [`WPide`](https://wordpress.org/plugins/wpide/) (you can see them in action from https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide)
-->

Para revisar la estructura final del sistema de archivos interno y la base de datos (después de aplicar los pasos del Blueprint), podemos usar algunos plugins de WordPress que proporcionan un gestor SQL y un explorador de archivos, como [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) y [`WPide`](https://wordpress.org/plugins/wpide/) (puedes verlos en acción desde https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide).

:::tip

<!--
There are a bunch of methods we can launch from the console of any WordPress Playground instance to inspect the internals of that instance. They're exposed as part of `window.playground` object (see [Developers > JavaScript API > Debugging and testing](/developers/apis/javascript-api/#debugging-and-testing)). Some examples:
-->

Hay varios métodos que podemos ejecutar desde la consola de cualquier instancia de WordPress Playground para inspeccionar sus partes internas. Están expuestos como parte del objeto `window.playground` (consulta [Desarrolladores > API de JavaScript > Depuración y pruebas](/developers/apis/javascript-api/#debugging-and-testing)). Algunos ejemplos:

```
> await playground.isDir("/wordpress/wp-content/plugins")
true
> await playground.listFiles("/wordpress/wp-content/plugins")
(3) ['hello.php', 'index.php', 'WordPress-Importer-master']
```

<!--
Full list of methods we can use is available [here](/api/client/interface/PlaygroundClient)
-->

La lista completa de métodos que podemos usar está disponible [aquí](/api/client/interface/PlaygroundClient).

:::

<!--
## Check for errors in the browser console
-->

## Revisa errores en la consola del navegador

<!--
If your Blueprint isn’t running as expected, open the browser developer tools to check for any errors.
-->

Si tu Blueprint no se está ejecutando como esperas, abre las herramientas de desarrollo del navegador para comprobar si hay errores.

<!--
To open the developer tools in Chrome, Firefox, Safari\*, and Edge: press `Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.
-->

Para abrir las herramientas de desarrollo en Chrome, Firefox, Safari\* y Edge: pulsa `Ctrl + Shift + I` en Windows/Linux o `Cmd + Option + I` en macOS.

:::caution

<!--
If you haven't yet, enable the Develop menu: go to **Safari > Settings... > Advanced** and check **Show features for web developers**.
-->

Si aún no lo has hecho, activa el menú Desarrollo: ve a **Safari > Configuración... > Avanzado** y marca **Mostrar funciones para desarrolladores web**.

:::

<!--
The developer tools window allows you to inspect network requests, view console logs, debug JavaScript, and examine the DOM and CSS styles applied to your webpage. This is crucial for diagnosing and fixing issues with Blueprints.
-->

La ventana de herramientas de desarrollo te permite inspeccionar solicitudes de red, ver registros de consola, depurar JavaScript y examinar el DOM y los estilos CSS aplicados a tu página. Esto es clave para diagnosticar y corregir problemas con Blueprints.

<!--
## Log your own error messages
-->

## Registra tus propios mensajes de error

<!--
You can `error_log` your own error messages through [`runPHP` step](/blueprints/steps#RunPHPStep) (see [blueprint example](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) and check them from the ["View Logs" option](/web-instance#playground-options-menu) or from the browser's console.
-->

Puedes registrar tus propios mensajes de error con `error_log` mediante el [paso `runPHP`](/blueprints/steps#RunPHPStep) (consulta el [ejemplo de Blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) y la [demo en vivo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) y revisarlos desde la opción ["View Logs"](/web-instance#playground-options-menu) o desde la consola del navegador.

<!--
![Log errors snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)
-->

![Captura de errores de registro](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)

:::info

<!--
When you download your Playground instance as a `zip` through the ["Download as zip" option](/web-instance#playground-options-menu) you'll also download the `debug.log` file containing all the logs from your Playground instance.
-->

Cuando descargas tu instancia de Playground como un `zip` mediante la opción ["Download as zip"](/web-instance#playground-options-menu), también descargas el archivo `debug.log`, que contiene todos los registros de tu instancia de Playground.

:::

<!--
## Ask for help
-->

## Pide ayuda

<!--
The community is here to help! If you have questions or comments, [open a new issue](https://github.com/adamziel/blueprints/issues) in this repository. Remember to include the following details:
-->

La comunidad está aquí para ayudar. Si tienes preguntas o comentarios, [abre un nuevo issue](https://github.com/adamziel/blueprints/issues) en este repositorio. Recuerda incluir los siguientes detalles:

<!--
- The Blueprint you’re trying to run.
- The error message you’re seeing, if any.
- The full output from the browser developer tools.
- Any other relevant information that might help us understand the issue: OS, browser version, etc.
-->

- El Blueprint que intentas ejecutar.
- El mensaje de error que ves, si lo hay.
- La salida completa de las herramientas de desarrollo del navegador.
- Cualquier otra información relevante que pueda ayudarnos a entender el problema: sistema operativo, versión del navegador, etc.
