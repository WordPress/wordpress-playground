---
title: Security and reproducibility
slug: /blueprints/v2/security
description: Understand Blueprint v2 trust, network, local-file, secret, dependency pinning, snapshot, and integrity boundaries.
---

# Security and reproducibility

A Blueprint is readable JSON, but it is not harmless data. Treat a third-party
Blueprint like code before you run it.

## What a Blueprint can do

A declaration can:

- install and execute plugin, theme, and mu-plugin PHP;
- run arbitrary PHP and WP-CLI commands;
- execute SQL and modify WordPress files, users, options, and content;
- download resources and, when enabled, let the site access the network;
- read files available in its Blueprint execution context;
- modify an existing target without automatic rollback.

Browser Playground runs PHP in WebAssembly and isolates the WordPress document
from the parent application. That containment reduces risk to the host browser,
but it does not protect the temporary WordPress site from the code you install.
It also does not make an existing mounted site, credentials passed to remote
services, or copied data safe.

## Review third-party declarations

Before running one:

1. Read the complete JSON and every adjacent file in its bundle.
2. Resolve shortened or redirected URLs and identify who controls each host.
3. Inspect plugin, theme, Git, PHP, SQL, and WP-CLI sources.
4. Check whether a mutable `latest`, branch, tag, or URL is acceptable.
5. Look for `networkAccess: true` and understand what installed code may call.
6. Use a disposable site unless you intentionally reviewed an existing-site
   application.

Do not infer trust from a familiar filename, gallery entry, or shared URL. A
bundle can contain different bytes while keeping the same name.

## Network access

V2 defaults the resulting site's network access to false. Enable it explicitly
only when installed WordPress code needs outbound requests:

```jsonc
"applicationOptions": {
	"wordpress-playground": {
		"landingPage": "/wp-admin/",
		"login": true,
		"networkAccess": true
	}
}
```

The runner may still need to download declared plugins, themes, WordPress, or
other remote inputs. Browser CORS rules apply to those downloads. Site network
access and runner resource fetching are separate trust decisions.

## Local files and bundles

Execution-context paths are confined beside `blueprint.json`; `site:` paths are
confined to the target WordPress root. The CLI requires
`--blueprint-may-read-adjacent-files` before a standalone local JSON file may
read sibling data.

That consent is not a content audit. Review symlinks, archive contents, and the
files selected by the declaration before granting access. Do not mount a broad
home or project directory when a small bundle will do.

## Keep secrets out of Blueprints

Blueprint JSON, URL fragments, logs, public repositories, CI artifacts, and
bundles are poor secret stores. Do not include production passwords, API keys,
private download tokens, cookies, or database exports with sensitive data.

If an integration must authenticate a resource request, let the trusted host
supply credentials out of band and ensure errors and progress callbacks cannot
leak them. The portable JSON should contain no secret value.

## Freshness, repeatability, snapshots, and integrity

These are different promises:

| Goal              | Example                                                    | Limitation                                                      |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Freshness         | `wordpressVersion: "latest"`, plugin `@latest`, Git branch | The result changes over time                                    |
| Repeatable recipe | Exact releases and immutable Git commit                    | A remote host can still replace or remove bytes                 |
| Snapshot          | CLI `build-snapshot` output                                | Captures site files/data at one point in time                   |
| Integrity         | Verified content hash or signed artifact                   | Blueprint resources do not yet provide a general checksum field |

For a reviewable reproduction, prefer:

```jsonc
"wordpressVersion": "6.9.1",
"phpVersion": "8.3",
"plugins": ["query-monitor@3.17.2"],
"themes": [
	{
		"source": {
			"gitRepository": "https://github.com/example/theme",
			"ref": "7b3f9d0e9f4a6d5f5f01981c1c0ca5fd5f65a5c1"
		}
	}
]
```

Use real versions and commits that your project has tested. A pinned label is
not a cryptographic integrity guarantee.

Build a snapshot after a successful, reviewed run when consumers need captured
site state rather than a recipe:

```bash
npx @wp-playground/cli@latest build-snapshot \
	--blueprint=./blueprint.json \
	--outfile=wordpress.zip
```

Keep the source Blueprint beside the snapshot so reviewers know how it was
created.

## Existing sites

Never apply an untrusted declaration to valuable data. Back up first, choose
explicit collision policies, and expect partial state if execution stops. See
[apply a Blueprint to an existing site](./apply-to-existing-site) for the
operational checklist.
