---
title: Solucionar problemas y depurar
slug: /blueprints/troubleshoot-and-debug
description: Una guía fácil de buscar para errores comunes de Blueprint, incluidas fallas de carga, errores de validación, fallas de PHP y problemas de activación de plugins.
---

<!-- title: Troubleshoot and debug -->

<!-- description: A searchable guide to common Blueprint errors, including fetch failures, validation errors, PHP failures, and plugin activation issues. -->

<!-- # Troubleshoot and debug Blueprints -->

# Solucionar problemas y depurar Blueprints

<!-- Blueprint errors usually point to one of three places: -->

Los errores de Blueprint suelen apuntar a uno de estos tres lugares:

<!--
- The Blueprint JSON is invalid.
- Playground could not fetch the Blueprint or one of its resources.
- A Blueprint step ran, but WordPress, PHP, WP-CLI, or a plugin failed.
-->

- El JSON del Blueprint no es válido.
- Playground no pudo obtener el Blueprint o uno de sus recursos.
- Una etapa del Blueprint se ejecutó, pero falló WordPress, PHP, WP-CLI o un plugin.

<!--
Start with the exact error name shown by Playground, then use the matching
section below.
-->

Empieza con el nombre exacto del error que muestra Playground y usa la sección
correspondiente a continuación.

<!-- ## Quick checklist -->

## Lista de verificación rápida

<!--
- Paste the Blueprint into the [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to validate the JSON schema.
- If the Blueprint is loaded from a URL, open that URL directly in a private browser window and confirm it downloads valid JSON or a Blueprint ZIP bundle.
- If a step fails, note the step number in `BlueprintStepExecutionError`. The failed step is usually the item at that position after Blueprint shorthands have been expanded.
- Open browser developer tools and check the Console and Network tabs for download, CORS, PHP, or plugin activation details.
- For plugin/theme activation failures, check the Playground **Logs** panel or the browser console for PHP warnings and fatal errors.
-->

- Pega el Blueprint en el [editor de Blueprints](https://playground.wordpress.net/builder/builder.html) para validar el esquema JSON.
- Si el Blueprint se carga desde una URL, abre esa URL directamente en una ventana privada del navegador y confirma que descarga JSON válido o un paquete ZIP de Blueprint.
- Si falla una etapa, anota el número de etapa en `BlueprintStepExecutionError`. La etapa fallida suele ser el elemento en esa posición después de que se hayan expandido los atajos de Blueprint.
- Abre las herramientas de desarrollo del navegador y revisa las pestañas Console y Network para ver detalles de descarga, CORS, PHP o activación de plugins.
- Para fallas de activación de plugin/tema, revisa el panel **Logs** de Playground o la consola del navegador para ver advertencias y errores fatales de PHP.

<!-- ## InvalidBlueprintError -->

## InvalidBlueprintError

<!--
`InvalidBlueprintError` means the Blueprint does not match the
[Blueprint data format](/blueprints/data-format). The error output usually
contains paths such as `/steps/2/pluginData` or `/preferredVersions`.
-->

`InvalidBlueprintError` significa que el Blueprint no coincide con el
[formato de datos de Blueprint](/blueprints/data-format). La salida del error
suele contener rutas como `/steps/2/pluginData` o `/preferredVersions`.

<!-- ### Unexpected property `activate` -->

### Propiedad inesperada `activate`

<!--
`activate` belongs inside `options`, not directly on the step or inside
`pluginData`.
-->

`activate` debe estar dentro de `options`, no directamente en la etapa ni dentro
de `pluginData`.

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	},
	"options": {
		"activate": true
	}
}
```

<!-- ### Unexpected property `plugins` in `preferredVersions` -->

### Propiedad inesperada `plugins` en `preferredVersions`

<!--
`preferredVersions` only accepts `php` and `wp`. Install plugins with the
top-level `plugins` shorthand or with an explicit `installPlugin` step.
-->

`preferredVersions` solo acepta `php` y `wp`. Instala plugins con el atajo
`plugins` de nivel superior o con una etapa explícita `installPlugin`.

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"]
}
```

