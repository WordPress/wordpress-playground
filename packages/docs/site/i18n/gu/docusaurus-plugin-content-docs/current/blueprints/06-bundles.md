---
title: બ્લુપ્રિન્ટ બંડલ્સ
slug: /blueprints/bundles
description: બ્લુપ્રિન્ટ બંડલ્સ વિશે જાણો, જે સ્વયં-સમાવિષ્ટ પેકેજો છે જેમાં blueprint.json ફાઇલ અને તેના તમામ જરૂરી સંસાધનો સામેલ છે.
---

# બ્લુપ્રિન્ટ બંડલ્સ

<!--
# Blueprint Bundles
-->

બ્લુપ્રિન્ટ બંડલ્સ સ્વયં-સમાવિષ્ટ પેકેજો છે જેમાં બ્લુપ્રિન્ટ ઘોષણા (`blueprint.json`) તેમજ તેને કમ્પાઇલ કરવા અને ચલાવવા માટે જરૂરી તમામ વધારાના સંસાધનો સામેલ હોય છે. આ સંપૂર્ણ વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સેટઅપ્સને વહેંચવાનું અને શેર કરવાનું સરળ બનાવે છે.

<!--
Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups.
-->

## બ્લુપ્રિન્ટ બંડલ્સ શું છે?

<!--
## What are Blueprint Bundles?
-->

બ્લુપ્રિન્ટ બંડલ એ ફાઇલોનો સંગ્રહ છે જેમાં નીચેની વસ્તુઓ સામેલ છે:

<!--
A Blueprint bundle is a collection of files that includes:
-->

1. `blueprint.json` ફાઇલ જે બ્લુપ્રિન્ટ કન્ફિગરેશન વ્યાખ્યાયિત કરે છે
2. બ્લુપ્રિન્ટ દ્વારા સંદર્ભિત કોઈપણ વધારાના સંસાધનો (થીમ્સ, પ્લગઇન્સ, સામગ્રી ફાઇલો, વગેરે)

<!--
1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)
-->

બ્લુપ્રિન્ટ બંડલ્સ વિવિધ ફોર્મેટમાં વહેંચી શકાય છે:

<!--
Blueprint bundles can be distributed in various formats:
-->

- ટોચના સ્તરની `blueprint.json` ફાઇલ અને વધારાના સંસાધનો ધરાવતી ZIP ફાઇલ
- git રિપોઝીટરીની અંદરની ડિરેક્ટરી જ્યાં અન્ય સંસાધનો સાથે `blueprint.json` રહેલો છે
- તમારા કમ્પ્યુટર પર સ્થાનિક ડિરેક્ટરી
- ઇનલાઇન કરવામાં આવેલી સંબંધિત ફાઇલો સાથેનો ઇનલાઇન જાવાસ્ક્રિપ્ટ ઑબ્જેક્ટ

<!--
- A ZIP file with a top-level `blueprint.json` file and additional resources
- A directory inside a git repository where `blueprint.json` resides alongside other resources
- A local directory on your computer
- An inline JavaScript object with the relevant files inlined
-->

## બ્લુપ્રિન્ટ બંડલ્સનો ઉપયોગ કરવો

<!--
## Using Blueprint Bundles
-->

### વેબસાઇટ પર

<!--
### On the Website
-->

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ વેબસાઇટ ડૉકમાં **New → Blueprint URL** દ્વારા અથવા `?blueprint-url=` ક્વેરી પેરામીટર દ્વારા બ્લુપ્રિન્ટ બંડલ્સને સપોર્ટ કરે છે. તમે તમારા બ્લુપ્રિન્ટ બંડલ ધરાવતી ZIP ફાઇલની URL પ્રદાન કરી શકો છો:

<!--
The WordPress Playground website supports Blueprint bundles through **New → Blueprint URL** in the Dock or through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle:
-->

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

