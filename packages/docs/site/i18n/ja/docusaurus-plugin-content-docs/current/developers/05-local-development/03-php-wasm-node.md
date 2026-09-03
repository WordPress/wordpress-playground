---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
---

# Node.js で WordPress Playground を使用する

<!--
# Using WordPress Playground in Node.js
-->

WebAssembly プロジェクトとして、Node.js で WordPress Playground を使用することもできます。

<!--
As a WebAssembly project, you can also use WordPress Playground in Node.js.
-->

基盤となる WebAssembly PHP ランタイムを直接制御する必要がある場合は、[`@php-wasm/node` パッケージ](https://npmjs.org/@php-wasm/node) をご覧ください。このパッケージは、WordPress Playground ツールが使用する Node.js ローダーとランタイム統合を提供します。コンパイル済みバイナリは、`@php-wasm/node-8-4` のようなバージョン固有のパッケージとして公開されています。

<!--
If you need direct control over the underlying WebAssembly PHP runtime, take a
look at the [@php-wasm/node package](https://npmjs.org/@php-wasm/node). It
provides the Node.js loader and runtime integrations used by WordPress
Playground tools. The compiled binaries are published in version-specific
packages such as `@php-wasm/node-8-4`.
-->

`@php-wasm/universal`、Node.js と Web のアダプター、バージョン固有のパッケージがどのように組み合わさるかについては、[PHP.wasm パッケージ](/developers/architecture/php-wasm-packages) を参照してください。このページでは、依存関係のフットプリントが小さい、単一バージョン向けの低レベルなセットアップについても説明しています。

<!--
See [PHP.wasm packages](/developers/architecture/php-wasm-packages) to learn
how `@php-wasm/universal`, the Node.js and web adapters, and the version-specific
packages fit together. That page also explains the lower-level, single-version
setup with a smaller dependency footprint.
-->

<div class="callout callout-info">

**API リファレンス**

クラス、関数、インターフェース、および型エイリアスの[完全なリスト](/api/node)を参照してください。

</div>

<!--
<div class="callout callout-info">

**API reference**

Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases.

</div>
-->

import PHPWASMNode from '@php-wasm/node/\README.md';

<PHPWASMNode />
