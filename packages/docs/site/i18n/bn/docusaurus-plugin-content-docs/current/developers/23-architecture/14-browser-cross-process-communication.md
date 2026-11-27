---
title: ক্রস-প্রসেস কমিউনিকেশন
description: ব্রাউজারের JavaScript থ্রেডগুলোর মধ্যে একমুখী postMessage-কে দ্বিমুখী যোগাযোগ চ্যানেলে রূপান্তর করতে @php-wasm/web কীভাবে Comlink লাইব্রেরি ব্যবহার করে তা জানুন।
---

<!--
# Cross-process communication
-->

# ক্রস-প্রসেস কমিউনিকেশন {#cross-process-communication}

<!--
`@php-wasm/web` uses the [Comlink](https://github.com/GoogleChromeLabs/comlink) library to turns the one-way `postMessage` available in JavaScript into a two-way communication channel.

If `postMessage` sounds unfamiliar, it's what JavaScript threads use to communicate. Please review the [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) before continuing.

By default, `postMessage` does not offer any request/response mechanics. You may send messages to another thread and you may independently receive messages from it, but you can't send a message and await a response to that specific message.

To quote the [Comlink](https://github.com/GoogleChromeLabs/comlink) library documentation:
-->

JavaScript-এ থাকা একমুখী `postMessage`-কে দ্বিমুখী যোগাযোগ চ্যানেলে রূপান্তর করতে `@php-wasm/web` [Comlink](https://github.com/GoogleChromeLabs/comlink) লাইব্রেরি ব্যবহার করে।

`postMessage` যদি আপনার কাছে অপরিচিত মনে হয়, তবে এটিই সেই মাধ্যম যা ব্যবহার করে JavaScript থ্রেডগুলো নিজেদের মধ্যে যোগাযোগ করে। সামনে এগোনোর আগে অনুগ্রহ করে [MDN ডক্স](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) দেখে নিন।

ডিফল্টভাবে `postMessage` কোনো রিকোয়েস্ট/রেসপন্স ব্যবস্থা দেয় না। আপনি অন্য কোনো থ্রেডে মেসেজ পাঠাতে পারেন এবং আলাদাভাবে সেই থ্রেড থেকে মেসেজ গ্রহণ করতে পারেন, কিন্তু একটি মেসেজ পাঠিয়ে ঠিক সেই নির্দিষ্ট মেসেজটির উত্তরের জন্য অপেক্ষা করতে পারেন না।

[Comlink](https://github.com/GoogleChromeLabs/comlink) লাইব্রেরির ডকুমেন্টেশন থেকে উদ্ধৃত করলে:

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
