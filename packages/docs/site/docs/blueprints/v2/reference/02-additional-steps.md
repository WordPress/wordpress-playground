---
title: Run final setup steps
slug: /blueprints/v2/reference/additional-steps
description: Reference for command-like steps supported after Blueprint v2 site setup.
---

# Run final setup steps

Use `additionalStepsAfterExecution` for command-like work that the top-level v2
fields cannot express. Despite the property name, these steps are not outside
the Blueprint run: Playground performs them at the end of site setup, in array
order.

This property belongs to a Blueprint with the exact numeric discriminator
`"version": 2`. The public
[Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json)
is the source for the allowed variants and their fields.

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"additionalStepsAfterExecution": [
		{
			"step": "wp-cli",
			"command": "wp cache flush"
		}
	]
}
```

## Top-level field or final step?

Prefer a top-level field when it expresses the same result. Top-level fields let
Playground put work in the correct phase; final steps cannot reach backward and
change setup that already ran.

| Goal                                   | Prefer this top-level field        | Use this final step only when                                               |
| -------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| Define constants                       | `constants`                        | A constant must be introduced between two final steps                       |
| Update WordPress options               | `siteOptions`                      | The update must happen after content or another final step                  |
| Install plugins or themes              | `plugins`, `themes`, `activeTheme` | Installation must happen after all ordinary site fields                     |
| Set the site language                  | `siteLanguage`                     | Translation must happen at a specific point among final steps               |
| Import content or media                | `content`, `media`                 | The import depends on an earlier final step                                 |
| Write files or run PHP, SQL, or WP-CLI | No top-level equivalent            | The operation is necessary and cannot be represented as WordPress site data |

For example, a plugin declared in a final `installPlugin` step is installed
after top-level `postTypes` and `content`. Put it in top-level `plugins` when
those fields depend on the plugin.

## Find a step

| Task                                | Steps                                                                                                                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install or activate extensions      | [`installPlugin`](#blueprint-v2-step-install-plugin), [`activatePlugin`](#blueprint-v2-step-activate-plugin), [`installTheme`](#blueprint-v2-step-install-theme), [`activateTheme`](#blueprint-v2-step-activate-theme)                                     |
| Import or reset WordPress data      | [`importContent`](#blueprint-v2-step-import-content), [`importMedia`](#blueprint-v2-step-import-media), [`importThemeStarterContent`](#blueprint-v2-step-import-theme-starter-content), [`resetData`](#blueprint-v2-step-reset-data)                       |
| Update WordPress configuration      | [`defineConstants`](#blueprint-v2-step-define-constants), [`setSiteOptions`](#blueprint-v2-step-set-site-options), [`setSiteLanguage`](#blueprint-v2-step-set-site-language), [`enableMultisite`](#blueprint-v2-step-enable-multisite)                     |
| Create, copy, move, or remove files | [`mkdir`](#blueprint-v2-step-mkdir), [`writeFiles`](#blueprint-v2-step-write-files), [`cp`](#blueprint-v2-step-cp), [`mv`](#blueprint-v2-step-mv), [`rm`](#blueprint-v2-step-rm), [`rmdir`](#blueprint-v2-step-rmdir), [`unzip`](#blueprint-v2-step-unzip) |
| Run code or commands                | [`runPHP`](#blueprint-v2-step-run-php), [`runSQL`](#blueprint-v2-step-run-sql), [`wp-cli`](#blueprint-v2-step-wp-cli)                                                                                                                                      |

## Allowed step variants

Every entry requires the `step` discriminator. The required and optional shapes,
plus direct field defaults, are read from the current v2 schema. Nested content
and data-reference unions are abbreviated rather than expanded recursively. See
[Content and site data](/blueprints/v2/reference/content-and-site-data) and
[Use files, URLs, and bundles](/blueprints/v2/resources) for those shapes.

<!-- BEGIN GENERATED BLUEPRINT V2 ADDITIONAL STEPS REFERENCE -->

### `activatePlugin` {#blueprint-v2-step-activate-plugin}

Activates an installed plugin.

| Field               | Required | Type or shape      | Schema default | Description                                                                                                                                                                          |
| ------------------- | -------- | ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `step`              | Yes      | `"activatePlugin"` | —              | Selects the `activatePlugin` step.                                                                                                                                                   |
| `pluginPath`        | Yes      | `string`           | —              | Path to the plugin directory as absolute path (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file relative to the plugins directory (plugin-name/plugin-name.php). |
| `humanReadableName` | No       | `string`           | —              | Human-readable name of the plugin for the progress bar.                                                                                                                              |

### `activateTheme` {#blueprint-v2-step-activate-theme}

Activates an installed theme.

| Field                | Required | Type or shape     | Schema default | Description                                               |
| -------------------- | -------- | ----------------- | -------------- | --------------------------------------------------------- |
| `step`               | Yes      | `"activateTheme"` | —              | Selects the `activateTheme` step.                         |
| `themeDirectoryName` | Yes      | `string`          | —              | The name of the theme directory inside wp-content/themes/ |
| `humanReadableName`  | No       | `string`          | —              | Human-readable name of the theme for the progress bar.    |

### `cp` {#blueprint-v2-step-cp}

Copies a file within the target WordPress filesystem.

| Field      | Required | Type or shape | Schema default | Description                         |
| ---------- | -------- | ------------- | -------------- | ----------------------------------- |
| `step`     | Yes      | `"cp"`        | —              | Selects the `cp` step.              |
| `fromPath` | Yes      | `string`      | —              | Path to copy from inside WordPress. |
| `toPath`   | Yes      | `string`      | —              | Path to copy to inside WordPress.   |

### `defineConstants` {#blueprint-v2-step-define-constants}

Defines WordPress constants, at runtime by default.

| Field       | Required | Type or shape                                                                                           | Schema default | Description                            |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------- |
| `step`      | Yes      | `"defineConstants"`                                                                                     | —              | Selects the `defineConstants` step.    |
| `constants` | Yes      | `{ WP_DEBUG?: boolean; WP_DEBUG_LOG?: boolean; WP_DEBUG_DISPLAY?: boolean; SCRIPT_DEBUG?: boolean; … }` | —              | Constant names mapped to their values. |

### `enableMultisite` {#blueprint-v2-step-enable-multisite}

Converts the WordPress installation to a multisite network.

| Field  | Required | Type or shape       | Schema default | Description                                                          |
| ------ | -------- | ------------------- | -------------- | -------------------------------------------------------------------- |
| `step` | Yes      | `"enableMultisite"` | —              | Converts the target WordPress installation into a multisite network. |

### `importContent` {#blueprint-v2-step-import-content}

Imports one or more supported content sources.

| Field     | Required | Type or shape                              | Schema default | Description                       |
| --------- | -------- | ------------------------------------------ | -------------- | --------------------------------- |
| `step`    | Yes      | `"importContent"`                          | —              | Selects the `importContent` step. |
| `content` | Yes      | `(type-discriminated object (3 values))[]` | —              | Content entries to import.        |

### `importMedia` {#blueprint-v2-step-import-media}

Imports files into the WordPress Media Library.

| Field   | Required | Type or shape                                                                                                   | Schema default | Description                           |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------- |
| `step`  | Yes      | `"importMedia"`                                                                                                 | —              | Selects the `importMedia` step.       |
| `media` | Yes      | `(FileDataReference \| { source: FileDataReference; title?: string; description?: string; alt?: string; … })[]` | —              | Media sources and metadata to import. |

### `importThemeStarterContent` {#blueprint-v2-step-import-theme-starter-content}

Imports the active theme's starter content.

| Field       | Required | Type or shape                 | Schema default | Description                                   |
| ----------- | -------- | ----------------------------- | -------------- | --------------------------------------------- |
| `step`      | Yes      | `"importThemeStarterContent"` | —              | Selects the `importThemeStarterContent` step. |
| `themeSlug` | No       | `string`                      | —              | The name of the theme to import content from. |

### `installPlugin` {#blueprint-v2-step-install-plugin}

Installs a plugin and optionally activates it.

| Field                 | Required | Type or shape                                                                               | Schema default | Description                                                                                                                                 |
| --------------------- | -------- | ------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`              | Yes      | `DataReference \| PluginDirectoryReference`                                                 | —              | Plugin source to install.                                                                                                                   |
| `active`              | No       | `boolean`                                                                                   | `true`         | Whether to activate the plugin.                                                                                                             |
| `activationOptions`   | No       | `Record<string, string \| boolean \| number \| JSON value[] \| Record<string, JSON value>>` | —              | Parameters to pass to the plugin during activation.                                                                                         |
| `targetDirectoryName` | No       | `string`                                                                                    | —              | An explicit directory name within wp-content/plugins to install the plugin at. If not provided, it will be inferred from the plugin source. |
| `onError`             | No       | `"skip-plugin" \| "throw"`                                                                  | `"throw"`      | Sometimes it's fine when a plugin fails to install.                                                                                         |
| `ifAlreadyInstalled`  | No       | `"overwrite" \| "skip" \| "error"`                                                          | `"overwrite"`  | How to handle a plugin that is already installed.                                                                                           |
| `humanReadableName`   | No       | `string`                                                                                    | —              | Human-readable name of the plugin for the progress bar.                                                                                     |
| `step`                | Yes      | `"installPlugin"`                                                                           | —              | Selects the `installPlugin` step.                                                                                                           |

