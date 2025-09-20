---
title: ઝડપી પ્રારંભ માર્ગદર્શિકા
slug: /quick-start-guide
description: પ્લેગ્રાઉન્ડ શરૂ કરવા માટે 5 મિનિટની માર્ગદર્શિકા. પ્લગઇન્સનું પરીક્ષણ કેવી રીતે કરવું, થીમ્સ કેવી રીતે અજમાવવી અને વિવિધ WP/PHP વર્ઝનનો ઉપયોગ કેવી રીતે કરવો તે શીખો.
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!-- # Start using WordPress Playground in 5 minutes -->
# 5 મિનિટમાં વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો ઉપયોગ શરૂ કરો

<!-- WordPress Playground can help you with any of the following: -->
વર્ડપ્રેસ પ્લેગ્રાઉન્ડ તમને નીચેના પૈકી કોઈ પણ બાબતમાં મદદ કરી શકે છે:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- This page will guide you through each of these. Oh, and if you're a visual learner – here's a video: -->
આ પેજ તમને આ બધી બાબતોમાં માર્ગદર્શન આપશે. ઓહ, અને જો તમે દ્રશ્ય શીખનાર છો - તો અહીં એક વિડિઓ છે:

<!-- <iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe> -->
<iframe width="752" height="423.2" title="વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે શરૂઆત કરવી" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!-- ## Start a new WordPress site -->
## નવી વર્ડપ્રેસ સાઇટ શરૂ કરો

<!-- Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site. -->
દરેક વખત જ્યારે તમે [playground.wordpress.net પરનો સત્તાવાર ડેમો](https://playground.wordpress.net/) મુલાકાત લો છો, ત્યારે તમને નવી વર્ડપ્રેસ સાઇટ મળે છે.

<!-- You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress. -->
ત્યારબાદ તમે પેજ બનાવી શકો છો, પ્લગઇન્સ અને થીમ્સ અપલોડ કરી શકો છો, તમારી પોતાની સાઇટ ઇમ્પોર્ટ કરી શકો છો અને મોટા ભાગની એવી બધી જ વસ્તુઓ કરી શકો છો જે તમે સામાન્ય વર્ડપ્રેસ પર કરતા હો.

<!-- It's that easy to start! -->
શરૂઆત કરવી એટલી સરળ છે!

<!-- The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page! -->
સંપૂર્ણ સાઇટ તમારા બ્રાઉઝરમાં જ ચાલે છે અને જ્યારે તમે ટેબ બંધ કરો છો ત્યારે કાઢી નાખવામાં આવે છે. ફરીથી શરૂ કરવું છે? ફક્ત પેજ રિફ્રેશ કરો!

<!-- :::info WordPress Playground is private -->
:::info વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ખાનગી છે

<!-- Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over! -->
તમે બનાવેલું બધું તમારા બ્રાઉઝરમાં જ રહે છે અને ક્યાંય મોકલવામાં આવતું **નથી**. તમે પૂર્ણ કરી લો પછી, તમે તમારી સાઇટને ZIP ફાઇલ તરીકે એક્સપોર્ટ કરી શકો છો. અથવા ફક્ત પેજ રિફ્રેશ કરીને ફરીથી શરૂ કરી શકો છો!

:::

<!-- ## Try a block, a theme, or a plugin -->
## એક બ્લોક, એક થીમ અથવા એક પ્લગિન અજમાવો

<!-- You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/). -->
તમે તમારી ઇચ્છા મુજબ કોઈપણ પ્લગિન અથવા થીમ [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/) માં અપલોડ કરી શકો છો.

<!-- To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL: -->
કેટલાંક ક્લિક્સ બચાવવા માટે, તમે URL માં `plugin` અથવા `theme` પેરામીટર ઉમેરીને વર્ડપ્રેસ પ્લગઇન ડિરેક્ટરીમાંથી પ્લગઇન્સ અથવા થીમ્સ પહેલેથી ઇન્સ્ટોલ કરી શકો છો. ઉદાહરણ તરીકે, coblocks પ્લગઇન ઇન્સ્ટોલ કરવા માટે, તમે આ URL નો ઉપયોગ કરી શકો છો:

<!-- https://playground.wordpress.net/?plugin=coblocks -->
https://playground.wordpress.net/?plugin=coblocks

<!-- Or this URL to preinstall the `pendant` theme: -->
અથવા `pendant` થીમ પહેલેથી ઇન્સ્ટોલ કરવા માટે આ URL:

<!-- https://playground.wordpress.net/?theme=pendant -->
https://playground.wordpress.net/?theme=pendant

<!-- You can also mix and match these parameters and even add multiple plugins: -->
તમે આ પેરામિટર્સને મિક્સ અને મેચ પણ કરી શકો છો અને એકથી વધુ પ્લગિન્સ પણ ઉમેરી શકો છો:

<!-- https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant -->
https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

<!-- ## Save your site -->
## તમારી સાઇટ સાચવો

<!-- To keep your WordPress Playground site for longer than a single browser session, you can export it as a `.zip` file. -->
તમારી વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાઇટને એક જ બ્રાઉઝર સેશન કરતાં વધુ સમય સુધી રાખવા માટે, તમે તેને `.zip` ફાઇલ તરીકે એક્સપોર્ટ કરી શકો છો.

<!-- 1. Open the Playground site manager panel: -->
1. પ્લેગ્રાઉન્ડ સાઇટ મેનેજર પેનલ ખોલો:

<!-- ![Site Manager](@site/static/img/open-site-manager.webp) -->
![સાઇટ મેનેજર](@site/static/img/open-site-manager.webp)

<!-- 2. Use the "Download as .zip" button in the additional actions menu -->
2. વધારાના ક્રિયાઓના મેનુમાં "Download as .zip" બટનનો ઉપયોગ કરો

<!-- ![Export button](@site/static/img/site-manager-menu.webp) -->
![એક્સપોર્ટ બટન](@site/static/img/site-manager-menu.webp)

<!-- The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there. -->
એક્સપોર્ટ કરેલી ફાઇલમાં તમે બનાવેલી સંપૂર્ણ સાઇટ સામેલ છે. તમે તેને કોઈપણ સર્વર પર હોસ્ટ કરી શકો છો જે PHP અને SQLite ને સપોર્ટ કરે છે. તમામ વર્ડપ્રેસ કોર ફાઇલો, પ્લગિન્સ, થીમ્સ અને તમે તમારી સાઇટમાં ઉમેરેલી બધી અન્ય વસ્તુઓ તેમાં સામેલ છે.

<!-- The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager. -->
SQLite ડેટાબેસ ફાઇલ પણ એક્સપોર્ટમાં સામેલ છે, તમે તેને `wp-content/database/.ht.sqlite` માં શોધી શકો છો. ધ્યાનમાં રાખો કે ડોટ (.) થી શરૂ થતી ફાઇલો મોટાભાગની ઓપરેટિંગ સિસ્ટમમાં ડિફૉલ્ટ મુજબ છુપાયેલી હોય છે, તેથી તમને તમારા ફાઇલ મેનેજરમાં "Show hidden files" વિકલ્પ સક્રિય કરવાની જરૂર પડી શકે છે.

<!-- ## Restore a saved site -->
## સેવ કરેલી સાઇટ પુનઃસ્થાપિત કરો

<!-- You can restore the saved site using the "Import from .zip" button in the site management panel: -->
તમે સાઇટ મેનેજમેન્ટ પેનલમાં "Import from .zip" બટનનો ઉપયોગ કરીને સેવ કરેલી સાઇટ પુનઃસ્થાપિત કરી શકો છો:

<!-- ![Import from .zip button](@site/static/img/site-manager-import-actions-menu.webp) -->
![Import from .zip બટન](@site/static/img/site-manager-import-actions-menu.webp)

<!-- ## Use a specific WordPress or PHP version -->
## ચોક્કસ વર્ડપ્રેસ અથવા PHP વર્ઝનનો ઉપયોગ કરો

