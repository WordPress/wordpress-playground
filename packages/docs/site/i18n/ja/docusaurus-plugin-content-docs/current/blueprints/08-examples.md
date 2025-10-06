---
sidebar_position: 8
title: 例
slug: /blueprints/examples
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# ブループリント 例

<!--
# Blueprints Examples
-->

:::tip
[Blueprints ギャラリー](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) をチェックして、WordPress Playground を使用してさまざまな設定で WordPress サイトを起動する実際のコード例を確認してください。
:::

<!--
:::tip
Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
:::
-->

ブループリントで実現できるクールな機能をいくつか見てみましょう。

<!--
Let's see some cool things you can do with Blueprints.
-->

## テーマとプラグインをインストールする

<!--
## Install a Theme and a Plugin
-->

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "coblocks"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "pendant"
			}
		}
	]
}} />

## カスタム PHP コードを実行する

<!--
## Run custom PHP code
-->

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array( 'post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1 )); "
		}
	]
}` }
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": `<?php
require_once '/wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

## Gutenberg 実験ページでオプションを有効にする

<!--
## Enable an option on the Gutenberg Experiments page
-->

ここで、「新しい管理者ビュー」機能をオンにします。

<!--
Here: Switch on the "new admin views" feature.
-->

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
		}
	]
}`}
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
			}
		]
}} />

## 製品デモを紹介

<!--
## Showcase a product demo
-->

<BlueprintExample noButton blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/your-plugin.zip"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://your-site.com/your-theme.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://your-site.com/starter-content.wxr"
			}
		},
		{
			"step": "setSiteOptions",
			"options": {
				"some_required_option_1": "your_favorite_values",
				"some_required_option_2": "your_favorite_values"
			}
		}
	]
}} />

## ネットワーキングを有効

<!--
## Enable networking
-->

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/plugin-install.php",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		}
	]
}} />

## リクエストごとに PHP コードをロードする (mu-plugin)

<!--
## Load PHP code on every request (mu-plugin)
-->

`writeFile` ステップを使用して、リクエストごとに実行される mu-plugin にコードを追加します。

<!--
Use the `writeFile` step to add code to a mu-plugin that runs on every request.
-->

<BlueprintExample blueprint={{
	"landingPage": "/category/uncategorized/",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
			"data": "<?php add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
		}
	]
}} />

## コードエディター（ Gutenberg ブロックとして）

<!--
## Code editor (as a Gutenberg block)
-->

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin/post.php?post=4&action=edit",
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "interactive-code-block"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'WordPress Playground block demo!','post_content' => '<!-- wp:wordpress-playground/playground /-->', 'post_status' => 'publish', 'post_type' => 'post',]);"
    }
  ]
}} />

[この専用 wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples) で独自のブループリントの例を共有できます。

<!--
You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).
-->

## 古いバージョンの WordPress を読み込む

<!--
## Load an older WordPress version
-->

Playground には最近の WordPress リリースがいくつかしか含まれていません。古いバージョンを使用する必要がある場合は、こちらのブループリントが役立ちます。`"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-5.9.9.zip"` のバージョン番号を `5.9.9` から、読み込みたいリリースに変更してください。

<!--
Playground only ships with a few recent WordPress releases. If you need to use an older version, this Blueprint can help you: change the version number in `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-5.9.9.zip"` from `5.9.9` to the release you want to load.
-->

**注:** サポートされている最も古い WordPress バージョンは、SQLite 統合プラグインに従った `5.9.9` です。

<!--
**Note:** the oldest supported WordPress version is `5.9.9`, following the SQLite integration plugin.
-->

