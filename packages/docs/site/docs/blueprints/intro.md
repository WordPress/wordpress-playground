---
title: WordPress Playground Blueprints
slug: /blueprints
id: introduction
description: Choose Blueprint v2 for new WordPress Playground setups or find the legacy v1 documentation and migration guide.
---

# WordPress Playground Blueprints

Blueprints are JSON declarations that create configured WordPress Playground
sites. They can select WordPress and PHP, install plugins and themes, add site
content, and prepare a repeatable demo, preview, reproduction, or development
environment.

## Start with Blueprint v2

V2 is the recommended format for new work. It describes the site you need
instead of making every setup action an ordered script.

```json blueprint-v2 fixture=quickstart
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/",
			"login": true
		}
	},
	"phpVersion": "8.3",
	"wordpressVersion": "latest",
	"activeTheme": "twentytwentyfive",
	"plugins": ["hello-dolly"],
	"siteOptions": {
		"blogname": "My Blueprint v2 site",
		"permalink_structure": "/%postname%/"
	},
	"content": [
		{
			"type": "posts",
			"source": {
				"post_title": "Welcome",
				"post_status": "publish",
				"post_content": "<!-- wp:paragraph --><p>Created by Blueprint v2.</p><!-- /wp:paragraph -->"
			}
		}
	]
}
```

[Run in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/quickstart.json)

Use the code block's copy action to copy or save the declaration. In Playground,
open **Dock → Blueprint** to inspect or edit it.

New to Blueprints? Take the [Blueprints 101 v2 crash course](/blueprints/v2/blueprints-101).
Or [build and run this site in five minutes](/blueprints/v2/blueprints-101/get-started), then
choose the guide for your task:

- [Add a Preview to a WordPress.org plugin](/blueprints/v2/tutorials/plugin-preview)
- [Build an interactive WordPress theme demo](/blueprints/v2/tutorials/theme-demo)
- [Create a one-click bug or pull-request reproduction](/blueprints/v2/tutorials/bug-reproduction)
- [Run v2 in the browser, CLI, or JavaScript](/blueprints/v2/blueprints-101/run)
- [Use local data and Blueprint bundles](/blueprints/v2/resources)
- [Apply a declaration to an existing site](/blueprints/v2/apply-to-existing-site)

See the [Blueprint v2 overview](/blueprints/v2) for the support matrix, mental
model, and complete learning path.

## Choose a version

|                 | Blueprint v2                                            | Blueprint v1                                   |
| --------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Version marker  | Exact numeric `"version": 2`                            | No `version` field                             |
| Authoring model | Declarative site state with an optional imperative tail | Ordered steps plus top-level shorthands        |
| Recommendation  | Use for new work                                        | Maintain existing declarations while migrating |
| Documentation   | [V2 overview](/blueprints/v2)                           | [V1 legacy guide](/blueprints/v1)              |

Current Playground runners still accept v1. Its existing deep documentation
URLs remain available and are clearly marked as legacy. Do not add `version: 2`
to an unchanged v1 file; use the [manual migration guide](/blueprints/v2/migrate-from-v1).

## Reference and help

- [V2 schema reference](/blueprints/v2/reference/schema)
- [V2 additional steps](/blueprints/v2/reference/additional-steps)
- [V2 content and site data](/blueprints/v2/reference/content-and-site-data)
- [V2 troubleshooting](/blueprints/v2/troubleshooting)
- [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)

The documentation only claims support on tested Playground surfaces. Check the
[V2 support matrix](/blueprints/v2#current-support) before assuming another
WordPress product or host executes the same declaration.
