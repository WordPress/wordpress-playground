---
title: Troubleshooting
slug: /troubleshooting
description: Diagnose common WordPress Playground website errors, including boot failures, SQLite issues, browser storage, and saved Playground recovery.
---

# WordPress Playground のトラブルシューティング

<!--
# Troubleshooting WordPress Playground
-->

このページでは、Playground ウェブサイト自体、保存された Playground、ブラウザストレージ、およびWordPress の起動時に発生するエラーについて扱います。Blueprint 固有のエラーについては、「[Blueprintのトラブルシューティングとデバッグ](/blueprints/troubleshoot-and-debug)」を参照してください。

<!--
This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).
-->

## プレイグラウンドが壊れているようです

<!--
## Playground looks broken
-->

まずはこれらを試してみてください：

<!--
Try these first:
-->

- Playground の**ページを更新（Refresh page）**ボタンを使用してください。ブラウザの更新機能（Cmd+RやF5キーなど）を使うと、Playground アプリ全体が再起動してしまいます。
- プライベートウィンドウで同じURLを開き、保存されたサイトデータやブラウザのストレージ状態が影響していないか確認してください。
- JavaScript、WebAssembly、ストレージ、Webワーカー、またはネットワークリクエストをブロックするブラウザ拡張機能は無効にしてください。
- ブラウザの開発者ツールを開き、コンソール（Console）やネットワーク（Network）タブにエラーが表示されていないか確認してください。
- URLに `?site-slug=...` が含まれている場合は、そのクエリパラメータを削除して、新しく自動保存される Playground を開始してみてください。完全に一時的なサイトが必要な場合は、`?storage=temp` を使用してください。

<!--
- Use the Playground **Refresh page** button instead of refreshing the browser tab. Browser refresh (Cmd+R or F5) starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a new autosaved Playground. Use `?storage=temp` when you need a truly temporary site.
-->

## クリーンなサイトで、MySQL 拡張機能が不足していると表示される

<!--
## A clean site says the MySQL extension is missing
-->

次のような WordPress エラーページが表示されることがあります。

<!--
You may see a WordPress error page like this:
-->

```text
お使いの PHP 環境には、WordPress で必要とされる MySQL 拡張機能が不足しているようです。
```

<!--
```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```
-->

Playground において、これは通常、WordPress が SQLite 統合を読み込めていないことを意味します。この統合により、WordPress は MySQL なしで動作できるようになります。Playground は WordPress を WebAssembly 上で実行し、MySQL サーバーの代わりに SQLite を使用します。

<!--
In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.
-->

以下の手順を試してみてください：

<!--
Try these steps:
-->

- https://playground.wordpress.net/ にて新しい Playground を起動し、公開サイトが正常に読み込まれるか確認してください。
- URL に保存済みのサイト情報が含まれている場合は、`?site-slug=...` の部分を削除して、新しいPlayground を読み込み直してください。一時的なサイトが必要な場合にのみ、`?storage=temp` を追加します。
- ZIP ファイルのインポート後にこの問題が発生した場合は、インポートしたデータに、Playground のSQLite 設定を上書きしてしまうようなカスタムの `wp-content/db.php` が含まれていないか確認してください。
- CLI 環境でこの問題が発生した場合は、独自のデータベース統合を実装している場合を除き、`--skip-sqlite-setup` オプションは使用しないでください。
- Blueprint を使用している際にこの問題が発生した場合は、[Blueprintのトラブルシューティングおよびデバッグに関するページ](/blueprints/troubleshoot-and-debug) を参照してください。

<!--
- Start a fresh Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new Playground. Add `?storage=temp` only when you need an ephemeral site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).
-->

Blueprint を作成する際に SQLite 統合プラグインを追加する必要がある場合、
`plugins`はトップレベルに記述します。

<!--
If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:
-->

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

## SQLite データベースへの接続エラー

<!--
## Error connecting to the SQLite database
-->

これは、Playground が SQLite 統合を読み込んだものの、WordPress が依然としてデータベースに接続できなかったことを意味します。

<!--
This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.
-->

一般的な原因:

<!--
Common causes:
-->

- 保存された Playground のブラウザストレージが古いか、不完全な状態です。
- インポートしたサイトの ZIP ファイルに、互換性のないデータベースファイルやデータベース用ドロップインが含まれています。
- マウントされたローカルディレクトリに、WordPress の動作に必要なファイルが不足しています。
- ブラウザストレージが削除されたか、破棄されたか、あるいはブロックされています。

