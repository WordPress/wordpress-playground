---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

# Playground CLI

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is the new command-line tool designed to simplify the development and testing flow. It runs a WordPress instance locally with Playground, and with the CLI, it is possible to auto-mount an environment with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment.

## Requirements

The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the Node.js website.

**Key features:**

-   **Quick Setup**: Set up a local WordPress environment in seconds.
-   **Flexible**: Allows for configuration to adapt to different scenarios
-   **Simple Development Environment**: No extra configuration, just a compatible Node installation, and you are ready to use it.

## Quickstart

Running the Playground CLI is as simple as go to a command-line terminal and running:

```bash
npx @wp-playground/cli@latest server
```

The previous command, you only get a fresh WordPress, instance to test. Most of the developers want to see their work running, If this is your case, test a plugin or a theme. You can run the CLI on your project folder and run the Playground CLI with the `--auto-mount` flag:

``bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount

````

### Choosing a WordPress Version

By default, the CLI loads the latest stable version of WordPress and PHP 8.0 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.4
````

### Mounting folders manually

Some projects have a specific structure that requires a custom configuration, for example, your repo contains all the files from the `/wp-content/` folder. So this scenario you can specify to the Plaground CLI you will mount your project from that folder using the flag `--mount`.

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/
```

### Loading Blueprints

A way to bring the CLI playground to the next level is to integrate with Blueprints, which allows developers to set up the initial state from their WordPress instance. With the flag `--blueprint` the developer will be capable run a Playground with a custom inital state.

**(my-blueprint.json)**

```bash
{
  "landingPage": "/wp-admin/options-general.php?page=akismet-key-config",
  "steps": [
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "akismet"
      },
      "options": {
        "activate": true
      }
    },
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    },
  ]
}
```

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

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
-   `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: /host/path:/vfs/path
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
