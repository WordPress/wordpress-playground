---
title: For Plugin Developers
slug: /guides/for-plugin-developers
description: WordPress Playground for Plugin Developers
---

The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment.

This guide will explore **how you can leverage the WordPress Playground to enhance your plugin development workflow, create live demos to showcase your WordPress plugin to the world, and streamline your plugin testing process**.

:::info

Discover how you can leverage WordPress Playground to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products in the [About Playground](/about) section

:::

## Launching a Playground instance with a plugin

### Plugin in the WordPress themes directory

With WordPress Playground, you can quickly launch a WordPress installation using any plugin available in the [WordPress PLugins Directory](https://wordpress.org/plugins/). Simply pass the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) like this: https://playground.wordpress.net/?plugin=gutenberg.

:::tip
You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
:::

### Plugin in a GitHub repository

You can also load a plugin stored in a GitHub repository with a custom Blueprint passed to the Playground instance.

With the `pluginZipFile` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`url` resource](/blueprints/steps/resources#urlreference) that points to the location of the `.zip` file containing the plugin you want to load in the Playground instance.

To avoid CORS issues, the Playground project provides a [GitHub proxy](https://playground.wordpress.net/proxy) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your plugin.

:::info
[GitHub proxy](https://playground.wordpress.net/proxy) is an incredibly useful tool to load plugins from GitHub repositories as it allows you to load a plugin from a specific branch, a specific directory, a specific commit or a specific PR.
:::

For example, the following `blueprint.json` installs a theme from a GitHub repository leveraging the https://github-proxy.com tool:

```json
{
	"steps": [
        ...,
		 {
            "step": "installPlugin",
            "pluginZipFile": {
                "resource": "wordpress.org/plugins",
                "slug": "gutenberg"
            },
            "options": {
                "activate": true
            }
        },
        ...
	]
}
```

### Plugin code from a gist

You can launch a WP Playground instance with [a plugin built on the fly from code on a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]})

```json
"steps": [
    {
        "step": "login"
    },
    {
        "step": "writeFile",
        "path": "/wordpress/wp-content/plugins/0-plugin.php",
        "data": {
            "resource": "url",
            "url": "https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php"
        }
    },
    {
        "step": "activatePlugin",
        "pluginName": "Block Hooks Demo",
        "pluginPath": "0-plugin.php"
    }
]
```

:::info
Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
:::
