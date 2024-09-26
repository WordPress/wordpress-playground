/**
 * NOTE: This module should probably become a separate package
 * or be added to an existing separate package like @playground/storage,
 * but while we are iterating on the web app redesign,
 * let's keep this module with the web app.
 */

import metadataWorkerUrl from './opfs-site-storage-worker-for-safari?worker&url';
import { createSiteMetadata, SiteMetadata } from '../../site-metadata';
import { SiteInfo } from '../redux/slice-sites';
import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';

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
} catch (e) {
	// Ignore. OPFS is not supported in this environment.
}

class OpfsSiteStorage {
	constructor(private readonly root: FileSystemDirectoryHandle) {}

	async create(slug: string, metadata: SiteMetadata): Promise<void> {
		const newSiteDirName = getDirectoryNameForSlug(slug);
		if (await opfsChildExists(this.root, newSiteDirName)) {
			throw new Error(`Site with slug '${slug}' already exists.`);
		}

		await this.root.getDirectoryHandle(newSiteDirName, {
			create: true,
		});
		await opfsWriteFile(
			joinPaths(ROOT_PATH, newSiteDirName, SITE_METADATA_FILENAME),
			metadataToStoredFormat(slug, metadata)
		);
	}

	async update(slug: string, metadata: SiteMetadata): Promise<void> {
		const newSiteDirName = getDirectoryNameForSlug(slug);
		if (!(await opfsChildExists(this.root, newSiteDirName))) {
			throw new Error(`Site with slug '${slug}' does not exist.`);
		}

		await opfsWriteFile(
			joinPaths(ROOT_PATH, newSiteDirName, SITE_METADATA_FILENAME),
			metadataToStoredFormat(slug, metadata)
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
				}
			}
		}

		// Read legacy OPFS sites
		// @TODO: Remove this backcompat code after 2024-12-01.
		if (new Date(2024, 11).getTime() > Date.now()) {
			const modernSiteDirs = new Set(
				sites.map((site) => `site-${site.slug}`)
			);
			const opfsRoot = await navigator.storage.getDirectory();
			for await (const entry of opfsRoot.values()) {
				if (entry.kind !== 'directory') {
					continue;
				}

				const namedLikeLegacySiteDir =
					entry.name === 'wordpress' ||
					entry.name.startsWith('site-');
				if (!namedLikeLegacySiteDir) {
					continue;
				}

				const conflictsWithModernSite =
					(entry.name === 'wordpress' &&
						modernSiteDirs.has('site-wordpress')) ||
					modernSiteDirs.has(entry.name);
				if (conflictsWithModernSite) {
					continue;
				}

				const slug =
					entry.name === 'wordpress'
						? entry.name
						: entry.name.replace(/^site-/, '');
				const name =
					slug === 'wordpress'
						? 'WordPress'
						: entry.name
								.replace(/^site-/, '')
								.replace(/(?:^|-)\w/g, (c) => c.toUpperCase())
								.replaceAll('-', ' ')
								.replace(/\bwordpress\b/i, 'WordPress');

				// Write modern metadata file for legacy site
				const newMetadata = await createSiteMetadata({
					name,
					storage: 'opfs',
				});
				const legacyPath = joinPaths('/', entry.name);
				await opfsWriteFile(
					joinPaths(legacyPath, SITE_METADATA_FILENAME),
					metadataToStoredFormat(slug, newMetadata)
				);
				const legacySite = await this.readSiteFromDirHandle(entry);
				// Relay legacy OPFS path so knowledge of the path is only needed here.
				(legacySite!.metadata as any)[legacyOpfsPathSymbol] =
					legacyPath;
				sites.push(legacySite!);
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
		return storedFormatToMetadata(await file.text());
	}

	async delete(slug: string): Promise<void> {
		const siteDirName = getDirectoryNameForSlug(slug);
		await this.root.removeEntry(siteDirName, { recursive: true });
	}
}

export const opfsSiteStorage: OpfsSiteStorage | undefined = opfsSitesRoot
	? new OpfsSiteStorage(opfsSitesRoot)
	: undefined;

export function getDirectoryPathForSlug(slug: string) {
	return joinPaths(ROOT_PATH, getDirectoryNameForSlug(slug));
}

export function getDirectoryNameForSlug(slug: string) {
	return `site-${slug}`.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
}

function metadataToStoredFormat(slug: string, metadata: SiteMetadata): string {
	return JSON.stringify({ slug, ...metadata }, undefined, '  ');
}

function storedFormatToMetadata(data: string) {
	const { slug, ...metadata } = JSON.parse(data) as StoredSiteMetadata;

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
	} catch (e) {
		try {
			await handle.getFileHandle(name);
			return true;
		} catch (e) {
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
