---
title: APIs overview
slug: /developers/apis/
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

## WordPress Playground APIs overview

WordPress Playground exposes a few APIs that you can use to interact with the Playground:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### Query API

Basic operations can be done by adjusting the URL, for example here's how you can preinstall a coblocks plugin:

[https://playground.wordpress.net/?plugin=coblocks](https://playground.wordpress.net/?plugin=coblocks)

Or a theme:

[https://playground.wordpress.net/?theme=pendant](https://playground.wordpress.net/?theme=pendant)

<ThisIsQueryApi /> Once you have a URL that you like, you can embed it in your website using an iframe:

```html
<iframe style="width: 800px; height: 500px;" src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

:::info
Check the [Query API](../query-api/) section for more info.
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
      "pluginZipFile": {
        "resource": "wordpress.org/plugins",
        "slug": "friends"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php include 'wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1)); ?>"
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
                pluginZipFile: {
                    resource: 'wordpress.org/plugins',
                    slug: 'friends',
                },
            },
			{
				"step": "runPHP",
				"code": `<?php
include 'wordpress/wp-load.php';
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

Blueprints play a significant role in WordPress Playground, so they have their own dedicated documentation hub. Learn more about JSON Blueprints at the [Blueprints Docs Hub](../../blueprints/01-index.md).

:::

### JavaScript API

The `@wp-playground/client` package provides a JavaScript API you can use to fully control your Playground instance. Here's a very example of what you can do:

import JSApiShortExample from '@site/docs/\_fragments/\_js_api_short_example.mdx';

<JSApiShortExample />

:::info
Check the [JavaScript API](../javascript-api/) section for more info.
:::

## Playground APIs Concepts

WordPress Playground in the browser is all about links and iframes. Regardless of which API you choose, you will use it in one of the following ways:

### Link to the Playground site

You can customize WordPress Playground by modifying the https://playground.wordpress.net/ link. You can, for example, create a post, request a specific plugin, or run any PHP code.

To prepare such a link, use either the [Query API](./query-api/) (easy) or the [JSON Blueprints API](../../blueprints/01-index.md) (medium).

Once it's ready, simply post it on your site. It makes a great "Try it yourself" button in a tutorial, for example.

#### Embed in an `<iframe>`

WordPress Playground can be embedded in your app using an `<iframe>`:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

To customize that Playground instance, you can:

-   Load it from special link prepared using the [Query API](./query-api/) (easy) or the [JSON Blueprints API](../../blueprints/01-index.md) (medium).
-   Control it using the [JavaScript API](./javascript-api/).

The JavaScript API gives you the most control, but it is also the least convenient option as it requires loading the Playground Client library.

import PlaygroundWpNetWarning from '@site/docs/\_fragments/\_playground_wp_net_may_stop_working.md';

<PlaygroundWpNetWarning />

### Browser APIs

The following Playground APIs are available in the browser:

import APIList from '@site/docs/\_fragments/\_api_list.mdx';

<APIList />

### In Node.js

The following Playground APIs are available in Node.js:

-   [JSON Blueprints API](../../blueprints/01-index.md)
-   [JavaScript API](./javascript-api/01-index.md)

These APIs are very similar to their web counterparts, but, unsurprisingly, they are not based or links or iframes.
