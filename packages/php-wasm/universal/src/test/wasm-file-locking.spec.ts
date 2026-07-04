import type {
	FileLockManager,
	WasmFileLockAdapter,
	WasmFileLockingUserSpaceContext,
} from '../lib';
import { bindFileLockingUserSpace } from '../lib';

describe('bindFileLockingUserSpace', () => {
	it('releases fd locks even when adapter close cleanup throws', () => {
		const manager = createLockManager();
		const adapter = createLockAdapter({
			beforeFdClose: () => {
				throw new Error('close cleanup failed');
			},
		});
		const context = createContext();
		const userSpace = bindFileLockingUserSpace(
			manager,
			adapter,
			context
		);

		expect(userSpace.flock(10, context.constants.LOCK_SH)).toBe(0);
		expect(userSpace.fd_close(10)).toBe(0);

		expect(context.wasmImports.builtin_fd_close).toHaveBeenCalledWith(10);
		expect(manager.releaseLocksOnFdClose).toHaveBeenCalledWith(
			1,
			20,
			'/shared-file'
		);
	});

	it('releases process locks even when adapter process cleanup throws', () => {
		const manager = createLockManager();
		const adapter = createLockAdapter({
			beforeProcessExit: () => {
				throw new Error('process cleanup failed');
			},
		});
		const context = createContext();
		const userSpace = bindFileLockingUserSpace(
			manager,
			adapter,
			context
		);

		userSpace.js_release_file_locks();

		expect(manager.releaseLocksForProcess).toHaveBeenCalledWith(1);
	});

	it('returns errno when the lock manager throws during flock', () => {
		const manager = createLockManager({
			lockWholeFile: () => {
				throw new Error('lock manager failed');
			},
		});
		const context = createContext();
		const userSpace = bindFileLockingUserSpace(
			manager,
			createLockAdapter(),
			context
		);

		expect(userSpace.flock(10, context.constants.LOCK_EX)).toBe(
			-context.errnoCodes.EINVAL
		);
	});

	it('returns errno when the lock manager throws during F_SETLK', () => {
		const manager = createLockManager({
			lockFileByteRange: () => {
				throw new Error('lock manager failed');
			},
		});
		const context = createContext();
		writeFlockStruct(context, {
			l_type: context.constants.F_WRLCK,
			l_whence: context.constants.SEEK_SET,
			l_start: 0n,
			l_len: 1n,
		});
		const userSpace = bindFileLockingUserSpace(
			manager,
			createLockAdapter(),
			context
		);

		expect(userSpace.fcntl64(10, context.constants.F_SETLK, 4)).toBe(
			-context.errnoCodes.EINVAL
		);
	});

	it('returns errno when the lock manager throws during F_GETLK', () => {
		const manager = createLockManager({
			findFirstConflictingByteRangeLock: () => {
				throw new Error('lock manager failed');
			},
		});
		const context = createContext();
		writeFlockStruct(context, {
			l_type: context.constants.F_WRLCK,
			l_whence: context.constants.SEEK_SET,
			l_start: 0n,
			l_len: 1n,
		});
		const userSpace = bindFileLockingUserSpace(
			manager,
			createLockAdapter(),
			context
		);

		expect(userSpace.fcntl64(10, context.constants.F_GETLK, 4)).toBe(
			-context.errnoCodes.EINVAL
		);
	});
});

function createLockManager(
	overrides: Partial<FileLockManager> = {}
): FileLockManager {
	return {
		lockWholeFile: vi.fn(() => true),
		lockFileByteRange: vi.fn(() => true),
		findFirstConflictingByteRangeLock: vi.fn(() => undefined),
		releaseLocksForProcess: vi.fn(),
		releaseLocksOnFdClose: vi.fn(),
		...overrides,
	};
}

function createLockAdapter(
	overrides: Partial<WasmFileLockAdapter> = {}
): WasmFileLockAdapter {
	return {
		getLockTarget: vi.fn(
			() =>
				[
					{
						fd: 20,
						path: '/shared-file',
					},
					0,
				] as const
		),
		getLockFd: vi.fn(() => [20, 0] as const),
		...overrides,
	};
}

function createContext(): WasmFileLockingUserSpaceContext {
	const trace = vi.fn();
	return {
		pid: 1,
		constants: {
			F_RDLCK: 0,
			F_WRLCK: 1,
			F_UNLCK: 2,
			F_GETFL: 3,
			O_ACCMODE: 3,
			O_RDONLY: 0,
			O_WRONLY: 1,
			O_APPEND: 1024,
			O_NONBLOCK: 2048,
			F_SETFL: 4,
			F_GETLK: 5,
			F_SETLK: 6,
			F_SETLKW: 7,
			SEEK_SET: 0,
			SEEK_CUR: 1,
			SEEK_END: 2,
			LOCK_SH: 1,
			LOCK_EX: 2,
			LOCK_NB: 4,
			LOCK_UN: 8,
		},
		errnoCodes: {
			EBADF: 9,
			EINVAL: 22,
			EAGAIN: 11,
			EWOULDBLOCK: 11,
		},
		memory: {
			HEAPU8: createHeapAccessor(0),
			HEAP16: createHeapAccessor(0),
			HEAP32: createHeapAccessor(0),
			HEAP64: createHeapAccessor(0n),
		},
		wasmImports: {
			builtin_fcntl64: vi.fn(() => 2),
			builtin_fd_close: vi.fn(() => 0),
			js_wasm_trace: trace,
		},
		wasmExports: {
			wasm_get_end_offset: vi.fn(() => 0n),
		},
		syscalls: {
			getStreamFromFD: vi.fn(),
		},
		FS: {
			llseek: vi.fn(() => 0),
		} as unknown as WasmFileLockingUserSpaceContext['FS'],
	};
}

function writeFlockStruct(
	context: WasmFileLockingUserSpaceContext,
	{
		l_type,
		l_whence,
		l_start,
		l_len,
	}: {
		l_type: number;
		l_whence: number;
		l_start: bigint;
		l_len: bigint;
	}
) {
	const flockStructAddress = 64;
	context.memory.HEAP32.set(1, flockStructAddress);
	context.memory.HEAP16.set((flockStructAddress + 0) >> 1, l_type);
	context.memory.HEAP16.set((flockStructAddress + 2) >> 1, l_whence);
	context.memory.HEAP64.set((flockStructAddress + 8) >> 3, l_start);
	context.memory.HEAP64.set((flockStructAddress + 16) >> 3, l_len);
}

function createHeapAccessor<T>(initialValue: T) {
	const values = new Map<number, T>();
	return {
		get(offset: number) {
			return values.get(offset) ?? initialValue;
		},
		set(offset: number, value: T) {
			values.set(offset, value);
		},
	};
}
