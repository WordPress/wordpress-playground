---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

<!--
# Playground CLI
-->

# Playground CLI

<!--
[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment.
-->

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) は、WordPress の開発とテストのフローを簡素化するコマンドラインツールです。Playground CLI は、プラグイン、テーマ、または WordPress インストールを含むディレクトリの自動マウントをサポートしています。柔軟性が必要な場合は、CLI のマウントコマンドでローカル環境をカスタマイズできます。

<!--
**Key features:**
-->

**主な機能:**

<!--
- **Quick Setup**: Set up a local WordPress environment in seconds.
- **Flexibility**: Allows for configuration to adapt to different scenarios.
- **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it.
-->

- **クイックセットアップ**: 数秒でローカル WordPress 環境をセットアップできます。
- **柔軟性**: さまざまなシナリオに合わせて設定を調整できます。
- **シンプルな環境**: 追加設定は不要で、互換性のある Node バージョンがあればすぐに使えます。

<!--
The Playground CLI includes two main commands for running WordPress locally:

- **`start`** (Simplified): Auto-detects your project type, persists sites between sessions, and opens a browser automatically.
- **`server`** (Advanced): Provides full manual control over configuration. Best for custom setups, CI/CD pipelines, or when you need fine-grained control.
-->

Playground CLI には、WordPress をローカルで実行するための 2 つのメインコマンドがあります:

- **`start`** (簡易): プロジェクトタイプを自動検出し、セッション間でサイトを永続化し、ブラウザを自動で開きます。
- **`server`** (詳細): 設定を完全に手動で制御します。カスタム設定、CI/CD パイプライン、きめ細かい制御が必要な場合に最適です。

<!--
## Requirements
-->

## 要件

<!--
The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).
-->

Playground CLI には Node.js 20.18 以降が必要です（推奨は LTS 版）。[Node.js のウェブサイト](https://nodejs.org/en/download)からダウンロードできます。

<!--
## Quickstart
-->

## クイックスタート

<!--
To run the Playground CLI, open a command line and use one of the following commands:
-->

Playground CLI を実行するには、コマンドラインを開き、次のいずれかのコマンドを使用します。

<!--
### Using `start` (Simplified)
-->

### `start` を使う（簡易）

<!--
The `start` command is the easiest way to get started. It automatically detects your project type, persists your site, and opens the browser:
-->

`start` コマンドがもっとも手軽に始められます。プロジェクトタイプを自動検出し、サイトを永続化し、ブラウザを開きます。

```bash
npx @wp-playground/cli@latest start
```

<!--
When run inside a plugin or theme directory, `start` automatically mounts your project:
-->

プラグインまたはテーマのディレクトリ内で実行すると、`start` はプロジェクトを自動でマウントします。

```bash
cd my-plugin
npx @wp-playground/cli@latest start
```

<!--
**Key differences from `server`:**

- Auto-login is enabled by default
- Opens browser automatically
- Auto-mounts the project by default
-->

**`server` との主な違い:**

- 自動ログインがデフォルトで有効
- ブラウザを自動で開く
- プロジェクトをデフォルトで自動マウント

<!--
### Using `server` (Advanced)
-->

### `server` を使う（詳細）

<!--
The `server` command provides full control over configuration:
-->

`server` コマンドでは設定を完全に制御できます。

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI in Action](@site/static/img/developers/npx-wp-playground-server.gif)

<!--
**Automatic site persistence:** By default, the `start` command keeps your WordPress site persistent across sessions. Your files and database are stored in `~/.wordpress-playground/sites/<path-hash>/`, where `<path-hash>` is derived from your project directory. This means you can stop and restart the CLI without losing your work.
-->

**サイトの自動永続化:** デフォルトでは、`start` コマンドは WordPress サイトをセッション間で永続化します。ファイルとデータベースは `~/.wordpress-playground/sites/<path-hash>/` に保存され、`<path-hash>` はプロジェクトディレクトリから導出されます。CLI を停止して再起動しても作業内容は失われません。

<!--
This is useful when:

- You want a clean WordPress installation
- Testing fresh installation scenarios
- Your site data became corrupted or inconsistent
-->

次のような場合に便利です:

- クリーンな WordPress インストールが欲しいとき
- 新規インストールのシナリオをテストするとき
- サイトデータが破損または不整合になったとき

<!--
:::info
The `--reset` flag works only with `start`. For `server`, manually delete the persisted site directory at `~/.wordpress-playground/sites/<path-hash>/`.
:::
-->

:::info
`--reset` フラグは `start` でのみ有効です。`server` の場合は、`~/.wordpress-playground/sites/<path-hash>/` の永続化サイトディレクトリを手動で削除してください。
:::

