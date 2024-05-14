---
sidebar_position: 1
title: Blueprint data Format
---

# Blueprint data Format

A Blueprint can contain the following properties:

-   landingPage (string): The URL to navigate to after the Blueprint has been run.
-   [preferredVersions](#preferred-versions): The preferred PHP and WordPress versions to use.
-   [steps](./05-steps.md): The steps to run.

Here's a Blueprint that uses all of them:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "7.4",
		"wp": "6.5"
	},
	"phpExtensionBundles": ["kitchen-sink"],
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}} />

## JSON Schema

JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get autocompletion and validation in your editor:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	// ...
}
```

## Preferred Versions

The `preferredVersions` property, unsurprisingly, declares the preferred of PHP and WordPress versions to use. It can contain the following properties:

-   `php` (string): The preferred PHP version to use. Defaults to "latest". Only accepts major versions, like "7.4" or "8.0". Minor versions like "7.4.1" are not supported.
-   `wp` (string): Loads the specified WordPress version. Supported values: The last three major WordPress versions—minor versions, like `6.5.1`, are not supported. As of April 4, 2024, that's `6.3`, `6.4`, `6.5`. You can also use these values: `latest` (default), `nightly`, or `beta`.

## PHP extensions

The `phpExtensionBundles` property is an array of PHP extension bundles to load. The following bundles are supported:

-   `light`: Default choice. Saves 6MB of downloads, loads none of the  extensions below.
-   `kitchen-sink`: Installs [`gd`](https://www.php.net/manual/en/book.image.php), [`mbstring`](https://www.php.net/manual/en/mbstring.installation.php), [`iconv`](https://www.php.net/manual/en/function.iconv.php), [`openssl`](https://www.php.net/manual/en/book.openssl.php), [`libxml`](https://www.php.net/manual/en/book.libxml.php), [`xml`](https://www.php.net/manual/en/xml.installation.php), [`dom`](https://www.php.net/manual/en/intro.dom.php), [`simplexml`](https://www.php.net/manual/en/book.simplexml.php), [`xmlreader`](https://www.php.net/manual/en/book.xmlreader.php), [`xmlwriter`](https://www.php.net/manual/en/book.xmlwriter.php)

## Features

The `features` property is used to enable or disable certain features of the Playground. It can contain the following properties:

-   `networking`: Defaults to `false`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead.
