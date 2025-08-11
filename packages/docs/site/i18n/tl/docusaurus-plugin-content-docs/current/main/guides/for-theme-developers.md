---
title: Playground para sa Mga Theme Developer
slug: /guides/for-theme-developers
description: WordPress Playground para sa Mga Theme Developer
---

Ang WordPress Playground ay isang makabagong tool na nagpapahintulot sa mga theme developer na magtayo, mag-test, at magpakita ng kanilang mga theme nang direkta sa browser.

<!--
The WordPress Playground is an innovative tool that allows theme developers to build, test, and showcase their themes directly in a browser environment.
-->

Ang gabay na ito ay magpapakita kung paano gamitin ang WordPress Playground upang pagandahin ang iyong workflow sa pag-develop ng theme, lumikha ng live na demo para ipakita ang iyong theme, at pasimplehin ang proseso ng review ng theme.

<!--
This guide will show you how to use WordPress Playground to improve your theme development workflow, create live demos to showcase your theme, and simplify the theme review process.
-->

:::info

Tuklasin kung paano [Mag-build](/about/build), [Mag-test](/about/test), at [Mag-launch](/about/launch) ng iyong mga produkto gamit ang WordPress Playground sa seksyon ng [About Playground](/about).

:::

## Paglunsad ng Playground instance gamit ang theme

<!--
## Launching a Playground instance with a theme
-->

### Theme sa WordPress Themes Directory

<!--
### Themes in the WordPress themes directory
-->

Sa WordPress Playground, maaari kang mabilis maglunsad ng WordPress installation gamit ang anumang theme mula sa [WordPress Themes Directory](https://wordpress.org/themes/). Idagdag lamang ang `theme` [query parameter](/developers/apis/query-api) sa [Playground URL](https://playground.wordpress.net) tulad nito: https://playground.wordpress.net/?theme=disco.

Maaari mo ring i-load ang anumang theme mula sa WordPress themes directory sa pamamagitan ng pag-set ng [`installTheme` step](/blueprints/steps#InstallThemeStep) ng isang [Blueprint](/blueprints/getting-started) na ipapasa sa Playground instance.

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwenty"
			},
			"options": {
				"activate": true,
				"importStarterContent": true
			}
		}
	]
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

### Theme mula sa GitHub Repository

<!--
### Themes in a GitHub repository
-->

Ang theme na naka-imbak sa isang GitHub repository ay maaari ring i-load sa isang Playground instance gamit ang Blueprints.

Sa `themeData` property ng [`installTheme` blueprint step](/blueprints/steps#InstallThemeStep), maaari mong tukuyin ang [`url` resource](/blueprints/steps/resources#urlreference) na tumuturo sa lokasyon ng `.zip` file na naglalaman ng theme na nais mong i-load sa Playground instance.

Upang maiwasan ang mga isyu sa CORS, nag-aalok ang proyekto ng [GitHub proxy](https://playground.wordpress.net/proxy) na maaari kang gumamit upang bumuo ng `.zip` mula sa isang repository (o kahit isang folder sa loob nito) na naglalaman ng theme.

:::tip
Ang [GitHub proxy](https://playground.wordpress.net/proxy) ay napaka-kapaki-pakinabang na tool upang mag-load ng themes mula sa mga GitHub repository dahil pinapayagan kang mag-load mula sa isang partikular na branch, direktoryo, commit, o PR.
:::

Halimbawa, ang sumusunod na `blueprint.json` ay nag-i-install ng theme mula sa isang GitHub repository gamit ang https://github-proxy.com tool:

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=Automattic/themes&branch=trunk&directory=assembler"
			},
			"options": {
				"activate": true
			}
		}
	]
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=Automattic/themes&branch=trunk&directory=assembler%22},%22options%22:{%22activate%22:true}}]})

