---
title: ডেভেলপারদের জন্য কুইক স্টার্ট গাইড
slug: /developers/build-your-first-app
description: প্লেগ্রাউন্ড API ব্যবহার করে ওয়ার্ডপ্রেস এম্বেড করা, প্লাগইন ইনস্টল করা, PR প্রিভিউ দেখা এবং অ্যাপ তৈরি করার ব্যবহারিক গাইড।
---

<!--
# Quick Start Guide for Developers
-->

# ডেভেলপারদের জন্য কুইক স্টার্ট গাইড

<!--
WordPress Playground was created as a programmable tool. Below you'll find a few examples of what you can do with it. Each discussed API is described in detail in the [APIs section](/developers/apis/):
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড একটি প্রোগ্রামেবল টুল হিসেবে তৈরি করা হয়েছে। এটি দিয়ে আপনি কী কী করতে পারেন তার কিছু উদাহরণ নিচে তুলে ধরা হলো। এখানে আলোচিত প্রতিটি API সম্পর্কে [API সেকশনে](/developers/apis/) বিস্তারিত আলোচনা করা হয়েছে:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
## Embed WordPress on your website
-->

## আপনার ওয়েবসাইটে ওয়ার্ডপ্রেস এম্বেড করা

<!--
Playground can be embedded on your website using the HTML `<iframe>` tag as follows:
-->

এইচটিএমএল (HTML) `<iframe>` ট্যাগ ব্যবহার করে নিচের মতো করে আপনার ওয়েবসাইটে প্লেগ্রাউন্ড এম্বেড করা যেতে পারে:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

<!--
Every visitor will get their own private WordPress instance for free. You can then customize it using one of the [Playground APIs](/developers/apis/).
-->

প্রত্যেক ভিজিটর বিনামূল্যে সম্পূর্ণ নিজস্ব প্রাইভেট ওয়ার্ডপ্রেস ইনস্ট্যান্স পাবেন। এরপর আপনি [প্লেগ্রাউন্ড API](/developers/apis/) ব্যবহার করে এটি কাস্টমাইজ করতে পারেন।

<div class="callout callout-warning">

<!--
**Careful with the demo site**

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

**ডেমো সাইট ব্যবহারে সতর্কতা**

https://playground.wordpress.net সাইটটি মূলত কমিউনিটিকে সহায়তা করার জন্য তৈরি করা হয়েছে, তবে ট্রাফিক উল্লেখযোগ্য হারে বৃদ্ধি পেলে এটি নিরবচ্ছিন্নভাবে কাজ করার কোনো নিশ্চয়তা নেই।

যদি আপনার সার্বক্ষণিক সহজলভ্যতা বা নির্দিষ্ট সক্ষমতার প্রয়োজন হয়, তবে আপনার [নিজস্ব ওয়ার্ডপ্রেস প্লেগ্রাউন্ড হোস্ট করা](/developers/architecture/host-your-own-playground) উচিত।

</div>

<!--
## Control the embedded website
-->

## এম্বেড করা ওয়েবসাইট নিয়ন্ত্রণ করা

<!--
WordPress Playground provides three APIs you can use to control the iframed website. All the examples in this section are built using one of these:

- [Query API](/developers/apis/query-api) enable basic operations using only query parameters
- [Blueprints API](/blueprints) give you a great degree of control with a simple JSON file
- [JavaScript API](/developers/apis/javascript-api) gives you full control via a JavaScript client loaded from `playground.wordpress.net` or installed from npm

Learn more about each of these APIs in the [APIs overview section](/developers/apis/).
-->

আইফ্রেম করা (iframed) ওয়েবসাইট নিয়ন্ত্রণের জন্য ওয়ার্ডপ্রেস প্লেগ্রাউন্ড তিনটি API প্রদান করে। এই বিভাগের সমস্ত উদাহরণ এদের যেকোনো একটি ব্যবহার করে তৈরি:

