---
slug: /blueprints/steps/shorthands
description: আরও সংক্ষিপ্ত কোডের জন্য login, plugins এবং siteOptions এর মতো সাধারণ ব্লুপ্রিন্ট স্টেপের জন্য শর্টহ্যান্ড সিনট্যাক্সের একটি গাইড।
---

# শর্টহ্যান্ড

আপনি `shorthand` সিনট্যাক্স ব্যবহার করে কিছু `steps` নির্দিষ্ট করতে পারেন। নিম্নলিখিত `steps` বর্তমানে সমর্থিত:

### `login`

ব্যবহার করুন

```json
	"login": true,
```

অথবা

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

### `plugins`

(`installPlugin` স্টেপ প্রতিস্থাপন করে)

ব্যবহার করুন

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

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

ব্যবহার করুন

```json
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
```

অথবা

```json
	"step": "setSiteOptions",
	"options": {
		"blogname": "My first Blueprint"
	}
```

### `defineWpConfigConsts`

(শুধুমাত্র `constants`)

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

`shorthand` সিনট্যাক্স এবং `step` সিনট্যাক্স একে অপরের সাথে সম্পর্কিত। `shorthand` সিনট্যাক্স দিয়ে নির্দিষ্ট করা প্রতিটি `step` নির্বিচার ক্রমে `steps` অ্যারের শীর্ষে যোগ করা হয়।

:::info **আপনার কোনটি বেছে নেওয়া উচিত?**

-   **সংক্ষিপ্ততা** আপনার প্রধান উদ্বেগ হলে `shorthands` ব্যবহার করুন।
-   **এক্সিকিউশন ক্রমের** উপর আরও নিয়ন্ত্রণ প্রয়োজন হলে স্পষ্ট `steps` ব্যবহার করুন।

:::
