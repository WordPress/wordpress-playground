---
title: remote.html বনাম index.html (remote.html vs index.html)
slug: /developers/apis/javascript-api/-html-vs-remote-html
description: ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে remote.html এবং index.html ফাইলের পার্থক্য এবং ভূমিকা সম্পর্কে জানুন।
---

<!--
# `remote.html` vs `index.html`
-->

# `remote.html` বনাম `index.html` (`remote.html` vs `index.html`) {#remotehtml-vs-indexhtml}

<!--
[playground.wordpress.net](https://playground.wordpress.net/) exposes two distinct APIs through two separate HTML files: `remote.html` and `index.html`. Here's an overview of their functions and differences:

-   `index.html` uses WordPress Playground API client to control the "endpoint" that is `remote.html`.
-   The [Query API](../query-api/) is exclusively provided by `index.html`, independent of the WordPress Playground JavaScript API.
-   The [JavaScript API](../javascript-api/) is exclusively provided by `remote.html`. Only that file can be used as an "endpoint" for the `PlaygroundClient` class.
-->

[playground.wordpress.net](https://playground.wordpress.net/) দুটি পৃথক HTML ফাইলের মাধ্যমে দুটি স্বতন্ত্র API প্রকাশ (expose) করে: `remote.html` এবং `index.html`। নিচে এদের কার্যাবলী এবং পার্থক্যের একটি সংক্ষিপ্ত বিবরণ দেওয়া হলো:

- `index.html` "এন্ডপয়েন্ট" হিসেবে থাকা `remote.html`-কে নিয়ন্ত্রণ করার জন্য ওয়ার্ডপ্রেস প্লেগ্রাউন্ড API ক্লায়েন্ট ব্যবহার করে।
- [কোয়েরি API (Query API)](../query-api/) শুধুমাত্র `index.html` দ্বারা সরবরাহ করা হয়, যা ওয়ার্ডপ্রেস প্লেগ্রাউন্ড জাভাস্ক্রিপ্ট API থেকে সম্পূর্ণ স্বাধীন।
- [জাভাস্ক্রিপ্ট API (JavaScript API)](../javascript-api/) শুধুমাত্র `remote.html` দ্বারা সরবরাহ করা হয়। শুধুমাত্র সেই ফাইলটিকেই `PlaygroundClient` ক্লাসের জন্য একটি "এন্ডপয়েন্ট" হিসেবে ব্যবহার করা যেতে পারে।

<!--
Here's a bit more about each of these files:
-->

এই ফাইলগুলোর প্রতিটির বিষয়ে আরও কিছু বিস্তারিত তথ্য নিচে দেওয়া হলো:

<!--
## Remote.html
-->

## Remote.html {#remotehtml}

<!--
`remote.html` runs and renders WordPress and also exposes an API for developers to control it. Importantly, `remote.html` does not render any UI elements, such as browser UI or version switchers. It's just WordPress. The primary functions of `remote.html` are:

-   Loading the suitable version of php.wasm, the WebAssembly build of PHP.
-   Loading the correct version of WordPress for user interaction.
-   Initiating PHP in a WebWorker and registering a ServiceWorker for HTTP requests.
-   Listening to the `message` event from the parent window and executing the appropriate code command.
-->

`remote.html` ওয়ার্ডপ্রেস রান ও রেন্ডার করে এবং ডেভেলপারদের এটি নিয়ন্ত্রণ করার জন্য একটি API-ও প্রদান করে। বিশেষভাবে লক্ষণীয় যে, `remote.html` ব্রাউজার UI বা সংস্করণ নির্বাচকের (version switchers) মতো কোনো UI উপাদান (UI elements) রেন্ডার করে না। এটি কেবল ওয়ার্ডপ্রেস। `remote.html`-এর প্রাথমিক কাজগুলো হলো:

- PHP-এর WebAssembly বিল্ড, php.wasm-এর উপযুক্ত সংস্করণটি লোড করা।
- ব্যবহারকারীর ইন্টারঅ্যাকশনের জন্য ওয়ার্ডপ্রেসের সঠিক সংস্করণটি লোড করা।
- একটি WebWorker-এ PHP চালু করা এবং HTTP রিকোয়েস্টের জন্য একটি ServiceWorker রেজিস্টার করা।
- প্যারেন্ট উইন্ডো থেকে পাঠানো `message` ইভেন্ট পর্যবেক্ষণ (listen) করা এবং উপযুক্ত কোড কমান্ড এক্সিকিউট করা।

<!--
That last part is how the public API works. The parent window (`index.html`) sends a message to the `iframe` (`remote.html`) with a command and arguments, and the `iframe` then executes that command and sends the result back with another message.

Sending messages is cumbersome, so the `PlaygroundClient` class provides an object-oriented API that handles the messages internally.
-->

সেই শেষ অংশটিই হলো পাবলিক API যেভাবে কাজ করে তার মূল ভিত্তি। প্যারেন্ট উইন্ডো (`index.html`) কমান্ড এবং আর্গুমেন্ট সহ `iframe` (`remote.html`)-এ একটি বার্তা পাঠায়, এবং তারপর `iframe` সেই কমান্ডটি এক্সিকিউট করে আরেকটি বার্তার মাধ্যমে ফলাফল ফেরত পাঠায়।

সরাসরি বার্তা আদান-প্রদান করা বেশ জটিল, তাই `PlaygroundClient` ক্লাস একটি অবজেক্ট-ওরিয়েন্টেড API প্রদান করে যা অভ্যন্তরীণভাবে এই বার্তাগুলো পরিচালনা করে।

<!--
For quick testing and debugging, `remote.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows:
-->

দ্রুত পরীক্ষা এবং ডিবাগিংয়ের জন্য, `remote.html` জাভাস্ক্রিপ্ট API ক্লায়েন্টটিকে `window.playground` হিসেবেও উন্মুক্ত (expose) করে। আপনি আপনার ডেভটুলস থেকে এটি নিচের মতো করে ব্যবহার করতে পারেন:

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!--
`playground` is a class instance in this context, and you will benefit from browser's autocompletion.
-->

এই প্রসঙ্গে `playground` হলো একটি ক্লাস ইনস্ট্যান্স, ফলে আপনি ব্রাউজারের অটোকমপ্লিশন সুবিধা উপভোগ করতে পারবেন।

<!--
## Index.html
-->

## Index.html {#indexhtml}

<!--
`index.html` is an independent app built around `remote.html` using the WordPress Playground API client.

It renders the browser UI, version selectors, and renders WordPress by embedding `remote.html` via an `iframe`. UI features, such as an address bar or a version selector, are implemented by communicating with `remote.html` using `PlaygroundClient`.

`index.html` monitors the query parameters it receives and triggers the appropriate `PlaygroundClient` methods. For instance, `?plugin=coblocks` triggers `installPluginsFromDirectory( client, ['coblocks'] )`. This mechanism forms the basis of the Query API.
-->

`index.html` হলো ওয়ার্ডপ্রেস প্লেগ্রাউন্ড API ক্লায়েন্ট ব্যবহার করে `remote.html`-এর ওপর ভিত্তি করে তৈরি একটি স্বাধীন অ্যাপ।

এটি ব্রাউজার UI ও সংস্করণ নির্বাচক রেন্ডার করে এবং একটি `iframe`-এর মাধ্যমে `remote.html` এম্বেড করে ওয়ার্ডপ্রেস রেন্ডার করে। অ্যাড্রেস বার বা সংস্করণ নির্বাচকের মতো UI ফিচারগুলো `PlaygroundClient` ব্যবহার করে `remote.html`-এর সাথে যোগাযোগের মাধ্যমে বাস্তবায়িত হয়।

`index.html` তার প্রাপ্ত কোয়েরি প্যারামিটারগুলো পর্যবেক্ষণ করে এবং উপযুক্ত `PlaygroundClient` মেথডগুলো ট্রিগার করে। উদাহরণস্বরূপ, `?plugin=coblocks` প্যারামিটারটি `installPluginsFromDirectory( client, ['coblocks'] )`-কে ট্রিগার করে। এই প্রক্রিয়াটিই কোয়েরি API-এর মূল ভিত্তি তৈরি করে।

<!--
For quick testing and debugging, `index.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows:
-->

দ্রুত পরীক্ষা এবং ডিবাগিংয়ের জন্য, `index.html` জাভাস্ক্রিপ্ট API ক্লায়েন্টটিকে `window.playground` হিসেবেও উন্মুক্ত করে। আপনি আপনার ডেভটুলস থেকে এটি নিচের মতো করে ব্যবহার করতে পারেন:

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!--
Note that `playground` is a Proxy object in this context and you won't get any autocompletion from the browser.
-->

মনে রাখবেন, এই প্রসঙ্গে `playground` একটি প্রক্সি (Proxy) অবজেক্ট এবং আপনি ব্রাউজার থেকে কোনো অটোকমপ্লিশন সুবিধা পাবেন না।
