---
title: Apply a Blueprint v2 to an existing site
slug: /blueprints/v2/apply-to-existing-site
description: Protect existing WordPress data with compatibility bounds, collision policies, backups, and explicit Blueprint v2 site mode.
---

# Apply a Blueprint v2 to an existing site safely

An existing-site run changes real files and database records. It is not a dry
run, a transaction, or a general-purpose state reconciler. Back up valuable
data and test the declaration on a copy first.

## Declare compatibility bounds

Use object constraints when the target must run a supported WordPress or PHP
version:

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
	],
	"siteOptions": {
		"blogdescription": "Prepared for compatibility testing"
	}
}
```

For an existing site, the object form enforces the WordPress bounds. A string
such as `"wordpressVersion": "6.9"` is a new-site selection hint and does not
reject a different installed version. `preferred` influences new-site
selection but does not narrow compatibility.

## Baselines are skipped

`contentBaseline` and `usersBaseline` only clean up a newly created vanilla
WordPress installation. Existing-site mode deliberately skips both fields.
They cannot be used to erase existing posts or users.

If an existing site needs an explicit destructive operation, make it visible in
`additionalStepsAfterExecution`, document it, and test it on a disposable copy.
Do not hide deletion inside an otherwise reusable declaration.

## Choose collision behavior

Theme definitions and file- or ZIP-backed plugin definitions can state what
happens when a target directory already exists:

- `"overwrite"` replaces it and is the current default.
- `"skip"` leaves the installed copy in place.
- `"error"` stops rather than choosing implicitly.

Pick a policy for every dependency where the existing version matters. A repeat
run is not automatically idempotent: installation, activation hooks, imported
content, PHP, SQL, and WP-CLI can all produce different results or duplicates.

Directory-backed plugin sources, including Git directories and inline
directories, currently overwrite the target and do not honor `"skip"` or
`"error"`. Do not use those sources when preserving an existing plugin is a
requirement.

## Run against mounted files with the CLI

Create a backup, then mount the WordPress root at `/wordpress`:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--mode=apply-to-existing-site \
	--mount-before-install=/absolute/path/to/wordpress:/wordpress
```

The explicit `--mode` cannot be combined with the older install-mode shortcuts
`--auto-mount`, `--wordpress-install-mode`, or `--skip-sqlite-setup`.

The Playground website does not apply a Blueprint incrementally to a saved site.
Running from the Blueprint editor recreates a temporary/autosaved Playground or
opens a stored site's declaration in a new Playground. Use the explicit CLI
mode above for in-place application to mounted files.

## Understand partial failure

Playground executes the plan sequentially. If plugin activation fails after an
option was written, the option remains written and later plan items do not run.
There is no automatic rollback.

Before applying:

1. Export or snapshot the target and keep the backup outside the mount.
2. Validate the declaration in the Blueprint editor.
3. Run it against a disposable copy with the same WordPress and PHP versions.
4. Review every remote URL, Git ref, plugin, theme, PHP program, SQL file, and
   WP-CLI command.
5. Choose collision policies and identify operations that create duplicate
   content on repeat runs.
6. Record the exact failure and inspect the target before retrying.

## Paths in existing-site mode

An execution-context path such as `./content/site.wxr` still points beside the
Blueprint. A `site:wp-content/...` path points inside the mounted existing site
at the time it is consumed. Neither form grants access outside its own root.

Continue with [security and reproducibility](./security) and the
[phase-oriented troubleshooting guide](./troubleshooting).
