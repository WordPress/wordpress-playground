---
slug: /developers/apis/javascript-api/blueprint-functions-in-api-client
---

<!--
# Blueprints Functions and the API Client
-->

# ব্লুপ্রিন্টস ফাংশন এবং API ক্লায়েন্ট (Blueprints Functions and the API Client) {#blueprints-functions-and-the-api-client}

<!--
Every Blueprint step you can declare in the JSON object also provides a handler function that can be used directly.
-->

JSON অবজেক্টে আপনি যেসব ব্লুপ্রিন্ট স্টেপ ডিক্লেয়ার করতে পারেন, সেগুলোর প্রতিটিতে একটি করে হ্যান্ডলার ফাংশনও (handler function) প্রদান করা থাকে যা সরাসরি ব্যবহার করা যায়।

<!--
For example:
-->

উদাহরণস্বরূপ:

```ts
import { startPlaygroundWeb, login, installPlugin } from 'https://playground.wordpress.net/client/index.js';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://playground.wordpress.net/remote.html`,
});
await client.isReady();

await login(client, {
	username: 'admin',
	password: 'password',
});

await installPlugin(client, {
	// Resources can only be used with JSON Blueprints.
	// If you use functions, you must provide the resolved
	// file.
	pluginData: await fetch(pluginUrl),
});
```

<!--
For more information and live examples visit the [Blueprints Steps page](/blueprints/steps).
-->

আরও তথ্যের জন্য এবং লাইভ উদাহরণ দেখতে [ব্লুপ্রিন্টস স্টেপস পেজ](/blueprints/steps) দেখুন।
