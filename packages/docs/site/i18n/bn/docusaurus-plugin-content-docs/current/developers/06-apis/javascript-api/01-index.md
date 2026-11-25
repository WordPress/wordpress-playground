---
title: জাভাস্ক্রিপ্ট API (JavaScript API)
slug: /developers/apis/javascript-api
description: ওয়ার্ডপ্রেস প্লেগ্রাউন্ড জাভাস্ক্রিপ্ট API (JavaScript API) ক্লায়েন্টের সাহায্যে ব্রাউজারে কীভাবে একটি ওয়ার্ডপ্রেস ইনস্ট্যান্স নিয়ন্ত্রণ করবেন তা জানুন।
---

<!--
# JavaScript API
-->

# জাভাস্ক্রিপ্ট API (JavaScript API) {#javascript-api}

<!--
WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড একটি জাভাস্ক্রিপ্ট API ক্লায়েন্ট সহ আসে যা আপনাকে আপনার ওয়ার্ডপ্রেসের উপর সম্পূর্ণ নিয়ন্ত্রণ প্রদান করে।

<div class="callout callout-info">

<!--
**API here doesn't mean "REST API"**

WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API.
-->

**এখানে API বলতে "REST API" বোঝানো হয় না**

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড একটি ব্রাউজার-ভিত্তিক অ্যাপ্লিকেশন।
এখানে API বলতে এমন একগুচ্ছ ফাংশনকে বোঝায় যা আপনি
জাভাস্ক্রিপ্টের মধ্যে কল করতে পারেন। এটি কোনো নেটওয়ার্ক-ভিত্তিক REST API **নয়**।

</div>

<!--
## Quick start

To use the JavaScript API, you'll need:

- An `<iframe>` element
- The Playground JavaScript client, loaded from `playground.wordpress.net` or installed from npm
-->

## দ্রুত শুরু (Quick start) {#quick-start}

জাভাস্ক্রিপ্ট API ব্যবহার করার জন্য আপনার প্রয়োজন হবে:

- একটি `<iframe>` এলিমেন্ট
- প্লেগ্রাউন্ড জাভাস্ক্রিপ্ট ক্লায়েন্ট, যা `playground.wordpress.net` থেকে লোড করা অথবা npm থেকে ইনস্টল করা

<!--
### Load the client from playground.wordpress.net

You can load the client directly from `https://playground.wordpress.net/client/index.js`. No npm installation or build step is required. Use a `<script type="module">` element so you can import the client and use `await`.

Save the following example as `index.html` and serve it from a local web server, or paste it into an online HTML editor such as CodePen or JSFiddle:
-->

### playground.wordpress.net থেকে ক্লায়েন্ট লোড করা (Load the client from playground.wordpress.net) {#load-the-client-from-playgroundwordpressnet}

আপনি সরাসরি `https://playground.wordpress.net/client/index.js` থেকে ক্লায়েন্টটি লোড করতে পারেন। এর জন্য কোনো npm ইনস্টলেশন বা বিল্ড ধাপের প্রয়োজন নেই। একটি `<script type="module">` এলিমেন্ট ব্যবহার করুন যাতে আপনি ক্লায়েন্ট ইম্পোর্ট করে `await` ব্যবহার করতে পারেন।

নিচের উদাহরণটি `index.html` হিসেবে সংরক্ষণ করুন এবং একটি লোকাল ওয়েব সার্ভার থেকে পরিবেশন করুন, অথবা CodePen বা JSFiddle-এর মতো অনলাইন HTML এডিটরে পেস্ট করুন:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	// Let's wait until Playground is fully loaded
	await client.isReady();
