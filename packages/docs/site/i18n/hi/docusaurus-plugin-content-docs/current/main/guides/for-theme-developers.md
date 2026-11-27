---
title: थीम डेवलपर के लिए WordPress Playground
slug: /guides/for-theme-developers
description: थीम डेवलपर के लिए गाइड, जिसमें बताया गया है कि ब्लूप्रिंट की मदद से Playground में अपनी थीम कैसे बनाएँ, परखें और उनके लाइव डेमो कैसे बनाएँ।
---

<!-- The WordPress Playground is an innovative tool that allows theme developers to build, test, and showcase their themes directly in a browser environment. -->

WordPress Playground एक नया तरह का टूल है, जिससे थीम डेवलपर अपनी थीम को सीधे ब्राउज़र में बना सकते हैं, परख सकते हैं और दिखा सकते हैं।

<!-- This guide will show you how to use WordPress Playground to improve your theme development workflow, create live demos to showcase your theme, and simplify the theme review process. -->

यह गाइड आपको दिखाएगी कि WordPress Playground की मदद से अपने थीम डेवलपमेंट के काम करने के तरीके को कैसे बेहतर बनाएँ, अपनी थीम दिखाने के लिए लाइव डेमो कैसे बनाएँ, और थीम की समीक्षा की प्रक्रिया को कैसे आसान बनाएँ।

<div class="callout callout-info">

<!-- Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section -->

[Playground के बारे में](/about) सेक्शन में जानें कि WordPress Playground से अपने प्रोडक्ट को कैसे [बनाएँ](/about/build), [परखें](/about/test) और [लॉन्च करें](/about/launch)

</div>

<!-- ## Launching a Playground instance with a theme -->

## किसी थीम के साथ Playground इंस्टेंस लॉन्च करना {#launching-a-playground-instance-with-a-theme}

<!-- ### Themes in the WordPress themes directory -->

### WordPress थीम डायरेक्टरी में मौजूद थीम {#themes-in-the-wordpress-themes-directory}

