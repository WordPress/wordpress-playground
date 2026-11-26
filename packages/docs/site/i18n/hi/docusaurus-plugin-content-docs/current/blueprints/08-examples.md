---
sidebar_position: 8
title: उदाहरण
slug: /blueprints/examples
description: अलग अलग कामों के लिए ब्लूप्रिंट के काम के उदाहरणों का संग्रह, जैसे थीम इंस्टॉल करना, PHP चलाना और फ़ीचर चालू करना।
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<!-- # Blueprints Examples -->

# ब्लूप्रिंट के उदाहरण

<div class="callout callout-tip">

<!-- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups. -->

असल दुनिया के कोड उदाहरण देखने के लिए [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) देखें, जिनमें WordPress Playground से अलग अलग सेटअप वाली WordPress साइट शुरू की जाती है।

</div>

<!-- Let's see some cool things you can do with Blueprints. -->

आइए देखें कि ब्लूप्रिंट से आप कौन सी दिलचस्प चीज़ें कर सकते हैं।

<!-- ## Install a Theme and a Plugin -->

## थीम और प्लगइन इंस्टॉल करना {#install-a-theme-and-a-plugin}

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "coblocks"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "pendant"
			}
		}
	]
}} />

<!-- ## The `meta` object -->

## `meta` ऑब्जेक्ट {#the-meta-object}

<!-- The optional `meta` object provides descriptive information about your Blueprint. While it doesn't affect how the Blueprint executes, this information is crucial for display purposes in galleries, Blueprint selectors, and integrated tools like [WordPress Studio](https://developer.wordpress.com/studio/) and [Blueprints Gallery](https://wordpress.github.io/blueprints/). -->

वैकल्पिक `meta` ऑब्जेक्ट आपके ब्लूप्रिंट के बारे में जानकारी देता है। इससे ब्लूप्रिंट के चलने पर कोई असर नहीं पड़ता, लेकिन गैलरी, ब्लूप्रिंट चुनने वाले टूल, और [WordPress Studio](https://developer.wordpress.com/studio/) व [Blueprints Gallery](https://wordpress.github.io/blueprints/) जैसे जुड़े हुए टूल में ब्लूप्रिंट दिखाने के लिए यह जानकारी बहुत ज़रूरी है।

<!-- ### Properties -->

### प्रॉपर्टी {#properties}

<!--
| Field             | Type            | Description                                      |
| :---------------- | :-------------- | :----------------------------------------------- |
| **`title`**       | `string`        | A short, human-readable name for the Blueprint.  |
| **`description`** | `string`        | A brief summary explaining the setup.            |
| **`author`**      | `string`        | The name or handle of the creator.               |
| **`categories`**  | `array<string>` | Tags used for filtering and grouping Blueprints. |
-->

| फ़ील्ड            | टाइप            | विवरण                                            |
| :---------------- | :-------------- | :----------------------------------------------- |
| **`title`**       | `string`        | ब्लूप्रिंट का छोटा नाम, जिसे लोग आसानी से पढ़ सकें। |
| **`description`** | `string`        | सेटअप को समझाने वाला छोटा सारांश।                  |
| **`author`**      | `string`        | बनाने वाले का नाम या हैंडल।                        |
| **`categories`**  | `array<string>` | ब्लूप्रिंट को फ़िल्टर और ग्रुप करने के लिए टैग।        |

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"meta": {
		"title": "Default Playground Setup",
		"description": "A basic setup for a new WordPress site with the latest versions.",
		"author": "Playground Team",
		"categories": ["starter", "default"]
	},
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	}
}
```

<!-- ## Run custom PHP code -->

## कस्टम PHP कोड चलाना {#run-custom-php-code}

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array( 'post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1 )); "
		}
	]
}` }
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": `<?php
require_once '/wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

<!-- ## Run Symfony without WordPress -->

## WordPress के बिना Symfony चलाना {#run-symfony-without-wordpress}

<!--
Blueprints can also skip the WordPress download and boot a standalone PHP app.
This example loads a bundled Symfony app with Composer dependencies already
installed, so it starts without cloning a Git repository or running a Node/Sass
build in the browser.
-->

ब्लूप्रिंट WordPress को डाउनलोड किए बिना एक अलग PHP ऐप भी बूट कर सकते हैं। यह उदाहरण एक बंडल किया गया Symfony ऐप लोड करता है, जिसकी Composer डिपेंडेंसी पहले से इंस्टॉल हैं। इसलिए यह ब्राउज़र में कोई Git रिपॉज़िटरी क्लोन किए या Node/Sass बिल्ड चलाए बिना शुरू हो जाता है।

<!--
The app demonstrates Symfony attribute routes, autowired services, Twig, and
HttpClient. Its landing page also explains where to open the Playground file
browser and Blueprint viewer.
-->

यह ऐप Symfony के attribute रूट, autowired सर्विस, Twig और HttpClient दिखाता है। इसका लैंडिंग पेज यह भी बताता है कि Playground का फ़ाइल ब्राउज़र और ब्लूप्रिंट व्यूअर कहाँ खोलें।

