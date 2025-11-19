/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
/**
 * JSPI vs Asyncify
 * -----------------
 *
 * This file contains many fragments similar to this one:
 *
 *     #if ASYNCIFY == 2
 *         return Asyncify.handleAsync(async () => {
 *     #endif
 *         // ..code..
 *     #if ASYNCIFY == 2
 *         });
 *     #endif
 *
 * This is a way of making syscalls synchronous with Asyncify (to support Node < 23) and asynchronous with JSPI (to support web browsers).
 * It is cumbersome, but it is much easier than using and debugging Asyncify.
 *
 * When JSPI is available (ASYNCIFY == 2), we can safely use promises and async/await.
 *
 * When JSPI is not available (ASYNCIFY == 1), we still invoke methods from another worker, but we do so
 * synchronously, blocking the execution of the calling thread until the result is available. In this mode,
 * we do not call handleSleep() or handleAsync() to avoid saving and rewinding the stack around each syscall.
 *
 * See comlink-sync.ts for more details.
 *
 * @see https://github.com/WordPress/wordpress-playground/pull/2317
 * @see https://github.com/WordPress/wordpress-playground/blob/9a9262cc62cc161d220a9992706b9ed2817f2eb5/packages/docs/site/docs/developers/23-architecture/07-wasm-asyncify.md
 * @see https://github.com/adamziel/js-synchronous-messaging for additional ideas.
 */
'use strict';

