---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

<!--
# Playground CLI
-->

# Playground CLI

<!--
[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment.
-->

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) es una herramienta de línea de comandos que simplifica el flujo de desarrollo y pruebas de WordPress.
Playground CLI soporta el montaje automático de un directorio con un plugin, tema o instalación de WordPress. Pero si necesitas flexibilidad, el CLI soporta comandos de montaje para personalizar tu entorno local.

<!--
**Key features:**
-->

**Características principales:**

<!--
- **Quick Setup**: Set up a local WordPress environment in seconds.
- **Flexibility**: Allows for configuration to adapt to different scenarios.
- **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it.
-->

- **Configuración rápida**: Configura un entorno WordPress local en segundos.
- **Flexibilidad**: Permite la configuración para adaptarse a diferentes escenarios.
- **Entorno simple**: Sin configuración extra, solo una versión compatible de Node y estás listo para usarlo.

<!--
The Playground CLI includes two main commands for running WordPress locally:

- **`start`** (Simplified): Auto-detects your project type, persists sites between sessions, and opens a browser automatically.
- **`server`** (Advanced): Provides full manual control over configuration. Best for custom setups, CI/CD pipelines, or when you need fine-grained control.
-->

El Playground CLI incluye dos comandos principales para ejecutar WordPress localmente:

- **`start`** (Simplificado): Detecta automáticamente el tipo de tu proyecto, persiste los sitios entre sesiones y abre el navegador automáticamente.
- **`server`** (Avanzado): Ofrece control manual completo sobre la configuración. Ideal para configuraciones personalizadas, pipelines CI/CD o cuando necesitas control detallado.

<!--
## Requirements
-->

## Requisitos

<!--
The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).
-->

El Playground CLI requiere Node.js 20.18 o superior, que es la versión recomendada de Soporte a Largo Plazo (LTS). Puedes descargarlo desde el [sitio web de Node.js](https://nodejs.org/en/download).

<!--
## Quickstart
-->

## Inicio rápido

<!--
To run the Playground CLI, open a command line and use one of the following commands:
-->

Para ejecutar el Playground CLI, abre una línea de comandos y usa uno de los siguientes comandos:

<!--
### Using `start` (Simplified)
-->

### Usar `start` (Simplificado)

<!--
The `start` command is the easiest way to get started. It automatically detects your project type, persists your site, and opens the browser:
-->

El comando `start` es la forma más fácil de empezar. Detecta automáticamente el tipo de tu proyecto, persiste tu sitio y abre el navegador:

```bash
npx @wp-playground/cli@latest start
```

<!--
When run inside a plugin or theme directory, `start` automatically mounts your project:
-->

Cuando se ejecuta dentro de un directorio de plugin o tema, `start` monta tu proyecto automáticamente:

```bash
cd my-plugin
npx @wp-playground/cli@latest start
```

<!--
**Key differences from `server`:**

- Auto-login is enabled by default
- Opens browser automatically
- Auto-mounts the project by default
-->

**Diferencias principales respecto a `server`:**

- El auto-login está habilitado por defecto
- Abre el navegador automáticamente
- Monta el proyecto automáticamente por defecto

<!--
### Using `server` (Advanced)
-->

### Usar `server` (Avanzado)

<!--
The `server` command provides full control over configuration:
-->

El comando `server` ofrece control total sobre la configuración:

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI en acción](@site/static/img/developers/npx-wp-playground-server.gif)

<!--
**Automatic site persistence:** By default, the `start` command keeps your WordPress site persistent across sessions. Your files and database are stored in `~/.wordpress-playground/sites/<path-hash>/`, where `<path-hash>` is derived from your project directory. This means you can stop and restart the CLI without losing your work.
-->

**Persistencia automática del sitio:** Por defecto, el comando `start` mantiene tu sitio WordPress persistente entre sesiones. Tus archivos y base de datos se almacenan en `~/.wordpress-playground/sites/<path-hash>/`, donde `<path-hash>` se deriva del directorio de tu proyecto. Así puedes detener y reiniciar el CLI sin perder tu trabajo.

