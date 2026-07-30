---
title: Paquets PHP.wasm
slug: /developers/architecture/php-wasm-packages
description: Découvrez comment s'articulent l'API partagée, les adaptateurs de plateforme et les paquets PHP.wasm spécifiques à chaque version.
---

<!-- title: PHP.wasm packages -->
<!-- description: Learn how the shared API, platform adapters, and version-specific PHP.wasm packages fit together. -->

<!-- # PHP.wasm packages -->

# Paquets PHP.wasm

<!--
The PHP.wasm npm packages separate the shared JavaScript API, platform-specific
setup, and compiled PHP binaries. Most applications should use a platform
adapter. Applications that prioritize a smaller installation can instead load
one version-specific package through the lower-level API.
-->

Les paquets npm PHP.wasm séparent l'API JavaScript partagée, la configuration
spécifique à chaque plateforme et les binaires PHP compilés. La plupart des
applications devraient utiliser un adaptateur de plateforme. Les applications
qui privilégient une installation plus légère peuvent, à la place, charger un
paquet spécifique à une version via l'API de bas niveau.

<!-- ## Package layers -->

## Couches de paquets

<!--
| Package | Responsibility |
| --- | --- |
| `@php-wasm/universal` | Provides the environment-independent `PHP` class, `loadPHPRuntime()`, and shared request and filesystem APIs. It does not select a Node.js or browser build. |
| `@php-wasm/node` | Provides `loadNodeRuntime(version)` and Node.js-specific runtime setup, including networking, file locking, and filesystem helpers. |
| `@php-wasm/web` | Provides `loadWebRuntime(version)` and browser-specific runtime, networking, storage, and worker helpers. |
| `@php-wasm/node-X-Y` and `@php-wasm/web-X-Y` | Contain the WebAssembly binaries and loaders for one PHP minor version, plus version-matched extension artifacts where available. |
-->

