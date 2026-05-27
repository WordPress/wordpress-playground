---
title: Solución de problemas
slug: /troubleshooting
description: Diagnostica errores comunes del sitio de WordPress Playground, incluidas fallas de arranque, problemas de SQLite, almacenamiento del navegador y recuperación de Playgrounds guardados.
---

<!-- title: Troubleshooting -->

<!-- description: Diagnose common WordPress Playground website errors, including boot failures, SQLite issues, browser storage, and saved Playground recovery. -->

<!-- # Troubleshooting WordPress Playground -->

# Solución de problemas de WordPress Playground

<!--
This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).
-->

Esta página cubre errores del propio sitio de Playground, Playgrounds guardados,
almacenamiento del navegador y arranque de WordPress. Para errores específicos
de Blueprint, consulta
[Solucionar problemas y depurar Blueprints](/blueprints/troubleshoot-and-debug).

<!-- ## Playground looks broken -->

## Playground parece roto

<!-- Try these first: -->

Prueba esto primero:

<!--
- Use the reload button inside the Playground toolbar instead of refreshing the browser tab. Browser refresh starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a fresh unsaved Playground.
-->

- Usa el botón de recarga dentro de la barra de herramientas de Playground en lugar de actualizar la pestaña del navegador. La actualización del navegador inicia toda la aplicación de Playground de nuevo.
- Abre la misma URL en una ventana privada para descartar el estado de un sitio guardado o del almacenamiento del navegador.
- Desactiva extensiones del navegador que bloqueen JavaScript, WebAssembly, almacenamiento, workers o solicitudes de red.
- Revisa las herramientas de desarrollo del navegador para ver errores en Console y Network.
- Si la URL incluye `?site-slug=...`, prueba a quitar ese parámetro de consulta para iniciar un Playground nuevo sin guardar.

<!-- ## A clean site says the MySQL extension is missing -->

## Un sitio limpio dice que falta la extensión MySQL

<!-- You may see a WordPress error page like this: -->

Puedes ver una página de error de WordPress como esta:

```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```

<!--
In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.
-->

En Playground, esto suele significar que WordPress no cargó la integración
SQLite que permite ejecutar WordPress sin MySQL. Playground ejecuta WordPress en
WebAssembly y usa SQLite en lugar de un servidor MySQL.

<!-- Try these steps: -->

Prueba estos pasos:

<!--
- Start a fresh unsaved Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new temporary site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).
-->

- Inicia un Playground nuevo sin guardar en https://playground.wordpress.net/ para confirmar que el sitio público puede arrancar.
- Si la URL incluye un sitio guardado, elimina `?site-slug=...` y carga un sitio temporal nuevo.
- Si esto ocurrió después de importar un ZIP, confirma que la importación no incluyó un `wp-content/db.php` personalizado que sobrescriba la configuración SQLite de Playground.
- Si esto ocurrió en la CLI, no uses `--skip-sqlite-setup` a menos que proporciones tu propia integración de base de datos.
- Si esto ocurrió con un Blueprint, consulta la [página de solución de problemas de Blueprint](/blueprints/troubleshoot-and-debug).

<!--
If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:
-->

Si estás escribiendo un Blueprint y necesitas añadir el plugin de integración
SQLite, `plugins` va en el nivel superior:

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

<!-- ## Error connecting to the SQLite database -->

## Error connecting to the SQLite database

<!--
This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.
-->

Esto significa que Playground cargó la integración SQLite, pero WordPress aún
no pudo conectarse a la base de datos.

<!-- Common causes: -->

Causas comunes:

<!--
- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.
-->

- El almacenamiento del navegador de un Playground guardado está obsoleto o incompleto.
- Un ZIP de sitio importado contiene un archivo de base de datos o drop-in de base de datos incompatible.
- A un directorio local montado le faltan archivos que WordPress necesita.
- El almacenamiento del navegador fue borrado, desalojado o bloqueado.

<!-- Recommended recovery: -->

Recuperación recomendada:

<!--
1. Start a fresh unsaved Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export any accessible files from the broken saved site using the File Browser or local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.
-->

1. Inicia un Playground nuevo sin guardar y sin `site-slug`.
2. Si el sitio nuevo funciona, el problema está ligado al sitio guardado o al archivo importado.
3. Exporta cualquier archivo accesible desde el sitio guardado roto usando el Navegador de archivos o una copia del directorio local, si está disponible.
4. Vuelve a importar el sitio en un nuevo Playground o reconstruyelo desde su Blueprint.

<!-- ## NotAllowedError -->

## NotAllowedError

