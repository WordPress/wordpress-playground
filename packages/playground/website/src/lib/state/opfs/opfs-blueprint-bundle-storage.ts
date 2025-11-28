/**
 * Storage for blueprint bundles alongside persisted sites.
 *
 * When a temporary site is persisted, its blueprint bundle (including
 * blueprint.json and all bundled resources) is copied to the site's
 * storage directory under a `blueprint-bundle` subdirectory.
 */

import { StreamedFile } from '@php-wasm/stream-compression';
import type { Filesystem } from '@wp-playground/storage';
import { getDirectoryPathForSlug } from './opfs-site-storage';

const BUNDLE_DIR_NAME = 'blueprint-bundle';

/**
 * Get the OPFS directory handle for a site's blueprint bundle.
 */
async function getBundleDirectoryHandle(
	siteSlug: string,
	create = false
): Promise<FileSystemDirectoryHandle | null> {
	try {
		let handle = await navigator.storage.getDirectory();
		const sitePath = getDirectoryPathForSlug(siteSlug);

		// Navigate to the site directory
		for (const segment of sitePath.split('/').filter(Boolean)) {
			handle = await handle.getDirectoryHandle(segment, { create });
		}

		// Get or create the bundle directory
		return await handle.getDirectoryHandle(BUNDLE_DIR_NAME, { create });
	} catch {
		return null;
	}
}

/**
 * Check if a site has a persisted blueprint bundle.
 */
export async function hasBlueprintBundle(siteSlug: string): Promise<boolean> {
	const bundleDir = await getBundleDirectoryHandle(siteSlug, false);
	if (!bundleDir) {
		return false;
	}
	// Check if there's at least one entry
	for await (const _ of bundleDir.entries()) {
		return true;
	}
	return false;
}

/**
 * Copy files from a source filesystem to a site's blueprint bundle storage.
 */
export async function persistBlueprintBundle(
	siteSlug: string,
	source: {
		listFiles(path: string): Promise<string[]>;
		isDir(path: string): Promise<boolean>;
		readFileAsBuffer(path: string): Promise<Uint8Array>;
	}
): Promise<void> {
	const bundleDir = await getBundleDirectoryHandle(siteSlug, true);
	if (!bundleDir) {
		throw new Error('Could not create blueprint bundle directory');
	}

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
				const content = await source.readFileAsBuffer(fullPath);
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
 * Create a Filesystem that reads from a site's persisted blueprint bundle.
 * This implements the Filesystem interface required by BlueprintBundle.
 */
export class PersistedBlueprintBundle implements Filesystem {
	private readonly bundleDir: FileSystemDirectoryHandle;

	private constructor(bundleDir: FileSystemDirectoryHandle) {
		this.bundleDir = bundleDir;
	}

	static async create(siteSlug: string): Promise<PersistedBlueprintBundle> {
		const bundleDir = await getBundleDirectoryHandle(siteSlug, false);
		if (!bundleDir) {
			throw new Error(`No blueprint bundle found for site '${siteSlug}'`);
		}
		return new PersistedBlueprintBundle(bundleDir);
	}

	async read(path: string): Promise<StreamedFile> {
		const segments = path.split('/').filter(Boolean);
		const fileName = segments.pop();
		if (!fileName) {
			throw new Error(`Invalid file path: ${path}`);
		}

		let dir = this.bundleDir;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}

		const fileHandle = await dir.getFileHandle(fileName);
		const file = await fileHandle.getFile();
		const content = new Uint8Array(await file.arrayBuffer());

		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(content);
				controller.close();
			},
		});

		return new StreamedFile(stream, path, {
			filesize: content.byteLength,
		});
	}
}
