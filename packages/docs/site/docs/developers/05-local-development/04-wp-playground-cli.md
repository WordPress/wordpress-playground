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

## Requirements

The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).

## Quickstart

To run the Playground CLI, open a command line and use the following command:

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI in Action](@site/static/img/developers/npx-wp-playground-server.gif)

With the previous command, you only get a fresh WordPress instance to test. Most developers will want to test their own work. To test a plugin or a theme, navigate to your project folder and run the CLI with the `--auto-mount` flag:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

### Choosing a WordPress and PHP Version

By default, the CLI loads the latest stable version of WordPress and PHP 8.3 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.3
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
On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format: `"/host/path"` `"/vfs/path"`.
:::

### Understanding Data Persistence and SQLite Location

By default, Playground CLI stores WordPress files and the SQLite database in **temporary directories on your operating system**:

```
<OS-TEMP-DIR>/playground-<random-id>/
├── wordpress/          # WordPress installation
├── internal/          # Playground runtime config
└── tmp/              # Temporary PHP files
```

**Finding Your Temp Directory:**

The actual location depends on your OS (these are examples or common possibilities):

- **macOS/Linux**: May be under `/tmp/` or `/private/var/folders/` (varies by system)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

To see the exact temp directory path being used, run the CLI with the `--verbosity=debug` flag:

```bash
npx @wp-playground/cli@latest server --verbosity=debug
```

This will output something like:

```
Native temp dir for VFS root:
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC
Mount before WP install: /home ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/home
Mount before WP install: /tmp ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/tmp
Mount before WP install: /wordpress ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/wordpress
```

**Where is the SQLite Database Stored?**

The database location depends on what you mount:

- **Auto-mounting wp-content or full WordPress**:
    - Database: `<your-local-project>/wp-content/database/.ht.sqlite`
    - ✅ **Persisted locally** in your project folder

- **Auto-mounting plugin/theme only**:
    - Database: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ **Lost when server stops** (temp directories are cleaned up)

- **Custom mounts**: Database location follows your mount configuration

**Automatic Cleanup:**
Playground CLI automatically removes temp directories that are:

- Older than 2 days
- No longer associated with a running process

**Recommendation:** To persist both your code and database when developing plugins or themes, mount the entire `wp-content` directory instead of just the plugin/theme folder.

**Example: Mounting wp-content for persistence**

```bash
# Mount your entire wp-content directory
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount=./wp-content:/wordpress/wp-content
```

## Command and Arguments

Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

- **`server`**: (Default) Starts a local WordPress server.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.

The `server` command supports the following optional arguments:

- `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
- `--version`: Show version number.
- `--outfile`: When building, write to this output file.
- `--site-url=<url>`: Site URL to use for WordPress. Defaults to `http://127.0.0.1:{port}`.
- `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. Choices: `8.5`, `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`. Defaults to `8.5`.
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
- `--internal-cookie-store`: Enable internal cookie handling. When enabled, Playground will manage cookies internally using an HttpCookieStore that persists cookies across requests. When disabled, cookies are handled externally (e.g., by a browser in Node.js environments). Defaults to false.
- `--xdebug`: Enable Xdebug. Defaults to false.
- `--experimental-devtools`: Enable experimental browser development tools. Defaults to false.
- `--experimental-multi-worker=<number>`: Enable experimental multi-worker support which requires a `/wordpress` directory backed by a real filesystem. Pass a positive number to specify the number of workers to use. Otherwise, defaults to the number of CPUs minus 1.

:::caution
With the flag `--follow-symlinks`, the following symlinks will expose files outside mounted directories to Playground and could be a security risk.
:::

## Need some help with the CLI?

With the Playground CLI, you can use the `--help` flag to get the full list of available commands and arguments.

```bash
npx @wp-playground/cli@latest --help
```

## Programmatic Usage with JavaScript

The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. Let's cover the basics of using `runCLI`.

### Running a WordPress instance with a specific version

Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type.

```TypeScript
import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true
} as RunCLIArgs);
```

To execute the code above, the developer can set their preferred method. A simple way to execute this code is to save it as a `.ts` file and run it with a tool like `tsx`. For example: `tsx my-script.ts`

### Setting a Blueprint

You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file.

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
  command: 'server',
  wp: 'latest',
  blueprint: {
    steps: [
        {
          "step": "setSiteOptions",
          "options": {
              "blogname": "Blueprint Title",
              "blogdescription": "A great blog description"
          }
        }
    ],
  },
});
```

For full type-safety when defining your blueprint object, you can import and use the `BlueprintDeclaration` type from the `@wp-playground/blueprints` package:

```TypeScript
import type { BlueprintDeclaration } from '@wp-playground/blueprints';

const myBlueprint: BlueprintDeclaration = {
  landingPage: "/wp-admin/",
  steps: [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwentyone"
      },
      "options": {
        "activate": true
      }
    }
  ]
};
```

### Mounting a plugin programmatically

It is possible to mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. This path should be relative to where your script is being executed.

```TypeScript
	cliServer = await runCLI({
      command: 'server',
      login: true,
      'mount-before-install': [
        {
          hostPath: './[my-plugin-local-path]',
          vfsPath: '/wordpress/wp-content/plugins/my-plugin',
        },
      ],
    });
```

With those options we can combine mounting parts of the project with blueprints, for example:

```TypeScript

import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true,
    mount: [
        {
            "hostPath": "./plugin/",
            "vfsPath": "/wordpress/wp-content/plugins/playwright-test"
        }
    ],
    blueprint: {
        steps: [
            {
                "step": "activatePlugin",
                "pluginPath": "/wordpress/wp-content/plugins/playwright-test/plugin-playwright.php"
            }
        ]
    }
} as RunCLIArgs);
```
