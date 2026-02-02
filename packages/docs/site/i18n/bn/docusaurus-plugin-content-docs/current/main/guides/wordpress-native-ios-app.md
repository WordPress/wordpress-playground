---
title: নেটিভ iOS অ্যাপে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড
slug: /guides/wordpress-native-ios-app
description: প্লেগ্রাউন্ড ব্যবহার করে "ব্লকনোট" কেস স্টাডির ওপর ভিত্তি করে কীভাবে একটি নেটিভ iOS অ্যাপের মধ্যে ওয়ার্ডপ্রেস সাইট চালানো যায় তা জানুন।
---

<!--
## How to ship a real WordPress site in a native iOS app via Playground?
-->

## কীভাবে প্লেগ্রাউন্ডের মাধ্যমে একটি নেটিভ iOS অ্যাপে একটি প্রকৃত ওয়ার্ডপ্রেস সাইট পাঠানো যায়?

<!--
Blocknotes is the first iOS application that ran WordPress natively on iOS devices by leveraging WordPress Playground. Developed by [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), a core committer for WordPress, Blocknotes represents a significant leap in the capabilities of mobile applications by utilizing WebAssembly to run WordPress without the need for a traditional PHP server.
-->

ব্লকনোট হলো প্রথম iOS অ্যাপ্লিকেশন যা ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্যবহার করে iOS ডিভাইসে নেটিভভাবে ওয়ার্ডপ্রেস চালিয়েছিল। ওয়ার্ডপ্রেসের একজন কোর কমিটার [Ella van Durpe](https://profiles.wordpress.org/ellatrix/) দ্বারা ডেভেলপ করা ব্লকনোট একটি ট্র্যাডিশনাল PHP সার্ভারের প্রয়োজন ছাড়াই ওয়ার্ডপ্রেস চালানোর জন্য ওয়েবঅ্যাসেম্বলি ব্যবহার করে মোবাইল অ্যাপ্লিকেশনের সক্ষমতায় একটি উল্লেখযোগ্য অগ্রগতি প্রদর্শন করে।

<!--
This case study explores the features, technical implementation, and potential implications of Blocknotes for the future of mobile and web development.
-->

এই কেস স্টাডিটি মোবাইল এবং ওয়েব ডেভেলপমেন্টের ভবিষ্যতের জন্য ব্লকনোটের বৈশিষ্ট্য, টেকনিক্যাল ইমপ্লিমেন্টেশন এবং এর সম্ভাব্য প্রভাবগুলো অন্বেষণ করে।

<!--
**Important!** The current version of Blocknotes isn’t running WordPress Playground anymore. Since the initial release, the app was rewritten to only use the WordPress block editor without the rest of WordPress. This case study covers the early versions of Blocknotes that opened an entire world of new possibilities for WordPress.
-->

**গুরুত্বপূর্ণ!** ব্লকনোট-এর বর্তমান ভার্সনে এখন আর ওয়ার্ডপ্রেস প্লেগ্রাউন্ড চলছে না। প্রাথমিক রিলিজের পর, অ্যাপটিকে ওয়ার্ডপ্রেসের বাকি অংশ ছাড়াই শুধুমাত্র ওয়ার্ডপ্রেস ব্লক এডিটর ব্যবহার করার জন্য নতুন করে লেখা হয়েছে। এই কেস স্টাডিটি ব্লকনোট-এর প্রাথমিক ভার্সনগুলোকে কভার করে যা ওয়ার্ডপ্রেসের জন্য নতুন সম্ভাবনার এক বিশাল জগত উন্মোচন করেছিল।

<!--
## Blocknotes features
-->

## ব্লকনোট-এর বৈশিষ্ট্যসমূহ

<!--
Blocknotes allows users to create and edit notes using the WordPress block editor. The notes are automatically saved as HTML files to the user’s iCloud Drive and seamlessly synchronized across devices.
-->

ব্লকনোট ব্যবহারকারীদের ওয়ার্ডপ্রেস ব্লক এডিটর ব্যবহার করে নোট তৈরি এবং এডিট করার অনুমতি দেয়। নোটগুলো স্বয়ংক্রিয়ভাবে ইউজারের iCloud ড্রাইভে HTML ফাইল হিসেবে সেভ হয় এবং নিরবিচ্ছিন্নভাবে সব ডিভাইসে সিনক্রোনাইজ হয়ে যায়।

<!--
## Technical Implementation
-->

## টেকনিক্যাল ইমপ্লিমেন্টেশন

<!--
Blocknotes operated as a WebView running an HTML page where a WebAssembly version of PHP was running WordPress. That HTML page was packaged as a native iOS via [Capacitor](https://capacitorjs.com/). This setup allowed WordPress to function in environments traditionally not supported.
-->

ব্লকনোট একটি ওয়েবভিউ হিসেবে কাজ করত যা একটি HTML পেজ চালাত যেখানে PHP-র একটি ওয়েবঅ্যাসেম্বলি ভার্সন ওয়ার্ডপ্রেস চালাত। সেই HTML পেজটি [ক্যাপাসিটর](https://capacitorjs.com/)-এর মাধ্যমে নেটিভ iOS হিসেবে প্যাকেজ করা হয়েছিল। এই সেটআপটি ওয়ার্ডপ্রেসকে এমন পরিবেশে কাজ করার সুযোগ দিয়েছিল যেখানে সাধারণত এটি সাপোর্ট করে না।

<!--
In [Blocknotes GitHub repository](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) you can review the last Playground-based release. Here are the most important parts:
-->

[ব্লকনোট GitHub রিপোজিটরিতে](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) আপনি সর্বশেষ প্লেগ্রাউন্ড-ভিত্তিক রিলিজটি রিভিউ করতে পারেন। এখানে সবচেয়ে গুরুত্বপূর্ণ অংশগুলো রয়েছে:

<!--
-   [A WordPress build](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (packaged as a `.data` file).
-   [Static WordPress assets](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
-   [A WebAssembly build of PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) (via [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
-   [A web worker running PHP and WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
-   [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress plugin ([installed here](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) to turn wp-admin into a note-taking app.
-   A layer to [load WordPress posts from iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) and [save changes as iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).
-->

-   [একটি ওয়ার্ডপ্রেস বিল্ড](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (`.data` ফাইল হিসেবে প্যাকেজ করা)।
-   [স্ট্যাটিক ওয়ার্ডপ্রেস অ্যাসেটসমূহ](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public)।
-   [PHP-র একটি ওয়েবঅ্যাসেম্বলি বিল্ড](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) ([@php-wasm/web](https://npmjs.com/package/@php-wasm/web)-এর মাধ্যমে)।
-   [PHP এবং ওয়ার্ডপ্রেস চালানো একটি ওয়েব ওয়ার্কার](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js)।
-   wp-admin-কে একটি নোট নেওয়ার অ্যাপে পরিণত করতে [Hypernotes](https://wordpress.com/plugins/hypernotes) ওয়ার্ডপ্রেস প্লাগইন ([এখানে ইনস্টল করা হয়েছে](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160))।
-   [iOS ফাইল থেকে ওয়ার্ডপ্রেস পোস্ট লোড করার](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) জন্য এবং [পরিবর্তনগুলো iOS ফাইল হিসেবে সেভ করার](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js) জন্য একটি লেয়ার।

<!--
## Building your own iOS app with WordPress Playground
-->

## ওয়ার্ডপ্রেস প্লেগ্রাউন্ড দিয়ে আপনার নিজস্ব iOS অ্যাপ তৈরি করা

<!--
Although Blocknotes proved releasing a WordPress-based iOS app is possible, this is still a highly exploratory area. There are no established workflows, libraries, or knowledge bases.
-->

যদিও ব্লকনোট প্রমাণ করেছে যে ওয়ার্ডপ্রেস-ভিত্তিক iOS অ্যাপ রিলিজ করা সম্ভব, তবে এটি এখনও একটি উচ্চমাত্রার অনুসন্ধানী এলাকা। এখানে কোনো প্রতিষ্ঠিত ওয়ার্কফ্লো, লাইব্রেরি বা নলেজ বেস নেই।

<!--
The best documentation we have is the Blocknotes repository. Use it as a reference and a starting point for exploring your new app. Review the key components like the WebAssembly build of PHP, the integration of the WordPress block editor, and how web workers are utilized to run WordPress efficiently. By dissecting these elements, you can gain insights into building your own iOS app with WordPress Playground, pushing the boundaries of what’s possible with mobile web applications.
-->

আমাদের কাছে সেরা ডকুমেন্টেশন হলো ব্লকনোট রিপোজিটরি। আপনার নতুন অ্যাপটি অন্বেষণ করার জন্য এটিকে রেফারেন্স এবং শুরুর পয়েন্ট হিসেবে ব্যবহার করুন। PHP-র ওয়েবঅ্যাসেম্বলি বিল্ড, ওয়ার্ডপ্রেস ব্লক এডিটরের ইন্টিগ্রেশন এবং ওয়ার্ডপ্রেসকে দক্ষতার সাথে চালানোর জন্য কিভাবে ওয়েব ওয়ার্কার ব্যবহার করা হয় তার মতো মূল উপাদানগুলো রিভিউ করুন। এই উপাদানগুলো বিশ্লেষণ করার মাধ্যমে আপনি ওয়ার্ডপ্রেস প্লেগ্রাউন্ড দিয়ে আপনার নিজস্ব iOS অ্যাপ তৈরির অন্তর্দৃষ্টি লাভ করতে পারেন, যা মোবাইল ওয়েব অ্যাপ্লিকেশনের মাধ্যমে যা সম্ভব তার সীমাবদ্ধতাকে আরও বাড়িয়ে দেয়।

<!--
As you navigate this innovative space, share your findings and challenges with the Playground team and the broader WordPress community. Publishing your learnings will not only aid in your development but also contribute to a collective knowledge base, driving forward the future of WordPress on mobile.
-->

আপনি যখন এই উদ্ভাবনী স্পেসে এগিয়ে যাবেন, আপনার প্রাপ্ত ফলাফল এবং চ্যালেঞ্জগুলো প্লেগ্রাউন্ড টিম এবং বিস্তৃত ওয়ার্ডপ্রেস কমিউনিটির সাথে শেয়ার করুন। আপনার শেখা বিষয়গুলো পাবলিশ করা শুধুমাত্র আপনার ডেভেলপমেন্টেই সাহায্য করবে না, বরং একটি সম্মিলিত নলেজ বেস তৈরিতে অবদান রাখবে, যা মোবাইলে ওয়ার্ডপ্রেসের ভবিষ্যৎকে আরও এগিয়ে নিয়ে যাবে।

<!--
## Potential and the future
-->

## সম্ভাবনা এবং ভবিষ্যৎ

<!--
Blocknotes paves the way for a new generation of applications that are more accessible, flexible, and powerful.
-->

ব্লকনোট এক নতুন প্রজন্মের অ্যাপ্লিকেশনের পথ প্রশস্ত করে যা আরও অ্যাক্সেসযোগ্য, ফ্লেক্সিবল এবং শক্তিশালী।

<!--
Once the app-building workflows mature, we may see an automated pipelines for packaging Playground sites as iOS apps. It would make it extremely easy to run the same codebase on the server, in the browser, and as a mobile app.
-->

একবার অ্যাপ-বিল্ডিং ওয়ার্কফ্লো পরিপক্ক হলে, আমরা প্লেগ্রাউন্ড সাইটগুলোকে iOS অ্যাপ হিসেবে প্যাকেজ করার জন্য স্বয়ংক্রিয় পাইপলাইন দেখতে পারি। এটি একই কোডবেস সার্ভারে, ব্রাউজারে এবং মোবাইল অ্যাপ হিসেবে চালানো অত্যন্ত সহজ করে দেবে।

<!--
By working together and sharing our findings, we can push the boundaries of what’s possible with WordPress and mobile app development
-->

একত্রে কাজ করার এবং আমাদের ফলাফলগুলো শেয়ার করার মাধ্যমে আমরা ওয়ার্ডপ্রেস এবং মোবাইল অ্যাপ ডেভেলপমেন্টে যা সম্ভব তার সীমানাকে আরও প্রসারিত করতে পারি।
