---
title: wp-now
slug: /developers/local-development/wp-now
orphan: true
---

<div class="callout callout-warning">

**Package deprecated**

The NPM package @wp-now/wp-now is deprecated and won't receive updates in the future. To use a command-line tool in your developer workflow, use the NPM package `@wp-playground/cli`.

</div>

# wp-now NPM package

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is deprecated.
Use [Playground CLI](/developers/local-development/wp-playground-cli) instead.
It uses the same WordPress Playground runtime and is maintained in the main
WordPress Playground repository.

## Migrate to Playground CLI

The familiar wp-now workflow maps to the Playground CLI `start` command:

| wp-now                                                  | Playground CLI                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `npx @wp-now/wp-now start`                              | `npx @wp-playground/cli@latest start`                              |
| `npx @wp-now/wp-now start --path=./plugin`              | `cd ./plugin && npx @wp-playground/cli@latest start`               |
| `npx @wp-now/wp-now start --wp=6.8 --php=8.3`           | `npx @wp-playground/cli@latest start --wp=6.8 --php=8.3`           |
| `npx @wp-now/wp-now start --blueprint=./blueprint.json` | `npx @wp-playground/cli@latest start --blueprint=./blueprint.json` |
| `npx @wp-now/wp-now start --skip-browser`               | `npx @wp-playground/cli@latest start --skip-browser`               |
| `npx @wp-now/wp-now start --reset`                      | `npx @wp-playground/cli@latest start --reset`                      |

`@wp-playground/cli start` automatically detects whether the selected directory
is a plugin, theme, `wp-content` directory, or WordPress installation. When it
manages the WordPress root directory, it persists the site in
`~/.wordpress-playground/sites/<path-hash>/`. If the selected directory is a full
WordPress installation, that directory becomes the persistent store instead.

For manual mounts, automation, or CI workflows, use the lower-level
`@wp-playground/cli server` command. See the
[Playground CLI documentation](/developers/local-development/wp-playground-cli)
for details.
