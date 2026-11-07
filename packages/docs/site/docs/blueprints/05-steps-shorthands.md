---
title: Shorthands (v1 legacy)
slug: /blueprints/steps/shorthands
description: Legacy Blueprint v1 documentation. A guide to the shorthand syntax for common Blueprint steps like login, plugins, and siteOptions for more concise code.
---

# Shorthands

<div class="callout callout-warning">

**Blueprint v1 (legacy)**

This page documents Blueprint v1. Current Playground runners still accept v1 Blueprints,
but new work should use [Blueprint v2](/blueprints/v2). See
[Migrate from v1](/blueprints/v2/migrate-from-v1) to update an existing Blueprint.

</div>

You can specify some `steps` using a `shorthand` syntax. The following `steps` are currently supported:

### `login`

Use

```json
	"login": true,
```

Or

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

### `plugins`

(replaces the `installPlugin` step)

Use

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

Or

```json
[
	{
		"step": "installPlugin",
		"pluginData": {
			"resource": "wordpress.org/plugins",
			"slug": "hello-dolly"
		}
	},
	{
		"step": "installPlugin",
		"pluginData": {
			"resource": "url",
			"url": "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
		}
	}
]
```

### `siteOptions`

Use

```json
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
```

Or

```json
	"step": "setSiteOptions",
	"options": {
		"blogname": "My first Blueprint"
	}
```

### `defineWpConfigConsts`

(`constants` only)

Use

```json
{
	"step": "defineWpConfigConsts",
	"consts": {
		"WP_DISABLE_FATAL_ERROR_HANDLER": true,
		"WP_DEBUG": true,
		"WP_DEBUG_DISPLAY": true
	}
}
```

Or

```json
	{
		"step": "defineWpConfigConsts",
		"consts": {
			"WP_DISABLE_FATAL_ERROR_HANDLER": true
		}
	},
	{
		"step": "defineWpConfigConsts",
		"consts": {
			"WP_DEBUG": true
		}
	},
	{
		"step": "defineWpConfigConsts",
		"consts": {
			"WP_DEBUG_DISPLAY": true
		}
	}
```

---

The `shorthand` syntax and the `step` syntax correspond to each other. Every `step` specified with the `shorthand` syntax is added to the top of the `steps` array in arbitrary order.

<div class="callout callout-info">

**Which should you choose?**

- Use `shorthands` when **brevity** is your main concern.
- Use explicit `steps` when you need more control over the **execution order**.

</div>
