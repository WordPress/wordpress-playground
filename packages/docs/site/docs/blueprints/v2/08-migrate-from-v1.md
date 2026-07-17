---
title: Migrate a Blueprint from v1 to v2
slug: /blueprints/v2/migrate-from-v1
description: Manually migrate Blueprint v1 fields, resources, steps, defaults, paths, and behavior to Blueprint v2.
---

# Migrate a Blueprint from v1 to v2

V1 remains accepted by current Playground runners, but new work should use v2.
Migration is manual: there is no automatic converter in the editor, CLI, or
public package API.

Do not add `"version": 2` to an unchanged v1 file. V2 has a different resource
model, fixed lifecycle, application options, and strict tail-step shapes.

## Migration workflow

1. Keep the same public `$schema` URL and add exact numeric `"version": 2`.
2. Move host behavior such as login and landing page into
   `applicationOptions`.
3. Express plugins, themes, options, constants, users, and content as top-level
   desired state.
4. Replace v1 resource objects with v2 data references.
5. Move only the remaining ordered work to `additionalStepsAfterExecution` and
   update every step shape.
6. Set network access, PHP, landing page, and WXR behavior explicitly.
7. Validate and compare the resulting site, not just the JSON fields.

## Top-level field map

| V1                                             | V2                                                                       | Migration decision                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| No version field                               | `version: 2`                                                             | Required exact number                                                           |
| `$schema`                                      | `$schema`                                                                | Keep the same public URL                                                        |
| `meta.title`                                   | `blueprintMeta.name`                                                     | Rename                                                                          |
| `meta.description` or deprecated `description` | `blueprintMeta.description`                                              | Consolidate                                                                     |
| `meta.author`                                  | `blueprintMeta.authors`                                                  | Change the string to an array                                                   |
| `meta.categories`                              | `blueprintMeta.tags`                                                     | Rename                                                                          |
| `landingPage`                                  | `applicationOptions["wordpress-playground"].landingPage`                 | Set explicitly                                                                  |
| `login`                                        | `applicationOptions["wordpress-playground"].login`                       | Boolean or credentials object; automatic login currently uses only its username |
| `preferredVersions.php`                        | `phpVersion`                                                             | Exact version or compatibility object                                           |
| `preferredVersions.wp`                         | `wordpressVersion`                                                       | Exact/new-site value, bounds object, custom source, or `"none"`                 |
| `features.networking`                          | `applicationOptions["wordpress-playground"].networkAccess`               | V1 default true; v2 default false                                               |
| `features.intl`                                | `applicationOptions["wordpress-playground"].loadPhpExtensions: ["intl"]` | Playground-specific option                                                      |
| `extraLibraries: ["wp-cli"]`                   | No preload field                                                         | V2 inserts WP-CLI before a dependent tail step                                  |
| `constants`                                    | `constants`                                                              | Prefer the declarative top-level field                                          |
| `plugins`                                      | `plugins`                                                                | Replace resource objects; richer install objects are available                  |
| `siteOptions`                                  | `siteOptions`                                                            | Values may be JSON values; `siteUrl` is not an option shortcut                  |
| `steps`                                        | `additionalStepsAfterExecution`                                          | Only for work not represented by top-level declarations                         |
| `phpExtensionBundles`                          | No direct equivalent                                                     | Removed; request supported extensions through application options               |

V1 `preferredVersions.wp: false` becomes
`"wordpressVersion": "none"` for PHP-only use.

## Resource map

| V1 resource                                                                  | V2 data reference                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `{ "resource": "url", "url": "https://..." }`                                | The URL string directly                                                     |
| `{ "resource": "bundled", "path": "/file" }`                                 | `./file` or `/file` in the execution context                                |
| `{ "resource": "wordpress.org/plugins", "slug": "akismet" }`                 | `"akismet"` or `"akismet@version"` in plugin context                        |
| `{ "resource": "wordpress.org/themes", "slug": "twentytwentyfive" }`         | Theme slug or pinned slug in theme context                                  |
| `{ "resource": "literal", "name": "file.php", "contents": "..." }`           | `{ "filename": "file.php", "content": "..." }`                              |
| `{ "resource": "literal:directory", ... }`                                   | `{ "directoryName": "...", "files": { ... } }`                              |
| `{ "resource": "git:directory", "url": "...", "ref": "...", "path": "..." }` | `{ "gitRepository": "...", "ref": "...", "pathInRepository": "..." }`       |
| `{ "resource": "vfs", "path": "/wordpress/..." }`                            | Usually `site:...`; verify whether the old path meant target state          |
| `{ "resource": "zip", "inner": ... }`                                        | Usually install the directory source directly, or use a real ZIP URL/bundle |

The path distinction is semantic. `./file` and `/file` name Blueprint inputs;
`site:wp-content/...` names mutable target-site state.

