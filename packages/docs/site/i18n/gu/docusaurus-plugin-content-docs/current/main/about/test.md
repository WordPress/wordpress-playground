---
title: ટેસ્ટ
slug: /about/test
description: જાણો કે કેવી રીતે થીમ્સ, પ્લગઇન્સ, પુલ રિક્વેસ્ટ્સ અને વર્ડપ્રેસ અને PHP ની વિવિધ વર્ઝન્સના ટેસ્ટિંગ માટે પ્લેગ્રાઉન્ડનો ઉપયોગ કરવો.
---

# ટેસ્ટ

તમારી QA પ્રક્રિયાને અપગ્રેડ કરો, તમારા બ્રાઉઝરમાં સિંગલ ક્લિકમાં પ્રગતિની સમીક્ષા કરવાની ક્ષમતા સાથે. જ્યારે તમે તૈયાર હોવ, ત્યારે તરત જ અપડેટ્સ પુશ કરો.

## કોઈપણ થીમ અથવા પ્લગઇનનું ટેસ્ટ કરો

પ્લેગ્રાઉન્ડ સાથે, તમે કોઈપણ પ્લગઇન અથવા થીમનું ટેસ્ટ કરી શકો છો. વર્ડપ્રેસ.ઓર્ગ [પ્લગઇન્સ](https://wordpress.org/plugins) અને [થીમ્સ](https://wordpress.org/themes/) ડિરેક્ટરીઓમાં પ્રકાશિત કોઈપણ પ્લગઇન અથવા થીમને ઝડપથી લોડ કરવા માટે [ક્વેરી API](/developers/apis/query-api) નો ઉપયોગ કરો.

ઉદાહરણ તરીકે, નીચેની લિંક પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ પર ["pendant" થીમ](https://wordpress.org/themes/pendant/) અને ["gutenberg" પ્લગઇન](https://wordpress.org/plugins/gutenberg/) લોડ કરશે:

[https://playground.wordpress.net/?theme=pendant&plugin=gutenberg](https://playground.wordpress.net/?theme=pendant&plugin=gutenberg)

પરંતુ તમે [બ્લુપ્રિન્ટ્સનો ઉપયોગ કરીને વધુ વિસ્તૃત કોન્ફિગરેશન્સ](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) નું પણ ટેસ્ટ કરી શકો છો, ઉદાહરણ તરીકે જિસ્ટમાંથી પ્લગઇનના કોડનું ટેસ્ટિંગ (જુઓ [બ્લુપ્રિન્ટ](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) અને [લાઈવ ડેમો](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json))

## પુલ રિક્વેસ્ટ્સનું લાઈવ પ્રિવ્યુ જુઓ

પુલ રિક્વેસ્ટ્સનું ટેસ્ટિંગ પ્લેગ્રાઉન્ડ પ્રોજેક્ટના સૌથી રોમાંચક યુઝ કેસિસમાંનો એક છે. પ્લેગ્રાઉન્ડ સાથે, તમે GitHub પરના વર્ડપ્રેસ-સંબંધિત પ્રોજેક્ટની દરેક પુલ રિક્વેસ્ટ પર લાઈવ પ્રિવ્યુ લિંક સક્ષમ કરી શકો છો જેથી ડેવલપર્સ તે પુલ રિક્વેસ્ટમાંના કોડના અસરોને ક્રિયામાં જોઈ શકે. આ વિશે વધુ વાંચો [પ્લેગ્રાઉન્ડ સાથે વર્ડપ્રેસ કોર પુલ રિક્વેસ્ટ્સનું પ્રિવ્યુ જુઓ](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.) પર.

આ યુઝ કેસના કેટલાક જાહેર અમલીકરણો છે જેમ કે [વર્ડપ્રેસ કોર PR પ્રિવ્યુઅર](https://playground.wordpress.net/wordpress.html) અને [ગુટેનબર્ગ PR પ્રિવ્યુઅर](https://playground.wordpress.net/gutenberg.html). વપરાશકર્તાઓ PR નંબર અથવા URL ઇનપુટ કરી શકે છે જેથી તેમને વર્ડપ્રેસ ઇન્સ્ટન્સ પર રીડાયરેક્ટ કરવામાં આવે, જે પ્લેગ્રાઉન્ડ દ્વારા સંચાલિત છે, જ્યાં PR માંથી ફેરફારો લાગુ કરવામાં આવે છે.

[WP પ્લેગ્રાઉન્ડ PR પ્રિવ્યુ](https://github.com/vcanales/action-wp-playground-pr-preview) જેવી GitHub એક્શન્સ તમને કોઈપણ રીપોઝિટરી પર WP પ્લેગ્રાઉન્ડ દ્વારા સંચાલિત PR પ્રિવ્યુઝ ઉમેરવાની મંજૂરી આપે છે. ઉદાહરણ તરીકે, આ સુવિધા [WordPress/twentytwentyfive](https://github.com/WordPress/twentytwentyfive) રીપોઝિટરીમાં [સક્ષમ કરવામાં આવી હતી](https://github.com/WordPress/twentytwentyfive/pull/359).

## તમારી સાઇટને ક્લોન કરો અને ખાનગી સેન્ડબોક્સમાં પ્રયોગ કરો.

[પ્લેગ્રાઉન્ડ દ્વારા સંચાલિત સેન્ડબોક્સ સાઇટ](https://wordpress.org/plugins/playground/) પ્લગઇન સાથે તમે તમારી સાઇટની એક ખાનગી વર્ડપ્રેસ પ્લેગ્રાઉન્ડ કોપી બનાવી શકો છો જેમાં પ્લગઇન્સને સુરક્ષિત રીતે ટેસ્ટ કરી શકાય અથવા કોઈપણ ડેટાને ક્લાઉડ પર અપલોડ કર્યા વગર અથવા મૂળ સાઇટને અસર કર્યા વગર તમારી સાઇટની રેપ્લિકા પર કોઈપણ અન્ય પ્રયોગો કરી શકાય.

## વિવિધ વર્ડપ્રેસ અને PHP વર્ઝન્સનું ટેસ્ટ કરો.

પ્લેગ્રાઉન્ડ સાથે, તમે _તેની સેટિંગ્સ કસ્ટમાઇઝ કરીને_ અથવા `preferredVersions` પ્રોપર્ટી સાથે કસ્ટમ બ્લુપ્રિન્ટનો ઉપયોગ કરીને કોઈપણ મેજર વર્ડપ્રેસ અથવા PHP વર્ઝનને ઝડપથી ટેસ્ટ કરી શકો છો.

ઉદાહરણ તરીકે, તમે હંમેશા વર્ડપ્રેસની નવીનતમ ડેવલપમેન્ટ વર્ઝન, જેને [બીટા નાઇટલી](https://wordpress.org/download/beta-nightly/) પણ કહેવામાં આવે છે, આ લિંકથી ટેસ્ટ કરી શકો છો: [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly)

કોઈપણ વર્ડપ્રેસ રિલીઝની બીટા અવધિ દરમ્યાન, તમે થીમ ટેસ્ટ ડેટા અને ડીબગિંગ પ્લગઇન્સ સાથે નવીનતમ વર્ડપ્રેસ બીટા અથવા આરસી રિલીઝનું પણ ટેસ્ટ કરી શકો છો (જુઓ [બ્લુપ્રિન્ટ](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) અને [લાઈવ ડેમો](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json)).

તમે ઉપલબ્ધ વર્ડપ્રેસ અને PHP વર્ઝન્સમાં કોઈપણ [થીમ, પ્લગઇન](/developers/apis/query-api), અથવા [કોન્ફિગરેશન](/blueprints) લોડ કરી શકો છો જેથી તે તે એન્વાયર્નમેન્ટમાં કેવી રીતે કામ કરે છે તે તપાસી શકો.

[વર્ડપ્રેસ પ્લેગ્રાઉન્ડ: વર્ડપ્રેસ માટે અંતિમ લર્નિંગ, ટેસ્ટિંગ, અને ટીચિંગ ટૂલ](https://www.youtube.com/watch?v=dN_LaenY8bI) પ્લેગ્રાઉન્ડ સાથેની ટેસ્ટિંગ સંભાવનાઓનો એક મહાન અવલોકન પૂરો પાડે છે.
