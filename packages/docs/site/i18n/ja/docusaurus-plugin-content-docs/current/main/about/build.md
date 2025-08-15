---
title: 構築 - WordPress Playground
slug: /about/build
description: ローカル環境の設定からテーマや新しいツールの作成まで、WordPress Playground が製品の構築にどのように役立つかを学びます。
sidebar_class_name: navbar-build-item
---

# 構築

<!--
# Build
-->

WordPress Playground を使えば、モバイル端末からでも、電波の届かない場所でも、WordPress を素早く作成・学習できます。ブラウザ、Node.js、モバイルアプリ、VS Code など、作業効率の良い場所で Playground をご利用いただけます。

<!--
WordPress Playground can help you to create and learn WordPress quickly, even on mobile with no signal. You can use Playground where you work best, whether that’s in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-->

## ローカルの WordPress 環境を素早く設定する

<!--
## Setting quickly a local WordPress environment
-->

Playground を開発ワークフローにシームレスに統合することで、ローカルの WordPress 環境を素早く起動し、コードをテストできます。[ターミナル](/developers/local-development/wp-playground-cli) または [お好みの IDE](/developers/local-development/vscode-extension) から直接実行できます。

<!--
You can seamlessly integrate Playground into your development workflow to launch a local WordPress environment quickly for testing your code. You can do this directly [from the terminal](/developers/local-development/wp-playground-cli) or [your preferred IDE.](/developers/local-development/vscode-extension)
-->

## ブロックテーマの変更を保存し、Github プルリクエストを作成します

<!--
## Save changes done on a Block Theme and create Github Pull Requests
-->

Playground インスタンスを GitHub リポジトリに接続し、[Create Block Theme](https://wordpress.org/plugins/create-block-theme/) プラグインを利用して、WordPress UI から行った変更を含むプル リクエストを作成できます。

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you’ve done through the WordPress UI, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin.
-->

このワークフローを使用すると、ブラウザ内でブロック テーマを完全に構築し、変更を GitHub に保存したり、既存のテーマを改善/修正したりできます。

<!--
With this workflow, you could build a block theme completely in your browser and save your change to GitHub, or you could improve/fix an existing one.
-->

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>
このワークフローのさらにいくつかの例:

<!--
Some more examples of this workflow:
-->

-   [Developer Hours: テストとデモ用の WordPress Playground ブループリントの作成](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Hallway Hangout のまとめ: Playground、Create-block-theme プラグイン、GitHub を使ったテーマ構築](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)
-->

## プレイグラウンドインスタンスをローカルフォルダと同期し、Github プルリクエストを作成する

<!--
## Synchronize your playground instance with a local folder and create Github Pull Requests
-->

![Storage Type Device Snapshot](../_assets/storage-type-device.png)

Google Chrome を使用すると、Playground インスタンスを次のいずれかのローカル ディレクトリと同期できます。

<!--
With Google Chrome you can synchronize your Playground instance with a local directory, that can be either:
-->

-   空のディレクトリ – このプレイグラウンドを保存して同期を開始します
-   既存のディレクトリ – ここで読み込み、同期を開始します

<!--
-   And empty directory – to save this Playground and start syncing
-   An existing directory – to load it here and start syncing
-->

:::info

この機能は現在 Google Chrome でのみご利用いただけます。他のブラウザではご利用いただけません。

:::

<!--
:::info

This feature is only available for Google Chrome for now. It won't work with other browsers, yet.

:::
-->

接続の両側で行われた変更について:

<!--
Regarding changes done on both sides of the connection:
-->

-   Playground で変更されたファイルはコンピュータに同期されます。
-   コンピュータで変更されたファイルは Playground に同期されません。「ローカルファイルを同期」ボタンをクリックする必要があります。

<!--
-   Files changed in Playground will be synchronized to your computer.
-   Files changed on your computer will not be synchronized to Playground. You'll need to click the "Sync local files" button.
-->

このワークフローを使用すると、ローカル ディレクトリで行われた変更から直接 GitHub PR を作成できます。

<!--
With this workflow you can create directly GitHub PRs from your changes done on your local directory.
-->

このワークフローの実際のデモを次に示します。

<!--
See here a little demo of this workflow in action:
-->

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

## 他の API と統合して新しいツールを作成します。

<!--
## Integrate with other APIs to create new tools.
-->

Playground はさまざまな API と組み合わせることで、素晴らしいツールを作成できます。可能性は無限大です。

<!--
Playground can be combined with different APIs to create amazing tools. The possibilities are endless.
-->

[Node.js で WordPress Playground を使用](/developers/local-development/php-wasm-node)して新しいツールを作成できます。PHP WebAssembly ランタイムを同梱する [@php-wasm/node パッケージ](https://npmjs.org/@php-wasm/node) は、例えば [https://playground.wordpress.net/](https://playground.wordpress.net/) で使用されているパッケージです。

<!--
You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.
-->

Playground をベースに構築されたもう一つの興味深いアプリは、**Translate Live** です（[例](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/) を参照）。Open AI と組み合わせることで、WordPress 翻訳ツールを「その場で」提供し、翻訳を実際の文脈で確認・修正できます（例を参照）。このツールの詳細については、[Translate Live: Translation Playground のアップデート](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/) をご覧ください。

<!--
Another interesting app built on top of Playground is **Translate Live** (see [example](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) which, in combination with Open AI provides a WordPress translations tool “in place” where translations can be seen and modified in their real context (see example). Read more about this tool at [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)
-->

## オフラインでもネイティブアプリとしても動作

<!--
## Work offline and as a native app
-->

[playground.wordpress.net](https://playground.wordpress.net/) に初めてアクセスすると、Playground の使用に必要なすべてのファイルがブラウザに自動的にキャッシュされます。それ以降は、インターネット接続がなくても [playground.wordpress.net](https://playground.wordpress.net/) にアクセスできるようになり、中断することなくプロジェクトの作業を継続できます。

<!--
When you first visit [playground.wordpress.net](https://playground.wordpress.net/), your browser automatically caches all the necessary files to use Playground. From that point on, you can access [playground.wordpress.net](https://playground.wordpress.net/), even without internet connection, ensuring you can continue working on your projects without interruptions.
-->

Playground をプログレッシブ ウェブ アプリ (PWA) としてデバイスにインストールし、ネイティブ アプリと同じようにホーム画面から直接 Playground を起動することもできます。

<!--
You can also install Playground on your device as a Progressive Web App (PWA) to launch the Playground directly from your home screen—just like a native app.
-->

詳細については、[WordPress Playground のオフライン モードと PWA サポートの導入](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) をお読みください。

<!--
Read [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) for more info.
-->

## ウェブ以外の環境に WordPress サイトを埋め込む

<!--
## Embed a WordPress site in non-web environments
-->

[Playground 経由でネイティブ iOS アプリで実際の WordPress サイトを配布する方法](../guides/wordpress-native-ios-app) ガイドでは、Playground を活用して WordPress サイトを iOS アプリにラップする方法を説明しています。

<!--
The [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) guide shows how we can leverage Playground to wrap a WordPress site into an IOS app.
-->
