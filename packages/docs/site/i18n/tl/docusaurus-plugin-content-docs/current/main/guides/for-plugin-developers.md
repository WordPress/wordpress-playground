---
title: Playground para sa Mga Plugin Developer
slug: /guides/for-plugin-developers
description: WordPress Playground para sa Mga Plugin Developer
---

<!--
The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment.
-->

Ang WordPress Playground ay isang makabagong tool na nagpapahintulot sa mga plugin developer na magtayo, mag-test, at magpakita ng kanilang mga plugin nang direkta sa browser.

<!--
This guide will show you how to use WordPress Playground to improve your plugin development workflow, create live demos to showcase your plugin, and simplify your plugin testing and review.
-->

Ang gabay na ito ay magpapakita kung paano gamitin ang WordPress Playground upang pagandahin ang iyong workflow sa pag-develop ng plugin, lumikha ng live na demo para ipakita ang iyong plugin, at pasimplehin ang iyong plugin testing at review.

<!--
:::info

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section.

:::
-->

:::info

Tuklasin kung paano [Mag-build](/about/build), [Mag-test](/about/test), at [Mag-launch](/about/launch) ng iyong mga produkto gamit ang WordPress Playground sa [About Playground](/about) na seksyon.

:::

<!--
## Launching a Playground instance with a plugin
-->

## Paglunsad ng isang Playground instance gamit ang plugin

<!--
### Plugin in the WordPress themes directory
-->

### Plugin sa WordPress Themes Directory

<!--
With WordPress Playground, you can quickly launch a WordPress installation with almost any plugin available in the [WordPress Plugins Directory](https://wordpress.org/plugins/) installed and activated. All you need to do is to add the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) and use the slug of the plugin from the WordPress directory as a value. For example: https://playground.wordpress.net/?plugin=create-block-theme
-->

Sa WordPress Playground, maaari kang mabilis maglunsad ng WordPress installation na may halos anumang plugin mula sa [WordPress Plugins Directory](https://wordpress.org/plugins/) na naka-install at naka-activate. Kailangan mo lamang idagdag ang `plugin` na [query parameter](/developers/apis/query-api) sa [Playground URL](https://playground.wordpress.net) at gamitin ang slug ng plugin mula sa WordPress directory bilang halaga. Halimbawa: https://playground.wordpress.net/?plugin=create-block-theme

<!--
:::tip
You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
:::
-->

:::tip
Maaari kang mag-install at mag-activate ng maraming plugin sa pamamagitan ng pag-uulit ng `plugin` parameter para sa bawat plugin na nais mong i-install at i-activate sa Playground instance. Halimbawa: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo
:::

<!--
You can also load any plugin from the WordPress plugins directory by setting the [`installPlugin` step](/blueprints/steps#InstallPluginStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.

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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})
-->

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

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

<!--
Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

Ang mga Blueprint ay maaaring ipasa sa isang Playground instance [sa iba't ibang paraan](/blueprints/using-blueprints).

<!--
### Plugin in a GitHub repository
-->

### Plugin mula sa GitHub Repository

<!--
A plugin stored in a GitHub repository can also be loaded in a Playground instance via Blueprints.
-->

Ang plugin na naka-imbak sa isang GitHub repository ay maaari ring i-load sa isang Playground instance gamit ang Blueprints.

<!--
With the `pluginData` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) that will build a plugin from the files from a repository in the Playground instance.
-->

Sa pamamagitan ng `pluginData` property ng [`installPlugin` blueprint step](/blueprints/steps#InstallPluginStep), maaari mong tukuyin ang [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) na bubuo ng plugin mula sa mga file mula sa isang repository sa Playground instance.

<!--
:::info
For the past few months, the [GitHub proxy](https://playground.wordpress.net/proxy) was an incredibly useful tool to load plugins from GitHub repositories, as it allows you to load a plugin from a specific branch, a specific directory, a specific commit, or a specific PR. But with the recent improvements to Playground, this feature is no longer necessary. The GitHub Proxy will be discontinued soon, please update your blueprints to `git:directory` resource.
:::
-->

:::info
Sa mga nakaraang buwan, ang [GitHub proxy](https://playground.wordpress.net/proxy) ay isang napaka-kapaki-pakinabang na tool upang mag-load ng mga plugin mula sa mga GitHub repository, dahil pinapayagan kang mag-load ng plugin mula sa isang partikular na branch, direktoryo, commit, o PR. Ngunit sa mga kamakailang pagpapabuti sa Playground, ang feature na ito ay hindi na kailangan. Ang GitHub Proxy ay hindi na ipagpapatuloy sa lalong madaling panahon, mangyaring i-update ang iyong mga blueprint sa `git:directory` resource.
:::

<!--
For example, the following `blueprint.json` installs a plugin from a GitHub repository:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/wptrainingteam/devblog-dataviews-plugin",
				"ref": "HEAD",
    			"refType": "refname"
			}
		}
	]
}
```
-->

Halimbawa, ang sumusunod na `blueprint.json` ay nag-i-install ng plugin mula sa isang GitHub repository:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/wptrainingteam/devblog-dataviews-plugin",
				"ref": "HEAD",
				"refType": "refname"
			}
		}
	]
}
```

