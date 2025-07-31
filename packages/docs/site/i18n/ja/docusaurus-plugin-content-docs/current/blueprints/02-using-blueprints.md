---
title: ブループリントの使用
slug: /blueprints/using-blueprints
---

# ブループリントの使用

<!--
# Using Blueprints
-->

ブループリントは次のいずれかの方法で使用できます。

<!--
You can use Blueprints in one of the following ways:
-->

-   URL フラグメントとして Playground に渡す。
-   `blueprint-url` パラメータを使用して URL から読み込む。
-   Blueprint バンドル（ZIP ファイルまたはディレクトリ）を使用する。
-   JavaScript API を使用する。

<!--
-   By passing them as a URL fragment to the Playground.
-   By loading them from a URL using the `blueprint-url` parameter.
-   By using Blueprint bundles (ZIP files or directories).
-   By using the JavaScript API.
-->

## URL フラグメント

<!--
## URL Fragment
-->

ブループリントを使い始める最も簡単な方法は、WordPress Playground の Web サイトの URL「フラグメント」にブループリントを貼り付けることです (例: `https://playground.wordpress.net/#{"preferredVersions...`)。

<!--
The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`.
-->

たとえば、特定のバージョンの WordPress と PHP でプレイグラウンドを作成するには、次のブループリントを使用します。

<!--
For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint:
-->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	}
}
```

次に、`https://playground.wordpress.net/#{"preferredVersions":{"php":"7.4","wp":"6.5"}}` にアクセスします。

<!--
And then you would go to
`https://playground.wordpress.net/#{"preferredVersions":{"php":"7.4","wp":"6.5"}}`.
-->

:::tip
JavaScript では、[`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) と [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) を使用して、ブループリントの JSON をコンパクトに圧縮できます。
例:

```js
const blueprintJson = `{
"$schema": "https://playground.wordpress.net/blueprint-schema.json",
"preferredVersions": {
"php": "7.4",
"wp": "6.5"
}
}`;
const minifiedBlueprintJson = JSON.stringify(JSON.parse(blueprintJson)); // {"preferredVersions":{"php":"7.4","wp":"6.5"}}
```

:::

<!--
:::tip
In Javascript, you can get a compact version of any blueprint JSON with [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
Example:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = JSON.stringify(JSON.parse(blueprintJson)); // {"preferredVersions":{"php":"7.4","wp":"6.5"}}
```

:::
-->

リンクを貼り付ける必要はありません。「試してみる」ボタンをクリックすると、自動的にコード例が実行されます。

<!--
You won't have to paste links to follow along. We'll use code examples with a "Try it out" button that will automatically run the examples for you:
-->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	}
}} />

### Base64 エンコードされたブループリント

<!--
### Base64 encoded Blueprints
-->

GitHub などの一部のツールでは、ブループリントを URL に貼り付けると正しくフォーマットされない場合があります。そのような場合は、ブループリントを Base64 でエンコードし、URL に追加してください。例えば、上記のブループリントを Base64 形式で保存すると以下のようになります。`eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

<!--
Some tools, including GitHub, might not format the Blueprint correctly when pasted into the URL. In such cases, encode your Blueprint in Base64 and append it to the URL. For example, that's the above Blueprint in Base64 format: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.
-->

実行するには、https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19 にアクセスしてください。

<!--
To run it, go to https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
-->

:::tip
JavaScript では、グローバル関数 `btoa()` を使用して、任意のブループリント JSON を [Base64 形式](https://developer.mozilla.org/ja/docs/Glossary/Base64#javascript_%E3%81%AE%E5%AF%BE%E5%BF%9C) で取得できます。

例:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = btoa(blueprintJson); // eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
```

:::

<!--
:::tip
In JavaScript, You can get any blueprint JSON in [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) with global function `btoa()`.

Example:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = btoa(blueprintJson); // eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
```

:::
-->

### URL からブループリントを読み込む

<!--
### Load Blueprint from a URL
-->

ブループリントが扱いにくくなった場合は、次のように URL の `?blueprint-url` クエリ パラメータを使用して読み込むことができます。

<!--
When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:
-->

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

ブループリントは公開アクセス可能であり、[正しい `Access-Control-Allow-Origin` ヘッダー](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin) とともに提供される必要があることに注意してください。

<!--
Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin):
-->

```
Access-Control-Allow-Origin: *
```

#### ブループリントバンドル

<!--
#### Blueprint Bundles
-->

`?blueprint-url` パラメータが、ZIP 形式のブループリントバンドルもサポートするようになりました。ブループリントバンドルは、ルートレベルに `blueprint.json` ファイルと、ブループリントが参照する追加リソースを含む ZIP ファイルです。

<!--
The `?blueprint-url` parameter now also supports Blueprint bundles in ZIP format. A Blueprint bundle is a ZIP file that contains a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

たとえば、次のようにしてブループリント バンドルをロードできます。

<!--
For example, you can load a Blueprint bundle like this:
-->

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

Blueprint バンドルを使用する場合、`bundled` リソース タイプを使用してバンドルされたリソースを参照できます。

<!--
When using a Blueprint bundle, you can reference bundled resources using the `bundled` resource type:
-->

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		}
	]
}
```

ブループリント バンドルの詳細については、[ブループリント バンドル](/blueprints/bundles) ドキュメントを参照してください。

<!--
For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation.
-->

## JavaScript API

<!--
## JavaScript API
-->

`@wp-playground/client` パッケージの `startPlaygroundWeb()` 関数を使えば、JavaScript API で Blueprints を使うこともできます。JSFiddle または CodePen で実行できる、自己完結型の小さなサンプルを以下に示します。

<!--
You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen:
-->

```html
<iframe id="wp-playground" style="width: 1200px; height: 800px"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp-playground'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
		blueprint: {
			landingPage: '/wp-admin/',
			preferredVersions: {
				php: '8.0',
				wp: 'latest',
			},
			steps: [
				{
					step: 'login',
					username: 'admin',
					password: 'password',
				},
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'friends',
					},
				},
			],
		},
	});

	const response = await client.run({
		// wp-load.php is only required if you want to interact with WordPress.
		code: '<?php require_once "/wordpress/wp-load.php"; $posts = get_posts(); echo "Post Title: " . $posts[0]->post_title;',
	});
	console.log(response.text);
</script>
```
