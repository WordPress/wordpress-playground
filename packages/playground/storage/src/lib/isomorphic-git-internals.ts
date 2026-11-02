/*
 * Portions of this file are adapted from isomorphic-git.
 *
 * Copyright 2017-2023 the 'isomorphic-git' authors
 * SPDX-License-Identifier: MIT
 */
import { Buffer as BufferPolyfill } from 'buffer';
import sha from 'sha.js';
import {
	indexPack,
	readObject as readIsomorphicGitObject,
} from 'isomorphic-git';

if (typeof globalThis.Buffer === 'undefined') {
	globalThis.Buffer = BufferPolyfill;
}

type GitObjectType = 'blob' | 'tree' | 'commit' | 'tag';

type GitIndexEntry = {
	filepath: string;
	oid: string;
	stats: {
		ctimeSeconds: number;
		ctimeNanoseconds: number;
		mtimeSeconds: number;
		mtimeNanoseconds: number;
		dev: number;
		ino: number;
		mode: number;
		uid: number;
		gid: number;
		size: number;
	};
};

export class ObjectTypeError extends Error {
	constructor(oid: string, actual: string, expected: string) {
		super(`Object ${oid} has type ${actual}, but expected ${expected}.`);
		this.name = 'ObjectTypeError';
	}
}

function padHex(bytes: number, value: number) {
	const hex = value.toString(16);
	return '0'.repeat(bytes - hex.length) + hex;
}

export class GitPktLine {
	static flush() {
		return Buffer.from('0000', 'utf8');
	}

	static delim() {
		return Buffer.from('0001', 'utf8');
	}

	static encode(line: string | Uint8Array) {
		const buffer = typeof line === 'string' ? Buffer.from(line) : line;
		return Buffer.concat([
			Buffer.from(padHex(4, buffer.length + 4), 'utf8'),
			Buffer.from(buffer),
		]);
	}

	static decode(data: Buffer) {
		const length = parseInt(data.subarray(0, 4).toString('utf8'), 16);
		return data.subarray(4, length).toString('utf8');
	}
}

function getIterator<T>(iterable: Iterable<T> | AsyncIterable<T>) {
	if (Symbol.asyncIterator in iterable) {
		return iterable[Symbol.asyncIterator]();
	}
	return iterable[Symbol.iterator]();
}

export async function collect(
	iterable: Iterable<Uint8Array> | AsyncIterable<Uint8Array>
) {
	let size = 0;
	const buffers: Uint8Array[] = [];
	const iterator = getIterator(iterable);
	while (true) {
		const { value, done } = await iterator.next();
		if (done) {
			break;
		}
		if (!value) {
			continue;
		}
		buffers.push(value);
		size += value.byteLength;
	}
	if (iterator.return) {
		await iterator.return();
	}

	const result = new Uint8Array(size);
	let offset = 0;
	for (const buffer of buffers) {
		result.set(buffer, offset);
		offset += buffer.byteLength;
	}
	return result;
}

export async function parseUploadPackResponse(
	stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>
) {
	const data = Buffer.from(await collect(stream));
	const packetlines: Buffer[] = [];
	const packfile: Buffer[] = [];
	const progress: Buffer[] = [];
	const shallows: string[] = [];
	const unshallows: string[] = [];
	const acks: Array<{ oid: string; status?: string }> = [];
	let nak = false;
	let offset = 0;

	while (offset + 4 <= data.length) {
		const length = parseInt(
			data.subarray(offset, offset + 4).toString('utf8'),
			16
		);
		offset += 4;
		if (length === 0 || length === 1) {
			continue;
		}
		if (Number.isNaN(length) || length < 4) {
			throw new Error('Invalid git packet line length.');
		}
		const payload = data.subarray(offset, offset + length - 4);
		offset += length - 4;
		const sideband = payload[0];

		if (sideband === 1) {
			packfile.push(payload.subarray(1));
			continue;
		}
		if (sideband === 2) {
			progress.push(payload.subarray(1));
			continue;
		}
		if (sideband === 3) {
			throw new Error(payload.subarray(1).toString('utf8'));
		}

		packetlines.push(payload);
	}

	for (const packetline of packetlines) {
		const line = packetline.toString('utf8').trim();
		if (line.startsWith('shallow')) {
			shallows.push(line.slice(-40).trim());
		} else if (line.startsWith('unshallow')) {
			unshallows.push(line.slice(-40).trim());
		} else if (line.startsWith('ACK')) {
			const [, oid, status] = line.split(' ');
			acks.push({ oid, status });
		} else if (line.startsWith('NAK')) {
			nak = true;
		}
	}

	return {
		shallows,
		unshallows,
		acks,
		nak,
		packfile,
		progress,
	};
}

