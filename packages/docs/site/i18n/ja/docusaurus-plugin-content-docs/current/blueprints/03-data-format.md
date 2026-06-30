---
sidebar_position: 1
title: ブループリントデータ形式
slug: /blueprints/data-format
---

# ブループリントデータ形式

<!--
# Blueprint data format
-->

ブループリント JSON ファイルには、Playground インスタンスを定義するために使用する様々なプロパティを含めることができます。最も重要なプロパティについては以下で詳しく説明します。

<!--
A Blueprint JSON file can have many different properties that will be used to define your Playground instance. The most important properties are detailed below.
-->

以下に、それらの多くを使用する例を示します。

<!--
Here's an example that uses many of them:
-->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	},
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}} />

## JSON スキーマ

<!--
## JSON schema
-->

JSON ファイルの記述は面倒で、間違いやすいものです。Playground では、エディタで自動補完と検証を利用できる[JSON スキーマ](https://playground.wordpress.net/blueprint-schema.json)ファイルを提供しています。`$schema`プロパティを以下のように設定するだけです。

<!--
JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get auto-completion and validation in your editor. Just set the `$schema` property to the following:
-->

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

## ランディングページ

<!--
## Landing page
-->

`landingPage` プロパティは、ブループリント実行後に Playground にどの URL へ移動するかを指定します。これは特にテーマやプラグインのデモを作成する際に便利なツールです。多くの場合、サイトエディタで Playground を起動したり、投稿エディタで特定の投稿を開いたりする必要があるでしょう。必ず相対パスを使用してください。

<!--
The `landingPage` property tells Playground which URL to navigate to after the Blueprint has been run. This is a great tool, especially when creating theme or plugin demos. Often, you will want to start Playground in the Site Editor or have a specific post open in the Post Editor. Make sure you use a relative path.
-->

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

## 推奨バージョン

<!--
## Preferred versions
-->

`preferredVersions` プロパティは、優先する PHP および WordPress のバージョンを宣言します。以下のプロパティを含めることができます。

<!--
The `preferredVersions` property declares your preferred PHP and WordPress versions. It can contain the following properties:
-->

- `php` (文字列): 指定された PHP バージョンを読み込みます。`7.4`、`8.0`、`8.1`、`8.2`、`8.3`、`8.4`、`8.5`、`latest` が使用できます。`7.4.1` などのマイナーバージョンはサポートされていません。
- `wp` (文字列): 指定された WordPress バージョンを読み込みます。最新の 4 つのメジャー WordPress バージョンが使用できます。2024 年 6 月 1 日時点では、`6.2`、`6.3`、`6.4`、`6.5` が使用できます。汎用値として `latest`、`nightly`、`beta` も使用できます。WordPress のプレリリース版を使用する場合、`beta` はリリースサイクルの最新のベータ版またはリリース候補版 (ベータ版または RC 版) を読み込みます。

<!--
-   `php` (string): Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, or `latest`. Minor versions like `7.4.1` are not supported.
-   `wp` (string): Loads the specified WordPress version. Accepts the last four major WordPress versions. As of June 1, 2024, that's `6.2`, `6.3`, `6.4`, or `6.5`. You can also use the generic values `latest`, `nightly`, or `beta`. To use a pre-release version of WordPress, `beta` will load the latest beta or release candidate versions of a release cycle (Beta or RC).
-->

```js
{
	"preferredVersions": {
		"php": "8.0",
		"wp": "6.5"
	},
}
```

## 特徴

<!--
## Features
-->

`features` プロパティを使用して、Playground インスタンスの特定の機能をオンまたはオフにすることができます。このプロパティには以下のプロパティが含まれます。

<!--
You can use the `features` property to turn on or off certain features of the Playground instance. It can contain the following properties:
-->

- `networking`: デフォルトは `true` です。Playground のネットワークサポートを有効または無効にします。有効にすると、[`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) などの WordPress 関数は、実際には `fetch()` を使用して HTTP リクエストを送信します。無効にすると、代わりに即座に失敗します。ユーザーがプラグインやテーマをインストールできるようにするには、このプロパティを有効にする必要があります。

<!--
-   `networking`: Defaults to `true`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead. You will need this property enabled if you want the user to be able to install plugins or themes.
-->

```js
{
	"features": {
		"networking": false
	},
}
```

## 追加ライブラリ

<!--
## Extra libraries
-->

Playground インスタンスに追加のライブラリをプリロードできます。以下のライブラリがサポートされています。

<!--
You can preload extra libraries into the Playground instance. The following libraries are supported:
-->

- `wp-cli`: Playground の WP-CLI サポートを有効にします。これを含めると、起動時に WP-CLI がインストールされます。含めない場合、JS API を使用して WP-CLI コマンドを実行しようとするとエラーメッセージが表示されます。ブループリントに `wp-cli` ステップが含まれている場合、WP-CLI はデフォルトでインストールされます。

<!--
-   `wp-cli`: Enables WP-CLI support for Playground. If included, WP-CLI will be installed during boot. If not included, you will get an error message when trying to run WP-CLI commands using the JS API. WP-CLI will be installed by default if the blueprint contains any `wp-cli` steps.
-->

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

## 手順

<!--
## Steps
-->

おそらく最も強力なプロパティである `steps` を使うと、Playground インスタンスにプリインストールされたテーマ、プラグイン、デモコンテンツなどを設定できます。次の例では、専用のユーザー名とパスワードでユーザーをログインさせ、Gutenberg プラグインをインストールして有効化します。[steps の詳細](/blueprints/steps)

<!--
Arguably the most powerful property, `steps` allows you to configure the Playground instance with preinstalled themes, plugins, demo content, and more. The following example logs the user in with a dedicated username and password. It then installs and activates the Gutenberg plugin. [Learn more about steps](/blueprints/steps).
-->

```js
{
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
				"slug": "gutenberg"
			}
		},
	]
}
```
