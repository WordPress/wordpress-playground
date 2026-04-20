---
title: 'প্লেগ্রাউন্ড দিয়ে আপনার ডেমোর জন্য কন্টেন্ট প্রদান'
slug: /guides/providing-content-for-your-demo
description: 'থিম এবং প্লাগইন প্রদর্শনের জন্য ব্লুপ্রিন্ট, WP-CLI বা PHP ব্যবহার করে আপনার প্লেগ্রাউন্ড ডেমোতে কন্টেন্ট কীভাবে পূরণ করবেন তা শিখুন।'
---

<!--
One of the things you may want to do to provide a good demo with WordPress Playground is to load default content to better highlight the features of your plugin or theme. This default content may include images or other assets.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড দিয়ে একটি ভালো ডেমো প্রদান করার জন্য আপনি যা করতে চাইতে পারেন তার মধ্যে একটি হলো আপনার প্লাগইন বা থিমের ফিচারগুলো আরও ভালোভাবে হাইলাইট করতে ডিফল্ট কন্টেন্ট লোড করা। এই ডিফল্ট কন্টেন্টে ইমেজ বা অন্যান্য অ্যাসেট অন্তর্ভুক্ত থাকতে পারে।

<!--
There are several [blueprint steps](/blueprints/steps) and strategies you can use to import content (or generate it) in the Playground instance:
-->

প্লেগ্রাউন্ড ইনস্ট্যান্সে কন্টেন্ট ইমপোর্ট (বা জেনারেট) করার জন্য আপনি ব্যবহার করতে পারেন এমন বেশ কয়েকটি [ব্লুপ্রিন্ট স্টেপ](/blueprints/steps) এবং কৌশল রয়েছে:

<!--
## `importWxr`
-->

## `importWxr`

