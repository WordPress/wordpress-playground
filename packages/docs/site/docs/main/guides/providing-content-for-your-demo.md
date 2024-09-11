---
title: Providing content for your demo
slug: /guides/providing-content-for-your-demo
description: Providing content for your demo with WordPress Playground
---

One of the things you may want to do to provide a good demo with WordPress Playground is to load default content to better highlight the features of your plugin or theme. This default content may include images or other assets.

There are several blueprint steps and strategies you can use to import content (or generate it) in the Playground instance:

## `importWxr`

With the [`importWxr`](/blueprints/steps#importWxr) step, you can import your own content via a `.xml` file previously [exported from an existing WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/):

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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)

:::info
To include images in your imported content, a good approach is to upload the images to your GitHub repo and search/replace the path for them in the exported `.xml` file using the URL format: `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`.

```html
<!-- wp:image {"lightbox":{"enabled":false},"id":4751,"width":"78px","sizeSlug":"full","linkDestination":"none","align":"center","className":"no-border"} -->
<figure class="wp-block-image aligncenter size-full is-resized no-border">
	<img src="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/images/avatars.png" alt="" class="wp-image-4751" style="width:78px" />
</figure>
<!-- /wp:image -->
```

:::

It is recommended to upload your exported `.xml` file and any referenced assets (such as images) to the same directory as your `blueprint.json` in your GitHub repository.

## `importWordPressFiles`

With the [`importWordPressFiles`](/blueprints/steps#importWordPressFiles) step, you can import your own top-level WordPress files from a given `.zip` file into the instance's root folder. For example, if a `.zip` file contains the `wp-content` and `wp-includes` directories, they will replace the corresponding directories in Playground's root folder.

This `zip` file can be created from any Playground instance with the "Download as zip" option in the [Playground Options Menu](/web-instance#playground-options-menu).

You can prepare a demo for your WordPress theme or plugin (including images and other assets) in a Playground instance and then export a snapshot of that demo into a `.zip` file. This file can be imported later using the `importWordPressFiles` step.

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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/%22,%22login%22:true,%22steps%22:[{%22step%22:%22importWordPressFiles%22,%22wordPressFilesZip%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/adamziel/playground-sites/main/playground-for-site-builders/playground.zip%22}}]})

## `importThemeStarterContent`

[Some themes have starter content](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/) that can be published to highlight the features of a theme.

With the [`importThemeStarterContent` step](/blueprints/steps#importThemeStarterContent) you can publish the starter content of any theme even if that theme is not the one activated in the Playground instance.

```json

"steps": [
    {
      "step": "installTheme",
      "themeZipFile": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwenty"
      }
    },
    {
      "step": "installTheme",
      "themeZipFile": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwentyone"
      },
      "options": {
        "activate": true
      }
    },
    {
      "step": "importThemeStarterContent",
      "themeSlug": "twentytwenty"
    }
  ]

```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeZipFile%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeZipFile%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})

You can also publish the starter content of a theme when installing it with the [`installTheme` step](/blueprints/steps#installTheme) by setting to `true` its `importStarterContent` option:

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeZipFile": {
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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeZipFile%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

## `wp-cli`

Another way of generating content for your theme or plugin is via the `wp-cli` step that allows you to run [WP-CLI commands](https://developer.wordpress.org/cli/commands/) such as [`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):

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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20generate%20--count=20%20--post_type=post%20--post_date=1999-01-04%22}]})

You can also use the `wp-cli` step in combination with the `writeFile` step to create posts based on existing content and to import images to the Playground instance:

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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Use%20wp-cli%20to%20add%20a%20post%20with%20image%22,%22description%22:%22Use%20wp-cli%20to%20create%20a%20post%20from%20text%20file%20with%20block%20markup%20and%20a%20featured%20image%22,%22author%22:%22bph%22,%22categories%22:[%22Content%22,%22wpcli%22]},%22landingPage%22:%22/?p=4%22,%22login%22:true,%22steps%22:[{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/postcontent.md%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/postcontent.md%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20post%20create%20--post_title='Welcome%20to%20Playground'%20--post_status='published'%20/wordpress/wp-content/postcontent.md%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/Select-storage-method.png%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/wpcli-post-with-image/Select-storage-method.png%22}},{%22step%22:%22wp-cli%22,%22command%22:%22wp%20media%20import%20wordpress/wp-content/Select-storage-method.png%20--post_id=4%20--title='Select%20your%20storage%20method'%20--featured_image%22}]})

:::tip

Check the ["Use wp-cli to add a post with image"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image) example from the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to see the full example showing the connection between the content and the featured image.

:::
