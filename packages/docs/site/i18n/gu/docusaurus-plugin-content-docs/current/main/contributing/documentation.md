---
title: દસ્તાવેજીકરણમાં યોગદાન
slug: /contributing/documentation
description: WordPress Playground દસ્તાવેજીકરણમાં યોગદાન કેવી રીતે કરવું — ઇશ્યૂ ખોલવાથી લઈને PR મોકલવા, બ્રાઉઝરમાં એડિટ કરવા અને લોકલ પ્રીવ્યૂ ચલાવવાના પગલાં.
---

# દસ્તાવેજીકરણમાં યોગદાન

<!--
# Documentation contributions
-->

[WordPress Playground ની દસ્તાવેજીકરણ સાઇટ](/) તમારા જેવા સ્વયંસેવકો દ્વારા સંચાલિત છે — અને તેમને તમારી મદદ ગમે છે।

<!--
WordPress Playground's documentation site is maintained by volunteers like you, who'd love your help.
-->

[WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) રેપોઝિટરીમાં દસ્તાવેજીકરણ સંબંધિત તમામ ઇશ્યૂઝને [\[Type\] Documentation](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22)  અથવા [\[Type\] Developer Documentation](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) લેબલ આપવામાં આવે છે. ખુલ્લા ઇશ્યૂઝની યાદી જુઓ અને જે ઇશ્યૂ પર તમે કામ કરવાનું ઇચ્છો તે પસંદ કરો. અન્યથા, જો તમને લાગે કે વર્તમાન દસ્તાવેજીકરણમાં કંઈક ગૂમ છે, તો તમારી સલાહ પર ચર્ચા કરવા માટે નવો ઇશ્યૂ ખોલો.

<!--
All documentation-related issues are labeled [Type] Documentation or [Type] Developer Documentation in the WordPress/wordpress-playground repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.
-->

## હું કેવી રીતે યોગદાન આપી શકું?

<!--
## How can I contribute?
-->

