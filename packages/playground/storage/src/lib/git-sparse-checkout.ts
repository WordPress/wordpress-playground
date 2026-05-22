import {
	indexPack,
	init,
	readObject,
	type CommitObject,
	type TreeEntry,
	type TreeObject,
} from 'isomorphic-git';
import { Buffer as BufferPolyfill } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
	globalThis.Buffer = BufferPolyfill;
}

/**
 * Custom error class for git authentication failures.
 */
export class GitAuthenticationError extends Error {
	public repoUrl: string;
	public status: number;

	constructor(repoUrl: string, status: number) {
		super(
			`Authentication required to access private repository: ${repoUrl}`
		);
		this.name = 'GitAuthenticationError';
		this.repoUrl = repoUrl;
		this.status = status;
	}
}

export type GitAdditionalHeaders = Record<string, string>;

/**
 * Downloads specific files from a git repository.
 * It uses the git protocol over HTTP to fetch the files. It only uses
 * three HTTP requests regardless of the number of paths requested.
 *
 * @param repoUrl The URL of the Git repository.
 * @param commitHash The commit hash to fetch from.
 * @param filesPaths An array of all the file paths to fetch from the repository. Does **not** accept
 *                   patterns, wildcards, directory paths. All files must be explicitly listed.
 * @returns The requested files and packfiles required to recreate the Git objects locally.
 */
export type SparseCheckoutPackfile = {
	name: string;
	pack: Uint8Array;
	index: Uint8Array;
	promisor?: boolean;
};

export type SparseCheckoutObject = {
	oid: string;
	type: 'blob' | 'tree' | 'commit' | 'tag';
	body: Uint8Array;
};

export type SparseCheckoutResult = {
	files: Record<string, any>;
	packfiles?: SparseCheckoutPackfile[];
	objects?: SparseCheckoutObject[];
	fileOids?: Record<string, string>;
};

type IndexedPack = {
	fs: MemoryFsClient;
	dir: string;
	packfilePath: string;
	indexPath: string;
	name: string;
	packfile: Uint8Array;
	oids: string[];
	promisor: boolean;
};

/**
 * A Git ref in a human-readable format. Could be a single string,
 * e.g. 'main', 'v0.1.28', '1234567890abcdef1234567890abcdef12345678',
 * could be a string and an explicit type, e.g. { value: 'main', type: 'branch' },
 */
export type GitRef = {
	value: string;
	type?: 'branch' | 'commit' | 'refname' | 'tag' | 'infer';
};

/**
 * A Git ref in a machine-friendly format.
 * Contains all the information needed to resolve the ref to its oid,
 * and, optionally, the oid itself.
 */
type ParsedGitRef = {
	kind: 'refname' | 'commit';
	refname: string;
	resolvedOid?: string;
};

export type GitFileTreeFile = {
	name: string;
	type: 'file';
};
export type GitFileTreeFolder = {
	name: string;
	type: 'folder';
	children: GitFileTree[];
};
export type GitFileTree = GitFileTreeFile | GitFileTreeFolder;

const FULL_SHA_REGEX = /^[0-9a-f]{40}$/i;
const WORKDIR = '/repo';

export async function sparseCheckout(
	repoUrl: string,
	commitHash: string,
	filesPaths: string[],
	options?: {
		withObjects?: boolean;
		additionalHeaders?: GitAdditionalHeaders;
	}
): Promise<SparseCheckoutResult> {
	const additionalHeaders = options?.additionalHeaders || {};
	const treesPack = await fetchWithoutBlobs(
		repoUrl,
		commitHash,
		additionalHeaders
	);
	const objects = await resolveObjects(treesPack, commitHash, filesPaths);
	const blobOids = filesPaths.map((path) => objects[path].oid);
	const blobsPack =
		blobOids.length > 0
			? await fetchObjects(repoUrl, blobOids, additionalHeaders)
			: null;

	const fetchedPaths: Record<string, any> = {};
	await Promise.all(
		filesPaths.map(async (path) => {
			if (!blobsPack) {
				return;
			}
			fetchedPaths[path] = await readGitObjectContent(
				blobsPack,
				objects[path].oid,
				'blob'
			);
		})
	);

	if (!options?.withObjects) {
		return { files: fetchedPaths };
	}

	const fileOids: Record<string, string> = {};
	for (const path of filesPaths) {
		fileOids[path] = objects[path].oid;
	}

	return {
		files: fetchedPaths,
		packfiles: [
			await getSparseCheckoutPackfile(treesPack),
			...(blobsPack ? [await getSparseCheckoutPackfile(blobsPack)] : []),
		],
		objects: [
			...(await collectLooseObjects(treesPack)),
			...(await collectLooseObjects(blobsPack)),
		],
		fileOids,
	};
}

