---
title: समस्या निवारण
slug: /troubleshooting
description: WordPress Playground वेबसाइट की आम एरर का पता लगाएँ, जैसे बूट न होना, SQLite की समस्याएँ, ब्राउज़र स्टोरेज, और सहेजे गए Playground को वापस पाना।
---

<!-- # Troubleshooting WordPress Playground -->

# WordPress Playground का समस्या निवारण

<!--
This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).
-->

इस पेज में Playground वेबसाइट, सहेजे गए Playground, ब्राउज़र स्टोरेज और WordPress बूट से जुड़ी एरर शामिल हैं। ब्लूप्रिंट से जुड़ी एरर के लिए [ब्लूप्रिंट की समस्याएँ हल करें और डीबग करें](/blueprints/troubleshoot-and-debug) देखें।

<!-- ## Playground looks broken -->

## Playground ठीक से काम नहीं कर रहा {#playground-looks-broken}

<!-- Try these first: -->

सबसे पहले ये आज़माएँ:

<!--
- Use the Playground **Refresh page** button instead of refreshing the browser tab. Browser refresh (Cmd+R or F5) starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a new autosaved Playground. Use `?storage=temp` when you need a truly temporary site.
-->

- ब्राउज़र टैब रिफ़्रेश करने की जगह Playground का **Refresh page** बटन इस्तेमाल करें। ब्राउज़र रिफ़्रेश (Cmd+R या F5) पूरे Playground ऐप को फिर से शुरू कर देता है।
- यही URL किसी प्राइवेट विंडो में खोलें, ताकि पता चल सके कि समस्या सहेजी गई साइट या ब्राउज़र स्टोरेज की वजह से तो नहीं है।
- ऐसे ब्राउज़र एक्सटेंशन बंद करें जो JavaScript, WebAssembly, स्टोरेज, वर्कर या नेटवर्क रिक्वेस्ट को रोकते हैं।
- ब्राउज़र के डेवलपर टूल में Console और Network की एरर देखें।
- अगर URL में `?site-slug=...` है, तो नया ऑटोसेव होने वाला Playground शुरू करने के लिए उस क्वेरी पैरामीटर को हटाकर देखें। जब आपको पूरी तरह अस्थायी साइट चाहिए, तो `?storage=temp` का उपयोग करें।

<!-- ## A clean site says the MySQL extension is missing -->

## नई साइट कहती है कि MySQL एक्सटेंशन मौजूद नहीं है {#a-clean-site-says-the-mysql-extension-is-missing}

<!-- You may see a WordPress error page like this: -->

आपको WordPress का कुछ ऐसा एरर पेज दिख सकता है:

```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```

<!--
In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.
-->

Playground में इसका आमतौर पर मतलब होता है कि WordPress ने SQLite इंटीग्रेशन लोड नहीं किया, जिसकी मदद से WordPress बिना MySQL के चलता है। Playground, WordPress को WebAssembly में चलाता है और MySQL सर्वर की जगह SQLite का उपयोग करता है।

<!-- Try these steps: -->

ये कदम आज़माएँ:

<!--
- Start a fresh Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new Playground. Add `?storage=temp` only when you need an ephemeral site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).
-->

- यह पक्का करने के लिए कि सार्वजनिक साइट बूट हो सकती है, https://playground.wordpress.net/ पर नया Playground शुरू करें।
- अगर URL में कोई सहेजी गई साइट है, तो `?site-slug=...` हटाएँ और नया Playground लोड करें। `?storage=temp` तभी जोड़ें जब आपको अस्थायी साइट चाहिए।
- अगर यह ZIP इम्पोर्ट करने के बाद हुआ, तो पक्का करें कि इम्पोर्ट में कोई कस्टम `wp-content/db.php` शामिल नहीं था जो Playground के SQLite सेटअप की जगह ले लेता है।
- अगर यह CLI में हुआ, तो `--skip-sqlite-setup` का उपयोग न करें, जब तक कि आप अपना खुद का डेटाबेस इंटीग्रेशन न दे रहे हों।
- अगर यह किसी ब्लूप्रिंट के साथ हुआ, तो [ब्लूप्रिंट समस्या निवारण पेज](/blueprints/troubleshoot-and-debug) देखें।