function normalizePath(path: string) {
	const absolute = path.startsWith('/');
	const parts: string[] = [];
	for (const part of path.split(/[\\/]+/)) {
		if (!part || part === '.') {
			continue;
		}
		if (part === '..') {
			parts.pop();
			continue;
		}
		parts.push(part);
	}
	const normalized = parts.join('/');
	return absolute ? `/${normalized}` : normalized || '.';
}

function dirname(path: string) {
	const normalized = normalizePath(path);
	const index = normalized.lastIndexOf('/');
	if (index <= 0) {
		return normalized.startsWith('/') ? '/' : '.';
	}
	return normalized.slice(0, index);
}

function createStat(type: MemoryFsEntry['type']) {
	return {
		isFile: () => type === 'file',
		isDirectory: () => type === 'directory',
		isSymbolicLink: () => type === 'symlink',
	};
}

function createFsError(code: string, message: string) {
	const error = new Error(message) as Error & {
		code: string;
	};
	error.code = code;
	return error;
}

function createNotFoundError(path: string) {
	return createFsError(
		'ENOENT',
		`ENOENT: no such file or directory, ${path}`
	);
}

type MemoryFsEntry =
	| { type: 'directory' }
	| { type: 'file'; data: Buffer }
	| { type: 'symlink'; target: string };

class MemoryFs {
	private entries = new Map<string, MemoryFsEntry>([
		['/', { type: 'directory' }],
	]);

	constructor() {
		this.mkdirSync('/repo/.git/objects/pack');
		this.writeFileSync('/repo/.git/HEAD', 'ref: refs/heads/main\n');
	}

	private mkdirSync(path: string) {
		const normalized = normalizePath(path);
		if (normalized === '/') {
			this.entries.set('/', { type: 'directory' });
			return;
		}
		let current = '';
		for (const part of normalized.split('/').filter(Boolean)) {
			current += `/${part}`;
			this.entries.set(current, { type: 'directory' });
		}
	}

	private writeFileSync(path: string, data: string | Uint8Array) {
		const normalized = normalizePath(path);
		this.mkdirSync(dirname(normalized));
		this.entries.set(normalized, {
			type: 'file',
			data: Buffer.from(data),
		});
	}

	async readFile(
		path: string,
		options?: string | { encoding?: BufferEncoding }
	) {
		const normalized = normalizePath(path);
		const entry = this.getFileEntry(normalized);
		if (!entry || entry.type !== 'file') {
			throw createNotFoundError(normalized);
		}
		const encoding =
			typeof options === 'string' ? options : options?.encoding;
		return encoding
			? entry.data.toString(encoding as BufferEncoding)
			: Buffer.from(entry.data);
	}

	async writeFile(
		path: string,
		data: string | Uint8Array,
		options?: string | { encoding?: BufferEncoding }
	) {
		const normalized = normalizePath(path);
		this.mkdirSync(dirname(normalized));
		const encoding =
			typeof options === 'string' ? options : options?.encoding;
		this.entries.set(normalized, {
			type: 'file',
			data:
				typeof data === 'string'
					? Buffer.from(data, encoding as BufferEncoding | undefined)
					: Buffer.from(data),
		});
	}

	async mkdir(path: string) {
		this.mkdirSync(path);
	}

	async readdir(path: string) {
		const normalized = normalizePath(path);
		const entry = this.entries.get(normalized);
		if (!entry || entry.type !== 'directory') {
			throw createNotFoundError(normalized);
		}
		const children = new Set<string>();
		const prefix = normalized === '/' ? '/' : `${normalized}/`;
		for (const key of this.entries.keys()) {
			if (!key.startsWith(prefix) || key === normalized) {
				continue;
			}
			const child = key.slice(prefix.length).split('/')[0];
			if (child) {
				children.add(child);
			}
		}
		return [...children].sort();
	}

	async stat(path: string) {
		const normalized = normalizePath(path);
		const entry = this.getResolvedEntry(normalized);
		if (!entry) {
			throw createNotFoundError(normalized);
		}
		return createStat(entry.type);
	}

	async lstat(path: string) {
		const normalized = normalizePath(path);
		const entry = this.entries.get(normalized);
		if (!entry) {
			throw createNotFoundError(normalized);
		}
		return createStat(entry.type);
	}

