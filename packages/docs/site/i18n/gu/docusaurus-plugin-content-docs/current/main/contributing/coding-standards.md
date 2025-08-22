---
slug: /contributing/coding-standards
title: કોડિંગ સિદ્ધાંતો
description: પ્લેગ્રાઉન્ડ માટે કોડિંગ સિદ્ધાંતોની વિગતો આપે છે, મદદરૂપ ભૂલ સંદેશાઓ, ન્યૂનતમ જાહેર API અને બ્લુપ્રિન્ટ્સ પર ધ્યાન કેન્દ્રિત કરે છે.
---

# કોડિંગ સિદ્ધાંતો

<!--
# Coding principles
-->

## ભૂલ સંદેશાઓ

<!--
## Error messages
-->

એક સારો ભૂલ સંદેશ વપરાશકર્તાને નીચેના પગલાં લેવાની જાણ કરે છે. પ્લેગ્રાઉન્ડ પબ્લિક API દ્વારા ફેંકાયેલી ભૂલોમાં કોઈપણ અસ્પષ્ટતા વિકાસકર્તાઓને સમસ્યાઓ ખોલવા માટે પ્રોત્સાહિત કરશે.

<!--
A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground public APIs will prompt the developers to open issues.
-->

ઉદાહરણ તરીકે, નેટવર્ક ભૂલનો વિચાર કરો - શું આપણે ભૂલના પ્રકારનું અનુમાન કરી શકીએ છીએ અને આગળના પગલાંનો સારાંશ આપતો સંબંધિત સંદેશ પ્રદર્શિત કરી શકીએ છીએ?

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?
-->

-   **નેટવર્ક ભૂલ**: "તમારું ઇન્ટરનેટ કનેક્શન તૂટી ગયું છે. પેજ ફરીથી લોડ કરવાનો પ્રયાસ કરો.
-   **404**: "ફાઇલ મળી શકી નથી".
-   **403**: "સર્વરે ફાઇલની ઍક્સેસ અવરોધિત કરી છે".
-   **CORS**: સ્પષ્ટ કરો કે તે બ્રાઉઝર સુરક્ષા સુવિધા છે અને વિગતવાર સમજૂતી (MDN અથવા અન્ય વિશ્વસનીય સ્ત્રોત પર) ની લિંક ઉમેરો. વપરાશકર્તાને તેમની ફાઇલ બીજે ક્યાંક ખસેડવાનું સૂચન કરો, જેમ કે `raw.githubusercontent.com`, અને તેમના સર્વર પર CORS હેડર કેવી રીતે સેટ કરવા તે સમજાવતા સંસાધનની લિંક આપો.

<!--
-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

અમે કોડ ફોર્મેટિંગ અને લિન્ટિંગ આપમેળે હેન્ડલ કરીએ છીએ. આરામ કરો, ટાઇપ કરો અને મશીનોને કામ કરવા દો.

<!--
We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

## સાર્વજનિક API

<!--
## Public API
-->

પ્લેગ્રાઉન્ડનો ઉદ્દેશ્ય શક્ય તેટલો સાંકડો API સ્કોપ રાખવાનો છે.

<!--
Playground aims to keep the narrowest possible API scope.
-->

પબ્લિક API ઉમેરવા સરળ છે અને દૂર કરવા મુશ્કેલ છે. નવું API રજૂ કરવા માટે ફક્ત એક PR ની જરૂર પડે છે, પરંતુ તેને દૂર કરવા માટે હજાર લાગી શકે છે, ખાસ કરીને જો અન્ય પ્રોજેક્ટ્સ પહેલાથી જ તેનો ઉપયોગ કરી ચૂક્યા હોય.

<!--
Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.
-->

-   બિનજરૂરી કાર્યો, વર્ગો, સ્થિરાંકો, અથવા અન્ય ઘટકોનો ખુલાસો કરશો નહીં.

<!--
-   Don't expose unnecessary functions, classes, constants, or other components.
-->

## બ્લુપ્રિન્ટ્સ

<!--
## Blueprints
-->

બ્લુપ્રિન્ટ્સ એ પ્લેગ્રાઉન્ડ સાથે ક્રિયાપ્રતિક્રિયા કરવાનો પ્રાથમિક રસ્તો છે. આ JSON ફાઇલો પ્લેગ્રાઉન્ડ ક્રમમાં ચલાવતા પગલાંઓના સમૂહનું વર્ણન કરે છે.

<!--
Blueprints are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.
-->

### માર્ગદર્શિકા

<!--
### Guidelines
-->

બ્લુપ્રિન્ટ પગલાં **સંક્ષિપ્ત અને કેન્દ્રિત** હોવા જોઈએ. તેમણે એક કામ કરવું જોઈએ અને તે સારી રીતે કરવું જોઈએ.

<!--
Blueprint steps should be **concise and focused**. They should do one thing and do it well.
-->

-   જો તમારે નવું પગલું બનાવવાની જરૂર હોય, તો પહેલા અસ્તિત્વમાં રહેલા પગલાને રિફેક્ટર કરવાનો પ્રયાસ કરો.
-   જો તે પૂરતું નથી, તો ખાતરી કરો કે નવું પગલું નવી ક્ષમતા પ્રદાન કરે છે. હાલના પગલાંની કાર્યક્ષમતાની નકલ કરશો નહીં.
-   ધારો કે પગલું એક કરતા વધુ વાર બોલાવવામાં આવશે.
-   ધારો કે તે ચોક્કસ ક્રમમાં ચાલશે.
-   તે ચકાસવા માટે યુનિટ ટેસ્ટ ઉમેરો.

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

બ્લુપ્રિન્ટ્સ **સાહજિક અને સીધી** હોવી જોઈએ.

<!--
Blueprints should be **intuitive and straightforward**.
-->

-   એવી દલીલોની જરૂર નથી જે વૈકલ્પિક હોઈ શકે.
-   સાદા દલીલનો ઉપયોગ કરો. ઉદાહરણ તરીકે, `path` ને બદલે `slug`.
-   વર્ચ્યુઅલ JSON ફાઇલોમાં સ્થિરાંકો વ્યાખ્યાયિત કરો - PHP ફાઇલોમાં ફેરફાર કરશો નહીં.
-   બ્લુપ્રિન્ટ માટે ટાઇપસ્ક્રિપ્ટ પ્રકાર વ્યાખ્યાયિત કરો. આ રીતે પ્લેગ્રાઉન્ડ તેની JSON સ્કીમા જનરેટ કરે છે.
-   બ્લુપ્રિન્ટ સ્ટેપને હેન્ડલ કરવા માટે એક ફંક્શન લખો. તમે વ્યાખ્યાયિત કરેલા પ્રકારનો દલીલ સ્વીકારો.
-   doc સ્ટ્રિંગમાં ઉપયોગનું ઉદાહરણ આપો. તે docs માં આપમેળે પ્રતિબિંબિત થાય છે.

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->
