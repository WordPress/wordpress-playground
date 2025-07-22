---
slug: /blueprints/steps/shorthands
---

# ショートハンド

<!--
# Shorthands
-->

`shorthand` 構文を使用して、いくつかの `steps` を指定できます。現在、以下の `steps` がサポートされています。

<!--
You can specify some `steps` using a `shorthand` syntax. The following `steps` are currently supported:
-->

### `login`

使い方

<!--
Use
-->

```json
	"login": true,
```

または

<!--
Or
-->

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

### `plugins`

(`installPlugin` ステップを置き換えます)

<!--
(replaces the `installPlugin` step)
-->

使い方

<!--
Use
-->

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

または

<!--
Or
-->

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

使い方

<!--
Use
-->

```json
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
```

または

<!--
Or
-->

```json
	"step": "setSiteOptions",
	"options": {
		"blogname": "My first Blueprint"
	}
```

### `defineWpConfigConsts`

（`constants`のみ）

<!--
(`constants` only)
-->

使い方

<!--
Use
-->

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

または

<!--
Or
-->

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

`shorthand` 構文と `step` 構文は互いに対応しています。`shorthand` 構文で指定されたすべての `step` は、任意の順序で `steps` 配列の先頭に追加されます。

<!--
The `shorthand` syntax and the `step` syntax correspond to each other. Every `step` specified with the `shorthand` syntax is added to the top of the `steps` array in arbitrary order.
-->

:::info **どちらを選ぶべきですか？**

-   **簡潔さ** を重視する場合は、`shorthands` を使用します。
-   **実行順序** をより細かく制御する必要がある場合は、明示的な `steps` を使用します。

:::

<!--
:::info **Which should you choose?**

-   Use `shorthands` when **brevity** is your main concern.
-   Use explicit `steps` when you need more control over the **execution order**.

:::
-->
