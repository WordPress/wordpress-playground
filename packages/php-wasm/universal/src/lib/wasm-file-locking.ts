import type { Emscripten } from './emscripten-types';
import type {
	FileLockManager,
	RequestedRangeLock,
	WholeFileLock,
	WholeFileLockOp,
} from './file-lock-manager';

type HeapAccessor<T> = {
	get(offset: number): T;
	set(offset: number, value: T): void;
};

type NonZeroNumber = Exclude<number, 0>;
type ResultTuple<T> =
	| readonly [value: T, errorCode: 0]
	| readonly [value: never, errorCode: NonZeroNumber];

export type WasmFileLockingUserSpaceContext = {
	pid: number;
	// TODO: When receiving this context, validate that all these fields exist.
	constants: {
		F_RDLCK: number;
		F_WRLCK: number;
		F_UNLCK: number;
		F_GETFL: number;
		O_ACCMODE: number;
		O_RDONLY: number;
		O_WRONLY: number;
		O_APPEND: number;
		O_NONBLOCK: number;
		F_SETFL: number;
		F_GETLK: number;
		F_SETLK: number;
		F_SETLKW: number;
		SEEK_SET: number;
		SEEK_CUR: number;
		SEEK_END: number;
		// Emscripten does not expose these constants to JS.
		// Based on musl's sys/file.h constants used by Emscripten.
		LOCK_SH: 1;
		LOCK_EX: 2;
		LOCK_NB: 4;
		LOCK_UN: 8;
	};
	errnoCodes: {
		EBADF: NonZeroNumber;
		EINVAL: NonZeroNumber;
		EAGAIN: NonZeroNumber;
		EWOULDBLOCK: NonZeroNumber;
	};
	memory: {
		HEAP16: HeapAccessor<number>;
		HEAP32: HeapAccessor<number>;
		HEAP64: HeapAccessor<bigint>;
	};
	// Functions present in built php-wasm JS. Passing a collection here
	// avoids recompiling php-wasm JS whenever this layer adds a dependency.
	wasmImports: {
		builtin_fcntl64: (fd: number, cmd: number, varargs?: any) => number;
		builtin_fd_close: (fd: number) => number;
		js_wasm_trace: (...args: any[]) => void;
	};
	// Functions present in built php-wasm JS.
	wasmExports: {
		wasm_get_end_offset: (fd: number) => bigint;
	};
	// Functions present in built php-wasm JS.
	syscalls: {
		getStreamFromFD: (fd: number) => Emscripten.FS.FSStream;
	};
	FS: typeof Emscripten.FS;
};

export type WasmFileLockTarget = {
	fd: number;
	path: string;
};

export type WasmFileLockAdapter = {
	/**
	 * Resolve an Emscripten fd to the path/fd identity used by the
	 * FileLockManager. Return undefined to preserve Emscripten's historical
	 * no-op behavior for filesystems where locking is intentionally disabled.
	 */
	getLockTarget: (fd: number) => ResultTuple<WasmFileLockTarget | undefined>;
	/**
	 * Resolve only the lock fd before close. This allows cleanup even when
	 * resolving the file path would fail after an unlink.
	 */
	getLockFd: (fd: number) => ResultTuple<number>;
};

export type WasmFileLockingUserSpaceAPI = {
	fcntl64: (fd: number, cmd: number, varargs?: number) => number;
	flock: (fd: number, op: number) => number;
	fd_close: (fd: number) => number;
	js_release_file_locks: () => void;
};

