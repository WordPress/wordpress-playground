---
title: トラブルシューティングとデバッグ
slug: /blueprints/troubleshoot-and-debug
---

# ブループリントのトラブルシューティングとデバッグ

<!--
# Troubleshoot and debug Blueprints
-->

ブループリントを作成する際に問題が発生する場合があります。デバッグに役立つヒントとツールをご紹介します。

<!--
When you build Blueprints, you might run into issues. Here are tips and tools to help you debug them:
-->

## よくある落とし穴を確認する

<!--
## Review Common gotchas
-->

-   `wp-load` を require する: `runPHP` ステップを使用して WordPress PHP 関数を実行するには、[wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php) を require する必要があります。そのため、`code` キーの値は `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"` で始まる必要があります。
-   `networking` を有効にする: wp.org アセット (テーマ、プラグイン、ブロック、パターン) にアクセスしたり、[add_editor_style()](https://developer.wordpress.org/reference/functions/add_editor_style/) を使用してスタイルシートを読み込むには (たとえば、[カスタム ブロック スタイルを作成する](https://developer.wordpress.org/news/2023/02/creating-custom-block-styles-in-wordpress-themes) 場合)、`networking` オプションを有効にする必要があります: `"features": {"networking": true}`。

<!--
-   Require `wp-load`: to run a WordPress PHP function using the `runPHP` step, you’d need to require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). So, the value of the `code` key should start with `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`.
-   Enable `networking`: to access wp.org assets (themes, plugins, blocks, or patterns), or load a stylesheet using [add_editor_style()](https://developer.wordpress.org/reference/functions/add_editor_style/) (say, when [creating a custom block style](https://developer.wordpress.org/news/2023/02/creating-custom-block-styles-in-wordpress-themes)), you’d need to enable the `networking` option: `"features": {"networking": true}`.
-->

## ブループリントビルダー

<!--
## Blueprints Builder
-->

ブラウザ内の [ブループリント エディタ](https://playground.wordpress.net/builder/builder.html) を使用して、ブラウザ内でブループリントをビルド、検証、プレビューできます。

<!--
You can use an in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to build, validate, and preview your Blueprints in the browser.
-->

:::danger 注意

エディタは現在開発中であり、埋め込まれたプレイグラウンドの読み込みに失敗する場合があります。回避するには、ページを更新してください。この問題は認識しており、改善に取り組んでいます。

:::

<!--
:::danger Caution

The editor is under development and the embedded Playground sometimes fails to load. To get around it, refresh the page. We're aware of that, and are working to improve the experience.

:::
-->

## ファイルシステムとデータベースを確認する

<!--
## Check for the Filesystem and Database
-->

一部のブループリント ステップ ([`writeFile`](/blueprints/steps#WriteFileStep) など) は、Playground インスタンスの内部ファイルシステム構造を変更し、その他のステップ ([`runSql`](/blueprints/steps#runSql) など) は、内部 WordPress データベースを変更します。

<!--
Some blueprint steps (such as [`writeFile`](/blueprints/steps#WriteFileStep)) alter the internal Filesystem structure of the Playground instance and some others (such as [`runSql`](/blueprints/steps#runSql)) alter the internal WordPress database.
-->

最終的な内部ファイルシステム構造とデータベースを確認するには (ブループリントの手順を適用した後)、[`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) や [`WPide`](https://wordpress.org/plugins/wpide/) などの SQL マネージャーとファイル エクスプローラーを提供するいくつかの WordPress プラグインを利用できます (https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide で動作を確認できます)。

<!--
To check the final internal filesystem structure and database (after the blueprint steps have been applied) we can leverage some WordPress plugins that provide a SQL manager and a file explorer such as [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and [`WPide`](https://wordpress.org/plugins/wpide/) (you can see them in action from https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide)
-->

:::tip

WordPress Playground インスタンスのコンソールから、インスタンスの内部を検査するためのメソッドが多数あります。これらは `window.playground` オブジェクトの一部として公開されています（[開発者 > JavaScript API > デバッグとテスト](/developers/apis/javascript-api/#debugging-and-testing) を参照）。いくつか例を挙げます。

```
> await playground.isDir("/wordpress/wp-content/plugins")
true
> await playground.listFiles("/wordpress/wp-content/plugins")
(3) ['hello.php', 'index.php', 'WordPress-Importer-master']
```

使用できるメソッドの完全なリストは[こちら](/api/client/interface/PlaygroundClient)で確認できます。

:::

<!--
:::tip

There are a bunch of methods we can launch from the console of any WordPress Playground instance to inspect the internals of that instance. They're exposed as part of `window.playground` object (see [Developers > JavaScript API > Debugging and testing](/developers/apis/javascript-api/#debugging-and-testing)). Some examples:

```
> await playground.isDir("/wordpress/wp-content/plugins")
true
> await playground.listFiles("/wordpress/wp-content/plugins")
(3) ['hello.php', 'index.php', 'WordPress-Importer-master']
```

Full list of methods we can use is available [here](/api/client/interface/PlaygroundClient)

:::
-->

## ブラウザコンソールでエラーを確認する

<!--
## Check for errors in the browser console
-->

ブループリントが期待どおりに実行されない場合は、ブラウザの開発者ツールを開いてエラーがないか確認してください。

<!--
If your Blueprint isn’t running as expected, open the browser developer tools to see if there are any errors.
-->

Chrome、Firefox、Safari\*、Edge で開発者ツールを開くには、Windows/Linux では `Ctrl + Shift + I`、macOS では `Cmd + Option + I` を押します。

<!--
To open the developer tools in Chrome, Firefox, Safari\*, and Edge: press `Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.
-->

:::caution

まだ有効にしていない場合は、開発メニューを有効にします。**Safari > 設定... > 詳細** に移動し、**Web 開発者向けの機能を表示** をオンにします。

:::

<!--
:::caution

If you haven't yet, enable the Develop menu: go to **Safari > Settings... > Advanced** and check **Show features for web developers**.

:::
-->

開発者ツールウィンドウでは、ネットワークリクエストの検査、コンソールログの表示、JavaScript のデバッグ、ウェブページに適用されている DOM と CSS スタイルの確認が可能です。これは、ブループリントの問題の診断と修正に不可欠です。

<!--
The developer tools window allows you to inspect network requests, view console logs, debug JavaScript, and examine the DOM and CSS styles applied to your webpage. This is crucial for diagnosing and fixing issues with Blueprints.
-->

## 独自のエラーメッセージをログに記録する

<!--
## Log your own error messages
-->

[`runPHP` ステップ](/blueprints/steps#RunPHPStep) を通じて独自のエラー メッセージを `error_log` し ([ブループリントの例](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) と [ライブ デモ](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json) を参照)、["ログの表示" オプション](/web-instance#playground-options-menu) またはブラウザーのコンソールから確認できます。

<!--
You can `error_log` your own error messages through [`runPHP` step](/blueprints/steps#RunPHPStep) (see [blueprint example](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) and check them from the ["View Logs" option](/web-instance#playground-options-menu) or from the browser's console.
-->

![Log errors snapshot](@site/static/img/blueprints/log-errors.webp)

:::info
[「zip としてダウンロード」オプション](/web-instance#playground-options-menu) を使用して Playground インスタンスを `zip` としてダウンロードすると、Playground インスタンスからのすべてのログを含む `debug.log` ファイルもダウンロードされます。
:::

<!--
:::info
When you download your Playground instance as a `zip` through the ["Download as zip" option](/web-instance#playground-options-menu) you'll also download the `debug.log` file containing all the logs from your Playground instance.
:::
-->

## 助けを求める

<!--
## Ask for help
-->

コミュニティが皆様をお待ちしています！ご質問やご意見がございましたら、このリポジトリで[新しい Issue を作成](https://github.com/adamziel/blueprints/issues)してください。以下の情報を必ずご記入ください。

<!--
The community is here to help! If you have questions or comments, [open a new issue](https://github.com/adamziel/blueprints/issues) in this repository. Remember to include the following details:
-->

-   実行しようとしているブループリント。
-   表示されているエラーメッセージ（ある場合）。
-   ブラウザ開発者ツールからの出力全文。
-   問題の理解に役立つ可能性のあるその他の関連情報（OS、ブラウザのバージョンなど）

<!--
-   The Blueprint you’re trying to run.
-   The error message you’re seeing, if any.
-   The full output from the browser developer tools.
-   Any other relevant information that might help us understand the issue: OS, browser version, etc.
-->
