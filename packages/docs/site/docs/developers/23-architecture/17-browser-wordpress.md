# Bundling WordPress for the browser

The [web bundler Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) turns a vanilla WordPress into a browser-optimized one:

-   Makes WordPress run on SQLite using the [official drop-in plugin](https://github.com/WordPress/sqlite-database-integration) as MySQL is unsupported in the browser.
-   Reduces the WordPress website size from about 70MB to about 10MB, or 5MB compressed.
-   Runs the WordPress installation wizard.
-   Bundles WordPress as a [data dependency](/developers/architecture/wasm-php-data-dependencies)

Build a new bundle with `nx bundle-wordpress playground-wordpress-builds --wp-version=<version>`, e.g.:

```
nx bundle-wordpress playground-wordpress-builds --wp-version=6.1
```

The bundler outputs:

-   `packages/playground/wordpress-builds/public/wp-6.1.zip` – zipped WordPress files
-   `packages/playground/wordpress-builds/public/wp-6.1/` – a directory with static assets for the specified WordPress versions

Consult [the web bundler Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) for more details (like the list of supported WordPress versions) and modify it to customize the default WordPress installation.
