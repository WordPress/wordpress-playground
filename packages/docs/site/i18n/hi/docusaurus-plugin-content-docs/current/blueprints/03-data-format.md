---
sidebar_position: 1
title: ब्लूप्रिंट डेटा फ़ॉर्मेट
slug: /blueprints/data-format
description: ब्लूप्रिंट डेटा फ़ॉर्मेट का परिचय। landingPage, preferredVersions और steps जैसी मुख्य प्रॉपर्टी के बारे में जानें।
---

<!-- # Blueprint data format -->

# ब्लूप्रिंट डेटा फ़ॉर्मेट

<!-- A Blueprint JSON file can have many different properties that will be used to define your Playground instance. The most important properties are detailed below. -->

एक ब्लूप्रिंट JSON फ़ाइल में कई अलग अलग प्रॉपर्टी हो सकती हैं, जिनसे आपका Playground इंस्टेंस तय होता है। सबसे ज़रूरी प्रॉपर्टी नीचे विस्तार से बताई गई हैं।

<!-- Here's an example that uses many of them: -->

यहाँ एक उदाहरण है, जिसमें इनमें से कई प्रॉपर्टी इस्तेमाल हुई हैं:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
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

<!-- ## JSON schema -->

## JSON स्कीमा {#json-schema}

<!-- JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get auto-completion and validation in your editor. Just set the `$schema` property to the following: -->

