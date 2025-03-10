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
		const em_EAGAIN = {{{ cDefs.EINVAL }}};

		const emFcntlToNodeFlockType = {
			[em_F_RDLCK]: 'shnb', // shared and non-blocking
			[em_F_WRLCK]: 'exnb', // exclusive and non-blocking
			[em_F_UNLCK]: 'un',   // unlock
		};

		switch (cmd) {
			case {{{ cDefs.F_GETLK }}}: {
				// TODO: Accurately represent locks obtained by this thread via F_SETLK
				var arg = syscallGetVarargP();
				var offset = {{{ C_STRUCTS.flock.l_type }}};
				// Always report that a file is unlocked.
				// TODO: Explain why both technically and philosophically
				{{{ makeSetValue('arg', 'offset', cDefs.F_UNLCK, 'i16') }}};
				return 0;
			}
			case {{{ cDefs.F_SETLK }}}:
			case {{{ cDefs.F_SETLKW }}}:
				var arg = syscallGetVarargP();
				var offset = {{{ C_STRUCTS.flock.l_type }}};
				var fcntlType = {{{ makeGetValue('arg', 'offset', 'i16') }}};
				var flockType = emFcntlToNodeFlockType[fcntlType];
				if (flockType === undefined) {
					wasm_set_errno(em_EINVAL);
					return -1;
				}
				try {
					flockSync(fd, flockType);
					return 0;
				} catch (e) {
					let em_errno;
					if (e.code === 'EBADF') {
						em_errno = em_EBADF;
					} else if (e.code === 'EAGAIN' || e.code === 'EWOULDBLOCK') {
						// EAGAIN and EWOULDBLOCK are almost always equivalent
						em_errno = em_EAGAIN;
					} else {
						em_errno = em_EINVAL; 
					}
					wasm_set_errno(em_errno);
					return -1;
				}
			default:
				return _default__syscall_fcntl64(fd, cmd, varargs);
		}
	}
};

autoAddDeps(LibraryForNode, 'default__syscall_fcntl64');
autoAddDeps(LibraryForNode, '__syscall_fcntl64');
mergeInto(LibraryManager.library, LibraryForNode);
