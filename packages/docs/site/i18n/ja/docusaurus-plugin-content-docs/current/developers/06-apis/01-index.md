---
title: API の概要
slug: /developers/apis/
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

## WordPress Playground API の概要

<!--
## WordPress Playground APIs overview
-->

WordPress Playground は、Playground と通信するために使用できるいくつかの API を公開しています。

<!--
WordPress Playground exposes a few APIs that you can use to interact with the Playground:
-->

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### クエリ API

<!--
### Query API
-->

基本的な操作は URL を調整することで実行できます。たとえば、coblocks プラグインを事前にインストールする方法は次のとおりです。

<!--
Basic operations can be done by adjusting the URL, for example here's how you can preinstall a coblocks plugin:
-->

[https://playground.wordpress.net/?plugin=coblocks](https://playground.wordpress.net/?plugin=coblocks)

またはテーマ:

<!--
Or a theme:
-->

[https://playground.wordpress.net/?theme=pendant](https://playground.wordpress.net/?theme=pendant)

<ThisIsQueryApi /> 気に入った URL ができたら、iframe を使用して Web サイトに埋め込むことができます。

<!--
<ThisIsQueryApi /> Once you have a URL that you like, you can embed it in your website using an iframe:
-->

```html
<iframe style="width: 800px; height: 500px;" src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

:::info
詳細については、[クエリ API](/developers/apis/query-api) セクションを確認してください。
:::

<!--
:::info
Check the [Query API](/developers/apis/query-api) section for more info.
:::
-->

### ブループリント

<!--
### Blueprints
-->

Playground をより細かく制御したい場合は、JSON ブループリントを使用できます。例えば、投稿を作成してプラグインをインストールする方法は次のとおりです。

<!--
If you need more control over your Playground, you can use JSON Blueprints. For example, here's how to create a post and install a plugin:
-->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
display={`{
  "steps": [
    {
      "step": "login"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "friends"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php include 'wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1)); ?>"
    }
  ]
}` }
blueprint={{
        "steps": [
            {
                "step": "login"
            },
            {
            step: 'installPlugin',
                pluginData: {
                    resource: 'wordpress.org/plugins',
                    slug: 'friends',
                },
            },
            {
                "step": "runPHP",
                "code": `<?php
include 'wordpress/wp-load.php';
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

<p></p>

:::info

WordPress Playground ではブループリントが重要な役割を果たすため、専用のドキュメントハブが用意されています。JSON ブループリントの詳細については、[ブループリント ドキュメント ハブ](/blueprints) をご覧ください。

:::

<!--
:::info

Blueprints play a significant role in WordPress Playground, so they have their own dedicated documentation hub. Learn more about JSON Blueprints at the [Blueprints Docs Hub](/blueprints).

:::
-->

### JavaScript API

<!--
### JavaScript API
-->

`@wp-playground/client` パッケージは、Playground インスタンスを完全に制御できる JavaScript API を提供します。以下に、実際にできることの簡単な例を示します。

<!--
The `@wp-playground/client` package provides a JavaScript API you can use to fully control your Playground instance. Here's a very example of what you can do:
-->

import JSApiShortExample from '@site/docs/\_fragments/\_js_api_short_example.mdx';

<JSApiShortExample />

:::info
詳細については、[JavaScript API](/developers/apis/javascript-api/) セクションをご覧ください。
:::

<!--
:::info
Check the [JavaScript API](/developers/apis/javascript-api/) section for more info.
:::
-->

## プレイグラウンド API の概念

<!--
## Playground APIs Concepts
-->

ブラウザ上の WordPress Playground は、リンクと iframe が中心です。どの API を選択しても、以下のいずれかの方法で使用します。

<!--
WordPress Playground in the browser is all about links and iframes. Regardless of which API you choose, you will use it in one of the following ways:
-->

### プレイグラウンドサイトへのリンク

<!--
### Link to the Playground site
-->

https://playground.wordpress.net/ リンクを変更することで、WordPress Playground をカスタマイズできます。例えば、投稿を作成したり、特定のプラグインをリクエストしたり、任意の PHP コードを実行したりできます。

<!--
You can customize WordPress Playground by modifying the https://playground.wordpress.net/ link. You can, for example, create a post, request a specific plugin, or run any PHP code.
-->

このようなリンクを準備するには、[クエリ API](/developers/apis/query-api) (簡単) または [JSON ブループリント API](/blueprints) (中程度) を使用します。

<!--
To prepare such a link, use either the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).
-->

完成したら、ウェブサイトに掲載するだけです。例えば、チュートリアルの「試してみる」ボタンとして最適です。

<!--
Once it's ready, simply post it on your site. It makes a great "Try it yourself" button in a tutorial, for example.
-->

#### `<iframe>` に埋め込む

<!--
#### Embed in an `<iframe>`
-->

WordPress Playground は、`<iframe>` を使用してアプリに埋め込むことができます。

<!--
WordPress Playground can be embedded in your app using an `<iframe>`:
-->

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

Playground インスタンスをカスタマイズするには、次の操作を行います。

<!--
To customize that Playground instance, you can:
-->

-   [クエリ API](/developers/apis/query-api) (簡単) または [JSON ブループリント API](/blueprints) (中) を使用して用意された専用リンクから読み込みます。
-   [JavaScript API](/developers/apis/javascript-api/) を使用して制御します。

<!--
-   Load it from special link prepared using the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).
-   Control it using the [JavaScript API](/developers/apis/javascript-api/).
-->

JavaScript API を使用すると、最も多くの制御が可能になりますが、Playground Client ライブラリを読み込む必要があるため、最も不便なオプションでもあります。

<!--
The JavaScript API gives you the most control, but it is also the least convenient option as it requires loading the Playground Client library.
-->

import PlaygroundWpNetWarning from '@site/docs/\_fragments/\_playground_wp_net_may_stop_working.md';

<PlaygroundWpNetWarning />

### ブラウザ APIs

<!--
### Browser APIs
-->

ブラウザでは次の Playground API が利用できます。

<!--
The following Playground APIs are available in the browser:
-->

import APIList from '@site/docs/\_fragments/\_api_list.mdx';

<APIList />

### Node.js の場合

<!--
### In Node.js
-->

Node.js では次の Playground API が利用できます。

<!--
The following Playground APIs are available in Node.js:
-->

-   [JSON ブループリント API](/blueprints)
-   [JavaScript API](/developers/apis/javascript-api/)

<!--
-   [JSON Blueprints API](/blueprints)
-   [JavaScript API](/developers/apis/javascript-api/)
-->

これらの API は Web 版の API と非常に似ていますが、当然のことながら、リンクや iframe に基づいていません。

<!--
These APIs are very similar to their web counterparts, but, unsurprisingly, they are not based or links or iframes.
-->
