---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

# Playground CLI

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment.

**Key features:**

- **Quick Setup**: Set up a local WordPress environment in seconds.
- **Flexibility**: Allows for configuration to adapt to different scenarios.
- **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it.

The Playground CLI includes two main commands for running WordPress locally:

- **`start`** (Simplified): Auto-detects your project type, persists sites between sessions, and opens a browser automatically.
- **`server`** (Advanced): Provides full manual control over configuration. Best for custom setups, CI/CD pipelines, or when you need fine-grained control.

## Requirements

The Playground CLI requires Node.js 20.18 or higher. Node 20 is end-of-life,
so use a currently supported Node.js release for security updates. You can
download one from the [Node.js website](https://nodejs.org/en/download).

The published package delegates to the native Wasmtime runtime. It supports
`start`, `server`, `run-blueprint`, and `build-snapshot`, with PHP 8.2 as its
only PHP version. Linux packages target GNU libc; Alpine/musl Linux is not
currently supported.

## Quickstart

To run the Playground CLI, open a command line and use one of the following commands:

### Using `start` (Simplified)

The `start` command is the easiest way to get started. It automatically detects your project type, persists your site, and opens the browser:

```bash
npx @wp-playground/cli@latest start
```

When run inside a plugin or theme directory, `start` automatically mounts your project:

```bash
cd my-plugin
npx @wp-playground/cli@latest start
```

**Key differences from `server`:**

- Auto-login is enabled by default
- Opens browser automatically
- Auto-mounts the project by default

## Migrating from wp-now

The deprecated `@wp-now/wp-now` package maps most directly to the `start`
command:

| wp-now                                                  | Playground CLI                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `npx @wp-now/wp-now start`                              | `npx @wp-playground/cli@latest start`                              |
| `npx @wp-now/wp-now start --path=./plugin`              | `cd ./plugin && npx @wp-playground/cli@latest start`               |
| `npx @wp-now/wp-now start --wp=6.8 --php=8.2`           | `npx @wp-playground/cli@latest start --wp=6.8 --php=8.2`           |
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

### Using `server` (Advanced)

The `server` command provides full control over configuration:

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI in Action](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/developers/npx-wp-playground-server.gif)

**Automatic site persistence:** When the `start` command manages the WordPress
root directory, it keeps your WordPress site persistent across sessions. Your
files and database are stored in `~/.wordpress-playground/sites/<path-hash>/`,
where `<path-hash>` is derived from the command's current working directory. If
you start from a full WordPress installation, or explicitly mount `/wordpress`,
that mounted directory becomes the persistent store instead.

This is useful when:

- You want a clean WordPress installation
- Testing fresh installation scenarios
- Your site data became corrupted or inconsistent

<div class="callout callout-info">

The `--reset` flag works only with `start`. `server` does not use the managed
`~/.wordpress-playground/sites/<path-hash>/` store: delete the host directory
you mounted, or remove its generated OS-temp directories after the process has
stopped.

</div>

### Choosing a WordPress Version

