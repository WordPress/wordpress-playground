---
title: Adding PR Preview Buttons with GitHub Actions
slug: /guides/github-action-pr-preview
description: Automatically add Playground preview buttons to pull requests for your WordPress plugin or theme.
---

The Playground PR Preview action adds a preview button to your pull requests. Clicking the button launches Playground with your plugin or theme installed from the PR branch:

![PR Preview Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/try-it-in-playground.webp)

For complete configuration options and advanced features, see the [action-wp-playground-pr-preview workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2).

## How it works

The basic workflow runs on the `pull_request` event (types `opened`, `synchronize`, `reopened`, `edited`). It reads pull request metadata, builds a Playground URL that points at the PR branch, and updates the PR description or comment.

Forked pull requests need extra care because GitHub makes `GITHUB_TOKEN` read-only for `pull_request` workflows from forks. If you need to write a preview button for fork PRs, use `pull_request_target` only for a small workflow that reads PR metadata and writes the button. If your preview needs a build step, run the build in a separate `pull_request` workflow and publish the preview from a `workflow_run` workflow.

:::warning This is a regular GitHub Action, not a reusable workflow
Reference it as a step inside `jobs.<job_id>.steps:` (i.e. `jobs.<job_id>.steps[*].uses:`) — never as `jobs.<job_id>.uses:` at the job level. The job-level form is valid YAML for reusable workflows, so it is a common mistake (including by AI coding assistants), but it will not work with this action.
:::

## Basic setup for plugins

For plugins without a build step, create `.github/workflows/pr-preview.yml`:

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

The `plugin-path: .` setting points to your plugin directory. For subdirectories like `plugins/my-plugin`, use `plugin-path: plugins/my-plugin`.

See [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) for a live example of this workflow in action.

## Basic setup for themes

For themes, use `theme-path` instead of `plugin-path`:

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

## Testing PRs from forks

Pull requests opened from forked repositories run with a read-only `GITHUB_TOKEN`, so the default `pull_request` trigger cannot post or update the preview button. The action may fail with `Resource not accessible by integration`.

Use `pull_request_target` only for the workflow that posts the preview button:

```yaml
on:
    pull_request_target:
        types: [opened, synchronize, reopened, edited]
```

:::danger Security note
`pull_request_target` runs in the context of the base repository and can access repository secrets and a write-capable `GITHUB_TOKEN`. Do **not** use it to check out PR code, run files from the PR, install PR dependencies, load a blueprint from the PR branch, or pass PR values into shell commands. Keep permissions as narrow as possible, typically `contents: read` and `pull-requests: write` for this action.

