import type {
	FilesystemSnapshot,
	SnapshotEntry,
	SnapshotFileEntry,
} from '@php-wasm/universal';
import { hashBytes, stripSnapshotBytes } from '@php-wasm/universal';
import { joinPaths, normalizePath } from '@php-wasm/util';

export type SnapshotHead = {
	siteId: string;
	snapshotId: string;
	updatedAt: string;
};

export type SnapshotPublishResult = {
	snapshotId: string;
	uploadedBlobs: string[];
	skippedBlobs: string[];
};

export interface SnapshotPublisher {
	hasBlob(hash: string): Promise<boolean>;
	putBlob(hash: string, bytes: Uint8Array): Promise<void>;
	putManifest(
		snapshotId: string,
		manifest: FilesystemSnapshot
	): Promise<void>;
	publishHead(
		siteId: string,
		snapshotId: string,
		previousHead?: SnapshotHead
	): Promise<void>;
	readHead(siteId: string): Promise<SnapshotHead | undefined>;
	readManifest(snapshotId: string): Promise<FilesystemSnapshot>;
	readBlob(hash: string): Promise<Uint8Array>;
}

export async function publishSnapshot(
	publisher: SnapshotPublisher,
	siteId: string,
	snapshot: FilesystemSnapshot
): Promise<SnapshotPublishResult> {
	const uploadedBlobs: string[] = [];
	const skippedBlobs: string[] = [];
	const seenBlobs = new Set<string>();
	for (const entry of snapshot.entries) {
		if (entry.type !== 'file' || seenBlobs.has(entry.hash)) {
			continue;
		}
		seenBlobs.add(entry.hash);
		if (await publisher.hasBlob(entry.hash)) {
			skippedBlobs.push(entry.hash);
			continue;
		}
		const bytes = await getFileEntryBytes(entry);
		await verifyBlobHash(entry.hash, bytes);
		await publisher.putBlob(entry.hash, bytes);
		uploadedBlobs.push(entry.hash);
	}

	const manifest = stripSnapshotBytes(snapshot);
	await verifyManifestBlobs(publisher, manifest);
	await publisher.putManifest(snapshot.id, manifest);
	const previousHead = await publisher.readHead(siteId);
	await publisher.publishHead(siteId, snapshot.id, previousHead);
	return {
		snapshotId: snapshot.id,
		uploadedBlobs,
		skippedBlobs,
	};
}

export async function restoreSnapshotFromPublisher(
	publisher: SnapshotPublisher,
	snapshotId: string
): Promise<FilesystemSnapshot> {
	const manifest = await publisher.readManifest(snapshotId);
	const entries: SnapshotEntry[] = [];
	for (const entry of manifest.entries) {
		if (entry.type !== 'file') {
			entries.push(entry);
			continue;
		}
		const bytes = await publisher.readBlob(entry.hash);
		await verifyBlobHash(entry.hash, bytes);
		entries.push({
			...entry,
			bytes,
		});
	}
	return {
		...manifest,
		entries,
	};
}

export class InMemorySnapshotPublisher implements SnapshotPublisher {
	readonly blobs = new Map<string, Uint8Array>();
	readonly manifests = new Map<string, FilesystemSnapshot>();
	readonly heads = new Map<string, SnapshotHead>();

	async hasBlob(hash: string): Promise<boolean> {
		return this.blobs.has(hash);
	}

	async putBlob(hash: string, bytes: Uint8Array): Promise<void> {
		this.blobs.set(hash, new Uint8Array(bytes));
	}

	async putManifest(
		snapshotId: string,
		manifest: FilesystemSnapshot
	): Promise<void> {
		this.manifests.set(snapshotId, stripSnapshotBytes(manifest));
	}

	async publishHead(
		siteId: string,
		snapshotId: string,
		previousHead?: SnapshotHead
	): Promise<void> {
		const currentHead = this.heads.get(siteId);
		if (
			previousHead !== undefined &&
			currentHead?.snapshotId !== previousHead.snapshotId
		) {
			throw new Error(`Snapshot head changed for site "${siteId}".`);
		}
		this.heads.set(siteId, {
			siteId,
			snapshotId,
			updatedAt: new Date().toISOString(),
		});
	}

	async readHead(siteId: string): Promise<SnapshotHead | undefined> {
		return this.heads.get(siteId);
	}

	async readManifest(snapshotId: string): Promise<FilesystemSnapshot> {
		const manifest = this.manifests.get(snapshotId);
		if (manifest === undefined) {
			throw new Error(`Snapshot manifest not found: ${snapshotId}`);
		}
		return manifest;
	}

	async readBlob(hash: string): Promise<Uint8Array> {
		const bytes = this.blobs.get(hash);
		if (bytes === undefined) {
			throw new Error(`Snapshot blob not found: ${hash}`);
		}
		return new Uint8Array(bytes);
	}
}

