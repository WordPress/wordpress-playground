import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __private__dont__use, PHP } from '@php-wasm/universal';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { loadNodeRuntime } from '@php-wasm/node';
import { Semaphore, joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import {
	copyMemfsToOpfs,
	createDirectoryHandleMountHandler,
	journalFSEventsToOpfs,
} from './directory-handle-mount';

class MemoryFileHandle {
	kind = 'file' as const;
	bytes = new Uint8Array();
	name: string;
	private onWrite?: () => void | Promise<void>;
	private truncated = false;

	constructor(name: string, onWrite?: () => void | Promise<void>) {
		this.name = name;
		this.onWrite = onWrite;
	}

	async createWritable() {
		return {
			truncate: async () => {
				this.bytes = new Uint8Array();
				this.truncated = true;
			},
			write: async (buffer: BufferSource) => {
				if (!this.truncated) {
					throw new Error('write called before truncate');
				}
				this.bytes = toBytes(buffer);
				this.truncated = false;
				await this.onWrite?.();
				return this.bytes.byteLength;
			},
			close: async () => {},
			seek: async () => {},
		};
	}

	async getFile() {
		return new Blob([this.bytes]);
	}
}

class MemoryDirectoryHandle {
	kind = 'directory' as const;
	files = new Map<string, MemoryFileHandle>();
	directories = new Map<string, MemoryDirectoryHandle>();
	name: string;
	private onFileWrite?: () => void | Promise<void>;

	constructor(name: string, onFileWrite?: () => void | Promise<void>) {
		this.name = name;
		this.onFileWrite = onFileWrite;
	}

	async getFileHandle(name: string, options?: { create?: boolean }) {
		if (this.directories.has(name))
			throw new DOMException('Is a directory', 'TypeMismatchError');
		let handle = this.files.get(name);
		if (handle === undefined) {
			if (!options?.create) {
				throw new DOMException(
					`File not found: ${name}`,
					'NotFoundError'
				);
			}
			handle = new MemoryFileHandle(name, this.onFileWrite);
			this.files.set(name, handle);
		}
		return handle as unknown as FileSystemFileHandle;
	}

	async getDirectoryHandle(name: string, options?: { create?: boolean }) {
		if (this.files.has(name))
			throw new DOMException('Is a file', 'TypeMismatchError');
		let handle = this.directories.get(name);
		if (handle === undefined) {
			if (!options?.create) {
				throw new Error(`Directory not found: ${name}`);
			}
			handle = new MemoryDirectoryHandle(name, this.onFileWrite);
			this.directories.set(name, handle);
		}
		return handle as unknown as FileSystemDirectoryHandle;
	}

	async removeEntry(name: string) {
		this.files.delete(name);
		this.directories.delete(name);
	}

	async *values() {
		yield* this.files.values();
		yield* this.directories.values();
	}
}

describe('saved symlinks', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime('8.4'));
	});
	afterEach(() => php.exit());

	it('round-trips raw targets without copying linked files or directories', async () => {
		php.mkdir('/site/real');
		php.writeFile('/site/real/file.txt', 'saved');
		php.writeFile(
			'/site/real/.playground-symlinks.json',
			'ordinary nested file'
		);
		php.mkdir('/shared');
		php.writeFile('/shared/file.txt', 'outside');
		const links = {
			'/file-link': './real/file.txt',
			'/directory-link': 'real',
			'/absolute': '/shared/file.txt',
			'/broken': '../missing',
			'/cycle': '.',
			'/first': 'second',
			'/second': 'first',
		};
		for (const [path, target] of Object.entries(links))
			php.symlink(target, joinPaths('/site', path));
		const root = new MemoryDirectoryHandle('root');
		root.directories.set(
			'directory-link',
			new MemoryDirectoryHandle('directory-link')
		);
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		expect([...root.files.keys()]).toEqual(['.playground-symlinks.json']);
		expect([...root.directories.keys()]).toEqual(['real']);
		const unmount = await php.mount(
			'/restored',
			createDirectoryHandleMountHandler(handle)
		);
		try {
			for (const [path, target] of Object.entries(links)) {
				const restored = joinPaths('/restored', path);
				expect(php.isSymlink(restored)).toBe(true);
				expect(php.readlink(restored)).toBe(target);
			}
			expect(php.readFileAsText('/restored/file-link')).toBe('saved');
			expect(php.readFileAsText('/restored/absolute')).toBe('outside');
			expect(
				php.readFileAsText('/restored/real/.playground-symlinks.json')
			).toBe('ordinary nested file');
			expect(php.listFiles('/restored')).not.toContain(
				'.playground-symlinks.json'
			);
		} finally {
			await unmount();
		}
	});

	it('persists link edits, writes through links, and renamed directories', async () => {
		php.mkdir('/site/dir');
		php.writeFile('/site/dir/file.txt', 'old');
		php.symlink('./file.txt', '/site/dir/link');
		php.symlink('dir/file.txt', '/site/replaced');
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		expect(() =>
			php[__private__dont__use].FS.mkdir('/site/replaced')
		).toThrow();
		php.writeFile('/site/dir/link', 'new');
		php.mv('/site/dir', '/site/moved');
		php.symlink('../missing', '/site/broken');
		await mount.flush();
		php.mv('/site/broken', '/site/temporary');
		php.mv('/site/temporary', '/site/renamed');
		php.mv('/site/moved', '/site/temporary-dir');
		php.mv('/site/temporary-dir', '/site/final');
		php.unlink('/site/replaced');
		php.writeFile('/site/replaced', 'regular file');
		await mount.unmount();
		const unmount = await php.mount(
			'/site',
			createDirectoryHandleMountHandler(handle)
		);
		try {
			expect(php.listFiles('/site').sort()).toEqual([
				'final',
				'renamed',
				'replaced',
			]);
			expect(php.readlink('/site/final/link')).toBe('./file.txt');
			expect(php.readFileAsText('/site/final/link')).toBe('new');
			expect(php.readlink('/site/renamed')).toBe('../missing');
			expect(php.isSymlink('/site/replaced')).toBe(false);
			expect(php.readFileAsText('/site/replaced')).toBe('regular file');
		} finally {
			await unmount();
		}
	});

	it('removes links in deleted subtrees and moved-out paths', async () => {
		php.mkdir('/site/dir');
		php.symlink('../missing', '/site/dir/link');
		php.symlink('.', '/site/dir-sibling');
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		php.rmdir('/site/dir');
		await mount.flush();
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/dir-sibling': '.' });
		php.mv('/site/dir-sibling', '/outside');
		await mount.unmount();
		expect(root.files.has('.playground-symlinks.json')).toBe(false);
	});

	it('writes the index once for a batch of link creates, renames, and deletes', async () => {
		php.mkdir('/site');
		php.symlink('missing', '/site/kept');
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		const writeIndex = vi.spyOn(
			root.files.get('.playground-symlinks.json')!,
			'createWritable'
		);
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		for (let i = 0; i < 100; i++) {
			php.symlink(`../target-${i}`, `/site/link-${i}`);
		}
		php.mv('/site/kept', '/site/renamed');
		php.unlink('/site/link-0');
		await mount.flush();
		expect(writeIndex).toHaveBeenCalledTimes(1);
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({
			...Object.fromEntries(
				Array.from({ length: 99 }, (_, i) => [
					`/link-${i + 1}`,
					`../target-${i + 1}`,
				])
			),
			'/renamed': 'missing',
		});
		await mount.unmount();
		expect(writeIndex).toHaveBeenCalledTimes(1);
	});

	it('retries a failed index write without losing the renamed link', async () => {
		php.mkdir('/site');
		php.symlink('missing', '/site/link');
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		const removeEntry = vi.spyOn(root, 'removeEntry');
		vi.spyOn(
			root.files.get('.playground-symlinks.json')!,
			'createWritable'
		).mockRejectedValueOnce(new Error('Quota exceeded'));
		php.mv('/site/link', '/site/renamed');
		await expect(mount.flush()).rejects.toThrow('Quota exceeded');
		removeEntry.mockClear();
		await mount.unmount();
		expect(removeEntry).not.toHaveBeenCalled();
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/renamed': 'missing' });
	});

	it('retries a failed index update after deleting a link', async () => {
		php.mkdir('/site');
		php.symlink('missing', '/site/deleted');
		php.symlink('missing', '/site/kept');
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		vi.spyOn(
			root.files.get('.playground-symlinks.json')!,
			'createWritable'
		).mockRejectedValueOnce(new Error('Quota exceeded'));
		php.unlink('/site/deleted');
		await expect(mount.flush()).rejects.toThrow('Quota exceeded');
		await mount.unmount();
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/kept': 'missing' });
	});

	it('combines a failed index write with link changes queued before retry', async () => {
		php.mkdir('/site');
		php.symlink('missing', '/site/old');
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		const writeIndex = vi
			.spyOn(
				root.files.get('.playground-symlinks.json')!,
				'createWritable'
			)
			.mockRejectedValueOnce(new Error('Quota exceeded'));
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		php.symlink('../missing', '/site/new');
		await expect(mount.flush()).rejects.toThrow('Quota exceeded');
		php.unlink('/site/new');
		php.symlink('.', '/site/latest');
		await mount.unmount();
		expect(writeIndex).toHaveBeenCalledTimes(2);
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/old': 'missing', '/latest': '.' });
	});

	it('keeps completed link changes when a later file write fails', async () => {
		php.mkdir('/site');
		php.writeFile('/site/file', 'old');
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		vi.spyOn(
			root.files.get('file')!,
			'createWritable'
		).mockRejectedValueOnce(new Error('File write failed'));
		const removeEntry = vi.spyOn(root, 'removeEntry');
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		php.symlink('../missing', '/site/link');
		php.writeFile('/site/file', 'new');
		await expect(mount.flush()).rejects.toThrow('File write failed');
		removeEntry.mockClear();
		await mount.unmount();
		expect(removeEntry).not.toHaveBeenCalled();
		expect(decode(root.files.get('file')!.bytes)).toBe('new');
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/link': '../missing' });
	});

	it('keeps the mount attached until removing the last saved link succeeds', async () => {
		php.mkdir('/site');
		php.symlink('missing', '/site/link');
		const FS = php[__private__dont__use].FS;
		const originalSymlink = FS.symlink;
		const root = new MemoryDirectoryHandle('root');
		const handle = root as unknown as FileSystemDirectoryHandle;
		await copyMemfsToOpfs(FS, handle, '/site');
		const removeEntry = root.removeEntry.bind(root);
		const failure = new Error('Cannot remove index');
		let failRemoval = true;
		vi.spyOn(root, 'removeEntry').mockImplementation(async (name) => {
			if (name === '.playground-symlinks.json' && failRemoval) {
				failRemoval = false;
				throw failure;
			}
			await removeEntry(name);
		});
		const mount = journalFSEventsToOpfs(php, handle, '/site');
		php.unlink('/site/link');
		await expect(mount.unmount()).rejects.toMatchObject({
			name: 'MountStillActiveError',
			cause: failure,
		});
		expect(FS.symlink).not.toBe(originalSymlink);
		await mount.unmount();
		expect(FS.symlink).toBe(originalSymlink);
		expect(root.files.has('.playground-symlinks.json')).toBe(false);
	});

	it('flushes link changes captured while the index is being written', async () => {
		php.mkdir('/site');
		const writeStarted = deferred<void>();
		const releaseWrite = deferred<void>();
		let writes = 0;
		const root = new MemoryDirectoryHandle('root', async () => {
			if (++writes === 1) {
				writeStarted.resolve();
				await releaseWrite.promise;
			}
		});
		const mount = journalFSEventsToOpfs(
			php,
			root as unknown as FileSystemDirectoryHandle,
			'/site'
		);
		php.symlink('../missing', '/site/first');
		const flush = mount.flush();
		await writeStarted.promise;
		php.symlink('.', '/site/second');
		releaseWrite.resolve();
		await flush;
		expect(writes).toBe(2);
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/first': '../missing', '/second': '.' });
		await mount.unmount();
	});

	it('can retry the first save when writing its new index fails', async () => {
		php.mkdir('/site');
		php.symlink('missing', '/site/link');
		let failWrite = true;
		const root = new MemoryDirectoryHandle('root', () => {
			if (failWrite) {
				failWrite = false;
				throw new Error('Quota exceeded');
			}
		});
		const handle = root as unknown as FileSystemDirectoryHandle;
		await expect(
			copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site')
		).rejects.toThrow('Quota exceeded');
		await copyMemfsToOpfs(php[__private__dont__use].FS, handle, '/site');
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/link': 'missing' });
	});

	it('replays links created during the initial copy after saving its index', async () => {
		php.mkdir('/site');
		php.writeFile('/site/file', 'saved');
		const writeStarted = deferred<void>();
		const releaseWrite = deferred<void>();
		let firstWrite = true;
		const root = new MemoryDirectoryHandle('root', async () => {
			if (firstWrite) {
				firstWrite = false;
				writeStarted.resolve();
				await releaseWrite.promise;
			}
		});
		let mount!: { flush(): Promise<void> };
		const copy = php.mount(
			'/site',
			createDirectoryHandleMountHandler(
				root as unknown as FileSystemDirectoryHandle,
				{
					initialSync: { direction: 'memfs-to-opfs' },
					onMount: (value) => {
						mount = value;
					},
				}
			)
		);
		await writeStarted.promise;
		php.symlink('./file', '/site/link');
		const flush = mount.flush();
		releaseWrite.resolve();
		const unmount = await copy;
		await flush;
		await unmount();
		expect(
			JSON.parse(
				decode(root.files.get('.playground-symlinks.json')!.bytes)
			).links
		).toEqual({ '/link': './file' });
	});

	it.each([
		'not JSON',
		JSON.stringify({ version: 2, links: {} }),
		JSON.stringify({ version: 1, links: { '/../escape': 'target' } }),
		JSON.stringify({
			version: 1,
			links: { '/link': '/shared', '/link/child': 'target' },
		}),
	])('rejects an invalid saved index: %s', async (contents) => {
		const root = new MemoryDirectoryHandle('root');
		const file = new MemoryFileHandle('.playground-symlinks.json');
		file.bytes = encode(contents);
		root.files.set(file.name, file);
		await expect(
			php.mount(
				'/site',
				createDirectoryHandleMountHandler(
					root as unknown as FileSystemDirectoryHandle
				)
			)
		).rejects.toThrow();
		expect(php.fileExists('/escape')).toBe(false);
	});

	it('rejects a real file at the reserved path instead of overwriting it', async () => {
		php.mkdir('/site');
		php.writeFile('/site/.playground-symlinks.json', 'keep');
		const root = new MemoryDirectoryHandle('root');
		await expect(
			copyMemfsToOpfs(
				php[__private__dont__use].FS,
				root as unknown as FileSystemDirectoryHandle,
				'/site'
			)
		).rejects.toThrow('reserved');
		expect(php.readFileAsText('/site/.playground-symlinks.json')).toBe(
			'keep'
		);
	});
});

