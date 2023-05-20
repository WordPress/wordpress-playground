---
sidebar_position: 8
title: Examples
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# Blueprints Examples

Let's see some cool things you can do with Blueprints.

### Install a Theme and a Plugin

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
			"pluginZipFile": {
				"resource": "wordpress.org/themes",
				"slug": "pendant"
			}
		}
	]
}} />

### Run custom PHP code

<BlueprintExample
display={`{
    "steps": [
        {
            "step": "runPHP",
            "code": \`<?php
include 'wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
\`
}
]
}`	}
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

### Showcase a product demo

<BlueprintExample blueprint={{
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
			"pluginZipFile": {
				"resource": "url",
				"url": "https://your-site.com/your-theme.zip"
			}
		},
		{
			"step": "importFile",
			"pluginZipFile": {
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
