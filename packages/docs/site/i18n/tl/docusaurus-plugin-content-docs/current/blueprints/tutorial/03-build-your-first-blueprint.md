---
title: Gumawa ng Unang Blueprint
slug: /blueprints/tutorial/build-your-first-blueprint
description: Isang step-by-step na tutorial para gumawa ng unang Blueprint. Matuto kung paano mag-install ng mga theme, plugin, at mag-import ng site content.
---

Gumawa tayo ng elementary na Blueprint na

1. Gumagawa ng bagong WordPress site
2. Nagse-set ng site title sa "My first Blueprint"
3. Nag-i-install ng _Adventurer_ theme
4. Nag-i-install ng _Hello Dolly_ plugin mula sa WordPress plugin directory
5. Nag-i-install ng custom plugin
6. Nagbabago ng site content

## 1. Gumawa ng bagong WordPress site

Simulan natin sa paggawa ng `blueprint.json` file na may sumusunod na content:

```json
{}
```

Mukhang walang nangyayari, pero ang Blueprint na ito ay gumagawa na ng WordPress site na may latest major version.

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{})

:::tip **Autocomplete**

Kung gumagamit ka ng IDE, tulad ng VS Code o PHPStorm, maaari mong gamitin ang [Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json) para sa autocompleted na Blueprint development experience. Magdagdag ng sumusunod na line sa itaas ng iyong `blueprint.json` file:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json"
}
```

:::
Ganito ang itsura nito sa VS Code:

![Autocompletion visualized](@site/static/img/blueprints/schema-autocompletion.webp)

## 2. I-set ang site title sa "My first Blueprint"

Ang mga Blueprint ay binubuo ng serye ng [mga step](/blueprints/steps) na nagde-define kung paano gumawa ng WordPress site. Bago ka sumulat ng unang step, mag-declare ng empty na list ng mga step:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": []
}
```

Ang Blueprint na ito ay hindi masyadong exciting—gumagawa ito ng parehong default site tulad ng empty na Blueprint sa itaas. Gumawa tayo ng something about it!