By default, the CLI loads the latest stable version of WordPress. Use
`--wp=<version>` to select another WordPress release. PHP 8.2 is the only
supported PHP version; `--php` may be omitted or set to `8.2`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.2
```

### Loading Blueprints

One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). For those unfamiliar with this technology, it allows developers to configure the initial state for their WordPress Playground instances.

Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We’ll use the example below to do this.

**(my-blueprint.json)**

```bash
{
  "login": true,
  "steps": [
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "hello-dolly"
      },
      "options": {
        "activate": true
      }
    }
  ]
}
```

CLI command loading a blueprint:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

The native v1 interpreter rejects behavioral top-level fields it cannot yet
honor, including `landingPage`, `preferredVersions`, `features`, `constants`,
and `plugins`. Use supported startup steps and explicit CLI flags instead.

### Mounting folders manually

Some projects have a specific structure that requires a custom configuration; for example, your repository contains all the files in the `/wp-content/` folder. So in this scenario, you can specify to the Playground CLI that it will mount your project from that folder using the `--mount` flag.

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

### Mounting before WordPress installation

Mount your WordPress project files before installation when the native runtime
must inspect or use those files while preparing the site. The
`--mount-before-install` flag supports this process.

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

<div class="callout callout-info">

On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format: `"/host/path"` `"/vfs/path"`.

</div>

### Understanding Data Persistence and SQLite Location in `server` mode

Without an explicit `/wordpress` or `/tmp` mount, the native CLI creates two
independent directories below your operating system's temp directory:

```
<OS-TEMP-DIR>/wp-playground-native-wordpress-<id>/  # WordPress and SQLite
<OS-TEMP-DIR>/wp-playground-native-tmp-<id>/        # Temporary PHP files
```

The OS-specific temp root is commonly:

- **macOS/Linux**: May be under `/tmp/` or `/private/var/folders/` (varies by system)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

The database location depends on what you mount:

- **Auto-mounting wp-content or full WordPress**:
    - Database: `<your-local-project>/wp-content/database/.ht.sqlite`
    - **Persisted locally** in your project folder

- **Auto-mounting plugin/theme only**:
    - Database: `<OS-TEMP-DIR>/wp-playground-native-wordpress-<id>/wp-content/database/.ht.sqlite`
    - Not part of your project checkout

- **Custom mounts**: Database location follows your mount configuration

The native CLI does not currently remove generated temp directories after
exit. Once the process has stopped, remove directories matching the two
prefixes above when you no longer need them. Your operating system may also
clean its temp directory according to its own policy.

**Recommendation:** To persist both your code and database when developing plugins or themes, mount the entire `wp-content` directory instead of just the plugin/theme folder.

**Example: Mounting wp-content for persistence**

```bash
# Mount your entire wp-content directory
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount=./wp-content:/wordpress/wp-content
```

### Data Persistence in `start` mode

When `start` manages the WordPress root directory, Playground CLI
**automatically persists** your WordPress site in a dedicated directory:

```
~/.wordpress-playground/sites/<path-hash>/
├── wp-admin/           # WordPress installation
├── wp-content/
└── wp-includes/
```

The `<path-hash>` is derived from the command's current working directory.
This ensures isolation between different projects when you run `start` from each
project directory.

#### Persistence behavior

- **Default (no WordPress root mount)**: WordPress files and database persist in `~/.wordpress-playground/sites/<path-hash>/`. Changes survive between CLI restarts.
- **Full WordPress directory or explicit `/wordpress` mount**: Automatic persistence in `~/.wordpress-playground/sites/<path-hash>/` is skipped. The mounted WordPress directory is the persistent store.

The database location depends on your configuration:

- **Default (automatic persistence)**:
    - Database: `~/.wordpress-playground/sites/<path-hash>/wp-content/database/.ht.sqlite`
    - **Persisted automatically** between sessions
- **Full WordPress directory or explicit `/wordpress` mount**:
    - Database: Follows the mounted WordPress directory
    - **Persisted in that mounted directory**

#### Resetting a persisted site

To start fresh, use the `--reset` flag with the `start` command:

```bash
npx @wp-playground/cli@latest start --reset
```

## Command and Arguments

Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

- **`start`**: (Simplified) Starts a local WordPress server with automatic project detection, site persistence, and browser opening.
- **`server`**: (Advanced) Starts a local WordPress server with full manual control over configuration.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.

The `start` command supports these common optional arguments. Run
`npx @wp-playground/cli@latest start --help` for a command overview and common
options:

- `--path=<path>`: Path to the project directory. Defaults to the current working directory.
- `--wp=<version>`: WordPress version to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. The only supported value is `8.2`, which is also the default.
- `--port=<port>`: The port number for the server to listen on. Defaults to 9400 when available.
- `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
- `--login`: Automatically log the user in as an administrator. Defaults to true.
- `--skip-browser`: Do not open the site in your default browser.
- `--reset`: Delete the stored site and start fresh. Defaults to false.
- `--no-auto-mount`: Disable automatic project detection.

The `server` command supports these common optional arguments. Run
`npx @wp-playground/cli@latest server --help` for a command overview and common
options:

- `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
- `--site-url=<url>`: Site URL to use for WordPress. Defaults to `http://127.0.0.1:{port}`.
- `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. The only supported value is `8.2`, which is also the default.
- `--auto-mount[=<path>]`: Automatically mount a directory. If no path is provided, mounts the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.
- `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: `"/host/path:/vfs/path"`.
- `--mount-before-install`: Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: `"/host/path:/vfs/path"`.
- `--mount-dir`: Mount a directory to the PHP runtime (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`.
- `--mount-dir-before-install`: Mount a directory before WordPress installation (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`
- `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
- `--blueprint-may-read-adjacent-files`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
- `--login`: Automatically log the user in as an administrator.
- `--wordpress-install-mode <mode>`: Control how Playground prepares WordPress before booting. Defaults to `download-and-install`. Other options: `install-from-existing-files` (install using files you've mounted), `install-from-existing-files-if-needed` (skip setup when an existing site is detected), and `do-not-attempt-installing` (never download or install WordPress).
- `--skip-sqlite-setup`: Do not set up the SQLite database integration.
- `--verbosity=<level>`: Output logs and progress messages. Choices: `quiet`, `normal`, `debug`. Defaults to `normal`.
- `--debug`: Print the PHP error log if an error occurs during boot.
- `--follow-symlinks`: Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories.
- `--workers=<n|auto>`: Number of request-handling worker threads. Pass a positive integer, or `auto` to use one worker per CPU core (minus one). Defaults to `min(6, cpus-1)`. Useful for multi-client workloads (e.g. parallel e2e suites) that need more than 6 in-flight requests.

### Current native runtime constraints

The Wasmtime PHP 8.2 component does not include dynamic PHP extension loading,
Intl, Redis, Memcached, Xdebug, phpMyAdmin, the Node-only internal cookie store,
or Blueprint v2 mode selection. It also does not expose a standalone `php`
command. Unsupported requests fail explicitly; the package does not silently
fall back to another runtime.

<div class="callout callout-warning">

With the flag `--follow-symlinks`, the following symlinks will expose files outside mounted directories to Playground and could be a security risk.

</div>

## Need some help with the CLI?

Use the top-level `--help` flag to list commands. Command-specific help provides
an overview and common options; it is not an exhaustive generated flag list.

```bash
npx @wp-playground/cli@latest --help
```

## Programmatic usage

The Playground CLI can also be controlled programmatically from JavaScript/TypeScript
using the `runCLI` function. See the [Programmatic Usage guide](/guides/programmatic-playground-cli)
for details on automation and testing.
