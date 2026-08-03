---
title: Build
slug: /about/build
description: Pagbuo gamit ang WP Playground
sidebar_class_name: navbar-build-item
---

# Build

<!--
WordPress Playground can help you to create and learn WordPress quickly, even on mobile with no signal. You can use Playground where you work best, whether that’s in the browser, Node.js, mobile apps, VS Code, or elsewhere.
-->

Makakatulong ang WordPress Playground upang mabilis kang makalikha at makapag-aral ng WordPress, kahit pa sa mobile na walang signal. Maaari mong gamitin ang Playground kung saan ka pinakamahusay na magtrabaho, maging ito man ay sa browser, Node.js, mobile apps, VS Code, o iba pa.

<!--
## Setting up a local WordPress environment quickly
-->

## Mabilis na Pag-set up ng Lokal na WordPress Environment

<!--
You can seamlessly integrate Playground into your development workflow to launch a local WordPress environment quickly for testing your code. You can do this directly [from the terminal](/developers/local-development/wp-playground-cli) or [your preferred IDE.](/developers/local-development/vscode-extension)
-->

Maaari mong i-integrate nang seamless ang Playground sa iyong development workflow upang mabilis na ilunsad ang lokal na WordPress environment para sa pag-test ng iyong code. Magagawa mo ito nang direkta [mula sa terminal](/developers/local-development/wp-now) o sa [paborito mong IDE](/developers/local-development/vscode-extension).

<!--
## Save changes done on a Block Theme and create GitHub Pull Requests
-->

## I-save ang Mga Pagbabago sa Isang Block Theme at Gumawa ng GitHub Pull Requests

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you’ve made through the WordPress UI, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin.
-->

