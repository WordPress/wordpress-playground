/**
 * NOTE: This module should probably become a separate package
 * or be added to an existing separate package like @playground/storage,
 * but while we are iterating on the web app redesign,
 * let's keep this module with the web app.
 */

import { LatestSupportedWordPressVersion } from '@wp-playground/wordpress-builds';
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { type Blueprint } from '@wp-playground/blueprints';
import metadataWorkerUrl from './site-storage-metadata-worker?worker&url';

// NOTE: We are using different storage terms than our query API in order
// to be more explicit about storage medium in the site metadata format.
// The key "browser" doesn't describe what kind of storage,
// and the key ""
export type SiteStorageType = 'temporary' | 'opfs' | 'local-fs';

// TODO: Explore better ways of obtaining site logos
export type SiteLogo = {
	mime: string;
	data: string;
};

// TODO: Move this type to @php-wasm/web
export type PhpExtensionBundle = 'light' | 'kitchen-sink';

// TODO: Create a schema for this as the design matures
interface SiteMetadata {
	id: string;
	name: string;
	logo?: SiteLogo;
	wpVersion: string;
	phpVersion: SupportedPHPVersion;
	phpExtensionBundle: PhpExtensionBundle;

	// TODO: The designs show keeping admin username and password. Why do we want that?

	// TODO: Consider keeping timestamps.
	//       For a user, timestamps might be useful to disambiguate identically-named sites.
	//       For playground, we might choose to sort by most recently used.
	//whenCreated: number;
	//whenLastLoaded: number;

	originalBlueprint?: Blueprint;
}

export interface SiteInfo extends SiteMetadata {
	storage: SiteStorageType;
	slug: string;
}

// TODO: Decide on metadata filename
const SITE_METADATA_FILENAME = 'playground-site-metadata.json';

export async function addSite(siteInfo: SiteInfo) {
	// TODO: Make sure site with given slug doesn't already exist

	if (siteInfo.storage === 'opfs') {
		const newSiteDirName = getDirectoryNameForSite(siteInfo);
		await createTopLevelDirectory(newSiteDirName);

		await writeSiteMetadata(siteInfo);
	}
}

async function createTopLevelDirectory(newDirName: string) {
	const root = await navigator.storage.getDirectory();

	let directoryAlreadyExists;
	try {
		await root.getDirectoryHandle(newDirName);
		directoryAlreadyExists = true;
	} catch (e) {
		directoryAlreadyExists = false;
	}

	if (directoryAlreadyExists) {
		throw new Error(`Directory already exists: '${newDirName}'.`);
	}

	await root.getDirectoryHandle(newDirName, { create: true });
}

export async function removeSite(site: SiteInfo) {
	const opfsRoot = await navigator.storage.getDirectory();
	const siteDirectoryName = getDirectoryNameForSite(site);
	await opfsRoot.removeEntry(siteDirectoryName, { recursive: true });
}

function looksLikeSiteDirectory(name: string) {
	return name === 'wordpress' || name.startsWith('site-');
}

function getDirectoryNameForSite(site: SiteInfo) {
	const { slug } = site;
	return slug === 'wordpress' ? slug : `site-${slug}`;
}

function getSlugFromDirectoryName(dirName: string) {
	if (dirName === 'wordpress') {
		return dirName;
	}

	return looksLikeSiteDirectory(dirName)
		? dirName.substring('site-'.length)
		: undefined;
}

function getFallbackSiteNameFromSlug(slug: string) {
	return (
		slug
			.replaceAll('-', ' ')
			/* capital P dangit */
			.replace(/wordpress/i, 'WordPress')
			.replaceAll(/\b\w/g, (s) => s.toUpperCase())
	);
}

export async function listSites(): Promise<SiteInfo[]> {
	const opfsRoot = await navigator.storage.getDirectory();
	const opfsSites: SiteInfo[] = [];
	for await (const entry of opfsRoot.values()) {
		if (entry.kind !== 'directory') {
			continue;
		}

		// To give us flexibility for the future,
		// let's not assume all top-level OPFS dirs are sites.
		if (!looksLikeSiteDirectory(entry.name)) {
			continue;
		}

		const site = await readSiteFromDirectory(entry);
		if (site) {
			opfsSites.push(site);
		}
	}
	return opfsSites;
}

export async function readSiteFromDirectory(
	dir: FileSystemDirectoryHandle
): Promise<SiteInfo | undefined> {
	const slug = getSlugFromDirectoryName(dir.name);
	if (slug === undefined) {
		// TODO: Warn
		return undefined;
	}

	try {
		const metadataFileHandle = await dir.getFileHandle(
			SITE_METADATA_FILENAME
		);
		const file = await metadataFileHandle.getFile();
		const metadataContents = await file.text();

		// TODO: Read metadata file and parse and validate via JSON schema
		// TODO: Backfill site info file if missing, detecting actual WP version if possible
		const metadata = JSON.parse(metadataContents) as SiteMetadata;

		return {
			storage: 'opfs',
			slug,
			...metadata,
		};
	} catch (e: any) {
		if (e?.name === 'NotFoundError') {
			// TODO: Warn
			return deriveDefaultSite(slug);
		} else if (e?.name === 'SyntaxError') {
			// TODO: Warn
			return deriveDefaultSite(slug);
		} else {
			throw e;
		}
	}
}

function deriveDefaultSite(slug: string): SiteInfo {
	return {
		id: crypto.randomUUID(),
		slug,
		name: getFallbackSiteNameFromSlug(slug),
		storage: 'opfs',
		// TODO: Backfill site info file if missing, detecting actual WP version if possible
		wpVersion: LatestSupportedWordPressVersion,
		phpVersion: LatestSupportedPHPVersion,
		phpExtensionBundle: 'kitchen-sink',
	};
}

export async function writeSiteMetadata(site: SiteInfo) {
	const metadata = getSiteMetadataFromSiteInfo(site);
	const metadataJson = JSON.stringify(metadata, undefined, '  ');
	const siteDirName = getDirectoryNameForSite(site);
	await writeOpfsContent(
		`/${siteDirName}/${SITE_METADATA_FILENAME}`,
		metadataJson
	);
}

function writeOpfsContent(path: string, content: string): Promise<void> {
	const worker = new Worker(metadataWorkerUrl, { type: 'module' });

	const promiseToWrite = new Promise<void>((resolve, reject) => {
		worker.onmessage = function (event: MessageEvent) {
			if (event.data === 'ready') {
				worker.postMessage({ path, content });
			} else if (event.data === 'done') {
				resolve();
			}
		};
		worker.onerror = reject;
	});
	const promiseToTimeout = new Promise<void>((resolve, reject) => {
		setTimeout(() => reject(new Error('timeout')), 5000);
	});

	return Promise.race<void>([promiseToWrite, promiseToTimeout]).finally(() =>
		worker.terminate()
	);
}

function getSiteMetadataFromSiteInfo(site: SiteInfo): SiteMetadata {
	const metadata: SiteMetadata = {
		id: site.id,
		name: site.name,
		wpVersion: site.wpVersion,
		phpVersion: site.phpVersion,
		phpExtensionBundle: site.phpExtensionBundle,
	};

	if (site.logo !== undefined) {
		metadata.logo = site.logo;
	}
	if (site.originalBlueprint !== undefined) {
		metadata.originalBlueprint = site.originalBlueprint;
	}

	return metadata;
}
