---
title: Build your first Blueprint v2
slug: /blueprints/v2/get-started
description: Create, validate, edit, and run a complete Blueprint v2 in the browser or Playground CLI.
---

# Build and run your first Blueprint v2

In five minutes, you will create a WordPress site with a theme, a plugin, a
site title, and a published post.

## Run the finished site

The example below is the same checked fixture used by this page and the docs
build. Run it in Playground or copy it into a file named `blueprint.json`.

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

When the run finishes, Playground opens wp-admin. The site title is **My
Blueprint v2 site**, Twenty Twenty-Five is active, Hello Dolly is active, and a
published post named **Welcome** appears under **Posts**.

## Run it with the CLI

Save the JSON above as `blueprint.json`, then run:

```bash
npx @wp-playground/cli@latest server --blueprint=./blueprint.json
```

No v2 flag is required. Playground selects v2 from the exact numeric
`"version": 2` field.

To execute the declaration without keeping a web server open:

```bash
npx @wp-playground/cli@latest run-blueprint --blueprint=./blueprint.json
```

## Edit and validate it

Open [Playground](https://playground.wordpress.net/), choose **New → Write a
Blueprint**, and paste the same JSON. The editor uses `$schema` for completion
and validation. You can also keep `$schema` in a committed file for editor
feedback in VS Code and other JSON Schema-aware tools.

Change the site title:

```jsonc
"siteOptions": {
	"blogname": "My plugin test site",
	"permalink_structure": "/%postname%/"
}
```

Run the declaration again and confirm the new title in wp-admin.

## What each part does

| Field                                     | Result                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `$schema`                                 | Enables validation and completion for both Blueprint versions     |
| `version`                                 | Selects the v2 schema and runtime path; it must be the number `2` |
| `applicationOptions.wordpress-playground` | Logs in and chooses the page shown after execution                |
| `phpVersion` and `wordpressVersion`       | Select the runtime for this new site                              |
| `activeTheme`                             | Installs and activates a WordPress.org theme                      |
| `plugins`                                 | Installs and activates WordPress.org plugins by default           |
| `siteOptions`                             | Writes WordPress options with `update_option()`                   |
| `content`                                 | Creates the declared post after the site is configured            |

The example sets its PHP version and landing page explicitly. Do the same in
portable examples instead of depending on defaults that may differ between
hosts.

## Next steps

- [Understand the v2 lifecycle and declaration order](./how-it-works)
- [Run this file from a URL, JavaScript, or a package API](./run)
- [Add local files or make a Blueprint bundle](./resources)
- [Choose a plugin, theme, or reproduction tutorial](./)