<!-- With WordPress Playground, you can quickly launch a WordPress installation using any theme available in the [WordPress Themes Directory](https://wordpress.org/themes/). Simply pass the `theme` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) like this: https://playground.wordpress.net/?theme=disco. -->

WordPress Playground से आप [WordPress थीम डायरेक्टरी](https://wordpress.org/themes/) की किसी भी थीम के साथ तुरंत WordPress इंस्टॉलेशन लॉन्च कर सकते हैं। बस [Playground URL](https://playground.wordpress.net) में `theme` [क्वेरी पैरामीटर](/developers/apis/query-api) इस तरह जोड़ें: https://playground.wordpress.net/?theme=disco.

<!-- You can also load any theme from the WordPress themes directory by setting the [`installTheme` step](/blueprints/steps#InstallThemeStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance. -->

Playground इंस्टेंस को दिए गए किसी [ब्लूप्रिंट](/blueprints/getting-started) में [`installTheme` स्टेप](/blueprints/steps#InstallThemeStep) सेट करके भी आप WordPress थीम डायरेक्टरी से कोई भी थीम लोड कर सकते हैं।

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

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]}) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

<!-- ### Themes in a GitHub repository -->

### GitHub रिपॉज़िटरी में मौजूद थीम {#themes-in-a-github-repository}

<!-- A theme stored in a GitHub repository can also be loaded in a Playground instance with Blueprints. -->

GitHub रिपॉज़िटरी में रखी थीम भी ब्लूप्रिंट की मदद से Playground इंस्टेंस में लोड की जा सकती है।

<!-- With the `themeData` property of the [`installTheme` blueprint step](/blueprints/steps#InstallThemeStep), you can define a [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) that will build a theme from the files from a repository in the Playground instance. -->

[`installTheme` ब्लूप्रिंट स्टेप](/blueprints/steps#InstallThemeStep) की `themeData` प्रॉपर्टी से आप एक [`git:directory` रिसोर्स](/blueprints/steps/resources#gitdirectoryreference) तय कर सकते हैं, जो किसी रिपॉज़िटरी की फ़ाइलों से Playground इंस्टेंस में थीम बना देगा।

<div class="callout callout-info">

<!-- Use the [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) to load theme source code from a Git repository. It supports branches, tags, commits, and subdirectories without requiring you to create a ZIP archive first. If your theme needs a build step, publish a built ZIP artifact and install that artifact with a `url` resource instead. -->

किसी Git रिपॉज़िटरी से थीम का सोर्स कोड लोड करने के लिए [`git:directory` रिसोर्स](/blueprints/steps/resources#gitdirectoryreference) का उपयोग करें। यह ब्रांच, टैग, कमिट और सबडायरेक्टरी को सपोर्ट करता है, और इसके लिए आपको पहले ZIP आर्काइव बनाने की ज़रूरत नहीं होती। अगर आपकी थीम के लिए कोई बिल्ड स्टेप ज़रूरी है, तो उसकी जगह बिल्ड की हुई ZIP पब्लिश करें और उसे `url` रिसोर्स से इंस्टॉल करें।

</div>

<!-- For example the following `blueprint.json` installs a theme from a GitHub repository: -->

उदाहरण के लिए, नीचे दिया गया `blueprint.json` GitHub रिपॉज़िटरी से एक थीम इंस्टॉल करता है:

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "git:directory",
				"url": "https://github.com/Automattic/themes",
				"ref": "trunk",
				"path": "assembler"
			},
			"options": {
				"activate": true
			}
		}
	]
}
```

<div class="callout callout-tip">

<!-- If your theme is hosted on GitHub, you can automatically add preview buttons to your pull requests using the Playground PR Preview GitHub Action. This lets reviewers test your changes instantly without any setup. See [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) for details. -->

अगर आपकी थीम GitHub पर होस्ट है, तो Playground PR Preview GitHub Action की मदद से आप अपने पुल रिक्वेस्ट में प्रीव्यू बटन अपने-आप जोड़ सकते हैं। इससे समीक्षक बिना किसी सेटअप के आपके बदलाव तुरंत परख सकते हैं। ज़्यादा जानकारी के लिए [GitHub Actions से PR प्रीव्यू बटन जोड़ना](/guides/github-action-pr-preview) देखें।

</div>

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/Automattic/themes%22,%22ref%22:%22trunk%22,%22path%22:%22assembler%22},%22options%22:{%22activate%22:true}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}}) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/Automattic/themes%22,%22ref%22:%22trunk%22,%22path%22:%22assembler%22},%22options%22:{%22activate%22:true}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})

<!-- A blueprint can be passed to a Playground instance [in several ways](/blueprints/using-blueprints). -->

ब्लूप्रिंट को Playground इंस्टेंस तक [कई तरीकों से](/blueprints/using-blueprints) पहुँचाया जा सकता है।

<!-- ## Setting up a demo theme with Blueprints -->

## ब्लूप्रिंट से डेमो थीम सेट अप करना {#setting-up-a-demo-theme-with-blueprints}

<!-- When providing a link to a WordPress Playground instance with a specific theme activated, you may also want to customize the initial setup for that theme. With Playground's [Blueprints](/blueprints/getting-started) you can load, activate, and configure a theme. -->

जब आप किसी ऐसे WordPress Playground इंस्टेंस का लिंक देते हैं जिसमें कोई खास थीम एक्टिवेट हो, तो आप उस थीम का शुरुआती सेटअप भी अपने हिसाब से बदलना चाह सकते हैं। Playground के [ब्लूप्रिंट](/blueprints/getting-started) से आप थीम लोड, एक्टिवेट और कॉन्फ़िगर कर सकते हैं।

<div class="callout callout-tip">

<!--
Some useful tools and resources provided by the Playground project to work with blueprints are:

- Check the [Blueprints Gallery](https://wordpress.github.io/blueprints/) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
- The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
- The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.
-->

ब्लूप्रिंट के साथ काम करने के लिए Playground प्रोजेक्ट के कुछ उपयोगी टूल और संसाधन ये हैं:

- [Blueprints Gallery](https://wordpress.github.io/blueprints/) देखें, जहाँ अलग-अलग सेटअप वाली WordPress साइट लॉन्च करने के लिए WordPress Playground के इस्तेमाल के असल कोड उदाहरण हैं।
- [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) टूल एक विज़ुअल इंटरफ़ेस देता है, जिसमें स्टेप को खींचकर या क्लिक करके WordPress Playground के लिए ब्लूप्रिंट बनाया जा सकता है। आप अपने खुद के स्टेप भी बना सकते हैं!
- [Blueprints builder](https://playground.wordpress.net/builder/builder.html) टूल से आप अपना ब्लूप्रिंट ऑनलाइन संपादित कर सकते हैं और उसे सीधे Playground इंस्टेंस में चला सकते हैं।

</div>

<!-- Through properties and [`steps`](/blueprints/steps) in the blueprint, you can configure the initial setup of your theme in the Playground instance. -->

ब्लूप्रिंट की प्रॉपर्टी और [`steps`](/blueprints/steps) के ज़रिए आप Playground इंस्टेंस में अपनी थीम का शुरुआती सेटअप कॉन्फ़िगर कर सकते हैं।

<div class="callout callout-info">

<!-- To provide a good demo of your theme via Playground, you may want to load it with default content that highlights the features of your theme. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this. -->

Playground के ज़रिए अपनी थीम का अच्छा डेमो देने के लिए, आप उसमें ऐसी डिफ़ॉल्ट सामग्री लोड करना चाह सकते हैं जो आपकी थीम के फ़ीचर दिखाए। इसके बारे में और जानने के लिए [अपने डेमो के लिए सामग्री देना](/guides/providing-content-for-your-demo) गाइड देखें।

</div>

<!-- ### `resetData` -->

### `resetData` {#resetdata}

<!-- With the [`resetData`](/blueprints/steps#resetData) step, you can remove the default content of a WordPress installation in order to import your own content. -->

[`resetData`](/blueprints/steps#resetData) स्टेप से आप WordPress इंस्टॉलेशन की डिफ़ॉल्ट सामग्री हटा सकते हैं, ताकि अपनी सामग्री इम्पोर्ट कर सकें।

```json
"steps": [
	...,
	{
		"step": "resetData"
	},
	...
]
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L16) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; <code>blueprint.json</code> देखें &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L16)

