# Bundling WordPress for the browser

The [web bundler Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) turns a vanilla WordPress into a browser-optimized one:

* Makes WordPress run on SQLite using [the drop-in plugin](https://github.com/aaemnnosttv/wp-sqlite-db) as MySQL is unsupported in the browser.
* Reduces the WordPress website size from about 70MB to about 10MB, or 5MB compressed.
* Runs the WordPress installation wizard.

Build a new bundle with the following command:

```
npm run build:wp
```

The bundler outputs two files:

* `build/wp.js` – the JavaScript loader for `wp.data`
* `build/wp.data` – the WordPress data bundle consisting of concatenated contents of all WordPress files

Consult [the web bundler Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/wordpress-playground/wordpress/Dockerfile) for more details and modify it to customize the default WordPress installation.