### `installTheme` {#blueprint-v2-step-install-theme}

Installs a theme and optionally activates it.

| Field                  | Required | Type or shape                              | Schema default | Description                                                                                                                              |
| ---------------------- | -------- | ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `source`               | Yes      | `ThemeDirectoryReference \| DataReference` | —              | Theme source to install.                                                                                                                 |
| `importStarterContent` | No       | `boolean`                                  | —              | Whether to import the theme's starter content after installing it.                                                                       |
| `targetDirectoryName`  | No       | `string`                                   | —              | An explicit directory name within wp-content/themes to install the theme at. If not provided, it will be inferred from the theme source. |
| `onError`              | No       | `"skip-theme" \| "throw"`                  | `"throw"`      | Sometimes it's fine when a theme fails to install.                                                                                       |
| `ifAlreadyInstalled`   | No       | `"overwrite" \| "skip" \| "error"`         | `"overwrite"`  | How to handle a theme that is already installed.                                                                                         |
| `humanReadableName`    | No       | `string`                                   | —              | Human-readable name of the theme for the progress bar.                                                                                   |
| `step`                 | Yes      | `"installTheme"`                           | —              | Selects the `installTheme` step.                                                                                                         |
| `active`               | No       | `boolean`                                  | —              | Whether to activate the theme after installing it.                                                                                       |

