/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
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
		init: function () {
			// The /internal directory is required by the C module. It's where the
			// stdout, stderr, and headers information are written for the JavaScript
			// code to read later on.
			FS.mkdir("/internal");

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
			PHPWASM.child_proc_by_fd = {};
			PHPWASM.child_proc_by_pid = {};
			PHPWASM.input_devices = {};
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
		noop: function () { },

		spawnProcess: function (command, args, options) {
			if (Module['spawnProcess']) {
				const spawnedPromise = Module['spawnProcess'](command, args, options);
				return Promise.resolve(spawnedPromise).then(function (spawned) {
					if (!spawned || !spawned.on) {
						throw new Error(
							'spawnProcess() must return an EventEmitter but returned a different type.'
						);
					}
					return spawned;
				});
			}

			if (ENVIRONMENT_IS_NODE) {
				return require('child_process').spawn(command, args, {
					...options,
					shell: true,
					stdio: ['pipe', 'pipe', 'pipe'],
					timeout: 100,
				});
			}
			const e = new Error(
				'popen(), proc_open() etc. are unsupported in the browser. Call php.setSpawnHandler() ' +
				'and provide a callback to handle spawning processes, or disable a popen(), proc_open() ' +
				'and similar functions via php.ini.'
			);
			e.code = 'SPAWN_UNSUPPORTED';
			throw e;
		},

		/**
		 * Shims unix shutdown(2) functionallity for asynchronous sockets:
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
	 * Creates an emscripten input device for the purposes of PHP's
	 * proc_open() function.
	 *
	 * @param {int} deviceId
	 * @returns {int} The path of the input devicex (string pointer).
	 */
	js_create_input_device: function (deviceId) {
		let dataBuffer = [];
		let dataCallback;
		const filename = 'proc_id_' + deviceId;
		const device = FS.createDevice(
			'/dev',
			filename,
			function () { },
			function (byte) {
				try {
					dataBuffer.push(byte);
					if (dataCallback) {
						dataCallback(new Uint8Array(dataBuffer));
						dataBuffer = [];
					}
				} catch (e) {
					console.error(e);
					throw e;
				}
			}
		);

		const devicePath = '/dev/' + filename;
		PHPWASM.input_devices[deviceId] = {
			devicePath: devicePath,
			onData: function (cb) {
				dataCallback = cb;
				dataBuffer.forEach(function (data) {
					cb(data);
				});
				dataBuffer.length = 0;
			},
		};
		return allocateUTF8OnStack(devicePath);
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
			return 1;
		}

		const cmdstr = UTF8ToString(command);
		if (!cmdstr.length) {
			return 0;
		}

		let argsArray = [];
		if (argsLength) {
			for (var i = 0; i < argsLength; i++) {
				const charPointer = argsPtr + i * 4;
				argsArray.push(UTF8ToString(HEAPU32[charPointer >> 2]));
			}
		}

		const cwdstr = cwdPtr ? UTF8ToString(cwdPtr) : null;
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
		}

		return Asyncify.handleSleep(async (wakeUp) => {
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
					wakeUp(1);
					return;
				}
				console.error(e);
				wakeUp(1);
				throw e;
			}

			const ProcInfo = {
				pid: cp.pid,
				exited: false,
				stdinFd: std[0]?.child,
				stdinIsDevice: std[0]?.child in PHPWASM.input_devices,
				stdoutChildFd: std[1]?.child,
				stdoutParentFd: std[1]?.parent,
				stderrChildFd: std[2]?.child,
				stderrParentFd: std[2]?.parent,
				stdout: new PHPWASM.EventEmitter(),
				stderr: new PHPWASM.EventEmitter(),
			};
			if (ProcInfo.stdoutChildFd)
				PHPWASM.child_proc_by_fd[ProcInfo.stdoutChildFd] = ProcInfo;
			if (ProcInfo.stderrChildFd)
				PHPWASM.child_proc_by_fd[ProcInfo.stderrChildFd] = ProcInfo;
			if (ProcInfo.stdoutParentFd)
				PHPWASM.child_proc_by_fd[ProcInfo.stdoutParentFd] = ProcInfo;
			if (ProcInfo.stderrParentFd)
				PHPWASM.child_proc_by_fd[ProcInfo.stderrParentFd] = ProcInfo;
			PHPWASM.child_proc_by_pid[ProcInfo.pid] = ProcInfo;

			cp.on('exit', function (code) {
				ProcInfo.exitCode = code;
				ProcInfo.exited = true;
				// Emit events for the wasm_poll_socket function.
				ProcInfo.stdout.emit('data');
				ProcInfo.stderr.emit('data');
			});

			// Pass data from child process's stdout to PHP's end of the stdout pipe.
			if (ProcInfo.stdoutChildFd) {
				const stdoutStream = SYSCALLS.getStreamFromFD(
					ProcInfo.stdoutChildFd
				);
				let stdoutAt = 0;
				cp.stdout.on('data', function (data) {
					ProcInfo.stdout.emit('data', data);
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
			if (ProcInfo.stderrChildFd) {
				const stderrStream = SYSCALLS.getStreamFromFD(
					ProcInfo.stderrChildFd
				);
				let stderrAt = 0;
				cp.stderr.on('data', function (data) {
					ProcInfo.stderr.emit('data', data);
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
					cp.on('spawn', resolve);
					cp.on('error', reject);
				});
			} catch (e) {
				console.error(e);
				wakeUp(1);
				return;
			}

			// Now we want to pass data from the STDIN source supplied by PHP
			// to the child process.

			// PHP will write STDIN data to a device.
			if (ProcInfo.stdinIsDevice) {
				// We use Emscripten devices as pipes. This is a bit of a hack
				// but it works as we get a callback when the device is written to.
				// Let's listen to anything it outputs and pass it to the child process.
				PHPWASM.input_devices[ProcInfo.stdinFd].onData(function (data) {
					if (!data) return;
					const dataStr = new TextDecoder('utf-8').decode(data);
					cp.stdin.write(dataStr);
				});
				wakeUp(ProcInfo.pid);
				return;
			}

			if (ProcInfo.stdinFd) {
				// PHP will write STDIN data to a file descriptor.
				const stdinStream = SYSCALLS.getStreamFromFD(ProcInfo.stdinFd);
				if (stdinStream.node) {
					// Pipe the entire stdinStream to cp.stdin
					const CHUNK_SIZE = 1024;
					const buffer = new Uint8Array(CHUNK_SIZE);
					let offset = 0;

					while (true) {
						const bytesRead = stdinStream.stream_ops.read(
							stdinStream,
							buffer,
							0,
							CHUNK_SIZE,
							offset
						);
						if (bytesRead === null || bytesRead === 0) {
							break;
						}
						try {
							cp.stdin.write(buffer.subarray(0, bytesRead));
						} catch (e) {
							console.error(e);
							return 1;
						}
						if (bytesRead < CHUNK_SIZE) {
							break;
						}
						offset += bytesRead;
					}

					wakeUp(ProcInfo.pid);
					return;
				}
			}

			wakeUp(ProcInfo.pid);
		});
	},

	js_process_status: function (pid, exitCodePtr) {
		if (!PHPWASM.child_proc_by_pid[pid]) {
			return -1;
		}
		if (PHPWASM.child_proc_by_pid[pid].exited) {
			HEAPU32[exitCodePtr >> 2] =
				PHPWASM.child_proc_by_pid[pid].exitCode;
			return 1;
		}
		return 0;
	},


	js_waitpid: function (pid, exitCodePtr) {
		if (!PHPWASM.child_proc_by_pid[pid]) {
			return -1;
		}
		return Asyncify.handleSleep((wakeUp) => {
			const poll = function () {
				if (PHPWASM.child_proc_by_pid[pid]?.exited) {
					HEAPU32[exitCodePtr >> 2] =
						PHPWASM.child_proc_by_pid[pid].exitCode;
					wakeUp(pid);
				} else {
					setTimeout(poll, 50);
				}
			};
			poll();
		});
	},

	/**
	 * Shims poll(2) functionallity for asynchronous websockets:
	 * https://man7.org/linux/man-pages/man2/poll.2.html
	 *
	 * The semantics don't line up exactly with poll(2) but
	 * the intent does. This function is called in php_pollfd_for()
	 * to await a websocket-related event.
	 *
	 * @param {int} socketd The socket descriptor
	 * @param {int} events  The events to wait for
	 * @param {int} timeout The timeout in milliseconds
	 * @returns {int} 1 if any event was triggered, 0 if the timeout expired
	 */
	wasm_poll_socket: function (socketd, events, timeout) {
		if (typeof Asyncify === 'undefined') {
			return 0;
		}

		const POLLIN = 0x0001; /* There is data to read */
		const POLLPRI = 0x0002; /* There is urgent data to read */
		const POLLOUT = 0x0004; /* Writing now will not block */
		const POLLERR = 0x0008; /* Error condition */
		const POLLHUP = 0x0010; /* Hung up */
		const POLLNVAL = 0x0020; /* Invalid request: fd not open */

		return Asyncify.handleSleep((wakeUp) => {
			const polls = [];
			if (socketd in PHPWASM.child_proc_by_fd) {
				// This is a child process-related socket.
				const procInfo = PHPWASM.child_proc_by_fd[socketd];
				if (procInfo.exited) {
					wakeUp(0);
					return;
				}
				polls.push(PHPWASM.awaitEvent(procInfo.stdout, 'data'));
			} else {
				// This is, most likely, a websocket. Let's make sure.
				const sock = getSocketFromFD(socketd);
				if (!sock) {
					wakeUp(0);
					return;
				}
				const lookingFor = new Set();

				if (events & POLLIN || events & POLLPRI) {
					if (sock.server) {
						for (const client of sock.pending) {
							if ((client.recv_queue || []).length > 0) {
								wakeUp(1);
								return;
							}
						}
					} else if ((sock.recv_queue || []).length > 0) {
						wakeUp(1);
						return;
					}
				}

				const webSockets = PHPWASM.getAllWebSockets(sock);
				if (!webSockets.length) {
					wakeUp(0);
					return;
				}
				for (const ws of webSockets) {
					if (events & POLLIN || events & POLLPRI) {
						polls.push(PHPWASM.awaitData(ws));
						lookingFor.add('POLLIN');
					}
					if (events & POLLOUT) {
						polls.push(PHPWASM.awaitConnection(ws));
						lookingFor.add('POLLOUT');
					}
					if (events & POLLHUP) {
						polls.push(PHPWASM.awaitClose(ws));
						lookingFor.add('POLLHUP');
					}
					if (events & POLLERR || events & POLLNVAL) {
						polls.push(PHPWASM.awaitError(ws));
						lookingFor.add('POLLERR');
					}
				}
			}
			if (polls.length === 0) {
				console.warn(
					'Unsupported poll event ' +
						events +
						', defaulting to setTimeout().'
				);
				setTimeout(function () {
					wakeUp(0);
				}, timeout);
				return;
			}

			const promises = polls.map(([promise]) => promise);
			const clearPolling = () => polls.forEach(([, clear]) => clear());
			let awaken = false;
			let timeoutId;
			Promise.race(promises).then(function (results) {
				if (!awaken) {
					awaken = true;
					wakeUp(1);
					if (timeoutId) {
						clearTimeout(timeoutId);
					}
					clearPolling();
				}
			});

			if (timeout !== -1) {
				timeoutId = setTimeout(function () {
					if (!awaken) {
						awaken = true;
						wakeUp(0);
						clearPolling();
					}
				}, timeout);
			}
		});
	},

	/**
	 * Shims unix shutdown(2) functionallity for asynchronous:
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
	 * Shims unix close(2) functionallity for asynchronous:
	 * https://man7.org/linux/man-pages/man2/close.2.html
	 *
	 * @param {int} socketd
	 * @returns 0 on success, -1 on failure
	 */
	wasm_close: function (socketd) {
		return PHPWASM.shutdownSocket(socketd, 2);
	},

	/**
	 * Shims setsockopt(2) functionallity for asynchronous websockets:
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
		const IPPROTO_TCP = 6;
		const TCP_NODELAY = 1;
		const isSupported =
			(level === SOL_SOCKET && optionName === SO_KEEPALIVE) ||
			(level === IPPROTO_TCP && optionName === TCP_NODELAY);
		if (!isSupported) {
			console.warn(
				`Unsupported socket option: ${level}, ${optionName}, ${optionValue}`
			);
			return -1;
		}
		const ws = PHPWASM.getAllWebSockets(socketd)[0];
		if (!ws) {
			return -1;
		}
		ws.setSocketOpt(level, optionName, optionValuePtr);
		return 0;
	},

	/**
	 * Shims read(2) functionallity.
	 * Enables reading from blocking pipes. By default, Emscripten
	 * will throw an EWOULDBLOCK error when trying to read from a
	 * blocking pipe. This function overrides that behavior and
	 * instead waits for the pipe to become readable.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/issues/951
	 * @see https://github.com/emscripten-core/emscripten/issues/13214
	 */
	js_fd_read: function (fd, iov, iovcnt, pnum) {
		if (
			// When running JSPI
			!Asyncify || !('State' in Asyncify)
			// When running Asyncify and not rewinding the stack.
			|| Asyncify.state === Asyncify.State.Normal
		) {
            var returnCode;
            var stream;
			let num = 0;
            try {
                stream = SYSCALLS.getStreamFromFD(fd);
                const num = doReadv(stream, iov, iovcnt);
                HEAPU32[pnum >> 2] = num;
				return 0;
			} catch (e) {
				// Rethrow any unexpected non-filesystem errors.
				if (typeof FS == "undefined" || !(e.name === "ErrnoError")) {
					throw e;
				}
                // Only return synchronously if this isn't an asynchronous pipe.
				// Error code 6 indicates EWOULDBLOCK – this is our signal to wait.
				// We also need to distinguish between a process pipe and a file pipe, otherwise
				// reading from an empty file would block until the timeout.
				if (e.errno !== 6 || !(stream?.fd in PHPWASM.child_proc_by_fd)) {
					// On failure, yield 0 bytes read to indicate EOF.
					HEAPU32[pnum >> 2] = 0;
					return returnCode
				}
            }
		}

		// At this point we know we have to poll.
		// You might wonder why we duplicate the code here instead of always using
		// Asyncify.handleSleep(). The reason is performance. Most of the time,
		// the read operation will work synchronously and won't require yielding
		// back to JS. In these cases we don't want to pay the Asyncify overhead,
		// save the stack, yield back to JS, restore the stack etc.
		return Asyncify.handleSleep(function (wakeUp) {
			var retries = 0;
			var interval = 50;
			var timeout = 5000;
			// We poll for data and give up after a timeout.
			// We can't simply rely on PHP timeout here because we don't want
			// to, say, block the entire PHPUnit test suite without any visible
			// feedback.
			var maxRetries = timeout / interval;
			function poll() {
				var returnCode;
				var stream;
				let num;
				try {
					stream = SYSCALLS.getStreamFromFD(fd);
					num = doReadv(stream, iov, iovcnt);
					returnCode = 0;
				} catch (e) {
					if (
						typeof FS == 'undefined' ||
						!(e.name === 'ErrnoError')
					) {
						console.error(e);
						throw e;
					}
					returnCode = e.errno;
				}

				const success = returnCode === 0;
				const failure = (
					++retries > maxRetries ||
					!(fd in PHPWASM.child_proc_by_fd) ||
					PHPWASM.child_proc_by_fd[fd]?.exited ||
					FS.isClosed(stream)
				);

				if (success) {
					HEAPU32[pnum >> 2] = num;
					wakeUp(0);
				} else if (failure) {
					// On failure, yield 0 bytes read to indicate EOF.
					HEAPU32[pnum >> 2] = 0;
					// If the failure is due to a timeout, return 0 to indicate that we
					// reached EOF. Otherwise, propagate the error code.
					wakeUp(returnCode === 6 ? 0 : returnCode);
				} else {
					setTimeout(poll, interval);
				}
			}
			poll();
		});
	},

	

};

autoAddDeps(LibraryExample, '$PHPWASM');
mergeInto(LibraryManager.library, LibraryExample);
