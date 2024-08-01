---
title: API Consistency
---

# JSON API and Function API

Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly.

JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name):

You can use Blueprints both with the web and the node.js versions of WordPress Playground.

:::info Blueprints version 2

The team is exploring ways to transition Blueprints from a TypeScript library to a PHP library. This would allow people to run Blueprints in any WordPress environments: Playground, a hosted site, or a local setup.

The proposed [new specification](https://github.com/WordPress/blueprints-library/issues/6) is discussed on a separate [GitHub repository](https://github.com/WordPress/blueprints-library/), and you’re more than welcome to join (there or on the [#meta-playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) Slack channel) and help shape the next generation of Playground.
:::

## Differences between JSON and Function APIs

There are two main differences between the JSON and Function APIs:

1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself.
2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment.

:::note
Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic
:::
