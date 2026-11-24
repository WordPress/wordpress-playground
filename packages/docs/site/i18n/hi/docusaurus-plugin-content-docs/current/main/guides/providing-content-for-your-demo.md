---
title: Playground से अपने डेमो के लिए सामग्री देना
slug: /guides/providing-content-for-your-demo
description: जानें कि थीम और प्लगइन दिखाने के लिए ब्लूप्रिंट, WP-CLI या PHP की मदद से अपने Playground डेमो में सामग्री कैसे भरें।
---

<!--
One of the things you may want to do to provide a good demo with WordPress
Playground is to load default content to better highlight the features of your
plugin or theme. This default content may include images or other assets.
-->

WordPress Playground के साथ अच्छा डेमो देने के लिए आप डिफ़ॉल्ट सामग्री लोड करना चाह सकते हैं, ताकि आपके प्लगइन या थीम के फ़ीचर बेहतर ढंग से दिखें। इस डिफ़ॉल्ट सामग्री में इमेज या दूसरे एसेट भी हो सकते हैं।

<!--
There are several [Blueprint steps](/blueprints/steps) and strategies you can
use to import content (or generate it) in the Playground instance. This guide
walks through the available sources. For a focused comparison of XML, PHP, and
ZIP imports—including pros, cons, and measured performance—see
[Importing content into WordPress with Blueprints](/guides/import-content-with-blueprints).
-->

Playground इंस्टेंस में सामग्री इम्पोर्ट करने (या बनाने) के लिए आप कई [ब्लूप्रिंट स्टेप](/blueprints/steps) और तरीकों का उपयोग कर सकते हैं। यह गाइड उपलब्ध स्रोतों के बारे में बताती है। XML, PHP और ZIP इम्पोर्ट की खास तुलना के लिए, जिसमें उनके फ़ायदे, नुकसान और मापा गया प्रदर्शन शामिल है, [ब्लूप्रिंट से WordPress में सामग्री इम्पोर्ट करना](/guides/import-content-with-blueprints) देखें।

<!-- ## `importWxr` -->

## `importWxr` {#importwxr}

<!--
With the [`importWxr` step](/blueprints/steps#importWxr), you can import content from a
WordPress eXtended RSS (WXR) `.xml` file previously
[exported from an existing WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/).
-->

[`importWxr` स्टेप](/blueprints/steps#importWxr) से आप WordPress eXtended RSS (WXR) की ऐसी `.xml` फ़ाइल से सामग्री इम्पोर्ट कर सकते हैं, जो पहले [किसी मौजूदा WordPress इंस्टॉलेशन से एक्सपोर्ट की गई](https://wordpress.org/documentation/article/tools-export-screen/) हो।

<!--
The step can fetch attachments, rewrite URLs, include or exclude comments, and
control how imported authors map to local users. This example assigns imported
content to the existing `admin` user and leaves attachment downloads disabled:
-->

यह स्टेप अटैचमेंट डाउनलोड कर सकता है, URL बदल सकता है, टिप्पणियाँ शामिल कर सकता है या छोड़ सकता है, और तय कर सकता है कि इम्पोर्ट किए गए लेखक लोकल उपयोगकर्ताओं से कैसे जुड़ें। यह उदाहरण इम्पोर्ट की गई सामग्री को मौजूदा `admin` उपयोगकर्ता को सौंपता है और अटैचमेंट डाउनलोड करना बंद रखता है:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint-content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": true,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)
-->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; <code>blueprint.json</code> देखें &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)

<!--
Set `authorsMode` to `create` to create local users for imported authors, or to
`map` and provide `authorsMap` when the corresponding users already exist. You
can also provide `urlMapping` for explicit old-to-new URL replacements.
-->

इम्पोर्ट किए गए लेखकों के लिए लोकल उपयोगकर्ता बनाने हेतु `authorsMode` को `create` पर सेट करें। अगर वे उपयोगकर्ता पहले से मौजूद हैं, तो इसे `map` पर सेट करें और `authorsMap` दें। पुराने URL को नए URL से साफ़ तौर पर बदलने के लिए आप `urlMapping` भी दे सकते हैं।

<!--
To download the media referenced by the export, set `fetchAttachments` to
`true` and enable Blueprint networking. The original media URLs must still be
available:
-->

एक्सपोर्ट में बताई गई मीडिया फ़ाइलें डाउनलोड करने के लिए `fetchAttachments` को `true` पर सेट करें और ब्लूप्रिंट नेटवर्किंग चालू करें। मूल मीडिया URL अब भी उपलब्ध होने चाहिए:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://example.com/wordpress-export.xml"
			},
			"fetchAttachments": true
		}
	]
}
```

<div class="callout callout-info">

<!--
When the original attachment URLs are unavailable, one approach is to upload
the images to the repository that hosts the Blueprint and replace their paths
in the exported `.xml` file. For a public GitHub repository, use a raw URL such
as `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`.
-->

जब मूल अटैचमेंट URL उपलब्ध न हों, तो एक तरीका यह है कि इमेज को उस रिपॉज़िटरी में अपलोड करें जिसमें ब्लूप्रिंट रखा है, और एक्सपोर्ट की गई `.xml` फ़ाइल में उनके पाथ बदल दें। सार्वजनिक GitHub रिपॉज़िटरी के लिए `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}` जैसा raw URL इस्तेमाल करें।

```html
<!-- wp:image {"lightbox":{"enabled":false},"id":4751,"width":"78px","sizeSlug":"full","linkDestination":"none","align":"center","className":"no-border"} -->
<figure class="wp-block-image aligncenter size-full is-resized no-border">
	<img src="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/images/avatars.png" alt="" class="wp-image-4751" style="width:78px" />
