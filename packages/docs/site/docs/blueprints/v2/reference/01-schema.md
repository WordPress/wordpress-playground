---
title: Blueprint v2 schema reference
slug: /blueprints/v2/reference/schema
description: Reference for the top-level properties in a Blueprint v2 declaration.
---

# Blueprint v2 schema reference

Blueprint v2 describes the WordPress site you want. The runner validates that
declaration and turns it into an execution plan.

Use the public [Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json)
for validation and editor completion. That schema covers more than one Blueprint
version, so a v2 document must contain the JSON number `2` exactly:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2
}
```

The string `"2"`, another number, or an omitted `version` does not match the v2
declaration. The `$schema` property helps tooling find the schema; `version` selects
the Blueprint contract.

## Top-level properties

This table is generated from the v2 declaration in the checked-in schema. Object
shapes are deliberately abbreviated; follow the public schema in an editor for
nested fields and validation errors.

<!-- BEGIN GENERATED BLUEPRINT V2 TOP-LEVEL REFERENCE -->

| Property                        | Required | Type or shape                                                                                                                                                                                                                                                              | Schema default | Description                                                                                                                                                                                                                                      |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`                       | Yes      | `2`                                                                                                                                                                                                                                                                        | —              | Not a generic 'number' type – this schema is specifically for Blueprints v2. Version 1 had no "version" field and versions 3, 4, 5, etc will be different from version 2.                                                                        |
| `$schema`                       | No       | `URLReference \| ExecutionContextPath`                                                                                                                                                                                                                                     | —              | JSON Schema URL.                                                                                                                                                                                                                                 |
| `blueprintMeta`                 | No       | `{ name?: string; description?: string; moreInfo?: string; version?: string; … }`                                                                                                                                                                                          | —              | Metadata describing the Blueprint and its authors.                                                                                                                                                                                               |
| `applicationOptions`            | No       | `{ wordpress-playground: { landingPage?: string; login?: boolean \| object; networkAccess?: boolean; loadPhpExtensions?: "intl"[] } }`                                                                                                                                     | —              | Application-specific options. In v2, Playground landing and login options live here.                                                                                                                                                             |
| `contentBaseline`               | No       | `"keep-all" \| "empty" \| "posts" \| "pages" \| ("posts" \| "pages" \| "comments")[]`                                                                                                                                                                                      | `"keep-all"`   | The content from a vanilla WordPress installation to retain before applying the rest of the Blueprint. `keep-all` leaves the installation unchanged, `empty` removes its posts, pages, and comments, a content type retains only that type, and… |
| `usersBaseline`                 | No       | `"keep-all" \| "empty"`                                                                                                                                                                                                                                                    | `"keep-all"`   | The users from a vanilla WordPress installation to retain before applying the rest of the Blueprint. `keep-all` retains the administrator created by WordPress, while `empty` removes it before creating the users declared by this Blueprint.   |
| `siteLanguage`                  | No       | `string`                                                                                                                                                                                                                                                                   | `"en_US"`      | Sets the WPLANG constant and downloads any missing translations for WordPress core and all the installed plugins and themes. If you need a fine-grained control over the translations, use imperative steps in the…                              |
| `siteOptions`                   | No       | `{ blogname?: string; timezone_string?: string; permalink_structure?: string \| false; siteUrl?: never }`                                                                                                                                                                  | —              | Site options. In WordPress, the values are PHP-serializable, but Blueprints are intentionally restricted to an even stricter subset of those, that are JSON-serializable. This is to prevent passing JavaScript Date objects and similar.        |
| `constants`                     | No       | `{ WP_DEBUG?: boolean; WP_DEBUG_LOG?: boolean; WP_DEBUG_DISPLAY?: boolean; SCRIPT_DEBUG?: boolean }`                                                                                                                                                                       | —              | Constants to define in the wp-config.php file.                                                                                                                                                                                                   |
| `wordpressVersion`              | No       | `WordPressVersion \| DataReference \| { min: WordPressVersionConstraintVersion; max?: WordPressVersionConstraintVersion; preferred?: WordPressVersionPreferredVersion }`                                                                                                   | `"latest"`     | WordPress version to install or require.                                                                                                                                                                                                         |
| `phpVersion`                    | No       | `PHPVersion \| { min?: PHPVersionConstraintVersion; recommended?: PHPVersionConstraintVersion; max?: PHPVersionConstraintVersion }`                                                                                                                                        | `"8.0"`        | The PHP version required for this Blueprint to work.                                                                                                                                                                                             |
| `activeTheme`                   | No       | `ThemeDirectoryReference \| DataReference \| { source: ThemeDirectoryReference \| DataReference; importStarterContent?: boolean; targetDirectoryName?: string; onError?: "skip-theme" \| "throw"; … }`                                                                     | —              | The theme to install and also activate.                                                                                                                                                                                                          |
| `themes`                        | No       | `(ThemeDirectoryReference \| DataReference \| { source: ThemeDirectoryReference \| DataReference; importStarterContent?: boolean; targetDirectoryName?: string; onError?: "skip-theme" \| "throw"; … })[]`                                                                 | —              | Installed themes to install without activating them.                                                                                                                                                                                             |
| `plugins`                       | No       | `(DataReference \| PluginDirectoryReference \| { source: DataReference \| PluginDirectoryReference; active?: boolean; activationOptions?: Record<string, string \| boolean \| number \| JSON value[] \| Record<string, JSON value>>; targetDirectoryName?: string; … })[]` | —              | A list of plugins to install and activate.                                                                                                                                                                                                       |
| `muPlugins`                     | No       | `DataReference[]`                                                                                                                                                                                                                                                          | —              | A list of mu-plugins to install.                                                                                                                                                                                                                 |
| `postTypes`                     | No       | `Record<string, object \| ExecutionContextPath>`                                                                                                                                                                                                                           | —              | Very basic schema for defining custom post types.                                                                                                                                                                                                |
| `fonts`                         | No       | `Record<string, FileDataReference \| object>`                                                                                                                                                                                                                              | —              | A list of fonts to register in the site's Font Library.                                                                                                                                                                                          |
| `media`                         | No       | `(FileDataReference \| { source: FileDataReference; title?: string; description?: string; alt?: string; … })[]`                                                                                                                                                            | —              | A list of media files to upload to the WordPress Media Library – in formats supported by the WordPress Media Library.                                                                                                                            |
| `content`                       | No       | `(type-discriminated object (3 variants))[]`                                                                                                                                                                                                                               | —              | Content imports to apply to the site.                                                                                                                                                                                                            |
| `users`                         | No       | `{ username: string; email: string; role: string; meta: Record<string, string> }[]`                                                                                                                                                                                        | —              | Users to create, including their role and string-valued metadata.                                                                                                                                                                                |
| `roles`                         | No       | `{ name: string; capabilities: Record<string, string> }[]`                                                                                                                                                                                                                 | —              | Roles to create and their string-valued capability map.                                                                                                                                                                                          |
| `additionalStepsAfterExecution` | No       | `(step-discriminated object (22 variants))[]`                                                                                                                                                                                                                              | —              | Imperative steps to run after the declarative site setup finishes.                                                                                                                                                                               |

