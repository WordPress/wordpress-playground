---
title: क्विक स्टार्ट गाइड
slug: /quick-start-guide
description: Playground से शुरुआत करने के लिए 5 मिनट की गाइड। प्लगइन का परीक्षण करना, थीम आज़माना और अलग-अलग WP/PHP संस्करणों का उपयोग करना सीखें।
---

<!-- # Start using WordPress Playground in 5 minutes -->

# 5 मिनट में WordPress Playground का उपयोग शुरू करें

<!-- WordPress Playground can help you with any of the following: -->

WordPress Playground नीचे दिए गए किसी भी काम में आपकी मदद कर सकता है:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI. -->

यह पेज इनमें से हर काम में आपका मार्गदर्शन करेगा। और अगर आप देखकर बेहतर सीखते हैं, तो यह रहा एक वीडियो। वीडियो में इंटरफ़ेस की कुछ बातें Dock के आने से पहले की हैं, इसलिए मौजूदा UI के लिए नीचे लिखे चरणों का पालन करें।

<iframe width="752" height="423.2" title="WordPress Playground के साथ शुरुआत" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!-- ## Start a new WordPress site -->

## नई WordPress साइट शुरू करें {#start-a-new-wordpress-site}

<!-- Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser. -->

अपने ब्राउज़र में WordPress शुरू करने के लिए [playground.wordpress.net पर आधिकारिक डेमो](https://playground.wordpress.net/) खोलें।

<!-- You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site. -->

आप पेज बना सकते हैं, प्लगइन अपलोड कर सकते हैं, थीम इंस्टॉल कर सकते हैं, सामग्री आयात कर सकते हैं, और वे ज़्यादातर काम कर सकते हैं जो आप किसी सामान्य WordPress साइट पर करते हैं।

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

जब ब्राउज़र स्टोरेज उपलब्ध होता है, तो नए Playground अपने-आप सहेजे जाते हैं। Dock में **Your Playgrounds** से आप हाल के अधिकतम पाँच ऑटोसेव देख सकते हैं। अगर आपको ऐसी साइट चाहिए जो रिफ़्रेश करने पर हट जाए, तो Playground को `?storage=temp` के साथ खोलें।

<div class="callout callout-info">

<!-- **WordPress Playground is private** -->

**WordPress Playground निजी है**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

Playground आपके ब्राउज़र में ही लोकल रूप से चलता है। जब तक आप **Export to GitHub** जैसा कोई विकल्प नहीं चुनते, यह आपकी साइट को कहीं अपलोड नहीं करता। काम पूरा होने पर आप Playground को स्थायी रूप से सहेज सकते हैं, उसे ZIP के रूप में निर्यात कर सकते हैं, या **New Playground** से फिर से शुरू कर सकते हैं।

</div>

<!-- ## Try a block, a theme, or a plugin -->

## कोई ब्लॉक, थीम या प्लगइन आज़माएँ {#try-a-block-a-theme-or-a-plugin}

<!-- You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/). -->

आप [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/) में कोई भी प्लगइन या थीम अपलोड कर सकते हैं।

<!-- To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL: -->

कुछ क्लिक बचाने के लिए, आप URL में `plugin` या `theme` पैरामीटर जोड़कर WordPress प्लगइन डायरेक्टरी से प्लगइन या थीम पहले से इंस्टॉल कर सकते हैं। उदाहरण के लिए, coblocks प्लगइन इंस्टॉल करने के लिए आप यह URL इस्तेमाल कर सकते हैं:

https://playground.wordpress.net/?plugin=coblocks

<!-- Or this URL to preinstall the `pendant` theme: -->

या `pendant` थीम पहले से इंस्टॉल करने के लिए यह URL:

https://playground.wordpress.net/?theme=pendant

<!-- In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters: -->

अगर आप कई थीम और प्लगइन इंस्टॉल करना चाहते हैं, तो `theme` या `plugin` पैरामीटर को दोहराया जा सकता है:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!-- You can also mix and match these parameters and even add multiple plugins: -->

आप इन पैरामीटर को आपस में मिला भी सकते हैं और कई प्लगइन भी जोड़ सकते हैं:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!-- This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/). -->

