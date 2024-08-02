---
title: APIs overview
slug: /apis-overview
---

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

# WordPress Playground APIs overview

WordPress Playground exposes a few APIs that you can use to interact with the Playground:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

## Query API

Basic operations can be done by adjusting the URL, for example here's how you can preinstall a coblocks plugin:

[https://playground.wordpress.net/?plugin=coblocks](https://playground.wordpress.net/?plugin=coblocks)

Or a theme:

[https://playground.wordpress.net/?theme=pendant](https://playground.wordpress.net/?theme=pendant)

<ThisIsQueryApi /> Once you have a URL that you like, you can embed it in your website using an iframe:

```html
<iframe style="width: 800px; height: 500px;" src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

:::info
Check the [Query API](../20-query-api/01-index.md) section for more info.
:::

## Blueprints

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

Blueprints play a significant role in WordPress Playground, so they have their own dedicated documentation hub. Learn more about JSON Blueprints at the [Blueprints Docs Hub](/wordpress-playground/blueprints).

:::

## JavaScript API

The `@wp-playground/client` package provides a JavaScript API you can use to fully control your Playground instance. Here's a very example of what you can do:

import JSApiShortExample from '@site/docs/\_fragments/\_js_api_short_example.mdx';

<JSApiShortExample />

:::info
Check the [JavaScript API](../22-javascript-api/01-index.md) section for more info.
:::
