---
title: Getting started (v1 legacy)
slug: /blueprints/getting-started
description: Legacy Blueprint v1 documentation. A quick-start guide to Blueprints. Understand what problems they solve and the different ways you can start using them.
---

# Getting started with Blueprints

<div class="callout callout-warning">

**Blueprint v1 (legacy)**

This page documents Blueprint v1. Current Playground runners still accept v1 Blueprints,
but new work should use [Blueprint v2](/blueprints/v2). See
[Migrate from v1](/blueprints/v2/migrate-from-v1) to update an existing Blueprint.

</div>

Blueprints are JSON files for setting up your very own WordPress Playground instance. For example:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
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

- [Paste a Blueprint into the URL "fragment" on WordPress Playground website](/blueprints/using-blueprints#url-fragment).
- [Use them with the JavaScript API](/blueprints/using-blueprints#javascript-api).
- [Reference a blueprint JSON file via QueryParam blueprint-url](/developers/apis/query-api/)

## What problems are solved by Blueprints?

### No coding skills required

Blueprints are just JSON. You don't need a development environment, any libraries, or even JavaScript knowledge. You can write them in any text editor.

However, if you do have a development environment, that's great! You can use the [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) to get autocompletion and validation.

### HTTP Requests are managed for you

Blueprints fetch any resources you declare for you. You don't have to worry about managing multiple `fetch()` calls or waiting for them to finish. You can just declare a few links and let Blueprints handle and optimize the downloading pipeline.

### You can link to a Blueprint-preconfigured Playground

Because Blueprints can be pasted in the URL, you can embed or link to a Playground with a specific configuration. For example, clicking this button will open a Playground with PHP 8.3 and a pendant theme installed:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
  		"wp": "latest"
	},
	"steps": [
        {
            "step": "installTheme",
            "themeData": {
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