describe('loading saved OPFS files', () => {
	it('bounds queued reads as well as active reads for large directories', async () => {
		const { FS, php } = createFakePhp();
		FS.lookupPath.mockImplementation(() => {
			throw new Error('Not mounted yet');
		});
		const releaseReads = deferred<void>();
		const createDataFile = vi.fn();
		let enumerated = 0;
		const root = {
			async *values() {
				for (let i = 0; i < 200; i++) {
					enumerated++;
					yield {
						kind: 'file',
						name: `file-${i}`,
						async getFile() {
							await releaseReads.promise;
							return new Blob(['saved']);
						},
					};
				}
			},
		} as unknown as FileSystemDirectoryHandle;
		const mount = createDirectoryHandleMountHandler(root);
		const copy = mount(php, { ...FS, createDataFile } as any, '/wordpress');
		try {
			await vi.waitFor(() =>
				expect(enumerated).toBeGreaterThanOrEqual(40)
			);
			// One entry may be waiting for a slot. The rest must stay in the
			// directory iterator instead of accumulating pending promises.
			expect(enumerated).toBeLessThanOrEqual(41);
		} finally {
			releaseReads.resolve();
			await copy;
		}
		expect(createDataFile).toHaveBeenCalledTimes(200);
	});
	it('reports a read failure after draining outstanding reads', async () => {
		const { FS, php } = createFakePhp();
		FS.lookupPath.mockImplementation(() => {
			throw new Error('Not mounted yet');
		});
		const releaseRead = deferred<void>();
		const failedRead = new Error('Cannot read saved file');
		const createDataFile = vi.fn();
		const onMount = vi.fn();
		const root = {
			async *values() {
				yield {
					kind: 'file',
					name: 'slow',
					getFile: async () => {
						await releaseRead.promise;
						return new Blob(['saved']);
					},
				};
				yield {
					kind: 'file',
					name: 'broken',
					getFile: async () => {
						throw failedRead;
					},
				};
			},
		} as unknown as FileSystemDirectoryHandle;
		let settled = false;
		const copy = createDirectoryHandleMountHandler(root, {
			initialSync: {},
			onMount,
		})(php, { ...FS, createDataFile } as any, '/wordpress');
		void Promise.resolve(copy).then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			}
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(settled).toBe(false);
		releaseRead.resolve();
		await expect(copy).rejects.toBe(failedRead);
		expect(createDataFile).toHaveBeenCalledTimes(1);
		expect(onMount).not.toHaveBeenCalled();
	});
});

