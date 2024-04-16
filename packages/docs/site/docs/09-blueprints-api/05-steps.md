---
sidebar_position: 3
---

# Steps

The `steps` property of a Blueprint is an array of steps to run. For example this Blueprint logs the user in as an admin:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}} />

Each step is an object that contains a `step` property that specifies the type of step to run. The rest of the properties depend on the type of step. Learn and try each step type below.

## Shorthands

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

(replaces `InstallPluginStep`)

Use

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

Or

```json
	{
		"step": "installPlugin",
		"pluginZipFile": {
			"resource": "wordpress.org/plugins",
			"slug": "hello-dolly"
		}
	},
	{
		"step": "installPlugin",
 		"pluginZipFile": {
			"resource": "url",
			"url": "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
    }
	}
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

:::info **Which should you choose?**

-   Use `shorthands` when **brevity** is your main concern.
-   Use explicit `steps` when you need more control over the **execution order**.

:::

---

import BlueprintStep from '@site/src/components/BlueprintsAPI/BlueprintStep';
import { BlueprintSteps } from '@site/src/components/BlueprintsAPI/model';
import UpdateTopLevelToc from '@site/src/components/UpdateTopLevelToc';

<UpdateTopLevelToc
toc={toc}
tocItems={
BlueprintSteps
.map(name => ({
value: name,
id: name,
level: 2
}))
} />

<span>
	{BlueprintSteps.map((name) => (
		<>
			<BlueprintStep name={name} key={name} />
			<hr/>
		</>
	))}
</span>
