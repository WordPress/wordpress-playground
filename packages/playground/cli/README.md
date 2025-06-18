# WordPress Playground CLI

`@wp-playground/cli` streamlines the process of setting up a local WordPress environment for development and testing. It utilizes WordPress Playground to set up a new WordPress environment seamlessly. As its predecessor `wp-now`, you can switch between PHP and WordPress versions only with a flag.

The requirement to run the Playground CLI is to have installed `Node.js 20.18.3` or higher, which you can find at the [Node.js website](https://nodejs.org/en/download).

## Quickstart

Running the Playground CLI is as simple as going to your plugin or theme directory and running the following command:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli server --autoMount
```

The flag `--autoMount` will figure out if the project folder is a plugin or a theme for you. For more custom scenarios, we can work with the following example using the flag `--mount`.

### Mount a project into Playground

To start using the CLI, mount the current project folder to a specific WordPress folder. For example, I would like to set my plugin project folder to `wordpress/wp-content/plugins/`. We will use the following command:

```shell
cd my-plugin-or-theme-directory
npx @wp-playground/cli server --mount=.:/wordpress/wp-content/plugins/
```

# Table of contents

-   [Quickstart](#quickstart)
-   [Requirements](#requirements)
-   [Usage](#usage)
-   [Working with Blueprints](#working-with-blueprints)
-   [How can I contribute?](#how-can-i-contribute)

## Requirements

The minimum supported version of Node.js is 20. The latest Long-Term Support (LTS) version (20.18 or later) is recommended.

## Usage

You don't have to install `@wp-playground/cli`, you can run it directly with `npx`. This is the recommended way to use the CLI and requires no permanent installation. To run a vanilla WordPress website, you can run the command:

```bash
npx @wp-playground/cli server
```

### Choosing a WordPress Version

By default, the CLI will load the latest stable version of WordPress and PHP. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:

```bash
 npx @wp-playground/cli server --wp=6.8 --php=8.4
```

### Mounting local Directories

`@wp-playground/cli` operates by mounting your local project files into a virtualized WordPress environment. You can do this automatically or manually.

### Automatic Mounting with --autoMount

The `--autoMount` flag is the easiest way to get started. It inspects the current directory and automatically mounts it to the correct location in the virtual WordPress site. These are the supported directory types and how they are detected:

-   **Plugin Mode**: Presence of a PHP file with `Plugin Name:` in its header.
-   **Theme Mode**: Presence of a style.css file with `Theme Name:` in its header.
-   **wp-content Mode**: Presence of plugins and themes subdirectories.
-   **WordPress Mode**: Presence of a complete WordPress installation. The directory will be mounted to the root `/wordpress` folder.

### Manual Mounting

For more control, you can manually specify with the flag `--mount`. For example, to mount a local theme directory into a virtual `wp-content/themes` directory, we use the following command:

```bash
npx @wp-playground/cli server --mount=/wordpress/wp-content/themes
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
-   `--autoMount`: Automatically mount the current directory (plugin, theme, wp-content, etc.).
-   `--mount=<mapping>`: Manually mount a directory. Format: /host/path:/vfs/path. It can be used multiple times.
-   `--mountBeforeInstall`: Mount a directory to the PHP runtime before installing WordPress. You can provide `--mountBeforeInstall` or `--mount-before-install` multiple times. Format: `/host/path:/vfs/path`.
-   `--mountDir`: Mount a directory to the PHP runtime. You can provide `--mountDir` or `--mount-dir` multiple times. Format: `"/host/path"` `"/vfs/path"`
-   `--mountDirBeforeInstall`: Mount a directory to the PHP runtime before installing WordPress. You can provide `--mountBeforeInstall` or `--mount-before-install` multiple times. Format: `"/host/path"` `"/vfs/path"`
-   `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
-   `--blueprintMayReadAdjacentFiles`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
-   `--login`: Automatically log the user in as an administrator.
-   `--skipWordPressSetup`: Do not download or install WordPress. Useful if you are mounting a full WordPress directory.
-   `--skipSqliteSetup`: Do not set up the SQLite database integration.
-   `--quiet`: Do not output logs and progress messages.
-   `--debug`: Print the PHP error log if an error occurs during boot.

## Need some help with the CLI?

With the Playground CLI, you can use the `--help` to get some support about the available commands.

```bash
npx @wp-playground/cli --help
```

## Working with Blueprints

Blueprint is a JSON file where you can pre-define the initial state of your WordPress instance. It provides several functionalities, like installing plugins and themes, creating content, setting WordPress options, and executing steps.

Below is an example of a Blueprint that installs a plugin, logs the user in, and opens the new post editor.

```JSON
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/post-new.php",
	"steps": [
		{
			"step": "installPlugin",
			"pluginZipFile": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			},
			"options": {
				"activate": true
			}
		},
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}
```

You can prototype and test your Blueprint in the online Playground editor.

To use a Blueprint, create a file (e.g., my-blueprint.json) and run the following command:

```bash
npx @wp-playground/cli server --blueprint=./my-blueprint.json
```

## Interoperability

This CLI package is not just a helpful tool. It drives interoperability between the in-browser Playground, CLI packages, and the PHP Blueprints library. Once complete, it will reuse the same internals as the website at https://playground.wordpress.org, whether we're talking about running PHP code, executing Blueprints, building snapshots, serving requests, or maintaining
multiple PHP instances.

## Comparisons

### Things the Playground does compared to Laravel Valet

-   Handles the entire WordPress installation for you.
-   Works across all desktop platforms (Mac, Linux, Windows).
-   Does not set up custom host domains for you.
-   Allows you to switch WordPress and PHP versions on the fly.

### Things the Playground does compared to `wp-env`

-   Does not require Docker.
-   Is faster to start up for quick tests and development.
-   Does not include lifecycle scripts or a persistent MySQL database.

## How can I contribute?

WordPress Playground CLI is an open-source project and welcomes all contributors from documentation to triage. If the feature you need is missing, you are more than welcome to start a discussion, open an issue, and even propose a Pull Request to implement it.

Here are a few quick-start guides to get you started:

-   Code contributions – see the [developer section](https://wordpress.github.io/wordpress-playground/docs/contributing/code).
-   Documentation – see the [documentation section](https://wordpress.github.io/wordpress-playground/docs/contributing/documentation).
-   Triage – see the [triage section](https://wordpress.github.io/wordpress-playground/contributing/#triaging-issues).
-   Contributions to translations – see the [translations section](https://wordpress.github.io/wordpress-playground/contributing/translations).
-   Reporting bugs – open an [issue](https://github.com/WordPress/wordpress-playground/issues/new) in the repository.
-   Ideas, designs, or anything else – open a [GitHub discussion](https://github.com/WordPress/wordpress-playground/discussions) and let's talk!
-   Join our Slack channel [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) at Make WordPress
