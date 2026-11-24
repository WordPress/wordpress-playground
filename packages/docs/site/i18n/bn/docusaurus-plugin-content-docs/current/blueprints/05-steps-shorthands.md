---
slug: /blueprints/steps/shorthands
description: আরও সংক্ষিপ্ত কোডের জন্য login, plugins এবং siteOptions এর মতো সাধারণ ব্লুপ্রিন্ট স্টেপের জন্য শর্টহ্যান্ড সিনট্যাক্সের একটি গাইড।
---

<!--
# Shorthands
-->

# শর্টহ্যান্ড

<!--
You can specify some `steps` using a `shorthand` syntax. The following `steps` are currently supported:
-->

আপনি `shorthand` সিনট্যাক্স ব্যবহার করে কিছু `steps` নির্দিষ্ট করতে পারেন। নিম্নলিখিত `steps` বর্তমানে সমর্থিত:

### `login`

<!--
Use
-->

ব্যবহার করুন

```json
	"login": true,
```

<!--
Or
-->

অথবা

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

### `plugins`

<!--
(replaces the `installPlugin` step)
-->

(`installPlugin` স্টেপ প্রতিস্থাপন করে)

<!--
Use
-->

ব্যবহার করুন

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

<!--
Or
-->

অথবা

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

<!--
Use
-->

ব্যবহার করুন

```json
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
```

<!--
Or
-->

অথবা

```json
	"step": "setSiteOptions",
	"options": {
		"blogname": "My first Blueprint"
	}
```

### `defineWpConfigConsts`

<!--
(`constants` only)
-->

(শুধুমাত্র `constants`)

<!--
Use
-->

ব্যবহার করুন

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

<!--
Or
-->

অথবা

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

<!--
The `shorthand` syntax and the `step` syntax correspond to each other. Every `step` specified with the `shorthand` syntax is added to the top of the `steps` array in arbitrary order.
-->

`shorthand` সিনট্যাক্স এবং `step` সিনট্যাক্স একে অপরের সাথে সম্পর্কিত। `shorthand` সিনট্যাক্স দিয়ে নির্দিষ্ট করা প্রতিটি `step` নির্বিচার ক্রমে `steps` অ্যারের শীর্ষে যোগ করা হয়।

:::info

<!--
**Which should you choose?**
-->

**আপনার কোনটি বেছে নেওয়া উচিত?**

<!--
- Use `shorthands` when **brevity** is your main concern.
- Use explicit `steps` when you need more control over the **execution order**.
-->

-   **সংক্ষিপ্ততা** আপনার প্রধান উদ্বেগ হলে `shorthands` ব্যবহার করুন।
-   **এক্সিকিউশন ক্রমের** উপর আরও নিয়ন্ত্রণ প্রয়োজন হলে স্পষ্ট `steps` ব্যবহার করুন।

:::