<!--
This is useful when:

- You want a clean WordPress installation
- Testing fresh installation scenarios
- Your site data became corrupted or inconsistent
-->

Es útil cuando:

- Quieres una instalación limpia de WordPress
- Estás probando escenarios de instalación nueva
- Los datos de tu sitio se han corrompido o son inconsistentes

<!--
:::info
The `--reset` flag works only with `start`. For `server`, manually delete the persisted site directory at `~/.wordpress-playground/sites/<path-hash>/`.
:::
-->

:::info
La opción `--reset` solo funciona con `start`. Para `server`, elimina manualmente el directorio del sitio persistido en `~/.wordpress-playground/sites/<path-hash>/`.
:::

<!--
### Choosing a WordPress and PHP Version
-->

### Elegir una versión de WordPress y PHP

<!--
By default, the CLI loads the latest stable version of WordPress and PHP 8.3 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:
-->

Por defecto, el CLI carga la última versión estable de WordPress y PHP 8.3 por su mejor rendimiento. Para especificar tus versiones preferidas, puedes usar las opciones `--wp=<version>` y `--php=<version>`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.3
```

<!--
### Loading Blueprints
-->

### Cargar Blueprints

<!--
One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). For those unfamiliar with this technology, it allows developers to configure the initial state for their WordPress Playground instances.
-->

Una forma de llevar tu experiencia de desarrollo con Playground CLI al siguiente nivel es integrar con [Blueprints](/blueprints/getting-started/). Para quienes no conozcan esta tecnología, permite a los desarrolladores configurar el estado inicial de sus instancias de WordPress Playground.

<!--
Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We'll use the example below to do this.
-->

Con la opción `--blueprint=<blueprint-address>`, los desarrolladores pueden ejecutar un Playground con un estado inicial personalizado. Usaremos el ejemplo siguiente.

**(my-blueprint.json)**

```bash
{
  "landingPage": "/wp-admin/options-general.php?page=akismet-key-config",
  "login": true,
  "plugins": [
    "hello-dolly",
    "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
  ]
}
```

<!--
CLI command loading a blueprint:
-->

Comando CLI que carga un blueprint:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

<!--
### Mounting folders manually
-->

### Montar carpetas manualmente

<!--
Some projects have a specific structure that requires a custom configuration; for example, your repository contains all the files in the `/wp-content/` folder. So in this scenario, you can specify to the Playground CLI that it will mount your project from that folder using the `--mount` flag.
-->

Algunos proyectos tienen una estructura específica que requiere configuración personalizada; por ejemplo, tu repositorio contiene todos los archivos en la carpeta `/wp-content/`. En ese caso, puedes indicar al Playground CLI que montará tu proyecto desde esa carpeta usando la opción `--mount`.

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

<!--
### Mounting before WordPress installation
-->

### Montar antes de la instalación de WordPress

<!--
Consider mounting your WordPress project files before the WordPress installation begins. This approach is beneficial if you want to override the Playground boot process, as it can help connect Playground with `WP-CLI`. The `--mount-before-install` flag supports this process.
-->

Considera montar los archivos de tu proyecto WordPress antes de que comience la instalación. Este enfoque es útil si quieres sobrescribir el proceso de arranque del Playground, ya que puede ayudar a conectar Playground con `WP-CLI`. La opción `--mount-before-install` permite este proceso.

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

<!--
:::info
On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format: `"/host/path"` `"/vfs/path"`.
:::
-->

:::info
En Windows, el formato de ruta `/host/path:/vfs/path` puede causar problemas. Para resolverlo, usa las opciones `--mount-dir` y `--mount-dir-before-install`. Estas opciones permiten especificar las rutas del host y del sistema de archivos virtual en un formato alternativo: `"/host/path"` `"/vfs/path"`.
:::

<!--
### Understanding Data Persistence and SQLite Location in `server` mode
-->

### Entender la persistencia de datos y la ubicación de SQLite en modo `server`

<!--
By default, Playground CLI stores WordPress files and the SQLite database in **temporary directories on your operating system**:
-->

Por defecto, Playground CLI almacena los archivos de WordPress y la base de datos SQLite en **directorios temporales de tu sistema operativo**:

```
<OS-TEMP-DIR>/playground-<random-id>/
├── wordpress/          # Instalación de WordPress
├── internal/           # Configuración del runtime de Playground
└── tmp/                # Archivos temporales de PHP
```

<!--
**Finding Your Temp Directory:**

The actual location depends on your OS (these are examples or common possibilities):

- **macOS/Linux**: May be under `/tmp/` or `/private/var/folders/` (varies by system)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

To see the exact temp directory path being used, run the CLI with the `--verbosity=debug` flag:
-->

**Encontrar tu directorio temporal:**

La ubicación real depende de tu SO (estos son ejemplos o posibilidades habituales):

- **macOS/Linux**: Puede estar en `/tmp/` o `/private/var/folders/` (varía según el sistema)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

Para ver la ruta exacta del directorio temporal en uso, ejecuta el CLI con la opción `--verbosity=debug`:

```bash
npx @wp-playground/cli@latest server --verbosity=debug
```

<!--
This will output something like:
-->

Esto mostrará algo como:

```
Native temp dir for VFS root:
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC
Mount before WP install: /home ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/home
Mount before WP install: /tmp ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/tmp
Mount before WP install: /wordpress ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/wordpress
```

<!--
**Where is the SQLite Database Stored?**

The database location depends on what you mount:

- **Auto-mounting wp-content or full WordPress**:
    - Database: `<your-local-project>/wp-content/database/.ht.sqlite`
    - ✅ **Persisted locally** in your project folder

- **Auto-mounting plugin/theme only**:
    - Database: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ **Lost when server stops** (temp directories are cleaned up)

- **Custom mounts**: Database location follows your mount configuration

**Automatic Cleanup:**
Playground CLI automatically removes temp directories that are:

- Older than 2 days
- No longer associated with a running process

**Recommendation:** To persist both your code and database when developing plugins or themes, mount the entire `wp-content` directory instead of just the plugin/theme folder.
-->

**¿Dónde se almacena la base de datos SQLite?**

La ubicación de la base de datos depende de lo que montes:

- **Montaje automático de wp-content o WordPress completo**:
    - Base de datos: `<tu-proyecto-local>/wp-content/database/.ht.sqlite`
    - ✅ **Persistida localmente** en la carpeta de tu proyecto

- **Solo montaje automático de plugin/tema**:
    - Base de datos: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ **Se pierde al detener el servidor** (los directorios temporales se eliminan)

- **Montajes personalizados**: La ubicación de la base de datos sigue tu configuración de montaje

**Limpieza automática:**
Playground CLI elimina automáticamente directorios temporales que:

- Tengan más de 2 días
- No estén asociados a un proceso en ejecución

**Recomendación:** Para persistir tanto tu código como la base de datos al desarrollar plugins o temas, monta todo el directorio `wp-content` en lugar de solo la carpeta del plugin/tema.

<!--
**Example: Mounting wp-content for persistence**
-->

**Ejemplo: Montar wp-content para persistencia**

```bash
# Mount your entire wp-content directory
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount=./wp-content:/wordpress/wp-content
```

<!--
### Data Persistence in `start` mode
-->

### Persistencia de datos en modo `start`

<!--
Running in `start` mode, Playground CLI **automatically persists** your WordPress site in a dedicated directory:
-->

En modo `start`, Playground CLI **persiste automáticamente** tu sitio WordPress en un directorio dedicado:

```
~/.wordpress-playground/sites/<path-hash>/
├── wordpress/          # Instalación de WordPress
├── internal/           # Configuración del runtime de Playground
└── tmp/                # Archivos temporales de PHP
```

<!--
The `<path-hash>` is derived from your project directory path. This ensures isolation between different projects while persisting changes automatically.
-->

El `<path-hash>` se deriva de la ruta del directorio de tu proyecto. Así se aíslan los proyectos y se persisten los cambios automáticamente.

<!--
#### Persistence behavior

- **Default (no explicit mount)**: WordPress files and database persist in `~/.wordpress-playground/sites/<path-hash>/`. Changes survive between CLI restarts.
- **Explicit `/wordpress` mount**: If you provide a mount path for `/wordpress`, automatic persistence is skipped. Your mount configuration takes precedence.

The database location depends on your configuration:

- **Default (automatic persistence)**:
    - Database: `~/.wordpress-playground/sites/<path-hash>/wordpress/wp-content/database/.ht.sqlite`
    - **Persisted automatically** between sessions
-->

#### Comportamiento de la persistencia

- **Por defecto (sin montaje explícito)**: Los archivos y la base de datos de WordPress persisten en `~/.wordpress-playground/sites/<path-hash>/`. Los cambios se mantienen entre reinicios del CLI.
- **Montaje explícito de `/wordpress`**: Si indicas una ruta de montaje para `/wordpress`, se omite la persistencia automática. Tu configuración de montaje tiene prioridad.

La ubicación de la base de datos depende de tu configuración:

- **Por defecto (persistencia automática)**:
    - Base de datos: `~/.wordpress-playground/sites/<path-hash>/wordpress/wp-content/database/.ht.sqlite`
    - **Persistida automáticamente** entre sesiones

<!--
#### Resetting a persisted site
-->

#### Restablecer un sitio persistido

<!--
To start fresh, use the `--reset` flag with the `start` command:
-->

Para empezar de cero, usa la opción `--reset` con el comando `start`:

```bash
npx @wp-playground/cli@latest start --reset
```

<!--
## Command and Arguments
-->

## Comando y argumentos

<!--
Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

- **`start`**: (Simplified) Starts a local WordPress server with automatic project detection, site persistence, and browser opening.
- **`server`**: (Advanced) Starts a local WordPress server with full manual control over configuration.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.

The `start` command has a dedicated argument:

- `--reset`: Delete the stored site and start fresh. Defaults to false.

The `server` command supports the following optional arguments:
-->

Playground CLI es simple, configurable y sin opiniones fijas. Puedes configurarlo según tu entorno WordPress. Con Playground CLI puedes usar los siguientes comandos de nivel superior:

- **`start`**: (Simplificado) Inicia un servidor WordPress local con detección automática del proyecto, persistencia del sitio y apertura del navegador.
- **`server`**: (Avanzado) Inicia un servidor WordPress local con control manual completo de la configuración.
- **`run-blueprint`**: Ejecuta un archivo Blueprint sin iniciar un servidor web.
- **`build-snapshot`**: Genera un snapshot ZIP de un sitio WordPress a partir de un Blueprint.

El comando `start` tiene un argumento dedicado:

- `--reset`: Elimina el sitio almacenado y empieza de cero. Por defecto: false.

El comando `server` admite los siguientes argumentos opcionales:

<!--
- `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
... (full list as in source)
-->

