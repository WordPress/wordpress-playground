import dependencyFilename from './8_3_33/php_8_3.wasm';
export { dependencyFilename };
export const dependenciesTotalSize = 18031719;
const phpVersionString = '8.3.33';
export function init(RuntimeName, PHPLoader) {
	// The rest of the code comes from the built php.js file and esm-suffix.js
	var Module = typeof PHPLoader != 'undefined' ? PHPLoader : {};
	var ENVIRONMENT_IS_WEB = RuntimeName === 'WEB';
	var ENVIRONMENT_IS_WORKER = RuntimeName === 'WORKER';
	var ENVIRONMENT_IS_NODE = RuntimeName === 'NODE';
	var arguments_ = [];
	var thisProgram = './this.program';
	var quit_ = (status, toThrow) => {
		throw toThrow;
	};
	var _scriptName = globalThis.document?.currentScript?.src;
	if (ENVIRONMENT_IS_WORKER) {
		_scriptName = self.location.href;
	}
	var scriptDirectory = '';
	function locateFile(path) {
		if (Module['locateFile']) {
			return Module['locateFile'](path, scriptDirectory);
		}
		return scriptDirectory + path;
	}
	var readAsync, readBinary;
	if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
		try {
			scriptDirectory = new URL('.', _scriptName).href;
		} catch {}
		{
			if (ENVIRONMENT_IS_WORKER) {
				readBinary = (url) => {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', url, false);
					xhr.responseType = 'arraybuffer';
					xhr.send(null);
					return new Uint8Array(xhr.response);
				};
			}
			readAsync = async (url) => {
				var response = await fetch(url, { credentials: 'same-origin' });
				if (response.ok) {
					return response.arrayBuffer();
				}
				throw new Error(response.status + ' : ' + response.url);
			};
		}
	} else {
	}
	var out = console.log.bind(console);
	var err = console.error.bind(console);
	var dynamicLibraries = [];
	var wasmBinary;
	var ABORT = false;
	var EXITSTATUS;
	var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
	var HEAP64, HEAPU64;
	var runtimeInitialized = false;
	var runtimeExited = false;
	function updateMemoryViews() {
		var b = wasmMemory.buffer;
		HEAP8 = new Int8Array(b);
		HEAP16 = new Int16Array(b);
		Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
		HEAPU16 = new Uint16Array(b);
		HEAP32 = new Int32Array(b);
		Module['HEAPU32'] = HEAPU32 = new Uint32Array(b);
		HEAPF32 = new Float32Array(b);
		HEAPF64 = new Float64Array(b);
		HEAP64 = new BigInt64Array(b);
		HEAPU64 = new BigUint64Array(b);
	}
	var __RELOC_FUNCS__ = [];
	function preRun() {
		if (Module['preRun']) {
			if (typeof Module['preRun'] == 'function')
				Module['preRun'] = [Module['preRun']];
			while (Module['preRun'].length) {
				addOnPreRun(Module['preRun'].shift());
			}
		}
		callRuntimeCallbacks(onPreRuns);
	}
	function initRuntime() {
		runtimeInitialized = true;
		callRuntimeCallbacks(__RELOC_FUNCS__);
		callRuntimeCallbacks(onInits);
		if (!Module['noFSInit'] && !FS.initialized) FS.init();
		TTY.init();
		SOCKFS.root = FS.mount(SOCKFS, {}, null);
		PIPEFS.root = FS.mount(PIPEFS, {}, null);
		wasmExports['__wasm_call_ctors']();
		callRuntimeCallbacks(onPostCtors);
		FS.ignorePermissions = false;
	}
	function preMain() {}
	function exitRuntime() {
		___funcs_on_exit();
		FS.quit();
		TTY.shutdown();
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
		callRuntimeCallbacks(onPostRuns);
	}
	function abort(what) {
		Module['onAbort']?.(what);
		what = 'Aborted(' + what + ')';
		err(what);
		ABORT = true;
		what += '. Build with -sASSERTIONS for more info.';
		if (runtimeInitialized) {
			___trap();
		}
		var e = new WebAssembly.RuntimeError(what);
		throw e;
	}
	var wasmBinaryFile;
	function findWasmBinary() {
		return locateFile(dependencyFilename);
	}
	function getBinarySync(file) {
		if (file == wasmBinaryFile && wasmBinary) {
			return new Uint8Array(wasmBinary);
		}
		if (readBinary) {
			return readBinary(file);
		}
		throw 'both async and sync fetching of the wasm failed';
	}
	async function getWasmBinary(binaryFile) {
		if (!wasmBinary) {
			try {
				var response = await readAsync(binaryFile);
				return new Uint8Array(response);
			} catch {}
		}
		return getBinarySync(binaryFile);
	}
	async function instantiateArrayBuffer(binaryFile, imports) {
		try {
			var binary = await getWasmBinary(binaryFile);
			var instance = await WebAssembly.instantiate(binary, imports);
			return instance;
		} catch (reason) {
			err(`failed to asynchronously prepare wasm: ${reason}`);
			abort(reason);
		}
	}
	async function instantiateAsync(binary, binaryFile, imports) {
		if (!binary) {
			try {
				var response = fetch(binaryFile, {
					credentials: 'same-origin',
				});
				var instantiationResult =
					await WebAssembly.instantiateStreaming(response, imports);
				return instantiationResult;
			} catch (reason) {
				err(`wasm streaming compile failed: ${reason}`);
				err('falling back to ArrayBuffer instantiation');
			}
		}
		return instantiateArrayBuffer(binaryFile, imports);
	}
	function getWasmImports() {
		Asyncify.instrumentWasmImports(wasmImports);
		wasmImports['__c_longjmp'] ??= new WebAssembly.Tag({
			parameters: ['i32'],
		});
		var imports = {
			env: wasmImports,
			wasi_snapshot_preview1: wasmImports,
			'GOT.mem': new Proxy(wasmImports, GOTHandler),
			'GOT.func': new Proxy(wasmImports, GOTHandler),
		};
		return imports;
	}
	async function createWasm() {
		function receiveInstance(instance, module) {
			wasmExports = instance.exports;
			var origExports = (wasmExports = relocateExports(wasmExports));
			wasmExports = Asyncify.instrumentWasmExports(wasmExports);
			mergeLibSymbols(wasmExports, 'main');
			var metadata = getDylinkMetadata(module);
			if (metadata.neededDynlibs) {
				dynamicLibraries =
					metadata.neededDynlibs.concat(dynamicLibraries);
			}
			assignWasmExports(wasmExports);
			updateGOT(origExports);
			Module['wasmExports'] = wasmExports;
			LDSO.init();
			loadDylibs();
			updateMemoryViews();
			removeRunDependency('wasm-instantiate');
			return wasmExports;
		}
		addRunDependency('wasm-instantiate');
		function receiveInstantiationResult(result) {
			return receiveInstance(result['instance'], result['module']);
		}
		var info = getWasmImports();
		if (Module['instantiateWasm']) {
			return new Promise((resolve, reject) => {
				Module['instantiateWasm'](info, (inst, mod) => {
					resolve(receiveInstance(inst, mod));
				});
			});
		}
		wasmBinaryFile ??= findWasmBinary();
		var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
		var exports = receiveInstantiationResult(result);
		return exports;
	}
	var asyncifyStubs = {};
	class ExitStatus {
		name = 'ExitStatus';
		constructor(status) {
			this.message = `Program terminated with exit(${status})`;
			this.status = status;
		}
	}
	ExitStatus = class PHPExitStatus extends Error {
		constructor(status) {
			super(status);
			this.name = 'ExitStatus';
			this.message = 'Program terminated with exit(' + status + ')';
			this.status = status;
		}
	};
	var GOT = {};
	var currentModuleWeakSymbols = new Set([]);
	var GOTHandler = {
		get(obj, symName) {
			var rtn = GOT[symName];
			if (!rtn) {
				rtn = GOT[symName] = new WebAssembly.Global(
					{ value: 'i32', mutable: true },
					-1
				);
			}
			if (!currentModuleWeakSymbols.has(symName)) {
				rtn.required = true;
			}
			return rtn;
		},
	};
	var callRuntimeCallbacks = (callbacks) => {
		while (callbacks.length > 0) {
			callbacks.shift()(Module);
		}
	};
	var onPostRuns = [];
	var addOnPostRun = (cb) => onPostRuns.push(cb);
	var onPreRuns = [];
	var addOnPreRun = (cb) => onPreRuns.push(cb);
	var runDependencies = 0;
	var dependenciesFulfilled = null;
	var removeRunDependency = (id) => {
		runDependencies--;
		Module['monitorRunDependencies']?.(runDependencies);
		if (runDependencies == 0) {
			if (dependenciesFulfilled) {
				var callback = dependenciesFulfilled;
				dependenciesFulfilled = null;
				callback();
			}
		}
	};
	var addRunDependency = (id) => {
		runDependencies++;
		Module['monitorRunDependencies']?.(runDependencies);
	};
	var UTF8Decoder = globalThis.TextDecoder && new TextDecoder();
	var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
		var maxIdx = idx + maxBytesToRead;
		if (ignoreNul) return maxIdx;
		while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
		return idx;
	};
	var UTF8ArrayToString = (
		heapOrArray,
		idx = 0,
		maxBytesToRead,
		ignoreNul
	) => {
		var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
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
	var getDylinkMetadata = (binary) => {
		var offset = 0;
		var end = 0;
		function getU8() {
			return binary[offset++];
		}
		function getLEB() {
			var ret = 0;
			var mul = 1;
			while (1) {
				var byte = binary[offset++];
				ret += (byte & 127) * mul;
				mul *= 128;
				if (!(byte & 128)) break;
			}
			return ret;
		}
		function getString() {
			var len = getLEB();
			offset += len;
			return UTF8ArrayToString(binary, offset - len, len);
		}
		function getStringList() {
			var count = getLEB();
			var rtn = [];
			while (count--) rtn.push(getString());
			return rtn;
		}
		function failIf(condition, message) {
			if (condition) throw new Error(message);
		}
		if (binary instanceof WebAssembly.Module) {
			var dylinkSection = WebAssembly.Module.customSections(
				binary,
				'dylink.0'
			);
			failIf(dylinkSection.length === 0, 'need dylink section');
			binary = new Uint8Array(dylinkSection[0]);
			end = binary.length;
		} else {
			var int32View = new Uint32Array(
				new Uint8Array(binary.subarray(0, 24)).buffer
			);
			var magicNumberFound = int32View[0] == 1836278016;
			failIf(!magicNumberFound, 'need to see wasm magic number');
			failIf(binary[8] !== 0, 'need the dylink section to be first');
			offset = 9;
			var section_size = getLEB();
			end = offset + section_size;
			var name = getString();
			failIf(name !== 'dylink.0');
		}
		var customSection = {
			neededDynlibs: [],
			tlsExports: new Set(),
			weakImports: new Set(),
			runtimePaths: [],
		};
		var WASM_DYLINK_MEM_INFO = 1;
		var WASM_DYLINK_NEEDED = 2;
		var WASM_DYLINK_EXPORT_INFO = 3;
		var WASM_DYLINK_IMPORT_INFO = 4;
		var WASM_DYLINK_RUNTIME_PATH = 5;
		var WASM_SYMBOL_TLS = 256;
		var WASM_SYMBOL_BINDING_MASK = 3;
		var WASM_SYMBOL_BINDING_WEAK = 1;
		while (offset < end) {
			var subsectionType = getU8();
			var subsectionSize = getLEB();
			if (subsectionType === WASM_DYLINK_MEM_INFO) {
				customSection.memorySize = getLEB();
				customSection.memoryAlign = getLEB();
				customSection.tableSize = getLEB();
				customSection.tableAlign = getLEB();
			} else if (subsectionType === WASM_DYLINK_NEEDED) {
				customSection.neededDynlibs = getStringList();
			} else if (subsectionType === WASM_DYLINK_EXPORT_INFO) {
				var count = getLEB();
				while (count--) {
					var symname = getString();
					var flags = getLEB();
					if (flags & WASM_SYMBOL_TLS) {
						customSection.tlsExports.add(symname);
					}
				}
			} else if (subsectionType === WASM_DYLINK_IMPORT_INFO) {
				var count = getLEB();
				while (count--) {
					var modname = getString();
					var symname = getString();
					var flags = getLEB();
					if (
						(flags & WASM_SYMBOL_BINDING_MASK) ==
						WASM_SYMBOL_BINDING_WEAK
					) {
						customSection.weakImports.add(symname);
					}
				}
			} else if (subsectionType === WASM_DYLINK_RUNTIME_PATH) {
				customSection.runtimePaths = getStringList();
			} else {
				offset += subsectionSize;
			}
		}
		return customSection;
	};
	var newDSO = (name, handle, syms) => {
		var dso = { refcount: Infinity, name, exports: syms, global: true };
		LDSO.loadedLibsByName[name] = dso;
		if (handle != undefined) {
			LDSO.loadedLibsByHandle[handle] = dso;
		}
		return dso;
	};
	var LDSO = {
		loadedLibsByName: {},
		loadedLibsByHandle: {},
		init() {
			newDSO('__main__', 0, wasmImports);
		},
	};
	var alignMemory = (size, alignment) =>
		Math.ceil(size / alignment) * alignment;
	var getMemory = (size) => {
		if (runtimeInitialized) {
			return _calloc(size, 1);
		}
		var ret = ___heap_base;
		var end = ret + alignMemory(size, 16);
		___heap_base = end;
		var sbrk_ptr = _emscripten_get_sbrk_ptr();
		HEAPU32[sbrk_ptr >> 2] = end;
		return ret;
	};
	var isInternalSym = (symName) =>
		[
			'memory',
			'__memory_base',
			'__table_base',
			'__stack_pointer',
			'__indirect_function_table',
			'__cpp_exception',
			'__c_longjmp',
			'__wasm_apply_data_relocs',
			'__dso_handle',
			'__tls_size',
			'__tls_align',
			'__set_stack_limits',
			'_emscripten_tls_init',
			'__wasm_init_tls',
			'__wasm_call_ctors',
			'__start_em_asm',
			'__stop_em_asm',
			'__start_em_js',
			'__stop_em_js',
		].includes(symName) || symName.startsWith('__em_js__');
	var wasmTableMirror = [];
	var getWasmTableEntry = (funcPtr) => {
		var func = wasmTableMirror[funcPtr];
		if (!func) {
			wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
			if (Asyncify.isAsyncExport(func)) {
				wasmTableMirror[funcPtr] = func =
					Asyncify.makeAsyncFunction(func);
			}
		}
		return func;
	};
	var updateTableMap = (offset, count) => {
		if (functionsInTableMap) {
			for (var i = offset; i < offset + count; i++) {
				var item = getWasmTableEntry(i);
				if (item) {
					functionsInTableMap.set(item, i);
				}
			}
		}
	};
	var functionsInTableMap;
	var getFunctionAddress = (func) => {
		if (!functionsInTableMap) {
			functionsInTableMap = new WeakMap();
			updateTableMap(0, wasmTable.length);
		}
		return functionsInTableMap.get(func) || 0;
	};
	var freeTableIndexes = [];
	var getEmptyTableSlot = () => {
		if (freeTableIndexes.length) {
			return freeTableIndexes.pop();
		}
		return wasmTable['grow'](1);
	};
	var setWasmTableEntry = (idx, func) => {
		wasmTable.set(idx, func);
		wasmTableMirror[idx] = wasmTable.get(idx);
	};
	var uleb128EncodeWithLen = (arr) => {
		const n = arr.length;
		return [(n % 128) | 128, n >> 7, ...arr];
	};
	var wasmTypeCodes = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 };
	var generateTypePack = (types) =>
		uleb128EncodeWithLen(
			Array.from(types, (type) => {
				var code = wasmTypeCodes[type];
				return code;
			})
		);
	var convertJsFunctionToWasm = (func, sig) => {
		var bytes = Uint8Array.of(
			0,
			97,
			115,
			109,
			1,
			0,
			0,
			0,
			1,
			...uleb128EncodeWithLen([
				1,
				96,
				...generateTypePack(sig.slice(1)),
				...generateTypePack(sig[0] === 'v' ? '' : sig[0]),
			]),
			2,
			7,
			1,
			1,
			101,
			1,
			102,
			0,
			0,
			7,
			5,
			1,
			1,
			102,
			0,
			0
		);
		var module = new WebAssembly.Module(bytes);
		var instance = new WebAssembly.Instance(module, { e: { f: func } });
		var wrappedFunc = instance.exports['f'];
		return wrappedFunc;
	};
	var addFunction = (func, sig) => {
		var rtn = getFunctionAddress(func);
		if (rtn) {
			return rtn;
		}
		var ret = getEmptyTableSlot();
		try {
			setWasmTableEntry(ret, func);
		} catch (err) {
			if (!(err instanceof TypeError)) {
				throw err;
			}
			var wrapped = convertJsFunctionToWasm(func, sig);
			setWasmTableEntry(ret, wrapped);
		}
		functionsInTableMap.set(func, ret);
		return ret;
	};
	var updateGOT = (exports, replace) => {
		for (var symName in exports) {
			if (isInternalSym(symName)) {
				continue;
			}
			var value = exports[symName];
			var existingEntry = GOT[symName] && GOT[symName].value != -1;
			if (replace || !existingEntry) {
				var newValue;
				if (typeof value == 'function') {
					newValue = addFunction(value);
				} else if (typeof value == 'number') {
					newValue = value;
				} else {
					continue;
				}
				GOT[symName] ??= new WebAssembly.Global({
					value: 'i32',
					mutable: true,
				});
				GOT[symName].value = newValue;
			}
		}
	};
	var isImmutableGlobal = (val) => {
		if (val instanceof WebAssembly.Global) {
			try {
				val.value = val.value;
			} catch {
				return true;
			}
		}
		return false;
	};
	var relocateExports = (exports, memoryBase = 0) => {
		function relocateExport(name, value) {
			if (isImmutableGlobal(value)) {
				return value.value + memoryBase;
			}
			return value;
		}
		var relocated = {};
		for (var e in exports) {
			relocated[e] = relocateExport(e, exports[e]);
		}
		return relocated;
	};
	var isSymbolDefined = (symName) => {
		var existing = wasmImports[symName];
		if (!existing || existing.stub) {
			return false;
		}
		if (symName in asyncifyStubs && !asyncifyStubs[symName]) {
			return false;
		}
		return true;
	};
	var resolveGlobalSymbol = (symName, direct = false) => {
		var sym;
		if (isSymbolDefined(symName)) {
			sym = wasmImports[symName];
		}
		return { sym, name: symName };
	};
	var onPostCtors = [];
	var addOnPostCtor = (cb) => onPostCtors.push(cb);
	var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) =>
		ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : '';
	var loadWebAssemblyModule = (
		binary,
		flags,
		libName,
		localScope,
		handle
	) => {
		var metadata = getDylinkMetadata(binary);
		function loadModule() {
			var memAlign = Math.pow(2, metadata.memoryAlign);
			var memoryBase = metadata.memorySize
				? alignMemory(
						getMemory(metadata.memorySize + memAlign),
						memAlign
					)
				: 0;
			var tableBase = metadata.tableSize ? wasmTable.length : 0;
			if (handle) {
				HEAP8[handle + 8] = 1;
				HEAPU32[(handle + 12) >> 2] = memoryBase;
				HEAP32[(handle + 16) >> 2] = metadata.memorySize;
				HEAPU32[(handle + 20) >> 2] = tableBase;
				HEAP32[(handle + 24) >> 2] = metadata.tableSize;
			}
			if (metadata.tableSize) {
				wasmTable.grow(metadata.tableSize);
			}
			var moduleExports;
			function resolveSymbol(sym) {
				var resolved = resolveGlobalSymbol(sym).sym;
				if (!resolved && localScope) {
					resolved = localScope[sym];
				}
				if (!resolved) {
					resolved = moduleExports[sym];
				}
				return resolved;
			}
			var proxyHandler = {
				get(stubs, prop) {
					switch (prop) {
						case '__memory_base':
							return memoryBase;
						case '__table_base':
							return tableBase;
					}
					if (prop in wasmImports && !wasmImports[prop].stub) {
						var res = wasmImports[prop];
						if (res.orig) {
							res = res.orig;
						}
						return res;
					}
					if (!(prop in stubs)) {
						var resolved;
						stubs[prop] = (...args) => {
							resolved ||= resolveSymbol(prop);
							return resolved(...args);
						};
					}
					return stubs[prop];
				},
			};
			var proxy = new Proxy({}, proxyHandler);
			currentModuleWeakSymbols = metadata.weakImports;
			var info = {
				'GOT.mem': new Proxy({}, GOTHandler),
				'GOT.func': new Proxy({}, GOTHandler),
				env: proxy,
				wasi_snapshot_preview1: proxy,
			};
			function postInstantiation(module, instance) {
				updateTableMap(tableBase, metadata.tableSize);
				moduleExports = relocateExports(instance.exports, memoryBase);
				updateGOT(moduleExports);
				moduleExports = Asyncify.instrumentWasmExports(moduleExports);
				if (!flags.allowUndefined) {
					reportUndefinedSymbols();
				}
				function addEmAsm(addr, body) {
					var args = [];
					for (var arity = 0; ; arity++) {
						var argName = '$' + arity;
						if (!body.includes(argName)) break;
						args.push(argName);
					}
					args = args.join(',');
					var func = `(${args}) => { ${body} };`;
					ASM_CONSTS[start] = eval(func);
				}
				if ('__start_em_asm' in moduleExports) {
					var start = moduleExports['__start_em_asm'];
					var stop = moduleExports['__stop_em_asm'];
					while (start < stop) {
						var jsString = UTF8ToString(start);
						addEmAsm(start, jsString);
						start = HEAPU8.indexOf(0, start) + 1;
					}
				}
				function addEmJs(name, cSig, body) {
					var jsArgs = [];
					cSig = cSig.slice(1, -1);
					if (cSig != 'void') {
						cSig = cSig.split(',');
						for (var arg of cSig) {
							var jsArg = arg.split(' ').pop();
							jsArgs.push(jsArg.replace('*', ''));
						}
					}
					var func = `(${jsArgs}) => ${body};`;
					moduleExports[name] = eval(func);
				}
				for (var name in moduleExports) {
					if (name.startsWith('__em_js__')) {
						var start = moduleExports[name];
						var jsString = UTF8ToString(start);
						var [sig, body] = jsString.split('<::>');
						addEmJs(name.replace('__em_js__', ''), sig, body);
						delete moduleExports[name];
					}
				}
				var applyRelocs = moduleExports['__wasm_apply_data_relocs'];
				if (applyRelocs) {
					if (runtimeInitialized) {
						applyRelocs();
					} else {
						__RELOC_FUNCS__.push(applyRelocs);
					}
				}
				var init = moduleExports['__wasm_call_ctors'];
				if (init) {
					if (runtimeInitialized) {
						init();
					} else {
						addOnPostCtor(init);
					}
				}
				return moduleExports;
			}
			if (flags.loadAsync) {
				return (async () => {
					var instance;
					if (binary instanceof WebAssembly.Module) {
						instance = new WebAssembly.Instance(binary, info);
					} else {
						({ module: binary, instance } =
							await WebAssembly.instantiate(binary, info));
					}
					return postInstantiation(binary, instance);
				})();
			}
			var module =
				binary instanceof WebAssembly.Module
					? binary
					: new WebAssembly.Module(binary);
			var instance = new WebAssembly.Instance(module, info);
			return postInstantiation(module, instance);
		}
		flags = {
			...flags,
			rpath: { parentLibPath: libName, paths: metadata.runtimePaths },
		};
		if (flags.loadAsync) {
			return metadata.neededDynlibs
				.reduce(
					(chain, dynNeeded) =>
						chain.then(() =>
							loadDynamicLibrary(dynNeeded, flags, localScope)
						),
					Promise.resolve()
				)
				.then(loadModule);
		}
		for (var needed of metadata.neededDynlibs) {
			loadDynamicLibrary(needed, flags, localScope);
		}
		return loadModule();
	};
	var mergeLibSymbols = (exports, libName) => {
		for (var [sym, exp] of Object.entries(exports)) {
			const setImport = (target) => {
				if (target in asyncifyStubs) {
					asyncifyStubs[target] = exp;
				}
				if (!isSymbolDefined(target)) {
					wasmImports[target] = exp;
				}
			};
			setImport(sym);
			const main_alias = '__main_argc_argv';
			if (sym == 'main') {
				setImport(main_alias);
			}
			if (sym == main_alias) {
				setImport('main');
			}
		}
	};
	var asyncLoad = async (url) => {
		var arrayBuffer = await readAsync(url);
		return new Uint8Array(arrayBuffer);
	};
	var preloadPlugins = [];
	var registerWasmPlugin = () => {
		var wasmPlugin = {
			promiseChainEnd: Promise.resolve(),
			canHandle: (name) =>
				!Module['noWasmDecoding'] && name.endsWith('.so'),
			handle: async (byteArray, name) =>
				(wasmPlugin.promiseChainEnd = wasmPlugin.promiseChainEnd.then(
					async () => {
						try {
							var exports = await loadWebAssemblyModule(
								byteArray,
								{ loadAsync: true, nodelete: true },
								name,
								{}
							);
						} catch (error) {
							throw new Error(
								`failed to instantiate wasm: ${name}: ${error}`
							);
						}
						preloadedWasm[name] = exports;
						return byteArray;
					}
				)),
		};
		preloadPlugins.push(wasmPlugin);
	};
	var preloadedWasm = {};
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
				trailingSlash = path.slice(-1) === '/';
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
				dir = dir.slice(0, -1);
			}
			return root + dir;
		},
		basename: (path) => path && path.match(/([^\/]+|\/)\/*$/)[1],
		join: (...paths) => PATH.normalize(paths.join('/')),
		join2: (l, r) => PATH.normalize(l + '/' + r),
	};
	var replaceORIGIN = (parentLibName, rpath) => {
		if (rpath.startsWith('$ORIGIN')) {
			var origin = PATH.dirname(parentLibName);
			return rpath.replace('$ORIGIN', origin);
		}
		return rpath;
	};
	var stackSave = () => _emscripten_stack_get_current();
	var stackRestore = (val) => __emscripten_stack_restore(val);
	var withStackSave = (f) => {
		var stack = stackSave();
		var ret = f();
		stackRestore(stack);
		return ret;
	};
	var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
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
	var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
		if (!(maxBytesToWrite > 0)) return 0;
		var startIdx = outIdx;
		var endIdx = outIdx + maxBytesToWrite - 1;
		for (var i = 0; i < str.length; ++i) {
			var u = str.codePointAt(i);
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
				i++;
			}
		}
		heap[outIdx] = 0;
		return outIdx - startIdx;
	};
	var stringToUTF8 = (str, outPtr, maxBytesToWrite) =>
		stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
	var stringToUTF8OnStack = (str) => {
		var size = lengthBytesUTF8(str) + 1;
		var ret = stackAlloc(size);
		stringToUTF8(str, ret, size);
		return ret;
	};
	var initRandomFill = () => (view) => crypto.getRandomValues(view);
	var randomFill = (view) => {
		(randomFill = initRandomFill())(view);
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
			from = PATH_FS.resolve(from).slice(1);
			to = PATH_FS.resolve(to).slice(1);
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
	var FS_stdin_getChar_buffer = [];
	var intArrayFromString = (stringy, dontAddNull, length) => {
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
	};
	var FS_stdin_getChar = () => {
		if (!FS_stdin_getChar_buffer.length) {
			var result = null;
			if (globalThis.window?.prompt) {
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
	var TTY = {
		ttys: [],
		init() {},
		shutdown() {},
		register(dev, ops) {
			TTY.ttys[dev] = { input: [], output: [], ops };
			FS.registerDevice(dev, TTY.stream_ops);
		},
		stream_ops: {
			open(stream) {
				var tty = TTY.ttys[stream.node.rdev];
				if (!tty) {
					throw new FS.ErrnoError(43);
				}
				stream.tty = tty;
				stream.seekable = false;
			},
			close(stream) {
				stream.tty.ops.fsync(stream.tty);
			},
			fsync(stream) {
				stream.tty.ops.fsync(stream.tty);
			},
			read(stream, buffer, offset, length, pos) {
				if (!stream.tty || !stream.tty.ops.get_char) {
					throw new FS.ErrnoError(60);
				}
				var bytesRead = 0;
				for (var i = 0; i < length; i++) {
					var result;
					try {
						result = stream.tty.ops.get_char(stream.tty);
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
				if (bytesRead) {
					stream.node.atime = Date.now();
				}
				return bytesRead;
			},
			write(stream, buffer, offset, length, pos) {
				if (!stream.tty || !stream.tty.ops.put_char) {
					throw new FS.ErrnoError(60);
				}
				try {
					for (var i = 0; i < length; i++) {
						stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
					}
				} catch (e) {
					throw new FS.ErrnoError(29);
				}
				if (length) {
					stream.node.mtime = stream.node.ctime = Date.now();
				}
				return i;
			},
		},
		default_tty_ops: {
			get_char(tty) {
				return FS_stdin_getChar();
			},
			put_char(tty, val) {
				if (val === null || val === 10) {
					out(UTF8ArrayToString(tty.output));
					tty.output = [];
				} else {
					if (val != 0) tty.output.push(val);
				}
			},
			fsync(tty) {
				if (tty.output?.length > 0) {
					out(UTF8ArrayToString(tty.output));
					tty.output = [];
				}
			},
			ioctl_tcgets(tty) {
				return {
					c_iflag: 25856,
					c_oflag: 5,
					c_cflag: 191,
					c_lflag: 35387,
					c_cc: [
						3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23,
						22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
					],
				};
			},
			ioctl_tcsets(tty, optional_actions, data) {
				return 0;
			},
			ioctl_tiocgwinsz(tty) {
				return [24, 80];
			},
		},
		default_tty1_ops: {
			put_char(tty, val) {
				if (val === null || val === 10) {
					err(UTF8ArrayToString(tty.output));
					tty.output = [];
				} else {
					if (val != 0) tty.output.push(val);
				}
			},
			fsync(tty) {
				if (tty.output?.length > 0) {
					err(UTF8ArrayToString(tty.output));
					tty.output = [];
				}
			},
		},
	};
	var zeroMemory = (ptr, size) => HEAPU8.fill(0, ptr, ptr + size);
	var mmapAlloc = (size) => {
		size = alignMemory(size, 65536);
		var ptr = _emscripten_builtin_memalign(65536, size);
		if (ptr) zeroMemory(ptr, size);
		return ptr;
	};
	var MEMFS = {
		ops_table: null,
		mount(mount) {
			return MEMFS.createNode(null, '/', 16895, 0);
		},
		createNode(parent, name, mode, dev) {
			if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
				throw new FS.ErrnoError(63);
			}
			MEMFS.ops_table ||= {
				dir: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr,
						lookup: MEMFS.node_ops.lookup,
						mknod: MEMFS.node_ops.mknod,
						rename: MEMFS.node_ops.rename,
						unlink: MEMFS.node_ops.unlink,
						rmdir: MEMFS.node_ops.rmdir,
						readdir: MEMFS.node_ops.readdir,
						symlink: MEMFS.node_ops.symlink,
					},
					stream: { llseek: MEMFS.stream_ops.llseek },
				},
				file: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr,
					},
					stream: {
						llseek: MEMFS.stream_ops.llseek,
						read: MEMFS.stream_ops.read,
						write: MEMFS.stream_ops.write,
						mmap: MEMFS.stream_ops.mmap,
						msync: MEMFS.stream_ops.msync,
					},
				},
				link: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr,
						readlink: MEMFS.node_ops.readlink,
					},
					stream: {},
				},
				chrdev: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr,
					},
					stream: FS.chrdev_stream_ops,
				},
			};
			var node = FS.createNode(parent, name, mode, dev);
			if (FS.isDir(node.mode)) {
				node.node_ops = MEMFS.ops_table.dir.node;
				node.stream_ops = MEMFS.ops_table.dir.stream;
				node.contents = {};
			} else if (FS.isFile(node.mode)) {
				node.node_ops = MEMFS.ops_table.file.node;
				node.stream_ops = MEMFS.ops_table.file.stream;
				node.usedBytes = 0;
				node.contents = null;
			} else if (FS.isLink(node.mode)) {
				node.node_ops = MEMFS.ops_table.link.node;
				node.stream_ops = MEMFS.ops_table.link.stream;
			} else if (FS.isChrdev(node.mode)) {
				node.node_ops = MEMFS.ops_table.chrdev.node;
				node.stream_ops = MEMFS.ops_table.chrdev.stream;
			}
			node.atime = node.mtime = node.ctime = Date.now();
			if (parent) {
				parent.contents[name] = node;
				parent.atime = parent.mtime = parent.ctime = node.atime;
			}
			return node;
		},
		getFileDataAsTypedArray(node) {
			if (!node.contents) return new Uint8Array(0);
			if (node.contents.subarray)
				return node.contents.subarray(0, node.usedBytes);
			return new Uint8Array(node.contents);
		},
		expandFileStorage(node, newCapacity) {
			var prevCapacity = node.contents ? node.contents.length : 0;
			if (prevCapacity >= newCapacity) return;
			var CAPACITY_DOUBLING_MAX = 1024 * 1024;
			newCapacity = Math.max(
				newCapacity,
				(prevCapacity *
					(prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>>
					0
			);
			if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
			var oldContents = node.contents;
			node.contents = new Uint8Array(newCapacity);
			if (node.usedBytes > 0)
				node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
		},
		resizeFileStorage(node, newSize) {
			if (node.usedBytes == newSize) return;
			if (newSize == 0) {
				node.contents = null;
				node.usedBytes = 0;
			} else {
				var oldContents = node.contents;
				node.contents = new Uint8Array(newSize);
				if (oldContents) {
					node.contents.set(
						oldContents.subarray(
							0,
							Math.min(newSize, node.usedBytes)
						)
					);
				}
				node.usedBytes = newSize;
			}
		},
		node_ops: {
			getattr(node) {
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
				attr.atime = new Date(node.atime);
				attr.mtime = new Date(node.mtime);
				attr.ctime = new Date(node.ctime);
				attr.blksize = 4096;
				attr.blocks = Math.ceil(attr.size / attr.blksize);
				return attr;
			},
			setattr(node, attr) {
				for (const key of ['mode', 'atime', 'mtime', 'ctime']) {
					if (attr[key] != null) {
						node[key] = attr[key];
					}
				}
				if (attr.size !== undefined) {
					MEMFS.resizeFileStorage(node, attr.size);
				}
			},
			lookup(parent, name) {
				if (!MEMFS.doesNotExistError) {
					MEMFS.doesNotExistError = new FS.ErrnoError(44);
					MEMFS.doesNotExistError.stack = '<generic error, no stack>';
				}
				throw MEMFS.doesNotExistError;
			},
			mknod(parent, name, mode, dev) {
				return MEMFS.createNode(parent, name, mode, dev);
			},
			rename(old_node, new_dir, new_name) {
				var new_node;
				try {
					new_node = FS.lookupNode(new_dir, new_name);
				} catch (e) {}
				if (new_node) {
					if (FS.isDir(old_node.mode)) {
						for (var i in new_node.contents) {
							throw new FS.ErrnoError(55);
						}
					}
					FS.hashRemoveNode(new_node);
				}
				delete old_node.parent.contents[old_node.name];
				new_dir.contents[new_name] = old_node;
				old_node.name = new_name;
				new_dir.ctime =
					new_dir.mtime =
					old_node.parent.ctime =
					old_node.parent.mtime =
						Date.now();
			},
			unlink(parent, name) {
				delete parent.contents[name];
				parent.ctime = parent.mtime = Date.now();
			},
			rmdir(parent, name) {
				var node = FS.lookupNode(parent, name);
				for (var i in node.contents) {
					throw new FS.ErrnoError(55);
				}
				delete parent.contents[name];
				parent.ctime = parent.mtime = Date.now();
			},
			readdir(node) {
				return ['.', '..', ...Object.keys(node.contents)];
			},
			symlink(parent, newname, oldpath) {
				var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
				node.link = oldpath;
				return node;
			},
			readlink(node) {
				if (!FS.isLink(node.mode)) {
					throw new FS.ErrnoError(28);
				}
				return node.link;
			},
		},
		stream_ops: {
			read(stream, buffer, offset, length, position) {
				var contents = stream.node.contents;
				if (position >= stream.node.usedBytes) return 0;
				var size = Math.min(stream.node.usedBytes - position, length);
				if (size > 8 && contents.subarray) {
					buffer.set(
						contents.subarray(position, position + size),
						offset
					);
				} else {
					for (var i = 0; i < size; i++)
						buffer[offset + i] = contents[position + i];
				}
				return size;
			},
			write(stream, buffer, offset, length, position, canOwn) {
				if (buffer.buffer === HEAP8.buffer) {
					canOwn = false;
				}
				if (!length) return 0;
				var node = stream.node;
				node.mtime = node.ctime = Date.now();
				if (
					buffer.subarray &&
					(!node.contents || node.contents.subarray)
				) {
					if (canOwn) {
						node.contents = buffer.subarray(
							offset,
							offset + length
						);
						node.usedBytes = length;
						return length;
					} else if (node.usedBytes === 0 && position === 0) {
						node.contents = buffer.slice(offset, offset + length);
						node.usedBytes = length;
						return length;
					} else if (position + length <= node.usedBytes) {
						node.contents.set(
							buffer.subarray(offset, offset + length),
							position
						);
						return length;
					}
				}
				MEMFS.expandFileStorage(node, position + length);
				if (node.contents.subarray && buffer.subarray) {
					node.contents.set(
						buffer.subarray(offset, offset + length),
						position
					);
				} else {
					for (var i = 0; i < length; i++) {
						node.contents[position + i] = buffer[offset + i];
					}
				}
				node.usedBytes = Math.max(node.usedBytes, position + length);
				return length;
			},
			llseek(stream, offset, whence) {
				var position = offset;
				if (whence === 1) {
					position += stream.position;
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
			mmap(stream, length, position, prot, flags) {
				if (!FS.isFile(stream.node.mode)) {
					throw new FS.ErrnoError(43);
				}
				var ptr;
				var allocated;
				var contents = stream.node.contents;
				if (
					!(flags & 2) &&
					contents &&
					contents.buffer === HEAP8.buffer
				) {
					allocated = false;
					ptr = contents.byteOffset;
				} else {
					allocated = true;
					ptr = mmapAlloc(length);
					if (!ptr) {
						throw new FS.ErrnoError(48);
					}
					if (contents) {
						if (
							position > 0 ||
							position + length < contents.length
						) {
							if (contents.subarray) {
								contents = contents.subarray(
									position,
									position + length
								);
							} else {
								contents = Array.prototype.slice.call(
									contents,
									position,
									position + length
								);
							}
						}
						HEAP8.set(contents, ptr);
					}
				}
				return { ptr, allocated };
			},
			msync(stream, buffer, offset, length, mmapFlags) {
				MEMFS.stream_ops.write(
					stream,
					buffer,
					0,
					length,
					offset,
					false
				);
				return 0;
			},
		},
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
	var FS_getMode = (canRead, canWrite) => {
		var mode = 0;
		if (canRead) mode |= 292 | 73;
		if (canWrite) mode |= 146;
		return mode;
	};
	var ERRNO_CODES = {
		EPERM: 63,
		ENOENT: 44,
		ESRCH: 71,
		EINTR: 27,
		EIO: 29,
		ENXIO: 60,
		E2BIG: 1,
		ENOEXEC: 45,
		EBADF: 8,
		ECHILD: 12,
		EAGAIN: 6,
		EWOULDBLOCK: 6,
		ENOMEM: 48,
		EACCES: 2,
		EFAULT: 21,
		ENOTBLK: 105,
		EBUSY: 10,
		EEXIST: 20,
		EXDEV: 75,
		ENODEV: 43,
		ENOTDIR: 54,
		EISDIR: 31,
		EINVAL: 28,
		ENFILE: 41,
		EMFILE: 33,
		ENOTTY: 59,
		ETXTBSY: 74,
		EFBIG: 22,
		ENOSPC: 51,
		ESPIPE: 70,
		EROFS: 69,
		EMLINK: 34,
		EPIPE: 64,
		EDOM: 18,
		ERANGE: 68,
		ENOMSG: 49,
		EIDRM: 24,
		ECHRNG: 106,
		EL2NSYNC: 156,
		EL3HLT: 107,
		EL3RST: 108,
		ELNRNG: 109,
		EUNATCH: 110,
		ENOCSI: 111,
		EL2HLT: 112,
		EDEADLK: 16,
		ENOLCK: 46,
		EBADE: 113,
		EBADR: 114,
		EXFULL: 115,
		ENOANO: 104,
		EBADRQC: 103,
		EBADSLT: 102,
		EDEADLOCK: 16,
		EBFONT: 101,
		ENOSTR: 100,
		ENODATA: 116,
		ETIME: 117,
		ENOSR: 118,
		ENONET: 119,
		ENOPKG: 120,
		EREMOTE: 121,
		ENOLINK: 47,
		EADV: 122,
		ESRMNT: 123,
		ECOMM: 124,
		EPROTO: 65,
		EMULTIHOP: 36,
		EDOTDOT: 125,
		EBADMSG: 9,
		ENOTUNIQ: 126,
		EBADFD: 127,
		EREMCHG: 128,
		ELIBACC: 129,
		ELIBBAD: 130,
		ELIBSCN: 131,
		ELIBMAX: 132,
		ELIBEXEC: 133,
		ENOSYS: 52,
		ENOTEMPTY: 55,
		ENAMETOOLONG: 37,
		ELOOP: 32,
		EOPNOTSUPP: 138,
		EPFNOSUPPORT: 139,
		ECONNRESET: 15,
		ENOBUFS: 42,
		EAFNOSUPPORT: 5,
		EPROTOTYPE: 67,
		ENOTSOCK: 57,
		ENOPROTOOPT: 50,
		ESHUTDOWN: 140,
		ECONNREFUSED: 14,
		EADDRINUSE: 3,
		ECONNABORTED: 13,
		ENETUNREACH: 40,
		ENETDOWN: 38,
		ETIMEDOUT: 73,
		EHOSTDOWN: 142,
		EHOSTUNREACH: 23,
		EINPROGRESS: 26,
		EALREADY: 7,
		EDESTADDRREQ: 17,
		EMSGSIZE: 35,
		EPROTONOSUPPORT: 66,
		ESOCKTNOSUPPORT: 137,
		EADDRNOTAVAIL: 4,
		ENETRESET: 39,
		EISCONN: 30,
		ENOTCONN: 53,
		ETOOMANYREFS: 141,
		EUSERS: 136,
		EDQUOT: 19,
		ESTALE: 72,
		ENOTSUP: 138,
		ENOMEDIUM: 148,
		EILSEQ: 25,
		EOVERFLOW: 61,
		ECANCELED: 11,
		ENOTRECOVERABLE: 56,
		EOWNERDEAD: 62,
		ESTRPIPE: 135,
	};
	var PROXYFS = {
		mount(mount) {
			return PROXYFS.createNode(
				null,
				'/',
				mount.opts.fs.lstat(mount.opts.root).mode,
				0
			);
		},
		createNode(parent, name, mode, dev) {
			if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
				throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
			}
			var node = FS.createNode(parent, name, mode);
			node.node_ops = PROXYFS.node_ops;
			node.stream_ops = PROXYFS.stream_ops;
			return node;
		},
		realPath(node) {
			var parts = [];
			while (node.parent !== node) {
				parts.push(node.name);
				node = node.parent;
			}
			parts.push(node.mount.opts.root);
			parts.reverse();
			return PATH.join(...parts);
		},
		node_ops: {
			getattr(node) {
				var path = PROXYFS.realPath(node);
				var stat;
				try {
					stat = node.mount.opts.fs.lstat(path);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
				return {
					dev: stat.dev,
					ino: stat.ino,
					mode: stat.mode,
					nlink: stat.nlink,
					uid: stat.uid,
					gid: stat.gid,
					rdev: stat.rdev,
					size: stat.size,
					atime: stat.atime,
					mtime: stat.mtime,
					ctime: stat.ctime,
					blksize: stat.blksize,
					blocks: stat.blocks,
				};
			},
			setattr(node, attr) {
				var path = PROXYFS.realPath(node);
				try {
					if (attr.mode !== undefined) {
						node.mount.opts.fs.chmod(path, attr.mode);
						node.mode = attr.mode;
					}
					if (attr.atime || attr.mtime) {
						var atime = new Date(attr.atime || attr.mtime);
						var mtime = new Date(attr.mtime || attr.atime);
						node.mount.opts.fs.utime(path, atime, mtime);
					}
					if (attr.size !== undefined) {
						node.mount.opts.fs.truncate(path, attr.size);
					}
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			lookup(parent, name) {
				try {
					var path = PATH.join2(PROXYFS.realPath(parent), name);
					var mode = parent.mount.opts.fs.lstat(path).mode;
					var node = PROXYFS.createNode(parent, name, mode);
					return node;
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			mknod(parent, name, mode, dev) {
				var node = PROXYFS.createNode(parent, name, mode, dev);
				var path = PROXYFS.realPath(node);
				try {
					if (FS.isDir(node.mode)) {
						node.mount.opts.fs.mkdir(path, node.mode);
					} else {
						node.mount.opts.fs.writeFile(path, '', {
							mode: node.mode,
						});
					}
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
				return node;
			},
			rename(oldNode, newDir, newName) {
				var oldPath = PROXYFS.realPath(oldNode);
				var newPath = PATH.join2(PROXYFS.realPath(newDir), newName);
				try {
					oldNode.mount.opts.fs.rename(oldPath, newPath);
					oldNode.name = newName;
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			unlink(parent, name) {
				var path = PATH.join2(PROXYFS.realPath(parent), name);
				try {
					parent.mount.opts.fs.unlink(path);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			rmdir(parent, name) {
				var path = PATH.join2(PROXYFS.realPath(parent), name);
				try {
					parent.mount.opts.fs.rmdir(path);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			readdir(node) {
				var path = PROXYFS.realPath(node);
				try {
					return node.mount.opts.fs.readdir(path);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			symlink(parent, newName, oldPath) {
				var newPath = PATH.join2(PROXYFS.realPath(parent), newName);
				try {
					parent.mount.opts.fs.symlink(oldPath, newPath);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			readlink(node) {
				var path = PROXYFS.realPath(node);
				try {
					return node.mount.opts.fs.readlink(path);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
		},
		stream_ops: {
			open(stream) {
				var path = PROXYFS.realPath(stream.node);
				try {
					stream.nfd = stream.node.mount.opts.fs.open(
						path,
						stream.flags
					);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			close(stream) {
				try {
					stream.node.mount.opts.fs.close(stream.nfd);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			read(stream, buffer, offset, length, position) {
				try {
					return stream.node.mount.opts.fs.read(
						stream.nfd,
						buffer,
						offset,
						length,
						position
					);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			write(stream, buffer, offset, length, position) {
				try {
					return stream.node.mount.opts.fs.write(
						stream.nfd,
						buffer,
						offset,
						length,
						position
					);
				} catch (e) {
					if (!e.code) throw e;
					throw new FS.ErrnoError(ERRNO_CODES[e.code]);
				}
			},
			llseek(stream, offset, whence) {
				var position = offset;
				if (whence === 1) {
					position += stream.position;
				} else if (whence === 2) {
					if (FS.isFile(stream.node.mode)) {
						try {
							var stat = stream.node.node_ops.getattr(
								stream.node
							);
							position += stat.size;
						} catch (e) {
							throw new FS.ErrnoError(ERRNO_CODES[e.code]);
						}
					}
				}
				if (position < 0) {
					throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
				}
				return position;
			},
		},
	};
	var FS_createDataFile = (...args) => FS.createDataFile(...args);
	var getUniqueRunDependency = (id) => id;
	var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
		if (typeof Browser != 'undefined') Browser.init();
		for (var plugin of preloadPlugins) {
			if (plugin['canHandle'](fullname)) {
				return plugin['handle'](byteArray, fullname);
			}
		}
		return byteArray;
	};
	var FS_preloadFile = async (
		parent,
		name,
		url,
		canRead,
		canWrite,
		dontCreateFile,
		canOwn,
		preFinish
	) => {
		var fullname = name
			? PATH_FS.resolve(PATH.join2(parent, name))
			: parent;
		var dep = getUniqueRunDependency(`cp ${fullname}`);
		addRunDependency(dep);
		try {
			var byteArray = url;
			if (typeof url == 'string') {
				byteArray = await asyncLoad(url);
			}
			byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
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
		} finally {
			removeRunDependency(dep);
		}
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
		FS_preloadFile(
			parent,
			name,
			url,
			canRead,
			canWrite,
			dontCreateFile,
			canOwn,
			preFinish
		)
			.then(onload)
			.catch(onerror);
	};
	var FS = {
		root: null,
		mounts: [],
		devices: {},
		streams: [],
		nextInode: 1,
		nameTable: null,
		currentPath: '/',
		initialized: false,
		ignorePermissions: true,
		filesystems: null,
		syncFSRequests: 0,
		readFiles: {},
		ErrnoError: class {
			name = 'ErrnoError';
			constructor(errno) {
				this.errno = errno;
			}
		},
		FSStream: class {
			shared = {};
			get object() {
				return this.node;
			}
			set object(val) {
				this.node = val;
			}
			get isRead() {
				return (this.flags & 2097155) !== 1;
			}
			get isWrite() {
				return (this.flags & 2097155) !== 0;
			}
			get isAppend() {
				return this.flags & 1024;
			}
			get flags() {
				return this.shared.flags;
			}
			set flags(val) {
				this.shared.flags = val;
			}
			get position() {
				return this.shared.position;
			}
			set position(val) {
				this.shared.position = val;
			}
		},
		FSNode: class {
			node_ops = {};
			stream_ops = {};
			readMode = 292 | 73;
			writeMode = 146;
			mounted = null;
			constructor(parent, name, mode, rdev) {
				if (!parent) {
					parent = this;
				}
				this.parent = parent;
				this.mount = parent.mount;
				this.id = FS.nextInode++;
				this.name = name;
				this.mode = mode;
				this.rdev = rdev;
				this.atime = this.mtime = this.ctime = Date.now();
			}
			get read() {
				return (this.mode & this.readMode) === this.readMode;
			}
			set read(val) {
				val
					? (this.mode |= this.readMode)
					: (this.mode &= ~this.readMode);
			}
			get write() {
				return (this.mode & this.writeMode) === this.writeMode;
			}
			set write(val) {
				val
					? (this.mode |= this.writeMode)
					: (this.mode &= ~this.writeMode);
			}
			get isFolder() {
				return FS.isDir(this.mode);
			}
			get isDevice() {
				return FS.isChrdev(this.mode);
			}
		},
		lookupPath(path, opts = {}) {
			if (!path) {
				throw new FS.ErrnoError(44);
			}
			opts.follow_mount ??= true;
			if (!PATH.isAbs(path)) {
				path = FS.cwd() + '/' + path;
			}
			linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
				var parts = path.split('/').filter((p) => !!p);
				var current = FS.root;
				var current_path = '/';
				for (var i = 0; i < parts.length; i++) {
					var islast = i === parts.length - 1;
					if (islast && opts.parent) {
						break;
					}
					if (parts[i] === '.') {
						continue;
					}
					if (parts[i] === '..') {
						current_path = PATH.dirname(current_path);
						if (FS.isRoot(current)) {
							path =
								current_path +
								'/' +
								parts.slice(i + 1).join('/');
							nlinks--;
							continue linkloop;
						} else {
							current = current.parent;
						}
						continue;
					}
					current_path = PATH.join2(current_path, parts[i]);
					try {
						current = FS.lookupNode(current, parts[i]);
					} catch (e) {
						if (e?.errno === 44 && islast && opts.noent_okay) {
							return { path: current_path };
						}
						throw e;
					}
					if (
						FS.isMountpoint(current) &&
						(!islast || opts.follow_mount)
					) {
						current = current.mounted.root;
					}
					if (FS.isLink(current.mode) && (!islast || opts.follow)) {
						if (!current.node_ops.readlink) {
							throw new FS.ErrnoError(52);
						}
						var link = current.node_ops.readlink(current);
						if (!PATH.isAbs(link)) {
							link = PATH.dirname(current_path) + '/' + link;
						}
						path = link + '/' + parts.slice(i + 1).join('/');
						continue linkloop;
					}
				}
				return { path: current_path, node: current };
			}
			throw new FS.ErrnoError(32);
		},
		getPath(node) {
			var path;
			while (true) {
				if (FS.isRoot(node)) {
					var mount = node.mount.mountpoint;
					if (!path) return mount;
					return mount[mount.length - 1] !== '/'
						? `${mount}/${path}`
						: mount + path;
				}
				path = path ? `${node.name}/${path}` : node.name;
				node = node.parent;
			}
		},
		hashName(parentid, name) {
			var hash = 0;
			for (var i = 0; i < name.length; i++) {
				hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
			}
			return ((parentid + hash) >>> 0) % FS.nameTable.length;
		},
		hashAddNode(node) {
			var hash = FS.hashName(node.parent.id, node.name);
			node.name_next = FS.nameTable[hash];
			FS.nameTable[hash] = node;
		},
		hashRemoveNode(node) {
			var hash = FS.hashName(node.parent.id, node.name);
			if (FS.nameTable[hash] === node) {
				FS.nameTable[hash] = node.name_next;
			} else {
				var current = FS.nameTable[hash];
				while (current) {
					if (current.name_next === node) {
						current.name_next = node.name_next;
						break;
					}
					current = current.name_next;
				}
			}
		},
		lookupNode(parent, name) {
			var errCode = FS.mayLookup(parent);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			var hash = FS.hashName(parent.id, name);
			for (var node = FS.nameTable[hash]; node; node = node.name_next) {
				var nodeName = node.name;
				if (node.parent.id === parent.id && nodeName === name) {
					return node;
				}
			}
			return FS.lookup(parent, name);
		},
		createNode(parent, name, mode, rdev) {
			var node = new FS.FSNode(parent, name, mode, rdev);
			FS.hashAddNode(node);
			return node;
		},
		destroyNode(node) {
			FS.hashRemoveNode(node);
		},
		isRoot(node) {
			return node === node.parent;
		},
		isMountpoint(node) {
			return !!node.mounted;
		},
		isFile(mode) {
			return (mode & 61440) === 32768;
		},
		isDir(mode) {
			return (mode & 61440) === 16384;
		},
		isLink(mode) {
			return (mode & 61440) === 40960;
		},
		isChrdev(mode) {
			return (mode & 61440) === 8192;
		},
		isBlkdev(mode) {
			return (mode & 61440) === 24576;
		},
		isFIFO(mode) {
			return (mode & 61440) === 4096;
		},
		isSocket(mode) {
			return (mode & 49152) === 49152;
		},
		flagsToPermissionString(flag) {
			var perms = ['r', 'w', 'rw'][flag & 3];
			if (flag & 512) {
				perms += 'w';
			}
			return perms;
		},
		nodePermissions(node, perms) {
			if (FS.ignorePermissions) {
				return 0;
			}
			if (perms.includes('r') && !(node.mode & 292)) {
				return 2;
			} else if (perms.includes('w') && !(node.mode & 146)) {
				return 2;
			} else if (perms.includes('x') && !(node.mode & 73)) {
				return 2;
			}
			return 0;
		},
		mayLookup(dir) {
			if (!FS.isDir(dir.mode)) return 54;
			var errCode = FS.nodePermissions(dir, 'x');
			if (errCode) return errCode;
			if (!dir.node_ops.lookup) return 2;
			return 0;
		},
		mayCreate(dir, name) {
			if (!FS.isDir(dir.mode)) {
				return 54;
			}
			try {
				var node = FS.lookupNode(dir, name);
				return 20;
			} catch (e) {}
			return FS.nodePermissions(dir, 'wx');
		},
		mayDelete(dir, name, isdir) {
			var node;
			try {
				node = FS.lookupNode(dir, name);
			} catch (e) {
				return e.errno;
			}
			var errCode = FS.nodePermissions(dir, 'wx');
			if (errCode) {
				return errCode;
			}
			if (isdir) {
				if (!FS.isDir(node.mode)) {
					return 54;
				}
				if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
					return 10;
				}
			} else {
				if (FS.isDir(node.mode)) {
					return 31;
				}
			}
			return 0;
		},
		mayOpen(node, flags) {
			if (!node) {
				return 44;
			}
			if (FS.isLink(node.mode)) {
				return 32;
			} else if (FS.isDir(node.mode)) {
				if (
					FS.flagsToPermissionString(flags) !== 'r' ||
					flags & (512 | 64)
				) {
					return 31;
				}
			}
			return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
		},
		checkOpExists(op, err) {
			if (!op) {
				throw new FS.ErrnoError(err);
			}
			return op;
		},
		MAX_OPEN_FDS: 4096,
		nextfd() {
			for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
				if (!FS.streams[fd]) {
					return fd;
				}
			}
			throw new FS.ErrnoError(33);
		},
		getStreamChecked(fd) {
			var stream = FS.getStream(fd);
			if (!stream) {
				throw new FS.ErrnoError(8);
			}
			return stream;
		},
		getStream: (fd) => FS.streams[fd],
		createStream(stream, fd = -1) {
			stream = Object.assign(new FS.FSStream(), stream);
			if (fd == -1) {
				fd = FS.nextfd();
			}
			stream.fd = fd;
			FS.streams[fd] = stream;
			return stream;
		},
		closeStream(fd) {
			FS.streams[fd] = null;
		},
		dupStream(origStream, fd = -1) {
			var stream = FS.createStream(origStream, fd);
			stream.stream_ops?.dup?.(stream);
			return stream;
		},
		doSetAttr(stream, node, attr) {
			var setattr = stream?.stream_ops.setattr;
			var arg = setattr ? stream : node;
			setattr ??= node.node_ops.setattr;
			FS.checkOpExists(setattr, 63);
			setattr(arg, attr);
		},
		chrdev_stream_ops: {
			open(stream) {
				var device = FS.getDevice(stream.node.rdev);
				stream.stream_ops = device.stream_ops;
				stream.stream_ops.open?.(stream);
			},
			llseek() {
				throw new FS.ErrnoError(70);
			},
		},
		major: (dev) => dev >> 8,
		minor: (dev) => dev & 255,
		makedev: (ma, mi) => (ma << 8) | mi,
		registerDevice(dev, ops) {
			FS.devices[dev] = { stream_ops: ops };
		},
		getDevice: (dev) => FS.devices[dev],
		getMounts(mount) {
			var mounts = [];
			var check = [mount];
			while (check.length) {
				var m = check.pop();
				mounts.push(m);
				check.push(...m.mounts);
			}
			return mounts;
		},
		syncfs(populate, callback) {
			if (typeof populate == 'function') {
				callback = populate;
				populate = false;
			}
			FS.syncFSRequests++;
			if (FS.syncFSRequests > 1) {
				err(
					`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
				);
			}
			var mounts = FS.getMounts(FS.root.mount);
			var completed = 0;
			function doCallback(errCode) {
				FS.syncFSRequests--;
				return callback(errCode);
			}
			function done(errCode) {
				if (errCode) {
					if (!done.errored) {
						done.errored = true;
						return doCallback(errCode);
					}
					return;
				}
				if (++completed >= mounts.length) {
					doCallback(null);
				}
			}
			for (var mount of mounts) {
				if (mount.type.syncfs) {
					mount.type.syncfs(mount, populate, done);
				} else {
					done(null);
				}
			}
		},
		mount(type, opts, mountpoint) {
			var root = mountpoint === '/';
			var pseudo = !mountpoint;
			var node;
			if (root && FS.root) {
				throw new FS.ErrnoError(10);
			} else if (!root && !pseudo) {
				var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
				mountpoint = lookup.path;
				node = lookup.node;
				if (FS.isMountpoint(node)) {
					throw new FS.ErrnoError(10);
				}
			}
			var mount = { type, opts, mountpoint, mounts: [] };
			var mountRoot = type.mount(mount);
			mountRoot.mount = mount;
			mount.root = mountRoot;
			if (root) {
				FS.root = mountRoot;
			} else if (node) {
				node.mounted = mount;
				if (node.mount) {
					node.mount.mounts.push(mount);
				}
			}
			return mountRoot;
		},
		unmount(mountpoint) {
			var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
			if (!FS.isMountpoint(lookup.node)) {
				throw new FS.ErrnoError(28);
			}
			var node = lookup.node;
			var mount = node.mounted;
			var mounts = FS.getMounts(mount);
			for (var [hash, current] of Object.entries(FS.nameTable)) {
				while (current) {
					var next = current.name_next;
					if (mounts.includes(current.mount)) {
						FS.destroyNode(current);
					}
					current = next;
				}
			}
			node.mounted = null;
			var idx = node.mount.mounts.indexOf(mount);
			node.mount.mounts.splice(idx, 1);
		},
		lookup(parent, name) {
			return parent.node_ops.lookup(parent, name);
		},
		mknod(path, mode, dev) {
			var lookup = FS.lookupPath(path, { parent: true });
			var parent = lookup.node;
			var name = PATH.basename(path);
			if (!name) {
				throw new FS.ErrnoError(28);
			}
			if (name === '.' || name === '..') {
				throw new FS.ErrnoError(20);
			}
			var errCode = FS.mayCreate(parent, name);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			if (!parent.node_ops.mknod) {
				throw new FS.ErrnoError(63);
			}
			return parent.node_ops.mknod(parent, name, mode, dev);
		},
		statfs(path) {
			return FS.statfsNode(FS.lookupPath(path, { follow: true }).node);
		},
		statfsStream(stream) {
			return FS.statfsNode(stream.node);
		},
		statfsNode(node) {
			var rtn = {
				bsize: 4096,
				frsize: 4096,
				blocks: 1e6,
				bfree: 5e5,
				bavail: 5e5,
				files: FS.nextInode,
				ffree: FS.nextInode - 1,
				fsid: 42,
				flags: 2,
				namelen: 255,
			};
			if (node.node_ops.statfs) {
				Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
			}
			return rtn;
		},
		create(path, mode = 438) {
			mode &= 4095;
			mode |= 32768;
			return FS.mknod(path, mode, 0);
		},
		mkdir(path, mode = 511) {
			mode &= 511 | 512;
			mode |= 16384;
			return FS.mknod(path, mode, 0);
		},
		mkdirTree(path, mode) {
			var dirs = path.split('/');
			var d = '';
			for (var dir of dirs) {
				if (!dir) continue;
				if (d || PATH.isAbs(path)) d += '/';
				d += dir;
				try {
					FS.mkdir(d, mode);
				} catch (e) {
					if (e.errno != 20) throw e;
				}
			}
		},
		mkdev(path, mode, dev) {
			if (typeof dev == 'undefined') {
				dev = mode;
				mode = 438;
			}
			mode |= 8192;
			return FS.mknod(path, mode, dev);
		},
		symlink(oldpath, newpath) {
			if (!PATH_FS.resolve(oldpath)) {
				throw new FS.ErrnoError(44);
			}
			var lookup = FS.lookupPath(newpath, { parent: true });
			var parent = lookup.node;
			if (!parent) {
				throw new FS.ErrnoError(44);
			}
			var newname = PATH.basename(newpath);
			var errCode = FS.mayCreate(parent, newname);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			if (!parent.node_ops.symlink) {
				throw new FS.ErrnoError(63);
			}
			return parent.node_ops.symlink(parent, newname, oldpath);
		},
		rename(old_path, new_path) {
			var old_dirname = PATH.dirname(old_path);
			var new_dirname = PATH.dirname(new_path);
			var old_name = PATH.basename(old_path);
			var new_name = PATH.basename(new_path);
			var lookup, old_dir, new_dir;
			lookup = FS.lookupPath(old_path, { parent: true });
			old_dir = lookup.node;
			lookup = FS.lookupPath(new_path, { parent: true });
			new_dir = lookup.node;
			if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
			if (old_dir.mount !== new_dir.mount) {
				throw new FS.ErrnoError(75);
			}
			var old_node = FS.lookupNode(old_dir, old_name);
			var relative = PATH_FS.relative(old_path, new_dirname);
			if (relative.charAt(0) !== '.') {
				throw new FS.ErrnoError(28);
			}
			relative = PATH_FS.relative(new_path, old_dirname);
			if (relative.charAt(0) !== '.') {
				throw new FS.ErrnoError(55);
			}
			var new_node;
			try {
				new_node = FS.lookupNode(new_dir, new_name);
			} catch (e) {}
			if (old_node === new_node) {
				return;
			}
			var isdir = FS.isDir(old_node.mode);
			var errCode = FS.mayDelete(old_dir, old_name, isdir);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			errCode = new_node
				? FS.mayDelete(new_dir, new_name, isdir)
				: FS.mayCreate(new_dir, new_name);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			if (!old_dir.node_ops.rename) {
				throw new FS.ErrnoError(63);
			}
			if (
				FS.isMountpoint(old_node) ||
				(new_node && FS.isMountpoint(new_node))
			) {
				throw new FS.ErrnoError(10);
			}
			if (new_dir !== old_dir) {
				errCode = FS.nodePermissions(old_dir, 'w');
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
			}
			FS.hashRemoveNode(old_node);
			try {
				old_dir.node_ops.rename(old_node, new_dir, new_name);
				old_node.parent = new_dir;
			} catch (e) {
				throw e;
			} finally {
				FS.hashAddNode(old_node);
			}
		},
		rmdir(path) {
			var lookup = FS.lookupPath(path, { parent: true });
			var parent = lookup.node;
			var name = PATH.basename(path);
			var node = FS.lookupNode(parent, name);
			var errCode = FS.mayDelete(parent, name, true);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			if (!parent.node_ops.rmdir) {
				throw new FS.ErrnoError(63);
			}
			if (FS.isMountpoint(node)) {
				throw new FS.ErrnoError(10);
			}
			parent.node_ops.rmdir(parent, name);
			FS.destroyNode(node);
		},
		readdir(path) {
			var lookup = FS.lookupPath(path, { follow: true });
			var node = lookup.node;
			var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
			return readdir(node);
		},
		unlink(path) {
			var lookup = FS.lookupPath(path, { parent: true });
			var parent = lookup.node;
			if (!parent) {
				throw new FS.ErrnoError(44);
			}
			var name = PATH.basename(path);
			var node = FS.lookupNode(parent, name);
			var errCode = FS.mayDelete(parent, name, false);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			if (!parent.node_ops.unlink) {
				throw new FS.ErrnoError(63);
			}
			if (FS.isMountpoint(node)) {
				throw new FS.ErrnoError(10);
			}
			parent.node_ops.unlink(parent, name);
			FS.destroyNode(node);
		},
		readlink(path) {
			var lookup = FS.lookupPath(path);
			var link = lookup.node;
			if (!link) {
				throw new FS.ErrnoError(44);
			}
			if (!link.node_ops.readlink) {
				throw new FS.ErrnoError(28);
			}
			return link.node_ops.readlink(link);
		},
		stat(path, dontFollow) {
			var lookup = FS.lookupPath(path, { follow: !dontFollow });
			var node = lookup.node;
			var getattr = FS.checkOpExists(node.node_ops.getattr, 63);
			return getattr(node);
		},
		fstat(fd) {
			var stream = FS.getStreamChecked(fd);
			var node = stream.node;
			var getattr = stream.stream_ops.getattr;
			var arg = getattr ? stream : node;
			getattr ??= node.node_ops.getattr;
			FS.checkOpExists(getattr, 63);
			return getattr(arg);
		},
		lstat(path) {
			return FS.stat(path, true);
		},
		doChmod(stream, node, mode, dontFollow) {
			FS.doSetAttr(stream, node, {
				mode: (mode & 4095) | (node.mode & ~4095),
				ctime: Date.now(),
				dontFollow,
			});
		},
		chmod(path, mode, dontFollow) {
			var node;
			if (typeof path == 'string') {
				var lookup = FS.lookupPath(path, { follow: !dontFollow });
				node = lookup.node;
			} else {
				node = path;
			}
			FS.doChmod(null, node, mode, dontFollow);
		},
		lchmod(path, mode) {
			FS.chmod(path, mode, true);
		},
		fchmod(fd, mode) {
			var stream = FS.getStreamChecked(fd);
			FS.doChmod(stream, stream.node, mode, false);
		},
		doChown(stream, node, dontFollow) {
			FS.doSetAttr(stream, node, { timestamp: Date.now(), dontFollow });
		},
		chown(path, uid, gid, dontFollow) {
			var node;
			if (typeof path == 'string') {
				var lookup = FS.lookupPath(path, { follow: !dontFollow });
				node = lookup.node;
			} else {
				node = path;
			}
			FS.doChown(null, node, dontFollow);
		},
		lchown(path, uid, gid) {
			FS.chown(path, uid, gid, true);
		},
		fchown(fd, uid, gid) {
			var stream = FS.getStreamChecked(fd);
			FS.doChown(stream, stream.node, false);
		},
		doTruncate(stream, node, len) {
			if (FS.isDir(node.mode)) {
				throw new FS.ErrnoError(31);
			}
			if (!FS.isFile(node.mode)) {
				throw new FS.ErrnoError(28);
			}
			var errCode = FS.nodePermissions(node, 'w');
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			FS.doSetAttr(stream, node, { size: len, timestamp: Date.now() });
		},
		truncate(path, len) {
			if (len < 0) {
				throw new FS.ErrnoError(28);
			}
			var node;
			if (typeof path == 'string') {
				var lookup = FS.lookupPath(path, { follow: true });
				node = lookup.node;
			} else {
				node = path;
			}
			FS.doTruncate(null, node, len);
		},
		ftruncate(fd, len) {
			var stream = FS.getStreamChecked(fd);
			if (len < 0 || (stream.flags & 2097155) === 0) {
				throw new FS.ErrnoError(28);
			}
			FS.doTruncate(stream, stream.node, len);
		},
		utime(path, atime, mtime) {
			var lookup = FS.lookupPath(path, { follow: true });
			var node = lookup.node;
			var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
			setattr(node, { atime, mtime });
		},
		open(path, flags, mode = 438) {
			if (path === '') {
				throw new FS.ErrnoError(44);
			}
			flags =
				typeof flags == 'string' ? FS_modeStringToFlags(flags) : flags;
			if (flags & 64) {
				mode = (mode & 4095) | 32768;
			} else {
				mode = 0;
			}
			var node;
			var isDirPath;
			if (typeof path == 'object') {
				node = path;
			} else {
				isDirPath = path.endsWith('/');
				var lookup = FS.lookupPath(path, {
					follow: !(flags & 131072),
					noent_okay: true,
				});
				node = lookup.node;
				path = lookup.path;
			}
			var created = false;
			if (flags & 64) {
				if (node) {
					if (flags & 128) {
						throw new FS.ErrnoError(20);
					}
				} else if (isDirPath) {
					throw new FS.ErrnoError(31);
				} else {
					node = FS.mknod(path, mode | 511, 0);
					created = true;
				}
			}
			if (!node) {
				throw new FS.ErrnoError(44);
			}
			if (FS.isChrdev(node.mode)) {
				flags &= ~512;
			}
			if (flags & 65536 && !FS.isDir(node.mode)) {
				throw new FS.ErrnoError(54);
			}
			if (!created) {
				var errCode = FS.mayOpen(node, flags);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
			}
			if (flags & 512 && !created) {
				FS.truncate(node, 0);
			}
			flags &= ~(128 | 512 | 131072);
			var stream = FS.createStream({
				node,
				path: FS.getPath(node),
				flags,
				seekable: true,
				position: 0,
				stream_ops: node.stream_ops,
				ungotten: [],
				error: false,
			});
			if (stream.stream_ops.open) {
				stream.stream_ops.open(stream);
			}
			if (created) {
				FS.chmod(node, mode & 511);
			}
			if (Module['logReadFiles'] && !(flags & 1)) {
				if (!(path in FS.readFiles)) {
					FS.readFiles[path] = 1;
				}
			}
			return stream;
		},
		close(stream) {
			if (FS.isClosed(stream)) {
				throw new FS.ErrnoError(8);
			}
			if (stream.getdents) stream.getdents = null;
			try {
				if (stream.stream_ops.close) {
					stream.stream_ops.close(stream);
				}
			} catch (e) {
				throw e;
			} finally {
				FS.closeStream(stream.fd);
			}
			stream.fd = null;
		},
		isClosed(stream) {
			return stream.fd === null;
		},
		llseek(stream, offset, whence) {
			if (FS.isClosed(stream)) {
				throw new FS.ErrnoError(8);
			}
			if (!stream.seekable || !stream.stream_ops.llseek) {
				throw new FS.ErrnoError(70);
			}
			if (whence != 0 && whence != 1 && whence != 2) {
				throw new FS.ErrnoError(28);
			}
			stream.position = stream.stream_ops.llseek(stream, offset, whence);
			stream.ungotten = [];
			return stream.position;
		},
		read(stream, buffer, offset, length, position) {
			if (length < 0 || position < 0) {
				throw new FS.ErrnoError(28);
			}
			if (FS.isClosed(stream)) {
				throw new FS.ErrnoError(8);
			}
			if ((stream.flags & 2097155) === 1) {
				throw new FS.ErrnoError(8);
			}
			if (FS.isDir(stream.node.mode)) {
				throw new FS.ErrnoError(31);
			}
			if (!stream.stream_ops.read) {
				throw new FS.ErrnoError(28);
			}
			var seeking = typeof position != 'undefined';
			if (!seeking) {
				position = stream.position;
			} else if (!stream.seekable) {
				throw new FS.ErrnoError(70);
			}
			var bytesRead = stream.stream_ops.read(
				stream,
				buffer,
				offset,
				length,
				position
			);
			if (!seeking) stream.position += bytesRead;
			return bytesRead;
		},
		write(stream, buffer, offset, length, position, canOwn) {
			if (length < 0 || position < 0) {
				throw new FS.ErrnoError(28);
			}
			if (FS.isClosed(stream)) {
				throw new FS.ErrnoError(8);
			}
			if ((stream.flags & 2097155) === 0) {
				throw new FS.ErrnoError(8);
			}
			if (FS.isDir(stream.node.mode)) {
				throw new FS.ErrnoError(31);
			}
			if (!stream.stream_ops.write) {
				throw new FS.ErrnoError(28);
			}
			if (stream.seekable && stream.flags & 1024) {
				FS.llseek(stream, 0, 2);
			}
			var seeking = typeof position != 'undefined';
			if (!seeking) {
				position = stream.position;
			} else if (!stream.seekable) {
				throw new FS.ErrnoError(70);
			}
			var bytesWritten = stream.stream_ops.write(
				stream,
				buffer,
				offset,
				length,
				position,
				canOwn
			);
			if (!seeking) stream.position += bytesWritten;
			return bytesWritten;
		},
		mmap(stream, length, position, prot, flags) {
			if (
				(prot & 2) !== 0 &&
				(flags & 2) === 0 &&
				(stream.flags & 2097155) !== 2
			) {
				throw new FS.ErrnoError(2);
			}
			if ((stream.flags & 2097155) === 1) {
				throw new FS.ErrnoError(2);
			}
			if (!stream.stream_ops.mmap) {
				throw new FS.ErrnoError(43);
			}
			if (!length) {
				throw new FS.ErrnoError(28);
			}
			return stream.stream_ops.mmap(
				stream,
				length,
				position,
				prot,
				flags
			);
		},
		msync(stream, buffer, offset, length, mmapFlags) {
			if (!stream.stream_ops.msync) {
				return 0;
			}
			return stream.stream_ops.msync(
				stream,
				buffer,
				offset,
				length,
				mmapFlags
			);
		},
		ioctl(stream, cmd, arg) {
			if (!stream.stream_ops.ioctl) {
				throw new FS.ErrnoError(59);
			}
			return stream.stream_ops.ioctl(stream, cmd, arg);
		},
		readFile(path, opts = {}) {
			opts.flags = opts.flags || 0;
			opts.encoding = opts.encoding || 'binary';
			if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
				abort(`Invalid encoding type "${opts.encoding}"`);
			}
			var stream = FS.open(path, opts.flags);
			var stat = FS.stat(path);
			var length = stat.size;
			var buf = new Uint8Array(length);
			FS.read(stream, buf, 0, length, 0);
			if (opts.encoding === 'utf8') {
				buf = UTF8ArrayToString(buf);
			}
			FS.close(stream);
			return buf;
		},
		writeFile(path, data, opts = {}) {
			opts.flags = opts.flags || 577;
			var stream = FS.open(path, opts.flags, opts.mode);
			if (typeof data == 'string') {
				data = new Uint8Array(intArrayFromString(data, true));
			}
			if (ArrayBuffer.isView(data)) {
				FS.write(
					stream,
					data,
					0,
					data.byteLength,
					undefined,
					opts.canOwn
				);
			} else {
				abort('Unsupported data type');
			}
			FS.close(stream);
		},
		cwd: () => FS.currentPath,
		chdir(path) {
			var lookup = FS.lookupPath(path, { follow: true });
			if (lookup.node === null) {
				throw new FS.ErrnoError(44);
			}
			if (!FS.isDir(lookup.node.mode)) {
				throw new FS.ErrnoError(54);
			}
			var errCode = FS.nodePermissions(lookup.node, 'x');
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			FS.currentPath = lookup.path;
		},
		createDefaultDirectories() {
			FS.mkdir('/tmp');
			FS.mkdir('/home');
			FS.mkdir('/home/web_user');
		},
		createDefaultDevices() {
			FS.mkdir('/dev');
			FS.registerDevice(FS.makedev(1, 3), {
				read: () => 0,
				write: (stream, buffer, offset, length, pos) => length,
				llseek: () => 0,
			});
			FS.mkdev('/dev/null', FS.makedev(1, 3));
			TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
			TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
			FS.mkdev('/dev/tty', FS.makedev(5, 0));
			FS.mkdev('/dev/tty1', FS.makedev(6, 0));
			var randomBuffer = new Uint8Array(1024),
				randomLeft = 0;
			var randomByte = () => {
				if (randomLeft === 0) {
					randomFill(randomBuffer);
					randomLeft = randomBuffer.byteLength;
				}
				return randomBuffer[--randomLeft];
			};
			FS.createDevice('/dev', 'random', randomByte);
			FS.createDevice('/dev', 'urandom', randomByte);
			FS.mkdir('/dev/shm');
			FS.mkdir('/dev/shm/tmp');
		},
		createSpecialDirectories() {
			FS.mkdir('/proc');
			var proc_self = FS.mkdir('/proc/self');
			FS.mkdir('/proc/self/fd');
			FS.mount(
				{
					mount() {
						var node = FS.createNode(proc_self, 'fd', 16895, 73);
						node.stream_ops = { llseek: MEMFS.stream_ops.llseek };
						node.node_ops = {
							lookup(parent, name) {
								var fd = +name;
								var stream = FS.getStreamChecked(fd);
								var ret = {
									parent: null,
									mount: { mountpoint: 'fake' },
									node_ops: { readlink: () => stream.path },
									id: fd + 1,
								};
								ret.parent = ret;
								return ret;
							},
							readdir() {
								return Array.from(FS.streams.entries())
									.filter(([k, v]) => v)
									.map(([k, v]) => k.toString());
							},
						};
						return node;
					},
				},
				{},
				'/proc/self/fd'
			);
		},
		createStandardStreams(input, output, error) {
			if (input) {
				FS.createDevice('/dev', 'stdin', input);
			} else {
				FS.symlink('/dev/tty', '/dev/stdin');
			}
			if (output) {
				FS.createDevice('/dev', 'stdout', null, output);
			} else {
				FS.symlink('/dev/tty', '/dev/stdout');
			}
			if (error) {
				FS.createDevice('/dev', 'stderr', null, error);
			} else {
				FS.symlink('/dev/tty1', '/dev/stderr');
			}
			var stdin = FS.open('/dev/stdin', 0);
			var stdout = FS.open('/dev/stdout', 1);
			var stderr = FS.open('/dev/stderr', 1);
		},
		staticInit() {
			FS.nameTable = new Array(4096);
			FS.mount(MEMFS, {}, '/');
			FS.createDefaultDirectories();
			FS.createDefaultDevices();
			FS.createSpecialDirectories();
			FS.filesystems = { MEMFS, PROXYFS };
		},
		init(input, output, error) {
			FS.initialized = true;
			input ??= Module['stdin'];
			output ??= Module['stdout'];
			error ??= Module['stderr'];
			FS.createStandardStreams(input, output, error);
		},
		quit() {
			FS.initialized = false;
			_fflush(0);
			for (var stream of FS.streams) {
				if (stream) {
					FS.close(stream);
				}
			}
		},
		findObject(path, dontResolveLastLink) {
			var ret = FS.analyzePath(path, dontResolveLastLink);
			if (!ret.exists) {
				return null;
			}
			return ret.object;
		},
		analyzePath(path, dontResolveLastLink) {
			try {
				var lookup = FS.lookupPath(path, {
					follow: !dontResolveLastLink,
				});
				path = lookup.path;
			} catch (e) {}
			var ret = {
				isRoot: false,
				exists: false,
				error: 0,
				name: null,
				path: null,
				object: null,
				parentExists: false,
				parentPath: null,
				parentObject: null,
			};
			try {
				var lookup = FS.lookupPath(path, { parent: true });
				ret.parentExists = true;
				ret.parentPath = lookup.path;
				ret.parentObject = lookup.node;
				ret.name = PATH.basename(path);
				lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
				ret.exists = true;
				ret.path = lookup.path;
				ret.object = lookup.node;
				ret.name = lookup.node.name;
				ret.isRoot = lookup.path === '/';
			} catch (e) {
				ret.error = e.errno;
			}
			return ret;
		},
		createPath(parent, path, canRead, canWrite) {
			parent = typeof parent == 'string' ? parent : FS.getPath(parent);
			var parts = path.split('/').reverse();
			while (parts.length) {
				var part = parts.pop();
				if (!part) continue;
				var current = PATH.join2(parent, part);
				try {
					FS.mkdir(current);
				} catch (e) {
					if (e.errno != 20) throw e;
				}
				parent = current;
			}
			return current;
		},
		createFile(parent, name, properties, canRead, canWrite) {
			var path = PATH.join2(
				typeof parent == 'string' ? parent : FS.getPath(parent),
				name
			);
			var mode = FS_getMode(canRead, canWrite);
			return FS.create(path, mode);
		},
		createDataFile(parent, name, data, canRead, canWrite, canOwn) {
			var path = name;
			if (parent) {
				parent =
					typeof parent == 'string' ? parent : FS.getPath(parent);
				path = name ? PATH.join2(parent, name) : parent;
			}
			var mode = FS_getMode(canRead, canWrite);
			var node = FS.create(path, mode);
			if (data) {
				if (typeof data == 'string') {
					var arr = new Array(data.length);
					for (var i = 0, len = data.length; i < len; ++i)
						arr[i] = data.charCodeAt(i);
					data = arr;
				}
				FS.chmod(node, mode | 146);
				var stream = FS.open(node, 577);
				FS.write(stream, data, 0, data.length, 0, canOwn);
				FS.close(stream);
				FS.chmod(node, mode);
			}
		},
		createDevice(parent, name, input, output) {
			var path = PATH.join2(
				typeof parent == 'string' ? parent : FS.getPath(parent),
				name
			);
			var mode = FS_getMode(!!input, !!output);
			FS.createDevice.major ??= 64;
			var dev = FS.makedev(FS.createDevice.major++, 0);
			FS.registerDevice(dev, {
				open(stream) {
					stream.seekable = false;
				},
				close(stream) {
					if (output?.buffer?.length) {
						output(10);
					}
				},
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
					if (bytesRead) {
						stream.node.atime = Date.now();
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
					if (length) {
						stream.node.mtime = stream.node.ctime = Date.now();
					}
					return i;
				},
			});
			return FS.mkdev(path, mode, dev);
		},
		forceLoadFile(obj) {
			if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
				return true;
			if (globalThis.XMLHttpRequest) {
				abort(
					'Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.'
				);
			} else {
				try {
					obj.contents = readBinary(obj.url);
				} catch (e) {
					throw new FS.ErrnoError(29);
				}
			}
		},
		createLazyFile(parent, name, url, canRead, canWrite) {
			class LazyUint8Array {
				lengthKnown = false;
				chunks = [];
				get(idx) {
					if (idx > this.length - 1 || idx < 0) {
						return undefined;
					}
					var chunkOffset = idx % this.chunkSize;
					var chunkNum = (idx / this.chunkSize) | 0;
					return this.getter(chunkNum)[chunkOffset];
				}
				setDataGetter(getter) {
					this.getter = getter;
				}
				cacheLength() {
					var xhr = new XMLHttpRequest();
					xhr.open('HEAD', url, false);
					xhr.send(null);
					if (
						!(
							(xhr.status >= 200 && xhr.status < 300) ||
							xhr.status === 304
						)
					)
						abort(
							"Couldn't load " + url + '. Status: ' + xhr.status
						);
					var datalength = Number(
						xhr.getResponseHeader('Content-length')
					);
					var header;
					var hasByteServing =
						(header = xhr.getResponseHeader('Accept-Ranges')) &&
						header === 'bytes';
					var usesGzip =
						(header = xhr.getResponseHeader('Content-Encoding')) &&
						header === 'gzip';
					var chunkSize = 1024 * 1024;
					if (!hasByteServing) chunkSize = datalength;
					var doXHR = (from, to) => {
						if (from > to)
							abort(
								'invalid range (' +
									from +
									', ' +
									to +
									') or no bytes requested!'
							);
						if (to > datalength - 1)
							abort(
								'only ' +
									datalength +
									' bytes available! programmer error!'
							);
						var xhr = new XMLHttpRequest();
						xhr.open('GET', url, false);
						if (datalength !== chunkSize)
							xhr.setRequestHeader(
								'Range',
								'bytes=' + from + '-' + to
							);
						xhr.responseType = 'arraybuffer';
						if (xhr.overrideMimeType) {
							xhr.overrideMimeType(
								'text/plain; charset=x-user-defined'
							);
						}
						xhr.send(null);
						if (
							!(
								(xhr.status >= 200 && xhr.status < 300) ||
								xhr.status === 304
							)
						)
							abort(
								"Couldn't load " +
									url +
									'. Status: ' +
									xhr.status
							);
						if (xhr.response !== undefined) {
							return new Uint8Array(xhr.response || []);
						}
						return intArrayFromString(xhr.responseText || '', true);
					};
					var lazyArray = this;
					lazyArray.setDataGetter((chunkNum) => {
						var start = chunkNum * chunkSize;
						var end = (chunkNum + 1) * chunkSize - 1;
						end = Math.min(end, datalength - 1);
						if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
							lazyArray.chunks[chunkNum] = doXHR(start, end);
						}
						if (typeof lazyArray.chunks[chunkNum] == 'undefined')
							abort('doXHR failed!');
						return lazyArray.chunks[chunkNum];
					});
					if (usesGzip || !datalength) {
						chunkSize = datalength = 1;
						datalength = this.getter(0).length;
						chunkSize = datalength;
						out(
							'LazyFiles on gzip forces download of the whole file when length is accessed'
						);
					}
					this._length = datalength;
					this._chunkSize = chunkSize;
					this.lengthKnown = true;
				}
				get length() {
					if (!this.lengthKnown) {
						this.cacheLength();
					}
					return this._length;
				}
				get chunkSize() {
					if (!this.lengthKnown) {
						this.cacheLength();
					}
					return this._chunkSize;
				}
			}
			if (globalThis.XMLHttpRequest) {
				if (!ENVIRONMENT_IS_WORKER)
					abort(
						'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc'
					);
				var lazyArray = new LazyUint8Array();
				var properties = { isDevice: false, contents: lazyArray };
			} else {
				var properties = { isDevice: false, url };
			}
			var node = FS.createFile(
				parent,
				name,
				properties,
				canRead,
				canWrite
			);
			if (properties.contents) {
				node.contents = properties.contents;
			} else if (properties.url) {
				node.contents = null;
				node.url = properties.url;
			}
			Object.defineProperties(node, {
				usedBytes: {
					get: function () {
						return this.contents.length;
					},
				},
			});
			var stream_ops = {};
			for (const [key, fn] of Object.entries(node.stream_ops)) {
				stream_ops[key] = (...args) => {
					FS.forceLoadFile(node);
					return fn(...args);
				};
			}
			function writeChunks(stream, buffer, offset, length, position) {
				var contents = stream.node.contents;
				if (position >= contents.length) return 0;
				var size = Math.min(contents.length - position, length);
				if (contents.slice) {
					for (var i = 0; i < size; i++) {
						buffer[offset + i] = contents[position + i];
					}
				} else {
					for (var i = 0; i < size; i++) {
						buffer[offset + i] = contents.get(position + i);
					}
				}
				return size;
			}
			stream_ops.read = (stream, buffer, offset, length, position) => {
				FS.forceLoadFile(node);
				return writeChunks(stream, buffer, offset, length, position);
			};
			stream_ops.mmap = (stream, length, position, prot, flags) => {
				FS.forceLoadFile(node);
				var ptr = mmapAlloc(length);
				if (!ptr) {
					throw new FS.ErrnoError(48);
				}
				writeChunks(stream, HEAP8, ptr, length, position);
				return { ptr, allocated: true };
			};
			node.stream_ops = stream_ops;
			return node;
		},
	};
	var findLibraryFS = (libName, rpath) => {
		if (!runtimeInitialized) {
			return undefined;
		}
		if (PATH.isAbs(libName)) {
			try {
				FS.lookupPath(libName);
				return libName;
			} catch (e) {
				return undefined;
			}
		}
		var rpathResolved = (rpath?.paths || []).map((p) =>
			replaceORIGIN(rpath?.parentLibPath, p)
		);
		return withStackSave(() => {
			var bufSize = 2 * 255 + 2;
			var buf = stackAlloc(bufSize);
			var rpathC = stringToUTF8OnStack(rpathResolved.join(':'));
			var libNameC = stringToUTF8OnStack(libName);
			var resLibNameC = __emscripten_find_dylib(
				buf,
				rpathC,
				libNameC,
				bufSize
			);
			return resLibNameC ? UTF8ToString(resLibNameC) : undefined;
		});
	};
	function loadDynamicLibrary(
		libName,
		flags = { global: true, nodelete: true },
		localScope,
		handle
	) {
		var dso = LDSO.loadedLibsByName[libName];
		if (dso) {
			if (!flags.global) {
				if (localScope) {
					Object.assign(localScope, dso.exports);
				}
			} else if (!dso.global) {
				dso.global = true;
				mergeLibSymbols(dso.exports, libName);
			}
			if (flags.nodelete && dso.refcount !== Infinity) {
				dso.refcount = Infinity;
			}
			dso.refcount++;
			if (handle) {
				LDSO.loadedLibsByHandle[handle] = dso;
			}
			return flags.loadAsync ? Promise.resolve(true) : true;
		}
		dso = newDSO(libName, handle, 'loading');
		dso.refcount = flags.nodelete ? Infinity : 1;
		dso.global = flags.global;
		function loadLibData() {
			if (handle) {
				var data = HEAPU32[(handle + 28) >> 2];
				var dataSize = HEAPU32[(handle + 32) >> 2];
				if (data && dataSize) {
					var libData = HEAP8.slice(data, data + dataSize);
					return flags.loadAsync ? Promise.resolve(libData) : libData;
				}
			}
			var f = findLibraryFS(libName, flags.rpath);
			if (f) {
				var libData = FS.readFile(f, { encoding: 'binary' });
				return flags.loadAsync ? Promise.resolve(libData) : libData;
			}
			var libFile = locateFile(libName);
			if (flags.loadAsync) {
				return asyncLoad(libFile);
			}
			if (!readBinary) {
				throw new Error(
					`${libFile}: file not found, and synchronous loading of external files is not available`
				);
			}
			return readBinary(libFile);
		}
		function getExports() {
			var preloaded = preloadedWasm[libName];
			if (preloaded) {
				return flags.loadAsync ? Promise.resolve(preloaded) : preloaded;
			}
			if (flags.loadAsync) {
				return loadLibData().then((libData) =>
					loadWebAssemblyModule(
						libData,
						flags,
						libName,
						localScope,
						handle
					)
				);
			}
			return loadWebAssemblyModule(
				loadLibData(),
				flags,
				libName,
				localScope,
				handle
			);
		}
		function moduleLoaded(exports) {
			if (dso.global) {
				mergeLibSymbols(exports, libName);
			} else if (localScope) {
				Object.assign(localScope, exports);
			}
			dso.exports = exports;
		}
		if (flags.loadAsync) {
			return getExports().then((exports) => {
				moduleLoaded(exports);
				return true;
			});
		}
		moduleLoaded(getExports());
		return true;
	}
	var reportUndefinedSymbols = () => {
		for (var [symName, entry] of Object.entries(GOT)) {
			if (entry.value == -1) {
				var value = resolveGlobalSymbol(symName, true).sym;
				if (!value && !entry.required) {
					entry.value = 0;
					continue;
				}
				if (typeof value == 'function') {
					entry.value = addFunction(value, value.sig);
				} else if (typeof value == 'number') {
					entry.value = value;
				} else {
					throw new Error(
						`bad export type for '${symName}': ${typeof value} (${value})`
					);
				}
			}
		}
	};
	var loadDylibs = async () => {
		if (!dynamicLibraries.length) {
			reportUndefinedSymbols();
			return;
		}
		addRunDependency('loadDylibs');
		for (var lib of dynamicLibraries) {
			await loadDynamicLibrary(lib, {
				loadAsync: true,
				global: true,
				nodelete: true,
				allowUndefined: true,
			});
		}
		reportUndefinedSymbols();
		removeRunDependency('loadDylibs');
	};
	var noExitRuntime = false;
	var ___assert_fail = (condition, filename, line, func) =>
		abort(
			`Assertion failed: ${UTF8ToString(condition)}, at: ` +
				[
					filename ? UTF8ToString(filename) : 'unknown filename',
					line,
					func ? UTF8ToString(func) : 'unknown function',
				]
		);
	___assert_fail.sig = 'vppip';
	var ___call_sighandler = (fp, sig) => getWasmTableEntry(fp)(sig);
	___call_sighandler.sig = 'vpi';
	var SOCKFS = {
		websocketArgs: {},
		callbacks: {},
		on(event, callback) {
			SOCKFS.callbacks[event] = callback;
		},
		emit(event, param) {
			SOCKFS.callbacks[event]?.(param);
		},
		mount(mount) {
			SOCKFS.websocketArgs = Module['websocket'] || {};
			(Module['websocket'] ??= {})['on'] = SOCKFS.on;
			return FS.createNode(null, '/', 16895, 0);
		},
		createSocket(family, type, protocol) {
			if (family != 2) {
				throw new FS.ErrnoError(5);
			}
			type &= ~526336;
			if (type != 1 && type != 2) {
				throw new FS.ErrnoError(28);
			}
			var streaming = type == 1;
			if (streaming && protocol && protocol != 6) {
				throw new FS.ErrnoError(66);
			}
			var sock = {
				family,
				type,
				protocol,
				server: null,
				error: null,
				peers: {},
				pending: [],
				recv_queue: [],
				sock_ops: SOCKFS.websocket_sock_ops,
			};
			var name = SOCKFS.nextname();
			var node = FS.createNode(SOCKFS.root, name, 49152, 0);
			node.sock = sock;
			var stream = FS.createStream({
				path: name,
				node,
				flags: 2,
				seekable: false,
				stream_ops: SOCKFS.stream_ops,
			});
			sock.stream = stream;
			return sock;
		},
		getSocket(fd) {
			var stream = FS.getStream(fd);
			if (!stream || !FS.isSocket(stream.node.mode)) {
				return null;
			}
			return stream.node.sock;
		},
		stream_ops: {
			poll(stream) {
				var sock = stream.node.sock;
				return sock.sock_ops.poll(sock);
			},
			ioctl(stream, request, varargs) {
				var sock = stream.node.sock;
				return sock.sock_ops.ioctl(sock, request, varargs);
			},
			read(stream, buffer, offset, length, position) {
				var sock = stream.node.sock;
				var msg = sock.sock_ops.recvmsg(sock, length);
				if (!msg) {
					return 0;
				}
				buffer.set(msg.buffer, offset);
				return msg.buffer.length;
			},
			write(stream, buffer, offset, length, position) {
				var sock = stream.node.sock;
				return sock.sock_ops.sendmsg(sock, buffer, offset, length);
			},
			close(stream) {
				var sock = stream.node.sock;
				sock.sock_ops.close(sock);
			},
		},
		nextname() {
			if (!SOCKFS.nextname.current) {
				SOCKFS.nextname.current = 0;
			}
			return `socket[${SOCKFS.nextname.current++}]`;
		},
		websocket_sock_ops: {
			createPeer(sock, addr, port) {
				var ws;
				if (typeof addr == 'object') {
					ws = addr;
					addr = null;
					port = null;
				}
				if (ws) {
					if (ws._socket) {
						addr = ws._socket.remoteAddress;
						port = ws._socket.remotePort;
					} else {
						var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
						if (!result) {
							throw new Error(
								'WebSocket URL must be in the format ws(s)://address:port'
							);
						}
						addr = result[1];
						port = parseInt(result[2], 10);
					}
				} else {
					try {
						var url = 'ws://'.replace('#', '//');
						var subProtocols = 'binary';
						var opts = undefined;
						if ('function' === typeof SOCKFS.websocketArgs['url']) {
							url = SOCKFS.websocketArgs['url'](...arguments);
						} else if (
							'string' === typeof SOCKFS.websocketArgs['url']
						) {
							url = SOCKFS.websocketArgs['url'];
						}
						if (SOCKFS.websocketArgs['subprotocol']) {
							subProtocols = SOCKFS.websocketArgs['subprotocol'];
						} else if (
							SOCKFS.websocketArgs['subprotocol'] === null
						) {
							subProtocols = 'null';
						}
						if (url === 'ws://' || url === 'wss://') {
							var parts = addr.split('/');
							url =
								url +
								parts[0] +
								':' +
								port +
								'/' +
								parts.slice(1).join('/');
						}
						if (subProtocols !== 'null') {
							subProtocols = subProtocols
								.replace(/^ +| +$/g, '')
								.split(/ *, */);
							opts = subProtocols;
						}
						var WebSocketConstructor;
						{
							WebSocketConstructor = WebSocket;
						}
						if (Module['websocket']['decorator']) {
							WebSocketConstructor =
								Module['websocket']['decorator'](
									WebSocketConstructor
								);
						}
						ws = new WebSocketConstructor(url, opts);
						ws.binaryType = 'arraybuffer';
					} catch (e) {
						throw new FS.ErrnoError(23);
					}
				}
				var peer = { addr, port, socket: ws, msg_send_queue: [] };
				SOCKFS.websocket_sock_ops.addPeer(sock, peer);
				SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
				if (sock.type === 2 && typeof sock.sport != 'undefined') {
					peer.msg_send_queue.push(
						new Uint8Array([
							255,
							255,
							255,
							255,
							'p'.charCodeAt(0),
							'o'.charCodeAt(0),
							'r'.charCodeAt(0),
							't'.charCodeAt(0),
							(sock.sport & 65280) >> 8,
							sock.sport & 255,
						])
					);
				}
				return peer;
			},
			getPeer(sock, addr, port) {
				return sock.peers[addr + ':' + port];
			},
			addPeer(sock, peer) {
				sock.peers[peer.addr + ':' + peer.port] = peer;
			},
			removePeer(sock, peer) {
				delete sock.peers[peer.addr + ':' + peer.port];
			},
			handlePeerEvents(sock, peer) {
				var first = true;
				var handleOpen = function () {
					sock.connecting = false;
					SOCKFS.emit('open', sock.stream.fd);
					try {
						var queued = peer.msg_send_queue.shift();
						while (queued) {
							peer.socket.send(queued);
							queued = peer.msg_send_queue.shift();
						}
					} catch (e) {
						peer.socket.close();
					}
				};
				function handleMessage(data) {
					if (typeof data == 'string') {
						var encoder = new TextEncoder();
						data = encoder.encode(data);
					} else {
						if (data.byteLength == 0) {
							return;
						}
						data = new Uint8Array(data);
					}
					var wasfirst = first;
					first = false;
					if (
						wasfirst &&
						data.length === 10 &&
						data[0] === 255 &&
						data[1] === 255 &&
						data[2] === 255 &&
						data[3] === 255 &&
						data[4] === 'p'.charCodeAt(0) &&
						data[5] === 'o'.charCodeAt(0) &&
						data[6] === 'r'.charCodeAt(0) &&
						data[7] === 't'.charCodeAt(0)
					) {
						var newport = (data[8] << 8) | data[9];
						SOCKFS.websocket_sock_ops.removePeer(sock, peer);
						peer.port = newport;
						SOCKFS.websocket_sock_ops.addPeer(sock, peer);
						return;
					}
					sock.recv_queue.push({
						addr: peer.addr,
						port: peer.port,
						data,
					});
					SOCKFS.emit('message', sock.stream.fd);
				}
				if (ENVIRONMENT_IS_NODE) {
					peer.socket.on('open', handleOpen);
					peer.socket.on('message', function (data, isBinary) {
						if (!isBinary) {
							return;
						}
						handleMessage(new Uint8Array(data).buffer);
					});
					peer.socket.on('close', function () {
						SOCKFS.emit('close', sock.stream.fd);
					});
					peer.socket.on('error', function (error) {
						sock.error = 14;
						SOCKFS.emit('error', [
							sock.stream.fd,
							sock.error,
							'ECONNREFUSED: Connection refused',
						]);
					});
				} else {
					peer.socket.onopen = handleOpen;
					peer.socket.onclose = function () {
						SOCKFS.emit('close', sock.stream.fd);
					};
					peer.socket.onmessage = function peer_socket_onmessage(
						event
					) {
						handleMessage(event.data);
					};
					peer.socket.onerror = function (error) {
						sock.error = 14;
						SOCKFS.emit('error', [
							sock.stream.fd,
							sock.error,
							'ECONNREFUSED: Connection refused',
						]);
					};
				}
			},
			poll(sock) {
				if (sock.type === 1 && sock.server) {
					return sock.pending.length ? 64 | 1 : 0;
				}
				var mask = 0;
				var dest =
					sock.type === 1
						? SOCKFS.websocket_sock_ops.getPeer(
								sock,
								sock.daddr,
								sock.dport
							)
						: null;
				if (
					sock.recv_queue.length ||
					!dest ||
					(dest && dest.socket.readyState === dest.socket.CLOSING) ||
					(dest && dest.socket.readyState === dest.socket.CLOSED)
				) {
					mask |= 64 | 1;
				}
				if (
					!dest ||
					(dest && dest.socket.readyState === dest.socket.OPEN)
				) {
					mask |= 4;
				}
				if (
					(dest && dest.socket.readyState === dest.socket.CLOSING) ||
					(dest && dest.socket.readyState === dest.socket.CLOSED)
				) {
					if (sock.connecting) {
						mask |= 4;
					} else {
						mask |= 16;
					}
				}
				return mask;
			},
			ioctl(sock, request, arg) {
				switch (request) {
					case 21531:
						var bytes = 0;
						if (sock.recv_queue.length) {
							bytes = sock.recv_queue[0].data.length;
						}
						HEAP32[arg >> 2] = bytes;
						return 0;
					case 21537:
						var on = HEAP32[arg >> 2];
						if (on) {
							sock.stream.flags |= 2048;
						} else {
							sock.stream.flags &= ~2048;
						}
						return 0;
					default:
						return 28;
				}
			},
			close(sock) {
				if (sock.server) {
					try {
						sock.server.close();
					} catch (e) {}
					sock.server = null;
				}
				for (var peer of Object.values(sock.peers)) {
					try {
						peer.socket.close();
					} catch (e) {}
					SOCKFS.websocket_sock_ops.removePeer(sock, peer);
				}
				return 0;
			},
			bind(sock, addr, port) {
				if (
					typeof sock.saddr != 'undefined' ||
					typeof sock.sport != 'undefined'
				) {
					throw new FS.ErrnoError(28);
				}
				sock.saddr = addr;
				sock.sport = port;
				if (sock.type === 2) {
					if (sock.server) {
						sock.server.close();
						sock.server = null;
					}
					try {
						sock.sock_ops.listen(sock, 0);
					} catch (e) {
						if (!(e.name === 'ErrnoError')) throw e;
						if (e.errno !== 138) throw e;
					}
				}
			},
			connect(sock, addr, port) {
				if (sock.server) {
					throw new FS.ErrnoError(138);
				}
				if (
					typeof sock.daddr != 'undefined' &&
					typeof sock.dport != 'undefined'
				) {
					var dest = SOCKFS.websocket_sock_ops.getPeer(
						sock,
						sock.daddr,
						sock.dport
					);
					if (dest) {
						if (dest.socket.readyState === dest.socket.CONNECTING) {
							throw new FS.ErrnoError(7);
						} else {
							throw new FS.ErrnoError(30);
						}
					}
				}
				var peer = SOCKFS.websocket_sock_ops.createPeer(
					sock,
					addr,
					port
				);
				sock.daddr = peer.addr;
				sock.dport = peer.port;
				sock.connecting = true;
			},
			listen(sock, backlog) {
				if (!ENVIRONMENT_IS_NODE) {
					throw new FS.ErrnoError(138);
				}
			},
			accept(listensock) {
				if (!listensock.server || !listensock.pending.length) {
					throw new FS.ErrnoError(28);
				}
				var newsock = listensock.pending.shift();
				newsock.stream.flags = listensock.stream.flags;
				return newsock;
			},
			getname(sock, peer) {
				var addr, port;
				if (peer) {
					if (sock.daddr === undefined || sock.dport === undefined) {
						throw new FS.ErrnoError(53);
					}
					addr = sock.daddr;
					port = sock.dport;
				} else {
					addr = sock.saddr || 0;
					port = sock.sport || 0;
				}
				return { addr, port };
			},
			sendmsg(sock, buffer, offset, length, addr, port) {
				if (sock.type === 2) {
					if (addr === undefined || port === undefined) {
						addr = sock.daddr;
						port = sock.dport;
					}
					if (addr === undefined || port === undefined) {
						throw new FS.ErrnoError(17);
					}
				} else {
					addr = sock.daddr;
					port = sock.dport;
				}
				var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
				if (sock.type === 1) {
					if (
						!dest ||
						dest.socket.readyState === dest.socket.CLOSING ||
						dest.socket.readyState === dest.socket.CLOSED
					) {
						throw new FS.ErrnoError(53);
					}
				}
				if (ArrayBuffer.isView(buffer)) {
					offset += buffer.byteOffset;
					buffer = buffer.buffer;
				}
				var data = buffer.slice(offset, offset + length);
				if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
					if (sock.type === 2) {
						if (
							!dest ||
							dest.socket.readyState === dest.socket.CLOSING ||
							dest.socket.readyState === dest.socket.CLOSED
						) {
							dest = SOCKFS.websocket_sock_ops.createPeer(
								sock,
								addr,
								port
							);
						}
					}
					dest.msg_send_queue.push(data);
					return length;
				}
				try {
					dest.socket.send(data);
					return length;
				} catch (e) {
					throw new FS.ErrnoError(28);
				}
			},
			recvmsg(sock, length, flags) {
				if (sock.type === 1 && sock.server) {
					throw new FS.ErrnoError(53);
				}
				var queued = sock.recv_queue.shift();
				if (!queued) {
					if (sock.type === 1) {
						var dest = SOCKFS.websocket_sock_ops.getPeer(
							sock,
							sock.daddr,
							sock.dport
						);
						if (!dest) {
							throw new FS.ErrnoError(53);
						}
						if (
							dest.socket.readyState === dest.socket.CLOSING ||
							dest.socket.readyState === dest.socket.CLOSED
						) {
							return null;
						}
						throw new FS.ErrnoError(6);
					}
					throw new FS.ErrnoError(6);
				}
				var queuedLength = queued.data.byteLength || queued.data.length;
				var queuedOffset = queued.data.byteOffset || 0;
				var queuedBuffer = queued.data.buffer || queued.data;
				var bytesRead = Math.min(length, queuedLength);
				var res = {
					buffer: new Uint8Array(
						queuedBuffer,
						queuedOffset,
						bytesRead
					),
					addr: queued.addr,
					port: queued.port,
				};
				if (flags & 2) {
					bytesRead = 0;
				}
				if (sock.type === 1 && bytesRead < queuedLength) {
					var bytesRemaining = queuedLength - bytesRead;
					queued.data = new Uint8Array(
						queuedBuffer,
						queuedOffset + bytesRead,
						bytesRemaining
					);
					sock.recv_queue.unshift(queued);
				}
				return res;
			},
		},
	};
	var getSocketFromFD = (fd) => {
		var socket = SOCKFS.getSocket(fd);
		if (!socket) throw new FS.ErrnoError(8);
		return socket;
	};
	var inetPton4 = (str) => {
		var b = str.split('.');
		for (var i = 0; i < 4; i++) {
			var tmp = Number(b[i]);
			if (isNaN(tmp)) return null;
			b[i] = tmp;
		}
		return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
	};
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
				Number(words[words.length - 4]) +
				Number(words[words.length - 3]) * 256;
			words[words.length - 3] =
				Number(words[words.length - 2]) +
				Number(words[words.length - 1]) * 256;
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
	function ___syscall_accept4(fd, addr, addrlen, flags, d1, d2) {
		try {
			var sock = getSocketFromFD(fd);
			var newsock = sock.sock_ops.accept(sock);
			if (addr) {
				var errno = writeSockaddr(
					addr,
					newsock.family,
					DNS.lookup_name(newsock.daddr),
					newsock.dport,
					addrlen
				);
			}
			return newsock.stream.fd;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_accept4.sig = 'iippiii';
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
		return { family, addr, port };
	};
	var getSocketAddress = (addrp, addrlen) => {
		var info = readSockaddr(addrp, addrlen);
		if (info.errno) throw new FS.ErrnoError(info.errno);
		info.addr = DNS.lookup_addr(info.addr) || info.addr;
		return info;
	};
	function ___syscall_bind(fd, addr, addrlen, d1, d2, d3) {
		try {
			var sock = getSocketFromFD(fd);
			var info = getSocketAddress(addr, addrlen);
			sock.sock_ops.bind(sock, info.addr, info.port);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_bind.sig = 'iippiii';
	var SYSCALLS = {
		DEFAULT_POLLMASK: 5,
		calculateAt(dirfd, path, allowEmpty) {
			if (PATH.isAbs(path)) {
				return path;
			}
			var dir;
			if (dirfd === -100) {
				dir = FS.cwd();
			} else {
				var dirstream = SYSCALLS.getStreamFromFD(dirfd);
				dir = dirstream.path;
			}
			if (path.length == 0) {
				if (!allowEmpty) {
					throw new FS.ErrnoError(44);
				}
				return dir;
			}
			return dir + '/' + path;
		},
		writeStat(buf, stat) {
			HEAPU32[buf >> 2] = stat.dev;
			HEAPU32[(buf + 4) >> 2] = stat.mode;
			HEAPU32[(buf + 8) >> 2] = stat.nlink;
			HEAPU32[(buf + 12) >> 2] = stat.uid;
			HEAPU32[(buf + 16) >> 2] = stat.gid;
			HEAPU32[(buf + 20) >> 2] = stat.rdev;
			HEAP64[(buf + 24) >> 3] = BigInt(stat.size);
			HEAP32[(buf + 32) >> 2] = 4096;
			HEAP32[(buf + 36) >> 2] = stat.blocks;
			var atime = stat.atime.getTime();
			var mtime = stat.mtime.getTime();
			var ctime = stat.ctime.getTime();
			HEAP64[(buf + 40) >> 3] = BigInt(Math.floor(atime / 1e3));
			HEAPU32[(buf + 48) >> 2] = (atime % 1e3) * 1e3 * 1e3;
			HEAP64[(buf + 56) >> 3] = BigInt(Math.floor(mtime / 1e3));
			HEAPU32[(buf + 64) >> 2] = (mtime % 1e3) * 1e3 * 1e3;
			HEAP64[(buf + 72) >> 3] = BigInt(Math.floor(ctime / 1e3));
			HEAPU32[(buf + 80) >> 2] = (ctime % 1e3) * 1e3 * 1e3;
			HEAP64[(buf + 88) >> 3] = BigInt(stat.ino);
			return 0;
		},
		writeStatFs(buf, stats) {
			HEAPU32[(buf + 4) >> 2] = stats.bsize;
			HEAPU32[(buf + 60) >> 2] = stats.bsize;
			HEAP64[(buf + 8) >> 3] = BigInt(stats.blocks);
			HEAP64[(buf + 16) >> 3] = BigInt(stats.bfree);
			HEAP64[(buf + 24) >> 3] = BigInt(stats.bavail);
			HEAP64[(buf + 32) >> 3] = BigInt(stats.files);
			HEAP64[(buf + 40) >> 3] = BigInt(stats.ffree);
			HEAPU32[(buf + 48) >> 2] = stats.fsid;
			HEAPU32[(buf + 64) >> 2] = stats.flags;
			HEAPU32[(buf + 56) >> 2] = stats.namelen;
		},
		doMsync(addr, stream, len, flags, offset) {
			if (!FS.isFile(stream.node.mode)) {
				throw new FS.ErrnoError(43);
			}
			if (flags & 2) {
				return 0;
			}
			var buffer = HEAPU8.slice(addr, addr + len);
			FS.msync(stream, buffer, offset, len, flags);
		},
		getStreamFromFD(fd) {
			var stream = FS.getStreamChecked(fd);
			return stream;
		},
		varargs: undefined,
		getStr(ptr) {
			var ret = UTF8ToString(ptr);
			return ret;
		},
	};
	function ___syscall_chdir(path) {
		try {
			path = SYSCALLS.getStr(path);
			FS.chdir(path);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_chdir.sig = 'ip';
	function ___syscall_chmod(path, mode) {
		try {
			path = SYSCALLS.getStr(path);
			FS.chmod(path, mode);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_chmod.sig = 'ipi';
	var allocateUTF8OnStack = (...args) => stringToUTF8OnStack(...args);
	var onInits = [];
	var addOnInit = (cb) => onInits.push(cb);
	function _js_getpid() {
		return PHPLoader.processId ?? 42;
	}
	function _js_wasm_trace(format, ...args) {
		if (PHPLoader.trace instanceof Function) {
			PHPLoader.trace(_js_getpid(), format, ...args);
		}
	}
	var PHPWASM = {
		O_APPEND: 1024,
		O_NONBLOCK: 2048,
		POLLHUP: 16,
		SETFL_MASK: 3072,
		socketTimeouts: new Map(),
		init: function () {
			if (PHPLoader.bindUserSpace) {
				addOnInit(() => {
					if (typeof PHPLoader.processId !== 'number') {
						throw new Error(
							'PHPLoader.processId must be set before init'
						);
					}
					Module['userSpace'] = PHPLoader.bindUserSpace({
						pid: PHPLoader.processId,
						constants: {
							F_GETFL: Number('3'),
							O_ACCMODE: Number('2097155'),
							O_RDONLY: Number('0'),
							O_WRONLY: Number('1'),
							O_APPEND: Number('1024'),
							O_NONBLOCK: Number('2048'),
							F_SETFL: Number('4'),
							F_GETLK: Number('12'),
							F_SETLK: Number('13'),
							F_SETLKW: Number('14'),
							SEEK_SET: Number('0'),
							SEEK_CUR: Number('1'),
							SEEK_END: Number('2'),
							F_GETFL: Number('3'),
							O_ACCMODE: Number('2097155'),
							O_RDONLY: Number('0'),
							O_WRONLY: Number('1'),
							O_APPEND: Number('1024'),
							O_NONBLOCK: Number('2048'),
							F_SETFL: Number('4'),
							F_GETLK: Number('12'),
							F_SETLK: Number('13'),
							F_SETLKW: Number('14'),
							SEEK_SET: Number('0'),
							SEEK_CUR: Number('1'),
							SEEK_END: Number('2'),
							F_RDLCK: 0,
							F_WRLCK: 1,
							F_UNLCK: 2,
							LOCK_SH: 1,
							LOCK_EX: 2,
							LOCK_NB: 4,
							LOCK_UN: 8,
						},
						errnoCodes: ERRNO_CODES,
						memory: {
							HEAP8: {
								get(offset) {
									return HEAP8[offset];
								},
								set(offset, value) {
									HEAP8[offset] = value;
								},
							},
							HEAPU8: {
								get(offset) {
									return HEAPU8[offset];
								},
								set(offset, value) {
									HEAPU8[offset] = value;
								},
							},
							HEAP16: {
								get(offset) {
									return HEAP16[offset];
								},
								set(offset, value) {
									HEAP16[offset] = value;
								},
							},
							HEAPU16: {
								get(offset) {
									return HEAPU16[offset];
								},
								set(offset, value) {
									HEAPU16[offset] = value;
								},
							},
							HEAP32: {
								get(offset) {
									return HEAP32[offset];
								},
								set(offset, value) {
									HEAP32[offset] = value;
								},
							},
							HEAPU32: {
								get(offset) {
									return HEAPU32[offset];
								},
								set(offset, value) {
									HEAPU32[offset] = value;
								},
							},
							HEAPF32: {
								get(offset) {
									return HEAPF32[offset];
								},
								set(offset, value) {
									HEAPF32[offset] = value;
								},
							},
							HEAP64: {
								get(offset) {
									return HEAP64[offset];
								},
								set(offset, value) {
									HEAP64[offset] = value;
								},
							},
							HEAPU64: {
								get(offset) {
									return HEAPU64[offset];
								},
								set(offset, value) {
									HEAPU64[offset] = value;
								},
							},
							HEAPF64: {
								get(offset) {
									return HEAPF64[offset];
								},
								set(offset, value) {
									HEAPF64[offset] = value;
								},
							},
						},
						wasmImports: Object.assign(
							{},
							wasmImports,
							typeof _builtin_fd_close === 'function'
								? { builtin_fd_close: _builtin_fd_close }
								: {},
							typeof _builtin_fcntl64 === 'function'
								? { builtin_fcntl64: _builtin_fcntl64 }
								: {}
						),
						wasmExports,
						syscalls: SYSCALLS,
						FS,
						PROXYFS,
						NODEFS,
					});
				});
			}
			Module['ENV'] = Module['ENV'] || {};
			Module['ENV']['PATH'] = [
				Module['ENV']['PATH'],
				'/internal/shared/bin',
			]
				.filter(Boolean)
				.join(':');
			FS.mkdir('/request');
			FS.mkdir('/internal');
			if (PHPLoader.nativeInternalDirPath) {
				FS.mount(
					FS.filesystems.NODEFS,
					{ root: PHPLoader.nativeInternalDirPath },
					'/internal'
				);
			}
			FS.mkdirTree('/internal/shared');
			FS.mkdirTree('/internal/shared/preload');
			FS.mkdirTree('/internal/shared/bin');
			const originalOnRuntimeInitialized = Module['onRuntimeInitialized'];
			Module['onRuntimeInitialized'] = () => {
				const { node: phpBinaryNode } = FS.lookupPath(
					'/internal/shared/bin/php',
					{ noent_okay: true }
				);
				if (!phpBinaryNode) {
					FS.writeFile(
						'/internal/shared/bin/php',
						new TextEncoder().encode('#!/bin/sh\nphp "$@"')
					);
					FS.chmod('/internal/shared/bin/php', 493);
				}
				originalOnRuntimeInitialized();
			};
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
				stream.tty.ops.fsync(stream.tty);
				return retval;
			};
			const originalPutChar = TTY.stream_ops.put_char;
			TTY.stream_ops.put_char = function (tty, val) {
				if (val === 10) tty.output.push(val);
				return originalPutChar(tty, val);
			};
		},
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
		parseSocketTimeout: function (optionValuePtr, optionLen) {
			if (!optionValuePtr || optionLen < 8) {
				return null;
			}
			let seconds;
			let microseconds;
			if (optionLen >= 16) {
				seconds = Number(HEAP64[optionValuePtr >> 3]);
				microseconds = Number(HEAP64[(optionValuePtr + 8) >> 3]);
			} else {
				seconds = HEAP32[optionValuePtr >> 2];
				microseconds = HEAP32[(optionValuePtr + 4) >> 2];
			}
			if (
				!Number.isFinite(seconds) ||
				!Number.isFinite(microseconds) ||
				seconds < 0 ||
				microseconds < 0
			) {
				return null;
			}
			return seconds * 1e3 + Math.ceil(microseconds / 1e3);
		},
		spawnProcess: function (command, args, options) {
			if (Module['spawnProcess']) {
				const spawned = Module['spawnProcess'](command, args, {
					...options,
					shell: true,
					stdio: ['pipe', 'pipe', 'pipe'],
				});
				if (spawned && !('then' in spawned) && 'on' in spawned) {
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
		shutdownSocket: function (socketd, how) {
			PHPWASM.socketTimeouts.delete(socketd);
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
	function _wasm_connect(sockfd, addr, addrlen) {
		if (!('Suspending' in WebAssembly)) {
			var sock = getSocketFromFD(sockfd);
			var info = getSocketAddress(addr, addrlen);
			sock.sock_ops.connect(sock, info.addr, info.port);
			return 0;
		}
		return Asyncify.handleSleep((wakeUp) => {
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
			const webSockets = PHPWASM.getAllWebSockets(sock);
			if (!webSockets.length) {
				wakeUp(-ERRNO_CODES.ECONNREFUSED);
				return;
			}
			const ws = webSockets[0];
			if (ws.readyState === ws.OPEN) {
				wakeUp(0);
				return;
			}
			if (ws.readyState === ws.CLOSING || ws.readyState === ws.CLOSED) {
				wakeUp(-ERRNO_CODES.ECONNREFUSED);
				return;
			}
			const sendTimeout = PHPWASM.socketTimeouts.get(sockfd)?.send;
			const timeout = sendTimeout ?? 3e4;
			let resolved = false;
			let timeoutId;
			let handleOpen;
			let handleError;
			let handleClose;
			const peer = PHPWASM.getAllPeers(sock).find(
				(candidate) => candidate.socket === ws
			);
			const cleanupConnectListeners = () => {
				if (typeof timeoutId !== 'undefined') {
					clearTimeout(timeoutId);
				}
				ws.removeEventListener('open', handleOpen);
				ws.removeEventListener('error', handleError);
				ws.removeEventListener('close', handleClose);
			};
			const cleanupFailedConnect = (errno) => {
				try {
					if (
						ws.readyState !== ws.CLOSING &&
						ws.readyState !== ws.CLOSED
					) {
						ws.close();
					}
				} catch (e) {}
				if (peer) {
					SOCKFS.websocket_sock_ops.removePeer(sock, peer);
				}
				sock.connecting = false;
				sock.error = errno;
			};
			const finishConnect = (result) => {
				if (!resolved) {
					resolved = true;
					cleanupConnectListeners();
					if (result < 0) {
						cleanupFailedConnect(-result);
					}
					wakeUp(result);
				}
			};
			if (timeout > 0) {
				timeoutId = setTimeout(() => {
					finishConnect(-ERRNO_CODES.ETIMEDOUT);
				}, timeout);
			}
			handleOpen = () => {
				finishConnect(0);
			};
			handleError = () => {
				finishConnect(-ERRNO_CODES.ECONNREFUSED);
			};
			handleClose = () => {
				finishConnect(-ERRNO_CODES.ECONNREFUSED);
			};
			ws.addEventListener('open', handleOpen);
			ws.addEventListener('error', handleError);
			ws.addEventListener('close', handleClose);
		});
	}
	function ___syscall_connect(sockfd, addr, addrlen, d1, d2, d3) {
		return _wasm_connect(sockfd, addr, addrlen);
	}
	___syscall_connect.sig = 'iippiii';
	function ___syscall_dup(fd) {
		try {
			var old = SYSCALLS.getStreamFromFD(fd);
			return FS.dupStream(old).fd;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_dup.sig = 'ii';
	function ___syscall_dup3(fd, newfd, flags) {
		try {
			var old = SYSCALLS.getStreamFromFD(fd);
			if (old.fd === newfd) return -28;
			if (newfd < 0 || newfd >= FS.MAX_OPEN_FDS) return -8;
			var existing = FS.getStream(newfd);
			if (existing) FS.close(existing);
			return FS.dupStream(old, newfd).fd;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_dup3.sig = 'iiii';
	function ___syscall_faccessat(dirfd, path, amode, flags) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			if (amode & ~7) {
				return -28;
			}
			var lookup = FS.lookupPath(path, { follow: true });
			var node = lookup.node;
			if (!node) {
				return -44;
			}
			var perms = '';
			if (amode & 4) perms += 'r';
			if (amode & 2) perms += 'w';
			if (amode & 1) perms += 'x';
			if (perms && FS.nodePermissions(node, perms)) {
				return -2;
			}
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_faccessat.sig = 'iipii';
	function ___syscall_fchmod(fd, mode) {
		try {
			FS.fchmod(fd, mode);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fchmod.sig = 'iii';
	function ___syscall_fchown32(fd, owner, group) {
		try {
			FS.fchown(fd, owner, group);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fchown32.sig = 'iiii';
	function ___syscall_fchownat(dirfd, path, owner, group, flags) {
		try {
			path = SYSCALLS.getStr(path);
			var nofollow = flags & 256;
			flags = flags & ~256;
			path = SYSCALLS.calculateAt(dirfd, path);
			(nofollow ? FS.lchown : FS.chown)(path, owner, group);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fchownat.sig = 'iipiii';
	var syscallGetVarargI = () => {
		var ret = HEAP32[+SYSCALLS.varargs >> 2];
		SYSCALLS.varargs += 4;
		return ret;
	};
	var syscallGetVarargP = syscallGetVarargI;
	function ___syscall_fcntl64(fd, cmd, varargs) {
		SYSCALLS.varargs = varargs;
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			switch (cmd) {
				case 0: {
					var arg = syscallGetVarargI();
					if (arg < 0) {
						return -28;
					}
					while (FS.streams[arg]) {
						arg++;
					}
					var newStream;
					newStream = FS.dupStream(stream, arg);
					return newStream.fd;
				}
				case 1:
				case 2:
					return 0;
				case 3:
					return stream.flags;
				case 4: {
					var arg = syscallGetVarargI();
					stream.flags |= arg;
					return 0;
				}
				case 12: {
					var arg = syscallGetVarargP();
					var offset = 0;
					HEAP16[(arg + offset) >> 1] = 2;
					return 0;
				}
				case 13:
				case 14:
					return 0;
			}
			return -28;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fcntl64.sig = 'iiip';
	function ___syscall_fdatasync(fd) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fdatasync.sig = 'ii';
	function ___syscall_fstat64(fd, buf) {
		try {
			return SYSCALLS.writeStat(buf, FS.fstat(fd));
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fstat64.sig = 'iip';
	var INT53_MAX = 9007199254740992;
	var INT53_MIN = -9007199254740992;
	var bigintToI53Checked = (num) =>
		num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);
	function ___syscall_ftruncate64(fd, length) {
		length = bigintToI53Checked(length);
		try {
			if (isNaN(length)) return -61;
			FS.ftruncate(fd, length);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_ftruncate64.sig = 'iij';
	function ___syscall_getcwd(buf, size) {
		try {
			if (size === 0) return -28;
			var cwd = FS.cwd();
			var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
			if (size < cwdLengthInBytes) return -68;
			stringToUTF8(cwd, buf, size);
			return cwdLengthInBytes;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_getcwd.sig = 'ipp';
	function ___syscall_getdents64(fd, dirp, count) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			stream.getdents ||= FS.readdir(stream.path);
			var struct_size = 280;
			var pos = 0;
			var off = FS.llseek(stream, 0, 1);
			var startIdx = Math.floor(off / struct_size);
			var endIdx = Math.min(
				stream.getdents.length,
				startIdx + Math.floor(count / struct_size)
			);
			for (var idx = startIdx; idx < endIdx; idx++) {
				var id;
				var type;
				var name = stream.getdents[idx];
				if (name === '.') {
					id = stream.node.id;
					type = 4;
				} else if (name === '..') {
					var lookup = FS.lookupPath(stream.path, { parent: true });
					id = lookup.node.id;
					type = 4;
				} else {
					var child;
					try {
						child = FS.lookupNode(stream.node, name);
					} catch (e) {
						if (e?.errno === 28) {
							continue;
						}
						throw e;
					}
					id = child.id;
					type = FS.isChrdev(child.mode)
						? 2
						: FS.isDir(child.mode)
							? 4
							: FS.isLink(child.mode)
								? 10
								: 8;
				}
				HEAP64[(dirp + pos) >> 3] = BigInt(id);
				HEAP64[(dirp + pos + 8) >> 3] = BigInt((idx + 1) * struct_size);
				HEAP16[(dirp + pos + 16) >> 1] = 280;
				HEAP8[dirp + pos + 18] = type;
				stringToUTF8(name, dirp + pos + 19, 256);
				pos += struct_size;
			}
			FS.llseek(stream, idx * struct_size, 0);
			return pos;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_getdents64.sig = 'iipp';
	function ___syscall_getpeername(fd, addr, addrlen, d1, d2, d3) {
		try {
			var sock = getSocketFromFD(fd);
			if (!sock.daddr) {
				return -53;
			}
			var errno = writeSockaddr(
				addr,
				sock.family,
				DNS.lookup_name(sock.daddr),
				sock.dport,
				addrlen
			);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_getpeername.sig = 'iippiii';
	function ___syscall_getsockname(fd, addr, addrlen, d1, d2, d3) {
		try {
			var sock = getSocketFromFD(fd);
			var errno = writeSockaddr(
				addr,
				sock.family,
				DNS.lookup_name(sock.saddr || '0.0.0.0'),
				sock.sport,
				addrlen
			);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_getsockname.sig = 'iippiii';
	function ___syscall_getsockopt(fd, level, optname, optval, optlen, d1) {
		try {
			var sock = getSocketFromFD(fd);
			if (level === 1) {
				if (optname === 4) {
					HEAP32[optval >> 2] = sock.error;
					HEAP32[optlen >> 2] = 4;
					sock.error = null;
					return 0;
				}
			}
			return -50;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_getsockopt.sig = 'iiiippi';
	function ___syscall_ioctl(fd, op, varargs) {
		SYSCALLS.varargs = varargs;
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			switch (op) {
				case 21509: {
					if (!stream.tty) return -59;
					return 0;
				}
				case 21505: {
					if (!stream.tty) return -59;
					if (stream.tty.ops.ioctl_tcgets) {
						var termios = stream.tty.ops.ioctl_tcgets(stream);
						var argp = syscallGetVarargP();
						HEAP32[argp >> 2] = termios.c_iflag || 0;
						HEAP32[(argp + 4) >> 2] = termios.c_oflag || 0;
						HEAP32[(argp + 8) >> 2] = termios.c_cflag || 0;
						HEAP32[(argp + 12) >> 2] = termios.c_lflag || 0;
						for (var i = 0; i < 32; i++) {
							HEAP8[argp + i + 17] = termios.c_cc[i] || 0;
						}
						return 0;
					}
					return 0;
				}
				case 21510:
				case 21511:
				case 21512: {
					if (!stream.tty) return -59;
					return 0;
				}
				case 21506:
				case 21507:
				case 21508: {
					if (!stream.tty) return -59;
					if (stream.tty.ops.ioctl_tcsets) {
						var argp = syscallGetVarargP();
						var c_iflag = HEAP32[argp >> 2];
						var c_oflag = HEAP32[(argp + 4) >> 2];
						var c_cflag = HEAP32[(argp + 8) >> 2];
						var c_lflag = HEAP32[(argp + 12) >> 2];
						var c_cc = [];
						for (var i = 0; i < 32; i++) {
							c_cc.push(HEAP8[argp + i + 17]);
						}
						return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
							c_iflag,
							c_oflag,
							c_cflag,
							c_lflag,
							c_cc,
						});
					}
					return 0;
				}
				case 21519: {
					if (!stream.tty) return -59;
					var argp = syscallGetVarargP();
					HEAP32[argp >> 2] = 0;
					return 0;
				}
				case 21520: {
					if (!stream.tty) return -59;
					return -28;
				}
				case 21537:
				case 21531: {
					var argp = syscallGetVarargP();
					return FS.ioctl(stream, op, argp);
				}
				case 21523: {
					if (!stream.tty) return -59;
					if (stream.tty.ops.ioctl_tiocgwinsz) {
						var winsize = stream.tty.ops.ioctl_tiocgwinsz(
							stream.tty
						);
						var argp = syscallGetVarargP();
						HEAP16[argp >> 1] = winsize[0];
						HEAP16[(argp + 2) >> 1] = winsize[1];
					}
					return 0;
				}
				case 21524: {
					if (!stream.tty) return -59;
					return 0;
				}
				case 21515: {
					if (!stream.tty) return -59;
					return 0;
				}
				default:
					return -28;
			}
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_ioctl.sig = 'iiip';
	function ___syscall_listen(fd, backlog) {
		try {
			var sock = getSocketFromFD(fd);
			sock.sock_ops.listen(sock, backlog);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_listen.sig = 'iiiiiii';
	function ___syscall_lstat64(path, buf) {
		try {
			path = SYSCALLS.getStr(path);
			return SYSCALLS.writeStat(buf, FS.lstat(path));
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_lstat64.sig = 'ipp';
	function ___syscall_mkdirat(dirfd, path, mode) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			FS.mkdir(path, mode, 0);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_mkdirat.sig = 'iipi';
	function ___syscall_newfstatat(dirfd, path, buf, flags) {
		try {
			path = SYSCALLS.getStr(path);
			var nofollow = flags & 256;
			var allowEmpty = flags & 4096;
			flags = flags & ~6400;
			path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
			return SYSCALLS.writeStat(
				buf,
				nofollow ? FS.lstat(path) : FS.stat(path)
			);
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_newfstatat.sig = 'iippi';
	function ___syscall_openat(dirfd, path, flags, varargs) {
		SYSCALLS.varargs = varargs;
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			var mode = varargs ? syscallGetVarargI() : 0;
			return FS.open(path, flags, mode).fd;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_openat.sig = 'iipip';
	var PIPEFS = {
		BUCKET_BUFFER_SIZE: 8192,
		mount(mount) {
			return FS.createNode(null, '/', 16384 | 511, 0);
		},
		createPipe() {
			var pipe = { buckets: [], refcnt: 2, timestamp: new Date() };
			pipe.buckets.push({
				buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
				offset: 0,
				roffset: 0,
			});
			var rName = PIPEFS.nextname();
			var wName = PIPEFS.nextname();
			var rNode = FS.createNode(PIPEFS.root, rName, 4096, 0);
			var wNode = FS.createNode(PIPEFS.root, wName, 4096, 0);
			rNode.pipe = pipe;
			wNode.pipe = pipe;
			var readableStream = FS.createStream({
				path: rName,
				node: rNode,
				flags: 0,
				seekable: false,
				stream_ops: PIPEFS.stream_ops,
			});
			rNode.stream = readableStream;
			var writableStream = FS.createStream({
				path: wName,
				node: wNode,
				flags: 1,
				seekable: false,
				stream_ops: PIPEFS.stream_ops,
			});
			wNode.stream = writableStream;
			return {
				readable_fd: readableStream.fd,
				writable_fd: writableStream.fd,
			};
		},
		stream_ops: {
			getattr(stream) {
				var node = stream.node;
				var timestamp = node.pipe.timestamp;
				return {
					dev: 14,
					ino: node.id,
					mode: 4480,
					nlink: 1,
					uid: 0,
					gid: 0,
					rdev: 0,
					size: 0,
					atime: timestamp,
					mtime: timestamp,
					ctime: timestamp,
					blksize: 4096,
					blocks: 0,
				};
			},
			poll(stream) {
				var pipe = stream.node.pipe;
				if ((stream.flags & 2097155) === 1) {
					return 256 | 4;
				}
				for (var bucket of pipe.buckets) {
					if (bucket.offset - bucket.roffset > 0) {
						return 64 | 1;
					}
				}
				return 0;
			},
			dup(stream) {
				stream.node.pipe.refcnt++;
			},
			ioctl(stream, request, varargs) {
				return 28;
			},
			fsync(stream) {
				return 28;
			},
			read(stream, buffer, offset, length, position) {
				var pipe = stream.node.pipe;
				var currentLength = 0;
				for (var bucket of pipe.buckets) {
					currentLength += bucket.offset - bucket.roffset;
				}
				var data = buffer.subarray(offset, offset + length);
				if (length <= 0) {
					return 0;
				}
				if (currentLength == 0) {
					if (pipe.refcnt < 2) {
						return 0;
					}
					throw new FS.ErrnoError(6);
				}
				var toRead = Math.min(currentLength, length);
				var totalRead = toRead;
				var toRemove = 0;
				for (var bucket of pipe.buckets) {
					var bucketSize = bucket.offset - bucket.roffset;
					if (toRead <= bucketSize) {
						var tmpSlice = bucket.buffer.subarray(
							bucket.roffset,
							bucket.offset
						);
						if (toRead < bucketSize) {
							tmpSlice = tmpSlice.subarray(0, toRead);
							bucket.roffset += toRead;
						} else {
							toRemove++;
						}
						data.set(tmpSlice);
						break;
					} else {
						var tmpSlice = bucket.buffer.subarray(
							bucket.roffset,
							bucket.offset
						);
						data.set(tmpSlice);
						data = data.subarray(tmpSlice.byteLength);
						toRead -= tmpSlice.byteLength;
						toRemove++;
					}
				}
				if (toRemove && toRemove == pipe.buckets.length) {
					toRemove--;
					pipe.buckets[toRemove].offset = 0;
					pipe.buckets[toRemove].roffset = 0;
				}
				pipe.buckets.splice(0, toRemove);
				return totalRead;
			},
			write(stream, buffer, offset, length, position) {
				var pipe = stream.node.pipe;
				var data = buffer.subarray(offset, offset + length);
				var dataLen = data.byteLength;
				if (dataLen <= 0) {
					return 0;
				}
				var currBucket = null;
				if (pipe.buckets.length == 0) {
					currBucket = {
						buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
						offset: 0,
						roffset: 0,
					};
					pipe.buckets.push(currBucket);
				} else {
					currBucket = pipe.buckets[pipe.buckets.length - 1];
				}
				var freeBytesInCurrBuffer =
					PIPEFS.BUCKET_BUFFER_SIZE - currBucket.offset;
				if (freeBytesInCurrBuffer >= dataLen) {
					currBucket.buffer.set(data, currBucket.offset);
					currBucket.offset += dataLen;
					return dataLen;
				} else if (freeBytesInCurrBuffer > 0) {
					currBucket.buffer.set(
						data.subarray(0, freeBytesInCurrBuffer),
						currBucket.offset
					);
					currBucket.offset += freeBytesInCurrBuffer;
					data = data.subarray(
						freeBytesInCurrBuffer,
						data.byteLength
					);
				}
				var numBuckets =
					(data.byteLength / PIPEFS.BUCKET_BUFFER_SIZE) | 0;
				var remElements = data.byteLength % PIPEFS.BUCKET_BUFFER_SIZE;
				for (var i = 0; i < numBuckets; i++) {
					var newBucket = {
						buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
						offset: PIPEFS.BUCKET_BUFFER_SIZE,
						roffset: 0,
					};
					pipe.buckets.push(newBucket);
					newBucket.buffer.set(
						data.subarray(0, PIPEFS.BUCKET_BUFFER_SIZE)
					);
					data = data.subarray(
						PIPEFS.BUCKET_BUFFER_SIZE,
						data.byteLength
					);
				}
				if (remElements > 0) {
					var newBucket = {
						buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
						offset: data.byteLength,
						roffset: 0,
					};
					pipe.buckets.push(newBucket);
					newBucket.buffer.set(data);
				}
				return dataLen;
			},
			close(stream) {
				var pipe = stream.node.pipe;
				pipe.refcnt--;
				if (pipe.refcnt === 0) {
					pipe.buckets = null;
				}
			},
		},
		nextname() {
			if (!PIPEFS.nextname.current) {
				PIPEFS.nextname.current = 0;
			}
			return 'pipe[' + PIPEFS.nextname.current++ + ']';
		},
	};
	function ___syscall_pipe(fdPtr) {
		try {
			if (fdPtr == 0) {
				throw new FS.ErrnoError(21);
			}
			var res = PIPEFS.createPipe();
			HEAP32[fdPtr >> 2] = res.readable_fd;
			HEAP32[(fdPtr + 4) >> 2] = res.writable_fd;
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_pipe.sig = 'ip';
	function ___syscall_poll(fds, nfds, timeout) {
		try {
			var nonzero = 0;
			for (var i = 0; i < nfds; i++) {
				var pollfd = fds + 8 * i;
				var fd = HEAP32[pollfd >> 2];
				var events = HEAP16[(pollfd + 4) >> 1];
				var mask = 32;
				var stream = FS.getStream(fd);
				if (stream) {
					mask = SYSCALLS.DEFAULT_POLLMASK;
					if (stream.stream_ops?.poll) {
						mask = stream.stream_ops.poll(stream, -1);
					}
				}
				mask &= events | 8 | 16;
				if (mask) nonzero++;
				HEAP16[(pollfd + 6) >> 1] = mask;
			}
			return nonzero;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_poll.sig = 'ipii';
	function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			if (bufsize <= 0) return -28;
			var ret = FS.readlink(path);
			var len = Math.min(bufsize, lengthBytesUTF8(ret));
			var endChar = HEAP8[buf + len];
			stringToUTF8(ret, buf, bufsize + 1);
			HEAP8[buf + len] = endChar;
			return len;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_readlinkat.sig = 'iippp';
	function ___syscall_recvfrom(fd, buf, len, flags, addr, addrlen) {
		try {
			var sock = getSocketFromFD(fd);
			var msg = sock.sock_ops.recvmsg(
				sock,
				len,
				typeof flags !== 'undefined' ? flags : 0
			);
			if (!msg) return 0;
			if (addr) {
				var errno = writeSockaddr(
					addr,
					sock.family,
					DNS.lookup_name(msg.addr),
					msg.port,
					addrlen
				);
			}
			HEAPU8.set(msg.buffer, buf);
			return msg.buffer.byteLength;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_recvfrom.sig = 'iippipp';
	function ___syscall_renameat(olddirfd, oldpath, newdirfd, newpath) {
		try {
			oldpath = SYSCALLS.getStr(oldpath);
			newpath = SYSCALLS.getStr(newpath);
			oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
			newpath = SYSCALLS.calculateAt(newdirfd, newpath);
			FS.rename(oldpath, newpath);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_renameat.sig = 'iipip';
	function ___syscall_rmdir(path) {
		try {
			path = SYSCALLS.getStr(path);
			FS.rmdir(path);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_rmdir.sig = 'ip';
	function ___syscall_sendto(fd, message, length, flags, addr, addr_len) {
		try {
			var sock = getSocketFromFD(fd);
			if (!addr) {
				return FS.write(sock.stream, HEAP8, message, length);
			}
			var dest = getSocketAddress(addr, addr_len);
			return sock.sock_ops.sendmsg(
				sock,
				HEAP8,
				message,
				length,
				dest.addr,
				dest.port
			);
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_sendto.sig = 'iippipp';
	function ___syscall_socket(domain, type, protocol) {
		try {
			var sock = SOCKFS.createSocket(domain, type, protocol);
			return sock.stream.fd;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_socket.sig = 'iiiiiii';
	function ___syscall_stat64(path, buf) {
		try {
			path = SYSCALLS.getStr(path);
			return SYSCALLS.writeStat(buf, FS.stat(path));
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_stat64.sig = 'ipp';
	function ___syscall_statfs64(path, size, buf) {
		try {
			SYSCALLS.writeStatFs(buf, FS.statfs(SYSCALLS.getStr(path)));
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_statfs64.sig = 'ippp';
	function ___syscall_symlinkat(target, dirfd, linkpath) {
		try {
			target = SYSCALLS.getStr(target);
			linkpath = SYSCALLS.getStr(linkpath);
			linkpath = SYSCALLS.calculateAt(dirfd, linkpath);
			FS.symlink(target, linkpath);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_symlinkat.sig = 'ipip';
	function ___syscall_unlinkat(dirfd, path, flags) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			if (!flags) {
				FS.unlink(path);
			} else if (flags === 512) {
				FS.rmdir(path);
			} else {
				return -28;
			}
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_unlinkat.sig = 'iipi';
	var readI53FromI64 = (ptr) =>
		HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296;
	function ___syscall_utimensat(dirfd, path, times, flags) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path, true);
			var now = Date.now(),
				atime,
				mtime;
			if (!times) {
				atime = now;
				mtime = now;
			} else {
				var seconds = readI53FromI64(times);
				var nanoseconds = HEAP32[(times + 8) >> 2];
				if (nanoseconds == 1073741823) {
					atime = now;
				} else if (nanoseconds == 1073741822) {
					atime = null;
				} else {
					atime = seconds * 1e3 + nanoseconds / (1e3 * 1e3);
				}
				times += 16;
				seconds = readI53FromI64(times);
				nanoseconds = HEAP32[(times + 8) >> 2];
				if (nanoseconds == 1073741823) {
					mtime = now;
				} else if (nanoseconds == 1073741822) {
					mtime = null;
				} else {
					mtime = seconds * 1e3 + nanoseconds / (1e3 * 1e3);
				}
			}
			if ((mtime ?? atime) !== null) {
				FS.utime(path, atime, mtime);
			}
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_utimensat.sig = 'iippi';
	var __abort_js = () => abort('');
	__abort_js.sig = 'v';
	var dlSetError = (msg) => {
		var sp = stackSave();
		var cmsg = stringToUTF8OnStack(msg);
		___dl_seterr(cmsg, 0);
		stackRestore(sp);
	};
	var dlopenInternal = (handle, jsflags) => {
		var filename = UTF8ToString(handle + 36);
		var flags = HEAP32[(handle + 4) >> 2];
		filename = PATH.normalize(filename);
		var global = Boolean(flags & 256);
		var localScope = global ? null : {};
		var combinedFlags = {
			global,
			nodelete: Boolean(flags & 4096),
			loadAsync: jsflags.loadAsync,
		};
		if (jsflags.loadAsync) {
			return loadDynamicLibrary(
				filename,
				combinedFlags,
				localScope,
				handle
			);
		}
		try {
			return loadDynamicLibrary(
				filename,
				combinedFlags,
				localScope,
				handle
			);
		} catch (e) {
			dlSetError(`could not load dynamic lib: ${filename}\n${e}`);
			return 0;
		}
	};
	function __dlopen_js(handle) {
		var jsflags = { loadAsync: false };
		return dlopenInternal(handle, jsflags);
	}
	__dlopen_js.sig = 'pp';
	var __dlsym_js = (handle, symbol, symbolIndex) => {
		symbol = UTF8ToString(symbol);
		var result;
		var newSymIndex;
		var lib = LDSO.loadedLibsByHandle[handle];
		newSymIndex = Object.keys(lib.exports).indexOf(symbol);
		if (newSymIndex == -1 || lib.exports[symbol].stub) {
			dlSetError(
				`Tried to lookup unknown symbol "${symbol}" in dynamic lib: ${lib.name}`
			);
			return 0;
		}
		result = lib.exports[symbol];
		if (typeof result == 'function') {
			if (result.orig) {
				result = result.orig;
			}
			var addr = getFunctionAddress(result);
			if (addr) {
				result = addr;
			} else {
				result = addFunction(result, result.sig);
				HEAPU32[symbolIndex >> 2] = newSymIndex;
			}
		}
		return result;
	};
	__dlsym_js.sig = 'pppp';
	var __emscripten_lookup_name = (name) => {
		var nameString = UTF8ToString(name);
		return inetPton4(DNS.lookup_name(nameString));
	};
	__emscripten_lookup_name.sig = 'ip';
	var runtimeKeepaliveCounter = 0;
	var __emscripten_runtime_keepalive_clear = () => {
		noExitRuntime = false;
		runtimeKeepaliveCounter = 0;
	};
	__emscripten_runtime_keepalive_clear.sig = 'v';
	function __gmtime_js(time, tmPtr) {
		time = bigintToI53Checked(time);
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
	__gmtime_js.sig = 'vjp';
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
	function __localtime_js(time, tmPtr) {
		time = bigintToI53Checked(time);
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
	__localtime_js.sig = 'vjp';
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
		return BigInt(ret);
	};
	__mktime_js.sig = 'jp';
	function __mmap_js(len, prot, flags, fd, offset, allocated, addr) {
		offset = bigintToI53Checked(offset);
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			var res = FS.mmap(stream, len, offset, prot, flags);
			var ptr = res.ptr;
			HEAP32[allocated >> 2] = res.allocated;
			HEAPU32[addr >> 2] = ptr;
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	__mmap_js.sig = 'ipiiijpp';
	function __munmap_js(addr, len, prot, flags, fd, offset) {
		offset = bigintToI53Checked(offset);
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			if (prot & 2) {
				SYSCALLS.doMsync(addr, stream, len, flags, offset);
			}
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	__munmap_js.sig = 'ippiiij';
	var timers = {};
	var handleException = (e) => {
		if (e instanceof ExitStatus || e == 'unwind') {
			return EXITSTATUS;
		}
		quit_(1, e);
	};
	var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
	var _proc_exit = (code) => {
		EXITSTATUS = code;
		if (!keepRuntimeAlive()) {
			Module['onExit']?.(code);
			ABORT = true;
		}
		quit_(code, new ExitStatus(code));
	};
	_proc_exit.sig = 'vi';
	var exitJS = (status, implicit) => {
		EXITSTATUS = status;
		if (!keepRuntimeAlive()) {
			exitRuntime();
		}
		_proc_exit(status);
	};
	var _exit = exitJS;
	_exit.sig = 'vi';
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
	var _emscripten_get_now = () => performance.now();
	_emscripten_get_now.sig = 'd';
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
		timers[which] = { id, timeout_ms };
		return 0;
	};
	__setitimer_js.sig = 'iid';
	var __tzset_js = (timezone, daylight, std_name, dst_name) => {
		var currentYear = new Date().getFullYear();
		var winter = new Date(currentYear, 0, 1);
		var summer = new Date(currentYear, 6, 1);
		var winterOffset = winter.getTimezoneOffset();
		var summerOffset = summer.getTimezoneOffset();
		var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
		HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;
		HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
		var extractZone = (timezoneOffset) => {
			var sign = timezoneOffset >= 0 ? '-' : '+';
			var absOffset = Math.abs(timezoneOffset);
			var hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
			var minutes = String(absOffset % 60).padStart(2, '0');
			return `UTC${sign}${hours}${minutes}`;
		};
		var winterName = extractZone(winterOffset);
		var summerName = extractZone(summerOffset);
		if (summerOffset < winterOffset) {
			stringToUTF8(winterName, std_name, 17);
			stringToUTF8(summerName, dst_name, 17);
		} else {
			stringToUTF8(winterName, dst_name, 17);
			stringToUTF8(summerName, std_name, 17);
		}
	};
	__tzset_js.sig = 'vpppp';
	var _emscripten_date_now = () => Date.now();
	_emscripten_date_now.sig = 'd';
	var nowIsMonotonic = 1;
	var checkWasiClock = (clock_id) => clock_id >= 0 && clock_id <= 3;
	function _clock_time_get(clk_id, ignored_precision, ptime) {
		ignored_precision = bigintToI53Checked(ignored_precision);
		if (!checkWasiClock(clk_id)) {
			return 28;
		}
		var now;
		if (clk_id === 0) {
			now = _emscripten_date_now();
		} else if (nowIsMonotonic) {
			now = _emscripten_get_now();
		} else {
			return 52;
		}
		var nsec = Math.round(now * 1e3 * 1e3);
		HEAP64[ptime >> 3] = BigInt(nsec);
		return 0;
	}
	_clock_time_get.sig = 'iijp';
	var getHeapMax = () => 2147483648;
	var _emscripten_get_heap_max = () => getHeapMax();
	_emscripten_get_heap_max.sig = 'p';
	var growMemory = (size) => {
		var oldHeapSize = wasmMemory.buffer.byteLength;
		var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
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
		for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
			var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
			overGrownHeapSize = Math.min(
				overGrownHeapSize,
				requestedSize + 100663296
			);
			var newSize = Math.min(
				maxHeapSize,
				alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536)
			);
			var replacement = growMemory(newSize);
			if (replacement) {
				return true;
			}
		}
		return false;
	};
	_emscripten_resize_heap.sig = 'ip';
	var runtimeKeepalivePush = () => {
		runtimeKeepaliveCounter += 1;
	};
	runtimeKeepalivePush.sig = 'v';
	var runtimeKeepalivePop = () => {
		runtimeKeepaliveCounter -= 1;
	};
	runtimeKeepalivePop.sig = 'v';
	var safeSetTimeout = (func, timeout) => {
		runtimeKeepalivePush();
		return setTimeout(() => {
			runtimeKeepalivePop();
			callUserCallback(func);
		}, timeout);
	};
	var _emscripten_sleep = (ms) =>
		Asyncify.handleSleep((wakeUp) => safeSetTimeout(wakeUp, ms));
	_emscripten_sleep.sig = 'vi';
	_emscripten_sleep.isAsync = true;
	var ENV = PHPLoader.ENV || {};
	var getExecutableName = () => thisProgram || './this.program';
	var getEnvStrings = () => {
		if (!getEnvStrings.strings) {
			var lang =
				(
					(typeof navigator == 'object' && navigator.language) ||
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
	var _environ_get = (__environ, environ_buf) => {
		var bufSize = 0;
		var envp = 0;
		for (var string of getEnvStrings()) {
			var ptr = environ_buf + bufSize;
			HEAPU32[(__environ + envp) >> 2] = ptr;
			bufSize += stringToUTF8(string, ptr, Infinity) + 1;
			envp += 4;
		}
		return 0;
	};
	_environ_get.sig = 'ipp';
	var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
		var strings = getEnvStrings();
		HEAPU32[penviron_count >> 2] = strings.length;
		var bufSize = 0;
		for (var string of strings) {
			bufSize += lengthBytesUTF8(string) + 1;
		}
		HEAPU32[penviron_buf_size >> 2] = bufSize;
		return 0;
	};
	_environ_sizes_get.sig = 'ipp';
	function _fd_close(fd) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			FS.close(stream);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_fd_close.sig = 'ii';
	function _fd_fdstat_get(fd, pbuf) {
		try {
			var rightsBase = 0;
			var rightsInheriting = 0;
			var flags = 0;
			{
				var stream = SYSCALLS.getStreamFromFD(fd);
				var type = stream.tty
					? 2
					: FS.isDir(stream.mode)
						? 3
						: FS.isLink(stream.mode)
							? 7
							: 4;
			}
			HEAP8[pbuf] = type;
			HEAP16[(pbuf + 2) >> 1] = flags;
			HEAP64[(pbuf + 8) >> 3] = BigInt(rightsBase);
			HEAP64[(pbuf + 16) >> 3] = BigInt(rightsInheriting);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_fd_fdstat_get.sig = 'iip';
	var doReadv = (stream, iov, iovcnt, offset) => {
		var ret = 0;
		for (var i = 0; i < iovcnt; i++) {
			var ptr = HEAPU32[iov >> 2];
			var len = HEAPU32[(iov + 4) >> 2];
			iov += 8;
			var curr = FS.read(stream, HEAP8, ptr, len, offset);
			if (curr < 0) return -1;
			ret += curr;
			if (curr < len) break;
			if (typeof offset != 'undefined') {
				offset += curr;
			}
		}
		return ret;
	};
	function _fd_read(fd, iov, iovcnt, pnum) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			var num = doReadv(stream, iov, iovcnt);
			HEAPU32[pnum >> 2] = num;
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_fd_read.sig = 'iippp';
	function _fd_seek(fd, offset, whence, newOffset) {
		offset = bigintToI53Checked(offset);
		try {
			if (isNaN(offset)) return 61;
			var stream = SYSCALLS.getStreamFromFD(fd);
			FS.llseek(stream, offset, whence);
			HEAP64[newOffset >> 3] = BigInt(stream.position);
			if (stream.getdents && offset === 0 && whence === 0)
				stream.getdents = null;
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_fd_seek.sig = 'iijip';
	var _fd_sync = function (fd) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			return Asyncify.handleSleep((wakeUp) => {
				var mount = stream.node.mount;
				if (!mount.type.syncfs) {
					wakeUp(0);
					return;
				}
				mount.type.syncfs(mount, false, (err) => {
					wakeUp(err ? 29 : 0);
				});
			});
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	};
	_fd_sync.sig = 'ii';
	_fd_sync.isAsync = true;
	var doWritev = (stream, iov, iovcnt, offset) => {
		var ret = 0;
		for (var i = 0; i < iovcnt; i++) {
			var ptr = HEAPU32[iov >> 2];
			var len = HEAPU32[(iov + 4) >> 2];
			iov += 8;
			var curr = FS.write(stream, HEAP8, ptr, len, offset);
			if (curr < 0) return -1;
			ret += curr;
			if (curr < len) {
				break;
			}
			if (typeof offset != 'undefined') {
				offset += curr;
			}
		}
		return ret;
	};
	function _fd_write(fd, iov, iovcnt, pnum) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			var num = doWritev(stream, iov, iovcnt);
			HEAPU32[pnum >> 2] = num;
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_fd_write.sig = 'iippp';
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
					addr = [0, 0, 0, _htonl(1)];
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
	_getaddrinfo.sig = 'ipppp';
	var _getcontext = () => abort('missing function: ${name}');
	var _getdtablesize = () => abort('missing function: ${name}');
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
	_getnameinfo.sig = 'ipipipii';
	var Protocols = { list: [], map: {} };
	var stringToAscii = (str, buffer) => {
		for (var i = 0; i < str.length; ++i) {
			HEAP8[buffer++] = str.charCodeAt(i);
		}
		HEAP8[buffer] = 0;
	};
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
	_setprotoent.sig = 'vi';
	var _getprotobyname = (name) => {
		name = UTF8ToString(name);
		_setprotoent(true);
		var result = Protocols.map[name];
		return result;
	};
	_getprotobyname.sig = 'pp';
	var _getprotobynumber = (number) => {
		_setprotoent(true);
		var result = Protocols.map[number];
		return result;
	};
	_getprotobynumber.sig = 'pi';
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
		for (var i = 0; i < descriptorsLength; i++) {
			const descriptorPtr = HEAPU32[(descriptorsPtr + i * 4) >> 2];
			std[HEAPU32[descriptorPtr >> 2]] = {
				child: HEAPU32[(descriptorPtr + 4) >> 2],
				parent: HEAPU32[(descriptorPtr + 8) >> 2],
			};
			if (i === 0) {
				HEAPU32[(descriptorPtr + 8) >> 2] =
					std[HEAPU32[descriptorPtr >> 2]].parent;
				HEAPU32[(descriptorPtr + 4) >> 2] =
					std[HEAPU32[descriptorPtr >> 2]].child;
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
				if (typeof FS == 'undefined' || !(e.name === 'ErrnoError'))
					throw e;
				___errno_location(e.code);
				return -1;
			}
			const ProcInfo = { pid: cp.pid, exited: false };
			PHPWASM.processTable[ProcInfo.pid] = ProcInfo;
			const stdinParentFd = std[0]?.parent,
				stdinChildFd = std[0]?.child,
				stdoutChildFd = std[1]?.child,
				stdoutParentFd = std[1]?.parent,
				stderrChildFd = std[2]?.child,
				stderrParentFd = std[2]?.parent;
			const detachPipeDataListeners = [];
			cp.on('exit', function (code) {
				for (const detach of detachPipeDataListeners) {
					detach();
				}
				for (const fd of [stdoutChildFd, stderrChildFd, stdinChildFd]) {
					if (FS.streams[fd] && !FS.isClosed(FS.streams[fd])) {
						FS.close(FS.streams[fd]);
					}
				}
				ProcInfo.exitCode = code;
				ProcInfo.exited = true;
			});
			if (stdoutChildFd) {
				const stdoutStream = SYSCALLS.getStreamFromFD(stdoutChildFd);
				let stdoutAt = 0;
				const onStdoutData = function (data) {
					try {
						stdoutStream.stream_ops.write(
							stdoutStream,
							data,
							0,
							data.length,
							stdoutAt
						);
						stdoutAt += data.length;
					} catch {
						cp.stdout.off('data', onStdoutData);
					}
				};
				cp.stdout.on('data', onStdoutData);
				detachPipeDataListeners.push(() =>
					cp.stdout.off('data', onStdoutData)
				);
			}
			if (stderrChildFd) {
				const stderrStream = SYSCALLS.getStreamFromFD(stderrChildFd);
				let stderrAt = 0;
				const onStderrData = function (data) {
					try {
						stderrStream.stream_ops.write(
							stderrStream,
							data,
							0,
							data.length,
							stderrAt
						);
						stderrAt += data.length;
					} catch {
						cp.stderr.off('data', onStderrData);
					}
				};
				cp.stderr.on('data', onStderrData);
				detachPipeDataListeners.push(() =>
					cp.stderr.off('data', onStderrData)
				);
			}
			try {
				await new Promise((resolve, reject) => {
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
					setTimeout(() => {
						if (resolved) return;
						resolved = true;
						reject(new Error('Process timed out'));
					}, 5e3);
				});
			} catch (e) {
				console.error(e);
				return ProcInfo.pid;
			}
			if (stdinChildFd) {
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
				const CHUNK_SIZE = 1024;
				const iov = _malloc(16);
				const pnum = _malloc(4);
				const buffer = _malloc(CHUNK_SIZE);
				HEAPU32[iov >> 2] = buffer;
				HEAPU32[(iov + 4) >> 2] = CHUNK_SIZE;
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
							} else if (result === 0 && bytesRead === 0) {
								stopPumpingAndCloseStdin();
								break;
							} else if (result === ERRNO_CODES.EAGAIN) {
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
				}
				function stopPumpingAndCloseStdin() {
					clearInterval(interval);
					if (!cp.stdin.closed) {
						cp.stdin.end();
					}
					_wasm_free(buffer);
					_wasm_free(iov);
					_wasm_free(pnum);
				}
				const interval = setInterval(pump, 20);
				pump();
			} else {
				cp.stdin.end();
			}
			return ProcInfo.pid;
		});
	}
	function _js_popen_clear_pid_for_fd(fd) {
		for (const pid in PHPWASM.processTable) {
			if (PHPWASM.processTable[pid].fd === fd) {
				delete PHPWASM.processTable[pid].fd;
				return;
			}
		}
	}
	function _js_popen_get_pid_for_fd(fd) {
		for (const pid in PHPWASM.processTable) {
			if (PHPWASM.processTable[pid].fd === fd) {
				return PHPWASM.processTable[pid].pid;
			}
		}
		return -1;
	}
	function _js_popen_set_pid_for_fd(fd, pid) {
		if (PHPWASM.processTable[pid]) {
			PHPWASM.processTable[pid].fd = fd;
		}
	}
	function _js_process_status(pid, exitCodePtr) {
		if (!PHPWASM.processTable[pid]) {
			return -1;
		}
		if (PHPWASM.processTable[pid].exited) {
			HEAPU32[exitCodePtr >> 2] = PHPWASM.processTable[pid].exitCode;
			return 1;
		}
		return 0;
	}
	function _js_waitpid(pid, exitCodePtr) {
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
	}
	var _makecontext = () => abort('missing function: ${name}');
	function _random_get(buffer, size) {
		try {
			randomFill(HEAPU8.subarray(buffer, buffer + size));
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_random_get.sig = 'ipp';
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
				date.sec = Number(value);
			}
			if ((value = getMatch('M'))) {
				date.min = Number(value);
			}
			if ((value = getMatch('H'))) {
				date.hour = Number(value);
			} else if ((value = getMatch('I'))) {
				var hour = Number(value);
				if ((value = getMatch('p'))) {
					hour += value.toUpperCase()[0] === 'P' ? 12 : 0;
				}
				date.hour = hour;
			}
			if ((value = getMatch('Y'))) {
				date.year = Number(value);
			} else if ((value = getMatch('y'))) {
				var year = Number(value);
				if ((value = getMatch('C'))) {
					year += Number(value) * 100;
				} else {
					year += year < 69 ? 2e3 : 1900;
				}
				date.year = year;
			}
			if ((value = getMatch('m'))) {
				date.month = Number(value) - 1;
			} else if ((value = getMatch('b'))) {
				date.month =
					MONTH_NUMBERS[value.substring(0, 3).toUpperCase()] || 0;
			}
			if ((value = getMatch('d'))) {
				date.day = Number(value);
			} else if ((value = getMatch('j'))) {
				var day = Number(value);
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
					var weekNumber = Number(value);
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
					var weekNumber = Number(value);
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
			return buf + lengthBytesUTF8(matches[0]);
		}
		return 0;
	};
	_strptime.sig = 'pppp';
	var _swapcontext = () => abort('missing function: ${name}');
	function _wasm_close(socketd) {
		return PHPWASM.shutdownSocket(socketd, 2);
	}
	function _wasm_setsockopt(
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
		if (
			level === SOL_SOCKET &&
			(optionName === SO_RCVTIMEO || optionName === SO_SNDTIMEO)
		) {
			const timeoutMs = PHPWASM.parseSocketTimeout(
				optionValuePtr,
				optionLen
			);
			if (timeoutMs === null) {
				return -1;
			}
			const timeouts = PHPWASM.socketTimeouts.get(socketd) || {};
			if (optionName === SO_RCVTIMEO) {
				timeouts.receive = timeoutMs;
			} else {
				timeouts.send = timeoutMs;
			}
			PHPWASM.socketTimeouts.set(socketd, timeouts);
			return 0;
		}
		const isForwardable =
			(level === SOL_SOCKET && optionName === SO_KEEPALIVE) ||
			(level === IPPROTO_TCP && optionName === TCP_NODELAY);
		if (!isForwardable) {
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
	}
	function _wasm_shutdown(socketd, how) {
		return PHPWASM.shutdownSocket(socketd, how);
	}
	var Asyncify = {
		instrumentWasmImports(imports) {
			var importPattern =
				/^(js_open_process|js_fd_read|js_waitpid|js_process_status|js_create_input_device|wasm_setsockopt|wasm_shutdown|wasm_close|wasm_recv|wasm_connect|__syscall_fcntl64|js_flock|js_release_file_locks|js_waitpid|invoke_.*|__asyncjs__.*)$/;
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
		instrumentFunction(original) {
			var wrapper = (...args) => original(...args);
			wrapper.orig = original;
			return wrapper;
		},
		instrumentWasmExports(exports) {
			var exportPattern =
				/^(php_wasm_init|wasm_sleep|wasm_read|emscripten_sleep|wasm_sapi_handle_request|wasm_sapi_request_shutdown|wasm_poll_socket|wrap_select|__wrap_select|select|php_pollfd_for|fflush|wasm_popen|wasm_pclose|__wrap_popen|__wrap_pclose|wasm_read|wasm_php_exec|run_cli|wasm_recv|wasm_connect|__wasm_call_ctors|__errno_location|__funcs_on_exit|main|__main_argc_argv)$/;
			Asyncify.asyncExports = new Set();
			var ret = {};
			for (let [x, original] of Object.entries(exports)) {
				if (typeof original == 'function') {
					let isAsyncifyExport = exportPattern.test(x);
					if (isAsyncifyExport) {
						Asyncify.asyncExports.add(original);
						original = Asyncify.makeAsyncFunction(original);
					}
					var wrapper = Asyncify.instrumentFunction(original);
					ret[x] = wrapper;
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
		handleSleep: (startAsync) =>
			Asyncify.handleAsync(() => new Promise(startAsync)),
		makeAsyncFunction(original) {
			return WebAssembly.promising(original);
		},
	};
	var getCFunc = (ident) => {
		var func = Module['_' + ident];
		return func;
	};
	var writeArrayToMemory = (array, buffer) => {
		HEAP8.set(array, buffer);
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
	var FS_createPath = (...args) => FS.createPath(...args);
	var FS_unlink = (...args) => FS.unlink(...args);
	var FS_createLazyFile = (...args) => FS.createLazyFile(...args);
	var FS_createDevice = (...args) => FS.createDevice(...args);
	registerWasmPlugin();
	FS.createPreloadedFile = FS_createPreloadedFile;
	FS.preloadFile = FS_preloadFile;
	FS.staticInit();
	PHPWASM.init();
	{
		if (Module['preloadPlugins']) preloadPlugins = Module['preloadPlugins'];
		if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];
		if (Module['print']) out = Module['print'];
		if (Module['printErr']) err = Module['printErr'];
		if (Module['dynamicLibraries'])
			dynamicLibraries = Module['dynamicLibraries'];
		if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
		if (Module['arguments']) arguments_ = Module['arguments'];
		if (Module['thisProgram']) thisProgram = Module['thisProgram'];
		if (Module['quit']) quit_ = Module['quit'];
		if (Module['preInit']) {
			if (typeof Module['preInit'] == 'function')
				Module['preInit'] = [Module['preInit']];
			while (Module['preInit'].length > 0) {
				Module['preInit'].shift()();
			}
		}
	}
	Module['wasmExports'] = wasmExports;
	Module['addRunDependency'] = addRunDependency;
	Module['removeRunDependency'] = removeRunDependency;
	Module['ccall'] = ccall;
	Module['FS_preloadFile'] = FS_preloadFile;
	Module['FS_unlink'] = FS_unlink;
	Module['FS_createPath'] = FS_createPath;
	Module['FS_createDevice'] = FS_createDevice;
	Module['FS_createDataFile'] = FS_createDataFile;
	Module['FS_createLazyFile'] = FS_createLazyFile;
	Module['PROXYFS'] = PROXYFS;
	Module['UTF8ToString'] = UTF8ToString;
	Module['lengthBytesUTF8'] = lengthBytesUTF8;
	Module['stringToUTF8'] = stringToUTF8;
	Module['FS'] = FS;
	Module['_exit'] = _exit;
	Module['_emscripten_sleep'] = _emscripten_sleep;
	var ASM_CONSTS = {};
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
				const stream = FS.getStream(socketd);
				if (FS.isSocket(stream?.node.mode)) {
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
						if (
							events & POLLHUP ||
							events & POLLIN ||
							events & POLLOUT ||
							events & POLLERR
						) {
							polls.push(PHPWASM.awaitClose(ws));
							lookingFor.add('POLLHUP');
						}
						if (events & POLLERR || events & POLLNVAL) {
							polls.push(PHPWASM.awaitError(ws));
							lookingFor.add('POLLERR');
						}
					}
				} else if (stream?.stream_ops?.poll) {
					let interrupted = false;
					async function poll() {
						try {
							while (true) {
								var mask = POLLNVAL;
								mask = SYSCALLS.DEFAULT_POLLMASK;
								if (FS.isClosed(stream)) {
									return ERRNO_CODES.EBADF;
								}
								if (stream.stream_ops?.poll) {
									mask = stream.stream_ops.poll(stream, -1);
								}
								mask &= events | POLLERR | POLLHUP;
								if (mask) {
									return mask;
								}
								if (interrupted) {
									return ERRNO_CODES.ETIMEDOUT;
								}
								await new Promise((resolve) =>
									setTimeout(resolve, 10)
								);
							}
						} catch (e) {
							if (
								typeof FS == 'undefined' ||
								!(e.name === 'ErrnoError')
							)
								throw e;
							return -e.errno;
						}
					}
					polls.push([
						poll(),
						() => {
							interrupted = true;
						},
					]);
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
	function js_fd_read(fd, iov, iovcnt, pnum) {
		const returnCallback = (resolver) => new Promise(resolver);
		const pollAsync = arguments[4] === undefined ? true : !!arguments[4];
		if (
			Asyncify?.State?.Normal === undefined ||
			Asyncify?.state === Asyncify?.State?.Normal
		) {
			var stream;
			try {
				stream = SYSCALLS.getStreamFromFD(fd);
				HEAPU32[pnum >> 2] = doReadv(stream, iov, iovcnt);
				return 0;
			} catch (e) {
				if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) {
					throw e;
				}
				if (
					e.errno !== ERRNO_CODES.EWOULDBLOCK &&
					e.errno !== ERRNO_CODES.EAGAIN
				) {
					return e.errno;
				}
				const nonBlocking = stream.flags & PHPWASM.O_NONBLOCK;
				if (nonBlocking) {
					return e.errno;
				}
			}
		}
		if (false === pollAsync) {
			return ERRNO_CODES.EWOULDBLOCK;
		}
		return returnCallback(async (wakeUp) => {
			var retries = 0;
			var interval = 50;
			var timeout = 5e3;
			var maxRetries = timeout / interval;
			while (true) {
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
				if (returnCode === 0) {
					HEAPU32[pnum >> 2] = num;
					return wakeUp(0);
				}
				if (
					++retries > maxRetries ||
					!stream ||
					FS.isClosed(stream) ||
					returnCode !== ERRNO_CODES.EWOULDBLOCK ||
					('pipe' in stream.node && stream.node.pipe.refcnt < 2)
				) {
					HEAPU32[pnum >> 2] = num;
					return wakeUp(returnCode);
				}
				await new Promise((resolve) => setTimeout(resolve, interval));
			}
		});
	}
	js_fd_read.sig = 'iiiii';
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
	var _php_date_get_date_ce,
		_php_date_get_interface_ce,
		_php_date_get_timezone_ce,
		_get_timezone_info,
		_php_info_print_table_header,
		_php_info_print_table_row,
		_php_info_print_table_start,
		_php_info_print_table_end,
		_php_error_docref,
		_ap_php_slprintf,
		_ap_php_snprintf,
		_ap_php_vsnprintf,
		_display_ini_entries,
		__emalloc_24,
		__emalloc_32,
		__emalloc_40,
		__emalloc_56,
		__emalloc_112,
		__emalloc_128,
		__emalloc_320,
		__emalloc_1280,
		__efree_56,
		__emalloc,
		__efree,
		__erealloc,
		__safe_emalloc,
		___zend_malloc,
		__safe_erealloc,
		___zend_realloc,
		__ecalloc,
		__estrdup,
		__estrndup,
		_zend_register_long_constant,
		_zend_register_string_constant,
		_get_active_class_name,
		_get_active_function_name,
		__call_user_function_impl,
		_zend_call_function,
		_zend_call_known_function,
		_zend_call_known_instance_method_with_2_params,
		__is_numeric_string_ex,
		_convert_to_long,
		_zval_get_long_func,
		_convert_to_double,
		__try_convert_to_string,
		_zval_get_double_func,
		_zval_get_string_func,
		_zend_is_true,
		_numeric_compare_function,
		_compare_function,
		_instanceof_function_slow,
		_zend_str_tolower,
		_zend_memnstr_ex,
		_zval_ptr_dtor,
		_zend_spprintf,
		_zend_strpprintf,
		_zend_error,
		_zend_throw_error,
		_zend_argument_count_error,
		_zend_get_parameters_array_ex,
		_zend_wrong_parameters_none_error,
		_zend_wrong_parameters_count_error,
		_zend_wrong_parameter_error,
		_zend_argument_type_error,
		_zend_argument_value_error,
		_zend_argument_error,
		_zend_parse_arg_long_slow,
		_zend_parse_arg_str_slow,
		_zend_parse_arg_str_or_long_slow,
		_zend_release_fcall_info_cache,
		_zend_parse_parameters,
		_zend_parse_method_parameters,
		_object_properties_init,
		_object_init_ex,
		_add_assoc_long_ex,
		_add_assoc_bool_ex,
		_add_assoc_str_ex,
		_add_assoc_string_ex,
		_add_index_string,
		_add_next_index_long,
		_add_next_index_str,
		_add_next_index_string,
		_add_next_index_stringl,
		_zend_register_internal_class_ex,
		_zend_class_implements,
		_zend_fcall_info_init,
		_zend_declare_typed_property,
		_zend_try_assign_typed_ref_bool,
		_zend_try_assign_typed_ref_long,
		_zend_try_assign_typed_ref_str,
		_zend_try_assign_typed_ref_arr,
		_zend_declare_class_constant_ex,
		_zend_update_property,
		_zend_replace_error_handling,
		_zend_restore_error_handling,
		_zend_hash_str_find,
		__zend_hash_init,
		__zend_new_array_0,
		__zend_new_array,
		_zend_hash_update,
		_zend_hash_str_update,
		_zend_hash_next_index_insert,
		_zend_hash_index_update,
		_zend_hash_destroy,
		_zend_array_destroy,
		_zend_hash_copy,
		_zend_hash_index_find,
		_zend_hash_move_forward_ex,
		_zend_hash_get_current_key_type_ex,
		_zend_hash_get_current_data_ex,
		_zend_hash_sort_ex,
		_zend_register_ini_entries_ex,
		_zend_unregister_ini_entries_ex,
		_zend_alter_ini_entry,
		_zend_sort,
		_zend_iterator_init,
		_zend_call_method,
		_zend_create_internal_iterator_zval,
		_zend_throw_exception,
		_zend_throw_exception_ex,
		_zend_strtod,
		_gc_possible_root,
		_zend_get_gc_buffer_create,
		_zend_get_gc_buffer_grow,
		_zend_object_std_init,
		_zend_object_std_dtor,
		_zend_objects_clone_members,
		_zend_std_get_properties,
		_zend_std_compare_objects,
		_zend_objects_store_del,
		_smart_str_erealloc,
		_strtoll,
		_strlen,
		_munmap,
		_abort,
		_free,
		_memcmp,
		_malloc,
		_snprintf,
		_strchr,
		_mmap,
		___errno_location,
		_dlopen,
		_dlsym,
		_dlclose,
		_strcmp,
		_getenv,
		_explicit_bzero,
		___wasm_setjmp,
		___wasm_setjmp_test,
		___wasm_longjmp,
		_atoi,
		_clock_gettime,
		_strrchr,
		_realloc,
		_strcasecmp,
		_memchr,
		_isalnum,
		_strncmp,
		_tolower,
		_strtok_r,
		_unlink,
		_strncasecmp,
		_fileno,
		_fread,
		_fclose,
		_strtoul,
		_strstr,
		_write,
		_close,
		_fseek,
		_fwrite,
		_gettimeofday,
		_stat,
		_fopen,
		_getcwd,
		_open,
		_rename,
		_mkdir,
		_rmdir,
		_opendir,
		_strncpy,
		_siprintf,
		_localtime_r,
		_strtol,
		_pow,
		_strtod,
		_sin,
		_cos,
		_atan2,
		_acos,
		_setlocale,
		_tan,
		_asin,
		_atan,
		_log,
		_fmod,
		_sscanf,
		_wasm_php_exec,
		_strerror_r,
		_php_pollfd_for,
		_htons,
		_ntohs,
		_htonl,
		_strcpy,
		_strcat,
		_tzset,
		_wasm_sleep,
		_isdigit,
		_fflush,
		_expf,
		_qsort,
		_calloc,
		_writev,
		_fgets,
		_initgroups,
		_atol,
		_closedir,
		_readdir,
		_posix_memalign,
		_ftell,
		_wasm_read,
		_feof,
		_strncat,
		___ctype_get_mb_cur_max,
		___wrap_usleep,
		_wasm_popen,
		_wasm_pclose,
		___wrap_select,
		_wasm_set_sapi_name,
		_wasm_set_phpini_path,
		_wasm_add_cli_arg,
		_run_cli,
		_wasm_add_SERVER_entry,
		_wasm_add_ENV_entry,
		_wasm_set_query_string,
		_wasm_set_path_translated,
		_wasm_set_skip_shebang,
		_wasm_set_request_uri,
		_wasm_set_request_method,
		_wasm_set_request_host,
		_wasm_set_content_type,
		_wasm_set_request_body,
		_wasm_set_content_length,
		_wasm_set_cookies,
		_wasm_set_request_port,
		_wasm_sapi_request_shutdown,
		_wasm_sapi_handle_request,
		_php_wasm_init,
		_wasm_free,
		_wasm_trace,
		_getentropy,
		_pthread_cond_signal,
		_pthread_cond_wait,
		_pthread_condattr_destroy,
		_pthread_condattr_init,
		_pthread_condattr_setclock,
		_pthread_mutex_trylock,
		_pthread_mutexattr_destroy,
		_pthread_mutexattr_init,
		_pthread_mutexattr_settype,
		_sched_yield,
		_sqlite3_auto_extension,
		_sqlite3_cancel_auto_extension,
		_pthread_mutex_init,
		_pthread_mutex_destroy,
		_pthread_mutex_lock,
		_pthread_mutex_unlock,
		_rewind,
		_modf,
		_round,
		_pthread_cond_init,
		_pthread_cond_destroy,
		___funcs_on_exit,
		___cxa_atexit,
		_div,
		___dl_seterr,
		__emscripten_find_dylib,
		_pthread_cond_timedwait,
		_mbstowcs,
		_emscripten_builtin_memalign,
		__emscripten_timeout,
		___extenddftf2,
		___letf2,
		_tanhf,
		_wcstombs,
		_emscripten_get_sbrk_ptr,
		___trap,
		___floatunditf,
		__emscripten_stack_restore,
		__emscripten_stack_alloc,
		_emscripten_stack_get_current,
		__ZNSt3__211__call_onceERVmPvPFvS2_E,
		__ZNSt3__218condition_variable10notify_allEv,
		__ZNSt3__25mutex4lockEv,
		__ZNSt3__25mutex6unlockEv,
		___cxa_bad_typeid,
		___cxa_allocate_exception,
		___cxa_throw,
		___cxa_pure_virtual,
		___dynamic_cast,
		__ZNSt20bad_array_new_lengthD1Ev,
		__ZNSt12length_errorD1Ev,
		memory,
		___stack_pointer,
		__indirect_function_table,
		___c_longjmp,
		wasmTable,
		wasmMemory;
	function assignWasmExports(wasmExports) {
		_php_date_get_date_ce = Module['_php_date_get_date_ce'] =
			wasmExports['php_date_get_date_ce'];
		_php_date_get_interface_ce = Module['_php_date_get_interface_ce'] =
			wasmExports['php_date_get_interface_ce'];
		_php_date_get_timezone_ce = Module['_php_date_get_timezone_ce'] =
			wasmExports['php_date_get_timezone_ce'];
		_get_timezone_info = Module['_get_timezone_info'] =
			wasmExports['get_timezone_info'];
		_php_info_print_table_header = Module['_php_info_print_table_header'] =
			wasmExports['php_info_print_table_header'];
		_php_info_print_table_row = Module['_php_info_print_table_row'] =
			wasmExports['php_info_print_table_row'];
		_php_info_print_table_start = Module['_php_info_print_table_start'] =
			wasmExports['php_info_print_table_start'];
		_php_info_print_table_end = Module['_php_info_print_table_end'] =
			wasmExports['php_info_print_table_end'];
		_php_error_docref = Module['_php_error_docref'] =
			wasmExports['php_error_docref'];
		_ap_php_slprintf = Module['_ap_php_slprintf'] =
			wasmExports['ap_php_slprintf'];
		_ap_php_snprintf = Module['_ap_php_snprintf'] =
			wasmExports['ap_php_snprintf'];
		_ap_php_vsnprintf = Module['_ap_php_vsnprintf'] =
			wasmExports['ap_php_vsnprintf'];
		_display_ini_entries = Module['_display_ini_entries'] =
			wasmExports['display_ini_entries'];
		__emalloc_24 = Module['__emalloc_24'] = wasmExports['_emalloc_24'];
		__emalloc_32 = Module['__emalloc_32'] = wasmExports['_emalloc_32'];
		__emalloc_40 = Module['__emalloc_40'] = wasmExports['_emalloc_40'];
		__emalloc_56 = Module['__emalloc_56'] = wasmExports['_emalloc_56'];
		__emalloc_112 = Module['__emalloc_112'] = wasmExports['_emalloc_112'];
		__emalloc_128 = Module['__emalloc_128'] = wasmExports['_emalloc_128'];
		__emalloc_320 = Module['__emalloc_320'] = wasmExports['_emalloc_320'];
		__emalloc_1280 = Module['__emalloc_1280'] =
			wasmExports['_emalloc_1280'];
		__efree_56 = Module['__efree_56'] = wasmExports['_efree_56'];
		__emalloc = Module['__emalloc'] = wasmExports['_emalloc'];
		__efree = Module['__efree'] = wasmExports['_efree'];
		__erealloc = Module['__erealloc'] = wasmExports['_erealloc'];
		__safe_emalloc = Module['__safe_emalloc'] =
			wasmExports['_safe_emalloc'];
		___zend_malloc = Module['___zend_malloc'] =
			wasmExports['__zend_malloc'];
		__safe_erealloc = Module['__safe_erealloc'] =
			wasmExports['_safe_erealloc'];
		___zend_realloc = Module['___zend_realloc'] =
			wasmExports['__zend_realloc'];
		__ecalloc = Module['__ecalloc'] = wasmExports['_ecalloc'];
		__estrdup = Module['__estrdup'] = wasmExports['_estrdup'];
		__estrndup = Module['__estrndup'] = wasmExports['_estrndup'];
		_zend_register_long_constant = Module['_zend_register_long_constant'] =
			wasmExports['zend_register_long_constant'];
		_zend_register_string_constant = Module[
			'_zend_register_string_constant'
		] = wasmExports['zend_register_string_constant'];
		_get_active_class_name = Module['_get_active_class_name'] =
			wasmExports['get_active_class_name'];
		_get_active_function_name = Module['_get_active_function_name'] =
			wasmExports['get_active_function_name'];
		__call_user_function_impl = Module['__call_user_function_impl'] =
			wasmExports['_call_user_function_impl'];
		_zend_call_function = Module['_zend_call_function'] =
			wasmExports['zend_call_function'];
		_zend_call_known_function = Module['_zend_call_known_function'] =
			wasmExports['zend_call_known_function'];
		_zend_call_known_instance_method_with_2_params = Module[
			'_zend_call_known_instance_method_with_2_params'
		] = wasmExports['zend_call_known_instance_method_with_2_params'];
		__is_numeric_string_ex = Module['__is_numeric_string_ex'] =
			wasmExports['_is_numeric_string_ex'];
		_convert_to_long = Module['_convert_to_long'] =
			wasmExports['convert_to_long'];
		_zval_get_long_func = Module['_zval_get_long_func'] =
			wasmExports['zval_get_long_func'];
		_convert_to_double = Module['_convert_to_double'] =
			wasmExports['convert_to_double'];
		__try_convert_to_string = Module['__try_convert_to_string'] =
			wasmExports['_try_convert_to_string'];
		_zval_get_double_func = Module['_zval_get_double_func'] =
			wasmExports['zval_get_double_func'];
		_zval_get_string_func = Module['_zval_get_string_func'] =
			wasmExports['zval_get_string_func'];
		_zend_is_true = Module['_zend_is_true'] = wasmExports['zend_is_true'];
		_numeric_compare_function = Module['_numeric_compare_function'] =
			wasmExports['numeric_compare_function'];
		_compare_function = Module['_compare_function'] =
			wasmExports['compare_function'];
		_instanceof_function_slow = Module['_instanceof_function_slow'] =
			wasmExports['instanceof_function_slow'];
		_zend_str_tolower = Module['_zend_str_tolower'] =
			wasmExports['zend_str_tolower'];
		_zend_memnstr_ex = Module['_zend_memnstr_ex'] =
			wasmExports['zend_memnstr_ex'];
		_zval_ptr_dtor = Module['_zval_ptr_dtor'] =
			wasmExports['zval_ptr_dtor'];
		_zend_spprintf = Module['_zend_spprintf'] =
			wasmExports['zend_spprintf'];
		_zend_strpprintf = Module['_zend_strpprintf'] =
			wasmExports['zend_strpprintf'];
		_zend_error = Module['_zend_error'] = wasmExports['zend_error'];
		_zend_throw_error = Module['_zend_throw_error'] =
			wasmExports['zend_throw_error'];
		_zend_argument_count_error = Module['_zend_argument_count_error'] =
			wasmExports['zend_argument_count_error'];
		_zend_get_parameters_array_ex = Module[
			'_zend_get_parameters_array_ex'
		] = wasmExports['zend_get_parameters_array_ex'];
		_zend_wrong_parameters_none_error = Module[
			'_zend_wrong_parameters_none_error'
		] = wasmExports['zend_wrong_parameters_none_error'];
		_zend_wrong_parameters_count_error = Module[
			'_zend_wrong_parameters_count_error'
		] = wasmExports['zend_wrong_parameters_count_error'];
		_zend_wrong_parameter_error = Module['_zend_wrong_parameter_error'] =
			wasmExports['zend_wrong_parameter_error'];
		_zend_argument_type_error = Module['_zend_argument_type_error'] =
			wasmExports['zend_argument_type_error'];
		_zend_argument_value_error = Module['_zend_argument_value_error'] =
			wasmExports['zend_argument_value_error'];
		_zend_argument_error = Module['_zend_argument_error'] =
			wasmExports['zend_argument_error'];
		_zend_parse_arg_long_slow = Module['_zend_parse_arg_long_slow'] =
			wasmExports['zend_parse_arg_long_slow'];
		_zend_parse_arg_str_slow = Module['_zend_parse_arg_str_slow'] =
			wasmExports['zend_parse_arg_str_slow'];
		_zend_parse_arg_str_or_long_slow = Module[
			'_zend_parse_arg_str_or_long_slow'
		] = wasmExports['zend_parse_arg_str_or_long_slow'];
		_zend_release_fcall_info_cache = Module[
			'_zend_release_fcall_info_cache'
		] = wasmExports['zend_release_fcall_info_cache'];
		_zend_parse_parameters = Module['_zend_parse_parameters'] =
			wasmExports['zend_parse_parameters'];
		_zend_parse_method_parameters = Module[
			'_zend_parse_method_parameters'
		] = wasmExports['zend_parse_method_parameters'];
		_object_properties_init = Module['_object_properties_init'] =
			wasmExports['object_properties_init'];
		_object_init_ex = Module['_object_init_ex'] =
			wasmExports['object_init_ex'];
		_add_assoc_long_ex = Module['_add_assoc_long_ex'] =
			wasmExports['add_assoc_long_ex'];
		_add_assoc_bool_ex = Module['_add_assoc_bool_ex'] =
			wasmExports['add_assoc_bool_ex'];
		_add_assoc_str_ex = Module['_add_assoc_str_ex'] =
			wasmExports['add_assoc_str_ex'];
		_add_assoc_string_ex = Module['_add_assoc_string_ex'] =
			wasmExports['add_assoc_string_ex'];
		_add_index_string = Module['_add_index_string'] =
			wasmExports['add_index_string'];
		_add_next_index_long = Module['_add_next_index_long'] =
			wasmExports['add_next_index_long'];
		_add_next_index_str = Module['_add_next_index_str'] =
			wasmExports['add_next_index_str'];
		_add_next_index_string = Module['_add_next_index_string'] =
			wasmExports['add_next_index_string'];
		_add_next_index_stringl = Module['_add_next_index_stringl'] =
			wasmExports['add_next_index_stringl'];
		_zend_register_internal_class_ex = Module[
			'_zend_register_internal_class_ex'
		] = wasmExports['zend_register_internal_class_ex'];
		_zend_class_implements = Module['_zend_class_implements'] =
			wasmExports['zend_class_implements'];
		_zend_fcall_info_init = Module['_zend_fcall_info_init'] =
			wasmExports['zend_fcall_info_init'];
		_zend_declare_typed_property = Module['_zend_declare_typed_property'] =
			wasmExports['zend_declare_typed_property'];
		_zend_try_assign_typed_ref_bool = Module[
			'_zend_try_assign_typed_ref_bool'
		] = wasmExports['zend_try_assign_typed_ref_bool'];
		_zend_try_assign_typed_ref_long = Module[
			'_zend_try_assign_typed_ref_long'
		] = wasmExports['zend_try_assign_typed_ref_long'];
		_zend_try_assign_typed_ref_str = Module[
			'_zend_try_assign_typed_ref_str'
		] = wasmExports['zend_try_assign_typed_ref_str'];
		_zend_try_assign_typed_ref_arr = Module[
			'_zend_try_assign_typed_ref_arr'
		] = wasmExports['zend_try_assign_typed_ref_arr'];
		_zend_declare_class_constant_ex = Module[
			'_zend_declare_class_constant_ex'
		] = wasmExports['zend_declare_class_constant_ex'];
		_zend_update_property = Module['_zend_update_property'] =
			wasmExports['zend_update_property'];
		_zend_replace_error_handling = Module['_zend_replace_error_handling'] =
			wasmExports['zend_replace_error_handling'];
		_zend_restore_error_handling = Module['_zend_restore_error_handling'] =
			wasmExports['zend_restore_error_handling'];
		_zend_hash_str_find = Module['_zend_hash_str_find'] =
			wasmExports['zend_hash_str_find'];
		__zend_hash_init = Module['__zend_hash_init'] =
			wasmExports['_zend_hash_init'];
		__zend_new_array_0 = Module['__zend_new_array_0'] =
			wasmExports['_zend_new_array_0'];
		__zend_new_array = Module['__zend_new_array'] =
			wasmExports['_zend_new_array'];
		_zend_hash_update = Module['_zend_hash_update'] =
			wasmExports['zend_hash_update'];
		_zend_hash_str_update = Module['_zend_hash_str_update'] =
			wasmExports['zend_hash_str_update'];
		_zend_hash_next_index_insert = Module['_zend_hash_next_index_insert'] =
			wasmExports['zend_hash_next_index_insert'];
		_zend_hash_index_update = Module['_zend_hash_index_update'] =
			wasmExports['zend_hash_index_update'];
		_zend_hash_destroy = Module['_zend_hash_destroy'] =
			wasmExports['zend_hash_destroy'];
		_zend_array_destroy = Module['_zend_array_destroy'] =
			wasmExports['zend_array_destroy'];
		_zend_hash_copy = Module['_zend_hash_copy'] =
			wasmExports['zend_hash_copy'];
		_zend_hash_index_find = Module['_zend_hash_index_find'] =
			wasmExports['zend_hash_index_find'];
		_zend_hash_move_forward_ex = Module['_zend_hash_move_forward_ex'] =
			wasmExports['zend_hash_move_forward_ex'];
		_zend_hash_get_current_key_type_ex = Module[
			'_zend_hash_get_current_key_type_ex'
		] = wasmExports['zend_hash_get_current_key_type_ex'];
		_zend_hash_get_current_data_ex = Module[
			'_zend_hash_get_current_data_ex'
		] = wasmExports['zend_hash_get_current_data_ex'];
		_zend_hash_sort_ex = Module['_zend_hash_sort_ex'] =
			wasmExports['zend_hash_sort_ex'];
		_zend_register_ini_entries_ex = Module[
			'_zend_register_ini_entries_ex'
		] = wasmExports['zend_register_ini_entries_ex'];
		_zend_unregister_ini_entries_ex = Module[
			'_zend_unregister_ini_entries_ex'
		] = wasmExports['zend_unregister_ini_entries_ex'];
		_zend_alter_ini_entry = Module['_zend_alter_ini_entry'] =
			wasmExports['zend_alter_ini_entry'];
		_zend_sort = Module['_zend_sort'] = wasmExports['zend_sort'];
		_zend_iterator_init = Module['_zend_iterator_init'] =
			wasmExports['zend_iterator_init'];
		_zend_call_method = Module['_zend_call_method'] =
			wasmExports['zend_call_method'];
		_zend_create_internal_iterator_zval = Module[
			'_zend_create_internal_iterator_zval'
		] = wasmExports['zend_create_internal_iterator_zval'];
		_zend_throw_exception = Module['_zend_throw_exception'] =
			wasmExports['zend_throw_exception'];
		_zend_throw_exception_ex = Module['_zend_throw_exception_ex'] =
			wasmExports['zend_throw_exception_ex'];
		_zend_strtod = Module['_zend_strtod'] = wasmExports['zend_strtod'];
		_gc_possible_root = Module['_gc_possible_root'] =
			wasmExports['gc_possible_root'];
		_zend_get_gc_buffer_create = Module['_zend_get_gc_buffer_create'] =
			wasmExports['zend_get_gc_buffer_create'];
		_zend_get_gc_buffer_grow = Module['_zend_get_gc_buffer_grow'] =
			wasmExports['zend_get_gc_buffer_grow'];
		_zend_object_std_init = Module['_zend_object_std_init'] =
			wasmExports['zend_object_std_init'];
		_zend_object_std_dtor = Module['_zend_object_std_dtor'] =
			wasmExports['zend_object_std_dtor'];
		_zend_objects_clone_members = Module['_zend_objects_clone_members'] =
			wasmExports['zend_objects_clone_members'];
		_zend_std_get_properties = Module['_zend_std_get_properties'] =
			wasmExports['zend_std_get_properties'];
		_zend_std_compare_objects = Module['_zend_std_compare_objects'] =
			wasmExports['zend_std_compare_objects'];
		_zend_objects_store_del = Module['_zend_objects_store_del'] =
			wasmExports['zend_objects_store_del'];
		_smart_str_erealloc = Module['_smart_str_erealloc'] =
			wasmExports['smart_str_erealloc'];
		_strtoll = Module['_strtoll'] = wasmExports['strtoll'];
		_strlen = Module['_strlen'] = wasmExports['strlen'];
		_munmap = Module['_munmap'] = wasmExports['munmap'];
		_abort = Module['_abort'] = wasmExports['abort'];
		_free = Module['_free'] = wasmExports['free'];
		_memcmp = Module['_memcmp'] = wasmExports['memcmp'];
		_malloc =
			PHPLoader['malloc'] =
			Module['_malloc'] =
				wasmExports['malloc'];
		_snprintf = Module['_snprintf'] = wasmExports['snprintf'];
		_strchr = Module['_strchr'] = wasmExports['strchr'];
		_mmap = Module['_mmap'] = wasmExports['mmap'];
		___errno_location = Module['___errno_location'] =
			wasmExports['__errno_location'];
		_dlopen = Module['_dlopen'] = wasmExports['dlopen'];
		_dlsym = Module['_dlsym'] = wasmExports['dlsym'];
		_dlclose = Module['_dlclose'] = wasmExports['dlclose'];
		_strcmp = Module['_strcmp'] = wasmExports['strcmp'];
		_getenv = Module['_getenv'] = wasmExports['getenv'];
		_explicit_bzero = Module['_explicit_bzero'] =
			wasmExports['explicit_bzero'];
		___wasm_setjmp = Module['___wasm_setjmp'] =
			wasmExports['__wasm_setjmp'];
		___wasm_setjmp_test = Module['___wasm_setjmp_test'] =
			wasmExports['__wasm_setjmp_test'];
		___wasm_longjmp = Module['___wasm_longjmp'] =
			wasmExports['__wasm_longjmp'];
		_atoi = Module['_atoi'] = wasmExports['atoi'];
		_clock_gettime = Module['_clock_gettime'] =
			wasmExports['clock_gettime'];
		_strrchr = Module['_strrchr'] = wasmExports['strrchr'];
		_realloc = Module['_realloc'] = wasmExports['realloc'];
		_strcasecmp = Module['_strcasecmp'] = wasmExports['strcasecmp'];
		_memchr = Module['_memchr'] = wasmExports['memchr'];
		_isalnum = Module['_isalnum'] = wasmExports['isalnum'];
		_strncmp = Module['_strncmp'] = wasmExports['strncmp'];
		_tolower = Module['_tolower'] = wasmExports['tolower'];
		_strtok_r = Module['_strtok_r'] = wasmExports['strtok_r'];
		_unlink = Module['_unlink'] = wasmExports['unlink'];
		_strncasecmp = Module['_strncasecmp'] = wasmExports['strncasecmp'];
		_fileno = Module['_fileno'] = wasmExports['fileno'];
		_fread = Module['_fread'] = wasmExports['fread'];
		_fclose = Module['_fclose'] = wasmExports['fclose'];
		_strtoul = Module['_strtoul'] = wasmExports['strtoul'];
		_strstr = Module['_strstr'] = wasmExports['strstr'];
		_write = Module['_write'] = wasmExports['write'];
		_close = Module['_close'] = wasmExports['close'];
		_fseek = Module['_fseek'] = wasmExports['fseek'];
		_fwrite = Module['_fwrite'] = wasmExports['fwrite'];
		_gettimeofday = Module['_gettimeofday'] = wasmExports['gettimeofday'];
		_stat = Module['_stat'] = wasmExports['stat'];
		_fopen = Module['_fopen'] = wasmExports['fopen'];
		_getcwd = Module['_getcwd'] = wasmExports['getcwd'];
		_open = Module['_open'] = wasmExports['open'];
		_rename = Module['_rename'] = wasmExports['rename'];
		_mkdir = Module['_mkdir'] = wasmExports['mkdir'];
		_rmdir = Module['_rmdir'] = wasmExports['rmdir'];
		_opendir = Module['_opendir'] = wasmExports['opendir'];
		_strncpy = Module['_strncpy'] = wasmExports['strncpy'];
		_siprintf = Module['_siprintf'] = wasmExports['siprintf'];
		_localtime_r = Module['_localtime_r'] = wasmExports['localtime_r'];
		_strtol = Module['_strtol'] = wasmExports['strtol'];
		_pow = Module['_pow'] = wasmExports['pow'];
		_strtod = Module['_strtod'] = wasmExports['strtod'];
		_sin = Module['_sin'] = wasmExports['sin'];
		_cos = Module['_cos'] = wasmExports['cos'];
		_atan2 = Module['_atan2'] = wasmExports['atan2'];
		_acos = Module['_acos'] = wasmExports['acos'];
		_setlocale = Module['_setlocale'] = wasmExports['setlocale'];
		_tan = Module['_tan'] = wasmExports['tan'];
		_asin = Module['_asin'] = wasmExports['asin'];
		_atan = Module['_atan'] = wasmExports['atan'];
		_log = Module['_log'] = wasmExports['log'];
		_fmod = Module['_fmod'] = wasmExports['fmod'];
		_sscanf = Module['_sscanf'] = wasmExports['sscanf'];
		_wasm_php_exec = Module['_wasm_php_exec'] =
			wasmExports['wasm_php_exec'];
		_strerror_r = Module['_strerror_r'] = wasmExports['strerror_r'];
		_php_pollfd_for = Module['_php_pollfd_for'] =
			wasmExports['php_pollfd_for'];
		_htons = wasmExports['htons'];
		_ntohs = wasmExports['ntohs'];
		_htonl = wasmExports['htonl'];
		_strcpy = Module['_strcpy'] = wasmExports['strcpy'];
		_strcat = Module['_strcat'] = wasmExports['strcat'];
		_tzset = Module['_tzset'] = wasmExports['tzset'];
		_wasm_sleep = Module['_wasm_sleep'] = wasmExports['wasm_sleep'];
		_isdigit = Module['_isdigit'] = wasmExports['isdigit'];
		_fflush = Module['_fflush'] = wasmExports['fflush'];
		_expf = Module['_expf'] = wasmExports['expf'];
		_qsort = Module['_qsort'] = wasmExports['qsort'];
		_calloc = wasmExports['calloc'];
		_writev = Module['_writev'] = wasmExports['writev'];
		_fgets = Module['_fgets'] = wasmExports['fgets'];
		_initgroups = Module['_initgroups'] = wasmExports['initgroups'];
		_atol = Module['_atol'] = wasmExports['atol'];
		_closedir = Module['_closedir'] = wasmExports['closedir'];
		_readdir = Module['_readdir'] = wasmExports['readdir'];
		_posix_memalign = Module['_posix_memalign'] =
			wasmExports['posix_memalign'];
		_ftell = Module['_ftell'] = wasmExports['ftell'];
		_wasm_read = Module['_wasm_read'] = wasmExports['wasm_read'];
		_feof = Module['_feof'] = wasmExports['feof'];
		_strncat = Module['_strncat'] = wasmExports['strncat'];
		___ctype_get_mb_cur_max = Module['___ctype_get_mb_cur_max'] =
			wasmExports['__ctype_get_mb_cur_max'];
		___wrap_usleep = Module['___wrap_usleep'] =
			wasmExports['__wrap_usleep'];
		_wasm_popen = Module['_wasm_popen'] = wasmExports['wasm_popen'];
		_wasm_pclose = Module['_wasm_pclose'] = wasmExports['wasm_pclose'];
		___wrap_select = Module['___wrap_select'] =
			wasmExports['__wrap_select'];
		_wasm_set_sapi_name = Module['_wasm_set_sapi_name'] =
			wasmExports['wasm_set_sapi_name'];
		_wasm_set_phpini_path = Module['_wasm_set_phpini_path'] =
			wasmExports['wasm_set_phpini_path'];
		_wasm_add_cli_arg = Module['_wasm_add_cli_arg'] =
			wasmExports['wasm_add_cli_arg'];
		_run_cli = Module['_run_cli'] = wasmExports['run_cli'];
		_wasm_add_SERVER_entry = Module['_wasm_add_SERVER_entry'] =
			wasmExports['wasm_add_SERVER_entry'];
		_wasm_add_ENV_entry = Module['_wasm_add_ENV_entry'] =
			wasmExports['wasm_add_ENV_entry'];
		_wasm_set_query_string = Module['_wasm_set_query_string'] =
			wasmExports['wasm_set_query_string'];
		_wasm_set_path_translated = Module['_wasm_set_path_translated'] =
			wasmExports['wasm_set_path_translated'];
		_wasm_set_skip_shebang = Module['_wasm_set_skip_shebang'] =
			wasmExports['wasm_set_skip_shebang'];
		_wasm_set_request_uri = Module['_wasm_set_request_uri'] =
			wasmExports['wasm_set_request_uri'];
		_wasm_set_request_method = Module['_wasm_set_request_method'] =
			wasmExports['wasm_set_request_method'];
		_wasm_set_request_host = Module['_wasm_set_request_host'] =
			wasmExports['wasm_set_request_host'];
		_wasm_set_content_type = Module['_wasm_set_content_type'] =
			wasmExports['wasm_set_content_type'];
		_wasm_set_request_body = Module['_wasm_set_request_body'] =
			wasmExports['wasm_set_request_body'];
		_wasm_set_content_length = Module['_wasm_set_content_length'] =
			wasmExports['wasm_set_content_length'];
		_wasm_set_cookies = Module['_wasm_set_cookies'] =
			wasmExports['wasm_set_cookies'];
		_wasm_set_request_port = Module['_wasm_set_request_port'] =
			wasmExports['wasm_set_request_port'];
		_wasm_sapi_request_shutdown = Module['_wasm_sapi_request_shutdown'] =
			wasmExports['wasm_sapi_request_shutdown'];
		_wasm_sapi_handle_request = Module['_wasm_sapi_handle_request'] =
			wasmExports['wasm_sapi_handle_request'];
		_php_wasm_init = Module['_php_wasm_init'] =
			wasmExports['php_wasm_init'];
		_wasm_free =
			PHPLoader['free'] =
			Module['_wasm_free'] =
				wasmExports['wasm_free'];
		_wasm_trace = Module['_wasm_trace'] = wasmExports['wasm_trace'];
		_getentropy = Module['_getentropy'] = wasmExports['getentropy'];
		_pthread_cond_signal = Module['_pthread_cond_signal'] =
			wasmExports['pthread_cond_signal'];
		_pthread_cond_wait = Module['_pthread_cond_wait'] =
			wasmExports['pthread_cond_wait'];
		_pthread_condattr_destroy = Module['_pthread_condattr_destroy'] =
			wasmExports['pthread_condattr_destroy'];
		_pthread_condattr_init = Module['_pthread_condattr_init'] =
			wasmExports['pthread_condattr_init'];
		_pthread_condattr_setclock = Module['_pthread_condattr_setclock'] =
			wasmExports['pthread_condattr_setclock'];
		_pthread_mutex_trylock = Module['_pthread_mutex_trylock'] =
			wasmExports['pthread_mutex_trylock'];
		_pthread_mutexattr_destroy = Module['_pthread_mutexattr_destroy'] =
			wasmExports['pthread_mutexattr_destroy'];
		_pthread_mutexattr_init = Module['_pthread_mutexattr_init'] =
			wasmExports['pthread_mutexattr_init'];
		_pthread_mutexattr_settype = Module['_pthread_mutexattr_settype'] =
			wasmExports['pthread_mutexattr_settype'];
		_sched_yield = Module['_sched_yield'] = wasmExports['sched_yield'];
		_sqlite3_auto_extension = Module['_sqlite3_auto_extension'] =
			wasmExports['sqlite3_auto_extension'];
		_sqlite3_cancel_auto_extension = Module[
			'_sqlite3_cancel_auto_extension'
		] = wasmExports['sqlite3_cancel_auto_extension'];
		_pthread_mutex_init = Module['_pthread_mutex_init'] =
			wasmExports['pthread_mutex_init'];
		_pthread_mutex_destroy = Module['_pthread_mutex_destroy'] =
			wasmExports['pthread_mutex_destroy'];
		_pthread_mutex_lock = Module['_pthread_mutex_lock'] =
			wasmExports['pthread_mutex_lock'];
		_pthread_mutex_unlock = Module['_pthread_mutex_unlock'] =
			wasmExports['pthread_mutex_unlock'];
		_rewind = Module['_rewind'] = wasmExports['rewind'];
		_modf = Module['_modf'] = wasmExports['modf'];
		_round = Module['_round'] = wasmExports['round'];
		_pthread_cond_init = Module['_pthread_cond_init'] =
			wasmExports['pthread_cond_init'];
		_pthread_cond_destroy = Module['_pthread_cond_destroy'] =
			wasmExports['pthread_cond_destroy'];
		___funcs_on_exit = wasmExports['__funcs_on_exit'];
		___cxa_atexit = Module['___cxa_atexit'] = wasmExports['__cxa_atexit'];
		_div = Module['_div'] = wasmExports['div'];
		___dl_seterr = wasmExports['__dl_seterr'];
		__emscripten_find_dylib = wasmExports['_emscripten_find_dylib'];
		_pthread_cond_timedwait = Module['_pthread_cond_timedwait'] =
			wasmExports['pthread_cond_timedwait'];
		_mbstowcs = Module['_mbstowcs'] = wasmExports['mbstowcs'];
		_emscripten_builtin_memalign =
			wasmExports['emscripten_builtin_memalign'];
		__emscripten_timeout = wasmExports['_emscripten_timeout'];
		___extenddftf2 = Module['___extenddftf2'] =
			wasmExports['__extenddftf2'];
		___letf2 = Module['___letf2'] = wasmExports['__letf2'];
		_tanhf = Module['_tanhf'] = wasmExports['tanhf'];
		_wcstombs = Module['_wcstombs'] = wasmExports['wcstombs'];
		_emscripten_get_sbrk_ptr = wasmExports['emscripten_get_sbrk_ptr'];
		___trap = wasmExports['__trap'];
		___floatunditf = Module['___floatunditf'] =
			wasmExports['__floatunditf'];
		__emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
		__emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
		_emscripten_stack_get_current =
			wasmExports['emscripten_stack_get_current'];
		__ZNSt3__211__call_onceERVmPvPFvS2_E = Module[
			'__ZNSt3__211__call_onceERVmPvPFvS2_E'
		] = wasmExports['_ZNSt3__211__call_onceERVmPvPFvS2_E'];
		__ZNSt3__218condition_variable10notify_allEv = Module[
			'__ZNSt3__218condition_variable10notify_allEv'
		] = wasmExports['_ZNSt3__218condition_variable10notify_allEv'];
		__ZNSt3__25mutex4lockEv = Module['__ZNSt3__25mutex4lockEv'] =
			wasmExports['_ZNSt3__25mutex4lockEv'];
		__ZNSt3__25mutex6unlockEv = Module['__ZNSt3__25mutex6unlockEv'] =
			wasmExports['_ZNSt3__25mutex6unlockEv'];
		___cxa_bad_typeid = Module['___cxa_bad_typeid'] =
			wasmExports['__cxa_bad_typeid'];
		___cxa_allocate_exception = Module['___cxa_allocate_exception'] =
			wasmExports['__cxa_allocate_exception'];
		___cxa_throw = Module['___cxa_throw'] = wasmExports['__cxa_throw'];
		___cxa_pure_virtual = Module['___cxa_pure_virtual'] =
			wasmExports['__cxa_pure_virtual'];
		___dynamic_cast = Module['___dynamic_cast'] =
			wasmExports['__dynamic_cast'];
		__ZNSt20bad_array_new_lengthD1Ev = Module[
			'__ZNSt20bad_array_new_lengthD1Ev'
		] = wasmExports['_ZNSt20bad_array_new_lengthD1Ev'];
		__ZNSt12length_errorD1Ev = Module['__ZNSt12length_errorD1Ev'] =
			wasmExports['_ZNSt12length_errorD1Ev'];
		memory = wasmMemory = wasmExports['memory'];
		___stack_pointer = Module['___stack_pointer'] =
			wasmExports['__stack_pointer'];
		__indirect_function_table = wasmTable =
			wasmExports['__indirect_function_table'];
		___c_longjmp = Module['___c_longjmp'] = wasmExports['__c_longjmp'];
	}
	var _date_ce_date = (Module['_date_ce_date'] = 13019568);
	var _date_ce_immutable = (Module['_date_ce_immutable'] = 13019572);
	var _date_ce_interface = (Module['_date_ce_interface'] = 13019576);
	var _date_ce_timezone = (Module['_date_ce_timezone'] = 13019580);
	var _date_ce_interval = (Module['_date_ce_interval'] = 13019584);
	var _date_ce_period = (Module['_date_ce_period'] = 13019588);
	var _date_ce_date_error = (Module['_date_ce_date_error'] = 13019616);
	var _date_ce_date_object_error = (Module['_date_ce_date_object_error'] =
		13019640);
	var _date_ce_date_range_error = (Module['_date_ce_date_range_error'] =
		13019628);
	var _date_ce_date_exception = (Module['_date_ce_date_exception'] =
		13019644);
	var _date_ce_date_invalid_timezone_exception = (Module[
		'_date_ce_date_invalid_timezone_exception'
	] = 13019632);
	var _date_ce_date_invalid_operation_exception = (Module[
		'_date_ce_date_invalid_operation_exception'
	] = 13019624);
	var _date_ce_date_malformed_string_exception = (Module[
		'_date_ce_date_malformed_string_exception'
	] = 13019620);
	var _date_ce_date_malformed_interval_string_exception = (Module[
		'_date_ce_date_malformed_interval_string_exception'
	] = 13019636);
	var _date_ce_date_malformed_period_string_exception = (Module[
		'_date_ce_date_malformed_period_string_exception'
	] = 13019648);
	var _php_date_global_timezone_db_enabled = (Module[
		'_php_date_global_timezone_db_enabled'
	] = 13019612);
	var _php_date_global_timezone_db = (Module['_php_date_global_timezone_db'] =
		13019608);
	var _date_globals = (Module['_date_globals'] = 13019592);
	var _date_module_entry = (Module['_date_module_entry'] = 12454036);
	var _timezonedb_builtin = (Module['_timezonedb_builtin'] = 12281808);
	var _timezonedb_idx_builtin = (Module['_timezonedb_idx_builtin'] =
		12277024);
	var _timelib_timezone_db_data_builtin = (Module[
		'_timelib_timezone_db_data_builtin'
	] = 756672);
	var _timelib_error_messages = (Module['_timelib_error_messages'] =
		12281824);
	var _libxml_module_entry = (Module['_libxml_module_entry'] = 12491444);
	var _php_openssl_certificate_ce = (Module['_php_openssl_certificate_ce'] =
		13103428);
	var _php_openssl_request_ce = (Module['_php_openssl_request_ce'] =
		13103532);
	var _php_openssl_pkey_ce = (Module['_php_openssl_pkey_ce'] = 13103636);
	var _openssl_globals = (Module['_openssl_globals'] = 13103416);
	var _openssl_module_entry = (Module['_openssl_module_entry'] = 12493044);
	var _php_openssl_socket_ops = (Module['_php_openssl_socket_ops'] =
		12491680);
	var __pcre2_default_tables_8 = (Module['__pcre2_default_tables_8'] =
		1124352);
	var __pcre2_default_compile_context_8 = (Module[
		'__pcre2_default_compile_context_8'
	] = 12462120);
	var __pcre2_default_match_context_8 = (Module[
		'__pcre2_default_match_context_8'
	] = 12462160);
	var __pcre2_default_convert_context_8 = (Module[
		'__pcre2_default_convert_context_8'
	] = 12462204);
	var __pcre2_OP_lengths_8 = (Module['__pcre2_OP_lengths_8'] = 1125440);
	var __pcre2_hspace_list_8 = (Module['__pcre2_hspace_list_8'] = 1125616);
	var __pcre2_vspace_list_8 = (Module['__pcre2_vspace_list_8'] = 1125696);
	var __pcre2_callout_start_delims_8 = (Module[
		'__pcre2_callout_start_delims_8'
	] = 1125728);
	var __pcre2_callout_end_delims_8 = (Module['__pcre2_callout_end_delims_8'] =
		1125776);
	var __pcre2_utf8_table1 = (Module['__pcre2_utf8_table1'] = 1125824);
	var __pcre2_utf8_table1_size = (Module['__pcre2_utf8_table1_size'] =
		1125848);
	var __pcre2_utf8_table2 = (Module['__pcre2_utf8_table2'] = 1125856);
	var __pcre2_utf8_table3 = (Module['__pcre2_utf8_table3'] = 1125888);
	var __pcre2_utf8_table4 = (Module['__pcre2_utf8_table4'] = 1125920);
	var __pcre2_ucp_gentype_8 = (Module['__pcre2_ucp_gentype_8'] = 1125984);
	var __pcre2_ucp_gbtable_8 = (Module['__pcre2_ucp_gbtable_8'] = 1126112);
	var __pcre2_utt_names_8 = (Module['__pcre2_utt_names_8'] = 1126176);
	var __pcre2_utt_8 = (Module['__pcre2_utt_8'] = 1129760);
	var __pcre2_utt_size_8 = (Module['__pcre2_utt_size_8'] = 1132676);
	var __pcre2_unicode_version_8 = (Module['__pcre2_unicode_version_8'] =
		12462224);
	var __pcre2_ucd_caseless_sets_8 = (Module['__pcre2_ucd_caseless_sets_8'] =
		1132688);
	var __pcre2_ucd_digit_sets_8 = (Module['__pcre2_ucd_digit_sets_8'] =
		1133136);
	var __pcre2_ucd_script_sets_8 = (Module['__pcre2_ucd_script_sets_8'] =
		1133408);
	var __pcre2_ucd_boolprop_sets_8 = (Module['__pcre2_ucd_boolprop_sets_8'] =
		1134176);
	var __pcre2_ucd_records_8 = (Module['__pcre2_ucd_records_8'] = 1135600);
	var __pcre2_ucd_stage1_8 = (Module['__pcre2_ucd_stage1_8'] = 1152512);
	var __pcre2_ucd_stage2_8 = (Module['__pcre2_ucd_stage2_8'] = 1169920);
	var _pcre_globals = (Module['_pcre_globals'] = 13020944);
	var _php_pcre_version = (Module['_php_pcre_version'] = 13021140);
	var _pcre_module_entry = (Module['_pcre_module_entry'] = 12462736);
	var _sqlite3_globals = (Module['_sqlite3_globals'] = 13107840);
	var _php_sqlite3_exception_ce = (Module['_php_sqlite3_exception_ce'] =
		13107860);
	var _php_sqlite3_stmt_entry = (Module['_php_sqlite3_stmt_entry'] =
		13107848);
	var _php_sqlite3_result_entry = (Module['_php_sqlite3_result_entry'] =
		13107852);
	var _php_sqlite3_sc_entry = (Module['_php_sqlite3_sc_entry'] = 13107856);
	var _sqlite3_module_entry = (Module['_sqlite3_module_entry'] = 12497328);
	var _zlib_globals = (Module['_zlib_globals'] = 13108168);
	var _inflate_context_ce = (Module['_inflate_context_ce'] = 13108208);
	var _deflate_context_ce = (Module['_deflate_context_ce'] = 13108212);
	var _php_zlib_module_entry = (Module['_php_zlib_module_entry'] = 12500332);
	var _php_stream_gzio_ops = (Module['_php_stream_gzio_ops'] = 12499580);
	var _php_stream_gzip_wrapper = (Module['_php_stream_gzip_wrapper'] =
		12499660);
	var _php_zlib_filter_factory = (Module['_php_zlib_filter_factory'] =
		12499672);
	var _bcmath_globals = (Module['_bcmath_globals'] = 13108416);
	var _bcmath_module_entry = (Module['_bcmath_module_entry'] = 12501932);
	var _mul_base_digits = (Module['_mul_base_digits'] = 12501696);
	var _calendar_module_entry = (Module['_calendar_module_entry'] = 12503356);
	var _DayNameShort = (Module['_DayNameShort'] = 12502464);
	var _DayNameLong = (Module['_DayNameLong'] = 12502496);
	var _FrenchMonthName = (Module['_FrenchMonthName'] = 12502912);
	var _MonthNameShort = (Module['_MonthNameShort'] = 12502784);
	var _MonthNameLong = (Module['_MonthNameLong'] = 12502848);
	var _monthsPerYear = (Module['_monthsPerYear'] = 1268816);
	var _JewishMonthNameLeap = (Module['_JewishMonthNameLeap'] = 12502528);
	var _JewishMonthName = (Module['_JewishMonthName'] = 12502592);
	var _JewishMonthHebNameLeap = (Module['_JewishMonthHebNameLeap'] =
		12502656);
	var _JewishMonthHebName = (Module['_JewishMonthHebName'] = 12502720);
	var _ctype_module_entry = (Module['_ctype_module_entry'] = 12504416);
	var _curl_ce = (Module['_curl_ce'] = 13108644);
	var _curl_share_ce = (Module['_curl_share_ce'] = 13108748);
	var _curl_module_entry = (Module['_curl_module_entry'] = 12505608);
	var _curl_multi_ce = (Module['_curl_multi_ce'] = 13108432);
	var _curl_CURLFile_class = (Module['_curl_CURLFile_class'] = 13108636);
	var _curl_CURLStringFile_class = (Module['_curl_CURLStringFile_class'] =
		13108640);
	var _dns_polyfill_functions = (Module['_dns_polyfill_functions'] =
		12507296);
	var _dns_polyfill_module_entry = (Module['_dns_polyfill_module_entry'] =
		12507416);
	var _dom_object_handlers = (Module['_dom_object_handlers'] = 13108752);
	var _dom_nnodemap_object_handlers = (Module[
		'_dom_nnodemap_object_handlers'
	] = 13108852);
	var _dom_nodelist_object_handlers = (Module[
		'_dom_nodelist_object_handlers'
	] = 13108952);
	var _dom_object_namespace_node_handlers = (Module[
		'_dom_object_namespace_node_handlers'
	] = 13109052);
	var _dom_domexception_class_entry = (Module[
		'_dom_domexception_class_entry'
	] = 13109208);
	var _dom_parentnode_class_entry = (Module['_dom_parentnode_class_entry'] =
		13109212);
	var _dom_childnode_class_entry = (Module['_dom_childnode_class_entry'] =
		13109216);
	var _dom_domimplementation_class_entry = (Module[
		'_dom_domimplementation_class_entry'
	] = 13109220);
	var _dom_node_class_entry = (Module['_dom_node_class_entry'] = 13109224);
	var _dom_namespace_node_class_entry = (Module[
		'_dom_namespace_node_class_entry'
	] = 13109288);
	var _dom_documentfragment_class_entry = (Module[
		'_dom_documentfragment_class_entry'
	] = 13109352);
	var _dom_document_class_entry = (Module['_dom_document_class_entry'] =
		13109416);
	var _dom_nodelist_class_entry = (Module['_dom_nodelist_class_entry'] =
		13109480);
	var _dom_namednodemap_class_entry = (Module[
		'_dom_namednodemap_class_entry'
	] = 13109544);
	var _dom_characterdata_class_entry = (Module[
		'_dom_characterdata_class_entry'
	] = 13109608);
	var _dom_attr_class_entry = (Module['_dom_attr_class_entry'] = 13109672);
	var _dom_element_class_entry = (Module['_dom_element_class_entry'] =
		13109736);
	var _dom_text_class_entry = (Module['_dom_text_class_entry'] = 13109800);
	var _dom_comment_class_entry = (Module['_dom_comment_class_entry'] =
		13109864);
	var _dom_cdatasection_class_entry = (Module[
		'_dom_cdatasection_class_entry'
	] = 13109868);
	var _dom_documenttype_class_entry = (Module[
		'_dom_documenttype_class_entry'
	] = 13109872);
	var _dom_notation_class_entry = (Module['_dom_notation_class_entry'] =
		13109936);
	var _dom_entity_class_entry = (Module['_dom_entity_class_entry'] = 1311e4);
	var _dom_entityreference_class_entry = (Module[
		'_dom_entityreference_class_entry'
	] = 13110064);
	var _dom_processinginstruction_class_entry = (Module[
		'_dom_processinginstruction_class_entry'
	] = 13110128);
	var _dom_xpath_object_handlers = (Module['_dom_xpath_object_handlers'] =
		13110192);
	var _dom_xpath_class_entry = (Module['_dom_xpath_class_entry'] = 13110292);
	var _dom_module_entry = (Module['_dom_module_entry'] = 12507656);
	var _exif_globals = (Module['_exif_globals'] = 13110352);
	var _exif_module_entry = (Module['_exif_module_entry'] = 12514836);
	var _finfo_class_entry = (Module['_finfo_class_entry'] = 13110872);
	var _fileinfo_module_entry = (Module['_fileinfo_module_entry'] = 12523132);
	var _php_magic_database = (Module['_php_magic_database'] = 1271440);
	var _file_formats = (Module['_file_formats'] = 13110384);
	var _file_names = (Module['_file_names'] = 13110624);
	var _file_nformats = (Module['_file_nformats'] = 1271428);
	var _file_nnames = (Module['_file_nnames'] = 1271432);
	var _accept_ranges = (Module['_accept_ranges'] = 12522096);
	var _filter_globals = (Module['_filter_globals'] = 13110976);
	var _filter_module_entry = (Module['_filter_module_entry'] = 12524032);
	var _gd_image_ce = (Module['_gd_image_ce'] = 13111072);
	var _gd_module_entry = (Module['_gd_module_entry'] = 12526908);
	var _php_hash_hashtable = (Module['_php_hash_hashtable'] = 13111280);
	var _php_hashcontext_ce = (Module['_php_hashcontext_ce'] = 13111336);
	var _hash_module_entry = (Module['_hash_module_entry'] = 12535200);
	var _php_hash_md5_ops = (Module['_php_hash_md5_ops'] = 12532040);
	var _php_hash_md4_ops = (Module['_php_hash_md4_ops'] = 12532088);
	var _php_hash_md2_ops = (Module['_php_hash_md2_ops'] = 12532136);
	var _php_hash_sha1_ops = (Module['_php_hash_sha1_ops'] = 12532184);
	var _php_hash_sha256_ops = (Module['_php_hash_sha256_ops'] = 12532232);
	var _php_hash_sha224_ops = (Module['_php_hash_sha224_ops'] = 12532280);
	var _php_hash_sha384_ops = (Module['_php_hash_sha384_ops'] = 12532328);
	var _php_hash_sha512_ops = (Module['_php_hash_sha512_ops'] = 12532376);
	var _php_hash_sha512_256_ops = (Module['_php_hash_sha512_256_ops'] =
		12532424);
	var _php_hash_sha512_224_ops = (Module['_php_hash_sha512_224_ops'] =
		12532472);
	var _php_hash_ripemd128_ops = (Module['_php_hash_ripemd128_ops'] =
		12532712);
	var _php_hash_ripemd160_ops = (Module['_php_hash_ripemd160_ops'] =
		12532760);
	var _php_hash_ripemd256_ops = (Module['_php_hash_ripemd256_ops'] =
		12532808);
	var _php_hash_ripemd320_ops = (Module['_php_hash_ripemd320_ops'] =
		12532856);
	var _php_hash_3haval128_ops = (Module['_php_hash_3haval128_ops'] =
		12534152);
	var _php_hash_3haval160_ops = (Module['_php_hash_3haval160_ops'] =
		12534200);
	var _php_hash_3haval192_ops = (Module['_php_hash_3haval192_ops'] =
		12534248);
	var _php_hash_3haval224_ops = (Module['_php_hash_3haval224_ops'] =
		12534296);
	var _php_hash_3haval256_ops = (Module['_php_hash_3haval256_ops'] =
		12534344);
	var _php_hash_4haval128_ops = (Module['_php_hash_4haval128_ops'] =
		12534392);
	var _php_hash_4haval160_ops = (Module['_php_hash_4haval160_ops'] =
		12534440);
	var _php_hash_4haval192_ops = (Module['_php_hash_4haval192_ops'] =
		12534488);
	var _php_hash_4haval224_ops = (Module['_php_hash_4haval224_ops'] =
		12534536);
	var _php_hash_4haval256_ops = (Module['_php_hash_4haval256_ops'] =
		12534584);
	var _php_hash_5haval128_ops = (Module['_php_hash_5haval128_ops'] =
		12534632);
	var _php_hash_5haval160_ops = (Module['_php_hash_5haval160_ops'] =
		12534680);
	var _php_hash_5haval192_ops = (Module['_php_hash_5haval192_ops'] =
		12534728);
	var _php_hash_5haval224_ops = (Module['_php_hash_5haval224_ops'] =
		12534776);
	var _php_hash_5haval256_ops = (Module['_php_hash_5haval256_ops'] =
		12534824);
	var _php_hash_3tiger128_ops = (Module['_php_hash_3tiger128_ops'] =
		12532952);
	var _php_hash_3tiger160_ops = (Module['_php_hash_3tiger160_ops'] = 12533e3);
	var _php_hash_3tiger192_ops = (Module['_php_hash_3tiger192_ops'] =
		12533048);
	var _php_hash_4tiger128_ops = (Module['_php_hash_4tiger128_ops'] =
		12533096);
	var _php_hash_4tiger160_ops = (Module['_php_hash_4tiger160_ops'] =
		12533144);
	var _php_hash_4tiger192_ops = (Module['_php_hash_4tiger192_ops'] =
		12533192);
	var _php_hash_gost_ops = (Module['_php_hash_gost_ops'] = 12533288);
	var _php_hash_gost_crypto_ops = (Module['_php_hash_gost_crypto_ops'] =
		12533336);
	var _php_hash_snefru_ops = (Module['_php_hash_snefru_ops'] = 12533240);
	var _php_hash_whirlpool_ops = (Module['_php_hash_whirlpool_ops'] =
		12532904);
	var _php_hash_adler32_ops = (Module['_php_hash_adler32_ops'] = 12533384);
	var _php_hash_crc32_ops = (Module['_php_hash_crc32_ops'] = 12533432);
	var _php_hash_crc32b_ops = (Module['_php_hash_crc32b_ops'] = 12533480);
	var _php_hash_crc32c_ops = (Module['_php_hash_crc32c_ops'] = 12533528);
	var _php_hash_fnv132_ops = (Module['_php_hash_fnv132_ops'] = 12533576);
	var _php_hash_fnv1a32_ops = (Module['_php_hash_fnv1a32_ops'] = 12533624);
	var _php_hash_fnv164_ops = (Module['_php_hash_fnv164_ops'] = 12533672);
	var _php_hash_fnv1a64_ops = (Module['_php_hash_fnv1a64_ops'] = 12533720);
	var _php_hash_joaat_ops = (Module['_php_hash_joaat_ops'] = 12533768);
	var _php_hash_sha3_224_ops = (Module['_php_hash_sha3_224_ops'] = 12532520);
	var _php_hash_sha3_256_ops = (Module['_php_hash_sha3_256_ops'] = 12532568);
	var _php_hash_sha3_384_ops = (Module['_php_hash_sha3_384_ops'] = 12532616);
	var _php_hash_sha3_512_ops = (Module['_php_hash_sha3_512_ops'] = 12532664);
	var _php_hash_murmur3a_ops = (Module['_php_hash_murmur3a_ops'] = 12533816);
	var _php_hash_murmur3c_ops = (Module['_php_hash_murmur3c_ops'] = 12533864);
	var _php_hash_murmur3f_ops = (Module['_php_hash_murmur3f_ops'] = 12533912);
	var _php_hash_xxh32_ops = (Module['_php_hash_xxh32_ops'] = 12533960);
	var _php_hash_xxh64_ops = (Module['_php_hash_xxh64_ops'] = 12534008);
	var _php_hash_xxh3_64_ops = (Module['_php_hash_xxh3_64_ops'] = 12534056);
	var _php_hash_xxh3_128_ops = (Module['_php_hash_xxh3_128_ops'] = 12534104);
	var _iconv_globals = (Module['_iconv_globals'] = 13111456);
	var _iconv_module_entry = (Module['_iconv_module_entry'] = 12536556);
	var _php_json_serializable_ce = (Module['_php_json_serializable_ce'] =
		13111484);
	var _php_json_exception_ce = (Module['_php_json_exception_ce'] = 13111480);
	var _json_globals = (Module['_json_globals'] = 13111468);
	var _json_module_entry = (Module['_json_module_entry'] = 12537608);
	var _mbstring_globals = (Module['_mbstring_globals'] = 13111744);
	var _mb_convert_kana_flags = (Module['_mb_convert_kana_flags'] = 12551344);
	var _mbstring_module_entry = (Module['_mbstring_module_entry'] = 12551156);
	var _php_mb_oniguruma_version = (Module['_php_mb_oniguruma_version'] =
		13111488);
	var _mbfl_html_entity_list = (Module['_mbfl_html_entity_list'] = 12538448);
	var _vtbl_7bit_wchar = (Module['_vtbl_7bit_wchar'] = 12540584);
	var _vtbl_wchar_7bit = (Module['_vtbl_wchar_7bit'] = 12540612);
	var _mbfl_encoding_7bit = (Module['_mbfl_encoding_7bit'] = 12540640);
	var _mbfl_encoding_base64 = (Module['_mbfl_encoding_base64'] = 12538160);
	var _vtbl_8bit_b64 = (Module['_vtbl_8bit_b64'] = 12538204);
	var _vtbl_b64_8bit = (Module['_vtbl_b64_8bit'] = 12538232);
	var _jisx0208_ucs_table = (Module['_jisx0208_ucs_table'] = 9295840);
	var _jisx0212_ucs_table = (Module['_jisx0212_ucs_table'] = 9311472);
	var _ucs_a1_jis_table = (Module['_ucs_a1_jis_table'] = 9325904);
	var _ucs_a2_jis_table = (Module['_ucs_a2_jis_table'] = 9328160);
	var _ucs_i_jis_table = (Module['_ucs_i_jis_table'] = 9336880);
	var _ucs_r_jis_table_min = (Module['_ucs_r_jis_table_min'] = 12544948);
	var _ucs_r_jis_table_max = (Module['_ucs_r_jis_table_max'] = 12544952);
	var _ucs_r_jis_table = (Module['_ucs_r_jis_table'] = 9378880);
	var _cp932ext1_ucs_table = (Module['_cp932ext1_ucs_table'] = 9379344);
	var _cp932ext2_ucs_table = (Module['_cp932ext2_ucs_table'] = 9379552);
	var _cp932ext3_ucs_table = (Module['_cp932ext3_ucs_table'] = 9380320);
	var _uhc1_ucs_table = (Module['_uhc1_ucs_table'] = 9523856);
	var _uhc3_ucs_table = (Module['_uhc3_ucs_table'] = 9550464);
	var _ucs_a1_uhc_table = (Module['_ucs_a1_uhc_table'] = 9560816);
	var _ucs_a2_uhc_table = (Module['_ucs_a2_uhc_table'] = 9563040);
	var _ucs_a3_uhc_table = (Module['_ucs_a3_uhc_table'] = 9566352);
	var _ucs_i_uhc_table = (Module['_ucs_i_uhc_table'] = 9568864);
	var _ucs_s_uhc_table = (Module['_ucs_s_uhc_table'] = 9611184);
	var _ucs_r1_uhc_table = (Module['_ucs_r1_uhc_table'] = 9634048);
	var _ucs_r2_uhc_table = (Module['_ucs_r2_uhc_table'] = 9635104);
	var _cp936_ucs_table = (Module['_cp936_ucs_table'] = 9381104);
	var _ucs_a1_cp936_table = (Module['_ucs_a1_cp936_table'] = 9432368);
	var _ucs_a2_cp936_table = (Module['_ucs_a2_cp936_table'] = 9434592);
	var _ucs_a3_cp936_table = (Module['_ucs_a3_cp936_table'] = 9437808);
	var _ucs_i_cp936_table = (Module['_ucs_i_cp936_table'] = 9439792);
	var _ucs_hff_s_cp936_table = (Module['_ucs_hff_s_cp936_table'] = 9482008);
	var _cp936_pua_tbl1 = (Module['_cp936_pua_tbl1'] = 9429312);
	var _cp936_pua_tbl2 = (Module['_cp936_pua_tbl2'] = 9432170);
	var _ucs_ci_s_cp936_table = (Module['_ucs_ci_s_cp936_table'] = 9481792);
	var _ucs_cf_cp936_table = (Module['_ucs_cf_cp936_table'] = 9481856);
	var _ucs_sfv_cp936_table = (Module['_ucs_sfv_cp936_table'] = 9481936);
	var _cp936_pua_tbl3 = (Module['_cp936_pua_tbl3'] = 9432192);
	var _ucs_i_gb2312_table = (Module['_ucs_i_gb2312_table'] = 9482032);
	var _mbfl_encoding_sjis_sb = (Module['_mbfl_encoding_sjis_sb'] = 12546456);
	var _mbfl_encoding_sjis_docomo = (Module['_mbfl_encoding_sjis_docomo'] =
		12546200);
	var _mbfl_encoding_sjis_kddi = (Module['_mbfl_encoding_sjis_kddi'] =
		12546328);
	var _jisx0208_ucs_table_size = (Module['_jisx0208_ucs_table_size'] =
		9311456);
	var _jisx0212_ucs_table_size = (Module['_jisx0212_ucs_table_size'] =
		9325896);
	var _ucs_a1_jis_table_min = (Module['_ucs_a1_jis_table_min'] = 9328144);
	var _ucs_a1_jis_table_max = (Module['_ucs_a1_jis_table_max'] = 9328148);
	var _ucs_a2_jis_table_min = (Module['_ucs_a2_jis_table_min'] = 9336864);
	var _ucs_a2_jis_table_max = (Module['_ucs_a2_jis_table_max'] = 9336868);
	var _ucs_i_jis_table_min = (Module['_ucs_i_jis_table_min'] = 9378864);
	var _ucs_i_jis_table_max = (Module['_ucs_i_jis_table_max'] = 9378868);
	var _cp932ext1_ucs_table_min = (Module['_cp932ext1_ucs_table_min'] =
		9379532);
	var _cp932ext1_ucs_table_max = (Module['_cp932ext1_ucs_table_max'] =
		9379536);
	var _cp932ext2_ucs_table_min = (Module['_cp932ext2_ucs_table_min'] =
		9380304);
	var _cp932ext2_ucs_table_max = (Module['_cp932ext2_ucs_table_max'] =
		9380308);
	var _cp932ext3_ucs_table_min = (Module['_cp932ext3_ucs_table_min'] =
		9381096);
	var _cp932ext3_ucs_table_max = (Module['_cp932ext3_ucs_table_max'] =
		9381100);
	var _cp936_ucs_table_size = (Module['_cp936_ucs_table_size'] = 9429296);
	var _ucs_a1_cp936_table_min = (Module['_ucs_a1_cp936_table_min'] = 9434580);
	var _ucs_a1_cp936_table_max = (Module['_ucs_a1_cp936_table_max'] = 9434584);
	var _ucs_a2_cp936_table_min = (Module['_ucs_a2_cp936_table_min'] = 9437800);
	var _ucs_a2_cp936_table_max = (Module['_ucs_a2_cp936_table_max'] = 9437804);
	var _ucs_a3_cp936_table_min = (Module['_ucs_a3_cp936_table_min'] = 9439772);
	var _ucs_a3_cp936_table_max = (Module['_ucs_a3_cp936_table_max'] = 9439776);
	var _ucs_i_cp936_table_min = (Module['_ucs_i_cp936_table_min'] = 9481776);
	var _ucs_i_cp936_table_max = (Module['_ucs_i_cp936_table_max'] = 9481780);
	var _ucs_ci_cp936_table_min = (Module['_ucs_ci_cp936_table_min'] = 9481784);
	var _ucs_ci_cp936_table_max = (Module['_ucs_ci_cp936_table_max'] = 9481788);
	var _ucs_cf_cp936_table_min = (Module['_ucs_cf_cp936_table_min'] = 9481920);
	var _ucs_cf_cp936_table_max = (Module['_ucs_cf_cp936_table_max'] = 9481924);
	var _ucs_sfv_cp936_table_min = (Module['_ucs_sfv_cp936_table_min'] =
		9482e3);
	var _ucs_sfv_cp936_table_max = (Module['_ucs_sfv_cp936_table_max'] =
		9482004);
	var _ucs_hff_cp936_table_min = (Module['_ucs_hff_cp936_table_min'] =
		9482020);
	var _ucs_hff_cp936_table_max = (Module['_ucs_hff_cp936_table_max'] =
		9482024);
	var _ucs_i_gb2312_table_min = (Module['_ucs_i_gb2312_table_min'] = 9523840);
	var _ucs_i_gb2312_table_max = (Module['_ucs_i_gb2312_table_max'] = 9523844);
	var _uhc1_ucs_table_size = (Module['_uhc1_ucs_table_size'] = 9550456);
	var _uhc3_ucs_table_size = (Module['_uhc3_ucs_table_size'] = 9560804);
	var _ucs_a1_uhc_table_min = (Module['_ucs_a1_uhc_table_min'] = 9563028);
	var _ucs_a1_uhc_table_max = (Module['_ucs_a1_uhc_table_max'] = 9563032);
	var _ucs_a2_uhc_table_min = (Module['_ucs_a2_uhc_table_min'] = 9566332);
	var _ucs_a2_uhc_table_max = (Module['_ucs_a2_uhc_table_max'] = 9566336);
	var _ucs_a3_uhc_table_min = (Module['_ucs_a3_uhc_table_min'] = 9568844);
	var _ucs_a3_uhc_table_max = (Module['_ucs_a3_uhc_table_max'] = 9568848);
	var _ucs_i_uhc_table_min = (Module['_ucs_i_uhc_table_min'] = 9611164);
	var _ucs_i_uhc_table_max = (Module['_ucs_i_uhc_table_max'] = 9611168);
	var _ucs_s_uhc_table_min = (Module['_ucs_s_uhc_table_min'] = 9634040);
	var _ucs_s_uhc_table_max = (Module['_ucs_s_uhc_table_max'] = 9634044);
	var _ucs_r1_uhc_table_min = (Module['_ucs_r1_uhc_table_min'] = 9635096);
	var _ucs_r1_uhc_table_max = (Module['_ucs_r1_uhc_table_max'] = 9635100);
	var _ucs_r2_uhc_table_min = (Module['_ucs_r2_uhc_table_min'] = 9635568);
	var _ucs_r2_uhc_table_max = (Module['_ucs_r2_uhc_table_max'] = 9635572);
	var _mbfl_encoding_jis = (Module['_mbfl_encoding_jis'] = 12545012);
	var _mbfl_encoding_2022jp = (Module['_mbfl_encoding_2022jp'] = 12545112);
	var _mbfl_encoding_2022jp_kddi = (Module['_mbfl_encoding_2022jp_kddi'] =
		12545220);
	var _mbfl_encoding_2022jp_2004 = (Module['_mbfl_encoding_2022jp_2004'] =
		12545320);
	var _mbfl_encoding_cp50220 = (Module['_mbfl_encoding_cp50220'] = 12545448);
	var _mbfl_encoding_cp50221 = (Module['_mbfl_encoding_cp50221'] = 12545548);
	var _mbfl_encoding_cp50222 = (Module['_mbfl_encoding_cp50222'] = 12545648);
	var _mbfl_encoding_2022jpms = (Module['_mbfl_encoding_2022jpms'] =
		12545756);
	var _mbfl_encoding_2022kr = (Module['_mbfl_encoding_2022kr'] = 12545856);
	var _mbfl_encoding_sjis = (Module['_mbfl_encoding_sjis'] = 12545968);
	var _mbfl_encoding_sjis_mac = (Module['_mbfl_encoding_sjis_mac'] =
		12546080);
	var _mbfl_encoding_sjis2004 = (Module['_mbfl_encoding_sjis2004'] =
		12546568);
	var _mbfl_encoding_cp932 = (Module['_mbfl_encoding_cp932'] = 12546696);
	var _mbfl_encoding_sjiswin = (Module['_mbfl_encoding_sjiswin'] = 12546808);
	var _mbfl_encoding_euc_jp = (Module['_mbfl_encoding_euc_jp'] = 12546940);
	var _mbfl_encoding_eucjp2004 = (Module['_mbfl_encoding_eucjp2004'] =
		12547048);
	var _mbfl_encoding_eucjp_win = (Module['_mbfl_encoding_eucjp_win'] =
		12547160);
	var _mbfl_encoding_cp51932 = (Module['_mbfl_encoding_cp51932'] = 12547268);
	var _mbfl_encoding_euc_cn = (Module['_mbfl_encoding_euc_cn'] = 12547392);
	var _mbfl_encoding_euc_tw = (Module['_mbfl_encoding_euc_tw'] = 12547512);
	var _mbfl_encoding_euc_kr = (Module['_mbfl_encoding_euc_kr'] = 12547640);
	var _mbfl_encoding_uhc = (Module['_mbfl_encoding_uhc'] = 12547748);
	var _mbfl_encoding_gb18030 = (Module['_mbfl_encoding_gb18030'] = 12547860);
	var _mbfl_encoding_cp936 = (Module['_mbfl_encoding_cp936'] = 12547972);
	var _mbfl_encoding_big5 = (Module['_mbfl_encoding_big5'] = 12548088);
	var _mbfl_encoding_cp950 = (Module['_mbfl_encoding_cp950'] = 12548188);
	var _mbfl_encoding_hz = (Module['_mbfl_encoding_hz'] = 12548288);
	var _vtbl_html_wchar = (Module['_vtbl_html_wchar'] = 12540484);
	var _vtbl_wchar_html = (Module['_vtbl_wchar_html'] = 12540512);
	var _mbfl_encoding_html_ent = (Module['_mbfl_encoding_html_ent'] =
		12540540);
	var _mbfl_encoding_qprint = (Module['_mbfl_encoding_qprint'] = 12538340);
	var _vtbl_8bit_qprint = (Module['_vtbl_8bit_qprint'] = 12538384);
	var _vtbl_qprint_8bit = (Module['_vtbl_qprint_8bit'] = 12538412);
	var _mbfl_encoding_ascii = (Module['_mbfl_encoding_ascii'] = 12542408);
	var _mbfl_encoding_8859_1 = (Module['_mbfl_encoding_8859_1'] = 12542520);
	var _mbfl_encoding_8859_2 = (Module['_mbfl_encoding_8859_2'] = 12542632);
	var _mbfl_encoding_8859_3 = (Module['_mbfl_encoding_8859_3'] = 12542744);
	var _mbfl_encoding_8859_4 = (Module['_mbfl_encoding_8859_4'] = 12542856);
	var _mbfl_encoding_8859_5 = (Module['_mbfl_encoding_8859_5'] = 12542968);
	var _mbfl_encoding_8859_6 = (Module['_mbfl_encoding_8859_6'] = 12543080);
	var _mbfl_encoding_8859_7 = (Module['_mbfl_encoding_8859_7'] = 12543192);
	var _mbfl_encoding_8859_8 = (Module['_mbfl_encoding_8859_8'] = 12543304);
	var _mbfl_encoding_8859_9 = (Module['_mbfl_encoding_8859_9'] = 12543416);
	var _mbfl_encoding_8859_10 = (Module['_mbfl_encoding_8859_10'] = 12543528);
	var _mbfl_encoding_8859_13 = (Module['_mbfl_encoding_8859_13'] = 12543636);
	var _mbfl_encoding_8859_14 = (Module['_mbfl_encoding_8859_14'] = 12543748);
	var _mbfl_encoding_8859_15 = (Module['_mbfl_encoding_8859_15'] = 12543856);
	var _mbfl_encoding_8859_16 = (Module['_mbfl_encoding_8859_16'] = 12543964);
	var _mbfl_encoding_cp1251 = (Module['_mbfl_encoding_cp1251'] = 12544088);
	var _mbfl_encoding_cp1252 = (Module['_mbfl_encoding_cp1252'] = 12544196);
	var _mbfl_encoding_cp1254 = (Module['_mbfl_encoding_cp1254'] = 12544312);
	var _mbfl_encoding_cp866 = (Module['_mbfl_encoding_cp866'] = 12544440);
	var _mbfl_encoding_cp850 = (Module['_mbfl_encoding_cp850'] = 12544568);
	var _mbfl_encoding_koi8r = (Module['_mbfl_encoding_koi8r'] = 12544676);
	var _mbfl_encoding_koi8u = (Module['_mbfl_encoding_koi8u'] = 12544784);
	var _mbfl_encoding_armscii8 = (Module['_mbfl_encoding_armscii8'] =
		12544904);
	var _vtbl_ucs2_wchar = (Module['_vtbl_ucs2_wchar'] = 12541040);
	var _vtbl_wchar_ucs2 = (Module['_vtbl_wchar_ucs2'] = 12541068);
	var _mbfl_encoding_ucs2 = (Module['_mbfl_encoding_ucs2'] = 12541096);
	var _vtbl_ucs2be_wchar = (Module['_vtbl_ucs2be_wchar'] = 12541148);
	var _vtbl_wchar_ucs2be = (Module['_vtbl_wchar_ucs2be'] = 12541176);
	var _mbfl_encoding_ucs2be = (Module['_mbfl_encoding_ucs2be'] = 12541204);
	var _vtbl_ucs2le_wchar = (Module['_vtbl_ucs2le_wchar'] = 12541256);
	var _vtbl_wchar_ucs2le = (Module['_vtbl_wchar_ucs2le'] = 12541284);
	var _mbfl_encoding_ucs2le = (Module['_mbfl_encoding_ucs2le'] = 12541312);
	var _vtbl_ucs4_wchar = (Module['_vtbl_ucs4_wchar'] = 12540696);
	var _vtbl_wchar_ucs4 = (Module['_vtbl_wchar_ucs4'] = 12540724);
	var _mbfl_encoding_ucs4 = (Module['_mbfl_encoding_ucs4'] = 12540752);
	var _vtbl_ucs4be_wchar = (Module['_vtbl_ucs4be_wchar'] = 12540804);
	var _vtbl_wchar_ucs4be = (Module['_vtbl_wchar_ucs4be'] = 12540832);
	var _mbfl_encoding_ucs4be = (Module['_mbfl_encoding_ucs4be'] = 12540860);
	var _vtbl_ucs4le_wchar = (Module['_vtbl_ucs4le_wchar'] = 12540912);
	var _vtbl_wchar_ucs4le = (Module['_vtbl_wchar_ucs4le'] = 12540940);
	var _mbfl_encoding_ucs4le = (Module['_mbfl_encoding_ucs4le'] = 12540968);
	var _vtbl_utf16_wchar = (Module['_vtbl_utf16_wchar'] = 12541672);
	var _vtbl_wchar_utf16 = (Module['_vtbl_wchar_utf16'] = 12541700);
	var _mbfl_encoding_utf16 = (Module['_mbfl_encoding_utf16'] = 12541728);
	var _vtbl_utf16be_wchar = (Module['_vtbl_utf16be_wchar'] = 12541772);
	var _vtbl_wchar_utf16be = (Module['_vtbl_wchar_utf16be'] = 12541800);
	var _mbfl_encoding_utf16be = (Module['_mbfl_encoding_utf16be'] = 12541828);
	var _vtbl_utf16le_wchar = (Module['_vtbl_utf16le_wchar'] = 12541872);
	var _vtbl_wchar_utf16le = (Module['_vtbl_wchar_utf16le'] = 12541900);
	var _mbfl_encoding_utf16le = (Module['_mbfl_encoding_utf16le'] = 12541928);
	var _vtbl_utf32_wchar = (Module['_vtbl_utf32_wchar'] = 12541364);
	var _vtbl_wchar_utf32 = (Module['_vtbl_wchar_utf32'] = 12541392);
	var _mbfl_encoding_utf32 = (Module['_mbfl_encoding_utf32'] = 12541420);
	var _vtbl_utf32be_wchar = (Module['_vtbl_utf32be_wchar'] = 12541464);
	var _vtbl_wchar_utf32be = (Module['_vtbl_wchar_utf32be'] = 12541492);
	var _mbfl_encoding_utf32be = (Module['_mbfl_encoding_utf32be'] = 12541520);
	var _vtbl_utf32le_wchar = (Module['_vtbl_utf32le_wchar'] = 12541564);
	var _vtbl_wchar_utf32le = (Module['_vtbl_wchar_utf32le'] = 12541592);
	var _mbfl_encoding_utf32le = (Module['_mbfl_encoding_utf32le'] = 12541620);
	var _vtbl_utf7_wchar = (Module['_vtbl_utf7_wchar'] = 12542088);
	var _vtbl_wchar_utf7 = (Module['_vtbl_wchar_utf7'] = 12542116);
	var _mbfl_encoding_utf7 = (Module['_mbfl_encoding_utf7'] = 12542144);
	var _vtbl_utf7imap_wchar = (Module['_vtbl_utf7imap_wchar'] = 12542196);
	var _vtbl_wchar_utf7imap = (Module['_vtbl_wchar_utf7imap'] = 12542224);
	var _mbfl_encoding_utf7imap = (Module['_mbfl_encoding_utf7imap'] =
		12542252);
	var _mblen_table_utf8 = (Module['_mblen_table_utf8'] = 9291120);
	var _vtbl_utf8_wchar = (Module['_vtbl_utf8_wchar'] = 12541980);
	var _vtbl_wchar_utf8 = (Module['_vtbl_wchar_utf8'] = 12542008);
	var _mbfl_encoding_utf8 = (Module['_mbfl_encoding_utf8'] = 12542036);
	var _vtbl_utf8_docomo_wchar = (Module['_vtbl_utf8_docomo_wchar'] =
		12548432);
	var _vtbl_wchar_utf8_docomo = (Module['_vtbl_wchar_utf8_docomo'] =
		12548460);
	var _mbfl_encoding_utf8_docomo = (Module['_mbfl_encoding_utf8_docomo'] =
		12548488);
	var _vtbl_utf8_kddi_a_wchar = (Module['_vtbl_utf8_kddi_a_wchar'] =
		12548532);
	var _vtbl_wchar_utf8_kddi_a = (Module['_vtbl_wchar_utf8_kddi_a'] =
		12548560);
	var _mbfl_encoding_utf8_kddi_a = (Module['_mbfl_encoding_utf8_kddi_a'] =
		12548588);
	var _vtbl_utf8_kddi_b_wchar = (Module['_vtbl_utf8_kddi_b_wchar'] =
		12548656);
	var _vtbl_wchar_utf8_kddi_b = (Module['_vtbl_wchar_utf8_kddi_b'] =
		12548684);
	var _mbfl_encoding_utf8_kddi_b = (Module['_mbfl_encoding_utf8_kddi_b'] =
		12548712);
	var _vtbl_utf8_sb_wchar = (Module['_vtbl_utf8_sb_wchar'] = 12548768);
	var _vtbl_wchar_utf8_sb = (Module['_vtbl_wchar_utf8_sb'] = 12548796);
	var _mbfl_encoding_utf8_sb = (Module['_mbfl_encoding_utf8_sb'] = 12548824);
	var _mbfl_encoding_uuencode = (Module['_mbfl_encoding_uuencode'] =
		12538260);
	var _vtbl_uuencode_8bit = (Module['_vtbl_uuencode_8bit'] = 12538304);
	var _vtbl_8bit_wchar = (Module['_vtbl_8bit_wchar'] = 12538016);
	var _vtbl_wchar_8bit = (Module['_vtbl_wchar_8bit'] = 12538044);
	var _mbfl_encoding_8bit = (Module['_mbfl_encoding_8bit'] = 12538072);
	var _mbfl_encoding_pass = (Module['_mbfl_encoding_pass'] = 12549204);
	var _vtbl_pass = (Module['_vtbl_pass'] = 12549248);
	var _mbfl_encoding_wchar = (Module['_mbfl_encoding_wchar'] = 12538116);
	var _mbfl_language_german = (Module['_mbfl_language_german'] = 12549696);
	var _mbfl_language_english = (Module['_mbfl_language_english'] = 12549660);
	var _mbfl_language_japanese = (Module['_mbfl_language_japanese'] =
		12549548);
	var _mbfl_language_korean = (Module['_mbfl_language_korean'] = 12549576);
	var _mbfl_language_neutral = (Module['_mbfl_language_neutral'] = 12549836);
	var _mbfl_language_russian = (Module['_mbfl_language_russian'] = 12549724);
	var _mbfl_language_uni = (Module['_mbfl_language_uni'] = 12549520);
	var _mbfl_language_simplified_chinese = (Module[
		'_mbfl_language_simplified_chinese'
	] = 12549604);
	var _mbfl_language_traditional_chinese = (Module[
		'_mbfl_language_traditional_chinese'
	] = 12549632);
	var _mbfl_language_armenian = (Module['_mbfl_language_armenian'] =
		12549780);
	var _mbfl_language_turkish = (Module['_mbfl_language_turkish'] = 12549808);
	var _mbfl_language_ukrainian = (Module['_mbfl_language_ukrainian'] =
		12549752);
	var _accel_globals = (Module['_accel_globals'] = 13116456);
	var _accel_shared_globals = (Module['_accel_shared_globals'] = 13116440);
	var _file_cache_only = (Module['_file_cache_only'] = 13116452);
	var _accel_startup_ok = (Module['_accel_startup_ok'] = 13116444);
	var _zps_api_failure_reason = (Module['_zps_api_failure_reason'] =
		13116448);
	var _extension_version_info = (Module['_extension_version_info'] =
		12566536);
	var _zend_extension_entry = (Module['_zend_extension_entry'] = 12566556);
	var _accel_blacklist = (Module['_accel_blacklist'] = 13116412);
	var _lock_file = (Module['_lock_file'] = 12554476);
	var _smm_shared_globals = (Module['_smm_shared_globals'] = 13116e3);
	var _zend_alloc_mmap_handlers = (Module['_zend_alloc_mmap_handlers'] =
		12554464);
	var _opcache_module_entry = (Module['_opcache_module_entry'] = 12566660);
	var _pdo_dbh_ce = (Module['_pdo_dbh_ce'] = 13118648);
	var _pdo_exception_ce = (Module['_pdo_exception_ce'] = 13118652);
	var _pdo_driver_hash = (Module['_pdo_driver_hash'] = 13118656);
	var _pdo_module_entry = (Module['_pdo_module_entry'] = 12586008);
	var _pdo_dbstmt_ce = (Module['_pdo_dbstmt_ce'] = 13118712);
	var _pdo_row_ce = (Module['_pdo_row_ce'] = 13118716);
	var _pdo_dbstmt_object_handlers = (Module['_pdo_dbstmt_object_handlers'] =
		13118344);
	var _pdo_row_object_handlers = (Module['_pdo_row_object_handlers'] =
		13118444);
	var _pdo_sqlite_module_entry = (Module['_pdo_sqlite_module_entry'] =
		12586576);
	var _pdo_sqlite_driver = (Module['_pdo_sqlite_driver'] = 12586192);
	var _sqlite_stmt_methods = (Module['_sqlite_stmt_methods'] = 12586144);
	var _phar_ops = (Module['_phar_ops'] = 12591300);
	var _phar_stream_wops = (Module['_phar_stream_wops'] = 12591336);
	var _php_stream_phar_wrapper = (Module['_php_stream_phar_wrapper'] =
		12591380);
	var _phar_dir_ops = (Module['_phar_dir_ops'] = 12591264);
	var _phar_globals = (Module['_phar_globals'] = 13118824);
	var _cached_phars = (Module['_cached_phars'] = 13119288);
	var _cached_alias = (Module['_cached_alias'] = 13119232);
	var _phar_orig_compile_file = (Module['_phar_orig_compile_file'] =
		13119344);
	var _phar_module_entry = (Module['_phar_module_entry'] = 12591392);
	var _post_message_to_js_functions = (Module[
		'_post_message_to_js_functions'
	] = 12591792);
	var _post_message_to_js_module_entry = (Module[
		'_post_message_to_js_module_entry'
	] = 12591832);
	var _random_ce_Random_BrokenRandomEngineError = (Module[
		'_random_ce_Random_BrokenRandomEngineError'
	] = 13020200);
	var _random_globals = (Module['_random_globals'] = 13020204);
	var _random_ce_Random_Engine = (Module['_random_ce_Random_Engine'] =
		13020224);
	var _random_ce_Random_CryptoSafeEngine = (Module[
		'_random_ce_Random_CryptoSafeEngine'
	] = 13020228);
	var _random_ce_Random_RandomError = (Module[
		'_random_ce_Random_RandomError'
	] = 13020232);
	var _random_ce_Random_RandomException = (Module[
		'_random_ce_Random_RandomException'
	] = 13020236);
	var _random_ce_Random_Engine_Mt19937 = (Module[
		'_random_ce_Random_Engine_Mt19937'
	] = 13020240);
	var _random_ce_Random_Engine_PcgOneseq128XslRr64 = (Module[
		'_random_ce_Random_Engine_PcgOneseq128XslRr64'
	] = 13020344);
	var _random_ce_Random_Engine_Xoshiro256StarStar = (Module[
		'_random_ce_Random_Engine_Xoshiro256StarStar'
	] = 13020448);
	var _random_ce_Random_Engine_Secure = (Module[
		'_random_ce_Random_Engine_Secure'
	] = 13020552);
	var _random_ce_Random_Randomizer = (Module['_random_ce_Random_Randomizer'] =
		13020656);
	var _random_ce_Random_IntervalBoundary = (Module[
		'_random_ce_Random_IntervalBoundary'
	] = 13020760);
	var _random_module_entry = (Module['_random_module_entry'] = 12460568);
	var _php_random_algo_combinedlcg = (Module['_php_random_algo_combinedlcg'] =
		12460228);
	var _php_random_algo_mt19937 = (Module['_php_random_algo_mt19937'] =
		12460200);
	var _php_random_algo_pcgoneseq128xslrr64 = (Module[
		'_php_random_algo_pcgoneseq128xslrr64'
	] = 12460256);
	var _php_random_algo_xoshiro256starstar = (Module[
		'_php_random_algo_xoshiro256starstar'
	] = 12460284);
	var _php_random_algo_secure = (Module['_php_random_algo_secure'] =
		12460312);
	var _php_random_algo_user = (Module['_php_random_algo_user'] = 12460340);
	var _reflection_class_ptr = (Module['_reflection_class_ptr'] = 13119356);
	var _reflection_enum_ptr = (Module['_reflection_enum_ptr'] = 13119352);
	var _reflection_exception_ptr = (Module['_reflection_exception_ptr'] =
		13119360);
	var _reflection_attribute_ptr = (Module['_reflection_attribute_ptr'] =
		13119552);
	var _reflection_parameter_ptr = (Module['_reflection_parameter_ptr'] =
		13119508);
	var _reflection_extension_ptr = (Module['_reflection_extension_ptr'] =
		13119544);
	var _reflection_function_ptr = (Module['_reflection_function_ptr'] =
		13119500);
	var _reflection_method_ptr = (Module['_reflection_method_ptr'] = 13119528);
	var _reflection_union_type_ptr = (Module['_reflection_union_type_ptr'] =
		13119520);
	var _reflection_intersection_type_ptr = (Module[
		'_reflection_intersection_type_ptr'
	] = 13119524);
	var _reflection_named_type_ptr = (Module['_reflection_named_type_ptr'] =
		13119516);
	var _reflection_property_ptr = (Module['_reflection_property_ptr'] =
		13119536);
	var _reflection_class_constant_ptr = (Module[
		'_reflection_class_constant_ptr'
	] = 13119540);
	var _reflection_reference_ptr = (Module['_reflection_reference_ptr'] =
		13119364);
	var _reflection_globals = (Module['_reflection_globals'] = 13119368);
	var _reflection_enum_unit_case_ptr = (Module[
		'_reflection_enum_unit_case_ptr'
	] = 13119556);
	var _reflection_enum_backed_case_ptr = (Module[
		'_reflection_enum_backed_case_ptr'
	] = 13119560);
	var _reflection_ptr = (Module['_reflection_ptr'] = 13119488);
	var _reflector_ptr = (Module['_reflector_ptr'] = 13119492);
	var _reflection_function_abstract_ptr = (Module[
		'_reflection_function_abstract_ptr'
	] = 13119496);
	var _reflection_generator_ptr = (Module['_reflection_generator_ptr'] =
		13119504);
	var _reflection_type_ptr = (Module['_reflection_type_ptr'] = 13119512);
	var _reflection_object_ptr = (Module['_reflection_object_ptr'] = 13119532);
	var _reflection_zend_extension_ptr = (Module[
		'_reflection_zend_extension_ptr'
	] = 13119548);
	var _reflection_fiber_ptr = (Module['_reflection_fiber_ptr'] = 13119564);
	var _reflection_module_entry = (Module['_reflection_module_entry'] =
		12594656);
	var _ps_globals = (Module['_ps_globals'] = 13119568);
	var _php_session_iface_entry = (Module['_php_session_iface_entry'] =
		13119928);
	var _php_session_id_iface_entry = (Module['_php_session_id_iface_entry'] =
		13119932);
	var _php_session_update_timestamp_iface_entry = (Module[
		'_php_session_update_timestamp_iface_entry'
	] = 13119936);
	var _php_session_class_entry = (Module['_php_session_class_entry'] =
		13119940);
	var _session_module_entry = (Module['_session_module_entry'] = 12602432);
	var _ps_mod_files = (Module['_ps_mod_files'] = 12601908);
	var _ps_mod_user = (Module['_ps_mod_user'] = 12601868);
	var _ce_SimpleXMLElement = (Module['_ce_SimpleXMLElement'] = 13119952);
	var _ce_SimpleXMLIterator = (Module['_ce_SimpleXMLIterator'] = 13120056);
	var _simplexml_module_entry = (Module['_simplexml_module_entry'] =
		12605664);
	var _soap_globals = (Module['_soap_globals'] = 13120072);
	var _soap_class_entry = (Module['_soap_class_entry'] = 13120384);
	var _soap_var_class_entry = (Module['_soap_var_class_entry'] = 13120388);
	var _le_url = (Module['_le_url'] = 13120060);
	var _soap_module_entry = (Module['_soap_module_entry'] = 12609164);
	var _defaultEncoding = (Module['_defaultEncoding'] = 12607024);
	var _numDefaultEncodings = (Module['_numDefaultEncodings'] = 12609096);
	var _spl_module_entry = (Module['_spl_module_entry'] = 12580352);
	var _spl_ce_RecursiveIteratorIterator = (Module[
		'_spl_ce_RecursiveIteratorIterator'
	] = 13117120);
	var _spl_ce_RecursiveCachingIterator = (Module[
		'_spl_ce_RecursiveCachingIterator'
	] = 13117168);
	var _spl_ce_RecursiveIterator = (Module['_spl_ce_RecursiveIterator'] =
		13117140);
	var _spl_ce_RecursiveTreeIterator = (Module[
		'_spl_ce_RecursiveTreeIterator'
	] = 13117124);
	var _spl_ce_FilterIterator = (Module['_spl_ce_FilterIterator'] = 13117128);
	var _spl_ce_CallbackFilterIterator = (Module[
		'_spl_ce_CallbackFilterIterator'
	] = 13117132);
	var _spl_ce_RecursiveCallbackFilterIterator = (Module[
		'_spl_ce_RecursiveCallbackFilterIterator'
	] = 13117136);
	var _spl_ce_RecursiveFilterIterator = (Module[
		'_spl_ce_RecursiveFilterIterator'
	] = 13117144);
	var _spl_ce_ParentIterator = (Module['_spl_ce_ParentIterator'] = 13117148);
	var _spl_ce_RegexIterator = (Module['_spl_ce_RegexIterator'] = 13117152);
	var _spl_ce_RecursiveRegexIterator = (Module[
		'_spl_ce_RecursiveRegexIterator'
	] = 13117156);
	var _spl_ce_LimitIterator = (Module['_spl_ce_LimitIterator'] = 13117160);
	var _spl_ce_SeekableIterator = (Module['_spl_ce_SeekableIterator'] =
		13117392);
	var _spl_ce_CachingIterator = (Module['_spl_ce_CachingIterator'] =
		13117164);
	var _spl_ce_IteratorIterator = (Module['_spl_ce_IteratorIterator'] =
		13117172);
	var _spl_ce_NoRewindIterator = (Module['_spl_ce_NoRewindIterator'] =
		13117176);
	var _spl_ce_InfiniteIterator = (Module['_spl_ce_InfiniteIterator'] =
		13117180);
	var _spl_ce_AppendIterator = (Module['_spl_ce_AppendIterator'] = 13117184);
	var _spl_ce_OuterIterator = (Module['_spl_ce_OuterIterator'] = 13117188);
	var _spl_ce_EmptyIterator = (Module['_spl_ce_EmptyIterator'] = 13117396);
	var _spl_ce_ArrayIterator = (Module['_spl_ce_ArrayIterator'] = 13116908);
	var _spl_handler_ArrayObject = (Module['_spl_handler_ArrayObject'] =
		13116916);
	var _spl_handler_ArrayIterator = (Module['_spl_handler_ArrayIterator'] =
		13117016);
	var _spl_ce_ArrayObject = (Module['_spl_ce_ArrayObject'] = 13116912);
	var _spl_ce_RecursiveArrayIterator = (Module[
		'_spl_ce_RecursiveArrayIterator'
	] = 13117116);
	var _spl_ce_SplFileObject = (Module['_spl_ce_SplFileObject'] = 13117400);
	var _spl_ce_SplFileInfo = (Module['_spl_ce_SplFileInfo'] = 13117404);
	var _spl_ce_DirectoryIterator = (Module['_spl_ce_DirectoryIterator'] =
		13117508);
	var _spl_ce_RecursiveDirectoryIterator = (Module[
		'_spl_ce_RecursiveDirectoryIterator'
	] = 13117516);
	var _spl_ce_FilesystemIterator = (Module['_spl_ce_FilesystemIterator'] =
		13117512);
	var _spl_ce_GlobIterator = (Module['_spl_ce_GlobIterator'] = 13117620);
	var _spl_ce_SplTempFileObject = (Module['_spl_ce_SplTempFileObject'] =
		13117624);
	var _spl_ce_LogicException = (Module['_spl_ce_LogicException'] = 13116856);
	var _spl_ce_BadFunctionCallException = (Module[
		'_spl_ce_BadFunctionCallException'
	] = 13116860);
	var _spl_ce_BadMethodCallException = (Module[
		'_spl_ce_BadMethodCallException'
	] = 13116864);
	var _spl_ce_DomainException = (Module['_spl_ce_DomainException'] =
		13116868);
	var _spl_ce_InvalidArgumentException = (Module[
		'_spl_ce_InvalidArgumentException'
	] = 13116872);
	var _spl_ce_LengthException = (Module['_spl_ce_LengthException'] =
		13116876);
	var _spl_ce_OutOfRangeException = (Module['_spl_ce_OutOfRangeException'] =
		13116880);
	var _spl_ce_RuntimeException = (Module['_spl_ce_RuntimeException'] =
		13116884);
	var _spl_ce_OutOfBoundsException = (Module['_spl_ce_OutOfBoundsException'] =
		13116888);
	var _spl_ce_OverflowException = (Module['_spl_ce_OverflowException'] =
		13116892);
	var _spl_ce_RangeException = (Module['_spl_ce_RangeException'] = 13116896);
	var _spl_ce_UnderflowException = (Module['_spl_ce_UnderflowException'] =
		13116900);
	var _spl_ce_UnexpectedValueException = (Module[
		'_spl_ce_UnexpectedValueException'
	] = 13116904);
	var _spl_ce_SplObjectStorage = (Module['_spl_ce_SplObjectStorage'] =
		13117628);
	var _spl_ce_SplObserver = (Module['_spl_ce_SplObserver'] = 13117632);
	var _spl_ce_SplSubject = (Module['_spl_ce_SplSubject'] = 13117636);
	var _spl_handler_SplObjectStorage = (Module[
		'_spl_handler_SplObjectStorage'
	] = 13117640);
	var _spl_ce_MultipleIterator = (Module['_spl_ce_MultipleIterator'] =
		13117840);
	var _spl_ce_SplDoublyLinkedList = (Module['_spl_ce_SplDoublyLinkedList'] =
		13117844);
	var _spl_handler_SplDoublyLinkedList = (Module[
		'_spl_handler_SplDoublyLinkedList'
	] = 13117848);
	var _spl_ce_SplQueue = (Module['_spl_ce_SplQueue'] = 13117948);
	var _spl_ce_SplStack = (Module['_spl_ce_SplStack'] = 13117952);
	var _spl_ce_SplHeap = (Module['_spl_ce_SplHeap'] = 13118060);
	var _spl_ce_SplPriorityQueue = (Module['_spl_ce_SplPriorityQueue'] =
		13118064);
	var _spl_handler_SplHeap = (Module['_spl_handler_SplHeap'] = 13118068);
	var _spl_ce_SplMinHeap = (Module['_spl_ce_SplMinHeap'] = 13118168);
	var _spl_ce_SplMaxHeap = (Module['_spl_ce_SplMaxHeap'] = 13118172);
	var _spl_handler_SplPriorityQueue = (Module[
		'_spl_handler_SplPriorityQueue'
	] = 13118176);
	var _spl_ce_SplFixedArray = (Module['_spl_ce_SplFixedArray'] = 13117956);
	var _spl_handler_SplFixedArray = (Module['_spl_handler_SplFixedArray'] =
		13117960);
	var _array_globals = (Module['_array_globals'] = 13020192);
	var _basic_globals = (Module['_basic_globals'] = 13099304);
	var _basic_functions_module = (Module['_basic_functions_module'] =
		12475500);
	var _browscap_globals = (Module['_browscap_globals'] = 13021144);
	var _dir_globals = (Module['_dir_globals'] = 13099240);
	var _file_globals = (Module['_file_globals'] = 13121880);
	var _php_sig_gif = (Module['_php_sig_gif'] = 1265745);
	var _php_sig_psd = (Module['_php_sig_psd'] = 1265748);
	var _php_sig_bmp = (Module['_php_sig_bmp'] = 1265752);
	var _php_sig_swf = (Module['_php_sig_swf'] = 1265754);
	var _php_sig_swc = (Module['_php_sig_swc'] = 1265757);
	var _php_sig_jpg = (Module['_php_sig_jpg'] = 1265760);
	var _php_sig_png = (Module['_php_sig_png'] = 1265763);
	var _php_sig_tif_ii = (Module['_php_sig_tif_ii'] = 1265771);
	var _php_sig_tif_mm = (Module['_php_sig_tif_mm'] = 1265775);
	var _php_sig_jpc = (Module['_php_sig_jpc'] = 1265779);
	var _php_sig_jp2 = (Module['_php_sig_jp2'] = 1265782);
	var _php_sig_iff = (Module['_php_sig_iff'] = 1265794);
	var _php_sig_ico = (Module['_php_sig_ico'] = 1265798);
	var _php_sig_riff = (Module['_php_sig_riff'] = 1265802);
	var _php_sig_webp = (Module['_php_sig_webp'] = 1265806);
	var _php_tiff_bytes_per_format = (Module['_php_tiff_bytes_per_format'] =
		1265824);
	var _assert_globals = (Module['_assert_globals'] = 13020160);
	var _assertion_error_ce = (Module['_assertion_error_ce'] = 13020184);
	var _php_ce_incomplete_class = (Module['_php_ce_incomplete_class'] =
		13020152);
	var _php_stream_ftp_wrapper = (Module['_php_stream_ftp_wrapper'] =
		12464672);
	var _php_stream_http_wrapper = (Module['_php_stream_http_wrapper'] =
		12464580);
	var _php_stream_output_ops = (Module['_php_stream_output_ops'] = 12464316);
	var _php_stream_input_ops = (Module['_php_stream_input_ops'] = 12464352);
	var _php_stream_php_wrapper = (Module['_php_stream_php_wrapper'] =
		12464432);
	var _php_password_algo_bcrypt = (Module['_php_password_algo_bcrypt'] =
		12463844);
	var _php_token_ce = (Module['_php_token_ce'] = 13120688);
	var _tokenizer_module_entry = (Module['_tokenizer_module_entry'] =
		12611996);
	var _wasm_memory_storage_struct = (Module['_wasm_memory_storage_struct'] =
		12612432);
	var _wasm_memory_storage_module_entry = (Module[
		'_wasm_memory_storage_module_entry'
	] = 12612452);
	var _xml_encodings = (Module['_xml_encodings'] = 12613648);
	var _xml_globals = (Module['_xml_globals'] = 13120692);
	var _xml_module_entry = (Module['_xml_module_entry'] = 12613548);
	var _xmlreader_class_entry = (Module['_xmlreader_class_entry'] = 13120872);
	var _xmlreader_module_entry = (Module['_xmlreader_module_entry'] =
		12614320);
	var _xmlwriter_module_entry = (Module['_xmlwriter_module_entry'] =
		12616428);
	var _zip_module_entry = (Module['_zip_module_entry'] = 12620252);
	var _php_stream_zipio_seek_ops = (Module['_php_stream_zipio_seek_ops'] =
		12619904);
	var _php_stream_zipio_ops = (Module['_php_stream_zipio_ops'] = 12619940);
	var _php_stream_zip_wrapper = (Module['_php_stream_zip_wrapper'] =
		12620020);
	var _core_globals = (Module['_core_globals'] = 13121408);
	var _php_register_internal_extensions_func = (Module[
		'_php_register_internal_extensions_func'
	] = 12624184);
	var _php_internal_encoding_changed = (Module[
		'_php_internal_encoding_changed'
	] = 13121872);
	var _php_ini_opened_path = (Module['_php_ini_opened_path'] = 13019312);
	var _php_ini_scanned_path = (Module['_php_ini_scanned_path'] = 13019316);
	var _php_ini_scanned_files = (Module['_php_ini_scanned_files'] = 13019320);
	var _sapi_module = (Module['_sapi_module'] = 13100520);
	var _sapi_globals = (Module['_sapi_globals'] = 13100664);
	var _php_rfc1867_callback = (Module['_php_rfc1867_callback'] = 13015096);
	var _php_import_environment_variables = (Module[
		'_php_import_environment_variables'
	] = 12275256);
	var _php_load_environment_variables = (Module[
		'_php_load_environment_variables'
	] = 12275260);
	var _output_globals = (Module['_output_globals'] = 13100312);
	var _php_output_default_handler_name = (Module[
		'_php_output_default_handler_name'
	] = 1268256);
	var _php_output_devnull_handler_name = (Module[
		'_php_output_devnull_handler_name'
	] = 1268288);
	var _php_optidx = (Module['_php_optidx'] = 12464684);
	var _php_stream_memory_ops = (Module['_php_stream_memory_ops'] = 12276848);
	var _php_stream_temp_ops = (Module['_php_stream_temp_ops'] = 12276884);
	var _php_stream_rfc2397_ops = (Module['_php_stream_rfc2397_ops'] =
		12276920);
	var _php_stream_rfc2397_wops = (Module['_php_stream_rfc2397_wops'] =
		12276956);
	var _php_stream_rfc2397_wrapper = (Module['_php_stream_rfc2397_wrapper'] =
		12277e3);
	var _php_stream_stdio_ops = (Module['_php_stream_stdio_ops'] = 12627468);
	var _php_plain_files_wrapper = (Module['_php_plain_files_wrapper'] =
		12627456);
	var _php_stream_userspace_ops = (Module['_php_stream_userspace_ops'] =
		12464060);
	var _php_stream_userspace_dir_ops = (Module[
		'_php_stream_userspace_dir_ops'
	] = 12464096);
	var _php_stream_unix_socket_ops = (Module['_php_stream_unix_socket_ops'] =
		12464240);
	var _php_stream_unixdg_socket_ops = (Module[
		'_php_stream_unixdg_socket_ops'
	] = 12464276);
	var _php_stream_udp_socket_ops = (Module['_php_stream_udp_socket_ops'] =
		12464204);
	var _php_stream_socket_ops = (Module['_php_stream_socket_ops'] = 12464168);
	var _php_stream_generic_socket_ops = (Module[
		'_php_stream_generic_socket_ops'
	] = 12464132);
	var _php_glob_stream_ops = (Module['_php_glob_stream_ops'] = 12464444);
	var _php_glob_stream_wrapper = (Module['_php_glob_stream_wrapper'] =
		12464524);
	var _language_scanner_globals = (Module['_language_scanner_globals'] =
		13014920);
	var _ini_scanner_globals = (Module['_ini_scanner_globals'] = 13019248);
	var _compiler_globals = (Module['_compiler_globals'] = 13124704);
	var _executor_globals = (Module['_executor_globals'] = 13125088);
	var _zend_compile_file = (Module['_zend_compile_file'] = 13126392);
	var _zend_compile_string = (Module['_zend_compile_string'] = 13126396);
	var _zend_execute_ex = (Module['_zend_execute_ex'] = 13124592);
	var _zend_execute_internal = (Module['_zend_execute_internal'] = 13124596);
	var _zend_autoload = (Module['_zend_autoload'] = 13124600);
	var _empty_fcall_info = (Module['_empty_fcall_info'] = 10067480);
	var _empty_fcall_info_cache = (Module['_empty_fcall_info_cache'] =
		10067528);
	var _zend_tolower_map = (Module['_zend_tolower_map'] = 10068e3);
	var _zend_toupper_map = (Module['_zend_toupper_map'] = 10068256);
	var _zend_printf_to_smart_string = (Module['_zend_printf_to_smart_string'] =
		13124620);
	var _zend_printf_to_smart_str = (Module['_zend_printf_to_smart_str'] =
		13124624);
	var _zend_write = (Module['_zend_write'] = 13124628);
	var _zend_error_cb = (Module['_zend_error_cb'] = 13124632);
	var _zend_printf = (Module['_zend_printf'] = 13124636);
	var _zend_fopen = (Module['_zend_fopen'] = 13124640);
	var _zend_stream_open_function = (Module['_zend_stream_open_function'] =
		13124644);
	var _zend_ticks_function = (Module['_zend_ticks_function'] = 13124656);
	var _zend_on_timeout = (Module['_zend_on_timeout'] = 13124660);
	var _zend_getenv = (Module['_zend_getenv'] = 13124664);
	var _zend_interrupt_function = (Module['_zend_interrupt_function'] =
		13124672);
	var _zend_resolve_path = (Module['_zend_resolve_path'] = 13124668);
	var _zend_post_startup_cb = (Module['_zend_post_startup_cb'] = 13124612);
	var _zend_uv = (Module['_zend_uv'] = 13124692);
	var _zend_standard_class_def = (Module['_zend_standard_class_def'] =
		13124608);
	var _zend_post_shutdown_cb = (Module['_zend_post_shutdown_cb'] = 13124616);
	var _zend_dtrace_enabled = (Module['_zend_dtrace_enabled'] = 13124693);
	var _module_registry = (Module['_module_registry'] = 13123464);
	var _zend_extensions = (Module['_zend_extensions'] = 13122232);
	var _zend_extension_flags = (Module['_zend_extension_flags'] = 13122224);
	var _zend_op_array_extension_handles = (Module[
		'_zend_op_array_extension_handles'
	] = 13122228);
	var _zend_empty_array = (Module['_zend_empty_array'] = 12644408);
	var _le_index_ptr = (Module['_le_index_ptr'] = 13126456);
	var _zend_builtin_module = (Module['_zend_builtin_module'] = 12593096);
	var _zend_ce_sensitive_parameter_value = (Module[
		'_zend_ce_sensitive_parameter_value'
	] = 13014716);
	var _zend_ce_attribute = (Module['_zend_ce_attribute'] = 13014720);
	var _zend_ce_return_type_will_change_attribute = (Module[
		'_zend_ce_return_type_will_change_attribute'
	] = 13014784);
	var _zend_ce_allow_dynamic_properties = (Module[
		'_zend_ce_allow_dynamic_properties'
	] = 13014788);
	var _zend_ce_sensitive_parameter = (Module['_zend_ce_sensitive_parameter'] =
		13014792);
	var _zend_ce_override = (Module['_zend_ce_override'] = 13014896);
	var _zend_pass_function = (Module['_zend_pass_function'] = 12629496);
	var _zend_touch_vm_stack_data = (Module['_zend_touch_vm_stack_data'] =
		13123540);
	var _zend_multibyte_encoding_utf32be = (Module[
		'_zend_multibyte_encoding_utf32be'
	] = 12276692);
	var _zend_multibyte_encoding_utf32le = (Module[
		'_zend_multibyte_encoding_utf32le'
	] = 12276696);
	var _zend_multibyte_encoding_utf16be = (Module[
		'_zend_multibyte_encoding_utf16be'
	] = 12276700);
	var _zend_multibyte_encoding_utf16le = (Module[
		'_zend_multibyte_encoding_utf16le'
	] = 12276704);
	var _zend_multibyte_encoding_utf8 = (Module[
		'_zend_multibyte_encoding_utf8'
	] = 12276708);
	var _zend_ce_internal_iterator = (Module['_zend_ce_internal_iterator'] =
		13014184);
	var _zend_ce_traversable = (Module['_zend_ce_traversable'] = 13014188);
	var _zend_ce_aggregate = (Module['_zend_ce_aggregate'] = 13014192);
	var _zend_ce_iterator = (Module['_zend_ce_iterator'] = 13014196);
	var _zend_ce_serializable = (Module['_zend_ce_serializable'] = 13014200);
	var _zend_ce_arrayaccess = (Module['_zend_ce_arrayaccess'] = 13014204);
	var _zend_ce_countable = (Module['_zend_ce_countable'] = 13014208);
	var _zend_ce_stringable = (Module['_zend_ce_stringable'] = 13014212);
	var _zend_ce_exception = (Module['_zend_ce_exception'] = 13122608);
	var _zend_ce_error = (Module['_zend_ce_error'] = 13122724);
	var _zend_ce_parse_error = (Module['_zend_ce_parse_error'] = 13122592);
	var _zend_ce_compile_error = (Module['_zend_ce_compile_error'] = 13122596);
	var _zend_throw_exception_hook = (Module['_zend_throw_exception_hook'] =
		13122600);
	var _zend_ce_throwable = (Module['_zend_ce_throwable'] = 13122604);
	var _zend_ce_type_error = (Module['_zend_ce_type_error'] = 13122612);
	var _zend_ce_argument_count_error = (Module[
		'_zend_ce_argument_count_error'
	] = 13122616);
	var _zend_ce_error_exception = (Module['_zend_ce_error_exception'] =
		13122720);
	var _zend_ce_value_error = (Module['_zend_ce_value_error'] = 13122728);
	var _zend_ce_arithmetic_error = (Module['_zend_ce_arithmetic_error'] =
		13122732);
	var _zend_ce_division_by_zero_error = (Module[
		'_zend_ce_division_by_zero_error'
	] = 13122736);
	var _zend_ce_unhandled_match_error = (Module[
		'_zend_ce_unhandled_match_error'
	] = 13122740);
	var _gc_collect_cycles = (Module['_gc_collect_cycles'] = 13014600);
	var _zend_ce_closure = (Module['_zend_ce_closure'] = 13116012);
	var _zend_ce_weakref = (Module['_zend_ce_weakref'] = 13014316);
	var _zend_ce_weakmap = (Module['_zend_ce_weakmap'] = 13014420);
	var _zend_empty_string = (Module['_zend_empty_string'] = 13012656);
	var _zend_known_strings = (Module['_zend_known_strings'] = 13012660);
	var _zend_string_init_interned = (Module['_zend_string_init_interned'] =
		13012724);
	var _zend_new_interned_string = (Module['_zend_new_interned_string'] =
		13012720);
	var _zend_string_init_existing_interned = (Module[
		'_zend_string_init_existing_interned'
	] = 13012728);
	var _zend_one_char_string = (Module['_zend_one_char_string'] = 13012736);
	var _zend_signal_globals = (Module['_zend_signal_globals'] = 13101056);
	var _zend_ce_generator = (Module['_zend_ce_generator'] = 13116116);
	var _zend_ce_ClosedGeneratorException = (Module[
		'_zend_ce_ClosedGeneratorException'
	] = 13116120);
	var _cwd_globals = (Module['_cwd_globals'] = 13015120);
	var _zend_ast_process = (Module['_zend_ast_process'] = 13014712);
	var _std_object_handlers = (Module['_std_object_handlers'] = 12643824);
	var _zend_inheritance_cache_add = (Module['_zend_inheritance_cache_add'] =
		13014904);
	var _zend_inheritance_cache_get = (Module['_zend_inheritance_cache_get'] =
		13014900);
	var ___jit_debug_descriptor = (Module['___jit_debug_descriptor'] =
		13006416);
	var _zend_observers_fcall_list = (Module['_zend_observers_fcall_list'] =
		13122264);
	var _zend_observer_function_declared_callbacks = (Module[
		'_zend_observer_function_declared_callbacks'
	] = 13122292);
	var _zend_observer_class_linked_callbacks = (Module[
		'_zend_observer_class_linked_callbacks'
	] = 13122320);
	var _zend_observer_error_callbacks = (Module[
		'_zend_observer_error_callbacks'
	] = 13122348);
	var _zend_observer_fiber_init = (Module['_zend_observer_fiber_init'] =
		13122376);
	var _zend_observer_fiber_switch = (Module['_zend_observer_fiber_switch'] =
		13122404);
	var _zend_observer_fiber_destroy = (Module['_zend_observer_fiber_destroy'] =
		13122432);
	var _zend_observer_fcall_op_array_extension = (Module[
		'_zend_observer_fcall_op_array_extension'
	] = 13122460);
	var _zend_observer_function_declared_observed = (Module[
		'_zend_observer_function_declared_observed'
	] = 13122468);
	var _zend_observer_class_linked_observed = (Module[
		'_zend_observer_class_linked_observed'
	] = 13122469);
	var _zend_observer_errors_observed = (Module[
		'_zend_observer_errors_observed'
	] = 13122470);
	var _zend_system_id = (Module['_zend_system_id'] = 13122192);
	var _zend_ce_unit_enum = (Module['_zend_ce_unit_enum'] = 13014604);
	var _zend_ce_backed_enum = (Module['_zend_ce_backed_enum'] = 13014608);
	var _zend_enum_object_handlers = (Module['_zend_enum_object_handlers'] =
		13014612);
	var _zend_ce_fiber = (Module['_zend_ce_fiber'] = 13122484);
	var _zend_optimizer_registered_passes = (Module[
		'_zend_optimizer_registered_passes'
	] = 13116280);
	var _zend_func_info_rid = (Module['_zend_func_info_rid'] = 12555920);
	var _php_embed_module = (Module['_php_embed_module'] = 13006180);
	var _HARDCODED_EMBED_INI = (Module['_HARDCODED_EMBED_INI'] = 12272048);
	var ___memory_base = (Module['___memory_base'] = 0);
	var ___table_base = (Module['___table_base'] = 1);
	var _stdout = (Module['_stdout'] = 13005600);
	var __playground_zend_side_module_data_exports = (Module[
		'__playground_zend_side_module_data_exports'
	] = 12645168);
	var __playground_zend_side_module_function_exports = (Module[
		'__playground_zend_side_module_function_exports'
	] = 12645264);
	var _timezone = (Module['_timezone'] = 13455736);
	var _tzname = (Module['_tzname'] = 13455744);
	var ___heap_base = 14517968;
	var __ZNSt3__25ctypeIcE2idE = (Module['__ZNSt3__25ctypeIcE2idE'] =
		13469372);
	var __ZTVN10__cxxabiv120__si_class_type_infoE = (Module[
		'__ZTVN10__cxxabiv120__si_class_type_infoE'
	] = 13005888);
	var __ZTVN10__cxxabiv117__class_type_infoE = (Module[
		'__ZTVN10__cxxabiv117__class_type_infoE'
	] = 13005848);
	var __ZTVN10__cxxabiv121__vmi_class_type_infoE = (Module[
		'__ZTVN10__cxxabiv121__vmi_class_type_infoE'
	] = 13005940);
	var __ZTISt20bad_array_new_length = (Module[
		'__ZTISt20bad_array_new_length'
	] = 13006060);
	var __ZTVSt12length_error = (Module['__ZTVSt12length_error'] = 13006136);
	var __ZTISt12length_error = (Module['__ZTISt12length_error'] = 13006156);
	var wasmImports = {
		__assert_fail: ___assert_fail,
		__asyncjs__js_module_onMessage,
		__asyncjs__js_popen_to_file,
		__asyncjs__wasm_poll_socket,
		__call_sighandler: ___call_sighandler,
		__syscall_accept4: ___syscall_accept4,
		__syscall_bind: ___syscall_bind,
		__syscall_chdir: ___syscall_chdir,
		__syscall_chmod: ___syscall_chmod,
		__syscall_connect: ___syscall_connect,
		__syscall_dup: ___syscall_dup,
		__syscall_dup3: ___syscall_dup3,
		__syscall_faccessat: ___syscall_faccessat,
		__syscall_fchmod: ___syscall_fchmod,
		__syscall_fchown32: ___syscall_fchown32,
		__syscall_fchownat: ___syscall_fchownat,
		__syscall_fcntl64: ___syscall_fcntl64,
		__syscall_fdatasync: ___syscall_fdatasync,
		__syscall_fstat64: ___syscall_fstat64,
		__syscall_ftruncate64: ___syscall_ftruncate64,
		__syscall_getcwd: ___syscall_getcwd,
		__syscall_getdents64: ___syscall_getdents64,
		__syscall_getpeername: ___syscall_getpeername,
		__syscall_getsockname: ___syscall_getsockname,
		__syscall_getsockopt: ___syscall_getsockopt,
		__syscall_ioctl: ___syscall_ioctl,
		__syscall_listen: ___syscall_listen,
		__syscall_lstat64: ___syscall_lstat64,
		__syscall_mkdirat: ___syscall_mkdirat,
		__syscall_newfstatat: ___syscall_newfstatat,
		__syscall_openat: ___syscall_openat,
		__syscall_pipe: ___syscall_pipe,
		__syscall_poll: ___syscall_poll,
		__syscall_readlinkat: ___syscall_readlinkat,
		__syscall_recvfrom: ___syscall_recvfrom,
		__syscall_renameat: ___syscall_renameat,
		__syscall_rmdir: ___syscall_rmdir,
		__syscall_sendto: ___syscall_sendto,
		__syscall_socket: ___syscall_socket,
		__syscall_stat64: ___syscall_stat64,
		__syscall_statfs64: ___syscall_statfs64,
		__syscall_symlinkat: ___syscall_symlinkat,
		__syscall_unlinkat: ___syscall_unlinkat,
		__syscall_utimensat: ___syscall_utimensat,
		_abort_js: __abort_js,
		_dlopen_js: __dlopen_js,
		_dlsym_js: __dlsym_js,
		_emscripten_lookup_name: __emscripten_lookup_name,
		_emscripten_runtime_keepalive_clear:
			__emscripten_runtime_keepalive_clear,
		_gmtime_js: __gmtime_js,
		_localtime_js: __localtime_js,
		_mktime_js: __mktime_js,
		_mmap_js: __mmap_js,
		_munmap_js: __munmap_js,
		_setitimer_js: __setitimer_js,
		_tzset_js: __tzset_js,
		clock_time_get: _clock_time_get,
		emscripten_date_now: _emscripten_date_now,
		emscripten_get_heap_max: _emscripten_get_heap_max,
		emscripten_get_now: _emscripten_get_now,
		emscripten_resize_heap: _emscripten_resize_heap,
		emscripten_sleep: _emscripten_sleep,
		environ_get: _environ_get,
		environ_sizes_get: _environ_sizes_get,
		exit: _exit,
		fd_close: _fd_close,
		fd_fdstat_get: _fd_fdstat_get,
		fd_read: _fd_read,
		fd_seek: _fd_seek,
		fd_sync: _fd_sync,
		fd_write: _fd_write,
		getaddrinfo: _getaddrinfo,
		getcontext: _getcontext,
		getdtablesize: _getdtablesize,
		getnameinfo: _getnameinfo,
		getprotobyname: _getprotobyname,
		getprotobynumber: _getprotobynumber,
		js_fd_read,
		js_open_process: _js_open_process,
		js_popen_clear_pid_for_fd: _js_popen_clear_pid_for_fd,
		js_popen_get_pid_for_fd: _js_popen_get_pid_for_fd,
		js_popen_set_pid_for_fd: _js_popen_set_pid_for_fd,
		js_process_status: _js_process_status,
		js_waitpid: _js_waitpid,
		js_wasm_trace: _js_wasm_trace,
		makecontext: _makecontext,
		proc_exit: _proc_exit,
		random_get: _random_get,
		strptime: _strptime,
		swapcontext: _swapcontext,
		wasm_close: _wasm_close,
		wasm_setsockopt: _wasm_setsockopt,
		wasm_shutdown: _wasm_shutdown,
	};
	async function callMain(args = []) {
		var entryFunction = resolveGlobalSymbol('main').sym;
		if (!entryFunction) return;
		args.unshift(thisProgram);
		var argc = args.length;
		var argv = stackAlloc((argc + 1) * 4);
		var argv_ptr = argv;
		for (var arg of args) {
			HEAPU32[argv_ptr >> 2] = stringToUTF8OnStack(arg);
			argv_ptr += 4;
		}
		HEAPU32[argv_ptr >> 2] = 0;
		try {
			var ret = entryFunction(argc, argv);
			ret = await ret;
			exitJS(ret, true);
			return ret;
		} catch (e) {
			return handleException(e);
		}
	}
	function run(args = arguments_) {
		if (runDependencies > 0) {
			dependenciesFulfilled = run;
			return;
		}
		preRun();
		if (runDependencies > 0) {
			dependenciesFulfilled = run;
			return;
		}
		async function doRun() {
			Module['calledRun'] = true;
			if (ABORT) return;
			initRuntime();
			preMain();
			Module['onRuntimeInitialized']?.();
			var noInitialRun = Module['noInitialRun'] || true;
			if (!noInitialRun) await callMain(args);
			postRun();
		}
		if (Module['setStatus']) {
			Module['setStatus']('Running...');
			setTimeout(() => {
				setTimeout(() => Module['setStatus'](''), 1);
				doRun();
			}, 1);
		} else {
			doRun();
		}
	}
	var wasmExports;
	createWasm();
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

	if (typeof NODEFS === 'object') {
		// We override NODEFS.createNode() to add an `isSharedFS` flag to all NODEFS
		// nodes. This way we can tell whether file-locking is needed and possible
		// for an FS node, even if wrapped with PROXYFS.
		const originalNodeFsCreateNode = NODEFS.createNode;
		NODEFS.createNode = function createNodeWithSharedFlag() {
			const node = originalNodeFsCreateNode.apply(NODEFS, arguments);
			node.isSharedFS = true;
			return node;
		};

		var originalHashAddNode = FS.hashAddNode;
		FS.hashAddNode = function hashAddNodeIfNotSharedFS(node) {
			if (node?.isSharedFS) {
				// Avoid caching shared VFS nodes so multiple instances
				// can access the same underlying filesystem without
				// conflicting caches.
				return;
			}
			return originalHashAddNode.apply(FS, arguments);
		};
	}

	/**
	 * Expose the PHP version so the PHP class can make version-specific
	 * adjustments to `php.ini`.
	 */
	PHPLoader['phpVersion'] = (() => {
		const [major, minor, patch] = phpVersionString.split('.').map(Number);
		return { major, minor, patch };
	})();

	return PHPLoader;

	// Close the opening bracket from esm-prefix.js:
}
