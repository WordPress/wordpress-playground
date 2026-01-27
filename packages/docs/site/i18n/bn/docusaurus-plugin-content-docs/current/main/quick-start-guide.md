---
title: কুইক স্টার্ট গাইড
slug: /quick-start-guide
description: প্লেগ্রাউন্ড দিয়ে শুরু করার একটি ৫ মিনিটের গাইড। প্লাগইন পরীক্ষা করা, থিম ট্রাই করা এবং বিভিন্ন WP/PHP সংস্করণ ব্যবহার করার পদ্ধতি শিখুন।
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!--
# Start using WordPress Playground in 5 minutes
-->

# ৫ মিনিটে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্যবহার শুরু করুন

<!--
WordPress Playground can help you with any of the following:
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড আপনাকে নিচের যেকোনো কাজে সাহায্য করতে পারে:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video:
-->

এই পেজটি আপনাকে এগুলোর প্রতিটি ধাপে নির্দেশিকা প্রদান করবে। ওহ, আপনি যদি দেখে শিখতে পছন্দ করেন – তবে এখানে একটি ভিডিও আছে:

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## একটি নতুন ওয়ার্ডপ্রেস সাইট শুরু করুন

<!--
Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site.
-->

প্রতিবার যখন আপনি [playground.wordpress.net-এ অফিশিয়াল ডেমো](https://playground.wordpress.net/) ভিজিট করবেন, আপনি একটি নতুন ওয়ার্ডপ্রেস সাইট পাবেন।

<!--
You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress.
-->

এরপর আপনি পেজ তৈরি করতে পারেন, প্লাগইন ও থিম আপলোড করতে পারেন, আপনার নিজস্ব সাইট ইমপোর্ট করতে পারেন এবং সাধারণ ওয়ার্ডপ্রেসে আপনি যা যা করেন তার প্রায় সবকিছুই করতে পারেন।

<!--
It's that easy to start!
-->

শুরু করা ঠিক এতটাই সহজ!

<!--
The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page!
-->

পুরো সাইটটি আপনার ব্রাউজারেই থাকে এবং আপনি ট্যাবটি বন্ধ করলে তা মুছে যায়। নতুন করে শুরু করতে চান? শুধু পেজটি রিফ্রেশ করুন!

<!--
:::info WordPress Playground is private

Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over!

:::
-->

:::তথ্য ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্যক্তিগত

আপনি যা কিছু তৈরি করেন তা আপনার ব্রাউজারেই থাকে এবং কোথাও পাঠানো হয় না। আপনার কাজ শেষ হয়ে গেলে, আপনি আপনার সাইটটিকে একটি জিপ ফাইল হিসেবে এক্সপোর্ট করতে পারেন। অথবা শুধু পেজটি রিফ্রেশ করে নতুন করে শুরু করতে পারেন!

:::

<!--
## Try a block, a theme, or a plugin
-->

## একটি ব্লক, থিম বা প্লাগইন ট্রাই করুন

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

আপনি [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/)-এ আপনার পছন্দের যেকোনো প্লাগইন বা থিম আপলোড করতে পারেন।

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

কয়েকটি ক্লিক বাঁচাতে, আপনি URL-এ একটি `plugin` বা `theme` প্যারামিটার যোগ করে ওয়ার্ডপ্রেস প্লাগইন ডিরেক্টরি থেকে প্লাগইন বা থিম আগে থেকেই ইনস্টল করে রাখতে পারেন। উদাহরণস্বরূপ, coblocks প্লাগইনটি ইনস্টল করতে আপনি এই URL টি ব্যবহার করতে পারেন:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

অথবা `pendant` থিমটি প্রি-ইনস্টল করতে এই URL টি:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

আপনি যদি একাধিক থিম এবং প্লাগইন ইনস্টল করতে চান, তবে `theme` বা `plugin` প্যারামিটারগুলো পুনরাবৃত্তি করা সম্ভব:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

আপনি এই প্যারামিটারগুলো মিলিয়ে বা একাধিক প্লাগইন যোগ করেও ব্যবহার করতে পারেন:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

<!--
## Save your site
-->

## আপনার সাইটটি সংরক্ষণ করুন

<!--
To keep your WordPress Playground site for longer than a single browser session, you can export it as a `.zip` file.
-->

আপনার ওয়ার্ডপ্রেস প্লেগ্রাউন্ড সাইটটি একটি ব্রাউজার সেশনের চেয়ে বেশি সময় ধরে রাখতে, আপনি এটিকে একটি `.zip` ফাইল হিসেবে এক্সপোর্ট করতে পারেন।

<!--
1. Open the Playground site manager panel:
-->

১. প্লেগ্রাউন্ড সাইট ম্যানেজার প্যানেলটি খুলুন:

![Site Manager](@site/static/img/site-manager/open-site-manager.webp)

<!--
2. Use the "Download as .zip" button in the additional actions menu
-->

২. অতিরিক্ত অ্যাকশন মেনু থেকে "Download as .zip" বাটনটি ব্যবহার করুন

![Export button](@site/static/img/site-manager/export-zip-file.webp)

<!--
The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there.
-->

এক্সপোর্ট করা ফাইলে আপনার তৈরি করা সম্পূর্ণ সাইটটি থাকে। আপনি এটিকে PHP এবং SQLite সাপোর্ট করে এমন যেকোনো সার্ভারে হোস্ট করতে পারেন। ওয়ার্ডপ্রেসের সমস্ত কোর ফাইল, প্লাগইন, থিম এবং আপনি আপনার সাইটে যা যা যোগ করেছেন তার সবকিছুই সেখানে থাকে।

<!--
The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager.
-->

এক্সপোর্টের সাথে SQLite ডাটাবেস ফাইলটিও অন্তর্ভুক্ত থাকে, যা আপনি `wp-content/database/.ht.sqlite` ঠিকানায় পাবেন। মনে রাখবেন যে, ডট (.) দিয়ে শুরু হওয়া ফাইলগুলো সাধারণত অধিকাংশ অপারেটিং সিস্টেমে ডিফল্টভাবে লুকানো থাকে, তাই আপনার ফাইল ম্যানেজারে "Show hidden files" অপশনটি চালু করার প্রয়োজন হতে পারে।

<!--
## Restore a saved site
-->

## একটি সংরক্ষিত সাইট রিস্টোর করুন

<!--
You can restore the saved site using the "Import from .zip" button in the Playground dashboard panel:
-->

আপনি প্লেগ্রাউন্ড ড্যাশবোর্ড প্যানেলের "Import from .zip" বাটনটি ব্যবহার করে সংরক্ষিত সাইটটি রিস্টোর করতে পারেন:

<!--
1. Open the Playground dashboard panel:
-->

১. প্লেগ্রাউন্ড ড্যাশবোর্ড প্যানেলটি খুলুন:

![Open Playground Dashboard](@site/static/img/dashboard/open-playground-dashboard.webp)

<!--
1. Use the "Import .zip" button at the end of the "Start a new Playground" section
-->

২. "Start a new Playground" সেকশনের শেষে থাকা "Import .zip" বাটনটি ব্যবহার করুন

![Open Playground Dashboard](@site/static/img/dashboard/import-playground.webp)

<!--
## Use a specific WordPress or PHP version
-->

## একটি নির্দিষ্ট ওয়ার্ডপ্রেস বা PHP সংস্করণ ব্যবহার করুন

<!--
The quickest way to change the version of WordPress or PHP is by using the settings panel on the [official demo site](https://playground.wordpress.net/):
-->

ওয়ার্ডপ্রেস বা PHP-এর সংস্করণ পরিবর্তন করার দ্রুততম উপায় হলো [অফিশিয়াল ডেমো সাইটে](https://playground.wordpress.net/) সেটিংস প্যানেল ব্যবহার করা:

![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp)

<!--
:::info Test your plugin or theme

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

:::
-->

:::তথ্য আপনার প্লাগইন বা থিম পরীক্ষা করুন

এতগুলো ওয়ার্ডপ্রেস এবং PHP সংস্করণের সাথে সামঞ্জস্যতা পরীক্ষা করা সবসময়ই ঝামেলার কাজ ছিল। ওয়ার্ডপ্রেস প্লেগ্রাউন্ড এই প্রক্রিয়াটিকে একদম সহজ করে দেয় – এর সুবিধা নিন!

:::

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

আপনি প্লেগ্রাউন্ড খুলতে সঠিক সংস্করণগুলো আগে থেকেই লোড করে রাখার জন্য `wp` এবং `php` [কোয়েরি প্যারামিটার](/developers/apis/query-api) ব্যবহার করতে পারেন:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

ডেমোর জন্য কন্টেন্ট তৈরি সম্পর্কে আরও জানতে, [আপনার ডেমো গাইডের জন্য কন্টেন্ট প্রদান](./guides/providing-content-for-your-demo) দেখুন।

<!--
:::info Major versions only

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work.

:::
-->

:::তথ্য শুধুমাত্র মেজর সংস্করণগুলো

আপনি `wp=6.2` বা `php=8.1`-এর মতো মেজর সংস্করণগুলো নির্দিষ্ট করতে পারেন এবং সেই লাইনের সাম্প্রতিক রিলিজটি আশা করতে পারেন। তবে, আপনি পুরনো মাইনর সংস্করণগুলোর অনুরোধ করতে পারবেন না, তাই `wp=6.1.2` বা `php=7.4.9` কাজ করবে না।

:::

<!--
## Import a WXR file
-->

## একটি WXR ফাইল ইমপোর্ট করুন

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

আপনি [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php)-এ একটি WXR ফাইল আপলোড করে ওয়ার্ডপ্রেস এক্সপোর্ট ফাইল ইমপোর্ট করতে পারেন।

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

আপনি [JSON ব্লুপ্রিন্ট](/blueprints) ও ব্যবহার করতে পারেন। আরও জানতে [ব্লুপ্রিন্ট দিয়ে শুরু করা](/blueprints/getting-started) দেখুন।

<!--
This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site.
-->

এটি উপরে বর্ণিত ইমপোর্ট ফিচার থেকে আলাদা। আগের ইমপোর্ট ফিচারটিতে ডাটাবেসসহ সম্পূর্ণ সাইট এক্সপোর্ট করা হয়। এই ইমপোর্ট ফিচারটি একটি বিদ্যমান সাইটে একটি WXR ফাইল ইমপোর্ট করে।

<!--
## Build apps with WordPress Playground
-->

## ওয়ার্ডপ্রেস প্লেগ্রাউন্ড দিয়ে অ্যাপ তৈরি করুন

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), setup plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড হলো একটি প্রোগ্রামেবল টুল, যার অর্থ হলো আপনি [ওয়ার্ডপ্রেস অ্যাপ তৈরি করতে পারেন](/developers/build-your-first-app), প্লাগইন ডেমো সেটআপ করতে পারেন এবং এমনকি এটিকে কোনো বাড়তি ঝামেলা ছাড়াই [লোকাল ডেভেলপমেন্ট এনভায়রনমেন্ট](/developers/local-development/) হিসেবেও ব্যবহার করতে পারেন।

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের মাধ্যমে ডেভেলপমেন্ট সম্পর্কে আরও জানতে, [ডেভেলপমেন্ট কুইক স্টার্ট](/developers/build-your-first-app) সেকশনটি দেখুন।
