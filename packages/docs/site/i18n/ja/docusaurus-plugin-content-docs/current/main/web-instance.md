---
title: ウェブ インスタンス - WordPress Playground
slug: /web-instance
description: ツールバー、設定、インスタンス マネージャーを網羅した、playground.wordpress.net の Web インターフェイスの詳細なガイドです。
---

# WordPress Playground ウェブ インスタンス

<!--
# WordPress Playground web instance
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) は、開発者がサーバーを必要とせずにブラウザ上で WordPress を実行できる多機能ウェブツールです。この環境は、プラグイン、テーマ、その他の WordPress 機能を迅速かつ効率的にテストするのに特に便利です。

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) is a versatile web tool that allows developers to run WordPress in a browser without needing a server. This environment is particularly useful for testing plugins, themes, and other WordPress features quickly and efficiently.
-->

主な機能:

<!--
Some key features:
-->

-   **ブラウザベース**: ローカル サーバーのセットアップは不要です。
-   **インスタントセットアップ**: ワンクリックで WordPress を起動できます。
-   **テスト環境**: プラグインやテーマのテストに最適です。

<!--
-   **Browser-based**: No local server setup required.
-   **Instant Setup**: Run WordPress with a single click.
-   **Testing Environment**: Ideal for testing plugins and themes.
-->

