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

- `wp-load` を require する: `runPHP` ステップを使用して WordPress PHP 関数を実行するには、[wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php) を require する必要があります。そのため、`code` キーの値は `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"` で始まる必要があります。
- `networking` を有効にする: wp.org アセット (テーマ、プラグイン、ブロック、パターン) にアクセスしたり、[add_editor_style()](https://developer.wordpress.org/reference/functions/add_editor_style/) を使用してスタイルシートを読み込むには (たとえば、[カスタム ブロック スタイルを作成する](https://developer.wordpress.org/news/2023/02/creating-custom-block-styles-in-wordpress-themes) 場合)、`networking` オプションを有効にする必要があります: `"features": {"networking": true}`。

<!--
-   Require `wp-load`: to run a WordPress PHP function using the `runPHP` step, you’d need to require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). So, the value of the `code` key should start with `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`.
-   Enable `networking`: to access wp.org assets (themes, plugins, blocks, or patterns), or load a stylesheet using [add_editor_style()](https://developer.wordpress.org/reference/functions/add_editor_style/) (say, when [creating a custom block style](https://developer.wordpress.org/news/2023/02/creating-custom-block-styles-in-wordpress-themes)), you’d need to enable the `networking` option: `"features": {"networking": true}`.
-->

## デバッグツール

<!--
### Blueprints editor
-->

### ブループリントエディター

<!--
Use the in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html)
to build, validate, and preview Blueprints.
-->

ブラウザ内の[ブループリントエディター](https://playground.wordpress.net/builder/builder.html)を使って、ブループリントの作成、検証、プレビューを行います。

<div class="callout callout-warning">

<!--
**Caution**
-->

**注意**

<!--
The editor is under development and the embedded Playground sometimes fails to
load. To get around it, refresh the page.
-->

エディターは開発中であり、埋め込まれた Playground を読み込めない場合があります。その場合はページを更新してください。

</div>

<!--
### Filesystem and database inspection
-->

### ファイルシステムとデータベースを確認する

<!--
Some Blueprint steps, such as [`writeFile`](/blueprints/steps),
alter the internal filesystem. Others, such as
[`runSql`](/blueprints/steps), alter the database.
-->

[`writeFile`](/blueprints/steps) などのブループリントステップは内部ファイルシステムを変更します。[`runSql`](/blueprints/steps) などのステップはデータベースを変更します。

<!--
To inspect the final state, use **Files**, **Database**, and **Logs** from the Dock.
-->

最終状態を確認するには、Dock の**ファイル**、**データベース**、**ログ**を使います。

<!--
Use **Files** to confirm the Blueprint created, moved, or edited the expected files.
-->

**ファイル**では、ブループリントが想定したファイルを作成、移動、編集したことを確認できます。

<!--
![The Files pane showing a selected WordPress file and its contents](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![選択した WordPress ファイルとその内容を表示するファイルパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Use **Database** to inspect tables and records changed by SQL or WordPress steps.
-->

**データベース**では、SQL または WordPress のステップで変更されたテーブルやレコードを確認できます。

<!--
![The Database pane showing database inspection tools](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![データベース確認ツールを表示するデータベースパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
You can also inspect a Playground instance from the browser console through
`window.playground`:
-->

ブラウザコンソールから `window.playground` を使って Playground インスタンスを調べることもできます。

```js
await playground.isDir('/wordpress/wp-content/plugins');
await playground.listFiles('/wordpress/wp-content/plugins');
```

<!--
See the full [PlaygroundClient API](/api/client/interface/PlaygroundClient).
-->

詳しくは [PlaygroundClient API](/api/client/interface/PlaygroundClient) をご覧ください。

<!--
### Browser console and network requests
-->

### ブラウザコンソールとネットワークリクエスト

<!--
Open browser developer tools to check JavaScript errors, PHP debug logs, and
failed network requests. In Chrome, Firefox, and Edge, press
`Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.
-->

ブラウザの開発者ツールを開き、JavaScript エラー、PHP デバッグログ、失敗したネットワークリクエストを確認します。Chrome、Firefox、Edge では、Windows/Linux の場合は `Ctrl + Shift + I`、macOS の場合は `Cmd + Option + I` を押します。

<div class="callout callout-warning">

**Safari**

<!--
If you have not enabled the Develop menu, go to **Safari > Settings... >
Advanced** and check **Show features for web developers**.
-->

開発メニューを有効にしていない場合は、**Safari > 設定... > 詳細**を開き、**Web デベロッパ用の機能を表示**をオンにします。

</div>

<!--
### Custom error logging
-->

### 独自のエラーログ

<!--
You can write your own messages with `error_log()` in a
[`runPHP` step](/blueprints/steps), then check the Playground
**Logs** panel or the browser console.
-->

[`runPHP` ステップ](/blueprints/steps)で `error_log()` を使って独自のメッセージを記録し、Playground の**ログ**パネルまたはブラウザコンソールで確認できます。

<!--
![The PHP error log pane showing PHP log output](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![PHP ログ出力を表示する PHP エラーログパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<div class="callout callout-info">

<!--
When you download your Playground as a ZIP through **Export → Download as .zip**, the archive also includes `debug.log`.
-->

**エクスポート → .zip としてダウンロード**から Playground を ZIP としてダウンロードすると、アーカイブに `debug.log` も含まれます。

</div>

## 助けを求める

<!--
## Ask for help
-->

コミュニティが皆様をお待ちしています！ご質問やご意見がございましたら、このリポジトリで[新しい Issue を作成](https://github.com/adamziel/blueprints/issues)してください。以下の情報を必ずご記入ください。

<!--
The community is here to help! If you have questions or comments, [open a new issue](https://github.com/adamziel/blueprints/issues) in this repository. Remember to include the following details:
-->

- 実行しようとしているブループリント。
- 表示されているエラーメッセージ（ある場合）。
- ブラウザ開発者ツールからの出力全文。
- 問題の理解に役立つ可能性のあるその他の関連情報（OS、ブラウザのバージョンなど）

<!--
-   The Blueprint you’re trying to run.
-   The error message you’re seeing, if any.
-   The full output from the browser developer tools.
-   Any other relevant information that might help us understand the issue: OS, browser version, etc.
-->
