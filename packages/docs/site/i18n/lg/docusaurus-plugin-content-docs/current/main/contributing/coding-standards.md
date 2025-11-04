---
slug: /contributing/coding-standards
title: Emisingi gy'Empandiika ya Koodi
description: Jino jilambika ku mpandiika ya koodi mu playground era gyogera ku bubaka obujja nga waliwo ensobi, API y'olukale, Ebizimbe ebilaborwako.
---

# Emisingi gy'Empandiika ya Koodi

<!--
# Coding principles
-->

## Obubaka nga waliwo Ensobi

<!--
## Error messages
-->

Obubaka obujja nga waliwo ensobi obulungi butegeeza omukozesa omutendera ogw'okugoberera. Ensobi yonna etategeerekeka mu Playground [Public APIs](/developers/apis/) ejja kuwaliriza abakozi okulopa ensobi

<!--
A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground [Public APIs](/developers/apis/) will prompt the developers to open issues.
-->

Twalowooza ku nsobi y'omukutu gw'omutimbagano, okugeza—tusobola okuteebereza ekika ky'ensobi n'okulaga obubaka obukwatagana nga twongera ku mutendera oguddako?

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?
-->

-   **Ensobi y'omukutu gw'omutimbagano**: "Omukutu gw'omutimbagano gwo guweddemu. Gezaako okuzzaamu olupapula.
-   **404**: "Fayiro tekirabiddwa".
-   **403**: "Seva ewanise okuyingira mu fayiro".
-   **CORS**: Nnyonnyola nti kye kikola ekirinda mu browza era ongereyo link egenda ku nnyonnyola entuufu (ku MDN oba ensibuko endala eya kukkirizibwa). Kuwa omukozesa amagezi okukyusa fayiro ye okugitwala mu kifo ekirala, nga `raw.githubusercontent.com`, era ongereyo link ku nsibuko ennyonnyola engeri y'okuteeka CORS headers ku seva zaabwe.

<!--
-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

Tukwata okutereeza koodi n'okukola linting mu ngeri ey'otomatiiki. Wummule, wandiika, era leka ebyuma bikole omulimu.

<!--
We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

## Public API

<!--
## Public API
-->

Playground eruubirira okukuuma API scope ennono ennyo.

<!--
Playground aims to keep the narrowest possible API scope.
-->

Public APIs zi yangu okuziyongera naye nzizibu okuziggyawo. Kyetaaga PR emu okuyingiza API empya, naye kiyinza okwetaaga lukumi okugigyawo, naddala singa pulojekiti endala zizikozesezza dda.

<!--
Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.
-->

-   Tolaga functions, classes, constants, oba components endala eziteetaagisa.

<!--
-   Don't expose unnecessary functions, classes, constants, or other components.
-->

## Enteekateeka

<!--
## Blueprints
-->

[Enteekateeka](/blueprints/getting-started) ze ngeri enkulu ey'okukolagana ne Playground. Fayiro zino za JSON zinnyonnyola emitendo egy'emitendera Playground gy'ekola mu nkola.

<!--
[Blueprints](/blueprints/getting-started) are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.
-->

### Ebiragiro

<!--
### Guidelines
-->

Emitendera gy'enteekateeka girina okuba **migufu era egy'omusingi**. Girina okukola kinumu era okukikola obulungi.

<!--
Blueprint steps should be **concise and focused**. They should do one thing and do it well.
-->

-   Bw'oba oyagala okukola omutendera omupya, sooka okugezaako okudda okutereeza ogw'awali.
-   Bw'ekyo tekimala, kakasa nti omutendera omupya guleeta obusobozi obupya. Toddamu kukola functions ez'emitendera egy'awali.
-   Lowooza nti omutendera gujja kuyitibwa emirundi egisinga emu.
-   Lowooza nti gujja kukola mu nkola entongole.
-   Yongera unit tests okukakasa ekyo.

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

Enteekateeka zirina okuba **ez'amanyi era ez'eyangu okutegeerera**.

<!--
Blueprints should be **intuitive and straightforward**.
-->

-   Tosabanga arguments ezisobola okuba optional.
-   Kozesa argument ennyangu. Okugeza, `slug` mu kifo kya `path`.
-   Nnyonnyola constants mu virtual JSON files—tolongoosa PHP files.
-   Nnyonnyola TypeScript type ku Blueprint. Bw'etyo Playground bw'ekola JSON schema yaayo.
-   Wandiika function okukwata omutendera gwa Blueprint. Kkiriza argument ey'ekika ky'onnyonnyodde.
-   Waayo ekyokulabirako eky'okukozesa mu doc string. Ekyeraga mu ngeri ey'otomatiiki mu biwandiiko.

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->
