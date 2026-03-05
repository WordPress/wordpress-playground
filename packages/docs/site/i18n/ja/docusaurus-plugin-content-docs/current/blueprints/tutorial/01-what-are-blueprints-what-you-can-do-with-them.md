---
title: ブループリントとは何ですか?
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: ブループリントとは何か、そしてWordPress Playgroundをどのように構成するのかを学びましょう。JSONを使って瞬時にサイトをセットアップするメリットをご紹介します。
---

# ブループリントとは何ですか? ブループリントで何ができますか?

<!--
# What are Blueprints, and what can you do with them?
 -->

WordPress Playground を使用すると、プラグイン、テーマ、コンテンツ (投稿、ページ、分類、コメント)、設定 (サイト名、ユーザー、パーマリンクなど) などを含む Web サイト全体を作成できます。製品が揃った WooCommerce ストア、記事が掲載された雑誌、複数のユーザーがいる企業ブログなどを生成できます。

<!--
With WordPress Playground you can create a whole website, including plugins, themes, content (posts, pages, taxonomy, and comments), settings (site name, users, permalinks, and more), etc. They allow you to generate a WooCommerce store complete with products, a magazine populated with articles, a corporate blog with multiple users, and more.
 -->

ブループリントは、Playground インスタンスを構成するために使用できる `JSON` ファイルです。

<!--
Blueprints are `JSON` files that you can use to configure Playground instances.
 -->

ブループリントは、ファイルシステムやデータベースの操作といった高度なユースケースをサポートし、作成するインスタンスをきめ細かく制御できます。WordPress テストチームは、[6.5 ベータ版リリースサイクル](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/)で Playground を使用し、最新バージョン、複数のテストプラグイン、ダミーデータを読み込むブループリントを作成しています。

<!--
Blueprints support advanced use cases, like file system and database manipulation, and give you fine-grained control over the instance you create. The WordPress Test Team has been using Playground in [the 6.5 beta release cycle](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), creating a Blueprint that loads the latest version, several testing plugins, and dummy data.
 -->

## 簡単な例

<!--
## A simple example
 -->

ブループリントは次のようになります。

<!--
A Blueprint might look something like this:
 -->

```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "マイブログ",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

<!--
```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "My Blog",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```
 -->

上記のブループリントは、_Akismet_ および _Gutenberg_ プラグインと _Twenty Nineteen_ テーマをインストールし、サイト名と説明を設定し、WordPress デバッグ モードを有効にします。

<!--
The Blueprint above installs the _Akismet_ and _Gutenberg_ plugins and the _Twenty Nineteen_ theme, sets the site name and description, and enables the WordPress debugging mode.
 -->

## ブループリントの利点

<!--
## The benefits of Blueprints
 -->

ブループリントは、Playground 経由で WordPress サイトを構築するための貴重なツールです。

<!--
Blueprints are an invaluable tool for building WordPress sites via Playground
 -->

-   **柔軟性**: 開発者はビルドプロセスを細かく調整できます。
-   **一貫性**: すべての新規サイトが同じ構成で開始されることを保証します。
-   **軽量**: 保存と転送が容易な小さなテキストファイルです。
-   **透明性**: ブループリントには、WordPress サイトのスナップショットを作成するために必要なすべてのコマンドが含まれています。これを読むことで、サイトがどのように構築されているかを理解できます。
-   **生産性**: 新しい WordPress サイトを手動でセットアップする時間のかかるプロセスを削減します。新しいプロジェクトごとにテーマやプラグインをインストールして設定する代わりに、ブループリントを適用してすべてを 1 つのプロセスで設定します。
-   **最新の依存関係**: WordPress、特定のプラグイン、またはテーマの最新バージョンを取得します。スナップショットは常に最新の機能とセキュリティ修正を反映した最新の状態になります。
-   **コラボレーション**: `JSON` ファイルは GitHub などのツールで簡単に確認できます。ブループリントをチームや WordPress コミュニティと共有できます。適切に構成された設定を他のユーザーが使用できるようにします。
-   **実験と学習**: WordPress を初めて使用する方や、さまざまな設定を試してみたい方にとって、ブループリントは、ライブサイトを「壊す」ことなく、新しい設定を安全かつ簡単に試す方法を提供します。
-   **WordPress.org との統合**: WordPress プラグインディレクトリで [プラグインのデモ](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) を提供するか、[Theme Trac チケット](https://meta.trac.wordpress.org/ticket/7382) でプレビューを提供します。
-   **開発環境の構築**: チームに新しく参加した開発者は、ブループリントをダウンロードし、仮想的な `wp up` コマンドを実行するだけで、必要なものがすべて揃った最新の開発環境を入手できます。CI/CD プロセス全体で同じブループリントを再利用できます。

<!--
-   **Flexibility**: developers can make granular adjustments to the build process.
-   **Consistency**: ensure that every new site starts with the same configuration.
-   **Lightweight**: small text files that are easy to store and transfer.
-   **Transparency**: A Blueprint includes all the commands needed to build a snapshot of a WordPress site. You can read through it and understand how the site is built.
-   **Productivity**: reduces the time-consuming process of manually setting up a new WordPress site. Instead of installing and configuring themes and plugins for each new project, apply a Blueprint and set everything in one process.
-   **Up-to-date dependencies**: fetch the latest version of WordPress, a particular plugin, or a theme. Your snapshot is always up to date with the latest features and security fixes.
-   **Collaboration**: the `JSON` files are easy to review in tools like GitHub. Share Blueprints with your team or the WordPress community. Allowing others to use your well-configured setup.
-   **Experimentation and Learning**: For those new to WordPress or looking to experiment with different configurations, Blueprints provide a safe and easy way to try new setups without "breaking" a live site.
-   **WordPress.org integration**: offer a [demo of your plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) in the WordPress plugin directory, or a preview in a [Theme Trac ticket](https://meta.trac.wordpress.org/ticket/7382).
-   **Spinning a development environment**: A new developer in the team could download the Blueprint, run a hypothetical `wp up` command, and get a fresh developer environments—loaded with everything they need. The entire CI/CD process can reuse the same Blueprint.
 -->

:::info **その他のリソース**
ブループリントの（無限の）可能性について詳しくは、以下のリンクをご覧ください。

-   [WordPress Playground 入門](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
-   [WordPress Playground ブロック](https://wordpress.org/plugins/interactive-code-block/) を使用して、事前設定された WordPress サイトをウェブサイトに埋め込みます。
-   [ブループリントの例](/blueprints/examples)
-   [ブループリントで構築されたデモとアプリ](/resources#apps-built-with-wordpress-playground)
    :::

<!--
:::info **More Resources**
Visit these links to learn more about the (endless) possibilities of Blueprints:

-   [Introduction to WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
-   Embed a pre-configured WordPress site in your website using the [WordPress Playground Block](https://wordpress.org/plugins/interactive-code-block/).
-   [Blueprints examples](/blueprints/examples)
-   [Demos and apps built with Blueprints](/resources#apps-built-with-wordpress-playground)

:::
 -->
