---
slug: /contributing/code
title: કોડ યોગદાન
description: કોડ યોગદાન માટેની માર્ગદર્શિકા, જેમાં રેપો કેવી રીતે ફોર્ક કરવો, સ્થાનિક વાતાવરણ કેવી રીતે સેટ કરવું અને પુલ વિનંતી સબમિટ કરવી તે આવરી લેવામાં આવ્યું છે.
---

# કોડ યોગદાન

<!--
# Code contributions
-->

બધા વર્ડપ્રેસ પ્રોજેક્ટ્સની જેમ, પ્લેગ્રાઉન્ડ કોડ મેનેજ કરવા અને સમસ્યાઓને ટ્રેક કરવા માટે GitHub નો ઉપયોગ કરે છે. મુખ્ય ભંડાર [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) પર છે અને પ્લેગ્રાઉન્ડ ટૂલ્સ ભંડાર [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/) પર છે.

<!--
Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).
-->

:::info પ્લેગ્રાઉન્ડ ટૂલ્સમાં યોગદાન આપો

આ માર્ગદર્શિકામાં મુખ્ય ભંડારની લિંક્સ શામેલ છે, પરંતુ બધા પગલાં અને વિકલ્પો બંને માટે લાગુ પડે છે. જો તમને પ્લગઇન્સ અથવા [local development](/developers/local-development/) ટૂલ્સમાં રસ હોય તો - ત્યાંથી શરૂઆત કરો.

:::

<!--
:::info Contribute to Playground Tools

This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or local development tools—start there.

:::
-->