export function bindFileLockingUserSpace(
	fileLockManager: FileLockManager | undefined,
	adapter: WasmFileLockAdapter,
	{
		pid,
		memory,
		constants,
		errnoCodes: { EBADF, EINVAL, EAGAIN, EWOULDBLOCK },
		wasmImports: { builtin_fcntl64, builtin_fd_close, js_wasm_trace },
		wasmExports: { wasm_get_end_offset },
		syscalls: { getStreamFromFD },
		FS,
	}: WasmFileLockingUserSpaceContext
): WasmFileLockingUserSpaceAPI {
	const {
		F_RDLCK,
		F_WRLCK,
		F_UNLCK,
		F_GETFL,
		O_ACCMODE,
		O_RDONLY,
		O_WRONLY,
		O_APPEND,
		O_NONBLOCK,
		F_SETFL,
		F_GETLK,
		F_SETLK,
		F_SETLKW,
		SEEK_SET,
		SEEK_CUR,
		SEEK_END,
		LOCK_SH,
		LOCK_EX,
		LOCK_NB,
		LOCK_UN,
	} = constants;

	type FcntlLockState = typeof F_RDLCK | typeof F_WRLCK | typeof F_UNLCK;
	const lockStateToFcntl = {
		shared: F_RDLCK,
		exclusive: F_WRLCK,
		unlocked: F_UNLCK,
	} as const satisfies Record<WholeFileLock['type'], FcntlLockState>;
	const fcntlToLockState = {
		[F_RDLCK as FcntlLockState]: 'shared',
		[F_WRLCK as FcntlLockState]: 'exclusive',
		[F_UNLCK as FcntlLockState]: 'unlocked',
	} as const satisfies Record<FcntlLockState, WholeFileLock['type']>;
	/*
	 * Possibly locked file descriptors and their last known lock paths.
	 * The path must be captured when the lock succeeds because close-time
	 * cleanup may run after the file is unlinked.
	 *
	 * WARNING: This fixes cleanup when a known path disappears before close,
	 * but it does not make path-keyed lock bookkeeping rename-safe. If a
	 * locked file is renamed, later lock operations may address the same
	 * underlying file through a different path than the one stored here.
	 */
	const maybeLockedFdPaths = new Map<number, string>();

	function fcntl64(fd: number, cmd: number, varargs?: number) {
		js_wasm_trace('fcntl64(%d, %d)', fd, cmd);
		if (!fileLockManager) {
			return builtin_fcntl64(fd, cmd, varargs);
		}

		switch (cmd) {
			case F_GETLK: {
				const [target, targetErrno] = adapter.getLockTarget(fd);
				if (targetErrno !== 0) {
					return -targetErrno;
				}

				const varArgsAccessor = new VarArgsAccessor(memory, varargs!);
				const flockStructAddr = varArgsAccessor.getNextAsPointer();
				if (target === undefined) {
					updateFlockStruct(memory, flockStructAddr, {
						l_type: F_UNLCK,
					});
					return 0;
				}

				const [rangeLock, rangeLockErrno] = readRequestedRangeLock(
					fd,
					target.fd,
					readFlockStruct(memory, flockStructAddr)
				);
				if (rangeLockErrno !== 0) {
					return -rangeLockErrno;
				}

				const conflictingLock =
					fileLockManager.findFirstConflictingByteRangeLock(
						target.path,
						rangeLock
					);
				if (conflictingLock === undefined) {
					updateFlockStruct(memory, flockStructAddr, {
						l_type: F_UNLCK,
					});
					return 0;
				}

				updateFlockStruct(memory, flockStructAddr, {
					l_type: lockStateToFcntl[conflictingLock.type],
					l_whence: SEEK_SET,
					l_start: conflictingLock.start,
					l_len: conflictingLock.end - conflictingLock.start,
					l_pid: conflictingLock.pid,
				});
				return 0;
			}

			case F_SETLKW:
			case F_SETLK: {
				const [target, targetErrno] = adapter.getLockTarget(fd);
				if (targetErrno !== 0) {
					return -targetErrno;
				}
				if (target === undefined) {
					return 0;
				}

				const varArgsAccessor = new VarArgsAccessor(memory, varargs!);
				const [rangeLock, rangeLockErrno] = readRequestedRangeLock(
					fd,
					target.fd,
					readFlockStruct(
						memory,
						varArgsAccessor.getNextAsPointer()
					)
				);
				if (rangeLockErrno !== 0) {
					return -rangeLockErrno;
				}

				const succeeded = fileLockManager.lockFileByteRange(
					target.path,
					rangeLock,
					cmd === F_SETLKW
				);
				if (succeeded) {
					maybeLockedFdPaths.set(target.fd, target.path);
				}
				return succeeded ? 0 : -EAGAIN;
			}

			case F_SETFL: {
				/*
				 * Override the core Emscripten implementation to reflect what
				 * fcntl does in the Linux kernel. This is still missing nuance,
				 * but preserves non-stream flags while updating stream flags.
				 */
				let arg = 0;
				if (varargs !== undefined) {
					const varArgsAccessor = new VarArgsAccessor(memory, varargs);
					arg = varArgsAccessor.getNextAsInt();
				}
				const stream = getStreamFromFD(fd);
				const setflMask = O_APPEND | O_NONBLOCK;
				stream.flags =
					(arg & setflMask) | (stream.flags & ~setflMask);
				return 0;
			}

			default:
				return builtin_fcntl64(fd, cmd, varargs);
		}
	}

	function flock(fd: number, op: number) {
		js_wasm_trace('flock(%d, %d)', fd, op);
		if (!fileLockManager) {
			return 0;
		}

		type FlockOp = typeof LOCK_SH | typeof LOCK_EX | typeof LOCK_UN;
		const flockToLockOpType = {
			[LOCK_SH]: 'shared',
			[LOCK_EX]: 'exclusive',
			[LOCK_UN]: 'unlock',
		} as const satisfies Record<FlockOp, WholeFileLockOp['type']>;

		const maskedOp = op & ((LOCK_SH | LOCK_EX | LOCK_UN) as FlockOp | 0);
		const lockOpType = flockToLockOpType[maskedOp as FlockOp];
		if (lockOpType === undefined) {
			return -EINVAL;
		}

		const [target, targetErrno] = adapter.getLockTarget(fd);
		if (targetErrno !== 0) {
			return -targetErrno;
		}
		if (target === undefined) {
			return 0;
		}

		const paramsCheckErrno =
			lockOpType === 'exclusive'
				? checkLockParams(fd, F_WRLCK)
				: lockOpType === 'shared'
					? checkLockParams(fd, F_RDLCK)
					: 0;
		if (paramsCheckErrno !== 0) {
			return -paramsCheckErrno;
		}

		const succeeded = fileLockManager.lockWholeFile(target.path, {
			type: lockOpType,
			pid,
			fd: target.fd,
			waitForLock: (op & LOCK_NB) === 0,
		});
		if (succeeded) {
			maybeLockedFdPaths.set(target.fd, target.path);
		}
		return succeeded ? 0 : -EWOULDBLOCK;
	}

	function fd_close(fd: number) {
		if (!fileLockManager) {
			return builtin_fd_close(fd);
		}

		/*
		 * We have to get the lock fd before closing the Emscripten file
		 * descriptor. On Node this is the native fd; on web it is the
		 * Emscripten fd.
		 */
		const [lockFd, lockFdErrno] = adapter.getLockFd(fd);
		const path =
			lockFdErrno === 0 ? maybeLockedFdPaths.get(lockFd) : undefined;

		const fdCloseResult = builtin_fd_close(fd);
		if (fdCloseResult !== 0 || lockFdErrno !== 0 || path === undefined) {
			return fdCloseResult;
		}

		fileLockManager.releaseLocksOnFdClose(pid, lockFd, path);
		maybeLockedFdPaths.delete(lockFd);
		return fdCloseResult;
	}

	function js_release_file_locks() {
		fileLockManager?.releaseLocksForProcess(pid);
		maybeLockedFdPaths.clear();
	}

	function readRequestedRangeLock(
		fd: number,
		lockFd: number,
		flockStruct: FlockStruct
	): ResultTuple<RequestedRangeLock> {
		if (!(flockStruct.l_type in fcntlToLockState)) {
			return [null as never, EINVAL] as const;
		}

		const paramsCheckErrno = checkLockParams(fd, flockStruct.l_type);
		if (paramsCheckErrno !== 0) {
			return [null as never, paramsCheckErrno] as const;
		}

		const [absoluteStartOffset, baseAddressErrno] = getBaseAddress(
			fd,
			flockStruct.l_whence,
			flockStruct.l_start
		);
		if (baseAddressErrno !== 0) {
			return [null as never, baseAddressErrno] as const;
		}

		return [
			{
				type: fcntlToLockState[flockStruct.l_type],
				start: absoluteStartOffset,
				end: absoluteStartOffset + flockStruct.l_len,
				pid,
				fd: lockFd,
			},
			0,
		] as const;
	}

	function getBaseAddress(
		fd: number,
		whence: number,
		startOffset: bigint
	): ResultTuple<bigint> {
		let baseAddress;
		switch (whence) {
			case SEEK_SET:
				baseAddress = 0n;
				break;
			case SEEK_CUR:
				try {
					const stream = getStreamFromFD(fd);
					baseAddress = BigInt(FS.llseek(stream, 0, whence));
				} catch {
					return [null as never, EINVAL] as const;
				}
				break;
			case SEEK_END:
				baseAddress = wasm_get_end_offset(fd);
				break;
			default:
				return [null as never, EINVAL] as const;
		}

		if (baseAddress === -1n) {
			return [null as never, EBADF] as const;
		}

		const resolvedOffset = baseAddress + startOffset;
		if (resolvedOffset < 0) {
			return [null as never, EINVAL] as const;
		}
		return [resolvedOffset, 0] as const;
	}

	function checkLockParams(fd: number, lType: number) {
		const accessMode = builtin_fcntl64(fd, F_GETFL) & O_ACCMODE;
		if (
			(lType === F_WRLCK && accessMode === O_RDONLY) ||
			(lType === F_RDLCK && accessMode === O_WRONLY)
		) {
			return EBADF;
		}
		return 0;
	}

	return { fcntl64, flock, fd_close, js_release_file_locks };
}

