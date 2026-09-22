---
title: Arquitectura
slug: /developers/architecture
---

<!-- title: Architecture -->

<!-- # Architecture overview -->

# Descripción general de la arquitectura

<!-- WordPress Playground consists of the following high-level components: -->

WordPress Playground consta de los siguientes componentes de alto nivel:

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
- [Enlaces para el navegador](/developers/architecture/browser-concepts)
- [Paquetes PHP.wasm](/developers/architecture/php-wasm-packages) para la API
  compartida, los enlaces de plataforma y los binarios específicos para cada
  versión
- [API pública](/developers/apis/)

<!-- Visit each section to learn more about the specific parts of the architecture. -->

Visita cada sección para obtener más información sobre las distintas partes de
la arquitectura.

<!-- ## Tooling -->

## Herramientas

<!-- ### NX: building packages and projects -->

### NX: compilación de paquetes y proyectos

<!-- WordPress Playground uses [NX](https://nx.dev/), a build system designed for monorepos. -->

WordPress Playground utiliza [NX](https://nx.dev/), un sistema de compilación
diseñado para monorepositorios.

<!--
The dependencies between Playground packages and projects [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) for a bundler like Webpack, and NX handles this complexity much better:
![Dependency graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)
-->

Las dependencias entre los paquetes y proyectos de Playground
[son demasiado complejas](https://github.com/WordPress/wordpress-playground/pull/151)
para un empaquetador como Webpack, y NX gestiona mucho mejor esta complejidad:
![Gráfico de dependencias](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)

<!-- To learn more, head over to the [NX developer docs](https://nx.dev/getting-started/intro). -->

Para obtener más información, consulta la
[documentación de NX para desarrolladores](https://nx.dev/getting-started/intro).

<!-- ### Lerna: publishing packages and projects -->

### Lerna: publicación de paquetes y proyectos

<!-- WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos: the main [wordpress-playground](https://github.com/WordPress/wordpress-playground) and [Playground Tools](https://github.com/WordPress/playground-tools/). -->

WordPress Playground incluye varios paquetes NPM, una extensión de VS Code,
plugins de WordPress, una aplicación web y otras versiones publicadas en GitHub,
todo ello gestionado en dos monorepositorios: el principal,
[wordpress-playground](https://github.com/WordPress/wordpress-playground), y
[Playground Tools](https://github.com/WordPress/playground-tools/).

<!-- We use [Lerna](https://lerna.js.org) to build, manage, and publish all JavaScript/TypeScript packages. Lerna handles everything simultaneously: it increments the version number, sets a new tag, and publishes the modified packages to `npm`. -->

Utilizamos [Lerna](https://lerna.js.org) para compilar, gestionar y publicar
todos los paquetes de JavaScript/TypeScript. Lerna se ocupa de todo al mismo
tiempo: incrementa el número de versión, establece una etiqueta nueva y publica
en `npm` los paquetes modificados.

<!-- The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages. -->

Los paquetes publicados comparten el mismo número de versión, por lo que, al
actualizar un solo paquete, Lerna incrementa el número de versión de todos los
paquetes que dependen de él.
