---
title: PHP कोड स्निपेट और एम्बेड
slug: /guides/php-code-snippets
description: <php-snippet> वेब कंपोनेंट से किसी भी वेब पेज में ऐसे PHP और WordPress उदाहरण एम्बेड करें, जिन्हें संपादित किया और चलाया जा सके।
sidebar_class_name: navbar-build-item
---

import PhpCodeSnippetLiveExample, { PhpCodeSnippetExample } from '@site/src/components/PhpCodeSnippetLiveExample';

<!-- # PHP code snippets and embeds -->

# PHP कोड स्निपेट और एम्बेड

<!-- Use `<php-snippet>` when you want readers to run PHP or WordPress code directly
from a docs page, tutorial, blog post, or demo. It renders a syntax-highlighted
code block with a Run button and starts a real Playground runtime only when the
reader asks for it. -->

जब आप चाहते हैं कि पाठक किसी डॉक्स पेज, ट्यूटोरियल, ब्लॉग पोस्ट या डेमो से सीधे PHP या WordPress कोड चलाएँ, तब `<php-snippet>` का उपयोग करें। यह Run बटन वाला, सिंटैक्स हाइलाइट किया हुआ कोड ब्लॉक दिखाता है और असली Playground रनटाइम तभी शुरू करता है, जब पाठक उसे चलाना चाहता है।

<!-- The runtime is shared across matching snippets on the same page, so a tutorial
can include several runnable examples without starting WordPress over and over. -->

एक ही पेज पर मेल खाने वाले स्निपेट एक ही रनटाइम साझा करते हैं, इसलिए किसी ट्यूटोरियल में बार-बार WordPress शुरू किए बिना कई चलाए जा सकने वाले उदाहरण शामिल किए जा सकते हैं।

<!-- ## Try it -->

## इसे आज़माएँ {#try-it}

<!-- The example below is editable and runnable. It also uses a Blueprint to install
a small mu-plugin before the snippet runs, so the PHP code can call a helper
function that did not exist in the default WordPress install. -->

नीचे दिया गया उदाहरण संपादित किया और चलाया जा सकता है। स्निपेट चलने से पहले यह एक ब्लूप्रिंट से एक छोटा mu-plugin भी स्थापित करता है, ताकि PHP कोड ऐसे हेल्पर फ़ंक्शन को कॉल कर सके जो डिफ़ॉल्ट WordPress इंस्टॉलेशन में मौजूद नहीं था।

<PhpCodeSnippetLiveExample />

<!-- Here is the complete embed: -->

पूरा एम्बेड यह है:

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<script id="product-card-blueprint" type="application/json">
	{
		"steps": [
			{
				"step": "writeFile",
				"path": "/wordpress/wp-content/mu-plugins/product-cards.php",
				"data": "<?php\nfunction docs_render_product_card( array $product ): string {\n\treturn sprintf(\n\t\t'<article class=\"product-card\"><h3>%s</h3><p>$%0.2f</p></article>',\n\t\tesc_html( $product['name'] ),\n\t\t$product['price']\n\t);\n}\n"
			}
		]
	}
</script>

<php-snippet name="product-card.php" blueprint="product-card-blueprint">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		$products = [
			[
				'name'  => 'Canvas Tote',
				'price' => 24,
			],
			[
				'name'  => 'Coffee & Code Mug',
				'price' => 16.5,
			],
		];

		foreach ( $products as $product ) {
			echo docs_render_product_card( $product ) . "\n";
		}
	</script>
	<script type="text/expected-output">
		<article class="product-card"><h3>Canvas Tote</h3><p>$24.00</p></article>
		<article class="product-card"><h3>Coffee &amp; Code Mug</h3><p>$16.50</p></article>
	</script>