<!--
### Choosing a WordPress and PHP Version
-->

### WordPress と PHP のバージョンを選ぶ

<!--
By default, the CLI loads the latest stable version of WordPress and PHP 8.3 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:
-->

デフォルトでは、CLI はパフォーマンスのため WordPress と PHP 8.3 の最新安定版を読み込みます。希望のバージョンは `--wp=<version>` と `--php=<version>` で指定できます。

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.3
```

<!--
### Loading Blueprints
-->

### ブループリントの読み込み

<!--
One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). For those unfamiliar with this technology, it allows developers to configure the initial state for their WordPress Playground instances.
-->

Playground CLI の開発体験を一段階上げる方法の一つが [Blueprints](/blueprints/getting-started/) との統合です。この技術では、WordPress Playground インスタンスの初期状態を開発者が設定できます。

<!--
Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We'll use the example below to do this.
-->

`--blueprint=<blueprint-address>` フラグで、カスタム初期状態の Playground を実行できます。以下はその例です。

**(my-blueprint.json)**

```bash
{
  "landingPage": "/wp-admin/options-general.php?page=akismet-key-config",
  "login": true,
  "plugins": [
    "hello-dolly",
    "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
  ]
}
```

<!--
CLI command loading a blueprint:
-->

ブループリントを読み込む CLI コマンド:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

<!--
### Mounting folders manually
-->

### フォルダの手動マウント

<!--
Some projects have a specific structure that requires a custom configuration; for example, your repository contains all the files in the `/wp-content/` folder. So in this scenario, you can specify to the Playground CLI that it will mount your project from that folder using the `--mount` flag.
-->

プロジェクトによっては、カスタム設定が必要な構造になっています。たとえばリポジトリに `/wp-content/` 以下のファイルがすべて含まれている場合、`--mount` フラグでそのフォルダからプロジェクトをマウントするよう指定できます。

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

<!--
### Mounting before WordPress installation
-->

### WordPress インストール前のマウント

<!--
Consider mounting your WordPress project files before the WordPress installation begins. This approach is beneficial if you want to override the Playground boot process, as it can help connect Playground with `WP-CLI`. The `--mount-before-install` flag supports this process.
-->

WordPress のインストール開始前に、プロジェクトファイルをマウントする方法もあります。Playground の起動プロセスを上書きしたい場合や、Playground と `WP-CLI` を連携させたい場合に有効です。`--mount-before-install` フラグで指定します。

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

<!--
:::info
On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format: `"/host/path"` `"/vfs/path"`.
:::
-->

:::info
Windows では、パス形式 `/host/path:/vfs/path` が問題になることがあります。その場合は `--mount-dir` と `--mount-dir-before-install` を使い、`"/host/path"` `"/vfs/path"` の形式でホストと仮想ファイルシステムのパスを指定してください。
:::

<!--
### Understanding Data Persistence and SQLite Location in `server` mode
-->

### `server` モードでのデータ永続化と SQLite の場所

<!--
By default, Playground CLI stores WordPress files and the SQLite database in **temporary directories on your operating system**:
-->

デフォルトでは、Playground CLI は WordPress のファイルと SQLite データベースを **OS の一時ディレクトリ** に保存します。

```
<OS-TEMP-DIR>/playground-<random-id>/
├── wordpress/          # WordPress インストール
├── internal/           # Playground ランタイム設定
└── tmp/                # PHP 一時ファイル
```

<!--
**Finding Your Temp Directory:**

The actual location depends on your OS (these are examples or common possibilities):

- **macOS/Linux**: May be under `/tmp/` or `/private/var/folders/` (varies by system)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

To see the exact temp directory path being used, run the CLI with the `--verbosity=debug` flag:
-->

**一時ディレクトリの場所:**

実際の場所は OS によって異なります（例）:

- **macOS/Linux**: `/tmp/` または `/private/var/folders/` の下
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

使用中の一時ディレクトリのパスを確認するには、`--verbosity=debug` を付けて CLI を実行します。

```bash
npx @wp-playground/cli@latest server --verbosity=debug
```

<!--
This will output something like:
-->

出力例:

```
Native temp dir for VFS root:
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC
Mount before WP install: /home ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/home
Mount before WP install: /tmp ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/tmp
Mount before WP install: /wordpress ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/wordpress
```

<!--
**Where is the SQLite Database Stored?**

The database location depends on what you mount:

- **Auto-mounting wp-content or full WordPress**:
    - Database: `<your-local-project>/wp-content/database/.ht.sqlite`
    - ✅ **Persisted locally** in your project folder

- **Auto-mounting plugin/theme only**:
    - Database: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ **Lost when server stops** (temp directories are cleaned up)

- **Custom mounts**: Database location follows your mount configuration

**Automatic Cleanup:**
Playground CLI automatically removes temp directories that are:

- Older than 2 days
- No longer associated with a running process

**Recommendation:** To persist both your code and database when developing plugins or themes, mount the entire `wp-content` directory instead of just the plugin/theme folder.
-->

**SQLite データベースの保存場所**

マウント内容によってデータベースの場所が変わります:

- **wp-content または WordPress 全体の自動マウント**:
    - データベース: `<プロジェクト>/wp-content/database/.ht.sqlite`
    - ✅ プロジェクトフォルダに **ローカル永続化**

- **プラグイン/テーマのみ自動マウント**:
    - データベース: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ サーバー停止時に **削除**（一時ディレクトリはクリーンアップされる）

- **カスタムマウント**: マウント設定に従う

**自動クリーンアップ:** Playground CLI は次の一時ディレクトリを自動削除します:

- 2 日以上経過したもの
- 実行中プロセスに紐づいていないもの

**推奨:** プラグインやテーマ開発でコードとデータベースの両方を永続化するには、プラグイン/テーマフォルダだけでなく `wp-content` 全体をマウントしてください。

<!--
**Example: Mounting wp-content for persistence**
-->

**例: 永続化のため wp-content をマウント**

```bash
# Mount your entire wp-content directory
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount=./wp-content:/wordpress/wp-content
```

<!--
### Data Persistence in `start` mode
-->

### `start` モードでのデータ永続化

<!--
Running in `start` mode, Playground CLI **automatically persists** your WordPress site in a dedicated directory:
-->

`start` モードでは、Playground CLI は WordPress サイトを **専用ディレクトリに自動で永続化** します。

```
~/.wordpress-playground/sites/<path-hash>/
├── wordpress/          # WordPress インストール
├── internal/           # Playground ランタイム設定
└── tmp/                # PHP 一時ファイル
```

<!--
The `<path-hash>` is derived from your project directory path. This ensures isolation between different projects while persisting changes automatically.
-->

`<path-hash>` はプロジェクトディレクトリのパスから導出されます。これでプロジェクト間が分離されつつ、変更が自動で永続化されます。

<!--
#### Persistence behavior

- **Default (no explicit mount)**: WordPress files and database persist in `~/.wordpress-playground/sites/<path-hash>/`. Changes survive between CLI restarts.
- **Explicit `/wordpress` mount**: If you provide a mount path for `/wordpress`, automatic persistence is skipped. Your mount configuration takes precedence.

The database location depends on your configuration:

- **Default (automatic persistence)**:
    - Database: `~/.wordpress-playground/sites/<path-hash>/wordpress/wp-content/database/.ht.sqlite`
    - **Persisted automatically** between sessions
-->

#### 永続化の挙動

- **デフォルト（明示的マウントなし）**: WordPress のファイルとデータベースは `~/.wordpress-playground/sites/<path-hash>/` に永続化され、CLI の再起動後も保持されます。
- **`/wordpress` の明示的マウント**: `/wordpress` のマウントパスを指定した場合、自動永続化は行われず、マウント設定が優先されます。

データベースの場所は設定により異なります:

- **デフォルト（自動永続化）**:
    - データベース: `~/.wordpress-playground/sites/<path-hash>/wordpress/wp-content/database/.ht.sqlite`
    - セッション間で **自動永続化**

<!--
#### Resetting a persisted site
-->

#### 永続化サイトのリセット

<!--
To start fresh, use the `--reset` flag with the `start` command:
-->

最初からやり直すには、`start` コマンドに `--reset` フラグを付けます。

```bash
npx @wp-playground/cli@latest start --reset
```

<!--
## Command and Arguments
-->

## コマンドと引数

<!--
Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

- **`start`**: (Simplified) Starts a local WordPress server with automatic project detection, site persistence, and browser opening.
- **`server`**: (Advanced) Starts a local WordPress server with full manual control over configuration.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.

The `start` command has a dedicated argument:

- `--reset`: Delete the stored site and start fresh. Defaults to false.

The `server` command supports the following optional arguments:
-->

Playground CLI はシンプルで設定しやすく、決めつけがありません。WordPress の構成に合わせて設定できます。トップレベルのコマンドは次のとおりです。

- **`start`**: (簡易) プロジェクトの自動検出・サイト永続化・ブラウザ起動でローカル WordPress サーバーを起動します。
- **`server`**: (詳細) 設定を完全に手動で制御してローカル WordPress サーバーを起動します。
- **`run-blueprint`**: Web サーバーを起動せずに Blueprint ファイルを実行します。
- **`build-snapshot`**: Blueprint に基づいて WordPress サイトの ZIP スナップショットをビルドします。

`start` 専用の引数:

- `--reset`: 保存済みサイトを削除して最初から開始。デフォルトは false。

`server` で使える主なオプション引数:

<!--
- `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
... (full list)
-->

