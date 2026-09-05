---
title: Blueprint v2 schema reference
slug: /blueprints/v2/reference/schema
description: Reference for the top-level properties in a Blueprint v2 file.
---

# Blueprint v2 schema reference

Blueprint v2 describes the WordPress site you want. Playground validates the
Blueprint, resolves the requested runtimes, and applies the site fields in a
fixed order.

## Start a v2 Blueprint

Use the public
[Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json)
for validation and editor completion. The schema covers more than one Blueprint
version, so every v2 file must contain the JSON number `2` exactly:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2
}
```

The string `"2"`, another number, or an omitted `version` does not select v2.
`$schema` helps your editor find the schema; `version` selects the Blueprint
contract.

## Find a field

| You want to                                      | Field or page                                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Name, describe, or credit a Blueprint            | [`blueprintMeta`](#describe-the-blueprint)                                                                        |
| Choose the landing page, login, network, or Intl | [`applicationOptions`](#control-the-playground-experience)                                                        |
| Select or constrain WordPress and PHP            | [`wordpressVersion` and `phpVersion`](#choose-runtime-versions)                                                   |
| Remove default posts or users                    | [`contentBaseline` and `usersBaseline`](/blueprints/v2/reference/content-and-site-data#starter-content-and-users) |
| Set options, constants, or language              | [Options, constants, and language](/blueprints/v2/reference/content-and-site-data#options-constants-and-language) |
| Install plugins, themes, or mu-plugins           | [Plugins and themes](/blueprints/v2/reference/content-and-site-data#plugins-themes-and-must-use-plugins)          |
| Create roles, users, post types, or content      | [Content and site data](/blueprints/v2/reference/content-and-site-data)                                           |
| Import media or install fonts                    | [Media and fonts](/blueprints/v2/reference/content-and-site-data#media)                                           |
| Run command-like work after site setup           | [`additionalStepsAfterExecution`](/blueprints/v2/reference/additional-steps)                                      |

## Top-level properties

This generated table is a top-level overview. Object shapes are deliberately
abbreviated, so use the field guidance below and the public schema in an editor
for nested fields and validation errors.

<!-- BEGIN GENERATED BLUEPRINT V2 TOP-LEVEL REFERENCE -->

| Property                                                                                           | Required | Type or shape                                                                                                                                                                                                                                                              | Schema default | Description                                                                                  |
| -------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| <a id="blueprint-v2-property-version"></a>`version`                                                | Yes      | `2`                                                                                                                                                                                                                                                                        | —              | Selects Blueprint v2. Use the number `2`, not the string `"2"`.                              |
| <a id="blueprint-v2-property-schema"></a>`$schema`                                                 | No       | `URLReference \| ExecutionContextPath`                                                                                                                                                                                                                                     | —              | Points editors and other tools to the Blueprint JSON Schema.                                 |
| <a id="blueprint-v2-property-blueprint-meta"></a>`blueprintMeta`                                   | No       | `{ name?: string; description?: string; moreInfo?: string; version?: string; … }`                                                                                                                                                                                          | —              | Metadata describing the Blueprint and its authors.                                           |
| <a id="blueprint-v2-property-application-options"></a>`applicationOptions`                         | No       | `{ wordpress-playground: { landingPage?: string; login?: boolean \| object; networkAccess?: boolean; loadPhpExtensions?: "intl"[] } }`                                                                                                                                     | —              | Playground options for the landing page, login, network access, and optional PHP extensions. |
| <a id="blueprint-v2-property-content-baseline"></a>`contentBaseline`                               | No       | `"keep-all" \| "empty" \| "posts" \| "pages" \| ("posts" \| "pages" \| "comments")[]`                                                                                                                                                                                      | `"keep-all"`   | Controls which starter posts, pages, and comments are kept before declared content is added. |
| <a id="blueprint-v2-property-users-baseline"></a>`usersBaseline`                                   | No       | `"keep-all" \| "empty"`                                                                                                                                                                                                                                                    | `"keep-all"`   | Controls whether the starter administrator is kept before declared users are created.        |
| <a id="blueprint-v2-property-site-language"></a>`siteLanguage`                                     | No       | `string`                                                                                                                                                                                                                                                                   | `"en_US"`      | Sets the WordPress locale and downloads available translations.                              |
| <a id="blueprint-v2-property-site-options"></a>`siteOptions`                                       | No       | `{ blogname?: string; timezone_string?: string; permalink_structure?: string \| false; siteUrl?: never; … }`                                                                                                                                                               | —              | WordPress option names mapped to JSON-compatible values.                                     |
| <a id="blueprint-v2-property-constants"></a>`constants`                                            | No       | `{ WP_DEBUG?: boolean; WP_DEBUG_LOG?: boolean; WP_DEBUG_DISPLAY?: boolean; SCRIPT_DEBUG?: boolean; … }`                                                                                                                                                                    | —              | WordPress constant names mapped to string, number, or boolean values.                        |
| <a id="blueprint-v2-property-wordpress-version"></a>`wordpressVersion`                             | No       | `WordPressVersion \| DataReference \| { min: WordPressVersionConstraintVersion; max?: WordPressVersionConstraintVersion; preferred?: WordPressVersionPreferredVersion }`                                                                                                   | `"latest"`     | Selects WordPress for a new site or sets compatibility bounds for an existing site.          |
| <a id="blueprint-v2-property-php-version"></a>`phpVersion`                                         | No       | `PHPVersion \| { min?: PHPVersionConstraintVersion; recommended?: PHPVersionConstraintVersion; max?: PHPVersionConstraintVersion }`                                                                                                                                        | `"8.0"`        | Selects or constrains the PHP runtime.                                                       |
| <a id="blueprint-v2-property-active-theme"></a>`activeTheme`                                       | No       | `ThemeDirectoryReference \| DataReference \| { source: ThemeDirectoryReference \| DataReference; importStarterContent?: boolean; targetDirectoryName?: string; onError?: "skip-theme" \| "throw"; … }`                                                                     | —              | Installs and activates one theme.                                                            |
| <a id="blueprint-v2-property-themes"></a>`themes`                                                  | No       | `(ThemeDirectoryReference \| DataReference \| { source: ThemeDirectoryReference \| DataReference; importStarterContent?: boolean; targetDirectoryName?: string; onError?: "skip-theme" \| "throw"; … })[]`                                                                 | —              | Themes to install without activating them.                                                   |
| <a id="blueprint-v2-property-plugins"></a>`plugins`                                                | No       | `(DataReference \| PluginDirectoryReference \| { source: DataReference \| PluginDirectoryReference; active?: boolean; activationOptions?: Record<string, string \| boolean \| number \| JSON value[] \| Record<string, JSON value>>; targetDirectoryName?: string; … })[]` | —              | Plugins to install. Entries activate by default.                                             |
| <a id="blueprint-v2-property-mu-plugins"></a>`muPlugins`                                           | No       | `DataReference[]`                                                                                                                                                                                                                                                          | —              | Must-use plugins to install.                                                                 |
| <a id="blueprint-v2-property-post-types"></a>`postTypes`                                           | No       | `Record<string, object \| ExecutionContextPath>`                                                                                                                                                                                                                           | —              | Custom post types to register.                                                               |
| <a id="blueprint-v2-property-fonts"></a>`fonts`                                                    | No       | `Record<string, FileDataReference \| object>`                                                                                                                                                                                                                              | —              | Fonts or font collections to add to the WordPress Font Library.                              |
| <a id="blueprint-v2-property-media"></a>`media`                                                    | No       | `(FileDataReference \| { source: FileDataReference; title?: string; description?: string; alt?: string; … })[]`                                                                                                                                                            | —              | Files to add to the WordPress Media Library.                                                 |
| <a id="blueprint-v2-property-content"></a>`content`                                                | No       | `(type-discriminated object (3 variants))[]`                                                                                                                                                                                                                               | —              | Content imports to apply to the site.                                                        |
| <a id="blueprint-v2-property-users"></a>`users`                                                    | No       | `{ username: string; email: string; role: string; meta: Record<string, string> }[]`                                                                                                                                                                                        | —              | Users to create or update by username.                                                       |
| <a id="blueprint-v2-property-roles"></a>`roles`                                                    | No       | `{ name: string; capabilities: Record<string, string> }[]`                                                                                                                                                                                                                 | —              | Roles to create or update with string-valued capabilities.                                   |
| <a id="blueprint-v2-property-additional-steps-after-execution"></a>`additionalStepsAfterExecution` | No       | `(step-discriminated object (22 variants))[]`                                                                                                                                                                                                                              | —              | Final setup steps to run in order after all top-level site fields.                           |

<!-- END GENERATED BLUEPRINT V2 TOP-LEVEL REFERENCE -->

## Describe the Blueprint

`blueprintMeta` records information for people and Blueprint catalogues. It does
not change the WordPress site. Common fields include `name`, `description`,
`authors`, `tags`, `homepage`, `license`, and a version for the Blueprint itself.

```jsonc
"blueprintMeta": {
	"name": "Plugin review site",
	"description": "A small site for reviewing the current plugin release.",
	"authors": ["Example team"],
	"tags": ["plugin", "review"]
}
```

## Control the Playground experience

`applicationOptions["wordpress-playground"]` controls what the official
Playground host does around site setup:

| Field               | Effect                                                             |
| ------------------- | ------------------------------------------------------------------ |
| `landingPage`       | Opens this WordPress path after the Blueprint finishes             |
| `login`             | `true` logs in as `admin`; `false` leaves the visitor signed out   |
| `networkAccess`     | Allows outbound requests made by the running WordPress site        |
| `loadPhpExtensions` | Loads the listed optional extension; v2 currently accepts `"intl"` |

`networkAccess` does not control the runner downloading a declared plugin,
theme, or other source. Browser-loaded Blueprint files and assets must still be
publicly fetchable with suitable CORS headers. The CLI is not subject to browser
CORS restrictions.

A login object can name a user instead of `admin`, but its current schema also
requires a `password` string even though Playground automatic login uses only
the username. Use a non-secret placeholder. Never put a real password in a
Blueprint.

## Choose runtime versions

For a new site, `wordpressVersion` may be `"latest"`, a release such as
`"6.8.3"`, a branch such as `"6.8"`, a supported development label, or a data
source containing WordPress files. A string chooses the new site's version; it
does not reject an existing site.

Use an object when the Blueprint must express a compatibility range. An
existing site is checked against `min` and `max`, while `preferred` guides
new-site selection:

```jsonc
"wordpressVersion": {
	"min": "6.8",
	"max": "6.9",
	"preferred": "6.8.3"
}
```

`phpVersion` accepts a supported version string or a constraint with `min`,
`recommended`, and `max`:

```jsonc
"phpVersion": {
	"min": "8.1",
	"recommended": "8.3",
	"max": "8.4"
}
```

See [Apply a Blueprint to an existing site](/blueprints/v2/apply-to-existing-site)
before using compatibility constraints with valuable data.

## Declare site state

The remaining top-level fields describe the WordPress state to create. Use the
[content and site data reference](/blueprints/v2/reference/content-and-site-data)
for their nested shapes, timing, and repeat-run behavior, and
[data sources, paths, and bundles](/blueprints/v2/resources) for file-like
values.

The generated table abbreviates object shapes. In particular, `siteOptions`
accepts additional WordPress option names with JSON-compatible values, and
`constants` accepts additional constant names with string, number, or boolean
values. The named entries in the table are common fields, not closed lists.

## Run final setup steps

`additionalStepsAfterExecution` is the escape hatch for work the top-level
fields cannot express. These steps run last and in array order. Prefer a
top-level field when one produces the same result; it gives Playground enough
information to plan site setup correctly.

See the [final setup steps reference](/blueprints/v2/reference/additional-steps)
for the supported step names, fields, and timing rules.

## Set portable defaults explicitly

The schema and current execution targets do not yet agree on every default. The
schema lists `/wp-admin` as the Playground landing page and PHP `8.0` as the v2
default, while current runtime selection uses `/` and PHP `8.3`. Set both values
when the same Blueprint must behave consistently across hosts:

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

## Known schema and runtime edges

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

The generated table reports what the current schema says today. These notes
call out places where the schema description or runtime behavior still needs to
converge with it.
