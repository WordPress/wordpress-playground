---
slug: /developers/limitations
description: Découvrez les limitations actuelles de WordPress Playground, notamment les comportements propres aux navigateurs, le stockage temporaire voulu, les particularités des iframes et la prise en charge de WP-CLI.
---

<!--
description: Learn about the current limitations of WordPress Playground, including browser-specific behaviors, temporary storage by design, iframe quirks, and WP-CLI support.
-->

# Limitations

<!--
# Limitations
-->

WordPress Playground est en développement actif et présente certaines limitations à garder à l’esprit lorsque vous l’utilisez.

<!--
WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it.
-->

Vous pouvez suivre l’état de ces sujets sur le [tableau du projet Playground](https://github.com/orgs/WordPress/projects/180).

<!--
You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180).
-->

## Dans le navigateur {#in-the-browser}

<!--
## In the browser {#in-the-browser}
-->

### Conçu pour être temporaire {#temporary-by-design}

<!--
### Temporary by design {#temporary-by-design}
-->

Playground crée à chaque chargement de page des instances WordPress neuves. Actualiser la page du navigateur supprime toutes les modifications de la base de données, les téléversements et les autres changements.

<!--
Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications.
-->

**Pourquoi c’est ainsi** : Playground diffuse WordPress directement vers votre navigateur plutôt que de le servir depuis un serveur classique. Chaque actualisation repart de zéro.

<!--
**Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate.
-->

**Pour conserver votre travail :**

<!--
**To persist your work:**
-->

- **Enregistrer** : activez le stockage du navigateur via le bouton « Save » (en haut à droite, à côté de la barre d’adresse) avant d’actualiser la page avec la barre du navigateur.
- **Pour le développement** : utilisez [Playground CLI](/developers/local-development/wp-playground-cli), qui prend en charge un stockage local persistant

<!--
- **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar.
- **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage
-->

:::tip
Le bouton d’actualisation dédié dans Playground ne recharge que le contenu WordPress — il préserve votre état PHP/WP. Le bouton d’actualisation du navigateur (F5 ou Cmd+R) détruit toute l’instance.
:::

<!--
:::tip
The dedicated refresh button inside Playground only reloads WordPress content—it preserves your PHP/WP state. The browser's refresh button (F5 or Cmd+R) destroys the entire instance.
:::
-->

![Bouton Actualiser Playground](@site/static/img/refresh-playground-button.webp)

<!--
![Refresh Playground Button](@site/static/img/refresh-playground-button.webp)
-->

<blockquote>
<figure>
<figcaption><i>1. Exporter Playground :</i></figcaption>

<!--
<figcaption><i>1. Exporting Playground:</i></figcaption>
-->

![Save Button](@site/static/img/export-playground.webp)

</figure>

<figure>
<figcaption><i>2. Bouton Save :</i></figcaption>

<!--
<figcaption><i>2. Save button:</i></figcaption>
-->

![Save Button](@site/static/img/saving-playground.webp)

</figure>
</blockquote>

### Compatibilité des navigateurs {#browser-support}

<!--
### Browser support {#browser-support}
-->

WordPress Playground est pensé pour fonctionner sur les principaux navigateurs de bureau et mobiles. Cela inclut :

<!--
WordPress Playground is designed to work across all major desktop and mobile browsers. This includes:
-->

- **Navigateurs de bureau** : Chrome, Firefox, Safari, Edge et autres navigateurs basés sur Chromium
- **Navigateurs mobiles** : Safari (iOS), Chrome (Android) et autres variantes

<!--
- **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers
- **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants
-->

Playground s’appuie sur des technologies web récentes et doit se comporter de façon cohérente dans ces environnements. Toutefois, certaines fonctionnalités avancées peuvent être prises en charge différemment selon le navigateur et sa version.

<!--
Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version.
-->

### Attentes en matière de performances {#performance-expectations}

<!--
### Performance expectations {#performance-expectations}
-->

Les temps de chargement varient selon ce que Playground doit mettre en place :

<!--
Loading times vary based on what Playground needs to set up:
-->

| Scénario                                        | Temps de chargement typique           |
| ----------------------------------------------- | ------------------------------------- |
| WordPress seul (sans extensions)                | 5 à 10 secondes                       |
| Avec de petites extensions                      | 10 à 20 secondes                      |
| Avec de grosses extensions (p. ex. WooCommerce) | 30 à 60 secondes                      |
| Sur appareils mobiles                           | 1,5 à 2× plus lent que sur ordinateur |

<!--
| Scenario                               | Typical Load Time          |
| -------------------------------------- | -------------------------- |
| Fresh WordPress (no plugins)           | 5-10 seconds               |
| With small plugins                     | 10-20 seconds              |
| With large plugins (e.g., WooCommerce) | 30-60 seconds              |
| On mobile devices                      | 1.5-2x slower than desktop |
-->

![Save Button](@site/static/img/playground-performance-graph.webp)

<!--
![Save Button](@site/static/img/playground-performance-graph.webp)
-->

**Facteurs qui influencent les performances :**

<!--
**Factors that affect performance:**
-->