| Paquet                                      | Responsabilité                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@php-wasm/universal`                       | Fournit la classe `PHP` indépendante de l'environnement, `loadPHPRuntime()` et les API partagées de requêtes et de système de fichiers. Il ne sélectionne pas de build Node.js ou navigateur.           |
| `@php-wasm/node`                            | Fournit `loadNodeRuntime(version)` et la configuration de l'environnement d'exécution spécifique à Node.js, y compris le réseau, le verrouillage de fichiers et les utilitaires de système de fichiers. |
| `@php-wasm/web`                             | Fournit `loadWebRuntime(version)` ainsi que l'environnement d'exécution, le réseau, le stockage et les utilitaires de workers spécifiques au navigateur.                                                |
| `@php-wasm/node-X-Y` et `@php-wasm/web-X-Y` | Contiennent les binaires WebAssembly et les chargeurs pour une version mineure de PHP, ainsi que les artefacts d'extensions correspondant à cette version lorsqu'ils sont disponibles.                  |

<!--
An application creates the `PHP` object from `@php-wasm/universal`. The Node.js
or web adapter configures the environment, selects a PHP version, and imports
the corresponding version package. For example, `loadNodeRuntime('8.4')`
selects `@php-wasm/node-8-4`.
-->

Une application crée l'objet `PHP` à partir de `@php-wasm/universal`.
L'adaptateur Node.js ou web configure l'environnement, sélectionne une version
de PHP et importe le paquet correspondant à cette version. Par exemple,
`loadNodeRuntime('8.4')` sélectionne `@php-wasm/node-8-4`.

<!--
The API uses dotted versions such as `8.4`, while npm package names use a
hyphenated suffix such as `8-4`.
-->

L'API utilise des versions avec un point, comme `8.4`, tandis que les noms des
paquets npm utilisent un suffixe avec un tiret, comme `8-4`.

<!-- ## Convenient platform loaders -->

## Chargeurs de plateforme pratiques

<!--
Use a platform adapter when you need its runtime integrations or may select
different PHP versions at runtime. For Node.js:
-->

Utilisez un adaptateur de plateforme lorsque vous avez besoin de ses
intégrations avec l'environnement d'exécution ou que vous pouvez sélectionner
différentes versions de PHP à l'exécution. Pour Node.js :

```bash
npm install @php-wasm/universal @php-wasm/node
```

```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.4'));
```

<!-- In a browser, use `@php-wasm/web` and `loadWebRuntime('8.4')` instead. -->

Dans un navigateur, utilisez plutôt `@php-wasm/web` et `loadWebRuntime('8.4')`.

<!--
The platform adapters can dispatch to every supported PHP version, and their
published dependency graph includes the corresponding version packages. This
is convenient, but it is not the smallest installation when an application
only needs one PHP version.
-->

Les adaptateurs de plateforme peuvent sélectionner n'importe quelle version de
PHP prise en charge, et leur graphe de dépendances publié inclut les paquets de
versions correspondants. C'est pratique, mais ce n'est pas l'installation la
plus légère lorsqu'une application n'a besoin que d'une seule version de PHP.

<!-- ## Load one PHP version directly -->

## Charger directement une version de PHP

<!--
For the smallest dependency footprint, omit the platform adapter and install
`@php-wasm/universal` with one version-specific package:
-->

Pour obtenir l'empreinte de dépendances la plus réduite, omettez l'adaptateur
de plateforme et installez `@php-wasm/universal` avec un seul paquet spécifique
à une version :

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!--
These packages are published together. Keep their npm release versions
aligned.
-->

Ces paquets sont publiés ensemble. Maintenez leurs versions de publication npm
alignées.

<!-- Then load its compiled module through the low-level API: -->

Chargez ensuite son module compilé via l'API de bas niveau :

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

Pour une build navigateur, utilisez le paquet correspondant, comme
`@php-wasm/web-8-4`, avec le même flux `getPHPLoaderModule()` et
`loadPHPRuntime()`. Configurez le bundler du navigateur pour émettre en tant
que ressources les fichiers `.wasm` et `.so` importés, comme décrit dans le
[guide des bundlers de `@php-wasm/web`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adaptez les références de paquets de cette configuration au nom spécifique à la
version ; par exemple, excluez `@php-wasm/web-8-4` au lieu de `@php-wasm/web`.

<!--
Here, a smaller footprint means installing one PHP minor version instead of
the full supported matrix. Each version package still includes the compiled
variants and version-matched artifacts required for that PHP version.
-->

Ici, une empreinte plus réduite signifie installer une seule version mineure de
PHP au lieu de toute la matrice prise en charge. Chaque paquet de version
inclut toujours les variantes compilées et les artefacts correspondants requis
pour cette version de PHP.

<!--
This direct approach is intentionally lower-level. It bypasses the setup
performed by `loadNodeRuntime()` or `loadWebRuntime()`, including platform
networking, Node.js file locking, extension loading, and other
environment-specific integrations. Use it when the shared `PHP` API and
in-memory filesystem are sufficient, or when your application supplies the
required Emscripten configuration itself.
-->

Cette approche directe est volontairement de plus bas niveau. Elle contourne la
configuration effectuée par `loadNodeRuntime()` ou `loadWebRuntime()`, y
compris le réseau de la plateforme, le verrouillage de fichiers de Node.js, le
chargement des extensions et les autres intégrations spécifiques à
l'environnement. Utilisez-la lorsque l'API partagée `PHP` et le système de
fichiers en mémoire suffisent, ou lorsque votre application fournit elle-même
la configuration Emscripten requise.

<!--
See the [supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
to choose the matching package suffix.
-->

Consultez les
[versions de PHP prises en charge](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
pour choisir le suffixe de paquet correspondant.

<!-- ## Which approach should you choose? -->

## Quelle approche choisir ?

<!--
- Use `@php-wasm/node` or `@php-wasm/web` for platform-specific runtime setup,
  helpers, and the simplest version-selection API.
- Load `@php-wasm/node-X-Y` or `@php-wasm/web-X-Y` directly when installation
  size matters more than the platform adapter's conveniences.
-->

- Utilisez `@php-wasm/node` ou `@php-wasm/web` pour bénéficier de la
  configuration de l'environnement d'exécution et des utilitaires spécifiques à
  la plateforme, ainsi que de l'API la plus simple pour sélectionner les
  versions.
- Chargez `@php-wasm/node-X-Y` ou `@php-wasm/web-X-Y` directement lorsque la
  taille de l'installation compte davantage que les avantages de l'adaptateur
  de plateforme.