/**
 * Lists all files in a git repository.
 *
 * See https://git-scm.com/book/en/v2/Git-Internals-Git-Objects for more information.
 *
 * @param repoUrl The URL of the git repository.
 * @param commitHash The commit hash to fetch from.
 * @returns A list of all files in the repository.
 */
export async function listGitFiles(
	repoUrl: string,
	commitHash: string,
	additionalHeaders: GitAdditionalHeaders = {},
	path = ''
): Promise<GitFileTree[]> {
	const treesPack = await fetchWithoutBlobs(
		repoUrl,
		commitHash,
		additionalHeaders
	);
	const rootTree = await resolveRootTree(treesPack, commitHash);
	const normalizedPath = path.replace(/^\/+|\/+$/g, '');
	if (!normalizedPath) {
		return gitTreeToFileTree(treesPack, rootTree);
	}
	const entry = await resolveTreeEntry(treesPack, rootTree, normalizedPath);
	if (entry.type === 'blob') {
		return [
			{
				name: entry.path,
				type: 'file',
			},
		];
	}
	return gitTreeToFileTree(
		treesPack,
		await readParsedObject<TreeObject>(treesPack, entry.oid, 'tree')
	);
}

/**
 * Resolves a ref description, e.g. a branch name, to a commit hash.
 *
 * @param repoUrl The URL of the git repository.
 * @param ref The branch name or commit hash.
 * @returns The commit hash.
 */
export async function resolveCommitHash(
	repoUrl: string,
	ref: GitRef,
	additionalHeaders: GitAdditionalHeaders = {}
) {
	const parsed = await parseGitRef(repoUrl, ref, additionalHeaders);
	if (parsed.resolvedOid) {
		return parsed.resolvedOid;
	}

	const oid = await fetchRefOid(repoUrl, parsed.refname, additionalHeaders);
	if (!oid) {
		throw new Error(`Git ref "${parsed.refname}" not found at ${repoUrl}`);
	}
	return oid;
}

/**
 * Retrieves a list of refs from a git repository.
 *
 * See https://git-scm.com/book/en/v2/Git-Internals-Git-References for more information.
 *
 * @param repoUrl The URL of the Git repository.
 * @param fullyQualifiedBranchPrefix The prefix of the refs to fetch.
 * @returns A map of refs to their corresponding commit hashes.
 */
export async function listGitRefs(
	repoUrl: string,
	fullyQualifiedBranchPrefix: string,
	additionalHeaders: GitAdditionalHeaders = {}
) {
	const body = concatUint8Arrays([
		pktLine('command=ls-refs\n'),
		pktLine('agent=git/2.37.3\n'),
		pktLine('object-format=sha1\n'),
		delimPkt(),
		pktLine('peel\n'),
		pktLine(`ref-prefix ${fullyQualifiedBranchPrefix}\n`),
		flushPkt(),
	]);
	const response = await fetch(`${repoUrl}/git-upload-pack`, {
		method: 'POST',
		headers: {
			Accept: 'application/x-git-upload-pack-advertisement',
			'content-type': 'application/x-git-upload-pack-request',
			'Content-Length': `${body.byteLength}`,
			'Git-Protocol': 'version=2',
			...additionalHeaders,
		},
		body: BufferPolyfill.from(body),
	});

	if (!response.ok) {
		throw mapGitHttpStatus(
			repoUrl,
			response.status,
			response.statusText,
			'refs'
		);
	}

	const result: Record<string, string> = {};
	for (const line of parseGitResponseLines(
		await collectAsyncIterable(getResponseBody(response))
	)) {
		const [oid, ref, ...attrs] = line.split(' ');
		let peeled: string | undefined;
		for (const attr of attrs) {
			const [name, value] = attr.split(':');
			if (name === 'peeled') {
				peeled = value;
			}
		}
		result[ref] = peeled ?? oid;
	}
	return result;
}

