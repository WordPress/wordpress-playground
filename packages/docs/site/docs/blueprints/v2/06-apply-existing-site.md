---
title: Apply a Blueprint to an existing site
slug: /blueprints/v2/apply-to-existing-site
description: Safely apply Blueprint v2 to a local WordPress directory with the CLI, compatibility bounds, and collision policies.
---

# Apply a Blueprint to an existing site

Use this mode when you want the Playground CLI to update a
Playground-compatible WordPress directory on your computer. It mounts that
directory at `/wordpress` and changes its files and Playground SQLite database
in place. It does not connect to a live site's URL or external MySQL database.

Copying files from a conventional hosted site does not copy that site's MySQL
data. First make a local Playground-compatible copy with the content and
database state you intend to test, or import that data into a disposable
Playground site. Then follow this workflow on the copy.

The Playground website runs a Blueprint in a new Playground; it does not apply
one incrementally to the saved site you are viewing. Use the CLI workflow on
this page for an existing directory.

<div class="callout callout-warning">

**Work on a copy first**

Existing-site mode is not a dry run or a transaction, and it has no automatic
rollback. Keep a backup outside the mounted directory and test the Blueprint on
a disposable copy before using the intended directory.

</div>

## Safe workflow

1. Copy, export, or snapshot the site and keep the backup outside the mount.
2. Review every plugin, theme, URL, Git ref, PHP program, SQL file, and WP-CLI
   command in the Blueprint.
3. Validate the JSON in **New → Write a Blueprint** on the
   [Playground website](https://playground.wordpress.net/).
4. Run the Blueprint against a disposable copy with the same WordPress and PHP
   versions as the intended site.
5. Compare the result, including files, options, active plugins and themes,
   users, and content.
6. Only then run it against the intended local directory.

## Run it against a local directory

Mount the WordPress root at `/wordpress` and select existing-site mode:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--mode=apply-to-existing-site \
	--mount-before-install=/absolute/path/to/wordpress:/wordpress
```

This command directly modifies `/absolute/path/to/wordpress`. Replace that
placeholder with the Playground-compatible WordPress root on your computer—the
directory containing `wp-admin`, `wp-content`, `wp-includes`, and the local site
state you intend to change.

The explicit `--mode` cannot be combined with the older install-mode shortcuts
`--auto-mount`, `--wordpress-install-mode`, or `--skip-sqlite-setup`.

## Reject incompatible versions before making changes

Use version bounds when a site must run within a supported WordPress or PHP
range:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/plugins.php",
			"login": true
		}
	},
	"wordpressVersion": {
		"min": "6.8",
		"max": "6.9",
		"preferred": "6.9"
	},
	"phpVersion": {
		"min": "8.1",
		"recommended": "8.3",
		"max": "8.5"
	},
	"plugins": [
		{
			"source": "query-monitor@3.17.2",
			"active": true,
			"ifAlreadyInstalled": "skip"
		}
	]
}
```

For an existing site:

- `wordpressVersion.min` and `max` are checked against the installed WordPress
  version.
- `wordpressVersion.preferred` helps choose a release for a new site; it does
  not narrow the existing-site range.
- `phpVersion.min` and `max` limit the PHP runtimes Playground may use.
- `phpVersion.recommended` chooses the preferred runtime within those bounds.

A string such as `"wordpressVersion": "6.9"` selects a release when creating a
site. It does not reject a different version already installed in an existing
directory. Use the object form when compatibility matters.

## Know what is preserved

`contentBaseline` and `usersBaseline` apply only when Playground creates a new,
vanilla WordPress site. Existing-site mode skips both fields, so they cannot be
used to remove the site's existing posts or users.

If the site needs an intentional destructive operation, put it visibly in
`additionalStepsAfterExecution`, document it, and test it on the disposable
copy. Do not hide deletion inside an otherwise reusable Blueprint.

## Choose what happens to installed plugins and themes

Set `ifAlreadyInstalled` on every dependency whose installed version matters:

- `"overwrite"` replaces the installed copy and is the current default.
- `"skip"` keeps the installed copy.
- `"error"` stops before replacing it.

Current collision handling depends on the source:

| Install source                                                 | Honors `overwrite`, `skip`, and `error`?       |
| -------------------------------------------------------------- | ---------------------------------------------- |
| Themes, including ZIP and directory sources                    | Yes                                            |
| ZIP-backed plugins, including WordPress.org downloads          | Yes                                            |
| Directory-backed plugins, including Git and inline directories | No; they currently overwrite                   |
| Single-file `.php` plugins                                     | No; they currently write or overwrite the file |

When preserving an installed plugin is a requirement, use a ZIP-backed source
and set the policy explicitly.

Running the same Blueprint twice may still rerun activation hooks or create
duplicate content. Plugin installation policy does not make content imports,
PHP, SQL, or WP-CLI commands safe to repeat.

## Expect partial changes when a run fails

Playground executes the plan in order. If plugin activation fails after an
option was written, that option remains written and later work does not run.

After a failure:

1. Keep the complete error and identify the first failing plan item or step.
2. Inspect the test copy before retrying; earlier changes may already be there.
3. Prefer restoring the copy and rerunning from known state over repairing it
   by hand.
4. Check whether another run would duplicate posts, media, or plugin-created
   records. Declared users are updated by username instead of inserted again.

## Paths still keep their original meaning

An input such as `./content/site.wxr` still points beside `blueprint.json`. A
source such as `site:wp-content/...` points inside the mounted WordPress site at
the moment it is read. Neither syntax is a trust boundary: plugins, PHP, SQL,
and WP-CLI may still change the mounted site.

Before using the intended directory, review [security and reproducibility](./security).
If a test run fails, use the [phase-oriented troubleshooting guide](./troubleshooting).
