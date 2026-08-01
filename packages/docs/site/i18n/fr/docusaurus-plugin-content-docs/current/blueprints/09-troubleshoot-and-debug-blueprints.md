---
title: Dépanner et déboguer
slug: /blueprints/troubleshoot-and-debug
description: Un guide consultable des erreurs courantes de Blueprint, notamment les échecs de récupération, les erreurs de validation, les échecs PHP et les problèmes d’activation d’extensions.
---

<!-- title: Troubleshoot and debug -->

<!-- description: A searchable guide to common Blueprint errors, including fetch failures, validation errors, PHP failures, and plugin activation issues. -->

<!-- # Troubleshoot and debug Blueprints -->

# Dépanner et déboguer les Blueprints

<!-- Blueprint errors usually point to one of three places: -->

Les erreurs de Blueprint pointent généralement vers l’un de ces trois endroits :

<!--
- The Blueprint JSON is invalid.
- Playground could not fetch the Blueprint or one of its resources.
- A Blueprint step ran, but WordPress, PHP, WP-CLI, or a plugin failed.
-->

- Le JSON du Blueprint n’est pas valide.
- Playground n’a pas pu récupérer le Blueprint ou l’une de ses ressources.
- Une étape du Blueprint s’est exécutée, mais WordPress, PHP, WP-CLI ou une extension a échoué.

<!--
Start with the exact error name shown by Playground, then use the matching
section below.
-->

Commencez par le nom d’erreur exact affiché par Playground, puis utilisez la
section correspondante ci-dessous.

<!-- ## Quick checklist -->

## Liste de vérification rapide

<!--
- Paste the Blueprint into the [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to validate the JSON schema.
- If the Blueprint is loaded from a URL, open that URL directly in a private browser window and confirm it downloads valid JSON or a Blueprint ZIP bundle.
- If a step fails, note the step number in `BlueprintStepExecutionError`. The failed step is usually the item at that position after Blueprint shorthands have been expanded.
- Open browser developer tools and check the Console and Network tabs for download, CORS, PHP, or plugin activation details.
- For plugin/theme activation failures, check the Playground **Logs** panel or the browser console for PHP warnings and fatal errors.
-->

- Collez le Blueprint dans l’[éditeur de Blueprints](https://playground.wordpress.net/builder/builder.html) pour valider le schéma JSON.
- Si le Blueprint est chargé depuis une URL, ouvrez cette URL directement dans une fenêtre de navigation privée et confirmez qu’elle télécharge du JSON valide ou un bundle ZIP de Blueprint.
- Si une étape échoue, notez son numéro dans `BlueprintStepExecutionError`. L’étape échouée est généralement l’élément à cette position après le développement des raccourcis de Blueprint.
- Ouvrez les outils de développement du navigateur et consultez les onglets Console et Network pour obtenir des détails sur le téléchargement, CORS, PHP ou l’activation d’extensions.
- Pour les échecs d’activation d’extension ou de thème, consultez le panneau **Logs** de Playground ou la console du navigateur pour les avertissements PHP et les erreurs fatales.

<!-- ## InvalidBlueprintError -->

## InvalidBlueprintError

<!--
`InvalidBlueprintError` means the Blueprint does not match the
[Blueprint data format](/blueprints/data-format). The error output usually
contains paths such as `/steps/2/pluginData` or `/preferredVersions`.
-->

`InvalidBlueprintError` signifie que le Blueprint ne correspond pas au
[format de données Blueprint](/blueprints/data-format). La sortie d’erreur
contient généralement des chemins comme `/steps/2/pluginData` ou
`/preferredVersions`.

<!-- ### Unexpected property `activate` -->

### Propriété inattendue `activate`

<!--
`activate` belongs inside `options`, not directly on the step or inside
`pluginData`.
-->

`activate` doit se trouver dans `options`, pas directement sur l’étape ni dans
`pluginData`.

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	},
	"options": {
		"activate": true
	}
}
```

<!-- ### Unexpected property `plugins` in `preferredVersions` -->

### Propriété inattendue `plugins` dans `preferredVersions`

<!--
`preferredVersions` only accepts `php` and `wp`. Install plugins with the
top-level `plugins` shorthand or with an explicit `installPlugin` step.
-->

`preferredVersions` accepte uniquement `php` et `wp`. Installez les extensions
avec le raccourci de premier niveau `plugins` ou avec une étape explicite
`installPlugin`.

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"]
}
```