- **Taille des extensions** : les grosses extensions mettent plus longtemps à s’installer à l’exécution
- **Débit réseau** : les fichiers WASM font environ 5 à 15 Mo par version de PHP (réduits nettement grâce à l’optimisation de compilation `MAIN_MODULE=2`)
- **Mémoire de l’appareil** : l’allocation mémoire WASM initiale est de 64 Mo, puis augmente dynamiquement si besoin. Les appareils peu dotés en mémoire peuvent ralentir
- **Navigateur** : Chrome et Edge offrent en général les meilleures performances ; Safari est légèrement plus lent

<!--
- **Plugin size**: Large plugins take longer to install at runtime
- **Network speed**: WASM files are approximately 5-15MB per PHP version (reduced significantly by the MAIN_MODULE=2 build optimization)
- **Device memory**: Initial WASM memory allocation is 64MB, growing dynamically as needed. Low-memory devices may experience slowdowns
- **Browser**: Chrome/Edge perform best; Safari slightly slower
-->

<blockquote>
<strong>Note :</strong> la prise en charge d’Opera Mini n’est pas confirmée pour l’instant.
</blockquote>

<!--
<blockquote>
<strong>Note:</strong> Opera Mini support is not currently confirmed.
</blockquote>
-->

## Lors du développement avec Playground {#when-developing-with-playground}

<!--
## When developing with Playground {#when-developing-with-playground}
-->

### Particularités des iframes {#iframe-quirks}

<!--
### Iframe quirks {#iframe-quirks}
-->

Playground affiche WordPress dans un [`iframe`](/developers/architecture/browser-iframe-rendering) : cliquer sur des liens avec `target="_top"` recharge donc la page sur laquelle vous travaillez.

<!--
Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on.
-->

De plus, les fenêtres popup JavaScript issues de l’`iframe` ne s’affichent pas toujours.

<!--
Also, JavaScript popups originating in the `iframe` may not always display.
-->

### Exécuter des fonctions PHP WordPress {#run-wordpress-php-functions}

<!--
### Run WordPress PHP functions {#run-wordpress-php-functions}
-->

Playground permet d’exécuter du code PHP dans les Blueprints via l’[étape `runPHP`](/blueprints/steps#RunPHPStep). Pour appeler des fonctions PHP propres à WordPress, il faut d’abord inclure [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php) :

<!--
Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you'd need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):
-->

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

### Utilisation de WP-CLI {#using-wp-cli}

<!--
### Using WP-CLI {#using-wp-cli}
-->

Vous pouvez exécuter des commandes `wp-cli` via l’[étape `wp-cli`](/blueprints/steps#WPCLIStep) des Blueprints. Comme Playground s’exécute dans le navigateur, il ne prend pas en charge la [totalité](https://developer.wordpress.org/cli/commands/) des commandes disponibles. Il n’existe pas de liste officielle des commandes prises en charge ; tester [la démo en ligne](https://playground.wordpress.net/demos/wp-cli.html) permet d’en juger.

<!--
You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible.
-->

Avec [Playground CLI](/developers/local-development/wp-playground-cli), la commande `php` offre une prise en charge complète de WP-CLI en exécutant les scripts directement sur le runtime PHP WASM.

<!--
When using the [Playground CLI](/developers/local-development/wp-playground-cli), the `php` command provides full WP-CLI support by running scripts directly against the WASM PHP runtime.
-->

## Améliorations récentes {#recent-improvements}

<!--
## Recent improvements {#recent-improvements}
-->

Plusieurs limitations antérieures ont été levées dans des versions récentes :

<!--
Several previous limitations have been addressed in recent releases:
-->

- **Téléchargements de fichiers volumineux (>2 Go)** : les exportations et téléchargements sont désormais diffusés en flux direct plutôt qu’en mémoire tampon, ce qui permet d’exporter des sites volumineux (p. ex. sauvegardes All-in-One WP Migration) qui échouaient auparavant.
- **Téléversements de fichiers cURL en PHP** : les envois de formulaires multipart via `CURLFile` fonctionnent correctement dans le navigateur. Le blocage lié à `Expect: 100-continue` et les problèmes de transmission multipart via le proxy CORS sont résolus.
- **Réponses PHP longues** : le service worker diffuse désormais les réponses PHP au lieu de les mettre en mémoire tampon, ce qui supprime le délai d’expiration de 25 secondes qui faisait échouer les importations de site et d’autres opérations longues.
- **Gestion des erreurs de téléchargement** : en cas d’échec du téléchargement de WASM ou de scripts (réseau, bloqueur de publicités, etc.), Playground affiche une boîte d’erreur utile au lieu d’une page vide.

<!--
- **Large file downloads (>2GB)**: File exports and downloads now stream directly instead of buffering in memory, enabling large site exports (e.g., All-in-One WP Migration backups) that previously failed.
- **PHP curl file uploads**: Multipart form uploads via `CURLFile` now work correctly in the browser. The `Expect: 100-continue` deadlock and CORS proxy multipart forwarding issues have been resolved.
- **Long-running PHP responses**: The service worker now streams PHP responses instead of buffering them, eliminating the 25-second timeout that previously caused site imports and other long-running operations to fail.
- **Download error handling**: When WASM or script downloads fail (due to network issues, ad blockers, etc.), Playground now displays a helpful error modal instead of a blank page.
-->
