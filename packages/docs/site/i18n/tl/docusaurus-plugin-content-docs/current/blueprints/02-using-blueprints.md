---
title: Paggamit ng mga Blueprint
slug: /blueprints/using-blueprints
description: Tuklasin ang iba't ibang paraan para gamitin ang mga Blueprint, kasama ang via URL fragment, query parameter, bundles, at ang JavaScript API.
---

# Paggamit ng mga Blueprint

Maaari mong gamitin ang mga Blueprint sa isa sa sumusunod na paraan:

-   Sa pamamagitan ng pagpasa sa kanila bilang URL fragment sa Playground.
-   Sa pamamagitan ng pag-load sa kanila mula sa URL gamit ang `blueprint-url` parameter.
-   Sa pamamagitan ng paggamit ng Blueprint bundles (ZIP files o directories).
-   Sa pamamagitan ng paggamit ng JavaScript API.

## URL Fragment

Ang pinakamadaling paraan para simulan ang paggamit ng mga Blueprint ay i-paste ang isa sa URL "fragment" sa WordPress Playground website, hal. `https://playground.wordpress.net/#{"preferredVersions...`.

Halimbawa, para gumawa ng Playground na may specific na mga version ng WordPress at PHP gagamitin mo ang sumusunod na Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}
```

At pagkatapos ay pupunta ka sa
`https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"6.5"}}`.

:::tip
Sa Javascript, maaari kang makakuha ng compact version ng anumang blueprint JSON gamit ang [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) at [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
Halimbawa:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = JSON.stringify(JSON.parse(blueprintJson)); // {"preferredVersions":{"php":"8.3","wp":"6.5"}}
```

:::

Hindi mo kailangang mag-paste ng mga link para sumabay. Gagamitin namin ang mga code example na may "Try it out" button na awtomatikong magpapatakbo ng mga halimbawa para sa iyo:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}} />

### Base64 encoded na mga Blueprint

Ang ilang tool, kasama ang GitHub, ay maaaring hindi ma-format nang tama ang Blueprint kapag na-paste sa URL. Sa ganitong mga kaso, i-encode ang iyong Blueprint sa Base64 at i-append ito sa URL. Halimbawa, iyon ang Blueprint sa itaas sa Base64 format: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

Para patakbuhin ito, pumunta sa https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

:::tip
Sa JavaScript, Maaari kang makakuha ng anumang blueprint JSON sa [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support) gamit ang global function na `btoa()`.

Halimbawa:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = btoa(blueprintJson); // eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
```

:::

### Mag-load ng Blueprint mula sa URL

Kapag ang iyong Blueprint ay naging masyadong malaki, maaari mong i-load ito sa pamamagitan ng `?blueprint-url` query parameter sa URL, tulad nito:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Tandaan na ang Blueprint ay dapat na publicly accessible at na-serve gamit ang [tamang `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```

#### Blueprint Bundles

Ang `?blueprint-url` parameter ay sumusuporta na rin sa Blueprint bundles sa ZIP format. Ang Blueprint bundle ay isang ZIP file na naglalaman ng `blueprint.json` file sa root level, kasama ang anumang karagdagang resources na na-reference ng Blueprint.

Halimbawa, maaari mong i-load ang Blueprint bundle tulad nito:

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

Kapag gumagamit ng Blueprint bundle, maaari mong i-reference ang bundled resources gamit ang `bundled` resource type:

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		}
	]
}
```

Para sa karagdagang impormasyon tungkol sa Blueprint bundles, tingnan ang [Blueprint Bundles](/blueprints/bundles) documentation.

## JavaScript API

Maaari mo ring gamitin ang mga Blueprint sa JavaScript API gamit ang `startPlaygroundWeb()` function mula sa `@wp-playground/client` package. Narito ang isang maliit, self-contained na halimbawa na maaari mong patakbuhin sa JSFiddle o CodePen:

```html
<iframe id="wp-playground" style="width: 1200px; height: 800px"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp-playground'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
		blueprint: {
			landingPage: '/wp-admin/',
			preferredVersions: {
				php: '8.3',
				wp: 'latest',
			},
			steps: [
				{
					step: 'login',
					username: 'admin',
					password: 'password',
				},
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'friends',
					},
				},
			],
		},
	});

	const response = await client.run({
		// wp-load.php ay kailangan lang kung gusto mong makipag-interact sa WordPress.
		code: '<?php require_once "/wordpress/wp-load.php"; $posts = get_posts(); echo "Post Title: " . $posts[0]->post_title;',
	});
	console.log(response.text);
</script>
```
