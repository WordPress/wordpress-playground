---
title: Migrate a Blueprint from v1 to v2
slug: /blueprints/v2/migrate-from-v1
description: Migrate Blueprint v1 fields, resources, steps, defaults, paths, and behavior to Blueprint v2.
---

# Migrate a Blueprint from v1 to v2

V1 remains accepted by current Playground runners, but new work should use v2.
Migration is manual: there is no automatic converter in the editor, CLI, or
public package API.

Do not add `"version": 2` to an unchanged v1 file. V2 describes the desired
site at the top level, resolves files differently, and reserves ordered work
for `additionalStepsAfterExecution`.

## The four changes to understand first

| Change                         | What to check during migration                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| V2 is selected explicitly      | Add the exact number `"version": 2`; a missing version still selects v1                                       |
| Site setup has a fixed order   | Describe plugins, themes, options, users, and content at the top level instead of recreating every v1 step    |
| Files use contextual values    | Replace `{ "resource": "..." }` objects with URLs, `./` paths, `site:` paths, inline data, or Git sources     |
| Defaults and overrides changed | V2 site network access defaults to false, and declared PHP, WordPress, and login values win over CLI defaults |

Think of the migration as translating the **result you need**, not renaming
every field one by one.

## Smallest useful before and after

This v1 Blueprint opens the Plugins screen, logs in, pins the runtime, disables
site network access, and installs Query Monitor:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/plugins.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.9"
	},
	"features": {
		"networking": false
	},
	"login": true,
	"plugins": ["query-monitor"]
}
```

The equivalent v2 Blueprint is:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/plugins.php",
			"login": true,
			"networkAccess": false
		}
	},
	"phpVersion": "8.3",
	"wordpressVersion": "6.9",
	"plugins": ["query-monitor"]
}
```

Check the result, not only the JSON: Query Monitor should be active, the site
should use the requested versions, and Playground should open the Plugins
screen while logged in.

## A finite migration workflow

1. Keep the original v1 Blueprint so you can compare results.
2. Keep the public `$schema` URL and add exact numeric `"version": 2`.
3. Move login, landing page, and other Playground behavior into
   `applicationOptions`.
4. Express plugins, themes, options, constants, users, and content as top-level
   desired state.
5. Replace v1 resource objects with v2 data references.
6. Move only the remaining ordered work into
   `additionalStepsAfterExecution`, and update each step shape.
7. Set network access, PHP, WordPress, landing page, and WXR behavior
   deliberately.
8. Validate both Blueprints on disposable sites and compare their resulting
   state.

## Mechanical field changes

| V1                                             | V2                          | Change                                                                      |
| ---------------------------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `$schema`                                      | `$schema`                   | Keep the same public URL                                                    |
| `meta.title`                                   | `blueprintMeta.name`        | Rename                                                                      |
| `meta.description` or deprecated `description` | `blueprintMeta.description` | Consolidate                                                                 |
| `meta.author`                                  | `blueprintMeta.authors`     | Change the string to an array                                               |
| `meta.categories`                              | `blueprintMeta.tags`        | Rename                                                                      |
| `constants`                                    | `constants`                 | Keep it as a declarative top-level field                                    |
| `plugins`                                      | `plugins`                   | Replace resource objects; richer install objects are available              |
| `siteOptions`                                  | `siteOptions`               | Values may be JSON values; `siteUrl` is deliberately not an option shortcut |

## Fields that require a behavior decision

| V1                           | V2                                                                       | Decision                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| No version field             | `version: 2`                                                             | Required exact number                                                                                                            |
| `landingPage`                | `applicationOptions["wordpress-playground"].landingPage`                 | Set the destination explicitly                                                                                                   |
| `login`                      | `applicationOptions["wordpress-playground"].login`                       | Use a boolean or `{ username, password }`; the object schema requires both, but automatic login currently uses only the username |
| `preferredVersions.php`      | `phpVersion`                                                             | Choose an exact runtime or compatibility object                                                                                  |
| `preferredVersions.wp`       | `wordpressVersion`                                                       | Choose a new-site version, compatibility bounds, custom source, or `"none"`                                                      |
| `features.networking`        | `applicationOptions["wordpress-playground"].networkAccess`               | V1 defaults true; v2 defaults false                                                                                              |
| `features.intl`              | `applicationOptions["wordpress-playground"].loadPhpExtensions: ["intl"]` | This is a Playground application option                                                                                          |
| `extraLibraries: ["wp-cli"]` | No preload field                                                         | V2 inserts WP-CLI before a dependent post-setup step                                                                             |
| `steps`                      | `additionalStepsAfterExecution`                                          | Keep only work not represented by top-level fields                                                                               |
| `phpExtensionBundles`        | No direct equivalent                                                     | Request supported extensions through `loadPhpExtensions`                                                                         |

