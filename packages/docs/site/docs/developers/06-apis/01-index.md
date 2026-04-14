---
title: APIs overview
slug: /developers/apis/
---

## WordPress Playground APIs overview

WordPress Playground exposes a few APIs that you can use to interact with the Playground:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### Query API

Basic operations can be done by adjusting the URL, for example here's how you can preinstall a coblocks plugin:

[https://playground.wordpress.net/?plugin=coblocks](https://playground.wordpress.net/?plugin=coblocks)

Or a theme:

[https://playground.wordpress.net/?theme=pendant](https://playground.wordpress.net/?theme=pendant)

This is called [Query API](/developers/apis/query-api/) and you can learn more about it [here](/developers/apis/query-api/). Once you have a URL that you like, you can embed it in your website using an iframe:

```html
<iframe style="width: 800px; height: 500px;" src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

:::info
Check the [Query API](/developers/apis/query-api) section for more info.
:::

### Blueprints

If you need more control over your Playground, you can use JSON Blueprints. For example, here's how to create a post and install a plugin:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
display={`{
  "steps": [
    {
      "step": "login"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "friends"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1)); ?>"
    }
  ]
}` }
blueprint={{
		"steps": [
            {
                "step": "login"
            },
            {
            step: 'installPlugin',
                pluginData: {
                    resource: 'wordpress.org/plugins',
                    slug: 'friends',
                },
            },
			{
				"step": "runPHP",
				"code": `<?php
require_once '/wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

<p></p>

:::info

Blueprints play a significant role in WordPress Playground, so they have their own dedicated documentation hub. Learn more about JSON Blueprints at the [Blueprints Docs Hub](/blueprints).

:::

### JavaScript API

The `@wp-playground/client` package provides a JavaScript API you can use to fully control your Playground instance. Here's a simple example of what you can do:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	// Use unpkg for convenience
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: `https://playground.wordpress.net/remote.html`,
	});
	// Let's wait until Playground is fully loaded
	await client.isReady();
</script>
```

:::info
Check the [JavaScript API](/developers/apis/javascript-api/) section for more info.
:::

## Playground APIs Concepts

WordPress Playground in the browser is all about links and iframes. Regardless of which API you choose, you will use it in one of the following ways:

### Link to the Playground site

You can customize WordPress Playground by modifying the https://playground.wordpress.net/ link. You can, for example, create a post, request a specific plugin, or run any PHP code.

To prepare such a link, use either the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).

Once it's ready, simply post it on your site. It makes a great "Try it yourself" button in a tutorial, for example.

#### Embed in an `<iframe>`

WordPress Playground can be embedded in your app using an `<iframe>`:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

To customize that Playground instance, you can:

- Load it from special link prepared using the [Query API](/developers/apis/query-api) (easy) or the [JSON Blueprints API](/blueprints) (medium).
- Control it using the [JavaScript API](/developers/apis/javascript-api/).

The JavaScript API gives you the most control, but it is also the least convenient option as it requires loading the Playground Client library.

:::caution Careful with the demo site

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

:::

### Browser APIs

The following Playground APIs are available in the browser:

- [Query API](/developers/apis/query-api) enable basic operations using only query parameters
- [Blueprints API](/blueprints) give you a great degree of control with a simple JSON file
- [JavaScript API](/developers/apis/javascript-api) give you full control via a JavaScript client from an npm package

### In Node.js

The following Playground APIs are available in Node.js:

- [JSON Blueprints API](/blueprints)
- [JavaScript API](/developers/apis/javascript-api/)

These APIs are very similar to their web counterparts, but, unsurprisingly, they are not based or links or iframes.
