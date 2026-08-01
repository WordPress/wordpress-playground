---
title: ব্লুপ্রিন্ট ব্যবহার করা
slug: /blueprints/using-blueprints
description: URL ফ্র্যাগমেন্ট, কোয়েরি প্যারামিটার, বান্ডেল এবং JavaScript API সহ ব্লুপ্রিন্ট ব্যবহার করার বিভিন্ন উপায় আবিষ্কার করুন।
---

# ব্লুপ্রিন্ট ব্যবহার করা

আপনি নিম্নলিখিত উপায়ে ব্লুপ্রিন্ট ব্যবহার করতে পারেন:

- Playground-এ URL ফ্র্যাগমেন্ট হিসাবে সেগুলি পাস করে।
- `blueprint-url` প্যারামিটার ব্যবহার করে একটি URL থেকে সেগুলি লোড করে।
- ব্লুপ্রিন্ট বান্ডেল (ZIP ফাইল বা ডিরেক্টরি) ব্যবহার করে।
- JavaScript API ব্যবহার করে।

## URL ফ্র্যাগমেন্ট

ব্লুপ্রিন্ট ব্যবহার শুরু করার সবচেয়ে সহজ উপায় হল WordPress Playground ওয়েবসাইটে URL "ফ্র্যাগমেন্ট"-এ একটি পেস্ট করা, যেমন `https://playground.wordpress.net/#{"preferredVersions...`।

উদাহরণস্বরূপ, WordPress এবং PHP এর নির্দিষ্ট সংস্করণ সহ একটি Playground তৈরি করতে আপনি নিম্নলিখিত ব্লুপ্রিন্ট ব্যবহার করবেন:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}
```

এবং তারপর আপনি
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}` এ যাবেন।

<div class="callout callout-tip">

Javascript-এ, আপনি [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) এবং [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) দিয়ে যেকোনো blueprint JSON এর একটি কমপ্যাক্ট সংস্করণ পেতে পারেন
উদাহরণ:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = JSON.stringify(JSON.parse(blueprintJson)); // {"preferredVersions":{"php":"8.3","wp":"6.5"}}
```

</div>

অনুসরণ করার জন্য আপনাকে লিঙ্ক পেস্ট করতে হবে না। আমরা একটি "Try it out" বাটন সহ কোড উদাহরণ ব্যবহার করব যা স্বয়ংক্রিয়ভাবে আপনার জন্য উদাহরণগুলি চালাবে:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}} />

### Base64 এনকোডেড ব্লুপ্রিন্ট

কিছু টুল, যেমন GitHub, URL-এ পেস্ট করার সময় ব্লুপ্রিন্টটি সঠিকভাবে ফরম্যাট নাও করতে পারে। এই ক্ষেত্রে, আপনার ব্লুপ্রিন্টটি Base64-এ এনকোড করুন এবং এটি URL-এ যুক্ত করুন। উদাহরণস্বরূপ, এটি উপরের ব্লুপ্রিন্টের Base64 ফরম্যাট: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`।

এটি চালাতে, https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19 এ যান

<div class="callout callout-tip">

JavaScript-এ, আপনি গ্লোবাল ফাংশন `btoa()` দিয়ে [Base64 ফরম্যাটে](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) যেকোনো blueprint JSON পেতে পারেন।

উদাহরণ:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}`;
const base64Blueprint = btoa(blueprintJson); // eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
```

</div>

### URL থেকে ব্লুপ্রিন্ট লোড করুন

যখন আপনার ব্লুপ্রিন্ট খুব বড় হয়ে যায়, তখন আপনি এটি URL-এ `?blueprint-url` কোয়েরি প্যারামিটারের মাধ্যমে লোড করতে পারেন, এভাবে:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

মনে রাখবেন যে ব্লুপ্রিন্টটি অবশ্যই সর্বজনীনভাবে অ্যাক্সেসযোগ্য হতে হবে এবং [সঠিক `Access-Control-Allow-Origin` হেডার](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin) সহ পরিবেশন করতে হবে:

```
Access-Control-Allow-Origin: *
```

#### ব্লুপ্রিন্ট বান্ডেল

`?blueprint-url` প্যারামিটার এখন ZIP ফরম্যাটে ব্লুপ্রিন্ট বান্ডেলও সমর্থন করে। একটি ব্লুপ্রিন্ট বান্ডেল হল একটি ZIP ফাইল যাতে রুট লেভেলে একটি `blueprint.json` ফাইল থাকে, ব্লুপ্রিন্ট দ্বারা রেফারেন্স করা যেকোনো অতিরিক্ত রিসোর্স সহ।

উদাহরণস্বরূপ, আপনি এভাবে একটি ব্লুপ্রিন্ট বান্ডেল লোড করতে পারেন:

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

একটি ব্লুপ্রিন্ট বান্ডেল ব্যবহার করার সময়, আপনি `bundled` রিসোর্স টাইপ ব্যবহার করে বান্ডেল করা রিসোর্স রেফারেন্স করতে পারেন:

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		}
	]
}
```

ব্লুপ্রিন্ট বান্ডেল সম্পর্কে আরও তথ্যের জন্য, [Blueprint Bundles](/blueprints/bundles) ডকুমেন্টেশন দেখুন।

## JavaScript API

আপনি `@wp-playground/client` প্যাকেজ থেকে `startPlaygroundWeb()` ফাংশন ব্যবহার করে JavaScript API এর সাথে ব্লুপ্রিন্ট ব্যবহার করতে পারেন। এখানে একটি ছোট, স্বয়ংসম্পূর্ণ উদাহরণ যা আপনি JSFiddle বা CodePen-এ চালাতে পারেন:

```html
<iframe id="wp-playground" style="width: 1200px; height: 800px"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp-playground'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
		blueprint: {
			landingPage: '/wp-admin/',
			preferredVersions: {
				php: '8.3',
				wp: 'latest',
			},
			steps: [
				{
					step: 'login',
					username: 'admin',
					password: 'password',
				},
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'friends',
					},
				},
			],
		},
	});

	const response = await client.run({
		// wp-load.php is only required if you want to interact with WordPress.
		code: '<?php require_once "/wordpress/wp-load.php"; $posts = get_posts(); echo "Post Title: " . $posts[0]->post_title;',
	});
	console.log(response.text);
</script>
```
