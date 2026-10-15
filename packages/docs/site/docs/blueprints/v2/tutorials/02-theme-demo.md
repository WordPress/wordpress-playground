---
title: Build an interactive WordPress theme demo
slug: /blueprints/v2/tutorials/theme-demo
description: Launch a WordPress theme with repeatable content, media, and a front-end landing page in Playground.
---

# Build an interactive WordPress theme demo

A useful theme demo opens on designed content, not an empty installation. In
this tutorial, you will publish a link that opens your theme on a representative
page with an image, responsive columns, and no setup clicks.

## What you will build

- A specific active theme.
- A published page with headings, body text, an image, and responsive columns.
- An imported Media Library item with useful metadata.
- A front-end URL that opens as soon as the Blueprint finishes.
- An example that can later move with its assets as a Blueprint bundle.

## Prerequisites

- A WordPress.org theme slug, built theme ZIP, or committed theme directory.
- Demo copy and media you are allowed to redistribute.
- Node.js if you want to run the example with the Playground CLI.

## Run the finished demo

[Run in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/theme-demo.json)

The example opens `/theme-demo/` with Twenty Twenty-Five 1.4 active. You will see a page titled **A complete theme demo**, a large introduction, a block-editor image, and two responsive columns. The same image appears in the Media Library with a title, alt text, and caption. After it opens, use **Dock → Blueprint** to inspect or edit the JSON.

<details>

<summary>View and copy the complete Blueprint</summary>

```json blueprint-v2 fixture=theme-demo
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"blueprintMeta": {
		"name": "Interactive theme demo",
		"description": "A front-end theme demo with deterministic content and media.",
		"authors": ["WordPress Playground"],
		"tags": ["theme", "demo"]
	},
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/theme-demo/",
			"login": false,
			"networkAccess": false
		}
	},
	"phpVersion": "8.3",
	"wordpressVersion": "latest",
	"activeTheme": "twentytwentyfive@1.4",
	"siteOptions": {
		"blogname": "Blueprint theme demo",
		"permalink_structure": "/%postname%/"
	},
	"media": [
		{
			"source": "https://raw.githubusercontent.com/WordPress/wordpress-playground/1a238312cdc474b846b6cf41e26193e90cb59ed3/packages/playground/blueprints/src/tests/fixtures/demo.png",
			"title": "WordPress block editor",
			"alt": "The WordPress block editor displaying a Playground demo",
			"caption": "Imported by the theme demo Blueprint."
		}
	],
	"content": [
		{
			"type": "posts",
			"source": {
				"post_title": "Theme demo",
				"post_name": "theme-demo",
				"post_type": "page",
				"post_status": "publish",
				"post_content": "<!-- wp:group {\"layout\":{\"type\":\"constrained\"}} --><div class=\"wp-block-group\"><!-- wp:heading {\"level\":1} --><h1 class=\"wp-block-heading\">A complete theme demo</h1><!-- /wp:heading --><!-- wp:paragraph {\"fontSize\":\"large\"} --><p class=\"has-large-font-size\">This page gives the active theme a repeatable mix of headings, text, and media.</p><!-- /wp:paragraph --><!-- wp:image {\"sizeSlug\":\"large\"} --><figure class=\"wp-block-image size-large\"><img src=\"https://raw.githubusercontent.com/WordPress/wordpress-playground/1a238312cdc474b846b6cf41e26193e90cb59ed3/packages/playground/blueprints/src/tests/fixtures/demo.png\" alt=\"The WordPress block editor displaying a Playground demo\"/></figure><!-- /wp:image --><!-- wp:columns --><div class=\"wp-block-columns\"><!-- wp:column --><div class=\"wp-block-column\"><!-- wp:heading {\"level\":2} --><h2 class=\"wp-block-heading\">Typography</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Check the theme's type scale and reading width.</p><!-- /wp:paragraph --></div><!-- /wp:column --><!-- wp:column --><div class=\"wp-block-column\"><!-- wp:heading {\"level\":2} --><h2 class=\"wp-block-heading\">Layout</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Resize the preview to inspect responsive columns and spacing.</p><!-- /wp:paragraph --></div><!-- /wp:column --></div><!-- /wp:columns --></div><!-- /wp:group -->"
			}
		}
	]
}
```

</details>

## Customize the example

| Example field                                         | Replace it with                                | Check after a clean run                                             |
| ----------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| `activeTheme`                                         | Your released theme, built ZIP, or directory   | The intended theme is active                                        |
| `content[].source`                                    | A small set of representative pages and blocks | Typography, spacing, templates, and responsive behavior are visible |
| `media`                                               | Assets you may redistribute                    | Each asset appears in the Media Library with useful metadata        |
| `siteOptions.permalink_structure`                     | The URL structure used by your landing page    | The landing URL does not redirect or return a 404                   |
| `applicationOptions.wordpress-playground.landingPage` | The best first page for a visitor              | The demo opens on the result, not a setup screen                    |
| `wordpressVersion` and `phpVersion`                   | Versions you want to track or pin              | The runtime matches your support policy                             |

The example pins the theme but deliberately follows the latest WordPress
release. Pin `wordpressVersion` too when you need the entire demo to stay
unchanged between reviews.

