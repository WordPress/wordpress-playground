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
#if ASYNCIFY == 2
		return Asyncify.handleAsync(async () => {
#endif
			return Module['userSpace'].fcntl64(fd, cmd, varargs);
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
			return Module['userSpace'].flock(fd, op);
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
			return Module['userSpace'].fd_close(fd);
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
			return Module['userSpace'].js_release_file_locks();
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