<!--
`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.
-->

`NotAllowedError` suele significar que el navegador bloqueó una operación que
requiere permiso del usuario o un contexto de navegador compatible. En
Playground, esto a menudo está relacionado con sitios guardados o acceso a
directorios locales.

<!-- You may see this exact message: -->

Puedes ver este mensaje exacto:

```text
The request is not allowed by the user agent or the platform in the current context.
```

<!-- Try: -->

Prueba:

<!--
- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from the Playground **Saved Playgrounds** panel.
- If the site was saved to a local directory, import or save the directory again.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.
-->

- Abrir Playground en una pestaña normal de nivel superior del navegador, no dentro de un iframe restringido.
- Volver a abrir el sitio desde el panel **Saved Playgrounds** de Playground.
- Si el sitio se guardó en un directorio local, importar o guardar el directorio de nuevo.
- Confirmar que el navegador admite la API de archivos o almacenamiento que se está usando. Chrome y Edge suelen tener el soporte más amplio para directorios locales.
- Revisar si el modo de navegación privada, una política empresarial o la configuración del navegador bloquean el acceso al almacenamiento.

<!-- ## NoModificationAllowedError -->

## NoModificationAllowedError

<!--
`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.
-->

`NoModificationAllowedError` significa que el navegador o el sistema de archivos
rechazó una escritura. Esto puede ocurrir cuando un directorio local guardado se
volvió de solo lectura, se perdió el permiso o el almacenamiento del navegador
no está disponible.

<!-- You may see this exact message: -->

Puedes ver este mensaje exacto:

```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```

<!-- Try: -->

Prueba:

<!--
- Save a copy to a different local directory.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh unsaved Playground if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.
-->

- Guardar una copia en otro directorio local.
- Comprobar que la carpeta de destino aún exista y sea escribible.
- Evitar carpetas protegidas del sistema o carpetas sincronizadas que bloqueen archivos temporalmente.
- Iniciar un Playground nuevo sin guardar si solo necesitas un sitio de prueba temporal.
- Usar [Playground CLI](/developers/local-development/wp-playground-cli) para desarrollo local que necesite persistencia fiable del sistema de archivos.

<!-- ## Saved Playground cannot reload -->

## Un Playground guardado no puede recargarse

<!--
Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.
-->

Los Playgrounds guardados se almacenan en el almacenamiento del navegador o en
un directorio local que seleccionaste. No están alojados en un servidor remoto.

<!-- If a saved Playground cannot reload: -->

Si un Playground guardado no puede recargarse:

<!--
- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh unsaved site.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.
-->

- Confirma que estás usando el mismo navegador y perfil de navegador donde se guardó.
- Revisa si los datos del navegador se borraron o si el almacenamiento se desactivó.
- Si el sitio se guardó en un directorio local, confirma que el directorio todavía existe y no se ha movido.
- Si la URL incluye `?site-slug=...`, quítalo para iniciar un sitio nuevo sin guardar.
- Recrea el sitio guardado desde su Blueprint original o ZIP de importación si se perdió el almacenamiento.

<!-- ## Browser storage and persistence -->

## Almacenamiento del navegador y persistencia

<!--
An unsaved Playground is temporary. A browser refresh, tab close, storage
cleanup, or browser profile change can remove its state.
-->

Un Playground sin guardar es temporal. Una actualización del navegador, cerrar
la pestaña, limpiar el almacenamiento o cambiar de perfil del navegador puede
eliminar su estado.

<!--
Use the **Save** button before doing meaningful work. For longer-running local
development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli),
which persists site files on disk.
-->

Usa el botón **Save** antes de hacer trabajo importante. Para desarrollo local
de mayor duración, prefiere [Playground CLI](/developers/local-development/wp-playground-cli),
que persiste los archivos del sitio en disco.

<!--
:::tip
The refresh button inside the Playground toolbar reloads WordPress while keeping
the current Playground runtime. The browser refresh button reloads the full app
and can discard unsaved changes.
:::
-->

:::tip
El botón de recarga dentro de la barra de herramientas de Playground recarga
WordPress mientras mantiene el runtime actual de Playground. El botón de
actualizar del navegador recarga toda la aplicación y puede descartar cambios
no guardados.
:::

<!-- ## When to start fresh -->

## Cuándo empezar de nuevo

<!-- Start a fresh unsaved Playground when: -->

Inicia un Playground nuevo sin guardar cuando:

<!--
- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.
-->

- Solo necesitas probar si el sitio público de Playground funciona.
- La URL apunta a un `site-slug` guardado que ya no carga.
- Estás depurando si un error proviene del propio Playground o de un plugin, tema, Blueprint o sitio importado.
- Se sospecha que el almacenamiento del navegador o el acceso al directorio local está roto.

<!-- Use this URL for a clean site: -->

Usa esta URL para un sitio limpio:

```text
https://playground.wordpress.net/
```

<!-- ## Report a Playground issue -->

## Informar de un problema de Playground

<!--
If the problem reproduces on a fresh unsaved Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:
-->

Si el problema se reproduce en un Playground nuevo sin guardar,
[abre un issue](https://github.com/WordPress/wordpress-playground/issues) e
incluye:

<!--
- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
-->

- La URL completa de Playground.
- El navegador y el sistema operativo.
- Si usaste un sitio guardado, ZIP importado, Blueprint, directorio local o CLI.
- El nombre y el mensaje exactos del error.
- Detalles de Console y Network de las herramientas de desarrollo del navegador.
