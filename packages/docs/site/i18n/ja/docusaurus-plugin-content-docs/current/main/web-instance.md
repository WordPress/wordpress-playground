---
title: Playground ウェブ インスタンス
slug: /web-instance
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

-   **ブラウザベース**: ローカルサーバーのセットアップは不要です。
-   **インスタントセットアップ**: ワンクリックで WordPress を起動できます。
-   **テスト環境**: プラグインやテーマのテストに最適です。

<!--
-   **Browser-based**: No need for a local server setup.
-   **Instant Setup**: Run WordPress with a single click.
-   **Testing Environment**: Ideal for testing plugins and themes.
-->

[クエリ パラメータ](/developers/apis/query-api/) を使用すると、特定のバージョンの WordPress、テーマ、プラグイン、またはブループリントを介したより複雑なセットアップなどを Playground インスタンスに直接読み込むことができます ([こちら](/quick-start-guide#try-a-block-a-theme-or-a-plugin) でいくつかの例を確認してください)。

<!--
Via [Query Params](/developers/apis/query-api/) we can directly load in the Playground instance things such as a specific version of WordPress, a theme, a plugin or a more complex setup via blueprints (check [here](/quick-start-guide#try-a-block-a-theme-or-a-plugin) some examples).
-->

Playground Web サイトには、プレイグラウンド インスタンスをカスタマイズしたり、一部のリソースやユーティリティにすばやくアクセスしたりするためのツールバーもいくつか用意されています。

<!--
From the Playground website there are also available some toolbars to customize your playground instance and to provide quick access to some resources and utilities.
-->

![Playground Toolbar Snapshot](./_assets/toolbar.png)

## プレイグラウンドをカスタマイズする

<!--
## Customize Playground
-->

![snapshot of customize playground window at playground instance](./_assets/customize-playground.png)

「プレイグラウンドのカスタマイズ」ウィンドウから利用できるオプションは、次の [クエリ API オプション](/developers/apis/query-api#available-options) に対応しています。

<!--
The options available from the "Customize Playground" window correpond to the following [Query API options](/developers/apis/query-api#available-options):
-->

-   `php`
-   `php-extension-bundle`
-   `networking`
-   `wp`

:::tip

WordPress インスタンスから [プラグイン](https://w.org/plugins) と [テーマ](https://w.org/themes) を参照できるようにするには、「ネットワーク アクセス」を有効にする必要があります。
:::

<!--
:::tip

You need to activate "Network access" to be able to browse for [plugins](https://w.org/plugins) and [themes](https://w.org/themes) from your WordPress instance.
:::
-->

## プレイグラウンド オプション メニュー

<!--
## Playground Options Menu
-->

![options menu at playground instance snapshot](./_assets/options.png)

このメニューには、いくつかの Playground リソースとツールへのリンクが含まれています。

<!--
This menu contains links to some Playground resources and tools:
-->

-   **サイトをリセット**: すべてのデータを消去し、新しいサイトでページをリロードします。
-   **エラーを報告**: WP Playground で問題が発生した場合は、このオプションから利用できるフォームを使用して報告できます。Playground の開発チームにエラーの詳細を共有することで、Playground の問題解決に協力できます。
-   **zip としてダウンロード**: テーマやプラグインがインストールされている場合など、Playground インスタンスのセットアップを含む `.zip` ファイルを作成します。この `.zip` ファイルには、コンテンツやデータベースの変更は含まれません。
-   **zip から復元**: 「zip としてダウンロード」オプションで生成された `.zip` ファイルを使用して、Playground インスタンスを再作成できます。
-   **Github からインポート**: このオプションを使用すると、プラグイン、テーマ、wp-content ディレクトリを GitHub のパブリックリポジトリから直接インポートできます。この機能を有効にするには、GitHub アカウントを WordPress Playground に接続してください。

-   **GitHub へのプルリクエストのエクスポート**: このオプションを使用すると、WordPress プラグイン、テーマ、および wp-content ディレクトリ全体を、任意のパブリック GitHub リポジトリへのプルリクエストとしてエクスポートできます。このオプションの使用方法のデモは [こちら](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) でご覧いただけます。

-   **ログの表示**: このオプションを選択すると、Playground、WordPress、PHP のエラーログを表示するモーダルが表示されます。

-   **ブループリントの編集**: このオプションを選択すると、[Blueprints Builder ツール](https://playground.wordpress.net/builder/builder.html) で Playground インスタンスに使用されている現在のブループリントが開きます。このツールから、ブループリントをオンラインで編集し、編集したブループリントを使用して新しい Playground インスタンスを実行できます。

<!--
-   **Reset Site**: - It will wipe out all data and reload the page with a new site.
-   **Report error**: If you have any issue with WP Playground you can report it using the form available from this option. You can help resolve issues with Playground by sharing the error details with development team behind Playground.
-   **Download as zip**: It creates a `.zip` with the setup of the Playground instance including any themes or plugins installed. This `.zip` won't include content and database changes.
-   **Restore from zip**: It allows you to recreate a Playground instance using any `.zip` generated with the "Download as zip" option
-   **Import from Github**: This option allows you to import plugins, themes, and wp-content directories directly from your public GitHub repositories. To enable this feature, connect your GitHub account with WordPress Playground.

-   **Export Pull Request to GitHub**: This option allows you to export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Check [here](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) a demo of using this option.

-   **View Logs**: This option will take you to modal that will show any error logs for Playground, WordPress and PHP.

-   **Edit the blueprint**: This option will open the current blueprint used for the Playground instance in the [Blueprints Builder tool](https://playground.wordpress.net/builder/builder.html). From this tool you'll be able to edit the blueprint online and run a new Playground instance with your edited version of the blueprint.
-->

<span id="edit-the-blueprint"></span>

[![snapshot of Builder mode of WordPress Playground](./_assets/builder-mode.png)](https://playground.wordpress.net/builder/builder.html)

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
