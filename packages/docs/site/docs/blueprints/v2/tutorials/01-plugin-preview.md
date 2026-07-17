---
title: Add a Preview to a WordPress.org plugin
slug: /blueprints/v2/tutorials/plugin-preview
description: Commit a Blueprint v2 file that gives a WordPress.org plugin a tested, one-click Playground preview.
---

# Add a Preview to a WordPress.org plugin

This tutorial adds a repeatable Playground environment to a plugin's
WordPress.org page. Its Blueprint installs the plugin and declares the runtime,
dependencies, options, sample content, login, and landing page around it.

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

This checked fixture is the complete Blueprint used in the tutorial. Run it to
inspect the environment it owns.

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
	"contentBaseline": "empty",
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

[Run in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/plugin-preview.json)

Use the code block's copy action to copy or save the declaration. In Playground,
open **Dock → Blueprint** to inspect or edit it.

The run opens **Pages** in wp-admin, installs and activates Query Monitor as the
example plugin, sets a demo option, and creates **Plugin preview sample**.

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
the Plugin Directory's `plugin` query parameter into a v2 declaration.

## 2. Replace the example state with the plugin's demo

Keep the exact numeric `"version": 2`, then customize the fixture:

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

The first entry is the plugin being previewed; the second is a pinned example
dependency:

```jsonc
"plugins": ["your-plugin-slug", "required-plugin@1.2.3"]
```

Site options are applied before plugin installation. Sample content is imported
after plugins and post types in the fixed
[v2 execution order](/blueprints/v2/blueprints-101/how-it-works).

## 3. Validate and exercise it locally

Keep `$schema` in the file so JSON Schema-aware editors report invalid fields.
Then run the complete declaration headlessly:

```bash
npx @wp-playground/cli@latest run-blueprint \
	--blueprint=./assets/blueprints/blueprint.json
```

Also start an interactive local run when the landing screen matters:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./assets/blueprints/blueprint.json
```

These commands validate the Blueprint-owned environment. The directory's **Test
Preview** remains the final check that the current published plugin is present
and active on WordPress.org.

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
documents the directory-side workflow.

**Current localization limitation (July 2026):** use the default English
Preview while testing v2. The
[Plugin Directory Preview endpoint](https://meta.svn.wordpress.org/sites/trunk/wordpress.org/public_html/wp-content/plugins/plugin-directory/api/routes/class-plugin-blueprint.php)
appends a v1 `steps` entry for a non-English `lang` request, which makes the
resulting v2 declaration invalid.

## 5. Opt in to the public Preview button

A valid file alone does not publish a Preview button to everyone. After a
committer has tested it:

1. Open the plugin's **Advanced** view on WordPress.org.
2. Change the plugin preview setting to **Public**.
3. Open the public plugin page while signed out and test **Preview** once more.

This two-stage workflow keeps an unreviewed or broken environment private while
committers iterate.

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
