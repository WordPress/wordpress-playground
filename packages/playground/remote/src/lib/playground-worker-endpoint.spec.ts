import { afterEach, describe, expect, it, vi } from 'vitest';
import { __private__dont__use } from '@php-wasm/universal';
import type { FilesystemSnapshot, MountHandler } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';

describe('PlaygroundWorkerEndpoint OPFS flushing', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('registers OPFS mounts created through mountOpfs', async () => {
		const endpoint = await createEndpoint({});
		const php = createFakePhp();
		endpoint.__internal_getPHP = () => php;

		await endpoint.mountOpfs({
			device: {
				type: 'local-fs',
				handle: createEmptyDirectoryHandle(),
			},
			mountpoint: '/wordpress',
		});

		expect(await endpoint.hasOpfsMount('/wordpress')).toBe(true);
		expect(endpoint.opfsMounts['/wordpress']).toBeDefined();
		expect(php.mount).toHaveBeenCalledWith(
			'/wordpress',
			expect.any(Function)
		);
	}, 15_000);

	it('flushes the active OPFS mount', async () => {
		const endpoint = await createEndpoint({
			'/wordpress': createOpfsMount(),
		});

		await endpoint.flushOpfs('/wordpress');

		expect(endpoint.opfsMounts['/wordpress'].flush).toHaveBeenCalledTimes(
			1
		);
	});

	it('flushes before snapshotting SQLite and persists the post-flush snapshot', async () => {
		const opfsMount = createOpfsMount();
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const order: string[] = [];
		let didFlushBeforeSnapshot = false;
		let snapshot = createSqliteFilesystemSnapshot('pre-flush');
		php.snapshotFilesystem.mockImplementation(async () => {
			expect(didFlushBeforeSnapshot).toBe(true);
			order.push('snapshot');
			return snapshot;
		});
		opfsMount.flush.mockImplementation(async () => {
			order.push('flush');
			didFlushBeforeSnapshot = true;
			snapshot = createSqliteFilesystemSnapshot('post-flush');
		});
		opfsMount.persistSqliteSnapshot.mockImplementation(async () => {
			order.push('persist');
		});
		const endpoint = await createEndpoint({
			'/wordpress': opfsMount,
		});
		endpoint.__internal_getPHP = () => php;

		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		await endpoint.flushOpfs('/wordpress');

		expect(order.indexOf('flush')).toBeLessThan(order.indexOf('snapshot'));
		expect(order.indexOf('snapshot')).toBeLessThan(
			order.indexOf('persist')
		);
		expect(opfsMount.persistSqliteSnapshot).toHaveBeenCalledWith(snapshot);
	});

	it('debounces multiple SQLite write notifications into one snapshot', async () => {
		vi.useFakeTimers();
		const opfsMount = createOpfsMount();
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const endpoint = await createEndpoint({
			'/wordpress': opfsMount,
		});
		endpoint.__internal_getPHP = () => php;

		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		(endpoint as any).markSqliteSnapshotDirty('/wordpress');

		expect(php.snapshotFilesystem).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(100);

		expect(php.snapshotFilesystem).toHaveBeenCalledTimes(1);
		expect(opfsMount.persistSqliteSnapshot).toHaveBeenCalledTimes(1);
	});

	it('runs one trailing snapshot for writes reported during an active snapshot', async () => {
		const opfsMount = createOpfsMount();
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const firstSnapshotStarted = deferred<void>();
		const releaseFirstSnapshot = deferred<void>();
		let activeSnapshots = 0;
		let maxActiveSnapshots = 0;
		let snapshotCount = 0;
		php.snapshotFilesystem.mockImplementation(async () => {
			const snapshotNumber = ++snapshotCount;
			activeSnapshots++;
			maxActiveSnapshots = Math.max(maxActiveSnapshots, activeSnapshots);
			if (snapshotNumber === 1) {
				firstSnapshotStarted.resolve(undefined);
				await releaseFirstSnapshot.promise;
			}
			activeSnapshots--;
			return createSqliteFilesystemSnapshot(`snapshot-${snapshotNumber}`);
		});
		const endpoint = await createEndpoint({
			'/wordpress': opfsMount,
		});
		endpoint.__internal_getPHP = () => php;

		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		const snapshotPersistence = (
			endpoint as any
		).persistSqliteSnapshotsUntilClean('/wordpress', opfsMount);
		await firstSnapshotStarted.promise;
		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		releaseFirstSnapshot.resolve(undefined);
		await snapshotPersistence;

		expect(maxActiveSnapshots).toBe(1);
		expect(php.snapshotFilesystem).toHaveBeenCalledTimes(2);
		expect(opfsMount.persistSqliteSnapshot).toHaveBeenNthCalledWith(
			1,
			createSqliteFilesystemSnapshot('snapshot-1')
		);
		expect(opfsMount.persistSqliteSnapshot).toHaveBeenNthCalledWith(
			2,
			createSqliteFilesystemSnapshot('snapshot-2')
		);
	});

	it('does not run concurrent snapshots for overlapping flushes', async () => {
		const opfsMount = createOpfsMount();
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const firstSnapshotStarted = deferred<void>();
		const releaseFirstSnapshot = deferred<void>();
		let activeSnapshots = 0;
		let maxActiveSnapshots = 0;
		php.snapshotFilesystem.mockImplementation(async () => {
			activeSnapshots++;
			maxActiveSnapshots = Math.max(maxActiveSnapshots, activeSnapshots);
			firstSnapshotStarted.resolve(undefined);
			await releaseFirstSnapshot.promise;
			activeSnapshots--;
			return createSqliteFilesystemSnapshot('snapshot');
		});
		const endpoint = await createEndpoint({
			'/wordpress': opfsMount,
		});
		endpoint.__internal_getPHP = () => php;

		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		const firstFlush = endpoint.flushOpfs('/wordpress');
		await firstSnapshotStarted.promise;
		const secondFlush = endpoint.flushOpfs('/wordpress');
		releaseFirstSnapshot.resolve(undefined);
		await Promise.all([firstFlush, secondFlush]);

		expect(maxActiveSnapshots).toBe(1);
		expect(php.snapshotFilesystem).toHaveBeenCalledTimes(1);
		expect(opfsMount.persistSqliteSnapshot).toHaveBeenCalledTimes(1);
	});

	it('flushOpfs cancels the debounce and snapshots immediately', async () => {
		vi.useFakeTimers();
		const opfsMount = createOpfsMount();
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const endpoint = await createEndpoint({
			'/wordpress': opfsMount,
		});
		endpoint.__internal_getPHP = () => php;

		(endpoint as any).markSqliteSnapshotDirty('/wordpress');

		await endpoint.flushOpfs('/wordpress');

		expect(php.snapshotFilesystem).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(100);
		expect(php.snapshotFilesystem).toHaveBeenCalledTimes(1);
	});

	it('unmountOpfs waits for pending and trailing snapshots before unmounting', async () => {
		const opfsMount = createOpfsMount();
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const firstSnapshotStarted = deferred<void>();
		const releaseFirstSnapshot = deferred<void>();
		const order: string[] = [];
		let snapshotCount = 0;
		php.snapshotFilesystem.mockImplementation(async () => {
			const snapshotNumber = ++snapshotCount;
			order.push(`snapshot ${snapshotNumber}`);
			if (snapshotNumber === 1) {
				firstSnapshotStarted.resolve(undefined);
				await releaseFirstSnapshot.promise;
			}
			return createSqliteFilesystemSnapshot(`snapshot-${snapshotNumber}`);
		});
		opfsMount.persistSqliteSnapshot.mockImplementation(async () => {
			order.push(`persist ${snapshotCount}`);
		});
		const unmount = vi.fn(async () => {
			order.push('unmount');
		});
		const endpoint = await createEndpoint(
			{ '/wordpress': opfsMount },
			{ '/wordpress': unmount }
		);
		endpoint.__internal_getPHP = () => php;

		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		const unmountPromise = endpoint.unmountOpfs('/wordpress');
		await firstSnapshotStarted.promise;
		(endpoint as any).markSqliteSnapshotDirty('/wordpress');
		expect(unmount).not.toHaveBeenCalled();

		releaseFirstSnapshot.resolve(undefined);
		await unmountPromise;

		expect(php.snapshotFilesystem).toHaveBeenCalledTimes(2);
		expect(order).toEqual([
			'snapshot 1',
			'persist 1',
			'snapshot 2',
			'persist 2',
			'unmount',
		]);
	});

	it('does not snapshot solely because OPFS restore contains SQLite sidecars', async () => {
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const endpoint = await createEndpoint({});
		endpoint.__internal_getPHP = () => php;

		await endpoint.mountOpfs({
			device: {
				type: 'local-fs',
				handle: createSqliteLegacyDirectoryHandle(),
			},
			mountpoint: '/wordpress',
		});

		expect(php.snapshotFilesystem).not.toHaveBeenCalled();
		expect(php[__private__dont__use].FS.createDataFile).toHaveBeenCalled();
	});

	it('does not use SQLite snapshot scheduling for non-WordPress mounts', async () => {
		const opfsMount = createOpfsMount();
		const php = createFakePhp();
		php.isFile.mockReturnValue(true);
		const endpoint = await createEndpoint({
			'/plugin': opfsMount,
		});
		endpoint.__internal_getPHP = () => php;

		(endpoint as any).markSqliteSnapshotDirty('/plugin');
		await endpoint.flushOpfs('/plugin');

		expect(opfsMount.flush).toHaveBeenCalledTimes(1);
		expect(php.snapshotFilesystem).not.toHaveBeenCalled();
		expect((endpoint as any).opfsSqliteSnapshotStates['/plugin']).toBe(
			undefined
		);
	});

	it('reports whether an OPFS mount is active', async () => {
		const endpoint = await createEndpoint({
			'/wordpress': createOpfsMount(),
		});

		expect(await endpoint.hasOpfsMount('/wordpress')).toBe(true);
		expect(await endpoint.hasOpfsMount('/missing')).toBe(false);
	});

	it('does not report inherited property names as active OPFS mounts', async () => {
		const endpoint = await createEndpoint({});

		expect(await endpoint.hasOpfsMount('constructor')).toBe(false);
		await expect(endpoint.flushOpfs('constructor')).rejects.toThrow(
			'No OPFS mount found at "constructor".'
		);
	});

	it('supports special mountpoint names as own OPFS mount keys', async () => {
		const endpoint = await createEndpoint({});
		const php = createFakePhp();
		endpoint.__internal_getPHP = () => php;

		await endpoint.mountOpfs({
			device: {
				type: 'local-fs',
				handle: createEmptyDirectoryHandle(),
			},
			mountpoint: '__proto__',
		});

		expect(await endpoint.hasOpfsMount('__proto__')).toBe(true);
		await expect(endpoint.flushOpfs('__proto__')).resolves.toBeUndefined();
	});

	it('throws when flushing a missing OPFS mount', async () => {
		const endpoint = await createEndpoint({});

		await expect(endpoint.flushOpfs('/wordpress')).rejects.toThrow(
			'No OPFS mount found at "/wordpress".'
		);
	});

	it('flushes before unmounting an OPFS mount', async () => {
		const opfsMount = createOpfsMount();
		const order: string[] = [];
		opfsMount.flush.mockImplementation(async () => {
			order.push('flush');
		});
		const unmount = vi.fn(async () => {
			order.push('unmount');
		});
		const endpoint = await createEndpoint(
			{ '/wordpress': opfsMount },
			{ '/wordpress': unmount }
		);

		await endpoint.unmountOpfs('/wordpress');

		expect(order).toEqual(['flush', 'unmount']);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
	});

	it('rethrows and clears tracking when flush succeeds but unmount fails', async () => {
		// Covers the `unmountOpfs` failure matrix quadrant where the flush
		// before unmount resolves cleanly but the underlying PHP unmount
		// callback throws. In this case the unmount error is the *only*
		// signal callers get, so it must be re-thrown unchanged, and the
		// mount registries must still be cleaned up in the `finally` block
		// to avoid a stuck mountpoint that blocks future `mountOpfs` calls.
		const unmountError = new Error('unmount failed');
		const opfsMount = createOpfsMount();
		const unmount = vi.fn(async () => {
			throw unmountError;
		});
		const endpoint = await createEndpoint(
			{ '/wordpress': opfsMount },
			{ '/wordpress': unmount }
		);

		await expect(endpoint.unmountOpfs('/wordpress')).rejects.toBe(
			unmountError
		);

		expect(opfsMount.flush).toHaveBeenCalledTimes(1);
		expect(unmount).toHaveBeenCalledTimes(1);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
	});

	it('removes mount tracking when the flush before unmount fails', async () => {
		const flushError = new Error('flush failed');
		const opfsMount = createOpfsMount();
		opfsMount.flush.mockRejectedValueOnce(flushError);
		const unmount = vi.fn(async () => {});
		const endpoint = await createEndpoint(
			{ '/wordpress': opfsMount },
			{ '/wordpress': unmount }
		);

		await expect(endpoint.unmountOpfs('/wordpress')).rejects.toBe(
			flushError
		);

		expect(unmount).toHaveBeenCalledTimes(1);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
	});

	it('prefers the flush error and logs the unmount error when both fail', async () => {
		// Covers the most adversarial `unmountOpfs` quadrant: both the
		// pre-unmount flush and the underlying unmount callback reject.
		//
		// The production code intentionally surfaces the *flush* error to
		// the caller because it is the root cause (the unmount error is
		// often a downstream symptom of an already-broken flush), and
		// routes the unmount error through `logger.error` so it is not
		// silently discarded. Registry cleanup must still happen.
		//
		// Without this test, a regression that flipped the priority
		// (throwing the unmount error instead of the flush error) or
		// dropped the unmount error without logging would go unnoticed.
		const flushError = new Error('flush failed');
		const unmountError = new Error('unmount failed');
		const opfsMount = createOpfsMount();
		opfsMount.flush.mockRejectedValueOnce(flushError);
		const unmount = vi.fn(async () => {
			throw unmountError;
		});
		const loggerError = vi
			.spyOn(logger, 'error')
			.mockImplementation(() => {});
		try {
			const endpoint = await createEndpoint(
				{ '/wordpress': opfsMount },
				{ '/wordpress': unmount }
			);

			await expect(endpoint.unmountOpfs('/wordpress')).rejects.toBe(
				flushError
			);

			expect(unmount).toHaveBeenCalledTimes(1);
			expect(loggerError).toHaveBeenCalledWith(unmountError);
			expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
			expect(endpoint.unmounts['/wordpress']).toBeUndefined();
		} finally {
			loggerError.mockRestore();
		}
	});

	it('throws before mounting when an OPFS mount already exists', async () => {
		const endpoint = await createEndpoint({
			'/wordpress': createOpfsMount(),
		});
		const php = createFakePhp();
		endpoint.__internal_getPHP = () => php;

		await expect(
			endpoint.mountOpfs({
				device: {
					type: 'local-fs',
					handle: createEmptyDirectoryHandle(),
				},
				mountpoint: '/wordpress',
			})
		).rejects.toThrow('OPFS mount already exists at "/wordpress".');

		expect(php.mount).not.toHaveBeenCalled();
	});

	it('rejects mountOpfs when only a stale unmount callback is tracked', async () => {
		// The duplicate-mount guard in `mountOpfsIntoPhp` checks
		// `opfsMounts` and `unmounts` with an OR, not an AND, so either
		// registry alone should block a re-mount. This test covers the
		// `unmounts`-only branch of that guard, which would be reachable
		// if a prior `mountOpfsIntoPhp` call desynced the two registries
		// (for example, a partial rollback on a previous failure).
		//
		// Without this test the OR branch for `unmounts` is unreachable
		// from the existing suite, and a regression that tightened the
		// guard to an AND would silently allow a re-mount on top of a
		// stale unmount callback — leaking the old handler and leaving
		// the system unable to ever unmount the new mount cleanly.
		const staleUnmount = vi.fn(async () => {});
		const endpoint = await createEndpoint(
			{},
			{ '/wordpress': staleUnmount }
		);
		const php = createFakePhp();
		endpoint.__internal_getPHP = () => php;

		await expect(
			endpoint.mountOpfs({
				device: {
					type: 'local-fs',
					handle: createEmptyDirectoryHandle(),
				},
				mountpoint: '/wordpress',
			})
		).rejects.toThrow('OPFS mount already exists at "/wordpress".');

		expect(php.mount).not.toHaveBeenCalled();
		expect(staleUnmount).not.toHaveBeenCalled();
	});

	it('throws when unmounting a missing OPFS mount', async () => {
		const endpoint = await createEndpoint({});

		await expect(endpoint.unmountOpfs('/wordpress')).rejects.toThrow(
			'No OPFS mount found at "/wordpress".'
		);
	});

	it('rolls back mount state when OPFS controller registration fails', async () => {
		const endpoint = await createEndpoint({});
		const php = createFakePhp({ skipMountHandler: true });
		endpoint.__internal_getPHP = () => php;

		await expect(
			endpoint.mountOpfs({
				device: {
					type: 'local-fs',
					handle: createEmptyDirectoryHandle(),
				},
				mountpoint: '/wordpress',
			})
		).rejects.toThrow('Could not create an OPFS mount at "/wordpress".');

		expect(php.unmount).toHaveBeenCalledTimes(1);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
	});
});