<BlueprintExample
	title="Blueprint URL"
	blueprintUrl="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/symfony-package-radar/blueprint.json"
/>

<!-- ## Enable an option on the Gutenberg Experiments page -->

## Gutenberg Experiments पेज पर कोई विकल्प चालू करना {#enable-an-option-on-the-gutenberg-experiments-page}

<!-- Here: Switch on the "new admin views" feature. -->

यहाँ: "new admin views" फ़ीचर चालू करें।

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
		}
	]
}`}
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
			}
		]
}} />

<!-- ## How to work with WP-CLI from the terminal and Playground -->

## टर्मिनल और Playground से WP-CLI के साथ कैसे काम करें {#how-to-work-with-wp-cli-from-the-terminal-and-playground}

<!-- You can run WP-CLI commands on a Playground instance either from your terminal or directly within a Blueprint. -->

आप Playground इंस्टेंस पर WP-CLI कमांड अपने टर्मिनल से या सीधे ब्लूप्रिंट के अंदर चला सकते हैं।

<!-- To use your terminal, you must first mount the `/wordpress/` directory and ensure the SQLite database integration is configured. This is because Playground's internal database doesn't persist on a mounted site, so you must explicitly install the database plugin via a Blueprint. This allows WP-CLI to recognize the WordPress installation and connect to its database. -->

अपना टर्मिनल इस्तेमाल करने के लिए, पहले आपको `/wordpress/` डायरेक्टरी माउंट करनी होगी और पक्का करना होगा कि SQLite डेटाबेस इंटीग्रेशन कॉन्फ़िगर है। ऐसा इसलिए है क्योंकि माउंट की गई साइट पर Playground का अंदरूनी डेटाबेस बना नहीं रहता, इसलिए आपको ब्लूप्रिंट से डेटाबेस प्लगइन साफ़ तौर पर इंस्टॉल करना होगा। इससे WP-CLI, WordPress इंस्टॉलेशन को पहचान पाता है और उसके डेटाबेस से जुड़ पाता है।

<div class="callout callout-info">

<!-- If you run WP-CLI commands as steps within your Blueprint file, this manual setup is not needed. -->

अगर आप WP-CLI कमांड अपनी ब्लूप्रिंट फ़ाइल के अंदर स्टेप के रूप में चलाते हैं, तो यह मैन्युअल सेटअप ज़रूरी नहीं है।

</div>

<!-- The following Blueprint snippet handles this setup: -->

नीचे दिया गया ब्लूप्रिंट स्निपेट यह सेटअप कर देता है:

<BlueprintExample blueprint={{
    "plugins": [ "sqlite-database-integration" ]
}} />

<!-- For a detailed explanation of why this is needed, refer to the [Troubleshoot and Debug Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites) section. -->

यह क्यों ज़रूरी है, इसकी पूरी जानकारी के लिए [ब्लूप्रिंट की समस्याएँ सुलझाना और डीबग करना](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites) सेक्शन देखें।

<!-- ## Showcase a product demo -->

## प्रोडक्ट डेमो दिखाना {#showcase-a-product-demo}

<BlueprintExample noButton blueprint={{
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
		},
		{
			"step": "setSiteOptions",
			"options": {
				"some_required_option_1": "your_favorite_values",
				"some_required_option_2": "your_favorite_values"
			}
		}
	]
}} />

<!-- ## Enable networking -->

## नेटवर्किंग चालू करना {#enable-networking}

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/plugin-install.php",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		}
	]
}} />

<!-- ## Load PHP code on every request (mu-plugin) -->

## हर रिक्वेस्ट पर PHP कोड लोड करना (mu-plugin) {#load-php-code-on-every-request-mu-plugin}

<!-- Use the `writeFile` step to add code to `mu-plugins`, where it runs on every request. -->

`writeFile` स्टेप से `mu-plugins` में कोड जोड़ें, जहाँ वह हर रिक्वेस्ट पर चलता है।

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/demo-footer.php",
			"data": "<?php add_filter( 'admin_footer_text', function () { return 'Added by mu-plugin code.'; } );"
		}
	]
}} />

<!-- ## Code editor (as a Gutenberg block) -->

## कोड एडिटर (Gutenberg ब्लॉक के रूप में) {#code-editor-as-a-gutenberg-block}

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin/post.php?post=4&action=edit",
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "interactive-code-block"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'WordPress Playground block demo!','post_content' => '<!-- wp:wordpress-playground/playground /-->', 'post_status' => 'publish', 'post_type' => 'post',]);"
    }
  ]
}} />

<!-- You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples). -->

आप अपने ब्लूप्रिंट उदाहरण [इसी काम के लिए बनी विकी](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples) में शेयर कर सकते हैं।

<!-- ## Load an older WordPress version -->

## WordPress का पुराना वर्ज़न लोड करना {#load-an-older-wordpress-version}

<!-- Playground only ships with a few recent WordPress releases. If you need to use an older version, this Blueprint can help you: change the version number in `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` from `6.2.1` to the release you want to load. -->

Playground में WordPress की सिर्फ़ कुछ हाल की रिलीज़ शामिल होती हैं। अगर आपको कोई पुराना वर्ज़न चाहिए, तो यह ब्लूप्रिंट आपकी मदद कर सकता है: `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` में वर्ज़न नंबर `6.2.1` को उस रिलीज़ से बदलें जिसे आप लोड करना चाहते हैं।

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

**ध्यान दें:** SQLite इंटीग्रेशन प्लगइन के हिसाब से, WordPress का सबसे पुराना सपोर्ट किया गया वर्ज़न `6.2.1` है।

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin",
  "preferredVersions": {
    "wp": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip",
    "php": "8.3"
  },
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    }
  ]
}} />

<!-- ## Run WordPress from trunk or a specific commit. -->

## trunk या किसी खास कमिट से WordPress चलाना {#run-wordpress-from-trunk-or-a-specific-commit}

<!-- WordPress Playground can run `trunk` (the latest commit), the HEAD of a specific branch or a specific commit from the [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub repository. -->

WordPress Playground, [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub रिपॉज़िटरी से `trunk` (सबसे नया कमिट), किसी खास ब्रांच का HEAD या कोई खास कमिट चला सकता है।

<!-- You can specify the reference in `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`. -->

आप यह रेफ़रेंस `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"` में बता सकते हैं।

