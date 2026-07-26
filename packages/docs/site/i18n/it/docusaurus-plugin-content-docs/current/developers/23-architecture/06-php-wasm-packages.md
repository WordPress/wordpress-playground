---
title: Pacchetti PHP.wasm
slug: /developers/architecture/php-wasm-packages
description: Scopri come si integrano l'API condivisa, gli adattatori della piattaforma e i pacchetti PHP.wasm specifici per ogni versione.
---

<!-- title: PHP.wasm packages -->
<!-- description: Learn how the shared API, platform adapters, and version-specific PHP.wasm packages fit together. -->

<!-- # PHP.wasm packages -->

# Pacchetti PHP.wasm

<!--
The PHP.wasm npm packages separate the shared JavaScript API, platform-specific
setup, and compiled PHP binaries. Most applications should use a platform
adapter. Applications that prioritize a smaller installation can instead load
one version-specific package through the lower-level API.
-->

I pacchetti npm di PHP.wasm separano l'API JavaScript condivisa, la
configurazione specifica per ogni piattaforma e i binari PHP compilati. La
maggior parte delle applicazioni dovrebbe usare un adattatore della piattaforma.
Le applicazioni che privilegiano un'installazione più piccola possono invece
caricare un pacchetto specifico per una versione tramite l'API di livello
inferiore.

<!-- ## Package layers -->

## Livelli dei pacchetti

<!--
| Package | Responsibility |
| --- | --- |
| `@php-wasm/universal` | Provides the environment-independent `PHP` class, `loadPHPRuntime()`, and shared request and filesystem APIs. It does not select a Node.js or browser build. |
| `@php-wasm/node` | Provides `loadNodeRuntime(version)` and Node.js-specific runtime setup, including networking, file locking, and filesystem helpers. |
| `@php-wasm/web` | Provides `loadWebRuntime(version)` and browser-specific runtime, networking, storage, and worker helpers. |
| `@php-wasm/node-X-Y` and `@php-wasm/web-X-Y` | Contain the WebAssembly binaries and loaders for one PHP minor version, plus version-matched extension artifacts where available. |
-->

