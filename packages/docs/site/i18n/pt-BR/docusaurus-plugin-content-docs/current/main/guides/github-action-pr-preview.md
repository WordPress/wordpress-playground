---
title: Adicionando Botões de Pré-visualização de PR com GitHub Actions
slug: /guides/github-action-pr-preview
description: Adicione automaticamente botões de pré-visualização do Playground aos pull requests do seu plugin ou tema WordPress.
---

<!--
The Playground PR Preview action adds a preview button to your pull requests. Clicking the button launches Playground with your plugin or theme installed from the PR branch:
-->

A ação de Pré-visualização de PR do Playground adiciona um botão de pré-visualização aos seus pull requests. Clicar no botão inicia o Playground com seu plugin ou tema instalado a partir da branch do PR:

![PR Preview Button](@site/static/img/try-it-in-playground.png)

<!--
For complete configuration options and advanced features, see the [action-wp-playground-pr-preview workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).
-->

Para opções de configuração completas e recursos avançados, consulte o [README do workflow action-wp-playground-pr-preview](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).

<!--
## How it works
-->

## Como funciona

<!--
The action runs on pull request events (opened, updated, edited). It can either update the PR description with a preview button or post the button as a comment.
-->

A ação é executada em eventos de pull request (aberto, atualizado, editado). Ela pode atualizar a descrição do PR com um botão de pré-visualização ou postar o botão como um comentário.

<!--
## Basic setup for plugins
-->

## Configuração básica para plugins

<!--
For plugins without a build step, create `.github/workflows/pr-preview.yml`:
-->

Para plugins sem uma etapa de build, crie `.github/workflows/pr-preview.yml`:

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

A configuração `plugin-path: .` aponta para o diretório do seu plugin. Para subdiretórios como `plugins/my-plugin`, use `plugin-path: plugins/my-plugin`.

<!--
See [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) for a live example of this workflow in action.
-->

Veja [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) para um exemplo ao vivo deste workflow em ação.

<!--
## Basic setup for themes
-->

## Configuração básica para temas

<!--
For themes, use `theme-path` instead of `plugin-path`:
-->

Para temas, use `theme-path` em vez de `plugin-path`:

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

## Posicionamento do botão

<!--
By default, the action updates the PR description (`mode: append-to-description`). To post as a comment instead:
-->

Por padrão, a ação atualiza a descrição do PR (`mode: append-to-description`). Para postar como um comentário:

```yaml
with:
    plugin-path: .
    mode: comment
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

<!--
The action wraps the button in HTML markers and updates it on subsequent runs. By default, it restores the button if you remove it. To prevent restoration:
-->

A ação envolve o botão em marcadores HTML e o atualiza em execuções subsequentes. Por padrão, ela restaura o botão se você o remover. Para evitar a restauração:

```yaml
with:
    plugin-path: .
    restore-button-if-removed: false
```

<!--
## Working with built artifacts
-->

## Trabalhando com artefatos compilados

<!--
For plugins or themes requiring compilation, the workflow involves building the code, exposing it via GitHub releases, and creating a blueprint that references the public URL.
-->

Para plugins ou temas que requerem compilação, o workflow envolve compilar o código, expô-lo através de releases do GitHub e criar um blueprint que referencia a URL pública.

<!--
Example workflow (see [complete documentation](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts)):
-->

Exemplo de workflow (veja a [documentação completa](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts)):

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

A configuração `artifacts-to-keep` controla quantos builds manter por PR. Para temas, altere `installPlugin` para `installTheme`.

<!--
See [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) for a complete working example.
-->

Veja [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) para um exemplo completo funcionando.

<!--
## Custom blueprints
-->

## Blueprints personalizados

<!--
Use blueprints to configure the Playground environment. You can install additional plugins, set WordPress options, import content, or run custom PHP.
-->

Use blueprints para configurar o ambiente do Playground. Você pode instalar plugins adicionais, definir opções do WordPress, importar conteúdo ou executar PHP personalizado.

<!--
Example installing your plugin with WooCommerce:
-->

Exemplo instalando seu plugin com WooCommerce:

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

Ou referencie um blueprint externo:

```yaml
with:
    blueprint-url: https://example.com/path/to/blueprint.json
```

<!--
See [Blueprints documentation](/blueprints) for all available steps and configuration options.
-->

Consulte a [documentação de Blueprints](/blueprints) para todos os passos disponíveis e opções de configuração.

<!--
## Template customization
-->

## Personalização de template

<!--
Customize the preview content using template variables:
-->

Personalize o conteúdo da pré-visualização usando variáveis de template:

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

Variáveis disponíveis: `{{PLAYGROUND_BUTTON}}`, `{{PLUGIN_SLUG}}`, `{{THEME_SLUG}}`, `{{PR_NUMBER}}`, `{{PR_TITLE}}`, `{{PR_HEAD_REF}}`, e mais.

<!--
See the workflow README for the [complete list](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template).
-->

Consulte o README do workflow para a [lista completa](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template).

<!--
## Artifact exposure
-->

## Exposição de artefatos

<!--
The `expose-artifact-on-public-url` action uploads built files to a single release (tagged `ci-artifacts` by default). Each artifact gets a unique filename like `pr-123-abc1234.zip`. Old artifacts are automatically cleaned up based on `artifacts-to-keep`.
-->

A ação `expose-artifact-on-public-url` faz upload de arquivos compilados para um único release (marcado como `ci-artifacts` por padrão). Cada artefato recebe um nome de arquivo único como `pr-123-abc1234.zip`. Artefatos antigos são automaticamente limpos com base em `artifacts-to-keep`.

<!--
Configuration options: [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs)
-->

Opções de configuração: [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs)

<!--
## Troubleshooting
-->

## Solução de problemas

<!--
**Button not appearing:** Workflow file must exist on the default branch. Check Actions tab for errors.
-->

**Botão não aparece:** O arquivo de workflow deve existir no branch padrão. Verifique a aba Actions para erros.

<!--
**Preview fails to load:** Verify path points to valid plugin/theme directory. Check build logs for artifacts.
-->

**Pré-visualização falha ao carregar:** Verifique se o caminho aponta para um diretório válido de plugin/tema. Verifique os logs de build para artefatos.

<!--
**Not activated:** Check browser console for PHP errors. Dependencies may be missing.
-->

**Não ativado:** Verifique o console do navegador para erros de PHP. As dependências podem estar faltando.

<!--
**Permissions errors:** Set permissions at job level.
-->

**Erros de permissão:** Defina permissões no nível do job.

<!--
More: [workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2)
-->

Mais informações: [README do workflow](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2)

<!--
## Examples
-->

## Exemplos

<!--
-   [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) - Blueprint previews
-   [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) - Plugin without build
-   [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) - Plugin with build
-->

- [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) - Pré-visualizações de blueprint
- [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) - Plugin sem build
- [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) - Plugin com build

<!--
## Next steps
-->

## Próximos passos

<!--
-   Add demo content ([guide](/guides/providing-content-for-your-demo))
-   Create custom blueprints ([docs](/blueprints))
-   Integrate with testing workflows
-   Customize templates for reviewers
-->

- Adicionar conteúdo de demonstração ([guia](/guides/providing-content-for-your-demo))
- Criar blueprints personalizados ([documentação](/blueprints))
- Integrar com workflows de testes
- Personalizar templates para revisores
