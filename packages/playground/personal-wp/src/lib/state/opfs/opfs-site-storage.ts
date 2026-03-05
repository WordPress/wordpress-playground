/**
 * NOTE: This module should probably become a separate package
 * or be added to an existing separate package like @playground/storage,
 * but while we are iterating on the web app redesign,
 * let's keep this module with the web app.
 */

import metadataWorkerUrl from './opfs-site-storage-worker-for-safari?worker&url';
import type { SiteMetadata } from '../redux/slice-sites';
import type { SiteInfo } from '../redux/slice-sites';
import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import {
	type ExtraLibrary,
	type PHPConstants,
	getBlueprintDeclaration,
} from '@wp-playground/blueprints';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadPersistedBlueprintBundle } from './opfs-blueprint-bundle-storage';

const ROOT_PATH = '/sites';
// TODO: Decide on metadata filename
const SITE_METADATA_FILENAME = 'wp-runtime.json';

// Use a symbol to mark legacy site metadata to avoid serializing it to JSON.
// @TODO: Remove this backcompat code after 2024-12-01.
export const legacyOpfsPathSymbol = Symbol('legacyOpfsPath');

/**
 * StoredSiteMetadata is the data structure that is written to disk.
 *
 * It's different from SiteInfo:
 * * It extends SiteMetadata instead of embedding it.
 * * It adds slug to SiteMetadata so we can recover it after a page reload.
 * * It's not concerned with any extra information stored in SiteInfo by the redux store.
 *
 * I'm not yet sure whether that's the right approach. Let's keep going and find out as the
 * design matures.
 */
export interface StoredSiteMetadata extends SiteMetadata {
	slug: string;
}

