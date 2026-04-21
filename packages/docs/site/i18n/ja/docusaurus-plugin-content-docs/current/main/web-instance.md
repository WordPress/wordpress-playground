---
title: ウェブ インスタンス
slug: /web-instance
description: ツールバー、設定、インスタンス マネージャーを網羅した、playground.wordpress.net の Web インターフェイスの詳細なガイドです。
---

<!--
# WordPress Playground web instance
-->

# WordPress Playground ウェブ インスタンス

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) lets developers run WordPress in a browser without a server. This environment makes testing plugins, themes, and features quick and easy.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) は、開発者がサーバーを必要とせずにブラウザ上で WordPress を実行できる環境です。この環境は、プラグイン、テーマ、その他の機能を迅速かつ簡単にテストするのに便利です。

<!--
Some key features:

- **Browser-based**: No local server setup required.
- **Instant Setup**: Run WordPress with a single click.
- **Testing Environment**: Ideal for testing plugins and themes.
-->

主な機能:

- **ブラウザベース**: ローカル サーバーのセットアップは不要です。
- **インスタントセットアップ**: ワンクリックで WordPress を起動できます。
- **テスト環境**: プラグインやテーマのテストに最適です。

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

[クエリパラメータ API](/developers/apis/query-api/) を使用すると、Playground インスタンスに特定の設定を直接読み込むことができます。これには、特定の WordPress バージョン、テーマ、プラグインの設定が含まれます。ブループリントを使用して、より複雑な設定を定義することもできます（[例はこちら](/quick-start-guide#try-a-block-a-theme-or-a-plugin)をご覧ください）。

<!--
The Playground website includes toolbars that customize your instance and provide quick access to resources and utilities.
-->

Playground Web サイトには、インスタンスをカスタマイズしたり、リソースやユーティリティにすばやくアクセスするためのツールバーが用意されています。

![Playground Toolbar Snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-toolbar.webp)

<!--
## Customize Playground
-->

## Playground をカスタマイズする

<!--
On the toolbar, you'll find:

- **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
- **Playground Dashboard**: This panel lets you manage WordPress Playground instances, save and export them, edit files from your WordPress instance, and create new Blueprints.
- **Playground Launch Panel**: The Launch Panel shows all the ways to launch a WordPress Playground instance.
-->

ツールバーには次の項目があります:

- **Playground 設定**: PHP や WordPress のバージョンなど、現在のインスタンスを設定するためのパネルです。
- **Playground ダッシュボード**: WordPress Playground インスタンスを管理し、保存、エクスポート、ファイル編集、新しいブループリントの作成ができるパネルです。
- **Playground 起動パネル**: WordPress Playground インスタンスを起動するさまざまな方法を表示するパネルです。

<!--
### Playground Settings
-->

### Playground 設定

![snapshot of customize Playground window at Playground instance](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-settings-panel.webp)

<!--
The **Playground Settings Panel** includes these [Query API options](/developers/apis/query-api#available-options):

- `wp`: Defines the WordPress version.
- `php`: Specifies the PHP version for the instance.
- `language`: Sets the WordPress instance language.
- `multisite`: Enables WordPress multisite support.
- `networking`: Enables network access to the WordPress Plugin Directory and WordPress APIs.
-->

**Playground 設定パネル** には、次の [クエリ API オプション](/developers/apis/query-api#available-options) が含まれています:

- `wp`: WordPress のバージョンを定義します。
- `php`: インスタンスの PHP バージョンを指定します。
- `language`: WordPress インスタンスの言語を設定します。
- `multisite`: WordPress のマルチサイトサポートを有効にします。
- `networking`: WordPress プラグインディレクトリと WordPress API へのネットワークアクセスを有効にします。

<!--
## Playground Manager
-->

## Playground マネージャー

![Playground settings panel allow users to save export and edit the WordPress directly](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard.webp)

<!--
This panel lets you manage Playground instances and provides access to the following panels:

- **Settings**: To manage the current Playground's settings
- **File Browser**: Built-in IDE for editing files, uploading plugins and themes, and live editing. Playground auto-reloads changes in real time.
- **Blueprint**: A Blueprint editor for creating, saving, and running Blueprints in your Playground web instance.
- **Database**: Tools for managing the database with Adminer and phpMyAdmin, and downloading as a `.sqlite` file.
- **Logs**: Displays log messages when something goes wrong.
-->

このパネルでは、Playground インスタンスを管理し、以下のパネルにアクセスできます:

- **設定**: 現在の Playground の設定を管理します
- **ファイルブラウザ**: ファイル編集、プラグインやテーマのアップロード、ライブ編集ができる組み込み IDE。Playground は変更をリアルタイムで自動リロードします。
- **ブループリント**: Playground ウェブインスタンスでブループリントを作成、保存、実行するためのエディタ。
- **データベース**: Adminer と phpMyAdmin でデータベースを管理し、`.sqlite` ファイルとしてダウンロードするツール。
- **ログ**: 問題が発生したときにログメッセージを表示します。

![Save Playground Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard-save.webp)

<!--
Click "Save" to create an instance and list it in the Playground Launch Panel. The Playground Dashboard also offers export and download options through the Additional actions menu:
-->

「保存」をクリックすると、インスタンスが作成され、Playground 起動パネルにリストされます。Playground ダッシュボードでは、追加アクションメニューからエクスポートやダウンロードオプションも利用できます:

<!--
### Additional actions menu
-->

### 追加アクションメニュー

![Additional actions Menu](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/additional-options-playground-dashboard.webp)

<!--
- **Export Pull Request to GitHub**: Export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Watch a [demo of this feature](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Download as .zip**: Creates a `.zip` file with the setup of the Playground instance, including any themes or plugins installed. This `.zip` excludes content and database changes.
-->

- **GitHub にプルリクエストをエクスポート**: WordPress プラグイン、テーマ、および wp-content ディレクトリ全体をプルリクエストとして、任意のパブリック GitHub リポジトリにエクスポートできます。[この機能のデモ](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)をご覧ください。
- **zip としてダウンロード**: テーマやプラグインがインストールされた状態を含む、Playground インスタンスのセットアップを含む `.zip` ファイルが作成されます。この `.zip` ファイルには、コンテンツやデータベースの変更は含まれません。

<!--
### Blueprint Editor
-->

### ブループリントエディタ

![Blueprint editor WordPress Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-blueprint-editor.webp)

<!--
The Blueprint editor replaced the older Blueprint builder, offering the ability to manage multiple Blueprints and code validation.
-->

ブループリントエディタは、以前のブループリントビルダーに代わるもので、複数のブループリントを管理し、コード検証を行う機能を提供します。

<!--
### Launch Playground Panel
-->

### Playground 起動パネル

![Playground Launch Panel](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dashboard/import-playground.webp)

<!--
This panel shows all the ways to launch WordPress Playground: import `.zip` files, load from GitHub repositories, and preview PRs from WordPress core and Gutenberg.

The Launch Panel also lists more than 40 blueprints from the Blueprint Gallery and your Saved Playgrounds.
-->

このパネルでは、WordPress Playground を起動するさまざまな方法を表示します: `.zip` ファイルのインポート、GitHub リポジトリからの読み込み、WordPress コアと Gutenberg からの PR のプレビュー。

起動パネルには、ブループリントギャラリーからの 40 以上のブループリントと、保存した Playground も一覧表示されます。

<!--
:::caution

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
-->

:::caution

https://playground.wordpress.net のサイトはコミュニティをサポートするために存在しますが、トラフィックが大幅に増加した場合、引き続き機能するという保証はありません。

一定の可用性が必要な場合は、[独自の WordPress Playground をホスト](/developers/architecture/host-your-own-playground)する必要があります。
:::
