---
title: Sites API
slug: /developers/apis/sites-api
description: Manage Playground sites from JavaScript — list, create, persist, switch, and configure the WordPress instances on playground.wordpress.net.
---

The Sites API is a JavaScript API exposed by [playground.wordpress.net](https://playground.wordpress.net). It manages the WordPress sites shown in the Dock's **Playgrounds** pane: recent autosaves, permanently stored browser Playgrounds, local-directory Playgrounds, and temporary Playgrounds.

The API is reached through the `window.playgroundSites` global. `window.playgroundSites` is not assigned during the first moments of page load. Wait for it to appear, then call [`isReady()`](#isready) before making API calls that need the active Playground client.

<div class="callout callout-info">

The Sites API ships with the Playground website application, not with the `@wp-playground/client` library. It is exposed on the top-level page (`/`), not on `/remote.html`. If you embed Playground via `startPlaygroundWeb` into your own page, your iframe won't expose `window.playgroundSites` to the parent — use the [JavaScript API](/developers/apis/javascript-api/) for direct control instead.

</div>

## Quick start

Open [playground.wordpress.net](https://playground.wordpress.net), wait for WordPress to load, then run this in DevTools:

```javascript
await playgroundSites.isReady();

playgroundSites.list();
// → [{ slug: 'calm-sunny-park', name: 'Calm Sunny Park', storage: 'opfs', persistence: 'autosave', isActive: true }]

await playgroundSites.keep(undefined, 'My demo site');
// The active autosave is now a permanently saved browser Playground.

const client = playgroundSites.getClient();
await client.listFiles('/wordpress');
```

A fresh visit normally creates an autosaved browser Playground when browser storage and saving are available. Use `?storage=temp` or [`createNewTemporarySite()`](#createnewtemporarysiteslug-settings) when you need a Playground that is discarded on page refresh or tab close.

## Storage and persistence

Every site has a storage backend. Stored sites also have a persistence lifecycle.

| Field         | Value       | Meaning                                                                   |
| ------------- | ----------- | ------------------------------------------------------------------------- |
| `storage`     | `temporary` | In-memory only. It is discarded on browser refresh or tab close.          |
| `storage`     | `opfs`      | Stored in the browser's Origin Private File System.                       |
| `storage`     | `local-fs`  | Stored in a local directory through the File System Access API.           |
| `persistence` | `autosave`  | A stored recovery point. Playground keeps the five most recent autosaves. |
| `persistence` | `explicit`  | A stored Playground kept permanently until the user or API deletes it.    |

Temporary Playgrounds do not report `persistence` because there is no stored lifecycle to preserve.

## Creating and switching sites

### `createNewTemporarySite(slug?, settings?)`

Creates a new temporary site and switches to it. Resolves with the new site's slug once it has booted.

```typescript
createNewTemporarySite(
	slug?: string,
	settings?: {
		phpVersion?: string; // e.g. '8.4'
		wpVersion?: string; // e.g. '6.8', 'latest', 'nightly', 'beta'
		networking?: boolean;
		language?: string; // e.g. 'pl_PL'
		multisite?: boolean;
	}
): Promise<string>;
```

Each setting corresponds to an equivalent [Query API](/developers/apis/query-api) parameter of the same name, with `phpVersion` mapped to `php` and `wpVersion` mapped to `wp`. Other Query API options like `plugin`, `theme`, or `blueprint-url` are not accepted here.

### `createNewSavedSite(slug?, settings?, options?)`

Creates a new browser-stored site and switches to it. The site starts as an explicit save unless `options.persistence` is `autosave`.

```typescript
createNewSavedSite(
	slug?: string,
	settings?: {
		phpVersion?: string;
		wpVersion?: string;
		networking?: boolean;
		language?: string;
		multisite?: boolean;
	},
	options?: {
		persistence?: 'autosave' | 'explicit';
		updateUrl?: boolean;
		excludeFromPruning?: string[];
	}
): Promise<string>;
```

Autosaved sites created through this method participate in the same last-five autosave pruning as autosaves created by the UI.

### `setActiveSite(slug, options?)`

Switches to a different site and boots it. Resolves when the site is ready or rejects if it fails to boot. Resolves immediately if the site is already active.

```typescript
setActiveSite(
	siteSlug: string,
	options?: { updateUrl?: boolean }
): Promise<void>;
```

## Reading site state

### `list()`

Returns every known site, including the active one.

```typescript
list(): Array<{
	slug: string;
	name: string;
	storage: 'temporary' | 'opfs' | 'local-fs';
	persistence?: 'autosave' | 'explicit';
	isActive: boolean;
}>;
```

### `getClient()`

Returns the [`PlaygroundClient`](/developers/apis/javascript-api/playground-api-client) for the active site, or `undefined` if the site exists but has not finished booting yet. Throws if no site is selected at all, which only happens very early in page load.

```typescript
getClient(): PlaygroundClient | undefined;
```

### `isReady()`

Resolves once the active site is fully booted and its `PlaygroundClient` is ready for API calls. Rejects if the site fails to boot.

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

## Persisting and keeping sites

These methods are safe to call on already-stored sites unless noted otherwise.

### `autosaveTemporarySite(slug?, options?)`

Persists a temporary Playground into browser storage as an autosave. It returns the site's slug and storage backend. If the site is already stored, it returns the current storage without copying files.

```typescript
autosaveTemporarySite(
	slug?: string,
	options?: {
		updateUrl?: boolean;
		excludeFromPruning?: string[];
	}
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

### `keep(slug?, name?)`

Marks an autosaved Playground as an explicit saved Playground. This changes lifecycle metadata only. It does not copy files, change storage backends, or reboot the site.

```typescript
keep(slug?: string, name?: string): Promise<void>;
```

### `saveInBrowser(name?)`

Persists the active temporary site to OPFS. When called on an autosaved site, it keeps that site as an explicit saved Playground.

```typescript
saveInBrowser(
	name?: string
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

### `saveToLocalFileSystem(name?, localFsHandle?)`

Persists the active temporary or autosaved site to a local directory. Prompts the user to pick a directory when `localFsHandle` is omitted. Requires the File System Access API, so availability depends on the browser and platform.

```typescript
saveToLocalFileSystem(
	name?: string,
	localFsHandle?: FileSystemDirectoryHandle
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

## Modifying a stored site

These methods throw when called on a temporary site.

### `rename(newName, slug?)`

Renames the active site, or the site identified by `slug`.

```typescript
rename(newName: string, slug?: string): Promise<void>;
```

### `setPhpVersion(version)`

Changes the PHP version of the active stored site and reboots it. To pick a PHP version for a fresh site, pass `phpVersion` to `createNewTemporarySite()` or `createNewSavedSite()` instead.

```typescript
setPhpVersion(version: string): Promise<void>;
```

`version` accepts any value from the [`AllPHPVersion`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts) union. The supported list evolves as PHP releases come and go — see the linked source for the current set.

### `setNetworking(enabled)`

Enables or disables outbound network access for the active stored site and reboots it.

```typescript
setNetworking(enabled: boolean): Promise<void>;
```

### `updateRuntimeSettings(settings)`

Applies the runtime settings that can change on an existing stored Playground: PHP version and networking. If the settings already match, Playground reloads the current WordPress page.

```typescript
updateRuntimeSettings(settings: {
	phpVersion: string;
	networking: boolean;
}): Promise<void>;
```

WordPress version, language, and multisite are installation settings. Create a fresh Playground when those need to change.

### `delete(slug)`

Deletes a stored site and its persisted data. Throws if the site does not exist or is temporary.

```typescript
delete(siteSlug: string): Promise<void>;
```

## Next steps

- [JavaScript API](/developers/apis/javascript-api/playground-api-client) — full reference for the `PlaygroundClient` returned by `getClient()`
- [Query API](/developers/apis/query-api) — the URL parameters that mirror new-site settings
- [Blueprints](/blueprints) — declarative site setup that runs when a site is created
