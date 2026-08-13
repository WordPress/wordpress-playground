---
title: Architettura
slug: /developers/architecture
---

<!-- title: Architecture -->

<!-- # Architecture overview -->

# Panoramica dell'architettura

<!-- WordPress Playground consists of the following high-level components: -->

WordPress Playground è costituito dai seguenti componenti di alto livello:

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
- [Binding per il browser](/developers/architecture/browser-concepts)
- [Pacchetti PHP.wasm](/developers/architecture/php-wasm-packages) per l'API
  condivisa, i binding della piattaforma e i file binari specifici per ogni
  versione
- [API pubblica](/developers/apis/)

<!-- Visit each section to learn more about the specific parts of the architecture. -->

Visita ogni sezione per saperne di più sulle diverse parti dell'architettura.

<!-- ## Tooling -->

## Strumenti

<!-- ### NX: building packages and projects -->

### NX: compilazione di pacchetti e progetti

<!-- WordPress Playground uses [NX](https://nx.dev/), a build system designed for monorepos. -->

WordPress Playground usa [NX](https://nx.dev/), un sistema di build progettato
per monorepo.

<!--
The dependencies between Playground packages and projects [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) for a bundler like Webpack, and NX handles this complexity much better:
![Dependency graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)
-->

Le dipendenze tra i pacchetti e i progetti di Playground
[sono troppo complesse](https://github.com/WordPress/wordpress-playground/pull/151)
per un bundler come Webpack. NX gestisce questa complessità molto meglio:
![Grafico delle dipendenze](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)

<!-- To learn more, head over to the [NX developer docs](https://nx.dev/getting-started/intro). -->

Per saperne di più, consulta la
[documentazione di NX per gli sviluppatori](https://nx.dev/getting-started/intro).

<!-- ### Lerna: publishing packages and projects -->

### Lerna: pubblicazione di pacchetti e progetti

<!-- WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos: the main [wordpress-playground](https://github.com/WordPress/wordpress-playground) and [Playground Tools](https://github.com/WordPress/playground-tools/). -->

WordPress Playground include diversi pacchetti NPM, un'estensione per VS Code,
plugin per WordPress, un'app web e altre release su GitHub, tutto gestito in
due monorepo: quello principale
[wordpress-playground](https://github.com/WordPress/wordpress-playground) e
[Playground Tools](https://github.com/WordPress/playground-tools/).

<!-- We use [Lerna](https://lerna.js.org) to build, manage, and publish all JavaScript/TypeScript packages. Lerna handles everything simultaneously: it increments the version number, sets a new tag, and publishes the modified packages to `npm`. -->

Usiamo [Lerna](https://lerna.js.org) per compilare, gestire e pubblicare tutti
i pacchetti JavaScript/TypeScript. Lerna si occupa di tutto
simultaneamente: incrementa il numero di versione, imposta un nuovo tag e
pubblica su `npm` i pacchetti modificati.

<!-- The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages. -->

I pacchetti pubblicati condividono lo stesso numero di versione, quindi quando
viene aggiornato un singolo pacchetto, Lerna incrementa il numero di versione
di tutti i pacchetti che ne dipendono.
