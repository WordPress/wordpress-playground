---
slug: /developers/apis/javascript-api/blueprint-json-in-api-client
---

<!--
# Blueprints JSON and the API Client
-->

# ব্লুপ্রিন্টস JSON এবং API ক্লায়েন্ট (Blueprints JSON and the API Client) {#blueprints-json-and-the-api-client}

<!--
The Playground API client can be initialized with a [JSON Blueprint](/blueprints). This is a convenient way of preconfiguring it in any way you like without worrying about progress bars and fetching remote files:
-->

প্লেগ্রাউন্ড API ক্লায়েন্টকে একটি [JSON ব্লুপ্রিন্ট](/blueprints) সহ ইনিশিয়ালাইজ করা যেতে পারে। প্রোগ্রেস বার এবং রিমোট ফাইল ফেচ করার ঝামেলা ছাড়াই আপনার পছন্দমতো যেকোনো উপায়ে এটিকে পূর্ব-কনফিগার (preconfigure) করার জন্য এটি একটি সুবিধাজনক উপায়:

```ts
import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

const client = await startPlaygroundWeb({
	iframe: document.getElementById('wp'),
	remoteUrl: `https://playground.wordpress.net/remote.html`,
	blueprint: {
		preferredVersions: {
			wp: '6.3',
			php: '8.3',
		},
		steps: [
			{ step: 'login' },
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'gutenberg',
				},
			},
		],
	},
});
await client.isReady();
```

<!--
Running a JSON Blueprint is only possible during the initialization of the API client.
-->

একটি JSON ব্লুপ্রিন্ট রান করা শুধুমাত্র API ক্লায়েন্টের ইনিশিয়ালাইজেশনের সময়ই সম্ভব।

<!--
If this is sufficient for your needs, read more about [JSON Blueprints](/blueprints).
-->

এটি যদি আপনার প্রয়োজনের জন্য যথেষ্ট হয়, তবে [JSON ব্লুপ্রিন্ট](/blueprints) সম্পর্কে আরও পড়ুন।

<!--
If you need to work with an already initialized client, you should look into [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client).
-->

আপনার যদি ইতিমধ্যে ইনিশিয়ালাইজ করা কোনো ক্লায়েন্ট নিয়ে কাজ করার প্রয়োজন হয়, তবে আপনার [ব্লুপ্রিন্ট ফাংশনগুলো](/developers/apis/javascript-api/blueprint-functions-in-api-client) দেখা উচিত।