Ang WordPress ay nagse-store ng site title sa `blogname` option. Magdagdag ng iyong unang step at i-set ang option na iyon sa "My first Blueprint":

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": [
		{
			"step": "setSiteOptions",
			"options": {
				"blogname": "My first Blueprint"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwic3RlcHMiOlt7InN0ZXAiOiJzZXRTaXRlT3B0aW9ucyIsIm9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifX1dfQ==)

Ang [`setSiteOptions` step](/blueprints/steps#SetSiteOptionsStep) ay nagse-specify ng mga site options sa WordPress database. Ang `options` object ay naglalaman ng key-value pairs na i-set. Sa kasong ito, binago mo ang value ng `blogname` key sa "My first Blueprint". Maaari mong basahin ang tungkol sa lahat ng available na steps sa [Blueprint Steps API Reference](/blueprints/steps).

### Mga Shorthand

Maaari mong i-specify ang ilang steps gamit ang shorthand syntax. Halimbawa, maaari mong isulat ang `setSiteOptions` step tulad nito:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"siteOptions": {
		"blogname": "My first Blueprint"
	}
}
```

Ang shorthand syntax at ang step syntax ay tumutugma sa isa't isa. Bawat step na na-specify gamit ang shorthand syntax ay awtomatikong naa-add sa simula ng `steps` array sa arbitrary na order. Alin ang dapat mong piliin? Gamitin ang mga shorthand kapag ang brevity ay ang iyong pangunahing concern, gamitin ang mga steps kapag kailangan mo ng mas maraming control sa order ng execution.

## 3. I-install ang _Adventurer_ theme

Ang Adventurer ay isang open-source theme na [available sa WordPress theme directory](https://wordpress.org/themes/adventurer/). I-install natin ito gamit ang [`installTheme` step](/blueprints/steps#InstallThemeStep):

```json
{
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwib3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX1dfQ==)

Ang site ay dapat na mukhang ganito sa screenshot sa ibaba:

![Site with the adventurer theme](@site/static/img/blueprints/installed-adventurer-theme.webp)

### Mga Resource

Ang `themeData` ay nagde-define ng [resource](/blueprints/steps/resources) at nagre-reference ng external file na kailangan para makumpleto ang step. Ang Playground ay sumusuporta sa iba't ibang uri ng resources, kasama ang

-   `url`,
-   `wordpress.org/themes`,
-   `wordpress.org/plugins`,
-   `vfs`(virtual file system), o
-   `literal`.

Ang example ay gumagamit ng `wordpress.org/themes` resource, na nangangailangan ng `slug` na identical sa ginagamit sa WordPress theme directory:

Sa kasong ito, `https://wordpress.org/themes/<slug>/` ay nagiging `https://wordpress.org/themes/adventurer/`.

:::note
Matuto pa tungkol sa mga supported na resources sa [Blueprint Resources API Reference](/blueprints/steps/resources/).
:::

## 4. I-install ang _Hello Dolly_ plugin

Isang classic na WordPress plugin na nagdi-display ng random na lyrics mula sa kantang "Hello, Dolly!" sa admin dashboard. I-install natin ito gamit ang [`installPlugin` step](/blueprints/steps#InstallPluginStep):

```json
{
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJzaXRlT3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX0seyJzdGVwIjoiaW5zdGFsbFBsdWdpbiIsInBsdWdpblppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3BsdWdpbnMiLCJzbHVnIjoiaGVsbG8tZG9sbHkifX1dfQ==)

Ang Hello Dolly plugin ay na-install na at na-activate.

Tulad ng `themeData`, ang `pluginData` ay nagde-define ng reference sa external file na kailangan para sa step. Ang example ay gumagamit ng `wordpress.org/plugins` resource para i-install ang plugin na may matching na `slug` mula sa WordPress plugin directory.

## 5. I-install ang custom plugin

I-install natin ang custom na WordPress plugin na nagda-dagdag ng message sa admin dashboard:

```php
<?php
/*
Plugin Name: "Hello" on the Dashboard
Description: A custom plugin to showcase WordPress Blueprints
Version: 1.0
Author: WordPress Contributors
*/

function my_custom_plugin() {
    echo '<h1>Hello from My Custom Plugin!</h1>';
}

add_action('admin_notices', 'my_custom_plugin');
```

Maaari mong gamitin ang [installPlugin](/blueprints/steps#InstallPluginStep), pero iyon ay nangangailangan ng paggawa ng ZIP file. Simulan natin sa ibang bagay para makita kung gumagana ang plugin:

1. Gumawa ng `wp-content/plugins/hello-from-the-dashboard` directory gamit ang [`mkdir` step](/blueprints/steps#MkdirStep).
2. Sumulat ng `plugin.php` file gamit ang [`writeFile` step](/blueprints/steps#WriteFileStep).
3. I-activate ang plugin gamit ang [`activatePlugin` step](/blueprints/steps#ActivatePluginStep).

Ganito ang itsura nito sa isang Blueprint:

```json
{
	// ...
	"steps": [
		// ...
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" on the Dashboard\nDescription: A custom plugin to showcase WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Hello from My Custom Plugin!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');"
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php"
		}
	]
}
```

Ang huling bagay na dapat gawin ay i-log ang user bilang admin. Maaari mong gawin iyon gamit ang shorthand ng [`login` step](/blueprints/steps#LoginStep):

```json
{
	"login": true,
	"steps": {
		// ...
	}
}
```

Narito ang kumpletong Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" on the Dashboard\nDescription: A custom plugin to showcase WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Hello from My Custom Plugin!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');"
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJsb2dpbiI6dHJ1ZSwic2l0ZU9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifSwic3RlcHMiOlt7InN0ZXAiOiJpbnN0YWxsVGhlbWUiLCJ0aGVtZVppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3RoZW1lcyIsInNsdWciOiJhZHZlbnR1cmVyIn19LHsic3RlcCI6Imluc3RhbGxQbHVnaW4iLCJwbHVnaW5aaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy9wbHVnaW5zIiwic2x1ZyI6ImhlbGxvLWRvbGx5In19LHsic3RlcCI6Im1rZGlyIiwicGF0aCI6Ii93b3JkcHJlc3Mvd3AtY29udGVudC9wbHVnaW5zL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQifSx7InN0ZXAiOiJ3cml0ZUZpbGUiLCJwYXRoIjoiL3dvcmRwcmVzcy93cC1jb250ZW50L3BsdWdpbnMvaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIiwiZGF0YSI6Ijw/cGhwXG4vKlxuUGx1Z2luIE5hbWU6IFwiSGVsbG9cIiBvbiB0aGUgRGFzaGJvYXJkXG5EZXNjcmlwdGlvbjogQSBjdXN0b20gcGx1Z2luIHRvIHNob3djYXNlIFdvcmRQcmVzcyBCbHVlcHJpbnRzXG5WZXJzaW9uOiAxLjBcbkF1dGhvcjogV29yZFByZXNzIENvbnRyaWJ1dG9yc1xuKi9cblxuZnVuY3Rpb24gbXlfY3VzdG9tX3BsdWdpbigpIHtcbiAgICBlY2hvICc8aDE+SGVsbG8gZnJvbSBNeSBDdXN0b20gUGx1Z2luITwvaDE+Jztcbn1cblxuYWRkX2FjdGlvbignYWRtaW5fbm90aWNlcycsICdteV9jdXN0b21fcGx1Z2luJyk7In0seyJzdGVwIjoiYWN0aXZhdGVQbHVnaW4iLCJwbHVnaW5QYXRoIjoiaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIn1dfQ==)

Ganito ang itsura nito kapag nag-navigate ka sa dashboard:

![Site with the custom plugin](@site/static/img/blueprints/installed-custom-plugin.webp)

### Gumawa ng plugin at i-zip ito

Ang pag-encode ng PHP files bilang `JSON` ay maaaring maging useful para sa quick testing, pero ito ay inconvenient at mahirap basahin. Sa halip, gumawa ng file na may plugin code, i-compress ito, at gamitin ang `ZIP` file bilang `resource` sa [`installPlugin` step](/blueprints/steps#InstallPluginStep) para i-install ito (ang path sa `URL` ay dapat tumugma sa nasa iyong GitHub repository):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
			}
		}
	]
}
```

Maaari mong paikliin ang Blueprint na iyon gamit ang shorthand syntax:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fV19)

