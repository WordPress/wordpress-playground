---
title: Gabay sa Mabilis na Pagsisimula
slug: /quick-start-guide
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

Maaari ka ring maghalo ng mga parameter at magdagdag ng maraming plugin:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

## I-save ang iyong site

Para hindi mawala ang iyong site pagkatapos ng single browser session, i-export ito bilang `.zip` file.

1. Buksan ang Site Manager panel:

![Site Manager](@site/static/img/open-site-manager.webp)

2. Gamitin ang button na "Download as .zip" sa additional actions menu:

![Export button](@site/static/img/site-manager-menu.webp)

Ang na-export na file ay naglalaman ng buong site na iyong binuo, kasama ang database (`wp-content/database/.ht.sqlite`). Tandaan na ang mga nak начин ng tuldok ay nakatago, kaya maaaring kailangan mong i-enable ang "Show hidden files."

## I-restore ang na-save na site

Maaari mong i-restore ang na-save na site gamit ang "Import from .zip" button sa site management panel:

![Import from .zip button](@site/static/img/site-manager-import-actions-menu.webp)

## Gamitin ang tiyak na bersyon ng WordPress o PHP

Ang pinakamabilis na paraan para baguhin ang bersyon ng WordPress o PHP ay sa settings panel sa [opisyal na demo site](https://playground.wordpress.net/):

![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp)

:::info Subukan ang iyong plugin o theme

Ang compatibility testing sa maraming bersyon ng WordPress at PHP ay palaging mahirap. Ginagawang madali ito ng WordPress Playground—gamitin ito!

:::

Maaari mo ring gamitin ang `wp` at `php` query parameters para buksan ang Playground na may tamang bersyon na naka-load:

-   https://playground.wordpress.net/?wp=6.5
-   https://playground.wordpress.net/?php=7.4
-   https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

:::info Major versions only

Maaari kang mag-specify ng major versions tulad ng `wp=6.2` o `php=8.1` at makukuha ang pinakabagong release sa linya na iyon. Hindi ka maaaring humiling ng mas lumang minor versions, kaya `wp=6.1.2` o `php=7.4.9` ay hindi gagana.

:::
