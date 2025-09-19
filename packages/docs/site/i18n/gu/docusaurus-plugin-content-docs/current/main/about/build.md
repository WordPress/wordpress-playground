---
title: બિલ્ડ
slug: /about/build
description: જાણો કે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ તમને કેવી રીતે પ્રોડક્ટ્સ બનાવવા મદદ કરે છે — લોકલ એન્વાયરમેન્ટ્સ સેટઅપ કરવાથી લઈને થીમ્સ અને નવા ટૂલ્સ બનાવવા સુધી.
sidebar_class_name: navbar-build-item
---

# બિલ્ડ

<!--
# Build
-->

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ તમને ઝડપથી બનાવવા અને શીખવામાં મદદ કરી શકે છે, ભલે મોબાઇલ પર સિગ્નલ ન હોય ત્યારે પણ.
તમે પ્લેગ્રાઉન્ડનો ઉપયોગ ત્યાં કરી શકો છો જ્યાં તમે સારું કામ કરો છો — પછી તે બ્રાઉઝર હોય, Node.js, મોબાઇલ એપ્સ, VS કોડ અથવા અન્ય ક્યાંય.

<!--
WordPress Playground can help you to create and learn WordPress quickly, even on mobile with no signal. You can use Playground where you work best, whether that’s in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-->

## ઝડપથી લોકલ વર્ડપ્રેસ એન્વાયરમેન્ટ સેટ કરવું

<!--
## Setting quickly a local WordPress environment
-->

તમે તમારા ડેવલપમેન્ટ વર્કફ્લોમાં પ્લેગ્રાઉન્ડને સરળતાથી ઇન્ટિગ્રેટ કરી શકો છો, જેથી કોડ ટેસ્ટ કરવા માટે તમે ઝડપથી લોકલ વર્ડપ્રેસ એન્વાયરમેન્ટ લોન્ચ કરી શકો. તમે આ સીધા જ [ટર્મિનલમાંથી](/developers/local-development/wp-playground-cli) અથવા [તમારા પસંદગીના IDE](/developers/local-development/vscode-extension) માંથી કરી શકો છો.

<!--
You can seamlessly integrate Playground into your development workflow to launch a local WordPress environment quickly for testing your code. You can do this directly [from the terminal](/developers/local-development/wp-playground-cli) or [your preferred IDE.](/developers/local-development/vscode-extension)
-->

## બ્લોક થીમ પર કરેલા ફેરફારો સાચવો અને GitHub Pull Requests બનાવો

<!--
## Save changes done on a Block Theme and create GitHub Pull Requests
-->