- [Query API](/developers/apis/query-api) শুধুমাত্র কুয়েরি প্যারামিটার ব্যবহার করে মৌলিক অপারেশন পরিচালনা করতে দেয়
- [Blueprints API](/blueprints) একটি সহজ JSON ফাইলের মাধ্যমে বিস্তৃত নিয়ন্ত্রণ দেয়
- [JavaScript API](/developers/apis/javascript-api) `playground.wordpress.net` থেকে লোড করা বা npm থেকে ইনস্টল করা একটি জাভাস্ক্রিপ্ট ক্লায়েন্টের মাধ্যমে পূর্ণ নিয়ন্ত্রণ দেয়

এই API গুলো সম্পর্কে বিস্তারিত জানুন [API ওভারভিউ সেকশনে](/developers/apis/)।

<!--
## Showcase a plugin or theme from WordPress directory
-->

## ওয়ার্ডপ্রেস ডিরেক্টরি থেকে প্লাগইন বা থিম প্রদর্শন করা

<!--
You can install plugins and themes from the WordPress directory with only URL parameters. This iframe preinstalls the `coblocks` and `friends` plugins and the `pendant` theme.
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

শুধুমাত্র URL প্যারামিটার ব্যবহার করে আপনি ওয়ার্ডপ্রেস ডিরেক্টরি থেকে প্লাগইন এবং থিম ইনস্টল করতে পারেন। এই আইফ্রেমটি আগে থেকেই `coblocks` ও `friends` প্লাগইন এবং `pendant` থিম ইনস্টল করে রাখে।
এটিকে বলা হয় [Query API](/developers/apis/query-api/) এবং এ সম্পর্কে আরও বিস্তারিত জানতে পারবেন [এখানে](/developers/apis/query-api/)।

```html
<iframe src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

<!--
## Showcase any plugin or theme
-->

## যেকোনো প্লাগইন বা থিম প্রদর্শন করা

<!--
What if your plugin is not in the WordPress directory?

You can still showcase it on Playground by using [JSON Blueprints](/blueprints). For example, this Blueprint would download and install a plugin and a theme from your website and also import some starter content:
-->

যদি আপনার প্লাগইনটি ওয়ার্ডপ্রেস ডিরেক্টরিতে না থাকে?

তবুও আপনি [JSON Blueprints](/blueprints) ব্যবহার করে প্লেগ্রাউন্ডে এটি প্রদর্শন করতে পারেন। উদাহরণস্বরূপ, এই ব্লুপ্রিন্টটি আপনার ওয়েবসাইট থেকে একটি প্লাগইন ও থিম ডাউনলোড করে ইনস্টল করবে এবং কিছু প্রাথমিক কনটেন্টও ইমপোর্ট করবে:

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/your-plugin.zip"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://your-site.com/your-theme.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://your-site.com/starter-content.wxr"
			}
		}
	]
}
```

<!--
See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

আরও বিস্তারিত জানতে দেখুন [ব্লুপ্রিন্ট দিয়ে শুরু করা](/blueprints/getting-started)।

<!--
## Preview pull requests from your repository
-->

## আপনার রিপোজিটরি থেকে পুল রিকোয়েস্ট (PR) প্রিভিউ দেখা

<!--
You can preview repository code two ways: directly with `git:directory`, or by pointing to a `.zip` from your CI pipeline. Here's the `git:directory` approach using [Blueprints](/blueprints):
-->

