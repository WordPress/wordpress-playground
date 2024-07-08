# Architecture overview

WordPress Playground consists of the following high-level components:

-   [WordPress](./15-wordpress.md)
-   [WebAssembly PHP](./02-wasm-php-overview.md)
-   [Browser bindings](./08-browser-concepts.md)
-   Node.js bindings via [@php-wasm/node](https://npmjs.com/package/@php-wasm/node)
-   [Public API](../06-playground-apis/01-index.md)

Visit each section to learn more about the specific parts of the architecture.

## Tooling

### NX: building packages and projects

WordPress Playground uses [NX](https://nx.dev/), a build system designed for monorepos.

The dependencies between Playground packages and projects [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) for a bundler like Webpack, and NX handles this complexity much better:
![Dependency graph](@site/static/img/dependencies.png)

To learn more, head over to the [NX developer docs](https://nx.dev/getting-started/intro).

### Publishing packages and projects

WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos: the main [wordpress-playground](https://github.com/WordPress/wordpress-playground) and [Playground Tools](https://github.com/WordPress/playground-tools/).

We use a few tools for publishing these packages:

-   [Lerna](https://lerna.js.org) to increment packages version numbers and set git tags.
-   npm to publish the packages to NPM.

The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages. We do not use Lerna for publishing because every now and then it starts crashing with cryptic error messages and does not provide much information on what went wrong.

Here are the commands you'll need to publish the packages:

```bash
## Increment the version number of the packages
npx lerna version <major|minor|patch> --no-private --force-publish --yes

## Build all the packages
npm run build

## Publish the built packages to NPM
npm run publish-to-npm
```

Or you can do it all in one go:

```bash
npm run release:patch # or minor or major
```
