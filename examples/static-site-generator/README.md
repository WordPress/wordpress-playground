# Static Site Generator Example

This example explores the static publishing workflow proposed in
[wordpress-playground#707](https://github.com/WordPress/wordpress-playground/issues/707):

1. Build or edit a site in WordPress Playground.
2. Export public pages and frontend assets as static files.
3. Keep the editable source site in Playground while publishing the static export anywhere.

## Try It In The Playground Webapp

After this example is merged, open:

```text
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/trunk/examples/static-site-generator/blueprint.json
```

The Blueprint installs this example plugin from the repository with a
`git:directory` resource and opens `Tools -> Static Site Generator`.

## Local Playground CLI

From the repository root:

```bash
npx @wp-playground/cli@latest server \
	--mount=./examples/static-site-generator/plugin:/wordpress/wp-content/plugins/static-site-generator \
	--blueprint=./examples/static-site-generator/blueprint-local.json
```

To run a non-interactive Playground export smoke from the repository root:

```bash
node examples/static-site-generator/playground-export-smoke.mjs
```

The smoke mounts the local plugin into Playground, exports a fixture site, and
verifies that generated page, post, asset, and referenced CSS targets exist.
It installs a custom smoke theme and checks that exported posts and pages
contain their own rendered content instead of the homepage. It uses WordPress
6.8 and PHP 8.3 by default; set `SSGWP_SMOKE_WP_VERSION` or
`SSGWP_SMOKE_PHP_VERSION` to test another runtime.

To run an export from the Playground CLI without opening the admin screen,
mount the plugin and a host output directory, then run the CLI export
Blueprint:

```bash
mkdir -p ./static-site-output
npx @wp-playground/cli@latest run-blueprint \
	--mount=./examples/static-site-generator/plugin:/wordpress/wp-content/plugins/static-site-generator \
	--mount=./static-site-output:/exports \
	--blueprint=./examples/static-site-generator/blueprint-cli-export.json
```

The generated ZIP is written to `./static-site-output/static-site.zip`.
On a regular WP-CLI-enabled WordPress site, the plugin exposes the same command:

```bash
wp static-site export --output=./static-site.zip --fetch-mode=internal
```

## What The Plugin Exports

- Public home, post, page, custom post type, taxonomy, and author archive URLs, including archive pagination.
- Same-site page links discovered in exported HTML, up to the configured page limit.
- `wp-content/uploads`.
- The active parent and child theme.
- Active plugin asset files, excluding PHP and common development-only folders.
- WordPress core frontend asset directories used by block themes and scripts.
- Missing core block stylesheets detected from rendered markup, such as the
  Navigation block stylesheet when WordPress renders the block without a link
  tag.

Same-site URLs in links, media attributes, `srcset` values, inline styles, CSS
files, JSON, and JavaScript are rewritten to relative URLs by default, so the
output can be hosted from a folder, GitHub Pages, or a CDN path. Linked copied
text assets can also pull in their own same-site dependencies, such as icons
referenced by a web manifest.

The Playground admin screen shows export progress while the ZIP is being
prepared. The WP-CLI command prints stage and page progress while exporting.
The programmatic `ssgwp_export_static_site()` API also accepts a
`progress_callback` option that receives structured progress events and writes
those events into `static-export.json`. The export manifest also records the
home URL, exported URLs, page and file counts, URL mode, warnings, plugin and
WordPress versions, and a note that the editable Playground site should be
saved separately from the static ZIP.

The static ZIP is the published site. To keep editing the source site later,
also export or save the full Playground site from Playground's site manager.
