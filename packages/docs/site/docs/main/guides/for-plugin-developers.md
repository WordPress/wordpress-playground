---
title: For Plugin Developers
slug: /guides/for-plugin-developers
description: WordPress Playground for Plugin Developers
---

The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment.

This guide will explore **how you can leverage the WordPress Playground to enhance your plugin development workflow, create live demos to showcase your WordPress plugin to the world, and streamline your plugin testing process**.

:::info

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section.

:::

## Launching a Playground instance with a plugin

### Plugin in the WordPress themes directory

With WordPress Playground, you can quickly launch a WordPress installation with any plugin available in the [WordPress Plugins Directory](https://wordpress.org/plugins/) installed and activated. All you need to do is to add the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) and use the slug of the plugin from the WordPress directory as a value. For example: https://playground.wordpress.net/?plugin=create-block-theme

:::tip
You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
:::

You can also load any plugin from the WordPress plugins directory by setting the [`installPlugin` step](/blueprints/steps#InstallPluginStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginZipFile": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginZipFile%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).

### Plugin in a GitHub repository

A plugin stored in a GitHub repository can also be loaded in a Playground instance via Blueprints.

With the `pluginZipFile` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`url` resource](/blueprints/steps/resources#urlreference) that points to the location of the `.zip` file containing the plugin you want to load in the Playground instance.

To avoid CORS issues, the Playground project provides a [GitHub proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your plugin.

:::info
[GitHub proxy](https://playground.wordpress.net/proxy) is an incredibly useful tool to load plugins from GitHub repositories as it allows you to load a plugin from a specific branch, a specific directory, a specific commit or a specific PR.
:::

For example, the following `blueprint.json` installs a plugin from a GitHub repository leveraging the https://github-proxy.com tool:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginZipFile": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginZipFile%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=wptrainingteam/devblog-dataviews-plugin%22}}]})

### Plugin code from a gist

By combining the [`writeFile`](/blueprints/steps#WriteFileStep) and [`activatePlugin`](/blueprints/steps#activatePlugin) steps you can also launch a WP Playground instance with a plugin built on the fly from code stored on [a gist](https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php):

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/0-plugin.php",
			"data": {
				"resource": "url",
				"url": "https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginName": "Block Hooks Demo",
			"pluginPath": "0-plugin.php"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]})

## Setting up a demo for your plugin with Blueprints

When providing a link to a WordPress Playground instance with some plugins activated, you may also want to customize the initial setup for that Playground instance using those plugins. With Playground's [Blueprints](/blueprints/getting-started) you can load/activate plugins and configure the Playground instance.

:::tip

Some useful tools and resources provided by the Playground project to work with blueprints are:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

:::

Through properties and [`steps`](/blueprints/steps) in the Blueprint, you can configure the Playground instance's initial setup, providing your plugins with the content and configuration needed for showcasing your plugin's compelling features and functionality.

:::info

A great demo with WordPress Playground, might require that you load default content for your plugin and theme, including images and other assets. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

:::

### `plugins`

If your plugin has dependencies on other plugins you can use the `plugins` shorthand to install yours along with any other needed plugins.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

### `landingPage`

If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shorthand to automatically redirect to any page in the Playground instance upon loading.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

### `writeFile`

With the `writeFile` step you can create on the fly any plugin file taking the code from a file stored on a GitHub repo or a gist.

Here’s an example of a **[plugin that generates Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, placed in the `mu-plugins` folder to ensure the code runs automatically on load:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```

## Plugin Development

### Local plugin development and testing with Playground

From a plugins' folder in your local development environment, you can quickly load locally a Playground instance with that plugin loaded and activated.

Use the [`wp-now` command](/developers/local-development/wp-now) from your plugin's root directory using your preferred command line program.

With [Visual Studio Code](https://code.visualstudio.com/) IDE, you can also use the [Visual Studio Code extension](/developers/local-development/vscode-extension) while working in the root directory of your plugin.

For example:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-now/wp-now start
```

### See your local changes in a Playground instance and directly create PRs in a GitHub repo with your changes

With Google Chrome you can synchronize a Playground instance with your local plugin's code and your plugin's GitHub repo. With this connection you can:

-   See live (in the Playground instance) your local changes
-   Create PRs in the GitHub repo with your changes

Here's a little demo of this workflow in action:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

:::info

Check [About Playground > Build > Synchronize your playground instance with a local folder and create Github Pull Requests](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) for more info.

:::