<!--
:::tip
If your plugin is hosted on GitHub, you can automatically add preview buttons to your pull requests using the Playground PR Preview GitHub Action. This lets reviewers test your changes instantly without any setup. See [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) for details.
:::
-->

:::tip
Kung ang iyong plugin ay naka-host sa GitHub, maaari kang awtomatikong magdagdag ng mga preview button sa iyong mga pull request gamit ang Playground PR Preview GitHub Action. Hinahayaan nito ang mga reviewer na subukan ang iyong mga pagbabago kaagad nang walang anumang setup. Tingnan ang [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) para sa mga detalye.
:::

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})
-->

[<kbd> &nbsp; Patakbuhin ang Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})

<!--
### Plugin from code in a file or gist in GitHub
-->

### Plugin mula sa Code sa File o Gist sa GitHub

<!--
By combining the [`writeFile`](/blueprints/steps#WriteFileStep) and [`activatePlugin`](/blueprints/steps#activatePlugin) steps you can also launch a WP Playground instance with a plugin built on the fly from code stored on a gist or [a file in GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):

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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})
-->

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

<!--
:::info

The [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example in the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) shows how to load a plugin from code in a gist

:::
-->

:::info

Ang [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example sa [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) ay nagpapakita kung paano mag-load ng plugin mula sa code sa isang gist

:::

<!--
## Setting up a demo for your plugin with Blueprints
-->

## Pagse-set up ng demo para sa iyong plugin gamit ang Blueprints

<!--
When providing a link to a WordPress Playground instance with some plugins activated, you may also want to customize the initial setup for that Playground instance using those plugins. With Playground's [Blueprints](/blueprints/getting-started) you can load/activate plugins and configure the Playground instance.
-->

Kapag nagbibigay ng link sa isang WordPress Playground instance na may ilang mga plugin na naka-activate, maaari mo ring i-customize ang paunang setup para sa Playground instance na iyon gamit ang mga plugin na iyon. Sa pamamagitan ng [Blueprints](/blueprints/getting-started) ng Playground, maaari mong i-load/activate ang mga plugin at i-configure ang Playground instance.

<!--
:::tip

Some useful tools and resources provided by the Playground project to work with blueprints are:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

:::
-->

:::tip

Narito ang ilang kapaki-pakinabang na tool at mapagkukunan na ibinigay ng proyekto ng Playground upang gumana sa mga blueprint:

- Tingnan ang [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) upang galugarin ang mga halimbawa ng code sa totoong mundo ng paggamit ng WordPress Playground upang maglunsad ng site ng WordPress na may iba't ibang mga setup.
- Ang [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool ay nagbibigay ng visual na interface upang i-drag o i-click ang mga hakbang upang lumikha ng isang blueprint para sa WordPress Playground. Maaari ka ring lumikha ng iyong sariling mga hakbang!
- Ang [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool ay nagbibigay-daan sa iyong i-edit ang iyong blueprint online at patakbuhin ito nang direkta sa isang instance ng Playground.

:::

<!--
Through properties and [`steps`](/blueprints/steps) in the Blueprint, you can configure the Playground instance's initial setup, providing your plugins with the content and configuration needed for showcasing your plugin's compelling features and functionality.
-->

Sa pamamagitan ng mga katangian at [`steps`](/blueprints/steps) sa Blueprint, maaari mong i-configure ang paunang setup ng Playground instance, ibibigay ang iyong mga plugin ng kinakailangang content at configuration upang maipakita ang mga kapana-panabik na feature at functionality ng iyong plugin.

<!--
:::info

A great demo with WordPress Playground might require that you load default content for your plugin and theme, including images and other assets. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

:::
-->

:::info

Isang mahusay na demo gamit ang WordPress Playground ay maaaring mangailangan na mag-load ka ng default na content para sa iyong plugin at theme, kabilang ang mga larawan at iba pang asset. Tingnan ang [Pagbibigay ng nilalaman para sa iyong demo](/guides/providing-content-for-your-demo) na gabay para matuto nang higit pa tungkol dito.

:::

<!--
### `plugins`
-->

### `plugins`

<!--
If your plugin has dependencies on other plugins you can use the `plugins` shorthand to install yours along with any other needed plugins.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})
-->

Kung ang iyong plugin ay may dependencies sa ibang mga plugin, maaari mong gamitin ang shorthand na `plugins` upang i-install ang mga iyon kasama ang iyong plugin.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

<!--
### `landingPage`
-->

### `landingPage`

<!--
If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shorthand to automatically redirect to any page in the Playground instance upon loading.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})
-->

