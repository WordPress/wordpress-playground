---
title: À propos de WordPress Playground
slug: /about
description: Un aperçu du Playground de WordPress, expliquant de quoi il s’agit, pourquoi il est utile et comment il exécute WordPress dans votre navigateur.
---

<!-- # About WordPress Playground -->

# À propos de WordPress Playground

<!-- ## What is WordPress Playground? -->

## WordPress Playground, qu’est-ce que c’est ?

<!--
**WordPress Playground is the platform that lets you run WordPress instantly on any device without a host**. It allows you to experiment and learn about WordPress without affecting your live website. It's a virtual sandbox where you can play around with different features, designs, and settings in a safe and controlled environment.
-->

**WordPress Playground est une plateforme qui vous permet d’exécuter WordPress instantanément sur n’importe quel appareil sans hébergeur**. Elle vous permet d’expérimenter et d’apprendre à connaître WordPress sans affecter le site sur lequel vous travaillez. C’est un bac à sable virtuel (sandbox) où vous pouvez jouer avec différentes fonctionnalités, conceptions et réglages dans un environnement sécurisé et contrôlé.

WordPress Playground est le parfait endroit où vous pouvez construire, tester, et lancer :

- WordPress Playground is your place to build, test, and launch: -->
- [Construire](/about/build) : WP Playground peut vous aider à construire des produits avec WordPress. Utilisez-le là où vous êtes le plus à l’aise, que ce soit dans votre navigateur, avec Node.js, avec des applications mobile, à l’aide de VS Code, ou ailleurs.
- [Tester](/about/test) : améliorez votre processus d’assurance qualité avec WP Playground. Testez rapidement vos extensions ou thèmes, expérimentez dans un bac à sable privé (sandbox), et créez des PRs (Pull Requests) depuis votre instance WP Playground vers n’importe quel répertoire.
- [Lancer](/about/launch) : utilisez WP Playground pour présenter votre produit, permettre aux utilisateurs et utilisatrices de l’essayer en direct ou le lancer sur l’App Store sans délai.

<!--
-   [Build](/about/build): WordPress Playground can help you to build products with WordPress. Use it from where you work best, whether that’s in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-   [Test](/about/test): Upgrade your QA process with WordPress Playground. Quickly test your plugins or themes, experiment in a private sandbox, and create PRs from your WP Playground instance to any repo.
-   [Launch](/about/launch): Use WordPress Playground to showcase your product, let users try it live, or launch it in the App Store with zero lead time.
-->

<!-- ## Why WordPress Playground? -->

## Pourquoi WordPress Playground ?

<!-- ### Try themes and plugins on the fly -->

### Tester des thèmes et des extensions à la volée

Avec le Playground de WordPress, vous pouvez explorer n’importe quel [thème](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/). Vous pouvez choisir parmi un large éventail de thèmes et tester le rendu sur votre site. Vous pouvez également modifier les couleurs, les polices, les mises en page et d’autres éléments visuels pour créer un design unique.

En plus des thèmes, vous pouvez également expérimenter avec des extensions. Avec Playground, vous pouvez installer et tester différentes extensions pour voir comment elles fonctionnent et ce qu’elles peuvent faire pour votre site. Cela vous permet d’explorer et de comprendre les possibilités de WordPress sans vous soucier de casser quoi que ce soit.

<!--
With WordPress Playground, you can explore any [theme](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/). You can choose from a wide range of themes and see how they look on your site. You can also modify the colors, fonts, layouts, and other visual elements to create a unique design.

In addition to themes, you can experiment with plugins too. With WordPress Playground, you can install and test different plugins to see how they work and what they can do for your site. This allows you to explore and understand the capabilities of WordPress without worrying about breaking anything.
-->

### Créez du contenu à la volée

<!-- ### Create content on the go -->

Une autre excellente fonctionnalité de WordPress Playground est la possibilité de créer et de modifier du contenu. Vous pouvez écrire des articles de blog, créer des pages et ajouter des médias comme des images et des vidéos à votre site. Cela vous aide à comprendre comment organiser et structurer efficacement votre contenu.

<!-- Another great feature of WordPress Playground is the ability to create and edit content. You can write blog posts, create pages, and add media like images and videos to your site. This helps you understand how to organize and structure your content effectively. -->

Le contenu que vous créez est limité à Playground sur votre appareil et disparaît lorsque vous le quittez, vous êtes donc libre d’explorer et de jouer sans risquer de casser un site réel.

<!-- The content you create is limited to the Playground on your device and disappears once you leave it, so you are free to explore and play without risking breaking any actual site. -->

Mais attendez ! Vous pouvez également connecter votre instance Playground à un dépôt GitHub et créer un PR (Pull Request) pour faire persister ces modifications.

