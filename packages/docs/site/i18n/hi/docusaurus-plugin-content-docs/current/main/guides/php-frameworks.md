---
title: Playground में PHP फ़्रेमवर्क चलाएँ
slug: /guides/php-frameworks
description: WordPress Playground को उन फ़्रेमवर्क और ऐप के लिए ब्राउज़र में चलने वाले PHP रनटाइम की तरह उपयोग करें, जो WordPress नहीं हैं।
sidebar_class_name: navbar-build-item
---

import { PhpCodeSnippetExample } from '@site/src/components/PhpCodeSnippetLiveExample';

<!-- # Run PHP frameworks in Playground -->

# Playground में PHP फ़्रेमवर्क चलाएँ

<!-- WordPress Playground is also a browser-based PHP runtime. WordPress is the
most common app it boots, but a Blueprint can skip the WordPress download,
write any PHP files into the virtual filesystem, and run a framework such as
Symfony. -->

WordPress Playground ब्राउज़र में चलने वाला एक PHP रनटाइम भी है। यह सबसे ज़्यादा WordPress को ही बूट करता है, लेकिन एक ब्लूप्रिंट WordPress डाउनलोड को छोड़ सकता है, वर्चुअल फ़ाइल सिस्टम में कोई भी PHP फ़ाइल लिख सकता है और Symfony जैसा कोई फ़्रेमवर्क चला सकता है।

<!-- This guide shows the shape of that setup. Use it when you want a shareable demo,
a docs example, or a quick compatibility check for a PHP app that does not need
a server, database, Node.js, Sass, or a local Composer install. -->

यह गाइड इस सेटअप का ढाँचा दिखाती है। जब आपको किसी ऐसे PHP ऐप के लिए शेयर करने लायक डेमो, दस्तावेज़ का उदाहरण या संगतता की एक जल्दी जाँच चाहिए, जिसे सर्वर, डेटाबेस, Node.js, Sass या लोकल Composer इंस्टॉल की ज़रूरत नहीं है, तब इसका उपयोग करें।

<!-- ## What changes when you skip WordPress -->

## WordPress छोड़ने पर क्या बदलता है {#what-changes-when-you-skip-wordpress}

<!-- Set `preferredVersions.wp` to `false` in a Blueprint, or `wp="none"` on a
`<php-snippet>`. Playground still downloads PHP, mounts a writable filesystem,
runs Blueprint steps, and supports networking when `features.networking` is
`true`. It just does not download or boot WordPress. -->

ब्लूप्रिंट में `preferredVersions.wp` को `false` पर सेट करें, या `<php-snippet>` पर `wp="none"` रखें। Playground फिर भी PHP डाउनलोड करता है, लिखने योग्य फ़ाइल सिस्टम माउंट करता है, ब्लूप्रिंट के चरण चलाता है, और `features.networking` के `true` होने पर नेटवर्किंग सपोर्ट करता है। बस वह WordPress को डाउनलोड या बूट नहीं करता।

<!-- That makes Playground useful for generic PHP examples: -->

इससे Playground सामान्य PHP उदाहरणों के लिए उपयोगी बन जाता है:

<!--
- PHP libraries that need a real filesystem.
- Framework demos that can run behind `public/index.php`.
- Documentation snippets that should execute in the browser.
- Reproducible bug reports for PHP code that is not WordPress-specific.
-->

- ऐसी PHP लाइब्रेरी, जिन्हें असली फ़ाइल सिस्टम चाहिए।
- फ़्रेमवर्क डेमो, जो `public/index.php` के पीछे चल सकते हैं।
- दस्तावेज़ के ऐसे स्निपेट, जिन्हें ब्राउज़र में चलना चाहिए।
- ऐसे PHP कोड की दोहराई जा सकने वाली बग रिपोर्ट, जो सिर्फ़ WordPress से जुड़ा नहीं है।

<!-- ## Try a Symfony app -->

## Symfony ऐप आज़माएँ {#try-a-symfony-app}

<!-- The example below uses a Blueprint to download and unzip a bundled Symfony app
into `/app`. Then a `<php-snippet>` boots the Symfony kernel and renders the
dashboard route. The app's Composer dependencies include the WordPress HTML API,
so the snippet can read the `<h1>` with `WP_HTML_Processor` without installing or
booting WordPress. -->

