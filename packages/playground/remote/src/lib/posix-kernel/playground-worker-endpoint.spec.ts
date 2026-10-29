import { describe, expect, it, vi } from 'vitest';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { PHPRequestHandler } from '@php-wasm/universal';
import type { PHP } from '@php-wasm/universal';
import { dirname } from '@php-wasm/util';
import type { MountDevice } from '@php-wasm/web';
import { CookieJar } from './cookie-jar';
import type { BrowserKernel } from './host-bridge';
import type { KernelSpawnAdapter } from './kernel-spawn-adapter';
import { KernelLimitedPHPApi } from './php-api';
import { KernelPlaygroundWorkerEndpoint } from './playground-worker-endpoint';
import { prepareWordPressZips } from './prepare-wordpress';
import { buildVfsImage } from './vfs-builder';

vi.hoisted(() => {
	vi.stubGlobal('self', { postMessage: () => undefined });
});

vi.mock('@php-wasm/web', () => ({
	exposeAPI: () => [() => undefined, () => undefined],
}));

vi.mock('@wp-playground/storage', () => ({
	directoryHandleFromMountDevice: async (device: unknown) => device,
}));

vi.mock('./prepare-wordpress', () => ({ prepareWordPressZips: vi.fn() }));

vi.mock('./vfs-builder', () => ({ buildVfsImage: vi.fn() }));

function makeEndpoint(absoluteUrl: string): KernelPlaygroundWorkerEndpoint {
	const endpoint = new KernelPlaygroundWorkerEndpoint(
		new EmscriptenDownloadMonitor()
	);
	endpoint.absoluteUrl = absoluteUrl;
	return endpoint;
}

function makeHandler(absoluteUrl: string): PHPRequestHandler {
	return new PHPRequestHandler({
		absoluteUrl,
		php: { isDir: () => true, chdir: () => undefined } as unknown as PHP,
	});
}

const scoped = 'http://127.0.0.1:5400/scope:abc';

describe('KernelPlaygroundWorkerEndpoint.pathToInternalUrl', () => {
	it.each([
		[scoped, '/wp-admin/', `${scoped}/wp-admin/`],
		[`${scoped}/`, '/wp-admin/', `${scoped}/wp-admin/`],
		[scoped, 'wp-admin', `${scoped}/wp-admin`],
		[`${scoped}/`, '/', `${scoped}/`],
		[
			'http://127.0.0.1:5400',
			'/wp-admin/',
			'http://127.0.0.1:5400/wp-admin/',
		],
	])('maps %s + %s like PHPRequestHandler', async (base, path, expected) => {
		expect(await makeEndpoint(base).pathToInternalUrl(path)).toBe(expected);
		expect(makeHandler(base).pathToInternalUrl(path)).toBe(expected);
	});
});

describe('KernelPlaygroundWorkerEndpoint.internalUrlToPath', () => {
	it.each([
		[scoped, `${scoped}/wp-admin/?page=foo#bar`, '/wp-admin/?page=foo#bar'],
		[`${scoped}/`, `${scoped}/wp-admin/`, '/wp-admin/'],
		[
			scoped,
			'http://127.0.0.1:5400/scope:other/wp-admin/',
			'/scope:other/wp-admin/',
		],
		[
			'http://127.0.0.1:5400',
			'http://127.0.0.1:5400/wp-admin/?page=foo',
			'/wp-admin/?page=foo',
		],
	])('maps %s + %s like PHPRequestHandler', async (base, url, expected) => {
		expect(await makeEndpoint(base).internalUrlToPath(url)).toBe(expected);
		expect(makeHandler(base).internalUrlToPath(url)).toBe(expected);
	});
});

const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;

type VfsEntry = { mode: number; data?: string; target?: string };
type OpfsTree = Map<string, OpfsTree | Uint8Array>;

