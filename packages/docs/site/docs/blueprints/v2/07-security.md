---
title: Run and share Blueprints safely
slug: /blueprints/v2/security
description: Review trust, network and local-file access, secrets, version pins, and snapshots before running or sharing a v2 Blueprint.
---

# Run and share Blueprints safely

A Blueprint is readable JSON, but it can install and execute code. Treat a
third-party Blueprint like code before you run it.

The right precaution depends on where you run it:

| Where you run the Blueprint             | Safe default                                                   |
| --------------------------------------- | -------------------------------------------------------------- |
| A temporary browser Playground          | Use it for experiments, but do not add private data or secrets |
| The CLI with a local bundle             | Review the bundle and grant access only to the files it needs  |
| A mounted existing site                 | Back up first and test the Blueprint on a disposable copy      |
| Valuable data with an unknown Blueprint | Do not run it there; use a disposable Playground instead       |

## Match each capability with a safeguard

| A Blueprint can…                                     | Safer action                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Install and execute plugin, theme, and mu-plugin PHP | Trust or review the exact source                                   |
| Run PHP, SQL, and WP-CLI commands                    | Read the program or command before running it                      |
| Modify WordPress files, users, options, and content  | Use a disposable site or a tested backup workflow                  |
| Download remote resources                            | Check who controls each URL and pin a tested release when possible |
| Read files in its execution context                  | Keep the bundle or allowed local directory narrow                  |
| Let installed WordPress code access the network      | Leave network access off unless the site needs it                  |

Browser Playground runs PHP in WebAssembly and isolates the WordPress document
from the parent application. That containment reduces risk to the host browser;
it does not make installed code trustworthy or protect data copied into the
temporary WordPress site.

## Review a third-party Blueprint

Before running one:

1. Read the complete JSON and inventory the files in its bundle.
2. Resolve shortened or redirected URLs and identify who controls each host.
3. Check plugin, theme, Git, PHP, SQL, and WP-CLI sources.
4. Decide whether a mutable `latest`, branch, tag, or URL is acceptable.
5. Look for `networkAccess: true` and consider what installed code may call.
6. Use a disposable site if you cannot review or trust every input.

Do not infer trust from a familiar filename, gallery entry, or shared URL. A
bundle can contain different bytes while keeping the same name.

## Enable site network access only when needed

V2 defaults the resulting site's network access to false. Enable it when
installed WordPress code needs outbound requests:

```jsonc
"applicationOptions": {
	"wordpress-playground": {
		"landingPage": "/wp-admin/",
		"login": true,
		"networkAccess": true
	}
}
```

The website, CLI, or JavaScript runner may still download declared plugins,
themes, WordPress, and other remote inputs. Those downloads are separate from
network access inside the resulting site. Ordinary v2 resource downloads in a
browser currently need the remote server to permit the request through CORS;
do not assume a host's proxy support applies to them.

Leaving `networkAccess` off does not make a remote plugin or theme safe. It only
removes one capability from the installed site.

## Grant the smallest useful local-file access

The resolver rejects `./` or `/` paths that lexically leave the location
containing `blueprint.json`, and `site:` paths that leave the target WordPress
root. A filesystem symlink can still point somewhere else, so inspect symlink
targets before granting local access.

For a local JSON file—including one selected through a directory input—the CLI
requires consent before it reads sibling data:

```bash
npx @wp-playground/cli@latest server \
	--blueprint=./blueprint.json \
	--blueprint-may-read-adjacent-files
```

The flag grants the Blueprint's execution context access to the JSON file's
parent directory, not only to individual paths you noticed. It does not review
the content. Put the JSON and its inputs in a narrow directory, then inspect
that directory, its archives, and its symlink targets first.

## Keep secrets outside portable JSON

Blueprint JSON, URL fragments, logs, public repositories, CI artifacts, and
bundles are poor secret stores. Do not include production passwords, API keys,
private download tokens, cookies, or database exports with sensitive data.

A portable v2 Blueprint has no general secret-placeholder mechanism. If a
trusted integration fetches an authenticated resource outside the Blueprint,
it must also keep credentials out of errors, progress output, and the portable
JSON. When that integration is unavailable, use a public or pre-bundled input
instead of embedding a secret in a URL.

## Choose freshness or repeatability deliberately

These goals are different:

| Goal                    | Example                                                         | Limitation                                                                       |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Follow current releases | `wordpressVersion: "latest"`, plugin `@latest`, or a Git branch | The result changes over time                                                     |
| Pin a recipe            | Exact releases and an immutable Git commit                      | A remote host can still replace or remove bytes                                  |
| Capture one result      | CLI `build-snapshot` output                                     | Captures the `/wordpress` filesystem produced by that run, not the source recipe |
| Verify integrity        | A content hash or signed artifact checked outside the Blueprint | Blueprint resources do not yet have a general checksum field                     |

For a reviewable reproduction, pin the inputs that define the result. This is an
illustrative fragment; replace the repository, versions, and commit with values
your project has tested:

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

The commands in these guides use `@wp-playground/cli@latest` for quick
experiments. For CI and long-lived reproductions, install an exact CLI version
and commit the package lock, as shown in the
[bug-reproduction tutorial](/blueprints/v2/tutorials/bug-reproduction#4-run-the-same-example-headlessly).

A pinned label is not a cryptographic integrity guarantee. Use independent hash
or signature verification when you need that guarantee.

After a successful, reviewed run, build a snapshot when consumers need the
captured WordPress filesystem rather than a recipe:

```bash
npx @wp-playground/cli@latest build-snapshot \
	--blueprint=./blueprint.json \
	--outfile=wordpress.zip
```

Keep the source Blueprint beside the snapshot so reviewers know how it was
created.

## Take extra care with existing sites

Never apply an untrusted Blueprint to valuable data. Back up first, choose
explicit collision policies, and expect partial changes if execution stops. Use
the [existing-site safety workflow](./apply-to-existing-site) before mounting a
WordPress directory. If a reviewed Blueprint still fails, follow the
[troubleshooting guide](./troubleshooting) before retrying it.
