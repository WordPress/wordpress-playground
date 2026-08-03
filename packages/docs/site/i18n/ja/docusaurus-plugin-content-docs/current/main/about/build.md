---
title: 構築
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

## ブロックテーマの変更を保存し、GitHub プルリクエストを作成します

<!--
## Save changes done on a Block Theme and create GitHub Pull Requests
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

- [Developer Hours: テストとデモ用の WordPress Playground ブループリントの作成](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
- [Hallway Hangout のまとめ: Playground、Create-block-theme プラグイン、GitHub を使ったテーマ構築](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)
-->

## Playground をローカルフォルダーと同期し、GitHub プルリクエストを作成する

<!--
In the Dock, click the **Autosaved** or **Unsaved** save status, select **Save
in a local directory**, click **Choose...**, and select a directory dedicated
to this Playground. After granting write access, click **Save**. Playground
copies the current site into the selected directory and overwrites files with
matching names; it does not import an existing site from that directory.
-->

Dock の**自動保存済み**または**未保存**をクリックし、**ローカルディレクトリに保存**、**選択...**の順に選択して、この Playground 専用のディレクトリを指定します。書き込みアクセスを許可したら、**保存**をクリックします。Playground は現在のサイトを選択したディレクトリにコピーし、同名のファイルを上書きします。そのディレクトリにある既存のサイトはインポートされません。

<!--
![The Store permanently pane with local-directory storage selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)
-->

![ローカルディレクトリへの保存が選択された「永続的に保存」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)

<!--
Local-directory storage uses the File System Access API, so availability depends on browser and platform support for choosing and writing to directories. Chromium-based desktop browsers usually support it. Browsers without that capability can still use browser storage and ZIP export. See [Browser support](/developers/limitations#browser-support) for the broader compatibility model.
-->

ローカルディレクトリへの保存には File System Access API を使用します。そのため、利用できるかどうかは、ディレクトリの選択と書き込みに対するブラウザおよびプラットフォームの対応状況によって異なります。通常、Chromium ベースのデスクトップブラウザは対応しています。対応していないブラウザでも、ブラウザストレージと ZIP エクスポートは使用できます。対応状況について詳しくは、[ブラウザサポート](/developers/limitations#browser-support)をご覧ください。

<!--
Files changed in Playground are written to the selected directory. Files changed on disk are not pulled into the running Playground automatically. For a local-directory Playground, open the **Saved** status menu in the Dock and choose **Reload files from disk** when you want Playground to read the current files from the directory.
-->

Playground で変更したファイルは、選択したディレクトリに書き込まれます。ディスク上で変更したファイルが、実行中の Playground に自動で読み込まれることはありません。ローカルディレクトリに保存した Playground でディレクトリ内の最新ファイルを読み込むには、Dock の**保存済み**ステータスメニューを開き、**ディスクからファイルを再読み込み**を選択します。

<!--
With this workflow, you can create GitHub PRs directly from changes made in your local directory.
-->

このワークフローを使うと、ローカルディレクトリで行った変更から GitHub PR を直接作成できます。

<!--
See here a little demo of this workflow in action:
-->

次の動画では、このワークフローの動作を確認できます。

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
