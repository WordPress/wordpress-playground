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
		"wp": "5.9"
	},
	"phpExtensions": [
		"gd",
		"xml-bundle",
		"mbstring"
	],
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

-   `php` (string): The preferred PHP version to use. Defaults to 'latest'. Only accepts major versions like "7.4" or "8.0". Minor versions like "7.4.1" are not supported.
-   `wp` (string): The preferred WordPress version to use. Defaults to 'latest'. Only accepts major versions like "5.9" or "6.0". Minor versions like "5.9.1" are not supported.

## PHP extensions

The `phpExtensions` property is an array of PHP extensions to load. It can contain the following values:

-   `gd`: Installs the GD extension.
-   `xml-bundle`: Installs the XML bundle extension (libxml, xml, dom, simplexml, xmlreader, xmlwriter).
-   `mbstring`: Installs the mbstring extension.
