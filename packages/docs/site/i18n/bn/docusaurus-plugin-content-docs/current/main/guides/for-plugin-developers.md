---
title: প্লাগইন ডেভেলপারদের জন্য ওয়ার্ডপ্রেস প্লেগ্রাউন্ড
slug: /guides/for-plugin-developers
description: প্লাগইন ডেভেলপারদের জন্য একটি গাইড যাতে তারা তাদের প্লাগইনের জন্য প্লেগ্রাউন্ড ব্যবহার করে বিল্ড, টেস্ট এবং দারুণ লাইভ ডেমো তৈরি করতে পারেন।
---

<!--
The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড একটি উদ্ভাবনী টুল যা প্লাগইন ডেভেলপারদের সরাসরি ব্রাউজার এনভায়রনমেন্টে তাদের প্লাগইন বিল্ড, টেস্ট এবং শোকেস করার সুযোগ দেয়।

<!--
This guide will show you how to use WordPress Playground to improve your plugin development workflow, create live demos to showcase your plugin, and simplify your plugin testing and review.
-->

এই গাইডটি আপনাকে দেখাবে কীভাবে আপনার প্লাগইন ডেভেলপমেন্ট ওয়ার্কফ্লো উন্নত করতে, আপনার প্লাগইন কন্টেন্ট শোকেস করার জন্য লাইভ ডেমো তৈরি করতে এবং আপনার প্লাগইন টেস্টিং ও রিভিউ প্রক্রিয়া সহজ করতে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্যবহার করবেন।

<!--
Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section.
-->

:::তথ্য
[প্লেগ্রাউন্ড সম্পর্কে](/about) সেকশনে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্যবহার করে কীভাবে আপনার প্রোডাক্টস [তৈরি](/about/build), [পরীক্ষা](/about/test) এবং [লঞ্চ](/about/launch) করবেন তা আবিষ্কার করুন।
:::

<!--
## Launching a Playground instance with a plugin
-->

## একটি প্লাগইন সহ প্লেগ্রাউন্ড ইনস্ট্যান্স লঞ্চ করা

<!--
### Plugin in the WordPress themes directory
-->

### ওয়ার্ডপ্রেস প্লাগইন ডিরেক্টরিতে প্লাগইন

