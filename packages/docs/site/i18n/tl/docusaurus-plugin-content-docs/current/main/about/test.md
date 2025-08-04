---
title: Test
slug: /about/test
---

# Subukan

I-upgrade ang iyong QA process sa kakayahang suriin ang progreso sa iyong browser sa isang click lang. Kapag handa ka na, agad na i-push ang mga update.

## Subukan ang anumang theme o plugin

Sa Playground, maaari mong subukan ang anumang plugin o theme. Gamitin ang [Query API](/developers/apis/query-api) upang mabilis na i-load ang anumang plugin o theme na naka-publish sa direktoryo ng wordpress.org na mga [plugin](https://wordpress.org/plugins) at [theme](https://wordpress.org/themes/).

Halimbawa, ang sumusunod na link ay maglo-load ng [“pendant” theme](https://wordpress.org/themes/pendant/) at ang [“gutenberg” plugin](https://wordpress.org/plugins/gutenberg/) sa isang Playground instance:

[https://playground.wordpress.net/?theme=pendant&plugin=gutenberg](https://playground.wordpress.net/?theme=pendant&plugin=gutenberg)

Ngunit maaari ka ring magsubok ng [mas komplikadong mga konfigurasyon gamit ang blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md), halimbawa pagsubok ng code ng plugin mula sa isang gist (tingnan ang [blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-plugin-from-gist/blueprint.json) at [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json)).

## Live preview ng pull requests

Ang pagsusuri ng pull requests ay isa sa mga pinakakapana-panabik na use case para sa proyekto ng Playground. Sa Playground, maaari mong paganahin ang Live preview link sa bawat Pull Request ng isang WordPress-related na proyekto sa GitHub upang makita agad ng mga developer ang epekto ng code sa Pull Request na iyon. Basahin pa tungkol dito sa [Preview WordPress Core Pull Requests with Playground](https://wptavern.com/preview-wordpress-core-pull-requests-with-playground#:~:text=Previewing%20WordPress%20Pull%20Requests%20requires,testing%20and%20team%20workflows%20difficult.).

May ilang pampublikong implementasyon ng use case na ito tulad ng [WordPress Core PR previewer](https://playground.wordpress.net/wordpress.html) at [Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html). Maaaring ilagay ng user ang PR number o URL upang ire-direct sa isang WordPress instance, na pinapagana ng Playground, kung saan naiaaplay ang mga pagbabago mula sa PR.

Ang GitHub actions tulad ng [WP Playground PR Preview](https://github.com/vcanales/action-wp-playground-pr-preview) ay nagpapahintulot sa iyo na magdagdag ng PR previews na pinapagana ng WP Playground sa anumang repository. Halimbawa, [na-enable ito](https://github.com/WordPress/twentytwentyfive/pull/359) sa repositoryong [WordPress/twentytwentyfive](https://github.com/WordPress/twentytwentyfive).

## I-clone ang iyong site at mag-eksperimento sa isang pribadong sandbox

Sa pamamagitan ng plugin na [Sandbox Site powered by Playground](https://wordpress.org/plugins/playground/), maaari kang lumikha ng pribadong WordPress Playground na kopya ng iyong site upang ligtas na subukan ang mga plugin o gumawa ng anumang iba pang eksperimento sa kopya ng iyong site nang hindi nag-a-upload ng anumang data sa cloud at hindi naaapektuhan ang orihinal na site.

## Subukan ang iba't ibang bersyon ng WordPress at PHP

Sa Playground, maaari mong mabilis na subukan ang anumang major na bersyon ng WordPress o PHP sa pamamagitan ng _pag-customize ng mga setting_ nito o paggamit ng custom blueprint na may property na `preferredVersions`.

Halimbawa, maaari mong lagiang subukan ang pinakabagong development version ng WordPress, na tinatawag ding [Beta Nightly](https://wordpress.org/download/beta-nightly/), mula sa link na ito: [https://playground.wordpress.net/?wp=nightly](https://playground.wordpress.net/?wp=nightly)

Sa panahon ng Beta ng anumang WordPress release, maaari mo ring subukan ang pinakabagong WordPress Beta o RC na release kasama ang theme test data at debugging plugins (tingnan ang [blueprint](https://github.com/WordPress/blueprints/blob/trunk/blueprints/beta-rc/blueprint.json) at [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json)).

Maaari mo ring i-load ang anumang [theme, plugin](/developers/apis/query-api), o [konigurasyon](/blueprints) sa anumang available na bersyon ng WordPress at PHP upang suriin kung paano ito gumagana sa environment na iyon.

Ang [WordPress Playground: the ultimate learning, testing, & teaching tool for WordPress](https://www.youtube.com/watch?v=dN_LaenY8bI) ay nagbibigay ng mahusay na overview ng mga posibilidad sa pagsusuri gamit ang Playground.
