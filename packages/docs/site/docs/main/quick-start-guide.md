---
title: Guide de démarrage rapide
slug: /quick-start-guide
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

# Commencez à utiliser WordPress Playground en 5 minutes

WordPress Playground peut vous aider dans les domaines suivants :

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

Cette page vous guidera à travers chacun des éléments suivants. Oh, et si vous préferrez l’apprentissage visuel, voici une vidéo (en anglais) :

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video"></iframe>

## Commencez un nouveau site WordPress

Chaque fois que vous visitez la [démo officielle sur playground.wordpress.net](https://playground.wordpress.net/), vous obtenez un nouveau site WordPress.

Vous pouvez alors créer des pages, télécharger des extensions, des thèmes, importer votre propre site, et faire la plupart des choses que vous feriez sur un site WordPress de base.

C'est aussi simple que cela de commencer !

L'ensemble du site se trouve dans votre navigateur et est récupéré lorsque vous fermez l'onglet. Vous voulez recommencer ? Il suffit de rafraîchir la page !

:::info WordPress Playground est privé

Tout ce que vous construisez reste dans votre navigateur et n'est **pas** envoyé nul part. Une fois que vous avez terminé, vous pouvez exporter votre site sous forme de fichier zip. Ou rafraîchissez simplement la page et recommencez !

:::

## Essayer un bloc, un thème, ou une extension

Vous pouvez téléverser n'importe quel extension ou thème dans [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

Pour économiser quelques clics, vous pouvez préinstaller des extensions ou des thèmes depuis le répertoire des extensions de WordPress en ajoutant un paramètre `plugin` ou `theme` à l'URL. Par exemple, pour installer l’extension coblocks, vous pouvez utiliser cette URL :

https://playground.wordpress.net/?plugin=coblocks

Ou cette URL pour préinstaller le thème `pendant` :

https://playground.wordpress.net/?theme=pendant

Vous pouvez également combiner ces paramètres et même ajouter plusieurs extensions :

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

:::info Le répertoire des extensions ne fonctionne pas dans WordPress Playground

Les extensions doivent être installés manuellement car votre site WordPress n'envoie pas de données sur internet. Vous ne pourrez pas naviguer dans le répertoire des extensions de WordPress à l'intérieur de `/wp-admin/`. La méthode Query API peut sembler contredire cela, mais en réalité elle utilise la même extension de formulaire de téléchargement que vous.
:::

:::

## Sauvegardez votre site

Pour conserver votre site WordPress Playground plus longtemps qu'une seule session de navigation, vous pouvez l'exporter sous la forme d'un fichier zip.

Utilisez le bouton « Exporter » dans la barre supérieure :

![Bouton Exporter](@site/static/img/export-button.png)

Le fichier exporté contient le site complet que vous avez construit. Vous pouvez l'héberger sur n'importe quel serveur compatible avec PHP et SQLite. Tous les fichiers du cœur de WordPress, les extensions, les thèmes et tout ce que vous avez ajouté à votre site s'y trouvent.

Le fichier de base de données SQLite est également inclus dans l'export, vous le trouverez `wp-content/database/.ht.sqlite`. Gardez à l'esprit que les fichiers commençant par un point sont cachés par défaut sur la plupart des systèmes d'exploitation, vous devrez donc peut-être activer l'option « Afficher les fichiers cachés » dans votre gestionnaire de fichiers.



## Restaurer un site sauvegardé

Vous pouvez restaurer le site que vous avez sauvegardé en utilisant le bouton « Importer » dans WordPress Playground :

![Bouton Importer](@site/static/img/import-button.png)

## Utiliser une version spécifique de WordPress ou de PHP

Le moyen le plus simple est d'utiliser le sélecteur de version sur [le site officiel de démonstration](https://playground.wordpress.net/) :

![Sélecteur de version de WordPress](@site/static/img/wp-version-switcher.png)

:::info Testez votre plugin ou votre thème

Les tests de compatibilité avec tant de versions de WordPress et de PHP ont toujours été compliqués. WordPress Playground rend ce processus sans effort - utilisez-le à votre avantage !

:::

Vous pouvez également utiliser les paramètres de requête `wp` et `php` pour ouvrir le Playground avec les bonnes versions déjà chargées :

-   https://playground.wordpress.net/?wp=6.5
-   https://playground.wordpress.net/?php=7.4
-   https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

:::info Versions majeures uniquement

Vous pouvez spécifier des versions majeures comme `wp=6.2` ou `php=8.1` et attendre la version la plus récente dans cette ligne. Vous ne pouvez cependant pas demander des versions mineures plus anciennes, donc ni `wp=6.1.2` ni `php=7.4.9` ne fonctionneront.

:::

## Importer un fichier WXR

You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php). Vous pouvez importer un fichier d'exportation WordPress en téléversant un fichier WXR dans [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

Vous pouvez également utiliser [JSON Blueprints](/blueprints). Pour en savoir plus, voir [Démarrer avec Blueprints](/blueprints/getting-started).

Cette fonction est différente de la fonction d'importation décrite ci-dessus. La fonction d'importation exporte l'ensemble du site, y compris la base de données. Cette fonction d'importation permet d'importer un fichier WXR dans un site existant.

## Créer des applications avec WordPress Playground

WordPress Playground est programmable, ce qui signifie que vous pouvez créer des applications WordPress, mettre en place des démonstrations d’extensions et même l'utiliser comme un environnement de développement local sans installation.


Pour en savoir plus sur le développement avec WordPress Playground, consultez la section [démarrage rapide de développement](/developers/build-your-first-app).T
