/**
 * Per-process syscall implementations (flock, fcntl, etc.) that run
 * in the context of a single WASM PHP process. Analogous to OS
 * user space: each process gets its own instance bound to its PID,
 * constants, and file descriptor table.
 */
import type {
	Emscripten,
	RequestedRangeLock,
	WholeFileLock,
	WholeFileLockOp,
} from '@php-wasm/universal';
import type { WasmKernelSpace } from './wasm-kernel-space';
import { lookup } from 'dns/promises';

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
		// Emscripten does not expose these constants to JS, so we hardcode them here.
		// Based on
		// https://github.com/emscripten-core/emscripten/blob/76860cc47cef67f5712a7a03a247bc1baabf7ba4/system/lib/libc/musl/include/sys/file.h#L7-L10
		LOCK_SH: 1;
		LOCK_EX: 2;
		LOCK_NB: 4;
		LOCK_UN: 8;
	};
	errnoCodes: {
		EBADF: NonZeroNumber;
		EINVAL: NonZeroNumber;
		EAGAIN: NonZeroNumber;
		EDEADLK: NonZeroNumber;
		EWOULDBLOCK: NonZeroNumber;
	};
	memory: {
		HEAP8: HeapAccessor<number>;
		HEAPU8: HeapAccessor<number>;
		HEAP16: HeapAccessor<number>;
		HEAPU16: HeapAccessor<number>;
		HEAP32: HeapAccessor<number>;
		HEAPU32: HeapAccessor<number>;
		HEAPF32: HeapAccessor<number>;
		HEAP64: HeapAccessor<bigint>;
		HEAPU64: HeapAccessor<bigint>;
		HEAPF64: HeapAccessor<bigint>;
	};
	// This is a collection of functions present in built php-wasm JS.
	// By receiving the entire collection here, we can avoid recompiling
	// php-wasm JS whenever we add a new dependency from this collection.
	wasmImports: {
		builtin_fcntl64: (fd: number, cmd: number, varargs?: any) => number;
		builtin_fd_close: (fd: number) => number;
		js_wasm_trace: (...args: any[]) => void;
	};
	// This is a collection of functions present in built php-wasm JS.
	// By receiving the entire collection here, we can avoid recompiling
	// php-wasm JS whenever we add a new dependency from this collection.
	wasmExports: {
		wasm_get_end_offset: (fd: number) => bigint;
	};
	// This is a collection of functions present in built php-wasm JS.
	// By receiving the entire collection here, we can avoid recompiling
	// php-wasm JS whenever we add a new dependency from this collection.
	syscalls: {
		getStreamFromFD: (fd: number) => Emscripten.FS.FSStream;
	};
	FS: typeof Emscripten.FS;
	PROXYFS: typeof Emscripten.PROXYFS & {
		// Not in Emscripten's FileSystemType; augmented inline here.
		realPath(node: FSNode): string;
	};
	NODEFS: typeof Emscripten.NODEFS & {
		// Not in Emscripten's FileSystemType; augmented inline here.
		realPath(node: FSNode): string;
	};
};

export type WasmUserSpaceAPI = {
	fcntl64: (fd: number, cmd: number, varargs?: number) => number;
	flock: (fd: number, op: number) => number;
	fd_close: (fd: number) => number;
	js_release_file_locks: () => void;
	gethostbyname: (hostname: string) => Promise<string>;
};