</script>
```

<!--
The import loads the JavaScript client into your page. `startPlaygroundWeb()` then loads WordPress in the iframe using `remoteUrl` and returns a client you can use to control it.
-->

এই ইম্পোর্টটি আপনার পেজে জাভাস্ক্রিপ্ট ক্লায়েন্ট লোড করে। এরপর `startPlaygroundWeb()` ফাংশনটি `remoteUrl` ব্যবহার করে আইফ্রেমে ওয়ার্ডপ্রেস লোড করে এবং এটি নিয়ন্ত্রণের জন্য একটি ক্লায়েন্ট প্রদান করে।

<div class="callout callout-info">

<!--
**/remote.html is a special URL**

`/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about [the difference between `/` and `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html).

Use `https://playground.wordpress.net/remote.html` for `remoteUrl` to connect to Playground. WordPress pages load from `wpsandbox.wordpress.net` automatically. You don't need to configure that address.
-->

**/remote.html একটি বিশেষ URL**

`/remote.html` হলো একটি বিশেষ URL যা ব্রাউজার UI সহ ডেমো অ্যাপের পরিবর্তে প্লেগ্রাউন্ড API এন্ডপয়েন্ট লোড করে। [`/` এবং `/remote.html`-এর মধ্যে পার্থক্য](/developers/apis/javascript-api/-html-vs-remote-html) সম্পর্কে আরও জানুন।

প্লেগ্রাউন্ডের সাথে সংযোগ স্থাপনের জন্য `remoteUrl`-এর মান হিসেবে `https://playground.wordpress.net/remote.html` ব্যবহার করুন। ওয়ার্ডপ্রেস পেজগুলো স্বয়ংক্রিয়ভাবে `wpsandbox.wordpress.net` থেকে লোড হয়। আপনাকে সেই ঠিকানা কনফিগার করার প্রয়োজন নেই।

</div>

<!--
### Install the client from npm

If your application uses a bundler, install the client package:
-->

### npm থেকে ক্লায়েন্ট ইনস্টল করা (Install the client from npm) {#install-the-client-from-npm}

আপনার অ্যাপ্লিকেশন যদি কোনো বান্ডলার ব্যবহার করে, তবে ক্লায়েন্ট প্যাকেজটি ইনস্টল করুন:

```bash
npm install @wp-playground/client
```

<!--
Then replace the URL import in the example above with this import in your JavaScript module:
-->

এরপর আপনার জাভাস্ক্রিপ্ট মডিউলে উপরের উদাহরণের URL ইম্পোর্টটিকে নিচের ইম্পোর্ট দ্বারা প্রতিস্থাপন করুন:

```javascript
const { startPlaygroundWeb } = await import('@wp-playground/client');
```

<!--
For the hosted runtime at `https://playground.wordpress.net/remote.html`, use the URL import above to keep the client and runtime in sync. With npm, use matching client and runtime versions and update them together.
-->

`https://playground.wordpress.net/remote.html`-এ হোস্ট করা রানটাইমের জন্য ক্লায়েন্ট এবং রানটাইমের মধ্যে সমন্বয় রাখতে উপরের URL ইম্পোর্টটি ব্যবহার করুন। npm ব্যবহারের ক্ষেত্রে ক্লায়েন্ট এবং রানটাইমের সামঞ্জস্যপূর্ণ সংস্করণ ব্যবহার করুন এবং সেগুলো একসাথে আপডেট করুন।

<!--
## Controlling the website

Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that:

- [Playground API Client](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client)
-->

## ওয়েবসাইট নিয়ন্ত্রণ করা (Controlling the website) {#controlling-the-website}

এখন যেহেতু আপনার কাছে একটি `client` অবজেক্ট রয়েছে, আপনি এটি আইফ্রেমের ভেতরের ওয়েবসাইট নিয়ন্ত্রণ করতে ব্যবহার করতে পারেন। এটি করার তিনটি উপায় রয়েছে:

- [প্লেগ্রাউন্ড API ক্লায়েন্ট (Playground API Client)](/developers/apis/javascript-api/playground-api-client)
- [ব্লুপ্রিন্ট JSON (Blueprint JSON)](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [ব্লুপ্রিন্ট ফাংশন (Blueprint functions)](/developers/apis/javascript-api/blueprint-functions-in-api-client)

<!--
## Debugging and testing

For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`.
-->

## ডিবাগিং এবং টেস্টিং (Debugging and testing) {#debugging-and-testing}

দ্রুত টেস্টিং এবং ডিবাগিংয়ের জন্য, `index.html` এবং `remote.html` উভয় পেজেই জাভাস্ক্রিপ্ট API ক্লায়েন্টটিকে `window.playground` হিসেবে উন্মুক্ত (exposed) রাখা হয়েছে।

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!--
Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion.
-->

মনে রাখবেন, `index.html`-এ `playground` একটি প্রক্সি (Proxy) অবজেক্ট এবং আপনি ব্রাউজার থেকে কোনো অটোকমপ্লিশন পাবেন না। তবে `remote.html`-এ `playground` একটি ক্লাস ইনস্ট্যান্স, ফলে আপনি ব্রাউজারের অটোকমপ্লিশন সুবিধা উপভোগ করতে পারবেন।
