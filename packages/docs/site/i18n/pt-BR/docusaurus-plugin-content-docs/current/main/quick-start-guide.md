---
title: Primeiros passos
slug: /quick-start-guide
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!--
# Start using WordPress Playground in 5 minutes
-->

# Comece a usar o WordPress Playground em 5 minutos

<!--
WordPress Playground can help you with any of the following:
-->

WordPress Playground pode nos seguintes pontos:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!--
This page will guide you through each of these. Oh, and if you're a visual learner – here's a video:
-->

Esta página irá guiá-lo por cada um deles. Ah, e se você aprende visualmente, aqui está um vídeo:

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

<!--
## Start a new WordPress site
 -->

## Inicie um novo site WordPress

<!--
Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site.
-->

Cada vez que você visita o [official demo on playground.wordpress.net](https://playground.wordpress.net/), você recebe uma instância nova de um site WordPress.

<!--
You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress.
-->

Você pode então criar páginas, carregar plugins, temas, importar seu próprio site e fazer a maioria das coisas que faria numa instalação normal do WordPress.

<!--
It's that easy to start!
-->

E o processo para iniciar é simples!

<!--
The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page!
-->

A estrutura inteira do site fica no seu navegador e é copiado quando você fecha a aba. Quer recomeçar? Basta atualizar a página!

<!--
:::info WordPress Playground is private

Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over!

:::
-->

:::info O WordPress Playground é privado

Tudo o que você cria fica no seu navegador e **não** é enviado para nenhum servidor remoto, funcionando totalmente de forma privada. Quando terminar, você pode exportar seu site como um arquivo zip. Ou simplesmente atualize a página e comece de novo!

:::

<!--
## Try a block, a theme, or a plugin
-->

## Testando Blocos, Temas e plugins

<!--
You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).
-->

É possível realizar o upload de qualquer plugin ou tema no [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

<!--
To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:
-->

Para agilizar o processo, também é possível pre-instalar plugins ou temas passa o parâmetro no URL `plugin` ou `theme`. Por exemplo, caso queira instalar o plugin coblocks, basta usar o URL:

https://playground.wordpress.net/?plugin=coblocks

<!--
Or this URL to preinstall the `pendant` theme:
-->

Ou este URL para pre-instalar o tema `pendant`:

https://playground.wordpress.net/?theme=pendant

<!--
You can also mix and match these parameters and even add multiple plugins:
-->

Você também pode misturar e combinar esses parâmetros e até mesmo adicionar vários plugins:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

## Save your site

To keep your WordPress Playground site for longer than a single browser session, you can export it as a zip file.

Use the "Export" button in the top bar:

![Export button](@site/static/img/export-button.png)

The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there.

The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager.

## Restore a saved site

You can restore the site you saved by using the import button in WordPress Playground:

![Import button](@site/static/img/import-button.png)

## Use a specific WordPress or PHP version

The easiest way is to use the version switcher on [the official demo site](https://playground.wordpress.net/):

![WordPress Version switcher](@site/static/img/wp-version-switcher.png)

:::info Test your plugin or theme

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

:::

You can also use the `wp` and `php` query parameters to open Playground with the right versions already loaded:

-   https://playground.wordpress.net/?wp=6.5
-   https://playground.wordpress.net/?php=7.4
-   https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

:::info Major versions only

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work.

:::

## Import a WXR file

You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.

This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site.

## Build apps with WordPress Playground

WordPress Playground is programmable which means you can build WordPress apps, setup plugin demos, and even use it as a zero-setup local development environment.

To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