JSON फ़ाइलें लिखना थकाऊ हो सकता है और इनमें गलती होना आसान है। इसमें मदद के लिए Playground एक [JSON स्कीमा](https://playground.wordpress.net/blueprint-schema.json) फ़ाइल देता है, जिससे आपको अपने एडिटर में ऑटो कंप्लीशन और वैलिडेशन मिलता है। बस `$schema` प्रॉपर्टी में यह वैल्यू दें:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

<!-- ## Landing page -->

## लैंडिंग पेज {#landing-page}

<!-- The `landingPage` property tells Playground which URL to navigate to after the Blueprint has been run. This is a great tool, especially when creating theme or plugin demos. Often, you will want to start Playground in the Site Editor or have a specific post open in the Post Editor. Make sure you use a relative path. -->

`landingPage` प्रॉपर्टी Playground को बताती है कि ब्लूप्रिंट चलने के बाद किस URL पर जाना है। यह बहुत काम का टूल है, खासकर थीम या प्लगइन डेमो बनाते समय। अक्सर आप Playground को Site Editor में शुरू करना चाहेंगे, या Post Editor में कोई खास पोस्ट खोलना चाहेंगे। ध्यान रखें कि आप रिलेटिव पाथ इस्तेमाल करें।

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

<!-- ## Preferred versions -->

## पसंदीदा वर्ज़न {#preferred-versions}

<!-- The `preferredVersions` property declares your preferred PHP and WordPress versions. It can contain the following properties: -->

`preferredVersions` प्रॉपर्टी बताती है कि आप PHP और WordPress के कौन से वर्ज़न चाहते हैं। इसमें ये प्रॉपर्टी हो सकती हैं:

<!--
- `php` (string): Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, `latest`, or `next`. Minor versions like `7.4.1` are not supported. Use `next` to preview the next PHP version from the php-src development branch; it is currently supported by the web runtime only.
- `wp` (string): Loads the specified WordPress version. Accepts the last seven major WordPress versions. As of April 28, 2026, that's `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8`, or `6.9`. You can also use the generic values `latest`, `beta`, or `nightly` (alias `trunk`). `beta` resolves to the most recent Beta or Release Candidate of an active release cycle; `nightly`/`trunk` builds straight from the WordPress development branch.
-->

- `php` (string): बताया गया PHP वर्ज़न लोड करती है। यह `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, `latest` या `next` स्वीकार करती है। `7.4.1` जैसे माइनर वर्ज़न सपोर्ट नहीं होते। php-src डेवलपमेंट ब्रांच का अगला PHP वर्ज़न आज़माने के लिए `next` इस्तेमाल करें; फ़िलहाल यह सिर्फ़ वेब रनटाइम में सपोर्ट होता है।
- `wp` (string): बताया गया WordPress वर्ज़न लोड करती है। यह WordPress के पिछले सात मेजर वर्ज़न स्वीकार करती है। 28 अप्रैल 2026 तक ये `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8` या `6.9` हैं। आप सामान्य वैल्यू `latest`, `beta` या `nightly` (इसका दूसरा नाम `trunk`) भी इस्तेमाल कर सकते हैं। `beta` किसी चालू रिलीज़ साइकिल के सबसे नए Beta या Release Candidate को चुनता है; `nightly`/`trunk` सीधे WordPress डेवलपमेंट ब्रांच से बनता है।

```js
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.7"
	},
}
```

<!-- ## Features -->

## फ़ीचर {#features}

<!-- You can use the `features` property to turn on or off certain features of the Playground instance. It can contain the following properties: -->

आप `features` प्रॉपर्टी से Playground इंस्टेंस के कुछ फ़ीचर चालू या बंद कर सकते हैं। इसमें ये प्रॉपर्टी हो सकती हैं:

<!--
- `networking`: Defaults to `true`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead. You will need this property enabled if you want the user to be able to install plugins or themes.
-->

- `networking`: डिफ़ॉल्ट रूप से `true`। Playground में नेटवर्किंग सपोर्ट को चालू या बंद करती है। चालू होने पर [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) और ऐसे ही दूसरे WordPress फ़ंक्शन HTTP रिक्वेस्ट भेजने के लिए सच में `fetch()` इस्तेमाल करते हैं। बंद होने पर वे तुरंत फ़ेल हो जाते हैं। अगर आप चाहते हैं कि उपयोगकर्ता प्लगइन या थीम इंस्टॉल कर सके, तो यह प्रॉपर्टी चालू होनी चाहिए।

```js
{
	"features": {
		"networking": false
	},
}
```

<!-- ## Extra libraries -->

## अतिरिक्त लाइब्रेरी {#extra-libraries}

<!-- You can preload extra libraries into the Playground instance. The following libraries are supported: -->

आप Playground इंस्टेंस में अतिरिक्त लाइब्रेरी पहले से लोड कर सकते हैं। ये लाइब्रेरी सपोर्ट होती हैं:

<!--
- `wp-cli`: Enables WP-CLI support for Playground. If included, WP-CLI will be installed during boot. If not included, you will get an error message when trying to run WP-CLI commands using the JS API. WP-CLI will be installed by default if the blueprint contains any `wp-cli` steps.
-->

- `wp-cli`: Playground में WP-CLI सपोर्ट चालू करती है। इसे शामिल करने पर बूट के दौरान WP-CLI इंस्टॉल हो जाता है। शामिल न करने पर JS API से WP-CLI कमांड चलाते समय आपको एक एरर मैसेज मिलेगा। अगर ब्लूप्रिंट में कोई भी `wp-cli` स्टेप है, तो WP-CLI डिफ़ॉल्ट रूप से इंस्टॉल हो जाता है।

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

<!-- ## Steps -->

## स्टेप {#steps}

<!-- Arguably the most powerful property, `steps` allows you to configure the Playground instance with preinstalled themes, plugins, demo content, and more. The following example logs the user in with a dedicated username and password. It then installs and activates the Gutenberg plugin. [Learn more about steps](/blueprints/steps). -->

शायद सबसे ताकतवर प्रॉपर्टी `steps` है। इससे आप Playground इंस्टेंस को पहले से इंस्टॉल की गई थीम, प्लगइन, डेमो कंटेंट और बहुत कुछ के साथ कॉन्फ़िगर कर सकते हैं। नीचे दिया गया उदाहरण उपयोगकर्ता को एक तय यूज़रनेम और पासवर्ड से लॉग इन करता है। फिर यह Gutenberg प्लगइन इंस्टॉल और एक्टिवेट करता है। [स्टेप के बारे में और जानें](/blueprints/steps)।

```js
{
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
				"slug": "gutenberg"
			}
		},
	]
}
```

<!-- ## Common property placement mistakes -->

## प्रॉपर्टी गलत जगह रखने की आम गलतियाँ {#common-property-placement-mistakes}

<!--
Blueprint validation errors often come from putting a valid property in the
wrong object.
-->

ब्लूप्रिंट वैलिडेशन एरर अक्सर तब आते हैं, जब कोई सही प्रॉपर्टी गलत ऑब्जेक्ट में रख दी जाती है।

<!-- ### Activate a plugin or theme -->

### प्लगइन या थीम एक्टिवेट करना {#activate-a-plugin-or-theme}

<!--
`activate` belongs inside `options`, not inside `pluginData`, `themeData`, or
directly on the step.
-->

`activate` को `options` के अंदर रखें, `pluginData` या `themeData` के अंदर या सीधे स्टेप पर नहीं।

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "gutenberg"
	},
	"options": {
		"activate": true
	}
}
```