async function createEndpoint(
	opfsMounts: Record<string, ReturnType<typeof createOpfsMount>>,
	unmounts: Record<string, () => Promise<void>> = {}
) {
	vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
	const { PlaygroundWorkerEndpoint } =
		await import('./playground-worker-endpoint');
	const endpoint = Object.create(PlaygroundWorkerEndpoint.prototype) as any;
	endpoint.opfsMounts = createNullPrototypeRecord(opfsMounts);
	endpoint.unmounts = createNullPrototypeRecord(unmounts);
	endpoint.opfsSqliteSnapshotStates = createNullPrototypeRecord({});
	endpoint.__internal_getPHP = () => createFakePhp();
	return endpoint as {
		__internal_getPHP?: () => ReturnType<typeof createFakePhp>;
		hasOpfsMount(mountpoint: string): Promise<boolean>;
		mountOpfs(options: {
			device: {
				type: 'local-fs';
				handle: FileSystemDirectoryHandle;
			};
			mountpoint: string;
		}): Promise<void>;
		flushOpfs(mountpoint: string): Promise<void>;
		unmountOpfs(mountpoint: string): Promise<void>;
		opfsMounts: typeof opfsMounts;
		unmounts: typeof unmounts;
	};
}

function createNullPrototypeRecord<T>(entries: Record<string, T>) {
	return Object.assign(Object.create(null), entries) as Record<string, T>;
}

