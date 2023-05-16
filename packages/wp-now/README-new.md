# wp-now

`wp-now` streamlines the process of setting up a local WordPress environment.

It uses automatic mode detection to provide a fast setup process, regardless of whether you're working on a plugin or an entire site. You can easily switch between PHP and WordPress versions with just a configuration argument. Under the hood, `wp-now` is powered by WordPress Playground and only requires Node.js.

## Getting Started

To install `wp-now` directly from `npm`:

```bash
npm install -g @wp-now/wp-now
```

Alternatively, you can install `wp-now` via `git clone` if you'd like to hack on it too. See [Contributing](#contributing) for more details.

Once installed, you can use it like so:

```bash
cd wordpress-plugin-or-theme
wp-now start
```

Use the `--php=<version>` and `--wp=<version>` arguments to switch to different versions on the fly:

```bash
wp-now start --wp=5.9 --php=7.4
```

### Automatic Modes

`wp-now` automatically operates in a few different modes. The selected mode depends on the directory in which it is executed:

-   **plugin**, **theme**, or **wp-content**: Loads the project files into a virtual filesytem with WordPress and a SQLite-based database. Everything (including WordPress core files, the database, `wp-config.php`, etc.) is stored in the user's home directory and loaded into the virtual filesystem. The latest version of WordPress will be used, unless the `--wp=<version>` argument is provided.
-   **wordpress**: Runs the directory as a WordPress installation when WordPress files are detected. An existing `wp-config.php` file will be used if it exists; if it doesn't exist, it will be created along with a SQLite database.
-   **wordpress-develop**: Same as `wordpress` mode, except the `build` directory is served as the web root.
-   **index**: Starts a PHP webserver in the working directory and simply passes requests to `index.php`.

### Arguments

`wp-now start` currently supports the following arguments:

-   `--path=<path>`: the path to the PHP file or WordPress project to use. If not provided, it will use the current working directory;
-   `--php=<version>`: the version of PHP to use. This is optional and if not provided, it will use a default version which is `8.0`(example usage: `--php=7.4`);
-   `--port=<port>`: the port number on which the server will listen. This is optional and if not provided, it will pick an open port number automatically. The default port number is set to `8881`(example of usage: `--port=3000`);
-   `--wp=<version>`: the version of WordPress to use. This is optional and if not provided, it will use a default version. The default version is set to the [latest WordPress version](https://wordpress.org/download/releases/)(example usage: `--wp=5.8`)

## Technical Details

-   The `~/.wp-now` home directory is used to store the WP versions and the `wp-content` folders for projects using 'theme', 'plugin', and 'wp-content' modes. The path to `wp-content` directory for the 'plugin', 'theme', and 'wp-content' modes is `~/.wp-now/wp-content/${projectName}-${directoryHash}`.
-   For the database setup, `wp-now` is using [SQLite database integration plugin](https://wordpress.org/plugins/sqlite-database-integration/). The path to SQLite database is ` ~/.wp-now/wp-content/${projectName}-${directoryHash}/database/.ht.sqlite`

## Known Issues

-   Running `wp-now start` in 'wp-content' or 'wordpress' mode will produce some empty directories: [WordPress/wordpress-playground#328](https://github.com/WordPress/wordpress-playground/issues/328)
-   If you have an existing MySQL database defined in your `wp-config.php`, `wp-now` will still mount SQLite and the site won't load: [WordPress/wordpress-playground#327](https://github.com/WordPress/wordpress-playground/issues/327)

## Comparisions

### Laravel Valet

If you are migrating from Laravel Valet, you should be aware of the differences it has with `wp-now`:

-   `wp-now` does not require you to install WordPress separately, create a database, connect WordPress to that database or create a user account. All of these steps are handled by the `wp now start` command and are running under the hood;
-   `wp-now` works across all platforms (Mac, Linux, Windows);
-   `wp-now` does not support custom domains or SSL (yet!);
-   `wp-now` works with WordPress themes and plugins even if you don't have WordPress installed;
-   `wp-now` allows to easily switch the WordPress version with `wp-now start --wp=version.number`(make sure to replace the `version.number` with the actual WordPress version);
-   `wp-now` does not support Xdebug PHP extension (yet!)

Some similarities between Laravel Valet and `wp-now` to be aware of:

-   could be used for non-WordPress projects;
-   deployments are not possible with neither Laravel Valet, nor `wp-now`;
-   possible to switch easily the PHP version;
-   possibility to work on multiple WordPress sites simultaneously

### wp-env

If you are migrating from `wp-env`, you should be aware of the differences it has with `wp-now`:

-   `wp-now` supports non-WordPress projects;
-   `wp-now` does not need Docker;
-   `wp-now` does not support Xdebug PHP extension (yet!);
-   `wp-now` does not include Jest for automatic browser testing

Some similarities between `wp-env` and `wp-now` to be aware of:

-   no support for custom domains or SSL;
-   `plugin`, `themes` and index modes are available on `wp-env` and `wp-now`;
-   deployments are not possible with neither `wp-env`, nor `wp-now`;
-   possible to switch easily the PHP version

## Contributing

We welcome contributions from the community!

In order to contribute to `wp-now`, you'll need to first install a few global dependencies:

-   Make sure you have `nvm` installed. If you need to install it first,
    [follow these installation instructions](https://github.com/nvm-sh/nvm#installation).
-   Install `yarn` by running `npm install -g yarn`.
-   Install `nx` by running `npm install -g nx`.

Once the global dependencies are installed, you can start using the repo:

```bash
git clone git@github.com:WordPress/wordpress-playground.git
cd wordpress-playground
nvm use
yarn install
yarn build
nx preview wp-now start --path=/path/to/wordpress-plugin-or-theme
```

If you'd like to make the `wp-now` executable globally available when using this installation method, run `npm link`. It's not particularly reliable, however.

Please refer to the main [README.md](../../README.md) file for more detail on how to contribute to this project.

## Testing

To run the unit tests, use the following command:

```bash
nx test wp-now
```

## Publishing

The `wp-now` package is part of a larger monorepo, sharing its space with other sibiling packages. To publish the `wp-now` package to npm, you must first understand the automated release process facilitated by lerna. This process includes automatically incrementing the version number, creating a new tag, and publishing all modified packages to npm simultaneously. Notably, all published packages share the same version number.

Each package identifies a distinct organization in its `package.json` file. To publish the `wp-now` package, you need access to the npm organizations `@wp-playground`, `@php-wasm`, and `@wp-now`.

To initiate the publishing process for the all the modified packages, execute the following commands:

```bash
npm login # this is required only once and it will store the credentials in ~/.npmrc file.
npm run release
```
