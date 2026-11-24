---
title: Scopes
description: ব্রাউজারের একাধিক ট্যাবে অ্যাপ খোলা থাকলে প্রতিটি ট্যাবের HTTP রিকোয়েস্ট ও BroadcastChannel বার্তা আলাদা রাখতে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কীভাবে Scopes ব্যবহার করে তা জানুন।
---

<!--
# Scopes
-->

# Scopes {#scopes}

<!--
Scopes keep your app working when you open it in two different browser tabs.
-->

একই অ্যাপ দুটি আলাদা ব্রাউজার ট্যাবে খোলা থাকলেও সেটিকে সঠিকভাবে চালু রাখতে Scopes সাহায্য করে।

<!--
The Service Worker passes the intercepted HTTP requests to the PHPRequestHandler for rendering. Technically, it sends a message through a [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) which then gets delivered to every browser tab where the application is open. This is undesirable, slow, and leads to unexpected behaviors.
-->

Service Worker ইন্টারসেপ্ট করা HTTP রিকোয়েস্টগুলো রেন্ডার করার জন্য PHPRequestHandler-এর কাছে পাঠায়। প্রযুক্তিগতভাবে, এটি একটি [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)-এর মাধ্যমে একটি বার্তা পাঠায়, যা অ্যাপ্লিকেশনটি খোলা থাকা প্রতিটি ব্রাউজার ট্যাবে পৌঁছে যায়। এটি অনাকাঙ্ক্ষিত, ধীরগতির এবং অপ্রত্যাশিত আচরণের জন্ম দেয়।

<!--
Unfortunately, the Service Worker cannot directly communicate with the relevant Worker Thread – see [PR #31](https://github.com/WordPress/wordpress-playground/pull/31) and [issue #9](https://github.com/WordPress/wordpress-playground/issues/9) for more details.
-->

দুর্ভাগ্যবশত, Service Worker সরাসরি সংশ্লিষ্ট Worker Thread-এর সাথে যোগাযোগ করতে পারে না – আরও বিস্তারিত জানতে [PR #31](https://github.com/WordPress/wordpress-playground/pull/31) এবং [issue #9](https://github.com/WordPress/wordpress-playground/issues/9) দেখুন।

<!--
Scopes enable each browser tab to:

-   Brand the outgoing HTTP requests with a unique tab id
-   Ignore any `BroadcastChannel` messages with a different id
-->

Scopes প্রতিটি ব্রাউজার ট্যাবকে নিচের কাজগুলো করতে সক্ষম করে:

- বাইরে পাঠানো HTTP রিকোয়েস্টগুলোকে একটি অনন্য ট্যাব id দিয়ে চিহ্নিত করা
- ভিন্ন id-যুক্ত যেকোনো `BroadcastChannel` বার্তা উপেক্ষা করা

<!--
Technically, a scope is a string included in the `PHPRequestHandler.absoluteUrl`. For example:

-   In an **unscoped app**, `/index.php` would be available at `http://localhost:8778/wp-login.php`
-   In an **scoped app**, `/index.php` would be available at `http://localhost:8778/scope:96253/wp-login.php`
-->

প্রযুক্তিগতভাবে, একটি scope হলো `PHPRequestHandler.absoluteUrl`-এর ভেতরে থাকা একটি স্ট্রিং। উদাহরণস্বরূপ:

- একটি **unscoped অ্যাপে**, `/index.php` পাওয়া যাবে `http://localhost:8778/wp-login.php` ঠিকানায়
- একটি **scoped অ্যাপে**, `/index.php` পাওয়া যাবে `http://localhost:8778/scope:96253/wp-login.php` ঠিকানায়

<!--
The service worker is aware of this concept and will attach the `/scope:` found in the request URL to the related `BroadcastChannel` communication.

A worker thread initiated with a scoped `absoluteUrl` is said to be **scoped**:
-->

Service Worker এই ধারণাটি সম্পর্কে জানে এবং রিকোয়েস্ট URL-এ পাওয়া `/scope:` অংশটি সংশ্লিষ্ট `BroadcastChannel` যোগাযোগের সাথে যুক্ত করে দেয়।

একটি scoped `absoluteUrl` দিয়ে শুরু হওয়া Worker Thread-কে **scoped** বলা হয়:

```js
import {
	PHP,
	setURLScope,
	exposeAPI,
	parseWorkerStartupOptions,
} from '@php-wasm/web';

// Don't use the absoluteURL directly:
const absoluteURL = 'http://127.0.0.1'

// Instead, set the scope first:
const scope = Math.random().toFixed(16)
const scopedURL = setURLScope(absoluteURL, scope).toString()

const { phpVersion } = parseWorkerStartupOptions<{ phpVersion?: string }>();
const php = await PHP.load('8.0', {
	requestHandler: {
		documentRoot: '/',
		absoluteUrl: scopedSiteUrl
	}
});

// Expose the API to app.ts:
const [setApiReady, ] = exposeAPI( php );
setApiReady();
```
