---
title: शुरुआत करें
slug: /blueprints/getting-started
description: ब्लूप्रिंट की क्विक स्टार्ट गाइड। जानें कि ये किन समस्याओं को हल करते हैं और इन्हें इस्तेमाल करना किन-किन तरीकों से शुरू किया जा सकता है।
---

<!-- # Getting started with Blueprints -->

# ब्लूप्रिंट के साथ शुरुआत

<!-- Blueprints are JSON files for setting up your very own WordPress Playground instance. For example: -->

ब्लूप्रिंट JSON फ़ाइलें होती हैं, जिनसे आप अपना खुद का WordPress Playground इंस्टेंस सेट अप करते हैं। उदाहरण के लिए:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}
```

<!-- There are three ways to use Blueprints: -->

ब्लूप्रिंट इस्तेमाल करने के तीन तरीके हैं:

<!--
-   [Paste a Blueprint into the URL "fragment" on WordPress Playground website](/blueprints/using-blueprints#url-fragment).
-   [Use them with the JavaScript API](/blueprints/using-blueprints#javascript-api).
-   [Reference a blueprint JSON file via QueryParam blueprint-url](/developers/apis/query-api/)
-->

-   [WordPress Playground वेबसाइट पर URL के "फ़्रैगमेंट" में ब्लूप्रिंट पेस्ट करें](/blueprints/using-blueprints#url-fragment)।
-   [इन्हें JavaScript API के साथ इस्तेमाल करें](/blueprints/using-blueprints#javascript-api)।
-   [QueryParam blueprint-url के ज़रिए किसी ब्लूप्रिंट JSON फ़ाइल का रेफ़रेंस दें](/developers/apis/query-api/)

<!-- ## What problems are solved by Blueprints? -->

## ब्लूप्रिंट किन समस्याओं को हल करते हैं? {#what-problems-are-solved-by-blueprints}

<!-- ### No coding skills required -->

### कोडिंग जानना ज़रूरी नहीं {#no-coding-skills-required}

<!-- Blueprints are just JSON. You don't need a development environment, any libraries, or even JavaScript knowledge. You can write them in any text editor. -->

ब्लूप्रिंट सिर्फ़ JSON होते हैं। आपको डेवलपमेंट एनवायरनमेंट, किसी लाइब्रेरी या JavaScript की जानकारी तक की ज़रूरत नहीं है। आप इन्हें किसी भी टेक्स्ट एडिटर में लिख सकते हैं।

<!-- However, if you do have a development environment, that's great! You can use the [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) to get autocompletion and validation. -->

फिर भी, अगर आपके पास डेवलपमेंट एनवायरनमेंट है, तो बहुत अच्छी बात है! ऑटोकम्प्लीशन और वैलिडेशन के लिए आप [ब्लूप्रिंट JSON स्कीमा](https://playground.wordpress.net/blueprint-schema.json) का इस्तेमाल कर सकते हैं।

<!-- ### HTTP Requests are managed for you -->

### HTTP रिक्वेस्ट आपके लिए संभाली जाती हैं {#http-requests-are-managed-for-you}

<!-- Blueprints fetch any resources you declare for you. You don't have to worry about managing multiple `fetch()` calls or waiting for them to finish. You can just declare a few links and let Blueprints handle and optimize the downloading pipeline. -->

आप जो भी रिसोर्स घोषित करते हैं, ब्लूप्रिंट उन्हें आपके लिए फ़ेच करते हैं। आपको कई `fetch()` कॉल संभालने या उनके पूरे होने का इंतज़ार करने की चिंता नहीं करनी पड़ती। बस कुछ लिंक घोषित करें, और डाउनलोड की पूरी प्रक्रिया को संभालने और बेहतर बनाने का काम ब्लूप्रिंट पर छोड़ दें।

<!-- ### You can link to a Blueprint-preconfigured Playground -->

### आप ब्लूप्रिंट से पहले से कॉन्फ़िगर किए गए Playground का लिंक दे सकते हैं {#you-can-link-to-a-blueprint-preconfigured-playground}

<!-- Because Blueprints can be pasted in the URL, you can embed or link to a Playground with a specific configuration. For example, clicking this button will open a Playground with PHP 8.3 and a pendant theme installed: -->

ब्लूप्रिंट को URL में पेस्ट किया जा सकता है, इसलिए आप किसी खास कॉन्फ़िगरेशन वाले Playground को एम्बेड कर सकते हैं या उसका लिंक दे सकते हैं। उदाहरण के लिए, इस बटन पर क्लिक करने से PHP 8.3 और pendant थीम इंस्टॉल किया हुआ एक Playground खुलेगा:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
  		"wp": "latest"
	},
	"steps": [
        {
            "step": "installTheme",
            "themeData": {
                "resource": "wordpress.org/themes",
            	"slug": "pendant"
            },
            "options": {
                "activate": true
            }
        }
	]
}} />

<!-- ### Trusted by default -->

### शुरू से ही भरोसेमंद {#trusted-by-default}

<!-- Blueprints are just JSON. Running other people's Blueprints doesn't require the element of trust. Since Blueprints cannot execute arbitrary JavaScript, they are limited in what they can do. -->

ब्लूप्रिंट सिर्फ़ JSON होते हैं। दूसरों के ब्लूप्रिंट चलाने के लिए उन पर भरोसा करने की ज़रूरत नहीं होती। ब्लूप्रिंट मनमाना JavaScript नहीं चला सकते, इसलिए वे जो कर सकते हैं उसकी सीमा तय है।

<!-- With Blueprints, WordPress.org plugin directory may be able to offer live previews of plugins. Plugin authors will just write a custom Blueprint to preconfigure the Playground instance with any site options or starter content they may need. -->

ब्लूप्रिंट की मदद से WordPress.org प्लगइन डायरेक्टरी प्लगइन के लाइव प्रीव्यू दे सकती है। प्लगइन लेखकों को बस एक कस्टम ब्लूप्रिंट लिखना होगा, जो Playground इंस्टेंस को उनकी ज़रूरत के साइट विकल्पों या शुरुआती सामग्री के साथ पहले से कॉन्फ़िगर कर दे।

<!-- ### Write it once, use it anywhere -->

### एक बार लिखें, कहीं भी इस्तेमाल करें {#write-it-once-use-it-anywhere}

<!-- Blueprints work both on the web and in node.js. You can run them both in the same JavaScript process, and through a remote Playground Client. They are the universal language of configuration. Where you can run Playground, you can use Blueprints. -->

ब्लूप्रिंट वेब पर भी काम करते हैं और node.js में भी। आप इन्हें उसी JavaScript प्रोसेस में भी चला सकते हैं और किसी रिमोट Playground Client के ज़रिए भी। ये कॉन्फ़िगरेशन की एक सार्वभौमिक भाषा हैं। जहाँ भी आप Playground चला सकते हैं, वहाँ ब्लूप्रिंट इस्तेमाल कर सकते हैं।
