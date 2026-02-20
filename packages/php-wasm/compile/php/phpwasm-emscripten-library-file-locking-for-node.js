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
 * This file used to contain many fragments similar to this one:
 *
 *     #if ASYNCIFY == 2
 *         return Asyncify.handleAsync(async () => {
 *     #endif
 *         // ..code..
 *     #if ASYNCIFY == 2
 *         });
 *     #endif
 *
 * This was a way of making syscalls synchronous with Asyncify (to support Node < 23) and asynchronous with JSPI (to support web browsers).
 * Making synchronous remote calls is cumbersome, but it is much easier than using and debugging Asyncify.
 *
 * Prior to making the remote fileLockManager calls synchronous, we were
 * seeing a crash in our fd_close() override in the Asyncify builds. It might be
 * because `fd_close` is treated differently as part of a set of WASI imports:
 * https://github.com/emscripten-core/emscripten/blob/08e031ce9d3194a56f684c73b1288a7916d7f543/tools/maint/gen_sig_info.py#L155
 *
 * Either way, we have not yet found a way to fix this issue for the asyncify builds,
 * so we opted to use synchronous remote calls instead.
 *
 * For the sake of simplicity with the injected wasmUserSpace syscall implementations,
 * both the JSPI and Asyncify builds use synchronous remote calls in this script.
 * As of today 2026-01-27, php-wasm/node workers in Playground CLI are single-threaded,
 * so there should be no harm in blocking the worker to service the one php-wasm instance.
 *
 * See comlink-sync.ts for more details.
 *
 * @see https://github.com/WordPress/wordpress-playground/pull/2317
 * @see https://github.com/WordPress/wordpress-playground/pull/3150
 * @see https://github.com/WordPress/wordpress-playground/blob/9a9262cc62cc161d220a9992706b9ed2817f2eb5/packages/docs/site/docs/developers/23-architecture/07-wasm-asyncify.md
 * @see https://github.com/adamziel/js-synchronous-messaging for additional ideas.
 */
'use strict';

const LibraryForFileLocking = {
	// Place the builtin fcntl64 implementation in an object so it is left
	// intact even if the function is not referenced by C/C++ code.
	// Ref: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#javascript-limits-in-library-files
	builtin_fcntl64__deps: LibraryManager.library.__syscall_fcntl64__deps,
	builtin_fcntl64: LibraryManager.library.__syscall_fcntl64,

	__syscall_fcntl64__deps: [
		...LibraryManager.library.__syscall_fcntl64__deps,
		'builtin_fcntl64',
	],
	__syscall_fcntl64__sig: LibraryManager.library.__syscall_fcntl64__sig,
	__syscall_fcntl64: function __syscall_fcntl64(fd, cmd, varargs) {
		if (typeof Module['userSpace'] === 'undefined') {
			return _builtin_fcntl64(fd, cmd, varargs);
		}
		return Module['userSpace'].fcntl64(fd, cmd, varargs);
	},

	/**
	 * Perform a flock() operation on the file descriptor.
	 *
	 * @param {number} fd - the file descriptor
	 * @param {number} op - the operation to perform
	 * @returns Zero on success, or a negative errno on failure.
	 */
	js_flock: function js_flock(fd, op) {
		if (typeof Module['userSpace'] === 'undefined') {
			// In the absence of a real locking facility,
			// return success by default as Emscripten does.
			return 0;
		}
		return Module['userSpace'].flock(fd, op);
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
		if (typeof Module['userSpace'] === 'undefined') {
			return _builtin_fd_close(fd);
		}
		return Module['userSpace'].fd_close(fd);
	},
	fd_close__deps: ['builtin_fd_close', 'js_wasm_trace'],

	/**
	 * Release all file locks for the current process.
	 *
	 * This function should be called at the end of each PHP request.
	 */
	js_release_file_locks: function js_release_file_locks() {
		if (typeof Module['userSpace'] === 'undefined') {
			return;
		}
		return Module['userSpace'].js_release_file_locks();
	},
};

autoAddDeps(LibraryForFileLocking, 'builtin_fcntl64');
autoAddDeps(LibraryForFileLocking, '__syscall_fcntl64');
autoAddDeps(LibraryForFileLocking, 'builtin_fd_close');
autoAddDeps(LibraryForFileLocking, 'fd_close');
mergeInto(LibraryManager.library, LibraryForFileLocking);
