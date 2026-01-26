---
title: ウェブ インスタンス
slug: /web-instance
description: ツールバー、設定、インスタンス マネージャーを網羅した、playground.wordpress.net の Web インターフェイスの詳細なガイドです。
---

# WordPress Playground ウェブ インスタンス {#wordpress-playground-web-instance}

[https://playground.wordpress.net/](https://playground.wordpress.net/) は、開発者がサーバーを必要とせずにブラウザ上で WordPress を実行できる環境です。この環境は、プラグイン、テーマ、その他の機能を迅速かつ簡単にテストするのに便利です。

主な機能:

- **ブラウザベース**: ローカル サーバーのセットアップは不要です。
- **インスタントセットアップ**: ワンクリックで WordPress を起動できます。
- **テスト環境**: プラグインやテーマのテストに最適です。

[クエリパラメータ API](/developers/apis/query-api/) を使用すると、Playground インスタンスに特定の設定を直接読み込むことができます。これには、特定の WordPress バージョン、テーマ、プラグインの設定が含まれます。ブループリントを使用して、より複雑な設定を定義することもできます（[例はこちら](/quick-start-guide#try-a-block-a-theme-or-a-plugin)をご覧ください）。

Playground Web サイトには、インスタンスをカスタマイズしたり、リソースやユーティリティにすばやくアクセスするためのツールバーが用意されています。

![Playground Toolbar Snapshot](@site/static/img/about/playground-toolbar.webp)

## Playground をカスタマイズする {#customize-playground}

ツールバーには次の項目があります:

- **Playground 設定**: PHP や WordPress のバージョンなど、現在のインスタンスを設定するためのパネルです。
- **Playground ダッシュボード**: WordPress Playground インスタンスを管理し、保存、エクスポート、ファイル編集、新しいブループリントの作成ができるパネルです。
- **Playground 起動パネル**: WordPress Playground インスタンスを起動するさまざまな方法を表示するパネルです。

### Playground 設定 {#playground-settings}

![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)

**Playground 設定パネル** には、次の [クエリ API オプション](/developers/apis/query-api#available-options) が含まれています:

- `wp`: WordPress のバージョンを定義します。
- `php`: インスタンスの PHP バージョンを指定します。
- `language`: WordPress インスタンスの言語を設定します。
- `multisite`: WordPress のマルチサイトサポートを有効にします。
- `networking`: WordPress プラグインディレクトリと WordPress API へのネットワークアクセスを有効にします。

## Playground マネージャー {#playground-manager}

![Playground settings panel allow users to save export and edit the WordPress directly](@site/static/img/about/playground-dashboard.webp)

このパネルでは、Playground インスタンスを管理し、以下のパネルにアクセスできます:

- **設定**: 現在の Playground の設定を管理します
- **ファイルブラウザ**: ファイル編集、プラグインやテーマのアップロード、ライブ編集ができる組み込み IDE。Playground は変更をリアルタイムで自動リロードします。
- **ブループリント**: Playground ウェブインスタンスでブループリントを作成、保存、実行するためのエディタ。
- **データベース**: Adminer と phpMyAdmin でデータベースを管理し、`.sqlite` ファイルとしてダウンロードするツール。
- **ログ**: 問題が発生したときにログメッセージを表示します。

![Save Playground Button](@site/static/img/about/playground-dashboard-save.webp)

「保存」をクリックすると、インスタンスが作成され、Playground 起動パネルにリストされます。Playground ダッシュボードでは、追加アクションメニューからエクスポートやダウンロードオプションも利用できます:

### 追加アクションメニュー {#additional-actions-menu}

![Additional actions Menu](@site/static/img/about/additional-options-playground-dashboard.webp)

- **GitHub にプルリクエストをエクスポート**: WordPress プラグイン、テーマ、および wp-content ディレクトリ全体をプルリクエストとして、任意のパブリック GitHub リポジトリにエクスポートできます。[この機能のデモ](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)をご覧ください。
- **zip としてダウンロード**: テーマやプラグインがインストールされた状態を含む、Playground インスタンスのセットアップを含む `.zip` ファイルが作成されます。この `.zip` ファイルには、コンテンツやデータベースの変更は含まれません。

### ブループリントエディタ {#blueprint-editor}

![Blueprint editor WordPress Playground](@site/static/img/about/playground-blueprint-editor.webp)

ブループリントエディタは、以前のブループリントビルダーに代わるもので、複数のブループリントを管理し、コード検証を行う機能を提供します。

### Playground 起動パネル {#launch-playground-panel}

![Playground Launch Panel](@site/static/img/dashboard/import-playground.webp)

このパネルでは、WordPress Playground を起動するさまざまな方法を表示します: `.zip` ファイルのインポート、GitHub リポジトリからの読み込み、WordPress コアと Gutenberg からの PR のプレビュー。

起動パネルには、ブループリントギャラリーからの 40 以上のブループリントと、保存した Playground も一覧表示されます。

:::caution

https://playground.wordpress.net のサイトはコミュニティをサポートするために存在しますが、トラフィックが大幅に増加した場合、引き続き機能するという保証はありません。

一定の可用性が必要な場合は、[独自の WordPress Playground をホスト](/developers/architecture/host-your-own-playground)する必要があります。
:::
