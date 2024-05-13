import nodefs from 'fs';
import type { Ino } from '@zenfs/core/inode.js';
import type { Backend } from '@zenfs/core/backends/backend.js';
import {
	SimpleSyncStore,
	SimpleSyncTransaction,
	SyncStore,
	SyncStoreFS,
	SyncTransaction,
} from '@zenfs/core/backends/SyncStore.js';
import { Stats } from '@zenfs/core/stats.js';
import { ApiError } from '@zenfs/core/ApiError.js';
import { join } from 'path';

// @TODO: implement the following class:
// export class NodeJsFile<FS extends FileSystem> extends File {

/**
 * A simple in-memory store
 */
export class NodeFsStore implements SyncStore, SimpleSyncStore {
	private store: Map<Ino, Uint8Array> = new Map();

	constructor(public name: string = 'tmp') {}
	public clear() {
		this.store.clear();
	}

	public beginTransaction(): SyncTransaction {
		return new SimpleSyncTransaction(this);
	}

	public get(key: Ino) {
		return this.store.get(key);
	}

	public put(key: Ino, data: Uint8Array, overwrite: boolean): boolean {
		if (!overwrite && this.store.has(key)) {
			return false;
		}
		this.store.set(key, data);
		return true;
	}

	public remove(key: Ino): void {
		this.store.delete(key);
	}
}

export class SimpleNodeFs extends SyncStoreFS {
	protected root: string;
	constructor({ root, store }: { root: string; store: SyncStore }) {
		super({ store });
		this.root = root;
	}

	protected resolvePath(p: string): string {
		return join(this.root, p);
	}

	override readdirSync(path: string) {
		return nodefs.readdirSync(this.resolvePath(path));
	}
	public readFileSync(path: string): Uint8Array {
		return nodefs.readFileSync(this.resolvePath(path));
	}

	public writeFileSync(path: string, data: Uint8Array): void {
		nodefs.writeFileSync(path, data);
	}

	public override existsSync(path: string): boolean {
		return nodefs.existsSync(this.resolvePath(path));
	}

	public override statSync(path: string): Stats {
		try {
			const stats = nodefs.statSync(this.resolvePath(path));

			return new Stats({
				mode: stats.mode,
				uid: stats.uid,
				gid: stats.gid,
				size: stats.size,
				atimeMs: stats.atime.getTime(),
				mtimeMs: stats.mtime.getTime(),
				ctimeMs: stats.ctime.getTime(),
			});
		} catch (e) {
			throw ApiError.With(e.code, path, 'stat');
		}
	}

	public override mkdirSync(path: string): void {
		nodefs.mkdirSync(this.resolvePath(path));
	}

	public override rmdirSync(path: string): void {
		nodefs.rmdirSync(this.resolvePath(path));
	}

	public override unlinkSync(path: string): void {
		nodefs.unlinkSync(this.resolvePath(path));
	}

	public override renameSync(oldPath: string, newPath: string): void {
		nodefs.renameSync(this.resolvePath(oldPath), this.resolvePath(newPath));
	}
}

/**
 * A simple in-memory file system backed by an InMemoryStore.
 * Files are not persisted across page loads.
 */
export const NodeFs = {
	name: 'NodeFs',
	isAvailable(): boolean {
		return true;
	},
	options: {
		name: {
			type: 'string',
			required: false,
			description: 'The name of the store',
		},
	},
	create({ name, root }: { name?: string; root: string }) {
		return new SimpleNodeFs({ root, store: new NodeFsStore(name) });
	},
} as const satisfies Backend<SimpleNodeFs, { name?: string }>;