const LibraryForFileLocking = {
	$locking: {
		/*
		 * This is a set of possibly locked file descriptors.
		 *
		 * When a file descriptor is closed, we need to release any associated held by this process.
		 * Instead of trying remember and forget file descriptors as they are locked and unlocked,
		 * we just track file descriptors we have locked before and try an unlock when they are closed.
		 */
		maybeLockedFds: new Set(),

		// From:
		// https://github.com/emscripten-core/emscripten/blob/66d2137b0381ac35f7e2346b2d6a90abd0f1211a/system/lib/libc/musl/include/fcntl.h#L58-L60
		F_RDLCK: 0,
		F_WRLCK: 1,
		F_UNLCK: 2,

		lockStateToFcntl: {
			shared: 0,
			exclusive: 1,
			unlocked: 2,
		},
		fcntlToLockState: {
			[0]: 'shared',
			[1]: 'exclusive',
			[2]: 'unlocked',
		},
		is_path_to_shared_fs(path) {
			_js_wasm_trace('is_path_to_shared_fs(%s)', path);
			const { node } = FS.lookupPath(
				path,
				{ noent_okay: true },
			);
			if (node.mount.type !== PROXYFS) {
				return !!node.isSharedFS;
			}

			// This looks like a PROXYFS node. Let's try a lookup.
			const nodePath = PROXYFS.realPath(node);
			const backingFs = node?.mount?.opts?.fs;
			if (backingFs) {
				// Tolerate ENOENT because looking up a MEMFS node by path always fails.
				const { node: backingNode } = backingFs.lookupPath(
					nodePath,
					{ noent_okay: true }
				);
				return !!backingNode?.isSharedFS;
			}

			return false;
		},
		get_fd_access_mode(fd) {
			const emscripten_F_GETFL = Number('{{{cDefs.F_GETFL}}}');
			const emscripten_O_ACCMODE = Number('{{{ cDefs.O_ACCMODE}}}');

			return (
				_builtin_fcntl64(fd, emscripten_F_GETFL) & emscripten_O_ACCMODE
			);
		},
		get_vfs_path_from_fd(fd) {
			try {
				return [FS.readlink(`/proc/self/fd/${fd}`), 0];
			} catch (error) {
				return [null, ERRNO_CODES.EBADF];
			}
		},

		get_native_path_from_vfs_path(vfsPath) {
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
				const { node: backingNode, path: backingPath } = node.mount.opts.fs.lookupPath(vfsPath);
				_js_wasm_trace('backingNode for %s: %s', vfsPath, backingPath, backingNode);
				return backingNode.mount.type.realPath(backingNode);
			} else {
				throw new Error(`Unsupported filesystem type for path ${vfsPath}`);
			}
		},

		check_lock_params(fd, l_type) {
			const emscripten_O_RDONLY = Number('{{{ cDefs.O_RDONLY}}}');
			const emscripten_O_WRONLY = Number('{{{ cDefs.O_WRONLY}}}');

			const accessMode = locking.get_fd_access_mode(fd);
			if (
				(l_type === locking.F_WRLCK &&
					accessMode === emscripten_O_RDONLY) ||
				(l_type === locking.F_RDLCK &&
					accessMode === emscripten_O_WRONLY)
			) {
				return ERRNO_CODES.EBADF;
			}

			return 0;
		},
	},

	// Place the builtin fcntl64 implementation in an object so it is left
	// intact even if the function is not referenced by C/C++ code.
	// Ref: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#javascript-limits-in-library-files
	builtin_fcntl64__deps: LibraryManager.library.__syscall_fcntl64__deps,
	builtin_fcntl64: LibraryManager.library.__syscall_fcntl64,

	__syscall_fcntl64__deps: [
		...LibraryManager.library.__syscall_fcntl64__deps,
		'builtin_fcntl64',
		'$locking',
	],
	__syscall_fcntl64__sig: LibraryManager.library.__syscall_fcntl64__sig,
	__syscall_fcntl64: function __syscall_fcntl64(fd, cmd, varargs) {
		if (!PHPLoader.fileLockManager) {
			return _builtin_fcntl64(fd, cmd, varargs);
		}
#if ASYNCIFY == 2
		return Asyncify.handleAsync(async () => {
#endif
			// Necessary to use varargs accessor
			SYSCALLS.varargs = varargs;

			// These constants are replaced by Emscripten during the build process
			const emscripten_F_SETFL = Number('{{{cDefs.F_SETFL}}}');
			const emscripten_F_GETLK = Number('{{{cDefs.F_GETLK}}}');
			const emscripten_F_SETLK = Number('{{{cDefs.F_SETLK}}}');
			const emscripten_F_SETLKW = Number('{{{cDefs.F_SETLKW}}}');
			const emscripten_SEEK_SET = Number('{{{cDefs.SEEK_SET}}}');

			// NOTE: With the exception of l_type, these offsets are not exposed to
			// JS by Emscripten, so we hardcode them here.
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
			function read_flock_struct(flockStructAddress) {
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
					l_type: HEAP16[
						// Shift right by 1 to divide by 2^1.
						(flockStructAddress + emscripten_flock_l_type_offset) >>
							1
					],
					l_whence:
						HEAP16[
							// Shift right by 1 to divide by 2^1.
							(flockStructAddress +
								emscripten_flock_l_whence_offset) >>
								1
						],
					l_start:
						HEAP64[
							// Shift right by 3 to divide by 2^3.
							(flockStructAddress +
								emscripten_flock_l_start_offset) >>
								3
						],
					l_len: HEAP64[
						// Shift right by 3 to divide by 2^3.
						(flockStructAddress + emscripten_flock_l_len_offset) >>
							3
					],
					l_pid: HEAP32[
						// Shift right by 2 to divide by 2^2.
						(flockStructAddress + emscripten_flock_l_pid_offset) >>
							2
					],
				};
			}

			/**
			 * Update the flock struct at the given address with the given fields.
			 *
			 * @param {bigint} flockStructAddress - the address of the flock struct
			 * @param {object} fields - the fields to update
			 */
			function update_flock_struct(flockStructAddress, fields) {
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
					HEAP16[
						// Shift right by 1 to divide by 2^1.
						(flockStructAddress + emscripten_flock_l_type_offset) >>
							1
					] = fields.l_type;
				}
				if (fields.l_whence !== undefined) {
					HEAP16[
						// Shift right by 1 to divide by 2^1.
						(flockStructAddress +
							emscripten_flock_l_whence_offset) >>
							1
					] = fields.l_whence;
				}
				if (fields.l_start !== undefined) {
					HEAP64[
						// Shift right by 3 to divide by 2^3.
						(flockStructAddress +
							emscripten_flock_l_start_offset) >>
							3
					] = fields.l_start;
				}
				if (fields.l_len !== undefined) {
					HEAP64[
						// Shift right by 3 to divide by 2^3.
						(flockStructAddress + emscripten_flock_l_len_offset) >>
							3
					] = fields.l_len;
				}
				if (fields.l_pid !== undefined) {
					HEAP32[
						// Shift right by 2 to divide by 2^2.
						(flockStructAddress + emscripten_flock_l_pid_offset) >>
							2
					] = fields.l_pid;
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
			function get_base_address(fd, whence, startOffset) {
				let baseAddress;
				switch (whence) {
					case emscripten_SEEK_SET:
						baseAddress = 0n;
						break;
					case emscripten_SEEK_CUR:
						baseAddress = FS.lseek(fd, 0, whence);
						break;
					case emscripten_SEEK_END:
						baseAddress = _wasm_get_end_offset(fd);
						break;
					default:
						return [null, ERRNO_CODES.EINVAL];
				}

				if (baseAddress == -1) {
					// We cannot resolve the offset within the file.
					// Let's treat this as a problem with the file descriptor.
					return [null, ERRNO_CODES.EBADF];
				}

				const resolvedOffset = baseAddress + startOffset;
				if (resolvedOffset < 0) {
					// This is not a valid offset. Report args as invalid.
					return [null, ERRNO_CODES.EINVAL];
				}

				return [resolvedOffset, 0];
			}

			const pid = PHPLoader.processId;
			switch (cmd) {
				case emscripten_F_GETLK: {
					_js_wasm_trace('fcntl(%d, F_GETLK)', fd);
					let vfsPath;
					let errno;

					[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s get_vfs_path_from_fd errno %d',
							fd,
							vfsPath,
							errno
						);
						return -ERRNO_CODES.EBADF;
					}

					const flockStructAddr = syscallGetVarargP();

					if (!locking.is_path_to_shared_fs(vfsPath)) {
						_js_wasm_trace(
							"fcntl(%d, F_GETLK) locking is not implemented for non-NodeFS path '%s'",
							fd,
							vfsPath
						);

						// If not a NodeFS path, we can't lock it.
						// Default to succeeding as Emscripten does.
						update_flock_struct(flockStructAddr, {
							l_type: F_UNLCK,
						});
						return 0;
					}

					const flockStruct = read_flock_struct(flockStructAddr);

					if (!(flockStruct.l_type in locking.fcntlToLockState)) {
						return -ERRNO_CODES.EINVAL;
					}

					errno = locking.check_lock_params(fd, flockStruct.l_type);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s check_lock_params errno %d',
							fd,
							vfsPath,
							errno
						);
						return -ERRNO_CODES.EINVAL;
					}

					const requestedLockType =
						locking.fcntlToLockState[flockStruct.l_type];
					let absoluteStartOffset;
					[absoluteStartOffset, errno] = get_base_address(
						fd,
						flockStruct.l_whence,
						flockStruct.l_start
					);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s get_base_address errno %d',
							fd,
							vfsPath,
							errno
						);
						return -ERRNO_CODES.EINVAL;
					}

					try {
						const nativeFilePath =
							locking.get_native_path_from_vfs_path(vfsPath);
						const conflictingLock =
#if ASYNCIFY == 2
							await Promise.resolve(
#endif
								PHPLoader.fileLockManager
									.findFirstConflictingByteRangeLock(nativeFilePath, {
										type: requestedLockType,
										start: absoluteStartOffset,
										end: absoluteStartOffset + flockStruct.l_len,
										pid,
									})
#if ASYNCIFY == 2
							)
#endif
						;
						if (conflictingLock === undefined) {
							_js_wasm_trace(
								'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock type=unlocked start=0x%x end=0x%x',
								fd,
								vfsPath,
								absoluteStartOffset,
								absoluteStartOffset + flockStruct.l_len
							);

							update_flock_struct(flockStructAddr, {
								l_type: F_UNLCK,
							});
							return 0;
						}

						_js_wasm_trace(
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
						update_flock_struct(flockStructAddr, {
							l_type: fcntlLockState,
							l_whence: emscripten_SEEK_SET,
							l_start: conflictingLock.start,
							l_len:
								conflictingLock.end - conflictingLock.start,
							l_pid: conflictingLock.pid,
						});
						return 0;
					} catch (e) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock error %s',
							fd,
							vfsPath,
							e
						);
						return -ERRNO_CODES.EINVAL;
					}
				}
				case emscripten_F_SETLK: {
					_js_wasm_trace('fcntl(%d, F_SETLK)', fd);
					let vfsPath;
					let errno;
					[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s get_vfs_path_from_fd errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					if (!locking.is_path_to_shared_fs(vfsPath)) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) locking is not implemented for non-NodeFS path %s',
							fd,
							vfsPath
						);

						// If not a NodeFS path, we can't lock it.
						// Default to succeeding as Emscripten does.
						return 0;
					}

					var flockStructAddr = syscallGetVarargP();
					const flockStruct = read_flock_struct(flockStructAddr);

					let absoluteStartOffset;
					[absoluteStartOffset, errno] = get_base_address(
						fd,
						flockStruct.l_whence,
						flockStruct.l_start
					);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s get_base_address errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					if (!(flockStruct.l_type in locking.fcntlToLockState)) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s invalid lock type %d',
							fd,
							vfsPath,
							flockStruct.l_type
						);
						return -ERRNO_CODES.EINVAL;
					}

					errno = locking.check_lock_params(fd, flockStruct.l_type);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s check_lock_params errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					locking.maybeLockedFds.add(fd);

					const requestedLockType =
						locking.fcntlToLockState[flockStruct.l_type];
					const rangeLock = {
						type: requestedLockType,
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
					};

					try {
						const nativeFilePath =
							locking.get_native_path_from_vfs_path(vfsPath);
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s calling lockFileByteRange for range lock %s',
							fd,
							vfsPath,
							rangeLock
						);

						const succeeded = (
#if ASYNCIFY == 2
							await Promise.resolve(
#endif
								PHPLoader.fileLockManager
									.lockFileByteRange(nativeFilePath, rangeLock)
#if ASYNCIFY == 2
							)
#endif
						);

						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s lockFileByteRange returned %d for range lock %s',
							fd,
							vfsPath,
							succeeded,
							rangeLock
						);
						return succeeded ? 0 : -ERRNO_CODES.EAGAIN;
					} catch (e) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s lockFileByteRange error %s for range lock %s',
							fd,
							vfsPath,
							e,
							rangeLock
						);
						return -ERRNO_CODES.EINVAL;
					}
				}
				// @TODO: Implement waiting for lock
				case emscripten_F_SETLKW: {
					// We do not yet support the blocking form of flock().
					// We respond with EDEADLK to indicate failure
					// because it is a known errno for a failed F_SETLKW command.
					return -ERRNO_CODES.EDEADLK;
				}
				case emscripten_F_SETFL: {
					/**
					 * Overrides the core Emscripten implementation to reflect what
					 * fcntl does in linux kernel. This implementation is still missing
					 * a bunch of nuance, but, unlike the core Emscripten implementation,
					 * it overrides the stream flags while preserving non-stream flags.
					 *
					 * @see fcntl.c:
					 * https://github.com/torvalds/linux/blob/a79a588fc1761dc12a3064fc2f648ae66cea3c5a/fs/fcntl.c#L39
					 */
					const arg = varargs ? syscallGetVarargI() : 0;
					const stream = SYSCALLS.getStreamFromFD(fd);

					// Update the stream flags
					stream.flags =
						(arg & PHPWASM.SETFL_MASK) |
						(stream.flags & ~PHPWASM.SETFL_MASK);

					return 0;
				}
				default:
					return _builtin_fcntl64(fd, cmd, varargs);
			}