async function parseGitRef(
	repoUrl: string,
	ref: GitRef,
	additionalHeaders: GitAdditionalHeaders
): Promise<ParsedGitRef> {
	const type = ref.type ?? 'infer';
	switch (type) {
		case 'commit':
			return {
				kind: 'commit',
				refname: ref.value,
				resolvedOid: ref.value,
			};
		case 'branch':
			return {
				kind: 'refname',
				refname: `refs/heads/${ref.value.trim()}`,
			};
		case 'tag':
			return {
				kind: 'refname',
				refname: `refs/tags/${ref.value.trim()}`,
			};
		case 'refname':
			return {
				kind: 'refname',
				refname: ref.value.trim(),
			};
		case 'infer': {
			const trimmed = ref.value.trim();
			if (trimmed === '' || trimmed === 'HEAD') {
				return {
					kind: 'refname',
					refname: 'HEAD',
				};
			}
			if (trimmed.startsWith('refs/')) {
				return {
					kind: 'refname',
					refname: trimmed,
				};
			}
			if (FULL_SHA_REGEX.test(trimmed)) {
				return {
					kind: 'commit',
					refname: trimmed,
					resolvedOid: trimmed,
				};
			}

			const branchRef = `refs/heads/${trimmed}`;
			const branchOid = await fetchRefOid(
				repoUrl,
				branchRef,
				additionalHeaders
			);
			if (branchOid) {
				return {
					kind: 'refname',
					refname: branchRef,
					resolvedOid: branchOid,
				};
			}

			const tagRef = `refs/tags/${trimmed}`;
			const tagOid = await fetchRefOid(
				repoUrl,
				tagRef,
				additionalHeaders
			);
			if (tagOid) {
				return {
					kind: 'refname',
					refname: tagRef,
					resolvedOid: tagOid,
				};
			}
			throw new Error(`Git ref "${ref.value}" not found at ${repoUrl}`);
		}
		default:
			throw new Error(`Invalid ref type: ${ref.type}`);
	}
}

async function fetchRefOid(
	repoUrl: string,
	refname: string,
	additionalHeaders: GitAdditionalHeaders
) {
	const refs = await listGitRefs(repoUrl, refname, additionalHeaders);
	const candidates = [refname, `${refname}^{}`];
	for (const candidate of candidates) {
		const sanitized = candidate.trim();
		if (sanitized in refs) {
			return refs[sanitized];
		}
	}
	return null;
}

async function fetchWithoutBlobs(
	repoUrl: string,
	commitHash: string,
	additionalHeaders: GitAdditionalHeaders
): Promise<IndexedPack> {
	return fetchAndIndexPack({
		repoUrl,
		additionalHeaders,
		body: createTreeFetchRequest(commitHash),
		promisor: true,
	});
}

async function fetchObjects(
	repoUrl: string,
	objectHashes: string[],
	additionalHeaders: GitAdditionalHeaders
): Promise<IndexedPack> {
	return fetchAndIndexPack({
		repoUrl,
		additionalHeaders,
		body: createObjectFetchRequest(objectHashes),
		promisor: false,
	});
}