તમે [પ્રોજેક્ટ રિપોઝિટરીમાં ઇશ્યૂ ખોલીને](https://github.com/WordPress/wordpress-playground/issues/new) શું ઉમેરવું છે કે શું બદલવું છે તેનું વર્ણન કરી શકો છો।    

<!--
You can contribute by opening an issue in the project repository and describing what you'd like to add or change.
-->

તમને અનુકૂળ હોય તો ઇશ્યૂના વર્ણનમાં જ કન્ટેન્ટ લખી દો; પછીનું કામ પ્રોજેક્ટ યોગદાનકર્તાઓ સંભાળી લેશે।

<!--
If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.
-->

શું તમે દસ્તાવેજીકરણને તમારી ભાષામાં જોવા માંગો છો? તો [ટ્રાન્સલેશન વિભાગ](/contributing/translations) જુઓ।

<!--
Would you like to see the documentation in your language? Check the Translation section.
-->

### રેપો ફૉર્ક કરવો, લોકલી ફાઇલો એડિટ કરવી અને Pull Request મોકલવો

<!--
### Forking the repo, edit files locally and opening Pull Requests
-->

જો તમે માર્કડાઉનથી પરિચિત છો, તો તમે `wordpress-playground` રેપોને [ફોર્ક](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) કરી શકો છો અને પુલ રિક્વેસ્ટ સબમિટ કરીને ફેરફારો અને નવા દસ્તાવેજીકરણ પૃષ્ઠોનો પ્રસ્તાવ મૂકી શકો છો.

<!--
If you are familiar with markdown, you can fork the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.
-->

WordPress/wordpress-playground રેપોઝિટરીમાં અનુવાદિત પેજ સાથે નવી બ્રાન્ચ બનાવી PR ખોલવાની પ્રક્રિયા બાકી WordPress રેપોઝિટરીઓ (જેમ કે Gutenberg) જેવી જ છે: https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

<!--
The process of creating a branch to open new PRs with translated pages on the WordPress/wordpress-playground repository is the same as contributing to other WordPress repositories such as gutenberg: https://developer.wordpress.org/block-editor/contributors/code/git-workflow/
-->

દસ્તાવેજીકરણની `.md` ફાઇલો Playground ની GitHub રેપોઝિટરીમાં રાખેલી છે: અંગ્રેજી માટે `/packages/docs/site/docs` અને અન્ય ભાષાઓ માટે `/packages/docs/site/i18n`।

<!--
The documentation files (`.md` files) are stored in Playground's GitHub repository, under /packages/docs/site/docs for English and /packages/docs/site/i18n for other languages.
-->

### બ્રાઉઝરમાં સીધું એડિટ કરવું

<!--
### Edit in the browser
-->

જો તમે GitHub માં લૉગઇન હો, તો GitHub UI માંથી જ ફાઇલમાં ફેરફાર કરી શકો છો (અથવા નવી ફાઇલ ઉમેરી શકો છો) અને સીધો PR મોકલી શકો છો:

<!--
If logged in GitHub, you can also edit existing files (or add new ones) and submit a PR directly from the GitHub UI:
-->

1. જે પેજ એડિટ કરવું છે તે શોધો, અથવા જે ચેપ્ટરમાં નવું પેજ ઉમેરવું છે તે ડિરેક્ટરી શોધો।  
2. નવી ફાઇલ ઉમેરવા માટે **Add files** બટન ક્લિક કરો; અથવા કોઈ હાલની ફાઇલ ખોલીને **પેન્સિલ (edit)** આઇકન ક્લિક કરો।  
3. GitHub તમારા ફેરફારો માટે રેપોઝિટરી ફૉრკ કરવા અને નવી બ્રાન્ચ બનાવવા કહેશે।  
4. એડિટર ખુલશે, જ્યાં તમે ફેરફારો કરી શકશો।  
5. કામ પૂરૂં થયા બાદ **Commit changes** ક્લિક કરો અને Pull Request મોકલો।

<!--
1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the Add Files button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the Commit Changes button and submit a Pull Request.
-->

બસ એટલું જ! હવે તમે WordPress Playground દસ્તાવેજીકરણમાં યોગદાન આપી દીધું।

<!--
That's it! You've just contributed to the WordPress Playground documentation.
-->

આ રીતથી તમને રેપો ક્લોન કરવાની, લોકલ ડેવલપમેન્ટ એન્વાયરમેન્ટ બનાવવાની અથવા કોઈ કમાન્ડ ચલાવવાની જરૂર નથી। ખામી એ છે કે તમે ફેરફારોનું પ્રીવ્યૂ આગળથી જોઈ શકશો નહીં — Pull Request મોકલતા પહેલા ફેરફારો કેવી રીતે પ્રીવ્યૂ કરવાના તે નીચે જુઓ।

<!--
This approach means you don't need to clone the repository, set up a local development environment, or run any commands. The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.
-->

### લોકલ પ્રીવ્યૂ

<!--
### Local preview
-->

રેપોઝિટરી ક્લોન કરો અને તમારા ડિવાઇસ પર સંબંધિત ડિરેક્ટરીમાં જાઓ. હવે નીચેની કમાન્ડ ચલાવો:

<!--
Clone the repository and navigate to the directory on your device. Now run the following commands:
-->

 ```bash
 npm install
 npm run build:docs
 npm run dev:docs
+```

દસ્તાવેજીકરણ સાઇટ નવા બ્રાઉઝર ટૅબમાં ખુલશે અને દરેક ફેરફાર બાદ આપમેળે રિફ્રેશ થશે. હવે તમારા કોડ એડિટરમાં સંબંધિત ફાઇલ એડિટ કરતા રહો અને બદલાવ રિયલ-ટાઇમમાં ચકાસો।

<!-- The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time. -->