	async unlink(path: string) {
		const normalized = normalizePath(path);
		const entry = this.entries.get(normalized);
		if (!entry || (entry.type !== 'file' && entry.type !== 'symlink')) {
			throw createNotFoundError(normalized);
		}
		this.entries.delete(normalized);
	}

	async rmdir(path: string) {
		const normalized = normalizePath(path);
		const prefix = normalized === '/' ? '/' : `${normalized}/`;
		for (const key of this.entries.keys()) {
			if (key.startsWith(prefix) && key !== normalized) {
				throw new Error(
					`ENOTEMPTY: directory not empty, ${normalized}`
				);
			}
		}
		this.entries.delete(normalized);
	}

	async rm(path: string) {
		this.entries.delete(normalizePath(path));
	}

	async readlink(path: string) {
		const normalized = normalizePath(path);
		const entry = this.entries.get(normalized);
		if (!entry || entry.type !== 'symlink') {
			throw createNotFoundError(normalized);
		}
		return entry.target;
	}

	async symlink(target: string, path: string) {
		const normalized = normalizePath(path);
		this.mkdirSync(dirname(normalized));
		this.entries.set(normalized, {
			type: 'symlink',
			target,
		});
	}

	private getFileEntry(path: string): MemoryFsEntry | undefined {
		const entry = this.entries.get(path);
		if (entry?.type !== 'symlink') {
			return entry;
		}
		return this.getResolvedEntry(path);
	}

	private getResolvedEntry(
		path: string,
		seen = new Set<string>()
	): MemoryFsEntry | undefined {
		const entry = this.entries.get(path);
		if (entry?.type !== 'symlink') {
			return entry;
		}
		if (seen.has(path)) {
			throw createFsError(
				'ELOOP',
				`ELOOP: too many symbolic links, ${path}`
			);
		}
		seen.add(path);
		const targetPath = entry.target.startsWith('/')
			? entry.target
			: normalizePath(`${dirname(path)}/${entry.target}`);
		return this.getResolvedEntry(targetPath, seen);
	}
}

function parsePackIndex(index: Buffer) {
	const hashCount = index.readUInt32BE(8 + 255 * 4);
	const hashes: string[] = [];
	const offsets = new Map<string, number>();
	let cursor = 8 + 256 * 4;

	for (let i = 0; i < hashCount; i++) {
		hashes.push(index.subarray(cursor, cursor + 20).toString('hex'));
		cursor += 20;
	}

	cursor += hashCount * 4;
	const offsetCursor = cursor;
	cursor += hashCount * 4;
	const largeOffsetCursor = cursor;

	for (let i = 0; i < hashCount; i++) {
		const offset = index.readUInt32BE(offsetCursor + i * 4);
		if (offset & 0x80000000) {
			const tableIndex = offset & 0x7fffffff;
			const largeOffset = Number(
				index.readBigUInt64BE(largeOffsetCursor + tableIndex * 8)
			);
			offsets.set(hashes[i], largeOffset);
		} else {
			offsets.set(hashes[i], offset);
		}
	}

	return {
		hashes,
		offsets,
		packfileSha: index
			.subarray(index.length - 40, index.length - 20)
			.toString('hex'),
	};
}

const repoDir = '/repo';
const gitDir = '/repo/.git';
const packPath = '/repo/.git/objects/pack/pack.playground.pack';
const packFilepath = '.git/objects/pack/pack.playground.pack';
const indexPath = '/repo/.git/objects/pack/pack.playground.idx';

export class GitPackIndex {
	hashes: string[];
	offsets: Map<string, number>;
	packfileSha: string;
	private fs: MemoryFs;
	private cache = {};
	private indexBuffer: Buffer;
	private offsetToOid: Map<number, string>;

	private constructor({
		fs,
		indexBuffer,
		hashes,
		offsets,
		packfileSha,
		offsetToOid,
	}: {
		fs: MemoryFs;
		indexBuffer: Buffer;
		hashes: string[];
		offsets: Map<string, number>;
		packfileSha: string;
		offsetToOid?: Map<number, string>;
	}) {
		this.fs = fs;
		this.indexBuffer = indexBuffer;
		this.hashes = hashes;
		this.offsets = offsets;
		this.packfileSha = packfileSha;
		this.offsetToOid =
			offsetToOid ??
			new Map([...offsets].map(([oid, offset]) => [offset, oid]));
	}