async function fetchAndIndexPack({
	repoUrl,
	additionalHeaders,
	body,
	promisor,
}: {
	repoUrl: string;
	additionalHeaders: GitAdditionalHeaders;
	body: Uint8Array;
	promisor: boolean;
}): Promise<IndexedPack> {
	const response = await fetch(`${repoUrl}/git-upload-pack`, {
		method: 'POST',
		headers: {
			Accept: 'application/x-git-upload-pack-advertisement',
			'content-type': 'application/x-git-upload-pack-request',
			'Content-Length': `${body.byteLength}`,
			...additionalHeaders,
		},
		body: BufferPolyfill.from(body),
	});

	if (!response.ok) {
		throw mapGitHttpStatus(
			repoUrl,
			response.status,
			response.statusText,
			'objects'
		);
	}

	const uploadPackResponse = await collectAsyncIterable(
		getResponseBody(response)
	);
	const packfile = parseUploadPackResponse(uploadPackResponse);
	if (packfile.length === 0) {
		const responsePreview = decodeUtf8(uploadPackResponse.subarray(0, 120));
		throw new Error(
			`Git upload-pack response did not contain a packfile (${response.status} ${response.statusText}, ${uploadPackResponse.byteLength} bytes).${
				responsePreview
					? ` Response starts with: ${responsePreview}`
					: ''
			}`
		);
	}

	const fs = new MemoryFsClient();
	await init({ fs: fs as any, dir: WORKDIR, defaultBranch: 'trunk' });

	const name = `pack-${await sha1(packfile)}`;
	const packfilePath = `.git/objects/pack/${name}.pack`;
	const indexPath = `.git/objects/pack/${name}.idx`;
	await fs.promises.writeFile(`${WORKDIR}/${packfilePath}`, packfile);
	const { oids } = await indexPack({
		fs: fs as any,
		dir: WORKDIR,
		filepath: packfilePath,
	});

	return {
		fs,
		dir: WORKDIR,
		name,
		packfilePath,
		indexPath,
		packfile,
		oids,
		promisor,
	};
}

async function resolveObjects(
	pack: IndexedPack,
	commitHash: string,
	paths: string[]
) {
	const rootTree = await resolveRootTree(pack, commitHash);
	const resolvedOids: Record<string, TreeEntry> = {};

	for (const path of paths) {
		const entry = await resolveTreeEntry(pack, rootTree, path);
		if (entry.type !== 'blob') {
			throw new Error(`Expected ${path} to resolve to a Git blob.`);
		}
		resolvedOids[path] = entry;
	}
	return resolvedOids;
}

async function resolveRootTree(pack: IndexedPack, commitHash: string) {
	const commit = await readParsedObject<CommitObject>(
		pack,
		commitHash,
		'commit'
	);
	return readParsedObject<TreeObject>(pack, commit.tree, 'tree');
}

async function resolveTreeEntry(
	pack: IndexedPack,
	rootTree: TreeObject,
	filepath: string
): Promise<TreeEntry> {
	let currentTree = rootTree;
	const segments = filepath.split('/');

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		const entry = currentTree.find((item) => item.path === segment);
		if (!entry) {
			throw new Error(`Path not found in the repo: ${filepath}`);
		}
		const isLastSegment = i === segments.length - 1;
		if (isLastSegment) {
			return entry;
		}
		if (entry.type !== 'tree') {
			throw new Error(`Path not found in the repo: ${filepath}`);
		}
		currentTree = await readParsedObject<TreeObject>(
			pack,
			entry.oid,
			'tree'
		);
	}

	throw new Error(`Path not found in the repo: ${filepath}`);
}

async function gitTreeToFileTree(
	pack: IndexedPack,
	tree: TreeObject
): Promise<GitFileTree[]> {
	return Promise.all(
		tree.map(async (branch) => {
			if (branch.type === 'blob') {
				return {
					name: branch.path,
					type: 'file',
				} as GitFileTreeFile;
			}
			if (branch.type === 'tree') {
				return {
					name: branch.path,
					type: 'folder',
					children: await gitTreeToFileTree(
						pack,
						await readParsedObject<TreeObject>(
							pack,
							branch.oid,
							'tree'
						)
					),
				} as GitFileTreeFolder;
			}
			return undefined;
		})
	).then(
		(entries) => entries.filter((entry) => !!entry?.name) as GitFileTree[]
	);
}

async function readParsedObject<T>(
	pack: IndexedPack,
	oid: string,
	expectedType: 'commit' | 'tree'
): Promise<T> {
	const result = await readObject({
		fs: pack.fs as any,
		dir: pack.dir,
		oid,
		format: 'parsed',
	});
	if (result.type !== expectedType) {
		throw new Error(
			`Expected ${oid} to be a ${expectedType}, got ${result.type}.`
		);
	}
	return result.object as T;
}

async function readGitObjectContent(
	pack: IndexedPack,
	oid: string,
	expectedType?: SparseCheckoutObject['type']
): Promise<Uint8Array> {
	const result = await readObject({
		fs: pack.fs as any,
		dir: pack.dir,
		oid,
		format: 'content',
	});
	if (expectedType && result.type !== expectedType) {
		throw new Error(
			`Expected ${oid} to be a ${expectedType}, got ${result.type}.`
		);
	}
	return toUint8Array(result.object as Uint8Array);
}

