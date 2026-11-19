---
slug: /contributing/github-ui
title: ગિટહબ વેબ ઇન્ટરફેસ દ્વારા યોગદાન આપો
description: સ્થાનિક ડેવલપમેન્ટ વાતાવરણ સેટ કર્યા વિના ગિટહબ પર સીધા પ્લેગ્રાઉન્ડ દસ્તાવેજીકરણમાં ફેરફાર કેવી રીતે કરવો તે જાણો.
---

<!--
# Contribute with the GitHub web interface
-->

# ગિટહબ વેબ ઇન્ટરફેસ દ્વારા યોગદાન આપો

<!--
You can improve Playground documentation directly on GitHub. This is useful for typo fixes, small clarifications, and translation updates when you do not want to clone the repository or set up a local development environment.
-->

તમે ગિટહબ પર સીધા જ પ્લેગ્રાઉન્ડના દસ્તાવેજીકરણ (documentation) માં સુધારો કરી શકો છો. જ્યારે તમે રિપોઝિટરીને ક્લોન કરવા અથવા સ્થાનિક ડેવલપમેન્ટ પર્યાવરણ (local development environment) સેટ કરવા માંગતા ન હોવ, ત્યારે જોડણીની ભૂલો સુધારવા (typo fixes), નાની સ્પષ્ટતાઓ કરવા અને અનુવાદ અપડેટ કરવા માટે આ ખૂબ ઉપયોગી છે.

<!--
Before you start, sign in to GitHub and identify the documentation page you want to change.
-->

શરૂ કરતાં પહેલાં, ગિટહબમાં સાઇન ઇન કરો અને તમે જે દસ્તાવેજીકરણ પેજ બદલવા માંગો છો તે શોધો.

<!--
## When to use this workflow
-->

## આ વર્કફ્લોનો ઉપયોગ ક્યારે કરવો

<!--
The GitHub web interface is a good fit for:
-->

ગિટહબ વેબ ઇન્ટરફેસ આ કાર્યો માટે શ્રેષ્ઠ અનુકૂળ છે:

<!--
- Fixing typos.
- Clarifying a sentence or paragraph.
- Updating links.
- Improving an existing translation.
- Adding a short documentation page.
-->

- જોડણીની ભૂલો (typos) સુધારવા માટે.
- કોઈ વાક્ય કે ફકરાને વધુ સ્પષ્ટ કરવા માટે.
- લિંક્સ અપડેટ કરવા માટે.
- હાલના અનુવાદમાં સુધારો કરવા માટે.
- એક નાનું દસ્તાવેજીકરણ પેજ ઉમેરવા માટે.

<!--
For larger changes, updates that need local preview, or changes that affect code, use the local workflow in [Documentation contributions](/contributing/documentation) or [Code contributions](/contributing/code).
-->

મોટા ફેરફારો, સ્થાનિક પ્રીવ્યૂની જરૂર હોય તેવા અપડેટ્સ, અથવા કોડને અસર કરતા ફેરફારો માટે, [દસ્તાવેજીકરણ યોગદાન](/contributing/documentation) અથવા [કોડ યોગદાન](/contributing/code) માં આપેલ સ્થાનિક વર્કફ્લોનો ઉપયોગ કરો.

<!--
## Find the documentation file
-->

## દસ્તાવેજીકરણ ફાઇલ શોધો

<!--
Most English documentation pages live in the [`packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) directory.
-->

મોટાભાગના અંગ્રેજી દસ્તાવેજીકરણ પેજ [`packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) ડિરેક્ટરીમાં આવેલા છે.

<!--
Translated documentation lives in [`packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n). For more details about translation file paths, see [Contributions to translations](/contributing/translations).
-->

અનુવાદિત દસ્તાવેજીકરણ [`packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) માં આવેલું છે. અનુવાદ ફાઇલ પાથ વિશે વધુ વિગતો માટે, [અનુવાદમાં યોગદાન](/contributing/translations) જુઓ.

<!--
For existing pages, the fastest way to find the source file is from the documentation site:
-->

હાલના પેજ માટે, સોર્સ ફાઇલ શોધવાની સૌથી ઝડપી રીત દસ્તાવેજીકરણ સાઇટ પરથી છે:

<!--
1. Open the documentation page you want to update.
2. Select the **Edit this page** link near the bottom of the page.
3. GitHub opens the source file for that page.
-->

1. તમે જે દસ્તાવેજીકરણ પેજ અપડેટ કરવા માંગો છો તે ખોલો.
2. પેજના નીચેના ભાગમાં આપેલ **Edit this page** (આ પેજમાં ફેરફાર કરો) લિંક પર ક્લિક કરો.
3. ગિટહબ તે પેજ માટેની સોર્સ ફાઇલ ખોલશે.

<!--
You can also browse the repository directly:
-->