<!--
With WordPress Playground, you can quickly launch a WordPress installation with almost any plugin available in the [WordPress Plugins Directory](https://wordpress.org/plugins/) installed and activated. All you need to do is to add the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) and use the slug of the plugin from the WordPress directory as a value. For example: https://playground.wordpress.net/?plugin=create-block-theme
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের মাধ্যমে, আপনি [প্লাগইন ডিরেক্টরিতে](https://wordpress.org/plugins/) উপলব্ধ প্লাগইন যেকোনো প্লাগইন ইনস্টল ও অ্যাক্টিভেট করা অবস্থায় একটি ওয়ার্ডপ্রেস ইনস্টলেশন দ্রুত লঞ্চ করতে পারেন। এর জন্য আপনাকে শুধু [প্লেগ্রাউন্ড ইউআরএল](https://playground.wordpress.net)-এ `plugin` [কোয়েরি প্যারামিটার](/developers/apis/query-api) যোগ করতে হবে এবং মান হিসেবে ওয়ার্ডপ্রেস ডিরেক্টরি থেকে প্লাগইনের স্লাগ ব্যবহার করতে হবে। উদাহরণস্বরূপ: https://playground.wordpress.net/?plugin=create-block-theme

:::পরামর্শ

<!--
You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
-->

আপনি প্লেগ্রাউন্ড ইনস্ট্যান্সে প্রতিটি প্লাগইনের জন্য `plugin` প্যারামিটারটি পুনরাবৃত্তি করে কতগুলো প্লাগইন ইনস্টল এবং অ্যাক্টিভেট করতে পারেন। উদাহরণস্বরূপ: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo।
:::

<!--
You can also load any plugin from the WordPress plugins directory by setting the [`installPlugin` step](/blueprints/steps#InstallPluginStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.
-->

আপনি প্লেগ্রাউন্ড ইনস্ট্যান্সে পাঠানো একটি [ব্লুপ্রিন্টের](/blueprints/getting-started) [`installPlugin` ধাপটি](/blueprints/steps#InstallPluginStep) সেট করে ওয়ার্ডপ্রেস প্লাগইন ডিরেক্টরি থেকে যেকোনো প্লাগইন লোড করতে পারেন।

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})
-->

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

<!--
Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

ব্লুপ্রিন্টগুলো [বেশ কয়েকটি উপায়ে](/blueprints/using-blueprints) একটি প্লেগ্রাউন্ড ইনস্ট্যান্সে পাঠানো যেতে পারে।

<!--
### Plugin in a GitHub repository
-->

### একটি গিটহাব রিপোজিটরিতে প্লাগইন

<!--
A plugin stored in a GitHub repository can also be loaded in a Playground instance via Blueprints.
-->

গিটহাব রিপোজিটরিতে সংরক্ষিত একটি প্লাগইনও ব্লুপ্রিন্টের মাধ্যমে একটি প্লেগ্রাউন্ড ইনস্ট্যান্সে লোড করা যেতে পারে।

<!--
With the `pluginData` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) that will build a plugin from the files from a repository in the Playground instance.
-->

[`installPlugin` ব্লুপ্রিন্ট ধাপের](/blueprints/steps#installPlugin) `pluginData` প্রপার্টির সাহায্যে, আপনি একটি [`git:directory` রিসোর্স](/blueprints/steps/resources#gitdirectoryreference) ডিফাইন করতে পারেন যা প্লেগ্রাউন্ড ইনস্ট্যান্সে একটি রিপোজিটরির ফাইলগুলো থেকে একটি প্লাগইন বিল্ড করবে।

:::তথ্য

<!--
For the past few months, the [GitHub proxy](https://playground.wordpress.net/proxy) was an incredibly useful tool to load plugins from GitHub repositories, as it allows you to load a plugin from a specific branch, a specific directory, a specific commit, or a specific PR. But with the recent improvements to Playground, this feature is no longer necessary. The GitHub Proxy will be discontinued soon, please update your blueprints to `git:directory` resource.
-->

গত কয়েক মাস ধরে, গিটহাব রিপোজিটরি থেকে প্লাগইন লোড করার জন্য [গিটহাব প্রক্সি](https://playground.wordpress.net/proxy) একটি অত্যন্ত দরকারী টুল ছিল, কারণ এটি আপনাকে একটি নির্দিষ্ট ব্রাঞ্চ, ডিরেক্টরি, কমিট বা পিআর থেকে প্লাগইন লোড করার সুযোগ দিত। কিন্তু প্লেগ্রাউন্ডের সাম্প্রতিক উন্নতির ফলে, এই ফিচারটির আর প্রয়োজন নেই। গিটহাব প্রক্সি শীঘ্রই বন্ধ হয়ে যাবে, তাই দয়া করে আপনার ব্লুপ্রিন্টগুলোকে `git:directory` রিসোর্সে আপডেট করুন।
:::

<!--
For example, the following `blueprint.json` installs a plugin from a GitHub repository:
-->

উদাহরণস্বরূপ, নিচের `blueprint.json` একটি গিটহাব রিপোজিটরি থেকে একটি প্লাগইন ইনস্টল করে:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/wptrainingteam/devblog-dataviews-plugin",
				"ref": "HEAD",
				"refType": "refname"
			}
		}
	]
}
```

:::পরামর্শ

<!--
If your plugin is hosted on GitHub, you can automatically add preview buttons to your pull requests using the Playground PR Preview GitHub Action. This lets reviewers test your changes instantly without any setup. See [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) for details.
-->

আপনার প্লাগইন যদি গিটহাব-এ হোস্ট করা থাকে, তবে আপনি প্লেগ্রাউন্ড পিআর প্রিভিউ গিটহাব অ্যাকশন ব্যবহার করে আপনার পুল রিকোয়েস্টগুলোতে স্বয়ংক্রিয়ভাবে প্রিভিউ বাটন যোগ করতে পারেন। এটি রিভিউয়ারদের কোনো সেটআপ ছাড়াই আপনার পরিবর্তনগুলো তাৎক্ষণিকভাবে পরীক্ষা করার সুযোগ দেয়। বিস্তারিত জানার জন্য [গিটহাব অ্যাকশন এর মাধ্যমে পিআর প্রিভিউ বাটন যোগ করা](/guides/github-action-pr-preview) দেখুন।
:::

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})
-->

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})

<!--
### Plugin from code in a file or gist in GitHub
-->

### গিটহাব-এর কোনো ফাইল বা Gist-এর কোড থেকে প্লাগইন

<!--
By combining the [`writeFile`](/blueprints/steps#WriteFileStep) and [`activatePlugin`](/blueprints/steps#activatePlugin) steps you can also launch a WP Playground instance with a plugin built on the fly from code stored on a gist or [a file in GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):
-->

[`writeFile`](/blueprints/steps#WriteFileStep) এবং [`activatePlugin`](/blueprints/steps#activatePlugin) ধাপগুলিকে একত্রিত করে আপনি একটি Gist বা [গিটহাব-এ থাকা একটি ফাইলে](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php) সংরক্ষিত কোড থেকে তাৎক্ষণিকভাবে তৈরি করা একটি প্লাগইন সহ WP প্লেগ্রাউন্ড ইনস্ট্যান্স লঞ্চ করতে পারেন:

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})
-->

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})

:::তথ্য

<!--
The [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example in the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) shows how to load a plugin from code in a gist
-->

[ব্লুপ্রিন্ট গ্যালারির](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) উদাহরণটি দেখায় কীভাবে একটি Gist-এর কোড থেকে প্লাগইন লোড করতে হয়।

:::

<!--
## Setting up a demo for your plugin with Blueprints
-->

## ব্লুপ্রিন্ট ব্যবহার করে আপনার প্লাগইনের জন্য একটি ডেমো সেটআপ করা

<!--
When providing a link to a WordPress Playground instance with some plugins activated, you may also want to customize the initial setup for that Playground instance using those plugins. With Playground's [Blueprints](/blueprints/getting-started) you can load/activate plugins and configure the Playground instance.
-->

কিছু প্লাগইন অ্যাক্টিভেট করা অবস্থায় একটি ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ইনস্ট্যান্সের জন্য একটি লিঙ্ক প্রদানের সময়, আপনি ওই প্লাগইনগুলো ব্যবহার করে প্লেগ্রাউন্ড ইনস্ট্যান্সের প্রাথমিক সেটআপটি কাস্টমাইজ করতে চাইতে পারেন। প্লেগ্রাউন্ডের [ব্লুপ্রিন্টের](/blueprints/getting-started) মাধ্যমে আপনি প্লাগইন লোড/অ্যাক্টিভেট করতে পারেন এবং প্লেগ্রাউন্ড ইনস্ট্যান্স কনফিগার করতে পারেন।

<!--
Some useful tools and resources provided by the Playground project to work with blueprints are:

- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
- The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
- The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.
-->

:::পরামর্

ব্লুপ্রিন্ট নিয়ে কাজ করার জন্য প্লেগ্রাউন্ড প্রজেক্ট কর্তৃক প্রদত্ত কিছু দরকারী টুল এবং রিসোর্স হলো:

- বিভিন্ন ধরনের সেটআপ সহ ওয়ার্ডপ্রেস সাইট লঞ্চ করার বাস্তব উদাহরণ দেখতে [ব্লুপ্রিন্ট গ্যালারি](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) দেখুন।
- [ওয়ার্ডপ্রেস প্লেগ্রাউন্ড স্টেপ লাইব্রেরি](https://akirk.github.io/playground-step-library/#) টুলটি ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের জন্য ব্লুপ্রিন্ট তৈরি করতে ড্র্যাগ বা ক্লিকের মাধ্যমে একটি ভিজ্যুয়াল ইন্টারফেস প্রদান করে। আপনি নিজের ধাপও তৈরি করতে পারেন!
- [ব্লুপ্রিন্ট বিল্ডার](https://playground.wordpress.net/builder/builder.html) টুলটি আপনাকে আপনার ব্লুপ্রিন্ট অনলাইনে এডিট করতে এবং সরাসরি একটি প্লেগ্রাউন্ড ইনস্ট্যান্সে চালাতে দেয়।
  :::

<!--
Through properties and [`steps`](/blueprints/steps) in the Blueprint, you can configure the Playground instance's initial setup, providing your plugins with the content and configuration needed for showcasing your plugin's compelling features and functionality.
-->

ব্লুপ্রিন্টের প্রপার্টি এবং [`steps`](/blueprints/steps)-এর মাধ্যমে আপনি প্লেগ্রাউন্ড ইনস্ট্যান্সের প্রাথমিক সেটআপ কনফিগার করতে পারেন, যা আপনার প্লাগইনের চমকপ্রদ ফিচার এবং কার্যকারিতা প্রদর্শনের জন্য প্রয়োজনীয় কন্টেন্ট এবং কনফিগারেশন প্রদান করে।

<!--
A great demo with WordPress Playground might require that you load default content for your plugin and theme, including images and other assets. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.
-->

:::তথ্য
ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের সাথে একটি চমৎকার ডেমোর জন্য আপনার প্লাগইন এবং থিমের ডিফল্ট কন্টেন্ট, যার মধ্যে ইমেজ এবং অন্যান্য অ্যাসেট অন্তর্ভুক্ত, লোড করার প্রয়োজন হতে পারে। এ সম্পর্কে আরও জানতে [আপনার ডেমোর জন্য কন্টেন্ট প্রদান](./providing-content-for-your-demo) গাইডটি দেখুন।
:::

<!--
### `plugins`
-->

### `plugins`

<!--
If your plugin has dependencies on other plugins you can use the `plugins` shorthand to install yours along with any other needed plugins.
-->

আপনার প্লাগইন যদি অন্য প্লাগইনের ওপর নির্ভরশীল হয়, তবে আপনি আপনার প্লাগইনের পাশাপাশি অন্য প্রয়োজনীয় প্লাগইনগুলো ইনস্টল করতে `plugins` শর্টহ্যান্ড ব্যবহার করতে পারেন।

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})
-->

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

<!--
### `landingPage`
-->

### `landingPage`

<!--
If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shorthand to automatically redirect to any page in the Playground instance upon loading.
-->

আপনার প্লাগইনে যদি কোনো সেটিংস ভিউ বা অনবোর্ডিং উইজার্ড থাকে, তবে লোড হওয়ার পরে প্লেগ্রাউন্ড ইনস্ট্যান্সের যেকোনো পেজে স্বয়ংক্রিয়ভাবে রিডাইরেক্ট করতে আপনি `landingPage` শর্টহ্যান্ড ব্যবহার করতে পারেন।

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})
-->

[<kbd> &nbsp; ব্লুপ্রিন্ট চালান &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

<!--
### `writeFile`
-->

### `writeFile`

<!--
With the [`writeFile` step](/blueprints/steps#writeFile) you can create any plugin file on the fly, referencing code from a \*.php file stored on a GitHub or Gist.
-->

[`writeFile` ধাপের](/blueprints/steps#writeFile) মাধ্যমে আপনি গিটহাব বা Gist-এ সংরক্ষিত একটি \*.php ফাইলের কোড রেফারেন্স দিয়ে তাৎক্ষণিকভাবে যেকোনো প্লাগইন ফাইল তৈরি করতে পারেন।

<!--
Here’s an example of a **[plugin that generates Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, placed in the `mu-plugins` folder to ensure the code runs automatically on load:
-->

এখানে একটি **[প্লাগইনের উদাহরণ রয়েছে যা কাস্টম পোস্ট টাইপ তৈরি করে](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**। কোডটি লোড হওয়ার সাথে সাথে স্বয়ংক্রিয়ভাবে চালু হয় তা নিশ্চিত করতে এটি `mu-plugins` ফোল্ডারে রাখা হয়েছে:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```

