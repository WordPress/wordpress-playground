---
title: For Theme Developers
slug: /for-theme-developers
description: WordPress Playground for Theme Developers
---

The WordPress Playground is an innovative tool that allows theme developers to build, test, and showcase their themes directly in a browser environment.

This guide will explore **how you can leverage the WordPress Playground to enhance your theme development workflow, create live demos to showcase your WordPress theme to the world, and streamline your theme review process**.

:::info

Discover how you can leverage WordPress Playground to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products in the [About Playground](/about) section

:::

## Launching a Playground instance with a theme

### Themes in the WordPress themes directory

With WordPress Playground, you can quickly launch a WordPress installation using any theme available in the [WordPress Themes Directory](https://wordpress.org/themes/). Simply pass the `theme` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) like this: https://playground.wordpress.net/?theme=disco.

### Themes in a GitHub repository

You can also load a theme stored in a GitHub repository with a custom `blueprint.json` passed to the Playground instance.

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

## Setting up a demo theme with Blueprints

When providing a link to a WordPress Playground instance with a specific theme activated, you may also want to customize the initial setup for that theme.

By providing a [blueprint](/blueprints/getting-started) to Playground you'll be able to load, activate, and configure a theme.

:::tip

Some useful tools and resources provided by the Playground project to work with blueprints are:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

:::

Through properties and [`steps`](/blueprints/steps) in the blueprint, you can configure the initial setup of your theme in the Playground instance:

### `resetData`

With the [`resetData`](/blueprints/steps#resetData) step, you can remove the default content of a WordPress installation in order to import your own content.

```json
"steps": [
	...,
	{
		"step": "resetData"
	},
	...
]
```

### `writeFile`

With the [`writeFile`](/blueprints/steps#resetData) step, you can write data to a file at a specified path. You may want to use this step to write custom PHP code in a PHP file inside the `mu-plugins` folder of the Playground WordPress instance, so the code is executed automatically when the WordPress instance is loaded.
One of the things you can do through this step is to enable pretty permalinks for your Playground instance:

```json
"steps": [
	...,
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
		"data": "<?php /* Use pretty permalinks */ add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
	},
	...
]
```

### `updateUserMeta`

With the [`updateUserMeta`](/blueprints/steps#updateUserMeta) step, you can update any user metadata. For example, you could update the metadata of the default `admin` user of any WordPress installation:

```json
"steps": [
	...,
	{
		"step": "updateUserMeta",
		"meta": {
			"first_name": "John",
			"last_name": "Doe",
			"admin_color": "modern"
		},
		"userId": 1
	},
	...
]
```

### `importWxr`

With the [`importWxr`](/blueprints/steps#importWxr) step, you can import your own content via a `.xml` file previously [exported from an existing WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/):

```json
"steps": [
	...,
	{
		"step": "importWxr",
		"file": {
			"resource": "url",
			"url": "https://raw.githubusercontent.com/wordpress-juanmaguitar/blueprints/install-theme-directory-from-repo/blueprints/install-activate-setup-theme-from-gh-repo/blueprint-content.xml"
		}
	},
	...
]
```

:::info
One of the things you'll want to import for your default content is images. A recommended approach is to upload the images to your GitHub repo and search/replace the path for them in the exported `.xml` file using the URL format: `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`.

```html
<!-- wp:image {"lightbox":{"enabled":false},"id":4751,"width":"78px","sizeSlug":"full","linkDestination":"none","align":"center","className":"no-border"} -->
<figure class="wp-block-image aligncenter size-full is-resized no-border">
	<img src="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/images/avatars.png" alt="" class="wp-image-4751" style="width:78px" />
</figure>
<!-- /wp:image -->
```

:::

It is recommended to upload your exported `.xml` file and any referenced assets (such as images) to the same directory as your `blueprint.json` in your GitHub repository.

### `setSiteOptions`

With the [`setSiteOptions`](/blueprints/steps#setSiteOptions) step, you can set [site options](https://developer.wordpress.org/apis/options/#available-options-by-category) such as the site name, description, or page to use for posts.

```json
"steps": [
	...,
	{
		"step": "setSiteOptions",
		"options": {
			"blogname": "Rich Tabor",
			"blogdescription": "Multidisciplinary maker specializing in the intersection of product, design and engineering. Making WordPress.",
			"show_on_front": "page",
			"page_on_front": 6,
			"page_for_posts": 2
		}
	},
	...
]
```

There's also a [`siteOptions`](/blueprints/steps/shorthands#siteoptions) shorthand that can be used instead of the `setSiteOptions` step.

### `plugins`

With the [`plugins`](/blueprints/steps/shorthands#plugins) shorthand you can set a list of plugins you want to be installed and activated with your theme in the Playground instance.

```json
"plugins": ["todo-list-block", "markdown-comment-block"]
```

You can also use the [`installPlugin`](/blueprints/steps#installPlugin) step to install and activate plugins for your Playground instance but the shorthand way is recommended.

### `login`

With the [`login`](/blueprints/steps/shorthands#login) shorthand you can launch your Playground instance with the admin user logged in.

```json
 "login": true,
```

You can also use the [`login`](/blueprints/steps#login) step to launch your Playground instance logged in with any specific user.

:::tip

The ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) blueprint example is a great reference that shows how to load, activate and configure a block themes on a Playground instance. [Open it in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) or [view the `blueprint.json` source](https://github.com/wordpress/blueprints/blob/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json).
:::

## Theme development

### Local theme development and testing with Playground

From the root folder of a block theme's code, you can quickly load locally a Playground instance with that theme loaded and activated. You can do that by launching, in a theme directory, the [`wp-now` command](/developers/local-development/wp-now) from your preferred command line program or the [Visual Code Studio extension](/developers/local-development/vscode-extension) from the [Visual Studio Code](https://code.visualstudio.com/) IDE.

For example:

```
git clone git@github.com:WordPress/community-themes.git
cd community-themes/blue-note
npx @wp-now/wp-now start
```

### Design your theme using the WordPress UI and save your changes as Pull Requests

You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you’ve done through the WordPress UI in the Playground instance, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin. You can also make changes to that theme and export a zip.

Note that you'll need the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin installed and activated in the Playground instance in order to use this workflow.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

:::tip

Check [About Playground > Build > Save changes done on a Block Theme and create GitHub Pull Requests](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) for more info.

:::