Maaari mong ikonekta ang iyong Playground instance sa isang GitHub repository at lumikha ng Pull Request para sa mga pagbabagong ginawa mo sa pamamagitan ng WordPress UI, gamit ang [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin.

<!--
With this workflow, you could build a block theme completely in your browser and save your changes to GitHub, or you could improve/fix an existing one.
-->

Sa workflow na ito, maaari kang bumuo ng block theme nang buo sa iyong browser at i-save ang iyong mga pagbabago sa GitHub, o pagandahin/ayusin ang isang umiiral na theme.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<!--
<p></p>
Some more examples of this workflow:
-->

<p></p>
Narito ang ilan pang halimbawa ng workflow na ito:

- [Developer Hours: Creating WordPress Playground Blueprints for Testing and Demos](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s)
- [Recap Hallway Hangout: Theme Building with Playground, Create-block-theme plugin, and GitHub](https://make.wordpress.org/core/2024/06/25/recap-hallway-hangout-theme-building-with-playground-create-block-theme-plugin-and-github/)

<!--
## Synchronize your Playground with a local folder and create GitHub Pull Requests
-->

## I-sync ang Playground sa local folder at gumawa ng GitHub Pull Requests

<!--
In the Dock, click the **Autosaved** or **Unsaved** save status, select **Save
in a local directory**, click **Choose...**, and select a directory dedicated
to this Playground. After granting write access, click **Save**. Playground
copies the current site into the selected directory and overwrites files with
matching names; it does not import an existing site from that directory.
-->

Sa Dock, i-click ang **Autosaved** o **Unsaved** save status, piliin ang **Save in a
local directory**, i-click ang **Choose...**, at pumili ng directory na nakalaan sa
Playground na ito. Pagkatapos magbigay ng write access, i-click ang **Save**. Kinokopya
ng Playground ang kasalukuyang site sa napiling directory at ino-overwrite ang files na
may parehong pangalan; hindi nito ini-import ang existing site mula sa directory.

<!--
![The Store permanently pane with local-directory storage selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)
-->

![Ang Store permanently pane na may napiling local-directory storage](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-local-directory.webp)

<!--
Local-directory storage uses the File System Access API, so availability depends on browser and platform support for choosing and writing to directories. Chromium-based desktop browsers usually support it. Browsers without that capability can still use browser storage and ZIP export. See [Browser support](/developers/limitations#browser-support) for the broader compatibility model.
-->

Gumagamit ang local-directory storage ng File System Access API, kaya nakadepende sa
browser at platform ang pagpili at pagsusulat sa directories. Karaniwang sinusuportahan
ito ng Chromium-based desktop browsers. Maaari pa ring gumamit ng browser storage at ZIP
export ang ibang browser. Tingnan ang [Browser support](/developers/limitations#browser-support).

<!--
Files changed in Playground are written to the selected directory. Files changed on disk are not pulled into the running Playground automatically. For a local-directory Playground, open the **Saved** status menu in the Dock and choose **Reload files from disk** when you want Playground to read the current files from the directory.
-->

Isinusulat sa napiling directory ang files na binago sa Playground. Hindi awtomatikong
kinukuha ng tumatakbong Playground ang files na binago sa disk. Para sa local-directory
Playground, buksan ang **Saved** status menu sa Dock at piliin ang
**Reload files from disk**.

<!--
With this workflow, you can create GitHub PRs directly from changes made in your local directory.
-->

Sa workflow na ito, maaari kang gumawa ng GitHub PR mula sa mga pagbabagong ginawa sa
local directory.

<!--
See here a little demo of this workflow in action:
-->

Tingnan dito ang maikling demo ng workflow na ito sa aksyon:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<!--
## Integrate with other APIs to create new tools.
-->

## Integrasyon sa Iba Pang API para Gumawa ng Bagong Mga Tool

<!--
Playground can be combined with different APIs to create amazing tools. The possibilities are endless.
-->

Maaari mong pagsamahin ang Playground sa iba't ibang API upang lumikha ng kahanga-hangang mga tool. Walang katapusang mga posibilidad.

<!--
You can [use WordPress Playground in Node.js](/developers/local-development/php-wasm-node) to create new tools. The [@php-wasm/node package](https://npmjs.org/@php-wasm/node), which ships the PHP WebAssembly runtime, is the package used for [https://playground.wordpress.net/](https://playground.wordpress.net/), for example.
-->

Maaari mong [gamitin ang WordPress Playground sa Node.js](/developers/local-development/php-wasm-node) upang gumawa ng mga bagong tool. Ang [@php-wasm/node package](https://npmjs.org/@php-wasm/node), na nagdadala ng PHP WebAssembly runtime, ay ang package na ginagamit para sa [https://playground.wordpress.net/](https://playground.wordpress.net/), halimbawa.

<!--
Another interesting app built on top of Playground is **Translate Live** (see [example](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) which, in combination with OpenAI provides a WordPress translations tool “in place” where translations can be seen and modified in their real context (see example). Read more about this tool at [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/)
-->

Isa pang kawili-wiling app na ginawa sa ibabaw ng Playground ay ang **Translate Live** (tingnan ang [halimbawa](https://translate.wordpress.org/projects/wp-plugins/friends/dev/de/default/playground/)) na, sa kombinasyon ng Open AI, ay nagbibigay ng WordPress translations tool “in place” kung saan makikita at maayos ang mga pagsasalin sa kanilang totoong konteksto (tingnan ang halimbawa). Basahin pa tungkol sa tool na ito sa [Translate Live: Updates to the Translation Playground](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

<!--
## Work offline and as a native app
-->

## Gumana Offline at Bilang Native App

<!--
When you first visit [playground.wordpress.net](https://playground.wordpress.net/), your browser automatically caches all the necessary files to use Playground. From that point on, you can access [playground.wordpress.net](https://playground.wordpress.net/), even without an internet connection, ensuring you can continue working on your projects without interruptions.
-->

Kapag unang binisita mo ang [playground.wordpress.net](https://playground.wordpress.net/), awtomatikong kino-cache ng iyong browser ang lahat ng kinakailangang file para magamit ang Playground. Mula noon, maaari mong i-access ang [playground.wordpress.net](https://playground.wordpress.net/), kahit walang internet connection, tinitiyak na maaari kang magpatuloy sa iyong proyekto nang hindi napuputol.

<!--
You can also install Playground on your device as a Progressive Web App (PWA) to launch the Playground directly from your home screen—just like a native app.
-->

Maaari mo ring i-install ang Playground sa iyong device bilang Progressive Web App (PWA) upang ilunsad ang Playground nang direkta mula sa iyong home screen—parang native app lang.

<!--
Read [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) for more info.
-->

Basahin ang [Introducing Offline Mode and PWA Support for WordPress Playground](https://make.wordpress.org/playground/2024/08/05/offline-mode-and-pwa-support/) para sa karagdagang impormasyon.

<!--
## Embed a WordPress site in non-web environments
-->

## I-embed ang WordPress Site sa Non-Web Environments

<!--
The [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) guide shows how we can leverage Playground to wrap a WordPress site into an IOS app.
-->

Ang gabay na [How to ship a real WordPress site in a native iOS app via Playground?](../guides/wordpress-native-ios-app) ay nagpapakita kung paano natin magagamit ang Playground upang i-wrap ang isang WordPress site sa isang iOS app.
