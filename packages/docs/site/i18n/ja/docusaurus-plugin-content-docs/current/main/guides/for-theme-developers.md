---
title: テーマ開発者のためのWordPressプレイグラウンド
slug: /guides/for-theme-developers
description: Playground を使用して、Blueprints でテーマのライブ デモを構築、テスト、作成するためのテーマ開発者向けガイドです。
---

WordPress Playground は、テーマ開発者がブラウザ環境で直接テーマを構築、テスト、紹介できる革新的なツールです。

<!--
The WordPress Playground is an innovative tool that allows theme developers to build, test, and showcase their themes directly in a browser environment.
-->

このガイドでは、WordPress Playground を使用してテーマ開発ワークフローを改善し、テーマを紹介するライブデモを作成し、テーマのレビュー プロセスを簡素化する方法を説明します。

<!--
This guide will show you how to use WordPress Playground to improve your theme development workflow, create live demos to showcase your theme, and simplify the theme review process.
-->

:::info

WordPress Playground を使って製品を [ビルド](/about/build)、[テスト](/about/test)、[ローンチ](/about/launch) する方法については、[Playground について](/about) セクションでご確認ください。

:::

<!--
:::info

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section

:::
-->

## テーマを指定して Playground インスタンスを起動する

<!--
## Launching a Playground instance with a theme
-->

### WordPress テーマディレクトリ内のテーマ

<!--
### Themes in the WordPress themes directory
-->

