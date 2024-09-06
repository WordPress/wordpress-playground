---
title: For Theme Developers
slug: /for-theme-developers
description: WordPress Playground for Theme Developers
---

The WordPress Playground is an innovative tool that allows theme developers to build, test and showcase their themes directly in a browser environment. This guide will explore how theme developers can leverage the WordPress Playground to enhance their development workflow, build demos, and streamline the theme review process.

## Launching a WordPress Playground Instance with a Theme

### Themes in the WordPress Themes Directory

With WordPress Playground, you can quickly launch a WordPress installation using any theme available in the [WordPress Themes Directory](https://wordpress.org/themes/). Simply pass the `theme` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) like this: https://playground.wordpress.net/?theme=disco.

### Themes in a GitHub repository

You can also load a theme stored in a GitHub repository. with a custom `blueprint.json` passed to the Playground instance.

With the `themeZipFile` property of the [`installTheme` blueprint step](/blueprints/steps#InstallThemeStep), you can define a [`url` resource](/blueprints/steps/resources#urlreference) that points to the location of the `.zip` file containing the theme you want to load in the Playground instance.

To avoid CORS issues, the Playground project provides a [GitHub proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your or theme.

:::tip
[GitHub proxy](https://playground.wordpress.net/proxy) is an incredibly useful tool to load themes from GitHub repositories as it allows you to load a theme from a specific branch, a specific directory, a specific commit or a specific PR.
:::

For example, the following `blueprint.json` installs a theme from a GitHub repository leveraging the https://github-proxy.com tool:

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeZipFile": {
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

A blueprint like the one above could be passed to a Playground instance [in several ways](/blueprints/using-blueprints).

## Customizing the initial setup for a theme

When providing a link to a WordPress Playground instance with a specific theme activated, you may also want to customize the inital setup for that theme.

Through the [different steps you can set in the `steps` property](/blueprints/steps) of a `blueprint.json` you'll be able to load, activate, and configure a theme.
Some of the things you can do via `steps` to provide an inital setup of your theme are:

-   With [`resetData`](/blueprints/steps#resetData) step you can remove the default content of a WordPress installation in order to import your own content.

```json
{
	"step": "resetData"
},
```

-   With [`writeFile`](/blueprints/steps#resetData) step you can writes data to a file at a specified path. You may want to use this step to write custom PHP code in a PHP file inside the `mu-plugins` of the Playground WordPress instance so the code is executed automatically when the instance is loaded.
    One of the things you can do through this step is to enable pretty permalinks for your Playground instance:

```json
{
	"step": "writeFile",
	"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
	"data": "<?php /* Use pretty permalinks */ add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
},
```

-   With [`updateUserMeta`](/blueprints/steps#updateUserMeta) step you can update any user meta data. For example, you could update the meta data of the default `admin` user of any WordPress installation:

```json
{
	"step": "updateUserMeta",
	"meta": {
		"first_name": "John",
		"last_name": "Doe",
		"admin_color": "modern"
	},
	"userId": 1
},
```

-   With [`importWxr`](/blueprints/steps#importWxr) step you can import your own content via a `.xml` file previously exported from an existing WordPress installation:

```json
{
	"step": "importWxr",
	"file": {
		"resource": "url",
		"url": "https://raw.githubusercontent.com/wordpress-juanmaguitar/blueprints/install-theme-directory-from-repo/blueprints/install-activate-setup-theme-from-gh-repo/blueprint-content.xml"
	}
},
```
