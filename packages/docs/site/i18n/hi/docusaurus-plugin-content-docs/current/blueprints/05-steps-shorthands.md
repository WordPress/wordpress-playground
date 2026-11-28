---
slug: /blueprints/steps/shorthands
description: login, plugins और siteOptions जैसे आम ब्लूप्रिंट स्टेप के शॉर्टहैंड सिंटैक्स की गाइड, जिससे कोड छोटा और साफ़ रहता है।
---

<!-- # Shorthands -->

# शॉर्टहैंड

<!-- You can specify some `steps` using a `shorthand` syntax. The following `steps` are currently supported: -->

आप कुछ `steps` को `shorthand` सिंटैक्स से भी लिख सकते हैं। फ़िलहाल ये `steps` सपोर्ट किए जाते हैं:

<!-- ### `login` -->

### `login` {#login}

<!-- Use -->

यह लिखें

```json
	"login": true,
```

<!-- Or -->

या यह

```json
{
	"step": "login",
	"username": "admin",
	"password": "password"
}
```

<!-- ### `plugins` -->

### `plugins` {#plugins}

<!-- (replaces the `installPlugin` step) -->

(`installPlugin` स्टेप की जगह लेता है)

<!-- Use -->

यह लिखें

```json
	"plugins": [
		"hello-dolly",
		"https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
	]
```

<!-- Or -->

या यह

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

### `siteOptions` {#siteoptions}

<!-- Use -->

यह लिखें

```json
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
```

<!-- Or -->

या यह

```json
	"step": "setSiteOptions",
	"options": {
		"blogname": "My first Blueprint"
	}
```

<!-- ### `defineWpConfigConsts` -->

### `defineWpConfigConsts` {#definewpconfigconsts}

<!-- (`constants` only) -->

(सिर्फ़ `constants`)

<!-- Use -->

यह लिखें

```json
	"constants": {
		"WP_DISABLE_FATAL_ERROR_HANDLER": true,
		"WP_DEBUG": true,
		"WP_DEBUG_DISPLAY": true
	}
```

<!-- Or -->

या यह

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

`shorthand` सिंटैक्स और `step` सिंटैक्स एक दूसरे से मेल खाते हैं। `shorthand` सिंटैक्स से लिखा गया हर `step`, `steps` ऐरे की शुरुआत में किसी भी क्रम में जोड़ दिया जाता है।

<div class="callout callout-info">

<!--
**Which should you choose?**

- Use `shorthands` when **brevity** is your main concern.
- Use explicit `steps` when you need more control over the **execution order**.
-->

**आपको कौन सा चुनना चाहिए?**

- जब **कम शब्दों में लिखना** आपकी मुख्य ज़रूरत हो, तो `shorthands` इस्तेमाल करें।
- जब आपको **चलने के क्रम** पर ज़्यादा नियंत्रण चाहिए, तो साफ़ तौर पर लिखे गए `steps` इस्तेमाल करें।

</div>
