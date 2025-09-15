---
title: Shorthands
slug: /blueprints/steps/shorthands
description: Isang gabay sa shorthand syntax para sa mga karaniwang Blueprint steps tulad ng login, plugins, at siteOptions para sa mas maikling code.
---

<!-- # Shorthands -->

# Mga Shorthand

<!-- You can specify some `steps` using a `shorthand` syntax. The following `steps` are currently supported: -->

Maaari mong tukuyin ang ilang `steps` gamit ang `shorthand` syntax. Ang mga sumusunod na `steps` ay kasalukuyang sinusuportahan:

### `login`

<!-- Use -->

Gamitin ang

```json
	"login": true,
```

<!-- Or -->

O

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

### `plugins`

<!-- (replaces the `installPlugin` step) -->

(pinapalitan ang `installPlugin` step)

<!-- Use -->

Gamitin ang

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

<!-- Or -->

O

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

<!-- Use -->

Gamitin ang

```json
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
```

<!-- Or -->

O

```json
	"step": "setSiteOptions",
	"options": {
		"blogname": "My first Blueprint"
	}
```

### `defineWpConfigConsts`

<!-- (`constants` only) -->

(`constants` lamang)

<!-- Use -->

Gamitin ang

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

<!-- Or -->

O

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

<!-- The `shorthand` syntax and the `step` syntax correspond to each other. Every `step` specified with the `shorthand` syntax is added to the top of the `steps` array in arbitrary order. -->

Ang `shorthand` syntax at ang `step` syntax ay tumutugma sa isa't isa. Ang bawat `step` na tinukoy gamit ang `shorthand` syntax ay idinagdag sa tuktok ng `steps` array sa arbitrary order.

:::info <!-- **Which should you choose?** -->
**Alin ang dapat mong piliin?**

<!-- -   Use `shorthands` when **brevity** is your main concern. -->

-   Gamitin ang `shorthands` kapag ang **kakulangan** ang iyong pangunahing alalahanin.
<!-- -   Use explicit `steps` when you need more control over the **execution order**. -->
-   Gamitin ang explicit `steps` kapag kailangan mo ng mas maraming kontrol sa **execution order**.

:::
