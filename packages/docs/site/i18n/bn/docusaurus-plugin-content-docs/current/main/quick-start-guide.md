---
title: কুইক স্টার্ট গাইড
slug: /quick-start-guide
description: Playground দিয়ে শুরু করার ৫ মিনিটের নির্দেশিকা। প্লাগইন পরীক্ষা, থিম ব্যবহার এবং বিভিন্ন WP/PHP সংস্করণ ব্যবহার করা শিখুন।
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# ৫ মিনিটে ওয়ার্ডপ্রেস Playground ব্যবহার শুরু করুন

<!--
WordPress Playground can help you with any of the following:
-->

ওয়ার্ডপ্রেস Playground নিচের যেকোনো কাজে আপনাকে সাহায্য করতে পারে:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

এই পেজটি প্রতিটি বিষয়ের নির্দেশনা দেবে। দেখে শিখতে পছন্দ করলে এই ভিডিওটি দেখুন।
ভিডিওর কিছু ইন্টারফেস Dock চালুর আগের; বর্তমান UI-এর জন্য নিচের লিখিত ধাপ অনুসরণ করুন।

<!--
<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>
-->

<iframe width="752" height="423.2" title="WordPress Playground ব্যবহার শুরু করা" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## একটি নতুন ওয়ার্ডপ্রেস সাইট শুরু করুন

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

