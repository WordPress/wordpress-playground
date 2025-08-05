---
slug: /contributing/code
---

# Mga Kontribusyon sa Code

Tulad ng lahat ng WordPress projects, ginagamit ng Playground ang GitHub para pamahalaan ang code at subaybayan ang mga isyu. Ang pangunahing repositorya ay matatagpuan sa [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) at ang Playground Tools repositorya ay nasa [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).

:::info Mag-ambag sa Playground Tools

Kasama sa gabay na ito ang mga link sa pangunahing repositorya, ngunit ang lahat ng hakbang at opsyon ay magagamit din para sa Playground Tools. Kung interesado ka sa mga plugin o lokal na development tools—simulan mo doon.

:::

I-browse ang [listahan ng mga bukas na isyu](https://github.com/wordpress/wordpress-playground/issues) upang makita kung saan ka maaaring magtrabaho. Ang label na [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) ay inirerekomendang panimulang punto para sa mga unang beses na kontribyutor.

Siguraduhing suriin ang mga sumusunod na resources bago ka magsimula:

-   [Mga prinsipyo sa Coding](/contributing/coding-standards)
-   [Arkitektura](/developers/architecture)
-   [Bisyon at Pilosopiya](https://github.com/WordPress/wordpress-playground/issues/472)
-   [Roadmap ng WordPress Playground](https://github.com/WordPress/wordpress-playground/issues/525)

## Mag-ambag ng Pull Request

[I-fork ang Playground repository](https://github.com/WordPress/wordpress-playground/fork) at i-clone ito sa iyong local machine. Upang gawin ito, kopyahin at i-paste ang mga utos na ito sa iyong terminal:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

Gumawa ng bagong branch, gumawa ng mga pagbabago, at i-test ito nang lokal sa pamamagitan ng pag-run ng sumusunod:

```bash
npm run dev
```

Magbubukas ang Playground sa bagong browser tab at awtomatikong magre-refresh sa bawat pagbabago.

Kapag handa ka na, i-commit ang mga pagbabago at mag-submit ng Pull Request.

:::info Pag-format

Awtomatikong hinahandle ang code formatting at linting. Mag-relax ka lang, mag-type lang, at hayaan ang makina ang gumalaw.

:::

### Pagpapatakbo ng lokal na Multisite

May ilang [restriksyon kapag nagpapatakbo ng Multisite nang lokal](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). Kung balak mong i-test ang Multisite network gamit ang `enableMultisite` step ng Playground, siguraduhing babaguhin mo ang default na port ng `wp-now` o mag-set ng lokal na test domain na tumatakbo sa HTTPS.

Upang baguhin ang default na port ng `wp-now` sa suportadong port ng WordPress Multisite, patakbuhin ito gamit ang flag na `--port=80`:

```bash
npx @wp-now/wp-now start --port=80
```

May ilang paraan upang mag-set up ng lokal na test domain, kabilang ang pag-edit ng iyong `hosts` file. Kung hindi ka sigurado kung paano gawin iyon, inirerekomenda naming i-install ang [Laravel Valet](https://laravel.com/docs/11.x/valet) at patakbuhin ang sumusunod:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

Ngayon ay maa-access ang iyong dev server sa https://playground.test.

## Debugging

### Paggamit ng VS Code at Chrome

Kung gumagamit ka ng VS Code at naka-install ang Chrome, maaari mong i-debug ang Playground sa code editor:

-   Buksan ang project folder sa VS Code.
-   Piliin ang Run > Start Debugging mula sa main menu o pindutin ang `F5`/`fn`+`F5`.

### Debugging PHP

Ina-log ng Playground ang PHP errors sa browser console pagkatapos ng bawat PHP request.