</figure>
<!-- /wp:image -->
```

</div>

<!--
For a self-contained demo, place the exported `.xml` file and its assets next
to `blueprint.json` in a [Blueprint bundle](/blueprints/bundles), and use a
[`bundled` resource](/blueprints/steps/resources) instead of a remote URL.
-->

अपने-आप में पूरे डेमो के लिए, एक्सपोर्ट की गई `.xml` फ़ाइल और उसके एसेट को किसी [ब्लूप्रिंट बंडल](/blueprints/bundles) में `blueprint.json` के बगल में रखें, और रिमोट URL की जगह [`bundled` रिसोर्स](/blueprints/steps/resources) का उपयोग करें।

<!-- ## `importWordPressFiles` -->

## `importWordPressFiles` {#importwordpressfiles}

<!--
With the [`importWordPressFiles` step](/blueprints/steps), you can restore the
top-level WordPress files from a `.zip` file into the instance's root folder.
For example, if an archive contains `wp-content` and `wp-includes`, those
directories replace the corresponding directories in Playground.
-->

[`importWordPressFiles` स्टेप](/blueprints/steps) से आप किसी `.zip` फ़ाइल से WordPress की ऊपरी स्तर की फ़ाइलें इंस्टेंस के रूट फ़ोल्डर में वापस ला सकते हैं। उदाहरण के लिए, अगर किसी आर्काइव में `wp-content` और `wp-includes` हैं, तो ये डायरेक्टरी Playground में उन्हीं नामों वाली डायरेक्टरी की जगह ले लेती हैं।

<!--
The ZIP can be created from a Playground instance with the **Download as zip**
option in the [Playground Options Menu](/web-instance).
Current Playground exports include a manifest that lets the import step update
Playground scope URLs after restoration.
-->

यह ZIP किसी Playground इंस्टेंस से [Playground Options Menu](/web-instance) के **Download as zip** विकल्प से बनाई जा सकती है। Playground के मौजूदा एक्सपोर्ट में एक मैनिफ़ेस्ट होता है, जिसकी मदद से इम्पोर्ट स्टेप साइट वापस लाने के बाद Playground स्कोप URL अपडेट कर पाता है।

<!--
You can prepare a demo for your WordPress theme or plugin—including the
database, images, plugins, themes, and settings—in a Playground instance and
then export a snapshot of that demo. The snapshot can be restored later using
`importWordPressFiles`. This example expects `site.zip` next to `blueprint.json`
in a [Blueprint bundle](/blueprints/bundles):
-->

आप किसी Playground इंस्टेंस में अपनी WordPress थीम या प्लगइन का डेमो तैयार कर सकते हैं, जिसमें डेटाबेस, इमेज, प्लगइन, थीम और सेटिंग्स शामिल हों, और फिर उस डेमो का स्नैपशॉट एक्सपोर्ट कर सकते हैं। इस स्नैपशॉट को बाद में `importWordPressFiles` से वापस लाया जा सकता है। यह उदाहरण मानता है कि किसी [ब्लूप्रिंट बंडल](/blueprints/bundles) में `blueprint.json` के बगल में `site.zip` मौजूद है:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

<!--
The step can detect a complete WordPress directory inside a wrapper folder. If
an archive contains more than one site or needs an explicit starting directory,
set `pathInZip` to the directory that contains the WordPress files. Keep the
source and destination WordPress, PHP, theme, and plugin versions compatible,
and only restore ZIP files from sources you trust because they can contain an
entire database and executable PHP.
-->

यह स्टेप किसी बाहरी फ़ोल्डर के अंदर रखी पूरी WordPress डायरेक्टरी को पहचान सकता है। अगर किसी आर्काइव में एक से ज़्यादा साइट हों, या शुरुआत की डायरेक्टरी साफ़ तौर पर बतानी हो, तो `pathInZip` को उस डायरेक्टरी पर सेट करें जिसमें WordPress की फ़ाइलें हैं। स्रोत और नई साइट के WordPress, PHP, थीम और प्लगइन के संस्करण आपस में संगत रखें, और ZIP फ़ाइलें सिर्फ़ भरोसेमंद स्रोतों से ही वापस लाएँ, क्योंकि उनमें पूरा डेटाबेस और चलने लायक PHP हो सकता है।

<!-- ## `importThemeStarterContent` -->

## `importThemeStarterContent` {#importthemestartercontent}

<!--
[Some themes have starter content](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/)
that can be published to highlight the features of a theme.
-->

[कुछ थीम में स्टार्टर सामग्री होती है](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/), जिसे थीम के फ़ीचर दिखाने के लिए पब्लिश किया जा सकता है।

<!--
With the [`importThemeStarterContent` step](/blueprints/steps), you can publish
the starter content of any installed theme, even if that theme is not activated
in the Playground instance:
-->

[`importThemeStarterContent` स्टेप](/blueprints/steps) से आप किसी भी इंस्टॉल की गई थीम की स्टार्टर सामग्री पब्लिश कर सकते हैं, भले ही वह थीम Playground इंस्टेंस में एक्टिवेट न हो:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
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
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})
-->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})

<!--
You can also publish the starter content of a theme while installing it with the
[`installTheme` step](/blueprints/steps) by setting its `importStarterContent`
option to `true`:
-->

[`installTheme` स्टेप](/blueprints/steps) से थीम इंस्टॉल करते समय भी आप उसका `importStarterContent` विकल्प `true` पर सेट करके उसकी स्टार्टर सामग्री पब्लिश कर सकते हैं:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
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

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})
-->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

<!-- ## `wp-cli` -->

## `wp-cli` {#wp-cli}

<!--
Another way of generating content for your theme or plugin is the
[`wp-cli` step](/blueprints/steps). It runs
[WP-CLI commands](https://developer.wordpress.org/cli/commands/) such as
[`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):
-->

