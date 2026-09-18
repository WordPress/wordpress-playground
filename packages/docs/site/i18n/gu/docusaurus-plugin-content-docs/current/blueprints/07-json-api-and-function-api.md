---
title: API સુસંગતતા
slug: /blueprints/steps/api-consistency
description: બ્લુપ્રિન્ટ JSON ફોર્મેટ અને સ્ટેપ્સ એક્ઝિક્યુટ કરવા માટે વપરાતા અંતર્ગત JavaScript ફંક્શન API વચ્ચેના સંબંધ વિશે જાણો.
---

# JSON API અને ફંક્શન API

<!--
# JSON API and Function API
-->

બ્લુપ્રિન્ટ્સ JSON ફોર્મેટમાં વ્યાખ્યાયિત કરવામાં આવે છે, પરંતુ અંતર્ગત અમલીકરણ પગલાંઓ ચલાવવા માટે JavaScript ફંક્શન્સનો ઉપયોગ કરે છે. જ્યારે JSON બ્લુપ્રિન્ટ્સ સાથે ક્રિયાપ્રતિક્રિયા કરવાની સૌથી અનુકૂળ રીત છે, ત્યારે તમે અંતર્ગત ફંક્શન્સનો સીધો ઉપયોગ પણ કરી શકો છો.

<!--
Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly.
-->

JSON એ ફંક્શન્સની આસપાસ ફક્ત એક આવરણ છે. તમે JSON સ્ટેપ્સનો ઉપયોગ કરો છો કે એક્સપોર્ટેડ ફંક્શનનો, તમારે સમાન પેરામીટર્સ (સ્ટેપ નામ સિવાય) આપવા પડશે:

<!--
JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name):
-->

તમે બ્લુપ્રિન્ટ્સનો ઉપયોગ વેબ અને વર્ડપ્રેસ પ્લેગ્રાઉન્ડના node.js વર્ઝન બંને પર કરી શકો છો.

<!--
You can use Blueprints both with the web and the node.js versions of WordPress Playground.
-->

<div class="callout callout-info">

**બ્લુપ્રિન્ટ્સ વર્ઝન 2**

ટીમ બ્લુપ્રિન્ટ્સને ટાઇપસ્ક્રિપ્ટ(TypeScript) લાઇબ્રેરીમાંથી PHP લાઇબ્રેરીમાં કેવી રીતે રૂપાંતરિત કરવું તે શોધી રહી છે. આનાથી લોકો કોઈપણ વર્ડપ્રેસ વાતાવરણમાં બ્લુપ્રિન્ટ્સ ચલાવી શકશે: પ્લેગ્રાઉન્ડ, હોસ્ટ કરેલી સાઇટ અથવા સ્થાનિક સેટઅપ.

પ્રસ્તાવિત [નવું સ્પષ્ટીકરણ](https://github.com/WordPress/blueprints-library/issues/6) અલગથી ચર્ચા કરવામાં આવી છે [ગિટહબ ભંડાર](https://github.com/WordPress/blueprints-library/) , અને તમારું જોડાવા માટે ખૂબ સ્વાગત છે (ત્યાં અથવા [#playground] પર(https://wordpress.slack.com/archives/C04EWKGDJ0K) સ્લેક ચેનલ) અને પ્લેગ્રાઉન્ડની આગામી પેઢીને આકાર આપવામાં મદદ કરે છે.

</div>

<!--
<div class="callout callout-info">

**Blueprints version 2**

The team is exploring ways to transition Blueprints from a TypeScript library to a PHP library. This would allow people to run Blueprints in any WordPress environments: Playground, a hosted site, or a local setup.

The proposed [new specification](https://github.com/WordPress/blueprints-library/issues/6) is discussed on a separate [GitHub repository](https://github.com/WordPress/blueprints-library/), and you’re more than welcome to join (there or on the [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) Slack channel) and help shape the next generation of Playground.

</div>
-->

## JSON અને ફંક્શન API વચ્ચેના તફાવતો

<!--
## Differences between JSON and Function APIs
-->

JSON અને ફંક્શન API વચ્ચે બે મુખ્ય તફાવત છે:

<!--
There are two main differences between the JSON and Function APIs:
-->

1. બ્લુપ્રિન્ટ્સ તમારા માટે પ્રોગ્રેસ બાર અને એરર રિપોર્ટિંગને હેન્ડલ કરે છે. ફંક્શન API માટે તમારે આ જાતે હેન્ડલ કરવાની જરૂર છે.
2. ફંક્શન API માટે API ક્લાયંટ લાઇબ્રેરી આયાત કરવાની જરૂર છે જ્યારે બ્લુપ્રિન્ટ્સ ફક્ત URL ફ્રેગમેન્ટમાં પેસ્ટ કરી શકાય છે.

<!--
1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself.
2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment.
-->

<div class="callout callout-info">

આ વિષય વિશે વધુ વિગતવાર માહિતી માટે [વર્ડપ્રેસ-પ્લેગ્રાઉન્ડ](https://github.com/WordPress/wordpress-playground) રેપો પર [બ્લુપ્રિન્ટ JSON વ્યાખ્યાઓ અને સ્ટેપ હેન્ડલર્સ માટે સમાન માળખું વાપરો](https://github.com/WordPress/wordpress-playground/pull/215) સમસ્યા તપાસો.

</div>

<!--
<div class="callout callout-info">

Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic

</div>
-->
