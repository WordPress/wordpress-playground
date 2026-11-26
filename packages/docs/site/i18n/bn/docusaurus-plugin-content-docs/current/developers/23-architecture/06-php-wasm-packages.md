---
title: PHP.wasm প্যাকেজসমূহ
slug: /developers/architecture/php-wasm-packages
description: শেয়ার্ড API, প্ল্যাটফর্ম অ্যাডাপ্টার এবং নির্দিষ্ট ভার্সনের PHP.wasm প্যাকেজগুলো কীভাবে একসাথে কাজ করে তা জানুন।
---

<!--
# PHP.wasm packages
-->

# PHP.wasm প্যাকেজসমূহ {#phpwasm-packages}

<!--
The PHP.wasm npm packages separate the shared JavaScript API, platform-specific
setup, and compiled PHP binaries. Most applications should use a platform
adapter. Applications that prioritize a smaller installation can instead load
one version-specific package through the lower-level API.
-->

PHP.wasm npm প্যাকেজগুলো শেয়ার্ড JavaScript API, প্ল্যাটফর্ম-নির্দিষ্ট সেটআপ এবং কম্পাইল করা PHP বাইনারিগুলোকে আলাদা রাখে। বেশিরভাগ অ্যাপ্লিকেশনেরই একটি প্ল্যাটফর্ম অ্যাডাপ্টার ব্যবহার করা উচিত। যেসব অ্যাপ্লিকেশন ছোট ইনস্টলেশন আকারকে অগ্রাধিকার দেয়, সেগুলো এর পরিবর্তে লোয়ার-লেভেল API-এর মাধ্যমে একটি ভার্সন-নির্দিষ্ট প্যাকেজ লোড করতে পারে।

<!--
## Package layers
-->

## প্যাকেজ স্তরসমূহ {#package-layers}

<!--
| Package                                      | Responsibility                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@php-wasm/universal`                        | Provides the environment-independent `PHP` class, `loadPHPRuntime()`, and shared request and filesystem APIs. It does not select a Node.js or browser build. |
| `@php-wasm/node`                             | Provides `loadNodeRuntime(version)` and Node.js-specific runtime setup, including networking, file locking, and filesystem helpers.                          |
| `@php-wasm/web`                              | Provides `loadWebRuntime(version)` and browser-specific runtime, networking, storage, and worker helpers.                                                    |
| `@php-wasm/node-X-Y` and `@php-wasm/web-X-Y` | Contain the WebAssembly binaries and loaders for one PHP minor version, plus version-matched extension artifacts where available.                            |
-->

| প্যাকেজ                                       | দায়িত্ব                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@php-wasm/universal`                        | এনভায়রনমেন্ট-নিরপেক্ষ `PHP` ক্লাস, `loadPHPRuntime()`, এবং শেয়ার্ড রিকোয়েস্ট ও ফাইলসিস্টেম API সরবরাহ করে। এটি কোনো Node.js বা ব্রাউজার বিল্ড নির্বাচন করে না। |
| `@php-wasm/node`                             | `loadNodeRuntime(version)` এবং নেটওয়ার্কিং, ফাইল লকিং ও ফাইলসিস্টেম হেল্পারসহ Node.js-নির্দিষ্ট রানটাইম সেটআপ সরবরাহ করে।                                  |
| `@php-wasm/web`                              | `loadWebRuntime(version)` এবং ব্রাউজার-নির্দিষ্ট রানটাইম, নেটওয়ার্কিং, স্টোরেজ ও ওয়ার্কার হেল্পার সরবরাহ করে।                                                |
| `@php-wasm/node-X-Y` এবং `@php-wasm/web-X-Y` | একটি PHP মাইনর ভার্সনের জন্য WebAssembly বাইনারি ও লোডার এবং যেখানে প্রযোজ্য সেখানে ভার্সন-ম্যাচড এক্সটেনশন আর্টিফ্যাক্ট ধারণ করে।                              |

<!--
An application creates the `PHP` object from `@php-wasm/universal`. The Node.js
or web adapter configures the environment, selects a PHP version, and imports
the corresponding version package. For example, `loadNodeRuntime('8.4')`
selects `@php-wasm/node-8-4`.
-->

একটি অ্যাপ্লিকেশন `@php-wasm/universal` থেকে `PHP` অবজেক্ট তৈরি করে। Node.js বা ওয়েব অ্যাডাপ্টার এনভায়রনমেন্ট কনফিগার করে, একটি PHP ভার্সন নির্বাচন করে এবং সংশ্লিষ্ট ভার্সন প্যাকেজটি ইমপোর্ট করে। উদাহরণস্বরূপ, `loadNodeRuntime('8.4')` কলটি `@php-wasm/node-8-4` নির্বাচন করে।

