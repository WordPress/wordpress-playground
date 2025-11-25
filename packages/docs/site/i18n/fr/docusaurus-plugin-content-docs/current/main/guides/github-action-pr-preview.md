---
title: Ajout de boutons d'aperçu de PR avec GitHub Actions
slug: /guides/github-action-pr-preview
description: Ajoutez automatiquement des boutons d'aperçu Playground aux pull requests de votre plugin ou thème WordPress.
---

<!--
The Playground PR Preview action adds a preview button to your pull requests. Clicking the button launches Playground with your plugin or theme installed from the PR branch:
-->

L'action d'aperçu de PR Playground ajoute un bouton d'aperçu à vos pull requests. Cliquer sur le bouton lance Playground avec votre plugin ou thème installé depuis la branche du PR :

![PR Preview Button](@site/static/img/try-it-in-playground.png)

<!--
For complete configuration options and advanced features, see the [action-wp-playground-pr-preview workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).
-->

Pour les options de configuration complètes et les fonctionnalités avancées, consultez le [README du workflow action-wp-playground-pr-preview](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).

<!--
## How it works
-->

## Comment ça fonctionne

<!--
The action runs on pull request events (opened, updated, edited). It can either update the PR description with a preview button or post the button as a comment.
-->

L'action s'exécute sur les événements de pull request (ouvert, mis à jour, édité). Elle peut mettre à jour la description du PR avec un bouton d'aperçu ou publier le bouton sous forme de commentaire.

<!--
## Basic setup for plugins
-->

## Configuration de base pour les plugins

<!--
For plugins without a build step, create `.github/workflows/pr-preview.yml`:
-->

Pour les plugins sans étape de build, créez `.github/workflows/pr-preview.yml` :

```yaml
name: PR Preview
on:
    pull_request:
        types: [opened, synchronize, reopened, edited]

jobs:
    preview:
        runs-on: ubuntu-latest
        permissions:
            contents: read
            pull-requests: write
        steps:
            - name: Post Playground Preview Button
              uses: WordPress/action-wp-playground-pr-preview@v2
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  mode: 'append-to-description'
                  plugin-path: .
```

<!--
The `plugin-path: .` setting points to your plugin directory. For subdirectories like `plugins/my-plugin`, use `plugin-path: plugins/my-plugin`.
-->

Le paramètre `plugin-path: .` pointe vers le répertoire de votre plugin. Pour les sous-répertoires comme `plugins/my-plugin`, utilisez `plugin-path: plugins/my-plugin`.

<!--
See [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) for a live example of this workflow in action.
-->

Consultez [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) pour un exemple en direct de ce workflow en action.

<!--
## Basic setup for themes
-->

## Configuration de base pour les thèmes

<!--
For themes, use `theme-path` instead of `plugin-path`:
-->

Pour les thèmes, utilisez `theme-path` au lieu de `plugin-path` :

```yaml
name: PR Preview
on:
    pull_request:
        types: [opened, synchronize, reopened, edited]

jobs:
    preview:
        runs-on: ubuntu-latest
        permissions:
            contents: read
            pull-requests: write
        steps:
            - name: Post Playground Preview Button
              uses: WordPress/action-wp-playground-pr-preview@v2
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  theme-path: .
```

<!--
## Button placement
-->

## Positionnement du bouton

<!--
By default, the action updates the PR description (`mode: append-to-description`). To post as a comment instead:
-->

Par défaut, l'action met à jour la description du PR (`mode: append-to-description`). Pour publier sous forme de commentaire à la place :

```yaml
with:
    plugin-path: .
    mode: comment
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

<!--
The action wraps the button in HTML markers and updates it on subsequent runs. By default, it restores the button if you remove it. To prevent restoration:
-->

L'action enveloppe le bouton dans des marqueurs HTML et le met à jour lors des exécutions suivantes. Par défaut, elle restaure le bouton si vous le supprimez. Pour éviter la restauration :

```yaml
with:
    plugin-path: .
    restore-button-if-removed: false