<!-- The quickest way to change the version of WordPress or PHP is by using the settings panel on the [official demo site](https://playground.wordpress.net/): -->
વર્ડપ્રેસ અથવા PHP નું વર્ઝન બદલવાનો સૌથી ઝડપી રસ્તો [સત્તાવાર ડેમો સાઇટ](https://playground.wordpress.net/) પર સેટિંગ્સ પેનલનો ઉપયોગ કરવો છે:

<!-- ![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp) -->
![વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સેટિંગ્સ મેનુ](@site/static/img/playground-settings-menu.webp)

<!-- :::info Test your plugin or theme -->
:::info તમારું પ્લગિન અથવા થીમ તપાસો

<!-- Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage! -->
ઘણા બધા વર્ડપ્રેસ અને PHP વર્ઝન્સ સાથે સુસંગતતા ચકાસવી હંમેશા મુશ્કેલ હતી. વર્ડપ્રેસ પ્લેગ્રાઉન્ડ આ પ્રક્રિયાને સરળ બનાવે છે — તેનો તમારા ફાયદા માટે ઉપયોગ કરો!

:::

<!-- You can also use the `wp` and `php` query parameters to open Playground with the right versions already loaded: -->
તમે `wp` અને `php` ક્વેરી પેરામિટર્સનો ઉપયોગ કરીને યોગ્ય વર્ઝન પહેલેથી લોડ થયેલ સાથે પ્લેગ્રાઉન્ડ ખોલી શકો છો:

-   https://playground.wordpress.net/?wp=6.5
-   https://playground.wordpress.net/?php=8.3
-   https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

<!-- :::info Major versions only -->
:::info માત્ર મુખ્ય વર્ઝન

<!-- You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. -->
તમે `wp=6.2` અથવા `php=8.1` જેવા મુખ્ય વર્ઝન નિર્દેશ કરી શકો છો અને તે શ્રેણીમાં તાજેતરની રિલીઝ અપેક્ષા રાખી શકો છો. જોકે, તમે જૂના માઇનર વર્ઝન માટે વિનંતી કરી શકતા નથી, તેથી `wp=6.1.2` અથવા `php=7.4.9` બંને કામ નહીં કરે.

:::

<!-- ## Import a WXR file -->
## WXR ફાઇલ આયાત કરો

<!-- You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php). -->
તમે [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php) માં WXR ફાઇલ અપલોડ કરીને વર્ડપ્રેસ એક્સપોર્ટ ફાઇલ આયાત કરી શકો છો.

<!-- You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more. -->
તમે [JSON બ્લુપ્રિન્ટ્સ](/blueprints) નો પણ ઉપયોગ કરી શકો છો. વધુ જાણવા માટે [બ્લુપ્રિન્ટ્સ સાથે શરૂઆત કરો](/blueprints/getting-started) જુઓ.

<!-- This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site. -->
આ ઉપર વર્ણવેલી ઇમ્પોર્ટ સુવિધાથી અલગ છે. ઇમ્પોર્ટ સુવિધા ડેટાબેસ સહિત સંપૂર્ણ સાઇટને એક્સપોર્ટ કરે છે. આ ઇમ્પોર્ટ સુવિધા મોજૂદા સાઇટમાં WXR ફાઇલ ઇમ્પોર્ટ કરે છે.

<!-- ## Build apps with WordPress Playground -->
## વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે એપ્સ બનાવો

<!-- WordPress Playground is programmable which means you can build WordPress apps, setup plugin demos, and even use it as a zero-setup local development environment. -->
વર્ડપ્રેસ પ્લેગ્રાઉન્ડ પ્રોગ્રામેબલ છે, જેનો અર્થ એ છે કે તમે વર્ડપ્રેસ એપ્સ બનાવી શકો છો, પ્લગિન ડેમોઝ સેટઅપ કરી શકો છો અને તેને શૂન્ય-સેટઅપ લોકલ ડેવલપમેન્ટ એન્વાયર્નમેન્ટ તરીકે પણ ઉપયોગ કરી શકો છો.

<!-- To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section. -->
વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે ડેવલપમેન્ટ વિશે વધુ જાણવા માટે, [ડેવલપમેન્ટ ક્વિક સ્ટાર્ટ](/developers/build-your-first-app) વિભાગ જુઓ.
