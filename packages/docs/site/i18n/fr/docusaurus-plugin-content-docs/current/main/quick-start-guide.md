---
title: Guide de démarrage rapide
slug: /quick-start-guide
description: Un guide de 5 minutes pour débuter avec Playground. Apprenez à tester des extensions, à essayer des thèmes et à utiliser différentes versions WP/PHP.
---

<!-- # Start using WordPress Playground in 5 minutes -->

# Commencez à utiliser WordPress Playground en 5 minutes

<!-- WordPress Playground can help you with any of the following: -->

WordPress Playground peut vous aider dans les domaines suivants :

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI. -->

Cette page vous guidera à travers chacun de ces éléments. Si vous préférez l’apprentissage visuel, voici une vidéo. Certains détails de l’interface présentée sont antérieurs au Dock ; suivez les étapes écrites pour utiliser l’interface actuelle.

<!-- <iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe> -->

<iframe width="752" height="423.2" title="Débutez avec WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!-- ## Start a new WordPress site -->

## Commencez un nouveau site WordPress

<!-- Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser. -->

Ouvrez la [démo officielle sur playground.wordpress.net](https://playground.wordpress.net/) pour démarrer WordPress dans votre navigateur.

<!-- You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site. -->

Vous pouvez créer des pages, téléverser des extensions, installer des thèmes, importer du contenu et effectuer la plupart des opérations possibles sur un site WordPress classique.

<!-- When browser storage is available, new Playgrounds are autosaved. You can find -->
<!-- up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a -->
<!-- site that is discarded on refresh, open Playground with `?storage=temp`. -->

Lorsque le stockage du navigateur est disponible, les nouveaux Playgrounds sont enregistrés automatiquement. Vous pouvez retrouver jusqu’à cinq sauvegardes automatiques récentes dans **Vos Playgrounds**, depuis le Dock. Si vous avez besoin d’un site supprimé lors de l’actualisation, ouvrez Playground avec `?storage=temp`.

<div class="callout callout-info">

<!-- **WordPress Playground is private** -->

**WordPress Playground est privé**

<!-- The Playground runs locally in your browser. It does not upload your site -->
<!-- unless you choose an action such as **Export to GitHub**. Once you're finished, -->
<!-- you can store the Playground permanently, export it as a ZIP, or start over -->
<!-- from **New Playground**. -->

Playground s’exécute localement dans votre navigateur. Il ne téléverse pas votre site, sauf si vous choisissez une action comme **Exporter vers GitHub**. Lorsque vous avez terminé, vous pouvez stocker définitivement le Playground, l’exporter en ZIP ou recommencer depuis **Nouveau Playground**.

</div>

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

<!-- This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/). -->

Cette fonctionnalité s’appelle l’[API de requête](/developers/apis/query-api/) ; vous pouvez en savoir plus [ici](/developers/apis/query-api/).

<!-- ## Store a Playground in browser storage -->

## Stocker un Playground dans le navigateur

<!-- Click the **Autosaved** or **Unsaved** status in the Dock to open **Store -->
<!-- permanently**, then choose **Save in browser storage**. -->

Cliquez sur l’état **Enregistré automatiquement** ou **Non enregistré** dans le Dock pour ouvrir **Stocker définitivement**, puis choisissez **Enregistrer dans le stockage du navigateur**.

<!-- ![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp) -->

