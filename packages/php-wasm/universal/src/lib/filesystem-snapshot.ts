import { dirname, joinPaths, normalizePath } from '@php-wasm/util';
import type { Emscripten } from './emscripten-types';

export const FILESYSTEM_SNAPSHOT_VERSION = 1;
const HASH_ALGORITHM = 'sha256';

export type SnapshotEntryType = 'file' | 'directory' | 'symlink';

export type SnapshotEntryBase = {
	path: string;
	type: SnapshotEntryType;
	mode?: number;
};

export type SnapshotFileEntry = SnapshotEntryBase & {
	type: 'file';
	size: number;
	hash: string;
	bytes?: Uint8Array;
};

export type SnapshotDirectoryEntry = SnapshotEntryBase & {
	type: 'directory';
};

export type SnapshotSymlinkEntry = SnapshotEntryBase & {
	type: 'symlink';
	target: string;
};

export type SnapshotEntry =
	| SnapshotFileEntry
	| SnapshotDirectoryEntry
	| SnapshotSymlinkEntry;

export type FilesystemSnapshot = {
	version: typeof FILESYSTEM_SNAPSHOT_VERSION;
	id: string;
	root: string;
	createdAt: string;
	parentId?: string;
	entries: SnapshotEntry[];
};

export type SnapshotFilesystemOptions = {
	includeBytes?: boolean;
	parentId?: string;
	createdAt?: string;
	ignoreUnsupportedNodes?: boolean;
	shouldIncludePath?: (
		path: string,
		type: SnapshotEntryType
	) => boolean | Promise<boolean>;
};

export type SnapshotDelta = {
	fromSnapshotId?: string;
	toSnapshotId: string;
	create: SnapshotEntry[];
	update: SnapshotFileEntry[];
	delete: string[];
	metadata: SnapshotEntry[];
	unchanged?: SnapshotEntry[];
};

export type DiffSnapshotsOptions = {
	includeUnchanged?: boolean;
};

export type RestoreFilesystemSnapshotOptions = {
	blobReader?: (entry: SnapshotFileEntry) => Promise<Uint8Array>;
};

export async function snapshotFilesystem(
	FS: Emscripten.RootFS,
	root: string,
	options: SnapshotFilesystemOptions = {}
): Promise<FilesystemSnapshot> {
	root = normalizeSnapshotPath(root);
	const entries = await snapshotEntries(FS, root, options);
	const snapshotWithoutId: Omit<FilesystemSnapshot, 'id'> = {
		version: FILESYSTEM_SNAPSHOT_VERSION,
		root,
		createdAt: options.createdAt ?? new Date().toISOString(),
		parentId: options.parentId,
		entries,
	};
	const id = await snapshotId(snapshotWithoutId);
	return {
		...snapshotWithoutId,
		id,
	};
}

export function stripSnapshotBytes(
	snapshot: FilesystemSnapshot
): FilesystemSnapshot {
	return {
		...snapshot,
		entries: snapshot.entries.map(stripEntryBytes),
	};
}

export function diffSnapshots(
	before: FilesystemSnapshot | undefined,
	after: FilesystemSnapshot,
	options: DiffSnapshotsOptions = {}
): SnapshotDelta {
	const beforeEntries = new Map<string, SnapshotEntry>();
	for (const entry of before?.entries ?? []) {
		beforeEntries.set(entry.path, entry);
	}

	const create: SnapshotEntry[] = [];
	const update: SnapshotFileEntry[] = [];
	const metadata: SnapshotEntry[] = [];
	const unchanged: SnapshotEntry[] = [];
	const seenAfter = new Set<string>();
	const deleted = new Set<string>();

	for (const afterEntry of after.entries) {
		seenAfter.add(afterEntry.path);
		const beforeEntry = beforeEntries.get(afterEntry.path);
		if (beforeEntry === undefined) {
			create.push(afterEntry);
			continue;
		}
		if (beforeEntry.type !== afterEntry.type) {
			deleted.add(beforeEntry.path);
			create.push(afterEntry);
			continue;
		}
		if (entryContentsChanged(beforeEntry, afterEntry)) {
			if (afterEntry.type === 'file') {
				update.push(afterEntry);
			} else {
				metadata.push(afterEntry);
			}
			continue;
		}
		if (entryMetadataChanged(beforeEntry, afterEntry)) {
			metadata.push(afterEntry);
			continue;
		}
		if (options.includeUnchanged) {
			unchanged.push(afterEntry);
		}
	}

	for (const path of beforeEntries.keys()) {
		if (!seenAfter.has(path)) {
			deleted.add(path);
		}
	}

	const delta: SnapshotDelta = {
		fromSnapshotId: before?.id,
		toSnapshotId: after.id,
		create,
		update,
		delete: Array.from(deleted).sort(deepestPathFirst),
		metadata,
	};
	if (options.includeUnchanged) {
		delta.unchanged = unchanged;
	}
	return delta;
}

