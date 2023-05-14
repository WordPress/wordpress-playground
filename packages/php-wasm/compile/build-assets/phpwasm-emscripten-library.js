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
	$PHPWASM__deps: ['$allocateUTF8OnStack', '$NativeFS'],

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
		return 0;
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
			const sock = getSocketFromFD(socketd);
			if (!sock) {
				wakeUp(0);
				return;
			}
			const polls = [];
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
			Promise.race(promises).then(function (results) {
				if (!awaken) {
					awaken = true;
					wakeUp(1);
					clearTimeout(timeoutId);
					clearPolling();
				}
			});

			const timeoutId = setTimeout(function () {
				if (!awaken) {
					awaken = true;
					wakeUp(0);
					clearPolling();
				}
			}, timeout);
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

		if (Module['popen_to_file']) {
			const { path, exitCode } = Module['popen_to_file'](cmdstr, modestr);
			HEAPU8[exitCodePtr] = exitCode;
			return allocateUTF8OnStack(path);
		}

#if ENVIRONMENT_MAY_BE_NODE
		if (ENVIRONMENT_IS_NODE) {
			// Create a temporary file to read stdin from or write stdout to
			const tmp = require('os').tmpdir();
			const tmpFileName = 'php-process-stream';
			const pipeFilePath = tmp + '/' + tmpFileName;

			const cp = require('child_process');
			let ret;
			if (modestr === 'r') {
				ret = cp.spawnSync(cmdstr, [], {
					shell: true,
					stdio: ['inherit', 'pipe', 'inherit'],
				});
				HEAPU8[exitCodePtr] = ret.status;
				require('fs').writeFileSync(pipeFilePath, ret.stdout, {
					encoding: 'utf8',
					flag: 'w+',
				});
			} else if (modestr === 'w') {
				console.error('popen mode w not implemented yet');
				return _W_EXITCODE(0, 2); // 2 is SIGINT
			} else {
				console.error(
					'invalid mode ' + modestr + ' (should be r or w)'
				);
				return _W_EXITCODE(0, 2); // 2 is SIGINT
			}

			return allocateUTF8OnStack(pipeFilePath);
		}