function createOpfsMount() {
	return {
		flush: vi.fn(async () => {}),
		persistSqliteSnapshot: vi.fn(async () => {}),
		unmount: vi.fn(async () => {}),
	};
}

function createFakePhp(options: { skipMountHandler?: boolean } = {}) {
	const FS = {
		write: vi.fn(),
		truncate: vi.fn(),
		unlink: vi.fn(),
		mknod: vi.fn(),
		mkdir: vi.fn(),
		rmdir: vi.fn(),
		rename: vi.fn(),
		createDataFile: vi.fn(),
		lookupPath: vi.fn(() => {
			throw new Error('Not found');
		}),
		mkdirTree: vi.fn(),
	};
	const php: any = {
		[__private__dont__use]: { FS },
		semaphore: new Semaphore({ concurrency: 1 }),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		unmount: vi.fn(async () => {}),
		mount: vi.fn(async (mountpoint: string, mountHandler: MountHandler) => {
			if (options.skipMountHandler) {
				return php.unmount;
			}
			return await mountHandler(php, FS as any, mountpoint);
		}),
		isFile: vi.fn(() => false),
		snapshotFilesystem: vi.fn(async () =>
			createSqliteFilesystemSnapshot('default')
		),
		run: vi.fn(async () => ({
			text: JSON.stringify({
				ok: true,
				path: '/tmp/playground-sqlite-snapshot.sqlite',
			}),
		})),
	};
	return php;
}