type FlockStruct = {
	l_type: number;
	l_whence: number;
	l_start: bigint;
	l_len: bigint;
	l_pid: number;
};

/*
 * Since we use HEAP<WORD_SIZE> views like HEAP16 and HEAP64, byte offsets
 * must be divided by the view word size before reading/writing the heap.
 */
class VarArgsAccessor {
	private argsAddr: number;
	private memory: WasmFileLockingUserSpaceContext['memory'];

	constructor(
		memory: WasmFileLockingUserSpaceContext['memory'],
		argsAddr: number
	) {
		this.memory = memory;
		this.argsAddr = argsAddr;
	}

	getNextAsPointer(): number {
		return this.getNextAsInt();
	}

	getNextAsInt(): number {
		const fourByteOffset = this.argsAddr >> 2;
		const value = this.memory.HEAP32.get(fourByteOffset);
		this.argsAddr += 4;
		return value;
	}
}

const emscriptenFlockLTypeOffset = 0;
const emscriptenFlockLWhenceOffset = 2;
const emscriptenFlockLStartOffset = 8;
const emscriptenFlockLLenOffset = 16;
const emscriptenFlockLPidOffset = 24;

function readFlockStruct(
	memory: WasmFileLockingUserSpaceContext['memory'],
	flockStructAddress: number
): FlockStruct {
	return {
		l_type: memory.HEAP16.get(
			(flockStructAddress + emscriptenFlockLTypeOffset) >> 1
		),
		l_whence: memory.HEAP16.get(
			(flockStructAddress + emscriptenFlockLWhenceOffset) >> 1
		),
		l_start: memory.HEAP64.get(
			(flockStructAddress + emscriptenFlockLStartOffset) >> 3
		),
		l_len: memory.HEAP64.get(
			(flockStructAddress + emscriptenFlockLLenOffset) >> 3
		),
		l_pid: memory.HEAP32.get(
			(flockStructAddress + emscriptenFlockLPidOffset) >> 2
		),
	};
}

function updateFlockStruct(
	memory: WasmFileLockingUserSpaceContext['memory'],
	flockStructAddress: number,
	fields: Partial<FlockStruct>
) {
	if (fields.l_type !== undefined) {
		memory.HEAP16.set(
			(flockStructAddress + emscriptenFlockLTypeOffset) >> 1,
			fields.l_type
		);
	}
	if (fields.l_whence !== undefined) {
		memory.HEAP16.set(
			(flockStructAddress + emscriptenFlockLWhenceOffset) >> 1,
			fields.l_whence
		);
	}
	if (fields.l_start !== undefined) {
		memory.HEAP64.set(
			(flockStructAddress + emscriptenFlockLStartOffset) >> 3,
			fields.l_start
		);
	}
	if (fields.l_len !== undefined) {
		memory.HEAP64.set(
			(flockStructAddress + emscriptenFlockLLenOffset) >> 3,
			fields.l_len
		);
	}
	if (fields.l_pid !== undefined) {
		memory.HEAP32.set(
			(flockStructAddress + emscriptenFlockLPidOffset) >> 2,
			fields.l_pid
		);
	}
}
