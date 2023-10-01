---
title: Using Blueprints
---

# Using Blueprints

You can use Blueprints in one of two ways:

-   By passing them as a URL fragment to the Playground.
-   By using the JavaScript API.

## URL Fragment

The easiest way to start using Blueprints is to paste one into the URL "fragment" on WordPress Playground website, e.g. `https://playground.wordpress.net/#{"preferredVersions...`.

For example, to create a Playground with specific versions of WordPress and PHP you would use the following Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "7.4",
		"wp": "5.9"
	}
}
```

And then you would go to
`https://playground.wordpress.net/#{"preferredVersions": {"php":"7.4", "wp":"5.9"}}`.

You won't have to paste links to follow along. We'll use code examples with a "Try it out" button that will automatically run the examples for you:

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "7.4",
		"wp": "5.9"
	}
}} />

## JavaScript API

You can also use Blueprints with the JavaScript API using the `startPlaygroundWeb()` function from the `@wp-playground/client` package. Here's a small, self-contained example you can run on JSFiddle or CodePen:

```html
<iframe id="wp-playground" style="width: 1200px; height: 800px"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://unpkg.com/@wp-playground/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp-playground'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
		blueprint: {
			landingPage: '/wp-admin/',
			preferredVersions: {
				php: '8.0',
				wp: 'latest',
			},
			steps: [
				{
					step: 'login',
					username: 'admin',
					password: 'password',
				},
				{
					step: 'installPlugin',
					pluginZipFile: {
						resource: 'wordpress.org/plugins',
						slug: 'friends',
					},
				},
			],
		},
	});

	const response = await client.run({
		// wp-load.php is only required if you want to interact with WordPresss.
		code: '<?php require_once "/wordpress/wp-load.php"; \$posts = get_posts(); echo "Post Title: " . \$posts[0]->post_title;',
	});
	console.log(response.text);
</script>
```
