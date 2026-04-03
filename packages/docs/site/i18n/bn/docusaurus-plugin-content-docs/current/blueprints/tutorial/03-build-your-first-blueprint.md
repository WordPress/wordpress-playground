---
title: আপনার প্রথম ব্লুপ্রিন্ট তৈরি করুন
slug: /blueprints/tutorial/build-your-first-blueprint
description: আপনার প্রথম ব্লুপ্রিন্ট তৈরি করার জন্য ধাপে ধাপে টিউটোরিয়াল। থিম, প্লাগইন ইনস্টল এবং সাইট কন্টেন্ট ইম্পোর্ট করতে শিখুন।
---

আসুন একটি প্রাথমিক ব্লুপ্রিন্ট তৈরি করি যা

1. একটি নতুন WordPress সাইট তৈরি করে
2. সাইটের শিরোনাম "My first Blueprint" সেট করে
3. _Adventurer_ থিম ইনস্টল করে
4. WordPress প্লাগইন ডিরেক্টরি থেকে _Hello Dolly_ প্লাগইন ইনস্টল করে
5. একটি কাস্টম প্লাগইন ইনস্টল করে
6. সাইটের কন্টেন্ট পরিবর্তন করে

## 1. একটি নতুন WordPress সাইট তৈরি করুন

আসুন নিম্নলিখিত কন্টেন্ট সহ একটি `blueprint.json` ফাইল তৈরি করে শুরু করি:

```json
{}
```

মনে হতে পারে কিছুই ঘটছে না, কিন্তু এই ব্লুপ্রিন্ট ইতিমধ্যে সর্বশেষ মেজর সংস্করণ সহ একটি WordPress সাইট তৈরি করে।

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#{})

:::tip **অটোকমপ্লিট**

আপনি যদি VS Code বা PHPStorm এর মতো একটি IDE ব্যবহার করেন, তাহলে আপনি অটোকমপ্লিট ব্লুপ্রিন্ট ডেভেলপমেন্ট অভিজ্ঞতার জন্য [Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json) ব্যবহার করতে পারেন। আপনার `blueprint.json` ফাইলের শীর্ষে নিম্নলিখিত লাইন যোগ করুন:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json"
}
```

:::
VS Code-এ এটি দেখতে এরকম:

![Autocompletion visualized](@site/static/img/blueprints/schema-autocompletion.webp)

## 2. সাইটের শিরোনাম "My first Blueprint" সেট করুন

ব্লুপ্রিন্টগুলি একটি সিরিজ [স্টেপ](/blueprints/steps) নিয়ে গঠিত যা একটি WordPress সাইট কীভাবে তৈরি করতে হয় তা সংজ্ঞায়িত করে। প্রথম স্টেপ লেখার আগে, স্টেপগুলির একটি খালি তালিকা ঘোষণা করুন:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": []
}
```

এই ব্লুপ্রিন্টটি খুব উত্তেজনাপূর্ণ নয়—এটি উপরের খালি ব্লুপ্রিন্টের মতো একই ডিফল্ট সাইট তৈরি করে। আসুন এটি সম্পর্কে কিছু করি!

WordPress সাইটের শিরোনাম `blogname` অপশনে সংরক্ষণ করে। আপনার প্রথম স্টেপ যোগ করুন এবং সেই অপশনটি "My first Blueprint" এ সেট করুন:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": [
		{
			"step": "setSiteOptions",
			"options": {
				"blogname": "My first Blueprint"
			}
		}
	]
}
```

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwic3RlcHMiOlt7InN0ZXAiOiJzZXRTaXRlT3B0aW9ucyIsIm9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifX1dfQ==)

[`setSiteOptions` স্টেপ](/blueprints/steps#SetSiteOptionsStep) WordPress ডাটাবেসে সাইট অপশনগুলি নির্দিষ্ট করে। `options` অবজেক্টে সেট করার জন্য কী-ভ্যালু পেয়ার রয়েছে। এই ক্ষেত্রে, আপনি `blogname` কী-এর মান "My first Blueprint" এ পরিবর্তন করেছেন। আপনি [Blueprint Steps API Reference](/blueprints/steps) এ সমস্ত উপলব্ধ স্টেপ সম্পর্কে আরও পড়তে পারেন।

### শর্টহ্যান্ড

আপনি শর্টহ্যান্ড সিনট্যাক্স ব্যবহার করে কিছু স্টেপ নির্দিষ্ট করতে পারেন। উদাহরণস্বরূপ, আপনি `setSiteOptions` স্টেপটি এভাবে লিখতে পারেন:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
}
```

