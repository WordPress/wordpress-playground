// "use strict";

const LibraryExample = {
	// Internal functions
	$PHPWASM: {
		getSocketDetails: function(socketd) {
			const sock = getSocketFromFD(socketd);
			if (!sock) {
				return {};
			}
	
			const peer = Object.values(sock.peers)[0];
			if (!peer || !peer.socket) {
				return {};
			}

			return { sock: sock, ws: peer.socket };
		},
		awaitData: function(sock, ws) {
		  if ((sock.recv_queue || {}).length > 0) {
			return [Promise.resolve(), PHPWASM.noop];
		  }
		  return PHPWASM.awaitWsEvent(sock, ws, "message");
		},
		awaitConnection: function(sock, ws) {
		  if (ws.OPEN === ws.readyState) {
			return [Promise.resolve(), PHPWASM.noop];
		  }
		  return PHPWASM.awaitWsEvent(sock, ws, "open");
		},
		awaitClose: function(sock, ws) {
		  if ([ws.CLOSING, ws.CLOSED].includes(ws.readyState)) {
			return [Promise.resolve(), PHPWASM.noop];
		  }
		  return PHPWASM.awaitWsEvent(sock, ws, "close");
		},
		awaitError: function(sock, ws) {
		  if ([ws.CLOSING, ws.CLOSED].includes(ws.readyState)) {
			return [Promise.resolve(), PHPWASM.noop];
		  }
		  return PHPWASM.awaitWsEvent(sock, ws, "error");
		},
		awaitWsEvent: function(sock, ws, event) {
		  let resolve;
		  const listener = () => {
			resolve();
		  }
		  const promise = new Promise(function(_resolve) {
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
		noop: function() {}
	},
	$PHPWASM__deps: ['$allocateUTF8OnStack'],
	wasm_socket_has_data: function (socketd) {
		const sock = getSocketFromFD(socketd);
		return sock.recv_queue.length > 0;
	},
	wasm_poll_socket: function (socketd, events, timeout) {
		// Only support POLLIN, POLLPRI, and POLLOUT
		const POLLIN = 0x0001;     /* There is data to read */
		const POLLPRI = 0x0002;    /* There is urgent data to read */
		const POLLOUT = 0x0004;    /* Writing now will not block */
		const POLLERR = 0x0008;    /* Error condition */
		const POLLHUP = 0x0010;    /* Hung up */
		const POLLNVAL = 0x0020;   /* Invalid request: fd not open */
		return Asyncify.handleSleep((wakeUp) => {
			const details = PHPWASM.getSocketDetails(socketd);
			if (!details.sock || !details.ws) {
			  wakeUp(0);
			  return;
			}
			const polls = [];
			const lookingFor = [];
			if (events & POLLIN || events & POLLPRI) {
			  polls.push(PHPWASM.awaitData(details.sock, details.ws));
			  lookingFor.push("POLLIN");
			}
			if (events & POLLOUT) {
			  polls.push(PHPWASM.awaitConnection(details.sock, details.ws));
			  lookingFor.push("POLLOUT");
			}
			if (events & POLLHUP) {
			  polls.push(PHPWASM.awaitClose(details.sock, details.ws));
			  lookingFor.push("POLLHUP");
			}
			if (events & POLLERR || events & POLLNVAL) {
			  polls.push(PHPWASM.awaitError(details.sock, details.ws));
			  lookingFor.push("POLLERR");
			}
			if (polls.length === 0) {
			  console.warn("Unsupported poll event " + events + ", defaulting to setTimeout().");
			  setTimeout(function() {
				wakeUp(0);
			  }, timeout);
			  return;
			}
			const promises = polls.map(([promise,]) => promise);
			const clearPolling = () => polls.forEach(([,clear]) => clear());
			
			let awaken = false;
			Promise.race(promises).then(function () {
			  // console.log("A promise won ("+lookingFor.join(', ')+")")
			  if (!awaken) {
				awaken = true;
				wakeUp(1);
				clearTimeout(timeoutId);
				clearPolling();
			  }
			});
			
			const timeoutId = setTimeout(function() {
			  // console.log("A timeout won ("+lookingFor.join(', ')+")")
			  if (!awaken) {
				awaken = true;
				wakeUp(0);
				clearPolling();
			  }
			}, timeout);
		});
	},
	wasm_setsockopt: function (socketd, level, optionName, optionValuePtr, optionLen) {
		const optionValue = HEAPU8[optionValuePtr];
		const SOL_SOCKET = 1;
		const SO_KEEPALIVE = 9;
		const IPPROTO_TCP = 6;
		const TCP_NODELAY = 1;
		const isSupported = level === SOL_SOCKET && optionName === SO_KEEPALIVE || level === IPPROTO_TCP && optionName === TCP_NODELAY;
		if (!isSupported) {
		  console.warn(`Unsupported socket option: ${level}, ${optionName}, ${optionValue}`);
		  return -1;
		}
		const peer = Object.values(getSocketFromFD(socketd).peers)[0];
		peer.socket.setSocketOpt(level, optionName, optionValuePtr);
		return optionValue;
	},
	js_popen_to_file: function (command, mode, exitCodePtr) {
		// Parse args
		if (!command) return 1; // shell is available

		const cmdstr = UTF8ToString(command);
		if (!cmdstr.length) return 0; // this is what glibc seems to do (shell works test?)

		const modestr = UTF8ToString(mode);
		if (!modestr.length) return 0; // this is what glibc seems to do (shell works test?)
        
        if(Module['popen_to_file']) {
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
                stdio: ["inherit", "pipe", "inherit"],
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
			console.error('invalid mode ' + modestr + ' (should be r or w)');
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
};

autoAddDeps(LibraryExample, '$PHPWASM');
mergeInto(LibraryManager.library, LibraryExample);
