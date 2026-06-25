import { describe, expect, it } from 'vitest';
import {
	diffSnapshots,
	hashBytes,
	restoreFilesystemSnapshot,
	snapshotFilesystem,
} from './filesystem-snapshot';

const FILE_TYPE_MODE = 0o100000;
const DIR_TYPE_MODE = 0o040000;
const LINK_TYPE_MODE = 0o120000;
const FILE_MODE = FILE_TYPE_MODE | 0o644;
const DIR_MODE = DIR_TYPE_MODE | 0o755;
const LINK_MODE = LINK_TYPE_MODE | 0o777;

describe('filesystem snapshots', () => {
	it('lists snapshot entries with paths, hashes, and copied bytes', async () => {
		const FS = createFakeFS({
			'/wordpress/wp-content/database/.ht.sqlite': bytes('database'),
			'/wordpress/wp-content/database/.ht.sqlite-wal': bytes('wal'),
			'/wordpress/wp-content/uploads/image.bin': new Uint8Array([
				0, 1, 2,
			]),
		});
		FS.symlink('../uploads/image.bin', '/wordpress/wp-content/image-link');

		const snapshot = await snapshotFilesystem(FS as any, '/wordpress', {
			includeBytes: true,
			createdAt: '2026-06-25T00:00:00.000Z',
		});
		const entriesByPath = new Map(
			snapshot.entries.map((entry) => [entry.path, entry])
		);

		expect(snapshot.root).toBe('/wordpress');
		expect(snapshot.id).toMatch(/^sha256:/);
		expect(entriesByPath.get('/wordpress')?.type).toBe('directory');
		expect(
			entriesByPath.get('/wordpress/wp-content/image-link')
		).toMatchObject({
			type: 'symlink',
			target: '../uploads/image.bin',
		});
		const database = entriesByPath.get(
			'/wordpress/wp-content/database/.ht.sqlite'
		);
		expect(database).toMatchObject({
			type: 'file',
			size: bytes('database').byteLength,
			hash: await hashBytes(bytes('database')),
		});
		expect(Array.from((database as any).bytes)).toEqual(
			Array.from(bytes('database'))
		);

		FS.writeFile('/wordpress/wp-content/database/.ht.sqlite', bytes('new'));

		expect(Array.from((database as any).bytes)).toEqual(
			Array.from(bytes('database'))
		);
	});

	it('diffs snapshots into create, update, delete, and metadata sets', async () => {
		const FS = createFakeFS({
			'/site/a.txt': bytes('a'),
			'/site/delete.txt': bytes('delete'),
			'/site/same.txt': bytes('same'),
			'/site/type-change': bytes('file'),
		});
		const before = await snapshotFilesystem(FS as any, '/site', {
			includeBytes: true,
			createdAt: '2026-06-25T00:00:00.000Z',
		});

		FS.writeFile('/site/a.txt', bytes('updated'));
		FS.unlink('/site/delete.txt');
		FS.unlink('/site/type-change');
		FS.mkdirTree('/site/type-change');
		FS.writeFile('/site/create.txt', bytes('create'));
		FS.symlink('same.txt', '/site/link');
		const after = await snapshotFilesystem(FS as any, '/site', {
			includeBytes: true,
			createdAt: '2026-06-25T00:00:01.000Z',
		});

		const delta = diffSnapshots(before, after, {
			includeUnchanged: true,
		});

		expect(delta.toSnapshotId).toBe(after.id);
		expect(delta.fromSnapshotId).toBe(before.id);
		expect(delta.create.map((entry) => entry.path)).toEqual([
			'/site/create.txt',
			'/site/link',
			'/site/type-change',
		]);
		expect(delta.update.map((entry) => entry.path)).toEqual([
			'/site/a.txt',
		]);
		expect(delta.delete).toEqual(['/site/delete.txt', '/site/type-change']);
		expect(delta.metadata).toEqual([]);
		expect(delta.unchanged?.map((entry) => entry.path)).toContain(
			'/site/same.txt'
		);
	});

	it('restores snapshots to another root', async () => {
		const source = createFakeFS({
			'/site/content/file.txt': bytes('file'),
		});
		source.symlink('content/file.txt', '/site/link');
		const snapshot = await snapshotFilesystem(source as any, '/site', {
			includeBytes: true,
			createdAt: '2026-06-25T00:00:00.000Z',
		});
		const target = createFakeFS({});

		await restoreFilesystemSnapshot(target as any, snapshot, '/restored');

		expect(text(target.readFile('/restored/content/file.txt'))).toBe(
			'file'
		);
		expect(target.readlink('/restored/link')).toBe('content/file.txt');
	});
});

