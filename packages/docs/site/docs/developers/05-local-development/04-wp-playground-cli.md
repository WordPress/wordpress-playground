---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

# Playground CLI

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment.

**Key features:**

-   **Quick Setup**: Set up a local WordPress environment in seconds.
-   **Flexibility**: Allows for configuration to adapt to different scenarios.
-   **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it.

## Requirements

The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).

## Quickstart

Running the Playground CLI is as simple as go to a command-line and run:

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI in Action](@site/static/img/developers/npx-wp-playground-server.gif)

With the previous command, you only get a fresh WordPress instance to test. Most of the developers want to see their work running. If this is your case, test a plugin or a theme. You can run the CLI on your project folder and run the Playground CLI with the `--auto-mount` flag:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

### Choosing a WordPress and PHP Version

By default, the CLI loads the latest stable version of WordPress and PHP 8.0 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.4
```

### Loading Blueprints

One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). For those unfamiliar with this technology, it allows developers to configure the initial state for their WordPress Playground instances.

Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We’ll use the example below to do this.

**(my-blueprint.json)**

```bash
{
  "landingPage": "/wp-admin/options-general.php?page=akismet-key-config",
  "login": true,
  "plugins": [
    "hello-dolly",
    "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
  ]
}
```

CLI command loading a blueprint:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

### Mounting folders manually

Some projects have a specific structure that requires a custom configuration; for example, your repository contains all the files in the `/wp-content/` folder. So in this scenario, you can specify to the Playground CLI that it will mount your project from that folder using the `--mount` flag.

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

### Mounting before WordPress installation

Consider mounting your WordPress project files before the WordPress installation begins. This approach is beneficial if you want to override the Playground boot process, as it can help connect Playground with `WP-CLI`. The `--mount-before-install` flag supports this process.

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

:::info
On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format`"/host/path"` `"/vfs/path"`.
:::

## Command and Arguments

Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

-   **`server`**: (Default) Starts a local WordPress server.
-   **`run-blueprint`**: Executes a Blueprint file without starting a web server.
-   **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.

The `server` command supports the following optional arguments:

-   `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
-   `--outfile`: When building, write to this output file.
-   `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
-   `--auto-mount`: Automatically mount the current directory (plugin, theme, wp-content, etc.).
-   `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: `"/host/path:/vfs/path"`.
-   `--mount-before-install`: Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: `"/host/path:/vfs/path"`.
-   `--mount-dir`: Mount a directory to the PHP runtime (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`.
-   `--mount-dir-before-install`: Mount a directory before WordPress installation (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`
-   `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
-   `--blueprint-may-read-adjacent-files`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
-   `--login`: Automatically log the user in as an administrator.
-   `--skip-wordpress-setup`: Do not download or install WordPress. Useful if you are mounting a full WordPress directory.
-   `--skip-sqlite-setup`: Do not set up the SQLite database integration.
-   `--quiet`: Do not output logs and progress messages.
-   `--debug`: Print the PHP error log if an error occurs during boot.

## Need some help with the CLI?

With the Playground CLI, you can use the `--help` to get some support about the available commands.

```bash
npx @wp-playground/cli@latest --help
```
