---
title: ब्लूप्रिंट क्या हैं?
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: जानें कि ब्लूप्रिंट क्या हैं और ये WordPress Playground को कैसे कॉन्फ़िगर करते हैं। तुरंत साइट सेट अप करने के लिए JSON इस्तेमाल करने के फ़ायदे जानें।
---

<!-- # What are Blueprints, and what can you do with them? -->

# ब्लूप्रिंट क्या हैं, और आप इनसे क्या कर सकते हैं?

<!-- With WordPress Playground you can create a whole website, including plugins, themes, content (posts, pages, taxonomy, and comments), settings (site name, users, permalinks, and more), etc. They allow you to generate a WooCommerce store complete with products, a magazine populated with articles, a corporate blog with multiple users, and more. -->

WordPress Playground से आप पूरी वेबसाइट बना सकते हैं, जिसमें प्लगइन, थीम, सामग्री (पोस्ट, पेज, टैक्सोनॉमी और कमेंट), सेटिंग (साइट का नाम, उपयोगकर्ता, पर्मालिंक वगैरह) और भी बहुत कुछ शामिल है। इनकी मदद से आप प्रोडक्ट से भरा WooCommerce स्टोर, लेखों से भरी मैगज़ीन, कई उपयोगकर्ताओं वाला कॉर्पोरेट ब्लॉग और बहुत कुछ बना सकते हैं।

<!-- Blueprints are `JSON` files that you can use to configure Playground instances. -->

ब्लूप्रिंट `JSON` फ़ाइलें हैं, जिनसे आप Playground इंस्टेंस कॉन्फ़िगर कर सकते हैं।

<!-- Blueprints support advanced use cases, like file system and database manipulation, and give you fine-grained control over the instance you create. The WordPress Test Team has been using Playground in [the 6.5 beta release cycle](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), creating a Blueprint that loads the latest version, several testing plugins, and dummy data. -->

ब्लूप्रिंट फ़ाइल सिस्टम और डेटाबेस में बदलाव जैसे एडवांस्ड काम भी कर सकते हैं, और आप जो इंस्टेंस बनाते हैं उस पर आपको बारीकी से नियंत्रण देते हैं। WordPress टेस्ट टीम ने [6.5 बीटा रिलीज़ साइकल](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/) में Playground का इस्तेमाल किया है, और ऐसा ब्लूप्रिंट बनाया है जो नवीनतम वर्ज़न, कई टेस्टिंग प्लगइन और डमी डेटा लोड करता है।

<!-- ## A simple example -->

## एक आसान उदाहरण {#a-simple-example}

<!-- A Blueprint might look something like this: -->

एक ब्लूप्रिंट कुछ ऐसा दिख सकता है:

