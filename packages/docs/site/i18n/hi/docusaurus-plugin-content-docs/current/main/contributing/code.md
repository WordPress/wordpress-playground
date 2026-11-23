---
slug: /contributing/code
title: कोड योगदान
description: कोड योगदान की एक गाइड, जिसमें रिपॉज़िटरी फ़ोर्क करने, लोकल एनवायरनमेंट सेट करने और पुल रिक्वेस्ट भेजने का तरीका बताया गया है।
---

<!-- # Code contributions -->

# कोड योगदान

<!-- Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/). -->

सभी WordPress प्रोजेक्ट्स की तरह, Playground भी कोड संभालने और इश्यू ट्रैक करने के लिए GitHub का उपयोग करता है। मुख्य रिपॉज़िटरी [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) पर है और Playground Tools रिपॉज़िटरी [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/) पर है।

<div class="callout callout-info">

<!-- **Contribute to Playground Tools** -->

**Playground Tools में योगदान करें**

<!-- This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or [local development](/developers/local-development/) tools—start there. -->

इस गाइड में मुख्य रिपॉज़िटरी के लिंक हैं, लेकिन सभी चरण और विकल्प दोनों रिपॉज़िटरी पर लागू होते हैं। अगर आपकी दिलचस्पी प्लगइन्स या [लोकल डेवलपमेंट](/developers/local-development/) टूल्स में है, तो Playground Tools से शुरुआत करें।

</div>

<!-- Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors. -->

