---
title: Gabay sa Mabilis na Pagsisimula
slug: /quick-start-guide
description: Isang 5-minutong gabay para magsimula sa Playground. Matutong sumubok ng plugins at themes at gumamit ng iba't ibang WP/PHP version.
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# Magsimulang gumamit ng WordPress Playground sa loob ng 5 minuto

<!--
WordPress Playground can help you with any of the following:
-->

Matutulungan ka ng WordPress Playground sa alinman sa mga sumusunod:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

Gagabayan ka ng page na ito sa bawat isa. Kung mas gusto mong matuto sa video, narito
ang isa. Ang ilang detalye ng interface sa video ay nauna sa Dock; sundin ang mga
nakasulat na hakbang sa ibaba para sa kasalukuyang UI.

<!--
<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>
-->

<iframe width="752" height="423.2" title="Pagsisimula sa WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## Magsimula ng bagong WordPress site

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

Buksan ang [opisyal na demo sa playground.wordpress.net](https://playground.wordpress.net/) para patakbuhin ang WordPress sa browser mo.

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

Maaari kang gumawa ng pages, mag-upload ng plugins, mag-install ng themes, mag-import ng
content, at gawin ang karamihan ng mga gawain sa regular na WordPress site.

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

Kapag available ang browser storage, awtomatikong nase-save ang mga bagong Playground.
Makikita sa **Your Playgrounds** sa Dock ang hanggang limang recent autosave. Kung
kailangan mo ng site na nawawala kapag ni-refresh, buksan ang Playground gamit ang
`?storage=temp`.

<div class="callout callout-info">

<!--
**WordPress Playground is private**
-->

**Pribado ang WordPress Playground**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

Lokal na tumatakbo ang Playground sa browser mo. Hindi nito ina-upload ang site mo
maliban kung pumili ka ng action tulad ng **Export to GitHub**. Kapag tapos ka na,
maaari mong permanenteng i-store ang Playground, i-export ito bilang ZIP, o magsimulang
muli mula sa **New Playground**.

</div>

<!--
## Try a block, a theme, or a plugin
-->

## Sumubok ng block, theme, o plugin

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

Maaari kang mag-upload ng anumang plugin o theme sa [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Para mabawasan ang mga click, maaari kang mag-preinstall ng plugin o theme mula sa
WordPress directory sa pamamagitan ng pagdagdag ng `plugin` o `theme` parameter sa URL.
Halimbawa, para i-install ang coblocks plugin:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

O para i-preinstall ang `pendant` theme:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

Upang mag-install ng maraming theme at plugin, maaari mong ulitin ang `theme` o `plugin`
parameters:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

Maaari mo ring pagsamahin ang mga parameter at magdagdag ng maraming plugin:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Tinatawag itong [Query API](/developers/apis/query-api/). [Matuto pa tungkol dito](/developers/apis/query-api/).

<!--
## Store a Playground in browser storage
-->

## I-store ang Playground sa browser storage

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

I-click ang **Autosaved** o **Unsaved** status sa Dock para buksan ang
**Store permanently**, at piliin ang **Save in browser storage**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Ang Store permanently pane na may pangalan ng Playground at ang Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

Lumalabas sa **Your Playgrounds** ang Playground na na-save sa browser. Lumalabas din
doon ang autosaves, ngunit nagpapanatili ang Playground ng hanggang limang recent
autosave. I-store ang Playground nang permanente kung gusto mo itong panatilihin lampas
sa autosave lifecycle.

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

Bahagi pa rin ng browser ang browser storage. Mag-export ng ZIP kapag kailangan mo ng
file na maaaring ilipat, i-archive, o ibalik sa ibang pagkakataon.

<!--
## Export a portable ZIP
-->

## Mag-export ng portable ZIP

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Buksan ang **Export** sa Dock at gamitin ang **Download as .zip**.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Ang Export pane na naka-highlight ang Download as .zip](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

Kasama sa exported file ang kasalukuyang files, database, plugins, themes, uploads, at
edits. Maaari mo itong ibalik sa Playground o i-host sa server na sumusuporta sa PHP at
SQLite.

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

Kasama ang SQLite database file sa `wp-content/database/.ht.sqlite`. Nakatago bilang
default sa karamihan ng operating system ang files na nagsisimula sa tuldok, kaya
maaaring kailanganin mong ipakita ang hidden files sa file manager.

<!--
## Restore a ZIP
-->

## Mag-restore ng ZIP

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Buksan ang **New Playground** sa Dock, piliin ang **Import zip**, at piliin ang ZIP file.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Ang New Playground pane na may napiling Import zip](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

Ibinabalik nito ang files at database mula sa ZIP sa isang bagong Playground.

<!--
## Use a specific WordPress or PHP version
-->

## Gumamit ng partikular na WordPress o PHP version

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

Buksan ang **Site Settings** sa Dock para pumili ng WordPress, PHP, language, multisite,
at networking options.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Ang Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!--
**Test your plugin or theme**
-->

**Subukan ang iyong plugin o theme**

<!--
Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

Palaging mahirap ang compatibility testing sa maraming WordPress at PHP version.
Pinapadali ito ng WordPress Playground—gamitin ito sa iyong pakinabang.

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

Maaari mo ring gamitin ang `wp` at `php` [query parameters](/developers/apis/query-api)
para buksan ang Playground na naka-load na ang tamang versions:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

Tinatawag itong [Query API](/developers/apis/query-api/). [Matuto pa tungkol dito](/developers/apis/query-api/).

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

Gamitin ang `php=next` para i-preview ang susunod na PHP version na binuo mula sa
php-src development branch. Halimbawa, tingnan ang [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Para matuto pa tungkol sa paghahanda ng content para sa demos, tingnan ang
[gabay sa pagbibigay ng content para sa demo](/guides/providing-content-for-your-demo).

<div class="callout callout-info">

<!--
**Major versions only**
-->

**Major versions lang**

<!--
You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

Maaari kang magtakda ng major versions tulad ng `wp=6.2` o `php=8.1` at makuha ang
pinakabagong release sa linyang iyon. Hindi maaaring humiling ng lumang minor versions,
kaya hindi gagana ang `wp=6.1.2` o `php=7.4.9`. Exception ang generic aliases tulad ng
`latest` at `next`.

</div>

<!--
## Import a WXR file
-->

## Mag-import ng WXR file

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

Maaari kang mag-import ng WordPress export file sa pamamagitan ng pag-upload ng WXR file
sa [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

Maaari mo ring gamitin ang [JSON Blueprints](/blueprints). Tingnan ang
[pagsisimula sa Blueprints](/blueprints/getting-started) para matuto pa.

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

Iba ito sa pag-restore ng Playground ZIP. Nag-i-import ang WXR file ng WordPress content
sa kasalukuyang site. Ibinabalik ng Playground ZIP ang files at database sa bagong
Playground.

<!--
## Build apps with WordPress Playground
-->

## Bumuo ng apps gamit ang WordPress Playground

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

Programmable ang WordPress Playground, kaya maaari kang [bumuo ng WordPress apps](/developers/build-your-first-app), mag-set up ng plugin demos, at gamitin ito bilang zero-setup [local development environment](/developers/local-development/).

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

Para matuto pa tungkol sa development gamit ang WordPress Playground, tingnan ang
[development quick start](/developers/build-your-first-app).
