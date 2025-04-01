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

		// TODO: Document Emscripten replacement
		const emscripten_F_GETLK = Number('{{{cDefs.F_GETLK}}}');
		const emscripten_F_SETLK = Number('{{{cDefs.F_SETLK}}}');
		const emscripten_F_SETLKW = Number('{{{cDefs.F_SETLKW}}}');
		const emscripten_flock_l_type_offset =
			Number('{{{ C_STRUCTS.flock.l_type }}}');

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
				const requestedFcntlLockType =
					HEAP16[(((flockStructAddress) + (emscripten_flock_l_type_offset)) >> 1)];
				const requestedLockType = fcntlToLockState[requestedFcntlLockType];

				// TODO: Can we and do we want to support setting pid of the locking process? I don't think so.
				// TODO: try/catch
				return PHPLoader.fileLockManager.getConflictingLock(
					filePath,
					requestedLockType,
					pid
				).then(
					(conflictingLockType) => {
						const fcntlLockState = lockStateToFcntl[conflictingLockType];
						// TODO: Understand why the shift
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
				// TODO: Understand why the shift by 1
				const requestedFcntlLockType =
					HEAP16[(((flockStructAddr) + (emscripten_flock_l_type_offset)) >> 1)];
				console.log('requestedFcntlLockType:', requestedFcntlLockType);
				const requestedLockType = fcntlToLockState[requestedFcntlLockType];
				// TODO: Handle undefined lock type
				console.log(`requestedLockType: ${requestedLockType}`)

				if (requestedLockType === 'unlocked') {
					// TODO: What if you can't unlock because you don't have a lock?
					// TODO: Handle error
					return PHPLoader.fileLockManager.unlockFile(filePath, pid).then(() => 0);
				} else {
					// TODO: Handle error
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