describe('KernelPlaygroundWorkerEndpoint.mountOpfs', () => {
	it('saves /wordpress files and the files that symlinks point to', async () => {
		const { endpoint } = makeMountedEndpoint();
		const opfs: OpfsTree = new Map();

		await endpoint.mountOpfs({
			mountpoint: '/wordpress',
			device: fakeOpfsDirectory(opfs) as unknown as MountDevice,
			initialSyncDirection: 'memfs-to-opfs',
		});

		expect(readOpfsTree(opfs)).toEqual({
			'foo.php': 'foo',
			bar: { 'baz.sqlite': 'baz' },
			'qux.php': 'foo',
		});
	});

	it('writes the changes made after the initial copy', async () => {
		const { endpoint, vfs, emitChange } = makeMountedEndpoint();
		const opfs: OpfsTree = new Map();
		await endpoint.mountOpfs({
			mountpoint: '/wordpress',
			device: fakeOpfsDirectory(opfs) as unknown as MountDevice,
			initialSyncDirection: 'memfs-to-opfs',
		});

		vfs.set('/var/www/html/foo.php', {
			mode: S_IFREG | 0o644,
			data: 'corge',
		});
		emitChange('/var/www/html/foo.php');
		vfs.delete('/var/www/html/bar/baz.sqlite');
		emitChange('/var/www/html/bar/baz.sqlite');
		await endpoint.flushOpfs('/wordpress');

		expect(readOpfsTree(opfs)).toEqual({
			'foo.php': 'corge',
			bar: {},
			'qux.php': 'foo',
		});
	});

	it('keeps a change made while the initial copy runs', async () => {
		const { endpoint, vfs, emitChange, kernel } = makeMountedEndpoint();
		const readFileFromVfs = kernel.readFileFromVfs;
		kernel.readFileFromVfs = async (path: string) => {
			const data = await readFileFromVfs(path);
			if (path === '/var/www/html/foo.php') {
				kernel.readFileFromVfs = readFileFromVfs;
				vfs.set(path, { mode: S_IFREG | 0o644, data: 'grault' });
				emitChange(path);
			}
			return data;
		};
		const opfs: OpfsTree = new Map();
		const delayedWrites = new Set(['foo.php']);

		await endpoint.mountOpfs({
			mountpoint: '/wordpress',
			device: fakeOpfsDirectory(
				opfs,
				delayedWrites
			) as unknown as MountDevice,
			initialSyncDirection: 'memfs-to-opfs',
		});
		await endpoint.flushOpfs('/wordpress');

		expect(readOpfsTree(opfs)['foo.php']).toBe('grault');
	});

	it('copies the whole directory again when the change queue overflows', async () => {
		const { endpoint, vfs, emitChange } = makeMountedEndpoint();
		const opfs: OpfsTree = new Map();
		await endpoint.mountOpfs({
			mountpoint: '/wordpress',
			device: fakeOpfsDirectory(opfs) as unknown as MountDevice,
			initialSyncDirection: 'memfs-to-opfs',
		});

		vfs.set('/var/www/html/bar/garply.php', {
			mode: S_IFREG | 0o644,
			data: 'garply',
		});
		emitChange('/var/www/html');
		await endpoint.flushOpfs('/wordpress');

		expect(readOpfsTree(opfs)['bar']).toEqual({
			'baz.sqlite': 'baz',
			'garply.php': 'garply',
		});
	});

	it('writes the pending changes on unmount, then stops the journal', async () => {
		const { endpoint, vfs, emitChange } = makeMountedEndpoint();
		const opfs: OpfsTree = new Map();
		await endpoint.mountOpfs({
			mountpoint: '/wordpress',
			device: fakeOpfsDirectory(opfs) as unknown as MountDevice,
			initialSyncDirection: 'memfs-to-opfs',
		});

		vfs.set('/var/www/html/foo.php', {
			mode: S_IFREG | 0o644,
			data: 'corge',
		});
		emitChange('/var/www/html/foo.php');
		await endpoint.unmountOpfs('/wordpress');
		vfs.set('/var/www/html/foo.php', {
			mode: S_IFREG | 0o644,
			data: 'waldo',
		});
		emitChange('/var/www/html/foo.php');
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(readOpfsTree(opfs)['foo.php']).toBe('corge');
	});

	it('rejects the save when an OPFS write fails', async () => {
		const { endpoint } = makeMountedEndpoint();
		const device = fakeOpfsDirectory(new Map());
		device.getFileHandle = async (name: string) => {
			throw new DOMException(name, 'NoModificationAllowedError');
		};

		await expect(
			endpoint.mountOpfs({
				mountpoint: '/wordpress',
				device: device as unknown as MountDevice,
				initialSyncDirection: 'memfs-to-opfs',
			})
		).rejects.toThrow(
			'Failed to copy 2 of 3 file(s) to OPFS (/var/www/html/foo.php, ' +
				'/var/www/html/qux.php). The save is incomplete.'
		);
	});

	it('restores /wordpress files and keeps the mode of existing files', async () => {
		const { endpoint, mkdir, writes } = makeMountedEndpoint();
		const encoder = new TextEncoder();
		const opfs: OpfsTree = new Map<string, OpfsTree | Uint8Array>([
			['foo.php', encoder.encode('garply')],
			['bar', new Map([['baz.sqlite', encoder.encode('waldo')]])],
			['corge.php', encoder.encode('grault')],
		]);

		await endpoint.mountOpfs({
			mountpoint: '/wordpress',
			device: fakeOpfsDirectory(opfs) as unknown as MountDevice,
			initialSyncDirection: 'opfs-to-memfs',
		});

		expect(mkdir.mock.calls).toEqual([
			['/var/www/html', '/var/www/html/bar'],
		]);
		expect(writes).toEqual([
			['/var/www/html/foo.php', 'garply', S_IFREG | 0o644],
			['/var/www/html/bar/baz.sqlite', 'waldo', S_IFREG | 0o666],
			['/var/www/html/corge.php', 'grault', 0o644],
		]);
	});

	it('writes the changes made after a restore', async () => {
		const { endpoint, vfs, emitChange } = makeMountedEndpoint();
		const opfs: OpfsTree = new Map();
		await endpoint.mountOpfs({
			mountpoint: '/wordpress',
			device: fakeOpfsDirectory(opfs) as unknown as MountDevice,
			initialSyncDirection: 'opfs-to-memfs',
		});

		vfs.set('/var/www/html/foo.php', {
			mode: S_IFREG | 0o644,
			data: 'corge',
		});
		emitChange('/var/www/html/foo.php');
		await endpoint.flushOpfs('/wordpress');

		expect(readOpfsTree(opfs)).toEqual({ 'foo.php': 'corge' });
	});
});

