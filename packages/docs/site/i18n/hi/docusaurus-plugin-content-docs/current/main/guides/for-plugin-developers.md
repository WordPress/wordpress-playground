---
title: प्लगइन डेवलपर के लिए WordPress Playground
slug: /guides/for-plugin-developers
description: प्लगइन डेवलपर के लिए गाइड, जिसमें बताया गया है कि Playground से अपने प्लगइन को कैसे बनाएँ, परखें और उनके असरदार लाइव डेमो कैसे बनाएँ।
---

<!-- The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment. -->

WordPress Playground एक नया तरह का टूल है, जिससे प्लगइन डेवलपर अपने प्लगइन को सीधे ब्राउज़र में बना सकते हैं, परख सकते हैं और दिखा सकते हैं।

<!-- This guide will show you how to use WordPress Playground to improve your plugin development workflow, create live demos to showcase your plugin, and simplify your plugin testing and review. -->

यह गाइड आपको दिखाएगी कि WordPress Playground की मदद से अपने प्लगइन डेवलपमेंट के काम करने के तरीके को कैसे बेहतर बनाएँ, अपना प्लगइन दिखाने के लिए लाइव डेमो कैसे बनाएँ, और अपने प्लगइन के परीक्षण और समीक्षा को कैसे आसान बनाएँ।

<div class="callout callout-info">

<!-- Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section. -->

[Playground के बारे में](/about) सेक्शन में जानें कि WordPress Playground से अपने प्रोडक्ट को कैसे [बनाएँ](/about/build), [परखें](/about/test) और [लॉन्च करें](/about/launch)।

</div>

<!-- ## Launching a Playground instance with a plugin -->

## किसी प्लगइन के साथ Playground इंस्टेंस लॉन्च करना {#launching-a-playground-instance-with-a-plugin}

<!-- ### Plugin in the WordPress plugins directory -->

### WordPress प्लगइन डायरेक्टरी में मौजूद प्लगइन {#plugin-in-the-wordpress-plugins-directory}

<!-- With WordPress Playground, you can quickly launch a WordPress installation with almost any plugin available in the [WordPress Plugins Directory](https://wordpress.org/plugins/) installed and activated. All you need to do is to add the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) and use the slug of the plugin from the WordPress directory as a value. For example: https://playground.wordpress.net/?plugin=create-block-theme -->

WordPress Playground से आप तुरंत ऐसा WordPress इंस्टॉलेशन लॉन्च कर सकते हैं जिसमें [WordPress प्लगइन डायरेक्टरी](https://wordpress.org/plugins/) का लगभग कोई भी प्लगइन इंस्टॉल और एक्टिवेट हो। इसके लिए बस [Playground URL](https://playground.wordpress.net) में `plugin` [क्वेरी पैरामीटर](/developers/apis/query-api) जोड़ें, और उसकी वैल्यू के रूप में WordPress डायरेक्टरी में प्लगइन का स्लग लिखें। उदाहरण के लिए: https://playground.wordpress.net/?plugin=create-block-theme

<div class="callout callout-tip">

<!-- You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo. -->

क्वेरी पैरामीटर से आप कई प्लगइन इंस्टॉल और एक्टिवेट कर सकते हैं। Playground इंस्टेंस में जितने भी प्लगइन इंस्टॉल और एक्टिवेट करने हैं, उनमें से हर एक के लिए `plugin` पैरामीटर दोहराएँ। उदाहरण के लिए: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.

</div>

<!-- You can also load any plugin from the WordPress plugins directory by setting the [`installPlugin` step](/blueprints/steps#InstallPluginStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance. -->

Playground इंस्टेंस को दिए गए किसी [ब्लूप्रिंट](/blueprints/getting-started) में [`installPlugin` स्टेप](/blueprints/steps#InstallPluginStep) सेट करके भी आप WordPress प्लगइन डायरेक्टरी से कोई भी प्लगइन लोड कर सकते हैं।

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

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]}) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

<!-- Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints). -->

ब्लूप्रिंट को Playground इंस्टेंस तक [कई तरीकों से](/blueprints/using-blueprints) पहुँचाया जा सकता है।

<!-- ### Plugin in a GitHub repository -->

