---
slug: /developers/limitations
<!-- description: Learn about the current limitations of WordPress Playground, including browser-specific behaviors, temporary storage by design, iframe quirks, and WP-CLI support. -->
description: Découvrez les limitations actuelles de WordPress Playground, notamment les comportements spécifiques aux navigateurs, le stockage temporaire par conception, les particularités des iframes et le support WP-CLI.
---

<!-- # Limitations -->

# Limitations

<!-- WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it. -->

WordPress Playground est en développement actif et présente certaines limitations que vous devez garder à l'esprit lors de son utilisation et du développement avec celui-ci.

<!-- You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180). -->

Vous pouvez suivre l'état de ces problèmes sur le [tableau de bord du projet Playground](https://github.com/orgs/WordPress/projects/180).

<!-- ## In the browser -->

## Dans le navigateur

<!-- ### Temporary by design -->

### Conçu pour être temporaire

<!-- Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications. -->

Playground crée des instances WordPress fraîches à chaque chargement de page. Actualiser la page du navigateur supprime toutes les modifications de la base de données, les téléversements et les modifications.

<!-- **Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate. -->

**Pourquoi cela se produit** : Playground diffuse WordPress directement vers votre navigateur plutôt que de le servir depuis un serveur traditionnel. Chaque actualisation repart de zéro.

<!-- **To persist your work:** -->

**Pour conserver votre travail :**

<!-- - **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar. -->
<!-- - **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage -->

- **Enregistrer** : Activez le stockage du navigateur via le bouton "Enregistrer" (en haut à droite, à côté de la barre d'adresse), avant d'actualiser la page via la barre du navigateur.
- **Pour le développement** : Utilisez [Playground CLI](/developers/local-development/wp-playground-cli) qui prend en charge le stockage local persistant

<!-- :::tip -->
<!-- The dedicated refresh button inside Playground only reloads WordPress content—it preserves your PHP/WP state. The browser's refresh button (F5 or Cmd+R) destroys the entire instance. -->
<!-- ::: -->

:::tip
Le bouton d'actualisation dédié dans Playground ne recharge que le contenu WordPress—il préserve votre état PHP/WP. Le bouton d'actualisation du navigateur (F5 ou Cmd+R) détruit l'instance entière.
:::

![Refresh Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<blockquote>
<figure>
<!-- <figcaption><i>1. Exporting Playground:</i></figcaption> -->
<figcaption><i>1. Exportation de Playground :</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

</figure>

<figure>
<!-- <figcaption><i>2. Save button:</i></figcaption> -->
<figcaption><i>2. Bouton Enregistrer :</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

</figure>
</blockquote>

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

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

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