नीचे दिया गया उदाहरण एक ब्लूप्रिंट से बंडल किया हुआ Symfony ऐप डाउनलोड करता है और उसे `/app` में अनज़िप करता है। फिर एक `<php-snippet>` Symfony कर्नेल बूट करता है और डैशबोर्ड रूट रेंडर करता है। ऐप की Composer डिपेंडेंसी में WordPress HTML API शामिल है, इसलिए स्निपेट WordPress को स्थापित या बूट किए बिना `WP_HTML_Processor` से `<h1>` पढ़ सकता है।

<PhpCodeSnippetExample name="symfonyBlueprint" />

<!-- Here is the complete embed: -->

पूरा एम्बेड यह है:

<!-- prettier-ignore-start -->

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<script id="symfony-blueprint" type="application/json">
{
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "unzip",
      "zipFile": {
        "resource": "url",
        "url": "https://wordpress.github.io/blueprints/blueprints/symfony-package-radar/symfony-package-radar.zip?v=wp-php-toolkit-html-2026-06-09"
      },
      "extractToPath": "/app"
    }
  ]
}
</script>

<php-snippet name="run-symfony.php" wp="none" blueprint="symfony-blueprint">
  <script type="application/x-php">
<?php
require '/app/symfony-package-radar/vendor/autoload.php';

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;

$kernel = new Kernel( 'prod', false );
$request = Request::create( '/' );
$response = $kernel->handle( $request );

$page_title = get_first_h1_text( $response->getContent() );

echo 'HTTP ' . $response->getStatusCode() . PHP_EOL;
echo 'Symfony page: ' . $page_title . PHP_EOL;
echo 'WordPress installed: ';
echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';

$kernel->terminate( $request, $response );

/**
 * The app's Composer dependencies include the WordPress HTML API, so the
 * snippet can read the <h1> with WP_HTML_Processor without installing or
 * booting WordPress.
 */
function get_first_h1_text( string $html ): string {
	$processor = WP_HTML_Processor::create_fragment( $html );
	if ( ! $processor->next_tag( 'H1' ) ) {
		return 'unknown';
	}

	$text = '';
	while ( $processor->next_token() ) {
		if ( 'H1' === $processor->get_tag() && $processor->is_tag_closer() ) {
			break;
		}
		if ( '#text' === $processor->get_token_type() ) {
			$text .= $processor->get_modifiable_text();
		}
	}

	return trim( $text );
}
  </script>
  <script type="text/expected-output">
HTTP 200
Symfony page: Symfony Playground
WordPress installed: no
  </script>
</php-snippet>
```

<!-- prettier-ignore-end -->

<!-- The same app is also available as a full Playground page: -->

यही ऐप पूरे Playground पेज के रूप में भी उपलब्ध है:

<!-- [Open the Symfony Package Radar demo](https://playground.wordpress.net/?blueprint-url=https%3A%2F%2Fwordpress.github.io%2Fblueprints%2Fblueprints%2Fsymfony-package-radar%2Fblueprint.json) -->

[Symfony Package Radar डेमो खोलें](https://playground.wordpress.net/?blueprint-url=https%3A%2F%2Fwordpress.github.io%2Fblueprints%2Fblueprints%2Fsymfony-package-radar%2Fblueprint.json)

<!-- ## Package the app as a ZIP -->

## ऐप को ZIP के रूप में पैकेज करें {#package-the-app-as-a-zip}

<!-- For framework demos, prefer a ZIP that already contains `vendor/`. That keeps
the Playground startup path short and avoids asking every visitor to wait for
Composer, Git, and package registry downloads. The Symfony demo uses that path to
bundle both Symfony and a Composer-installed copy of the WordPress HTML API; it
still does not include a WordPress install. -->

फ़्रेमवर्क डेमो के लिए ऐसी ZIP को प्राथमिकता दें, जिसमें `vendor/` पहले से हो। इससे Playground के शुरू होने का रास्ता छोटा रहता है और हर विज़िटर को Composer, Git और पैकेज रजिस्ट्री से डाउनलोड का इंतज़ार नहीं करना पड़ता। Symfony डेमो इसी तरीके से Symfony और Composer से स्थापित WordPress HTML API की एक कॉपी, दोनों को बंडल करता है। फिर भी इसमें WordPress इंस्टॉलेशन शामिल नहीं है।

<!-- For snippets or CLI runs, a small Blueprint can install the app into `/app` with
one step: -->

स्निपेट या CLI रन के लिए, एक छोटा ब्लूप्रिंट एक ही चरण में ऐप को `/app` में स्थापित कर सकता है:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.4",
		"wp": false
	},
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "unzip",
			"zipFile": {
				"resource": "url",
				"url": "https://wordpress.github.io/blueprints/blueprints/symfony-package-radar/symfony-package-radar.zip?v=wp-php-toolkit-html-2026-06-09"
			},
			"extractToPath": "/app"
		}
	]
}
```

