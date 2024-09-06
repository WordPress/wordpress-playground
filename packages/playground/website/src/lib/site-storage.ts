/**
 * NOTE: This module should probably become a separate package
 * or be added to an existing separate package like @playground/storage,
 * but while we are iterating on the web app redesign,
 * let's keep this module with the web app.
 */

import { LatestMinifiedWordPressVersion } from '@wp-playground/wordpress-builds';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { compileBlueprint, type Blueprint } from '@wp-playground/blueprints';
import metadataWorkerUrl from './site-storage-metadata-worker?worker&url';
import { resolveBlueprint } from './resolve-blueprint';

// TODO: Decide on metadata filename
const SITE_METADATA_FILENAME = 'playground-site-metadata.json';

/**
 * The supported site storage types.
 *
 * NOTE: We are using different storage terms than our query API in order
 * to be more explicit about storage medium in the site metadata format.
 */
export const SiteStorageTypes = ['opfs', 'local-fs', 'none'] as const;
export type SiteStorageType = (typeof SiteStorageTypes)[number];

/**
 * The site logo data.
 */
export type SiteLogo = {
	mime: string;
	data: string;
};

/**
 * The supported PHP extension bundles.
 */
export type PhpExtensionBundle = 'light' | 'kitchen-sink';

// TODO: Create a schema for this as the design matures
/**
 * The Site metadata that is persisted.
 */
interface SiteMetadata {
	id: string;
	name: string;
	logo?: SiteLogo;

	// TODO: The designs show keeping admin username and password. Why do we want that?
	whenCreated?: number;
	// TODO: Consider keeping timestamps.
	//       For a user, timestamps might be useful to disambiguate identically-named sites.
	//       For playground, we might choose to sort by most recently used.
	//whenLastLoaded: number;

	// @TODO: Accept any string as a php version?
	runtimeConfiguration: Pick<
		Required<Blueprint>,
		| 'features'
		| 'extraLibraries'
		| 'phpExtensionBundles'
		| 'preferredVersions'
	>;
	originalBlueprint: Blueprint;
}

/**
 * The Site model used to represent a site within Playground.
 */
export interface SiteInfo extends SiteMetadata {
	storage: SiteStorageType;
	slug: string;
}

/**
 * The initial information used to create a new site.
 */
export type InitialSiteInfo = Omit<SiteInfo, 'id' | 'slug' | 'whenCreated'>;

/**
 * Generates a random, human readable site name.
 * For example: "Abandoned Road", "Old School", "Greenwich Village" etc.
 */
