---
title: Providing content for your demo with Playground
slug: /guides/providing-content-for-your-demo
description: Learn how to populate your Playground demo with content using Blueprints, WP-CLI, or PHP to showcase themes and plugins.
---

One of the things you may want to do to provide a good demo with WordPress
Playground is to load default content to better highlight the features of your
plugin or theme. This default content may include images or other assets.

There are several [Blueprint steps](/blueprints/steps) and strategies you can
use to import content (or generate it) in the Playground instance. This guide
walks through the available sources. For a focused comparison of XML, PHP, and
ZIP imports—including pros, cons, and measured performance—see
[Importing content into WordPress with Blueprints](/guides/import-content-with-blueprints).

## `importWxr`

With the [`importWxr` step](/blueprints/steps), you can import content from a
WordPress eXtended RSS (WXR) `.xml` file previously
[exported from an existing WordPress installation](https://wordpress.org/documentation/article/tools-export-screen/).

The step can fetch attachments, rewrite URLs, include or exclude comments, and
control how imported authors map to local users. This example assigns imported
content to the existing `admin` user and leaves attachment downloads disabled:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint-content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": true,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L43)

Set `authorsMode` to `create` to create local users for imported authors, or to
`map` and provide `authorsMap` when the corresponding users already exist. You
can also provide `urlMapping` for explicit old-to-new URL replacements.

To download the media referenced by the export, set `fetchAttachments` to
`true` and enable Blueprint networking. The original media URLs must still be
available:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://example.com/wordpress-export.xml"
			},
			"fetchAttachments": true
		}
	]
}
```

<div class="callout callout-info">

When the original attachment URLs are unavailable, one approach is to upload
the images to the repository that hosts the Blueprint and replace their paths
in the exported `.xml` file. For a public GitHub repository, use a raw URL such
as `https://raw.githubusercontent.com/{repo}/{branch}/{image_path}`.

```html
<!-- wp:image {"lightbox":{"enabled":false},"id":4751,"width":"78px","sizeSlug":"full","linkDestination":"none","align":"center","className":"no-border"} -->
<figure class="wp-block-image aligncenter size-full is-resized no-border">
	<img src="https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/images/avatars.png" alt="" class="wp-image-4751" style="width:78px" />
</figure>
<!-- /wp:image -->
```

</div>

For a self-contained demo, place the exported `.xml` file and its assets next
to `blueprint.json` in a [Blueprint bundle](/blueprints/bundles), and use a
[`bundled` resource](/blueprints/steps/resources) instead of a remote URL.

## `importWordPressFiles`

With the [`importWordPressFiles` step](/blueprints/steps), you can restore the
top-level WordPress files from a `.zip` file into the instance's root folder.
For example, if an archive contains `wp-content` and `wp-includes`, those
directories replace the corresponding directories in Playground.

The ZIP can be created from a Playground instance with the **Download as zip**
option in the [Playground Options Menu](/web-instance).
Current Playground exports include a manifest that lets the import step update
Playground scope URLs after restoration.

You can prepare a demo for your WordPress theme or plugin—including the
database, images, plugins, themes, and settings—in a Playground instance and
then export a snapshot of that demo. The snapshot can be restored later using
`importWordPressFiles`. This example expects `site.zip` next to `blueprint.json`
in a [Blueprint bundle](/blueprints/bundles):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

The step can detect a complete WordPress directory inside a wrapper folder. If
an archive contains more than one site or needs an explicit starting directory,
set `pathInZip` to the directory that contains the WordPress files. Keep the
source and destination WordPress, PHP, theme, and plugin versions compatible,
and only restore ZIP files from sources you trust because they can contain an
entire database and executable PHP.

## `importThemeStarterContent`

[Some themes have starter content](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/)
that can be published to highlight the features of a theme.

With the [`importThemeStarterContent` step](/blueprints/steps), you can publish
the starter content of any installed theme, even if that theme is not activated
in the Playground instance:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwenty"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
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
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22}},{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwentyone%22},%22options%22:{%22activate%22:true}},{%22step%22:%22importThemeStarterContent%22,%22themeSlug%22:%22twentytwenty%22}]})

You can also publish the starter content of a theme while installing it with the
[`installTheme` step](/blueprints/steps) by setting its `importStarterContent`
option to `true`:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
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

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

## `wp-cli`

Another way of generating content for your theme or plugin is the
[`wp-cli` step](/blueprints/steps). It runs
[WP-CLI commands](https://developer.wordpress.org/cli/commands/) such as
[`wp post generate`](https://developer.wordpress.org/cli/commands/post/generate/):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
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

You can also combine the `wp-cli` step with the
[`writeFile` step](/blueprints/steps) to create posts from existing content and
import images into the Playground instance:

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

<div class="callout callout-tip">

Check the
[“Use wp-cli to add a post with image”](https://github.com/WordPress/blueprints/tree/trunk/blueprints/wpcli-post-with-image)
example from the
[Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)
to see the full example showing the connection between the content and the
featured image.

</div>

## `runPHP`

With the [`runPHP` step](/blueprints/steps), you can run PHP code to insert or
configure data in your WordPress installation, for example with the
[`wp_insert_post` function](https://developer.wordpress.org/reference/functions/wp_insert_post/).
Load `/wordpress/wp-load.php` before calling WordPress APIs, and handle errors
so a failed setup does not silently produce an incomplete demo:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\n$post_id = wp_insert_post(\n\tarray(\n\t\t'post_title'   => 'Simple post from PHP',\n\t\t'post_content' => '<!-- wp:paragraph --><p>This is a simple post inserted with wp_insert_post.</p><!-- /wp:paragraph -->',\n\t\t'post_author'  => 1,\n\t\t'post_status'  => 'publish',\n\t),\n\ttrue\n);\n\nif ( is_wp_error( $post_id ) ) {\n\tthrow new RuntimeException( $post_id->get_error_message() );\n}"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](<https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/edit.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22runPHP%22,%22code%22:%22%3C?php%20require_once%20'/wordpress/wp-load.php';%20wp_insert_post(array('post_title'%20=%3E%20'Simple%20post%20from%20wp_insert_post',%20'post_content'%20%20=%3E%20'%3C!--%20wp:paragraph%20--%3E%3Cp%3EThis%20is%20a%20simple%20post%20inserted%20with%20wp_insert_post%3C/p%3E%3C!--%20/wp:paragraph%20--%3E',%20'post_author'%20%20%20=%3E%201,%20'post_status'%20=%3E%20'publish'));%20?%3E%22}]}>)

For small, deterministic fixtures, `runPHP` keeps setup logic close to the
Blueprint. For large editorial datasets or a complete prepared site, WXR or a
ZIP snapshot is usually easier to maintain. The
[import comparison guide](/guides/import-content-with-blueprints) explains the
trade-offs in detail.
