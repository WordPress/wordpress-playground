---
title: Architecture
slug: /developers/architecture
---

<!-- # Architecture overview -->

# Visão geral da arquitetura

<!-- WordPress Playground consists of the following high-level components: -->

O WordPress Playground consiste nos seguintes componentes de alto nível:

<!-- -   [WordPress](/developers/architecture/wordpress)
-   [WebAssembly PHP](/developers/architecture/wasm-php-overview)
-   [Browser bindings](/developers/architecture/browser-concepts)
-   Node.js bindings via [@php-wasm/node](https://npmjs.com/package/@php-wasm/node)
-   [Public API](/developers/apis/) -->

-   [WordPress](/developers/architecture/wordpress)
-   [WebAssembly PHP](/developers/architecture/wasm-php-overview)
-   [Vinculações do navegador](/developers/architecture/browser-concepts)
-   Vinculações Node.js via [@php-wasm/node](https://npmjs.com/package/@php-wasm/node)
-   [API Pública](/developers/apis/)

<!-- Visit each section to learn more about the specific parts of the architecture. -->

Visite cada seção para saber mais sobre as partes específicas da arquitetura.

<!-- ## Tooling -->

## Ferramentas

<!-- ### NX: building packages and projects -->

### NX: construindo pacotes e projetos

<!-- WordPress Playground uses [NX](https://nx.dev/), a build system designed for monorepos. -->

O WordPress Playground usa [NX](https://nx.dev/), um sistema de build projetado para monorepos.

<!-- The dependencies between Playground packages and projects [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) for a bundler like Webpack, and NX handles this complexity much better: -->

As dependências entre pacotes e projetos do Playground [são muito complexas](https://github.com/WordPress/wordpress-playground/pull/151) para um bundler como Webpack, e o NX lida com essa complexidade muito melhor:
![Dependency graph](@site/static/img/dependencies.png)

<!-- To learn more, head over to the [NX developer docs](https://nx.dev/getting-started/intro). -->

Para saber mais, acesse a [documentação para desenvolvedores do NX](https://nx.dev/getting-started/intro).

<!-- ### Lerna: publishing packages and projects -->

### Lerna: publicando pacotes e projetos

<!-- WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos: the main [wordpress-playground](https://github.com/WordPress/wordpress-playground) and [Playground Tools](https://github.com/WordPress/playground-tools/). -->

O WordPress Playground inclui vários pacotes NPM, uma extensão do VS Code, plugins do WordPress, uma aplicação web, e outros lançamentos do GitHub, todos gerenciados em dois monorepos: o principal [wordpress-playground](https://github.com/WordPress/wordpress-playground) e [Playground Tools](https://github.com/WordPress/playground-tools/).

<!-- We use [Lerna](https://lerna.js.org) to build, manage, and publish all JavaScript/TypeScript packages. Lerna handles everything simultaneously: it increments the version number, sets a new tag, and publishes the modified packages to `npm`. -->

Usamos [Lerna](https://lerna.js.org) para construir, gerenciar e publicar todos os pacotes JavaScript/TypeScript. O Lerna lida com tudo simultaneamente: incrementa o número da versão, define uma nova tag e publica os pacotes modificados no `npm`.

<!-- The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages. -->

Os pacotes publicados compartilham o mesmo número de versão, então ao atualizar um único pacote, o Lerna incrementa o número da versão de todos os pacotes dependentes.