```

<!--
## Working with built artifacts
-->

## Travailler avec des artefacts compilés

<!--
For plugins or themes requiring compilation, the workflow involves building the code, exposing it via GitHub releases, and creating a blueprint that references the public URL.
-->

Pour les plugins ou thèmes nécessitant une compilation, le workflow implique de compiler le code, de l'exposer via les releases GitHub et de créer un blueprint qui référence l'URL publique.

<!--
Example workflow (see [complete documentation](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts)):
-->

Exemple de workflow (voir la [documentation complète](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts)) :

```yaml
name: PR Preview with Build
on:
    pull_request:
        types: [opened, synchronize, reopened, edited]

permissions:
    contents: write
    pull-requests: write

jobs:
    build:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - name: Build
              run: |
                  npm install
                  npm run build
                  zip -r plugin.zip dist/
            - uses: actions/upload-artifact@v4
              with:
                  name: built-plugin
                  path: plugin.zip

    expose-build:
        needs: build
        runs-on: ubuntu-latest
        permissions:
            contents: write
        outputs:
            artifact-url: ${{ steps.expose.outputs.artifact-url }}
        steps:
            - name: Expose built artifact
              id: expose
              uses: WordPress/action-wp-playground-pr-preview/.github/actions/expose-artifact-on-public-url@v2
              with:
                  artifact-name: 'built-plugin'
                  pr-number: ${{ github.event.pull_request.number }}
                  commit-sha: ${{ github.sha }}
                  artifacts-to-keep: '2'

    create-blueprint:
        needs: expose-build
        runs-on: ubuntu-latest
        outputs:
            blueprint: ${{ steps.blueprint.outputs.result }}
        steps:
            - uses: actions/github-script@v7
              id: blueprint
              with:
                  script: |
                      const blueprint = {
                        steps: [{
                          step: "installPlugin",
                          pluginZipFile: {
                            resource: "url",
                            url: "${{ needs.expose-build.outputs.artifact-url }}"
                          }
                        }]
                      };
                      return JSON.stringify(blueprint);
                  result-encoding: string

    preview:
        needs: create-blueprint
        runs-on: ubuntu-latest
        permissions:
            pull-requests: write
        steps:
            - uses: WordPress/action-wp-playground-pr-preview@v2
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  blueprint: ${{ needs.create-blueprint.outputs.blueprint }}
```

<!--
The `artifacts-to-keep` setting controls how many builds to retain per PR. For themes, change `installPlugin` to `installTheme`.
-->

Le paramètre `artifacts-to-keep` contrôle combien de builds conserver par PR. Pour les thèmes, changez `installPlugin` en `installTheme`.

<!--
See [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) for a complete working example.
-->

Consultez [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) pour un exemple complet fonctionnel.

<!--
## Custom blueprints
-->

## Blueprints personnalisés

<!--
Use blueprints to configure the Playground environment. You can install additional plugins, set WordPress options, import content, or run custom PHP.
-->

Utilisez les blueprints pour configurer l'environnement Playground. Vous pouvez installer des plugins supplémentaires, définir des options WordPress, importer du contenu ou exécuter du PHP personnalisé.

<!--
Example installing your plugin with WooCommerce:
-->

Exemple d'installation de votre plugin avec WooCommerce :

```yaml
jobs:
    create-blueprint:
        name: Create Blueprint
        runs-on: ubuntu-latest
        outputs:
            blueprint: ${{ steps.blueprint.outputs.result }}
        steps:
            - name: Create Blueprint
              id: blueprint
              uses: actions/github-script@v7
              with:
                  script: |
                      const blueprint = {
                        steps: [
                          {
                            step: "installPlugin",
                            pluginData: {
                              resource: "git:directory",
                              url: `https://github.com/${context.repo.owner}/${context.repo.repo}.git`,
                              ref: context.payload.pull_request.head.ref,
                              path: "/"
                            }
                          },
                          {
                            step: "installPlugin",
                            pluginData: {
                              resource: "wordpress.org/plugins",
                              slug: "woocommerce"
                            }
                          }
                        ]
                      };
                      return JSON.stringify(blueprint);
                  result-encoding: string

    preview:
        needs: create-blueprint
        runs-on: ubuntu-latest
        permissions:
            pull-requests: write
        steps:
            - uses: WordPress/action-wp-playground-pr-preview@v2
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  blueprint: ${{ needs.create-blueprint.outputs.blueprint }}
```

<!--
Or reference an external blueprint:
-->

Ou référencez un blueprint externe :

```yaml
with:
    blueprint-url: https://example.com/path/to/blueprint.json
