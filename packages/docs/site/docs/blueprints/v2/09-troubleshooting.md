---
title: Troubleshoot Blueprints v2
slug: /blueprints/v2/troubleshooting
description: Diagnose Blueprint v2 JSON, validation, runtime, resource, execution, and target-integration failures.
---

# Troubleshoot Blueprints v2

Start with the symptom. Most Blueprint failures happen in one of six phases,
and changing a later phase will not repair an earlier one.

## Fast diagnosis

| Symptom                                                                | Start here                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------- |
| JSON will not load or reports `Unexpected token`                       | [Parse the JSON](#1-parse-the-json)                 |
| The editor marks a field or reports a path such as `/plugins/0/source` | [Validate the Blueprint](#2-validate-the-blueprint) |
| Playground cannot choose a compatible WordPress or PHP runtime         | [Resolve the runtime](#3-resolve-the-runtime)       |
| The error mentions CORS, 404, ZIP, Git, a local file, or a path        | [Resolve resources](#4-resolve-resources)           |
| PHP, plugin activation, SQL, WP-CLI, or a step fails                   | [Execute the plan](#5-execute-the-plan)             |
| The wrong site, mode, landing page, or override is used                | [Integrate the target](#6-integrate-the-target)     |

In a browser, open developer tools for Console and Network details. In
Playground, open the Dock and inspect the **Logs** and **Files** panels. In the
CLI, keep the complete error and find the first failing plan item or step.

## 1. Parse the JSON

JSON does not allow comments, trailing commas, unquoted keys, or JavaScript
expressions. This fragment fails because it contains a comment and a trailing
comma:

```jsonc
{
	"version": 2,
	// Comments are not valid JSON.
	"plugins": ["query-monitor"],
}
```

The corrected JSON is:

```json
{
	"version": 2,
	"plugins": ["query-monitor"]
}
```

Open the [Playground website](https://playground.wordpress.net/), choose
**New → Write a Blueprint**, and resolve JSON errors before debugging runtime
behavior. A local JSON parser is also enough for this phase.

## 2. Validate the Blueprint

Validation checks each field against the v2 schema. An error path such as
`/plugins/0/source` points to `source` in the first plugin entry.

### V2 is not selected

The marker must be the number `2`, not a string:

```jsonc
"version": 2
```

A missing `version` selects v1. `"version": "2"` and other values do not select
the v2 contract.

### A v1 field appears in v2

V2 rejects top-level `landingPage`, `login`, `preferredVersions`, `features`,
and `steps`. It also rejects v1 `{ "resource": "..." }` objects. Use the
[migration maps](./migrate-from-v1) instead of mixing both formats.

### A post-setup step has the old shape

Common rewrites are:

- `runSql` → `runSQL`, and `sql` → `source`;
- `writeFile` → `writeFiles`;
- `defineWpConfigConsts.consts` → `defineConstants.constants`;
- raw `runPHP.code` string → a file source such as
  `{ "filename": "script.php", "content": "<?php ..." }`;
- `activateTheme.themeFolderName` → `themeDirectoryName`.

Every `additionalStepsAfterExecution` entry must be an object. Remove v1-style
`false`, `null`, and string placeholders before serializing the JSON.

### A baseline rule fails

`usersBaseline: "empty"` requires all of the following:

- `contentBaseline: "empty"`;
- at least one declared user;
- at least one declared user with role `administrator`.

Baselines are invalid with `wordpressVersion: "none"`.

## 3. Resolve the runtime

### No compatible PHP version

Check `phpVersion.min`, `recommended`, and `max`. The recommended version must
fit within the range. If the same Blueprint behaves differently across
surfaces, pin a PHP version that you have tested.

`phpVersion: "next"` is web-only and the CLI rejects it.

### An existing WordPress version was not rejected

A string `wordpressVersion` selects a release when creating a site. It does not
constrain an existing installation. Use object bounds:

```jsonc
"wordpressVersion": {
	"min": "6.8",
	"max": "6.9"
}
```

### A PHP-only Blueprint fails during execution

`wordpressVersion: "none"` boots PHP without WordPress. Keep that Blueprint to
PHP and filesystem operations. Some WordPress-dependent combinations are not
rejected during validation yet and fail later.

## 4. Resolve resources

### The path points to the wrong place

- `./file` or `/file` reads beside `blueprint.json`.
- `site:wp-content/...` reads inside the target WordPress site.
- `https://...` downloads a remote resource.

If an earlier plugin installation creates the file, use `site:`. If the file is
shipped with `blueprint.json`, use `./` or `/`. The
[resource chooser](./resources#where-does-the-file-live) covers every source
type.

### Local adjacent-file access is denied

For standalone local JSON, grant the CLI access explicitly:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--blueprint-may-read-adjacent-files
```

Alternatively, package `blueprint.json` and its assets as a ZIP bundle. A local
directory input is shorthand for its `blueprint.json`, so it still needs the
flag when the Blueprint reads sibling files.

### A browser fetch fails

Test three separate questions:

1. Open the URL in a private browser window. A 404, login screen, or HTML page
   means the URL does not return the intended public file.
2. Inspect the browser Network and Console panels. A direct v2 resource fetch
   currently needs the remote server to allow CORS.
3. Try the CLI. If the same URL works there, the resource exists and the browser
   restriction is the likely difference.

Do not assume a Playground host's proxy support applies to ordinary v2 declared
resources.

### A ZIP, image, or font was inlined as text

Inline `{ "filename": "...", "content": "..." }` data is text. Use a bundle
or URL for binary archives, media, and fonts.

### WordPress HTTP calls fail after boot

Resource downloads by the runner and network access from installed WordPress
are separate. If the resulting site needs outbound requests, set
`applicationOptions["wordpress-playground"].networkAccess` to true.

## 5. Execute the plan

### Plugin or theme activation fails

Inspect PHP logs for the first warning or fatal. Confirm that the archive has a
runnable plugin or theme at the expected root and includes its built Composer
or npm artifacts. A Git source fetches committed files; it does not build them.

### PHP or WP-CLI cannot find WordPress

For PHP code that uses WordPress functions, load WordPress first:

```php
<?php
require '/wordpress/wp-load.php';
```

WP-CLI and multisite post-setup steps provision WP-CLI automatically. Do not
carry v1 `extraLibraries` into v2.

### The error mentions a v1 step

The current v2 engine translates some plan items into internal v1-style
executor steps. A low-level error may therefore show a generated step or step
number. Find the nearest v2 field or plan stage; do not copy the internal record
into your JSON.

### A retry duplicates data

Execution is sequential and not transactional. Earlier changes remain when a
later stage fails. On a disposable site, prefer starting again from a fresh
site. For an existing local directory, restore the tested backup or copy before
retrying. Inspect for duplicate posts, media, and plugin-created records.
Declared users are updated by username instead of inserted again.

## 6. Integrate the target

### The landing page differs across hosts

Set `applicationOptions["wordpress-playground"].landingPage` explicitly instead
of relying on a host default.

### Website or CLI values did not override v2

Website query overrides apply to v1-generated Blueprints, not v2 input loaded
through `blueprint-url`. In the CLI, declared PHP, WordPress, and login values
win; CLI values fill fields that the Blueprint omits.

### Existing-site mode changed unexpected data

Confirm that the CLI selected `apply-to-existing-site`, review collision
policies, and restore the tested backup or copy if needed. Baselines are skipped
for existing sites, but options, dependencies, content, and post-setup steps
still modify the target.

Read the [existing-site safety workflow](./apply-to-existing-site) before
another run.

## Start again from a known-good minimum

When the failing phase is still unclear, replace the Blueprint temporarily with
this complete, valid minimum:

```json blueprint-v2
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"version": 2,
	"applicationOptions": {
		"wordpress-playground": {
			"landingPage": "/wp-admin/",
			"login": true
		}
	},
	"phpVersion": "8.3",
	"wordpressVersion": "latest"
}
```

Run it on a disposable site. Add one top-level field at a time until the failure
returns. The last field added usually identifies the relevant phase.

If you remain blocked, open a
[Playground bug report](https://github.com/WordPress/wordpress-playground/issues/new?template=1-bug-report.yml)
and include:

```text
- Reduced Blueprint JSON:
- Playground surface and exact URL or CLI command:
- Target mode: create-new-site, apply-to-existing-site, or mount-only
- Browser and operating system, or CLI version:
- First complete error:
- Expected result:
- Actual result:
```
