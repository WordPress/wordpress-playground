import type { Emscripten } from '@php-wasm/universal';
import { SQLiteSharedMemory } from './sqlite-shared-memory';

describe('SQLiteSharedMemory', () => {
	it('copies WAL-index bytes between runtime mappings at lock boundaries', () => {
		const sharedMemory = new SQLiteSharedMemory();
		const writer = createRuntime(1);
		const reader = createRuntime(2);
		const path = '/tmp/database.sqlite-shm';

		sharedMemory.install(writer.context, resolveStreamPath, identity);
		sharedMemory.install(reader.context, resolveStreamPath, identity);

		const writerMapping = mmap(writer.context, path, 4);
		const readerMapping = mmap(reader.context, path, 4);

		writer.heap.write(writerMapping.ptr, [1, 2, 3, 4]);
		sharedMemory.beforeUnlock(writer.context.pid, path);
		sharedMemory.beforeRangeLock(reader.context.pid, path);

		expect(reader.heap.read(readerMapping.ptr, 4)).toEqual([1, 2, 3, 4]);
	});

	it('does not flush read-only mappings back into shared bytes', () => {
		const sharedMemory = new SQLiteSharedMemory();
		const writer = createRuntime(1);
		const reader = createRuntime(2);
		const observer = createRuntime(3);
		const path = '/tmp/database.sqlite-shm';

		sharedMemory.install(writer.context, resolveStreamPath, identity);
		sharedMemory.install(reader.context, resolveStreamPath, identity);
		sharedMemory.install(observer.context, resolveStreamPath, identity);

		const writerMapping = mmap(writer.context, path, 4);
		const readerMapping = mmap(reader.context, path, 4, PROT_READ);

		writer.heap.write(writerMapping.ptr, [1, 2, 3, 4]);
		sharedMemory.beforeUnlock(writer.context.pid, path);
		sharedMemory.beforeRangeLock(reader.context.pid, path);

		reader.heap.write(readerMapping.ptr, [9, 9, 9, 9]);
		sharedMemory.beforeUnlock(reader.context.pid, path);
		const observerMapping = mmap(observer.context, path, 4);

		expect(observer.heap.read(observerMapping.ptr, 4)).toEqual([
			1, 2, 3, 4,
		]);
	});

	it('does not invalidate peer mappings when flushed bytes are unchanged', () => {
		const sharedMemory = new SQLiteSharedMemory();
		const writer = createRuntime(1);
		const reader = createRuntime(2);
		const path = '/tmp/database.sqlite-shm';

		sharedMemory.install(writer.context, resolveStreamPath, identity);
		sharedMemory.install(reader.context, resolveStreamPath, identity);

		const writerMapping = mmap(writer.context, path, 4);
		const readerMapping = mmap(reader.context, path, 4);
		writer.heap.write(writerMapping.ptr, [1, 2, 3, 4]);
		sharedMemory.beforeUnlock(writer.context.pid, path);
		sharedMemory.beforeRangeLock(reader.context.pid, path);

		reader.heap.set.mockClear();
		sharedMemory.beforeUnlock(writer.context.pid, path);
		sharedMemory.beforeRangeLock(reader.context.pid, path);

		expect(reader.heap.read(readerMapping.ptr, 4)).toEqual([1, 2, 3, 4]);
		expect(reader.heap.set).not.toHaveBeenCalled();
	});

	it('drops runtime mappings after flushing them on process exit', () => {
		const sharedMemory = new SQLiteSharedMemory();
		const writer = createRuntime(1);
		const reader = createRuntime(2);
		const path = '/tmp/database.sqlite-shm';

		sharedMemory.install(writer.context, resolveStreamPath, identity);
		const writerMapping = mmap(writer.context, path, 4);
		writer.heap.write(writerMapping.ptr, [1, 2, 3, 4]);

		sharedMemory.beforeProcessExit(writer.context.pid);
		writer.context.FS.unlink(path);

		sharedMemory.install(reader.context, resolveStreamPath, identity);
		const readerMapping = mmap(reader.context, path, 4);

		expect(reader.heap.read(readerMapping.ptr, 4)).toEqual([0, 0, 0, 0]);
	});

	it('drops writable mappings after doMsync cleanup', () => {
		const sharedMemory = new SQLiteSharedMemory();
		const doMsync = vi.fn();
		const writer = createRuntime(1, doMsync);
		const reader = createRuntime(2);
		const path = '/tmp/database.sqlite-shm';

		sharedMemory.install(writer.context, resolveStreamPath, identity);
		const writerMapping = mmap(writer.context, path, 4);
		writer.heap.write(writerMapping.ptr, [1, 2, 3, 4]);

		writer.context.syscalls.doMsync!(
			writerMapping.ptr,
			{ path } as unknown as Emscripten.FS.FSStream,
			4,
			0,
			0
		);
		writer.context.FS.unlink(path);

		sharedMemory.install(reader.context, resolveStreamPath, identity);
		const readerMapping = mmap(reader.context, path, 4);

		expect(doMsync).toHaveBeenCalledTimes(1);
		expect(reader.heap.read(readerMapping.ptr, 4)).toEqual([0, 0, 0, 0]);
	});

	it('drops runtime mappings when process-exit flushing fails', () => {
		const sharedMemory = new SQLiteSharedMemory();
		const writer = createRuntime(1);
		const reader = createRuntime(2);
		const path = '/tmp/database.sqlite-shm';

		sharedMemory.install(writer.context, resolveStreamPath, identity);
		mmap(writer.context, path, 4);
		writer.heap.get.mockImplementation(() => {
			throw new Error('heap is gone');
		});

		expect(() =>
			sharedMemory.beforeProcessExit(writer.context.pid)
		).toThrow('heap is gone');
		writer.context.FS.unlink(path);

		sharedMemory.install(reader.context, resolveStreamPath, identity);
		const readerMapping = mmap(reader.context, path, 4);

		expect(reader.heap.read(readerMapping.ptr, 4)).toEqual([0, 0, 0, 0]);
	});
});

