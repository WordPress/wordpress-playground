---
title: Gabay sa Mabilis na Pagsisimula
slug: /quick-start-guide
description: Isang 5-minuto na gabay para magsimula sa Playground. Matuto kung paano subukan ang mga plugin, subukan ang mga tema, at gumamit ng iba't ibang bersyon ng WP/PHP.
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# Magsimula gamit ang WordPress Playground sa loob ng 5 minuto

<!--
WordPress Playground can help you with any of the following:
-->

Maaaring makatulong sa iyo ang WordPress Playground sa alinman sa mga
sumusunod:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

Ang pahinang ito ang gagabay sa bawat hakbang. At para sa mga visual na
nag-aaral—narito ang isang video. Ang ilang detalye ng interface sa video ay
mas luma kaysa sa Dock; sundin ang nakasulat na mga hakbang sa ibaba para sa
kasalukuyang UI.

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## Magsimula ng bagong WordPress site

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

Buksan ang [opisyal na demo sa playground.wordpress.net](https://playground.wordpress.net/)
para simulan ang WordPress sa iyong browser.

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

Maaari kang gumawa ng mga pahina, mag-upload ng plugin, mag-install ng theme,
mag-import ng content, at gawin ang karamihan sa mga ginagawa mo sa regular na
WordPress site.

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

Kapag available ang browser storage, naka-autosave ang mga bagong Playground.
Makikita mo ang hanggang limang kamakailang autosave sa **Your Playgrounds**
mula sa Dock. Kung kailangan mo ng site na matatanggal kapag ni-refresh,
buksan ang Playground gamit ang `?storage=temp`.

<div class="callout callout-info">

<!--
**WordPress Playground is private**

The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

**Pribado ang WordPress Playground**

Lokal na tumatakbo ang Playground sa iyong browser. Hindi nito ina-upload ang
iyong site maliban kung pipili ka ng aksyon tulad ng **Export to GitHub**.
Kapag tapos ka na, maaari mong i-store nang permanente ang Playground,
i-export ito bilang ZIP, o magsimula muli mula sa **New Playground**.

</div>

<!--
## Try a block, a theme, or a plugin
-->

## Subukan ang isang block, theme, o plugin

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

Maaari kang mag-upload ng anumang plugin o theme sa
[/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Para makatipid ng ilang click, maaari kang mag-preinstall ng plugin o theme
mula sa WordPress plugin directory sa pamamagitan ng pagdagdag ng `plugin` o
`theme` parameter sa URL. Halimbawa, para i-install ang coblocks plugin,
maaari mong gamitin ang URL na ito:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

O ang URL na ito para i-preinstall ang `pendant` theme:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

Kung nais mong mag-install ng maraming theme at plugin, maaari mong ulitin ang
mga `theme` o `plugin` parameter:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

Maaari mo ring paghaluin ang mga parameter na ito at magdagdag pa ng maraming
plugin:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Ito ay tinatawag na [Query API](/developers/apis/query-api/), at maaari kang
matuto pa tungkol dito [dito](/developers/apis/query-api/).

<!--
## Store a Playground in browser storage
-->

## I-store ang Playground sa browser storage

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

I-click ang **Autosaved** o **Unsaved** status sa Dock para buksan ang
**Store permanently**, pagkatapos ay piliin ang **Save in browser storage**.

![Ang Store permanently pane na naka-select ang browser storage](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-browser.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

Lumilitaw ang naka-save na browser Playground sa **Your Playgrounds**. Naroon
din ang mga autosave, ngunit hanggang limang kamakailang autosave lang ang
iniingatan ng Playground. I-store nang permanente ang Playground kapag nais mo
itong panatilihin lampas sa autosave lifecycle.

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

Nasa browser pa rin ang browser storage. Mag-export ng ZIP kapag kailangan mo
ng file na maaari mong ilipat, i-archive, o i-restore sa ibang pagkakataon.

<!--
## Export a portable ZIP
-->

## Mag-export ng portable ZIP

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Buksan ang **Export** mula sa Dock at gamitin ang **Download as .zip**.

![Ang Export pane na may ZIP, setup link, at GitHub options](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

Kabilang sa na-export na file ang kasalukuyang mga file, database, plugin,
theme, upload, at edit. Maaari mo itong i-restore sa Playground o i-host sa
isang server na sumusuporta sa PHP at SQLite.

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

Kasama ang SQLite database file sa `wp-content/database/.ht.sqlite`. Nakatago
bilang default sa karamihan ng operating system ang mga file na nagsisimula sa
tuldok, kaya maaaring kailanganin mong i-enable ang hidden files sa iyong file
manager.

<!--
## Restore a ZIP
-->

## I-restore ang ZIP

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Buksan ang **New Playground** mula sa Dock, piliin ang **Import zip**, at
piliin ang ZIP file.

![Ang New Playground pane na naka-select ang Import zip](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

Ire-restore nito ang mga file at database mula sa ZIP sa isang bagong
Playground.

<!--
## Use a specific WordPress or PHP version
-->

## Gumamit ng tiyak na bersyon ng WordPress o PHP

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

Buksan ang **Site Settings** mula sa Dock para piliin ang WordPress, PHP, wika,
multisite, at networking options.

![Ang Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!--
**Test your plugin or theme**

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

**Subukan ang iyong plugin o theme**

Ang compatibility testing sa napakaraming bersyon ng WordPress at PHP ay
palaging mahirap. Ginagawang madali ito ng WordPress Playground—gamitin ito
sa iyong kalamangan!

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

Maaari mo ring gamitin ang `wp` at `php` [query parameters](/developers/apis/query-api)
para buksan ang Playground na may tamang bersyon na naka-load na:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Ito ay tinatawag na [Query API](/developers/apis/query-api/), at maaari kang
matuto pa tungkol dito [dito](/developers/apis/query-api/).

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

Gamitin ang `php=next` para i-preview ang susunod na bersyon ng PHP na binuo
mula sa php-src development branch. Halimbawa, tingnan ang [PHP 8.6 feature
preview](https://playground.wordpress.net/php-8-6.html).

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Para matuto pa tungkol sa paghahanda ng content para sa mga demo, tingnan ang
[gabay sa pagbibigay ng content para sa iyong demo](/guides/providing-content-for-your-demo).

<div class="callout callout-info">

<!--
**Major versions only**

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

**Major versions lang**

Maaari kang mag-specify ng major versions tulad ng `wp=6.2` o `php=8.1` at
asahan ang pinakabagong release sa linya na iyon. Hindi ka maaaring humiling
ng mas lumang minor versions, kaya hindi gagana ang `wp=6.1.2` o `php=7.4.9`.
Exception ang mga generic alias tulad ng `latest` at `next`.

</div>

<!--
## Import a WXR file
-->

## Mag-import ng WXR file

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

Maaari kang mag-import ng WordPress export file sa pamamagitan ng pag-upload
ng WXR file sa [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

Maaari mo ring gamitin ang [JSON Blueprints](/blueprints). Tingnan ang
[pagsisimula sa Blueprints](/blueprints/getting-started) para matuto pa.

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

Iba ito sa pag-restore ng Playground ZIP. Nag-i-import ang WXR file ng
WordPress content sa isang existing site. Ire-restore ng Playground ZIP ang
mga file at database sa isang bagong Playground.

<!--
## Build apps with WordPress Playground
-->

## Bumuo ng mga app gamit ang WordPress Playground

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

Programmable ang WordPress Playground, ibig sabihin ay maaari kang [bumuo ng
WordPress apps](/developers/build-your-first-app), mag-setup ng plugin demos,
at kahit gamitin ito bilang zero-setup
[local development environment](/developers/local-development/).

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

Para matuto pa tungkol sa pag-develop gamit ang WordPress Playground, tingnan
ang [development quick start](/developers/build-your-first-app) section.
