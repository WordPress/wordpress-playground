/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

// TODO: Rename this file to be less specific and for file locking in general
const LibraryForFileLocking = {
	$lock_utils: {
		is_nodefs_node(node) {
			return (
				node &&
				typeof NODEFS === 'object' &&
				node.node_ops === NODEFS.node_ops
			);
		},
		is_nodefs_path(path) {
			const { node } = FS.lookupPath(path);
			return lock_utils.is_nodefs_node(node);
		},
		get_fd_access_mode(fd) {
			const emscripten_F_GETFL = Number('{{{cDefs.F_GETFL}}}');
			const emscripten_O_ACCMODE = Number('{{{ cDefs.O_ACCMODE}}}');
			return (
				default_fcntl64.fn(fd, emscripten_F_GETFL) &
				emscripten_O_ACCMODE
			);
		},
		resolveFileDescriptorToPath(fd) {
			try {
				return [FS.readlink(`/proc/self/fd/${fd}`), 0];
			} catch (error) {
				return [null, ERRNO_CODES.EBADF];
			}
		},

		// TODO: Reconsider and/or comment
		maybeLockedFds: new Set(),
	},

	// Place the builtin fcntl64 implementation in an object so it is left
	// intact even if the function is not referenced by C/C++ code.
	// Ref: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#javascript-limits-in-library-files
	// TODO: Would "builtin" be better than "default"?
	$default_fcntl64__deps: LibraryManager.library.__syscall_fcntl64__deps,
	$default_fcntl64: {
		fn: LibraryManager.library.__syscall_fcntl64,
	},

	js__syscall_fcntl64__deps: ['$default_fcntl64', '$lock_utils'],
	js__syscall_fcntl64(fd, cmd, varargs) {
		// Necessary to use varargs accessor
		SYSCALLS.varargs = varargs;

		// From:
		// https://github.com/emscripten-core/emscripten/blob/66d2137b0381ac35f7e2346b2d6a90abd0f1211a/system/lib/libc/musl/include/fcntl.h#L58-L60
		const F_RDLCK = 0;
		const F_WRLCK = 1;
		const F_UNLCK = 2;

		const lockStateToFcntl = {
			shared: F_RDLCK,
			exclusive: F_WRLCK,
			unlocked: F_UNLCK,
		};
		const fcntlToLockState = {
			[F_RDLCK]: 'shared',
			[F_WRLCK]: 'exclusive',
			[F_UNLCK]: 'unlocked',
		};

		// These constants are replaced by Emscripten during the build process
		const emscripten_F_GETLK = Number('{{{cDefs.F_GETLK}}}');
		const emscripten_F_SETLK = Number('{{{cDefs.F_SETLK}}}');
		const emscripten_F_SETLKW = Number('{{{cDefs.F_SETLKW}}}');
		const emscripten_SEEK_SET = Number('{{{cDefs.SEEK_SET}}}');
		const emscripten_O_ACCMODE = Number('{{{ cDefs.O_ACCMODE}}}');
		const emscripten_O_RDONLY = Number('{{{ cDefs.O_RDONLY}}}');
		const emscripten_O_WRONLY = Number('{{{ cDefs.O_WRONLY}}}');
		const emscripten_O_RDWR = Number('{{{ cDefs.O_RDWR}}}');

		// TODO: Consider patching Emscripten to provide these offsets or add an access to php_wasm.c
		const emscripten_flock_l_type_offset = 0;
		const emscripten_flock_l_whence_offset = 2;
		const emscripten_flock_l_start_offset = 8;
		const emscripten_flock_l_len_offset = 16;
		const emscripten_flock_l_pid_offset = 24;

		function readFlockStruct(flockStructAddress) {
			return {
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

		function updateFlockStruct(flockStructAddress, fields) {
			if (fields.l_type !== undefined) {
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

		function getBaseAddress(fd, whence, startOffset) {
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

		function checkLockParams(fd, l_type) {
			// TODO: Test logger here again. It seemed to cause some kind of locking problem.
			if (!(l_type in fcntlToLockState)) {
				return ERRNO_CODES.EINVAL;
			}

			const accessMode = lock_utils.get_fd_access_mode(fd);
			if (
				(l_type === F_WRLCK && accessMode === emscripten_O_RDONLY) ||
				(l_type === F_RDLCK && accessMode === emscripten_O_WRONLY)
			) {
				return ERRNO_CODES.EBADF;
			}

			return 0;
		}

		const pid = PHPLoader.processId;
		switch (cmd) {
			case emscripten_F_GETLK: {
				js_wasm_trace(`fcntl F_GETLK ${fd}`);
				let filePath;
				let errno;

				[filePath, errno] = lock_utils.resolveFileDescriptorToPath(fd);
				if (errno !== 0) {
					js_wasm_trace(
						`fcntl F_GETLK ${fd} ${filePath} resolveFileDescriptorToPath errno ${errno}`
					);
					_wasm_set_errno(errno);
					return -1;
				}

				if (!lock_utils.is_nodefs_path(filePath)) {
					// If not a NodeFS path, we can't lock it.
					// Default to succeeding as Emscripten does.
					logger.warn(
						`locking via fcntl() is not implemented for non-NodeFS path '${filePath}'`
					);
					// TODO: Set struct to UNLCK
					js_wasm_trace(
						`fcntl F_GETLK ${fd} ${filePath} is_nodefs_path false`
					);
					return 0;
				}

				const flockStructAddr = syscallGetVarargP();
				const flockStruct = readFlockStruct(flockStructAddr);

				errno = checkLockParams(fd, flockStruct.l_type);
				if (errno !== 0) {
					_wasm_set_errno(errno);
					js_wasm_trace(
						`fcntl F_GETLK ${fd} ${filePath} check_lock_params errno ${errno}`
					);
					return -1;
				}

				const requestedLockType = fcntlToLockState[flockStruct.l_type];
				let absoluteStartOffset;
				[absoluteStartOffset, errno] = getBaseAddress(
					fd,
					flockStruct.l_whence,
					flockStruct.l_start
				);
				if (errno !== 0) {
					_wasm_set_errno(errno);
					js_wasm_trace(
						`fcntl F_GETLK ${fd} ${filePath} get_base_address errno ${errno}`
					);
					return -1;
				}

				// TODO: Can we and do we want to support setting pid of the locking process? I don't think so.
				// TODO: try/catch
				// TODO: Handle case where flock() conflicts with range lock
				return PHPLoader.fileLockManager
					.findFirstConflictingByteRangeLock(filePath, {
						type: requestedLockType,
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
						fd,
					})
					.then((conflictingLock) => {
						if (conflictingLock === undefined) {
							updateFlockStruct(flockStructAddr, {
								l_type: F_UNLCK,
							});
							js_wasm_trace(
								`fcntl F_GETLK ${fd} ${filePath} findFirstConflictingByteRangeLock type=unlocked start=0x${absoluteStartOffset
									.toString(16)
									.padStart(16, '0')} end=0x${(
									absoluteStartOffset + flockStruct.l_len
								)
									.toString(16)
									.padStart(
										16,
										'0'
									)} conflictingLock undefined`
							);
							return 0;
						}

						const fcntlLockState =
							lockStateToFcntl[conflictingLock.type];
						updateFlockStruct(flockStructAddr, {
							l_type: fcntlLockState,
							l_whence: emscripten_SEEK_SET,
							l_start: conflictingLock.start,
							l_len: conflictingLock.end - conflictingLock.start,
							l_pid: conflictingLock.pid,
						});
						js_wasm_trace(
							`fcntl F_GETLK ${fd} ${filePath} findFirstConflictingByteRangeLock type=${
								conflictingLock.type
							} start=0x${conflictingLock.start
								.toString(16)
								.padStart(16, '0')} end=0x${conflictingLock.end
								.toString(16)
								.padStart(16, '0')} conflictingLock ${
								conflictingLock.pid
							}`
						);
						return 0;
					})
					.catch((e) => {
						js_wasm_trace(
							`fcntl F_GETLK ${fd} ${filePath} findFirstConflictingByteRangeLock error ${JSON.stringify(
								e,
								(key, value) =>
									typeof value === 'bigint'
										? `0x${value
												.toString(16)
												.padStart(16, '0')}`
										: value
							)}`
						);
						_wasm_set_errno(ERRNO_CODES.EINVAL);
						return -1;
					});
			}
			case emscripten_F_SETLK: {
				// js_wasm_trace(`fcntl F_SETLK ${fd}`);
				let filePath;
				let errno;
				[filePath, errno] = lock_utils.resolveFileDescriptorToPath(fd);
				// js_wasm_trace(`fcntl F_SETLK ${fd} resolveFileDescriptorToPath ${filePath} ${errno}`);
				if (errno !== 0) {
					_wasm_set_errno(errno);
					js_wasm_trace(
						`fcntl F_SETLK ${fd} ${filePath} resolveFileDescriptorToPath errno ${errno}`
					);
					return -1;
				}

				// js_wasm_trace(`fcntl F_SETLK ${fd} before is_nodefs_path ${lock_utils.is_nodefs_path(filePath)}`);
				if (!lock_utils.is_nodefs_path(filePath)) {
					// If not a NodeFS path, we can't lock it.
					// Default to succeeding as Emscripten does.
					logger.warn(
						`locking via fcntl() is not implemented for non-NodeFS path '${filePath}'`
					);
					// js_wasm_trace(`fcntl F_SETLK ${fd} ${filePath} is_nodefs_path false`);
					return 0;
				}
				// js_wasm_trace(`fcntl F_SETLK ${fd} after is_nodefs_path ${lock_utils.is_nodefs_path(filePath)}`);

				var flockStructAddr = syscallGetVarargP();
				const flockStruct = readFlockStruct(flockStructAddr);

				// js_wasm_trace(`fcntl F_SETLK ${fd} after readFlockStruct ${JSON.stringify(flockStruct, (key, value) => typeof value === "bigint" ? `0x${value.toString(16).padStart(16, '0')}` : value)}`);

				let absoluteStartOffset;
				[absoluteStartOffset, errno] = getBaseAddress(
					fd,
					flockStruct.l_whence,
					flockStruct.l_start
				);
				if (errno !== 0) {
					_wasm_set_errno(errno);
					js_wasm_trace(
						`fcntl F_SETLK ${fd} ${filePath} get_base_address errno ${errno}`
					);
					return -1;
				}
				// js_wasm_trace(`fcntl F_SETLK ${fd} after get_base_address ${absoluteStartOffset}`);

				errno = checkLockParams(fd, flockStruct.l_type);
				if (errno !== 0) {
					_wasm_set_errno(errno);
					js_wasm_trace(
						`fcntl F_SETLK ${fd} ${filePath} check_lock_params errno ${errno}`
					);
					return -1;
				}
				// js_wasm_trace(`fcntl F_SETLK ${fd} after check_lock_params ${errno}`);

				// TODO: Explain why
				lock_utils.maybeLockedFds.add(fd);
				// js_wasm_trace(`fcntl F_SETLK ${fd} after maybeLockedFds.add ${fd}`);
				const requestedLockType = fcntlToLockState[flockStruct.l_type];
				const rangeLock = {
					type: requestedLockType,
					start: absoluteStartOffset,
					end: absoluteStartOffset + flockStruct.l_len,
					pid,
					fd,
				};
				js_wasm_trace(
					`fcntl F_SETLK ${fd} ${filePath} before lockFileByteRange ${JSON.stringify(
						rangeLock,
						(key, value) =>
							typeof value === 'bigint'
								? `0x${value.toString(16).padStart(16, '0')}`
								: value
					)}`
				);
				return PHPLoader.fileLockManager
					.lockFileByteRange(filePath, rangeLock)
					.then((succeeded) => {
						js_wasm_trace(
							`fcntl F_SETLK ${fd} ${filePath} lockFileByteRange type=${requestedLockType} start=0x${absoluteStartOffset
								.toString(16)
								.padStart(16, '0')} end=0x${(
								absoluteStartOffset + flockStruct.l_len
							)
								.toString(16)
								.padStart(16, '0')} ${succeeded}`
						);
						if (succeeded) {
							return 0;
						} else {
							_wasm_set_errno(ERRNO_CODES.EAGAIN);
							return -1;
						}
					})
					.catch((e) => {
						js_wasm_trace(
							`fcntl F_SETLK ${fd} ${filePath} lockFileByteRange error ${JSON.stringify(
								e,
								(key, value) =>
									typeof value === 'bigint'
										? `0x${value
												.toString(16)
												.padStart(16, '0')}`
										: value
							)}`
						);
						_wasm_set_errno(ERRNO_CODES.EINVAL);
						return -1;
					});
			}
			// TODO: Implement waiting for lock
			case emscripten_F_SETLKW: {
				// NOTE: I don't think this is used by Playground.
				// Let's throw an error to discover if it is used.
				js_wasm_trace('F_SETLKW is not implemented');
				// TODO: Should we use a different error code?
				// Respond with EDEADLOCK to indicate that the lock is not available via blocking form
				_wasm_set_errno(ERRNO_CODES.EDEADLOCK);
				return -1;
			}
			default:
				return default_fcntl64.fn(fd, cmd, varargs);
		}
	},

	js_release_file_locks() {
		js_wasm_trace(`js_release_file_locks ${PHPLoader.processId}`);
		if (PHPLoader.fileLockManager) {
			const pid = PHPLoader.processId;
			return PHPLoader.fileLockManager
				.releaseLocksForProcess(pid)
				.then((result) => {
					js_wasm_trace(`js_release_file_locks ${pid} ${result}`);
					return result;
				})
				.catch((e) => {
					// TODO: What to actually do for an error here? Can we crash?
					js_wasm_trace(
						`js_release_file_locks ${pid} error ${JSON.stringify(
							e,
							(key, value) =>
								typeof value === 'bigint'
									? `0x${value
											.toString(16)
											.padStart(16, '0')}`
									: value
						)}`
					);
					return -1;
				});
		}
	},

	// TODO: Try to eliminate the need to declare flock() itself in php_wasm.c
	// and find a way to declare it here in a way that overrides Emscripten's libc flock()
	js_flock(fd, op) {
		js_wasm_trace(`js_flock ${fd} ${op}`);
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

		let filePath;
		let errno;

		[filePath, errno] = lock_utils.resolveFileDescriptorToPath(fd);
		js_wasm_trace(
			`js_flock ${fd} ${op} resolveFileDescriptorToPath ${filePath} ${errno}`
		);
		if (errno !== 0) {
			_wasm_set_errno(errno);
			return -1;
		}

		if (!lock_utils.is_nodefs_path(filePath)) {
			// If not a NodeFS path, we can't lock it.
			// Default to succeeding as Emscripten does.
			logger.warn(
				`flock() is not implemented for non-NodeFS path '${filePath}'`
			);
			return -1;
		}

		const accessMode = lock_utils.get_fd_access_mode(fd);
		// TODO: Don't we have a helper for this?
		if (
			(accessMode === emscripten_O_WRONLY && op === emscripten_LOCK_SH) ||
			(accessMode === emscripten_O_RDONLY && op === emscripten_LOCK_EX)
		) {
			_wasm_set_errno(ERRNO_CODES.EBADF);
			return -1;
		}

		// TODO: Consider supporting blocking mode of flock()
		if (op & (emscripten_LOCK_NB === 0)) {
			// TODO: Fix this logging
			//logger.error('blocking mode of flock() is not implemented');
			console.error('blocking mode of flock() is not implemented');
			_wasm_set_errno(ERRNO_CODES.EDEADLOCK);
			return -1;
		}

		const maskedOp =
			op & (emscripten_LOCK_SH | emscripten_LOCK_EX | emscripten_LOCK_UN);

		const lockOpType = flockToLockOpType[maskedOp];
		if (lockOpType === undefined) {
			logger.warn(
				`invalid flock() operation: 0x${lockOpType.toString(16)}`
			);
			_wasm_set_errno(ERRNO_CODES.EINVAL);
			return -1;
		}

		const result = PHPLoader.fileLockManager.lockWholeFile(filePath, {
			type: lockOpType,
			pid: PHPLoader.processId,
			fd,
		});
		js_wasm_trace(
			`js_flock ${fd} ${op} ${filePath} lockWholeFile ${result}`
		);

		if (result) {
			return 0;
		} else {
			_wasm_set_errno(ERRNO_CODES.EWOULDBLOCK);
			return -1;
		}
	},

	$default_fd_close: {
		fn: LibraryManager.library.fd_close,
	},

	fd_close__deps: ['$default_fd_close'],
	fd_close(fd) {
		// js_wasm_trace(`fd_close ${fd}`);
		const [path, pathResolutionErrno] =
			lock_utils.resolveFileDescriptorToPath(fd);
		const shouldLog =
			pathResolutionErrno === 0 && path.includes('.ht.sqlite');
		// js_wasm_trace(`fd_close ${fd} resolveFileDescriptorToPath ${path} ${pathResolutionErrno}`);
		if (lock_utils.maybeLockedFds.has(fd) && pathResolutionErrno === 0) {
			shouldLog &&
				js_wasm_trace(
					`fd_close ${fd} ${path} calling default_fd_close`
				);
			// TODO: Say why closing this first
			const result = default_fd_close.fn(fd);
			shouldLog &&
				js_wasm_trace(
					`fd_close ${fd} ${path} finished default_fd_close ${result}`
				);
			return PHPLoader.fileLockManager
				.releaseLocksForProcessFd(PHPLoader.processId, fd, path)
				.finally(() => {
					shouldLog &&
						js_wasm_trace(`fd_close ${fd} ${path} finally`);
					lock_utils.maybeLockedFds.delete(fd);
				})
				.then(() => {
					shouldLog && js_wasm_trace(`fd_close ${fd} ${result}`);
					return result;
				})
				.catch((e) => {
					shouldLog &&
						js_wasm_trace(
							`fd_close ${fd} error ${JSON.stringify(
								e,
								(key, value) =>
									typeof value === 'bigint'
										? `0x${value
												.toString(16)
												.padStart(16, '0')}`
										: value
							)}`
						);
				});
		} else {
			shouldLog &&
				js_wasm_trace(`fd_close ${fd} ${path} default_fd_close case`);
			return default_fd_close.fn(fd);
		}
	},

	// Provide "real" PID to help with logging when debugging multi-worker issues
	js_getpid() {
		return PHPLoader.processId;
	},
};

autoAddDeps(LibraryForFileLocking, '$default_fcntl64');
autoAddDeps(LibraryForFileLocking, '__syscall_fcntl64');
mergeInto(LibraryManager.library, LibraryForFileLocking);