![Le panneau Enregistrer définitivement avec le nom du Playground et le bouton Enregistrer](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!-- A saved browser Playground appears in **Your Playgrounds**. Autosaves also -->
<!-- appear there, but Playground keeps up to five recent autosaves. Store a -->
<!-- Playground permanently when you want to keep it beyond the autosave lifecycle. -->

Un Playground enregistré dans le navigateur apparaît dans **Vos Playgrounds**. Les sauvegardes automatiques y apparaissent également, mais Playground ne conserve que les cinq plus récentes. Stockez un Playground définitivement lorsque vous souhaitez le conserver au-delà de ce cycle.

<!-- Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later. -->

Le stockage du navigateur reste sous le contrôle du navigateur. Exportez un ZIP lorsque vous avez besoin d’un fichier à déplacer, archiver ou restaurer ultérieurement.

<!-- ## Export a portable ZIP -->

## Exporter un ZIP portable

<!-- Open **Export** from the Dock and use **Download as .zip**. -->

Ouvrez **Exporter** depuis le Dock et utilisez **Télécharger en .zip**.

<!-- ![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp) -->

![Le panneau Exporter avec Télécharger au format .zip mis en évidence](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!-- The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite. -->

Le fichier exporté contient les fichiers, la base de données, les extensions, les thèmes, les téléversements et les modifications actuels. Vous pouvez le restaurer dans Playground ou l’héberger sur un serveur compatible avec PHP et SQLite.

<!-- The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager. -->

Le fichier de base de données SQLite est inclus dans `wp-content/database/.ht.sqlite`. Les fichiers commençant par un point sont masqués par défaut sur la plupart des systèmes d’exploitation ; vous devrez peut-être afficher les fichiers masqués dans votre gestionnaire de fichiers.

<!-- ## Restore a ZIP -->

## Restaurer un ZIP

<!-- Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file. -->

Ouvrez **Nouveau Playground** depuis le Dock, choisissez **Importer un ZIP**, puis sélectionnez le fichier ZIP.

<!-- ![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp) -->

![Le panneau Nouveau Playground avec Importer un ZIP sélectionné](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!-- This restores the files and database from the ZIP into a new Playground. -->

Cette opération restaure les fichiers et la base de données du ZIP dans un nouveau Playground.

<!-- ## Use a specific WordPress or PHP version -->

## Utiliser une version spécifique de WordPress ou de PHP

<!-- Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options. -->

Ouvrez **Réglages du site** depuis le Dock pour choisir les options WordPress, PHP, langue, multisite et réseau.

<!-- ![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp) -->

![Le panneau Réglages du site](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!-- **Test your plugin or theme** -->

**Testez votre extension ou votre thème**

<!-- Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage! -->

Les tests de compatibilité avec tant de versions de WordPress et de PHP ont toujours été pénibles. WordPress Playground rend ce processus sans effort - utilisez-le à votre avantage !

</div>

<!-- You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded: -->

Vous pouvez également utiliser les [paramètres de requête](/developers/apis/query-api) `wp` et `php` pour ouvrir Playground avec les bonnes versions déjà chargées :

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!-- This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/). -->

Cette fonctionnalité s’appelle l’[API de requête](/developers/apis/query-api/) ; vous pouvez en savoir plus [ici](/developers/apis/query-api/).

<!-- Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html). -->

Utilisez `php=next` pour prévisualiser la prochaine version de PHP compilée depuis la branche de développement de php-src. Consultez par exemple l’[aperçu des fonctionnalités de PHP 8.6](https://playground.wordpress.net/php-8-6.html).

<!-- To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo). -->

Pour en savoir plus au sujet de la préparation de contenu pour les démos, consultez [le guide « Fournir du contenu pour votre démonstration »](/guides/providing-content-for-your-demo).

<div class="callout callout-info">

<!-- **Major versions only** -->

**Versions majeures uniquement**

<!-- You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. -->

Vous pouvez spécifier des versions majeures comme `wp=6.2` ou `php=8.1` et attendre la version la plus récente dans cette ligne. Vous ne pouvez cependant pas demander des versions mineures plus anciennes, donc ni `wp=6.1.2` ni `php=7.4.9` ne fonctionneront.

</div>

<!-- ## Import a WXR file -->

## Importer un fichier WXR

<!-- You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php). -->

Vous pouvez importer un fichier d’export WordPress en téléversant un fichier WXR dans [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

<!-- You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more. -->

Vous pouvez également utiliser [Blueprints JSON](/blueprints). Pour en savoir plus, voir [démarrer avec Blueprints](/blueprints/getting-started).

<!-- This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site. -->

Cette opération diffère de la restauration d’un ZIP Playground. Un fichier WXR importe du contenu WordPress dans un site existant. Un ZIP Playground restaure les fichiers et la base de données dans un nouveau Playground.

<!-- ## Build apps with WordPress Playground -->

## Créer des applications avec WordPress Playground

<!-- WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), setup plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/). -->

WordPress Playground est programmable, ce qui signifie que vous pouvez [créer des applications WordPress](/developers/build-your-first-app), mettre en place des démonstrations d’extensions et même l’utiliser comme un [environnement de développement local] sans installation(/developers/local-development/).

<!-- To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section. -->

Pour en savoir plus sur le développement avec WordPress Playground, consultez la section [démarrage rapide du développement](/developers/build-your-first-app).