type TestStream = {
	path: string;
};

type TestContext = Parameters<SQLiteSharedMemory['install']>[0] & {
	FS: Parameters<SQLiteSharedMemory['install']>[0]['FS'] & {
		mmap: (
			stream: TestStream,
			length: number,
			position: number,
			prot: number,
			flags: number
		) => { ptr: number };
	};
};

type TestDoMsync = NonNullable<TestContext['syscalls']['doMsync']>;

function createRuntime(pid: number, doMsync?: TestDoMsync) {
	const heap = createHeap();
	let nextPtr = 128;
	const FS = {
		mmap: vi.fn(() => {
			const ptr = nextPtr;
			nextPtr += 128;
			return { ptr };
		}),
		unlink: vi.fn(),
	} as unknown as TestContext['FS'];

	return {
		heap,
		context: {
			pid,
			memory: {
				HEAPU8: heap,
			},
			syscalls: doMsync ? { doMsync } : {},
			FS,
		} satisfies TestContext,
	};
}

const PROT_WRITE = 2;
const PROT_READ = 1;

function mmap(
	context: TestContext,
	path: string,
	length: number,
	prot = PROT_WRITE
) {
	return context.FS.mmap({ path }, length, 0, prot, 0);
}

function resolveStreamPath(stream: unknown) {
	return (stream as TestStream).path;
}

function identity(path: string) {
	return path;
}

function createHeap() {
	const bytes = new Map<number, number>();
	const heap = {
		get: vi.fn((offset: number) => bytes.get(offset) ?? 0),
		set: vi.fn((offset: number, value: number) => {
			bytes.set(offset, value);
		}),
		write(ptr: number, values: number[]) {
			values.forEach((value, offset) => {
				bytes.set(ptr + offset, value);
			});
		},
		read(ptr: number, length: number) {
			return Array.from({ length }, (_, offset) => {
				return bytes.get(ptr + offset) ?? 0;
			});
		},
	};
	return heap;
}
