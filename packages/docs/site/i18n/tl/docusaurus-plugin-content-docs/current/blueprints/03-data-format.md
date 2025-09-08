---
sidebar_position: 1
title: Blueprint Data Format
slug: /blueprints/data-format
description: Isang overview ng Blueprint data format. Matuto tungkol sa mga key properties tulad ng landingPage, preferredVersions, at steps.
---

# Blueprint data format

Ang isang Blueprint JSON file ay maaaring magkaroon ng maraming iba't ibang properties na gagamitin para i-define ang iyong Playground instance. Ang mga pinakamahalagang properties ay detalyado sa ibaba.

Narito ang isang halimbawa na gumagamit ng marami sa kanila:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
	},
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}} />

## JSON schema

Ang mga JSON file ay maaaring maging tedious na isulat at madaling magkamali. Para matulungan iyon, ang Playground ay nagbibigay ng [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file na maaari mong gamitin para makakuha ng auto-completion at validation sa iyong editor. I-set lang ang `$schema` property sa sumusunod:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

## Landing page

Ang `landingPage` property ay nagsasabi sa Playground kung aling URL ang dapat puntahan pagkatapos na ma-run ang Blueprint. Ito ay isang magandang tool, lalo na kapag gumagawa ng theme o plugin demos. Madalas, gusto mong simulan ang Playground sa Site Editor o magkaroon ng specific na post na bukas sa Post Editor. Siguraduhing gumamit ka ng relative path.

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

## Preferred versions

Ang `preferredVersions` property ay nagde-declare ng iyong preferred na PHP at WordPress versions. Maaari itong maglalaman ng sumusunod na properties:

-   `php` (string): Naglo-load ng specified na PHP version. Tumatanggap ng `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, o `latest`. Ang mga minor versions tulad ng `7.4.1` ay hindi supported.
-   `wp` (string): Naglo-load ng specified na WordPress version. Tumatanggap ng huling anim na major WordPress versions. Simula September 1, 2025, iyon ay `6.3`, `6.4`, `6.5`, `6.6`, `6.7` o `6.8`. Maaari mo ring gamitin ang generic values na `latest`, `nightly`, o `beta`. Para gumamit ng pre-release version ng WordPress, ang `beta` ay maglo-load ng latest beta o release candidate versions ng isang release cycle (Beta o RC).

```js
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.7"
	},
}
```

## Mga Features

Maaari mong gamitin ang `features` property para i-on o i-off ang ilang features ng Playground instance. Maaari itong maglalaman ng sumusunod na properties:

-   `networking`: Defaults sa `true`. Pinapagana o pinapatay ang networking support para sa Playground. Kung enabled, ang [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) at mga katulad na WordPress functions ay talagang gagamit ng `fetch()` para gumawa ng HTTP requests. Kung disabled, sila ay agad na magfa-fail. Kailangan mo ng property na ito na enabled kung gusto mong magkaroon ng kakayahan ang user na mag-install ng mga plugin o theme.

```js
{
	"features": {
		"networking": false
	},
}
```

## Karagdagang mga libraries

Maaari mong i-preload ang mga extra libraries sa Playground instance. Ang sumusunod na libraries ay supported:

-   `wp-cli`: Pinapagana ang WP-CLI support para sa Playground. Kung included, ang WP-CLI ay ma-i-install during boot. Kung hindi included, makakakuha ka ng error message kapag sinubukan mong patakbuhin ang WP-CLI commands gamit ang JS API. Ang WP-CLI ay ma-i-install by default kung ang blueprint ay naglalaman ng anumang `wp-cli` steps.

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

## Steps

Maaaring ang pinakamakapangyarihang property, ang `steps` ay nagpapahintulot sa iyo na i-configure ang Playground instance na may preinstalled themes, plugins, demo content, at marami pa. Ang sumusunod na halimbawa ay naglo-log sa user gamit ang dedicated username at password. Pagkatapos ay nag-i-install at nag-a-activate ng Gutenberg plugin. [Matuto pa tungkol sa mga steps](/blueprints/steps).

```js
{
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		},
	]
}
```