Ang isang blueprint ay maaaring ipasa sa isang Playground instance [sa iba't ibang paraan](/blueprints/using-blueprints).

## Pag-set up ng demo theme gamit ang Blueprints

<!--
## Setting up a demo theme with Blueprints
-->

Kapag nagbibigay ng link sa isang WordPress Playground instance na may naka-activate na tema, maaaring gusto mo ring i-customize ang paunang setup ng iyon theme. Sa pamamagitan ng [Blueprints](/blueprints/getting-started), maaari mong i-load, i-activate, at i-configure ang theme.

:::tip

Ilang kapaki-pakinabang na tool at resources mula sa proyekto ng Playground para magtrabaho sa blueprints:

-   Suriin ang [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) upang tuklasin ang mga totoong halimbawa ng kodigo ng paggamit ng WordPress Playground upang maglunsad ng WordPress site na may iba't ibang setup.
-   Ang [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) ay nagbibigay ng visual na interface upang i-drag o i-click ang mga step upang lumikha ng blueprint. Maaari ka ring gumawa ng sarili mong step!
-   Ang [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool ay nagpapahintulot sa iyo na i-edit ang iyong blueprint online at patakbuhin ito nang direkta sa isang Playground instance.

:::

Sa pamamagitan ng properties at [`steps`](/blueprints/steps) sa blueprint, maaari mong i-configure ang paunang setup ng iyong theme sa Playground instance.

:::info

Upang magbigay ng mahusay na demo ng iyong theme gamit ang Playground, maaaring gusto mong i-load ito kasama ang default na content na nagpapakita ng mga feature ng iyong theme. Tingnan ang [Pagbibigay ng Nilalaman para sa Iyong Demo](/guides/providing-content-for-your-demo) na gabay para matuto pa.
:::

### `resetData`

<!--
### `resetData`
-->

Gamit ang [`resetData`](/blueprints/steps#resetData) step, maaari mong alisin ang default na content ng isang WordPress installation upang mag-import ng sarili mong content.

```json
"steps": [
	{
		"step": "resetData"
	}
]
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

### `writeFile`

<!--
### `writeFile`
-->

Gamit ang [`writeFile`](/blueprints/steps#writeFile) step, maaari kang magsulat ng data sa isang file sa tinukoy na path. Maaari mong gamitin ito upang magsulat ng custom PHP code sa isang PHP file sa loob ng `mu-plugins` folder ng Playground WordPress instance, kaya ang code ay awtomatikong na-eexecute kapag na-load ang WordPress instance.

```json
"steps": [
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
		"data": "<?php /* Use pretty permalinks */ add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
	}
]
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

### `updateUserMeta`

<!--
### `updateUserMeta`
-->

Gamit ang [`updateUserMeta`](/blueprints/steps#updateUserMeta) step, maaari mong i-update ang anumang user metadata. Halimbawa, maaari mong i-update ang metadata ng default na `admin` user ng anumang WordPress installation:

```json
"steps": [
	{
		"step": "updateUserMeta",
		"meta": {
			"first_name": "John",
			"last_name": "Doe",
			"admin_color": "modern"
		},
		"userId": 1
	}
]
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

### `setSiteOptions`

<!--
### `setSiteOptions`
-->

Gamit ang [`setSiteOptions`](/blueprints/steps#setSiteOptions) step, maaari mong itakda ang [site options](https://developer.wordpress.org/apis/options/#available-options-by-category) gaya ng site name, description, o page na gamitin para sa posts.

```json
"steps": [
	{
		"step": "setSiteOptions",
		"options": {
			"blogname": "Rich Tabor",
			"blogdescription": "Multidisciplinary maker specializing in the intersection of product, design and engineering. Making WordPress.",
			"show_on_front": "page",
			"page_on_front": 6,
			"page_for_posts": 2
		}
	}
]
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

### `plugins`

<!--
### `plugins`
-->

Gamit ang shorthand na [`plugins`](/blueprints/steps/shorthands#plugins), maaari mong itakda ang listahan ng mga plugin na nais mong i-install at i-activate kasama ng iyong theme sa Playground instance.

```json
"plugins": ["todo-list-block", "markdown-comment-block"]
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

### `login`

<!--
### `login`
-->

Gamit ang shorthand na [`login`](/blueprints/steps/shorthands#login), maaari mong ilunsad ang iyong Playground instance na naka-log in na sa admin user.

```json
"login": true
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

Maaari mo ring gamitin ang [`login`](/blueprints/steps#login) step upang ilunsad ang iyong Playground instance na naka-log in sa anumang partikular na user.

:::tip

Ang ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) at ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) na halimbawa mula sa [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) ay mahusay na sanggunian para sa pag-load, pag-activate, pag-import ng content, at pag-configure ng block theme sa isang Playground instance.
:::

## Pag-develop ng Theme

### Lokal na pag-develop at testing ng theme gamit ang Playground

Mula sa root folder ng code ng isang block theme, maaari mong mabilis i-load sa lokal ang isang Playground instance na may theme na iyon na naka-load at naka-activate. Gawin ito sa pamamagitan ng paglulunsad, sa loob ng theme directory, ng [`wp-now` command](/developers/local-development/wp-now) mula sa iyong paboritong command line program o ang [Visual Studio Code extension](/developers/local-development/vscode-extension) mula sa IDE na [Visual Studio Code](https://code.visualstudio.com/).

Halimbawa:

```
git clone git@github.com:WordPress/community-themes.git
cd community-themes/blue-note
npx @wp-now/wp-now start
```

### Idisenyo ang iyong theme gamit ang WordPress UI at i-save ang iyong mga pagbabago bilang Pull Requests

Maaari mong ikonekta ang iyong Playground instance sa isang GitHub repository at gumawa ng Pull Request na naglalaman ng mga pagbabagong ginawa mo sa pamamagitan ng WordPress UI sa Playground instance, gamit ang plugin na [Create Block Theme](https://wordpress.org/plugins/create-block-theme/). Maaari ka ring gumawa ng mga pagbabago sa theme na iyon at i-export bilang zip.

Tandaan na kakailanganin mong may naka-install at naka-activate na plugin na [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) sa Playground instance upang magamit ang workflow na ito.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

:::tip

Check [About Playground > Build > Save changes done on a Block Theme and create GitHub Pull Requests](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) for more info.

:::
