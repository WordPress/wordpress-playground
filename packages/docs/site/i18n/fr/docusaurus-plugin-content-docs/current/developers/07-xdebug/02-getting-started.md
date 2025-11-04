---
title: Premiers Pas avec Xdebug
slug: /developers/xdebug/getting-started
description: Avant de commencer à déboguer, vous devez exécuter WordPress Playground avec Xdebug activé. Ce guide couvre les bases.
---

# Premiers Pas avec Xdebug

Ce guide fournira une introduction sur la façon d'activer cette fonctionnalité et de tester votre application étape par étape.

## PHP WASM CLI vs Playground CLI

Tout d'abord, Xdebug peut être utilisé dans deux CLI différents :

-   **`@php-wasm/cli`** : Exécutez des scripts PHP autonomes. Utilisez-le lorsque vous déboguez du code PHP sans avoir besoin d'un environnement WordPress.
-   **`@wp-playground/cli`** : Exécutez une installation complète de WordPress. Utile pour déboguer des plugins WordPress, des thèmes ou des fonctionnalités du noyau.

Pour ce guide, nous utiliserons Playground CLI. Si vous n'êtes pas familier avec l'outil, nous recommandons de lire le guide [Playground CLI](/developers/local-development/wp-playground-cli), mais le même processus peut également être appliqué au débogage d'applications PHP avec `@php-wasm/cli`.

## Démarrage rapide avec `npx`

Le moyen le plus rapide de commencer est d'utiliser npx, qui ne nécessite pas d'installation :

```bash
npx @wp-playground/cli@latest server --xdebug
```

Cela démarre WordPress sur `http://127.0.0.1:9400` avec Xdebug activé. Vous pouvez maintenant connecter un débogueur.

## Démarrer avec DevTools

Pour déboguer avec Chrome DevTools, ajoutez le drapeau `--experimental-devtools` :

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

Le terminal affichera une URL pour connecter Chrome DevTools :

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

En cliquant sur l'URL fournie, par exemple, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, vous aurez accès à DevTools connecté à votre application, avec la possibilité d'inspecter tous les fichiers d'une instance WordPress.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-xdebug-on-devtools.webp)

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

Dans le dossier où se trouve le plugin, exécutons la commande dans notre terminal :

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools --auto-mount
```

Playground CLI reconnaîtra que nous travaillons avec un plugin et montera une structure préparée pour tester notre plugin. En ouvrant le projet dans votre navigateur et DevTools, vous pourrez ajouter des points d'arrêt dans le code de votre plugin et le tester ligne par ligne.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-cli-running-xdebug-on-devtools.webp)

## Démarrer avec l'intégration IDE

Similaire au processus avec DevTools, utilisons le même code de plugin qu'avant pour déboguer avec VSCode, ajoutez le drapeau `--experimental-unsafe-ide-integration=vscode`. Ce drapeau optimisera le processus de configuration pour VSCode. Si vous travaillez avec PhpStorm, ajoutez simplement le drapeau `--experimental-unsafe-ide-integration=phpstorm`.

Pour déboguer dans VSCode, vous aurez besoin des éléments suivants comme prérequis :

1. Une extension pour ajouter le support du profilage PHP, par exemple, [PHP Profiler](https://open-vsx.org/extension/devsense/profiler-php-vscode)
2. Un dossier `.vscode/`. Si le fichier `launch.json` n'existe pas, ne vous inquiétez pas, Playground CLI le créera.
3. Activez les points d'arrêt (breakpoints) dans votre IDE. Certains IDE ont cette fonctionnalité désactivée par défaut, alors faites attention à ce détail.

Si tout est prêt, vous pouvez exécuter la commande :

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration=vscode --auto-mount
```

Maintenant, allez dans votre code, ajoutez les points d'arrêt et bon débogage.

![Xdebug en action sur VSCode](@site/static/img/developers/xdebug/xdebug-in-action-on-vscode.webp)

Cette fonctionnalité est en mode expérimental, alors testez-la et envoyez-nous vos commentaires.
