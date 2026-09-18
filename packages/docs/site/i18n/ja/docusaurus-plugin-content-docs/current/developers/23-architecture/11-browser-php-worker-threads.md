---
slug: /developers/architecture/browser-php-worker-threads
---

# PHP ワーカースレッド

<!--
# PHP Worker Threads
-->

PHP ランタイムによってメイン Web サイトのユーザー インターフェイスの速度が低下しないように、PHP は常に [Web ワーカー](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) で実行されます。

<!--
PHP is always ran in a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to ensure the PHP runtime doesn't slow down the user interface of the main website.
-->

次のコードを想像してください。

<!--
Imagine the following code:
-->

```js
<button onclick="for(let i=0;i<100000000;i++>) {}">ページをフリーズする</button>
<input type="text" />
```

<!--
```js
<button onclick="for(let i=0;i<100000000;i++>) {}">Freeze the page</button>
<input type="text" />
```
-->

ボタンをクリックするとすぐにブラウザがフリーズし、入力できなくなります。これはブラウザの仕組みです。forループであれPHPサーバーであれ、負荷の高いタスクを実行するとユーザーインターフェースの動作が遅くなります。

<!--
As soon as you click that button the browser will freeze and you won't be able to type in the input. That's just how browsers work. Whether it's a for loop or a PHP server, running intensive tasks slows down the user interface.
-->

### Web ワーカーの起動

<!--
### Initiating web workers
-->

Web ワーカーは、メインアプリケーションの外部で負荷の高いタスクを処理できる独立したプログラムです。ブラウザタブ内のメインの JavaScript プログラムから起動する必要があります。手順は以下のとおりです。

<!--
Web workers are separate programs that can process heavy tasks outside of the main application. They must be initiated by the main JavaScript program living in the browser tab. Here's how:
-->

```ts
const phpClient = consumeAPI<PHPClient>(
	spawnPHPWorkerThread(
		'/worker-thread.js' // Valid Worker script URL
	)
);
await phpClient.isReady();
await phpClient.run({ code: `<?php echo "Hello from the thread!";` });
```

### Web ワーカーの制御

<!--
### Controlling web workers
-->

Web Worker を制御する唯一の方法は、メッセージの交換です。メインアプリケーションは、Web Worker 内の関数や変数にアクセスできません。`worker.postMessage` と `worker.onmessage = function(msg) { }` を使用してのみメッセージを送受信できます。

<!--
Exchanging messages is the only way to control web workers. The main application has no access to functions or variables inside of a web worker. It can only send and receive messages using `worker.postMessage` and `worker.onmessage = function(msg) { }`.
-->

これは面倒な作業になる可能性があるため、Playground では便利な [consumeAPI](/api/universal/function/consumeAPI) 関数を提供しています。この関数はメッセージ交換を抽象化し、Web Worker から特定の関数を公開します。そのため、上記の例では `phpClient.run` を呼び出すことができます。

<!--
This can be tedious, which is why Playground provides a convenient [consumeAPI](/api/universal/function/consumeAPI) function that abstracts the message exchange and exposes specific functions from the web worker. This is why we can call `phpClient.run` in the example above.
-->
