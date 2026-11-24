---
title: Add a Preview to a WordPress.org plugin
slug: /blueprints/v2/tutorials/plugin-preview
description: Commit a Blueprint v2 file that gives a WordPress.org plugin a tested, one-click Playground preview.
---

# Add a Preview to a WordPress.org plugin

Give visitors a **Preview** button beside your plugin's download action. The
button opens a fresh Playground site with your published plugin active and a
useful example already on screen.

You will start from a working Blueprint, replace its plugin and demo state, run
it locally, and move it through WordPress.org's private and public checks.

## What you will ship

- The exact SVN path `assets/blueprints/blueprint.json`.
- A committer-only **Test Preview** for checking the result.
- After an explicit opt-in, a public **Preview** button beside the plugin's
  download action.
- A small site state that demonstrates the plugin instead of opening an empty
  wp-admin screen.

## Prerequisites

- Committer access to the plugin's WordPress.org SVN repository.
- A plugin that can run in WordPress Playground.
- Node.js if you want to exercise the file locally with the Playground CLI.
- One clear result a reviewer can verify after the preview loads.

## Run the finished Blueprint

[Run in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/plugin-preview.json)

The example opens **Pages** in the WordPress dashboard, installs and activates Query Monitor, sets a demo option, and creates **Plugin preview sample**. After it opens, use **Dock → Blueprint** to inspect or edit the JSON.

<details>

<summary>View and copy the complete Blueprint</summary>

```json blueprint-v2 fixture=plugin-preview
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"blueprintMeta": {
		"name": "WordPress.org plugin preview",
		"description": "A repeatable preview environment for a WordPress.org plugin.",
		"authors": ["WordPress Playground"],
		"tags": ["plugin", "preview"]
	},
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/edit.php?post_type=page",
			"login": true,
			"networkAccess": false
		}
	},
	"phpVersion": "8.3",
	"wordpressVersion": "latest",
	"plugins": ["query-monitor"],
	"siteOptions": {
		"blogname": "Plugin preview",
		"permalink_structure": "/%postname%/",
		"example_plugin_demo_mode": "guided"
	},
	"content": [
		{
			"type": "posts",
			"source": {
				"post_title": "Plugin preview sample",
				"post_name": "plugin-preview-sample",
				"post_type": "page",
				"post_status": "publish",
				"post_content": "<!-- wp:heading {\"level\":1} --><h1 class=\"wp-block-heading\">Plugin preview sample</h1><!-- /wp:heading --><!-- wp:paragraph --><p>Replace this page and the example option with the smallest state that demonstrates your plugin.</p><!-- /wp:paragraph -->"
			}
		}
	]
}
```

</details>

## Customize the example

Make these replacements before you publish it:

| Example field                                         | Replace it with                                       | Check after a clean run                                      |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `plugins`                                             | Dependencies first, then your plugin's directory slug | Every required plugin is installed and your plugin is active |
| `siteOptions`                                         | Real options your plugin reads                        | The plugin starts in a useful demo state                     |
| `content`                                             | The smallest post, page, or custom content it needs   | A visitor can see the feature without creating content       |
| `applicationOptions.wordpress-playground.landingPage` | The first useful admin or front-end screen            | Playground opens directly on the feature                     |
| `phpVersion` and `wordpressVersion`                   | Versions you support and have tested                  | The run completes without compatibility errors               |

## 1. Add the file at the exact SVN path

From the root of the plugin's SVN checkout, create:

```text
assets/
└── blueprints/
    └── blueprint.json
```

The supported filename and location are exactly
`assets/blueprints/blueprint.json`. Do not put the file under `trunk` or rename
it for a particular release.

The two systems have different responsibilities:

| Owner                          | What it supplies                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------- |
| WordPress.org Plugin Directory | The Preview and Test Preview entry points                                         |
| `blueprint.json`               | The plugin, runtime, dependencies, theme, options, content, login, and final page |

Add the plugin's own WordPress.org slug to `plugins`. The website does not merge
the Plugin Directory's `plugin` query parameter into a v2 Blueprint.

## 2. Replace the example state with the plugin's demo

Keep the exact numeric `"version": 2`, then customize the example:

- Set `phpVersion` explicitly to a version the plugin supports.
- Decide deliberately whether `wordpressVersion` should track `latest` or a
  tested release.
- Replace Query Monitor with the plugin's own WordPress.org slug. Leave that
  slug unpinned when the Preview should follow the current release.
