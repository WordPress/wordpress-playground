---
sidebar_position: 6
title: সাইটস API (Sites API)
slug: /developers/apis/sites-api
description: JavaScript থেকে প্লেগ্রাউন্ড সাইট পরিচালনা করুন — playground.wordpress.net-এ ওয়ার্ডপ্রেস ইনস্ট্যান্সগুলোর তালিকা তৈরি, সাইট তৈরি, সংরক্ষণ, পরিবর্তন এবং কনফিগার করুন।
---

<!--
# Sites API
-->

# সাইটস API (Sites API) {#sites-api}

<!--
The Sites API is a JavaScript API exposed by [playground.wordpress.net](https://playground.wordpress.net). It manages the WordPress sites shown in the Dock's **Playgrounds** pane: recent autosaves, permanently stored browser Playgrounds, local-directory Playgrounds, and temporary Playgrounds.
-->

সাইটস API (Sites API) হলো [playground.wordpress.net](https://playground.wordpress.net) কর্তৃক উন্মুক্ত একটি JavaScript API। এটি ডক (Dock)-এর **Playgrounds** প্যানে প্রদর্শিত ওয়ার্ডপ্রেস সাইটগুলো পরিচালনা করে: সাম্প্রতিক অটোসেভ (autosave), ব্রাউজারে স্থায়ীভাবে সংরক্ষিত প্লেগ্রাউন্ড, লোকাল ডিরেক্টরি প্লেগ্রাউন্ড এবং অস্থায়ী প্লেগ্রাউন্ড।

<!--
The API is reached through the `window.playgroundSites` global. `window.playgroundSites` is not assigned during the first moments of page load. Wait for it to appear, then call [`isReady()`](#isready) before making API calls that need the active Playground client.
-->

এই API-টি গ্লোবাল `window.playgroundSites`-এর মাধ্যমে ব্যবহার করা যায়। পেজ লোডের প্রথম মুহূর্তগুলোতে `window.playgroundSites` অ্যাসাইন করা থাকে না। এটি উপস্থিত হওয়া পর্যন্ত অপেক্ষা করুন, তারপর সক্রিয় প্লেগ্রাউন্ড ক্লায়েন্টের প্রয়োজন এমন API কল করার আগে [`isReady()`](#isready) কল করুন।

<div class="callout callout-info">

<!--
The Sites API ships with the Playground website application, not with the `@wp-playground/client` library. It is exposed on the top-level page (`/`), not on `/remote.html`. If you embed Playground via `startPlaygroundWeb` into your own page, your iframe won't expose `window.playgroundSites` to the parent — use the [JavaScript API](/developers/apis/javascript-api/) for direct control instead.
-->

সাইটস API প্লেগ্রাউন্ড ওয়েবসাইট অ্যাপ্লিকেশনের সাথে আসে, `@wp-playground/client` লাইব্রেরির সাথে নয়। এটি শীর্ষ-স্তরের পৃষ্ঠায় (`/`) উন্মুক্ত থাকে, `/remote.html`-এ নয়। আপনি যদি `startPlaygroundWeb`-এর মাধ্যমে প্লেগ্রাউন্ড আপনার নিজস্ব পেজে এম্বেড করেন, তবে আপনার আইফ্রেম (iframe) প্যারেন্ট পেজে `window.playgroundSites` প্রকাশ করবে না — সরাসরি নিয়ন্ত্রণের জন্য এর পরিবর্তে [JavaScript API](/developers/apis/javascript-api/) ব্যবহার করুন।

</div>

<!--
## Quick start
-->

## দ্রুত শুরু (Quick start) {#quick-start}

<!--
Open [playground.wordpress.net](https://playground.wordpress.net), wait for WordPress to load, then run this in DevTools:
-->

[playground.wordpress.net](https://playground.wordpress.net) খুলুন, ওয়ার্ডপ্রেস লোড হওয়া পর্যন্ত অপেক্ষা করুন, তারপর DevTools-এ এটি চালান:

```javascript
await playgroundSites.isReady();

playgroundSites.list();
// → [{ slug: 'calm-sunny-park', name: 'Calm Sunny Park', storage: 'opfs', persistence: 'autosave', isActive: true }]

await playgroundSites.keep(undefined, 'My demo site');
// The active autosave is now a permanently saved browser Playground.

const client = playgroundSites.getClient();
await client.listFiles('/wordpress');
```

<!--
A fresh visit normally creates an autosaved browser Playground when browser storage and saving are available. Use `?storage=temp` or [`createNewTemporarySite()`](#createnewtemporarysiteslug-settings) when you need a Playground that is discarded on page refresh or tab close.
-->

ব্রাউজার স্টোরেজ এবং সেভিং উপলভ্য থাকলে একটি নতুন ভিজিট সাধারণত একটি অটোসেভ করা ব্রাউজার প্লেগ্রাউন্ড তৈরি করে। পেজ রিফ্রেশ বা ট্যাব বন্ধ করার সাথে সাথে অপসারিত হবে এমন একটি প্লেগ্রাউন্ডের প্রয়োজন হলে `?storage=temp` অথবা [`createNewTemporarySite()`](#createnewtemporarysiteslug-settings) ব্যবহার করুন।

<!--
## Storage and persistence
-->

## স্টোরেজ এবং পারসিস্টেন্স (Storage and persistence) {#storage-and-persistence}

<!--
Every site has a storage backend. Stored sites also have a persistence lifecycle.
-->

প্রতিটি সাইটের একটি স্টোরেজ ব্যাকএন্ড থাকে। সংরক্ষিত সাইটগুলোর একটি পারসিস্টেন্স লাইফসাইকেলও থাকে।

| ক্ষেত্র (Field) | মান (Value) | অর্থ (Meaning) |
| --- | --- | --- |
| `storage` | `temporary` | শুধুমাত্র মেমরিতে সংরক্ষিত (In-memory only)। ব্রাউজার রিফ্রেশ বা ট্যাব বন্ধ করলে এটি অপসারিত হয়। |
| `storage` | `opfs` | ব্রাউজারের Origin Private File System-এ সংরক্ষিত। |
| `storage` | `local-fs` | File System Access API-এর মাধ্যমে একটি লোকাল ডিরেক্টরিতে সংরক্ষিত। |
| `persistence` | `autosave` | একটি সংরক্ষিত রিকভারি পয়েন্ট। প্লেগ্রাউন্ড সাম্প্রতিক পাঁচটি অটোসেভ সংরক্ষণ করে রাখে। |
| `persistence` | `explicit` | একটি স্থায়ীভাবে সংরক্ষিত প্লেগ্রাউন্ড যা ব্যবহারকারী বা API মুছে না ফেলা পর্যন্ত থাকে। |

<!--
Temporary Playgrounds do not report `persistence` because there is no stored lifecycle to preserve.
-->

অস্থায়ী প্লেগ্রাউন্ডসমূহ `persistence` রিপোর্ট করে না কারণ সেখানে সংরক্ষণ করার মতো কোনো স্টোরেজ লাইফসাইকেল নেই।

<!--
## Creating and switching sites
-->

## সাইট তৈরি এবং পরিবর্তন করা (Creating and switching sites) {#creating-and-switching-sites}

<!--
### `createNewTemporarySite(slug?, settings?)`
-->

### `createNewTemporarySite(slug?, settings?)` {#createnewtemporarysiteslug-settings}

<!--
Creates a new temporary site and switches to it. Resolves with the new site's slug once it has booted.
-->

একটি নতুন অস্থায়ী সাইট তৈরি করে এবং সেটিতে স্যুইচ করে। সাইটটি বুট সম্পন্ন হলে নতুন সাইটের স্লাগ (slug) প্রদান করে সমাধান (resolve) হয়।

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

<!--
Each setting corresponds to an equivalent [Query API](/developers/apis/query-api) parameter of the same name, with `phpVersion` mapped to `php` and `wpVersion` mapped to `wp`. Other Query API options like `plugin`, `theme`, or `blueprint-url` are not accepted here.
-->

প্রতিটি সেটিং একই নামের একটি সমতুল্য [Query API](/developers/apis/query-api) প্যারামিটারের সাথে সম্পর্কিত, যেখানে `phpVersion` মানচিত্রিত (mapped) হয় `php`-এর সাথে এবং `wpVersion` মানচিত্রিত হয় `wp`-এর সাথে। `plugin`, `theme`, বা `blueprint-url`-এর মতো অন্যান্য Query API অপশন এখানে গৃহীত হয় না।

<!--
### `createNewSavedSite(slug?, settings?, options?)`
-->

### `createNewSavedSite(slug?, settings?, options?)` {#createnewsavedsiteslug-settings-options}

<!--
Creates a new browser-stored site and switches to it. The site starts as an explicit save unless `options.persistence` is `autosave`.
-->

ব্রাউজারে সংরক্ষিত একটি নতুন সাইট তৈরি করে এবং সেটিতে স্যুইচ করে। `options.persistence` যদি `autosave` না হয়, তবে সাইটটি একটি স্পষ্ট সংরক্ষণ (explicit save) হিসেবে শুরু হয়।

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

<!--
Autosaved sites created through this method participate in the same last-five autosave pruning as autosaves created by the UI.
-->

এই পদ্ধতির মাধ্যমে তৈরি করা অটোসেভ সাইটগুলো UI দ্বারা তৈরি অটোসেভের মতো একই সাম্প্রতিক-পাঁচটি অটোসেভ ছাঁটাই (pruning) প্রক্রিয়ায় অংশ নেয়।

<!--
### `setActiveSite(slug, options?)`
-->

### `setActiveSite(slug, options?)` {#setactivesiteslug-options}

<!--
Switches to a different site and boots it. Resolves when the site is ready or rejects if it fails to boot. Resolves immediately if the site is already active.
-->

একটি ভিন্ন সাইটে স্যুইচ করে এবং এটি বুট করে। সাইটটি প্রস্তুত হলে সমাধান (resolve) হয় অথবা বুট করতে ব্যর্থ হলে প্রত্যাখ্যান (reject) করে। সাইটটি ইতিমধ্যে সক্রিয় থাকলে সাথে সাথেই সম্পন্ন হয়।

```typescript
setActiveSite(
	siteSlug: string,
	options?: { updateUrl?: boolean }
): Promise<void>;
```

<!--
## Reading site state
-->

## সাইটের অবস্থা পড়া (Reading site state) {#reading-site-state}

<!--
### `list()`
-->

### `list()` {#list}

<!--
Returns every known site, including the active one.
-->

সক্রিয় সাইট সহ প্রতিটি পরিচিত সাইট রিটার্ন করে।

```typescript
list(): Array<{
	slug: string;
	name: string;
	storage: 'temporary' | 'opfs' | 'local-fs';
	persistence?: 'autosave' | 'explicit';
	isActive: boolean;
}>;
```

<!--
### `getClient()`
-->

### `getClient()` {#getclient}

<!--
Returns the [`PlaygroundClient`](/developers/apis/javascript-api/playground-api-client) for the active site, or `undefined` if the site exists but has not finished booting yet. Throws if no site is selected at all, which only happens very early in page load.
-->

সক্রিয় সাইটের জন্য [`PlaygroundClient`](/developers/apis/javascript-api/playground-api-client) রিটার্ন করে, অথবা সাইটটি বিদ্যমান কিন্তু এখনও বুট হওয়া শেষ না হলে `undefined` রিটার্ন করে। কোনো সাইট একেবারেই নির্বাচিত না থাকলে এটি এরর থ্রো করে, যা সাধারণত পেজ লোডের একেবারে প্রাথমিক পর্যায়ে ঘটে।

```typescript
getClient(): PlaygroundClient | undefined;
```

<!--
### `isReady()`
-->

### `isReady()` {#isready}

<!--
Resolves once the active site is fully booted and its `PlaygroundClient` is ready for API calls. Rejects if the site fails to boot.
-->

সক্রিয় সাইটটি সম্পূর্ণরূপে বুট সম্পন্ন হলে এবং এর `PlaygroundClient` API কলের জন্য প্রস্তুত হলে এটি সমাধান (resolve) হয়। সাইটটি বুট করতে ব্যর্থ হলে প্রত্যাখ্যান (reject) করে।

<!--
For scripts that run before the page has finished loading, wait for `window.playgroundSites` to appear first:
-->

পেজ লোড শেষ হওয়ার আগে চালিত স্ক্রিপ্টগুলোর ক্ষেত্রে, প্রথমে `window.playgroundSites` উপস্থিত হওয়ার জন্য অপেক্ষা করুন:

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

<!--
## Persisting and keeping sites
-->

## সাইট স্থায়ী করা এবং সংরক্ষণ করা (Persisting and keeping sites) {#persisting-and-keeping-sites}

<!--
These methods are safe to call on already-stored sites unless noted otherwise.
-->

অন্যভাবে উল্লেখ না থাকলে এই মেথডগুলো ইতিমধ্যে সংরক্ষিত সাইটগুলোতে কল করা সম্পূর্ণ নিরাপদ।

<!--
### `autosaveTemporarySite(slug?, options?)`
-->

### `autosaveTemporarySite(slug?, options?)` {#autosavetemporarysiteslug-options}

<!--
Persists a temporary Playground into browser storage as an autosave. It returns the site's slug and storage backend. If the site is already stored, it returns the current storage without copying files.
-->

একটি অস্থায়ী প্লেগ্রাউন্ডকে অটোসেভ হিসেবে ব্রাউজার স্টোরেজে সংরক্ষণ করে। এটি সাইটের স্লাগ এবং স্টোরেজ ব্যাকএন্ড প্রদান করে। সাইটটি ইতিমধ্যে সংরক্ষিত থাকলে ফাইল অনুলিপি (copy) না করেই বর্তমান স্টোরেজ প্রদান করে।

```typescript
autosaveTemporarySite(
	slug?: string,
	options?: {
		updateUrl?: boolean;
		excludeFromPruning?: string[];
	}
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

<!--
### `keep(slug?, name?)`
-->

### `keep(slug?, name?)` {#keepslug-name}

<!--
Marks an autosaved Playground as an explicit saved Playground. This changes lifecycle metadata only. It does not copy files, change storage backends, or reboot the site.
-->

একটি অটোসেভ করা প্লেগ্রাউন্ডকে একটি স্পষ্ট সংরক্ষিত (explicit saved) প্লেগ্রাউন্ড হিসেবে চিহ্নিত করে। এটি শুধুমাত্র লাইফসাইকেল মেটাডেটা পরিবর্তন করে। এটি কোনো ফাইল অনুলিপি করে না, স্টোরেজ ব্যাকএন্ড পরিবর্তন করে না কিংবা সাইটকে রিবুট করে না।

```typescript
keep(slug?: string, name?: string): Promise<void>;
```

<!--
### `saveInBrowser(name?)`
-->

### `saveInBrowser(name?)` {#saveinbrowsername}

<!--
Persists the active temporary site to OPFS. When called on an autosaved site, it keeps that site as an explicit saved Playground.
-->

সক্রিয় অস্থায়ী সাইটটিকে OPFS-এ সংরক্ষণ করে। অটোসেভ করা কোনো সাইটে এটি কল করা হলে, এটি সেই সাইটটিকে একটি স্পষ্ট সংরক্ষিত প্লেগ্রাউন্ড হিসেবে রেখে দেয়।

```typescript
saveInBrowser(
	name?: string
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

<!--
### `saveToLocalFileSystem(name?, localFsHandle?)`
-->

### `saveToLocalFileSystem(name?, localFsHandle?)` {#savetolocalfilesystemname-localfshandle}

<!--
Persists the active temporary or autosaved site to a local directory. Prompts the user to pick a directory when `localFsHandle` is omitted. Requires the File System Access API, so availability depends on the browser and platform.
-->

সক্রিয় অস্থায়ী বা অটোসেভ করা সাইটটিকে একটি লোকাল ডিরেক্টরিতে সংরক্ষণ করে। `localFsHandle` উল্লেখ না থাকলে ব্যবহারকারীকে একটি ডিরেক্টরি বেছে নেওয়ার প্রম্পট দেখায়। এর জন্য File System Access API প্রয়োজন, তাই এর প্রাপ্যতা ব্রাউজার এবং প্ল্যাটফর্মের ওপর নির্ভর করে।

```typescript
saveToLocalFileSystem(
	name?: string,
	localFsHandle?: FileSystemDirectoryHandle
): Promise<{ slug: string; storage: 'opfs' | 'local-fs' }>;
```

<!--
## Modifying a stored site
-->

## সংরক্ষিত সাইট সংশোধন করা (Modifying a stored site) {#modifying-a-stored-site}

<!--
These methods throw when called on a temporary site.
-->

কোনো অস্থায়ী সাইটে কল করা হলে এই মেথডগুলো এরর থ্রো করে।

<!--
### `rename(newName, slug?)`
-->

### `rename(newName, slug?)` {#renamenewname-slug}

<!--
Renames the active site, or the site identified by `slug`.
-->

সক্রিয় সাইট, অথবা `slug` দ্বারা নির্দিষ্ট সাইটের নাম পরিবর্তন করে।

```typescript
rename(newName: string, slug?: string): Promise<void>;
```

<!--
### `setPhpVersion(version)`
-->

### `setPhpVersion(version)` {#setphpversionversion}

<!--
Changes the PHP version of the active stored site and reboots it. To pick a PHP version for a fresh site, pass `phpVersion` to `createNewTemporarySite()` or `createNewSavedSite()` instead.
-->

সক্রিয় সংরক্ষিত সাইটের PHP সংস্করণ পরিবর্তন করে এবং সাইটটিকে রিবুট করে। একটি নতুন সাইটের জন্য PHP সংস্করণ বেছে নিতে, এর পরিবর্তে `createNewTemporarySite()` বা `createNewSavedSite()`-এ `phpVersion` পাস করুন।

```typescript
setPhpVersion(version: string): Promise<void>;
```

<!--
`version` accepts any value from the [`AllPHPVersion`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts) union. The supported list evolves as PHP releases come and go — see the linked source for the current set.
-->

`version` প্যারামিটারটি [`AllPHPVersion`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/universal/src/lib/supported-php-versions.ts) ইউনিয়ন থেকে যেকোনো মান গ্রহণ করে। নতুন PHP সংস্করণ প্রকাশের সাথে সাথে সমর্থিত তালিকা পরিবর্তিত হয় — বর্তমান তালিকার জন্য সংযুক্ত সোর্স কোডটি দেখুন।

<!--
### `setNetworking(enabled)`
-->

### `setNetworking(enabled)` {#setnetworkingenabled}

<!--
Enables or disables outbound network access for the active stored site and reboots it.
-->

সক্রিয় সংরক্ষিত সাইটের জন্য আউটবাউন্ড (আউটগোয়িং) নেটওয়ার্ক অ্যাক্সেস সক্রিয় বা নিষ্ক্রিয় করে এবং সাইটটিকে রিবুট করে।

```typescript
setNetworking(enabled: boolean): Promise<void>;
```

<!--
### `updateRuntimeSettings(settings)`
-->

### `updateRuntimeSettings(settings)` {#updateruntimesettingssettings}

<!--
Applies the runtime settings that can change on an existing stored Playground: PHP version and networking. If the settings already match, Playground reloads the current WordPress page.
-->

বিদ্যমান সংরক্ষিত প্লেগ্রাউন্ডে পরিবর্তনযোগ্য রানটাইম সেটিংস প্রয়োগ করে: PHP সংস্করণ এবং নেটওয়ার্কিং। সেটিংস ইতিমধ্যে মিলে গেলে, প্লেগ্রাউন্ড বর্তমান ওয়ার্ডপ্রেস পেজটি রিলোড করে।

```typescript
updateRuntimeSettings(settings: {
	phpVersion: string;
	networking: boolean;
}): Promise<void>;
```

<!--
WordPress version, language, and multisite are installation settings. Create a fresh Playground when those need to change.
-->

ওয়ার্ডপ্রেস সংস্করণ, ভাষা এবং মাল্টিসাইট হলো ইনস্টলেশন সেটিংস। এগুলো পরিবর্তনের প্রয়োজন হলে একটি নতুন প্লেগ্রাউন্ড তৈরি করুন।

<!--
### `delete(slug)`
-->

### `delete(slug)` {#deleteslug}

<!--
Deletes a stored site and its persisted data. Throws if the site does not exist or is temporary.
-->

একটি সংরক্ষিত সাইট এবং এর স্থায়ী ডেটা মুছে ফেলে। সাইটটি বিদ্যমান না থাকলে বা অস্থায়ী হলে এরর থ্রো করে।

```typescript
delete(siteSlug: string): Promise<void>;
```

<!--
## Next steps
-->

## পরবর্তী পদক্ষেপ (Next steps) {#next-steps}

<!--
- [JavaScript API](/developers/apis/javascript-api/playground-api-client) — full reference for the `PlaygroundClient` returned by `getClient()`
- [Query API](/developers/apis/query-api) — the URL parameters that mirror new-site settings
- [Blueprints](/blueprints) — declarative site setup that runs when a site is created
-->

- [JavaScript API](/developers/apis/javascript-api/playground-api-client) — `getClient()` কর্তৃক প্রদত্ত `PlaygroundClient`-এর সম্পূর্ণ রেফারেন্স
- [Query API](/developers/apis/query-api) — নতুন সাইটের সেটিংস প্রতিফলিতকারী URL প্যারামিটারসমূহ
- [Blueprints](/blueprints) — বর্ণনামূলক সাইট সেটআপ যা সাইট তৈরির সময় কার্যকর হয়