export function randomSiteName() {
	const adjectives = [
		'Abandoned',
		'Old',
		'Greenwich',
		'Sunny',
		'Quiet',
		'Busy',
		'Noisy',
		'Peaceful',
	];
	const nouns = [
		'Road',
		'School',
		'Village',
		'Town',
		'City',
		'State',
		'Country',
	];
	return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${
		nouns[Math.floor(Math.random() * nouns.length)]
	}`;
}

/**
 * @TODO: Do not generate unique site names. As a user I want the ability to have duplicates.
 */
export function generateUniqueSiteName(defaultName: string, sites: SiteInfo[]) {
	const numberOfSitesStartingWithDefaultName = sites.filter((site) =>
		site.name.startsWith(defaultName)
	).length;
	if (numberOfSitesStartingWithDefaultName === 0) {
		return defaultName;
	}
	return `${defaultName} ${numberOfSitesStartingWithDefaultName}`;
}

/**
 * Create a new site info structure from initial configuration.
 *
 * @param initialInfo The starting configuration for the site.
 * @returns SiteInfo The new site info structure.
 */
export async function createNewSiteInfo(
	initialInfo: Partial<Omit<InitialSiteInfo, 'runtimeConfiguration'>>
): Promise<SiteInfo> {
	const name = initialInfo.name ?? randomSiteName();
	const blueprint: Blueprint =
		initialInfo.originalBlueprint ??
		(await resolveBlueprint(new URL('https://w.org')));

	const compiledBlueprint = compileBlueprint(blueprint);

	return {
		id: crypto.randomUUID(),
		slug: deriveSlugFromSiteName(name),
		whenCreated: Date.now(),
		storage: 'none',

		...initialInfo,

		runtimeConfiguration: {
			preferredVersions: {
				wp: compiledBlueprint.versions.wp,
				php: compiledBlueprint.versions.php,
			},
			phpExtensionBundles: blueprint.phpExtensionBundles || [
				'kitchen-sink',
			],
			features: compiledBlueprint.features,
			extraLibraries: compiledBlueprint.extraLibraries,
		},
		originalBlueprint: blueprint,
		name,
	};
}

/**
 * Adds a new site to the Playground site storage.
 *
 * This function creates a new site directory and writes the site metadata.
 * Currently, only 'opfs' sites are supported.
 *
 * @param initialInfo - The information about the site to be added.
 * @throws {Error} If a site with the given slug already exists.
 * @returns {Promise<SiteInfo>} A promise that resolves when the site is added.
 */
export async function addSite(newSiteInfo: SiteInfo): Promise<SiteInfo> {
	const newSiteDirName = getDirectoryNameForSlug(newSiteInfo.slug);
	await createTopLevelDirectory(newSiteDirName);

	await writeSiteMetadata(newSiteInfo);

	return newSiteInfo;
}

/**
 * Creates a top-level directory with the given name.
 *
 * @param newDirName - The name of the new directory to be created.
 * @throws {Error} If the directory already exists.
 * @returns {Promise<void>} A promise that resolves when the directory is created.
 */
async function createTopLevelDirectory(newDirName: string) {
	const root = await navigator.storage.getDirectory();

	let directoryAlreadyExists;
	try {
		await root.getDirectoryHandle(newDirName);
		directoryAlreadyExists = true;
	} catch (e: any) {
		if (e?.name === 'NotFoundError') {
			directoryAlreadyExists = false;
		} else {
			throw e;
		}
	}

	if (directoryAlreadyExists) {
		throw new Error(`Directory already exists: '${newDirName}'.`);
	}

	await root.getDirectoryHandle(newDirName, { create: true });
}

/**
 * Removes a site from the Playground site storage.
 *
 * This function deletes the directory associated with the given site from OPFS.
 *
 * @param site - The information about the site to be removed.
 * @throws {Error} If the directory cannot be found or removed.
 * @returns {Promise<void>} A promise that resolves when the site is removed.
 */
export async function removeSite(site: SiteInfo) {
	const opfsRoot = await navigator.storage.getDirectory();
	const siteDirectoryName = getDirectoryNameForSlug(site.slug);
	await opfsRoot.removeEntry(siteDirectoryName, { recursive: true });
}

/**
 * List all sites from client storage.
 *
 * @returns {Promise<SiteInfo[]>} A promise for the list of sites from client storage.
 * @throws {Error} If there is an issue accessing the OPFS or reading site information.
 * @returns {Promise<SiteInfo[]>} A promise for a list of SiteInfo objects.
 */
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

export async function getSiteInfoBySlug(
	slug: string
): Promise<SiteInfo | undefined> {
	const opfsRoot = await navigator.storage.getDirectory();
	const siteDirectoryName = getDirectoryNameForSlug(slug);
	const siteDirectory = await opfsRoot.getDirectoryHandle(siteDirectoryName);
	if (!siteDirectory) {
		return undefined;
	}

	return readSiteFromDirectory(siteDirectory);
}

/**
 * Reads information for a single site from a given directory.
 *
 * @param dir - The directory handle from which to read the site information.
 * @returns {Promise<SiteInfo>} A promise for the site information.
 * @throws {Error} If there is an issue accessing the metadata file or parsing its contents.
 */
async function readSiteFromDirectory(
	dir: FileSystemDirectoryHandle
): Promise<SiteInfo> {
	const slug = getSlugFromDirectoryName(dir.name);
	if (slug === undefined) {
		throw new Error(`Invalid site directory name: '${dir.name}'.`);
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

function looksLikeSiteDirectory(name: string) {
	return name === 'wordpress' || name.startsWith('site-');
}

export function getDirectoryNameForSlug(slug: string) {
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

function deriveSlugFromSiteName(name: string) {
	return name.toLowerCase().replaceAll(' ', '-');
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

function deriveDefaultSite(slug: string): SiteInfo {
	const runtimeConfiguration: SiteInfo['runtimeConfiguration'] = {
		preferredVersions: {
			wp: LatestMinifiedWordPressVersion,
			php: LatestSupportedPHPVersion,
		},
		phpExtensionBundles: ['kitchen-sink'],
		features: {},
		extraLibraries: [],
	};
	return {
		id: crypto.randomUUID(),
		slug,
		name: getFallbackSiteNameFromSlug(slug),
		storage: 'opfs',
		// TODO: Backfill site info file if missing, detecting actual WP version if possible
		runtimeConfiguration,
		originalBlueprint: runtimeConfiguration,
	};
}

async function writeSiteMetadata(site: SiteInfo) {
	const metadata = getSiteMetadataFromSiteInfo(site);
	const metadataJson = JSON.stringify(metadata, undefined, '  ');
	const siteDirName = getDirectoryNameForSlug(site.slug);
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
		whenCreated: site.whenCreated,
		runtimeConfiguration: site.runtimeConfiguration,
		originalBlueprint: site.originalBlueprint,
	};

	if (site.logo !== undefined) {
		metadata.logo = site.logo;
	}
	if (site.originalBlueprint !== undefined) {
		metadata.originalBlueprint = site.originalBlueprint;
	}

	return metadata;
}
