---
title: ネイティブiOSアプリのWordPress Playground
slug: /guides/wordpress-native-ios-app
description: Playground を使用した「Blocknotes」のケース スタディに基づいて、ネイティブ iOS アプリ内で WordPress サイトを実行する方法を学びます。
---

## Playground 経由でネイティブ iOS アプリで実際の WordPress サイトを配布するにはどうすればよいでしょうか?

<!--
## How to ship a real WordPress site in a native iOS app via Playground?
-->

Blocknotes は、WordPress Playground を活用して iOS デバイス上で WordPress をネイティブに実行できる初の iOS アプリケーションです。 WordPress のコアコミッターである [Ella van Durpe](https://profiles.wordpress.org/ellatrix/) によって開発された Blocknotes は、 WebAssembly を活用して従来の PHP サーバーを必要とせずに WordPress を実行することで、モバイルアプリケーションの機能を大幅に向上させました。

<!--
Blocknotes is the first iOS application that ran WordPress natively on iOS devices by leveraging WordPress Playground. Developed by [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), a core committer for WordPress, Blocknotes represents a significant leap in the capabilities of mobile applications by utilizing WebAssembly to run WordPress without the need for a traditional PHP server.
-->

このケーススタディでは、Blocknotes の機能、技術的実装、およびモバイルおよび Web 開発の将来に対する潜在的な影響について検討します。

<!--
This case study explores the features, technical implementation, and potential implications of Blocknotes for the future of mobile and web development.
-->

**重要！** 現在のバージョンの Blocknotes では、WordPress Playground は動作しません。最初のリリース以降、アプリは WordPress ブロックエディターのみを使用するように書き換えられ、WordPress の他の機能は使用されません。このケーススタディでは、WordPress に新たな可能性を無限に広げた Blocknotes の初期バージョンについてご紹介します。

<!--
**Important!** The current version of Blocknotes isn’t running WordPress Playground anymore. Since the initial release, the app was rewritten to only use the WordPress block editor without the rest of WordPress. This case study covers the early versions of Blocknotes that opened an entire world of new possibilities for WordPress.
-->

## Blocknotes の機能

<!--
## Blocknotes features
-->

Blocknotes を使用すると、WordPress のブロックエディターを使ってメモを作成・編集できます。メモは HTML ファイルとしてユーザーの iCloud Drive に自動的に保存され、デバイス間でシームレスに同期されます。

<!--
Blocknotes allows users to create and edit notes using the WordPress block editor. The notes are automatically saved as HTML files to the user’s iCloud Drive and seamlessly synchronized across devices.
-->

## 技術的な実装

<!--
## Technical Implementation
-->

Blocknotes は WebView として動作し、HTML ページ上で PHP の WebAssembly バージョンで WordPress を実行していました。この HTML ページは [Capacitor](https://capacitorjs.com/) を介してネイティブ iOS としてパッケージ化されていました。この構成により、WordPress は従来サポートされていなかった環境でも動作できるようになりました。

<!--
Blocknotes operated as a WebView running an HTML page where a WebAssembly version of PHP was running WordPress. That HTML page was packaged as a native iOS via [Capacitor](https://capacitorjs.com/). This setup allowed WordPress to function in environments traditionally not supported.
-->

[Blocknotes GitHub リポジトリ](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748)では、Playground ベースの最新リリースを確認できます。最も重要な部分は次のとおりです。

<!--
In [Blocknotes GitHub repository](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) you can review the last Playground-based release. Here are the most important parts:
-->

-   [WordPress ビルド](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (`.data` ファイルとしてパッケージ化されています)。
-   [静的 WordPress アセット](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public)。
-   [PHP の WebAssembly ビルド](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) ([@php-wasm/web](https://npmjs.com/package/@php-wasm/web) 経由)。
-   [PHP と WordPress を実行する Web ワーカー](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js)。
-   [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress プラグイン ([ここからインストール](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) を使用すると、wp-admin をメモアプリとして使用できます。
-   [iOS ファイルから WordPress の投稿を読み込み](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39)、[変更を iOS ファイルとして保存](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js) するレイヤー。

<!--
-   [A WordPress build](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (packaged as a `.data` file).
-   [Static WordPress assets](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
-   [A WebAssembly build of PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) (via [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
-   [A web worker running PHP and WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
-   [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress plugin ([installed here](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) to turn wp-admin into a note-taking app.
-   A layer to [load WordPress posts from iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) and [save changes as iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).
-->

## WordPress Playground で独自の iOS アプリを構築する

<!--
## Building your own iOS app with WordPress Playground
-->

Blocknotes は WordPress ベースの iOS アプリのリリースが可能であることを証明しましたが、これはまだ非常に探索的な分野です。確立されたワークフロー、ライブラリ、ナレッジベースは存在しません。

<!--
Although Blocknotes proved releasing a WordPress-based iOS app is possible, this is still a highly exploratory area. There are no established workflows, libraries, or knowledge bases.
-->

最も優れたドキュメントは Blocknotes リポジトリです。新しいアプリの探索を始める際の参考資料として、また出発点としてご活用ください。PHP の WebAssembly ビルド、WordPress ブロックエディターの統合、そして WordPress を効率的に実行するための Web ワーカーの活用方法など、主要なコンポーネントを詳しく確認しましょう。これらの要素を分析することで、WordPress Playground を使って独自の iOS アプリを構築するための洞察が得られ、モバイル Web アプリケーションの可能性の限界を押し広げることができます。

<!--
The best documentation we have is the Blocknotes repository. Use it as a reference and a starting point for exploring your new app. Review the key components like the WebAssembly build of PHP, the integration of the WordPress block editor, and how web workers are utilized to run WordPress efficiently. By dissecting these elements, you can gain insights into building your own iOS app with WordPress Playground, pushing the boundaries of what’s possible with mobile web applications.
-->

この革新的な分野を開拓していく中で、発見したことや課題を Playground チームや WordPress コミュニティ全体と共有してください。学んだことを公開することは、開発の助けになるだけでなく、共通の知識ベースの構築にも貢献し、モバイル版 WordPress の未来を前進させる原動力となります。

<!--
As you navigate this innovative space, share your findings and challenges with the Playground team and the broader WordPress community. Publishing your learnings will not only aid in your development but also contribute to a collective knowledge base, driving forward the future of WordPress on mobile.
-->

## 可能性と未来

<!--
## Potential and the future
-->

Blocknotes は、よりアクセスしやすく、柔軟性があり、強力な新世代のアプリケーションへの道を開きます。

<!--
Blocknotes paves the way for a new generation of applications that are more accessible, flexible, and powerful.
-->

アプリ構築ワークフローが成熟すれば、Playground サイトを iOS アプリとしてパッケージ化する自動化されたパイプラインが登場するかもしれません。これにより、サーバー、ブラウザ、モバイルアプリで同じコードベースを実行することが非常に容易になります。

<!--
Once the app-building workflows mature, we may see an automated pipelines for packaging Playground sites as iOS apps. It would make it extremely easy to run the same codebase on the server, in the browser, and as a mobile app.
-->

協力して発見を共有することで、WordPress とモバイルアプリ開発の可能性の限界を押し広げることができます。

<!--
By working together and sharing our findings, we can push the boundaries of what’s possible with WordPress and mobile app development
-->
