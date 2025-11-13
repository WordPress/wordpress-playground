---
title: Agregar botones de vista previa de PR con GitHub Actions
slug: /guides/github-action-pr-preview
description: Agregar automáticamente botones de vista previa de Playground a las solicitudes de extracción para tu plugin o tema de WordPress.
---

<!--
The Playground PR Preview action adds a preview button to your pull requests. Clicking the button launches Playground with your plugin or theme installed from the PR branch:
-->

La acción de vista previa de PR de Playground agrega un botón de vista previa a tus solicitudes de extracción. Al hacer clic en el botón se inicia Playground con tu plugin o tema instalado desde la rama del PR:

![PR Preview Button](@site/static/img/try-it-in-playground.png)

<!--
For complete configuration options and advanced features, see the [action-wp-playground-pr-preview workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).
-->

Para opciones de configuración completas y características avanzadas, consulta el [README del flujo de trabajo action-wp-playground-pr-preview](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).

<!--
## How it works
-->

## Cómo funciona

<!--
The action runs on pull request events (opened, updated, edited). It can either update the PR description with a preview button or post the button as a comment.
-->

La acción se ejecuta en eventos de solicitudes de extracción (abierta, actualizada, editada). Puede actualizar la descripción del PR con un botón de vista previa o publicar el botón como un comentario.

<!--
## Basic setup for plugins
-->

## Configuración básica para plugins

<!--
For plugins without a build step, create `.github/workflows/pr-preview.yml`:
-->

Para plugins sin un paso de compilación, crea `.github/workflows/pr-preview.yml`:

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

La configuración `plugin-path: .` apunta a tu directorio de plugin. Para subdirectorios como `plugins/my-plugin`, usa `plugin-path: plugins/my-plugin`.

<!--
See [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) for a live example of this workflow in action.
-->

Consulta [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) para ver un ejemplo en vivo de este flujo de trabajo en acción.

<!--
## Basic setup for themes
-->

## Configuración básica para temas

<!--
For themes, use `theme-path` instead of `plugin-path`:
-->

Para temas, usa `theme-path` en lugar de `plugin-path`:

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

## Ubicación del botón

<!--
By default, the action updates the PR description (`mode: append-to-description`). To post as a comment instead:
-->

Por defecto, la acción actualiza la descripción del PR (`mode: append-to-description`). Para publicar como un comentario en su lugar:

```yaml
with:
    plugin-path: .
    mode: comment
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

<!--
The action wraps the button in HTML markers and updates it on subsequent runs. By default, it restores the button if you remove it. To prevent restoration:
-->

La acción envuelve el botón en marcadores HTML y lo actualiza en ejecuciones posteriores. Por defecto, restaura el botón si lo eliminas. Para evitar la restauración:

```yaml
with:
    plugin-path: .
    restore-button-if-removed: false
```

<!--
## Working with built artifacts
-->

## Trabajar con artefactos compilados

<!--
For plugins or themes requiring compilation, the workflow involves building the code, exposing it via GitHub releases, and creating a blueprint that references the public URL.
-->

Para plugins o temas que requieren compilación, el flujo de trabajo implica compilar el código, exponerlo a través de versiones de GitHub y crear un blueprint que haga referencia a la URL pública.

<!--
Example workflow (see [complete documentation](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts)):
-->

Ejemplo de flujo de trabajo (consulta la [documentación completa](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts)):

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

La configuración `artifacts-to-keep` controla cuántas compilaciones se deben retener por PR. Para temas, cambia `installPlugin` a `installTheme`.

<!--
See [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) for a complete working example.
-->

Consulta [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) para ver un ejemplo completo en funcionamiento.

<!--
## Custom blueprints
-->

## Blueprints personalizados

<!--
Use blueprints to configure the Playground environment. You can install additional plugins, set WordPress options, import content, or run custom PHP.
-->

Usa blueprints para configurar el entorno de Playground. Puedes instalar plugins adicionales, establecer opciones de WordPress, importar contenido o ejecutar PHP personalizado.

<!--
Example installing your plugin with WooCommerce:
-->

Ejemplo instalando tu plugin con WooCommerce:

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

O referencia un blueprint externo:

```yaml
with:
    blueprint-url: https://example.com/path/to/blueprint.json
```

<!--
See [Blueprints documentation](/blueprints) for all available steps and configuration options.
-->

Consulta la [documentación de Blueprints](/blueprints) para ver todos los pasos y opciones de configuración disponibles.

<!--
## Template customization
-->

## Personalización de plantillas

<!--
Customize the preview content using template variables:
-->

Personaliza el contenido de vista previa usando variables de plantilla:

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

Variables disponibles: `{{PLAYGROUND_BUTTON}}`, `{{PLUGIN_SLUG}}`, `{{THEME_SLUG}}`, `{{PR_NUMBER}}`, `{{PR_TITLE}}`, `{{PR_HEAD_REF}}`, y más.

<!--
See the workflow README for the [complete list](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template).
-->

Consulta el README del flujo de trabajo para ver la [lista completa](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template).

<!--
## Artifact exposure
-->

## Exposición de artefactos

<!--
The `expose-artifact-on-public-url` action uploads built files to a single release (tagged `ci-artifacts` by default). Each artifact gets a unique filename like `pr-123-abc1234.zip`. Old artifacts are automatically cleaned up based on `artifacts-to-keep`.
-->

La acción `expose-artifact-on-public-url` carga archivos compilados en una sola versión (etiquetada como `ci-artifacts` por defecto). Cada artefacto obtiene un nombre de archivo único como `pr-123-abc1234.zip`. Los artefactos antiguos se limpian automáticamente según `artifacts-to-keep`.

<!--
Configuration options: [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs)
-->

Opciones de configuración: [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs)

<!--
## Troubleshooting
-->

## Solución de problemas

<!--
**Button not appearing:** Workflow file must exist on the default branch. Check Actions tab for errors.
-->

**El botón no aparece:** El archivo de flujo de trabajo debe existir en la rama predeterminada. Verifica la pestaña Actions para ver errores.

<!--
**Preview fails to load:** Verify path points to valid plugin/theme directory. Check build logs for artifacts.
-->

**La vista previa no se carga:** Verifica que la ruta apunte a un directorio válido de plugin/tema. Verifica los registros de compilación para artefactos.

<!--
**Not activated:** Check browser console for PHP errors. Dependencies may be missing.
-->

**No activado:** Verifica la consola del navegador para errores de PHP. Pueden faltar dependencias.

<!--
**Permissions errors:** Set permissions at job level.
-->

**Errores de permisos:** Establece permisos a nivel de trabajo.

<!--
More: [workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2)
-->

Más información: [README del flujo de trabajo](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2)

<!--
## Examples
-->

## Ejemplos

<!--
-   [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) - Blueprint previews
-   [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) - Plugin without build
-   [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) - Plugin with build
-->

-   [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) - Vistas previas de blueprint
-   [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) - Plugin sin compilación
-   [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) - Plugin con compilación

<!--
## Next steps
-->

## Próximos pasos

<!--
-   Add demo content ([guide](/guides/providing-content-for-your-demo))
-   Create custom blueprints ([docs](/blueprints))
-   Integrate with testing workflows
-   Customize templates for reviewers
-->

-   Agregar contenido de demostración ([guía](/guides/providing-content-for-your-demo))
-   Crear blueprints personalizados ([documentación](/blueprints))
-   Integrar con flujos de trabajo de pruebas
-   Personalizar plantillas para revisores