type FakeEntry =
	| {
			type: 'directory';
			children: Map<string, FakeEntry>;
			mode: number;
	  }
	| {
			type: 'file';
			bytes: Uint8Array;
			mode: number;
	  }
	| {
			type: 'symlink';
			target: string;
			mode: number;
	  };

class FakeFS {
	private readonly root: FakeEntry = {
		type: 'directory',
		children: new Map(),
		mode: DIR_MODE,
	};

	constructor(files: Record<string, Uint8Array>) {
		for (const [path, contents] of Object.entries(files)) {
			this.writeFile(path, contents);
		}
	}

	lookupPath(path: string) {
		return {
			path: normalizeFakePath(path),
			node: this.getEntry(path),
		};
	}

	readdir(path: string) {
		const entry = this.getEntry(path);
		if (entry.type !== 'directory') {
			throw new Error(`Not a directory: ${path}`);
		}
		return ['.', '..', ...entry.children.keys()];
	}

	readFile(path: string) {
		const entry = this.getEntry(path);
		if (entry.type !== 'file') {
			throw new Error(`Not a file: ${path}`);
		}
		return new Uint8Array(entry.bytes);
	}

	writeFile(path: string, data: Uint8Array) {
		const parent = this.mkdirTree(parentPath(path));
		parent.children.set(baseName(path), {
			type: 'file',
			bytes: new Uint8Array(data),
			mode: FILE_MODE,
		});
	}

	mkdirTree(path: string) {
		let current = this.root;
		for (const part of pathParts(path)) {
			if (current.type !== 'directory') {
				throw new Error(`Not a directory: ${path}`);
			}
			let next = current.children.get(part);
			if (next === undefined) {
				next = {
					type: 'directory',
					children: new Map(),
					mode: DIR_MODE,
				};
				current.children.set(part, next);
			}
			current = next;
		}
		if (current.type !== 'directory') {
			throw new Error(`Not a directory: ${path}`);
		}
		return current;
	}

	unlink(path: string) {
		const parent = this.getEntry(parentPath(path));
		if (parent.type !== 'directory') {
			throw new Error(`Not a directory: ${path}`);
		}
		parent.children.delete(baseName(path));
	}

	symlink(target: string, path: string) {
		const parent = this.mkdirTree(parentPath(path));
		parent.children.set(baseName(path), {
			type: 'symlink',
			target,
			mode: LINK_MODE,
		});
	}

	readlink(path: string) {
		const entry = this.getEntry(path);
		if (entry.type !== 'symlink') {
			throw new Error(`Not a symlink: ${path}`);
		}
		return entry.target;
	}

	isDir(mode: number) {
		return (mode & 0o170000) === DIR_TYPE_MODE;
	}

	isFile(mode: number) {
		return (mode & 0o170000) === FILE_TYPE_MODE;
	}

	isLink(mode: number) {
		return (mode & 0o170000) === LINK_TYPE_MODE;
	}

	private getEntry(path: string) {
		let current = this.root;
		for (const part of pathParts(path)) {
			if (current.type !== 'directory') {
				throw new Error(`Not a directory: ${path}`);
			}
			const next = current.children.get(part);
			if (next === undefined) {
				throw new Error(`Path not found: ${path}`);
			}
			current = next;
		}
		return current;
	}
}

function createFakeFS(files: Record<string, Uint8Array>) {
	return new FakeFS(files);
}

function bytes(text: string) {
	return new TextEncoder().encode(text);
}

function text(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes);
}

function normalizeFakePath(path: string) {
	return `/${pathParts(path).join('/')}`;
}

function pathParts(path: string) {
	return path.split('/').filter(Boolean);
}

function parentPath(path: string) {
	const parts = pathParts(path);
	parts.pop();
	return `/${parts.join('/')}`;
}

function baseName(path: string) {
	return pathParts(path).at(-1) ?? '/';
}