WordPress Playground を使えば、[WordPress テーマディレクトリ](https://wordpress.org/themes/)にあるテーマを使って、WordPress を素早く起動できます。[クエリパラメータ](/developers/apis/query-api)の`theme`を [Playground URL](https://playground.wordpress.net) に渡すだけです。例：https://playground.wordpress.net/?theme=disco

<!--
With WordPress Playground, you can quickly launch a WordPress installation using any theme available in the [WordPress Themes Directory](https://wordpress.org/themes/). Simply pass the `theme` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) like this: https://playground.wordpress.net/?theme=disco.
-->

また、Playground インスタンスに渡される [Blueprint](/blueprints/getting-started) の [`installTheme` ステップ](/blueprints/steps#InstallThemeStep) を設定することで、WordPress テーマ ディレクトリから任意のテーマをロードすることもできます。

<!--
You can also load any theme from the WordPress themes directory by setting the [`installTheme` step](/blueprints/steps#InstallThemeStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.
-->

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwenty"
			},
			"options": {
				"activate": true,
				"importStarterContent": true
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

### GitHub リポジトリ内のテーマ

<!--
### Themes in a GitHub repository
-->

GitHub リポジトリに保存されているテーマは、Blueprints を使用して Playground インスタンスに読み込むこともできます。

<!--
A theme stored in a GitHub repository can also be loaded in a Playground instance with Blueprints.
-->

[`installTheme` ブループリント ステップ](/blueprints/steps#InstallThemeStep) の `themeData` プロパティで、Playground インスタンスにロードするテーマを含む `.zip` ファイルの場所を指す [`url` リソース](/blueprints/steps/resources#urlreference) を定義できます。

<!--
In the `themeData` property of the [`installTheme` blueprint step](/blueprints/steps#InstallThemeStep), you can define a [`url` resource](/blueprints/steps/resources#urlreference) that points to the location of the `.zip` file containing the theme you want to load in the Playground instance.
-->

CORS の問題を回避するために、Playground プロジェクトでは [GitHub プロキシ](https://playground.wordpress.net/proxy) が提供されており、これを使用すると、自分のテーマを含むリポジトリ (またはリポジトリ内のフォルダー) から `.zip` を生成できます。

<!--
To avoid CORS issues, the Playground project provides a [GitHub proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your or theme.
-->

:::tip
[GitHub プロキシ](https://playground.wordpress.net/proxy) は、特定のブランチ、特定のディレクトリ、特定のコミット、または特定の PR からテーマを読み込むことができるため、GitHub リポジトリからテーマを読み込むのに非常に便利なツールです。
:::

<!--
:::tip
[GitHub proxy](https://playground.wordpress.net/proxy) is an incredibly useful tool to load themes from GitHub repositories as it allows you to load a theme from a specific branch, a specific directory, a specific commit or a specific PR.
:::
-->

たとえば、次の `blueprint.json` は、https://github-proxy.com ツールを使用して GitHub リポジトリからテーマをインストールします。

<!--
For example the following `blueprint.json` installs a theme from a GitHub repository leveraging the https://github-proxy.com tool:
-->

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=Automattic/themes&branch=trunk&directory=assembler"
			},
			"options": {
				"activate": true
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=Automattic/themes&branch=trunk&directory=assembler%22},%22options%22:{%22activate%22:true}}]})

ブループリントは、[いくつかの方法](/blueprints/using-blueprints)で Playground インスタンスに渡すことができます。

<!--
A blueprint can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

## ブループリントでデモテーマを設定する

<!--
## Setting up a demo theme with Blueprints
-->

特定のテーマが有効化された WordPress Playground インスタンスへのリンクを提供する際、そのテーマの初期設定をカスタマイズしたい場合もあるでしょう。Playground の [Blueprints](/blueprints/getting-started) を使えば、テーマを読み込み、有効化し、設定することができます。

<!--
When providing a link to a WordPress Playground instance with a specific theme activated, you may also want to customize the initial setup for that theme. With Playground's [Blueprints](/blueprints/getting-started) you can load, activate, and configure a theme.
-->

:::tip

Playground プロジェクトでは、ブループリントを操作するために、以下の便利なツールとリソースを提供しています。

-   [ブループリント ギャラリー](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) では、WordPress Playground を使用して様々な設定で WordPress サイトを立ち上げる実際のコード例をご覧いただけます。
-   [WordPress Playground ステップ ライブラリ](https://akirk.github.io/playground-step-library/#) ツールは、ステップをドラッグまたはクリックして WordPress Playground のブループリントを作成するためのビジュアルインターフェースを提供します。独自のステップを作成することもできます。
-   [ブループリント ビルダー](https://playground.wordpress.net/builder/builder.html) ツールを使用すると、ブループリントをオンラインで編集し、Playground インスタンスで直接実行できます。

:::

<!--
:::tip

Some useful tools and resources provided by the Playground project to work with blueprints are:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

:::
-->

ブループリント内のプロパティと [`steps`](/blueprints/steps) を通じて、Playground インスタンスでのテーマの初期設定を構成できます。

<!--
Through properties and [`steps`](/blueprints/steps) in the blueprint, you can configure the initial setup of your theme in the Playground instance.
-->

:::info

Playground でテーマのデモを効果的に提供するには、テーマの特徴を強調するデフォルトのコンテンツを Playground に読み込むのがおすすめです。詳しくは[デモ用コンテンツの提供](/guides/providing-content-for-your-demo)ガイドをご覧ください。

:::

<!--
:::info

To provide a good demo of your theme via Playground, you may want to load it with default content that highlights the features of your theme. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

:::
-->

### `resetData`

[`resetData`](/blueprints/steps#resetData) ステップを使用すると、WordPress インストールのデフォルトのコンテンツを削除して、独自のコンテンツをインポートできます。

<!--
With the [`resetData`](/blueprints/steps#resetData) step, you can remove the default content of a WordPress installation in order to import your own content.
-->

```json
"steps": [
	...,
	{
		"step": "resetData"
	},
	...
]
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L16)

### `writeFile`

[`writeFile`](/blueprints/steps#resetData) ステップを使用すると、指定したパスのファイルにデータを書き込むことができます。このステップを使用して、Playground WordPress インスタンスの `mu-plugins` フォルダ内の PHP ファイルにカスタム PHP コードを記述し、WordPress インスタンスのロード時にコードを自動的に実行することができます。
このステップで実行できることの一つは、Playground インスタンスの pretty パーマリンクを有効にすることです。

<!--
With the [`writeFile`](/blueprints/steps#resetData) step, you can write data to a file at a specified path. You may want to use this step to write custom PHP code in a PHP file inside the `mu-plugins` folder of the Playground WordPress instance, so the code is executed automatically when the WordPress instance is loaded.
One of the things you can do through this step is to enable pretty permalinks for your Playground instance:
-->

```json
"steps": [
	...,
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
		"data": "<?php /* Use pretty permalinks */ add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
	},
	...
]
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L19)

### `updateUserMeta`

[`updateUserMeta`](/blueprints/steps#updateUserMeta) ステップを使用すると、任意のユーザーメタデータを更新できます。例えば、任意の WordPress インストールのデフォルトの `admin` ユーザーのメタデータを更新できます。

<!--
With the [`updateUserMeta`](/blueprints/steps#updateUserMeta) step, you can update any user metadata. For example, you could update the metadata of the default `admin` user of any WordPress installation:
-->

```json
"steps": [
	...,
	{
		"step": "updateUserMeta",
		"meta": {
			"first_name": "John",
			"last_name": "Doe",
			"admin_color": "modern"
		},
		"userId": 1
	},
	...
]
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L24)

### `setSiteOptions`

[`setSiteOptions`](/blueprints/steps#setSiteOptions) ステップでは、サイト名、説明、投稿に使用するページなどの [サイト オプション](https://developer.wordpress.org/apis/options/#available-options-by-category) を設定できます。

<!--
With the [`setSiteOptions`](/blueprints/steps#setSiteOptions) step, you can set [site options](https://developer.wordpress.org/apis/options/#available-options-by-category) such as the site name, description, or page to use for posts.
-->

```json
"steps": [
	...,
	{
		"step": "setSiteOptions",
		"options": {
			"blogname": "Rich Tabor",
			"blogdescription": "Multidisciplinary maker specializing in the intersection of product, design and engineering. Making WordPress.",
			"show_on_front": "page",
			"page_on_front": 6,
			"page_for_posts": 2
		}
	},
	...
]
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L50)

`setSiteOptions` ステップの代わりに使用できる [`siteOptions`](/blueprints/steps/shorthands#siteoptions) ショートカットもあります。

<!--
There's also a [`siteOptions`](/blueprints/steps/shorthands#siteoptions) shorthand that can be used instead of the `setSiteOptions` step.
-->

### `plugins`

[`plugins`](/blueprints/steps/shorthands#plugins) ショートハンドを使用すると、Playground インスタンスでテーマとともにインストールしてアクティブ化するプラグインのリストを設定できます。

<!--
With the [`plugins`](/blueprints/steps/shorthands#plugins) shorthand you can set a list of plugins you want to be installed and activated with your theme in the Playground instance.
-->

```json
"plugins": ["todo-list-block", "markdown-comment-block"]
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L60)

[`installPlugin`](/blueprints/steps#installPlugin) ステップを使用して、Playground インスタンスのプラグインをインストールしてアクティブ化することもできますが、簡単な方法が推奨されます。

<!--
You can also use the [`installPlugin`](/blueprints/steps#installPlugin) step to install and activate plugins for your Playground instance but the shorthand way is recommended.
-->

### `login`

[`login`](/blueprints/steps/shorthands#login) ショートカットを使用すると、管理者ユーザーがログインした状態で Playground インスタンスを起動できます。

<!--
With the [`login`](/blueprints/steps/shorthands#login) shorthand you can launch your Playground instance with the admin user logged in.
-->

```json
 "login": true,
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L10)

[`login`](/blueprints/steps#login) ステップを使用して、特定のユーザーでログインした状態で Playground インスタンスを起動することもできます。

<!--
You can also use the [`login`](/blueprints/steps#login) step to launch your Playground instance logged in with any specific user.
-->

:::tip

[Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) の ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) および ["GitHub リポジトリからのテーマの読み込み、アクティブ化、および構成"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) の例は、Playground インスタンスでブロック テーマを読み込み、アクティブ化、インポートし、構成するための優れたリファレンスです。
:::

<!--
:::tip

The ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) and ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) examples from the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) are great references for loading, activating, importing content, and configuring a block theme on a Playground instance.
:::
-->

## テーマ開発

<!--
## Theme development
-->

### Playground を使用したローカルテーマの開発とテスト

<!--
### Local theme development and testing with Playground
-->

ブロックテーマのコードのルートフォルダから、そのテーマが読み込まれ有効化された Playground インスタンスをローカルに素早く読み込むことができます。テーマディレクトリで、お好みのコマンドラインプログラムから[`@wp-playground/cli`コマンド](/developers/local-development/wp-playground-cli)を実行するか、[Visual Studio Code](https://code.visualstudio.com/) IDE から[Visual Code Studio 拡張機能](/developers/local-development/vscode-extension)を実行することで実行できます。

<!--
From the root folder of a block theme's code, you can quickly load locally a Playground instance with that theme loaded and activated. You can do that by launching, in a theme directory, the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your preferred command line program or the [Visual Code Studio extension](/developers/local-development/vscode-extension) from the [Visual Studio Code](https://code.visualstudio.com/) IDE.
-->

例えば：

<!--
For example:
-->

```
git clone git@github.com:WordPress/community-themes.git
cd community-themes/blue-note
npx @wp-playground/cli server --auto-mount
```

### WordPress UI を使用してテーマをデザインし、変更をプルリクエストとして保存します

<!--
### Design your theme using the WordPress UI and save your changes as Pull Requests
-->

Playground インスタンスを GitHub リポジトリに接続し、[Create Block Theme](https://wordpress.org/plugins/create-block-theme/)プラグインを活用することで、Playground インスタンス内の WordPress UI から行った変更を反映させたプルリクエストを作成できます。また、そのテーマに変更を加えて zip ファイルをエクスポートすることもできます。

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you’ve done through the WordPress UI in the Playground instance, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin. You can also make changes to that theme and export a zip.
-->

このワークフローを使用するには、[Create Block Theme](https://wordpress.org/plugins/create-block-theme/) プラグインを Playground インスタンスにインストールして有効化する必要があることに注意してください。

<!--
Note that you'll need the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin installed and activated in the Playground instance in order to use this workflow.
-->

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

:::tip

詳細については、[Playground について > ビルド > ブロック テーマで行った変更を保存し、GitHub プルリクエストを作成する](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) を確認してください。

:::

<!--
:::tip

Check [About Playground > Build > Save changes done on a Block Theme and create GitHub Pull Requests](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) for more info.

:::
-->