#endif // ENVIRONMENT_MAY_BE_NODE

		throw new Error(
			'popen() is unsupported in the browser. Implement popen_to_file in your Module ' +
				'or disable shell_exec() and similar functions via php.ini.'
		);
		return _W_EXITCODE(0, 2); // 2 is SIGINT
	},

	// @TODO: Only load this in the browser
	$NativeFS__deps: ['$FS', '$mmapAlloc'],
	$NativeFS__postset: function () {
		addAtInit(`FS.filesystems.NativeFS = NativeFS;`)
	},
	$NativeFS: {
		ops_table: null,
		mount: function (mount) {
			const node = NativeFS.createNode(
				null,
				'/',
				16384 | 511,
				0
			);
			node.fs_handle = mount.opts.fs_handle;
			return node;
		},
		createNode: function (parent, name, mode, dev) {
			if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
				throw new FS.ErrnoError(63);
			}
			if (!NativeFS.ops_table) {
				NativeFS.ops_table = {
					dir: {
						node: {
							getattr: NativeFS.node_ops.getattr,
							setattr: NativeFS.node_ops.setattr,
							lookup: NativeFS.node_ops.lookup,
							mknod: NativeFS.node_ops.mknod,
							rename: NativeFS.node_ops.rename,
							unlink: NativeFS.node_ops.unlink,
							rmdir: NativeFS.node_ops.rmdir,
							readdir: NativeFS.node_ops.readdir,
							symlink: NativeFS.node_ops.symlink,
						},
						stream: {
							llseek: NativeFS.stream_ops.llseek,
						},
					},
					file: {
						node: {
							getattr: NativeFS.node_ops.getattr,
							setattr: NativeFS.node_ops.setattr,
						},
						stream: {
							llseek: NativeFS.stream_ops.llseek,
							read: NativeFS.stream_ops.read,
							write: NativeFS.stream_ops.write,
							allocate: NativeFS.stream_ops.allocate,
							mmap: NativeFS.stream_ops.mmap,
							msync: NativeFS.stream_ops.msync,
						},
					},
					link: {
						node: {
							getattr: NativeFS.node_ops.getattr,
							setattr: NativeFS.node_ops.setattr,
							readlink: NativeFS.node_ops.readlink,
						},
						stream: {},
					},
					chrdev: {
						node: {
							getattr: NativeFS.node_ops.getattr,
							setattr: NativeFS.node_ops.setattr,
						},
						stream: FS.chrdev_stream_ops,
					},
				};
			}
			var node = FS.createNode(parent, name, mode, dev);
			if (FS.isDir(node.mode)) {
				node.node_ops = NativeFS.ops_table.dir.node;
				node.stream_ops = NativeFS.ops_table.dir.stream;
				node.fs_handle = parent.fs_handle.getDirectoryHandle(name, {
					create: true,
				});
			} else if (FS.isFile(node.mode)) {
				node.node_ops = NativeFS.ops_table.file.node;
				node.stream_ops = NativeFS.ops_table.file.stream;
				node.usedBytes = 0;
				node.fs_handle = parent.fs_handle.getFileHandle(name, {
					create: true,
				});
			} else if (FS.isLink(node.mode)) {
				node.node_ops = NativeFS.ops_table.link.node;
				node.stream_ops = NativeFS.ops_table.link.stream;
			} else if (FS.isChrdev(node.mode)) {
				node.node_ops = NativeFS.ops_table.chrdev.node;
				node.stream_ops = NativeFS.ops_table.chrdev.stream;
			}
			node.timestamp = Date.now();
			if (parent) {
				parent.timestamp = node.timestamp;
			}
			return node;
		},
		getFileDataAsTypedArray: function (node) {
			if (!node.contents) return new Uint8Array(0);
			if (node.contents.subarray)
				return node.contents.subarray(0, node.usedBytes);
			return new Uint8Array(node.contents);
		},
		node_ops: {
			getattr: function (node) {
				var attr = {};
				attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
				attr.ino = node.id;
				attr.mode = node.mode;
				attr.nlink = 1;
				attr.uid = 0;
				attr.gid = 0;
				attr.rdev = node.rdev;
				if (FS.isDir(node.mode)) {
					attr.size = 4096;
				} else if (FS.isFile(node.mode)) {
					attr.size = node.usedBytes;
				} else if (FS.isLink(node.mode)) {
					attr.size = node.link.length;
				} else {
					attr.size = 0;
				}
				attr.atime = new Date(node.timestamp);
				attr.mtime = new Date(node.timestamp);
				attr.ctime = new Date(node.timestamp);
				attr.blksize = 4096;
				attr.blocks = Math.ceil(attr.size / attr.blksize);
				return attr;
			},
			setattr: function (node, attr) {
				if (attr.mode !== undefined) {
					node.mode = attr.mode;
				}
				if (attr.timestamp !== undefined) {
					node.timestamp = attr.timestamp;
				}
				if (attr.size !== undefined) {
					NativeFS.resizeFileStorage(node, attr.size);
				}
			},
			lookup: function (parent, name) {
				throw FS.genericErrors[44];
			},
			mknod: function (parent, name, mode, dev) {
				return NativeFS.createNode(parent, name, mode, dev);
			},
			rename: function (old_node, new_dir, new_name) {
				if (FS.isDir(old_node.mode)) {
					throw new FS.ErrnoError(55);
				}

				return Asyncify.handleSleep(async (wakeUp) => {
					// Read the file contents
					const fileContents = await old_node.fs_handle.getFile();
					// Create a new file
					const newFileHandle = await new_dir.fs_handle.getFile(
						new_name,
						{ create: true }
					);
					// Write the file contents to the new file
					await newFileHandle.write(fileContents);
					// Delete the old file
					await old_node.fs_handle.removeEntry();
					wakeUp();
				});
			},
		},
		unlink: function (parent, name) {
			return Asyncify.handleSleep(async (wakeUp) => {
				await parent.fs_handle.removeEntry(name);
				parent.timestamp = Date.now();
				wakeUp();
			});
		},
		readdir: function (node) {
			var entries = ['.', '..'];
			return Asyncify.handleSleep(async (wakeUp) => {
				for await (const entry of dirHandle.values()) {
					entries.push(entry.name);
				}
				return wakeUp(entries);
			});
		},
		rmdir: function (parent, name) {
			var node = FS.lookupNode(parent, name);
			parent.timestamp = Date.now();

			return Asyncify.handleSleep(async (wakeUp) => {
				await directoryHandle.removeEntry(name, { recursive: false });
				return wakeUp();
			});
		},
		symlink: function (parent, newname, oldpath) {
			throw new FS.ErrnoError(25);
		},
		readlink: function (node) {
			throw new FS.ErrnoError(25);
		},
	},
	stream_ops: {
		write: function (stream, buffer, offset, length, position, canOwn) {
			if (stream.stream_ops) {
				// this stream is created by in-memory filesystem
				return VFS.write(stream, buffer, offset, length, position);
			}
			if (stream.flags & +'1024') {
				// seek to the end before writing in append mode
				FS.llseek(stream, 0, +'2');
			}
			var seeking = typeof position != 'undefined';
			if (!seeking && stream.seekable) position = stream.position;
			var bytesRead = stream.fs_handle.write(
				buffer.subarray(offset, offset + length),
				{ at: position }
			);
			// update position marker when non-seeking
			if (!seeking) stream.position += bytesWritten;
			return bytesWritten;
		},
		read: function (stream, buffer, offset, length, position) {
			if (stream.stream_ops) {
				// this stream is created by in-memory filesystem
				return VFS.read(stream, buffer, offset, length, position);
			}
			var seeking = typeof position != 'undefined';
			if (!seeking && stream.seekable) position = stream.position;

			var bytesRead = stream.fs_handle.read(
				buffer.subarray(offset, offset + length),
				{ at: position }
			);
			// update position marker when non-seeking
			if (!seeking) stream.position += bytesRead;
			return bytesRead;
		},
		llseek: function (stream, offset, whence) {
			var position = offset;
			if (whence === 1) {
				fs_stream.seek(position);
			} else if (whence === 2) {
				if (FS.isFile(stream.node.mode)) {
					position += stream.node.usedBytes;
				}
			}
			if (position < 0) {
				throw new FS.ErrnoError(28);
			}
			return position;
		},
		allocate: function (stream, offset, length) {
			throw new FS.ErrnoError(45);
		},
		mmap: (stream, length, position, prot, flags) => {
			if (!FS.isFile(stream.node.mode)) {
				throw new FS.ErrnoError(19);
			}

			var ptr = mmapAlloc(length);

			NativeFS.stream_ops.read(stream, HEAP8, ptr, length, position);
			return { ptr: ptr, allocated: true };
		},
		msync: function (stream, buffer, offset, length, mmapFlags) {
			NativeFS.stream_ops.write(stream, buffer, 0, length, offset, false);
			return 0;
		},
		munmap: function () {
			return 0;
		},
		ioctl: function () {
			throw new FS.ErrnoError(25);
		},
	},
};

autoAddDeps(LibraryExample, '$PHPWASM');
mergeInto(LibraryManager.library, LibraryExample);