If you need Composer, npm, tests, or any other step that runs PR code, put that work in a separate `pull_request` workflow and use [`workflow_run`](https://docs.github.com/en/actions/writing-workflows/choosing-when-workflows-run/events-that-trigger-workflows#workflow_run) to publish the preview after the build completes.
:::

## Button placement

By default, the action updates the PR description (`mode: append-to-description`). To post as a comment instead:

```yaml
with:
    plugin-path: .
    mode: comment
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

The action wraps the button in HTML markers and updates it on subsequent runs. By default, it restores the button if you remove it. To prevent restoration:

```yaml
with:
    plugin-path: .
    restore-button-if-removed: false
```

## Working with built artifacts

For plugins or themes requiring compilation, the workflow involves building the code, exposing it via GitHub releases, and creating a blueprint that references the public URL.

:::warning First-time setup: publish the draft release
The `expose-artifact-on-public-url` action uploads built files to a GitHub release tagged `ci-artifacts` by default. On the first run, GitHub creates this release as a **draft**, which is not publicly fetchable — the preview button will appear but silently 404 when clicked. Go to your repository's Releases page once and either publish the release or mark it as a pre-release. Subsequent runs reuse the same release, so this is only needed once.
:::

Use the two-workflow pattern from the [complete artifact documentation](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#advanced-testing-built-ci-artifacts):

- A `pull_request` workflow checks out the PR code, runs the build with read-only permissions, and uploads the ZIP as a GitHub Actions artifact.
- A `workflow_run` workflow runs only after that build succeeds. It has `contents: write` and `pull-requests: write`, exposes the uploaded ZIP on a public release URL, builds a Blueprint that installs that ZIP, and posts the preview button.

Keep secrets and write permissions out of the build workflow. The publish workflow should not check out or run PR code. The `artifacts-to-keep` setting controls how many builds to retain per PR. For themes, change `installPlugin` to `installTheme`.

See [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) for a complete working example.

## Custom blueprints

Use blueprints to configure the Playground environment. You can install additional plugins, set WordPress options, import content, or run custom PHP.

Example installing your plugin with WooCommerce:

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
                              // Use head.repo.full_name, not context.repo. PRs from forks
                              // live on the contributor's fork, not the base repository —
                              // pointing at context.repo.* will 404 for every fork PR.
                              url: `https://github.com/${context.payload.pull_request.head.repo.full_name}.git`,
                              ref: context.payload.pull_request.head.sha,
                              refType: "commit",
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
            contents: read
            pull-requests: write
        steps:
            - uses: WordPress/action-wp-playground-pr-preview@v2
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  blueprint: ${{ needs.create-blueprint.outputs.blueprint }}
```

Or reference an external blueprint:

```yaml
with:
    blueprint-url: https://example.com/path/to/blueprint.json
```

See [Blueprints documentation](/blueprints) for all available steps and configuration options.

## Template customization

Customize the preview content using template variables:

```yaml
with:
    plugin-path: .
    description-template: |
        ### Test this PR in WordPress Playground

        {{PLAYGROUND_BUTTON}}

        **Branch:** {{PR_HEAD_REF}}
```

Available variables: `{{PLAYGROUND_BUTTON}}`, `{{PLUGIN_SLUG}}`, `{{THEME_SLUG}}`, `{{PR_NUMBER}}`, `{{PR_TITLE}}`, `{{PR_HEAD_REF}}`, and more.

See the workflow README for the [complete list](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#description-template).

## Artifact exposure

The `expose-artifact-on-public-url` action uploads built files to a single release (tagged `ci-artifacts` by default). Each artifact gets a unique filename like `pr-123-abc1234.zip`. Old artifacts are automatically cleaned up based on `artifacts-to-keep`.

Configuration options: [Expose Artifact Inputs](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2#expose-artifact-inputs)

## Troubleshooting

**`Invalid workflow file` or `jobs.<id>.uses` error:** You referenced the action as a reusable workflow. Move `uses: WordPress/action-wp-playground-pr-preview@v2` into the job's `steps:` list (as an item under `jobs.<job_id>.steps:`), not directly under the job. See [How it works](#how-it-works).

**Button not appearing:** The workflow file must exist on the default branch before it runs on PRs. Check the Actions tab for errors.

**`Resource not accessible by integration`:** The PR was opened from a fork and the default `pull_request` trigger cannot write. Use `pull_request_target` only for the preview-button workflow described in [Testing PRs from forks](#testing-prs-from-forks). If you need to build or run PR code, use the two-workflow artifact pattern in [Working with built artifacts](#working-with-built-artifacts).

**Button appears but preview fails to load (404):** For built-artifact workflows, the `ci-artifacts` release is still a draft. Publish it once from the Releases page. See [Working with built artifacts](#working-with-built-artifacts).

**`plugin-path` or `theme-path` resolves to an empty directory:** The path is relative to the repository root, not to the workflow file. Use `.` for repo-root plugins, `plugins/my-plugin` for subdirectories.

**`Git ref refs/heads/<branch> not found` on a fork PR:** Your blueprint uses `context.repo.owner`/`context.repo.repo` to build the [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) URL, which points at the base repository. Fork PRs live on the contributor's fork — use `context.payload.pull_request.head.repo.full_name` and `head.sha` with `refType: "commit"` instead. Repository URLs with or without a trailing `.git` suffix are supported.

**Blueprint references a legacy ZIP-from-repo proxy service and times out:** Look in your blueprint for resource URLs pointing at ZIP-from-repo proxy endpoints, then switch source-based previews to the [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) (shown in [Custom blueprints](#custom-blueprints)), which fetches directly from GitHub. For plugins or themes that need a build step, publish a built ZIP artifact and install that artifact with a [`url` resource](/blueprints/steps/resources#urlreference) instead.

**Plugin/theme not activated:** Check the browser console for PHP errors. Dependencies may be missing, or the plugin's main file may not match the directory name.

**Permissions errors:** Ensure the job declares `permissions: pull-requests: write` (and `contents: write` for built-artifact workflows).

More: [workflow README](https://github.com/WordPress/action-wp-playground-pr-preview/tree/v2)

## Other ways of previewing a git repository

<iframe width="800" src="https://www.youtube.com/embed/2VQkCPYyabQ?si=g5zkAZelHZ9bkN1X" title="Previewing GitHub branches with WordPress Playground" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Examples

- [WordPress/blueprints](https://github.com/WordPress/blueprints/pull/155) - Blueprint previews
- [adamziel/preview-in-playground-button-plugin-example](https://github.com/adamziel/preview-in-playground-button-plugin-example/pull/3) - Plugin without build
- [adamziel/preview-in-playground-button-built-artifact-example](https://github.com/adamziel/preview-in-playground-button-built-artifact-example/pull/2) - Plugin with build

## Next steps

- Add demo content ([guide](/guides/providing-content-for-your-demo))
- Create custom blueprints ([docs](/blueprints))
