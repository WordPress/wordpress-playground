/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

const LibraryForNode = {
	default__syscall_fcntl64_deps: LibraryManager.library.__syscall_fcntl64_deps,
	default__syscall_fcntl64: LibraryManager.library.__syscall_fcntl64,

	__syscall_fcntl64__deps: ['$syscallGetVarargP', '$syscallGetVarargI'],
	__syscall_fcntl64: function (fd, cmd, varargs) {
		SYSCALLS.varargs = varargs;

		// These constants aren't available for replacement via cDefs.
		// But they are defined here:
		// https://github.com/emscripten-core/emscripten/blob/8dd512d27914bb7e51ce9e7d6a33b3bebb05efb2/system/lib/libc/musl/include/fcntl.h#L58-L60
		const em_F_RDLCK = 0; 
		const em_F_WRLCK = 1; 
		const em_F_UNLCK = 2; 

		const em_EBADF = {{{ cDefs.EBADF }}};
		const em_EINVAL = {{{ cDefs.EINVAL }}};

		const LOCK_SH_NB = fsExtConstants.LOCK_SH | fsExtConstants.LOCK_NB;
		const LOCK_EX_NB = fsExtConstants.LOCK_EX | fsExtConstants.LOCK_NB;
		const LOCK_UN_NB = fsExtConstants.LOCK_EX | fsExtConstants.LOCK_NB;

		function canLock(fd, lockType) {
			var shouldUnlock = false;
			try {
				fsExt.flockSync(fd, lockType);
				shouldUnlock = true;
				return [true, 0];
			} catch (e) {
				var maybeErrNo;
				switch (e) {
					// Note: on most platforms (maybe all we care about),
					// EAGAIN and EWOULDBLOCK are equivalent,
					// but there is no harm in checking them both explicitly.
					case nodeConstants.EAGAIN:
					case nodeConstants.EWOULDBLOCK:
						// Nothing went wrong.
						// These are expected when failing to obtain a lock.
						maybeErrNo = 0;
						break;
					case nodeConstants.EBADF:
						maybeErrNo = em_EBADF;
						break;
					default:
						// We have to map errno's from flock() to those
						// expected from fcntl(), and there does not appear
						// to be a 1:1 mapping. Let's default to an
						// "invalid operation" error when in doubt.
						maybeErrNo = em_EINVAL;
						break;
				}
				return [false, maybeErrNo]
			} finally {
				if (shouldUnlock) {
					fsExt.flockSync(fd, LOCK_UN_NB);
				}
			}
		}
		function canWriteLock(fd) {
			return canLock(fd, LOCK_EX_NB)
		}
		function canReadLock(fd) {
			return canLock(fd, LOCK_SH_NB)
		}

		switch (cmd) {
			// TODO: Explain the weirdness of the GETLK output param
			case {{{ cDefs.F_GETLK }}}: {
				var typeOffset = {{{ C_STRUCTS.flock.l_type }}};
				var typeToCheck =
					{{{ makeGetValue('arg', 'typeOffset', 'i16') }}};
				var responseLockType = em_F_UNLCK;
				var responseErrNo;
				try {
					if (typeToCheck === em_F_RDLCK) {
						const [canLock, errno] = canReadLock(fd);
						if (errno) {
							// TODO: Set global errno
							return -1;
						}
						responseLockType = canLock ? em_F_UNLCK : em_F_WRLCK;
					} else if (
						typeToCheck === em_F_WRLCK ||
						typeToCheck === em_F_UNLCK
					) {
						let [canLock, errno] = canWriteLock(fd);
						if (errno) {
							// TODO: Set global errno
							return -1;
						}
						if (canLock) {
							// We can write lock, so there are no other locks.
							responseLockType = em_F_UNLCK;
						} else {
							// We cannot obtain a write lock.
							// This may be due to a write lock or a shared lock.
							// If we can obtain a shared lock,
							// then there is currently no write lock.

							// TODO
						}
					} else {
						throw new Error(`Invalid lock type: ${typeToCheck}`);
					}

					// TODO: Set field of flock struct
					return 0;
				} catch (e) {
					// TODO: errno = em_EINVAL;
					return -1;
				}
			}
			case {{{ cDefs.F_SETLK }}}:
			case {{{ cDefs.F_SETLKW }}}:
				// TODO: Actually set lock
				var arg = syscallGetVarargP();
				var offset = {{{ C_STRUCTS.flock.l_type }}};
				// We're always unlocked.
				var type = {{{ makeGetValue('arg', 'offset', 'i16') }}};
				fcntlSync(fd, )
				return 0; // Pretend that the locking is successful.
			default:
				return _default__syscall_fcntl64(fd, cmd, varargs);
		}
	}
};

autoAddDeps(LibraryForNode, 'default__syscall_fcntl64');
autoAddDeps(LibraryForNode, '__syscall_fcntl64');
mergeInto(LibraryManager.library, LibraryForNode);