<!-- ### Missing `slug`, `url`, `path`, or `files` -->

### `slug`, `url`, `path` ou `files` manquant

<!-- The resource object is incomplete or uses the wrong shape. Common fixes: -->

L’objet de ressource est incomplet ou utilise une forme incorrecte. Corrections
courantes :

<!--
- WordPress.org plugin: `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`
- ZIP URL: `{ "resource": "url", "url": "https://example.com/plugin.zip" }`
- Git directory: `{ "resource": "git:directory", "url": "https://github.com/org/repo", "ref": "trunk", "refType": "branch" }`
-->

- Extension WordPress.org : `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`
- URL ZIP : `{ "resource": "url", "url": "https://example.com/plugin.zip" }`
- Répertoire Git : `{ "resource": "git:directory", "url": "https://github.com/org/repo", "ref": "trunk", "refType": "branch" }`

<!--
See [Resources References](/blueprints/steps/resources) for all supported
resource shapes.
-->

Consultez les [références des ressources](/blueprints/steps/resources) pour
voir toutes les formes de ressource prises en charge.

<!-- ### Mixed plugin install properties -->

### Propriétés d’installation d’extension mélangées

<!--
Use `pluginData` for `installPlugin`. Do not provide both `pluginData` and
older examples or custom objects such as `pluginZipFile`.
-->

Utilisez `pluginData` pour `installPlugin`. Ne fournissez pas à la fois
`pluginData` et d’anciens exemples ou objets personnalisés comme
`pluginZipFile`.

<!-- The WordPress.org plugin resource also needs a separate `slug`: -->

La ressource d’extension WordPress.org nécessite aussi un `slug` séparé :

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	}
}
```

<!-- Do not write `"resource": "wordpress.org/plugins/woocommerce"`. -->

N’écrivez pas `"resource": "wordpress.org/plugins/woocommerce"`.

<!-- ## BlueprintFetchError -->

## BlueprintFetchError

<!--
`BlueprintFetchError` means Playground could not load the file passed to
`?blueprint-url=`.
-->

`BlueprintFetchError` signifie que Playground n’a pas pu charger le fichier
passé à `?blueprint-url=`.

<!-- Check that the URL: -->

Vérifiez que l’URL :

<!--
- Is public and does not require cookies, login, a temporary session, or a VPN.
- Returns HTTP 200 when opened directly.
- Serves valid JSON or a ZIP bundle with `blueprint.json` inside it.
- Sends `Access-Control-Allow-Origin: *` or another header that allows
  `https://playground.wordpress.net`.
- Uses a raw file URL, not a repository HTML page.
-->

- Est publique et ne nécessite pas de cookies, de connexion, de session temporaire ni de VPN.
- Renvoie HTTP 200 lorsqu’elle est ouverte directement.
- Sert du JSON valide ou un bundle ZIP avec `blueprint.json` à l’intérieur.
- Envoie `Access-Control-Allow-Origin: *` ou un autre en-tête qui autorise
  `https://playground.wordpress.net`.
- Utilise une URL de fichier brut, pas une page HTML de dépôt.

<!--
For GitHub, use `raw.githubusercontent.com` URLs instead of `github.com/.../blob/...`.
For GitLab, use the raw file URL instead of a `/-/blob/` page.
-->

Pour GitHub, utilisez des URL `raw.githubusercontent.com` au lieu de
`github.com/.../blob/...`. Pour GitLab, utilisez l’URL de fichier brut au lieu
d’une page `/-/blob/`.

```text
# Good
https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/welcome/blueprint.json

# Not a raw JSON response
https://github.com/WordPress/blueprints/blob/trunk/blueprints/welcome/blueprint.json
```

<!--
Temporary tunnel URLs, local development URLs, and draft release assets often
fail because the browser cannot reach them or because they do not allow
cross-origin requests. Move the Blueprint to a public host with CORS enabled.
-->