export function bindUserSpace(
	{ fileLockManager }: WasmKernelSpace,
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
		NODEFS,
	}: WasmUserSpaceContext
): WasmUserSpaceAPI {
	class VarArgsAccessor {
		argsAddr: number;

		constructor(argsAddr: number) {
			this.argsAddr = argsAddr;
		}

		getNextAsPointer(): number {
			return this.getNextAsInt();
		}

		getNextAsInt(): number {
			// Shift right by 2 to divide by 2^2.
			const fourByteOffset = this.argsAddr >> 2;
			const value = memory.HEAP32.get(fourByteOffset);
			this.argsAddr += 4;
			return value;
		}
	}

	type FcntlLockState = typeof F_RDLCK | typeof F_WRLCK | typeof F_UNLCK;
	const locking = {
		/*
		 * This is a set of possibly locked file descriptors.
		 *
		 * When a file descriptor is closed, we need to release any associated held by this process.
		 * Instead of trying remember and forget file descriptors as they are locked and unlocked,
		 * we just track file descriptors we have locked before and try an unlock when they are closed.
		 */
		maybeLockedFds: new Set(),

		lockStateToFcntl: {
			shared: F_RDLCK,
			exclusive: F_WRLCK,
			unlocked: F_UNLCK,
		} as const satisfies Record<WholeFileLock['type'], FcntlLockState>,
		fcntlToLockState: {
			[F_RDLCK as FcntlLockState]: 'shared',
			[F_WRLCK as FcntlLockState]: 'exclusive',
			[F_UNLCK as FcntlLockState]: 'unlocked',
		} as const satisfies Record<FcntlLockState, WholeFileLock['type']>,
		is_path_to_shared_fs(path: string) {
			const { node } = FS.lookupPath(path, { noent_okay: true });
			if (!node) {
				return false;
			}

			if (node.mount.type !== PROXYFS) {
				return !!node.isSharedFS;
			}

			// TODO: Do we still need to support PROXYFS now that Playground CLI uses NODEFS everywhere?
			// This looks like a PROXYFS node. Let's try a lookup.
			const nodePath = PROXYFS.realPath(node);
			const backingFs = node?.mount?.opts?.['fs'];
			if (backingFs) {
				// Tolerate ENOENT because looking up a MEMFS node by path always fails.
				const { node: backingNode } = backingFs.lookupPath(nodePath, {
					noent_okay: true,
				});
				return !!backingNode?.isSharedFS;
			}

			return false;
		},
		get_fd_access_mode(fd: number) {
			return builtin_fcntl64(fd, F_GETFL) & O_ACCMODE;
		},
		get_vfs_path_from_fd(fd: number): ResultTuple<string> {
			try {
				return [FS.readlink(`/proc/self/fd/${fd}`), 0];
			} catch {
				return [null as never, EBADF] as const;
			}
		},

		get_native_path_from_vfs_path(vfsPath: string) {
			const { node } = FS.lookupPath(vfsPath, {
				noent_okay: true,
			});
			if (!node) {
				throw new Error(`No node found for VFS path ${vfsPath}`);
			}
			if (node.mount.type === NODEFS) {
				return NODEFS.realPath(node);
			} else if (node.mount.type === PROXYFS) {
				// TODO: Tolerate ENOENT here?
				const { node: backingNode, path: backingPath } =
					node.mount.opts['fs'].lookupPath(vfsPath);
				js_wasm_trace(
					'backingNode for %s: %s',
					vfsPath,
					backingPath,
					backingNode
				);
				return backingNode.mount.type.realPath(backingNode);
			} else {
				throw new Error(
					`Unsupported filesystem type for path ${vfsPath}`
				);
			}
		},

		get_native_fd_from_emscripten_fd(fd: number): ResultTuple<number> {
			try {
				type MaybeNODEFSStream = Emscripten.FS.FSStream & {
					nfd?: number;
				};
				const stream = getStreamFromFD(fd) as MaybeNODEFSStream;
				if (stream.nfd === undefined) {
					return [null as never, EBADF];
				}
				return [stream.nfd, 0];
			} catch {
				return [null as never, EBADF];
			}
		},

		check_lock_params(fd: number, l_type: number) {
			const accessMode = locking.get_fd_access_mode(fd);
			if (
				(l_type === F_WRLCK && accessMode === O_RDONLY) ||
				(l_type === F_RDLCK && accessMode === O_WRONLY)
			) {
				js_wasm_trace(
					'check_lock_params(%d, %d, %d) EBADF',
					fd,
					l_type,
					accessMode
				);
				return EBADF;
			}

			return 0;
		},
	};

	type FlockStruct = {
		l_type: number;
		l_whence: number;
		l_start: bigint;
		l_len: bigint;
		l_pid: number;
	};

	// NOTE: With the exception of l_type, these offsets are not exposed to
	// JS by Emscripten, so we hardcode them here.
	// We name them with snake case to better reflect the struct field names.
	const emscripten_flock_l_type_offset = 0;
	const emscripten_flock_l_whence_offset = 2;
	const emscripten_flock_l_start_offset = 8;
	const emscripten_flock_l_len_offset = 16;
	const emscripten_flock_l_pid_offset = 24;

	/**
	 * Read the flock struct at the given address.
	 *
	 * @param {bigint} flockStructAddress - the address of the flock struct
	 * @returns the flock struct
	 */
	// TODO: Does this arg type need to be a bigint?
	function readFlockStruct(flockStructAddress: number) {
		/*
		 * NOTE: Since we are using HEAP<WORD_SIZE> vars like HEAP16 and HEAP64,
		 * we need to adjust offsets to address the word size of each HEAP.
		 *
		 * For example, an offset of 64 bytes is the following for each HEAP:
		 * - HEAP8: 64  (the 64th byte)
		 * - HEAP16: 32 (the 32nd 16-bit word)
		 * - HEAP32: 16 (the 16th 32-bit word)
		 * - HEAP64: 8  (the 8th 64-bit word)
		 *
		 * We get a word offset by dividing the byte offset by the word size.
		 */
		return {
			l_type: memory.HEAP16.get(
				// Shift right by 1 to divide by 2^1.
				(flockStructAddress + emscripten_flock_l_type_offset) >> 1
			),
			l_whence: memory.HEAP16.get(
				// Shift right by 1 to divide by 2^1.
				(flockStructAddress + emscripten_flock_l_whence_offset) >> 1
			),
			l_start: memory.HEAP64.get(
				// Shift right by 3 to divide by 2^3.
				(flockStructAddress + emscripten_flock_l_start_offset) >> 3
			),
			l_len: memory.HEAP64.get(
				// Shift right by 3 to divide by 2^3.
				(flockStructAddress + emscripten_flock_l_len_offset) >> 3
			),
			l_pid: memory.HEAP32.get(
				// Shift right by 2 to divide by 2^2.
				(flockStructAddress + emscripten_flock_l_pid_offset) >> 2
			),
		};
	}

	/**
	 * Update the flock struct at the given address with the given fields.
	 *
	 * @param {bigint} flockStructAddress - the address of the flock struct
	 * @param {object} fields - the fields to update
	 */
	function updateFlockStruct(
		flockStructAddress: number,
		fields: Partial<FlockStruct>
	) {
		/*
		 * NOTE: Since we are using HEAP<WORD_SIZE> vars like HEAP16 and HEAP64,
		 * we need to adjust offsets to address the word size of each HEAP.
		 *
		 * For example, an offset of 64 bytes is the following for each HEAP:
		 * - HEAP8: 64  (the 64th byte)
		 * - HEAP16: 32 (the 32nd 16-bit word)
		 * - HEAP32: 16 (the 16th 32-bit word)
		 * - HEAP64: 8  (the 8th 64-bit word)
		 *
		 * We get a word offset by dividing the byte offset by the word size.
		 */
		if (fields.l_type !== undefined) {
			memory.HEAP16.set(
				// Shift right by 1 to divide by 2^1.
				(flockStructAddress + emscripten_flock_l_type_offset) >> 1,
				fields.l_type
			);
		}
		if (fields.l_whence !== undefined) {
			memory.HEAP16.set(
				// Shift right by 1 to divide by 2^1.
				(flockStructAddress + emscripten_flock_l_whence_offset) >> 1,
				fields.l_whence
			);
		}
		if (fields.l_start !== undefined) {
			memory.HEAP64.set(
				// Shift right by 3 to divide by 2^3.
				(flockStructAddress + emscripten_flock_l_start_offset) >> 3,
				fields.l_start
			);
		}
		if (fields.l_len !== undefined) {
			memory.HEAP64.set(
				// Shift right by 3 to divide by 2^3.
				(flockStructAddress + emscripten_flock_l_len_offset) >> 3,
				fields.l_len
			);
		}
		if (fields.l_pid !== undefined) {
			memory.HEAP32.set(
				// Shift right by 2 to divide by 2^2.
				(flockStructAddress + emscripten_flock_l_pid_offset) >> 2,
				fields.l_pid
			);
		}
	}

	/**
	 * Resolve the base address of the range depending on the whence and start offset.
	 *
	 * @param {number} fd - the file descriptor
	 * @param {number} whence - what the start offset is relative to
	 * @param {bigint} startOffset - the offset from the whence
	 * @returns The resolved offset and the errno. If there is an error,
	 *          the resolved offset is null, and the errno is non-zero.
	 */
	function getBaseAddress(fd: number, whence: number, startOffset: bigint) {
		let baseAddress;
		switch (whence) {
			case SEEK_SET:
				baseAddress = 0n;
				break;
			case SEEK_CUR:
				try {
					const stream = getStreamFromFD(fd);
					baseAddress = FS.llseek(stream, 0, whence);
				} catch (e) {
					js_wasm_trace(
						'get_base_address(%d, %d, %d) getStreamFromFD error %s',
						fd,
						whence,
						startOffset,
						e
					);
					return [null, EINVAL];
				}
				break;
			case SEEK_END:
				baseAddress = wasm_get_end_offset(fd);
				break;
			default:
				return [null, EINVAL];
		}

		if (baseAddress == -1) {
			// We cannot resolve the offset within the file.
			// Let's treat this as a problem with the file descriptor.
			return [null, EBADF];
		}

		const resolvedOffset = baseAddress + startOffset;
		if (resolvedOffset < 0) {
			// This is not a valid offset. Report args as invalid.
			return [null, EINVAL];
		}

		return [resolvedOffset, 0];
	}

	function fcntl64(fd: number, cmd: number, varargs?: number) {
		js_wasm_trace('fcntl64(%d, %d)', fd, cmd);
		if (!fileLockManager) {
			js_wasm_trace(
				'fcntl64(%d, %d) file lock manager is not available. ' +
					'delegate to Emscripten builtin fcntl64.',
				fd,
				cmd
			);
			return builtin_fcntl64(fd, cmd, varargs);
		}

		switch (cmd) {
			case F_GETLK: {
				const reportUnlockedFileByDefault =
					function reportUnlockedFileByDefault() {
						updateFlockStruct(flockStructAddr, {
							l_type: F_UNLCK,
						});
						return 0;
					};

				js_wasm_trace('fcntl(%d, F_GETLK)', fd);
				const [vfsPath, vfsPathErrno] =
					locking.get_vfs_path_from_fd(fd);
				if (vfsPathErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_GETLK) %s get_vfs_path_from_fd errno %d',
						fd,
						vfsPath,
						vfsPathErrno
					);
					return -EBADF;
				}

				const varArgsAccessor = new VarArgsAccessor(varargs!);
				const flockStructAddr = varArgsAccessor.getNextAsPointer();

				if (
					!locking.is_path_to_shared_fs(vfsPath) ||
					fileLockManager === undefined
				) {
					js_wasm_trace(
						"fcntl(%d, F_GETLK) locking is not implemented for non-NodeFS path '%s'",
						fd,
						vfsPath
					);

					// If not a NodeFS path, we can't lock it.
					// Default to succeeding as Emscripten does.
					return reportUnlockedFileByDefault();
				}

				const flockStruct = readFlockStruct(flockStructAddr);

				if (!(flockStruct.l_type in locking.fcntlToLockState)) {
					return -EINVAL;
				}

				const paramsCheckErrno = locking.check_lock_params(
					fd,
					flockStruct.l_type
				);
				if (paramsCheckErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_GETLK) %s check_lock_params errno %d',
						fd,
						vfsPath,
						paramsCheckErrno
					);
					return -EINVAL;
				}

				const requestedLockType =
					locking.fcntlToLockState[flockStruct.l_type];
				const [absoluteStartOffset, baseAddressErrno] = getBaseAddress(
					fd,
					flockStruct.l_whence,
					flockStruct.l_start
				);
				if (baseAddressErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_GETLK) %s get_base_address errno %d',
						fd,
						vfsPath,
						baseAddressErrno
					);
					return -EINVAL;
				}

				const [nativeFd, nativeFdErrno] =
					locking.get_native_fd_from_emscripten_fd(fd);
				if (nativeFdErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_GETLK) get_native_fd_from_emscripten_fd errno %d',
						fd,
						nativeFdErrno
					);
					return -nativeFdErrno;
				}

				try {
					const nativeFilePath =
						locking.get_native_path_from_vfs_path(vfsPath);
					const conflictingLock =
						fileLockManager.findFirstConflictingByteRangeLock(
							nativeFilePath,
							{
								type: requestedLockType,
								start: absoluteStartOffset,
								end: absoluteStartOffset + flockStruct.l_len,
								pid,
								fd: nativeFd,
							}
						);
					if (conflictingLock === undefined) {
						js_wasm_trace(
							'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock type=unlocked start=0x%x end=0x%x',
							fd,
							vfsPath,
							absoluteStartOffset,
							absoluteStartOffset + flockStruct.l_len
						);

						updateFlockStruct(flockStructAddr, {
							l_type: F_UNLCK,
						});
						return 0;
					}

					js_wasm_trace(
						'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock type=%s start=0x%x end=0x%x conflictingLock %d',
						fd,
						vfsPath,
						conflictingLock.type,
						conflictingLock.start,
						conflictingLock.end,
						conflictingLock.pid
					);

					const fcntlLockState =
						locking.lockStateToFcntl[conflictingLock.type];
					updateFlockStruct(flockStructAddr, {
						l_type: fcntlLockState,
						l_whence: SEEK_SET,
						l_start: conflictingLock.start,
						l_len: BigInt(
							conflictingLock.end - conflictingLock.start
						),
						l_pid: conflictingLock.pid,
					});
					return 0;
				} catch (e) {
					js_wasm_trace(
						'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock error %s',
						fd,
						vfsPath,
						e
					);
					return -EINVAL;
				}
			}
			// TODO: Double check waiting for lock. PHP 8.5 has been observed waiting for a lock.
			case F_SETLKW:
			case F_SETLK: {
				js_wasm_trace('fcntl(%d, F_SETLK)', fd);
				const [vfsPath, vfsPathErrno] =
					locking.get_vfs_path_from_fd(fd);
				if (vfsPathErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_SETLK) %s get_vfs_path_from_fd errno %d',
						fd,
						vfsPath,
						vfsPathErrno
					);
					return -vfsPathErrno;
				}

				if (!locking.is_path_to_shared_fs(vfsPath)) {
					js_wasm_trace(
						'fcntl(%d, F_SETLK) locking is not implemented for non-NodeFS path %s',
						fd,
						vfsPath
					);

					// If not a NodeFS path, we can't lock it.
					// Default to succeeding as Emscripten does.
					return 0;
				}

				const varArgsAccessor = new VarArgsAccessor(varargs!);
				const flockStructAddr = varArgsAccessor.getNextAsPointer();
				const flockStruct = readFlockStruct(flockStructAddr);

				const [absoluteStartOffset, baseAddressErrno] = getBaseAddress(
					fd,
					flockStruct.l_whence,
					flockStruct.l_start
				);
				if (baseAddressErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_SETLK) %s get_base_address errno %d',
						fd,
						vfsPath,
						baseAddressErrno
					);
					return -EINVAL;
				}

				if (!(flockStruct.l_type in locking.fcntlToLockState)) {
					js_wasm_trace(
						'fcntl(%d, F_SETLK) %s invalid lock type %d',
						fd,
						vfsPath,
						flockStruct.l_type
					);
					return -EINVAL;
				}

				const paramsCheckErrno = locking.check_lock_params(
					fd,
					flockStruct.l_type
				);
				if (paramsCheckErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_SETLK) %s check_lock_params errno %d',
						fd,
						vfsPath,
						paramsCheckErrno
					);
					return -paramsCheckErrno;
				}

				const [nativeFd, nativeFdErrno] =
					locking.get_native_fd_from_emscripten_fd(fd);
				if (nativeFdErrno !== 0) {
					js_wasm_trace(
						'fcntl(%d, F_SETLK) get_native_fd_from_emscripten_fd errno %d',
						fd,
						nativeFdErrno
					);
					return -nativeFdErrno;
				}

				const requestedLockType =
					locking.fcntlToLockState[flockStruct.l_type];
				const rangeLock: RequestedRangeLock = {
					type: requestedLockType,
					start: absoluteStartOffset,
					end: absoluteStartOffset + flockStruct.l_len,
					pid,
					fd: nativeFd,
				};

				try {
					const nativeFilePath =
						locking.get_native_path_from_vfs_path(vfsPath);
					js_wasm_trace(
						'fcntl(%d, F_SETLK) %s calling lockFileByteRange for range lock %s',
						fd,
						vfsPath,
						rangeLock
					);

					const waitForLock = cmd === F_SETLKW;
					const succeeded = fileLockManager.lockFileByteRange(
						nativeFilePath,
						rangeLock,
						waitForLock
					);
					if (succeeded) {
						locking.maybeLockedFds.add(nativeFd);
					}

					js_wasm_trace(
						'fcntl(%d, F_SETLK) %s lockFileByteRange returned %d for range lock %s',
						fd,
						vfsPath,
						succeeded,
						rangeLock
					);
					return succeeded ? 0 : -EAGAIN;
				} catch (e) {
					js_wasm_trace(
						'fcntl(%d, F_SETLK) %s lockFileByteRange error %s for range lock %s',
						fd,
						vfsPath,
						e,
						rangeLock
					);
					return -EINVAL;
				}
			}
			case F_SETFL: {
				/**
				 * Overrides the core Emscripten implementation to reflect what
				 * fcntl does in linux kernel. This implementation is still missing
				 * a bunch of nuance, but, unlike the core Emscripten implementation,
				 * it overrides the stream flags while preserving non-stream flags.
				 *
				 * @see fcntl.c:
				 * https://github.com/torvalds/linux/blob/a79a588fc1761dc12a3064fc2f648ae66cea3c5a/fs/fcntl.c#L39
				 */
				let arg = 0;
				if (varargs !== undefined) {
					const varArgsAccessor = new VarArgsAccessor(varargs);
					arg = varArgsAccessor.getNextAsInt();
				}

				const stream = getStreamFromFD(fd);

				// Update the stream flags
				const SETFL_MASK = O_APPEND | O_NONBLOCK;
				stream.flags =
					(arg & SETFL_MASK) | (stream.flags & ~SETFL_MASK);

				return 0;
			}
			default:
				return builtin_fcntl64(fd, cmd, varargs);
		}
	}

	function flock(fd: number, op: number) {
		js_wasm_trace('flock(%d, %d)', fd, op);
		if (!fileLockManager) {
			js_wasm_trace(
				'flock(%d, %d) file lock manager is not available. ' +
					'succeed by default as Emscripten does.',
				fd,
				op
			);
			return 0;
		}

		type FlockOp = typeof LOCK_SH | typeof LOCK_EX | typeof LOCK_UN;
		const flockToLockOpType = {
			[LOCK_SH]: 'shared',
			[LOCK_EX]: 'exclusive',
			[LOCK_UN]: 'unlock',
		} as const satisfies Record<FlockOp, WholeFileLockOp['type']>;

		const [vfsPath, vfsPathErrno] = locking.get_vfs_path_from_fd(fd);
		if (vfsPathErrno !== 0) {
			js_wasm_trace(
				'flock(%d, %d) get_vfs_path_from_fd errno %d',
				fd,
				op,
				vfsPath,
				vfsPathErrno
			);
			return -vfsPathErrno;
		}

		if (!locking.is_path_to_shared_fs(vfsPath)) {
			js_wasm_trace(
				'flock(%d, %d) locking is not implemented for non-NodeFS path %s',
				fd,
				op,
				vfsPath
			);
			// If not a NodeFS path, we can't lock it.
			// Default to succeeding as Emscripten does.
			return 0;
		}

		const paramsCheckErrno = locking.check_lock_params(fd, op);
		if (paramsCheckErrno !== 0) {
			js_wasm_trace(
				'flock(%d, %d) %s check_lock_params errno %d',
				fd,
				op,
				vfsPath,
				paramsCheckErrno
			);
			return -paramsCheckErrno;
		}

		const maskedOp = op & ((LOCK_SH | LOCK_EX | LOCK_UN) as FlockOp | 0);
		const waitForLock = (op & LOCK_NB) === 0;

		if (maskedOp === 0) {
			js_wasm_trace('flock(%d, %d) invalid flock() operation', fd, op);
			return -EINVAL;
		}

		const lockOpType = flockToLockOpType[maskedOp as FlockOp];
		if (lockOpType === undefined) {
			js_wasm_trace('flock(%d, %d) invalid flock() operation', fd, op);
			return -EINVAL;
		}

		const [nativeFd, nativeFdErrno] =
			locking.get_native_fd_from_emscripten_fd(fd);
		if (nativeFdErrno !== 0) {
			js_wasm_trace(
				'js_flock(%d, %d) get_native_fd_from_emscripten_fd errno %d',
				fd,
				op,
				nativeFdErrno
			);
			return -nativeFdErrno;
		}

		try {
			const nativeFilePath =
				locking.get_native_path_from_vfs_path(vfsPath);
			const succeeded = fileLockManager.lockWholeFile(nativeFilePath, {
				type: lockOpType,
				pid: pid,
				fd: nativeFd,
				waitForLock,
			});
			js_wasm_trace(
				'flock(%d, %d) lockWholeFile %s returned %d',
				fd,
				op,
				vfsPath,
				succeeded
			);
			if (succeeded) {
				locking.maybeLockedFds.add(nativeFd);
			}
			return succeeded ? 0 : -EWOULDBLOCK;
		} catch (e) {
			js_wasm_trace('flock(%d, %d) lockWholeFile error %s', fd, op, e);
			return -EINVAL;
		}
	}

	function fd_close(fd: number) {
		if (!fileLockManager) {
			js_wasm_trace(
				'fd_close(%d) file lock manager is not available. ' +
					'delegate to Emscripten builtin fd_close.',
				fd
			);
			return builtin_fd_close(fd);
		}

		// We have to get the VFS path and native fd from the Emscripten file
		// descriptor before closing it.
		const [vfsPath, vfsPathResolutionErrno] =
			locking.get_vfs_path_from_fd(fd);
		const [nativeFd, nativeFdErrno] =
			locking.get_native_fd_from_emscripten_fd(fd);

		const fdCloseResult = builtin_fd_close(fd);
		if (fdCloseResult !== 0) {
			js_wasm_trace(
				'fd_close(%d) %s result %d',
				fd,
				vfsPath,
				fdCloseResult
			);
			return fdCloseResult;
		}
		if (!locking.maybeLockedFds.has(nativeFd)) {
			js_wasm_trace(
				'fd_close(%d) not in maybe-locked-list %s result %d',
				fd,
				vfsPath,
				fdCloseResult
			);
			return fdCloseResult;
		}

		if (vfsPathResolutionErrno !== 0) {
			js_wasm_trace(
				'fd_close(%d) get_vfs_path_from_fd error %d',
				fd,
				vfsPathResolutionErrno
			);
			/*
			 * It looks like the file may have had an associated lock,
			 * but since we cannot look up the path,
			 * there is nothing more for us to do.
			 *
			 * NOTE: This seems possible for files that are locked and
			 * then unlinked before close. It is an opportunity for a
			 * lock to be orphaned in the lock manager.
			 * @TODO: Explore how to ensure cleanup in this case.
			 */
			return fdCloseResult;
		}

		if (nativeFdErrno !== 0) {
			js_wasm_trace(
				'fd_close(%d) %s get_native_fd_from_emscripten_fd error %d',
				fd,
				vfsPath,
				nativeFdErrno
			);
			return fdCloseResult;
		}

		if (!locking.is_path_to_shared_fs(vfsPath)) {
			return fdCloseResult;
		}

		try {
			js_wasm_trace('fd_close(%d) %s release locks', fd, vfsPath);
			const nativeFilePath =
				locking.get_native_path_from_vfs_path(vfsPath);
			fileLockManager.releaseLocksOnFdClose(
				pid,
				nativeFd,
				nativeFilePath
			);
			js_wasm_trace('fd_close(%d) %s release locks success', fd, vfsPath);
		} catch (e) {
			js_wasm_trace("fd_close(%d) %s error '%s'", fd, vfsPath, e);
		}
		return fdCloseResult;
	}

	// TODO: Implement based on current process
	// TODO: Replace with process exit handler
	function js_release_file_locks() {
		js_wasm_trace('js_release_file_locks()');
		if (pid === undefined) {
			js_wasm_trace('js_release_file_locks pid is undefined');
			return;
		}
		if (fileLockManager === undefined) {
			js_wasm_trace(
				'js_release_file_locks file lock manager is undefined'
			);
			return;
		}

		try {
			fileLockManager.releaseLocksForProcess(pid);
			js_wasm_trace('js_release_file_locks succeeded');
		} catch (e) {
			js_wasm_trace('js_release_file_locks error %s', e);
		}
	}

	// TODO: Add a test for this.
	/**
	 * Resolve a hostname to an IP address.
	 *
	 * @param hostname The hostname to resolve.
	 * @returns The IP address of the hostname as a string.
	 */
	async function gethostbyname(hostname: string): Promise<string> {
		const { address } = await lookup(hostname, {
			family: 4,
			verbatim: false,
		});
		return address;
	}

	return {
		fcntl64,
		flock,
		fd_close,
		js_release_file_locks,
		gethostbyname,
	};
}
