---
title: API পরিচিতি
slug: /developers/apis/
---

<!--
## WordPress Playground APIs overview
-->

## ওয়ার্ডপ্রেস প্লেগ্রাউন্ড API পরিচিতি {#wordpress-playground-apis-overview}

<!--
WordPress Playground exposes a few APIs that you can use to interact with the Playground:
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের সাথে ইন্টারঅ্যাক্ট বা কাজ করার জন্য এটি বেশ কয়েকটি API প্রদান করে:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
### Query API
-->

### কোয়েরি API (Query API) {#query-api}

<!--
Basic operations can be done by adjusting the URL, for example here's how you can preinstall a coblocks plugin:
-->

URL সমন্বয় বা পরিবর্তনের মাধ্যমেই সাধারণ অপারেশনগুলো সম্পন্ন করা যেতে পারে, উদাহরণস্বরূপ এখানে দেখানো হলো কীভাবে আপনি coblocks প্লাগইন প্রি-ইনস্টল করতে পারেন:

[https://playground.wordpress.net/?plugin=coblocks](https://playground.wordpress.net/?plugin=coblocks)

<!--
Or a theme:
-->

অথবা কোনো থিম:

[https://playground.wordpress.net/?theme=pendant](https://playground.wordpress.net/?theme=pendant)

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/). Once you have a URL that you like, you can embed it in your website using an iframe:
-->

এটিকে [কোয়েরি API (Query API)](/developers/apis/query-api/) বলা হয় এবং আপনি [এখানে](/developers/apis/query-api/) এ বিষয়ে আরও বিস্তারিত জানতে পারেন। আপনার পছন্দমতো একটি URL প্রস্তুত হয়ে গেলে, আপনি একটি iframe ব্যবহার করে এটিকে আপনার ওয়েবসাইটে এম্বেড করতে পারেন:

```html
<iframe style="width: 800px; height: 500px;" src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

<div class="callout callout-info">

<!--
Check the [Query API](/developers/apis/query-api) section for more info.
-->

আরও তথ্যের জন্য [কোয়েরি API (Query API)](/developers/apis/query-api) সেকশনটি দেখুন।

</div>

<!--
### Blueprints
-->

### ব্লুপ্রিন্ট (Blueprints) {#blueprints}

<!--
If you need more control over your Playground, you can use JSON Blueprints. For example, here's how to create a post and install a plugin:
-->

আপনার প্লেগ্রাউন্ডের ওপর আরও বেশি নিয়ন্ত্রণের প্রয়োজন হলে, আপনি JSON ব্লুপ্রিন্ট ব্যবহার করতে পারেন। উদাহরণস্বরূপ, এখানে দেখানো হলো কীভাবে একটি পোস্ট তৈরি এবং প্লাগইন ইনস্টল করতে হয়:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
display={`{
  "steps": [
    {
      "step": "login"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "friends"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1)); ?>"
    }
  ]
}` }
blueprint={{
		"steps": [
            {
                "step": "login"
            },
            {
            step: 'installPlugin',
                pluginData: {
                    resource: 'wordpress.org/plugins',
                    slug: 'friends',
                },
            },
			{
				"step": "runPHP",
				"code": `<?php
require_once '/wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

<p></p>

<div class="callout callout-info">

<!--
Blueprints play a significant role in WordPress Playground, so they have their own dedicated documentation hub. Learn more about JSON Blueprints at the [Blueprints Docs Hub](/blueprints).
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে ব্লুপ্রিন্ট অত্যন্ত গুরুত্বপূর্ণ ভূমিকা পালন করে, তাই এর জন্য একটি স্বতন্ত্র ডেডিকেটেড ডকুমেন্টেশন হাব রয়েছে। [ব্লুপ্রিন্ট ডক্স হাবে](/blueprints) JSON ব্লুপ্রিন্ট সম্পর্কে আরও বিস্তারিত জানুন।

</div>

<!--
### Sites API
-->

### সাইটস API (Sites API) {#sites-api}