<!-- END GENERATED BLUEPRINT V2 TOP-LEVEL REFERENCE -->

## Specify unsettled defaults explicitly

The schema and current execution targets do not yet agree on every default. The
schema lists `/wp-admin` as the Playground landing page and PHP `8.0` as the v2
default, while current runtime selection has used `/` and PHP `8.3`. Until those
contracts agree, set both values in portable Blueprints:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"phpVersion": "8.3",
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/"
		}
	}
}
```

## Current schema caveats

- Each value in `roles[].capabilities` must currently be a string. Do not use the
  boolean capability map accepted by lower-level WordPress APIs unless the v2
  contract changes.
- A `users` entry has `username`, `email`, `role`, and `meta`, but no password
  property. The Playground login object under `applicationOptions` is separate.
  Its schema requires a password field, but current automatic login uses only the
  username; use a placeholder, never a real password or secret.
- For inline posts, `post_author` is a numeric WordPress user ID. The schema's
  description currently calls it a username, but its enforced type is `number`.
  Omit it to let the runner resolve an author.
- Font sources must end in `.woff2`, `.woff`, `.ttf`, or `.otf`. Font installation
  also requires WordPress 6.5 or newer.

The generated table reports what the checked-in schema says today. The caveats
above call out known places where prose or runtime defaults still need to converge
with it.
