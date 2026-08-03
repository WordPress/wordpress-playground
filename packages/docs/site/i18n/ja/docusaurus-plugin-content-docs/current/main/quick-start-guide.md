---
title: クイックスタートガイド
slug: /quick-start-guide
description: Playground を使い始めるための 5 分間ガイドです。プラグインやテーマのテスト、WordPress と PHP のバージョン変更について説明します。
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# 5 分で WordPress Playground を使い始める

<!--
WordPress Playground can help you with any of the following:
-->

WordPress Playground は、次のような用途に利用できます。

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

このページでは、それぞれの操作を説明します。動画で確認したい場合は、次の動画もご覧ください。動画内の一部のインターフェースは Dock 導入前のものです。現在の UI については、以下の手順に従ってください。

<!--
<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>
-->

<iframe width="752" height="423.2" title="WordPress Playground の利用を開始する" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## 新しい WordPress サイトを始める

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

[playground.wordpress.net の公式デモ](https://playground.wordpress.net/)を開くと、ブラウザ内で WordPress が起動します。

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

通常の WordPress サイトと同じように、ページの作成、プラグインのアップロード、テーマのインストール、コンテンツのインポートなど、ほとんどの操作を実行できます。

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

ブラウザストレージが利用できる場合、新しい Playground は自動保存されます。Dock の **Playground 一覧**には、最近の自動保存が最大 5 件表示されます。ページ更新時に破棄されるサイトが必要な場合は、`?storage=temp` を付けて Playground を開いてください。

<div class="callout callout-info">

<!--
**WordPress Playground is private**
-->

**WordPress Playground はプライベートです**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

Playground はブラウザ内でローカルに実行されます。**GitHub にエクスポート**などの操作を選択しない限り、サイトがアップロードされることはありません。作業が終わったら、Playground を永続的に保存する、ZIP としてエクスポートする、または**新しい Playground**からやり直すことができます。

</div>

<!--
## Try a block, a theme, or a plugin
-->

## ブロック、テーマ、プラグインを試す

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

[/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/) で、任意のプラグインやテーマをアップロードできます。

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

クリック操作を省くには、URL に `plugin` または `theme` パラメータを追加して、WordPress のプラグインディレクトリからプラグインやテーマを事前にインストールできます。たとえば、coblocks プラグインをインストールするには次の URL を使用します。

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

`pendant` テーマを事前にインストールする場合は、次の URL を使用します。

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

複数のテーマやプラグインをインストールするには、`theme` または `plugin` パラメータを繰り返し指定します。

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

これらのパラメータを組み合わせて、複数のプラグインを追加することもできます。

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

これは[クエリ API](/developers/apis/query-api/) と呼ばれます。詳しくは[クエリ API のドキュメント](/developers/apis/query-api/)をご覧ください。

<!--
## Store a Playground in browser storage
-->

## Playground をブラウザストレージに保存する

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

Dock の**自動保存済み**または**未保存**をクリックして**永続的に保存**を開き、**ブラウザストレージに保存**を選択します。

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Playground 名と保存ボタンが表示された「永続的に保存」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

ブラウザに保存した Playground は **Playground 一覧**に表示されます。自動保存も表示されますが、Playground が保持する最近の自動保存は最大 5 件です。自動保存の保持期間を超えて残したい Playground は永続的に保存してください。

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

ブラウザストレージはブラウザによって管理されます。移動、アーカイブ、後での復元が可能なファイルが必要な場合は、ZIP をエクスポートしてください。

<!--
## Export a portable ZIP
-->

## 持ち運べる ZIP をエクスポートする

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Dock から**エクスポート**を開き、**.zip としてダウンロード**を選択します。

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![「.zip としてダウンロード」が強調されたエクスポートパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

エクスポートしたファイルには、現在のファイル、データベース、プラグイン、テーマ、アップロード、編集内容が含まれます。Playground で復元するか、PHP と SQLite に対応したサーバーでホストできます。

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

SQLite データベースファイルは `wp-content/database/.ht.sqlite` にあります。多くのオペレーティングシステムでは、ドットで始まるファイルは標準で非表示になるため、ファイルマネージャーで隠しファイルを表示する設定が必要な場合があります。

<!--
## Restore a ZIP
-->

## ZIP を復元する

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Dock から**新しい Playground**を開き、**zip をインポート**を選択して ZIP ファイルを指定します。

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![「zip をインポート」が選択された「新しい Playground」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

ZIP に含まれるファイルとデータベースが、新しい Playground に復元されます。

<!--
## Use a specific WordPress or PHP version
-->

## 特定の WordPress または PHP バージョンを使用する

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

Dock の**サイト設定**を開き、WordPress、PHP、言語、マルチサイト、ネットワークのオプションを選択します。

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![サイト設定パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!--
**Test your plugin or theme**
-->

**プラグインやテーマをテストする**

<!--
Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

多数の WordPress と PHP バージョンを対象にした互換性テストには、これまで手間がかかっていました。WordPress Playground を使えば、この作業を簡単に行えます。

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

`wp` と `php` の[クエリパラメータ](/developers/apis/query-api)を使って、必要なバージョンを読み込んだ状態で Playground を開くこともできます。

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

これは[クエリ API](/developers/apis/query-api/) と呼ばれます。詳しくは[クエリ API のドキュメント](/developers/apis/query-api/)をご覧ください。

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

`php=next` を使うと、php-src の開発ブランチからビルドされた次の PHP バージョンをプレビューできます。例として、[PHP 8.6 機能プレビュー](https://playground.wordpress.net/php-8-6.html)をご覧ください。

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

デモ用のコンテンツを準備する方法については、[デモ用コンテンツの提供ガイド](/guides/providing-content-for-your-demo)をご覧ください。

<div class="callout callout-info">

<!--
**Major versions only**
-->

**メジャーバージョンのみ**

<!--
You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

`wp=6.2` や `php=8.1` のようにメジャーバージョンを指定すると、その系列の最新リリースが使用されます。`wp=6.1.2` や `php=7.4.9` のように、古いマイナーバージョンを指定することはできません。`latest` や `next` などの汎用エイリアスは例外です。

</div>

<!--
## Import a WXR file
-->

## WXR ファイルをインポートする

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

[/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php) で WXR ファイルをアップロードすると、WordPress のエクスポートファイルをインポートできます。

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

[JSON ブループリント](/blueprints)も使用できます。詳しくは[ブループリント入門](/blueprints/getting-started)をご覧ください。

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

これは Playground ZIP の復元とは異なります。WXR ファイルは既存サイトに WordPress コンテンツをインポートします。Playground ZIP は、ファイルとデータベースを新しい Playground に復元します。

<!--
## Build apps with WordPress Playground
-->

## WordPress Playground でアプリを構築する

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

WordPress Playground はプログラムから操作できます。[WordPress アプリを構築](/developers/build-your-first-app)したり、プラグインのデモをセットアップしたり、セットアップ不要の[ローカル開発環境](/developers/local-development/)として利用したりできます。

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

WordPress Playground を使った開発について詳しくは、[開発クイックスタート](/developers/build-your-first-app)をご覧ください。
