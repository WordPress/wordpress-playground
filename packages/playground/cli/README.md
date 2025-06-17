# WordPress Playground CLI

`@wp-playground/cli` streamlines the process of setting up a local WordPress environment for development and testing. It uses WordPress playground to seamlessly start a new WordPress environment. As the antecessor `wp-now`, you can switch between PHP and WordPress versions with a flag.

The only requirement to run the Playground CLI is to have installed `Node.js 20.18.3` or superior, which you can find at [Node.js website](https://nodejs.org/en/download).

## Quickstart

Running the playground CLI is as simple as accessing your plugin or theme directory and running the following command:

```shell
cd my-plugin-or-theme-directory
npx @wp-playground/cli server --autoMount
```

The flag `--autoMount` will figure out if the project folder is a Plugin or a Theme. For more custom scenarios, we can work with the following example using the flag `--mount`.

### Mount a project into Playground

To start using the CLI, mounting the current project folder to a specific WordPress folder, for example, I would like to set my plugin project folder into `wordpress/wp-content/plugins/`. We will use the following command:

```shell
cd my-plugin-or-theme-directory
npx @wp-playground/cli server --mount=.:/wordpress/wp-content/plugins/
```

# Table of contents

-   Quickstart
-   Requirements
-   Usage
-   Using Blueprints
-   Contributing

## Requirements

The minimum supported version of Node.js is 20. The latest LTS version (20.18 or newer) is recommended.

## Usage

You don't have to install `@wp-playground/cli`, you can run directly with `npx`. This is the recommended way to use the CLI and requires no permanent installation. To run a vanilla WordPress website, you can run the command:

```bash
npx @wp-playground/cli server
```

### Choosing a WordPress Version

By default, the CLI will load the latest stable version from WordPress. To set up the preferred version, we can use the flags `--wp=<version>`. This flag will switch to different versions on the fly:

```bash
 npx @wp-playground/cli server --wp=6.8
```

<!-- --php flag is deprecated, look at the new alternatives -->

### Mounting local Directories

`@wp-playground/cli` operates by mounting your local project files into a virtualized WordPress environment. You can do this automatically or manually.

### Automatic Mounting with --autoMount

The `--autoMount` flag is the easiest way to get started. It inspects the current directory and automatically mounts it to the correct location in the virtual WordPress site. It supports the following directory types:

-   **Plugin Mode:** Presence of a PHP file with "Plugin Name:" in its header.
-   **Theme Mode**: Presence of a style.css file with "Theme Name:" in its header.
-   **wp-content Mode**: Presence of plugins and themes subdirectories.
-   **WordPress Mode**: Presence of a complete WordPress installation. The directory will be mounted to the root `/wordpress` folder.

### Manual Mounting

For more control, you can manually specify with the flag `--mount` and ∫

@wp-playground/cli operates by mounting your local project files into a virtualized WordPress environment. You can do this automatically or manually.
Automatic Mounting with --autoMount
The --autoMount flag is the easiest way to get started. It inspects the current directory and automatically mounts it to the correct location in the virtual WordPress site. It supports the following directory types:
Plugin Mode: Presence of a PHP file with "Plugin Name:" in its header.
Theme Mode: Presence of a style.css file with "Theme Name:" in its header.
wp-content Mode: Presence of plugins and themes subdirectories.
WordPress Mode: Presence of a full WordPress installation. The directory will be mounted to /wordpress.
Basic Web Server: If none of the above match, it starts a simple PHP web server in the current directory.

Playground CLI is simple, configurable, and unopinionated. You can set it up
to your unique WordPress setup. For example, this command would run the documentation
workflow at https://github.com/adamziel/playground-docs-workflow:

## Philosophy

The data flow is as follows:

-   Start PHP
-   Mount any local directories
-   Put a fresh WordPress in the resulting virtual filesystem (unless you're mounting directly at /wordpress).
-   Run the Blueprint
-   Start a local server, accept requests

On each run, a fresh WordPress release is unzipped in the virtual filesystem. It is sourced
from a zip file cached at ~/.wordpress-playground/. If you mess up your site, just restart the
server and you'll get a fresh one, again unzipped. The CLI tool never modifies the zip file
so you can always be sure you're starting from a clean slate.

## Future work

The CLI tool will have the following commands:

-   `server` - start a fresh WordPress playground server.
-   `build-snapshot` - run a Blueprint and output a .zip file with the resulting WordPress instance.
-   `run-blueprint` - run a Blueprint and output errors to the console if they occur.

It will also support:

-   Loading Blueprints from URLs.
-   Saving the running WordPress site and loading it later.
-   Caching all remote resources referenced in Blueprints. Currently, say, plugins are downloaded on each run.

Conceptually, this isn't too different from Docker containers. There are images (zip files),
containers (running instances), and commands (Blueprints). Playground could support the same
concepts such as:

-   Listing and managing available images and containers.
-   Saving a running container and restoring it later
-   Starting a container from a specific image (already supported via zip files)
-   Running a command in a container (the `php` command)
-   Building a new image from a Blueprint (the `build` command)
-   Step-by-step cache for Blueprints so that only the changed steps are re-run.

## Interoperability

This CLI package is not just a useful tool. It drives interoperability between the in-browser
Playground, CLI packages, and the PHP Blueprints library. Once complete, it will reuse the
same internals as the website at https://playground.wordpress.org whether we're talking about
running PHP code, executing Blueprints, building snapshots, serving requests, or maintaining
multiple PHP instances
