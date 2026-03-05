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

Gereza ku nsobi y'omukutu gw'omutimbagano, okugeza—tusobola okuteebereza ekika ky'ensobi netulaga obubaka obufunze ku mutendera oguddako?

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?
-->

-   **Obuzibu mu Network**: "Internet yo y'ekuttemu. Gezaako okuzzaamu olupapula.
-   **404**: "Fayiro tezuuliiddwa".
-   **403**: "Tokkirizibbwa kulaba fayiro eno".
-   **CORS**: Nnyonnyola nti kyeekuusa ku byakwerinda bya browser era ogatteko link yo'kunnyonnyola okutuufu (ku MDN oba ensibuko endala eyesigika). Teesa omukozesa okukyusa fayiro ye okugitwala mu kifo ekirala, okugeza nga `raw.githubusercontent.com`, era ogatteko link ekutwala ku muko ogunnyonnyola engeri y'okuteeka CORS headers ku server zaabwe.

<!--
-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

Tukwasaganya entereeza ya koodi nokujekaanya okukakasa nga temuli nsobi era nga etambula butereevu ne'mpandiika yaffe. Wummula, wandiika, era leka ebyuma bikole omulimu.

<!--
We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

## Public API

<!--
## Public API
-->

Playground eruubirira okukuuma API scope ettono ennyo.

<!--
Playground aims to keep the narrowest possible API scope.
-->

API z'olukale nyangu okuzigattamu era nkalubo okuziggyamu. Kyetaaga PR emu yokka okuyingiza API empya, naye kiyinza okwetaaga olukumi okugigyamu, naddala singa pulojekiti endala ziba zajikozesa dda.

<!--
Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.
-->

-   Tolaga functions, classes, constants, oba components endala eziteetaagisa.

<!--
-   Don't expose unnecessary functions, classes, constants, or other components.
-->

## Blueprints

<!--
## Blueprints
-->

[Blueprints](/blueprints/getting-started) ze ngeri enkulu ez'okukolagana ne Playground. Fayiro za JSON zino zinnyonnyola emitendera Playground gy'ekolamu.

<!--
[Blueprints](/blueprints/getting-started) are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.
-->

### Endagiriro

<!--
### Guidelines
-->

Emitendera gy'enteekateeka (blueprints) girina okuba mu **bufunze era nga mirambulukufu**. Girina okukola omulimu gumu era gigukole bulunji.

<!--
Blueprint steps should be **concise and focused**. They should do one thing and do it well.
-->

-   Bw'oba oyagala okukola omutendera omupya, sooka ogezeeko okukyuusa oba okutereeza oguliwo.
-   Ekyo bw'ekitamala, kakasa nti omutendera omupya guleeta obusobozi obupya. Tozzaamu functions ez'emitendera ejiriwo.
-   Suubira nti omutendera gujja kuyitibwa emirundi ejisukka mu gumu.
-   Suubira nti gujja kukola mu ngeri entongole.
-   Gattako unit tests okukakasa ekyo.

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

Blueprints zirina okuba **ntereevu era nga nyangu okutegeerera**.

<!--
Blueprints should be **intuitive and straightforward**.
-->

-   Tosaba arguments ezisobola okulekeka.
-   Kozesa argument ennyangu. Okugeza, `slug` mu kifo kya `path`.
-   Nnyonnyola ebitakyuuka mu virtual JSON files—tokyuusa PHP files.
-   Nnyonnyola TypeScript type ya Blueprint. Bw'etyo Playground bw'ekola JSON schema yaayo.
-   Wandiika function okukwata omutendera gwa Blueprint. Kkiriza argument ey'ekika ky'onnyonnyodde.
-   Waayo ekyokulabirako eky'enkozesa mu doc string. Kyeraga buterevu mu biwandiiko.

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->
