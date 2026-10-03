---
title: Getting Started with Blueprints v2
slug: /blueprints/v2
description: Getting started with Blueprints
---

# Getting Started with Blueprints v2

Blueprints are `JSON` files that you can use to configure WordPress Playground instances. They allow you to define a complete WordPress setup, including plugins, themes, content, and settings, in a single, shareable file.

With Blueprints v2, this process becomes more declarative
and structured. Here is a simple example:

```json tile="Blueprint V2"
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"wordpressVersion": "latest",
	"phpVersion": "8.3",
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/",
			"login": true
		}
	},
	"plugins": ["gutenberg", "woocommerce"],
	"activeTheme": "storefront",
	"siteOptions": {
		"blogname": "My Blueprint v2 Store"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

This Blueprint sets up a WordPress site with the latest version, activates the Gutenberg and WooCommerce plugins, sets `storefront` as the active theme, defines the site name, and enables debugging mode.

One option to run a blueprint is using the [Playground CLI](/developers/local-development/wp-playground-cli), so run the server command with both flags `--blueprint` to specify the file to be executed and `--experimental-blueprints-v2-runner` to enable blueprints v2:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint-v2.json --experimental-blueprints-v2-runner
```

## Key Features of Blueprints v2

-   **Declarative Structure**: Instead of relying on a series of steps for common tasks, v2 uses dedicated top-level properties like plugins, themes, siteOptions, and constants.
-   **Schema Versioning**: Blueprints v2 requires a `"version": 2` field, ensuring that the runner correctly interprets the file format.
-   **Explicit is Better**: All site options must be declared within the `siteOptions` property, avoiding ambiguity.
-   **Application-Specific Options**: Configuration specific to the environment, like landingPage or login for WordPress Playground, is neatly organized under applicationOptions.
-   **Rich Configuration**: V2 provides fine-grained control over plugins, themes, content import, users, roles, and more, directly within the JSON structure.

:::important Important Considerations for v2

-   **Experimental Flag is Required**: The v2 runner is still considered experimental, so you must include the --experimental-blueprints-v2-runner flag. Without it, the CLI will attempt to parse your file as a v1 Blueprint and fail.
-   **Stricter Validation**: A key benefit of the v2 runner is improved validation. If your blueprint.json file has errors, the CLI will provide detailed feedback pointing to the exact issue, making debugging much easier.
-   **Directory Requirements**: The v2 runner defaults to a create-new-site mode, which requires the target directory to be empty. This is a stricter and safer default than the v1 runner. If you encounter an error like The target site root directory must be empty, ensure you are running the command in an empty folder.
    :::