### `mkdir` {#blueprint-v2-step-mkdir}

Creates a directory in the target WordPress filesystem.

| Field  | Required | Type or shape | Schema default | Description                                |
| ------ | -------- | ------------- | -------------- | ------------------------------------------ |
| `step` | Yes      | `"mkdir"`     | —              | Selects the `mkdir` step.                  |
| `path` | Yes      | `string`      | —              | Directory path to create inside WordPress. |

### `mv` {#blueprint-v2-step-mv}

Moves a path within the target WordPress filesystem.

| Field      | Required | Type or shape | Schema default | Description                         |
| ---------- | -------- | ------------- | -------------- | ----------------------------------- |
| `step`     | Yes      | `"mv"`        | —              | Selects the `mv` step.              |
| `fromPath` | Yes      | `string`      | —              | Path to move from inside WordPress. |
| `toPath`   | Yes      | `string`      | —              | Path to move to inside WordPress.   |

### `rm` {#blueprint-v2-step-rm}

Unlinks a file in the target WordPress filesystem.

| Field  | Required | Type or shape | Schema default | Description                           |
| ------ | -------- | ------------- | -------------- | ------------------------------------- |
| `step` | Yes      | `"rm"`        | —              | Selects the `rm` step.                |
| `path` | Yes      | `string`      | —              | File path to remove inside WordPress. |

### `rmdir` {#blueprint-v2-step-rmdir}

Removes a directory from the target WordPress filesystem.

| Field  | Required | Type or shape | Schema default | Description                                |
| ------ | -------- | ------------- | -------------- | ------------------------------------------ |
| `step` | Yes      | `"rmdir"`     | —              | Selects the `rmdir` step.                  |
| `path` | Yes      | `string`      | —              | Directory path to remove inside WordPress. |

### `resetData` {#blueprint-v2-step-reset-data}

Removes selected site content, or all content when no types are given.

| Field          | Required | Type or shape                          | Schema default | Description                                                                                           |
| -------------- | -------- | -------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `step`         | Yes      | `"resetData"`                          | —              | Selects the `resetData` step.                                                                         |
| `contentTypes` | No       | `("posts" \| "pages" \| "comments")[]` | —              | Content types to remove. When omitted, all posts, pages, custom post types, and comments are removed. |

### `runPHP` {#blueprint-v2-step-run-php}

Runs a PHP file with optional environment variables.

| Field  | Required | Type or shape            | Schema default | Description                                |
| ------ | -------- | ------------------------ | -------------- | ------------------------------------------ |
| `step` | Yes      | `"runPHP"`               | —              | Selects the `runPHP` step.                 |
| `code` | Yes      | `FileDataReference`      | —              | The PHP file to execute.                   |
| `env`  | No       | `Record<string, string>` | —              | Environment variables to set for this run. |

### `runSQL` {#blueprint-v2-step-run-sql}

Runs SQL from a file source.

| Field    | Required | Type or shape       | Schema default | Description                |
| -------- | -------- | ------------------- | -------------- | -------------------------- |
| `step`   | Yes      | `"runSQL"`          | —              | Selects the `runSQL` step. |
| `source` | Yes      | `FileDataReference` | —              | SQL file to execute.       |

### `setSiteLanguage` {#blueprint-v2-step-set-site-language}

Sets the site language and downloads translations.

| Field      | Required | Type or shape       | Schema default | Description                         |
| ---------- | -------- | ------------------- | -------------- | ----------------------------------- |
| `step`     | Yes      | `"setSiteLanguage"` | —              | Selects the `setSiteLanguage` step. |
| `language` | Yes      | `string`            | —              | The language to set, e.g. 'en_US'   |