<!-- ### Missing `slug`, `url`, `path`, or `files` -->

### Falta `slug`, `url`, `path` o `files`

<!-- The resource object is incomplete or uses the wrong shape. Common fixes: -->

El objeto de recurso está incompleto o usa la forma incorrecta. Correcciones
comunes:

<!--
- WordPress.org plugin: `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`
- ZIP URL: `{ "resource": "url", "url": "https://example.com/plugin.zip" }`
- Git directory: `{ "resource": "git:directory", "url": "https://github.com/org/repo", "ref": "trunk", "refType": "branch" }`
-->

- Plugin de WordPress.org: `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`
- URL de ZIP: `{ "resource": "url", "url": "https://example.com/plugin.zip" }`
- Directorio Git: `{ "resource": "git:directory", "url": "https://github.com/org/repo", "ref": "trunk", "refType": "branch" }`

<!--
See [Resources References](/blueprints/steps/resources) for all supported
resource shapes.
-->

Consulta [Referencias de recursos](/blueprints/steps/resources) para ver todas
las formas de recurso compatibles.

<!-- ### Mixed plugin install properties -->

### Propiedades mixtas de instalación de plugin

<!--
Use `pluginData` for `installPlugin`. Do not provide both `pluginData` and
older examples or custom objects such as `pluginZipFile`.
-->

Usa `pluginData` para `installPlugin`. No proporciones `pluginData` junto con
ejemplos antiguos u objetos personalizados como `pluginZipFile`.

<!-- The WordPress.org plugin resource also needs a separate `slug`: -->

El recurso de plugin de WordPress.org también necesita un `slug` separado:

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	}
}
```

<!-- Do not write `"resource": "wordpress.org/plugins/woocommerce"`. -->

No escribas `"resource": "wordpress.org/plugins/woocommerce"`.

<!-- ## BlueprintFetchError -->

## BlueprintFetchError

<!--
`BlueprintFetchError` means Playground could not load the file passed to
`?blueprint-url=`.
-->

`BlueprintFetchError` significa que Playground no pudo cargar el archivo pasado
a `?blueprint-url=`.

<!-- Check that the URL: -->

Comprueba que la URL:

<!--
- Is public and does not require cookies, login, a temporary session, or a VPN.
- Returns HTTP 200 when opened directly.
- Serves valid JSON or a ZIP bundle with `blueprint.json` inside it.
- Sends `Access-Control-Allow-Origin: *` or another header that allows
  `https://playground.wordpress.net`.
- Uses a raw file URL, not a repository HTML page.
-->

- Sea pública y no requiera cookies, inicio de sesión, una sesión temporal o una VPN.
- Devuelva HTTP 200 al abrirse directamente.
- Sirva JSON válido o un paquete ZIP con `blueprint.json` dentro.
- Envíe `Access-Control-Allow-Origin: *` u otro encabezado que permita
  `https://playground.wordpress.net`.
- Use una URL de archivo sin procesar, no una página HTML de repositorio.

<!--
For GitHub, use `raw.githubusercontent.com` URLs instead of `github.com/.../blob/...`.
For GitLab, use the raw file URL instead of a `/-/blob/` page.
-->

Para GitHub, usa URL de `raw.githubusercontent.com` en lugar de `github.com/.../blob/...`.
Para GitLab, usa la URL del archivo sin procesar en lugar de una página `/-/blob/`.

```text
# Good
https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/welcome/blueprint.json

# Not a raw JSON response
https://github.com/WordPress/blueprints/blob/trunk/blueprints/welcome/blueprint.json
```

<!--
Temporary tunnel URLs, local development URLs, and draft release assets often
fail because the browser cannot reach them or because they do not allow
cross-origin requests. Move the Blueprint to a public host with CORS enabled.
-->

