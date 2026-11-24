# WordPress Playground CLI

`@wp-playground/cli` runs WordPress locally with WordPress Playground. It is
the recommended replacement for the deprecated `@wp-now/wp-now` package: no
Docker, MySQL, or Apache are required.

# Table of contents

- [Requirements](#requirements)
- [Quickstart](#quickstart)
- [Usage](#usage)
- [Migrating from wp-now](#migrating-from-wp-now)
- [Working with Blueprints](#working-with-blueprints)
- [Contributing](#contributing)

## Requirements

The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).

## Quickstart

For most local development workflows, use the `start` command:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest start
```

`start` automatically detects whether the current directory is a plugin, theme,
`wp-content` directory, or WordPress installation. It also persists the site
between runs and opens the browser by default.

Use `server` when you need explicit, low-level control over mounts, storage, or
CI setup:

```bash
npx @wp-playground/cli@latest server --auto-mount
```

## Usage

You don't have to install `@wp-playground/cli`, you can run it directly with `npx`. This is the recommended way to use the CLI and requires no permanent installation. To run a vanilla WordPress website, you can run the command:

```bash
npx @wp-playground/cli@latest start
```

### Choosing a WordPress Version

By default, the CLI loads the latest stable version of WordPress and PHP 8.3 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:

```bash
npx @wp-playground/cli@latest start --wp=6.8 --php=8.4
```

### `start` and `server`

Playground CLI includes two commands for running WordPress locally:

- **`start`**: Recommended for day-to-day development. It auto-detects the
  project type, persists the site in `~/.wordpress-playground/sites/<path-hash>/`,
  enables login, and opens the browser.
- **`server`**: Advanced mode for explicit mounts, automation, and CI. Unless
  you mount persistent storage yourself, `server` uses temporary directories
  that are removed after they become stale.

### Mounting local Directories

`@wp-playground/cli` operates by mounting your local project files into a virtualized WordPress environment. This allows you to work on your plugin or theme with a live WordPress instance without any complex setup. You can do this automatically or manually.

The easiest option is automatic mounting:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

For full control, you can manually mount a local directory to a specific path inside the virtual WordPress installation. For example, to mount your current project folder into the plugins directory, use the `--mount` flag:

```shell
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/my-plugin
```

Another helpful flag is `--mount-before-install`. It lets you mount files before WordPress is installed, which is useful when the mounted directory already contains a WordPress site:

```shell
npx @wp-playground/cli@latest server --mount-before-install=./my-local-site:/wordpress
```

### Automatic Mounting with `--auto-mount`

The `--auto-mount` flag inspects the selected directory and mounts it to the correct location in the virtual WordPress site. These are the supported directory types and how they are detected:

- **Plugin Mode**: Presence of a PHP file with `Plugin Name:` in its header.
- **Theme Mode**: Presence of a style.css file with `Theme Name:` in its header.
- **wp-content Mode**: Presence of plugins, themes, mu-plugins, or uploads subdirectories.
- **WordPress Mode**: Presence of a complete WordPress installation. The directory will be mounted to the root `/wordpress` folder.

## Migrating from wp-now

The deprecated `@wp-now/wp-now` package maps most directly to the `start`
command:

| wp-now                                                  | Playground CLI                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `npx @wp-now/wp-now start`                              | `npx @wp-playground/cli@latest start`                              |
| `npx @wp-now/wp-now start --path=./plugin`              | `cd ./plugin && npx @wp-playground/cli@latest start`               |
| `npx @wp-now/wp-now start --wp=6.8 --php=8.3`           | `npx @wp-playground/cli@latest start --wp=6.8 --php=8.3`           |
| `npx @wp-now/wp-now start --blueprint=./blueprint.json` | `npx @wp-playground/cli@latest start --blueprint=./blueprint.json` |
| `npx @wp-now/wp-now start --skip-browser`               | `npx @wp-playground/cli@latest start --skip-browser`               |
| `npx @wp-now/wp-now start --reset`                      | `npx @wp-playground/cli@latest start --reset`                      |

The main workflow change is where the saved site lives:

- With `wp-now`, `--path=./plugin` picked the project and the saved site.
- With Playground CLI, `start` saves the site for the current directory. For
  the closest match, `cd` into the project first, then run `start`.
- When Playground CLI creates WordPress for you, it keeps the WordPress files
  in `~/.wordpress-playground/sites/<path-hash>/`.
- If you run it on a full WordPress directory, or mount a directory at
  `/wordpress`, that directory is the WordPress site. Changes are written
  there.
- `start --path=./plugin` still mounts that folder, but it does not make
  `./plugin` the saved site. The saved site still belongs to the directory
  where you ran the command.

Use `start` for the familiar wp-now-style flow. Use `server` only when you want
to spell out mounts, storage, or automation yourself.

## Command and Arguments

Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

- **`start`**: Starts a local WordPress server with automatic project detection, site persistence, and browser opening.
- **`server`**: Starts a local WordPress server with full manual control over configuration.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.
- **`php`**: Runs a PHP script.

The `start` command supports these common optional arguments. Run `npx @wp-playground/cli@latest start --help` for the full list:

- `--path=<path>`: Path to the project directory. Defaults to the current working directory.
- `--wp=<version>`: WordPress version to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. Defaults to PHP 8.3.
- `--port=<port>`: The port number for the server to listen on. Defaults to 9400 when available.
- `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
- `--login`: Automatically log the user in as an administrator. Defaults to true.
- `--skip-browser`: Do not open the site in your default browser.
- `--reset`: Delete the stored site directory and start fresh.
- `--no-auto-mount`: Disable automatic project detection.

The `server` command supports these common optional arguments. Run `npx @wp-playground/cli@latest server --help` for the full list:

- `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
- `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. Defaults to PHP 8.3.
- `--auto-mount`: Automatically mount the current directory (plugin, theme, wp-content, etc.).
- `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: `/host/path:/vfs/path`.
- `--mount-before-install`: Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: `/host/path:/vfs/path`.
- `--mount-dir`: Mount a directory to the PHP runtime (can be used multiple times). Format: `"/host/path" "/vfs/path"`.
- `--mount-dir-before-install`: Mount a directory before WordPress installation (can be used multiple times). Format: `"/host/path" "/vfs/path"`.
- `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
- `--blueprint-may-read-adjacent-files`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
- `--login`: Automatically log the user in as an administrator.
- `--mode=<mode>`: Choose how Blueprint v2 prepares the site: `create-new-site`, `apply-to-existing-site`, or `mount-only`. Cannot be combined with `--auto-mount`, `--wordpress-install-mode`, or `--skip-sqlite-setup`.
- `--wordpress-install-mode <mode>`: Control how Playground prepares WordPress before booting. Defaults to `download-and-install`. Other options: `install-from-existing-files` (install using files you've mounted), `install-from-existing-files-if-needed` (same, but skip setup when an existing site is detected), and `do-not-attempt-installing` (never download or install WordPress).
- `--skip-sqlite-setup`: Do not set up the SQLite database integration.
- `--verbosity`: Output logs and progress messages (choices: "quiet", "normal", "debug"). Defaults to "normal".
- `--debug`: Print the PHP error log if an error occurs during boot.
- `--follow-symlinks`: Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. ⚠️ Warning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.
- `--workers=<n|auto>`: Number of request-handling worker threads. Pass a positive integer, or `auto` to use one worker per CPU core (minus one). Defaults to `min(6, cpus-1)`. Useful for multi-client workloads (e.g. parallel e2e suites) that need more than 6 in-flight requests.
- `--experimental-multi-worker`: Deprecated. Use `--workers=<n|auto>` instead. The value of this flag is ignored.
- `--phpmyadmin[=<path>]`: Install phpMyAdmin for database management. The phpMyAdmin URL will be printed after boot. Optionally specify a custom URL path (default: `/phpmyadmin`).
- `--internal-cookie-store`: Enables Playground's internal cookie handling. When active, Playground uses an HttpCookieStore to manage and persist cookies across requests. If disabled, cookies are handled externally, like by a browser in Node.js.
- `--php-extension=<manifest>`: Load a custom PHP.wasm extension manifest before PHP starts. Accepts local paths, `file:` URLs, and `http(s):` URLs. Can be used multiple times.

### Loading Custom PHP.wasm Extensions

Custom extensions built with `@php-wasm/compile-extension` can be loaded with
`--php-extension`:

```bash
npx @wp-playground/cli@latest server \
	--php=8.4 \
	--php-extension=./dist/wp_mysql_parser/manifest.json
```

The manifest selects the `.so` artifact matching the active PHP version and can
stage sidecar files before PHP starts. External extensions are JSPI-only, so use
Node.js 23 or newer.

Add runtime settings such as `iniEntries` and `env` directly to the manifest:

```json
{
	"name": "spx",
	"version": "0.1.0",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "spx-php8.4-jspi.so"
		}
	],
	"iniEntries": {
		"spx.http_enabled": "1"
	},
	"env": {
		"SPX_DATA_DIR": "/internal/shared/spx/data"
	}
}
```

Set `loadWithIniDirective` to `false` when the artifact is a loadable Wasm
side module that should be staged before PHP starts but should not be registered
with `extension=` or `zend_extension=` in php.ini:

```json
{
	"name": "sqlite_markdown",
	"version": "0.1.0",
	"loadWithIniDirective": false,
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "sqlite_markdown-php8.4-jspi.so"
		}
	]
}
```

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

Blueprint v2 declarations are routed to the native TypeScript v2 runner
automatically.

CLI runtime flags such as `--php`, `--wp`, and `--login` fill missing v2
runtime fields. When the Blueprint declares `phpVersion`, `wordpressVersion`,
or WordPress Playground login settings, the Blueprint value takes precedence.

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