<!-- ### Install plugins with the shorthand -->

### शॉर्टहैंड से प्लगइन इंस्टॉल करना {#install-plugins-with-the-shorthand}

<!--
The `plugins` shorthand is a top-level Blueprint property. Do not put it inside
`preferredVersions`.
-->

`plugins` शॉर्टहैंड ब्लूप्रिंट की सबसे ऊपरी लेवल की प्रॉपर्टी है। इसे `preferredVersions` के अंदर न रखें।

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["gutenberg"]
}
```

<!-- ### Use one plugin install shape -->

### प्लगइन इंस्टॉल करने का एक ही तरीका इस्तेमाल करें {#use-one-plugin-install-shape}

<!--
For an `installPlugin` step, use `pluginData`. Do not mix `pluginData` with
older examples or custom objects such as `pluginZipFile`.
-->

`installPlugin` स्टेप के लिए `pluginData` इस्तेमाल करें। `pluginData` को पुराने उदाहरणों या `pluginZipFile` जैसे कस्टम ऑब्जेक्ट के साथ न मिलाएँ।

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	},
	"options": {
		"activate": true
	}
}
```

<!--
The `wordpress.org/plugins` resource needs a separate `slug`. Do not write the
slug into the `resource` value, such as `"wordpress.org/plugins/woocommerce"`.
-->

`wordpress.org/plugins` रिसोर्स के लिए अलग से `slug` देना ज़रूरी है। स्लग को `resource` वैल्यू के अंदर न लिखें, जैसे `"wordpress.org/plugins/woocommerce"`।

<!-- ### Keep `preferredVersions` limited to versions -->

### `preferredVersions` में सिर्फ़ वर्ज़न रखें {#keep-preferredversions-limited-to-versions}

<!--
`preferredVersions` only accepts `php` and `wp`. Use `features` for networking,
`plugins` or `installPlugin` for plugins, and `steps` for ordered setup tasks.
-->

`preferredVersions` सिर्फ़ `php` और `wp` स्वीकार करती है। नेटवर्किंग के लिए `features`, प्लगइन के लिए `plugins` या `installPlugin`, और क्रम से होने वाले सेटअप कामों के लिए `steps` इस्तेमाल करें।

<!-- ### Use explicit steps when order matters -->

### जब क्रम ज़रूरी हो, तो स्टेप साफ़ तौर पर लिखें {#use-explicit-steps-when-order-matters}

<!--
Shorthands such as `plugins`, `login`, `siteOptions`, and `constants` are
expanded before the `steps` array. If one action must happen before another,
write both actions as explicit steps in the order you need.
-->

`plugins`, `login`, `siteOptions` और `constants` जैसे शॉर्टहैंड `steps` ऐरे से पहले स्टेप में बदल दिए जाते हैं। अगर किसी एक काम का दूसरे से पहले होना ज़रूरी है, तो दोनों कामों को साफ़ तौर पर स्टेप के रूप में उसी क्रम में लिखें, जिसमें आपको उनकी ज़रूरत है।
