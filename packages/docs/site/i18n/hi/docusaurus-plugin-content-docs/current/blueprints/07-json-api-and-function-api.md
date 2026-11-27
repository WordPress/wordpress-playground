---
title: API में एकरूपता
slug: /blueprints/steps/api-consistency
description: जानें कि ब्लूप्रिंट का JSON फ़ॉर्मेट, स्टेप चलाने वाले JavaScript फ़ंक्शन API से कैसे जुड़ा है।
---

<!-- # JSON API and Function API -->

# JSON API और Function API

<!-- Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly. -->

ब्लूप्रिंट JSON फ़ॉर्मेट में लिखे जाते हैं, लेकिन स्टेप चलाने के लिए अंदर JavaScript फ़ंक्शन इस्तेमाल होते हैं। ब्लूप्रिंट के साथ काम करने का सबसे आसान तरीका JSON है, लेकिन आप अंदर के इन फ़ंक्शन को सीधे भी इस्तेमाल कर सकते हैं।

<!-- JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name): -->

JSON इन फ़ंक्शन के ऊपर बस एक परत है। आप JSON स्टेप इस्तेमाल करें या एक्सपोर्ट किए गए फ़ंक्शन, आपको एक जैसे पैरामीटर ही देने होंगे (स्टेप के नाम को छोड़कर):

<!-- You can use Blueprints both with the web and the node.js versions of WordPress Playground. -->

आप ब्लूप्रिंट को WordPress Playground के वेब वर्ज़न और node.js वर्ज़न, दोनों के साथ इस्तेमाल कर सकते हैं।

<div class="callout callout-info">

<!--
**Blueprints version 2**

The team is exploring ways to transition Blueprints from a TypeScript library to a PHP library. This would allow people to run Blueprints in any WordPress environment: Playground, a hosted site, or a local setup.

The proposed [new specification](https://github.com/WordPress/blueprints-library/issues/6) is discussed on a separate [GitHub repository](https://github.com/WordPress/blueprints-library/), and you’re more than welcome to join (there or on the [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) Slack channel) and help shape the next generation of Playground.
-->

**ब्लूप्रिंट वर्ज़न 2**

टीम ब्लूप्रिंट को TypeScript लाइब्रेरी से PHP लाइब्रेरी में बदलने के तरीके खोज रही है। इससे लोग किसी भी WordPress एनवायरनमेंट में ब्लूप्रिंट चला सकेंगे: Playground, होस्ट की गई साइट या लोकल सेटअप।

प्रस्तावित [नए स्पेसिफ़िकेशन](https://github.com/WordPress/blueprints-library/issues/6) पर एक अलग [GitHub रिपॉज़िटरी](https://github.com/WordPress/blueprints-library/) में चर्चा हो रही है। आप वहाँ (या [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) Slack चैनल पर) ज़रूर जुड़ें और Playground की अगली पीढ़ी को आकार देने में मदद करें।

</div>

<!-- ## Differences between JSON and Function APIs -->

## JSON और Function API के बीच अंतर {#differences-between-json-and-function-apis}

<!-- There are two main differences between the JSON and Function APIs: -->

JSON और Function API के बीच दो मुख्य अंतर हैं:

<!--
1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself.
2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment.
-->

1. ब्लूप्रिंट आपके लिए प्रोग्रेस बार और एरर रिपोर्टिंग संभालते हैं। Function API में आपको ये खुद संभालने होते हैं।
2. Function API के लिए API क्लाइंट लाइब्रेरी इम्पोर्ट करनी पड़ती है, जबकि ब्लूप्रिंट को बस URL फ़्रैगमेंट में पेस्ट किया जा सकता है।

<div class="callout callout-info">

<!-- Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic. -->

इस विषय पर ज़्यादा जानकारी के लिए [wordpress-playground](https://github.com/WordPress/wordpress-playground) रिपॉज़िटरी में [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) देखें।

</div>
