---
title: ઝડપી પ્રારંભ માર્ગદર્શિકા
slug: /quick-start-guide
description: Playground શરૂ કરવા માટે 5 મિનિટની માર્ગદર્શિકા. Plugins ચકાસવા, themes અજમાવવા અને વિવિધ WP/PHP versions વાપરવાનું શીખો.
---

<!--
# Start using WordPress Playground in 5 minutes
-->

# 5 મિનિટમાં વર્ડપ્રેસ Playground વાપરવાનું શરૂ કરો

<!--
WordPress Playground can help you with any of the following:
-->

વર્ડપ્રેસ Playground તમને નીચેના પૈકી કોઈપણ કાર્યમાં મદદ કરી શકે છે:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.
-->

આ page દરેક વિષયમાં તમને માર્ગદર્શન આપશે. જો તમે જોઈને શીખવાનું પસંદ કરો છો, તો અહીં
એક video છે. Video માં interface ની કેટલીક વિગતો Dock પહેલાંની છે; વર્તમાન UI માટે
નીચેના લેખિત steps અનુસરો.

<!--
<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>
-->

<iframe width="752" height="423.2" title="વર્ડપ્રેસ Playground સાથે શરૂઆત" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
-->

## નવી વર્ડપ્રેસ site શરૂ કરો

<!--
Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.
-->

તમારા browser માં વર્ડપ્રેસ શરૂ કરવા [playground.wordpress.net પર official demo](https://playground.wordpress.net/) ખોલો.

<!--
You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.
-->

તમે pages બનાવી, plugins upload કરી, themes install કરી, content import કરી અને સામાન્ય
વર્ડપ્રેસ site પર કરતા મોટાભાગના કાર્યો કરી શકો છો.

<!--
When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.
-->

Browser storage ઉપલબ્ધ હોય ત્યારે નવા Playground autosave થાય છે. Dock માં
**Your Playgrounds** હેઠળ તાજેતરના પાંચ autosave સુધી મળી શકે છે. Refresh કરતાં દૂર
થતી site જોઈએ તો `?storage=temp` સાથે Playground ખોલો.

<div class="callout callout-info">

<!--
**WordPress Playground is private**
-->

**વર્ડપ્રેસ Playground ખાનગી છે**

<!--
The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.
-->

Playground તમારા browser માં locally ચાલે છે. **Export to GitHub** જેવી action પસંદ ન
કરો ત્યાં સુધી તે તમારી site upload કરતું નથી. કામ પૂરુ થયા પછી Playground કાયમી રીતે
store કરો, ZIP તરીકે export કરો અથવા **New Playground** થી ફરી શરૂ કરો.

</div>

<!--
## Try a block, a theme, or a plugin
-->

## Block, theme અથવા plugin અજમાવો

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

તમે [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/) માં કોઈપણ plugin અથવા theme upload કરી શકો છો.

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

થોડા clicks બચાવવા URL માં `plugin` અથવા `theme` parameter ઉમેરીને વર્ડપ્રેસ directory
માંથી plugin અથવા theme preinstall કરી શકો છો. ઉદાહરણ તરીકે coblocks plugin માટે:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

અથવા `pendant` theme preinstall કરવા:

https://playground.wordpress.net/?theme=pendant

<!--
In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:
-->

ઘણા themes અને plugins install કરવા `theme` અથવા `plugin` parameters ફરી આપી શકો છો:

https://playground.wordpress.net/?theme=pendant&theme=acai

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

આ parameters ભેગા કરીને ઘણા plugins પણ ઉમેરી શકો છો:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

આને [Query API](/developers/apis/query-api/) કહે છે. [તે વિશે વધુ જાણો](/developers/apis/query-api/).

<!--
## Store a Playground in browser storage
-->

## Browser storage માં Playground store કરો

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.
-->

**Store permanently** ખોલવા Dock માં **Autosaved** અથવા **Unsaved** status પર click
કરો, પછી **Save in browser storage** પસંદ કરો.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Playground નામ અને Save બટન સાથે Store permanently pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.
-->

Browser માં saved Playground **Your Playgrounds** માં દેખાય છે. Autosave પણ ત્યાં
દેખાય છે, પરંતુ Playground તાજેતરના પાંચ autosave સુધી રાખે છે. Autosave lifecycle પછી
પણ Playground રાખવું હોય તો તેને કાયમી રીતે store કરો.

<!--
Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.
-->

Browser storage browser નું જ છે. ખસેડી, archive કરી અથવા પછી restore કરી શકાય એવી
file જોઈએ તો ZIP export કરો.

<!--
## Export a portable ZIP
-->

## Portable ZIP export કરો

<!--
Open **Export** from the Dock and use **Download as .zip**.
-->

Dock માંથી **Export** ખોલીને **Download as .zip** વાપરો.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Download as .zip હાઇલાઇટ કરેલું Export pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.
-->

Export કરેલી file માં વર્તમાન files, database, plugins, themes, uploads અને edits હોય
છે. તમે તેને Playground માં restore કરી શકો અથવા PHP અને SQLite support કરતા server
પર host કરી શકો છો.

<!--
The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.
-->

SQLite database file `wp-content/database/.ht.sqlite` માં હોય છે. Dot થી શરૂ થતી files
મોટાભાગની operating system માં default રીતે hidden હોય છે, તેથી file manager માં hidden
files બતાવવાનો option ચાલુ કરવો પડી શકે છે.

<!--
## Restore a ZIP
-->

## ZIP restore કરો

<!--
Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.
-->

Dock માંથી **New Playground** ખોલો, **Import zip** પસંદ કરો અને ZIP file પસંદ કરો.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Import zip પસંદ કરેલું New Playground pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
This restores the files and database from the ZIP into a new Playground.
-->

આ ZIP ની files અને database ને નવા Playground માં restore કરે છે.

<!--
## Use a specific WordPress or PHP version
-->

## ચોક્કસ વર્ડપ્રેસ અથવા PHP version વાપરો

<!--
Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.
-->

વર્ડપ્રેસ, PHP, language, multisite અને networking options પસંદ કરવા Dock માંથી
**Site Settings** ખોલો.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

<!--
**Test your plugin or theme**
-->

**તમારું plugin અથવા theme ચકાસો**

<!--
Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!
-->

ઘણા વર્ડપ્રેસ અને PHP versions સાથે compatibility test કરવું હંમેશા મુશ્કેલ હતું.
વર્ડપ્રેસ Playground આ પ્રક્રિયાને સરળ બનાવે છે—તેનો લાભ લો.

</div>

<!--
You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:
-->

યોગ્ય versions પહેલેથી loaded હોય તેવું Playground ખોલવા `wp` અને `php`
[query parameters](/developers/apis/query-api) વાપરી શકો છો:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

<!--
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).
-->

