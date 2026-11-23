---
title: ब्लूप्रिंट से WordPress में सामग्री इम्पोर्ट करना
slug: /guides/import-content-with-blueprints
description: नए WordPress Playground इंस्टेंस में सामग्री इम्पोर्ट करने के लिए WXR, runPHP और ZIP स्नैपशॉट की तुलना करें।
---

<!-- # Importing content into WordPress with Blueprints -->

# ब्लूप्रिंट से WordPress में सामग्री इम्पोर्ट करना

<!--
A new WordPress Playground site starts with basic content. A Blueprint can help
fill that gap from a WordPress export file, generate content with WordPress APIs,
or restore a Playground ZIP snapshot.
-->

नई WordPress Playground साइट बुनियादी सामग्री के साथ शुरू होती है। एक ब्लूप्रिंट इस कमी को पूरा करने में मदद कर सकता है: WordPress एक्सपोर्ट फ़ाइल से सामग्री लाकर, WordPress API से सामग्री बनाकर, या Playground का ZIP स्नैपशॉट वापस लाकर।

<!--
This guide focuses on choosing a Blueprint content import method and presents a
small benchmark comparing three approaches. Importing data can be useful for
theme starter content, test fixtures, educational content, and other
demo-building strategies. For more options, see
[Providing content for your demo with Playground](/guides/providing-content-for-your-demo).
-->

यह गाइड ब्लूप्रिंट से सामग्री इम्पोर्ट करने का तरीका चुनने पर केंद्रित है, और तीन तरीकों की तुलना करने वाला एक छोटा बेंचमार्क दिखाती है। डेटा इम्पोर्ट करना थीम की स्टार्टर सामग्री, टेस्ट फ़िक्स्चर, शैक्षिक सामग्री और डेमो बनाने के दूसरे तरीकों के लिए उपयोगी हो सकता है। और विकल्पों के लिए [Playground से अपने डेमो के लिए सामग्री देना](/guides/providing-content-for-your-demo) देखें।

<!-- These approaches solve different problems: -->

ये तरीके अलग-अलग समस्याएँ हल करते हैं:

<!--
| Method                                                                        | Best for                                                                             | What it moves                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr)                  | Portable content shared between WordPress sites without overwriting existing content | Posts, pages, custom post types, terms, authors, comments, and attachment references          |
| [`runPHP`](#generate-content-with-runphp)                                     | Small, deterministic fixtures and content that needs custom logic                    | Anything the PHP code creates through WordPress APIs                                          |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | Restoring a complete Playground demo                                                 | The database and any WordPress files present in the ZIP, such as plugins, themes, and uploads |
-->

| तरीका | किसके लिए सबसे अच्छा | क्या ले जाता है |
| --- | --- | --- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr) | ऐसी सामग्री जो WordPress साइटों के बीच कहीं भी ले जाई जा सके और मौजूदा सामग्री को ओवरराइट न करे | पोस्ट, पेज, कस्टम पोस्ट टाइप, टर्म, लेखक, टिप्पणियाँ और अटैचमेंट के रेफ़रेंस |
| [`runPHP`](#generate-content-with-runphp) | छोटे, हर बार एक जैसे नतीजे देने वाले फ़िक्स्चर, और ऐसी सामग्री जिसके लिए कस्टम लॉजिक चाहिए | PHP कोड WordPress API के ज़रिए जो कुछ भी बनाए |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | पूरा Playground डेमो वापस लाना | डेटाबेस और ZIP में मौजूद WordPress की कोई भी फ़ाइलें, जैसे प्लगइन, थीम और अपलोड |

<!--
If you only need posts and terms, start with WXR. If the content is generated or
depends on setup logic, use `runPHP`. If the database, media, plugins, themes,
and settings must be restored together, use a ZIP snapshot.
-->

अगर आपको सिर्फ़ पोस्ट और टर्म चाहिए, तो WXR से शुरू करें। अगर सामग्री कोड से बनाई जाती है या सेटअप के लॉजिक पर निर्भर है, तो `runPHP` का उपयोग करें। अगर डेटाबेस, मीडिया, प्लगइन, थीम और सेटिंग्स सब एक साथ वापस लाने हैं, तो ZIP स्नैपशॉट का उपयोग करें।

<!-- ## Import a WordPress XML export with `importWxr` -->

## `importWxr` से WordPress XML एक्सपोर्ट इम्पोर्ट करें {#import-a-wordpress-xml-export-with-importwxr}

<!--
WordPress calls its XML export format WordPress eXtended RSS, or WXR. Create one
from **Tools > Export** in an existing WordPress site, then pass it to the
[`importWxr` step](/blueprints/steps).
-->

WordPress अपने XML एक्सपोर्ट फ़ॉर्मेट को WordPress eXtended RSS या WXR कहता है। किसी मौजूदा WordPress साइट में **Tools > Export** से यह फ़ाइल बनाएँ, फिर उसे [`importWxr` स्टेप](/blueprints/steps) को दें।

<!--
This example expects `content.xml` next to `blueprint.json` in a
[Blueprint bundle](/blueprints/bundles):
-->

यह उदाहरण मानता है कि किसी [ब्लूप्रिंट बंडल](/blueprints/bundles) में `blueprint.json` के बगल में `content.xml` मौजूद है:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": false,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

<!--
For a hosted file, replace the `bundled` resource with a
[`url` resource](/blueprints/steps/resources#urlreference). Set
`fetchAttachments` to `true` when the importer must download the media files
referenced by the WXR file. Network transfer can dominate the total setup time,
so the benchmark later in this guide disables attachment fetching.
-->

अगर फ़ाइल कहीं होस्ट की गई है, तो `bundled` रिसोर्स की जगह [`url` रिसोर्स](/blueprints/steps/resources#urlreference) का उपयोग करें। जब इम्पोर्टर को WXR फ़ाइल में बताई गई मीडिया फ़ाइलें डाउनलोड करनी हों, तो `fetchAttachments` को `true` पर सेट करें। सेटअप के कुल समय का ज़्यादातर हिस्सा नेटवर्क ट्रांसफ़र में जा सकता है, इसलिए इस गाइड में आगे दिया गया बेंचमार्क अटैचमेंट डाउनलोड करना बंद रखता है।

<!--
`importWxr` can also map imported authors to local users, create users, and
apply explicit URL replacements. See the
[`importWxr` options](/blueprints/steps) before importing content from
another domain.
-->

`importWxr` इम्पोर्ट किए गए लेखकों को लोकल उपयोगकर्ताओं से जोड़ सकता है, नए उपयोगकर्ता बना सकता है, और तय किए गए URL बदलाव लागू कर सकता है। किसी दूसरे डोमेन से सामग्री इम्पोर्ट करने से पहले [`importWxr` के विकल्प](/blueprints/steps) देखें।

<!-- ### Pros -->

### फ़ायदे {#pros}

<!--
- Uses WordPress's standard, portable content exchange format.
- Preserves post types, taxonomies, post meta, authors, comments, and content
  relationships represented in the export.
- Can fetch attachments and rewrite old content URLs for the new site.
- Keeps content separate from the destination's WordPress core, plugins,
  themes, and most site settings.
- Is easy to inspect, version, and edit manually in any text editor because the
  source is XML.
-->

- WordPress के मानक फ़ॉर्मेट का उपयोग करता है, जिससे सामग्री कहीं भी ले जाई जा सकती है।
- एक्सपोर्ट में मौजूद पोस्ट टाइप, टैक्सोनॉमी, पोस्ट मेटा, लेखक, टिप्पणियाँ और सामग्री के आपसी संबंध बनाए रखता है।
- अटैचमेंट डाउनलोड कर सकता है और नई साइट के लिए सामग्री के पुराने URL बदल सकता है।
- सामग्री को नई साइट के WordPress कोर, प्लगइन, थीम और ज़्यादातर साइट सेटिंग्स से अलग रखता है।
- स्रोत XML होने की वजह से इसे किसी भी टेक्स्ट एडिटर में आसानी से देखा, वर्ज़न किया और हाथ से संपादित किया जा सकता है।

<!-- ### Cons -->

### नुकसान {#cons}

<!--
- Does not clone the whole site. Plugins, themes, plugin tables, options, and
  files that are not represented in WXR need separate Blueprint steps.
- Attachment imports require network access and depend on the old media URLs
  remaining available.
- Large XML files use more parsing time and memory than restoring an existing
  SQLite database.
- Re-importing is additive, not a synchronization. The importer creates terms
  it cannot find and never removes existing content; it only skips a post when
  an existing one matches its title, author, and date.
- The Blueprint installs the WordPress Importer dependency automatically, which
  adds setup work before the WXR import starts.
-->

- पूरी साइट की कॉपी नहीं बनाता। जो प्लगइन, थीम, प्लगइन टेबल, विकल्प और फ़ाइलें WXR में नहीं होतीं, उनके लिए ब्लूप्रिंट के अलग स्टेप चाहिए।
- अटैचमेंट इम्पोर्ट करने के लिए नेटवर्क एक्सेस चाहिए, और यह इस पर निर्भर है कि पुराने मीडिया URL उपलब्ध रहें।
- बड़ी XML फ़ाइलों को पार्स करने में, किसी मौजूदा SQLite डेटाबेस को वापस लाने की तुलना में ज़्यादा समय और मेमोरी लगती है।
- दोबारा इम्पोर्ट करने पर सामग्री जुड़ती है, सिंक नहीं होती। इम्पोर्टर जो टर्म नहीं ढूँढ पाता उन्हें बना देता है, और मौजूदा सामग्री कभी नहीं हटाता। वह किसी पोस्ट को सिर्फ़ तब छोड़ता है जब पहले से मौजूद कोई पोस्ट उसके शीर्षक, लेखक और तारीख से मेल खाती हो।
- ब्लूप्रिंट WordPress Importer को अपने-आप इंस्टॉल करता है, जिससे WXR इम्पोर्ट शुरू होने से पहले सेटअप का काम बढ़ जाता है।

<!-- ## Generate content with `runPHP` -->

## `runPHP` से सामग्री बनाएँ {#generate-content-with-runphp}

<!--
The [`runPHP` step](/blueprints/steps) can call WordPress APIs directly.
Always load `/wordpress/wp-load.php` before calling functions such as
`wp_insert_post()`.
-->

[`runPHP` स्टेप](/blueprints/steps) सीधे WordPress API को कॉल कर सकता है। `wp_insert_post()` जैसे फ़ंक्शन कॉल करने से पहले हमेशा `/wordpress/wp-load.php` लोड करें।

<!-- The following example creates the 100 posts used by the benchmark: -->

नीचे दिया गया उदाहरण बेंचमार्क में इस्तेमाल हुई 100 पोस्ट बनाता है:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\nfor ( $index = 1; $index <= 100; $index++ ) {\n\t$result = wp_insert_post(\n\t\tarray(\n\t\t\t'post_title'   => 'Benchmark post ' . $index,\n\t\t\t'post_content' => '<!-- wp:paragraph --><p>Blueprint import benchmark content.</p><!-- /wp:paragraph -->',\n\t\t\t'post_status'  => 'publish',\n\t\t\t'post_type'    => 'post',\n\t\t),\n\t\ttrue\n\t);\n\tif ( is_wp_error( $result ) ) {\n\t\tthrow new RuntimeException( $result->get_error_message() );\n\t}\n}"
		}
	]
}
```

<!--
For larger programs, keep the code in a small plugin or split the setup across
focused steps instead of maintaining a very long JSON string. Use WordPress
APIs rather than writing directly to database tables so hooks, caches, and data
validation still run. Keep in mind that the code is not limited to content:
`runPHP` can do anything PHP can, including overwriting options or modifying
the database directly.
-->

बड़े प्रोग्राम के लिए, बहुत लंबी JSON स्ट्रिंग संभालने की जगह कोड को एक छोटे प्लगइन में रखें, या सेटअप को कई छोटे-छोटे स्टेप में बाँटें। डेटाबेस टेबल में सीधे लिखने की जगह WordPress API का उपयोग करें, ताकि हुक, कैश और डेटा की जाँच चलती रहे। ध्यान रखें कि यह कोड सिर्फ़ सामग्री तक सीमित नहीं है: `runPHP` वह सब कर सकता है जो PHP कर सकता है, जिसमें विकल्पों को ओवरराइट करना या सीधे डेटाबेस बदलना भी शामिल है।

<!-- ### Pros -->

### फ़ायदे {#pros-1}

<!--
- Provides complete control over the generated data and its relationships.
- Requires no content file and no network access.
- Can configure options, post meta, users, taxonomies, and plugin-specific data
  in the same operation.
- Works well for small test fixtures whose source of truth should remain code.
- Can be made idempotent by looking up existing records before creating them.
-->

- बनाए गए डेटा और उसके आपसी संबंधों पर पूरा नियंत्रण देता है।
- इसके लिए न तो सामग्री फ़ाइल चाहिए और न नेटवर्क एक्सेस।
- एक ही बार में विकल्प, पोस्ट मेटा, उपयोगकर्ता, टैक्सोनॉमी और प्लगइन का अपना डेटा कॉन्फ़िगर कर सकता है।
- ऐसे छोटे टेस्ट फ़िक्स्चर के लिए अच्छा काम करता है जिनका असली स्रोत कोड ही रहना चाहिए।
- नए रिकॉर्ड बनाने से पहले मौजूदा रिकॉर्ड जाँचकर इसे इस तरह बनाया जा सकता है कि बार-बार चलाने पर भी नतीजा एक जैसा रहे।

<!-- ### Cons -->

### नुकसान {#cons-1}

<!--
- A Blueprint is trusted input. Only run PHP from a source you trust.
- The script must handle errors, reruns, dependencies, and partial failures.
- Code can become coupled to a plugin's APIs or database model.
- Creating many records one at a time still runs WordPress hooks and database
  writes for every record, so performance degrades as the dataset grows.
- Custom PHP is more verbose than exporting existing editorial content.
-->

- ब्लूप्रिंट पर भरोसा करके उसे चलाया जाता है। सिर्फ़ उसी स्रोत का PHP चलाएँ जिस पर आपको भरोसा हो।
- स्क्रिप्ट को एरर, दोबारा चलने, निर्भरताओं और आंशिक विफलताओं को खुद संभालना होता है।
- कोड किसी प्लगइन के API या डेटाबेस मॉडल से बँध सकता है।
- बहुत सारे रिकॉर्ड एक-एक करके बनाने पर भी हर रिकॉर्ड के लिए WordPress हुक और डेटाबेस राइट चलते हैं, इसलिए डेटासेट बढ़ने के साथ प्रदर्शन घटता है।
- मौजूदा संपादकीय सामग्री को एक्सपोर्ट करने की तुलना में कस्टम PHP ज़्यादा लंबा होता है।

<!-- ## Restore a Playground ZIP with `importWordPressFiles` -->

## `importWordPressFiles` से Playground ZIP वापस लाएँ {#restore-a-playground-zip-with-importwordpressfiles}

<!--
The [`importWordPressFiles` step](/blueprints/steps) is a
site restore, not a content-only import. It unpacks top-level WordPress files
from a ZIP and replaces the corresponding paths in the new instance. A ZIP
created with Playground's **Download as zip** option includes `wp-content`, its
SQLite database, uploads, and a manifest used to adjust Playground scope URLs.
-->

[`importWordPressFiles` स्टेप](/blueprints/steps) पूरी साइट को वापस लाता है, यह सिर्फ़ सामग्री का इम्पोर्ट नहीं है। यह ZIP से WordPress की ऊपरी स्तर की फ़ाइलें निकालता है और नए इंस्टेंस में उन्हीं पाथ को बदल देता है। Playground के **Download as zip** विकल्प से बनी ZIP में `wp-content`, उसका SQLite डेटाबेस, अपलोड, और एक मैनिफ़ेस्ट होता है, जिसका उपयोग Playground स्कोप URL को ठीक करने के लिए किया जाता है।

<!--
Place the downloaded file next to `blueprint.json` and reference it as a bundled
resource:
-->

डाउनलोड की गई फ़ाइल को `blueprint.json` के बगल में रखें और उसे बंडल किए गए रिसोर्स के रूप में जोड़ें:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

<!--
The ZIP may contain `wp-content` only, a complete WordPress directory, or a
WordPress directory nested inside a wrapper folder. Use `pathInZip` when the
archive contains several sites or when automatic root detection is not enough.
-->

ZIP में सिर्फ़ `wp-content`, पूरी WordPress डायरेक्टरी, या किसी बाहरी फ़ोल्डर के अंदर रखी WordPress डायरेक्टरी हो सकती है। जब आर्काइव में कई साइटें हों, या रूट डायरेक्टरी अपने-आप ठीक से न पहचानी जाए, तो `pathInZip` का उपयोग करें।

<!--
Keep the source and destination WordPress, PHP, theme, and plugin versions
compatible. The step upgrades the imported database and adjusts Playground
scope URLs, but it is not a general migration tool for arbitrary production
server configurations.
-->

स्रोत और नई साइट के WordPress, PHP, थीम और प्लगइन के संस्करण आपस में संगत रखें। यह स्टेप इम्पोर्ट किए गए डेटाबेस को अपग्रेड करता है और Playground स्कोप URL ठीक करता है, लेकिन यह किसी भी प्रोडक्शन सर्वर कॉन्फ़िगरेशन के लिए माइग्रेशन का सामान्य टूल नहीं है।

<!-- ### Pros -->

### फ़ायदे {#pros-2}

<!--
- Restores the database, uploads, plugins, themes, and settings together.
- Preserves plugin-specific tables and options that WXR cannot represent.
- Avoids recreating every post through WordPress APIs, which can be efficient
  for a prepared, repeatable demo.
- Works offline when the snapshot is bundled with the Blueprint.
- Produces the closest copy of the source Playground instance.
-->

- डेटाबेस, अपलोड, प्लगइन, थीम और सेटिंग्स एक साथ वापस लाता है।
- प्लगइन की अपनी टेबल और ऐसे विकल्प बनाए रखता है जिन्हें WXR में नहीं रखा जा सकता।
- हर पोस्ट को WordPress API से दोबारा बनाने की ज़रूरत नहीं पड़ती, जो पहले से तैयार और बार-बार चलाए जाने वाले डेमो के लिए कारगर हो सकता है।
- जब स्नैपशॉट ब्लूप्रिंट के साथ बंडल हो, तो बिना इंटरनेट के काम करता है।
- स्रोत Playground इंस्टेंस की सबसे नज़दीकी कॉपी बनाता है।

<!-- ### Cons -->

### नुकसान {#cons-2}

<!--
- Replaces any top-level paths present in the ZIP, so it can overwrite existing
  site state rather than merge content into it.
- Is larger, opaque, and harder to review or resolve in version-control merges.
- Couples the snapshot to its WordPress, PHP, theme, plugin, and database
  versions more tightly than WXR.
- Is unsuitable for importing selected posts into an existing site.
- Must only be restored from a trusted source; it can contain executable PHP
  and an entire database.
-->

- ZIP में मौजूद ऊपरी स्तर के सभी पाथ बदल देता है, इसलिए यह सामग्री को मिलाने की जगह साइट की मौजूदा स्थिति को ओवरराइट कर सकता है।
- यह बड़ा होता है, इसके अंदर क्या है यह आसानी से नहीं दिखता, और वर्ज़न कंट्रोल में इसकी समीक्षा करना या मर्ज के टकराव सुलझाना मुश्किल होता है।
- WXR की तुलना में स्नैपशॉट अपने WordPress, PHP, थीम, प्लगइन और डेटाबेस के संस्करणों से ज़्यादा कसकर बँधा होता है।
- किसी मौजूदा साइट में चुनी हुई पोस्ट इम्पोर्ट करने के लिए उपयुक्त नहीं है।
- इसे सिर्फ़ भरोसेमंद स्रोत से ही वापस लाएँ, क्योंकि इसमें चलने लायक PHP और पूरा डेटाबेस हो सकता है।

<!-- ### Test results for the different methods -->

### अलग-अलग तरीकों के परीक्षण के नतीजे {#test-results-for-the-different-methods}

<!--
The following test results were measured on July 13, 2026, on an Apple M4 Pro with
24 GB of memory. It used Node.js 22.16, WordPress 7.0, PHP 8.3, 100 posts,
and five fresh-site rounds per method:
-->

नीचे दिए गए परीक्षण के नतीजे 13 जुलाई 2026 को 24 GB मेमोरी वाले Apple M4 Pro पर मापे गए। इसमें Node.js 22.16, WordPress 7.0, PHP 8.3 और 100 पोस्ट का उपयोग हुआ, और हर तरीके के लिए नई साइट पर पाँच राउंड चलाए गए:

<!--
| Method                       |     Input size | Median | Minimum | Maximum | Relative to fastest |
| ---------------------------- | -------------: | -----: | ------: | ------: | ------------------: |
| XML / `importWxr`            |      106.0 KiB | 2.21 s |  2.16 s |  2.25 s |               6.90x |
| PHP / `runPHP`               | Generated code | 2.78 s |  2.76 s |  2.80 s |               8.68x |
| ZIP / `importWordPressFiles` |       50.5 KiB | 320 ms |  318 ms |  322 ms |               1.00x |
-->

| तरीका | इनपुट का आकार | मीडियन | न्यूनतम | अधिकतम | सबसे तेज़ की तुलना में |
| --- | ---: | ---: | ---: | ---: | ---: |
| XML / `importWxr` | 106.0 KiB | 2.21 s | 2.16 s | 2.25 s | 6.90x |
| PHP / `runPHP` | कोड से बना | 2.78 s | 2.76 s | 2.80 s | 8.68x |
| ZIP / `importWordPressFiles` | 50.5 KiB | 320 ms | 318 ms | 322 ms | 1.00x |

<!--
Treat these values as a reference from one machine, not a universal ranking.
The dataset shape matters: attachments favor a self-contained ZIP, complex
WordPress hooks can slow `runPHP`, and WXR's portability may be more important
than raw speed.
-->

इन आँकड़ों को एक मशीन से मिला संदर्भ मानें, सब जगह लागू होने वाली रैंकिंग नहीं। डेटासेट कैसा है, इससे फ़र्क पड़ता है: अटैचमेंट होने पर अपने-आप में पूरी ZIP बेहतर रहती है, जटिल WordPress हुक `runPHP` को धीमा कर सकते हैं, और WXR का कहीं भी ले जाया जा सकना कच्ची रफ़्तार से ज़्यादा अहम हो सकता है।

<!-- ## Other content sources -->

## सामग्री के दूसरे स्रोत {#other-content-sources}

<!--
Blueprints also support [`importThemeStarterContent`](/blueprints/steps)
for a theme's registered starter content and the
[`wp-cli` step](/blueprints/steps) for commands such as
`wp post generate`. They are useful when the theme or WP-CLI command is already
the canonical source of the demo data, but they are outside this content import
benchmark.
-->

ब्लूप्रिंट किसी थीम की रजिस्टर की गई स्टार्टर सामग्री के लिए [`importThemeStarterContent`](/blueprints/steps), और `wp post generate` जैसी कमांड के लिए [`wp-cli` स्टेप](/blueprints/steps) को भी सपोर्ट करते हैं। ये तब उपयोगी हैं जब डेमो डेटा का असली स्रोत पहले से थीम या WP-CLI कमांड ही हो, लेकिन ये सामग्री इम्पोर्ट के इस बेंचमार्क में शामिल नहीं हैं।