## Step map

| V1 step                                     | V2 migration                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `activatePlugin`                            | Same step name; use the v2 fields in the tail                                              |
| `activateTheme`                             | Same step; rename `themeFolderName` to `themeDirectoryName`                                |
| `cp`, `mkdir`, `mv`, `rm`, `rmdir`, `unzip` | Available as strict v2 tail steps; verify path semantics                                   |
| `defineWpConfigConsts`                      | Top-level `constants`, or `defineConstants.constants` in the tail                          |
| `defineSiteUrl`                             | No direct equivalent; use reviewed constants/options or PHP for the actual intent          |
| `enableMultisite`                           | Available in the tail; WP-CLI is provisioned automatically                                 |
| `importWxr`                                 | Top-level `content` with `type: "wxr"`, or tail `importContent`                            |
| `importThemeStarterContent`                 | `activeTheme.importStarterContent` or the same-named tail step                             |
| `importWordPressFiles`                      | No direct equivalent; use a custom WordPress source or a deliberate manual workflow        |
| `installPlugin`                             | Top-level `plugins` or flattened tail `installPlugin` with `source`                        |
| `installTheme`                              | `activeTheme`/`themes` or flattened tail `installTheme` with `source`                      |
| `login`                                     | Playground application option; no v2 login tail step                                       |
| `request`                                   | Removed; no v2 equivalent                                                                  |
| `resetData`                                 | New-site `contentBaseline: "empty"`, or ordered tail `resetData` when semantics require it |
| `runPHP`                                    | Same name, but `code` is a file data reference, not a raw string                           |
| `runPHPWithOptions`                         | Tail `runPHP` with supported `env`; rewrite unsupported request emulation                  |
| `runSql`                                    | Rename to `runSQL` and replace `sql` with `source`                                         |
| `runWpInstallationWizard`                   | No direct tail equivalent; the host creates the WordPress installation                     |
| `setSiteLanguage`                           | Top-level `siteLanguage` or same-named tail step                                           |
| `setSiteOptions`                            | Top-level `siteOptions` or same-named tail step                                            |
| `updateUserMeta`                            | Declare new users with `users[].meta`; use reviewed PHP for an existing user               |
| `wp-cli`                                    | Available in the tail; do not add `extraLibraries`                                         |
| `writeFile`                                 | Tail `writeFiles` with a path-to-data record                                               |
| `writeFiles`                                | Tail `writeFiles`; replace the v1 directory resource with the v2 `files` record            |

V1 silently filtered `false`, `null`, strings, and missing values from `steps`.
V2 requires every tail entry to be a valid step object. Remove conditional
placeholders before serializing JSON.

## Example 1: plugin Preview

### V1

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/plugins.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"features": {
		"networking": true
	},
	"login": true,
	"plugins": [
		{
			"resource": "wordpress.org/plugins",
			"slug": "query-monitor"
		}
	],
	"siteOptions": {
		"blogname": "Plugin Preview"
	}
}
```

### V2

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/plugins.php",
			"login": true,
			"networkAccess": true
		}
	},
	"phpVersion": "8.3",
	"wordpressVersion": "latest",
	"plugins": ["query-monitor"],
	"siteOptions": {
		"blogname": "Plugin Preview"
	}
}
```

The network field is not a mechanical rename: its default changes from true in
v1 to false in v2.

## Example 2: theme demo with WXR content

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
			"importComments": false,
			"urlsMode": "rewrite",
			"staticAssets": "fetch"
		}
	]
}
```

The WXR controls are explicit because author/import defaults must not be
inferred during a migration. Network access lets WordPress fetch the remote
attachments requested by `staticAssets: "fetch"`.

## Example 3: content-heavy site

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

`contentBaseline` describes cleanup of a new vanilla installation. It is
skipped in existing-site mode, unlike an ordered destructive `resetData` tail
step.

## Behavior checklist

Before declaring the migration complete, answer each question:

- Does the site itself need network access? V2 defaults it to false.
- Is a version a new-site preference or an existing-site compatibility bound?
- Does every path point to remote input, the Blueprint context, or target-site
  state?
- Did any old step rely on exact ordering that a top-level declaration changes?
- Should a reset be a new-install baseline or an explicit ordered operation?
- What happens when a plugin or theme is already installed?
- Did the old URL or CLI invocation override runtime fields? V2 declarations
  are authoritative on the website, and CLI flags only fill missing fields.
- Does PHP-only mode contain WordPress-dependent declarations?
- Do both versions produce the same files, options, active extensions, users,
  and content—not merely similar progress messages?

Validate the result in the [Blueprint editor](https://playground.wordpress.net/),
run it against a disposable site, and use [troubleshooting](./troubleshooting)
for phase-specific failures.