આને [Query API](/developers/apis/query-api/) કહે છે. [તે વિશે વધુ જાણો](/developers/apis/query-api/).

<!--
Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).
-->

php-src development branch માંથી બનેલું આગામી PHP version preview કરવા `php=next`
વાપરો. ઉદાહરણ તરીકે [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html) જુઓ.

<!--
To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).
-->

Demo માટે content તૈયાર કરવા વિશે વધુ જાણવા [demo content guide](/guides/providing-content-for-your-demo) જુઓ.

<div class="callout callout-info">

<!--
**Major versions only**
-->

**માત્ર major versions**

<!--
You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.
-->

તમે `wp=6.2` અથવા `php=8.1` જેવા major versions આપી તે line ની સૌથી તાજેતરની release
મેળવી શકો છો. જૂના minor versions માગી શકાતા નથી, તેથી `wp=6.1.2` અથવા `php=7.4.9`
કામ કરશે નહીં. `latest` અને `next` જેવા generic alias તેના અપવાદ છે.

</div>

<!--
## Import a WXR file
-->

## WXR file import કરો

<!--
You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).
-->

[/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php) માં WXR file upload કરીને વર્ડપ્રેસ export file import કરી શકો છો.

<!--
You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.
-->

[JSON Blueprints](/blueprints) પણ વાપરી શકો છો. વધુ જાણવા [Blueprints સાથે શરૂઆત](/blueprints/getting-started) જુઓ.

<!--
This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.
-->

આ Playground ZIP restore કરવાથી અલગ છે. WXR file હાલની site માં વર્ડપ્રેસ content
import કરે છે. Playground ZIP નવી Playground માં files અને database restore કરે છે.

<!--
## Build apps with WordPress Playground
-->

## વર્ડપ્રેસ Playground સાથે apps બનાવો

<!--
WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).
-->

વર્ડપ્રેસ Playground programmable છે, એટલે તમે [વર્ડપ્રેસ apps બનાવી](/developers/build-your-first-app), plugin demos setup કરી અને zero-setup [local development environment](/developers/local-development/) તરીકે પણ તેનો ઉપયોગ કરી શકો છો.

<!--
To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
-->

વર્ડપ્રેસ Playground સાથે development વિશે વધુ જાણવા [development quick start](/developers/build-your-first-app) જુઓ.
