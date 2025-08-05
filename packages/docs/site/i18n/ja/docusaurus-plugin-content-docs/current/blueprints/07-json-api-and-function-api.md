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

:::info ブループリント バージョン 2

チームは、Blueprints を TypeScript ライブラリから PHP ライブラリに移行する方法を検討しています。これにより、Playground、ホストされたサイト、ローカル環境など、あらゆる WordPress 環境で Blueprints を実行できるようになります。

提案されている [新しい仕様](https://github.com/WordPress/blueprints-library/issues/6) については、別の [GitHub リポジトリ](https://github.com/WordPress/blueprints-library/) で議論されています。ぜひご参加ください（GitHub リポジトリまたは [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) Slack チャンネルで）。次世代の Playground の策定にご協力ください。
:::

<!--
:::info Blueprints version 2

The team is exploring ways to transition Blueprints from a TypeScript library to a PHP library. This would allow people to run Blueprints in any WordPress environments: Playground, a hosted site, or a local setup.

The proposed [new specification](https://github.com/WordPress/blueprints-library/issues/6) is discussed on a separate [GitHub repository](https://github.com/WordPress/blueprints-library/), and you’re more than welcome to join (there or on the [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) Slack channel) and help shape the next generation of Playground.
:::
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

:::note
このトピックの詳細については、[wordpress-playground](https://github.com/WordPress/wordpress-playground) リポジトリの [Blueprint JSON 定義とステップ ハンドラーに同じ構造を使用する](https://github.com/WordPress/wordpress-playground/pull/215) の問題を確認してください。
:::

<!--
:::note
Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic
:::
-->
