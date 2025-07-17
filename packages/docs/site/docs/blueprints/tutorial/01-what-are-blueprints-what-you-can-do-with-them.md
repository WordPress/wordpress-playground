---
title: What are Blueprints?
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: Getting started with Blueprints
---

# What are Blueprints, and what can you do with them?

With WordPress Playground you can create a whole website, including plugins, themes, content (posts, pages, taxonomy, and comments), settings (site name, users, permalinks, and more), etc. They allow you to generate a WooCommerce store complete with products, a magazine populated with articles, a corporate blog with multiple users, and more.

Blueprints are `JSON` files that you can use to configure Playground instances.

Blueprints support advanced use cases, like file system and database manipulation, and give you fine-grained control over the instance you create. The WordPress Test Team has been using Playground in [the 6.5 beta release cycle](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), creating a Blueprint that loads the latest version, several testing plugins, and dummy data.

## A simple example

A Blueprint might look something like this:

```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "My Blog",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

The Blueprint above installs the _Akismet_ and _Gutenberg_ plugins and the _Twenty Nineteen_ theme, sets the site name and description, and enables the WordPress debugging mode.

## The benefits of Blueprints

Blueprints are an invaluable tool for building WordPress sites via Playground

-   **Flexibility**: developers can make granular adjustments to the build process.
-   **Consistency**: ensure that every new site starts with the same configuration.
-   **Lightweight**: small text files that are easy to store and transfer.
-   **Transparency**: A Blueprint includes all the commands needed to build a snapshot of a WordPress site. You can read through it and understand how the site is built.
-   **Productivity**: reduces the time-consuming process of manually setting up a new WordPress site. Instead of installing and configuring themes and plugins for each new project, apply a Blueprint and set everything in one process.
-   **Up-to-date dependencies**: fetch the latest version of WordPress, a particular plugin, or a theme. Your snapshot is always up to date with the latest features and security fixes.
-   **Collaboration**: the `JSON` files are easy to review in tools like GitHub. Share Blueprints with your team or the WordPress community. Allowing others to use your well-configured setup.
-   **Experimentation and Learning**: For those new to WordPress or looking to experiment with different configurations, Blueprints provide a safe and easy way to try new setups without "breaking" a live site.
-   **WordPress.org integration**: offer a [demo of your plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) in the WordPress plugin directory, or a preview in a [Theme Trac ticket](https://meta.trac.wordpress.org/ticket/7382).
-   **Spinning a development environment**: A new developer in the team could download the Blueprint, run a hypothetical `wp up` command, and get a fresh developer environments—loaded with everything they need. The entire CI/CD process can reuse the same Blueprint.

:::info **More Resources**
Visit these links to learn more about the (endless) possibilities of Blueprints:

-   [Introduction to WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
-   Embed a pre-configured WordPress site in your website using the [WordPress Playground Block](https://wordpress.org/plugins/interactive-code-block/).
-   [Blueprints examples](/blueprints/examples)
-   [Demos and apps built with Blueprints](/resources#apps-built-with-wordpress-playground)

:::