अपनी थीम या प्लगइन के लिए सामग्री बनाने का एक और तरीका [`wp-cli` स्टेप](/blueprints/steps) है। यह [`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/) जैसी [WP-CLI कमांड](https://developer.wordpress.org/cli/commands/) चलाता है:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
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

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20generate%20--count=20%20--post_type=post%20--post_date=1999-01-04%22}]})
-->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20generate%20--count=20%20--post_type=post%20--post_date=1999-01-04%22}]})

<!--
You can also combine the `wp-cli` step with the
[`writeFile` step](/blueprints/steps) to create posts from existing content and
import images into the Playground instance:
-->

मौजूदा सामग्री से पोस्ट बनाने और Playground इंस्टेंस में इमेज इम्पोर्ट करने के लिए आप `wp-cli` स्टेप को [`writeFile` स्टेप](/blueprints/steps) के साथ भी इस्तेमाल कर सकते हैं:

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

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Use%20wp-cli%20to%20add%20a%20post%20with%20image%22,%22description%22:%22Use%20wp-cli%20to%20create%20a%20post%20from%20text%20file%20with%20block%20markup%20and%20a%20featured%20image%22,%22author%22:%22bph%22,%22categories%22:[%22Content%22,%22wpcli%22]},%22landingPage%22:%22/?p=4%22,%22login%22:true,%22steps%22:[{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/postcontent.md%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20create%20--post_title='Welcome%20to%20Playground'%20--post_status='published'%20/wordpress/wp-content/postcontent.md%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/Select-storage-method.png%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20media%20import%20wordpress/wp-content/Select-storage-method.png%20--post_id=4%20--title='Select%20your%20storage%20method'%20--featured_image%22}]})
-->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Use%20wp-cli%20to%20add%20a%20post%20with%20image%22,%22description%22:%22Use%20wp-cli%20to%20create%20a%20post%20from%20text%20file%20with%20block%20markup%20and%20a%20featured%20image%22,%22author%22:%22bph%22,%22categories%22:[%22Content%22,%22wpcli%22]},%22landingPage%22:%22/?p=4%22,%22login%22:true,%22steps%22:[{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/postcontent.md%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20create%20--post_title='Welcome%20to%20Playground'%20--post_status='published'%20/wordpress/wp-content/postcontent.md%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/Select-storage-method.png%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20media%20import%20wordpress/wp-content/Select-storage-method.png%20--post_id=4%20--title='Select%20your%20storage%20method'%20--featured_image%22}]})

<div class="callout callout-tip">

<!--
Check the
[“Use wp-cli to add a post with image”](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image)
example from the
[Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)
to see the full example showing the connection between the content and the
featured image.
-->

सामग्री और फ़ीचर्ड इमेज के बीच का संबंध दिखाने वाला पूरा उदाहरण देखने के लिए [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) का [“Use wp-cli to add a post with image”](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image) उदाहरण देखें।

</div>

<!-- ## `runPHP` -->

## `runPHP` {#runphp}

<!--
With the [`runPHP` step](/blueprints/steps), you can run PHP code to insert or
configure data in your WordPress installation, for example with the
[`wp_insert_post` function](https://developer.wordpress.org/reference/functions/wp_insert_post/).
Load `/wordpress/wp-load.php` before calling WordPress APIs, and handle errors
so a failed setup does not silently produce an incomplete demo:
-->

[`runPHP` स्टेप](/blueprints/steps) से आप अपने WordPress इंस्टॉलेशन में डेटा डालने या कॉन्फ़िगर करने के लिए PHP कोड चला सकते हैं, उदाहरण के लिए [`wp_insert_post` फ़ंक्शन](https://developer.wordpress.org/reference/functions/wp_insert_post/) से। WordPress API कॉल करने से पहले `/wordpress/wp-load.php` लोड करें, और एरर संभालें, ताकि सेटअप विफल होने पर चुपचाप अधूरा डेमो न बन जाए:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\n$post_id = wp_insert_post(\n\tarray(\n\t\t'post_title'   => 'Simple post from PHP',\n\t\t'post_content' => '<!-- wp:paragraph --><p>This is a simple post inserted with wp_insert_post.</p><!-- /wp:paragraph -->',\n\t\t'post_author'  => 1,\n\t\t'post_status'  => 'publish',\n\t),\n\ttrue\n);\n\nif ( is_wp_error( $post_id ) ) {\n\tthrow new RuntimeException( $post_id->get_error_message() );\n}"
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](<https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%5Cnrequire_once%20'/wordpress/wp-load.php'%3B%5Cn%5Cn$post_id%20=%20wp_insert_post(%5Cn%5Ctarray(%5Cn%5Ct%5Ct'post_title'%20%20%20=%3E%20'Simple%20post%20from%20PHP',%5Cn%5Ct%5Ct'post_content'%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post.%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%5Cn%5Ct%5Ct'post_author'%20%20=%3E%201,%5Cn%5Ct%5Ct'post_status'%20%20=%3E%20'publish',%5Cn%5Ct),%5Cn%5Cttrue%5Cn)%3B%5Cn%5Cnif%20(%20is_wp_error(%20$post_id%20)%20)%20{%5Cn%5Ctthrow%20new%20RuntimeException(%20$post_id-%3Eget_error_message()%20)%3B%5Cn}%22}]}>)
-->

[<kbd> &nbsp; ब्लूप्रिंट चलाएँ &nbsp; </kbd>](<https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%5Cnrequire_once%20'/wordpress/wp-load.php'%3B%5Cn%5Cn$post_id%20=%20wp_insert_post(%5Cn%5Ctarray(%5Cn%5Ct%5Ct'post_title'%20%20%20=%3E%20'Simple%20post%20from%20PHP',%5Cn%5Ct%5Ct'post_content'%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post.%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%5Cn%5Ct%5Ct'post_author'%20%20=%3E%201,%5Cn%5Ct%5Ct'post_status'%20%20=%3E%20'publish',%5Cn%5Ct),%5Cn%5Cttrue%5Cn)%3B%5Cn%5Cnif%20(%20is_wp_error(%20$post_id%20)%20)%20{%5Cn%5Ctthrow%20new%20RuntimeException(%20$post_id-%3Eget_error_message()%20)%3B%5Cn}%22}]}>)

<!--
For small, deterministic fixtures, `runPHP` keeps setup logic close to the
Blueprint. For large editorial datasets or a complete prepared site, WXR or a
ZIP snapshot is usually easier to maintain. The
[import comparison guide](/guides/import-content-with-blueprints) explains the
trade-offs in detail.
-->

छोटे और हर बार एक जैसे नतीजे देने वाले फ़िक्स्चर के लिए `runPHP` सेटअप के लॉजिक को ब्लूप्रिंट के पास रखता है। बड़े संपादकीय डेटासेट या पहले से तैयार पूरी साइट के लिए WXR या ZIP स्नैपशॉट को संभालना आमतौर पर आसान होता है। [इम्पोर्ट की तुलना वाली गाइड](/guides/import-content-with-blueprints) इनके फ़ायदे और नुकसान विस्तार से बताती है।