इसे [Query API](/developers/apis/query-api/) कहते हैं, और इसके बारे में आप [यहाँ](/developers/apis/query-api/) और जान सकते हैं।

<!-- ## Store a Playground in browser storage -->

## Playground को ब्राउज़र स्टोरेज में सहेजें {#store-a-playground-in-browser-storage}

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

**Store permanently** खोलने के लिए Dock में **Autosaved** या **Unsaved** स्टेटस पर क्लिक करें, फिर **Save in browser storage** चुनें।

![Store permanently पैन, जिसमें ब्राउज़र स्टोरेज चुना गया है](/img/dock/store-permanently-browser.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

ब्राउज़र में सहेजा गया Playground **Your Playgrounds** में दिखता है। ऑटोसेव भी वहीं दिखते हैं, लेकिन Playground हाल के अधिकतम पाँच ऑटोसेव ही रखता है। अगर आप किसी Playground को ऑटोसेव की इस सीमा से आगे भी रखना चाहते हैं, तो उसे स्थायी रूप से सहेजें।

<!-- Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later. -->

ब्राउज़र स्टोरेज फिर भी ब्राउज़र का ही हिस्सा है। जब आपको ऐसी फ़ाइल चाहिए जिसे आप कहीं और ले जा सकें, संग्रहित कर सकें या बाद में पुनर्स्थापित कर सकें, तो ZIP निर्यात करें।

<!-- ## Export a portable ZIP -->

## पोर्टेबल ZIP निर्यात करें {#export-a-portable-zip}

<!-- Open **Export** from the Dock and use **Download as .zip**. -->

Dock से **Export** खोलें और **Download as .zip** का उपयोग करें।

![ZIP, सेटअप लिंक और GitHub विकल्पों वाला Export पैन](/img/dock/dock-export-playground.webp)

<!-- The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite. -->

निर्यात की गई फ़ाइल में मौजूदा फ़ाइलें, डेटाबेस, प्लगइन, थीम, अपलोड और बदलाव शामिल होते हैं। आप इसे Playground में पुनर्स्थापित कर सकते हैं या PHP और SQLite सपोर्ट करने वाले किसी सर्वर पर होस्ट कर सकते हैं।

<!-- The SQLite database is included in `wp-content/database/`. When this directory contains `db-path.php`, that file returns the database path inside a randomized subdirectory. Older sites use `wp-content/database/.ht.sqlite`. Keep the whole `database` directory together when copying a site. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager. -->

SQLite डेटाबेस `wp-content/database/` में शामिल होता है। अगर इस डायरेक्टरी में `db-path.php` है, तो वह फ़ाइल एक रैंडम नाम वाली सबडायरेक्टरी के अंदर डेटाबेस का पाथ बताती है। पुरानी साइटें `wp-content/database/.ht.sqlite` का उपयोग करती हैं। साइट कॉपी करते समय पूरी `database` डायरेक्टरी को एक साथ रखें। ज़्यादातर ऑपरेटिंग सिस्टम पर डॉट से शुरू होने वाली फ़ाइलें डिफ़ॉल्ट रूप से छिपी रहती हैं, इसलिए आपको अपने फ़ाइल मैनेजर में छिपी फ़ाइलें दिखाने का विकल्प चालू करना पड़ सकता है।

<!-- ## Restore a ZIP -->

## ZIP पुनर्स्थापित करें {#restore-a-zip}

<!-- Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file. -->

Dock से **New Playground** खोलें, **Import zip** चुनें और अपनी ZIP फ़ाइल चुनें।

![New Playground पैन, जिसमें Import zip चुना गया है](/img/dock/dock-new-playground-import-zip.webp)

<!-- This restores the files and database from the ZIP into a new Playground. -->

इससे ZIP की फ़ाइलें और डेटाबेस एक नए Playground में पुनर्स्थापित हो जाते हैं।

<!-- ## Use a specific WordPress or PHP version -->

## कोई खास WordPress या PHP संस्करण इस्तेमाल करें {#use-a-specific-wordpress-or-php-version}

<!-- Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options. -->

WordPress, PHP, भाषा, मल्टीसाइट और नेटवर्किंग विकल्प चुनने के लिए Dock से **Site Settings** खोलें।

![Site Settings पैन](/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!-- **Test your plugin or theme** -->

**अपने प्लगइन या थीम का परीक्षण करें**

<!-- Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage! -->

इतने सारे WordPress और PHP संस्करणों के साथ संगतता परीक्षण करना हमेशा मुश्किल रहा है। WordPress Playground इस काम को बेहद आसान बना देता है, इसका पूरा फ़ायदा उठाएँ!

</div>

<!-- You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded: -->

सही संस्करण पहले से लोड करके Playground खोलने के लिए आप `wp` और `php` [क्वेरी पैरामीटर](/developers/apis/query-api) का भी उपयोग कर सकते हैं:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!-- This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/). -->

इसे [Query API](/developers/apis/query-api/) कहते हैं, और इसके बारे में आप [यहाँ](/developers/apis/query-api/) और जान सकते हैं।

<!-- Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html). -->

