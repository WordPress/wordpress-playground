---
slug: /contributing/documentation
title: दस्तावेज़ में योगदान
description: Playground दस्तावेज़ में योगदान करने की गाइड, इश्यू खोलने से लेकर पुल रिक्वेस्ट भेजने तक।
---

<!-- # Documentation contributions -->

# दस्तावेज़ में योगदान

<!-- [WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help. -->

[WordPress Playground की दस्तावेज़ साइट](/) को आप जैसे स्वयंसेवक संभालते हैं, जिन्हें आपकी मदद पाकर खुशी होगी।

<!-- All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion. -->

[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) रिपॉज़िटरी में दस्तावेज़ से जुड़े सभी इश्यू पर [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) या [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) लेबल लगा होता है। खुले इश्यू की सूची देखें और कोई ऐसा इश्यू ढूँढें, जिस पर आप काम करना चाहें। या फिर, अगर आपको लगता है कि मौजूदा दस्तावेज़ में कुछ छूट गया है, तो अपने सुझाव पर चर्चा के लिए एक इश्यू खोलें।

<!-- ## How can I contribute? -->

## योगदान कैसे करें? {#how-can-i-contribute}

<!-- You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change. -->

आप [प्रोजेक्ट रिपॉज़िटरी में एक इश्यू खोलकर](https://github.com/WordPress/wordpress-playground/issues/new) और यह बताकर योगदान कर सकते हैं कि आप क्या जोड़ना या बदलना चाहते हैं।

<!-- If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest. -->

अगर आप इसके लिए तैयार हों, तो इश्यू के विवरण में सामग्री लिख दें। बाकी काम प्रोजेक्ट के योगदानकर्ता संभाल लेंगे।

<!-- Would you like to see the documentation in your language? Check the [Translation section](/contributing/translations). -->

क्या आप दस्तावेज़ को अपनी भाषा में देखना चाहते हैं? [अनुवाद सेक्शन](/contributing/translations) देखें।

<!-- If you want to make a small documentation change without setting up a local development environment, see [Contribute with the GitHub web interface](/contributing/github-ui). -->

अगर आप लोकल डेवलपमेंट एनवायरनमेंट सेट किए बिना दस्तावेज़ में कोई छोटा बदलाव करना चाहते हैं, तो [GitHub वेब इंटरफ़ेस से योगदान करें](/contributing/github-ui) देखें।

<!-- ### Forking the repo, edit files locally and opening Pull Requests -->

### रिपॉज़िटरी फ़ोर्क करना, फ़ाइलें लोकल रूप से संपादित करना और पुल रिक्वेस्ट खोलना {#forking-the-repo-edit-files-locally-and-opening-pull-requests}

<!-- If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request. -->

अगर आप Markdown से परिचित हैं, तो आप `wordpress-playground` रिपॉज़िटरी को [फ़ोर्क](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) कर सकते हैं और पुल रिक्वेस्ट भेजकर बदलाव और दस्तावेज़ के नए पेज सुझा सकते हैं।

<!--
The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same as contributing to other WordPress repositories such as Gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/
-->

[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) रिपॉज़िटरी पर अनुवादित पेजों के साथ नए PR खोलने के लिए ब्रांच बनाने की प्रक्रिया वही है, जो Gutenberg जैसी दूसरी WordPress रिपॉज़िटरी में योगदान करते समय अपनाई जाती है:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

<!-- The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) for English and [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) for other languages. -->

दस्तावेज़ की फ़ाइलें (`.md` फ़ाइलें) Playground की GitHub रिपॉज़िटरी में रखी जाती हैं, अंग्रेज़ी के लिए [`/packages/docs/site/docs` में](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) और दूसरी भाषाओं के लिए [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) में।

<!-- ### Edit in the browser -->

### ब्राउज़र में संपादित करें {#edit-in-the-browser}

<!-- You can edit existing files or add new documentation pages directly from the GitHub website. This approach does not require Git, a terminal, or a local development environment. -->

आप GitHub वेबसाइट से सीधे मौजूदा फ़ाइलें संपादित कर सकते हैं या दस्तावेज़ के नए पेज जोड़ सकते हैं। इस तरीके के लिए Git, टर्मिनल या लोकल डेवलपमेंट एनवायरनमेंट की ज़रूरत नहीं होती।

<!-- For the full step-by-step workflow, see [Contribute with the GitHub web interface](/contributing/github-ui). -->

पूरा तरीका चरण-दर-चरण जानने के लिए [GitHub वेब इंटरफ़ेस से योगदान करें](/contributing/github-ui) देखें।

<!-- ### Local preview -->

### लोकल पूर्वावलोकन {#local-preview}

<!-- Clone the repository and navigate to the directory on your device. Now run the following commands: -->

रिपॉज़िटरी क्लोन करें और अपने डिवाइस पर उसकी डायरेक्टरी में जाएँ। अब ये कमांड चलाएँ:

```bash
npm install
npm run build:docs
npm run dev:docs
```

<!-- The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time. -->

दस्तावेज़ साइट एक नए ब्राउज़र टैब में खुलती है और हर बदलाव के साथ अपने-आप रीफ़्रेश होती है। अपने कोड एडिटर में संबंधित फ़ाइल संपादित करते रहें और बदलावों का रियल-टाइम में परीक्षण करें।

<!-- ### Generated handbook manifest -->

### जनरेट किया गया हैंडबुक मैनिफ़ेस्ट {#generated-handbook-manifest}

<!--
The documentation build generates `manifest.json` alongside `translation-availability.json`
in `dist/docs/build`. Both use Docusaurus's `postBuild` hook and run only for the default
locale. The deployed manifest is available at
`https://wordpress.github.io/wordpress-playground/manifest.json`.
-->

दस्तावेज़ का बिल्ड `dist/docs/build` में `translation-availability.json` के साथ `manifest.json` भी बनाता है। दोनों Docusaurus के `postBuild` हुक का उपयोग करते हैं और सिर्फ़ डिफ़ॉल्ट लोकेल के लिए चलते हैं। डिप्लॉय किया गया मैनिफ़ेस्ट `https://wordpress.github.io/wordpress-playground/manifest.json` पर उपलब्ध है।

<!--
When adding a page, add its Markdown source and reference it in `sidebars.js`.
The manifest uses Docusaurus's resolved document titles and slugs, plus the sidebar
hierarchy and order. Removing or moving a page updates the manifest on the next build.
Drafts, unlisted pages, and pages marked `orphan: true` are excluded. A page missing
from the sidebar without one of these flags fails manifest generation.
-->

कोई पेज जोड़ते समय उसका Markdown सोर्स जोड़ें और `sidebars.js` में उसका रेफ़रेंस दें। मैनिफ़ेस्ट Docusaurus से तय होने वाले पेज शीर्षक और स्लग इस्तेमाल करता है, और साथ में साइडबार का पदानुक्रम और क्रम भी। किसी पेज को हटाने या दूसरी जगह ले जाने पर अगले बिल्ड में मैनिफ़ेस्ट अपडेट हो जाता है। ड्राफ़्ट, अनलिस्टेड पेज और `orphan: true` वाले पेज इसमें शामिल नहीं होते। अगर कोई पेज साइडबार में नहीं है और उस पर इनमें से कोई फ़्लैग भी नहीं है, तो उसकी वजह से मैनिफ़ेस्ट बनाना विफल हो जाता है।

<!--
The generator preserves existing handbook URLs that differ from Docusaurus routes,
and uses the generated Markdown versions of the Steps and Playground API Client pages.
The English redirect plugin uses the same entries. Changes to these exceptions belong
in `plugins/generate-handbook-manifest.js`.
-->

जनरेटर हैंडबुक के उन मौजूदा URL को बनाए रखता है जो Docusaurus रूट से अलग हैं, और Steps और Playground API Client पेजों के जनरेट किए गए Markdown संस्करण इस्तेमाल करता है। अंग्रेज़ी रीडायरेक्ट प्लगइन भी इन्हीं एंट्री का उपयोग करता है। इन अपवादों में बदलाव `plugins/generate-handbook-manifest.js` में होने चाहिए।

<!--
The generated manifest uses absolute raw GitHub URLs for its Markdown sources so the
handbook importer can fetch them even though the JSON is hosted on GitHub Pages.
The committed `packages/docs/site/manifest.json` is retained for the existing importer
during migration. Switch the importer's manifest URL to the deployed endpoint above
before removing that legacy snapshot; builds do not update it.
-->

जनरेट किया गया मैनिफ़ेस्ट अपने Markdown सोर्स के लिए पूरे raw GitHub URL इस्तेमाल करता है, ताकि JSON के GitHub Pages पर होस्ट होने के बावजूद हैंडबुक इंपोर्टर उन्हें प्राप्त कर सके। माइग्रेशन के दौरान मौजूदा इंपोर्टर के लिए कमिट की गई `packages/docs/site/manifest.json` फ़ाइल रखी गई है। उस पुराने स्नैपशॉट को हटाने से पहले इंपोर्टर का मैनिफ़ेस्ट URL ऊपर दिए गए डिप्लॉय एंडपॉइंट पर बदलें; बिल्ड उसे अपडेट नहीं करते।

<!-- To check the build plugins, run `npx nx run docs-site:test-plugins`. -->

बिल्ड प्लगइन्स जाँचने के लिए `npx nx run docs-site:test-plugins` चलाएँ।
