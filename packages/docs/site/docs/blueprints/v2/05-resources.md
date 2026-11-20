---
title: Use files, URLs, and bundles
slug: /blueprints/v2/resources
description: Bring remote, bundled, inline, Git, WordPress.org, and target-site data into a Blueprint v2 safely.
---

# Use files, URLs, and bundles

A Blueprint can install plugins and themes, import content, add media, and run
code. The source syntax depends on where that data lives.

## Where does the file live?

Start with its location:

| Location                                       | Use                                 | Example                                          |
| ---------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| On the web                                     | Its HTTP or HTTPS URL               | `https://example.com/plugin.zip`                 |
| Beside `blueprint.json`                        | A path beginning with `./` or `/`   | `./assets/plugin.zip`                            |
| Already inside WordPress                       | A path beginning with `site:`       | `site:wp-content/uploads/data.xml`               |
| In the WordPress.org plugin or theme directory | Its slug, optionally with a version | `query-monitor@3.17.2`                           |
| In a Git repository                            | A Git source object                 | `{ "gitRepository": "..." }`                     |
| Short text you want to keep in the JSON        | An inline file or directory         | `{ "filename": "notice.php", "content": "..." }` |

The folder, ZIP, or remote location containing `blueprint.json` is the
**Blueprint execution context**. Paths beginning with `./` and `/` stay inside
that context. They do not point into WordPress.

<div class="callout callout-info">

**Migrating from v1?**

V2 uses direct values instead of v1 objects such as
`{ "resource": "url" }` and `{ "resource": "bundled" }`. See the
[resource migration map](./migrate-from-v1#resource-map) for each replacement.

</div>

## Paths beside your Blueprint

Both of these paths read the same file from the Blueprint execution context:

```jsonc
"./assets/plugin.zip"
"/assets/plugin.zip"
```

The leading `/` does **not** mean the WordPress filesystem. Use `site:` when a
file is already inside the WordPress site.

For example, WooCommerce installs a sample WXR file inside its plugin
directory. This Blueprint installs WooCommerce, then imports that file:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/",
			"login": true,
			"networkAccess": true
		}
	},
	"phpVersion": "8.3",
	"plugins": ["woocommerce"],
	"content": [
		{
			"type": "wxr",
			"source": "site:wp-content/plugins/woocommerce/sample-data/sample_products.xml",
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin",
			"importUsers": false,
			"importComments": false,
			"urlsMode": "rewrite",
			"staticAssets": "fetch"
		}
	]
}
```

Focus on the `source` line: the file exists only after the plugin is installed,
so it uses `site:`. Here, `networkAccess: true` lets the WordPress importer fetch
the remote attachments named by the WXR file. It is not needed merely to read
the `site:` source.

### Which fields accept each path?

Most readers can choose a source from the first table and let schema completion
guide them. Use this matrix when a path validates in one field but not another:

| Field kind             | Examples                                                             | Accepted paths                                                                     |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| File source            | Content, media, and font sources; `runPHP.code`; `runSQL.source`     | URLs, `./`, `/`, inline files, and `site:`                                         |
| General source         | Plugin, theme, and mu-plugin sources; `writeFiles` values            | URLs, `./`, `/`, inline data, and Git; not `site:`                                 |
| Post-setup destination | `path`, `fromPath`, `toPath`, `extractToPath`, and `writeFiles` keys | Paths under the target `/wordpress` filesystem; `site:` makes that intent explicit |

In `writeFiles`, the key is the destination inside WordPress and the value is
the source data:

```jsonc
"additionalStepsAfterExecution": [
	{
		"step": "writeFiles",
		"files": {
			"site:wp-content/mu-plugins/preview.php": {
				"filename": "preview.php",
				"content": "<?php // Runs as a must-use plugin."
			}
		}
	}
]
```

## Remote URLs

Use an HTTP or HTTPS string directly:

```jsonc
"plugins": [
	"https://example.com/releases/example-plugin.zip"
]
```

A browser v2 run currently needs the remote server to permit the resource fetch
through CORS. Do not rely on a Playground host's proxy support for ordinary v2
declared resources. The CLI is not subject to browser CORS, but every surface
still needs a reachable URL that returns the intended file.

`applicationOptions.wordpress-playground.networkAccess` controls outbound HTTP
from the resulting WordPress site. It is separate from the website, CLI, or
JavaScript runner downloading declared resources. Enable it only when installed
WordPress code needs outbound access.

## WordPress.org plugins and themes

In `plugins`, `themes`, and `activeTheme`, a string that is not a URL or a
`./` or `/` path is treated as a WordPress.org slug. Add `@version` to pin an
available release:

```jsonc
"plugins": [
	"query-monitor@3.17.2",
	{
		"source": "hello-dolly",
		"active": false,
		"ifAlreadyInstalled": "skip"
	}
],
"activeTheme": "twentytwentyfive@1.2"
```

An omitted version and `@latest` both follow the latest available release. Pin
a tested version when the same inputs should produce the same result later.

## Git directories

Use a Git source when runnable plugin or theme files are already committed:

```jsonc
"plugins": [
	{
		"source": {
			"gitRepository": "https://github.com/WordPress/block-development-examples",
			"ref": "trunk",
			"pathInRepository": "plugins/data-basics-59c8f8"
		},
		"targetDirectoryName": "data-basics",
		"active": true
	}
]
```

A branch such as `trunk` follows ongoing development. For a stable reproduction,
replace it with a full commit SHA. Git sources fetch committed files; they do
not run Composer, npm, or other build steps. If the project needs a build,
publish the built ZIP or include it in a bundle.

## Inline text files and directories

Small UTF-8 files can live directly in the Blueprint:

```jsonc
"muPlugins": [
	{
		"filename": "demo-notice.php",
		"content": "<?php add_action('admin_notices', function () { echo '<div class=\"notice\"><p>Demo site</p></div>'; });"
	}
]
```

An inline directory uses `directoryName` and nested `files` records. This is a
valid JSON source object, not a complete Blueprint:

```json
{
	"directoryName": "example-plugin",
	"files": {
		"example-plugin.php": "<?php /* Plugin Name: Example */",
		"includes": {
			"files": {
				"setup.php": "<?php // Setup code"
			}
		}
	}
}
```

Inline content is text. Put ZIP archives, images, fonts, and other binary data
in a bundle or at a URL.

## Blueprint bundles

A bundle keeps `blueprint.json` and its inputs together:

```text
theme-demo/
├── blueprint.json
├── themes/
│   └── example-theme.zip
├── content/
│   └── starter.wxr
└── media/
    └── hero.jpg
