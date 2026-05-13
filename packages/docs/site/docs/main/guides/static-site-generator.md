---
title: Export a static site from Playground
slug: /guides/static-site-generator
description: Export a WordPress Playground site as static HTML, CSS, JavaScript, images, and fonts.
---

WordPress Playground can be used as the editing environment for a static WordPress site. You create or update the site in Playground, export the public frontend as static files, and publish the static export to GitHub Pages, a CDN, or any static host.

The static site generator example plugin provides an experimental export flow for this model.

## Open the exporter in Playground

Use this Blueprint URL to open a Playground instance with the exporter installed and activated:

[Open Static Site Generator](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/trunk/examples/static-site-generator/blueprint.json)

The Blueprint installs the example plugin from this repository using a [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference), logs you in, and opens `Tools -> Static Site Generator`.

## Export a static ZIP

1. Edit the WordPress site in Playground.
2. Go to `Tools -> Static Site Generator`.
3. Choose the URL mode and asset options.
4. Click `Download Static Site ZIP`.

The ZIP includes HTML files for public pages, archive pagination, discovered
same-site page links, and the frontend assets needed by the active theme,
uploads, active plugins, and rendered core blocks such as Navigation. Same-site
URLs in HTML attributes, `srcset`, inline styles, CSS, JSON, and JavaScript are
rewritten to relative paths by default, which makes the export easier to host
from a subdirectory. Linked copied text assets can also pull in their own
same-site dependencies, such as icons referenced by a web manifest.

For longer exports, the Playground admin screen shows the current export stage while the ZIP is being prepared. The WP-CLI command prints stage and page progress, and the programmatic API accepts a `progress_callback` option and writes the progress events into `static-export.json`.

## Keep the editable source site

The static ZIP is only the published output. To keep editing the source site later, save or export the full Playground site from the Playground site manager as well.

## Run locally

From a WordPress Playground checkout:

```bash
npx @wp-playground/cli@latest server \
	--mount=./examples/static-site-generator/plugin:/wordpress/wp-content/plugins/static-site-generator \
	--blueprint=./examples/static-site-generator/blueprint-local.json
```

The local Blueprint activates the mounted plugin and opens the same admin export screen.
