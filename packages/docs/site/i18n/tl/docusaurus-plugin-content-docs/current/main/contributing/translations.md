---
slug: /contributing/translations
---

# Mga Kontribusyon sa Mga Pagsasalin

Maaari kang tumulong sa pagsasalin ng dokumentasyon ng Playground sa anumang wika. Nagbibigay ang pahinang ito ng komprehensibong gabay kung paano mag-ambag sa pagsasalin ng mga Playground docs.

## Paano Ako Makakatulong sa Pagsasalin?

Gamitin ang parehong workflow tulad ng pag-aambag sa alinmang ibang pahina ng docs. Maaari kang mag-fork ng [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) at gumawa ng PRs sa iyong mga pagbabago, o mag-edit ng mga pahina nang direkta gamit ang GitHub UI.

:::info
Tingnan ang [Paano Ako Makakatulong?](/contributing/documentation#how-can-i-contribute) para matuto nang higit pa kung paano mag-ambag sa Playground Docs
:::

## Mga Detalye sa Implementasyon ng Mga Pagsasalin

:::info
Tingnan ang [Internationalization section](https://docusaurus.io/docs/i18n/introduction) ng Docusaurus Docs para malaman ang tungkol sa pamamahala ng mga pagsasalin sa isang Docusaurus site (ang engine sa likod ng Playground Docs).
:::

Ang mga wikang available para sa site ng Docs ay tinutukoy sa `docusaurus.config.js`. Halimbawa:

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

Ang mga isinaling pahina ng docs ay matatagpuan sa repositoryong [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground).

Sa ilalim ng `packages/docs/site/i18n/` ay may folder para sa bawat wika.  
Halimbawa, para sa `es` (Espanyol) ay may `packages/docs/site/i18n/es` folder.

Sa loob ng bawat folder ng wika ay dapat may `docusaurus-plugin-content-docs/current` folder.  
Halimbawa, para sa `es` (Espanyol) ay may `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current` folder.

Sa loob ng `docusaurus-plugin-content-docs/current` ay dapat tularan ang parehong istruktura ng mga file ng orihinal na docs (kapareho ng istruktura sa ilalim ng `packages/docs/site/docs`).

Halimbawa, para sa `es` (Espanyol) ang sumusunod na isinaling file ay umiiral:  
`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`

Kung ang isang file ay hindi available sa folder ng isang wika, gagamitin ang orihinal na file sa default na wika.

Kapag nadagdag ang bagong wika (tingnan ang PR [#1807](https://github.com/WordPress/wordpress-playground/pull/1807)), maaari mong patakbuhin ang `npm run write-translations -- --locale <%LANGUAGE%>` mula sa `packages/docs/site` upang makabuo ng JSON files na may mga mensaheng maaaring isalin para sa partikular na wika.

Sa tamang i18n na configuration sa `docusaurus.config.js` at mga files sa ilalim ng `i18n`, kapag pinatakbo ang `npm run build:docs` mula sa root ng proyekto ay malilikha ang mga partikular na folder sa `dist` para sa bawat wika.

## Paano Subukan nang Lokal ang Isang Wika

Upang subukan nang lokal ang umiiral na wika, maaari mong gawin ang mga sumusunod:

-   I-modify (isalin) ang anumang file sa ilalim ng isa sa mga available na wika:  
    `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`
-   Mula sa `/packages/docs/site` patakbuhin ang bersyon para sa wikang nais mong subukan. Halimbawa, para subukan ang `es`:

```
npm run dev -- --locale es
```

## Language Switcher - UI element para Palitan ang Wika

Ang "Language Switcher" ay isang UI element na ibinibigay ng docusaurus (ang engine sa likod ng Playground Docs) na nagpapahintulot sa user na palitan ang wika ng isang pahina.

Upang bigyan ng mas magandang visibility ang isang isinaling bersyon, maaaring ipakita ang language switcher sa pamamagitan ng pagdagdag ng sumusunod sa `docusaurus.config.js`:

```
{
  type: 'localeDropdown',
  position: 'right',
},
```

Magbibigay ito ng dropdown sa header para direktang ma-access ang bersyon ng bawat file sa nais na wika.

Mahigpit na inirerekomenda na ang isang wika ay i-activate lamang sa Dropdown kapag may sapat na dami ng mga pahina na naisalin. Kung i-aactivate ito nang kakaunti pa lamang ang naisalin na pahina, ang karanasan ng user ay hindi kapani-paniwala dahil kapag nagpalit sa wika ay walang pahina ang naisalin.

### Pagpapagana ng Isang Wika sa Language Switcher

Lahat ng wika ay available kapag tapos na ang i18n setup para sa wika at naroroon ang tamang istruktura ng mga file sa ilalim ng `i18n`.

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

Dapat itago muna sa language switcher ang mga bersyon ng wika na may kulang pang pagsasalin. Upang maging mas tumpak, ang rekomendasyon ay ipakita lamang ang isang wika sa Language Switcher kapag nakumpleto na ang [Documentation](https://wordpress.github.io/wordpress-playground/) section para sa partikular na wika kabilang ang mga sumusunod na seksyon:

-   [Quick Start Guide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Playground web instance](https://wordpress.github.io/wordpress-playground/web-instance)
-   [About Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guides](https://wordpress.github.io/wordpress-playground/guides)
-   [Contributing](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links and Resources](https://wordpress.github.io/wordpress-playground/resources)

Kahit hindi nakikita sa language switcher ang isang wika, maaari pa ring magpatuloy ang trabaho sa pagdagdag ng naisaling pahina, dahil magiging available ang mga isinaling pahina kapag na-merge na ang mga PR na naglalaman ng mga naisaling file.

### Pagsubok sa Language Switcher nang Lokal

Tungkol sa pagsubok ng `localeDropdown` nang lokal, napansin ko na kahit naipapakita ito nang lokal ay hindi ito gumagana nang maayos dahil hindi nakikita ang mga naisaling pahina. Ngunit maayos naman itong gumagana sa production.

Maaari mong subukan ang `localeDropdown` mula sa anumang fork sa pamamagitan ng:

```
npm run build:docs
npm run deploy:docs
```

Gagawa ito ng tatlong bersyon ng docs sa GitHub Pages ng iyong fork:

```
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/es/
https://<%GH-USER-WITH-FORK%>.github.io/wordpress-playground/fr/
```

Kaya, isang posibleng paraan para subukan ang `localeDropdown` feature ay sa pamamagitan ng pag-deploy nito sa GitHub Pages ng isang forked repository.

## Proseso para Isalin ang Isang Pahina sa Isang Wika

Ang inirerekomendang proseso ay kopyahin at i-paste ang `.md` file mula sa orihinal na path (`packages/docs/site/docs`) papunta sa nais na language path (`packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current`). Mahalaga na gayahin ang istruktura ng mga file sa `packages/docs/site/docs`.

Ang file sa ilalim ng `packages/docs/site/i18n/{%LANGUAGE%}/docusaurus-plugin-content-docs/current` ay maaari nang isalin at isang PR ang maaaring likhain sa mga bagong pagbabago.

Kapag na-merge ang PR, dapat lumabas ang naisaling bersyon ng pahina sa  
https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}
