# Static Site Generator Example

This example explores the static publishing workflow proposed in [wordpress-playground#707](https://github.com/WordPress/wordpress-playground/issues/707):

1. Build or edit a site in WordPress Playground.
2. Export public pages and frontend assets as static files.
3. Keep the editable source site in Playground while publishing the static export anywhere.

## Try It In The Playground Webapp

After this example is merged, open:

```text
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/trunk/examples/static-site-generator/blueprint.json
```

The Blueprint installs this example plugin from the repository with a `git:directory` resource and opens `Tools -> Static Site Generator`.

## Local Playground CLI

From the repository root:

```bash
npx @wp-playground/cli@latest server \
	--mount=./examples/static-site-generator/plugin:/wordpress/wp-content/plugins/static-site-generator \
	--blueprint=./examples/static-site-generator/blueprint-local.json
```

## What The Plugin Exports

- Public home, post, page, custom post type, taxonomy, and author archive URLs.
- Same-site links discovered while exporting, up to the configured page limit.
- `wp-content/uploads`.
- The active parent and child theme.
- Active plugin asset files, excluding PHP and common development-only folders.
- WordPress core frontend asset directories used by block themes and scripts.

Same-site absolute URLs are rewritten to relative URLs by default, so the output can be hosted from a folder, GitHub Pages, or a CDN path.

The static ZIP is the published site. To keep editing the source site later, also export or save the full Playground site from Playground's site manager.
