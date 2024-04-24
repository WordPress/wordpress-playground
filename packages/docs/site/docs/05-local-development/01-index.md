---
title: wp-now
---

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is a CLI tool that allows you to quickly spin up a WordPress site with a single command. Similarly to the [VS Code extension](/05-local-development/02-vscode-extension.md), it uses a portable WebAssembly version of PHP and SQLite. No Docker, MySQL, or Apache required.

## Launch wp-now in a plugin or theme directory

Running wp-now is as simple as accessing your plugin or theme directory and starting wp-now.

```bash
cd my-plugin-or-theme-directory
npx @wp-now/wp-now start
```

## Launch wp-now in the `wp-content` directory with options

You can also start wp-now from any wp-content folder. In this example, we pass parameters to change the PHP and WordPress versions and apply a blueprint file.

```bash
cd my-wordpress-folder/wp-content
npx @wp-now/wp-now start  --wp=5.9 --php=7.4 --blueprint=path/to/blueprint-example.json
```

:::info **Documentation**

`wp-now` is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md).

:::

## Install wp-now globally

Alternatively, you can install `@wp-now/wp-now` globally to it from any directory:

```bash
npm install -g @wp-now/wp-now
cd wordpress-plugin-or-theme
wp-now start
```