- `--port=<port>`: サーバーがリッスンするポート。デフォルトは 9400。
- `--version`: バージョン番号を表示。
- `--outfile`: ビルド時の出力ファイル。
- `--site-url=<url>`: WordPress のサイト URL。デフォルトは `http://127.0.0.1:{port}`。
- `--wp=<version>`: 使用する WordPress のバージョン。デフォルトは最新。
- `--php=<version>`: 使用する PHP のバージョン。選択肢: `8.5`, `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`。デフォルトは `8.5`。
- `--auto-mount[=<path>]`: ディレクトリを自動マウント。パス未指定の場合はカレントディレクトリ。WordPress/プラグイン/テーマ/wp-content ディレクトリや PHP/HTML を含む任意のディレクトリをマウント可能。
- `--mount=<mapping>`: ディレクトリを手動マウント（複数可）。形式: `"/host/path:/vfs/path"`。
- `--mount-before-install`: WordPress インストール前に PHP ランタイムへマウント（複数可）。形式: `"/host/path:/vfs/path"`。
- `--mount-dir`: PHP ランタイムへディレクトリをマウント（複数可）。形式: `"/host/path"` `"/vfs/path"`。
- `--mount-dir-before-install`: WordPress インストール前にマウント（複数可）。形式: `"/host/path"` `"/vfs/path"`。
- `--blueprint=<path>`: 実行する JSON Blueprint ファイルのパス。
- `--blueprint-may-read-adjacent-files`: 同意フラグ。ローカル Blueprint の「バンドル」リソースが Blueprint と同じディレクトリのファイルを読むことを許可。
- `--login`: 管理者として自動ログイン。
- `--wordpress-install-mode <mode>`: 起動前の WordPress 準備方法。デフォルトは `download-and-install`。他: `install-from-existing-files`、`install-from-existing-files-if-needed`、`do-not-attempt-installing`。
- `--skip-sqlite-setup`: SQLite データベース統合をセットアップしない。
- `--verbosity=<level>`: ログと進捗メッセージ。選択肢: `quiet`、`normal`、`debug`。デフォルトは `normal`。
- `--debug`: 起動時のエラー時に PHP エラーログを出力。
- `--follow-symlinks`: マウントされたディレクトリ内のシンボリックリンクを自動マウントしてフォローすることを許可。
- `--internal-cookie-store`: 内部 Cookie 処理を有効化。有効時は HttpCookieStore でリクエスト間の Cookie を永続化。無効時は外部（Node.js ではブラウザなど）で処理。デフォルトは false。
- `--phpmyadmin[=<path>]`: データベース管理用に phpMyAdmin をインストール。起動後に URL を表示。オプションで URL パスを指定可能（デフォルト: `/phpmyadmin`）。
- `--xdebug`: Xdebug を有効化。デフォルトは false。
- `--experimental-devtools`: 実験的ブラウザ開発者ツールを有効化。デフォルトは false。
- `--experimental-unsafe-ide-integration=<ide>`: VS Code (`vscode`) および PhpStorm (`phpstorm`) の Xdebug 連携をセットアップ。
- `--experimental-multi-worker=<number>`: 実験的マルチワーカーを有効化（実ファイルシステム上の `/wordpress` が必要）。正の数でワーカー数を指定。未指定時は CPU 数 - 1。

<!--
:::caution
With the flag `--follow-symlinks`, the following symlinks will expose files outside mounted directories to Playground and could be a security risk.
:::
-->

:::caution
`--follow-symlinks` を付けると、マウント外のファイルが Playground に露出するシンボリックリンクが存在し、セキュリティリスクになる可能性があります。
:::

<!--
## Need some help with the CLI?
-->

## CLI のヘルプ

<!--
With the Playground CLI, you can use the `--help` flag to get the full list of available commands and arguments.
-->

Playground CLI では `--help` フラグで利用可能なコマンドと引数の一覧を確認できます。

```bash
npx @wp-playground/cli@latest --help
```

<!--
## Programmatic usage
-->

## プログラムからの利用

<!--
The Playground CLI can also be controlled programmatically from JavaScript/TypeScript
using the `runCLI` function. See the [Programmatic Usage guide](/guides/programmatic-playground-cli)
for details on automation and testing.
-->

Playground CLI は JavaScript/TypeScript から `runCLI` 関数でプログラム制御できます。自動化とテストの詳細は [プログラムからの利用ガイド](/guides/programmatic-playground-cli) を参照してください。
