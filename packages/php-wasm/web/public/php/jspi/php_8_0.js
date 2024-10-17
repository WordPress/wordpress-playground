import dependencyFilename from './8_0_30/php_8_0.wasm';
export { dependencyFilename };
export const dependenciesTotalSize = 12391314;
export function init(RuntimeName, PHPLoader) {
	/**
	 * Overrides Emscripten's default ExitStatus object which gets
	 * thrown on failure. Unfortunately, the default object is not
	 * a subclass of Error and does not provide any stack trace.
	 *
	 * This is a deliberate behavior on Emscripten's end to prevent
	 * memory leaks after the program exits. See:
	 *
	 * https://github.com/emscripten-core/emscripten/pull/9108
	 *
	 * In case of WordPress Playground, the worker in which the PHP
	 * runs will typically exit after the PHP program finishes, so
	 * we don't have to worry about memory leaks.
	 *
	 * As for assigning to a previously undeclared ExitStatus variable here,
	 * the Emscripten module declares `ExitStatus` as `function ExitStatus`
	 * which means it gets hoisted to the top of the scope and can be
	 * reassigned here – before the actual declaration is reached.
	 *
	 * If that sounds weird, try this example:
	 *
	 * ExitStatus = () => { console.log("reassigned"); }
	 * function ExitStatus() {}
	 * ExitStatus();
	 * // logs "reassigned"
	 */
	ExitStatus = class PHPExitStatus extends Error {
		constructor(status) {
			super(status);
			this.name = 'ExitStatus';
			this.message = 'Program terminated with exit(' + status + ')';
			this.status = status;
		}
	};

	// The rest of the code comes from the built php.js file and esm-suffix.js
	var Module = typeof PHPLoader != 'undefined' ? PHPLoader : {};
	var ENVIRONMENT_IS_WEB = RuntimeName === 'WEB';
	var ENVIRONMENT_IS_WORKER = RuntimeName === 'WORKER';
	var ENVIRONMENT_IS_NODE = RuntimeName === 'NODE';
	var moduleOverrides = Object.assign({}, Module);
	var arguments_ = [];
	var thisProgram = './this.program';
	var quit_ = (status, toThrow) => {
		throw toThrow;
	};
	var scriptDirectory = '';
	function locateFile(path) {
		if (Module['locateFile']) {
			return Module['locateFile'](path, scriptDirectory);
		}
		return scriptDirectory + path;
	}
	var read_, readAsync, readBinary;
	if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
		if (ENVIRONMENT_IS_WORKER) {
			scriptDirectory = self.location.href;
		} else if (typeof document != 'undefined' && document.currentScript) {
			scriptDirectory = document.currentScript.src;
		}
		if (scriptDirectory.startsWith('blob:')) {
			scriptDirectory = '';
		} else {
			scriptDirectory = scriptDirectory.substr(
				0,
				scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1
			);
		}
		{
			read_ = (url) => {
				var xhr = new XMLHttpRequest();
				xhr.open('GET', url, false);
				xhr.send(null);
				return xhr.responseText;
			};
			if (ENVIRONMENT_IS_WORKER) {
				readBinary = (url) => {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', url, false);
					xhr.responseType = 'arraybuffer';
					xhr.send(null);
					return new Uint8Array(xhr.response);
				};
			}
			readAsync = (url, onload, onerror) => {
				fetch(url, { credentials: 'same-origin' })
					.then((response) => {
						if (response.ok) {
							return response.arrayBuffer();
						}
						return Promise.reject(
							new Error(response.status + ' : ' + response.url)
						);
					})
					.then(onload, onerror);
			};
		}
	} else {
	}
	var out = Module['print'] || console.log.bind(console);
	var err = Module['printErr'] || console.error.bind(console);
	Object.assign(Module, moduleOverrides);
	moduleOverrides = null;
	if (Module['arguments']) arguments_ = Module['arguments'];
	if (Module['thisProgram']) thisProgram = Module['thisProgram'];
	if (Module['quit']) quit_ = Module['quit'];
	var wasmBinary;
	if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
	var wasmMemory;
	var ABORT = false;
	var EXITSTATUS;
	function assert(condition, text) {
		if (!condition) {
			abort(text);
		}
	}
	var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
	function updateMemoryViews() {
		var b = wasmMemory.buffer;
		Module['HEAP8'] = HEAP8 = new Int8Array(b);
		Module['HEAP16'] = HEAP16 = new Int16Array(b);
		Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
		Module['HEAPU16'] = HEAPU16 = new Uint16Array(b);
		Module['HEAP32'] = HEAP32 = new Int32Array(b);
		Module['HEAPU32'] = HEAPU32 = new Uint32Array(b);
		Module['HEAPF32'] = HEAPF32 = new Float32Array(b);
		Module['HEAPF64'] = HEAPF64 = new Float64Array(b);
	}
	var __ATPRERUN__ = [];
	var __ATINIT__ = [];
	var __ATEXIT__ = [];
	var __ATPOSTRUN__ = [];
	var runtimeInitialized = false;
	var runtimeExited = false;
	function preRun() {
		if (Module['preRun']) {
			if (typeof Module['preRun'] == 'function')
				Module['preRun'] = [Module['preRun']];
			while (Module['preRun'].length) {
				addOnPreRun(Module['preRun'].shift());
			}
		}
		callRuntimeCallbacks(__ATPRERUN__);
	}
	function initRuntime() {
		runtimeInitialized = true;
		callRuntimeCallbacks(__ATINIT__);
	}
	function exitRuntime() {
		___funcs_on_exit();
		callRuntimeCallbacks(__ATEXIT__);
		runtimeExited = true;
	}
	function postRun() {
		if (Module['postRun']) {
			if (typeof Module['postRun'] == 'function')
				Module['postRun'] = [Module['postRun']];
			while (Module['postRun'].length) {
				addOnPostRun(Module['postRun'].shift());
			}
		}
		callRuntimeCallbacks(__ATPOSTRUN__);
	}
	function addOnPreRun(cb) {
		__ATPRERUN__.unshift(cb);
	}
	function addOnInit(cb) {
		__ATINIT__.unshift(cb);
	}
	function addOnPostRun(cb) {
		__ATPOSTRUN__.unshift(cb);
	}
	var runDependencies = 0;
	var runDependencyWatcher = null;
	var dependenciesFulfilled = null;
	function getUniqueRunDependency(id) {
		return id;
	}
	function addRunDependency(id) {
		runDependencies++;
		Module['monitorRunDependencies']?.(runDependencies);
	}
	function removeRunDependency(id) {
		runDependencies--;
		Module['monitorRunDependencies']?.(runDependencies);
		if (runDependencies == 0) {
			if (runDependencyWatcher !== null) {
				clearInterval(runDependencyWatcher);
				runDependencyWatcher = null;
			}
			if (dependenciesFulfilled) {
				var callback = dependenciesFulfilled;
				dependenciesFulfilled = null;
				callback();
			}
		}
	}
	function abort(what) {
		Module['onAbort']?.(what);
		what = 'Aborted(' + what + ')';
		err(what);
		ABORT = true;
		EXITSTATUS = 1;
		what += '. Build with -sASSERTIONS for more info.';
		if (runtimeInitialized) {
			___trap();
		}
		var e = new WebAssembly.RuntimeError(what);
		throw e;
	}
	var dataURIPrefix = 'data:application/octet-stream;base64,';
	var isDataURI = (filename) => filename.startsWith(dataURIPrefix);
	function findWasmBinary() {
		var f = dependencyFilename;
		if (!isDataURI(f)) {
			return locateFile(f);
		}
		return f;
	}
	var wasmBinaryFile;
	function getBinarySync(file) {
		if (file == wasmBinaryFile && wasmBinary) {
			return new Uint8Array(wasmBinary);
		}
		if (readBinary) {
			return readBinary(file);
		}
		throw 'both async and sync fetching of the wasm failed';
	}
	function getBinaryPromise(binaryFile) {
		if (!wasmBinary) {
			return new Promise((resolve, reject) => {
				readAsync(
					binaryFile,
					(response) => resolve(new Uint8Array(response)),
					(error) => {
						try {
							resolve(getBinarySync(binaryFile));
						} catch (e) {
							reject(e);
						}
					}
				);
			});
		}
		return Promise.resolve().then(() => getBinarySync(binaryFile));
	}
	function instantiateArrayBuffer(binaryFile, imports, receiver) {
		return getBinaryPromise(binaryFile)
			.then((binary) => WebAssembly.instantiate(binary, imports))
			.then(receiver, (reason) => {
				err(`failed to asynchronously prepare wasm: ${reason}`);
				abort(reason);
			});
	}
	function instantiateAsync(binary, binaryFile, imports, callback) {
		if (
			!binary &&
			typeof WebAssembly.instantiateStreaming == 'function' &&
			!isDataURI(binaryFile) &&
			typeof fetch == 'function'
		) {
			return fetch(binaryFile, { credentials: 'same-origin' }).then(
				(response) => {
					var result = WebAssembly.instantiateStreaming(
						response,
						imports
					);
					return result.then(callback, function (reason) {
						err(`wasm streaming compile failed: ${reason}`);
						err('falling back to ArrayBuffer instantiation');
						return instantiateArrayBuffer(
							binaryFile,
							imports,
							callback
						);
					});
				}
			);
		}
		return instantiateArrayBuffer(binaryFile, imports, callback);
	}
	function getWasmImports() {
		Asyncify.instrumentWasmImports(wasmImports);
		return { env: wasmImports, wasi_snapshot_preview1: wasmImports };
	}
	function createWasm() {
		var info = getWasmImports();
		function receiveInstance(instance, module) {
			wasmExports = instance.exports;
			wasmExports = Asyncify.instrumentWasmExports(wasmExports);
			Module['wasmExports'] = wasmExports;
			wasmMemory = wasmExports['memory'];
			updateMemoryViews();
			wasmTable = wasmExports['__indirect_function_table'];
			addOnInit(wasmExports['__wasm_call_ctors']);
			removeRunDependency('wasm-instantiate');
			return wasmExports;
		}
		addRunDependency('wasm-instantiate');
		function receiveInstantiationResult(result) {
			receiveInstance(result['instance']);
		}
		if (Module['instantiateWasm']) {
			try {
				return Module['instantiateWasm'](info, receiveInstance);
			} catch (e) {
				err(`Module.instantiateWasm callback failed with error: ${e}`);
				return false;
			}
		}
		if (!wasmBinaryFile) wasmBinaryFile = findWasmBinary();
		instantiateAsync(
			wasmBinary,
			wasmBinaryFile,
			info,
			receiveInstantiationResult
		);
		return {};
	}
	var tempDouble;
	var tempI64;
	function __asyncjs__js_popen_to_file(command, mode, exitCodePtr) {
		return Asyncify.handleAsync(async () => {
			const returnCallback = (resolver) => new Promise(resolver);
			if (!command) return 1;
			const cmdstr = UTF8ToString(command);
			if (!cmdstr.length) return 0;
			const modestr = UTF8ToString(mode);
			if (!modestr.length) return 0;
			if (modestr === 'w') {
				console.error('popen($cmd, "w") is not implemented yet');
			}
			return returnCallback(async (wakeUp) => {
				let cp;
				try {
					cp = PHPWASM.spawnProcess(cmdstr, []);
					if (cp instanceof Promise) {
						cp = await cp;
					}
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
					const outBytes = new Uint8Array(
						outByteArrays.reduce(
							(acc, curr) => acc + curr.length,
							0
						)
					);
					let offset = 0;
					for (const byteArray of outByteArrays) {
						outBytes.set(byteArray, offset);
						offset += byteArray.length;
					}
					FS.writeFile(outputPath, outBytes);
					HEAPU8[exitCodePtr] = exitCode;
					wakeUp(allocateUTF8OnStack(outputPath));
				});
			});
		});
	}
	__asyncjs__js_popen_to_file.sig = 'iiii';
	function __asyncjs__wasm_poll_socket(socketd, events, timeout) {
		return Asyncify.handleAsync(async () => {
			const returnCallback = (resolver) => new Promise(resolver);
			const POLLIN = 1;
			const POLLPRI = 2;
			const POLLOUT = 4;
			const POLLERR = 8;
			const POLLHUP = 16;
			const POLLNVAL = 32;
			return returnCallback((wakeUp) => {
				const polls = [];
				if (socketd in PHPWASM.child_proc_by_fd) {
					const procInfo = PHPWASM.child_proc_by_fd[socketd];
					if (procInfo.exited) {
						wakeUp(0);
						return;
					}
					polls.push(PHPWASM.awaitEvent(procInfo.stdout, 'data'));
				} else if (FS.isSocket(FS.getStream(socketd)?.node.mode)) {
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
				} else {
					setTimeout(function () {
						wakeUp(1);
					}, timeout);
					return;
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
				const clearPolling = () =>
					polls.forEach(([, clear]) => clear());
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
		});
	}
	__asyncjs__wasm_poll_socket.sig = 'iiii';
	function __asyncjs__js_module_onMessage(data, response_buffer) {
		return Asyncify.handleAsync(async () => {
			if (Module['onMessage']) {
				const dataStr = UTF8ToString(data);
				return Module['onMessage'](dataStr)
					.then((response) => {
						const responseBytes =
							typeof response === 'string'
								? new TextEncoder().encode(response)
								: response;
						const responseSize = responseBytes.byteLength;
						const responsePtr = _malloc(responseSize + 1);
						HEAPU8.set(responseBytes, responsePtr);
						HEAPU8[responsePtr + responseSize] = 0;
						HEAPU8[response_buffer] = responsePtr;
						HEAPU8[response_buffer + 1] = responsePtr >> 8;
						HEAPU8[response_buffer + 2] = responsePtr >> 16;
						HEAPU8[response_buffer + 3] = responsePtr >> 24;
						return responseSize;
					})
					.catch((e) => {
						console.error(e);
						return -1;
					});
			}
		});
	}
	__asyncjs__js_module_onMessage.sig = 'iii';
	function ExitStatus(status) {
		this.name = 'ExitStatus';
		this.message = `Program terminated with exit(${status})`;
		this.status = status;
	}
	var callRuntimeCallbacks = (callbacks) => {
		while (callbacks.length > 0) {
			callbacks.shift()(Module);
		}
	};
	var noExitRuntime = Module['noExitRuntime'] || false;
	function _SharpYuvConvert() {
		abort('missing function: SharpYuvConvert');
	}
	_SharpYuvConvert.stub = true;
	function _SharpYuvGetConversionMatrix() {
		abort('missing function: SharpYuvGetConversionMatrix');
	}
	_SharpYuvGetConversionMatrix.stub = true;
	function _SharpYuvInit() {
		abort('missing function: SharpYuvInit');
	}
	_SharpYuvInit.stub = true;
	var UTF8Decoder =
		typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;
	var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
		var endIdx = idx + maxBytesToRead;
		var endPtr = idx;
		while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
		if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
			return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
		}
		var str = '';
		while (idx < endPtr) {
			var u0 = heapOrArray[idx++];
			if (!(u0 & 128)) {
				str += String.fromCharCode(u0);
				continue;
			}
			var u1 = heapOrArray[idx++] & 63;
			if ((u0 & 224) == 192) {
				str += String.fromCharCode(((u0 & 31) << 6) | u1);
				continue;
			}
			var u2 = heapOrArray[idx++] & 63;
			if ((u0 & 240) == 224) {
				u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
			} else {
				u0 =
					((u0 & 7) << 18) |
					(u1 << 12) |
					(u2 << 6) |
					(heapOrArray[idx++] & 63);
			}
			if (u0 < 65536) {
				str += String.fromCharCode(u0);
			} else {
				var ch = u0 - 65536;
				str += String.fromCharCode(
					55296 | (ch >> 10),
					56320 | (ch & 1023)
				);
			}
		}
		return str;
	};
	var UTF8ToString = (ptr, maxBytesToRead) =>
		ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
	Module['UTF8ToString'] = UTF8ToString;
	var ___assert_fail = (condition, filename, line, func) => {
		abort(
			`Assertion failed: ${UTF8ToString(condition)}, at: ` +
				[
					filename ? UTF8ToString(filename) : 'unknown filename',
					line,
					func ? UTF8ToString(func) : 'unknown function',
				]
		);
	};
	var wasmTableMirror = [];
	var wasmTable;
	var getWasmTableEntry = (funcPtr) => {
		var func = wasmTableMirror[funcPtr];
		if (!func) {
			if (funcPtr >= wasmTableMirror.length)
				wasmTableMirror.length = funcPtr + 1;
			wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
			if (Asyncify.isAsyncExport(func)) {
				wasmTableMirror[funcPtr] = func =
					Asyncify.makeAsyncFunction(func);
			}
		}
		return func;
	};
	var ___call_sighandler = (fp, sig) => getWasmTableEntry(fp)(sig);
	var __abort_js = () => {
		abort('');
	};
	var nowIsMonotonic = 1;
	var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;
	var inetPton4 = (str) => {
		var b = str.split('.');
		for (var i = 0; i < 4; i++) {
			var tmp = Number(b[i]);
			if (isNaN(tmp)) return null;
			b[i] = tmp;
		}
		return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
	};
	var jstoi_q = (str) => parseInt(str);
	var inetPton6 = (str) => {
		var words;
		var w, offset, z;
		var valid6regx =
			/^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
		var parts = [];
		if (!valid6regx.test(str)) {
			return null;
		}
		if (str === '::') {
			return [0, 0, 0, 0, 0, 0, 0, 0];
		}
		if (str.startsWith('::')) {
			str = str.replace('::', 'Z:');
		} else {
			str = str.replace('::', ':Z:');
		}
		if (str.indexOf('.') > 0) {
			str = str.replace(new RegExp('[.]', 'g'), ':');
			words = str.split(':');
			words[words.length - 4] =
				jstoi_q(words[words.length - 4]) +
				jstoi_q(words[words.length - 3]) * 256;
			words[words.length - 3] =
				jstoi_q(words[words.length - 2]) +
				jstoi_q(words[words.length - 1]) * 256;
			words = words.slice(0, words.length - 2);
		} else {
			words = str.split(':');
		}
		offset = 0;
		z = 0;
		for (w = 0; w < words.length; w++) {
			if (typeof words[w] == 'string') {
				if (words[w] === 'Z') {
					for (z = 0; z < 8 - words.length + 1; z++) {
						parts[w + z] = 0;
					}
					offset = z - 1;
				} else {
					parts[w + offset] = _htons(parseInt(words[w], 16));
				}
			} else {
				parts[w + offset] = words[w];
			}
		}
		return [
			(parts[1] << 16) | parts[0],
			(parts[3] << 16) | parts[2],
			(parts[5] << 16) | parts[4],
			(parts[7] << 16) | parts[6],
		];
	};
	var DNS = {
		address_map: { id: 1, addrs: {}, names: {} },
		lookup_name(name) {
			var res = inetPton4(name);
			if (res !== null) {
				return name;
			}
			res = inetPton6(name);
			if (res !== null) {
				return name;
			}
			var addr;
			if (DNS.address_map.addrs[name]) {
				addr = DNS.address_map.addrs[name];
			} else {
				var id = DNS.address_map.id++;
				assert(id < 65535, 'exceeded max address mappings of 65535');
				addr = '172.29.' + (id & 255) + '.' + (id & 65280);
				DNS.address_map.names[addr] = name;
				DNS.address_map.addrs[name] = addr;
			}
			return addr;
		},
		lookup_addr(addr) {
			if (DNS.address_map.names[addr]) {
				return DNS.address_map.names[addr];
			}
			return null;
		},
	};
	var __emscripten_lookup_name = (name) => {
		var nameString = UTF8ToString(name);
		return inetPton4(DNS.lookup_name(nameString));
	};
	var __emscripten_memcpy_js = (dest, src, num) =>
		HEAPU8.copyWithin(dest, src, src + num);
	var __emscripten_runtime_keepalive_clear = () => {
		noExitRuntime = false;
		runtimeKeepaliveCounter = 0;
	};
	var convertI32PairToI53Checked = (lo, hi) =>
		(hi + 2097152) >>> 0 < 4194305 - !!lo
			? (lo >>> 0) + hi * 4294967296
			: NaN;
	function __gmtime_js(time_low, time_high, tmPtr) {
		var time = convertI32PairToI53Checked(time_low, time_high);
		var date = new Date(time * 1e3);
		HEAP32[tmPtr >> 2] = date.getUTCSeconds();
		HEAP32[(tmPtr + 4) >> 2] = date.getUTCMinutes();
		HEAP32[(tmPtr + 8) >> 2] = date.getUTCHours();
		HEAP32[(tmPtr + 12) >> 2] = date.getUTCDate();
		HEAP32[(tmPtr + 16) >> 2] = date.getUTCMonth();
		HEAP32[(tmPtr + 20) >> 2] = date.getUTCFullYear() - 1900;
		HEAP32[(tmPtr + 24) >> 2] = date.getUTCDay();
		var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
		var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
		HEAP32[(tmPtr + 28) >> 2] = yday;
	}
	var isLeapYear = (year) =>
		year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	var MONTH_DAYS_LEAP_CUMULATIVE = [
		0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335,
	];
	var MONTH_DAYS_REGULAR_CUMULATIVE = [
		0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
	];
	var ydayFromDate = (date) => {
		var leap = isLeapYear(date.getFullYear());
		var monthDaysCumulative = leap
			? MONTH_DAYS_LEAP_CUMULATIVE
			: MONTH_DAYS_REGULAR_CUMULATIVE;
		var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
		return yday;
	};
	function __localtime_js(time_low, time_high, tmPtr) {
		var time = convertI32PairToI53Checked(time_low, time_high);
		var date = new Date(time * 1e3);
		HEAP32[tmPtr >> 2] = date.getSeconds();
		HEAP32[(tmPtr + 4) >> 2] = date.getMinutes();
		HEAP32[(tmPtr + 8) >> 2] = date.getHours();
		HEAP32[(tmPtr + 12) >> 2] = date.getDate();
		HEAP32[(tmPtr + 16) >> 2] = date.getMonth();
		HEAP32[(tmPtr + 20) >> 2] = date.getFullYear() - 1900;
		HEAP32[(tmPtr + 24) >> 2] = date.getDay();
		var yday = ydayFromDate(date) | 0;
		HEAP32[(tmPtr + 28) >> 2] = yday;
		HEAP32[(tmPtr + 36) >> 2] = -(date.getTimezoneOffset() * 60);
		var start = new Date(date.getFullYear(), 0, 1);
		var summerOffset = new Date(
			date.getFullYear(),
			6,
			1
		).getTimezoneOffset();
		var winterOffset = start.getTimezoneOffset();
		var dst =
			(summerOffset != winterOffset &&
				date.getTimezoneOffset() ==
					Math.min(winterOffset, summerOffset)) | 0;
		HEAP32[(tmPtr + 32) >> 2] = dst;
	}
	var setTempRet0 = (val) => __emscripten_tempret_set(val);
	var __mktime_js = function (tmPtr) {
		var ret = (() => {
			var date = new Date(
				HEAP32[(tmPtr + 20) >> 2] + 1900,
				HEAP32[(tmPtr + 16) >> 2],
				HEAP32[(tmPtr + 12) >> 2],
				HEAP32[(tmPtr + 8) >> 2],
				HEAP32[(tmPtr + 4) >> 2],
				HEAP32[tmPtr >> 2],
				0
			);
			var dst = HEAP32[(tmPtr + 32) >> 2];
			var guessedOffset = date.getTimezoneOffset();
			var start = new Date(date.getFullYear(), 0, 1);
			var summerOffset = new Date(
				date.getFullYear(),
				6,
				1
			).getTimezoneOffset();
			var winterOffset = start.getTimezoneOffset();
			var dstOffset = Math.min(winterOffset, summerOffset);
			if (dst < 0) {
				HEAP32[(tmPtr + 32) >> 2] = Number(
					summerOffset != winterOffset && dstOffset == guessedOffset
				);
			} else if (dst > 0 != (dstOffset == guessedOffset)) {
				var nonDstOffset = Math.max(winterOffset, summerOffset);
				var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
				date.setTime(
					date.getTime() + (trueOffset - guessedOffset) * 6e4
				);
			}
			HEAP32[(tmPtr + 24) >> 2] = date.getDay();
			var yday = ydayFromDate(date) | 0;
			HEAP32[(tmPtr + 28) >> 2] = yday;
			HEAP32[tmPtr >> 2] = date.getSeconds();
			HEAP32[(tmPtr + 4) >> 2] = date.getMinutes();
			HEAP32[(tmPtr + 8) >> 2] = date.getHours();
			HEAP32[(tmPtr + 12) >> 2] = date.getDate();
			HEAP32[(tmPtr + 16) >> 2] = date.getMonth();
			HEAP32[(tmPtr + 20) >> 2] = date.getYear();
			var timeMs = date.getTime();
			if (isNaN(timeMs)) {
				return -1;
			}
			return timeMs / 1e3;
		})();
		return (
			setTempRet0(
				((tempDouble = ret),
				+Math.abs(tempDouble) >= 1
					? tempDouble > 0
						? +Math.floor(tempDouble / 4294967296) >>> 0
						: ~~+Math.ceil(
								(tempDouble - +(~~tempDouble >>> 0)) /
									4294967296
						  ) >>> 0
					: 0)
			),
			ret >>> 0
		);
	};
	var timers = {};
	var handleException = (e) => {
		if (e instanceof ExitStatus || e == 'unwind') {
			return EXITSTATUS;
		}
		quit_(1, e);
	};
	var runtimeKeepaliveCounter = 0;
	var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
	var _proc_exit = (code) => {
		EXITSTATUS = code;
		if (!keepRuntimeAlive()) {
			Module['onExit']?.(code);
			ABORT = true;
		}
		quit_(code, new ExitStatus(code));
	};
	var exitJS = (status, implicit) => {
		EXITSTATUS = status;
		if (!keepRuntimeAlive()) {
			exitRuntime();
		}
		_proc_exit(status);
	};
	var _exit = exitJS;
	Module['_exit'] = _exit;
	var maybeExit = () => {
		if (runtimeExited) {
			return;
		}
		if (!keepRuntimeAlive()) {
			try {
				_exit(EXITSTATUS);
			} catch (e) {
				handleException(e);
			}
		}
	};
	var callUserCallback = (func) => {
		if (runtimeExited || ABORT) {
			return;
		}
		try {
			func();
			maybeExit();
		} catch (e) {
			handleException(e);
		}
	};
	var _emscripten_get_now;
	_emscripten_get_now = () => performance.now();
	var __setitimer_js = (which, timeout_ms) => {
		if (timers[which]) {
			clearTimeout(timers[which].id);
			delete timers[which];
		}
		if (!timeout_ms) return 0;
		var id = setTimeout(() => {
			delete timers[which];
			callUserCallback(() =>
				__emscripten_timeout(which, _emscripten_get_now())
			);
		}, timeout_ms);
		timers[which] = { id: id, timeout_ms: timeout_ms };
		return 0;
	};
	var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
		if (!(maxBytesToWrite > 0)) return 0;
		var startIdx = outIdx;
		var endIdx = outIdx + maxBytesToWrite - 1;
		for (var i = 0; i < str.length; ++i) {
			var u = str.charCodeAt(i);
			if (u >= 55296 && u <= 57343) {
				var u1 = str.charCodeAt(++i);
				u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
			}
			if (u <= 127) {
				if (outIdx >= endIdx) break;
				heap[outIdx++] = u;
			} else if (u <= 2047) {
				if (outIdx + 1 >= endIdx) break;
				heap[outIdx++] = 192 | (u >> 6);
				heap[outIdx++] = 128 | (u & 63);
			} else if (u <= 65535) {
				if (outIdx + 2 >= endIdx) break;
				heap[outIdx++] = 224 | (u >> 12);
				heap[outIdx++] = 128 | ((u >> 6) & 63);
				heap[outIdx++] = 128 | (u & 63);
			} else {
				if (outIdx + 3 >= endIdx) break;
				heap[outIdx++] = 240 | (u >> 18);
				heap[outIdx++] = 128 | ((u >> 12) & 63);
				heap[outIdx++] = 128 | ((u >> 6) & 63);
				heap[outIdx++] = 128 | (u & 63);
			}
		}
		heap[outIdx] = 0;
		return outIdx - startIdx;
	};
	var stringToUTF8 = (str, outPtr, maxBytesToWrite) =>
		stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
	Module['stringToUTF8'] = stringToUTF8;
	var __tzset_js = (timezone, daylight, std_name, dst_name) => {
		var currentYear = new Date().getFullYear();
		var winter = new Date(currentYear, 0, 1);
		var summer = new Date(currentYear, 6, 1);
		var winterOffset = winter.getTimezoneOffset();
		var summerOffset = summer.getTimezoneOffset();
		var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
		HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;
		HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
		var extractZone = (date) =>
			date
				.toLocaleTimeString(undefined, {
					hour12: false,
					timeZoneName: 'short',
				})
				.split(' ')[1];
		var winterName = extractZone(winter);
		var summerName = extractZone(summer);
		if (summerOffset < winterOffset) {
			stringToUTF8(winterName, std_name, 17);
			stringToUTF8(summerName, dst_name, 17);
		} else {
			stringToUTF8(winterName, dst_name, 17);
			stringToUTF8(summerName, std_name, 17);
		}
	};
	var __wasmfs_copy_preloaded_file_data = (index, buffer) =>
		HEAPU8.set(wasmFSPreloadedFiles[index].fileData, buffer);
	var wasmFSPreloadedDirs = [];
	var __wasmfs_get_num_preloaded_dirs = () => wasmFSPreloadedDirs.length;
	var wasmFSPreloadedFiles = [];
	var wasmFSPreloadingFlushed = false;
	var __wasmfs_get_num_preloaded_files = () => {
		wasmFSPreloadingFlushed = true;
		return wasmFSPreloadedFiles.length;
	};
	var __wasmfs_get_preloaded_child_path = (index, childNameBuffer) => {
		var s = wasmFSPreloadedDirs[index].childName;
		var len = lengthBytesUTF8(s) + 1;
		stringToUTF8(s, childNameBuffer, len);
	};
	var __wasmfs_get_preloaded_file_mode = (index) =>
		wasmFSPreloadedFiles[index].mode;
	var __wasmfs_get_preloaded_file_size = (index) =>
		wasmFSPreloadedFiles[index].fileData.length;
	var __wasmfs_get_preloaded_parent_path = (index, parentPathBuffer) => {
		var s = wasmFSPreloadedDirs[index].parentPath;
		var len = lengthBytesUTF8(s) + 1;
		stringToUTF8(s, parentPathBuffer, len);
	};
	var lengthBytesUTF8 = (str) => {
		var len = 0;
		for (var i = 0; i < str.length; ++i) {
			var c = str.charCodeAt(i);
			if (c <= 127) {
				len++;
			} else if (c <= 2047) {
				len += 2;
			} else if (c >= 55296 && c <= 57343) {
				len += 4;
				++i;
			} else {
				len += 3;
			}
		}
		return len;
	};
	Module['lengthBytesUTF8'] = lengthBytesUTF8;
	var __wasmfs_get_preloaded_path_name = (index, fileNameBuffer) => {
		var s = wasmFSPreloadedFiles[index].pathName;
		var len = lengthBytesUTF8(s) + 1;
		stringToUTF8(s, fileNameBuffer, len);
	};
	var __wasmfs_jsimpl_alloc_file = (backend, file) =>
		wasmFS$backends[backend].allocFile(file);
	var __wasmfs_jsimpl_free_file = (backend, file) =>
		wasmFS$backends[backend].freeFile(file);
	var __wasmfs_jsimpl_get_size = (backend, file) =>
		wasmFS$backends[backend].getSize(file);
	function __wasmfs_jsimpl_read(
		backend,
		file,
		buffer,
		length,
		offset_low,
		offset_high
	) {
		var offset = convertI32PairToI53Checked(offset_low, offset_high);
		if (!wasmFS$backends[backend].read) {
			return -28;
		}
		return wasmFS$backends[backend].read(file, buffer, length, offset);
	}
	function __wasmfs_jsimpl_write(
		backend,
		file,
		buffer,
		length,
		offset_low,
		offset_high
	) {
		var offset = convertI32PairToI53Checked(offset_low, offset_high);
		if (!wasmFS$backends[backend].write) {
			return -28;
		}
		return wasmFS$backends[backend].write(file, buffer, length, offset);
	}
	class HandleAllocator {
		constructor() {
			this.allocated = [undefined];
			this.freelist = [];
		}
		get(id) {
			return this.allocated[id];
		}
		has(id) {
			return this.allocated[id] !== undefined;
		}
		allocate(handle) {
			var id = this.freelist.pop() || this.allocated.length;
			this.allocated[id] = handle;
			return id;
		}
		free(id) {
			this.allocated[id] = undefined;
			this.freelist.push(id);
		}
	}
	var wasmfsOPFSAccessHandles = new HandleAllocator();
	var wasmfsOPFSProxyFinish = (ctx) => {};
	async function __wasmfs_opfs_close_access(ctx, accessID, errPtr) {
		let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
		try {
			await accessHandle.close();
		} catch {
			let err = -29;
			HEAP32[errPtr >> 2] = err;
		}
		wasmfsOPFSAccessHandles.free(accessID);
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_close_access.isAsync = true;
	var wasmfsOPFSBlobs = new HandleAllocator();
	var __wasmfs_opfs_close_blob = (blobID) => {
		wasmfsOPFSBlobs.free(blobID);
	};
	async function __wasmfs_opfs_flush_access(ctx, accessID, errPtr) {
		let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
		try {
			await accessHandle.flush();
		} catch {
			let err = -29;
			HEAP32[errPtr >> 2] = err;
		}
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_flush_access.isAsync = true;
	var wasmfsOPFSDirectoryHandles = new HandleAllocator();
	var __wasmfs_opfs_free_directory = (dirID) => {
		wasmfsOPFSDirectoryHandles.free(dirID);
	};
	var wasmfsOPFSFileHandles = new HandleAllocator();
	var __wasmfs_opfs_free_file = (fileID) => {
		wasmfsOPFSFileHandles.free(fileID);
	};
	async function wasmfsOPFSGetOrCreateFile(parent, name, create) {
		let parentHandle = wasmfsOPFSDirectoryHandles.get(parent);
		let fileHandle;
		try {
			fileHandle = await parentHandle.getFileHandle(name, {
				create: create,
			});
		} catch (e) {
			if (e.name === 'NotFoundError') {
				return -20;
			}
			if (e.name === 'TypeMismatchError') {
				return -31;
			}
			return -29;
		}
		return wasmfsOPFSFileHandles.allocate(fileHandle);
	}
	wasmfsOPFSGetOrCreateFile.isAsync = true;
	async function wasmfsOPFSGetOrCreateDir(parent, name, create) {
		let parentHandle = wasmfsOPFSDirectoryHandles.get(parent);
		let childHandle;
		try {
			childHandle = await parentHandle.getDirectoryHandle(name, {
				create: create,
			});
		} catch (e) {
			if (e.name === 'NotFoundError') {
				return -20;
			}
			if (e.name === 'TypeMismatchError') {
				return -54;
			}
			return -29;
		}
		return wasmfsOPFSDirectoryHandles.allocate(childHandle);
	}
	wasmfsOPFSGetOrCreateDir.isAsync = true;
	async function __wasmfs_opfs_get_child(
		ctx,
		parent,
		namePtr,
		childTypePtr,
		childIDPtr
	) {
		let name = UTF8ToString(namePtr);
		let childType = 1;
		let childID = await wasmfsOPFSGetOrCreateFile(parent, name, false);
		if (childID == -31) {
			childType = 2;
			childID = await wasmfsOPFSGetOrCreateDir(parent, name, false);
		}
		HEAP32[childTypePtr >> 2] = childType;
		HEAP32[childIDPtr >> 2] = childID;
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_get_child.isAsync = true;
	var stackSave = () => _emscripten_stack_get_current();
	var stackRestore = (val) => __emscripten_stack_restore(val);
	async function __wasmfs_opfs_get_entries(ctx, dirID, entriesPtr, errPtr) {
		let dirHandle = wasmfsOPFSDirectoryHandles.get(dirID);
		try {
			let iter = dirHandle.entries();
			for (let entry; (entry = await iter.next()), !entry.done; ) {
				let [name, child] = entry.value;
				let sp = stackSave();
				let namePtr = stringToUTF8OnStack(name);
				let type = child.kind == 'file' ? 1 : 2;
				__wasmfs_opfs_record_entry(entriesPtr, namePtr, type);
				stackRestore(sp);
			}
		} catch {
			let err = -29;
			HEAP32[errPtr >> 2] = err;
		}
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_get_entries.isAsync = true;
	async function __wasmfs_opfs_get_size_access(ctx, accessID, sizePtr) {
		let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
		let size;
		try {
			size = await accessHandle.getSize();
		} catch {
			size = -29;
		}
		(tempI64 = [
			size >>> 0,
			((tempDouble = size),
			+Math.abs(tempDouble) >= 1
				? tempDouble > 0
					? +Math.floor(tempDouble / 4294967296) >>> 0
					: ~~+Math.ceil(
							(tempDouble - +(~~tempDouble >>> 0)) / 4294967296
					  ) >>> 0
				: 0),
		]),
			(HEAP32[sizePtr >> 2] = tempI64[0]),
			(HEAP32[(sizePtr + 4) >> 2] = tempI64[1]);
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_get_size_access.isAsync = true;
	var __wasmfs_opfs_get_size_blob = (blobID) =>
		wasmfsOPFSBlobs.get(blobID).size;
	async function __wasmfs_opfs_get_size_file(ctx, fileID, sizePtr) {
		let fileHandle = wasmfsOPFSFileHandles.get(fileID);
		let size;
		try {
			size = (await fileHandle.getFile()).size;
		} catch {
			size = -29;
		}
		(tempI64 = [
			size >>> 0,
			((tempDouble = size),
			+Math.abs(tempDouble) >= 1
				? tempDouble > 0
					? +Math.floor(tempDouble / 4294967296) >>> 0
					: ~~+Math.ceil(
							(tempDouble - +(~~tempDouble >>> 0)) / 4294967296
					  ) >>> 0
				: 0),
		]),
			(HEAP32[sizePtr >> 2] = tempI64[0]),
			(HEAP32[(sizePtr + 4) >> 2] = tempI64[1]);
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_get_size_file.isAsync = true;
	async function __wasmfs_opfs_init_root_directory(ctx) {
		if (wasmfsOPFSDirectoryHandles.allocated.length == 1) {
			let root = await navigator.storage.getDirectory();
			wasmfsOPFSDirectoryHandles.allocated.push(root);
		}
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_init_root_directory.isAsync = true;
	async function __wasmfs_opfs_insert_directory(
		ctx,
		parent,
		namePtr,
		childIDPtr
	) {
		let name = UTF8ToString(namePtr);
		let childID = await wasmfsOPFSGetOrCreateDir(parent, name, true);
		HEAP32[childIDPtr >> 2] = childID;
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_insert_directory.isAsync = true;
	async function __wasmfs_opfs_insert_file(ctx, parent, namePtr, childIDPtr) {
		let name = UTF8ToString(namePtr);
		let childID = await wasmfsOPFSGetOrCreateFile(parent, name, true);
		HEAP32[childIDPtr >> 2] = childID;
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_insert_file.isAsync = true;
	async function __wasmfs_opfs_move_file(
		ctx,
		fileID,
		newParentID,
		namePtr,
		errPtr
	) {
		let name = UTF8ToString(namePtr);
		let fileHandle = wasmfsOPFSFileHandles.get(fileID);
		let newDirHandle = wasmfsOPFSDirectoryHandles.get(newParentID);
		try {
			await fileHandle.move(newDirHandle, name);
		} catch {
			let err = -29;
			HEAP32[errPtr >> 2] = err;
		}
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_move_file.isAsync = true;
	class FileSystemAsyncAccessHandle {
		constructor(handle) {
			this.handle = handle;
		}
		async close() {}
		async flush() {}
		async getSize() {
			let file = await this.handle.getFile();
			return file.size;
		}
		async read(buffer, options = { at: 0 }) {
			let file = await this.handle.getFile();
			let slice = await file.slice(
				options.at,
				options.at + buffer.length
			);
			let fileBuffer = await slice.arrayBuffer();
			let array = new Uint8Array(fileBuffer);
			buffer.set(array);
			return array.length;
		}
		async write(buffer, options = { at: 0 }) {
			let writable = await this.handle.createWritable({
				keepExistingData: true,
			});
			await writable.write({
				type: 'write',
				position: options.at,
				data: buffer,
			});
			await writable.close();
			return buffer.length;
		}
		async truncate(size) {
			let writable = await this.handle.createWritable({
				keepExistingData: true,
			});
			await writable.truncate(size);
			await writable.close();
		}
	}
	var wasmfsOPFSCreateAsyncAccessHandle = (fileHandle) =>
		new FileSystemAsyncAccessHandle(fileHandle);
	async function __wasmfs_opfs_open_access(ctx, fileID, accessIDPtr) {
		let fileHandle = wasmfsOPFSFileHandles.get(fileID);
		let accessID;
		try {
			let accessHandle;
			accessHandle = await wasmfsOPFSCreateAsyncAccessHandle(fileHandle);
			accessID = wasmfsOPFSAccessHandles.allocate(accessHandle);
		} catch (e) {
			if (
				e.name === 'InvalidStateError' ||
				e.name === 'NoModificationAllowedError'
			) {
				accessID = -2;
			} else {
				accessID = -29;
			}
		}
		HEAP32[accessIDPtr >> 2] = accessID;
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_open_access.isAsync = true;
	async function __wasmfs_opfs_open_blob(ctx, fileID, blobIDPtr) {
		let fileHandle = wasmfsOPFSFileHandles.get(fileID);
		let blobID;
		try {
			let blob = await fileHandle.getFile();
			blobID = wasmfsOPFSBlobs.allocate(blob);
		} catch (e) {
			if (e.name === 'NotAllowedError') {
				blobID = -2;
			} else {
				blobID = -29;
			}
		}
		HEAP32[blobIDPtr >> 2] = blobID;
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_open_blob.isAsync = true;
	async function __wasmfs_opfs_read_access(accessID, bufPtr, len, pos) {
		let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
		let data = HEAPU8.subarray(bufPtr, bufPtr + len);
		try {
			return await accessHandle.read(data, { at: pos });
		} catch (e) {
			if (e.name == 'TypeError') {
				return -28;
			}
			return -29;
		}
	}
	__wasmfs_opfs_read_access.isAsync = true;
	async function __wasmfs_opfs_read_blob(
		ctx,
		blobID,
		bufPtr,
		len,
		pos,
		nreadPtr
	) {
		let blob = wasmfsOPFSBlobs.get(blobID);
		let slice = blob.slice(pos, pos + len);
		let nread = 0;
		try {
			let buf = await slice.arrayBuffer();
			let data = new Uint8Array(buf);
			HEAPU8.set(data, bufPtr);
			nread += data.length;
		} catch (e) {
			if (e instanceof RangeError) {
				nread = -21;
			} else {
				nread = -29;
			}
		}
		HEAP32[nreadPtr >> 2] = nread;
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_read_blob.isAsync = true;
	async function __wasmfs_opfs_remove_child(ctx, dirID, namePtr, errPtr) {
		let name = UTF8ToString(namePtr);
		let dirHandle = wasmfsOPFSDirectoryHandles.get(dirID);
		try {
			await dirHandle.removeEntry(name);
		} catch {
			let err = -29;
			HEAP32[errPtr >> 2] = err;
		}
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_remove_child.isAsync = true;
	async function __wasmfs_opfs_set_size_access(
		ctx,
		accessID,
		size_low,
		size_high,
		errPtr
	) {
		var size = convertI32PairToI53Checked(size_low, size_high);
		let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
		try {
			await accessHandle.truncate(size);
		} catch {
			let err = -29;
			HEAP32[errPtr >> 2] = err;
		}
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_set_size_access.isAsync = true;
	async function __wasmfs_opfs_set_size_file(
		ctx,
		fileID,
		size_low,
		size_high,
		errPtr
	) {
		var size = convertI32PairToI53Checked(size_low, size_high);
		let fileHandle = wasmfsOPFSFileHandles.get(fileID);
		try {
			let writable = await fileHandle.createWritable({
				keepExistingData: true,
			});
			await writable.truncate(size);
			await writable.close();
		} catch {
			let err = -29;
			HEAP32[errPtr >> 2] = err;
		}
		wasmfsOPFSProxyFinish(ctx);
	}
	__wasmfs_opfs_set_size_file.isAsync = true;
	async function __wasmfs_opfs_write_access(accessID, bufPtr, len, pos) {
		let accessHandle = wasmfsOPFSAccessHandles.get(accessID);
		let data = HEAPU8.subarray(bufPtr, bufPtr + len);
		try {
			return await accessHandle.write(data, { at: pos });
		} catch (e) {
			if (e.name == 'TypeError') {
				return -28;
			}
			return -29;
		}
	}
	__wasmfs_opfs_write_access.isAsync = true;
	var FS_stdin_getChar_buffer = [];
	function intArrayFromString(stringy, dontAddNull, length) {
		var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
		var u8array = new Array(len);
		var numBytesWritten = stringToUTF8Array(
			stringy,
			u8array,
			0,
			u8array.length
		);
		if (dontAddNull) u8array.length = numBytesWritten;
		return u8array;
	}
	var FS_stdin_getChar = () => {
		if (!FS_stdin_getChar_buffer.length) {
			var result = null;
			if (
				typeof window != 'undefined' &&
				typeof window.prompt == 'function'
			) {
				result = window.prompt('Input: ');
				if (result !== null) {
					result += '\n';
				}
			} else {
			}
			if (!result) {
				return null;
			}
			FS_stdin_getChar_buffer = intArrayFromString(result, true);
		}
		return FS_stdin_getChar_buffer.shift();
	};
	var __wasmfs_stdin_get_char = () => {
		var c = FS_stdin_getChar();
		if (typeof c === 'number') {
			return c;
		}
		return -1;
	};
	var _emscripten_date_now = () => Date.now();
	var _emscripten_err = (str) => err(UTF8ToString(str));
	var getHeapMax = () => 2147483648;
	var _emscripten_get_heap_max = () => getHeapMax();
	var _emscripten_out = (str) => out(UTF8ToString(str));
	var growMemory = (size) => {
		var b = wasmMemory.buffer;
		var pages = (size - b.byteLength + 65535) / 65536;
		try {
			wasmMemory.grow(pages);
			updateMemoryViews();
			return 1;
		} catch (e) {}
	};
	var _emscripten_resize_heap = (requestedSize) => {
		var oldSize = HEAPU8.length;
		requestedSize >>>= 0;
		var maxHeapSize = getHeapMax();
		if (requestedSize > maxHeapSize) {
			return false;
		}
		var alignUp = (x, multiple) =>
			x + ((multiple - (x % multiple)) % multiple);
		for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
			var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
			overGrownHeapSize = Math.min(
				overGrownHeapSize,
				requestedSize + 100663296
			);
			var newSize = Math.min(
				maxHeapSize,
				alignUp(Math.max(requestedSize, overGrownHeapSize), 65536)
			);
			var replacement = growMemory(newSize);
			if (replacement) {
				return true;
			}
		}
		return false;
	};
	var runtimeKeepalivePush = () => {
		runtimeKeepaliveCounter += 1;
	};
	var runtimeKeepalivePop = () => {
		runtimeKeepaliveCounter -= 1;
	};
	var safeSetTimeout = (func, timeout) => {
		runtimeKeepalivePush();
		return setTimeout(() => {
			runtimeKeepalivePop();
			callUserCallback(func);
		}, timeout);
	};
	var _emscripten_sleep = (ms) =>
		Asyncify.handleSleep((wakeUp) => safeSetTimeout(wakeUp, ms));
	Module['_emscripten_sleep'] = _emscripten_sleep;
	_emscripten_sleep.isAsync = true;
	var ENV = PHPLoader.ENV || {};
	var getExecutableName = () => thisProgram || './this.program';
	var getEnvStrings = () => {
		if (!getEnvStrings.strings) {
			var lang =
				(
					(typeof navigator == 'object' &&
						navigator.languages &&
						navigator.languages[0]) ||
					'C'
				).replace('-', '_') + '.UTF-8';
			var env = {
				USER: 'web_user',
				LOGNAME: 'web_user',
				PATH: '/',
				PWD: '/',
				HOME: '/home/web_user',
				LANG: lang,
				_: getExecutableName(),
			};
			for (var x in ENV) {
				if (ENV[x] === undefined) delete env[x];
				else env[x] = ENV[x];
			}
			var strings = [];
			for (var x in env) {
				strings.push(`${x}=${env[x]}`);
			}
			getEnvStrings.strings = strings;
		}
		return getEnvStrings.strings;
	};
	var stringToAscii = (str, buffer) => {
		for (var i = 0; i < str.length; ++i) {
			HEAP8[buffer++] = str.charCodeAt(i);
		}
		HEAP8[buffer] = 0;
	};
	var _environ_get = (__environ, environ_buf) => {
		var bufSize = 0;
		getEnvStrings().forEach((string, i) => {
			var ptr = environ_buf + bufSize;
			HEAPU32[(__environ + i * 4) >> 2] = ptr;
			stringToAscii(string, ptr);
			bufSize += string.length + 1;
		});
		return 0;
	};
	var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
		var strings = getEnvStrings();
		HEAPU32[penviron_count >> 2] = strings.length;
		var bufSize = 0;
		strings.forEach((string) => (bufSize += string.length + 1));
		HEAPU32[penviron_buf_size >> 2] = bufSize;
		return 0;
	};
	var inetNtop4 = (addr) =>
		(addr & 255) +
		'.' +
		((addr >> 8) & 255) +
		'.' +
		((addr >> 16) & 255) +
		'.' +
		((addr >> 24) & 255);
	var inetNtop6 = (ints) => {
		var str = '';
		var word = 0;
		var longest = 0;
		var lastzero = 0;
		var zstart = 0;
		var len = 0;
		var i = 0;
		var parts = [
			ints[0] & 65535,
			ints[0] >> 16,
			ints[1] & 65535,
			ints[1] >> 16,
			ints[2] & 65535,
			ints[2] >> 16,
			ints[3] & 65535,
			ints[3] >> 16,
		];
		var hasipv4 = true;
		var v4part = '';
		for (i = 0; i < 5; i++) {
			if (parts[i] !== 0) {
				hasipv4 = false;
				break;
			}
		}
		if (hasipv4) {
			v4part = inetNtop4(parts[6] | (parts[7] << 16));
			if (parts[5] === -1) {
				str = '::ffff:';
				str += v4part;
				return str;
			}
			if (parts[5] === 0) {
				str = '::';
				if (v4part === '0.0.0.0') v4part = '';
				if (v4part === '0.0.0.1') v4part = '1';
				str += v4part;
				return str;
			}
		}
		for (word = 0; word < 8; word++) {
			if (parts[word] === 0) {
				if (word - lastzero > 1) {
					len = 0;
				}
				lastzero = word;
				len++;
			}
			if (len > longest) {
				longest = len;
				zstart = word - longest + 1;
			}
		}
		for (word = 0; word < 8; word++) {
			if (longest > 1) {
				if (
					parts[word] === 0 &&
					word >= zstart &&
					word < zstart + longest
				) {
					if (word === zstart) {
						str += ':';
						if (zstart === 0) str += ':';
					}
					continue;
				}
			}
			str += Number(_ntohs(parts[word] & 65535)).toString(16);
			str += word < 7 ? ':' : '';
		}
		return str;
	};
	var zeroMemory = (address, size) => {
		HEAPU8.fill(0, address, address + size);
		return address;
	};
	var writeSockaddr = (sa, family, addr, port, addrlen) => {
		switch (family) {
			case 2:
				addr = inetPton4(addr);
				zeroMemory(sa, 16);
				if (addrlen) {
					HEAP32[addrlen >> 2] = 16;
				}
				HEAP16[sa >> 1] = family;
				HEAP32[(sa + 4) >> 2] = addr;
				HEAP16[(sa + 2) >> 1] = _htons(port);
				break;
			case 10:
				addr = inetPton6(addr);
				zeroMemory(sa, 28);
				if (addrlen) {
					HEAP32[addrlen >> 2] = 28;
				}
				HEAP32[sa >> 2] = family;
				HEAP32[(sa + 8) >> 2] = addr[0];
				HEAP32[(sa + 12) >> 2] = addr[1];
				HEAP32[(sa + 16) >> 2] = addr[2];
				HEAP32[(sa + 20) >> 2] = addr[3];
				HEAP16[(sa + 2) >> 1] = _htons(port);
				break;
			default:
				return 5;
		}
		return 0;
	};
	var _getaddrinfo = (node, service, hint, out) => {
		var addr = 0;
		var port = 0;
		var flags = 0;
		var family = 0;
		var type = 0;
		var proto = 0;
		var ai;
		function allocaddrinfo(family, type, proto, canon, addr, port) {
			var sa, salen, ai;
			var errno;
			salen = family === 10 ? 28 : 16;
			addr = family === 10 ? inetNtop6(addr) : inetNtop4(addr);
			sa = _malloc(salen);
			errno = writeSockaddr(sa, family, addr, port);
			assert(!errno);
			ai = _malloc(32);
			HEAP32[(ai + 4) >> 2] = family;
			HEAP32[(ai + 8) >> 2] = type;
			HEAP32[(ai + 12) >> 2] = proto;
			HEAPU32[(ai + 24) >> 2] = canon;
			HEAPU32[(ai + 20) >> 2] = sa;
			if (family === 10) {
				HEAP32[(ai + 16) >> 2] = 28;
			} else {
				HEAP32[(ai + 16) >> 2] = 16;
			}
			HEAP32[(ai + 28) >> 2] = 0;
			return ai;
		}
		if (hint) {
			flags = HEAP32[hint >> 2];
			family = HEAP32[(hint + 4) >> 2];
			type = HEAP32[(hint + 8) >> 2];
			proto = HEAP32[(hint + 12) >> 2];
		}
		if (type && !proto) {
			proto = type === 2 ? 17 : 6;
		}
		if (!type && proto) {
			type = proto === 17 ? 2 : 1;
		}
		if (proto === 0) {
			proto = 6;
		}
		if (type === 0) {
			type = 1;
		}
		if (!node && !service) {
			return -2;
		}
		if (flags & ~(1 | 2 | 4 | 1024 | 8 | 16 | 32)) {
			return -1;
		}
		if (hint !== 0 && HEAP32[hint >> 2] & 2 && !node) {
			return -1;
		}
		if (flags & 32) {
			return -2;
		}
		if (type !== 0 && type !== 1 && type !== 2) {
			return -7;
		}
		if (family !== 0 && family !== 2 && family !== 10) {
			return -6;
		}
		if (service) {
			service = UTF8ToString(service);
			port = parseInt(service, 10);
			if (isNaN(port)) {
				if (flags & 1024) {
					return -2;
				}
				return -8;
			}
		}
		if (!node) {
			if (family === 0) {
				family = 2;
			}
			if ((flags & 1) === 0) {
				if (family === 2) {
					addr = _htonl(2130706433);
				} else {
					addr = [0, 0, 0, 1];
				}
			}
			ai = allocaddrinfo(family, type, proto, null, addr, port);
			HEAPU32[out >> 2] = ai;
			return 0;
		}
		node = UTF8ToString(node);
		addr = inetPton4(node);
		if (addr !== null) {
			if (family === 0 || family === 2) {
				family = 2;
			} else if (family === 10 && flags & 8) {
				addr = [0, 0, _htonl(65535), addr];
				family = 10;
			} else {
				return -2;
			}
		} else {
			addr = inetPton6(node);
			if (addr !== null) {
				if (family === 0 || family === 10) {
					family = 10;
				} else {
					return -2;
				}
			}
		}
		if (addr != null) {
			ai = allocaddrinfo(family, type, proto, node, addr, port);
			HEAPU32[out >> 2] = ai;
			return 0;
		}
		if (flags & 4) {
			return -2;
		}
		node = DNS.lookup_name(node);
		addr = inetPton4(node);
		if (family === 0) {
			family = 2;
		} else if (family === 10) {
			addr = [0, 0, _htonl(65535), addr];
		}
		ai = allocaddrinfo(family, type, proto, null, addr, port);
		HEAPU32[out >> 2] = ai;
		return 0;
	};
	var initRandomFill = () => {
		if (
			typeof crypto == 'object' &&
			typeof crypto['getRandomValues'] == 'function'
		) {
			return (view) => crypto.getRandomValues(view);
		} else abort('initRandomDevice');
	};
	var randomFill = (view) => (randomFill = initRandomFill())(view);
	var _getentropy = (buffer, size) => {
		randomFill(HEAPU8.subarray(buffer, buffer + size));
		return 0;
	};
	var readSockaddr = (sa, salen) => {
		var family = HEAP16[sa >> 1];
		var port = _ntohs(HEAPU16[(sa + 2) >> 1]);
		var addr;
		switch (family) {
			case 2:
				if (salen !== 16) {
					return { errno: 28 };
				}
				addr = HEAP32[(sa + 4) >> 2];
				addr = inetNtop4(addr);
				break;
			case 10:
				if (salen !== 28) {
					return { errno: 28 };
				}
				addr = [
					HEAP32[(sa + 8) >> 2],
					HEAP32[(sa + 12) >> 2],
					HEAP32[(sa + 16) >> 2],
					HEAP32[(sa + 20) >> 2],
				];
				addr = inetNtop6(addr);
				break;
			default:
				return { errno: 5 };
		}
		return { family: family, addr: addr, port: port };
	};
	var _getnameinfo = (sa, salen, node, nodelen, serv, servlen, flags) => {
		var info = readSockaddr(sa, salen);
		if (info.errno) {
			return -6;
		}
		var port = info.port;
		var addr = info.addr;
		var overflowed = false;
		if (node && nodelen) {
			var lookup;
			if (flags & 1 || !(lookup = DNS.lookup_addr(addr))) {
				if (flags & 8) {
					return -2;
				}
			} else {
				addr = lookup;
			}
			var numBytesWrittenExclNull = stringToUTF8(addr, node, nodelen);
			if (numBytesWrittenExclNull + 1 >= nodelen) {
				overflowed = true;
			}
		}
		if (serv && servlen) {
			port = '' + port;
			var numBytesWrittenExclNull = stringToUTF8(port, serv, servlen);
			if (numBytesWrittenExclNull + 1 >= servlen) {
				overflowed = true;
			}
		}
		if (overflowed) {
			return -12;
		}
		return 0;
	};
	var Protocols = { list: [], map: {} };
	var _setprotoent = (stayopen) => {
		function allocprotoent(name, proto, aliases) {
			var nameBuf = _malloc(name.length + 1);
			stringToAscii(name, nameBuf);
			var j = 0;
			var length = aliases.length;
			var aliasListBuf = _malloc((length + 1) * 4);
			for (var i = 0; i < length; i++, j += 4) {
				var alias = aliases[i];
				var aliasBuf = _malloc(alias.length + 1);
				stringToAscii(alias, aliasBuf);
				HEAPU32[(aliasListBuf + j) >> 2] = aliasBuf;
			}
			HEAPU32[(aliasListBuf + j) >> 2] = 0;
			var pe = _malloc(12);
			HEAPU32[pe >> 2] = nameBuf;
			HEAPU32[(pe + 4) >> 2] = aliasListBuf;
			HEAP32[(pe + 8) >> 2] = proto;
			return pe;
		}
		var list = Protocols.list;
		var map = Protocols.map;
		if (list.length === 0) {
			var entry = allocprotoent('tcp', 6, ['TCP']);
			list.push(entry);
			map['tcp'] = map['6'] = entry;
			entry = allocprotoent('udp', 17, ['UDP']);
			list.push(entry);
			map['udp'] = map['17'] = entry;
		}
		_setprotoent.index = 0;
	};
	var _getprotobyname = (name) => {
		name = UTF8ToString(name);
		_setprotoent(true);
		var result = Protocols.map[name];
		return result;
	};
	var _getprotobynumber = (number) => {
		_setprotoent(true);
		var result = Protocols.map[number];
		return result;
	};
	var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
	var stringToUTF8OnStack = (str) => {
		var size = lengthBytesUTF8(str) + 1;
		var ret = stackAlloc(size);
		stringToUTF8(str, ret, size);
		return ret;
	};
	var allocateUTF8OnStack = stringToUTF8OnStack;
	var PHPWASM = {
		init: function () {
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
		getAllWebSockets: function (sock) {
			const webSockets = new Set();
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
		awaitData: function (ws) {
			return PHPWASM.awaitEvent(ws, 'message');
		},
		awaitConnection: function (ws) {
			if (ws.OPEN === ws.readyState) {
				return [Promise.resolve(), PHPWASM.noop];
			}
			return PHPWASM.awaitEvent(ws, 'open');
		},
		awaitClose: function (ws) {
			if ([ws.CLOSING, ws.CLOSED].includes(ws.readyState)) {
				return [Promise.resolve(), PHPWASM.noop];
			}
			return PHPWASM.awaitEvent(ws, 'close');
		},
		awaitError: function (ws) {
			if ([ws.CLOSING, ws.CLOSED].includes(ws.readyState)) {
				return [Promise.resolve(), PHPWASM.noop];
			}
			return PHPWASM.awaitEvent(ws, 'error');
		},
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
				setTimeout(resolve);
			};
			return [promise, cancel];
		},
		noop: function () {},
		spawnProcess: function (command, args, options) {
			if (Module['spawnProcess']) {
				const spawnedPromise = Module['spawnProcess'](
					command,
					args,
					options
				);
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
	};
	function _js_create_input_device(deviceId) {
		let dataBuffer = [];
		let dataCallback;
		const filename = 'proc_id_' + deviceId;
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
	}
	function _js_open_process(
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
				ProcInfo.stdout.emit('data');
				ProcInfo.stderr.emit('data');
			});
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
			if (ProcInfo.stdinIsDevice) {
				PHPWASM.input_devices[ProcInfo.stdinFd].onData(function (data) {
					if (!data) return;
					if (typeof data === 'number') {
						data = new Uint8Array([data]);
					}
					const dataStr = new TextDecoder('utf-8').decode(data);
					cp.stdin.write(dataStr);
				});
				wakeUp(ProcInfo.pid);
				return;
			}
			if (ProcInfo.stdinFd) {
				const stdinStream = SYSCALLS.getStreamFromFD(ProcInfo.stdinFd);
				if (stdinStream.node) {
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
	}
	function _js_process_status(pid, exitCodePtr) {
		if (!PHPWASM.child_proc_by_pid[pid]) {
			return -1;
		}
		if (PHPWASM.child_proc_by_pid[pid].exited) {
			HEAPU32[exitCodePtr >> 2] = PHPWASM.child_proc_by_pid[pid].exitCode;
			return 1;
		}
		return 0;
	}
	function _js_waitpid(pid, exitCodePtr) {
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
	}
	var arraySum = (array, index) => {
		var sum = 0;
		for (var i = 0; i <= index; sum += array[i++]) {}
		return sum;
	};
	var MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	var MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	var addDays = (date, days) => {
		var newDate = new Date(date.getTime());
		while (days > 0) {
			var leap = isLeapYear(newDate.getFullYear());
			var currentMonth = newDate.getMonth();
			var daysInCurrentMonth = (
				leap ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR
			)[currentMonth];
			if (days > daysInCurrentMonth - newDate.getDate()) {
				days -= daysInCurrentMonth - newDate.getDate() + 1;
				newDate.setDate(1);
				if (currentMonth < 11) {
					newDate.setMonth(currentMonth + 1);
				} else {
					newDate.setMonth(0);
					newDate.setFullYear(newDate.getFullYear() + 1);
				}
			} else {
				newDate.setDate(newDate.getDate() + days);
				return newDate;
			}
		}
		return newDate;
	};
	var writeArrayToMemory = (array, buffer) => {
		HEAP8.set(array, buffer);
	};
	var _strftime = (s, maxsize, format, tm) => {
		var tm_zone = HEAPU32[(tm + 40) >> 2];
		var date = {
			tm_sec: HEAP32[tm >> 2],
			tm_min: HEAP32[(tm + 4) >> 2],
			tm_hour: HEAP32[(tm + 8) >> 2],
			tm_mday: HEAP32[(tm + 12) >> 2],
			tm_mon: HEAP32[(tm + 16) >> 2],
			tm_year: HEAP32[(tm + 20) >> 2],
			tm_wday: HEAP32[(tm + 24) >> 2],
			tm_yday: HEAP32[(tm + 28) >> 2],
			tm_isdst: HEAP32[(tm + 32) >> 2],
			tm_gmtoff: HEAP32[(tm + 36) >> 2],
			tm_zone: tm_zone ? UTF8ToString(tm_zone) : '',
		};
		var pattern = UTF8ToString(format);
		var EXPANSION_RULES_1 = {
			'%c': '%a %b %d %H:%M:%S %Y',
			'%D': '%m/%d/%y',
			'%F': '%Y-%m-%d',
			'%h': '%b',
			'%r': '%I:%M:%S %p',
			'%R': '%H:%M',
			'%T': '%H:%M:%S',
			'%x': '%m/%d/%y',
			'%X': '%H:%M:%S',
			'%Ec': '%c',
			'%EC': '%C',
			'%Ex': '%m/%d/%y',
			'%EX': '%H:%M:%S',
			'%Ey': '%y',
			'%EY': '%Y',
			'%Od': '%d',
			'%Oe': '%e',
			'%OH': '%H',
			'%OI': '%I',
			'%Om': '%m',
			'%OM': '%M',
			'%OS': '%S',
			'%Ou': '%u',
			'%OU': '%U',
			'%OV': '%V',
			'%Ow': '%w',
			'%OW': '%W',
			'%Oy': '%y',
		};
		for (var rule in EXPANSION_RULES_1) {
			pattern = pattern.replace(
				new RegExp(rule, 'g'),
				EXPANSION_RULES_1[rule]
			);
		}
		var WEEKDAYS = [
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
		];
		var MONTHS = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December',
		];
		function leadingSomething(value, digits, character) {
			var str = typeof value == 'number' ? value.toString() : value || '';
			while (str.length < digits) {
				str = character[0] + str;
			}
			return str;
		}
		function leadingNulls(value, digits) {
			return leadingSomething(value, digits, '0');
		}
		function compareByDay(date1, date2) {
			function sgn(value) {
				return value < 0 ? -1 : value > 0 ? 1 : 0;
			}
			var compare;
			if (
				(compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0
			) {
				if (
					(compare = sgn(date1.getMonth() - date2.getMonth())) === 0
				) {
					compare = sgn(date1.getDate() - date2.getDate());
				}
			}
			return compare;
		}
		function getFirstWeekStartDate(janFourth) {
			switch (janFourth.getDay()) {
				case 0:
					return new Date(janFourth.getFullYear() - 1, 11, 29);
				case 1:
					return janFourth;
				case 2:
					return new Date(janFourth.getFullYear(), 0, 3);
				case 3:
					return new Date(janFourth.getFullYear(), 0, 2);
				case 4:
					return new Date(janFourth.getFullYear(), 0, 1);
				case 5:
					return new Date(janFourth.getFullYear() - 1, 11, 31);
				case 6:
					return new Date(janFourth.getFullYear() - 1, 11, 30);
			}
		}
		function getWeekBasedYear(date) {
			var thisDate = addDays(
				new Date(date.tm_year + 1900, 0, 1),
				date.tm_yday
			);
			var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
			var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
			var firstWeekStartThisYear =
				getFirstWeekStartDate(janFourthThisYear);
			var firstWeekStartNextYear =
				getFirstWeekStartDate(janFourthNextYear);
			if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
				if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
					return thisDate.getFullYear() + 1;
				}
				return thisDate.getFullYear();
			}
			return thisDate.getFullYear() - 1;
		}
		var EXPANSION_RULES_2 = {
			'%a': (date) => WEEKDAYS[date.tm_wday].substring(0, 3),
			'%A': (date) => WEEKDAYS[date.tm_wday],
			'%b': (date) => MONTHS[date.tm_mon].substring(0, 3),
			'%B': (date) => MONTHS[date.tm_mon],
			'%C': (date) => {
				var year = date.tm_year + 1900;
				return leadingNulls((year / 100) | 0, 2);
			},
			'%d': (date) => leadingNulls(date.tm_mday, 2),
			'%e': (date) => leadingSomething(date.tm_mday, 2, ' '),
			'%g': (date) => getWeekBasedYear(date).toString().substring(2),
			'%G': getWeekBasedYear,
			'%H': (date) => leadingNulls(date.tm_hour, 2),
			'%I': (date) => {
				var twelveHour = date.tm_hour;
				if (twelveHour == 0) twelveHour = 12;
				else if (twelveHour > 12) twelveHour -= 12;
				return leadingNulls(twelveHour, 2);
			},
			'%j': (date) =>
				leadingNulls(
					date.tm_mday +
						arraySum(
							isLeapYear(date.tm_year + 1900)
								? MONTH_DAYS_LEAP
								: MONTH_DAYS_REGULAR,
							date.tm_mon - 1
						),
					3
				),
			'%m': (date) => leadingNulls(date.tm_mon + 1, 2),
			'%M': (date) => leadingNulls(date.tm_min, 2),
			'%n': () => '\n',
			'%p': (date) => {
				if (date.tm_hour >= 0 && date.tm_hour < 12) {
					return 'AM';
				}
				return 'PM';
			},
			'%S': (date) => leadingNulls(date.tm_sec, 2),
			'%t': () => '\t',
			'%u': (date) => date.tm_wday || 7,
			'%U': (date) => {
				var days = date.tm_yday + 7 - date.tm_wday;
				return leadingNulls(Math.floor(days / 7), 2);
			},
			'%V': (date) => {
				var val = Math.floor(
					(date.tm_yday + 7 - ((date.tm_wday + 6) % 7)) / 7
				);
				if ((date.tm_wday + 371 - date.tm_yday - 2) % 7 <= 2) {
					val++;
				}
				if (!val) {
					val = 52;
					var dec31 = (date.tm_wday + 7 - date.tm_yday - 1) % 7;
					if (
						dec31 == 4 ||
						(dec31 == 5 && isLeapYear((date.tm_year % 400) - 1))
					) {
						val++;
					}
				} else if (val == 53) {
					var jan1 = (date.tm_wday + 371 - date.tm_yday) % 7;
					if (jan1 != 4 && (jan1 != 3 || !isLeapYear(date.tm_year)))
						val = 1;
				}
				return leadingNulls(val, 2);
			},
			'%w': (date) => date.tm_wday,
			'%W': (date) => {
				var days = date.tm_yday + 7 - ((date.tm_wday + 6) % 7);
				return leadingNulls(Math.floor(days / 7), 2);
			},
			'%y': (date) => (date.tm_year + 1900).toString().substring(2),
			'%Y': (date) => date.tm_year + 1900,
			'%z': (date) => {
				var off = date.tm_gmtoff;
				var ahead = off >= 0;
				off = Math.abs(off) / 60;
				off = (off / 60) * 100 + (off % 60);
				return (ahead ? '+' : '-') + String('0000' + off).slice(-4);
			},
			'%Z': (date) => date.tm_zone,
			'%%': () => '%',
		};
		pattern = pattern.replace(/%%/g, '\0\0');
		for (var rule in EXPANSION_RULES_2) {
			if (pattern.includes(rule)) {
				pattern = pattern.replace(
					new RegExp(rule, 'g'),
					EXPANSION_RULES_2[rule](date)
				);
			}
		}
		pattern = pattern.replace(/\0\0/g, '%');
		var bytes = intArrayFromString(pattern, false);
		if (bytes.length > maxsize) {
			return 0;
		}
		writeArrayToMemory(bytes, s);
		return bytes.length - 1;
	};
	var _strftime_l = (s, maxsize, format, tm, loc) =>
		_strftime(s, maxsize, format, tm);
	var _strptime = (buf, format, tm) => {
		var pattern = UTF8ToString(format);
		var SPECIAL_CHARS = '\\!@#$^&*()+=-[]/{}|:<>?,.';
		for (var i = 0, ii = SPECIAL_CHARS.length; i < ii; ++i) {
			pattern = pattern.replace(
				new RegExp('\\' + SPECIAL_CHARS[i], 'g'),
				'\\' + SPECIAL_CHARS[i]
			);
		}
		var EQUIVALENT_MATCHERS = {
			A: '%a',
			B: '%b',
			c: '%a %b %d %H:%M:%S %Y',
			D: '%m\\/%d\\/%y',
			e: '%d',
			F: '%Y-%m-%d',
			h: '%b',
			R: '%H\\:%M',
			r: '%I\\:%M\\:%S\\s%p',
			T: '%H\\:%M\\:%S',
			x: '%m\\/%d\\/(?:%y|%Y)',
			X: '%H\\:%M\\:%S',
		};
		var DATE_PATTERNS = {
			a: '(?:Sun(?:day)?)|(?:Mon(?:day)?)|(?:Tue(?:sday)?)|(?:Wed(?:nesday)?)|(?:Thu(?:rsday)?)|(?:Fri(?:day)?)|(?:Sat(?:urday)?)',
			b: '(?:Jan(?:uary)?)|(?:Feb(?:ruary)?)|(?:Mar(?:ch)?)|(?:Apr(?:il)?)|May|(?:Jun(?:e)?)|(?:Jul(?:y)?)|(?:Aug(?:ust)?)|(?:Sep(?:tember)?)|(?:Oct(?:ober)?)|(?:Nov(?:ember)?)|(?:Dec(?:ember)?)',
			C: '\\d\\d',
			d: '0[1-9]|[1-9](?!\\d)|1\\d|2\\d|30|31',
			H: '\\d(?!\\d)|[0,1]\\d|20|21|22|23',
			I: '\\d(?!\\d)|0\\d|10|11|12',
			j: '00[1-9]|0?[1-9](?!\\d)|0?[1-9]\\d(?!\\d)|[1,2]\\d\\d|3[0-6]\\d',
			m: '0[1-9]|[1-9](?!\\d)|10|11|12',
			M: '0\\d|\\d(?!\\d)|[1-5]\\d',
			n: ' ',
			p: 'AM|am|PM|pm|A\\.M\\.|a\\.m\\.|P\\.M\\.|p\\.m\\.',
			S: '0\\d|\\d(?!\\d)|[1-5]\\d|60',
			U: '0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53',
			W: '0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53',
			w: '[0-6]',
			y: '\\d\\d',
			Y: '\\d\\d\\d\\d',
			t: ' ',
			z: 'Z|(?:[\\+\\-]\\d\\d:?(?:\\d\\d)?)',
		};
		var MONTH_NUMBERS = {
			JAN: 0,
			FEB: 1,
			MAR: 2,
			APR: 3,
			MAY: 4,
			JUN: 5,
			JUL: 6,
			AUG: 7,
			SEP: 8,
			OCT: 9,
			NOV: 10,
			DEC: 11,
		};
		var DAY_NUMBERS_SUN_FIRST = {
			SUN: 0,
			MON: 1,
			TUE: 2,
			WED: 3,
			THU: 4,
			FRI: 5,
			SAT: 6,
		};
		var DAY_NUMBERS_MON_FIRST = {
			MON: 0,
			TUE: 1,
			WED: 2,
			THU: 3,
			FRI: 4,
			SAT: 5,
			SUN: 6,
		};
		var capture = [];
		var pattern_out = pattern
			.replace(/%(.)/g, (m, c) => EQUIVALENT_MATCHERS[c] || m)
			.replace(/%(.)/g, (_, c) => {
				let pat = DATE_PATTERNS[c];
				if (pat) {
					capture.push(c);
					return `(${pat})`;
				} else {
					return c;
				}
			})
			.replace(/\s+/g, '\\s*');
		var matches = new RegExp('^' + pattern_out, 'i').exec(
			UTF8ToString(buf)
		);
		function initDate() {
			function fixup(value, min, max) {
				return typeof value != 'number' || isNaN(value)
					? min
					: value >= min
					? value <= max
						? value
						: max
					: min;
			}
			return {
				year: fixup(HEAP32[(tm + 20) >> 2] + 1900, 1970, 9999),
				month: fixup(HEAP32[(tm + 16) >> 2], 0, 11),
				day: fixup(HEAP32[(tm + 12) >> 2], 1, 31),
				hour: fixup(HEAP32[(tm + 8) >> 2], 0, 23),
				min: fixup(HEAP32[(tm + 4) >> 2], 0, 59),
				sec: fixup(HEAP32[tm >> 2], 0, 59),
				gmtoff: 0,
			};
		}
		if (matches) {
			var date = initDate();
			var value;
			var getMatch = (symbol) => {
				var pos = capture.indexOf(symbol);
				if (pos >= 0) {
					return matches[pos + 1];
				}
				return;
			};
			if ((value = getMatch('S'))) {
				date.sec = jstoi_q(value);
			}
			if ((value = getMatch('M'))) {
				date.min = jstoi_q(value);
			}
			if ((value = getMatch('H'))) {
				date.hour = jstoi_q(value);
			} else if ((value = getMatch('I'))) {
				var hour = jstoi_q(value);
				if ((value = getMatch('p'))) {
					hour += value.toUpperCase()[0] === 'P' ? 12 : 0;
				}
				date.hour = hour;
			}
			if ((value = getMatch('Y'))) {
				date.year = jstoi_q(value);
			} else if ((value = getMatch('y'))) {
				var year = jstoi_q(value);
				if ((value = getMatch('C'))) {
					year += jstoi_q(value) * 100;
				} else {
					year += year < 69 ? 2e3 : 1900;
				}
				date.year = year;
			}
			if ((value = getMatch('m'))) {
				date.month = jstoi_q(value) - 1;
			} else if ((value = getMatch('b'))) {
				date.month =
					MONTH_NUMBERS[value.substring(0, 3).toUpperCase()] || 0;
			}
			if ((value = getMatch('d'))) {
				date.day = jstoi_q(value);
			} else if ((value = getMatch('j'))) {
				var day = jstoi_q(value);
				var leapYear = isLeapYear(date.year);
				for (var month = 0; month < 12; ++month) {
					var daysUntilMonth = arraySum(
						leapYear ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR,
						month - 1
					);
					if (
						day <=
						daysUntilMonth +
							(leapYear ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[
								month
							]
					) {
						date.day = day - daysUntilMonth;
					}
				}
			} else if ((value = getMatch('a'))) {
				var weekDay = value.substring(0, 3).toUpperCase();
				if ((value = getMatch('U'))) {
					var weekDayNumber = DAY_NUMBERS_SUN_FIRST[weekDay];
					var weekNumber = jstoi_q(value);
					var janFirst = new Date(date.year, 0, 1);
					var endDate;
					if (janFirst.getDay() === 0) {
						endDate = addDays(
							janFirst,
							weekDayNumber + 7 * (weekNumber - 1)
						);
					} else {
						endDate = addDays(
							janFirst,
							7 -
								janFirst.getDay() +
								weekDayNumber +
								7 * (weekNumber - 1)
						);
					}
					date.day = endDate.getDate();
					date.month = endDate.getMonth();
				} else if ((value = getMatch('W'))) {
					var weekDayNumber = DAY_NUMBERS_MON_FIRST[weekDay];
					var weekNumber = jstoi_q(value);
					var janFirst = new Date(date.year, 0, 1);
					var endDate;
					if (janFirst.getDay() === 1) {
						endDate = addDays(
							janFirst,
							weekDayNumber + 7 * (weekNumber - 1)
						);
					} else {
						endDate = addDays(
							janFirst,
							7 -
								janFirst.getDay() +
								1 +
								weekDayNumber +
								7 * (weekNumber - 1)
						);
					}
					date.day = endDate.getDate();
					date.month = endDate.getMonth();
				}
			}
			if ((value = getMatch('z'))) {
				if (value.toLowerCase() === 'z') {
					date.gmtoff = 0;
				} else {
					var match = value.match(/^((?:\-|\+)\d\d):?(\d\d)?/);
					date.gmtoff = match[1] * 3600;
					if (match[2]) {
						date.gmtoff +=
							date.gmtoff > 0 ? match[2] * 60 : -match[2] * 60;
					}
				}
			}
			var fullDate = new Date(
				date.year,
				date.month,
				date.day,
				date.hour,
				date.min,
				date.sec,
				0
			);
			HEAP32[tm >> 2] = fullDate.getSeconds();
			HEAP32[(tm + 4) >> 2] = fullDate.getMinutes();
			HEAP32[(tm + 8) >> 2] = fullDate.getHours();
			HEAP32[(tm + 12) >> 2] = fullDate.getDate();
			HEAP32[(tm + 16) >> 2] = fullDate.getMonth();
			HEAP32[(tm + 20) >> 2] = fullDate.getFullYear() - 1900;
			HEAP32[(tm + 24) >> 2] = fullDate.getDay();
			HEAP32[(tm + 28) >> 2] =
				arraySum(
					isLeapYear(fullDate.getFullYear())
						? MONTH_DAYS_LEAP
						: MONTH_DAYS_REGULAR,
					fullDate.getMonth() - 1
				) +
				fullDate.getDate() -
				1;
			HEAP32[(tm + 32) >> 2] = 0;
			HEAP32[(tm + 36) >> 2] = date.gmtoff;
			return buf + intArrayFromString(matches[0]).length - 1;
		}
		return 0;
	};
	var PATH = {
		isAbs: (path) => path.charAt(0) === '/',
		splitPath: (filename) => {
			var splitPathRe =
				/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
			return splitPathRe.exec(filename).slice(1);
		},
		normalizeArray: (parts, allowAboveRoot) => {
			var up = 0;
			for (var i = parts.length - 1; i >= 0; i--) {
				var last = parts[i];
				if (last === '.') {
					parts.splice(i, 1);
				} else if (last === '..') {
					parts.splice(i, 1);
					up++;
				} else if (up) {
					parts.splice(i, 1);
					up--;
				}
			}
			if (allowAboveRoot) {
				for (; up; up--) {
					parts.unshift('..');
				}
			}
			return parts;
		},
		normalize: (path) => {
			var isAbsolute = PATH.isAbs(path),
				trailingSlash = path.substr(-1) === '/';
			path = PATH.normalizeArray(
				path.split('/').filter((p) => !!p),
				!isAbsolute
			).join('/');
			if (!path && !isAbsolute) {
				path = '.';
			}
			if (path && trailingSlash) {
				path += '/';
			}
			return (isAbsolute ? '/' : '') + path;
		},
		dirname: (path) => {
			var result = PATH.splitPath(path),
				root = result[0],
				dir = result[1];
			if (!root && !dir) {
				return '.';
			}
			if (dir) {
				dir = dir.substr(0, dir.length - 1);
			}
			return root + dir;
		},
		basename: (path) => {
			if (path === '/') return '/';
			path = PATH.normalize(path);
			path = path.replace(/\/$/, '');
			var lastSlash = path.lastIndexOf('/');
			if (lastSlash === -1) return path;
			return path.substr(lastSlash + 1);
		},
		join: (...paths) => PATH.normalize(paths.join('/')),
		join2: (l, r) => PATH.normalize(l + '/' + r),
	};
	var withStackSave = (f) => {
		var stack = stackSave();
		var ret = f();
		stackRestore(stack);
		return ret;
	};
	var readI53FromI64 = (ptr) =>
		HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296;
	var readI53FromU64 = (ptr) =>
		HEAPU32[ptr >> 2] + HEAPU32[(ptr + 4) >> 2] * 4294967296;
	var FS_mknod = (path, mode, dev) =>
		FS.handleError(
			withStackSave(() => {
				var pathBuffer = stringToUTF8OnStack(path);
				return __wasmfs_mknod(pathBuffer, mode, dev);
			})
		);
	var FS_create = (path, mode = 438) => {
		mode &= 4095;
		mode |= 32768;
		return FS_mknod(path, mode, 0);
	};
	var FS_writeFile = (path, data) => {
		var sp = stackSave();
		var pathBuffer = stringToUTF8OnStack(path);
		if (typeof data == 'string') {
			var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
			var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
			data = buf.slice(0, actualNumBytes);
		}
		var dataBuffer = _malloc(data.length);
		for (var i = 0; i < data.length; i++) {
			HEAP8[dataBuffer + i] = data[i];
		}
		var ret = __wasmfs_write_file(pathBuffer, dataBuffer, data.length);
		_free(dataBuffer);
		stackRestore(sp);
		return ret;
	};
	var FS_createDataFile = (
		parent,
		name,
		fileData,
		canRead,
		canWrite,
		canOwn
	) => {
		var pathName = name ? parent + '/' + name : parent;
		var mode = FS_getMode(canRead, canWrite);
		if (!wasmFSPreloadingFlushed) {
			wasmFSPreloadedFiles.push({
				pathName: pathName,
				fileData: fileData,
				mode: mode,
			});
		} else {
			FS_create(pathName, mode);
			FS_writeFile(pathName, fileData);
		}
	};
	var asyncLoad = (url, onload, onerror, noRunDep) => {
		var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : '';
		readAsync(
			url,
			(arrayBuffer) => {
				onload(new Uint8Array(arrayBuffer));
				if (dep) removeRunDependency(dep);
			},
			(event) => {
				if (onerror) {
					onerror();
				} else {
					throw `Loading data file "${url}" failed.`;
				}
			}
		);
		if (dep) addRunDependency(dep);
	};
	var PATH_FS = {
		resolve: (...args) => {
			var resolvedPath = '',
				resolvedAbsolute = false;
			for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
				var path = i >= 0 ? args[i] : FS.cwd();
				if (typeof path != 'string') {
					throw new TypeError(
						'Arguments to path.resolve must be strings'
					);
				} else if (!path) {
					return '';
				}
				resolvedPath = path + '/' + resolvedPath;
				resolvedAbsolute = PATH.isAbs(path);
			}
			resolvedPath = PATH.normalizeArray(
				resolvedPath.split('/').filter((p) => !!p),
				!resolvedAbsolute
			).join('/');
			return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
		},
		relative: (from, to) => {
			from = PATH_FS.resolve(from).substr(1);
			to = PATH_FS.resolve(to).substr(1);
			function trim(arr) {
				var start = 0;
				for (; start < arr.length; start++) {
					if (arr[start] !== '') break;
				}
				var end = arr.length - 1;
				for (; end >= 0; end--) {
					if (arr[end] !== '') break;
				}
				if (start > end) return [];
				return arr.slice(start, end - start + 1);
			}
			var fromParts = trim(from.split('/'));
			var toParts = trim(to.split('/'));
			var length = Math.min(fromParts.length, toParts.length);
			var samePartsLength = length;
			for (var i = 0; i < length; i++) {
				if (fromParts[i] !== toParts[i]) {
					samePartsLength = i;
					break;
				}
			}
			var outputParts = [];
			for (var i = samePartsLength; i < fromParts.length; i++) {
				outputParts.push('..');
			}
			outputParts = outputParts.concat(toParts.slice(samePartsLength));
			return outputParts.join('/');
		},
	};
	var preloadPlugins = Module['preloadPlugins'] || [];
	var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
		if (typeof Browser != 'undefined') Browser.init();
		var handled = false;
		preloadPlugins.forEach((plugin) => {
			if (handled) return;
			if (plugin['canHandle'](fullname)) {
				plugin['handle'](byteArray, fullname, finish, onerror);
				handled = true;
			}
		});
		return handled;
	};
	var FS_createPreloadedFile = (
		parent,
		name,
		url,
		canRead,
		canWrite,
		onload,
		onerror,
		dontCreateFile,
		canOwn,
		preFinish
	) => {
		var fullname = name
			? PATH_FS.resolve(PATH.join2(parent, name))
			: parent;
		var dep = getUniqueRunDependency(`cp ${fullname}`);
		function processData(byteArray) {
			function finish(byteArray) {
				preFinish?.();
				if (!dontCreateFile) {
					FS_createDataFile(
						parent,
						name,
						byteArray,
						canRead,
						canWrite,
						canOwn
					);
				}
				onload?.();
				removeRunDependency(dep);
			}
			if (
				FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
					onerror?.();
					removeRunDependency(dep);
				})
			) {
				return;
			}
			finish(byteArray);
		}
		addRunDependency(dep);
		if (typeof url == 'string') {
			asyncLoad(url, processData, onerror);
		} else {
			processData(url);
		}
	};
	var FS_getMode = (canRead, canWrite) => {
		var mode = 0;
		if (canRead) mode |= 292 | 73;
		if (canWrite) mode |= 146;
		return mode;
	};
	var FS_modeStringToFlags = (str) => {
		var flagModes = {
			r: 0,
			'r+': 2,
			w: 512 | 64 | 1,
			'w+': 512 | 64 | 2,
			a: 1024 | 64 | 1,
			'a+': 1024 | 64 | 2,
		};
		var flags = flagModes[str];
		if (typeof flags == 'undefined') {
			throw new Error(`Unknown file open mode: ${str}`);
		}
		return flags;
	};
	var FS_mkdir = (path, mode = 511) =>
		FS.handleError(
			withStackSave(() => {
				var buffer = stringToUTF8OnStack(path);
				return __wasmfs_mkdir(buffer, mode);
			})
		);
	var FS_mkdirTree = (path, mode) => {
		var dirs = path.split('/');
		var d = '';
		for (var i = 0; i < dirs.length; ++i) {
			if (!dirs[i]) continue;
			d += '/' + dirs[i];
			try {
				FS_mkdir(d, mode);
			} catch (e) {
				if (e.errno != 20) throw e;
			}
		}
	};
	var FS_unlink = (path) =>
		withStackSave(() => {
			var buffer = stringToUTF8OnStack(path);
			return __wasmfs_unlink(buffer);
		});
	var wasmFS$backends = {};
	var wasmFSDevices = {};
	var wasmFSDeviceStreams = {};
	var FS = {
		init() {
			FS.ensureErrnoError();
		},
		ErrnoError: null,
		handleError(returnValue) {
			if (returnValue < 0) {
				throw new FS.ErrnoError(-returnValue);
			}
			return returnValue;
		},
		ensureErrnoError() {
			if (FS.ErrnoError) return;
			FS.ErrnoError = function ErrnoError(code) {
				this.errno = code;
				this.message = 'FS error';
				this.name = 'ErrnoError';
			};
			FS.ErrnoError.prototype = new Error();
			FS.ErrnoError.prototype.constructor = FS.ErrnoError;
		},
		createDataFile(parent, name, fileData, canRead, canWrite, canOwn) {
			FS_createDataFile(
				parent,
				name,
				fileData,
				canRead,
				canWrite,
				canOwn
			);
		},
		createPath(parent, path, canRead, canWrite) {
			var parts = path.split('/').reverse();
			while (parts.length) {
				var part = parts.pop();
				if (!part) continue;
				var current = PATH.join2(parent, part);
				if (!wasmFSPreloadingFlushed) {
					wasmFSPreloadedDirs.push({
						parentPath: parent,
						childName: part,
					});
				} else {
					FS.mkdir(current);
				}
				parent = current;
			}
			return current;
		},
		createPreloadedFile(
			parent,
			name,
			url,
			canRead,
			canWrite,
			onload,
			onerror,
			dontCreateFile,
			canOwn,
			preFinish
		) {
			return FS_createPreloadedFile(
				parent,
				name,
				url,
				canRead,
				canWrite,
				onload,
				onerror,
				dontCreateFile,
				canOwn,
				preFinish
			);
		},
		readFile(path, opts = {}) {
			opts.encoding = opts.encoding || 'binary';
			if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
				throw new Error(
					'Invalid encoding type "' + opts.encoding + '"'
				);
			}
			var sp = stackSave();
			var buf = __wasmfs_read_file(stringToUTF8OnStack(path));
			stackRestore(sp);
			var length = readI53FromI64(buf);
			var ret = new Uint8Array(
				HEAPU8.subarray(buf + 8, buf + 8 + length)
			);
			if (opts.encoding === 'utf8') {
				ret = UTF8ArrayToString(ret, 0);
			}
			return ret;
		},
		cwd: () => UTF8ToString(__wasmfs_get_cwd()),
		analyzePath(path) {
			var exists = !!FS.findObject(path);
			return {
				exists: exists,
				object: { contents: exists ? FS.readFile(path) : null },
			};
		},
		mkdir: (path, mode) => FS_mkdir(path, mode),
		mkdirTree: (path, mode) => FS_mkdirTree(path, mode),
		rmdir: (path) =>
			FS.handleError(
				withStackSave(() => __wasmfs_rmdir(stringToUTF8OnStack(path)))
			),
		open: (path, flags, mode) =>
			withStackSave(() => {
				flags =
					typeof flags == 'string'
						? FS_modeStringToFlags(flags)
						: flags;
				mode = typeof mode == 'undefined' ? 438 : mode;
				var buffer = stringToUTF8OnStack(path);
				var fd = FS.handleError(__wasmfs_open(buffer, flags, mode));
				return { fd: fd };
			}),
		create: (path, mode) => FS_create(path, mode),
		close: (stream) => FS.handleError(-__wasmfs_close(stream.fd)),
		unlink: (path) => FS_unlink(path),
		chdir: (path) =>
			withStackSave(() => {
				var buffer = stringToUTF8OnStack(path);
				return __wasmfs_chdir(buffer);
			}),
		read(stream, buffer, offset, length, position) {
			var seeking = typeof position != 'undefined';
			var dataBuffer = _malloc(length);
			var bytesRead;
			if (seeking) {
				bytesRead = __wasmfs_pread(
					stream.fd,
					dataBuffer,
					length,
					position
				);
			} else {
				bytesRead = __wasmfs_read(stream.fd, dataBuffer, length);
			}
			bytesRead = FS.handleError(bytesRead);
			for (var i = 0; i < length; i++) {
				buffer[offset + i] = HEAP8[dataBuffer + i];
			}
			_free(dataBuffer);
			return bytesRead;
		},
		write(stream, buffer, offset, length, position, canOwn) {
			var seeking = typeof position != 'undefined';
			var dataBuffer = _malloc(length);
			for (var i = 0; i < length; i++) {
				HEAP8[dataBuffer + i] = buffer[offset + i];
			}
			var bytesRead;
			if (seeking) {
				bytesRead = __wasmfs_pwrite(
					stream.fd,
					dataBuffer,
					length,
					position
				);
			} else {
				bytesRead = __wasmfs_write(stream.fd, dataBuffer, length);
			}
			bytesRead = FS.handleError(bytesRead);
			_free(dataBuffer);
			return bytesRead;
		},
		allocate(stream, offset, length) {
			return FS.handleError(
				__wasmfs_allocate(
					stream.fd,
					offset >>> 0,
					((tempDouble = offset),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? +Math.floor(tempDouble / 4294967296) >>> 0
							: ~~+Math.ceil(
									(tempDouble - +(~~tempDouble >>> 0)) /
										4294967296
							  ) >>> 0
						: 0),
					length >>> 0,
					((tempDouble = length),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? +Math.floor(tempDouble / 4294967296) >>> 0
							: ~~+Math.ceil(
									(tempDouble - +(~~tempDouble >>> 0)) /
										4294967296
							  ) >>> 0
						: 0)
				)
			);
		},
		writeFile: (path, data) => FS_writeFile(path, data),
		mmap: (stream, length, offset, prot, flags) => {
			var buf = FS.handleError(
				__wasmfs_mmap(
					length,
					prot,
					flags,
					stream.fd,
					offset >>> 0,
					((tempDouble = offset),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? +Math.floor(tempDouble / 4294967296) >>> 0
							: ~~+Math.ceil(
									(tempDouble - +(~~tempDouble >>> 0)) /
										4294967296
							  ) >>> 0
						: 0)
				)
			);
			return { ptr: buf, allocated: true };
		},
		msync: (stream, bufferPtr, offset, length, mmapFlags) => {
			assert(offset === 0);
			return FS.handleError(__wasmfs_msync(bufferPtr, length, mmapFlags));
		},
		munmap: (addr, length) => FS.handleError(__wasmfs_munmap(addr, length)),
		symlink: (target, linkpath) =>
			withStackSave(() =>
				__wasmfs_symlink(
					stringToUTF8OnStack(target),
					stringToUTF8OnStack(linkpath)
				)
			),
		readlink(path) {
			var readBuffer = FS.handleError(
				withStackSave(() =>
					__wasmfs_readlink(stringToUTF8OnStack(path))
				)
			);
			return UTF8ToString(readBuffer);
		},
		statBufToObject(statBuf) {
			return {
				dev: HEAPU32[statBuf >> 2],
				mode: HEAPU32[(statBuf + 4) >> 2],
				nlink: HEAPU32[(statBuf + 8) >> 2],
				uid: HEAPU32[(statBuf + 12) >> 2],
				gid: HEAPU32[(statBuf + 16) >> 2],
				rdev: HEAPU32[(statBuf + 20) >> 2],
				size: readI53FromI64(statBuf + 24),
				blksize: HEAPU32[(statBuf + 32) >> 2],
				blocks: HEAPU32[(statBuf + 36) >> 2],
				atime: readI53FromI64(statBuf + 40),
				mtime: readI53FromI64(statBuf + 56),
				ctime: readI53FromI64(statBuf + 72),
				ino: readI53FromU64(statBuf + 88),
			};
		},
		stat(path) {
			var statBuf = _malloc(96);
			FS.handleError(
				withStackSave(() =>
					__wasmfs_stat(stringToUTF8OnStack(path), statBuf)
				)
			);
			var stats = FS.statBufToObject(statBuf);
			_free(statBuf);
			return stats;
		},
		lstat(path) {
			var statBuf = _malloc(96);
			FS.handleError(
				withStackSave(() =>
					__wasmfs_lstat(stringToUTF8OnStack(path), statBuf)
				)
			);
			var stats = FS.statBufToObject(statBuf);
			_free(statBuf);
			return stats;
		},
		chmod(path, mode) {
			return FS.handleError(
				withStackSave(() => {
					var buffer = stringToUTF8OnStack(path);
					return __wasmfs_chmod(buffer, mode);
				})
			);
		},
		lchmod(path, mode) {
			return FS.handleError(
				withStackSave(() => {
					var buffer = stringToUTF8OnStack(path);
					return __wasmfs_lchmod(buffer, mode);
				})
			);
		},
		fchmod(fd, mode) {
			return FS.handleError(__wasmfs_fchmod(fd, mode));
		},
		utime: (path, atime, mtime) =>
			FS.handleError(
				withStackSave(() =>
					__wasmfs_utime(stringToUTF8OnStack(path), atime, mtime)
				)
			),
		truncate(path, len) {
			return FS.handleError(
				withStackSave(() =>
					__wasmfs_truncate(
						stringToUTF8OnStack(path),
						len >>> 0,
						((tempDouble = len),
						+Math.abs(tempDouble) >= 1
							? tempDouble > 0
								? +Math.floor(tempDouble / 4294967296) >>> 0
								: ~~+Math.ceil(
										(tempDouble - +(~~tempDouble >>> 0)) /
											4294967296
								  ) >>> 0
							: 0)
					)
				)
			);
		},
		ftruncate(fd, len) {
			return FS.handleError(
				__wasmfs_ftruncate(
					fd,
					len >>> 0,
					((tempDouble = len),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? +Math.floor(tempDouble / 4294967296) >>> 0
							: ~~+Math.ceil(
									(tempDouble - +(~~tempDouble >>> 0)) /
										4294967296
							  ) >>> 0
						: 0)
				)
			);
		},
		findObject(path) {
			var result = withStackSave(() =>
				__wasmfs_identify(stringToUTF8OnStack(path))
			);
			if (result == 44) {
				return null;
			}
			return { isFolder: result == 31, isDevice: false };
		},
		readdir: (path) =>
			withStackSave(() => {
				var pathBuffer = stringToUTF8OnStack(path);
				var entries = [];
				var state = __wasmfs_readdir_start(pathBuffer);
				if (!state) {
					throw new Error('No such directory');
				}
				var entry;
				while ((entry = __wasmfs_readdir_get(state))) {
					entries.push(UTF8ToString(entry));
				}
				__wasmfs_readdir_finish(state);
				return entries;
			}),
		mount: (type, opts, mountpoint) => {
			var backendPointer = type.createBackend(opts);
			return FS.handleError(
				withStackSave(() =>
					__wasmfs_mount(
						stringToUTF8OnStack(mountpoint),
						backendPointer
					)
				)
			);
		},
		unmount: (mountpoint) =>
			FS.handleError(
				withStackSave(() =>
					__wasmfs_unmount(stringToUTF8OnStack(mountpoint))
				)
			),
		mknod: (path, mode, dev) => FS_mknod(path, mode, dev),
		makedev: (ma, mi) => (ma << 8) | mi,
		registerDevice(dev, ops) {
			var backendPointer = _wasmfs_create_jsimpl_backend();
			var definedOps = {
				userRead: ops.read,
				userWrite: ops.write,
				allocFile: (file) => {
					wasmFSDeviceStreams[file] = {};
				},
				freeFile: (file) => {
					wasmFSDeviceStreams[file] = undefined;
				},
				getSize: (file) => {},
				read: (file, buffer, length, offset) => {
					var bufferArray = Module.HEAP8.subarray(
						buffer,
						buffer + length
					);
					try {
						var bytesRead = definedOps.userRead(
							wasmFSDeviceStreams[file],
							bufferArray,
							0,
							length,
							offset
						);
					} catch (e) {
						return -e.errno;
					}
					Module.HEAP8.set(bufferArray, buffer);
					return bytesRead;
				},
				write: (file, buffer, length, offset) => {
					var bufferArray = Module.HEAP8.subarray(
						buffer,
						buffer + length
					);
					try {
						var bytesWritten = definedOps.userWrite(
							wasmFSDeviceStreams[file],
							bufferArray,
							0,
							length,
							offset
						);
					} catch (e) {
						return -e.errno;
					}
					Module.HEAP8.set(bufferArray, buffer);
					return bytesWritten;
				},
			};
			wasmFS$backends[backendPointer] = definedOps;
			wasmFSDevices[dev] = backendPointer;
		},
		createDevice(parent, name, input, output) {
			if (typeof parent != 'string') {
				throw new Error('Only string paths are accepted');
			}
			var path = PATH.join2(parent, name);
			var mode = FS_getMode(!!input, !!output);
			if (!FS.createDevice.major) FS.createDevice.major = 64;
			var dev = FS.makedev(FS.createDevice.major++, 0);
			FS.registerDevice(dev, {
				read(stream, buffer, offset, length, pos) {
					var bytesRead = 0;
					for (var i = 0; i < length; i++) {
						var result;
						try {
							result = input();
						} catch (e) {
							throw new FS.ErrnoError(29);
						}
						if (result === undefined && bytesRead === 0) {
							throw new FS.ErrnoError(6);
						}
						if (result === null || result === undefined) break;
						bytesRead++;
						buffer[offset + i] = result;
					}
					return bytesRead;
				},
				write(stream, buffer, offset, length, pos) {
					for (var i = 0; i < length; i++) {
						try {
							output(buffer[offset + i]);
						} catch (e) {
							throw new FS.ErrnoError(29);
						}
					}
					return i;
				},
			});
			return FS.mkdev(path, mode, dev);
		},
		mkdev(path, mode, dev) {
			if (typeof dev === 'undefined') {
				dev = mode;
				mode = 438;
			}
			var deviceBackend = wasmFSDevices[dev];
			if (!deviceBackend) {
				throw new Error('Invalid device ID.');
			}
			return FS.handleError(
				withStackSave(() =>
					_wasmfs_create_file(
						stringToUTF8OnStack(path),
						mode,
						deviceBackend
					)
				)
			);
		},
		rename(oldPath, newPath) {
			return FS.handleError(
				withStackSave(() => {
					var oldPathBuffer = stringToUTF8OnStack(oldPath);
					var newPathBuffer = stringToUTF8OnStack(newPath);
					return __wasmfs_rename(oldPathBuffer, newPathBuffer);
				})
			);
		},
		llseek(stream, offset, whence) {
			return FS.handleError(
				__wasmfs_llseek(
					stream.fd,
					offset >>> 0,
					((tempDouble = offset),
					+Math.abs(tempDouble) >= 1
						? tempDouble > 0
							? +Math.floor(tempDouble / 4294967296) >>> 0
							: ~~+Math.ceil(
									(tempDouble - +(~~tempDouble >>> 0)) /
										4294967296
							  ) >>> 0
						: 0),
					whence
				)
			);
		},
	};
	Module['FS'] = FS;
	var Asyncify = {
		instrumentWasmImports(imports) {
			var importPattern =
				/^(js_open_process|js_waitpid|js_process_status|js_create_input_device|wasm_setsockopt|wasm_shutdown|wasm_close|invoke_.*|__asyncjs__.*)$/;
			for (let [x, original] of Object.entries(imports)) {
				if (typeof original == 'function') {
					let isAsyncifyImport =
						original.isAsync || importPattern.test(x);
					if (isAsyncifyImport) {
						imports[x] = original = new WebAssembly.Suspending(
							original
						);
					}
				}
			}
		},
		instrumentWasmExports(exports) {
			var exportPattern =
				/^(php_wasm_init|wasm_sleep|wasm_read|emscripten_sleep|wasm_sapi_handle_request|wasm_sapi_request_shutdown|wasm_poll_socket|wrap_select|__wrap_select|select|php_pollfd_for|fflush|wasm_popen|wasm_read|wasm_php_exec|run_cli|main|__main_argc_argv)$/;
			Asyncify.asyncExports = new Set();
			var ret = {};
			for (let [x, original] of Object.entries(exports)) {
				if (typeof original == 'function') {
					let isAsyncifyExport = exportPattern.test(x);
					if (isAsyncifyExport) {
						Asyncify.asyncExports.add(original);
						original = Asyncify.makeAsyncFunction(original);
					}
					ret[x] = (...args) => original(...args);
				} else {
					ret[x] = original;
				}
			}
			return ret;
		},
		asyncExports: null,
		isAsyncExport(func) {
			return Asyncify.asyncExports?.has(func);
		},
		handleAsync: async (startAsync) => {
			runtimeKeepalivePush();
			try {
				return await startAsync();
			} finally {
				runtimeKeepalivePop();
			}
		},
		handleSleep(startAsync) {
			return Asyncify.handleAsync(() => new Promise(startAsync));
		},
		makeAsyncFunction(original) {
			return WebAssembly.promising(original);
		},
	};
	var getCFunc = (ident) => {
		var func = Module['_' + ident];
		return func;
	};
	var ccall = (ident, returnType, argTypes, args, opts) => {
		var toC = {
			string: (str) => {
				var ret = 0;
				if (str !== null && str !== undefined && str !== 0) {
					ret = stringToUTF8OnStack(str);
				}
				return ret;
			},
			array: (arr) => {
				var ret = stackAlloc(arr.length);
				writeArrayToMemory(arr, ret);
				return ret;
			},
		};
		function convertReturnValue(ret) {
			if (returnType === 'string') {
				return UTF8ToString(ret);
			}
			if (returnType === 'boolean') return Boolean(ret);
			return ret;
		}
		var func = getCFunc(ident);
		var cArgs = [];
		var stack = 0;
		if (args) {
			for (var i = 0; i < args.length; i++) {
				var converter = toC[argTypes[i]];
				if (converter) {
					if (stack === 0) stack = stackSave();
					cArgs[i] = converter(args[i]);
				} else {
					cArgs[i] = args[i];
				}
			}
		}
		var ret = func(...cArgs);
		function onDone(ret) {
			if (stack !== 0) stackRestore(stack);
			return convertReturnValue(ret);
		}
		var asyncMode = opts?.async;
		if (asyncMode) return ret.then(onDone);
		ret = onDone(ret);
		return ret;
	};
	var FS_createPath = FS.createPath;
	PHPWASM.init();
	FS.init();
	var wasmImports = {
		SharpYuvConvert: _SharpYuvConvert,
		SharpYuvGetConversionMatrix: _SharpYuvGetConversionMatrix,
		SharpYuvInit: _SharpYuvInit,
		__assert_fail: ___assert_fail,
		__asyncjs__js_module_onMessage: __asyncjs__js_module_onMessage,
		__asyncjs__js_popen_to_file: __asyncjs__js_popen_to_file,
		__asyncjs__wasm_poll_socket: __asyncjs__wasm_poll_socket,
		__call_sighandler: ___call_sighandler,
		_abort_js: __abort_js,
		_emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,
		_emscripten_lookup_name: __emscripten_lookup_name,
		_emscripten_memcpy_js: __emscripten_memcpy_js,
		_emscripten_runtime_keepalive_clear:
			__emscripten_runtime_keepalive_clear,
		_gmtime_js: __gmtime_js,
		_localtime_js: __localtime_js,
		_mktime_js: __mktime_js,
		_setitimer_js: __setitimer_js,
		_tzset_js: __tzset_js,
		_wasmfs_copy_preloaded_file_data: __wasmfs_copy_preloaded_file_data,
		_wasmfs_get_num_preloaded_dirs: __wasmfs_get_num_preloaded_dirs,
		_wasmfs_get_num_preloaded_files: __wasmfs_get_num_preloaded_files,
		_wasmfs_get_preloaded_child_path: __wasmfs_get_preloaded_child_path,
		_wasmfs_get_preloaded_file_mode: __wasmfs_get_preloaded_file_mode,
		_wasmfs_get_preloaded_file_size: __wasmfs_get_preloaded_file_size,
		_wasmfs_get_preloaded_parent_path: __wasmfs_get_preloaded_parent_path,
		_wasmfs_get_preloaded_path_name: __wasmfs_get_preloaded_path_name,
		_wasmfs_jsimpl_alloc_file: __wasmfs_jsimpl_alloc_file,
		_wasmfs_jsimpl_free_file: __wasmfs_jsimpl_free_file,
		_wasmfs_jsimpl_get_size: __wasmfs_jsimpl_get_size,
		_wasmfs_jsimpl_read: __wasmfs_jsimpl_read,
		_wasmfs_jsimpl_write: __wasmfs_jsimpl_write,
		_wasmfs_opfs_close_access: __wasmfs_opfs_close_access,
		_wasmfs_opfs_close_blob: __wasmfs_opfs_close_blob,
		_wasmfs_opfs_flush_access: __wasmfs_opfs_flush_access,
		_wasmfs_opfs_free_directory: __wasmfs_opfs_free_directory,
		_wasmfs_opfs_free_file: __wasmfs_opfs_free_file,
		_wasmfs_opfs_get_child: __wasmfs_opfs_get_child,
		_wasmfs_opfs_get_entries: __wasmfs_opfs_get_entries,
		_wasmfs_opfs_get_size_access: __wasmfs_opfs_get_size_access,
		_wasmfs_opfs_get_size_blob: __wasmfs_opfs_get_size_blob,
		_wasmfs_opfs_get_size_file: __wasmfs_opfs_get_size_file,
		_wasmfs_opfs_init_root_directory: __wasmfs_opfs_init_root_directory,
		_wasmfs_opfs_insert_directory: __wasmfs_opfs_insert_directory,
		_wasmfs_opfs_insert_file: __wasmfs_opfs_insert_file,
		_wasmfs_opfs_move_file: __wasmfs_opfs_move_file,
		_wasmfs_opfs_open_access: __wasmfs_opfs_open_access,
		_wasmfs_opfs_open_blob: __wasmfs_opfs_open_blob,
		_wasmfs_opfs_read_access: __wasmfs_opfs_read_access,
		_wasmfs_opfs_read_blob: __wasmfs_opfs_read_blob,
		_wasmfs_opfs_remove_child: __wasmfs_opfs_remove_child,
		_wasmfs_opfs_set_size_access: __wasmfs_opfs_set_size_access,
		_wasmfs_opfs_set_size_file: __wasmfs_opfs_set_size_file,
		_wasmfs_opfs_write_access: __wasmfs_opfs_write_access,
		_wasmfs_stdin_get_char: __wasmfs_stdin_get_char,
		emscripten_date_now: _emscripten_date_now,
		emscripten_err: _emscripten_err,
		emscripten_get_heap_max: _emscripten_get_heap_max,
		emscripten_get_now: _emscripten_get_now,
		emscripten_out: _emscripten_out,
		emscripten_resize_heap: _emscripten_resize_heap,
		emscripten_sleep: _emscripten_sleep,
		environ_get: _environ_get,
		environ_sizes_get: _environ_sizes_get,
		exit: _exit,
		getaddrinfo: _getaddrinfo,
		getentropy: _getentropy,
		getnameinfo: _getnameinfo,
		getprotobyname: _getprotobyname,
		getprotobynumber: _getprotobynumber,
		js_create_input_device: _js_create_input_device,
		js_open_process: _js_open_process,
		js_process_status: _js_process_status,
		js_waitpid: _js_waitpid,
		proc_exit: _proc_exit,
		strftime: _strftime,
		strftime_l: _strftime_l,
		strptime: _strptime,
	};
	var wasmExports = createWasm();
	var ___wasm_call_ctors = () =>
		(___wasm_call_ctors = wasmExports['__wasm_call_ctors'])();
	var _free = (a0) => (_free = wasmExports['free'])(a0);
	var _malloc = (a0) => (_malloc = wasmExports['malloc'])(a0);
	var _wasm_php_exec = (Module['_wasm_php_exec'] = (a0, a1, a2, a3) =>
		(_wasm_php_exec = Module['_wasm_php_exec'] =
			wasmExports['wasm_php_exec'])(a0, a1, a2, a3));
	var _htons = (a0) => (_htons = wasmExports['htons'])(a0);
	var _ntohs = (a0) => (_ntohs = wasmExports['ntohs'])(a0);
	var _htonl = (a0) => (_htonl = wasmExports['htonl'])(a0);
	var _wasm_sleep = (Module['_wasm_sleep'] = (a0) =>
		(_wasm_sleep = Module['_wasm_sleep'] = wasmExports['wasm_sleep'])(a0));
	var _wasm_popen = (Module['_wasm_popen'] = (a0, a1) =>
		(_wasm_popen = Module['_wasm_popen'] = wasmExports['wasm_popen'])(
			a0,
			a1
		));
	var ___wrap_select = (Module['___wrap_select'] = (a0, a1, a2, a3, a4) =>
		(___wrap_select = Module['___wrap_select'] =
			wasmExports['__wrap_select'])(a0, a1, a2, a3, a4));
	var _wasm_set_sapi_name = (Module['_wasm_set_sapi_name'] = (a0) =>
		(_wasm_set_sapi_name = Module['_wasm_set_sapi_name'] =
			wasmExports['wasm_set_sapi_name'])(a0));
	var _wasm_set_phpini_path = (Module['_wasm_set_phpini_path'] = (a0) =>
		(_wasm_set_phpini_path = Module['_wasm_set_phpini_path'] =
			wasmExports['wasm_set_phpini_path'])(a0));
	var _wasm_add_SERVER_entry = (Module['_wasm_add_SERVER_entry'] = (a0, a1) =>
		(_wasm_add_SERVER_entry = Module['_wasm_add_SERVER_entry'] =
			wasmExports['wasm_add_SERVER_entry'])(a0, a1));
	var _wasm_add_ENV_entry = (Module['_wasm_add_ENV_entry'] = (a0, a1) =>
		(_wasm_add_ENV_entry = Module['_wasm_add_ENV_entry'] =
			wasmExports['wasm_add_ENV_entry'])(a0, a1));
	var _wasm_set_query_string = (Module['_wasm_set_query_string'] = (a0) =>
		(_wasm_set_query_string = Module['_wasm_set_query_string'] =
			wasmExports['wasm_set_query_string'])(a0));
	var _wasm_set_path_translated = (Module['_wasm_set_path_translated'] = (
		a0
	) =>
		(_wasm_set_path_translated = Module['_wasm_set_path_translated'] =
			wasmExports['wasm_set_path_translated'])(a0));
	var _wasm_set_skip_shebang = (Module['_wasm_set_skip_shebang'] = (a0) =>
		(_wasm_set_skip_shebang = Module['_wasm_set_skip_shebang'] =
			wasmExports['wasm_set_skip_shebang'])(a0));
	var _wasm_set_request_uri = (Module['_wasm_set_request_uri'] = (a0) =>
		(_wasm_set_request_uri = Module['_wasm_set_request_uri'] =
			wasmExports['wasm_set_request_uri'])(a0));
	var _wasm_set_request_method = (Module['_wasm_set_request_method'] = (a0) =>
		(_wasm_set_request_method = Module['_wasm_set_request_method'] =
			wasmExports['wasm_set_request_method'])(a0));
	var _wasm_set_request_host = (Module['_wasm_set_request_host'] = (a0) =>
		(_wasm_set_request_host = Module['_wasm_set_request_host'] =
			wasmExports['wasm_set_request_host'])(a0));
	var _wasm_set_content_type = (Module['_wasm_set_content_type'] = (a0) =>
		(_wasm_set_content_type = Module['_wasm_set_content_type'] =
			wasmExports['wasm_set_content_type'])(a0));
	var _wasm_set_request_body = (Module['_wasm_set_request_body'] = (a0) =>
		(_wasm_set_request_body = Module['_wasm_set_request_body'] =
			wasmExports['wasm_set_request_body'])(a0));
	var _wasm_set_content_length = (Module['_wasm_set_content_length'] = (a0) =>
		(_wasm_set_content_length = Module['_wasm_set_content_length'] =
			wasmExports['wasm_set_content_length'])(a0));
	var _wasm_set_cookies = (Module['_wasm_set_cookies'] = (a0) =>
		(_wasm_set_cookies = Module['_wasm_set_cookies'] =
			wasmExports['wasm_set_cookies'])(a0));
	var _wasm_set_request_port = (Module['_wasm_set_request_port'] = (a0) =>
		(_wasm_set_request_port = Module['_wasm_set_request_port'] =
			wasmExports['wasm_set_request_port'])(a0));
	var _wasm_sapi_request_shutdown = (Module['_wasm_sapi_request_shutdown'] =
		() =>
			(_wasm_sapi_request_shutdown = Module[
				'_wasm_sapi_request_shutdown'
			] =
				wasmExports['wasm_sapi_request_shutdown'])());
	var _wasm_sapi_handle_request = (Module['_wasm_sapi_handle_request'] = () =>
		(_wasm_sapi_handle_request = Module['_wasm_sapi_handle_request'] =
			wasmExports['wasm_sapi_handle_request'])());
	var _php_wasm_init = (Module['_php_wasm_init'] = () =>
		(_php_wasm_init = Module['_php_wasm_init'] =
			wasmExports['php_wasm_init'])());
	var _wasm_free = (Module['_wasm_free'] = (a0) =>
		(_wasm_free = Module['_wasm_free'] = wasmExports['wasm_free'])(a0));
	var ___funcs_on_exit = () =>
		(___funcs_on_exit = wasmExports['__funcs_on_exit'])();
	var __emscripten_timeout = (a0, a1) =>
		(__emscripten_timeout = wasmExports['_emscripten_timeout'])(a0, a1);
	var ___trap = () => (___trap = wasmExports['__trap'])();
	var __emscripten_tempret_set = (a0) =>
		(__emscripten_tempret_set = wasmExports['_emscripten_tempret_set'])(a0);
	var __emscripten_stack_restore = (a0) =>
		(__emscripten_stack_restore = wasmExports['_emscripten_stack_restore'])(
			a0
		);
	var __emscripten_stack_alloc = (a0) =>
		(__emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'])(a0);
	var _emscripten_stack_get_current = (Module[
		'_emscripten_stack_get_current'
	] = () =>
		(_emscripten_stack_get_current = Module[
			'_emscripten_stack_get_current'
		] =
			wasmExports['emscripten_stack_get_current'])());
	var __wasmfs_read_file = (a0) =>
		(__wasmfs_read_file = wasmExports['_wasmfs_read_file'])(a0);
	var __wasmfs_write_file = (a0, a1, a2) =>
		(__wasmfs_write_file = wasmExports['_wasmfs_write_file'])(a0, a1, a2);
	var __wasmfs_mkdir = (a0, a1) =>
		(__wasmfs_mkdir = wasmExports['_wasmfs_mkdir'])(a0, a1);
	var __wasmfs_rmdir = (a0) =>
		(__wasmfs_rmdir = wasmExports['_wasmfs_rmdir'])(a0);
	var __wasmfs_open = (a0, a1, a2) =>
		(__wasmfs_open = wasmExports['_wasmfs_open'])(a0, a1, a2);
	var __wasmfs_allocate = (a0, a1, a2, a3, a4) =>
		(__wasmfs_allocate = wasmExports['_wasmfs_allocate'])(
			a0,
			a1,
			a2,
			a3,
			a4
		);
	var __wasmfs_mknod = (a0, a1, a2) =>
		(__wasmfs_mknod = wasmExports['_wasmfs_mknod'])(a0, a1, a2);
	var __wasmfs_unlink = (a0) =>
		(__wasmfs_unlink = wasmExports['_wasmfs_unlink'])(a0);
	var __wasmfs_chdir = (a0) =>
		(__wasmfs_chdir = wasmExports['_wasmfs_chdir'])(a0);
	var __wasmfs_symlink = (a0, a1) =>
		(__wasmfs_symlink = wasmExports['_wasmfs_symlink'])(a0, a1);
	var __wasmfs_readlink = (a0) =>
		(__wasmfs_readlink = wasmExports['_wasmfs_readlink'])(a0);
	var __wasmfs_write = (a0, a1, a2) =>
		(__wasmfs_write = wasmExports['_wasmfs_write'])(a0, a1, a2);
	var __wasmfs_pwrite = (a0, a1, a2, a3, a4) =>
		(__wasmfs_pwrite = wasmExports['_wasmfs_pwrite'])(a0, a1, a2, a3, a4);
	var __wasmfs_chmod = (a0, a1) =>
		(__wasmfs_chmod = wasmExports['_wasmfs_chmod'])(a0, a1);
	var __wasmfs_fchmod = (a0, a1) =>
		(__wasmfs_fchmod = wasmExports['_wasmfs_fchmod'])(a0, a1);
	var __wasmfs_lchmod = (a0, a1) =>
		(__wasmfs_lchmod = wasmExports['_wasmfs_lchmod'])(a0, a1);
	var __wasmfs_llseek = (a0, a1, a2, a3) =>
		(__wasmfs_llseek = wasmExports['_wasmfs_llseek'])(a0, a1, a2, a3);
	var __wasmfs_rename = (a0, a1) =>
		(__wasmfs_rename = wasmExports['_wasmfs_rename'])(a0, a1);
	var __wasmfs_read = (a0, a1, a2) =>
		(__wasmfs_read = wasmExports['_wasmfs_read'])(a0, a1, a2);
	var __wasmfs_pread = (a0, a1, a2, a3, a4) =>
		(__wasmfs_pread = wasmExports['_wasmfs_pread'])(a0, a1, a2, a3, a4);
	var __wasmfs_truncate = (a0, a1, a2) =>
		(__wasmfs_truncate = wasmExports['_wasmfs_truncate'])(a0, a1, a2);
	var __wasmfs_ftruncate = (a0, a1, a2) =>
		(__wasmfs_ftruncate = wasmExports['_wasmfs_ftruncate'])(a0, a1, a2);
	var __wasmfs_close = (a0) =>
		(__wasmfs_close = wasmExports['_wasmfs_close'])(a0);
	var __wasmfs_mmap = (a0, a1, a2, a3, a4, a5) =>
		(__wasmfs_mmap = wasmExports['_wasmfs_mmap'])(a0, a1, a2, a3, a4, a5);
	var __wasmfs_msync = (a0, a1, a2) =>
		(__wasmfs_msync = wasmExports['_wasmfs_msync'])(a0, a1, a2);
	var __wasmfs_munmap = (a0, a1) =>
		(__wasmfs_munmap = wasmExports['_wasmfs_munmap'])(a0, a1);
	var __wasmfs_utime = (a0, a1, a2) =>
		(__wasmfs_utime = wasmExports['_wasmfs_utime'])(a0, a1, a2);
	var __wasmfs_stat = (a0, a1) =>
		(__wasmfs_stat = wasmExports['_wasmfs_stat'])(a0, a1);
	var __wasmfs_lstat = (a0, a1) =>
		(__wasmfs_lstat = wasmExports['_wasmfs_lstat'])(a0, a1);
	var __wasmfs_mount = (a0, a1) =>
		(__wasmfs_mount = wasmExports['_wasmfs_mount'])(a0, a1);
	var __wasmfs_unmount = (a0) =>
		(__wasmfs_unmount = wasmExports['_wasmfs_unmount'])(a0);
	var __wasmfs_identify = (a0) =>
		(__wasmfs_identify = wasmExports['_wasmfs_identify'])(a0);
	var __wasmfs_readdir_start = (a0) =>
		(__wasmfs_readdir_start = wasmExports['_wasmfs_readdir_start'])(a0);
	var __wasmfs_readdir_get = (a0) =>
		(__wasmfs_readdir_get = wasmExports['_wasmfs_readdir_get'])(a0);
	var __wasmfs_readdir_finish = (a0) =>
		(__wasmfs_readdir_finish = wasmExports['_wasmfs_readdir_finish'])(a0);
	var __wasmfs_get_cwd = () =>
		(__wasmfs_get_cwd = wasmExports['_wasmfs_get_cwd'])();
	var _wasmfs_create_jsimpl_backend = () =>
		(_wasmfs_create_jsimpl_backend =
			wasmExports['wasmfs_create_jsimpl_backend'])();
	var __wasmfs_opfs_record_entry = (a0, a1, a2) =>
		(__wasmfs_opfs_record_entry = wasmExports['_wasmfs_opfs_record_entry'])(
			a0,
			a1,
			a2
		);
	var _wasmfs_create_file = (a0, a1, a2) =>
		(_wasmfs_create_file = wasmExports['wasmfs_create_file'])(a0, a1, a2);
	Module['addRunDependency'] = addRunDependency;
	Module['removeRunDependency'] = removeRunDependency;
	Module['wasmExports'] = wasmExports;
	Module['ccall'] = ccall;
	Module['FS_createPreloadedFile'] = FS_createPreloadedFile;
	Module['FS_unlink'] = FS_unlink;
	Module['FS_createPath'] = FS_createPath;
	Module['FS_createDataFile'] = FS_createDataFile;
	var calledRun;
	dependenciesFulfilled = function runCaller() {
		if (!calledRun) run();
		if (!calledRun) dependenciesFulfilled = runCaller;
	};
	function run() {
		if (runDependencies > 0) {
			return;
		}
		preRun();
		if (runDependencies > 0) {
			return;
		}
		function doRun() {
			if (calledRun) return;
			calledRun = true;
			Module['calledRun'] = true;
			if (ABORT) return;
			initRuntime();
			if (Module['onRuntimeInitialized'])
				Module['onRuntimeInitialized']();
			postRun();
		}
		if (Module['setStatus']) {
			Module['setStatus']('Running...');
			setTimeout(function () {
				setTimeout(function () {
					Module['setStatus']('');
				}, 1);
				doRun();
			}, 1);
		} else {
			doRun();
		}
	}
	if (Module['preInit']) {
		if (typeof Module['preInit'] == 'function')
			Module['preInit'] = [Module['preInit']];
		while (Module['preInit'].length > 0) {
			Module['preInit'].pop()();
		}
	}
	run();
	/**
	 * Emscripten resolves `localhost` to a random IP address. Let's
	 * make it always resolve to 127.0.0.1.
	 */
	DNS.address_map.addrs.localhost = '127.0.0.1';

	/**
	 * Debugging Asyncify errors is tricky because the stack trace is lost when the
	 * error is thrown. This code saves the stack trace in a global variable
	 * so that it can be inspected later.
	 */
	PHPLoader.debug = 'debug' in PHPLoader ? PHPLoader.debug : true;
	if (PHPLoader.debug && typeof Asyncify !== 'undefined') {
		const originalHandleSleep = Asyncify.handleSleep;
		Asyncify.handleSleep = function (startAsync) {
			if (!ABORT) {
				Module['lastAsyncifyStackSource'] = new Error();
			}
			return originalHandleSleep(startAsync);
		};
	}

	/**
	 * Data dependencies call removeRunDependency() when they are loaded.
	 * The synchronous call stack then continues to run. If an error occurs
	 * in PHP initialization, e.g. Out Of Memory error, it will not be
	 * caught by any try/catch. This override propagates the failure to
	 * PHPLoader.onAbort() so that it can be handled.
	 */
	const originalRemoveRunDependency = PHPLoader['removeRunDependency'];
	PHPLoader['removeRunDependency'] = function (...args) {
		try {
			originalRemoveRunDependency(...args);
		} catch (e) {
			PHPLoader['onAbort'](e);
		}
	};

	/**
	 * Other exports live in the Dockerfile in:
	 *
	 * * EXPORTED_RUNTIME_METHODS
	 * * EXPORTED_FUNCTIONS
	 *
	 * These exports, however, live in here because:
	 *
	 * * Listing them in EXPORTED_RUNTIME_METHODS doesn't actually
	 *   export them. This could be a bug in Emscripten or a consequence of
	 *   that option being deprecated.
	 * * Listing them in EXPORTED_FUNCTIONS works, but they are overridden
	 *   on every `BasePHP.run()` call. This is a problem because we want to
	 *   spy on these calls in some unit tests.
	 *
	 * Therefore, we export them here.
	 */
	PHPLoader['malloc'] = _malloc;
	PHPLoader['free'] =
		typeof _free === 'function' ? _free : PHPLoader['_wasm_free'];

	return PHPLoader;

	// Close the opening bracket from esm-prefix.js:
}