</php-snippet>
```

<!-- Use this pattern when each example should start from the same prepared site:
helper functions, mu-plugins, options, themes, demo files, or sample content. -->

जब हर उदाहरण को एक ही तैयार साइट से शुरू होना हो, तब यह पैटर्न उपयोग करें: हेल्पर फ़ंक्शन, mu-plugin, विकल्प, थीम, डेमो फ़ाइलें या सैंपल सामग्री।

<!-- ## Start with one snippet -->

## एक स्निपेट से शुरू करें {#start-with-one-snippet}

<!-- For a basic runnable example, add the component script once and place PHP inside
`<php-snippet>`: -->

एक सामान्य चलाए जा सकने वाले उदाहरण के लिए, कंपोनेंट स्क्रिप्ट एक बार जोड़ें और PHP को `<php-snippet>` के अंदर रखें:

<PhpCodeSnippetExample name="hello" />

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<php-snippet name="hello.php">
	<script type="application/x-php">
		<?php
		echo 'Hello from PHP ' . phpversion();
	</script>
	<script type="text/expected-output">
		Hello from PHP 8.4.x
	</script>
</php-snippet>
```

<!-- The script itself is small. PHP, WordPress, and the WASM runtime are fetched
later, after the first Run click. The expected output appears before Run and is
replaced with the exact PHP version after execution. -->

स्क्रिप्ट खुद छोटी है। PHP, WordPress और WASM रनटाइम बाद में, पहली बार Run पर क्लिक करने के बाद लाए जाते हैं। अपेक्षित आउटपुट Run से पहले दिखता है और कोड चलने के बाद उसकी जगह PHP का सटीक संस्करण आ जाता है।

<!-- ## Write PHP safely in HTML -->

## HTML में PHP सुरक्षित तरीके से लिखें {#write-php-safely-in-html}

<!-- Put inline PHP in a `<script type="application/x-php">` child. Browsers ignore
script tags with unknown types, which means PHP strings can contain HTML without
escaping every `<` character. -->

इनलाइन PHP को एक `<script type="application/x-php">` चाइल्ड में रखें। ब्राउज़र अनजान टाइप वाले script टैग को अनदेखा करते हैं, इसलिए PHP स्ट्रिंग में हर `<` कैरेक्टर को एस्केप किए बिना HTML रखा जा सकता है।

<PhpCodeSnippetExample name="htmlApi" />

```html
<php-snippet name="html-api.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		$html = '<img src="hero.jpg" alt="Hero">';
		$tags = new WP_HTML_Tag_Processor( $html );

		if ( $tags->next_tag( 'img' ) ) {
			$tags->set_attribute( 'loading', 'lazy' );
		}

		echo $tags->get_updated_html();
	</script>
	<script type="text/expected-output">
		<img src="hero.jpg" alt="Hero" loading="lazy">
	</script>
</php-snippet>
```

<!-- A literal `</script>` still closes the child script element, even when it is
inside a PHP string. Use JSON-encoded child payloads when the PHP source or
expected output contains that sequence: -->

PHP स्ट्रिंग के अंदर होने पर भी, सीधे लिखा गया `</script>` चाइल्ड script एलिमेंट को बंद कर देता है। जब PHP सोर्स या अपेक्षित आउटपुट में यह क्रम हो, तब JSON-एन्कोडेड चाइल्ड पेलोड उपयोग करें:

```html
<php-snippet name="example.php">
	<script type="application/x-php+json">
		"\u003C?php\necho '\u003C/script\u003E';"
	</script>
	<script type="text/expected-output+json">
		"\u003C/script\u003E"
	</script>
</php-snippet>
```

<!-- Both payloads are parsed as JSON and must decode to strings; other JSON values
are rejected. Encode `<` as `\u003C` so the HTML parser never sees a literal
`</script>`. `JSON.stringify()` does not escape `<` by itself. The unencoded
`application/x-php` and `text/expected-output` types remain supported. -->

दोनों पेलोड JSON के रूप में पार्स होते हैं और डिकोड होने पर इनका स्ट्रिंग होना ज़रूरी है। दूसरी JSON वैल्यू अस्वीकार कर दी जाती हैं। `<` को `\u003C` के रूप में एन्कोड करें, ताकि HTML पार्सर को कभी सीधा `</script>` न दिखे। `JSON.stringify()` अपने-आप `<` को एस्केप नहीं करता। बिना एन्कोडिंग वाले `application/x-php` और `text/expected-output` टाइप अब भी समर्थित हैं।

<!-- Very short snippets can also be written as text, as long as PHP opening tags are
escaped: -->

