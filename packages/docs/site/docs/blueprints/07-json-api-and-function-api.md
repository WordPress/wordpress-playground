---
title: API Consistency
slug: /blueprints/steps/api-consistency
description: Learn about the relationship between the Blueprint JSON format and the underlying JavaScript function API used to execute steps.
---

# JSON API and Function API

Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly.

JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name):

You can use Blueprints both with the web and the node.js versions of WordPress Playground.

<div class="callout callout-info">

**Blueprints version 2**

Blueprint v2 declarations are supported by the Playground web app, client
package, and CLI. Version 2 keeps the JSON declaration model but moves WordPress
setup into higher-level sections such as `plugins`, `themes`, `content`, and
`media`, with escape hatches in `additionalStepsAfterExecution`.

The public [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json)
validates both v1 and v2 declarations. To opt into v2, set `"version": 2`.

</div>

## Differences between JSON and Function APIs

There are two main differences between the JSON and Function APIs:

1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself.
2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment.

<div class="callout callout-info">

Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic

</div>
