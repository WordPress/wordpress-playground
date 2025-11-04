---
title: Getting Started with Xdebug
slug: /developers/xdebug/getting-started
description: Before you can start debugging, you need to run WordPress Playground with Xdebug enabled. This guide covers the basics.
---

# Getting Started with Xdebug

This guide will provide an introduction on how to enable this feature and test your application step by step.

## PHP WASM CLI vs Playground CLI

First, Xdebug can be used in two different CLIs:

-   **`@php-wasm/cli`**: Run standalone PHP scripts. Use this when debugging PHP code without needing a WordPress environment.
-   **`@wp-playground/cli`**: Run a full WordPress installation. Useful for debugging WordPress plugins, themes, or core functionality.

For this guide, we'll use Playground CLI. If you're not familiar with the tool, we recommend reading the [Playground CLI guide](/developers/local-development/wp-playground-cli), but the same process can also be applied to debugging PHP applications with `@php-wasm/cli`.

## Quick start with `npx`

The fastest way to get started is using npx, which doesn't require installation:

```bash
npx @wp-playground/cli@latest server --xdebug
```

This starts WordPress on `http://127.0.0.1:9400` with Xdebug enabled. Now you can connect a debugger.

## Starting with DevTools

To debug with Chrome DevTools, add the `--experimental-devtools` flag:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

The terminal will display a URL to connect Chrome DevTools:

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

By clicking on the provided URL, for example, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, you'll have access to DevTools connected to your application, with the ability to inspect all files of a WordPress instance.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-xdebug-on-devtools.webp)

For a more practical example, let's debug a plugin that has the following code:

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

In the folder where the plugin is located, let's run the command in our terminal:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools --auto-mount
```

Playground CLI will recognize that we're working with a plugin and mount a structure prepared to test our plugin. Opening the project in your browser and DevTools, you'll be able to add breakpoints in your plugin's code and test it line by line.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-cli-running-xdebug-on-devtools.webp)

## Starting with IDE integration

Similar to the process with an IDE, let's use the same plugin code from before to debug with VSCode or PhpStorm, add the `--experimental-unsafe-ide-integration` flag:

1. install php debugger
2. needs the file .vscode/launch.json
3. enable breakingpoints
4. run the debbuger

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration --auto-mount
```
