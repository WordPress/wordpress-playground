---
slug: /developers/limitations
description: Découvrez les limitations actuelles de WordPress Playground, notamment les comportements propres aux navigateurs, les contraintes de persistance et de récupération, les particularités des iframes et la prise en charge de WP-CLI.
---

<!-- # Limitations -->

# Limitations

<!-- WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it. -->

WordPress Playground est en développement actif et présente certaines limitations que vous devez garder à l'esprit lors de son utilisation et du développement avec celui-ci.

<!-- You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180). -->

Vous pouvez suivre l'état de ces problèmes sur le [tableau de bord du projet Playground](https://github.com/orgs/WordPress/projects/180).

<!-- ## In the browser -->

## Dans le navigateur

<!-- ### Browser storage and recovery -->

### Stockage et récupération dans le navigateur

<!-- Playground runs WordPress in the browser. New Playgrounds are autosaved when -->
<!-- browser storage and saving are available, and they appear in **Your -->
<!-- Playgrounds**. Playground keeps up to five recent autosaves. After five exist, -->
<!-- creating another deletes the oldest one. Autosaves are recovery points, not -->
<!-- long-term backups. Store an autosave permanently or export a ZIP when you want -->
<!-- to keep it. -->

Playground exécute WordPress dans le navigateur. Les nouveaux Playgrounds sont enregistrés automatiquement lorsque le stockage et l’enregistrement du navigateur sont disponibles, et ils apparaissent dans **Vos Playgrounds**. Playground conserve jusqu’à cinq sauvegardes automatiques récentes. Lorsqu’il en existe déjà cinq, la création d’une nouvelle supprime la plus ancienne. Les sauvegardes automatiques sont des points de récupération, pas des sauvegardes à long terme. Stockez-en une définitivement ou exportez un ZIP lorsque vous souhaitez la conserver.

<!-- Use these storage modes deliberately: -->

Utilisez ces modes de stockage à bon escient :

<!-- - **Autosaved**: stored in browser storage and retained only while it is one of up to five recent autosaves. -->
<!-- - **Saved**: stored permanently in browser storage or saved to a local directory. -->
<!-- - **Temporary**: created with `?storage=temp` or when saving is unavailable. It is discarded when the tab closes or the browser page refreshes. -->

- **Enregistré automatiquement** : stocké dans le navigateur et conservé uniquement tant qu’il fait partie des cinq sauvegardes automatiques récentes.
- **Enregistré** : stocké définitivement dans le navigateur ou enregistré dans un répertoire local.
- **Temporaire** : créé avec `?storage=temp` ou lorsque l’enregistrement n’est pas disponible. Il est supprimé lorsque l’onglet se ferme ou que la page du navigateur est actualisée.

<!-- The Playground **Refresh page** button reloads the WordPress page inside the current Playground. Browser refresh (Cmd+R or F5) reloads the whole Playground app. A stored or autosaved Playground can recover after that reload, but a temporary Playground cannot. -->

Le bouton **Actualiser la page** de Playground recharge la page WordPress dans le Playground actuel. L’actualisation du navigateur (Cmd+R ou F5) recharge toute l’application Playground. Un Playground stocké ou enregistré automatiquement peut être récupéré après ce rechargement, contrairement à un Playground temporaire.

<!-- ![The Dock controls for refreshing WordPress, opening storage choices, and exporting the Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp) -->

![Les commandes du Dock pour actualiser WordPress, ouvrir les options de stockage et exporter le Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp)

<!-- Browser storage still belongs to the browser. Storage pressure, private browsing, profile changes, or clearing site data can remove it. Export a ZIP when you need a portable backup. -->

Le stockage du navigateur reste sous le contrôle du navigateur. La pression de stockage, la navigation privée, les changements de profil ou l’effacement des données du site peuvent le supprimer. Exportez un ZIP lorsque vous avez besoin d’une sauvegarde portable.

<!-- ![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp) -->