<!--
## Plugin Development
-->

## প্লাগইন ডেভেলপমেন্ট

<!--
### Local plugin development and testing with Playground
-->

### প্লেগ্রাউন্ডের সাথে লোকাল প্লাগইন ডেভেলপমেন্ট এবং টেস্টিং

<!--
From a plugins' folder in your local development environment, you can quickly load locally a Playground instance with that plugin loaded and activated.
-->

আপনার লোকাল ডেভেলপমেন্ট এনভায়রনমেন্টে প্লাগইনের ফোল্ডার থেকে, আপনি ওই প্লাগইনটি লোড এবং অ্যাক্টিভেট করা অবস্থায় দ্রুত একটি লোকাল প্লেগ্রাউন্ড ইনস্ট্যান্স লোড করতে পারেন।

<!--
Use the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your plugin's root directory using your preferred command line program.
-->

আপনার পছন্দের কমান্ড লাইন প্রোগ্রাম ব্যবহার করে প্লাগইনের রুট ডিরেক্টরি থেকে [`@wp-playground/cli` কমান্ড](/developers/local-development/wp-playground-cli) ব্যবহার করুন।

<!--
With [Visual Studio Code](https://code.visualstudio.com/) IDE, you can also use the [Visual Studio Code extension](/developers/local-development/vscode-extension) while working in the root directory of your plugin.
-->

[Visual Studio Code](https://code.visualstudio.com/) IDE-এর মাধ্যমে কাজ করার সময়, আপনি আপনার প্লাগইনের রুট ডিরেক্টরিতে [Visual Studio Code এক্সটেনশন](/developers/local-development/vscode-extension) ব্যবহার করতে পারেন।

<!--
For example:
-->

উদাহরণস্বরূপ:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```

<!--
### See your local changes in a Playground instance and directly create PRs in a GitHub repo with your changes
-->

### একটি প্লেগ্রাউন্ড ইনস্ট্যান্সে আপনার লোকাল পরিবর্তনগুলো দেখুন এবং আপনার পরিবর্তনের সাথে সরাসরি একটি গিটহাব রিপোজিটরিতে পিআর তৈরি করুন

<!--
With Google Chrome, you can synchronize a Playground instance with your local plugin's code and your plugin's GitHub repo. With this connection, you can:
-->

Google Chrome-এর মাধ্যমে আপনি একটি প্লেগ্রাউন্ড ইনস্ট্যান্সকে আপনার লোকাল প্লাগইনের কোড এবং আপনার প্লাগইনের গিটহাব রিপোজিটরির সাথে সিনক্রোনাইজ করতে পারেন। এই সংযোগের মাধ্যমে আপনি যা করতে পারেন:

<!--
- See live (in the Playground instance) your local changes
- Create PRs in the GitHub repo with your changes
-->

- আপনার লোকাল পরিবর্তনগুলো লাইভ (প্লেগ্রাউন্ড ইনস্ট্যান্সে) দেখুন
- আপনার করা পরিবর্তনের মাধ্যমে গিটহাব রিপোজিটরিতে পিআর তৈরি করুন

<!--
Here's a little demo of this workflow in action:
-->

এখানে এই ওয়ার্কফ্লোর একটি সংক্ষিপ্ত ডেমো দেওয়া হলো:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

<!--
Check [About Playground > Build > Synchronize your playground instance with a local folder and create GitHub Pull Requests](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) for more info.
-->

:::তথ্য
আরও তথ্যের জন্য [প্লেগ্রাউন্ড সম্পর্কে > তৈরি করুন > আপনার লোকাল ফোল্ডারের সাথে প্লেগ্রাউন্ড ইনস্ট্যান্স সিনক্রোনাইজ করুন এবং গিটহাব পুল রিকোয়েস্ট তৈরি করুন](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) দেখুন।
:::
