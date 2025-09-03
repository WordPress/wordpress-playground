---
title: Playground para sa Mga Plugin Developer
slug: /guides/for-plugin-developers
description: WordPress Playground para sa Mga Plugin Developer
---

Ang WordPress Playground ay isang makabagong tool na nagpapahintulot sa mga plugin developer na magtayo, mag-test, at magpakita ng kanilang mga plugin nang direkta sa browser.

Ang gabay na ito ay magpapakita kung paano gamitin ang WordPress Playground upang pagandahin ang iyong workflow sa pag-develop ng plugin, lumikha ng live na demo para ipakita ang iyong plugin, at pasimplehin ang iyong plugin testing at review.

:::info

Tuklasin kung paano [Mag-build](/about/build), [Mag-test](/about/test), at [Mag-launch](/about/launch) ng iyong mga produkto gamit ang WordPress Playground sa [About Playground](/about) na seksyon.

:::

## Paglunsad ng isang Playground instance gamit ang plugin

### Plugin sa WordPress Themes Directory

Sa WordPress Playground, maaari kang mabilis maglunsad ng WordPress installation na may halos anumang plugin mula sa [WordPress Plugins Directory](https://wordpress.org/plugins/) na naka-install at naka-activate. Kailangan mo lamang idagdag ang `plugin` na [query parameter](/developers/apis/query-api) sa [Playground URL](https://playground.wordpress.net) at gamitin ang slug ng plugin mula sa WordPress directory bilang halaga. Halimbawa: https://playground.wordpress.net/?plugin=create-block-theme

:::tip
Maaari kang mag-install at mag-activate ng maraming plugin sa pamamagitan ng pag-uulit ng `plugin` parameter para sa bawat plugin na nais mong i-install at i-activate sa Playground instance. Halimbawa: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo
:::

Maaari mo ring i-load ang anumang plugin mula sa WordPress plugins directory sa pamamagitan ng pag-set ng [`installPlugin` step](/blueprints/steps#InstallPluginStep) ng isang [Blueprint](/blueprints/getting-started) na ipapasa sa Playground instance.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#{"landingPage":"/wp-admin/plugins.php","login":true,"steps":[{"step":"installPlugin","pluginData":{"resource":"wordpress.org/plugins","slug":"gutenberg"}}]})

Ang mga Blueprint ay maaaring ipasa sa isang Playground instance [sa iba't ibang paraan](/blueprints/using-blueprints).

### Plugin mula sa GitHub Repository

<!--
### Plugin in a GitHub repository
-->

Ang plugin na naka-imbak sa isang GitHub repository ay maaari ring i-load sa isang Playground instance gamit ang Blueprints.

Sa pamamagitan ng `pluginData` property ng [`installPlugin` blueprint step](/blueprints/steps#InstallPluginStep), maaari mong tukuyin ang [`url` resource](/blueprints/steps/resources#urlreference) na tumuturo sa lokasyon ng `.zip` file na naglalaman ng plugin na nais mong i-load sa Playground instance.

Upang maiwasan ang mga isyu sa CORS, nag-aalok ang proyekto ng [GitHub proxy](https://playground.wordpress.net/proxy) na nagpapahintulot sa iyo na bumuo ng `.zip` mula sa isang repository (o kahit isang folder sa loob nito) na naglalaman ng iyong plugin.

:::info
Ang [GitHub proxy](https://playground.wordpress.net/proxy) ay isang napaka-kapaki-pakinabang na tool upang mag-load ng mga plugin mula sa mga GitHub repository dahil pinapayagan kang mag-load ng plugin mula sa isang partikular na branch, direktoryo, commit, o PR.
:::

Halimbawa, ang sumusunod na `blueprint.json` ay nag-i-install ng plugin mula sa isang GitHub repository gamit ang https://github-proxy.com tool:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin"
			}
		}
	]
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#{"landingPage":"/wp-admin/admin.php?page=add-media-from-third-party-service","login":true,"steps":[{"step":"installPlugin","pluginData":{"resource":"url","url":"https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin"}}]})

### Plugin mula sa Code sa File o Gist sa GitHub

Sa pamamagitan ng kombinasyon ng [`writeFile`](/blueprints/steps#WriteFileStep) at [`activatePlugin`](/blueprints/steps#activatePlugin) na mga step, maaari ka ring maglunsad ng WP Playground instance na may plugin na binuo sa real-time mula sa code na naka-imbak sa isang gist o [file sa GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

[<kbd> &nbsp; Patakbuhin ang Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})

:::info

Ang [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example sa [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) ay nagpapakita kung paano mag-load ng plugin mula sa code sa isang gist

:::

## Pagse-set up ng demo para sa iyong plugin gamit ang Blueprints

Kapag nagbibigay ng link sa isang WordPress Playground instance na may ilang mga plugin na naka-activate, maaari mo ring i-customize ang paunang setup para sa Playground instance na iyon gamit ang mga plugin na iyon. Sa pamamagitan ng [Blueprints](/blueprints/getting-started) ng Playground, maaari mong i-load/activate ang mga plugin at i-configure ang Playground instance.

:::tip

Here are some useful tools and resources provided by the Playground project to work with blueprints:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

:::

Sa pamamagitan ng mga katangian at [`steps`](/blueprints/steps) sa Blueprint, maaari mong i-configure ang paunang setup ng Playground instance, ibibigay ang iyong mga plugin ng kinakailangang content at configuration upang maipakita ang mga kapana-panabik na feature at functionality ng iyong plugin.

:::info

Isang mahusay na demo gamit ang WordPress Playground ay maaaring mangailangan na mag-load ka ng default na content para sa iyong plugin at theme, kabilang ang mga larawan at iba pang asset. Tingnan ang [Pagbibigay ng nilalaman para sa iyong demo](/guides/providing-content-for-your-demo) na gabay para matuto nang higit pa tungkol dito.

:::

### `plugins`

Kung ang iyong plugin ay may dependencies sa ibang mga plugin, maaari mong gamitin ang shorthand na `plugins` upang i-install ang mga iyon kasama ang iyong plugin.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#{"landingPage":"/wp-admin/plugins.php","plugins":["gutenberg","sql-buddy","create-block-theme"],"login":true})

### `landingPage`

If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shortcut to automatically redirect to any page in the Playground instance upon loading.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```