<!--
If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:
-->

अगर आप ब्लूप्रिंट लिख रहे हैं और आपको SQLite इंटीग्रेशन प्लगइन जोड़ना है, तो `plugins` सबसे ऊपरी स्तर पर आता है:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

<!-- ## Error connecting to the SQLite database -->

## SQLite डेटाबेस से कनेक्ट करने में एरर {#error-connecting-to-the-sqlite-database}

<!--
This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.
-->

इसका मतलब है कि Playground ने SQLite इंटीग्रेशन लोड कर लिया, लेकिन फिर भी WordPress डेटाबेस से कनेक्ट नहीं हो सका।

<!-- Common causes: -->

आम वजहें:

<!--
- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.
-->

- सहेजे गए Playground का ब्राउज़र स्टोरेज पुराना या अधूरा है।
- इम्पोर्ट की गई साइट की ZIP में ऐसी डेटाबेस फ़ाइल या डेटाबेस ड्रॉप-इन है जो काम नहीं करती।
- माउंट की गई लोकल डायरेक्टरी में वे फ़ाइलें नहीं हैं जिनकी WordPress को ज़रूरत है।
- ब्राउज़र स्टोरेज साफ़ कर दिया गया, ब्राउज़र ने उसे हटा दिया, या उसे रोक दिया गया।

<!-- Recommended recovery: -->

वापस ठीक करने के सुझाए गए कदम:

<!--
1. Start a fresh Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export accessible files from the broken saved site using **Files**, **Export**, or a local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.
-->

1. `site-slug` के बिना नया Playground शुरू करें।
2. अगर नई साइट काम करती है, तो समस्या सहेजी गई साइट या इम्पोर्ट किए गए आर्काइव से जुड़ी है।
3. खराब हुई सहेजी गई साइट से जो फ़ाइलें मिल सकें, उन्हें **Files**, **Export** या लोकल डायरेक्टरी की कॉपी (अगर उपलब्ध हो) से एक्सपोर्ट करें।
4. साइट को नए Playground में फिर से इम्पोर्ट करें, या उसके ब्लूप्रिंट से उसे दोबारा बनाएँ।

<!-- ## NotAllowedError -->

## NotAllowedError {#notallowederror}

<!--
`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.
-->

`NotAllowedError` का आमतौर पर मतलब होता है कि ब्राउज़र ने कोई ऐसा काम रोक दिया जिसके लिए उपयोगकर्ता की अनुमति या सपोर्ट वाले ब्राउज़र संदर्भ की ज़रूरत होती है। Playground में यह अक्सर सहेजी गई साइटों या लोकल डायरेक्टरी के एक्सेस से जुड़ा होता है।

<!-- You may see this exact message: -->

आपको ठीक यह संदेश दिख सकता है:

```text
The request is not allowed by the user agent or the platform in the current context.
```

<!-- Try: -->

ये आज़माएँ:

<!--
- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from **Your Playgrounds** in the Dock.
- If the site used a local directory, Playground cannot currently re-select the directory after its saved permission expires. The files remain on disk; use them directly or recreate the Playground from an exported ZIP or Blueprint, if available.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.
-->

- Playground को किसी सीमित iframe के अंदर नहीं, बल्कि सामान्य ब्राउज़र टैब में खोलें।
- Dock में **Your Playgrounds** से साइट फिर से खोलें।
- अगर साइट किसी लोकल डायरेक्टरी का उपयोग करती थी, तो उसकी सहेजी गई अनुमति खत्म होने के बाद Playground अभी उस डायरेक्टरी को फिर से नहीं चुन सकता। फ़ाइलें डिस्क पर बनी रहती हैं, इसलिए उनका सीधे उपयोग करें, या एक्सपोर्ट की गई ZIP या ब्लूप्रिंट (अगर उपलब्ध हो) से Playground फिर से बनाएँ।
- पक्का करें कि ब्राउज़र इस्तेमाल हो रहे फ़ाइल या स्टोरेज API को सपोर्ट करता है। आमतौर पर Chrome और Edge में लोकल डायरेक्टरी का सबसे ज़्यादा सपोर्ट होता है।
- देखें कि कहीं प्राइवेट ब्राउज़िंग मोड, एंटरप्राइज़ पॉलिसी या ब्राउज़र सेटिंग्स स्टोरेज एक्सेस को रोक तो नहीं रहीं।

<!-- ## NoModificationAllowedError -->

## NoModificationAllowedError {#nomodificationallowederror}

<!--
`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.
-->

