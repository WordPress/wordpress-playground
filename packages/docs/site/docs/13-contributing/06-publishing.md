# Publishing Packages, Releases, and More

WordPress Playground has many types of artifacts that are published.

NPM packages, GitHub releases, and playground.wordpress.net website are published by project maintainers through GitHub Actions.

Below you'll find more details about parts of that process.

## NPM packages

WordPress Playground is a monorepo and uses Lerna for publishing npm packages.

The publishing process is facilitated by Lerna, and includes automatically incrementing the version number, creating a new tag, and publishing all modified packages to npm simultaneously.

Notably, all published packages share the same version number. All packages use the same version number. If you update a single package, Lerna will automatically bump the version number for all dependent packages.

Each package identifies a distinct organization in its `package.json` file. To publish WordPress Playground packages, you need access to the following npm organizations:

-   `@wp-playground`
-   `@php-wasm`

To initiate the publishing process for the all the modified packages, execute the following commands:

```bash
npm login # this is required only once and it will store the credentials in ~/.npmrc file.
npm run release
```

### After publishing

To verify the publishing process went correctly:

1. Please verify https://translate.wordpress.org/projects/wp-plugins/contact-form-7/dev/de/default/playground/ loads as expected. If it doesn't load, something broke.

### When publishing packages goes wrong

Internet connections drop, APIs stop responding, and GitHub rules are nasty. Stuff happens. If the publishing process fails, you may need to bump the version again and force a publish. To do so, execute the following command:

```bash
npm run release -- --force-publish
```
