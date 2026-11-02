---
slug: /contributing/translations
title: અનુવાદમાં યોગદાન
description: ફાઇલ માળખું, સ્થાનિક પરીક્ષણ અને સમીક્ષા પ્રક્રિયા સહિત પ્લેગ્રાઉન્ડ દસ્તાવેજીકરણનો અનુવાદ કેવી રીતે કરવો તે શીખો.
---

<!--
# Contributions to translations
-->

# અનુવાદમાં યોગદાન

<!--
Help make WordPress Playground accessible to a global audience by translating its documentation. This guide provides everything you need to know to get started. Contributing translations follows the same workflow as any other documentation change. You can either fork the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository and create a pull request (PR) with your changes or edit pages directly using the GitHub UI.
-->

વર્ડપ્રેસ પ્લેગ્રાઉન્ડના દસ્તાવેજીકરણનો અનુવાદ કરીને તેને વૈશ્વિક પ્રેક્ષકો માટે સુલભ બનાવવામાં મદદ કરો. આ માર્ગદર્શિકા તમને શરૂઆત કરવા માટે જરૂરી બધું જ પ્રદાન કરે છે. અનુવાદમાં યોગદાન આપવું એ અન્ય કોઈપણ દસ્તાવેજીકરણ ફેરફાર જેવા જ વર્કફ્લોને અનુસરે છે. તમે [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) રિપોઝિટરીને ફોર્ક (fork) કરીને તમારા ફેરફારો સાથે પુલ રિક્વેસ્ટ (PR) બનાવી શકો છો અથવા ગિટહબ વેબ ઇન્ટરફેસ (GitHub UI) નો ઉપયોગ કરીને પેજમાં સીધા ફેરફાર કરી શકો છો.

<!--
<div class="callout callout-info">

