---
title: મૂળ iOS એપ્લિકેશન્સમાં વર્ડપ્રેસ પ્લેગ્રાઉન્ડ
slug: /guides/wordpress-native-ios-app
description: પ્લેગ્રાઉન્ડનો ઉપયોગ કરીને "બ્લોકનોટ્સ" કેસ સ્ટડીના આધારે, મૂળ iOS એપ્લિકેશનમાં વર્ડપ્રેસ સાઇટ કેવી રીતે ચલાવવી તે શોધો.
---

## પ્લેગ્રાઉન્ડ દ્વારા મૂળ iOS એપ્લિકેશનમાં વાસ્તવિક વર્ડપ્રેસ સાઇટ કેવી રીતે મોકલવી?

<!--
## How to ship a real WordPress site in a native iOS app via Playground?
-->

બ્લોકનોટ્સ એ પહેલી iOS એપ્લિકેશન છે જે વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો ઉપયોગ કરીને iOS ઉપકરણો પર વર્ડપ્રેસને નેટીવલી ચલાવે છે. વર્ડપ્રેસ માટે મુખ્ય પ્રતિબદ્ધતા [Ella van Durpe] (https://profiles.wordpress.org/ellatrix/) દ્વારા વિકસિત, બ્લોકનોટ્સ પરંપરાગત PHP સર્વરની જરૂરિયાત વિના વર્ડપ્રેસ ચલાવવા માટે વેબએસેમ્બલી(WebAssembly) નો ઉપયોગ કરીને મોબાઇલ એપ્લિકેશનોની ક્ષમતાઓમાં નોંધપાત્ર છલાંગ રજૂ કરે છે.

<!--
Blocknotes is the first iOS application that ran WordPress natively on iOS devices by leveraging WordPress Playground. Developed by [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), a core committer for WordPress, Blocknotes represents a significant leap in the capabilities of mobile applications by utilizing WebAssembly to run WordPress without the need for a traditional PHP server.
-->

આ કેસ સ્ટડી મોબાઇલ અને વેબ ડેવલપમેન્ટના ભવિષ્ય માટે બ્લોકનોટ્સની વિશેષતાઓ, તકનીકી અમલીકરણ અને સંભવિત અસરોની શોધ કરે છે.

<!--
This case study explores the features, technical implementation, and potential implications of Blocknotes for the future of mobile and web development.
-->

**મહત્વપૂર્ણ!** બ્લોકનોટ્સનું વર્તમાન સંસ્કરણ હવે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ચલાવતું નથી. પ્રારંભિક પ્રકાશન પછી, એપ્લિકેશનને બાકીના વર્ડપ્રેસ વિના ફક્ત વર્ડપ્રેસ બ્લોક એડિટરનો ઉપયોગ કરવા માટે ફરીથી લખવામાં આવી હતી. આ કેસ સ્ટડી બ્લોકનોટ્સના પ્રારંભિક સંસ્કરણોને આવરી લે છે જેણે વર્ડપ્રેસ માટે નવી શક્યતાઓની આખી દુનિયા ખોલી.

<!--
**Important!** The current version of Blocknotes isn’t running WordPress Playground anymore. Since the initial release, the app was rewritten to only use the WordPress block editor without the rest of WordPress. This case study covers the early versions of Blocknotes that opened an entire world of new possibilities for WordPress.
-->

## બ્લોકનોટ્સ સુવિધાઓ

<!--
## Blocknotes features
-->

બ્લોકનોટ્સ વપરાશકર્તાઓને વર્ડપ્રેસ બ્લોક એડિટરનો ઉપયોગ કરીને નોંધો બનાવવા અને સંપાદિત કરવાની મંજૂરી આપે છે. નોંધો આપમેળે વપરાશકર્તાના iCloud ડ્રાઇવ પર HTML ફાઇલો તરીકે સાચવવામાં આવે છે અને બધા ઉપકરણો પર એકીકૃત રીતે સમન્વયિત થાય છે.

<!--
Blocknotes allows users to create and edit notes using the WordPress block editor. The notes are automatically saved as HTML files to the user’s iCloud Drive and seamlessly synchronized across devices.
-->

## ટેકનિકલ અમલીકરણ

<!--
## Technical Implementation
-->

બ્લોકનોટ્સ એક HTML પેજ ચલાવતા WebView તરીકે કામ કરતા હતા જ્યાં PHP નું વેબએસેમ્બલી(WebAssembly) વર્ઝન વર્ડપ્રેસ ચલાવતું હતું. તે HTML પેજ [Capacitor](https://capacitorjs.com/) દ્વારા મૂળ iOS તરીકે પેક કરવામાં આવ્યું હતું. આ સેટઅપથી વર્ડપ્રેસ એવા વાતાવરણમાં કાર્ય કરી શક્યું જે પરંપરાગત રીતે સપોર્ટેડ ન હતા.

<!--
Blocknotes operated as a WebView running an HTML page where a WebAssembly version of PHP was running WordPress. That HTML page was packaged as a native iOS via [Capacitor](https://capacitorjs.com/). This setup allowed WordPress to function in environments traditionally not supported.
-->

[બ્લોકનોટ્સ ગિટહબ રીપોઝીટરીમાં](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748)તમે છેલ્લી પ્લેગ્રાઉન્ડ-આધારિત રિલીઝની સમીક્ષા કરી શકો છો. અહીં સૌથી મહત્વપૂર્ણ ભાગો છે:

<!--
In [Blocknotes GitHub repository](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) you can review the last Playground-based release. Here are the most important parts:
-->

-   [વર્ડપ્રેસ બિલ્ડ](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (`.data` ફાઇલ તરીકે પેકેજ કરેલ)。
-   [સ્ટેટિક વર્ડપ્રેસ સંપત્તિઓ](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public)。
-   [PHP નું વેબએસેમ્બલી(WebAssembly) બિલ્ડ](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) ([@php-wasm/web](https://npmjs.com/package/@php-wasm/web) દ્વારા)。
-   [PHP અને વર્ડપ્રેસ ચલાવતો વેબ કાર્યકર](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js)。
-   [હાઇપરનોટ્સ](https://wordpress.com/plugins/hypernotes) વર્ડપ્રેસ પ્લગઇન ([અહીં ઇન્સ્ટોલ કરેલ](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) wp-admin ને નોંધ લેતી એપ્લિકેશનમાં ફેરવવા માટે.
-   [[iOS ફાઇલોમાંથી વર્ડપ્રેસ પોસ્ટ્સ લોડ કરવા] માટે એક સ્તર](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) અને [ફેરફારોને iOS ફાઇલો તરીકે સાચવો](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).

<!--
-   [A WordPress build](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (packaged as a `.data` file).
-   [Static WordPress assets](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
-   [A WebAssembly build of PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/%40php-wasm/web) (via [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
-   [A web worker running PHP and WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
-   [Hypernotes](https://wordpress.com/plugins/hypernotes) WordPress plugin ([installed here](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) to turn wp-admin into a note-taking app.
-   A layer to [load WordPress posts from iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) and [save changes as iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).
-->

## વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે તમારી પોતાની iOS એપ્લિકેશન બનાવો

<!--
## Building your own iOS app with WordPress Playground
-->

જોકે બ્લોકનોટ્સે સાબિત કર્યું છે કે વર્ડપ્રેસ-આધારિત iOS એપ્લિકેશન રિલીઝ કરવી શક્ય છે, આ હજુ પણ ખૂબ જ સંશોધનાત્મક ક્ષેત્ર છે. અહીં કોઈ સ્થાપિત વર્કફ્લો, પુસ્તકાલયો અથવા જ્ઞાન આધાર નથી.

<!--
Although Blocknotes proved releasing a WordPress-based iOS app is possible, this is still a highly exploratory area. There are no established workflows, libraries, or knowledge bases.
-->

અમારી પાસે જે શ્રેષ્ઠ દસ્તાવેજીકરણ છે તે બ્લોકનોટ્સ રિપોઝીટરી છે. તમારી નવી એપ્લિકેશનનું અન્વેષણ કરવા માટે તેનો સંદર્ભ અને પ્રારંભિક બિંદુ તરીકે ઉપયોગ કરો. PHP ના વેબએસેમ્બલી(WebAssembly) બિલ્ડ, વર્ડપ્રેસ બ્લોક એડિટરનું એકીકરણ અને વર્ડપ્રેસ ને કાર્યક્ષમ રીતે ચલાવવા માટે વેબ વર્કર્સનો ઉપયોગ કેવી રીતે થાય છે તેના મુખ્ય ઘટકોની સમીક્ષા કરો. આ ઘટકોનું વિશ્લેષણ કરીને, તમે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે તમારી પોતાની iOS એપ્લિકેશન બનાવવા માટે આંતરદૃષ્ટિ મેળવી શકો છો, મોબાઇલ વેબ એપ્લિકેશન્સ સાથે શું શક્ય છે તેની સીમાઓને આગળ ધપાવી શકો છો.

<!--
The best documentation we have is the Blocknotes repository. Use it as a reference and a starting point for exploring your new app. Review the key components like the WebAssembly build of PHP, the integration of the WordPress block editor, and how web workers are utilized to run WordPress efficiently. By dissecting these elements, you can gain insights into building your own iOS app with WordPress Playground, pushing the boundaries of what’s possible with mobile web applications.
-->

આ નવીન જગ્યામાં નેવિગેટ કરતી વખતે, તમારા તારણો અને પડકારો પ્લેગ્રાઉન્ડ ટીમ અને વ્યાપક વર્ડપ્રેસ સમુદાય સાથે શેર કરો. તમારા શિક્ષણને પ્રકાશિત કરવાથી ફક્ત તમારા વિકાસમાં મદદ મળશે નહીં પરંતુ સામૂહિક જ્ઞાન આધારમાં પણ ફાળો મળશે, જે મોબાઇલ પર વર્ડપ્રેસના ભવિષ્યને આગળ ધપાવશે.

<!--
As you navigate this innovative space, share your findings and challenges with the Playground team and the broader WordPress community. Publishing your learnings will not only aid in your development but also contribute to a collective knowledge base, driving forward the future of WordPress on mobile.
-->

## સંભાવના અને ભવિષ્ય

<!--
## Potential and the future
-->

બ્લોકનોટ્સ નવી પેઢીની એપ્લિકેશનો માટે માર્ગ મોકળો કરે છે જે વધુ સુલભ, લવચીક અને શક્તિશાળી છે.

<!--
Blocknotes paves the way for a new generation of applications that are more accessible, flexible, and powerful.
-->

એકવાર એપ-બિલ્ડિંગ વર્કફ્લો પરિપક્વ થઈ જાય, પછી આપણે પ્લેગ્રાઉન્ડ સાઇટ્સને iOS એપ્સ તરીકે પેકેજ કરવા માટે એક સ્વચાલિત પાઇપલાઇન જોઈ શકીએ છીએ. તે સર્વર પર, બ્રાઉઝરમાં અને મોબાઇલ એપ તરીકે સમાન કોડબેઝ ચલાવવાનું અત્યંત સરળ બનાવશે.

<!--
Once the app-building workflows mature, we may see an automated pipelines for packaging Playground sites as iOS apps. It would make it extremely easy to run the same codebase on the server, in the browser, and as a mobile app.
-->

સાથે મળીને કામ કરીને અને અમારા તારણો શેર કરીને, અમે વર્ડપ્રેસ અને મોબાઇલ એપ્લિકેશન ડેવલપમેન્ટ સાથે શક્ય સીમાઓને આગળ ધપાવી શકીએ છીએ.

<!--
By working together and sharing our findings, we can push the boundaries of what’s possible with WordPress and mobile app development
-->
