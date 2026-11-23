---
title: Comunicação entre processos
description: Como o @php-wasm/web usa a biblioteca Comlink para transformar o postMessage em um canal de comunicação de mão dupla.
---

<!-- # Cross-process communication -->

# Comunicação entre processos

<!--
`@php-wasm/web` uses the [Comlink](https://github.com/GoogleChromeLabs/comlink) library to turns the one-way `postMessage` available in JavaScript into a two-way communication channel.
-->

O `@php-wasm/web` usa a biblioteca [Comlink](https://github.com/GoogleChromeLabs/comlink) para transformar o `postMessage`, que no JavaScript é de mão única, em um canal de comunicação de mão dupla.

<!--
If `postMessage` sounds unfamiliar, it's what JavaScript threads use to communicate. Please review the [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) before continuing.
-->

Se você não conhece o `postMessage`, ele é o que as threads do JavaScript usam para se comunicar. Leia a [documentação da MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) antes de continuar.

<!--
By default, `postMessage` does not offer any request/response mechanics. You may send messages to another thread and you may independently receive messages from it, but you can't send a message and await a response to that specific message.
-->

Por padrão, o `postMessage` não oferece nenhum mecanismo de requisição e resposta. Você pode enviar mensagens para outra thread e, de forma independente, receber mensagens dela, mas não pode enviar uma mensagem e aguardar a resposta a essa mensagem específica.

<!-- To quote the [Comlink](https://github.com/GoogleChromeLabs/comlink) library documentation: -->

Citando a documentação da biblioteca [Comlink](https://github.com/GoogleChromeLabs/comlink):

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
