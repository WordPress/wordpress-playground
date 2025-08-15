---
slug: /contributing/contributor-day
title: WordCamp コントリビューターデー - WordPress Playground
description: WordCamp コントリビューターデー 中に VS Code 拡張機能や CLI などの Playground ツールを使用するためのガイドです。
---

# WordCamp コントリビューター デイ

<!--
# WordCamp Contributor Day
-->

[WordPress Playground VS Code 拡張機能](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) と [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) を使用すると、ローカルの WordPress 環境をセットアップするプロセスが効率化されます。WordPress Playground は両方をサポートしており、Docker、MySQL、Apache は必要ありません。

<!--
The [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) and [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) streamline the process of setting up a local WordPress environment. WordPress Playground powers both—no Docker, MySQL, or Apache required.
-->

WordPress に貢献する際に、[ローカル開発](/developers/local-development/wp-playground-cli) でこれらのツールを使用する方法については、読み進めてください。拡張機能と NPM パッケージは現在開発中であり、すべての [Make WordPress チーム](https://make.wordpress.org/) が完全にサポートされているわけではないことにご注意ください。

<!--
Keep reading to learn how to use these tools for [local development](/developers/local-development/wp-playground-cli) when contributing to WordPress. Please note that the extension and the NPM package are under development, and not all [Make WordPress teams](https://make.wordpress.org/) are fully supported.
-->

## はじめる

<!--
## Getting Started
-->

### VS Code プレイグラウンド拡張機能

<!--
### VS Code Playground extension
-->

[Visual Studio Code Playground 拡張機能](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) は、セットアップが不要な使いやすい開発環境です。

<!--
The [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) is a friendly zero-setup development environment.
-->

1. VS Code を開き、**拡張機能** タブ (**表示 > 拡張機能**) に移動します。
2. 検索バーに「WordPress Playground」と入力し、**インストール** をクリックします。
3. Playground を操作するには、**アクティビティバー** の新しいアイコンをクリックし、**WordPress サーバーを開始** ボタンをクリックします。
4. 数秒以内にブラウザに新しいタブが開きます。

<!--
1. Open VS Code and navigate to the **Extensions** tab (**View > Extensions**).
2. In the search bar, type _WordPress Playground_ and click **Install**.
3. To interact with Playground, click the new icon in the **Activity Bar** and hit the **Start WordPress Server** button.
4. A new tab will open in your browser within seconds.
-->

### @wp-playground/cli NPM パッケージ

<!--
### @wp-playground/cli NPM package
-->

`@wp-playground/cli` は、コマンド 1 つで WordPress サイトを起動できる CLI ツールです。Docker、MySQL、Apache は必要ありません。

<!--
`@wp-playground/cli` is a CLI tool that allows you to spin up a WordPress site with a single command. No Docker, MySQL, or Apache are required.
-->

#### 前提条件

<!--
#### Prerequisites
-->

`@wp-playground/cli` には Node.js 20.18 以降と NPM が必要です。まだインストールしていない場合は、始める前に両方を[ダウンロードしてインストール](https://nodejs.org/en/download)してください。

<!--
`@wp-playground/cli` requires Node.js 20.18 or newer and NPM. If you haven’t yet, [download and install](https://nodejs.org/en/download) both before you begin.
-->

参加する Make WordPress チームによっては、インストール済みのものとは異なるバージョンの Node.js が必要になる場合があります。Node Version Manager（NVM）を使用してバージョンを切り替えることができます。[インストールガイドはこちら](https://github.com/nvm-sh/nvm#installing-and-updating)。

<!--
Depending on the Make WordPress team you contribute to, you may need a different Node.js version than the one you have installed. You can use Node Version Manager (NVM) to switch between versions. [Find the installation guide here](https://github.com/nvm-sh/nvm#installing-and-updating).
-->

#### `@wp-playground/cli` を実行しています

<!--
#### Running `@wp-playground/cli`
-->

`@wp-playground/cli` を使用するためにデバイスにインストールする必要はありません。プラグインまたはテーマのディレクトリに移動し、以下のコマンドで `@wp-playground/cli` を起動してください。

<!--
You don’t have to install `@wp-playground/cli` on your device to use it. Navigate to your plugin or theme directory and start `@wp-playground/cli` with the following commands:
-->

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

## 貢献者へのアイデア

<!--
## Ideas for contributors
-->

### Gutenberg プルリクエスト (PR) を作成する

<!--
### Create a Gutenberg Pull Request (PR)
-->

1. GitHub アカウントで [Gutenberg リポジトリ](https://github.com/WordPress/gutenberg)をフォークします。
2. 次に、フォークしたリポジトリをクローンしてファイルをダウンロードします。
3. 必要な依存関係をインストールし、開発モードでコードをビルドします。

<!--
1. Fork the [Gutenberg repository](https://github.com/WordPress/gutenberg) in your GitHub account.
2. Then, clone the forked repository to download the files.
3. Install the necessary dependencies and build the code in development mode.
-->

```bash
git clone git@github.com:WordPress/gutenberg.git
cd gutenberg
npm install
npm run dev
```

:::info

上記の手順が不明な場合は、公式の[Gutenberg プロジェクト貢献者ガイド](https://developer.wordpress.org/block-editor/contributors/)をご覧ください。この場合、`wp-env` が `@wp-playground/cli` に置き換えられることに注意してください。

:::

<!--
:::info

If you’re unsure about the steps listed above, visit the official [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Note that in this case, `@wp-playground/cli` replaces `wp-env`.

:::
-->

新しいターミナルタブを開き、Gutenberg ディレクトリに移動して、`@wp-playground/cli` を使用して WordPress を起動します。

<!--
Open a new terminal terminal tab, navigate to the Gutenberg directory, and start WordPress using `@wp-playground/cli`:
-->

```bash
cd gutenberg
npx @wp-playground/cli@latest server --auto-mount
```

準備ができたら、変更を GitHub 上のフォークしたリポジトリにコミットしてプッシュし、Gutenberg リポジトリでプル リクエストを開きます。

<!--
When you’re ready, commit and push your changes to your forked repository on GitHub and open a Pull Request on the Gutenberg repository.
-->

### Gutenberg の PR をテストする

<!--
### Test a Gutenberg PR
-->

1. 他の Gutenberg PR をテストするには、関連するブランチをチェックアウトします。
2. 最新の変更をプルして、ローカルコピーが最新であることを確認します。
3. 次に、必要な依存関係をインストールし、テスト環境が最新の変更と一致していることを確認します。
4. 最後に、開発モードでコードをビルドします。

<!--
1. To test other Gutenberg PRs, checkout the branch associated with it.
2. Pull the latest changes to ensure your local copy is up to date.
3. Next, install the necessary dependencies, ensuring your testing environment matches the latest changes.
4. Finally, build the code in development mode.
-->

```bash
# copy the branch-name from GitHub #
git checkout branch-name
git pull
npm install
npm run dev

# In a different terminal inside the Gutenberg directory *
npx @wp-now/wp-now start
```

#### ブラウザで Playground を使って Gutenberg の PR をテストする

<!--
#### Test a Gutenberg PR with Playground in the browser
-->

Gutenberg の PR をテストするのにローカル開発環境は必要ありません。Playground を使用してブラウザ内で直接テストできます。

<!--
You don’t need a local development environment to test Gutenberg PRs—use Playground to do it directly in the browser.
-->

1. テストしたい PR の ID をコピーします（[オープンなプルリクエストのリスト](https://github.com/WordPress/gutenberg/pulls)から 1 つ選択します）。
2. Playground の [Gutenberg PR プレビューアー](https://playground.wordpress.net/gutenberg.html)を開き、コピーした ID を貼り付けます。
3. **Go** をクリックすると、Playground は PR の有効性を検証し、関連する PR を含む新しいタブを開きます。提案された変更内容を確認できます。

<!--
1. Copy the ID of the PR you’d like to test (pick one from the [list of open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Open Playground’s [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) and paste the ID you copied.
3. Once you click **Go**, Playground will verify the PR is valid and open a new tab with the relevant PR, allowing you to review the proposed changes.
-->

## ブラウザの Playground で WordPress プラグインを翻訳する

<!--
## Translate WordPress Plugins with Playground in the browser
-->

対応している WordPress プラグインを翻訳するには、翻訳したいプラグインを読み込み、インライン翻訳を使用します。プラグイン開発者がこのオプションを追加している場合は、翻訳画面の右上のツールバーに「ライブ翻訳」リンクが表示されます。この新しいオプションの詳細については、[Polyglots のブログ記事](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)をご覧ください。

<!--
You can translate supported WordPress Plugins by loading the plugin you want to translate and use Inline Translation. If the plugin developers have added the option, you'll find the **Translate Live** link on the top right toolbar of the translation view. You can read more about this exciting new option on [this Polyglots blog post](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).
-->

## WordPress Playground でサポートを受け、貢献する

<!--
## Get help and contribute to WordPress Playground
-->

ご質問や新機能に関するアイデアをお持ちですか？バグを発見しましたか？期待通りに動作しませんか？お気軽にお問い合わせください。

<!--
Have a question or an idea for a new feature? Found a bug? Something’s not working as expected? We’re here to help:
-->

-   コントリビューター デイ 中は、**Playground テーブル** でご連絡ください。
-   [WordPress Playground GitHub リポジトリ](https://github.com/WordPress/wordpress-playground/issues/new) で Issue を開いてください。VS Code 拡張機能、NPM パッケージ、またはプラグインに関する問題の場合は、[Playground Tools リポジトリ](https://github.com/WordPress/playground-tools/issues/new) で Issue を開いてください。
-   [**#playground** Slack チャンネル](https://wordpress.slack.com/archives/C04EWKGDJ0K) でフィードバックを共有してください。

<!--
-   During Contributor Day, you can reach us at the **Playground table**.
-   Open an issue on the [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). If your focus is the VS Code extension, NPM package, or the plugins, open an issue on the [Playground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
-   Share your feedback on the [**#playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
-->