আপনি দুটি উপায়ে রিপোজিটরি কোডের প্রিভিউ দেখতে পারেন: সরাসরি `git:directory` ব্যবহার করে, অথবা আপনার CI পাইপলাইন থেকে একটি `.zip` ফাইলের লিংক দিয়ে। এখানে [Blueprints](/blueprints) ব্যবহার করে `git:directory` পদ্ধতি দেখানো হলো:

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/my-user/my-repo",
				"ref": "refs/pull/1/head",
				"refType": "refname"
			},
			"options": {
				"activate": true
			},
			"progress": {
				"caption": "Installing plugin from my-user/my-repo PR #1"
			}
		}
	]
}
```

<!--
In the code above, it will install a plugin from a repository located at the `url`, and the reference to find the branch is `refType`; in this case, it will use `refname`, but it can also use `branch`, `tag`, and `commit`.
-->

উপরের কোডে, এটি নির্দিষ্ট `url`-এ অবস্থিত রিপোজিটরি থেকে একটি প্লাগইন ইনস্টল করবে এবং ব্রাঞ্চ খোঁজার রেফারেন্স হলো `refType`; এই ক্ষেত্রে এটি `refname` ব্যবহার করবে, তবে এটি `branch`, `tag` এবং `commit`-ও ব্যবহার করতে পারে।

<div class="callout callout-tip">

<!--
You can automate this process using the [GitHub Action to generate preview links](/guides/github-action-pr-preview), which will help streamline the process.
-->

আপনি [প্রিভিউ লিংক তৈরি করার GitHub Action](/guides/github-action-pr-preview) ব্যবহার করে এই প্রক্রিয়াটি স্বয়ংক্রিয় করতে পারেন, যা আপনার কাজের ধারা সহজ করবে।

</div>

<!--
Loading a `.zip` file is another alternative for previewing your project. See the [live example of Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html).

To use Playground as a PR previewer, you need:

- A CI pipeline that bundles your plugin or theme
- Public access to the generated `.zip` file
-->

আপনার প্রজেক্টের প্রিভিউ দেখার জন্য একটি `.zip` ফাইল লোড করা আরেকটি বিকল্প। [গুটেনবার্গ PR প্রিভিউয়ারের লাইভ উদাহরণ](https://playground.wordpress.net/gutenberg.html) দেখুন।

PR প্রিভিউয়ার হিসেবে প্লেগ্রাউন্ড ব্যবহার করতে আপনার প্রয়োজন:

- একটি CI পাইপলাইন যা আপনার প্লাগইন বা থিমকে বান্ডেল তৈরি করে
- তৈরি করা `.zip` ফাইলে পাবলিক অ্যাক্সেস

<!--
Those zip bundles aren't any different from regular WordPress Plugins, which means you can install them in Playground using the [JSON Blueprints](/blueprints) API. Once you expose an endpoint like https://your-site.com/pull-request-1234.zip, the following Blueprint will do the rest:
-->

এই জিপ বান্ডেলগুলো সাধারণ ওয়ার্ডপ্রেস প্লাগইনের চেয়ে আলাদা কিছু নয়, যার মানে আপনি [JSON Blueprints](/blueprints) API ব্যবহার করে এগুলোকে প্লেগ্রাউন্ডে ইনস্টল করতে পারেন। একবার https://your-site.com/pull-request-1234.zip এর মতো একটি এন্ডপয়েন্ট তৈরি করার পর, নিচের ব্লুপ্রিন্টটি বাকি কাজ সম্পন্ন করবে:

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/pull-request-1234.zip"
			}
		}
	]
}
```

<!--
The official Playground demo uses this technique to preview pull requests from the Gutenberg repository:
-->

অফিসিয়াল প্লেগ্রাউন্ড ডেমো গুটেনবার্গ রিপোজিটরি থেকে পুল রিকোয়েস্ট প্রিভিউ করতে এই কৌশলটি ব্যবহার করে:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
blueprint={{
	"landingPage": "/wp-admin/plugins.php?test=42test",
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "writeFile",
			"path": "/tmp/gutenberg.zip",
			"data": {
				"resource": "url",
				"url": "/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg.zip&pr=60819",
				"caption": "Downloading Gutenberg PR 60819"
			},
			"progress": {
				"weight": 2,
				"caption": "Applying Gutenberg PR 60819"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "vfs",
				"path": "/tmp/gutenberg.zip"
			}
		}
	]
	}} />

<!--
### Preview WordPress Core and Gutenberg Branches or PRs
-->

### ওয়ার্ডপ্রেস কোর ও গুটেনবার্গ ব্রাঞ্চ বা PR প্রিভিউ করা

<!--
You can preview specific pull requests from WordPress Core and Gutenberg repositories using Query API parameters. Gutenberg branches also have an alternative to preview them with the parameter `gutenberg-branch`. This is useful for testing the latest trunk changes or specific feature branches without creating a PR.

- Preview a specific WordPress Core PR: `https://playground.wordpress.net/?core-pr=9500`
- Preview a specific Gutenberg PR: `https://playground.wordpress.net/?gutenberg-pr=73010`
- Preview the Gutenberg trunk branch: `https://playground.wordpress.net/?gutenberg-branch=trunk`
-->

