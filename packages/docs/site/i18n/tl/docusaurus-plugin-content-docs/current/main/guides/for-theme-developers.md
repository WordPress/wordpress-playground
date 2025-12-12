---
title: Playground para sa Mga Theme Developer
slug: /guides/for-theme-developers
description: WordPress Playground para sa Mga Theme Developer
---

<!--
The WordPress Playground is an innovative tool that allows theme developers to build, test, and showcase their themes directly in a browser environment.
-->

Ang WordPress Playground ay isang makabagong tool na nagpapahintulot sa mga theme developer na magtayo, mag-test, at magpakita ng kanilang mga theme nang direkta sa browser.

<!--
This guide will show you how to use WordPress Playground to improve your theme development workflow, create live demos to showcase your theme, and simplify the theme review process.
-->

Ang gabay na ito ay magpapakita kung paano gamitin ang WordPress Playground upang pagandahin ang iyong workflow sa pag-develop ng theme, lumikha ng live na demo para ipakita ang iyong theme, at pasimplehin ang proseso ng review ng theme.

<!--
:::info

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section

:::
-->

:::info

Tuklasin kung paano [Mag-build](/about/build), [Mag-test](/about/test), at [Mag-launch](/about/launch) ng iyong mga produkto gamit ang WordPress Playground sa seksyon ng [About Playground](/about).

:::

<!--
## Launching a Playground instance with a theme
-->

## Paglunsad ng Playground instance gamit ang theme

<!--
### Themes in the WordPress themes directory
-->

### Theme sa WordPress Themes Directory

