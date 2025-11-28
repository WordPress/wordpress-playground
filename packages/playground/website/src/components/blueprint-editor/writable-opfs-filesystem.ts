import type { FilesystemBackend } from './writable-filesystem';

export const OPFS_BASE_PATH = ['blueprints', 'last-edited-bundle'];

/**
 * OPFS filesystem backend that operates directly on the Origin Private File System.
 */
export class OpfsFilesystemBackend implements FilesystemBackend {
	constructor(private readonly opfsRoot: FileSystemDirectoryHandle) {}

	static async create(): Promise<OpfsFilesystemBackend> {
		const root = await OpfsFilesystemBackend.getOpfsRoot(true);
		if (!root) {
			throw new Error('OPFS not available');
		}
		return new OpfsFilesystemBackend(root);
	}

	static async loadFromOpfs(): Promise<OpfsFilesystemBackend> {
		const root = await OpfsFilesystemBackend.getOpfsRoot();
		if (!root) {
			throw new Error('OPFS not available');
		}
		return new OpfsFilesystemBackend(root);
	}

	static async hasSavedBundle(): Promise<boolean> {
		const root = await OpfsFilesystemBackend.getOpfsRoot();
		if (!root) {
			return false;
		}
		for await (const _ of root.entries()) {
			return true;
		}
		return false;
	}

	static async discardSavedBundle(): Promise<void> {
		const root = await OpfsFilesystemBackend.getOpfsRoot();
		if (!root) {
			return;
		}
		for await (const [name] of root.entries()) {
			try {
				await root.removeEntry(name, { recursive: true });
			} catch {
				/* ignore */
			}
		}
	}

	async isDir(absolutePath: string): Promise<boolean> {
		if (absolutePath === '/') {
			return true;
		}
		try {
			const segments = absolutePath.split('/').filter(Boolean);
			let dir = this.opfsRoot;
			for (const segment of segments) {
				dir = await dir.getDirectoryHandle(segment);
			}
			return true;
		} catch {
			return false;
		}
	}

	async fileExists(absolutePath: string): Promise<boolean> {
		const segments = absolutePath.split('/').filter(Boolean);
		const fileName = segments.pop();
		if (!fileName) {
			return false;
		}
		try {
			let dir = this.opfsRoot;
			for (const segment of segments) {
				dir = await dir.getDirectoryHandle(segment);
			}
			await dir.getFileHandle(fileName);
			return true;
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
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}
		const handle = await dir.getFileHandle(fileName);
		const file = await handle.getFile();
		return new Uint8Array(await file.arrayBuffer());
	}

	async listFiles(absolutePath: string): Promise<string[]> {
		let dir = this.opfsRoot;
		if (absolutePath !== '/') {
			const segments = absolutePath.split('/').filter(Boolean);
			for (const segment of segments) {
				dir = await dir.getDirectoryHandle(segment);
			}
		}
		const names: string[] = [];
		for await (const [name] of dir.entries()) {
			names.push(name);
		}
		return names;
	}

	async writeFile(absolutePath: string, data: Uint8Array): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		const fileName = segments.pop();
		if (!fileName) {
			throw new Error(`Invalid file path: ${absolutePath}`);
		}
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment, { create: true });
		}
		const handle = await dir.getFileHandle(fileName, { create: true });
		const writable = await handle.createWritable();
		await writable.write(data as BlobPart);
		await writable.close();
	}

	async mkdir(absolutePath: string): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment, { create: true });
		}
	}

	async rmdir(absolutePath: string, recursive: boolean): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		const name = segments.pop();
		if (!name) {
			return;
		}
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}
		await dir.removeEntry(name, { recursive });
	}

	async mv(
		absoluteSource: string,
		absoluteDestination: string
	): Promise<void> {
		const isSourceDir = await this.isDir(absoluteSource);
		if (isSourceDir) {
			await this.copyDir(absoluteSource, absoluteDestination);
			await this.rmdir(absoluteSource, true);
		} else {
			const content = await this.readFileAsBuffer(absoluteSource);
			await this.writeFile(absoluteDestination, content);
			await this.unlink(absoluteSource);
		}
	}

	async unlink(absolutePath: string): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		const name = segments.pop();
		if (!name) {
			return;
		}
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}
		try {
			await dir.removeEntry(name);
		} catch {
			/* ignore */
		}
	}

	// --- Internal helpers ---
	private async copyDir(source: string, destination: string): Promise<void> {
		await this.mkdir(destination);
		const files = await this.listFiles(source);
		for (const name of files) {
			const srcPath = source === '/' ? `/${name}` : `${source}/${name}`;
			const destPath =
				destination === '/' ? `/${name}` : `${destination}/${name}`;
			if (await this.isDir(srcPath)) {
				await this.copyDir(srcPath, destPath);
			} else {
				const content = await this.readFileAsBuffer(srcPath);
				await this.writeFile(destPath, content);
			}
		}
	}

	private static async getOpfsRoot(
		create = false
	): Promise<FileSystemDirectoryHandle | null> {
		if (typeof navigator === 'undefined') {
			return null;
		}
		if (!navigator.storage || !navigator.storage.getDirectory) {
			return null;
		}
		try {
			let handle = await navigator.storage.getDirectory();
			for (const segment of OPFS_BASE_PATH) {
				handle = await handle.getDirectoryHandle(segment, {
					create,
				});
			}
			return handle;
		} catch {
			return null;
		}
	}
}
