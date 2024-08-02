---
title: Getting started with Blueprints
---

# Getting started with Blueprints

Blueprints are JSON files for setting up your very own WordPress Playground instance. For example:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.0",
		"wp": "latest"
	},
	"phpExtensionBundles": ["kitchen-sink"],
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}
```

There are three ways to use Blueprints:

-   [Paste a Blueprint into the URL "fragment" on WordPress Playground website](./02-using-blueprints.md#url-fragment).
-   [Use them with the JavaScript API](./02-using-blueprints.md#javascript-api).
-   [Reference a blueprint JSON file via QueryParam blueprint-url](../developers/20-query-api/01-index.md)

## What problems are solved by Blueprints?

### No coding skills required

Blueprints are just JSON. You don't need a development environment, any libraries, or even JavaScript knowledge. You can write them in any text editor.

However, if you do have a development environment, that's great! You can use the [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) to get autocompletion and validation.

### HTTP Requests are managed for you

Blueprints fetch any resources you declare for you. You don't have to worry about managing multiple `fetch()` calls or waiting for them to finish. You can just declare a few links and let Blueprints handle and optimize the downloading pipeline.

### You can link to a Blueprint-preconfigured Playground

Because Blueprints can be pasted in the URL, you can embed or link to a Playground with a specific configuration. For example, clicking this button will open a Playground with PHP 7.4 and a pendant theme installed:

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "7.4",
  		"wp": "latest"
	},
	"steps": [
        {
            "step": "installTheme",
            "themeZipFile": {
                "resource": "wordpress.org/themes",
            	"slug": "pendant"
            },
            "options": {
                "activate": true
            }
        }
	]
}} />

### Trusted by default

Blueprints are just JSON. Running other people's Blueprints doesn't require the element of trust. Since Blueprints cannot execute arbitrary JavaScript, they are limited in what they can do.

With Blueprints, WordPress.org plugin directory may be able to offer live previews of plugins. Plugin authors will just write a custom Blueprint to preconfigure the Playground instance with any site options or starter content they may need.

### Write it once, use it anywhere

Blueprints work both on the web and in node.js. You can run them both in the same JavaScript process, and through a remote Playground Client. They are the universal language of configuration. Where you can run Playground, you can use Blueprints.
