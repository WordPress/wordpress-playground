# Publishing Packages, Releases, and More

WordPress Playground has many types of artifacts that are published:

-   NPM packages
-   GitHub releases
-   VS Code extension
-   WordPress Plugins
-   playground.wordpress.net website

This document describes the publishing process for each of these artifacts.

## NPM packages

WordPress Playground is a monorepo and uses Lerna for publishing npm packages.

The publishing process is facilitated by Lerna, and includes automatically incrementing the version number, creating a new tag, and publishing all modified packages to npm simultaneously.

Notably, all published packages share the same version number. All packages use the same version number. If you update a single package, Lerna will automatically bump the version number for all dependent packages.

Each package identifies a distinct organization in its `package.json` file. To publish WordPress Playground packages, you need access to the following npm organizations:

-   `@wp-playground`
-   `@php-wasm`
-   `@wp-now`

To initiate the publishing process for the all the modified packages, execute the following commands:

```bash
npm login # this is required only once and it will store the credentials in ~/.npmrc file.
npm run release
```

### When publishing packages goes wrong

Internet connections drop, APIs stop responding, and GitHub rules are nasty. Stuff happens. If the publishing process fails, you may need to bump the version again and force a publish. To do so, execute the following command:

```bash
npm run release --force-publish
```

## GitHub documentation

To deploy this documentation to GitHub Pages, run the following command:

```bash
npm run deploy
```

You will need to have push access to the `gh-pages` branch of the repository.

## VS Code extension

See the [VS Code extension](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/vscode-extension/README.md#publishing) document.

## playground.wordpress.net website

TBD