बहुत छोटे स्निपेट टेक्स्ट के रूप में भी लिखे जा सकते हैं, बशर्ते PHP के ओपनिंग टैग एस्केप किए गए हों:

<PhpCodeSnippetExample name="sum" />

```html
<php-snippet name="sum.php" expected-output="42"> &lt;?php echo 20 + 22; </php-snippet>
```

<!-- ## Use WordPress APIs -->

## WordPress API का उपयोग करें {#use-wordpress-apis}

<!-- Snippets run in a real WordPress installation by default. Load WordPress with
`require '/wordpress/wp-load.php'`, then call core APIs as usual. -->

स्निपेट डिफ़ॉल्ट रूप से एक असली WordPress इंस्टॉलेशन में चलते हैं। `require '/wordpress/wp-load.php'` से WordPress लोड करें, फिर हमेशा की तरह कोर API कॉल करें।

<PhpCodeSnippetExample name="siteTitle" />

```html
<php-snippet name="site-title.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		update_option( 'blogname', 'Snippet Docs' );
		echo get_bloginfo( 'name' );
	</script>
	<script type="text/expected-output">
		Snippet Docs
	</script>
</php-snippet>
```

<!-- If your example is pure PHP and does not need WordPress, use `wp="none"` to skip
the WordPress download and boot step: -->

अगर आपका उदाहरण सिर्फ़ PHP का है और उसे WordPress नहीं चाहिए, तो WordPress डाउनलोड और बूट करने का चरण छोड़ने के लिए `wp="none"` उपयोग करें:

<PhpCodeSnippetExample name="purePhp" />

```html
<php-snippet name="pure-php.php" wp="none">
	<script type="application/x-php">
		<?php
		echo 'WordPress installed: ';
		echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';
	</script>
	<script type="text/expected-output">
		WordPress installed: no
	</script>
</php-snippet>
```

<!-- ### Automatically prepend a hidden PHP script -->

### छिपी हुई PHP स्क्रिप्ट अपने-आप पहले चलाएँ {#automatically-prepend-a-hidden-php-script}

<!-- `auto-prepend-script` mirrors PHP's
[`auto_prepend_file`](https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file)
`php.ini` directive: the referenced PHP script runs before the snippet's main
file on every request. Unlike the PHP directive, the attribute takes the id or
CSS selector of an inert PHP `<script>` element. Use it when setup code should
not appear in the editable example: -->

`auto-prepend-script`, PHP के [`auto_prepend_file`](https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file) `php.ini` डायरेक्टिव की तरह काम करता है: बताई गई PHP स्क्रिप्ट हर अनुरोध पर स्निपेट की मुख्य फ़ाइल से पहले चलती है। PHP डायरेक्टिव के उलट, यह एट्रिब्यूट किसी निष्क्रिय PHP `<script>` एलिमेंट का id या CSS सेलेक्टर लेता है। जब सेटअप कोड संपादन योग्य उदाहरण में नहीं दिखना चाहिए, तब इसका उपयोग करें:

```html
<script id="load-wordpress" type="application/x-php">
	<?php
	require_once '/wordpress/wp-load.php';
</script>

<php-snippet name="site-title.php" auto-prepend-script="#load-wordpress" implicit-php-open-tag>
	<script type="application/x-php">
		echo get_bloginfo( 'name' );
	</script>
</php-snippet>
```

<!-- The referenced script must start with `<?php`. It remains outside the visible
editor and runs before every click, including after the reader edits the
snippet. Snippets with different auto-prepended scripts can still share one
runtime. -->

बताई गई स्क्रिप्ट `<?php` से शुरू होनी चाहिए। यह दिखने वाले एडिटर से बाहर रहती है और हर क्लिक से पहले चलती है, पाठक के स्निपेट संपादित करने के बाद भी। अलग-अलग ऑटो-प्रीपेंड स्क्रिप्ट वाले स्निपेट भी एक ही रनटाइम साझा कर सकते हैं।