describe('KernelPlaygroundWorkerEndpoint.captureVfsImage', () => {
	it('builds the image from the zips of the boot request', async () => {
		const wordPressZips = {
			wpVersionQuery: 'foo',
			sqliteVersion: 'trunk' as const,
			corsProxyUrl: 'https://baz.test/',
		};
		const zips = {
			wpZipBytes: new Uint8Array([1]),
			sqliteZipBytes: new Uint8Array([2]),
			sqliteZipStripLeadingDir: 'qux',
			wpVersion: 'foo',
		};
		const database = new Uint8Array([3]);
		vi.mocked(prepareWordPressZips).mockResolvedValue(zips);
		const endpoint = makeEndpoint(scoped);
		Object.assign(endpoint, {
			api: { readFileAsBuffer: async () => database },
			vfsBuildInputs: { wordPressZips },
		});

		await endpoint.captureVfsImage();

		expect(prepareWordPressZips).toHaveBeenCalledWith(
			expect.objectContaining(wordPressZips)
		);
		expect(buildVfsImage).toHaveBeenCalledWith(
			expect.objectContaining({ ...zips, preinstalledDatabase: database })
		);
	});
});

function makeMountedEndpoint() {
	const vfs = new Map<string, VfsEntry>([
		['/var/www/html', { mode: S_IFDIR | 0o755 }],
		['/var/www/html/foo.php', { mode: S_IFREG | 0o644, data: 'foo' }],
		['/var/www/html/bar', { mode: S_IFDIR | 0o755 }],
		[
			'/var/www/html/bar/baz.sqlite',
			{ mode: S_IFREG | 0o666, data: 'baz' },
		],
		[
			'/var/www/html/qux.php',
			{ mode: S_IFLNK | 0o777, target: '/var/www/html/foo.php' },
		],
		[
			'/var/www/html/quux',
			{ mode: S_IFLNK | 0o777, target: '/var/www/html/bar' },
		],
	]);
	const resolve = (path: string) => {
		const entry = vfs.get(path);
		return entry?.target ? vfs.get(entry.target) : entry;
	};
	const writes: Array<[string, string, number]> = [];
	const changeListeners = new Set<(event: { path: string }) => void>();
	const emitChange = (path: string) => {
		for (const listener of changeListeners) {
			listener({ path });
		}
	};
	const kernel = {
		subscribeVfsChanges(
			_prefix: string,
			listener: (event: { path: string }) => void
		) {
			changeListeners.add(listener);
			return () => changeListeners.delete(listener);
		},
		async readDirFromVfs(path: string) {
			return [...vfs]
				.filter(([child]) => child !== path && dirname(child) === path)
				.map(([child, { mode }]) => ({
					name: child.slice(path.length + 1),
					mode,
				}));
		},
		async statVfsPath(path: string) {
			const entry = resolve(path);
			return entry ? { mode: entry.mode } : null;
		},
		async readFileFromVfs(path: string) {
			return new TextEncoder().encode(resolve(path)?.data);
		},
		async writeFileToVfs(path: string, data: Uint8Array, mode: number) {
			writes.push([path, new TextDecoder().decode(data), mode]);
		},
	};
	const mkdir = vi.fn().mockResolvedValue(undefined);
	const adapter = { mkdir } as unknown as KernelSpawnAdapter;
	const endpoint = makeEndpoint(scoped);
	Object.assign(endpoint, {
		api: new KernelLimitedPHPApi({
			absoluteUrl: scoped,
			adapter,
			sendRequest: vi.fn(),
			cookieJar: new CookieJar(),
		}),
		kernel: { kernel: kernel as unknown as BrowserKernel },
		adapter,
	});
	return { endpoint, mkdir, writes, vfs, emitChange, kernel };
}

