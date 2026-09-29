---
title: Paquetes PHP.wasm
slug: /developers/architecture/php-wasm-packages
description: Conoce cómo se relacionan la API compartida, los adaptadores de plataforma y los paquetes PHP.wasm específicos para cada versión.
---

<!-- title: PHP.wasm packages -->
<!-- description: Learn how the shared API, platform adapters, and version-specific PHP.wasm packages fit together. -->

<!-- # PHP.wasm packages -->

# Paquetes PHP.wasm

<!--
The PHP.wasm npm packages separate the shared JavaScript API, platform-specific
setup, and compiled PHP binaries. Most applications should use a platform
adapter. Applications that prioritize a smaller installation can instead load
one version-specific package through the lower-level API.
-->

Los paquetes npm de PHP.wasm separan la API compartida de JavaScript, la
configuración específica de cada plataforma y los binarios PHP compilados. La
mayoría de las aplicaciones deberían utilizar un adaptador de plataforma. En
cambio, las aplicaciones que prioricen una instalación más pequeña pueden cargar
un paquete específico para una versión mediante la API de bajo nivel.

<!-- ## Package layers -->

## Capas de paquetes

<!--
| Package | Responsibility |
| --- | --- |
| `@php-wasm/universal` | Provides the environment-independent `PHP` class, `loadPHPRuntime()`, and shared request and filesystem APIs. It does not select a Node.js or browser build. |
| `@php-wasm/node` | Provides `loadNodeRuntime(version)` and Node.js-specific runtime setup, including networking, file locking, and filesystem helpers. |
| `@php-wasm/web` | Provides `loadWebRuntime(version)` and browser-specific runtime, networking, storage, and worker helpers. |
| `@php-wasm/node-X-Y` and `@php-wasm/web-X-Y` | Contain the WebAssembly binaries and loaders for one PHP minor version, plus version-matched extension artifacts where available. |
-->