<!-- `implicit-php-open-tag` adds the PHP opening tag omitted from the visible
source. Playground adds it on the first line of the execution file, so PHP
errors still point to the displayed line. Diagnostics use a filesystem-safe
form of the `name` attribute as the filename. Code starting with any PHP
opening tag (`<?php`, `<?=`, or `<?`) is rejected; remove
`implicit-php-open-tag` when the source is already a complete PHP file. -->

`implicit-php-open-tag`, दिखने वाले सोर्स में छोड़ा गया PHP ओपनिंग टैग जोड़ देता है। Playground इसे चलाई जाने वाली फ़ाइल की पहली लाइन पर जोड़ता है, इसलिए PHP की एरर अब भी दिखाई गई लाइन की ओर इशारा करती हैं। डायग्नोस्टिक्स में फ़ाइल के नाम के रूप में `name` एट्रिब्यूट का फ़ाइल सिस्टम के लिए सुरक्षित रूप उपयोग होता है। किसी भी PHP ओपनिंग टैग (`<?php`, `<?=` या `<?`) से शुरू होने वाला कोड अस्वीकार कर दिया जाता है। जब सोर्स पहले से एक पूरी PHP फ़ाइल हो, तब `implicit-php-open-tag` हटा दें।

<!-- Without `implicit-php-open-tag`, snippets using `auto-prepend-script` must
include their own PHP opening tag. The two attributes are independent, so an
implicit opening tag also works without an auto-prepended script. -->

जिन स्निपेट में `auto-prepend-script` उपयोग होता है, `implicit-php-open-tag` के बिना उनमें अपना PHP ओपनिंग टैग होना चाहिए। दोनों एट्रिब्यूट एक-दूसरे से स्वतंत्र हैं, इसलिए अपने-आप जुड़ने वाला ओपनिंग टैग ऑटो-प्रीपेंड स्क्रिप्ट के बिना भी काम करता है।

<!-- ## Edit examples in place -->

## उदाहरणों को वहीं संपादित करें {#edit-examples-in-place}

<!-- Runnable snippets are editable by default. The edited code is kept only in the
current page session; refreshing restores the original snippet. -->

चलाए जा सकने वाले स्निपेट डिफ़ॉल्ट रूप से संपादन योग्य होते हैं। संपादित कोड सिर्फ़ मौजूदा पेज सेशन में रहता है। पेज रीफ़्रेश करने पर मूल स्निपेट वापस आ जाता है।

<PhpCodeSnippetExample name="scratch" />

```html
<php-snippet name="scratch.php">
	<script type="application/x-php">
		<?php
		$numbers = range( 1, 5 );
		echo array_sum( $numbers );
	</script>
	<script type="text/expected-output">
		15
	</script>
</php-snippet>
```

<!-- Editable snippets also run with `Ctrl+Enter` or `Cmd+Enter` while the editor is
focused. -->

एडिटर पर फ़ोकस होने पर, संपादन योग्य स्निपेट `Ctrl+Enter` या `Cmd+Enter` से भी चलते हैं।

<!-- Use `readonly` for runnable examples that should be copied or run as-is: -->

जिन चलाए जा सकने वाले उदाहरणों को जैसा है वैसा ही कॉपी करना या चलाना हो, उनके लिए `readonly` उपयोग करें:

<PhpCodeSnippetExample name="readOnly" />

```html
<php-snippet name="reference.php" readonly>
	<script type="application/x-php">
		<?php
		echo 'This example can run, but the code is locked.';
	</script>
	<script type="text/expected-output">
		This example can run, but the code is locked.
	</script>
</php-snippet>
```

<!-- `editable="false"` works as a compatibility alias for `readonly`. -->

`editable="false"` भी काम करता है। यह संगतता के लिए `readonly` का दूसरा नाम है।

<!-- ## Show output before Run -->

## Run से पहले आउटपुट दिखाएँ {#show-output-before-run}

<!-- Use expected output when you want the result visible immediately. The placeholder
is replaced with real runtime output after the reader clicks Run. -->

जब आप चाहते हैं कि नतीजा तुरंत दिखे, तब अपेक्षित आउटपुट उपयोग करें। पाठक के Run पर क्लिक करने के बाद प्लेसहोल्डर की जगह रनटाइम का असली आउटपुट आ जाता है।