php-src की डेवलपमेंट ब्रांच से बने अगले PHP संस्करण को आज़माने के लिए `php=next` का उपयोग करें। उदाहरण के लिए, [PHP 8.6 फ़ीचर प्रीव्यू](https://playground.wordpress.net/php-8-6.html) देखें।

<!-- To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo). -->

डेमो के लिए सामग्री तैयार करने के बारे में और जानने के लिए [अपने डेमो के लिए सामग्री तैयार करने की गाइड](/guides/providing-content-for-your-demo) देखें।

<div class="callout callout-info">

<!-- **Major versions only** -->

**केवल मुख्य संस्करण**

<!-- You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions. -->

आप `wp=6.2` या `php=8.1` जैसे मुख्य संस्करण बता सकते हैं, और आपको उस शृंखला की सबसे नई रिलीज़ मिलेगी। लेकिन आप पुराने माइनर संस्करण नहीं माँग सकते, इसलिए न `wp=6.1.2` काम करेगा और न `php=7.4.9`। `latest` और `next` जैसे सामान्य उपनाम इसके अपवाद हैं।

</div>

<!-- ## Import a WXR file -->

## WXR फ़ाइल आयात करें {#import-a-wxr-file}

<!-- You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php). -->

आप [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php) में WXR फ़ाइल अपलोड करके WordPress की निर्यात फ़ाइल आयात कर सकते हैं।

<!-- You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more. -->

आप [JSON Blueprints](/blueprints) का भी उपयोग कर सकते हैं। ज़्यादा जानने के लिए [Blueprints से शुरुआत](/blueprints/getting-started) देखें।

<!-- This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground. -->

यह Playground ZIP को पुनर्स्थापित करने से अलग है। WXR फ़ाइल किसी मौजूदा साइट में WordPress सामग्री आयात करती है। Playground ZIP फ़ाइलों और डेटाबेस को एक नए Playground में पुनर्स्थापित करता है।

<!-- ## Build apps with WordPress Playground -->

## WordPress Playground से ऐप बनाएँ {#build-apps-with-wordpress-playground}

<!-- WordPress Playground is programmable, which means you can [build WordPress apps](https://developer.wordpress.org/playground/developers/build-an-app/), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/). -->

WordPress Playground को प्रोग्राम किया जा सकता है, यानी आप [WordPress ऐप बना सकते हैं](https://developer.wordpress.org/playground/developers/build-an-app/), प्लगइन डेमो तैयार कर सकते हैं, और इसे बिना किसी सेटअप वाले [लोकल डेवलपमेंट एनवायरनमेंट](/developers/local-development/) के रूप में भी इस्तेमाल कर सकते हैं।

<!-- To learn more about developing with WordPress Playground, check out the [development quick start](https://developer.wordpress.org/playground/developers/build-an-app/) section. -->

WordPress Playground के साथ डेवलपमेंट के बारे में और जानने के लिए [डेवलपमेंट क्विक स्टार्ट](https://developer.wordpress.org/playground/developers/build-an-app/) सेक्शन देखें।
