# WordPress Playground Web Extensionxtension

A Web Extensionxtension tool for running WordPress playground locally instead of in the browser:

```shell
$ bun packages/playground/web-extension/src/web-extension.ts start --wp=6.5
WordPress is running on http://127.0.0.1:9400
```

Playground Web Extensionxtension is simple, configurable, and unoppinionated. You can set it up
to your unique WordPress setup. For example, this command would run the documentation
workflow at https://github.com/adamziel/playground-docs-workflow:

```shell
bun --config=/Users/adam/.bunfig.toml \
    ./packages/playground/web-extension/src/web-extension.ts \
    start \
    --mount=./wp-content/plugins/wp-docs-plugin:/wordpress/wp-content/plugins/wp-docs-plugin \
    --mount=./wp-content/html-pages:/wordpress/wp-content/html-pages \
    --mount=./wp-content/uploads:/wordpress/wp-content/uploads \
    --mount=./wp-content/themes/playground-docs:/wordpress/wp-content/themes/playground-docs \
    --blueprint=./wp-content/blueprint-wp-now.json \
    --wp=6.5
```

It is long, sure, but it is also very flexible. If you need a shorter version, you can alias
it or write a bash script. In the future, Blueprints might support relative path mappings,
at which point that command would get much shorter.

## Philosophy

The data flow is as follows:

-   Start PHP
-   Mount any local directories
-   Put a fresh WordPress in the resulting virtual filesystem (unless you're mounting directly at /wordpress).
-   Run the Blueprint
-   Start a local server, accept requests

On each run, a fresh WordPress release is unzipped in the virtual filesystem. It is sourced
from a zip file cached at ~/.wordpress-playground/. If you mess up your site, just restart the
server and you'll get a fresh one, again unzipped. The Web Extensionxtension tool never modifies the zip file
so you can always be sure you're starting from a clean slate.

## Future work

The Web Extensionxtension tool will have the following commands:

-   `serve` - start a fresh WordPress playground server.
-   `build` – run a Blueprint and output a .zip file with the resulting WordPress instance.
-   `php` - run the specified PHP file.

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

This Web Extensionxtension package is not just a useful tool. It drives interoperability between the in-browser
Playground, Web Extensionxtension packages, and the PHP Blueprints library. Once complete, it will reuse the
same internals as the website at https://playground.wordpress.org whether we're talking about
running PHP code, executing Blueprints, building snapshots, serving requests, or maintaining
multiple PHP instances