ব্রাউজারে ওয়ার্ডপ্রেস চালু করতে [playground.wordpress.net-এর অফিসিয়াল ডেমো](https://playground.wordpress.net/) খুলুন।

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

আপনি পেজ তৈরি, প্লাগইন আপলোড, থিম ইনস্টল, কনটেন্ট ইম্পোর্ট এবং সাধারণ ওয়ার্ডপ্রেস
সাইটের প্রায় সব কাজ করতে পারেন।

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

ব্রাউজার স্টোরেজ পাওয়া গেলে নতুন Playground স্বয়ংক্রিয়ভাবে autosave হয়। Dock-এর
**Your Playgrounds**-এ সর্বোচ্চ পাঁচটি সাম্প্রতিক autosave পাবেন। রিফ্রেশ করলে মুছে যায়
এমন সাইট দরকার হলে `?storage=temp` দিয়ে Playground খুলুন।

<div class="callout callout-info">

<!--
**WordPress Playground is private**
-->

**ওয়ার্ডপ্রেস Playground ব্যক্তিগত**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

Playground আপনার ব্রাউজারেই চলে। **Export to GitHub**-এর মতো কোনো অ্যাকশন না নিলে এটি
আপনার সাইট আপলোড করে না। কাজ শেষে Playground স্থায়ীভাবে সংরক্ষণ করতে, ZIP হিসেবে
এক্সপোর্ট করতে অথবা **New Playground** থেকে নতুন করে শুরু করতে পারেন।

</div>

<!--
## Try a block, a theme, or a plugin
-->

## একটি ব্লক, থিম বা প্লাগইন ব্যবহার করে দেখুন

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

আপনি [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/)-এ যেকোনো প্লাগইন বা থিম আপলোড করতে পারেন।

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

কিছু ক্লিক বাঁচাতে URL-এ `plugin` বা `theme` প্যারামিটার যোগ করে ওয়ার্ডপ্রেস ডিরেক্টরি
থেকে প্লাগইন বা থিম আগে থেকেই ইনস্টল করতে পারেন। যেমন, coblocks প্লাগইন ইনস্টল করতে:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

অথবা `pendant` থিম আগে থেকে ইনস্টল করতে:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

একাধিক থিম ও প্লাগইন ইনস্টল করতে `theme` বা `plugin` প্যারামিটার পুনরাবৃত্তি করা যায়:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

প্যারামিটারগুলো মিলিয়ে একাধিক প্লাগইনও যোগ করতে পারেন:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

এটিকে [Query API](/developers/apis/query-api/) বলা হয়। এ সম্পর্কে [এখানে আরও জানুন](/developers/apis/query-api/)।

<!--
## Store a Playground in browser storage
-->

## ব্রাউজার স্টোরেজে Playground সংরক্ষণ করুন

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

**Store permanently** খুলতে Dock-এর **Autosaved** অথবা **Unsaved** স্ট্যাটাসে ক্লিক
করুন, তারপর **Save in browser storage** বেছে নিন।

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Playground নাম এবং Save বোতাম সহ Store permanently পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

ব্রাউজারে সংরক্ষিত Playground **Your Playgrounds**-এ দেখা যায়। Autosave-ও সেখানে
থাকে, তবে Playground সর্বোচ্চ পাঁচটি সাম্প্রতিক autosave রাখে। Autosave-এর সময়সীমার
পরেও রাখতে চাইলে Playground-টি স্থায়ীভাবে সংরক্ষণ করুন।

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

ব্রাউজার স্টোরেজ ব্রাউজারেরই অংশ। সরানো, আর্কাইভ করা বা পরে পুনরুদ্ধারের জন্য কোনো
ফাইল দরকার হলে ZIP এক্সপোর্ট করুন।

<!--
## Export a portable ZIP
-->

## বহনযোগ্য ZIP এক্সপোর্ট করুন

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Dock থেকে **Export** খুলে **Download as .zip** ব্যবহার করুন।

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Download as .zip হাইলাইট করা Export পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

এক্সপোর্ট করা ফাইলে বর্তমান ফাইল, ডেটাবেস, প্লাগইন, থিম, আপলোড এবং সম্পাদনা থাকে।
Playground-এ এটি পুনরুদ্ধার করতে অথবা PHP ও SQLite সমর্থিত সার্ভারে হোস্ট করতে পারেন।

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

SQLite ডেটাবেস ফাইলটি `wp-content/database/.ht.sqlite`-এ থাকে। ডট দিয়ে শুরু হওয়া
ফাইল অধিকাংশ অপারেটিং সিস্টেমে ডিফল্টভাবে লুকানো থাকে, তাই ফাইল ম্যানেজারে hidden file
দেখানোর বিকল্প চালু করতে হতে পারে।

<!--
## Restore a ZIP
-->

## একটি ZIP পুনরুদ্ধার করুন

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Dock থেকে **New Playground** খুলুন, **Import zip** বেছে নিন এবং ZIP ফাইলটি নির্বাচন করুন।

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Import zip নির্বাচিত New Playground পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

এটি ZIP-এর ফাইল ও ডেটাবেস একটি নতুন Playground-এ পুনরুদ্ধার করে।

<!--
## Use a specific WordPress or PHP version
-->

## নির্দিষ্ট ওয়ার্ডপ্রেস বা PHP সংস্করণ ব্যবহার করুন

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

ওয়ার্ডপ্রেস, PHP, ভাষা, multisite এবং networking-এর বিকল্প বেছে নিতে Dock থেকে
**Site Settings** খুলুন।

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Site Settings পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!--
**Test your plugin or theme**
-->

**আপনার প্লাগইন বা থিম পরীক্ষা করুন**

<!--
Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

অনেক ওয়ার্ডপ্রেস ও PHP সংস্করণে সামঞ্জস্য পরীক্ষা করা সবসময় কঠিন ছিল। ওয়ার্ডপ্রেস
Playground এই প্রক্রিয়াটি সহজ করে—এর সুবিধা নিন।

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

সঠিক সংস্করণ আগে থেকেই লোড করা Playground খুলতে `wp` ও `php`
[query parameter](/developers/apis/query-api) ব্যবহার করতে পারেন:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

এটিকে [Query API](/developers/apis/query-api/) বলা হয়। এ সম্পর্কে [এখানে আরও জানুন](/developers/apis/query-api/)।

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

php-src development branch থেকে তৈরি পরবর্তী PHP সংস্করণ প্রিভিউ করতে `php=next`
ব্যবহার করুন। যেমন, [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html) দেখুন।

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

ডেমোর কনটেন্ট প্রস্তুত করার বিষয়ে জানতে [ডেমোর জন্য কনটেন্ট দেওয়ার নির্দেশিকা](/guides/providing-content-for-your-demo) দেখুন।

<div class="callout callout-info">

<!--
**Major versions only**
-->

**শুধু মেজর সংস্করণ**

<!--
You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

`wp=6.2` বা `php=8.1`-এর মতো মেজর সংস্করণ দিলে সেই ধারার সর্বশেষ রিলিজ পাওয়া যাবে।
পুরোনো মাইনর সংস্করণ চাওয়া যায় না, তাই `wp=6.1.2` বা `php=7.4.9` কাজ করবে না।
`latest` ও `next`-এর মতো সাধারণ alias এর ব্যতিক্রম।

</div>

<!--
## Import a WXR file
-->

## একটি WXR ফাইল ইম্পোর্ট করুন

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

[/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php)-এ WXR ফাইল আপলোড করে ওয়ার্ডপ্রেস export file ইম্পোর্ট করতে পারেন।

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

[JSON Blueprints](/blueprints) ব্যবহার করেও এটি করা যায়। আরও জানতে
[Blueprint ব্যবহার শুরু করা](/blueprints/getting-started) দেখুন।

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

এটি Playground ZIP পুনরুদ্ধার করা থেকে আলাদা। WXR একটি বিদ্যমান সাইটে ওয়ার্ডপ্রেস
কনটেন্ট ইম্পোর্ট করে। Playground ZIP নতুন Playground-এ ফাইল ও ডেটাবেস পুনরুদ্ধার করে।

<!--
## Build apps with WordPress Playground
-->

## ওয়ার্ডপ্রেস Playground দিয়ে অ্যাপ তৈরি করুন

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

ওয়ার্ডপ্রেস Playground প্রোগ্রাম করা যায়। অর্থাৎ আপনি [ওয়ার্ডপ্রেস অ্যাপ তৈরি](/developers/build-your-first-app), plugin demo সেটআপ এবং zero-setup [local development environment](/developers/local-development/) হিসেবে এটি ব্যবহার করতে পারেন।

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

ওয়ার্ডপ্রেস Playground দিয়ে ডেভেলপমেন্ট সম্পর্কে জানতে [development quick start](/developers/build-your-first-app) দেখুন।
