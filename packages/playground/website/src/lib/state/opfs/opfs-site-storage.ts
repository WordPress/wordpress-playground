/**
 * NOTE: This module should probably become a separate package
 * or be added to an existing separate package like @playground/storage,
 * but while we are iterating on the web app redesign,
 * let's keep this module with the web app.
 */

import metadataWorkerUrl from './opfs-site-storage-worker-for-safari?worker&url';
import { SiteMetadata } from '../../site-metadata';
import { SiteInfo } from '../redux/store';
import { joinPaths } from '@php-wasm/util';

// TODO: Decide on metadata filename
const ROOT_PATH = '/sites';
const SITE_METADATA_FILENAME = 'playground-site-metadata.json';

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

let opfsRoot: FileSystemDirectoryHandle | undefined = undefined;
try {
	opfsRoot = await navigator.storage.getDirectory();
	for (const path of ROOT_PATH.replace(/^\//, '').split('/')) {
		opfsRoot = await opfsRoot.getDirectoryHandle(path, { create: true });
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
				const site = await this.readSite(entry.name);
				if (site) {
					sites.push(site);
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

		const siteInfoFileHandle = await siteDirectory.getFileHandle(
			SITE_METADATA_FILENAME
		);
		const file = await siteInfoFileHandle.getFile();
		// TODO: Read metadata file and parse and validate via JSON schema
		// TODO: Backfill site info file if missing, detecting actual WP version if possible
		return storedFormatToMetadata(await file.text());
	}

	async delete(slug: string): Promise<void> {
		const siteDirName = getDirectoryNameForSlug(slug);
		await this.root.removeEntry(siteDirName, { recursive: true });
	}
}

export const opfsSiteStorage: OpfsSiteStorage | undefined = opfsRoot
	? new OpfsSiteStorage(opfsRoot)
	: undefined;

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

async function opfsWriteFile(path: string, content: string) {
	// Note: Safari appears to require a worker to write OPFS file content,
	// and that is why we're using a worker here.
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