<PhpCodeSnippetExample name="precomputed" />

```html
<php-snippet name="precomputed.php">
	<script type="application/x-php">
		<?php
		echo '2 + 2 = ' . ( 2 + 2 );
	</script>
	<script type="text/expected-output">
		2 + 2 = 4
	</script>
</php-snippet>
```

<!-- For one-line output, use the `expected-output` attribute: -->

एक लाइन के आउटपुट के लिए `expected-output` एट्रिब्यूट उपयोग करें:

<PhpCodeSnippetExample name="oneLine" />

```html
<php-snippet name="one-line.php" expected-output="Ready">
	<script type="application/x-php">
		<?php
		echo 'Ready';
	</script>
</php-snippet>
```

<!-- ## Prepare a site with a Blueprint -->

## ब्लूप्रिंट से साइट तैयार करें {#prepare-a-site-with-a-blueprint}

<!-- Use `blueprint` when snippets need setup before the PHP code runs. Put a JSON
[Blueprint](/blueprints/) in the page and point snippets at it by id or CSS
selector. -->

जब PHP कोड चलने से पहले स्निपेट को सेटअप चाहिए, तब `blueprint` उपयोग करें। पेज में एक JSON [ब्लूप्रिंट](/blueprints/) रखें और id या CSS सेलेक्टर के ज़रिए स्निपेट को उससे जोड़ें।

<PhpCodeSnippetExample name="greeting" />

```html
<script id="setup-blueprint" type="application/json">
	{
		"steps": [
			{
				"step": "writeFile",
				"path": "/wordpress/wp-content/mu-plugins/helpers.php",
				"data": "<?php\nfunction docs_greet( $name ) {\n\treturn 'Hello, ' . $name;\n}\n"
			}
		]
	}
</script>

<php-snippet name="greeting.php" blueprint="setup-blueprint">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo docs_greet( 'Ada' );
	</script>
	<script type="text/expected-output">
		Hello, Ada
	</script>
</php-snippet>
```

<!-- The selector form is useful when generated markup cannot guarantee simple ids: -->

जब बनाया गया मार्कअप सरल id की गारंटी नहीं दे सकता, तब सेलेक्टर वाला रूप काम आता है:

<PhpCodeSnippetExample name="withSelector" />

```html
<php-snippet blueprint="#setup-blueprint" name="with-selector.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo docs_greet( 'Grace' );
	</script>
	<script type="text/expected-output">
		Hello, Grace
	</script>
</php-snippet>
```

<!-- Prefer `<script type="application/json">` for Blueprints. Its contents are raw
text, so embedded PHP strings such as `<?php` are safe. A `<template>` can work,
but its contents are parsed as HTML; if you use one, escape `<` in embedded PHP
strings as `\u003c`. -->

ब्लूप्रिंट के लिए `<script type="application/json">` को प्राथमिकता दें। इसकी सामग्री सादा टेक्स्ट होती है, इसलिए `<?php` जैसी एम्बेड की गई PHP स्ट्रिंग सुरक्षित रहती हैं। `<template>` भी काम कर सकता है, लेकिन उसकी सामग्री HTML के रूप में पार्स होती है। अगर आप इसका उपयोग करते हैं, तो एम्बेड की गई PHP स्ट्रिंग में `<` को `\u003c` के रूप में एस्केप करें।

<!-- ## Load PHP from another file -->

## किसी दूसरी फ़ाइल से PHP लोड करें {#load-php-from-another-file}

<!-- Use `src` when the PHP source should live in a separate file: -->

जब PHP सोर्स किसी अलग फ़ाइल में रखना हो, तब `src` उपयोग करें:

```html
<php-snippet name="external-example.php" src="/snippets/external-example.php" expected-output="Loaded from an external file"></php-snippet>
```

<!-- The URL resolves from the page that contains the snippet. If the file is hosted
on another origin, serve it with an `Access-Control-Allow-Origin` header that
allows the documentation page. -->

URL उस पेज के हिसाब से तय होता है जिसमें स्निपेट है। अगर फ़ाइल किसी दूसरे ओरिजिन पर होस्ट है, तो उसे ऐसे `Access-Control-Allow-Origin` हेडर के साथ सर्व करें, जो दस्तावेज़ वाले पेज को अनुमति देता हो।

