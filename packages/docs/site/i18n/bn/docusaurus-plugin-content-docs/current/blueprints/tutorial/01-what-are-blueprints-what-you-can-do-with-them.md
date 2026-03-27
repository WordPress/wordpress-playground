---
title: 'ব্লুপ্রিন্ট কী?'
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: 'ব্লুপ্রিন্ট কী এবং কীভাবে তারা ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কনফিগার করে তা শিখুন। তাৎক্ষণিক সাইট সেটআপের জন্য JSON ব্যবহারের সুবিধাগুলি আবিষ্কার করুন।'
---

<!--
# What are Blueprints, and what can you do with them?
-->

# ব্লুপ্রিন্ট কী এবং আপনি সেগুলি দিয়ে কী করতে পারেন?

<!--
With WordPress Playground you can create a whole website, including plugins, themes, content (posts, pages, taxonomy, and comments), settings (site name, users, permalinks, and more), etc. They allow you to generate a WooCommerce store complete with products, a magazine populated with articles, a corporate blog with multiple users, and more.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের সাথে আপনি প্লাগইন, থিম, কন্টেন্ট (পোস্ট, পেজ, ট্যাক্সোনমি এবং কমেন্ট), সেটিংস (সাইট নাম, ইউজার, পার্মালিংক এবং আরও অনেক কিছু) সহ একটি সম্পূর্ণ ওয়েবসাইট তৈরি করতে পারেন। তারা আপনাকে পণ্য সহ একটি সম্পূর্ণ WooCommerce স্টোর, নিবন্ধ দিয়ে পূর্ণ একটি ম্যাগাজিন, একাধিক ইউজার সহ একটি কর্পোরেট ব্লগ এবং আরও অনেক কিছু তৈরি করতে দেয়।

<!--
Blueprints are `JSON` files that you can use to configure Playground instances.
-->

ব্লুপ্রিন্ট হল `JSON` ফাইল যা আপনি প্লেগ্রাউন্ড ইনস্ট্যান্স কনফিগার করতে ব্যবহার করতে পারেন।

<!--
Blueprints support advanced use cases, like file system and database manipulation, and give you fine-grained control over the instance you create. The WordPress Test Team has been using Playground in [the 6.5 beta release cycle](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), creating a Blueprint that loads the latest version, several testing plugins, and dummy data.
-->

ব্লুপ্রিন্ট ফাইল সিস্টেম এবং ডাটাবেস ম্যানিপুলেশনের মতো অ্যাডভান্সড ইউজ কেস সাপোর্ট করে এবং আপনার তৈরি করা ইনস্ট্যান্সের উপর আপনাকে সূক্ষ্ম নিয়ন্ত্রণ দেয়। ওয়ার্ডপ্রেস টেস্ট টিম [৬.৫ বিটা রিলিজ সাইকেলে](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/) প্লেগ্রাউন্ড ব্যবহার করছে, একটি ব্লুপ্রিন্ট তৈরি করছে যা সর্বশেষ সংস্করণ, বেশ কয়েকটি টেস্টিং প্লাগইন এবং ডামি ডেটা লোড করে।

<!--
## A simple example
-->

## একটি সহজ উদাহরণ

<!--
A Blueprint might look something like this:
-->

একটি ব্লুপ্রিন্ট এরকম দেখতে হতে পারে:

```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "My Blog",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

<!--
The Blueprint above installs the _Akismet_ and _Gutenberg_ plugins and the _Twenty Nineteen_ theme, sets the site name and description, and enables the WordPress debugging mode.
-->

উপরের ব্লুপ্রিন্ট _Akismet_ এবং _Gutenberg_ প্লাগইন এবং _Twenty Nineteen_ থিম ইনস্টল করে, সাইটের নাম এবং বিবরণ সেট করে এবং ওয়ার্ডপ্রেস ডিবাগিং মোড চালু করে।

<!--
## The benefits of Blueprints
-->

## ব্লুপ্রিন্টের সুবিধা

<!--
Blueprints are an invaluable tool for building WordPress sites via Playground
-->

প্লেগ্রাউন্ডের মাধ্যমে ওয়ার্ডপ্রেস সাইট তৈরির জন্য ব্লুপ্রিন্ট একটি অমূল্য টুল

<!--
-   **Flexibility**: developers can make granular adjustments to the build process.
-   **Consistency**: ensure that every new site starts with the same configuration.
-   **Lightweight**: small text files that are easy to store and transfer.
-   **Transparency**: A Blueprint includes all the commands needed to build a snapshot of a WordPress site. You can read through it and understand how the site is built.
-   **Productivity**: reduces the time-consuming process of manually setting up a new WordPress site. Instead of installing and configuring themes and plugins for each new project, apply a Blueprint and set everything in one process.
-   **Up-to-date dependencies**: fetch the latest version of WordPress, a particular plugin, or a theme. Your snapshot is always up to date with the latest features and security fixes.
-   **Collaboration**: the `JSON` files are easy to review in tools like GitHub. Share Blueprints with your team or the WordPress community. Allowing others to use your well-configured setup.
-   **Experimentation and Learning**: For those new to WordPress or looking to experiment with different configurations, Blueprints provide a safe and easy way to try new setups without "breaking" a live site.
-   **WordPress.org integration**: offer a [demo of your plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) in the WordPress plugin directory, or a preview in a [Theme Trac ticket](https://meta.trac.wordpress.org/ticket/7382).
-   **Spinning a development environment**: A new developer in the team could download the Blueprint, run a hypothetical `wp up` command, and get a fresh developer environments—loaded with everything they need. The entire CI/CD process can reuse the same Blueprint.
-->

- **নমনীয়তা**: ডেভেলপাররা বিল্ড প্রসেসে সূক্ষ্ম সমন্বয় করতে পারেন।
- **সামঞ্জস্য**: নিশ্চিত করুন যে প্রতিটি নতুন সাইট একই কনফিগারেশন দিয়ে শুরু হয়।
- **লাইটওয়েট**: ছোট টেক্সট ফাইল যা সংরক্ষণ এবং স্থানান্তর করা সহজ।
- **স্বচ্ছতা**: একটি ব্লুপ্রিন্ট একটি ওয়ার্ডপ্রেস সাইটের স্ন্যাপশট তৈরির জন্য প্রয়োজনীয় সমস্ত কমান্ড অন্তর্ভুক্ত করে। আপনি এটি পড়তে এবং বুঝতে পারেন কীভাবে সাইটটি তৈরি করা হয়েছে।
- **উৎপাদনশীলতা**: ম্যানুয়ালি একটি নতুন ওয়ার্ডপ্রেস সাইট সেটআপ করার সময়সাপেক্ষ প্রক্রিয়া হ্রাস করে। প্রতিটি নতুন প্রজেক্টের জন্য থিম এবং প্লাগইন ইনস্টল এবং কনফিগার করার পরিবর্তে, একটি ব্লুপ্রিন্ট প্রয়োগ করুন এবং একটি প্রসেসে সবকিছু সেট করুন।
- **আপ-টু-ডেট ডিপেন্ডেন্সি**: ওয়ার্ডপ্রেসের সর্বশেষ সংস্করণ, একটি নির্দিষ্ট প্লাগইন বা একটি থিম ফেচ করুন। আপনার স্ন্যাপশট সর্বদা সর্বশেষ ফিচার এবং সিকিউরিটি ফিক্স সহ আপ টু ডেট থাকে।
- **সহযোগিতা**: `JSON` ফাইলগুলি GitHub এর মতো টুলে রিভিউ করা সহজ। আপনার টিম বা ওয়ার্ডপ্রেস কমিউনিটির সাথে ব্লুপ্রিন্ট শেয়ার করুন। অন্যদের আপনার ভালভাবে কনফিগার করা সেটআপ ব্যবহার করার অনুমতি দিন।
- **পরীক্ষা এবং শেখা**: যারা ওয়ার্ডপ্রেসে নতুন বা বিভিন্ন কনফিগারেশন নিয়ে পরীক্ষা করতে চান, তাদের জন্য ব্লুপ্রিন্ট একটি লাইভ সাইট "ভাঙা" ছাড়াই নতুন সেটআপ চেষ্টা করার একটি নিরাপদ এবং সহজ উপায় প্রদান করে।
- **WordPress.org ইন্টিগ্রেশন**: ওয়ার্ডপ্রেস প্লাগইন ডিরেক্টরিতে [আপনার প্লাগইনের একটি ডেমো](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) অফার করুন, বা একটি [থিম Trac টিকেটে](https://meta.trac.wordpress.org/ticket/7382) একটি প্রিভিউ।
- **ডেভেলপমেন্ট এনভায়রনমেন্ট স্পিন করা**: টিমের একজন নতুন ডেভেলপার ব্লুপ্রিন্ট ডাউনলোড করতে পারে, একটি হাইপোথেটিক্যাল `wp up` কমান্ড চালাতে পারে এবং একটি নতুন ডেভেলপার এনভায়রনমেন্ট পেতে পারে—তাদের প্রয়োজনীয় সবকিছু লোড করা। সম্পূর্ণ CI/CD প্রসেস একই ব্লুপ্রিন্ট পুনরায় ব্যবহার করতে পারে।

<!--
:::info **More Resources**
Visit these links to learn more about the (endless) possibilities of Blueprints:

-   [Introduction to WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
-   Embed a pre-configured WordPress site in your website using the [WordPress Playground Block](https://wordpress.org/plugins/interactive-code-block/).
-   [Blueprints examples](/blueprints/examples)
-   [Demos and apps built with Blueprints](/resources#apps-built-with-wordpress-playground)

:::
-->

:::তথ্য **আরও রিসোর্স**
ব্লুপ্রিন্টের (অসীম) সম্ভাবনা সম্পর্কে আরও জানতে এই লিংকগুলি ভিজিট করুন:

- [ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের ভূমিকা](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
- [ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্লক](https://wordpress.org/plugins/interactive-code-block/) ব্যবহার করে আপনার ওয়েবসাইটে একটি প্রি-কনফিগার করা ওয়ার্ডপ্রেস সাইট এম্বেড করুন।
- [ব্লুপ্রিন্টের উদাহরণ](/blueprints/examples)
- [ব্লুপ্রিন্ট দিয়ে তৈরি ডেমো এবং অ্যাপ](/resources#apps-built-with-wordpress-playground)

:::