export type S3CompatibleObjectClient = {
	headObject(key: string): Promise<boolean>;
	putObject(
		key: string,
		body: Uint8Array,
		options?: { contentType?: string }
	): Promise<void>;
	getObject(key: string): Promise<Uint8Array>;
};

export type S3CompatibleSnapshotPublisherOptions = {
	prefix?: string;
};

export function createS3CompatibleSnapshotPublisher(
	client: S3CompatibleObjectClient,
	options: S3CompatibleSnapshotPublisherOptions = {}
): SnapshotPublisher {
	const prefix = normalizeObjectPrefix(options.prefix ?? '');
	return {
		async hasBlob(hash) {
			return await client.headObject(blobKey(prefix, hash));
		},
		async putBlob(hash, bytes) {
			await client.putObject(blobKey(prefix, hash), bytes, {
				contentType: 'application/octet-stream',
			});
		},
		async putManifest(snapshotId, manifest) {
			await client.putObject(
				manifestKey(prefix, snapshotId),
				encodeJson(stripSnapshotBytes(manifest)),
				{
					contentType: 'application/json',
				}
			);
		},
		async publishHead(siteId, snapshotId) {
			await client.putObject(
				headKey(prefix, siteId),
				encodeJson({
					siteId,
					snapshotId,
					updatedAt: new Date().toISOString(),
				}),
				{
					contentType: 'application/json',
				}
			);
		},
		async readHead(siteId) {
			try {
				return decodeJson<SnapshotHead>(
					await client.getObject(headKey(prefix, siteId))
				);
			} catch (error) {
				if (isMissingObjectError(error)) {
					return undefined;
				}
				throw error;
			}
		},
		async readManifest(snapshotId) {
			return decodeJson<FilesystemSnapshot>(
				await client.getObject(manifestKey(prefix, snapshotId))
			);
		},
		async readBlob(hash) {
			return await client.getObject(blobKey(prefix, hash));
		},
	};
}

export type OpfsSnapshotPublisherOptions = {
	prefix?: string;
};

export function createOpfsSnapshotPublisher(
	root: FileSystemDirectoryHandle,
	options: OpfsSnapshotPublisherOptions = {}
): SnapshotPublisher {
	const prefix = normalizeObjectPrefix(options.prefix ?? '');
	return {
		async hasBlob(hash) {
			return await opfsFileExists(root, blobKey(prefix, hash));
		},
		async putBlob(hash, bytes) {
			await writeOpfsFile(root, blobKey(prefix, hash), bytes);
		},
		async putManifest(snapshotId, manifest) {
			await writeOpfsFile(
				root,
				manifestKey(prefix, snapshotId),
				encodeJson(stripSnapshotBytes(manifest))
			);
		},
		async publishHead(siteId, snapshotId) {
			await writeOpfsFile(
				root,
				headKey(prefix, siteId),
				encodeJson({
					siteId,
					snapshotId,
					updatedAt: new Date().toISOString(),
				})
			);
		},
		async readHead(siteId) {
			try {
				return decodeJson<SnapshotHead>(
					await readOpfsFile(root, headKey(prefix, siteId))
				);
			} catch (error) {
				if (isMissingObjectError(error)) {
					return undefined;
				}
				throw error;
			}
		},
		async readManifest(snapshotId) {
			return decodeJson<FilesystemSnapshot>(
				await readOpfsFile(root, manifestKey(prefix, snapshotId))
			);
		},
		async readBlob(hash) {
			return await readOpfsFile(root, blobKey(prefix, hash));
		},
	};
}

export type FetchS3CompatibleClientOptions = {
	endpoint: string;
	fetch?: typeof fetch;
	headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
};

export function createFetchS3CompatibleClient({
	endpoint,
	fetch: fetchImplementation = fetch,
	headers,
}: FetchS3CompatibleClientOptions): S3CompatibleObjectClient {
	const root = endpoint.replace(/\/+$/, '');
	return {
		async headObject(key) {
			const response = await fetchImplementation(objectUrl(root, key), {
				method: 'HEAD',
				headers: await resolveHeaders(headers),
			});
			if (response.status === 404) {
				return false;
			}
			if (!response.ok) {
				throw new Error(
					`Could not check remote object ${key}: ${response.status}`
				);
			}
			return true;
		},
		async putObject(key, body, options) {
			const requestHeaders = new Headers(await resolveHeaders(headers));
			if (options?.contentType) {
				requestHeaders.set('content-type', options.contentType);
			}
			const response = await fetchImplementation(objectUrl(root, key), {
				method: 'PUT',
				headers: requestHeaders,
				body,
			});
			if (!response.ok) {
				throw new Error(
					`Could not write remote object ${key}: ${response.status}`
				);
			}
		},
		async getObject(key) {
			const response = await fetchImplementation(objectUrl(root, key), {
				method: 'GET',
				headers: await resolveHeaders(headers),
			});
			if (response.status === 404) {
				throw missingObjectError(key);
			}
			if (!response.ok) {
				throw new Error(
					`Could not read remote object ${key}: ${response.status}`
				);
			}
			return new Uint8Array(await response.arrayBuffer());
		},
	};
}