describe('journalFSEventsToOpfs', () => {
	it('flushes pending journaled file changes to OPFS', async () => {
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root');
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });

		await mount.flush();

		expect(decode(opfsRoot.files.get('file.txt')!.bytes)).toBe('saved');
	});

	it.each(['filesystem.write', 'request.end'] as const)(
		'flushes pending writes when %s is dispatched',
		async (eventType) => {
			const flushed = deferred<void>();
			const { FS, dispatchEvent, files, php } = createFakePhp();
			const opfsRoot = new MemoryDirectoryHandle('root', () => {
				flushed.resolve();
			});
			journalFSEventsToOpfs(
				php,
				opfsRoot as unknown as FileSystemDirectoryHandle,
				'/wordpress'
			);

			files.set('/wordpress/file.txt', encode('saved'));
			FS.write({ path: '/wordpress/file.txt' });
			dispatchEvent(eventType);

			await flushed.promise;
			expect(decode(opfsRoot.files.get('file.txt')!.bytes)).toBe('saved');
		}
	);

	it('reuses the in-flight flush promise for concurrent flushes', async () => {
		let resolveWrite: () => void = () => {};
		const writeStarted = new Promise<void>((resolve) => {
			resolveWrite = resolve;
		});
		const releaseWrite = deferred<void>();
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', async () => {
			resolveWrite();
			await releaseWrite.promise;
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });
		const firstFlush = mount.flush();
		await writeStarted;
		const secondFlush = mount.flush();

		expect(secondFlush).toBe(firstFlush);
		releaseWrite.resolve();
		await firstFlush;
	});

	it('waits for an in-flight flush when discarding an incomplete mount', async () => {
		const writeStarted = deferred<void>();
		const releaseWrite = deferred<void>();
		const { FS, files, php, removeEventListener } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', async () => {
			writeStarted.resolve();
			await releaseWrite.promise;
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);
		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });
		void mount.flush();
		await writeStarted.promise;

		let discardSettled = false;
		const discard = mount.discard().then(() => {
			discardSettled = true;
		});
		await Promise.resolve();

		expect(removeEventListener).toHaveBeenCalled();
		expect(discardSettled).toBe(false);

		releaseWrite.resolve();
		await discard;
		expect(discardSettled).toBe(true);
	});

	it('processes new writes on a subsequent flush after the previous flush succeeded', async () => {
		// Regression guard for the `flushPromise` single-flight reset on the
		// success path. If `flushPromise` were not cleared in the `.finally()`
		// callback after a successful flush, a subsequent `flush()` call would
		// return the already-resolved promise and silently skip any new
		// journal entries that arrived after the first flush completed.
		//
		// The existing "can retry after a failed explicit flush" test covers
		// the reset after a rejection; this test covers the reset after a
		// fulfillment.
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root');
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/first.txt', encode('first'));
		FS.write({ path: '/wordpress/first.txt' });
		const firstFlush = mount.flush();
		await firstFlush;
		expect(decode(opfsRoot.files.get('first.txt')!.bytes)).toBe('first');

		files.set('/wordpress/second.txt', encode('second'));
		FS.write({ path: '/wordpress/second.txt' });
		const secondFlush = mount.flush();

		// A new flush must produce a new promise instance. If it is the
		// same promise returned from `firstFlush`, the single-flight state
		// was never cleared and the new write will not be processed.
		expect(secondFlush).not.toBe(firstFlush);

		await secondFlush;
		expect(decode(opfsRoot.files.get('second.txt')!.bytes)).toBe('second');
	});

	it('flushes writes that arrive while a flush is running', async () => {
		let writeCount = 0;
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			writeCount++;
			if (writeCount === 1) {
				files.set('/wordpress/second.txt', encode('second'));
				FS.write({ path: '/wordpress/second.txt' });
			}
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/first.txt', encode('first'));
		FS.write({ path: '/wordpress/first.txt' });

		await mount.flush();

		expect(decode(opfsRoot.files.get('first.txt')!.bytes)).toBe('first');
		expect(decode(opfsRoot.files.get('second.txt')!.bytes)).toBe('second');
	});

	it('flushes pending writes before unmounting', async () => {
		const { FS, addEventListener, files, php, removeEventListener } =
			createFakePhp();
		const originalWrite = FS.write;
		const opfsRoot = new MemoryDirectoryHandle('root');
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);
		const requestEndListener = addEventListener.mock.calls.find(
			([eventType]) => eventType === 'request.end'
		)![1];
		const filesystemWriteListener = addEventListener.mock.calls.find(
			([eventType]) => eventType === 'filesystem.write'
		)![1];

		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });

		await mount.unmount();

		expect(decode(opfsRoot.files.get('file.txt')!.bytes)).toBe('saved');
		expect(removeEventListener).toHaveBeenCalledWith(
			'filesystem.write',
			filesystemWriteListener
		);
		expect(removeEventListener).toHaveBeenCalledWith(
			'request.end',
			requestEndListener
		);
		expect(FS.write).toBe(originalWrite);
	});

	it('flushes writes queued as the in-flight flush settles before unmounting', async () => {
		const writeStarted = deferred<void>();
		const releaseWrite = deferred<void>();
		let writeCount = 0;
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', async () => {
			writeCount++;
			if (writeCount === 1) {
				writeStarted.resolve();
				await releaseWrite.promise;
			}
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/first.txt', encode('first'));
		FS.write({ path: '/wordpress/first.txt' });
		const inFlightFlush = mount.flush();
		await writeStarted.promise;
		const enqueueAtFlushBoundary = inFlightFlush.then(() => {
			files.set('/wordpress/second.txt', encode('second'));
			FS.write({ path: '/wordpress/second.txt' });
		});
		const unmount = mount.unmount();

		releaseWrite.resolve();
		await Promise.all([enqueueAtFlushBoundary, unmount]);

		expect(decode(opfsRoot.files.get('first.txt')!.bytes)).toBe('first');
		expect(decode(opfsRoot.files.get('second.txt')!.bytes)).toBe('second');
	});

	it('keeps listeners until a failed unmount flush can be retried', async () => {
		const flushError = new Error('flush failed');
		let shouldFail = true;
		const { FS, addEventListener, files, php, removeEventListener } =
			createFakePhp();
		const originalWrite = FS.write;
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			if (shouldFail) {
				shouldFail = false;
				throw flushError;
			}
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);
		const requestEndListener = addEventListener.mock.calls.find(
			([eventType]) => eventType === 'request.end'
		)![1];
		const filesystemWriteListener = addEventListener.mock.calls.find(
			([eventType]) => eventType === 'filesystem.write'
		)![1];

		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });

		await expect(mount.unmount()).rejects.toMatchObject({
			name: 'MountStillActiveError',
			cause: flushError,
		});
		expect(removeEventListener).not.toHaveBeenCalled();
		expect(FS.write).not.toBe(originalWrite);

		await mount.unmount();
		expect(removeEventListener).toHaveBeenCalledWith(
			'filesystem.write',
			filesystemWriteListener
		);
		expect(removeEventListener).toHaveBeenCalledWith(
			'request.end',
			requestEndListener
		);
		expect(FS.write).toBe(originalWrite);
	});

	it('logs background flush failures without throwing synchronously', async () => {
		const flushError = new Error('background flush failed');
		const logged = deferred<void>();
		const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {
			logged.resolve();
		});
		const { FS, dispatchEvent, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			throw flushError;
		});
		journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });

		expect(() => dispatchEvent('filesystem.write')).not.toThrow();
		await logged.promise;
		expect(loggerError).toHaveBeenCalledWith(flushError);
		loggerError.mockRestore();
	});

	it('preserves a quota failure when the errored stream also rejects cleanup', async () => {
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root');
		const file = await opfsRoot.getFileHandle('file.txt', { create: true });
		const failure = new DOMException(
			'Browser storage is full',
			'QuotaExceededError'
		);
		const abort = vi
			.fn()
			.mockRejectedValue(new TypeError('Stream is errored'));
		vi.spyOn(file, 'createWritable').mockResolvedValue({
			truncate: vi.fn().mockResolvedValue(undefined),
			write: vi.fn().mockRejectedValue(failure),
			close: vi
				.fn()
				.mockRejectedValue(
					new TypeError('Cannot close an errored stream')
				),
			abort,
		} as unknown as FileSystemWritableFileStream);
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);
		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });
		await expect(mount.flush()).rejects.toBe(failure);
		expect(abort).toHaveBeenCalledOnce();
	});

	it('can retry after a failed explicit flush', async () => {
		let failNextWrite = true;
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			if (failNextWrite) {
				failNextWrite = false;
				throw new Error('temporary flush failure');
			}
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/file.txt', encode('first'));
		FS.write({ path: '/wordpress/file.txt' });
		await expect(mount.flush()).rejects.toThrow('temporary flush failure');

		await mount.flush();

		expect(decode(opfsRoot.files.get('file.txt')!.bytes)).toBe('first');
	});

	it('retries only the failed suffix of a partially completed batch', async () => {
		let writeCount = 0;
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			writeCount++;
			if (writeCount === 2) {
				throw new Error('second write failed');
			}
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/first.txt', encode('first'));
		files.set('/wordpress/second.txt', encode('second'));
		FS.write({ path: '/wordpress/first.txt' });
		FS.write({ path: '/wordpress/second.txt' });

		await expect(mount.flush()).rejects.toThrow('second write failed');
		await mount.flush();

		expect(writeCount).toBe(3);
		expect(decode(opfsRoot.files.get('first.txt')!.bytes)).toBe('first');
		expect(decode(opfsRoot.files.get('second.txt')!.bytes)).toBe('second');
	});

	it('fails explicit flushes that never settle instead of hanging', async () => {
		let writeCount = 0;
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			writeCount++;
			const path = `/wordpress/requeued-${writeCount}.txt`;
			files.set(path, encode(`requeued ${writeCount}`));
			FS.write({ path });
		});
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress',
			{ maxFlushPasses: 2 }
		);

		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });

		await expect(mount.flush()).rejects.toThrow(
			'OPFS flush for "/wordpress" did not settle after 2 journal batches; 1 journal entry remains. This can happen when filesystem writes are continuously enqueued while flushing.'
		);
	});
});

