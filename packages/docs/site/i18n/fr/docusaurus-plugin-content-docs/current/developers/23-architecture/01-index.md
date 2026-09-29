---
title: Architecture
slug: /developers/architecture
---

<!-- title: Architecture -->

<!-- # Architecture overview -->

# Vue d'ensemble de l'architecture

<!-- WordPress Playground consists of the following high-level components: -->

WordPress Playground se compose des composants de haut niveau suivants :

<!--
- [WordPress](/developers/architecture/wordpress)
- [WebAssembly PHP](/developers/architecture/wasm-php-overview)
- [Browser bindings](/developers/architecture/browser-concepts)
- [PHP.wasm packages](/developers/architecture/php-wasm-packages) for the shared
  API, platform bindings, and version-specific binaries
- [Public API](/developers/apis/)
-->

- [WordPress](/developers/architecture/wordpress)
- [PHP WebAssembly](/developers/architecture/wasm-php-overview)
- [Liaisons pour le navigateur](/developers/architecture/browser-concepts)
- [Paquets PHP.wasm](/developers/architecture/php-wasm-packages) pour l'API
  partagée, les liaisons de plateforme et les binaires spécifiques à chaque
  version
- [API publique](/developers/apis/)

<!-- Visit each section to learn more about the specific parts of the architecture. -->

Visitez chaque section pour en savoir plus sur les différentes parties de
l'architecture.

<!-- ## Tooling -->

## Outillage

<!-- ### NX: building packages and projects -->

### NX : compilation des paquets et des projets

<!-- WordPress Playground uses [NX](https://nx.dev/), a build system designed for monorepos. -->

WordPress Playground utilise [NX](https://nx.dev/), un système de build conçu
pour les monorepos.

<!--
The dependencies between Playground packages and projects [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) for a bundler like Webpack, and NX handles this complexity much better:
![Dependency graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)
-->

Les dépendances entre les paquets et les projets de Playground
[sont trop complexes](https://github.com/WordPress/wordpress-playground/pull/151)
pour un bundler comme Webpack, et NX gère bien mieux cette complexité :
![Graphe de dépendances](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)

<!-- To learn more, head over to the [NX developer docs](https://nx.dev/getting-started/intro). -->

Pour en savoir plus, consultez la
[documentation NX pour les développeurs](https://nx.dev/getting-started/intro).

<!-- ### Lerna: publishing packages and projects -->

### Lerna : publication des paquets et des projets

<!-- WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos: the main [wordpress-playground](https://github.com/WordPress/wordpress-playground) and [Playground Tools](https://github.com/WordPress/playground-tools/). -->

WordPress Playground comprend plusieurs paquets NPM, une extension VS Code, des
plugins WordPress, une application web et d'autres versions publiées sur
GitHub, le tout géré dans deux monorepos : le principal,
[wordpress-playground](https://github.com/WordPress/wordpress-playground), et
[Playground Tools](https://github.com/WordPress/playground-tools/).

<!-- We use [Lerna](https://lerna.js.org) to build, manage, and publish all JavaScript/TypeScript packages. Lerna handles everything simultaneously: it increments the version number, sets a new tag, and publishes the modified packages to `npm`. -->

Nous utilisons [Lerna](https://lerna.js.org) pour compiler, gérer et publier
tous les paquets JavaScript/TypeScript. Lerna s'occupe de tout en même temps :
il incrémente le numéro de version, crée une nouvelle étiquette et publie les
paquets modifiés sur `npm`.

<!-- The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages. -->

Les paquets publiés partagent le même numéro de version : lors de la mise à
jour d'un seul paquet, Lerna incrémente donc le numéro de version de tous les
paquets qui en dépendent.
