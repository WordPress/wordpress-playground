---
title: વેબ ઇન્સ્ટન્સ
slug: /web-instance
description: playground.wordpress.net ના વેબ ઇન્ટરફેસમાં Dock, સ્ટોરેજ, સેટિંગ્સ અને સાઇટ ટૂલ્સ માટેની વિગતવાર માર્ગદર્શિકા.
---

<!--
# WordPress Playground web instance
-->

# વર્ડપ્રેસ પ્લેગ્રાઉન્ડ વેબ ઇન્સ્ટન્સ

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) સર્વર વિના તમારા
બ્રાઉઝરમાં વર્ડપ્રેસ ચલાવે છે. પેજ Playground ખોલે છે, વર્ડપ્રેસ સાઇટ બતાવે છે અને
સાઇટના ટૂલ્સને **Dock** માં રાખે છે.

<!--
![The Playground web instance with the Dock visible at the bottom of the page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![પેજના તળિયે Dock સાથે Playground વેબ ઇન્સ્ટન્સ](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

Dock માં એડ્રેસ ફીલ્ડ, સેવ સ્ટેટસ, લેઆઉટ કંટ્રોલ્સ અને Playground બનાવવા, સંગ્રહવા,
તપાસવા અને એક્સપોર્ટ કરવા માટેના વિકલ્પો છે.

<!--
## Customize Playground
-->

## Playground ને કસ્ટમાઇઝ કરો

<!--
The Dock includes these destinations:
-->

Dock માં આ વિકલ્પો છે:

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

- **New**: Blueprint gallery, જાહેર Blueprint URL, નવું Blueprint, pull request
  preview, GitHub repository અથવા import કરેલી `.zip` ફાઇલથી શરૂ કરો.
- **Playgrounds**: તાજેતરના અને સાચવેલા Playground વચ્ચે બદલો.
- **Blueprint**: વર્તમાન Blueprint જુઓ, એડિટ કરો, એક્સપોર્ટ કરો અને ચલાવો.
- **Site Settings**: વર્ડપ્રેસ વર્ઝન, PHP વર્ઝન, ભાષા, networking અને multisite
  ગોઠવો.
- **Database**: SQLite database તપાસો અથવા ડાઉનલોડ કરો અને database tools ખોલો.
- **Files**: વર્ડપ્રેસ filesystem માં ફાઇલો browse અને edit કરો.
- **Logs**: PHP errors, warnings અને notices તપાસો.
- **Export**: `.zip` ડાઉનલોડ કરો, મૂળ setup link copy કરો અથવા પસંદ કરેલી files ને
  GitHub pull request માં export કરો.

<!--
## Navigate inside WordPress
-->

## વર્ડપ્રેસની અંદર નેવિગેટ કરો

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

વર્તમાન વર્ડપ્રેસ સાઇટમાં path ખોલવા Dock નું address field વાપરો. ઉદાહરણ તરીકે,
dashboard ખોલવા `/wp-admin/` અથવા Plugins screen ખોલવા `/wp-admin/plugins.php`
દાખલ કરો. **Refresh page** વર્તમાન વર્ડપ્રેસ path ફરી લોડ કરે છે.

<!--
![The Refresh page button in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)
-->

![Dock માં Refresh page બટન](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

નિર્ધારિત વર્ડપ્રેસ વર્ઝન, PHP વર્ઝન, plugin, theme અથવા Blueprint સાથે Playground
ખોલવા [Query Params API](/developers/apis/query-api/) પણ વાપરી શકો છો.

<!--
## Understand the save status
-->

## સેવ સ્ટેટસ સમજો

<!--
The status next to the address field tells you how the current Playground is stored:
-->

Address field ની બાજુનું status વર્તમાન Playground કેવી રીતે stored છે તે બતાવે છે:

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- **Autosaved** એટલે Playground આ browser માં stored છે અને **Your Playgrounds** માંથી
  પાછું મેળવી શકાય છે. Playground તાજેતરના પાંચ autosave સુધી રાખે છે.
- **Saved** એટલે Playground browser storage માં કાયમી રીતે stored છે અથવા local
  directory માં saved છે.
- **Unsaved** એટલે Playground saved નથી. `?storage=temp` સહિત temporary Playground
  tab બંધ કે refresh કરતાં ખોવાઈ જાય છે.

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

**Store permanently** ખોલવા **Autosaved** અથવા **Unsaved** પર click કરો.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Playground નામ અને Save બટન સાથે Store permanently pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

Store permanently autosaved Playground ને browser storage માં કાયમી રીતે રાખે છે,
જેથી નવા autosave જૂનાને દૂર કરે ત્યારે તે ન ખોવાય. File System Access API support
કરતા browser માં Playground ને local directory માં પણ save કરી શકાય છે.

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

Browser storage browser સાથે જ જોડાયેલું છે. Storage pressure અથવા privacy settings
કારણે browser stored data દૂર કરી શકે છે. Portable backup માટે ZIP export કરો.

<!--
## Start a Playground
-->

## Playground શરૂ કરો

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Dock માં **New** પર click કરીને **New Playground** ખોલો. Pane માં
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub** અને **Import zip** છે.

<!--
![The New Playground pane with the Blueprint gallery selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![Blueprint gallery પસંદ કરેલું New Playground pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

Blueprint gallery ની શરૂઆતમાં **Vanilla WordPress** છે, જે સ્વચ્છ વર્ડપ્રેસ install
બનાવે છે. **From a URL** જાહેર Blueprint URL ખોલે છે. **Write a Blueprint** નવા
Blueprint માટે editor ખોલે છે. **Import zip** Playground માંથી export કરેલી ZIP
restore કરે છે.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Import zip પસંદ કરેલું New Playground pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## તાજેતરના અને સાચવેલા Playground પર પાછા જાઓ

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Dock માં **Playgrounds** પર click કરીને **Your Playgrounds** ખોલો. તેમાં વર્તમાન
Playground, તાજેતરના autosave અને કાયમી રીતે saved Playground સૂચિબદ્ધ છે.

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![વર્તમાન Playground સાથે Your Playgrounds pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

Autosaved Playground recovery points છે. Playground તાજેતરના પાંચ autosave સુધી રાખે
છે. કોઈને saved Playground તરીકે રાખવા **Store permanently** વાપરો.

<!--
## Change site settings
-->

## Site settings બદલો

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

Runtime અને વર્ડપ્રેસ setup options બદલવા **Site Settings** ખોલો.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

PHP version અને networking વર્તમાન stored Playground પર લાગુ કરી શકાય છે. WordPress
version, language અને multisite વર્ડપ્રેસ installation ને જ બદલે છે, તેથી તેના માટે
નવું Playground જરૂરી છે.

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

Edited Blueprint ચલાવવાથી stored અને autosaved Playground જળવાય છે. નવો run fresh
setup થી શરૂ થતો હોવાથી temporary Playground દૂર થાય છે.

<!--
## Inspect the current Blueprint
-->

## વર્તમાન Blueprint તપાસો

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

વર્તમાન Playground માટે Blueprint જોવા અને edit કરવા **Blueprint** ખોલો.

<!--
![The Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

Editor edited Blueprint ને નવા Playground માં ચલાવી શકે છે. Stored અથવા autosaved
Playground માટે મૂળ Playground **Your Playgrounds** માં રહે છે.

<!--
## Inspect files, database, and logs
-->

## Files, database અને logs તપાસો

<!--
Open **Files** to browse and edit the current Playground files.
-->

વર્તમાન Playground files browse અને edit કરવા **Files** ખોલો.

<!--
![The Files pane with a WordPress file selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![વર્ડપ્રેસ file પસંદ કરેલું Files pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

Database tools વાપરવા અથવા SQLite database download કરવા **Database** ખોલો.

<!--
![The Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

PHP errors, warnings અને notices જોવા **Logs** ખોલો.

<!--
![The PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## Export અને share કરો {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

વર્તમાન Playground download અથવા share કરવા **Export** ખોલો.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Download as .zip હાઇલાઇટ કરેલું Export pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

**Download as .zip** વર્તમાન files, database, plugins, themes, uploads અને edits export
કરે છે. ZIP ને પછી **New → Import zip** વડે restore કરી શકાય છે.

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

**Copy original setup link** માત્ર મૂળ setup ફરી બનાવતી link copy કરે છે. Playground
શરૂ થયા પછી કરેલા edits તેમાં સામેલ નથી.

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

**Export to GitHub** વર્તમાન Playground માંથી પસંદ કરેલી files સાથે pull request બનાવી
શકે છે.

<!--
## Change the Dock layout
-->

## Dock layout બદલો

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

Dock floating panel અથવા full-width bar તરીકે બતાવી શકાય છે. Layout બદલવા
**Full width** વાપરો.

<!--
| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![The full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |
-->

| Floating                                                                                                                                                          | Full width                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![Full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

Dock ને માત્ર address field અને save status સુધી collapse કરવા **Hide tools** વાપરો.
Tool row ફરી ખોલવા **Show tools** વાપરો.

<!--
![The Playground with Dock tools hidden](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)
-->

![Tools છુપાવેલા Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

Desktop પર floating Dock drag કરી શકાય છે. તેને ડાબી કે જમણી edge ની બહાર drag કરીને
corner launcher માં fold કરો, પછી Dock restore કરવા launcher પર click કરો.

<!--
![The Dock folded into the corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)
-->

![Corner launcher માં fold કરેલું Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

Narrow screen પર Dock full-width mobile layout વાપરે છે.

<!--
![The Dock on a mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)
-->

![Mobile viewport પર Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

https://playground.wordpress.net પરની સાઇટ સમુદાયને સમર્થન આપવા માટે છે, પરંતુ traffic
નોંધપાત્ર રીતે વધે તો તે કામ કરવાનું ચાલુ રાખશે તેની કોઈ ગેરંટી નથી.

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

જો તમને ચોક્કસ ઉપલબ્ધતા જોઈએ, તો [તમારું પોતાનું વર્ડપ્રેસ Playground host કરો](/developers/architecture/host-your-own-playground).

</div>
