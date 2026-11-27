---
title: परिचय
slug: /blueprints
id: introduction
description: ब्लूप्रिंट डॉक्यूमेंटेशन का मुख्य परिचय। जानें कि डॉक्स कैसे व्यवस्थित हैं और मुख्य सेक्शन कहाँ मिलेंगे।
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<!-- # Blueprints Docs -->

# ब्लूप्रिंट डॉक्स

<div class="callout callout-tip">

<!-- Check the [Blueprints Gallery](https://wordpress.github.io/blueprints/) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups. -->

अलग-अलग सेटअप वाली WordPress साइट लॉन्च करने के लिए WordPress Playground के इस्तेमाल के असली कोड उदाहरण देखने के लिए [ब्लूप्रिंट गैलरी](https://wordpress.github.io/blueprints/) देखें।

</div>

<!-- Hi! Welcome to WordPress Playground Blueprints documentation. -->

नमस्ते! WordPress Playground ब्लूप्रिंट डॉक्यूमेंटेशन में आपका स्वागत है।

<!-- Blueprints are JSON files for setting up your very own WordPress Playground instance. This subsite (Blueprints Docs) is where you will find all the information you need to use Blueprints. -->

ब्लूप्रिंट JSON फ़ाइलें होती हैं, जिनसे आप अपना खुद का WordPress Playground इंस्टेंस सेट अप करते हैं। इस सब-साइट (Blueprints Docs) में आपको ब्लूप्रिंट इस्तेमाल करने के लिए ज़रूरी सारी जानकारी मिलेगी।

<p class="docs-hubs">WordPress Playground दस्तावेज़ 4 अलग-अलग हब (सब-साइट्स) में विभाजित हैं:</p>

<!--
<p class="docs-hubs">The WordPress Playground documentation is distributed across four separate hubs (subsites):</p>
- [**Documentation**](/) – Introduction to WP Playground, starter guides and your entry point to WP Playground Docs.
- 👉 [**Blueprints**](/blueprints) (you're here) – Blueprints are JSON files for setting up your WordPress Playground instance. Learn about their possibilities from this Blueprints docs hub.
- [**Developers**](/developers) – WordPress Playground was created as a programmable tool. Discover all the things you can do with it from your code in the Developers docs hub.
- [**API Reference**](/api) – All the APIs exposed by WordPress Playground
-->

- [**Documentation**](/): WP Playground का परिचय, शुरुआती गाइड और WP Playground डॉक्स के लिए आपका प्रवेश बिंदु।
- 👉 [**Blueprints**](/blueprints) (आप यहाँ हैं): ब्लूप्रिंट JSON फ़ाइलें हैं, जिनसे आप अपना WordPress Playground इंस्टेंस सेट अप करते हैं। इस Blueprints डॉक्स हब में जानें कि इनसे क्या-क्या किया जा सकता है।
- [**Developers**](/developers): WordPress Playground को एक प्रोग्रामेबल टूल के रूप में बनाया गया है। Developers डॉक्स हब में जानें कि आप अपने कोड से इसके साथ क्या-क्या कर सकते हैं।
- [**API Reference**](/api): WordPress Playground द्वारा उपलब्ध कराए गए सभी API

<!-- ## Navigating the Blueprints documentation hub -->

## ब्लूप्रिंट डॉक्यूमेंटेशन हब में नेविगेट करना {#navigating-the-blueprints-documentation-hub}

<!-- This docs hub is focused on Blueprints info and is divided into the following major sections: -->

यह डॉक्स हब ब्लूप्रिंट की जानकारी पर केंद्रित है और इन मुख्य सेक्शन में बँटा है:

<!-- - [Getting started with Blueprints](/blueprints/getting-started): Quick Start Guide to setting up a WordPress Playground instance using Blueprint JSON files. -->

- [ब्लूप्रिंट के साथ शुरुआत](/blueprints/getting-started): ब्लूप्रिंट JSON फ़ाइलों से WordPress Playground इंस्टेंस सेट अप करने की क्विक स्टार्ट गाइड।

<!-- - [Tutorial - Blueprints 101](/blueprints/tutorial) - Blueprints API crash course. The tutorial will guide you through the complete process of creating a blueprint that loads a theme and plugin (among other things). -->

- [ट्यूटोरियल: ब्लूप्रिंट 101](/blueprints/tutorial): ब्लूप्रिंट API का क्रैश कोर्स। यह ट्यूटोरियल आपको ऐसा ब्लूप्रिंट बनाने की पूरी प्रक्रिया से गुज़ारेगा जो (दूसरी चीज़ों के साथ) एक थीम और प्लगइन लोड करता है।

<!-- - [Blueprint data Format](/blueprints/data-format): Blueprint JSON files define your Playground instance with various properties. This section highlights the key properties you need to know. -->

- [ब्लूप्रिंट डेटा फ़ॉर्मेट](/blueprints/data-format): ब्लूप्रिंट JSON फ़ाइलें कई प्रॉपर्टी की मदद से आपके Playground इंस्टेंस को परिभाषित करती हैं। यह सेक्शन उन मुख्य प्रॉपर्टी के बारे में बताता है जिन्हें आपको जानना चाहिए।

<!-- - [Using Blueprints](/blueprints/using-blueprints): Learn in this section different ways to use Blueprints. -->

- [ब्लूप्रिंट का इस्तेमाल](/blueprints/using-blueprints): इस सेक्शन में ब्लूप्रिंट इस्तेमाल करने के अलग-अलग तरीके जानें।

<!-- - [Steps](/blueprints/steps): API Reference of all the available steps that can be set in a blueprint to run tasks such as login, plugin/theme activation, file operations, and more. -->

- [स्टेप](/blueprints/steps): उन सभी उपलब्ध स्टेप का API रेफ़रेंस, जिन्हें ब्लूप्रिंट में लॉगिन, प्लगइन/थीम सक्रिय करने, फ़ाइल ऑपरेशन जैसे कामों के लिए सेट किया जा सकता है।

<!-- - [Blueprint Bundles](/blueprints/bundles): Learn how to create and use Blueprint bundles - self-contained packages that include a Blueprint and all its resources. -->

- [ब्लूप्रिंट बंडल](/blueprints/bundles): जानें कि ब्लूप्रिंट बंडल कैसे बनाएँ और इस्तेमाल करें। ये ऐसे पूरे पैकेज होते हैं जिनमें एक ब्लूप्रिंट और उसके सभी रिसोर्स शामिल होते हैं।

<!-- - [Examples](/blueprints/examples): Compilation of Blueprint examples for various WordPress Playground setups, including installing themes/plugins, running PHP code, enabling features, and loading specific WordPress versions. -->

- [उदाहरण](/blueprints/examples): WordPress Playground के अलग-अलग सेटअप के लिए ब्लूप्रिंट उदाहरणों का संग्रह, जिसमें थीम/प्लगइन इंस्टॉल करना, PHP कोड चलाना, फ़ीचर चालू करना और WordPress के खास वर्ज़न लोड करना शामिल है।

<!-- - [Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug): Tips and tools for troubleshooting and debugging Blueprints. -->

- [ब्लूप्रिंट की समस्याएँ हल करना और डीबग करना](/blueprints/troubleshoot-and-debug): ब्लूप्रिंट की समस्याएँ हल करने और उन्हें डीबग करने के सुझाव और टूल।
