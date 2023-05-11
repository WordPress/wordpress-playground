## Blueprints API

Blueprints are JSON files for setting up your very own WordPress Playground instance. You can use them to:

-   Showcase product demos – preinstall your plugin, set up starter content, and voila
-   Test Pull Requests – install your plugin from the zip artifact exposed by your CI
-   Build In-browser WordPress apps – like [GlotPress translations Playground](https://make.wordpress.org/polyglots/2023/04/19/wp-translation-playground/)

...and a lot more!

The Blueprints data format is described in details on the [Blueprints reference](./blueprints-reference.md) page. This page is a guide to using Blueprints.

## Why use Blueprints over other APIs?

Blueprints are the easiest way to create a Playground instance. You don't need to know any JavaScript, you just need to write some JSON. And if you use the [Blueprint schema](https://playground.wordpress.net/blueprint-schema.json), you'll be aided by autocompletion.

Furthermore, Blueprints `fetch()` resources in parallel and update the progress bar to provide the user with visual feedback.

Blueprints are also portable. You can share them with your team, or even publish them on GitHub for the world to see.

## Getting started

The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`. 

For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint:

```json
{
	"preferredVersions": {
		"php": "7.4",
		"wp": "5.9"
	}
}
```

And then you would go to
[https://playground.wordpress.net/#{"preferredVersions": {"php": "7.4","wp": "5.9"}}](https://playground.wordpress.net/#{%22preferredVersions%22:{%22php%22:%227.4%22,%22wp%22:%225.9%22}}).

To learn more about the data format, see the [Blueprints Reference](./blueprints-reference.md) page.

Let's see what other things you can do with Blueprints.

### Install a Theme and a Plugin

```json
{
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
}
```

[Try it now](https://playground.wordpress.net/#{%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginZipFile%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22coblocks%22}},{%22step%22:%22installTheme%22,%22pluginZipFile%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22pendant%22}}]})

### Run custom PHP code

```json
{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php
                include 'wordpress/wp-load.php';
                wp_insert_post(array(
                    'post_title'    => 'Post title',
                    'post_content'  => 'Post content',
                    'post_status'   => 'publish',
                    'post_author'   => 1
                ));
            "
		}
	]
}
```

[Try it now](<https://playground.wordpress.net/#%7B%22steps%22:%5B%7B%22step%22:%22runPHP%22,%22code%22:%22%3C?php%20include%20'wordpress/wp-load.php';wp_insert_post(array('post_title'=%3E'Post%20title','post_content'=%3E'Post%20content','post_status'=%3E'publish'));%22%7D%5D%7D>)


### Showcase product demos

```json
{
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
}
```

