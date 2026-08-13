---
title: Troubleshooting
slug: /troubleshooting
description: Diagnose common WordPress Playground website errors, including boot failures, SQLite issues, browser storage, and saved Playground recovery.
---

# Troubleshooting WordPress Playground

This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).

## Playground looks broken

Try these first:

- Use the Playground **Refresh page** button instead of refreshing the browser tab. Browser refresh (Cmd+R or F5) starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a new autosaved Playground. Use `?storage=temp` when you need a truly temporary site.

## A clean site says the MySQL extension is missing

You may see a WordPress error page like this:

```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```

In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.

Try these steps:

- Start a fresh Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new Playground. Add `?storage=temp` only when you need an ephemeral site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).

If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

## Error connecting to the SQLite database

This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.

Common causes:

- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.

Recommended recovery:

1. Start a fresh Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export accessible files from the broken saved site using **Files**, **Export**, or a local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.

## NotAllowedError

`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.

You may see this exact message:

```text
The request is not allowed by the user agent or the platform in the current context.
```

Try:

- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from **Your Playgrounds** in the Dock.
- If the site used a local directory, Playground cannot currently re-select the directory after its saved permission expires. The files remain on disk; use them directly or recreate the Playground from an exported ZIP or Blueprint, if available.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.

## NoModificationAllowedError

`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.

You may see this exact message:

```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```

Try:

- If the Playground still opens, use **Export → Download as .zip** before starting over.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh Playground with `?storage=temp` if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.

## Saved Playground cannot reload

Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.

If a saved Playground cannot reload:

- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh autosaved Playground.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.

## Browser storage and persistence

New Playgrounds are autosaved when browser storage and saving are available. Open **Your Playgrounds** in the Dock to recover recent autosaves or saved Playgrounds. Playground keeps up to five recent autosaves.

Click the **Autosaved** or **Unsaved** status in the Dock to open the storage
choices. Select **Save in browser storage**, or select **Save in a local
directory** and choose a directory dedicated to that Playground before
clicking **Save**. Matching files in the directory may be overwritten. Use
**Export** to download a portable ZIP. A browser refresh can recover a stored
or autosaved Playground, but `?storage=temp` creates a temporary Playground
that is discarded on refresh or tab close.

For longer-running local development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli), which persists site files on disk.

See [the Dock guide](/web-instance) for the current Dock destinations and export workflow.

## When to start fresh

Start a fresh Playground when:

- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.

Use this URL for a clean site:

```text
https://playground.wordpress.net/
```

## Report a Playground issue

If the problem reproduces on a fresh Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:

- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