<!-- An inline `<php-snippet>` fetches the ZIP from the URL in the Blueprint. If you
distribute the ZIP alongside `blueprint.json` in a [Blueprint bundle](/blueprints/bundles),
use a `bundled` resource with the relative `path` to the ZIP. -->

इनलाइन `<php-snippet>` ब्लूप्रिंट में दिए URL से ZIP लाता है। अगर आप ZIP को [ब्लूप्रिंट बंडल](/blueprints/bundles) में `blueprint.json` के साथ बाँटते हैं, तो ZIP तक के सापेक्ष `path` के साथ `bundled` रिसोर्स उपयोग करें।

<!-- For a full-page Playground website, use a Blueprint like the gallery demo. It
adds a tiny router at the Playground document root so the Symfony `public/`
directory can respond to browser requests. -->

पूरे पेज वाली Playground वेबसाइट के लिए, गैलरी डेमो जैसा ब्लूप्रिंट उपयोग करें। यह Playground के डॉक्यूमेंट रूट पर एक छोटा राउटर जोड़ता है, ताकि Symfony की `public/` डायरेक्टरी ब्राउज़र के अनुरोधों का जवाब दे सके।

<!-- ## Keep the demo browser-friendly -->

## डेमो को ब्राउज़र के अनुकूल रखें {#keep-the-demo-browser-friendly}

<!-- A Playground-hosted framework demo works best when it: -->

Playground पर होस्ट किया गया फ़्रेमवर्क डेमो तब सबसे अच्छा काम करता है, जब वह:

<!--
- Does not require a long-running background process.
- Stores generated files under the virtual filesystem.
- Avoids native extensions that are not compiled into PHP.wasm.
- Avoids frontend build steps at runtime.
- Keeps network calls optional or resilient, because browsers may require CORS
  proxying for third-party services.
-->

- लंबे समय तक चलने वाली बैकग्राउंड प्रोसेस पर निर्भर नहीं होता।
- बनाई गई फ़ाइलें वर्चुअल फ़ाइल सिस्टम में रखता है।
- ऐसे नेटिव एक्सटेंशन से बचता है, जो PHP.wasm में कंपाइल नहीं हैं।
- रनटाइम पर फ़्रंटएंड बिल्ड चरणों से बचता है।
- नेटवर्क कॉल को वैकल्पिक रखता है या उनकी विफलता संभाल लेता है, क्योंकि तीसरे पक्ष की सेवाओं के लिए ब्राउज़र को CORS प्रॉक्सी की ज़रूरत पड़ सकती है।

<!-- Those constraints still leave plenty of room for real framework behavior:
controllers, routing, dependency injection, templates, forms, HTTP clients, and
plain PHP libraries all work when their PHP dependencies are available. -->

इन सीमाओं के बावजूद असली फ़्रेमवर्क व्यवहार के लिए काफ़ी जगह बचती है: जब PHP डिपेंडेंसी उपलब्ध हों, तब कंट्रोलर, रूटिंग, डिपेंडेंसी इंजेक्शन, टेम्पलेट, फ़ॉर्म, HTTP क्लाइंट और सादी PHP लाइब्रेरी, सब काम करते हैं।
