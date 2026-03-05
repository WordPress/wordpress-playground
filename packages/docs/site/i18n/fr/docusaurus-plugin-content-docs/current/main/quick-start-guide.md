---
title: Guide de démarrage rapide
slug: /quick-start-guide
description: Un guide de 5 minutes pour débuter avec Playground. Apprenez à tester des extensions, à essayer des thèmes et à utiliser différentes versions WP/PHP.
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!-- # Start using WordPress Playground in 5 minutes -->

# Commencez à utiliser WordPress Playground en 5 minutes

<!-- WordPress Playground can help you with any of the following: -->

WordPress Playground peut vous aider dans les domaines suivants :

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- This page will guide you through each of these. Oh, and if you're a visual learner – here's a video: -->

Cette page vous guidera à travers chacun de ces éléments. Ah, et si vous préferrez l’apprentissage visuel, voici une vidéo :

<!-- <iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe> -->
<iframe width="752" height="423.2" title="Débutez avec WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!-- ## Start a new WordPress site -->

## Commencez un nouveau site WordPress

<!-- Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site. -->

Chaque fois que vous visitez la [démo officielle sur playground.wordpress.net](https://playground.wordpress.net/), vous obtenez un nouveau site WordPress.

<!-- You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress. -->

Vous pouvez alors créer des pages, téléverser des extensions, des thèmes, importer votre propre site, et faire la plupart des choses que vous feriez sur un site WordPress de base.

<!-- It's that easy to start! -->

C’est aussi simple que cela de commencer !

<!-- The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page! -->

L’ensemble du site se trouve dans votre navigateur et est effacé lorsque vous fermez l’onglet. Vous voulez repartir à zéro ? Il suffit de rafraîchir la page !

<!-- :::info WordPress Playground is private -->

:::info WordPress Playground est privé

<!-- Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over! -->

Tout ce que vous construisez reste dans votre navigateur et n’est **pas** envoyé n’importe où. Une fois que vous avez terminé, vous pouvez exporter votre site sous forme de fichier zip. Ou simplement rafraîchir la page et recommencer !

:::

<!-- ## Try a block, a theme, or a plugin -->

## Essayer un bloc, un thème, ou une extension

<!-- You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/). -->