![Le panneau Vos Playgrounds avec le Playground actuel](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!-- ### Browser support -->

### Compatibilité des navigateurs

<!-- WordPress Playground is designed to work across all major desktop and mobile browsers. This includes: -->

WordPress Playground est conçu pour fonctionner sur tous les principaux navigateurs de bureau et mobiles. Cela inclut :

<!-- - **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers -->
<!-- - **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants -->

- **Navigateurs de bureau** : Chrome, Firefox, Safari, Edge et autres navigateurs basés sur Chromium
- **Navigateurs mobiles** : Safari (iOS), Chrome (Android) et autres variantes de navigateurs mobiles

<!-- Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version. -->

Playground exploite les technologies web modernes et devrait fonctionner de manière cohérente dans ces environnements de navigateur. Cependant, certaines fonctionnalités avancées peuvent avoir différents niveaux de support selon le navigateur spécifique et sa version.

<!-- ### Performance expectations -->

### Attentes de performance

<!-- Loading times vary based on what Playground needs to set up: -->

Les temps de chargement varient en fonction de ce que Playground doit configurer :

<!-- ![Playground performance graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp) -->

![Graphique des performances de Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

<!-- **Factors that affect performance:** -->

**Facteurs qui affectent la performance :**

<!-- - **Plugin size**: Large plugins take longer to install at runtime -->
<!-- - **Network speed**: WASM files are 15-30MB -->
<!-- - **Device memory**: Low-memory devices may experience slowdowns -->
<!-- - **Browser**: Chrome/Edge perform best; Safari slightly slower -->

- **Taille du plugin** : Les gros plugins prennent plus de temps à s'installer à l'exécution
- **Vitesse du réseau** : Les fichiers WASM font 15-30 Mo
- **Mémoire de l'appareil** : Les appareils avec peu de mémoire peuvent connaître des ralentissements
- **Navigateur** : Chrome/Edge offrent les meilleures performances ; Safari est légèrement plus lent

<!-- <blockquote> -->
<!-- <strong>Note:</strong> Opera Mini support is not currently confirmed. -->
<!-- </blockquote> -->

<blockquote>
<!-- <strong>Note:</strong> Opera Mini support is not currently confirmed. -->
<strong>Note :</strong> Le support d'Opera Mini n'est pas actuellement confirmé.
</blockquote>

<!-- ## When developing with Playground -->

## Lors du développement avec Playground

<!-- ### Iframe quirks -->

### Particularités des iframes

<!-- Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on. -->

Playground affiche WordPress dans un [`iframe`](/developers/architecture/browser-iframe-rendering), donc cliquer sur des liens avec `target="_top"` rechargera la page sur laquelle vous travaillez.

<!-- Also, JavaScript popups originating in the `iframe` may not always display. -->

De plus, les popups JavaScript provenant de l'`iframe` peuvent ne pas toujours s'afficher.

<!-- ### Run WordPress PHP functions -->

### Exécuter des fonctions PHP WordPress

<!-- Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you'd need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php): -->

Playground prend en charge l'exécution de code PHP dans les Blueprints en utilisant l'[étape `runPHP`](/blueprints/steps#RunPHPStep). Pour exécuter des fonctions PHP spécifiques à WordPress, vous devez d'abord inclure [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php) :

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

<!-- ### Using WP-CLI -->

### Utilisation de WP-CLI

<!-- You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible. -->

Vous pouvez exécuter des commandes `wp-cli` via l'étape [`wp-cli`](/blueprints/steps#WPCLIStep) des Blueprints. Cependant, comme Playground s'exécute dans le navigateur, il ne prend pas en charge la [liste complète](https://developer.wordpress.org/cli/commands/) des commandes disponibles. Bien qu'il n'existe pas de liste définitive des commandes prises en charge, expérimenter avec [la démo en ligne](https://playground.wordpress.net/demos/wp-cli.html) vous aidera à évaluer ce qui est possible.
