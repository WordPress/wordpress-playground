---
title: wp-now
slug: /developers/local-development/wp-now
---

# wp-now NPM package

[wp-now](https://www.npmjs.com/package/@wp-now/wp-now) is a command-line tool designed to simplify the process of running WordPress locally. It provides a quick and easy way to set up a local WordPress environment with minimal configuration.

Key Features:

-   **Command-line Interface**: Easy to use for developers comfortable with CLI.
-   **Quick Setup**: Set up a local WordPress environment in seconds.
-   **Customizable**: Allows for configuration to suit specific development needs.

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is a CLI tool to spin up a WordPress site with a single command. Similarly to the [VS Code extension](/developers/local-development/vscode-extension), it uses a portable WebAssembly version of PHP and SQLite. No Docker, MySQL, or Apache are required.

:::info **Documentation**

`wp-now` is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md).

:::

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

## Install wp-now globally

Alternatively, you can install `@wp-now/wp-now` globally to load it from any directory:

```bash
npm install -g @wp-now/wp-now
cd my-plugin-or-theme-directory
wp-now start
```
