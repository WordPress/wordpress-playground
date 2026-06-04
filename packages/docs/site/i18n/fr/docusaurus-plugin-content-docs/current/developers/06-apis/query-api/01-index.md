---
sidebar_position: 5
slug: /developers/apis/query-api
description: Cette page décrit la Query API de WordPress Playground pour configurer une instance WP via des paramètres d’URL.
---

<!--
# Query API
-->

# API de requête (Query API)

<!--
WordPress Playground exposes a simple API that you can use to configure the Playground in the browser.
-->

WordPress Playground expose une API simple pour configurer l’instance Playground dans le navigateur.

<!--
It works by passing configuration options as query parameters to the Playground URL. For example, to install the pendant theme, you would use the following URL:
-->

Elle fonctionne en passant des options de configuration sous forme de paramètres de requête dans l’URL Playground. Par exemple, pour installer le thème "pendant", utilisez l’URL suivante :

```text
https://playground.wordpress.net/?theme=pendant
```

<!--
You can go ahead and try it out. The Playground will automatically install the theme and log you in as an admin. You may even embed this URL in your website using an `<iframe>` tag:
-->

Vous pouvez l’essayer tout de suite. Playground installera automatiquement le thème et vous connectera en tant qu’administrateur. Vous pouvez également intégrer cette URL à votre site avec une balise `<iframe>` :

```html
<iframe src="https://playground.wordpress.net/?theme=pendant"></iframe>
```

<!--
## Available options
-->

## Options disponibles

| Option             | Valeur par défaut     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`              | `8.5`                 | Charge la version PHP indiquée. Accepte `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` ou `latest`.                                                                                                                                                                                                                                                                                                                                                                  |
| `wp`               | `latest`              | Charge la version WordPress indiquée. Accepte les trois dernières versions majeures. Au 1er juin 2024, il s’agit de `6.3`, `6.4` ou `6.5`. Vous pouvez aussi utiliser `latest`, `nightly` ou `beta`.                                                                                                                                                                                                                                                                  |
| `blueprint-url`    |                       | URL du Blueprint utilisé pour configurer cette instance Playground.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `networking`       | `yes`                 | Active ou désactive le réseau dans Playground. Accepte `yes` ou `no`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `plugin`           |                       | Installe l’extension indiquée. Utilisez le nom tel qu’il apparaît dans l’URL du répertoire d’extensions WordPress. Par exemple, pour `https://wordpress.org/plugins/wp-lazy-loading/`, le nom est `wp-lazy-loading`. Préinstallez plusieurs extensions avec `plugin=coblocks&plugin=wp-lazy-loading&…`. L’installation connecte automatiquement en tant qu'administrateur. Plusieurs extensions peuvent être installées en répétant le paramètre `plugin` dans l’URL. |
| `theme`            |                       | Installe le thème indiqué. Utilisez le nom tel qu’il apparaît dans l’URL du répertoire de thèmes. Par exemple, pour `https://wordpress.org/themes/disco/`, le nom est `disco`. L’installation connecte automatiquement en tant qu'admininistrateur. Plusieurs thèmes peuvent être installés en répétant le paramètre `theme` dans l’URL.                                                                                                                              |
| `url`              | `/wp-admin/`          | Charge la page WordPress initiale indiquée dans cette instance Playground.                                                                                                                                                                                                                                                                                                                                                                                            |
| `mode`             | `browser-full-screen` | Détermine l’affichage de l’instance WordPress : dans une interface navigateur ou en pleine largeur pour une expérience continue. Accepte `browser-full-screen` ou `seamless`.                                                                                                                                                                                                                                                                                         |
| `lazy`             |                       | Diffère le chargement des ressources Playground jusqu’à ce que l’utilisateur clique sur « Exécuter ». N’accepte pas de valeur. Si `lazy` est présent dans l’URL, le chargement est différé.                                                                                                                                                                                                                                                                           |
| `login`            | `yes`                 | Connecte l’utilisateur en tant qu’administrateur. Accepte `yes` ou `no`.                                                                                                                                                                                                                                                                                                                                                                                              |
| `multisite`        | `no`                  | Active le mode multisite WordPress. Accepte `yes` ou `no`.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `import-site`      |                       | Importe les fichiers du site et la base de données depuis une archive ZIP indiquée par une URL.                                                                                                                                                                                                                                                                                                                                                                       |
| `import-wxr`       |                       | Importe le contenu du site depuis un fichier WXR indiqué par une URL. Utilise l’extension WordPress Importer. l’administrateur par défaut doit être connecté.                                                                                                                                                                                                                                                                                                         |
| `site-slug`        |                       | Sélectionne le site à charger depuis le stockage du navigateur. Si le site n’existe pas, l’utilisateur est invité à en enregistrer un nouveau avec le slug indiqué.                                                                                                                                                                                                                                                                                                   |
| `language`         | `en_US`               | Définit la localisation de l’instance WordPress. À utiliser avec `networking=yes`, sinon WordPress ne pourra pas télécharger les traductions.                                                                                                                                                                                                                                                                                                                         |
| `core-pr`          |                       | Installe une PR spécifique du core sur https://github.com/WordPress/wordpress-develop. Accepte le numéro de PR. Par exemple, `core-pr=6883`.                                                                                                                                                                                                                                                                                                                          |
| `gutenberg-pr`     |                       | Installe une PR spécifique de Gutenberg sur https://github.com/WordPress/gutenberg. Accepte le numéro de PR. Par exemple, `gutenberg-pr=65337`.                                                                                                                                                                                                                                                                                                                       |
| `gutenberg-branch` |                       | Installe une branche spécifique depuis https://github.com/WordPress/gutenberg. Accepte le nom de branche. Par exemple, `gutenberg-branch=trunk`.                                                                                                                                                                                                                                                                                                                      |
| `page-title`       |                       | Personnalise le titre de l’onglet du navigateur. Utile pour distinguer plusieurs instances Playground. Le paramètre est conservé lors de la navigation entre sites.                                                                                                                                                                                                                                                                                                   |
| `can-save`         |                       | Par défaut, le Playground peut être enregistré sur l’ordinateur ou le navigateur du visiteur. Pour désactiver l’enregistrement, ajoutez `?can-save=no` : les options d’enregistrement disparaissent de l’interface.                                                                                                                                                                                                                                                   |
| `mcp`              | `no`                  | Démarre le pont serveur MCP (Model Context Protocol), permettant aux clients MCP externes de se connecter et de contrôler l’instance Playground. Accepte `yes` ou `no`.                                                                                                                                                                                                                                                                                               |
| `mcp-port`         | `7999`                | Définit le port WebSocket utilisé par le pont MCP pour communiquer avec le serveur MCP. À utiliser avec `mcp=yes`. Par exemple, `mcp=yes&mcp-port=8080`.                                                                                                                                                                                                                                                                                                              |
| `overlay`          |                       | Ouvre une superposition d’interface au chargement de la page. Prend actuellement en charge `blueprints` pour ouvrir directement la galerie de Blueprints. Par exemple, `?overlay=blueprints`. Le paramètre est retiré de l’URL à la fermeture de la superposition.                                                                                                                                                                                                    |