## 6. Baguhin ang site content

Sa wakas, burahin natin ang default content ng site at mag-import ng bago mula sa WordPress export file (WXR).

### Burahin ang lumang content

Walang Blueprint step para burahin ang default content, pero maaari mong gawin iyon gamit ang snippet ng PHP code:

```php
<?php
require '/wordpress/wp-load.php';

// Delete all posts and pages
$posts = get_posts(array(
    'numberposts' => -1,
    'post_type' => array('post', 'page'),
    'post_status' => 'any'
));

foreach ($posts as $post) {
    wp_delete_post($post->ID, true);
}
```

Para patakbuhin ang code na iyon habang nagse-setup ng site, gamitin ang [`runPHP` step](/blueprints/steps#RunPHPStep):

```json
{
	// ...
	"steps": [
		// ...
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		}
	]
}
```

### I-import ang bagong content

Gamitin natin ang [`importWxr` step](/blueprints/steps#ImportWXRStep) para mag-import ng WordPress export (`WXR`) file na tumutulong mag-test ng WordPress themes. Ang file ay available sa [WordPress/theme-test-data](https://github.com/WordPress/theme-test-data) repository, at maaari mong ma-access ito sa pamamagitan ng `raw.githubusercontent.com` address: [https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml](https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml).

Ganito ang itsura ng final na Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "My first Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2Fzc2V0cy9oZWxsby1mcm9tLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fSx7InN0ZXAiOiJydW5QSFAiLCJjb2RlIjoiPD9waHBcbnJlcXVpcmUgJy93b3JkcHJlc3Mvd3AtbG9hZC5waHAnO1xuXG4kcG9zdHMgPSBnZXRfcG9zdHMoYXJyYXkoXG4gICAgJ251bWJlcnBvc3RzJyA9PiAtMSxcbiAgICAncG9zdF90eXBlJyA9PiBhcnJheSgncG9zdCcsICdwYWdlJyksXG4gICAgJ3Bvc3Rfc3RhdHVzJyA9PiAnYW55J1xuKSk7XG5cbmZvcmVhY2ggKCRwb3N0cyBhcyAkcG9zdCkge1xuICAgIHdwX2RlbGV0ZV9wb3N0KCRwb3N0LT5JRCwgdHJ1ZSk7XG59In0seyJzdGVwIjoiaW1wb3J0V3hyIiwiZmlsZSI6eyJyZXNvdXJjZSI6InVybCIsInVybCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9Xb3JkUHJlc3MvdGhlbWUtdGVzdC1kYXRhL21hc3Rlci90aGVtZXVuaXR0ZXN0ZGF0YS53b3JkcHJlc3MueG1sIn19XX0=)

At iyon na iyon. Binabati kita sa paggawa ng iyong unang Blueprint! 🥳