<!-- ### `writeFile` -->

### `writeFile` {#writefile}

<!--
With the [`writeFile`](/blueprints/steps#WriteFileStep) step, you can write data to a file at a specified path. You may want to use this step to write custom PHP code in a PHP file inside the `mu-plugins` folder of the Playground WordPress instance, so the code is executed automatically when the WordPress instance is loaded.
For example, you can add a demo-specific body class that your theme can use for Playground-only styling:
-->

[`writeFile`](/blueprints/steps#WriteFileStep) स्टेप से आप किसी तय पाथ पर मौजूद फ़ाइल में डेटा लिख सकते हैं। आप इस स्टेप का उपयोग Playground के WordPress इंस्टेंस के `mu-plugins` फ़ोल्डर की किसी PHP फ़ाइल में कस्टम PHP कोड लिखने के लिए कर सकते हैं, ताकि WordPress इंस्टेंस लोड होते ही वह कोड अपने-आप चले। उदाहरण के लिए, आप डेमो के लिए एक खास body क्लास जोड़ सकते हैं, जिसे आपकी थीम सिर्फ़ Playground वाली स्टाइलिंग के लिए इस्तेमाल कर सकती है:

```json
"steps": [
	...,
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/mu-plugins/demo-body-class.php",
		"data": "<?php add_filter( 'body_class', function ( $classes ) { $classes[] = 'playground-demo'; return $classes; } );"
	},
	...
]
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L16) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; <code>blueprint.json</code> देखें &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L16)

<!-- ### `updateUserMeta` -->

### `updateUserMeta` {#updateusermeta}

<!-- With the [`updateUserMeta`](/blueprints/steps#updateUserMeta) step, you can update any user metadata. For example, you could update the metadata of the default `admin` user of any WordPress installation: -->

[`updateUserMeta`](/blueprints/steps#updateUserMeta) स्टेप से आप किसी भी उपयोगकर्ता का मेटाडेटा अपडेट कर सकते हैं। उदाहरण के लिए, आप किसी भी WordPress इंस्टॉलेशन के डिफ़ॉल्ट `admin` उपयोगकर्ता का मेटाडेटा अपडेट कर सकते हैं:

```json
"steps": [
	...,
	{
		"step": "updateUserMeta",
		"meta": {
			"first_name": "John",
			"last_name": "Doe",
			"admin_color": "modern"
		},
		"userId": 1
	},
	...
]
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L24) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; <code>blueprint.json</code> देखें &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L24)