```

<!--
See [Blueprints documentation](/blueprints) for all available steps and configuration options.
-->

Consultez la [documentation des Blueprints](/blueprints) pour tous les pas disponibles et les options de configuration.

<!--
## Template customization
-->

## Personnalisation du template

<!--
Customize the preview content using template variables:
-->

Personnalisez le contenu de l'aperçu en utilisant des variables de template :

```yaml
with:
    plugin-path: .
    description-template: |
        ### Test this PR in WordPress Playground

        {{PLAYGROUND_BUTTON}}

        **Branch:** {{PR_HEAD_REF}}
```

<!--
Available variables: `{{PLAYGROUND_BUTTON}}`, `{{PLUGIN_SLUG}}`, `{{THEME_SLUG}}`, `{{PR_NUMBER}}`, `{{PR_TITLE}}`, `{{PR_HEAD_REF}}`, and more.
-->

Variables disponibles : `{{PLAYGROUND_BUTTON}}`, `{{PLUGIN_SLUG}}`, `{{THEME_SLUG}}`, `{{PR_NUMBER}}`, `{{PR_TITLE}}`, `{{PR_HEAD_REF}}`, et plus.

<!--
See the workflow README for the [complete list](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template).
-->

Consultez le README du workflow pour la [liste complète](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template).

<!--
## Artifact exposure
-->

## Exposition des artefacts

<!--
The `expose-artifact-on-public-url` action uploads built files to a single release (tagged `ci-artifacts` by default). Each artifact gets a unique filename like `pr-123-abc1234.zip`. Old artifacts are automatically cleaned up based on `artifacts-to-keep`.
-->

L'action `expose-artifact-on-public-url` télécharge les fichiers compilés vers une seule release (étiquetée `ci-artifacts` par défaut). Chaque artefact obtient un nom de fichier unique comme `pr-123-abc1234.zip`. Les anciens artefacts sont automatiquement nettoyés en fonction de `artifacts-to-keep`.

<!--
Configuration options: [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs)
-->

Options de configuration : [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs)

<!--
## Troubleshooting
-->

## Dépannage

<!--
**Button not appearing:** Workflow file must exist on the default branch. Check Actions tab for errors.
-->

**Le bouton n'apparaît pas :** Le fichier de workflow doit exister sur la branche par défaut. Vérifiez l'onglet Actions pour les erreurs.

<!--
**Preview fails to load:** Verify path points to valid plugin/theme directory. Check build logs for artifacts.
-->

**L'aperçu ne se charge pas :** Vérifiez que le chemin pointe vers un répertoire de plugin/thème valide. Vérifiez les logs de build pour les artefacts.

<!--
**Not activated:** Check browser console for PHP errors. Dependencies may be missing.
-->

**Non activé :** Vérifiez la console du navigateur pour les erreurs PHP. Les dépendances peuvent être manquantes.

<!--
**Permissions errors:** Set permissions at job level.
-->

**Erreurs de permissions :** Définissez les permissions au niveau du job.

<!--
More: [workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2)
-->

Plus d'informations : [README du workflow](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2)

<!--
## Examples
-->

## Exemples

<!--
-   [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) - Blueprint previews
-   [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) - Plugin without build
-   [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) - Plugin with build
-->

-   [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) - Aperçus de blueprint
-   [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) - Plugin sans build
-   [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) - Plugin avec build

<!--
## Next steps
-->

## Prochaines étapes

<!--
-   Add demo content ([guide](/guides/providing-content-for-your-demo))
-   Create custom blueprints ([docs](/blueprints))
-   Integrate with testing workflows
-   Customize templates for reviewers
-->

-   Ajouter du contenu de démonstration ([guide](/guides/providing-content-for-your-demo))
-   Créer des blueprints personnalisés ([documentation](/blueprints))
-   Intégrer avec les workflows de tests
-   Personnaliser les templates pour les réviseurs
