---
slug: /contributing/translations
title: Contributions aux traductions
description: Apprenez comment traduire la documentation de Playground, y compris la structure des fichiers, les tests locaux et le processus de révision.
---

<!--
# Contributions to translations

Help make WordPress Playground accessible to a global audience by translating its documentation. This guide provides everything you need to know to get started. Contributing translations follows the same workflow as any other documentation change. You can either fork the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository and create a pull request (PR) with your changes or edit pages directly using the GitHub UI.
-->

# Contributions aux traductions

Aidez à rendre WordPress Playground accessible à un public plus large en traduisant sa documentation. Ce guide fournit tout ce que vous devez savoir pour commencer. Contribuer à la traduction suit le même flux de travail que tout autre modification de la documentation. Vous pouvez soit forker le dépôt [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) et créer une pull request (PR) avec vos modifications, soit éditer les pages directement en utilisant l’interface GitHub.

<!--
:::info
For a detailed guide on the contribution workflow (forking, creating PRs, etc.), please see our [documentation contribution guide](/contributing/documentation#how-can-i-contribute)
:::
-->

:::info
Pour un guide détaillé sur le flux de travail de la contribution (fork, création de PR, etc.), veuillez consulter notre [guide de contribution à la documentation](/contributing/documentation#how-can-i-contribute)
:::

<!--
## How Translations Work

Playground's documentation site is built with Docusaurus, which handles the internationalization (i18n) features.
-->

## Comment fonctionnent les traductions

Le site de documentation de Playground est construit avec Docusaurus, qui gère les fonctionnalités d'internationalisation (i18n).

<!--
:::info
To learn more about how Docusaurus manages translations, see the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of the official Docusaurus documentation.
:::
-->

:::info
Pour en savoir plus sur la façon dont Docusaurus gère les traductions, consultez la [section Internationalisation](https://docusaurus.io/docs/i18n/introduction) de la documentation officielle de Docusaurus.
:::

<!--
### Configuration

Available languages are defined in the `packages/docs/site/docusaurus.config.js` file. For example:
-->

### Configuration

Les langues disponibles sont définies dans le fichier `packages/docs/site/docusaurus.config.js`. Par exemple :

```
i18n: {
  defaultLocale: 'en',
  path: 'i18n',
  locales: ['en', 'fr'],
  localeConfigs: {
	en: {
		label: 'English',
		path: 'en',
	},
	fr: {
		label: 'French',
		path: 'fr',
	},
  },
}
```

<!--
### File Structure

All translated documentation pages are located within the `packages/docs/site/i18n/` directory, organized by language code.

For a language to work correctly, its file structure must mirror the original English documentation found in `packages/docs/site/docs`.

For example, the Spanish (es) translation for `docs/main/intro.md` must be placed at:
packages`/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.

If a translated file does not exist for a specific language, Docusaurus will automatically fall back to the English version of that page.
-->

### Structure des fichiers

Toutes les pages de documentation traduites se trouvent dans le répertoire `packages/docs/site/i18n/`, organisées par code de langue.

Pour qu'une langue fonctionne correctement, sa structure de fichiers doit refléter exactement la documentation originale en anglais qui se trouvant dans `packages/docs/site/docs`.

Par exemple, la traduction espagnole (es) pour `docs/main/intro.md` doit être placée à :
`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.

Si un fichier traduit n'existe pas pour une langue spécifique, Docusaurus reviendra automatiquement à la version anglaise de cette page.

<!--
### Generating Translation Files

When adding a new language, you can generate the necessary JSON files for UI strings (like button labels and navigation items) by running the following command from the `packages/docs/site` directory:

```bash
npm run write-translations -- --locale <LANGUAGE_CODE>
```

With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

### Génération des fichiers de traduction

Lors de l'ajout d'une nouvelle langue, vous pouvez générer les fichiers JSON nécessaires pour les chaînes d'interface utilisateur (comme les étiquettes de boutons et les éléments de navigation) en exécutant la commande suivante depuis le répertoire `packages/docs/site` :

```bash
npm run write-translations -- --locale <CODE_LANGUE>
```

Avec la configuration i18n appropriée dans `docusaurus.config.js` et les fichiers sous `i18n`, lors de l'exécution de `npm run build:docs` depuis la racine du projet, des dossiers spécifiques sous `dist` pour chaque langue seront créés.

<!--
## Testing Translations Locally

To preview your changes for an existing language:

1. Modify or add a translated file in the appropriate language directory, such as `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. From the `/packages/docs/site` directory, run the local development server for your target language. For example, to test Spanish (es):
-->

## Test des traductions en local

Pour prévisualiser vos modifications pour une langue existante :

1. Modifiez ou ajoutez un fichier traduit dans le répertoire de langue approprié, tel que `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. Depuis le répertoire `/packages/docs/site`, lancez le serveur de développement local pour votre langue cible. Par exemple, pour tester l'espagnol (es) :

```bash

npm run dev -- --locale es

```

<!--
## The Language Switcher

The language switcher is a dropdown menu that allows users to select their preferred language.

![Documentation Language Switcher](@site/static/img/contributing/language-switcher-docs.webp)
-->

## Le sélecteur de langue

Le sélecteur de langue est un menu déroulant qui permet aux utilisateurs de sélectionner leur langue préférée.

![Sélecteur de langue de la documentation](@site/static/img/contributing/language-switcher-docs.webp)

<!--
### Making a language publicly available on the Language Switcher

We recommend only adding a language to the switcher when a significant portion of the documentation has been translated. This avoids a poor user experience where switching to a new language results in seeing mostly untranslated English content.

As a guideline, a language should be made publicly available in the switcher only when the entire "Documentation" hub is translated, including these key sections:

-   [Quick Start Guide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Playground web instance](https://wordpress.github.io/wordpress-playground/web-instance)
-   [About Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guides](https://wordpress.github.io/wordpress-playground/guides)
-   [Contributing](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links and Resources](https://wordpress.github.io/wordpress-playground/resources)
-->

### Rendre une langue publiquement disponible dans le sélecteur de langue

Nous recommandons d'ajouter une langue au sélecteur uniquement lorsqu'une partie importante de la documentation a été traduite. Cela évite une mauvaise expérience utilisateur où le passage à une nouvelle langue entraîne l'affichage de contenu anglais principalement non traduit.

À titre indicatif, une langue devrait être rendue publiquement disponible dans le sélecteur uniquement lorsque l'ensemble du hub "Documentation" est traduit, y compris ces sections clés :

-   [Guide de démarrage rapide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Instance web Playground](https://wordpress.github.io/wordpress-playground/web-instance)
-   [À propos de Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guides](https://wordpress.github.io/wordpress-playground/guides)
-   [Contribuer](https://wordpress.github.io/wordpress-playground/contributing)
-   [Liens et ressources](https://wordpress.github.io/wordpress-playground/resources)

<!--
All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/
-->

Toutes les langues sont disponibles une fois que la configuration i18n pour une langue est complète et que la structure de fichiers correcte est en place sous `i18n`.

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

En supposant que la langue `fr` soit la première langue avec les pages du hub Documentation (Guide de démarrage rapide, Instance web Playground, À propos de Playground, Guides,...) complètement traduites en français, le `docusaurus.config.js` devrait ressembler à ceci dans cette branche pour que `npm run build:docs` génère correctement le sous-site `fr` et n'affiche que la langue française dans le sélecteur de langue `localeDropdown`.

```
  {
    "i18n": {
      "defaultLocale": "en",
      "path": "i18n",
      "locales": [
        "en",
        "fr"
      ],
      "localeConfigs": {
        "en": {
          "label": "English",
          "path": "en"
        },
        "fr": {
          "label": "French",
          "path": "fr"
        }
      }
    }
  },
  {
    "type": "localeDropdown",
    "position": "right"
  }
```

<!--
## Translation Workflow

Follow these steps to translate a page:

1. **Check for an Existing Translation Issue**: First, [search the repository issues](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) to see if a tracking issue for your desired language already exists. If it does, comment on the issue to claim the page(s) you would like to translate.
2. **Create a New Translation Issue**: If no issue exists, please create a new one to track the translation progress for the language. You can model it after issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) and use the markdown checklist below to track progress.
3. **Translate the File**:

-   Check if you have the latest version of the documentation
-   Copy the original .md file from `packages/docs/site/docs/...` to the corresponding path in the language directory (e.g., `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). It is crucial to replicate the original file structure.
-   Translate the content of the new file, keeping the original content commented out `English Content`.
-   The assets are listed at `packages/docs/site/static/img/` only place assets inside the translation folder when it requires localized content.
-   Once the translations are ready, check if the docs build script is running properly `npm run build:docs`.

4. **Create a pull request with your changes**

-   Describe the pages that you translated
-   Request a review at `#playground` or `#polyglots` at `wordpress.slack.com`
-->

## Flux de travail pour la traduction

Suivez ces étapes pour traduire une page :

1. **Vérifiez s'il existe déjà une issue de traduction** : D'abord, [recherchez dans les issues du dépôt](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) pour voir si une issue de suivi pour la langue souhaitée existe déjà. Si c’est le cas, commentez dans l’issue pour revendiquer la/les page(s) que vous souhaitez traduire.
2. **Créez une nouvelle issue de traduction** : Si aucune issue n’existe, veuillez en créer une nouvelle pour suivre les progrès de traduction pour la langue. Vous pouvez vous inspirer de l’issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) et utiliser la liste de vérification en markdown ci-dessous pour suivre l’avancée.
3. **Traduisez le fichier** :

-   Vérifiez si vous avez la dernière version de la documentation
-   Copiez le fichier .md original de `packages/docs/site/docs/...` vers le chemin correspondant dans le répertoire de langue (par exemple, `packages/docs/site/i18n/<CODE_LANGUE>/...`). Il est crucial de reproduire la structure de fichiers originale.
-   Traduisez le contenu du nouveau fichier, en gardant le contenu original commenté `<!-- Contenu anglais -->`.
-   Les ressources sont listées dans `packages/docs/site/static/img/`, ne placez les ressources dans le dossier de traduction que lorsqu'elles nécessitent du contenu localisé.
-   Une fois les traductions prêtes, vérifiez si le script de build de la documentation fonctionne correctement `npm run build:docs`.

4. **Créez une pull request avec vos modifications**

-   Décrivez les pages que vous avez traduites
-   Demandez une révision sur `#playground` ou `#polyglots` sur `wordpress.slack.com`

<!--
:::info
We highly recommend submitting pull requests with a small number of translated pages. This approach simplifies the review process and allows for a more gradual and manageable integration of your work.
:::
-->

:::info
Nous recommandons fortement de soumettre des pull requests avec un petit nombre de pages traduites. Cette approche simplifie le processus de révision et permet une intégration plus progressive et gérable de votre travail.
:::

<!--
### Translation Tracking Template

You can use the following markdown in your tracking issue:
-->

### Modèle de suivi des traductions

Vous pouvez utiliser le markdown suivant dans votre issue de suivi:

```markdown
## Pages de traduction restantes

<details open>
<summary><h3>Principal</h3></summary>

-   about
    -   [ ] build.md #2291
    -   [ ] index.md #2282
    -   [ ] launch.md #2292
    -   [ ] test.md #2302
-   contributing
    -   [ ] code.md #2218
    -   [ ] coding-standards.md #2219
    -   [ ] contributor-day.md #2246
    -   [ ] contributor-badge.md
    -   [ ] documentation.md #2271
    -   [ ] translations.md #2201
-   guides
    -   [ ] for-plugin-developers.md #2210
    -   [ ] for-theme-developers.md #2211
    -   [ ] index.md #2209
    -   [ ] providing-content-for-your-demo.md #2213
    -   [ ] wordpress-native-ios-app.md #2214
-   [ ] intro.md #2198
-   [ ] quick-start-guide.md #2204
-   [ ] resources.md #2207
-   [ ] web-instance.md #2208

</details>

<details open>
<summary><h3>Blueprints</h3></summary>

-   blueprints
    -   [ ] 01-index.md #2305
    -   [ ] 02-using-blueprints.md #2330
    -   [ ] 03-data-format.md #2340
    -   [ ] 04-resources.md #2352
    -   [ ] 05-steps-shorthands.md #2386
    -   [ ] 05-steps.md #2386
    -   [ ] 06-bundles.md #2438
    -   [ ] 07-json-api-and-function-api.md #2438
    -   [ ] 08-examples.md #2474
    -   [ ] 09-troubleshoot-and-debug-blueprints.md #2474
    -   [ ] intro.md #2489
    -   tutorial - [ ] 01-what-are-blueprints-what-you-can-do-with-them.md #2511 - [ ] 02-how-to-load-run-blueprints.md #2526 - [ ] 03-build-your-first-blueprint.md - [ ] index.md #2511
    </details>

<details open>
<summary><h3>Développeurs</h3></summary>

-   [ ] developers
    -   [ ] 03-build-an-app
        -   [ ] 01-index.md
    -   [ ] 05-local-development
        -   [ ] 01-wp-now.md
        -   [ ] 02-vscode-extension.md
        -   [ ] 03-php-wasm-node.md
        -   [ ] intro.md
    -   [ ] 06-apis
        -   [ ] 01-index.md
        -   [ ] javascript-api
            -   [ ] 01-index.md
            -   [ ] 02-index-html-vs-remote-html.md
            -   [ ] 03-playground-api-client.md
            -   [ ] 04-blueprint-json-in-api-client.md
            -   [ ] 05-blueprint-functions-in-api-client.md
            -   [ ] 06-mount-data.md
        -   [ ] query-api
            -   [ ] 01-index.md
    -   [ ] 23-architecture
        -   [ ] 01-index.md
        -   [ ] 02-wasm-php-overview.md
        -   [ ] 03-wasm-php-compiling.md
        -   [ ] 04-wasm-php-javascript-module.md
        -   [ ] 05-wasm-php-filesystem.md
        -   [ ] 07-wasm-asyncify.md
        -   [ ] 08-browser-concepts.md
        -   [ ] 09-browser-tab-orchestrates-execution.md
        -   [ ] 10-browser-iframe-rendering.md
        -   [ ] 11-browser-php-worker-threads.md
        -   [ ] 12-browser-service-workers.md
        -   [ ] 13-browser-scopes.md
        -   [ ] 14-browser-cross-process-communication.md
        -   [ ] 15-wordpress.md
        -   [ ] 16-wordpress-database.md
        -   [ ] 17-browser-wordpress.md
        -   [ ] 18-host-your-own-playground.md
    -   [ ] 24-limitations
        -   [ ] 01-index.md
    -   [ ] intro-devs.md
    </details>
```

<!--
## Review Process

To simplify the review process, please keep the original English text as a comment directly above the translated content.
-->

## Processus de révision

Pour simplifier le processus de révision, veuillez garder le texte anglais original comme commentaire directement au-dessus du contenu traduit.

```markdown
<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 Salut ! Bienvenue dans la documentation de WordPress Playground.

Playground est un outil en ligne pour expérimenter et apprendre WordPress. Ce site (Documentation) est l'endroit où vous trouverez toutes les informations nécessaires pour commencer à utiliser Playground.
```

<!--
:::info
This practice also helps the maintenance team identify outdated translations. When the original English content is updated, we can search the codebase for the old text (now in comments) and flag the corresponding translation for review.
:::
-->

:::info
Cette pratique aide également l'équipe de maintenance à identifier les traductions obsolètes. Lorsque le contenu anglais original est mis à jour, nous pouvons rechercher dans la base de code l'ancien texte (maintenant dans les commentaires) et signaler la traduction correspondante pour révision.
:::

<!--
To find a reviewer fluent in the language of your PR, you can post a request on the [Make WordPress Polyglots blog](https://make.wordpress.org/polyglots/). Be sure to include the locale tag (e.g., #ja for Japanese) to notify the appropriate General Translation Editors (GTEs).

When the PR is merged, the translated version of that page should appear under `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, if you are contributing for the first time request your [Contributor Badge](/contributing/contributor-badge).
-->

Pour trouver un réviseur/réviseuse maîtrisant la langue de votre PR, vous pouvez publier une demande sur le [blog Make WordPress Polyglots](https://make.wordpress.org/polyglots/). Assurez-vous d’y inclure le tag de la locale (par exemple, `#fr` pour le français) pour notifier les responsables généraux de la traduction (GTE) appropriés.

Lorsque la PR est fusionnée, la version traduite de cette page devrait apparaître sous `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, si vous contribuez pour la première fois, demandez votre [badge de contributeur/contributrice](/contributing/contributor-badge).
