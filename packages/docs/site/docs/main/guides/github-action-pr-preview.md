---
title: Adding PR Preview Buttons with GitHub Actions
slug: /guides/github-action-pr-preview
description: Learn how to enable one-click preview buttons on pull requests for your WordPress plugin or theme using the Playground GitHub Action.
---

When you open a pull request on GitHub for your WordPress plugin or theme, reviewers and contributors often need to test the changes before they can approve them. Setting up a local environment, downloading the branch, and configuring WordPress takes time. The Playground PR Preview action solves this by adding a button directly to your pull requests that launches a working WordPress site with your changes already applied.

This guide introduces the basics of setting up preview buttons. For complete configuration options, advanced features, and detailed examples, see the [action-wp-playground-pr-preview workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).

## Understanding PR previews

The Playground PR Preview action adds a clickable button to your pull requests. When someone clicks that button, they get taken to a fully configured WordPress instance running in their browser with your plugin or theme already installed and activated. No downloads, no configuration, no waiting.

The action runs automatically whenever a pull request is opened or updated. It can either update the pull request description with a preview button or post the button as a comment.

## Basic setup for plugins

If your plugin code lives in the root of your repository and does not require a build step, the setup is straightforward. Create a file at `.github/workflows/pr-preview.yml` in your repository:

```yaml
name: PR Preview
on:
    pull_request:
        types: [opened, synchronize, reopened, edited]

jobs:
    preview:
        permissions:
            contents: read
            pull-requests: write
        uses: WordPress/action-wp-playground-pr-preview@v2
        with:
            mode: 'append-to-description'
            plugin-path: .
```

This configuration tells GitHub to run the action whenever a pull request is created or updated. The action will add a preview button to the pull request description automatically.

The `plugin-path: .` setting means your plugin files are in the repository root. If your plugin lives in a subdirectory like `plugins/my-plugin`, change this to `plugin-path: plugins/my-plugin`.

You can see this in action at [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/1).

## Basic setup for themes

Theme setup follows the same pattern. Create `.github/workflows/pr-preview.yml` with this configuration:

```yaml
name: PR Preview
on:
    pull_request:
        types: [opened, synchronize, reopened, edited]

jobs:
    preview:
        permissions:
            contents: read
            pull-requests: write
        uses: WordPress/action-wp-playground-pr-preview@v2
        with:
            theme-path: .
```

The only difference is using `theme-path` instead of `plugin-path`. The action understands that it should install and activate your theme rather than a plugin.

## Choosing where the button appears

The action offers two ways to display the preview button. You can add it to the pull request description or post it as a comment.

Adding to the description keeps the preview button visible at the top of the pull request. The action wraps the button in HTML comment markers so it can update the same spot when the pull request changes. If you remove the button, the action will restore it on the next run unless you configure it differently.

To use comments instead:

```yaml
with:
    plugin-path: .
    mode: comment
```

With comment mode, the action creates a single comment with the preview button and updates that same comment when the pull request changes. This approach keeps the pull request description clean while still providing easy access to previews.

If you want the action to respect when you remove the button from the description, add this setting:

```yaml
with:
    plugin-path: .
    mode: append-to-description
    restore-button-if-removed: false
```

Now when you delete the button from the description, it stays removed.

## Working with built artifacts

Many plugins and themes have build steps that compile assets, transpile code, or bundle files. The raw source code cannot run directly in WordPress without being built first. For these cases, you need a different approach.

The process involves building your code, exposing the built artifact on a public URL using the included `expose-artifact-on-public-url` action, and creating a preview that uses that URL.

Here is a basic example (see the [workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts) for the complete configuration):

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
        permissions:
            pull-requests: write
        uses: WordPress/action-wp-playground-pr-preview@v2
        with:
            blueprint: ${{ needs.create-blueprint.outputs.blueprint }}
```

The workflow builds your code, exposes the artifact on a public URL, creates a blueprint that references that URL, and generates the preview button. The `artifacts-to-keep` setting controls cleanup of old builds.

For themes with build steps, change `installPlugin` to `installTheme` and adjust the build commands accordingly.

For complete details on artifact exposure, cleanup options, and advanced configurations, refer to the [Advanced: Testing Built CI Artifacts](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts) section of the workflow README. See also [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) for a working example.

## Customizing the preview experience

Beyond just loading your plugin or theme, you often want to create a specific environment that showcases your work effectively. This is where blueprints come in.

A blueprint is a JSON configuration that describes exactly how to set up the WordPress instance. You can install additional plugins, configure WordPress settings, import content, or run custom PHP code.

Here is an example that installs your plugin along with WooCommerce:

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
        permissions:
            pull-requests: write
        uses: WordPress/action-wp-playground-pr-preview@v2
        with:
            blueprint: ${{ needs.create-blueprint.outputs.blueprint }}
```

