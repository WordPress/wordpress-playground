---
sidebar_position: 8
title: Examples
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# Blueprints Examples

Let's see some cool things you can do with Blueprints.

## Install a Theme and a Plugin

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginZipFile": {
				"resource": "wordpress.org/plugins",
				"slug": "coblocks"
			}
		},
		{
			"step": "installTheme",
			"themeZipFile": {
				"resource": "wordpress.org/themes",
				"slug": "pendant"
			}
		}
	]
}} />

## Run custom PHP code

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php include 'wordpress/wp-load.php'; wp_insert_post(array( 'post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1 )); "
		}
	]
}` }
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": `<?php
include 'wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

## Enable an option on the Gutenberg Experiments page

Here: Switch on the "new admin views" feature.

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
		}
	]
}`}
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
			}
		]
}} />

## Showcase a product demo

<BlueprintExample noButton blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginZipFile": {
				"resource": "url",
				"url": "https://your-site.com/your-plugin.zip"
			}
		},
		{
			"step": "installTheme",
			"themeZipFile": {
				"resource": "url",
				"url": "https://your-site.com/your-theme.zip"
			}
		},
		{
			"step": "importFile",
			"file": {
				"resource": "url",
				"url": "https://your-site.com/starter-content.wxz"
			}
		},
		{
			"step": "setSiteOptions",
			"options": {
				"some_required_option_1": "your_favorite_values",
				"some_required_option_2": "your_favorite_values"
			}
		}
	]
}} />

## Enable PHP extensions and networking

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/plugin-install.php",
	"phpExtensionBundles": [
		"kitchen-sink"
	],
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		}
	]
}} />

## Load PHP code on every request (mu-plugin)

Use the `writeFile` step to add code to a mu-plugin that runs on every request.

<BlueprintExample blueprint={{
	"landingPage": "/category/uncategorized/",
	"phpExtensionBundles": [
		"kitchen-sink"
	],
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
			"data": "<?php add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
		}
	]
}} />

## Code editor (as a Gutenberg block)

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin/post.php?post=4&action=edit",
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    },
    {
      "step": "installPlugin",
      "pluginZipFile": {
        "resource": "wordpress.org/plugins",
        "slug": "interactive-code-block"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'WordPress Playground block demo!','post_content' => '<!-- wp:wordpress-playground/playground /-->', 'post_status' => 'publish', 'post_type' => 'post',]);"
    }
  ]
}} />

You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).