<!-- `src` loads only the snippet body. Use a Blueprint when you need support files,
plugins, options, or other setup before the snippet runs. The `expected-output`
attribute is still useful with `src` when you already know what the external PHP
file prints. -->

`src` सिर्फ़ स्निपेट का मुख्य कोड लोड करता है। स्निपेट चलने से पहले जब आपको सपोर्ट फ़ाइलें, प्लगइन, विकल्प या कोई दूसरा सेटअप चाहिए, तब ब्लूप्रिंट उपयोग करें। जब आपको पहले से पता हो कि बाहरी PHP फ़ाइल क्या प्रिंट करती है, तब `src` के साथ भी `expected-output` एट्रिब्यूट काम आता है।

<!-- ## Pin PHP or WordPress versions -->

## PHP या WordPress संस्करण तय करें {#pin-php-or-wordpress-versions}

<!-- The default PHP version is `8.4`, and the default WordPress version is `latest`.
Set `php` or `wp` when the example depends on a specific version. -->

डिफ़ॉल्ट PHP संस्करण `8.4` है और डिफ़ॉल्ट WordPress संस्करण `latest` है। जब उदाहरण किसी ख़ास संस्करण पर निर्भर हो, तब `php` या `wp` सेट करें।

<PhpCodeSnippetExample name="enum" />

```html
<php-snippet name="enum.php" php="8.4">
	<script type="application/x-php">
		<?php
		enum Status {
			case Draft;
			case Published;
		}

		echo Status::Published->name;
	</script>
	<script type="text/expected-output">
		Published
	</script>
</php-snippet>
```

<PhpCodeSnippetExample name="wpVersion" />

```html
<php-snippet name="wp-version.php" wp="6.8">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo get_bloginfo( 'version' );
	</script>
	<script type="text/expected-output">
		6.8
	</script>
</php-snippet>
```

