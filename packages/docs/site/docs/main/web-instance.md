---
title: Web Instance
slug: /web-instance
description: A detailed guide to the web interface at playground.wordpress.net, covering the Dock, persistence, settings, and site tools.
---

# WordPress Playground web instance

[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.

![The Playground web instance with the Dock visible at the bottom of the page](/img/dock/dock-overview.webp)

The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.

## Customize Playground

The Dock includes these destinations:

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

## Navigate inside WordPress

Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.

You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.

## Understand the save status

The status next to the address field tells you how the current Playground is stored:

- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.

Click **Autosaved** or **Unsaved** to open **Store permanently**.

![The Store permanently pane with browser storage selected](/img/dock/store-permanently-browser.webp)

Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.

Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.

## Start a Playground

Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.

![The New Playground pane with the Blueprint gallery selected](/img/dock/dock-new-playground.webp)

The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.

![The New Playground pane with Import zip selected](/img/dock/dock-new-playground-import-zip.webp)

## Return to recent and saved Playgrounds

Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.

![The Your Playgrounds pane with the current Playground](/img/dock/your-playgrounds.webp)

Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.

## Change site settings

Open **Site Settings** to change runtime and WordPress setup options.

![The Site Settings pane](/img/dock/dock-site-settings.webp)

PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.

Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.

## Inspect the current Blueprint

Open **Blueprint** to view and edit the Blueprint for the current Playground.

![The Blueprint editor pane](/img/dock/dock-current-blueprint.webp)

The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.

## Inspect files, database, and logs

Open **Files** to browse and edit the current Playground files.

![The Files pane with a WordPress file selected](/img/dock/files.webp)

Open **Database** to use database tools or download the SQLite database.

![The Database pane](/img/dock/database.webp)

Open **Logs** to inspect PHP errors, warnings, and notices.

![The PHP error log pane](/img/dock/logs.webp)

## Export and share {#playground-options-menu}

Open **Export** to download or share the current Playground.

![The Export pane](/img/dock/dock-export-playground.webp)

**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.

**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.

**Export to GitHub** can create a pull request with selected files from the current Playground.

## Change the Dock layout

The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.

| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](/img/dock/dock-overview.webp) | ![The full-width Dock layout](/img/dock/dock-full-width.webp) |

Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.

![The Playground with Dock tools hidden](/img/dock/dock-hidden-tools.webp)

You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.

![The Dock folded into the corner launcher](/img/dock/dock-corner-launcher.webp)

On narrow screens, the Dock uses a full-width mobile layout.

![The Dock on a mobile viewport](/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