describe('createDirectoryHandleMountHandler', () => {
	it('fails loud when a single OPFS write rejects instead of reporting a complete copy', async () => {
		// Regression guard: a transient per-file OPFS write failure (e.g.
		// Safari's "Invalid platform file handle" near the sync-access-handle
		// limit) used to be swallowed — the rejected write lost the internal
		// Promise.race / sat in the never-raced final batch, was absorbed by the
		// finally's Promise.allSettled, and the copy resolved at "100%". The save
		// then looked complete on disk while missing a core file, and the next
		// boot fatally required() it. The copy must now reject so callers keep
		// the save marked incomplete.
		const { FS, files } = createFakePhp();
		// Two files (< the 100-write concurrency limit) both land in the final
		// batch that Promise.race never inspects — the exact swallowed regime.
		FS.readdir.mockReturnValue(['.', '..', 'ok.txt', 'autoload.php']);
		files.set('/wordpress/ok.txt', encode('ok'));
		files.set('/wordpress/autoload.php', encode('<?php'));

		const opfsRoot = new MemoryDirectoryHandle('root');
		const realGetFileHandle = opfsRoot.getFileHandle.bind(opfsRoot);
		opfsRoot.getFileHandle = (async (
			name: string,
			options?: { create?: boolean }
		) => {
			if (name === 'autoload.php') {
				return {
					kind: 'file',
					name,
					createWritable: async () => ({
						truncate: async () => {},
						write: async () => {
							throw new Error(
								'UnknownError: Invalid platform file handle'
							);
						},
						close: async () => {},
						seek: async () => {},
					}),
				} as unknown as FileSystemFileHandle;
			}
			return realGetFileHandle(name, options);
		}) as typeof opfsRoot.getFileHandle;

		await expect(
			copyMemfsToOpfs(
				FS as any,
				opfsRoot as unknown as FileSystemDirectoryHandle,
				'/wordpress'
			)
		).rejects.toMatchObject({
			message: expect.stringContaining('/wordpress/autoload.php'),
			cause: expect.objectContaining({
				message: 'UnknownError: Invalid platform file handle',
			}),
		});

		// The healthy file was written; the failing one was dropped — a partial
		// copy, which is exactly why the whole operation must reject.
		expect(decode(opfsRoot.files.get('ok.txt')!.bytes)).toBe('ok');
		expect(opfsRoot.files.has('autoload.php')).toBe(false);
	});

	it('discards the journal and preserves the copy error when initial sync fails', async () => {
		const copyError = new Error('initial copy failed');
		const flushError = new Error('rollback flush failed');
		const { FS, dispatchEvent, files, php, removeEventListener } =
			createFakePhp();
		const originalWrite = FS.write;
		FS.readdir.mockReturnValue(['.', '..', 'bad.txt']);
		files.set('/wordpress/bad.txt', encode('bad'));
		let writeCount = 0;
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			writeCount++;
			if (writeCount === 1) {
				files.set('/wordpress/live.txt', encode('live'));
				FS.write({ path: '/wordpress/live.txt' });
				dispatchEvent('filesystem.write');
				throw copyError;
			}
			throw flushError;
		});
		const loggerError = vi
			.spyOn(logger, 'error')
			.mockImplementation(() => {});
		const mountHandler = createDirectoryHandleMountHandler(
			opfsRoot as unknown as FileSystemDirectoryHandle,
			{
				initialSync: { direction: 'memfs-to-opfs' },
			}
		);

		try {
			await expect(
				mountHandler(php, FS as any, '/wordpress')
			).rejects.toMatchObject({ cause: copyError });
			expect(loggerError).toHaveBeenCalledWith(
				'OPFS flush failed while discarding a mount',
				flushError
			);
			expect(removeEventListener).toHaveBeenCalledWith(
				'request.end',
				expect.any(Function)
			);
			expect(removeEventListener).toHaveBeenCalledWith(
				'filesystem.write',
				expect.any(Function)
			);
			expect(FS.write).toBe(originalWrite);
		} finally {
			loggerError.mockRestore();
		}
	});

	it('flushes changes made while the initial MEMFS to OPFS sync is still running', async () => {
		let changedDuringInitialSync = false;
		let mount: { flush(): Promise<void> } | undefined;
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			if (changedDuringInitialSync) {
				return;
			}
			changedDuringInitialSync = true;
			files.set('/wordpress/database.sqlite', encode('changed'));
			FS.write({ path: '/wordpress/database.sqlite' });
		});
		files.set('/wordpress/database.sqlite', encode('initial'));

		const mountHandler = createDirectoryHandleMountHandler(
			opfsRoot as unknown as FileSystemDirectoryHandle,
			{
				initialSync: {
					direction: 'memfs-to-opfs',
				},
				onMount: (createdMount) => {
					mount = createdMount;
				},
			}
		);

		await mountHandler(php, FS as any, '/wordpress');
		await mount!.flush();

		expect(decode(opfsRoot.files.get('database.sqlite')!.bytes)).toBe(
			'changed'
		);
	});

	it('does not block the initial MEMFS to OPFS sync on the final flush', async () => {
		let mount: { flush(): Promise<void> } | undefined;
		let changedDuringInitialSync = false;
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			if (changedDuringInitialSync) {
				return;
			}
			changedDuringInitialSync = true;
			FS.write({ path: '/wordpress/database.sqlite' });
		});
		files.set('/wordpress/database.sqlite', encode('initial'));
		const releaseSemaphore = await php.semaphore.acquire();

		const mountHandler = createDirectoryHandleMountHandler(
			opfsRoot as unknown as FileSystemDirectoryHandle,
			{
				initialSync: {
					direction: 'memfs-to-opfs',
				},
				onMount: (createdMount) => {
					mount = createdMount;
				},
			}
		);

		await mountHandler(php, FS as any, '/wordpress');
		releaseSemaphore();
		await mount!.flush();

		expect(decode(opfsRoot.files.get('database.sqlite')!.bytes)).toBe(
			'initial'
		);
	});

	it('reports a flushing phase after the initial MEMFS to OPFS copy', async () => {
		const progressEvents: Array<{
			files: number;
			total: number;
			phase?: 'copying' | 'flushing';
		}> = [];
		const { FS, files, php } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root');
		files.set('/wordpress/database.sqlite', encode('initial'));

		const mountHandler = createDirectoryHandleMountHandler(
			opfsRoot as unknown as FileSystemDirectoryHandle,
			{
				initialSync: {
					direction: 'memfs-to-opfs',
					onProgress: (progress) => {
						progressEvents.push(progress);
					},
				},
			}
		);

		await mountHandler(php, FS as any, '/wordpress');

		expect(progressEvents[0]).toEqual({
			files: 0,
			total: 1,
			phase: 'copying',
		});
		expect(progressEvents).toContainEqual({
			files: 1,
			total: 1,
			phase: 'flushing',
		});
	});

	it('handles rejected async throttled progress callbacks', async () => {
		vi.useFakeTimers();
		const loggerError = vi
			.spyOn(logger, 'error')
			.mockImplementation(() => {});

		try {
			const progressError = new Error('progress failed');
			const releaseWrite = deferred<void>();
			let writeCount = 0;
			const { FS, files } = createFakePhp();
			const opfsRoot = new MemoryDirectoryHandle('root', () => {
				writeCount++;
				if (writeCount === 2) {
					return releaseWrite.promise;
				}
				return undefined;
			});
			FS.readdir.mockReturnValue(['.', '..', 'first.txt', 'second.txt']);
			files.set('/wordpress/first.txt', encode('first'));
			files.set('/wordpress/second.txt', encode('second'));

			const copyPromise = copyMemfsToOpfs(
				FS as any,
				opfsRoot as unknown as FileSystemDirectoryHandle,
				'/wordpress',
				async (progress) => {
					if (progress.files > 0 && progress.files < progress.total) {
						throw progressError;
					}
				}
			);

			await vi.advanceTimersByTimeAsync(100);
			expect(loggerError).toHaveBeenCalledWith(
				'Throttled progress callback failed',
				{
					error: progressError,
				}
			);

			releaseWrite.resolve();
			await copyPromise;
		} finally {
			loggerError.mockRestore();
			vi.useRealTimers();
		}
	});

	it('does not emit stale copy progress after the final progress event', async () => {
		vi.useFakeTimers();

		try {
			const progressEvents: Array<{ files: number; total: number }> = [];
			const { FS, files } = createFakePhp();
			const opfsRoot = new MemoryDirectoryHandle('root');
			FS.readdir.mockReturnValue(['.', '..', 'first.txt', 'second.txt']);
			files.set('/wordpress/first.txt', encode('first'));
			files.set('/wordpress/second.txt', encode('second'));

			await copyMemfsToOpfs(
				FS as any,
				opfsRoot as unknown as FileSystemDirectoryHandle,
				'/wordpress',
				(progress) => {
					progressEvents.push(progress);
				}
			);

			const progressEventCount = progressEvents.length;
			await vi.advanceTimersByTimeAsync(1000);

			expect(progressEvents).toHaveLength(progressEventCount);
			expect(progressEvents.at(-1)).toEqual({
				files: 2,
				total: 2,
			});
		} finally {
			vi.useRealTimers();
		}
	});
});