किस पर काम करना है, यह जानने के लिए [खुले इश्यू की सूची](https://github.com/wordpress/wordpress-playground/issues) देखें। पहली बार योगदान करने वालों के लिए [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) लेबल से शुरुआत करने की सलाह दी जाती है।

<!-- Be sure to review the following resources before you begin: -->

शुरू करने से पहले इन संसाधनों को ज़रूर देखें:

<!--
- [Coding principles](/contributing/coding-standards)
- [Architecture](/developers/architecture)
- [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
- [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

- [कोडिंग सिद्धांत](/contributing/coding-standards)
- [आर्किटेक्चर](/developers/architecture)
- [विज़न और दर्शन](https://github.com/WordPress/wordpress-playground/issues/472)
- [WordPress Playground रोडमैप](https://github.com/WordPress/wordpress-playground/issues/525)

<!-- ## Contribute Pull Requests -->

## पुल रिक्वेस्ट से योगदान करें {#contribute-pull-requests}

<!-- [Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal: -->

[Playground रिपॉज़िटरी को फ़ोर्क करें](https://github.com/WordPress/wordpress-playground/fork) और उसे अपनी लोकल मशीन पर क्लोन करें। इसके लिए ये कमांड कॉपी करके अपने टर्मिनल में पेस्ट करें:

```bash
# replace `YOUR-GITHUB-USERNAME` with your GitHub username:
git clone -b trunk --single-branch --depth 1 --recurse-submodules git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

<!-- Create a branch, make changes, and test it locally by running the following command: -->

एक ब्रांच बनाएँ, बदलाव करें, और नीचे दिया गया कमांड चलाकर लोकल रूप से उनका परीक्षण करें:

```bash
npm run dev
```

<!-- Playground will open in a new browser tab and refresh automatically with each change. -->

Playground एक नए ब्राउज़र टैब में खुलेगा और हर बदलाव के साथ अपने-आप रीफ़्रेश होगा।

<div class="callout callout-tip">

<!-- **Troubleshooting: File watcher limit on Linux** -->

**समस्या निवारण: Linux पर फ़ाइल वॉचर की सीमा**

<!-- On Linux, you might see an error like `ENOSPC: System limit for number of file watchers reached` when running `npm run dev`. This happens because the Playground repository has more files than the default system limit allows to watch. -->

Linux पर `npm run dev` चलाते समय आपको `ENOSPC: System limit for number of file watchers reached` जैसा एरर दिख सकता है। ऐसा इसलिए होता है क्योंकि Playground रिपॉज़िटरी में उससे ज़्यादा फ़ाइलें हैं, जितनी फ़ाइलों पर नज़र रखने की अनुमति सिस्टम की डिफ़ॉल्ट सीमा देती है।

<!-- To fix this, first check your current limit: -->

इसे ठीक करने के लिए, पहले अपनी मौजूदा सीमा जाँचें:

```bash
cat /proc/sys/fs/inotify/max_user_watches
```

<!-- If it's around 65,536 or lower, increase it by running: -->

अगर यह लगभग 65,536 या उससे कम है, तो यह कमांड चलाकर इसे बढ़ाएँ:

```bash
sudo sysctl fs.inotify.max_user_watches=131070
```

<!-- Then try `npm run dev` again. This is a common issue on Debian, Ubuntu, and other Linux distributions. -->

इसके बाद `npm run dev` फिर से चलाकर देखें। Debian, Ubuntu और दूसरे Linux डिस्ट्रीब्यूशन पर यह एक आम समस्या है।

</div>

<!-- When you're ready, commit the changes and submit a Pull Request. -->

तैयार होने पर बदलाव कमिट करें और पुल रिक्वेस्ट भेजें।

<div class="callout callout-info">

<!-- **Formatting** -->

**फ़ॉर्मैटिंग**

<!-- We handle code formatting and linting automatically. Relax, type away, and let the machines do the work. -->

कोड की फ़ॉर्मैटिंग और लिंटिंग हम अपने-आप करते हैं। आराम से कोड लिखें, बाकी काम मशीनों पर छोड़ दें।

</div>

<!-- ### Running a local Multisite -->

### लोकल मल्टीसाइट चलाना {#running-a-local-multisite}

<!-- WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change Playground CLI's default port or set a local test domain running via HTTPS. -->

WordPress मल्टीसाइट को लोकल रूप से चलाने पर [कुछ प्रतिबंध](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions) लागू होते हैं। अगर आप Playground के `enableMultisite` चरण का उपयोग करके किसी मल्टीसाइट नेटवर्क का परीक्षण करना चाहते हैं, तो पक्का करें कि आप या तो Playground CLI का डिफ़ॉल्ट पोर्ट बदलें, या HTTPS पर चलने वाला कोई लोकल टेस्ट डोमेन सेट करें।

<!--
To change Playground CLI's default port to the one supported by WordPress
Multisite, run it using the `--port=80` flag:
-->

Playground CLI के डिफ़ॉल्ट पोर्ट को उस पोर्ट में बदलने के लिए जिसे WordPress मल्टीसाइट सपोर्ट करता है, Playground CLI को `--port=80` फ़्लैग के साथ चलाएँ:

```bash
npx @wp-playground/cli@latest start --port=80
```

<!-- There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command: -->

लोकल टेस्ट डोमेन सेट करने के कुछ तरीके हैं, जिनमें आपकी `hosts` फ़ाइल को संपादित करना भी शामिल है। अगर आपको पक्का नहीं पता कि यह कैसे करें, तो हमारा सुझाव है कि आप [Laravel Valet](https://laravel.com/docs/11.x/valet) स्थापित करें और फिर यह कमांड चलाएँ:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

<!-- Your dev server is now available on https://playground.test. -->

अब आपका डेव सर्वर https://playground.test पर उपलब्ध है।

<!-- ## Debugging -->

## डीबगिंग {#debugging}

<!-- ### Use VS Code and Chrome -->

### VS Code और Chrome का उपयोग करें {#use-vs-code-and-chrome}

<!-- If you're using VS Code and have Chrome installed, you can debug Playground in the code editor: -->

अगर आप VS Code का उपयोग करते हैं और आपके सिस्टम पर Chrome स्थापित है, तो आप कोड एडिटर में Playground को डीबग कर सकते हैं:

<!--
- Open the project folder in VS Code.
- Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.
-->

- VS Code में प्रोजेक्ट फ़ोल्डर खोलें।
- मुख्य मेनू से Run > Start Debugging चुनें, या `F5`/`fn`+`F5` दबाएँ।

<!-- ### Debugging PHP -->

### PHP डीबगिंग {#debugging-php}

<!-- Playground logs PHP errors in the browser console after every PHP request. -->

हर PHP अनुरोध के बाद Playground ब्राउज़र कंसोल में PHP एरर लॉग करता है।
