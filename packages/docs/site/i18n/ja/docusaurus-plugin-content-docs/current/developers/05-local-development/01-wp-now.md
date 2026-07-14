---
title: wp-now
slug: /developers/local-development/wp-now
---

<div class="callout callout-warning">

**パッケージは非推奨です**

NPM パッケージ @wp-now/wp-now は非推奨となり、今後アップデートは行われません。開発フローでコマンドラインツールを使用するには、NPM パッケージ `@wp-playground/cli` を使用してください。

</div>

<!--
<div class="callout callout-warning">

**Package deprecated**

The NPM package @wp-now/wp-now is deprecated, won't receive updates in the future. To use a command-line tool on your developer flow, use the NPM package `@wp-playground/cli`.

</div>
-->

# wp-now NPM パッケージ

<!--
# wp-now NPM package
-->

[wp-now](https://www.npmjs.com/package/@wp-now/wp-now) は、WordPress をローカルで実行するプロセスを簡素化するために設計されたコマンドラインツールです。最小限の設定で、迅速かつ簡単にローカルの WordPress 環境を構築できます。

<!--
[wp-now](https://www.npmjs.com/package/@wp-now/wp-now) is a command-line tool designed to simplify the process of running WordPress locally. It provides a quick and easy way to set up a local WordPress environment with minimal configuration.
-->

主な機能:

<!--
Key Features:
-->

- **コマンドラインインターフェース**: CLI に慣れた開発者にとって使いやすいです。
- **クイックセットアップ**: ローカルの WordPress 環境を数秒でセットアップできます。
- **カスタマイズ可能**: 特定の開発ニーズに合わせて設定できます。

<!--
-   **Command-line Interface**: Easy to use for developers comfortable with CLI.
-   **Quick Setup**: Set up a local WordPress environment in seconds.
-   **Customizable**: Allows for configuration to suit specific development needs.
-->

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) は、コマンド 1 つで WordPress サイトを立ち上げられる CLI ツールです。[VS Code 拡張機能](/developers/local-development/vscode-extension)と同様に、PHP と SQLite のポータブルな WebAssembly バージョンを使用します。Docker、MySQL、Apache は必要ありません。

<!--
[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is a CLI tool to spin up a WordPress site with a single command. Similarly to the [VS Code extension](/developers/local-development/vscode-extension), it uses a portable WebAssembly version of PHP and SQLite. No Docker, MySQL, or Apache are required.
-->

<div class="callout callout-info">

**ドキュメント**

`wp-now` は別の GitHub リポジトリ [Playground Tools](https://github.com/WordPress/playground-tools/) でメンテナンスされています。最新のドキュメントは [専用の README ファイル](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md) をご覧ください。

</div>

<!--
<div class="callout callout-info">

**Documentation**

`wp-now` is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md).

</div>
-->

## プラグインまたはテーマディレクトリで wp-now を起動します

<!--
## Launch wp-now in a plugin or theme directory
-->

プラグインまたはテーマのディレクトリに移動し、次のコマンドで `wp-now` を起動します。

<!--
Navigate to your plugin or theme directory and start `wp-now` with the following commands:
-->

```bash
cd my-plugin-or-theme-directory
npx @wp-now/wp-now start
```

## `wp-content`ディレクトリでオプション付きで wp-now を起動します

<!--
## Launch wp-now in the `wp-content` directory with options
-->

`wp-now` は任意の `wp-content` フォルダから起動することもできます。次の例では、PHP と WordPress のバージョンを変更し、ブループリントファイルを読み込むためのパラメータを渡しています。

<!--
You can also start `wp-now` from any `wp-content` folder. The following example passes parameters for changing the PHP and WordPress versions and loading a blueprint file.
-->

```bash
cd my-wordpress-folder/wp-content
npx @wp-now/wp-now start --wp=6.4 --php=8.3 --blueprint=path/to/blueprint.json
```

## wp-now をグローバルにインストールする

<!--
## Install wp-now globally
-->

あるいは、`@wp-now/wp-now` をグローバルにインストールして、任意のディレクトリから読み込むこともできます。

<!--
Alternatively, you can install `@wp-now/wp-now` globally to load it from any directory:
-->

```bash
npm install -g @wp-now/wp-now
cd my-plugin-or-theme-directory
wp-now start
```
