---
title: Importer du contenu dans WordPress avec des Blueprints
slug: /guides/import-content-with-blueprints
description: Comparez les exportations WXR, runPHP et les instantanés ZIP pour importer du contenu dans une nouvelle instance de WordPress Playground.
---

<!-- # Import content into WordPress with Blueprints -->

# Importer du contenu dans WordPress avec des Blueprints

<!--
A new WordPress Playground site starts with very little content. A Blueprint can
populate it from a WordPress export file, generate content with WordPress APIs,
or restore a Playground ZIP snapshot.

This guide focuses on choosing and benchmarking those three import methods. For
theme starter content, WP-CLI, media, and other demo-building strategies, see
[Providing content for your demo with Playground](/guides/providing-content-for-your-demo).
-->

Un nouveau site WordPress Playground contient initialement très peu de contenu.
Un Blueprint peut le remplir à partir d’un fichier d’exportation WordPress,
générer du contenu avec les API WordPress ou restaurer un instantané ZIP de
Playground.

Ce guide porte sur le choix et l’évaluation des performances de ces trois
méthodes d’importation. Pour le contenu de démarrage des thèmes, WP-CLI, les
médias et d’autres stratégies de création de démos, consultez
[Fournir du contenu pour votre démo avec Playground](/guides/providing-content-for-your-demo).

<!-- These approaches solve different problems: -->

Ces approches répondent à des besoins différents :

