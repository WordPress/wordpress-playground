---
title: શરૂઆત કરવી
slug: /blueprints/getting-started
description: બ્લુપ્રિન્ટ્સ માટે એક ઝડપી શરૂઆત માર્ગદર્શિકા. તેઓ કઈ સમસ્યાઓનું નિરાકરણ લાવે છે અને તમે તેનો ઉપયોગ કેવી રીતે શરૂ કરી શકો છો તે સમજો.
---

# બ્લુપ્રિન્ટ્સ સાથે શરૂઆત કરવી

<!--
# Getting started with Blueprints
-->

બ્લુપ્રિન્ટ્સ એ તમારા પોતાના વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને સેટ કરવા માટે JSON ફાઇલો છે. ઉદાહરણ તરીકે:

<!--
Blueprints are JSON files for setting up your very own WordPress Playground instance. For example:
-->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.0",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}
```

બ્લુપ્રિન્ટ્સનો ઉપયોગ કરવાની ત્રણ રીતો છે:

<!--
There are three ways to use Blueprints:
-->

-   [વર્ડપ્રેસ પ્લેગ્રાઉન્ડ વેબસાઇટ પર URL "ફ્રેગમેન્ટ" માં બ્લુપ્રિન્ટ પેસ્ટ કરો](/blueprints/using-blueprints#url-fragment)。
-   [JavaScript API સાથે તેનો ઉપયોગ કરો](/blueprints/using-blueprints#javascript-api)。
-   [QueryParam દ્વારા બ્લુપ્રિન્ટ JSON ફાઇલનો સંદર્ભ આપો blueprint-url](/developers/apis/query-api/).

<!--
-   [Paste a Blueprint into the URL "fragment" on WordPress Playground website](/blueprints/using-blueprints#url-fragment).
-   [Use them with the JavaScript API](/blueprints/using-blueprints#javascript-api).
-   [Reference a blueprint JSON file via QueryParam blueprint-url](/developers/apis/query-api/)
-->

## બ્લુપ્રિન્ટ્સ દ્વારા કઈ સમસ્યાઓ હલ થાય છે?

<!--
## What problems are solved by Blueprints?
-->

### કોડિંગ કૌશલ્ય જરૂરી નથી

<!--
### No coding skills required
-->

બ્લુપ્રિન્ટ્સ ફક્ત JSON છે. તમારે ડેવલપમેન્ટ એન્વાયર્નમેન્ટ, કોઈ લાઇબ્રેરી, કે JavaScript જ્ઞાનની જરૂર નથી. તમે તેને કોઈપણ ટેક્સ્ટ એડિટરમાં લખી શકો છો.

<!--
Blueprints are just JSON. You don't need a development environment, any libraries, or even JavaScript knowledge. You can write them in any text editor.
-->

જોકે, જો તમારી પાસે ડેવલપમેન્ટ એન્વાયર્નમેન્ટ હોય, તો તે ખૂબ સરસ છે! તમે સ્વતઃપૂર્ણતા અને માન્યતા મેળવવા માટે[બ્લુપ્રિન્ટ JSON સ્કીમા](https://playground.wordpress.net/blueprint-schema.json) નો ઉપયોગ કરી શકો છો.

<!--
However, if you do have a development environment, that's great! You can use the [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) to get autocompletion and validation.
-->

### HTTP વિનંતીઓ તમારા માટે મેનેજ કરવામાં આવે છે

<!--
### HTTP Requests are managed for you
-->

બ્લુપ્રિન્ટ્સ તમારા માટે જાહેર કરેલા કોઈપણ સંસાધનો મેળવે છે. તમારે બહુવિધ `fetch()` કોલ્સનું સંચાલન કરવાની અથવા તેમના સમાપ્ત થવાની રાહ જોવાની ચિંતા કરવાની જરૂર નથી. તમે ફક્ત થોડી લિંક્સ જાહેર કરી શકો છો અને બ્લુપ્રિન્ટ્સને ડાઉનલોડિંગ પાઇપલાઇનને હેન્ડલ અને ઑપ્ટિમાઇઝ કરવા દો.

<!--
Blueprints fetch any resources you declare for you. You don't have to worry about managing multiple `fetch()` calls or waiting for them to finish. You can just declare a few links and let Blueprints handle and optimize the downloading pipeline.
-->

### તમે બ્લુપ્રિન્ટ-પૂર્વ-રૂપરેખાંકિત રમતના મેદાન સાથે લિંક કરી શકો છો

<!--
### You can link to a Blueprint-preconfigured Playground
-->

બ્લુપ્રિન્ટ્સ URL માં પેસ્ટ કરી શકાય છે, તેથી તમે ચોક્કસ ગોઠવણી સાથે પ્લેગ્રાઉન્ડને એમ્બેડ અથવા લિંક કરી શકો છો. ઉદાહરણ તરીકે, આ બટન પર ક્લિક કરવાથી PHP 8.3 અને પેન્ડન્ટ થીમ ઇન્સ્ટોલ કરેલું પ્લેગ્રાઉન્ડ ખુલશે:

<!--
Because Blueprints can be pasted in the URL, you can embed or link to a Playground with a specific configuration. For example, clicking this button will open a Playground with PHP 8.3 and a pendant theme installed:
-->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
  		"wp": "latest"
	},
	"steps": [
        {
            "step": "installTheme",
            "themeData": {
                "resource": "wordpress.org/themes",
            	"slug": "pendant"
            },
            "options": {
                "activate": true
            }
        }
	]
}} />

### ડિફૉલ્ટ રૂપે વિશ્વસનીય

<!--
### Trusted by default
-->

બ્લુપ્રિન્ટ્સ ફક્ત JSON છે. અન્ય લોકોના બ્લુપ્રિન્ટ્સ ચલાવવા માટે વિશ્વાસની જરૂર નથી. કારણ કે બ્લુપ્રિન્ટ્સ મનસ્વી JavaScript ચલાવી શકતા નથી, તેમની ક્ષમતાઓ મર્યાદિત છે.

<!--
Blueprints are just JSON. Running other people's Blueprints doesn't require the element of trust. Since Blueprints cannot execute arbitrary JavaScript, they are limited in what they can do.
-->

બ્લુપ્રિન્ટ્સ સાથે, WordPress.org પ્લગઇન ડિરેક્ટરી પ્લગઇન્સના લાઇવ પૂર્વાવલોકનો ઓફર કરી શકે છે. પ્લગઇન લેખકો ફક્ત એક કસ્ટમ બ્લુપ્રિન્ટ લખશે જેથી પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને કોઈપણ સાઇટ વિકલ્પો અથવા સ્ટાર્ટર સામગ્રી સાથે પૂર્વ-રૂપરેખાંકિત કરી શકાય જેની તેમને જરૂર પડી શકે.

<!--
With Blueprints, WordPress.org plugin directory may be able to offer live previews of plugins. Plugin authors will just write a custom Blueprint to preconfigure the Playground instance with any site options or starter content they may need.
-->

### એકવાર લખો, ગમે ત્યાં વાપરો

<!--
### Write it once, use it anywhere
-->

બ્લુપ્રિન્ટ્સ વેબ પર અને Node.js બંનેમાં કામ કરે છે. તમે તેમને બંનેને એક જ JavaScript પ્રક્રિયામાં અને રિમોટ પ્લેગ્રાઉન્ડ ક્લાયંટ દ્વારા ચલાવી શકો છો. તે રૂપરેખાંકનની સાર્વત્રિક ભાષા છે. જ્યાં તમે પ્લેગ્રાઉન્ડ ચલાવી શકો છો, ત્યાં તમે બ્લુપ્રિન્ટ્સનો ઉપયોગ કરી શકો છો.

<!--
Blueprints work both on the web and in node.js. You can run them both in the same JavaScript process, and through a remote Playground Client. They are the universal language of configuration. Where you can run Playground, you can use Blueprints.
-->