The first step loads your plugin directly from the pull request branch. The second step installs WooCommerce from the WordPress.org plugins directory. When someone clicks the preview button, they get both plugins installed and activated.

You can also reference a blueprint file hosted elsewhere:

```yaml
with:
    blueprint-url: https://example.com/path/to/blueprint.json
```

This approach works well when your blueprint is complex or you want to maintain it separately from your GitHub Actions workflow.

For more details on what you can do with blueprints, see the [Blueprints documentation](/blueprints).

## Customizing button text and formatting

The default preview button works well, but you might want to add context or instructions around it. The action supports custom templates with variable interpolation.

For pull request descriptions:

```yaml
with:
    plugin-path: .
    description-template: |
        ### Test this PR in WordPress Playground

        {{PLAYGROUND_BUTTON}}

        **Branch:** {{PR_HEAD_REF}}
```

For comments:

```yaml
with:
    mode: comment
    comment-template: |
        ## Preview Changes in WordPress Playground

        {{PLAYGROUND_BUTTON}}

        **PR:** #{{PR_NUMBER}} - {{PR_TITLE}}
```

Common template variables include `{{PLAYGROUND_BUTTON}}`, `{{PLUGIN_SLUG}}`, `{{THEME_SLUG}}`, `{{PR_NUMBER}}`, `{{PR_TITLE}}`, and `{{PR_HEAD_REF}}`. For the complete list of available variables and examples, see the [description-template](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template) and [comment-template](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#comment-template) sections in the workflow README.

## Understanding artifact exposure

When you use the expose-artifact-on-public-url action, it creates a single draft release in your repository (by default tagged `ci-artifacts`) and uploads your built zip file as a release asset. Each artifact gets a unique filename based on the pull request number and commit SHA. The action automatically cleans up old artifacts, keeping only the number you specify in `artifacts-to-keep`.

This approach means you do not accumulate hundreds of releases in your repository. The single draft release stays invisible in your normal release list but provides the public URLs needed for the preview functionality.

For configuration options including custom release tags, alternative repositories, and cleanup settings, see the [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs) section in the workflow README.

## Permissions and security

The action requires `pull-requests: write` and `contents: read` permissions. For workflows that expose built artifacts, you also need `contents: write` permission. The default `GITHUB_TOKEN` automatically has these permissions in most workflows:

```yaml
jobs:
    preview:
        permissions:
            contents: read
            pull-requests: write
        uses: WordPress/action-wp-playground-pr-preview@v2
```

For custom token requirements, see the [Secrets](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#secrets) section in the workflow README.

## Using action outputs

The action provides outputs including `preview-url`, `blueprint-json`, `rendered-description`, `rendered-comment`, and `comment-id`. You can use these in subsequent workflow steps to integrate the preview URL into other parts of your workflow, such as posting to Slack or updating external tracking systems.

For details on available outputs and usage examples, see the [Outputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#outputs) section in the workflow README.

## Troubleshooting

**The preview button does not appear:** Check that your workflow file exists on the default branch before creating the pull request. Verify the workflow ran successfully in the Actions tab.

**The preview fails to load:** Ensure `plugin-path` or `theme-path` points to a valid plugin or theme directory. For built artifacts, check the build and expose-build job logs.

**Plugin or theme not activated:** Check the browser console in the Playground instance for PHP errors. Your code might have missing dependencies or compatibility issues.

**Permissions errors:** Verify you specified the required permissions at the job level, not just the workflow level.

For more troubleshooting guidance, configuration details, and input options, refer to the complete [action-wp-playground-pr-preview workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).

## Examples and next steps

The [workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#usage-in-other-repositories) lists repositories using this action, including:

-   [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) for previewing blueprint changes
-   [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) for plugins without build steps
-   [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) for plugins requiring build steps

Once you have basic previews working, consider:

-   Adding demo content to showcase features (see [Providing content for your demo](/guides/providing-content-for-your-demo))
-   Creating custom blueprints for different testing scenarios (see [Blueprints documentation](/blueprints))
-   Combining PR previews with automated testing workflows
-   Customizing templates to guide reviewers through testing specific functionality

The PR preview functionality makes pull requests easier to review and helps contributors test changes without any setup.