	static async fromPack({ pack }: { pack: Buffer | Uint8Array }) {
		const fs = new MemoryFs();
		const packBuffer = Buffer.from(pack);
		await fs.writeFile(packPath, packBuffer);

		if (packBuffer.byteLength === 0) {
			return new GitPackIndex({
				fs,
				indexBuffer: Buffer.alloc(0),
				hashes: [],
				offsets: new Map(),
				packfileSha: '',
			});
		}

		await indexPack({
			fs: fs as any,
			dir: repoDir,
			gitdir: gitDir,
			filepath: packFilepath,
			cache: {},
		});
		const indexBuffer = (await fs.readFile(indexPath)) as Buffer;
		const parsed = parsePackIndex(indexBuffer);

		return new GitPackIndex({
			fs,
			indexBuffer,
			...parsed,
		});
	}

	async read({ oid }: { oid: string }): Promise<any> {
		const result = (await readIsomorphicGitObject({
			fs: this.fs as any,
			dir: repoDir,
			gitdir: gitDir,
			oid,
			format: 'content',
			cache: this.cache,
		})) as {
			type: GitObjectType;
			format: 'content';
			object: Uint8Array;
		};

		return {
			oid,
			type: result.type,
			format: result.format,
			object: Buffer.from(result.object),
		};
	}

	async readSlice({ start }: { start: number }) {
		const oid = this.offsetToOid.get(start);
		if (oid) {
			return this.read({ oid });
		}
		throw new Error(`Could not read object at packfile offset ${start}.`);
	}

	async toBuffer() {
		return Buffer.from(this.indexBuffer);
	}
}

function compareStrings(a: string, b: string) {
	if (a < b) {
		return -1;
	}
	if (a > b) {
		return 1;
	}
	return 0;
}

function comparePath(a: { path: string }, b: { path: string }) {
	return compareStrings(a.path, b.path);
}

export class GitIndex {
	private entries = new Map<
		string,
		GitIndexEntry & {
			path: string;
			flags: {
				assumeValid: boolean;
				extended: boolean;
				stage: number;
				nameLength: number;
			};
		}
	>();

	insert({ filepath, oid, stats }: GitIndexEntry) {
		const pathBuffer = Buffer.from(filepath);
		this.entries.set(filepath, {
			filepath,
			path: filepath,
			oid,
			stats,
			flags: {
				assumeValid: false,
				extended: false,
				stage: 0,
				nameLength:
					pathBuffer.length < 0xfff ? pathBuffer.length : 0xfff,
			},
		});
	}

	private renderFlags(entry: {
		flags: {
			assumeValid: boolean;
			extended: boolean;
			stage: number;
			nameLength: number;
		};
	}) {
		return (
			(entry.flags.assumeValid ? 0b1000000000000000 : 0) +
			(entry.flags.extended ? 0b0100000000000000 : 0) +
			((entry.flags.stage & 0b11) << 12) +
			(entry.flags.nameLength & 0b111111111111)
		);
	}

	private entryToBuffer(entry: {
		path: string;
		oid: string;
		stats: GitIndexEntry['stats'];
		flags: {
			assumeValid: boolean;
			extended: boolean;
			stage: number;
			nameLength: number;
		};
	}) {
		const pathBuffer = Buffer.from(entry.path);
		const length = Math.ceil((62 + pathBuffer.length + 1) / 8) * 8;
		const buffer = Buffer.alloc(length);
		let offset = 0;
		const writeUInt32BE = (value: number) => {
			buffer.writeUInt32BE(value, offset);
			offset += 4;
		};

		writeUInt32BE(entry.stats.ctimeSeconds);
		writeUInt32BE(entry.stats.ctimeNanoseconds);
		writeUInt32BE(entry.stats.mtimeSeconds);
		writeUInt32BE(entry.stats.mtimeNanoseconds);
		writeUInt32BE(entry.stats.dev);
		writeUInt32BE(entry.stats.ino);
		writeUInt32BE(entry.stats.mode || 0o100644);
		writeUInt32BE(entry.stats.uid);
		writeUInt32BE(entry.stats.gid);
		writeUInt32BE(entry.stats.size);
		Buffer.from(entry.oid, 'hex').copy(buffer, offset);
		offset += 20;
		buffer.writeUInt16BE(this.renderFlags(entry), offset);
		offset += 2;
		pathBuffer.copy(buffer, offset);
		return buffer;
	}

	async toObject() {
		const header = Buffer.alloc(12);
		header.write('DIRC', 0, 4, 'utf8');
		header.writeUInt32BE(2, 4);
		header.writeUInt32BE(this.entries.size, 8);

		const body = Buffer.concat(
			[...this.entries.values()]
				.sort(comparePath)
				.map((entry) => this.entryToBuffer(entry))
		);
		const main = Buffer.concat([header, body]);
		const checksum = sha1(main);
		return Buffer.concat([main, checksum]);
	}
}

