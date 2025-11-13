---
title: Adding PR Preview Buttons with GitHub Actions
slug: /guides/github-action-pr-preview
description: Learn how to enable one-click preview buttons on pull requests for your WordPress plugin or theme using the Playground GitHub Action.
---

When you open a pull request on GitHub for your WordPress plugin or theme, reviewers and contributors often need to test the changes before they can approve them. Setting up a local environment, downloading the branch, and configuring WordPress takes time. The Playground PR Preview action solves this by adding a button directly to your pull requests that launches a working WordPress site with your changes already applied.

This guide walks through setting up automated preview buttons for your repository, from the simplest configuration to advanced setups with custom blueprints.

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

The process involves three jobs: build your code, expose the built artifact on a public URL, and create a preview that uses that URL.

Here is the complete workflow:

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

The build job runs your build process and creates a zip file with the built code. The expose-build job takes that artifact and publishes it to a public URL using GitHub releases. The create-blueprint job constructs a blueprint that tells Playground to install from that URL. Finally, the preview job creates the preview button using that blueprint.

The `artifacts-to-keep` setting controls how many old builds remain available. Setting it to `2` means the action keeps the two most recent builds for each pull request and cleans up older ones automatically.

For themes with build steps, change `installPlugin` to `installTheme` and adjust the build commands accordingly.

See [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) for a working example.

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
        **Testing:** Plugin `{{PLUGIN_SLUG}}`
```

For comments:

```yaml
with:
    mode: comment
    comment-template: |
        ## Preview Changes in WordPress Playground

        {{PLAYGROUND_BUTTON}}

        ### Testing Instructions
        1. Click the button above to open Playground
        2. Navigate to Plugins → Installed Plugins
        3. Verify that `{{PLUGIN_SLUG}}` is active
        4. Test the new functionality

        **PR:** #{{PR_NUMBER}} - {{PR_TITLE}}
```

The action provides many variables you can use in templates:

`{{PLAYGROUND_BUTTON}}` inserts the actual preview button HTML. You should always include this.

`{{PLAYGROUND_URL}}` gives you the full preview URL if you want to create your own link format.

`{{PR_NUMBER}}`, `{{PR_TITLE}}`, `{{PR_HEAD_REF}}`, and `{{PR_BASE_REF}}` provide information about the pull request.

`{{PLUGIN_SLUG}}` and `{{THEME_SLUG}}` give you the detected slug for your plugin or theme.

`{{REPO_OWNER}}`, `{{REPO_NAME}}`, and `{{REPO_FULL_NAME}}` provide repository information.

Variables are case-insensitive, so `{{playground_button}}` works the same as `{{PLAYGROUND_BUTTON}}`.

## Understanding the artifact exposure mechanism

When you use the expose-artifact-on-public-url action, it takes your built code and makes it accessible via a public URL. The way this works is important to understand.

The action creates a single draft release in your repository with a specific tag (by default `ci-artifacts`). It then uploads your built zip file to that release as an asset. Since release assets are publicly accessible, Playground can download and install them.

The action only creates one release total, not one per pull request. Each artifact gets a unique filename based on the pull request number and commit SHA, like `pr-123-abc1234.zip`. When a new commit is pushed to the same pull request, the action uploads a new artifact and removes old ones, keeping only the number you specified in `artifacts-to-keep`.

This approach means you do not accumulate hundreds of releases in your repository. The single draft release stays invisible in your normal release list but provides the public URLs needed for the preview functionality.

If you want to use a different release tag or store artifacts in a different repository, the action supports customization:

```yaml
with:
    artifact-name: 'built-plugin'
    pr-number: ${{ github.event.pull_request.number }}
    commit-sha: ${{ github.sha }}
    release-tag: 'playground-previews'
    release-repository: 'your-org/artifact-storage'
    artifacts-to-keep: '5'
```

The release is created automatically if it does not exist, unless you disable `create-release-if-missing`. You can also disable the cleanup mechanism with `cleanup-enabled: false` if you want to keep all artifacts.

## Permissions and security

The action needs specific GitHub permissions to work. Your workflow must grant:

`pull-requests: write` permission to update pull request descriptions and manage comments.

`contents: read` permission to access repository information.

For workflows that expose artifacts, you also need `contents: write` permission to create releases and upload assets.

The default `GITHUB_TOKEN` automatically has these permissions in most workflows. You only need to specify them explicitly in the job configuration:

```yaml
jobs:
    preview:
        permissions:
            contents: read
            pull-requests: write
        uses: WordPress/action-wp-playground-pr-preview@v2
