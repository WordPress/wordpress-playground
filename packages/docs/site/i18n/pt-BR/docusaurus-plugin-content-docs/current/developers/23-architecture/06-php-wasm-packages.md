---
title: Pacotes PHP.wasm
slug: /developers/architecture/php-wasm-packages
description: Saiba como a API compartilhada, os adaptadores de plataforma e os pacotes PHP.wasm específicos por versão se relacionam.
---

<!-- title: PHP.wasm packages -->

<!-- description: Learn how the shared API, platform adapters, and version-specific PHP.wasm packages fit together. -->

<!-- # PHP.wasm packages -->

# Pacotes PHP.wasm

<!-- The PHP.wasm npm packages separate the shared JavaScript API, platform-specific
setup, and compiled PHP binaries. Most applications should use a platform
adapter. Applications that prioritize a smaller installation can instead load
one version-specific package through the lower-level API. -->

Os pacotes PHP.wasm no npm separam a API JavaScript compartilhada, a
configuração específica da plataforma e os binários compilados do PHP. A
maioria dos aplicativos deve usar um adaptador de plataforma. Já os aplicativos
que priorizam uma instalação menor podem carregar um pacote específico por
versão pela API de baixo nível.

<!-- ## Package layers -->

## Camadas de pacotes

<!--
| Package | Responsibility |
| --- | --- |
| `@php-wasm/universal` | Provides the environment-independent `PHP` class, `loadPHPRuntime()`, and shared request and filesystem APIs. It does not select a Node.js or browser build. |
| `@php-wasm/node` | Provides `loadNodeRuntime(version)` and Node.js-specific runtime setup, including networking, file locking, and filesystem helpers. |
| `@php-wasm/web` | Provides `loadWebRuntime(version)` and browser-specific runtime, networking, storage, and worker helpers. |
| `@php-wasm/node-X-Y` and `@php-wasm/web-X-Y` | Contain the WebAssembly binaries and loaders for one PHP minor version, plus version-matched extension artifacts where available. |
-->