function sha1(data: Uint8Array) {
	return Buffer.from(sha('sha1').update(data).digest('hex'), 'hex');
}

function parseAuthor(value?: string) {
	const match = value?.match(/^(.*) <(.*)> (.*) (.*)$/);
	if (!match) {
		return {
			name: '',
			email: '',
			timestamp: 0,
			timezoneOffset: 0,
		};
	}
	return {
		name: match[1],
		email: match[2],
		timestamp: Number(match[3]),
		timezoneOffset: 0,
	};
}

function parseHeaders(payload: string) {
	const [rawHeaders, ...messageParts] = payload.split('\n\n');
	const lines: string[] = [];
	for (const line of rawHeaders.split('\n')) {
		if (line.startsWith(' ') && lines.length > 0) {
			lines[lines.length - 1] += `\n${line.slice(1)}`;
		} else {
			lines.push(line);
		}
	}

	const headers: Record<string, string | string[]> = {};
	for (const line of lines) {
		const separator = line.indexOf(' ');
		if (separator === -1) {
			continue;
		}
		const key = line.slice(0, separator);
		const value = line.slice(separator + 1);
		if (key === 'parent') {
			const parents = headers['parent'];
			headers['parent'] = Array.isArray(parents)
				? [...parents, value]
				: parents
					? [parents, value]
					: [value];
		} else {
			headers[key] = value;
		}
	}

	return {
		headers,
		message: messageParts.join('\n\n'),
	};
}

export class GitCommit {
	private payload: string;

	private constructor(buffer: Buffer | Uint8Array) {
		this.payload = Buffer.from(buffer).toString('utf8');
	}

	static from(buffer: Buffer | Uint8Array) {
		return new GitCommit(buffer);
	}

	parse() {
		const { headers, message } = parseHeaders(this.payload);
		const parents = headers['parent'];
		return {
			tree: String(headers['tree'] ?? ''),
			parent: Array.isArray(parents)
				? parents
				: parents
					? [String(parents)]
					: [],
			author: parseAuthor(String(headers['author'] ?? '')),
			committer: parseAuthor(String(headers['committer'] ?? '')),
			message,
			gpgsig:
				typeof headers['gpgsig'] === 'string'
					? headers['gpgsig']
					: undefined,
		};
	}
}

function modeToType(mode: string): 'blob' | 'tree' | 'commit' {
	if (mode === '160000') {
		return 'commit';
	}
	return mode.match(/^0?4/) ? 'tree' : 'blob';
}

export class GitTree {
	object: Array<{
		mode: string;
		path: string;
		oid: string;
		type: 'blob' | 'tree' | 'commit';
		object?: GitTree;
	}>;

	private constructor(buffer: Buffer | Uint8Array) {
		const entries = [];
		const payload = Buffer.from(buffer);
		let cursor = 0;
		while (cursor < payload.length) {
			const space = payload.indexOf(32, cursor);
			const nullchar = payload.indexOf(0, cursor);
			if (space === -1 || nullchar === -1) {
				throw new Error('Invalid Git tree object.');
			}
			let mode = payload.subarray(cursor, space).toString('utf8');
			if (mode === '40000') {
				mode = '040000';
			}
			const path = payload.subarray(space + 1, nullchar).toString('utf8');
			const oid = payload
				.subarray(nullchar + 1, nullchar + 21)
				.toString('hex');
			entries.push({
				mode,
				path,
				oid,
				type: modeToType(mode),
			});
			cursor = nullchar + 21;
		}
		this.object = entries.sort(comparePath);
	}

	static from(buffer: Buffer | Uint8Array) {
		return new GitTree(buffer);
	}

	entries() {
		return this.object;
	}
}

export class GitAnnotatedTag {
	private payload: string;

	private constructor(buffer: Buffer | Uint8Array) {
		this.payload = Buffer.from(buffer).toString('utf8');
	}

	static from(buffer: Buffer | Uint8Array) {
		return new GitAnnotatedTag(buffer);
	}

	parse() {
		const { headers, message } = parseHeaders(this.payload);
		return {
			object: String(headers['object'] ?? ''),
			type: String(headers['type'] ?? ''),
			tag: String(headers['tag'] ?? ''),
			tagger: parseAuthor(String(headers['tagger'] ?? '')),
			message,
			signature:
				typeof headers['signature'] === 'string'
					? headers['signature']
					: undefined,
		};
	}
}
