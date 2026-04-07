---
title: Web Instance
slug: /web-instance
description: Isang detalyadong gabay sa web interface sa playground.wordpress.net, na sumasaklaw sa toolbar, settings, at instance manager.
---

<!--
# WordPress Playground web instance {#wordpress-playground-web-instance}
-->

# WordPress Playground web instance {#wordpress-playground-web-instance}

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) lets developers run WordPress in a browser without a server. This environment makes testing plugins, themes, and features quick and easy.
-->

Ang [https://playground.wordpress.net/](https://playground.wordpress.net/) ay nagbibigay-daan sa mga developer na patakbuhin ang WordPress sa browser nang walang server. Ang environment na ito ay nagpapadali at nagpapabilis sa pagsubok ng plugins, themes, at features.

<!--
Some key features:

- **Browser-based**: No local server setup required.
- **Instant Setup**: Run WordPress with a single click.
- **Testing Environment**: Ideal for testing plugins and themes.
-->

Ilang pangunahing tampok:

- **Browser-based**: Hindi kailangan ng lokal na server setup.
- **Instant Setup**: Patakbuhin ang WordPress sa isang click lang.
- **Testing Environment**: Perpekto para sa pagsubok ng plugins at themes.

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

Ang [Query Params API](/developers/apis/query-api/) ay nagbibigay-daan sa iyo na direktang mag-load ng mga partikular na configuration sa isang Playground instance. Kasama dito ang pagtatakda ng partikular na bersyon ng WordPress, theme, o plugin. Maaari ka ring magtakda ng mas kumplikadong setup gamit ang blueprints (tingnan ang [mga halimbawa dito](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

<!--
The Playground website includes toolbars that customize your instance and provide quick access to resources and utilities.
-->

Ang Playground website ay may kasamang mga toolbar na nagpapasadya sa iyong instance at nagbibigay ng mabilis na access sa mga resources at utilities.

![Playground Toolbar Snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-toolbar.webp)

<!--
## Customize Playground {#customize-playground}
-->

## I-customize ang Playground {#customize-playground}

<!--
On the toolbar, you'll find:

- **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
- **Playground Dashboard**: This panel lets you manage WordPress Playground instances, save and export them, edit files from your WordPress instance, and create new Blueprints.
- **Playground Launch Panel**: The Launch Panel shows all the ways to launch a WordPress Playground instance.
-->

Sa toolbar, makikita mo ang:

- **Playground Settings**: Isang panel para sa pag-configure ng iyong kasalukuyang instance, tulad ng PHP at WordPress versions.
- **Playground Dashboard**: Ang panel na ito ay nagbibigay-daan sa iyo na pamahalaan ang mga WordPress Playground instance, i-save at i-export sila, mag-edit ng mga file mula sa iyong WordPress instance, at lumikha ng mga bagong Blueprint.
- **Playground Launch Panel**: Ang Launch Panel ay nagpapakita ng lahat ng paraan para maglunsad ng WordPress Playground instance.

<!--
### Playground Settings {#playground-settings}
-->

### Playground Settings {#playground-settings}

![snapshot of customize Playground window at Playground instance](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-settings-panel.webp)

<!--
The **Playground Settings Panel** includes these [Query API options](/developers/apis/query-api#available-options):

- `wp`: Defines the WordPress version.
- `php`: Specifies the PHP version for the instance.
- `language`: Sets the WordPress instance language.
- `multisite`: Enables WordPress multisite support.
- `networking`: Enables network access to the WordPress Plugin Directory and WordPress APIs.
-->

Ang **Playground Settings Panel** ay may kasamang mga [Query API options](/developers/apis/query-api#available-options) na ito:

- `wp`: Tinutukoy ang bersyon ng WordPress.
- `php`: Tinutukoy ang bersyon ng PHP para sa instance.
- `language`: Itinatakda ang wika ng WordPress instance.
- `multisite`: Pinapagana ang WordPress multisite support.
- `networking`: Pinapagana ang network access sa WordPress Plugin Directory at WordPress APIs.

<!--
## Playground Manager {#playground-manager}
-->

## Playground Manager {#playground-manager}

![Playground settings panel allow users to save export and edit the WordPress directly](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard.webp)

<!--
This panel lets you manage Playground instances and provides access to the following panels:

- **Settings**: To manage the current Playground's settings
- **File Browser**: Built-in IDE for editing files, uploading plugins and themes, and live editing. Playground auto-reloads changes in real time.
- **Blueprint**: A Blueprint editor for creating, saving, and running Blueprints in your Playground web instance.
- **Database**: Tools for managing the database with Adminer and phpMyAdmin, and downloading as a `.sqlite` file.
- **Logs**: Displays log messages when something goes wrong.
-->

Ang panel na ito ay nagbibigay-daan sa iyo na pamahalaan ang mga Playground instance at nagbibigay ng access sa mga sumusunod na panel:

- **Settings**: Para pamahalaan ang mga setting ng kasalukuyang Playground
- **File Browser**: Built-in IDE para sa pag-edit ng mga file, pag-upload ng plugins at themes, at live editing. Awtomatikong nire-reload ng Playground ang mga pagbabago sa real time.
- **Blueprint**: Isang Blueprint editor para sa paglikha, pag-save, at pagpapatakbo ng mga Blueprint sa iyong Playground web instance.
- **Database**: Mga tool para sa pamamahala ng database gamit ang Adminer at phpMyAdmin, at pag-download bilang `.sqlite` file.
- **Logs**: Nagpapakita ng mga log message kapag may problema.

![Save Playground Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard-save.webp)

<!--
Click "Save" to create an instance and list it in the Playground Launch Panel. The Playground Dashboard also offers export and download options through the Additional actions menu:
-->

I-click ang "Save" para lumikha ng instance at ilista ito sa Playground Launch Panel. Ang Playground Dashboard ay nag-aalok din ng mga export at download options sa pamamagitan ng Additional actions menu:

<!--
### Additional actions menu {#additional-actions-menu}
-->

### Additional actions menu {#additional-actions-menu}

![Additional actions Menu](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/additional-options-playground-dashboard.webp)

<!--
- **Export Pull Request to GitHub**: Export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Watch a [demo of this feature](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Download as .zip**: Creates a `.zip` file with the setup of the Playground instance, including any themes or plugins installed. This `.zip` excludes content and database changes.
-->

- **Export Pull Request to GitHub**: I-export ang mga WordPress plugin, theme, at buong wp-content directory bilang mga pull request sa anumang public GitHub repository. Panoorin ang isang [demo ng feature na ito](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Download as .zip**: Gumagawa ng `.zip` file na may setup ng Playground instance, kasama ang anumang naka-install na theme o plugin. Ang `.zip` na ito ay hindi kasama ang content at database changes.

<!--
### Blueprint Editor {#blueprint-editor}
-->

### Blueprint Editor {#blueprint-editor}

![Blueprint editor WordPress Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-blueprint-editor.webp)

<!--
The Blueprint editor replaced the older Blueprint builder, offering the ability to manage multiple Blueprints and code validation.
-->

Ang Blueprint editor ay pinalitan ang lumang Blueprint builder, na nag-aalok ng kakayahang pamahalaan ang maraming Blueprint at code validation.

<!--
### Launch Playground Panel {#launch-playground-panel}
-->

### Launch Playground Panel {#launch-playground-panel}

![Playground Launch Panel](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dashboard/import-playground.webp)

<!--
This panel shows all the ways to launch WordPress Playground: import `.zip` files, load from GitHub repositories, and preview PRs from WordPress core and Gutenberg.

The Launch Panel also lists more than 40 blueprints from the Blueprint Gallery and your Saved Playgrounds.
-->

Ang panel na ito ay nagpapakita ng lahat ng paraan para ilunsad ang WordPress Playground: mag-import ng `.zip` files, mag-load mula sa GitHub repositories, at mag-preview ng mga PR mula sa WordPress core at Gutenberg.

Ang Launch Panel ay naglilista rin ng higit sa 40 blueprints mula sa Blueprint Gallery at iyong mga Saved Playground.

<!--
:::caution

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
-->

:::caution

Ang site sa https://playground.wordpress.net ay para suportahan ang komunidad, ngunit walang garantiya na ito ay patuloy na gagana kung ang traffic ay lumaki nang malaki.

Kung kailangan mo ng tiyak na availability, dapat mong [i-host ang sarili mong WordPress Playground](/developers/architecture/host-your-own-playground).
:::
