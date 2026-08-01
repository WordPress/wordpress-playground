import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	__private__dont__use,
	MountStillActiveError,
} from '@php-wasm/universal';
import type { MountHandler } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';

describe('PlaygroundWorkerEndpoint OPFS flushing', () => {
	afterEach(() => {
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

	it('unmounts an OPFS mount and clears its tracking', async () => {
		const opfsMount = createOpfsMount();
		const unmount = vi.fn(async () => {});
		const endpoint = await createEndpoint(
			{ '/wordpress': opfsMount },
			{ '/wordpress': unmount }
		);

		await endpoint.unmountOpfs('/wordpress');

		expect(unmount).toHaveBeenCalledTimes(1);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
	});

	it('rethrows ordinary unmount errors and clears tracking', async () => {
		// An ordinary unmount error does not guarantee that the mount remains
		// active. Rethrow it unchanged, but clear both registries so a stale
		// callback cannot block a later mountOpfs() call.
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

		expect(unmount).toHaveBeenCalledTimes(1);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
	});

	it('retains endpoint tracking when the inner flush leaves the mount active', async () => {
		const flushError = new Error('inner flush failed');
		const opfsMount = createOpfsMount();
		const unmount = vi
			.fn()
			.mockRejectedValueOnce(new MountStillActiveError(flushError))
			.mockResolvedValueOnce(undefined);
		const endpoint = await createEndpoint(
			{ '/wordpress': opfsMount },
			{ '/wordpress': unmount }
		);

		await expect(endpoint.unmountOpfs('/wordpress')).rejects.toBe(
			flushError
		);
		expect(endpoint.opfsMounts['/wordpress']).toBe(opfsMount);
		expect(endpoint.unmounts['/wordpress']).toBe(unmount);

		await endpoint.unmountOpfs('/wordpress');
		expect(unmount).toHaveBeenCalledTimes(2);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
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
	};
	return php;
}

function createEmptyDirectoryHandle() {
	return {
		kind: 'directory',
		name: 'root',
		async *values() {},
	} as unknown as FileSystemDirectoryHandle;
}
