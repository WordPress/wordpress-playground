---
title: ब्लूप्रिंट बंडल
slug: /blueprints/bundles
description: ब्लूप्रिंट बंडल के बारे में जानें, यानी ऐसे पैकेज जो अपने आप में पूरे होते हैं और जिनमें एक blueprint.json फ़ाइल के साथ उसके सभी ज़रूरी रिसोर्स शामिल होते हैं।
---

<!-- # Blueprint Bundles -->

# ब्लूप्रिंट बंडल

<!-- Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups. -->

ब्लूप्रिंट बंडल ऐसे पैकेज हैं जो अपने आप में पूरे होते हैं। इनमें एक ब्लूप्रिंट डिक्लेरेशन (`blueprint.json`) के साथ वे सभी अतिरिक्त रिसोर्स होते हैं जो उसे कंपाइल करने और चलाने के लिए ज़रूरी हैं। इससे पूरे WordPress Playground सेटअप को बाँटना और शेयर करना आसान हो जाता है।

<!-- ## What are Blueprint Bundles? -->

## ब्लूप्रिंट बंडल क्या हैं? {#what-are-blueprint-bundles}

<!-- A Blueprint bundle is a collection of files that includes: -->

ब्लूप्रिंट बंडल फ़ाइलों का एक संग्रह है, जिसमें ये शामिल होते हैं:

<!--
1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)
-->

1. एक `blueprint.json` फ़ाइल, जो ब्लूप्रिंट का कॉन्फ़िगरेशन तय करती है
2. ब्लूप्रिंट में इस्तेमाल किए गए सभी अतिरिक्त रिसोर्स (थीम, प्लगइन, कंटेंट फ़ाइलें वगैरह)

<!-- Blueprint bundles can be distributed in various formats: -->

ब्लूप्रिंट बंडल कई फ़ॉर्मेट में बाँटे जा सकते हैं:

<!--
- A ZIP file with a top-level `blueprint.json` file and additional resources
- A directory inside a git repository where `blueprint.json` resides alongside other resources
- A local directory on your computer
- An inline JavaScript object with the relevant files inlined
-->

- एक ZIP फ़ाइल, जिसके सबसे ऊपरी लेवल पर `blueprint.json` फ़ाइल और बाकी रिसोर्स हों
- किसी git रिपॉज़िटरी के अंदर एक डायरेक्टरी, जहाँ `blueprint.json` बाकी रिसोर्स के साथ रखी हो
- आपके कंप्यूटर पर एक लोकल डायरेक्टरी
- एक इनलाइन JavaScript ऑब्जेक्ट, जिसमें ज़रूरी फ़ाइलें इनलाइन हों

<!-- ## Using Blueprint Bundles -->

## ब्लूप्रिंट बंडल का इस्तेमाल {#using-blueprint-bundles}

<!-- ### On the Website -->

### वेबसाइट पर {#on-the-website}

<!-- The WordPress Playground website supports Blueprint bundles through **New → From a URL** in the Dock or through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle: -->

WordPress Playground वेबसाइट पर ब्लूप्रिंट बंडल Dock में **New → From a URL** से या `?blueprint-url=` क्वेरी पैरामीटर से लोड किए जा सकते हैं। आप अपने ब्लूप्रिंट बंडल वाली ZIP फ़ाइल का URL दे सकते हैं:

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

<!-- When the Playground URL includes the `mcp-port` parameter, Playground rejects the `blueprint-url` parameter. Remove `mcp-port` from the URL to load a bundle this way. -->

जब Playground URL में `mcp-port` पैरामीटर होता है, तो Playground `blueprint-url` पैरामीटर को स्वीकार नहीं करता। इस तरह बंडल लोड करने के लिए URL से `mcp-port` हटा दें।

<!-- The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint. -->

ZIP फ़ाइल के रूट लेवल पर एक `blueprint.json` फ़ाइल होनी चाहिए, साथ ही वे सभी अतिरिक्त रिसोर्स भी, जिनका ब्लूप्रिंट में इस्तेमाल हुआ है।

<!-- ### In the CLI -->

### CLI में {#in-the-cli}

<!-- The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide: -->

Playground CLI में ब्लूप्रिंट बंडल `--blueprint=` विकल्प से दिए जाते हैं। आप इनमें से कोई भी दे सकते हैं:

<!--
- A path to a local directory containing a Blueprint bundle
- A path to a local ZIP file containing a Blueprint bundle
- A URL to a remote Blueprint bundle (http:// or https://)
-->

- ब्लूप्रिंट बंडल वाली लोकल डायरेक्टरी का पाथ
- ब्लूप्रिंट बंडल वाली लोकल ZIP फ़ाइल का पाथ
- किसी रिमोट ब्लूप्रिंट बंडल का URL (http:// या https://)

<!-- For example: -->

उदाहरण के लिए:

```bash
# Using a local ZIP file
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Using a remote URL
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Using a local directory
npx @wp-playground/cli --blueprint=./my-blueprint-directory --blueprint-may-read-adjacent-files server
```

<!-- By default, the CLI restricts access to local files for security reasons. If your Blueprint needs to access files in the same parent directory, you need to explicitly grant permission using the `--blueprint-may-read-adjacent-files` flag: -->

सुरक्षा के लिए CLI डिफ़ॉल्ट रूप से लोकल फ़ाइलों तक पहुँच सीमित रखता है। अगर आपके ब्लूप्रिंट को उसी पैरेंट डायरेक्टरी की फ़ाइलें पढ़नी हैं, तो आपको `--blueprint-may-read-adjacent-files` फ़्लैग से साफ़ तौर पर इसकी अनुमति देनी होगी:

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

<!-- ## Creating Blueprint Bundles -->

## ब्लूप्रिंट बंडल बनाना {#creating-blueprint-bundles}

<!-- ### Basic Structure -->

### बुनियादी ढाँचा {#basic-structure}

<!-- A basic Blueprint bundle might look like this: -->

एक बुनियादी ब्लूप्रिंट बंडल कुछ ऐसा दिख सकता है:

```
my-blueprint-bundle/
├── blueprint.json
├── bundled-text-file.txt
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

<!-- ### Example Blueprint with Bundled Resources -->

### बंडल किए गए रिसोर्स वाला ब्लूप्रिंट: एक उदाहरण {#example-blueprint-with-bundled-resources}

<!-- Here's an example of a `blueprint.json` file that references bundled resources: -->

यहाँ एक `blueprint.json` फ़ाइल का उदाहरण है, जो बंडल किए गए रिसोर्स का इस्तेमाल करती है:

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/theme.zip"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/plugin.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content/sample-content.wxr"
			}
		}
	]
}
```

<!-- In this example, the Blueprint references several bundled resources: -->

इस उदाहरण में ब्लूप्रिंट कई बंडल किए गए रिसोर्स का इस्तेमाल करता है:

<!--
- A text file at `/bundled-text-file.txt`
- A theme ZIP file at `/theme.zip`
- A plugin ZIP file at `/plugin.zip`
- A WXR content file at `/content/sample-content.wxr`
-->

- `/bundled-text-file.txt` पर एक टेक्स्ट फ़ाइल
- `/theme.zip` पर एक थीम ZIP फ़ाइल
- `/plugin.zip` पर एक प्लगइन ZIP फ़ाइल
- `/content/sample-content.wxr` पर एक WXR कंटेंट फ़ाइल

<!-- ### Creating a ZIP Bundle -->

### ZIP बंडल बनाना {#creating-a-zip-bundle}

<!-- To create a ZIP bundle, simply create a directory with your `blueprint.json` and all required resources, then zip it up: -->

ZIP बंडल बनाने के लिए, बस एक डायरेक्टरी बनाएँ जिसमें आपकी `blueprint.json` और सभी ज़रूरी रिसोर्स हों, फिर उसे ZIP कर दें:

```bash
# Create a directory for your bundle
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Create your blueprint.json and add resources
# ...

# Zip it up
zip -r ../my-blueprint-bundle.zip .
```

<!-- ## ZIP File Structure Flexibility -->

## ZIP फ़ाइल के ढाँचे में लचीलापन {#zip-file-structure-flexibility}

<!-- Playground looks for `blueprint.json` in a ZIP file in this order: -->

Playground, ZIP फ़ाइल में `blueprint.json` को इस क्रम में ढूँढता है:

<!--
1. **Root level** (standard): if `blueprint.json` sits directly at the ZIP root, Playground uses it.
2. **One directory deep**: if there is no `blueprint.json` at the root, the ZIP must contain exactly one top-level directory, not counting `__MACOSX`, and that directory must contain `blueprint.json`.
-->

1. **रूट लेवल** (स्टैंडर्ड): अगर `blueprint.json` सीधे ZIP के रूट पर है, तो Playground उसी को इस्तेमाल करता है।
2. **एक डायरेक्टरी अंदर**: अगर रूट पर `blueprint.json` नहीं है, तो ZIP में `__MACOSX` को छोड़कर सबसे ऊपरी लेवल पर ठीक एक डायरेक्टरी होनी चाहिए, और उस डायरेक्टरी में `blueprint.json` होनी चाहिए।

<!-- This means ZIP files created with macOS's right-click "Compress" feature (which wraps contents in a folder) work automatically. -->

इसका मतलब है कि macOS में राइट क्लिक करके "Compress" से बनी ZIP फ़ाइलें (जो कंटेंट को एक फ़ोल्डर में रख देती हैं) अपने आप काम करती हैं।

<!-- **Example: Both of these ZIP structures work:** -->

**उदाहरण: ये दोनों ZIP ढाँचे काम करते हैं:**

```
# Structure A (root level)
my-bundle.zip/
├── blueprint.json
├── theme.zip
└── plugin.zip

# Structure B (one directory deep — macOS-style)
my-bundle.zip/
├── my-bundle/
│   ├── blueprint.json
│   ├── theme.zip
│   └── plugin.zip
└── __MACOSX/         ← ignored
```

<!-- If there is no `blueprint.json` at the root and the ZIP contains more than one top-level directory, Playground returns an error, even if only one of them contains a `blueprint.json`. -->

अगर रूट पर `blueprint.json` नहीं है और ZIP में सबसे ऊपरी लेवल पर एक से ज़्यादा डायरेक्टरी हैं, तो Playground एक एरर लौटाता है, भले ही उनमें से सिर्फ़ एक में `blueprint.json` हो।

<!-- ## Troubleshooting -->

## समस्या निवारण {#troubleshooting}

<!-- If you encounter issues with Blueprint bundles: -->

अगर ब्लूप्रिंट बंडल के साथ कोई समस्या आए:

<!--
1. Ensure your `blueprint.json` file is at the root level of your ZIP file or inside a single top-level directory
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
-->

1. पक्का करें कि आपकी `blueprint.json` फ़ाइल ZIP फ़ाइल के रूट लेवल पर हो, या सबसे ऊपरी लेवल की एक अकेली डायरेक्टरी के अंदर हो
2. जाँचें कि बंडल किए गए रिसोर्स के सभी पाथ सही हैं
3. पक्का करें कि आपकी ZIP फ़ाइल सही फ़ॉर्मेट में है
4. CLI इस्तेमाल करते समय देखें कि कहीं आपको `--blueprint-may-read-adjacent-files` फ़्लैग की ज़रूरत तो नहीं है
5. पक्का करें कि सभी ज़रूरी रिसोर्स बंडल में शामिल हैं
