---
title: બ્લુપ્રિન્ટ્સ કેવી રીતે ચલાવવી
slug: /blueprints/tutorial/how-to-load-run-blueprints
description:બ્લુપ્રિન્ટ્સ લોડ કરવા અને ચલાવવા માટેની વિવિધ પદ્ધતિઓ શીખો, જેમાં URL ફ્રેગમેન્ટ અથવા બ્લુપ્રિન્ટ-url પેરામીટરનો ઉપયોગ શામેલ છે.
---

# બ્લુપ્રિન્ટ્સ કેવી રીતે લોડ કરવા અને ચલાવવા

<!--
# How to load and run Blueprints
 -->

## URL ફ્રેગમેન્ટ

<!--
## URL fragment
 -->

બ્લુપ્રિન્ટ્સ ચલાવવાનો સૌથી ઝડપી રસ્તો એ છે કે તેને વર્ડપ્રેસ પ્લેગ્રાઉન્ડ વેબસાઇટના URL "ફ્રેગમેન્ટ" માં પેસ્ટ કરો. ફક્ત `.net/` પછી `#` ઉમેરો.

<!--
The fastest way to run Blueprints is to paste one into the URL "fragment" of a WordPress Playground website. Just add a `#` after the `.net/`.
 -->

ચાલો કહીએ કે તમે નીચેના બ્લુપ્રિન્ટનો ઉપયોગ કરીને વર્ડપ્રેસ અને PHP ના ચોક્કસ સંસ્કરણો સાથે રમતનું મેદાન બનાવવા માંગો છો:

<!--
Let's say you want to create a Playground with specific versions of WordPress and PHP using the following Blueprint:
 -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

તેને ચલાવવા માટે, `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}` પર જાઓ. તમે નીચેના બટનનો પણ ઉપયોગ કરી શકો છો:

<!--
To run it, go to `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. You can also use the button below:
 -->

[<kbd> &nbsp; બ્લુપ્રિન્ટ ચલાવો &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

આગામી પ્રકરણમાં ઉદાહરણ કોડ ચલાવવા માટે આ પદ્ધતિનો ઉપયોગ કરો, [**તમારી પહેલી બ્લુપ્રિન્ટ બનાવો**](/blueprints/tutorial/build-your-first-blueprint).

<!--
Use this method to run the example code in the next chapter, [**Build your first Blueprint**](/blueprints/tutorial/build-your-first-blueprint).
-->

### Base64 એન્કોડેડ બ્લુપ્રિન્ટ્સ

<!--
### Base64 encoded Blueprints
-->

GitHub સહિતના કેટલાક ટૂલ્સ, URL માં પેસ્ટ કરવામાં આવે ત્યારે બ્લુપ્રિન્ટને યોગ્ય રીતે ફોર્મેટ ન પણ કરી શકે. આવા કિસ્સાઓમાં, [તમારા બ્લુપ્રિન્ટને Base64 માં એન્કોડ કરો](https://www.base64encode.org) અને તેને URL માં ઉમેરો. ઉદાહરણ તરીકે, તે Base64 ફોર્મેટમાં ઉપરોક્ત બ્લુપ્રિન્ટ છે: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

<!--
Some tools, including GitHub, might not format the Blueprint correctly when pasted into the URL. In such cases, [encode your Blueprint in Base64](https://www.base64encode.org) and append it to the URL. For example, that's the above Blueprint in Base64 format: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.
-->

તેને ચલાવવા માટે, અહીં જાઓ [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)

<!--
To run it, go to [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)
-->

### URL માંથી બ્લુપ્રિન્ટ લોડ કરો

<!--
### Load Blueprint from a URL
-->

જ્યારે તમારું બ્લુપ્રિન્ટ ખૂબ જટિલ બની જાય, ત્યારે તમે તેને URL માં `?blueprint-url` ક્વેરી પેરામીટર દ્વારા લોડ કરી શકો છો, જેમ કે:

<!--
When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:
-->

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

નોંધ કરો કે બ્લુપ્રિન્ટ સાર્વજનિક રીતે સુલભ હોવી જોઈએ અને [સાચા `Access-Control-Allow-Origin` હેડર] સાથે સેવા આપવી જોઈએ (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin)

<!--
Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin):
-->

```
Access-Control-Allow-Origin: *
```