<!--
The API uses dotted versions such as `8.4`, while npm package names use a
hyphenated suffix such as `8-4`.
-->

API-তে ডটযুক্ত ভার্সন যেমন `8.4` ব্যবহৃত হয়, অন্যদিকে npm প্যাকেজের নামে হাইফেনযুক্ত সাফিক্স যেমন `8-4` ব্যবহৃত হয়।

<!--
## Convenient platform loaders
-->

## সুবিধাজনক প্ল্যাটফর্ম লোডার {#convenient-platform-loaders}

<!--
Use a platform adapter when you need its runtime integrations or may select
different PHP versions at runtime. For Node.js:
-->

যখন আপনার প্ল্যাটফর্ম অ্যাডাপ্টারের রানটাইম ইন্টিগ্রেশন প্রয়োজন হয় বা রানটাইমে বিভিন্ন PHP ভার্সন নির্বাচন করার দরকার হতে পারে, তখন একটি প্ল্যাটফর্ম অ্যাডাপ্টার ব্যবহার করুন। Node.js-এর জন্য:

```bash
npm install @php-wasm/universal @php-wasm/node
```

```js
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.4'));
```

<!--
In a browser, use `@php-wasm/web` and `loadWebRuntime('8.4')` instead.
-->

ব্রাউজারে এর পরিবর্তে `@php-wasm/web` এবং `loadWebRuntime('8.4')` ব্যবহার করুন।

<!--
The platform adapters can dispatch to every supported PHP version, and their
published dependency graph includes the corresponding version packages. This
is convenient, but it is not the smallest installation when an application
only needs one PHP version.
-->

প্ল্যাটফর্ম অ্যাডাপ্টারগুলো প্রতিটি সমর্থিত PHP ভার্সনে ডিসপ্যাচ করতে পারে এবং তাদের প্রকাশিত ডিপেন্ডেন্সি গ্রাফে সংশ্লিষ্ট ভার্সন প্যাকেজগুলো অন্তর্ভুক্ত থাকে। এটি সুবিধাজনক, তবে কোনো অ্যাপ্লিকেশনের যখন কেবল একটি PHP ভার্সনের প্রয়োজন হয়, তখন এটি সবচেয়ে ছোট ইনস্টলেশন হয় না।

<!--
## Load one PHP version directly
-->

## সরাসরি একটি PHP ভার্সন লোড করা {#load-one-php-version-directly}

<!--
For the smallest dependency footprint, omit the platform adapter and install
`@php-wasm/universal` with one version-specific package:
-->

সবচেয়ে ছোট ডিপেন্ডেন্সি ফুটপ্রিন্টের জন্য, প্ল্যাটফর্ম অ্যাডাপ্টারটি বাদ দিন এবং একটি ভার্সন-নির্দিষ্ট প্যাকেজের সাথে `@php-wasm/universal` ইনস্টল করুন:

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!--
These packages are published together. Keep their npm release versions
aligned.
-->

এই প্যাকেজগুলো একসাথে প্রকাশ করা হয়। এগুলোর npm রিলিজ ভার্সন সামঞ্জস্যপূর্ণ রাখুন।

<!--
Then load its compiled module through the low-level API:
-->

এরপর লো-লেভেল API-এর মাধ্যমে এর কম্পাইল করা মডিউলটি লোড করুন:

```js
import { PHP, loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from '@php-wasm/node-8-4';

const loaderModule = await getPHPLoaderModule();
const runtimeId = await loadPHPRuntime(loaderModule);
const php = new PHP(runtimeId);

const response = await php.runStream({
	code: '<?php echo "Hello from PHP " . PHP_VERSION;',
});
console.log(await response.stdoutText);
```

<!--
For a browser build, use the corresponding package, such as
`@php-wasm/web-8-4`, with the same `getPHPLoaderModule()` and
`loadPHPRuntime()` flow. The loader resolves its `.wasm` file with
`new URL(..., import.meta.url)`, so the browser bundle must be an ES module.
Configure the browser bundler to emit imported `.so` files as assets, as
described in the
[`@php-wasm/web` bundler guidance](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers).
Adapt package references in that configuration to the version-specific name;
for example, exclude `@php-wasm/web-8-4` instead of `@php-wasm/web`.
-->

