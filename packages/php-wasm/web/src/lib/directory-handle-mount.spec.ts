import { describe, expect, it, vi } from 'vitest';
import { __private__dont__use, type PHP } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import { journalFSEventsToOpfs } from './directory-handle-mount';

class MemoryFileHandle {
	kind = 'file' as const;
	bytes = new Uint8Array();
	name: string;
	private onWrite?: () => void | Promise<void>;

	constructor(name: string, onWrite?: () => void | Promise<void>) {
		this.name = name;
		this.onWrite = onWrite;
	}

	async createWritable() {
		return {
			truncate: async () => {
				this.bytes = new Uint8Array();
			},
			write: async (buffer: BufferSource) => {
				await this.onWrite?.();
				this.bytes = toBytes(buffer);
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
		const { FS, files, php, removeEventListener } = createFakePhp();
		const opfsRoot = new MemoryDirectoryHandle('root');
		const mount = journalFSEventsToOpfs(
			php,
			opfsRoot as unknown as FileSystemDirectoryHandle,
			'/wordpress'
		);

		files.set('/wordpress/file.txt', encode('saved'));
		FS.write({ path: '/wordpress/file.txt' });

		await mount.unmount();

		expect(decode(opfsRoot.files.get('file.txt')!.bytes)).toBe('saved');
		expect(removeEventListener).toHaveBeenCalledWith(
			'filesystem.write',
			expect.any(Function)
		);
		expect(removeEventListener).toHaveBeenCalledWith(
			'request.end',
			expect.any(Function)
		);
	});
});

function createFakePhp() {
	const files = new Map<string, Uint8Array>();
	const FS = {
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
	const addEventListener = vi.fn();
	const removeEventListener = vi.fn();
	const php = {
		[__private__dont__use]: { FS },
		semaphore: new Semaphore({ concurrency: 1 }),
		addEventListener,
		removeEventListener,
	} as unknown as PHP;

	return { FS, addEventListener, files, php, removeEventListener };
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
