/**
 * NOTE: This module should probably become a separate package
 * or be added to an existing separate package like @playground/storage,
 * but while we are iterating on the web app redesign,
 * let's keep this module with the web app.
 */

import metadataWorkerUrl from './opfs-site-storage-worker-for-safari?worker&url';
import type { SiteInfo, SiteMetadata } from '../redux/slice-sites';
import type { OriginalUrlParams } from '../original-url-params';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import {
	type ExtraLibrary,
	type PHPConstants,
	getBlueprintDeclaration,
} from '@wp-playground/blueprints';
import type { AllPHPVersion } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	BUNDLE_DIR_NAME,
	loadPersistedBlueprintBundle,
	loadPersistedBlueprintBundleFromPath,
} from './opfs-blueprint-bundle-storage';
import {
	OPFS_SITES_ROOT_PATH,
	getCandidateDirectoryNamesForSlug,
	getDirectoryNameForSlug,
} from './opfs-site-path';
export {
	getDirectoryNameForSlug,
	getDirectoryPathForSlug,
} from './opfs-site-path';

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
 * * It keeps the setup URL params that settings and sharing panes need after reload.
 * * It's not concerned with any other extra information stored in SiteInfo by
 *   the redux store.
 *
 * I'm not yet sure whether that's the right approach. Let's keep going and find out as the
 * design matures.
 */
export interface StoredSiteMetadata extends SiteMetadata {
	slug: string;
	originalUrlParams?: OriginalUrlParams;
}