<!-- ### `setSiteOptions` -->

### `setSiteOptions` {#setsiteoptions}

<!-- With the [`setSiteOptions`](/blueprints/steps#setSiteOptions) step, you can set [site options](https://developer.wordpress.org/apis/options/#available-options-by-category) such as the site name, description, or page to use for posts. -->

[`setSiteOptions`](/blueprints/steps#setSiteOptions) स्टेप से आप [साइट के विकल्प](https://developer.wordpress.org/apis/options/#available-options-by-category) सेट कर सकते हैं, जैसे साइट का नाम, विवरण, या पोस्ट के लिए इस्तेमाल होने वाला पेज।

```json
"steps": [
	...,
	{
		"step": "setSiteOptions",
		"options": {
			"blogname": "Rich Tabor",
			"blogdescription": "Multidisciplinary maker specializing in the intersection of product, design and engineering. Making WordPress.",
			"show_on_front": "page",
			"page_on_front": 6,
			"page_for_posts": 2
		}
	},
	...
]
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L50) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; <code>blueprint.json</code> देखें &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L50)

<!-- There's also a [`siteOptions`](/blueprints/steps/shorthands#siteoptions) shorthand that can be used instead of the `setSiteOptions` step. -->

`setSiteOptions` स्टेप की जगह [`siteOptions`](/blueprints/steps/shorthands#siteoptions) शॉर्टहैंड का भी उपयोग किया जा सकता है।

<!-- ### `plugins` -->

### `plugins` {#plugins}

<!-- With the [`plugins`](/blueprints/steps/shorthands#plugins) shorthand you can set a list of plugins you want to be installed and activated with your theme in the Playground instance. -->

[`plugins`](/blueprints/steps/shorthands#plugins) शॉर्टहैंड से आप उन प्लगइन की सूची तय कर सकते हैं जिन्हें आप Playground इंस्टेंस में अपनी थीम के साथ इंस्टॉल और एक्टिवेट करना चाहते हैं।

```json
"plugins": ["todo-list-block", "markdown-comment-block"]
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L60) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; <code>blueprint.json</code> देखें &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L60)

