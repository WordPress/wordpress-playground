---
title: Blueprint Bundles
slug: /blueprints/bundles
description: Learn about Blueprint bundles, self-contained packages that include a blueprint.json file and all its required resources.
---

# Blueprint Bundles

Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups.

## What are Blueprint Bundles?

A Blueprint bundle is a collection of files that includes:

1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)

Blueprint bundles can be distributed in various formats:

- A ZIP file with a top-level `blueprint.json` file and additional resources
- A directory inside a git repository where `blueprint.json` resides alongside other resources
- A local directory on your computer
- An inline JavaScript object with the relevant files inlined

## Using Blueprint Bundles

### On the Website

The WordPress Playground website supports Blueprint bundles through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle:

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.

### In the CLI

The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide:

- A path to a local directory containing a Blueprint bundle
- A path to a local ZIP file containing a Blueprint bundle
- A URL to a remote Blueprint bundle (http:// or https://)

For example:

```bash
# Using a local ZIP file
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Using a remote URL
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Using a local directory
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

By default, the CLI restricts access to local files for security reasons. If your Blueprint needs to access files in the same parent directory, you need to explicitly grant permission using the `--blueprint-may-read-adjacent-files` flag:

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

## Creating Blueprint Bundles

### Basic Structure

A basic Blueprint bundle might look like this:

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

### Example Blueprint with Bundled Resources

Here's an example of a `blueprint.json` file that references bundled resources:

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/theme.zip"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/plugin.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content/sample-content.wxr"
			}
		}
	]
}
```

In this example, the Blueprint references several bundled resources:

- A text file at `/bundled-text-file.txt`
- A theme ZIP file at `/theme.zip`
- A plugin ZIP file at `/plugin.zip`
- A WXR content file at `/content/sample-content.wxr`

### Creating a ZIP Bundle

To create a ZIP bundle, simply create a directory with your `blueprint.json` and all required resources, then zip it up:

```bash
# Create a directory for your bundle
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Create your blueprint.json and add resources
# ...

# Zip it up
zip -r ../my-blueprint-bundle.zip .
```

## ZIP File Structure Flexibility

Blueprint bundles support `blueprint.json` at two locations within a ZIP file:

1. **Root level** (standard): `blueprint.json` sits directly at the ZIP root
2. **One directory deep**: `blueprint.json` sits inside a single top-level directory

This means ZIP files created with macOS's right-click "Compress" feature (which wraps contents in a folder) work automatically. The `__MACOSX` metadata directory is ignored during detection.

**Example: Both of these ZIP structures work:**

```
# Structure A (root level)
my-bundle.zip/
├── blueprint.json
├── theme.zip
└── plugin.zip

# Structure B (one directory deep — macOS-style)
my-bundle.zip/
├── my-bundle/
│   ├── blueprint.json
│   ├── theme.zip
│   └── plugin.zip
└── __MACOSX/         ← ignored
```

If multiple top-level directories contain a `blueprint.json`, Playground returns an error to avoid ambiguity.

## Troubleshooting

If you encounter issues with Blueprint bundles:

1. Ensure your `blueprint.json` file is at the root level of your ZIP file or inside a single top-level directory
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
