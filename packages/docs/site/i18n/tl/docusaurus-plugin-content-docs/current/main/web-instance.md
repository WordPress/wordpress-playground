---
title: Web Instance
slug: /web-instance
description: Isang detalyadong gabay sa web interface sa playground.wordpress.net, na sumasaklaw sa Dock, persistence, settings, at mga tool ng site.
---

<!--
# WordPress Playground web instance
-->

# WordPress Playground web instance

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

Ang [https://playground.wordpress.net/](https://playground.wordpress.net/) ay
nagpapatakbo ng WordPress sa iyong browser nang walang server. Binubuksan ng
pahina ang isang Playground, ipinapakita ang WordPress site, at inilalagay ang
mga tool ng site sa **Dock**.

![Ang Playground web instance na may nakikitang Dock sa ibaba ng pahina](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

May address field, save status, layout controls, at mga destination ang Dock
para sa paglikha, pag-imbak, pagsusuri, at pag-export ng mga Playground.

<!--
## Customize Playground
-->

## I-customize ang Playground

<!--
The Dock includes these destinations:
-->

Kabilang sa Dock ang mga destination na ito:

<!--
- **New**: Start from the Blueprint gallery, a public Blueprint URL, a new
  Blueprint, a pull request preview, a GitHub repository, or an imported `.zip`
  file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language,
  networking, and multisite.
- **Database**: Inspect or download the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Inspect PHP errors, warnings, and notices.
- **Export**: Download a `.zip`, copy the original setup link, or export selected
  files to a GitHub pull request.
-->

- **New**: Magsimula mula sa Blueprint gallery, isang public Blueprint URL,
  isang bagong Blueprint, isang pull request preview, isang GitHub repository,
  o isang naka-import na `.zip` file.
- **Playgrounds**: Lumipat sa pagitan ng mga kamakailan at naka-save na
  Playground.
- **Blueprint**: Tingnan, i-edit, i-export, at patakbuhin ang kasalukuyang
  Blueprint.
- **Site Settings**: I-configure ang bersyon ng WordPress, bersyon ng PHP,
  wika, networking, at multisite.
- **Database**: Suriin o i-download ang SQLite database at buksan ang mga
  database tool.
- **Files**: Mag-browse at mag-edit ng mga file sa WordPress filesystem.
- **Logs**: Suriin ang mga PHP error, warning, at notice.
- **Export**: Mag-download ng `.zip`, kopyahin ang orihinal na setup link, o
  i-export ang mga napiling file sa isang GitHub pull request.

<!--
## Navigate inside WordPress
-->

## Mag-navigate sa loob ng WordPress

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

Gamitin ang address field ng Dock para magbukas ng path sa loob ng kasalukuyang
WordPress site. Halimbawa, i-type ang `/wp-admin/` para buksan ang dashboard o
`/wp-admin/plugins.php` para buksan ang Plugins screen. Ang **Refresh page** ay
nagre-reload ng kasalukuyang WordPress path.

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

Maaari mo ring gamitin ang [Query Params API](/developers/apis/query-api/) para
buksan ang Playground na may partikular na setup, tulad ng bersyon ng
WordPress, bersyon ng PHP, plugin, theme, o Blueprint.

<!--
## Understand the save status
-->

## Unawain ang save status

<!--
The status next to the address field tells you how the current Playground is stored:
-->

Ang status sa tabi ng address field ay nagsasabi kung paano naka-imbak ang
kasalukuyang Playground:

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- Nangangahulugan ang **Autosaved** na naka-imbak ang Playground sa browser na
  ito at maaaring mabawi mula sa **Your Playgrounds**. Hanggang limang
  kamakailang autosave ang iniingatan ng Playground.
- Nangangahulugan ang **Saved** na permanente nang naka-imbak ang Playground sa
  browser storage o na-save sa isang lokal na directory.
- Nangangahulugan ang **Unsaved** na hindi pa na-save ang Playground. Ang mga
  pansamantalang Playground, kabilang ang `?storage=temp`, ay mawawala kapag
  isinara o ni-refresh ang tab.

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

I-click ang **Autosaved** o **Unsaved** para buksan ang **Store permanently**.

![Ang Store permanently pane na naka-select ang browser storage](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-browser.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

Maaaring panatilihin ng Store permanently ang isang naka-autosave na Playground
sa browser storage para hindi na ito alisin ng autosave pruning. Sa mga browser
na sumusuporta sa File System Access API, maaari rin nitong i-save ang
Playground sa isang lokal na directory.

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

Nasa browser pa rin ang browser storage. Maaaring tanggalin ng browser ang
naka-imbak na data kapag kinakailangan ito dahil sa kakulangan sa storage o
privacy settings. Mag-export ng ZIP kapag kailangan mo ng portable backup.

<!--
## Start a Playground
-->

## Magsimula ng Playground

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Buksan ang **New Playground** mula sa Dock sa pamamagitan ng pag-click sa
**New**. Kabilang sa pane ang **Blueprint gallery**, **From a URL**,
**Write a Blueprint**, **Preview a PR**, **From GitHub**, at **Import zip**.

![Ang New Playground pane na naka-select ang Blueprint gallery](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

Nagsisimula ang Blueprint gallery sa **Vanilla WordPress**, na gumagawa ng
malinis na WordPress install. Binubuksan ng **From a URL** ang isang public
Blueprint URL. Binubuksan ng **Write a Blueprint** ang editor para sa bagong
Blueprint. Ibinabalik ng **Import zip** ang ZIP na na-export mula sa Playground.

![Ang New Playground pane na naka-select ang Import zip](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## Bumalik sa mga kamakailan at naka-save na Playground

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Buksan ang **Your Playgrounds** mula sa Dock sa pamamagitan ng pag-click sa
**Playgrounds**. Nililista nito ang kasalukuyang Playground, mga kamakailang
autosave, at mga Playground na permanente mong na-save.

![Ang Your Playgrounds pane na may kasalukuyang Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

Ang mga naka-autosave na Playground ay punto ng pagbawi. Hanggang limang
kamakailang autosave ang iniingatan ng Playground. Gamitin ang
**Store permanently** para panatilihin ang isa bilang naka-save na Playground.

<!--
## Change site settings
-->

## Baguhin ang site settings

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

Buksan ang **Site Settings** para baguhin ang runtime at WordPress setup
options.

![Ang Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

Maaaring ilapat ang bersyon ng PHP at networking sa umiiral nang naka-imbak na
Playground. Binabago ng bersyon ng WordPress, wika, at multisite ang mismong
WordPress installation, kaya kailangan nila ng bagong Playground.

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

Pinapanatili ng pagpapatakbo ng na-edit na Blueprint ang mga naka-imbak at
naka-autosave na Playground. Itinatapon nito ang pansamantalang Playground
dahil nagsisimula ang bagong run mula sa bagong setup.

<!--
## Inspect the current Blueprint
-->

## Suriin ang kasalukuyang Blueprint

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

Buksan ang **Blueprint** para tingnan at i-edit ang Blueprint ng kasalukuyang
Playground.

![Ang Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

Maaaring patakbuhin ng editor ang na-edit na Blueprint sa isang bagong
Playground. Para sa naka-imbak o naka-autosave na Playground, nananatiling
available ang orihinal na Playground sa **Your Playgrounds**.

<!--
## Inspect files, database, and logs
-->

## Suriin ang mga file, database, at log

<!--
Open **Files** to browse and edit the current Playground files.
-->

Buksan ang **Files** para mag-browse at mag-edit ng mga file ng kasalukuyang
Playground.

![Ang Files pane na may naka-select na WordPress file](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

Buksan ang **Database** para gumamit ng mga database tool o mag-download ng
SQLite database.

![Ang Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

Buksan ang **Logs** para suriin ang mga PHP error, warning, at notice.

![Ang PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## I-export at ibahagi {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

Buksan ang **Export** para i-download o ibahagi ang kasalukuyang Playground.

![Ang Export pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

Ini-export ng **Download as .zip** ang kasalukuyang mga file, database, plugin,
theme, upload, at edit. Maaaring i-restore ang ZIP sa ibang pagkakataon gamit
ang **New → Import zip**.

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

Kinokopya ng **Copy original setup link** ang isang link na muling gumagawa
lamang ng orihinal na setup. Hindi kasama rito ang mga edit na ginawa pagkatapos
magsimula ang Playground.

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

Maaaring gumawa ang **Export to GitHub** ng pull request na may mga napiling
file mula sa kasalukuyang Playground.

<!--
## Change the Dock layout
-->

## Baguhin ang layout ng Dock

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

Maaaring ipakita ang Dock bilang floating panel o full-width bar. Gamitin ang
**Full width** para palitan ang layout.

| Floating                                                                                                                                                                 | Full width                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ![Ang default na floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![Ang full-width na layout ng Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

Gamitin ang **Hide tools** para i-collapse ang Dock sa address field at save
status nito. Gamitin ang **Show tools** para muling buksan ang tool row.

![Ang Playground na nakatago ang mga tool ng Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

Maaari mong i-drag ang floating Dock sa desktop. I-drag ito lampas sa kaliwa o
kanang gilid para i-fold ito sa isang corner launcher, pagkatapos ay i-click
ang launcher para ibalik ang Dock.

![Ang Dock na naka-fold sa corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

Sa makitid na screen, gumagamit ang Dock ng full-width na mobile layout.

![Ang Dock sa isang mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<!--
<div class="callout callout-warning">

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
-->

<div class="callout callout-warning">

Ang site sa https://playground.wordpress.net ay para suportahan ang komunidad,
ngunit walang garantiya na ito ay patuloy na gagana kung ang traffic ay lumaki
nang malaki.

Kung kailangan mo ng tiyak na availability, dapat mong [i-host ang sarili mong
WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