<!--
With WordPress Playground, you can quickly launch a WordPress installation using any theme available in the [WordPress Themes Directory](https://wordpress.org/themes/). Simply pass the `theme` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) like this: https://playground.wordpress.net/?theme=disco.
-->

Sa WordPress Playground, maaari kang mabilis maglunsad ng WordPress installation gamit ang anumang theme mula sa [WordPress Themes Directory](https://wordpress.org/themes/). Idagdag lamang ang `theme` [query parameter](/developers/apis/query-api) sa [Playground URL](https://playground.wordpress.net) tulad nito: https://playground.wordpress.net/?theme=disco.

<!--
You can also load any theme from the WordPress themes directory by setting the [`installTheme` step](/blueprints/steps#InstallThemeStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.
-->

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

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

<!--
### Themes in a GitHub repository
-->

### Theme mula sa GitHub Repository

<!--
A theme stored in a GitHub repository can also be loaded in a Playground instance with Blueprints.
-->

Ang theme na naka-imbak sa isang GitHub repository ay maaari ring i-load sa isang Playground instance gamit ang Blueprints.

<!--
With the `themeData` property of the [`installTheme` blueprint step](/blueprints/steps#InstallThemeStep), you can define a [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) that will build a theme from the files from a repository in the Playground instance.
-->

Sa pamamagitan ng `themeData` property ng [`installTheme` blueprint step](/blueprints/steps#InstallThemeStep), maaari mong tukuyin ang [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) na bubuo ng theme mula sa mga file mula sa isang repository sa Playground instance.

<!--
:::info
For the past few months, the [GitHub proxy](https://playground.wordpress.net/proxy) was an incredibly useful tool to load themes from GitHub repositories, as it allows you to load a theme from a specific branch, a specific directory, a specific commit, or a specific PR. But with the recent improvements to Playground, this feature is no longer necessary. The GitHub Proxy will be discontinued soon, please update your blueprints to `git:directory` resource.
:::
-->

:::info
Sa mga nakaraang buwan, ang [GitHub proxy](https://playground.wordpress.net/proxy) ay isang napaka-kapaki-pakinabang na tool upang mag-load ng mga theme mula sa mga GitHub repository, dahil pinapayagan kang mag-load mula sa isang partikular na branch, direktoryo, commit, o PR. Ngunit sa mga kamakailang pagpapabuti sa Playground, ang feature na ito ay hindi na kailangan. Ang GitHub Proxy ay hindi na ipagpapatuloy sa lalong madaling panahon, mangyaring i-update ang iyong mga blueprint sa `git:directory` resource.
:::

<!--
For example the following `blueprint.json` installs a theme from a GitHub repository:
-->

Halimbawa, ang sumusunod na `blueprint.json` ay nag-i-install ng theme mula sa isang GitHub repository:

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "git:directory",
				"url": "https://github.com/Automattic/themes",
				"ref": "trunk",
				"path": "assembler"
			},
			"options": {
				"activate": true
			}
		}
	]
}
```

<!--
:::tip
If your theme is hosted on GitHub, you can automatically add preview buttons to your pull requests using the Playground PR Preview GitHub Action. This lets reviewers test your changes instantly without any setup. See [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) for details.
:::
-->

:::tip
Kung ang iyong theme ay naka-host sa GitHub, maaari kang awtomatikong magdagdag ng mga preview button sa iyong mga pull request gamit ang Playground PR Preview GitHub Action. Hinahayaan nito ang mga reviewer na subukan ang iyong mga pagbabago kaagad nang walang anumang setup. Tingnan ang [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) para sa mga detalye.
:::

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/Automattic/themes%22,%22ref%22:%22trunk%22,%22path%22:%22assembler%22},%22options%22:{%22activate%22:true}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})

<!--
A blueprint can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

Ang isang blueprint ay maaaring ipasa sa isang Playground instance [sa iba't ibang paraan](/blueprints/using-blueprints).

<!--
## Setting up a demo theme with Blueprints
-->

## Pag-set up ng demo theme gamit ang Blueprints

<!--
When providing a link to a WordPress Playground instance with a specific theme activated, you may also want to customize the initial setup for that theme. With Playground's [Blueprints](/blueprints/getting-started) you can load, activate, and configure a theme.
-->

Kapag nagbibigay ng link sa isang WordPress Playground instance na may naka-activate na tema, maaaring gusto mo ring i-customize ang paunang setup ng iyon theme. Sa pamamagitan ng [Blueprints](/blueprints/getting-started), maaari mong i-load, i-activate, at i-configure ang theme.

<!--
:::tip

Some useful tools and resources provided by the Playground project to work with blueprints are:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

:::
-->

:::tip

Ilang kapaki-pakinabang na tool at resources mula sa proyekto ng Playground para magtrabaho sa blueprints:

- Suriin ang [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) upang tuklasin ang mga totoong halimbawa ng kodigo ng paggamit ng WordPress Playground upang maglunsad ng WordPress site na may iba't ibang setup.
- Ang [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) ay nagbibigay ng visual na interface upang i-drag o i-click ang mga step upang lumikha ng blueprint. Maaari ka ring gumawa ng sarili mong step!
- Ang [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool ay nagpapahintulot sa iyo na i-edit ang iyong blueprint online at patakbuhin ito nang direkta sa isang Playground instance.

:::

<!--
Through properties and [`steps`](/blueprints/steps) in the blueprint, you can configure the initial setup of your theme in the Playground instance.
-->

Sa pamamagitan ng properties at [`steps`](/blueprints/steps) sa blueprint, maaari mong i-configure ang paunang setup ng iyong theme sa Playground instance.

<!--
:::info

To provide a good demo of your theme via Playground, you may want to load it with default content that highlights the features of your theme. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

:::
-->

:::info

Upang magbigay ng mahusay na demo ng iyong theme gamit ang Playground, maaaring gusto mong i-load ito kasama ang default na content na nagpapakita ng mga feature ng iyong theme. Tingnan ang [Pagbibigay ng Nilalaman para sa Iyong Demo](/guides/providing-content-for-your-demo) na gabay para matuto pa.
:::

<!--
### `resetData`
-->

### `resetData`

<!--
With the [`resetData`](/blueprints/steps#resetData) step, you can remove the default content of a WordPress installation in order to import your own content.
-->

Gamit ang [`resetData`](/blueprints/steps#resetData) step, maaari mong alisin ang default na content ng isang WordPress installation upang mag-import ng sarili mong content.

```json
"steps": [
	{
		"step": "resetData"
	}
]
```

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

<!--
### `writeFile`
-->

### `writeFile`

<!--
With the [`writeFile`](/blueprints/steps#resetData) step, you can write data to a file at a specified path. You may want to use this step to write custom PHP code in a PHP file inside the `mu-plugins` folder of the Playground WordPress instance, so the code is executed automatically when the WordPress instance is loaded.
One of the things you can do through this step is to enable pretty permalinks for your Playground instance:
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

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

<!--
### `updateUserMeta`
-->

### `updateUserMeta`

<!--
With the [`updateUserMeta`](/blueprints/steps#updateUserMeta) step, you can update any user metadata. For example, you could update the metadata of the default `admin` user of any WordPress installation:
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

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

<!--
### `setSiteOptions`
-->

### `setSiteOptions`

<!--
With the [`setSiteOptions`](/blueprints/steps#setSiteOptions) step, you can set [site options](https://developer.wordpress.org/apis/options/#available-options-by-category) such as the site name, description, or page to use for posts.
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

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

<!--
There's also a [`siteOptions`](/blueprints/steps/shorthands#siteoptions) shorthand that can be used instead of the `setSiteOptions` step.
-->

Mayroon ding [`siteOptions`](/blueprints/steps/shorthands#siteoptions) shorthand na maaaring gamitin sa halip na `setSiteOptions` step.

<!--
### `plugins`
-->

### `plugins`

<!--
With the [`plugins`](/blueprints/steps/shorthands#plugins) shorthand you can set a list of plugins you want to be installed and activated with your theme in the Playground instance.
-->

Gamit ang shorthand na [`plugins`](/blueprints/steps/shorthands#plugins), maaari mong itakda ang listahan ng mga plugin na nais mong i-install at i-activate kasama ng iyong theme sa Playground instance.

```json
"plugins": ["todo-list-block", "markdown-comment-block"]
```

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

<!--
You can also use the [`installPlugin`](/blueprints/steps#installPlugin) step to install and activate plugins for your Playground instance but the shorthand way is recommended.
-->

Maaari mo ring gamitin ang [`installPlugin`](/blueprints/steps#installPlugin) step upang i-install at i-activate ang mga plugins para sa iyong Playground instance ngunit inirerekomenda ang shorthand na paraan.

<!--
### `login`
-->

### `login`

<!--
With the [`login`](/blueprints/steps/shorthands#login) shorthand you can launch your Playground instance with the admin user logged in.
-->

Gamit ang shorthand na [`login`](/blueprints/steps/shorthands#login), maaari mong ilunsad ang iyong Playground instance na naka-log in na sa admin user.

```json
"login": true
```

[<kbd> Patakbuhin ang Blueprint </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json)

<!--
You can also use the [`login`](/blueprints/steps#login) step to launch your Playground instance logged in with any specific user.
-->

Maaari mo ring gamitin ang [`login`](/blueprints/steps#login) step upang ilunsad ang iyong Playground instance na naka-log in sa anumang partikular na user.

<!--
:::tip

The ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) and ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) examples from the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) are great references for loading, activating, importing content, and configuring a block theme on a Playground instance.
:::
-->

:::tip

Ang ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) at ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) na halimbawa mula sa [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) ay mahusay na sanggunian para sa pag-load, pag-activate, pag-import ng content, at pag-configure ng block theme sa isang Playground instance.
:::

<!--
## Theme development
-->

## Pag-develop ng Theme

<!--
### Local theme development and testing with Playground
-->

### Lokal na pag-develop at testing ng theme gamit ang Playground

<!--
From the root folder of a block theme's code, you can quickly load locally a Playground instance with that theme loaded and activated. You can do that by launching, in a theme directory, the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your preferred command line program or the [Visual Code Studio extension](/developers/local-development/vscode-extension) from the [Visual Studio Code](https://code.visualstudio.com/) IDE.
-->

Mula sa root folder ng code ng isang block theme, maaari mong mabilis i-load sa lokal ang isang Playground instance na may theme na iyon na naka-load at naka-activate. Gawin ito sa pamamagitan ng paglulunsad, sa loob ng theme directory, ng [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) mula sa iyong paboritong command line program o ang [Visual Studio Code extension](/developers/local-development/vscode-extension) mula sa IDE na [Visual Studio Code](https://code.visualstudio.com/).

<!--
For example:
-->

Halimbawa:

```
git clone git@github.com:WordPress/community-themes.git
cd community-themes/blue-note
npx @wp-playground/cli server --auto-mount
```

<!--
### Design your theme using the WordPress UI and save your changes as Pull Requests
-->

### Idisenyo ang iyong theme gamit ang WordPress UI at i-save ang iyong mga pagbabago bilang Pull Requests

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you've done through the WordPress UI in the Playground instance, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin. You can also make changes to that theme and export a zip.
-->

Maaari mong ikonekta ang iyong Playground instance sa isang GitHub repository at gumawa ng Pull Request na naglalaman ng mga pagbabagong ginawa mo sa pamamagitan ng WordPress UI sa Playground instance, gamit ang plugin na [Create Block Theme](https://wordpress.org/plugins/create-block-theme/). Maaari ka ring gumawa ng mga pagbabago sa theme na iyon at i-export bilang zip.

<!--
Note that you'll need the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin installed and activated in the Playground instance in order to use this workflow.
-->

Tandaan na kakailanganin mong may naka-install at naka-activate na plugin na [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) sa Playground instance upang magamit ang workflow na ito.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<!--
:::tip

Check [About Playground > Build > Save changes done on a Block Theme and create GitHub Pull Requests](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) for more info.

:::
-->

:::tip

Check [About Playground > Build > Save changes done on a Block Theme and create GitHub Pull Requests](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) for more info.

:::