| Paquete                                    | Responsabilidad                                                                                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@php-wasm/universal`                      | Proporciona la clase `PHP` independiente del entorno, `loadPHPRuntime()` y las API compartidas de solicitudes y del sistema de archivos. No selecciona una compilación para Node.js ni para el navegador.  |
| `@php-wasm/node`                           | Proporciona `loadNodeRuntime(version)` y la configuración del entorno de ejecución específica de Node.js, incluidas las funciones de red, el bloqueo de archivos y las utilidades del sistema de archivos. |
| `@php-wasm/web`                            | Proporciona `loadWebRuntime(version)` y el entorno de ejecución, las funciones de red, el almacenamiento y las utilidades para workers específicos del navegador.                                          |
| `@php-wasm/node-X-Y` y `@php-wasm/web-X-Y` | Contienen los binarios WebAssembly y los cargadores para una versión secundaria de PHP, además de los artefactos de extensiones correspondientes a esa versión cuando están disponibles.                   |

<!--
An application creates the `PHP` object from `@php-wasm/universal`. The Node.js
or web adapter configures the environment, selects a PHP version, and imports
the corresponding version package. For example, `loadNodeRuntime('8.4')`
selects `@php-wasm/node-8-4`.
-->

Una aplicación crea el objeto `PHP` a partir de `@php-wasm/universal`. El
adaptador de Node.js o web configura el entorno, selecciona una versión de PHP e
importa el paquete correspondiente a esa versión. Por ejemplo,
`loadNodeRuntime('8.4')` selecciona `@php-wasm/node-8-4`.

<!--
The API uses dotted versions such as `8.4`, while npm package names use a
hyphenated suffix such as `8-4`.
-->

La API utiliza versiones con punto, como `8.4`, mientras que los nombres de los
paquetes npm utilizan un sufijo con guion, como `8-4`.

<!-- ## Convenient platform loaders -->

## Cargadores de plataforma prácticos

<!--
Use a platform adapter when you need its runtime integrations or may select
different PHP versions at runtime. For Node.js:
-->

Utiliza un adaptador de plataforma cuando necesites sus integraciones con el
entorno de ejecución o quieras seleccionar distintas versiones de PHP durante
la ejecución. Para Node.js:

<!--
```bash
npm install @php-wasm/universal @php-wasm/node
```
-->

```bash
npm install @php-wasm/universal @php-wasm/node
```

<!--
```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.4'));
```
-->

```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.4'));
```

<!-- In a browser, use `@php-wasm/web` and `loadWebRuntime('8.4')` instead. -->

En un navegador, utiliza `@php-wasm/web` y `loadWebRuntime('8.4')` en su lugar.

<!--
The platform adapters can dispatch to every supported PHP version, and their
published dependency graph includes the corresponding version packages. This
is convenient, but it is not the smallest installation when an application
only needs one PHP version.
-->

Los adaptadores de plataforma pueden seleccionar cualquiera de las versiones
compatibles de PHP, y su grafo de dependencias publicado incluye los paquetes
correspondientes a esas versiones. Esto resulta práctico, pero no produce la
instalación más pequeña cuando una aplicación solo necesita una versión de PHP.

<!-- ## Load one PHP version directly -->

## Cargar directamente una versión de PHP

<!--
For the smallest dependency footprint, omit the platform adapter and install
`@php-wasm/universal` with one version-specific package:
-->

Para obtener la menor huella de dependencias, omite el adaptador de plataforma
e instala `@php-wasm/universal` junto con un paquete específico para una versión:

<!--
```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```
-->

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!--
These packages are published together. Keep their npm release versions
aligned.
-->

Estos paquetes se publican juntos. Mantén alineadas sus versiones de publicación
en npm.

<!-- Then load its compiled module through the low-level API: -->

A continuación, carga su módulo compilado mediante la API de bajo nivel:

<!--
```js
import { PHP, loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from '@php-wasm/node-8-4';

const loaderModule = await getPHPLoaderModule();
const runtimeId = await loadPHPRuntime(loaderModule);
const php = new PHP(runtimeId);

const response = await php.runStream({
	code: '<?php echo "Hello from PHP " . PHP_VERSION;',
});
console.log(await response.stdoutText);
```
-->

```js
import { PHP, loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from '@php-wasm/node-8-4';

const loaderModule = await getPHPLoaderModule();
const runtimeId = await loadPHPRuntime(loaderModule);
const php = new PHP(runtimeId);

const response = await php.runStream({
	code: '<?php echo "Hello from PHP " . PHP_VERSION;',
});
console.log(await response.stdoutText);
```

<!--
For a browser build, use the corresponding package, such as
`@php-wasm/web-8-4`, with the same `getPHPLoaderModule()` and
`loadPHPRuntime()` flow. Configure the browser bundler to emit imported
`.wasm` and `.so` files as assets, as described in the
[`@php-wasm/web` bundler guidance](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adapt package references in that configuration to the version-specific name;
for example, exclude `@php-wasm/web-8-4` instead of `@php-wasm/web`.
-->

Para una compilación de navegador, utiliza el paquete correspondiente, como
`@php-wasm/web-8-4`, con el mismo flujo de `getPHPLoaderModule()` y
`loadPHPRuntime()`. Configura el empaquetador del navegador para emitir como
recursos los archivos `.wasm` y `.so` importados, tal como se describe en la
[guía de empaquetadores de `@php-wasm/web`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adapta las referencias a paquetes de esa configuración al nombre específico de
la versión; por ejemplo, excluye `@php-wasm/web-8-4` en lugar de
`@php-wasm/web`.

<!--
Here, a smaller footprint means installing one PHP minor version instead of
the full supported matrix. Each version package still includes the compiled
variants and version-matched artifacts required for that PHP version.
-->

En este caso, una huella más reducida significa instalar una sola versión
secundaria de PHP en lugar de toda la matriz compatible. Cada paquete de versión
sigue incluyendo las variantes compiladas y los artefactos correspondientes que
requiere esa versión de PHP.

<!--
This direct approach is intentionally lower-level. It bypasses the setup
performed by `loadNodeRuntime()` or `loadWebRuntime()`, including platform
networking, Node.js file locking, extension loading, and other
environment-specific integrations. Use it when the shared `PHP` API and
in-memory filesystem are sufficient, or when your application supplies the
required Emscripten configuration itself.
-->

Este enfoque directo es intencionadamente de más bajo nivel. Omite la
configuración que realizan `loadNodeRuntime()` o `loadWebRuntime()`, incluidas
las funciones de red de la plataforma, el bloqueo de archivos de Node.js, la
carga de extensiones y otras integraciones específicas del entorno. Utilízalo
cuando la API compartida de `PHP` y el sistema de archivos en memoria sean
suficientes, o cuando tu aplicación proporcione por sí misma la configuración
necesaria de Emscripten.

<!--
See the [supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
to choose the matching package suffix.
-->

Consulta las
[versiones compatibles de PHP](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
para elegir el sufijo de paquete correspondiente.

<!-- ## Which approach should you choose? -->

## ¿Qué enfoque debes elegir?

<!--
- Use `@php-wasm/node` or `@php-wasm/web` for platform-specific runtime setup,
  helpers, and the simplest version-selection API.
- Load `@php-wasm/node-X-Y` or `@php-wasm/web-X-Y` directly when installation
  size matters more than the platform adapter's conveniences.
-->

- Utiliza `@php-wasm/node` o `@php-wasm/web` para disponer de la configuración
  del entorno de ejecución y las utilidades específicas de la plataforma, además
  de la API más sencilla para seleccionar versiones.
- Carga `@php-wasm/node-X-Y` o `@php-wasm/web-X-Y` directamente cuando el tamaño
  de la instalación sea más importante que las ventajas del adaptador de
  plataforma.