let opfsSitesRoot: FileSystemDirectoryHandle | undefined = undefined;
try {
	opfsSitesRoot = await navigator.storage.getDirectory();
	for (const path of OPFS_SITES_ROOT_PATH.replace(/^\//, '').split('/')) {
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

	/**
	 * Creates an OPFS site directory and stores its reloadable metadata.
	 */
	async create(
		slug: string,
		metadata: SiteMetadata,
		originalUrlParams?: OriginalUrlParams
	): Promise<void> {
		const newSiteDirName = getDirectoryNameForSlug(slug);
		const existingSiteDirName = await this.findExistingSiteDirName(slug);
		if (existingSiteDirName) {
			throw new Error(`Site with slug '${slug}' already exists.`);
		}
		await this.root.getDirectoryHandle(newSiteDirName, {
			create: true,
		});
		await opfsWriteFile(
			getSiteMetadataPath(newSiteDirName),
			await metadataToStoredFormat(slug, metadata, originalUrlParams)
		);
	}

	/**
	 * Updates OPFS site metadata without changing the site directory name.
	 */
	async update(
		slug: string,
		metadata: SiteMetadata,
		originalUrlParams?: OriginalUrlParams
	): Promise<void> {
		const siteDirName = await this.findExistingSiteDirName(slug);
		if (!siteDirName) {
			throw new Error(`Site with slug '${slug}' does not exist.`);
		}

		await opfsWriteFile(
			getSiteMetadataPath(siteDirName),
			await metadataToStoredFormat(slug, metadata, originalUrlParams)
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
		const siteDirName = await this.findExistingSiteDirName(slug);
		if (!siteDirName) {
			return undefined;
		}
		return await this.readSite(siteDirName);
	}

	/**
	 * Returns a ZIP for a saved OPFS Playground that is actually exportable.
	 *
	 * WordPress-looking files prove nothing. `wp-config.php`, plugins, uploads,
	 * or a SQLite database can be leftovers from an interrupted save. The only
	 * authority here is `wp-runtime.json`, and even that is not enough if it says
	 * the first OPFS sync is still pending or an in-place reset is unfinished.
	 * Do not add file-based heuristics here.
	 *
	 * Return `undefined` for those cases. A missing ZIP is correct; a ZIP of
	 * half-written or mismatched files is just corrupt output with a nicer file
	 * extension.
	 */
	async exportSavedSiteAsZip(slug: string): Promise<Blob | undefined> {
		const siteDirectory = await this.getSavedSiteDirectory(slug);
		if (!siteDirectory) {
			return undefined;
		}
		return await zipDirectory(siteDirectory);
	}

	/**
	 * Opens the saved-site directory only if its metadata says the files are complete.
	 *
	 * This intentionally re-reads `wp-runtime.json` after `findExistingSiteDirName()`.
	 * The earlier lookup finds a candidate. This method verifies the candidate still
	 * exists, still has metadata, and is not marked as half-saved or mid-reset.
	 */
	private async getSavedSiteDirectory(
		slug: string
	): Promise<FileSystemDirectoryHandle | undefined> {
		const siteDirName = await this.findExistingSiteDirName(slug);
		if (!siteDirName) {
			return undefined;
		}
		try {
			const siteDirectory =
				await this.root.getDirectoryHandle(siteDirName);
			const site = await this.readStoredSiteMetadata(siteDirectory);
			// If bootSiteClient() refuses to mount these files, export must
			// refuse them too. Otherwise we hand callers a ZIP of files we
			// already know are incomplete or being replaced.
			if (
				site.metadata.initialOpfsSyncPending === true ||
				site.metadata.opfsSiteRemovalPending === true
			) {
				return undefined;
			}
			return siteDirectory;
		} catch (error) {
			// The first lookup only proved the metadata existed at that
			// instant. Another tab can delete the directory or wp-runtime.json
			// before export starts. That is not an exportable Playground.
			if (isMissingOpfsEntry(error)) {
				return undefined;
			}
			throw error;
		}
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
		const siteInfo = await this.readStoredSiteMetadata(siteDirectory);
		const sitePath = joinPaths(OPFS_SITES_ROOT_PATH, siteDirectory.name);
		const isLegacyDirectoryName =
			siteDirectory.name !== getDirectoryNameForSlug(siteInfo.slug);
		if (isLegacyDirectoryName) {
			(siteInfo.metadata as any)[legacyOpfsPathSymbol] = sitePath;
		}

		// If the blueprint source points to the bundle directory, load from there.
		// This allows the site to access bundled resources, not just the JSON declaration.
		if (siteInfo.metadata.originalBlueprintSource?.type === 'opfs-site') {
			try {
				siteInfo.metadata.originalBlueprint = isLegacyDirectoryName
					? await loadPersistedBlueprintBundleFromPath(sitePath)
					: await loadPersistedBlueprintBundle(siteInfo.slug);
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

	/**
	 * Reads the saved Playground metadata file from an OPFS site directory.
	 *
	 * Keep site loading and ZIP export on this same parser. If the metadata format
	 * changes, both paths need to agree on what the saved site state means.
	 */
	private async readStoredSiteMetadata(
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
		return storedFormatToMetadata(await file.text());
	}

	async delete(slug: string): Promise<void> {
		const siteDirName = await this.findExistingSiteDirName(slug);
		if (!siteDirName) {
			throw new Error(`Site with slug '${slug}' does not exist.`);
		}
		await this.root.removeEntry(siteDirName, { recursive: true });
	}

	/**
	 * Removes WordPress files from an OPFS-backed site while preserving the
	 * site metadata file and the editable Blueprint bundle directory.
	 *
	 * Autosaved reset paths use this after the user chooses to keep the same
	 * sidebar entry but boot it from new settings or an edited Blueprint. Keep
	 * the metadata file and editable Blueprint bundle; delete everything else
	 * because those entries are the old WordPress runtime tree that the next
	 * boot must recreate from the new setup.
	 */
	async removeWordPressFilesKeepMetadata(slug: string): Promise<void> {
		const siteDirName = await this.findExistingSiteDirName(slug);
		if (!siteDirName) {
			throw new Error(`Site with slug '${slug}' does not exist.`);
		}
		const siteDirectory = await this.root.getDirectoryHandle(siteDirName);
		const namesToDelete: string[] = [];
		for await (const [name] of siteDirectory.entries()) {
			// The next boot still needs the site metadata and the edited
			// Blueprint bundle. Everything else belongs to the old WordPress
			// tree and must be removed before the new setup runs.
			if (name === SITE_METADATA_FILENAME || name === BUNDLE_DIR_NAME) {
				continue;
			}
			namesToDelete.push(name);
		}
		// Collect names before deleting. Some File System Access implementations
		// are brittle when a directory is mutated while its iterator is active.
		for (const name of namesToDelete) {
			await siteDirectory.removeEntry(name, { recursive: true });
		}
	}

	/**
	 * Finds the directory containing a persisted site's metadata.
	 *
	 * A failed save can leave behind an encoded directory without
	 * `wp-runtime.json`. That partial directory must not hide a legacy directory
	 * that still contains the saved site for the same slug.
	 */
	private async findExistingSiteDirName(slug: string) {
		for (const siteDirName of getCandidateDirectoryNamesForSlug(slug)) {
			const siteDirectory = await getDirectoryHandleIfExists(
				this.root,
				siteDirName
			);
			if (
				siteDirectory &&
				(await opfsFileExists(siteDirectory, SITE_METADATA_FILENAME))
			) {
				return siteDirName;
			}
		}

		return undefined;
	}
}

export const opfsSiteStorage: OpfsSiteStorage | undefined = opfsSitesRoot
	? new OpfsSiteStorage(opfsSitesRoot)
	: undefined;

export const isOpfsAvailable = !!opfsSiteStorage;

function getSiteMetadataPath(siteDirName: string) {
	return joinPaths(OPFS_SITES_ROOT_PATH, siteDirName, SITE_METADATA_FILENAME);
}

async function metadataToStoredFormat(
	slug: string,
	{ originalBlueprint, originalBlueprintSource, ...metadata }: SiteMetadata,
	originalUrlParams?: OriginalUrlParams
): Promise<string> {
	return JSON.stringify(
		{
			slug,
			originalUrlParams,
			originalBlueprintSource,
			/**
			 * Site metadata stores Blueprint declaration JSON, not arbitrary
			 * bundle files. When the source is not `opfs-site`, saving records
			 * `blueprint.json` only; bundled resource files are not copied into
			 * the metadata file. Autosaved Playgrounds persist editable bundle
			 * files beside WordPress files, so metadata points at that OPFS
			 * bundle directory instead of duplicating the declaration here.
			 */
			originalBlueprint:
				originalBlueprintSource?.type === 'opfs-site'
					? undefined
					: await getBlueprintDeclaration(originalBlueprint as any),
			...metadata,
		},
		undefined,
		'  '
	);
}

function storedFormatToMetadata(data: string) {
	const { slug, originalUrlParams, ...metadata } = JSON.parse(
		data
	) as StoredSiteMetadata;

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
				php: AllPHPVersion | 'latest';
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
				(legacyConfig.preferredVersions?.php as AllPHPVersion) ??
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
		originalUrlParams,
		metadata,
	};
}

async function getDirectoryHandleIfExists(
	handle: FileSystemDirectoryHandle,
	name: string
) {
	try {
		return await handle.getDirectoryHandle(name);
	} catch (error) {
		if (isMissingOpfsEntry(error)) {
			return undefined;
		}
		throw error;
	}
}

async function opfsFileExists(handle: FileSystemDirectoryHandle, name: string) {
	try {
		await handle.getFileHandle(name);
		return true;
	} catch (error) {
		if (isMissingOpfsEntry(error)) {
			return false;
		}
		throw error;
	}
}

function isMissingOpfsEntry(error: unknown) {
	const name = (error as DOMException | undefined)?.name;
	return name === 'NotFoundError' || name === 'TypeMismatchError';
}

/**
 * Writes an OPFS directory into a ZIP Blob.
 *
 * Return the Blob. Do not turn it into a `Uint8Array`: download and upload
 * callers can use the Blob directly, and converting it copies the whole archive
 * for no useful reason.
 */
async function zipDirectory(directory: FileSystemDirectoryHandle) {
	const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
	try {
		await addDirectoryEntries(zipWriter, directory, '');
		return await zipWriter.close();
	} catch (error) {
		await zipWriter.close().catch(() => undefined);
		throw error;
	}
}

/**
 * Adds every file and empty directory below `directory` to `zipWriter`.
 *
 * Directory entries are explicit because empty directories otherwise disappear
 * from ZIP archives. Files go through `BlobReader` so zip.js reads from the
 * browser `File` object instead of us first copying each file into memory.
 */
async function addDirectoryEntries(
	zipWriter: ZipWriter<Blob>,
	directory: FileSystemDirectoryHandle,
	relativeDirPath: string
) {
	for await (const [name, entry] of directory.entries()) {
		const relativePath = relativeDirPath
			? joinPaths(relativeDirPath, name)
			: name;

		if (entry.kind === 'directory') {
			await zipWriter.add(`${relativePath}/`, undefined, {
				directory: true,
			});
			await addDirectoryEntries(zipWriter, entry, relativePath);
		} else {
			await zipWriter.add(
				relativePath,
				new BlobReader(await entry.getFile())
			);
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