ZIP ફાઇલમાં રૂટ સ્તર પર `blueprint.json` ફાઇલ હોવી જોઈએ, સાથે બ્લુપ્રિન્ટ દ્વારા સંદર્ભિત કોઈપણ વધારાના સંસાધનો હોવા જોઈએ.

<!--
The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

### CLI માં

<!--
### In the CLI
-->

પ્લેગ્રાઉન્ડ CLI `--blueprint=` વિકલ્પ દ્વારા બ્લુપ્રિન્ટ બંડલ્સને સપોર્ટ કરે છે. તમે નીચેની વસ્તુઓ પ્રદાન કરી શકો છો:

<!--
The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide:
-->

- બ્લુપ્રિન્ટ બંડલ ધરાવતી સ્થાનિક ડિરેક્ટરીનો પાથ
- બ્લુપ્રિન્ટ બંડલ ધરાવતી સ્થાનિક ZIP ફાઇલનો પાથ
- રિમોટ બ્લુપ્રિન્ટ બંડલની URL (http:// અથવા https://)

<!--
- A path to a local directory containing a Blueprint bundle
- A path to a local ZIP file containing a Blueprint bundle
- A URL to a remote Blueprint bundle (http:// or https://)
-->

ઉદાહરણ તરીકે:

<!--
For example:
-->

```bash
# Using a local ZIP file
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Using a remote URL
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Using a local directory
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

સુરક્ષા કારણોસર CLI મૂળભૂત રીતે સ્થાનિક ફાઇલોની ઍક્સેસને પ્રતિબંધિત કરે છે. જો તમારા બ્લુપ્રિન્ટને એ જ પેરેન્ટ ડિરેક્ટરીમાં ફાઇલોને ઍક્સેસ કરવાની જરૂર હોય, તો તમારે `--blueprint-may-read-adjacent-files` ફ્લેગનો ઉપયોગ કરીને સ્પષ્ટપણે પરવાનગી આપવી પડશે:

<!--
By default, the CLI restricts access to local files for security reasons. If your Blueprint needs to access files in the same parent directory, you need to explicitly grant permission using the `--blueprint-may-read-adjacent-files` flag:
-->

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

## બ્લુપ્રિન્ટ બંડલ્સ બનાવવું

<!--
## Creating Blueprint Bundles
-->

### મૂળભૂત માળખું

<!--
### Basic Structure
-->

મૂળભૂત બ્લુપ્રિન્ટ બંડલ કંઈક આના જેવું દેખાઈ શકે છે:

<!--
A basic Blueprint bundle might look like this:
-->

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

### બંડલ કરેલા સંસાધનો સાથે ઉદાહરણ બ્લુપ્રિન્ટ

<!--
### Example Blueprint with Bundled Resources
-->

અહીં એક `blueprint.json` ફાઇલનું ઉદાહરણ છે જે બંડલ કરેલા સંસાધનોનો સંદર્ભ આપે છે:

<!--
Here's an example of a `blueprint.json` file that references bundled resources:
-->

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

આ ઉદાહરણમાં, બ્લુપ્રિન્ટ કેટલાક બંડલ કરેલ સંસાધનોનો સંદર્ભ આપે છે:

<!--
In this example, the Blueprint references several bundled resources:
-->

- `/bundled-text-file.txt` પર આવેલી ટેક્સ્ટ ફાઇલ
- `/theme.zip` પર આવેલી થીમ ZIP ફાઇલ
- `/plugin.zip` પર આવેલી પ્લગઇન ZIP ફાઇલ
- `/content/sample-content.wxr` પર આવેલી WXR કન્ટેન્ટ ફાઇલ

<!--
- A text file at `/bundled-text-file.txt`
- A theme ZIP file at `/theme.zip`
- A plugin ZIP file at `/plugin.zip`
- A WXR content file at `/content/sample-content.wxr`
-->

### ZIP બંડલ બનાવવું

<!--
### Creating a ZIP Bundle
-->

ZIP બંડલ બનાવવા માટે, ખાલી તમારી `blueprint.json` અને તમામ જરૂરી સંસાધનો સાથે એક ડિરેક્ટરી બનાવો, અને પછી તેને ઝિપ કરો:

<!--
To create a ZIP bundle, simply create a directory with your `blueprint.json` and all required resources, then zip it up:
-->

```bash
# Create a directory for your bundle
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Create your blueprint.json and add resources
# ...

# Zip it up
zip -r ../my-blueprint-bundle.zip .
```

## ZIP ફાઇલ સ્ટ્રક્ચર ફ્લેક્સિબિલિટી

<!--
## ZIP File Structure Flexibility
-->

બ્લુપ્રિન્ટ બંડલ્સ ZIP ફાઇલમાં બે સ્થાનો પર `blueprint.json` ને સપોર્ટ કરે છે:

<!--
Blueprint bundles support `blueprint.json` at two locations within a ZIP file:
-->

1. **રૂટ લેવલ** (પ્રમાણભૂત): `blueprint.json` સીધી ZIP રૂટ પર રહે છે
2. **એક ડિરેક્ટરી ઊંડે**: `blueprint.json` સિંગલ ટોપ-લેવલ ડિરેક્ટરીની અંદર રહે છે

<!--
1. **Root level** (standard): `blueprint.json` sits directly at the ZIP root
2. **One directory deep**: `blueprint.json` sits inside a single top-level directory
-->

આનો અર્થ એ છે કે macOS ના રાઇટ-ક્લિક "Compress" ફીચર (જે સામગ્રીને ફોલ્ડરમાં લપેટે છે) સાથે બનાવેલ ZIP ફાઇલો આપોઆપ કાર્ય કરે છે. ડિટેક્શન દરમિયાન `__MACOSX` મેટાડેટા ડિરેક્ટરીને અવગણવામાં આવે છે.

<!--
This means ZIP files created with macOS's right-click "Compress" feature (which wraps contents in a folder) work automatically. The `__MACOSX` metadata directory is ignored during detection.
-->

**ઉદાહરણ: આ બંને ZIP સ્ટ્રક્ચર્સ કાર્ય કરે છે:**

<!--
**Example: Both of these ZIP structures work:**
-->

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

જો બહુવિધ ટોપ-લેવલ ડિરેક્ટરીઓમાં `blueprint.json` હોય, તો પ્લેગ્રાઉન્ડ અસ્પષ્ટતા ટાળવા માટે ભૂલ પરત કરે છે.

<!--
If multiple top-level directories contain a `blueprint.json`, Playground returns an error to avoid ambiguity.
-->

## મુશ્કેલીનિવારણ

<!--
## Troubleshooting
-->

જો તમને બ્લુપ્રિન્ટ બંડલ્સ સાથે સમસ્યાઓનો સામનો કરવો પડે છે:

<!--
If you encounter issues with Blueprint bundles:
-->

1. ખાતરી કરો કે તમારી `blueprint.json` ફાઇલ તમારી ZIP ફાઇલના રૂટ લેવલ પર છે અથવા સિંગલ ટોપ-લેવલ ડિરેક્ટરીની અંદર છે
2. તપાસો કે તમારા બંડલ કરેલા સંસાધન સંદર્ભોમાં તમામ પાથ સાચા છે
3. ચકાસો કે તમારી ZIP ફાઇલ યોગ્ય રીતે ફોર્મેટ થયેલ છે
4. CLI નો ઉપયોગ કરતી વખતે, તપાસો કે શું તમને `--blueprint-may-read-adjacent-files` ફ્લેગની જરૂર છે
5. ખાતરી કરો કે તમામ જરૂરી સંસાધનો બંડલમાં સામેલ છે

<!--
1. Ensure your `blueprint.json` file is at the root level of your ZIP file or inside a single top-level directory
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
-->
