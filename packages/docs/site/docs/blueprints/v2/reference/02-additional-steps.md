---
title: Additional steps after execution
slug: /blueprints/v2/reference/additional-steps
description: Reference for imperative steps supported after Blueprint v2 site setup.
---

# Additional steps after execution

Use `additionalStepsAfterExecution` for imperative work that cannot be expressed by
the declarative v2 properties. The runner performs these steps after site setup, in
array order.

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

Prefer top-level v2 properties when they express the same result. They let the
runner plan site creation consistently across execution targets. Keep this array
for the imperative tail.

## Allowed step variants

Every entry requires the `step` discriminator. The required and optional shapes,
plus direct field defaults, are read from the checked-in v2 schema. Nested content
and data-reference unions are abbreviated rather than expanded recursively. See
[Content and site data](/blueprints/v2/reference/content-and-site-data) and
[Resources, paths, and bundles](/blueprints/v2/resources) for those shapes.

<!-- BEGIN GENERATED BLUEPRINT V2 ADDITIONAL STEPS REFERENCE -->

<a id="blueprint-v2-step-activate-plugin"></a>

### `activatePlugin`

Activates an installed plugin.

| Field               | Required | Type or shape      | Schema default | Description                                                                                                                                                                          |
| ------------------- | -------- | ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `step`              | Yes      | `"activatePlugin"` | —              | —                                                                                                                                                                                    |
| `pluginPath`        | Yes      | `string`           | —              | Path to the plugin directory as absolute path (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file relative to the plugins directory (plugin-name/plugin-name.php). |
| `humanReadableName` | No       | `string`           | —              | Human-readable name of the plugin for the progress bar.                                                                                                                              |

<a id="blueprint-v2-step-activate-theme"></a>

### `activateTheme`

Activates an installed theme.

| Field                | Required | Type or shape     | Schema default | Description                                               |
| -------------------- | -------- | ----------------- | -------------- | --------------------------------------------------------- |
| `step`               | Yes      | `"activateTheme"` | —              | —                                                         |
| `themeDirectoryName` | Yes      | `string`          | —              | The name of the theme directory inside wp-content/themes/ |
| `humanReadableName`  | No       | `string`          | —              | Human-readable name of the theme for the progress bar.    |

<a id="blueprint-v2-step-cp"></a>

### `cp`

Copies a file within the target WordPress filesystem.

| Field      | Required | Type or shape | Schema default | Description |
| ---------- | -------- | ------------- | -------------- | ----------- |
| `step`     | Yes      | `"cp"`        | —              | —           |
| `fromPath` | Yes      | `string`      | —              | —           |
| `toPath`   | Yes      | `string`      | —              | —           |

<a id="blueprint-v2-step-define-constants"></a>

### `defineConstants`

Defines WordPress constants, at runtime by default.

| Field       | Required | Type or shape                                                                                        | Schema default | Description |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------- | -------------- | ----------- |
| `step`      | Yes      | `"defineConstants"`                                                                                  | —              | —           |
| `constants` | Yes      | `{ WP_DEBUG?: boolean; WP_DEBUG_LOG?: boolean; WP_DEBUG_DISPLAY?: boolean; SCRIPT_DEBUG?: boolean }` | —              | —           |

<a id="blueprint-v2-step-enable-multisite"></a>

### `enableMultisite`

Converts the WordPress installation to a multisite network.

| Field  | Required | Type or shape       | Schema default | Description                                                          |
| ------ | -------- | ------------------- | -------------- | -------------------------------------------------------------------- |
| `step` | Yes      | `"enableMultisite"` | —              | Converts the target WordPress installation into a multisite network. |

<a id="blueprint-v2-step-import-content"></a>

### `importContent`

Imports one or more supported content sources.

| Field     | Required | Type or shape                              | Schema default | Description |
| --------- | -------- | ------------------------------------------ | -------------- | ----------- |
| `step`    | Yes      | `"importContent"`                          | —              | —           |
| `content` | Yes      | `(type-discriminated object (3 values))[]` | —              | —           |

<a id="blueprint-v2-step-import-media"></a>

### `importMedia`

Imports files into the WordPress Media Library.

| Field   | Required | Type or shape                                                                                                   | Schema default | Description |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------- | -------------- | ----------- |
| `step`  | Yes      | `"importMedia"`                                                                                                 | —              | —           |
| `media` | Yes      | `(FileDataReference \| { source: FileDataReference; title?: string; description?: string; alt?: string; … })[]` | —              | —           |

<a id="blueprint-v2-step-import-theme-starter-content"></a>

### `importThemeStarterContent`

Imports the active theme's starter content.

| Field       | Required | Type or shape                 | Schema default | Description                                   |
| ----------- | -------- | ----------------------------- | -------------- | --------------------------------------------- |
| `step`      | Yes      | `"importThemeStarterContent"` | —              | —                                             |
| `themeSlug` | No       | `string`                      | —              | The name of the theme to import content from. |

<a id="blueprint-v2-step-install-plugin"></a>

### `installPlugin`

Installs a plugin and optionally activates it.

| Field                 | Required | Type or shape                                                                               | Schema default | Description                                                                                                                                 |
| --------------------- | -------- | ------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`              | Yes      | `DataReference \| PluginDirectoryReference`                                                 | —              | —                                                                                                                                           |
| `active`              | No       | `boolean`                                                                                   | `true`         | Whether to activate the plugin.                                                                                                             |
| `activationOptions`   | No       | `Record<string, string \| boolean \| number \| JSON value[] \| Record<string, JSON value>>` | —              | Parameters to pass to the plugin during activation.                                                                                         |
| `targetDirectoryName` | No       | `string`                                                                                    | —              | An explicit directory name within wp-content/plugins to install the plugin at. If not provided, it will be inferred from the plugin source. |
| `onError`             | No       | `"skip-plugin" \| "throw"`                                                                  | `"throw"`      | Sometimes it's fine when a plugin fails to install.                                                                                         |
| `ifAlreadyInstalled`  | No       | `"overwrite" \| "skip" \| "error"`                                                          | `"overwrite"`  | How to handle a plugin that is already installed.                                                                                           |
| `humanReadableName`   | No       | `string`                                                                                    | —              | Human-readable name of the plugin for the progress bar.                                                                                     |
| `step`                | Yes      | `"installPlugin"`                                                                           | —              | —                                                                                                                                           |

<a id="blueprint-v2-step-install-theme"></a>

### `installTheme`

Installs a theme and optionally activates it.

| Field                  | Required | Type or shape                              | Schema default | Description                                                                                                                              |
| ---------------------- | -------- | ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `source`               | Yes      | `ThemeDirectoryReference \| DataReference` | —              | —                                                                                                                                        |
| `importStarterContent` | No       | `boolean`                                  | —              | Whether to import the theme's starter content after installing it.                                                                       |
| `targetDirectoryName`  | No       | `string`                                   | —              | An explicit directory name within wp-content/themes to install the theme at. If not provided, it will be inferred from the theme source. |
| `onError`              | No       | `"skip-theme" \| "throw"`                  | `"throw"`      | Sometimes it's fine when a theme fails to install.                                                                                       |
| `ifAlreadyInstalled`   | No       | `"overwrite" \| "skip" \| "error"`         | `"overwrite"`  | How to handle a theme that is already installed.                                                                                         |
| `humanReadableName`    | No       | `string`                                   | —              | Human-readable name of the theme for the progress bar.                                                                                   |
| `step`                 | Yes      | `"installTheme"`                           | —              | —                                                                                                                                        |
| `active`               | No       | `boolean`                                  | —              | Whether to activate the theme after installing it.                                                                                       |

<a id="blueprint-v2-step-mkdir"></a>

### `mkdir`

Creates a directory in the target WordPress filesystem.

| Field  | Required | Type or shape | Schema default | Description |
| ------ | -------- | ------------- | -------------- | ----------- |
| `step` | Yes      | `"mkdir"`     | —              | —           |
| `path` | Yes      | `string`      | —              | —           |

<a id="blueprint-v2-step-mv"></a>

### `mv`

Moves a path within the target WordPress filesystem.

| Field      | Required | Type or shape | Schema default | Description |
| ---------- | -------- | ------------- | -------------- | ----------- |
| `step`     | Yes      | `"mv"`        | —              | —           |
| `fromPath` | Yes      | `string`      | —              | —           |
| `toPath`   | Yes      | `string`      | —              | —           |

<a id="blueprint-v2-step-rm"></a>

### `rm`

Unlinks a file in the target WordPress filesystem.

| Field  | Required | Type or shape | Schema default | Description |
| ------ | -------- | ------------- | -------------- | ----------- |
| `step` | Yes      | `"rm"`        | —              | —           |
| `path` | Yes      | `string`      | —              | —           |

<a id="blueprint-v2-step-rmdir"></a>

### `rmdir`

Removes a directory from the target WordPress filesystem.

| Field  | Required | Type or shape | Schema default | Description |
| ------ | -------- | ------------- | -------------- | ----------- |
| `step` | Yes      | `"rmdir"`     | —              | —           |
| `path` | Yes      | `string`      | —              | —           |

<a id="blueprint-v2-step-reset-data"></a>

### `resetData`

Removes selected site content, or all content when no types are given.

| Field          | Required | Type or shape                          | Schema default | Description                                                                                           |
| -------------- | -------- | -------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `step`         | Yes      | `"resetData"`                          | —              | —                                                                                                     |
| `contentTypes` | No       | `("posts" \| "pages" \| "comments")[]` | —              | Content types to remove. When omitted, all posts, pages, custom post types, and comments are removed. |

<a id="blueprint-v2-step-run-php"></a>

### `runPHP`

Runs a PHP file with optional environment variables.

| Field  | Required | Type or shape            | Schema default | Description                                |
| ------ | -------- | ------------------------ | -------------- | ------------------------------------------ |
| `step` | Yes      | `"runPHP"`               | —              | —                                          |
| `code` | Yes      | `FileDataReference`      | —              | The PHP file to execute.                   |
| `env`  | No       | `Record<string, string>` | —              | Environment variables to set for this run. |

<a id="blueprint-v2-step-run-sql"></a>

### `runSQL`

Runs SQL from a file source.

| Field    | Required | Type or shape       | Schema default | Description |
| -------- | -------- | ------------------- | -------------- | ----------- |
| `step`   | Yes      | `"runSQL"`          | —              | —           |
| `source` | Yes      | `FileDataReference` | —              | —           |

<a id="blueprint-v2-step-set-site-language"></a>

### `setSiteLanguage`

Sets the site language and downloads translations.

| Field      | Required | Type or shape       | Schema default | Description                       |
| ---------- | -------- | ------------------- | -------------- | --------------------------------- |
| `step`     | Yes      | `"setSiteLanguage"` | —              | —                                 |
| `language` | Yes      | `string`            | —              | The language to set, e.g. 'en_US' |

<a id="blueprint-v2-step-set-site-options"></a>

### `setSiteOptions`

Updates WordPress site options.

| Field     | Required | Type or shape                                                                               | Schema default | Description |
| --------- | -------- | ------------------------------------------------------------------------------------------- | -------------- | ----------- |
| `step`    | Yes      | `"setSiteOptions"`                                                                          | —              | —           |
| `options` | Yes      | `Record<string, string \| boolean \| number \| JSON value[] \| Record<string, JSON value>>` | —              | —           |

<a id="blueprint-v2-step-unzip"></a>

### `unzip`

Extracts a zip file into the target WordPress filesystem.

| Field           | Required | Type or shape       | Schema default | Description                                                        |
| --------------- | -------- | ------------------- | -------------- | ------------------------------------------------------------------ |
| `step`          | Yes      | `"unzip"`           | —              | —                                                                  |
| `zipFile`       | Yes      | `FileDataReference` | —              | The zip file resource to extract.                                  |
| `extractToPath` | Yes      | `string`            | —              | The path to extract the zip file to inside the virtual filesystem. |

<a id="blueprint-v2-step-wp-cli"></a>

### `wp-cli`

Runs a WP-CLI command.

| Field       | Required | Type or shape | Schema default | Description |
| ----------- | -------- | ------------- | -------------- | ----------- |
| `step`      | Yes      | `"wp-cli"`    | —              | —           |
| `command`   | Yes      | `string`      | —              | —           |
| `wpCliPath` | No       | `string`      | —              | —           |

<a id="blueprint-v2-step-write-files"></a>

### `writeFiles`

Writes data references to target filesystem paths.

| Field   | Required | Type or shape                   | Schema default | Description |
| ------- | -------- | ------------------------------- | -------------- | ----------- |
| `step`  | Yes      | `"writeFiles"`                  | —              | —           |
| `files` | Yes      | `Record<string, DataReference>` | —              | —           |

<!-- END GENERATED BLUEPRINT V2 ADDITIONAL STEPS REFERENCE -->

Steps such as `runPHP`, `runSQL`, and `wp-cli` execute code or commands with the
site's privileges. Only run Blueprints and referenced files that you trust.
