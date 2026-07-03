/**
 * Per-process file-locking syscalls for web PHP runtimes.
 *
 * Web PHP instances share one Emscripten filesystem through MEMFS/PROXYFS, not
 * native file descriptors. Use the Emscripten fd plus a canonical VFS path as
 * the lock identity and coordinate locks with an in-memory lock manager shared
 * by all PHP instances in the worker.
 */
import type {
	Emscripten,
	FileLockManager,
	RequestedRangeLock,
	WholeFileLock,
	WholeFileLockOp,
} from '@php-wasm/universal';

type FSNode = Emscripten.FS.FSNode;

type HeapAccessor<T> = {
	get(offset: number): T;
	set(offset: number, value: T): void;
};

type NonZeroNumber = Exclude<number, 0>;
type ResultTuple<T> =
	| [value: T, errorCode: 0]
	| [value: never, errorCode: NonZeroNumber];

export type WasmUserSpaceContext = {
	pid: number;
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
	wasmImports: {
		builtin_fcntl64: (fd: number, cmd: number, varargs?: any) => number;
		builtin_fd_close: (fd: number) => number;
		js_wasm_trace: (...args: any[]) => void;
	};
	wasmExports: {
		wasm_get_end_offset: (fd: number) => bigint;
	};
	syscalls: {
		getStreamFromFD: (fd: number) => Emscripten.FS.FSStream;
	};
	FS: typeof Emscripten.FS;
	PROXYFS: typeof Emscripten.PROXYFS & {
		realPath(node: FSNode): string;
	};
};

export type WasmUserSpaceAPI = {
	fcntl64: (fd: number, cmd: number, varargs?: number) => number;
	flock: (fd: number, op: number) => number;
	fd_close: (fd: number) => number;
	js_release_file_locks: () => void;
};

