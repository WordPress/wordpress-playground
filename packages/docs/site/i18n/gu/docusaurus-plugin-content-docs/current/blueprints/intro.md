---
title: પરિચય
slug: /blueprints
id: introduction
description: બ્લુપ્રિન્ટ્સ દસ્તાવેજીકરણનો મુખ્ય પરિચય. દસ્તાવેજોની રચના શોધો અને મુખ્ય વિભાગો શોધો.
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# બ્લુપ્રિન્ટ્સ ડોક્સ

<!--
# Blueprints Docs
-->

<div class="callout callout-tip">

[બ્લુપ્રિન્ટ્સ ગેલેરી](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો ઉપયોગ કરીને વિવિધ રૂપરેખાંકનો સાથે વર્ડપ્રેસ સાઇટ કેવી રીતે લોન્ચ કરવી તેના વાસ્તવિક કોડ ઉદાહરણો જોવા માટે આ તપાસો.

</div>

<!--
<div class="callout callout-tip">

Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.

</div>
-->

નમસ્તે! વર્ડપ્રેસ પ્લેગ્રાઉન્ડ બ્લુપ્રિન્ટ્સ દસ્તાવેજીકરણમાં આપનું સ્વાગત છે.

<!--
Hi! Welcome to WordPress Playground Blueprints documentation.
-->

બ્લુપ્રિન્ટ્સ એ તમારા પોતાના વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને સેટ કરવા માટે JSON ફાઇલો છે. આ સબસાઇટ (બ્લુપ્રિન્ટ્સ દસ્તાવેજો) એ છે જ્યાં તમને બ્લુપ્રિન્ટ્સનો ઉપયોગ કરવા માટે જરૂરી બધી માહિતી મળશે.

<!--
Blueprints are JSON files for setting up your very own WordPress Playground instance. This subsite (Blueprints Docs) is where you will find all the information you need to use Blueprints.
-->

<p class="docs-hubs">વર્ડપ્રેસ પ્લેગ્રાઉન્ડ દસ્તાવેજીકરણ ચાર અલગ હબ (સબસાઇટ્સ) માં વિતરિત થયેલ છે:</p>

<!--
<p class="docs-hubs">The WordPress Playground documentation is distributed across four separate hubs (subsites):</p>
-->

- [**દસ્તાવેજીકરણ**](/) – WP પ્લેગ્રાઉન્ડનો પરિચય, શરૂઆત માટેની માર્ગદર્શિકાઓ અને WP પ્લેગ્રાઉન્ડ દસ્તાવેજો માટેનો તમારો પ્રવેશ બિંદુ.
- 👉 [**બ્લુપ્રિન્ટ્સ**](/blueprints) બ્લુપ્રિન્ટ્સ એ તમારા વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને સેટ કરવા માટે JSON ફાઇલો છે. આ બ્લુપ્રિન્ટ્સ ડોક્સ હબમાંથી તેમની શક્યતાઓ વિશે જાણો.
- [**ડેવલપર્સ**](/developers) – વર્ડપ્રેસ પ્લેગ્રાઉન્ડ એક પ્રોગ્રામેબલ ટૂલ તરીકે બનાવવામાં આવ્યું છે. ડેવલપર્સ ડોક્સ હબમાં તમારા કોડ દ્વારા તમે શું કરી શકો તે શોધો.
- [**API સંદર્ભ**](/api) – વર્ડપ્રેસ પ્લેગ્રાઉન્ડ દ્વારા ઉપલબ્ધ તમામ API.

<!--
-   [**Documentation**](/) – Introduction to WP Playground, starter guides and your entry point to WP Playground Docs.
-   👉 [**Blueprints**](/blueprints) (you're here) – Blueprints are JSON files for setting up your WordPress Playground instance. Learn about their possibilities from this Blueprints docs hub.
-   [**Developers**](/developers) – WordPress Playground was created as a programmable tool. Discover all the things you can do with it from your code in the Developers docs hub.
-   [**API Reference**](/api) – All the APIs exposed by WordPress Playground
-->

## બ્લુપ્રિન્ટ્સ દસ્તાવેજીકરણ હબ નેવિગેટ કરવું

<!--
## Navigating the Blueprints documentation hub
-->

આ ડોક્સ હબ બ્લુપ્રિન્ટ્સ માહિતી પર કેન્દ્રિત છે અને નીચેના મુખ્ય વિભાગોમાં વિભાજિત થયેલ છે:

<!--
This docs hub is focused on Blueprints info and is divided into the following major sections:
-->

- [બ્લુપ્રિન્ટ્સ સાથે શરૂઆત કરવી](/blueprints/getting-started): બ્લુપ્રિન્ટ JSON ફાઇલોનો ઉપયોગ કરીને વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ સેટ કરવા માટે ઝડપી શરૂઆત માર્ગદર્શિકા.

- [ટ્યુટોરીયલ - બ્લુપ્રિન્ટ્સ 101](/blueprints/tutorial) - બ્લુપ્રિન્ટ્સ API ક્રેશ કોર્સ. આ ટ્યુટોરીયલ તમને થીમ અને પ્લગઇન (અન્ય વસ્તુઓની સાથે) લોડ કરતી બ્લુપ્રિન્ટ બનાવવાની સંપૂર્ણ પ્રક્રિયામાં માર્ગદર્શન આપશે.

-     [બ્લુપ્રિન્ટ ડેટા ફોર્મેટ](/blueprints/data-format): બ્લુપ્રિન્ટ JSON ફાઇલો તમારા પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને વિવિધ ગુણધર્મો સાથે વ્યાખ્યાયિત કરે છે. આ વિભાગ તમને જાણવાની જરૂર હોય તેવા મુખ્ય ગુણધર્મોને પ્રકાશિત કરે છે.

- [બ્લુપ્રિન્ટ્સનો ઉપયોગ](/blueprints/using-blueprints): આ વિભાગમાં બ્લુપ્રિન્ટ્સનો ઉપયોગ કરવાની વિવિધ રીતો શીખો.

- [સ્ટેપ્સ](/blueprints/steps): લોગિન, પ્લગઇન/થીમ સક્રિયકરણ, ફાઇલ કામગીરી અને વધુ જેવા કાર્યો ચલાવવા માટે બ્લુપ્રિન્ટમાં સેટ કરી શકાય તેવા તમામ ઉપલબ્ધ પગલાંઓનો API સંદર્ભ.

- [બ્લુપ્રિન્ટ બંડલ્સ](/blueprints/bundles): બ્લુપ્રિન્ટ બંડલ્સ કેવી રીતે બનાવવા અને તેનો ઉપયોગ કરવો તે શીખો - સ્વ-સમાયેલ પેકેજો જેમાં બ્લુપ્રિન્ટ અને તેના બધા સંસાધનો શામેલ છે.

- [ઉદાહરણો](/blueprints/examples): વિવિધ વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સેટઅપ્સ માટે બ્લુપ્રિન્ટ ઉદાહરણોનું સંકલન, જેમાં થીમ્સ/પ્લગઇન્સ ઇન્સ્ટોલ કરવા, PHP કોડ ચલાવવા, સુવિધાઓ સક્ષમ કરવા અને ચોક્કસ વર્ડપ્રેસ વર્ઝન લોડ કરવાનો સમાવેશ થાય છે.

- [બ્લુપ્રિન્ટ્સનું ટ્રબલશૂટિંગ અને ડિબગિંગ](/blueprints/troubleshoot-and-debug): બ્લુપ્રિન્ટ્સના મુશ્કેલીનિવારણ અને ડિબગીંગ માટે ટિપ્સ અને સાધનો.

<!--
-   [Getting started with Blueprints](/blueprints/getting-started): Quick Start Guide to setting up a WordPress Playground instance using Blueprint JSON files.

-   [Tutorial - Blueprints 101](/blueprints/tutorial) - Blueprints API crash course. The tutorial will guide you through the complete process of creating a blueprint that loads a theme and plugin (among other things).

-   [Blueprint data Format](/blueprints/data-format): Blueprint JSON files define your Playground instance with various properties. This section highlights the key properties you need to know.

-   [Using Blueprints](/blueprints/using-blueprints): Learn in this section different ways to use Blueprints.

-   [Steps](/blueprints/steps): API Reference of all the available steps that can be set in a blueprint to run tasks such as login, plugin/theme activation, file operations, and more.

-   [Blueprint Bundles](/blueprints/bundles): Learn how to create and use Blueprint bundles - self-contained packages that include a Blueprint and all its resources.

-   [Examples](/blueprints/examples): Compilation of Blueprint examples for various WordPress Playground setups, including installing themes/plugins, running PHP code, enabling features, and loading specific WordPress versions.

-   [Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug): Tips and tools for troubleshooting and debugging Blueprints.
-->