Les URL de tunnel temporaires, les URL de développement local et les assets de
release en brouillon échouent souvent parce que le navigateur ne peut pas les
atteindre ou parce qu’ils n’autorisent pas les requêtes cross-origin. Déplacez
le Blueprint vers un hébergeur public avec CORS activé.

<!-- ### Blueprint file is neither a valid JSON nor a ZIP file -->

### Blueprint file is neither a valid JSON nor a ZIP file

<!--
This means Playground received a response, but the response was not a Blueprint.
The URL may have returned an HTML page, 404 page, repository file viewer, proxy
warning, login page, or corrupted ZIP.
-->

Cela signifie que Playground a reçu une réponse, mais que cette réponse n’était
pas un Blueprint. L’URL a pu renvoyer une page HTML, une page 404, un aperçu de
fichier de dépôt, un avertissement de proxy, une page de connexion ou un ZIP
corrompu.

<!-- Open the URL directly and check that: -->

Ouvrez l’URL directement et vérifiez que :

<!--
- JSON URLs return valid Blueprint JSON.
- ZIP bundle URLs download a real ZIP archive.
- Blueprint bundles contain `blueprint.json` at the root of the ZIP.
- The response is not a small HTML or text error page.
-->

- Les URL JSON renvoient du JSON de Blueprint valide.
- Les URL de bundle ZIP téléchargent une véritable archive ZIP.
- Les bundles de Blueprint contiennent `blueprint.json` à la racine du ZIP.
- La réponse n’est pas une petite page d’erreur HTML ou texte.

<!-- ### URIError: URI malformed -->

### URIError: URI malformed

<!--
`URIError: URI malformed` usually points to a broken encoded Blueprint fragment
in the URL, not to a failed Blueprint step. Check for invalid `%` escapes,
double-encoded fragments, or raw JSON pasted after `#`. Rebuild the link from
the original Blueprint and encode it once, or use Base64. See
[Encoded Blueprint fragments](/blueprints/using-blueprints).
-->

`URIError: URI malformed` indique généralement un fragment de Blueprint encodé
cassé dans l’URL, pas une étape de Blueprint échouée. Vérifiez les échappements
`%` invalides, les fragments doublement encodés ou le JSON brut collé après
`#`. Reconstruisez le lien depuis le Blueprint d’origine et encodez-le une
seule fois, ou utilisez Base64. Consultez les
[fragments de Blueprint encodés](/blueprints/using-blueprints).

<!-- ## ResourceDownloadError -->

## ResourceDownloadError

<!--
`ResourceDownloadError` means the Blueprint loaded, but a step could not download
a resource such as a plugin ZIP, theme ZIP, WXR file, or imported site archive.
-->

`ResourceDownloadError` signifie que le Blueprint s’est chargé, mais qu’une
étape n’a pas pu télécharger une ressource comme un ZIP d’extension, un ZIP de
thème, un fichier WXR ou une archive de site importée.

<!-- Confirm the resource URL: -->

Confirmez que l’URL de la ressource :

<!--
- Downloads the actual file, not an HTML page, redirect warning, or expired artifact.
- Is public and does not require authentication.
- Allows cross-origin requests.
- Is the direct file URL. Some release pages and CI artifact pages are human pages, not direct downloads.
- Still exists. Temporary links and CI artifacts can expire.
-->

- Télécharge le fichier réel, pas une page HTML, un avertissement de redirection ou un artifact expiré.
- Est publique et ne nécessite pas d’authentification.
- Autorise les requêtes cross-origin.
- Est l’URL directe du fichier. Certaines pages de release et pages d’artifacts CI sont des pages destinées aux humains, pas des téléchargements directs.
- Existe encore. Les liens temporaires et les artifacts CI peuvent expirer.

