---
title: Web Instance
slug: /web-instance
description: Isang detalyadong gabay sa web interface sa playground.wordpress.net, na sumasaklaw sa toolbar, settings, at instance manager.
---

# WordPress Playground web instance {#wordpress-playground-web-instance}

Ang [https://playground.wordpress.net/](https://playground.wordpress.net/) ay nagbibigay-daan sa mga developer na patakbuhin ang WordPress sa browser nang walang server. Ang environment na ito ay nagpapadali at nagpapabilis sa pagsubok ng plugins, themes, at features.

Ilang pangunahing tampok:

- **Browser-based**: Hindi kailangan ng lokal na server setup.
- **Instant Setup**: Patakbuhin ang WordPress sa isang click lang.
- **Testing Environment**: Perpekto para sa pagsubok ng plugins at themes.

Ang [Query Params API](/developers/apis/query-api/) ay nagbibigay-daan sa iyo na direktang mag-load ng mga partikular na configuration sa isang Playground instance. Kasama dito ang pagtatakda ng partikular na bersyon ng WordPress, theme, o plugin. Maaari ka ring magtakda ng mas kumplikadong setup gamit ang blueprints (tingnan ang [mga halimbawa dito](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

Ang Playground website ay may kasamang mga toolbar na nagpapasadya sa iyong instance at nagbibigay ng mabilis na access sa mga resources at utilities.

![Playground Toolbar Snapshot](@site/static/img/about/playground-toolbar.webp)

## I-customize ang Playground {#customize-playground}

Sa toolbar, makikita mo ang:

- **Playground Settings**: Isang panel para sa pag-configure ng iyong kasalukuyang instance, tulad ng PHP at WordPress versions.
- **Playground Dashboard**: Ang panel na ito ay nagbibigay-daan sa iyo na pamahalaan ang mga WordPress Playground instance, i-save at i-export sila, mag-edit ng mga file mula sa iyong WordPress instance, at lumikha ng mga bagong Blueprint.
- **Playground Launch Panel**: Ang Launch Panel ay nagpapakita ng lahat ng paraan para maglunsad ng WordPress Playground instance.

### Playground Settings {#playground-settings}

![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)

Ang **Playground Settings Panel** ay may kasamang mga [Query API options](/developers/apis/query-api#available-options) na ito:

- `wp`: Tinutukoy ang bersyon ng WordPress.
- `php`: Tinutukoy ang bersyon ng PHP para sa instance.
- `language`: Itinatakda ang wika ng WordPress instance.
- `multisite`: Pinapagana ang WordPress multisite support.
- `networking`: Pinapagana ang network access sa WordPress Plugin Directory at WordPress APIs.

## Playground Manager {#playground-manager}

![Playground settings panel allow users to save export and edit the WordPress directly](@site/static/img/about/playground-dashboard.webp)

Ang panel na ito ay nagbibigay-daan sa iyo na pamahalaan ang mga Playground instance at nagbibigay ng access sa mga sumusunod na panel:

- **Settings**: Para pamahalaan ang mga setting ng kasalukuyang Playground
- **File Browser**: Built-in IDE para sa pag-edit ng mga file, pag-upload ng plugins at themes, at live editing. Awtomatikong nire-reload ng Playground ang mga pagbabago sa real time.
- **Blueprint**: Isang Blueprint editor para sa paglikha, pag-save, at pagpapatakbo ng mga Blueprint sa iyong Playground web instance.
- **Database**: Mga tool para sa pamamahala ng database gamit ang Adminer at phpMyAdmin, at pag-download bilang `.sqlite` file.
- **Logs**: Nagpapakita ng mga log message kapag may problema.

![Save Playground Button](@site/static/img/about/playground-dashboard-save.webp)

I-click ang "Save" para lumikha ng instance at ilista ito sa Playground Launch Panel. Ang Playground Dashboard ay nag-aalok din ng mga export at download options sa pamamagitan ng Additional actions menu:

### Additional actions menu {#additional-actions-menu}

![Additional actions Menu](@site/static/img/about/additional-options-playground-dashboard.webp)

- **Export Pull Request to GitHub**: I-export ang mga WordPress plugin, theme, at buong wp-content directory bilang mga pull request sa anumang public GitHub repository. Panoorin ang isang [demo ng feature na ito](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Download as .zip**: Gumagawa ng `.zip` file na may setup ng Playground instance, kasama ang anumang naka-install na theme o plugin. Ang `.zip` na ito ay hindi kasama ang content at database changes.

### Blueprint Editor {#blueprint-editor}

![Blueprint editor WordPress Playground](@site/static/img/about/playground-blueprint-editor.webp)

Ang Blueprint editor ay pinalitan ang lumang Blueprint builder, na nag-aalok ng kakayahang pamahalaan ang maraming Blueprint at code validation.

### Launch Playground Panel {#launch-playground-panel}

![Playground Launch Panel](@site/static/img/dashboard/import-playground.webp)

Ang panel na ito ay nagpapakita ng lahat ng paraan para ilunsad ang WordPress Playground: mag-import ng `.zip` files, mag-load mula sa GitHub repositories, at mag-preview ng mga PR mula sa WordPress core at Gutenberg.

Ang Launch Panel ay naglilista rin ng higit sa 40 blueprints mula sa Blueprint Gallery at iyong mga Saved Playground.

:::caution

Ang site sa https://playground.wordpress.net ay para suportahan ang komunidad, ngunit walang garantiya na ito ay patuloy na gagana kung ang traffic ay lumaki nang malaki.

Kung kailangan mo ng tiyak na availability, dapat mong [i-host ang sarili mong WordPress Playground](/developers/architecture/host-your-own-playground).
:::
