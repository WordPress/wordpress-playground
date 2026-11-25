---
title: PHP Worker Threads
description: মূল ওয়েবসাইটের ইউজার ইন্টারফেস ধীর হওয়া এড়াতে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কীভাবে ওয়েব ওয়ার্কারে PHP চালায় এবং consumeAPI ব্যবহার করে তা নিয়ন্ত্রণ করে তা জানুন।
slug: /developers/architecture/browser-php-worker-threads
---

<!--
# PHP Worker Threads
-->

# PHP Worker Threads {#php-worker-threads}

<!--
PHP is always ran in a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to ensure the PHP runtime doesn't slow down the user interface of the main website.

Imagine the following code:
-->

PHP রানটাইম যেন মূল ওয়েবসাইটের ইউজার ইন্টারফেসকে ধীর না করে, সেজন্য PHP সবসময় একটি [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)-এ চালানো হয়।

নিচের কোডটির কথা ভাবুন:

```js
<button onclick="for(let i=0;i<100000000;i++>) {}">Freeze the page</button>
<input type="text" />
```

<!--
As soon as you click that button the browser will freeze and you won't be able to type in the input. That's just how browsers work. Whether it's a for loop or a PHP server, running intensive tasks slows down the user interface.
-->

বাটনটিতে ক্লিক করার সাথে সাথেই ব্রাউজার ফ্রিজ হয়ে যাবে এবং আপনি ইনপুট বক্সে কিছু টাইপ করতে পারবেন না। ব্রাউজার এভাবেই কাজ করে। সেটি একটি for লুপ হোক বা একটি PHP সার্ভার—ভারী কোনো কাজ চালালে ইউজার ইন্টারফেস ধীর হয়ে যায়।

<!--
### Initiating web workers
-->

### Web Worker চালু করা {#initiating-web-workers}

<!--
Web workers are separate programs that can process heavy tasks outside of the main application. They must be initiated by the main JavaScript program living in the browser tab. Here's how:
-->

Web Worker হলো আলাদা প্রোগ্রাম, যা মূল অ্যাপ্লিকেশনের বাইরে ভারী কাজগুলো প্রসেস করতে পারে। ব্রাউজার ট্যাবে চলা মূল JavaScript প্রোগ্রাম থেকেই এগুলো চালু করতে হয়। নিচে তা দেখানো হলো:

```ts
const phpClient = consumeAPI<PHPClient>(
	spawnPHPWorkerThread(
		'/worker-thread.js' // Valid Worker script URL
	)
);
await phpClient.isReady();
await phpClient.run({ code: `<?php echo "Hello from the thread!";` });
```

<!--
### Controlling web workers
-->

### Web Worker নিয়ন্ত্রণ করা {#controlling-web-workers}

<!--
Exchanging messages is the only way to control web workers. The main application has no access to functions or variables inside of a web worker. It can only send and receive messages using `worker.postMessage` and `worker.onmessage = function(msg) { }`.

This can be tedious, which is why Playground provides a convenient [consumeAPI](/api/universal/function/consumeAPI) function that abstracts the message exchange and exposes specific functions from the web worker. This is why we can call `phpClient.run` in the example above.
-->

Web Worker-গুলো নিয়ন্ত্রণ করার একমাত্র উপায় হলো মেসেজ আদান-প্রদান করা। মূল অ্যাপ্লিকেশন থেকে কোনো Web Worker-এর ভেতরের ফাংশন বা ভ্যারিয়েবলে সরাসরি অ্যাক্সেস পাওয়া যায় না। এটি কেবল `worker.postMessage` এবং `worker.onmessage = function(msg) { }` ব্যবহার করেই মেসেজ পাঠাতে ও গ্রহণ করতে পারে।

এটি বেশ ঝামেলাপূর্ণ হতে পারে, আর সেজন্যই প্লেগ্রাউন্ড একটি সুবিধাজনক [consumeAPI](/api/universal/function/consumeAPI) ফাংশন সরবরাহ করে, যা মেসেজ আদান-প্রদানের জটিলতা আড়াল করে Web Worker থেকে নির্দিষ্ট ফাংশনগুলো ব্যবহারের জন্য উন্মুক্ত করে দেয়। এ কারণেই আমরা ওপরের উদাহরণে `phpClient.run` কল করতে পারি।
