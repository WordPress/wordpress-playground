---
title: ウェブインスタンス
slug: /web-instance
description: Dock、データの保存、設定、サイトツールを含む、playground.wordpress.net のウェブインターフェースの詳細なガイドです。
---

<!--
# WordPress Playground web instance
-->

# WordPress Playground ウェブインスタンス

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) では、サーバーを使わずにブラウザ内で WordPress を実行できます。ページを開くと Playground が起動し、WordPress サイトとサイトツールをまとめた **Dock** が表示されます。

<!--
![The Playground web instance with the Dock visible at the bottom of the page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![ページ下部に Dock が表示された Playground ウェブインスタンス](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

Dock にはアドレス欄、保存状態、レイアウトコントロールがあり、Playground の作成、保存、調査、エクスポートに使う各ツールへアクセスできます。

<!--
## Customize Playground
-->

## Playground をカスタマイズする

<!--
The Dock includes these destinations:
-->

Dock には次のツールがあります。

<!--
- **New**: Start from the Blueprint gallery, a public Blueprint URL, a new
  Blueprint, a pull request preview, a GitHub repository, or an imported `.zip`
  file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language,
  networking, and multisite.
- **Database**: Inspect or download the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Inspect PHP errors, warnings, and notices.
- **Export**: Download a `.zip`, copy the original setup link, or export selected
  files to a GitHub pull request.
-->

- **新規**: ブループリントギャラリー、公開ブループリント URL、新しいブループリント、プルリクエストのプレビュー、GitHub リポジトリ、またはインポートした `.zip` ファイルから開始します。
- **Playground**: 最近使った Playground と保存済みの Playground を切り替えます。
- **ブループリント**: 現在のブループリントを表示、編集、エクスポート、実行します。
- **サイト設定**: WordPress と PHP のバージョン、言語、ネットワーク、マルチサイトを設定します。
- **データベース**: SQLite データベースの確認やダウンロード、データベースツールの起動を行います。
- **ファイル**: WordPress ファイルシステム内のファイルを参照、編集します。
- **ログ**: PHP のエラー、警告、通知を確認します。
- **エクスポート**: `.zip` のダウンロード、元のセットアップリンクのコピー、選択したファイルの GitHub プルリクエストへのエクスポートを行います。

<!--
## Navigate inside WordPress
-->

## WordPress 内を移動する

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

Dock のアドレス欄を使うと、現在の WordPress サイト内のパスを開けます。たとえば、`/wp-admin/` と入力するとダッシュボードが、`/wp-admin/plugins.php` と入力するとプラグイン画面が開きます。**ページを更新**を使うと、現在の WordPress パスが再読み込みされます。

<!--
![The Refresh page button in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)
-->

![Dock の「ページを更新」ボタン](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

[クエリパラメータ API](/developers/apis/query-api/) を使って、特定の WordPress バージョン、PHP バージョン、プラグイン、テーマ、ブループリントなどのセットアップで Playground を開くこともできます。

<!--
## Understand the save status
-->

## 保存状態を理解する

<!--
The status next to the address field tells you how the current Playground is stored:
-->

アドレス欄の隣にあるステータスは、現在の Playground の保存方法を示します。

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- **自動保存済み**: Playground はこのブラウザに保存され、**Playground 一覧**から復元できます。最近の自動保存は最大 5 件保持されます。
- **保存済み**: Playground はブラウザストレージに永続的に保存されたか、ローカルディレクトリに保存されています。
- **未保存**: Playground は保存されていません。`?storage=temp` を含む一時的な Playground は、タブを閉じるかブラウザページを更新すると失われます。

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

**自動保存済み**または**未保存**をクリックすると、**永続的に保存**が開きます。

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Playground 名と保存ボタンが表示された「永続的に保存」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

**永続的に保存**を使うと、自動保存された Playground をブラウザストレージに保持し、自動保存の整理対象から外せます。File System Access API に対応したブラウザでは、ローカルディレクトリにも保存できます。

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

ブラウザストレージはブラウザによって管理されます。容量不足やプライバシー設定によって、保存データが削除される場合があります。持ち運べるバックアップが必要な場合は ZIP をエクスポートしてください。

<!--
## Start a Playground
-->

## Playground を開始する

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Dock の**新規**をクリックして、**新しい Playground** を開きます。パネルには**ブループリントギャラリー**、**URL から**、**ブループリントを作成**、**PR をプレビュー**、**GitHub から**、**zip をインポート**があります。

<!--
![The New Playground pane with the Blueprint gallery selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![ブループリントギャラリーが選択された「新しい Playground」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

ブループリントギャラリーの先頭にある **Vanilla WordPress** では、まっさらな WordPress を作成できます。**URL から**は公開ブループリント URL を開き、**ブループリントを作成**は新しいブループリント用のエディターを開きます。**zip をインポート**は Playground からエクスポートした ZIP を復元します。

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![「zip をインポート」が選択された「新しい Playground」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## 最近使った Playground と保存済みの Playground に戻る

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Dock の **Playground** をクリックして、**Playground 一覧**を開きます。現在の Playground、最近の自動保存、永続的に保存した Playground が表示されます。

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![現在の Playground が表示された「Playground 一覧」パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

自動保存された Playground は復元ポイントです。最近の自動保存は最大 5 件保持されます。残しておきたいものは**永続的に保存**を使って保存済み Playground にしてください。

<!--
## Change site settings
-->

## サイト設定を変更する

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

**サイト設定**を開いて、ランタイムと WordPress のセットアップオプションを変更します。

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![サイト設定パネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

PHP バージョンとネットワーク設定は、保存済みの Playground に適用できます。WordPress バージョン、言語、マルチサイトは WordPress のインストール自体を変更するため、新しい Playground が必要です。

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

編集したブループリントを実行しても、保存済みおよび自動保存済みの Playground は保持されます。一時的な Playground は新しいセットアップで置き換えられます。

<!--
## Inspect the current Blueprint
-->

## 現在のブループリントを確認する

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

**ブループリント**を開くと、現在の Playground のブループリントを表示、編集できます。

<!--
![The Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![ブループリントエディターパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

編集したブループリントは新しい Playground で実行できます。保存済みまたは自動保存済みの Playground は、元の状態のまま **Playground 一覧**に残ります。

<!--
## Inspect files, database, and logs
-->

## ファイル、データベース、ログを確認する

<!--
Open **Files** to browse and edit the current Playground files.
-->

**ファイル**を開くと、現在の Playground のファイルを参照、編集できます。

<!--
![The Files pane with a WordPress file selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![WordPress ファイルが選択されたファイルパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

**データベース**を開くと、データベースツールを使用したり、SQLite データベースをダウンロードしたりできます。

<!--
![The Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![データベースパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

**ログ**を開くと、PHP のエラー、警告、通知を確認できます。

<!--
![The PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![PHP エラーログパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## エクスポートと共有 {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

**エクスポート**を開くと、現在の Playground をダウンロードまたは共有できます。

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![「.zip としてダウンロード」が強調されたエクスポートパネル](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

**.zip としてダウンロード**は、現在のファイル、データベース、プラグイン、テーマ、アップロード、編集内容をエクスポートします。ZIP は後で**新規 → zip をインポート**から復元できます。

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

**元のセットアップリンクをコピー**は、最初のセットアップだけを再現するリンクをコピーします。Playground の開始後に行った編集は含まれません。

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

**GitHub にエクスポート**は、現在の Playground から選択したファイルでプルリクエストを作成できます。

<!--
## Change the Dock layout
-->

## Dock のレイアウトを変更する

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

Dock は、フローティングパネルまたは全幅バーとして表示できます。レイアウトを切り替えるには**全幅**を使います。

<!--
| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![The full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |
-->

| フローティング                                                                                                                                                        | 全幅                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![標準のフローティング Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![全幅の Dock レイアウト](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

**ツールを非表示**を使うと、Dock がアドレス欄と保存状態だけに折りたたまれます。**ツールを表示**でツール行を再度開けます。

<!--
![The Playground with Dock tools hidden](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)
-->

![ツールが非表示になった Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

デスクトップではフローティング Dock をドラッグできます。左端または右端より外側へドラッグするとコーナーランチャーに折りたたまれ、ランチャーをクリックすると Dock に戻ります。

<!--
![The Dock folded into the corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)
-->

![コーナーランチャーに折りたたまれた Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

画面幅が狭い場合、Dock は全幅のモバイルレイアウトになります。

<!--
![The Dock on a mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)
-->

![モバイル表示の Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

https://playground.wordpress.net はコミュニティを支援するために提供されていますが、トラフィックが大幅に増えた場合も動作し続ける保証はありません。

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

一定の可用性が必要な場合は、[独自の WordPress Playground をホスト](/developers/architecture/host-your-own-playground)してください。

</div>