async function getSparseCheckoutPackfile(
	pack: IndexedPack
): Promise<SparseCheckoutPackfile> {
	const index = await pack.fs.promises.readFile(
		`${WORKDIR}/${pack.indexPath}`
	);
	return {
		name: pack.name,
		pack: pack.packfile,
		index:
			typeof index === 'string'
				? new TextEncoder().encode(index)
				: toUint8Array(index),
		promisor: pack.promisor,
	};
}

async function collectLooseObjects(
	pack?: IndexedPack | null
): Promise<SparseCheckoutObject[]> {
	if (!pack) {
		return [];
	}
	const results: SparseCheckoutObject[] = [];
	for (const oid of pack.oids) {
		const result = await readObject({
			fs: pack.fs as any,
			dir: pack.dir,
			oid,
			format: 'content',
		});
		if (!['blob', 'tree', 'commit', 'tag'].includes(result.type)) {
			continue;
		}
		results.push({
			oid,
			type: result.type as SparseCheckoutObject['type'],
			body: toUint8Array(result.object as Uint8Array),
		});
	}
	return results;
}

function createTreeFetchRequest(commitHash: string): Uint8Array {
	return concatUint8Arrays([
		pktLine(
			`want ${commitHash} multi_ack_detailed no-done side-band-64k thin-pack ofs-delta agent=git/2.37.3 filter \n`
		),
		pktLine('filter blob:none\n'),
		pktLine(`shallow ${commitHash}\n`),
		pktLine('deepen 1\n'),
		flushPkt(),
		pktLine('done\n'),
		pktLine('done\n'),
	]);
}

function createObjectFetchRequest(objectHashes: string[]): Uint8Array {
	return concatUint8Arrays([
		...objectHashes.map((objectHash) =>
			pktLine(
				`want ${objectHash} multi_ack_detailed no-done side-band-64k thin-pack ofs-delta agent=git/2.37.3 \n`
			)
		),
		flushPkt(),
		pktLine('done\n'),
	]);
}

function parseUploadPackResponse(response: Uint8Array): Uint8Array {
	const packChunks: Uint8Array[] = [];
	let offset = 0;

	while (offset + 4 <= response.length) {
		const lineLength = Number.parseInt(
			decodeAscii(response.subarray(offset, offset + 4)),
			16
		);
		offset += 4;
		if (!Number.isFinite(lineLength)) {
			throw new Error('Invalid Git pkt-line response.');
		}
		if (lineLength === 0 || lineLength === 1) {
			continue;
		}
		if (lineLength === 2) {
			break;
		}
		if (lineLength < 4) {
			throw new Error('Invalid Git pkt-line response.');
		}

		const payloadLength = lineLength - 4;
		const payload = response.subarray(offset, offset + payloadLength);
		offset += payloadLength;
		const payloadText =
			payload[0] === 1 || payload[0] === 2 || payload[0] === 3
				? ''
				: decodeUtf8(payload);
		if (payload.length === 0 || payloadText === 'NAK\n') {
			continue;
		}
		if (payloadText.startsWith('ERR ')) {
			throw new Error(payloadText.trim());
		}

		const sideband = payload[0];
		if (sideband === 1) {
			packChunks.push(payload.subarray(1));
		} else if (sideband === 2) {
			continue;
		} else if (sideband === 3) {
			throw new Error(decodeUtf8(payload.subarray(1)));
		} else if (decodeAscii(payload.subarray(0, 4)) === 'PACK') {
			packChunks.push(payload);
		}
	}

	return concatUint8Arrays(packChunks);
}

function pktLine(value: string | Uint8Array): Uint8Array {
	const payload =
		typeof value === 'string' ? new TextEncoder().encode(value) : value;
	const header = new TextEncoder().encode(
		(payload.length + 4).toString(16).padStart(4, '0')
	);
	return concatUint8Arrays([header, payload]);
}

function flushPkt(): Uint8Array {
	return new TextEncoder().encode('0000');
}

function delimPkt(): Uint8Array {
	return new TextEncoder().encode('0001');
}

