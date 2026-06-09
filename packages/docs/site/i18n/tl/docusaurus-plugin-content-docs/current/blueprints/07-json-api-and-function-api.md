---
title: API Consistency
slug: /blueprints/steps/api-consistency
description: Matuto tungkol sa relasyon sa pagitan ng Blueprint JSON format at ang underlying JavaScript function API na ginagamit para mag-execute ng mga steps.
---

# JSON API at Function API

Ang mga Blueprint ay na-define sa JSON format, pero ang underlying implementation ay gumagamit ng JavaScript functions para mag-execute ng mga steps. Habang ang JSON ay ang pinaka-convenient na paraan para makipag-interact sa mga Blueprint, maaari mo ring gamitin ang underlying functions nang direkta.

Ang JSON ay isang wrapper lang sa mga functions. Kung gumagamit ka ng JSON steps o exported functions, kailangan mong mag-provide ng parehong parameters (maliban sa step name):

Maaari mong gamitin ang mga Blueprint pareho sa web at node.js versions ng WordPress Playground.

<div class="callout callout-info">

<strong>Blueprints version 2</strong>

Ang team ay nag-e-explore ng mga paraan para i-transition ang mga Blueprint mula sa TypeScript library patungong PHP library. Ito ay magpapahintulot sa mga tao na magpatakbo ng mga Blueprint sa anumang WordPress environments: Playground, hosted site, o local setup.

Ang proposed <a href="https://github.com/WordPress/blueprints-library/issues/6">new specification</a> ay na-discuss sa isang hiwalay na <a href="https://github.com/WordPress/blueprints-library/">GitHub repository</a>, at welcome ka na sumali (doon o sa <a href="https://wordpress.slack.com/archives/C04EWKGDJ0K">#playground</a> Slack channel) at tumulong sa pag-shape ng next generation ng Playground.

</div>

## Mga pagkakaiba sa pagitan ng JSON at Function APIs

May dalawang pangunahing pagkakaiba sa pagitan ng JSON at Function APIs:

1. Ang mga Blueprint ay nagha-handle ng progress bar at error reporting para sa iyo. Ang function API ay nangangailangan na i-handle mo ang mga ito nang mag-isa.
2. Ang function API ay nangangailangan ng pag-import ng API client library habang ang mga Blueprint ay maaaring i-paste lang sa URL fragment.

<div class="callout callout-info">

Tingnan ang <a href="https://github.com/WordPress/wordpress-playground/pull/215">Use the same structure for Blueprint JSON definitions and step handlers</a> issue sa <a href="https://github.com/WordPress/wordpress-playground">wordpress-playground</a> repo para sa mas detalyadong impormasyon tungkol sa topic na ito

</div>