Las URL temporales de túnel, las URL de desarrollo local y los assets de release
en borrador suelen fallar porque el navegador no puede acceder a ellos o porque
no permiten solicitudes de origen cruzado. Mueve el Blueprint a un alojamiento
público con CORS activado.

<!-- ### Blueprint file is neither a valid JSON nor a ZIP file -->

### El archivo de Blueprint no es JSON válido ni un archivo ZIP

<!--
This means Playground received a response, but the response was not a Blueprint.
The URL may have returned an HTML page, 404 page, repository file viewer, proxy
warning, login page, or corrupted ZIP.
-->

Esto significa que Playground recibió una respuesta, pero la respuesta no era
un Blueprint. La URL puede haber devuelto una página HTML, una página 404, un
visor de archivo de repositorio, una advertencia de proxy, una página de inicio
de sesión o un ZIP corrupto.

<!-- Open the URL directly and check that: -->

Abre la URL directamente y comprueba que:

<!--
- JSON URLs return valid Blueprint JSON.
- ZIP bundle URLs download a real ZIP archive.
- Blueprint bundles contain `blueprint.json` at the root of the ZIP.
- The response is not a small HTML or text error page.
-->

- Las URL JSON devuelvan JSON de Blueprint válido.
- Las URL de paquete ZIP descarguen un archivo ZIP real.
- Los paquetes de Blueprint contengan `blueprint.json` en la raíz del ZIP.
- La respuesta no sea una pequeña página HTML o de texto de error.

<!-- ### URIError: URI malformed -->

### URIError: URI malformed

<!--
`URIError: URI malformed` usually points to a broken encoded Blueprint fragment
in the URL, not to a failed Blueprint step. Check for invalid `%` escapes,
double-encoded fragments, or raw JSON pasted after `#`. Rebuild the link from
the original Blueprint and encode it once, or use Base64. See
[Encoded Blueprint fragments](/blueprints/using-blueprints).
-->

`URIError: URI malformed` suele indicar un fragmento de Blueprint codificado
incorrectamente en la URL, no una etapa de Blueprint fallida. Revisa escapes
`%` inválidos, fragmentos codificados dos veces o JSON sin procesar pegado
después de `#`. Reconstruye el enlace desde el Blueprint original y codifícalo
una vez, o usa Base64. Consulta
[Fragmentos de Blueprint codificados](/blueprints/using-blueprints).

<!-- ## ResourceDownloadError -->

## ResourceDownloadError

<!--
`ResourceDownloadError` means the Blueprint loaded, but a step could not download
a resource such as a plugin ZIP, theme ZIP, WXR file, or imported site archive.
-->

`ResourceDownloadError` significa que el Blueprint cargó, pero una etapa no
pudo descargar un recurso como un ZIP de plugin, ZIP de tema, archivo WXR o
archivo de sitio importado.

<!-- Confirm the resource URL: -->

Confirma que la URL del recurso:

<!--
- Downloads the actual file, not an HTML page, redirect warning, or expired artifact.
- Is public and does not require authentication.
- Allows cross-origin requests.
- Is the direct file URL. Some release pages and CI artifact pages are human pages, not direct downloads.
- Still exists. Temporary links and CI artifacts can expire.
-->

- Descarga el archivo real, no una página HTML, advertencia de redirección o artifact expirado.
- Es pública y no requiere autenticación.
- Permite solicitudes de origen cruzado.
- Es la URL directa del archivo. Algunas páginas de release y páginas de artifacts de CI son páginas para personas, no descargas directas.
- Todavía existe. Los enlaces temporales y los artifacts de CI pueden expirar.

