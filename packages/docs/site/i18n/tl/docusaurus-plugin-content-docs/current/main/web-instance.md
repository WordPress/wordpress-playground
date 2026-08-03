---
title: Web Instance
slug: /web-instance
description: Isang detalyadong gabay sa web interface ng playground.wordpress.net, kabilang ang Dock, storage, settings, at mga site tool.
---

# WordPress Playground web instance

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

Pinapatakbo ng [https://playground.wordpress.net/](https://playground.wordpress.net/)
ang WordPress sa browser mo nang walang server. Nagbubukas ang page ng Playground,
ipinapakita ang WordPress site, at inilalagay ang mga site tool sa **Dock**.

<!--
![The Playground web instance with the Dock visible at the bottom of the page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![Ang Playground web instance na may Dock sa ibaba ng page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

May address field, save status, layout controls, at mga destinasyon ang Dock para gumawa,
mag-store, magsuri, at mag-export ng mga Playground.

<!--
## Customize Playground
-->

## I-customize ang Playground

<!--
The Dock includes these destinations:
-->

Kasama sa Dock ang mga destinasyong ito:

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

- **New**: Magsimula sa Blueprint gallery, pampublikong Blueprint URL, bagong Blueprint,
  pull request preview, GitHub repository, o na-import na `.zip` file.
- **Playgrounds**: Lumipat sa mga recent at saved na Playground.
- **Blueprint**: Tingnan, i-edit, i-export, at patakbuhin ang kasalukuyang Blueprint.
- **Site Settings**: I-configure ang WordPress version, PHP version, language,
  networking, at multisite.
- **Database**: Suriin o i-download ang SQLite database at buksan ang database tools.
- **Files**: I-browse at i-edit ang mga file sa WordPress filesystem.
- **Logs**: Suriin ang mga PHP error, warning, at notice.
- **Export**: Mag-download ng `.zip`, kopyahin ang original setup link, o i-export ang
  mga napiling file sa isang GitHub pull request.

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

Gamitin ang address field ng Dock para magbukas ng path sa kasalukuyang WordPress site.
Halimbawa, ilagay ang `/wp-admin/` para buksan ang dashboard o
`/wp-admin/plugins.php` para buksan ang Plugins screen. Nire-reload ng **Refresh page**
ang kasalukuyang WordPress path.

<!--
![The Refresh page button in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)
-->

![Ang Refresh page button sa Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

Maaari mo ring gamitin ang [Query Params API](/developers/apis/query-api/) para buksan
ang Playground na may partikular na WordPress version, PHP version, plugin, theme, o
Blueprint.

<!--
## Understand the save status
-->

## Unawain ang save status

<!--
The status next to the address field tells you how the current Playground is stored:
-->

Ipinapakita ng status sa tabi ng address field kung paano naka-store ang kasalukuyang
Playground:

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- Ang **Autosaved** ay nangangahulugang naka-store ang Playground sa browser na ito at
  mare-recover mula sa **Your Playgrounds**. Nagpapanatili ang Playground ng hanggang
  limang recent autosave.
- Ang **Saved** ay nangangahulugang permanenteng naka-store ang Playground sa browser
  storage o naka-save sa isang local directory.
- Ang **Unsaved** ay nangangahulugang hindi naka-save ang Playground. Nawawala ang mga
  temporary Playground, kabilang ang `?storage=temp`, kapag isinara o ni-refresh ang tab.

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

I-click ang **Autosaved** o **Unsaved** para buksan ang **Store permanently**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Ang Store permanently pane na may pangalan ng Playground at ang Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

Maaaring panatilihin ng Store permanently ang isang autosaved Playground sa browser
storage para hindi ito maalis kapag na-prune ang mga autosave. Sa mga browser na
sumusuporta sa File System Access API, maaari rin itong i-save sa local directory.

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

Bahagi pa rin ng browser ang browser storage. Maaaring alisin ng browser ang naka-store
na data dahil sa storage pressure o privacy settings. Mag-export ng ZIP kapag kailangan
mo ng portable backup.

<!--
## Start a Playground
-->

## Magsimula ng Playground

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Buksan ang **New Playground** sa pamamagitan ng pag-click sa **New** sa Dock. Kasama sa
pane ang **Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, at **Import zip**.

<!--
![The New Playground pane with the Blueprint gallery selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![Ang New Playground pane na may napiling Blueprint gallery](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

Nagsisimula ang Blueprint gallery sa **Vanilla WordPress**, na gumagawa ng malinis na
WordPress install. Binubuksan ng **From a URL** ang pampublikong Blueprint URL.
Binubuksan ng **Write a Blueprint** ang editor para sa bagong Blueprint. Ibinabalik ng
**Import zip** ang ZIP na na-export mula sa Playground.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Ang New Playground pane na may napiling Import zip](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## Bumalik sa recent at saved na Playgrounds

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Buksan ang **Your Playgrounds** sa pamamagitan ng pag-click sa **Playgrounds** sa Dock.
Nakalista rito ang kasalukuyang Playground, mga recent autosave, at mga Playground na
permanente mong na-save.

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![Ang Your Playgrounds pane na may kasalukuyang Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

Mga recovery point ang autosaved na Playground. Nagpapanatili ang Playground ng hanggang
limang recent autosave. Gamitin ang **Store permanently** para panatilihin ang isa bilang
saved na Playground.

<!--
## Change site settings
-->

## Baguhin ang site settings

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

Buksan ang **Site Settings** para baguhin ang runtime at WordPress setup options.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Ang Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

Maaaring ilapat ang PHP version at networking sa kasalukuyang stored na Playground.
Binabago ng WordPress version, language, at multisite ang WordPress installation mismo,
kaya kailangan ng bagong Playground para sa mga ito.

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

Pinananatili ng pagpapatakbo ng na-edit na Blueprint ang stored at autosaved na
Playground. Inaalis nito ang temporary Playground dahil nagsisimula ang bagong run sa
malinis na setup.

<!--
## Inspect the current Blueprint
-->

## Suriin ang kasalukuyang Blueprint

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

Buksan ang **Blueprint** para tingnan at i-edit ang Blueprint ng kasalukuyang Playground.

<!--
![The Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![Ang Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

Maaaring patakbuhin ng editor ang na-edit na Blueprint sa bagong Playground. Para sa
stored o autosaved na Playground, mananatili ang orihinal sa **Your Playgrounds**.

<!--
## Inspect files, database, and logs
-->

## Suriin ang files, database, at logs

<!--
Open **Files** to browse and edit the current Playground files.
-->

Buksan ang **Files** para i-browse at i-edit ang mga file ng kasalukuyang Playground.

<!--
![The Files pane with a WordPress file selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![Ang Files pane na may napiling WordPress file](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

Buksan ang **Database** para gamitin ang database tools o i-download ang SQLite database.

<!--
![The Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![Ang Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

Buksan ang **Logs** para suriin ang mga PHP error, warning, at notice.

<!--
![The PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![Ang PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## Mag-export at mag-share {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

Buksan ang **Export** para i-download o i-share ang kasalukuyang Playground.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Ang Export pane na naka-highlight ang Download as .zip](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

Ini-export ng **Download as .zip** ang kasalukuyang files, database, plugins, themes,
uploads, at edits. Maaaring ibalik ang ZIP gamit ang **New → Import zip**.

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

Kinokopya ng **Copy original setup link** ang link na gumagawa lang muli sa orihinal na
setup. Hindi nito kasama ang edits matapos magsimula ang Playground.

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

Maaaring gumawa ang **Export to GitHub** ng pull request na may napiling files mula sa
kasalukuyang Playground.

<!--
## Change the Dock layout
-->

## Baguhin ang layout ng Dock

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

Maaaring ipakita ang Dock bilang floating panel o full-width bar. Gamitin ang
**Full width** para lumipat ng layout.

<!--
| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![The full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |
-->

| Floating                                                                                                                                                                 | Full width                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ![Ang default na floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![Ang full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

Gamitin ang **Hide tools** para i-collapse ang Dock sa address field at save status.
Gamitin ang **Show tools** para muling buksan ang tool row.

<!--
![The Playground with Dock tools hidden](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)
-->

![Ang Playground na nakatago ang mga tool ng Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

Maaari mong i-drag ang floating Dock sa desktop. I-drag ito lampas sa kaliwa o kanang
edge para i-fold sa corner launcher, at i-click ang launcher para ibalik ang Dock.

<!--
![The Dock folded into the corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)
-->

![Ang Dock na naka-fold sa corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

Sa makikitid na screen, gumagamit ang Dock ng full-width mobile layout.

<!--
![The Dock on a mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)
-->

![Ang Dock sa mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

Ang site sa https://playground.wordpress.net ay para suportahan ang komunidad, pero
walang garantiya na patuloy itong gagana kapag lumaki nang husto ang traffic.

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

Kung kailangan mo ng tiyak na availability, dapat mong
[i-host ang sarili mong WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