### GitHub रिपॉज़िटरी में मौजूद प्लगइन {#plugin-in-a-github-repository}

<!-- A plugin stored in a GitHub repository can also be loaded in a Playground instance via Blueprints. -->

GitHub रिपॉज़िटरी में रखा प्लगइन भी ब्लूप्रिंट के ज़रिए Playground इंस्टेंस में लोड किया जा सकता है।

<!-- With the `pluginData` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) that will build a plugin from the files from a repository in the Playground instance. -->

[`installPlugin` ब्लूप्रिंट स्टेप](/blueprints/steps#installPlugin) की `pluginData` प्रॉपर्टी से आप एक [`git:directory` रिसोर्स](/blueprints/steps/resources#gitdirectoryreference) तय कर सकते हैं, जो किसी रिपॉज़िटरी की फ़ाइलों से Playground इंस्टेंस में प्लगइन बना देगा।

<div class="callout callout-info">

<!-- Use the [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) to load plugin source code from a Git repository. It supports branches, tags, commits, and subdirectories without requiring you to create a ZIP archive first. If your plugin needs a Composer, npm, or other build step, publish a built ZIP artifact and install that artifact with a `url` resource instead. -->

किसी Git रिपॉज़िटरी से प्लगइन का सोर्स कोड लोड करने के लिए [`git:directory` रिसोर्स](/blueprints/steps/resources#gitdirectoryreference) का उपयोग करें। यह ब्रांच, टैग, कमिट और सबडायरेक्टरी को सपोर्ट करता है, और इसके लिए आपको पहले ZIP आर्काइव बनाने की ज़रूरत नहीं होती। अगर आपके प्लगइन के लिए Composer, npm या कोई दूसरा बिल्ड स्टेप ज़रूरी है, तो उसकी जगह बिल्ड की हुई ZIP पब्लिश करें और उसे `url` रिसोर्स से इंस्टॉल करें।

</div>

<!-- For example, the following `blueprint.json` installs a plugin from a GitHub repository: -->

उदाहरण के लिए, नीचे दिया गया `blueprint.json` GitHub रिपॉज़िटरी से एक प्लगइन इंस्टॉल करता है:

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

<div class="callout callout-tip">

<!-- If your plugin is hosted on GitHub, you can automatically add preview buttons to your pull requests using the Playground PR Preview GitHub Action. This lets reviewers test your changes instantly without any setup. See [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) for details. -->

अगर आपका प्लगइन GitHub पर होस्ट है, तो Playground PR Preview GitHub Action की मदद से आप अपने पुल रिक्वेस्ट में प्रीव्यू बटन अपने-आप जोड़ सकते हैं। इससे समीक्षक बिना किसी सेटअप के आपके बदलाव तुरंत परख सकते हैं। ज़्यादा जानकारी के लिए [GitHub Actions से PR प्रीव्यू बटन जोड़ना](/guides/github-action-pr-preview) देखें।

</div>

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}}) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})

<!-- ### Plugin from code in a file or gist in GitHub -->

### GitHub की किसी फ़ाइल या gist के कोड से प्लगइन {#plugin-from-code-in-a-file-or-gist-in-github}

<!-- By combining the [`writeFile`](/blueprints/steps#WriteFileStep) and [`activatePlugin`](/blueprints/steps#activatePlugin) steps you can also launch a WP Playground instance with a plugin built on the fly from code stored on a gist or [a file in GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php): -->

[`writeFile`](/blueprints/steps#WriteFileStep) और [`activatePlugin`](/blueprints/steps#activatePlugin) स्टेप को एक साथ इस्तेमाल करके आप ऐसा WP Playground इंस्टेंस भी लॉन्च कर सकते हैं, जिसमें किसी gist या [GitHub की किसी फ़ाइल](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php) में रखे कोड से तुरंत प्लगइन बन जाता है:

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

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]}) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})

<div class="callout callout-info">

<!-- The [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example in the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) shows how to load a plugin from code in a gist -->

[Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) में मौजूद [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) उदाहरण दिखाता है कि किसी gist के कोड से प्लगइन कैसे लोड करें।

</div>

<!-- ## Setting up a demo for your plugin with Blueprints -->