### `setSiteOptions` {#blueprint-v2-step-set-site-options}

Updates WordPress site options.

| Field     | Required | Type or shape                                                                               | Schema default | Description                                        |
| --------- | -------- | ------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------- |
| `step`    | Yes      | `"setSiteOptions"`                                                                          | —              | Selects the `setSiteOptions` step.                 |
| `options` | Yes      | `Record<string, string \| boolean \| number \| JSON value[] \| Record<string, JSON value>>` | —              | WordPress option names mapped to their new values. |

### `unzip` {#blueprint-v2-step-unzip}

Extracts a zip file into the target WordPress filesystem.

| Field           | Required | Type or shape       | Schema default | Description                                                        |
| --------------- | -------- | ------------------- | -------------- | ------------------------------------------------------------------ |
| `step`          | Yes      | `"unzip"`           | —              | Selects the `unzip` step.                                          |
| `zipFile`       | Yes      | `FileDataReference` | —              | The zip file resource to extract.                                  |
| `extractToPath` | Yes      | `string`            | —              | The path to extract the zip file to inside the virtual filesystem. |

### `wp-cli` {#blueprint-v2-step-wp-cli}

Runs a WP-CLI command.

| Field       | Required | Type or shape | Schema default | Description                                 |
| ----------- | -------- | ------------- | -------------- | ------------------------------------------- |
| `step`      | Yes      | `"wp-cli"`    | —              | Selects the `wp-cli` step.                  |
| `command`   | Yes      | `string`      | —              | WP-CLI command, including the leading `wp`. |
| `wpCliPath` | No       | `string`      | —              | Optional path to the WP-CLI executable.     |

### `writeFiles` {#blueprint-v2-step-write-files}

Writes data references to target filesystem paths.

| Field   | Required | Type or shape                   | Schema default | Description                         |
| ------- | -------- | ------------------------------- | -------------- | ----------------------------------- |
| `step`  | Yes      | `"writeFiles"`                  | —              | Selects the `writeFiles` step.      |
| `files` | Yes      | `Record<string, DataReference>` | —              | Target paths mapped to source data. |

<!-- END GENERATED BLUEPRINT V2 ADDITIONAL STEPS REFERENCE -->

## Timing rules

- Final steps run only after all top-level fields, and one final step completes
  before the next begins.
- A `defineConstants`, `setSiteLanguage`, `setSiteOptions`, or installation step
  cannot affect top-level work that has already finished.
- `installTheme` activates the installed theme by default. Set `active: false`
  when it should remain installed but inactive.
- A failure stops the remaining steps. Playground does not roll back earlier
  site changes.

## Target-site paths

Filesystem destinations stay under the target WordPress root. Prefer an
explicit `site:` path such as `site:wp-content/uploads/report.txt`. Existing
`/wordpress/...` paths and paths relative to the WordPress root are also
accepted. They do not point at arbitrary files on the host computer.

File inputs such as `runPHP.code`, `runSQL.source`, and `unzip.zipFile` may come
from a URL, a file beside the Blueprint, an inline file, or a `site:` path when
the field accepts it. See
[data sources, paths, and bundles](/blueprints/v2/resources) for the exact path
namespaces.

## Common patterns

### Run a small PHP program

`runPHP.code` is a file reference, not the raw PHP string accepted by v1. An
inline file keeps a short program in the Blueprint:

```jsonc
"additionalStepsAfterExecution": [
	{
		"step": "runPHP",
		"code": {
			"filename": "finish.php",
			"content": "<?php require '/wordpress/wp-load.php'; update_option('setup_complete', true);"
		},
		"env": {
			"BLUEPRINT_STAGE": "review"
		}
	}
]
```

Start inline PHP with `<?php`. Load `/wordpress/wp-load.php` before calling
WordPress functions.

### Write a file into WordPress

In `writeFiles`, each key is a destination and each value is the data to write:

```jsonc
"additionalStepsAfterExecution": [
	{
		"step": "writeFiles",
		"files": {
			"site:wp-content/mu-plugins/review-mode.php": {
				"filename": "review-mode.php",
				"content": "<?php define('REVIEW_MODE', true);"
			}
		}
	}
]
```

### Run WP-CLI

Use the same command string you would enter in a terminal, including `wp`:

```jsonc
"additionalStepsAfterExecution": [
	{
		"step": "wp-cli",
		"command": "wp cache flush"
	}
]
```

## Trust final steps as code

`runPHP`, `runSQL`, and `wp-cli` execute with the site's privileges. Plugin and
theme installation can execute third-party code, while file and reset steps can
remove data. Review the Blueprint and every referenced input before running it,
especially against an existing site.
