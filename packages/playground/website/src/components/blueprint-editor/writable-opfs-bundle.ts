import type { AsyncWritableFilesystem } from '@wp-playground/components';
import type { BlueprintBundle } from '@wp-playground/blueprints';
import { WritableInMemoryBundle } from './writable-in-memory-bundle';
import { ensureAbsolutePath } from './convert-blueprint-to-filesystem';

export const OPFS_BASE_PATH = ['blueprints', 'last-edited-bundle'];

/**
 * Writable bundle that mirrors all changes into OPFS at /blueprints/last-edited-bundle.
 * Falls back silently to in-memory behavior if OPFS is unavailable or throws.
 */
export class WritableOpfsBundle
	extends WritableInMemoryBundle
	implements AsyncWritableFilesystem, BlueprintBundle
{
	private opfsRoot: FileSystemDirectoryHandle | null = null;

	static async create(
		initialFiles: Record<string, Uint8Array | string>,
		onChange?: (bundle: BlueprintBundle) => void
	): Promise<WritableOpfsBundle> {
		const bundle = new WritableOpfsBundle(initialFiles, onChange);
		await bundle.initOpfs();
		await bundle.syncAllToOpfs();
		return bundle;
	}

	private constructor(
		initialFiles: Record<string, Uint8Array | string>,
		onChange?: (bundle: BlueprintBundle) => void
	) {
		super(initialFiles, onChange);
	}

	static async loadFromOpfs(
		onChange?: (bundle: BlueprintBundle) => void
	): Promise<WritableOpfsBundle> {
		const root = await WritableOpfsBundle.getOpfsRoot();
		if (!root) {
			throw new Error('OPFS not available');
		}
		const files: Record<string, Uint8Array> = {};
		const walk = async (
			dir: FileSystemDirectoryHandle,
			prefix: string
		): Promise<void> => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			for await (const [name, handle] of dir.entries()) {
				if (handle.kind === 'file') {
					const file = await handle.getFile();
					const buffer = new Uint8Array(await file.arrayBuffer());
					const path =
						prefix === '/' ? `/${name}` : `${prefix}/${name}`;
					files[path] = buffer;
				} else if (handle.kind === 'directory') {
					const nextPrefix =
						prefix === '/' ? `/${name}` : `${prefix}/${name}`;
					await walk(handle, nextPrefix);
				}
			}
		};
		await walk(root, '/');
		return WritableOpfsBundle.create(files, onChange);
	}

	private async initOpfs() {
		this.opfsRoot = await WritableOpfsBundle.getOpfsRoot(true);
	}

	// --- Overrides that persist to OPFS ---
	async writeFile(path: string, data: Uint8Array | string): Promise<void> {
		await super.writeFile(path, data);
		await this.writeFileToOpfs(path);
	}

	async mkdir(path: string): Promise<void> {
		await super.mkdir(path);
		await this.ensureOpfsDir(path);
	}

	async rmdir(
		path: string,
		options?: { recursive?: boolean }
	): Promise<void> {
		await super.rmdir(path, options);
		await this.removeOpfsEntry(path, true);
	}

	async mv(source: string, destination: string): Promise<void> {
		await super.mv(source, destination);
		await this.removeOpfsEntry(source, true);
		await this.writeFileToOpfs(destination);
	}

	async unlink(path: string): Promise<void> {
		await super.unlink(path);
		await this.removeOpfsEntry(path, false);
	}

	// --- OPFS helpers ---
	private async ensureOpfsDir(path: string) {
		if (!this.opfsRoot) return;
		const normalized = ensureAbsolutePath(path);
		const segments = normalized.split('/').filter(Boolean);
		// only directories
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment, { create: true });
		}
	}

	private async writeFileToOpfs(path: string) {
		if (!this.opfsRoot) return;
		const normalized = ensureAbsolutePath(path);
		const segments = normalized.split('/').filter(Boolean);
		const fileName = segments.pop();
		if (!fileName) return;
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment, { create: true });
		}
		const handle = await dir.getFileHandle(fileName, { create: true });
		const writable = await handle.createWritable();
		const buffer = await this.readFileAsBuffer(normalized);
		await writable.write(buffer);
		await writable.close();
	}

	private async removeOpfsEntry(path: string, isDirHint: boolean) {
		if (!this.opfsRoot) return;
		const normalized = ensureAbsolutePath(path);
		const segments = normalized.split('/').filter(Boolean);
		const name = segments.pop();
		if (!name) return;
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment, { create: false });
		}
		try {
			await dir.removeEntry(name, { recursive: isDirHint });
		} catch {
			/* ignore */
		}
	}

	private async syncAllToOpfs() {
		if (!this.opfsRoot) return;
		const walk = async (node: FsNode, base: string) => {
			if (node.type === 'file') {
				await this.writeFileToOpfs(base);
				return;
			}
			await this.ensureOpfsDir(base || '/');
			for (const [name, child] of Object.entries(node.children)) {
				const childPath =
					base === '/' || base === ''
						? `/${name}`
						: `${base}/${name}`;
				await walk(child, childPath);
			}
		};
		await walk(this.getRootSnapshot(), '/');
	}

	// Expose snapshot of root for sync
	private getRootSnapshot(): DirNode {
		// @ts-expect-error access internal
		return this.root as DirNode;
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

type FileNode = { type: 'file'; content: Uint8Array };
type DirNode = { type: 'dir'; children: Record<string, FsNode> };
type FsNode = FileNode | DirNode;