## ब्लूप्रिंट से अपने प्लगइन का डेमो सेट अप करना {#setting-up-a-demo-for-your-plugin-with-blueprints}

<!-- When providing a link to a WordPress Playground instance with some plugins activated, you may also want to customize the initial setup for that Playground instance using those plugins. With Playground's [Blueprints](/blueprints/getting-started) you can load/activate plugins and configure the Playground instance. -->

जब आप किसी ऐसे WordPress Playground इंस्टेंस का लिंक देते हैं जिसमें कुछ प्लगइन एक्टिवेट हों, तो आप उन प्लगइन के साथ उस इंस्टेंस का शुरुआती सेटअप भी अपने हिसाब से बदलना चाह सकते हैं। Playground के [ब्लूप्रिंट](/blueprints/getting-started) से आप प्लगइन लोड और एक्टिवेट कर सकते हैं, और Playground इंस्टेंस को कॉन्फ़िगर कर सकते हैं।

<div class="callout callout-tip">

<!--
Some useful tools and resources provided by the Playground project to work with blueprints are:

- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
- The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
- The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.
-->

ब्लूप्रिंट के साथ काम करने के लिए Playground प्रोजेक्ट के कुछ उपयोगी टूल और संसाधन ये हैं:

- [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) देखें, जहाँ अलग-अलग सेटअप वाली WordPress साइट लॉन्च करने के लिए WordPress Playground के इस्तेमाल के असल कोड उदाहरण हैं।
- [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) टूल एक विज़ुअल इंटरफ़ेस देता है, जिसमें स्टेप को खींचकर या क्लिक करके WordPress Playground के लिए ब्लूप्रिंट बनाया जा सकता है। आप अपने खुद के स्टेप भी बना सकते हैं!
- [Blueprints builder](https://playground.wordpress.net/builder/builder.html) टूल से आप अपना ब्लूप्रिंट ऑनलाइन संपादित कर सकते हैं और उसे सीधे Playground इंस्टेंस में चला सकते हैं।

</div>

<!-- Through properties and [`steps`](/blueprints/steps) in the Blueprint, you can configure the Playground instance's initial setup, providing your plugins with the content and configuration needed for showcasing your plugin's compelling features and functionality. -->

ब्लूप्रिंट की प्रॉपर्टी और [`steps`](/blueprints/steps) के ज़रिए आप Playground इंस्टेंस का शुरुआती सेटअप कॉन्फ़िगर कर सकते हैं, ताकि आपके प्लगइन के खास फ़ीचर और काम दिखाने के लिए ज़रूरी सामग्री और कॉन्फ़िगरेशन पहले से मौजूद हो।

<div class="callout callout-info">

<!-- A great demo with WordPress Playground might require that you load default content for your plugin and theme, including images and other assets. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this. -->

WordPress Playground के साथ एक बढ़िया डेमो के लिए शायद आपको अपने प्लगइन और थीम के लिए डिफ़ॉल्ट सामग्री लोड करनी पड़े, जिसमें इमेज और दूसरे एसेट भी शामिल हों। इसके बारे में और जानने के लिए [अपने डेमो के लिए सामग्री देना](/guides/providing-content-for-your-demo) गाइड देखें।

</div>

<!-- ### `plugins` -->

### `plugins` {#plugins}

<!-- If your plugin has dependencies on other plugins you can use the `plugins` shorthand to install yours along with any other needed plugins. -->

अगर आपका प्लगइन दूसरे प्लगइन पर निर्भर है, तो `plugins` शॉर्टहैंड से आप अपने प्लगइन के साथ बाकी ज़रूरी प्लगइन भी इंस्टॉल कर सकते हैं।

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true}) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

<!-- ### `landingPage` -->

### `landingPage` {#landingpage}

<!-- If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shorthand to automatically redirect to any page in the Playground instance upon loading. -->

अगर आपके प्लगइन में सेटिंग्स का पेज या ऑनबोर्डिंग विज़ार्ड है, तो `landingPage` शॉर्टहैंड से आप Playground इंस्टेंस लोड होते ही उसे किसी भी पेज पर अपने-आप भेज सकते हैं।

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

<!-- [<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]}) -->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

<!-- ### `writeFile` -->