ব্রাউজার বিল্ডের জন্য, একই `getPHPLoaderModule()` এবং `loadPHPRuntime()` ফ্লোসহ সংশ্লিষ্ট প্যাকেজ, যেমন `@php-wasm/web-8-4`, ব্যবহার করুন। লোডারটি `new URL(..., import.meta.url)` দিয়ে তার `.wasm` ফাইলটি রিজলভ করে, তাই ব্রাউজার বান্ডেলটি অবশ্যই একটি ES মডিউল হতে হবে। ইমপোর্ট করা `.so` ফাইলগুলোকে অ্যাসেট হিসেবে এমিট (emit) করতে ব্রাউজার বান্ডলার কনফিগার করুন, যেমনটি [`@php-wasm/web` বান্ডলার নির্দেশিকায়](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/php-wasm/web#usage-with-bundlers) বর্ণিত হয়েছে। সেই কনফিগারেশনে প্যাকেজ রেফারেন্সগুলোকে ভার্সন-নির্দিষ্ট নামে পরিবর্তন করে নিন; উদাহরণস্বরূপ, `@php-wasm/web`-এর পরিবর্তে `@php-wasm/web-8-4` বাদ (exclude) দিন।

<!--
Here, a smaller footprint means installing one PHP minor version instead of
the full supported matrix. Each version package still includes the compiled
variants and version-matched artifacts required for that PHP version.
-->

এখানে ছোট ফুটপ্রিন্ট বলতে সম্পূর্ণ সমর্থিত ম্যাট্রিক্সের পরিবর্তে কেবল একটি PHP মাইনর ভার্সন ইনস্টল করাকে বোঝায়। প্রতিটি ভার্সন প্যাকেজে এখনও সেই PHP ভার্সনের জন্য প্রয়োজনীয় কম্পাইল করা ভ্যারিয়েন্ট এবং ভার্সন-ম্যাচড আর্টিফ্যাক্টগুলো অন্তর্ভুক্ত থাকে।

<!--
This direct approach is intentionally lower-level. It bypasses the setup
performed by `loadNodeRuntime()` or `loadWebRuntime()`, including platform
networking, Node.js file locking, extension loading, and other
environment-specific integrations. Use it when the shared `PHP` API and
in-memory filesystem are sufficient, or when your application supplies the
required Emscripten configuration itself.
-->

এই সরাসরি পদ্ধতিটি ইচ্ছাকৃতভাবেই লোয়ার-লেভেলের। এটি `loadNodeRuntime()` বা `loadWebRuntime()` দ্বারা সম্পাদিত সেটআপ—যার মধ্যে প্ল্যাটফর্ম নেটওয়ার্কিং, Node.js ফাইল লকিং, এক্সটেনশন লোডিং এবং অন্যান্য এনভায়রনমেন্ট-নির্দিষ্ট ইন্টিগ্রেশন অন্তর্ভুক্ত—এড়িয়ে যায়। যখন শেয়ার্ড `PHP` API এবং ইন-মেমোরি ফাইলসিস্টেম যথেষ্ট হয়, অথবা যখন আপনার অ্যাপ্লিকেশন নিজেই প্রয়োজনীয় Emscripten কনফিগারেশন সরবরাহ করে, তখন এটি ব্যবহার করুন।

<!--
See the [supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts)
to choose the matching package suffix.
-->

মানানসই প্যাকেজ সাফিক্স বেছে নিতে [সমর্থিত PHP ভার্সনসমূহ](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts) দেখুন।

<!--
## Which approach should you choose?
-->

## কোন পদ্ধতিটি বেছে নেবেন? {#which-approach-should-you-choose}

<!--
- Use `@php-wasm/node` or `@php-wasm/web` for platform-specific runtime setup,
  helpers, and the simplest version-selection API.
- Load `@php-wasm/node-X-Y` or `@php-wasm/web-X-Y` directly when installation
  size matters more than the platform adapter's conveniences.
-->

- প্ল্যাটফর্ম-নির্দিষ্ট রানটাইম সেটআপ, হেল্পার এবং সবচেয়ে সহজ ভার্সন-নির্বাচন API-এর জন্য `@php-wasm/node` অথবা `@php-wasm/web` ব্যবহার করুন।
- প্ল্যাটফর্ম অ্যাডাপ্টারের সুবিধার চেয়ে ইনস্টলেশনের আকার বেশি গুরুত্বপূর্ণ হলে সরাসরি `@php-wasm/node-X-Y` অথবা `@php-wasm/web-X-Y` লোড করুন।
