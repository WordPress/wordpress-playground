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

export type SiteInfo = {
	storage: SiteStorageType;
	id: string;
	// TODO: Should we have both `id` and `slug`? UUIDs can help avoid conflicts when sharing sites, but slugs are more readable.
	// Maybe slugs should be a local dir concept, and IDs should be included in site metadata as an actual global identifier.
	// TODO: Make slug a local dir concept and do not store in site metadata file.
	slug: string;
	name: string;
	logo?: SiteLogo;
	wpVersion: string;
	phpVersion: SupportedPHPVersion;
	phpExtensionBundle: PhpExtensionBundle;

	// TODO: The designs show keeping admin username and password. Do we want that?

	// TODO: Consider keeping timestamps.
	//       For a user, timestamps might be useful to disambiguate identically-named sites.
	//       For playground, we might choose to sort by most recently used.
	//whenCreated: number;
	//whenLastLoaded: number;

	originalBlueprint?: Blueprint;
};

// TODO: Decide on metadata filename
const SITE_METADATA_FILENAME = 'playground-site-metadata.json';

export async function addSite(slug: string, siteInfo: SiteInfo) {
	// TODO: Make sure site with given slug doesn't already exist
	writeSiteMetadata(slug, siteInfo);
}

export async function removeSite(slug: string) {
	const opfsRoot = await navigator.storage.getDirectory();
	const siteDirectoryName = getDirectoryNameFromSlug(slug);
	opfsRoot.removeEntry(siteDirectoryName, { recursive: true });
}

function looksLikeSiteDirectoryName(name: string) {
	return name === 'wordpress' || name.startsWith('site-');
}

function getDirectoryNameFromSlug(slug: string) {
	return slug === 'wordpress' ? slug : `site-${slug}`;
}

function getSlugFromDirectoryName(dirName: string) {
	if (dirName === 'wordpress') {
		return dirName;
	}

	return looksLikeSiteDirectoryName(dirName)
		? dirName.substring('site-'.length)
		: undefined;
}

function getSiteNameFromSlug(slug: string) {
	return slug === 'wordpress'
		? 'WordPress' /* capital P dangit */
		: slug.charAt(0).toUpperCase() + slug.slice(1);
}

export async function listSites(): Promise<SiteInfo[]> {
	const opfsRoot = await navigator.storage.getDirectory();
	const opfsSites: SiteInfo[] = [];
	for await (const entry of opfsRoot.values()) {
		if (entry.kind !== 'directory') {
			continue;
		}

		// To give us flexibility for the future,
		// let's avoid assuming all top-level OPFS dirs are sites
		if (!looksLikeSiteDirectoryName(entry.name)) {
			continue;
		}

		/**
		 * Sites stored in browser storage are prefixed with "site-"
		 * so we need to remove the prefix to get the slug.
		 *
		 * The default site is stored in the `wordpress` directory
		 * and it doesn't have a prefix.
		 */
		const slug = getSlugFromDirectoryName(entry.name);
		if (slug === undefined) {
			// TODO: Warn
			continue;
		}

		const name = getSiteNameFromSlug(slug);

		// TODO: Backfill site info file if missing, detecting actual WP version if possible
		// TODO: Read site info file
		opfsSites.push({
			id: crypto.randomUUID(),
			slug,
			name,
			storage: 'opfs',
			wpVersion: LatestSupportedWordPressVersion,
			phpVersion: LatestSupportedPHPVersion,
			phpExtensionBundle: 'kitchen-sink',
		});
	}
	return opfsSites;
}

export async function readSiteMetadata(slug: string): Promise<SiteInfo> {
	const opfsRoot = await navigator.storage.getDirectory();
	const siteDirHandle = await opfsRoot.getDirectoryHandle(`site-${slug}`);
	const metadataFileHandle = await siteDirHandle.getFileHandle(
		SITE_METADATA_FILENAME
	);

	const file = await metadataFileHandle.getFile();
	const metadataContents = await file.text();

	// TODO: Read metadata file and parse and validate via JSON schema
	return JSON.parse(metadataContents) as SiteInfo;
}

export async function writeSiteMetadata(slug: string, siteInfo: SiteInfo) {
	const metadataJson = JSON.stringify(siteInfo, undefined, '  ');

	const opfsRoot = await navigator.storage.getDirectory();
	const siteDirHandle = await opfsRoot.getDirectoryHandle(`site-${slug}`);
	const metadataFileHandle = await siteDirHandle.getFileHandle(
		SITE_METADATA_FILENAME,
		{ create: true }
	);
	const metadataWritable = await metadataFileHandle.createWritable();
	await metadataWritable.truncate(0);
	await metadataWritable.write(metadataJson);
}
