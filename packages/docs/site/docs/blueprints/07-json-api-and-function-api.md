---
title: API Consistency (v1 legacy)
slug: /blueprints/steps/api-consistency
description: Legacy Blueprint v1 documentation. Learn about the relationship between the Blueprint JSON format and the underlying JavaScript function API used to execute steps.
---

# JSON API and Function API

<div class="callout callout-warning">

**Blueprint v1 (legacy)**

This page documents Blueprint v1. Current Playground runners still accept v1 Blueprints,
but new work should use [Blueprint v2](/blueprints/v2). See
[Migrate from v1](/blueprints/v2/migrate-from-v1) to update an existing Blueprint.

</div>

Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly.

JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name):

You can use Blueprints both with the web and the node.js versions of WordPress Playground.

## Differences between JSON and Function APIs

There are two main differences between the JSON and Function APIs:

1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself.
2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment.

<div class="callout callout-info">

Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic

</div>