<!-- But hey! You can also connect your Playground instance to a GitHub repo and create a PR to persist those changes. -->

### C’est super sûr

<!-- ### It's super safe -->

Dans l’ensemble, WordPress Playground fournit un environnement sans risque pour les débutants et permet d’apprendre et d’acquérir une expérience pratique avec WordPress. Il vous aide à gagner en confiance et en connaissances avant d’apporter des modifications à votre site en direct.

<!-- Overall, WordPress Playground provides a risk-free environment for beginners to learn and get hands-on experience with WordPress. It helps you to gain confidence and knowledge before making changes to your live website. -->

<div class="callout callout-tip">

Consultez la [section guides](/guides) pour en savoir plus sur la façon d’utiliser WordPress Playground pour tester vos thèmes et extensions et créer du contenu à la volée.

</div>
<!-- Check the [guides section](/guides) to learn more about how to leverage WordPress Playground to test your themes and plugins and create content on the fly. -->
 
## Comment fonctionne WordPress Playground ?
<!-- ## How does WordPress Playground work? -->

Lorsque vous commencez à utiliser Playground pour la première fois, vous recevrez un espace dédié où vous pouvez créer et personnaliser votre propre site WordPress. Cet espace est complètement isolé de votre site réel.

<!-- When you first start using WordPress Playground, you'll be provided with a separate space where you can create and customise your own WordPress website. This space is completely isolated from your actual website. -->

### Streamé, non hébergé

<!-- ### Streamed, not served. -->

Le WordPress que vous voyez lorsque vous ouvrez Playground dans votre navigateur est un WordPress qui devrait fonctionner comme n’importe quel WordPress, avec [quelques limitations](/developers/limitations) et l’exception importante qu’il ne s’agit pas d’un serveur permanent avec une adresse internet, ce qui limitera les connexions à certains services tiers (automatisation, partage, analyse, e-mail, sauvegardes, etc.) de manière persistante.

<!--
The WordPress you see when you open Playground in your browser is a WordPress that should function like any WordPress, with [a few limitations](/developers/limitations) and the important exception that it's not a permanent server with an internet address which will limit connections to some third-party services (automation, sharing, analysis, email, backups, etc.) in a persistent way.
-->

L’écran de chargement et la barre de progression que vous voyez sur Playground symbolisent à la fois le streaming de ces technologies fondamentales vers votre navigateur, mais aussi les étapes de configuration à partir de [WordPress Blueprints](/blueprints) (voir [examples](/blueprints/examples)), afin qu’un serveur complet, le logiciel WordPress, les thèmes et extensions et les instructions de configuration puissent être préparés et diffusés en direct.

<!--
The loading screen and progress bar you see on Playground includes both the streaming of those foundational technologies to your browser and configuration steps from [WordPress Blueprints](/blueprints) (see [examples](/blueprints/examples)), so that a full server, WordPress software, Theme & Plugin solutions and configuration instructions can be streamed over-the-wire.
-->

## Qu’est-ce qui différencie Playground de l’exécution de WordPress sur un serveur web ou une application de bureau locale ?

<!-- ## What makes Playground different from running WordPress on a web server or local desktop app? -->

Les applications web comme WordPress s’appuient depuis longtemps sur des technologies serveur pour [exécuter la logique](/developers/architecture/wasm-php-overview) et [stocker les données](/developers/architecture/wordpress#sqlite).

<!-- Web applications like WordPress have long relied on server technologies [to run logic](/developers/architecture/wasm-php-overview) and [store data](/developers/architecture/wordpress#sqlite). -->

L’utilisation de ces technologies implique soit d’exécuter un serveur web connecté à internet, soit d’utiliser ces technologies dans un service ou une app (parfois appelé « environnement local WordPress ») qui s’appuie soit sur un serveur virtuel avec les technologies installées, soit sur les technologies sous-jacentes sur l’appareil actuel.

<!-- Using those technologies has meant either running a web server connected to the internet or using those technologies in a desktop service or app (sometimes called a "WordPress local environment") that either leans on a virtual server with the technologies installed or the underlying technologies on the current device. -->

Playground est une nouvelle façon de diffuser des technologies serveur - y compris WordPress (et WP-CLI) - sous forme de fichiers qui peuvent ensuite s’exécuter dans le navigateur.

<!-- Playground is a novel way to stream server technologies—including WordPress (and WP-CLI)—as files that can then run in the browser.
 -->
<div class="callout callout-info">

Traduction par [@francoist](https://profiles.wordpress.org/francoist/)
et relecture par [@jdy68](https://profiles.wordpress.org/jdy68/)

Dernière relecture le 22 janvier 2026

</div>