function createSqliteFilesystemSnapshot(label: string): FilesystemSnapshot {
	const databaseBytes = new TextEncoder().encode(label);
	const walBytes = new TextEncoder().encode(`${label}-wal`);
	return {
		version: 1,
		id: `snapshot-${label}`,
		root: '/wordpress/wp-content/database',
		createdAt: '2026-06-25T00:00:00.000Z',
		entries: [
			{
				type: 'directory',
				path: '/wordpress/wp-content/database',
			},
			{
				type: 'file',
				path: '/wordpress/wp-content/database/.ht.sqlite',
				size: databaseBytes.byteLength,
				hash: `test:${label}`,
				bytes: databaseBytes,
			},
			{
				type: 'file',
				path: '/wordpress/wp-content/database/.ht.sqlite-wal',
				size: walBytes.byteLength,
				hash: `test:${label}-wal`,
				bytes: walBytes,
			},
		],
	};
}

function createEmptyDirectoryHandle() {
	return {
		kind: 'directory',
		name: 'root',
		async *values() {},
	} as unknown as FileSystemDirectoryHandle;
}

function createSqliteLegacyDirectoryHandle() {
	return createDirectoryHandle('root', [
		createDirectoryHandle('wp-content', [
			createDirectoryHandle('database', [
				createFileHandle('.ht.sqlite', 'main database'),
				createFileHandle('.ht.sqlite-wal', 'committed wal frames'),
				createFileHandle('.ht.sqlite-shm', 'wal index'),
				createFileHandle('.ht.sqlite-journal', 'hot journal'),
			]),
		]),
	]) as unknown as FileSystemDirectoryHandle;
}

function createDirectoryHandle(name: string, values: unknown[]) {
	return {
		kind: 'directory',
		name,
		async *values() {
			yield* values;
		},
	};
}

function createFileHandle(name: string, contents: string) {
	return {
		kind: 'file',
		name,
		async getFile() {
			const bytes = new TextEncoder().encode(contents);
			return {
				arrayBuffer: async () => bytes.buffer,
			};
		},
	};
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: any) => void;
	const promise = new Promise<T>((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});
	return { promise, resolve, reject };
}
