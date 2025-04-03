/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

const LibraryForNode = {
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

		// TODO: Consider patching Emscripten to provide these offsets or add an access to php_wasm.c
		const emscripten_flock_l_type_offset = 0;
		const emscripten_flock_l_whence_offset = 2;
		const emscripten_flock_l_start_offset = 8;
		const emscripten_flock_l_len_offset = 16;
		const emscripten_flock_l_pid_offset = 24;

		function readFlockStruct(flockStructAddress) {
			return {
				// Shift right by N to divide by 2^N and get addresses for the correct word size
				l_type: HEAP16[(((flockStructAddress) + (emscripten_flock_l_type_offset)) >> 1)],
				l_whence: HEAP16[(((flockStructAddress) + (emscripten_flock_l_whence_offset)) >> 1)],
				l_start: HEAP64[(((flockStructAddress) + (emscripten_flock_l_start_offset)) >> 3)],
				l_len: HEAP64[(((flockStructAddress) + (emscripten_flock_l_len_offset)) >> 3)],
				l_pid: HEAP32[(((flockStructAddress) + (emscripten_flock_l_pid_offset)) >> 2)]
			};
		}

		function updateFlockStruct(flockStructAddress, fields) {
			if (fields.l_type !== undefined) {
				// Shift right by N to divide by 2^N and get addresses for the correct word size
				HEAP16[(((flockStructAddress) + (emscripten_flock_l_type_offset)) >> 1)] = fields.l_type;
			}
			if (fields.l_whence !== undefined) {
				HEAP16[(((flockStructAddress) + (emscripten_flock_l_whence_offset)) >> 1)] = fields.l_whence;
			}
			if (fields.l_start !== undefined) {
				HEAP64[(((flockStructAddress) + (emscripten_flock_l_start_offset)) >> 3)] = fields.l_start;
			}
			if (fields.l_len !== undefined) {
				HEAP64[(((flockStructAddress) + (emscripten_flock_l_len_offset)) >> 3)] = fields.l_len;
			}
			if (fields.l_pid !== undefined) {
				HEAP32[(((flockStructAddress) + (emscripten_flock_l_pid_offset)) >> 2)] = fields.l_pid;
			}
		}

		function getBaseAddress(fd, whence, startOffset) {
			let baseAddress;
			switch (whence) {
				case SEEK_SET:
					baseAddress = 0;
					break;
				case SEEK_CUR:
					baseAddress = FS.lseek(fd, 0, whence) + startOffset;
					break;
				case SEEK_END:
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

		// TODO: Rename this to something describing: php-wasm-pid
		const pid = PHPLoader.runtimeId;
		switch (cmd) {
			case emscripten_F_GETLK: {
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

				const flockStructAddress = syscallGetVarargP();
				const flockStruct = readFlockStruct(flockStructAddress);
				const requestedLockType = fcntlToLockState[flockStruct.l_type];
				console.log('flock values:', {
					flockStructAddress,
					fcntlLockType,
					requestedLockType,
					fcntlLockWhence,
					fcntlLockStart,
					fcntlLockLen,
					fcntlLockPid,
				});

				// TODO: Can we and do we want to support setting pid of the locking process? I don't think so.
				// TODO: try/catch
				return PHPLoader.fileLockManager.getConflictingLock(
					filePath,
					requestedLockType,
					pid
				).then(
					(conflictingLockType) => {
						// TODO: Implement this for all fields
						const fcntlLockState = lockStateToFcntl[conflictingLockType];
						// Shift right by 1 to div to divide by 2 and get the 16-bit word address
						HEAP16[(((flockStructAddress) + (emscripten_flock_l_type_offset)) >> 1)] = fcntlLockState;
						return 0;
					},
					// TODO: handle error
				);
			}
			case emscripten_F_SETLK: {
				console.log('F_SETLK');

				let filePath;
				try {
					filePath = FS.readlink(`/proc/self/fd/${fd}`);
					console.log('filePath:', filePath);
				} catch (error) {
					console.log('unable to resolve file path from fd');
					_wasm_set_errno(ERRNO_CODES.EBADF);
					return -1;
				}

				var flockStructAddr = syscallGetVarargP();
				const requestedFcntlLockType = HEAP16[(((flockStructAddr) + (emscripten_flock_l_type_offset)) >> 1)];
				const requestedFcntlLockWhence = HEAP16[(((flockStructAddr) + (emscripten_flock_l_whence_offset)) >> 1)];
				const requestedFcntlLockStart = HEAP64[(((flockStructAddr) + (emscripten_flock_l_start_offset)) >> 3)];
				const requestedFcntlLockLen = HEAP64[(((flockStructAddr) + (emscripten_flock_l_len_offset)) >> 3)];
				const requestedFcntlLockPid = HEAP32[(((flockStructAddr) + (emscripten_flock_l_pid_offset)) >> 2)];
				const requestedLockType = fcntlToLockState[requestedFcntlLockType];
				let rawBytes = '0x';
				for (let i = 0; i < 32; i++) {
					rawBytes += HEAPU8[flockStructAddr + i].toString(16).padStart(2, '0');
				}

				console.log('flock values:', {
					flockStructAddr: `0x${flockStructAddr.toString(16).padStart(8, '0')}`,
					fcntlLockType: `0x${requestedFcntlLockType.toString(16).padStart(4, '0')}`,
					lockType: requestedLockType,
					fcntlLockWhence: `0x${requestedFcntlLockWhence.toString(16).padStart(4, '0')}`,
					fcntlLockStart: `0x${requestedFcntlLockStart.toString(16).padStart(16, '0')}`, 
					fcntlLockLen: `0x${requestedFcntlLockLen.toString(16).padStart(16, '0')}`,
					rawBytes,
				});

				if (requestedLockType === 'unlocked') {
					// TODO: What if you can't unlock because you don't have a lock?
					// TODO: Handle error
					return PHPLoader.fileLockManager.unlockFile(filePath, pid).then(() => 0);
				} else {
					// TODO: Handle error
					// TODO: Implement this for all flock fields
					return PHPLoader.fileLockManager.lockFile(
						filePath,
						requestedLockType,
						pid
					).then(
						(succeeded) => {
							if (succeeded) {
								return 0;
							} else {
								_wasm_set_errno(ERRNO_CODES.EAGAIN)
								return -1;
							}
						}
					);
				}
			}
			// TODO: Implement waiting for lock
			case emscripten_F_SETLKW: {
				throw new Error('F_SETLKW is not implemented');
			}
			default:
				return default_fcntl64.fn(fd, cmd, varargs);
		}
	}
};

autoAddDeps(LibraryForNode, '$default_fcntl64');
autoAddDeps(LibraryForNode, '__syscall_fcntl64');
mergeInto(LibraryManager.library, LibraryForNode);
