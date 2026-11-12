---
title: Build your first v2 Blueprint
slug: /blueprints/v2/blueprints-101/get-started
description: Run, inspect, personalize, and save your first working v2 Blueprint in the browser.
---

# Build and run your first v2 Blueprint

**Lesson 1 of 3 · Browser only**

You will open a complete WordPress site, change its title, and save the v2
Blueprint that created it. Nothing is installed on your computer.

## 1. Open the site

[Run the course Blueprint in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/quickstart.json).

When setup finishes, check that:

- Playground opens the WordPress dashboard (`wp-admin`);
- **My Blueprint v2 site** appears as the site title;
- Twenty Twenty-Five is the active theme;
- Hello Dolly is an active plugin; and
- **Welcome** appears under **Posts**.

These visible results are a quick way to confirm that the whole Blueprint ran.
If setup stops early, open the
[troubleshooting guide](/blueprints/v2/troubleshooting) before continuing.

## 2. Inspect the Blueprint

Open **Dock → Blueprint** in the Playground you just created. The editor shows
the JSON that produced the site:

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

This is the working course example. You will personalize it in the next step.

## 3. Make it yours

In the Blueprint editor, find `siteOptions` and change the title:

```jsonc
"siteOptions": {
	"blogname": "My plugin test site",
	"permalink_structure": "/%postname%/"
}
```

Choose **Discard current Playground & run Blueprint**. This discards only the
temporary course site and creates a fresh one from the edited JSON. On a saved
site, the corresponding action is **Run in a new Playground**. Check that **My
plugin test site** now appears as the site title and that the theme, plugin, and
Welcome post are still present.

Leave the editor open if you plan to use the browser path in lesson 3. To try
the CLI or JavaScript paths, copy the edited JSON and save it as
`blueprint.json`.

## 4. Read the JSON by purpose

You do not need to memorize every field. Start with four groups:

- **Select the format:** `$schema` enables editor help, while `version` selects
  v2. The value must be the number `2`.
- **Choose the runtime:** `phpVersion` and `wordpressVersion` select PHP and
  WordPress for this new site.
- **Control the Playground experience:**
  `applicationOptions.wordpress-playground` logs you in and opens the chosen
  page after setup.
- **Describe the WordPress site:** in this example, `activeTheme` and `plugins`
  install and activate packages from WordPress.org, `siteOptions` changes
  settings, and `content` creates the Welcome post.

The example chooses its PHP version and landing page explicitly instead of
depending on host defaults. It requests the latest WordPress release, which is
convenient for learning but can change over time. Pin versions when a test or
reproduction must stay repeatable.

## Next lesson

Continue to
[understand how v2 Blueprints work](/blueprints/v2/blueprints-101/how-it-works).
You will follow this same Blueprint through setup and learn the three ordering
rules that matter when you edit it.
