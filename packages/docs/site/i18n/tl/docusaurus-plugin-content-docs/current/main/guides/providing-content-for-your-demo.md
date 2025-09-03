---
title: Pagbibigay ng Nilalaman para sa Iyong Demo gamit ang Playground
slug: /guides/providing-content-for-your-demo
description: Pagbibigay ng nilalaman para sa iyong demo gamit ang WordPress Playground
---

Isa sa mga bagay na maaaring gusto mong gawin para makagawa ng mahusay na demo gamit ang WordPress Playground ay ang pag-load ng paunang nilalaman upang higit na maipakita ang mga feature ng iyong plugin o theme. Maaaring kabilang dito ang mga larawan o iba pang asset.

May ilang [blueprint steps](/blueprints/steps) at estratehiya na maaari mong gamitin upang i-import (o bumuo) ng content sa Playground instance:

## `importWxr`

Gamit ang [`importWxr`](/blueprints/steps#importWxr) step, maaari mong i-import ang iyong sariling content sa pamamagitan ng isang `.xml` file na [na-export mula sa umiiral na WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/):

```json
"steps": [
	...,
	{
		"step": "importWxr",
		"file": {
			"resource": "url",
			"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint-content.xml"
		}
	},
	...
]
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd>   Tignan ang <code>blueprint.json</code>   </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)

:::info
Upang isama ang mga larawan sa iyong imported content, magandang paraan ang i-upload ang mga larawan sa iyong GitHub repo at gamitin ang path na `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}` sa exported `.xml` file.

```html
<!-- wp:image {"lightbox":{"enabled":false},"id":4751,"width":"78px","sizeSlug":"full","linkDestination":"none","align":"center","className":"no-border"} -->
<figure class="wp-block-image aligncenter size-full is-resized no-border">
	<img src="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/images/avatars.png" alt="" class="wp-image-4751" style="width:78px" />
</figure>
<!-- /wp:image -->
```

:::

Inirerekomenda na i-upload mo ang iyong na-export na `.xml` file at anumang naka-referensyang asset (tulad ng mga larawan) sa parehong directory kung saan naroon ang iyong `blueprint.json` sa iyong GitHub repository.

## `importWordPressFiles`

Gamit ang [`importWordPressFiles`](/blueprints/steps#importWordPressFiles) step, maaari mong i-import ang iyong sariling top-level WordPress files mula sa isang `.zip` file tungo sa root folder ng instance. Halimbawa, kung naglalaman ang `.zip` file ng `wp-content` at `wp-includes` directories, papalitan nito ang katumbas na directories sa root folder ng Playground.

Maaaring malikha ang `.zip` file mula sa anumang Playground instance gamit ang option na "Download as zip" sa [Playground Options Menu](/web-instance#playground-options-menu).

Maaari mong ihanda ang demo para sa iyong WordPress theme o plugin (kasama ang mga larawan at iba pang asset) sa isang Playground instance at pagkatapos ay i-export ito bilang snapshot sa `.zip` file. Maaari itong i-import muli gamit ang `importWordPressFiles` step.

```json
{
	"landingPage": "/",
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/adamziel/playground-sites/main/playground-for-site-builders/playground.zip"
			}
		}
	]
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#%7B%22landingPage%22%3A%22/%22%2C%22login%22%3Atrue%2C%22steps%22%3A%5B%7B%22step%22%3A%22importWordPressFiles%22%2C%22wordPressFilesZip%22%3A%7B%22resource%22%3A%22url%22%2C%22url%22%3A%22https://raw.githubusercontent.com/adamziel/playground-sites/main/playground-for-site-builders/playground.zip%22%7D%7D%5D%7D)

## `importThemeStarterContent`

[Ilang tema ay may starter content](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/) na maaaring i-publish upang ipakita ang feature ng isang theme.

Gamit ang [`importThemeStarterContent` step](/blueprints/steps#importThemeStarterContent) maaari mong i-publish ang starter content ng anumang theme kahit hindi ito ang naka-activate sa Playground instance.

```json
"steps": [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwenty"
      }
    },
    {
      "step": "importThemeStarterContent",
      "themeSlug": "twentytwenty"
    }
]
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#%7B%22steps%22%3A%5B%7B%22step%22%3A%22installTheme%22%2C%22themeData%22%3A%7B%22resource%22%3A%22wordpress.org/themes%22%2C%22slug%22%3A%22twentytwenty%22%7D%7D%2C%7B%22step%22%3A%22importThemeStarterContent%22%2C%22themeSlug%22%3A%22twentytwenty%22%7D%5D%7D)

Maaari mo ring i-publish ang starter content ng isang theme kapag ini-install ito gamit ang [`installTheme` step](/blueprints/steps#installTheme) sa pamamagitan ng pagtatakda sa `options.importStarterContent` bilang `true`:

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

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#%7B%22steps%22%3A%5B%7B%22step%22%3A%22installTheme%22%2C%22themeData%22%3A%7B%22resource%22%3A%22wordpress.org/themes%22%2C%22slug%22%3A%22twentytwenty%22%7D%2C%22options%22%3A%7B%22activate%22%3Atrue%2C%22importStarterContent%22%3Atrue%7D%7D%5D%7D)

## `wp-cli`

Isa pang paraan ng pag-generate ng content para sa iyong theme o plugin ay sa pamamagitan ng `wp-cli` step na nagpapahintulot sa'yo na patakbuhin ang mga [WP-CLI commands](https://developer.wordpress.org/cli/commands/) gaya ng [`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):

```json
{
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "wp-cli",
			"command": "wp post generate --count=20 --post_type=post --post_date=1999-01-04"
		}
	]
}
```

[<kbd>   Patakbuhin ang Blueprint   </kbd>](https://playground.wordpress.net/builder/builder.html#%7B%22landingPage%22%3A%22%2Fwp-admin%2Fedit.php%22%2C%22login%22%3Atrue%2C%22steps%22%3A%5B%7B%22step%22%3A%22wp-cli%22%2C%22command%22%3A%22wp%20post%20generate%20--count%3D20%20--post_type%3Dpost%20--post_date%3D1999-01-04%22%7D%5D%7D)

Maaari mo ring gamitin ang `wp-cli` step kasama ang `writeFile` step upang lumikha ng mga post mula sa umiiral na content at mag-import ng mga larawan sa Playground instance:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/?p=4",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/postcontent.md",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md"
			}
		},
		{
			"step": "wp-cli",
			"command": "wp post create --post_title='Welcome to Playground' --post_status='published' /wordpress/wp-content/postcontent.md"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/Select-storage-method.png",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png"
			}
		},
		{
			"step": "wp-cli",
			"command": "wp media import wordpress/wp-content/Select-storage-method.png --post_id=4 --title='Select your storage method' --featured_image"
		}
	]
}
```

[<kbd>  &nbsp; Patakbuhin ang Blueprint &nbsp;  </kbd>](<https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%20require_once%20'wordpress/wp-load.php';%20wp_insert_post(array('post_title'%20=%3E%20'Simple%20post%20from%20wp_insert_post',%20'post_content'%20%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%20'post_author'%20%20%20=%3E%201,%20'post_status'%20=%3E%20'publish'));%20?%3E%22}]}>)

:::tip

Tingnan ang halimbawa na ["Use wp-cli to add a post with image"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image) mula sa [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) upang makita ang buong halimbawa na nagpapakita ng ugnayan sa pagitan ng content at featured image.

:::
