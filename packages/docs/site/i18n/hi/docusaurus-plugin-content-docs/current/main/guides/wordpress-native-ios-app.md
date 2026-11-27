---
title: नेटिव iOS ऐप में WordPress Playground
slug: /guides/wordpress-native-ios-app
description: Playground से बने "Blocknotes" ऐप की केस स्टडी के आधार पर जानें कि किसी नेटिव iOS ऐप के अंदर WordPress साइट कैसे चलाई जाती है।
---

<!-- ## How to ship a real WordPress site in a native iOS app via Playground? -->

## Playground के ज़रिए किसी नेटिव iOS ऐप में असली WordPress साइट कैसे शिप करें? {#how-to-ship-a-real-wordpress-site-in-a-native-ios-app-via-playground}

<!-- Blocknotes is the first iOS application that ran WordPress natively on iOS devices by leveraging WordPress Playground. Developed by [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), a core committer for WordPress, Blocknotes represents a significant leap in the capabilities of mobile applications by utilizing WebAssembly to run WordPress without the need for a traditional PHP server. -->

Blocknotes पहला iOS ऐप है, जिसने WordPress Playground की मदद से iOS डिवाइस पर WordPress को नेटिव रूप से चलाया। इसे WordPress की कोर कमिटर [Ella van Durpe](https://profiles.wordpress.org/ellatrix/) ने बनाया है। Blocknotes पारंपरिक PHP सर्वर के बिना WordPress चलाने के लिए WebAssembly का उपयोग करता है, और यह मोबाइल ऐप की क्षमताओं में एक बड़ी छलांग है।

<!-- This case study explores the features, technical implementation, and potential implications of Blocknotes for the future of mobile and web development. -->

यह केस स्टडी Blocknotes के फ़ीचर, उसके तकनीकी इम्प्लीमेंटेशन और मोबाइल व वेब डेवलपमेंट के भविष्य पर उसके संभावित असर को समझाती है।

<!-- **Important!** The current version of Blocknotes isn’t running WordPress Playground anymore. Since the initial release, the app was rewritten to only use the WordPress block editor without the rest of WordPress. This case study covers the early versions of Blocknotes that opened an entire world of new possibilities for WordPress. -->

**महत्वपूर्ण!** Blocknotes का मौजूदा संस्करण अब WordPress Playground पर नहीं चलता। पहली रिलीज़ के बाद ऐप को दोबारा लिखा गया, ताकि वह बाकी WordPress के बिना सिर्फ़ WordPress ब्लॉक एडिटर का उपयोग करे। यह केस स्टडी Blocknotes के शुरुआती संस्करणों के बारे में है, जिन्होंने WordPress के लिए संभावनाओं की एक पूरी नई दुनिया खोल दी।

<!-- ## Blocknotes features -->

## Blocknotes के फ़ीचर {#blocknotes-features}

<!-- Blocknotes allows users to create and edit notes using the WordPress block editor. The notes are automatically saved as HTML files to the user’s iCloud Drive and seamlessly synchronized across devices. -->

Blocknotes में उपयोगकर्ता WordPress ब्लॉक एडिटर से नोट बना और संपादित कर सकते हैं। नोट अपने-आप HTML फ़ाइलों के रूप में उपयोगकर्ता की iCloud Drive में सहेजे जाते हैं और सभी डिवाइस पर आसानी से सिंक हो जाते हैं।

<!-- ## Technical Implementation -->

## तकनीकी इम्प्लीमेंटेशन {#technical-implementation}

<!-- Blocknotes operated as a WebView running an HTML page where a WebAssembly version of PHP was running WordPress. That HTML page was packaged as a native iOS app via [Capacitor](https://capacitorjs.com/). This setup allowed WordPress to function in environments traditionally not supported. -->

Blocknotes एक WebView के रूप में चलता था, जिसमें एक HTML पेज खुलता था और उस पेज में PHP का WebAssembly संस्करण WordPress चला रहा था। उस HTML पेज को [Capacitor](https://capacitorjs.com/) की मदद से नेटिव iOS ऐप के रूप में पैक किया गया था। इस सेटअप से WordPress उन एनवायरनमेंट में भी काम कर सका, जहाँ आम तौर पर यह समर्थित नहीं होता।

<!-- In the [Blocknotes GitHub repository](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) you can review the last Playground-based release. Here are the most important parts: -->

[Blocknotes की GitHub रिपॉज़िटरी](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) में आप Playground पर आधारित आख़िरी रिलीज़ देख सकते हैं। इसके सबसे ज़रूरी हिस्से ये हैं:

<!-- - [A WordPress build](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (packaged as a `.data` file).
- [Static WordPress assets](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
- [A WebAssembly build of PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) (via [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
- [A web worker running PHP and WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
- [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress plugin ([installed here](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) to turn wp-admin into a note-taking app.
- A layer to [load WordPress posts from iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) and [save changes as iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js). -->

- [एक WordPress बिल्ड](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (`.data` फ़ाइल के रूप में पैक किया गया)।
- [WordPress के स्टैटिक एसेट](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public)।
- [PHP का एक WebAssembly बिल्ड](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) ([@php-wasm/web](https://npmjs.com/package/@php-wasm/web) के ज़रिए)।
- [PHP और WordPress चलाने वाला एक वेब वर्कर](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js)।
- [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress प्लगइन ([यहाँ इंस्टॉल किया गया](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)), जो wp-admin को नोट लेने वाले ऐप में बदल देता है।
- [iOS फ़ाइलों से WordPress पोस्ट लोड करने](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) और [बदलावों को iOS फ़ाइलों के रूप में सहेजने](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js) के लिए एक लेयर।

<!-- ## Building your own iOS app with WordPress Playground -->

## WordPress Playground के साथ अपना iOS ऐप बनाना {#building-your-own-ios-app-with-wordpress-playground}

<!-- Although Blocknotes proved releasing a WordPress-based iOS app is possible, this is still a highly exploratory area. There are no established workflows, libraries, or knowledge bases. -->

Blocknotes ने भले ही साबित कर दिया कि WordPress पर आधारित iOS ऐप रिलीज़ करना संभव है, फिर भी यह क्षेत्र अभी काफ़ी हद तक खोजबीन के दौर में है। इसके लिए अभी कोई तय वर्कफ़्लो, लाइब्रेरी या नॉलेज बेस नहीं हैं।

<!-- The best documentation we have is the Blocknotes repository. Use it as a reference and a starting point for exploring your new app. Review the key components like the WebAssembly build of PHP, the integration of the WordPress block editor, and how web workers are utilized to run WordPress efficiently. By dissecting these elements, you can gain insights into building your own iOS app with WordPress Playground, pushing the boundaries of what’s possible with mobile web applications. -->

हमारे पास सबसे अच्छा दस्तावेज़ Blocknotes रिपॉज़िटरी ही है। अपने नए ऐप पर काम शुरू करते समय इसे संदर्भ और शुरुआती बिंदु की तरह उपयोग करें। इसके मुख्य हिस्सों को देखें, जैसे PHP का WebAssembly बिल्ड, WordPress ब्लॉक एडिटर का इंटीग्रेशन, और यह कि WordPress को कुशलता से चलाने के लिए वेब वर्कर का उपयोग कैसे किया गया है। इन हिस्सों को बारीकी से समझकर आप WordPress Playground के साथ अपना iOS ऐप बनाने की समझ हासिल कर सकते हैं और मोबाइल वेब ऐप में जो संभव है, उसकी सीमाओं को आगे बढ़ा सकते हैं।

<!-- As you navigate this innovative space, share your findings and challenges with the Playground team and the broader WordPress community. Publishing your learnings will not only aid in your development but also contribute to a collective knowledge base, driving forward the future of WordPress on mobile. -->

इस नए क्षेत्र में आगे बढ़ते हुए अपनी खोजें और चुनौतियाँ Playground टीम और पूरे WordPress समुदाय के साथ साझा करें। अपनी सीख प्रकाशित करने से न सिर्फ़ आपके डेवलपमेंट में मदद मिलेगी, बल्कि एक साझा नॉलेज बेस भी बनेगा, जो मोबाइल पर WordPress के भविष्य को आगे ले जाएगा।

<!-- ## Potential and the future -->

## संभावनाएँ और भविष्य {#potential-and-the-future}

<!-- Blocknotes paves the way for a new generation of applications that are more accessible, flexible, and powerful. -->

Blocknotes ऐसे ऐप की नई पीढ़ी का रास्ता खोलता है, जो ज़्यादा सुलभ, लचीले और ताक़तवर हैं।

<!-- Once the app-building workflows mature, we may see automated pipelines for packaging Playground sites as iOS apps. It would make it extremely easy to run the same codebase on the server, in the browser, and as a mobile app. -->

ऐप बनाने के वर्कफ़्लो परिपक्व होने पर, Playground साइटों को iOS ऐप के रूप में पैक करने के लिए ऑटोमेटेड पाइपलाइन भी देखने को मिल सकती हैं। इससे एक ही कोडबेस को सर्वर पर, ब्राउज़र में और मोबाइल ऐप के रूप में चलाना बेहद आसान हो जाएगा।

<!-- By working together and sharing our findings, we can push the boundaries of what’s possible with WordPress and mobile app development. -->

मिलकर काम करके और अपनी खोजें साझा करके, हम WordPress और मोबाइल ऐप डेवलपमेंट में जो संभव है, उसकी सीमाओं को आगे बढ़ा सकते हैं।