```

The bundle's `blueprint.json` refers to those paths directly:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/",
			"login": false,
			"networkAccess": true
		}
	},
	"phpVersion": "8.3",
	"activeTheme": "./themes/example-theme.zip",
	"content": [
		{
			"type": "wxr",
			"source": "./content/starter.wxr",
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin",
			"importUsers": false,
			"importComments": false,
			"urlsMode": "rewrite",
			"staticAssets": "fetch"
		}
	],
	"media": ["./media/hero.jpg"]
}
```

Distribute the directory as-is or ZIP it. In a ZIP, put `blueprint.json` at the
root or place the entire bundle inside one top-level directory.

Run either form with the CLI. A directory input is shorthand for its local
`blueprint.json`, so allow sibling-file reads when the bundle uses them. A ZIP
already provides a self-contained execution context and does not need the
flag:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./theme-demo \
	--blueprint-may-read-adjacent-files
npx @wp-playground/cli@latest server --blueprint=./theme-demo.zip
```

For a standalone local JSON file that reads sibling files, grant the same
access explicitly:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--blueprint-may-read-adjacent-files
```

### Hosted JSON with adjacent files

When a hosted `blueprint.json` refers to `./assets/plugin.zip`, Playground
resolves the path relative to the JSON URL. Both files must be publicly
fetchable. Browser runs also need suitable CORS headers on both responses.

## Keep resource boundaries clear

- `..` segments cannot leave the Blueprint execution context or target
  WordPress root.
- Local files and archives may contain symlinks or executable code; path
  validation is not a content review.
- A bundle is input, not a trust boundary. Plugins, themes, PHP, SQL, and WP-CLI
  commands may execute code.
- Keep secrets out of Blueprint JSON, public URLs, repositories, and bundles.

Next, read [security and reproducibility](./security) before sharing a bundle or
[troubleshooting](./troubleshooting) when a URL or path cannot be resolved.
