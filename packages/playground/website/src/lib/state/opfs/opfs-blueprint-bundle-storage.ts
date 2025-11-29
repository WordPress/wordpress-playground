/**
 * Storage for blueprint bundles alongside persisted sites.
 *
 * When a temporary site is persisted, its blueprint bundle (including
 * blueprint.json and all bundled resources) is copied to the site's
 * storage directory under a `blueprint-bundle` subdirectory.
 */

import { StreamedFile } from '@php-wasm/stream-compression';
import type { Filesystem } from '@wp-playground/storage';
import type { FilesystemBackend } from '../../../components/blueprint-editor/writable-filesystem';
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
				await writable.write(content as unknown as ArrayBuffer);
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
 * This implements both the Filesystem interface (for BlueprintBundle) and
 * FilesystemBackend interface (for use with WritableFilesystem in the editor).
 *
 * Note: This is a read-only filesystem. Write operations will throw errors.
 */
export class PersistedBlueprintBundle implements Filesystem, FilesystemBackend {
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

	private async getDirHandle(
		path: string
	): Promise<FileSystemDirectoryHandle> {
		const segments = path.split('/').filter(Boolean);
		let dir = this.bundleDir;

		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}

		return dir;
	}

	// Filesystem interface (for BlueprintBundle)
	async read(path: string): Promise<StreamedFile> {
		const content = await this.readFileAsBuffer(path);

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

	// FilesystemBackend interface (read methods)
	async isDir(absolutePath: string): Promise<boolean> {
		try {
			const segments = absolutePath.split('/').filter(Boolean);
			if (segments.length === 0) {
				return true; // Root is always a directory
			}

			const parentPath = segments.slice(0, -1);
			const name = segments[segments.length - 1];

			let dir = this.bundleDir;
			for (const segment of parentPath) {
				dir = await dir.getDirectoryHandle(segment);
			}

			try {
				await dir.getDirectoryHandle(name);
				return true;
			} catch {
				return false;
			}
		} catch {
			return false;
		}
	}

	async fileExists(absolutePath: string): Promise<boolean> {
		try {
			const segments = absolutePath.split('/').filter(Boolean);
			if (segments.length === 0) {
				return false; // Root is not a file
			}

			const parentPath = segments.slice(0, -1);
			const name = segments[segments.length - 1];

			let dir = this.bundleDir;
			for (const segment of parentPath) {
				dir = await dir.getDirectoryHandle(segment);
			}

			try {
				await dir.getFileHandle(name);
				return true;
			} catch {
				return false;
			}
		} catch {
			return false;
		}
	}

	async readFileAsBuffer(absolutePath: string): Promise<Uint8Array> {
		const segments = absolutePath.split('/').filter(Boolean);
		const fileName = segments.pop();
		if (!fileName) {
			throw new Error(`Invalid file path: ${absolutePath}`);
		}

		let dir = this.bundleDir;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}

		const fileHandle = await dir.getFileHandle(fileName);
		const file = await fileHandle.getFile();
		return new Uint8Array(await file.arrayBuffer());
	}

	async listFiles(absolutePath: string): Promise<string[]> {
		const dir = await this.getDirHandle(absolutePath);
		const entries: string[] = [];

		for await (const [name] of dir.entries()) {
			entries.push(name);
		}

		return entries;
	}

	// FilesystemBackend interface (write methods - read-only, so throw errors)
	async writeFile(_absolutePath: string, _data: Uint8Array): Promise<void> {
		throw new Error('PersistedBlueprintBundle is read-only');
	}

	async mkdir(_absolutePath: string): Promise<void> {
		throw new Error('PersistedBlueprintBundle is read-only');
	}

	async rmdir(_absolutePath: string, _recursive: boolean): Promise<void> {
		throw new Error('PersistedBlueprintBundle is read-only');
	}

	async mv(
		_absoluteSource: string,
		_absoluteDestination: string
	): Promise<void> {
		throw new Error('PersistedBlueprintBundle is read-only');
	}

	async unlink(_absolutePath: string): Promise<void> {
		throw new Error('PersistedBlueprintBundle is read-only');
	}

	async clear(): Promise<void> {
		throw new Error('PersistedBlueprintBundle is read-only');
	}
}