V1 `preferredVersions.wp: false` becomes
`"wordpressVersion": "none"` for PHP-only use.

`siteOptions.siteUrl` is excluded in v2. If the old intent was to define the
runtime URL, set `WP_HOME` and `WP_SITEURL` through top-level `constants`.

## Resource map

| V1 resource                                                                  | V2 data reference                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `{ "resource": "url", "url": "https://..." }`                                | The URL string directly                                                        |
| `{ "resource": "bundled", "path": "/file" }`                                 | `./file` or `/file` beside `blueprint.json`                                    |
| `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`                 | `"akismet"` or `"akismet@version"` in plugin context                           |
| `{ "resource": "wordpress.org/themes", "slug": "twentytwentyfive" }`         | Theme slug or pinned slug in theme context                                     |
| `{ "resource": "literal", "name": "file.php", "contents": "..." }`           | `{ "filename": "file.php", "content": "..." }`                                 |
| `{ "resource": "literal:directory", ... }`                                   | `{ "directoryName": "...", "files": { ... } }`                                 |
| `{ "resource": "git:directory", "url": "...", "ref": "...", "path": "..." }` | `{ "gitRepository": "...", "ref": "...", "pathInRepository": "..." }`          |
| `{ "resource": "vfs", "path": "/wordpress/..." }`                            | Usually `site:...`; first confirm that the old path meant target-site state    |
| `{ "resource": "zip", "inner": ... }`                                        | Usually install the directory source directly, or use a real ZIP URL or bundle |

The distinction changes meaning, not just spelling. `./file` and `/file` name
Blueprint inputs. `site:wp-content/...` names mutable state inside WordPress at
the moment a field or step reads it. See [files, URLs, and bundles](./resources)
for a source chooser.

## Step map

Post-setup steps use v2 shapes even when their names are unchanged:

| V1 step                                     | V2 migration                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `activatePlugin`                            | Same step name; use the v2 fields in `additionalStepsAfterExecution`                                            |
| `activateTheme`                             | Rename `themeFolderName` to `themeDirectoryName`                                                                |
| `cp`, `mkdir`, `mv`, `rm`, `rmdir`, `unzip` | Available as strict v2 post-setup steps; verify every path                                                      |
| `defineWpConfigConsts`                      | Top-level `constants`, or `defineConstants.constants` after setup                                               |
| `defineSiteUrl`                             | Top-level `constants` with `WP_HOME` and `WP_SITEURL`                                                           |
| `enableMultisite`                           | Available after setup; WP-CLI is provisioned automatically                                                      |
| `importWxr`                                 | Top-level `content` with `type: "wxr"`, or `importContent` after setup                                          |
| `importThemeStarterContent`                 | `activeTheme.importStarterContent` or the same-named post-setup step                                            |
| `importWordPressFiles`                      | No direct equivalent; use a custom WordPress source or a deliberate manual workflow                             |
| `installPlugin`                             | Top-level `plugins`, or flattened `installPlugin` with `source` after setup                                     |
| `installTheme`                              | Top-level `activeTheme`/`themes`, or flattened `installTheme` with `source` after setup                         |
| `login`                                     | Playground application option; there is no v2 login post-setup step                                             |
| `request`                                   | No direct equivalent; perform request-level integration in the host application                                 |
| `resetData`                                 | New-site `contentBaseline: "empty"`, or ordered `resetData` after setup when order matters                      |
| `runPHP`                                    | Same name, but `code` is a file source rather than a raw string                                                 |
| `runPHPWithOptions`                         | `runPHP` with supported `env`; rewrite unsupported request emulation                                            |
| `runSql`                                    | Rename to `runSQL` and replace `sql` with `source`                                                              |
| `runWpInstallationWizard`                   | No direct equivalent; the host creates the WordPress installation                                               |
| `setSiteLanguage`                           | Top-level `siteLanguage` or the same-named post-setup step                                                      |
| `setSiteOptions`                            | Top-level `siteOptions` or the same-named post-setup step                                                       |
| `updateUserMeta`                            | Declare the user in `users[].meta`; a matching username keeps its email and receives the declared role and meta |
| `wp-cli`                                    | Available after setup; do not add `extraLibraries`                                                              |
| `writeFile`                                 | `writeFiles` with a path-to-data record after setup                                                             |
| `writeFiles`                                | `writeFiles`; replace the v1 directory resource with the v2 `files` record                                      |