શું કામ કરવું તે શોધવા માટે [ખુલ્લા મુદ્દાઓની યાદી] (https://github.com/wordpress/wordpress-playground/issues) બ્રાઉઝ કરો. [`Good First Issue`] (https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) લેબલ એ પહેલી વાર યોગદાન આપનારાઓ માટે ભલામણ કરાયેલ પ્રારંભિક બિંદુ છે.

<!--
Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors.
-->

શરૂ કરતા પહેલા નીચેના સંસાધનોની સમીક્ષા કરવાની ખાતરી કરો:

<!--
Be sure to review the following resources before you begin:
-->

-   [કોડિંગ સિદ્ધાંતો](/contributing/coding-standards)
-   [સ્થાપત્ય](/developers/architecture)
-   [દ્રષ્ટિ અને તત્વજ્ઞાન](https://github.com/WordPress/wordpress-playground/issues/472)
-   [વર્ડપ્રેસ પ્લેગ્રાઉન્ડ રોડમેપ](https://github.com/WordPress/wordpress-playground/issues/525)

<!--
-   [Coding principles](/contributing/coding-standards)
-   [Architecture](/developers/architecture)
-   [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
-   [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

## પુલ વિનંતીઓનું યોગદાન આપો

<!--
## Contribute Pull Requests
-->

[ફોર્ક ધ પ્લેગ્રાઉન્ડ રિપોઝીટરી](https://github.com/WordPress/wordpress-playground/fork) અને તેને તમારા સ્થાનિક મશીન પર ક્લોન કરો. તે કરવા માટે, આ આદેશોને કોપી કરીને તમારા ટર્મિનલમાં પેસ્ટ કરો:

<!--
[Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal:
-->

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# replace `YOUR-GITHUB-USERNAME` with your GitHub username:
git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

નીચેનો આદેશ ચલાવીને એક શાખા બનાવો, ફેરફારો કરો અને સ્થાનિક રીતે તેનું પરીક્ષણ કરો:

<!--
Create a branch, make changes, and test it locally by running the following command:
-->

```bash
npm run dev
```

પ્લેગ્રાઉન્ડ નવા બ્રાઉઝર ટેબમાં ખુલશે અને દરેક ફેરફાર સાથે આપમેળે રિફ્રેશ થશે.

<!--
Playground will open in a new browser tab and refresh automatically with each change.
-->

જ્યારે તમે તૈયાર હોવ, ત્યારે ફેરફારો કરો અને પુલ રિક્વેસ્ટ સબમિટ કરો.

<!--
When your'e ready, commit the changes and submit a Pull Request.
-->

:::info ફોર્મેટિંગ

અમે કોડ ફોર્મેટિંગ અને લિન્ટિંગ આપમેળે હેન્ડલ કરીએ છીએ. આરામ કરો, ટાઇપ કરો અને મશીનોને કામ કરવા દો.

:::

<!--
:::info Formatting

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

:::
-->

### સ્થાનિક મલ્ટીસાઇટ ચલાવવી

<!--
### Running a local Multisite
-->

વર્ડપ્રેસ મલ્ટિસાઇટમાં થોડા [સ્થાનિક રીતે ચલાવવા પર પ્રતિબંધો] છે (https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). જો તમે પ્લેગ્રાઉન્ડના `enableMultisite` સ્ટેપનો ઉપયોગ કરીને મલ્ટિસાઇટ નેટવર્કનું પરીક્ષણ કરવાની યોજના ઘડી રહ્યા છો, તો ખાતરી કરો કે તમે કાં તો `wp-now` નો ડિફોલ્ટ પોર્ટ બદલો છો અથવા HTTPS દ્વારા ચાલતું સ્થાનિક પરીક્ષણ ડોમેન સેટ કરો છો.

<!--
WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change `wp-now`'s default port or set a local test domain running via HTTPS.
-->

`wp-now` ના ડિફોલ્ટ પોર્ટને વર્ડપ્રેસ મલ્ટિસાઇટ દ્વારા સપોર્ટેડ પોર્ટમાં બદલવા માટે, તેને `--port=80` ફ્લેગનો ઉપયોગ કરીને ચલાવો:

<!--
To change `wp-now`'s default port to the one supported by WordPress Multisite, run it using the `--port=80` flag:
-->

```bash
npx @wp-now/wp-now start --port=80
```

સ્થાનિક પરીક્ષણ ડોમેન સેટ કરવાની કેટલીક રીતો છે, જેમાં તમારી `હોસ્ટ` ફાઇલને સંપાદિત કરવાનો સમાવેશ થાય છે. જો તમને ખાતરી ન હોય કે તે કેવી રીતે કરવું, તો અમે [Laravel Valet] (https://laravel.com/docs/11.x/valet) ઇન્સ્ટોલ કરવાનું અને પછી નીચેનો આદેશ ચલાવવાનું સૂચન કરીએ છીએ:

<!--
There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command:
-->

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

તમારું ડેવલપર સર્વર હવે https://playground.test પર ઉપલબ્ધ છે.

<!--
Your dev server is now available on https://playground.test.
-->

## ડિબગીંગ

<!--
## Debugging
-->

### VS કોડ અને ક્રોમનો ઉપયોગ કરો

<!--
### Use VS Code and Chrome
-->

જો તમે VS કોડનો ઉપયોગ કરી રહ્યા છો અને ક્રોમ ઇન્સ્ટોલ કરેલ છે, તો તમે કોડ એડિટરમાં પ્લેગ્રાઉન્ડને ડીબગ કરી શકો છો.

<!--
If you're using VS Code and have Chrome installed, you can debug Playground in the code editor:
-->

-   VS કોડમાં પ્રોજેક્ટ ફોલ્ડર ખોલો.
-   મુખ્ય મેનુમાંથી, Run > Start Debugging પસંદ કરો, અથવા `F5`/`fn`+`F5` દબાવો.

<!--
-   Open the project folder in VS Code.
-   Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.
-->

### PHP ડિબગીંગ

<!--
### Debugging PHP
-->

દરેક PHP વિનંતી પછી, પ્લેગ્રાઉન્ડ બ્રાઉઝર કન્સોલમાં PHP ભૂલો રેકોર્ડ કરે છે.

<!--
Playground logs PHP errors in the browser console after every PHP request.
-->
