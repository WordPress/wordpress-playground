---
title: Sites API
slug: /developers/apis/sites-api
description: Manage Playground sites from JavaScript — list, create, persist, switch, and configure the saved WordPress instances on playground.wordpress.net.
---

The Sites API is a JavaScript API exposed by [playground.wordpress.net](https://playground.wordpress.net) for managing the saved WordPress sites in the site manager sidebar. Use it to list and switch between sites, spin up a new temporary site with a specific PHP or WordPress version, persist a temporary site to OPFS or the local filesystem, or change PHP version and networking on a saved site.

The API is reached via the `window.playgroundSites` global. Note that `window.playgroundSites` is not assigned during initial page load — wait for it to appear, then call [`isReady()`](#isready) before making any API calls.

<div class="callout callout-info">

The Sites API ships with the Playground website application, not with the `@wp-playground/client` library. It is exposed on the top-level page (`/`), not on `/remote.html`. If you embed Playground via `startPlaygroundWeb` into your own page, your iframe won't expose `window.playgroundSites` to the parent — use the [JavaScript API](/developers/apis/javascript-api/) for direct control instead.

</div>

## Quick start

Open [playground.wordpress.net](https://playground.wordpress.net), wait for WordPress to load, then in DevTools:

```javascript
playgroundSites.list();
// → [{ slug: 'wordpress', name: 'WordPress', storage: 'temporary', isActive: true }]

await playgroundSites.saveInBrowser('My demo site');
// → { slug: 'wordpress', storage: 'opfs' }

await playgroundSites.rename('Renamed via API');

const client = playgroundSites.getClient();
await client.listFiles('/wordpress');
```

## Storage types

Every site has one of three storage backends:

| Storage     | Description                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `temporary` | In-memory only. Resets on the next page load. This is the default for a fresh visit.                   |
| `opfs`      | Persisted to the browser's Origin Private File System. Survives reloads on the same origin.            |
| `local-fs`  | Persisted to a directory on the user's local filesystem via the File System Access API. Chromium only. |

## Creating and switching sites

### `createNewTemporarySite(slug?, settings?)`

Creates a new in-memory site and switches to it. Resolves with the new site's slug once it has booted.

```typescript
createNewTemporarySite(
	slug?: string,
	settings?: {
		phpVersion?: string;   // e.g. '8.4'
		wpVersion?: string;    // e.g. '6.8', 'latest', 'nightly', 'beta'
		networking?: boolean;
		language?: string;     // e.g. 'pl_PL'
		multisite?: boolean;
	}
): Promise<string>;
```

Each setting corresponds to an equivalent [Query API](/developers/apis/query-api) parameter of the same name (with `phpVersion` → `php` and `wpVersion` → `wp`). Other Query API options like `plugin`, `theme`, or `blueprint-url` aren't accepted here.

### `setActiveSite(slug)`

Switches to a different site and boots it. Resolves when the site is ready or rejects if it fails to boot. Resolves immediately if the site is already active.

```typescript
setActiveSite(siteSlug: string): Promise<void>;
```

## Reading site state

### `list()`

Returns every known site, including the currently active one.

```typescript
list(): Array<{
	slug: string;
	name: string;
	storage: 'temporary' | 'opfs' | 'local-fs';
	isActive: boolean;
}>;
```

### `getClient()`

Returns the [`PlaygroundClient`](/developers/apis/javascript-api/playground-api-client) for the active site, or `undefined` if the site exists but hasn't finished booting yet. Throws if no site is selected at all (only happens very early in page load).

```typescript
getClient(): PlaygroundClient | undefined;
```

### `isReady()`

Resolves once the active site is fully booted and its `PlaygroundClient` is ready for API calls — mirroring the [`isReady()` method](/developers/apis/javascript-api/playground-api-client) on the client itself. Rejects if the site fails to boot.

For scripts that run before the page has finished loading, wait for `window.playgroundSites` to appear first:

```javascript
await new Promise((resolve) => {
	const id = setInterval(() => {
		if (window.playgroundSites) {
			clearInterval(id);
			resolve();
		}
	}, 50);
});
await window.playgroundSites.isReady();
```

```typescript
isReady(): Promise<void>;
```

## Persisting a temporary site

Both methods are safe to call on an already-saved site — they return the site's current `{ slug, storage }` without re-persisting it.

### `saveInBrowser(name?)`

Persists the active temporary site to OPFS.

```typescript
saveInBrowser(
	name?: string
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

### `saveToLocalFileSystem(name?, localFsHandle?)`

Persists the active temporary site to a directory on disk. Prompts the user to pick a directory when `localFsHandle` is omitted. Requires the File System Access API (Chromium only).

```typescript
saveToLocalFileSystem(
	name?: string,
	localFsHandle?: FileSystemDirectoryHandle
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

## Modifying a saved site

These methods throw when called on a temporary site — save it first.

### `rename(newName)`

Renames the active site.

```typescript
rename(newName: string): Promise<void>;
```

### `setPhpVersion(version)`

Changes the PHP version of the active site and reboots it. To pick a PHP version for a fresh site, use `createNewTemporarySite('slug', { phpVersion: '8.4' })` instead.

```typescript
setPhpVersion(version: string): Promise<void>;
```

`version` accepts any value from the [`AllPHPVersion`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts) union (currently `'7.4'`, `'8.0'`–`'8.5'`, plus the legacy `'5.2'`). The supported list evolves as PHP releases come and go — see the linked source for the current set.

### `setNetworking(enabled)`

Enables or disables outbound network access (used by WordPress to talk to wordpress.org, install plugins, fetch translations) and reboots the active site.

```typescript
setNetworking(enabled: boolean): Promise<void>;
```

### `delete(slug)`

Deletes a saved site and its persisted data. Throws if the site doesn't exist or is temporary (temporary sites disappear on reload — there's nothing to delete).

```typescript
delete(siteSlug: string): Promise<void>;
```

## Next steps

- [JavaScript API](/developers/apis/javascript-api/playground-api-client) — full reference for the `PlaygroundClient` returned by `getClient()`
- [Query API](/developers/apis/query-api) — the URL parameters that mirror `createNewTemporarySite`'s settings
- [Blueprints](/blueprints) — declarative site setup that runs when a site is created
