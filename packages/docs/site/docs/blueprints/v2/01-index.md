---
title: Blueprints v2
slug: /blueprints/v2
description: Declare a WordPress site with Blueprint v2 and run it in the Playground website, CLI, or JavaScript client.
---

# Blueprints v2: declare the site you need

Blueprints v2 describe the WordPress site you want, not the setup script that
builds it. Declare the runtime, plugins, themes, options, users, and content in
JSON. Playground validates that declaration, plans the work, and executes it on
a supported target.

Use v2 for new Blueprint work. Start with the
[Blueprints 101 crash course](/blueprints/v2/blueprints-101), or choose a task:

- [Add a Preview to a WordPress.org plugin](/blueprints/v2/tutorials/plugin-preview)
- [Build an interactive theme demo](/blueprints/v2/tutorials/theme-demo)
- [Create a one-click bug or pull-request reproduction](/blueprints/v2/tutorials/bug-reproduction)
- [Run a Blueprint in the browser, CLI, or JavaScript](/blueprints/v2/blueprints-101/run)
- [Migrate a v1 Blueprint](/blueprints/v2/migrate-from-v1)

## A complete v2 Blueprint

Every v2 declaration has the exact numeric field `"version": 2`. It uses the
same public JSON Schema URL as v1. This complete starter is validated during
the documentation build:

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

V2 moves Playground-only behavior such as login and the landing page under
`applicationOptions`. Site state is expressed directly instead of as an
ordered list of installation steps. When an operation cannot be declared,
`additionalStepsAfterExecution` provides a deliberately last-running escape
hatch.

## Current support

The current Playground implementation detects `version: 2` without an
experimental flag on these surfaces:

| Surface                                 | V2 support                  | Notes                                                     |
| --------------------------------------- | --------------------------- | --------------------------------------------------------- |
| Playground website and Blueprint editor | Supported                   | Inline declarations, remote JSON, and ZIP bundles         |
| `@wp-playground/cli`                    | Supported                   | New site, existing-site, headless, and snapshot commands  |
| `@wp-playground/client`                 | Supported                   | `startPlaygroundWeb()` routes v2 automatically            |
| `@wp-playground/blueprints`             | Supported                   | Use the version-aware validation and compilation APIs     |
| PHP without WordPress                   | Supported subset            | Select with `wordpressVersion: "none"`                    |
| WordPress Studio and PersonalWP         | Not documented as supported | Do not assume parity without target-specific confirmation |

This documentation is intentionally precise about implemented Playground
targets. It does not claim that every WordPress host can execute v2.
The recommendation applies to current Playground builds on the listed
surfaces; schema caveats and unsettled defaults remain documented in the
reference. No v1 removal release or end-of-support date has been announced.

## V2 and legacy v1

V1 declarations have no `version` field and current Playground runners still
accept them. The [v1 documentation](/blueprints/v1) remains available for existing
projects, but it is legacy material. New work should use v2.

Migration is manual: there is no automatic converter. The
[migration guide](/blueprints/v2/migrate-from-v1) covers renamed fields, resource syntax,
the networking-default change, lifecycle differences, and operations with no
direct equivalent.

## Learn the model

1. [Build and run your first v2 Blueprint](/blueprints/v2/blueprints-101/get-started).
2. Read [how v2 plans and executes declarations](/blueprints/v2/blueprints-101/how-it-works).
3. Learn the three [resource and path namespaces](/blueprints/v2/resources).
4. Review [security and reproducibility](/blueprints/v2/security) before running third-party
   declarations or applying one to valuable data.
5. Use the [schema reference](/blueprints/v2/reference/schema) for exact fields and the
   [troubleshooting guide](/blueprints/v2/troubleshooting) when a run fails.
