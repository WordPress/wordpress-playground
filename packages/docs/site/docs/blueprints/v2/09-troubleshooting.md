---
title: Troubleshoot Blueprints v2
slug: /blueprints/v2/troubleshooting
description: Diagnose Blueprint v2 parse, validation, runtime, resource, execution, and target-integration failures.
---

# Troubleshoot Blueprints v2

Find the phase that failed before changing the declaration. A resource retry
will not fix a schema error, and changing JSON fields will not fix a plugin PHP
fatal.

## Fast diagnosis

| Symptom                                              | Start here                                      |
| ---------------------------------------------------- | ----------------------------------------------- |
| JSON will not load                                   | [Parse](#1-parse-the-json)                      |
| Editor marks a field or reports an AJV path          | [Validate](#2-validate-the-declaration)         |
| No compatible WordPress/PHP runtime                  | [Resolve runtime](#3-resolve-the-runtime)       |
| CORS, 404, ZIP, Git, local-file, or path error       | [Resolve resources](#4-resolve-resources)       |
| PHP, plugin activation, SQL, WP-CLI, or step failure | [Execute](#5-execute-the-plan)                  |
| Wrong site, mode, landing page, or override          | [Integrate the target](#6-integrate-the-target) |

Open browser developer tools for Console and Network details. In Playground,
also inspect the **Logs** and **Files** panels. In the CLI, keep the complete
error and the first failing plan or step record.

## 1. Parse the JSON

JSON does not allow comments, trailing commas, unquoted keys, or JavaScript
expressions. Use `jsonc` only for explanatory documentation fragments; a real
`blueprint.json` must be JSON.

Common mistake:

```jsonc
{
	"version": 2,
	"plugins": ["query-monitor"], // Comments are not JSON.
}
```

Use the Playground **Write a Blueprint** editor or any JSON parser before
debugging runtime behavior.

## 2. Validate the declaration

### V2 is not selected

The marker must be the number `2`, not a string:

```jsonc
"version": 2
```

Missing `version`, `"version": "2"`, or another value does not select the v2
contract.

### A v1 field appears in v2

V2 rejects top-level `landingPage`, `login`, `preferredVersions`, `features`,
and `steps`. It also rejects v1 `{ "resource": "..." }` objects. Use the
[migration map](./migrate-from-v1).

### A tail step has the old shape

Typical rewrites are:

- `runSql` → `runSQL`, and `sql` → `source`;
- `writeFile` → `writeFiles`;
- `defineWpConfigConsts.consts` → `defineConstants.constants`;
- raw `runPHP.code` string → a file reference such as
  `{ "filename": "script.php", "content": "<?php ..." }`;
- `activateTheme.themeFolderName` → `themeDirectoryName`.

Every `additionalStepsAfterExecution` entry must be an object. V1-style
`false`, `null`, string, or missing placeholders are invalid.

### Baseline invariant fails

`usersBaseline: "empty"` requires all of the following:

- `contentBaseline: "empty"`;
- at least one declared user;
- at least one declared user with role `administrator`.

Baselines are invalid with `wordpressVersion: "none"`.

## 3. Resolve the runtime

### No compatible PHP version

Check `phpVersion.min`, `recommended`, and `max`. The recommended version must
fit within the range. Set an explicit tested PHP version in examples while
host defaults differ.

`phpVersion: "next"` is web-only and the CLI rejects it.

### Existing WordPress version was not rejected

A string `wordpressVersion` selects a version when creating a site; it does not
constrain an existing installation. Use object bounds:

```jsonc
"wordpressVersion": {
	"min": "6.8",
	"max": "6.9"
}
```

### PHP-only declaration fails during execution

`wordpressVersion: "none"` boots PHP without WordPress. Keep the declaration
to PHP and filesystem operations. Some WordPress-dependent combinations are
not rejected during semantic validation yet and fail later.

## 4. Resolve resources

### Wrong path namespace

- `./file` or `/file` reads the Blueprint execution context.
- `site:wp-content/...` reads the target WordPress filesystem.
- `https://...` downloads a remote resource.

If a file is created by an earlier plugin installation, use `site:`. If it is
shipped beside `blueprint.json`, use `./` or `/`.

### Local adjacent-file access denied

For standalone local JSON, add explicit CLI consent:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--blueprint-may-read-adjacent-files
```

Alternatively, package `blueprint.json` and its assets as a directory or ZIP
bundle.

### Browser fetch or CORS failure

Open the failing URL directly in a private browser window. Confirm it returns
the intended bytes rather than HTML, authentication, or a redirect warning.
The origin must allow the browser to fetch it. Try the CLI to distinguish a
CORS restriction from a missing resource.

### ZIP, image, or font was inlined as text

Inline `{ filename, content }` data is text. Use a bundle or URL for binary
archives, media, and fonts.

### WordPress HTTP calls fail after boot

Resource downloads by the runner and network access from installed WordPress
are different. If the resulting site needs outbound requests, explicitly set
`applicationOptions["wordpress-playground"].networkAccess` to true.

## 5. Execute the plan

### Plugin or theme activation fails

Inspect PHP logs for the first warning or fatal. Confirm the archive contains a
runnable plugin/theme at the expected root and includes built Composer/npm
artifacts. A Git source fetches committed files; it does not build them.

### PHP or WP-CLI cannot find WordPress

For PHP code that uses WordPress functions, load WordPress first:

```php
<?php
require '/wordpress/wp-load.php';
```

WP-CLI and multisite tail steps provision WP-CLI automatically; do not carry
v1 `extraLibraries` into v2.

### The error mentions a v1 step

The current v2 engine lowers its plan to the mature step executor. A low-level
failure may therefore expose a generated v1-style step or step number. Use the
nearest v2 field or plan stage to identify the source declaration rather than
copying the lowered record into your JSON.

### A retry duplicates data

Execution is sequential and not transactional. Earlier changes remain when a
later stage fails. Inspect the site before retrying and remove duplicate posts,
users, media, or plugin-created records as needed.

## 6. Integrate the target

### The landing page differs across hosts

Set `applicationOptions["wordpress-playground"].landingPage` explicitly. Do not
rely on an omitted default.

### Website or CLI flags did not override v2

Website query overrides apply to v1-generated declarations, not v2
`blueprint-url` input. In the CLI, declared PHP, WordPress, and login fields win;
the flags only fill missing fields.

### Existing-site mode changed unexpected data

Confirm the host selected `apply-to-existing-site`, review collision policies,
and restore the backup if needed. Baselines are skipped for existing sites, but
options, dependencies, content, and tail steps still modify the target.

See [apply to an existing site](./apply-to-existing-site) before another run.

## Still blocked?

Reduce the declaration to `version`, explicit PHP/WordPress versions, and an
explicit landing page. Add one top-level field at a time until the failure
returns. Include the reduced JSON, surface/command, target mode, browser or CLI
version, and full error when reporting a Playground issue.
