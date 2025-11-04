---
title: Premiers Pas avec Xdebug
slug: /developers/xdebug/getting-started
description: Avant de commencer à déboguer, vous devez exécuter WordPress Playground avec Xdebug activé. Ce guide couvre les bases.
---

<!-- # Getting Started with Xdebug -->

# Premiers Pas avec Xdebug

<!-- This guide shows you how to enable Xdebug in WordPress Playground and start debugging your code. -->

Ce guide vous montre comment activer Xdebug dans WordPress Playground et commencer à déboguer votre code.

<!-- ## PHP WASM CLI vs Playground CLI -->

## PHP WASM CLI vs Playground CLI

<!-- First, Xdebug is present in two different CLIs: -->

Tout d'abord, Xdebug est présent dans deux CLI différents :

-   **`@php-wasm/cli`** : Exécutez des scripts PHP autonomes. Utilisez-le lorsque vous déboguez du code PHP sans avoir besoin d'un environnement WordPress.
-   **`@wp-playground/cli`** : Exécutez une installation complète de WordPress. Utile pour déboguer des plugins WordPress, des thèmes ou des fonctionnalités du noyau.

<!-- For this guide, we'll use `@wp-playground/cli`. If you're not familiar with the tool, we recommend reading the [`@wp-playground/cli` guide](/developers/local-development/wp-playground-cli), but the same process can also be applied to debugging PHP applications with `@php-wasm/cli`. -->

Pour ce guide, nous utiliserons `@wp-playground/cli`. Si vous n'êtes pas familier avec l'outil, nous recommandons de lire le guide [`@wp-playground/cli`](/developers/local-development/wp-playground-cli), mais le même processus peut également être appliqué au débogage d'applications PHP avec `@php-wasm/cli`.

<!-- ## Quick start with `npx` -->

## Démarrage rapide avec `npx`

<!-- The fastest way to get started is using npx, which doesn't require installation: -->

Le moyen le plus rapide de commencer est d'utiliser npx, qui ne nécessite pas d'installation :

```bash
npx @wp-playground/cli@latest server --xdebug
```

<!-- This starts WordPress on `http://127.0.0.1:9400` with Xdebug enabled. Now you connect a debugger. -->

Cela démarre WordPress sur `http://127.0.0.1:9400` avec Xdebug activé. Maintenant, vous connectez un débogueur.

<!-- ## Starting with DevTools -->

## Démarrer avec DevTools

<!-- To debug with Chrome DevTools, add the `--experimental-devtools` flag: -->

Pour déboguer avec Chrome DevTools, ajoutez le drapeau `--experimental-devtools` :

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

<!-- The terminal will display a URL to connect Chrome DevTools: -->

Le terminal affichera une URL pour connecter Chrome DevTools :

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

En cliquant sur l'URL fournie, par exemple, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, vous pouvez accéder à DevTools connecté à votre application, avec la possibilité d'inspecter tous les fichiers d'une instance WordPress.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-xdebug-on-devtools.webp)

<!-- For a more practical example, let's debug a plugin that has the following code: -->

Pour un exemple plus pratique, déboguons un plugin qui contient le code suivant :

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

Dans le dossier où se trouve le plugin, exécutons la commande dans notre terminal :

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools --auto-mount
```

<!-- The Playground CLI(`@wp-playground/cli`) will automatically detect the plugin folder and mount it. Opening the project in your browser and DevTools, you'll be able to add breakpoints in your plugin's code and test it line by line. -->

Le Playground CLI (`@wp-playground/cli`) détectera automatiquement le dossier du plugin et le montera. En ouvrant le projet dans votre navigateur et DevTools, vous pourrez ajouter des points d'arrêt dans le code de votre plugin et le tester ligne par ligne.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-cli-running-xdebug-on-devtools.webp)

<!-- ## Starting with IDE integration -->

## Démarrer avec l'intégration IDE

<!-- Similar to the process with DevTools, let's use the same plugin code from before to debug with VSCode, add the `--experimental-unsafe-ide-integration=vscode` flag. This flag will optimize the setup process for VSCode. If you're working with PhpStorm, just add the `--experimental-unsafe-ide-integration=phpstorm` flag. -->

Similaire au processus avec DevTools, utilisons le même code de plugin qu'avant pour déboguer avec VSCode, ajoutez le drapeau `--experimental-unsafe-ide-integration=vscode`. Ce drapeau optimisera le processus de configuration pour VSCode. Si vous travaillez avec PhpStorm, ajoutez simplement le drapeau `--experimental-unsafe-ide-integration=phpstorm`.

<!-- To debug in VSCode you'll need the following prerequisites: -->

Pour déboguer dans VSCode, vous aurez besoin des prérequis suivants :

1. Une extension pour ajouter le support du profilage PHP, par exemple, [PHP Profiler](https://open-vsx.org/extension/devsense/profiler-php-vscode)
2. Un dossier `.vscode/`. Si le fichier `launch.json` n'existe pas, ne vous inquiétez pas, `@wp-playground/cli` le créera.
3. Activez les points d'arrêt (breakpoints) dans votre IDE. Certains IDE ont cette fonctionnalité désactivée par défaut, alors faites attention à ce détail.

<!-- If everything is ready, you run the command: -->

Si tout est prêt, exécutez la commande :

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration=vscode --auto-mount
```

<!-- Now, go to your code, add the breakpoints and happy testing. -->

Maintenant, allez dans votre code, ajoutez les points d'arrêt et bon débogage.

![Xdebug en action sur VSCode](@site/static/img/developers/xdebug/xdebug-in-action-on-vscode.webp)

<!-- This feature is in experimental mode. Until it is completed, we will need your feedback. Please connect with us in the [#playground Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K) and share your thoughts. -->

Cette fonctionnalité est en mode expérimental. Jusqu'à ce qu'elle soit terminée, nous aurons besoin de vos commentaires. Veuillez vous connecter avec nous dans le [canal Slack #playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) et partager vos réflexions.