আপনি Query API প্যারামিটার ব্যবহার করে ওয়ার্ডপ্রেস কোর এবং গুটেনবার্গ রিপোজিটরি থেকে নির্দিষ্ট পুল রিকোয়েস্ট প্রিভিউ করতে পারেন। এছাড়া `gutenberg-branch` প্যারামিটার ব্যবহার করে গুটেনবার্গ ব্রাঞ্চগুলোর প্রিভিউ দেখার বিকল্পও রয়েছে। পিআর (PR) তৈরি না করেই ট্রাঙ্কের সর্বশেষ পরিবর্তন বা নির্দিষ্ট কোনো ফিচার ব্রাঞ্চ টেস্ট করার জন্য এটি অত্যন্ত কার্যকর।

- নির্দিষ্ট ওয়ার্ডপ্রেস কোর PR প্রিভিউ: `https://playground.wordpress.net/?core-pr=9500`
- নির্দিষ্ট গুটেনবার্গ PR প্রিভিউ: `https://playground.wordpress.net/?gutenberg-pr=73010`
- গুটেনবার্গ ট্রাঙ্ক ব্রাঞ্চ প্রিভিউ: `https://playground.wordpress.net/?gutenberg-branch=trunk`

<!--
## Build a compatibility testing environment
-->

## সামঞ্জস্যতা (Compatibility) পরীক্ষার পরিবেশ তৈরি করা

<!--
Test your plugin across PHP and WordPress versions by configuring them in Playground. This helps you verify compatibility before release.

With the Query API, you'd simply add the `php` and `wp` query parameters to the URL:
-->

প্লেগ্রাউন্ডে কনফিগার করার মাধ্যমে বিভিন্ন পিএইচপি (PHP) ও ওয়ার্ডপ্রেস ভার্সনজুড়ে আপনার প্লাগইন পরীক্ষা করুন। এটি রিলিজ করার আগেই সামঞ্জস্যতা যাচাই করতে সহায়তা করে।

Query API-এর সাহায্যে আপনি কেবল URL-এ `php` এবং `wp` কুয়েরি প্যারামিটার যুক্ত করবেন:

```html
<iframe src="https://playground.wordpress.net/?php=8.3&wp=6.1"></iframe>
```

<!--
With JSON Blueprints, you'd use the `preferredVersions` property:
-->

JSON Blueprints-এর ক্ষেত্রে আপনি `preferredVersions` প্রোপার্টি ব্যবহার করবেন:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.1"
	}
}
```

<!--
## Run PHP code in the browser
-->

## ব্রাউজারে পিএইচপি (PHP) কোড রান করা

<!--
The JavaScript API provides the `run()` method which you can use to run PHP code in the browser. This example loads the client directly from `playground.wordpress.net`, so no npm installation or build step is required. See the [JavaScript API quick start](/developers/apis/javascript-api#quick-start) for setup instructions and the npm alternative.
-->

জাভাস্ক্রিপ্ট API `run()` মেথড প্রদান করে, যা ব্যবহার করে আপনি ব্রাউজারে পিএইচপি কোড চালাতে পারবেন। এই উদাহরণে ক্লায়েন্টটি সরাসরি `playground.wordpress.net` থেকে লোড হয়, তাই কোনো npm ইনস্টলেশন বা বিল্ড স্টেপের প্রয়োজন নেই। সেটআপের নির্দেশাবলী এবং npm বিকল্প দেখতে [জাভাস্ক্রিপ্ট API কুইক স্টার্ট](/developers/apis/javascript-api#quick-start) দেখুন।

```html
<iframe id="wp"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	await client.isReady();
	await client.run({
		code: `<?php
		require("/wordpress/wp-load.php");

		update_option("blogname", "Playground is really cool!");
		echo "Site title updated!";
		`,
	});
	await client.goTo('/');
</script>
```

<!--
Combine that with a code editor like Monaco or CodeMirror, and you'll get live code snippets like in [this article](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)!
-->

মোনাকো (Monaco) বা কোডমিরর (CodeMirror)-এর মতো কোড এডিটরের সাথে এটি যুক্ত করলে আপনি [এই আর্টিকেলের](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/) মতো লাইভ কোড স্নিপেট তৈরি করতে পারবেন!
