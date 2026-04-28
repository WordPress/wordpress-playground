---
title: Dépanner et déboguer
slug: /blueprints/troubleshoot-and-debug
description: Un guide avec des conseils et des outils pour vous aider à dépanner et déboguer vos Blueprints, des problèmes courants aux outils du navigateur.
---

<!--
title: Troubleshoot and debug
description: A guide with tips and tools to help you troubleshoot and debug your Blueprints, from common issues to browser tools.
-->

<!--
# Troubleshoot and debug Blueprints
-->

# Dépanner et déboguer les Blueprints

<!--
When you build Blueprints, you might run into issues. Here are tips and tools to help you debug them:
-->

Lorsque vous créez des Blueprints, vous pouvez rencontrer des problèmes. Voici des conseils et des outils pour vous aider à les déboguer :

<!--
## Review Common gotchas
-->

## Vérifier les pièges courants

<!--
- Require `wp-load`: to run a WordPress PHP function using the `runPHP` step, you’d need to require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). So, the value of the `code` key should start with `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`.
-->

- Requérir `wp-load` : pour exécuter une fonction PHP de WordPress avec l’étape `runPHP`, vous devez requérir [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). La valeur de la clé `code` doit donc commencer par `"<?php require_once('wordpress/wp-load.php'); LE_RESTE_DE_VOTRE_CODE"`.

<!--
## Common Issues and Solutions
-->

## Problèmes courants et solutions

<!--
### Invalid Blueprint After Opening a Link
-->

### Blueprint non valide après l’ouverture d’un lien

<!--
If Playground reports `Invalid blueprint`, read the detailed error message. It includes the underlying JSON parsing error when one is available.
-->

Si Playground indique `Invalid blueprint`, lisez le message d’erreur détaillé. Il inclut l’erreur d’analyse JSON sous-jacente lorsqu’elle est disponible.

<!--
If the message says the input still contains `%XX` escapes after decoding, the URL fragment was likely double-encoded. Rebuild the link from the original Blueprint object and encode it once with `encodeURIComponent(JSON.stringify(blueprint))`, or use Base64. Do not encode a fragment that is already encoded.
-->

Si le message indique que l’entrée contient encore des échappements `%XX` après le décodage, le fragment d’URL a probablement été encodé deux fois. Reconstruisez le lien depuis l’objet Blueprint d’origine et encodez-le une seule fois avec `encodeURIComponent(JSON.stringify(blueprint))`, ou utilisez Base64. N’encodez pas un fragment qui est déjà encodé.

<!--
### WP-CLI: Error Establishing a Database Connection on Mounted Sites
-->

### WP-CLI : erreur lors de l’établissement d’une connexion à la base de données sur les sites montés {#wp-cli-error-establishing-a-database-connection-on-mounted-sites}

<!--
When using `wp-cli` with a mounted Playground site (e.g., via `--mount-before-install`), you might encounter an "Error establishing a database connection." This happens because WordPress Playground loads the SQLite database integration plugin from its internal files by default, not from the mounted directory, meaning it's not persisted for external `wp-cli` calls.
-->

Lorsque vous utilisez `wp-cli` avec un site Playground monté (par exemple avec `--mount-before-install`), vous pouvez rencontrer une erreur « Error establishing a database connection ». Cela se produit parce que WordPress Playground charge par défaut l’extension d’intégration de base de données SQLite depuis ses fichiers internes, et non depuis le répertoire monté, ce qui signifie qu’elle n’est pas conservée pour les appels externes à `wp-cli`.

<!--
To resolve this, you need to explicitly install and configure the SQLite database integration plugin within your Blueprint.
-->

Pour résoudre ce problème, vous devez installer et configurer explicitement l’extension d’intégration de base de données SQLite dans votre Blueprint.

<!--
**Solution:** Add the following steps to your Blueprint:
-->

**Solution :** ajoutez les étapes suivantes à votre Blueprint :

```json
{
	"plugins": ["sqlite-database-integration"]
}
```

<!--
**Example Usage:**
-->

**Exemple d’utilisation :**

<!--
To test this locally, combine the Blueprint with your Playground CLI command:
-->

Pour tester cela localement, combinez le Blueprint avec votre commande Playground CLI :

```bash
mkdir wordpress
# Ensure your blueprint with the above steps is saved as, for example, './blueprint.json'
npx @wp-playground/cli server --mount-before-install=wordpress:/wordpress --blueprint=./blueprint.json
cd wordpress
wp post list
```

<!--
This will ensure the SQLite plugin is installed correctly and configured within your mounted WordPress site, allowing `wp-cli` commands to function correctly.
-->

Cela garantit que l’extension SQLite est installée correctement et configurée dans votre site WordPress monté, ce qui permet aux commandes `wp-cli` de fonctionner correctement.

<!--
## Blueprints Builder
-->

## Générateur de Blueprints

<!--
You can use an in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to build, validate, and preview your Blueprints in the browser.
-->

