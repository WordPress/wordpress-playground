---
title: Pagsisimula
slug: /blueprints/getting-started
description: Isang mabilis na gabay sa mga Blueprint. Unawain kung anong mga problema ang kanilang nalulutas at ang iba't ibang paraan kung paano mo sila magagamit.
---

# Pagsisimula sa mga Blueprint

Ang mga Blueprint ay mga JSON file para sa pag-setup ng iyong sariling WordPress Playground instance. Halimbawa:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}
```

May tatlong paraan para gamitin ang mga Blueprint:

-   [I-paste ang Blueprint sa URL "fragment" sa WordPress Playground website](/blueprints/using-blueprints#url-fragment).
-   [Gamitin sila sa JavaScript API](/blueprints/using-blueprints#javascript-api).
-   [I-reference ang blueprint JSON file sa pamamagitan ng QueryParam blueprint-url](/developers/apis/query-api/)

## Anong mga problema ang nalulutas ng mga Blueprint?

### Hindi kailangan ng coding skills

Ang mga Blueprint ay JSON lang. Hindi mo kailangan ng development environment, anumang libraries, o kahit JavaScript knowledge. Maaari mong isulat sila sa anumang text editor.

Gayunpaman, kung mayroon ka ng development environment, maganda iyon! Maaari mong gamitin ang [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) para makakuha ng autocompletion at validation.

### Ang mga HTTP Request ay na-manage para sa iyo

Ang mga Blueprint ay kumukuha ng anumang resources na i-declare mo para sa iyo. Hindi mo kailangang mag-alala tungkol sa pag-manage ng maraming `fetch()` calls o paghintay na matapos sila. Maaari ka lang mag-declare ng ilang links at hayaan ang mga Blueprint na i-handle at i-optimize ang downloading pipeline.

### Maaari kang mag-link sa Blueprint-preconfigured na Playground

Dahil ang mga Blueprint ay maaaring i-paste sa URL, maaari mong i-embed o i-link ang isang Playground na may specific na configuration. Halimbawa, ang pag-click sa button na ito ay magbubukas ng Playground na may PHP 8.3 at pendant theme na na-install:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
  		"wp": "latest"
	},
	"steps": [
        {
            "step": "installTheme",
            "themeData": {
                "resource": "wordpress.org/themes",
            	"slug": "pendant"
            },
            "options": {
                "activate": true
            }
        }
	]
}} />

### Pinagkakatiwalaan by default

Ang mga Blueprint ay JSON lang. Ang pagpatakbo ng mga Blueprint ng ibang tao ay hindi nangangailangan ng element of trust. Dahil ang mga Blueprint ay hindi maaaring mag-execute ng arbitrary JavaScript, limitado sila sa kung ano ang magagawa nila.

Sa mga Blueprint, ang WordPress.org plugin directory ay maaaring makapagbigay ng live previews ng mga plugin. Ang mga plugin authors ay magsusulat lang ng custom Blueprint para i-preconfigure ang Playground instance na may anumang site options o starter content na kailangan nila.

### Isulat ito nang isang beses, gamitin kahit saan

Ang mga Blueprint ay gumagana pareho sa web at sa node.js. Maaari mong patakbuhin sila pareho sa parehong JavaScript process, at sa pamamagitan ng remote Playground Client. Sila ang universal language ng configuration. Kung saan mo maaaring patakbuhin ang Playground, doon mo magagamit ang mga Blueprint.