For a detailed guide on the contribution workflow (forking, creating PRs, etc.), please see our [documentation contribution guide](/contributing/documentation#how-can-i-contribute). To make changes directly in GitHub, see [Contribute with the GitHub web interface](/contributing/github-ui).

</div>
-->

<div class="callout callout-info">

યોગદાન વર્કફ્લો (ફોર્કિંગ, PR બનાવવું વગેરે) પર વિગતવાર માર્ગદર્શિકા માટે, કૃપા કરીને અમારી [દસ્તાવેજીકરણ યોગદાન માર્ગદર્શિકા](/contributing/documentation#how-can-i-contribute) જુઓ. ગિટહબમાં સીધા ફેરફારો કરવા માટે, [ગિટહબ વેબ ઇન્ટરફેસ દ્વારા યોગદાન આપો](/contributing/github-ui) જુઓ.

</div>

<!--
## How Translations Work
-->

## અનુવાદ કેવી રીતે કાર્ય કરે છે

<!--
Playground's documentation site is built with Docusaurus, which handles the internationalization (i18n) features.
-->

પ્લેગ્રાઉન્ડની દસ્તાવેજીકરણ સાઇટ Docusaurus સાથે બનેલી છે, જે આંતરરાષ્ટ્રીયકરણ (internationalization - i18n) સુવિધાઓનું સંચાલન કરે છે.

<!--
<div class="callout callout-info">

To learn more about how Docusaurus manages translations, see the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of the official Docusaurus documentation.

</div>
-->

<div class="callout callout-info">

Docusaurus અનુવાદોનું સંચાલન કેવી રીતે કરે છે તે વિશે વધુ જાણવા માટે, સત્તાવાર Docusaurus દસ્તાવેજીકરણનો [Internationalization વિભાગ](https://docusaurus.io/docs/i18n/introduction) જુઓ.

</div>

<!--
### Configuration
-->

### રૂપરેખાંકન (Configuration)

<!--
Available languages are defined in the `packages/docs/site/docusaurus.config.js` file. For example:
-->

ઉપલબ્ધ ભાષાઓ `packages/docs/site/docusaurus.config.js` ફાઇલમાં વ્યાખ્યાયિત થયેલ છે. ઉદાહરણ તરીકે:

```
i18n: {
  defaultLocale: 'en',
  path: 'i18n',
  locales: ['en', 'fr'],
  localeConfigs: {
	en: {
		label: 'English',
		path: 'en',
	},
	fr: {
		label: 'French',
		path: 'fr',
	},
  },
}
```

<!--
### File Structure
-->

### ફાઇલ માળખું (File Structure)

<!--
All translated documentation pages are located within the `packages/docs/site/i18n/` directory, organized by language code.
-->

બધા અનુવાદિત દસ્તાવેજીકરણ પેજ `packages/docs/site/i18n/` ડિરેક્ટરીમાં આવેલા છે, જે ભાષા કોડ (language code) દ્વારા ગોઠવાયેલા છે.

<!--
For a language to work correctly, its file structure must mirror the original English documentation found in `packages/docs/site/docs`.
-->

કોઈ ભાષા યોગ્ય રીતે કાર્ય કરે તે માટે, તેનું ફાઇલ માળખું `packages/docs/site/docs` માં મળતા મૂળ અંગ્રેજી દસ્તાવેજીકરણ જેવું જ (mirror) હોવું જોઈએ.

<!--
For example, the Spanish (es) translation for `docs/main/intro.md` must be placed at:
packages`/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.
-->

ઉદાહરણ તરીકે, `docs/main/intro.md` નો સ્પેનિશ (es) અનુવાદ અહીં મૂકવો આવશ્યક છે:
`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.

<!--
If a translated file does not exist for a specific language, Docusaurus will automatically fall back to the English version of that page.
-->

જો કોઈ ચોક્કસ ભાષા માટે અનુવાદિત ફાઇલ અસ્તિત્વમાં નથી, તો Docusaurus આપમેળે તે પેજના અંગ્રેજી સંસ્કરણ પર પાછું જશે (fall back થશે).

<!--
### Generating Translation Files
-->

### અનુવાદ ફાઇલો બનાવવી (Generating Translation Files)

<!--
When adding a new language, you can generate the necessary JSON files for UI strings (like button labels and navigation items) by running the following command from the `packages/docs/site` directory:
-->

નવી ભાષા ઉમેરતી વખતે, તમે `packages/docs/site` ડિરેક્ટરીમાંથી નીચેનો કમાન્ડ ચલાવીને UI સ્ટ્રિંગ્સ (જેમ કે બટન લેબલ્સ અને નેવિગેશન આઇટમ્સ) માટે જરૂરી JSON ફાઇલો જનરેટ કરી શકો છો:

```bash
npm run write-translations -- --locale <LANGUAGE_CODE>
```

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

પ્રોજેક્ટના રૂટ પરથી `npm run build:docs` ચલાવતી વખતે યોગ્ય i18n `docusaurus.config.js` રૂપરેખાંકન અને `i18n` હેઠળ ફાઇલો સાથે, દરેક ભાષા માટે `dist` હેઠળ ચોક્કસ ફોલ્ડર્સ બનાવવામાં આવશે.

<!--
## Testing Translations Locally
-->

## સ્થાનિક રીતે અનુવાદનું પરીક્ષણ કરવું (Testing Translations Locally)

<!--
To preview your changes for an existing language:

1. Modify or add a translated file in the appropriate language directory, such as `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. From the `/packages/docs/site` directory, run the local development server for your target language. For example, to test Spanish (es):
-->

હાલની ભાષા માટે તમારા ફેરફારોનું પ્રીવ્યૂ કરવા માટે:

1. યોગ્ય ભાષા ડિરેક્ટરીમાં અનુવાદિત ફાઇલમાં ફેરફાર કરો અથવા નવી ઉમેરો, જેમ કે `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. `/packages/docs/site` ડિરેક્ટરીમાંથી, તમારી ટાર્ગેટ ભાષા માટે લોકલ ડેવલપમેન્ટ સર્વર ચલાવો. ઉદાહરણ તરીકે, સ્પેનિશ (es) નું પરીક્ષણ કરવા માટે:

```bash

npm run dev -- --locale es

```

<!--
## The Language Switcher
-->

## લેંગ્વેજ સ્વિચર (The Language Switcher)

<!--
The language switcher is a dropdown menu that allows users to select their preferred language.
-->

લેંગ્વેજ સ્વિચર એ ડ્રોપડાઉન મેનૂ છે જે વપરાશકર્તાઓને તેમની પસંદગીની ભાષા પસંદ કરવાની મંજૂરી આપે છે.

<!--
![Documentation Language Switcher](/img/contributing/language-switcher-docs.webp)
-->

![દસ્તાવેજીકરણ લેંગ્વેજ સ્વિચર](/img/contributing/language-switcher-docs.webp)

<!--
### Making a language publicly available on the Language Switcher
-->

### લેંગ્વેજ સ્વિચર પર ભાષાને સાર્વજનિક રૂપે ઉપલબ્ધ કરાવવી

<!--
We recommend only adding a language to the switcher when a significant portion of the documentation has been translated. This avoids a poor user experience where switching to a new language results in seeing mostly untranslated English content.
-->

અમે દસ્તાવેજીકરણનો મોટો ભાગ અનુવાદિત થઈ જાય ત્યારે જ ભાષાને સ્વિચરમાં ઉમેરવાની ભલામણ કરીએ છીએ. આનાથી ખરાબ વપરાશકર્તા અનુભવ ટાળી શકાય છે જ્યાં નવી ભાષા પર સ્વિચ કરવાથી મોટે ભાગે બિન-અનુવાદિત અંગ્રેજી સામગ્રી જોવા મળે છે.

<!--
As a guideline, a language should be made publicly available in the switcher only when the entire "Documentation" hub is translated, including these key sections:

- [Quick Start Guide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
- [Playground web instance](https://wordpress.github.io/wordpress-playground/web-instance)
- [About Playground](https://wordpress.github.io/wordpress-playground/about)
- [Guides](https://wordpress.github.io/wordpress-playground/guides)
- [Contributing](https://wordpress.github.io/wordpress-playground/contributing)
- [Links and Resources](https://wordpress.github.io/wordpress-playground/links-and-resources)
-->

માર્ગદર્શિકા તરીકે, જ્યારે આ મુખ્ય વિભાગો સહિત સમગ્ર "Documentation" હબ અનુવાદિત થાય ત્યારે જ સ્વિચરમાં કોઈ ભાષાને સાર્વજનિક રૂપે ઉપલબ્ધ કરાવવી જોઈએ:

- [ક્વિક સ્ટાર્ટ ગાઇડ (Quick Start Guide)](https://wordpress.github.io/wordpress-playground/quick-start-guide)
- [પ્લેગ્રાઉન્ડ વેબ ઇન્સ્ટન્સ (Playground web instance)](https://wordpress.github.io/wordpress-playground/web-instance)
- [પ્લેગ્રાઉન્ડ વિશે (About Playground)](https://wordpress.github.io/wordpress-playground/about)
- [ગાઇડ્સ (Guides)](https://wordpress.github.io/wordpress-playground/guides)
- [યોગદાન (Contributing)](https://wordpress.github.io/wordpress-playground/contributing)
- [લિંક્સ અને સંસાધનો (Links and Resources)](https://wordpress.github.io/wordpress-playground/links-and-resources)

<!--
All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.

- https://wordpress.github.io/wordpress-playground/
- https://wordpress.github.io/wordpress-playground/es/
- https://wordpress.github.io/wordpress-playground/fr/
-->

ભાષા માટે i18n સેટઅપ પૂર્ણ થઈ ગયા પછી અને `i18n` હેઠળ યોગ્ય ફાઇલ માળખું ગોઠવાઈ ગયા પછી બધી ભાષાઓ ઉપલબ્ધ થાય છે.

- https://wordpress.github.io/wordpress-playground/
- https://wordpress.github.io/wordpress-playground/es/
- https://wordpress.github.io/wordpress-playground/fr/

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

ધારો કે `fr` ભાષા એ પહેલી ભાષા છે જેના Documentation હબ પેજ (Quick Start Guide, Playground web instance, About Playground, Guides,...) સંપૂર્ણપણે ફ્રેન્ચમાં અનુવાદિત થયા છે, તો તે બ્રાન્ચમાં `docusaurus.config.js` નીચે મુજબ દેખાવું જોઈએ જેથી `npm run build:docs` યોગ્ય રીતે `fr` સબસાઇટ જનરેટ કરે અને `localeDropdown` લેંગ્વેજ સ્વિચરમાં ફક્ત ફ્રેન્ચ ભાષા પ્રદર્શિત કરે.

```
  {
    "i18n": {
      "defaultLocale": "en",
      "path": "i18n",
      "locales": [
        "en",
        "fr"
      ],
      "localeConfigs": {
        "en": {
          "label": "English",
          "path": "en"
        },
        "fr": {
          "label": "French",
          "path": "fr"
        }
      }
    }
  },
  {
    "type": "localeDropdown",
    "position": "right"
  }
```

<!--
## Translation Workflow
-->

## અનુવાદ વર્કફ્લો (Translation Workflow)

<!--
Follow these steps to translate a page:

1. **Check for an Existing Translation Issue**: First, [search the repository issues](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) to see if a tracking issue for your desired language already exists. If it does, comment on the issue to claim the page(s) you would like to translate.
2. **Create a New Translation Issue**: If no issue exists, please create a new one to track the translation progress for the language. You can model it after issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) and use the markdown checklist below to track progress.
3. **Translate the File**:

- Check if you have the latest version of the documentation
- Copy the original .md file from `packages/docs/site/docs/...` to the corresponding path in the language directory (e.g., `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). It is crucial to replicate the original file structure.
- Translate the content of the new file, keeping the original content commented out `<!-- English Content -->`.
- The assets are listed at `packages/docs/site/static/img/` only place assets inside the translation folder when it requires localized content.
- Once the translations are ready, check if the docs build script is running properly `npm run build:docs`.

4. **Create a pull request with your changes**

- Add a prefix to the title `[i18n]` to help to identify the translations
- Describe the pages that you translated
- Request a review at `#playground` or `#polyglots` at `wordpress.slack.com`
-->

પેજનો અનુવાદ કરવા માટે આ પગલાં અનુસરો:

1. **હાલના અનુવાદ ઇશ્યૂ માટે તપાસો**: સૌ પ્રથમ, તમારી ઇચ્છિત ભાષા માટે ટ્રેકિંગ ઇશ્યૂ પહેલેથી અસ્તિત્વમાં છે કે નહીં તે જોવા માટે [રિપોઝિટરી ઇશ્યૂઝ શોધો](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress). જો તે અસ્તિત્વમાં હોય, તો તમે જે પેજ(ઓ) નો અનુવાદ કરવા માંગો છો તેનો દાવો કરવા માટે ઇશ્યૂ પર કૉમેન્ટ કરો.
2. **નવો અનુવાદ ઇશ્યૂ બનાવો**: જો કોઈ ઇશ્યૂ અસ્તિત્વમાં ન હોય, તો કૃપા કરીને ભાષા માટે અનુવાદ પ્રગતિને ટ્રેક કરવા માટે એક નવો ઇશ્યૂ બનાવો. તમે તેને ઇશ્યૂ [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) પછી મોડેલ કરી શકો છો અને પ્રગતિને ટ્રેક કરવા માટે નીચેની માર્કડાઉન ચેકલિસ્ટનો ઉપયોગ કરી શકો છો.
3. **ફાઇલનો અનુવાદ કરો**:

- તપાસો કે તમારી પાસે દસ્તાવેજીકરણનું નવીનતમ સંસ્કરણ છે કે નહીં
- મૂળ `.md` ફાઇલને `packages/docs/site/docs/...` માંથી ભાષા ડિરેક્ટરીમાં અનુરૂપ પાથ પર કૉપિ કરો (દા.ત., `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). મૂળ ફાઇલ માળખું નકલ કરવું અત્યંત મહત્વપૂર્ણ છે.
- નવી ફાઇલની સામગ્રીનો અનુવાદ કરો, મૂળ સામગ્રીને કૉમેન્ટ આઉટ `<!-- English Content -->` તરીકે રાખો.
- એસેટ્સ `packages/docs/site/static/img/` પર સૂચિબદ્ધ છે, જ્યારે સ્થાનિક સામગ્રીની જરૂર હોય ત્યારે જ અનુવાદ ફોલ્ડરની અંદર એસેટ્સ મૂકો.
- એકવાર અનુવાદો તૈયાર થઈ જાય, પછી તપાસો કે ડૉક્સ બિલ્ડ સ્ક્રિપ્ટ યોગ્ય રીતે ચાલે છે કે નહીં: `npm run build:docs`.

4. **તમારા ફેરફારો સાથે પુલ રિક્વેસ્ટ (Pull Request) બનાવો**

- અનુવાદોને ઓળખવામાં મદદ માટે શીર્ષકમાં `[i18n]` ઉપસર્ગ (prefix) ઉમેરો
- તમે જે પેજનો અનુવાદ કર્યો છે તેનું વર્ણન કરો
- `wordpress.slack.com` પર `#playground` અથવા `#polyglots` માં સમીક્ષા માટે વિનંતી કરો

<!--
<div class="callout callout-info">

We highly recommend submitting pull requests with a small number of translated pages. This approach simplifies the review process and allows for a more gradual and manageable integration of your work.

</div>
-->

<div class="callout callout-info">

અમે ઓછી સંખ્યામાં અનુવાદિત પેજ સાથે પુલ રિક્વેસ્ટ સબમિટ કરવાની ખૂબ ભલામણ કરીએ છીએ. આ અભિગમ સમીક્ષા પ્રક્રિયાને સરળ બનાવે છે અને તમારા કાર્યના વધુ ક્રમશઃ અને વ્યવસ્થિત એકીકરણની મંજૂરી આપે છે.

</div>

<!--
### Translation Tracking Template
-->

### અનુવાદ ટ્રેકિંગ ટેમ્પ્લેટ (Translation Tracking Template)

<!--
You can use the following markdown in your tracking issue:
-->

તમે તમારા ટ્રેકિંગ ઇશ્યૂમાં નીચેના માર્કડાઉનનો ઉપયોગ કરી શકો છો:

```
## Remaining translation pages

<details open>
<summary><h3>Main</h3></summary>

- about
  - [ ] build.md
  - [ ] index.md
  - [ ] launch.md
  - [ ] test.md
- contributing
  - [ ] code.md
  - [ ] coding-standards.md
  - [ ] contributor-badge.md
  - [ ] contributor-day.md
  - [ ] contributor-day-table-lead.md
  - [ ] documentation.md
  - [ ] index.md
  - [ ] releases.md
  - [ ] translations.md
- guides
  - [ ] for-plugin-developers.md
  - [ ] for-theme-developers.md
  - [ ] github-action-pr-preview.md
  - [ ] index.md
  - [ ] providing-content-for-your-demo.md
  - [ ] wordpress-native-ios-app.md
- [ ] changelog.md
- [ ] intro.md
- [ ] quick-start-guide.md
- [ ] resources.md
- [ ] web-instance.md

</details>

<details open>
<summary><h3>Blueprints</h3></summary>

- [ ] 01-index.md
- [ ] 02-using-blueprints.md
- [ ] 03-data-format.md
- [ ] 04-resources.md
- [ ] 05-steps.md
- [ ] 05-steps-shorthands.md
- [ ] 06-bundles.md
- [ ] 07-json-api-and-function-api.md
- [ ] 08-examples.md
- [ ] 09-troubleshoot-and-debug-blueprints.md
- [ ] intro.md
- tutorial
  - [ ] 01-what-are-blueprints-what-you-can-do-with-them.md
  - [ ] 02-how-to-load-run-blueprints.md
  - [ ] 03-build-your-first-blueprint.md
  - [ ] index.md

</details>

<details open>
<summary><h3>Developers</h3></summary>

- 03-build-an-app
  - [ ] 01-index.md
- 05-local-development
  - [ ] 01-wp-now.md
  - [ ] 02-vscode-extension.md
  - [ ] 03-php-wasm-node.md
  - [ ] 04-wp-playground-cli.md
  - [ ] intro.md
- 06-apis
  - [ ] 01-index.md
  - javascript-api
    - [ ] 01-index.md
    - [ ] 02-index-html-vs-remote-html.md
    - [ ] 03-playground-api-client.md
    - [ ] 04-blueprint-json-in-api-client.md
    - [ ] 05-blueprint-functions-in-api-client.md
    - [ ] 06-mount-data.md
  - query-api
    - [ ] 01-index.md
- 07-xdebug
  - [ ] 01-introduction.md
  - [ ] 02-getting-started.md
- 23-architecture
  - [ ] 01-index.md
  - [ ] 02-wasm-php-overview.md
  - [ ] 03-wasm-php-compiling.md
  - [ ] 04-wasm-php-javascript-module.md
  - [ ] 05-wasm-php-filesystem.md
  - [ ] 07-wasm-asyncify.md
  - [ ] 08-browser-concepts.md
  - [ ] 09-browser-tab-orchestrates-execution.md
  - [ ] 10-browser-iframe-rendering.md
  - [ ] 11-browser-php-worker-threads.md
  - [ ] 12-browser-service-workers.md
  - [ ] 13-browser-scopes.md
  - [ ] 14-browser-cross-process-communication.md
  - [ ] 15-wordpress.md
  - [ ] 16-wordpress-database.md
  - [ ] 17-browser-wordpress.md
  - [ ] 18-host-your-own-playground.md
- 24-limitations
  - [ ] 01-index.md
- [ ] intro-devs.md

</details>
```

<!--
### Translating with the GitHub Web Interface
-->

### ગિટહબ વેબ ઇન્ટરફેસ દ્વારા અનુવાદ કરવો (Translating with the GitHub Web Interface)

<!--
If you prefer not to use developer tools, you can easily contribute translations directly on the GitHub website. All you need is a free GitHub account.
-->

જો તમે ડેવલપર ટૂલ્સનો ઉપયોગ ન કરવાનું પસંદ કરતા હો, તો તમે ગિટહબ વેબસાઇટ પર સીધા જ સરળતાથી અનુવાદમાં યોગદાન આપી શકો છો. તમારે ફક્ત એક મફત ગિટહબ એકાઉન્ટની જરૂર છે.

<!--
This guide will show you how to both update an existing translation and add a brand-new one.
-->

આ માર્ગદર્શિકા તમને હાલના અનુવાદને અપડેટ કરવા અને તદ્દન નવો અનુવાદ ઉમેરવા બંને કેવી રીતે કરવું તે બતાવશે.

---

<!--
#### Updating an Existing Translation
-->

#### હાલના અનુવાદને અપડેટ કરવો (Updating an Existing Translation)

<!--
1.  **Navigate to the file.** Go to the repository and find the file you want to update. Translation files are located in a folder named after their language code. For example, all French translations are in `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`.
-->

1.  **ફાઇલ પર જાઓ.** રિપોઝિટરી પર જાઓ અને તમે જે ફાઇલ અપડેટ કરવા માંગો છો તે શોધો. અનુવાદ ફાઇલો તેમના ભાષા કોડના નામવાળા ફોલ્ડરમાં સ્થિત છે. ઉદાહરણ તરીકે, બધા ફ્રેન્ચ અનુવાદો `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/` માં છે.

<!--
2.  **Open the editor.** Select the file you wish to edit and click the pencil icon (**Edit this file**) in the upper right corner.
    ![Editing existing translation](/img/contributing/editing-translations.webp)
-->

2.  **એડિટર ખોલો.** તમે જે ફાઇલમાં ફેરફાર કરવા માંગો છો તેને પસંદ કરો અને ઉપર જમણા ખૂણામાં પેન્સિલ આઇકન (**Edit this file**) પર ક્લિક કરો.
    ![હાલના અનુવાદમાં ફેરફાર કરવો](/img/contributing/editing-translations.webp)

<!--
3.  **Fork the repository.** GitHub will automatically prompt you to **Fork this repository**. This creates a personal copy for you to edit safely. Click the button to proceed.
-->

3.  **રિપોઝિટરી ફોર્ક કરો.** GitHub આપમેળે તમને **Fork this repository** માટે પૂછશે. આ તમારા માટે સુરક્ષિત રીતે ફેરફાર કરવા માટે વ્યક્તિગત નકલ (copy) બનાવે છે. આગળ વધવા માટે બટન પર ક્લિક કરો.

<!--
4.  **Make your changes.** The editor will open in your browser. Update the text with your improved translations.
-->

4.  **તમારા ફેરફારો કરો.** એડિટર તમારા બ્રાઉઝરમાં ખુલશે. તમારા સુધારેલા અનુવાદો સાથે ટેક્સ્ટ અપડેટ કરો.

<!--
5.  **Propose your changes.** Once you are finished, scroll to the bottom of the page. Add a brief title and description of your changes (e.g., "Fixing typos in French translation") and click the **Propose changes** button.
-->

5.  **તમારા ફેરફારો પ્રપોઝ કરો.** જ્યારે તમે પૂર્ણ કરી લો, ત્યારે પેજના નીચેના ભાગમાં સ્ક્રોલ કરો. તમારા ફેરફારોનું સંક્ષિપ્ત શીર્ષક અને વર્ણન ઉમેરો (દા.ત., "Fixing typos in French translation") અને **Propose changes** બટન પર ક્લિક કરો.

<!--
6.  **Create a Pull Request.** On the next screen, click the **Create pull request** button. This will submit your changes to the project maintainers for review.
-->

6.  **પુલ રિક્વેસ્ટ બનાવો.** પછીની સ્ક્રીન પર, **Create pull request** બટન પર ક્લિક કરો. આ સમીક્ષા માટે પ્રોજેક્ટ મેન્ટેનર્સને તમારા ફેરફારો સબમિટ કરશે.

---

<!--
#### Adding a New Translation
-->

#### નવો અનુવાદ ઉમેરવો (Adding a New Translation)

<!--
1.  **Determine the correct file path.** The new file's path and name must mirror the original English file.
    - **English original:** `packages/docs/site/docs/main/contributing/documentation.md`
    - **French translation:** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`
-->

1.  **યોગ્ય ફાઇલ પાથ નક્કી કરો.** નવી ફાઇલનો પાથ અને નામ મૂળ અંગ્રેજી ફાઇલ સાથે મેળ ખાતા હોવા જોઈએ (mirror હોવા જોઈએ).
    - **અંગ્રેજી મૂળ (English original):** `packages/docs/site/docs/main/contributing/documentation.md`
    - **ફ્રેન્ચ અનુવાદ (French translation):** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`

<!--
2.  **Create the new file.** Navigate to the correct language folder (e.g., `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`). Click **Add file** > **Create new file**.
    ![Creating a new translation](/img/contributing/adding-file-github-ui.webp)
    - **Pro Tip:** In the filename box, you can create new folders by typing the folder name followed by a `/`. For example, typing `main/contributing/documentation.md` will create the `main` and `contributing` folders automatically.
-->

2.  **નવી ફાઇલ બનાવો.** યોગ્ય ભાષાના ફોલ્ડર પર જાઓ (દા.ત., `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`). **Add file** > **Create new file** પર ક્લિક કરો.
    ![નવો અનુવાદ બનાવવો](/img/contributing/adding-file-github-ui.webp)
    - **પ્રો ટિપ (Pro Tip):** ફાઇલના નામ બોક્સમાં, તમે ફોલ્ડરનું નામ લખીને પછી `/` ટાઇપ કરીને નવા ફોલ્ડર બનાવી શકો છો. ઉદાહરણ તરીકે, `main/contributing/documentation.md` લખવાથી `main` અને `contributing` ફોલ્ડર્સ આપમેળે બની જશે.

<!--
3.  **Fork the repository.** Just like before, GitHub will prompt you to **Fork this repository**. Click the button to create your personal copy.
-->

3.  **રિપોઝિટરી ફોર્ક કરો.** પહેલાંની જેમ જ, GitHub તમને **Fork this repository** માટે પૂછશે. તમારી વ્યક્તિગત કૉપિ બનાવવા માટે બટન પર ક્લિક કરો.

<!--
4.  **Add the translated content.** The editor will open with an empty file. For the convenience of reviewers, please copy the content from the original English file and paste it into your new file, wrapping it in comment tags. Add your translation below it.

    ```markdown
    <!--
    This is the original English content.
    It helps reviewers understand the context of the translation.
    -->

    Ceci est le contenu traduit en français.
    ```

    ![GitHub UI Editor](/img/contributing/editor-github-ui.webp)
-->

4.  **અનુવાદિત સામગ્રી ઉમેરો.** એડિટર ખાલી ફાઇલ સાથે ખુલશે. સમીક્ષકોની સુવિધા માટે, કૃપા કરીને મૂળ અંગ્રેજી ફાઇલમાંથી સામગ્રી કૉપિ કરો અને તેને કૉમેન્ટ ટૅગ્સમાં લપેટીને તમારી નવી ફાઇલમાં પેસ્ટ કરો. તેની નીચે તમારો અનુવાદ ઉમેરો.

    ```markdown
    <!--
    This is the original English content.
    It helps reviewers understand the context of the translation.
    -->

    Ceci est le contenu traduit en français.
    ```

    ![ગિટહબ UI એડિટર](/img/contributing/editor-github-ui.webp)

<!--
5.  **Commit the new file.** When you are done, scroll to the bottom. Add a title for your new file (e.g., "Add French translation for documentation.md") and click the **Commit new file** button.
-->

5.  **નવી ફાઇલ કમિટ (Commit) કરો.** જ્યારે તમે પૂર્ણ કરી લો, ત્યારે નીચે સ્ક્રોલ કરો. તમારી નવી ફાઇલ માટે શીર્ષક ઉમેરો (દા.ત., "Add French translation for documentation.md") અને **Commit new file** બટન પર ક્લિક કરો.

<!--
6.  **Create a Pull Request.** On the next screen, click **Create pull request** to submit your new translation for review.
-->

6.  **પુલ રિક્વેસ્ટ બનાવો.** પછીની સ્ક્રીન પર, સમીક્ષા માટે તમારો નવો અનુવાદ સબમિટ કરવા માટે **Create pull request** પર ક્લિક કરો.

<!--
## Review Process
-->

## સમીક્ષા પ્રક્રિયા (Review Process)

<!--
To simplify the review process, please keep the original English text as a comment directly above the translated content.
-->

સમીક્ષા પ્રક્રિયાને સરળ બનાવવા માટે, કૃપા કરીને મૂળ અંગ્રેજી ટેક્સ્ટને અનુવાદિત સામગ્રીની બરાબર ઉપર કૉમેન્ટ તરીકે રાખો.

```
<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 Olá! Bem vindo a documentação oficial do WordPress Playground.

WordPress Playground é uma ferramenta online onde podes testar e aprender mais sobre o WordPress. Nesta página(Documentação) irá encontrar todas as informações necessárias para começar a trabalhar com o Playground.
```

<!--
<div class="callout callout-info">

This practice also helps the maintenance team identify outdated translations. When the original English content is updated, we can search the codebase for the old text (now in comments) and flag the corresponding translation for review.

</div>
-->

<div class="callout callout-info">

આ પદ્ધતિ મેન્ટેનન્સ ટીમને જૂના થયેલા અનુવાદો ઓળખવામાં પણ મદદ કરે છે. જ્યારે મૂળ અંગ્રેજી સામગ્રી અપડેટ થાય છે, ત્યારે અમે જૂના ટેક્સ્ટ (જે હવે કૉમેન્ટ્સમાં છે) માટે કોડબેઝ શોધી શકીએ છીએ અને સમીક્ષા માટે અનુરૂપ અનુવાદને ફ્લેગ કરી શકીએ છીએ.

</div>

<!--
To find a reviewer fluent in the language of your PR, you can post a request on the [Make WordPress Polyglots blog](https://make.wordpress.org/polyglots/). Be sure to include the locale tag (e.g., #ja for Japanese) to notify the appropriate General Translation Editors (GTEs).
-->

તમારી PR ની ભાષામાં અસ્ખલિત સમીક્ષક શોધવા માટે, તમે [Make WordPress Polyglots blog](https://make.wordpress.org/polyglots/) પર વિનંતી પોસ્ટ કરી શકો છો. યોગ્ય General Translation Editors (GTEs) ને સૂચિત કરવા માટે લોકેલ ટેગ (દા.ત., જાપાનીઝ માટે #ja, ગુજરાતી માટે #gu) શામેલ કરવાની ખાતરી કરો.

<!--
When the PR is merged, the translated version of that page should appear under `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, if you are contributing for the first time request your [Contributor Badge](/contributing/contributor-badge).
-->

જ્યારે PR મર્જ થઈ જશે, ત્યારે તે પેજનું અનુવાદિત સંસ્કરણ `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}` હેઠળ દેખાવું જોઈએ, જો તમે પ્રથમ વખત યોગદાન આપી રહ્યા હોવ તો તમારા [યોગદાનકર્તા બેજ (Contributor Badge)](/contributing/contributor-badge) ની વિનંતી કરો.
