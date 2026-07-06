---
title: Quick Start Guide for Developers
slug: /developers/build-your-first-app
description: Practical guide to embedding WordPress, installing plugins, previewing PRs, and building apps with Playground APIs.
---

# Quick Start Guide for Developers

WordPress Playground was created as a programmable tool. Below you'll find a few examples of what you can do with it. Each discussed API is described in detail in the [APIs section](/developers/apis/):

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

## Embed WordPress on your website

Playground can be embedded on your website using the HTML `<iframe>` tag as follows:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

Every visitor will get their own private WordPress instance for free. You can then customize it using one of the [Playground APIs](/developers/apis/).

<div class="callout callout-warning">

**Careful with the demo site**

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

</div>

## Control the embedded website

WordPress Playground provides three APIs you can use to control the iframed website. All the examples in this section are built using one of these:

- [Query API](/developers/apis/query-api) enable basic operations using only query parameters
- [Blueprints API](/blueprints) give you a great degree of control with a simple JSON file
- [JavaScript API](/developers/apis/javascript-api) give you full control via a JavaScript client from an npm package

Learn more about each of these APIs in the [APIs overview section](/developers/apis/).

## Showcase a plugin or theme from WordPress directory

You can install plugins and themes from the WordPress directory with only URL parameters. This iframe preinstalls the `coblocks` and `friends` plugins and the `pendant` theme.
This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/).

```html
<iframe src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

## Showcase any plugin or theme

What if your plugin is not in the WordPress directory?

You can still showcase it on Playground by using [JSON Blueprints](/blueprints). For example, this Blueprint would download and install a plugin and a theme from your website and also import some starter content:

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/your-plugin.zip"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://your-site.com/your-theme.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://your-site.com/starter-content.wxr"
			}
		}
	]
}
```

See [getting started with Blueprints](/blueprints/getting-started) to learn more.

## Preview pull requests from your repository

You can preview repository code two ways: directly with `git:directory`, or by pointing to a `.zip` from your CI pipeline. Here's the `git:directory` approach using [Blueprints](/blueprints):

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/my-user/my-repo",
				"ref": "refs/pull/1/head",
				"refType": "refname"
			},
			"options": {
				"activate": true
			},
			"progress": {
				"caption": "Installing plugin from my-user/my-repo PR #1"
			}
		}
	]
}
```

In the code above, it will install a plugin from a repository located at the `url`, and the reference to find the branch is `refType`; in this case, it will use `refname`, but it can also use `branch`, `tag`, and `commit`.

<div class="callout callout-tip">

You can automate this process using the [GitHub Action to generate preview links](/guides/github-action-pr-preview), which will help streamline the process.

</div>

Loading a `.zip` file is another alternative for previewing your project. See the [live example of Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html).

To use Playground as a PR previewer, you need:

- A CI pipeline that bundles your plugin or theme
- Public access to the generated `.zip` file

Those zip bundles aren't any different from regular WordPress Plugins, which means you can install them in Playground using the [JSON Blueprints](/blueprints) API. Once you expose an endpoint like https://your-site.com/pull-request-1234.zip, the following Blueprint will do the rest:

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/pull-request-1234.zip"
			}
		}
	]
}
```

The official Playground demo uses this technique to preview pull requests from the Gutenberg repository:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
blueprint={{
	"landingPage": "/wp-admin/plugins.php?test=42test",
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "mkdir",
			"path": "/wordpress/pr"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/pr/pr.zip",
			"data": {
				"resource": "url",
				"url": "/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&pr=60819",
				"caption": "Downloading Gutenberg PR 47739"
			},
			"progress": {
				"weight": 2,
				"caption": "Applying Gutenberg PR 47739"
			}
		},
		{
			"step": "unzip",
			"zipPath": "/wordpress/pr/pr.zip",
			"extractToPath": "/wordpress/pr"
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "vfs",
				"path": "/wordpress/pr/gutenberg.zip"
			}
		}
	]
	}} />

### Preview WordPress Core and Gutenberg Branches or PRs

You can preview specific pull requests from WordPress Core and Gutenberg repositories using Query API parameters. Gutenberg branches also have an alternative to preview them with the parameter `gutenberg-branch`. This is useful for testing the latest trunk changes or specific feature branches without creating a PR.

- Preview a specific WordPress Core PR: `https://playground.wordpress.net/?core-pr=9500`
- Preview a specific Gutenberg PR: `https://playground.wordpress.net/?gutenberg-pr=73010`
- Preview the Gutenberg trunk branch: `https://playground.wordpress.net/?gutenberg-branch=trunk`

## Build a compatibility testing environment

Test your plugin across PHP and WordPress versions by configuring them in Playground. This helps you verify compatibility before release.

With the Query API, you'd simply add the `php` and `wp` query parameters to the URL:

```html
<iframe src="https://playground.wordpress.net/?php=8.3&wp=6.1"></iframe>
```

With JSON Blueprints, you'd use the `preferredVersions` property:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.1"
	}
}
```

## Run PHP code in the browser

The JavaScript API provides the `run()` method which you can use to run PHP code in the browser:

```html
<iframe id="wp"></iframe>
<script type="module">
	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	await client.isReady;
	await client.run({
		code: `<?php
		require("/wordpress/wp-load.php");

		update_option("blogname", "Playground is really cool!");
		echo "Site title updated!";
		`,
	});
	client.goTo('/');
</script>
```

Combine that with a code editor like Monaco or CodeMirror, and you'll get live code snippets like in [this article](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)!
