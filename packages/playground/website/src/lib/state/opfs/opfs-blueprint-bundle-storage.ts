/**
 * Storage for blueprint bundles alongside persisted sites.
 *
 * When a temporary site is persisted, its blueprint bundle (including
 * blueprint.json and all bundled resources) is copied to the site's
 * storage directory under a `blueprint-bundle` subdirectory.
 */

import {
	OpfsFilesystemBackend,
	type ReadableFilesystemBackend,
} from '@wp-playground/storage';
import { getDirectoryPathForSlug } from './opfs-site-storage';

const BUNDLE_DIR_NAME = 'blueprint-bundle';

/**
 * Get the OPFS directory handle for a site's blueprint bundle.
 */
async function getBundleDirectoryHandle(
	siteSlug: string,
	create: boolean
): Promise<FileSystemDirectoryHandle> {
	let handle = await navigator.storage.getDirectory();
	const sitePath = getDirectoryPathForSlug(siteSlug);

	// Navigate to the site directory
	for (const segment of sitePath.split('/').filter(Boolean)) {
		handle = await handle.getDirectoryHandle(segment, { create });
	}

	// Get or create the bundle directory
	return await handle.getDirectoryHandle(BUNDLE_DIR_NAME, { create });
}

/**
 * Check if a site has a persisted blueprint bundle.
 */
export async function hasBlueprintBundle(siteSlug: string): Promise<boolean> {
	let bundleDir: FileSystemDirectoryHandle;
	try {
		bundleDir = await getBundleDirectoryHandle(siteSlug, false);
	} catch {
		return false;
	}
	// Check if there's at least one entry
	for await (const _ of bundleDir.entries()) {
		return true;
	}
	return false;
}

/**
 * Source interface for copying blueprint bundles.
 * Extends ReadableFilesystemBackend with directory traversal methods.
 */
export interface BundleSource extends ReadableFilesystemBackend {
	listFiles(path: string): Promise<string[]>;
	isDir(path: string): Promise<boolean>;
}

/**
 * Copy files from a source filesystem to a site's blueprint bundle storage.
 */
export async function persistBlueprintBundle(
	siteSlug: string,
	source: BundleSource
): Promise<void> {
	const bundleDir = await getBundleDirectoryHandle(siteSlug, true);

	// Clear existing bundle
	for await (const [name] of bundleDir.entries()) {
		await bundleDir.removeEntry(name, { recursive: true });
	}

	// Copy all files from source
	const copyDir = async (
		sourcePath: string,
		destHandle: FileSystemDirectoryHandle
	) => {
		const entries = await source.listFiles(sourcePath);
		for (const name of entries) {
			const fullPath =
				sourcePath === '/' ? `/${name}` : `${sourcePath}/${name}`;
			if (await source.isDir(fullPath)) {
				const subDir = await destHandle.getDirectoryHandle(name, {
					create: true,
				});
				await copyDir(fullPath, subDir);
			} else {
				const file = await source.read(fullPath);
				const content = new Uint8Array(await file.arrayBuffer());
				const fileHandle = await destHandle.getFileHandle(name, {
					create: true,
				});
				const writable = await fileHandle.createWritable();
				await writable.write(content);
				await writable.close();
			}
		}
	};

	await copyDir('/', bundleDir);
}

/**
 * Delete a site's blueprint bundle.
 */
export async function deleteBlueprintBundle(siteSlug: string): Promise<void> {
	try {
		let handle = await navigator.storage.getDirectory();
		const sitePath = getDirectoryPathForSlug(siteSlug);

		for (const segment of sitePath.split('/').filter(Boolean)) {
			handle = await handle.getDirectoryHandle(segment);
		}

		await handle.removeEntry(BUNDLE_DIR_NAME, { recursive: true });
	} catch {
		// Bundle doesn't exist or couldn't be deleted
	}
}

/**
 * Load a site's persisted blueprint bundle as a filesystem backend.
 * Returns an OpfsFilesystemBackend that can be used as a BlueprintBundle.
 */
export async function loadPersistedBlueprintBundle(
	siteSlug: string
): Promise<OpfsFilesystemBackend> {
	const bundleDir = await getBundleDirectoryHandle(siteSlug, false);
	return OpfsFilesystemBackend.fromDirectoryHandle(bundleDir);
}