<!-- To specify the latest commit of a particular branch, you can change the reference to the branch version number, eg `6.6`. To run a specific commit, you can use the commit hash from [WordPress/WordPress](https://github.com/WordPress/WordPress), eg `7d7a52367dee9925337e7d901886c2e9b21f70b6`. -->

किसी खास ब्रांच का सबसे नया कमिट चलाने के लिए आप रेफ़रेंस की जगह ब्रांच का वर्ज़न नंबर लिख सकते हैं, जैसे `6.6`। कोई खास कमिट चलाने के लिए आप [WordPress/WordPress](https://github.com/WordPress/WordPress) से उस कमिट का हैश इस्तेमाल कर सकते हैं, जैसे `7d7a52367dee9925337e7d901886c2e9b21f70b6`।

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

**ध्यान दें:** SQLite इंटीग्रेशन प्लगइन के हिसाब से, WordPress का सबसे पुराना सपोर्ट किया गया वर्ज़न `6.2.1` है।

<BlueprintExample blueprint={{
    "landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.3",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

<!-- ## Using Blueprint Bundles -->

## ब्लूप्रिंट बंडल का इस्तेमाल {#using-blueprint-bundles}

<!-- Here's an example of a Blueprint that uses bundled resources from a Blueprint bundle: -->

यहाँ एक ब्लूप्रिंट का उदाहरण है, जो ब्लूप्रिंट बंडल के बंडल किए गए रिसोर्स इस्तेमाल करता है:

```json
{
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/my-theme.zip"
			},
			"activate": true
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/my-plugin.zip"
			},
			"activate": true
		},
		{
			"step": "writeFile",
			"path": "/wordpress/custom-page.html",
			"data": {
				"resource": "bundled",
				"path": "/assets/custom-page.html"
			}
		}
	]
}
```

<!-- This Blueprint bundle would be zip file containing the following files: -->

यह ब्लूप्रिंट बंडल एक ZIP फ़ाइल होगी, जिसमें ये फ़ाइलें होंगी:

<!--
- `/blueprint.json` - The blueprint declaration outlined above
- `/my-theme.zip` - A theme package
- `/my-plugin.zip` - A plugin package
- `/assets/custom-page.html` - A custom HTML file
-->

- `/blueprint.json`: ऊपर बताया गया ब्लूप्रिंट डिक्लेरेशन
- `/my-theme.zip`: एक थीम पैकेज
- `/my-plugin.zip`: एक प्लगइन पैकेज
- `/assets/custom-page.html`: एक कस्टम HTML फ़ाइल

<!-- You can use this Blueprint bundle by: -->

आप इस ब्लूप्रिंट बंडल को ऐसे इस्तेमाल कर सकते हैं:

<!--
1. Creating a ZIP file with these files and the blueprint.json
2. Hosting the ZIP file on a server
3. Loading it with `?blueprint-url=https://example.com/my-blueprint-bundle.zip`
-->

1. इन फ़ाइलों और blueprint.json के साथ एक ZIP फ़ाइल बनाएँ
2. ZIP फ़ाइल को किसी सर्वर पर होस्ट करें
3. उसे `?blueprint-url=https://example.com/my-blueprint-bundle.zip` से लोड करें

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

ब्लूप्रिंट बंडल के बारे में ज़्यादा जानकारी के लिए [ब्लूप्रिंट बंडल](/blueprints/bundles) डॉक्यूमेंटेशन देखें।
