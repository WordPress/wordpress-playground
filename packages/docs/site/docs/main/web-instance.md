---
title: Web Instance
slug: /web-instance
description: A detailed guide to the web interface at playground.wordpress.net, covering the Dock, settings, and Playground tools.
---

# WordPress Playground web instance

[https://playground.wordpress.net/](https://playground.wordpress.net/) lets developers run WordPress in a browser without a server. This environment makes testing plugins, themes, and features quick and easy.

Some key features:

- **Browser-based**: No local server setup required.
- **Instant Setup**: Run WordPress with a single click.
- **Testing Environment**: Ideal for testing plugins and themes.

The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

The Playground website includes a Dock that opens tools for launching, configuring, inspecting, and exporting your Playground.

![Playground Dock](/img/dock/dock-overview.webp)

## Customize Playground

The Dock includes these destinations:

- **New**: Start from the Blueprint Gallery, a Blueprint URL, a GitHub repository, a pull request, or an imported `.zip` file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language, networking, and multisite.
- **Database**: Inspect the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Read PHP, WordPress, and Playground runtime messages.
- **Export**: Download a `.zip`, copy the original setup link, or export the current state to GitHub.

### Site Settings

![Site Settings in the Dock](/img/dock/dock-site-settings.webp)

The **Site Settings** pane includes these [Query API options](/developers/apis/query-api#available-options):

- `wp`: Defines the WordPress version.
- `php`: Specifies the PHP version for the instance.
- `language`: Sets the WordPress instance language.
- `multisite`: Enables WordPress multisite support.
- `networking`: Enables network access to the WordPress Plugin Directory and WordPress APIs.

## Export a Playground {#playground-options-menu}

Open **Export** from the Dock to download or share the current Playground state:

- **Download as .zip**: Saves files, database, and current edits to a `.zip` file that you can re-import later.
- **Copy original setup link**: Copies a URL that rebuilds the Playground from its original Blueprint. It does not include later edits.
- **Export to GitHub**: Pushes the current state, including edits, to a GitHub repository.

![Export options in the Dock](/img/dock/dock-export-playground.webp)

### Blueprint pane

![Blueprint pane in the Dock](/img/dock/dock-current-blueprint.webp)

The **Blueprint** pane lets you edit, export, and run the Blueprint for the current Playground.

### New Playground

![New Playground options in the Dock](/img/dock/dock-new-playground.webp)

The **New** pane shows all the ways to launch WordPress Playground: choose a Blueprint from the gallery, import `.zip` files, load from GitHub repositories, and preview PRs from WordPress core and Gutenberg.

The Blueprint Gallery lists more than 40 blueprints.

<div class="callout callout-warning">

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
