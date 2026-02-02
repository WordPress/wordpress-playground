---
slug: /developers/architecture/browser-tab-orchestrates-execution
---

# ブラウザタブが実行を調整します

<!--
# Browser tab orchestrates the execution
-->

メインの`index.html`はアプリケーション全体をまとめる役割を果たします。すべての同時プロセスを起動し、PHPレスポンスを表示します。アプリケーションはメインの`index.html`が存在する限り有効です。

<!--
The main `index.html` ties the entire application together. It starts all the concurrent processes and displays the PHP responses. The app only lives as long as the main `index.html`.
-->

残りのドキュメントを読む際には、この点に留意してください。この時点では明らかなように思えるかもしれませんが、後々分かりにくくなる可能性があります。このパッケージは、Web Worker、Service Worker、そして将来的には Shared Worker を使用して、ブラウザタブの外でコードを実行します。これらの Worker の一部は、`index.html` を含むブラウザタブが閉じられた後も実行され続ける可能性があります。

<!--
Keep this point in mind as you read through the rest of the docs. At this point it may seem obvious, by the lines may get blurry later on. This package runs code outside of the browser tab using Web Workers, Service Workers, and, in the future, Shared Workers. Some of these workers may keep running even after the browser tab with `index.html` is closed.
-->

## ブートシーケンス

<!--
## Boot sequence
-->

最小限のアプリのブート シーケンスは次のようになります。

<!--
Here's what a boot sequence for a minimal app looks like:
-->

![The boot sequence](@site/static/img/boot-sequence.webp)

メインアプリは、iframe、サービスワーカー、そしてワーカースレッドを起動します。メインアプリはPHPスタックを直接使用していないことに注意してください。すべてワーカースレッドで処理されます。

<!--
The main app initiates the Iframe, the Service Worker, and the Worker Thread. Note how the main app doesn't use the PHP stack directly – it's all handled in the Worker Thread.
-->

ブート シーケンスをコードで表すと次のようになります。

<!--
Here's what that boot sequence looks like in code:
-->

**/index.html**:

```js
<script src="/app.ts"></script>
<iframe id="my-app"></iframe>
```

**/app.ts**:

```ts
import { consumeAPI, PHPClient, registerServiceWorker, spawnPHPWorkerThread } from '@php-wasm/web';

const workerUrl = '/worker-thread.js';

export async function startApp() {
	const phpClient = consumeAPI<PlaygroundWorkerEndpoint>(
		await spawnPHPWorkerThread(
			workerUrl, // Valid Worker script URL
			{
				wpVersion: 'latest',
				phpVersion: '8.3', // Startup options
			}
		)
	);

	// Await the two-way communication channel
	await phpClient.isReady();

	// Must point to a valid Service Worker script:
	await registerServiceWorker(
		phpClient,
		'default', // PHP instance scope, keep reading to learn more.
		'/sw.js', // Valid Service Worker script URL.
		'1' // Service worker version, used for reloading the script.
	);

	// Create a few PHP files to browse:
	await workerThread.writeFile('/index.php', '<a href="page.php">Go to page.php</a>');
	await workerThread.writeFile('/page.php', '<?php echo "Hello from PHP!"; ?>');

	// Navigate to index.php:
	document.getElementById('my-app').src = playground.pathToInternalUrl('/index.php');
}
startApp();
```

これらすべての要素がどのように組み合わさるのかを学ぶために読み続けてください。

<!--
Keep reading to learn how all these pieces fit together.
-->

### データフロー

<!--
### Data flow
-->

iframe が同じドメインのリクエストを発行するたびに、次のことが起こります。

<!--
Here's what happens whenever the iframe issues a same-domain request:
-->

![The data flow](@site/static/img/data-flow.webp)

ステップごとの内訳:

<!--
A step-by-step breakdown:
-->

1. リクエストはサービスワーカーによってインターセプトされます。
2. サービスワーカーはリクエストをワーカースレッドに渡します。
3. ワーカースレッドはリクエストをレスポンスに変換するために `PHP.request` を呼び出します。
4. ワーカースレッドはレスポンスをサービスワーカーに渡します。
5. サービスワーカーはブラウザにレスポンスを提供します。

<!--
1.  The request is intercepted by the Service Worker
2.  The Service Worker passes it to the Worker Thread
3.  The Worker Thread calls `PHP.request` to convert that request to a response
4.  The Worker Thread passes the response to the Service Worker
5.  The Service Worker provides the browser with a response
-->

この時点で、ユーザーがリンクをクリックしてリクエストがトリガーされた場合、ブラウザは PHPRequestHandler の応答を iframe 内にレンダリングします。

<!--
At this point, if the request was triggered by user clicking on a link, the browser will render PHPRequestHandler's response inside the iframe.
-->
