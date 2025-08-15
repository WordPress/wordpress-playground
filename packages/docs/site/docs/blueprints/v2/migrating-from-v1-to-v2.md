---
title: Migrating Blueprints from v1 to v2
slug: /blueprints/v2/migrating-blueprint-v1-to-v2
description: A guide to migrating WordPress Blueprints from v1 to the new, more declarative v2 format. Covers key changes and validation.
---

# Migrating Blueprints from v1 to v2

Migrating your Blueprints from v1 to v2 involves adopting a more declarative and structured format. While a [PHP-based transpiler](https://github.com/WordPress/php-toolkit/blob/trunk/components/Blueprints/Versions/Version1/V1ToV2Transpiler.php) exists, it may not produce the most idiomatic v2 Blueprint, as it tends to move v1 steps into the `additionalStepsAfterExecution` array. For a cleaner, more readable result, manual migration is recommended.

This guide will walk you through the key changes and show you how to use the Playground CLI to test your new v2 Blueprints.

## Key Changes to Pay Attention To

1.  **Add `"version": 2`**: This field is **mandatory** at the root of your Blueprint. The v2 runner will not work without it.
2.  **From `steps` to Declarative Properties**: Many common `steps` in v1 are now top-level properties in v2, making the format more readable.
    -   `installPlugin` steps should be moved to the `plugins` array.
    -   `installTheme` steps go into the `themes` array. To activate a theme, add the `activeTheme` property with the theme's directory name.
    -   `setSiteOptions` is now a top-level `siteOptions` object.
3.  **Playground-Specific Options**: The `landingPage` and `login` properties are now nested inside the `applicationOptions` object.
4.  **Version Specification**: The `preferredVersions` object is replaced by two separate top-level properties: `wordpressVersion` and `phpVersion`.
5.  **Defining Constants**: The `defineConsts` step is replaced by the top-level `constants` object.

## Side-by-Side Comparison

Here is an example of a v1 Blueprint and its equivalent in v2.

### Blueprint v1 Example

```json
{
	"landingPage": "/wp-admin/post-new.php?post_type=product",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "installPlugin",
			"pluginZipFile": {
				"resource": "wordpress.org/plugins",
				"slug": "woocommerce"
			},
			"options": {
				"activate": true
			}
		},
		{
			"step": "installTheme",
			"themeZipFile": {
				"resource": "wordpress.org/themes",
				"slug": "storefront"
			},
			"options": {
				"activate": true
			}
		},
		{
			"step": "setSiteOptions",
			"options": {
				"blogname": "My Online Store"
			}
		}
	]
}
```

### Blueprint v2 Equivalent

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"wordpressVersion": "latest",
	"phpVersion": "8.3",
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/post-new.php?post_type=product",
			"login": {
				"username": "admin",
				"password": "password"
			}
		}
	},
	"plugins": ["woocommerce"],
	"themes": ["storefront"],
	"activeTheme": "storefront",
	"siteOptions": {
		"blogname": "My Online Store"
	}
}
```

## Migrating and Validating with Playground CLI

The [`@wp-playground/cli`](/developers/local-development/wp-playground-cli) is an essential tool for testing and debugging your migrated Blueprints. It can run both v1 and v2 files, but you need to explicitly enable the v2 runner.

### Enabling the v2 Runner

To run a v2 Blueprint, you must use the `--experimental-blueprints-v2-runner` flag. Without it, the CLI will try to parse the file as v1 and fail.

```bash
npx @wp-playground/cli@latest server --blueprint=my-v2-blueprint.json --experimental-blueprints-v2-runner
```

### Getting Detailed Validation Errors

A major advantage of the v2 runner is its detailed schema validation. If you get the format wrong, it will provide specific error messages that pinpoint the problem.

For example, if you forget to add `"version": 2` or use an invalid property like `preferredVersions`, the v2 runner will give you a clear error message, unlike the generic errors you might see otherwise.

> **Error: Blueprint root: Property "preferredVersions" isn't allowed here.**

### Important Behavior Changes

The v2 runner is stricter than its v1 predecessor. Be aware of the following change:

-   **Execution Mode**: The v2 runner defaults to a `--mode=create-new-site`, which requires the target directory to be empty. If you run the command in a directory that already contains files, you will see an error: `The target site root directory must be empty in the create-new-site mode`. This is a safety feature to prevent accidental file overwrites.

For quick validation without starting a server, you can also use the [Playground Blueprint Builder](https://playground.wordpress.net/builder/builder.html).
