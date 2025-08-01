---
title: Playground sa Native na iOS Apps
slug: /guides/wordpress-native-ios-app
description: WordPress Playground sa mga Native na iOS Apps
---

## Paano Mag-ship ng Tunay na WordPress Site sa Native na iOS App gamit ang Playground?

Ang Blocknotes ang kauna-unahang iOS application na nagpapatakbo ng WordPress nang native sa mga iOS device sa pamamagitan ng paggamit ng WordPress Playground. Binuo ni [Ella van Durpe](https://profiles.wordpress.org/ellatrix/), isang core committer para sa WordPress, ang Blocknotes ay isang malaking hakbang sa kakayahan ng mga mobile application sa pamamagitan ng paggamit ng WebAssembly upang patakbuhin ang WordPress nang hindi kailangan ng tradisyonal na PHP server.

Tinutuklas ng case study na ito ang mga feature, teknikal na implementasyon, at potensyal na implikasyon ng Blocknotes para sa hinaharap ng mobile at web development.

**Mahalaga!** Ang kasalukuyang bersyon ng Blocknotes ay hindi na gumagamit ng WordPress Playground. Mula nang unang ilunsad, muling isinulat ang app upang gamitin lamang ang WordPress block editor nang walang iba pang bahagi ng WordPress. Sinasaklaw ng case study na ito ang mga unang bersyon ng Blocknotes na nagbukas ng bagong mundo ng mga posibilidad para sa WordPress.

## Mga Tampok ng Blocknotes

Pinapayagan ng Blocknotes ang mga user na lumikha at mag-edit ng mga tala gamit ang WordPress block editor. Awtomatikong nai-save ang mga tala bilang mga HTML file sa iCloud Drive ng user at kusang naka-synchronize sa iba't ibang device.

## Teknikal na Implementasyon

Ang Blocknotes ay nagpapatakbo bilang isang WebView na nagpapatupad ng isang HTML page kung saan ang isang WebAssembly na bersyon ng PHP ay nagpapatakbo ng WordPress. Ang HTML page na iyon ay naka-package bilang isang native na iOS app gamit ang [Capacitor](https://capacitorjs.com/). Pinayagan ng setup na ito ang WordPress na gumana sa mga environment na tradisyonal na hindi suportado.

Sa [Blocknotes GitHub repository](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748) maaari mong suriin ang huling release na nakabase sa Playground. Narito ang mga pinakamahalagang bahagi:

-   [Isang WordPress build](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/wp-6.2.data) (nai-package bilang isang `.data` file).
-   [Static na WordPress assets](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/public).
-   [Isang WebAssembly build ng PHP](https://github.com/blocknotes-org/blocknotes/tree/e08535883332be9a45a0c75b750c54a4e17f6748/node_modules/@php-wasm/web) (sa pamamagitan ng [@php-wasm/web](https://npmjs.com/package/@php-wasm/web)).
-   [Isang web worker na nagpapatakbo ng PHP at WordPress](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/worker.js).
-   [Hypernotes](https://wordpress.com/plugins/hypernotes) plugin ng WordPress ([ini-install dito](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L160)) para gawing note-taking app ang wp-admin.
-   Isang layer para sa [pag-load ng WordPress posts mula sa mga iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/index.js#L39) at [pag-save ng mga pagbabago bilang iOS files](https://github.com/blocknotes-org/blocknotes/blob/e08535883332be9a45a0c75b750c54a4e17f6748/src/js/save-data.js).

## Paggawa ng Sariling iOS App gamit ang WordPress Playground

Bagaman napatunayan ng Blocknotes na posible ang pagpapalabas ng iOS app na nakabase sa WordPress, napaka-eksploratoryo pa rin nitong larangan. Wala pang establisadong workflow, library, o knowledge base.

Ang pinakamahusay na dokumentasyon na mayroon tayo ay ang Blocknotes repository. Gamitin ito bilang sanggunian at panimulang punto para sa paggalugad ng iyong bagong app. Suriin ang mga pangunahing bahagi tulad ng WebAssembly build ng PHP, ang integrasyon ng WordPress block editor, at kung paano ginagamit ang web workers upang patakbuhin nang mahusay ang WordPress. Sa pamamagitan ng pagbubuo ng mga elementong ito, makakakuha ka ng mga insight sa paggawa ng iyong sariling iOS app gamit ang WordPress Playground, na itinutulak ang mga hangganan ng kung ano ang posible sa mga mobile web application.

Habang naglalakbay ka sa makabagong espasyong ito, ibahagi ang iyong mga natuklasan at hamon sa Playground team at mas malawak na komunidad ng WordPress. Ang pag-publish ng iyong mga natutunan ay hindi lamang makakatulong sa iyong development kundi pati sa kolektibong knowledge base, na nagtutulak sa hinaharap ng WordPress sa mobile.

## Potensyal at Hinaharap

Ang Blocknotes ang nagbukas ng daan para sa bagong henerasyon ng mga application na mas accessible, flexible, at powerful.

Kapag matured na ang workflows sa paggawa ng app, maaari nating makita ang automated pipeline para sa pag-package ng mga Playground site bilang iOS apps. Maging napakadali nitong patakbuhin ang parehong codebase sa server, sa browser, at bilang mobile app.

Sa pamamagitan ng pagtutulungan at pagbabahagi ng ating mga natuklasan, mapupulpush natin ang mga hangganan ng kung ano ang posible gamit ang WordPress at mobile app development.
