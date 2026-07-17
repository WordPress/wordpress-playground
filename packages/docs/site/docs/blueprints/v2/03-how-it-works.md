---
title: How Blueprints v2 works
slug: /blueprints/v2/how-it-works
description: Understand Blueprint v2 desired state, execution targets, fixed declaration order, and imperative tail steps.
---

# How Blueprints v2 works

V2 separates three decisions that v1 often mixed together:

1. **Site and runtime declaration** — the JSON describes WordPress, PHP,
   plugins, themes, options, users, and content.
2. **Execution target and site mode** — the website, CLI, or JavaScript host
   decides where to run it and whether to create or modify a site.
3. **Imperative tail** — `additionalStepsAfterExecution` handles the operations
   that cannot be expressed as desired state.

## From JSON to a running site

Playground processes a v2 declaration in phases:

1. Parse the JSON and select v2 from exact numeric `version: 2`.
2. Validate the schema and cross-field invariants.
3. Resolve compatible WordPress and PHP runtime versions.
4. Compile the declaration into an ordered execution plan.
5. Resolve remote, bundled, inline, and target-site resources.
6. Execute each plan item sequentially.
7. Apply Playground-only actions such as final navigation.

A runner may prefetch independent resource downloads concurrently after the
plan is compiled. Mutations to the target still execute in plan order.

A failure stops the remaining plan. There is no transactional rollback, so
earlier changes may remain on the target. This matters most when applying a
declaration to an [existing site](./apply-to-existing-site).

## Declaration order is fixed

JSON object-property order does not control execution. Playground emits the
following plan:

1. `contentBaseline`
2. `usersBaseline`
3. `constants`
4. `siteOptions`
5. `muPlugins`
6. `themes`
7. `activeTheme`
8. `plugins`
9. `fonts`
10. `media`
11. `siteLanguage`
12. `roles`
13. `users`
14. `postTypes`
15. `content`
16. `additionalStepsAfterExecution`

Items within an array retain their declared order. For example, plugins are
installed in array order. Moving `plugins` above `siteOptions` in the JSON does
not make plugin installation happen first.

Playground prepares an application login before this plan and navigates to the
declared landing page after it. Treat those as host actions, not declaration
stages.

## Prefer declaration over ordered steps

This expresses a plugin and site option as desired state:

```json blueprint-v2
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
	"plugins": ["query-monitor"],
	"siteOptions": {
		"blogname": "Debug site"
	}
}
```

Use `additionalStepsAfterExecution` only when exact ordering or an imperative
operation is essential:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/",
			"login": false
		}
	},
	"phpVersion": "8.3",
	"additionalStepsAfterExecution": [
		{
			"step": "runPHP",
			"code": {
				"filename": "after.php",
				"content": "<?php require '/wordpress/wp-load.php'; update_option('setup_complete', true);"
			}
		}
	]
}
```

V2 tail steps use v2 shapes. A `runPHP` program is a file reference such as the
inline `{ filename, content }` object above; it is not a raw string as it was in
v1.

## New site, existing site, and PHP-only modes

The host chooses the site mode:

- **Create a new site** installs WordPress and may apply `contentBaseline` and
  `usersBaseline` to the vanilla installation.
- **Apply to an existing site** uses mounted or saved WordPress files. Baselines
  are skipped so they cannot erase the site's existing content or users.
- **PHP without WordPress** is selected in the declaration with
  `"wordpressVersion": "none"`. Keep these declarations to PHP and filesystem
  operations; not every WordPress-dependent combination is rejected before
  execution yet.

Use an object WordPress constraint such as `{ "min": "6.8", "max": "6.9" }`
when an existing site must be rejected outside a compatibility range. A string
WordPress version selects a new-site version but does not constrain an existing
site.

## Resources are resolved in context

The same-looking path can name different data depending on its prefix:

- `https://...` downloads remote data.
- `./assets/file.zip` and `/assets/file.zip` read from the Blueprint execution
  context rooted beside `blueprint.json`.
- `site:wp-content/...` reads mutable data from the target WordPress site when
  that plan item runs.

See [data sources, paths, and bundles](./resources) before moving v1 resource
objects or local files into v2.