| Pacchetto                                  | Responsabilità                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@php-wasm/universal`                      | Fornisce la classe `PHP` indipendente dall'ambiente, `loadPHPRuntime()` e le API condivise per le richieste e il filesystem. Non seleziona una build per Node.js o per il browser. |
| `@php-wasm/node`                           | Fornisce `loadNodeRuntime(version)` e la configurazione del runtime specifica per Node.js, incluse le funzionalità di rete, il blocco dei file e le utilità per il filesystem.     |
| `@php-wasm/web`                            | Fornisce `loadWebRuntime(version)` e il runtime, la rete, l'archiviazione e le utilità per i worker specifici del browser.                                                         |
| `@php-wasm/node-X-Y` e `@php-wasm/web-X-Y` | Contengono i binari WebAssembly e i caricatori per una versione minore di PHP, oltre agli artefatti delle estensioni corrispondenti a quella versione, quando disponibili.         |

<!--
An application creates the `PHP` object from `@php-wasm/universal`. The Node.js
or web adapter configures the environment, selects a PHP version, and imports
the corresponding version package. For example, `loadNodeRuntime('8.4')`
selects `@php-wasm/node-8-4`.
-->

Un'applicazione crea l'oggetto `PHP` a partire da `@php-wasm/universal`.
L'adattatore per Node.js o per il web configura l'ambiente, seleziona una
versione di PHP e importa il pacchetto corrispondente a quella versione. Per
esempio, `loadNodeRuntime('8.4')` seleziona `@php-wasm/node-8-4`.

<!--
The API uses dotted versions such as `8.4`, while npm package names use a
hyphenated suffix such as `8-4`.
-->

L'API usa versioni con il punto, come `8.4`, mentre i nomi dei pacchetti npm
usano un suffisso con il trattino, come `8-4`.

<!-- ## Convenient platform loaders -->

## Caricatori della piattaforma pratici

<!--
Use a platform adapter when you need its runtime integrations or may select
different PHP versions at runtime. For Node.js:
-->

Usa un adattatore della piattaforma quando hai bisogno delle sue integrazioni con
il runtime o quando potresti selezionare versioni diverse di PHP in fase di
esecuzione. Per Node.js:

```bash
npm install @php-wasm/universal @php-wasm/node
```

```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.4'));
```

<!-- In a browser, use `@php-wasm/web` and `loadWebRuntime('8.4')` instead. -->

In un browser, usa invece `@php-wasm/web` e `loadWebRuntime('8.4')`.

<!--
The platform adapters can dispatch to every supported PHP version, and their
published dependency graph includes the corresponding version packages. This
is convenient, but it is not the smallest installation when an application
only needs one PHP version.
-->

Gli adattatori della piattaforma possono selezionare qualsiasi versione di PHP
supportata e il loro grafo delle dipendenze pubblicato include i pacchetti
delle versioni corrispondenti. È pratico, ma non è l'installazione più piccola
quando un'applicazione ha bisogno di una sola versione di PHP.

<!-- ## Load one PHP version directly -->

## Caricare direttamente una versione di PHP

<!--
For the smallest dependency footprint, omit the platform adapter and install
`@php-wasm/universal` with one version-specific package:
-->

Per ridurre al minimo le dipendenze, ometti l'adattatore della piattaforma e
installa `@php-wasm/universal` insieme a un solo pacchetto specifico per una
versione:

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!--
These packages are published together. Keep their npm release versions
aligned.
-->

Questi pacchetti vengono pubblicati insieme. Mantieni allineate le loro
versioni di rilascio su npm.

<!-- Then load its compiled module through the low-level API: -->

Poi carica il suo modulo compilato tramite l'API di basso livello:

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

Per una build per browser, usa il pacchetto corrispondente, come
`@php-wasm/web-8-4`, con lo stesso flusso di `getPHPLoaderModule()` e
`loadPHPRuntime()`. Configura il bundler del browser in modo che emetta come
risorse i file `.wasm` e `.so` importati, come descritto nella
[guida ai bundler di `@php-wasm/web`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adatta i riferimenti ai pacchetti di quella configurazione al nome specifico
della versione; per esempio, escludi `@php-wasm/web-8-4` invece di
`@php-wasm/web`.

<!--
Here, a smaller footprint means installing one PHP minor version instead of
the full supported matrix. Each version package still includes the compiled
variants and version-matched artifacts required for that PHP version.
-->

In questo caso ridurre le dipendenze significa installare una sola versione
minore di PHP invece dell'intera matrice supportata. Ogni pacchetto di versione
include comunque le varianti compilate e gli artefatti corrispondenti richiesti
da quella versione di PHP.

<!--
This direct approach is intentionally lower-level. It bypasses the setup
performed by `loadNodeRuntime()` or `loadWebRuntime()`, including platform
networking, Node.js file locking, extension loading, and other
environment-specific integrations. Use it when the shared `PHP` API and
in-memory filesystem are sufficient, or when your application supplies the
required Emscripten configuration itself.
-->

Questo approccio diretto è volutamente di più basso livello. Salta la
configurazione eseguita da `loadNodeRuntime()` o `loadWebRuntime()`, incluse le
funzionalità di rete della piattaforma, il file locking di Node.js, il
caricamento delle estensioni e le altre integrazioni specifiche dell'ambiente.
Usalo quando l'API condivisa `PHP` e il filesystem in memoria sono sufficienti,
oppure quando la tua applicazione fornisce da sé la configurazione Emscripten
richiesta.

<!--
See the [supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
to choose the matching package suffix.
-->

Consulta le
[versioni di PHP supportate](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
per poter scegliere il giusto suffisso per il pacchetto.

<!-- ## Which approach should you choose? -->

## Quale approccio scegliere?

<!--
- Use `@php-wasm/node` or `@php-wasm/web` for platform-specific runtime setup,
  helpers, and the simplest version-selection API.
- Load `@php-wasm/node-X-Y` or `@php-wasm/web-X-Y` directly when installation
  size matters more than the platform adapter's conveniences.
-->

- Usa `@php-wasm/node` o `@php-wasm/web` per la configurazione del runtime e le
  utilità specifiche della piattaforma, oltre all'API più semplice per la
  selezione delle versioni.
- Carica direttamente `@php-wasm/node-X-Y` o `@php-wasm/web-X-Y` quando le
  dimensioni dell'installazione sono più importanti della comodità offerta
  dall'adattatore della piattaforma.
