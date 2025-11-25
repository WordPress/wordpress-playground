# WordPress Playground CLI

`@wp-playground/cli` streamlines the process of setting up a local WordPress environment for development and testing. It utilizes WordPress Playground to set up a new WordPress environment seamlessly. As with its predecessor `wp-now`, you can switch between PHP and WordPress versions only with a flag.

# Table of contents

- [Requirements](#requirements)
- [Quickstart](#quickstart)
- [Usage](#usage)
- [Working with Blueprints](#working-with-blueprints)
- [Contributing](#contributing)

## Requirements

The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).

## Quickstart

Running the Playground CLI is as simple as going to your plugin or theme directory and running the following command:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli server --auto-mount
```

The flag `--auto-mount` will figure out if the project folder is a plugin or a theme for you. For more advanced mounting options, see the [Mounting Local Directories](#mounting-local-directories) section.

## Usage

You don't have to install `@wp-playground/cli`, you can run it directly with `npx`. This is the recommended way to use the CLI and requires no permanent installation. To run a vanilla WordPress website, you can run the command:

```bash
npx @wp-playground/cli@latest server
```

> **_NOTE:_** You can also use the `@wp-playground/cli@latest` to load the latest version of playground.

### Choosing a WordPress Version

By default, the CLI loads the latest stable version of WordPress and PHP 8.0 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:

```bash
 npx @wp-playground/cli@latest server --wp=6.8 --php=8.4
```

### Mounting local Directories

`@wp-playground/cli` operates by mounting your local project files into a virtualized WordPress environment. This allows you to work on your plugin or theme with a live WordPress instance without any complex setup. You can do this automatically or manually.

For full control, you can manually mount a local directory to a specific path inside the virtual WordPress installation. For example, to mount your current project folder into the plugins directory, use the `--mount` flag:

```shell
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/
```

Another helpful flag is `--mount-before-install` allows the users to create a site in a local filesystem instead of in the Virtual File System.

```shell
npx @wp-playground/cli@latest server --mount-before-install=./my-local-site:/wordpress
```

### Automatic Mounting with `--auto-mount`

The `--auto-mount` flag is the easiest way to get started. It inspects the current directory and automatically mounts it to the correct location in the virtual WordPress site. These are the supported directory types and how they are detected:

- **Plugin Mode**: Presence of a PHP file with `Plugin Name:` in its header.
- **Theme Mode**: Presence of a style.css file with `Theme Name:` in its header.
- **wp-content Mode**: Presence of plugins and themes subdirectories.
- **WordPress Mode**: Presence of a complete WordPress installation. The directory will be mounted to the root `/wordpress` folder.

## Command and Arguments

Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

- **`server`**: (Default) Starts a local WordPress server.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.

The `server` command supports the following optional arguments:

- `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
- `--outfile`: When building, write to this output file.
- `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
- `--auto-mount`: Automatically mount the current directory (plugin, theme, wp-content, etc.).
- `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: /host/path:/vfs/path
- `--mount-before-install`: Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: `"/host/path:/vfs/path"`.
- `--mount-dir`: Mount a directory to the PHP runtime (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`.
- `--mount-dir-before-install`: Mount a directory before WordPress installation (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`
- `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
- `--blueprint-may-read-adjacent-files`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
- `--login`: Automatically log the user in as an administrator.
- `--wordpress-install-mode <mode>`: Control how Playground prepares WordPress before booting. Defaults to `download-and-install`. Other options: `install-from-existing-files` (install using files you've mounted), `install-from-existing-files-if-needed` (same, but skip setup when an existing site is detected), and `do-not-attempt-installing` (never download or install WordPress).
- `--skip-sqlite-setup`: Do not set up the SQLite database integration.
- `--verbosity`: Output logs and progress messages (choices: "quiet", "normal", "debug"). Defaults to "normal".

- `--debug`: Print the PHP error log if an error occurs during boot.
- `--follow-symlinks`: Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. ⚠️ Warning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.
- `--experimental-multi-worker`: Enables experimental multi-worker support. It needs JSPI and a /wordpress directory on a real filesystem. You can pass a positive number to use a specific number of workers, otherwise, it defaults to the number of CPUs minus one.
- `--internal-cookie-store`: Enables Playground's internal cookie handling. When active, Playground uses an HttpCookieStore to manage and persist cookies across requests. If disabled, cookies are handled externally, like by a browser in Node.js.

## Need some help with the CLI?

With the Playground CLI, you can use the `--help` to get some support about the available commands.

```bash
npx @wp-playground/cli@latest --help
```

## Working with Blueprints

Blueprint is a JSON file where you can pre-define the initial state of your WordPress instance. It provides several functionalities, like installing plugins and themes, creating content, setting WordPress options, and executing steps.

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

The example of a Blueprint above installs a plugin, logs the user in, and opens the new post editor. To learn more about Blueprints, please check the [documentation](https://wordpress.github.io/wordpress-playground/blueprints).

To use a Blueprint, create a file (e.g., my-blueprint.json) and run the following command:

```bash
npx @wp-playground/cli@latest server --blueprint=./my-blueprint.json
```

## Programmatic Usage with JavaScript

The Playground CLI can be controlled programmatically from your JavaScript code using the `runCLI` function. This allows you to integrate all CLI functionalities directly into your development workflow, for example, end-to-end testing.

```JavaScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true
});
```

## Comparisons

### Things the Playground does compared to Laravel Valet

- Handles the entire WordPress installation for you.
- Works across all desktop platforms (Mac, Linux, Windows).
- Does not set up custom host domains for you.

### Things the Playground does compared to `wp-env`

- Does not require Docker.
- Is faster to start up for quick tests and development.
- The Playground doesn't come with a MySQL Server, but you can provide your own MySQL credentials.

## Contributing

### Running Playground CLI from source

To set it up:

```bash
# If you don't have the repository cloned yet:
git clone -b trunk --single-branch --depth 1 --recurse-submodules https://github.com/WordPress/wordpress-playground.git
cd wordpress-playground

# Alternatively, if you already have a clone but forgot to
# pull the submodules, you can run:
cd wordpress-playground
git submodule update --init --recursive

nvm use 23
npm install
```

To run it:

```bash
node --experimental-strip-types --experimental-transform-types --import ./packages/meta/src/node-es-module-loader/register.mts ./packages/playground/cli/src/cli.ts
```

Or this instead of the above:

```bash
# Make sure you have the `nx` command available:
npm install -g nx

nx dev playground-cli server
```

### How can I contribute?

WordPress Playground CLI is an open-source project and welcomes all contributors from documentation to triage. If the feature you need is missing, you are more than welcome to start a discussion, open an issue, and even propose a Pull Request to implement it.

Here are a few quick-start guides to get you started:

- Code contributions – see the [developer section](https://wordpress.github.io/wordpress-playground/docs/contributing/code).
- Documentation – see the [documentation section](https://wordpress.github.io/wordpress-playground/docs/contributing/documentation).
- Triage – see the [triage section](https://wordpress.github.io/wordpress-playground/contributing/#triaging-issues).
- Contributions to translations – see the [translations section](https://wordpress.github.io/wordpress-playground/contributing/translations).
- Reporting bugs – open an [issue](https://github.com/WordPress/wordpress-playground/issues/new) in the repository.
- Ideas, designs, or anything else – open a [GitHub discussion](https://github.com/WordPress/wordpress-playground/discussions) and let's talk!
- Join our Slack channel [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) at Make WordPress