<!--
The Playground website at [playground.wordpress.net](https://playground.wordpress.net) exposes a `window.playgroundSites` object for managing the sites shown in the Dock's **Playgrounds** pane — listing them, creating new ones, persisting temporary sites to OPFS or local disk, switching between them, and changing PHP version or networking.
-->

[playground.wordpress.net](https://playground.wordpress.net)-এ প্লেগ্রাউন্ড ওয়েবসাইটটি ডকের (Dock) **Playgrounds** প্যানে প্রদর্শিত সাইটগুলো পরিচালনা করার জন্য একটি `window.playgroundSites` অবজেক্ট সরবরাহ করে — যার মাধ্যমে সাইট তালিকাভুক্ত করা, নতুন সাইট তৈরি করা, অস্থায়ী সাইটগুলোকে OPFS বা লোকাল ডিস্কে সংরক্ষণ (persist) করা, সাইট পরিবর্তন করা এবং PHP সংস্করণ বা নেটওয়ার্কিং সেটিংস পরিবর্তন করা যায়।

```javascript
await playgroundSites.createNewTemporarySite('demo', { phpVersion: '8.4' });
await playgroundSites.saveInBrowser('My demo site');
const client = playgroundSites.getClient();
```

<div class="callout callout-info">

<!--
Check the [Sites API](/developers/apis/sites-api) section for more info.
-->

আরও তথ্যের জন্য [সাইটস API (Sites API)](/developers/apis/sites-api) সেকশনটি দেখুন।

</div>

<!--
### JavaScript API
-->

### জাভাস্ক্রিপ্ট API (JavaScript API) {#javascript-api}

<!--
The `@wp-playground/client` package provides a JavaScript API you can use to fully control your Playground instance. Here's a simple example of what you can do:
-->

`@wp-playground/client` প্যাকেজটি একটি জাভাস্ক্রিপ্ট API সরবরাহ করে যা আপনি আপনার প্লেগ্রাউন্ড ইনস্ট্যান্সকে সম্পূর্ণভাবে নিয়ন্ত্রণ করতে ব্যবহার করতে পারেন। আপনি কী করতে পারেন তার একটি সহজ উদাহরণ এখানে দেওয়া হলো:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
	});
	// Let's wait until Playground is fully loaded
	await client.isReady();