## 1. Select the theme explicitly

For a released WordPress.org theme, replace `activeTheme` with its slug and an
available version:

```jsonc
"activeTheme": "your-theme@1.2.0"
```

For a built ZIP stored beside the Blueprint, use a path that starts with `./`.
This is called an execution-context path because it resolves from the files
packaged with `blueprint.json`:

```jsonc
"activeTheme": "./themes/your-theme.zip"
```

`activeTheme` both installs and activates the theme. Use the separate `themes`
array only for additional themes that should remain inactive. If a Git checkout
needs npm, Composer, or another build step, reference a published build artifact
instead; a Blueprint does not build source code for you.

## 2. Give the theme representative content

The example declares one published page under `content`. Its block markup covers
several common design decisions:

- heading scale and reading width;
- large paragraph typography;
- image sizing and captions;
- column width, gaps, and responsive stacking.

Replace this with the smallest content set that represents the theme. Keep
stable `post_name` values so final URLs do not change, and keep
`permalink_structure` explicit when the landing page uses a pretty permalink.

The example's media source is a raw GitHub URL containing a full commit SHA.
That makes the Run action independent of a moving branch. The `media` entry
imports the file into WordPress; the page also uses the same immutable URL in
its image block so the visual result does not depend on a generated attachment
ID or uploads path.

Choose one asset strategy for your own demo:

| Strategy         | Use it when                                            | Tradeoff                                                      |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Immutable URLs   | You want one JSON file and can host public assets      | The demo still depends on those hosts remaining available     |
| Blueprint bundle | You want the JSON, theme, and media to travel together | You must distribute the directory or ZIP instead of only JSON |

## 3. Choose the page visitors see first

The front-end result is part of the demo contract:

```jsonc
"applicationOptions": {
	"wordpress-playground": {
		"landingPage": "/theme-demo/",
		"login": false,
		"networkAccess": false
	}
}
```

Use `login: false` for a visitor-facing preview. Point `landingPage` to a page
that the Blueprint itself creates, and exercise that exact path in a clean run.
Set `phpVersion` explicitly rather than inheriting a host default.

## 4. Move local media and theme files into a bundle

For a self-contained demo, put the JSON and binary inputs in one directory:

```text
theme-demo/
├── blueprint.json
├── themes/
│   └── your-theme.zip
└── media/
    └── hero.png
```

Then replace the remote sources with `./themes/your-theme.zip` and
`./media/hero.png`. Package the directory as a ZIP to share it with the browser,
or pass the directory or ZIP directly to the CLI.

A standalone local JSON file needs explicit permission to read adjacent files:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./theme-demo/blueprint.json \
	--blueprint-may-read-adjacent-files
```

A directory input is shorthand for `./theme-demo/blueprint.json`, so it needs
the same adjacent-file flag when it reads sibling files. A ZIP bundle does not
need the flag. See
[Blueprint bundles](/blueprints/v2/resources#blueprint-bundles) for supported
layouts and browser delivery.

## Optional: use a WXR export for a larger demo

Keep inline posts for a small, readable demo. Use a WXR export when recreating
the representative content by hand would be harder to review or maintain, and
make its import policy explicit:

```json
{
	"type": "wxr",
	"source": "./content/starter.wxr",
	"authorsMode": "default-author",
	"defaultAuthorUsername": "admin",
	"importUsers": false,
	"importComments": false,
	"urlsMode": "rewrite",
	"staticAssets": "fetch"
}
```

These controls make author handling, user and comment creation, URL rewriting,
and asset fetching reviewable instead of relying on import defaults. Before
using `"fetch"`, change the example's Playground `networkAccess` option to
`true` so WordPress can download remote attachments. Keep network access false
and use `"hotlink"` when the imported content should retain remote asset URLs.
Bundle the WXR and any local media with the Blueprint.

## Check the finished demo

If you followed the directory layout above, exercise the complete bundle both
headlessly and in a browser:

```bash
npx @wp-playground/cli@latest run-blueprint \
	--blueprint=./theme-demo \
	--blueprint-may-read-adjacent-files
npx @wp-playground/cli@latest server \
	--blueprint=./theme-demo \
	--blueprint-may-read-adjacent-files
```

For a ZIP bundle, pass `--blueprint=./theme-demo.zip` without the permission
flag.

In a fresh run, verify:

1. The intended theme is active.
2. `/theme-demo/` loads without a redirect or 404.
3. The page contains every representative block.
4. The image appears in both the page and Media Library.
5. Narrow and wide viewports demonstrate the layout clearly.
6. No setup click is required after the Blueprint finishes.

Review local and third-party assets under the
[Blueprint security model](/blueprints/v2/security), and do not put private
downloads or license keys in a public bundle.

## Related guides

- [Blueprint v2 quickstart](/blueprints/v2/blueprints-101/get-started)
- [How v2 applies themes, media, and content](/blueprints/v2/blueprints-101/how-it-works)
- [Data sources, paths, and bundles](/blueprints/v2/resources)
- [Blueprint v2 schema reference](/blueprints/v2/reference/schema)
- [Troubleshooting fetch and execution failures](/blueprints/v2/troubleshooting)
