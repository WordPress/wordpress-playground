---
slug: /blueprints/steps/shorthands
description: Um guia para a sintaxe abreviada para passos comuns de Blueprint como login, plugins e siteOptions para código mais conciso.
---

<!-- # Shorthands -->

# Abreviações

<!-- You can specify some `steps` using a `shorthand` syntax. The following `steps` are currently supported: -->

Você pode especificar alguns `steps` usando uma sintaxe `shorthand`. Os seguintes `steps` são atualmente suportados:

<!-- ### `login` -->

### `login`

<!-- Use -->

Use

```json
	"login": true,
```

<!-- Or -->

Ou

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

<!-- ### `plugins` -->

### `plugins`

<!-- (replaces the `installPlugin` step) -->

(substitui o passo `installPlugin`)

<!-- Use -->

Use

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

<!-- Or -->

Ou

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

<!-- ### `siteOptions` -->

### `siteOptions`

<!-- Use -->

Use

```json
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
```

<!-- Or -->

Ou

```json
	"step": "setSiteOptions",
	"options": {
		"blogname": "My first Blueprint"
	}
```

<!-- ### `defineWpConfigConsts` -->

### `defineWpConfigConsts`

<!-- (`constants` only) -->

(`constants` apenas)

<!-- Use -->

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

<!-- Or -->

Ou

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

A sintaxe `shorthand` e a sintaxe `step` correspondem uma à outra. Cada `step` especificado com a sintaxe `shorthand` é adicionado ao topo do array `steps` em ordem arbitrária.

<!-- :::info **Which should you choose?** -->

:::info **Qual você deve escolher?**

<!-- -   Use `shorthands` when **brevity** is your main concern. -->
<!-- -   Use explicit `steps` when you need more control over the **execution order**. -->

-   Use `shorthands` quando **brevidade** é sua principal preocupação.
-   Use `steps` explícitos quando você precisa de mais controle sobre a **ordem de execução**.

:::
