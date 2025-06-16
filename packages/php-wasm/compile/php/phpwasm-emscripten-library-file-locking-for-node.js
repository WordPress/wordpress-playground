/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
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
			const { node } = FS.lookupPath(path);

			if (node?.isSharedFS) {
				return true;
			}

			if (!node?.mount?.opts?.fs?.lookupPath) {
				return false;
			}

			const vfsPath = NODEFS.realPath(node);
			const underlyingNode = node.mount.opts.fs.lookupPath(vfsPath)?.node;
			return !!underlyingNode?.isSharedFS;
		},
		get_fd_access_mode(fd) {
			const emscripten_F_GETFL = Number('{{{cDefs.F_GETFL}}}');
			const emscripten_O_ACCMODE = Number('{{{ cDefs.O_ACCMODE}}}');

			return (
				default_fcntl64.fn(fd, emscripten_F_GETFL) &
				emscripten_O_ACCMODE
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
			const { node } = FS.lookupPath(vfsPath);
			return NODEFS.realPath(node);
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
	// TODO: Would "builtin" be better than "default"?
	$default_fcntl64__deps: LibraryManager.library.__syscall_fcntl64__deps,
	$default_fcntl64: {
		fn: LibraryManager.library.__syscall_fcntl64,
	},

	__syscall_fcntl64__deps: [
		...LibraryManager.library.__syscall_fcntl64__deps,
		'$default_fcntl64',
		'$locking',
	],
	__syscall_fcntl64__sig: LibraryManager.library.__syscall_fcntl64__sig,
	__syscall_fcntl64: async function __syscall_fcntl64(fd, cmd, varargs) {
		// return Asyncify.handleAsync(async () => {
		// Necessary to use varargs accessor
		SYSCALLS.varargs = varargs;

		// These constants are replaced by Emscripten during the build process
		const emscripten_F_GETLK = Number('{{{cDefs.F_GETLK}}}');
		const emscripten_F_SETLK = Number('{{{cDefs.F_SETLK}}}');
		const emscripten_F_SETLKW = Number('{{{cDefs.F_SETLKW}}}');
		const emscripten_SEEK_SET = Number('{{{cDefs.SEEK_SET}}}');

		// TODO: consider patching emscripten to provide these offsets or add an access to php_wasm.c
		const emscripten_flock_l_type_offset = 0;
		const emscripten_flock_l_whence_offset = 2;
		const emscripten_flock_l_start_offset = 8;
		const emscripten_flock_l_len_offset = 16;
		const emscripten_flock_l_pid_offset = 24;

		function read_flock_struct(flockStructAddress) {
			return {
				// TODO: Document this better.
				// Shift right by N to divide by 2^N and get addresses for the correct word size
				l_type: HEAP16[
					(flockStructAddress + emscripten_flock_l_type_offset) >> 1
				],
				l_whence:
					HEAP16[
						(flockStructAddress +
							emscripten_flock_l_whence_offset) >>
							1
					],
				l_start:
					HEAP64[
						(flockStructAddress +
							emscripten_flock_l_start_offset) >>
							3
					],
				l_len: HEAP64[
					(flockStructAddress + emscripten_flock_l_len_offset) >> 3
				],
				l_pid: HEAP32[
					(flockStructAddress + emscripten_flock_l_pid_offset) >> 2
				],
			};
		}

		function update_flock_struct(flockStructAddress, fields) {
			if (fields.l_type !== undefined) {
				// TODO: Document this better.
				// Shift right by N to divide by 2^N and get addresses for the correct word size
				HEAP16[
					(flockStructAddress + emscripten_flock_l_type_offset) >> 1
				] = fields.l_type;
			}
			if (fields.l_whence !== undefined) {
				HEAP16[
					(flockStructAddress + emscripten_flock_l_whence_offset) >> 1
				] = fields.l_whence;
			}
			if (fields.l_start !== undefined) {
				HEAP64[
					(flockStructAddress + emscripten_flock_l_start_offset) >> 3
				] = fields.l_start;
			}
			if (fields.l_len !== undefined) {
				HEAP64[
					(flockStructAddress + emscripten_flock_l_len_offset) >> 3
				] = fields.l_len;
			}
			if (fields.l_pid !== undefined) {
				HEAP32[
					(flockStructAddress + emscripten_flock_l_pid_offset) >> 2
				] = fields.l_pid;
			}
		}

		// TODO: Finish documenting this.
		/**
		 * Resolve the base address of the range depending on the whence and start offset.
		 * @param {*} fd
		 * @param {*} whence
		 * @param {*} startOffset
		 * @returns
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
					_js_wasm_trace('fcntl(%d, F_GETLK) %s get_vfs_path_from_fd errno %d', fd, vfsPath, errno);
					return -ERRNO_CODES.EBADF;
				}

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

				const flockStructAddr = syscallGetVarargP();
				const flockStruct = read_flock_struct(flockStructAddr);

				if (!(flockStruct.l_type in locking.fcntlToLockState)) {
					return -ERRNO_CODES.EINVAL;
				}

				errno = locking.check_lock_params(fd, flockStruct.l_type);
				if (errno !== 0) {
					_js_wasm_trace('fcntl(%d, F_GETLK) %s check_lock_params errno %d', fd, vfsPath, errno);
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
					_js_wasm_trace('fcntl(%d, F_GETLK) %s get_base_address errno %d', fd, vfsPath, errno);
					return -ERRNO_CODES.EINVAL;
				}

				const nativeFilePath =
					locking.get_native_path_from_vfs_path(vfsPath);

				// TODO: try/catch
				// TODO: Handle case where flock() conflicts with range lock
				return PHPLoader.fileLockManager
					.findFirstConflictingByteRangeLock(nativeFilePath, {
						type: requestedLockType,
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
					})
					.then((conflictingLock) => {
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
							l_len: conflictingLock.end - conflictingLock.start,
							l_pid: conflictingLock.pid,
						});
						return 0;
					})
					.catch((e) => {
						_js_wasm_trace('fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock error %s', fd, vfsPath, e);
						return -ERRNO_CODES.EINVAL;
					});
			}
			case emscripten_F_SETLK: {
				_js_wasm_trace('fcntl(%d, F_SETLK)', fd);
				let vfsPath;
				let errno;
				[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
				if (errno !== 0) {
					_js_wasm_trace('fcntl(%d, F_SETLK) %s get_vfs_path_from_fd errno %d', fd, vfsPath, errno);
					return -errno;
				}

				if (!locking.is_path_to_shared_fs(vfsPath)) {
					_js_wasm_trace('fcntl(%d, F_SETLK) locking is not implemented for non-NodeFS path %s', fd, vfsPath);

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
					_js_wasm_trace('fcntl(%d, F_SETLK) %s get_base_address errno %d', fd, vfsPath, errno);
					return -errno;
				}

				if (!(flockStruct.l_type in locking.fcntlToLockState)) {
					_js_wasm_trace('fcntl(%d, F_SETLK) %s invalid lock type %d', fd, vfsPath, flockStruct.l_type);
					return -ERRNO_CODES.EINVAL;
				}

				errno = locking.check_lock_params(fd, flockStruct.l_type);
				if (errno !== 0) {
					_js_wasm_trace('fcntl(%d, F_SETLK) %s check_lock_params errno %d', fd, vfsPath, errno);
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

				const nativeFilePath =
					locking.get_native_path_from_vfs_path(vfsPath);
				_js_wasm_trace('fcntl(%d, F_SETLK) %s calling lockFileByteRange for range lock %s', fd, vfsPath, rangeLock);
				return PHPLoader.fileLockManager
					.lockFileByteRange(nativeFilePath, rangeLock)
					.then((succeeded) => {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s lockFileByteRange returned %d for range lock %s',
							fd,
							vfsPath,
							succeeded,
							rangeLock,
						);
						return succeeded ? 0 : -ERRNO_CODES.EAGAIN;
					})
					.catch((e) => {
						_js_wasm_trace('fcntl(%d, F_SETLK) %s lockFileByteRange error %s for range lock %s', fd, vfsPath, e, rangeLock);
						return -ERRNO_CODES.EINVAL;
					});
			}
			// @TODO: Implement waiting for lock
			case emscripten_F_SETLKW: {
				// Respond with EDEADLOCK to indicate that the lock is not available via blocking form
				return -ERRNO_CODES.EDEADLOCK;
			}
			default:
				return default_fcntl64.fn(fd, cmd, varargs);
		}
		// });
	},

	// TODO: Try to eliminate the need to declare flock() itself in php_wasm.c
	// and find a way to declare it here in a way that overrides Emscripten's libc flock()
	js_flock: async function js_flock(fd, op) {
		// return Asyncify.handleAsync(async () => {
		_js_wasm_trace('js_flock(%d, %d)', fd, op);
		// TODO: Consider patching Emscripten to relay these constants via cDefs.
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
			_js_wasm_trace('js_flock(%d, %d) get_vfs_path_from_fd errno %d', fd, op, vfsPath, errno);
			return -errno;
		}

		if (!locking.is_path_to_shared_fs(vfsPath)) {
			_js_wasm_trace('js_flock(%d, %d) locking is not implemented for non-NodeFS path %s', fd, op, vfsPath);
			// If not a NodeFS path, we can't lock it.
			// Default to succeeding as Emscripten does.
			return 0;
		}

		errno = locking.check_lock_params(fd, op);
		if (errno !== 0) {
			_js_wasm_trace('js_flock(%d, %d) check_lock_params errno %d', fd, op, errno);
			return -errno;
		}

		// @TODO: Consider supporting blocking mode of flock()
		if (op & (emscripten_LOCK_NB === 0)) {
			_js_wasm_trace('js_flock(%d, %d) blocking mode of flock() is not implemented', fd, op);
			// TODO: Should we use a different error code?
			return -ERRNO_CODES.EDEADLOCK;
		}

		const maskedOp =
			op & (emscripten_LOCK_SH | emscripten_LOCK_EX | emscripten_LOCK_UN);

		const lockOpType = flockToLockOpType[maskedOp];
		if (lockOpType === undefined) {
			_js_wasm_trace('js_flock(%d, %d) invalid flock() operation', fd, op);
			return -ERRNO_CODES.EINVAL;
		}

		const nativeFilePath = locking.get_native_path_from_vfs_path(vfsPath);
		const obtainedLock = await PHPLoader.fileLockManager.lockWholeFile(
			nativeFilePath,
			{
				type: lockOpType,
				pid: PHPLoader.processId,
				fd,
			}
		);
		_js_wasm_trace('js_flock(%d, %d) lockWholeFile %s returned %d', fd, op, vfsPath, obtainedLock);
		return obtainedLock ? 0 : -ERRNO_CODES.EWOULDBLOCK;
		// });
	},

	$default_fd_close__deps: LibraryManager.library.fd_close__deps || [],
	$default_fd_close: {
		fn: LibraryManager.library.fd_close,
	},

	fd_close__deps: ['$default_fd_close', 'js_wasm_trace'],
	fd_close(fd) {
		_js_wasm_trace('fd_close(%d)', fd);

		const [vfsPath, pathResolutionErrno] = locking.get_vfs_path_from_fd(fd);
		if (pathResolutionErrno !== 0) {
			_js_wasm_trace('fd_close(%d) get_vfs_path_from_fd error %d', fd, pathResolutionErrno);
			return -ERRNO_CODES.EBADF;
		}

		const result = default_fd_close.fn(fd);
		// return Asyncify.handleAsync(async () => {
		if (result === 0 && locking.maybeLockedFds.has(fd)) {
			const nativeFilePath =
				locking.get_native_path_from_vfs_path(vfsPath);

			return PHPLoader.fileLockManager
				.releaseLocksForProcessFd(
					PHPLoader.processId,
					fd,
					nativeFilePath
				)
				.then(() => {
					_js_wasm_trace('fd_close(%d) release locks success', fd);
				})
				.catch((e) => {
					_js_wasm_trace("fd_close(%d) error '%s'", fd, e);
				})
				.then(() => {
					_js_wasm_trace('fd_close(%d) result %d', fd, result);
					return result;
				})
				.finally(() => {
					locking.maybeLockedFds.delete(fd);
				});
		} else {
			_js_wasm_trace('fd_close(%d) result %d', fd, result);
			return result;
		}
	},

	// TODO: Document this in PR
	// TODO: Document this inline
	js_release_file_locks: async function js_release_file_locks() {
		_js_wasm_trace('js_release_file_locks()');
		// TODO: Why make this conditional?
		if (PHPLoader.fileLockManager) {
			const pid = PHPLoader.processId;
			return await PHPLoader.fileLockManager
				.releaseLocksForProcess(pid)
				.then(() => {
					_js_wasm_trace('js_release_file_locks succeeded');
				})
				.catch((e) => {
					logger.error('js_release_file_locks error', e);
					_js_wasm_trace('js_release_file_locks error %s', e);
				});
		}
		// });
	},
};

autoAddDeps(LibraryForFileLocking, '$default_fcntl64');
autoAddDeps(LibraryForFileLocking, '__syscall_fcntl64');
autoAddDeps(LibraryForFileLocking, '$default_fd_close');
autoAddDeps(LibraryForFileLocking, 'fd_close');
mergeInto(LibraryManager.library, LibraryForFileLocking);
