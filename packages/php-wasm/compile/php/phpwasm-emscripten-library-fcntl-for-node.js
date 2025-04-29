/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

// TODO: Rename this file to be less specific and for file locking in general
// TODO: Rename this var to be more specific
const LibraryForNode = {
	$is_nodefs_node(node) {
		return node.node_ops === FS.NODEFS.node_ops;
	},
	$is_nodefs_path(path) {
		const node = FS.lookupPath(path);
		return this.$is_nodefs_node(node);
	},

	// Place the builtin fcntl64 implementation in an object so it is left
	// intact even if the function is not referenced by C/C++ code.
	// Ref: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#javascript-limits-in-library-files
	// TODO: Would "builtin" be better than "default"?
	$default_fcntl64__deps: LibraryManager.library.__syscall_fcntl64__deps,
	$default_fcntl64: {
		fn: LibraryManager.library.__syscall_fcntl64,
	},

	__syscall_fcntl64__deps: ['$default_fcntl64'],
	__syscall_fcntl64(fd, cmd, varargs) {
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
					// TODO: Throw specific error kind that can be relayed to syscaller via return and errno
					throw new Error(`Invalid whence value: ${whence}`);
			}

			if (baseAddress == -1) {
				// TODO: Throw specific error kind that can be relayed to syscaller via return and errno
				throw new Error('Failed to get end offset of file descriptor');
			}

			const resolvedOffset = baseAddress + startOffset;
			if (resolvedOffset < 0) {
				// TODO: Throw specific error kind that can be relayed to syscaller via return and errno
				throw new Error('Resolved offset is negative');
			}
			return resolvedOffset;
		}

		const pid = PHPLoader.processId;
		switch (cmd) {
			case emscripten_F_GETLK: {
				// TODO: Only support locking for NODEFS paths

				console.log('F_GETLK');
				let filePath;
				try {
					filePath = FS.readlink(`/proc/self/fd/${fd}`);
					console.log('filePath:', filePath);
				} catch (error) {
					console.log('unable to resolve file path from fd');
					_wasm_set_errno(ERRNO_CODES.EBADF);
					return -1;
				}

				const flockStructAddr = syscallGetVarargP();
				const flockStruct = readFlockStruct(flockStructAddr);
				const requestedLockType = fcntlToLockState[flockStruct.l_type];
				console.log('flock values:', {
					flockStructAddr: `0x${flockStructAddr.toString(16)}`,
					fcntlLockType: `0x${flockStruct.l_type.toString(16)}`,
					lockType: requestedLockType,
					fcntlLockWhence: `0x${flockStruct.l_whence.toString(16)}`,
					fcntlLockStart: `0x${flockStruct.l_start.toString(16)}`,
					fcntlLockEnd: `0x${flockStruct.l_len.toString(10)}`,
				});

				const absoluteStartOffset = getBaseAddress(
					fd,
					flockStruct.l_whence,
					flockStruct.l_start
				);

				// TODO: Can we and do we want to support setting pid of the locking process? I don't think so.
				// TODO: try/catch
				// TODO: Handle case where flock() conflicts with range lock
				return PHPLoader.fileLockManager
					.findFirstConflictingByteRangeLock(filePath, {
						type: requestedLockType,
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
					})
					.then(
						(conflictingLock) => {
							if (conflictingLock === undefined) {
								updateFlockStruct(flockStructAddr, {
									l_type: F_UNLCK,
								});
								return 0;
							}

							const fcntlLockState =
								lockStateToFcntl[conflictingLock.type];
							updateFlockStruct(flockStructAddr, {
								l_type: fcntlLockState,
								l_whence: emscripten_SEEK_SET,
								l_start: conflictingLock.start,
								l_len:
									conflictingLock.end - conflictingLock.start,
								l_pid: conflictingLock.pid,
							});
							return 0;
						}
						// TODO: handle error
						// TODO: Implement these error codes
						// EBADF
						// The filedes argument is invalid.
						// EINVAL
						// Either the lockp argument doesn’t specify valid lock information, or the file associated with filedes doesn’t support locks.
					);
			}
			case emscripten_F_SETLK: {
				// TODO: Only support locking for NODEFS paths

				let filePath;
				try {
					filePath = FS.readlink(`/proc/self/fd/${fd}`);
				} catch (error) {
					// TODO: Import and use logger.warn here
					console.log('unable to resolve file path from fd');
					_wasm_set_errno(ERRNO_CODES.EBADF);
					return -1;
				}

				var flockStructAddr = syscallGetVarargP();
				const flockStruct = readFlockStruct(flockStructAddr);
				const absoluteStartOffset = getBaseAddress(
					fd,
					flockStruct.l_whence,
					flockStruct.l_start
				);
				// TODO: Consider handling errors when fd access mode (read or write) does not match requested lock type
				// If we want to check fd access flags, we can use fcntl() with F_GETFL command
				const requestedLockType = fcntlToLockState[flockStruct.l_type];

				// TODO: Implement these error codes
				// EAGAIN
				// EBADF
				// 	Either: the filedes argument is invalid; you requested a read lock but the filedes is not open for read access; or, you requested a write lock but the filedes is not open for write access.
				// EINVAL

				const lockRange = {
					type: requestedLockType,
					start: absoluteStartOffset,
					end: absoluteStartOffset + flockStruct.l_len,
					pid,
				};

				if (lockRange.type === 'unlocked') {
					// TODO: What if you can't unlock because you don't have a lock?
					// TODO: Handle error
					const rangeToUnlock = {
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
					};
					return PHPLoader.fileLockManager
						.unlockFileByteRange(filePath, rangeToUnlock)
						.then(() => {
							return 0;
						});
				} else {
					// TODO: Handle error
					// TODO: Implement this for all flock fields
					const rangeToLock = {
						type: requestedLockType,
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
					};
					return PHPLoader.fileLockManager
						.lockFileByteRange(filePath, rangeToLock)
						.then((succeeded) => {
							if (succeeded) {
								return 0;
							} else {
								_wasm_set_errno(ERRNO_CODES.EAGAIN);
								return -1;
							}
						});
				}
			}
			// TODO: Implement waiting for lock
			case emscripten_F_SETLKW: {
				// NOTE: I don't think this is used by Playground.
				// Let's throw an error to discover if it is used.
				throw new Error('F_SETLKW is not implemented');
			}
			default:
				return default_fcntl64.fn(fd, cmd, varargs);
		}
	},

	js_release_file_locks() {
		if (PHPLoader.fileLockManager) {
			const pid = PHPLoader.processId;
			return PHPLoader.fileLockManager.releaseLocksForProcess(pid);
		}
	},

	// TODO: Try to eliminate the need to declare flock() itself in php_wasm.c
	// and find a way to declare it here in a way that overrides Emscripten's libc flock()
	js_flock(fd, op) {
		console.log('js_flock', fd, op);

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
		try {
			filePath = FS.readlink(`/proc/self/fd/${fd}`);
			console.log('filePath:', filePath);
		} catch (error) {
			console.log('unable to resolve file path from fd');
			_wasm_set_errno(ERRNO_CODES.EBADF);
			return -1;
		}

		// TODO: Consider supporting blocking mode of flock()
		if (op & (emscripten_LOCK_NB === 0)) {
			// TODO: Import and use logger.warn here
			console.warn('blocking mode of flock() is not implemented');
			// TODO: Set errno?
			return -1;
		}

		const maskedOp =
			op & (emscripten_LOCK_SH | emscripten_LOCK_EX | emscripten_LOCK_UN);

		
		const lockOpType = flockToLockOpType[maskedOp];
		if (lockOpType === undefined) {
			// TODO: Import and use logger.warn here
			console.warn('invalid flock() operation');
			// TODO: Set errno?
			return -1;
		}

		const result = PHPLoader.fileLockManager.lockWholeFile(filePath, {
			pid: PHPLoader.processId,
			type: lockOpType,
		});

		if (result) {
			return 0;
		} else {
			// TODO: Should this be EWOULDBLOCK? They are usually used interchangeably but are not necessarily the same.
			_wasm_set_errno(ERRNO_CODES.EAGAIN);
			return -1;
		}
	},
};

autoAddDeps(LibraryForNode, '$default_fcntl64');
autoAddDeps(LibraryForNode, '__syscall_fcntl64');
mergeInto(LibraryManager.library, LibraryForNode);