- Add actual dependencies separately. Pin dependency versions when a stable
  preview matters.
- Replace `example_plugin_demo_mode` with real options consumed by the plugin.
- Replace the sample page with the smallest content that demonstrates the
  feature.
- Point `landingPage` directly at the first screen the visitor should inspect.

Install dependencies before the plugin that needs them. Array position does not
mark any entry as the "main" plugin; it only controls installation order:

```jsonc
"plugins": ["required-plugin@1.2.3", "your-plugin-slug"]
```

Leave your own slug unpinned when the Preview should follow the latest
published WordPress.org release. Pin a dependency when changing it could alter
the demo.

Site options are applied before plugin installation. Sample content is imported
after plugins and post types in the fixed
[v2 execution order](/blueprints/v2/blueprints-101/how-it-works).

## 3. Validate and exercise it locally

Keep `$schema` in the file so JSON Schema-aware editors report invalid fields.
Then run the complete Blueprint headlessly:

```bash
npx @wp-playground/cli@latest run-blueprint \
	--blueprint=./assets/blueprints/blueprint.json
```

Also start an interactive local run when the landing screen matters:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./assets/blueprints/blueprint.json
```

These commands validate the site created by your Blueprint. The directory's
**Test Preview** remains the final check that the current published plugin is
present and active on WordPress.org.

Before moving on, check that a fresh local run:

1. finishes without a validation or download error;
2. activates the plugin and every dependency;
3. creates the intended options and sample content; and
4. opens the declared landing page without another setup click.

## 4. Commit and test the private preview

Add and commit the asset with SVN:

```bash
svn add --parents assets/blueprints/blueprint.json
svn commit assets/blueprints \
	-m "Add a Playground preview Blueprint"
```

Once WordPress.org sees a valid file, the plugin page exposes **Test Preview**
to plugin committers only. Use it to verify all of the following:

1. The current plugin is installed and active.
2. Every declared dependency is installed in the intended state.
3. The sample content and options exercise the feature.
4. The final navigation reaches a useful screen.
5. A fresh preview works without manual cleanup or clicks.

The [Plugin Handbook preview guide](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/)
documents the directory-side workflow. Its Blueprint examples currently use
the v1 format. Follow its WordPress.org and SVN instructions, but keep the v2
JSON from this tutorial.

**Current localization limitation:** use the default English Preview while
testing v2. The
[Plugin Directory Preview endpoint](https://meta.svn.wordpress.org/sites/trunk/wordpress.org/public_html/wp-content/plugins/plugin-directory/api/routes/class-plugin-blueprint.php)
appends a v1 `steps` entry for a non-English `lang` request, which makes the
resulting v2 Blueprint invalid.

## 5. Opt in to the public Preview button

A valid file alone does not publish a Preview button to everyone. After a
committer has tested it:

1. Open the plugin's **Advanced** view on WordPress.org.
2. Change the plugin preview setting to **Public**.
3. Open the public plugin page while signed out and test **Preview** once more.

This two-stage workflow keeps an unreviewed or broken Preview private while
committers iterate.

## You are done when

- A local run completes from the committed JSON.
- **Test Preview** installs the current published release and reaches the right
  screen.
- The public **Preview** works while you are signed out.
- A visitor can understand the feature without changing settings or creating
  content first.
- The Blueprint contains no secrets or private download URLs.

## Security and reproducibility

A preview executes the declared plugin, every dependency, and any inline PHP in
the Blueprint. Treat all of them as code:

- Review every source before committing it.
- Never put API keys, passwords, license keys, or private URLs in the JSON.
- Keep `networkAccess: false` unless the running site genuinely needs outbound
  access.
- Pin dependencies that must not change between reviews.
- Remember that using `wordpressVersion: "latest"` deliberately allows the
  WordPress runtime to change.
- Re-run Test Preview after changing the plugin, a dependency, or the Blueprint.

Read [security and reproducibility](/blueprints/v2/security) before publishing
third-party code or enabling network access.

## Related guides

- [Blueprint v2 quickstart](/blueprints/v2/blueprints-101/get-started)
- [Run Blueprints in the browser and CLI](/blueprints/v2/blueprints-101/run)
- [Data sources, pins, and bundles](/blueprints/v2/resources)
- [Blueprint v2 schema reference](/blueprints/v2/reference/schema)
- [Troubleshooting failed runs](/blueprints/v2/troubleshooting)
