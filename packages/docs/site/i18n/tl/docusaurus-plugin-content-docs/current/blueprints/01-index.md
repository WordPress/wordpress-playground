---
title: Magsimula
slug: /blueprints/getting-started
---

# Magsimula sa paggamit ng Mga Blueprint

Ang mga Blueprint ay mga JSON file para i-setup ang iyong sariling WordPress Playground instance. Halimbawa:

Mayroong tatlong paraan para gamitin ang Mga Blueprint:

-   [Idikit ang Blueprint sa URL fragment ng WordPress Playground website](/blueprints/using-blueprints#url-fragment)

-   [Gamitin ito sa JavaScript API](/blueprints/using-blueprints#javascript-api)

-   [I-referensya ang JSON file ng Blueprint gamit ang QueryParam `blueprint-url`](/developers/apis/query-api/)

## Anong mga problema ang nalulutas ng Mga Blueprint?

### Hindi Kailangan ng Kasanayang Coding

Ang Mga Blueprint ay nakasulat sa format na JSON. Hindi mo kailangan ng development environment, anumang library, o kahit kaalaman sa JavaScript. Maaari mo itong isulat sa kahit anong text editor.

Subalit, kung mayroon kang development environment, maganda iyon. Maaari mong gamitin ang [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) para sa autocomplete at validation.

### Awtomatikong Pinamamahalaan ang HTTP Requests

Awtomatikong kino-consume ng Blueprint ang anumang resources na ideklara mo. Hindi mo na kailangang pamahalaan ang maraming `fetch()` calls o hintayin silang matapos. I-declare lang ang ilang links at ang Blueprint na ang bahala sa pag-download at pag-optimize.

### Maaaring Mag-link sa Preconfigured Playground gamit ang Blueprint

Dahil puwedeng idikit ang Blueprint sa URL, maaari mong i-embed o i-link ang isang Playground na may partikular na configuration. Halimbawa, kapag kinlik mo ang button na ito, magbubukas ng Playground na may PHP 7.4 at naka-install ang pendant theme:

### Pinagkakatiwalaan Nang Default

Ang mga Blueprint ay simpleng JSON. Hindi kailangan ng tiwala para patakbuhin ang Blueprint ng iba. Dahil hindi ito nakakapag-execute ng arbitrary JavaScript, limitado ang kaya nitong gawin.

### Isusulat Isang Beses at Magagamit Kahit Saan

Gumagana ang mga Blueprint sa web at sa Node.js. Maaari mo itong patakbuhin sa parehong JavaScript process o sa pamamagitan ng remote Playground client. Universal na wika ng configuration ang Mga Blueprint: kung saan mo man patakbuhin ang Playground, gagana rin ang Blueprint.