let opfsSitesRoot: FileSystemDirectoryHandle | undefined = undefined;
try {
	opfsSitesRoot = await navigator.storage.getDirectory();
	for (const path of ROOT_PATH.replace(/^\//, '').split('/')) {
		opfsSitesRoot = await opfsSitesRoot.getDirectoryHandle(path, {
			create: true,
		});
	}
} catch {
	// Ignore. OPFS is not supported in this environment.
}

class OpfsSiteStorage {
	private readonly root: FileSystemDirectoryHandle;
	constructor(root: FileSystemDirectoryHandle) {
		this.root = root;
	}

	async create(slug: string, metadata: SiteMetadata): Promise<void> {
		const newSiteDirName = getDirectoryNameForSlug(slug);
		if (await opfsChildExists(this.root, newSiteDirName)) {
			const dir = await this.root.getDirectoryHandle(newSiteDirName);
			if (await opfsChildExists(dir, SITE_METADATA_FILENAME)) {
				throw new Error(`Site with slug '${slug}' already exists.`);
			}
		}

		await this.root.getDirectoryHandle(newSiteDirName, {
			create: true,
		});
		await opfsWriteFile(
			joinPaths(ROOT_PATH, newSiteDirName, SITE_METADATA_FILENAME),
			await metadataToStoredFormat(slug, metadata)
		);
	}

	async update(slug: string, metadata: SiteMetadata): Promise<void> {
		const newSiteDirName = getDirectoryNameForSlug(slug);
		if (!(await opfsChildExists(this.root, newSiteDirName))) {
			throw new Error(`Site with slug '${slug}' does not exist.`);
		}

		await opfsWriteFile(
			joinPaths(ROOT_PATH, newSiteDirName, SITE_METADATA_FILENAME),
			await metadataToStoredFormat(slug, metadata)
		);
	}

	async list(): Promise<SiteInfo[]> {
		const sites: SiteInfo[] = [];
		for await (const entry of this.root.values()) {
			if (entry.kind === 'directory') {
				try {
					const site = await this.readSite(entry.name);
					if (site) {
						sites.push(site);
					}
				} catch (e) {
					// @TODO: Still return this site's info, just in an error state.
					logger.error(`Error reading site ${entry.name}:`, e);
					// @TODO: Handle per-site errors somehow.
					// throw e;
				}
			}
		}

		return sites;
	}

	async read(slug: string): Promise<SiteInfo | undefined> {
		return await this.readSite(getDirectoryNameForSlug(slug));
	}

	private async readSite(siteDirName: string) {
		const siteDirectory = await this.root.getDirectoryHandle(siteDirName);
		if (!siteDirectory) {
			return undefined;
		}
		return this.readSiteFromDirHandle(siteDirectory);
	}

	private async readSiteFromDirHandle(
		siteDirectory: FileSystemDirectoryHandle
	) {
		const siteInfoFileHandle = await siteDirectory.getFileHandle(
			SITE_METADATA_FILENAME
		);
		const file = await siteInfoFileHandle.getFile();
		// TODO: Read metadata file and parse and validate via JSON schema
		// TODO: Backfill site info file if missing, detecting actual WP version if possible
		//       ^ do not do it implicitly. Require user interaction. Maybe constrain this just
		//         to the site files import flow.
		const siteInfo = storedFormatToMetadata(await file.text());
		// If the blueprint source points to the bundle directory, load from there.
		// This allows the site to access bundled resources, not just the JSON declaration.
		if (siteInfo.metadata.originalBlueprintSource?.type === 'opfs-site') {
			try {
				siteInfo.metadata.originalBlueprint =
					await loadPersistedBlueprintBundle(siteInfo.slug);
			} catch (error) {
				logger.error(
					`Failed to load blueprint bundle for site ${siteInfo.slug}`,
					error
				);
				// Continue with the JSON declaration
			}
		}

		return siteInfo;
	}

	async delete(slug: string): Promise<void> {
		const siteDirName = getDirectoryNameForSlug(slug);
		await this.root.removeEntry(siteDirName, { recursive: true });
	}
}

export const opfsSiteStorage: OpfsSiteStorage | undefined = opfsSitesRoot
	? new OpfsSiteStorage(opfsSitesRoot)
	: undefined;

export const isOpfsAvailable = !!opfsSiteStorage;

export function getDirectoryPathForSlug(slug: string) {
	return joinPaths(ROOT_PATH, getDirectoryNameForSlug(slug));
}

export function getDirectoryNameForSlug(slug: string) {
	return `site-${slug}`.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
}

async function metadataToStoredFormat(
	slug: string,
	{ originalBlueprint, originalBlueprintSource, ...metadata }: SiteMetadata
): Promise<string> {
	return JSON.stringify(
		{
			slug,
			originalBlueprintSource,
			// Only store the blueprint declaration if it's NOT a bundle directory.
			// For bundle directories, the full bundle is stored separately.
			originalBlueprint:
				originalBlueprintSource?.type === 'opfs-site'
					? undefined
					: await getBlueprintDeclaration(originalBlueprint),
			...metadata,
		},
		undefined,
		'  '
	);
}

function storedFormatToMetadata(data: string) {
	const { slug, ...metadata } = JSON.parse(data) as StoredSiteMetadata;

	/**
	 * Migrate the legacy runtimeConfiguration data format to the new, flat one.
	 */
	if ('preferredVersions' in metadata.runtimeConfiguration) {
		const legacyConfig = metadata.runtimeConfiguration as {
			/**
			 * The preferred PHP and WordPress versions to use.
			 */
			preferredVersions?: {
				/**
				 * The preferred PHP version to use.
				 * If not specified, the latest supported version will be used
				 */
				php: SupportedPHPVersion | 'latest';
				/**
				 * The preferred WordPress version to use.
				 * If not specified, the latest supported version will be used
				 */
				wp: string | 'latest';
			};
			features?: {
				intl?: boolean;
				/** Should boot with support for network request via wp_safe_remote_get? */
				networking?: boolean;
			};
			/**
			 * Extra libraries to preload into the Playground instance.
			 */
			extraLibraries?: ExtraLibrary[];
			/**
			 * PHP Constants to define on every request
			 */
			constants?: PHPConstants;
		};

		metadata.runtimeConfiguration = {
			phpVersion:
				(legacyConfig.preferredVersions?.php as SupportedPHPVersion) ??
				RecommendedPHPVersion,
			wpVersion: legacyConfig.preferredVersions?.wp ?? 'latest',
			intl: legacyConfig.features?.intl ?? false,
			networking: legacyConfig.features?.networking ?? true,
			extraLibraries: legacyConfig.extraLibraries as any[],
			constants: legacyConfig.constants ?? {},
		};
	}

	return {
		slug,
		metadata,
	};
}

async function opfsChildExists(
	handle: FileSystemDirectoryHandle,
	name: string
) {
	try {
		await handle.getDirectoryHandle(name);
		return true;
	} catch {
		try {
			await handle.getFileHandle(name);
			return true;
		} catch {
			return false;
		}
	}
}

export async function deleteDirectory(path: string) {
	let parentDirHandle = await navigator.storage.getDirectory();

	const pathParts = path.split('/').filter((p) => p.length > 0);
	const targetName = pathParts.pop();

	for (const part of pathParts) {
		parentDirHandle = await parentDirHandle.getDirectoryHandle(part);
	}

	await parentDirHandle.removeEntry(targetName!, { recursive: true });
}

async function opfsWriteFile(path: string, content: string) {
	// Note: Safari appears to require a worker to write OPFS file content,
	// and that is why we're using a worker here.
	const worker = new Worker(metadataWorkerUrl, { type: 'module' });

	const channel = new MessageChannel();
	const promiseToWrite = new Promise<void>((resolve, reject) => {
		worker.postMessage({ path, content }, { transfer: [channel.port2] });
		channel.port1.onmessage = function (event: MessageEvent) {
			if (event.data === 'done') {
				resolve();
			} else {
				reject(
					new Error(
						`Unexpected message from OPFS write worker: ${event.data}`
					)
				);
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