<!--
For example, the following code embeds a Playground with a preinstalled Gutenberg plugin and opens the post editor:
-->

Par exemple, le code suivant intègre un Playground avec l’extension Gutenberg préinstallée et ouvre l’éditeur d’articles :

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```

<div class="callout callout-info">

**Politique CORS**

<!--
To import files from a URL, such as a site zip package, they must be served with `Access-Control-Allow-Origin` header set. For reference, see: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).
-->

Pour importer des fichiers depuis une URL, comme une archive zip du site, ils doivent être servis avec l’en-tête `Access-Control-Allow-Origin` défini. Référence : [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).

</div>

<!--
## GitHub Export Options
-->

## Options d’exportation GitHub

<!--
The following additional query parameters may be used to pre-configure the GitHub export form:
-->

Les paramètres de requête suivants permettent de préconfigurer le formulaire d’exportation GitHub :

- `gh-ensure-auth` : Si défini à `yes`, Playground affiche une fenêtre pour s’assurer que l’utilisateur est authentifié sur GitHub avant de continuer.
- `ghexport-repo-url` : URL du dépôt GitHub de destination.
- `ghexport-pr-action` : Action à l’exportation (créer ou mettre à jour).
- `ghexport-playground-root` : Répertoire racine dans Playground à partir duquel exporter.
- `ghexport-repo-root` : Répertoire racine dans le dépôt de destination.
- `ghexport-content-type` : Type de contenu exporté (plugin, theme, wp-content, custom-paths).
- `ghexport-plugin` : Chemin de l’extension. Lorsque le type est `plugin`, pré-sélectionne l’extension à exporter.
- `ghexport-theme` : Nom du répertoire du thème. Lorsque le type est `theme`, pré-sélectionne le thème à exporter.
- `ghexport-path` : Chemin relatif à `ghexport-playground-root`. Peut être fourni plusieurs fois. Lorsque le type est `custom-paths`, préremplit la liste des chemins à exporter.
- `ghexport-commit-message` : Message de commit utilisé lors de l’exportation.
- `ghexport-allow-include-zip` : Proposer ou non d’inclure une archive zip dans l’export GitHub (`yes`, `no`). Optionnel. Par défaut `yes`.
