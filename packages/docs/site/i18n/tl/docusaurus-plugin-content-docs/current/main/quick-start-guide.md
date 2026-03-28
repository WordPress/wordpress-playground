---
title: Gabay sa Mabilis na Pagsisimula
slug: /quick-start-guide
description: Isang 5-minuto na gabay para magsimula sa Playground. Matuto kung paano subukan ang mga plugin, subukan ang mga tema, at gumamit ng iba't ibang bersyon ng WP/PHP.
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

# Magsimula gamit ang WordPress Playground sa loob ng 5 minuto

Maaaring makatulong sa iyo ang WordPress Playground sa alinman sa mga sumusunod:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

Ang pahinang ito ang gagabay sa bawat hakbang. At para sa mga visual na nag-aaral—narito ang isang video:

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" allowFullScreen></iframe>

## Magsimula ng bagong WordPress site

Sa tuwing bibisita ka sa [opisyal na demo sa playground.wordpress.net](https://playground.wordpress.net/), makakakuha ka ng bagong WordPress site.

Mula doon, maaari kang gumawa ng mga pahina, mag-upload ng plugin o theme, mag-import ng sariling site, at gawin ang karamihang ginagawa mo sa regular na WordPress.

Napakadaling magsimula!

Ang buong site ay nasa browser mo at matatanggal kapag isinara mo ang tab. Gusto mong magsimula muli? I-refresh lang ang pahina!

:::info WordPress Playground ay Pribado

Lahat ng iyong ginawa ay nananatili sa browser at **hindi** ipinapadala kahit saan. Pagkatapos, maaari mong i-export ang iyong site bilang zip file. O i-refresh lang upang magsimula muli!

:::

## Subukan ang isang block, theme, o plugin

Maaari kang mag-upload ng anumang plugin o theme sa [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

Para mas mapabilis, maaari kang mag-preinstall ng plugin o theme mula sa WordPress directory gamit ang `plugin` o `theme` parameter sa URL. Halimbawa, para sa coblocks plugin:

https://playground.wordpress.net/?plugin=coblocks

O para sa `pendant` theme:

https://playground.wordpress.net/?theme=pendant

Kung nais mong mag-install ng maraming tema at plugin, posibleng ulitin ang `theme` o `plugin` na mga parameter:

https://playground.wordpress.net/?theme=pendant&theme=acai

Maaari ka ring maghalo ng mga parameter at magdagdag ng maraming plugin:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

## I-save ang iyong site

Para hindi mawala ang iyong site pagkatapos ng single browser session, i-export ito bilang `.zip` file.

1. Buksan ang Site Manager panel:

![Site Manager](@site/static/img/site-manager/open-site-manager.webp)

2. Gamitin ang button na "Download as .zip" sa additional actions menu:

![Export button](@site/static/img/site-manager/export-zip-file.webp)

Ang na-export na file ay naglalaman ng buong site na iyong binuo, kasama ang database (`wp-content/database/.ht.sqlite`). Tandaan na ang mga nak начин ng tuldok ay nakatago, kaya maaaring kailangan mong i-enable ang "Show hidden files."

## I-restore ang na-save na site

Maaari mong i-restore ang na-save na site gamit ang "Import from .zip" button sa Playground dashboard panel:

1. Buksan ang Playground dashboard panel:

![Open Playground Dashboard](@site/static/img/dashboard/open-playground-dashboard.webp)

1. Gamitin ang "Import .zip" button sa dulo ng "Start a new Playground" section

![Open Playground Dashboard](@site/static/img/dashboard/import-playground.webp)

## Gamitin ang tiyak na bersyon ng WordPress o PHP

Ang pinakamabilis na paraan para baguhin ang bersyon ng WordPress o PHP ay sa settings panel sa [opisyal na demo site](https://playground.wordpress.net/):

![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp)

:::info Subukan ang iyong plugin o theme

Ang compatibility testing sa maraming bersyon ng WordPress at PHP ay palaging mahirap. Ginagawang madali ito ng WordPress Playground—gamitin ito!

:::

Maaari mo ring gamitin ang `wp` at `php` [query parameters](/developers/apis/query-api) para buksan ang Playground na may tamang bersyon na naka-load:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

Para matuto pa tungkol sa paghahanda ng content para sa mga demo, tingnan ang [gabay sa pagbibigay ng content para sa iyong demo](/guides/providing-content-for-your-demo).

:::info Major versions only

Maaari kang mag-specify ng major versions tulad ng `wp=6.2` o `php=8.1` at makukuha ang pinakabagong release sa linya na iyon. Hindi ka maaaring humiling ng mas lumang minor versions, kaya `wp=6.1.2` o `php=7.4.9` ay hindi gagana.

:::

## Mag-import ng WXR file

Maaari kang mag-import ng WordPress export file sa pamamagitan ng pag-upload ng WXR file sa [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

Maaari mo ring gamitin ang [JSON Blueprints](/blueprints). Tingnan ang [pagsisimula sa Blueprints](/blueprints/getting-started) para matuto pa.

Ito ay iba sa import feature na nakalagay sa itaas. Ang import feature ay nag-export ng buong site, kasama ang database. Ang import feature na ito ay nag-import ng WXR file sa isang existing site.

## Bumuo ng mga app gamit ang WordPress Playground

Ang WordPress Playground ay programmable, ibig sabihin ay maaari kang [bumuo ng WordPress apps](/developers/build-your-first-app), mag-setup ng plugin demos, at kahit gamitin ito bilang zero-setup [local development environment](/developers/local-development/).

Para matuto pa tungkol sa pag-develop gamit ang WordPress Playground, tingnan ang [development quick start](/developers/build-your-first-app) section.
