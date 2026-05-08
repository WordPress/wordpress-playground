---
slug: /developers/apis/javascript-api
---

# JavaScript API

WordPress Playground には、WordPress を完全に制御できる JavaScript API クライアントが付属しています。

<!--
WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress.
 -->

<div class="callout callout-info">

**ここでの API は「REST API」を意味するものではありません**

WordPress Playground はブラウザベースのアプリケーションです。
ここでの API とは、JavaScript 内で呼び出せる関数のセットを指します。
これはネットワークベースの REST API ではありません。

</div>

<!--
:::info API here doesn't mean "REST API"

WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API.

:::
 -->

## クイックスタート

<!--
## Quick start
 -->

JavaScript API を使用するには、次のものが必要です。

<!--
To use the JavaScript API, you'll need:
 -->

- `<iframe>` 要素
- `@wp-playground/client` パッケージ（npm または CDN から）

<!--
-   An `<iframe>` element
-   The `@wp-playground/client` package (from npm or a CDN)
 -->

HTML ページで JavaScript API を使用する最も短い例を次に示します。

<!--
Here's the shortest example of how to use the JavaScript API in a HTML page:
 -->

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	// Use unpkg for convenience
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
	});
	// Let's wait until Playground is fully loaded
	await client.isReady();
</script>
```

<div class="callout callout-info">

**/remote.html は特別な URL です**

`/remote.html` は、ブラウザ UI を備えたデモアプリではなく、Playground API エンドポイントを読み込む特別な URL です。`/` と `/remote.html` の違いについては、[このページ](/developers/apis/javascript-api/-html-vs-remote-html) をご覧ください。

</div>

<!--
:::info /remote.html is a special URL

`/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about the difference between `/` and `/remote.html` and [on this page](/developers/apis/javascript-api/-html-vs-remote-html).

:::
 -->

## ウェブサイトの制御

<!--
## Controlling the website
 -->

`client` オブジェクトが作成されたので、これを使って iframe 内のウェブサイトを制御できます。制御方法は 3 つあります。

<!--
Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that:
 -->

- [Playground API Client](/developers/apis/javascript-api/playground-api-client)
- [ブループリント JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [ブループリント 関数](/developers/apis/javascript-api/blueprint-functions-in-api-client)

<!--
-   [Playground API Client](/developers/apis/javascript-api/playground-api-client)
-   [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
-   [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client)
 -->

## デバッグとテスト

<!--
## Debugging and testing
 -->

迅速なテストとデバッグのために、JavaScript API クライアントは `index.html` と `remote.html` の両方で `window.playground` として公開されます。

<!--
For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`.
 -->

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

`index.html` では、`playground` は Proxy オブジェクトなので、ブラウザによる自動補完は利用できません。ただし、`remote.html` では、`playground` はクラスインスタンスなので、ブラウザの自動補完を利用できます。

<!--
Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion.
 -->