Kung ang iyong plugin ay may settings view o onboarding wizard, maaari mong gamitin ang `landingPage` shorthand upang awtomatikong mag-redirect sa anumang page sa Playground instance sa pag-load.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Patakbuhin ang Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

<!--
### `writeFile`
-->

### `writeFile`

<!--
With the [`writeFile` step](/blueprints/steps#writeFile) you can create any plugin file on the fly, referencing code from a \*.php file stored on a GitHub or Gist.
-->

Gamit ang [`writeFile` step](/blueprints/steps#writeFile), maaari kang lumikha ng anumang file ng plugin sa mabilisang paraan, na tumutukoy sa code mula sa isang \*.php file na nakaimbak sa GitHub o Gist.

<!--
Here’s an example of a **[plugin that generates Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, placed in the `mu-plugins` folder to ensure the code runs automatically on load:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```
-->

Narito ang isang halimbawa ng isang **[plugin na bumubuo ng Mga Uri ng Pasadyang Post](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, na inilagay sa folder na `mu-plugins` upang matiyak na awtomatikong tumatakbo ang code sa pag-load:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```

<!--
## Plugin Development
-->

## Plugin Development

<!--
### Local plugin development and testing with Playground
-->

### Lokal na pag-develop ng plugin at pagsubok sa Playground

<!--
From a plugins' folder in your local development environment, you can quickly load locally a Playground instance with that plugin loaded and activated.
-->

Mula sa folder ng isang plugin sa iyong lokal na kapaligiran sa pag-develop, maaari mong mabilis na i-load nang lokal ang isang halimbawa ng Playground na na-load at na-activate ang plugin na iyon.

<!--
Use the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your plugin's root directory using your preferred command line program.
-->

Gamitin ang [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) mula sa root directory ng iyong plugin gamit ang iyong ginustong command line program.

<!--
With [Visual Studio Code](https://code.visualstudio.com/) IDE, you can also use the [Visual Studio Code extension](/developers/local-development/vscode-extension) while working in the root directory of your plugin.
-->

Gamit ang [Visual Studio Code](https://code.visualstudio.com/) IDE, maaari mo ring gamitin ang [Visual Studio Code extension](/developers/local-development/vscode-extension) habang nagtatrabaho sa root directory ng iyong plugin.

<!--
For example:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```
-->

Halimbawa:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```

<!--
### See your local changes in a Playground instance and directly create PRs in a GitHub repo with your changes
-->

### Tingnan ang iyong mga lokal na pagbabago sa isang Playground instance at direktang gumawa ng mga PR sa isang GitHub repo kasama ang iyong mga pagbabago

<!--
With Google Chrome you can synchronize a Playground instance with your local plugin's code and your plugin's GitHub repo. With this connection you can:

-   See live (in the Playground instance) your local changes
-   Create PRs in the GitHub repo with your changes

Here's a little demo of this workflow in action:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>
-->

Sa Google Chrome, maaari mong i-synchronize ang isang Playground instance sa iyong local plugin code at GitHub repo ng iyong plugin. Sa koneksyong ito maaari mong:

- Makita nang live (sa Playground instance) ang iyong mga lokal na pagbabago
- Gumawa ng mga PR sa GitHub repo kasama ang iyong mga pagbabago

Narito ang isang maliit na demo ng workflow na ito sa aksyon:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

<!--
:::info

Check [About Playground > Build > Synchronize your playground instance with a local folder and create GitHub Pull Requests](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) for more info.

:::
-->

:::info

Tingnan ang [About Playground > Build > Synchronize your playground instance with a local folder and create GitHub Pull Requests](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) para sa karagdagang impormasyon.

:::
