---
title: Data sources, paths, and bundles
slug: /blueprints/v2/resources
description: Reference remote, bundled, inline, Git, WordPress.org, and target-site data safely from Blueprint v2.
---

# Data sources, paths, and bundles

Blueprint v2 uses values that identify where data comes from. It does not use
v1 objects such as `{ "resource": "url" }` or
`{ "resource": "bundled" }`.

## The three path namespaces

| Namespace                   | Example                                       | Meaning                                                             |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Remote                      | `https://example.com/plugin.zip`              | Download a remote file or directory source                          |
| Blueprint execution context | `./assets/plugin.zip` or `/assets/plugin.zip` | Read data rooted beside `blueprint.json`                            |
| Target site                 | `site:wp-content/plugins/example/data.xml`    | Read mutable data under the target WordPress root at execution time |

The field decides how to interpret a path:

| Field kind             | Examples                                                             | Path meaning                                                                          |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| File data reference    | Content, media, and font sources; `runPHP.code`; `runSQL.source`     | `./` and `/` read Blueprint inputs; `site:` reads the target site                     |
| General data reference | Plugin, theme, and mu-plugin sources; `writeFiles` values            | `./` and `/` read Blueprint inputs; `site:` is not accepted                           |
| Tail-step target path  | `path`, `fromPath`, `toPath`, `extractToPath`, and `writeFiles` keys | Resolves under the target `/wordpress` filesystem; `site:` makes that intent explicit |

For example, the `writeFiles` key is a destination in WordPress while its value
is input data:

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

The leading `/` in an execution-context path does **not** mean the WordPress
filesystem. Both `/assets/plugin.zip` and `./assets/plugin.zip` are confined to
the Blueprint input context.

Use `site:` only when an earlier declaration or step creates the source inside
WordPress. For example, this imports sample data supplied by an installed
plugin:

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

`networkAccess: true` lets the WordPress importer fetch the remote attachments
named by the WXR file. It is not needed merely to read the `site:` source.

## Remote URLs

Use an HTTP or HTTPS string directly:

```jsonc
"plugins": [
	"https://example.com/releases/example-plugin.zip"
]
```

In a browser, the server must allow cross-origin fetches. A CLI run is not
subject to browser CORS, but it still needs network access and a stable URL.

`applicationOptions.wordpress-playground.networkAccess` controls outbound HTTP
from the resulting WordPress site. It is separate from the runner downloading
declared resources. Enable it only when the installed site itself needs the
WordPress HTTP API or other outbound access.

## WordPress.org plugins and themes

In `plugins`, `themes`, and `activeTheme`, a plain string is a WordPress.org
slug. Add `@version` to pin an available release:

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

`@latest` is convenient but mutable. Pin a tested version when repeatability
matters.

## Git directories

Use a Git source when the runnable plugin or theme files are already committed:

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

`ref` may name a branch, tag, or commit. Use an immutable commit for a
reproduction. Git sources do not run Composer, npm, or other build steps. If the
project needs a build, publish the built ZIP or place it in a bundle.

## Inline text files and directories

Small UTF-8 files can live in the declaration:

```jsonc
"muPlugins": [
	{
		"filename": "demo-notice.php",
		"content": "<?php add_action('admin_notices', function () { echo '<div class=\"notice\"><p>Demo site</p></div>'; });"
	}
]
```

An inline directory uses `directoryName` and nested `files` records:

```jsonc
{
	"directoryName": "example-plugin",
	"files": {
		"example-plugin.php": "<?php /* Plugin Name: Example */",
		"includes": {
			"files": {
				"setup.php": "<?php // Setup code",
			},
		},
	},
}
```

Inline content is text. Put ZIP archives, images, fonts, and other binary data
in a bundle or at a URL.

## Blueprint bundles

A bundle packages `blueprint.json` with its inputs:

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

The declaration refers to those paths directly:

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

Distribute the directory as-is or ZIP it. A ZIP may contain `blueprint.json` at
its root or inside one top-level directory. Do not add another unrelated
top-level tree.

Run a directory or ZIP with the CLI:

```bash
npx @wp-playground/cli@latest server --blueprint=./theme-demo
npx @wp-playground/cli@latest server --blueprint=./theme-demo.zip
```

For a standalone local JSON file that reads sibling files, explicit consent is
required:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--blueprint-may-read-adjacent-files
```

## Remote JSON and adjacent resources

When a hosted `blueprint.json` refers to `./assets/plugin.zip`, Playground
resolves the path relative to the JSON URL. The JSON and adjacent resource both
need to be publicly fetchable with suitable CORS headers in the browser.

## Path safety

- Execution-context paths cannot escape their root with `..` segments.
- `site:` paths stay under the target WordPress root; they never name an
  arbitrary host path.
- A bundle is input, not a safe-code boundary. Installed plugins, themes, PHP,
  SQL, and WP-CLI may execute code.
- Do not put secrets in Blueprint JSON, public URLs, repositories, or bundles.

See [security and reproducibility](./security) for the full trust model and
[troubleshooting](./troubleshooting) for fetch, CORS, and path errors.