<!--
For source code in a Git repository, prefer a
[`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference).
Use a `url` resource for built ZIP artifacts that are already publicly
downloadable.
-->

Para código fuente en un repositorio Git, prefiere un
[recurso `git:directory`](/blueprints/steps/resources#gitdirectoryreference).
Usa un recurso `url` para artifacts ZIP ya creados que estén disponibles
públicamente para descarga.

<!-- ## BlueprintStepExecutionError -->

## BlueprintStepExecutionError

<!--
`BlueprintStepExecutionError` means a specific step failed after the Blueprint
started running. The message includes a step number:
-->

`BlueprintStepExecutionError` significa que una etapa específica falló después
de que el Blueprint empezó a ejecutarse. El mensaje incluye un número de etapa:

```text
BlueprintStepExecutionError: Error when executing the blueprint step #4
```

<!--
Use that number to inspect the matching step. If your Blueprint uses shorthands
such as `plugins`, `login`, `siteOptions`, or `constants`, Playground expands
them into steps before running the Blueprint. Use explicit `steps` when the
order matters.
-->

Usa ese número para inspeccionar la etapa correspondiente. Si tu Blueprint usa
atajos como `plugins`, `login`, `siteOptions` o `constants`, Playground los
expande en etapas antes de ejecutar el Blueprint. Usa `steps` explícitas cuando
el orden importe.

<!--
URL query parameters such as `?plugin=...`, `?theme=...`, `?php=...`,
`?wp=...`, and `?networking=yes` also create an implicit Blueprint. Errors from
those URLs are still Blueprint execution errors, and the generated steps affect
the reported step number.
-->

Los parámetros de consulta de URL como `?plugin=...`, `?theme=...`, `?php=...`,
`?wp=...` y `?networking=yes` también crean un Blueprint implícito. Los errores
de esas URL siguen siendo errores de ejecución de Blueprint, y las etapas
generadas afectan al número de etapa informado.

<!-- ## PHP.run() failed with exit code 255 -->

## PHP.run() failed with exit code 255

<!--
Exit code `255` usually means PHP hit a fatal error. Look for the first
`Fatal error`, `Uncaught`, or `TypeError` line in the output. The large HTML
error page around it is usually WordPress's generic critical error screen.
-->

El código de salida `255` suele significar que PHP encontró un error fatal.
Busca la primera línea `Fatal error`, `Uncaught` o `TypeError` en la salida. La
gran página HTML de error que la rodea suele ser la pantalla genérica de error
crítico de WordPress.

<!--
To make the output more useful while debugging, enable WordPress debug constants
near the beginning of the Blueprint:
-->

Para hacer que la salida sea más útil durante la depuración, activa las
constantes de depuración de WordPress cerca del inicio del Blueprint:

```json
{
	"step": "defineWpConfigConsts",
	"consts": {
		"WP_DEBUG": true,
		"WP_DEBUG_LOG": true,
		"WP_DEBUG_DISPLAY": true,
		"WP_DISABLE_FATAL_ERROR_HANDLER": true
	}
}
```

<!--
Then rerun the Blueprint and check the Playground **Logs** panel or browser
console.
-->

Después vuelve a ejecutar el Blueprint y revisa el panel **Logs** de Playground
o la consola del navegador.

<!-- ## PHP.run() failed with exit code 1 -->

## PHP.run() failed with exit code 1

<!--
Exit code `1` often appears when WP-CLI or WordPress returns an application
error. Read the `Stderr` section first. It usually names the unsupported
argument, missing resource, or command-specific failure.
-->

El código de salida `1` aparece a menudo cuando WP-CLI o WordPress devuelve un
error de aplicación. Lee primero la sección `Stderr`. Normalmente indica el
argumento no compatible, el recurso faltante o la falla específica del comando.

<!--
Some WP-CLI commands behave differently in Playground because WordPress runs in
WebAssembly with SQLite. Keep commands small and test them individually before
adding a long chain to a Blueprint.
-->

Algunos comandos WP-CLI se comportan de forma diferente en Playground porque
WordPress se ejecuta en WebAssembly con SQLite. Mantén los comandos pequeños y
pruébalos individualmente antes de añadir una cadena larga a un Blueprint.

<!-- ## Undefined constant `ABSPATH` -->

## Undefined constant `ABSPATH`

<!--
This usually happens in a `runPHP` step that calls WordPress APIs without first
loading WordPress.
-->

Esto suele ocurrir en una etapa `runPHP` que llama a API de WordPress sin
cargar primero WordPress.

<!-- Add `wp-load.php` before any WordPress function, constant, option, or plugin API: -->

Añade `wp-load.php` antes de cualquier función, constante, opción o API de
plugin de WordPress:

```json
{
	"step": "runPHP",
	"code": "<?php require '/wordpress/wp-load.php'; update_option('blogname', 'Demo site');"
}
```

<!-- ## Plugin could not be activated -->

## Plugin could not be activated

<!--
Plugin activation errors usually come from the plugin itself, not from the
Blueprint runner. Common causes:
-->

Los errores de activación de plugins suelen venir del propio plugin, no del
ejecutor de Blueprints. Causas comunes:

<!--
- The plugin requires a newer PHP version or WordPress version.
- The plugin has a fatal error on activation.
- The plugin depends on another plugin that is not installed or activated.
- The plugin performs a redirect or prints unexpected output during activation.
- The plugin ZIP extracts to a folder or main file name different from the path the step is activating.
-->

- El plugin requiere una versión más reciente de PHP o WordPress.
- El plugin tiene un error fatal durante la activación.
- El plugin depende de otro plugin que no está instalado o activado.
- El plugin realiza una redirección o imprime una salida inesperada durante la activación.
- El ZIP del plugin se extrae a una carpeta o archivo principal con un nombre distinto de la ruta que la etapa está activando.

<!--
If the error says the current PHP or WordPress version does not meet minimum
requirements, set `preferredVersions`:
-->

Si el error dice que la versión actual de PHP o WordPress no cumple los
requisitos mínimos, define `preferredVersions`:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	}
}
```

<!-- ### WordPress exited with exit code 0 -->

### WordPress exited with exit code 0

<!--
Activation can fail even when WordPress exits with code `0`. This usually means
WordPress returned an activation error response rather than a PHP process crash.
When the message says `Inspect the "debug" logs`, check the Playground **Logs**
panel, browser console, or CLI output.
-->

La activación puede fallar aunque WordPress salga con código `0`. Esto suele
significar que WordPress devolvió una respuesta de error de activación en lugar
de una caída del proceso PHP. Cuando el mensaje diga `Inspect the "debug" logs`,
revisa el panel **Logs** de Playground, la consola del navegador o la salida de
la CLI.

<!--
Look for PHP warnings, redirects or output printed during activation, missing
dependency plugins, or plugin minimum PHP/WordPress requirements.
-->

Busca advertencias de PHP, redirecciones o salida impresa durante la activación,
plugins de dependencia ausentes o requisitos mínimos de PHP/WordPress del plugin.

<!-- ### Current PHP or WordPress version does not meet minimum requirements -->

### Current PHP or WordPress version does not meet minimum requirements

<!-- Version mismatch errors often include text like: -->

Los errores de incompatibilidad de versión suelen incluir texto como:

```text
Current PHP version (7.4.33) does not meet minimum requirements. The plugin requires PHP 8.0.
```

<!-- or: -->

o:

```text
Current WordPress version (6.9.4) does not meet minimum requirements. The plugin requires WordPress 7.0.
```

<!--
Set `preferredVersions` to a compatible PHP and WordPress version, or use a
plugin/theme release that supports the versions available in Playground.
-->

Define `preferredVersions` con una versión compatible de PHP y WordPress, o usa
una release del plugin/tema que sea compatible con las versiones disponibles en
Playground.

<!-- If the error is: -->

Si el error es:

```text
Failed to download WordPress 6.9.0 (HTTP 404)
```

<!--
the requested WordPress build is not available. Use `latest`, a supported
released version, or a supported beta/nightly value.
-->

la compilación de WordPress solicitada no está disponible. Usa `latest`, una
versión publicada compatible o un valor beta/nightly compatible.

<!--
If the error says `Plugin file does not exist`, inspect the installed folder
name. For ZIP URLs with unusual folder names, set `targetFolderName`:
-->

Si el error dice `Plugin file does not exist`, inspecciona el nombre de la
carpeta instalada. Para URL ZIP con nombres de carpeta inusuales, define
`targetFolderName`:

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "url",
		"url": "https://example.com/my-plugin.zip"
	},
	"options": {
		"activate": true,
		"targetFolderName": "my-plugin"
	}
}
```

<!--
If the plugin has dependencies, install and activate those dependencies first
with explicit steps.
-->

Si el plugin tiene dependencias, instala y activa esas dependencias primero con
etapas explícitas.

<!-- ## Theme could not be activated -->

## Theme could not be activated

<!--
Theme activation failures usually mean the theme folder name is wrong, the
theme ZIP extracted to an unexpected directory, or the theme code caused a
WordPress/PHP error.
-->

Las fallas de activación de temas suelen significar que el nombre de la carpeta
del tema es incorrecto, que el ZIP del tema se extrajo a un directorio
inesperado o que el código del tema causó un error de WordPress/PHP.

<!-- Use `installTheme` with `options.activate` when installing a theme: -->

Usa `installTheme` con `options.activate` al instalar un tema:

```json
{
	"step": "installTheme",
	"themeData": {
		"resource": "wordpress.org/themes",
		"slug": "twentytwentyfour"
	},
	"options": {
		"activate": true
	}
}
```

<!--
If you use a standalone `activateTheme` step, pass the folder name inside
`wp-content/themes`, not a full URL or ZIP filename.
-->

Si usas una etapa independiente `activateTheme`, pasa el nombre de la carpeta
dentro de `wp-content/themes`, no una URL completa ni el nombre del archivo ZIP.

<!-- ## Could not write to a file -->

## Could not write to a file

<!-- Errors like this mean the parent directory does not exist: -->

Errores como este significan que el directorio padre no existe:

```text
Could not write to "/wordpress/wp-content/plugins/example/index.php":
There is no such file or directory OR the parent directory does not exist.
```

<!--
Create the directory first with `mkdir`, or use `writeFiles` with a
`literal:directory` resource.
-->

Crea primero el directorio con `mkdir` o usa `writeFiles` con un recurso
`literal:directory`.

```json
[
	{
		"step": "mkdir",
		"path": "/wordpress/wp-content/plugins/example"
	},
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/plugins/example/index.php",
		"data": "<?php /* Plugin Name: Example */"
	}
]
```

<!-- ## Could not unzip file -->

## Could not unzip file

<!--
This usually means the file is not a valid ZIP archive. The URL may have
returned an HTML page, an error response, a login page, or a truncated file.
-->

Esto suele significar que el archivo no es un archivo ZIP válido. La URL puede
haber devuelto una página HTML, una respuesta de error, una página de inicio de
sesión o un archivo truncado.

<!--
If the output says `Could not unzip file. Error code: 19`, verify the download
is a ZIP archive. A small file size often means the server returned an HTML
error page instead of the archive.
-->

Si la salida dice `Could not unzip file. Error code: 19`, verifica que la
descarga sea un archivo ZIP. Un tamaño de archivo pequeño a menudo significa que
el servidor devolvió una página HTML de error en lugar del archivo.

<!--
Open the URL directly and confirm the browser downloads a ZIP. If you are using
a GitHub or CI artifact, use a direct-download URL and make sure the release or
artifact is public.
-->

Abre la URL directamente y confirma que el navegador descarga un ZIP. Si estás
usando un artifact de GitHub o de CI, usa una URL de descarga directa y asegúrate
de que la release o el artifact sea público.

<!-- ## WP-CLI command pitfalls -->

## Problemas comunes con comandos WP-CLI

<!--
The `wp-cli` step runs WP-CLI inside Playground. It is useful for setup tasks,
but not every command or shell feature behaves like a local terminal.
-->

La etapa `wp-cli` ejecuta WP-CLI dentro de Playground. Es útil para tareas de
configuración, pero no todos los comandos o características del shell se
comportan como en una terminal local.

<!-- Common fixes: -->

Correcciones comunes:

<!--
- Use the step name `"wp-cli"`, not `"wpcli"` or `"cli"`.
- Keep commands focused. Prefer multiple `wp-cli` steps over one complex shell command.
- Avoid shell substitutions such as `$(...)` in shared Blueprints. Use `runPHP` for logic that needs WordPress APIs.
- Check parameter names against the WP-CLI command you are using. For example, command-specific parameters may differ between `wp post list`, `wp post delete`, and plugin-provided commands.
- If a plugin-provided WP-CLI command fails with a plugin stack trace, the fix usually belongs in that plugin or in the input data passed to the command.
- If a command fails with `unknown --post_type parameter` or `unknown --format parameter`, check whether the flags belong to a different command in the pipeline.
- If a plugin command fails with `Unsupported argument type passed to WP_CLI::error_to_string(): 'NULL'`, confirm the plugin is active, the imported data exists, and the command input points to a valid resource.
-->

- Usa el nombre de etapa `"wp-cli"`, no `"wpcli"` ni `"cli"`.
- Mantén los comandos enfocados. Prefiere varias etapas `wp-cli` en lugar de un comando de shell complejo.
- Evita sustituciones de shell como `$(...)` en Blueprints compartidos. Usa `runPHP` para lógica que necesite API de WordPress.
- Revisa los nombres de parámetros contra el comando WP-CLI que estás usando. Por ejemplo, los parámetros específicos de cada comando pueden diferir entre `wp post list`, `wp post delete` y comandos proporcionados por plugins.
- Si un comando WP-CLI proporcionado por un plugin falla con un stack trace del plugin, la corrección suele estar en ese plugin o en los datos de entrada pasados al comando.
- Si un comando falla con `unknown --post_type parameter` o `unknown --format parameter`, revisa si las flags pertenecen a otro comando en el pipeline.
- Si un comando de plugin falla con `Unsupported argument type passed to WP_CLI::error_to_string(): 'NULL'`, confirma que el plugin esté activo, que los datos importados existan y que la entrada del comando apunte a un recurso válido.

<!-- ## WP-CLI: Error establishing a database connection on mounted sites -->

## WP-CLI: Error establishing a database connection en sitios montados {#wp-cli-error-establishing-a-database-connection-on-mounted-sites}

<!--
When using `wp-cli` with a mounted Playground site, for example via
`--mount-before-install`, you might encounter an "Error establishing a database
connection." This happens because WordPress Playground loads the SQLite database
integration plugin from its internal files by default, not from the mounted
directory.
-->

Al usar `wp-cli` con un sitio Playground montado, por ejemplo mediante
`--mount-before-install`, podrías encontrar "Error establishing a database
connection." Esto ocurre porque WordPress Playground carga el plugin de
integración de base de datos SQLite desde sus archivos internos por defecto, no
desde el directorio montado.

<!-- Add the SQLite integration plugin to the mounted WordPress site explicitly: -->

Añade explícitamente el plugin de integración SQLite al sitio WordPress montado:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

<!-- Then run the Blueprint with the mounted site: -->

Después ejecuta el Blueprint con el sitio montado:

```bash
mkdir wordpress
npx @wp-playground/cli server --mount-before-install=wordpress:/wordpress --blueprint=./blueprint.json
```

<!-- ## Debugging tools -->

## Herramientas de depuración

<!-- ### Blueprints editor -->

### Editor de Blueprints

<!--
Use the in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html)
to build, validate, and preview Blueprints.
-->

Usa el [editor de Blueprints](https://playground.wordpress.net/builder/builder.html)
en el navegador para crear, validar y previsualizar Blueprints.

<!-- :::danger Caution -->

:::danger Precaución

<!--
The editor is under development and the embedded Playground sometimes fails to
load. To get around it, refresh the page.
-->

El editor está en desarrollo y el Playground incrustado a veces falla al
cargar. Para evitarlo, actualiza la página.

:::

<!-- ### Filesystem and database inspection -->

### Inspección del sistema de archivos y la base de datos

<!--
Some Blueprint steps, such as [`writeFile`](/blueprints/steps),
alter the internal filesystem. Others, such as
[`runSql`](/blueprints/steps), alter the database.
-->

Algunas etapas de Blueprint, como [`writeFile`](/blueprints/steps), modifican
el sistema de archivos interno. Otras, como [`runSql`](/blueprints/steps),
modifican la base de datos.

<!--
To inspect the final state, install plugins such as
[`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and
[`WPide`](https://wordpress.org/plugins/wpide/). You can see them in action at
https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide.
-->

Para inspeccionar el estado final, instala plugins como
[`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) y
[`WPide`](https://wordpress.org/plugins/wpide/). Puedes verlos en acción en
https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide.

<!--
You can also inspect a Playground instance from the browser console through
`window.playground`:
-->

También puedes inspeccionar una instancia de Playground desde la consola del
navegador mediante `window.playground`:

```js
await playground.isDir('/wordpress/wp-content/plugins');
await playground.listFiles('/wordpress/wp-content/plugins');
```

<!-- See the full [PlaygroundClient API](/api/client/interface/PlaygroundClient). -->

Consulta la [API PlaygroundClient](/api/client/interface/PlaygroundClient) completa.

<!-- ### Browser console and network requests -->

### Consola del navegador y solicitudes de red

<!--
Open browser developer tools to check JavaScript errors, PHP debug logs, and
failed network requests. In Chrome, Firefox, and Edge, press
`Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.
-->

Abre las herramientas de desarrollo del navegador para revisar errores de
JavaScript, logs de depuración de PHP y solicitudes de red fallidas. En Chrome,
Firefox y Edge, presiona `Ctrl + Shift + I` en Windows/Linux o
`Cmd + Option + I` en macOS.

<!-- :::caution Safari -->

:::caution Safari

<!--
If you have not enabled the Develop menu, go to **Safari > Settings... >
Advanced** and check **Show features for web developers**.
-->

Si no has activado el menú Develop, ve a **Safari > Settings... > Advanced** y
marca **Show features for web developers**.

:::

<!-- ### Custom error logging -->

### Registro de errores personalizado

<!--
You can write your own messages with `error_log()` in a
[`runPHP` step](/blueprints/steps), then check the Playground
**Logs** panel or the browser console.
-->

Puedes escribir tus propios mensajes con `error_log()` en una etapa
[`runPHP`](/blueprints/steps) y luego revisar el panel **Logs** de Playground o
la consola del navegador.

<!-- ![Log errors snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp) -->

![Captura de errores de log](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)

<!--
:::info
When you download your Playground instance as a ZIP through the
["Download as zip"](/web-instance) option, the archive
also includes `debug.log`.
:::
-->

:::info
Cuando descargas tu instancia de Playground como ZIP mediante la opción
["Download as zip"](/web-instance), el archivo también incluye `debug.log`.
:::

<!-- ## Ask for help -->

## Pedir ayuda

<!--
If you need help, [open an issue](https://github.com/WordPress/wordpress-playground/issues)
and include:
-->

Si necesitas ayuda, [abre un issue](https://github.com/WordPress/wordpress-playground/issues)
e incluye:

<!--
- The Blueprint JSON or the public Blueprint URL.
- The exact error message.
- The failing step number, if shown.
- Browser, operating system, and whether you used the website, JavaScript API, or CLI.
- Relevant console, network, or CLI output.
-->

- El JSON del Blueprint o la URL pública del Blueprint.
- El mensaje de error exacto.
- El número de etapa fallida, si se muestra.
- Navegador, sistema operativo y si usaste el sitio web, la API JavaScript o la CLI.
- Salida relevante de consola, red o CLI.
