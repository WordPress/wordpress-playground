---
title: টেস্ট
slug: /about/test
description: থিম, প্লাগইন, পুল রিকোয়েস্ট এবং ওয়ার্ডপ্রেস ও পিএইচপি-র বিভিন্ন ভার্সন টেস্ট করার জন্য কীভাবে প্লেগ্রাউন্ড ব্যবহার করবেন তা জানুন।
---

<!--
# Test
-->

# টেস্ট

<!--
Upgrade your QA process with the ability to review progress in your browser in a single click. When you’re ready, push updates instantly.
-->

এক ক্লিকেই আপনার ব্রাউজারে অগ্রগতির সব কিছু রিভিউ করার মাধ্যমে আপনার QA প্রসেস উন্নত করুন। যখন আপনি প্রস্তুত হবেন, তাৎক্ষণিকভাবে আপডেটগুলো পুশ করুন।

<!--
## Test any theme or plugin
-->

## যেকোনো থিম বা প্লাগইন টেস্ট করুন

<!--
With Playground, you can test any plugin or theme. Use the [Query API](/developers/apis/query-api) to quickly load any plugin or theme published in wordpress.org [plugins](https://wordpress.org/plugins) and [themes](https://wordpress.org/themes/) directories.
-->

প্লেগ্রাউন্ডের সাহায্যে আপনি যেকোনো প্লাগইন বা থিম টেস্ট করতে পারেন। wordpress.org-এর [প্লাগইন](https://wordpress.org/plugins) এবং [থিম](https://wordpress.org/themes/) ডিরেক্টরিতে প্রকাশিত যেকোনো প্লাগইন বা থিম দ্রুত লোড করতে [কোয়েরি API](/developers/apis/query-api) ব্যবহার করুন।

<!--
For example, the following link will load the [“pendant” theme](https://wordpress.org/themes/pendant/) and the[ “gutenberg” plugin](https://wordpress.org/plugins/gutenberg/) on a Playground instance:
-->

উদাহরণস্বরূপ, নিচের লিঙ্কটি একটি প্লেগ্রাউন্ড ইনস্ট্যান্সে [“pendant” থিম](https://wordpress.org/themes/pendant/) এবং [“gutenberg” প্লাগইন](https://wordpress.org/plugins/gutenberg/) লোড করবে:

<!--
[https://playground.wordpress.net/?theme=pendant&plugin=gutenberg](https://playground.wordpress.net/?theme=pendant&plugin=gutenberg)
-->

[https://playground.wordpress.net/?theme=pendant&plugin=gutenberg](https://playground.wordpress.net/?theme=pendant&plugin=gutenberg)

<!--
But you can also test [more elaborate configurations using blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md), for example testing a plugin’s code from a gist (see [blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json))
-->

তবে আপনি [ব্লুপ্রিন্ট ব্যবহার করে আরও উন্নত কনফিগারেশনও](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) টেস্ট করতে পারেন, যেমন একটি গিস্ট (gist) থেকে প্লাগইনের কোড টেস্ট করা ([ব্লুপ্রিন্ট](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) এবং [লাইভ ডেমো](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json) দেখুন)।

<!--
## Live preview pull requests
-->

## পুল রিকোয়েস্টের লাইভ প্রিভিউ

<!--
Testing pull requests is one of the most exciting use cases for the Playground project. With Playground, you can enable a Live preview link on each Pull Request of a WordPress-related project in GitHub so that developers can see in action the effects of code in that Pull Request. Read more about this at [Preview WordPress Core Pull Requests with Playground](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.).
-->

পুল রিকোয়েস্ট টেস্ট করা প্লেগ্রাউন্ড প্রজেক্টের সবচেয়ে উত্তেজনাপূর্ণ ব্যবহারের ক্ষেত্রেগুলোর মধ্যে একটি। প্লেগ্রাউন্ডের মাধ্যমে আপনি গিটহাবে ওয়ার্ডপ্রেস সম্পর্কিত প্রজেক্টের প্রতিটি পুল রিকোয়েস্টে একটি লাইভ প্রিভিউ লিঙ্ক চালু করতে পারেন যাতে ডেভেলপাররা সেই পুল রিকোয়েস্টের কোডের প্রভাব সরাসরি দেখতে পান। এ সম্পর্কে আরও পড়ুন [প্লেগ্রাউন্ডের সাহায্যে ওয়ার্ডপ্রেস কোর পুল রিকোয়েস্ট প্রিভিউ করুন](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.) এই লিঙ্কে।

<!--
There are some public implementations of this use case such as [WordPress Core PR previewer](https://playground.wordpress.net/wordpress.html) and [Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html). Users can input the PR number or URL to be redirected to a WordPress instance, powered by Playground, where the changes from the PR are applied.
-->

এই ব্যবহারের ক্ষেত্রের কিছু পাবলিক ইমপ্লিমেন্টেশন রয়েছে যেমন [ওয়ার্ডপ্রেস কোর পিআর প্রিভিউয়ার](https://playground.wordpress.net/wordpress.html) এবং [গুটেনবার্গ পিআর প্রিভিউয়ার](https://playground.wordpress.net/gutenberg.html)। ব্যবহারকারীরা পিআর নম্বর বা ইউআরএল ইনপুট দিতে পারেন, যা তাদের প্লেগ্রাউন্ড চালিত একটি ওয়ার্ডপ্রেস ইনস্ট্যান্সে রিডাইরেক্ট করবে, যেখানে পিআর-এর পরিবর্তনগুলো কার্যকর থাকবে।

<!--
You can add automated PR preview buttons to your own plugin or theme repository using the WordPress Playground PR Preview GitHub Action. When someone opens a pull request, the action automatically adds a button that launches a configured WordPress instance with the changes ready to test. For detailed setup instructions and advanced configurations, see the [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) guide.
-->

আপনি ওয়ার্ডপ্রেস প্লেগ্রাউন্ড পিআর প্রিভিউ গিটহাব অ্যাকশন ব্যবহার করে আপনার নিজস্ব প্লাগইন বা থিম রিপোজিটরিতে স্বয়ংক্রিয় পিআর প্রিভিউ বাটন যোগ করতে পারেন। যখন কেউ একটি পুল রিকোয়েস্ট ওপেন করবে, এই অ্যাকশনটি স্বয়ংক্রিয়ভাবে একটি বাটন যোগ করবে যা টেস্ট করার জন্য প্রস্তুত কনফিগার করা একটি ওয়ার্ডপ্রেস ইনস্ট্যান্স চালু করবে। বিস্তারিত সেটআপ নির্দেশাবলী এবং উন্নত কনফিগারেশনের জন্য [গিটহাব অ্যাকশনের সাহায্যে পিআর প্রিভিউ বাটন যোগ করা](/guides/github-action-pr-preview) নির্দেশিকাটি দেখুন।

<!--
## Clone your site and experiment in a private sandbox.
-->

## আপনার সাইট ক্লোন করুন এবং একটি প্রাইভেট স্যান্ডবক্সে এক্সপেরিমেন্ট করুন

<!--
With the [Sandbox Site powered by Playground](https://wordpress.org/plugins/playground/) plugin you can create a private WordPress Playground copy of your site to test plugins safely or do any other experiments on your site’s replica without uploading any data to the cloud and without affecting the original site.
-->

[প্লেগ্রাউন্ড চালিত স্যান্ডবক্স সাইট](https://wordpress.org/plugins/playground/) প্লাগইনটির সাহায্যে আপনি নিরাপদে প্লাগইন টেস্ট করতে বা আপনার সাইটের রেপ্লিকাতে অন্য কোনো এক্সপেরিমেন্ট করার জন্য আপনার সাইটের একটি প্রাইভেট ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কপি তৈরি করতে পারেন। এতে কোনো ডেটা ক্লাউডে আপলোড হবে না এবং মূল সাইটটিও প্রভাবিত হবে না।

<!--
## Test different WordPress and PHP versions.
-->

## ওয়ার্ডপ্রেস এবং পিএইচপি-র বিভিন্ন ভার্সন টেস্ট করুন

<!--
With Playground, you can quickly test any major WordPress or PHP version by _customizing its settings_ or using a custom blueprint with the `preferredVersions` property.
-->

প্লেগ্রাউন্ডের মাধ্যমে আপনি এর _সেটিংস কাস্টমাইজ_ করে অথবা `preferredVersions` প্রপার্টি সহ কাস্টম ব্লুপ্রিন্ট ব্যবহার করে যেকোনো মেজর ওয়ার্ডপ্রেস বা পিএইচপি ভার্সন দ্রুত টেস্ট করতে পারেন।

<!--
For example, you can always test the latest development version of WordPress, also called [Beta Nightly](https://wordpress.org/download/beta-nightly/), from this link: [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly)
-->

উদাহরণস্বরূপ, আপনি এই লিঙ্ক থেকে ওয়ার্ডপ্রেসের সর্বশেষ ডেভেলপমেন্ট ভার্সন (যাকে [Beta Nightly](https://wordpress.org/download/beta-nightly/) বলা হয়) সব সময় টেস্ট করতে পারেন: [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly)

<!--
During the Beta period of any WordPress release, you can also test the latest WordPress Beta or RC release with theme test data and debugging plugins (see [blueprint](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) and [live demo). ](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json)
-->

যেকোনো ওয়ার্ডপ্রেস রিলিজের বিটা পিরিয়ড চলাকালীন, আপনি থিম টেস্ট ডেটা এবং ডিবাগিং প্লাগইনসহ সর্বশেষ ওয়ার্ডপ্রেস বিটা বা আরসি রিলিজ টেস্ট করতে পারেন ([ব্লুপ্রিন্ট](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) এবং [লাইভ ডেমো](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json) দেখুন)।

<!--
You can also load any [theme, plugin](/developers/apis/query-api), or [configuration](/blueprints) in any of the available WordPress and PHP versions to check how they work in that environment.
-->

সেই পরিবেশে এগুলো কীভাবে কাজ করে তা চেক করতে আপনি উপলব্ধ যেকোনো ওয়ার্ডপ্রেস এবং পিএইচপি ভার্সনে যেকোনো [থিম, প্লাগইন](/developers/apis/query-api) বা [কনফিগারেশন](/blueprints) লোড করতে পারেন।

<!--
The [WordPress Playground: the ultimate learning, testing, & teaching tool for WordPress](https://www.youtube.com/watch?v=dN_LaenY8bI) provides a great overview of the testing possibilities with Playground.
-->

[ওয়ার্ডপ্রেস প্লেগ্রাউন্ড: ওয়ার্ডপ্রেসের জন্য চূড়ান্ত শেখার, টেস্ট করার এবং শেখানোর টুল](https://www.youtube.com/watch?v=dN_LaenY8bI) ভিডিওটি প্লেগ্রাউন্ডের মাধ্যমে টেস্টিংয়ের সম্ভাবনাগুলোর একটি দারুণ ওভারভিউ প্রদান করে।
