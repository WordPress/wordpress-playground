---
title: アーキテクチャ
slug: /developers/architecture
---

# アーキテクチャの概要

<!--
# Architecture overview
 -->

WordPress Playground は、次の高レベル コンポーネントで構成されています。

<!--
WordPress Playground consists of the following high-level components:
 -->

- [WordPress](/developers/architecture/wordpress)
- [WebAssembly PHP](/developers/architecture/wasm-php-overview)
- [Browser bindings](/developers/architecture/browser-concepts)
- [@php-wasm/node](https://npmjs.com/package/@php-wasm/node) 経由の Node.js バインディング
- [Public API](/developers/apis/)

<!--
-   [WordPress](/developers/architecture/wordpress)
-   [WebAssembly PHP](/developers/architecture/wasm-php-overview)
-   [Browser bindings](/developers/architecture/browser-concepts)
-   Node.js bindings via [@php-wasm/node](https://npmjs.com/package/@php-wasm/node)
-   [Public API](/developers/apis/)
 -->

アーキテクチャの特定の部分について詳しく知るには、各セクションにアクセスしてください。

<!--
Visit each section to learn more about the specific parts of the architecture.
 -->

## ツーリング

<!--
## Tooling
 -->

### NX: パッケージとプロジェクトの構築

<!--
### NX: building packages and projects
 -->

WordPress Playground は、モノレポ用に設計されたビルド システムである [NX](https://nx.dev/) を使用します。

<!--
WordPress Playground uses [NX](https://nx.dev/), a build system designed for monorepos.
 -->

Playground パッケージとプロジェクト間の依存関係は、Webpack のようなバンドラーにとっては [複雑すぎる](https://github.com/WordPress/wordpress-playground/pull/151) ですが、NX はこの複雑さをはるかに適切に処理します。
![Dependency graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)

<!--
The dependencies between Playground packages and projects [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) for a bundler like Webpack, and NX handles this complexity much better:
![Dependency graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)
 -->

詳細については、[NX 開発者ドキュメント](https://nx.dev/getting-started/intro)をご覧ください。

<!--
To learn more, head over to the [NX developer docs](https://nx.dev/getting-started/intro).
 -->

### Lerna: パッケージとプロジェクトの公開

<!--
### Lerna: publishing packages and projects
 -->

WordPress Playground には、いくつかの NPM パッケージ、VS Code 拡張機能、WordPress プラグイン、Web アプリ、その他の GitHub リリースが含まれており、すべてメインの [wordpress-playground](https://github.com/WordPress/wordpress-playground) と [Playground Tools](https://github.com/WordPress/playground-tools/) の 2 つのモノレポで管理されています。

<!--
WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos: the main [wordpress-playground](https://github.com/WordPress/wordpress-playground) and [Playground Tools](https://github.com/WordPress/playground-tools/).
 -->

すべての JavaScript/TypeScript パッケージのビルド、管理、公開には[Lerna](https://lerna.js.org)を使用しています。Lerna はすべての処理を同時に行います。バージョン番号のインクリメント、新しいタグの設定、そして変更されたパッケージの`npm`への公開まで行います。

<!--
We use [Lerna](https://lerna.js.org) to build, manage, and publish all JavaScript/TypeScript packages. Lerna handles everything simultaneously: it increments the version number, sets a new tag, and publishes the modified packages to `npm`.
 -->

公開されたパッケージは同じバージョン番号を共有するため、1 つのパッケージを更新すると、Lerna は依存するすべてのパッケージのバージョン番号を上げます。

<!--
The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages.
 -->