শর্টহ্যান্ড সিনট্যাক্স এবং স্টেপ সিনট্যাক্স একে অপরের সাথে সম্পর্কিত। শর্টহ্যান্ড সিনট্যাক্স দিয়ে নির্দিষ্ট করা প্রতিটি স্টেপ স্বয়ংক্রিয়ভাবে `steps` অ্যারের শুরুতে একটি নির্বিচার ক্রমে যোগ করা হয়। আপনার কোনটি বেছে নেওয়া উচিত? সংক্ষিপ্ততা আপনার প্রধান উদ্বেগ হলে শর্টহ্যান্ড ব্যবহার করুন, এক্সিকিউশনের ক্রমের উপর আরও নিয়ন্ত্রণ প্রয়োজন হলে স্টেপ ব্যবহার করুন।

## 3. _Adventurer_ থিম ইনস্টল করুন

Adventurer হল একটি ওপেন-সোর্স থিম [WordPress থিম ডিরেক্টরিতে উপলব্ধ](https://wordpress.org/themes/adventurer/)। আসুন [`installTheme` স্টেপ](/blueprints/steps#InstallThemeStep) ব্যবহার করে এটি ইনস্টল করি:

```json
{
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwib3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX1dfQ==)

সাইটটি এখন নিচের স্ক্রিনশটের মতো দেখতে হবে:

![Site with the adventurer theme](@site/static/img/blueprints/installed-adventurer-theme.webp)

### রিসোর্স

`themeData` একটি [রিসোর্স](/blueprints/steps/resources) সংজ্ঞায়িত করে এবং স্টেপটি সম্পূর্ণ করার জন্য প্রয়োজনীয় একটি বাহ্যিক ফাইল রেফারেন্স করে। Playground বিভিন্ন ধরনের রিসোর্স সমর্থন করে, যার মধ্যে রয়েছে

-   `url`,
-   `wordpress.org/themes`,
-   `wordpress.org/plugins`,
-   `vfs` (ভার্চুয়াল ফাইল সিস্টেম), অথবা
-   `literal`।

উদাহরণটি `wordpress.org/themes` রিসোর্স ব্যবহার করে, যার জন্য WordPress থিম ডিরেক্টরিতে ব্যবহৃত একটি `slug` প্রয়োজন:

এই ক্ষেত্রে, `https://wordpress.org/themes/<slug>/` হয়ে যায় `https://wordpress.org/themes/adventurer/`।

:::note
সমর্থিত রিসোর্স সম্পর্কে আরও জানুন [Blueprint Resources API Reference](/blueprints/steps/resources/) এ।
:::

## 4. _Hello Dolly_ প্লাগইন ইনস্টল করুন

একটি ক্লাসিক WordPress প্লাগইন যা অ্যাডমিন ড্যাশবোর্ডে "Hello, Dolly!" গানের র্যান্ডম লিরিক্স প্রদর্শন করে। আসুন [`installPlugin` স্টেপ](/blueprints/steps#InstallPluginStep) ব্যবহার করে এটি ইনস্টল করি:

```json
{
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		}
	]
}
```

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#eyJzaXRlT3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX0seyJzdGVwIjoiaW5zdGFsbFBsdWdpbiIsInBsdWdpblppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3BsdWdpbnMiLCJzbHVnIjoiaGVsbG8tZG9sbHkifX1dfQ==)

Hello Dolly প্লাগইনটি এখন ইনস্টল এবং সক্রিয় করা হয়েছে।

`themeData` এর মতো, `pluginData` স্টেপের জন্য প্রয়োজনীয় একটি বাহ্যিক ফাইলের রেফারেন্স সংজ্ঞায়িত করে। উদাহরণটি WordPress প্লাগইন ডিরেক্টরি থেকে মিলে যাওয়া `slug` সহ প্লাগইন ইনস্টল করতে `wordpress.org/plugins` রিসোর্স ব্যবহার করে।

## 5. একটি কাস্টম প্লাগইন ইনস্টল করুন

আসুন একটি কাস্টম WordPress প্লাগইন ইনস্টল করি যা অ্যাডমিন ড্যাশবোর্ডে একটি বার্তা যোগ করে:

```php
<?php
/*
Plugin Name: "Hello" on the Dashboard
Description: A custom plugin to showcase WordPress Blueprints
Version: 1.0
Author: WordPress Contributors
*/

function my_custom_plugin() {
    echo '<h1>Hello from My Custom Plugin!</h1>';
}

add_action('admin_notices', 'my_custom_plugin');
```

আপনি [installPlugin](/blueprints/steps#InstallPluginStep) ব্যবহার করতে পারেন, কিন্তু এর জন্য একটি ZIP ফাইল তৈরি করতে হবে। প্লাগইনটি কাজ করে কিনা তা দেখতে আসুন ভিন্ন কিছু দিয়ে শুরু করি:

1. [`mkdir` স্টেপ](/blueprints/steps#MkdirStep) ব্যবহার করে একটি `wp-content/plugins/hello-from-the-dashboard` ডিরেক্টরি তৈরি করুন।
2. [`writeFile` স্টেপ](/blueprints/steps#WriteFileStep) ব্যবহার করে একটি `plugin.php` ফাইল লিখুন।
3. [`activatePlugin` স্টেপ](/blueprints/steps#ActivatePluginStep) ব্যবহার করে প্লাগইনটি সক্রিয় করুন।

একটি ব্লুপ্রিন্টে এটি দেখতে এরকম:

```json
{
	// ...
	"steps": [
		// ...
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" on the Dashboard\nDescription: A custom plugin to showcase WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Hello from My Custom Plugin!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');"
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php"
		}
	]
}
```

শেষ কাজটি হল ব্যবহারকারীকে অ্যাডমিন হিসাবে লগইন করা। আপনি [`login` স্টেপ](/blueprints/steps#LoginStep) এর একটি শর্টহ্যান্ড দিয়ে এটি করতে পারেন:

```json
{
	"login": true,
	"steps": [
		// ...
	]
}
```

এখানে সম্পূর্ণ ব্লুপ্রিন্ট:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" on the Dashboard\nDescription: A custom plugin to showcase WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Hello from My Custom Plugin!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');"
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php"
		}
	]
}
```

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#eyJsb2dpbiI6dHJ1ZSwic2l0ZU9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifSwic3RlcHMiOlt7InN0ZXAiOiJpbnN0YWxsVGhlbWUiLCJ0aGVtZVppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3RoZW1lcyIsInNsdWciOiJhZHZlbnR1cmVyIn19LHsic3RlcCI6Imluc3RhbGxQbHVnaW4iLCJwbHVnaW5aaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy9wbHVnaW5zIiwic2x1ZyI6ImhlbGxvLWRvbGx5In19LHsic3RlcCI6Im1rZGlyIiwicGF0aCI6Ii93b3JkcHJlc3Mvd3AtY29udGVudC9wbHVnaW5zL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQifSx7InN0ZXAiOiJ3cml0ZUZpbGUiLCJwYXRoIjoiL3dvcmRwcmVzcy93cC1jb250ZW50L3BsdWdpbnMvaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIiwiZGF0YSI6Ijw/cGhwXG4vKlxuUGx1Z2luIE5hbWU6IFwiSGVsbG9cIiBvbiB0aGUgRGFzaGJvYXJkXG5EZXNjcmlwdGlvbjogQSBjdXN0b20gcGx1Z2luIHRvIHNob3djYXNlIFdvcmRQcmVzcyBCbHVlcHJpbnRzXG5WZXJzaW9uOiAxLjBcbkF1dGhvcjogV29yZFByZXNzIENvbnRyaWJ1dG9yc1xuKi9cblxuZnVuY3Rpb24gbXlfY3VzdG9tX3BsdWdpbigpIHtcbiAgICBlY2hvICc8aDE+SGVsbG8gZnJvbSBNeSBDdXN0b20gUGx1Z2luITwvaDE+Jztcbn1cblxuYWRkX2FjdGlvbignYWRtaW5fbm90aWNlcycsICdteV9jdXN0b21fcGx1Z2luJyk7In0seyJzdGVwIjoiYWN0aXZhdGVQbHVnaW4iLCJwbHVnaW5QYXRoIjoiaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIn1dfQ==)

আপনি যখন ড্যাশবোর্ডে নেভিগেট করবেন তখন এটি দেখতে এরকম:

![Site with the custom plugin](@site/static/img/blueprints/installed-custom-plugin.webp)

### একটি প্লাগইন তৈরি করুন এবং এটি জিপ করুন

PHP ফাইলগুলিকে `JSON` হিসাবে এনকোড করা দ্রুত পরীক্ষার জন্য উপযোগী হতে পারে, কিন্তু এটি অসুবিধাজনক এবং পড়তে কঠিন। পরিবর্তে, প্লাগইন কোড সহ একটি ফাইল তৈরি করুন, এটি কম্প্রেস করুন, এবং এটি ইনস্টল করতে [`installPlugin` স্টেপ](/blueprints/steps#InstallPluginStep) এ `resource` হিসাবে `ZIP` ফাইল ব্যবহার করুন (URL-এর পাথটি আপনার GitHub রিপোজিটরিতে থাকা পাথের সাথে মিলতে হবে):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
			}
		}
	]
}
```

আপনি শর্টহ্যান্ড সিনট্যাক্স ব্যবহার করে সেই ব্লুপ্রিন্টটি আরও ছোট করতে পারেন:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fV19)

## 6. সাইটের কন্টেন্ট পরিবর্তন করুন

অবশেষে, আসুন সাইটের ডিফল্ট কন্টেন্ট মুছে ফেলি এবং একটি WordPress এক্সপোর্ট ফাইল (WXR) থেকে নতুন কন্টেন্ট ইম্পোর্ট করি।

### পুরানো কন্টেন্ট মুছে ফেলুন

ডিফল্ট কন্টেন্ট মুছে ফেলার জন্য কোনো ব্লুপ্রিন্ট স্টেপ নেই, কিন্তু আপনি PHP কোডের একটি স্নিপেট দিয়ে এটি করতে পারেন:

```php
<?php
require '/wordpress/wp-load.php';

// Delete all posts and pages
$posts = get_posts(array(
    'numberposts' => -1,
    'post_type' => array('post', 'page'),
    'post_status' => 'any'
));

foreach ($posts as $post) {
    wp_delete_post($post->ID, true);
}
```

সাইট সেটআপের সময় সেই কোডটি চালাতে, [`runPHP` স্টেপ](/blueprints/steps#RunPHPStep) ব্যবহার করুন:

```json
{
	// ...
	"steps": [
		// ...
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		}
	]
}
```

### নতুন কন্টেন্ট ইম্পোর্ট করুন

আসুন একটি WordPress এক্সপোর্ট (`WXR`) ফাইল ইম্পোর্ট করতে [`importWxr` স্টেপ](/blueprints/steps#ImportWXRStep) ব্যবহার করি যা WordPress থিম পরীক্ষা করতে সাহায্য করে। ফাইলটি [WordPress/theme-test-data](https://github.com/WordPress/theme-test-data) রিপোজিটরিতে উপলব্ধ, এবং আপনি এটির `raw.githubusercontent.com` ঠিকানার মাধ্যমে অ্যাক্সেস করতে পারেন: [https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml](https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml)।

এখানে চূড়ান্ত ব্লুপ্রিন্টটি দেখতে এরকম:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml"
			}
		}
	]
}
```

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2Fzc2V0cy9oZWxsby1mcm9tLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fSx7InN0ZXAiOiJydW5QSFAiLCJjb2RlIjoiPD9waHBcbnJlcXVpcmUgJy93b3JkcHJlc3Mvd3AtbG9hZC5waHAnO1xuXG4kcG9zdHMgPSBnZXRfcG9zdHMoYXJyYXkoXG4gICAgJ251bWJlcnBvc3RzJyA9PiAtMSxcbiAgICAncG9zdF90eXBlJyA9PiBhcnJheSgncG9zdCcsICdwYWdlJyksXG4gICAgJ3Bvc3Rfc3RhdHVzJyA9PiAnYW55J1xuKSk7XG5cbmZvcmVhY2ggKCRwb3N0cyBhcyAkcG9zdCkge1xuICAgIHdwX2RlbGV0ZV9wb3N0KCRwb3N0LT5JRCwgdHJ1ZSk7XG59In0seyJzdGVwIjoiaW1wb3J0V3hyIiwiZmlsZSI6eyJyZXNvdXJjZSI6InVybCIsInVybCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9Xb3JkUHJlc3MvdGhlbWUtdGVzdC1kYXRhL21hc3Rlci90aGVtZXVuaXR0ZXN0ZGF0YS53b3JkcHJlc3MueG1sIn19XX0=)

এবং এটাই। আপনার প্রথম ব্লুপ্রিন্ট তৈরি করার জন্য অভিনন্দন! 🥳
