## Contributing

We welcome contributions from the community!

In order to contribute to `wp-now`, you'll need to first install a few global dependencies:

-   Make sure you have `nvm` installed. If you need to install it first,
    [follow these installation instructions](https://github.com/nvm-sh/nvm#installation).
-   Install `nx` by running `npm install -g nx`.

Once the global dependencies are installed, you can start using the repo:

```bash
git clone git@github.com:WordPress/wordpress-playground.git
cd wordpress-playground
nvm use
npm install
npm run build
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

The `wp-now` package is part of a larger monorepo, sharing its space with other sibling packages. To publish the `wp-now` package to npm, you must first understand the automated release process facilitated by lerna. This process includes automatically incrementing the version number, creating a new tag, and publishing all modified packages to npm simultaneously. Notably, all published packages share the same version number.

Each package identifies a distinct organization in its `package.json` file. To publish the `wp-now` package, you need access to the npm organizations `@wp-playground`, `@php-wasm`, and `@wp-now`.

To initiate the publishing process for the all the modified packages, execute the following commands:

```bash
npm login # this is required only once and it will store the credentials in ~/.npmrc file.
npm run release
```

### When publishing goes wrong

Internet connections drop, APIs stop responding, and GitHub rules are nasty. Stuff happens. If the publishing process fails, you may need to bump the version again and force a publish. To do so, execute the following command:

```bash
npm run release --force-publish
```
