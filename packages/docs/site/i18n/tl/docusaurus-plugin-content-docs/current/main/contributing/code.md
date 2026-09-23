---
slug: /contributing/code
title: Mga Kontribusyon sa Code
description: Gabay sa mga kontribusyon sa code, kabilang ang pag-fork ng repo, pag-set up ng lokal na environment, at pagsusumite ng pull request.
---

<!--
# Code contributions
-->

# Mga Kontribusyon sa Code

<!--
Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).
-->

Tulad ng lahat ng WordPress projects, ginagamit ng Playground ang GitHub para pamahalaan ang code at subaybayan ang mga isyu. Ang pangunahing repositorya ay matatagpuan sa [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) at ang Playground Tools repositorya ay nasa [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).

<!--
<div class="callout callout-info">

**Contribute to Playground Tools**

This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or [local development](/developers/local-development/) tools—start there.

</div>
-->

<div class="callout callout-info">

**Mag-ambag sa Playground Tools**

Kasama sa gabay na ito ang mga link sa pangunahing repositorya, ngunit ang lahat ng hakbang at opsyon ay magagamit din para sa Playground Tools. Kung interesado ka sa mga plugin o [lokal na development](/developers/local-development/) tools—simulan mo doon.

</div>

<!--
Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors.
-->

I-browse ang [listahan ng mga bukas na isyu](https://github.com/wordpress/wordpress-playground/issues) upang makita kung saan ka maaaring magtrabaho. Ang label na [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) ay inirerekomendang panimulang punto para sa mga unang beses na kontribyutor.

<!--
Be sure to review the following resources before you begin:
-->

Siguraduhing suriin ang mga sumusunod na resources bago ka magsimula:

<!--
- [Coding principles](/contributing/coding-standards)
- [Architecture](/developers/architecture)
- [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
- [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

- [Mga prinsipyo sa Coding](/contributing/coding-standards)
- [Arkitektura](/developers/architecture)
- [Bisyon at Pilosopiya](https://github.com/WordPress/wordpress-playground/issues/472)
- [Roadmap ng WordPress Playground](https://github.com/WordPress/wordpress-playground/issues/525)

<!--
## Contribute Pull Requests
-->

## Mag-ambag ng Pull Request

<!--
[Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal:
-->

[I-fork ang Playground repository](https://github.com/WordPress/wordpress-playground/fork) at i-clone ito sa iyong local machine. Upang gawin ito, kopyahin at i-paste ang mga utos na ito sa iyong terminal:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# replace `YOUR-GITHUB-USERNAME` with your GitHub username:
git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

<!--
Create a branch, make changes, and test it locally by running the following command:
-->

Gumawa ng bagong branch, gumawa ng mga pagbabago, at i-test ito nang lokal sa pamamagitan ng pag-run ng sumusunod:

```bash
npm run dev
```

<!--
Playground will open in a new browser tab and refresh automatically with each change.
-->

Magbubukas ang Playground sa bagong browser tab at awtomatikong magre-refresh sa bawat pagbabago.

<!--
<div class="callout callout-tip">

**Troubleshooting: File watcher limit on Linux**

On Linux, you might see an error like `ENOSPC: System limit for number of file watchers reached` when running `npm run dev`. This happens because the Playground repository has more files than the default system limit allows to watch.

To fix this, first check your current limit:

```bash
cat /proc/sys/fs/inotify/max_user_watches
```

If it's around 65,536 or lower, increase it by running:

```bash
sudo sysctl fs.inotify.max_user_watches=131070
sudo sysctl -p
```

Then try `npm run dev` again. This is a common issue on Debian, Ubuntu, and other Linux distributions.

</div>
-->

<div class="callout callout-tip">

**Troubleshooting: File watcher limit sa Linux**

Sa Linux, maaari kang makakita ng error tulad ng `ENOSPC: System limit for number of file watchers reached` kapag nagpapatakbo ng `npm run dev`. Nangyayari ito dahil mas maraming file ang Playground repository kaysa sa default na system limit para sa file watching.

Para ayusin ito, suriin muna ang kasalukuyang limit:

```bash
cat /proc/sys/fs/inotify/max_user_watches
```

Kung nasa 65,536 o mas mababa, taasan ito sa pamamagitan ng:

```bash
sudo sysctl fs.inotify.max_user_watches=131070
sudo sysctl -p
```

Pagkatapos, subukan ulit ang `npm run dev`. Karaniwan itong isyu sa Debian, Ubuntu, at iba pang Linux distribution.

</div>

<!--
When your'e ready, commit the changes and submit a Pull Request.
-->

Kapag handa ka na, i-commit ang mga pagbabago at mag-submit ng Pull Request.

<!--
<div class="callout callout-info">

**Formatting**

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

</div>
-->

<div class="callout callout-info">

**Pag-format**

Awtomatikong hinahandle ang code formatting at linting. Mag-relax ka lang, mag-type lang, at hayaan ang makina ang gumalaw.

</div>

<!--
### Running a local Multisite
-->

### Pagpapatakbo ng lokal na Multisite

<!--
WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change Playground CLI's default port or set a local test domain running via HTTPS.
-->

May ilang [restriksyon kapag nagpapatakbo ng Multisite nang lokal](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). Kung balak mong i-test ang Multisite network gamit ang `enableMultisite` step ng Playground, siguraduhing babaguhin mo ang default na port ng Playground CLI o mag-set ng lokal na test domain na tumatakbo sa HTTPS.

<!--
To change Playground CLI's default port to the one supported by WordPress Multisite, run it using the `--port=80` flag:
-->

Upang baguhin ang default na port ng Playground CLI sa suportadong port ng WordPress Multisite, patakbuhin ito gamit ang flag na `--port=80`:

```bash
npx @wp-playground/cli@latest start --port=80
```

<!--
There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command:
-->

May ilang paraan upang mag-set up ng lokal na test domain, kabilang ang pag-edit ng iyong `hosts` file. Kung hindi ka sigurado kung paano gawin iyon, inirerekomenda naming i-install ang [Laravel Valet](https://laravel.com/docs/11.x/valet) at patakbuhin ang sumusunod:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

<!--
Your dev server is now available on https://playground.test.
-->

Ngayon ay maa-access ang iyong dev server sa https://playground.test.

<!--
## Debugging
-->

## Debugging

<!--
### Use VS Code and Chrome
-->

### Paggamit ng VS Code at Chrome

<!--
If you're using VS Code and have Chrome installed, you can debug Playground in the code editor:
-->

Kung gumagamit ka ng VS Code at naka-install ang Chrome, maaari mong i-debug ang Playground sa code editor:

<!--
- Open the project folder in VS Code.
- Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.
-->

- Buksan ang project folder sa VS Code.
- Piliin ang Run > Start Debugging mula sa main menu o pindutin ang `F5`/`fn`+`F5`.

<!--
### Debugging PHP
-->

### Debugging PHP

<!--
Playground logs PHP errors in the browser console after every PHP request.
-->

Ina-log ng Playground ang PHP errors sa browser console pagkatapos ng bawat PHP request.
