import { describe, expect, it } from 'vitest';
import type { FilesystemSnapshot } from '@php-wasm/universal';
import { hashBytes } from '@php-wasm/universal';
import {
	InMemorySnapshotPublisher,
	createOpfsSnapshotPublisher,
	createS3CompatibleSnapshotPublisher,
	publishSnapshot,
	restoreSnapshotFromPublisher,
} from '../lib/snapshot-publisher';

describe('snapshot publisher', () => {
	it('publishes only missing blobs and strips bytes from manifests', async () => {
		const fileBytes = bytes('shared');
		const fileHash = await hashBytes(fileBytes);
		const snapshot = createSnapshot('snapshot-1', [
			{
				type: 'directory',
				path: '/site',
			},
			{
				type: 'file',
				path: '/site/a.txt',
				size: fileBytes.byteLength,
				hash: fileHash,
				bytes: fileBytes,
			},
			{
				type: 'file',
				path: '/site/b.txt',
				size: fileBytes.byteLength,
				hash: fileHash,
				bytes: fileBytes,
			},
		]);
		const publisher = new InMemorySnapshotPublisher();

		const result = await publishSnapshot(publisher, 'site-id', snapshot);

		expect(result.uploadedBlobs).toEqual([fileHash]);
		expect(result.skippedBlobs).toEqual([]);
		expect(publisher.blobs.size).toBe(1);
		const manifest = await publisher.readManifest(snapshot.id);
		const fileEntry = manifest.entries.find(
			(entry) => entry.type === 'file'
		);
		expect((fileEntry as any).bytes).toBeUndefined();
		expect(await publisher.readHead('site-id')).toMatchObject({
			siteId: 'site-id',
			snapshotId: snapshot.id,
		});

		const secondResult = await publishSnapshot(
			publisher,
			'site-id',
			createSnapshot('snapshot-2', snapshot.entries)
		);

		expect(secondResult.uploadedBlobs).toEqual([]);
		expect(secondResult.skippedBlobs).toEqual([fileHash]);
	});

	it('restores manifest-only snapshots by reading blobs', async () => {
		const fileBytes = bytes('content');
		const fileHash = await hashBytes(fileBytes);
		const snapshot = createSnapshot('snapshot-1', [
			{
				type: 'directory',
				path: '/site',
			},
			{
				type: 'file',
				path: '/site/file.txt',
				size: fileBytes.byteLength,
				hash: fileHash,
				bytes: fileBytes,
			},
		]);
		const publisher = new InMemorySnapshotPublisher();
		await publishSnapshot(publisher, 'site-id', snapshot);

		const restored = await restoreSnapshotFromPublisher(
			publisher,
			snapshot.id
		);

		const restoredFile = restored.entries.find(
			(entry) => entry.type === 'file'
		);
		expect(Array.from((restoredFile as any).bytes)).toEqual(
			Array.from(fileBytes)
		);
	});

	it('can publish through an S3-compatible object client', async () => {
		const fileBytes = bytes('remote');
		const fileHash = await hashBytes(fileBytes);
		const storedObjects = new Map<string, Uint8Array>();
		const publisher = createS3CompatibleSnapshotPublisher(
			{
				async headObject(key) {
					return storedObjects.has(key);
				},
				async putObject(key, body) {
					storedObjects.set(key, new Uint8Array(body));
				},
				async getObject(key) {
					const body = storedObjects.get(key);
					if (body === undefined) {
						const error = new Error('missing') as Error & {
							status: 404;
						};
						error.status = 404;
						throw error;
					}
					return body;
				},
			},
			{
				prefix: 'sites/site-id',
			}
		);
		const snapshot = createSnapshot('snapshot-remote', [
			{
				type: 'directory',
				path: '/site',
			},
			{
				type: 'file',
				path: '/site/file.txt',
				size: fileBytes.byteLength,
				hash: fileHash,
				bytes: fileBytes,
			},
		]);

		await publishSnapshot(publisher, 'site-id', snapshot);

		expect(
			storedObjects.has(
				`sites/site-id/blobs/${encodeURIComponent(fileHash)}`
			)
		).toBe(true);
		expect(
			storedObjects.has(
				`sites/site-id/snapshots/${encodeURIComponent(
					snapshot.id
				)}.json`
			)
		).toBe(true);
		expect(storedObjects.has('sites/site-id/heads/site-id.json')).toBe(
			true
		);
	});

	it('can publish through an OPFS object publisher', async () => {
		const fileBytes = bytes('opfs');
		const fileHash = await hashBytes(fileBytes);
		const root = createMemoryDirectoryHandle();
		const publisher = createOpfsSnapshotPublisher(root as any, {
			prefix: 'sites/site-id',
		});
		const snapshot = createSnapshot('snapshot-opfs', [
			{
				type: 'directory',
				path: '/site',
			},
			{
				type: 'file',
				path: '/site/file.txt',
				size: fileBytes.byteLength,
				hash: fileHash,
				bytes: fileBytes,
			},
		]);

		await publishSnapshot(publisher, 'site-id', snapshot);
		const restored = await restoreSnapshotFromPublisher(
			publisher,
			snapshot.id
		);

		expect(await publisher.hasBlob(fileHash)).toBe(true);
		expect(await publisher.readHead('site-id')).toMatchObject({
			snapshotId: snapshot.id,
		});
		const restoredFile = restored.entries.find(
			(entry) => entry.type === 'file'
		);
		expect(Array.from((restoredFile as any).bytes)).toEqual(
			Array.from(fileBytes)
		);
	});
});

function createSnapshot(
	id: string,
	entries: FilesystemSnapshot['entries']
): FilesystemSnapshot {
	return {
		version: 1,
		id,
		root: '/site',
		createdAt: '2026-06-25T00:00:00.000Z',
		entries,
	};
}

function bytes(text: string) {
	return new TextEncoder().encode(text);
}

function createMemoryDirectoryHandle(name = 'root') {
	const directories = new Map<
		string,
		ReturnType<typeof createMemoryDirectoryHandle>
	>();
	const files = new Map<string, ReturnType<typeof createMemoryFileHandle>>();
	return {
		name,
		kind: 'directory',
		async getDirectoryHandle(
			childName: string,
			options: { create?: boolean } = {}
		) {
			let child = directories.get(childName);
			if (child === undefined) {
				if (!options.create) {
					throw notFoundError();
				}
				child = createMemoryDirectoryHandle(childName);
				directories.set(childName, child);
			}
			return child;
		},
		async getFileHandle(
			childName: string,
			options: { create?: boolean } = {}
		) {
			let child = files.get(childName);
			if (child === undefined) {
				if (!options.create) {
					throw notFoundError();
				}
				child = createMemoryFileHandle(childName);
				files.set(childName, child);
			}
			return child;
		},
	};
}

function createMemoryFileHandle(name: string) {
	let contents = new Uint8Array();
	return {
		name,
		kind: 'file',
		async createWritable() {
			return {
				async write(bytes: Uint8Array) {
					contents = new Uint8Array(bytes);
				},
				async close() {},
			};
		},
		async getFile() {
			return {
				async arrayBuffer() {
					return contents.buffer.slice(
						contents.byteOffset,
						contents.byteOffset + contents.byteLength
					);
				},
			};
		},
	};
}

function notFoundError() {
	const error = new Error('Not found');
	error.name = 'NotFoundError';
	return error;
}