V1 silently filtered `false`, `null`, strings, and JavaScript `undefined` values
from `steps`. Every v2 `additionalStepsAfterExecution` entry must be a valid step
object. Remove placeholders before serializing the JSON.

## Larger example: theme demo with WXR content

### V1

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwentyfive"
			},
			"options": {
				"activate": true
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/wordpress-playground/1a238312cdc474b846b6cf41e26193e90cb59ed3/packages/playground/blueprints/src/tests/fixtures/import-wxr-comprehensive.xml"
			}
		}
	]
}
```

### V2

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
	"wordpressVersion": "latest",
	"activeTheme": "twentytwentyfive",
	"content": [
		{
			"type": "wxr",
			"source": "https://raw.githubusercontent.com/WordPress/wordpress-playground/1a238312cdc474b846b6cf41e26193e90cb59ed3/packages/playground/blueprints/src/tests/fixtures/import-wxr-comprehensive.xml",
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin",
			"importUsers": false,
			"importComments": true,
			"urlsMode": "rewrite",
			"staticAssets": "fetch"
		}
	]
}
```

What changed:

- Theme installation and activation became the `activeTheme` desired state.
- The WXR URL became a direct `source` value.
- Import choices are visible instead of relying on v1 defaults.
- `networkAccess: true` lets WordPress fetch attachments named in the WXR.

Check that the same theme is active and that the expected posts, authors,
comments, URLs, and attachments were imported.

## Larger example: replace setup PHP with declared content

### V1

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"login": true,
	"steps": [
		{
			"step": "resetData"
		},
		{
			"step": "setSiteOptions",
			"options": {
				"blogname": "Editorial fixture",
				"permalink_structure": "/%postname%/"
			}
		},
		{
			"step": "runPHP",
			"code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'Release notes', 'post_status' => 'publish']);"
		}
	]
}
```

### V2

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/edit.php",
			"login": true
		}
	},
	"phpVersion": "8.3",
	"wordpressVersion": "latest",
	"contentBaseline": "empty",
	"siteOptions": {
		"blogname": "Editorial fixture",
		"permalink_structure": "/%postname%/"
	},
	"content": [
		{
			"type": "posts",
			"source": {
				"post_title": "Release notes",
				"post_status": "publish",
				"post_content": "<!-- wp:paragraph --><p>Reproduction content.</p><!-- /wp:paragraph -->"
			}
		}
	]
}
```

What changed:

- The new-site reset became `contentBaseline: "empty"`.
- Site options and the post became declared state instead of ordered steps.
- V2 selects a default existing administrator as the post author when the post
  does not declare one. Compare author behavior if the original PHP relied on a
  different current user.

`contentBaseline` is skipped in existing-site mode. An ordered `resetData`
post-setup step is not skipped and remains destructive.

## Verify behavior before calling the migration complete

- Does the site itself need network access? V2 defaults it to false.
- Is each version a new-site selection or an existing-site compatibility bound?
- Does every path point to a URL, files beside the Blueprint, or target-site
  state?
- Did any v1 step rely on ordering that top-level desired state changes?
- Should a reset apply only to a new installation, or run as an ordered
  destructive operation?
- What happens when each plugin or theme is already installed?
- Did the old URL or CLI invocation supply runtime defaults? Declared v2 PHP,
  WordPress, and login values win; website query overrides do not rewrite v2
  `blueprint-url` input, and CLI values fill missing fields.
- Does PHP-only mode avoid WordPress-dependent fields and steps?
- Do both sites have the same files, options, active plugins and themes, users,
  post authors, and content—not merely similar progress messages?

Validate the v2 JSON in **New → Write a Blueprint** on the
[Playground website](https://playground.wordpress.net/), run both versions on
disposable sites, and use [troubleshooting](./troubleshooting) for the first
phase that differs.
