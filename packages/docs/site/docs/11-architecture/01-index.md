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

### Lerna: publishing packages and projects

WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos.

We use [Lerna](https://lerna.js.org) to build, manage, and publish all JavaScript/TypeScript packages. Lerna handles everything simultaneously: it increments the version number, sets a new tag, and publishes the modified packages to `npm`.

The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages.
