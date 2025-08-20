---
title: プラグイン開発者のためのWordPressプレイグラウンド
slug: /guides/for-plugin-developers
description: Playground を使用してプラグインの魅力的なライブ デモを構築、テスト、作成するためのプラグイン開発者向けガイドです。
---

WordPress Playground は、プラグイン開発者がブラウザ環境で直接プラグインを構築、テスト、紹介できる革新的なツールです。

<!--
The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment.
-->

このガイドでは、WordPress Playground を使用してプラグイン開発ワークフローを改善し、プラグインを紹介するライブデモを作成し、プラグインのテストとレビューを簡素化する方法を説明します。

<!--
This guide will show you how to use WordPress Playground to improve your plugin development workflow, create live demos to showcase your plugin, and simplify your plugin testing and review.
-->

:::info

WordPress Playground を使用して製品を[構築](/about/build)、[テスト](/about/test)、[起動](/about/launch)する方法については、[Playground について](/about) セクションをご覧ください。

:::

<!--
:::info

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section.

:::
-->

## プラグインを使って Playground インスタンスを起動する

<!--
## Launching a Playground instance with a plugin
-->

### WordPress テーマディレクトリ内のプラグイン

<!--
### Plugin in the WordPress themes directory
-->

WordPress Playground を使えば、[WordPress プラグインディレクトリ](https://wordpress.org/plugins/)にあるほぼすべてのプラグインをインストール・有効化した WordPress 環境を素早く起動できます。[Playground URL](https://playground.wordpress.net) に `plugin` [クエリパラメータ](/developers/apis/query-api)を追加し、 WordPress ディレクトリにあるプラグインのスラッグを値として指定するだけです。例：https://playground.wordpress.net/?plugin=create-block-theme

<!--
With WordPress Playground, you can quickly launch a WordPress installation with almost any plugin available in the [WordPress Plugins Directory](https://wordpress.org/plugins/) installed and activated. All you need to do is to add the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) and use the slug of the plugin from the WordPress directory as a value. For example: https://playground.wordpress.net/?plugin=create-block-theme
-->

:::tip
Playground インスタンスにインストールして有効化したいプラグインごとに、クエリパラメータを使って複数のプラグインをインストールして有効化できます。「plugin」パラメータを繰り返し指定することで実現できます。例：https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo。
:::

<!--
:::tip
You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
:::
-->

また、Playground インスタンスに渡される [Blueprint](/blueprints/getting-started) の [`installPlugin` ステップ](/blueprints/steps#InstallPluginStep) を設定することで、WordPress プラグイン ディレクトリから任意のプラグインをロードすることもできます。

<!--
You can also load any plugin from the WordPress plugins directory by setting the [`installPlugin` step](/blueprints/steps#InstallPluginStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.
-->

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

ブループリントは、[いくつかの方法](/blueprints/using-blueprints)で Playground インスタンスに渡すことができます。

<!--
Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

### GitHub リポジトリのプラグイン

<!--
### Plugin in a GitHub repository
-->

GitHub リポジトリに保存されているプラ ​​ グインは、ブループリントを介して Playground インスタンスに読み込むこともできます。

<!--
A plugin stored in a GitHub repository can also be loaded in a Playground instance via Blueprints.
-->

[`installPlugin` ブループリント ステップ](/blueprints/steps#installPlugin) の `pluginData` プロパティを使用して、Playground インスタンスにロードするプラグインを含む `.zip` ファイルの場所を指す [`url` リソース](/blueprints/steps/resources#urlreference) を定義できます。

<!--
With the `pluginData` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`url` resource](/blueprints/steps/resources#urlreference) that points to the location of the `.zip` file containing the plugin you want to load in the Playground instance.
-->

CORS の問題を回避するために、Playground プロジェクトは [GitHub プロキシ](https://playground.wordpress.net/proxy) を提供します。これにより、プラグインを含むリポジトリ (またはリポジトリ内のフォルダー) から `.zip` を生成できます。

<!--
To avoid CORS issues, the Playground project provides a [GitHub proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your plugin.
-->

:::info
[GitHub プロキシ](https://playground.wordpress.net/proxy) は、GitHub リポジトリからプラグインをロードするのに非常に便利なツールです。特定のブランチ、特定のディレクトリ、特定のコミット、または特定の PR からプラグインをロードできます。
:::

<!--
:::info
[GitHub proxy](https://playground.wordpress.net/proxy) is an incredibly useful tool to load plugins from GitHub repositories as it allows you to load a plugin from a specific branch, a specific directory, a specific commit or a specific PR.
:::
-->

たとえば、次の `blueprint.json` は、https://github-proxy.com ツールを活用して GitHub リポジトリからプラグインをインストールします。

<!--
For example, the following `blueprint.json` installs a plugin from a GitHub repository leveraging the https://github-proxy.com tool:
-->

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin%22}}]})

### GitHub のファイルまたは gist 内のコードからのプラグイン

<!--
### Plugin from code in a file or gist in GitHub
-->

[`writeFile`](/blueprints/steps#WriteFileStep) と [`activatePlugin`](/blueprints/steps#activatePlugin) ステップを組み合わせることで、gist または [GitHub 内のファイル](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php) に保存されたコードからオンザフライで構築されたプラグインを使用して WP Playground インスタンスを起動することもできます。

<!--
By combining the [`writeFile`](/blueprints/steps#WriteFileStep) and [`activatePlugin`](/blueprints/steps#activatePlugin) steps you can also launch a WP Playground instance with a plugin built on the fly from code stored on a gist or [a file in GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):
-->

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})

:::info

[ブループリントギャラリー](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)の [gist からプラグインをインストール](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]})の例では、gist のコードからプラグインをロードする方法を示しています。

:::

<!--
:::info

The [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example in the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) shows how to load a plugin from code in a gist

:::
-->

## ブループリントを使用してプラグインのデモを設定する

<!--
## Setting up a demo for your plugin with Blueprints
-->

いくつかのプラグインを有効にした WordPress Playground インスタンスへのリンクを提供する場合、それらのプラグインを使って Playground インスタンスの初期設定をカスタマイズしたい場合もあるでしょう。Playground の[Blueprints](/blueprints/getting-started)を使えば、プラグインを読み込み／有効化し、 Playground インスタンスを設定できます。

<!--
When providing a link to a WordPress Playground instance with some plugins activated, you may also want to customize the initial setup for that Playground instance using those plugins. With Playground's [Blueprints](/blueprints/getting-started) you can load/activate plugins and configure the Playground instance.
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

ブループリントのプロパティと [`steps`](/blueprints/steps) を通じて、Playground インスタンスの初期セットアップを構成し、プラグインの魅力的な機能を紹介するために必要なコンテンツと構成をプラグインに提供することができます。

<!--
Through properties and [`steps`](/blueprints/steps) in the Blueprint, you can configure the Playground instance's initial setup, providing your plugins with the content and configuration needed for showcasing your plugin's compelling features and functionality.
-->

:::info

WordPress Playground を使った優れたデモでは、画像やその他のアセットを含む、プラグインとテーマのデフォルトコンテンツを読み込む必要がある場合があります。詳しくは、[デモ用のコンテンツの提供](/guides/providing-content-for-your-demo)ガイドをご覧ください。

:::

<!--
:::info

A great demo with WordPress Playground might require that you load default content for your plugin and theme, including images and other assets. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

:::
-->

### `plugins`

<!--
### `plugins`
-->

プラグインが他のプラグインに依存している場合は、`plugins` ショートカットを使用して、他の必要なプラグインと一緒にプラグインをインストールできます。

<!--
If your plugin has dependencies on other plugins you can use the `plugins` shorthand to install yours along with any other needed plugins.
-->

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

### `landingPage`

<!--
### `landingPage`
-->

プラグインに設定ビューまたはオンボーディング ウィザードがある場合は、`landingPage` ショートカットを使用して、読み込み時に Playground インスタンス内の任意のページに自動的にリダイレクトできます。

<!--
If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shorthand to automatically redirect to any page in the Playground instance upon loading.
-->

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

### `writeFile`

<!--
### `writeFile`
-->

[`writeFile` ステップ](/blueprints/steps#writeFile)を使用すると、GitHub または Gist に保存されている \*.php ファイルのコードを参照して、任意のプラグイン ファイルを即座に作成できます。

<!--
With the [`writeFile` step](/blueprints/steps#writeFile) you can create any plugin file on the fly, referencing code from a \*.php file stored on a GitHub or Gist.
-->

以下は、ロード時にコードが自動的に実行されるように `mu-plugins` フォルダに配置された **[カスタム投稿タイプを生成するプラグイン](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)** の例です。

<!--
Here’s an example of a **[plugin that generates Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, placed in the `mu-plugins` folder to ensure the code runs automatically on load:
-->

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```

## プラグイン開発

<!--
## Plugin Development
-->

### Playground を使用したローカルプラグインの開発とテスト

<!--
### Local plugin development and testing with Playground
-->

ローカル開発環境のプラグイン フォルダーから、そのプラグインが読み込まれアクティブ化された Playground インスタンスをローカルにすばやく読み込むことができます。

<!--
From a plugins' folder in your local development environment, you can quickly load locally a Playground instance with that plugin loaded and activated.
-->

お好みのコマンドライン プログラムを使用して、プラグインのルート ディレクトリから [`@wp-playground/cli` コマンド](/developers/local-development/wp-playground-cli) を使用します。

<!--
Use the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your plugin's root directory using your preferred command line program.
-->

[Visual Studio Code](https://code.visualstudio.com/) IDE では、プラグインのルート ディレクトリで作業しているときに [Visual Studio Code 拡張機能](/developers/local-development/vscode-extension) を使用することもできます。

<!--
With [Visual Studio Code](https://code.visualstudio.com/) IDE, you can also use the [Visual Studio Code extension](/developers/local-development/vscode-extension) while working in the root directory of your plugin.
-->

例えば：

<!--
For example:
-->

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```

### Playground インスタンスでローカルの変更を確認し、変更を GitHub リポジトリに直接 PR を作成します

<!--
### See your local changes in a Playground instance and directly create PRs in a GitHub repo with your changes
-->

Google Chrome を使用すると、Playground インスタンスをローカルプラグインのコードとプラグインの GitHub リポジトリと同期できます。この接続により、以下のことが可能になります。

<!--
With Google Chrome you can synchronize a Playground instance with your local plugin's code and your plugin's GitHub repo. With this connection you can:
-->

-   ローカルの変更をライブで（ Playground インスタンスで）確認する
-   変更内容を GitHub リポジトリに PR として作成する

<!--
-   See live (in the Playground instance) your local changes
-   Create PRs in the GitHub repo with your changes
-->

このワークフローの実際のデモを以下に示します。

<!--
Here's a little demo of this workflow in action:
-->

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

:::info

詳細については、[Playground について > ビルド > Playground インスタンスをローカル フォルダーと同期して Github プル リクエストを作成する](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) を確認してください。
:::

<!--
:::info

Check [About Playground > Build > Synchronize your playground instance with a local folder and create Github Pull Requests](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) for more info.

:::
-->
