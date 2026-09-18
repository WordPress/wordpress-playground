---
title: কীভাবে ব্লুপ্রিন্ট চালাবেন
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: URL ফ্র্যাগমেন্ট বা blueprint-url প্যারামিটার ব্যবহার সহ ব্লুপ্রিন্ট লোড এবং চালানোর বিভিন্ন পদ্ধতি শিখুন।
---

# কীভাবে ব্লুপ্রিন্ট লোড এবং চালাবেন

## URL ফ্র্যাগমেন্ট

ব্লুপ্রিন্ট চালানোর দ্রুততম উপায় হল এটি একটি WordPress Playground ওয়েবসাইটের URL "ফ্র্যাগমেন্ট"-এ পেস্ট করা। শুধু `.net/` এর পরে একটি `#` যোগ করুন।

ধরা যাক আপনি নিম্নলিখিত ব্লুপ্রিন্ট ব্যবহার করে WordPress এবং PHP এর নির্দিষ্ট সংস্করণ সহ একটি Playground তৈরি করতে চান:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

এটি চালাতে, `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}` এ যান। আপনি নিচের বাটনটিও ব্যবহার করতে পারেন:

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

পরবর্তী অধ্যায়ে উদাহরণ কোড চালাতে এই পদ্ধতি ব্যবহার করুন, [**আপনার প্রথম ব্লুপ্রিন্ট তৈরি করুন**](/blueprints/tutorial/build-your-first-blueprint)।

### Base64 এনকোডেড ব্লুপ্রিন্ট

কিছু টুল, যেমন GitHub, URL-এ পেস্ট করার সময় ব্লুপ্রিন্টটি সঠিকভাবে ফরম্যাট নাও করতে পারে। এই ক্ষেত্রে, [আপনার ব্লুপ্রিন্টটি Base64-এ এনকোড করুন](https://www.base64encode.org) এবং এটি URL-এ যুক্ত করুন। উদাহরণস্বরূপ, এটি উপরের ব্লুপ্রিন্টের Base64 ফরম্যাট: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiOC4zIiwgIndwIjoiNS45In19`।

এটি চালাতে, [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiOC4zIiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiOC4zIiwgIndwIjoiNS45In19) এ যান

### URL থেকে ব্লুপ্রিন্ট লোড করুন

যখন আপনার ব্লুপ্রিন্ট খুব বড় হয়ে যায়, তখন আপনি এটি URL-এ `?blueprint-url` কোয়েরি প্যারামিটারের মাধ্যমে লোড করতে পারেন, এভাবে:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

মনে রাখবেন যে ব্লুপ্রিন্টটি অবশ্যই সর্বজনীনভাবে অ্যাক্সেসযোগ্য হতে হবে এবং [সঠিক `Access-Control-Allow-Origin` হেডার](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin) সহ পরিবেশন করতে হবে:

```
Access-Control-Allow-Origin: *
```
