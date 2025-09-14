---
title: Paano patakbuhin ang mga Blueprint
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: Alamin ang iba't ibang paraan para gamitin ang mga blueprint
---

# Paano mag-load at patakbuhin ang mga Blueprint

## URL fragment

Ang pinakamabilis na paraan para patakbuhin ang mga Blueprint ay i-paste ang isa sa URL "fragment" ng WordPress Playground website. Magdagdag lang ng `#` pagkatapos ng `.net/`.

Sabihin nating gusto mong gumawa ng Playground na may specific na mga version ng WordPress at PHP gamit ang sumusunod na Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

Para patakbuhin ito, pumunta sa `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. Maaari mo ring gamitin ang button sa ibaba:

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

Gamitin ang method na ito para patakbuhin ang example code sa susunod na chapter, [**Gumawa ng unang Blueprint**](/blueprints/tutorial/build-your-first-blueprint).

### Base64 encoded na mga Blueprint

Ang ilang tool, kasama ang GitHub, ay maaaring hindi ma-format nang tama ang Blueprint kapag na-paste sa URL. Sa ganitong mga kaso, [i-encode ang iyong Blueprint sa Base64](https://www.base64encode.org) at i-append ito sa URL. Halimbawa, iyon ang Blueprint sa itaas sa Base64 format: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

Para patakbuhin ito, pumunta sa [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)

### Mag-load ng Blueprint mula sa URL

Kapag ang iyong Blueprint ay naging masyadong malaki, maaari mong i-load ito sa pamamagitan ng `?blueprint-url` query parameter sa URL, tulad nito:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Tandaan na ang Blueprint ay dapat na publicly accessible at na-serve gamit ang [tamang `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```