<!--
With the [`importWxr`](/blueprints/steps#importWxr) step, you can import your own content via a `.xml` file previously [exported from an existing WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/):
-->

[`importWxr`](/blueprints/steps#importWxr) স্টেপ দিয়ে, আপনি একটি `.xml` ফাইলের মাধ্যমে আপনার নিজস্ব কন্টেন্ট ইমপোর্ট করতে পারেন যা আগে [একটি বিদ্যমান ওয়ার্ডপ্রেস ইনস্টলেশন থেকে এক্সপোর্ট করা হয়েছে](https://wordpress.org/documentation/article/tools-export-screen/):

```json
"steps": [
	...,
	{
		"step": "importWxr",
		"file": {
			"resource": "url",
			"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint-content.xml"
		}
	},
	...
]
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)

<!--
:::info
To include images in your imported content, a good approach is to upload the images to your GitHub repo and search/replace the path for them in the exported `.xml` file using the URL format: `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`.
-->

:::info
আপনার ইমপোর্ট করা কন্টেন্টে ইমেজ অন্তর্ভুক্ত করতে, একটি ভালো পদ্ধতি হলো ইমেজগুলো আপনার গিটহাব রিপোতে আপলোড করা এবং এক্সপোর্ট করা `.xml` ফাইলে তাদের জন্য পাথ সার্চ/রিপ্লেস করা এই URL ফরম্যাট ব্যবহার করে: `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`।

```html
<!-- wp:image {"lightbox":{"enabled":false},"id":4751,"width":"78px","sizeSlug":"full","linkDestination":"none","align":"center","className":"no-border"} -->
<figure class="wp-block-image aligncenter size-full is-resized no-border">
	<img src="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/images/avatars.png" alt="" class="wp-image-4751" style="width:78px" />
</figure>
<!-- /wp:image -->
```

:::

<!--
It is recommended to upload your exported `.xml` file and any referenced assets (such as images) to the same directory as your `blueprint.json` in your GitHub repository.
-->

আপনার এক্সপোর্ট করা `.xml` ফাইল এবং যেকোনো রেফারেন্স করা অ্যাসেট (যেমন ইমেজ) আপনার গিটহাব রিপোজিটরিতে আপনার `blueprint.json`-এর একই ডিরেক্টরিতে আপলোড করার সুপারিশ করা হয়।

<!--
## `importWordPressFiles`
-->

## `importWordPressFiles`

<!--
With the [`importWordPressFiles`](/blueprints/steps#importWordPressFiles) step, you can import your own top-level WordPress files from a given `.zip` file into the instance's root folder. For example, if a `.zip` file contains the `wp-content` and `wp-includes` directories, they will replace the corresponding directories in Playground's root folder.
-->

[`importWordPressFiles`](/blueprints/steps#importWordPressFiles) স্টেপ দিয়ে, আপনি একটি প্রদত্ত `.zip` ফাইল থেকে আপনার নিজস্ব টপ-লেভেল ওয়ার্ডপ্রেস ফাইলগুলো ইনস্ট্যান্সের রুট ফোল্ডারে ইমপোর্ট করতে পারেন। উদাহরণস্বরূপ, যদি একটি `.zip` ফাইলে `wp-content` এবং `wp-includes` ডিরেক্টরি থাকে, তবে তারা প্লেগ্রাউন্ডের রুট ফোল্ডারে সংশ্লিষ্ট ডিরেক্টরিগুলো রিপ্লেস করবে।

<!--
This `zip` file can be created from any Playground instance with the "Download as zip" option in the [Playground Options Menu](/web-instance#playground-options-menu).
-->

এই `zip` ফাইলটি [প্লেগ্রাউন্ড অপশন মেনুতে](/web-instance#playground-options-menu) "Download as zip" অপশন দিয়ে যেকোনো প্লেগ্রাউন্ড ইনস্ট্যান্স থেকে তৈরি করা যায়।

<!--
You can prepare a demo for your WordPress theme or plugin (including images and other assets) in a Playground instance and then export a snapshot of that demo into a `.zip` file. This file can be imported later using the `importWordPressFiles` step.
-->

আপনি একটি প্লেগ্রাউন্ড ইনস্ট্যান্সে আপনার ওয়ার্ডপ্রেস থিম বা প্লাগইনের জন্য একটি ডেমো প্রস্তুত করতে পারেন (ইমেজ এবং অন্যান্য অ্যাসেট সহ) এবং তারপর সেই ডেমোর একটি স্ন্যাপশট একটি `.zip` ফাইলে এক্সপোর্ট করতে পারেন। এই ফাইলটি পরে `importWordPressFiles` স্টেপ ব্যবহার করে ইমপোর্ট করা যায়।

```json
{
	"landingPage": "/",
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/adamziel/playground-sites/main/playground-for-site-builders/playground.zip"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/%22,%22login%22:true,%22steps%22:[{%22step%22:%22importWordPressFiles%22,%22wordPressFilesZip%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/adamziel/playground-sites/main/playground-for-site-builders/playground.zip%22}}]})

<!--
## `importThemeStarterContent`
-->

## `importThemeStarterContent`

<!--
[Some themes have starter content](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/) that can be published to highlight the features of a theme.
-->

[কিছু থিমে স্টার্টার কন্টেন্ট আছে](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/) যা একটি থিমের ফিচারগুলো হাইলাইট করতে প্রকাশ করা যায়।

<!--
With the [`importThemeStarterContent` step](/blueprints/steps#importThemeStarterContent) you can publish the starter content of any theme even if that theme is not the one activated in the Playground instance.
-->

[`importThemeStarterContent` স্টেপ](/blueprints/steps#importThemeStarterContent) দিয়ে আপনি যেকোনো থিমের স্টার্টার কন্টেন্ট প্রকাশ করতে পারেন এমনকি যদি সেই থিমটি প্লেগ্রাউন্ড ইনস্ট্যান্সে অ্যাক্টিভেট করা না থাকে।

```json

"steps": [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwenty"
      }
    },
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwentyone"
      },
      "options": {
        "activate": true
      }
    },
    {
      "step": "importThemeStarterContent",
      "themeSlug": "twentytwenty"
    }
  ]

```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})

<!--
You can also publish the starter content of a theme when installing it with the [`installTheme` step](/blueprints/steps#installTheme) by setting to `true` its `importStarterContent` option:
-->

আপনি [`installTheme` স্টেপ](/blueprints/steps#installTheme) দিয়ে একটি থিম ইনস্টল করার সময় এর `importStarterContent` অপশন `true` সেট করে থিমের স্টার্টার কন্টেন্ট প্রকাশ করতে পারেন:

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwenty"
			},
			"options": {
				"activate": true,
				"importStarterContent": true
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

<!--
## `wp-cli`
-->

## `wp-cli`

<!--
Another way of generating content for your theme or plugin is via the `wp-cli` step that allows you to run [WP-CLI commands](https://developer.wordpress.org/cli/commands/) such as [`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):
-->

আপনার থিম বা প্লাগইনের জন্য কন্টেন্ট জেনারেট করার আরেকটি উপায় হলো `wp-cli` স্টেপের মাধ্যমে যা আপনাকে [WP-CLI কমান্ড](https://developer.wordpress.org/cli/commands/) যেমন [`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/) চালাতে দেয়:

```json
{
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "wp-cli",
			"command": "wp post generate --count=20 --post_type=post --post_date=1999-01-04"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20generate%20--count=20%20--post_type=post%20--post_date=1999-01-04%22}]})

<!--
You can also use the [`wp-cli` step](/blueprints/steps#WPCliStep) in combination with the [`writeFile` step](/blueprints/steps#WriteFileStep) to create posts based on existing content and to import images to the Playground instance:
-->

আপনি বিদ্যমান কন্টেন্টের উপর ভিত্তি করে পোস্ট তৈরি করতে এবং প্লেগ্রাউন্ড ইনস্ট্যান্সে ইমেজ ইমপোর্ট করতে [`writeFile` স্টেপের](/blueprints/steps#WriteFileStep) সাথে [`wp-cli` স্টেপ](/blueprints/steps#WPCliStep) ব্যবহার করতে পারেন:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/?p=4",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/postcontent.md",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md"
			}
		},
		{
			"step": "wp-cli",
			"command": "wp post create --post_title='Welcome to Playground' --post_status='published' /wordpress/wp-content/postcontent.md"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/Select-storage-method.png",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png"
			}
		},
		{
			"step": "wp-cli",
			"command": "wp media import wordpress/wp-content/Select-storage-method.png --post_id=4 --title='Select your storage method' --featured_image"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Use%20wp-cli%20to%20add%20a%20post%20with%20image%22,%22description%22:%22Use%20wp-cli%20to%20create%20a%20post%20from%20text%20file%20with%20block%20markup%20and%20a%20featured%20image%22,%22author%22:%22bph%22,%22categories%22:[%22Content%22,%22wpcli%22]},%22landingPage%22:%22/?p=4%22,%22login%22:true,%22steps%22:[{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/postcontent.md%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20create%20--post_title='Welcome%20to%20Playground'%20--post_status='published'%20/wordpress/wp-content/postcontent.md%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/Select-storage-method.png%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20media%20import%20wordpress/wp-content/Select-storage-method.png%20--post_id=4%20--title='Select%20your%20storage%20method'%20--featured_image%22}]})

<!--
:::tip

Check the ["Use wp-cli to add a post with image"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image) example from the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to see the full example showing the connection between the content and the featured image.

:::
-->

:::tip

কন্টেন্ট এবং ফিচার্ড ইমেজের মধ্যে সংযোগ দেখানো সম্পূর্ণ উদাহরণ দেখতে [ব্লুপ্রিন্ট গ্যালারি](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) থেকে ["ইমেজ সহ পোস্ট যোগ করতে wp-cli ব্যবহার করুন"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image) উদাহরণটি দেখুন।

:::

<!--
## `runPHP`
-->

## `runPHP`

<!--
With the [`runPHP` step](/blueprints/steps#runPHP) you can run any PHP code you require to insert info into your WordPress installation, for example by using the [`wp_insert_post` function](https://developer.wordpress.org/reference/functions/wp_insert_post/).
-->

[`runPHP` স্টেপ](/blueprints/steps#runPHP) দিয়ে আপনি আপনার ওয়ার্ডপ্রেস ইনস্টলেশনে তথ্য ইনসার্ট করার জন্য প্রয়োজনীয় যেকোনো PHP কোড চালাতে পারেন, উদাহরণস্বরূপ [`wp_insert_post` ফাংশন](https://developer.wordpress.org/reference/functions/wp_insert_post/) ব্যবহার করে।

```json
{
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'Simple post from PHP', 'post_content'  => '<!-- wp:paragraph --><p>This is a simple post inserted with wp_insert_post</p><!-- /wp:paragraph -->', 'post_author'   => 1, 'post_status' => 'publish')); ?>"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%20require_once%20'/wordpress/wp-load.php';%20wp_insert_post(array('post_title'%20=%3E%20'Simple%20post%20from%20wp_insert_post',%20'post_content'%20%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%20'post_author'%20%20%20=%3E%201,%20'post_status'%20=%3E%20'publish'));%20?%3E%22}]})