`NoModificationAllowedError` का मतलब है कि ब्राउज़र या फ़ाइल सिस्टम ने कुछ लिखने से मना कर दिया। ऐसा तब हो सकता है जब सहेजी गई लोकल डायरेक्टरी सिर्फ़ पढ़ने लायक (read-only) हो गई हो, अनुमति खो गई हो, या ब्राउज़र स्टोरेज उपलब्ध न हो।

<!-- You may see this exact message: -->

आपको ठीक यह संदेश दिख सकता है:

```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```

<!-- Try: -->

ये आज़माएँ:

<!--
- If the Playground still opens, use **Export → Download as .zip** before starting over.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh Playground with `?storage=temp` if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.
-->

- अगर Playground अब भी खुलता है, तो फिर से शुरू करने से पहले **Export → Download as .zip** का उपयोग करें।
- जाँचें कि टारगेट फ़ोल्डर अब भी मौजूद है और उसमें लिखा जा सकता है।
- सिस्टम द्वारा सुरक्षित फ़ोल्डर या ऐसे सिंक होने वाले फ़ोल्डर इस्तेमाल न करें जो फ़ाइलों को कुछ देर के लिए लॉक कर देते हैं।
- अगर आपको सिर्फ़ अस्थायी टेस्ट साइट चाहिए, तो `?storage=temp` के साथ नया Playground शुरू करें।
- जिस लोकल डेवलपमेंट में फ़ाइलों का भरोसेमंद ढंग से सहेजा जाना ज़रूरी है, उसके लिए [Playground CLI](/developers/local-development/wp-playground-cli) का उपयोग करें।

<!-- ## Saved Playground cannot reload -->

## सहेजा गया Playground फिर से लोड नहीं हो रहा {#saved-playground-cannot-reload}

<!--
Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.
-->

सहेजे गए Playground ब्राउज़र स्टोरेज में या आपकी चुनी हुई लोकल डायरेक्टरी में रखे जाते हैं। वे किसी रिमोट सर्वर पर होस्ट नहीं होते।

<!-- If a saved Playground cannot reload: -->

अगर कोई सहेजा गया Playground फिर से लोड नहीं हो रहा:

<!--
- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh autosaved Playground.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.
-->

- पक्का करें कि आप वही ब्राउज़र और ब्राउज़र प्रोफ़ाइल इस्तेमाल कर रहे हैं जिसमें उसे सहेजा गया था।
- देखें कि कहीं ब्राउज़र डेटा साफ़ तो नहीं किया गया, या स्टोरेज बंद तो नहीं है।
- अगर साइट किसी लोकल डायरेक्टरी में सहेजी गई थी, तो पक्का करें कि वह डायरेक्टरी अब भी मौजूद है और कहीं और नहीं ले जाई गई।
- अगर URL में `?site-slug=...` है, तो नया ऑटोसेव होने वाला Playground शुरू करने के लिए उसे हटाएँ।
- अगर स्टोरेज खो गया है, तो सहेजी गई साइट को उसके मूल ब्लूप्रिंट या इम्पोर्ट ZIP से फिर से बनाएँ।

<!-- ## Browser storage and persistence -->

## ब्राउज़र स्टोरेज और साइट को सहेजकर रखना {#browser-storage-and-persistence}

<!-- New Playgrounds are autosaved when browser storage and saving are available. Open **Your Playgrounds** in the Dock to recover recent autosaves or saved Playgrounds. Playground keeps up to five recent autosaves. -->

