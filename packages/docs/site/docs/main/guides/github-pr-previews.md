---
title: Adding Playground Preview Buttons to Pull Requests
slug: /guides/github-pr-previews
description: Automatically add a "Preview in WordPress Playground" button to your pull requests, enabling easy testing and feedback for WordPress plugins and themes.
---

# Adding Playground Preview Buttons to Pull Requests

Playground ships a GitHub workflow that automatically adds a "Preview in WordPress Playground" button to your pull requests:

![Preview Button Example](../../../static/images/preview-button-example.png)

This helps reviewers and contributors test your WordPress plugins and themes with a single click.

## Requirements

-   Your repository must be public
-   You need to run this on `pull_request` events
-   Required permissions: `pull-requests: write` and `contents: read`

## Quick start

First, figure out where your plugin or theme lives in your repository. This matters because the workflow needs to know what to install.

### Step 1: Find your code

Open your repository and look at the file structure:

-   Repo with a single plugin or theme?
    -   **Plugin in the root?** If you see a `.php` file with plugin headers right in the root (like `my-plugin.php`), your `plugin-path` is `.`
    -   **Plugin in a folder?** If your plugin is in something like `plugins/my-plugin/`, your `plugin-path` is `plugins/my-plugin`
    -   **Theme in the root?** If you see `style.css` with theme headers in the root, your `theme-path` is `.`
    -   **Theme in a folder?** If your theme is in `themes/my-theme/`, your `theme-path` is `themes/my-theme`
-   **More complex setup?** Skip over to the _Advanced: Custom blueprints_ section below.

### Step 2: Create the workflow file

Create a new file at `.github/workflows/pr-preview.yml` in your repository.

**For a plugin:**

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
        uses: WordPress/wordpress-playground/.github/workflows/playground-preview-button.yml@workflow-1.0.0
        with:
            plugin-path: . # Change this to match your directory structure
```

**For a theme:**

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
        uses: WordPress/wordpress-playground/.github/workflows/playground-preview-button.yml@workflow-1.0.0
        with:
            theme-path: . # Change this to match your directory structure
```

**For both:**

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
        uses: WordPress/wordpress-playground/.github/workflows/playground-preview-button.yml@workflow-1.0.0
        with:
            plugin-path: plugins/my-plugin # Change these to match
            theme-path: themes/my-theme # your directory structure
```

### Step 3: Update the path

Change `plugin-path` or `theme-path` to match where your code actually lives. Use what you found in Step 1.

### Step 4: Commit and push

Commit this new file to your repository. The next time someone opens a PR, the preview button will appear.

### Not working?

Check the Actions tab in your repository. You'll see error messages there if something went wrong. Common issues:

-   Wrong path (double-check where your plugin/theme actually is)
-   Missing plugin header or `style.css`
-   Repository isn't public

## How to configure

Here's a basic config with the available inputs documented inline:

```yml
name: PR Playground Preview

on:
    pull_request:
        types:
            - opened # When someone creates a new PR
            - synchronize # When new commits are pushed to the PR
            - reopened # When a closed PR is reopened
            - edited # When PR title or description changes

jobs:
    # This job adds the preview button to your PR
    playground-preview:
        name: Update Playground Preview
        # Wait for the blueprint to be created first
        needs: create-blueprint
        permissions:
            contents: read # Read repository information
            pull-requests: write # Update PR descriptions
            issues: write # Post/update comments (PRs are issues under the hood)
        uses: WordPress/wordpress-playground/.github/workflows/playground-preview.yml@workflow-1.0.0
        with:
            # "append-to-description"  – add the button to the PR description
            # "post-comment"           – create a new comment with the preview button
            mode: 'append-to-description'

            # Use our custom blueprint with the PR branch
            blueprint: ${{ needs.create-blueprint.outputs.blueprint }}

            # # If you just want to install a plugin from a specific path in this repository
            # # and you don't really need an entire custom blueprint, you can used simplified
            # # configuration. Uncomment this line, remove the create-blueprint job below,
            # # and you're good!
            # plugin-path: .

            # # Similarly, you can set up a theme fairly easily:
            # theme-path: .

            # # You can customize what gets appended to the PR description by uncommenting
            # # and changing the description-template below. Available placeholders are
            # # listed in the original workflow file at
            # # https://github.com/WordPress/wordpress-playground/blob/d64ad78befeffc8a48e9f5be031b7be051add6ff/.github/workflows/playground-preview.yml#L313
            # description-template: |
            #  ### Test this PR in WordPress Playground
            #
            #  {{PLAYGROUND_BUTTON}}

            # # Similarly, if this workflow is configured to post a comment, you can customize
            # # the content of that comment. Available placeholders are listed in the original
            # # workflow file at
            # # https://github.com/WordPress/wordpress-playground/blob/d64ad78befeffc8a48e9f5be031b7be051add6ff/.github/workflows/playground-preview.yml#L313
            # comment-template: |
            #  ## Preview Changes in WordPress Playground
            #
            #  {{PLAYGROUND_BUTTON}}
            #
            #  ### Testing Instructions
            #  1. Click the button above
            #  2. Go to Plugins → Installed Plugins
            #  3. Verify `{{PLUGIN_SLUG}}` is active
            #  4. Test the new functionality

            # # Are you hosting your own Playground instance? You change the default Playground URL
            # # below:
            # playground-host: https://playground.wordpress.net
