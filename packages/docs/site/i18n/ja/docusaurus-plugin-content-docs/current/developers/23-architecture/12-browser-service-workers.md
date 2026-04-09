---
slug: /developers/architecture/browser-service-workers
---

# サービスワーカー

<!--
# Service Workers
-->

[サービスワーカー](https://developer.mozilla.org/ja/docs/Web/API/Service_Worker_API/Using_Service_Workers) は、ブラウザー内の [`PHPRequestHandler`](/developers/architecture/browser-concepts) を使用して HTTP トラフィックを処理するために使用されます。

<!--
[A Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) is used to handle the HTTP traffic using the in-browser [`PHPRequestHandler`](/developers/architecture/browser-concepts).
-->

PHP スクリプトが次のページを [iframe ビューポート](/developers/architecture/browser-iframe-rendering) にレンダリングするとします。

<!--
Imagine your PHP script renders the following page [in the iframe viewport](/developers/architecture/browser-iframe-rendering):
-->

```html
<html>
	<head>
		<title>ジョンのウェブサイト</title>
	</head>
	<body>
		<a href="/">ホーム</a>
		<a href="/blog">ブログ</a>
		<a href="/contact">お問い合わせ</a>
	</body>
</html>
```

<!--
```html
<html>
	<head>
		<title>John's Website</title>
	</head>
	<body>
		<a href="/">Homepage</a>
		<a href="/blog">Blog</a>
		<a href="/contact">Contact</a>
	</body>
</html>
```
-->

ユーザーが例えば「Blog」リンクをクリックすると、ブラウザは通常、リモートサーバーに HTTP リクエストを送信し、「/blog」ページを取得して、現在の iframe コンテンツの代わりに表示します。しかし、私たちのアプリはリモートサーバー上で実行されていません。ブラウザは 404 ページを表示するだけです。

<!--
When the user clicks, say the `Blog` link, the browser would normally send a HTTP request to the remote server to fetch the `/blog` page and then display it instead of the current iframe contents. However, our app isn't running on the remote server. The browser would just display a 404 page.
-->

[サービスワーカー](https://developer.mozilla.org/ja/docs/Web/API/Service_Worker_API/Using_Service_Workers) を使用します。これは、HTTP リクエストをインターセプトしてブラウザ内で処理するツールです。

<!--
Enter [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) – a tool to intercept the HTTP requests and handle them inside the browser:
-->

![Service worker data flow](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/workers-diagram.webp)

### サービスワーカーのセットアップ

<!--
### Service Worker setup
-->

`/index.html` にあるメインアプリケーションは、サービスワーカーの登録を担当します。

<!--
The main application living in `/index.html` is responsible for registering the service worker.
-->

最小限の設定は次のとおりです。

<!--
Here's the minimal setup:
-->

**/app.js:**

```js
import { registerServiceWorker } from '@php-wasm/web';

function main() {
	await registerServiceWorker(
		phpClient,
		"default", // PHPインスタンススコープ
		"/sw.js",  // 有効な Service Worker 実装を指定する必要があります。
		"1"        // スクリプトの再読み込みに使用されるService Workerのバージョン。
	);

}
```

<!--
```js
import { registerServiceWorker } from '@php-wasm/web';

function main() {
	await registerServiceWorker(
		phpClient,
		"default", // PHP instance scope
		"/sw.js",  // Must point to a valid Service Worker implementation.
		"1"        // Service worker version, used for reloading the script.
	);

}
```
-->

また、HTTP リクエストを実際にインターセプトしてルーティングする `/service-worker.js` ファイルも別途必要です。最小限の実装は次のようになります。

<!--
You will also need a separate `/service-worker.js` file that actually intercepts and routes the HTTP requests. Here's what a minimal implementation looks like:
-->

**/service-worker.js**:

```js
import { initializeServiceWorker } from '@php-wasm/web';

// 現在のドメイン上のすべての HTTP トラフィックをインターセプトし、
// ワーカー スレッドに渡します。
initializeServiceWorker();
```

<!--
```js
import { initializeServiceWorker } from '@php-wasm/web';

// Intercepts all HTTP traffic on the current domain and
// passes it to the Worker Thread.
initializeServiceWorker();
```
-->
