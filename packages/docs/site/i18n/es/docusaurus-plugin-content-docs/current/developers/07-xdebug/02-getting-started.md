---
title: Primeros Pasos con Xdebug
slug: /developers/xdebug/getting-started
description: Antes de comenzar a depurar, necesitas ejecutar WordPress Playground con Xdebug habilitado. Esta guía cubre lo básico.
---

<!-- # Getting Started with Xdebug -->

# Primeros Pasos con Xdebug

<!-- This guide shows you how to enable Xdebug in WordPress Playground and start debugging your code. -->

Esta guía te muestra cómo habilitar Xdebug en WordPress Playground y comenzar a depurar tu código.

<!-- ## PHP WASM CLI vs Playground CLI -->

## PHP WASM CLI vs Playground CLI

<!-- First, Xdebug is present in two different CLIs: -->

Primero, Xdebug está presente en dos CLI diferentes:

-   **`@php-wasm/cli`**: Ejecuta scripts PHP independientes. Úsalo cuando estés depurando código PHP sin necesidad de un entorno WordPress.
-   **`@wp-playground/cli`**: Ejecuta una instalación completa de WordPress. Útil para depurar plugins de WordPress, temas o funcionalidades del núcleo.

<!-- For this guide, we'll use `@wp-playground/cli`. If you're not familiar with the tool, we recommend reading the [`@wp-playground/cli` guide](/developers/local-development/wp-playground-cli), but the same process can also be applied to debugging PHP applications with `@php-wasm/cli`. -->

Para esta guía, utilizaremos `@wp-playground/cli`. Si no estás familiarizado con la herramienta, recomendamos leer la guía de [`@wp-playground/cli`](/developers/local-development/wp-playground-cli), pero el mismo proceso también puede aplicarse a la depuración de aplicaciones PHP con `@php-wasm/cli`.

<!-- ## Quick start with `npx` -->

## Inicio rápido con `npx`

<!-- The fastest way to get started is using npx, which doesn't require installation: -->

La forma más rápida de comenzar es usar npx, que no requiere instalación:

```bash
npx @wp-playground/cli@latest server --xdebug
```

<!-- This starts WordPress on `http://127.0.0.1:9400` with Xdebug enabled. Now you connect a debugger. -->

Esto inicia WordPress en `http://127.0.0.1:9400` con Xdebug habilitado. Ahora conectas un depurador.

<!-- ## Starting with DevTools -->

## Iniciando con DevTools

<!-- To debug with Chrome DevTools, add the `--experimental-devtools` flag: -->

Para depurar con Chrome DevTools, agrega la bandera `--experimental-devtools`:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

<!-- The terminal will display a URL to connect Chrome DevTools: -->

La terminal mostrará una URL para conectar Chrome DevTools:

```bash
Starting a PHP server...
Setting up WordPress latest
Resolved WordPress release URL: https://downloads.w.org/release/wordpress-6.8.3.zip
Fetching SQLite integration plugin...
Booting WordPress...
WordPress is running on http://127.0.0.1:9400 with 1 worker(s)
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=localhost:9229

Chrome connected! Initializing Xdebug receiver...
XDebug receiver running on port 9003
Running a PHP script with Xdebug enabled...
```

<!-- By clicking on the provided URL, for example, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, you can access DevTools connected to your application, with the ability to inspect all files of a WordPress instance. -->

Al hacer clic en la URL proporcionada, por ejemplo, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, puedes acceder a DevTools conectado con tu aplicación, con la posibilidad de inspeccionar todos los archivos de una instancia WordPress.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-xdebug-on-devtools.webp)

<!-- For a more practical example, let's debug a plugin that has the following code: -->

Para un ejemplo más práctico, vamos a depurar un plugin que tiene el siguiente código:

```PHP
<?php
/**
 * Plugin Name: Simple Admin Message
 * Description: Displays a simple message in the WordPress admin
 * Version: 1.0
 * Author: Playground Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Display admin notice
function sam_display_admin_message() {
    $message = 'Hello! This is a simple admin message.';
    ?>
    <div class="notice notice-info is-dismissible">
        <p><?php _e($message, 'simple-admin-message'); ?></p>
    </div>
    <?php
}
add_action('admin_notices', 'sam_display_admin_message');
```

<!-- In the folder where the plugin is located, let's run the command in our terminal: -->

En la carpeta donde se encuentra el plugin, ejecutemos el comando en nuestro terminal:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools --auto-mount
```

<!-- The Playground CLI(`@wp-playground/cli`) will automatically detect the plugin folder and mount it. Opening the project in your browser and DevTools, you'll be able to add breakpoints in your plugin's code and test it line by line. -->

El Playground CLI (`@wp-playground/cli`) detectará automáticamente la carpeta del plugin y la montará. Abriendo el proyecto en tu navegador y DevTools, podrás agregar breakpoints en el código de tu plugin y probarlo línea por línea.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-cli-running-xdebug-on-devtools.webp)

<!-- ## Starting with IDE integration -->

## Iniciando con integración IDE

<!-- Similar to the process with DevTools, let's use the same plugin code from before to debug with VSCode, add the `--experimental-unsafe-ide-integration=vscode` flag. This flag will optimize the setup process for VSCode. If you're working with PhpStorm, just add the `--experimental-unsafe-ide-integration=phpstorm` flag. -->

Similar al proceso con DevTools, vamos a utilizar el mismo código del plugin anterior para depurar con VSCode, agrega la bandera `--experimental-unsafe-ide-integration=vscode`. Esta bandera optimizará el proceso de configuración para VSCode. Si trabajas con PhpStorm, simplemente agrega la bandera `--experimental-unsafe-ide-integration=phpstorm`.

<!-- To debug in VSCode you'll need the following prerequisites: -->

Para depurar en VSCode necesitarás los siguientes prerrequisitos:

1. Una extensión para agregar soporte de PHP profiling, por ejemplo, [PHP Profiler](https://open-vsx.org/extension/devsense/profiler-php-vscode)
2. Una carpeta `.vscode/`. Si el archivo `launch.json` no existe, no te preocupes, `@wp-playground/cli` lo creará.
3. Habilita los puntos de interrupción (breakpoints) en tu IDE. Algunos IDEs vienen con esta característica desactivada, así que presta atención a este detalle.

<!-- If everything is ready, you run the command: -->

Si todo está listo, ejecuta el comando:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration=vscode --auto-mount
```

<!-- Now, go to your code, add the breakpoints and happy testing. -->

Ahora, ve a tu código, agrega los breakpoints y buenas pruebas.

![Xdebug en ejecución en VSCode](@site/static/img/developers/xdebug/xdebug-in-action-on-vscode.webp)

<!-- This feature is in experimental mode. Until it is completed, we will need your feedback. Please connect with us in the [#playground Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K) and share your thoughts. -->

Esta característica está en modo experimental. Hasta que se complete, necesitaremos tu retroalimentación. Por favor, conéctate con nosotros en el [canal Slack #playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) y comparte tus pensamientos.