जब ब्राउज़र स्टोरेज और सेव करने की सुविधा उपलब्ध होती है, तो नए Playground अपने-आप सहेजे जाते हैं। हाल के ऑटोसेव या सहेजे गए Playground वापस पाने के लिए Dock में **Your Playgrounds** खोलें। Playground हाल के अधिकतम पाँच ऑटोसेव रखता है।

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open the storage
choices. Select **Save in browser storage**, or select **Save in a local
directory** and choose a directory dedicated to that Playground before
clicking **Save**. Matching files in the directory may be overwritten. Use
**Export** to download a portable ZIP. A browser refresh can recover a stored
or autosaved Playground, but `?storage=temp` creates a temporary Playground
that is discarded on refresh or tab close.
-->

स्टोरेज के विकल्प खोलने के लिए Dock में **Autosaved** या **Unsaved** स्टेटस पर क्लिक करें। **Save in browser storage** चुनें, या **Save in a local directory** चुनें और **Save** पर क्लिक करने से पहले उस Playground के लिए अलग से एक डायरेक्टरी चुनें। डायरेक्टरी में मौजूद एक जैसे नाम वाली फ़ाइलें ओवरराइट हो सकती हैं। कहीं भी ले जाने लायक ZIP डाउनलोड करने के लिए **Export** का उपयोग करें। ब्राउज़र रिफ़्रेश करने पर सहेजा गया या ऑटोसेव किया गया Playground वापस मिल सकता है, लेकिन `?storage=temp` एक अस्थायी Playground बनाता है जो रिफ़्रेश करने या टैब बंद करने पर हट जाता है।

<!-- For longer-running local development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli), which persists site files on disk. -->

लंबे समय तक चलने वाले लोकल डेवलपमेंट के लिए [Playground CLI](/developers/local-development/wp-playground-cli) बेहतर है, जो साइट की फ़ाइलें डिस्क पर सहेजकर रखता है।

<!-- See [the Dock guide](/web-instance) for the current Dock destinations and export workflow. -->

Dock के मौजूदा पैन और एक्सपोर्ट करने के तरीके के लिए [Dock गाइड](/web-instance) देखें।

<!-- ## When to start fresh -->

## नई शुरुआत कब करें {#when-to-start-fresh}

<!-- Start a fresh Playground when: -->

नया Playground तब शुरू करें जब:

<!--
- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.
-->

- आपको सिर्फ़ यह जाँचना है कि सार्वजनिक Playground साइट काम कर रही है या नहीं।
- URL किसी ऐसे सहेजे गए `site-slug` की ओर इशारा करता है जो अब लोड नहीं होता।
- आप यह पता लगा रहे हैं कि कोई एरर खुद Playground से आ रही है या किसी प्लगइन, थीम, ब्लूप्रिंट या इम्पोर्ट की गई साइट से।
- ब्राउज़र स्टोरेज या लोकल डायरेक्टरी के एक्सेस में गड़बड़ी होने का शक है।

<!-- Use this URL for a clean site: -->

नई साइट के लिए यह URL इस्तेमाल करें:

```text
https://playground.wordpress.net/
```

<!-- ## Report a Playground issue -->

## Playground की समस्या रिपोर्ट करें {#report-a-playground-issue}

<!--
If the problem reproduces on a fresh Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:
-->

अगर समस्या नए Playground पर भी दोबारा होती है, तो कृपया [एक इश्यू खोलें](https://github.com/WordPress/wordpress-playground/issues) और इसमें ये जानकारी शामिल करें:

<!--
- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
-->

- Playground का पूरा URL।
- ब्राउज़र और ऑपरेटिंग सिस्टम।
- आपने सहेजी गई साइट, इम्पोर्ट की गई ZIP, ब्लूप्रिंट, लोकल डायरेक्टरी या CLI में से किसका उपयोग किया।
- एरर का सटीक नाम और संदेश।
- ब्राउज़र के डेवलपर टूल से Console और Network की जानकारी।