```

If your repository has specific security policies or branch protection rules, you might need to use a custom token with appropriate permissions. Pass it using the secrets parameter:

```yaml
uses: WordPress/action-wp-playground-pr-preview@v2
with:
    plugin-path: .
secrets:
    github-token: ${{ secrets.CUSTOM_TOKEN }}
```

The action only reads your code and repository metadata. It does not store or transmit your code anywhere except to create the preview link that points to your GitHub repository.

## Using action outputs

The action provides several outputs you can use in subsequent workflow steps:

`preview-url` contains the full URL to the Playground preview.

`blueprint-json` contains the complete blueprint JSON used for the preview.

`rendered-description` or `rendered-comment` contains the final rendered content (depending on mode).

`comment-id` contains the ID of the created comment (in comment mode).

You can access these outputs in later steps:

```yaml
jobs:
    preview:
        permissions:
            contents: read
            pull-requests: write
        uses: WordPress/action-wp-playground-pr-preview@v2
        with:
            plugin-path: .

    notify:
        needs: preview
        runs-on: ubuntu-latest
        steps:
            - name: Print preview URL
              run: echo "Preview available at ${{ needs.preview.outputs.preview-url }}"
```

This capability allows you to integrate the preview URL into other parts of your workflow, such as posting to Slack or updating external tracking systems.

## Troubleshooting common issues

**The preview button does not appear on my pull request.**

Check that your workflow file is on the default branch before you create the pull request. GitHub only runs workflows that exist on the target branch. If you added the workflow in your pull request, merge it first, then create new pull requests.

Verify the workflow ran by checking the Actions tab in your repository. Look for your workflow name and confirm it completed successfully.

**The preview shows a 404 or fails to load my plugin.**

For plugins, check that `plugin-path` points to a directory containing a valid WordPress plugin with a main plugin file. The action looks for PHP files with plugin headers.

For built artifacts, verify the build job actually created the zip file and uploaded it correctly. Check the expose-build job logs to confirm the artifact was found and uploaded.

**The preview loads but my plugin is not activated.**

The action automatically activates plugins and themes by default. If your plugin is not activating, check the browser console in the Playground instance for PHP errors. Your plugin might have dependencies that are not installed or compatibility issues.

Try adding a blueprint with explicit activation:

```yaml
with:
    blueprint: |
        {
          "steps": [
            {
              "step": "installPlugin",
              "pluginData": {
                "resource": "git:directory",
                "url": "https://github.com/your-org/your-repo.git",
                "ref": "your-branch",
                "path": "/"
              },
              "options": { "activate": true }
            }
          ]
        }
```

**My built artifacts are not being cleaned up.**

The cleanup mechanism runs after uploading new artifacts. If the cleanup step fails, old artifacts might remain. Check the workflow logs for the expose-build job to see if any errors occurred during cleanup.

Verify you have `contents: write` permission on the job that runs the expose action. Without this permission, the action cannot delete old release assets.

**The workflow fails with a permissions error.**

Double-check that you have specified the required permissions at the job level. The permissions must be on the specific job that uses the action, not just at the workflow level:

```yaml
jobs:
    preview:
        permissions: # This must be here
            contents: read
            pull-requests: write
```

## Real-world examples

The WordPress ecosystem has several repositories using this action successfully:

The [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) repository uses it to preview blueprint changes. Check their [workflow configuration](https://raw.githubusercontent.com/WordPress/blueprints/6390c687c03035e088d1646cad28b8310bb3f705/.github/workflows/preview-comment.yml).

The [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) repository demonstrates a plugin without build steps. See the [workflow file](https://raw.githubusercontent.com/adamziel/preview-in-playground-button-plugin-example/d15b741deaae32ebef5bdf1009aaed3c614e6f4a/.github/workflows/pr-playground-preview.yml).

The [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) repository shows how to handle plugins that require building. Review the [workflow configuration](https://raw.githubusercontent.com/adamziel/preview-in-playground-button-built-artifact-example/83f91ecf83843b102d19afdf56802b2608a2e98f/.github/workflows/pr-playground-preview.yml).

These examples provide working code you can adapt to your specific needs.

## Next steps

Once you have basic previews working, consider enhancing the experience:

Add demo content to showcase your plugin or theme features. See [Providing content for your demo](/guides/providing-content-for-your-demo).

Create multiple blueprint variations for different use cases. You could have one preview for basic functionality and another that demonstrates advanced features with specific configurations.

Combine the PR preview action with other testing workflows. Run automated tests first, and only create the preview if tests pass.

Add custom instructions in your preview templates to guide reviewers through testing specific functionality.

The PR preview functionality makes your pull requests easier to review and helps contributors test changes without any setup. As you get comfortable with the basics, the full blueprint system opens up many possibilities for creating the perfect preview environment.