<!-- You can also use the [`installPlugin`](/blueprints/steps#installPlugin) step to install and activate plugins for your Playground instance but the shorthand way is recommended. -->

अपने Playground इंस्टेंस के लिए प्लगइन इंस्टॉल और एक्टिवेट करने के लिए आप [`installPlugin`](/blueprints/steps#installPlugin) स्टेप का भी उपयोग कर सकते हैं, लेकिन शॉर्टहैंड वाला तरीका बेहतर माना जाता है।

<!-- ### `login` -->

### `login` {#login}

<!-- With the [`login`](/blueprints/steps/shorthands#login) shorthand you can launch your Playground instance with the admin user logged in. -->

[`login`](/blueprints/steps/shorthands#login) शॉर्टहैंड से आप अपना Playground इंस्टेंस admin उपयोगकर्ता के लॉग इन होने के साथ लॉन्च कर सकते हैं।

```json
 "login": true,
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L10) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; <code>blueprint.json</code> देखें &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L10)

<!-- You can also use the [`login`](/blueprints/steps#login) step to launch your Playground instance logged in with any specific user. -->

किसी खास उपयोगकर्ता के लॉग इन होने के साथ Playground इंस्टेंस लॉन्च करने के लिए आप [`login`](/blueprints/steps#login) स्टेप का भी उपयोग कर सकते हैं।

<div class="callout callout-tip">

<!-- The ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) and ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) examples from the [Blueprints Gallery](https://wordpress.github.io/blueprints/) are great references for loading, activating, importing content, and configuring a block theme on a Playground instance. -->

[Blueprints Gallery](https://wordpress.github.io/blueprints/) के ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) और ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) उदाहरण, Playground इंस्टेंस पर किसी ब्लॉक थीम को लोड करने, एक्टिवेट करने, उसमें सामग्री इम्पोर्ट करने और उसे कॉन्फ़िगर करने के लिए बढ़िया संदर्भ हैं।

</div>

<!-- ## Theme development -->

## थीम डेवलपमेंट {#theme-development}

<!-- ### Local theme development and testing with Playground -->

### Playground के साथ लोकल थीम डेवलपमेंट और परीक्षण {#local-theme-development-and-testing-with-playground}

<!-- From the root folder of a block theme's code, you can quickly load locally a Playground instance with that theme loaded and activated. You can do that by launching, in a theme directory, the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your preferred command line program or the [Visual Code Studio extension](/developers/local-development/vscode-extension) from the [Visual Studio Code](https://code.visualstudio.com/) IDE. -->

किसी ब्लॉक थीम के कोड के रूट फ़ोल्डर से आप तुरंत लोकल Playground इंस्टेंस खोल सकते हैं, जिसमें वह थीम लोड और एक्टिवेट हो। इसके लिए थीम की डायरेक्टरी में अपने पसंदीदा कमांड लाइन प्रोग्राम से [`@wp-playground/cli` कमांड](/developers/local-development/wp-playground-cli) चलाएँ, या [Visual Studio Code](https://code.visualstudio.com/) IDE में [Visual Studio Code एक्सटेंशन](/developers/local-development/vscode-extension) का उपयोग करें।

<!-- For example: -->

उदाहरण के लिए:

```
git clone git@github.com:WordPress/community-themes.git
cd community-themes/blue-note
npx @wp-playground/cli server --auto-mount
```

<!-- ### Design your theme using the WordPress UI and save your changes as Pull Requests -->

### WordPress UI से अपनी थीम डिज़ाइन करें और बदलावों को पुल रिक्वेस्ट के रूप में सहेजें {#design-your-theme-using-the-wordpress-ui-and-save-your-changes-as-pull-requests}

<!-- You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you’ve done through the WordPress UI in the Playground instance, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin. You can also make changes to that theme and export a zip. -->

[Create Block Theme](https://wordpress.org/plugins/create-block-theme/) प्लगइन की मदद से आप अपने Playground इंस्टेंस को किसी GitHub रिपॉज़िटरी से जोड़ सकते हैं, और Playground इंस्टेंस में WordPress UI से किए गए बदलावों के साथ एक पुल रिक्वेस्ट बना सकते हैं। आप उस थीम में बदलाव करके उसकी zip भी एक्सपोर्ट कर सकते हैं।

<!-- Note that you'll need the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin installed and activated in the Playground instance in order to use this workflow. -->

ध्यान दें कि इस तरीके का उपयोग करने के लिए Playground इंस्टेंस में [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) प्लगइन इंस्टॉल और एक्टिवेट होना चाहिए।

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<div class="callout callout-tip">

<!-- Check [About Playground &gt; Build &gt; Save changes done on a Block Theme and create GitHub Pull Requests](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) for more info. -->

ज़्यादा जानकारी के लिए [Playground के बारे में &gt; बिल्ड &gt; ब्लॉक थीम में किए गए बदलाव सहेजें और GitHub पुल रिक्वेस्ट बनाएँ](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) देखें।

</div>
