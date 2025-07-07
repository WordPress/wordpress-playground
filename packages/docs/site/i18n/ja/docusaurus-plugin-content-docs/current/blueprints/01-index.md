---
title: はじめる
slug: /blueprints/getting-started
---

# ブループリントを使い始める

<!--
# Getting started with Blueprints
-->

ブループリントは、WordPress Playground インスタンスを独自にセットアップするための JSON ファイルです。例えば：

<!--
Blueprints are JSON files for setting up your very own WordPress Playground instance. For example:
-->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.0",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}
```

ブループリントを使用するには 3 つの方法があります。

<!--
There are three ways to use Blueprints:
-->

-   [WordPress Playground ウェブサイトの URL「fragment」にブループリントを貼り付けます](/blueprints/using-blueprints#url-fragment)。
-   [JavaScript API で使用します](/blueprints/using-blueprints#javascript-api)。
-   [QueryParam blueprint-url 経由でブループリントの JSON ファイルを参照します](/developers/apis/query-api/)

<!--
-   [Paste a Blueprint into the URL "fragment" on WordPress Playground website](/blueprints/using-blueprints#url-fragment).
-   [Use them with the JavaScript API](/blueprints/using-blueprints#javascript-api).
-   [Reference a blueprint JSON file via QueryParam blueprint-url](/developers/apis/query-api/)
-->

## ブループリントによってどのような問題が解決されますか?

<!--
## What problems are solved by Blueprints?
-->

### コーディングスキルは不要

<!--
### No coding skills required
-->

ブループリントは JSON 形式で記述します。開発環境やライブラリ、JavaScript の知識も必要ありません。どんなテキストエディタでも記述できます。

<!--
Blueprints are just JSON. You don't need a development environment, any libraries, or even JavaScript knowledge. You can write them in any text editor.
-->

ただし、開発環境をお持ちの場合は、それは素晴らしいことです。[Blueprint JSON スキーマ](https://playground.wordpress.net/blueprint-schema.json) を使用して、自動補完と検証を利用できます。

<!--
However, if you do have a development environment, that's great! You can use the [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) to get autocompletion and validation.
-->

### HTTP リクエストは自動的に管理されます

<!--
### HTTP Requests are managed for you
-->

ブループリントは、宣言したリソースを自動的に取得します。複数の `fetch()` 呼び出しを管理したり、それらの完了を待ったりする必要はありません。いくつかのリンクを宣言するだけで、ブループリントがダウンロードパイプラインを処理・最適化します。

<!--
Blueprints fetch any resources you declare for you. You don't have to worry about managing multiple `fetch()` calls or waiting for them to finish. You can just declare a few links and let Blueprints handle and optimize the downloading pipeline.
-->

### ブループリントで事前設定されたプレイグラウンドにリンクできます

<!--
### You can link to a Blueprint-preconfigured Playground
-->

ブループリントは URL に貼り付けることができるため、特定の設定の Playground を埋め込んだり、リンクしたりできます。例えば、このボタンをクリックすると、PHP 7.4 とペンダントテーマがインストールされた Playground が開きます。

<!--
Because Blueprints can be pasted in the URL, you can embed or link to a Playground with a specific configuration. For example, clicking this button will open a Playground with PHP 7.4 and a pendant theme installed:
-->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "7.4",
  		"wp": "latest"
	},
	"steps": [
        {
            "step": "installTheme",
            "themeData": {
                "resource": "wordpress.org/themes",
            	"slug": "pendant"
            },
            "options": {
                "activate": true
            }
        }
	]
}} />

### デフォルトで信頼される

<!--
### Trusted by default
-->

ブループリントは単なる JSON です。他の人のブループリントを実行するのに信頼は必要ありません。ブループリントは任意の JavaScript を実行できないため、できることには制限があります。

<!--
Blueprints are just JSON. Running other people's Blueprints doesn't require the element of trust. Since Blueprints cannot execute arbitrary JavaScript, they are limited in what they can do.
-->

ブループリントを利用することで、WordPress.org プラグインディレクトリでプラグインのライブプレビューを提供できるようになります。プラグイン作成者は、カスタムブループリントを作成するだけで、必要なサイトオプションやスターターコンテンツなど、Playground インスタンスを事前設定できます。

<!--
With Blueprints, WordPress.org plugin directory may be able to offer live previews of plugins. Plugin authors will just write a custom Blueprint to preconfigure the Playground instance with any site options or starter content they may need.
-->

### 一度書けばどこでも使える

<!--
### Write it once, use it anywhere
-->

ブループリントは Web と Node.js の両方で動作します。同じ JavaScript プロセス内で実行することも、リモートの Playground クライアント経由で実行することもできます。ブループリントは設定のための普遍的な言語です。Playground を実行できる場所であれば、ブループリントを使用できます。

<!--
Blueprints work both on the web and in node.js. You can run them both in the same JavaScript process, and through a remote Playground Client. They are the universal language of configuration. Where you can run Playground, you can use Blueprints.
-->