- `--port=<port>`: Puerto en el que escucha el servidor. Por defecto: 9400.
- `--version`: Muestra el número de versión.
- `--outfile`: Al construir, escribe en este archivo de salida.
- `--site-url=<url>`: URL del sitio para WordPress. Por defecto: `http://127.0.0.1:{port}`.
- `--wp=<version>`: Versión de WordPress a usar. Por defecto: la más reciente.
- `--php=<version>`: Versión de PHP. Opciones: `8.5`, `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`. Por defecto: `8.5`.
- `--auto-mount[=<path>]`: Monta automáticamente un directorio. Sin ruta, monta el directorio de trabajo actual. Puedes montar un directorio WordPress, de plugin, de tema, wp-content o cualquier directorio con archivos PHP y HTML.
- `--mount=<mapping>`: Monta un directorio manualmente (puede usarse varias veces). Formato: `"/host/path:/vfs/path"`.
- `--mount-before-install`: Monta un directorio en el runtime PHP antes de la instalación de WordPress (puede usarse varias veces). Formato: `"/host/path:/vfs/path"`.
- `--mount-dir`: Monta un directorio en el runtime PHP (puede usarse varias veces). Formato: `"/host/path"` `"/vfs/path"`.
- `--mount-dir-before-install`: Monta un directorio antes de la instalación de WordPress (puede usarse varias veces). Formato: `"/host/path"` `"/vfs/path"`.
- `--blueprint=<path>`: Ruta del archivo JSON Blueprint a ejecutar.
- `--blueprint-may-read-adjacent-files`: Opción de consentimiento: permite que los recursos "empaquetados" en un blueprint local lean archivos del mismo directorio que el blueprint.
- `--login`: Inicia sesión automáticamente como administrador.
- `--wordpress-install-mode <mode>`: Controla cómo Playground prepara WordPress antes del arranque. Por defecto: `download-and-install`. Otras opciones: `install-from-existing-files`, `install-from-existing-files-if-needed`, `do-not-attempt-installing`.
- `--skip-sqlite-setup`: No configurar la integración de la base de datos SQLite.
- `--verbosity=<level>`: Nivel de logs y mensajes de progreso. Opciones: `quiet`, `normal`, `debug`. Por defecto: `normal`.
- `--debug`: Muestra el log de errores de PHP si ocurre un error durante el arranque.
- `--follow-symlinks`: Permite que Playground siga enlaces simbólicos montando automáticamente directorios y archivos enlazados encontrados en directorios montados.
- `--internal-cookie-store`: Habilita el manejo interno de cookies. Cuando está habilitado, Playground gestiona las cookies internamente con un HttpCookieStore que persiste las cookies entre peticiones. Cuando está deshabilitado, las cookies se gestionan externamente (p. ej. por el navegador en entornos Node.js). Por defecto: false.
- `--phpmyadmin[=<path>]`: Instala phpMyAdmin para gestionar la base de datos. La URL de phpMyAdmin se mostrará tras el arranque. Opcionalmente especifica una ruta de URL personalizada (por defecto: `/phpmyadmin`).
- `--xdebug`: Habilita Xdebug. Por defecto: false.
- `--experimental-devtools`: Habilita herramientas de desarrollo experimentales en el navegador. Por defecto: false.
- `--experimental-unsafe-ide-integration=<ide>`: Configura la integración de Xdebug en VS Code (`vscode`) y PhpStorm (`phpstorm`).
- `--experimental-multi-worker=<number>`: Habilita soporte experimental multi-worker, que requiere un directorio `/wordpress` respaldado por un sistema de archivos real. Pasa un número positivo para el número de workers; en caso contrario, por defecto es el número de CPUs menos 1.

<!--
:::caution
With the flag `--follow-symlinks`, the following symlinks will expose files outside mounted directories to Playground and could be a security risk.
:::
-->

:::caution
Con la opción `--follow-symlinks`, los enlaces simbólicos pueden exponer archivos fuera de los directorios montados a Playground y suponer un riesgo de seguridad.
:::

<!--
## Need some help with the CLI?
-->

## ¿Necesitas ayuda con el CLI?

<!--
With the Playground CLI, you can use the `--help` flag to get the full list of available commands and arguments.
-->

Con Playground CLI puedes usar la opción `--help` para ver la lista completa de comandos y argumentos disponibles.

```bash
npx @wp-playground/cli@latest --help
```

<!--
## Programmatic usage
-->

## Uso programático

<!--
The Playground CLI can also be controlled programmatically from JavaScript/TypeScript
using the `runCLI` function. See the [Programmatic Usage guide](/guides/programmatic-playground-cli)
for details on automation and testing.
-->

El Playground CLI también puede controlarse de forma programática desde JavaScript/TypeScript con la función `runCLI`. Consulta la [guía de uso programático](/guides/programmatic-playground-cli) para detalles sobre automatización y pruebas.