function parseGitResponseLines(response: Uint8Array): string[] {
	const lines: string[] = [];
	let offset = 0;
	while (offset + 4 <= response.length) {
		const lineLength = Number.parseInt(
			decodeAscii(response.subarray(offset, offset + 4)),
			16
		);
		offset += 4;
		if (!Number.isFinite(lineLength)) {
			throw new Error('Invalid Git pkt-line response.');
		}
		if (lineLength === 0) {
			break;
		}
		if (lineLength === 1) {
			continue;
		}
		if (lineLength < 4) {
			throw new Error('Invalid Git pkt-line response.');
		}
		const payloadLength = lineLength - 4;
		lines.push(
			decodeUtf8(
				response.subarray(offset, offset + payloadLength)
			).replace(/\n$/, '')
		);
		offset += payloadLength;
	}
	return lines;
}

async function collectAsyncIterable(
	iterable: AsyncIterable<Uint8Array>
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of iterable) {
		chunks.push(chunk);
	}
	return concatUint8Arrays(chunks);
}

function getResponseBody(
	response: Response
): AsyncIterableIterator<Uint8Array> {
	if (response.body) {
		return streamToAsyncIterator(response.body);
	}
	if (!response.arrayBuffer) {
		return emptyAsyncIterator();
	}
	return arrayBufferToAsyncIterator(response.arrayBuffer());
}

function streamToAsyncIterator(
	stream: ReadableStream<Uint8Array>
): AsyncIterableIterator<Uint8Array> {
	const reader = stream.getReader();
	return {
		async next() {
			const result = await reader.read();
			return result.done
				? { done: true, value: undefined }
				: { done: false, value: result.value };
		},
		return() {
			reader.releaseLock();
			return Promise.resolve({ done: true, value: undefined });
		},
		[Symbol.asyncIterator]() {
			return this;
		},
	};
}

async function* arrayBufferToAsyncIterator(arrayBuffer: Promise<ArrayBuffer>) {
	yield new Uint8Array(await arrayBuffer);
}

async function* emptyAsyncIterator() {
	// Empty async generator.
}

function mapGitHttpStatus(
	repoUrl: string,
	status: number,
	statusText: string,
	action: 'refs' | 'objects'
) {
	if (status === 401 || status === 403) {
		return new GitAuthenticationError(repoUrl, status);
	}
	return new Error(
		`Failed to fetch git ${action} from ${repoUrl}: ${status} ${statusText}`
	);
}

async function sha1(value: Uint8Array) {
	const hash = await crypto.subtle.digest('SHA-1', value);
	return Array.from(new Uint8Array(hash), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
}

function toUint8Array(value: Uint8Array) {
	return Uint8Array.from(value);
}

function concatUint8Arrays(arrays: Uint8Array[]) {
	const length = arrays.reduce((sum, array) => sum + array.length, 0);
	const result = new Uint8Array(length);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}
	return result;
}

function decodeAscii(value: Uint8Array) {
	return Array.from(value, (byte) => String.fromCharCode(byte)).join('');
}

function decodeUtf8(value: Uint8Array) {
	return new TextDecoder().decode(value);
}

type MemoryStats = {
	size: number;
	mode: number;
	isFile(): boolean;
	isDirectory(): boolean;
	isSymbolicLink(): boolean;
};

class MemoryFsClient {
	private files = new Map<string, Uint8Array>();
	private directories = new Set<string>(['/']);

	promises = {
		readFile: this.readFile.bind(this),
		writeFile: this.writeFile.bind(this),
		unlink: this.unlink.bind(this),
		readdir: this.readdir.bind(this),
		mkdir: this.mkdir.bind(this),
		rmdir: this.rmdir.bind(this),
		stat: this.stat.bind(this),
		lstat: this.lstat.bind(this),
		readlink: this.readlink.bind(this),
		symlink: this.symlink.bind(this),
	};

	async readFile(filepath: string, options?: any) {
		const normalized = this.normalize(filepath);
		const data = this.files.get(normalized);
		if (!data) {
			throw createFsError('ENOENT', normalized);
		}
		const copy = Uint8Array.from(data);
		const encoding =
			typeof options === 'string' ? options : options?.encoding;
		return encoding ? new TextDecoder().decode(copy) : copy;
	}