### `writeFile` {#writefile}

<!-- With the [`writeFile` step](/blueprints/steps#writeFile) you can create any plugin file on the fly, referencing code from a \*.php file stored on a GitHub or Gist. -->

[`writeFile` स्टेप](/blueprints/steps#writeFile) से आप GitHub या Gist पर रखी किसी \*.php फ़ाइल के कोड से प्लगइन की कोई भी फ़ाइल तुरंत बना सकते हैं।

<!-- Here’s an example of a **[plugin that generates Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, placed in the `mu-plugins` folder to ensure the code runs automatically on load: -->

यह रहा **[कस्टम पोस्ट टाइप बनाने वाले प्लगइन](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)** का एक उदाहरण, जिसे `mu-plugins` फ़ोल्डर में रखा गया है ताकि लोड होते ही कोड अपने-आप चले:

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

<!-- ## Plugin Development -->

## प्लगइन डेवलपमेंट {#plugin-development}

<!-- ### Local plugin development and testing with Playground -->

### Playground के साथ लोकल प्लगइन डेवलपमेंट और परीक्षण {#local-plugin-development-and-testing-with-playground}

<!-- From a plugins' folder in your local development environment, you can quickly load locally a Playground instance with that plugin loaded and activated. -->

अपने लोकल डेवलपमेंट एनवायरनमेंट में किसी प्लगइन के फ़ोल्डर से आप तुरंत लोकल Playground इंस्टेंस खोल सकते हैं, जिसमें वह प्लगइन लोड और एक्टिवेट हो।

<!-- Use the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your plugin's root directory using your preferred command line program. -->

अपने पसंदीदा कमांड लाइन प्रोग्राम में, अपने प्लगइन की रूट डायरेक्टरी से [`@wp-playground/cli` कमांड](/developers/local-development/wp-playground-cli) चलाएँ।

<!-- With [Visual Studio Code](https://code.visualstudio.com/) IDE, you can also use the [Visual Studio Code extension](/developers/local-development/vscode-extension) while working in the root directory of your plugin. -->

[Visual Studio Code](https://code.visualstudio.com/) IDE में, अपने प्लगइन की रूट डायरेक्टरी में काम करते हुए आप [Visual Studio Code एक्सटेंशन](/developers/local-development/vscode-extension) का भी उपयोग कर सकते हैं।

<!-- For example: -->

उदाहरण के लिए:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```

<!-- ### See your local changes in a Playground instance and directly create PRs in a GitHub repo with your changes -->

### अपने लोकल बदलाव Playground इंस्टेंस में देखें और उनसे सीधे GitHub रिपॉज़िटरी में PR बनाएँ {#see-your-local-changes-in-a-playground-instance-and-directly-create-prs-in-a-github-repo-with-your-changes}

<!-- With Google Chrome you can synchronize a Playground instance with your local plugin's code and your plugin's GitHub repo. With this connection you can: -->

Google Chrome में आप किसी Playground इंस्टेंस को अपने प्लगइन के लोकल कोड और उसकी GitHub रिपॉज़िटरी के साथ सिंक कर सकते हैं। इस कनेक्शन से आप:

<!--
- See live (in the Playground instance) your local changes
- Create PRs in the GitHub repo with your changes
-->

- अपने लोकल बदलाव (Playground इंस्टेंस में) लाइव देख सकते हैं
- अपने बदलावों से GitHub रिपॉज़िटरी में PR बना सकते हैं

<!-- Here's a little demo of this workflow in action: -->

यह रहा इस तरीके का एक छोटा-सा डेमो:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

<div class="callout callout-info">

<!-- Check [About Playground &gt; Build &gt; Synchronize your playground instance with a local folder and create GitHub Pull Requests](/about/build#synchronize-your-playground-with-a-local-folder-and-create-github-pull-requests) for more info. -->

ज़्यादा जानकारी के लिए [Playground के बारे में &gt; बिल्ड &gt; अपने Playground इंस्टेंस को लोकल फ़ोल्डर के साथ सिंक करें और GitHub पुल रिक्वेस्ट बनाएँ](/about/build#synchronize-your-playground-with-a-local-folder-and-create-github-pull-requests) देखें।

</div>