તમે તમારી પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને GitHub રેપોઝિટરી સાથે કનેક્ટ કરી શકો છો અને વર્ડપ્રેસ UI મારફતે કરેલા ફેરફારો સાથે Pull Request બનાવી શકો છો,
[Create Block Theme](https://wordpress.org/plugins/create-block-theme/) પ્લગિનનો ઉપયોગ કરીને.

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you’ve done through the WordPress UI, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin.
-->

આ વર્કફ્લો સાથે, તમે તમારા બ્રાઉઝરમાં જ સંપૂર્ણ બ્લોક થીમ બિલ્ડ કરી શકો છો અને તમારા ફેરફારો GitHub પર સાચવી શકો છો,
અથવા કોઈ હાલની થીમને સુધારી/ફિક્સ કરી શકો છો.

<!--
With this workflow, you could build a block theme completely in your browser and save your change to GitHub, or you could improve/fix an existing one.
-->

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>
આ વર્કફ્લોના થોડા વધુ ઉદાહરણો:

<!--
Some more examples of this workflow:
-->

-   [ડેવલપર અવર્સ: ટેસ્ટિંગ અને ડેમોઝ માટે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ બ્લૂપ્રિન્ટ્સ બનાવવું](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [રીકૅપ હોલવે હેંગઆઉટ: પ્લેગ્રાઉન્ડ સાથે થીમ બિલ્ડિંગ, ક્રિએટ-બ્લોક-થીમ પ્લગિન અને GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
-   [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
-   [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)
-->

## તમારા પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને લોકલ ફોલ્ડર સાથે સિંક્રોનાઈઝ કરો અને GitHub Pull Requests બનાવો

<!--
## Synchronize your playground instance with a local folder and create GitHub Pull Requests
-->

![સ્ટોરેજ ટાઈપ ડિવાઈસ સ્નેપશોટ](@site/static/img/about/storage-type-device.webp)

<!--
[Storage Type Device Snapshot](../_assets/storage-type-device.png)
-->

Google Chrome સાથે તમે તમારી પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને લોકલ ડિરેક્ટરી સાથે સિંક્રોનાઈઝ કરી શકો છો, જે નીચે મુજબ હોઈ શકે:

<!--
With Google Chrome you can synchronize your Playground instance with a local directory, that can be either:
-->

-   ખાલી ડિરેક્ટરી – આ પ્લેગ્રાઉન્ડ સાચવવા અને સિંક શરૂ કરવા માટે
-   એકઝિસ્ટિંગ ડિરેક્ટરી – તેને અહીં લોડ કરવા અને સિંક શરૂ કરવા માટે

<!--
-   And empty directory – to save this Playground and start syncing
-   An existing directory – to load it here and start syncing
-->

:::info

આ ફીચર હાલમાં માત્ર Google Chrome માટે જ ઉપલબ્ધ છે. હજી સુધી આ અન્ય બ્રાઉઝર્સ સાથે કામ કરશે નહીં.

:::

<!--
:::info

This feature is only available for Google Chrome for now. It won't work with other browsers, yet.

:::
-->

કનેક્શનની બંને બાજુએ કરેલા ફેરફારો અંગે:

<!--
Regarding changes done on both sides of the connection:
-->

-   પ્લેગ્રાઉન્ડમાં બદલાયેલી ફાઈલો તમારા કમ્પ્યુટરમાં સિંક્રોનાઈઝ થશે.
-   તમારા કમ્પ્યુટરમાં બદલાયેલી ફાઈલો પ્લેગ્રાઉન્ડમાં સિંક્રોનાઈઝ નહીં થાય. તેના માટે તમને "Sync local files" બટન ક્લિક કરવું પડશે.

<!--
-   Files changed in Playground will be synchronized to your computer.
-   Files changed on your computer will not be synchronized to Playground. You'll need to click the "Sync local files" button.
-->

આ વર્કફ્લો સાથે તમે તમારી લોકલ ડિરેક્ટરીમાં કરેલા ફેરફારોથી સીધા GitHub PRs બનાવી શકો છો.

<!--
With this workflow you can create directly GitHub PRs from your changes done on your local directory.
-->

આ વર્કફ્લોને એક્શનમાં જોવા માટે અહીં એક નાનું ડેમો જુઓ:

<!--
See here a little demo of this workflow in action:
-->

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

## અન્ય API સાથે એકીકૃત થઈને નવા સાધનો બનાવો.

<!--
## Integrate with other APIs to create new tools.
-->

પ્લેગ્રાઉન્ડને વિવિધ API સાથે જોડીને અદ્ભુત સાધનો બનાવી શકાય છે. સંભાવનાઓ અનંત છે.

<!--
Playground can be combined with different APIs to create amazing tools. The possibilities are endless.
-->

તમે [વર્ડપ્રેસ પ્લેગ્રાઉન્ડને નોડ.જેએસમાં ઉપયોગ કરી શકો છો](/developers/local-development/php-wasm-node) નવા સાધનો બનાવવા માટે.
[@php-wasm/node પેકેજ](https://npmjs.org/@php-wasm/node), જે PHP વેબઅસેમ્બલી રન્ટાઈમ પૂરો પાડે છે, એજ પેકેજ [https://playground.wordpress.net/](https://playground.wordpress.net/) માટે પણ ઉપયોગમાં લેવાય છે, ઉદાહરણ તરીકે.

<!--
You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.
-->

પ્લેગ્રાઉન્ડ પર બનેલી બીજી એક રસપ્રદ એપ્લિકેશન છે **ટ્રાન્સલેટ લાઈવ** ([ઉદાહરણ](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) જે, ઓપન એઆઈ સાથે મળીને, એક "ઇન-પ્લેસ" વર્ડપ્રેસ ટ્રાન્સલેશન ટૂલ પૂરું પાડે છે જ્યાં ટ્રાન્સલેશન્સ તેમના વાસ્તવિક સંદર્ભમાં જોઈ અને સંશોધિત કરી શકાય છે (ઉદાહરણ જુઓ). આ ટૂલ વિશે વધુ વાંચો [ટ્રાન્સલેટ લાઈવ: ટ્રાન્સલેશન પ્લેગ્રાઉન્ડમાં અપડેટ્સ](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/) પર.

<!--
Another interesting app built on top of Playground is **Translate Live** (see [example](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) which, in combination with Open AI provides a WordPress translations tool “in place” where translations can be seen and modified in their real context (see example). Read more about this tool at [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)
-->

## ઓફલાઈન કામ કરો અને નેટિવ એપ્લિકેશન તરીકે

<!--
## Work offline and as a native app
-->

જ્યારે તમે પહેલી વાર [playground.wordpress.net](https://playground.wordpress.net/) મુલાકાત લો છો, ત્યારે તમારું બ્રાઉઝર પ્લેગ્રાઉન્ડનો ઉપયોગ કરવા માટેની બધી જરૂરી ફાઈલો આપમેળે કેશ કરે છે. તે બિંદુથી, તમે [playground.wordpress.net](https://playground.wordpress.net/) એક્સેસ કરી શકો છો, ઇન્ટરનેટ કનેક્શન વગર પણ, ખાતરી કરે છે કે તમે તમારી પ્રોજેક્ટ્સ પર વિક્ષેપ વગર કામ ચાલુ રાખી શકો છો.

<!--
When you first visit [playground.wordpress.net](https://playground.wordpress.net/), your browser automatically caches all the necessary files to use Playground. From that point on, you can access [playground.wordpress.net](https://playground.wordpress.net/), even without internet connection, ensuring you can continue working on your projects without interruptions.
-->

તમે પ્લેગ્રાઉન્ડને તમારા ડિવાઇસ પર પ્રોગ્રેસિવ વેબ એપ્લિકેશન (PWA) તરીકે પણ ઇન્સ્ટોલ કરી શકો છો જેથી પ્લેગ્રાઉન્ડને સીધું જ તમારી હોમ સ્ક્રીન પરથી લોન્ચ કરી શકાય—બરાબર નેટિવ એપ્લિકેશનની જેમ.

<!--
You can also install Playground on your device as a Progressive Web App (PWA) to launch the Playground directly from your home screen—just like a native app.
-->

વધુ માહિતી માટે [વર્ડપ્રેસ પ્લેગ્રાઉન્ડ માટે ઓફલાઈન મોડ અને પીડબલ્યુએ સપોર્ટની પરિચય](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) વાંચો.

<!--
Read [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) for more info.
-->

## નોન-વેબ એન્વાયર્નમેન્ટ્સમાં વર્ડપ્રેસ સાઇટ એમ્બેડ કરો

[પ્લેગ્રાઉન્ડ દ્વારા નેટિવ આઈઓએસ એપ્લિકેશનમાં વાસ્તવિક વર્ડપ્રેસ સાઇટ કેવી રીતે શિપ કરવી?](../guides/wordpress-native-ios-app) ગાઈડ દર્શાવે છે કે કેવી રીતે આપણે પ્લેગ્રાઉન્ડનો ઉપયોગ કરીને વર્ડપ્રેસ સાઇટને આઈઓએસ એપ્લિકેશનમાં રેપ કરી શકીએ છીએ.

<!--
The [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) guide shows how we can leverage Playground to wrap a WordPress site into an IOS app.
-->
