# WP-NOW

`wp-now` is a Command Line Interface (CLI) tool designed to streamline the process of setting up a local WordPress environment by using only Node.js. This powerful tool is optimized for developers working on WordPress themes and plugins.

## Getting Started

Before getting started:

-   Make sure you have `nvm` installed. If you need to install it first,
    [follow these installation instructions](https://github.com/nvm-sh/nvm#installation). Please note that if you are installing `wp-now` from `npm`, **this step is not necessary**;
-   Install `yarn` by running `npm install -g yarn`

## Option 1: Using WP-NOW globally across your projects

---

### Building

To build the project, use the following commands in your terminal:

1. Clone this repository locally
2. Run `npm link` (only run it **ONCE**) to make `wp-now` available globally across your projects
3. Execute `nvm use`
4. Execute `yarn install` followed by `yarn build`
5. `wp-now` should be now available globally on your machine. This means that you can run `wp-now start` from any path on your local machine

### Running

Once you have built `wp-now`, this is how you can use it:

```bash
cd wordpress-plugin-or-theme
wp-now start
```

Additionally, you can specify the arguments such as `--port`, `--php` and `--wp`. For more details, see **Arguments supported by wp-now start section**.

## Option 2: Development flow

If you would like to be able to not use `wp-now` globally and manually specify the path to each project, you can use this development flow instead:

1. Execute `npm install -g nx@latest`. This will make `nx` command globally accessible in the project.
2. Start the web server in one of the modes specified below:

### Modes on WP-NOW

`wp-now` operates in four different modes:

The mode of the `wp-now` will depend on the destination folder and whether you are working with a single plugin or a theme, `wp-content` directory or a single PHP file.

-   `index`: executes a simple PHP file. If your destination folder does not contain a `theme`, `plugin` or `wp-content` directory, `wp-now` will run in the `index` mode serving the content of the folder without mounting a WordPress instance. For this mode, `index.php` is recommended
-   `theme`: loads WordPress with your selected theme included
-   `plugin`: loads WordPress with your selected plugin included
-   `wp-content`: loads WordPress site that contains plugins and themes from the provided wp-content directory

To launch the `wp-now` in the `index` mode, you can run:

```bash
nx preview wp-now start --path=/path/to/index.php-file
```

To launch the `wp-now` in the `theme` or `plugin` mode, you can run:

```bash
nx preview wp-now start --path=/path/to/wordpress-plugin-or-theme
```

To launch the `wp-now` in the `wp-content` mode, you can run:

```bash
nx preview wp-now start --path=/path/to/wp-content-directory
```

Make sure to replace `/path/to/wordpress-plugin-or-theme` or `/path/to/wp-content-directory` with the actual path to your plugin or theme folder or wp-content directory.

### Arguments supported by wp-now start

`wp-now start` currently supports the following arguments:

-   `--port`: the port number on which the server will listen. This is optional and if not provided, it will pick an open port number automatically. The default port number is set to `8881`(example of usage: `--port=3000`);
-   `--path`: the path to the PHP file or WordPress project to use. If not provided, it will use the current working directory;
-   `--php`: the version of PHP to use. This is optional and if not provided, it will use a default version which is `8.0`(example of usage: `--php=7.4`);
-   `--wp`: the version of WordPress to use. This is optional and if not provided, it will use a default version. The default version is set to the [latest WordPress version](https://wordpress.org/download/releases/)(example of usage: `--wp=5.8`)

#### Example of using `wp-now start` arguments:

Specify plugin path, WordPress version, PHP version and port number:

```bash
nx preview wp-now start --path=/path/to/wordpress-plugin-or-theme --wp=5.9 --php=7.4 --port=3000
```

Please note: if you use `npm link` and are executing `wp-now` from the plugin or theme folder, you don't need to specify the path. In that case, the command would be:

```bash
wp-now start --wp=5.9 --php=7.4 --port=3000
```

## How to install WP-NOW from npm

To install `wp-now` directly from `npm`, execute:

```bash
npm install -g @wp-now/wp-now
```

Once installed, you can use it like so:

```bash
cd wordpress-plugin-or-theme
wp-now start
```

## Testing

To run the unit tests, use the following command:

```bash
nx test wp-now
```

## Other important technical details

-   The `~/.wp-now` home directory is used to store the WP versions and the `wp-content` folders for projects using theme and plugin mode. The path to `wp-content` directory for the `plugin` and `theme` modes is `~/.wp-now/wp-content/${projectName}`.
-   For the database setup, `wp-now` is using [Sqlite database integration plugin](https://wordpress.org/plugins/sqlite-database-integration/). The path to Sqlite database is ` ~/.wp-now/wp-content/${projectName}/database/.ht.sqlite`

## Migrating from Laravel Valet?

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

## Migrating from wp-env?

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

We welcome contributions from the community! Please refer to the main [README.md](../../README.md) file for instructions on how to contribute to this project.
