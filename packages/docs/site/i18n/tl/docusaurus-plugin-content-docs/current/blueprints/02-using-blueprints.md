---
title: Paggamit ng Blueprint
slug: /blueprints/using-blueprints
---

# Paggamit ng Blueprint

Maaari mong gamitin ang Blueprint sa isa sa mga sumusunod na paraan.

-   Ibigay ito bilang URL fragment sa Playground.
-   I-load mula sa URL gamit ang `blueprint-url` na parameter.
-   Gumamit ng Blueprint bundle (ZIP file o directory).
-   Gumamit ng JavaScript API.

## URL Fragment

Ang pinakamadaling paraan para magsimula ay i-paste ang Blueprint sa URL "fragment" ng WordPress Playground website (hal. `https://playground.wordpress.net/#{"preferredVersions...`).

Halimbawa, para gumawa ng Playground na may partikular na bersyon ng WordPress at PHP, gamitin ang sumusunod na Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	}
}
```

Pagkatapos, pumunta sa `https://playground.wordpress.net/#{"preferredVersions":{"php":"7.4","wp":"6.5"}}`.

Hindi mo kailangang i-paste ang link. Kapag nag-click ka ng "Subukan", awtomatikong tatakbo ang code example.

### Base64 na naka-encode na Blueprint

Sa ilang mga tool tulad ng GitHub, maaaring hindi tama ang pag-format ng Blueprint kapag ipinaste sa URL. Sa ganitong kaso, i-encode ang Blueprint sa Base64 at idagdag ito sa URL. Halimbawa, ang Blueprint sa itaas ay ganito ang hitsura sa Base64: `eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19`.

Para patakbuhin ito, pumunta sa https://playground.wordpress.net/#eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19

:::tip
Sa JavaScript, maaari mong gamitin ang global function na `btoa()` para makuha ang anumang Blueprint JSON sa [Base64 format](https://developer.mozilla.org/en-US/docs/Glossary/Base64#javascript_support).

Halimbawa:

```js
const blueprintJson = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	}
}`;
const minifiedBlueprintJson = btoa(blueprintJson); // eyIkc2NoZW1hIjogImh0dHBzOi8vcGxheWdyb3VuZC53b3JkcHJlc3MubmV0L2JsdWVwcmludC1zY2hlbWEuanNvbiIsInByZWZlcnJlZFZlcnNpb25zIjogeyJwaHAiOiAiNy40Iiwid3AiOiAiNi41In19
```

:::

### I-load ang Blueprint mula sa URL

Kapag masyado nang mahaba ang iyong Blueprint, maaari mo itong i-load gamit ang `?blueprint-url` query parameter sa URL, ganito:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/adamziel/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Tandaan na ang Blueprint ay dapat publicly accessible at may [tamang `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```

#### Blueprint Bundle

Sinusuportahan na rin ng `?blueprint-url` parameter ang Blueprint bundles sa ZIP format. Ang Blueprint bundle ay isang ZIP file na may `blueprint.json` sa root at iba pang resources na tinutukoy ng Blueprint.

Halimbawa, maaari kang mag-load ng Blueprint bundle ng ganito:

[https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip](https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip)

Kapag gumagamit ng Blueprint bundle, maaari mong i-refer ang bundled resources gamit ang resource type na `bundled`:

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

Para sa karagdagang impormasyon tungkol sa Blueprint bundles, tingnan ang [Blueprint Bundles](/blueprints/bundles) na dokumentasyon.

## JavaScript API

Maaari mo ring gamitin ang Blueprints sa JavaScript API gamit ang `startPlaygroundWeb()` function mula sa `@wp-playground/client` package. Narito ang isang maliit na halimbawa na maaari mong patakbuhin sa JSFiddle o CodePen:
