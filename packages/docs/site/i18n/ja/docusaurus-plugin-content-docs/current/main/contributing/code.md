---
slug: /contributing/code
title: コードの貢献 - WordPress Playground
description: リポジトリをフォークする方法、ローカル環境をセットアップする方法、プルリクエストを送信する方法などを説明した、コード貢献のガイドです。
---

# コードの貢献

<!--
# Code contributions
-->

他の WordPress プロジェクトと同様に、Playground は GitHub を使用してコードを管理し、問題を追跡しています。メインリポジトリは[https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground)、Playground Tools リポジトリは[https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/)にあります。

<!--
Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).
-->

:::info Playground Tools への貢献

このガイドにはメインリポジトリへのリンクが含まれていますが、すべての手順とオプションは両方に適用されます。プラグインやローカル開発ツールにご興味がある場合は、まずそちらから始めてください。

:::

<!--
:::info Contribute to Playground Tools

This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or local development tools—start there.

:::
-->

[オープンな問題の一覧](https://github.com/wordpress/wordpress-playground/issues)を参照して、取り組むべき問題を見つけてください。初めて貢献する方は、[`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) ラベルから始めることをお勧めします。

<!--
Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors.
-->

始める前に、必ず次のリソースを確認してください。

<!--
Be sure to review the following resources before you begin:
-->

-   [コーディング原則](/contributing/coding-standards)
-   [アーキテクチャ](/developers/architecture)
-   [ビジョンと理念](https://github.com/WordPress/wordpress-playground/issues/472)
-   [WordPress Playground ロードマップ](https://github.com/WordPress/wordpress-playground/issues/525)

<!--
-   [Coding principles](/contributing/coding-standards)
-   [Architecture](/developers/architecture)
-   [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
-   [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

## プルリクエストの貢献

<!--
## Contribute Pull Requests
-->

[Playground リポジトリをフォーク](https://github.com/WordPress/wordpress-playground/fork)し、ローカルマシンにクローンします。そのためには、以下のコマンドをコピーしてターミナルに貼り付けます。

<!--
[Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal:
-->

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# replace `YOUR-GITHUB-USERNAME` with your GitHub username:
git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

次のコマンドを実行して、ブランチを作成し、変更を加えてローカルでテストします。

<!--
Create a branch, make changes, and test it locally by running the following command:
-->

```bash
npm run dev
```

プレイグラウンドは新しいブラウザタブで開き、変更ごとに自動的に更新されます。

<!--
Playground will open in a new browser tab and refresh automatically with each change.
-->

準備ができたら、変更をコミットし、プルリクエストを送信します。

<!--
When your'e ready, commit the changes and submit a Pull Request.
-->

:::info フォーマッティング

コードのフォーマッティングとリンティングは自動的に行われます。安心して入力し、あとは機械に任せましょう。

:::

<!--
:::info Formatting

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

:::
-->

### ローカルマルチサイトの実行

<!--
### Running a local Multisite
-->

WordPress マルチサイトには、ローカルで実行する場合の[制限事項](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions)がいくつかあります。Playground の「enableMultisite」ステップを使用してマルチサイトネットワークをテストする場合は、「wp-now」のデフォルトポートを変更するか、HTTPS 経由で実行されるローカルテストドメインを設定してください。

<!--
WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change `wp-now`'s default port or set a local test domain running via HTTPS.
-->

`wp-now` のデフォルト ポートを WordPress Multisite でサポートされているポートに変更するには、`--port=80` フラグを使用して実行します。

<!--
To change `wp-now`'s default port to the one supported by WordPress Multisite, run it using the `--port=80` flag:
-->

```bash
npx @wp-now/wp-now start --port=80
```

ローカルテストドメインを設定する方法はいくつかありますが、`hosts` ファイルの編集もその一つです。方法がわからない場合は、[Laravel Valet](https://laravel.com/docs/11.x/valet) をインストールして、以下のコマンドを実行することをお勧めします。

<!--
There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command:
-->

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

開発サーバーが https://playground.test で利用できるようになりました。

<!--
Your dev server is now available on https://playground.test.
-->

## デバッグ

<!--
## Debugging
-->

### VS Code と Chrome を使用する

<!--
### Use VS Code and Chrome
-->

VS Code を使用しており、Chrome がインストールされている場合は、コードエディターで Playground をデバッグできます。

<!--
If you're using VS Code and have Chrome installed, you can debug Playground in the code editor:
-->

-   VS Code でプロジェクト フォルダーを開きます。
-   メイン メニューから [実行] > [デバッグの開始] を選択するか、`F5`/`fn`+`F5` を押します。

<!--
-   Open the project folder in VS Code.
-   Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.
-->

### PHP のデバッグ

<!--
### Debugging PHP
-->

Playground は、PHP リクエストのたびにブラウザコンソールに PHP エラーを記録します。

<!--
Playground logs PHP errors in the browser console after every PHP request.
-->