#if ASYNCIFY == 2
		});
#endif
	},

	/**
	 * Perform a flock() operation on the file descriptor.
	 *
	 * @param {number} fd - the file descriptor
	 * @param {number} op - the operation to perform
	 * @returns Zero on success, or a negative errno on failure.
	 */
	js_flock: function js_flock(fd, op) {
#if ASYNCIFY == 2
		return Asyncify.handleAsync(async () => {
#endif
			_js_wasm_trace('js_flock(%d, %d)', fd, op);
			// Emscripten does not expose these constants to JS, so we hardcode them here.
			// Based on
			// https://github.com/emscripten-core/emscripten/blob/76860cc47cef67f5712a7a03a247bc1baabf7ba4/system/lib/libc/musl/include/sys/file.h#L7-L10
			const emscripten_LOCK_SH = 1;
			const emscripten_LOCK_EX = 2;
			const emscripten_LOCK_NB = 4;
			const emscripten_LOCK_UN = 8;

			const flockToLockOpType = {
				[emscripten_LOCK_SH]: 'shared',
				[emscripten_LOCK_EX]: 'exclusive',
				[emscripten_LOCK_UN]: 'unlocked',
			};

			let vfsPath;
			let errno;

			[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
			if (errno !== 0) {
				_js_wasm_trace(
					'js_flock(%d, %d) get_vfs_path_from_fd errno %d',
					fd,
					op,
					vfsPath,
					errno
				);
				return -errno;
			}

			if (!locking.is_path_to_shared_fs(vfsPath)) {
				_js_wasm_trace(
					'flock(%d, %d) locking is not implemented for non-NodeFS path %s',
					fd,
					op,
					vfsPath
				);
				// If not a NodeFS path, we can't lock it.
				// Default to succeeding as Emscripten does.
				return 0;
			}

			errno = locking.check_lock_params(fd, op);
			if (errno !== 0) {
				_js_wasm_trace(
					'js_flock(%d, %d) check_lock_params errno %d',
					fd,
					op,
					errno
				);
				return -errno;
			}

			// @TODO: Consider supporting blocking mode of flock()
			if (op & (emscripten_LOCK_NB === 0)) {
				_js_wasm_trace(
					'js_flock(%d, %d) blocking mode of flock() is not implemented',
					fd,
					op
				);
				// We do not yet support the blocking form of flock().
				// We respond with EINVAL to indicate failure
				// because it is a known errno for a failed blocking flock().
				return -ERRNO_CODES.EINVAL;
			}

			const maskedOp =
				op &
				(emscripten_LOCK_SH | emscripten_LOCK_EX | emscripten_LOCK_UN);

			const lockOpType = flockToLockOpType[maskedOp];
			if (lockOpType === undefined) {
				_js_wasm_trace(
					'js_flock(%d, %d) invalid flock() operation',
					fd,
					op
				);
				return -ERRNO_CODES.EINVAL;
			}

			try {
				const nativeFilePath =
					locking.get_native_path_from_vfs_path(vfsPath);
				const obtainedLock = (
#if ASYNCIFY == 2
					await Promise.resolve(
#endif
						PHPLoader.fileLockManager.lockWholeFile(
							nativeFilePath,
							{
								type: lockOpType,
								pid: PHPLoader.processId,
								fd,
							}
						)
#if ASYNCIFY == 2
					)
#endif
				);
				_js_wasm_trace(
					'js_flock(%d, %d) lockWholeFile %s returned %d',
					fd,
					op,
					vfsPath,
					obtainedLock
				);
				if (obtainedLock) {
					locking.maybeLockedFds.add(fd);
					return 0;
				} else {
					return -ERRNO_CODES.EWOULDBLOCK;
				}
			} catch (e) {
				_js_wasm_trace('js_flock(%d, %d) lockWholeFile error %s', fd, op, e);
				return -ERRNO_CODES.EINVAL;
			}
#if ASYNCIFY == 2
		});
#endif
	},

	builtin_fd_close: LibraryManager.library.fd_close,
	builtin_fd_close__deps: LibraryManager.library.fd_close__deps || [],

	/**
	 * Override the builtin fd_close function to release file locks.
	 *
	 * @param {number} fd - the file descriptor
	 * @returns Zero on success, or a negative errno on failure.
	 */
	fd_close(fd) {
#if ASYNCIFY == 2
		return Asyncify.handleAsync(async () => {
#endif
			// We have to get the VFS path from the file descriptor
			// before closing it.
			const [vfsPath, vfsPathResolutionErrno] =
				locking.get_vfs_path_from_fd(fd);

			const fdCloseResult = _builtin_fd_close(fd);
			if (fdCloseResult !== 0 || !locking.maybeLockedFds.has(fd)) {
				_js_wasm_trace('fd_close(%d) result %d', fd, fdCloseResult);
				return fdCloseResult;
			}

			if (vfsPathResolutionErrno !== 0) {
				_js_wasm_trace(
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

			try {
				const nativeFilePath =
					locking.get_native_path_from_vfs_path(vfsPath);
#if ASYNCIFY == 2
				await
#endif
					PHPLoader.fileLockManager
						.releaseLocksForProcessFd(
							PHPLoader.processId,
							fd,
							nativeFilePath
						);
				_js_wasm_trace(
					'fd_close(%d) release locks success',
					fd
				);
			} catch (e) {
				_js_wasm_trace("fd_close(%d) error '%s'", fd, e);
			} finally {
				locking.maybeLockedFds.delete(fd);
			}
			return fdCloseResult;
#if ASYNCIFY == 2
		});
#endif
	},
	fd_close__deps: ['builtin_fd_close', 'js_wasm_trace'],

	/**
	 * Release all file locks for the current process.
	 *
	 * This function should be called at the end of each PHP request.
	 */
	js_release_file_locks: function js_release_file_locks() {
#if ASYNCIFY == 2
			return Asyncify.handleAsync(async () => {
#endif
				_js_wasm_trace('js_release_file_locks()');
				const pid = PHPLoader.processId;
				if (!pid || !PHPLoader.fileLockManager) {
					_js_wasm_trace('js_release_file_locks no pid or file lock manager');
					return 0;
				}

				try {
#if ASYNCIFY == 2
					await Promise.resolve(
#endif
						PHPLoader.fileLockManager
							.releaseLocksForProcess(pid)
#if ASYNCIFY == 2
					)
#endif
					_js_wasm_trace('js_release_file_locks succeeded');
				} catch (e) {
					_js_wasm_trace('js_release_file_locks error %s', e);
				}
#if ASYNCIFY == 2
			});
#endif
	},
};

autoAddDeps(LibraryForFileLocking, 'builtin_fcntl64');
autoAddDeps(LibraryForFileLocking, '__syscall_fcntl64');
autoAddDeps(LibraryForFileLocking, 'builtin_fd_close');
autoAddDeps(LibraryForFileLocking, 'fd_close');
mergeInto(LibraryManager.library, LibraryForFileLocking);
