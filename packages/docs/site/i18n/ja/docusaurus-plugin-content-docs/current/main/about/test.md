---
title: テスト - WordPress Playground
slug: /about/test
description: Playground を使用してテーマ、プラグイン、プルリクエスト、WordPress と PHP のさまざまなバージョンをテストする方法を説明します。
---

# テスト

<!--
# Test
-->

ブラウザでワンクリックで進捗状況を確認できる機能で、QA プロセスをアップグレードしましょう。準備ができたら、すぐに更新をプッシュできます。

<!--
Upgrade your QA process with the ability to review progress in your browser in a single click. When you’re ready, push updates instantly.
-->

## テーマやプラグインをテストする

<!--
## Test any theme or plugin
-->

Playground を使えば、あらゆるプラグインやテーマをテストできます。[Query API](/developers/apis/query-api)を使えば、wordpress.org の[plugins](https://wordpress.org/plugins)ディレクトリと[themes](https://wordpress.org/themes/)ディレクトリに公開されているプラ ​​ グインやテーマを素早く読み込むことができます。

<!--
With Playground, you can test any plugin or theme. Use the [Query API](/developers/apis/query-api) to quickly load any plugin or theme published in wordpress.org [plugins](https://wordpress.org/plugins) and [themes](https://wordpress.org/themes/) directories.
-->

たとえば、次のリンクは、Playground インスタンスに [“pendant” テーマ](https://wordpress.org/themes/pendant/) と [ “gutenberg” プラグイン](https://wordpress.org/plugins/gutenberg/) を読み込みます。

<!--
For example, the following link will load the [“pendant” theme](https://wordpress.org/themes/pendant/) and the[ “gutenberg” plugin](https://wordpress.org/plugins/gutenberg/) on a Playground instance:
-->

[https://playground.wordpress.net/?theme=pendant&plugin=gutenberg](https://playground.wordpress.net/?theme=pendant&plugin=gutenberg)

ただし、[ブループリントを使用したより複雑な構成](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)をテストすることもできます。たとえば、gist からプラグインのコードをテストします ([ブループリント](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) と [ライブ デモ](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json) を参照)

<!--
But you can also test [more elaborate configurations using blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md), for example testing a plugin’s code from a gist (see [blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json))
-->

## ライブプレビューのプルリクエスト

<!--
## Live preview pull requests
-->

プルリクエストのテストは、Playground プロジェクトの最もエキサイティングなユースケースの一つです。Playground を使用すると、GitHub にある WordPress 関連プロジェクトの各プルリクエストにライブプレビューリンクを有効化できるため、開発者はプルリクエスト内のコードの効果を実際に確認できます。詳細については、[Playground で WordPress Core のプルリクエストをプレビュー](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.)をご覧ください。

<!--
Testing pull requests is one of the most exciting use cases for the Playground project. With Playground, you can enable a Live preview link on each Pull Request of a WordPress-related project in GitHub so that developers can see in action the effects of code in that Pull Request. Read more about this at [Preview WordPress Core Pull Requests with Playground](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.).
-->

このユースケースには、[WordPress Core PR プレビューアー](https://playground.wordpress.net/wordpress.html)や [Gutenberg PR プレビューアー](https://playground.wordpress.net/gutenberg.html)など、公開実装がいくつかあります。ユーザーは PR 番号または URL を入力すると、Playground を利用した WordPress インスタンスにリダイレクトされ、PR の変更が適用されます。

<!--
There are some public implementations of this use case such as [WordPress Core PR previewer](https://playground.wordpress.net/wordpress.html) and [Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html). Users can input the PR number or URL to be redirected to a WordPress instance, powered by Playground, where the changes from the PR are applied.
-->

[WP Playground PR Preview](https://github.com/vcanales/action-wp-playground-pr-preview) などの GitHub アクションを使用すると、WP Playground を利用した PR プレビューを任意のリポジトリに追加できます。例えば、この機能は[WordPress/twentytwentyfive](https://github.com/WordPress/twentytwentyfive)リポジトリで[有効化](https://github.com/WordPress/twentytwentyfive/pull/359)されています。

<!--
GitHub actions such as [WP Playground PR Preview](https://github.com/vcanales/action-wp-playground-pr-preview) allows you to add PR previews powered by WP Playground on any repository. For example, this feature [was enabled](https://github.com/WordPress/twentytwentyfive/pull/359) in the [WordPress/twentytwentyfive](https://github.com/WordPress/twentytwentyfive) repository.
-->

## サイトのクローンを作成し、プライベート サンドボックスで実験します。

<!--
## Clone your site and experiment in a private sandbox.
-->

[Sandbox Site powered by Playground](https://wordpress.org/plugins/playground/) プラグインを使用すると、サイトのプライベート WordPress Playground コピーを作成して、プラグインを安全にテストしたり、クラウドにデータをアップロードしたり、元のサイトに影響を与えずに、サイトのレプリカでその他の実験を実行したりできます。

<!--
With the [Sandbox Site powered by Playground](https://wordpress.org/plugins/playground/) plugin you can create a private WordPress Playground copy of your site to test plugins safely or do any other experiments on your site’s replica without uploading any data to the cloud and without affecting the original site.
-->

## さまざまな WordPress および PHP バージョンをテストします。

<!--
## Test different WordPress and PHP versions.
-->

Playground を使用すると、設定をカスタマイズするか、`preferredVersions` プロパティを持つカスタム ブループリントを使用することで、主要な WordPress または PHP バージョンをすばやくテストできます。

<!--
With Playground, you can quickly test any major WordPress or PHP version by _customizing its settings_ or using a custom blueprint with the `preferredVersions` property.
-->

たとえば、[Beta Nightly](https://wordpress.org/download/beta-nightly/) とも呼ばれる WordPress の最新の開発バージョンは、このリンク [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly) からいつでもテストできます。

<!--
For example, you can always test the latest development version of WordPress, also called [Beta Nightly](https://wordpress.org/download/beta-nightly/), from this link: [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly)
-->

WordPress リリースのベータ期間中は、テーマテストデータとデバッグプラグインを使用して、最新の WordPress ベータ版または RC リリースをテストすることもできます ([ブループリント](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) と [ライブデモ](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json) を参照してください)。

<!--
During the Beta period of any WordPress release, you can also test the latest WordPress Beta or RC release with theme test data and debugging plugins (see [blueprint](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) and [live demo). ](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json)
-->

また、利用可能な WordPress および PHP バージョンのいずれかで [テーマ、プラグイン](/developers/apis/query-api)、または [構成](/blueprints) をロードして、その環境でどのように動作するかを確認することもできます。

<!--
You can also load any [theme, plugin](/developers/apis/query-api), or [configuration](/blueprints) in any of the available WordPress and PHP versions to check how they work in that environment.
-->

[WordPress Playground: WordPress のための究極の学習、テスト、教育ツール](https://www.youtube.com/watch?v=dN_LaenY8bI) では、Playground を使用したテストの可能性に関する優れた概要が提供されています。

<!--
The [WordPress Playground: the ultimate learning, testing, & teaching tool for WordPress](https://www.youtube.com/watch?v=dN_LaenY8bI) provides a great overview of the testing possibilities with Playground.
-->
