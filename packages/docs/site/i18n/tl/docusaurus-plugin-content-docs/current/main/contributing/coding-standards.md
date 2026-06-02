---
slug: /contributing/coding-standards
---

# Mga Prinsipyo sa Pag-coding

## Mga Mensahe ng Error

Ang isang mahusay na mensahe ng error ay nagsasabi sa user kung ano ang susunod na gagawin. Anumang kalabuan sa mga error na ibinabato ng mga public API ng Playground ay mag-uudyok sa mga developer na magbukas ng isyu.

Isaalang-alang ang isang network error halimbawa—maaari ba nating matukoy ang uri ng error at ipakita ang kaugnay na mensahe na nagbubuod ng mga susunod na hakbang?

-   **Network error**: "Nagalaw ang iyong koneksyon sa internet. Subukan i-reload ang pahina."
-   **404**: "Hindi mahanap ang file."
-   **403**: "Hinadlangan ng server ang access sa file."
-   **CORS**: ipaliwanag na ito ay isang browser security feature at magdagdag ng link sa detalyadong paliwanag (sa MDN o sa ibang maaasahang source). Iminungkahi na ilagay ng user ang kanilang file sa ibang lugar, tulad ng raw.githubusercontent.com, at mag-link sa resource na nagpapaliwanag kung paano mag-set up ng CORS headers sa kanilang server.

Awtomatikong hinahandle namin ang code formatting at linting. Mag-relax lang, mag-type, at hayaan ang mga makina ang gumawa ng trabaho.

## Public API

Layunin ng Playground na panatilihin ang pinakamakitid na saklaw ng API hangga’t maaari.

Ang mga Public API ay madaling idagdag at mahirap alisin. Kailangan lang ng isang PR upang magpakilala ng bagong API, ngunit maaaring kailanganin ng isang libo upang ito’y matanggal, lalo na kung nagamit na ito ng ibang proyekto.

-   Huwag i-expose ang hindi kailangang function, class, constant, o ibang bahagi.

## Blueprints

Ang Blueprints ang pangunahing paraan para makipag-ugnayan sa Playground. Ang mga JSON file na ito ay naglalarawan ng serye ng mga hakbang na isinasagawa ng Playground nang sunud-sunod.

### Mga Patnubay

Ang mga blueprint step ay dapat **concise at focused**. Dapat itong gawin ang isang bagay at gawin ito nang mahusay.

-   Kung kailangan mong gumawa ng bagong step, subukang i-refactor muna ang umiiral na step.
-   Kung hindi sapat iyon, tiyaking nagdadala ang bagong step ng bagong kakayahan. Huwag ulitin ang functionality ng umiiral na mga step.
-   I-assume na tatawagin ang step nang higit sa isang beses.
-   I-assume na ito’y tatakbo nang partikular na pagkakasunod-sunod.
-   Magdagdag ng unit tests upang tiyaking gumagana ito nang tama.

Ang mga Blueprints ay dapat **intuitive at straightforward**.

-   Huwag mag-require ng arguments na maaaring optional.
-   Gumamit ng simpleng argument, halimbawa `slug` sa halip na `path`.
-   Mag-define ng constants sa virtual JSON files—huwag baguhin ang PHP files.
-   Mag-define ng TypeScript type para sa Blueprint. Ganoon gumagawa ang Playground ng JSON schema nito.
-   Sumulat ng function para hawakan ang isang Blueprint step. Tanggapin ang argumentong nasa type na iyong dinefine.
-   Magbigay ng usage example sa doc string. Awtomatikong naipapakita iyon sa docs.