<!--
- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.
-->

推奨される回復：

<!--
Recommended recovery:
-->

1. `site-slug` を指定せずに、新しい Playground を起動します。
2. 新しいサイトが正常に動作する場合、問題は保存済みのサイト、またはインポートしたアーカイブに関連しています。
3. 正常に動作しない保存済みサイトから、アクセス可能なファイルをエクスポートします。これには**ファイル**機能や**エクスポート**機能を使用するか、可能であればローカルディレクトリをコピーしてください。
4. そのサイトを新しい Playground に再度インポートするか、Blueprint を使用して再構築します。

<!--
1. Start a fresh Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export accessible files from the broken saved site using **Files**, **Export**, or a local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.
-->

## NotAllowedError

<!--
## NotAllowedError
-->

`NotAllowedError` は通常、ユーザーの許可が必要な操作や、対応するブラウザコンテキストが必要な操作が、ブラウザによってブロックされたことを意味します。Playground においては、これは多くの場合、保存されたサイトやローカルディレクトリへのアクセスに関連しています。

<!--
`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.
-->

次のようなメッセージが表示されることがあります：

<!--
You may see this exact message:
-->

```text
現在のコンテキストにおいて、ユーザーエージェントまたはプラットフォームによってそのリクエストは許可されていません。
```

<!--
```text
The request is not allowed by the user agent or the platform in the current context.
```
-->

試す：

<!--
Try:
-->

- Playground は、制限付きの iframe 内ではなく、通常のブラウザのトップレベルタブで開いてください。
- Dock 内の**Your Playgrounds**からサイトを再度開いてください。
- ローカルディレクトリを使用していた場合、保存されていた権限の有効期限が切れると、Playground 側でそのディレクトリを再選択することはできません。ファイルはディスク上に残っているため、それらを直接利用するか、エクスポート済みの ZIP ファイルや Blueprint（利用可能な場合）から Playground を再作成してください。
- 使用しているファイル API やストレージ API に、お使いのブラウザが対応しているか確認してください。一般的に、Chrome や Edge はローカルディレクトリへの対応範囲が最も広くなっています。
- プライベートブラウジングモード、企業ポリシー、またはブラウザの設定によって、ストレージへのアクセスがブロックされていないか確認してください。

<!--
- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from **Your Playgrounds** in the Dock.
- If the site used a local directory, Playground cannot currently re-select the directory after its saved permission expires. The files remain on disk; use them directly or recreate the Playground from an exported ZIP or Blueprint, if available.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.
-->

## NoModificationAllowedError

<!--
## NoModificationAllowedError
-->

`NoModificationAllowedError` は、ブラウザまたはファイルシステムが書き込みを拒否したことを意味します。
これは、保存済みのローカルディレクトリが読み取り専用になった場合や、権限が失われた場合、あるいはブラウザのストレージが利用できない場合などに発生することがあります。

<!--
`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.
-->

次のようなメッセージが表示されることがあります：

<!--
You may see this exact message:
-->

```text
基盤となるファイルシステムの状態が原因で変更できないファイルまたはディレクトリに対して、書き込みを試みました。
```

<!--
```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```
-->

試す:

<!--
Try:
-->

- Playground がまだ開ける状態であれば、最初からやり直す前に**Export（エクスポート）」→「Download as .zip（.zipとしてダウンロード）**を実行してください。
- 対象のフォルダが存在し、かつ書き込み可能であることを確認してください。
- システムによって保護されているフォルダや、ファイルが一時的にロックされる可能性のある同期対象フォルダは避けてください。
- 一時的なテスト環境が必要な場合は、`?storage=temp` を指定して新しい Playground を起動してください。
- ファイルシステムの永続性が確実に求められるローカル開発を行う場合は、[Playground CLI](/developers/local-development/wp-playground-cli) を使用してください。

<!--
- If the Playground still opens, use **Export → Download as .zip** before starting over.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh Playground with `?storage=temp` if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.
-->

## 保存済みのプレイグラウンドを再読み込みできません

<!--
## Saved Playground cannot reload
-->

保存されたプレイグラウンドは、ブラウザのストレージ、または指定したローカルディレクトリに格納されます。これらはリモートサーバー上にはホストされません。

<!--
Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.
-->

保存済みのプレイグラウンドを再読み込みできない場合：

<!--
If a saved Playground cannot reload:
-->

- 保存時に使用したものと同じブラウザおよびブラウザプロファイルを使用しているか確認してください。
- ブラウザデータが削除されていないか、ストレージが無効になっていないか確認してください。
- サイトがローカルディレクトリに保存されている場合は、そのディレクトリが現在も存在し、移動されていないことを確認してください。
- URL に `?site-slug=...` が含まれている場合は、それを削除して、自動保存された Playground を新規に開始してください。
- ストレージが失われた場合は、元の Blueprint からサイトを再作成するか、ZIP ファイルをインポートしてください。

<!--
- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh autosaved Playground.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.
-->

## ブラウザストレージと永続性

<!--
## Browser storage and persistence
-->

新しいプレイグラウンドは、ブラウザーのストレージと保存が利用可能な場合に自動保存されます。最近の自動保存または保存されたプレイグラウンドを復元するには、Dock で **あなたのプレイグラウンド** を開きます。 Playground には、最近の自動保存が最大 5 つ保存されます。

<!--
New Playgrounds are autosaved when browser storage and saving are available. Open **Your Playgrounds** in the Dock to recover recent autosaves or saved Playgrounds. Playground keeps up to five recent autosaves.
-->

Dock 内の**自動保存済み（Autosaved）**または**未保存（Unsaved）**というステータスをクリックすると、保存先の選択肢が表示されます。**ブラウザストレージに保存（Save in browser storage）**を選択するか、**ローカルディレクトリに保存（Save in a local directory）**を選択してその Playground 専用のディレクトリを指定し、**保存（Save）**をクリックしてください。指定したディレクトリ内に同名のファイルがある場合、上書きされる可能性があります。**エクスポート（Export）**機能を使うと、データをZIP形式でダウンロードできます。ブラウザを再読み込み（リフレッシュ）しても、保存済みまたは自動保存された Playground は復元されますが、`?storage=temp` を指定して作成した一時的な Playground は、再読み込みやタブを閉じた際に破棄されます。

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open the storage
choices. Select **Save in browser storage**, or select **Save in a local
directory** and choose a directory dedicated to that Playground before
clicking **Save**. Matching files in the directory may be overwritten. Use
**Export** to download a portable ZIP. A browser refresh can recover a stored
or autosaved Playground, but `?storage=temp` creates a temporary Playground
that is discarded on refresh or tab close.
-->

長期的なローカル開発を行う場合は、サイトのファイルをディスク上に保持できる [Playground CLI](/developers/local-development/wp-playground-cli) の利用をお勧めします。

<!--
For longer-running local development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli), which persists site files on disk.
-->

現在の Dock の送信先およびエクスポートのワークフローについては、[Dockガイド](/web-instance)を参照してください。

<!--
See [the Dock guide](/web-instance) for the current Dock destinations and export workflow.
-->

## 一からやり直すタイミング

<!--
## When to start fresh
-->

次のような場合には、新しいプレイグラウンドを開始してください：

<!--
Start a fresh Playground when:
-->

- 公開されている Playground サイトが正常に動作しているかどうかを確認するだけでよい場合。
- URL が、読み込めなくなった保存済みの「サイトスラッグ（site-slug）」を指している場合。
- エラーの原因が Playground 自体にあるのか、それともプラグイン、テーマ、Blueprint、あるいはインポートしたサイトにあるのかをデバッグする場合。
- ブラウザストレージやローカルディレクトリへのアクセスに問題がある疑いがある場合。

<!--
- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.
-->

すっきりとしたサイトを表示するには、この URL を使用してください：

<!--
Use this URL for a clean site:
-->

```text
https://playground.wordpress.net/
```

## プレイグラウンドの問題を報告する

<!--
## Report a Playground issue
-->

新規の Playground で問題が再現する場合は、
[issueをオープン](https://github.com/WordPress/wordpress-playground/issues)して、以下の情報を含めてください。

<!--
If the problem reproduces on a fresh Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:
-->

- Playground の完全な URL。
- ブラウザおよびオペレーティングシステム。
- 保存済みのサイト、インポートした ZIP、Blueprint、ローカルディレクトリ、CLIのいずれを使用したか。
- 正確なエラー名およびエラーメッセージ。
- ブラウザの開発者ツールにおけるコンソール（Console）およびネットワーク（Network）の情報。

<!--
- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
-->
