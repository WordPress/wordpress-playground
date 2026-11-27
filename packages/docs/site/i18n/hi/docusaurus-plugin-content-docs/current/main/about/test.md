---
title: टेस्ट
slug: /about/test
description: थीम, प्लगइन, पुल रिक्वेस्ट, और WordPress व PHP के अलग-अलग संस्करणों का परीक्षण करने के लिए Playground का उपयोग करना सीखें।
---

<!-- # Test -->

# टेस्ट

<!-- Upgrade your QA process with the ability to review progress in your browser in a single click. When you’re ready, push updates instantly. -->

एक क्लिक में अपने ब्राउज़र में प्रगति की समीक्षा करने की सुविधा से अपनी QA प्रक्रिया को बेहतर बनाएँ। जब आप तैयार हों, तो अपडेट तुरंत पुश करें।

<!-- ## Test any theme or plugin -->

## कोई भी थीम या प्लगइन टेस्ट करें {#test-any-theme-or-plugin}

<!-- With Playground, you can test any plugin or theme. Use the [Query API](/developers/apis/query-api) to quickly load any plugin or theme published in wordpress.org [plugins](https://wordpress.org/plugins) and [themes](https://wordpress.org/themes/) directories. -->

Playground में आप किसी भी प्लगइन या थीम का परीक्षण कर सकते हैं। wordpress.org की [प्लगइन](https://wordpress.org/plugins) और [थीम](https://wordpress.org/themes/) डायरेक्टरी में प्रकाशित किसी भी प्लगइन या थीम को जल्दी लोड करने के लिए [Query API](/developers/apis/query-api) का उपयोग करें।

<!-- For example, the following link will load the [“pendant” theme](https://wordpress.org/themes/pendant/) and the[ “gutenberg” plugin](https://wordpress.org/plugins/gutenberg/) on a Playground instance: -->

उदाहरण के लिए, नीचे दिया गया लिंक एक Playground इंस्टेंस पर [“pendant” थीम](https://wordpress.org/themes/pendant/) और [“gutenberg” प्लगइन](https://wordpress.org/plugins/gutenberg/) लोड करेगा:

[https://playground.wordpress.net/?theme=pendant&plugin=gutenberg](https://playground.wordpress.net/?theme=pendant&plugin=gutenberg)

<!-- But you can also test [more elaborate configurations using blueprints](https://developer.wordpress.org/playground/blueprints/examples/), for example testing a plugin’s code from a gist (see [blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json)) -->

आप [ब्लूप्रिंट की मदद से ज़्यादा विस्तृत कॉन्फ़िगरेशन](https://developer.wordpress.org/playground/blueprints/examples/) भी टेस्ट कर सकते हैं, जैसे किसी gist से प्लगइन के कोड का परीक्षण करना ([ब्लूप्रिंट](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) और [लाइव डेमो](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json) देखें)।

<!-- ## Live preview pull requests -->

## पुल रिक्वेस्ट का लाइव पूर्वावलोकन {#live-preview-pull-requests}

<!-- Testing pull requests is one of the most exciting use cases for the Playground project. With Playground, you can enable a Live preview link on each Pull Request of a WordPress-related project in GitHub so that developers can see in action the effects of code in that Pull Request. Read more about this at [Preview WordPress Core Pull Requests with Playground](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.). -->

पुल रिक्वेस्ट का परीक्षण Playground प्रोजेक्ट के सबसे रोमांचक उपयोगों में से एक है। Playground की मदद से आप GitHub पर किसी भी WordPress से जुड़े प्रोजेक्ट की हर पुल रिक्वेस्ट पर एक लाइव पूर्वावलोकन लिंक चालू कर सकते हैं, ताकि डेवलपर्स उस पुल रिक्वेस्ट के कोड का असर काम करते हुए देख सकें। इसके बारे में और जानकारी [Preview WordPress Core Pull Requests with Playground](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.) में पढ़ें।

<!-- There are some public implementations of this use case such as [WordPress Core PR previewer](https://playground.wordpress.net/wordpress.html) and [Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html). Users can input the PR number or URL to be redirected to a WordPress instance, powered by Playground, where the changes from the PR are applied. -->

इस उपयोग के कुछ सार्वजनिक उदाहरण भी हैं, जैसे [WordPress Core PR previewer](https://playground.wordpress.net/wordpress.html) और [Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html)। उपयोगकर्ता PR नंबर या URL डालकर Playground से चलने वाले एक WordPress इंस्टेंस पर पहुँच सकते हैं, जिसमें उस PR के बदलाव लागू होते हैं।

<!-- You can add automated PR preview buttons to your own plugin or theme repository using the WordPress Playground PR Preview GitHub Action. When someone opens a pull request, the action automatically adds a button that launches a configured WordPress instance with the changes ready to test. For detailed setup instructions and advanced configurations, see the [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) guide. -->

WordPress Playground PR Preview GitHub Action की मदद से आप अपने प्लगइन या थीम की रिपॉज़िटरी में अपने-आप जुड़ने वाले PR पूर्वावलोकन बटन जोड़ सकते हैं। जब कोई पुल रिक्वेस्ट खोलता है, तो यह एक्शन अपने-आप एक बटन जोड़ देता है, जो बदलावों के साथ परीक्षण के लिए तैयार, पहले से कॉन्फ़िगर किया गया WordPress इंस्टेंस खोलता है। सेटअप के विस्तृत निर्देशों और एडवांस्ड कॉन्फ़िगरेशन के लिए [GitHub Actions से PR पूर्वावलोकन बटन जोड़ना](/guides/github-action-pr-preview) गाइड देखें।

<!-- ## Clone your site and experiment in a private sandbox. -->

## अपनी साइट क्लोन करें और निजी सैंडबॉक्स में प्रयोग करें। {#clone-your-site-and-experiment-in-a-private-sandbox}

<!-- With the [Sandbox Site powered by Playground](https://wordpress.org/plugins/playground/) plugin you can create a private WordPress Playground copy of your site to test plugins safely or do any other experiments on your site’s replica without uploading any data to the cloud and without affecting the original site. -->

[Sandbox Site powered by Playground](https://wordpress.org/plugins/playground/) प्लगइन से आप अपनी साइट की एक निजी WordPress Playground कॉपी बना सकते हैं। इस कॉपी पर आप प्लगइन का सुरक्षित परीक्षण या कोई भी दूसरा प्रयोग कर सकते हैं, और इसके लिए न कोई डेटा क्लाउड पर अपलोड होता है, न ही मूल साइट पर कोई असर पड़ता है।

<!-- ## Test different WordPress and PHP versions. -->

## WordPress और PHP के अलग-अलग संस्करण टेस्ट करें। {#test-different-wordpress-and-php-versions}

<!-- With Playground, you can quickly test any major WordPress or PHP version by _customizing its settings_ or using a custom blueprint with the `preferredVersions` property. -->

Playground में आप _इसकी सेटिंग्स बदलकर_ या `preferredVersions` प्रॉपर्टी वाले कस्टम ब्लूप्रिंट का उपयोग करके WordPress या PHP के किसी भी मुख्य संस्करण का जल्दी परीक्षण कर सकते हैं।

<!-- For example, you can always test the latest development version of WordPress, also called [Beta Nightly](https://wordpress.org/download/beta-nightly/), from this link: [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly) -->

उदाहरण के लिए, आप WordPress के नवीनतम डेवलपमेंट संस्करण, जिसे [Beta Nightly](https://wordpress.org/download/beta-nightly/) भी कहते हैं, का परीक्षण इस लिंक से कभी भी कर सकते हैं: [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly)

<!-- During the Beta period of any WordPress release, you can also test the latest WordPress Beta or RC release with theme test data and debugging plugins (see [blueprint](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) and [live demo). ](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json) -->

किसी भी WordPress रिलीज़ के Beta दौर में आप थीम टेस्ट डेटा और डीबगिंग प्लगइन के साथ नवीनतम WordPress Beta या RC रिलीज़ का भी परीक्षण कर सकते हैं ([ब्लूप्रिंट](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) और [लाइव डेमो](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json) देखें)।

<!-- You can also load any [theme, plugin](/developers/apis/query-api), or [configuration](/blueprints) in any of the available WordPress and PHP versions to check how they work in that environment. -->

आप कोई भी [थीम, प्लगइन](/developers/apis/query-api) या [कॉन्फ़िगरेशन](/blueprints) WordPress और PHP के किसी भी उपलब्ध संस्करण में लोड करके यह भी देख सकते हैं कि वे उस एनवायरनमेंट में कैसे काम करते हैं।

<!-- The [WordPress Playground: the ultimate learning, testing, & teaching tool for WordPress](https://www.youtube.com/watch?v=dN_LaenY8bI) provides a great overview of the testing possibilities with Playground. -->

[WordPress Playground: the ultimate learning, testing, & teaching tool for WordPress](https://www.youtube.com/watch?v=dN_LaenY8bI) वीडियो में Playground से परीक्षण की संभावनाओं का बढ़िया परिचय मिलता है।