<BlueprintExample blueprint={{
    "landingPage": "/wp-admin",
    "steps": [
        {
            "step": "writeFile",
            "path": "/tmp/wordpress.zip",
            "data": {
                "resource": "url",
                "url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-5.9.9.zip",
                "caption": "Downloading the WordPress Release"
            }
        },
        {
            "step": "importWordPressFiles",
            "wordPressFilesZip": {
                "resource": "vfs",
                "path": "/tmp/wordpress.zip"
            },
            "pathInZip": "/wordpress",
            "progress": {
                "weight": 20,
                "caption": "Importing the WordPress release"
            }
        },
        {
            "step": "runPHP",
            "code": "<?php $_GET['step'] = 'upgrade_db'; require '/wordpress/wp-admin/upgrade.php'; "
        },
        {
            "step": "login",
            "username": "admin",
            "password": "password"
        }
    ]
}} />

## トランクまたは特定のコミットから WordPress を実行します。

<!--
## Run WordPress from trunk or a specific commit.
-->

WordPress Playground は、`trunk` (最新のコミット)、特定のブランチの HEAD、または [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub リポジトリからの特定のコミットを実行できます。

<!--
WordPress Playground can run `trunk` (the latest commit), the HEAD of a specific branch or a specific commit from the [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub repository.
-->

`"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"` で参照を指定できます。

<!--
You can specify the reference in `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`.
-->

特定のブランチの最新コミットを指定するには、ブランチのバージョン番号への参照を変更します（例：`6.6`）。特定のコミットを実行するには、[WordPress/WordPress](https://github.com/WordPress/WordPress) のコミットハッシュを使用します（例：`7d7a52367dee9925337e7d901886c2e9b21f70b6`）。

<!--
To specify the latest commit of a particular branch, you can change the reference to the branch version number, eg `6.6`. To run a specific commit, you can use the commit hash from [WordPress/WordPress](https://github.com/WordPress/WordPress), eg `7d7a52367dee9925337e7d901886c2e9b21f70b6`.
-->

**注:** サポートされている最も古い WordPress バージョンは、SQLite 統合プラグインに従った `5.9.9` です。

<!--
**Note:** the oldest supported WordPress version is `5.9.9`, following the SQLite integration plugin.
-->

<BlueprintExample blueprint={{
    "landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.0",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

## ブループリントバンドルの使用

<!--
## Using Blueprint Bundles
-->

以下は、ブループリント バンドルからバンドルされたリソースを使用するブループリントの例です。

<!--
Here's an example of a Blueprint that uses bundled resources from a Blueprint bundle:
-->

```json
{
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.0",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/my-theme.zip"
			},
			"activate": true
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/my-plugin.zip"
			},
			"activate": true
		},
		{
			"step": "writeFile",
			"path": "/wordpress/custom-page.html",
			"data": {
				"resource": "bundled",
				"path": "/assets/custom-page.html"
			}
		}
	]
}
```

このブループリント バンドルは、次のファイルを含む zip ファイルになります。

<!--
This Blueprint bundle would be zip file containing the following files:
-->

-   `/blueprint.json` - 上記で説明したブループリントの宣言
-   `/my-theme.zip` - テーマパッケージ
-   `/my-plugin.zip` - プラグインパッケージ
-   `/assets/custom-page.html` - カスタム HTML ファイル

<!--
-   `/blueprint.json` - The blueprint declaration outlined above
-   `/my-theme.zip` - A theme package
-   `/my-plugin.zip` - A plugin package
-   `/assets/custom-page.html` - A custom HTML file
-->

このブループリント バンドルは次の方法で使用できます。

<!--
You can use this Blueprint bundle by:
-->

1. これらのファイルと blueprint.json を含む ZIP ファイルを作成する
2. ZIP ファイルをサーバーにホストする
3. `?blueprint-url=https://example.com/my-blueprint-bundle.zip` で読み込む

<!--
1. Creating a ZIP file with these files and the blueprint.json
2. Hosting the ZIP file on a server
3. Loading it with `?blueprint-url=https://example.com/my-blueprint-bundle.zip`
-->

ブループリント バンドルの詳細については、[ブループリント バンドル](/blueprints/bundles) ドキュメントを参照してください。

<!--
For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation.
-->