| Pacote                                     | Responsabilidade                                                                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@php-wasm/universal`                      | Fornece a classe `PHP` independente de ambiente, `loadPHPRuntime()` e as APIs compartilhadas de requisições e sistema de arquivos. Ele não seleciona uma build para Node.js ou navegador. |
| `@php-wasm/node`                           | Fornece `loadNodeRuntime(version)` e a configuração de runtime específica do Node.js, incluindo rede, bloqueio de arquivos e auxiliares do sistema de arquivos.                           |
| `@php-wasm/web`                            | Fornece `loadWebRuntime(version)` e auxiliares de runtime, rede, armazenamento e workers específicos do navegador.                                                                        |
| `@php-wasm/node-X-Y` e `@php-wasm/web-X-Y` | Contêm os binários e carregadores WebAssembly para uma versão secundária do PHP, além de artefatos de extensões compatíveis com a versão, quando disponíveis.                             |

<!-- An application creates the `PHP` object from `@php-wasm/universal`. The Node.js
or web adapter configures the environment, selects a PHP version, and imports
the corresponding version package. For example, `loadNodeRuntime('8.4')`
selects `@php-wasm/node-8-4`. -->

Um aplicativo cria o objeto `PHP` de `@php-wasm/universal`. O adaptador Node.js
ou web configura o ambiente, seleciona uma versão do PHP e importa o pacote da
versão correspondente. Por exemplo, `loadNodeRuntime('8.4')` seleciona
`@php-wasm/node-8-4`.

<!-- The API uses dotted versions such as `8.4`, while npm package names use a
hyphenated suffix such as `8-4`. -->

A API usa versões com ponto, como `8.4`, enquanto os nomes de pacotes no npm
usam um sufixo com hífen, como `8-4`.

<!-- ## Convenient platform loaders -->

## Carregadores de plataforma convenientes

<!-- Use a platform adapter when you need its runtime integrations or may select
different PHP versions at runtime. For Node.js: -->

Use um adaptador de plataforma quando precisar das integrações de runtime ou
quando quiser selecionar versões diferentes do PHP durante a execução. Para
Node.js:

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

Em um navegador, use `@php-wasm/web` e `loadWebRuntime('8.4')`.

<!-- The platform adapters can dispatch to every supported PHP version, and their
published dependency graph includes the corresponding version packages. This
is convenient, but it is not the smallest installation when an application
only needs one PHP version. -->

Os adaptadores de plataforma podem encaminhar para todas as versões compatíveis
do PHP, e o grafo de dependências publicado inclui os pacotes das versões
correspondentes. Isso é conveniente, mas não resulta na menor instalação quando
um aplicativo precisa de apenas uma versão do PHP.

<!-- ## Load one PHP version directly -->

## Carregue uma versão do PHP diretamente

<!-- For the smallest dependency footprint, omit the platform adapter and install
`@php-wasm/universal` with one version-specific package: -->

Para obter o menor conjunto de dependências, omita o adaptador de plataforma e
instale `@php-wasm/universal` com um pacote específico por versão:

<!--
```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```
-->

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!-- These packages are published together. Keep their npm release versions
aligned. -->

Esses pacotes são publicados juntos. Mantenha alinhadas as versões de
lançamento no npm.

<!-- Then load its compiled module through the low-level API: -->

Depois, carregue o módulo compilado pela API de baixo nível:

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

<!-- For a browser build, use the corresponding package, such as
`@php-wasm/web-8-4`, with the same `getPHPLoaderModule()` and
`loadPHPRuntime()` flow. Configure the browser bundler to emit imported
`.wasm` and `.so` files as assets, as described in the
[`@php-wasm/web` bundler guidance](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adapt package references in that configuration to the version-specific name;
for example, exclude `@php-wasm/web-8-4` instead of `@php-wasm/web`. -->

Para uma build de navegador, use o pacote correspondente, como
`@php-wasm/web-8-4`, com o mesmo fluxo de `getPHPLoaderModule()` e
`loadPHPRuntime()`. Configure o bundler do navegador para emitir os arquivos
`.wasm` e `.so` importados como recursos, conforme descrito nas
[orientações de bundler do `@php-wasm/web`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adapte as referências de pacote nessa configuração para o nome específico da
versão. Por exemplo, exclua `@php-wasm/web-8-4` em vez de `@php-wasm/web`.

<!-- Here, a smaller footprint means installing one PHP minor version instead of
the full supported matrix. Each version package still includes the compiled
variants and version-matched artifacts required for that PHP version. -->

Aqui, um conjunto menor significa instalar uma versão secundária do PHP em vez
da matriz completa de versões compatíveis. Cada pacote de versão ainda inclui
as variantes compiladas e os artefatos compatíveis necessários para essa versão
do PHP.

<!-- This direct approach is intentionally lower-level. It bypasses the setup
performed by `loadNodeRuntime()` or `loadWebRuntime()`, including platform
networking, Node.js file locking, extension loading, and other
environment-specific integrations. Use it when the shared `PHP` API and
in-memory filesystem are sufficient, or when your application supplies the
required Emscripten configuration itself. -->

Essa abordagem direta é intencionalmente de baixo nível. Ela ignora a
configuração feita por `loadNodeRuntime()` ou `loadWebRuntime()`, incluindo a
rede da plataforma, o bloqueio de arquivos do Node.js, o carregamento de
extensões e outras integrações específicas do ambiente. Use-a quando a API
compartilhada `PHP` e o sistema de arquivos em memória forem suficientes ou
quando seu aplicativo fornecer a configuração necessária do Emscripten.

<!-- See the [supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
to choose the matching package suffix. -->

Veja as [versões compatíveis do PHP](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
para escolher o sufixo de pacote correspondente.

<!-- ## Which approach should you choose? -->

## Qual abordagem escolher?

<!-- - Use `@php-wasm/node` or `@php-wasm/web` for platform-specific runtime setup,
  helpers, and the simplest version-selection API.
- Load `@php-wasm/node-X-Y` or `@php-wasm/web-X-Y` directly when installation
  size matters more than the platform adapter's conveniences. -->

- Use `@php-wasm/node` ou `@php-wasm/web` para ter configuração e auxiliares de
  runtime específicos da plataforma e a API mais simples para selecionar versões.
- Carregue `@php-wasm/node-X-Y` ou `@php-wasm/web-X-Y` diretamente quando o
  tamanho da instalação for mais importante que as facilidades do adaptador de
  plataforma.
