---
title: Quick Start Guide
slug: /quick-start-guide
description: A 5-minute guide to get started with Playground. Learn how to test plugins, try themes, and use different WP/PHP versions.
---

# Start using WordPress Playground in 5 minutes

WordPress Playground can help you with any of the following:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

This page will guide you through each of these. Oh, and if you're a visual learner – here's a video. Some interface details in the video predate the Dock; follow the written steps below for the current UI.

<iframe width="752" height="423.2" title="Getting started with WordPress Playground" src="https://video.wordpress.com/v/3UBIXJ9S?autoPlay=false&amp;height=1080&amp;width=1920&amp;fill=true" class="editor-media-modal-detail__preview is-video" allowFullScreen></iframe>

## Start a new WordPress site

Open the [official demo on playground.wordpress.net](https://playground.wordpress.net/) to start WordPress in your browser.

You can create pages, upload plugins, install themes, import content, and do most things you would do on a regular WordPress site.

When browser storage is available, new Playgrounds are autosaved. You can find
up to five recent autosaves in **Your Playgrounds** from the Dock. If you need a
site that is discarded on refresh, open Playground with `?storage=temp`.

<div class="callout callout-info">

**WordPress Playground is private**

The Playground runs locally in your browser. It does not upload your site
unless you choose an action such as **Export to GitHub**. Once you're finished,
you can store the Playground permanently, export it as a ZIP, or start over
from **New Playground**.

</div>

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

This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).

## Store a Playground in browser storage

Click the **Autosaved** or **Unsaved** status in the Dock to open **Store
permanently**, then choose **Save in browser storage**.

![The Store permanently pane with browser storage selected](/img/dock/store-permanently-browser.webp)

A saved browser Playground appears in **Your Playgrounds**. Autosaves also
appear there, but Playground keeps up to five recent autosaves. Store a
Playground permanently when you want to keep it beyond the autosave lifecycle.

Browser storage still belongs to the browser. Export a ZIP when you need a file you can move, archive, or restore later.

## Export a portable ZIP

Open **Export** from the Dock and use **Download as .zip**.

![The Export pane with ZIP, setup link, and GitHub options](/img/dock/dock-export-playground.webp)

The exported file contains the current files, database, plugins, themes, uploads, and edits. You can restore it in Playground or host it on a server that supports PHP and SQLite.

The SQLite database file is included at `wp-content/database/.ht.sqlite`. Files starting with a dot are hidden by default on most operating systems, so you may need to enable hidden files in your file manager.

## Restore a ZIP

Open **New Playground** from the Dock, choose **Import zip**, and select the ZIP file.

![The New Playground pane with Import zip selected](/img/dock/dock-new-playground-import-zip.webp)

This restores the files and database from the ZIP into a new Playground.

## Use a specific WordPress or PHP version

Open **Site Settings** from the Dock to choose WordPress, PHP, language, multisite, and networking options.

![The Site Settings pane](/img/dock/dock-site-settings.webp)

<div class="callout callout-info">

**Test your plugin or theme**

Compatibility testing with so many WordPress and PHP versions was always a pain. WordPress Playground makes this process effortless – use it to your advantage!

</div>

You can also use the `wp` and `php` [query parameters](/developers/apis/query-api) to open Playground with the right versions already loaded:

- https://playground.wordpress.net/?wp=6.5
- https://playground.wordpress.net/?php=8.3
- https://playground.wordpress.net/?php=8.2&wp=6.2
- https://playground.wordpress.net/?php=next

This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).

Use `php=next` to preview the next PHP version built from the php-src development branch. For example, see the [PHP 8.6 feature preview](https://playground.wordpress.net/php-8-6.html).

To learn more about preparing content for demos, see the [providing content for your demo guide](/guides/providing-content-for-your-demo).

<div class="callout callout-info">

**Major versions only**

You can specify major versions like `wp=6.2` or `php=8.1` and expect the most recent release in that line. You cannot, however, request older minor versions so neither `wp=6.1.2` nor `php=7.4.9` will work. Generic aliases like `latest` and `next` are exceptions.

</div>

## Import a WXR file

You can import a WordPress export file by uploading a WXR file in [/wp-admin/](https://playground.wordpress.net/?url=/wp-admin/import.php).

You can also use [JSON Blueprints](/blueprints). See [getting started with Blueprints](/blueprints/getting-started) to learn more.

This is different from restoring a Playground ZIP. A WXR file imports WordPress content into an existing site. A Playground ZIP restores files and the database into a new Playground.

## Build apps with WordPress Playground

WordPress Playground is programmable, which means you can [build WordPress apps](/developers/build-your-first-app), set up plugin demos, and even use it as a zero-setup [local development environment](/developers/local-development/).

To learn more about developing with WordPress Playground, check out the [development quick start](/developers/build-your-first-app) section.