export async function restoreFilesystemSnapshot(
	FS: Emscripten.RootFS,
	snapshot: FilesystemSnapshot,
	targetRoot = snapshot.root,
	options: RestoreFilesystemSnapshotOptions = {}
) {
	targetRoot = normalizeSnapshotPath(targetRoot);
	const entries = [...snapshot.entries].sort(shallowestPathFirst);
	for (const entry of entries) {
		const targetPath = mapSnapshotPathToTarget(
			snapshot.root,
			targetRoot,
			entry.path
		);
		if (entry.type === 'directory') {
			FS.mkdirTree(targetPath);
		} else if (entry.type === 'file') {
			FS.mkdirTree(dirname(targetPath));
			const bytes = await getEntryBytes(entry, options);
			FS.writeFile(targetPath, bytes);
		} else {
			FS.mkdirTree(dirname(targetPath));
			try {
				FS.unlink(targetPath);
			} catch {
				// It is fine if the link target does not exist yet.
			}
			FS.symlink(entry.target, targetPath);
		}
	}
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
	const digest = await sha256(bytes);
	return `${HASH_ALGORITHM}:${bytesToHex(digest)}`;
}

async function snapshotEntries(
	FS: Emscripten.RootFS,
	root: string,
	options: SnapshotFilesystemOptions
) {
	const entries: SnapshotEntry[] = [];
	const stack = [root];
	while (stack.length > 0) {
		const path = stack.pop()!;
		const entry = await snapshotEntry(FS, path, options);
		if (entry === undefined) {
			continue;
		}
		entries.push(entry);
		if (entry.type === 'directory') {
			const children = FS.readdir(path)
				.filter((name: string) => name !== '.' && name !== '..')
				.sort();
			for (let i = children.length - 1; i >= 0; i--) {
				stack.push(joinPaths(path, children[i]));
			}
		}
	}
	return entries;
}

async function snapshotEntry(
	FS: Emscripten.RootFS,
	path: string,
	options: SnapshotFilesystemOptions
): Promise<SnapshotEntry | undefined> {
	const lookup = FS.lookupPath(path, { follow: false });
	const { mode } = lookup.node;
	if (FS.isDir(mode)) {
		return maybeIncludeEntry(options, {
			type: 'directory',
			path,
			mode,
		});
	}
	if (FS.isLink(mode)) {
		return maybeIncludeEntry(options, {
			type: 'symlink',
			path,
			mode,
			target: FS.readlink(path),
		});
	}
	if (FS.isFile(mode)) {
		const bytes = copyBytes(
			FS.readFile(path, {
				encoding: 'binary',
			}) as Uint8Array
		);
		return maybeIncludeEntry(options, {
			type: 'file',
			path,
			mode,
			size: bytes.byteLength,
			hash: await hashBytes(bytes),
			...(options.includeBytes ? { bytes } : {}),
		});
	}
	if (options.ignoreUnsupportedNodes) {
		return undefined;
	}
	throw new Error(`Cannot snapshot unsupported filesystem node: ${path}`);
}

async function maybeIncludeEntry<T extends SnapshotEntry>(
	options: SnapshotFilesystemOptions,
	entry: T
) {
	if (!(await options.shouldIncludePath?.(entry.path, entry.type))) {
		if (options.shouldIncludePath !== undefined) {
			return undefined;
		}
	}
	return entry;
}

async function snapshotId(
	snapshot: Omit<FilesystemSnapshot, 'id'>
): Promise<string> {
	return await hashBytes(
		new TextEncoder().encode(
			JSON.stringify({
				version: snapshot.version,
				root: snapshot.root,
				parentId: snapshot.parentId,
				entries: snapshot.entries.map(stripEntryBytes),
			})
		)
	);
}

function stripEntryBytes(entry: SnapshotEntry): SnapshotEntry {
	if (entry.type !== 'file' || entry.bytes === undefined) {
		return { ...entry };
	}
	const entryWithoutBytes: SnapshotFileEntry = { ...entry };
	delete entryWithoutBytes.bytes;
	return entryWithoutBytes;
}

function entryContentsChanged(
	before: SnapshotEntry,
	after: SnapshotEntry
): boolean {
	if (before.type !== after.type) {
		return true;
	}
	if (before.type === 'file' && after.type === 'file') {
		return before.hash !== after.hash;
	}
	if (before.type === 'symlink' && after.type === 'symlink') {
		return before.target !== after.target;
	}
	return false;
}