Vous pouvez utiliser un [éditeur de Blueprints](https://playground.wordpress.net/builder/builder.html) dans le navigateur pour créer, valider et prévisualiser vos Blueprints.

:::danger Attention

<!--
The editor is under development and the embedded Playground sometimes fails to load. To get around it, refresh the page. We're aware of that, and are working to improve the experience.
-->

L’éditeur est en cours de développement et le Playground intégré ne se charge pas toujours. Pour contourner le problème, actualisez la page. Nous en sommes conscients et travaillons à améliorer l’expérience.

:::

<!--
## Check for the Filesystem and Database
-->

## Vérifier le système de fichiers et la base de données

<!--
Some blueprint steps (such as [`writeFile`](/blueprints/steps#WriteFileStep)) alter the internal Filesystem structure of the Playground instance and some others (such as [`runSql`](/blueprints/steps#runSql)) alter the internal WordPress database.
-->

Certaines étapes de Blueprint (comme [`writeFile`](/blueprints/steps#WriteFileStep)) modifient la structure interne du système de fichiers de l’instance Playground, et d’autres (comme [`runSql`](/blueprints/steps#runSql)) modifient la base de données WordPress interne.

<!--
To check the final internal filesystem structure and database (after the blueprint steps have been applied) we can leverage some WordPress plugins that provide a SQL manager and a file explorer such as [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and [`WPide`](https://wordpress.org/plugins/wpide/) (you can see them in action from https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide)
-->

Pour vérifier la structure finale du système de fichiers interne et de la base de données (après l’application des étapes du Blueprint), nous pouvons utiliser des extensions WordPress qui fournissent un gestionnaire SQL et un explorateur de fichiers, comme [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) et [`WPide`](https://wordpress.org/plugins/wpide/) (vous pouvez les voir en action depuis https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide).

:::tip

<!--
There are a bunch of methods we can launch from the console of any WordPress Playground instance to inspect the internals of that instance. They're exposed as part of `window.playground` object (see [Developers > JavaScript API > Debugging and testing](/developers/apis/javascript-api/#debugging-and-testing)). Some examples:
-->

Plusieurs méthodes peuvent être lancées depuis la console de n’importe quelle instance WordPress Playground pour en inspecter les éléments internes. Elles sont exposées dans l’objet `window.playground` (voir [Développeurs > API JavaScript > Débogage et tests](/developers/apis/javascript-api/#debugging-and-testing)). Quelques exemples :

```
> await playground.isDir("/wordpress/wp-content/plugins")
true
> await playground.listFiles("/wordpress/wp-content/plugins")
(3) ['hello.php', 'index.php', 'WordPress-Importer-master']
```

<!--
Full list of methods we can use is available [here](/api/client/interface/PlaygroundClient)
-->

La liste complète des méthodes que nous pouvons utiliser est disponible [ici](/api/client/interface/PlaygroundClient).

:::

<!--
## Check for errors in the browser console
-->

## Vérifier les erreurs dans la console du navigateur

<!--
If your Blueprint isn’t running as expected, open the browser developer tools to check for any errors.
-->

Si votre Blueprint ne s’exécute pas comme prévu, ouvrez les outils de développement du navigateur pour vérifier les erreurs.

<!--
To open the developer tools in Chrome, Firefox, Safari\*, and Edge: press `Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.
-->

Pour ouvrir les outils de développement dans Chrome, Firefox, Safari\* et Edge : appuyez sur `Ctrl + Shift + I` sous Windows/Linux ou sur `Cmd + Option + I` sous macOS.

:::caution

<!--
If you haven't yet, enable the Develop menu: go to **Safari > Settings... > Advanced** and check **Show features for web developers**.
-->

Si ce n’est pas encore fait, activez le menu Développement : allez dans **Safari > Réglages... > Avancé** et cochez **Afficher les fonctionnalités pour les développeurs web**.

:::

<!--
The developer tools window allows you to inspect network requests, view console logs, debug JavaScript, and examine the DOM and CSS styles applied to your webpage. This is crucial for diagnosing and fixing issues with Blueprints.
-->

La fenêtre des outils de développement vous permet d’inspecter les requêtes réseau, de consulter les journaux de console, de déboguer JavaScript et d’examiner le DOM ainsi que les styles CSS appliqués à votre page. C’est essentiel pour diagnostiquer et corriger les problèmes avec les Blueprints.

<!--
## Log your own error messages
-->

## Journaliser vos propres messages d’erreur

<!--
You can `error_log` your own error messages through [`runPHP` step](/blueprints/steps#RunPHPStep) (see [blueprint example](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) and check them from the ["View Logs" option](/web-instance#playground-options-menu) or from the browser's console.
-->

Vous pouvez journaliser vos propres messages d’erreur avec `error_log` via l’[étape `runPHP`](/blueprints/steps#RunPHPStep) (voir l’[exemple de Blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) et la [démo en direct](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) puis les consulter depuis l’option ["View Logs"](/web-instance#playground-options-menu) ou depuis la console du navigateur.

<!--
![Log errors snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)
-->

![Capture des erreurs journalisées](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)

:::info

<!--
When you download your Playground instance as a `zip` through the ["Download as zip" option](/web-instance#playground-options-menu) you'll also download the `debug.log` file containing all the logs from your Playground instance.
-->

Lorsque vous téléchargez votre instance Playground sous forme de `zip` avec l’option ["Download as zip"](/web-instance#playground-options-menu), vous téléchargez aussi le fichier `debug.log` qui contient tous les journaux de votre instance Playground.

:::

<!--
## Ask for help
-->

## Demander de l’aide

<!--
The community is here to help! If you have questions or comments, [open a new issue](https://github.com/adamziel/blueprints/issues) in this repository. Remember to include the following details:
-->

La communauté est là pour aider. Si vous avez des questions ou des commentaires, [ouvrez une nouvelle issue](https://github.com/adamziel/blueprints/issues) dans ce dépôt. Pensez à inclure les informations suivantes :

<!--
- The Blueprint you’re trying to run.
- The error message you’re seeing, if any.
- The full output from the browser developer tools.
- Any other relevant information that might help us understand the issue: OS, browser version, etc.
-->

- Le Blueprint que vous essayez d’exécuter.
- Le message d’erreur que vous voyez, le cas échéant.
- La sortie complète des outils de développement du navigateur.
- Toute autre information pertinente qui pourrait nous aider à comprendre le problème : système d’exploitation, version du navigateur, etc.