function fakeOpfsDirectory(tree: OpfsTree, delayedWrites = new Set<string>()) {
	return {
		kind: 'directory',
		async *entries() {
			for (const [name, entry] of tree) {
				yield [
					name,
					entry instanceof Map
						? fakeOpfsDirectory(entry, delayedWrites)
						: fakeOpfsFile(tree, name, delayedWrites),
				];
			}
		},
		async getDirectoryHandle(name: string, options?: { create?: boolean }) {
			if (!tree.has(name)) {
				if (!options?.create) {
					throw new DOMException(name, 'NotFoundError');
				}
				tree.set(name, new Map());
			}
			return fakeOpfsDirectory(tree.get(name) as OpfsTree, delayedWrites);
		},
		async getFileHandle(name: string) {
			return fakeOpfsFile(tree, name, delayedWrites);
		},
		async removeEntry(name: string) {
			if (!tree.delete(name)) {
				throw new DOMException(name, 'NotFoundError');
			}
		},
	};
}

function fakeOpfsFile(
	parent: OpfsTree,
	name: string,
	delayedWrites: Set<string>
) {
	return {
		kind: 'file',
		async getFile() {
			return new Blob([parent.get(name) as Uint8Array]);
		},
		async createWritable() {
			if (delayedWrites.delete(name)) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			return {
				truncate: () => undefined,
				write: (data: Uint8Array) => parent.set(name, data.slice()),
				close: () => undefined,
			};
		},
	};
}

function readOpfsTree(tree: OpfsTree): Record<string, unknown> {
	return Object.fromEntries(
		[...tree].map(([name, entry]) => [
			name,
			entry instanceof Map
				? readOpfsTree(entry)
				: new TextDecoder().decode(entry),
		])
	);
}