Vous pouvez téléverser n’importe quelle extension ou thème dans [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!-- To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL: -->

Pour économiser quelques clics, vous pouvez préinstaller des extensions ou des thèmes depuis le répertoire des extensions de WordPress en ajoutant le paramètre `plugin` ou `theme` à l'URL. Par exemple, pour installer l’extension coblocks, vous pouvez utiliser cette URL :

https://playground.wordpress.net/?plugin=coblocks

<!-- Or this URL to preinstall the `pendant` theme: -->

Ou encore cette URL pour préinstaller le thème `pendant` :

https://playground.wordpress.net/?theme=pendant

<!-- In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters: -->

Si vous souhaitez installer plusieurs thèmes et extensions, il est possible de répéter les paramètres `theme` ou `plugin` :

https://playground.wordpress.net/?theme=pendant&theme=acai

<!-- You can also mix and match these parameters and even add multiple plugins: -->

Vous pouvez également mélanger et faire correspondre ces paramètres et même ajouter plusieurs extensions :

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

<!-- ## Save your site -->

## Sauvegarder votre site

<!-- To keep your WordPress Playground site for longer than a single browser session, you can export it as a `.zip` file. -->

Pour conserver votre site WordPress Playground au delà d’une seule session de navigateur, vous pouvez l’exporter sous la forme d’un fichier `.zip`.

<!-- 1. Open the Playground site manager panel: -->

1. Ouvrez le panneau du gestionnaire de site Playground :

<!-- ![Site Manager](@site/static/img/site-manager/open-site-manager.webp) -->

![Gestionnaire de site](@site/static/img/site-manager/open-site-manager.webp)

<!-- 2. Use the "Download as .zip" button in the additional actions menu -->

2. Utilisez le bouton « Télécharger en tant que .zip » dans le menu supplémentaire des actions

<!-- ![Export button](@site/static/img/site-manager/export-zip-file.webp) -->

![Bouton export](@site/static/img/site-manager/export-zip-file.webp)

<!-- The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there. -->

Le fichier exporté contient la totalité du site que vous avez créé. Vous pouvez l’héberger sur n’importe quel serveur prenant en charge PHP et SQLite. Tous les fichiers de base WordPress, les extensions, les thèmes et tout ce que vous avez ajouté d’autre à votre site s’y trouvent.

<!-- The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager. -->

Le fichier de base de données SQLite est également inclus dans l’export, vous le trouverez `wp-content/database/.ht.sqlite`. Gardez à l’esprit que les fichiers commençant par un point sont masqués par défaut sur la plupart des systèmes d’exploitation, vous devrez donc peut-être activer l’option « Afficher les fichiers masqués » dans votre gestionnaire de fichiers.

<!-- ## Restore a saved site -->

## Restaurer un site sauvegardé

<!-- You can restore the saved site using the "Import from .zip" button in the Playground dashboard panel: -->

Vous pouvez restaurer le site que vous avez sauvegardé en utilisant le bouton « Importer depuis .zip » dans le panneau de tableau de bord Playground :

<!-- 1. Open the Playground dashboard panel: -->

1. Ouvrez le panneau de tableau de bord Playground :

<!-- ![Open Playground Dashboard](@site/static/img/dashboard/open-playground-dashboard.webp) -->

![Ouvrir le tableau de bord Playground](@site/static/img/dashboard/open-playground-dashboard.webp)

<!-- 1. Use the "Import .zip" button at the end of the "Start a new Playground" section -->

1. Utilisez le bouton « Importer .zip » à la fin de la section « Démarrer un nouveau Playground »

<!-- ![Open Playground Dashboard](@site/static/img/dashboard/import-playground.webp) -->

![Ouvrir le tableau de bord Playground](@site/static/img/dashboard/import-playground.webp)

<!-- ## Use a specific WordPress or PHP version -->

## Utiliser une version spécifique de WordPress ou de PHP

<!-- The quickest way to change the version of WordPress or PHP is by using the settings panel on the [official demo site](https://playground.wordpress.net/): -->

Le moyen le plus rapide de modifier la version de WordPress ou de PHP est d’utiliser le panneau des paramètres sur le [site de démo officiel](https://playground.wordpress.net/) :

<!-- ![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp) -->

![menu Paramètres de WordPress Playground](@site/static/img/playground-settings-menu.webp)

<!-- :::info Test your plugin or theme -->

:::info Testez votre extension ou votre thème

<!-- Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage! -->

Les tests de compatibilité avec tant de versions de WordPress et de PHP ont toujours été pénibles. WordPress Playground rend ce processus sans effort - utilisez-le à votre avantage !

:::

<!-- You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded: -->

Vous pouvez également utiliser les [paramètres de requête](/developers/apis/query-api) `wp` et `php` pour ouvrir Playground avec les bonnes versions déjà chargées :

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

<!-- To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo). -->

Pour en savoir plus au sujet de la préparation de contenu pour les démos, consultez [le guide « Fournir du contenu pour votre démonstration »](/guides/providing-content-for-your-demo).

<!-- :::info Major versions only -->

:::info Versions majeures uniquement

<!-- You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. -->

Vous pouvez spécifier des versions majeures comme `wp=6.2` ou `php=8.1` et attendre la version la plus récente dans cette ligne. Vous ne pouvez cependant pas demander des versions mineures plus anciennes, donc ni `wp=6.1.2` ni `php=7.4.9` ne fonctionneront.

:::

<!-- ## Import a WXR file -->

## Importer un fichier WXR

<!-- You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php). -->

Vous pouvez importer un fichier d’export WordPress en téléversant un fichier WXR dans [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

<!-- You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more. -->

Vous pouvez également utiliser [Blueprints JSON](/blueprints). Pour en savoir plus, voir [démarrer avec Blueprints](/blueprints/getting-started).

<!-- This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site. -->

Cette fonction est différente de la fonction d’importation décrite ci-dessus. La fonction d’importation exporte l’ensemble du site, y compris la base de données. Cette fonction d'importation permet d’importer un fichier WXR dans un site existant.

<!-- ## Build apps with WordPress Playground -->

## Créer des applications avec WordPress Playground

<!-- WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), setup plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/). -->

WordPress Playground est programmable, ce qui signifie que vous pouvez [créer des applications WordPress](/developers/build-your-first-app), mettre en place des démonstrations d’extensions et même l’utiliser comme un [environnement de développement local] sans installation(/developers/local-development/).

<!-- To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section. -->

Pour en savoir plus sur le développement avec WordPress Playground, consultez la section [démarrage rapide du développement](/developers/build-your-first-app).
