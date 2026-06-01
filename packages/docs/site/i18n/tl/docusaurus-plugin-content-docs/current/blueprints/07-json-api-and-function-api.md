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

**Blueprints bersyon 2**

Suportado ang mga Blueprint v2 declaration sa Playground web app, client
package, at CLI. Pinapanatili ng bersyon 2 ang JSON declaration model, pero
inililipat ang WordPress setup sa mas mataas na seksyon gaya ng `plugins`,
`themes`, `content`, at `media`, na may dagdag na puwang para sa mga hakbang sa
`additionalStepsAfterExecution`.

Ang pampublikong [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json)
ay nagva-validate ng parehong v1 at v2 declarations. Para gumamit ng v2, itakda
ang `"version": 2`.

</div>

## Mga pagkakaiba sa pagitan ng JSON at Function APIs

May dalawang pangunahing pagkakaiba sa pagitan ng JSON at Function APIs:

1. Ang mga Blueprint ay nagha-handle ng progress bar at error reporting para sa iyo. Ang function API ay nangangailangan na i-handle mo ang mga ito nang mag-isa.
2. Ang function API ay nangangailangan ng pag-import ng API client library habang ang mga Blueprint ay maaaring i-paste lang sa URL fragment.

<div class="callout callout-info">

Tingnan ang [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue sa [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo para sa mas detalyadong impormasyon tungkol sa topic na ito

</div>