તમે રિપોઝિટરીને સીધી પણ બ્રાઉઝ કરી શકો છો:

<!--
1. Open the [WordPress Playground repository](https://github.com/WordPress/wordpress-playground).
2. Browse to the relevant documentation directory.
3. Select the file that matches the page you want to update.
-->

1. [વર્ડપ્રેસ પ્લેગ્રાઉન્ડ રિપોઝિટરી](https://github.com/WordPress/wordpress-playground) ખોલો.
2. સંબંધિત દસ્તાવેજીકરણ ડિરેક્ટરી પર જાઓ.
3. તમે જે પેજ અપડેટ કરવા માંગો છો તેને અનુરૂપ ફાઇલ પસંદ કરો.

<!--
The screenshots below use translation files as examples, but the same GitHub controls apply to English documentation files.
-->

નીચે આપેલા સ્ક્રીનશૉટ્સ ઉદાહરણ તરીકે અનુવાદ ફાઇલોનો ઉપયોગ કરે છે, પરંતુ આ જ ગિટહબ કંટ્રોલ્સ અંગ્રેજી દસ્તાવેજીકરણ ફાઇલોને પણ લાગુ પડે છે.

<!--
## Edit an existing page
-->

## હાલના પેજમાં ફેરફાર કરો

<!--
1. Open the file in GitHub.
2. Select the pencil icon to edit the file.
3. If GitHub asks you to fork the repository, follow the prompt. This creates a copy under your GitHub account.
4. Make your changes in the editor.
-->

1. ગિટહબમાં ફાઇલ ખોલો.
2. ફાઇલમાં ફેરફાર કરવા માટે પેન્સિલ આઇકન પસંદ કરો.
3. જો ગિટહબ તમને રિપોઝિટરી ફોર્ક (fork) કરવાનું કહે, તો સૂચના મુજબ આગળ વધો. આ તમારા ગિટહબ એકાઉન્ટ હેઠળ એક કૉપિ બનાવશે.
4. એડિટરમાં તમારા ફેરફારો કરો.

<!--
![Editing a documentation file in GitHub](/img/contributing/editing-translations.webp)
-->

![ગિટહબમાં દસ્તાવેજીકરણ ફાઇલ એડિટ કરવી](/img/contributing/editing-translations.webp)

<!--
GitHub's web editor is best for small, focused changes. If your update is large or needs local preview, use the local workflow in [Documentation contributions](/contributing/documentation).
-->

ગિટહબનું વેબ એડિટર નાના અને ચોક્કસ ફેરફારો માટે શ્રેષ્ઠ છે. જો તમારો સુધારો મોટો હોય અથવા લોકલ પ્રીવ્યૂની જરૂર હોય, તો [દસ્તાવેજીકરણ યોગદાન](/contributing/documentation) માં આપેલ સ્થાનિક વર્કફ્લોનો ઉપયોગ કરો.

<!--
## Add a new page
-->

## નવું પેજ ઉમેરો

<!--
1. Open the directory where the new page should live.
2. Select **Add file** and then **Create new file**.
3. Enter the file name. You can create folders by typing the folder name followed by `/`.
4. Add the page content.
5. Mention where the page should appear in the documentation sidebar when you open the pull request.
   If you are comfortable editing another file, you can also add the page to
   [`packages/docs/site/sidebars.js`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/docs/site/sidebars.js).
-->

1. નવું પેજ જે ડિરેક્ટરીમાં હોવું જોઈએ તે ડિરેક્ટરી ખોલો.
2. **Add file** પસંદ કરો અને પછી **Create new file** પસંદ કરો.
3. ફાઇલનું નામ દાખલ કરો. તમે ફોલ્ડરનું નામ લખીને ત્યારબાદ `/` ઉમેરીને નવા ફોલ્ડર્સ બનાવી શકો છો.
4. પેજની સામગ્રી ઉમેરો.
5. જ્યારે તમે પુલ રિક્વેસ્ટ (pull request) બનાવો, ત્યારે જણાવો કે આ પેજ દસ્તાવેજીકરણના સાઇડબારમાં ક્યાં દેખાવું જોઈએ.
   જો તમે અન્ય ફાઇલ એડિટ કરવામાં સરળતા અનુભવો છો, તો તમે આ પેજને
   [`packages/docs/site/sidebars.js`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/docs/site/sidebars.js) માં પણ ઉમેરી શકો છો.

<!--
![Creating a new documentation file in GitHub](/img/contributing/adding-file-github-ui.webp)
-->

![ગિટહબમાં નવી દસ્તાવેજીકરણ ફાઇલ બનાવવી](/img/contributing/adding-file-github-ui.webp)

<!--
For new English documentation pages, add front matter at the top of the file:

```markdown
---
slug: /example-page
title: Example page
description: A short description of the page.
---
```
-->

નવા અંગ્રેજી દસ્તાવેજીકરણ પેજ માટે, ફાઇલની ટોચ પર ફ્રન્ટ મેટર (front matter) ઉમેરો:

```markdown
---
slug: /example-page
title: Example page
description: A short description of the page.
---
```

<!--
For new translated pages, mirror the English file path in the matching language directory. For example,
a French translation of `packages/docs/site/docs/main/contributing/documentation.md` belongs in
`packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`.
Keep the original English content in a comment above the translation so reviewers can compare the text.
-->

નવા અનુવાદિત પેજ માટે, સંબંધિત ભાષાની ડિરેક્ટરીમાં અંગ્રેજી ફાઇલ પાથને જ અનુસરો. ઉદાહરણ તરીકે,
`packages/docs/site/docs/main/contributing/documentation.md` નો ફ્રેન્ચ (French) અનુવાદ
`packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md` માં રહેશે.
મૂળ અંગ્રેજી સામગ્રીને અનુવાદની ઉપર કૉમેન્ટ (comment) તરીકે રાખો જેથી સમીક્ષકો લખાણની સરખામણી કરી શકે.

<!--
## Review your changes
-->

## તમારા ફેરફારોની સમીક્ષા (Review) કરો

<!--
Before submitting, use the **Preview** tab in GitHub to check basic Markdown formatting. This is not
a full Docusaurus preview, so also review links and images carefully. Site-relative paths such as
`/img/contributing/example.webp` may not behave the same way in GitHub's Markdown preview.
-->

સબમિટ કરતાં પહેલાં, મૂળભૂત માર્કડાઉન (Markdown) ફોર્મેટિંગ ચકાસવા માટે ગિટહબમાં **Preview** ટેબનો ઉપયોગ કરો. આ સંપૂર્ણ Docusaurus પ્રીવ્યૂ નથી, તેથી લિંક્સ અને છબીઓની પણ કાળજીપૂર્વક સમીક્ષા કરો. સાઇટ-સાપેક્ષ પાથ (site-relative paths) જેમ કે `/img/contributing/example.webp` ગિટહબના માર્કડાઉન પ્રીવ્યૂમાં સમાન રીતે કામ ન પણ કરે.

<!--
![Editing content in the GitHub web editor](/img/contributing/editor-github-ui.webp)
-->

![ગિટહબ વેબ એડિટરમાં સામગ્રી એડિટ કરવી](/img/contributing/editor-github-ui.webp)

<!--
Look for:
-->

આ બાબતો ચકાસો:

<!--
- Headings in the right order.
- Working links.
- Lists and code blocks that render correctly.
- A focused change that is easy to review.
-->

- હેડિંગ્સ યોગ્ય ક્રમમાં હોય.
- લિંક્સ બરાબર કામ કરતી હોય.
- લિસ્ટ્સ અને કોડ બ્લૉક્સ યોગ્ય રીતે દેખાતા હોય.
- ફેરફાર ચોક્કસ અને સમજવામાં સરળ હોય જેથી સમીક્ષા સરળ બને.

<!--
## Propose the change
-->

## ફેરફાર પ્રપોઝ (Propose) કરો

<!--
1. Scroll to the **Commit changes** section.
2. Add a short commit message, such as `Fix typo in documentation guide`.
3. Add a short description if the change needs context.
4. Select the option to create a new branch for the commit.
5. Select **Propose changes**.
6. On the next page, select **Create pull request**.
-->

1. નીચે સ્ક્રોલ કરીને **Commit changes** વિભાગ પર જાઓ.
2. એક નાનો કમિટ સંદેશ (commit message) ઉમેરો, જેમ કે `Fix typo in documentation guide`.
3. જો ફેરફાર માટે વધારાના સંદર્ભની જરૂર હોય, તો નાનું વર્ણન (description) ઉમેરો.
4. કમિટ માટે નવી બ્રાન્ચ (new branch) બનાવવાનો વિકલ્પ પસંદ કરો.
5. **Propose changes** પસંદ કરો.
6. પછીના પેજ પર, **Create pull request** પસંદ કરો.

<!--
## What happens next
-->

## આગળ શું થશે?

<!--
A maintainer will review your pull request. They may ask for changes before merging it.
-->

એક મેન્ટેનર (maintainer) તમારી પુલ રિક્વેસ્ટની સમીક્ષા કરશે. તેને મર્જ કરતાં પહેલાં તેઓ કેટલાક ફેરફારો સૂચવી શકે છે.

<!--
If you are contributing translations, you can also request a review in the `#polyglots` or `#playground` channel in [Make WordPress Slack](https://make.wordpress.org/chat/).
-->

જો તમે અનુવાદમાં યોગદાન આપી રહ્યા હોવ, તો તમે [Make WordPress Slack](https://make.wordpress.org/chat/) ના `#polyglots` અથવા `#playground` ચેનલમાં પણ સમીક્ષા માટે વિનંતી કરી શકો છો.
