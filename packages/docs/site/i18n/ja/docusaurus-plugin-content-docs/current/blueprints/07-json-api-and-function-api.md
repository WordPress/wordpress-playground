---
title: APIの一貫性
slug: /blueprints/steps/api-consistency
---

# JSON API と関数 API

<!--
# JSON API and Function API
-->

ブループリントは JSON 形式で定義されますが、基盤となる実装では JavaScript 関数を使用してステップを実行します。JSON はブループリントを操作する最も便利な方法ですが、基盤となる関数を直接使用することもできます。

<!--
Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly.
-->

JSON は関数を包むラッパーに過ぎません。JSON ステップを使用する場合でも、エクスポートされた関数を使用する場合でも、同じパラメータ（ステップ名を除く）を指定する必要があります。

<!--
JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name):
-->

Blueprints は、WordPress Playground の Web バージョンと node.js バージョンの両方で使用できます。

<!--
You can use Blueprints both with the web and the node.js versions of WordPress Playground.
-->

<div class="callout callout-info">

**Blueprints バージョン 2**

Blueprint v2 の宣言は Playground の Web アプリ、client パッケージ、CLI でサポートされています。
バージョン 2 は JSON 宣言モデルを維持しつつ、WordPress のセットアップを
`plugins`、`themes`、`content`、`media` などの上位セクションへ移し、
`additionalStepsAfterExecution` で追加ステップも指定できます。

公開されている [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json)
は v1 と v2 の両方の宣言を検証します。v2 を使うには `"version": 2` を設定してください。

</div>

<!--
<div class="callout callout-info">

**Blueprints version 2**

Blueprint v2 declarations are supported by the Playground web app, client package, and CLI. Version 2 keeps the JSON declaration model but moves WordPress setup into higher-level sections such as `plugins`, `themes`, `content`, and `media`, with escape hatches in `additionalStepsAfterExecution`.

The public Blueprint JSON schema validates both v1 and v2 declarations. To opt into v2, set `"version": 2`.

</div>
-->

## JSON API と関数 API の違い

<!--
## Differences between JSON and Function APIs
-->

JSON API と Function API には主に 2 つの違いがあります:

<!--
There are two main differences between the JSON and Function APIs:
-->

1. ブループリントはプログレスバーとエラーレポートを自動的に処理します。関数 API を使用する場合は、これらを自分で処理する必要があります。
2. 関数 API を使用する場合は API クライアントライブラリをインポートする必要がありますが、ブループリントは URL フラグメントに貼り付けるだけで済みます。

<!--
1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself.
2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment.
-->

<div class="callout callout-info">

このトピックの詳細については、[wordpress-playground](https://github.com/WordPress/wordpress-playground) リポジトリの [Blueprint JSON 定義とステップ ハンドラーに同じ構造を使用する](https://github.com/WordPress/wordpress-playground/pull/215) の問題を確認してください。

</div>

<!--
<div class="callout callout-info">

Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic

</div>
-->
