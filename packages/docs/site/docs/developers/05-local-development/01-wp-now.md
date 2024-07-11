---
slug: wp-now
---

# wp-now NPM package

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is a CLI tool to spin up a WordPress site with a single command. Similarly to the [VS Code extension](02-vscode-extension.md), it uses a portable WebAssembly version of PHP and SQLite. No Docker, MySQL, or Apache are required.

## Launch wp-now in a plugin or theme directory

Navigate to your plugin or theme directory and start `wp-now` with the following commands:

```bash
cd my-plugin-or-theme-directory
npx @wp-now/wp-now start
```

## Launch wp-now in the `wp-content` directory with options

You can also start `wp-now` from any `wp-content` folder. The following example passes parameters for changing the PHP and WordPress versions and loading a blueprint file.

```bash
cd my-wordpress-folder/wp-content
npx @wp-now/wp-now start --wp=6.4 --php=8.0 --blueprint=path/to/blueprint.json
```

:::info **Documentation**

`wp-now` is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md).

:::

## Install wp-now globally

Alternatively, you can install `@wp-now/wp-now` globally to load it from any directory:

```bash
npm install -g @wp-now/wp-now
cd my-plugin-or-theme-directory
wp-now start
```
