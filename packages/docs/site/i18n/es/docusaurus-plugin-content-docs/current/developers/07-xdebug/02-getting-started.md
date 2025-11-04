---
title: Primeros Pasos con Xdebug
slug: /developers/xdebug/getting-started
description: Antes de comenzar a depurar, necesitas ejecutar WordPress Playground con Xdebug habilitado. Esta guía cubre lo básico.
---

# Primeros Pasos con Xdebug

Esta guía proporcionará una introducción sobre cómo habilitar esta característica y probar tu aplicación paso a paso.

## PHP WASM CLI vs Playground CLI

Primero, Xdebug puede ser utilizado en dos CLI diferentes:

-   **`@php-wasm/cli`**: Ejecuta scripts PHP independientes. Úsalo cuando estés depurando código PHP sin necesidad de un entorno WordPress.
-   **`@wp-playground/cli`**: Ejecuta una instalación completa de WordPress. Útil para depurar plugins de WordPress, temas o funcionalidades del núcleo.

Para esta guía, utilizaremos Playground CLI. Si no estás familiarizado con la herramienta, recomendamos leer la guía de [Playground CLI](/developers/local-development/wp-playground-cli), pero el mismo proceso también puede aplicarse a la depuración de aplicaciones PHP con `@php-wasm/cli`.

## Inicio rápido con `npx`

La forma más rápida de comenzar es usar npx, que no requiere instalación:

```bash
npx @wp-playground/cli@latest server --xdebug
```

Esto inicia WordPress en `http://127.0.0.1:9400` con Xdebug habilitado. Ahora puedes conectar un depurador.

## Iniciando con DevTools

Para depurar con Chrome DevTools, agrega la bandera `--experimental-devtools`:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

La terminal mostrará una URL para conectar Chrome DevTools:

```bash
Starting a PHP server...
Setting up WordPress latest
Resolved WordPress release URL: https://downloads.w.org/release/wordpress-6.8.3.zip
Fetching SQLite integration plugin...
Booting WordPress...
Booted!
Running the Blueprint...
Running the Blueprint – 100%
Finished running the blueprint
WordPress is running on http://127.0.0.1:9400 with 1 worker(s)
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=localhost:9229

Chrome connected! Initializing Xdebug receiver...
XDebug receiver running on port 9003
Running a PHP script with Xdebug enabled...
```

Al hacer clic en la URL proporcionada, por ejemplo, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, tendrás acceso a DevTools conectado con tu aplicación, con la posibilidad de inspeccionar todos los archivos de una instancia WordPress.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-xdebug-on-devtools.webp)

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

En la carpeta donde se encuentra el plugin, ejecutemos el comando en nuestro terminal:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools --auto-mount
```

Playground CLI reconocerá que estamos trabajando con un plugin y montará una estructura preparada para probar nuestro plugin. Abriendo el proyecto en tu navegador y DevTools, podrás agregar breakpoints en el código de tu plugin y probarlo línea por línea.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-cli-running-xdebug-on-devtools.webp)

## Iniciando con integración IDE

Similar al proceso con una IDE, vamos a utilizar el mismo código del plugin anterior para depurar con VSCode o PhpStorm, agrega la bandera `--experimental-unsafe-ide-integration`:

1. install php debugger
2. needs the file .vscode/launch.json
3. enable breakingpoints
4. run the debbuger

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration --auto-mount
```