function createFakePhp() {
	const files = new Map<string, Uint8Array>();
	const FS = {
		mkdirTree: vi.fn(),
		readdir: vi.fn(() => ['.', '..', 'database.sqlite']),
		write: vi.fn(),
		truncate: vi.fn(),
		unlink: vi.fn(),
		symlink: vi.fn(),
		mknod: vi.fn(),
		mkdir: vi.fn(),
		rmdir: vi.fn(),
		rename: vi.fn(),
		lookupPath: vi.fn((path: string) => ({
			path,
			node: { mode: 0, path },
		})),
		getPath: vi.fn((node: { path: string }) => node.path),
		isFile: vi.fn(() => true),
		isDir: vi.fn(() => false),
		isLink: vi.fn(() => false),
		readFile: vi.fn((path: string) => {
			const file = files.get(path);
			if (file === undefined) {
				throw new Error(`Missing file: ${path}`);
			}
			return file;
		}),
	};
	const listeners = new Map<string, Set<(event: { type: string }) => void>>();
	const addEventListener = vi.fn(
		(eventType: string, listener: (event: { type: string }) => void) => {
			if (!listeners.has(eventType)) {
				listeners.set(eventType, new Set());
			}
			listeners.get(eventType)!.add(listener);
		}
	);
	const removeEventListener = vi.fn(
		(eventType: string, listener: (event: { type: string }) => void) => {
			listeners.get(eventType)?.delete(listener);
		}
	);
	const php = {
		[__private__dont__use]: { FS },
		semaphore: new Semaphore({ concurrency: 1 }),
		addEventListener,
		removeEventListener,
	} as unknown as PHP;
	const dispatchEvent = (eventType: string) => {
		for (const listener of listeners.get(eventType) ?? []) {
			listener({ type: eventType });
		}
	};

	return {
		FS,
		addEventListener,
		dispatchEvent,
		files,
		php,
		removeEventListener,
	};
}

function deferred<T>() {
	let resolve: (value: T | PromiseLike<T>) => void = () => {};
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

function encode(text: string) {
	return new TextEncoder().encode(text);
}

function decode(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes);
}

function toBytes(buffer: BufferSource) {
	if (buffer instanceof ArrayBuffer) {
		return new Uint8Array(buffer.slice(0));
	}
	return new Uint8Array(
		buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		)
	);
}
