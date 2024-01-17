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

	// Functions not exposed to C but available in the generated
	// JavaScript library under the PHPWASM object:
	$PHPWASM: {
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
			return PHPWASM.awaitWsEvent(ws, 'message');
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
			return PHPWASM.awaitWsEvent(ws, 'open');
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
			return PHPWASM.awaitWsEvent(ws, 'close');
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
			return PHPWASM.awaitWsEvent(ws, 'error');
		},

		/**
		 * Waits for a websocket-related event.
		 *
		 * @param {WebSocket} ws Websocket object
		 * @param {string} event The event to wait for.
		 * @returns {[Promise, function]} A promise and a function to cancel the promise
		 */
		awaitWsEvent: function (ws, event) {
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

		spawnProcess: function (command) {
			if (Module['spawnProcess']) {
				const spawned = Module['spawnProcess'](command);
				if (!spawned || !spawned.on) {
					throw new Error(
						'spawnProcess() must return an EventEmitter but returned a different type.'
					);
				}
				return spawned;
			}

			if (ENVIRONMENT_IS_NODE) {
				return require('child_process').spawn(command, [], {
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
		 * Shims unix shutdown(2) functionallity for asynchronous websockets:
		 * https://man7.org/linux/man-pages/man2/shutdown.2.html
		 *
		 * Does not support SHUT_RD or SHUT_WR.
		 *
		 * @param {int} socketd
		 * @param {int} how
		 * @returns 0 on success, -1 on failure
		 */
		shutdownSocket: function (socketd, how) {
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
	 * @param {int} procopenCallId
	 * @returns {int} The path of the input devicex (string pointer).
	 */
	js_create_input_device: function (procopenCallId) {
		if (!PHPWASM.input_devices) {
			PHPWASM.input_devices = {};
		}
		let dataBuffer = [];
		let dataCallback;
		const filename = 'proc_id_' + procopenCallId;
		const device = FS.createDevice(
			'/dev',
			filename,
			function () {},
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
		PHPWASM.input_devices[procopenCallId] = {
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
	 * @param {int} stdinFd Child process end of the stdin pipe (the one to read from).
	 * @param {int} stdoutChildFd Child process end of the stdout pipe (the one to write to).
	 * @param {int} stdoutParentFd PHP's end of the stdout pipe (the one to read from).
	 * @param {int} stderrChildFd Child process end of the stderr pipe (the one to write to).
	 * @param {int} stderrParentFd PHP's end of the stderr pipe (the one to read from).
	 * @returns {int} 0 on success, 1 on failure.
	 */
	js_open_process: function (
		command,
		stdinFd,
		stdoutChildFd,
		stdoutParentFd,
		stderrChildFd,
		stderrParentFd
	) {
		if (!PHPWASM.proc_fds) {
			PHPWASM.proc_fds = {};
		}
		if (!command) {
			return 1;
		}

		const cmdstr = UTF8ToString(command);
		if (!cmdstr.length) {
			return 0;
		}

		let cp;
		try {
			cp = PHPWASM.spawnProcess(cmdstr);
		} catch (e) {
			if (e.code === 'SPAWN_UNSUPPORTED') {
				return 1;
			}
			throw e;
		}

		let EventEmitter;
		if (ENVIRONMENT_IS_NODE) {
			EventEmitter = require('events').EventEmitter;
		} else {
			EventEmitter = function () {
				this.listeners = {};
			};
			EventEmitter.prototype.emit = function (eventName, data) {
				if (this.listeners[eventName]) {
					this.listeners[eventName].forEach(function (callback) {
						callback(data);
					});
				}
			};
			EventEmitter.prototype.once = function (eventName, callback) {
				const self = this;
				function removedCallback() {
					callback(...arguments);
					self.removeListener(eventName, removedCallback);
				}
				this.on(eventName, removedCallback);
			};
			EventEmitter.prototype.on = function (eventName, callback) {
				if (!this.listeners[eventName]) {
					this.listeners[eventName] = [];
				}
				this.listeners[eventName].push(callback);
			};
			EventEmitter.prototype.removeListener = function (
				eventName,
				callback
			) {
				const idx = this.listeners[eventName].indexOf(callback);
				if (idx !== -1) {
					this.listeners[eventName].splice(idx, 1);
				}
			};
		}
		PHPWASM.proc_fds[stdoutParentFd] = new EventEmitter();
		PHPWASM.proc_fds[stdoutParentFd].stdinFd = stdinFd;
		PHPWASM.proc_fds[stderrParentFd] = new EventEmitter();
		PHPWASM.proc_fds[stderrParentFd].stdinFd = stdinFd;

		const stdoutStream = SYSCALLS.getStreamFromFD(stdoutChildFd);
		cp.on('exit', function (data) {
			PHPWASM.proc_fds[stdoutParentFd].exited = true;
			PHPWASM.proc_fds[stdoutParentFd].emit('data');
			PHPWASM.proc_fds[stderrParentFd].exited = true;
			PHPWASM.proc_fds[stderrParentFd].emit('data');
		});

		// Pass data from child process's stdout to PHP's end of the stdout pipe.
		cp.stdout.on('data', function (data) {
			PHPWASM.proc_fds[stdoutParentFd].hasData = true;
			PHPWASM.proc_fds[stdoutParentFd].emit('data');
			stdoutStream.stream_ops.write(
				stdoutStream,
				data,
				0,
				data.length,
				0
			);
		});

		// Pass data from child process's stderr to PHP's end of the stdout pipe.
		const stderrStream = SYSCALLS.getStreamFromFD(stderrChildFd);
		cp.stderr.on('data', function (data) {
			PHPWASM.proc_fds[stderrParentFd].hasData = true;
			PHPWASM.proc_fds[stderrParentFd].emit('data');
			stderrStream.stream_ops.write(
				stderrStream,
				data,
				0,
				data.length,
				0
			);
		});

		// Pass data from stdin fd to child process's stdin.
		if (PHPWASM.input_devices && stdinFd in PHPWASM.input_devices) {
			// It is a "pipe". By now it is listed in `callback_pipes`.
			// Let's listen to anything it outputs and pass it to the child process.
			PHPWASM.input_devices[stdinFd].onData(function (data) {
				if (!data) return;
				const dataStr = new TextDecoder('utf-8').decode(data);
				cp.stdin.write(dataStr);
			});
			return 0;
		}

		// It is a file descriptor.
		// Let's pass the already read contents to the child process.
		const stdinStream = SYSCALLS.getStreamFromFD(stdinFd);
		if (!stdinStream.node) {
			return 0;
		}

		// Pipe the entire stdinStream to cp.stdin
		const CHUNK_SIZE = 1024;
		const buffer = Buffer.alloc(CHUNK_SIZE);
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

		return 0;
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
			if (PHPWASM.proc_fds && socketd in PHPWASM.proc_fds) {
				const emitter = PHPWASM.proc_fds[socketd];
				if (emitter.exited) {
					wakeUp(0);
					return;
				}
				polls.push(PHPWASM.awaitWsEvent(emitter, 'data'));
			} else {
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
	 * Shims unix shutdown(2) functionallity for asynchronous websockets:
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
	 * Shims unix close(2) functionallity for asynchronous websockets:
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
		var returnCode;
		var stream;
		try {
			stream = SYSCALLS.getStreamFromFD(fd);
			var num = doReadv(stream, iov, iovcnt);
			HEAPU32[pnum >> 2] = num;
			returnCode = 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			returnCode = e.errno;
		}

		// If it's a blocking process pipe, wait for it to become readable.
		// We need to distinguish between a process pipe and a file pipe, otherwise
		// reading from an empty file would block until the timeout.
		if (
			returnCode === 6 /*EWOULDBLOCK*/ &&
			stream?.fd in PHPWASM.proc_fds
		) {
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
					try {
						stream = SYSCALLS.getStreamFromFD(fd);
						var num = doReadv(stream, iov, iovcnt);
						HEAPU32[pnum >> 2] = num;
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

					if (
						returnCode !== 6 ||
						++retries > maxRetries ||
						!(stream?.fd in PHPWASM.proc_fds) ||
						PHPWASM.proc_fds[stream?.fd]?.exited ||
						FS.isClosed(stream) ||
						!(
							PHPWASM.proc_fds[fd]?.stdinFd in
							(PHPWASM.input_devices || {})
						)
					) {
						wakeUp(returnCode);
					} else {
						setTimeout(poll, interval);
					}
				}
				poll();
			});
		}
		return returnCode;
	},

	/**
	 * Shims popen(3) functionallity:
	 * https://man7.org/linux/man-pages/man3/popen.3.html
	 *
	 * On Node.js, this function is implemented using child_process.spawn().
	 *
	 * In the browser, you must provide a Module['popen_to_file'] function
	 * that accepts a command string and popen mode (like "r" or "w") and
	 * returns an object with a 'path' property and an 'exitCode' property:
	 * * The 'path' property is the path of the file where the output of the
	 *   command is written.
	 * * The 'exitCode' property is the exit code of the command.
	 *
	 * @param {int} command Command to execute
	 * @param {int} mode Mode to open the command in
	 * @param {int} exitCodePtr Pointer to the exit code
	 * @returns {int} File descriptor of the command output
	 */
	js_popen_to_file: function (command, mode, exitCodePtr) {
		// Parse args
		if (!command) return 1; // shell is available

		const cmdstr = UTF8ToString(command);
		if (!cmdstr.length) return 0; // this is what glibc seems to do (shell works test?)

		const modestr = UTF8ToString(mode);
		if (!modestr.length) return 0; // this is what glibc seems to do (shell works test?)
		if (modestr === 'w') {
			console.error('popen($cmd, "w") is not implemented yet');
		}

		return Asyncify.handleSleep((wakeUp) => {
			let cp;
			try {
				cp = PHPWASM.spawnProcess(cmdstr);
			} catch (e) {
				console.error(e);
				if (e.code === 'SPAWN_UNSUPPORTED') {
					return 1;
				}
				throw e;
			}

			const outByteArrays = [];
			cp.stdout.on('data', function (data) {
				outByteArrays.push(data);
			});

			const outputPath = '/tmp/popen_output';
			cp.on('exit', function (exitCode) {
				// Concat outByteArrays, an array of UInt8Arrays
				// into a single Uint8Array.
				const outBytes = new Uint8Array(
					outByteArrays.reduce((acc, curr) => acc + curr.length, 0)
				);
				let offset = 0;
				for (const byteArray of outByteArrays) {
					outBytes.set(byteArray, offset);
					offset += byteArray.length;
				}

				FS.writeFile(outputPath, outBytes);

				HEAPU8[exitCodePtr] = exitCode;
				wakeUp(allocateUTF8OnStack(outputPath)); // 2 is SIGINT
			});
		});
	},

	js_module_onMessage: function (data, bufPtr) {
		if (typeof Asyncify === 'undefined') {
			return;
		}

		if (Module['onMessage']) {
			const dataStr = UTF8ToString(data);

			return Asyncify.handleSleep((wakeUp) => {
				Module['onMessage'](dataStr)
					.then((response) => {
						const responseBytes =
							typeof response === 'string'
								? new TextEncoder().encode(response)
								: response;

						// Copy the response bytes to heap
						const responseSize = responseBytes.byteLength;
						const responsePtr = _malloc(responseSize + 1);
						HEAPU8.set(responseBytes, responsePtr);
						HEAPU8[responsePtr + responseSize] = 0;
						HEAPU8[bufPtr] = responsePtr;
						HEAPU8[bufPtr + 1] = responsePtr >> 8;
						HEAPU8[bufPtr + 2] = responsePtr >> 16;
						HEAPU8[bufPtr + 3] = responsePtr >> 24;

						wakeUp(responseSize);
					})
					.catch((e) => {
						// Log the error and return NULL. Message passing
						// separates JS context from the PHP context so we
						// don't let PHP crash here.
						console.error(e);
						wakeUp(0);
					});
			});
		}
	},
};

autoAddDeps(LibraryExample, '$PHPWASM');
mergeInto(LibraryManager.library, LibraryExample);
