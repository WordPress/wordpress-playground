---
title: Quick Start Guide
slug: /quick-start-guide
description: A 5-minute guide to get started with Playground. Learn how to test plugins, try themes, and use different WP/PHP versions.
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

# Start using WordPress Playground in 5 minutes

WordPress Playground can help you with any of the following:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

This page will guide you through each of these. Oh, and if you're a visual learner – here's a video:

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

## Start a new WordPress site

Every time you visit the [official demo on playground.wordpress.net](https://playground.wordpress.net/), you get a fresh WordPress site.

You can then create pages, upload plugins, themes, import your own site, and do most things you would do on a regular WordPress.

It's that easy to start!

The entire site lives in your browser and is scraped when you close the tab. Want to start over? Just refresh the page!

:::info WordPress Playground is private

Everything you build stays in your browser and is **not** sent anywhere. Once you're finished, you can export your site as a zip file. Or just refresh the page and start over!

:::

## Try a block, a theme, or a plugin

You can upload any plugin or theme you want in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/).

To save a few clicks, you can preinstall plugins or themes from the WordPress plugin directory by adding a `plugin` or `theme` parameter to the URL. For example, to install the coblocks plugin, you can use this URL:

https://playground.wordpress.net/?plugin=coblocks

Or this URL to preinstall the `pendant` theme:

https://playground.wordpress.net/?theme=pendant

In case you would like to install multiple themes and plugins, it is possible to repeat the `theme` or `plugin` parameters:

https://playground.wordpress.net/?theme=pendant&theme=acai

You can also mix and match these parameters and even add multiple plugins:

https://playground.wordpress.net/?plugin=coblocks&plugin=friends&theme=pendant

<ThisIsQueryApi />

## Save your site

To keep your WordPress Playground site for longer than a single browser session, you can export it as a `.zip` file.

1. Open the Playground site manager panel:

![Site Manager](@site/static/img/site-manager/open-site-manager.webp)

2. Use the "Download as .zip" button in the additional actions menu

![Export button](@site/static/img/site-manager/export-zip-file.webp)

The exported file contains the complete site you've built. You could host it on any server that supports PHP and SQLite. All WordPress core files, plugins, themes, and everything else you've added to your site are in there.

The SQLite database file is also included in the export, you'll find it `wp-content/database/.ht.sqlite`. Keep in mind that files starting with a dot are hidden by default on most operating systems so you might need to enable the "Show hidden files" option in your file manager.

## Restore a saved site

You can restore the saved site using the "Import from .zip" button in the Playground dashboard panel:

1. Open the Playground dashboard panel:

![Open Playground Dashboard](@site/static/img/dashboard/open-playground-dashboard.webp)

1. Use the "Import .zip" button at the end of the "Start a new Playground" section

![Open Playground Dashboard](@site/static/img/dashboard/import-playground.webp)

## Use a specific WordPress or PHP version

The quickest way to change the version of WordPress or PHP is by using the settings panel on the [official demo site](https://playground.wordpress.net/):

![WordPress Playground Settings menu](@site/static/img/playground-settings-menu.webp)

:::info Test your plugin or theme

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

:::

You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2

<ThisIsQueryApi />

To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).

:::info Major versions only

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work.

:::

## Import a WXR file

You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.

This is different from the import feature described above. The import feature exports the entire site, including the database. This import feature imports a WXR file into an existing site.

## Build apps with WordPress Playground

WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), setup plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).

To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