async function getFileEntryBytes(entry: SnapshotFileEntry) {
	if (entry.bytes === undefined) {
		throw new Error(
			`Cannot publish ${entry.path}: snapshot entry does not include bytes.`
		);
	}
	return entry.bytes;
}

async function verifyBlobHash(expectedHash: string, bytes: Uint8Array) {
	const actualHash = await hashBytes(bytes);
	if (actualHash !== expectedHash) {
		throw new Error(
			`Snapshot blob hash mismatch. Expected ${expectedHash}, got ${actualHash}.`
		);
	}
}

async function verifyManifestBlobs(
	publisher: SnapshotPublisher,
	manifest: FilesystemSnapshot
) {
	for (const entry of manifest.entries) {
		if (entry.type === 'file' && !(await publisher.hasBlob(entry.hash))) {
			throw new Error(
				`Cannot publish snapshot manifest: missing blob ${entry.hash}.`
			);
		}
	}
}

function blobKey(prefix: string, hash: string) {
	return joinObjectKey(prefix, 'blobs', encodeObjectKeySegment(hash));
}

function manifestKey(prefix: string, snapshotId: string) {
	return joinObjectKey(
		prefix,
		'snapshots',
		`${encodeObjectKeySegment(snapshotId)}.json`
	);
}

function headKey(prefix: string, siteId: string) {
	return joinObjectKey(
		prefix,
		'heads',
		`${encodeObjectKeySegment(siteId)}.json`
	);
}

function joinObjectKey(...parts: string[]) {
	return normalizePath(joinPaths(...parts)).replace(/^\/+/, '');
}

function normalizeObjectPrefix(prefix: string) {
	return normalizePath(prefix).replace(/^\/+|\/+$/g, '');
}

function encodeObjectKeySegment(segment: string) {
	return encodeURIComponent(segment);
}

function encodeJson(value: unknown) {
	return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson<T>(bytes: Uint8Array): T {
	return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function resolveHeaders(
	headers: FetchS3CompatibleClientOptions['headers']
) {
	if (headers === undefined) {
		return {};
	}
	return typeof headers === 'function' ? await headers() : headers;
}

function objectUrl(root: string, key: string) {
	return `${root}/${key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/')}`;
}

async function writeOpfsFile(
	root: FileSystemDirectoryHandle,
	key: string,
	bytes: Uint8Array
) {
	const { parent, name } = await resolveOpfsParent(root, key, true);
	const file = await parent.getFileHandle(name, { create: true });
	const writable = await file.createWritable();
	try {
		await writable.write(bytes);
	} finally {
		await writable.close();
	}
}

async function readOpfsFile(root: FileSystemDirectoryHandle, key: string) {
	try {
		const { parent, name } = await resolveOpfsParent(root, key, false);
		const file = await parent.getFileHandle(name);
		return new Uint8Array(await (await file.getFile()).arrayBuffer());
	} catch (error) {
		if (isOpfsNotFoundError(error)) {
			throw missingObjectError(key);
		}
		throw error;
	}
}

async function opfsFileExists(root: FileSystemDirectoryHandle, key: string) {
	try {
		const { parent, name } = await resolveOpfsParent(root, key, false);
		await parent.getFileHandle(name);
		return true;
	} catch (error) {
		if (isOpfsNotFoundError(error)) {
			return false;
		}
		throw error;
	}
}

async function resolveOpfsParent(
	root: FileSystemDirectoryHandle,
	key: string,
	create: boolean
) {
	const segments = key.split('/').filter(Boolean);
	const name = segments.pop();
	if (!name) {
		throw new Error(`Invalid snapshot object key: ${key}`);
	}
	let parent = root;
	for (const segment of segments) {
		parent = await parent.getDirectoryHandle(segment, { create });
	}
	return { parent, name };
}

function isOpfsNotFoundError(error: unknown) {
	return (error as { name?: string })?.name === 'NotFoundError';
}

function missingObjectError(key: string) {
	const error = new Error(`Remote object not found: ${key}`) as Error & {
		code: 'NoSuchKey';
		status: 404;
	};
	error.code = 'NoSuchKey';
	error.status = 404;
	return error;
}

function isMissingObjectError(error: unknown) {
	const maybeError = error as { code?: string; status?: number };
	return maybeError?.code === 'NoSuchKey' || maybeError?.status === 404;
}
