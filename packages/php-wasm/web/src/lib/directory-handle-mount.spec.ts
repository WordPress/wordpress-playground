import { describe, expect, it, vi } from 'vitest';
import { __private__dont__use, type PHP } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
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
		let handle = this.files.get(name);
		if (handle === undefined) {
			if (!options?.create) {
				throw new Error(`File not found: ${name}`);
			}
			handle = new MemoryFileHandle(name, this.onFileWrite);
			this.files.set(name, handle);
		}
		return handle as unknown as FileSystemFileHandle;
	}

	async getDirectoryHandle(name: string, options?: { create?: boolean }) {
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
}

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

	it('removes listeners even when unmount flush fails', async () => {
		const flushError = new Error('flush failed');
		const { FS, addEventListener, files, php, removeEventListener } =
			createFakePhp();
		const originalWrite = FS.write;
		const opfsRoot = new MemoryDirectoryHandle('root', () => {
			throw flushError;
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

		await expect(mount.unmount()).rejects.toBe(flushError);
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

		files.set('/wordpress/file.txt', encode('second'));
		FS.write({ path: '/wordpress/file.txt' });
		await mount.flush();

		expect(decode(opfsRoot.files.get('file.txt')!.bytes)).toBe('second');
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
