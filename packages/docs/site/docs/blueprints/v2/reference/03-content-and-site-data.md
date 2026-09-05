---
title: Content and site data
slug: /blueprints/v2/reference/content-and-site-data
description: Reference Blueprint v2 fields for site settings, extensions, users, content, media, and fonts.
---

# Content and site data

Blueprint v2 describes site state in top-level fields. The runner applies those
fields in a fixed lifecycle; moving keys in the JSON object does not reorder
them. See [How v2 Blueprints work](/blueprints/v2/blueprints-101/how-it-works) for the complete
execution plan.

The examples below are partial `jsonc` fragments, not complete Blueprints. Put
them inside an object with exact numeric `"version": 2`, then validate the
complete document against the [schema reference](/blueprints/v2/reference/schema).
File-like values use the source forms described in
[Use files, URLs, and bundles](/blueprints/v2/resources).

## Find a field

| You want to                                  | Go to                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| Keep or remove WordPress starter data        | [`contentBaseline` and `usersBaseline`](#starter-content-and-users)           |
| Set options, constants, or the site language | [Options, constants, and language](#options-constants-and-language)           |
| Install plugins, themes, or mu-plugins       | [Plugins, themes, and must-use plugins](#plugins-themes-and-must-use-plugins) |
| Create roles or users                        | [Roles and users](#roles-and-users)                                           |
| Register a custom post type                  | [Custom post types](#custom-post-types)                                       |
| Create posts or import WXR or SQL            | [Content](#content)                                                           |
| Add files to the Media Library               | [Media](#media)                                                               |
| Install fonts                                | [Fonts](#fonts)                                                               |
| Know what happens on another run             | [Repeat-run behavior](#repeat-run-behavior)                                   |

## Starter content and users

The two baseline fields decide what to keep from the fresh WordPress
installation before your own data is added. They only apply when the host
creates a new site and are skipped when applying a Blueprint to an existing
site.

| Field             | Accepted values                                                                                              | Effect on a new site                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `contentBaseline` | `"keep-all"`, `"empty"`, `"posts"`, `"pages"`, or a non-empty list of `"posts"`, `"pages"`, and `"comments"` | Retain all initial content, remove all initial content, or retain only the selected types |
| `usersBaseline`   | `"keep-all"` or `"empty"`                                                                                    | Retain the installation administrator or remove it before declared users are created      |

Comments can be retained only together with both posts and pages. An empty user
baseline requires `contentBaseline: "empty"` and at least one declared user with
the `administrator` role. Neither baseline is valid when
`wordpressVersion` is `"none"`.

```jsonc
"contentBaseline": "empty",
"usersBaseline": "empty",
"users": [
	{
		"username": "site-admin",
		"email": "site-admin@example.com",
		"role": "administrator",
		"meta": {}
	}
]
```

With this example, `login: true` would still try to log in as `admin`, which the
empty user baseline removes. Name the replacement administrator instead. The
schema currently requires a password string even though Playground automatic
login uses only the username, so use a non-secret placeholder:

```jsonc
"applicationOptions": {
	"wordpress-playground": {
		"login": {
			"username": "site-admin",
			"password": "not-used"
		}
	}
}
```

## Repeat-run behavior

Blueprint v2 describes the intended site, but not every field reconciles an
existing site to that state. Running the same Blueprint again can create more
data:

| Field                       | What another run does                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `roles`                     | Creates a missing role, then adds or removes the listed capabilities on that role                               |
| `users`                     | Reuses a matching username and applies its declared role and metadata; an existing email address is not changed |
| Inline or file-backed posts | Inserts new posts again; it does not match them by title or slug                                                |
| `media`                     | Creates new Media Library attachments again                                                                     |
| Plugins and themes          | Follow the source-specific `ifAlreadyInstalled` behavior described below                                        |

WXR and SQL imports have their own source-dependent identity and overwrite
rules. Test a second run before treating any import as repeat-safe. When
valuable existing data is involved, use the
[existing-site safety workflow](/blueprints/v2/apply-to-existing-site).

## Options, constants, and language

| Field          | Shape                                                                      | Runtime behavior                                                                                  |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `siteOptions`  | Option names mapped to JSON strings, numbers, booleans, arrays, or objects | Calls WordPress `update_option()` for each value                                                  |
| `constants`    | Constant names mapped to strings, numbers, or booleans                     | Defines constants in the Playground runtime before later plan items run                           |
| `siteLanguage` | WordPress locale string such as `"de_DE"`                                  | Sets the site language and downloads missing translations for core, installed plugins, and themes |

`siteOptions.siteUrl` is reserved and rejected. When
`permalink_structure` changes, the runner also flushes rewrite rules.

```jsonc
"siteOptions": {
	"blogname": "Documentation example",
	"timezone_string": "Europe/Warsaw",
	"permalink_structure": "/%postname%/",
	"example_flags": {
		"show_welcome": true
	}
},
"constants": {
	"WP_DEBUG": true,
	"WP_ENVIRONMENT_TYPE": "local"
},
"siteLanguage": "de_DE"
```

## Plugins, themes, and must-use plugins

`plugins`, `themes`, and `activeTheme` accept a WordPress.org slug, a pinned
`slug@version`, a URL, an execution-context path, an inline file or directory,
or a Git reference. Wrap a source in an object to control installation.

| Property         | Plugins                                                 | Themes                                                                    |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Activation       | `active: true` or `false`                               | Items in `themes` stay inactive; `activeTheme` is installed and activated |
| Existing target  | ZIP sources honor `"overwrite"`, `"skip"`, or `"error"` | Same three policies                                                       |
| Install failure  | `onError: "throw"` or `"skip-plugin"`                   | `onError: "throw"` or `"skip-theme"`                                      |
| Target directory | `targetDirectoryName`                                   | `targetDirectoryName`                                                     |
| Extra behavior   | `activationOptions`, `humanReadableName`                | `importStarterContent`, `humanReadableName`                               |

Set collision and failure policies explicitly when the target may already
contain a plugin or theme. `activationOptions` are temporarily exposed through
a plugin-specific WordPress option while its activation hook runs.

Themes and ZIP-backed plugins honor `ifAlreadyInstalled`. Directory-backed
plugin sources, including Git and inline directories, and single-file plugins
currently overwrite and ignore `skip` or `error`.

```jsonc
"plugins": [
	"query-monitor@3.17.2",
	{
		"source": "./plugins/example-plugin.zip",
		"active": true,
		"activationOptions": {
			"demoMode": true
		},
		"targetDirectoryName": "example-plugin",
		"ifAlreadyInstalled": "error",
		"onError": "throw",
		"humanReadableName": "Example plugin"
	}
],
"themes": [
	{
		"source": "https://example.com/example-theme.zip",
		"targetDirectoryName": "example-theme",
		"ifAlreadyInstalled": "skip",
		"onError": "skip-theme"
	}
],
"activeTheme": {
	"source": "twentytwentyfive@1.2",
	"importStarterContent": true,
	"ifAlreadyInstalled": "overwrite",
	"onError": "throw"
}
```

`muPlugins` is an array of data references. Each file or directory is written
under `wp-content/mu-plugins` before themes and regular plugins are installed:

```jsonc
"muPlugins": [
	{
		"filename": "example-mode.php",
		"content": "<?php define('EXAMPLE_MODE', true);"
	}
]
```

## Roles and users

Every role requires `name` and a capability map. Capability values are
currently **strings**, not JSON booleans. Use `"true"` to grant and `"false"` to
remove a capability.

Every user requires `username`, `email`, `role`, and a string-to-string `meta`
map. There is no supported `password` property in a v2 user entry. A new
account receives a generated password; application login settings are separate
from user creation.

```jsonc
"roles": [
	{
		"name": "example_editor",
		"capabilities": {
			"read": "true",
			"edit_posts": "true",
			"publish_posts": "false"
		}
	}
],
"users": [
	{
		"username": "editor",
		"email": "editor@example.com",
		"role": "example_editor",
		"meta": {
			"first_name": "Example",
			"last_name": "Editor"
		}
	}
]
```

## Custom post types

`postTypes` maps a post type key to either an inline argument object or a JSON
file in the Blueprint execution context. Keys may contain lowercase letters,
digits, dashes, and underscores and may be at most 20 characters.

The current runner registers these post types through generated must-use
plugins. It does not require Secure Custom Fields. Consult the
[public schema](https://playground.wordpress.net/blueprint-schema.json) in an
editor for the complete supported `register_post_type()` argument subset.
Common fields include `label`, `labels`, `description`, `public`, `show_ui`,
`show_in_rest`, `supports`, `taxonomies`, `has_archive`, `rewrite`, capability
settings, and block-editor template settings.

```jsonc
"postTypes": {
	"book": {
		"label": "Books",
		"public": true,
		"show_in_rest": true,
		"supports": ["title", "editor", "custom-fields"]
	},
	"movie": "./post-types/movie.json"
}
```

## Content

`content` is an ordered array of imports.

| `type`       | `source` forms                                                       | Purpose                                                                                |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `posts`      | One file reference, one inline post object, or a mixed array of both | Create posts, pages, or custom post types                                              |
| `wxr`        | One WXR file reference or an array of WXR file references            | Import a WordPress export with explicit author, user, comment, URL, and asset policies |
| `mysql-dump` | One SQL file reference or an array of SQL file references            | Execute MySQL-style dump content through Playground's SQL import path                  |

### Posts

An inline post requires `post_title` and accepts supported `wp_insert_post()`
fields, taxonomy terms, metadata, and a page template. `post_author`, when
present, is a numeric existing WordPress user ID. Omit it to let the runner
resolve an author.

`urlsMode` is `"rewrite"` or `"preserve"`. With rewrite mode, `urlsMap` replaces
matching URLs in post content, excerpts, GUIDs, and metadata.

```jsonc
"content": [
	{
		"type": "posts",
		"source": [
			{
				"post_title": "Release notes",
				"post_status": "publish",
				"post_content": "<p>See https://old.example/docs.</p>",
				"post_tags": ["release"],
				"meta_input": {
					"source": "example"
				}
			}
		],
		"urlsMode": "rewrite",
		"urlsMap": {
			"https://old.example": "https://new.example"
		}
	}
]
```

A bare file source has intentionally limited metadata in the current runner. It
always creates one published `post` titled **Untitled Post**, using the file as
`post_content`:

```jsonc
"content": [
	{
		"type": "posts",
		"source": "./content/body.html"
	}
]
```

Use an inline post object when you need to control the title, slug, status, post
type, author, taxonomy terms, or metadata. Repeating either form inserts another
post.

### WXR

Set the WXR controls explicitly. In particular, do not rely on omitted author
and user settings while their interactions are being standardized.

| Property                | Accepted values                                  | Meaning                                                         |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `authorsMode`           | `"map"`, `"create"`, or `"default-author"`       | Map remote authors, create authors, or assign a fallback author |
| `authorsMap`            | Remote usernames mapped to local usernames       | Required with `authorsMode: "map"`                              |
| `defaultAuthorUsername` | Local username                                   | Fallback used by `"default-author"` mode                        |
| `importUsers`           | Boolean                                          | Whether to import users from the WXR                            |
| `importComments`        | Boolean                                          | Whether to import comments                                      |
| `urlsMode`              | `"rewrite"` or `"preserve"`                      | Rewrite imported URLs or leave them unchanged                   |
| `urlsMap`               | Source base URLs mapped to replacement base URLs | Supply explicit URL replacements                                |
| `staticAssets`          | `"fetch"` or `"hotlink"`                         | Download referenced assets or keep remote asset URLs            |

```jsonc
"content": [
	{
		"type": "wxr",
		"source": "./content/site.wxr",
		"authorsMode": "map",
		"authorsMap": {
			"remote-editor": "editor"
		},
		"importUsers": false,
		"importComments": true,
		"urlsMode": "rewrite",
		"urlsMap": {
			"https://old.example": "https://new.example"
		},
		"staticAssets": "fetch"
	}
]
```

`staticAssets: "fetch"` requires
`applicationOptions["wordpress-playground"].networkAccess: true` so WordPress
can download the referenced assets. Those attachment requests use the host's
WordPress networking path, including its proxy when one is available. A remote
WXR `source`, by contrast, is an ordinary declared v2 resource and currently
needs direct browser CORS access. Use `"hotlink"` when site network access
should remain disabled.

### MySQL dumps

Use file references rather than an inline SQL string. Multiple sources run in
array order.

```jsonc
"content": [
	{
		"type": "mysql-dump",
		"source": [
			"./sql/schema.sql",
			"./sql/content.sql"
		]
	}
]
```

Playground stores WordPress data in SQLite. The import path translates
supported MySQL-style statements before execution; it is not a full MySQL
server or a lossless restore path for every database-specific feature. Test the
complete dump in a fresh Playground and inspect any custom tables before using
it as a reusable example.

## Media

Each `media` entry is a file reference or an object with `source` and optional
`title`, `description`, `alt`, and `caption`. The runner copies the file into
uploads and creates a Media Library attachment. The target WordPress runtime
decides which media formats it accepts. The source basename must already be a
safe WordPress filename; the run fails rather than silently renaming it. Prefer
simple names made from letters, numbers, dashes, and a normal file extension.

```jsonc
"media": [
	"./media/logo.png",
	{
		"source": "https://example.com/hero.jpg",
		"title": "Hero image",
		"description": "Homepage example",
		"alt": "Example product on a table",
		"caption": "Example product"
	}
]
```

Each run creates another attachment. The generated attachment ID is not
available for interpolation into another Blueprint field. When post content
must display the same asset, use a stable URL, import content that already
references the intended asset, or perform the relationship in a final setup
step.

## Fonts

`fonts` maps a slug to either one font file reference or a full WordPress font
collection object. A collection uses `font_families`,
`font_family_settings`, and optional `fontFace` entries.

```jsonc
"fonts": {
	"example-sans": "./fonts/example-sans.woff2",
	"example-collection": {
		"font_families": [
			{
				"font_family_settings": {
					"name": "Example Sans",
					"slug": "example-sans",
					"fontFamily": "Example Sans",
					"fontFace": [
						{
							"fontFamily": "Example Sans",
							"fontStyle": "normal",
							"fontWeight": "400",
							"src": "./fonts/example-sans.woff2"
						}
					]
				},
				"categories": ["sans-serif"]
			}
		]
	}
}
```

The current runner accepts `.woff2`, `.woff`, `.ttf`, and `.otf` font files and
requires a WordPress 6.5-or-newer runtime with the Font Library post types. It
stops the Blueprint when those requirements are not met.

## Work outside the top-level fields

When these fields cannot express the required change, use the fewest possible
final steps and document why they are necessary. See
[Run final setup steps](/blueprints/v2/reference/additional-steps).