[クエリパラメータ API](/developers/apis/query-api/)を使用すると、Playground インスタンスに特定の設定を直接読み込むことができます。これには、特定の WordPress バージョン、テーマ、プラグインの設定が含まれます。ブループリントを使用して、より複雑な設定を定義することもできます（[例はこちら](/quick-start-guide#try-a-block-a-theme-or-a-plugin)をご覧ください）。

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

Playground Web サイトでは、Playground インスタンスをカスタマイズしたり、一部のリソースやユーティリティにすばやくアクセスしたりするためのツールバーもいくつか提供されています。

<!--
From the Playground website, some toolbars are also available to customize your Playground instance and provide quick access to some resources and utilities.
-->

![Playground Toolbar Snapshot](@site/static/img/about/toolbar-playground.webp)

## プレイグラウンドをカスタマイズする

<!--
## Customize Playground
-->

ツールバーには次の項目があります:

<!--
On the toolbar, you'll find:
-->

-   **Playground 設定**: PHP や WordPress のバージョンなど、現在のインスタンスを設定するためのパネルです。
-   **Playground マネージャー**: このパネルでは、WordPress Playground インスタンスを管理し、保存、インポート、エクスポートを行うことができます。

<!--
-   **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
-   **Playground Manager**: This panel lets you manage WordPress Playground instances, allowing you to save, import, and export them.
-->

### プレイグラウンドの設定

<!--
### Playground Settings
-->

![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)

**プレイグラウンド設定パネル** から利用できるオプションは、次の [クエリ API オプション](/developers/apis/query-api#available-options) に対応しています。

<!--
The options available from the **Playground Settings Panel**, correspond to the following [Query API options](/developers/apis/query-api#available-options):
-->

-   `language`: WordPress インスタンスの言語を設定します。
-   `multisite`: WordPress のマルチサイトサポートを有効にします。
-   `networking`: ネットワークアクセスを許可し、WordPress プラグインディレクトリと内部 WordPress API からのフェッチを許可します。
-   `php`: インスタンスの PHP バージョンを指定します。
-   `wp`: WordPress のバージョンを定義します。

<!--
-   `language`: Sets the WordPress instance language.
-   `multisite`: Enables WordPress multisite support.
-   `networking`: Grants network access, allowing fetches from the WordPress plugin directory and internal WordPress APIs.
-   `php`: Specifies the PHP version for the instance.
-   `wp`: Defines the WordPress version.
-->

## プレイグラウンドマネージャー

<!--
## Playground Manager
-->

![Playground settings panel allow users to manage multiple instances](@site/static/img/about/playground-manager-panel.webp)

このパネルでは、Playground インスタンスを管理できます。保存済みの Playground のリストが表示され、現在の Playground 設定にアクセスできます。また、**保存ボタン**をクリックすると、設定をブラウザにローカルに保存し、後で再読み込みできます。

<!--
This panel enables users to manage Playground instances. It displays a list of saved Playgrounds and provides access to the current Playground's settings, along with a **Save Button** to store your configurations locally in your browser for later reloading.
-->

![Save Playground Button](@site/static/img/about/playground-manager-save-instance.webp)

「保存」をクリックすると、インスタンスが生成された名前で保存され、いつでも再アクセスできます。Playground Manager には、WordPress Playground インスタンスをエクスポート（「追加アクション」メニュー）およびインポート（「インポートアクション」メニュー）するオプションもあります。

<!--
Once you click on save, an instance will be stored with a generated name to be revisited anytime. The Playground Manager also has options to export(Additional actions menu) and import(Import actions menu) WordPress Playground instances:
-->

### 追加アクションメニュー

<!--
### Additional actions menu
-->

![Additional actions Menu](@site/static/img/about/playground-manager-additional-actions.webp)

-   **GitHub にプルリクエストをエクスポート**：このオプションを使用すると、WordPress プラグイン、テーマ、および wp-content ディレクトリ全体をプルリクエストとして、任意のパブリック GitHub リポジトリにエクスポートできます。このオプションの使用方法のデモは [こちら](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) でご確認ください。
-   **zip としてダウンロード**：テーマやプラグインがインストールされた状態を含む、Playground インスタンスのセットアップを含む `.zip` ファイルが作成されます。この `.zip` ファイルには、コンテンツやデータベースの変更は含まれません。
-   **エラーを報告**：WP Playground で問題が発生した場合は、このオプションから利用できるフォームを使用して報告できます。Playground の開発チームにエラーの詳細を共有することで、Playground の問題解決に協力することができます。
-   **ブループリントを表示**: このオプションを選択すると、Playground インスタンスで現在使用されているブループリントが [Blueprints Builder ツール](https://playground.wordpress.net/builder/builder.html) で開きます。このツールからブループリントをオンラインで編集し、編集したブループリントを使用して新しい Playground インスタンスを実行できます。

<!--
-   **Export Pull Request to GitHub**: This option allows you to export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Check [here](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) a demo of using this option.
-   **Download as zip**: It creates a `.zip` with the setup of the Playground instance, including any themes or plugins installed. This `.zip` won't include content and database changes.
-   **Report error**: If you have any issues with WP Playground, you can report it using the form available from this option. You can help resolve issues with Playground by sharing the error details with the development team behind Playground.
-   **View Blueprint**: This option will open the current blueprint used for the Playground instance in the [Blueprints Builder tool](https://playground.wordpress.net/builder/builder.html). From this tool you'll be able to edit the blueprint online and run a new Playground instance with your edited version of the blueprint.
-->

<span id="edit-the-blueprint"></span>

[![snapshot of Builder mode of WordPress Playground](@site/static/img/about/blueprint-builder.webp)](https://playground.wordpress.net/builder/builder.html)

### インポートアクションメニュー

<!--
### Import actions menu
-->

![Import actions Menu](@site/static/img/about/playground-manager-import-actions.webp)

-   **zip からインポート**: 「zip としてダウンロード」オプションで生成された任意の `.zip` ファイルを使用して、Playground インスタンスを再作成できます。
-   **Gutenberg PR をプレビュー**: テスターが Gutenberg リポジトリからブランチを実行し、プルリクエストを即座にテストできるようにします。
-   **GitHub からインポート**: このオプションを使用すると、プラグイン、テーマ、wp-content ディレクトリを GitHub のパブリックリポジトリから直接インポートできます。この機能を有効にするには、GitHub アカウントを WordPress Playground に接続してください。

<!--
-   **Import from zip**: It allows you to recreate a Playground instance using any `.zip` generated with the "Download as zip" option.
-   **Preview a Gutenberg PR**: Allow testers run branches from the Gutenberg repository to test pull requests instantly.
-   **Import from GitHub**: This option allows you to import plugins, themes, and wp-content directories directly from your public GitHub repositories. To enable this feature, connect your GitHub account with WordPress Playground.
-->

:::caution

https://playground.wordpress.net のサイトはコミュニティをサポートするために存在しますが、トラフィックが大幅に増加した場合、引き続き機能するという保証はありません。

一定の可用性が必要な場合は、[独自の WordPress Playground をホスト](/developers/architecture/host-your-own-playground) する必要があります。
:::

<!--
:::caution

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
-->
