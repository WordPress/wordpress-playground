---
title: Content and site data
slug: /blueprints/v2/reference/content-and-site-data
description: Reference Blueprint v2 declarations for site settings, extensions, users, content, media, and fonts.
---

# Content and site data

Blueprint v2 declares site state in top-level fields. The runner applies those
fields in a fixed lifecycle; moving keys in the JSON object does not reorder
them. See [How Blueprints v2 works](/blueprints/v2/how-it-works) for the complete
execution plan.

The examples below are partial `jsonc` fragments, not complete Blueprints. Put
them inside an object with exact numeric `"version": 2`, then validate the
complete document against the [schema reference](/blueprints/v2/reference/schema).
File-like values use the source forms described in
[Data sources, paths, and bundles](/blueprints/v2/resources).

## Initial content and users

Baselines only apply when the host creates a new vanilla WordPress site. They
are skipped when applying a Blueprint to an existing site.

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
	"blogname": "Documentation fixture",
	"timezone_string": "Europe/Warsaw",
	"permalink_structure": "/%postname%/",
	"fixture_flags": {
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

| Property         | Plugins                                                                            | Themes                                                                    |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Activation       | `active: true` or `false`                                                          | Items in `themes` stay inactive; `activeTheme` is installed and activated |
| Existing target  | `ifAlreadyInstalled`: file/ZIP sources honor `"overwrite"`, `"skip"`, or `"error"` | Same three policies                                                       |
| Install failure  | `onError: "throw"` or `"skip-plugin"`                                              | `onError: "throw"` or `"skip-theme"`                                      |
| Target directory | `targetDirectoryName`                                                              | `targetDirectoryName`                                                     |
| Extra behavior   | `activationOptions`, `humanReadableName`                                           | `importStarterContent`, `humanReadableName`                               |

Set collision and failure policies explicitly when the target may already
contain a plugin or theme. `activationOptions` are temporarily exposed through
a plugin-specific WordPress option while its activation hook runs.

Themes and file- or ZIP-backed plugins honor `ifAlreadyInstalled`.
Directory-backed plugin sources, including Git and inline directories,
currently overwrite and ignore `skip` or `error`.

```jsonc
"plugins": [
	"query-monitor@3.17.2",
	{
		"source": "./plugins/example-plugin.zip",
		"active": true,
		"activationOptions": {
			"fixtureMode": true
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
		"filename": "fixture-mode.php",
		"content": "<?php define('FIXTURE_MODE', true);"
	}
]
```

## Roles and users

Every role requires `name` and a capability map. Capability values are
currently **strings**, not JSON booleans. Use `"true"` to grant and `"false"` to
remove a capability.

Every user requires `username`, `email`, `role`, and a string-to-string `meta`
map. There is no supported `password` property in a v2 user declaration. A new
account receives a generated password; application login settings are separate
from user creation.

```jsonc
"roles": [
	{
		"name": "fixture_editor",
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
		"role": "fixture_editor",
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

The current runner registers these declarations through generated must-use
plugins. It does not require Secure Custom Fields. Consult the
[schema reference](/blueprints/v2/reference/schema) for the supported
`register_post_type()` argument subset.

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
					"fixture": "yes"
				}
			},
			"./content/second-post.html"
		],
		"urlsMode": "rewrite",
		"urlsMap": {
			"https://old.example": "https://new.example"
		}
	}
]
```

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
can download the referenced assets. The relevant remote hosts must be
reachable; browser responses must also satisfy CORS. Use `"hotlink"` when site
network access should remain disabled.

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

## Media

Each `media` entry is a file reference or an object with `source` and optional
`title`, `description`, `alt`, and `caption`. The runner copies the file into
uploads and creates a Media Library attachment. The target WordPress runtime
decides which media formats it accepts.

```jsonc
"media": [
	"./media/logo.png",
	{
		"source": "https://example.com/hero.jpg",
		"title": "Hero image",
		"description": "Homepage fixture",
		"alt": "Example product on a table",
		"caption": "Example product"
	}
]
```

## Fonts

`fonts` maps a slug to either one font file reference or a full WordPress font
collection object. A collection uses `font_families`,
`font_family_settings`, and optional `fontFace` entries.

```jsonc
"fonts": {
	"fixture-sans": "./fonts/fixture-sans.woff2",
	"fixture-collection": {
		"font_families": [
			{
				"font_family_settings": {
					"name": "Fixture Sans",
					"slug": "fixture-sans",
					"fontFamily": "Fixture Sans",
					"fontFace": [
						{
							"fontFamily": "Fixture Sans",
							"fontStyle": "normal",
							"fontWeight": "400",
							"src": "./fonts/fixture-sans.woff2"
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

## Operations outside the declarative model

When these fields cannot express the required change, use the smallest possible
imperative tail and document why it is necessary. See
[Additional steps after execution](/blueprints/v2/reference/additional-steps).