<!--
For source code in a Git repository, prefer a
[`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference).
Use a `url` resource for built ZIP artifacts that are already publicly
downloadable.
-->

Pour du code source dans un dépôt Git, préférez une
[ressource `git:directory`](/blueprints/steps/resources#gitdirectoryreference).
Utilisez une ressource `url` pour des artifacts ZIP construits qui sont déjà
téléchargeables publiquement.

<!-- ## BlueprintStepExecutionError -->

## BlueprintStepExecutionError

<!--
`BlueprintStepExecutionError` means a specific step failed after the Blueprint
started running. The message includes a step number:
-->

`BlueprintStepExecutionError` signifie qu’une étape précise a échoué après le
démarrage du Blueprint. Le message inclut un numéro d’étape :

```text
BlueprintStepExecutionError: Error when executing the blueprint step #4
```

<!--
Use that number to inspect the matching step. If your Blueprint uses shorthands
such as `plugins`, `login`, `siteOptions`, or `constants`, Playground expands
them into steps before running the Blueprint. Use explicit `steps` when the
order matters.
-->

Utilisez ce numéro pour inspecter l’étape correspondante. Si votre Blueprint
utilise des raccourcis comme `plugins`, `login`, `siteOptions` ou `constants`,
Playground les développe en étapes avant d’exécuter le Blueprint. Utilisez des
`steps` explicites lorsque l’ordre compte.

<!--
URL query parameters such as `?plugin=...`, `?theme=...`, `?php=...`,
`?wp=...`, and `?networking=yes` also create an implicit Blueprint. Errors from
those URLs are still Blueprint execution errors, and the generated steps affect
the reported step number.
-->

Les paramètres de requête d’URL comme `?plugin=...`, `?theme=...`, `?php=...`,
`?wp=...` et `?networking=yes` créent aussi un Blueprint implicite. Les erreurs
issues de ces URL restent des erreurs d’exécution de Blueprint, et les étapes
générées influencent le numéro d’étape indiqué.

<!-- ## PHP.run() failed with exit code 255 -->

## PHP.run() failed with exit code 255

<!--
Exit code `255` usually means PHP hit a fatal error. Look for the first
`Fatal error`, `Uncaught`, or `TypeError` line in the output. The large HTML
error page around it is usually WordPress's generic critical error screen.
-->

Le code de sortie `255` signifie généralement que PHP a rencontré une erreur
fatale. Recherchez la première ligne `Fatal error`, `Uncaught` ou `TypeError`
dans la sortie. La grande page d’erreur HTML qui l’entoure est généralement
l’écran générique d’erreur critique de WordPress.

<!--
To make the output more useful while debugging, enable WordPress debug constants
near the beginning of the Blueprint:
-->

Pour rendre la sortie plus utile pendant le débogage, activez les constantes de
débogage WordPress près du début du Blueprint :

```json
{
	"step": "defineWpConfigConsts",
	"consts": {
		"WP_DEBUG": true,
		"WP_DEBUG_LOG": true,
		"WP_DEBUG_DISPLAY": true,
		"WP_DISABLE_FATAL_ERROR_HANDLER": true
	}
}
```

<!--
Then rerun the Blueprint and check the Playground **Logs** panel or browser
console.
-->

Relancez ensuite le Blueprint et consultez le panneau **Logs** de Playground ou
la console du navigateur.

<!-- ## PHP.run() failed with exit code 1 -->

## PHP.run() failed with exit code 1

<!--
Exit code `1` often appears when WP-CLI or WordPress returns an application
error. Read the `Stderr` section first. It usually names the unsupported
argument, missing resource, or command-specific failure.
-->

Le code de sortie `1` apparaît souvent lorsque WP-CLI ou WordPress renvoie une
erreur applicative. Lisez d’abord la section `Stderr`. Elle nomme généralement
l’argument non pris en charge, la ressource manquante ou l’échec propre à la
commande.

<!--
Some WP-CLI commands behave differently in Playground because WordPress runs in
WebAssembly with SQLite. Keep commands small and test them individually before
adding a long chain to a Blueprint.
-->

Certaines commandes WP-CLI se comportent différemment dans Playground parce que
WordPress s’exécute dans WebAssembly avec SQLite. Gardez les commandes courtes
et testez-les individuellement avant d’ajouter une longue chaîne à un Blueprint.

<!-- ## Undefined constant `ABSPATH` -->

## Undefined constant `ABSPATH`

<!--
This usually happens in a `runPHP` step that calls WordPress APIs without first
loading WordPress.
-->

Cela se produit généralement dans une étape `runPHP` qui appelle des API
WordPress sans charger WordPress au préalable.

<!-- Add `wp-load.php` before any WordPress function, constant, option, or plugin API: -->

Ajoutez `wp-load.php` avant toute fonction, constante, option ou API d’extension
WordPress :

```json
{
	"step": "runPHP",
	"code": "<?php require '/wordpress/wp-load.php'; update_option('blogname', 'Demo site');"
}
```

<!-- ## Plugin could not be activated -->

## Plugin could not be activated

<!--
Plugin activation errors usually come from the plugin itself, not from the
Blueprint runner. Common causes:
-->

Les erreurs d’activation d’extensions viennent généralement de l’extension
elle-même, pas de l’exécuteur de Blueprints. Causes fréquentes :

<!--
- The plugin requires a newer PHP version or WordPress version.
- The plugin has a fatal error on activation.
- The plugin depends on another plugin that is not installed or activated.
- The plugin performs a redirect or prints unexpected output during activation.
- The plugin ZIP extracts to a folder or main file name different from the path the step is activating.
-->

- L’extension nécessite une version plus récente de PHP ou de WordPress.
- L’extension déclenche une erreur fatale pendant l’activation.
- L’extension dépend d’une autre extension qui n’est pas installée ou activée.
- L’extension effectue une redirection ou affiche une sortie inattendue pendant l’activation.
- Le ZIP de l’extension s’extrait dans un dossier ou un fichier principal dont le nom ne correspond pas au chemin activé par l’étape.

<!--
If the error says the current PHP or WordPress version does not meet minimum
requirements, set `preferredVersions`:
-->

Si l’erreur indique que la version actuelle de PHP ou de WordPress ne respecte
pas les prérequis minimaux, définissez `preferredVersions` :

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	}
}
```

<!-- ### WordPress exited with exit code 0 -->

### WordPress exited with exit code 0

<!--
Activation can fail even when WordPress exits with code `0`. This usually means
WordPress returned an activation error response rather than a PHP process crash.
When the message says `Inspect the "debug" logs`, check the Playground **Logs**
panel, browser console, or CLI output.
-->

L’activation peut échouer même quand WordPress se termine avec le code `0`. Cela
signifie généralement que WordPress a renvoyé une réponse d’erreur d’activation,
plutôt qu’un plantage du processus PHP. Quand le message indique
`Inspect the "debug" logs`, consultez le panneau **Logs** de Playground, la
console du navigateur ou la sortie de la CLI.

<!--
Look for PHP warnings, redirects or output printed during activation, missing
dependency plugins, or plugin minimum PHP/WordPress requirements.
-->

Cherchez des avertissements PHP, des redirections ou une sortie imprimée pendant
l’activation, des extensions dépendantes manquantes ou des prérequis minimaux
PHP/WordPress de l’extension.

<!-- ### Current PHP or WordPress version does not meet minimum requirements -->

### Current PHP or WordPress version does not meet minimum requirements

<!-- Version mismatch errors often include text like: -->

Les erreurs d’incompatibilité de version contiennent souvent un texte comme :

```text
Current PHP version (7.4.33) does not meet minimum requirements. The plugin requires PHP 8.0.
```

<!-- or: -->

ou :

```text
Current WordPress version (6.9.4) does not meet minimum requirements. The plugin requires WordPress 7.0.
```

<!--
Set `preferredVersions` to a compatible PHP and WordPress version, or use a
plugin/theme release that supports the versions available in Playground.
-->

Définissez `preferredVersions` avec une version compatible de PHP et de
WordPress, ou utilisez une version de l’extension ou du thème compatible avec
les versions disponibles dans Playground.

<!-- If the error is: -->

Si l’erreur est :

```text
Failed to download WordPress 6.9.0 (HTTP 404)
```

<!--
the requested WordPress build is not available. Use `latest`, a supported
released version, or a supported beta/nightly value.
-->

la build WordPress demandée n’est pas disponible. Utilisez `latest`, une version
publiée prise en charge ou une valeur beta/nightly prise en charge.

<!--
If the error says `Plugin file does not exist`, inspect the installed folder
name. For ZIP URLs with unusual folder names, set `targetFolderName`:
-->

Si l’erreur indique `Plugin file does not exist`, inspectez le nom du dossier
installé. Pour les URL ZIP dont les noms de dossier sont inhabituels,
définissez `targetFolderName` :

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "url",
		"url": "https://example.com/my-plugin.zip"
	},
	"options": {
		"activate": true,
		"targetFolderName": "my-plugin"
	}
}
```

<!--
If the plugin has dependencies, install and activate those dependencies first
with explicit steps.
-->

Si l’extension a des dépendances, installez et activez d’abord ces dépendances
avec des étapes explicites.

<!-- ## Theme could not be activated -->

## Theme could not be activated

<!--
Theme activation failures usually mean the theme folder name is wrong, the
theme ZIP extracted to an unexpected directory, or the theme code caused a
WordPress/PHP error.
-->

Les échecs d’activation de thèmes signifient généralement que le nom du dossier
du thème est incorrect, que le ZIP du thème s’est extrait dans un répertoire
inattendu ou que le code du thème a causé une erreur WordPress/PHP.

<!-- Use `installTheme` with `options.activate` when installing a theme: -->

Utilisez `installTheme` avec `options.activate` lors de l’installation d’un
thème :

```json
{
	"step": "installTheme",
	"themeData": {
		"resource": "wordpress.org/themes",
		"slug": "twentytwentyfour"
	},
	"options": {
		"activate": true
	}
}
```

<!--
If you use a standalone `activateTheme` step, pass the folder name inside
`wp-content/themes`, not a full URL or ZIP filename.
-->

Si vous utilisez une étape `activateTheme` autonome, fournissez le nom du
dossier dans `wp-content/themes`, pas une URL complète ni un nom de fichier ZIP.

<!-- ## Could not write to a file -->

## Could not write to a file

<!-- Errors like this mean the parent directory does not exist: -->

Les erreurs comme celle-ci signifient que le répertoire parent n’existe pas :

```text
Could not write to "/wordpress/wp-content/plugins/example/index.php":
There is no such file or directory OR the parent directory does not exist.
```

<!--
Create the directory first with `mkdir`, or use `writeFiles` with a
`literal:directory` resource.
-->

Créez d’abord le répertoire avec `mkdir`, ou utilisez `writeFiles` avec une
ressource `literal:directory`.

```json
[
	{
		"step": "mkdir",
		"path": "/wordpress/wp-content/plugins/example"
	},
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/plugins/example/index.php",
		"data": "<?php /* Plugin Name: Example */"
	}
]
```

<!-- ## Could not unzip file -->

## Could not unzip file

<!--
This usually means the file is not a valid ZIP archive. The URL may have
returned an HTML page, an error response, a login page, or a truncated file.
-->

Cela signifie généralement que le fichier n’est pas une archive ZIP valide.
L’URL peut avoir renvoyé une page HTML, une réponse d’erreur, une page de
connexion ou un fichier tronqué.

<!--
If the output says `Could not unzip file. Error code: 19`, verify the download
is a ZIP archive. A small file size often means the server returned an HTML
error page instead of the archive.
-->

Si la sortie indique `Could not unzip file. Error code: 19`, vérifiez que le
téléchargement est bien une archive ZIP. Une petite taille de fichier signifie
souvent que le serveur a renvoyé une page d’erreur HTML au lieu de l’archive.

<!--
Open the URL directly and confirm the browser downloads a ZIP. If you are using
a GitHub or CI artifact, use a direct-download URL and make sure the release or
artifact is public.
-->

Ouvrez l’URL directement et confirmez que le navigateur télécharge un ZIP. Si
vous utilisez un artefact GitHub ou CI, utilisez une URL de téléchargement
direct et vérifiez que la release ou l’artefact est public.

<!-- ## WP-CLI command pitfalls -->

## Pièges des commandes WP-CLI

<!--
The `wp-cli` step runs WP-CLI inside Playground. It is useful for setup tasks,
but not every command or shell feature behaves like a local terminal.
-->

L’étape `wp-cli` exécute WP-CLI dans Playground. Elle est utile pour les tâches
de configuration, mais toutes les commandes ou fonctionnalités du shell ne se
comportent pas comme dans un terminal local.

<!-- Common fixes: -->

Corrections fréquentes :

<!--
- Use the step name `"wp-cli"`, not `"wpcli"` or `"cli"`.
- Keep commands focused. Prefer multiple `wp-cli` steps over one complex shell command.
- Avoid shell substitutions such as `$(...)` in shared Blueprints. Use `runPHP` for logic that needs WordPress APIs.
- Check parameter names against the WP-CLI command you are using. For example, command-specific parameters may differ between `wp post list`, `wp post delete`, and plugin-provided commands.
- If a plugin-provided WP-CLI command fails with a plugin stack trace, the fix usually belongs in that plugin or in the input data passed to the command.
- If a command fails with `unknown --post_type parameter` or `unknown --format parameter`, check whether the flags belong to a different command in the pipeline.
- If a plugin command fails with `Unsupported argument type passed to WP_CLI::error_to_string(): 'NULL'`, confirm the plugin is active, the imported data exists, and the command input points to a valid resource.
-->

- Utilisez le nom d’étape `"wp-cli"`, pas `"wpcli"` ni `"cli"`.
- Gardez les commandes ciblées. Préférez plusieurs étapes `wp-cli` à une seule commande shell complexe.
- Évitez les substitutions shell comme `$(...)` dans les Blueprints partagés. Utilisez `runPHP` pour la logique qui nécessite les API WordPress.
- Vérifiez les noms de paramètres dans la commande WP-CLI que vous utilisez. Par exemple, les paramètres propres à une commande peuvent différer entre `wp post list`, `wp post delete` et les commandes fournies par des extensions.
- Si une commande WP-CLI fournie par une extension échoue avec une trace de pile de l’extension, la correction se trouve généralement dans cette extension ou dans les données d’entrée transmises à la commande.
- Si une commande échoue avec `unknown --post_type parameter` ou `unknown --format parameter`, vérifiez si ces options appartiennent à une autre commande du pipeline.
- Si une commande d’extension échoue avec `Unsupported argument type passed to WP_CLI::error_to_string(): 'NULL'`, confirmez que l’extension est active, que les données importées existent et que l’entrée de la commande pointe vers une ressource valide.

<!-- ## WP-CLI: Error establishing a database connection on mounted sites -->

## WP-CLI: Error establishing a database connection sur les sites montés

<!--
When using `wp-cli` with a mounted Playground site, for example via
`--mount-before-install`, you might encounter an "Error establishing a database
connection." This happens because WordPress Playground loads the SQLite database
integration plugin from its internal files by default, not from the mounted
directory.
-->

Lorsque vous utilisez `wp-cli` avec un site Playground monté, par exemple via
`--mount-before-install`, vous pouvez rencontrer "Error establishing a database
connection." Cela se produit parce que WordPress Playground charge par défaut
l’extension d’intégration de base de données SQLite depuis ses fichiers
internes, pas depuis le répertoire monté.

<!-- Add the SQLite integration plugin to the mounted WordPress site explicitly: -->

Ajoutez explicitement l’extension d’intégration SQLite au site WordPress monté :

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

<!-- Then run the Blueprint with the mounted site: -->

Exécutez ensuite le Blueprint avec le site monté :

```bash
mkdir wordpress
npx @wp-playground/cli server --mount-before-install=wordpress:/wordpress --blueprint=./blueprint.json
```

<!-- ## Debugging tools -->

## Outils de débogage

<!-- ### Blueprints editor -->

### Éditeur de Blueprints

<!--
Use the in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html)
to build, validate, and preview Blueprints.
-->

Utilisez l’[éditeur de Blueprints](https://playground.wordpress.net/builder/builder.html)
dans le navigateur pour créer, valider et prévisualiser des Blueprints.

<!-- :::danger Caution -->

<div class="callout callout-warning">

**Attention**

<!--
The editor is under development and the embedded Playground sometimes fails to
load. To get around it, refresh the page.
-->

L’éditeur est en cours de développement et le Playground intégré échoue parfois
à se charger. Pour contourner le problème, actualisez la page.

</div>

<!-- ### Filesystem and database inspection -->

### Inspection du système de fichiers et de la base de données

<!--
Some Blueprint steps, such as [`writeFile`](/blueprints/steps),
alter the internal filesystem. Others, such as
[`runSql`](/blueprints/steps), alter the database.
-->

Certaines étapes de Blueprint, comme [`writeFile`](/blueprints/steps),
modifient le système de fichiers interne. D’autres, comme
[`runSql`](/blueprints/steps), modifient la base de données.

<!--
To inspect the final state, install plugins such as
[`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and
[`WPide`](https://wordpress.org/plugins/wpide/). You can see them in action at
https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide.
-->

Pour inspecter l’état final, installez des extensions comme
[`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) et
[`WPide`](https://wordpress.org/plugins/wpide/). Vous pouvez les voir en action
sur https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide.

<!--
You can also inspect a Playground instance from the browser console through
`window.playground`:
-->

Vous pouvez aussi inspecter une instance Playground depuis la console du
navigateur via `window.playground` :

```js
await playground.isDir('/wordpress/wp-content/plugins');
await playground.listFiles('/wordpress/wp-content/plugins');
```

<!-- See the full [PlaygroundClient API](/api/client/interface/PlaygroundClient). -->

Consultez l’[API PlaygroundClient](/api/client/interface/PlaygroundClient)
complète.

<!-- ### Browser console and network requests -->

### Console du navigateur et requêtes réseau

<!--
Open browser developer tools to check JavaScript errors, PHP debug logs, and
failed network requests. In Chrome, Firefox, and Edge, press
`Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.
-->

Ouvrez les outils de développement du navigateur pour vérifier les erreurs
JavaScript, les journaux de débogage PHP et les requêtes réseau échouées. Dans
Chrome, Firefox et Edge, appuyez sur `Ctrl + Shift + I` sous Windows/Linux ou
sur `Cmd + Option + I` sous macOS.

<!-- :::caution Safari -->

<div class="callout callout-warning">

**Safari**

<!--
If you have not enabled the Develop menu, go to **Safari > Settings... >
Advanced** and check **Show features for web developers**.
-->

Si vous n’avez pas activé le menu Développement, allez dans
**Safari > Settings... > Advanced** et cochez
**Show features for web developers**.

</div>

<!-- ### Custom error logging -->

### Journalisation d’erreurs personnalisée

<!--
You can write your own messages with `error_log()` in a
[`runPHP` step](/blueprints/steps), then check the Playground
**Logs** panel or the browser console.
-->

Vous pouvez écrire vos propres messages avec `error_log()` dans une étape
[`runPHP`](/blueprints/steps), puis consulter le panneau **Logs** de Playground
ou la console du navigateur.

<!-- ![Log errors snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp) -->

![Capture des erreurs de journal](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)

<!--
<div class="callout callout-info">

When you download your Playground instance as a ZIP through the
["Download as zip"](/web-instance) option, the archive
also includes `debug.log`.
</div>
-->

<div class="callout callout-info">

Lorsque vous téléchargez votre instance Playground sous forme de ZIP via
l’option ["Download as zip"](/web-instance), l’archive inclut aussi `debug.log`.

</div>

<!-- ## Ask for help -->

## Demander de l’aide

<!--
If you need help, [open an issue](https://github.com/WordPress/wordpress-playground/issues)
and include:
-->

Si vous avez besoin d’aide, [ouvrez une issue](https://github.com/WordPress/wordpress-playground/issues)
et incluez :

<!--
- The Blueprint JSON or the public Blueprint URL.
- The exact error message.
- The failing step number, if shown.
- Browser, operating system, and whether you used the website, JavaScript API, or CLI.
- Relevant console, network, or CLI output.
-->

- Le JSON du Blueprint ou l’URL publique du Blueprint.
- Le message d’erreur exact.
- Le numéro de l’étape en échec, s’il est affiché.
- Le navigateur, le système d’exploitation et si vous avez utilisé le site web, l’API JavaScript ou la CLI.
- La sortie pertinente de la console, du réseau ou de la CLI.