export function bindUserSpace(
	fileLockManager: FileLockManager | undefined,
	{
		pid,
		memory,
		constants: {
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
		},
		errnoCodes: { EBADF, EINVAL, EAGAIN, EWOULDBLOCK },
		wasmImports: { builtin_fcntl64, builtin_fd_close, js_wasm_trace },
		wasmExports: { wasm_get_end_offset },
		syscalls: { getStreamFromFD },
		FS,
		PROXYFS,
	}: WasmUserSpaceContext
): WasmUserSpaceAPI {
	class VarArgsAccessor {
		private argsAddr: number;

		constructor(argsAddr: number) {
			this.argsAddr = argsAddr;
		}

		getNextAsPointer(): number {
			return this.getNextAsInt();
		}

		getNextAsInt(): number {
			const fourByteOffset = this.argsAddr >> 2;
			const value = memory.HEAP32.get(fourByteOffset);
			this.argsAddr += 4;
			return value;
		}
	}

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
	const maybeLockedFdPaths = new Map<number, string>();

	type FlockStruct = {
		l_type: number;
		l_whence: number;
		l_start: bigint;
		l_len: bigint;
		l_pid: number;
	};

	const emscriptenFlockLTypeOffset = 0;
	const emscriptenFlockLWhenceOffset = 2;
	const emscriptenFlockLStartOffset = 8;
	const emscriptenFlockLLenOffset = 16;
	const emscriptenFlockLPidOffset = 24;

	function readFlockStruct(flockStructAddress: number): FlockStruct {
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

	function getFdAccessMode(fd: number) {
		return builtin_fcntl64(fd, F_GETFL) & O_ACCMODE;
	}

	function checkLockParams(fd: number, lType: number) {
		const accessMode = getFdAccessMode(fd);
		if (
			(lType === F_WRLCK && accessMode === O_RDONLY) ||
			(lType === F_RDLCK && accessMode === O_WRONLY)
		) {
			return EBADF;
		}
		return 0;
	}

	function getVfsPathFromFd(fd: number): ResultTuple<string> {
		try {
			return [FS.readlink(`/proc/self/fd/${fd}`), 0];
		} catch {
			return [null as never, EBADF] as const;
		}
	}

	function getPathForLock(vfsPath: string): string {
		const { node } = FS.lookupPath(vfsPath, { noent_okay: true });
		if (node?.mount.type === PROXYFS) {
			return PROXYFS.realPath(node);
		}
		return vfsPath;
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

	function readRequestedRangeLock(
		fd: number,
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
				fd,
			},
			0,
		] as const;
	}

	function fcntl64(fd: number, cmd: number, varargs?: number) {
		js_wasm_trace('fcntl64(%d, %d)', fd, cmd);
		if (!fileLockManager) {
			return builtin_fcntl64(fd, cmd, varargs);
		}

		switch (cmd) {
			case F_GETLK: {
				const [vfsPath, vfsPathErrno] = getVfsPathFromFd(fd);
				if (vfsPathErrno !== 0) {
					return -vfsPathErrno;
				}

				const varArgsAccessor = new VarArgsAccessor(varargs!);
				const flockStructAddr = varArgsAccessor.getNextAsPointer();
				const [rangeLock, rangeLockErrno] = readRequestedRangeLock(
					fd,
					readFlockStruct(flockStructAddr)
				);
				if (rangeLockErrno !== 0) {
					return -rangeLockErrno;
				}

				const conflictingLock =
					fileLockManager.findFirstConflictingByteRangeLock(
						getPathForLock(vfsPath),
						rangeLock
					);
				if (conflictingLock === undefined) {
					updateFlockStruct(flockStructAddr, { l_type: F_UNLCK });
					return 0;
				}

				updateFlockStruct(flockStructAddr, {
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
				const [vfsPath, vfsPathErrno] = getVfsPathFromFd(fd);
				if (vfsPathErrno !== 0) {
					return -vfsPathErrno;
				}

				const varArgsAccessor = new VarArgsAccessor(varargs!);
				const [rangeLock, rangeLockErrno] = readRequestedRangeLock(
					fd,
					readFlockStruct(varArgsAccessor.getNextAsPointer())
				);
				if (rangeLockErrno !== 0) {
					return -rangeLockErrno;
				}

				const path = getPathForLock(vfsPath);
				const succeeded = fileLockManager.lockFileByteRange(
					path,
					rangeLock,
					cmd === F_SETLKW
				);
				if (succeeded) {
					maybeLockedFdPaths.set(fd, path);
				}
				return succeeded ? 0 : -EAGAIN;
			}

			case F_SETFL: {
				let arg = 0;
				if (varargs !== undefined) {
					const varArgsAccessor = new VarArgsAccessor(varargs);
					arg = varArgsAccessor.getNextAsInt();
				}
				const stream = getStreamFromFD(fd);
				const setflMask = O_APPEND | O_NONBLOCK;
				stream.flags = (arg & setflMask) | (stream.flags & ~setflMask);
				return 0;
			}

			default:
				return builtin_fcntl64(fd, cmd, varargs);
		}
	}

	function flock(fd: number, op: number) {
		if (!fileLockManager) {
			return 0;
		}

		type FlockOp = typeof LOCK_SH | typeof LOCK_EX | typeof LOCK_UN;
		const flockToLockOpType = {
			[LOCK_SH]: 'shared',
			[LOCK_EX]: 'exclusive',
			[LOCK_UN]: 'unlock',
		} as const satisfies Record<FlockOp, WholeFileLockOp['type']>;

		const [vfsPath, vfsPathErrno] = getVfsPathFromFd(fd);
		if (vfsPathErrno !== 0) {
			return -vfsPathErrno;
		}

		const maskedOp = op & ((LOCK_SH | LOCK_EX | LOCK_UN) as FlockOp | 0);
		const lockOpType = flockToLockOpType[maskedOp as FlockOp];
		if (lockOpType === undefined) {
			return -EINVAL;
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

		const path = getPathForLock(vfsPath);
		const succeeded = fileLockManager.lockWholeFile(path, {
			type: lockOpType,
			pid,
			fd,
			waitForLock: (op & LOCK_NB) === 0,
		});
		if (succeeded) {
			maybeLockedFdPaths.set(fd, path);
		}
		return succeeded ? 0 : -EWOULDBLOCK;
	}

	function fd_close(fd: number) {
		if (!fileLockManager) {
			return builtin_fd_close(fd);
		}

		const path = maybeLockedFdPaths.get(fd);
		const fdCloseResult = builtin_fd_close(fd);
		if (fdCloseResult !== 0 || path === undefined) {
			return fdCloseResult;
		}

		fileLockManager.releaseLocksOnFdClose(pid, fd, path);
		maybeLockedFdPaths.delete(fd);
		return fdCloseResult;
	}

	function js_release_file_locks() {
		fileLockManager?.releaseLocksForProcess(pid);
		maybeLockedFdPaths.clear();
	}

	return { fcntl64, flock, fd_close, js_release_file_locks };
}
