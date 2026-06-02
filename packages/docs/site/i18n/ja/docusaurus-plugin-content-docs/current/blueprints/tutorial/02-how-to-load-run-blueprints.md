---
title: ブループリントの実行方法
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: URL フラグメントや blueprint-url パラメータの使用など、ブループリントを読み込んで実行するためのさまざまな方法について学習します。
---

# ブループリントをロードして実行する方法

<!--
# How to load and run Blueprints
 -->

## URL フラグメント

<!--
## URL fragment
 -->

ブループリントを実行する最も速い方法は、WordPress Playground ウェブサイトの URL「フラグメント」にブループリントを貼り付けることです。「.net/」の後に「#」を追加するだけです。

<!--
The fastest way to run Blueprints is to paste one into the URL "fragment" of a WordPress Playground website. Just add a `#` after the `.net/`.
 -->

次のブループリントを使用して、特定のバージョンの WordPress と PHP でプレイグラウンドを作成するとします。

<!--
Let's say you want to create a Playground with specific versions of WordPress and PHP using the following Blueprint:
 -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

実行するには、`https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}` にアクセスしてください。以下のボタンもご利用いただけます。

<!--
To run it, go to `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. You can also use the button below:
 -->

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

この方法を使用して、次の章「**最初のブループリントを作成する**」(/blueprints/tutorial/build-your-first-blueprint) のサンプル コードを実行します。

<!--
Use this method to run the example code in the next chapter, [**Build your first Blueprint**](/blueprints/tutorial/build-your-first-blueprint).
-->

### Base64 エンコードされたブループリント

<!--
### Base64 encoded Blueprints
-->

GitHub などの一部のツールでは、ブループリントを URL に貼り付けても正しくフォーマットされない場合があります。そのような場合は、[ブループリントを Base64 でエンコード](https://www.base64encode.org)し、URL に追加してください。例えば、上記のブループリントを Base64 形式でエンコードすると、「eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19」となります。

<!--
Some tools, including GitHub, might not format the Blueprint correctly when pasted into the URL. In such cases, [encode your Blueprint in Base64](https://www.base64encode.org) and append it to the URL. For example, that's the above Blueprint in Base64 format: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.
-->

実行するには、[https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19) にアクセスしてください。

<!--
To run it, go to [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)
-->

### URL からブループリントを読み込む

<!--
### Load Blueprint from a URL
-->

ブループリントが扱いにくくなった場合は、次のように URL の `?blueprint-url` クエリ パラメータを使用して読み込むことができます。

<!--
When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:
-->

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

ブループリントは公開アクセス可能であり、[正しい `Access-Control-Allow-Origin` ヘッダー](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin) とともに提供される必要があることに注意してください。

<!--
Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin):
-->

```
Access-Control-Allow-Origin: *
```