```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "My Blog",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

<!-- The Blueprint above installs the _Akismet_ and _Gutenberg_ plugins and the _Twenty Nineteen_ theme, sets the site name and description, and enables the WordPress debugging mode. -->

ऊपर दिया गया ब्लूप्रिंट _Akismet_ और _Gutenberg_ प्लगइन और _Twenty Nineteen_ थीम इंस्टॉल करता है, साइट का नाम और विवरण सेट करता है, और WordPress का डीबगिंग मोड चालू करता है।

<!-- ## The benefits of Blueprints -->

## ब्लूप्रिंट के फ़ायदे {#the-benefits-of-blueprints}

<!-- Blueprints are an invaluable tool for building WordPress sites via Playground -->

Playground के ज़रिए WordPress साइट बनाने के लिए ब्लूप्रिंट एक बेहद काम का टूल हैं:

<!--
- **Flexibility**: developers can make granular adjustments to the build process.
- **Consistency**: ensure that every new site starts with the same configuration.
- **Lightweight**: small text files that are easy to store and transfer.
- **Transparency**: A Blueprint includes all the commands needed to build a snapshot of a WordPress site. You can read through it and understand how the site is built.
- **Productivity**: reduces the time-consuming process of manually setting up a new WordPress site. Instead of installing and configuring themes and plugins for each new project, apply a Blueprint and set everything in one process.
- **Up-to-date dependencies**: fetch the latest version of WordPress, a particular plugin, or a theme. Your snapshot is always up to date with the latest features and security fixes.
- **Collaboration**: the `JSON` files are easy to review in tools like GitHub. Share Blueprints with your team or the WordPress community. Allowing others to use your well-configured setup.
- **Experimentation and Learning**: For those new to WordPress or looking to experiment with different configurations, Blueprints provide a safe and easy way to try new setups without "breaking" a live site.
- **WordPress.org integration**: offer a [demo of your plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) in the WordPress plugin directory, or a preview in a [Theme Trac ticket](https://meta.trac.wordpress.org/ticket/7382).
- **Spinning a development environment**: A new developer in the team could download the Blueprint, run a hypothetical `wp up` command, and get a fresh developer environments—loaded with everything they need. The entire CI/CD process can reuse the same Blueprint.
-->

- **लचीलापन**: डेवलपर बिल्ड प्रक्रिया में छोटे से छोटे बदलाव कर सकते हैं।
- **एकरूपता**: पक्का करें कि हर नई साइट एक ही कॉन्फ़िगरेशन से शुरू हो।
- **हल्के**: छोटी टेक्स्ट फ़ाइलें, जिन्हें सहेजना और भेजना आसान है।
- **पारदर्शिता**: एक ब्लूप्रिंट में WordPress साइट का स्नैपशॉट बनाने के लिए ज़रूरी सभी कमांड होती हैं। आप उसे पढ़कर समझ सकते हैं कि साइट कैसे बनी है।
- **उत्पादकता**: नई WordPress साइट को हाथ से सेट अप करने में लगने वाला समय कम होता है। हर नए प्रोजेक्ट के लिए थीम और प्लगइन इंस्टॉल और कॉन्फ़िगर करने के बजाय, एक ब्लूप्रिंट लागू करें और एक ही बार में सब कुछ सेट कर लें।
- **हमेशा अप-टू-डेट डिपेंडेंसी**: WordPress, किसी खास प्लगइन या थीम का नवीनतम वर्ज़न फ़ेच करें। आपका स्नैपशॉट हमेशा नए फ़ीचर और सुरक्षा सुधारों के साथ अप-टू-डेट रहता है।
- **मिलकर काम करना**: `JSON` फ़ाइलों को GitHub जैसे टूल में रिव्यू करना आसान है। अपने ब्लूप्रिंट अपनी टीम या WordPress समुदाय के साथ शेयर करें, ताकि दूसरे भी आपके अच्छी तरह कॉन्फ़िगर किए गए सेटअप का इस्तेमाल कर सकें।
- **प्रयोग और सीखना**: जो लोग WordPress में नए हैं या अलग-अलग कॉन्फ़िगरेशन आज़माना चाहते हैं, उनके लिए ब्लूप्रिंट किसी लाइव साइट को "तोड़े" बिना नए सेटअप आज़माने का सुरक्षित और आसान तरीका हैं।
- **WordPress.org इंटीग्रेशन**: WordPress प्लगइन डायरेक्टरी में [अपने प्लगइन का डेमो](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) दें, या किसी [थीम Trac टिकट](https://meta.trac.wordpress.org/ticket/7382) में प्रीव्यू दें।
- **डेवलपमेंट एनवायरनमेंट तैयार करना**: टीम का कोई नया डेवलपर ब्लूप्रिंट डाउनलोड करके एक काल्पनिक `wp up` कमांड चला सकता है और ज़रूरत की हर चीज़ के साथ एक नया डेवलपमेंट एनवायरनमेंट पा सकता है। पूरी CI/CD प्रक्रिया में भी यही ब्लूप्रिंट दोबारा इस्तेमाल हो सकता है।

<div class="callout callout-info">

<!--
**More Resources**

Visit these links to learn more about the (endless) possibilities of Blueprints:

- [Introduction to WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
- Embed a pre-configured WordPress site in your website using the [WordPress Playground Block](https://wordpress.org/plugins/interactive-code-block/).
- [Blueprints examples](/blueprints/examples)
- [Demos and apps built with Blueprints](/links-and-resources#apps-built-with-wordpress-playground)
-->

**और जानकारी**

ब्लूप्रिंट की (अनगिनत) संभावनाओं के बारे में और जानने के लिए ये लिंक देखें:

- [WordPress Playground का परिचय](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
- [WordPress Playground ब्लॉक](https://wordpress.org/plugins/interactive-code-block/) से अपनी वेबसाइट में पहले से कॉन्फ़िगर की गई WordPress साइट एम्बेड करें।
- [ब्लूप्रिंट के उदाहरण](/blueprints/examples)
- [ब्लूप्रिंट से बने डेमो और ऐप](/links-and-resources#apps-built-with-wordpress-playground)

</div>