	async writeFile(filepath: string, data: string | Uint8Array) {
		const normalized = this.normalize(filepath);
		this.mkdirParents(this.dirname(normalized));
		this.files.set(
			normalized,
			typeof data === 'string'
				? new TextEncoder().encode(data)
				: Uint8Array.from(data)
		);
	}

	async unlink(filepath: string) {
		const normalized = this.normalize(filepath);
		if (!this.files.delete(normalized)) {
			throw createFsError('ENOENT', normalized);
		}
	}

	async readdir(dirpath: string, options?: any) {
		const normalized = this.normalize(dirpath);
		if (!this.directories.has(normalized)) {
			throw createFsError('ENOENT', normalized);
		}
		const names = new Set<string>();
		const prefix = normalized === '/' ? '/' : `${normalized}/`;
		for (const directory of this.directories) {
			if (directory !== normalized && directory.startsWith(prefix)) {
				names.add(directory.slice(prefix.length).split('/')[0]);
			}
		}
		for (const filepath of this.files.keys()) {
			if (filepath.startsWith(prefix)) {
				names.add(filepath.slice(prefix.length).split('/')[0]);
			}
		}
		const sortedNames = Array.from(names).sort();
		if (options?.withFileTypes) {
			return sortedNames.map((name) =>
				this.createDirent(`${prefix}${name}`, name)
			);
		}
		return sortedNames;
	}

	async mkdir(dirpath: string) {
		this.mkdirParents(this.normalize(dirpath));
	}

	async rmdir(dirpath: string) {
		const normalized = this.normalize(dirpath);
		if (normalized === '/') {
			throw createFsError('EBUSY', normalized);
		}
		const prefix = `${normalized}/`;
		for (const directory of this.directories) {
			if (directory.startsWith(prefix)) {
				throw createFsError('ENOTEMPTY', normalized);
			}
		}
		for (const filepath of this.files.keys()) {
			if (filepath.startsWith(prefix)) {
				throw createFsError('ENOTEMPTY', normalized);
			}
		}
		this.directories.delete(normalized);
	}

	async stat(filepath: string): Promise<MemoryStats> {
		return this.getStats(filepath);
	}

	async lstat(filepath: string): Promise<MemoryStats> {
		return this.getStats(filepath);
	}

	async readlink(filepath: string) {
		throw createFsError('EINVAL', this.normalize(filepath));
	}

	async symlink(_target: string, filepath: string) {
		throw createFsError('ENOSYS', this.normalize(filepath));
	}

	private getStats(filepath: string): MemoryStats {
		const normalized = this.normalize(filepath);
		const file = this.files.get(normalized);
		if (file) {
			return createStats(file.length, true);
		}
		if (this.directories.has(normalized)) {
			return createStats(0, false);
		}
		throw createFsError('ENOENT', normalized);
	}

	private createDirent(filepath: string, name: string) {
		const normalized = this.normalize(filepath);
		const isDirectory = this.directories.has(normalized);
		return {
			name,
			isFile: () => !isDirectory,
			isDirectory: () => isDirectory,
			isSymbolicLink: () => false,
		};
	}

	private mkdirParents(dirpath: string) {
		let current = '/';
		for (const segment of dirpath.split('/').filter(Boolean)) {
			current = current === '/' ? `/${segment}` : `${current}/${segment}`;
			this.directories.add(current);
		}
	}

	private dirname(filepath: string) {
		const normalized = this.normalize(filepath);
		const index = normalized.lastIndexOf('/');
		return index <= 0 ? '/' : normalized.slice(0, index);
	}

	private normalize(filepath: string) {
		const absolute = filepath.startsWith('/') ? filepath : `/${filepath}`;
		const parts: string[] = [];
		for (const part of absolute.split('/')) {
			if (!part || part === '.') {
				continue;
			}
			if (part === '..') {
				parts.pop();
			} else {
				parts.push(part);
			}
		}
		return `/${parts.join('/')}`;
	}
}

function createStats(size: number, isFile: boolean): MemoryStats {
	return {
		size,
		mode: isFile ? 0o100644 : 0o040755,
		isFile: () => isFile,
		isDirectory: () => !isFile,
		isSymbolicLink: () => false,
	};
}

function createFsError(code: string, filepath: string) {
	return Object.assign(new Error(`${code}: ${filepath}`), { code });
}