function entryMetadataChanged(
	before: SnapshotEntry,
	after: SnapshotEntry
): boolean {
	return before.mode !== after.mode;
}

async function getEntryBytes(
	entry: SnapshotFileEntry,
	options: RestoreFilesystemSnapshotOptions
): Promise<Uint8Array> {
	if (entry.bytes !== undefined) {
		return entry.bytes;
	}
	if (options.blobReader !== undefined) {
		return await options.blobReader(entry);
	}
	throw new Error(
		`Cannot restore ${entry.path}: snapshot entry does not include bytes.`
	);
}

function normalizeSnapshotPath(path: string) {
	return normalizePath(path || '/');
}

function mapSnapshotPathToTarget(
	snapshotRoot: string,
	targetRoot: string,
	entryPath: string
) {
	if (entryPath === snapshotRoot) {
		return targetRoot;
	}
	return joinPaths(targetRoot, entryPath.substring(snapshotRoot.length));
}

function copyBytes(bytes: Uint8Array) {
	return new Uint8Array(bytes);
}

function shallowestPathFirst(a: SnapshotEntry, b: SnapshotEntry) {
	return (
		pathDepth(a.path) - pathDepth(b.path) || a.path.localeCompare(b.path)
	);
}

function deepestPathFirst(a: string, b: string) {
	return pathDepth(b) - pathDepth(a) || a.localeCompare(b);
}

function pathDepth(path: string) {
	return path.split('/').filter(Boolean).length;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
	if (globalThis.crypto?.subtle !== undefined) {
		const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
		return new Uint8Array(digest);
	}
	return sha256Sync(bytes);
}

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function sha256Sync(bytes: Uint8Array): Uint8Array {
	const constants = new Uint32Array(64);
	let prime = 2;
	let found = 0;
	while (found < constants.length) {
		if (isPrime(prime)) {
			const root = Math.cbrt(prime);
			const fraction = root - Math.floor(root);
			constants[found++] = Math.floor(fraction * 0x100000000);
		}
		prime++;
	}

	const hash = new Uint32Array([
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
		0x1f83d9ab, 0x5be0cd19,
	]);
	const padded = padSha256(bytes);
	const words = new Uint32Array(64);

	for (let offset = 0; offset < padded.length; offset += 64) {
		for (let i = 0; i < 16; i++) {
			words[i] =
				(padded[offset + i * 4] << 24) |
				(padded[offset + i * 4 + 1] << 16) |
				(padded[offset + i * 4 + 2] << 8) |
				padded[offset + i * 4 + 3];
		}
		for (let i = 16; i < 64; i++) {
			const s0 =
				rotateRight(words[i - 15], 7) ^
				rotateRight(words[i - 15], 18) ^
				(words[i - 15] >>> 3);
			const s1 =
				rotateRight(words[i - 2], 17) ^
				rotateRight(words[i - 2], 19) ^
				(words[i - 2] >>> 10);
			words[i] = words[i - 16] + s0 + words[i - 7] + s1;
		}

		let [a, b, c, d, e, f, g, h] = hash;
		for (let i = 0; i < 64; i++) {
			const s1 =
				rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
			const ch = (e & f) ^ (~e & g);
			const temp1 = h + s1 + ch + constants[i] + words[i];
			const s0 =
				rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const temp2 = s0 + maj;
			h = g;
			g = f;
			f = e;
			e = d + temp1;
			d = c;
			c = b;
			b = a;
			a = temp1 + temp2;
		}

		hash[0] += a;
		hash[1] += b;
		hash[2] += c;
		hash[3] += d;
		hash[4] += e;
		hash[5] += f;
		hash[6] += g;
		hash[7] += h;
	}

	const digest = new Uint8Array(32);
	for (let i = 0; i < hash.length; i++) {
		digest[i * 4] = hash[i] >>> 24;
		digest[i * 4 + 1] = hash[i] >>> 16;
		digest[i * 4 + 2] = hash[i] >>> 8;
		digest[i * 4 + 3] = hash[i];
	}
	return digest;
}

function padSha256(bytes: Uint8Array) {
	const bitLength = bytes.length * 8;
	const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
	const padded = new Uint8Array(paddedLength);
	padded.set(bytes);
	padded[bytes.length] = 0x80;
	const view = new DataView(padded.buffer);
	view.setUint32(paddedLength - 4, bitLength, false);
	return padded;
}

function rotateRight(value: number, bits: number) {
	return (value >>> bits) | (value << (32 - bits));
}

function isPrime(value: number) {
	for (let i = 2; i * i <= value; i++) {
		if (value % i === 0) {
			return false;
		}
	}
	return true;
}