<!--
| Method                                                                        | Best for                                                          | What it moves                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr)                  | Portable content shared between WordPress sites                   | Posts, pages, custom post types, terms, authors, comments, and attachment references          |
| [`runPHP`](#generate-content-with-runphp)                                     | Small, deterministic fixtures and content that needs custom logic | Anything the PHP code creates through WordPress APIs                                          |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | Restoring a complete Playground demo                              | The database and any WordPress files present in the ZIP, such as plugins, themes, and uploads |
-->

| Méthode                                                                          | Idéale pour                                                   | Éléments transférés                                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`importWxr`](#importer-une-exportation-xml-wordpress-avec-importwxr)            | Contenu portable partagé entre plusieurs sites WordPress      | Articles, pages, types de publication personnalisés, termes, auteurs, commentaires et références de pièces jointes    |
| [`runPHP`](#générer-du-contenu-avec-runphp)                                      | Petits jeux de données déterministes et logique personnalisée | Tout ce que le code PHP crée au moyen des API WordPress                                                               |
| [`importWordPressFiles`](#restaurer-un-zip-playground-avec-importwordpressfiles) | Restauration d’une démo Playground complète                   | La base de données et les fichiers WordPress présents dans le ZIP, notamment les extensions, thèmes et téléversements |

<!--
If you only need posts and terms, start with WXR. If the content is generated or
depends on setup logic, use `runPHP`. If the database, media, plugins, themes,
and settings must be restored together, use a ZIP snapshot.
-->

Si vous avez seulement besoin d’articles et de termes, commencez par WXR. Si le
contenu est généré ou dépend d’une logique de configuration, utilisez `runPHP`.
Si la base de données, les médias, les extensions, les thèmes et les réglages
doivent être restaurés ensemble, utilisez un instantané ZIP.

<!-- ## Import a WordPress XML export with `importWxr` -->

## Importer une exportation XML WordPress avec `importWxr`

<!--
WordPress calls its XML export format WordPress eXtended RSS, or WXR. Create one
from **Tools > Export** in an existing WordPress site, then pass it to the
[`importWxr` step](/blueprints/steps).

This example expects `content.xml` next to `blueprint.json` in a
[Blueprint bundle](/blueprints/bundles):
-->

WordPress appelle son format d’exportation XML WordPress eXtended RSS, ou WXR.
Créez-en un depuis **Outils > Exporter** dans un site WordPress existant, puis
transmettez-le à l’[étape `importWxr`](/blueprints/steps).

Cet exemple suppose que `content.xml` se trouve à côté de `blueprint.json` dans
un [bundle de Blueprint](/blueprints/bundles) :

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": false,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

<!--
For a hosted file, replace the `bundled` resource with a
[`url` resource](/blueprints/steps/resources#urlreference). Set `fetchAttachments` to
`true` and enable `features.networking` when the importer must download the
media files referenced by the WXR file. Network transfer can dominate the total
setup time, so the benchmark later in this guide disables attachment fetching.

`importWxr` can also map imported authors to local users, create users, and
apply explicit URL replacements. See the
[`importWxr` options](/blueprints/steps) before importing content from
another domain.
-->

Pour un fichier hébergé, remplacez la ressource `bundled` par une
[ressource `url`](/blueprints/steps/resources#urlreference). Définissez
`fetchAttachments` sur `true` et activez `features.networking` lorsque l’outil
d’importation doit télécharger les fichiers médias référencés par le fichier
WXR. Le transfert réseau peut représenter la majeure partie du temps total de
configuration. Le benchmark présenté plus loin désactive donc la récupération
des pièces jointes.

`importWxr` peut également associer les auteurs importés à des comptes locaux,
créer des comptes et appliquer des remplacements explicites d’URL. Consultez les
[options de `importWxr`](/blueprints/steps) avant d’importer du contenu depuis un
autre domaine.

<!-- ### Pros -->

### Avantages

<!--
- Uses WordPress's standard, portable content exchange format.
- Preserves post types, taxonomies, post meta, authors, comments, and content
  relationships represented in the export.
- Can fetch attachments and rewrite old content URLs for the new site.
- Keeps content separate from the destination's WordPress core, plugins,
  themes, and most site settings.
- Is easy to inspect, version, and edit because the source is XML.
-->

- Utilise le format d’échange de contenu standard et portable de WordPress.
- Conserve les types de publication, taxonomies, métadonnées, auteurs,
  commentaires et relations de contenu représentés dans l’exportation.
- Peut récupérer les pièces jointes et réécrire les anciennes URL de contenu
  pour le nouveau site.
- Sépare le contenu du cœur de WordPress, des extensions, des thèmes et de la
  plupart des réglages du site de destination.
- Est facile à examiner, versionner et modifier, car la source est en XML.

<!-- ### Cons -->

### Inconvénients

<!--
- Does not clone the whole site. Plugins, themes, plugin tables, options, and
  files that are not represented in WXR need separate Blueprint steps.
- Attachment imports require network access and depend on the old media URLs
  remaining available.
- Large XML files use more parsing time and memory than restoring an existing
  SQLite database.
- Re-importing the same file can create duplicates; it is not an idempotent
  synchronization format.
- The Blueprint installs the WordPress Importer dependency automatically, which
  adds setup work before the WXR import starts.
-->

- Ne clone pas l’intégralité du site. Les extensions, thèmes, tables
  d’extensions, options et fichiers non représentés dans WXR nécessitent des
  étapes Blueprint distinctes.
- L’importation des pièces jointes nécessite un accès réseau et dépend de la
  disponibilité des anciennes URL de médias.
- Les fichiers XML volumineux nécessitent plus de temps d’analyse et de mémoire
  que la restauration d’une base de données SQLite existante.
- Réimporter le même fichier peut créer des doublons ; ce n’est pas un format de
  synchronisation idempotent.
- Le Blueprint installe automatiquement la dépendance WordPress Importer, ce qui
  ajoute du travail de configuration avant le début de l’importation WXR.

<!-- ## Generate content with `runPHP` -->

## Générer du contenu avec `runPHP`

<!--
The [`runPHP` step](/blueprints/steps) can call WordPress APIs directly.
Always load `/wordpress/wp-load.php` before calling functions such as
`wp_insert_post()`.

The following example creates the 100 posts used by the benchmark:
-->

L’[étape `runPHP`](/blueprints/steps) peut appeler directement les API WordPress.
Chargez toujours `/wordpress/wp-load.php` avant d’appeler des fonctions telles
que `wp_insert_post()`.

L’exemple suivant crée les 100 articles utilisés par le benchmark :

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\nfor ( $index = 1; $index <= 100; $index++ ) {\n\t$result = wp_insert_post(\n\t\tarray(\n\t\t\t'post_title'   => 'Benchmark post ' . $index,\n\t\t\t'post_content' => '<!-- wp:paragraph --><p>Blueprint import benchmark content.</p><!-- /wp:paragraph -->',\n\t\t\t'post_status'  => 'publish',\n\t\t\t'post_type'    => 'post',\n\t\t),\n\t\ttrue\n\t);\n\tif ( is_wp_error( $result ) ) {\n\t\tthrow new RuntimeException( $result->get_error_message() );\n\t}\n}"
		}
	]
}
```

<!--
For larger programs, keep the code in a small plugin or split the setup across
focused steps instead of maintaining a very long JSON string. Use WordPress
APIs rather than writing directly to database tables so hooks, caches, and data
validation still run.
-->

Pour les programmes plus volumineux, conservez le code dans une petite extension
ou répartissez la configuration en étapes ciblées au lieu de maintenir une très
longue chaîne JSON. Utilisez les API WordPress plutôt que d’écrire directement
dans les tables de la base de données afin que les hooks, les caches et la
validation des données continuent de fonctionner.

<!-- ### Pros -->

### Avantages

<!--
- Provides complete control over the generated data and its relationships.
- Requires no content file and no network access.
- Can configure options, post meta, users, taxonomies, and plugin-specific data
  in the same operation.
- Works well for small test fixtures whose source of truth should remain code.
- Can be made idempotent by looking up existing records before creating them.
-->

- Offre un contrôle total sur les données générées et leurs relations.
- Ne nécessite aucun fichier de contenu ni accès réseau.
- Peut configurer les options, métadonnées, comptes, taxonomies et données
  propres aux extensions dans la même opération.
- Convient aux petits jeux de données de test dont la source de référence doit
  rester le code.
- Peut devenir idempotent en recherchant les enregistrements existants avant de
  les créer.

<!-- ### Cons -->

### Inconvénients

<!--
- Custom PHP is more verbose than exporting existing editorial content.
- The script must handle errors, reruns, dependencies, and partial failures.
- Code can become coupled to a plugin's APIs or database model.
- Creating many records one at a time still runs WordPress hooks and database
  writes for every record, so performance degrades as the dataset grows.
- A Blueprint is trusted input. Only run PHP from a source you trust.
-->

- Le PHP personnalisé est plus verbeux que l’exportation de contenu éditorial
  existant.
- Le script doit gérer les erreurs, réexécutions, dépendances et échecs partiels.
- Le code peut devenir dépendant des API ou du modèle de base de données d’une
  extension.
- La création de nombreux enregistrements un par un exécute toujours les hooks
  WordPress et les écritures en base pour chaque enregistrement. Les performances
  diminuent donc à mesure que le jeu de données augmente.
- Un Blueprint est une entrée de confiance. Exécutez uniquement du PHP provenant
  d’une source fiable.

<!-- ## Restore a Playground ZIP with `importWordPressFiles` -->

## Restaurer un ZIP Playground avec `importWordPressFiles`

<!--
The [`importWordPressFiles` step](/blueprints/steps) is a
site restore, not a content-only import. It unpacks top-level WordPress files
from a ZIP and replaces the corresponding paths in the new instance. A ZIP
created with Playground's **Download as zip** option includes `wp-content`, its
SQLite database, uploads, and a manifest used to adjust Playground scope URLs.

Place the downloaded file next to `blueprint.json` and reference it as a bundled
resource:
-->

L’[étape `importWordPressFiles`](/blueprints/steps) restaure un site ; elle
n’importe pas uniquement son contenu. Elle extrait d’un ZIP les fichiers
WordPress de premier niveau et remplace les chemins correspondants dans la
nouvelle instance. Un ZIP créé avec l’option **Download as zip** de Playground
comprend `wp-content`, sa base de données SQLite, les téléversements et un
manifeste utilisé pour ajuster les URL de portée de Playground.

Placez le fichier téléchargé à côté de `blueprint.json` et référencez-le comme
ressource `bundled` :

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

<!--
The ZIP may contain `wp-content` only, a complete WordPress directory, or a
WordPress directory nested inside a wrapper folder. Use `pathInZip` when the
archive contains several sites or when automatic root detection is not enough.

Keep the source and destination WordPress, PHP, theme, and plugin versions
compatible. The step upgrades the imported database and adjusts Playground
scope URLs, but it is not a general migration tool for arbitrary production
server configurations.
-->

Le ZIP peut contenir uniquement `wp-content`, un répertoire WordPress complet ou
un répertoire WordPress imbriqué dans un dossier conteneur. Utilisez `pathInZip`
lorsque l’archive contient plusieurs sites ou lorsque la détection automatique
de la racine ne suffit pas.

Conservez des versions compatibles de WordPress, PHP, des thèmes et des
extensions entre la source et la destination. Cette étape met à niveau la base
de données importée et ajuste les URL de portée de Playground, mais ce n’est pas
un outil de migration général pour des configurations arbitraires de serveurs de
production.

<!-- ### Pros -->

### Avantages

<!--
- Restores the database, uploads, plugins, themes, and settings together.
- Preserves plugin-specific tables and options that WXR cannot represent.
- Avoids recreating every post through WordPress APIs, which can be efficient
  for a prepared, repeatable demo.
- Works offline when the snapshot is bundled with the Blueprint.
- Produces the closest copy of the source Playground instance.
-->

- Restaure ensemble la base de données, les téléversements, les extensions, les
  thèmes et les réglages.
- Conserve les tables et options propres aux extensions que WXR ne peut pas
  représenter.
- Évite de recréer chaque article au moyen des API WordPress, ce qui peut être
  efficace pour une démo préparée et reproductible.
- Fonctionne hors ligne lorsque l’instantané est inclus avec le Blueprint.
- Produit la copie la plus fidèle de l’instance Playground source.

<!-- ### Cons -->

### Inconvénients

<!--
- Replaces any top-level paths present in the ZIP, so it can overwrite existing
  site state rather than merge content into it.
- Is larger, opaque, and harder to review or resolve in version-control merges.
- Couples the snapshot to its WordPress, PHP, theme, plugin, and database
  versions more tightly than WXR.
- Is unsuitable for importing selected posts into an existing site.
- Must only be restored from a trusted source; it can contain executable PHP
  and an entire database.
-->

- Remplace tous les chemins de premier niveau présents dans le ZIP. Il peut donc
  écraser l’état existant du site au lieu d’y fusionner du contenu.
- Est plus volumineux, opaque et difficile à examiner ou à résoudre lors des
  fusions du contrôle de version.
- Lie l’instantané à ses versions de WordPress, PHP, thèmes, extensions et base
  de données plus étroitement que WXR.
- Ne convient pas à l’importation d’articles sélectionnés dans un site existant.
- Doit uniquement être restauré depuis une source fiable ; il peut contenir du
  PHP exécutable et une base de données entière.

<!-- ## Run the benchmark and example checks -->

## Exécuter le benchmark et les vérifications des exemples

<!--
The repository includes an executable benchmark for the three examples. It
creates the same 100 published posts with each method, starts with a fresh
WordPress site for every round, and fails a round unless exactly 100 matching
posts exist afterward.

From the repository root, run:
-->

Le dépôt comprend un benchmark exécutable pour les trois exemples. Il crée les
mêmes 100 articles publiés avec chaque méthode, part d’un nouveau site WordPress
à chaque série et considère la série comme échouée si elle ne produit pas
exactement 100 articles correspondants.

Depuis la racine du dépôt, exécutez :

```bash
npm exec nx run playground-cli:perf-import-content -- --rounds=5 --posts=100
```

<!--
The benchmark prepares the WordPress runtime, WordPress Importer plugin, WXR
payload, and ZIP snapshot before starting the timer. It measures only the
`importWxr`, `runPHP`, or `importWordPressFiles` operation. Attachment fetching,
runtime boot, resource downloads, ZIP creation, and result verification are not
included. It calls the same step handlers against an in-memory Playground
instance; it is not an end-to-end Playground CLI benchmark.

This controlled scope answers “how long does the import operation take once a
new WordPress instance is ready?” It does not predict a full demo's loading
time. For that, separately measure downloads, WordPress boot, media fetching,
plugin activation, and the first rendered page.
-->

Le benchmark prépare l’environnement d’exécution WordPress, l’extension
WordPress Importer, la charge WXR et l’instantané ZIP avant de démarrer le
chronomètre. Il mesure uniquement l’opération `importWxr`, `runPHP` ou
`importWordPressFiles`. La récupération des pièces jointes, le démarrage de
l’environnement, le téléchargement des ressources, la création du ZIP et la
vérification du résultat ne sont pas inclus. Il appelle les mêmes gestionnaires
d’étapes sur une instance Playground en mémoire ; ce n’est pas un benchmark de
bout en bout de la CLI Playground.

Ce périmètre contrôlé répond à la question : « Combien de temps prend
l’importation une fois qu’une nouvelle instance WordPress est prête ? ». Il ne
prévoit pas le temps de chargement d’une démo complète. Pour cela, mesurez
séparément les téléchargements, le démarrage de WordPress, la récupération des
médias, l’activation des extensions et le rendu de la première page.

<!-- ### Reference result -->

### Résultat de référence

<!--
The following result was measured on July 13, 2026, on an Apple M4 Pro with
24 GB of memory. It used Node.js 22.16, WordPress 7.0, PHP 8.3, 100 posts,
and five fresh-site rounds per method:
-->

Le résultat suivant a été mesuré le 13 juillet 2026 sur un Apple M4 Pro doté de
24 Go de mémoire. Il utilise Node.js 22.16, WordPress 7.0, PHP 8.3, 100 articles
et cinq séries avec un nouveau site pour chaque méthode :

<!--
| Method                       |     Input size | Median | Minimum | Maximum | Relative to fastest |
| ---------------------------- | -------------: | -----: | ------: | ------: | ------------------: |
| XML / `importWxr`            |      106.0 KiB | 2.21 s |  2.16 s |  2.25 s |               6.90x |
| PHP / `runPHP`               | Generated code | 2.78 s |  2.76 s |  2.80 s |               8.68x |
| ZIP / `importWordPressFiles` |       50.5 KiB | 320 ms |  318 ms |  322 ms |               1.00x |
-->

| Méthode                      | Taille en entrée | Médiane | Minimum | Maximum | Par rapport au plus rapide |
| ---------------------------- | ---------------: | ------: | ------: | ------: | -------------------------: |
| XML / `importWxr`            |        106.0 KiB |  2.21 s |  2.16 s |  2.25 s |                      6.90x |
| PHP / `runPHP`               |      Code généré |  2.78 s |  2.76 s |  2.80 s |                      8.68x |
| ZIP / `importWordPressFiles` |         50.5 KiB |  320 ms |  318 ms |  322 ms |                      1.00x |

<!--
Treat these values as a reference from one machine, not a universal ranking.
The dataset shape matters: attachments favor a self-contained ZIP, complex
WordPress hooks can slow `runPHP`, and WXR's portability may be more important
than raw speed.
-->

Considérez ces valeurs comme une référence provenant d’une seule machine, et non
comme un classement universel. La structure du jeu de données compte : les
pièces jointes favorisent un ZIP autonome, des hooks WordPress complexes peuvent
ralentir `runPHP` et la portabilité de WXR peut être plus importante que la
vitesse brute.

<!-- ## Other content sources -->

## Autres sources de contenu

<!--
Blueprints also support [`importThemeStarterContent`](/blueprints/steps)
for a theme's registered starter content and the
[`wp-cli` step](/blueprints/steps) for commands such as
`wp post generate`. They are useful when the theme or WP-CLI command is already
the canonical source of the demo data, but they are outside this content import
benchmark.
-->

Les Blueprints prennent également en charge
[`importThemeStarterContent`](/blueprints/steps) pour le contenu de démarrage
enregistré d’un thème et l’[étape `wp-cli`](/blueprints/steps) pour des commandes
telles que `wp post generate`. Ces méthodes sont utiles lorsque le thème ou la
commande WP-CLI constitue déjà la source canonique des données de la démo, mais
elles ne font pas partie de ce benchmark d’importation de contenu.