```

Both templates support variables using `{{VARIABLE_NAME}}` syntax. Available variables:

-   `{{PLAYGROUND_BUTTON}}` - The actual button HTML
-   `{{PLAYGROUND_URL}}` - Direct link to the preview
-   `{{PR_NUMBER}}` - Pull request number
-   `{{PR_TITLE}}` - Pull request title
-   `{{PR_HEAD_REF}}` - Branch name
-   `{{PR_HEAD_SHA}}` - Latest commit
-   `{{REPO_OWNER}}` - Repository owner
-   `{{REPO_NAME}}` - Repository name
-   `{{PLUGIN_SLUG}}` - Derived plugin slug
-   `{{THEME_SLUG}}` - Derived theme slug

### Advanced: Custom blueprints

Blueprints are JSON files that tell Playground exactly what to do. By default, the workflow creates a simple blueprint that installs your plugin or theme. But you can provide your own blueprint for more complex scenarios.

Common use cases for custom blueprints:

-   Install additional plugins or themes
-   Set specific PHP or WordPress versions
-   Import test data
-   Configure WordPress settings
-   Run setup scripts

Here's how to create a custom blueprint:

```yaml
name: PR Playground Preview
on:
  pull_request:
    types: [opened, synchronize, reopened, edited]

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
              preferredVersions: {
                php: "8.3",
                wp: "6.4"
              },
              steps: [
                {
                  step: "installPlugin",
                  pluginData: {
                    resource: "git:directory",
                    url: `https://github.com/${context.repo.owner}/${context.repo.repo}.git`,
                    ref: context.payload.pull_request.head.ref,
                    path: "/"
                  },
                  options: { activate: true }
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

  playground-preview:
    name: Post Playground Preview Button
    needs: create-blueprint
    permissions:
      contents: read
      pull-requests: write
    uses: WordPress/wordpress-playground/.github/workflows/playground-preview-button.yml@workflow-1.0.0
    with:
      blueprint: ${{ needs.create-blueprint.outputs.blueprint }}

  # This job builds a custom blueprint with dynamic values from the PR
  create-blueprint:
    name: Create Blueprint
    runs-on: ubuntu-latest
    outputs:
      # Make the blueprint available to the next job
      blueprint: ${{ steps.blueprint.outputs.result }}
    steps:
      - name: Create Blueprint
        id: blueprint
        uses: actions/github-script@v7
        with:
          script: |
            // Build a blueprint object with the current PR's information
            const blueprint = {
              // Send users straight to wp-admin after loading
              landingPage: "/wp-admin/",
              steps: [
                {
                  // Install your plugin from the PR branch
                  step: "installPlugin",
                  pluginData: {
                    resource: "git:directory",
                    // Clone the current repository
                    url: `https://github.com/${context.repo.owner}/${context.repo.repo}.git`,

                    // Clone from the current Pull Request's branch
                    ref: context.payload.pull_request.head.ref,

                    // "/" means the plugin is in the repository root
                    // Change this to "path/to/my/plugin" if your plugin is in a subdirectory
                    path: "/"
                  }
                },

                // Install a non-standard theme for our plugin.
                // Themes can also be sourced from your repository and arbitrary URLs,
                // see https://wordpress.github.io/wordpress-playground/blueprints/
                {
                  "step": "installTheme",
                  "themeData": {
                    "resource": "wordpress.org/themes",
                    "slug": "adventurer"
                  }
                }

                // You can add more steps here:
                // - Install additional plugins and themes
                // - Import starter content
                // - Download files
                // - Run wp-cli commands
                // - ...anything else!
                // Learn more at https://wordpress.github.io/wordpress-playground/blueprints/
              ]
            };
            // Return the blueprint as a JSON string
            return JSON.stringify(blueprint);
          result-encoding: string
```

This example installs your plugin plus WooCommerce, and uses WordPress 6.4 with PHP 8.3.

Learn more about blueprints in the [[WordPress Playground documentation](https://wordpress.github.io/wordpress-playground/blueprints/)](https://wordpress.github.io/wordpress-playground/blueprints/).

## Troubleshooting

When in trouble, always start with the "Actions" tab in your GitHub repository and check the log from the last time your workflow ran. You will likely fine useful error information in there. Here's a few common problems:

**The workflow isn't running**

Check that:

-   Your repository is public
-   You're running on `pull_request` events
-   You've granted the right permissions in your workflow file

**The button isn't appearing**

Check the Actions tab for error messages. Common issues:

-   Missing required inputs (`plugin-path`, `theme-path`, or `blueprint`)
-   Invalid blueprint JSON
-   Permission errors

**The preview doesn't load my code**

Make sure:

-   Your `plugin-path`, `theme-path` points to the right directory
-   Your plugin has a valid main plugin file
-   Your theme has a valid `style.css`

## Learn More

-   [Example repository – simple plugin with a preview button configured](https://github.com/adamziel/preview-in-playground-button-plugin-example)
-   [Example repository – plugin with a build workflow using the preview button to test the built artifact](https://github.com/adamziel/preview-in-playground-button-built-artifact-example)
-   [Blueprint documentation](https://wordpress.github.io/wordpress-playground/blueprints/)