</script>
```

<div class="callout callout-info">

<!--
Check the [JavaScript API](/developers/apis/javascript-api/) section for more info.
-->

আরও তথ্যের জন্য [জাভাস্ক্রিপ্ট API (JavaScript API)](/developers/apis/javascript-api/) সেকশনটি দেখুন।

</div>

<!--
## Playground APIs Concepts
-->

## প্লেগ্রাউন্ড API-এর ধারণাসমূহ (Concepts) {#playground-apis-concepts}

<!--
WordPress Playground in the browser is all about links and iframes. Regardless of which API you choose, you will use it in one of the following ways:
-->

ব্রাউজারে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড মূলত লিংক এবং আইফ্রেমের (iframes) ওপর ভিত্তি করে কাজ করে। আপনি যে API-ই নির্বাচন করুন না কেন, আপনি এটি নিচের যেকোনো একটি উপায়ে ব্যবহার করবেন:

<!--
### Link to the Playground site
-->

### প্লেগ্রাউন্ড সাইটের লিংক ব্যবহার করে {#link-to-the-playground-site}

<!--
You can customize WordPress Playground by modifying the https://playground.wordpress.net/ link. You can, for example, create a post, request a specific plugin, or run any PHP code.
-->

আপনি https://playground.wordpress.net/ লিংকটি পরিবর্তন বা কাস্টমাইজ করে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড নিয়ন্ত্রণ করতে পারেন। উদাহরণস্বরূপ, আপনি একটি পোস্ট তৈরি করতে পারেন, নির্দিষ্ট প্লাগইনের অনুরোধ করতে পারেন অথবা যেকোনো PHP কোড চালাতে পারেন।

<!--
To prepare such a link, use either the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).
-->

এই ধরনের লিংক প্রস্তুত করতে [কোয়েরি API](/developers/apis/query-api) (সহজ) অথবা [JSON ব্লুপ্রিন্ট API](/blueprints) (মাঝারি) ব্যবহার করুন।

<!--
Once it's ready, simply post it on your site. It makes a great "Try it yourself" button in a tutorial, for example.
-->

লিংকটি তৈরি হয়ে গেলে, এটি সহজেই আপনার ওয়েবসাইটে যুক্ত করতে পারেন। উদাহরণস্বরূপ, কোনো টিউটোরিয়ালে এটি একটি দুর্দান্ত "Try it yourself" (নিজে চেষ্টা করুন) বাটন হিসেবে কাজ করে।

<!--
#### Embed in an `<iframe>`
-->

#### একটি `<iframe>`-এ এম্বেড করা {#embed-in-an-iframe}

<!--
WordPress Playground can be embedded in your app using an `<iframe>`:
-->

একটি `<iframe>` ব্যবহার করে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড আপনার অ্যাপ্লিকেশনে এম্বেড করা যেতে পারে:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

<!--
To customize that Playground instance, you can:
-->

সেই প্লেগ্রাউন্ড ইনস্ট্যান্সটি কাস্টমাইজ করতে, আপনি:

<!--
- Load it from special link prepared using the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).
- Control it using the [JavaScript API](/developers/apis/javascript-api/).
-->

- [কোয়েরি API](/developers/apis/query-api) (সহজ) অথবা [JSON ব্লুপ্রিন্ট API](/blueprints) (মাঝারি) ব্যবহার করে প্রস্তুত করা বিশেষ লিংক থেকে এটি লোড করতে পারেন।
- [জাভাস্ক্রিপ্ট API](/developers/apis/javascript-api/) ব্যবহার করে এটি নিয়ন্ত্রণ করতে পারেন।

<!--
The JavaScript API gives you the most control, but it is also the least convenient option as it requires loading the Playground Client library.
-->

জাভাস্ক্রিপ্ট API আপনাকে সবচেয়ে বেশি নিয়ন্ত্রণ প্রদান করে, তবে এটি কিছুটা জটিল কারণ এর জন্য প্লেগ্রাউন্ড ক্লায়েন্ট লাইব্রেরি লোড করার প্রয়োজন হয়।

<div class="callout callout-warning">

<!--
**Careful with the demo site**

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

**ডেমো সাইট ব্যবহারে সতর্কতা**

https://playground.wordpress.net সাইটটি মূলত কমিউনিটিকে সহায়তা করার জন্য তৈরি করা হয়েছে, তবে ট্রাফিক উল্লেখযোগ্য হারে বৃদ্ধি পেলে এটি নিরবচ্ছিন্নভাবে কাজ করার কোনো নিশ্চয়তা নেই।

যদি আপনার সার্বক্ষণিক সহজলভ্যতা বা নির্দিষ্ট সক্ষমতার প্রয়োজন হয়, তবে আপনার [নিজস্ব ওয়ার্ডপ্রেস প্লেগ্রাউন্ড হোস্ট করা](/developers/architecture/host-your-own-playground) উচিত।

</div>

<!--
### Browser APIs
-->

### ব্রাউজার API-সমূহ {#browser-apis}

<!--
The following Playground APIs are available in the browser:
-->

ব্রাউজারে নিচের প্লেগ্রাউন্ড API-গুলো ব্যবহার করা যায়:

<!--
- [Query API](/developers/apis/query-api) enable basic operations using only query parameters
- [Blueprints API](/blueprints) give you a great degree of control with a simple JSON file
- [Sites API](/developers/apis/sites-api) lets scripts running on playground.wordpress.net manage saved sites
- [JavaScript API](/developers/apis/javascript-api) give you full control via a JavaScript client from an npm package
-->

- [কোয়েরি API (Query API)](/developers/apis/query-api) শুধুমাত্র কোয়েরি প্যারামিটার ব্যবহার করে মৌলিক অপারেশনগুলো সম্পাদন করতে দেয়
- [ব্লুপ্রিন্ট API (Blueprints API)](/blueprints) একটি সাধারণ JSON ফাইলের মাধ্যমে অত্যন্ত ব্যাপক নিয়ন্ত্রণ প্রদান করে
- [সাইটস API (Sites API)](/developers/apis/sites-api) playground.wordpress.net-এ চালিত স্ক্রিপ্টগুলোর মাধ্যমে সংরক্ষিত সাইট পরিচালনার সুযোগ দেয়
- [জাভাস্ক্রিপ্ট API (JavaScript API)](/developers/apis/javascript-api) npm প্যাকেজ থেকে একটি জাভাস্ক্রিপ্ট ক্লায়েন্টের মাধ্যমে পূর্ণ নিয়ন্ত্রণ প্রদান করে

<!--
### In Node.js
-->

### Node.js-এ {#in-nodejs}

<!--
The following Playground APIs are available in Node.js:
-->

Node.js-এ নিচের প্লেগ্রাউন্ড API-গুলো ব্যবহার করা যায়:

<!--
- [JSON Blueprints API](/blueprints)
- [JavaScript API](/developers/apis/javascript-api/)
-->

- [JSON ব্লুপ্রিন্ট API (JSON Blueprints API)](/blueprints)
- [জাভাস্ক্রিপ্ট API (JavaScript API)](/developers/apis/javascript-api/)

<!--
These APIs are very similar to their web counterparts, but, unsurprisingly, they are not based or links or iframes.
-->

এই API-গুলো তাদের ওয়েব সমকক্ষগুলোর মতোই কাজ করে, তবে স্বাভাবিকভাবেই এগুলো লিংক বা আইফ্রেমের (iframes) ওপর ভিত্তি করে তৈরি নয়।
