/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php_<major>_<minor>.js" files and implements JavaScript functions
 * that can be called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

const LibraryExample = {
	// Emscripten dependencies:
	$PHPWASM__deps: ['$allocateUTF8OnStack'],
	$PHPWASM__postset: 'PHPWASM.init();',

	// Functions not exposed to C but available in the generated
	// JavaScript library under the PHPWASM object:
	$PHPWASM: {
		/**
		 * @see fcntl.c:
		 * https://github.com/torvalds/linux/blob/a79a588fc1761dc12a3064fc2f648ae66cea3c5a/fs/fcntl.c#L37
		 */
		O_APPEND: Number('{{{cDefs.O_APPEND}}}'),
		O_NONBLOCK: Number('{{{cDefs.O_NONBLOCK}}}'),
		POLLHUP: Number('{{{cDefs.POLLHUP}}}'),
		SETFL_MASK:
			Number('{{{cDefs.O_APPEND}}}') | Number('{{{cDefs.O_NONBLOCK}}}'),
		// These macros are not defined in Emscripten at the time of writing:
		// emscripten_O_NDELAY |
		// emscripten_O_DIRECT |
		// emscripten_O_NOATIME
		init: function () {
			// TODO: Move this to a library function that is made an onInit callback by the `__postset` suffix.
			if (PHPLoader.bindUserSpace) {
				/**
				 * We need to add an onInit callback to bind the user-space API
				 * because some dependencies like wasmImports and wasmExports
				 * are not yet assigned.
				 */
				addOnInit(() => {
					if (typeof PHPLoader.processId !== 'number') {
						throw new Error(
							'PHPLoader.processId must be set before init'
						);
					}
					Module['userSpace'] = PHPLoader.bindUserSpace({
						pid: PHPLoader.processId,
						constants: {
							F_GETFL: Number('{{{cDefs.F_GETFL}}}'),
							O_ACCMODE: Number('{{{cDefs.O_ACCMODE}}}'),
							O_RDONLY: Number('{{{cDefs.O_RDONLY}}}'),
							O_WRONLY: Number('{{{cDefs.O_WRONLY}}}'),
							O_APPEND: Number('{{{cDefs.O_APPEND}}}'),
							O_NONBLOCK: Number('{{{cDefs.O_NONBLOCK}}}'),
							F_SETFL: Number('{{{cDefs.F_SETFL}}}'),
							F_GETLK: Number('{{{cDefs.F_GETLK}}}'),
							F_SETLK: Number('{{{cDefs.F_SETLK}}}'),
							F_SETLKW: Number('{{{cDefs.F_SETLKW}}}'),
							SEEK_SET: Number('{{{cDefs.SEEK_SET}}}'),
							SEEK_CUR: Number('{{{cDefs.SEEK_CUR}}}'),
							SEEK_END: Number('{{{cDefs.SEEK_END}}}'),
							F_GETFL: Number('{{{cDefs.F_GETFL}}}'),
							O_ACCMODE: Number('{{{cDefs.O_ACCMODE}}}'),
							O_RDONLY: Number('{{{cDefs.O_RDONLY}}}'),
							O_WRONLY: Number('{{{cDefs.O_WRONLY}}}'),
							O_APPEND: Number('{{{cDefs.O_APPEND}}}'),
							O_NONBLOCK: Number('{{{cDefs.O_NONBLOCK}}}'),
							F_SETFL: Number('{{{cDefs.F_SETFL}}}'),
							F_GETLK: Number('{{{cDefs.F_GETLK}}}'),
							F_SETLK: Number('{{{cDefs.F_SETLK}}}'),
							F_SETLKW: Number('{{{cDefs.F_SETLKW}}}'),
							SEEK_SET: Number('{{{cDefs.SEEK_SET}}}'),
							SEEK_CUR: Number('{{{cDefs.SEEK_CUR}}}'),
							SEEK_END: Number('{{{cDefs.SEEK_END}}}'),
							// From:
							// https://github.com/emscripten-core/emscripten/blob/66d2137b0381ac35f7e2346b2d6a90abd0f1211a/system/lib/libc/musl/include/fcntl.h#L58-L60
							F_RDLCK: 0,
							F_WRLCK: 1,
							F_UNLCK: 2,
							// From:
							// https://github.com/emscripten-core/emscripten/blob/81bbaa42a7827d88a71bd89701245052c622428c/system/lib/libc/musl/include/sys/file.h#L7-L10
							LOCK_SH: 1,
							LOCK_EX: 2,
							LOCK_NB: 4, // Non-blocking lock
							LOCK_UN: 8, // Unlock
						},
						errnoCodes: ERRNO_CODES,
						// Use get/set closures instead of exposing
						// typed arrays directly. After memory.grow(),
						// Emscripten's updateMemoryViews() reassigns
						// the module-scoped HEAP* variables. Closures
						// always reference the current value, so
						// accesses are never stale. The get/set
						// interface also prevents callers from
						// capturing a typed array reference that
						// could become stale.
						memory: {
							HEAP8: {
								get(offset) { return HEAP8[offset]; },
								set(offset, value) { HEAP8[offset] = value; },
							},
							HEAPU8: {
								get(offset) { return HEAPU8[offset]; },
								set(offset, value) { HEAPU8[offset] = value; },
							},
							HEAP16: {
								get(offset) { return HEAP16[offset]; },
								set(offset, value) { HEAP16[offset] = value; },
							},
							HEAPU16: {
								get(offset) { return HEAPU16[offset]; },
								set(offset, value) { HEAPU16[offset] = value; },
							},
							HEAP32: {
								get(offset) { return HEAP32[offset]; },
								set(offset, value) { HEAP32[offset] = value; },
							},
							HEAPU32: {
								get(offset) { return HEAPU32[offset]; },
								set(offset, value) { HEAPU32[offset] = value; },
							},
							HEAPF32: {
								get(offset) { return HEAPF32[offset]; },
								set(offset, value) { HEAPF32[offset] = value; },
							},
							HEAP64: {
								get(offset) { return HEAP64[offset]; },
								set(offset, value) { HEAP64[offset] = value; },
							},
							HEAPU64: {
								get(offset) { return HEAPU64[offset]; },
								set(offset, value) { HEAPU64[offset] = value; },
							},
							HEAPF64: {
								get(offset) { return HEAPF64[offset]; },
								set(offset, value) { HEAPF64[offset] = value; },
							},
						},
						wasmImports,
						wasmExports,
						syscalls: SYSCALLS,
						FS,
						PROXYFS,
						NODEFS,
					});
				});
			}

			Module['ENV'] = Module['ENV'] || {};
			// Ensure a platform-level bin directory for a fallback `php` binary.
			Module['ENV']['PATH'] = [
				Module['ENV']['PATH'],
				'/internal/shared/bin',
			]
				.filter(Boolean)
				.join(':');

			// The /request directory is required by the C module. It's where the
			// stdout, stderr, and headers information are written for the JavaScript
			// code to read later on. This is per-request state that is isolated to a
			// single PHP process.
			FS.mkdir('/request');
			// The /internal directory is shared amongst all PHP processes
			// and contains the php.ini, constants definitions, etc.
			FS.mkdir('/internal');

			if (PHPLoader.nativeInternalDirPath) {
				FS.mount(
					FS.filesystems.NODEFS,
					{ root: PHPLoader.nativeInternalDirPath },
					'/internal'
				);
			}

			// The files from the shared directory are shared between all the
			// PHP processes managed by PHPProcessManager.
			FS.mkdirTree('/internal/shared');

			// The files from the preload directory are preloaded using the
			// auto_prepend_file php.ini directive.
			FS.mkdirTree('/internal/shared/preload');
			// Platform-level bin directory for a fallback `php` binary. Without it,
			// PHP may not populate the PHP_BINARY constant.
			FS.mkdirTree('/internal/shared/bin');
			const originalOnRuntimeInitialized = Module['onRuntimeInitialized'];
			Module['onRuntimeInitialized'] = () => {
				const { node: phpBinaryNode } = FS.lookupPath(
					'/internal/shared/bin/php',
					{ noent_okay: true },
				);
				if (!phpBinaryNode) {
					// Dummy PHP binary for PHP to populate the PHP_BINARY constant.
					FS.writeFile(
						'/internal/shared/bin/php',
						new TextEncoder().encode('#!/bin/sh\nphp "$@"')
					);
					// It must be executable to be used by PHP.
					FS.chmod('/internal/shared/bin/php', 0o755);
				}
				originalOnRuntimeInitialized();
			};

			// Create stdout and stderr devices. We can't just use Emscripten's
			// default stdout and stderr devices because they stop processing data
			// on the first null byte. However, when dealing with binary data,
			// null bytes are valid and common.
			FS.registerDevice(FS.makedev(64, 0), {
				open: () => {},
				close: () => {},
				read: () => 0,
				write: (stream, buffer, offset, length, pos) => {
					const chunk = buffer.subarray(offset, offset + length);
					PHPWASM.onStdout(chunk);
					return length;
				},
			});
			FS.mkdev('/request/stdout', FS.makedev(64, 0));

			FS.registerDevice(FS.makedev(63, 0), {
				open: () => {},
				close: () => {},
				read: () => 0,
				write: (stream, buffer, offset, length, pos) => {
					const chunk = buffer.subarray(offset, offset + length);
					PHPWASM.onStderr(chunk);
					return length;
				},
			});
			FS.mkdev('/request/stderr', FS.makedev(63, 0));

			FS.registerDevice(FS.makedev(62, 0), {
				open: () => {},
				close: () => {},
				read: () => 0,
				write: (stream, buffer, offset, length, pos) => {
					const chunk = buffer.subarray(offset, offset + length);
					PHPWASM.onHeaders(chunk);
					return length;
				},
			});
			FS.mkdev('/request/headers', FS.makedev(62, 0));

			// Handle events.
			PHPWASM.EventEmitter = ENVIRONMENT_IS_NODE
				? require('events').EventEmitter
				: class EventEmitter {
						constructor() {
							this.listeners = {};
						}
						emit(eventName, data) {
							if (this.listeners[eventName]) {
								this.listeners[eventName].forEach(
									(callback) => {
										callback(data);
									}
								);
							}
						}
						once(eventName, callback) {
							const self = this;
							function removedCallback() {
								callback(...arguments);
								self.removeListener(eventName, removedCallback);
							}
							this.on(eventName, removedCallback);
						}
						removeAllListeners(eventName) {
							if (eventName) {
								delete this.listeners[eventName];
							} else {
								this.listeners = {};
							}
						}
						removeListener(eventName, callback) {
							if (this.listeners[eventName]) {
								const idx =
									this.listeners[eventName].indexOf(callback);
								if (idx !== -1) {
									this.listeners[eventName].splice(idx, 1);
								}
							}
						}
				  };

			PHPWASM.processTable = {};

			PHPWASM.input_devices = {};
			const originalWrite = TTY.stream_ops.write;
			TTY.stream_ops.write = function (stream, ...rest) {
				const retval = originalWrite(stream, ...rest);
				// Implicit flush since PHP's fflush() doesn't seem to trigger the fsync event
				// @TODO: Fix this at the wasm level
				stream.tty.ops.fsync(stream.tty);
				return retval;
			};
			const originalPutChar = TTY.stream_ops.put_char;
			TTY.stream_ops.put_char = function (tty, val) {
				/**
				 * Buffer newlines that Emscripten normally ignores.
				 *
				 * Emscripten doesn't do it by default because its default
				 * print function is console.log that implicitly adds a newline. We are overwriting
				 * it with an environment-specific function that outputs exaclty what it was given,
				 * e.g. in Node.js it's process.stdout.write(). Therefore, we need to mak sure
				 * all the newlines make it to the output buffer.
				 */
				if (val === 10) tty.output.push(val);
				return originalPutChar(tty, val);
			};
		},

		// Default output stream handlers.
		// @TODO Consider using Emscripten's default print and printErr instead.
		onHeaders: function (chunk) {
			if (Module['onHeaders']) {
				Module['onHeaders'](chunk);
				return;
			}
			console.log('headers', { chunk });
		},

		onStdout: function (chunk) {
			if (Module['onStdout']) {
				Module['onStdout'](chunk);
				return;
			}
			if (ENVIRONMENT_IS_NODE) {
				process.stdout.write(chunk);
			} else {
				console.log('stdout', { chunk });
			}
		},

		onStderr: function (chunk) {
			if (Module['onStderr']) {
				Module['onStderr'](chunk);
				return;
			}
			if (ENVIRONMENT_IS_NODE) {
				process.stderr.write(chunk);
			} else {
				console.warn('stderr', { chunk });
			}
		},

		/**
		 * A utility function to get all websocket objects associated
		 * with an Emscripten file descriptor.
		 *
		 * @param {int} socketd Socket descriptor
		 * @returns WebSocket[]
		 */
		getAllWebSockets: function (sock) {
			const webSockets = /* @__PURE__ */ new Set();
			if (sock.server) {
				sock.server.clients.forEach((ws) => {
					webSockets.add(ws);
				});
			}
			for (const peer of PHPWASM.getAllPeers(sock)) {
				webSockets.add(peer.socket);
			}
			return Array.from(webSockets);
		},

		/**
		 * A utility function to get all Emscripten Peer objects
		 * associated with a given Emscripten file descriptor.
		 *
		 * @param {int} socketd Socket descriptor
		 * @returns WebSocket[]
		 */
		getAllPeers: function (sock) {
			const peers = new Set();
			if (sock.server) {
				sock.pending
					.filter((pending) => pending.peers)
					.forEach((pending) => {
						for (const peer of Object.values(pending.peers)) {
							peers.add(peer);
						}
					});
			}
			if (sock.peers) {
				for (const peer of Object.values(sock.peers)) {
					peers.add(peer);
				}
			}
			return Array.from(peers);
		},

		/**
		 * Waits for inbound data on a websocket.
		 *
		 * @param {WebSocket} ws Websocket object
		 * @returns {[Promise, function]} A promise and a function to cancel the promise
		 */
		awaitData: function (ws) {
			return PHPWASM.awaitEvent(ws, 'message');
		},

		/**
		 * Waits for opening a websocket connection.
		 *
		 * @param {WebSocket} ws Websocket object
		 * @returns {[Promise, function]} A promise and a function to cancel the promise
		 */
		awaitConnection: function (ws) {
			if (ws.OPEN === ws.readyState) {
				return [Promise.resolve(), PHPWASM.noop];
			}
			return PHPWASM.awaitEvent(ws, 'open');
		},

		/**
		 * Waits for closing a websocket connection.
		 *
		 * @param {WebSocket} ws Websocket object
		 * @returns {[Promise, function]} A promise and a function to cancel the promise
		 */
		awaitClose: function (ws) {
			if ([ws.CLOSING, ws.CLOSED].includes(ws.readyState)) {
				return [Promise.resolve(), PHPWASM.noop];
			}
			return PHPWASM.awaitEvent(ws, 'close');
		},

		/**
		 * Waits for an error on a websocket connection.
		 *
		 * @param {WebSocket} ws Websocket object
		 * @returns {[Promise, function]} A promise and a function to cancel the promise
		 */
		awaitError: function (ws) {
			if ([ws.CLOSING, ws.CLOSED].includes(ws.readyState)) {
				return [Promise.resolve(), PHPWASM.noop];
			}
			return PHPWASM.awaitEvent(ws, 'error');
		},

		/**
		 * Waits for an event.
		 *
		 * @param {EventEmitter} emitter Event emitter object
		 * @param {string} event The event to wait for.
		 * @returns {[Promise, function]} A promise and a function to cancel the promise
		 */
		awaitEvent: function (ws, event) {
			let resolve;
			const listener = () => {
				resolve();
			};
			const promise = new Promise(function (_resolve) {
				resolve = _resolve;
				ws.once(event, listener);
			});
			const cancel = () => {
				ws.removeListener(event, listener);
				// Rejecting the promises bubbles up and kills the entire
				// node process. Let's resolve them on the next tick instead
				// to give the caller some space to unbind any handlers.
				setTimeout(resolve);
			};
			return [promise, cancel];
		},
		noop: function () {},

		spawnProcess: function (command, args, options) {
			if (Module['spawnProcess']) {
				const spawned = Module['spawnProcess'](
					command,
					args,
					/**
					 * We're providing the same extra options we would pass to child_process.spawn().
					 * 
					 * Why?
					 * 
					 * spawnProcess() follows the same interface as child_process.spawn()
					 * and some consumers pass `child_process.spawn` directly to php.setSpawnHandler()
					 */
					{
						...options,
						shell: true,
						stdio: ['pipe', 'pipe', 'pipe'],
					}
				);
				if (spawned && !('then' in spawned) && 'on' in spawned) {
					/**
					 * If we get the child process directly, return it immediately.
					 * Delaying it to the next tick via Promise.resolve() would create
					 * a race condition where it might emit some events before the
					 * caller has a chance to bind event listeners to them.
					 * 
					 * Without this condition, this callback would be at least flaky:
					 *
					 *    php.setSpawnHandler(require('child_process').spawn);
					 */
					return spawned;
				}
				return Promise.resolve(spawned).then(function (spawned) {
					if (!spawned || !spawned.on) {
						throw new Error(
							'spawnProcess() must return an EventEmitter but returned a different type.'
						);
					}
					return spawned;
				});
			}

			const e = new Error(
				'popen(), proc_open() etc. are unsupported on this PHP instance. Call php.setSpawnHandler() ' +
					'and provide a callback to handle spawning processes, or disable a popen(), proc_open() ' +
					'and similar functions via php.ini.'
			);
			e.code = 'SPAWN_UNSUPPORTED';
			throw e;
		},

		/**
		 * Shims unix shutdown(2) functionality for asynchronous sockets:
		 * https://man7.org/linux/man-pages/man2/shutdown.2.html
		 *
		 * Does not support SHUT_RD or SHUT_WR.
		 *
		 * @param {int} socketd
		 * @param {int} how
		 * @returns 0 on success, -1 on failure
		 */
		shutdownSocket: function (socketd, how) {
			// This implementation only supports websockets at the moment
			const sock = getSocketFromFD(socketd);
			const peer = Object.values(sock.peers)[0];

			if (!peer) {
				return -1;
			}

			try {
				peer.socket.close();
				SOCKFS.websocket_sock_ops.removePeer(sock, peer);
				return 0;
			} catch (e) {
				console.log('Socket shutdown error', e);
				return -1;
			}
		},
	},

	/**
	 * Enables the C code to spawn a Node.js child process for the
	 * purposes of PHP's proc_open() function.
	 *
	 * @param {int} command Command to execute (string pointer).
	 * @param {int} argsPtr Arguments linked with command (string array pointer).
	 * @param {int} argsLength Number of arguments.
	 * @param {int} descriptorsPtr Descriptor specs (int array pointer, [ number, child, parent ] ).
	 * @param {int} descriptorsLength Number of descriptors.
	 * @returns {int} 0 on success, 1 on failure.
	 */
	js_open_process: function (
		command,
		argsPtr,
		argsLength,
		descriptorsPtr,
		descriptorsLength,
		cwdPtr,
		cwdLength,
		envPtr,
		envLength
	) {
		if (!command) {
			___errno_location(ERRNO_CODES.EINVAL);
			return -1;
		}

		const cmdstr = UTF8ToString(command);
		if (!cmdstr.length) {
			___errno_location(ERRNO_CODES.EINVAL);
			return -1;
		}

		let argsArray = [];
		if (argsLength) {
			for (var i = 0; i < argsLength; i++) {
				const charPointer = argsPtr + i * 4;
				argsArray.push(UTF8ToString(HEAPU32[charPointer >> 2]));
			}
		}

		const cwdstr = cwdPtr ? UTF8ToString(cwdPtr) : FS.cwd();
		let envObject = null;

		if (envLength) {
			envObject = {};
			for (var i = 0; i < envLength; i++) {
				const envPointer = envPtr + i * 4;
				const envEntry = UTF8ToString(HEAPU32[envPointer >> 2]);
				const splitAt = envEntry.indexOf('=');
				if (splitAt === -1) {
					continue;
				}
				const key = envEntry.substring(0, splitAt);
				const value = envEntry.substring(splitAt + 1);
				envObject[key] = value;
			}
		}

		var std = {};
		// Extracts an array of available descriptors that should be dispatched to streams.
		// On the C side, the descriptors are expressed as `**int` so we must go read
		// each of the `descriptorsLength` `*int` pointers and convert the associated data into
		// a JavaScript object { descriptor : { child : fd, parent : fd } }.
		for (var i = 0; i < descriptorsLength; i++) {
			const descriptorPtr = HEAPU32[(descriptorsPtr + i * 4) >> 2];
			std[HEAPU32[descriptorPtr >> 2]] = {
				child: HEAPU32[(descriptorPtr + 4) >> 2],
				parent: HEAPU32[(descriptorPtr + 8) >> 2],
			};
			// swap parent and child descs until we rebuild PHP 7.4
			if (i === 0) {
				HEAPU32[(descriptorPtr + 8) >> 2] = std[HEAPU32[descriptorPtr >> 2]].parent;
				HEAPU32[(descriptorPtr + 4) >> 2] = std[HEAPU32[descriptorPtr >> 2]].child;
			}
		}

		return Asyncify.handleAsync(async () => {
			let cp;
			try {
				const options = {};
				if (cwdstr !== null) {
					options.cwd = cwdstr;
				}
				if (envObject !== null) {
					options.env = envObject;
				}
				cp = PHPWASM.spawnProcess(cmdstr, argsArray, options);
				if (cp instanceof Promise) {
					cp = await cp;
				}
			} catch (e) {
				if (e.code === 'SPAWN_UNSUPPORTED') {
					___errno_location(ERRNO_CODES.ENOSYS);
					return -1;
				}
				if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
				___errno_location(e.code);
				return -1;
			}

			const ProcInfo = {
				pid: cp.pid,
				exited: false
			};
			PHPWASM.processTable[ProcInfo.pid] = ProcInfo;

			const stdinParentFd = std[0]?.parent,
				stdinChildFd = std[0]?.child,
				stdoutChildFd = std[1]?.child,
				stdoutParentFd = std[1]?.parent,
				stderrChildFd = std[2]?.child,
				stderrParentFd = std[2]?.parent;

			cp.on('exit', function (code) {
				for (const fd of [
					// The child process exited. Let's clean up its output streams:
					stdoutChildFd,
					stderrChildFd,
					stdinChildFd,

					// We won't close these because the PHP already handles that in the parent process:
					// stdoutParentFd,
					// stderrParentFd,
					// stdinParentFd,
				]) {
					if (FS.streams[fd] && !FS.isClosed(FS.streams[fd])) {
						FS.close(FS.streams[fd]);
					}
				}

				ProcInfo.exitCode = code;
				ProcInfo.exited = true;
			});

			// Pass data from child process's stdout to PHP's end of the stdout pipe.
			if (stdoutChildFd) {
				const stdoutStream = SYSCALLS.getStreamFromFD(
					stdoutChildFd
				);
				let stdoutAt = 0;
				cp.stdout.on('data', function (data) {
					stdoutStream.stream_ops.write(
						stdoutStream,
						data,
						0,
						data.length,
						stdoutAt
					);
					stdoutAt += data.length;
				});
			}

			// Pass data from child process's stderr to PHP's end of the stdout pipe.
			if (stderrChildFd) {
				const stderrStream = SYSCALLS.getStreamFromFD(
					stderrChildFd
				);
				let stderrAt = 0;
				cp.stderr.on('data', function (data) {
					stderrStream.stream_ops.write(
						stderrStream,
						data,
						0,
						data.length,
						stderrAt
					);
					stderrAt += data.length;
				});
			}

			/**
			 * Wait until the child process has been spawned.
			 * Unfortunately there is no Node.js API to check whether
			 * the process has already been spawned. We can only listen
			 * to the 'spawn' event and if it has already been spawned,
			 * listen to the 'exit' event.
			 */
			try {
				await new Promise((resolve, reject) => {
					/**
					 * There was no `await` between the `spawnProcess` call
					 * and the `await` below so the process haven't had a chance
					 * to run any of the exit-related callbacks yet.
					 *
					 * Good.
					 *
					 * Let's listen to all the lifecycle events and resolve
					 * the promise when the process starts or immediately crashes.
					 */
					let resolved = false;
					cp.on('spawn', () => {
						if (resolved) return;
						resolved = true;
						resolve();
					});
					cp.on('error', (e) => {
						if (resolved) return;
						resolved = true;
						reject(e);
					});
					cp.on('exit', function (code) {
						if (resolved) return;
						resolved = true;
						if (code === 0) {
							resolve();
						} else {
							reject(
								new Error(`Process exited with code ${code}`)
							);
						}
					});
					/**
					 * If the process haven't even started after 5 seconds, something
					 * is wrong. Perhaps we're missing an event listener, or perhaps
					 * the `spawnProcess` implementation failed to dispatch the relevant
					 * event. Either way, let's crash to avoid blocking the proc_open()
					 * call indefinitely.
					 */
					setTimeout(() => {
						if (resolved) return;
						resolved = true;
						reject(new Error('Process timed out'));
					}, 5000);
				});
			} catch (e) {
				// Process already started. Even if it exited early, PHP still
				// needs to know about the pid and clean up the resources.
				console.error(e);
				return ProcInfo.pid;
			}

			// Now we want to pass data from the STDIN source supplied by PHP
			// to the child process.
			if (stdinChildFd) {
				// We're in a kernel function used instead of fork().
				//
				// We are the ones responsible for pumping the data from the stdinChildFd
				// into the child process. There is no concurrent task operating on the
				// piped data or polling the file descriptors, etc. Nothing will ever
				// read from the stdinChildFd if we don't do it here.
				//
				// Well, let's do it! We'll periodically read from the child end of the
				// data pipe and push what we get into the child process.
				let stdinStream;
				try {
					stdinStream = SYSCALLS.getStreamFromFD(stdinChildFd);
				} catch (e) {
					___errno_location(ERRNO_CODES.EBADF);
					return ProcInfo.pid;
				}
				if (!stdinStream?.node) {
					return ProcInfo.pid;
				}

				// Pipe the entire stdinStream to cp.stdin
				const CHUNK_SIZE = 1024;

				const iov = _malloc(16); // Space for iovec structure
				const pnum = _malloc(4); // Space for number of bytes read
				const buffer = _malloc(CHUNK_SIZE);

				// Set up iovec structure pointing to our buffer
				HEAPU32[iov >> 2] = buffer; // iov_base
				HEAPU32[(iov + 4) >> 2] = CHUNK_SIZE; // iov_len

				function pump() {
					try {
						while (true) {
							if (cp.killed) {
								stopPumpingAndCloseStdin();
								return;
							}

							const result = js_fd_read(
								stdinChildFd,
								iov,
								1,
								pnum,
								false
							);
							const bytesRead = HEAPU32[pnum >> 2];
							if (result === 0 && bytesRead > 0) {
								const wrote = HEAPU8.subarray(
									buffer,
									buffer + bytesRead
								);
								cp.stdin.write(wrote);
								// We've read some data. Let the next iteration decide
								// how to break out of the loop.
							} else if (result === 0 && bytesRead === 0) {
								// result === 0 and bytesRead === 0 means the file descriptor
								// is at EOF. Let's close the stdin stream and clean up.
								stopPumpingAndCloseStdin();
								break;
							} else if (result === ERRNO_CODES.EAGAIN) {
								// The file descriptor is not ready for reading.
								// Let's break out of the loop. setInterval will invoke
								// this function again soon.
								break;
							} else {
								throw new FS.ErrnoError(result);
							}
						}
					} catch (e) {
						if (
							typeof FS == 'undefined' ||
							!(e.name === 'ErrnoError')
						) {
							throw e;
						}
						___errno_location(e.errno);
						stopPumpingAndCloseStdin();
					}
				};
				function stopPumpingAndCloseStdin() {
					clearInterval(interval);
					if (!cp.stdin.closed) {
						cp.stdin.end();
					}
					_free(buffer);
					_free(iov);
					_free(pnum);
				}

				// pump() can never alter the result of this function.
				// Even when it fails, we still return the pid.
				// Why?
				// Because the process already started. We wouldn't backtrack
				// with fork(), we won't backtrack here. Let's give PHP the pid,
				// and let it think it's the parent process. It will clean up the
				// resources as needed.

				// stdin may be non-blocking – let's check for updates periodically.
				// If we exhaust it at any point, pump() will self-terminate.
				//
				// Note handling any failures, closing the descriptor, etc. will not
				// happen synchronously when PHP calls fclose($pipes[0]) or proc_close().
				// It will all happen asynchronously on the next tick. It seems off,
				// but there doesn't seem to be a better way: cp.stdin.write() and
				// cp.stdin.end() are both async APIs and they both accept onCompleted
				// callbacks.
				const interval = setInterval(pump, 20);
				pump();
			}

			return ProcInfo.pid;
		});
	},

	js_process_status: function (pid, exitCodePtr) {
		if (!PHPWASM.processTable[pid]) {
			return -1;
		}
		if (PHPWASM.processTable[pid].exited) {
			HEAPU32[exitCodePtr >> 2] = PHPWASM.processTable[pid].exitCode;
			return 1;
		}
		return 0;
	},

	js_waitpid: function (pid, exitCodePtr) {
		if (!PHPWASM.processTable[pid]) {
			return -1;
		}
		return Asyncify.handleSleep((wakeUp) => {
			const poll = function () {
				if (PHPWASM.processTable[pid]?.exited) {
					HEAPU32[exitCodePtr >> 2] =
						PHPWASM.processTable[pid].exitCode;
					wakeUp(pid);
				} else {
					setTimeout(poll, 50);
				}
			};
			poll();
		});
	},

	/**
	 * Shims unix shutdown(2) functionality for asynchronous:
	 * https://man7.org/linux/man-pages/man2/shutdown.2.html
	 *
	 * Does not support SHUT_RD or SHUT_WR.
	 *
	 * @param {int} socketd
	 * @param {int} how
	 * @returns 0 on success, -1 on failure
	 */
	wasm_shutdown: function (socketd, how) {
		return PHPWASM.shutdownSocket(socketd, how);
	},

	/**
	 * Shims unix close(2) functionality for asynchronous:
	 * https://man7.org/linux/man-pages/man2/close.2.html
	 *
	 * @param {int} socketd
	 * @returns 0 on success, -1 on failure
	 */
	wasm_close: function (socketd) {
		return PHPWASM.shutdownSocket(socketd, 2);
	},

	/**
	 * Shims recv(2) functionality for asynchronous websockets:
	 * https://man7.org/linux/man-pages/man2/recv.2.html
	 *
	 * @param {int} sockfd Socket descriptor
	 * @param {int} buffer Pointer to the stored message buffer
	 * @param {int} size The maximum bytes to receive
	 * @param {int} flags Flags to modify the behavior to recv call
	 * @returns {Promise} Resolved with the number of bytes recieved
	 */
	wasm_recv: function (sockfd, buffer, size, flags) {
		return Asyncify.handleSleep((wakeUp) => {
			const poll = function () {
				let newl = ___syscall_recvfrom(
					sockfd,
					buffer,
					size,
					flags,
					null,
					null
				);
				if (newl > 0) {
					wakeUp(newl);
				} else if (newl === -6) {
					setTimeout(poll, 20);
				} else {
					wakeUp(0);
				}
			};
			poll();
		});
	},

	/**
	 * Shims setsockopt(2) functionality for asynchronous websockets:
	 * https://man7.org/linux/man-pages/man2/setsockopt.2.html
	 * The only supported options are SO_KEEPALIVE and TCP_NODELAY.
	 *
	 * Technically these options are propagated to the WebSockets proxy
	 * server which then sets them on the underlying TCP connection.
	 *
	 * @param {int} socketd Socket descriptor
	 * @param {int} level  Level at which the option is defined
	 * @param {int} optionName The option name
	 * @param {int} optionValuePtr Pointer to the option value
	 * @param {int} optionLen The length of the option value
	 * @returns {int} 0 on success, -1 on failure
	 */
	wasm_setsockopt: function (
		socketd,
		level,
		optionName,
		optionValuePtr,
		optionLen
	) {
		const optionValue = HEAPU8[optionValuePtr];
		const SOL_SOCKET = 1;
		const SO_KEEPALIVE = 9;
		const SO_RCVTIMEO = 66;
		const SO_SNDTIMEO = 67;
		const IPPROTO_TCP = 6;
		const TCP_NODELAY = 1;

		// Options that we can forward to the WebSocket proxy
		const isForwardable =
			(level === SOL_SOCKET && optionName === SO_KEEPALIVE) ||
			(level === IPPROTO_TCP && optionName === TCP_NODELAY);

		// Options that we acknowledge but don't actually implement
		// (WebSocket connections handle timeouts differently)
		const isIgnorable =
			level === SOL_SOCKET &&
			(optionName === SO_RCVTIMEO || optionName === SO_SNDTIMEO);

		if (!isForwardable && !isIgnorable) {
			console.warn(
				`Unsupported socket option: ${level}, ${optionName}, ${optionValue}`
			);
			return -1;
		}

		// For ignorable options, just return success
		if (isIgnorable) {
			return 0;
		}

		const ws = PHPWASM.getAllWebSockets(socketd)[0];
		if (!ws) {
			return -1;
		}
		ws.setSocketOpt(level, optionName, optionValuePtr);
		return 0;
	},

	/**
	 * Alias for wasm_recv to support dynamically loaded extensions like memcached
	 * that import `recv` by its POSIX name instead of the WASM-specific name.
	 *
	 * This allows extensions compiled without the -Drecv=wasm_recv flag to still
	 * benefit from the async-aware implementation.
	 */
	recv: function (sockfd, buffer, size, flags) {
		return _wasm_recv(sockfd, buffer, size, flags);
	},
	recv__deps: ['wasm_recv'],

	/**
	 * Alias for wasm_setsockopt to support dynamically loaded extensions like memcached
	 * that import `setsockopt` by its POSIX name instead of the WASM-specific name.
	 */
	setsockopt: function (socketd, level, optionName, optionValuePtr, optionLen) {
		return _wasm_setsockopt(socketd, level, optionName, optionValuePtr, optionLen);
	},
	setsockopt__deps: ['wasm_setsockopt'],

	/**
	 * Async-aware connect(2) for WebSocket-based sockets.
	 *
	 * The standard Emscripten connect() creates a WebSocket but returns
	 * immediately before the connection is established. This wrapper
	 * performs the connection and waits for the WebSocket to actually
	 * connect before returning.
	 *
	 * @param {int} sockfd Socket file descriptor
	 * @param {int} addr Pointer to sockaddr structure
	 * @param {int} addrlen Length of sockaddr structure
	 * @returns {int} 0 on success, negative errno on failure
	 */
	wasm_connect: function (sockfd, addr, addrlen) {
		/**
		 * Use a synchronous connect() call when Asyncify is used.
		 *
		 * The async version was originally introduced to support the Memcached and Redis extensions,
		 * and both are only available with JSPI. Asyncify is too difficult to maintain and
		 * it's not getting that upgrade.
		 */
		if (!("Suspending" in WebAssembly)) {
			var sock = getSocketFromFD(sockfd);
			var info = getSocketAddress(addr, addrlen);
			sock.sock_ops.connect(sock, info.addr, info.port);
			return 0;
		}
		return Asyncify.handleSleep((wakeUp) => {
			// Get the socket
			let sock;
			try {
				sock = getSocketFromFD(sockfd);
			} catch (e) {
				wakeUp(-ERRNO_CODES.EBADF);
				return;
			}

			if (!sock) {
				wakeUp(-ERRNO_CODES.EBADF);
				return;
			}

			// Parse the address
			let info;
			try {
				info = getSocketAddress(addr, addrlen);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) {
					wakeUp(-ERRNO_CODES.EFAULT);
					return;
				}
				wakeUp(-e.errno);
				return;
			}

			// Perform the connect (this creates the WebSocket but doesn't wait)
			try {
				sock.sock_ops.connect(sock, info.addr, info.port);
			} catch (e) {
				if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) {
					wakeUp(-ERRNO_CODES.ECONNREFUSED);
					return;
				}
				wakeUp(-e.errno);
				return;
			}

			// Get all websockets for this socket
			const webSockets = PHPWASM.getAllWebSockets(sock);
			if (!webSockets.length) {
				// No WebSocket yet, this shouldn't happen after connect
				wakeUp(-ERRNO_CODES.ECONNREFUSED);
				return;
			}

			const ws = webSockets[0];

			// If already connected, return success
			if (ws.readyState === ws.OPEN) {
				wakeUp(0);
				return;
			}

			// If already closed or closing, return error
			if (ws.readyState === ws.CLOSING || ws.readyState === ws.CLOSED) {
				wakeUp(-ERRNO_CODES.ECONNREFUSED);
				return;
			}

			// Wait for the connection to be established
			const timeout = 30000; // 30 second timeout
			let resolved = false;

			const timeoutId = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					wakeUp(-ERRNO_CODES.ETIMEDOUT);
				}
			}, timeout);

			const handleOpen = () => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					ws.removeEventListener('error', handleError);
					ws.removeEventListener('close', handleClose);
					wakeUp(0);
				}
			};

			const handleError = () => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					ws.removeEventListener('open', handleOpen);
					ws.removeEventListener('close', handleClose);
					wakeUp(-ERRNO_CODES.ECONNREFUSED);
				}
			};

			const handleClose = () => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					ws.removeEventListener('open', handleOpen);
					ws.removeEventListener('error', handleError);
					wakeUp(-ERRNO_CODES.ECONNREFUSED);
				}
			};

			ws.addEventListener('open', handleOpen);
			ws.addEventListener('error', handleError);
			ws.addEventListener('close', handleClose);
		});
	},
	wasm_connect__deps: ['$PHPWASM'],

	/**
	 * Override Emscripten's __syscall_connect to use our async-aware implementation.
	 * This ensures all connect() calls (from PHP core, extensions, and dynamic modules)
	 * properly wait for WebSocket connections to be established.
	 */
	__syscall_connect: function (sockfd, addr, addrlen, d1, d2, d3) {
		return _wasm_connect(sockfd, addr, addrlen);
	},
	__syscall_connect__deps: ['wasm_connect'],

	/**
	 * Returns the assigned process ID of the current process or 42 if not available.
	 *
	 * Emscripten's built-in getpid() always returns 42,
	 * but we will provide our assigned process ID if available.
	 * Using distinct IDs allows us to associate trace messages with their php-wasm process.
	 */
	js_getpid() {
		return PHPLoader.processId ?? 42;
	},

	/**
	 * Relays a trace message if a PHPLoader.trace function is provided.
	 *
	 * This is a printf-style API that supports:
	 * - Basic format specifiers: %s, %d, %f, %x, %%
	 * - Bigint integer values
	 *
	 * @param {string} format The format string
	 * @param {...any} args The arguments to the format string
	 */
	js_wasm_trace: function (format, ...args) {
		if (PHPLoader.trace instanceof Function) {
			PHPLoader.trace(_js_getpid(), format, ...args);
		}
	},
	js_wasm_trace__deps: ['js_getpid'],
};

autoAddDeps(LibraryExample, '$PHPWASM');
autoAddDeps(LibraryExample, 'js_wasm_trace');
mergeInto(LibraryManager.library, LibraryExample);
