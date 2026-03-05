---
title: クイックスタート ガイド
slug: /quick-start-guide
description: Playground を使い始めるための5分ガイド。プラグインのテスト、テーマの試用、そして様々なバージョンのWP/PHPの使い方を学びましょう。
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

# 5 分で WordPress Playground を使い始める

<!--
# Start using WordPress Playground in 5 minutes
 -->

WordPress Playground は、次のような場合に役に立ちます。

<!--
WordPress Playground can help you with any of the following:
 -->

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

このページでは、それぞれの手順を解説します。視覚的に学習したい方は、こちらの動画をご覧ください。

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video:
 -->

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

## 新しい WordPress サイトを始める

<!--
## Start a new WordPress site
 -->

[playground.wordpress.net の公式デモ](https://playground.wordpress.net/)にアクセスするたびに、新しい WordPress サイトが作成されます。

<!--
Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site.
 -->

その後、ページを作成したり、プラグインやテーマをアップロードしたり、独自のサイトをインポートしたり、通常の WordPress で行うほとんどの操作を実行できます。

<!--
You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress.
 -->

始めるのはとても簡単です !

<!--
It's that easy to start!
 -->

サイト全体はブラウザ内に保存されており、タブを閉じると削除されます。最初からやり直したい場合は、ページを更新してください。

<!--
The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page!
 -->

:::info WordPress Playground はプライベートです

作成したものはすべてブラウザ内に保存され、他の場所には**送信されません**。完成したら、サイトを zip ファイルとしてエクスポートできます。または、ページを更新して最初からやり直すこともできます。

:::

<!--
:::info WordPress Playground is private

Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over!

:::
 -->

## ブロック、テーマ、プラグインを試す

<!--
## Try a block, a theme, or a plugin
 -->

[/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/) に必要なプラグインやテーマをアップロードできます。

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
 -->

どのプラグインやテーマを使用すればよいかわからない場合は、次の公式ディレクトリを参照してください。

<!--
If you're not sure which plugin or theme to use, you can explore the official directories here:
 -->

- [WordPress プラグイン ディレクトリ](https://wordpress.org/plugins/)
- [WordPress テーマ ディレクトリ](https://wordpress.org/themes/)

<!--
-   [WordPress Plugin Directory](https://wordpress.org/plugins/)
-   [WordPress Theme Directory](https://wordpress.org/themes/)
 -->

URL のプラグインまたはテーマのスラッグを使用して、Playground 経由でそれらをプリインストールします。

<!--
Use the plugin or theme slug from the URL to preinstall theme via Playground.
 -->

クリック数を減らすために、URL に`plugin`または`theme`パラメータを追加することで、 WordPress プラグインディレクトリからプラグインやテーマをプリインストールできます。例えば、coblocks 　プラグインをインストールするには、次の URL を使用します。

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
 -->

https://playground.wordpress.net/?plugin=coblocks

または、`pendant` テーマをプリインストールするには、次の URL を使用します。

<!--
Or this URL to preinstall the `pendant` theme:
 -->

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
 -->

複数のテーマとプラグインをインストールしたい場合は、`theme`または`plugin`パラメータを繰り返すことができます:

https://playground.wordpress.net/?theme=pendant&theme=acai

これらのパラメータを組み合わせたり、複数のプラグインを追加したりすることもできます。

<!--
You can also mix and match these parameters and even add multiple plugins:
 -->

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

## サイトを保存する

<!--
## Save your site
 -->

WordPress Playground サイトを 1 回のブラウザ セッションよりも長く保存するには、`.zip` ファイルとしてエクスポートできます。

<!--
To keep your WordPress Playground site for longer than a single browser session, you can export it as a `.zip` file.
 -->

1. Playground サイト マネージャー パネルを開きます。

<!--
1. Open the Playground site manager panel:
 -->

![Site Manager](@site/static/img/site-manager/open-site-manager.webp)

2. 追加アクションメニューの「.zip としてダウンロード」ボタンを使用します。

<!--
2. Use the "Download as .zip" button in the additional actions menu
 -->

![Export button](@site/static/img/site-manager/export-zip-file.webp)

エクスポートされたファイルには、構築したサイト全体が含まれています。 PHP と SQLite をサポートするサーバーであればどこでもホストできます。 WordPress のコアファイル、プラグイン、テーマ、その他サイトに追加したすべてのファイルが含まれています。

<!--
The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there.
 -->

SQLite データベースファイルもエクスポートに含まれており、`wp-content/database/.ht.sqlite`にあります。ドットで始まるファイルは、ほとんどのオペレーティングシステムでデフォルトで非表示になっているため、ファイルマネージャーで「隠しファイルを表示する」オプションを有効にする必要がある場合があります。

<!--
The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager.
 -->

## 保存したサイトを復元する

<!--
## Restore a saved site
 -->

Playground ダッシュボードパネルの「.zip からインポート」ボタンを使用して、保存したサイトを復元できます。

<!--
You can restore the saved site using the "Import from .zip" button in the Playground dashboard panel:
 -->

<!--
1. Open the Playground dashboard panel:
 -->

1. Playground ダッシュボードパネルを開きます:

![Open Playground Dashboard](@site/static/img/dashboard/open-playground-dashboard.webp)

<!--
1. Use the "Import .zip" button at the end of the "Start a new Playground" section
 -->

1. 「Start a new Playground」セクションの最後にある「Import .zip」ボタンを使用します

![Open Playground Dashboard](@site/static/img/dashboard/import-playground.webp)

## 特定の WordPress または PHP バージョンを使用する

<!--
## Use a specific WordPress or PHP version
 -->

WordPress または PHP のバージョンを変更する最も迅速な方法は、[公式デモサイト](https://playground.wordpress.net/)の設定パネルを使用することです:

<!--
The quickest way to change the version of WordPress or PHP is by using the settings panel on the [official demo site](https://playground.wordpress.net/):
 -->

![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp)

:::info プラグインまたはテーマをテストする

数多くの WordPress および PHP バージョンとの互換性テストは、いつも面倒でした。 WordPress Playground を使えば、このプロセスが楽になります。ぜひご活用ください !

:::

<!--
:::info Test your plugin or theme

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

:::
 -->

また、`wp` および `php` [クエリパラメータ](/developers/apis/query-api) を使用して、適切なバージョンがすでにロードされた状態で Playground を開くこともできます。

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
 -->

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
  <ThisIsQueryApi />

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
 -->

デモのコンテンツ準備の詳細については、[デモのコンテンツ提供ガイド](/guides/providing-content-for-your-demo)を参照してください。

:::info メジャーバージョンのみ
`wp=6.2` や `php=8.1` のようなメジャーバージョンを指定すると、そのバージョンラインの最新リリースが期待されます。ただし、古いマイナーバージョンを指定することはできないため、`wp=6.1.2` や `php=7.4.9` は動作しません。
:::

<!--
:::info Major versions only

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work.
:::
 -->

## WXR ファイルをインポートする

<!--
## Import a WXR file
 -->

[/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php) に WXR ファイルをアップロードすることで、WordPress エクスポートファイルをインポートできます。

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
 -->

[JSON ブループリント](/blueprints)も使用できます。詳しくは[ブループリントの使い方](/blueprints/getting-started)をご覧ください。

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
 -->

これは上記のインポート機能とは異なります。インポート機能は、データベースを含むサイト全体をエクスポートします。このインポート機能は、 WXR ファイルを既存のサイトにインポートします。

<!--
This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site.
 -->

## WordPress Playground でアプリを構築する

<!--
## Build apps with WordPress Playground
 -->

WordPress Playground はプログラム可能なので、[WordPress アプリを構築](/developers/build-your-first-app)したり、プラグインのデモを設定したり、さらには設定不要の[ローカル開発環境](/developers/local-development/)として使用したりすることもできます。

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), setup plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
 -->

WordPress Playground を使用した開発の詳細については、[開発クイック スタート](/developers/build-your-first-app) セクションをご覧ください。

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
 -->