<!-- See the [Query API reference](/developers/apis/query-api/#available-options)
for available PHP and WordPress versions. -->

उपलब्ध PHP और WordPress संस्करणों के लिए [Query API संदर्भ](/developers/apis/query-api/#available-options) देखें।

<!-- ## Show code without running it -->

## कोड को चलाए बिना दिखाएँ {#show-code-without-running-it}

<!-- Set `runnable="false"` for fragments that should be highlighted but not
executed, such as incomplete examples or code that depends on external services. -->

जिन हिस्सों को हाइलाइट करना है पर चलाना नहीं है, जैसे अधूरे उदाहरण या बाहरी सेवाओं पर निर्भर कोड, उनके लिए `runnable="false"` सेट करें।

<PhpCodeSnippetExample name="illustration" />

```html
<php-snippet name="illustration.php" runnable="false">
	<script type="application/x-php">
		<?php
		// This fragment is shown for discussion, not execution.
		add_filter( 'the_content', 'docs_filter_content' );
	</script>
</php-snippet>
```

<!-- ## Self-host the runtime -->

## रनटाइम सेल्फ़-होस्ट करें {#self-host-the-runtime}

<!-- Most pages should use the hosted runtime from [playground.wordpress.net](https://playground.wordpress.net).
Set `playground-origin` when developing Playground itself, testing a self-hosted
deployment, or pinning examples to infrastructure you control. -->

ज़्यादातर पेजों को [playground.wordpress.net](https://playground.wordpress.net) का होस्ट किया हुआ रनटाइम उपयोग करना चाहिए। खुद Playground को डेवलप करते समय, सेल्फ़-होस्ट किए गए डिप्लॉयमेंट को टेस्ट करते समय, या उदाहरणों को अपने नियंत्रण वाले इन्फ्रास्ट्रक्चर से बाँधने के लिए `playground-origin` सेट करें।

```html
<php-snippet name="local-runtime.php" playground-origin="http://localhost:5400">
	<script type="application/x-php">
		<?php
		echo phpversion();
	</script>
	<script type="text/expected-output">
		8.4.x
	</script>
</php-snippet>
```

<!-- ## Runtime sharing -->

## रनटाइम शेयरिंग {#runtime-sharing}

<!-- The first Run click on a page: -->

किसी पेज पर पहली बार Run पर क्लिक करने पर:

<!--
1. Loads the Playground client.
2. Creates a hidden iframe pointed at `remote.html`.
3. Boots PHP, and WordPress unless the snippet uses `wp="none"`.
4. Runs the snippet code and writes stdout into the output panel.
-->

1. Playground क्लाइंट लोड होता है।
2. एक छिपा हुआ iframe बनता है, जो `remote.html` खोलता है।
3. PHP बूट होता है, और अगर स्निपेट में `wp="none"` नहीं है तो WordPress भी।
4. स्निपेट का कोड चलता है और stdout आउटपुट पैनल में लिखा जाता है।

<!-- Later runs reuse an existing runtime when `playground-origin`, `php`, `wp`, and
the resolved Blueprint JSON all match. This keeps related snippets fast while
still isolating examples that need different setup. -->

जब `playground-origin`, `php`, `wp` और पेज से लिया गया ब्लूप्रिंट JSON, सभी मेल खाते हैं, तब बाद के रन मौजूदा रनटाइम को दोबारा उपयोग करते हैं। इससे जुड़े हुए स्निपेट तेज़ चलते हैं, और अलग सेटअप वाले उदाहरण फिर भी अलग रहते हैं।

<!-- ## Security and CSP -->

## सुरक्षा और CSP {#security-and-csp}

<!-- Snippet PHP runs inside the Playground runtime iframe, not in the parent page.
The parent page still loads the web component script and creates the hidden
runtime iframe. -->

स्निपेट का PHP, Playground रनटाइम iframe के अंदर चलता है, पैरेंट पेज में नहीं। फिर भी पैरेंट पेज वेब कंपोनेंट स्क्रिप्ट लोड करता है और छिपा हुआ रनटाइम iframe बनाता है।

<!-- If your site has a Content Security Policy, allow: -->

अगर आपकी साइट पर Content Security Policy है, तो इन्हें अनुमति दें:

<!--
- The module script from `https://playground.wordpress.net`.
- The hidden iframe from the same origin.
- Network requests for the PHP, WordPress, and Playground runtime assets.
-->

- मॉड्यूल स्क्रिप्ट, जो `https://playground.wordpress.net` से आती है।
- उसी ओरिजिन से छिपा हुआ iframe।
- PHP, WordPress और Playground रनटाइम एसेट के लिए नेटवर्क अनुरोध।

<!-- For stricter environments, self-host the snippet script and use
`playground-origin` to point snippets at your deployment. -->

ज़्यादा सख़्त एनवायरनमेंट के लिए, स्निपेट स्क्रिप्ट को सेल्फ़-होस्ट करें और स्निपेट को अपने डिप्लॉयमेंट से जोड़ने के लिए `playground-origin` उपयोग करें।

<!-- ## Standalone PHP Playground -->

## स्टैंडअलोन PHP Playground {#standalone-php-playground}

<!-- Use the standalone PHP Playground when you want a full-page editor, a shareable
URL, or an iframe instead of inline examples: -->

जब आपको इनलाइन उदाहरणों की जगह पूरे पेज का एडिटर, शेयर करने लायक URL या iframe चाहिए, तब स्टैंडअलोन PHP Playground उपयोग करें:

<!-- > [playground.wordpress.net/php-playground.html](https://playground.wordpress.net/php-playground.html) -->

> [playground.wordpress.net/php-playground.html](https://playground.wordpress.net/php-playground.html)

<!-- You can embed it directly: -->

आप इसे सीधे एम्बेड कर सकते हैं:

```html
<iframe src="https://playground.wordpress.net/php-playground.html#eyJjb2RlIjoiPD9waHBcblxuZWNobyBcIkkgYW0gYSBjb2RlIHNuaXBwZXQhXCI7XG4iLCJwaHAiOiI4LjQifQ==" width="100%" height="600"></iframe>
```

<!-- The URL fragment is a base64-encoded JSON payload with `code`, `php`, and `wp`
fields. -->

URL फ़्रैगमेंट एक base64-एन्कोडेड JSON पेलोड है, जिसमें `code`, `php` और `wp` फ़ील्ड होते हैं।

<!-- ## Which embed should you use? -->

## कौन-सा एम्बेड उपयोग करें? {#which-embed-should-you-use}

<!--
| Use case                                              | Use                                       |
| ----------------------------------------------------- | ----------------------------------------- |
| Several runnable examples in one article              | `<php-snippet>`                           |
| A tutorial step where readers should edit code inline | `<php-snippet>`                           |
| Shared setup across examples                          | `<php-snippet blueprint="...">`           |
| Hidden PHP setup before every run                     | `<php-snippet auto-prepend-script="...">` |
| PHP source without an opening tag                     | `<php-snippet implicit-php-open-tag>`     |
| A pure PHP language example                           | `<php-snippet wp="none">`                 |
| A runnable example that should not be edited          | `<php-snippet readonly>`                  |
| A single full-page editor with a shareable URL        | Standalone PHP Playground                 |
| A complete WordPress site preview                     | Standard Playground iframe                |
-->

| उपयोग का मामला                                         | क्या उपयोग करें                           |
| ------------------------------------------------------ | ----------------------------------------- |
| एक लेख में कई चलाए जा सकने वाले उदाहरण                 | `<php-snippet>`                           |
| ट्यूटोरियल का ऐसा चरण, जहाँ पाठक कोड वहीं संपादित करें | `<php-snippet>`                           |
| कई उदाहरणों में साझा सेटअप                             | `<php-snippet blueprint="...">`           |
| हर रन से पहले छिपा हुआ PHP सेटअप                       | `<php-snippet auto-prepend-script="...">` |
| ओपनिंग टैग के बिना PHP सोर्स                           | `<php-snippet implicit-php-open-tag>`     |
| सिर्फ़ PHP भाषा का उदाहरण                              | `<php-snippet wp="none">`                 |
| चलाया जा सकने वाला उदाहरण, जिसे संपादित नहीं करना है   | `<php-snippet readonly>`                  |
| शेयर करने लायक URL वाला, पूरे पेज का एक एडिटर          | स्टैंडअलोन PHP Playground                 |
| पूरी WordPress साइट का पूर्वावलोकन                     | सामान्य Playground iframe                 |

<!-- ## Troubleshooting -->

## समस्या निवारण {#troubleshooting}

<!-- If the snippet does not render, check that the module script loaded and that the
browser supports custom elements. -->

अगर स्निपेट रेंडर नहीं होता, तो जाँचें कि मॉड्यूल स्क्रिप्ट लोड हुई है और ब्राउज़र कस्टम एलिमेंट को सपोर्ट करता है।

<!-- If Run never finishes, open DevTools and check failed requests for `remote.html`,
PHP `.wasm` files, WordPress zip files, Blueprint resources, or cross-origin
`src` files. -->

अगर Run कभी पूरा नहीं होता, तो DevTools खोलें और `remote.html`, PHP `.wasm` फ़ाइलों, WordPress zip फ़ाइलों, ब्लूप्रिंट संसाधनों या क्रॉस-ओरिजिन `src` फ़ाइलों के लिए विफल अनुरोध जाँचें।

<!-- If a Blueprint-backed snippet cannot find helper functions, confirm the
`blueprint` attribute points to the right element and that the JSON is valid. -->

अगर ब्लूप्रिंट वाला स्निपेट हेल्पर फ़ंक्शन नहीं ढूँढ पाता, तो पक्का करें कि `blueprint` एट्रिब्यूट सही एलिमेंट की ओर इशारा करता है और JSON मान्य है।

<!-- If output differs from the expected placeholder, trust the runtime output. The
placeholder is static documentation; Run executes the current code against the
selected PHP, WordPress, and Blueprint setup. -->

अगर आउटपुट अपेक्षित प्लेसहोल्डर से अलग है, तो रनटाइम के आउटपुट पर भरोसा करें। प्लेसहोल्डर स्थिर दस्तावेज़ है। Run मौजूदा कोड को चुने गए PHP, WordPress और ब्लूप्रिंट सेटअप पर चलाता है।
