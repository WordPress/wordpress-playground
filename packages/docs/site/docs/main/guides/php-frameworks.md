---
title: Run PHP frameworks in Playground
slug: /guides/php-frameworks
description: Use WordPress Playground as a browser-based PHP runtime for frameworks and apps that are not WordPress.
sidebar_class_name: navbar-build-item
---

import { PhpCodeSnippetExample } from '@site/src/components/PhpCodeSnippetLiveExample';

# Run PHP frameworks in Playground

WordPress Playground is also a browser-based PHP runtime. WordPress is the
most common app it boots, but a Blueprint can skip the WordPress download,
write any PHP files into the virtual filesystem, and run a framework such as
Symfony.

This guide shows the shape of that setup. Use it when you want a shareable demo,
a docs example, or a quick compatibility check for a PHP app that does not need
a server, database, Node.js, Sass, or a local Composer install.

## What changes when you skip WordPress

Set `preferredVersions.wp` to `false` in a Blueprint, or `wp="none"` on a
`<php-snippet>`. Playground still downloads PHP, mounts a writable filesystem,
runs Blueprint steps, and supports networking when `features.networking` is
`true`. It just does not download or boot WordPress.

That makes Playground useful for generic PHP examples:

- PHP libraries that need a real filesystem.
- Framework demos that can run behind `public/index.php`.
- Documentation snippets that should execute in the browser.
- Reproducible bug reports for PHP code that is not WordPress-specific.

## Try a Symfony app

The example below uses a Blueprint to download and unzip a bundled Symfony app,
then a `<php-snippet>` boots the Symfony kernel and renders the dashboard route.
The snippet prints the Symfony response status, the page title, and whether a
WordPress install exists.

<PhpCodeSnippetExample name="symfonyBlueprint" />

Here is the complete embed:

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<script id="symfony-blueprint" type="application/json">
	{
		"features": {
			"networking": true
		},
		"steps": [
			{
				"step": "unzip",
				"zipFile": {
					"resource": "url",
					"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/symfony-package-radar/symfony-package-radar.zip"
				},
				"extractToPath": "/wordpress"
			}
		]
	}
</script>

<php-snippet name="run-symfony.php" wp="none" blueprint="symfony-blueprint">
	<script type="application/x-php">
		<?php
		require '/wordpress/symfony-package-radar/vendor/autoload.php';

		use App\Kernel;
		use Symfony\Component\HttpFoundation\Request;

		$kernel = new Kernel( 'prod', false );
		$request = Request::create( '/' );
		$response = $kernel->handle( $request );

		preg_match( '/<h1>(.*?)<\/h1>/', $response->getContent(), $match );

		echo 'HTTP ' . $response->getStatusCode() . PHP_EOL;
		echo 'Symfony page: ' . html_entity_decode( $match[1] ?? 'unknown' ) . PHP_EOL;
		echo 'WordPress installed: ';
		echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';

		$kernel->terminate( $request, $response );
	</script>
	<script type="text/expected-output">
		HTTP 200
		Symfony page: Package Radar
		WordPress installed: no
	</script>
</php-snippet>
```

The same app is also available as a full Playground page:

[Open the Symfony Package Radar demo](https://playground.wordpress.net/?blueprint-url=https%3A%2F%2Fraw.githubusercontent.com%2FWordPress%2Fblueprints%2Ftrunk%2Fblueprints%2Fsymfony-package-radar%2Fblueprint.json)

## Package the app as a ZIP

For framework demos, prefer a ZIP that already contains `vendor/`. That keeps
the Playground startup path short and avoids asking every visitor to wait for
Composer, Git, and package registry downloads.

A small Blueprint can then install the app with one step:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/symfony-package-radar/public/index.php",
	"preferredVersions": {
		"php": "8.4",
		"wp": false
	},
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "unzip",
			"zipFile": {
				"resource": "bundled",
				"path": "./symfony-package-radar.zip"
			},
			"extractToPath": "/wordpress"
		}
	]
}
```

Use `bundled` resources when the ZIP ships next to `blueprint.json`, or use a
`url` resource when the ZIP is hosted separately. See [Blueprint bundles](/blueprints/bundles)
for packaging details.

## Keep the demo browser-friendly

A Playground-hosted framework demo works best when it:

- Does not require a long-running background process.
- Stores generated files under the virtual filesystem.
- Avoids native extensions that are not compiled into PHP.wasm.
- Avoids frontend build steps at runtime.
- Keeps network calls optional or resilient, because browsers may require CORS
  proxying for third-party services.

Those constraints still leave plenty of room for real framework behavior:
controllers, routing, dependency injection, templates, forms, HTTP clients, and
plain PHP libraries all work when their PHP dependencies are available.
