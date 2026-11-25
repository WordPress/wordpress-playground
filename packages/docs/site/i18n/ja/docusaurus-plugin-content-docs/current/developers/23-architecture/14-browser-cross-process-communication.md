# プロセス間通信

<!--
# Cross-process communication
-->

`@php-wasm/web`は、[Comlink](https://github.com/GoogleChromeLabs/comlink)ライブラリを使用して、JavaScriptで利用可能な一方向の`postMessage`を双方向の通信チャネルに変換します。

<!--
`@php-wasm/web` uses the [Comlink](https://github.com/GoogleChromeLabs/comlink) library to turns the one-way `postMessage` available in JavaScript into a two-way communication channel.
-->

もし `postMessage` という言葉に馴染みがなければ、これはJavaScriptのスレッド同士が通信するために使う機能です。先に進む前に、[MDN Docs](https://developer.mozilla.org/ja/docs/Web/API/Window/postMessage) を確認しておいてください。

<!--
If `postMessage` sounds unfamiliar, it's what JavaScript threads use to communicate. Please review the [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) before continuing.
-->

デフォルトでは、`postMessage` にはリクエストとレスポンスの仕組みが備わっていません。別のスレッドへメッセージを送ることも、そこから独立してメッセージを受け取ることもできますが、メッセージを送信してその特定のメッセージに対する返信を待つことはできません。

<!--
By default, `postMessage` does not offer any request/response mechanics. You may send messages to another thread and you may independently receive messages from it, but you can't send a message and await a response to that specific message.
-->

[Comlink](https://github.com/GoogleChromeLabs/comlink)ライブラリのドキュメントを引用すると、以下のようになります。

<!--
To quote the [Comlink](https://github.com/GoogleChromeLabs/comlink) library documentation:
-->

**main.js**

```js
import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
async function init() {
	const worker = new Worker('worker.js');
	// WebWorkers use `postMessage` and therefore work with Comlink.
	const obj = Comlink.wrap(worker);
	alert(`Counter: ${await obj.counter}`);
	await obj.inc();
	alert(`Counter: ${await obj.counter}`);
}
init();
```

**worker.js**

```js
importScripts('https://unpkg.com/comlink/dist/umd/comlink.js');

const obj = {
	counter: 0,
	inc() {
		this.counter++;
	},
};

Comlink.expose(obj);
```
