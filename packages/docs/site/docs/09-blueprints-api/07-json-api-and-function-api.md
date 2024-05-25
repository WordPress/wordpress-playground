---
title: API Consistency
---

https://github.com/WordPress/wordpress-playground/pull/215

# JSON API and Function API

Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly.

JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name):

import BlueprintStep from '@site/src/components/BlueprintsAPI/BlueprintStep';
import { BlueprintSteps } from '@site/src/components/BlueprintsAPI/model';

<span>{BlueprintSteps.map((name) => (
<>
<BlueprintStep name={name} key={name} />

<hr/>
</>
))}</span>

You can use Blueprints both with the web and the node.js versions of WordPress Playground.

## Differences between JSON and Function APIs

There are two main differences between the JSON and Function APIs:

1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself.
2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment.
