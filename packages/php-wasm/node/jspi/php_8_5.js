// Emscripten generates code for Node.js that uses the `require` function.
// We need to explicitly create a require function to avoid errors when running
// this code in Node.js as an ES module.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Note: The path module is currently needed by code injected by the php-wasm Dockerfile.
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dependencyFilename = path.join(__dirname, '8_5_0', 'php_8_5.wasm');
export { dependencyFilename };
export const dependenciesTotalSize = 30716158;
const phpVersionString = '8.5.0';
export function init(RuntimeName, PHPLoader) {
	// The rest of the code comes from the built php.js file and esm-suffix.js
	// include: shell.js
	// include: minimum_runtime_check.js
	// end include: minimum_runtime_check.js
	// The Module object: Our interface to the outside world. We import
	// and export values on it. There are various ways Module can be used:
	// 1. Not defined. We create it here
	// 2. A function parameter, function(moduleArg) => Promise<Module>
	// 3. pre-run appended it, var Module = {}; ..generated code..
	// 4. External script tag defines var Module.
	// We need to check if Module already exists (e.g. case 3 above).
	// Substitution will be replaced with actual code on later stage of the build,
	// this way Closure Compiler will not mangle it (e.g. case 4. above).
	// Note that if you want to run closure, and also to use Module
	// after the generated code, you will need to define   var Module = {};
	// before the code. Then that object will be used in the code, and you
	// can continue to use Module afterwards as well.
	var Module = typeof PHPLoader != 'undefined' ? PHPLoader : {};

	// Determine the runtime environment we are in. You can customize this by
	// setting the ENVIRONMENT setting at compile time (see settings.js).

	var ENVIRONMENT_IS_WEB = RuntimeName === 'WEB';
	var ENVIRONMENT_IS_WORKER = RuntimeName === 'WORKER';
	var ENVIRONMENT_IS_NODE = RuntimeName === 'NODE';
	var ENVIRONMENT_IS_SHELL = RuntimeName === 'SHELL';

	// --pre-jses are emitted after the Module integration code, so that they can
	// refer to Module (if they choose; they can also define Module)

	var arguments_ = [];
	var thisProgram = './this.program';
	var quit_ = (status, toThrow) => {
		throw toThrow;
	};

	var _scriptName;

	if (typeof __filename != 'undefined') {
		// Node
		_scriptName = __filename;
	} else /*no-op*/ {
	}

	// `/` should be present at the end if `scriptDirectory` is not empty
	var scriptDirectory = '';
	function locateFile(path) {
		if (Module['locateFile']) {
			return Module['locateFile'](path, scriptDirectory);
		}
		return scriptDirectory + path;
	}

	// Hooks that are implemented differently in different runtime environments.
	var readAsync, readBinary;

	if (ENVIRONMENT_IS_NODE) {
		// These modules will usually be used on Node.js. Load them eagerly to avoid
		// the complexity of lazy-loading.
		var fs = require('fs');

		scriptDirectory = __dirname + '/';

		// include: node_shell_read.js
		readBinary = (filename) => {
			// We need to re-wrap `file://` strings to URLs.
			filename = isFileURI(filename) ? new URL(filename) : filename;
			var ret = fs.readFileSync(filename);
			return ret;
		};

		readAsync = async (filename, binary = true) => {
			// See the comment in the `readBinary` function.
			filename = isFileURI(filename) ? new URL(filename) : filename;
			var ret = fs.readFileSync(filename, binary ? undefined : 'utf8');
			return ret;
		};
		// end include: node_shell_read.js
		if (process.argv.length > 1) {
			thisProgram = process.argv[1].replace(/\\/g, '/');
		}

		arguments_ = process.argv.slice(2);

		// MODULARIZE will export the module in the proper place outside, we don't need to export here
		if (typeof module != 'undefined') {
			module['exports'] = Module;
		}

		quit_ = (status, toThrow) => {
			process.exitCode = status;
			throw toThrow;
		};
	} else // Note that this includes Node.js workers when relevant (pthreads is enabled).
	// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
	// ENVIRONMENT_IS_NODE.
	{
	}

	var out = console.log.bind(console);
	var err = console.error.bind(console);

	// end include: shell.js

	// include: preamble.js
	// === Preamble library stuff ===

	// Documentation for the public APIs defined in this file must be updated in:
	//    site/source/docs/api_reference/preamble.js.rst
	// A prebuilt local version of the documentation is available at:
	//    site/build/text/docs/api_reference/preamble.js.txt
	// You can also build docs locally as HTML or other formats in site/
	// An online HTML version (which may be of a different version of Emscripten)
	//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

	var dynamicLibraries = [];

	var wasmBinary;

	// Wasm globals

	//========================================
	// Runtime essentials
	//========================================

	// whether we are quitting the application. no code should run after this.
	// set in exit() and abort()
	var ABORT = false;

	// set by exit() and abort().  Passed to 'onExit' handler.
	// NOTE: This is also used as the process return code code in shell environments
	// but only when noExitRuntime is false.
	var EXITSTATUS;

	// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
	// don't define it at all in release modes.  This matches the behaviour of
	// MINIMAL_RUNTIME.
	// TODO(sbc): Make this the default even without STRICT enabled.
	/** @type {function(*, string=)} */
	function assert(condition, text) {
		if (!condition) {
			// This build was created without ASSERTIONS defined.  `assert()` should not
			// ever be called in this configuration but in case there are callers in
			// the wild leave this simple abort() implementation here for now.
			abort(text);
		}
	}

	/**
	 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
	 * @noinline
	 */
	var isFileURI = (filename) => filename.startsWith('file://');

	// include: runtime_common.js
	// include: runtime_stack_check.js
	// end include: runtime_stack_check.js
	// include: runtime_exceptions.js
	// end include: runtime_exceptions.js
	// include: runtime_debug.js
	// end include: runtime_debug.js
	// Memory management
	var /** @type {!Int8Array} */
		HEAP8,
		/** @type {!Uint8Array} */
		HEAPU8,
		/** @type {!Int16Array} */
		HEAP16,
		/** @type {!Uint16Array} */
		HEAPU16,
		/** @type {!Int32Array} */
		HEAP32,
		/** @type {!Uint32Array} */
		HEAPU32,
		/** @type {!Float32Array} */
		HEAPF32,
		/** @type {!Float64Array} */
		HEAPF64;

	// BigInt64Array type is not correctly defined in closure
	var /** not-@type {!BigInt64Array} */
		HEAP64,
		/* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */
		HEAPU64;

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

	// include: memoryprofiler.js
	// end include: memoryprofiler.js
	// end include: runtime_common.js
	var __RELOC_FUNCS__ = [];

	function preRun() {
		if (Module['preRun']) {
			if (typeof Module['preRun'] == 'function')
				Module['preRun'] = [Module['preRun']];
			while (Module['preRun'].length) {
				addOnPreRun(Module['preRun'].shift());
			}
		}
		// Begin ATPRERUNS hooks
		callRuntimeCallbacks(onPreRuns);
		// End ATPRERUNS hooks
	}

	function initRuntime() {
		runtimeInitialized = true;

		callRuntimeCallbacks(__RELOC_FUNCS__);

		// Begin ATINITS hooks
		callRuntimeCallbacks(onInits);
		if (!Module['noFSInit'] && !FS.initialized) FS.init();
		TTY.init();
		SOCKFS.root = FS.mount(SOCKFS, {}, null);
		PIPEFS.root = FS.mount(PIPEFS, {}, null);
		// End ATINITS hooks

		wasmExports['__wasm_call_ctors']();

		// Begin ATPOSTCTORS hooks
		callRuntimeCallbacks(onPostCtors);
		FS.ignorePermissions = false;
		// End ATPOSTCTORS hooks
	}

	function preMain() {
		// Begin ATMAINS hooks
		callRuntimeCallbacks(onMains);
		// End ATMAINS hooks
	}

	function exitRuntime() {
		// PThreads reuse the runtime from the main thread.
		___funcs_on_exit(); // Native atexit() functions
		// Begin ATEXITS hooks
		callRuntimeCallbacks(onExits);
		FS.quit();
		TTY.shutdown();
		// End ATEXITS hooks
		runtimeExited = true;
	}

	function postRun() {
		// PThreads reuse the runtime from the main thread.

		if (Module['postRun']) {
			if (typeof Module['postRun'] == 'function')
				Module['postRun'] = [Module['postRun']];
			while (Module['postRun'].length) {
				addOnPostRun(Module['postRun'].shift());
			}
		}

		// Begin ATPOSTRUNS hooks
		callRuntimeCallbacks(onPostRuns);
		// End ATPOSTRUNS hooks
	}

	/** @param {string|number=} what */
	function abort(what) {
		Module['onAbort']?.(what);

		what = 'Aborted(' + what + ')';
		// TODO(sbc): Should we remove printing and leave it up to whoever
		// catches the exception?
		err(what);

		ABORT = true;

		what += '. Build with -sASSERTIONS for more info.';

		// Use a wasm runtime error, because a JS error might be seen as a foreign
		// exception, which means we'd run destructors on it. We need the error to
		// simply make the program stop.
		// FIXME This approach does not work in Wasm EH because it currently does not assume
		// all RuntimeErrors are from traps; it decides whether a RuntimeError is from
		// a trap or not based on a hidden field within the object. So at the moment
		// we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
		// allows this in the wasm spec.

		// Suppress closure compiler warning here. Closure compiler's builtin extern
		// definition for WebAssembly.RuntimeError claims it takes no arguments even
		// though it can.
		// TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
		// See above, in the meantime, we resort to wasm code for trapping.
		//
		// In case abort() is called before the module is initialized, wasmExports
		// and its exported '__trap' function is not available, in which case we throw
		// a RuntimeError.
		//
		// We trap instead of throwing RuntimeError to prevent infinite-looping in
		// Wasm EH code (because RuntimeError is considered as a foreign exception and
		// caught by 'catch_all'), but in case throwing RuntimeError is fine because
		// the module has not even been instantiated, even less running.
		if (runtimeInitialized) {
			___trap();
		}
		/** @suppress {checkTypes} */
		var e = new WebAssembly.RuntimeError(what);

		// Throw the error whether or not MODULARIZE is set because abort is used
		// in code paths apart from instantiation where an exception is expected
		// to be thrown when abort is called.
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
		// Throwing a plain string here, even though it not normally adviables since
		// this gets turning into an `abort` in instantiateArrayBuffer.
		throw 'both async and sync fetching of the wasm failed';
	}

	async function getWasmBinary(binaryFile) {
		// If we don't have the binary yet, load it asynchronously using readAsync.
		if (!wasmBinary) {
			// Fetch the binary using readAsync
			try {
				var response = await readAsync(binaryFile);
				return new Uint8Array(response);
			} catch {
				// Fall back to getBinarySync below;
			}
		}

		// Otherwise, getBinarySync should be able to get it synchronously
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
		if (
			!binary &&
			// Avoid instantiateStreaming() on Node.js environment for now, as while
			// Node.js v18.1.0 implements it, it does not have a full fetch()
			// implementation yet.
			//
			// Reference:
			//   https://github.com/emscripten-core/emscripten/pull/16917
			!ENVIRONMENT_IS_NODE
		) {
			try {
				var response = fetch(binaryFile, {
					credentials: 'same-origin',
				});
				var instantiationResult =
					await WebAssembly.instantiateStreaming(response, imports);
				return instantiationResult;
			} catch (reason) {
				// We expect the most common failure cause to be a bad MIME type for the binary,
				// in which case falling back to ArrayBuffer instantiation should work.
				err(`wasm streaming compile failed: ${reason}`);
				err('falling back to ArrayBuffer instantiation');
				// fall back of instantiateArrayBuffer below
			}
		}
		return instantiateArrayBuffer(binaryFile, imports);
	}

	function getWasmImports() {
		// instrumenting imports is used in asyncify in two ways: to add assertions
		// that check for proper import use, and for ASYNCIFY=2 we use them to set up
		// the Promise API on the import side.
		Asyncify.instrumentWasmImports(wasmImports);
		// prepare imports
		var imports = {
			env: wasmImports,
			wasi_snapshot_preview1: wasmImports,
			'GOT.mem': new Proxy(wasmImports, GOTHandler),
			'GOT.func': new Proxy(wasmImports, GOTHandler),
		};
		return imports;
	}

	// Create the wasm instance.
	// Receives the wasm imports, returns the exports.
	async function createWasm() {
		// Load the wasm module and create an instance of using native support in the JS engine.
		// handle a generated wasm instance, receiving its exports and
		// performing other necessary setup
		/** @param {WebAssembly.Module=} module*/
		function receiveInstance(instance, module) {
			wasmExports = instance.exports;

			// No relocation needed here.. but calling this just so that updateGOT is
			// called.
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

		// Prefer streaming instantiation if available.
		function receiveInstantiationResult(result) {
			// 'result' is a ResultObject object which has both the module and instance.
			// receiveInstance() will swap in the exports (to Module.asm) so they can be called
			return receiveInstance(result['instance'], result['module']);
		}

		var info = getWasmImports();

		// User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
		// to manually instantiate the Wasm module themselves. This allows pages to
		// run the instantiation parallel to any other async startup actions they are
		// performing.
		// Also pthreads and wasm workers initialize the wasm instance through this
		// path.
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

	// With MAIN_MODULE + ASYNCIFY the normal method of placing stub functions in
	// wasmImports for as-yet-undefined symbols doesn't work since ASYNCIFY then
	// wraps these stub functions and we can't then replace them directly.  Instead
	// the stub functions call into `asyncifyStubs` which gets populated by the
	// dynamic linker as symbols are loaded.
	var asyncifyStubs = {};
	// end include: preamble.js

	// Begin JS library code

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
				// Any non-weak reference to a symbol marks it as `required`, which
				// enabled `reportUndefinedSymbols` to report undefined symbol errors
				// correctly.
				rtn.required = true;
			}
			return rtn;
		},
	};

	var callRuntimeCallbacks = (callbacks) => {
		while (callbacks.length > 0) {
			// Pass the module as the first argument.
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
				callback(); // can add another dependenciesFulfilled
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
		// TextDecoder needs to know the byte length in advance, it doesn't stop on
		// null terminator by itself.
		// As a tiny code save trick, compare idx against maxIdx using a negation,
		// so that maxBytesToRead=undefined/NaN means Infinity.
		while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
		return idx;
	};

	/**
	 * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
	 * array that contains uint8 values, returns a copy of that string as a
	 * Javascript String object.
	 * heapOrArray is either a regular array, or a JavaScript typed array view.
	 * @param {number=} idx
	 * @param {number=} maxBytesToRead
	 * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
	 * @return {string}
	 */
	var UTF8ArrayToString = (
		heapOrArray,
		idx = 0,
		maxBytesToRead,
		ignoreNul
	) => {
		var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);

		// When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
		if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
			return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
		}
		var str = '';
		while (idx < endPtr) {
			// For UTF8 byte structure, see:
			// http://en.wikipedia.org/wiki/UTF-8#Description
			// https://www.ietf.org/rfc/rfc2279.txt
			// https://tools.ietf.org/html/rfc3629
			var u0 = heapOrArray[idx++];
			if (!(u0 & 0x80)) {
				str += String.fromCharCode(u0);
				continue;
			}
			var u1 = heapOrArray[idx++] & 63;
			if ((u0 & 0xe0) == 0xc0) {
				str += String.fromCharCode(((u0 & 31) << 6) | u1);
				continue;
			}
			var u2 = heapOrArray[idx++] & 63;
			if ((u0 & 0xf0) == 0xe0) {
				u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
			} else {
				u0 =
					((u0 & 7) << 18) |
					(u1 << 12) |
					(u2 << 6) |
					(heapOrArray[idx++] & 63);
			}

			if (u0 < 0x10000) {
				str += String.fromCharCode(u0);
			} else {
				var ch = u0 - 0x10000;
				str += String.fromCharCode(
					0xd800 | (ch >> 10),
					0xdc00 | (ch & 0x3ff)
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
				ret += (byte & 0x7f) * mul;
				mul *= 0x80;
				if (!(byte & 0x80)) break;
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

		/** @param {string=} message */
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
			var magicNumberFound = int32View[0] == 0x6d736100;
			failIf(!magicNumberFound, 'need to see wasm magic number'); // \0asm
			// we should see the dylink custom section right after the magic number and wasm version
			failIf(binary[8] !== 0, 'need the dylink section to be first');
			offset = 9;
			var section_size = getLEB(); //section size
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
		var WASM_DYLINK_MEM_INFO = 0x1;
		var WASM_DYLINK_NEEDED = 0x2;
		var WASM_DYLINK_EXPORT_INFO = 0x3;
		var WASM_DYLINK_IMPORT_INFO = 0x4;
		var WASM_DYLINK_RUNTIME_PATH = 0x5;
		var WASM_SYMBOL_TLS = 0x100;
		var WASM_SYMBOL_BINDING_MASK = 0x3;
		var WASM_SYMBOL_BINDING_WEAK = 0x1;
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
				// unknown subsection
				offset += subsectionSize;
			}
		}

		return customSection;
	};

	/**
	 * @param {number} ptr
	 * @param {string} type
	 */
	function getValue(ptr, type = 'i8') {
		if (type.endsWith('*')) type = '*';
		switch (type) {
			case 'i1':
				return HEAP8[ptr];
			case 'i8':
				return HEAP8[ptr];
			case 'i16':
				return HEAP16[ptr >> 1];
			case 'i32':
				return HEAP32[ptr >> 2];
			case 'i64':
				return HEAP64[ptr >> 3];
			case 'float':
				return HEAPF32[ptr >> 2];
			case 'double':
				return HEAPF64[ptr >> 3];
			case '*':
				return HEAPU32[ptr >> 2];
			default:
				abort(`invalid type for getValue: ${type}`);
		}
	}

	var newDSO = (name, handle, syms) => {
		var dso = {
			refcount: Infinity,
			name,
			exports: syms,
			global: true,
		};
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

	var alignMemory = (size, alignment) => {
		return Math.ceil(size / alignment) * alignment;
	};

	var getMemory = (size) => {
		// After the runtime is initialized, we must only use sbrk() normally.
		if (runtimeInitialized) {
			// Currently we don't support freeing of static data when modules are
			// unloaded via dlclose.  This function is tagged as `noleakcheck` to
			// avoid having this reported as leak.
			return _calloc(size, 1);
		}
		var ret = ___heap_base;
		// Keep __heap_base stack aligned.
		var end = ret + alignMemory(size, 16);
		___heap_base = end;

		// After allocating the memory from the start of the heap we need to ensure
		// that once the program starts it doesn't use this region.  In relocatable
		// mode we can just update the __heap_base symbol that we are exporting to
		// the main module.
		// When not relocatable `__heap_base` is fixed and exported by the main
		// module, but we can update the `sbrk_ptr` value instead.  We call
		// `_emscripten_get_sbrk_ptr` knowing that it is safe to call prior to
		// runtime initialization (unlike, the higher level sbrk function)
		var sbrk_ptr = _emscripten_get_sbrk_ptr();
		HEAPU32[sbrk_ptr >> 2] = end;
		return ret;
	};

	var isInternalSym = (symName) => {
		// TODO: find a way to mark these in the binary or avoid exporting them.
		return (
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
			].includes(symName) || symName.startsWith('__em_js__')
		);
	};

	var wasmTableMirror = [];

	var getWasmTableEntry = (funcPtr) => {
		var func = wasmTableMirror[funcPtr];
		if (!func) {
			/** @suppress {checkTypes} */
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
				// Ignore null values.
				if (item) {
					functionsInTableMap.set(item, i);
				}
			}
		}
	};

	var functionsInTableMap;

	var getFunctionAddress = (func) => {
		// First, create the map if this is the first use.
		if (!functionsInTableMap) {
			functionsInTableMap = new WeakMap();
			updateTableMap(0, wasmTable.length);
		}
		return functionsInTableMap.get(func) || 0;
	};

	var freeTableIndexes = [];

	var getEmptyTableSlot = () => {
		// Reuse a free index if there is one, otherwise grow.
		if (freeTableIndexes.length) {
			return freeTableIndexes.pop();
		}
		// Grow the table
		return wasmTable['grow'](1);
	};

	var setWasmTableEntry = (idx, func) => {
		/** @suppress {checkTypes} */
		wasmTable.set(idx, func);
		// With ABORT_ON_WASM_EXCEPTIONS wasmTable.get is overridden to return wrapped
		// functions so we need to call it here to retrieve the potential wrapper correctly
		// instead of just storing 'func' directly into wasmTableMirror
		/** @suppress {checkTypes} */
		wasmTableMirror[idx] = wasmTable.get(idx);
	};

	var uleb128EncodeWithLen = (arr) => {
		const n = arr.length;
		// Note: this LEB128 length encoding produces extra byte for n < 128,
		// but we don't care as it's only used in a temporary representation.
		return [(n % 128) | 128, n >> 7, ...arr];
	};

	var wasmTypeCodes = {
		i: 0x7f, // i32
		p: 0x7f, // i32
		j: 0x7e, // i64
		f: 0x7d, // f32
		d: 0x7c, // f64
		e: 0x6f, // externref
	};
	var generateTypePack = (types) =>
		uleb128EncodeWithLen(
			Array.from(types, (type) => {
				var code = wasmTypeCodes[type];
				return code;
			})
		);
	var convertJsFunctionToWasm = (func, sig) => {
		// Rest of the module is static
		var bytes = Uint8Array.of(
			0x00,
			0x61,
			0x73,
			0x6d, // magic ("\0asm")
			0x01,
			0x00,
			0x00,
			0x00, // version: 1
			0x01, // Type section code
			// The module is static, with the exception of the type section, which is
			// generated based on the signature passed in.
			...uleb128EncodeWithLen([
				0x01, // count: 1
				0x60 /* form: func */,
				// param types
				...generateTypePack(sig.slice(1)),
				// return types (for now only supporting [] if `void` and single [T] otherwise)
				...generateTypePack(sig[0] === 'v' ? '' : sig[0]),
			]),
			// The rest of the module is static
			0x02,
			0x07, // import section
			// (import "e" "f" (func 0 (type 0)))
			0x01,
			0x01,
			0x65,
			0x01,
			0x66,
			0x00,
			0x00,
			0x07,
			0x05, // export section
			// (export "f" (func 0 (type 0)))
			0x01,
			0x01,
			0x66,
			0x00,
			0x00
		);

		// We can compile this wasm module synchronously because it is very small.
		// This accepts an import (at "e.f"), that it reroutes to an export (at "f")
		var module = new WebAssembly.Module(bytes);
		var instance = new WebAssembly.Instance(module, { e: { f: func } });
		var wrappedFunc = instance.exports['f'];
		return wrappedFunc;
	};
	/** @param {string=} sig */
	var addFunction = (func, sig) => {
		// Check if the function is already in the table, to ensure each function
		// gets a unique index.
		var rtn = getFunctionAddress(func);
		if (rtn) {
			return rtn;
		}

		// It's not in the table, add it now.

		var ret = getEmptyTableSlot();

		// Set the new value.
		try {
			// Attempting to call this with JS function will cause of table.set() to fail
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
	/** @param {boolean=} replace */
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
					// The GOT can only contain addresses (i.e data addresses or function
					// addresses so we currently ignore other types export here.
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
			// Detect immuable wasm global exports. These represent data addresses
			// which are relative to `memoryBase`
			if (isImmutableGlobal(value)) {
				return value.value + memoryBase;
			}

			// Return unmodified value (no relocation required).
			return value;
		}

		var relocated = {};
		for (var e in exports) {
			relocated[e] = relocateExport(e, exports[e]);
		}
		return relocated;
	};

	var isSymbolDefined = (symName) => {
		// Ignore 'stub' symbols that are auto-generated as part of the original
		// `wasmImports` used to instantiate the main module.
		var existing = wasmImports[symName];
		if (!existing || existing.stub) {
			return false;
		}
		// Even if a symbol exists in wasmImports, and is not itself a stub, it
		// could be an ASYNCIFY wrapper function that wraps a stub function.
		if (symName in asyncifyStubs && !asyncifyStubs[symName]) {
			return false;
		}
		return true;
	};

	var createNamedFunction = (name, func) =>
		Object.defineProperty(func, 'name', { value: name });
	var resolveGlobalSymbol = (symName, direct = false) => {
		var sym;
		if (isSymbolDefined(symName)) {
			sym = wasmImports[symName];
		}
		return { sym, name: symName };
	};

	var onPostCtors = [];
	var addOnPostCtor = (cb) => onPostCtors.push(cb);

	/**
	 * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
	 * emscripten HEAP, returns a copy of that string as a Javascript String object.
	 *
	 * @param {number} ptr
	 * @param {number=} maxBytesToRead - An optional length that specifies the
	 *   maximum number of bytes to read. You can omit this parameter to scan the
	 *   string until the first 0 byte. If maxBytesToRead is passed, and the string
	 *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
	 *   string will cut short at that byte index.
	 * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
	 * @return {string}
	 */
	var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
		return ptr
			? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul)
			: '';
	};

	/**
	 * @param {string=} libName
	 * @param {Object=} localScope
	 * @param {number=} handle
	 */
	var loadWebAssemblyModule = (
		binary,
		flags,
		libName,
		localScope,
		handle
	) => {
		var metadata = getDylinkMetadata(binary);

		// loadModule loads the wasm module after all its dependencies have been loaded.
		// can be called both sync/async.
		function loadModule() {
			// alignments are powers of 2
			var memAlign = Math.pow(2, metadata.memoryAlign);
			// prepare memory
			var memoryBase = metadata.memorySize
				? alignMemory(
						getMemory(metadata.memorySize + memAlign),
						memAlign
					)
				: 0; // TODO: add to cleanups
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

			// This is the export map that we ultimately return.  We declare it here
			// so it can be used within resolveSymbol.  We resolve symbols against
			// this local symbol map in the case there they are not present on the
			// global Module object.  We need this fallback because Modules sometime
			// need to import their own symbols
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

			// TODO kill ↓↓↓ (except "symbols local to this module", it will likely be
			// not needed if we require that if A wants symbols from B it has to link
			// to B explicitly: similarly to -Wl,--no-undefined)
			//
			// wasm dynamic libraries are pure wasm, so they cannot assist in
			// their own loading. When side module A wants to import something
			// provided by a side module B that is loaded later, we need to
			// add a layer of indirection, but worse, we can't even tell what
			// to add the indirection for, without inspecting what A's imports
			// are. To do that here, we use a JS proxy (another option would
			// be to inspect the binary directly).
			var proxyHandler = {
				get(stubs, prop) {
					// symbols that should be local to this module
					switch (prop) {
						case '__memory_base':
							return memoryBase;
						case '__table_base':
							return tableBase;
					}
					if (prop in wasmImports && !wasmImports[prop].stub) {
						// No stub needed, symbol already exists in symbol table
						var res = wasmImports[prop];
						// Asyncify wraps exports, and we need to look through those wrappers.
						if (res.orig) {
							res = res.orig;
						}
						return res;
					}
					// Return a stub function that will resolve the symbol
					// when first called.
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
				// add new entries to functionsInTableMap
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

				// Add any EM_ASM function that exist in the side module
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
					// The signature here is a C signature (e.g. "(int foo, char* bar)").
					// See `create_em_js` in emcc.py` for the build-time version of this
					// code.
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
						// EM_JS strings are stored in the data section in the form
						// SIG<::>BODY.
						var [sig, body] = jsString.split('<::>');
						addEmJs(name.replace('__em_js__', ''), sig, body);
						delete moduleExports[name];
					}
				}

				// initialize the module
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
						// we aren't ready to run compiled code yet
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
						// Destructuring assignment without declaration has to be wrapped
						// with parens or parser will treat the l-value as an object
						// literal instead.
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

		// We need to set rpath in flags based on the current library's rpath.
		// We can't mutate flags or else if a depends on b and c and b depends on d,
		// then c will be loaded with b's rpath instead of a's.
		flags = {
			...flags,
			rpath: { parentLibPath: libName, paths: metadata.runtimePaths },
		};
		// now load needed libraries and the module itself.
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
		// add symbols into global namespace TODO: weak linking etc.
		for (var [sym, exp] of Object.entries(exports)) {
			// When RTLD_GLOBAL is enabled, the symbols defined by this shared object
			// will be made available for symbol resolution of subsequently loaded
			// shared objects.
			//
			// We should copy the symbols (which include methods and variables) from
			// SIDE_MODULE to MAIN_MODULE.
			const setImport = (target) => {
				if (target in asyncifyStubs) {
					asyncifyStubs[target] = exp;
				}
				if (!isSymbolDefined(target)) {
					wasmImports[target] = exp;
				}
			};
			setImport(sym);

			// Special case for handling of main symbol:  If a side module exports
			// `main` that also acts a definition for `__main_argc_argv` and vice
			// versa.
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
		// Use string keys here for public methods to avoid minification since the
		// plugin consumer also uses string keys.
		var wasmPlugin = {
			promiseChainEnd: Promise.resolve(),
			canHandle: (name) => {
				return !Module['noWasmDecoding'] && name.endsWith('.so');
			},
			handle: async (byteArray, name) =>
				// loadWebAssemblyModule can not load modules out-of-order, so rather
				// than just running the promises in parallel, this makes a chain of
				// promises to run in series.
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
			// if the path tries to go above the root, `up` ends up > 0
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
			// if the path is allowed to go above the root, restore leading ..s
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
			// Normalize the path
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
				// No dirname whatsoever
				return '.';
			}
			if (dir) {
				// It has a dirname, strip trailing slash
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
			// TODO: what to do if we only know the relative path of the file? It will return "." here.
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
			// Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
			// unit, not a Unicode code point of the character! So decode
			// UTF16->UTF32->UTF8.
			// See http://unicode.org/faq/utf_bom.html#utf16-3
			var c = str.charCodeAt(i); // possibly a lead surrogate
			if (c <= 0x7f) {
				len++;
			} else if (c <= 0x7ff) {
				len += 2;
			} else if (c >= 0xd800 && c <= 0xdfff) {
				len += 4;
				++i;
			} else {
				len += 3;
			}
		}
		return len;
	};

	var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
		// Parameter maxBytesToWrite is not optional. Negative values, 0, null,
		// undefined and false each don't write out any bytes.
		if (!(maxBytesToWrite > 0)) return 0;

		var startIdx = outIdx;
		var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
		for (var i = 0; i < str.length; ++i) {
			// For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
			// and https://www.ietf.org/rfc/rfc2279.txt
			// and https://tools.ietf.org/html/rfc3629
			var u = str.codePointAt(i);
			if (u <= 0x7f) {
				if (outIdx >= endIdx) break;
				heap[outIdx++] = u;
			} else if (u <= 0x7ff) {
				if (outIdx + 1 >= endIdx) break;
				heap[outIdx++] = 0xc0 | (u >> 6);
				heap[outIdx++] = 0x80 | (u & 63);
			} else if (u <= 0xffff) {
				if (outIdx + 2 >= endIdx) break;
				heap[outIdx++] = 0xe0 | (u >> 12);
				heap[outIdx++] = 0x80 | ((u >> 6) & 63);
				heap[outIdx++] = 0x80 | (u & 63);
			} else {
				if (outIdx + 3 >= endIdx) break;
				heap[outIdx++] = 0xf0 | (u >> 18);
				heap[outIdx++] = 0x80 | ((u >> 12) & 63);
				heap[outIdx++] = 0x80 | ((u >> 6) & 63);
				heap[outIdx++] = 0x80 | (u & 63);
				// Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
				// We need to manually skip over the second code unit for correct iteration.
				i++;
			}
		}
		// Null-terminate the pointer to the buffer.
		heap[outIdx] = 0;
		return outIdx - startIdx;
	};
	var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
		return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
	};

	var stringToUTF8OnStack = (str) => {
		var size = lengthBytesUTF8(str) + 1;
		var ret = stackAlloc(size);
		stringToUTF8(str, ret, size);
		return ret;
	};

	var initRandomFill = () => {
		return (view) => crypto.getRandomValues(view);
	};
	var randomFill = (view) => {
		// Lazily init on the first invocation.
		(randomFill = initRandomFill())(view);
	};

	var PATH_FS = {
		resolve: (...args) => {
			var resolvedPath = '',
				resolvedAbsolute = false;
			for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
				var path = i >= 0 ? args[i] : FS.cwd();
				// Skip empty and invalid entries
				if (typeof path != 'string') {
					throw new TypeError(
						'Arguments to path.resolve must be strings'
					);
				} else if (!path) {
					return ''; // an invalid portion invalidates the whole thing
				}
				resolvedPath = path + '/' + resolvedPath;
				resolvedAbsolute = PATH.isAbs(path);
			}
			// At this point the path should be resolved to a full absolute path, but
			// handle relative paths to be safe (might happen when process.cwd() fails)
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

	/** @type {function(string, boolean=, number=)} */
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
			if (ENVIRONMENT_IS_NODE) {
				// we will read data by chunks of BUFSIZE
				var BUFSIZE = 256;
				var buf = Buffer.alloc(BUFSIZE);
				var bytesRead = 0;

				// For some reason we must suppress a closure warning here, even though
				// fd definitely exists on process.stdin, and is even the proper way to
				// get the fd of stdin,
				// https://github.com/nodejs/help/issues/2136#issuecomment-523649904
				// This started to happen after moving this logic out of library_tty.js,
				// so it is related to the surrounding code in some unclear manner.
				/** @suppress {missingProperties} */
				var fd = process.stdin.fd;

				try {
					bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
				} catch (e) {
					// Cross-platform differences: on Windows, reading EOF throws an
					// exception, but on other OSes, reading EOF returns 0. Uniformize
					// behavior by treating the EOF exception to return 0.
					if (e.toString().includes('EOF')) bytesRead = 0;
					else throw e;
				}

				if (bytesRead > 0) {
					result = buf.slice(0, bytesRead).toString('utf-8');
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
		init() {
			// https://github.com/emscripten-core/emscripten/pull/1555
			// if (ENVIRONMENT_IS_NODE) {
			//   // currently, FS.init does not distinguish if process.stdin is a file or TTY
			//   // device, it always assumes it's a TTY device. because of this, we're forcing
			//   // process.stdin to UTF8 encoding to at least make stdin reading compatible
			//   // with text files until FS.init can be refactored.
			//   process.stdin.setEncoding('utf8');
			// }
		},
		shutdown() {
			// https://github.com/emscripten-core/emscripten/pull/1555
			// if (ENVIRONMENT_IS_NODE) {
			//   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
			//   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
			//   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
			//   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
			//   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
			//   process.stdin.pause();
			// }
		},
		register(dev, ops) {
			TTY.ttys[dev] = { input: [], output: [], ops: ops };
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
				// flush any pending line data
				stream.tty.ops.fsync(stream.tty);
			},
			fsync(stream) {
				stream.tty.ops.fsync(stream.tty);
			},
			read(stream, buffer, offset, length, pos /* ignored */) {
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
					if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
				}
			},
			fsync(tty) {
				if (tty.output?.length > 0) {
					out(UTF8ArrayToString(tty.output));
					tty.output = [];
				}
			},
			ioctl_tcgets(tty) {
				// typical setting
				return {
					c_iflag: 25856,
					c_oflag: 5,
					c_cflag: 191,
					c_lflag: 35387,
					c_cc: [
						0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11,
						0x13, 0x1a, 0x00, 0x12, 0x0f, 0x17, 0x16, 0x00, 0x00,
						0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
						0x00, 0x00, 0x00, 0x00, 0x00,
					],
				};
			},
			ioctl_tcsets(tty, optional_actions, data) {
				// currently just ignore
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
				// no supported
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
					stream: {
						llseek: MEMFS.stream_ops.llseek,
					},
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
				node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
				// When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
				// for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
				// penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
				node.contents = null;
			} else if (FS.isLink(node.mode)) {
				node.node_ops = MEMFS.ops_table.link.node;
				node.stream_ops = MEMFS.ops_table.link.stream;
			} else if (FS.isChrdev(node.mode)) {
				node.node_ops = MEMFS.ops_table.chrdev.node;
				node.stream_ops = MEMFS.ops_table.chrdev.stream;
			}
			node.atime = node.mtime = node.ctime = Date.now();
			// add the new node to the parent
			if (parent) {
				parent.contents[name] = node;
				parent.atime = parent.mtime = parent.ctime = node.atime;
			}
			return node;
		},
		getFileDataAsTypedArray(node) {
			if (!node.contents) return new Uint8Array(0);
			if (node.contents.subarray)
				return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
			return new Uint8Array(node.contents);
		},
		expandFileStorage(node, newCapacity) {
			var prevCapacity = node.contents ? node.contents.length : 0;
			if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
			// Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
			// For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
			// avoid overshooting the allocation cap by a very large margin.
			var CAPACITY_DOUBLING_MAX = 1024 * 1024;
			newCapacity = Math.max(
				newCapacity,
				(prevCapacity *
					(prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>>
					0
			);
			if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
			var oldContents = node.contents;
			node.contents = new Uint8Array(newCapacity); // Allocate new storage.
			if (node.usedBytes > 0)
				node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
		},
		resizeFileStorage(node, newSize) {
			if (node.usedBytes == newSize) return;
			if (newSize == 0) {
				node.contents = null; // Fully decommit when requesting a resize to zero.
				node.usedBytes = 0;
			} else {
				var oldContents = node.contents;
				node.contents = new Uint8Array(newSize); // Allocate new storage.
				if (oldContents) {
					node.contents.set(
						oldContents.subarray(
							0,
							Math.min(newSize, node.usedBytes)
						)
					); // Copy old data over to the new storage.
				}
				node.usedBytes = newSize;
			}
		},
		node_ops: {
			getattr(node) {
				var attr = {};
				// device numbers reuse inode numbers.
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
				// NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
				//       but this is not required by the standard.
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
				// This error may happen quite a bit. To avoid overhead we reuse it (and
				// suffer a lack of stack info).
				if (!MEMFS.doesNotExistError) {
					MEMFS.doesNotExistError = new FS.ErrnoError(44);
					/** @suppress {checkTypes} */
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
						// if we're overwriting a directory at new_name, make sure it's empty.
						for (var i in new_node.contents) {
							throw new FS.ErrnoError(55);
						}
					}
					FS.hashRemoveNode(new_node);
				}
				// do the internal rewiring
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
				var node = MEMFS.createNode(parent, newname, 0o777 | 40960, 0);
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
					// non-trivial, and typed array
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
				// If the buffer is located in main memory (HEAP), and if
				// memory can grow, we can't hold on to references of the
				// memory buffer, as they may get invalidated. That means we
				// need to do copy its contents.
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
					// This write is from a typed array to a typed array?
					if (canOwn) {
						node.contents = buffer.subarray(
							offset,
							offset + length
						);
						node.usedBytes = length;
						return length;
					} else if (node.usedBytes === 0 && position === 0) {
						// If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
						node.contents = buffer.slice(offset, offset + length);
						node.usedBytes = length;
						return length;
					} else if (position + length <= node.usedBytes) {
						// Writing to an already allocated and used subrange of the file?
						node.contents.set(
							buffer.subarray(offset, offset + length),
							position
						);
						return length;
					}
				}

				// Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
				MEMFS.expandFileStorage(node, position + length);
				if (node.contents.subarray && buffer.subarray) {
					// Use typed array write which is available.
					node.contents.set(
						buffer.subarray(offset, offset + length),
						position
					);
				} else {
					for (var i = 0; i < length; i++) {
						node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
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
				// Only make a new copy when MAP_PRIVATE is specified.
				if (
					!(flags & 2) &&
					contents &&
					contents.buffer === HEAP8.buffer
				) {
					// We can't emulate MAP_SHARED when the file is not backed by the
					// buffer we're mapping to (e.g. the HEAP buffer).
					allocated = false;
					ptr = contents.byteOffset;
				} else {
					allocated = true;
					ptr = mmapAlloc(length);
					if (!ptr) {
						throw new FS.ErrnoError(48);
					}
					if (contents) {
						// Try to avoid unnecessary slices.
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
				// should we check if bytesWritten and length are the same?
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

	var NODEFS = {
		isWindows: false,
		staticInit() {
			NODEFS.isWindows = !!process.platform.match(/^win/);
			var flags = process.binding('constants')['fs'];
			NODEFS.flagsForNodeMap = {
				1024: flags['O_APPEND'],
				64: flags['O_CREAT'],
				128: flags['O_EXCL'],
				256: flags['O_NOCTTY'],
				0: flags['O_RDONLY'],
				2: flags['O_RDWR'],
				4096: flags['O_SYNC'],
				512: flags['O_TRUNC'],
				1: flags['O_WRONLY'],
				131072: flags['O_NOFOLLOW'],
			};
		},
		convertNodeCode(e) {
			var code = e.code;
			return ERRNO_CODES[code];
		},
		tryFSOperation(f) {
			try {
				return f();
			} catch (e) {
				if (!e.code) throw e;
				// node under windows can return code 'UNKNOWN' here:
				// https://github.com/emscripten-core/emscripten/issues/15468
				if (e.code === 'UNKNOWN') throw new FS.ErrnoError(28);
				throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
			}
		},
		mount(mount) {
			return NODEFS.createNode(
				null,
				'/',
				NODEFS.getMode(mount.opts.root),
				0
			);
		},
		createNode(parent, name, mode, dev) {
			if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
				throw new FS.ErrnoError(28);
			}
			var node = FS.createNode(parent, name, mode);
			node.node_ops = NODEFS.node_ops;
			node.stream_ops = NODEFS.stream_ops;
			return node;
		},
		getMode(path) {
			return NODEFS.tryFSOperation(() => {
				var mode = fs.lstatSync(path).mode;
				if (NODEFS.isWindows) {
					// Windows does not report the 'x' permission bit, so propagate read
					// bits to execute bits.
					mode |= (mode & 292) >> 2;
				}
				return mode;
			});
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
		flagsForNode(flags) {
			flags &= ~2097152; // Ignore this flag from musl, otherwise node.js fails to open the file.
			flags &= ~2048; // Ignore this flag from musl, otherwise node.js fails to open the file.
			flags &= ~32768; // Ignore this flag from musl, otherwise node.js fails to open the file.
			flags &= ~524288; // Some applications may pass it; it makes no sense for a single process.
			flags &= ~65536; // Node.js doesn't need this passed in, it errors.
			var newFlags = 0;
			for (var k in NODEFS.flagsForNodeMap) {
				if (flags & k) {
					newFlags |= NODEFS.flagsForNodeMap[k];
					flags ^= k;
				}
			}
			if (flags) {
				throw new FS.ErrnoError(28);
			}
			return newFlags;
		},
		getattr(func, node) {
			var stat = NODEFS.tryFSOperation(func);
			if (NODEFS.isWindows) {
				// node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake
				// them with default blksize of 4096.
				// See http://support.microsoft.com/kb/140365
				if (!stat.blksize) {
					stat.blksize = 4096;
				}
				if (!stat.blocks) {
					stat.blocks =
						((stat.size + stat.blksize - 1) / stat.blksize) | 0;
				}
				// Windows does not report the 'x' permission bit, so propagate read
				// bits to execute bits.
				stat.mode |= (stat.mode & 292) >> 2;
			}
			return {
				dev: stat.dev,
				ino: node.id,
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
		setattr(arg, node, attr, chmod, utimes, truncate, stat) {
			NODEFS.tryFSOperation(() => {
				if (attr.mode !== undefined) {
					var mode = attr.mode;
					if (NODEFS.isWindows) {
						// Windows only supports S_IREAD / S_IWRITE (S_IRUSR / S_IWUSR)
						// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/chmod-wchmod
						mode &= 384;
					}
					chmod(arg, mode);
					// update the common node structure mode as well
					node.mode = attr.mode;
				}
				if (typeof (attr.atime ?? attr.mtime) === 'number') {
					// Unfortunately, we have to stat the current value if we don't want
					// to change it. On top of that, since the times don't round trip
					// this will only keep the value nearly unchanged not exactly
					// unchanged. See:
					// https://github.com/nodejs/node/issues/56492
					var atime = new Date(attr.atime ?? stat(arg).atime);
					var mtime = new Date(attr.mtime ?? stat(arg).mtime);
					utimes(arg, atime, mtime);
				}
				if (attr.size !== undefined) {
					truncate(arg, attr.size);
				}
			});
		},
		node_ops: {
			getattr(node) {
				var path = NODEFS.realPath(node);
				return NODEFS.getattr(() => fs.lstatSync(path), node);
			},
			setattr(node, attr) {
				var path = NODEFS.realPath(node);
				if (attr.mode != null && attr.dontFollow) {
					throw new FS.ErrnoError(52);
				}
				NODEFS.setattr(
					path,
					node,
					attr,
					fs.chmodSync,
					fs.utimesSync,
					fs.truncateSync,
					fs.lstatSync
				);
			},
			lookup(parent, name) {
				var path = PATH.join2(NODEFS.realPath(parent), name);
				var mode = NODEFS.getMode(path);
				return NODEFS.createNode(parent, name, mode);
			},
			mknod(parent, name, mode, dev) {
				var node = NODEFS.createNode(parent, name, mode, dev);
				// create the backing node for this in the fs root as well
				var path = NODEFS.realPath(node);
				NODEFS.tryFSOperation(() => {
					if (FS.isDir(node.mode)) {
						fs.mkdirSync(path, node.mode);
					} else {
						fs.writeFileSync(path, '', { mode: node.mode });
					}
				});
				return node;
			},
			rename(oldNode, newDir, newName) {
				var oldPath = NODEFS.realPath(oldNode);
				var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
				try {
					FS.unlink(newPath);
				} catch (e) {}
				NODEFS.tryFSOperation(() => fs.renameSync(oldPath, newPath));
				oldNode.name = newName;
			},
			unlink(parent, name) {
				var path = PATH.join2(NODEFS.realPath(parent), name);
				NODEFS.tryFSOperation(() => fs.unlinkSync(path));
			},
			rmdir(parent, name) {
				var path = PATH.join2(NODEFS.realPath(parent), name);
				NODEFS.tryFSOperation(() => fs.rmdirSync(path));
			},
			readdir(node) {
				var path = NODEFS.realPath(node);
				return NODEFS.tryFSOperation(() => fs.readdirSync(path));
			},
			symlink(parent, newName, oldPath) {
				var newPath = PATH.join2(NODEFS.realPath(parent), newName);
				NODEFS.tryFSOperation(() => fs.symlinkSync(oldPath, newPath));
			},
			readlink(node) {
				var path = NODEFS.realPath(node);
				return NODEFS.tryFSOperation(() => fs.readlinkSync(path));
			},
			statfs(path) {
				var stats = NODEFS.tryFSOperation(() => fs.statfsSync(path));
				// Node.js doesn't provide frsize (fragment size). Set it to bsize (block size)
				// as they're often the same in many file systems. May not be accurate for all.
				stats.frsize = stats.bsize;
				return stats;
			},
		},
		stream_ops: {
			getattr(stream) {
				return NODEFS.getattr(
					() => fs.fstatSync(stream.nfd),
					stream.node
				);
			},
			setattr(stream, attr) {
				NODEFS.setattr(
					stream.nfd,
					stream.node,
					attr,
					fs.fchmodSync,
					fs.futimesSync,
					fs.ftruncateSync,
					fs.fstatSync
				);
			},
			open(stream) {
				var path = NODEFS.realPath(stream.node);
				NODEFS.tryFSOperation(() => {
					stream.shared.refcount = 1;
					stream.nfd = fs.openSync(
						path,
						NODEFS.flagsForNode(stream.flags)
					);
				});
			},
			close(stream) {
				NODEFS.tryFSOperation(() => {
					if (stream.nfd && --stream.shared.refcount === 0) {
						fs.closeSync(stream.nfd);
					}
				});
			},
			dup(stream) {
				stream.shared.refcount++;
			},
			read(stream, buffer, offset, length, position) {
				return NODEFS.tryFSOperation(() =>
					fs.readSync(
						stream.nfd,
						new Int8Array(buffer.buffer, offset, length),
						0,
						length,
						position
					)
				);
			},
			write(stream, buffer, offset, length, position) {
				return NODEFS.tryFSOperation(() =>
					fs.writeSync(
						stream.nfd,
						new Int8Array(buffer.buffer, offset, length),
						0,
						length,
						position
					)
				);
			},
			llseek(stream, offset, whence) {
				var position = offset;
				if (whence === 1) {
					position += stream.position;
				} else if (whence === 2) {
					if (FS.isFile(stream.node.mode)) {
						NODEFS.tryFSOperation(() => {
							var stat = fs.fstatSync(stream.nfd);
							position += stat.size;
						});
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

				var ptr = mmapAlloc(length);

				NODEFS.stream_ops.read(stream, HEAP8, ptr, length, position);
				return { ptr, allocated: true };
			},
			msync(stream, buffer, offset, length, mmapFlags) {
				NODEFS.stream_ops.write(
					stream,
					buffer,
					0,
					length,
					offset,
					false
				);
				// should we check if bytesWritten and length are the same?
				return 0;
			},
		},
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
						// update the common node structure mode as well
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
				// create the backing node for this in the fs root as well
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

	var getUniqueRunDependency = (id) => {
		return id;
	};

	var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
		// Ensure plugins are ready.
		if (typeof Browser != 'undefined') Browser.init();

		for (var plugin of preloadPlugins) {
			if (plugin['canHandle'](fullname)) {
				return plugin['handle'](byteArray, fullname);
			}
		}
		// In no plugin handled this file then return the original/unmodified
		// byteArray.
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
		// TODO we should allow people to just pass in a complete filename instead
		// of parent and name being that we just join them anyways
		var fullname = name
			? PATH_FS.resolve(PATH.join2(parent, name))
			: parent;
		var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
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
			// We set the `name` property to be able to identify `FS.ErrnoError`
			// - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
			// - when using PROXYFS, an error can come from an underlying FS
			// as different FS objects have their own FS.ErrnoError each,
			// the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
			// we'll use the reliable test `err.name == "ErrnoError"` instead
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
					parent = this; // root node sets parent to itself
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

			// limit max consecutive symlinks to 40 (SYMLOOP_MAX).
			linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
				// split the absolute path
				var parts = path.split('/').filter((p) => !!p);

				// start at the root
				var current = FS.root;
				var current_path = '/';

				for (var i = 0; i < parts.length; i++) {
					var islast = i === parts.length - 1;
					if (islast && opts.parent) {
						// stop resolving
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
							// We're making progress here, don't let many consecutive ..'s
							// lead to ELOOP
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
						// if noent_okay is true, suppress a ENOENT in the last component
						// and return an object with an undefined node. This is needed for
						// resolving symlinks in the path when creating a file.
						if (e?.errno === 44 && islast && opts.noent_okay) {
							return { path: current_path };
						}
						throw e;
					}

					// jump to the mount's root node if this is a mountpoint
					if (
						FS.isMountpoint(current) &&
						(!islast || opts.follow_mount)
					) {
						current = current.mounted.root;
					}

					// by default, lookupPath will not follow a symlink if it is the final path component.
					// setting opts.follow = true will override this behavior.
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
			// if we failed to find it in the cache, call into the VFS
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
			// return 0 if any user, group or owner bits are set.
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
					FS.flagsToPermissionString(flags) !== 'r' || // opening for write
					flags & (512 | 64)
				) {
					// TODO: check for O_SEARCH? (== search for dir only)
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
			// clone it, so we can return an instance of FSStream
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
				// override node's stream ops with the device's
				stream.stream_ops = device.stream_ops;
				// forward the open call
				stream.stream_ops.open?.(stream);
			},
			llseek() {
				throw new FS.ErrnoError(70);
			},
		},
		major: (dev) => dev >> 8,
		minor: (dev) => dev & 0xff,
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

			// sync all mounts
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

				mountpoint = lookup.path; // use the absolute path
				node = lookup.node;

				if (FS.isMountpoint(node)) {
					throw new FS.ErrnoError(10);
				}
			}

			var mount = {
				type,
				opts,
				mountpoint,
				mounts: [],
			};

			// create a root node for the fs
			var mountRoot = type.mount(mount);
			mountRoot.mount = mount;
			mount.root = mountRoot;

			if (root) {
				FS.root = mountRoot;
			} else if (node) {
				// set as a mountpoint
				node.mounted = mount;

				// add the new mount to the current mount's children
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

			// destroy the nodes for this mount, and all its child mounts
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

			// no longer a mountpoint
			node.mounted = null;

			// remove this mount from the child mounts
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
			// We keep a separate statfsStream function because noderawfs overrides
			// it. In noderawfs, stream.node is sometimes null. Instead, we need to
			// look at stream.path.
			return FS.statfsNode(stream.node);
		},
		statfsNode(node) {
			// NOTE: None of the defaults here are true. We're just returning safe and
			//       sane values. Currently nodefs and rawfs replace these defaults,
			//       other file systems leave them alone.
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
		create(path, mode = 0o666) {
			mode &= 4095;
			mode |= 32768;
			return FS.mknod(path, mode, 0);
		},
		mkdir(path, mode = 0o777) {
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
				mode = 0o666;
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
			// parents must exist
			var lookup, old_dir, new_dir;

			// let the errors from non existent directories percolate up
			lookup = FS.lookupPath(old_path, { parent: true });
			old_dir = lookup.node;
			lookup = FS.lookupPath(new_path, { parent: true });
			new_dir = lookup.node;

			if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
			// need to be part of the same mount
			if (old_dir.mount !== new_dir.mount) {
				throw new FS.ErrnoError(75);
			}
			// source must exist
			var old_node = FS.lookupNode(old_dir, old_name);
			// old path should not be an ancestor of the new path
			var relative = PATH_FS.relative(old_path, new_dirname);
			if (relative.charAt(0) !== '.') {
				throw new FS.ErrnoError(28);
			}
			// new path should not be an ancestor of the old path
			relative = PATH_FS.relative(new_path, old_dirname);
			if (relative.charAt(0) !== '.') {
				throw new FS.ErrnoError(55);
			}
			// see if the new path already exists
			var new_node;
			try {
				new_node = FS.lookupNode(new_dir, new_name);
			} catch (e) {
				// not fatal
			}
			// early out if nothing needs to change
			if (old_node === new_node) {
				return;
			}
			// we'll need to delete the old entry
			var isdir = FS.isDir(old_node.mode);
			var errCode = FS.mayDelete(old_dir, old_name, isdir);
			if (errCode) {
				throw new FS.ErrnoError(errCode);
			}
			// need delete permissions if we'll be overwriting.
			// need create permissions if new doesn't already exist.
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
			// if we are going to change the parent, check write permissions
			if (new_dir !== old_dir) {
				errCode = FS.nodePermissions(old_dir, 'w');
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
			}
			// remove the node from the lookup hash
			FS.hashRemoveNode(old_node);
			// do the underlying fs rename
			try {
				old_dir.node_ops.rename(old_node, new_dir, new_name);
				// update old node (we do this here to avoid each backend
				// needing to)
				old_node.parent = new_dir;
			} catch (e) {
				throw e;
			} finally {
				// add the node back to the hash (in case node_ops.rename
				// changed its name)
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
				// According to POSIX, we should map EISDIR to EPERM, but
				// we instead do what Linux does (and we must, as we use
				// the musl linux libc).
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
			FS.doSetAttr(stream, node, {
				timestamp: Date.now(),
				dontFollow,
				// we ignore the uid / gid for now
			});
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
			FS.doSetAttr(stream, node, {
				size: len,
				timestamp: Date.now(),
			});
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
			setattr(node, {
				atime: atime,
				mtime: mtime,
			});
		},
		open(path, flags, mode = 0o666) {
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
				// noent_okay makes it so that if the final component of the path
				// doesn't exist, lookupPath returns `node: undefined`. `path` will be
				// updated to point to the target of all symlinks.
				var lookup = FS.lookupPath(path, {
					follow: !(flags & 131072),
					noent_okay: true,
				});
				node = lookup.node;
				path = lookup.path;
			}
			// perhaps we need to create the node
			var created = false;
			if (flags & 64) {
				if (node) {
					// if O_CREAT and O_EXCL are set, error out if the node already exists
					if (flags & 128) {
						throw new FS.ErrnoError(20);
					}
				} else if (isDirPath) {
					throw new FS.ErrnoError(31);
				} else {
					// node doesn't exist, try to create it
					// Ignore the permission bits here to ensure we can `open` this new
					// file below. We use chmod below the apply the permissions once the
					// file is open.
					node = FS.mknod(path, mode | 0o777, 0);
					created = true;
				}
			}
			if (!node) {
				throw new FS.ErrnoError(44);
			}
			// can't truncate a device
			if (FS.isChrdev(node.mode)) {
				flags &= ~512;
			}
			// if asked only for a directory, then this must be one
			if (flags & 65536 && !FS.isDir(node.mode)) {
				throw new FS.ErrnoError(54);
			}
			// check permissions, if this is not a file we just created now (it is ok to
			// create and write to a file with read-only permissions; it is read-only
			// for later use)
			if (!created) {
				var errCode = FS.mayOpen(node, flags);
				if (errCode) {
					throw new FS.ErrnoError(errCode);
				}
			}
			// do truncation if necessary
			if (flags & 512 && !created) {
				FS.truncate(node, 0);
			}
			// we've already handled these, don't pass down to the underlying vfs
			flags &= ~(128 | 512 | 131072);

			// register the stream with the filesystem
			var stream = FS.createStream({
				node,
				path: FS.getPath(node), // we want the absolute path to the node
				flags,
				seekable: true,
				position: 0,
				stream_ops: node.stream_ops,
				// used by the file family libc calls (fopen, fwrite, ferror, etc.)
				ungotten: [],
				error: false,
			});
			// call the new stream's open function
			if (stream.stream_ops.open) {
				stream.stream_ops.open(stream);
			}
			if (created) {
				FS.chmod(node, mode & 0o777);
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
			if (stream.getdents) stream.getdents = null; // free readdir state
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
				// seek to the end before writing in append mode
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
			// User requests writing to file (prot & PROT_WRITE != 0).
			// Checking if we have permissions to write to the file unless
			// MAP_PRIVATE flag is set. According to POSIX spec it is possible
			// to write to file opened in read-only mode with MAP_PRIVATE flag,
			// as all modifications will be visible only in the memory of
			// the current process.
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
			// create /dev
			FS.mkdir('/dev');
			// setup /dev/null
			FS.registerDevice(FS.makedev(1, 3), {
				read: () => 0,
				write: (stream, buffer, offset, length, pos) => length,
				llseek: () => 0,
			});
			FS.mkdev('/dev/null', FS.makedev(1, 3));
			// setup /dev/tty and /dev/tty1
			// stderr needs to print output using err() rather than out()
			// so we register a second tty just for it.
			TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
			TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
			FS.mkdev('/dev/tty', FS.makedev(5, 0));
			FS.mkdev('/dev/tty1', FS.makedev(6, 0));
			// setup /dev/[u]random
			// use a buffer to avoid overhead of individual crypto calls per byte
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
			// we're not going to emulate the actual shm device,
			// just create the tmp dirs that reside in it commonly
			FS.mkdir('/dev/shm');
			FS.mkdir('/dev/shm/tmp');
		},
		createSpecialDirectories() {
			// create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
			// name of the stream for fd 6 (see test_unistd_ttyname)
			FS.mkdir('/proc');
			var proc_self = FS.mkdir('/proc/self');
			FS.mkdir('/proc/self/fd');
			FS.mount(
				{
					mount() {
						var node = FS.createNode(proc_self, 'fd', 16895, 73);
						node.stream_ops = {
							llseek: MEMFS.stream_ops.llseek,
						};
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
								ret.parent = ret; // make it look like a simple root node
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
			// TODO deprecate the old functionality of a single
			// input / output callback and that utilizes FS.createDevice
			// and instead require a unique set of stream ops

			// by default, we symlink the standard streams to the
			// default tty devices. however, if the standard streams
			// have been overwritten we create a unique device for
			// them instead.
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

			// open default streams for the stdin, stdout and stderr devices
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

			FS.filesystems = {
				MEMFS: MEMFS,
				NODEFS: NODEFS,
				PROXYFS: PROXYFS,
			};
		},
		init(input, output, error) {
			FS.initialized = true;

			// Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
			input ??= Module['stdin'];
			output ??= Module['stdout'];
			error ??= Module['stderr'];

			FS.createStandardStreams(input, output, error);
		},
		quit() {
			FS.initialized = false;
			// force-flush all streams, so we get musl std streams printed out
			_fflush(0);
			// close all of our streams
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
			// operate from within the context of the symlink's target
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
				// make sure we can write to the file
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
			// Create a fake device that a set of stream ops to emulate
			// the old behavior.
			FS.registerDevice(dev, {
				open(stream) {
					stream.seekable = false;
				},
				close(stream) {
					// flush any pending line data
					if (output?.buffer?.length) {
						output(10);
					}
				},
				read(stream, buffer, offset, length, pos /* ignored */) {
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
				// Command-line.
				try {
					obj.contents = readBinary(obj.url);
				} catch (e) {
					throw new FS.ErrnoError(29);
				}
			}
		},
		createLazyFile(parent, name, url, canRead, canWrite) {
			// Lazy chunked Uint8Array (implements get and length from Uint8Array).
			// Actual getting is abstracted away for eventual reuse.
			class LazyUint8Array {
				lengthKnown = false;
				chunks = []; // Loaded chunks. Index is the chunk number
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
					// Find length
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

					var chunkSize = 1024 * 1024; // Chunk size in bytes

					if (!hasByteServing) chunkSize = datalength;

					// Function to get a range from the remote URL.
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

						// TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
						var xhr = new XMLHttpRequest();
						xhr.open('GET', url, false);
						if (datalength !== chunkSize)
							xhr.setRequestHeader(
								'Range',
								'bytes=' + from + '-' + to
							);

						// Some hints to the browser that we want binary data.
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
							return new Uint8Array(
								/** @type{Array<number>} */ (xhr.response || [])
							);
						}
						return intArrayFromString(xhr.responseText || '', true);
					};
					var lazyArray = this;
					lazyArray.setDataGetter((chunkNum) => {
						var start = chunkNum * chunkSize;
						var end = (chunkNum + 1) * chunkSize - 1; // including this byte
						end = Math.min(end, datalength - 1); // if datalength-1 is selected, this is the last block
						if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
							lazyArray.chunks[chunkNum] = doXHR(start, end);
						}
						if (typeof lazyArray.chunks[chunkNum] == 'undefined')
							abort('doXHR failed!');
						return lazyArray.chunks[chunkNum];
					});

					if (usesGzip || !datalength) {
						// if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
						chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
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
				var properties = { isDevice: false, url: url };
			}

			var node = FS.createFile(
				parent,
				name,
				properties,
				canRead,
				canWrite
			);
			// This is a total hack, but I want to get this lazy file code out of the
			// core of MEMFS. If we want to keep this lazy file concept I feel it should
			// be its own thin LAZYFS proxying calls to MEMFS.
			if (properties.contents) {
				node.contents = properties.contents;
			} else if (properties.url) {
				node.contents = null;
				node.url = properties.url;
			}
			// Add a function that defers querying the file size until it is asked the first time.
			Object.defineProperties(node, {
				usedBytes: {
					get: function () {
						return this.contents.length;
					},
				},
			});
			// override each stream op with one that tries to force load the lazy file first
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
					// normal array
					for (var i = 0; i < size; i++) {
						buffer[offset + i] = contents[position + i];
					}
				} else {
					for (var i = 0; i < size; i++) {
						// LazyUint8Array from sync binary XHR
						buffer[offset + i] = contents.get(position + i);
					}
				}
				return size;
			}
			// use a custom read function
			stream_ops.read = (stream, buffer, offset, length, position) => {
				FS.forceLoadFile(node);
				return writeChunks(stream, buffer, offset, length, position);
			};
			// use a custom mmap function
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
		// If we're preloading a dynamic library, the runtime is not ready to call
		// __wasmfs_identify or __emscripten_find_dylib. So just quit out.
		//
		// This means that DT_NEEDED for the main module and transitive dependencies
		// of it won't work with this code path. Similarly, it means that calling
		// loadDynamicLibrary in a preRun hook can't use this code path.
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
			// In dylink.c we use: `char buf[2*NAME_MAX+2];` and NAME_MAX is 255.
			// So we use the same size here.
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

	/**
	 * @param {number=} handle
	 * @param {Object=} localScope
	 */
	function loadDynamicLibrary(
		libName,
		flags = { global: true, nodelete: true },
		localScope,
		handle
	) {
		// when loadDynamicLibrary did not have flags, libraries were loaded
		// globally & permanently

		var dso = LDSO.loadedLibsByName[libName];
		if (dso) {
			// the library is being loaded or has been loaded already.
			if (!flags.global) {
				if (localScope) {
					Object.assign(localScope, dso.exports);
				}
			} else if (!dso.global) {
				// The library was previously loaded only locally but not
				// we have a request with global=true.
				dso.global = true;
				mergeLibSymbols(dso.exports, libName);
			}
			// same for "nodelete"
			if (flags.nodelete && dso.refcount !== Infinity) {
				dso.refcount = Infinity;
			}
			dso.refcount++;
			if (handle) {
				LDSO.loadedLibsByHandle[handle] = dso;
			}
			return flags.loadAsync ? Promise.resolve(true) : true;
		}

		// allocate new DSO
		dso = newDSO(libName, handle, 'loading');
		dso.refcount = flags.nodelete ? Infinity : 1;
		dso.global = flags.global;

		// libName -> libData
		function loadLibData() {
			// for wasm, we can use fetch for async, but for fs mode we can only imitate it
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

			// load the binary synchronously
			if (!readBinary) {
				throw new Error(
					`${libFile}: file not found, and synchronous loading of external files is not available`
				);
			}
			return readBinary(libFile);
		}

		// libName -> exports
		function getExports() {
			// lookup preloaded cache first
			var preloaded = preloadedWasm[libName];
			if (preloaded) {
				return flags.loadAsync ? Promise.resolve(preloaded) : preloaded;
			}

			// module not preloaded - load lib data and create new module from it
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

		// module for lib is loaded - update the dso & global namespace
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
					// Ignore undefined symbols that are imported as weak.
					entry.value = 0;
					continue;
				}
				if (typeof value == 'function') {
					/** @suppress {checkTypes} */
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

		// Load binaries asynchronously
		for (var lib of dynamicLibraries) {
			await loadDynamicLibrary(lib, {
				loadAsync: true,
				global: true,
				nodelete: true,
				allowUndefined: true,
			});
		}
		// we got them all, wonderful
		reportUndefinedSymbols();

		removeRunDependency('loadDylibs');
	};

	var noExitRuntime = false;

	/**
	 * @param {number} ptr
	 * @param {number} value
	 * @param {string} type
	 */
	function setValue(ptr, value, type = 'i8') {
		if (type.endsWith('*')) type = '*';
		switch (type) {
			case 'i1':
				HEAP8[ptr] = value;
				break;
			case 'i8':
				HEAP8[ptr] = value;
				break;
			case 'i16':
				HEAP16[ptr >> 1] = value;
				break;
			case 'i32':
				HEAP32[ptr >> 2] = value;
				break;
			case 'i64':
				HEAP64[ptr >> 3] = BigInt(value);
				break;
			case 'float':
				HEAPF32[ptr >> 2] = value;
				break;
			case 'double':
				HEAPF64[ptr >> 3] = value;
				break;
			case '*':
				HEAPU32[ptr >> 2] = value;
				break;
			default:
				abort(`invalid type for setValue: ${type}`);
		}
	}

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

	var SYSCALLS = {
		DEFAULT_POLLMASK: 5,
		calculateAt(dirfd, path, allowEmpty) {
			if (PATH.isAbs(path)) {
				return path;
			}
			// relative path
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
			HEAP64[(buf + 40) >> 3] = BigInt(Math.floor(atime / 1000));
			HEAPU32[(buf + 48) >> 2] = (atime % 1000) * 1000 * 1000;
			HEAP64[(buf + 56) >> 3] = BigInt(Math.floor(mtime / 1000));
			HEAPU32[(buf + 64) >> 2] = (mtime % 1000) * 1000 * 1000;
			HEAP64[(buf + 72) >> 3] = BigInt(Math.floor(ctime / 1000));
			HEAPU32[(buf + 80) >> 2] = (ctime % 1000) * 1000 * 1000;
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
			HEAPU32[(buf + 64) >> 2] = stats.flags; // ST_NOSUID
			HEAPU32[(buf + 56) >> 2] = stats.namelen;
		},
		doMsync(addr, stream, len, flags, offset) {
			if (!FS.isFile(stream.node.mode)) {
				throw new FS.ErrnoError(43);
			}
			if (flags & 2) {
				// MAP_PRIVATE calls need not to be synced back to underlying fs
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
	var ___syscall__newselect = function (
		nfds,
		readfds,
		writefds,
		exceptfds,
		timeout
	) {
		try {
			// readfds are supported,
			// writefds checks socket open status
			// exceptfds are supported, although on web, such exceptional conditions never arise in web sockets
			//                          and so the exceptfds list will always return empty.
			// timeout is supported, although on SOCKFS and PIPEFS these are ignored and always treated as 0 - fully async

			var total = 0;

			var srcReadLow = readfds ? HEAP32[readfds >> 2] : 0,
				srcReadHigh = readfds ? HEAP32[(readfds + 4) >> 2] : 0;
			var srcWriteLow = writefds ? HEAP32[writefds >> 2] : 0,
				srcWriteHigh = writefds ? HEAP32[(writefds + 4) >> 2] : 0;
			var srcExceptLow = exceptfds ? HEAP32[exceptfds >> 2] : 0,
				srcExceptHigh = exceptfds ? HEAP32[(exceptfds + 4) >> 2] : 0;

			var dstReadLow = 0,
				dstReadHigh = 0;
			var dstWriteLow = 0,
				dstWriteHigh = 0;
			var dstExceptLow = 0,
				dstExceptHigh = 0;

			var allLow =
				(readfds ? HEAP32[readfds >> 2] : 0) |
				(writefds ? HEAP32[writefds >> 2] : 0) |
				(exceptfds ? HEAP32[exceptfds >> 2] : 0);
			var allHigh =
				(readfds ? HEAP32[(readfds + 4) >> 2] : 0) |
				(writefds ? HEAP32[(writefds + 4) >> 2] : 0) |
				(exceptfds ? HEAP32[(exceptfds + 4) >> 2] : 0);

			var check = (fd, low, high, val) =>
				fd < 32 ? low & val : high & val;

			for (var fd = 0; fd < nfds; fd++) {
				var mask = 1 << (fd % 32);
				if (!check(fd, allLow, allHigh, mask)) {
					continue; // index isn't in the set
				}

				var stream = SYSCALLS.getStreamFromFD(fd);

				var flags = SYSCALLS.DEFAULT_POLLMASK;

				if (stream.stream_ops?.poll) {
					var timeoutInMillis = -1;
					if (timeout) {
						// select(2) is declared to accept "struct timeval { time_t tv_sec; suseconds_t tv_usec; }".
						// However, musl passes the two values to the syscall as an array of long values.
						// Note that sizeof(time_t) != sizeof(long) in wasm32. The former is 8, while the latter is 4.
						// This means using "C_STRUCTS.timeval.tv_usec" leads to a wrong offset.
						// So, instead, we use POINTER_SIZE.
						var tv_sec = readfds ? HEAP32[timeout >> 2] : 0,
							tv_usec = readfds ? HEAP32[(timeout + 4) >> 2] : 0;
						timeoutInMillis = (tv_sec + tv_usec / 1000000) * 1000;
					}
					flags = stream.stream_ops.poll(stream, timeoutInMillis);
				}

				if (flags & 1 && check(fd, srcReadLow, srcReadHigh, mask)) {
					fd < 32
						? (dstReadLow = dstReadLow | mask)
						: (dstReadHigh = dstReadHigh | mask);
					total++;
				}
				if (flags & 4 && check(fd, srcWriteLow, srcWriteHigh, mask)) {
					fd < 32
						? (dstWriteLow = dstWriteLow | mask)
						: (dstWriteHigh = dstWriteHigh | mask);
					total++;
				}
				if (flags & 2 && check(fd, srcExceptLow, srcExceptHigh, mask)) {
					fd < 32
						? (dstExceptLow = dstExceptLow | mask)
						: (dstExceptHigh = dstExceptHigh | mask);
					total++;
				}
			}

			if (readfds) {
				HEAP32[readfds >> 2] = dstReadLow;
				HEAP32[(readfds + 4) >> 2] = dstReadHigh;
			}
			if (writefds) {
				HEAP32[writefds >> 2] = dstWriteLow;
				HEAP32[(writefds + 4) >> 2] = dstWriteHigh;
			}
			if (exceptfds) {
				HEAP32[exceptfds >> 2] = dstExceptLow;
				HEAP32[(exceptfds + 4) >> 2] = dstExceptHigh;
			}

			return total;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	};
	___syscall__newselect.sig = 'iipppp';

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
			// The incomming Module['websocket'] can be used for configuring
			// configuring subprotocol/url, etc
			SOCKFS.websocketArgs = Module['websocket'] || {};
			// Add the Event registration mechanism to the exported websocket configuration
			// object so we can register network callbacks from native JavaScript too.
			// For more documentation see system/include/emscripten/emscripten.h
			(Module['websocket'] ??= {})['on'] = SOCKFS.on;

			return FS.createNode(null, '/', 16895, 0);
		},
		createSocket(family, type, protocol) {
			// Emscripten only supports AF_INET
			if (family != 2) {
				throw new FS.ErrnoError(5);
			}
			type &= ~526336; // Some applications may pass it; it makes no sense for a single process.
			// Emscripten only supports SOCK_STREAM and SOCK_DGRAM
			if (type != 1 && type != 2) {
				throw new FS.ErrnoError(28);
			}
			var streaming = type == 1;
			if (streaming && protocol && protocol != 6) {
				throw new FS.ErrnoError(66); // if SOCK_STREAM, must be tcp or 0.
			}

			// create our internal socket structure
			var sock = {
				family,
				type,
				protocol,
				server: null,
				error: null, // Used in getsockopt for SOL_SOCKET/SO_ERROR test
				peers: {},
				pending: [],
				recv_queue: [],
				sock_ops: SOCKFS.websocket_sock_ops,
			};

			// create the filesystem node to store the socket structure
			var name = SOCKFS.nextname();
			var node = FS.createNode(SOCKFS.root, name, 49152, 0);
			node.sock = sock;

			// and the wrapping stream that enables library functions such
			// as read and write to indirectly interact with the socket
			var stream = FS.createStream({
				path: name,
				node,
				flags: 2,
				seekable: false,
				stream_ops: SOCKFS.stream_ops,
			});

			// map the new stream to the socket structure (sockets have a 1:1
			// relationship with a stream)
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
			read(stream, buffer, offset, length, position /* ignored */) {
				var sock = stream.node.sock;
				var msg = sock.sock_ops.recvmsg(sock, length);
				if (!msg) {
					// socket is closed
					return 0;
				}
				buffer.set(msg.buffer, offset);
				return msg.buffer.length;
			},
			write(stream, buffer, offset, length, position /* ignored */) {
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
					// for sockets that've already connected (e.g. we're the server)
					// we can inspect the _socket property for the address
					if (ws._socket) {
						addr = ws._socket.remoteAddress;
						port = ws._socket.remotePort;
					}
					// if we're just now initializing a connection to the remote,
					// inspect the url property
					else {
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
					// create the actual websocket object and connect
					try {
						// The default value is 'ws://' the replace is needed because the compiler replaces '//' comments with '#'
						// comments without checking context, so we'd end up with ws:#, the replace swaps the '#' for '//' again.
						var url = 'ws://'.replace('#', '//');
						// Make the WebSocket subprotocol (Sec-WebSocket-Protocol) default to binary if no configuration is set.
						var subProtocols = 'binary'; // The default value is 'binary'
						// The default WebSocket options
						var opts = undefined;

						// Fetch runtime WebSocket URL config.
						if ('function' === typeof SOCKFS.websocketArgs['url']) {
							url = SOCKFS.websocketArgs['url'](...arguments);
						} else if (
							'string' === typeof SOCKFS.websocketArgs['url']
						) {
							url = SOCKFS.websocketArgs['url'];
						}
						// Fetch runtime WebSocket subprotocol config.
						if (SOCKFS.websocketArgs['subprotocol']) {
							subProtocols = SOCKFS.websocketArgs['subprotocol'];
						} else if (
							SOCKFS.websocketArgs['subprotocol'] === null
						) {
							subProtocols = 'null';
						}

						if (url === 'ws://' || url === 'wss://') {
							// Is the supplied URL config just a prefix, if so complete it.
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
							// The regex trims the string (removes spaces at the beginning and end, then splits the string by
							// <any space>,<any space> into an Array. Whitespace removal is important for Websockify and ws.
							subProtocols = subProtocols
								.replace(/^ +| +$/g, '')
								.split(/ *, */);

							opts = subProtocols;
						}

						// If node we use the ws library.
						var WebSocketConstructor;
						if (ENVIRONMENT_IS_NODE) {
							WebSocketConstructor =
								/** @type{(typeof WebSocket)} */ (
									require('ws')
								);
						} else {
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

				var peer = {
					addr,
					port,
					socket: ws,
					msg_send_queue: [],
				};

				SOCKFS.websocket_sock_ops.addPeer(sock, peer);
				SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);

				// if this is a bound dgram socket, send the port number first to allow
				// us to override the ephemeral port reported to us by remotePort on the
				// remote end.
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
							(sock.sport & 0xff00) >> 8,
							sock.sport & 0xff,
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
						// not much we can do here in the way of proper error handling as we've already
						// lied and said this data was sent. shut it down.
						peer.socket.close();
					}
				};

				function handleMessage(data) {
					if (typeof data == 'string') {
						var encoder = new TextEncoder(); // should be utf-8
						data = encoder.encode(data); // make a typed array from the string
					} else {
						if (data.byteLength == 0) {
							// An empty ArrayBuffer will emit a pseudo disconnect event
							// as recv/recvmsg will return zero which indicates that a socket
							// has performed a shutdown although the connection has not been disconnected yet.
							return;
						}
						data = new Uint8Array(data); // make a typed array view on the array buffer
					}

					// if this is the port message, override the peer's port with it
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
						// update the peer's port and it's key in the peer map
						var newport = (data[8] << 8) | data[9];
						SOCKFS.websocket_sock_ops.removePeer(sock, peer);
						peer.port = newport;
						SOCKFS.websocket_sock_ops.addPeer(sock, peer);
						return;
					}

					sock.recv_queue.push({
						addr: peer.addr,
						port: peer.port,
						data: data,
					});
					SOCKFS.emit('message', sock.stream.fd);
				}

				if (ENVIRONMENT_IS_NODE) {
					peer.socket.on('open', handleOpen);
					peer.socket.on('message', function (data, isBinary) {
						if (!isBinary) {
							return;
						}
						handleMessage(new Uint8Array(data).buffer); // copy from node Buffer -> ArrayBuffer
					});
					peer.socket.on('close', function () {
						SOCKFS.emit('close', sock.stream.fd);
					});
					peer.socket.on('error', function (error) {
						// Although the ws library may pass errors that may be more descriptive than
						// ECONNREFUSED they are not necessarily the expected error code e.g.
						// ENOTFOUND on getaddrinfo seems to be node.js specific, so using ECONNREFUSED
						// is still probably the most useful thing to do.
						sock.error = 14; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
						SOCKFS.emit('error', [
							sock.stream.fd,
							sock.error,
							'ECONNREFUSED: Connection refused',
						]);
						// don't throw
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
						// The WebSocket spec only allows a 'simple event' to be thrown on error,
						// so we only really know as much as ECONNREFUSED.
						sock.error = 14; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
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
					// listen sockets should only say they're available for reading
					// if there are pending clients.
					return sock.pending.length ? 64 | 1 : 0;
				}

				var mask = 0;
				var dest =
					sock.type === 1 // we only care about the socket state for connection-based sockets
						? SOCKFS.websocket_sock_ops.getPeer(
								sock,
								sock.daddr,
								sock.dport
							)
						: null;

				if (
					sock.recv_queue.length ||
					!dest || // connection-less sockets are always ready to read
					(dest && dest.socket.readyState === dest.socket.CLOSING) ||
					(dest && dest.socket.readyState === dest.socket.CLOSED)
				) {
					// let recv return 0 once closed
					mask |= 64 | 1;
				}

				if (
					!dest || // connection-less sockets are always ready to write
					(dest && dest.socket.readyState === dest.socket.OPEN)
				) {
					mask |= 4;
				}

				if (
					(dest && dest.socket.readyState === dest.socket.CLOSING) ||
					(dest && dest.socket.readyState === dest.socket.CLOSED)
				) {
					// When an non-blocking connect fails mark the socket as writable.
					// Its up to the calling code to then use getsockopt with SO_ERROR to
					// retrieve the error.
					// See https://man7.org/linux/man-pages/man2/connect.2.html
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
				// if we've spawned a listen server, close it
				if (sock.server) {
					try {
						sock.server.close();
					} catch (e) {}
					sock.server = null;
				}
				// close any peer connections
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
					throw new FS.ErrnoError(28); // already bound
				}
				sock.saddr = addr;
				sock.sport = port;
				// in order to emulate dgram sockets, we need to launch a listen server when
				// binding on a connection-less socket
				// note: this is only required on the server side
				if (sock.type === 2) {
					// close the existing server if it exists
					if (sock.server) {
						sock.server.close();
						sock.server = null;
					}
					// swallow error operation not supported error that occurs when binding in the
					// browser where this isn't supported
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

				// TODO autobind
				// if (!sock.addr && sock.type == 2) {
				// }

				// early out if we're already connected / in the middle of connecting
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

				// add the socket to our peer list and set our
				// destination address / port to match
				var peer = SOCKFS.websocket_sock_ops.createPeer(
					sock,
					addr,
					port
				);
				sock.daddr = peer.addr;
				sock.dport = peer.port;

				// because we cannot synchronously block to wait for the WebSocket
				// connection to complete, we return here pretending that the connection
				// was a success.
				sock.connecting = true;
			},
			listen(sock, backlog) {
				if (!ENVIRONMENT_IS_NODE) {
					throw new FS.ErrnoError(138);
				}
				if (sock.server) {
					throw new FS.ErrnoError(28); // already listening
				}
				var WebSocketServer = require('ws').Server;
				var host = sock.saddr;
				if (Module['websocket']['serverDecorator']) {
					WebSocketServer =
						Module['websocket']['serverDecorator'](WebSocketServer);
				}
				sock.server = new WebSocketServer({
					host,
					port: sock.sport,
					// TODO support backlog
				});
				SOCKFS.emit('listen', sock.stream.fd); // Send Event with listen fd.

				sock.server.on('connection', function (ws) {
					if (sock.type === 1) {
						var newsock = SOCKFS.createSocket(
							sock.family,
							sock.type,
							sock.protocol
						);

						// create a peer on the new socket
						var peer = SOCKFS.websocket_sock_ops.createPeer(
							newsock,
							ws
						);
						newsock.daddr = peer.addr;
						newsock.dport = peer.port;

						// push to queue for accept to pick up
						sock.pending.push(newsock);
						SOCKFS.emit('connection', newsock.stream.fd);
					} else {
						// create a peer on the listen socket so calling sendto
						// with the listen socket and an address will resolve
						// to the correct client
						SOCKFS.websocket_sock_ops.createPeer(sock, ws);
						SOCKFS.emit('connection', sock.stream.fd);
					}
				});
				sock.server.on('close', function () {
					SOCKFS.emit('close', sock.stream.fd);
					sock.server = null;
				});
				sock.server.on('error', function (error) {
					// Although the ws library may pass errors that may be more descriptive than
					// ECONNREFUSED they are not necessarily the expected error code e.g.
					// ENOTFOUND on getaddrinfo seems to be node.js specific, so using EHOSTUNREACH
					// is still probably the most useful thing to do. This error shouldn't
					// occur in a well written app as errors should get trapped in the compiled
					// app's own getaddrinfo call.
					sock.error = 23; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
					SOCKFS.emit('error', [
						sock.stream.fd,
						sock.error,
						'EHOSTUNREACH: Host is unreachable',
					]);
					// don't throw
				});
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
					// TODO saddr and sport will be set for bind()'d UDP sockets, but what
					// should we be returning for TCP sockets that've been connect()'d?
					addr = sock.saddr || 0;
					port = sock.sport || 0;
				}
				return { addr, port };
			},
			sendmsg(sock, buffer, offset, length, addr, port) {
				if (sock.type === 2) {
					// connection-less sockets will honor the message address,
					// and otherwise fall back to the bound destination address
					if (addr === undefined || port === undefined) {
						addr = sock.daddr;
						port = sock.dport;
					}
					// if there was no address to fall back to, error out
					if (addr === undefined || port === undefined) {
						throw new FS.ErrnoError(17);
					}
				} else {
					// connection-based sockets will only use the bound
					addr = sock.daddr;
					port = sock.dport;
				}

				// find the peer for the destination address
				var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);

				// early out if not connected with a connection-based socket
				if (sock.type === 1) {
					if (
						!dest ||
						dest.socket.readyState === dest.socket.CLOSING ||
						dest.socket.readyState === dest.socket.CLOSED
					) {
						throw new FS.ErrnoError(53);
					}
				}

				// create a copy of the incoming data to send, as the WebSocket API
				// doesn't work entirely with an ArrayBufferView, it'll just send
				// the entire underlying buffer
				if (ArrayBuffer.isView(buffer)) {
					offset += buffer.byteOffset;
					buffer = buffer.buffer;
				}

				var data = buffer.slice(offset, offset + length);

				// if we don't have a cached connectionless UDP datagram connection, or
				// the TCP socket is still connecting, queue the message to be sent upon
				// connect, and lie, saying the data was sent now.
				if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
					// if we're not connected, open a new connection
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
					// send the actual data
					dest.socket.send(data);
					return length;
				} catch (e) {
					throw new FS.ErrnoError(28);
				}
			},
			recvmsg(sock, length, flags) {
				// http://pubs.opengroup.org/onlinepubs/7908799/xns/recvmsg.html
				if (sock.type === 1 && sock.server) {
					// tcp servers should not be recv()'ing on the listen socket
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
							// if we have a destination address but are not connected, error out
							throw new FS.ErrnoError(53);
						}
						if (
							dest.socket.readyState === dest.socket.CLOSING ||
							dest.socket.readyState === dest.socket.CLOSED
						) {
							// return null if the socket has closed
							return null;
						}
						// else, our socket is in a valid state but truly has nothing available
						throw new FS.ErrnoError(6);
					}
					throw new FS.ErrnoError(6);
				}

				// queued.data will be an ArrayBuffer if it's unadulterated, but if it's
				// requeued TCP data it'll be an ArrayBufferView
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

				// push back any unread data for TCP connections
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
		var w, offset, z, i;
		/* http://home.deds.nl/~aeron/regex/ */
		var valid6regx =
			/^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
		var parts = [];
		if (!valid6regx.test(str)) {
			return null;
		}
		if (str === '::') {
			return [0, 0, 0, 0, 0, 0, 0, 0];
		}
		// Z placeholder to keep track of zeros when splitting the string on ":"
		if (str.startsWith('::')) {
			str = str.replace('::', 'Z:'); // leading zeros case
		} else {
			str = str.replace('::', ':Z:');
		}

		if (str.indexOf('.') > 0) {
			// parse IPv4 embedded stress
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
					// compressed zeros - write appropriate number of zero words
					for (z = 0; z < 8 - words.length + 1; z++) {
						parts[w + z] = 0;
					}
					offset = z - 1;
				} else {
					// parse hex to field to 16-bit value and write it in network byte-order
					parts[w + offset] = _htons(parseInt(words[w], 16));
				}
			} else {
				// parsed IPv4 words
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

	/** @param {number=} addrlen */
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
		address_map: {
			id: 1,
			addrs: {},
			names: {},
		},
		lookup_name(name) {
			// If the name is already a valid ipv4 / ipv6 address, don't generate a fake one.
			var res = inetPton4(name);
			if (res !== null) {
				return name;
			}
			res = inetPton6(name);
			if (res !== null) {
				return name;
			}

			// See if this name is already mapped.
			var addr;

			if (DNS.address_map.addrs[name]) {
				addr = DNS.address_map.addrs[name];
			} else {
				var id = DNS.address_map.id++;

				addr = '172.29.' + (id & 0xff) + '.' + (id & 0xff00);

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
		(addr & 0xff) +
		'.' +
		((addr >> 8) & 0xff) +
		'.' +
		((addr >> 16) & 0xff) +
		'.' +
		((addr >> 24) & 0xff);

	var inetNtop6 = (ints) => {
		//  ref:  http://www.ietf.org/rfc/rfc2373.txt - section 2.5.4
		//  Format for IPv4 compatible and mapped  128-bit IPv6 Addresses
		//  128-bits are split into eight 16-bit words
		//  stored in network byte order (big-endian)
		//  |                80 bits               | 16 |      32 bits        |
		//  +-----------------------------------------------------------------+
		//  |               10 bytes               |  2 |      4 bytes        |
		//  +--------------------------------------+--------------------------+
		//  +               5 words                |  1 |      2 words        |
		//  +--------------------------------------+--------------------------+
		//  |0000..............................0000|0000|    IPv4 ADDRESS     | (compatible)
		//  +--------------------------------------+----+---------------------+
		//  |0000..............................0000|FFFF|    IPv4 ADDRESS     | (mapped)
		//  +--------------------------------------+----+---------------------+
		var str = '';
		var word = 0;
		var longest = 0;
		var lastzero = 0;
		var zstart = 0;
		var len = 0;
		var i = 0;
		var parts = [
			ints[0] & 0xffff,
			ints[0] >> 16,
			ints[1] & 0xffff,
			ints[1] >> 16,
			ints[2] & 0xffff,
			ints[2] >> 16,
			ints[3] & 0xffff,
			ints[3] >> 16,
		];

		// Handle IPv4-compatible, IPv4-mapped, loopback and any/unspecified addresses

		var hasipv4 = true;
		var v4part = '';
		// check if the 10 high-order bytes are all zeros (first 5 words)
		for (i = 0; i < 5; i++) {
			if (parts[i] !== 0) {
				hasipv4 = false;
				break;
			}
		}

		if (hasipv4) {
			// low-order 32-bits store an IPv4 address (bytes 13 to 16) (last 2 words)
			v4part = inetNtop4(parts[6] | (parts[7] << 16));
			// IPv4-mapped IPv6 address if 16-bit value (bytes 11 and 12) == 0xFFFF (6th word)
			if (parts[5] === -1) {
				str = '::ffff:';
				str += v4part;
				return str;
			}
			// IPv4-compatible IPv6 address if 16-bit value (bytes 11 and 12) == 0x0000 (6th word)
			if (parts[5] === 0) {
				str = '::';
				//special case IPv6 addresses
				if (v4part === '0.0.0.0') v4part = ''; // any/unspecified address
				if (v4part === '0.0.0.1') v4part = '1'; // loopback address
				str += v4part;
				return str;
			}
		}

		// Handle all other IPv6 addresses

		// first run to find the longest contiguous zero words
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
				// compress contiguous zeros - to produce "::"
				if (
					parts[word] === 0 &&
					word >= zstart &&
					word < zstart + longest
				) {
					if (word === zstart) {
						str += ':';
						if (zstart === 0) str += ':'; //leading zeros case
					}
					continue;
				}
			}
			// converts 16-bit words from big-endian to little-endian before converting to hex string
			str += Number(_ntohs(parts[word] & 0xffff)).toString(16);
			str += word < 7 ? ':' : '';
		}
		return str;
	};

	var readSockaddr = (sa, salen) => {
		// family / port offsets are common to both sockaddr_in and sockaddr_in6
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

	function ___syscall_connect(fd, addr, addrlen, d1, d2, d3) {
		try {
			var sock = getSocketFromFD(fd);
			var info = getSocketAddress(addr, addrlen);
			sock.sock_ops.connect(sock, info.addr, info.port);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
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
			// Check newfd is within range of valid open file descriptors.
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
				// need a valid mode
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
			if (
				perms /* otherwise, they've just passed F_OK */ &&
				FS.nodePermissions(node, perms)
			) {
				return -2;
			}
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_faccessat.sig = 'iipii';

	var ___syscall_fadvise64 = (fd, offset, len, advice) => 0;
	___syscall_fadvise64.sig = 'iijji';

	var INT53_MAX = 9007199254740992;

	var INT53_MIN = -9007199254740992;
	var bigintToI53Checked = (num) =>
		num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);
	function ___syscall_fallocate(fd, mode, offset, len) {
		offset = bigintToI53Checked(offset);
		len = bigintToI53Checked(len);

		try {
			if (isNaN(offset) || isNaN(len)) return -61;
			if (mode != 0) {
				return -138;
			}
			if (offset < 0 || len < 0) {
				return -28;
			}
			// We only support mode == 0, which means we can implement fallocate
			// in terms of ftruncate.
			var oldSize = FS.fstat(fd).size;
			var newSize = offset + len;
			if (newSize > oldSize) {
				FS.ftruncate(fd, newSize);
			}
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fallocate.sig = 'iiijj';

	function ___syscall_fchdir(fd) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			FS.chdir(stream.path);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fchdir.sig = 'ii';

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

	function ___syscall_fchmodat2(dirfd, path, mode, flags) {
		try {
			var nofollow = flags & 256;
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			FS.chmod(path, mode, nofollow);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fchmodat2.sig = 'iipii';

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
		// the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
		var ret = HEAP32[+SYSCALLS.varargs >> 2];
		SYSCALLS.varargs += 4;
		return ret;
	};
	var syscallGetVarargP = syscallGetVarargI;

	var allocateUTF8OnStack = (...args) => stringToUTF8OnStack(...args);

	var PHPWASM = {
		O_APPEND: 1024,
		O_NONBLOCK: 2048,
		POLLHUP: 16,
		SETFL_MASK: 3072,
		init: function (phpWasmInitOptions) {
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

			if (phpWasmInitOptions?.nativeInternalDirPath) {
				FS.mount(
					FS.filesystems.NODEFS,
					{ root: phpWasmInitOptions.nativeInternalDirPath },
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
					{ noent_okay: true }
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
	};

	function _js_getpid() {
		return PHPLoader.processId ?? 42;
	}

	function _js_wasm_trace(format, ...args) {
		if (PHPLoader.trace instanceof Function) {
			PHPLoader.trace(_js_getpid(), format, ...args);
		}
	}

	var _fd_close = function fd_close(fd) {
		return Asyncify.handleAsync(async () => {
			// We have to get the VFS path from the file descriptor
			// before closing it.
			const [vfsPath, vfsPathResolutionErrno] =
				locking.get_vfs_path_from_fd(fd);

			const fdCloseResult = _builtin_fd_close(fd);
			if (fdCloseResult !== 0 || !locking.maybeLockedFds.has(fd)) {
				_js_wasm_trace('fd_close(%d) result %d', fd, fdCloseResult);
				return fdCloseResult;
			}

			if (vfsPathResolutionErrno !== 0) {
				_js_wasm_trace(
					'fd_close(%d) get_vfs_path_from_fd error %d',
					fd,
					vfsPathResolutionErrno
				);
				/*
				 * It looks like the file may have had an associated lock,
				 * but since we cannot look up the path,
				 * there is nothing more for us to do.
				 *
				 * NOTE: This seems possible for files that are locked and
				 * then unlinked before close. It is an opportunity for a
				 * lock to be orphaned in the lock manager.
				 * @TODO: Explore how to ensure cleanup in this case.
				 */
				return fdCloseResult;
			}

			try {
				const nativeFilePath =
					locking.get_native_path_from_vfs_path(vfsPath);
				await PHPLoader.fileLockManager.releaseLocksForProcessFd(
					PHPLoader.processId,
					fd,
					nativeFilePath
				);
				_js_wasm_trace('fd_close(%d) release locks success', fd);
			} catch (e) {
				_js_wasm_trace("fd_close(%d) error '%s'", fd, e);
			} finally {
				locking.maybeLockedFds.delete(fd);
			}
			return fdCloseResult;
		});
	};
	_fd_close.sig = 'ii';
	function _builtin_fd_close(fd) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			FS.close(stream);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}

	function _builtin_fcntl64(fd, cmd, varargs) {
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
					return 0; // FD_CLOEXEC makes no sense for a single process.
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
					// We're always unlocked.
					HEAP16[(arg + offset) >> 1] = 2;
					return 0;
				}
				case 13:
				case 14:
					// Pretend that the locking is successful. These are process-level locks,
					// and Emscripten programs are a single process. If we supported linking a
					// filesystem between programs, we'd need to do more here.
					// See https://github.com/emscripten-core/emscripten/issues/23697
					return 0;
			}
			return -28;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

	var locking = {
		maybeLockedFds: new Set(),
		F_RDLCK: 0,
		F_WRLCK: 1,
		F_UNLCK: 2,
		lockStateToFcntl: {
			shared: 0,
			exclusive: 1,
			unlocked: 2,
		},
		fcntlToLockState: {
			0: 'shared',
			1: 'exclusive',
			2: 'unlocked',
		},
		is_path_to_shared_fs(path) {
			_js_wasm_trace('is_path_to_shared_fs(%s)', path);
			const { node } = FS.lookupPath(path, { noent_okay: true });
			if (!node) {
				return false;
			}
			if (node.mount.type !== PROXYFS) {
				return !!node.isSharedFS;
			}

			// This looks like a PROXYFS node. Let's try a lookup.
			const nodePath = PROXYFS.realPath(node);
			const backingFs = node?.mount?.opts?.fs;
			if (backingFs) {
				// Tolerate ENOENT because looking up a MEMFS node by path always fails.
				const { node: backingNode } = backingFs.lookupPath(nodePath, {
					noent_okay: true,
				});
				return !!backingNode?.isSharedFS;
			}

			return false;
		},
		get_fd_access_mode(fd) {
			const emscripten_F_GETFL = Number('3');
			const emscripten_O_ACCMODE = Number('2097155');

			return (
				_builtin_fcntl64(fd, emscripten_F_GETFL) & emscripten_O_ACCMODE
			);
		},
		get_vfs_path_from_fd(fd) {
			try {
				return [FS.readlink(`/proc/self/fd/${fd}`), 0];
			} catch (error) {
				return [null, ERRNO_CODES.EBADF];
			}
		},
		get_native_path_from_vfs_path(vfsPath) {
			const { node } = FS.lookupPath(vfsPath, {
				noent_okay: true,
			});
			if (!node) {
				throw new Error(`No node found for VFS path ${vfsPath}`);
			}
			if (node.mount.type === NODEFS) {
				return NODEFS.realPath(node);
			} else if (node.mount.type === PROXYFS) {
				// TODO: Tolerate ENOENT here?
				const { node: backingNode, path: backingPath } =
					node.mount.opts.fs.lookupPath(vfsPath);
				_js_wasm_trace(
					'backingNode for %s: %s',
					vfsPath,
					backingPath,
					backingNode
				);
				return backingNode.mount.type.realPath(backingNode);
			} else {
				throw new Error(
					`Unsupported filesystem type for path ${vfsPath}`
				);
			}
		},
		check_lock_params(fd, l_type) {
			const emscripten_O_RDONLY = Number('0');
			const emscripten_O_WRONLY = Number('1');

			const accessMode = locking.get_fd_access_mode(fd);
			if (
				(l_type === locking.F_WRLCK &&
					accessMode === emscripten_O_RDONLY) ||
				(l_type === locking.F_RDLCK &&
					accessMode === emscripten_O_WRONLY)
			) {
				return ERRNO_CODES.EBADF;
			}

			return 0;
		},
	};

	function ___syscall_fcntl64(fd, cmd, varargs) {
		if (!PHPLoader.fileLockManager) {
			return _builtin_fcntl64(fd, cmd, varargs);
		}
		return Asyncify.handleAsync(async () => {
			// Necessary to use varargs accessor
			SYSCALLS.varargs = varargs;

			// These constants are replaced by Emscripten during the build process
			const emscripten_F_SETFL = Number('4');
			const emscripten_F_GETLK = Number('12');
			const emscripten_F_SETLK = Number('13');
			const emscripten_F_SETLKW = Number('14');
			const emscripten_SEEK_SET = Number('0');

			// NOTE: With the exception of l_type, these offsets are not exposed to
			// JS by Emscripten, so we hardcode them here.
			const emscripten_flock_l_type_offset = 0;
			const emscripten_flock_l_whence_offset = 2;
			const emscripten_flock_l_start_offset = 8;
			const emscripten_flock_l_len_offset = 16;
			const emscripten_flock_l_pid_offset = 24;

			/**
			 * Read the flock struct at the given address.
			 *
			 * @param {bigint} flockStructAddress - the address of the flock struct
			 * @returns the flock struct
			 */
			function read_flock_struct(flockStructAddress) {
				/*
				 * NOTE: Since we are using HEAP<WORD_SIZE> vars like HEAP16 and HEAP64,
				 * we need to adjust offsets to address the word size of each HEAP.
				 *
				 * For example, an offset of 64 bytes is the following for each HEAP:
				 * - HEAP8: 64  (the 64th byte)
				 * - HEAP16: 32 (the 32nd 16-bit word)
				 * - HEAP32: 16 (the 16th 32-bit word)
				 * - HEAP64: 8  (the 8th 64-bit word)
				 *
				 * We get a word offset by dividing the byte offset by the word size.
				 */
				return {
					l_type: HEAP16[
						// Shift right by 1 to divide by 2^1.
						(flockStructAddress + emscripten_flock_l_type_offset) >>
							1
					],
					l_whence:
						HEAP16[
							// Shift right by 1 to divide by 2^1.
							(flockStructAddress +
								emscripten_flock_l_whence_offset) >>
								1
						],
					l_start:
						HEAP64[
							// Shift right by 3 to divide by 2^3.
							(flockStructAddress +
								emscripten_flock_l_start_offset) >>
								3
						],
					l_len: HEAP64[
						// Shift right by 3 to divide by 2^3.
						(flockStructAddress + emscripten_flock_l_len_offset) >>
							3
					],
					l_pid: HEAP32[
						// Shift right by 2 to divide by 2^2.
						(flockStructAddress + emscripten_flock_l_pid_offset) >>
							2
					],
				};
			}

			/**
			 * Update the flock struct at the given address with the given fields.
			 *
			 * @param {bigint} flockStructAddress - the address of the flock struct
			 * @param {object} fields - the fields to update
			 */
			function update_flock_struct(flockStructAddress, fields) {
				/*
				 * NOTE: Since we are using HEAP<WORD_SIZE> vars like HEAP16 and HEAP64,
				 * we need to adjust offsets to address the word size of each HEAP.
				 *
				 * For example, an offset of 64 bytes is the following for each HEAP:
				 * - HEAP8: 64  (the 64th byte)
				 * - HEAP16: 32 (the 32nd 16-bit word)
				 * - HEAP32: 16 (the 16th 32-bit word)
				 * - HEAP64: 8  (the 8th 64-bit word)
				 *
				 * We get a word offset by dividing the byte offset by the word size.
				 */
				if (fields.l_type !== undefined) {
					HEAP16[
						// Shift right by 1 to divide by 2^1.
						(flockStructAddress + emscripten_flock_l_type_offset) >>
							1
					] = fields.l_type;
				}
				if (fields.l_whence !== undefined) {
					HEAP16[
						// Shift right by 1 to divide by 2^1.
						(flockStructAddress +
							emscripten_flock_l_whence_offset) >>
							1
					] = fields.l_whence;
				}
				if (fields.l_start !== undefined) {
					HEAP64[
						// Shift right by 3 to divide by 2^3.
						(flockStructAddress +
							emscripten_flock_l_start_offset) >>
							3
					] = fields.l_start;
				}
				if (fields.l_len !== undefined) {
					HEAP64[
						// Shift right by 3 to divide by 2^3.
						(flockStructAddress + emscripten_flock_l_len_offset) >>
							3
					] = fields.l_len;
				}
				if (fields.l_pid !== undefined) {
					HEAP32[
						// Shift right by 2 to divide by 2^2.
						(flockStructAddress + emscripten_flock_l_pid_offset) >>
							2
					] = fields.l_pid;
				}
			}

			/**
			 * Resolve the base address of the range depending on the whence and start offset.
			 *
			 * @param {number} fd - the file descriptor
			 * @param {number} whence - what the start offset is relative to
			 * @param {bigint} startOffset - the offset from the whence
			 * @returns The resolved offset and the errno. If there is an error,
			 *          the resolved offset is null, and the errno is non-zero.
			 */
			function get_base_address(fd, whence, startOffset) {
				let baseAddress;
				switch (whence) {
					case emscripten_SEEK_SET:
						baseAddress = 0n;
						break;
					case emscripten_SEEK_CUR:
						baseAddress = FS.lseek(fd, 0, whence);
						break;
					case emscripten_SEEK_END:
						baseAddress = _wasm_get_end_offset(fd);
						break;
					default:
						return [null, ERRNO_CODES.EINVAL];
				}

				if (baseAddress == -1) {
					// We cannot resolve the offset within the file.
					// Let's treat this as a problem with the file descriptor.
					return [null, ERRNO_CODES.EBADF];
				}

				const resolvedOffset = baseAddress + startOffset;
				if (resolvedOffset < 0) {
					// This is not a valid offset. Report args as invalid.
					return [null, ERRNO_CODES.EINVAL];
				}

				return [resolvedOffset, 0];
			}

			const pid = PHPLoader.processId;
			switch (cmd) {
				case emscripten_F_GETLK: {
					_js_wasm_trace('fcntl(%d, F_GETLK)', fd);
					let vfsPath;
					let errno;

					[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s get_vfs_path_from_fd errno %d',
							fd,
							vfsPath,
							errno
						);
						return -ERRNO_CODES.EBADF;
					}

					const flockStructAddr = syscallGetVarargP();

					if (!locking.is_path_to_shared_fs(vfsPath)) {
						_js_wasm_trace(
							"fcntl(%d, F_GETLK) locking is not implemented for non-NodeFS path '%s'",
							fd,
							vfsPath
						);

						// If not a NodeFS path, we can't lock it.
						// Default to succeeding as Emscripten does.
						update_flock_struct(flockStructAddr, {
							l_type: F_UNLCK,
						});
						return 0;
					}

					const flockStruct = read_flock_struct(flockStructAddr);

					if (!(flockStruct.l_type in locking.fcntlToLockState)) {
						return -ERRNO_CODES.EINVAL;
					}

					errno = locking.check_lock_params(fd, flockStruct.l_type);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s check_lock_params errno %d',
							fd,
							vfsPath,
							errno
						);
						return -ERRNO_CODES.EINVAL;
					}

					const requestedLockType =
						locking.fcntlToLockState[flockStruct.l_type];
					let absoluteStartOffset;
					[absoluteStartOffset, errno] = get_base_address(
						fd,
						flockStruct.l_whence,
						flockStruct.l_start
					);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s get_base_address errno %d',
							fd,
							vfsPath,
							errno
						);
						return -ERRNO_CODES.EINVAL;
					}

					try {
						const nativeFilePath =
							locking.get_native_path_from_vfs_path(vfsPath);
						const conflictingLock = await Promise.resolve(
							PHPLoader.fileLockManager.findFirstConflictingByteRangeLock(
								nativeFilePath,
								{
									type: requestedLockType,
									start: absoluteStartOffset,
									end:
										absoluteStartOffset + flockStruct.l_len,
									pid,
								}
							)
						);
						if (conflictingLock === undefined) {
							_js_wasm_trace(
								'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock type=unlocked start=0x%x end=0x%x',
								fd,
								vfsPath,
								absoluteStartOffset,
								absoluteStartOffset + flockStruct.l_len
							);

							update_flock_struct(flockStructAddr, {
								l_type: F_UNLCK,
							});
							return 0;
						}

						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock type=%s start=0x%x end=0x%x conflictingLock %d',
							fd,
							vfsPath,
							conflictingLock.type,
							conflictingLock.start,
							conflictingLock.end,
							conflictingLock.pid
						);

						const fcntlLockState =
							locking.lockStateToFcntl[conflictingLock.type];
						update_flock_struct(flockStructAddr, {
							l_type: fcntlLockState,
							l_whence: emscripten_SEEK_SET,
							l_start: conflictingLock.start,
							l_len: conflictingLock.end - conflictingLock.start,
							l_pid: conflictingLock.pid,
						});
						return 0;
					} catch (e) {
						_js_wasm_trace(
							'fcntl(%d, F_GETLK) %s findFirstConflictingByteRangeLock error %s',
							fd,
							vfsPath,
							e
						);
						return -ERRNO_CODES.EINVAL;
					}
				}
				case emscripten_F_SETLK: {
					_js_wasm_trace('fcntl(%d, F_SETLK)', fd);
					let vfsPath;
					let errno;
					[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s get_vfs_path_from_fd errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					if (!locking.is_path_to_shared_fs(vfsPath)) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) locking is not implemented for non-NodeFS path %s',
							fd,
							vfsPath
						);

						// If not a NodeFS path, we can't lock it.
						// Default to succeeding as Emscripten does.
						return 0;
					}

					var flockStructAddr = syscallGetVarargP();
					const flockStruct = read_flock_struct(flockStructAddr);

					let absoluteStartOffset;
					[absoluteStartOffset, errno] = get_base_address(
						fd,
						flockStruct.l_whence,
						flockStruct.l_start
					);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s get_base_address errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					if (!(flockStruct.l_type in locking.fcntlToLockState)) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s invalid lock type %d',
							fd,
							vfsPath,
							flockStruct.l_type
						);
						return -ERRNO_CODES.EINVAL;
					}

					errno = locking.check_lock_params(fd, flockStruct.l_type);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s check_lock_params errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					locking.maybeLockedFds.add(fd);

					const requestedLockType =
						locking.fcntlToLockState[flockStruct.l_type];
					const rangeLock = {
						type: requestedLockType,
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
					};

					try {
						const nativeFilePath =
							locking.get_native_path_from_vfs_path(vfsPath);
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s calling lockFileByteRange for range lock %s',
							fd,
							vfsPath,
							rangeLock
						);

						const succeeded = await Promise.resolve(
							PHPLoader.fileLockManager.lockFileByteRange(
								nativeFilePath,
								rangeLock
							)
						);

						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s lockFileByteRange returned %d for range lock %s',
							fd,
							vfsPath,
							succeeded,
							rangeLock
						);
						return succeeded ? 0 : -ERRNO_CODES.EAGAIN;
					} catch (e) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLK) %s lockFileByteRange error %s for range lock %s',
							fd,
							vfsPath,
							e,
							rangeLock
						);
						return -ERRNO_CODES.EINVAL;
					}
				}
				// @TODO: Implement a blocking version of F_SETLKW instead of
				// treating it the same as F_SETLK.
				case emscripten_F_SETLKW: {
					// F_SETLKW is the blocking version of F_SETLK.
					// For now, we treat it the same as F_SETLK (non-blocking).
					// In a true blocking implementation, this would wait for the lock to become available.
					_js_wasm_trace('fcntl(%d, F_SETLKW)', fd);
					let vfsPath;
					let errno;
					[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) %s get_vfs_path_from_fd errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					if (!locking.is_path_to_shared_fs(vfsPath)) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) locking is not implemented for non-NodeFS path %s',
							fd,
							vfsPath
						);

						// If not a NodeFS path, we can't lock it.
						// Default to succeeding as Emscripten does.
						return 0;
					}

					var flockStructAddr = syscallGetVarargP();
					const flockStruct = read_flock_struct(flockStructAddr);

					let absoluteStartOffset;
					[absoluteStartOffset, errno] = get_base_address(
						fd,
						flockStruct.l_whence,
						flockStruct.l_start
					);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) %s get_base_address errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					if (!(flockStruct.l_type in locking.fcntlToLockState)) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) %s invalid lock type %d',
							fd,
							vfsPath,
							flockStruct.l_type
						);
						return -ERRNO_CODES.EINVAL;
					}

					errno = locking.check_lock_params(fd, flockStruct.l_type);
					if (errno !== 0) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) %s check_lock_params errno %d',
							fd,
							vfsPath,
							errno
						);
						return -errno;
					}

					locking.maybeLockedFds.add(fd);

					const requestedLockType =
						locking.fcntlToLockState[flockStruct.l_type];
					const rangeLock = {
						type: requestedLockType,
						start: absoluteStartOffset,
						end: absoluteStartOffset + flockStruct.l_len,
						pid,
					};

					try {
						const nativeFilePath =
							locking.get_native_path_from_vfs_path(vfsPath);
						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) %s calling lockFileByteRange for range lock %s',
							fd,
							vfsPath,
							rangeLock
						);

						const succeeded = await Promise.resolve(
							PHPLoader.fileLockManager.lockFileByteRange(
								nativeFilePath,
								rangeLock
							)
						);

						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) %s lockFileByteRange returned %d for range lock %s',
							fd,
							vfsPath,
							succeeded,
							rangeLock
						);
						return succeeded ? 0 : -ERRNO_CODES.EAGAIN;
					} catch (e) {
						_js_wasm_trace(
							'fcntl(%d, F_SETLKW) %s lockFileByteRange error %s for range lock %s',
							fd,
							vfsPath,
							e,
							rangeLock
						);
						return -ERRNO_CODES.EINVAL;
					}
				}
				case emscripten_F_SETFL: {
					/**
					 * Overrides the core Emscripten implementation to reflect what
					 * fcntl does in linux kernel. This implementation is still missing
					 * a bunch of nuance, but, unlike the core Emscripten implementation,
					 * it overrides the stream flags while preserving non-stream flags.
					 *
					 * @see fcntl.c:
					 * https://github.com/torvalds/linux/blob/a79a588fc1761dc12a3064fc2f648ae66cea3c5a/fs/fcntl.c#L39
					 */
					const arg = varargs ? syscallGetVarargI() : 0;
					const stream = SYSCALLS.getStreamFromFD(fd);

					// Update the stream flags
					stream.flags =
						(arg & PHPWASM.SETFL_MASK) |
						(stream.flags & ~PHPWASM.SETFL_MASK);

					return 0;
				}
				default:
					return _builtin_fcntl64(fd, cmd, varargs);
			}
		});
	}
	___syscall_fcntl64.sig = 'iiip';

	function ___syscall_fdatasync(fd) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			return 0; // we can't do anything synchronously; the in-memory FS is already synced to
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

	function ___syscall_fstatfs64(fd, size, buf) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			SYSCALLS.writeStatFs(buf, FS.statfsStream(stream));
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_fstatfs64.sig = 'iipp';

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
					type = 4; // DT_DIR
				} else if (name === '..') {
					var lookup = FS.lookupPath(stream.path, { parent: true });
					id = lookup.node.id;
					type = 4; // DT_DIR
				} else {
					var child;
					try {
						child = FS.lookupNode(stream.node, name);
					} catch (e) {
						// If the entry is not a directory, file, or symlink, nodefs
						// lookupNode will raise EINVAL. Skip these and continue.
						if (e?.errno === 28) {
							continue;
						}
						throw e;
					}
					id = child.id;
					type = FS.isChrdev(child.mode)
						? 2 // DT_CHR, character device.
						: FS.isDir(child.mode)
							? 4 // DT_DIR, directory.
							: FS.isLink(child.mode)
								? 10 // DT_LNK, symbolic link.
								: 8; // DT_REG, regular file.
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
				return -53; // The socket is not connected.
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
			// TODO: sock.saddr should never be undefined, see TODO in websocket_sock_ops.getname
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
			// Minimal getsockopt aimed at resolving https://github.com/emscripten-core/emscripten/issues/2211
			// so only supports SOL_SOCKET with SO_ERROR.
			if (level === 1) {
				if (optname === 4) {
					HEAP32[optval >> 2] = sock.error;
					HEAP32[optlen >> 2] = 4;
					sock.error = null; // Clear the error (The SO_ERROR option obtains and then clears this field).
					return 0;
				}
			}
			return -50; // The option is unknown at the level indicated.
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
					return 0; // no-op, not actually adjusting terminal settings
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
					return 0; // no-op, not actually adjusting terminal settings
				}
				case 21519: {
					if (!stream.tty) return -59;
					var argp = syscallGetVarargP();
					HEAP32[argp >> 2] = 0;
					return 0;
				}
				case 21520: {
					if (!stream.tty) return -59;
					return -28; // not supported
				}
				case 21537:
				case 21531: {
					var argp = syscallGetVarargP();
					return FS.ioctl(stream, op, argp);
				}
				case 21523: {
					// TODO: in theory we should write to the winsize struct that gets
					// passed in, but for now musl doesn't read anything on it
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
					// TODO: technically, this ioctl call should change the window size.
					// but, since emscripten doesn't have any concept of a terminal window
					// yet, we'll just silently throw it away as we do TIOCGWINSZ
					if (!stream.tty) return -59;
					return 0;
				}
				case 21515: {
					if (!stream.tty) return -59;
					return 0;
				}
				default:
					return -28; // not supported
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

	function ___syscall_mknodat(dirfd, path, mode, dev) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			// we don't want this in the JS API as it uses mknod to create all nodes.
			switch (mode & 61440) {
				case 32768:
				case 8192:
				case 24576:
				case 4096:
				case 49152:
					break;
				default:
					return -28;
			}
			FS.mknod(path, mode, dev);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_mknodat.sig = 'iipii';

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
			// Do not pollute the real root directory or its child nodes with pipes
			// Looks like it is OK to create another pseudo-root node not linked to the FS.root hierarchy this way
			return FS.createNode(null, '/', 16384 | 0o777, 0);
		},
		createPipe() {
			var pipe = {
				buckets: [],
				// refcnt 2 because pipe has a read end and a write end. We need to be
				// able to read from the read end after write end is closed.
				refcnt: 2,
				timestamp: new Date(),
			};

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
					mode: 0o10600,
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
			read(stream, buffer, offset, length, position /* ignored */) {
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
					// Do not generate excessive garbage in use cases such as
					// write several bytes, read everything, write several bytes, read everything...
					toRemove--;
					pipe.buckets[toRemove].offset = 0;
					pipe.buckets[toRemove].roffset = 0;
				}

				pipe.buckets.splice(0, toRemove);

				return totalRead;
			},
			write(stream, buffer, offset, length, position /* ignored */) {
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
			// readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
			// stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
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
			if (!msg) return 0; // socket is closed
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

	function ___syscall_recvmsg(fd, message, flags, d1, d2, d3) {
		try {
			var sock = getSocketFromFD(fd);
			var iov = HEAPU32[(message + 8) >> 2];
			var num = HEAP32[(message + 12) >> 2];
			// get the total amount of data we can read across all arrays
			var total = 0;
			for (var i = 0; i < num; i++) {
				total += HEAP32[(iov + (8 * i + 4)) >> 2];
			}
			// try to read total data
			var msg = sock.sock_ops.recvmsg(sock, total);
			if (!msg) return 0; // socket is closed

			// TODO honor flags:
			// MSG_OOB
			// Requests out-of-band data. The significance and semantics of out-of-band data are protocol-specific.
			// MSG_PEEK
			// Peeks at the incoming message.
			// MSG_WAITALL
			// Requests that the function block until the full amount of data requested can be returned. The function may return a smaller amount of data if a signal is caught, if the connection is terminated, if MSG_PEEK was specified, or if an error is pending for the socket.

			// write the source address out
			var name = HEAPU32[message >> 2];
			if (name) {
				var errno = writeSockaddr(
					name,
					sock.family,
					DNS.lookup_name(msg.addr),
					msg.port
				);
			}
			// write the buffer out to the scatter-gather arrays
			var bytesRead = 0;
			var bytesRemaining = msg.buffer.byteLength;
			for (var i = 0; bytesRemaining > 0 && i < num; i++) {
				var iovbase = HEAPU32[(iov + (8 * i + 0)) >> 2];
				var iovlen = HEAP32[(iov + (8 * i + 4)) >> 2];
				if (!iovlen) {
					continue;
				}
				var length = Math.min(iovlen, bytesRemaining);
				var buf = msg.buffer.subarray(bytesRead, bytesRead + length);
				HEAPU8.set(buf, iovbase + bytesRead);
				bytesRead += length;
				bytesRemaining -= length;
			}

			// TODO set msghdr.msg_flags
			// MSG_EOR
			// End of record was received (if supported by the protocol).
			// MSG_OOB
			// Out-of-band data was received.
			// MSG_TRUNC
			// Normal data was truncated.
			// MSG_CTRUNC

			return bytesRead;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_recvmsg.sig = 'iipiiii';

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

	function ___syscall_sendmsg(fd, message, flags, d1, d2, d3) {
		try {
			var sock = getSocketFromFD(fd);
			var iov = HEAPU32[(message + 8) >> 2];
			var num = HEAP32[(message + 12) >> 2];
			// read the address and port to send to
			var addr, port;
			var name = HEAPU32[message >> 2];
			var namelen = HEAP32[(message + 4) >> 2];
			if (name) {
				var info = getSocketAddress(name, namelen);
				port = info.port;
				addr = info.addr;
			}
			// concatenate scatter-gather arrays into one message buffer
			var total = 0;
			for (var i = 0; i < num; i++) {
				total += HEAP32[(iov + (8 * i + 4)) >> 2];
			}
			var view = new Uint8Array(total);
			var offset = 0;
			for (var i = 0; i < num; i++) {
				var iovbase = HEAPU32[(iov + (8 * i + 0)) >> 2];
				var iovlen = HEAP32[(iov + (8 * i + 4)) >> 2];
				for (var j = 0; j < iovlen; j++) {
					view[offset++] = HEAP8[iovbase + j];
				}
			}
			// write the buffer
			return sock.sock_ops.sendmsg(sock, view, 0, total, addr, port);
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_sendmsg.sig = 'iipippi';

	function ___syscall_sendto(fd, message, length, flags, addr, addr_len) {
		try {
			var sock = getSocketFromFD(fd);
			if (!addr) {
				// send, no address provided
				return FS.write(sock.stream, HEAP8, message, length);
			}
			var dest = getSocketAddress(addr, addr_len);
			// sendto an address
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

	function ___syscall_truncate64(path, length) {
		length = bigintToI53Checked(length);

		try {
			if (isNaN(length)) return -61;
			path = SYSCALLS.getStr(path);
			FS.truncate(path, length);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_truncate64.sig = 'ipj';

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

	var readI53FromI64 = (ptr) => {
		return HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296;
	};

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
					atime = seconds * 1000 + nanoseconds / (1000 * 1000);
				}
				times += 16;
				seconds = readI53FromI64(times);
				nanoseconds = HEAP32[(times + 8) >> 2];
				if (nanoseconds == 1073741823) {
					mtime = now;
				} else if (nanoseconds == 1073741822) {
					mtime = null;
				} else {
					mtime = seconds * 1000 + nanoseconds / (1000 * 1000);
				}
			}
			// null here means UTIME_OMIT was passed. If both were set to UTIME_OMIT then
			// we can skip the call completely.
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
		// void *dlopen(const char *file, int mode);
		// http://pubs.opengroup.org/onlinepubs/009695399/functions/dlopen.html
		var filename = UTF8ToString(handle + 36);
		var flags = HEAP32[(handle + 4) >> 2];
		filename = PATH.normalize(filename);
		var searchpaths = [];

		var global = Boolean(flags & 256);
		var localScope = global ? null : {};

		// We don't care about RTLD_NOW and RTLD_LAZY.
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
		// void *dlsym(void *restrict handle, const char *restrict name);
		// http://pubs.opengroup.org/onlinepubs/009695399/functions/dlsym.html
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
			// Asyncify wraps exports, and we need to look through those wrappers.
			if (result.orig) {
				result = result.orig;
			}
			var addr = getFunctionAddress(result);
			if (addr) {
				result = addr;
			} else {
				// Insert the function into the wasm table.  If its a direct wasm
				// function the second argument will not be needed.  If its a JS
				// function we rely on the `sig` attribute being set based on the
				// `<func>__sig` specified in library JS file.
				result = addFunction(result, result.sig);
				HEAPU32[symbolIndex >> 2] = newSymIndex;
			}
		}
		return result;
	};
	__dlsym_js.sig = 'pppp';

	var handleException = (e) => {
		// Certain exception types we do not treat as errors since they are used for
		// internal control flow.
		// 1. ExitStatus, which is thrown by exit()
		// 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
		//    that wish to return to JS event loop.
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
	_proc_exit.sig = 'vi';

	/** @param {boolean|number=} implicit */
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

	var runtimeKeepalivePush = () => {
		runtimeKeepaliveCounter += 1;
	};
	runtimeKeepalivePush.sig = 'v';

	var runtimeKeepalivePop = () => {
		runtimeKeepaliveCounter -= 1;
	};
	runtimeKeepalivePop.sig = 'v';

	var __emscripten_dlopen_js = (handle, onsuccess, onerror, user_data) => {
		/** @param {Object=} e */
		function errorCallback(e) {
			var filename = UTF8ToString(handle + 36);
			dlSetError(`'Could not load dynamic lib: ${filename}\n${e}`);
			runtimeKeepalivePop();
			callUserCallback(() =>
				getWasmTableEntry(onerror)(handle, user_data)
			);
		}
		function successCallback() {
			runtimeKeepalivePop();
			callUserCallback(() =>
				getWasmTableEntry(onsuccess)(handle, user_data)
			);
		}

		runtimeKeepalivePush();
		var promise = dlopenInternal(handle, { loadAsync: true });
		if (promise) {
			promise.then(successCallback, errorCallback);
		} else {
			errorCallback();
		}
	};
	__emscripten_dlopen_js.sig = 'vpppp';

	var getExecutableName = () => thisProgram || './this.program';

	var __emscripten_get_progname = (str, len) =>
		stringToUTF8(getExecutableName(), str, len);
	__emscripten_get_progname.sig = 'vpi';

	var jsStackTrace = () => new Error().stack.toString();
	/** @param {number=} flags */
	var getCallstack = (flags) => {
		var callstack = jsStackTrace();

		// Process all lines:
		var lines = callstack.split('\n');
		callstack = '';
		// Extract components of form:
		// '       Object._main@http://server.com:4324:12'
		var firefoxRe = new RegExp('\\s*(.*?)@(.*?):([0-9]+):([0-9]+)');
		// Extract components of form:
		// '    at Object._main (http://server.com/file.html:4324:12)'
		var chromeRe = new RegExp('\\s*at (.*?) \\\((.*):(.*):(.*)\\\)');

		for (var line of lines) {
			var symbolName = '';
			var file = '';
			var lineno = 0;
			var column = 0;

			var parts = chromeRe.exec(line);
			if (parts?.length == 5) {
				symbolName = parts[1];
				file = parts[2];
				lineno = parts[3];
				column = parts[4];
			} else {
				parts = firefoxRe.exec(line);
				if (parts?.length >= 4) {
					symbolName = parts[1];
					file = parts[2];
					lineno = parts[3];
					// Old Firefox doesn't carry column information, but in new FF30, it
					// is present. See https://bugzil.la/762556
					column = parts[4] | 0;
				} else {
					// Was not able to extract this line for demangling/sourcemapping
					// purposes. Output it as-is.
					callstack += line + '\n';
					continue;
				}
			}

			// Find the symbols in the callstack that corresponds to the functions that
			// report callstack information, and remove everything up to these from the
			// output.
			if (
				symbolName == '_emscripten_log' ||
				symbolName == '_emscripten_get_callstack'
			) {
				callstack = '';
				continue;
			}

			if (flags & 24) {
				if (flags & 64) {
					file = file.substring(
						file.replace(/\\/g, '/').lastIndexOf('/') + 1
					);
				}
				callstack += `    at ${symbolName} (${file}:${lineno}:${column})\n`;
			}
		}
		// Trim extra whitespace at the end of the output.
		callstack = callstack.replace(/\s+$/, '');
		return callstack;
	};

	var __emscripten_log_formatted = (flags, str) => {
		str = UTF8ToString(str);

		if (flags & 24) {
			str = str.replace(/\s+$/, ''); // Ensure the message and the callstack are joined cleanly with exactly one newline.
			str += (str.length > 0 ? '\n' : '') + getCallstack(flags);
		}

		if (flags & 1) {
			if (flags & 4) {
				console.error(str);
			} else if (flags & 2) {
				console.warn(str);
			} else if (flags & 512) {
				console.info(str);
			} else if (flags & 256) {
				console.debug(str);
			} else {
				console.log(str);
			}
		} else if (flags & 6) {
			err(str);
		} else {
			out(str);
		}
	};
	__emscripten_log_formatted.sig = 'vip';

	var __emscripten_lookup_name = (name) => {
		// uint32_t _emscripten_lookup_name(const char *name);
		var nameString = UTF8ToString(name);
		return inetPton4(DNS.lookup_name(nameString));
	};
	__emscripten_lookup_name.sig = 'ip';

	var __emscripten_runtime_keepalive_clear = () => {
		noExitRuntime = false;
		runtimeKeepaliveCounter = 0;
	};
	__emscripten_runtime_keepalive_clear.sig = 'v';

	var __emscripten_system = (command) => {
		if (ENVIRONMENT_IS_NODE) {
			if (!command) return 1; // shell is available

			var cmdstr = UTF8ToString(command);
			if (!cmdstr.length) return 0; // this is what glibc seems to do (shell works test?)

			var cp = require('child_process');
			var ret = cp.spawnSync(cmdstr, [], {
				shell: true,
				stdio: 'inherit',
			});

			var _W_EXITCODE = (ret, sig) => (ret << 8) | sig;

			// this really only can happen if process is killed by signal
			if (ret.status === null) {
				// sadly node doesn't expose such function
				var signalToNumber = (sig) => {
					// implement only the most common ones, and fallback to SIGINT
					switch (sig) {
						case 'SIGHUP':
							return 1;
						case 'SIGQUIT':
							return 3;
						case 'SIGFPE':
							return 8;
						case 'SIGKILL':
							return 9;
						case 'SIGALRM':
							return 14;
						case 'SIGTERM':
							return 15;
						default:
							return 2;
					}
				};
				return _W_EXITCODE(0, signalToNumber(ret.signal));
			}

			return _W_EXITCODE(ret.status, 0);
		}
		// int system(const char *command);
		// http://pubs.opengroup.org/onlinepubs/000095399/functions/system.html
		// Can't call external programs.
		if (!command) return 0; // no shell available
		return -52;
	};
	__emscripten_system.sig = 'ip';

	function __gmtime_js(time, tmPtr) {
		time = bigintToI53Checked(time);

		var date = new Date(time * 1000);
		HEAP32[tmPtr >> 2] = date.getUTCSeconds();
		HEAP32[(tmPtr + 4) >> 2] = date.getUTCMinutes();
		HEAP32[(tmPtr + 8) >> 2] = date.getUTCHours();
		HEAP32[(tmPtr + 12) >> 2] = date.getUTCDate();
		HEAP32[(tmPtr + 16) >> 2] = date.getUTCMonth();
		HEAP32[(tmPtr + 20) >> 2] = date.getUTCFullYear() - 1900;
		HEAP32[(tmPtr + 24) >> 2] = date.getUTCDay();
		var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
		var yday = ((date.getTime() - start) / (1000 * 60 * 60 * 24)) | 0;
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
		var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1; // -1 since it's days since Jan 1

		return yday;
	};

	function __localtime_js(time, tmPtr) {
		time = bigintToI53Checked(time);

		var date = new Date(time * 1000);
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

		// Attention: DST is in December in South, and some regions don't have DST at all.
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

			// There's an ambiguous hour when the time goes back; the tm_isdst field is
			// used to disambiguate it.  Date() basically guesses, so we fix it up if it
			// guessed wrong, or fill in tm_isdst with the guess if it's -1.
			var dst = HEAP32[(tmPtr + 32) >> 2];
			var guessedOffset = date.getTimezoneOffset();
			var start = new Date(date.getFullYear(), 0, 1);
			var summerOffset = new Date(
				date.getFullYear(),
				6,
				1
			).getTimezoneOffset();
			var winterOffset = start.getTimezoneOffset();
			var dstOffset = Math.min(winterOffset, summerOffset); // DST is in December in South
			if (dst < 0) {
				// Attention: some regions don't have DST at all.
				HEAP32[(tmPtr + 32) >> 2] = Number(
					summerOffset != winterOffset && dstOffset == guessedOffset
				);
			} else if (dst > 0 != (dstOffset == guessedOffset)) {
				var nonDstOffset = Math.max(winterOffset, summerOffset);
				var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
				// Don't try setMinutes(date.getMinutes() + ...) -- it's messed up.
				date.setTime(
					date.getTime() + (trueOffset - guessedOffset) * 60000
				);
			}

			HEAP32[(tmPtr + 24) >> 2] = date.getDay();
			var yday = ydayFromDate(date) | 0;
			HEAP32[(tmPtr + 28) >> 2] = yday;
			// To match expected behavior, update fields from date
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
			// Return time in microseconds
			return timeMs / 1000;
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

	function __msync_js(addr, len, prot, flags, fd, offset) {
		offset = bigintToI53Checked(offset);

		try {
			if (isNaN(offset)) return -61;
			SYSCALLS.doMsync(
				addr,
				SYSCALLS.getStreamFromFD(fd),
				len,
				flags,
				offset
			);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	__msync_js.sig = 'ippiiij';

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

	var _emscripten_get_now = () => performance.now();
	_emscripten_get_now.sig = 'd';
	var __setitimer_js = (which, timeout_ms) => {
		// First, clear any existing timer.
		if (timers[which]) {
			clearTimeout(timers[which].id);
			delete timers[which];
		}

		// A timeout of zero simply cancels the current timeout so we have nothing
		// more to do.
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

	var __timegm_js = function (tmPtr) {
		var ret = (() => {
			var time = Date.UTC(
				HEAP32[(tmPtr + 20) >> 2] + 1900,
				HEAP32[(tmPtr + 16) >> 2],
				HEAP32[(tmPtr + 12) >> 2],
				HEAP32[(tmPtr + 8) >> 2],
				HEAP32[(tmPtr + 4) >> 2],
				HEAP32[tmPtr >> 2],
				0
			);
			var date = new Date(time);

			HEAP32[(tmPtr + 24) >> 2] = date.getUTCDay();
			var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
			var yday = ((date.getTime() - start) / (1000 * 60 * 60 * 24)) | 0;
			HEAP32[(tmPtr + 28) >> 2] = yday;

			return date.getTime() / 1000;
		})();
		return BigInt(ret);
	};
	__timegm_js.sig = 'jp';

	var __tzset_js = (timezone, daylight, std_name, dst_name) => {
		// TODO: Use (malleable) environment variables instead of system settings.
		var currentYear = new Date().getFullYear();
		var winter = new Date(currentYear, 0, 1);
		var summer = new Date(currentYear, 6, 1);
		var winterOffset = winter.getTimezoneOffset();
		var summerOffset = summer.getTimezoneOffset();

		// Local standard timezone offset. Local standard time is not adjusted for
		// daylight savings.  This code uses the fact that getTimezoneOffset returns
		// a greater value during Standard Time versus Daylight Saving Time (DST).
		// Thus it determines the expected output during Standard Time, and it
		// compares whether the output of the given date the same (Standard) or less
		// (DST).
		var stdTimezoneOffset = Math.max(winterOffset, summerOffset);

		// timezone is specified as seconds west of UTC ("The external variable
		// `timezone` shall be set to the difference, in seconds, between
		// Coordinated Universal Time (UTC) and local standard time."), the same
		// as returned by stdTimezoneOffset.
		// See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
		HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;

		HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);

		var extractZone = (timezoneOffset) => {
			// Why inverse sign?
			// Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
			var sign = timezoneOffset >= 0 ? '-' : '+';

			var absOffset = Math.abs(timezoneOffset);
			var hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
			var minutes = String(absOffset % 60).padStart(2, '0');

			return `UTC${sign}${hours}${minutes}`;
		};

		var winterName = extractZone(winterOffset);
		var summerName = extractZone(summerOffset);
		if (summerOffset < winterOffset) {
			// Northern hemisphere
			stringToUTF8(winterName, std_name, 17);
			stringToUTF8(summerName, dst_name, 17);
		} else {
			stringToUTF8(winterName, dst_name, 17);
			stringToUTF8(summerName, std_name, 17);
		}
	};
	__tzset_js.sig = 'vpppp';

	var _emscripten_set_main_loop_timing = (mode, value) => {
		MainLoop.timingMode = mode;
		MainLoop.timingValue = value;

		if (!MainLoop.func) {
			return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
		}

		if (!MainLoop.running) {
			runtimeKeepalivePush();
			MainLoop.running = true;
		}
		if (mode == 0) {
			MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
				var timeUntilNextTick =
					Math.max(
						0,
						MainLoop.tickStartTime + value - _emscripten_get_now()
					) | 0;
				setTimeout(MainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
			};
			MainLoop.method = 'timeout';
		} else if (mode == 1) {
			MainLoop.scheduler = function MainLoop_scheduler_rAF() {
				MainLoop.requestAnimationFrame(MainLoop.runner);
			};
			MainLoop.method = 'rAF';
		} else if (mode == 2) {
			if (!MainLoop.setImmediate) {
				if (globalThis.setImmediate) {
					MainLoop.setImmediate = setImmediate;
				} else {
					// Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
					var setImmediates = [];
					var emscriptenMainLoopMessageId = 'setimmediate';
					/** @param {Event} event */
					var MainLoop_setImmediate_messageHandler = (event) => {
						// When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
						// so check for both cases.
						if (
							event.data === emscriptenMainLoopMessageId ||
							event.data.target === emscriptenMainLoopMessageId
						) {
							event.stopPropagation();
							setImmediates.shift()();
						}
					};
					addEventListener(
						'message',
						MainLoop_setImmediate_messageHandler,
						true
					);
					MainLoop.setImmediate =
						/** @type{function(function(): ?, ...?): number} */ (
							(func) => {
								setImmediates.push(func);
								if (ENVIRONMENT_IS_WORKER) {
									Module['setImmediates'] ??= [];
									Module['setImmediates'].push(func);
									postMessage({
										target: emscriptenMainLoopMessageId,
									}); // In --proxy-to-worker, route the message via proxyClient.js
								} else
									postMessage(
										emscriptenMainLoopMessageId,
										'*'
									); // On the main thread, can just send the message to itself.
							}
						);
				}
			}
			MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
				MainLoop.setImmediate(MainLoop.runner);
			};
			MainLoop.method = 'immediate';
		}
		return 0;
	};
	_emscripten_set_main_loop_timing.sig = 'iii';

	/**
	 * @param {number=} arg
	 * @param {boolean=} noSetTiming
	 */
	var setMainLoop = (
		iterFunc,
		fps,
		simulateInfiniteLoop,
		arg,
		noSetTiming
	) => {
		MainLoop.func = iterFunc;
		MainLoop.arg = arg;

		var thisMainLoopId = MainLoop.currentlyRunningMainloop;
		function checkIsRunning() {
			if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
				runtimeKeepalivePop();
				maybeExit();
				return false;
			}
			return true;
		}

		// We create the loop runner here but it is not actually running until
		// _emscripten_set_main_loop_timing is called (which might happen a
		// later time).  This member signifies that the current runner has not
		// yet been started so that we can call runtimeKeepalivePush when it
		// gets it timing set for the first time.
		MainLoop.running = false;
		MainLoop.runner = function MainLoop_runner() {
			if (ABORT) return;
			if (MainLoop.queue.length > 0) {
				var start = Date.now();
				var blocker = MainLoop.queue.shift();
				blocker.func(blocker.arg);
				if (MainLoop.remainingBlockers) {
					var remaining = MainLoop.remainingBlockers;
					var next =
						remaining % 1 == 0
							? remaining - 1
							: Math.floor(remaining);
					if (blocker.counted) {
						MainLoop.remainingBlockers = next;
					} else {
						// not counted, but move the progress along a tiny bit
						next = next + 0.5; // do not steal all the next one's progress
						MainLoop.remainingBlockers = (8 * remaining + next) / 9;
					}
				}
				MainLoop.updateStatus();

				// catches pause/resume main loop from blocker execution
				if (!checkIsRunning()) return;

				setTimeout(MainLoop.runner, 0);
				return;
			}

			// catch pauses from non-main loop sources
			if (!checkIsRunning()) return;

			// Implement very basic swap interval control
			MainLoop.currentFrameNumber = (MainLoop.currentFrameNumber + 1) | 0;
			if (
				MainLoop.timingMode == 1 &&
				MainLoop.timingValue > 1 &&
				MainLoop.currentFrameNumber % MainLoop.timingValue != 0
			) {
				// Not the scheduled time to render this frame - skip.
				MainLoop.scheduler();
				return;
			} else if (MainLoop.timingMode == 0) {
				MainLoop.tickStartTime = _emscripten_get_now();
			}

			MainLoop.runIter(iterFunc);

			// catch pauses from the main loop itself
			if (!checkIsRunning()) return;

			MainLoop.scheduler();
		};

		if (!noSetTiming) {
			if (fps > 0) {
				_emscripten_set_main_loop_timing(0, 1000.0 / fps);
			} else {
				// Do rAF by rendering each frame (no decimating)
				_emscripten_set_main_loop_timing(1, 1);
			}

			MainLoop.scheduler();
		}

		if (simulateInfiniteLoop) {
			throw 'unwind';
		}
	};

	var MainLoop = {
		running: false,
		scheduler: null,
		method: '',
		currentlyRunningMainloop: 0,
		func: null,
		arg: 0,
		timingMode: 0,
		timingValue: 0,
		currentFrameNumber: 0,
		queue: [],
		preMainLoop: [],
		postMainLoop: [],
		pause() {
			MainLoop.scheduler = null;
			// Incrementing this signals the previous main loop that it's now become old, and it must return.
			MainLoop.currentlyRunningMainloop++;
		},
		resume() {
			MainLoop.currentlyRunningMainloop++;
			var timingMode = MainLoop.timingMode;
			var timingValue = MainLoop.timingValue;
			var func = MainLoop.func;
			MainLoop.func = null;
			// do not set timing and call scheduler, we will do it on the next lines
			setMainLoop(func, 0, false, MainLoop.arg, true);
			_emscripten_set_main_loop_timing(timingMode, timingValue);
			MainLoop.scheduler();
		},
		updateStatus() {
			if (Module['setStatus']) {
				var message = Module['statusMessage'] || 'Please wait...';
				var remaining = MainLoop.remainingBlockers ?? 0;
				var expected = MainLoop.expectedBlockers ?? 0;
				if (remaining) {
					if (remaining < expected) {
						Module['setStatus'](
							`{message} ({expected - remaining}/{expected})`
						);
					} else {
						Module['setStatus'](message);
					}
				} else {
					Module['setStatus']('');
				}
			}
		},
		init() {
			Module['preMainLoop'] &&
				MainLoop.preMainLoop.push(Module['preMainLoop']);
			Module['postMainLoop'] &&
				MainLoop.postMainLoop.push(Module['postMainLoop']);
		},
		runIter(func) {
			if (ABORT) return;
			for (var pre of MainLoop.preMainLoop) {
				if (pre() === false) {
					return; // |return false| skips a frame
				}
			}
			callUserCallback(func);
			for (var post of MainLoop.postMainLoop) {
				post();
			}
		},
		nextRAF: 0,
		fakeRequestAnimationFrame(func) {
			// try to keep 60fps between calls to here
			var now = Date.now();
			if (MainLoop.nextRAF === 0) {
				MainLoop.nextRAF = now + 1000 / 60;
			} else {
				while (now + 2 >= MainLoop.nextRAF) {
					// fudge a little, to avoid timer jitter causing us to do lots of delay:0
					MainLoop.nextRAF += 1000 / 60;
				}
			}
			var delay = Math.max(MainLoop.nextRAF - now, 0);
			setTimeout(func, delay);
		},
		requestAnimationFrame(func) {
			if (globalThis.requestAnimationFrame) {
				requestAnimationFrame(func);
			} else {
				MainLoop.fakeRequestAnimationFrame(func);
			}
		},
	};

	var AL = {
		QUEUE_INTERVAL: 25,
		QUEUE_LOOKAHEAD: 0.1,
		DEVICE_NAME: 'Emscripten OpenAL',
		CAPTURE_DEVICE_NAME: 'Emscripten OpenAL capture',
		ALC_EXTENSIONS: {
			ALC_SOFT_pause_device: true,
			ALC_SOFT_HRTF: true,
		},
		AL_EXTENSIONS: {
			AL_EXT_float32: true,
			AL_SOFT_loop_points: true,
			AL_SOFT_source_length: true,
			AL_EXT_source_distance_model: true,
			AL_SOFT_source_spatialize: true,
		},
		_alcErr: 0,
		alcErr: 0,
		deviceRefCounts: {},
		alcStringCache: {},
		paused: false,
		stringCache: {},
		contexts: {},
		currentCtx: null,
		buffers: {
			0: {
				id: 0,
				refCount: 0,
				audioBuf: null,
				frequency: 0,
				bytesPerSample: 2,
				channels: 1,
				length: 0,
			},
		},
		paramArray: [],
		_nextId: 1,
		newId: () => (AL.freeIds.length > 0 ? AL.freeIds.pop() : AL._nextId++),
		freeIds: [],
		scheduleContextAudio: (ctx) => {
			// If we are animating using the requestAnimationFrame method, then the main loop does not run when in the background.
			// To give a perfect glitch-free audio stop when switching from foreground to background, we need to avoid updating
			// audio altogether when in the background, so detect that case and kill audio buffer streaming if so.
			if (
				MainLoop.timingMode === 1 &&
				document['visibilityState'] != 'visible'
			) {
				return;
			}

			for (var i in ctx.sources) {
				AL.scheduleSourceAudio(ctx.sources[i]);
			}
		},
		scheduleSourceAudio: (src, lookahead) => {
			// See comment on scheduleContextAudio above.
			if (
				MainLoop.timingMode === 1 &&
				document['visibilityState'] != 'visible'
			) {
				return;
			}
			if (src.state !== 4114) {
				return;
			}

			var currentTime = AL.updateSourceTime(src);

			var startTime = src.bufStartTime;
			var startOffset = src.bufOffset;
			var bufCursor = src.bufsProcessed;

			// Advance past any audio that is already scheduled
			for (var i = 0; i < src.audioQueue.length; i++) {
				var audioSrc = src.audioQueue[i];
				startTime = audioSrc._startTime + audioSrc._duration;
				startOffset = 0.0;
				bufCursor += audioSrc._skipCount + 1;
			}

			if (!lookahead) {
				lookahead = AL.QUEUE_LOOKAHEAD;
			}
			var lookaheadTime = currentTime + lookahead;
			var skipCount = 0;
			while (startTime < lookaheadTime) {
				if (bufCursor >= src.bufQueue.length) {
					if (src.looping) {
						bufCursor %= src.bufQueue.length;
					} else {
						break;
					}
				}

				var buf = src.bufQueue[bufCursor % src.bufQueue.length];
				// If the buffer contains no data, skip it
				if (buf.length === 0) {
					skipCount++;
					// If we've gone through the whole queue and everything is 0 length, just give up
					if (skipCount === src.bufQueue.length) {
						break;
					}
				} else {
					var audioSrc = src.context.audioCtx.createBufferSource();
					audioSrc.buffer = buf.audioBuf;
					audioSrc.playbackRate.value = src.playbackRate;
					if (buf.audioBuf._loopStart || buf.audioBuf._loopEnd) {
						audioSrc.loopStart = buf.audioBuf._loopStart;
						audioSrc.loopEnd = buf.audioBuf._loopEnd;
					}

					var duration = 0.0;
					// If the source is a looping static buffer, use native looping for gapless playback
					if (src.type === 4136 && src.looping) {
						duration = Number.POSITIVE_INFINITY;
						audioSrc.loop = true;
						if (buf.audioBuf._loopStart) {
							audioSrc.loopStart = buf.audioBuf._loopStart;
						}
						if (buf.audioBuf._loopEnd) {
							audioSrc.loopEnd = buf.audioBuf._loopEnd;
						}
					} else {
						duration =
							(buf.audioBuf.duration - startOffset) /
							src.playbackRate;
					}

					audioSrc._startOffset = startOffset;
					audioSrc._duration = duration;
					audioSrc._skipCount = skipCount;
					skipCount = 0;

					audioSrc.connect(src.gain);

					if (typeof audioSrc.start != 'undefined') {
						// Sample the current time as late as possible to mitigate drift
						startTime = Math.max(
							startTime,
							src.context.audioCtx.currentTime
						);
						audioSrc.start(startTime, startOffset);
					} else if (typeof audioSrc.noteOn != 'undefined') {
						startTime = Math.max(
							startTime,
							src.context.audioCtx.currentTime
						);
						audioSrc.noteOn(startTime);
					}
					audioSrc._startTime = startTime;
					src.audioQueue.push(audioSrc);

					startTime += duration;
				}

				startOffset = 0.0;
				bufCursor++;
			}
		},
		updateSourceTime: (src) => {
			var currentTime = src.context.audioCtx.currentTime;
			if (src.state !== 4114) {
				return currentTime;
			}

			// if the start time is unset, determine it based on the current offset.
			// This will be the case when a source is resumed after being paused, and
			// allows us to pretend that the source actually started playing some time
			// in the past such that it would just now have reached the stored offset.
			if (!isFinite(src.bufStartTime)) {
				src.bufStartTime =
					currentTime - src.bufOffset / src.playbackRate;
				src.bufOffset = 0.0;
			}

			var nextStartTime = 0.0;
			while (src.audioQueue.length) {
				var audioSrc = src.audioQueue[0];
				src.bufsProcessed += audioSrc._skipCount;
				nextStartTime = audioSrc._startTime + audioSrc._duration; // n.b. audioSrc._duration already factors in playbackRate, so no divide by src.playbackRate on it.

				if (currentTime < nextStartTime) {
					break;
				}

				src.audioQueue.shift();
				src.bufStartTime = nextStartTime;
				src.bufOffset = 0.0;
				src.bufsProcessed++;
			}

			if (src.bufsProcessed >= src.bufQueue.length && !src.looping) {
				// The source has played its entire queue and is non-looping, so just mark it as stopped.
				AL.setSourceState(src, 4116);
			} else if (src.type === 4136 && src.looping) {
				// If the source is a looping static buffer, determine the buffer offset based on the loop points
				var buf = src.bufQueue[0];
				if (buf.length === 0) {
					src.bufOffset = 0.0;
				} else {
					var delta =
						(currentTime - src.bufStartTime) * src.playbackRate;
					var loopStart = buf.audioBuf._loopStart || 0.0;
					var loopEnd =
						buf.audioBuf._loopEnd || buf.audioBuf.duration;
					if (loopEnd <= loopStart) {
						loopEnd = buf.audioBuf.duration;
					}

					if (delta < loopEnd) {
						src.bufOffset = delta;
					} else {
						src.bufOffset =
							loopStart +
							((delta - loopStart) % (loopEnd - loopStart));
					}
				}
			} else if (src.audioQueue[0]) {
				// The source is still actively playing, so we just need to calculate where we are in the current buffer
				// so it can be remembered if the source gets paused.
				src.bufOffset =
					(currentTime - src.audioQueue[0]._startTime) *
					src.playbackRate;
			} else {
				// The source hasn't finished yet, but there is no scheduled audio left for it. This can be because
				// the source has just been started/resumed, or due to an underrun caused by a long blocking operation.
				// We need to determine what state we would be in by this point in time so that when we next schedule
				// audio playback, it will be just as if no underrun occurred.

				if (src.type !== 4136 && src.looping) {
					// if the source is a looping buffer queue, let's first calculate the queue duration, so we can
					// quickly fast forward past any full loops of the queue and only worry about the remainder.
					var srcDuration = AL.sourceDuration(src) / src.playbackRate;
					if (srcDuration > 0.0) {
						src.bufStartTime +=
							Math.floor(
								(currentTime - src.bufStartTime) / srcDuration
							) * srcDuration;
					}
				}

				// Since we've already skipped any full-queue loops if there were any, we just need to find
				// out where in the queue the remaining time puts us, which won't require stepping through the
				// entire queue more than once.
				for (var i = 0; i < src.bufQueue.length; i++) {
					if (src.bufsProcessed >= src.bufQueue.length) {
						if (src.looping) {
							src.bufsProcessed %= src.bufQueue.length;
						} else {
							AL.setSourceState(src, 4116);
							break;
						}
					}

					var buf = src.bufQueue[src.bufsProcessed];
					if (buf.length > 0) {
						nextStartTime =
							src.bufStartTime +
							buf.audioBuf.duration / src.playbackRate;

						if (currentTime < nextStartTime) {
							src.bufOffset =
								(currentTime - src.bufStartTime) *
								src.playbackRate;
							break;
						}

						src.bufStartTime = nextStartTime;
					}

					src.bufOffset = 0.0;
					src.bufsProcessed++;
				}
			}

			return currentTime;
		},
		cancelPendingSourceAudio: (src) => {
			AL.updateSourceTime(src);

			for (var i = 1; i < src.audioQueue.length; i++) {
				var audioSrc = src.audioQueue[i];
				audioSrc.stop();
			}

			if (src.audioQueue.length > 1) {
				src.audioQueue.length = 1;
			}
		},
		stopSourceAudio: (src) => {
			for (var i = 0; i < src.audioQueue.length; i++) {
				src.audioQueue[i].stop();
			}
			src.audioQueue.length = 0;
		},
		setSourceState: (src, state) => {
			if (state === 4114) {
				if (src.state === 4114 || src.state == 4116) {
					src.bufsProcessed = 0;
					src.bufOffset = 0.0;
				} else {
				}

				AL.stopSourceAudio(src);

				src.state = 4114;
				src.bufStartTime = Number.NEGATIVE_INFINITY;
				AL.scheduleSourceAudio(src);
			} else if (state === 4115) {
				if (src.state === 4114) {
					// Store off the current offset to restore with on resume.
					AL.updateSourceTime(src);
					AL.stopSourceAudio(src);

					src.state = 4115;
				}
			} else if (state === 4116) {
				if (src.state !== 4113) {
					src.state = 4116;
					src.bufsProcessed = src.bufQueue.length;
					src.bufStartTime = Number.NEGATIVE_INFINITY;
					src.bufOffset = 0.0;
					AL.stopSourceAudio(src);
				}
			} else if (state === 4113) {
				if (src.state !== 4113) {
					src.state = 4113;
					src.bufsProcessed = 0;
					src.bufStartTime = Number.NEGATIVE_INFINITY;
					src.bufOffset = 0.0;
					AL.stopSourceAudio(src);
				}
			}
		},
		initSourcePanner: (src) => {
			if (src.type === 0x1030 /* AL_UNDETERMINED */) {
				return;
			}

			// Find the first non-zero buffer in the queue to determine the proper format
			var templateBuf = AL.buffers[0];
			for (var i = 0; i < src.bufQueue.length; i++) {
				if (src.bufQueue[i].id !== 0) {
					templateBuf = src.bufQueue[i];
					break;
				}
			}
			// Create a panner if AL_SOURCE_SPATIALIZE_SOFT is set to true, or alternatively if it's set to auto and the source is mono
			if (
				src.spatialize === 1 ||
				(src.spatialize === 2 /* AL_AUTO_SOFT */ &&
					templateBuf.channels === 1)
			) {
				if (src.panner) {
					return;
				}
				src.panner = src.context.audioCtx.createPanner();

				AL.updateSourceGlobal(src);
				AL.updateSourceSpace(src);

				src.panner.connect(src.context.gain);
				src.gain.disconnect();
				src.gain.connect(src.panner);
			} else {
				if (!src.panner) {
					return;
				}

				src.panner.disconnect();
				src.gain.disconnect();
				src.gain.connect(src.context.gain);
				src.panner = null;
			}
		},
		updateContextGlobal: (ctx) => {
			for (var i in ctx.sources) {
				AL.updateSourceGlobal(ctx.sources[i]);
			}
		},
		updateSourceGlobal: (src) => {
			var panner = src.panner;
			if (!panner) {
				return;
			}

			panner.refDistance = src.refDistance;
			panner.maxDistance = src.maxDistance;
			panner.rolloffFactor = src.rolloffFactor;

			panner.panningModel = src.context.hrtf ? 'HRTF' : 'equalpower';

			// Use the source's distance model if AL_SOURCE_DISTANCE_MODEL is enabled
			var distanceModel = src.context.sourceDistanceModel
				? src.distanceModel
				: src.context.distanceModel;
			switch (distanceModel) {
				case 0:
					panner.distanceModel = 'inverse';
					panner.refDistance = 3.40282e38 /* FLT_MAX */;
					break;
				case 0xd001 /* AL_INVERSE_DISTANCE */:
				case 0xd002 /* AL_INVERSE_DISTANCE_CLAMPED */:
					panner.distanceModel = 'inverse';
					break;
				case 0xd003 /* AL_LINEAR_DISTANCE */:
				case 0xd004 /* AL_LINEAR_DISTANCE_CLAMPED */:
					panner.distanceModel = 'linear';
					break;
				case 0xd005 /* AL_EXPONENT_DISTANCE */:
				case 0xd006 /* AL_EXPONENT_DISTANCE_CLAMPED */:
					panner.distanceModel = 'exponential';
					break;
			}
		},
		updateListenerSpace: (ctx) => {
			var listener = ctx.audioCtx.listener;
			if (listener.positionX) {
				listener.positionX.value = ctx.listener.position[0];
				listener.positionY.value = ctx.listener.position[1];
				listener.positionZ.value = ctx.listener.position[2];
			} else {
				listener.setPosition(
					ctx.listener.position[0],
					ctx.listener.position[1],
					ctx.listener.position[2]
				);
			}
			if (listener.forwardX) {
				listener.forwardX.value = ctx.listener.direction[0];
				listener.forwardY.value = ctx.listener.direction[1];
				listener.forwardZ.value = ctx.listener.direction[2];
				listener.upX.value = ctx.listener.up[0];
				listener.upY.value = ctx.listener.up[1];
				listener.upZ.value = ctx.listener.up[2];
			} else {
				listener.setOrientation(
					ctx.listener.direction[0],
					ctx.listener.direction[1],
					ctx.listener.direction[2],
					ctx.listener.up[0],
					ctx.listener.up[1],
					ctx.listener.up[2]
				);
			}

			// Update sources that are relative to the listener
			for (var i in ctx.sources) {
				AL.updateSourceSpace(ctx.sources[i]);
			}
		},
		updateSourceSpace: (src) => {
			if (!src.panner) {
				return;
			}
			var panner = src.panner;

			var posX = src.position[0];
			var posY = src.position[1];
			var posZ = src.position[2];
			var dirX = src.direction[0];
			var dirY = src.direction[1];
			var dirZ = src.direction[2];

			var listener = src.context.listener;
			var lPosX = listener.position[0];
			var lPosY = listener.position[1];
			var lPosZ = listener.position[2];

			// WebAudio does spatialization in world-space coordinates, meaning both the buffer sources and
			// the listener position are in the same absolute coordinate system relative to a fixed origin.
			// By default, OpenAL works this way as well, but it also provides a "listener relative" mode, where
			// a buffer source's coordinate are interpreted not in absolute world space, but as being relative
			// to the listener object itself, so as the listener moves the source appears to move with it
			// with no update required. Since web audio does not support this mode, we must transform the source
			// coordinates from listener-relative space to absolute world space.
			//
			// We do this via affine transformation matrices applied to the source position and source direction.
			// A change-of-basis converts from listener-space displacements to world-space displacements,
			// which must be done for both the source position and direction. Lastly, the source position must be
			// added to the listener position to get the final source position, since the source position represents
			// a displacement from the listener.
			if (src.relative) {
				// Negate the listener direction since forward is -Z.
				var lBackX = -listener.direction[0];
				var lBackY = -listener.direction[1];
				var lBackZ = -listener.direction[2];
				var lUpX = listener.up[0];
				var lUpY = listener.up[1];
				var lUpZ = listener.up[2];

				var inverseMagnitude = (x, y, z) => {
					var length = Math.sqrt(x * x + y * y + z * z);

					if (length < Number.EPSILON) {
						return 0.0;
					}

					return 1.0 / length;
				};

				// Normalize the Back vector
				var invMag = inverseMagnitude(lBackX, lBackY, lBackZ);
				lBackX *= invMag;
				lBackY *= invMag;
				lBackZ *= invMag;

				// ...and the Up vector
				invMag = inverseMagnitude(lUpX, lUpY, lUpZ);
				lUpX *= invMag;
				lUpY *= invMag;
				lUpZ *= invMag;

				// Calculate the Right vector as the cross product of the Up and Back vectors
				var lRightX = lUpY * lBackZ - lUpZ * lBackY;
				var lRightY = lUpZ * lBackX - lUpX * lBackZ;
				var lRightZ = lUpX * lBackY - lUpY * lBackX;

				// Back and Up might not be exactly perpendicular, so the cross product also needs normalization
				invMag = inverseMagnitude(lRightX, lRightY, lRightZ);
				lRightX *= invMag;
				lRightY *= invMag;
				lRightZ *= invMag;

				// Recompute Up from the now orthonormal Right and Back vectors so we have a fully orthonormal basis
				lUpX = lBackY * lRightZ - lBackZ * lRightY;
				lUpY = lBackZ * lRightX - lBackX * lRightZ;
				lUpZ = lBackX * lRightY - lBackY * lRightX;

				var oldX = dirX;
				var oldY = dirY;
				var oldZ = dirZ;

				// Use our 3 vectors to apply a change-of-basis matrix to the source direction
				dirX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
				dirY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
				dirZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;

				oldX = posX;
				oldY = posY;
				oldZ = posZ;

				// ...and to the source position
				posX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
				posY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
				posZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;

				// The change-of-basis corrects the orientation, but the origin is still the listener.
				// Translate the source position by the listener position to finish.
				posX += lPosX;
				posY += lPosY;
				posZ += lPosZ;
			}

			if (panner.positionX) {
				// Assigning to panner.positionX/Y/Z unnecessarily seems to cause performance issues
				// See https://github.com/emscripten-core/emscripten/issues/15847

				if (posX != panner.positionX.value)
					panner.positionX.value = posX;
				if (posY != panner.positionY.value)
					panner.positionY.value = posY;
				if (posZ != panner.positionZ.value)
					panner.positionZ.value = posZ;
			} else {
				panner.setPosition(posX, posY, posZ);
			}
			if (panner.orientationX) {
				// Assigning to panner.orientation/Y/Z unnecessarily seems to cause performance issues
				// See https://github.com/emscripten-core/emscripten/issues/15847

				if (dirX != panner.orientationX.value)
					panner.orientationX.value = dirX;
				if (dirY != panner.orientationY.value)
					panner.orientationY.value = dirY;
				if (dirZ != panner.orientationZ.value)
					panner.orientationZ.value = dirZ;
			} else {
				panner.setOrientation(dirX, dirY, dirZ);
			}

			var oldShift = src.dopplerShift;
			var velX = src.velocity[0];
			var velY = src.velocity[1];
			var velZ = src.velocity[2];
			var lVelX = listener.velocity[0];
			var lVelY = listener.velocity[1];
			var lVelZ = listener.velocity[2];
			if (
				(posX === lPosX && posY === lPosY && posZ === lPosZ) ||
				(velX === lVelX && velY === lVelY && velZ === lVelZ)
			) {
				src.dopplerShift = 1.0;
			} else {
				// Doppler algorithm from 1.1 spec
				var speedOfSound = src.context.speedOfSound;
				var dopplerFactor = src.context.dopplerFactor;

				var slX = lPosX - posX;
				var slY = lPosY - posY;
				var slZ = lPosZ - posZ;

				var magSl = Math.sqrt(slX * slX + slY * slY + slZ * slZ);
				var vls = (slX * lVelX + slY * lVelY + slZ * lVelZ) / magSl;
				var vss = (slX * velX + slY * velY + slZ * velZ) / magSl;

				vls = Math.min(vls, speedOfSound / dopplerFactor);
				vss = Math.min(vss, speedOfSound / dopplerFactor);

				src.dopplerShift =
					(speedOfSound - dopplerFactor * vls) /
					(speedOfSound - dopplerFactor * vss);
			}
			if (src.dopplerShift !== oldShift) {
				AL.updateSourceRate(src);
			}
		},
		updateSourceRate: (src) => {
			if (src.state === 4114) {
				// clear scheduled buffers
				AL.cancelPendingSourceAudio(src);

				var audioSrc = src.audioQueue[0];
				if (!audioSrc) {
					return; // It is possible that AL.scheduleContextAudio() has not yet fed the next buffer, if so, skip.
				}

				var duration;
				if (src.type === 4136 && src.looping) {
					duration = Number.POSITIVE_INFINITY;
				} else {
					// audioSrc._duration is expressed after factoring in playbackRate, so when changing playback rate, need
					// to recompute/rescale the rate to the new playback speed.
					duration =
						(audioSrc.buffer.duration - audioSrc._startOffset) /
						src.playbackRate;
				}

				audioSrc._duration = duration;
				audioSrc.playbackRate.value = src.playbackRate;

				// reschedule buffers with the new playbackRate
				AL.scheduleSourceAudio(src);
			}
		},
		sourceDuration: (src) => {
			var length = 0.0;
			for (var i = 0; i < src.bufQueue.length; i++) {
				var audioBuf = src.bufQueue[i].audioBuf;
				length += audioBuf ? audioBuf.duration : 0.0;
			}
			return length;
		},
		sourceTell: (src) => {
			AL.updateSourceTime(src);

			var offset = 0.0;
			for (var i = 0; i < src.bufsProcessed; i++) {
				if (src.bufQueue[i].audioBuf) {
					offset += src.bufQueue[i].audioBuf.duration;
				}
			}
			offset += src.bufOffset;

			return offset;
		},
		sourceSeek: (src, offset) => {
			var playing = src.state == 4114;
			if (playing) {
				AL.setSourceState(src, 4113);
			}

			if (src.bufQueue[src.bufsProcessed].audioBuf !== null) {
				src.bufsProcessed = 0;
				while (
					offset > src.bufQueue[src.bufsProcessed].audioBuf.duration
				) {
					offset -= src.bufQueue[src.bufsProcessed].audioBuf.duration;
					src.bufsProcessed++;
				}

				src.bufOffset = offset;
			}

			if (playing) {
				AL.setSourceState(src, 4114);
			}
		},
		getGlobalParam: (funcname, param) => {
			if (!AL.currentCtx) {
				return null;
			}

			switch (param) {
				case 49152:
					return AL.currentCtx.dopplerFactor;
				case 49155:
					return AL.currentCtx.speedOfSound;
				case 53248:
					return AL.currentCtx.distanceModel;
				default:
					AL.currentCtx.err = 40962;
					return null;
			}
		},
		setGlobalParam: (funcname, param, value) => {
			if (!AL.currentCtx) {
				return;
			}

			switch (param) {
				case 49152:
					if (!Number.isFinite(value) || value < 0.0) {
						// Strictly negative values are disallowed
						AL.currentCtx.err = 40963;
						return;
					}

					AL.currentCtx.dopplerFactor = value;
					AL.updateListenerSpace(AL.currentCtx);
					break;
				case 49155:
					if (!Number.isFinite(value) || value <= 0.0) {
						// Negative or zero values are disallowed
						AL.currentCtx.err = 40963;
						return;
					}

					AL.currentCtx.speedOfSound = value;
					AL.updateListenerSpace(AL.currentCtx);
					break;
				case 53248:
					switch (value) {
						case 0:
						case 0xd001 /* AL_INVERSE_DISTANCE */:
						case 0xd002 /* AL_INVERSE_DISTANCE_CLAMPED */:
						case 0xd003 /* AL_LINEAR_DISTANCE */:
						case 0xd004 /* AL_LINEAR_DISTANCE_CLAMPED */:
						case 0xd005 /* AL_EXPONENT_DISTANCE */:
						case 0xd006 /* AL_EXPONENT_DISTANCE_CLAMPED */:
							AL.currentCtx.distanceModel = value;
							AL.updateContextGlobal(AL.currentCtx);
							break;
						default:
							AL.currentCtx.err = 40963;
							return;
					}
					break;
				default:
					AL.currentCtx.err = 40962;
					return;
			}
		},
		getListenerParam: (funcname, param) => {
			if (!AL.currentCtx) {
				return null;
			}

			switch (param) {
				case 4100:
					return AL.currentCtx.listener.position;
				case 4102:
					return AL.currentCtx.listener.velocity;
				case 4111:
					return AL.currentCtx.listener.direction.concat(
						AL.currentCtx.listener.up
					);
				case 4106:
					return AL.currentCtx.gain.gain.value;
				default:
					AL.currentCtx.err = 40962;
					return null;
			}
		},
		setListenerParam: (funcname, param, value) => {
			if (!AL.currentCtx) {
				return;
			}
			if (value === null) {
				AL.currentCtx.err = 40962;
				return;
			}

			var listener = AL.currentCtx.listener;
			switch (param) {
				case 4100:
					if (
						!Number.isFinite(value[0]) ||
						!Number.isFinite(value[1]) ||
						!Number.isFinite(value[2])
					) {
						AL.currentCtx.err = 40963;
						return;
					}

					listener.position[0] = value[0];
					listener.position[1] = value[1];
					listener.position[2] = value[2];
					AL.updateListenerSpace(AL.currentCtx);
					break;
				case 4102:
					if (
						!Number.isFinite(value[0]) ||
						!Number.isFinite(value[1]) ||
						!Number.isFinite(value[2])
					) {
						AL.currentCtx.err = 40963;
						return;
					}

					listener.velocity[0] = value[0];
					listener.velocity[1] = value[1];
					listener.velocity[2] = value[2];
					AL.updateListenerSpace(AL.currentCtx);
					break;
				case 4106:
					if (!Number.isFinite(value) || value < 0.0) {
						AL.currentCtx.err = 40963;
						return;
					}

					AL.currentCtx.gain.gain.value = value;
					break;
				case 4111:
					if (
						!Number.isFinite(value[0]) ||
						!Number.isFinite(value[1]) ||
						!Number.isFinite(value[2]) ||
						!Number.isFinite(value[3]) ||
						!Number.isFinite(value[4]) ||
						!Number.isFinite(value[5])
					) {
						AL.currentCtx.err = 40963;
						return;
					}

					listener.direction[0] = value[0];
					listener.direction[1] = value[1];
					listener.direction[2] = value[2];
					listener.up[0] = value[3];
					listener.up[1] = value[4];
					listener.up[2] = value[5];
					AL.updateListenerSpace(AL.currentCtx);
					break;
				default:
					AL.currentCtx.err = 40962;
					return;
			}
		},
		getBufferParam: (funcname, bufferId, param) => {
			if (!AL.currentCtx) {
				return;
			}
			var buf = AL.buffers[bufferId];
			if (!buf || bufferId === 0) {
				AL.currentCtx.err = 40961;
				return;
			}

			switch (param) {
				case 0x2001 /* AL_FREQUENCY */:
					return buf.frequency;
				case 0x2002 /* AL_BITS */:
					return buf.bytesPerSample * 8;
				case 0x2003 /* AL_CHANNELS */:
					return buf.channels;
				case 0x2004 /* AL_SIZE */:
					return buf.length * buf.bytesPerSample * buf.channels;
				case 0x2015 /* AL_LOOP_POINTS_SOFT */:
					if (buf.length === 0) {
						return [0, 0];
					}
					return [
						(buf.audioBuf._loopStart || 0.0) * buf.frequency,
						(buf.audioBuf._loopEnd || buf.length) * buf.frequency,
					];
				default:
					AL.currentCtx.err = 40962;
					return null;
			}
		},
		setBufferParam: (funcname, bufferId, param, value) => {
			if (!AL.currentCtx) {
				return;
			}
			var buf = AL.buffers[bufferId];
			if (!buf || bufferId === 0) {
				AL.currentCtx.err = 40961;
				return;
			}
			if (value === null) {
				AL.currentCtx.err = 40962;
				return;
			}

			switch (param) {
				case 0x2004 /* AL_SIZE */:
					if (value !== 0) {
						AL.currentCtx.err = 40963;
						return;
					}

					// Per the spec, setting AL_SIZE to 0 is a legal NOP.
					break;
				case 0x2015 /* AL_LOOP_POINTS_SOFT */:
					if (
						value[0] < 0 ||
						value[0] > buf.length ||
						value[1] < 0 ||
						value[1] > buf.Length ||
						value[0] >= value[1]
					) {
						AL.currentCtx.err = 40963;
						return;
					}
					if (buf.refCount > 0) {
						AL.currentCtx.err = 40964;
						return;
					}

					if (buf.audioBuf) {
						buf.audioBuf._loopStart = value[0] / buf.frequency;
						buf.audioBuf._loopEnd = value[1] / buf.frequency;
					}
					break;
				default:
					AL.currentCtx.err = 40962;
					return;
			}
		},
		getSourceParam: (funcname, sourceId, param) => {
			if (!AL.currentCtx) {
				return null;
			}
			var src = AL.currentCtx.sources[sourceId];
			if (!src) {
				AL.currentCtx.err = 40961;
				return null;
			}

			switch (param) {
				case 0x202 /* AL_SOURCE_RELATIVE */:
					return src.relative;
				case 0x1001 /* AL_CONE_INNER_ANGLE */:
					return src.coneInnerAngle;
				case 0x1002 /* AL_CONE_OUTER_ANGLE */:
					return src.coneOuterAngle;
				case 0x1003 /* AL_PITCH */:
					return src.pitch;
				case 4100:
					return src.position;
				case 4101:
					return src.direction;
				case 4102:
					return src.velocity;
				case 0x1007 /* AL_LOOPING */:
					return src.looping;
				case 0x1009 /* AL_BUFFER */:
					if (src.type === 4136) {
						return src.bufQueue[0].id;
					}
					return 0;
				case 4106:
					return src.gain.gain.value;
				case 0x100d /* AL_MIN_GAIN */:
					return src.minGain;
				case 0x100e /* AL_MAX_GAIN */:
					return src.maxGain;
				case 0x1010 /* AL_SOURCE_STATE */:
					return src.state;
				case 0x1015 /* AL_BUFFERS_QUEUED */:
					if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
						return 0;
					}
					return src.bufQueue.length;
				case 0x1016 /* AL_BUFFERS_PROCESSED */:
					if (
						(src.bufQueue.length === 1 &&
							src.bufQueue[0].id === 0) ||
						src.looping
					) {
						return 0;
					}
					return src.bufsProcessed;
				case 0x1020 /* AL_REFERENCE_DISTANCE */:
					return src.refDistance;
				case 0x1021 /* AL_ROLLOFF_FACTOR */:
					return src.rolloffFactor;
				case 0x1022 /* AL_CONE_OUTER_GAIN */:
					return src.coneOuterGain;
				case 0x1023 /* AL_MAX_DISTANCE */:
					return src.maxDistance;
				case 0x1024 /* AL_SEC_OFFSET */:
					return AL.sourceTell(src);
				case 0x1025 /* AL_SAMPLE_OFFSET */:
					var offset = AL.sourceTell(src);
					if (offset > 0.0) {
						offset *= src.bufQueue[0].frequency;
					}
					return offset;
				case 0x1026 /* AL_BYTE_OFFSET */:
					var offset = AL.sourceTell(src);
					if (offset > 0.0) {
						offset *=
							src.bufQueue[0].frequency *
							src.bufQueue[0].bytesPerSample;
					}
					return offset;
				case 0x1027 /* AL_SOURCE_TYPE */:
					return src.type;
				case 0x1214 /* AL_SOURCE_SPATIALIZE_SOFT */:
					return src.spatialize;
				case 0x2009 /* AL_BYTE_LENGTH_SOFT */:
					var length = 0;
					var bytesPerFrame = 0;
					for (var i = 0; i < src.bufQueue.length; i++) {
						length += src.bufQueue[i].length;
						if (src.bufQueue[i].id !== 0) {
							bytesPerFrame =
								src.bufQueue[i].bytesPerSample *
								src.bufQueue[i].channels;
						}
					}
					return length * bytesPerFrame;
				case 0x200a /* AL_SAMPLE_LENGTH_SOFT */:
					var length = 0;
					for (var i = 0; i < src.bufQueue.length; i++) {
						length += src.bufQueue[i].length;
					}
					return length;
				case 0x200b /* AL_SEC_LENGTH_SOFT */:
					return AL.sourceDuration(src);
				case 53248:
					return src.distanceModel;
				default:
					AL.currentCtx.err = 40962;
					return null;
			}
		},
		setSourceParam: (funcname, sourceId, param, value) => {
			if (!AL.currentCtx) {
				return;
			}
			var src = AL.currentCtx.sources[sourceId];
			if (!src) {
				AL.currentCtx.err = 40961;
				return;
			}
			if (value === null) {
				AL.currentCtx.err = 40962;
				return;
			}

			switch (param) {
				case 0x202 /* AL_SOURCE_RELATIVE */:
					if (value === 1) {
						src.relative = true;
						AL.updateSourceSpace(src);
					} else if (value === 0) {
						src.relative = false;
						AL.updateSourceSpace(src);
					} else {
						AL.currentCtx.err = 40963;
						return;
					}
					break;
				case 0x1001 /* AL_CONE_INNER_ANGLE */:
					if (!Number.isFinite(value)) {
						AL.currentCtx.err = 40963;
						return;
					}

					src.coneInnerAngle = value;
					if (src.panner) {
						src.panner.coneInnerAngle = value % 360.0;
					}
					break;
				case 0x1002 /* AL_CONE_OUTER_ANGLE */:
					if (!Number.isFinite(value)) {
						AL.currentCtx.err = 40963;
						return;
					}

					src.coneOuterAngle = value;
					if (src.panner) {
						src.panner.coneOuterAngle = value % 360.0;
					}
					break;
				case 0x1003 /* AL_PITCH */:
					if (!Number.isFinite(value) || value <= 0.0) {
						AL.currentCtx.err = 40963;
						return;
					}

					if (src.pitch === value) {
						break;
					}

					src.pitch = value;
					AL.updateSourceRate(src);
					break;
				case 4100:
					if (
						!Number.isFinite(value[0]) ||
						!Number.isFinite(value[1]) ||
						!Number.isFinite(value[2])
					) {
						AL.currentCtx.err = 40963;
						return;
					}

					src.position[0] = value[0];
					src.position[1] = value[1];
					src.position[2] = value[2];
					AL.updateSourceSpace(src);
					break;
				case 4101:
					if (
						!Number.isFinite(value[0]) ||
						!Number.isFinite(value[1]) ||
						!Number.isFinite(value[2])
					) {
						AL.currentCtx.err = 40963;
						return;
					}

					src.direction[0] = value[0];
					src.direction[1] = value[1];
					src.direction[2] = value[2];
					AL.updateSourceSpace(src);
					break;
				case 4102:
					if (
						!Number.isFinite(value[0]) ||
						!Number.isFinite(value[1]) ||
						!Number.isFinite(value[2])
					) {
						AL.currentCtx.err = 40963;
						return;
					}

					src.velocity[0] = value[0];
					src.velocity[1] = value[1];
					src.velocity[2] = value[2];
					AL.updateSourceSpace(src);
					break;
				case 0x1007 /* AL_LOOPING */:
					if (value === 1) {
						src.looping = true;
						AL.updateSourceTime(src);
						if (src.type === 4136 && src.audioQueue.length > 0) {
							var audioSrc = src.audioQueue[0];
							audioSrc.loop = true;
							audioSrc._duration = Number.POSITIVE_INFINITY;
						}
					} else if (value === 0) {
						src.looping = false;
						var currentTime = AL.updateSourceTime(src);
						if (src.type === 4136 && src.audioQueue.length > 0) {
							var audioSrc = src.audioQueue[0];
							audioSrc.loop = false;
							audioSrc._duration =
								src.bufQueue[0].audioBuf.duration /
								src.playbackRate;
							audioSrc._startTime =
								currentTime - src.bufOffset / src.playbackRate;
						}
					} else {
						AL.currentCtx.err = 40963;
						return;
					}
					break;
				case 0x1009 /* AL_BUFFER */:
					if (src.state === 4114 || src.state === 4115) {
						AL.currentCtx.err = 40964;
						return;
					}

					if (value === 0) {
						for (var i in src.bufQueue) {
							src.bufQueue[i].refCount--;
						}
						src.bufQueue.length = 1;
						src.bufQueue[0] = AL.buffers[0];

						src.bufsProcessed = 0;
						src.type = 0x1030 /* AL_UNDETERMINED */;
					} else {
						var buf = AL.buffers[value];
						if (!buf) {
							AL.currentCtx.err = 40963;
							return;
						}

						for (var i in src.bufQueue) {
							src.bufQueue[i].refCount--;
						}
						src.bufQueue.length = 0;

						buf.refCount++;
						src.bufQueue = [buf];
						src.bufsProcessed = 0;
						src.type = 4136;
					}

					AL.initSourcePanner(src);
					AL.scheduleSourceAudio(src);
					break;
				case 4106:
					if (!Number.isFinite(value) || value < 0.0) {
						AL.currentCtx.err = 40963;
						return;
					}
					src.gain.gain.value = value;
					break;
				case 0x100d /* AL_MIN_GAIN */:
					if (
						!Number.isFinite(value) ||
						value < 0.0 ||
						value > Math.min(src.maxGain, 1.0)
					) {
						AL.currentCtx.err = 40963;
						return;
					}
					src.minGain = value;
					break;
				case 0x100e /* AL_MAX_GAIN */:
					if (
						!Number.isFinite(value) ||
						value < Math.max(0.0, src.minGain) ||
						value > 1.0
					) {
						AL.currentCtx.err = 40963;
						return;
					}
					src.maxGain = value;
					break;
				case 0x1020 /* AL_REFERENCE_DISTANCE */:
					if (!Number.isFinite(value) || value < 0.0) {
						AL.currentCtx.err = 40963;
						return;
					}
					src.refDistance = value;
					if (src.panner) {
						src.panner.refDistance = value;
					}
					break;
				case 0x1021 /* AL_ROLLOFF_FACTOR */:
					if (!Number.isFinite(value) || value < 0.0) {
						AL.currentCtx.err = 40963;
						return;
					}
					src.rolloffFactor = value;
					if (src.panner) {
						src.panner.rolloffFactor = value;
					}
					break;
				case 0x1022 /* AL_CONE_OUTER_GAIN */:
					if (!Number.isFinite(value) || value < 0.0 || value > 1.0) {
						AL.currentCtx.err = 40963;
						return;
					}
					src.coneOuterGain = value;
					if (src.panner) {
						src.panner.coneOuterGain = value;
					}
					break;
				case 0x1023 /* AL_MAX_DISTANCE */:
					if (!Number.isFinite(value) || value < 0.0) {
						AL.currentCtx.err = 40963;
						return;
					}
					src.maxDistance = value;
					if (src.panner) {
						src.panner.maxDistance = value;
					}
					break;
				case 0x1024 /* AL_SEC_OFFSET */:
					if (value < 0.0 || value > AL.sourceDuration(src)) {
						AL.currentCtx.err = 40963;
						return;
					}

					AL.sourceSeek(src, value);
					break;
				case 0x1025 /* AL_SAMPLE_OFFSET */:
					var srcLen = AL.sourceDuration(src);
					if (srcLen > 0.0) {
						var frequency;
						for (var bufId in src.bufQueue) {
							if (bufId) {
								frequency = src.bufQueue[bufId].frequency;
								break;
							}
						}
						value /= frequency;
					}
					if (value < 0.0 || value > srcLen) {
						AL.currentCtx.err = 40963;
						return;
					}

					AL.sourceSeek(src, value);
					break;
				case 0x1026 /* AL_BYTE_OFFSET */:
					var srcLen = AL.sourceDuration(src);
					if (srcLen > 0.0) {
						var bytesPerSec;
						for (var bufId in src.bufQueue) {
							if (bufId) {
								var buf = src.bufQueue[bufId];
								bytesPerSec =
									buf.frequency *
									buf.bytesPerSample *
									buf.channels;
								break;
							}
						}
						value /= bytesPerSec;
					}
					if (value < 0.0 || value > srcLen) {
						AL.currentCtx.err = 40963;
						return;
					}

					AL.sourceSeek(src, value);
					break;
				case 0x1214 /* AL_SOURCE_SPATIALIZE_SOFT */:
					if (
						value !== 0 &&
						value !== 1 &&
						value !== 2 /* AL_AUTO_SOFT */
					) {
						AL.currentCtx.err = 40963;
						return;
					}

					src.spatialize = value;
					AL.initSourcePanner(src);
					break;
				case 0x2009 /* AL_BYTE_LENGTH_SOFT */:
				case 0x200a /* AL_SAMPLE_LENGTH_SOFT */:
				case 0x200b /* AL_SEC_LENGTH_SOFT */:
					AL.currentCtx.err = 40964;
					break;
				case 53248:
					switch (value) {
						case 0:
						case 0xd001 /* AL_INVERSE_DISTANCE */:
						case 0xd002 /* AL_INVERSE_DISTANCE_CLAMPED */:
						case 0xd003 /* AL_LINEAR_DISTANCE */:
						case 0xd004 /* AL_LINEAR_DISTANCE_CLAMPED */:
						case 0xd005 /* AL_EXPONENT_DISTANCE */:
						case 0xd006 /* AL_EXPONENT_DISTANCE_CLAMPED */:
							src.distanceModel = value;
							if (AL.currentCtx.sourceDistanceModel) {
								AL.updateContextGlobal(AL.currentCtx);
							}
							break;
						default:
							AL.currentCtx.err = 40963;
							return;
					}
					break;
				default:
					AL.currentCtx.err = 40962;
					return;
			}
		},
		captures: {},
		sharedCaptureAudioCtx: null,
		requireValidCaptureDevice: (deviceId, funcname) => {
			if (deviceId === 0) {
				AL.alcErr = 40961;
				return null;
			}
			var c = AL.captures[deviceId];
			if (!c) {
				AL.alcErr = 40961;
				return null;
			}
			var err = c.mediaStreamError;
			if (err) {
				AL.alcErr = 40961;
				return null;
			}
			return c;
		},
	};
	var _alBuffer3f = (bufferId, param, value0, value1, value2) => {
		AL.setBufferParam('alBuffer3f', bufferId, param, null);
	};
	_alBuffer3f.sig = 'viifff';

	var _alBuffer3i = (bufferId, param, value0, value1, value2) => {
		AL.setBufferParam('alBuffer3i', bufferId, param, null);
	};
	_alBuffer3i.sig = 'viiiii';

	var _alBufferData = (bufferId, format, pData, size, freq) => {
		if (!AL.currentCtx) {
			return;
		}
		var buf = AL.buffers[bufferId];
		if (!buf) {
			AL.currentCtx.err = 40963;
			return;
		}
		if (freq <= 0) {
			AL.currentCtx.err = 40963;
			return;
		}

		var audioBuf = null;
		try {
			switch (format) {
				case 0x1100 /* AL_FORMAT_MONO8 */:
					if (size > 0) {
						audioBuf = AL.currentCtx.audioCtx.createBuffer(
							1,
							size,
							freq
						);
						var channel0 = audioBuf.getChannelData(0);
						for (var i = 0; i < size; ++i) {
							channel0[i] =
								HEAPU8[pData++] * 0.0078125 /* 1/128 */ - 1.0;
						}
					}
					buf.bytesPerSample = 1;
					buf.channels = 1;
					buf.length = size;
					break;
				case 0x1101 /* AL_FORMAT_MONO16 */:
					if (size > 0) {
						audioBuf = AL.currentCtx.audioCtx.createBuffer(
							1,
							size >> 1,
							freq
						);
						var channel0 = audioBuf.getChannelData(0);
						pData >>= 1;
						for (var i = 0; i < size >> 1; ++i) {
							channel0[i] =
								HEAP16[pData++] *
								0.000030517578125 /* 1/32768 */;
						}
					}
					buf.bytesPerSample = 2;
					buf.channels = 1;
					buf.length = size >> 1;
					break;
				case 0x1102 /* AL_FORMAT_STEREO8 */:
					if (size > 0) {
						audioBuf = AL.currentCtx.audioCtx.createBuffer(
							2,
							size >> 1,
							freq
						);
						var channel0 = audioBuf.getChannelData(0);
						var channel1 = audioBuf.getChannelData(1);
						for (var i = 0; i < size >> 1; ++i) {
							channel0[i] =
								HEAPU8[pData++] * 0.0078125 /* 1/128 */ - 1.0;
							channel1[i] =
								HEAPU8[pData++] * 0.0078125 /* 1/128 */ - 1.0;
						}
					}
					buf.bytesPerSample = 1;
					buf.channels = 2;
					buf.length = size >> 1;
					break;
				case 0x1103 /* AL_FORMAT_STEREO16 */:
					if (size > 0) {
						audioBuf = AL.currentCtx.audioCtx.createBuffer(
							2,
							size >> 2,
							freq
						);
						var channel0 = audioBuf.getChannelData(0);
						var channel1 = audioBuf.getChannelData(1);
						pData >>= 1;
						for (var i = 0; i < size >> 2; ++i) {
							channel0[i] =
								HEAP16[pData++] *
								0.000030517578125 /* 1/32768 */;
							channel1[i] =
								HEAP16[pData++] *
								0.000030517578125 /* 1/32768 */;
						}
					}
					buf.bytesPerSample = 2;
					buf.channels = 2;
					buf.length = size >> 2;
					break;
				case 0x10010 /* AL_FORMAT_MONO_FLOAT32 */:
					if (size > 0) {
						audioBuf = AL.currentCtx.audioCtx.createBuffer(
							1,
							size >> 2,
							freq
						);
						var channel0 = audioBuf.getChannelData(0);
						pData >>= 2;
						for (var i = 0; i < size >> 2; ++i) {
							channel0[i] = HEAPF32[pData++];
						}
					}
					buf.bytesPerSample = 4;
					buf.channels = 1;
					buf.length = size >> 2;
					break;
				case 0x10011 /* AL_FORMAT_STEREO_FLOAT32 */:
					if (size > 0) {
						audioBuf = AL.currentCtx.audioCtx.createBuffer(
							2,
							size >> 3,
							freq
						);
						var channel0 = audioBuf.getChannelData(0);
						var channel1 = audioBuf.getChannelData(1);
						pData >>= 2;
						for (var i = 0; i < size >> 3; ++i) {
							channel0[i] = HEAPF32[pData++];
							channel1[i] = HEAPF32[pData++];
						}
					}
					buf.bytesPerSample = 4;
					buf.channels = 2;
					buf.length = size >> 3;
					break;
				default:
					AL.currentCtx.err = 40963;
					return;
			}
			buf.frequency = freq;
			buf.audioBuf = audioBuf;
		} catch (e) {
			AL.currentCtx.err = 40963;
			return;
		}
	};
	_alBufferData.sig = 'viipii';

	var _alBufferf = (bufferId, param, value) => {
		AL.setBufferParam('alBufferf', bufferId, param, null);
	};
	_alBufferf.sig = 'viif';

	var _alBufferfv = (bufferId, param, pValues) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		AL.setBufferParam('alBufferfv', bufferId, param, null);
	};
	_alBufferfv.sig = 'viip';

	var _alBufferi = (bufferId, param, value) => {
		AL.setBufferParam('alBufferi', bufferId, param, null);
	};
	_alBufferi.sig = 'viii';

	var _alBufferiv = (bufferId, param, pValues) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x2015 /* AL_LOOP_POINTS_SOFT */:
				AL.paramArray[0] = HEAP32[pValues >> 2];
				AL.paramArray[1] = HEAP32[(pValues + 4) >> 2];
				AL.setBufferParam('alBufferiv', bufferId, param, AL.paramArray);
				break;
			default:
				AL.setBufferParam('alBufferiv', bufferId, param, null);
				break;
		}
	};
	_alBufferiv.sig = 'viip';

	var _alDeleteBuffers = (count, pBufferIds) => {
		if (!AL.currentCtx) {
			return;
		}

		for (var i = 0; i < count; ++i) {
			var bufId = HEAP32[(pBufferIds + i * 4) >> 2];
			/// Deleting the zero buffer is a legal NOP, so ignore it
			if (bufId === 0) {
				continue;
			}

			// Make sure the buffer index is valid.
			if (!AL.buffers[bufId]) {
				AL.currentCtx.err = 40961;
				return;
			}

			// Make sure the buffer is no longer in use.
			if (AL.buffers[bufId].refCount) {
				AL.currentCtx.err = 40964;
				return;
			}
		}

		for (var i = 0; i < count; ++i) {
			var bufId = HEAP32[(pBufferIds + i * 4) >> 2];
			if (bufId === 0) {
				continue;
			}

			AL.deviceRefCounts[AL.buffers[bufId].deviceId]--;
			delete AL.buffers[bufId];
			AL.freeIds.push(bufId);
		}
	};
	_alDeleteBuffers.sig = 'vip';

	var _alSourcei = (sourceId, param, value) => {
		switch (param) {
			case 0x202 /* AL_SOURCE_RELATIVE */:
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1007 /* AL_LOOPING */:
			case 0x1009 /* AL_BUFFER */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x1214 /* AL_SOURCE_SPATIALIZE_SOFT */:
			case 0x2009 /* AL_BYTE_LENGTH_SOFT */:
			case 0x200a /* AL_SAMPLE_LENGTH_SOFT */:
			case 53248:
				AL.setSourceParam('alSourcei', sourceId, param, value);
				break;
			default:
				AL.setSourceParam('alSourcei', sourceId, param, null);
				break;
		}
	};
	_alSourcei.sig = 'viii';

	var _alDeleteSources = (count, pSourceIds) => {
		if (!AL.currentCtx) {
			return;
		}

		for (var i = 0; i < count; ++i) {
			var srcId = HEAP32[(pSourceIds + i * 4) >> 2];
			if (!AL.currentCtx.sources[srcId]) {
				AL.currentCtx.err = 40961;
				return;
			}
		}

		for (var i = 0; i < count; ++i) {
			var srcId = HEAP32[(pSourceIds + i * 4) >> 2];
			AL.setSourceState(AL.currentCtx.sources[srcId], 4116);
			_alSourcei(srcId, 0x1009 /* AL_BUFFER */, 0);
			delete AL.currentCtx.sources[srcId];
			AL.freeIds.push(srcId);
		}
	};
	_alDeleteSources.sig = 'vip';

	var _alDisable = (param) => {
		if (!AL.currentCtx) {
			return;
		}
		switch (param) {
			case 0x200 /* AL_SOURCE_DISTANCE_MODEL */:
				AL.currentCtx.sourceDistanceModel = false;
				AL.updateContextGlobal(AL.currentCtx);
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alDisable.sig = 'vi';

	var _alDistanceModel = (model) => {
		AL.setGlobalParam('alDistanceModel', 53248, model);
	};
	_alDistanceModel.sig = 'vi';

	var _alDopplerFactor = (value) => {
		AL.setGlobalParam('alDopplerFactor', 49152, value);
	};
	_alDopplerFactor.sig = 'vf';

	var _alDopplerVelocity = (value) => {
		warnOnce(
			'alDopplerVelocity() is deprecated, and only kept for compatibility with OpenAL 1.0. Use alSpeedOfSound() instead.'
		);
		if (!AL.currentCtx) {
			return;
		}
		if (value <= 0) {
			// Negative or zero values are disallowed
			AL.currentCtx.err = 40963;
			return;
		}
	};
	_alDopplerVelocity.sig = 'vf';

	var _alEnable = (param) => {
		if (!AL.currentCtx) {
			return;
		}
		switch (param) {
			case 0x200 /* AL_SOURCE_DISTANCE_MODEL */:
				AL.currentCtx.sourceDistanceModel = true;
				AL.updateContextGlobal(AL.currentCtx);
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alEnable.sig = 'vi';

	var _alGenBuffers = (count, pBufferIds) => {
		if (!AL.currentCtx) {
			return;
		}

		for (var i = 0; i < count; ++i) {
			var buf = {
				deviceId: AL.currentCtx.deviceId,
				id: AL.newId(),
				refCount: 0,
				audioBuf: null,
				frequency: 0,
				bytesPerSample: 2,
				channels: 1,
				length: 0,
			};
			AL.deviceRefCounts[buf.deviceId]++;
			AL.buffers[buf.id] = buf;
			HEAP32[(pBufferIds + i * 4) >> 2] = buf.id;
		}
	};
	_alGenBuffers.sig = 'vip';

	var _alGenSources = (count, pSourceIds) => {
		if (!AL.currentCtx) {
			return;
		}
		for (var i = 0; i < count; ++i) {
			var gain = AL.currentCtx.audioCtx.createGain();
			gain.connect(AL.currentCtx.gain);
			var src = {
				context: AL.currentCtx,
				id: AL.newId(),
				type: 0x1030 /* AL_UNDETERMINED */,
				state: 4113,
				bufQueue: [AL.buffers[0]],
				audioQueue: [],
				looping: false,
				pitch: 1.0,
				dopplerShift: 1.0,
				gain,
				minGain: 0.0,
				maxGain: 1.0,
				panner: null,
				bufsProcessed: 0,
				bufStartTime: Number.NEGATIVE_INFINITY,
				bufOffset: 0.0,
				relative: false,
				refDistance: 1.0,
				maxDistance: 3.40282e38 /* FLT_MAX */,
				rolloffFactor: 1.0,
				position: [0.0, 0.0, 0.0],
				velocity: [0.0, 0.0, 0.0],
				direction: [0.0, 0.0, 0.0],
				coneOuterGain: 0.0,
				coneInnerAngle: 360.0,
				coneOuterAngle: 360.0,
				distanceModel: 0xd002 /* AL_INVERSE_DISTANCE_CLAMPED */,
				spatialize: 2 /* AL_AUTO_SOFT */,

				get playbackRate() {
					return this.pitch * this.dopplerShift;
				},
			};
			AL.currentCtx.sources[src.id] = src;
			HEAP32[(pSourceIds + i * 4) >> 2] = src.id;
		}
	};
	_alGenSources.sig = 'vip';

	var _alGetBoolean = (param) => {
		var val = AL.getGlobalParam('alGetBoolean', param);
		if (val === null) {
			return 0;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				return val !== 0 ? 1 : 0;
			default:
				AL.currentCtx.err = 40962;
				return 0;
		}
	};
	_alGetBoolean.sig = 'ii';

	var _alGetBooleanv = (param, pValues) => {
		var val = AL.getGlobalParam('alGetBooleanv', param);
		// Silently ignore null destinations, as per the spec for global state functions
		if (val === null || !pValues) {
			return;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				HEAP8[pValues] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetBooleanv.sig = 'vip';

	var _alGetBuffer3f = (bufferId, param, pValue0, pValue1, pValue2) => {
		var val = AL.getBufferParam('alGetBuffer3f', bufferId, param);
		if (val === null) {
			return;
		}
		if (!pValue0 || !pValue1 || !pValue2) {
			AL.currentCtx.err = 40963;
			return;
		}

		AL.currentCtx.err = 40962;
	};
	_alGetBuffer3f.sig = 'viippp';

	var _alGetBuffer3i = (bufferId, param, pValue0, pValue1, pValue2) => {
		var val = AL.getBufferParam('alGetBuffer3i', bufferId, param);
		if (val === null) {
			return;
		}
		if (!pValue0 || !pValue1 || !pValue2) {
			AL.currentCtx.err = 40963;
			return;
		}

		AL.currentCtx.err = 40962;
	};
	_alGetBuffer3i.sig = 'viippp';

	var _alGetBufferf = (bufferId, param, pValue) => {
		var val = AL.getBufferParam('alGetBufferf', bufferId, param);
		if (val === null) {
			return;
		}
		if (!pValue) {
			AL.currentCtx.err = 40963;
			return;
		}

		AL.currentCtx.err = 40962;
	};
	_alGetBufferf.sig = 'viip';

	var _alGetBufferfv = (bufferId, param, pValues) => {
		var val = AL.getBufferParam('alGetBufferfv', bufferId, param);
		if (val === null) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		AL.currentCtx.err = 40962;
	};
	_alGetBufferfv.sig = 'viip';

	var _alGetBufferi = (bufferId, param, pValue) => {
		var val = AL.getBufferParam('alGetBufferi', bufferId, param);
		if (val === null) {
			return;
		}
		if (!pValue) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x2001 /* AL_FREQUENCY */:
			case 0x2002 /* AL_BITS */:
			case 0x2003 /* AL_CHANNELS */:
			case 0x2004 /* AL_SIZE */:
				HEAP32[pValue >> 2] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetBufferi.sig = 'viip';

	var _alGetBufferiv = (bufferId, param, pValues) => {
		var val = AL.getBufferParam('alGetBufferiv', bufferId, param);
		if (val === null) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x2001 /* AL_FREQUENCY */:
			case 0x2002 /* AL_BITS */:
			case 0x2003 /* AL_CHANNELS */:
			case 0x2004 /* AL_SIZE */:
				HEAP32[pValues >> 2] = val;
				break;
			case 0x2015 /* AL_LOOP_POINTS_SOFT */:
				HEAP32[pValues >> 2] = val[0];
				HEAP32[(pValues + 4) >> 2] = val[1];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetBufferiv.sig = 'viip';

	var _alGetDouble = (param) => {
		var val = AL.getGlobalParam('alGetDouble', param);
		if (val === null) {
			return 0.0;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				return val;
			default:
				AL.currentCtx.err = 40962;
				return 0.0;
		}
	};
	_alGetDouble.sig = 'di';

	var _alGetDoublev = (param, pValues) => {
		var val = AL.getGlobalParam('alGetDoublev', param);
		// Silently ignore null destinations, as per the spec for global state functions
		if (val === null || !pValues) {
			return;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				HEAPF64[pValues >> 3] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetDoublev.sig = 'vip';

	var _alGetEnumValue = (pEnumName) => {
		if (!AL.currentCtx) {
			return 0;
		}

		if (!pEnumName) {
			AL.currentCtx.err = 40963;
			return 0;
		}
		var name = UTF8ToString(pEnumName);

		switch (name) {
			// Spec doesn't clearly state that alGetEnumValue() is required to
			// support _only_ extension tokens.
			// We should probably follow OpenAL-Soft's example and support all
			// of the names we know.
			// See http://repo.or.cz/openal-soft.git/blob/HEAD:/Alc/ALc.c
			case 'AL_BITS':
				return 0x2002;
			case 'AL_BUFFER':
				return 0x1009;
			case 'AL_BUFFERS_PROCESSED':
				return 0x1016;
			case 'AL_BUFFERS_QUEUED':
				return 0x1015;
			case 'AL_BYTE_OFFSET':
				return 0x1026;
			case 'AL_CHANNELS':
				return 0x2003;
			case 'AL_CONE_INNER_ANGLE':
				return 0x1001;
			case 'AL_CONE_OUTER_ANGLE':
				return 0x1002;
			case 'AL_CONE_OUTER_GAIN':
				return 0x1022;
			case 'AL_DIRECTION':
				return 0x1005;
			case 'AL_DISTANCE_MODEL':
				return 0xd000;
			case 'AL_DOPPLER_FACTOR':
				return 0xc000;
			case 'AL_DOPPLER_VELOCITY':
				return 0xc001;
			case 'AL_EXPONENT_DISTANCE':
				return 0xd005;
			case 'AL_EXPONENT_DISTANCE_CLAMPED':
				return 0xd006;
			case 'AL_EXTENSIONS':
				return 0xb004;
			case 'AL_FORMAT_MONO16':
				return 0x1101;
			case 'AL_FORMAT_MONO8':
				return 0x1100;
			case 'AL_FORMAT_STEREO16':
				return 0x1103;
			case 'AL_FORMAT_STEREO8':
				return 0x1102;
			case 'AL_FREQUENCY':
				return 0x2001;
			case 'AL_GAIN':
				return 0x100a;
			case 'AL_INITIAL':
				return 0x1011;
			case 'AL_INVALID':
				return -1;
			case 'AL_ILLEGAL_ENUM': // fallthrough
			case 'AL_INVALID_ENUM':
				return 0xa002;
			case 'AL_INVALID_NAME':
				return 0xa001;
			case 'AL_ILLEGAL_COMMAND': // fallthrough
			case 'AL_INVALID_OPERATION':
				return 0xa004;
			case 'AL_INVALID_VALUE':
				return 0xa003;
			case 'AL_INVERSE_DISTANCE':
				return 0xd001;
			case 'AL_INVERSE_DISTANCE_CLAMPED':
				return 0xd002;
			case 'AL_LINEAR_DISTANCE':
				return 0xd003;
			case 'AL_LINEAR_DISTANCE_CLAMPED':
				return 0xd004;
			case 'AL_LOOPING':
				return 0x1007;
			case 'AL_MAX_DISTANCE':
				return 0x1023;
			case 'AL_MAX_GAIN':
				return 0x100e;
			case 'AL_MIN_GAIN':
				return 0x100d;
			case 'AL_NONE':
				return 0;
			case 'AL_NO_ERROR':
				return 0;
			case 'AL_ORIENTATION':
				return 0x100f;
			case 'AL_OUT_OF_MEMORY':
				return 0xa005;
			case 'AL_PAUSED':
				return 0x1013;
			case 'AL_PENDING':
				return 0x2011;
			case 'AL_PITCH':
				return 0x1003;
			case 'AL_PLAYING':
				return 0x1012;
			case 'AL_POSITION':
				return 0x1004;
			case 'AL_PROCESSED':
				return 0x2012;
			case 'AL_REFERENCE_DISTANCE':
				return 0x1020;
			case 'AL_RENDERER':
				return 0xb003;
			case 'AL_ROLLOFF_FACTOR':
				return 0x1021;
			case 'AL_SAMPLE_OFFSET':
				return 0x1025;
			case 'AL_SEC_OFFSET':
				return 0x1024;
			case 'AL_SIZE':
				return 0x2004;
			case 'AL_SOURCE_RELATIVE':
				return 0x202;
			case 'AL_SOURCE_STATE':
				return 0x1010;
			case 'AL_SOURCE_TYPE':
				return 0x1027;
			case 'AL_SPEED_OF_SOUND':
				return 0xc003;
			case 'AL_STATIC':
				return 0x1028;
			case 'AL_STOPPED':
				return 0x1014;
			case 'AL_STREAMING':
				return 0x1029;
			case 'AL_UNDETERMINED':
				return 0x1030;
			case 'AL_UNUSED':
				return 0x2010;
			case 'AL_VELOCITY':
				return 0x1006;
			case 'AL_VENDOR':
				return 0xb001;
			case 'AL_VERSION':
				return 0xb002;

			/* Extensions */
			case 'AL_AUTO_SOFT':
				return 0x0002;
			case 'AL_SOURCE_DISTANCE_MODEL':
				return 0x200;
			case 'AL_SOURCE_SPATIALIZE_SOFT':
				return 0x1214;
			case 'AL_LOOP_POINTS_SOFT':
				return 0x2015;
			case 'AL_BYTE_LENGTH_SOFT':
				return 0x2009;
			case 'AL_SAMPLE_LENGTH_SOFT':
				return 0x200a;
			case 'AL_SEC_LENGTH_SOFT':
				return 0x200b;
			case 'AL_FORMAT_MONO_FLOAT32':
				return 0x10010;
			case 'AL_FORMAT_STEREO_FLOAT32':
				return 0x10011;

			default:
				AL.currentCtx.err = 40963;
				return 0;
		}
	};
	_alGetEnumValue.sig = 'ip';

	var _alGetError = () => {
		if (!AL.currentCtx) {
			return 40964;
		}
		// Reset error on get.
		var err = AL.currentCtx.err;
		AL.currentCtx.err = 0;
		return err;
	};
	_alGetError.sig = 'i';

	var _alGetFloat = (param) => {
		var val = AL.getGlobalParam('alGetFloat', param);
		if (val === null) {
			return 0.0;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				return val;
			default:
				return 0.0;
		}
	};
	_alGetFloat.sig = 'fi';

	var _alGetFloatv = (param, pValues) => {
		var val = AL.getGlobalParam('alGetFloatv', param);
		// Silently ignore null destinations, as per the spec for global state functions
		if (val === null || !pValues) {
			return;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				HEAPF32[pValues >> 2] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetFloatv.sig = 'vip';

	var _alGetInteger = (param) => {
		var val = AL.getGlobalParam('alGetInteger', param);
		if (val === null) {
			return 0;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				return val;
			default:
				AL.currentCtx.err = 40962;
				return 0;
		}
	};
	_alGetInteger.sig = 'ii';

	var _alGetIntegerv = (param, pValues) => {
		var val = AL.getGlobalParam('alGetIntegerv', param);
		// Silently ignore null destinations, as per the spec for global state functions
		if (val === null || !pValues) {
			return;
		}

		switch (param) {
			case 49152:
			case 49155:
			case 53248:
				HEAP32[pValues >> 2] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetIntegerv.sig = 'vip';

	var _alGetListener3f = (param, pValue0, pValue1, pValue2) => {
		var val = AL.getListenerParam('alGetListener3f', param);
		if (val === null) {
			return;
		}
		if (!pValue0 || !pValue1 || !pValue2) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4102:
				HEAPF32[pValue0 >> 2] = val[0];
				HEAPF32[pValue1 >> 2] = val[1];
				HEAPF32[pValue2 >> 2] = val[2];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetListener3f.sig = 'vippp';

	var _alGetListener3i = (param, pValue0, pValue1, pValue2) => {
		var val = AL.getListenerParam('alGetListener3i', param);
		if (val === null) {
			return;
		}
		if (!pValue0 || !pValue1 || !pValue2) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4102:
				HEAP32[pValue0 >> 2] = val[0];
				HEAP32[pValue1 >> 2] = val[1];
				HEAP32[pValue2 >> 2] = val[2];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetListener3i.sig = 'vippp';

	var _alGetListenerf = (param, pValue) => {
		var val = AL.getListenerParam('alGetListenerf', param);
		if (val === null) {
			return;
		}
		if (!pValue) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4106:
				HEAPF32[pValue >> 2] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetListenerf.sig = 'vip';

	var _alGetListenerfv = (param, pValues) => {
		var val = AL.getListenerParam('alGetListenerfv', param);
		if (val === null) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4102:
				HEAPF32[pValues >> 2] = val[0];
				HEAPF32[(pValues + 4) >> 2] = val[1];
				HEAPF32[(pValues + 8) >> 2] = val[2];
				break;
			case 4111:
				HEAPF32[pValues >> 2] = val[0];
				HEAPF32[(pValues + 4) >> 2] = val[1];
				HEAPF32[(pValues + 8) >> 2] = val[2];
				HEAPF32[(pValues + 12) >> 2] = val[3];
				HEAPF32[(pValues + 16) >> 2] = val[4];
				HEAPF32[(pValues + 20) >> 2] = val[5];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetListenerfv.sig = 'vip';

	var _alGetListeneri = (param, pValue) => {
		var val = AL.getListenerParam('alGetListeneri', param);
		if (val === null) {
			return;
		}
		if (!pValue) {
			AL.currentCtx.err = 40963;
			return;
		}

		AL.currentCtx.err = 40962;
	};
	_alGetListeneri.sig = 'vip';

	var _alGetListeneriv = (param, pValues) => {
		var val = AL.getListenerParam('alGetListeneriv', param);
		if (val === null) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4102:
				HEAP32[pValues >> 2] = val[0];
				HEAP32[(pValues + 4) >> 2] = val[1];
				HEAP32[(pValues + 8) >> 2] = val[2];
				break;
			case 4111:
				HEAP32[pValues >> 2] = val[0];
				HEAP32[(pValues + 4) >> 2] = val[1];
				HEAP32[(pValues + 8) >> 2] = val[2];
				HEAP32[(pValues + 12) >> 2] = val[3];
				HEAP32[(pValues + 16) >> 2] = val[4];
				HEAP32[(pValues + 20) >> 2] = val[5];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetListeneriv.sig = 'vip';

	var _alGetSource3f = (sourceId, param, pValue0, pValue1, pValue2) => {
		var val = AL.getSourceParam('alGetSource3f', sourceId, param);
		if (val === null) {
			return;
		}
		if (!pValue0 || !pValue1 || !pValue2) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4101:
			case 4102:
				HEAPF32[pValue0 >> 2] = val[0];
				HEAPF32[pValue1 >> 2] = val[1];
				HEAPF32[pValue2 >> 2] = val[2];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetSource3f.sig = 'viippp';

	var _alGetSource3i = (sourceId, param, pValue0, pValue1, pValue2) => {
		var val = AL.getSourceParam('alGetSource3i', sourceId, param);
		if (val === null) {
			return;
		}
		if (!pValue0 || !pValue1 || !pValue2) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4101:
			case 4102:
				HEAP32[pValue0 >> 2] = val[0];
				HEAP32[pValue1 >> 2] = val[1];
				HEAP32[pValue2 >> 2] = val[2];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetSource3i.sig = 'viippp';

	var _alGetSourcef = (sourceId, param, pValue) => {
		var val = AL.getSourceParam('alGetSourcef', sourceId, param);
		if (val === null) {
			return;
		}
		if (!pValue) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1003 /* AL_PITCH */:
			case 4106:
			case 0x100d /* AL_MIN_GAIN */:
			case 0x100e /* AL_MAX_GAIN */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1022 /* AL_CONE_OUTER_GAIN */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x200b /* AL_SEC_LENGTH_SOFT */:
				HEAPF32[pValue >> 2] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetSourcef.sig = 'viip';

	var _alGetSourcefv = (sourceId, param, pValues) => {
		var val = AL.getSourceParam('alGetSourcefv', sourceId, param);
		if (val === null) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1003 /* AL_PITCH */:
			case 4106:
			case 0x100d /* AL_MIN_GAIN */:
			case 0x100e /* AL_MAX_GAIN */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1022 /* AL_CONE_OUTER_GAIN */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x200b /* AL_SEC_LENGTH_SOFT */:
				HEAPF32[pValues >> 2] = val[0];
				break;
			case 4100:
			case 4101:
			case 4102:
				HEAPF32[pValues >> 2] = val[0];
				HEAPF32[(pValues + 4) >> 2] = val[1];
				HEAPF32[(pValues + 8) >> 2] = val[2];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetSourcefv.sig = 'viip';

	var _alGetSourcei = (sourceId, param, pValue) => {
		var val = AL.getSourceParam('alGetSourcei', sourceId, param);
		if (val === null) {
			return;
		}
		if (!pValue) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x202 /* AL_SOURCE_RELATIVE */:
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1007 /* AL_LOOPING */:
			case 0x1009 /* AL_BUFFER */:
			case 0x1010 /* AL_SOURCE_STATE */:
			case 0x1015 /* AL_BUFFERS_QUEUED */:
			case 0x1016 /* AL_BUFFERS_PROCESSED */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x1027 /* AL_SOURCE_TYPE */:
			case 0x1214 /* AL_SOURCE_SPATIALIZE_SOFT */:
			case 0x2009 /* AL_BYTE_LENGTH_SOFT */:
			case 0x200a /* AL_SAMPLE_LENGTH_SOFT */:
			case 53248:
				HEAP32[pValue >> 2] = val;
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetSourcei.sig = 'viip';

	var _alGetSourceiv = (sourceId, param, pValues) => {
		var val = AL.getSourceParam('alGetSourceiv', sourceId, param);
		if (val === null) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x202 /* AL_SOURCE_RELATIVE */:
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1007 /* AL_LOOPING */:
			case 0x1009 /* AL_BUFFER */:
			case 0x1010 /* AL_SOURCE_STATE */:
			case 0x1015 /* AL_BUFFERS_QUEUED */:
			case 0x1016 /* AL_BUFFERS_PROCESSED */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x1027 /* AL_SOURCE_TYPE */:
			case 0x1214 /* AL_SOURCE_SPATIALIZE_SOFT */:
			case 0x2009 /* AL_BYTE_LENGTH_SOFT */:
			case 0x200a /* AL_SAMPLE_LENGTH_SOFT */:
			case 53248:
				HEAP32[pValues >> 2] = val;
				break;
			case 4100:
			case 4101:
			case 4102:
				HEAP32[pValues >> 2] = val[0];
				HEAP32[(pValues + 4) >> 2] = val[1];
				HEAP32[(pValues + 8) >> 2] = val[2];
				break;
			default:
				AL.currentCtx.err = 40962;
				return;
		}
	};
	_alGetSourceiv.sig = 'viip';

	var stringToNewUTF8 = (str) => {
		var size = lengthBytesUTF8(str) + 1;
		var ret = _malloc(size);
		if (ret) stringToUTF8(str, ret, size);
		return ret;
	};

	var _alGetString = (param) => {
		if (AL.stringCache[param]) {
			return AL.stringCache[param];
		}

		var ret;
		switch (param) {
			case 0:
				ret = 'No Error';
				break;
			case 40961:
				ret = 'Invalid Name';
				break;
			case 40962:
				ret = 'Invalid Enum';
				break;
			case 40963:
				ret = 'Invalid Value';
				break;
			case 40964:
				ret = 'Invalid Operation';
				break;
			case 0xa005 /* AL_OUT_OF_MEMORY */:
				ret = 'Out of Memory';
				break;
			case 0xb001 /* AL_VENDOR */:
				ret = 'Emscripten';
				break;
			case 0xb002 /* AL_VERSION */:
				ret = '1.1';
				break;
			case 0xb003 /* AL_RENDERER */:
				ret = 'WebAudio';
				break;
			case 0xb004 /* AL_EXTENSIONS */:
				ret = Object.keys(AL.AL_EXTENSIONS).join(' ');
				break;
			default:
				if (AL.currentCtx) {
					AL.currentCtx.err = 40962;
				} else {
				}
				return 0;
		}

		ret = stringToNewUTF8(ret);
		AL.stringCache[param] = ret;
		return ret;
	};
	_alGetString.sig = 'pi';

	var _alIsBuffer = (bufferId) => {
		if (!AL.currentCtx) {
			return false;
		}
		if (bufferId > AL.buffers.length) {
			return false;
		}

		if (!AL.buffers[bufferId]) {
			return false;
		}
		return true;
	};
	_alIsBuffer.sig = 'ii';

	var _alIsEnabled = (param) => {
		if (!AL.currentCtx) {
			return 0;
		}
		switch (param) {
			case 0x200 /* AL_SOURCE_DISTANCE_MODEL */:
				return AL.currentCtx.sourceDistanceModel ? 0 : 1;
			default:
				AL.currentCtx.err = 40962;
				return 0;
		}
	};
	_alIsEnabled.sig = 'ii';

	var _alIsExtensionPresent = (pExtName) => {
		var name = UTF8ToString(pExtName);

		return AL.AL_EXTENSIONS[name] ? 1 : 0;
	};
	_alIsExtensionPresent.sig = 'ip';

	var _alIsSource = (sourceId) => {
		if (!AL.currentCtx) {
			return false;
		}

		if (!AL.currentCtx.sources[sourceId]) {
			return false;
		}
		return true;
	};
	_alIsSource.sig = 'ii';

	var _alListener3f = (param, value0, value1, value2) => {
		switch (param) {
			case 4100:
			case 4102:
				AL.paramArray[0] = value0;
				AL.paramArray[1] = value1;
				AL.paramArray[2] = value2;
				AL.setListenerParam('alListener3f', param, AL.paramArray);
				break;
			default:
				AL.setListenerParam('alListener3f', param, null);
				break;
		}
	};
	_alListener3f.sig = 'vifff';

	var _alListener3i = (param, value0, value1, value2) => {
		switch (param) {
			case 4100:
			case 4102:
				AL.paramArray[0] = value0;
				AL.paramArray[1] = value1;
				AL.paramArray[2] = value2;
				AL.setListenerParam('alListener3i', param, AL.paramArray);
				break;
			default:
				AL.setListenerParam('alListener3i', param, null);
				break;
		}
	};
	_alListener3i.sig = 'viiii';

	var _alListenerf = (param, value) => {
		switch (param) {
			case 4106:
				AL.setListenerParam('alListenerf', param, value);
				break;
			default:
				AL.setListenerParam('alListenerf', param, null);
				break;
		}
	};
	_alListenerf.sig = 'vif';

	var _alListenerfv = (param, pValues) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4102:
				AL.paramArray[0] = HEAPF32[pValues >> 2];
				AL.paramArray[1] = HEAPF32[(pValues + 4) >> 2];
				AL.paramArray[2] = HEAPF32[(pValues + 8) >> 2];
				AL.setListenerParam('alListenerfv', param, AL.paramArray);
				break;
			case 4111:
				AL.paramArray[0] = HEAPF32[pValues >> 2];
				AL.paramArray[1] = HEAPF32[(pValues + 4) >> 2];
				AL.paramArray[2] = HEAPF32[(pValues + 8) >> 2];
				AL.paramArray[3] = HEAPF32[(pValues + 12) >> 2];
				AL.paramArray[4] = HEAPF32[(pValues + 16) >> 2];
				AL.paramArray[5] = HEAPF32[(pValues + 20) >> 2];
				AL.setListenerParam('alListenerfv', param, AL.paramArray);
				break;
			default:
				AL.setListenerParam('alListenerfv', param, null);
				break;
		}
	};
	_alListenerfv.sig = 'vip';

	var _alListeneri = (param, value) => {
		AL.setListenerParam('alListeneri', param, null);
	};
	_alListeneri.sig = 'vii';

	var _alListeneriv = (param, pValues) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 4100:
			case 4102:
				AL.paramArray[0] = HEAP32[pValues >> 2];
				AL.paramArray[1] = HEAP32[(pValues + 4) >> 2];
				AL.paramArray[2] = HEAP32[(pValues + 8) >> 2];
				AL.setListenerParam('alListeneriv', param, AL.paramArray);
				break;
			case 4111:
				AL.paramArray[0] = HEAP32[pValues >> 2];
				AL.paramArray[1] = HEAP32[(pValues + 4) >> 2];
				AL.paramArray[2] = HEAP32[(pValues + 8) >> 2];
				AL.paramArray[3] = HEAP32[(pValues + 12) >> 2];
				AL.paramArray[4] = HEAP32[(pValues + 16) >> 2];
				AL.paramArray[5] = HEAP32[(pValues + 20) >> 2];
				AL.setListenerParam('alListeneriv', param, AL.paramArray);
				break;
			default:
				AL.setListenerParam('alListeneriv', param, null);
				break;
		}
	};
	_alListeneriv.sig = 'vip';

	var _alSource3f = (sourceId, param, value0, value1, value2) => {
		switch (param) {
			case 4100:
			case 4101:
			case 4102:
				AL.paramArray[0] = value0;
				AL.paramArray[1] = value1;
				AL.paramArray[2] = value2;
				AL.setSourceParam('alSource3f', sourceId, param, AL.paramArray);
				break;
			default:
				AL.setSourceParam('alSource3f', sourceId, param, null);
				break;
		}
	};
	_alSource3f.sig = 'viifff';

	var _alSource3i = (sourceId, param, value0, value1, value2) => {
		switch (param) {
			case 4100:
			case 4101:
			case 4102:
				AL.paramArray[0] = value0;
				AL.paramArray[1] = value1;
				AL.paramArray[2] = value2;
				AL.setSourceParam('alSource3i', sourceId, param, AL.paramArray);
				break;
			default:
				AL.setSourceParam('alSource3i', sourceId, param, null);
				break;
		}
	};
	_alSource3i.sig = 'viiiii';

	var _alSourcePause = (sourceId) => {
		if (!AL.currentCtx) {
			return;
		}
		var src = AL.currentCtx.sources[sourceId];
		if (!src) {
			AL.currentCtx.err = 40961;
			return;
		}
		AL.setSourceState(src, 4115);
	};
	_alSourcePause.sig = 'vi';

	var _alSourcePausev = (count, pSourceIds) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pSourceIds) {
			AL.currentCtx.err = 40963;
		}
		for (var i = 0; i < count; ++i) {
			if (!AL.currentCtx.sources[HEAP32[(pSourceIds + i * 4) >> 2]]) {
				AL.currentCtx.err = 40961;
				return;
			}
		}

		for (var i = 0; i < count; ++i) {
			var srcId = HEAP32[(pSourceIds + i * 4) >> 2];
			AL.setSourceState(AL.currentCtx.sources[srcId], 4115);
		}
	};
	_alSourcePausev.sig = 'vip';

	var _alSourcePlay = (sourceId) => {
		if (!AL.currentCtx) {
			return;
		}
		var src = AL.currentCtx.sources[sourceId];
		if (!src) {
			AL.currentCtx.err = 40961;
			return;
		}
		AL.setSourceState(src, 4114);
	};
	_alSourcePlay.sig = 'vi';

	var _alSourcePlayv = (count, pSourceIds) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pSourceIds) {
			AL.currentCtx.err = 40963;
		}
		for (var i = 0; i < count; ++i) {
			if (!AL.currentCtx.sources[HEAP32[(pSourceIds + i * 4) >> 2]]) {
				AL.currentCtx.err = 40961;
				return;
			}
		}

		for (var i = 0; i < count; ++i) {
			var srcId = HEAP32[(pSourceIds + i * 4) >> 2];
			AL.setSourceState(AL.currentCtx.sources[srcId], 4114);
		}
	};
	_alSourcePlayv.sig = 'vip';

	var _alSourceQueueBuffers = (sourceId, count, pBufferIds) => {
		if (!AL.currentCtx) {
			return;
		}
		var src = AL.currentCtx.sources[sourceId];
		if (!src) {
			AL.currentCtx.err = 40961;
			return;
		}
		if (src.type === 4136) {
			AL.currentCtx.err = 40964;
			return;
		}

		if (count === 0) {
			return;
		}

		// Find the first non-zero buffer in the queue to determine the proper format
		var templateBuf = AL.buffers[0];
		for (var buf of src.bufQueue) {
			if (buf.id !== 0) {
				templateBuf = buf;
				break;
			}
		}

		for (var i = 0; i < count; ++i) {
			var bufId = HEAP32[(pBufferIds + i * 4) >> 2];
			var buf = AL.buffers[bufId];
			if (!buf) {
				AL.currentCtx.err = 40961;
				return;
			}

			// Check that the added buffer has the correct format. If the template is the zero buffer, any format is valid.
			if (
				templateBuf.id !== 0 &&
				(buf.frequency !== templateBuf.frequency ||
					buf.bytesPerSample !== templateBuf.bytesPerSample ||
					buf.channels !== templateBuf.channels)
			) {
				AL.currentCtx.err = 40964;
			}
		}

		// If the only buffer in the queue is the zero buffer, clear the queue before we add anything.
		if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
			src.bufQueue.length = 0;
		}

		src.type = 0x1029 /* AL_STREAMING */;
		for (var i = 0; i < count; ++i) {
			var bufId = HEAP32[(pBufferIds + i * 4) >> 2];
			var buf = AL.buffers[bufId];
			buf.refCount++;
			src.bufQueue.push(buf);
		}

		// if the source is looping, cancel the schedule so we can reschedule the loop order
		if (src.looping) {
			AL.cancelPendingSourceAudio(src);
		}

		AL.initSourcePanner(src);
		AL.scheduleSourceAudio(src);
	};
	_alSourceQueueBuffers.sig = 'viip';

	var _alSourceRewind = (sourceId) => {
		if (!AL.currentCtx) {
			return;
		}
		var src = AL.currentCtx.sources[sourceId];
		if (!src) {
			AL.currentCtx.err = 40961;
			return;
		}
		// Stop the source first to clear the source queue
		AL.setSourceState(src, 4116);
		// Now set the state of AL_INITIAL according to the specification
		AL.setSourceState(src, 4113);
	};
	_alSourceRewind.sig = 'vi';

	var _alSourceRewindv = (count, pSourceIds) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pSourceIds) {
			AL.currentCtx.err = 40963;
		}
		for (var i = 0; i < count; ++i) {
			if (!AL.currentCtx.sources[HEAP32[(pSourceIds + i * 4) >> 2]]) {
				AL.currentCtx.err = 40961;
				return;
			}
		}

		for (var i = 0; i < count; ++i) {
			var srcId = HEAP32[(pSourceIds + i * 4) >> 2];
			AL.setSourceState(AL.currentCtx.sources[srcId], 4113);
		}
	};
	_alSourceRewindv.sig = 'vip';

	var _alSourceStop = (sourceId) => {
		if (!AL.currentCtx) {
			return;
		}
		var src = AL.currentCtx.sources[sourceId];
		if (!src) {
			AL.currentCtx.err = 40961;
			return;
		}
		AL.setSourceState(src, 4116);
	};
	_alSourceStop.sig = 'vi';

	var _alSourceStopv = (count, pSourceIds) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pSourceIds) {
			AL.currentCtx.err = 40963;
		}
		for (var i = 0; i < count; ++i) {
			if (!AL.currentCtx.sources[HEAP32[(pSourceIds + i * 4) >> 2]]) {
				AL.currentCtx.err = 40961;
				return;
			}
		}

		for (var i = 0; i < count; ++i) {
			var srcId = HEAP32[(pSourceIds + i * 4) >> 2];
			AL.setSourceState(AL.currentCtx.sources[srcId], 4116);
		}
	};
	_alSourceStopv.sig = 'vip';

	var _alSourceUnqueueBuffers = (sourceId, count, pBufferIds) => {
		if (!AL.currentCtx) {
			return;
		}
		var src = AL.currentCtx.sources[sourceId];
		if (!src) {
			AL.currentCtx.err = 40961;
			return;
		}
		if (
			count >
			(src.bufQueue.length === 1 && src.bufQueue[0].id === 0
				? 0
				: src.bufsProcessed)
		) {
			AL.currentCtx.err = 40963;
			return;
		}

		if (count === 0) {
			return;
		}

		for (var i = 0; i < count; i++) {
			var buf = src.bufQueue.shift();
			buf.refCount--;
			// Write the buffers index out to the return list.
			HEAP32[(pBufferIds + i * 4) >> 2] = buf.id;
			src.bufsProcessed--;
		}

		/// If the queue is empty, put the zero buffer back in
		if (src.bufQueue.length === 0) {
			src.bufQueue.push(AL.buffers[0]);
		}

		AL.initSourcePanner(src);
		AL.scheduleSourceAudio(src);
	};
	_alSourceUnqueueBuffers.sig = 'viip';

	var _alSourcef = (sourceId, param, value) => {
		switch (param) {
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1003 /* AL_PITCH */:
			case 4106:
			case 0x100d /* AL_MIN_GAIN */:
			case 0x100e /* AL_MAX_GAIN */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1022 /* AL_CONE_OUTER_GAIN */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x200b /* AL_SEC_LENGTH_SOFT */:
				AL.setSourceParam('alSourcef', sourceId, param, value);
				break;
			default:
				AL.setSourceParam('alSourcef', sourceId, param, null);
				break;
		}
	};
	_alSourcef.sig = 'viif';

	var _alSourcefv = (sourceId, param, pValues) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1003 /* AL_PITCH */:
			case 4106:
			case 0x100d /* AL_MIN_GAIN */:
			case 0x100e /* AL_MAX_GAIN */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1022 /* AL_CONE_OUTER_GAIN */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x200b /* AL_SEC_LENGTH_SOFT */:
				var val = HEAPF32[pValues >> 2];
				AL.setSourceParam('alSourcefv', sourceId, param, val);
				break;
			case 4100:
			case 4101:
			case 4102:
				AL.paramArray[0] = HEAPF32[pValues >> 2];
				AL.paramArray[1] = HEAPF32[(pValues + 4) >> 2];
				AL.paramArray[2] = HEAPF32[(pValues + 8) >> 2];
				AL.setSourceParam('alSourcefv', sourceId, param, AL.paramArray);
				break;
			default:
				AL.setSourceParam('alSourcefv', sourceId, param, null);
				break;
		}
	};
	_alSourcefv.sig = 'viip';

	var _alSourceiv = (sourceId, param, pValues) => {
		if (!AL.currentCtx) {
			return;
		}
		if (!pValues) {
			AL.currentCtx.err = 40963;
			return;
		}

		switch (param) {
			case 0x202 /* AL_SOURCE_RELATIVE */:
			case 0x1001 /* AL_CONE_INNER_ANGLE */:
			case 0x1002 /* AL_CONE_OUTER_ANGLE */:
			case 0x1007 /* AL_LOOPING */:
			case 0x1009 /* AL_BUFFER */:
			case 0x1020 /* AL_REFERENCE_DISTANCE */:
			case 0x1021 /* AL_ROLLOFF_FACTOR */:
			case 0x1023 /* AL_MAX_DISTANCE */:
			case 0x1024 /* AL_SEC_OFFSET */:
			case 0x1025 /* AL_SAMPLE_OFFSET */:
			case 0x1026 /* AL_BYTE_OFFSET */:
			case 0x1214 /* AL_SOURCE_SPATIALIZE_SOFT */:
			case 0x2009 /* AL_BYTE_LENGTH_SOFT */:
			case 0x200a /* AL_SAMPLE_LENGTH_SOFT */:
			case 53248:
				var val = HEAP32[pValues >> 2];
				AL.setSourceParam('alSourceiv', sourceId, param, val);
				break;
			case 4100:
			case 4101:
			case 4102:
				AL.paramArray[0] = HEAP32[pValues >> 2];
				AL.paramArray[1] = HEAP32[(pValues + 4) >> 2];
				AL.paramArray[2] = HEAP32[(pValues + 8) >> 2];
				AL.setSourceParam('alSourceiv', sourceId, param, AL.paramArray);
				break;
			default:
				AL.setSourceParam('alSourceiv', sourceId, param, null);
				break;
		}
	};
	_alSourceiv.sig = 'viip';

	var _alSpeedOfSound = (value) => {
		AL.setGlobalParam('alSpeedOfSound', 49155, value);
	};
	_alSpeedOfSound.sig = 'vf';

	var _alcCaptureCloseDevice = (deviceId) => {
		var c = AL.requireValidCaptureDevice(deviceId, 'alcCaptureCloseDevice');
		if (!c) return false;

		delete AL.captures[deviceId];
		AL.freeIds.push(deviceId);

		// This clean-up might be unnecessary (paranoid) ?

		// May happen if user hasn't decided to grant or deny input
		c.mediaStreamSourceNode?.disconnect();
		c.mergerNode?.disconnect();
		c.splitterNode?.disconnect();
		// May happen if user hasn't decided to grant or deny input
		c.scriptProcessorNode?.disconnect();
		if (c.mediaStream) {
			// Disabling the microphone of the browser.
			// Without this operation, the red dot on the browser tab page will remain.
			c.mediaStream.getTracks().forEach((track) => track.stop());
		}

		delete c.buffers;

		c.capturedFrameCount = 0;
		c.isCapturing = false;

		return true;
	};
	_alcCaptureCloseDevice.sig = 'ip';

	var autoResumeAudioContext = (ctx) => {
		for (var event of ['keydown', 'mousedown', 'touchstart']) {
			for (var element of [document, document.getElementById('canvas')]) {
				element?.addEventListener(
					event,
					() => {
						if (ctx.state === 'suspended') ctx.resume();
					},
					{ once: true }
				);
			}
		}
	};

	var _alcCaptureOpenDevice = (
		pDeviceName,
		requestedSampleRate,
		format,
		bufferFrameCapacity
	) => {
		var resolvedDeviceName = AL.CAPTURE_DEVICE_NAME;

		// NULL is a valid device name here (resolves to default);
		if (pDeviceName !== 0) {
			resolvedDeviceName = UTF8ToString(pDeviceName);
			if (resolvedDeviceName !== AL.CAPTURE_DEVICE_NAME) {
				// ALC_OUT_OF_MEMORY
				// From the programmer's guide, ALC_OUT_OF_MEMORY's meaning is
				// overloaded here, to mean:
				// 'The specified device is invalid, or can not capture audio.'
				// This may be misleading to API users, but well...
				AL.alcErr = 0xa005 /* ALC_OUT_OF_MEMORY */;
				return 0;
			}
		}

		// Otherwise it's probably okay (though useless) for bufferFrameCapacity to be zero.
		if (bufferFrameCapacity < 0) {
			// ALCsizei is signed int
			AL.alcErr = 40964;
			return 0;
		}

		navigator.getUserMedia =
			navigator.getUserMedia ||
			navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia ||
			navigator.msGetUserMedia;
		var has_getUserMedia =
			navigator.getUserMedia ||
			(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

		if (!has_getUserMedia) {
			// See previously mentioned rationale for ALC_OUT_OF_MEMORY
			AL.alcErr = 0xa005 /* ALC_OUT_OF_MEMORY */;
			return 0;
		}

		var AudioContext = window.AudioContext || window.webkitAudioContext;

		if (!AL.sharedCaptureAudioCtx) {
			try {
				AL.sharedCaptureAudioCtx = new AudioContext();
			} catch (e) {
				// See previously mentioned rationale for ALC_OUT_OF_MEMORY
				AL.alcErr = 0xa005 /* ALC_OUT_OF_MEMORY */;
				return 0;
			}
		}

		autoResumeAudioContext(AL.sharedCaptureAudioCtx);

		var outputChannelCount;

		switch (format) {
			case 0x10010: /* AL_FORMAT_MONO_FLOAT32 */
			case 0x1101: /* AL_FORMAT_MONO16 */
			case 0x1100 /* AL_FORMAT_MONO8 */:
				outputChannelCount = 1;
				break;
			case 0x10011: /* AL_FORMAT_STEREO_FLOAT32 */
			case 0x1103: /* AL_FORMAT_STEREO16 */
			case 0x1102 /* AL_FORMAT_STEREO8 */:
				outputChannelCount = 2;
				break;
			default:
				AL.alcErr = 40964;
				return 0;
		}

		function newF32Array(cap) {
			return new Float32Array(cap);
		}
		function newI16Array(cap) {
			return new Int16Array(cap);
		}
		function newU8Array(cap) {
			return new Uint8Array(cap);
		}

		var requestedSampleType;
		var newSampleArray;

		switch (format) {
			case 0x10010: /* AL_FORMAT_MONO_FLOAT32 */
			case 0x10011 /* AL_FORMAT_STEREO_FLOAT32 */:
				requestedSampleType = 'f32';
				newSampleArray = newF32Array;
				break;
			case 0x1101: /* AL_FORMAT_MONO16 */
			case 0x1103 /* AL_FORMAT_STEREO16 */:
				requestedSampleType = 'i16';
				newSampleArray = newI16Array;
				break;
			case 0x1100: /* AL_FORMAT_MONO8 */
			case 0x1102 /* AL_FORMAT_STEREO8 */:
				requestedSampleType = 'u8';
				newSampleArray = newU8Array;
				break;
		}

		var buffers = [];
		try {
			for (var chan = 0; chan < outputChannelCount; ++chan) {
				buffers[chan] = newSampleArray(bufferFrameCapacity);
			}
		} catch (e) {
			AL.alcErr = 0xa005 /* ALC_OUT_OF_MEMORY */;
			return 0;
		}

		// What we'll place into the `AL.captures` array in the end,
		// declared here for closures to access it
		var newCapture = {
			audioCtx: AL.sharedCaptureAudioCtx,
			deviceName: resolvedDeviceName,
			requestedSampleRate,
			requestedSampleType,
			outputChannelCount,
			inputChannelCount: null, // Not known until the getUserMedia() promise resolves
			mediaStreamError: null, // Used by other functions to return early and report an error.
			mediaStreamSourceNode: null,
			mediaStream: null,
			// Either one, or none of the below two, is active.
			mergerNode: null,
			splitterNode: null,
			scriptProcessorNode: null,
			isCapturing: false,
			buffers,
			get bufferFrameCapacity() {
				return buffers[0].length;
			},
			capturePlayhead: 0, // current write position, in sample frames
			captureReadhead: 0,
			capturedFrameCount: 0,
		};

		// Preparing for getUserMedia()

		var onError = (mediaStreamError) => {
			newCapture.mediaStreamError = mediaStreamError;
		};
		var onSuccess = (mediaStream) => {
			newCapture.mediaStreamSourceNode =
				newCapture.audioCtx.createMediaStreamSource(mediaStream);
			newCapture.mediaStream = mediaStream;

			var inputChannelCount = 1;
			switch (newCapture.mediaStreamSourceNode.channelCountMode) {
				case 'max':
					inputChannelCount = outputChannelCount;
					break;
				case 'clamped-max':
					inputChannelCount = Math.min(
						outputChannelCount,
						newCapture.mediaStreamSourceNode.channelCount
					);
					break;
				case 'explicit':
					inputChannelCount =
						newCapture.mediaStreamSourceNode.channelCount;
					break;
			}

			newCapture.inputChannelCount = inputChannelCount;

			// Have to pick a size from 256, 512, 1024, 2048, 4096, 8192, 16384.
			// One can also set it to zero, which leaves the decision up to the impl.
			// An extension could allow specifying this value.
			var processorFrameCount = 512;

			newCapture.scriptProcessorNode =
				newCapture.audioCtx.createScriptProcessor(
					processorFrameCount,
					inputChannelCount,
					outputChannelCount
				);

			if (inputChannelCount > outputChannelCount) {
				newCapture.mergerNode =
					newCapture.audioCtx.createChannelMerger(inputChannelCount);
				newCapture.mediaStreamSourceNode.connect(newCapture.mergerNode);
				newCapture.mergerNode.connect(newCapture.scriptProcessorNode);
			} else if (inputChannelCount < outputChannelCount) {
				newCapture.splitterNode =
					newCapture.audioCtx.createChannelSplitter(
						outputChannelCount
					);
				newCapture.mediaStreamSourceNode.connect(
					newCapture.splitterNode
				);
				newCapture.splitterNode.connect(newCapture.scriptProcessorNode);
			} else {
				newCapture.mediaStreamSourceNode.connect(
					newCapture.scriptProcessorNode
				);
			}

			newCapture.scriptProcessorNode.connect(
				newCapture.audioCtx.destination
			);

			newCapture.scriptProcessorNode.onaudioprocess = (
				audioProcessingEvent
			) => {
				if (!newCapture.isCapturing) {
					return;
				}

				var c = newCapture;
				var srcBuf = audioProcessingEvent.inputBuffer;

				// Actually just copy srcBuf's channel data into
				// c.buffers, optimizing for each case.
				switch (format) {
					case 0x10010 /* AL_FORMAT_MONO_FLOAT32 */:
						var channel0 = srcBuf.getChannelData(0);
						for (var i = 0; i < srcBuf.length; ++i) {
							var wi =
								(c.capturePlayhead + i) % c.bufferFrameCapacity;
							c.buffers[0][wi] = channel0[i];
						}
						break;
					case 0x10011 /* AL_FORMAT_STEREO_FLOAT32 */:
						var channel0 = srcBuf.getChannelData(0);
						var channel1 = srcBuf.getChannelData(1);
						for (var i = 0; i < srcBuf.length; ++i) {
							var wi =
								(c.capturePlayhead + i) % c.bufferFrameCapacity;
							c.buffers[0][wi] = channel0[i];
							c.buffers[1][wi] = channel1[i];
						}
						break;
					case 0x1101 /* AL_FORMAT_MONO16 */:
						var channel0 = srcBuf.getChannelData(0);
						for (var i = 0; i < srcBuf.length; ++i) {
							var wi =
								(c.capturePlayhead + i) % c.bufferFrameCapacity;
							c.buffers[0][wi] = channel0[i] * 32767;
						}
						break;
					case 0x1103 /* AL_FORMAT_STEREO16 */:
						var channel0 = srcBuf.getChannelData(0);
						var channel1 = srcBuf.getChannelData(1);
						for (var i = 0; i < srcBuf.length; ++i) {
							var wi =
								(c.capturePlayhead + i) % c.bufferFrameCapacity;
							c.buffers[0][wi] = channel0[i] * 32767;
							c.buffers[1][wi] = channel1[i] * 32767;
						}
						break;
					case 0x1100 /* AL_FORMAT_MONO8 */:
						var channel0 = srcBuf.getChannelData(0);
						for (var i = 0; i < srcBuf.length; ++i) {
							var wi =
								(c.capturePlayhead + i) % c.bufferFrameCapacity;
							c.buffers[0][wi] = (channel0[i] + 1.0) * 127;
						}
						break;
					case 0x1102 /* AL_FORMAT_STEREO8 */:
						var channel0 = srcBuf.getChannelData(0);
						var channel1 = srcBuf.getChannelData(1);
						for (var i = 0; i < srcBuf.length; ++i) {
							var wi =
								(c.capturePlayhead + i) % c.bufferFrameCapacity;
							c.buffers[0][wi] = (channel0[i] + 1.0) * 127;
							c.buffers[1][wi] = (channel1[i] + 1.0) * 127;
						}
						break;
				}

				c.capturePlayhead += srcBuf.length;
				c.capturePlayhead %= c.bufferFrameCapacity;
				c.capturedFrameCount += srcBuf.length;
				c.capturedFrameCount = Math.min(
					c.capturedFrameCount,
					c.bufferFrameCapacity
				);
			};
		};

		// The latest way to call getUserMedia()
		if (navigator.mediaDevices?.getUserMedia) {
			navigator.mediaDevices
				.getUserMedia({ audio: true })
				.then(onSuccess)
				.catch(onError);
		} else {
			// The usual (now deprecated) way
			navigator.getUserMedia({ audio: true }, onSuccess, onError);
		}

		var id = AL.newId();
		AL.captures[id] = newCapture;
		return id;
	};
	_alcCaptureOpenDevice.sig = 'ppiii';

	var _alcCaptureSamples = (deviceId, pFrames, requestedFrameCount) => {
		var c = AL.requireValidCaptureDevice(deviceId, 'alcCaptureSamples');
		if (!c) return;

		// ALCsizei is actually 32-bit signed int, so could be negative
		// Also, spec says :
		//   Requesting more sample frames than are currently available is
		//   an error.

		var dstfreq = c.requestedSampleRate;
		var srcfreq = c.audioCtx.sampleRate;

		var fratio = srcfreq / dstfreq;

		if (
			requestedFrameCount < 0 ||
			requestedFrameCount > c.capturedFrameCount / fratio
		) {
			AL.alcErr = 40964;
			return;
		}

		function setF32Sample(i, sample) {
			HEAPF32[(pFrames + 4 * i) >> 2] = sample;
		}
		function setI16Sample(i, sample) {
			HEAP16[(pFrames + 2 * i) >> 1] = sample;
		}
		function setU8Sample(i, sample) {
			HEAP8[pFrames + i] = sample;
		}

		var setSample;

		switch (c.requestedSampleType) {
			case 'f32':
				setSample = setF32Sample;
				break;
			case 'i16':
				setSample = setI16Sample;
				break;
			case 'u8':
				setSample = setU8Sample;
				break;
			default:
				return;
		}

		// If fratio is an integer we don't need linear resampling, just skip samples
		if (Math.floor(fratio) == fratio) {
			for (
				var i = 0, frame_i = 0;
				frame_i < requestedFrameCount;
				++frame_i
			) {
				for (var chan = 0; chan < c.buffers.length; ++chan, ++i) {
					setSample(i, c.buffers[chan][c.captureReadhead]);
				}
				c.captureReadhead =
					(fratio + c.captureReadhead) % c.bufferFrameCapacity;
			}
		} else {
			// Perform linear resampling.

			// There is room for improvement - right now we're fine with linear resampling.
			// We don't use OfflineAudioContexts for this: See the discussion at
			// https://github.com/jpernst/emscripten/issues/2#issuecomment-312729735
			// if you're curious about why.
			for (
				var i = 0, frame_i = 0;
				frame_i < requestedFrameCount;
				++frame_i
			) {
				var lefti = Math.floor(c.captureReadhead);
				var righti = Math.ceil(c.captureReadhead);
				var d = c.captureReadhead - lefti;
				for (var chan = 0; chan < c.buffers.length; ++chan, ++i) {
					var lefts = c.buffers[chan][lefti];
					var rights = c.buffers[chan][righti];
					setSample(i, (1 - d) * lefts + d * rights);
				}
				c.captureReadhead =
					(c.captureReadhead + fratio) % c.bufferFrameCapacity;
			}
		}

		// Spec doesn't say if alcCaptureSamples() must zero the number
		// of available captured sample-frames, but not only would it
		// be insane not to do, OpenAL-Soft happens to do that as well.
		c.capturedFrameCount = 0;
	};
	_alcCaptureSamples.sig = 'vppi';

	var _alcCaptureStart = (deviceId) => {
		var c = AL.requireValidCaptureDevice(deviceId, 'alcCaptureStart');
		if (!c) return;

		if (c.isCapturing) {
			// NOTE: Spec says (emphasis mine):
			//     The amount of audio samples available after **restarting** a
			//     stopped capture device is reset to zero.
			// So redundant calls to alcCaptureStart() must have no effect.
			return;
		}
		c.isCapturing = true;
		c.capturedFrameCount = 0;
		c.capturePlayhead = 0;
	};
	_alcCaptureStart.sig = 'vp';

	var _alcCaptureStop = (deviceId) => {
		var c = AL.requireValidCaptureDevice(deviceId, 'alcCaptureStop');
		if (!c) return;

		c.isCapturing = false;
	};
	_alcCaptureStop.sig = 'vp';

	var _alcCloseDevice = (deviceId) => {
		if (
			!(deviceId in AL.deviceRefCounts) ||
			AL.deviceRefCounts[deviceId] > 0
		) {
			return 0;
		}

		delete AL.deviceRefCounts[deviceId];
		AL.freeIds.push(deviceId);
		return 1;
	};
	_alcCloseDevice.sig = 'ip';

	var _alcCreateContext = (deviceId, pAttrList) => {
		if (!(deviceId in AL.deviceRefCounts)) {
			AL.alcErr = 0xa001; /* ALC_INVALID_DEVICE */
			return 0;
		}

		var options = null;
		var attrs = [];
		var hrtf = null;
		pAttrList >>= 2;
		if (pAttrList) {
			var attr = 0;
			var val = 0;
			while (true) {
				attr = HEAP32[pAttrList++];
				attrs.push(attr);
				if (attr === 0) {
					break;
				}
				val = HEAP32[pAttrList++];
				attrs.push(val);

				switch (attr) {
					case 0x1007 /* ALC_FREQUENCY */:
						if (!options) {
							options = {};
						}

						options.sampleRate = val;
						break;
					case 0x1010 /* ALC_MONO_SOURCES */: // fallthrough
					case 0x1011 /* ALC_STEREO_SOURCES */:
						// Do nothing; these hints are satisfied by default
						break;
					case 0x1992 /* ALC_HRTF_SOFT */:
						switch (val) {
							case 0:
								hrtf = false;
								break;
							case 1:
								hrtf = true;
								break;
							case 2 /* ALC_DONT_CARE_SOFT */:
								break;
							default:
								AL.alcErr = 40964;
								return 0;
						}
						break;
					case 0x1996 /* ALC_HRTF_ID_SOFT */:
						if (val !== 0) {
							AL.alcErr = 40964;
							return 0;
						}
						break;
					default:
						AL.alcErr = 0xa004; /* ALC_INVALID_VALUE */
						return 0;
				}
			}
		}

		var AudioContext = window.AudioContext || window.webkitAudioContext;
		var ac = null;
		try {
			// Only try to pass options if there are any, for compat with browsers that don't support this
			if (options) {
				ac = new AudioContext(options);
			} else {
				ac = new AudioContext();
			}
		} catch (e) {
			if (e.name === 'NotSupportedError') {
				AL.alcErr = 0xa004; /* ALC_INVALID_VALUE */
			} else {
				AL.alcErr = 0xa001; /* ALC_INVALID_DEVICE */
			}

			return 0;
		}

		autoResumeAudioContext(ac);

		// Old Web Audio API (e.g. Safari 6.0.5) had an inconsistently named createGainNode function.
		if (typeof ac.createGain == 'undefined') {
			ac.createGain = ac.createGainNode;
		}

		var gain = ac.createGain();
		gain.connect(ac.destination);
		var ctx = {
			deviceId,
			id: AL.newId(),
			attrs,
			audioCtx: ac,
			listener: {
				position: [0.0, 0.0, 0.0],
				velocity: [0.0, 0.0, 0.0],
				direction: [0.0, 0.0, 0.0],
				up: [0.0, 0.0, 0.0],
			},
			sources: [],
			interval: setInterval(
				() => AL.scheduleContextAudio(ctx),
				AL.QUEUE_INTERVAL
			),
			gain,
			distanceModel: 0xd002 /* AL_INVERSE_DISTANCE_CLAMPED */,
			speedOfSound: 343.3,
			dopplerFactor: 1.0,
			sourceDistanceModel: false,
			hrtf: hrtf || false,

			_err: 0,
			get err() {
				return this._err;
			},
			set err(val) {
				// Errors should not be overwritten by later errors until they are cleared by a query.
				if (this._err === 0 || val === 0) {
					this._err = val;
				}
			},
		};
		AL.deviceRefCounts[deviceId]++;
		AL.contexts[ctx.id] = ctx;

		if (hrtf !== null) {
			// Apply hrtf attrib to all contexts for this device
			for (var ctxId in AL.contexts) {
				var c = AL.contexts[ctxId];
				if (c.deviceId === deviceId) {
					c.hrtf = hrtf;
					AL.updateContextGlobal(c);
				}
			}
		}

		return ctx.id;
	};
	_alcCreateContext.sig = 'ppp';

	var _alcDestroyContext = (contextId) => {
		var ctx = AL.contexts[contextId];
		if (AL.currentCtx === ctx) {
			AL.alcErr = 0xa002 /* ALC_INVALID_CONTEXT */;
			return;
		}

		// Stop playback, etc
		if (AL.contexts[contextId].interval) {
			clearInterval(AL.contexts[contextId].interval);
		}
		AL.deviceRefCounts[ctx.deviceId]--;
		delete AL.contexts[contextId];
		AL.freeIds.push(contextId);
	};
	_alcDestroyContext.sig = 'vp';

	var _alcGetContextsDevice = (contextId) => {
		if (contextId in AL.contexts) {
			return AL.contexts[contextId].deviceId;
		}
		return 0;
	};
	_alcGetContextsDevice.sig = 'pp';

	var _alcGetCurrentContext = () => {
		if (AL.currentCtx !== null) {
			return AL.currentCtx.id;
		}
		return 0;
	};
	_alcGetCurrentContext.sig = 'p';

	var _alcGetEnumValue = (deviceId, pEnumName) => {
		// Spec says :
		// Using a NULL handle is legal, but only the
		// tokens defined by the AL core are guaranteed.
		if (deviceId !== 0 && !(deviceId in AL.deviceRefCounts)) {
			// ALC_INVALID_DEVICE is not listed as a possible error state for
			// this function, sadly.
			return 0;
		} else if (!pEnumName) {
			AL.alcErr = 40964;
			return 0;
		}
		var name = UTF8ToString(pEnumName);
		// See alGetEnumValue(), but basically behave the same as OpenAL-Soft
		switch (name) {
			case 'ALC_NO_ERROR':
				return 0;
			case 'ALC_INVALID_DEVICE':
				return 0xa001;
			case 'ALC_INVALID_CONTEXT':
				return 0xa002;
			case 'ALC_INVALID_ENUM':
				return 0xa003;
			case 'ALC_INVALID_VALUE':
				return 0xa004;
			case 'ALC_OUT_OF_MEMORY':
				return 0xa005;
			case 'ALC_MAJOR_VERSION':
				return 0x1000;
			case 'ALC_MINOR_VERSION':
				return 0x1001;
			case 'ALC_ATTRIBUTES_SIZE':
				return 0x1002;
			case 'ALC_ALL_ATTRIBUTES':
				return 0x1003;
			case 'ALC_DEFAULT_DEVICE_SPECIFIER':
				return 0x1004;
			case 'ALC_DEVICE_SPECIFIER':
				return 0x1005;
			case 'ALC_EXTENSIONS':
				return 0x1006;
			case 'ALC_FREQUENCY':
				return 0x1007;
			case 'ALC_REFRESH':
				return 0x1008;
			case 'ALC_SYNC':
				return 0x1009;
			case 'ALC_MONO_SOURCES':
				return 0x1010;
			case 'ALC_STEREO_SOURCES':
				return 0x1011;
			case 'ALC_CAPTURE_DEVICE_SPECIFIER':
				return 0x310;
			case 'ALC_CAPTURE_DEFAULT_DEVICE_SPECIFIER':
				return 0x311;
			case 'ALC_CAPTURE_SAMPLES':
				return 0x312;

			/* Extensions */
			case 'ALC_HRTF_SOFT':
				return 0x1992;
			case 'ALC_HRTF_ID_SOFT':
				return 0x1996;
			case 'ALC_DONT_CARE_SOFT':
				return 0x0002;
			case 'ALC_HRTF_STATUS_SOFT':
				return 0x1993;
			case 'ALC_NUM_HRTF_SPECIFIERS_SOFT':
				return 0x1994;
			case 'ALC_HRTF_SPECIFIER_SOFT':
				return 0x1995;
			case 'ALC_HRTF_DISABLED_SOFT':
				return 0x0000;
			case 'ALC_HRTF_ENABLED_SOFT':
				return 0x0001;
			case 'ALC_HRTF_DENIED_SOFT':
				return 0x0002;
			case 'ALC_HRTF_REQUIRED_SOFT':
				return 0x0003;
			case 'ALC_HRTF_HEADPHONES_DETECTED_SOFT':
				return 0x0004;
			case 'ALC_HRTF_UNSUPPORTED_FORMAT_SOFT':
				return 0x0005;

			default:
				AL.alcErr = 40964;
				return 0;
		}
	};
	_alcGetEnumValue.sig = 'ipp';

	var _alcGetError = (deviceId) => {
		var err = AL.alcErr;
		AL.alcErr = 0;
		return err;
	};
	_alcGetError.sig = 'ip';

	var _alcGetIntegerv = (deviceId, param, size, pValues) => {
		if (size === 0 || !pValues) {
			// Ignore the query, per the spec
			return;
		}

		switch (param) {
			case 0x1000 /* ALC_MAJOR_VERSION */:
				HEAP32[pValues >> 2] = 1;
				break;
			case 0x1001 /* ALC_MINOR_VERSION */:
				HEAP32[pValues >> 2] = 1;
				break;
			case 0x1002 /* ALC_ATTRIBUTES_SIZE */:
				if (!(deviceId in AL.deviceRefCounts)) {
					AL.alcErr = 40961;
					return;
				}
				if (!AL.currentCtx) {
					AL.alcErr = 0xa002 /* ALC_INVALID_CONTEXT */;
					return;
				}

				HEAP32[pValues >> 2] = AL.currentCtx.attrs.length;
				break;
			case 0x1003 /* ALC_ALL_ATTRIBUTES */:
				if (!(deviceId in AL.deviceRefCounts)) {
					AL.alcErr = 40961;
					return;
				}
				if (!AL.currentCtx) {
					AL.alcErr = 0xa002 /* ALC_INVALID_CONTEXT */;
					return;
				}

				for (var i = 0; i < AL.currentCtx.attrs.length; i++) {
					HEAP32[(pValues + i * 4) >> 2] = AL.currentCtx.attrs[i];
				}
				break;
			case 0x1007 /* ALC_FREQUENCY */:
				if (!(deviceId in AL.deviceRefCounts)) {
					AL.alcErr = 40961;
					return;
				}
				if (!AL.currentCtx) {
					AL.alcErr = 0xa002 /* ALC_INVALID_CONTEXT */;
					return;
				}

				HEAP32[pValues >> 2] = AL.currentCtx.audioCtx.sampleRate;
				break;
			case 0x1010 /* ALC_MONO_SOURCES */:
			case 0x1011 /* ALC_STEREO_SOURCES */:
				if (!(deviceId in AL.deviceRefCounts)) {
					AL.alcErr = 40961;
					return;
				}
				if (!AL.currentCtx) {
					AL.alcErr = 0xa002 /* ALC_INVALID_CONTEXT */;
					return;
				}

				HEAP32[pValues >> 2] = 0x7fffffff;
				break;
			case 0x1992 /* ALC_HRTF_SOFT */:
			case 0x1993 /* ALC_HRTF_STATUS_SOFT */:
				if (!(deviceId in AL.deviceRefCounts)) {
					AL.alcErr = 40961;
					return;
				}

				var hrtfStatus = 0; /* ALC_HRTF_DISABLED_SOFT */
				for (var ctxId in AL.contexts) {
					var ctx = AL.contexts[ctxId];
					if (ctx.deviceId === deviceId) {
						hrtfStatus = ctx.hrtf
							? 1 /* ALC_HRTF_ENABLED_SOFT */
							: 0 /* ALC_HRTF_DISABLED_SOFT */;
					}
				}
				HEAP32[pValues >> 2] = hrtfStatus;
				break;
			case 0x1994 /* ALC_NUM_HRTF_SPECIFIERS_SOFT */:
				if (!(deviceId in AL.deviceRefCounts)) {
					AL.alcErr = 40961;
					return;
				}
				HEAP32[pValues >> 2] = 1;
				break;
			case 0x20003 /* ALC_MAX_AUXILIARY_SENDS */:
				if (!(deviceId in AL.deviceRefCounts)) {
					AL.alcErr = 40961;
					return;
				}
				if (!AL.currentCtx) {
					AL.alcErr = 0xa002 /* ALC_INVALID_CONTEXT */;
					return;
				}

				HEAP32[pValues >> 2] = 1;
			case 0x312 /* ALC_CAPTURE_SAMPLES */:
				var c = AL.requireValidCaptureDevice(
					deviceId,
					'alcGetIntegerv'
				);
				if (!c) {
					return;
				}
				var n = c.capturedFrameCount;
				var dstfreq = c.requestedSampleRate;
				var srcfreq = c.audioCtx.sampleRate;
				var nsamples = Math.floor(n * (dstfreq / srcfreq));
				HEAP32[pValues >> 2] = nsamples;
				break;
			default:
				AL.alcErr = 40963;
				return;
		}
	};
	_alcGetIntegerv.sig = 'vpiip';

	var _alcGetString = (deviceId, param) => {
		if (AL.alcStringCache[param]) {
			return AL.alcStringCache[param];
		}

		var ret;
		switch (param) {
			case 0:
				ret = 'No Error';
				break;
			case 40961:
				ret = 'Invalid Device';
				break;
			case 0xa002 /* ALC_INVALID_CONTEXT */:
				ret = 'Invalid Context';
				break;
			case 40963:
				ret = 'Invalid Enum';
				break;
			case 40964:
				ret = 'Invalid Value';
				break;
			case 0xa005 /* ALC_OUT_OF_MEMORY */:
				ret = 'Out of Memory';
				break;
			case 0x1004 /* ALC_DEFAULT_DEVICE_SPECIFIER */:
				if (globalThis.AudioContext || globalThis.webkitAudioContext) {
					ret = AL.DEVICE_NAME;
				} else {
					return 0;
				}
				break;
			case 0x1005 /* ALC_DEVICE_SPECIFIER */:
				if (globalThis.AudioContext || globalThis.webkitAudioContext) {
					ret = AL.DEVICE_NAME + '\0';
				} else {
					ret = '\0';
				}
				break;
			case 0x311 /* ALC_CAPTURE_DEFAULT_DEVICE_SPECIFIER */:
				ret = AL.CAPTURE_DEVICE_NAME;
				break;
			case 0x310 /* ALC_CAPTURE_DEVICE_SPECIFIER */:
				if (deviceId === 0) {
					ret = AL.CAPTURE_DEVICE_NAME + '\0';
				} else {
					var c = AL.requireValidCaptureDevice(
						deviceId,
						'alcGetString'
					);
					if (!c) {
						return 0;
					}
					ret = c.deviceName;
				}
				break;
			case 0x1006 /* ALC_EXTENSIONS */:
				if (!deviceId) {
					AL.alcErr = 40961;
					return 0;
				}

				ret = Object.keys(AL.ALC_EXTENSIONS).join(' ');
				break;
			default:
				AL.alcErr = 40963;
				return 0;
		}

		ret = stringToNewUTF8(ret);
		AL.alcStringCache[param] = ret;
		return ret;
	};
	_alcGetString.sig = 'ppi';

	var _alcIsExtensionPresent = (deviceId, pExtName) => {
		var name = UTF8ToString(pExtName);

		return AL.ALC_EXTENSIONS[name] ? 1 : 0;
	};
	_alcIsExtensionPresent.sig = 'ipp';

	var _alcMakeContextCurrent = (contextId) => {
		if (contextId === 0) {
			AL.currentCtx = null;
		} else {
			AL.currentCtx = AL.contexts[contextId];
		}
		return 1;
	};
	_alcMakeContextCurrent.sig = 'ip';

	var _alcOpenDevice = (pDeviceName) => {
		if (pDeviceName) {
			var name = UTF8ToString(pDeviceName);
			if (name !== AL.DEVICE_NAME) {
				return 0;
			}
		}

		if (globalThis.AudioContext || globalThis.webkitAudioContext) {
			var deviceId = AL.newId();
			AL.deviceRefCounts[deviceId] = 0;
			return deviceId;
		}
		return 0;
	};
	_alcOpenDevice.sig = 'pp';

	var _alcProcessContext = (contextId) => {};
	_alcProcessContext.sig = 'vp';

	var _alcSuspendContext = (contextId) => {};
	_alcSuspendContext.sig = 'vp';

	var _emscripten_get_now_res = () => {
		// return resolution of get_now, in nanoseconds
		if (ENVIRONMENT_IS_NODE) {
			return 1; // nanoseconds
		}
		// Modern environment where performance.now() is supported:
		return 1000; // microseconds (1/1000 of a millisecond)
	};
	_emscripten_get_now_res.sig = 'd';

	var nowIsMonotonic = 1;

	var checkWasiClock = (clock_id) => clock_id >= 0 && clock_id <= 3;
	var _clock_res_get = (clk_id, pres) => {
		if (!checkWasiClock(clk_id)) {
			return 28;
		}
		var nsec;
		// all wasi clocks but realtime are monotonic
		if (clk_id === 0) {
			nsec = 1000 * 1000; // educated guess that it's milliseconds
		} else if (nowIsMonotonic) {
			nsec = _emscripten_get_now_res();
		} else {
			return 52;
		}
		HEAP64[pres >> 3] = BigInt(nsec);
		return 0;
	};
	_clock_res_get.sig = 'iip';

	var _emscripten_date_now = () => Date.now();
	_emscripten_date_now.sig = 'd';

	function _clock_time_get(clk_id, ignored_precision, ptime) {
		ignored_precision = bigintToI53Checked(ignored_precision);

		if (!checkWasiClock(clk_id)) {
			return 28;
		}
		var now;
		// all wasi clocks but realtime are monotonic
		if (clk_id === 0) {
			now = _emscripten_date_now();
		} else if (nowIsMonotonic) {
			now = _emscripten_get_now();
		} else {
			return 52;
		}
		// "now" is in ms, and wasi times are in ns.
		var nsec = Math.round(now * 1000 * 1000);
		HEAP64[ptime >> 3] = BigInt(nsec);
		return 0;
	}
	_clock_time_get.sig = 'iijp';

	var _emscripten_alcDevicePauseSOFT = (deviceId) => {
		if (!(deviceId in AL.deviceRefCounts)) {
			AL.alcErr = 40961;
			return;
		}

		if (AL.paused) {
			return;
		}
		AL.paused = true;

		for (var ctxId in AL.contexts) {
			var ctx = AL.contexts[ctxId];
			if (ctx.deviceId !== deviceId) {
				continue;
			}

			ctx.audioCtx.suspend();
			clearInterval(ctx.interval);
			ctx.interval = null;
		}
	};
	_emscripten_alcDevicePauseSOFT.sig = 'vi';

	var _emscripten_alcDeviceResumeSOFT = (deviceId) => {
		if (!(deviceId in AL.deviceRefCounts)) {
			AL.alcErr = 40961;
			return;
		}

		if (!AL.paused) {
			return;
		}
		AL.paused = false;

		for (var ctxId in AL.contexts) {
			var ctx = AL.contexts[ctxId];
			if (ctx.deviceId !== deviceId) {
				continue;
			}

			ctx.interval = setInterval(
				() => AL.scheduleContextAudio(ctx),
				AL.QUEUE_INTERVAL
			);
			ctx.audioCtx.resume();
		}
	};
	_emscripten_alcDeviceResumeSOFT.sig = 'vi';

	var _emscripten_alcGetStringiSOFT = (deviceId, param, index) => {
		if (!(deviceId in AL.deviceRefCounts)) {
			AL.alcErr = 40961;
			return 0;
		}

		if (AL.alcStringCache[param]) {
			return AL.alcStringCache[param];
		}

		var ret;
		switch (param) {
			case 0x1995 /* ALC_HRTF_SPECIFIER_SOFT */:
				if (index === 0) {
					ret = 'Web Audio HRTF';
				} else {
					AL.alcErr = 40964;
					return 0;
				}
				break;
			default:
				if (index !== 0) {
					AL.alcErr = 40963;
					return 0;
				}
				return _alcGetString(deviceId, param);
		}

		ret = stringToNewUTF8(ret);
		AL.alcStringCache[param] = ret;
		return ret;
	};
	_emscripten_alcGetStringiSOFT.sig = 'iiii';

	var _emscripten_alcResetDeviceSOFT = (deviceId, pAttrList) => {
		if (!(deviceId in AL.deviceRefCounts)) {
			AL.alcErr = 40961;
			return 0;
		}

		var hrtf = null;
		pAttrList >>= 2;
		if (pAttrList) {
			var attr = 0;
			var val = 0;
			while (true) {
				attr = HEAP32[pAttrList++];
				if (attr === 0) {
					break;
				}
				val = HEAP32[pAttrList++];

				switch (attr) {
					case 0x1992 /* ALC_HRTF_SOFT */:
						if (val === 1) {
							hrtf = true;
						} else if (val === 0) {
							hrtf = false;
						}
						break;
				}
			}
		}

		if (hrtf !== null) {
			// Apply hrtf attrib to all contexts for this device
			for (var ctxId in AL.contexts) {
				var ctx = AL.contexts[ctxId];
				if (ctx.deviceId === deviceId) {
					ctx.hrtf = hrtf;
					AL.updateContextGlobal(ctx);
				}
			}
		}

		return 1;
	};
	_emscripten_alcResetDeviceSOFT.sig = 'iii';

	var readEmAsmArgsArray = [];
	var readEmAsmArgs = (sigPtr, buf) => {
		readEmAsmArgsArray.length = 0;
		var ch;
		// Most arguments are i32s, so shift the buffer pointer so it is a plain
		// index into HEAP32.
		while ((ch = HEAPU8[sigPtr++])) {
			// Floats are always passed as doubles, so all types except for 'i'
			// are 8 bytes and require alignment.
			var wide = ch != 105;
			wide &= ch != 112;
			buf += wide && buf % 8 ? 4 : 0;
			readEmAsmArgsArray.push(
				// Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
				ch == 112
					? HEAPU32[buf >> 2]
					: ch == 106
						? HEAP64[buf >> 3]
						: ch == 105
							? HEAP32[buf >> 2]
							: HEAPF64[buf >> 3]
			);
			buf += wide ? 8 : 4;
		}
		return readEmAsmArgsArray;
	};
	var runEmAsmFunction = (code, sigPtr, argbuf) => {
		var args = readEmAsmArgs(sigPtr, argbuf);
		return ASM_CONSTS[code](...args);
	};
	var _emscripten_asm_const_int = (code, sigPtr, argbuf) => {
		return runEmAsmFunction(code, sigPtr, argbuf);
	};
	_emscripten_asm_const_int.sig = 'ippp';

	var _emscripten_console_error = (str) => {
		console.error(UTF8ToString(str));
	};
	_emscripten_console_error.sig = 'vp';

	var _emscripten_console_log = (str) => {
		console.log(UTF8ToString(str));
	};
	_emscripten_console_log.sig = 'vp';

	var _emscripten_console_trace = (str) => {
		console.trace(UTF8ToString(str));
	};
	_emscripten_console_trace.sig = 'vp';

	var _emscripten_console_warn = (str) => {
		console.warn(UTF8ToString(str));
	};
	_emscripten_console_warn.sig = 'vp';

	var _emscripten_err = (str) => err(UTF8ToString(str));
	_emscripten_err.sig = 'vp';

	var getHeapMax = () =>
		// Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
		// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
		// for any code that deals with heap sizes, which would require special
		// casing all heap size related code to treat 0 specially.
		2147483648;
	var _emscripten_get_heap_max = () => getHeapMax();
	_emscripten_get_heap_max.sig = 'p';

	var GLctx;

	var webgl_enable_ANGLE_instanced_arrays = (ctx) => {
		// Extension available in WebGL 1 from Firefox 26 and Google Chrome 30 onwards. Core feature in WebGL 2.
		var ext = ctx.getExtension('ANGLE_instanced_arrays');
		// Because this extension is a core function in WebGL 2, assign the extension entry points in place of
		// where the core functions will reside in WebGL 2. This way the calling code can call these without
		// having to dynamically branch depending if running against WebGL 1 or WebGL 2.
		if (ext) {
			ctx['vertexAttribDivisor'] = (index, divisor) =>
				ext['vertexAttribDivisorANGLE'](index, divisor);
			ctx['drawArraysInstanced'] = (mode, first, count, primcount) =>
				ext['drawArraysInstancedANGLE'](mode, first, count, primcount);
			ctx['drawElementsInstanced'] = (
				mode,
				count,
				type,
				indices,
				primcount
			) =>
				ext['drawElementsInstancedANGLE'](
					mode,
					count,
					type,
					indices,
					primcount
				);
			return 1;
		}
	};

	var webgl_enable_OES_vertex_array_object = (ctx) => {
		// Extension available in WebGL 1 from Firefox 25 and WebKit 536.28/desktop Safari 6.0.3 onwards. Core feature in WebGL 2.
		var ext = ctx.getExtension('OES_vertex_array_object');
		if (ext) {
			ctx['createVertexArray'] = () => ext['createVertexArrayOES']();
			ctx['deleteVertexArray'] = (vao) =>
				ext['deleteVertexArrayOES'](vao);
			ctx['bindVertexArray'] = (vao) => ext['bindVertexArrayOES'](vao);
			ctx['isVertexArray'] = (vao) => ext['isVertexArrayOES'](vao);
			return 1;
		}
	};

	var webgl_enable_WEBGL_draw_buffers = (ctx) => {
		// Extension available in WebGL 1 from Firefox 28 onwards. Core feature in WebGL 2.
		var ext = ctx.getExtension('WEBGL_draw_buffers');
		if (ext) {
			ctx['drawBuffers'] = (n, bufs) => ext['drawBuffersWEBGL'](n, bufs);
			return 1;
		}
	};

	var webgl_enable_EXT_polygon_offset_clamp = (ctx) =>
		!!(ctx.extPolygonOffsetClamp = ctx.getExtension(
			'EXT_polygon_offset_clamp'
		));

	var webgl_enable_EXT_clip_control = (ctx) =>
		!!(ctx.extClipControl = ctx.getExtension('EXT_clip_control'));

	var webgl_enable_WEBGL_polygon_mode = (ctx) =>
		!!(ctx.webglPolygonMode = ctx.getExtension('WEBGL_polygon_mode'));

	var webgl_enable_WEBGL_multi_draw = (ctx) =>
		// Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
		!!(ctx.multiDrawWebgl = ctx.getExtension('WEBGL_multi_draw'));

	var getEmscriptenSupportedExtensions = (ctx) => {
		// Restrict the list of advertised extensions to those that we actually
		// support.
		var supportedExtensions = [
			// WebGL 1 extensions
			'ANGLE_instanced_arrays',
			'EXT_blend_minmax',
			'EXT_disjoint_timer_query',
			'EXT_frag_depth',
			'EXT_shader_texture_lod',
			'EXT_sRGB',
			'OES_element_index_uint',
			'OES_fbo_render_mipmap',
			'OES_standard_derivatives',
			'OES_texture_float',
			'OES_texture_half_float',
			'OES_texture_half_float_linear',
			'OES_vertex_array_object',
			'WEBGL_color_buffer_float',
			'WEBGL_depth_texture',
			'WEBGL_draw_buffers',
			// WebGL 1 and WebGL 2 extensions
			'EXT_clip_control',
			'EXT_color_buffer_half_float',
			'EXT_depth_clamp',
			'EXT_float_blend',
			'EXT_polygon_offset_clamp',
			'EXT_texture_compression_bptc',
			'EXT_texture_compression_rgtc',
			'EXT_texture_filter_anisotropic',
			'KHR_parallel_shader_compile',
			'OES_texture_float_linear',
			'WEBGL_blend_func_extended',
			'WEBGL_compressed_texture_astc',
			'WEBGL_compressed_texture_etc',
			'WEBGL_compressed_texture_etc1',
			'WEBGL_compressed_texture_s3tc',
			'WEBGL_compressed_texture_s3tc_srgb',
			'WEBGL_debug_renderer_info',
			'WEBGL_debug_shaders',
			'WEBGL_lose_context',
			'WEBGL_multi_draw',
			'WEBGL_polygon_mode',
		];
		// .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
		return (ctx.getSupportedExtensions() || []).filter((ext) =>
			supportedExtensions.includes(ext)
		);
	};

	var GL = {
		counter: 1,
		buffers: [],
		programs: [],
		framebuffers: [],
		renderbuffers: [],
		textures: [],
		shaders: [],
		vaos: [],
		contexts: [],
		offscreenCanvases: {},
		queries: [],
		stringCache: {},
		unpackAlignment: 4,
		unpackRowLength: 0,
		recordError: (errorCode) => {
			if (!GL.lastError) {
				GL.lastError = errorCode;
			}
		},
		getNewId: (table) => {
			var ret = GL.counter++;
			for (var i = table.length; i < ret; i++) {
				table[i] = null;
			}
			return ret;
		},
		genObject: (n, buffers, createFunction, objectTable) => {
			for (var i = 0; i < n; i++) {
				var buffer = GLctx[createFunction]();
				var id = buffer && GL.getNewId(objectTable);
				if (buffer) {
					buffer.name = id;
					objectTable[id] = buffer;
				} else {
					GL.recordError(0x502 /* GL_INVALID_OPERATION */);
				}
				HEAP32[(buffers + i * 4) >> 2] = id;
			}
		},
		getSource: (shader, count, string, length) => {
			var source = '';
			for (var i = 0; i < count; ++i) {
				var len = length ? HEAPU32[(length + i * 4) >> 2] : undefined;
				source += UTF8ToString(HEAPU32[(string + i * 4) >> 2], len);
			}
			return source;
		},
		createContext: (
			/** @type {HTMLCanvasElement} */ canvas,
			webGLContextAttributes
		) => {
			var ctx = canvas.getContext('webgl', webGLContextAttributes);

			if (!ctx) return 0;

			var handle = GL.registerContext(ctx, webGLContextAttributes);

			return handle;
		},
		registerContext: (ctx, webGLContextAttributes) => {
			// without pthreads a context is just an integer ID
			var handle = GL.getNewId(GL.contexts);

			var context = {
				handle,
				attributes: webGLContextAttributes,
				version: webGLContextAttributes.majorVersion,
				GLctx: ctx,
			};

			// Store the created context object so that we can access the context
			// given a canvas without having to pass the parameters again.
			if (ctx.canvas) ctx.canvas.GLctxObject = context;
			GL.contexts[handle] = context;
			if (
				typeof webGLContextAttributes.enableExtensionsByDefault ==
					'undefined' ||
				webGLContextAttributes.enableExtensionsByDefault
			) {
				GL.initExtensions(context);
			}

			return handle;
		},
		makeContextCurrent: (contextHandle) => {
			// Active Emscripten GL layer context object.
			GL.currentContext = GL.contexts[contextHandle];
			// Active WebGL context object.
			Module['ctx'] = GLctx = GL.currentContext?.GLctx;
			return !(contextHandle && !GLctx);
		},
		getContext: (contextHandle) => {
			return GL.contexts[contextHandle];
		},
		deleteContext: (contextHandle) => {
			if (GL.currentContext === GL.contexts[contextHandle]) {
				GL.currentContext = null;
			}
			if (typeof JSEvents == 'object') {
				// Release all JS event handlers on the DOM element that the GL context is
				// associated with since the context is now deleted.
				JSEvents.removeAllHandlersOnTarget(
					GL.contexts[contextHandle].GLctx.canvas
				);
			}
			// Make sure the canvas object no longer refers to the context object so
			// there are no GC surprises.
			if (GL.contexts[contextHandle]?.GLctx.canvas) {
				GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
			}
			GL.contexts[contextHandle] = null;
		},
		initExtensions: (context) => {
			// If this function is called without a specific context object, init the
			// extensions of the currently active context.
			context ||= GL.currentContext;

			if (context.initExtensionsDone) return;
			context.initExtensionsDone = true;

			var GLctx = context.GLctx;

			// Detect the presence of a few extensions manually, ction GL interop
			// layer itself will need to know if they exist.

			// Extensions that are available in both WebGL 1 and WebGL 2
			webgl_enable_WEBGL_multi_draw(GLctx);
			webgl_enable_EXT_polygon_offset_clamp(GLctx);
			webgl_enable_EXT_clip_control(GLctx);
			webgl_enable_WEBGL_polygon_mode(GLctx);
			// Extensions that are only available in WebGL 1 (the calls will be no-ops
			// if called on a WebGL 2 context active)
			webgl_enable_ANGLE_instanced_arrays(GLctx);
			webgl_enable_OES_vertex_array_object(GLctx);
			webgl_enable_WEBGL_draw_buffers(GLctx);
			{
				GLctx.disjointTimerQueryExt = GLctx.getExtension(
					'EXT_disjoint_timer_query'
				);
			}

			for (var ext of getEmscriptenSupportedExtensions(GLctx)) {
				// WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
				// are not enabled by default.
				if (!ext.includes('lose_context') && !ext.includes('debug')) {
					// Call .getExtension() to enable that extension permanently.
					GLctx.getExtension(ext);
				}
			}
		},
	};
	var _emscripten_glActiveTexture = (x0) => GLctx.activeTexture(x0);
	_emscripten_glActiveTexture.sig = 'vi';

	var _emscripten_glAttachShader = (program, shader) => {
		GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
	};
	_emscripten_glAttachShader.sig = 'vii';

	var _emscripten_glBeginQueryEXT = (target, id) => {
		GLctx.disjointTimerQueryExt['beginQueryEXT'](target, GL.queries[id]);
	};
	_emscripten_glBeginQueryEXT.sig = 'vii';

	var _emscripten_glBindAttribLocation = (program, index, name) => {
		GLctx.bindAttribLocation(
			GL.programs[program],
			index,
			UTF8ToString(name)
		);
	};
	_emscripten_glBindAttribLocation.sig = 'viip';

	var _emscripten_glBindBuffer = (target, buffer) => {
		GLctx.bindBuffer(target, GL.buffers[buffer]);
	};
	_emscripten_glBindBuffer.sig = 'vii';

	var _emscripten_glBindFramebuffer = (target, framebuffer) => {
		GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
	};
	_emscripten_glBindFramebuffer.sig = 'vii';

	var _emscripten_glBindRenderbuffer = (target, renderbuffer) => {
		GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
	};
	_emscripten_glBindRenderbuffer.sig = 'vii';

	var _emscripten_glBindTexture = (target, texture) => {
		GLctx.bindTexture(target, GL.textures[texture]);
	};
	_emscripten_glBindTexture.sig = 'vii';

	var _emscripten_glBindVertexArray = (vao) => {
		GLctx.bindVertexArray(GL.vaos[vao]);
	};
	_emscripten_glBindVertexArray.sig = 'vi';
	var _emscripten_glBindVertexArrayOES = _emscripten_glBindVertexArray;
	_emscripten_glBindVertexArrayOES.sig = 'vi';

	var _emscripten_glBlendColor = (x0, x1, x2, x3) =>
		GLctx.blendColor(x0, x1, x2, x3);
	_emscripten_glBlendColor.sig = 'vffff';

	var _emscripten_glBlendEquation = (x0) => GLctx.blendEquation(x0);
	_emscripten_glBlendEquation.sig = 'vi';

	var _emscripten_glBlendEquationSeparate = (x0, x1) =>
		GLctx.blendEquationSeparate(x0, x1);
	_emscripten_glBlendEquationSeparate.sig = 'vii';

	var _emscripten_glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1);
	_emscripten_glBlendFunc.sig = 'vii';

	var _emscripten_glBlendFuncSeparate = (x0, x1, x2, x3) =>
		GLctx.blendFuncSeparate(x0, x1, x2, x3);
	_emscripten_glBlendFuncSeparate.sig = 'viiii';

	var _emscripten_glBufferData = (target, size, data, usage) => {
		// N.b. here first form specifies a heap subarray, second form an integer
		// size, so the ?: code here is polymorphic. It is advised to avoid
		// randomly mixing both uses in calling code, to avoid any potential JS
		// engine JIT issues.
		GLctx.bufferData(
			target,
			data ? HEAPU8.subarray(data, data + size) : size,
			usage
		);
	};
	_emscripten_glBufferData.sig = 'vippi';

	var _emscripten_glBufferSubData = (target, offset, size, data) => {
		GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size));
	};
	_emscripten_glBufferSubData.sig = 'vippp';

	var _emscripten_glCheckFramebufferStatus = (x0) =>
		GLctx.checkFramebufferStatus(x0);
	_emscripten_glCheckFramebufferStatus.sig = 'ii';

	var _emscripten_glClear = (x0) => GLctx.clear(x0);
	_emscripten_glClear.sig = 'vi';

	var _emscripten_glClearColor = (x0, x1, x2, x3) =>
		GLctx.clearColor(x0, x1, x2, x3);
	_emscripten_glClearColor.sig = 'vffff';

	var _emscripten_glClearDepthf = (x0) => GLctx.clearDepth(x0);
	_emscripten_glClearDepthf.sig = 'vf';

	var _emscripten_glClearStencil = (x0) => GLctx.clearStencil(x0);
	_emscripten_glClearStencil.sig = 'vi';

	var _emscripten_glClipControlEXT = (origin, depth) => {
		GLctx.extClipControl['clipControlEXT'](origin, depth);
	};
	_emscripten_glClipControlEXT.sig = 'vii';

	var _emscripten_glColorMask = (red, green, blue, alpha) => {
		GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
	};
	_emscripten_glColorMask.sig = 'viiii';

	var _emscripten_glCompileShader = (shader) => {
		GLctx.compileShader(GL.shaders[shader]);
	};
	_emscripten_glCompileShader.sig = 'vi';

	var _emscripten_glCompressedTexImage2D = (
		target,
		level,
		internalFormat,
		width,
		height,
		border,
		imageSize,
		data
	) => {
		// `data` may be null here, which means "allocate uniniitalized space but
		// don't upload" in GLES parlance, but `compressedTexImage2D` requires the
		// final data parameter, so we simply pass a heap view starting at zero
		// effectively uploading whatever happens to be near address zero.  See
		// https://github.com/emscripten-core/emscripten/issues/19300.
		GLctx.compressedTexImage2D(
			target,
			level,
			internalFormat,
			width,
			height,
			border,
			HEAPU8.subarray(data, data + imageSize)
		);
	};
	_emscripten_glCompressedTexImage2D.sig = 'viiiiiiip';

	var _emscripten_glCompressedTexSubImage2D = (
		target,
		level,
		xoffset,
		yoffset,
		width,
		height,
		format,
		imageSize,
		data
	) => {
		GLctx.compressedTexSubImage2D(
			target,
			level,
			xoffset,
			yoffset,
			width,
			height,
			format,
			HEAPU8.subarray(data, data + imageSize)
		);
	};
	_emscripten_glCompressedTexSubImage2D.sig = 'viiiiiiiip';

	var _emscripten_glCopyTexImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) =>
		GLctx.copyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7);
	_emscripten_glCopyTexImage2D.sig = 'viiiiiiii';

	var _emscripten_glCopyTexSubImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) =>
		GLctx.copyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7);
	_emscripten_glCopyTexSubImage2D.sig = 'viiiiiiii';

	var _emscripten_glCreateProgram = () => {
		var id = GL.getNewId(GL.programs);
		var program = GLctx.createProgram();
		// Store additional information needed for each shader program:
		program.name = id;
		// Lazy cache results of
		// glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
		program.maxUniformLength =
			program.maxAttributeLength =
			program.maxUniformBlockNameLength =
				0;
		program.uniformIdCounter = 1;
		GL.programs[id] = program;
		return id;
	};
	_emscripten_glCreateProgram.sig = 'i';

	var _emscripten_glCreateShader = (shaderType) => {
		var id = GL.getNewId(GL.shaders);
		GL.shaders[id] = GLctx.createShader(shaderType);

		return id;
	};
	_emscripten_glCreateShader.sig = 'ii';

	var _emscripten_glCullFace = (x0) => GLctx.cullFace(x0);
	_emscripten_glCullFace.sig = 'vi';

	var _emscripten_glDeleteBuffers = (n, buffers) => {
		for (var i = 0; i < n; i++) {
			var id = HEAP32[(buffers + i * 4) >> 2];
			var buffer = GL.buffers[id];

			// From spec: "glDeleteBuffers silently ignores 0's and names that do not
			// correspond to existing buffer objects."
			if (!buffer) continue;

			GLctx.deleteBuffer(buffer);
			buffer.name = 0;
			GL.buffers[id] = null;
		}
	};
	_emscripten_glDeleteBuffers.sig = 'vip';

	var _emscripten_glDeleteFramebuffers = (n, framebuffers) => {
		for (var i = 0; i < n; ++i) {
			var id = HEAP32[(framebuffers + i * 4) >> 2];
			var framebuffer = GL.framebuffers[id];
			if (!framebuffer) continue; // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
			GLctx.deleteFramebuffer(framebuffer);
			framebuffer.name = 0;
			GL.framebuffers[id] = null;
		}
	};
	_emscripten_glDeleteFramebuffers.sig = 'vip';

	var _emscripten_glDeleteProgram = (id) => {
		if (!id) return;
		var program = GL.programs[id];
		if (!program) {
			// glDeleteProgram actually signals an error when deleting a nonexisting
			// object, unlike some other GL delete functions.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		GLctx.deleteProgram(program);
		program.name = 0;
		GL.programs[id] = null;
	};
	_emscripten_glDeleteProgram.sig = 'vi';

	var _emscripten_glDeleteQueriesEXT = (n, ids) => {
		for (var i = 0; i < n; i++) {
			var id = HEAP32[(ids + i * 4) >> 2];
			var query = GL.queries[id];
			if (!query) continue; // GL spec: "unused names in ids are ignored, as is the name zero."
			GLctx.disjointTimerQueryExt['deleteQueryEXT'](query);
			GL.queries[id] = null;
		}
	};
	_emscripten_glDeleteQueriesEXT.sig = 'vip';

	var _emscripten_glDeleteRenderbuffers = (n, renderbuffers) => {
		for (var i = 0; i < n; i++) {
			var id = HEAP32[(renderbuffers + i * 4) >> 2];
			var renderbuffer = GL.renderbuffers[id];
			if (!renderbuffer) continue; // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
			GLctx.deleteRenderbuffer(renderbuffer);
			renderbuffer.name = 0;
			GL.renderbuffers[id] = null;
		}
	};
	_emscripten_glDeleteRenderbuffers.sig = 'vip';

	var _emscripten_glDeleteShader = (id) => {
		if (!id) return;
		var shader = GL.shaders[id];
		if (!shader) {
			// glDeleteShader actually signals an error when deleting a nonexisting
			// object, unlike some other GL delete functions.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		GLctx.deleteShader(shader);
		GL.shaders[id] = null;
	};
	_emscripten_glDeleteShader.sig = 'vi';

	var _emscripten_glDeleteTextures = (n, textures) => {
		for (var i = 0; i < n; i++) {
			var id = HEAP32[(textures + i * 4) >> 2];
			var texture = GL.textures[id];
			// GL spec: "glDeleteTextures silently ignores 0s and names that do not
			// correspond to existing textures".
			if (!texture) continue;
			GLctx.deleteTexture(texture);
			texture.name = 0;
			GL.textures[id] = null;
		}
	};
	_emscripten_glDeleteTextures.sig = 'vip';

	var _emscripten_glDeleteVertexArrays = (n, vaos) => {
		for (var i = 0; i < n; i++) {
			var id = HEAP32[(vaos + i * 4) >> 2];
			GLctx.deleteVertexArray(GL.vaos[id]);
			GL.vaos[id] = null;
		}
	};
	_emscripten_glDeleteVertexArrays.sig = 'vip';
	var _emscripten_glDeleteVertexArraysOES = _emscripten_glDeleteVertexArrays;
	_emscripten_glDeleteVertexArraysOES.sig = 'vip';

	var _emscripten_glDepthFunc = (x0) => GLctx.depthFunc(x0);
	_emscripten_glDepthFunc.sig = 'vi';

	var _emscripten_glDepthMask = (flag) => {
		GLctx.depthMask(!!flag);
	};
	_emscripten_glDepthMask.sig = 'vi';

	var _emscripten_glDepthRangef = (x0, x1) => GLctx.depthRange(x0, x1);
	_emscripten_glDepthRangef.sig = 'vff';

	var _emscripten_glDetachShader = (program, shader) => {
		GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
	};
	_emscripten_glDetachShader.sig = 'vii';

	var _emscripten_glDisable = (x0) => GLctx.disable(x0);
	_emscripten_glDisable.sig = 'vi';

	var _emscripten_glDisableVertexAttribArray = (index) => {
		GLctx.disableVertexAttribArray(index);
	};
	_emscripten_glDisableVertexAttribArray.sig = 'vi';

	var _emscripten_glDrawArrays = (mode, first, count) => {
		GLctx.drawArrays(mode, first, count);
	};
	_emscripten_glDrawArrays.sig = 'viii';

	var _emscripten_glDrawArraysInstanced = (mode, first, count, primcount) => {
		GLctx.drawArraysInstanced(mode, first, count, primcount);
	};
	_emscripten_glDrawArraysInstanced.sig = 'viiii';
	var _emscripten_glDrawArraysInstancedANGLE =
		_emscripten_glDrawArraysInstanced;

	var tempFixedLengthArray = [];

	var _emscripten_glDrawBuffers = (n, bufs) => {
		var bufArray = tempFixedLengthArray[n];
		for (var i = 0; i < n; i++) {
			bufArray[i] = HEAP32[(bufs + i * 4) >> 2];
		}

		GLctx.drawBuffers(bufArray);
	};
	_emscripten_glDrawBuffers.sig = 'vip';
	var _emscripten_glDrawBuffersWEBGL = _emscripten_glDrawBuffers;

	var _emscripten_glDrawElements = (mode, count, type, indices) => {
		GLctx.drawElements(mode, count, type, indices);
	};
	_emscripten_glDrawElements.sig = 'viiip';

	var _emscripten_glDrawElementsInstanced = (
		mode,
		count,
		type,
		indices,
		primcount
	) => {
		GLctx.drawElementsInstanced(mode, count, type, indices, primcount);
	};
	_emscripten_glDrawElementsInstanced.sig = 'viiipi';
	var _emscripten_glDrawElementsInstancedANGLE =
		_emscripten_glDrawElementsInstanced;

	var _emscripten_glEnable = (x0) => GLctx.enable(x0);
	_emscripten_glEnable.sig = 'vi';

	var _emscripten_glEnableVertexAttribArray = (index) => {
		GLctx.enableVertexAttribArray(index);
	};
	_emscripten_glEnableVertexAttribArray.sig = 'vi';

	var _emscripten_glEndQueryEXT = (target) => {
		GLctx.disjointTimerQueryExt['endQueryEXT'](target);
	};
	_emscripten_glEndQueryEXT.sig = 'vi';

	var _emscripten_glFinish = () => GLctx.finish();
	_emscripten_glFinish.sig = 'v';

	var _emscripten_glFlush = () => GLctx.flush();
	_emscripten_glFlush.sig = 'v';

	var _emscripten_glFramebufferRenderbuffer = (
		target,
		attachment,
		renderbuffertarget,
		renderbuffer
	) => {
		GLctx.framebufferRenderbuffer(
			target,
			attachment,
			renderbuffertarget,
			GL.renderbuffers[renderbuffer]
		);
	};
	_emscripten_glFramebufferRenderbuffer.sig = 'viiii';

	var _emscripten_glFramebufferTexture2D = (
		target,
		attachment,
		textarget,
		texture,
		level
	) => {
		GLctx.framebufferTexture2D(
			target,
			attachment,
			textarget,
			GL.textures[texture],
			level
		);
	};
	_emscripten_glFramebufferTexture2D.sig = 'viiiii';

	var _emscripten_glFrontFace = (x0) => GLctx.frontFace(x0);
	_emscripten_glFrontFace.sig = 'vi';

	var _emscripten_glGenBuffers = (n, buffers) => {
		GL.genObject(n, buffers, 'createBuffer', GL.buffers);
	};
	_emscripten_glGenBuffers.sig = 'vip';

	var _emscripten_glGenFramebuffers = (n, ids) => {
		GL.genObject(n, ids, 'createFramebuffer', GL.framebuffers);
	};
	_emscripten_glGenFramebuffers.sig = 'vip';

	var _emscripten_glGenQueriesEXT = (n, ids) => {
		for (var i = 0; i < n; i++) {
			var query = GLctx.disjointTimerQueryExt['createQueryEXT']();
			if (!query) {
				GL.recordError(0x502 /* GL_INVALID_OPERATION */);
				while (i < n) HEAP32[(ids + i++ * 4) >> 2] = 0;
				return;
			}
			var id = GL.getNewId(GL.queries);
			query.name = id;
			GL.queries[id] = query;
			HEAP32[(ids + i * 4) >> 2] = id;
		}
	};
	_emscripten_glGenQueriesEXT.sig = 'vip';

	var _emscripten_glGenRenderbuffers = (n, renderbuffers) => {
		GL.genObject(n, renderbuffers, 'createRenderbuffer', GL.renderbuffers);
	};
	_emscripten_glGenRenderbuffers.sig = 'vip';

	var _emscripten_glGenTextures = (n, textures) => {
		GL.genObject(n, textures, 'createTexture', GL.textures);
	};
	_emscripten_glGenTextures.sig = 'vip';

	var _emscripten_glGenVertexArrays = (n, arrays) => {
		GL.genObject(n, arrays, 'createVertexArray', GL.vaos);
	};
	_emscripten_glGenVertexArrays.sig = 'vip';
	var _emscripten_glGenVertexArraysOES = _emscripten_glGenVertexArrays;
	_emscripten_glGenVertexArraysOES.sig = 'vip';

	var _emscripten_glGenerateMipmap = (x0) => GLctx.generateMipmap(x0);
	_emscripten_glGenerateMipmap.sig = 'vi';

	var __glGetActiveAttribOrUniform = (
		funcName,
		program,
		index,
		bufSize,
		length,
		size,
		type,
		name
	) => {
		program = GL.programs[program];
		var info = GLctx[funcName](program, index);
		if (info) {
			// If an error occurs, nothing will be written to length, size and type and name.
			var numBytesWrittenExclNull =
				name && stringToUTF8(info.name, name, bufSize);
			if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
			if (size) HEAP32[size >> 2] = info.size;
			if (type) HEAP32[type >> 2] = info.type;
		}
	};

	var _emscripten_glGetActiveAttrib = (
		program,
		index,
		bufSize,
		length,
		size,
		type,
		name
	) =>
		__glGetActiveAttribOrUniform(
			'getActiveAttrib',
			program,
			index,
			bufSize,
			length,
			size,
			type,
			name
		);
	_emscripten_glGetActiveAttrib.sig = 'viiipppp';

	var _emscripten_glGetActiveUniform = (
		program,
		index,
		bufSize,
		length,
		size,
		type,
		name
	) =>
		__glGetActiveAttribOrUniform(
			'getActiveUniform',
			program,
			index,
			bufSize,
			length,
			size,
			type,
			name
		);
	_emscripten_glGetActiveUniform.sig = 'viiipppp';

	var _emscripten_glGetAttachedShaders = (
		program,
		maxCount,
		count,
		shaders
	) => {
		var result = GLctx.getAttachedShaders(GL.programs[program]);
		var len = result.length;
		if (len > maxCount) {
			len = maxCount;
		}
		HEAP32[count >> 2] = len;
		for (var i = 0; i < len; ++i) {
			var id = GL.shaders.indexOf(result[i]);
			HEAP32[(shaders + i * 4) >> 2] = id;
		}
	};
	_emscripten_glGetAttachedShaders.sig = 'viipp';

	var _emscripten_glGetAttribLocation = (program, name) =>
		GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
	_emscripten_glGetAttribLocation.sig = 'iip';

	var writeI53ToI64 = (ptr, num) => {
		HEAPU32[ptr >> 2] = num;
		var lower = HEAPU32[ptr >> 2];
		HEAPU32[(ptr + 4) >> 2] = (num - lower) / 4294967296;
	};

	var emscriptenWebGLGet = (name_, p, type) => {
		// Guard against user passing a null pointer.
		// Note that GLES2 spec does not say anything about how passing a null
		// pointer should be treated.  Testing on desktop core GL 3, the application
		// crashes on glGetIntegerv to a null pointer, but better to report an error
		// instead of doing anything random.
		if (!p) {
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		var ret = undefined;
		switch (
			name_ // Handle a few trivial GLES values
		) {
			case 0x8dfa: // GL_SHADER_COMPILER
				ret = 1;
				break;
			case 0x8df8: // GL_SHADER_BINARY_FORMATS
				if (type != 0 && type != 1) {
					GL.recordError(0x500); // GL_INVALID_ENUM
				}
				// Do not write anything to the out pointer, since no binary formats are
				// supported.
				return;
			case 0x8df9: // GL_NUM_SHADER_BINARY_FORMATS
				ret = 0;
				break;
			case 0x86a2: // GL_NUM_COMPRESSED_TEXTURE_FORMATS
				// WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
				// since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
				// queried for length), so implement it ourselves to allow C++ GLES2
				// code get the length.
				var formats = GLctx.getParameter(
					0x86a3 /*GL_COMPRESSED_TEXTURE_FORMATS*/
				);
				ret = formats ? formats.length : 0;
				break;
		}

		if (ret === undefined) {
			var result = GLctx.getParameter(name_);
			switch (typeof result) {
				case 'number':
					ret = result;
					break;
				case 'boolean':
					ret = result ? 1 : 0;
					break;
				case 'string':
					GL.recordError(0x500); // GL_INVALID_ENUM
					return;
				case 'object':
					if (result === null) {
						// null is a valid result for some (e.g., which buffer is bound -
						// perhaps nothing is bound), but otherwise can mean an invalid
						// name_, which we need to report as an error
						switch (name_) {
							case 0x8894: // ARRAY_BUFFER_BINDING
							case 0x8b8d: // CURRENT_PROGRAM
							case 0x8895: // ELEMENT_ARRAY_BUFFER_BINDING
							case 0x8ca6: // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
							case 0x8ca7: // RENDERBUFFER_BINDING
							case 0x8069: // TEXTURE_BINDING_2D
							case 0x85b5: // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
							case 0x8514: {
								// TEXTURE_BINDING_CUBE_MAP
								ret = 0;
								break;
							}
							default: {
								GL.recordError(0x500); // GL_INVALID_ENUM
								return;
							}
						}
					} else if (
						result instanceof Float32Array ||
						result instanceof Uint32Array ||
						result instanceof Int32Array ||
						result instanceof Array
					) {
						for (var i = 0; i < result.length; ++i) {
							switch (type) {
								case 0:
									HEAP32[(p + i * 4) >> 2] = result[i];
									break;
								case 2:
									HEAPF32[(p + i * 4) >> 2] = result[i];
									break;
								case 4:
									HEAP8[p + i] = result[i] ? 1 : 0;
									break;
							}
						}
						return;
					} else {
						try {
							ret = result.name | 0;
						} catch (e) {
							GL.recordError(0x500); // GL_INVALID_ENUM
							err(
								`GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`
							);
							return;
						}
					}
					break;
				default:
					GL.recordError(0x500); // GL_INVALID_ENUM
					err(
						`GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof result}!`
					);
					return;
			}
		}

		switch (type) {
			case 1:
				writeI53ToI64(p, ret);
				break;
			case 0:
				HEAP32[p >> 2] = ret;
				break;
			case 2:
				HEAPF32[p >> 2] = ret;
				break;
			case 4:
				HEAP8[p] = ret ? 1 : 0;
				break;
		}
	};

	var _emscripten_glGetBooleanv = (name_, p) =>
		emscriptenWebGLGet(name_, p, 4);
	_emscripten_glGetBooleanv.sig = 'vip';

	var _emscripten_glGetBufferParameteriv = (target, value, data) => {
		if (!data) {
			// GLES2 specification does not specify how to behave if data is a null
			// pointer. Since calling this function does not make sense if data ==
			// null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		HEAP32[data >> 2] = GLctx.getBufferParameter(target, value);
	};
	_emscripten_glGetBufferParameteriv.sig = 'viip';

	var _emscripten_glGetError = () => {
		var error = GLctx.getError() || GL.lastError;
		GL.lastError = 0 /*GL_NO_ERROR*/;
		return error;
	};
	_emscripten_glGetError.sig = 'i';

	var _emscripten_glGetFloatv = (name_, p) => emscriptenWebGLGet(name_, p, 2);
	_emscripten_glGetFloatv.sig = 'vip';

	var _emscripten_glGetFramebufferAttachmentParameteriv = (
		target,
		attachment,
		pname,
		params
	) => {
		var result = GLctx.getFramebufferAttachmentParameter(
			target,
			attachment,
			pname
		);
		if (
			result instanceof WebGLRenderbuffer ||
			result instanceof WebGLTexture
		) {
			result = result.name | 0;
		}
		HEAP32[params >> 2] = result;
	};
	_emscripten_glGetFramebufferAttachmentParameteriv.sig = 'viiip';

	var _emscripten_glGetIntegerv = (name_, p) =>
		emscriptenWebGLGet(name_, p, 0);
	_emscripten_glGetIntegerv.sig = 'vip';

	var _emscripten_glGetProgramInfoLog = (
		program,
		maxLength,
		length,
		infoLog
	) => {
		var log = GLctx.getProgramInfoLog(GL.programs[program]);
		if (log === null) log = '(unknown error)';
		var numBytesWrittenExclNull =
			maxLength > 0 && infoLog
				? stringToUTF8(log, infoLog, maxLength)
				: 0;
		if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
	};
	_emscripten_glGetProgramInfoLog.sig = 'viipp';

	var _emscripten_glGetProgramiv = (program, pname, p) => {
		if (!p) {
			// GLES2 specification does not specify how to behave if p is a null
			// pointer. Since calling this function does not make sense if p == null,
			// issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}

		if (program >= GL.counter) {
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}

		program = GL.programs[program];

		if (pname == 0x8b84) {
			// GL_INFO_LOG_LENGTH
			var log = GLctx.getProgramInfoLog(program);
			if (log === null) log = '(unknown error)';
			HEAP32[p >> 2] = log.length + 1;
		} else if (pname == 0x8b87 /* GL_ACTIVE_UNIFORM_MAX_LENGTH */) {
			if (!program.maxUniformLength) {
				var numActiveUniforms = GLctx.getProgramParameter(
					program,
					0x8b86 /*GL_ACTIVE_UNIFORMS*/
				);
				for (var i = 0; i < numActiveUniforms; ++i) {
					program.maxUniformLength = Math.max(
						program.maxUniformLength,
						GLctx.getActiveUniform(program, i).name.length + 1
					);
				}
			}
			HEAP32[p >> 2] = program.maxUniformLength;
		} else if (pname == 0x8b8a /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */) {
			if (!program.maxAttributeLength) {
				var numActiveAttributes = GLctx.getProgramParameter(
					program,
					0x8b89 /*GL_ACTIVE_ATTRIBUTES*/
				);
				for (var i = 0; i < numActiveAttributes; ++i) {
					program.maxAttributeLength = Math.max(
						program.maxAttributeLength,
						GLctx.getActiveAttrib(program, i).name.length + 1
					);
				}
			}
			HEAP32[p >> 2] = program.maxAttributeLength;
		} else if (
			pname == 0x8a35 /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */
		) {
			if (!program.maxUniformBlockNameLength) {
				var numActiveUniformBlocks = GLctx.getProgramParameter(
					program,
					0x8a36 /*GL_ACTIVE_UNIFORM_BLOCKS*/
				);
				for (var i = 0; i < numActiveUniformBlocks; ++i) {
					program.maxUniformBlockNameLength = Math.max(
						program.maxUniformBlockNameLength,
						GLctx.getActiveUniformBlockName(program, i).length + 1
					);
				}
			}
			HEAP32[p >> 2] = program.maxUniformBlockNameLength;
		} else {
			HEAP32[p >> 2] = GLctx.getProgramParameter(program, pname);
		}
	};
	_emscripten_glGetProgramiv.sig = 'viip';

	var _emscripten_glGetQueryObjecti64vEXT = (id, pname, params) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
			// if p == null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		var query = GL.queries[id];
		var param;
		{
			param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](
				query,
				pname
			);
		}
		var ret;
		if (typeof param == 'boolean') {
			ret = param ? 1 : 0;
		} else {
			ret = param;
		}
		writeI53ToI64(params, ret);
	};
	_emscripten_glGetQueryObjecti64vEXT.sig = 'viip';

	var _emscripten_glGetQueryObjectivEXT = (id, pname, params) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
			// if p == null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		var query = GL.queries[id];
		var param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](
			query,
			pname
		);
		var ret;
		if (typeof param == 'boolean') {
			ret = param ? 1 : 0;
		} else {
			ret = param;
		}
		HEAP32[params >> 2] = ret;
	};
	_emscripten_glGetQueryObjectivEXT.sig = 'viip';

	var _emscripten_glGetQueryObjectui64vEXT =
		_emscripten_glGetQueryObjecti64vEXT;

	var _emscripten_glGetQueryObjectuivEXT = _emscripten_glGetQueryObjectivEXT;

	var _emscripten_glGetQueryivEXT = (target, pname, params) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
			// if p == null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		HEAP32[params >> 2] = GLctx.disjointTimerQueryExt['getQueryEXT'](
			target,
			pname
		);
	};
	_emscripten_glGetQueryivEXT.sig = 'viip';

	var _emscripten_glGetRenderbufferParameteriv = (target, pname, params) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
			// if params == null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		HEAP32[params >> 2] = GLctx.getRenderbufferParameter(target, pname);
	};
	_emscripten_glGetRenderbufferParameteriv.sig = 'viip';

	var _emscripten_glGetShaderInfoLog = (
		shader,
		maxLength,
		length,
		infoLog
	) => {
		var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
		if (log === null) log = '(unknown error)';
		var numBytesWrittenExclNull =
			maxLength > 0 && infoLog
				? stringToUTF8(log, infoLog, maxLength)
				: 0;
		if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
	};
	_emscripten_glGetShaderInfoLog.sig = 'viipp';

	var _emscripten_glGetShaderPrecisionFormat = (
		shaderType,
		precisionType,
		range,
		precision
	) => {
		var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
		HEAP32[range >> 2] = result.rangeMin;
		HEAP32[(range + 4) >> 2] = result.rangeMax;
		HEAP32[precision >> 2] = result.precision;
	};
	_emscripten_glGetShaderPrecisionFormat.sig = 'viipp';

	var _emscripten_glGetShaderSource = (shader, bufSize, length, source) => {
		var result = GLctx.getShaderSource(GL.shaders[shader]);
		if (!result) return; // If an error occurs, nothing will be written to length or source.
		var numBytesWrittenExclNull =
			bufSize > 0 && source ? stringToUTF8(result, source, bufSize) : 0;
		if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
	};
	_emscripten_glGetShaderSource.sig = 'viipp';

	var _emscripten_glGetShaderiv = (shader, pname, p) => {
		if (!p) {
			// GLES2 specification does not specify how to behave if p is a null
			// pointer. Since calling this function does not make sense if p == null,
			// issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		if (pname == 0x8b84) {
			// GL_INFO_LOG_LENGTH
			var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
			if (log === null) log = '(unknown error)';
			// The GLES2 specification says that if the shader has an empty info log,
			// a value of 0 is returned. Otherwise the log has a null char appended.
			// (An empty string is falsey, so we can just check that instead of
			// looking at log.length.)
			var logLength = log ? log.length + 1 : 0;
			HEAP32[p >> 2] = logLength;
		} else if (pname == 0x8b88) {
			// GL_SHADER_SOURCE_LENGTH
			var source = GLctx.getShaderSource(GL.shaders[shader]);
			// source may be a null, or the empty string, both of which are falsey
			// values that we report a 0 length for.
			var sourceLength = source ? source.length + 1 : 0;
			HEAP32[p >> 2] = sourceLength;
		} else {
			HEAP32[p >> 2] = GLctx.getShaderParameter(
				GL.shaders[shader],
				pname
			);
		}
	};
	_emscripten_glGetShaderiv.sig = 'viip';

	var webglGetExtensions = () => {
		var exts = getEmscriptenSupportedExtensions(GLctx);
		exts = exts.concat(exts.map((e) => 'GL_' + e));
		return exts;
	};

	var _emscripten_glGetString = (name_) => {
		var ret = GL.stringCache[name_];
		if (!ret) {
			switch (name_) {
				case 0x1f03 /* GL_EXTENSIONS */:
					ret = stringToNewUTF8(webglGetExtensions().join(' '));
					break;
				case 0x1f00 /* GL_VENDOR */:
				case 0x1f01 /* GL_RENDERER */:
				case 0x9245 /* UNMASKED_VENDOR_WEBGL */:
				case 0x9246 /* UNMASKED_RENDERER_WEBGL */:
					var s = GLctx.getParameter(name_);
					if (!s) {
						GL.recordError(0x500 /*GL_INVALID_ENUM*/);
					}
					ret = s ? stringToNewUTF8(s) : 0;
					break;

				case 0x1f02 /* GL_VERSION */:
					var webGLVersion = GLctx.getParameter(
						0x1f02 /*GL_VERSION*/
					);
					// return GLES version string corresponding to the version of the WebGL context
					var glVersion = `OpenGL ES 2.0 (${webGLVersion})`;
					ret = stringToNewUTF8(glVersion);
					break;
				case 0x8b8c /* GL_SHADING_LANGUAGE_VERSION */:
					var glslVersion = GLctx.getParameter(
						0x8b8c /*GL_SHADING_LANGUAGE_VERSION*/
					);
					// extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
					var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
					var ver_num = glslVersion.match(ver_re);
					if (ver_num !== null) {
						if (ver_num[1].length == 3)
							ver_num[1] = ver_num[1] + '0'; // ensure minor version has 2 digits
						glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
					}
					ret = stringToNewUTF8(glslVersion);
					break;
				default:
					GL.recordError(0x500 /*GL_INVALID_ENUM*/);
				// fall through
			}
			GL.stringCache[name_] = ret;
		}
		return ret;
	};
	_emscripten_glGetString.sig = 'pi';

	var _emscripten_glGetTexParameterfv = (target, pname, params) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null
			// pointer. Since calling this function does not make sense if p == null,
			// issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		HEAPF32[params >> 2] = GLctx.getTexParameter(target, pname);
	};
	_emscripten_glGetTexParameterfv.sig = 'viip';

	var _emscripten_glGetTexParameteriv = (target, pname, params) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null
			// pointer. Since calling this function does not make sense if p == null,
			// issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		HEAP32[params >> 2] = GLctx.getTexParameter(target, pname);
	};
	_emscripten_glGetTexParameteriv.sig = 'viip';

	/** @suppress {checkTypes} */
	var jstoi_q = (str) => parseInt(str);

	/** @noinline */
	var webglGetLeftBracePos = (name) =>
		name.slice(-1) == ']' && name.lastIndexOf('[');

	var webglPrepareUniformLocationsBeforeFirstUse = (program) => {
		var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
			uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
			i,
			j;

		// On the first time invocation of glGetUniformLocation on this shader program:
		// initialize cache data structures and discover which uniforms are arrays.
		if (!uniformLocsById) {
			// maps GLint integer locations to WebGLUniformLocations
			program.uniformLocsById = uniformLocsById = {};
			// maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
			program.uniformArrayNamesById = {};

			var numActiveUniforms = GLctx.getProgramParameter(
				program,
				0x8b86 /*GL_ACTIVE_UNIFORMS*/
			);
			for (i = 0; i < numActiveUniforms; ++i) {
				var u = GLctx.getActiveUniform(program, i);
				var nm = u.name;
				var sz = u.size;
				var lb = webglGetLeftBracePos(nm);
				var arrayName = lb > 0 ? nm.slice(0, lb) : nm;

				// Assign a new location.
				var id = program.uniformIdCounter;
				program.uniformIdCounter += sz;
				// Eagerly get the location of the uniformArray[0] base element.
				// The remaining indices >0 will be left for lazy evaluation to
				// improve performance. Those may never be needed to fetch, if the
				// application fills arrays always in full starting from the first
				// element of the array.
				uniformSizeAndIdsByName[arrayName] = [sz, id];

				// Store placeholder integers in place that highlight that these
				// >0 index locations are array indices pending population.
				for (j = 0; j < sz; ++j) {
					uniformLocsById[id] = j;
					program.uniformArrayNamesById[id++] = arrayName;
				}
			}
		}
	};

	var _emscripten_glGetUniformLocation = (program, name) => {
		name = UTF8ToString(name);

		if ((program = GL.programs[program])) {
			webglPrepareUniformLocationsBeforeFirstUse(program);
			var uniformLocsById = program.uniformLocsById; // Maps GLuint -> WebGLUniformLocation
			var arrayIndex = 0;
			var uniformBaseName = name;

			// Invariant: when populating integer IDs for uniform locations, we must
			// maintain the precondition that arrays reside in contiguous addresses,
			// i.e. for a 'vec4 colors[10];', colors[4] must be at location
			// colors[0]+4.  However, user might call glGetUniformLocation(program,
			// "colors") for an array, so we cannot discover based on the user input
			// arguments whether the uniform we are dealing with is an array. The only
			// way to discover which uniforms are arrays is to enumerate over all the
			// active uniforms in the program.
			var leftBrace = webglGetLeftBracePos(name);

			// If user passed an array accessor "[index]", parse the array index off the accessor.
			if (leftBrace > 0) {
				arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0; // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
				uniformBaseName = name.slice(0, leftBrace);
			}

			// Have we cached the location of this uniform before?
			// A pair [array length, GLint of the uniform location]
			var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];

			// If an uniform with this name exists, and if its index is within the
			// array limits (if it's even an array), query the WebGLlocation, or
			// return an existing cached location.
			if (sizeAndId && arrayIndex < sizeAndId[0]) {
				arrayIndex += sizeAndId[1]; // Add the base location of the uniform to the array index offset.
				if (
					(uniformLocsById[arrayIndex] =
						uniformLocsById[arrayIndex] ||
						GLctx.getUniformLocation(program, name))
				) {
					return arrayIndex;
				}
			}
		} else {
			// N.b. we are currently unable to distinguish between GL program IDs that
			// never existed vs GL program IDs that have been deleted, so report
			// GL_INVALID_VALUE in both cases.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
		}
		return -1;
	};
	_emscripten_glGetUniformLocation.sig = 'iip';

	var webglGetUniformLocation = (location) => {
		var p = GLctx.currentProgram;

		if (p) {
			var webglLoc = p.uniformLocsById[location];
			// p.uniformLocsById[location] stores either an integer, or a
			// WebGLUniformLocation.
			// If an integer, we have not yet bound the location, so do it now. The
			// integer value specifies the array index we should bind to.
			if (typeof webglLoc == 'number') {
				p.uniformLocsById[location] = webglLoc =
					GLctx.getUniformLocation(
						p,
						p.uniformArrayNamesById[location] +
							(webglLoc > 0 ? `[${webglLoc}]` : '')
					);
			}
			// Else an already cached WebGLUniformLocation, return it.
			return webglLoc;
		} else {
			GL.recordError(0x502 /*GL_INVALID_OPERATION*/);
		}
	};

	/** @suppress{checkTypes} */
	var emscriptenWebGLGetUniform = (program, location, params, type) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null
			// pointer. Since calling this function does not make sense if params ==
			// null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		program = GL.programs[program];
		webglPrepareUniformLocationsBeforeFirstUse(program);
		var data = GLctx.getUniform(program, webglGetUniformLocation(location));
		if (typeof data == 'number' || typeof data == 'boolean') {
			switch (type) {
				case 0:
					HEAP32[params >> 2] = data;
					break;
				case 2:
					HEAPF32[params >> 2] = data;
					break;
			}
		} else {
			for (var i = 0; i < data.length; i++) {
				switch (type) {
					case 0:
						HEAP32[(params + i * 4) >> 2] = data[i];
						break;
					case 2:
						HEAPF32[(params + i * 4) >> 2] = data[i];
						break;
				}
			}
		}
	};

	var _emscripten_glGetUniformfv = (program, location, params) => {
		emscriptenWebGLGetUniform(program, location, params, 2);
	};
	_emscripten_glGetUniformfv.sig = 'viip';

	var _emscripten_glGetUniformiv = (program, location, params) => {
		emscriptenWebGLGetUniform(program, location, params, 0);
	};
	_emscripten_glGetUniformiv.sig = 'viip';

	var _emscripten_glGetVertexAttribPointerv = (index, pname, pointer) => {
		if (!pointer) {
			// GLES2 specification does not specify how to behave if pointer is a null
			// pointer. Since calling this function does not make sense if pointer ==
			// null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		HEAP32[pointer >> 2] = GLctx.getVertexAttribOffset(index, pname);
	};
	_emscripten_glGetVertexAttribPointerv.sig = 'viip';

	/** @suppress{checkTypes} */
	var emscriptenWebGLGetVertexAttrib = (index, pname, params, type) => {
		if (!params) {
			// GLES2 specification does not specify how to behave if params is a null
			// pointer. Since calling this function does not make sense if params ==
			// null, issue a GL error to notify user about it.
			GL.recordError(0x501 /* GL_INVALID_VALUE */);
			return;
		}
		var data = GLctx.getVertexAttrib(index, pname);
		if (pname == 0x889f /*VERTEX_ATTRIB_ARRAY_BUFFER_BINDING*/) {
			HEAP32[params >> 2] = data && data['name'];
		} else if (typeof data == 'number' || typeof data == 'boolean') {
			switch (type) {
				case 0:
					HEAP32[params >> 2] = data;
					break;
				case 2:
					HEAPF32[params >> 2] = data;
					break;
				case 5:
					HEAP32[params >> 2] = Math.fround(data);
					break;
			}
		} else {
			for (var i = 0; i < data.length; i++) {
				switch (type) {
					case 0:
						HEAP32[(params + i * 4) >> 2] = data[i];
						break;
					case 2:
						HEAPF32[(params + i * 4) >> 2] = data[i];
						break;
					case 5:
						HEAP32[(params + i * 4) >> 2] = Math.fround(data[i]);
						break;
				}
			}
		}
	};

	var _emscripten_glGetVertexAttribfv = (index, pname, params) => {
		// N.B. This function may only be called if the vertex attribute was
		// specified using the function glVertexAttrib*f(), otherwise the results
		// are undefined. (GLES3 spec 6.1.12)
		emscriptenWebGLGetVertexAttrib(index, pname, params, 2);
	};
	_emscripten_glGetVertexAttribfv.sig = 'viip';

	var _emscripten_glGetVertexAttribiv = (index, pname, params) => {
		// N.B. This function may only be called if the vertex attribute was
		// specified using the function glVertexAttrib*f(), otherwise the results
		// are undefined. (GLES3 spec 6.1.12)
		emscriptenWebGLGetVertexAttrib(index, pname, params, 5);
	};
	_emscripten_glGetVertexAttribiv.sig = 'viip';

	var _emscripten_glHint = (x0, x1) => GLctx.hint(x0, x1);
	_emscripten_glHint.sig = 'vii';

	var _emscripten_glIsBuffer = (buffer) => {
		var b = GL.buffers[buffer];
		if (!b) return 0;
		return GLctx.isBuffer(b);
	};
	_emscripten_glIsBuffer.sig = 'ii';

	var _emscripten_glIsEnabled = (x0) => GLctx.isEnabled(x0);
	_emscripten_glIsEnabled.sig = 'ii';

	var _emscripten_glIsFramebuffer = (framebuffer) => {
		var fb = GL.framebuffers[framebuffer];
		if (!fb) return 0;
		return GLctx.isFramebuffer(fb);
	};
	_emscripten_glIsFramebuffer.sig = 'ii';

	var _emscripten_glIsProgram = (program) => {
		program = GL.programs[program];
		if (!program) return 0;
		return GLctx.isProgram(program);
	};
	_emscripten_glIsProgram.sig = 'ii';

	var _emscripten_glIsQueryEXT = (id) => {
		var query = GL.queries[id];
		if (!query) return 0;
		return GLctx.disjointTimerQueryExt['isQueryEXT'](query);
	};
	_emscripten_glIsQueryEXT.sig = 'ii';

	var _emscripten_glIsRenderbuffer = (renderbuffer) => {
		var rb = GL.renderbuffers[renderbuffer];
		if (!rb) return 0;
		return GLctx.isRenderbuffer(rb);
	};
	_emscripten_glIsRenderbuffer.sig = 'ii';

	var _emscripten_glIsShader = (shader) => {
		var s = GL.shaders[shader];
		if (!s) return 0;
		return GLctx.isShader(s);
	};
	_emscripten_glIsShader.sig = 'ii';

	var _emscripten_glIsTexture = (id) => {
		var texture = GL.textures[id];
		if (!texture) return 0;
		return GLctx.isTexture(texture);
	};
	_emscripten_glIsTexture.sig = 'ii';

	var _emscripten_glIsVertexArray = (array) => {
		var vao = GL.vaos[array];
		if (!vao) return 0;
		return GLctx.isVertexArray(vao);
	};
	_emscripten_glIsVertexArray.sig = 'ii';
	var _emscripten_glIsVertexArrayOES = _emscripten_glIsVertexArray;
	_emscripten_glIsVertexArrayOES.sig = 'ii';

	var _emscripten_glLineWidth = (x0) => GLctx.lineWidth(x0);
	_emscripten_glLineWidth.sig = 'vf';

	var _emscripten_glLinkProgram = (program) => {
		program = GL.programs[program];
		GLctx.linkProgram(program);
		// Invalidate earlier computed uniform->ID mappings, those have now become stale
		program.uniformLocsById = 0; // Mark as null-like so that glGetUniformLocation() knows to populate this again.
		program.uniformSizeAndIdsByName = {};
	};
	_emscripten_glLinkProgram.sig = 'vi';

	var _emscripten_glPixelStorei = (pname, param) => {
		if (pname == 3317) {
			GL.unpackAlignment = param;
		} else if (pname == 3314) {
			GL.unpackRowLength = param;
		}
		GLctx.pixelStorei(pname, param);
	};
	_emscripten_glPixelStorei.sig = 'vii';

	var _emscripten_glPolygonModeWEBGL = (face, mode) => {
		GLctx.webglPolygonMode['polygonModeWEBGL'](face, mode);
	};
	_emscripten_glPolygonModeWEBGL.sig = 'vii';

	var _emscripten_glPolygonOffset = (x0, x1) => GLctx.polygonOffset(x0, x1);
	_emscripten_glPolygonOffset.sig = 'vff';

	var _emscripten_glPolygonOffsetClampEXT = (factor, units, clamp) => {
		GLctx.extPolygonOffsetClamp['polygonOffsetClampEXT'](
			factor,
			units,
			clamp
		);
	};
	_emscripten_glPolygonOffsetClampEXT.sig = 'vfff';

	var _emscripten_glQueryCounterEXT = (id, target) => {
		GLctx.disjointTimerQueryExt['queryCounterEXT'](GL.queries[id], target);
	};
	_emscripten_glQueryCounterEXT.sig = 'vii';

	var computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
		function roundedToNextMultipleOf(x, y) {
			return (x + y - 1) & -y;
		}
		var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel;
		var alignedRowSize = roundedToNextMultipleOf(
			plainRowSize,
			GL.unpackAlignment
		);
		return height * alignedRowSize;
	};

	var colorChannelsInGlTextureFormat = (format) => {
		// Micro-optimizations for size: map format to size by subtracting smallest
		// enum value (0x1902) from all values first.  Also omit the most common
		// size value (1) from the list, which is assumed by formats not on the
		// list.
		var colorChannels = {
			// 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
			// 0x1906 /* GL_ALPHA */ - 0x1902: 1,
			5: 3,
			6: 4,
			// 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
			8: 2,
			29502: 3,
			29504: 4,
		};
		return colorChannels[format - 0x1902] || 1;
	};

	var heapObjectForWebGLType = (type) => {
		// Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
		// smaller values for the heap, for shorter generated code size.
		// Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
		// (since most types are HEAPU16)
		type -= 0x1400;

		if (type == 1) return HEAPU8;

		if (type == 4) return HEAP32;

		if (type == 6) return HEAPF32;

		if (type == 5 || type == 28922) return HEAPU32;

		return HEAPU16;
	};

	var toTypedArrayIndex = (pointer, heap) =>
		pointer >>> (31 - Math.clz32(heap.BYTES_PER_ELEMENT));

	var emscriptenWebGLGetTexPixelData = (
		type,
		format,
		width,
		height,
		pixels,
		internalFormat
	) => {
		var heap = heapObjectForWebGLType(type);
		var sizePerPixel =
			colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT;
		var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel);
		return heap.subarray(
			toTypedArrayIndex(pixels, heap),
			toTypedArrayIndex(pixels + bytes, heap)
		);
	};

	var _emscripten_glReadPixels = (
		x,
		y,
		width,
		height,
		format,
		type,
		pixels
	) => {
		var pixelData = emscriptenWebGLGetTexPixelData(
			type,
			format,
			width,
			height,
			pixels,
			format
		);
		if (!pixelData) {
			GL.recordError(0x500 /*GL_INVALID_ENUM*/);
			return;
		}
		GLctx.readPixels(x, y, width, height, format, type, pixelData);
	};
	_emscripten_glReadPixels.sig = 'viiiiiip';

	var _emscripten_glReleaseShaderCompiler = () => {
		// NOP (as allowed by GLES 2.0 spec)
	};
	_emscripten_glReleaseShaderCompiler.sig = 'v';

	var _emscripten_glRenderbufferStorage = (x0, x1, x2, x3) =>
		GLctx.renderbufferStorage(x0, x1, x2, x3);
	_emscripten_glRenderbufferStorage.sig = 'viiii';

	var _emscripten_glSampleCoverage = (value, invert) => {
		GLctx.sampleCoverage(value, !!invert);
	};
	_emscripten_glSampleCoverage.sig = 'vfi';

	var _emscripten_glScissor = (x0, x1, x2, x3) =>
		GLctx.scissor(x0, x1, x2, x3);
	_emscripten_glScissor.sig = 'viiii';

	var _emscripten_glShaderBinary = (
		count,
		shaders,
		binaryformat,
		binary,
		length
	) => {
		GL.recordError(0x500 /*GL_INVALID_ENUM*/);
	};
	_emscripten_glShaderBinary.sig = 'vipipi';

	var _emscripten_glShaderSource = (shader, count, string, length) => {
		var source = GL.getSource(shader, count, string, length);

		GLctx.shaderSource(GL.shaders[shader], source);
	};
	_emscripten_glShaderSource.sig = 'viipp';

	var _emscripten_glStencilFunc = (x0, x1, x2) =>
		GLctx.stencilFunc(x0, x1, x2);
	_emscripten_glStencilFunc.sig = 'viii';

	var _emscripten_glStencilFuncSeparate = (x0, x1, x2, x3) =>
		GLctx.stencilFuncSeparate(x0, x1, x2, x3);
	_emscripten_glStencilFuncSeparate.sig = 'viiii';

	var _emscripten_glStencilMask = (x0) => GLctx.stencilMask(x0);
	_emscripten_glStencilMask.sig = 'vi';

	var _emscripten_glStencilMaskSeparate = (x0, x1) =>
		GLctx.stencilMaskSeparate(x0, x1);
	_emscripten_glStencilMaskSeparate.sig = 'vii';

	var _emscripten_glStencilOp = (x0, x1, x2) => GLctx.stencilOp(x0, x1, x2);
	_emscripten_glStencilOp.sig = 'viii';

	var _emscripten_glStencilOpSeparate = (x0, x1, x2, x3) =>
		GLctx.stencilOpSeparate(x0, x1, x2, x3);
	_emscripten_glStencilOpSeparate.sig = 'viiii';

	var _emscripten_glTexImage2D = (
		target,
		level,
		internalFormat,
		width,
		height,
		border,
		format,
		type,
		pixels
	) => {
		var pixelData = pixels
			? emscriptenWebGLGetTexPixelData(
					type,
					format,
					width,
					height,
					pixels,
					internalFormat
				)
			: null;
		GLctx.texImage2D(
			target,
			level,
			internalFormat,
			width,
			height,
			border,
			format,
			type,
			pixelData
		);
	};
	_emscripten_glTexImage2D.sig = 'viiiiiiiip';

	var _emscripten_glTexParameterf = (x0, x1, x2) =>
		GLctx.texParameterf(x0, x1, x2);
	_emscripten_glTexParameterf.sig = 'viif';

	var _emscripten_glTexParameterfv = (target, pname, params) => {
		var param = HEAPF32[params >> 2];
		GLctx.texParameterf(target, pname, param);
	};
	_emscripten_glTexParameterfv.sig = 'viip';

	var _emscripten_glTexParameteri = (x0, x1, x2) =>
		GLctx.texParameteri(x0, x1, x2);
	_emscripten_glTexParameteri.sig = 'viii';

	var _emscripten_glTexParameteriv = (target, pname, params) => {
		var param = HEAP32[params >> 2];
		GLctx.texParameteri(target, pname, param);
	};
	_emscripten_glTexParameteriv.sig = 'viip';

	var _emscripten_glTexSubImage2D = (
		target,
		level,
		xoffset,
		yoffset,
		width,
		height,
		format,
		type,
		pixels
	) => {
		var pixelData = pixels
			? emscriptenWebGLGetTexPixelData(
					type,
					format,
					width,
					height,
					pixels,
					0
				)
			: null;
		GLctx.texSubImage2D(
			target,
			level,
			xoffset,
			yoffset,
			width,
			height,
			format,
			type,
			pixelData
		);
	};
	_emscripten_glTexSubImage2D.sig = 'viiiiiiiip';

	var _emscripten_glUniform1f = (location, v0) => {
		GLctx.uniform1f(webglGetUniformLocation(location), v0);
	};
	_emscripten_glUniform1f.sig = 'vif';

	var miniTempWebGLFloatBuffers = [];

	var _emscripten_glUniform1fv = (location, count, value) => {
		if (count <= 288) {
			// avoid allocation when uploading few enough uniforms
			var view = miniTempWebGLFloatBuffers[count];
			for (var i = 0; i < count; ++i) {
				view[i] = HEAPF32[(value + 4 * i) >> 2];
			}
		} else {
			var view = HEAPF32.subarray(value >> 2, (value + count * 4) >> 2);
		}
		GLctx.uniform1fv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform1fv.sig = 'viip';

	var _emscripten_glUniform1i = (location, v0) => {
		GLctx.uniform1i(webglGetUniformLocation(location), v0);
	};
	_emscripten_glUniform1i.sig = 'vii';

	var miniTempWebGLIntBuffers = [];

	var _emscripten_glUniform1iv = (location, count, value) => {
		if (count <= 288) {
			// avoid allocation when uploading few enough uniforms
			var view = miniTempWebGLIntBuffers[count];
			for (var i = 0; i < count; ++i) {
				view[i] = HEAP32[(value + 4 * i) >> 2];
			}
		} else {
			var view = HEAP32.subarray(value >> 2, (value + count * 4) >> 2);
		}
		GLctx.uniform1iv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform1iv.sig = 'viip';

	var _emscripten_glUniform2f = (location, v0, v1) => {
		GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
	};
	_emscripten_glUniform2f.sig = 'viff';

	var _emscripten_glUniform2fv = (location, count, value) => {
		if (count <= 144) {
			// avoid allocation when uploading few enough uniforms
			count *= 2;
			var view = miniTempWebGLFloatBuffers[count];
			for (var i = 0; i < count; i += 2) {
				view[i] = HEAPF32[(value + 4 * i) >> 2];
				view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
			}
		} else {
			var view = HEAPF32.subarray(value >> 2, (value + count * 8) >> 2);
		}
		GLctx.uniform2fv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform2fv.sig = 'viip';

	var _emscripten_glUniform2i = (location, v0, v1) => {
		GLctx.uniform2i(webglGetUniformLocation(location), v0, v1);
	};
	_emscripten_glUniform2i.sig = 'viii';

	var _emscripten_glUniform2iv = (location, count, value) => {
		if (count <= 144) {
			// avoid allocation when uploading few enough uniforms
			count *= 2;
			var view = miniTempWebGLIntBuffers[count];
			for (var i = 0; i < count; i += 2) {
				view[i] = HEAP32[(value + 4 * i) >> 2];
				view[i + 1] = HEAP32[(value + (4 * i + 4)) >> 2];
			}
		} else {
			var view = HEAP32.subarray(value >> 2, (value + count * 8) >> 2);
		}
		GLctx.uniform2iv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform2iv.sig = 'viip';

	var _emscripten_glUniform3f = (location, v0, v1, v2) => {
		GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2);
	};
	_emscripten_glUniform3f.sig = 'vifff';

	var _emscripten_glUniform3fv = (location, count, value) => {
		if (count <= 96) {
			// avoid allocation when uploading few enough uniforms
			count *= 3;
			var view = miniTempWebGLFloatBuffers[count];
			for (var i = 0; i < count; i += 3) {
				view[i] = HEAPF32[(value + 4 * i) >> 2];
				view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
				view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
			}
		} else {
			var view = HEAPF32.subarray(value >> 2, (value + count * 12) >> 2);
		}
		GLctx.uniform3fv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform3fv.sig = 'viip';

	var _emscripten_glUniform3i = (location, v0, v1, v2) => {
		GLctx.uniform3i(webglGetUniformLocation(location), v0, v1, v2);
	};
	_emscripten_glUniform3i.sig = 'viiii';

	var _emscripten_glUniform3iv = (location, count, value) => {
		if (count <= 96) {
			// avoid allocation when uploading few enough uniforms
			count *= 3;
			var view = miniTempWebGLIntBuffers[count];
			for (var i = 0; i < count; i += 3) {
				view[i] = HEAP32[(value + 4 * i) >> 2];
				view[i + 1] = HEAP32[(value + (4 * i + 4)) >> 2];
				view[i + 2] = HEAP32[(value + (4 * i + 8)) >> 2];
			}
		} else {
			var view = HEAP32.subarray(value >> 2, (value + count * 12) >> 2);
		}
		GLctx.uniform3iv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform3iv.sig = 'viip';

	var _emscripten_glUniform4f = (location, v0, v1, v2, v3) => {
		GLctx.uniform4f(webglGetUniformLocation(location), v0, v1, v2, v3);
	};
	_emscripten_glUniform4f.sig = 'viffff';

	var _emscripten_glUniform4fv = (location, count, value) => {
		if (count <= 72) {
			// avoid allocation when uploading few enough uniforms
			var view = miniTempWebGLFloatBuffers[4 * count];
			// hoist the heap out of the loop for size and for pthreads+growth.
			var heap = HEAPF32;
			value = value >> 2;
			count *= 4;
			for (var i = 0; i < count; i += 4) {
				var dst = value + i;
				view[i] = heap[dst];
				view[i + 1] = heap[dst + 1];
				view[i + 2] = heap[dst + 2];
				view[i + 3] = heap[dst + 3];
			}
		} else {
			var view = HEAPF32.subarray(value >> 2, (value + count * 16) >> 2);
		}
		GLctx.uniform4fv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform4fv.sig = 'viip';

	var _emscripten_glUniform4i = (location, v0, v1, v2, v3) => {
		GLctx.uniform4i(webglGetUniformLocation(location), v0, v1, v2, v3);
	};
	_emscripten_glUniform4i.sig = 'viiiii';

	var _emscripten_glUniform4iv = (location, count, value) => {
		if (count <= 72) {
			// avoid allocation when uploading few enough uniforms
			count *= 4;
			var view = miniTempWebGLIntBuffers[count];
			for (var i = 0; i < count; i += 4) {
				view[i] = HEAP32[(value + 4 * i) >> 2];
				view[i + 1] = HEAP32[(value + (4 * i + 4)) >> 2];
				view[i + 2] = HEAP32[(value + (4 * i + 8)) >> 2];
				view[i + 3] = HEAP32[(value + (4 * i + 12)) >> 2];
			}
		} else {
			var view = HEAP32.subarray(value >> 2, (value + count * 16) >> 2);
		}
		GLctx.uniform4iv(webglGetUniformLocation(location), view);
	};
	_emscripten_glUniform4iv.sig = 'viip';

	var _emscripten_glUniformMatrix2fv = (
		location,
		count,
		transpose,
		value
	) => {
		if (count <= 72) {
			// avoid allocation when uploading few enough uniforms
			count *= 4;
			var view = miniTempWebGLFloatBuffers[count];
			for (var i = 0; i < count; i += 4) {
				view[i] = HEAPF32[(value + 4 * i) >> 2];
				view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
				view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
				view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
			}
		} else {
			var view = HEAPF32.subarray(value >> 2, (value + count * 16) >> 2);
		}
		GLctx.uniformMatrix2fv(
			webglGetUniformLocation(location),
			!!transpose,
			view
		);
	};
	_emscripten_glUniformMatrix2fv.sig = 'viiip';

	var _emscripten_glUniformMatrix3fv = (
		location,
		count,
		transpose,
		value
	) => {
		if (count <= 32) {
			// avoid allocation when uploading few enough uniforms
			count *= 9;
			var view = miniTempWebGLFloatBuffers[count];
			for (var i = 0; i < count; i += 9) {
				view[i] = HEAPF32[(value + 4 * i) >> 2];
				view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
				view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
				view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
				view[i + 4] = HEAPF32[(value + (4 * i + 16)) >> 2];
				view[i + 5] = HEAPF32[(value + (4 * i + 20)) >> 2];
				view[i + 6] = HEAPF32[(value + (4 * i + 24)) >> 2];
				view[i + 7] = HEAPF32[(value + (4 * i + 28)) >> 2];
				view[i + 8] = HEAPF32[(value + (4 * i + 32)) >> 2];
			}
		} else {
			var view = HEAPF32.subarray(value >> 2, (value + count * 36) >> 2);
		}
		GLctx.uniformMatrix3fv(
			webglGetUniformLocation(location),
			!!transpose,
			view
		);
	};
	_emscripten_glUniformMatrix3fv.sig = 'viiip';

	var _emscripten_glUniformMatrix4fv = (
		location,
		count,
		transpose,
		value
	) => {
		if (count <= 18) {
			// avoid allocation when uploading few enough uniforms
			var view = miniTempWebGLFloatBuffers[16 * count];
			// hoist the heap out of the loop for size and for pthreads+growth.
			var heap = HEAPF32;
			value = value >> 2;
			count *= 16;
			for (var i = 0; i < count; i += 16) {
				var dst = value + i;
				view[i] = heap[dst];
				view[i + 1] = heap[dst + 1];
				view[i + 2] = heap[dst + 2];
				view[i + 3] = heap[dst + 3];
				view[i + 4] = heap[dst + 4];
				view[i + 5] = heap[dst + 5];
				view[i + 6] = heap[dst + 6];
				view[i + 7] = heap[dst + 7];
				view[i + 8] = heap[dst + 8];
				view[i + 9] = heap[dst + 9];
				view[i + 10] = heap[dst + 10];
				view[i + 11] = heap[dst + 11];
				view[i + 12] = heap[dst + 12];
				view[i + 13] = heap[dst + 13];
				view[i + 14] = heap[dst + 14];
				view[i + 15] = heap[dst + 15];
			}
		} else {
			var view = HEAPF32.subarray(value >> 2, (value + count * 64) >> 2);
		}
		GLctx.uniformMatrix4fv(
			webglGetUniformLocation(location),
			!!transpose,
			view
		);
	};
	_emscripten_glUniformMatrix4fv.sig = 'viiip';

	var _emscripten_glUseProgram = (program) => {
		program = GL.programs[program];
		GLctx.useProgram(program);
		// Record the currently active program so that we can access the uniform
		// mapping table of that program.
		GLctx.currentProgram = program;
	};
	_emscripten_glUseProgram.sig = 'vi';

	var _emscripten_glValidateProgram = (program) => {
		GLctx.validateProgram(GL.programs[program]);
	};
	_emscripten_glValidateProgram.sig = 'vi';

	var _emscripten_glVertexAttrib1f = (x0, x1) => GLctx.vertexAttrib1f(x0, x1);
	_emscripten_glVertexAttrib1f.sig = 'vif';

	var _emscripten_glVertexAttrib1fv = (index, v) => {
		GLctx.vertexAttrib1f(index, HEAPF32[v >> 2]);
	};
	_emscripten_glVertexAttrib1fv.sig = 'vip';

	var _emscripten_glVertexAttrib2f = (x0, x1, x2) =>
		GLctx.vertexAttrib2f(x0, x1, x2);
	_emscripten_glVertexAttrib2f.sig = 'viff';

	var _emscripten_glVertexAttrib2fv = (index, v) => {
		GLctx.vertexAttrib2f(index, HEAPF32[v >> 2], HEAPF32[(v + 4) >> 2]);
	};
	_emscripten_glVertexAttrib2fv.sig = 'vip';

	var _emscripten_glVertexAttrib3f = (x0, x1, x2, x3) =>
		GLctx.vertexAttrib3f(x0, x1, x2, x3);
	_emscripten_glVertexAttrib3f.sig = 'vifff';

	var _emscripten_glVertexAttrib3fv = (index, v) => {
		GLctx.vertexAttrib3f(
			index,
			HEAPF32[v >> 2],
			HEAPF32[(v + 4) >> 2],
			HEAPF32[(v + 8) >> 2]
		);
	};
	_emscripten_glVertexAttrib3fv.sig = 'vip';

	var _emscripten_glVertexAttrib4f = (x0, x1, x2, x3, x4) =>
		GLctx.vertexAttrib4f(x0, x1, x2, x3, x4);
	_emscripten_glVertexAttrib4f.sig = 'viffff';

	var _emscripten_glVertexAttrib4fv = (index, v) => {
		GLctx.vertexAttrib4f(
			index,
			HEAPF32[v >> 2],
			HEAPF32[(v + 4) >> 2],
			HEAPF32[(v + 8) >> 2],
			HEAPF32[(v + 12) >> 2]
		);
	};
	_emscripten_glVertexAttrib4fv.sig = 'vip';

	var _emscripten_glVertexAttribDivisor = (index, divisor) => {
		GLctx.vertexAttribDivisor(index, divisor);
	};
	_emscripten_glVertexAttribDivisor.sig = 'vii';
	var _emscripten_glVertexAttribDivisorANGLE =
		_emscripten_glVertexAttribDivisor;

	var _emscripten_glVertexAttribPointer = (
		index,
		size,
		type,
		normalized,
		stride,
		ptr
	) => {
		GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
	};
	_emscripten_glVertexAttribPointer.sig = 'viiiiip';

	var _emscripten_glViewport = (x0, x1, x2, x3) =>
		GLctx.viewport(x0, x1, x2, x3);
	_emscripten_glViewport.sig = 'viiii';

	var _emscripten_out = (str) => out(UTF8ToString(str));
	_emscripten_out.sig = 'vp';

	class HandleAllocator {
		allocated = [undefined];
		freelist = [];
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
			// Set the slot to `undefined` rather than using `delete` here since
			// apparently arrays with holes in them can be less efficient.
			this.allocated[id] = undefined;
			this.freelist.push(id);
		}
	}
	var promiseMap = new HandleAllocator();
	var makePromise = () => {
		var promiseInfo = {};
		promiseInfo.promise = new Promise((resolve, reject) => {
			promiseInfo.reject = reject;
			promiseInfo.resolve = resolve;
		});
		promiseInfo.id = promiseMap.allocate(promiseInfo);
		return promiseInfo;
	};
	var _emscripten_promise_create = () => makePromise().id;
	_emscripten_promise_create.sig = 'p';

	var _emscripten_promise_destroy = (id) => {
		promiseMap.free(id);
	};
	_emscripten_promise_destroy.sig = 'vp';

	var getPromise = (id) => promiseMap.get(id).promise;

	var _emscripten_promise_resolve = (id, result, value) => {
		var info = promiseMap.get(id);
		switch (result) {
			case 0:
				info.resolve(value);
				return;
			case 1:
				info.resolve(getPromise(value));
				return;
			case 2:
				info.resolve(getPromise(value));
				_emscripten_promise_destroy(value);
				return;
			case 3:
				info.reject(value);
				return;
		}
	};
	_emscripten_promise_resolve.sig = 'vpip';

	var growMemory = (size) => {
		var oldHeapSize = wasmMemory.buffer.byteLength;
		var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
		try {
			// round size grow request up to wasm page size (fixed 64KB per spec)
			wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
			updateMemoryViews();
			return 1 /*success*/;
		} catch (e) {}
		// implicit 0 return to save code size (caller will cast "undefined" into 0
		// anyhow)
	};
	var _emscripten_resize_heap = (requestedSize) => {
		var oldSize = HEAPU8.length;
		// With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
		requestedSize >>>= 0;
		// With multithreaded builds, races can happen (another thread might increase the size
		// in between), so return a failure, and let the caller retry.

		// Memory resize rules:
		// 1.  Always increase heap size to at least the requested size, rounded up
		//     to next page multiple.
		// 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
		//     geometrically: increase the heap size according to
		//     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
		//     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
		// 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
		//     linearly: increase the heap size by at least
		//     MEMORY_GROWTH_LINEAR_STEP bytes.
		// 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
		//     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
		// 4.  If we were unable to allocate as much memory, it may be due to
		//     over-eager decision to excessively reserve due to (3) above.
		//     Hence if an allocation fails, cut down on the amount of excess
		//     growth, in an attempt to succeed to perform a smaller allocation.

		// A limit is set for how much we can grow. We should not exceed that
		// (the wasm binary specifies it, so if we tried, we'd fail anyhow).
		var maxHeapSize = getHeapMax();
		if (requestedSize > maxHeapSize) {
			return false;
		}

		// Loop through potential heap size increases. If we attempt a too eager
		// reservation that fails, cut down on the attempted size and reserve a
		// smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
		for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
			var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
			// but limit overreserving (default to capping at +96MB overgrowth at most)
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

	var maybeCStringToJsString = (cString) => {
		// "cString > 2" checks if the input is a number, and isn't of the special
		// values we accept here, EMSCRIPTEN_EVENT_TARGET_* (which map to 0, 1, 2).
		// In other words, if cString > 2 then it's a pointer to a valid place in
		// memory, and points to a C string.
		return cString > 2 ? UTF8ToString(cString) : cString;
	};

	/** @type {Object} */
	var specialHTMLTargets = [
		0,
		typeof document != 'undefined' ? document : 0,
		typeof window != 'undefined' ? window : 0,
	];
	var findEventTarget = (target) => {
		target = maybeCStringToJsString(target);
		var domElement =
			specialHTMLTargets[target] ||
			(typeof document != 'undefined'
				? document.querySelector(target)
				: null);
		return domElement;
	};
	var findCanvasEventTarget = findEventTarget;
	var _emscripten_set_canvas_element_size = (target, width, height) => {
		var canvas = findCanvasEventTarget(target);
		if (!canvas) return -4;
		canvas.width = width;
		canvas.height = height;
		return 0;
	};
	_emscripten_set_canvas_element_size.sig = 'ipii';

	/** @param {number=} timeout */
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

	var _emscripten_wget_data = (url, pbuffer, pnum, perror) =>
		Asyncify.handleAsync(async () => {
			/* no need for run dependency, this is async but will not do any prepare etc. step */
			try {
				const byteArray = await asyncLoad(UTF8ToString(url));
				// can only allocate the buffer after the wakeUp, not during an asyncing
				var buffer = _malloc(byteArray.length); // must be freed by caller!
				HEAPU8.set(byteArray, buffer);
				HEAPU32[pbuffer >> 2] = buffer;
				HEAP32[pnum >> 2] = byteArray.length;
				HEAP32[perror >> 2] = 0;
			} catch (err) {
				HEAP32[perror >> 2] = 1;
			}
		});
	_emscripten_wget_data.sig = 'vpppp';
	_emscripten_wget_data.isAsync = true;

	var ENV = PHPLoader.ENV || {};

	var getEnvStrings = () => {
		if (!getEnvStrings.strings) {
			// Default values.
			// Browser language detection #8751
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
			// Apply the user-provided values, if any.
			for (var x in ENV) {
				// x is a key in ENV; if ENV[x] is undefined, that means it was
				// explicitly set to be so. We allow user code to do that to
				// force variables with default values to remain unset.
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

	function _fd_fdstat_get(fd, pbuf) {
		try {
			var rightsBase = 0;
			var rightsInheriting = 0;
			var flags = 0;
			{
				var stream = SYSCALLS.getStreamFromFD(fd);
				// All character devices are terminals (other things a Linux system would
				// assume is a character device, like the mouse, we have special APIs for).
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

	/** @param {number=} offset */
	var doReadv = (stream, iov, iovcnt, offset) => {
		var ret = 0;
		for (var i = 0; i < iovcnt; i++) {
			var ptr = HEAPU32[iov >> 2];
			var len = HEAPU32[(iov + 4) >> 2];
			iov += 8;
			var curr = FS.read(stream, HEAP8, ptr, len, offset);
			if (curr < 0) return -1;
			ret += curr;
			if (curr < len) break; // nothing more to read
			if (typeof offset != 'undefined') {
				offset += curr;
			}
		}
		return ret;
	};

	function _fd_pread(fd, iov, iovcnt, offset, pnum) {
		offset = bigintToI53Checked(offset);

		try {
			if (isNaN(offset)) return 61;
			var stream = SYSCALLS.getStreamFromFD(fd);
			var num = doReadv(stream, iov, iovcnt, offset);
			HEAPU32[pnum >> 2] = num;
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_fd_pread.sig = 'iippjp';

	/** @param {number=} offset */
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
				// No more space to write.
				break;
			}
			if (typeof offset != 'undefined') {
				offset += curr;
			}
		}
		return ret;
	};

	function _fd_pwrite(fd, iov, iovcnt, offset, pnum) {
		offset = bigintToI53Checked(offset);

		try {
			if (isNaN(offset)) return 61;
			var stream = SYSCALLS.getStreamFromFD(fd);
			var num = doWritev(stream, iov, iovcnt, offset);
			HEAPU32[pnum >> 2] = num;
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}
	_fd_pwrite.sig = 'iippjp';

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
				stream.getdents = null; // reset readdir state
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
					// We write directly to the file system, so there's nothing to do here.
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
		// Note getaddrinfo currently only returns a single addrinfo with ai_next defaulting to NULL. When NULL
		// hints are specified or ai_family set to AF_UNSPEC or ai_socktype or ai_protocol set to 0 then we
		// really should provide a linked list of suitable addrinfo values.
		var addrs = [];
		var canon = null;
		var addr = 0;
		var port = 0;
		var flags = 0;
		var family = 0;
		var type = 0;
		var proto = 0;
		var ai, last;

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

		// If type or proto are set to zero in hints we should really be returning multiple addrinfo values, but for
		// now default to a TCP STREAM socket so we can at least return a sensible addrinfo given NULL hints.
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
			// TODO
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
				// TODO support resolving well-known service names from:
				// http://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.txt
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

		//
		// try as a numeric address
		//
		node = UTF8ToString(node);
		addr = inetPton4(node);
		if (addr !== null) {
			// incoming node is a valid ipv4 address
			if (family === 0 || family === 2) {
				family = 2;
			} else if (family === 10 && flags & 8) {
				addr = [0, 0, _htonl(0xffff), addr];
				family = 10;
			} else {
				return -2;
			}
		} else {
			addr = inetPton6(node);
			if (addr !== null) {
				// incoming node is a valid ipv6 address
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

		//
		// try as a hostname
		//
		// resolve the hostname to a temporary fake address
		node = DNS.lookup_name(node);
		addr = inetPton4(node);
		if (family === 0) {
			family = 2;
		} else if (family === 10) {
			addr = [0, 0, _htonl(0xffff), addr];
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
			// Note: even when we overflow, getnameinfo() is specced to write out the truncated results.
			return -12;
		}

		return 0;
	};
	_getnameinfo.sig = 'ipipipii';

	var Protocols = {
		list: [],
		map: {},
	};

	var stringToAscii = (str, buffer) => {
		for (var i = 0; i < str.length; ++i) {
			HEAP8[buffer++] = str.charCodeAt(i);
		}
		// Null-terminate the string
		HEAP8[buffer] = 0;
	};

	var _setprotoent = (stayopen) => {
		// void setprotoent(int stayopen);

		// Allocate and populate a protoent structure given a name, protocol number and array of aliases
		function allocprotoent(name, proto, aliases) {
			// write name into buffer
			var nameBuf = _malloc(name.length + 1);
			stringToAscii(name, nameBuf);

			// write aliases into buffer
			var j = 0;
			var length = aliases.length;
			var aliasListBuf = _malloc((length + 1) * 4); // Use length + 1 so we have space for the terminating NULL ptr.

			for (var i = 0; i < length; i++, j += 4) {
				var alias = aliases[i];
				var aliasBuf = _malloc(alias.length + 1);
				stringToAscii(alias, aliasBuf);
				HEAPU32[(aliasListBuf + j) >> 2] = aliasBuf;
			}
			HEAPU32[(aliasListBuf + j) >> 2] = 0; // Terminating NULL pointer.

			// generate protoent
			var pe = _malloc(12);
			HEAPU32[pe >> 2] = nameBuf;
			HEAPU32[(pe + 4) >> 2] = aliasListBuf;
			HEAP32[(pe + 8) >> 2] = proto;
			return pe;
		}

		// Populate the protocol 'database'. The entries are limited to tcp and udp, though it is fairly trivial
		// to add extra entries from /etc/protocols if desired - though not sure if that'd actually be useful.
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
		// struct protoent *getprotobyname(const char *);
		name = UTF8ToString(name);
		_setprotoent(true);
		var result = Protocols.map[name];
		return result;
	};
	_getprotobyname.sig = 'pp';

	var _getprotobynumber = (number) => {
		// struct protoent *getprotobynumber(int proto);
		_setprotoent(true);
		var result = Protocols.map[number];
		return result;
	};
	_getprotobynumber.sig = 'pi';

	var _js_flock = function js_flock(fd, op) {
		return Asyncify.handleAsync(async () => {
			_js_wasm_trace('js_flock(%d, %d)', fd, op);
			// Emscripten does not expose these constants to JS, so we hardcode them here.
			// Based on
			// https://github.com/emscripten-core/emscripten/blob/76860cc47cef67f5712a7a03a247bc1baabf7ba4/system/lib/libc/musl/include/sys/file.h#L7-L10
			const emscripten_LOCK_SH = 1;
			const emscripten_LOCK_EX = 2;
			const emscripten_LOCK_NB = 4;
			const emscripten_LOCK_UN = 8;

			const flockToLockOpType = {
				[emscripten_LOCK_SH]: 'shared',
				[emscripten_LOCK_EX]: 'exclusive',
				[emscripten_LOCK_UN]: 'unlocked',
			};

			let vfsPath;
			let errno;

			[vfsPath, errno] = locking.get_vfs_path_from_fd(fd);
			if (errno !== 0) {
				_js_wasm_trace(
					'js_flock(%d, %d) get_vfs_path_from_fd errno %d',
					fd,
					op,
					vfsPath,
					errno
				);
				return -errno;
			}

			if (!locking.is_path_to_shared_fs(vfsPath)) {
				_js_wasm_trace(
					'flock(%d, %d) locking is not implemented for non-NodeFS path %s',
					fd,
					op,
					vfsPath
				);
				// If not a NodeFS path, we can't lock it.
				// Default to succeeding as Emscripten does.
				return 0;
			}

			errno = locking.check_lock_params(fd, op);
			if (errno !== 0) {
				_js_wasm_trace(
					'js_flock(%d, %d) check_lock_params errno %d',
					fd,
					op,
					errno
				);
				return -errno;
			}

			// @TODO: Consider supporting blocking mode of flock()
			if (op & (emscripten_LOCK_NB === 0)) {
				_js_wasm_trace(
					'js_flock(%d, %d) blocking mode of flock() is not implemented',
					fd,
					op
				);
				// We do not yet support the blocking form of flock().
				// We respond with EINVAL to indicate failure
				// because it is a known errno for a failed blocking flock().
				return -ERRNO_CODES.EINVAL;
			}

			const maskedOp =
				op &
				(emscripten_LOCK_SH | emscripten_LOCK_EX | emscripten_LOCK_UN);

			const lockOpType = flockToLockOpType[maskedOp];
			if (lockOpType === undefined) {
				_js_wasm_trace(
					'js_flock(%d, %d) invalid flock() operation',
					fd,
					op
				);
				return -ERRNO_CODES.EINVAL;
			}

			try {
				const nativeFilePath =
					locking.get_native_path_from_vfs_path(vfsPath);
				const obtainedLock = await Promise.resolve(
					PHPLoader.fileLockManager.lockWholeFile(nativeFilePath, {
						type: lockOpType,
						pid: PHPLoader.processId,
						fd,
					})
				);
				_js_wasm_trace(
					'js_flock(%d, %d) lockWholeFile %s returned %d',
					fd,
					op,
					vfsPath,
					obtainedLock
				);
				if (obtainedLock) {
					locking.maybeLockedFds.add(fd);
					return 0;
				} else {
					return -ERRNO_CODES.EWOULDBLOCK;
				}
			} catch (e) {
				_js_wasm_trace(
					'js_flock(%d, %d) lockWholeFile error %s',
					fd,
					op,
					e
				);
				return -ERRNO_CODES.EINVAL;
			}
		});
	};

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

			const ProcInfo = {
				pid: cp.pid,
				exited: false,
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
				const stdoutStream = SYSCALLS.getStreamFromFD(stdoutChildFd);
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
				const stderrStream = SYSCALLS.getStreamFromFD(stderrChildFd);
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
				}
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

	var _js_release_file_locks = function js_release_file_locks() {
		return Asyncify.handleAsync(async () => {
			_js_wasm_trace('js_release_file_locks()');
			const pid = PHPLoader.processId;
			if (!pid || !PHPLoader.fileLockManager) {
				_js_wasm_trace(
					'js_release_file_locks no pid or file lock manager'
				);
				return 0;
			}

			try {
				await Promise.resolve(
					PHPLoader.fileLockManager.releaseLocksForProcess(pid)
				);
				_js_wasm_trace('js_release_file_locks succeeded');
			} catch (e) {
				_js_wasm_trace('js_release_file_locks error %s', e);
			}
		});
	};

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
		for (var i = 0; i <= index; sum += array[i++]) {
			// no-op
		}
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
				// we spill over to next month
				days -= daysInCurrentMonth - newDate.getDate() + 1;
				newDate.setDate(1);
				if (currentMonth < 11) {
					newDate.setMonth(currentMonth + 1);
				} else {
					newDate.setMonth(0);
					newDate.setFullYear(newDate.getFullYear() + 1);
				}
			} else {
				// we stay in current month
				newDate.setDate(newDate.getDate() + days);
				return newDate;
			}
		}

		return newDate;
	};

	var _strptime = (buf, format, tm) => {
		// char *strptime(const char *restrict buf, const char *restrict format, struct tm *restrict tm);
		// http://pubs.opengroup.org/onlinepubs/009695399/functions/strptime.html
		var pattern = UTF8ToString(format);

		// escape special characters
		// TODO: not sure we really need to escape all of these in JS regexps
		var SPECIAL_CHARS = '\\!@#$^&*()+=-[]/{}|:<>?,.';
		for (var i = 0, ii = SPECIAL_CHARS.length; i < ii; ++i) {
			pattern = pattern.replace(
				new RegExp('\\' + SPECIAL_CHARS[i], 'g'),
				'\\' + SPECIAL_CHARS[i]
			);
		}

		// reduce number of matchers
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
		// TODO: take care of locale

		var DATE_PATTERNS = {
			/* weekday name */ a: '(?:Sun(?:day)?)|(?:Mon(?:day)?)|(?:Tue(?:sday)?)|(?:Wed(?:nesday)?)|(?:Thu(?:rsday)?)|(?:Fri(?:day)?)|(?:Sat(?:urday)?)',
			/* month name */ b: '(?:Jan(?:uary)?)|(?:Feb(?:ruary)?)|(?:Mar(?:ch)?)|(?:Apr(?:il)?)|May|(?:Jun(?:e)?)|(?:Jul(?:y)?)|(?:Aug(?:ust)?)|(?:Sep(?:tember)?)|(?:Oct(?:ober)?)|(?:Nov(?:ember)?)|(?:Dec(?:ember)?)',
			/* century */ C: '\\d\\d',
			/* day of month */ d: '0[1-9]|[1-9](?!\\d)|1\\d|2\\d|30|31',
			/* hour (24hr) */ H: '\\d(?!\\d)|[0,1]\\d|20|21|22|23',
			/* hour (12hr) */ I: '\\d(?!\\d)|0\\d|10|11|12',
			/* day of year */ j: '00[1-9]|0?[1-9](?!\\d)|0?[1-9]\\d(?!\\d)|[1,2]\\d\\d|3[0-6]\\d',
			/* month */ m: '0[1-9]|[1-9](?!\\d)|10|11|12',
			/* minutes */ M: '0\\d|\\d(?!\\d)|[1-5]\\d',
			/* whitespace */ n: ' ',
			/* AM/PM */ p: 'AM|am|PM|pm|A\\.M\\.|a\\.m\\.|P\\.M\\.|p\\.m\\.',
			/* seconds */ S: '0\\d|\\d(?!\\d)|[1-5]\\d|60',
			/* week number */ U: '0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53',
			/* week number */ W: '0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53',
			/* weekday number */ w: '[0-6]',
			/* 2-digit year */ y: '\\d\\d',
			/* 4-digit year */ Y: '\\d\\d\\d\\d',
			/* whitespace */ t: ' ',
			/* time zone */ z: 'Z|(?:[\\+\\-]\\d\\d:?(?:\\d\\d)?)',
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
			.replace(
				// any number of space or tab characters match zero or more spaces
				/\s+/g,
				'\\s*'
			);

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
				// check if symbol appears in regexp
				if (pos >= 0) {
					// return matched value or null (falsy!) for non-matches
					return matches[pos + 1];
				}
				return;
			};

			// seconds
			if ((value = getMatch('S'))) {
				date.sec = Number(value);
			}

			// minutes
			if ((value = getMatch('M'))) {
				date.min = Number(value);
			}

			// hours
			if ((value = getMatch('H'))) {
				// 24h clock
				date.hour = Number(value);
			} else if ((value = getMatch('I'))) {
				// AM/PM clock
				var hour = Number(value);
				if ((value = getMatch('p'))) {
					hour += value.toUpperCase()[0] === 'P' ? 12 : 0;
				}
				date.hour = hour;
			}

			// year
			if ((value = getMatch('Y'))) {
				// parse from four-digit year
				date.year = Number(value);
			} else if ((value = getMatch('y'))) {
				// parse from two-digit year...
				var year = Number(value);
				if ((value = getMatch('C'))) {
					// ...and century
					year += Number(value) * 100;
				} else {
					// ...and rule-of-thumb
					year += year < 69 ? 2000 : 1900;
				}
				date.year = year;
			}

			// month
			if ((value = getMatch('m'))) {
				// parse from month number
				date.month = Number(value) - 1;
			} else if ((value = getMatch('b'))) {
				// parse from month name
				date.month =
					MONTH_NUMBERS[value.substring(0, 3).toUpperCase()] || 0;
				// TODO: derive month from day in year+year, week number+day of week+year
			}

			// day
			if ((value = getMatch('d'))) {
				// get day of month directly
				date.day = Number(value);
			} else if ((value = getMatch('j'))) {
				// get day of month from day of year ...
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
				// get day of month from weekday ...
				var weekDay = value.substring(0, 3).toUpperCase();
				if ((value = getMatch('U'))) {
					// ... and week number (Sunday being first day of week)
					// Week number of the year (Sunday as the first day of the week) as a decimal number [00,53].
					// All days in a new year preceding the first Sunday are considered to be in week 0.
					var weekDayNumber = DAY_NUMBERS_SUN_FIRST[weekDay];
					var weekNumber = Number(value);

					// January 1st
					var janFirst = new Date(date.year, 0, 1);
					var endDate;
					if (janFirst.getDay() === 0) {
						// Jan 1st is a Sunday, and, hence in the 1st CW
						endDate = addDays(
							janFirst,
							weekDayNumber + 7 * (weekNumber - 1)
						);
					} else {
						// Jan 1st is not a Sunday, and, hence still in the 0th CW
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
					// ... and week number (Monday being first day of week)
					// Week number of the year (Monday as the first day of the week) as a decimal number [00,53].
					// All days in a new year preceding the first Monday are considered to be in week 0.
					var weekDayNumber = DAY_NUMBERS_MON_FIRST[weekDay];
					var weekNumber = Number(value);

					// January 1st
					var janFirst = new Date(date.year, 0, 1);
					var endDate;
					if (janFirst.getDay() === 1) {
						// Jan 1st is a Monday, and, hence in the 1st CW
						endDate = addDays(
							janFirst,
							weekDayNumber + 7 * (weekNumber - 1)
						);
					} else {
						// Jan 1st is not a Monday, and, hence still in the 0th CW
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

			// time zone
			if ((value = getMatch('z'))) {
				// GMT offset as either 'Z' or +-HH:MM or +-HH or +-HHMM
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

			/*
        tm_sec  int seconds after the minute  0-61*
        tm_min  int minutes after the hour  0-59
        tm_hour int hours since midnight  0-23
        tm_mday int day of the month  1-31
        tm_mon  int months since January  0-11
        tm_year int years since 1900
        tm_wday int days since Sunday 0-6
        tm_yday int days since January 1  0-365
        tm_isdst  int Daylight Saving Time flag
        tm_gmtoff long offset from GMT (seconds)
        */

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

			// we need to convert the matched sequence into an integer array to take care of UTF-8 characters > 0x7F
			// TODO: not sure that intArrayFromString handles all unicode characters correctly
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
	}

	function _wasm_shutdown(socketd, how) {
		return PHPWASM.shutdownSocket(socketd, how);
	}

	var runAndAbortIfError = (func) => {
		try {
			return func();
		} catch (e) {
			abort(e);
		}
	};

	var Asyncify = {
		instrumentWasmImports(imports) {
			var importPattern =
				/^(js_open_process|js_fd_read|js_waitpid|js_process_status|js_create_input_device|wasm_setsockopt|wasm_shutdown|wasm_close|wasm_recv|__syscall_fcntl64|js_flock|js_release_file_locks|js_waitpid|invoke_.*|__asyncjs__.*)$/;

			for (let [x, original] of Object.entries(imports)) {
				if (typeof original == 'function') {
					let isAsyncifyImport =
						original.isAsync || importPattern.test(x);
					// Wrap async imports with a suspending WebAssembly function.
					if (isAsyncifyImport) {
						imports[x] = original = new WebAssembly.Suspending(
							original
						);
					}
				}
			}
		},
		instrumentFunction(original) {
			var wrapper = (...args) => {
				return original(...args);
			};
			wrapper.orig = original;
			return wrapper;
		},
		instrumentWasmExports(exports) {
			var exportPattern =
				/^(php_wasm_init|wasm_sleep|wasm_read|emscripten_sleep|wasm_sapi_handle_request|wasm_sapi_request_shutdown|wasm_poll_socket|wrap_select|__wrap_select|select|php_pollfd_for|fflush|wasm_popen|wasm_read|wasm_php_exec|run_cli|wasm_recv|__wasm_call_ctors|__errno_location|__funcs_on_exit|main|__main_argc_argv)$/;
			Asyncify.asyncExports = new Set();
			var ret = {};
			for (let [x, original] of Object.entries(exports)) {
				if (typeof original == 'function') {
					// Wrap all exports with a promising WebAssembly function.
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
		var func = Module['_' + ident]; // closure exported function
		return func;
	};

	var writeArrayToMemory = (array, buffer) => {
		HEAP8.set(array, buffer);
	};

	/**
	 * @param {string|null=} returnType
	 * @param {Array=} argTypes
	 * @param {Array=} args
	 * @param {Object=} opts
	 */
	var ccall = (ident, returnType, argTypes, args, opts) => {
		// For fast lookup of conversion functions
		var toC = {
			string: (str) => {
				var ret = 0;
				if (str !== null && str !== undefined && str !== 0) {
					// null string
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

	var writeI53ToI64Clamped = (ptr, num) => {
		if (num > 0x7fffffffffffffff) {
			HEAPU32[ptr >> 2] = 4294967295;
			HEAPU32[(ptr + 4) >> 2] = 2147483647;
		} else if (num < -0x8000000000000000) {
			HEAPU32[ptr >> 2] = 0;
			HEAPU32[(ptr + 4) >> 2] = 2147483648;
		} else {
			writeI53ToI64(ptr, num);
		}
	};

	var writeI53ToI64Signaling = (ptr, num) => {
		if (num > 0x7fffffffffffffff || num < -0x8000000000000000) {
			throw `RangeError: ${num}`;
		}
		writeI53ToI64(ptr, num);
	};

	var writeI53ToU64Clamped = (ptr, num) => {
		if (num > 0xffffffffffffffff) {
			HEAPU32[ptr >> 2] = 4294967295;
			HEAPU32[(ptr + 4) >> 2] = 4294967295;
		} else if (num < 0) {
			HEAPU32[ptr >> 2] = 0;
			HEAPU32[(ptr + 4) >> 2] = 0;
		} else {
			writeI53ToI64(ptr, num);
		}
	};

	var writeI53ToU64Signaling = (ptr, num) => {
		if (num < 0 || num > 0xffffffffffffffff) {
			throw `RangeError: ${num}`;
		}
		writeI53ToI64(ptr, num);
	};

	var readI53FromU64 = (ptr) => {
		return HEAPU32[ptr >> 2] + HEAPU32[(ptr + 4) >> 2] * 4294967296;
	};

	var convertI32PairToI53 = (lo, hi) => {
		return (lo >>> 0) + hi * 4294967296;
	};

	var convertI32PairToI53Checked = (lo, hi) => {
		return (hi + 0x200000) >>> 0 < 0x400001 - !!lo
			? (lo >>> 0) + hi * 4294967296
			: NaN;
	};

	var convertU32PairToI53 = (lo, hi) => {
		return (lo >>> 0) + (hi >>> 0) * 4294967296;
	};

	var getTempRet0 = (val) => __emscripten_tempret_get();

	var setTempRet0 = (val) => __emscripten_tempret_set(val);

	var _stackAlloc = stackAlloc;

	var _stackSave = stackSave;

	var _stackRestore = stackSave;

	var _setTempRet0 = setTempRet0;

	var _getTempRet0 = getTempRet0;

	var ptrToString = (ptr) => {
		// Convert to 32-bit unsigned value
		ptr >>>= 0;
		return '0x' + ptr.toString(16).padStart(8, '0');
	};

	var _emscripten_notify_memory_growth = (memoryIndex) => {
		updateMemoryViews();
	};
	_emscripten_notify_memory_growth.sig = 'vp';

	var strError = (errno) => UTF8ToString(_strerror(errno));

	var _endprotoent = () => {
		// void endprotoent(void);
		// We're not using a real protocol database so we don't do a real close.
	};
	_endprotoent.sig = 'v';

	var _getprotoent = (number) => {
		// struct protoent *getprotoent(void);
		// reads the  next  entry  from  the  protocols 'database' or return NULL if 'eof'
		if (_setprotoent.index === Protocols.list.length) {
			return 0;
		}
		var result = Protocols.list[_setprotoent.index++];
		return result;
	};
	_getprotoent.sig = 'p';

	var Sockets = {
		BUFFER_SIZE: 10240,
		MAX_BUFFER_SIZE: 10485760,
		nextFd: 1,
		fds: {},
		nextport: 1,
		maxport: 65535,
		peer: null,
		connections: {},
		portmap: {},
		localAddr: 4261412874,
		addrPool: [
			33554442, 50331658, 67108874, 83886090, 100663306, 117440522,
			134217738, 150994954, 167772170, 184549386, 201326602, 218103818,
			234881034,
		],
	};

	var _emscripten_run_script = (ptr) => {
		eval(UTF8ToString(ptr));
	};
	_emscripten_run_script.sig = 'vp';

	/** @suppress{checkTypes} */
	var _emscripten_run_script_int = (ptr) => {
		return eval(UTF8ToString(ptr)) | 0;
	};
	_emscripten_run_script_int.sig = 'ip';

	var _emscripten_run_script_string = (ptr) => {
		var s = eval(UTF8ToString(ptr));
		if (s == null) {
			return 0;
		}
		s += '';
		var me = _emscripten_run_script_string;
		me.bufferSize = lengthBytesUTF8(s) + 1;
		me.buffer = _realloc(me.buffer ?? 0, me.bufferSize);
		stringToUTF8(s, me.buffer, me.bufferSize);
		return me.buffer;
	};
	_emscripten_run_script_string.sig = 'pp';

	var _emscripten_random = () => Math.random();
	_emscripten_random.sig = 'f';

	var _emscripten_performance_now = () => performance.now();
	_emscripten_performance_now.sig = 'd';

	var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;
	__emscripten_get_now_is_monotonic.sig = 'i';

	var warnOnce = (text) => {
		warnOnce.shown ||= {};
		if (!warnOnce.shown[text]) {
			warnOnce.shown[text] = 1;
			if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
			err(text);
		}
	};

	var _emscripten_get_compiler_setting = (name) =>
		abort(
			'You must build with -sRETAIN_COMPILER_SETTINGS for getCompilerSetting or emscripten_get_compiler_setting to work'
		);
	_emscripten_get_compiler_setting.sig = 'pp';

	var _emscripten_has_asyncify = () => 2;
	_emscripten_has_asyncify.sig = 'i';

	var _emscripten_debugger = () => {
		debugger;
	};
	_emscripten_debugger.sig = 'v';

	var _emscripten_print_double = (x, to, max) => {
		var str = x + '';
		if (to) return stringToUTF8(str, to, max);
		else return lengthBytesUTF8(str);
	};
	_emscripten_print_double.sig = 'idpi';

	var _emscripten_asm_const_double = (code, sigPtr, argbuf) => {
		return runEmAsmFunction(code, sigPtr, argbuf);
	};
	_emscripten_asm_const_double.sig = 'dppp';

	var _emscripten_asm_const_ptr = (code, sigPtr, argbuf) => {
		return runEmAsmFunction(code, sigPtr, argbuf);
	};
	_emscripten_asm_const_ptr.sig = 'pppp';

	var runMainThreadEmAsm = (emAsmAddr, sigPtr, argbuf, sync) => {
		var args = readEmAsmArgs(sigPtr, argbuf);
		return ASM_CONSTS[emAsmAddr](...args);
	};

	var _emscripten_asm_const_int_sync_on_main_thread = (
		emAsmAddr,
		sigPtr,
		argbuf
	) => runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1);
	_emscripten_asm_const_int_sync_on_main_thread.sig = 'ippp';

	var _emscripten_asm_const_ptr_sync_on_main_thread = (
		emAsmAddr,
		sigPtr,
		argbuf
	) => runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1);
	_emscripten_asm_const_ptr_sync_on_main_thread.sig = 'pppp';

	var _emscripten_asm_const_double_sync_on_main_thread =
		_emscripten_asm_const_int_sync_on_main_thread;
	_emscripten_asm_const_double_sync_on_main_thread.sig = 'dppp';

	var _emscripten_asm_const_async_on_main_thread = (
		emAsmAddr,
		sigPtr,
		argbuf
	) => runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 0);
	_emscripten_asm_const_async_on_main_thread.sig = 'vppp';

	var __Unwind_Backtrace = (func, arg) => {
		var trace = getCallstack();
		var parts = trace.split('\n');
		for (var i = 0; i < parts.length; i++) {
			var ret = getWasmTableEntry(func)(0, arg);
			if (ret !== 0) return;
		}
	};
	__Unwind_Backtrace.sig = 'ipp';

	var __Unwind_GetIPInfo = (context, ipBefore) => abort('Unwind_GetIPInfo');
	__Unwind_GetIPInfo.sig = 'ppp';

	var __Unwind_FindEnclosingFunction = (ip) => 0;
	__Unwind_FindEnclosingFunction.sig = 'pp';

	var __Unwind_RaiseException = (ex) => {
		err('Warning: _Unwind_RaiseException is not correctly implemented');
		return ___cxa_throw(ex, 0, 0);
	};
	__Unwind_RaiseException.sig = 'ip';

	var __Unwind_DeleteException = (ex) => err('TODO: Unwind_DeleteException');
	__Unwind_DeleteException.sig = 'vp';

	var dynCall = (sig, ptr, args = [], promising = false) => {
		var func = getWasmTableEntry(ptr);
		var rtn = func(...args);

		function convert(rtn) {
			return rtn;
		}

		return convert(rtn);
	};
	var getDynCaller = (sig, ptr, promising = false) => {
		return (...args) => dynCall(sig, ptr, args, promising);
	};

	var _emscripten_exit_with_live_runtime = () => {
		runtimeKeepalivePush();
		throw 'unwind';
	};
	_emscripten_exit_with_live_runtime.sig = 'v';

	var _emscripten_force_exit = (status) => {
		__emscripten_runtime_keepalive_clear();
		_exit(status);
	};
	_emscripten_force_exit.sig = 'vi';

	var _emscripten_outn = (str, len) => out(UTF8ToString(str, len));
	_emscripten_outn.sig = 'vpp';

	var _emscripten_errn = (str, len) => err(UTF8ToString(str, len));
	_emscripten_errn.sig = 'vpp';

	var _emscripten_throw_number = (number) => {
		throw number;
	};
	_emscripten_throw_number.sig = 'vd';

	var _emscripten_throw_string = (str) => {
		throw UTF8ToString(str);
	};
	_emscripten_throw_string.sig = 'vp';

	var _emscripten_runtime_keepalive_push = runtimeKeepalivePush;
	_emscripten_runtime_keepalive_push.sig = 'v';

	var _emscripten_runtime_keepalive_pop = runtimeKeepalivePop;
	_emscripten_runtime_keepalive_pop.sig = 'v';

	var _emscripten_runtime_keepalive_check = keepRuntimeAlive;
	_emscripten_runtime_keepalive_check.sig = 'i';

	var asmjsMangle = (x) => {
		if (x == '__main_argc_argv') {
			x = 'main';
		}
		return '_' + x;
	};

	var __emscripten_fs_load_embedded_files = (ptr) => {
		do {
			var name_addr = HEAPU32[ptr >> 2];
			ptr += 4;
			var len = HEAPU32[ptr >> 2];
			ptr += 4;
			var content = HEAPU32[ptr >> 2];
			ptr += 4;
			var name = UTF8ToString(name_addr);
			FS.createPath('/', PATH.dirname(name), true, true);
			// canOwn this data in the filesystem, it is a slice of wasm memory that will never change
			FS.createDataFile(
				name,
				null,
				HEAP8.subarray(content, content + len),
				true,
				true,
				true
			);
		} while (HEAPU32[ptr >> 2]);
	};
	__emscripten_fs_load_embedded_files.sig = 'vp';

	var onInits = [];

	var addOnInit = (cb) => onInits.push(cb);

	var onMains = [];

	var addOnPreMain = (cb) => onMains.push(cb);

	var onExits = [];

	var addOnExit = (cb) => onExits.push(cb);

	var STACK_SIZE = 1048576;

	var STACK_ALIGN = 16;

	var POINTER_SIZE = 4;

	var ASSERTIONS = 0;

	/**
	 * @param {string=} returnType
	 * @param {Array=} argTypes
	 * @param {Object=} opts
	 */
	var cwrap = (ident, returnType, argTypes, opts) => {
		// When the function takes numbers and returns a number, we can just return
		// the original function
		var numericArgs =
			!argTypes ||
			argTypes.every((type) => type === 'number' || type === 'boolean');
		var numericRet = returnType !== 'string';
		if (numericRet && numericArgs && !opts) {
			return getCFunc(ident);
		}
		return (...args) => ccall(ident, returnType, argTypes, args, opts);
	};

	var removeFunction = (index) => {
		functionsInTableMap.delete(getWasmTableEntry(index));
		setWasmTableEntry(index, null);
		freeTableIndexes.push(index);
	};

	var _emscripten_math_cbrt = Math.cbrt;
	_emscripten_math_cbrt.sig = 'dd';

	var _emscripten_math_pow = Math.pow;
	_emscripten_math_pow.sig = 'ddd';

	var _emscripten_math_random = Math.random;
	_emscripten_math_random.sig = 'd';

	var _emscripten_math_sign = Math.sign;
	_emscripten_math_sign.sig = 'dd';

	var _emscripten_math_sqrt = Math.sqrt;
	_emscripten_math_sqrt.sig = 'dd';

	var _emscripten_math_exp = Math.exp;
	_emscripten_math_exp.sig = 'dd';

	var _emscripten_math_expm1 = Math.expm1;
	_emscripten_math_expm1.sig = 'dd';

	var _emscripten_math_fmod = (x, y) => x % y;
	_emscripten_math_fmod.sig = 'ddd';

	var _emscripten_math_log = Math.log;
	_emscripten_math_log.sig = 'dd';

	var _emscripten_math_log1p = Math.log1p;
	_emscripten_math_log1p.sig = 'dd';

	var _emscripten_math_log10 = Math.log10;
	_emscripten_math_log10.sig = 'dd';

	var _emscripten_math_log2 = Math.log2;
	_emscripten_math_log2.sig = 'dd';

	var _emscripten_math_round = Math.round;
	_emscripten_math_round.sig = 'dd';

	var _emscripten_math_acos = Math.acos;
	_emscripten_math_acos.sig = 'dd';

	var _emscripten_math_acosh = Math.acosh;
	_emscripten_math_acosh.sig = 'dd';

	var _emscripten_math_asin = Math.asin;
	_emscripten_math_asin.sig = 'dd';

	var _emscripten_math_asinh = Math.asinh;
	_emscripten_math_asinh.sig = 'dd';

	var _emscripten_math_atan = Math.atan;
	_emscripten_math_atan.sig = 'dd';

	var _emscripten_math_atanh = Math.atanh;
	_emscripten_math_atanh.sig = 'dd';

	var _emscripten_math_atan2 = Math.atan2;
	_emscripten_math_atan2.sig = 'ddd';

	var _emscripten_math_cos = Math.cos;
	_emscripten_math_cos.sig = 'dd';

	var _emscripten_math_cosh = Math.cosh;
	_emscripten_math_cosh.sig = 'dd';

	var _emscripten_math_hypot = (count, varargs) => {
		var args = [];
		for (var i = 0; i < count; ++i) {
			args.push(HEAPF64[(varargs + i * 8) >> 3]);
		}
		return Math.hypot(...args);
	};
	_emscripten_math_hypot.sig = 'dip';

	var _emscripten_math_sin = Math.sin;
	_emscripten_math_sin.sig = 'dd';

	var _emscripten_math_sinh = Math.sinh;
	_emscripten_math_sinh.sig = 'dd';

	var _emscripten_math_tan = Math.tan;
	_emscripten_math_tan.sig = 'dd';

	var _emscripten_math_tanh = Math.tanh;
	_emscripten_math_tanh.sig = 'dd';

	var intArrayToString = (array) => {
		var ret = [];
		for (var i = 0; i < array.length; i++) {
			var chr = array[i];
			if (chr > 0xff) {
				chr &= 0xff;
			}
			ret.push(String.fromCharCode(chr));
		}
		return ret.join('');
	};

	var AsciiToString = (ptr) => {
		var str = '';
		while (1) {
			var ch = HEAPU8[ptr++];
			if (!ch) return str;
			str += String.fromCharCode(ch);
		}
	};

	var UTF16Decoder = globalThis.TextDecoder
		? new TextDecoder('utf-16le')
		: undefined;

	var UTF16ToString = (ptr, maxBytesToRead, ignoreNul) => {
		var idx = ptr >> 1;
		var endIdx = findStringEnd(HEAPU16, idx, maxBytesToRead / 2, ignoreNul);

		// When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
		if (endIdx - idx > 16 && UTF16Decoder)
			return UTF16Decoder.decode(HEAPU16.subarray(idx, endIdx));

		// Fallback: decode without UTF16Decoder
		var str = '';

		// If maxBytesToRead is not passed explicitly, it will be undefined, and the
		// for-loop's condition will always evaluate to true. The loop is then
		// terminated on the first null char.
		for (var i = idx; i < endIdx; ++i) {
			var codeUnit = HEAPU16[i];
			// fromCharCode constructs a character from a UTF-16 code unit, so we can
			// pass the UTF16 string right through.
			str += String.fromCharCode(codeUnit);
		}

		return str;
	};

	var stringToUTF16 = (str, outPtr, maxBytesToWrite) => {
		// Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
		maxBytesToWrite ??= 0x7fffffff;
		if (maxBytesToWrite < 2) return 0;
		maxBytesToWrite -= 2; // Null terminator.
		var startPtr = outPtr;
		var numCharsToWrite =
			maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
		for (var i = 0; i < numCharsToWrite; ++i) {
			// charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
			var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
			HEAP16[outPtr >> 1] = codeUnit;
			outPtr += 2;
		}
		// Null-terminate the pointer to the HEAP.
		HEAP16[outPtr >> 1] = 0;
		return outPtr - startPtr;
	};

	var lengthBytesUTF16 = (str) => str.length * 2;

	var UTF32ToString = (ptr, maxBytesToRead, ignoreNul) => {
		var str = '';
		var startIdx = ptr >> 2;
		// If maxBytesToRead is not passed explicitly, it will be undefined, and this
		// will always evaluate to true. This saves on code size.
		for (var i = 0; !(i >= maxBytesToRead / 4); i++) {
			var utf32 = HEAPU32[startIdx + i];
			if (!utf32 && !ignoreNul) break;
			str += String.fromCodePoint(utf32);
		}
		return str;
	};

	var stringToUTF32 = (str, outPtr, maxBytesToWrite) => {
		// Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
		maxBytesToWrite ??= 0x7fffffff;
		if (maxBytesToWrite < 4) return 0;
		var startPtr = outPtr;
		var endPtr = startPtr + maxBytesToWrite - 4;
		for (var i = 0; i < str.length; ++i) {
			var codePoint = str.codePointAt(i);
			// Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
			// We need to manually skip over the second code unit for correct iteration.
			if (codePoint > 0xffff) {
				i++;
			}
			HEAP32[outPtr >> 2] = codePoint;
			outPtr += 4;
			if (outPtr + 4 > endPtr) break;
		}
		// Null-terminate the pointer to the HEAP.
		HEAP32[outPtr >> 2] = 0;
		return outPtr - startPtr;
	};

	var lengthBytesUTF32 = (str) => {
		var len = 0;
		for (var i = 0; i < str.length; ++i) {
			var codePoint = str.codePointAt(i);
			// Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
			// We need to manually skip over the second code unit for correct iteration.
			if (codePoint > 0xffff) {
				i++;
			}
			len += 4;
		}

		return len;
	};

	var JSEvents = {
		memcpy(target, src, size) {
			HEAP8.set(HEAP8.subarray(src, src + size), target);
		},
		removeAllEventListeners() {
			while (JSEvents.eventHandlers.length) {
				JSEvents._removeHandler(JSEvents.eventHandlers.length - 1);
			}
			JSEvents.deferredCalls = [];
		},
		registerRemoveEventListeners() {
			if (!JSEvents.removeEventListenersRegistered) {
				addOnExit(JSEvents.removeAllEventListeners);
				JSEvents.removeEventListenersRegistered = true;
			}
		},
		inEventHandler: 0,
		deferredCalls: [],
		deferCall(targetFunction, precedence, argsList) {
			function arraysHaveEqualContent(arrA, arrB) {
				if (arrA.length != arrB.length) return false;

				for (var i in arrA) {
					if (arrA[i] != arrB[i]) return false;
				}
				return true;
			}
			// Test if the given call was already queued, and if so, don't add it again.
			for (var call of JSEvents.deferredCalls) {
				if (
					call.targetFunction == targetFunction &&
					arraysHaveEqualContent(call.argsList, argsList)
				) {
					return;
				}
			}
			JSEvents.deferredCalls.push({
				targetFunction,
				precedence,
				argsList,
			});

			JSEvents.deferredCalls.sort((x, y) => x.precedence < y.precedence);
		},
		removeDeferredCalls(targetFunction) {
			JSEvents.deferredCalls = JSEvents.deferredCalls.filter(
				(call) => call.targetFunction != targetFunction
			);
		},
		canPerformEventHandlerRequests() {
			if (navigator.userActivation) {
				// Verify against transient activation status from UserActivation API
				// whether it is possible to perform a request here without needing to defer. See
				// https://developer.mozilla.org/en-US/docs/Web/Security/User_activation#transient_activation
				// and https://caniuse.com/mdn-api_useractivation
				// At the time of writing, Firefox does not support this API: https://bugzil.la/1791079
				return navigator.userActivation.isActive;
			}

			return (
				JSEvents.inEventHandler &&
				JSEvents.currentEventHandler.allowsDeferredCalls
			);
		},
		runDeferredCalls() {
			if (!JSEvents.canPerformEventHandlerRequests()) {
				return;
			}
			var deferredCalls = JSEvents.deferredCalls;
			JSEvents.deferredCalls = [];
			for (var call of deferredCalls) {
				call.targetFunction(...call.argsList);
			}
		},
		eventHandlers: [],
		removeAllHandlersOnTarget: (target, eventTypeString) => {
			for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
				if (
					JSEvents.eventHandlers[i].target == target &&
					(!eventTypeString ||
						eventTypeString ==
							JSEvents.eventHandlers[i].eventTypeString)
				) {
					JSEvents._removeHandler(i--);
				}
			}
		},
		_removeHandler(i) {
			var h = JSEvents.eventHandlers[i];
			h.target.removeEventListener(
				h.eventTypeString,
				h.eventListenerFunc,
				h.useCapture
			);
			JSEvents.eventHandlers.splice(i, 1);
		},
		registerOrRemoveHandler(eventHandler) {
			if (!eventHandler.target) {
				return -4;
			}
			if (eventHandler.callbackfunc) {
				eventHandler.eventListenerFunc = function (event) {
					// Increment nesting count for the event handler.
					++JSEvents.inEventHandler;
					JSEvents.currentEventHandler = eventHandler;
					// Process any old deferred calls the user has placed.
					JSEvents.runDeferredCalls();
					// Process the actual event, calls back to user C code handler.
					eventHandler.handlerFunc(event);
					// Process any new deferred calls that were placed right now from this event handler.
					JSEvents.runDeferredCalls();
					// Out of event handler - restore nesting count.
					--JSEvents.inEventHandler;
				};

				eventHandler.target.addEventListener(
					eventHandler.eventTypeString,
					eventHandler.eventListenerFunc,
					eventHandler.useCapture
				);
				JSEvents.eventHandlers.push(eventHandler);
				JSEvents.registerRemoveEventListeners();
			} else {
				for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
					if (
						JSEvents.eventHandlers[i].target ==
							eventHandler.target &&
						JSEvents.eventHandlers[i].eventTypeString ==
							eventHandler.eventTypeString
					) {
						JSEvents._removeHandler(i--);
					}
				}
			}
			return 0;
		},
		getNodeNameForTarget(target) {
			if (!target) return '';
			if (target == window) return '#window';
			if (target == screen) return '#screen';
			return target?.nodeName || '';
		},
		fullscreenEnabled() {
			return document.fullscreenEnabled;
		},
	};

	function getFullscreenElement() {
		return (
			document.fullscreenElement ||
			document.mozFullScreenElement ||
			document.webkitFullscreenElement ||
			document.webkitCurrentFullScreenElement ||
			document.msFullscreenElement
		);
	}

	var registerKeyEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.keyEvent ||= _malloc(160);

		var keyEventHandlerFunc = (e) => {
			var keyEventData = JSEvents.keyEvent;
			HEAPF64[keyEventData >> 3] = e.timeStamp;

			var idx = keyEventData >> 2;

			HEAP32[idx + 2] = e.location;
			HEAP8[keyEventData + 12] = e.ctrlKey;
			HEAP8[keyEventData + 13] = e.shiftKey;
			HEAP8[keyEventData + 14] = e.altKey;
			HEAP8[keyEventData + 15] = e.metaKey;
			HEAP8[keyEventData + 16] = e.repeat;
			HEAP32[idx + 5] = e.charCode;
			HEAP32[idx + 6] = e.keyCode;
			HEAP32[idx + 7] = e.which;
			stringToUTF8(e.key || '', keyEventData + 32, 32);
			stringToUTF8(e.code || '', keyEventData + 64, 32);
			stringToUTF8(e.char || '', keyEventData + 96, 32);
			stringToUTF8(e.locale || '', keyEventData + 128, 32);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					keyEventData,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target: findEventTarget(target),
			eventTypeString,
			callbackfunc,
			handlerFunc: keyEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_keypress_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerKeyEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			1,
			'keypress',
			targetThread
		);
	_emscripten_set_keypress_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_keydown_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerKeyEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			2,
			'keydown',
			targetThread
		);
	_emscripten_set_keydown_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_keyup_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerKeyEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			3,
			'keyup',
			targetThread
		);
	_emscripten_set_keyup_callback_on_thread.sig = 'ippipp';

	var getBoundingClientRect = (e) =>
		specialHTMLTargets.indexOf(e) < 0
			? e.getBoundingClientRect()
			: { left: 0, top: 0 };

	var fillMouseEventData = (eventStruct, e, target) => {
		HEAPF64[eventStruct >> 3] = e.timeStamp;
		var idx = eventStruct >> 2;
		HEAP32[idx + 2] = e.screenX;
		HEAP32[idx + 3] = e.screenY;
		HEAP32[idx + 4] = e.clientX;
		HEAP32[idx + 5] = e.clientY;
		HEAP8[eventStruct + 24] = e.ctrlKey;
		HEAP8[eventStruct + 25] = e.shiftKey;
		HEAP8[eventStruct + 26] = e.altKey;
		HEAP8[eventStruct + 27] = e.metaKey;
		HEAP16[idx * 2 + 14] = e.button;
		HEAP16[idx * 2 + 15] = e.buttons;

		HEAP32[idx + 8] = e['movementX'];

		HEAP32[idx + 9] = e['movementY'];

		// Note: rect contains doubles (truncated to placate SAFE_HEAP, which is the same behaviour when writing to HEAP32 anyway)
		var rect = getBoundingClientRect(target);
		HEAP32[idx + 10] = e.clientX - (rect.left | 0);
		HEAP32[idx + 11] = e.clientY - (rect.top | 0);
	};

	var registerMouseEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.mouseEvent ||= _malloc(64);
		target = findEventTarget(target);

		var mouseEventHandlerFunc = (e = event) => {
			// TODO: Make this access thread safe, or this could update live while app is reading it.
			fillMouseEventData(JSEvents.mouseEvent, e, target);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					JSEvents.mouseEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target,
			allowsDeferredCalls:
				eventTypeString != 'mousemove' &&
				eventTypeString != 'mouseenter' &&
				eventTypeString != 'mouseleave', // Mouse move events do not allow fullscreen/pointer lock requests to be handled in them!
			eventTypeString,
			callbackfunc,
			handlerFunc: mouseEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_click_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			4,
			'click',
			targetThread
		);
	_emscripten_set_click_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_mousedown_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			5,
			'mousedown',
			targetThread
		);
	_emscripten_set_mousedown_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_mouseup_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			6,
			'mouseup',
			targetThread
		);
	_emscripten_set_mouseup_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_dblclick_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			7,
			'dblclick',
			targetThread
		);
	_emscripten_set_dblclick_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_mousemove_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			8,
			'mousemove',
			targetThread
		);
	_emscripten_set_mousemove_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_mouseenter_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			33,
			'mouseenter',
			targetThread
		);
	_emscripten_set_mouseenter_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_mouseleave_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			34,
			'mouseleave',
			targetThread
		);
	_emscripten_set_mouseleave_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_mouseover_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			35,
			'mouseover',
			targetThread
		);
	_emscripten_set_mouseover_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_mouseout_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerMouseEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			36,
			'mouseout',
			targetThread
		);
	_emscripten_set_mouseout_callback_on_thread.sig = 'ippipp';

	var _emscripten_get_mouse_status = (mouseState) => {
		if (!JSEvents.mouseEvent) return -7;
		// HTML5 does not really have a polling API for mouse events, so implement one manually by
		// returning the data from the most recently received event. This requires that user has registered
		// at least some no-op function as an event handler to any of the mouse function.
		JSEvents.memcpy(mouseState, JSEvents.mouseEvent, 64);
		return 0;
	};
	_emscripten_get_mouse_status.sig = 'ip';

	var registerWheelEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.wheelEvent ||= _malloc(96);

		// The DOM Level 3 events spec event 'wheel'
		var wheelHandlerFunc = (e = event) => {
			var wheelEvent = JSEvents.wheelEvent;
			fillMouseEventData(wheelEvent, e, target);
			HEAPF64[(wheelEvent + 64) >> 3] = e['deltaX'];
			HEAPF64[(wheelEvent + 72) >> 3] = e['deltaY'];
			HEAPF64[(wheelEvent + 80) >> 3] = e['deltaZ'];
			HEAP32[(wheelEvent + 88) >> 2] = e['deltaMode'];
			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					wheelEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target,
			allowsDeferredCalls: true,
			eventTypeString,
			callbackfunc,
			handlerFunc: wheelHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_wheel_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		target = findEventTarget(target);
		if (!target) return -4;
		if (typeof target.onwheel != 'undefined') {
			return registerWheelEventCallback(
				target,
				userData,
				useCapture,
				callbackfunc,
				9,
				'wheel',
				targetThread
			);
		} else {
			return -1;
		}
	};
	_emscripten_set_wheel_callback_on_thread.sig = 'ippipp';

	var registerUiEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.uiEvent ||= _malloc(36);

		target = findEventTarget(target);

		var uiEventHandlerFunc = (e = event) => {
			if (e.target != target) {
				// Never take ui events such as scroll via a 'bubbled' route, but always from the direct element that
				// was targeted. Otherwise e.g. if app logs a message in response to a page scroll, the Emscripten log
				// message box could cause to scroll, generating a new (bubbled) scroll message, causing a new log print,
				// causing a new scroll, etc..
				return;
			}
			var b = document.body; // Take document.body to a variable, Closure compiler does not outline access to it on its own.
			if (!b) {
				// During a page unload 'body' can be null, with "Cannot read property 'clientWidth' of null" being thrown
				return;
			}
			var uiEvent = JSEvents.uiEvent;
			HEAP32[uiEvent >> 2] = 0; // always zero for resize and scroll
			HEAP32[(uiEvent + 4) >> 2] = b.clientWidth;
			HEAP32[(uiEvent + 8) >> 2] = b.clientHeight;
			HEAP32[(uiEvent + 12) >> 2] = innerWidth;
			HEAP32[(uiEvent + 16) >> 2] = innerHeight;
			HEAP32[(uiEvent + 20) >> 2] = outerWidth;
			HEAP32[(uiEvent + 24) >> 2] = outerHeight;
			HEAP32[(uiEvent + 28) >> 2] = pageXOffset | 0; // scroll offsets are float
			HEAP32[(uiEvent + 32) >> 2] = pageYOffset | 0;
			if (getWasmTableEntry(callbackfunc)(eventTypeId, uiEvent, userData))
				e.preventDefault();
		};

		var eventHandler = {
			target,
			eventTypeString,
			callbackfunc,
			handlerFunc: uiEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_resize_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerUiEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			10,
			'resize',
			targetThread
		);
	_emscripten_set_resize_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_scroll_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerUiEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			11,
			'scroll',
			targetThread
		);
	_emscripten_set_scroll_callback_on_thread.sig = 'ippipp';

	var registerFocusEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.focusEvent ||= _malloc(256);

		var focusEventHandlerFunc = (e = event) => {
			var nodeName = JSEvents.getNodeNameForTarget(e.target);
			var id = e.target.id ? e.target.id : '';

			var focusEvent = JSEvents.focusEvent;
			stringToUTF8(nodeName, focusEvent + 0, 128);
			stringToUTF8(id, focusEvent + 128, 128);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					focusEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target: findEventTarget(target),
			eventTypeString,
			callbackfunc,
			handlerFunc: focusEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_blur_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerFocusEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			12,
			'blur',
			targetThread
		);
	_emscripten_set_blur_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_focus_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerFocusEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			13,
			'focus',
			targetThread
		);
	_emscripten_set_focus_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_focusin_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerFocusEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			14,
			'focusin',
			targetThread
		);
	_emscripten_set_focusin_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_focusout_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerFocusEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			15,
			'focusout',
			targetThread
		);
	_emscripten_set_focusout_callback_on_thread.sig = 'ippipp';

	var fillDeviceOrientationEventData = (eventStruct, e, target) => {
		HEAPF64[eventStruct >> 3] = e.alpha;
		HEAPF64[(eventStruct + 8) >> 3] = e.beta;
		HEAPF64[(eventStruct + 16) >> 3] = e.gamma;
		HEAP8[eventStruct + 24] = e.absolute;
	};

	var registerDeviceOrientationEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.deviceOrientationEvent ||= _malloc(32);

		var deviceOrientationEventHandlerFunc = (e = event) => {
			fillDeviceOrientationEventData(
				JSEvents.deviceOrientationEvent,
				e,
				target
			); // TODO: Thread-safety with respect to emscripten_get_deviceorientation_status()

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					JSEvents.deviceOrientationEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target: findEventTarget(target),
			eventTypeString,
			callbackfunc,
			handlerFunc: deviceOrientationEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_deviceorientation_callback_on_thread = (
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		return registerDeviceOrientationEventCallback(
			2,
			userData,
			useCapture,
			callbackfunc,
			16,
			'deviceorientation',
			targetThread
		);
	};
	_emscripten_set_deviceorientation_callback_on_thread.sig = 'ipipp';

	var _emscripten_get_deviceorientation_status = (orientationState) => {
		if (!JSEvents.deviceOrientationEvent) return -7;
		// HTML5 does not really have a polling API for device orientation events, so implement one manually by
		// returning the data from the most recently received event. This requires that user has registered
		// at least some no-op function as an event handler.
		JSEvents.memcpy(orientationState, JSEvents.deviceOrientationEvent, 32);
		return 0;
	};
	_emscripten_get_deviceorientation_status.sig = 'ip';

	var fillDeviceMotionEventData = (eventStruct, e, target) => {
		var supportedFields = 0;
		var a = e['acceleration'];
		supportedFields |= a && 1;
		var ag = e['accelerationIncludingGravity'];
		supportedFields |= ag && 2;
		var rr = e['rotationRate'];
		supportedFields |= rr && 4;
		a = a || {};
		ag = ag || {};
		rr = rr || {};
		HEAP32[(eventStruct + 72) >> 2] = supportedFields;
		HEAPF64[eventStruct >> 3] = a['x'];
		HEAPF64[(eventStruct + 8) >> 3] = a['y'];
		HEAPF64[(eventStruct + 16) >> 3] = a['z'];
		HEAPF64[(eventStruct + 24) >> 3] = ag['x'];
		HEAPF64[(eventStruct + 32) >> 3] = ag['y'];
		HEAPF64[(eventStruct + 40) >> 3] = ag['z'];
		HEAPF64[(eventStruct + 48) >> 3] = rr['alpha'];
		HEAPF64[(eventStruct + 56) >> 3] = rr['beta'];
		HEAPF64[(eventStruct + 64) >> 3] = rr['gamma'];
	};

	var registerDeviceMotionEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.deviceMotionEvent ||= _malloc(80);

		var deviceMotionEventHandlerFunc = (e = event) => {
			fillDeviceMotionEventData(JSEvents.deviceMotionEvent, e, target); // TODO: Thread-safety with respect to emscripten_get_devicemotion_status()

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					JSEvents.deviceMotionEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target: findEventTarget(target),
			eventTypeString,
			callbackfunc,
			handlerFunc: deviceMotionEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_devicemotion_callback_on_thread = (
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerDeviceMotionEventCallback(
			2,
			userData,
			useCapture,
			callbackfunc,
			17,
			'devicemotion',
			targetThread
		);
	_emscripten_set_devicemotion_callback_on_thread.sig = 'ipipp';

	var _emscripten_get_devicemotion_status = (motionState) => {
		if (!JSEvents.deviceMotionEvent) return -7;
		// HTML5 does not really have a polling API for device motion events, so implement one manually by
		// returning the data from the most recently received event. This requires that user has registered
		// at least some no-op function as an event handler.
		JSEvents.memcpy(motionState, JSEvents.deviceMotionEvent, 80);
		return 0;
	};
	_emscripten_get_devicemotion_status.sig = 'ip';

	var screenOrientation = () => {
		if (!window.screen) return undefined;
		return (
			screen.orientation ||
			screen['mozOrientation'] ||
			screen['webkitOrientation']
		);
	};

	var fillOrientationChangeEventData = (eventStruct) => {
		// OrientationType enum
		var orientationsType1 = [
			'portrait-primary',
			'portrait-secondary',
			'landscape-primary',
			'landscape-secondary',
		];
		// alternative selection from OrientationLockType enum
		var orientationsType2 = [
			'portrait',
			'portrait',
			'landscape',
			'landscape',
		];

		var orientationIndex = 0;
		var orientationAngle = 0;
		var screenOrientObj = screenOrientation();
		if (typeof screenOrientObj === 'object') {
			orientationIndex = orientationsType1.indexOf(screenOrientObj.type);
			if (orientationIndex < 0) {
				orientationIndex = orientationsType2.indexOf(
					screenOrientObj.type
				);
			}
			if (orientationIndex >= 0) {
				orientationIndex = 1 << orientationIndex;
			}
			orientationAngle = screenOrientObj.angle;
		}

		HEAP32[eventStruct >> 2] = orientationIndex;
		HEAP32[(eventStruct + 4) >> 2] = orientationAngle;
	};

	var registerOrientationChangeEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.orientationChangeEvent ||= _malloc(8);

		var orientationChangeEventHandlerFunc = (e = event) => {
			var orientationChangeEvent = JSEvents.orientationChangeEvent;

			fillOrientationChangeEventData(orientationChangeEvent);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					orientationChangeEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target,
			eventTypeString,
			callbackfunc,
			handlerFunc: orientationChangeEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_orientationchange_callback_on_thread = (
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		if (!window.screen || !screen.orientation) return -1;
		return registerOrientationChangeEventCallback(
			screen.orientation,
			userData,
			useCapture,
			callbackfunc,
			18,
			'change',
			targetThread
		);
	};
	_emscripten_set_orientationchange_callback_on_thread.sig = 'ipipp';

	var _emscripten_get_orientation_status = (orientationChangeEvent) => {
		// screenOrientation() resolving standard, window.orientation being the deprecated mobile-only
		if (!screenOrientation() && typeof orientation == 'undefined')
			return -1;
		fillOrientationChangeEventData(orientationChangeEvent);
		return 0;
	};
	_emscripten_get_orientation_status.sig = 'ip';

	var _emscripten_lock_orientation = (allowedOrientations) => {
		var orientations = [];
		if (allowedOrientations & 1) orientations.push('portrait-primary');
		if (allowedOrientations & 2) orientations.push('portrait-secondary');
		if (allowedOrientations & 4) orientations.push('landscape-primary');
		if (allowedOrientations & 8) orientations.push('landscape-secondary');
		var succeeded;
		if (screen.lockOrientation) {
			succeeded = screen.lockOrientation(orientations);
		} else if (screen.mozLockOrientation) {
			succeeded = screen.mozLockOrientation(orientations);
		} else if (screen.webkitLockOrientation) {
			succeeded = screen.webkitLockOrientation(orientations);
		} else {
			return -1;
		}
		if (succeeded) {
			return 0;
		}
		return -6;
	};
	_emscripten_lock_orientation.sig = 'ii';

	var _emscripten_unlock_orientation = () => {
		if (screen.unlockOrientation) {
			screen.unlockOrientation();
		} else if (screen.mozUnlockOrientation) {
			screen.mozUnlockOrientation();
		} else if (screen.webkitUnlockOrientation) {
			screen.webkitUnlockOrientation();
		} else {
			return -1;
		}
		return 0;
	};
	_emscripten_unlock_orientation.sig = 'i';

	var fillFullscreenChangeEventData = (eventStruct) => {
		var fullscreenElement = getFullscreenElement();
		var isFullscreen = !!fullscreenElement;
		// Assigning a boolean to HEAP32 with expected type coercion.
		/** @suppress{checkTypes} */
		HEAP8[eventStruct] = isFullscreen;
		HEAP8[eventStruct + 1] = JSEvents.fullscreenEnabled();
		// If transitioning to fullscreen, report info about the element that is now fullscreen.
		// If transitioning to windowed mode, report info about the element that just was fullscreen.
		var reportedElement = isFullscreen
			? fullscreenElement
			: JSEvents.previousFullscreenElement;
		var nodeName = JSEvents.getNodeNameForTarget(reportedElement);
		var id = reportedElement?.id || '';
		stringToUTF8(nodeName, eventStruct + 2, 128);
		stringToUTF8(id, eventStruct + 130, 128);
		HEAP32[(eventStruct + 260) >> 2] = reportedElement
			? reportedElement.clientWidth
			: 0;
		HEAP32[(eventStruct + 264) >> 2] = reportedElement
			? reportedElement.clientHeight
			: 0;
		HEAP32[(eventStruct + 268) >> 2] = screen.width;
		HEAP32[(eventStruct + 272) >> 2] = screen.height;
		if (isFullscreen) {
			JSEvents.previousFullscreenElement = fullscreenElement;
		}
	};

	var registerFullscreenChangeEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.fullscreenChangeEvent ||= _malloc(276);

		var fullscreenChangeEventhandlerFunc = (e = event) => {
			var fullscreenChangeEvent = JSEvents.fullscreenChangeEvent;

			fillFullscreenChangeEventData(fullscreenChangeEvent);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					fullscreenChangeEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target,
			eventTypeString,
			callbackfunc,
			handlerFunc: fullscreenChangeEventhandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_fullscreenchange_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		if (!JSEvents.fullscreenEnabled()) return -1;
		target = findEventTarget(target);
		if (!target) return -4;

		return registerFullscreenChangeEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			19,
			'fullscreenchange',
			targetThread
		);
	};
	_emscripten_set_fullscreenchange_callback_on_thread.sig = 'ippipp';

	var _emscripten_get_fullscreen_status = (fullscreenStatus) => {
		if (!JSEvents.fullscreenEnabled()) return -1;
		fillFullscreenChangeEventData(fullscreenStatus);
		return 0;
	};
	_emscripten_get_fullscreen_status.sig = 'ip';

	var _emscripten_get_canvas_element_size = (target, width, height) => {
		var canvas = findCanvasEventTarget(target);
		if (!canvas) return -4;
		HEAP32[width >> 2] = canvas.width;
		HEAP32[height >> 2] = canvas.height;
	};
	_emscripten_get_canvas_element_size.sig = 'ippp';

	var getCanvasElementSize = (target) => {
		var sp = stackSave();
		var w = stackAlloc(8);
		var h = w + 4;

		var targetInt = stringToUTF8OnStack(target.id);
		var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
		var size = [HEAP32[w >> 2], HEAP32[h >> 2]];
		stackRestore(sp);
		return size;
	};

	var setCanvasElementSize = (target, width, height) => {
		if (!target.controlTransferredOffscreen) {
			target.width = width;
			target.height = height;
		} else {
			// This function is being called from high-level JavaScript code instead of asm.js/Wasm,
			// and it needs to synchronously proxy over to another thread, so marshal the string onto the heap to do the call.
			var sp = stackSave();
			var targetInt = stringToUTF8OnStack(target.id);
			_emscripten_set_canvas_element_size(targetInt, width, height);
			stackRestore(sp);
		}
	};

	var currentFullscreenStrategy = {};

	var registerRestoreOldStyle = (canvas) => {
		var canvasSize = getCanvasElementSize(canvas);
		var oldWidth = canvasSize[0];
		var oldHeight = canvasSize[1];
		var oldCssWidth = canvas.style.width;
		var oldCssHeight = canvas.style.height;
		var oldBackgroundColor = canvas.style.backgroundColor; // Chrome reads color from here.
		var oldDocumentBackgroundColor = document.body.style.backgroundColor; // IE11 reads color from here.
		// Firefox always has black background color.
		var oldPaddingLeft = canvas.style.paddingLeft; // Chrome, FF, Safari
		var oldPaddingRight = canvas.style.paddingRight;
		var oldPaddingTop = canvas.style.paddingTop;
		var oldPaddingBottom = canvas.style.paddingBottom;
		var oldMarginLeft = canvas.style.marginLeft; // IE11
		var oldMarginRight = canvas.style.marginRight;
		var oldMarginTop = canvas.style.marginTop;
		var oldMarginBottom = canvas.style.marginBottom;
		var oldDocumentBodyMargin = document.body.style.margin;
		var oldDocumentOverflow = document.documentElement.style.overflow; // Chrome, Firefox
		var oldDocumentScroll = document.body.scroll; // IE
		var oldImageRendering = canvas.style.imageRendering;

		function restoreOldStyle() {
			if (!getFullscreenElement()) {
				document.removeEventListener(
					'fullscreenchange',
					restoreOldStyle
				);

				setCanvasElementSize(canvas, oldWidth, oldHeight);

				canvas.style.width = oldCssWidth;
				canvas.style.height = oldCssHeight;
				canvas.style.backgroundColor = oldBackgroundColor; // Chrome
				// IE11 hack: assigning 'undefined' or an empty string to document.body.style.backgroundColor has no effect, so first assign back the default color
				// before setting the undefined value. Setting undefined value is also important, or otherwise we would later treat that as something that the user
				// had explicitly set so subsequent fullscreen transitions would not set background color properly.
				if (!oldDocumentBackgroundColor)
					document.body.style.backgroundColor = 'white';
				document.body.style.backgroundColor =
					oldDocumentBackgroundColor; // IE11
				canvas.style.paddingLeft = oldPaddingLeft; // Chrome, FF, Safari
				canvas.style.paddingRight = oldPaddingRight;
				canvas.style.paddingTop = oldPaddingTop;
				canvas.style.paddingBottom = oldPaddingBottom;
				canvas.style.marginLeft = oldMarginLeft; // IE11
				canvas.style.marginRight = oldMarginRight;
				canvas.style.marginTop = oldMarginTop;
				canvas.style.marginBottom = oldMarginBottom;
				document.body.style.margin = oldDocumentBodyMargin;
				document.documentElement.style.overflow = oldDocumentOverflow; // Chrome, Firefox
				document.body.scroll = oldDocumentScroll; // IE
				canvas.style.imageRendering = oldImageRendering;
				if (canvas.GLctxObject)
					canvas.GLctxObject.GLctx.viewport(
						0,
						0,
						oldWidth,
						oldHeight
					);

				if (currentFullscreenStrategy.canvasResizedCallback) {
					getWasmTableEntry(
						currentFullscreenStrategy.canvasResizedCallback
					)(
						37,
						0,
						currentFullscreenStrategy.canvasResizedCallbackUserData
					);
				}
			}
		}
		document.addEventListener('fullscreenchange', restoreOldStyle);
		return restoreOldStyle;
	};

	var setLetterbox = (element, topBottom, leftRight) => {
		// Cannot use margin to specify letterboxes in FF or Chrome, since those ignore margins in fullscreen mode.
		element.style.paddingLeft = element.style.paddingRight =
			leftRight + 'px';
		element.style.paddingTop = element.style.paddingBottom =
			topBottom + 'px';
	};

	var JSEvents_resizeCanvasForFullscreen = (target, strategy) => {
		var restoreOldStyle = registerRestoreOldStyle(target);
		var cssWidth = strategy.softFullscreen ? innerWidth : screen.width;
		var cssHeight = strategy.softFullscreen ? innerHeight : screen.height;
		var rect = getBoundingClientRect(target);
		var windowedCssWidth = rect.width;
		var windowedCssHeight = rect.height;
		var canvasSize = getCanvasElementSize(target);
		var windowedRttWidth = canvasSize[0];
		var windowedRttHeight = canvasSize[1];

		if (strategy.scaleMode == 3) {
			setLetterbox(
				target,
				(cssHeight - windowedCssHeight) / 2,
				(cssWidth - windowedCssWidth) / 2
			);
			cssWidth = windowedCssWidth;
			cssHeight = windowedCssHeight;
		} else if (strategy.scaleMode == 2) {
			if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
				var desiredCssHeight =
					(windowedRttHeight * cssWidth) / windowedRttWidth;
				setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
				cssHeight = desiredCssHeight;
			} else {
				var desiredCssWidth =
					(windowedRttWidth * cssHeight) / windowedRttHeight;
				setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
				cssWidth = desiredCssWidth;
			}
		}

		// If we are adding padding, must choose a background color or otherwise Chrome will give the
		// padding a default white color. Do it only if user has not customized their own background color.
		target.style.backgroundColor ||= 'black';
		// IE11 does the same, but requires the color to be set in the document body.
		document.body.style.backgroundColor ||= 'black'; // IE11
		// Firefox always shows black letterboxes independent of style color.

		target.style.width = cssWidth + 'px';
		target.style.height = cssHeight + 'px';

		if (strategy.filteringMode == 1) {
			target.style.imageRendering = 'optimizeSpeed';
			target.style.imageRendering = '-moz-crisp-edges';
			target.style.imageRendering = '-o-crisp-edges';
			target.style.imageRendering = '-webkit-optimize-contrast';
			target.style.imageRendering = 'optimize-contrast';
			target.style.imageRendering = 'crisp-edges';
			target.style.imageRendering = 'pixelated';
		}

		var dpiScale =
			strategy.canvasResolutionScaleMode == 2 ? devicePixelRatio : 1;
		if (strategy.canvasResolutionScaleMode != 0) {
			var newWidth = (cssWidth * dpiScale) | 0;
			var newHeight = (cssHeight * dpiScale) | 0;
			setCanvasElementSize(target, newWidth, newHeight);
			if (target.GLctxObject)
				target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight);
		}
		return restoreOldStyle;
	};

	var JSEvents_requestFullscreen = (target, strategy) => {
		// EMSCRIPTEN_FULLSCREEN_SCALE_DEFAULT + EMSCRIPTEN_FULLSCREEN_CANVAS_SCALE_NONE is a mode where no extra logic is performed to the DOM elements.
		if (
			strategy.scaleMode != 0 ||
			strategy.canvasResolutionScaleMode != 0
		) {
			JSEvents_resizeCanvasForFullscreen(target, strategy);
		}

		if (target.requestFullscreen) {
			target.requestFullscreen();
		} else {
			return JSEvents.fullscreenEnabled() ? -3 : -1;
		}

		currentFullscreenStrategy = strategy;

		if (strategy.canvasResizedCallback) {
			getWasmTableEntry(strategy.canvasResizedCallback)(
				37,
				0,
				strategy.canvasResizedCallbackUserData
			);
		}

		return 0;
	};

	var hideEverythingExceptGivenElement = (onlyVisibleElement) => {
		var child = onlyVisibleElement;
		var parent = child.parentNode;
		var hiddenElements = [];
		while (child != document.body) {
			var children = parent.children;
			for (var currChild of children) {
				if (currChild != child) {
					hiddenElements.push({
						node: currChild,
						displayState: currChild.style.display,
					});
					currChild.style.display = 'none';
				}
			}
			child = parent;
			parent = parent.parentNode;
		}
		return hiddenElements;
	};

	var restoreHiddenElements = (hiddenElements) => {
		for (var elem of hiddenElements) {
			elem.node.style.display = elem.displayState;
		}
	};

	var restoreOldWindowedStyle = null;

	var softFullscreenResizeWebGLRenderTarget = () => {
		var dpr = devicePixelRatio;
		var inHiDPIFullscreenMode =
			currentFullscreenStrategy.canvasResolutionScaleMode == 2;
		var inAspectRatioFixedFullscreenMode =
			currentFullscreenStrategy.scaleMode == 2;
		var inPixelPerfectFullscreenMode =
			currentFullscreenStrategy.canvasResolutionScaleMode != 0;
		var inCenteredWithoutScalingFullscreenMode =
			currentFullscreenStrategy.scaleMode == 3;
		var screenWidth = inHiDPIFullscreenMode
			? Math.round(innerWidth * dpr)
			: innerWidth;
		var screenHeight = inHiDPIFullscreenMode
			? Math.round(innerHeight * dpr)
			: innerHeight;
		var w = screenWidth;
		var h = screenHeight;
		var canvas = currentFullscreenStrategy.target;
		var canvasSize = getCanvasElementSize(canvas);
		var x = canvasSize[0];
		var y = canvasSize[1];
		var topMargin;

		if (inAspectRatioFixedFullscreenMode) {
			if (w * y < x * h) h = ((w * y) / x) | 0;
			else if (w * y > x * h) w = ((h * x) / y) | 0;
			topMargin = ((screenHeight - h) / 2) | 0;
		}

		if (inPixelPerfectFullscreenMode) {
			setCanvasElementSize(canvas, w, h);
			if (canvas.GLctxObject)
				canvas.GLctxObject.GLctx.viewport(0, 0, w, h);
		}

		// Back to CSS pixels.
		if (inHiDPIFullscreenMode) {
			topMargin /= dpr;
			w /= dpr;
			h /= dpr;
			// Round to nearest 4 digits of precision.
			w = Math.round(w * 1e4) / 1e4;
			h = Math.round(h * 1e4) / 1e4;
			topMargin = Math.round(topMargin * 1e4) / 1e4;
		}

		if (inCenteredWithoutScalingFullscreenMode) {
			var t = (innerHeight - jstoi_q(canvas.style.height)) / 2;
			var b = (innerWidth - jstoi_q(canvas.style.width)) / 2;
			setLetterbox(canvas, t, b);
		} else {
			canvas.style.width = w + 'px';
			canvas.style.height = h + 'px';
			var b = (innerWidth - w) / 2;
			setLetterbox(canvas, topMargin, b);
		}

		if (
			!inCenteredWithoutScalingFullscreenMode &&
			currentFullscreenStrategy.canvasResizedCallback
		) {
			getWasmTableEntry(currentFullscreenStrategy.canvasResizedCallback)(
				37,
				0,
				currentFullscreenStrategy.canvasResizedCallbackUserData
			);
		}
	};

	var doRequestFullscreen = (target, strategy) => {
		if (!JSEvents.fullscreenEnabled()) return -1;
		target = findEventTarget(target);
		if (!target) return -4;

		if (!target.requestFullscreen) {
			return -3;
		}

		// Queue this function call if we're not currently in an event handler and
		// the user saw it appropriate to do so.
		if (!JSEvents.canPerformEventHandlerRequests()) {
			if (strategy.deferUntilInEventHandler) {
				JSEvents.deferCall(
					JSEvents_requestFullscreen,
					1 /* priority over pointer lock */,
					[target, strategy]
				);
				return 1;
			}
			return -2;
		}

		return JSEvents_requestFullscreen(target, strategy);
	};

	var _emscripten_request_fullscreen = (target, deferUntilInEventHandler) => {
		var strategy = {
			// These options perform no added logic, but just bare request fullscreen.
			scaleMode: 0,
			canvasResolutionScaleMode: 0,
			filteringMode: 0,
			deferUntilInEventHandler,
			canvasResizedCallbackTargetThread: 2,
		};
		return doRequestFullscreen(target, strategy);
	};
	_emscripten_request_fullscreen.sig = 'ipi';

	var _emscripten_request_fullscreen_strategy = (
		target,
		deferUntilInEventHandler,
		fullscreenStrategy
	) => {
		var strategy = {
			scaleMode: HEAP32[fullscreenStrategy >> 2],
			canvasResolutionScaleMode: HEAP32[(fullscreenStrategy + 4) >> 2],
			filteringMode: HEAP32[(fullscreenStrategy + 8) >> 2],
			deferUntilInEventHandler,
			canvasResizedCallback: HEAP32[(fullscreenStrategy + 12) >> 2],
			canvasResizedCallbackUserData:
				HEAP32[(fullscreenStrategy + 16) >> 2],
		};

		return doRequestFullscreen(target, strategy);
	};
	_emscripten_request_fullscreen_strategy.sig = 'ipip';

	var _emscripten_enter_soft_fullscreen = (target, fullscreenStrategy) => {
		target = findEventTarget(target);
		if (!target) return -4;

		var strategy = {
			scaleMode: HEAP32[fullscreenStrategy >> 2],
			canvasResolutionScaleMode: HEAP32[(fullscreenStrategy + 4) >> 2],
			filteringMode: HEAP32[(fullscreenStrategy + 8) >> 2],
			canvasResizedCallback: HEAP32[(fullscreenStrategy + 12) >> 2],
			canvasResizedCallbackUserData:
				HEAP32[(fullscreenStrategy + 16) >> 2],
			target,
			softFullscreen: true,
		};

		var restoreOldStyle = JSEvents_resizeCanvasForFullscreen(
			target,
			strategy
		);

		document.documentElement.style.overflow = 'hidden'; // Firefox, Chrome
		document.body.scroll = 'no'; // IE11
		document.body.style.margin = '0px'; // Override default document margin area on all browsers.

		var hiddenElements = hideEverythingExceptGivenElement(target);

		function restoreWindowedState() {
			restoreOldStyle();
			restoreHiddenElements(hiddenElements);
			removeEventListener(
				'resize',
				softFullscreenResizeWebGLRenderTarget
			);
			if (strategy.canvasResizedCallback) {
				getWasmTableEntry(strategy.canvasResizedCallback)(
					37,
					0,
					strategy.canvasResizedCallbackUserData
				);
			}
			currentFullscreenStrategy = 0;
		}
		restoreOldWindowedStyle = restoreWindowedState;
		currentFullscreenStrategy = strategy;
		addEventListener('resize', softFullscreenResizeWebGLRenderTarget);

		// Inform the caller that the canvas size has changed.
		if (strategy.canvasResizedCallback) {
			getWasmTableEntry(strategy.canvasResizedCallback)(
				37,
				0,
				strategy.canvasResizedCallbackUserData
			);
		}

		return 0;
	};
	_emscripten_enter_soft_fullscreen.sig = 'ipp';

	var _emscripten_exit_soft_fullscreen = () => {
		restoreOldWindowedStyle?.();
		restoreOldWindowedStyle = null;

		return 0;
	};
	_emscripten_exit_soft_fullscreen.sig = 'i';

	var _emscripten_exit_fullscreen = () => {
		if (!JSEvents.fullscreenEnabled()) return -1;
		// Make sure no queued up calls will fire after this.
		JSEvents.removeDeferredCalls(JSEvents_requestFullscreen);

		var d = specialHTMLTargets[1];
		if (d.exitFullscreen) {
			d.fullscreenElement && d.exitFullscreen();
		} else {
			return -1;
		}

		return 0;
	};
	_emscripten_exit_fullscreen.sig = 'i';

	var fillPointerlockChangeEventData = (eventStruct) => {
		var pointerLockElement = document.pointerLockElement;
		var isPointerlocked = !!pointerLockElement;
		// Assigning a boolean to HEAP32 with expected type coercion.
		/** @suppress{checkTypes} */
		HEAP8[eventStruct] = isPointerlocked;
		var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
		var id = pointerLockElement?.id || '';
		stringToUTF8(nodeName, eventStruct + 1, 128);
		stringToUTF8(id, eventStruct + 129, 128);
	};

	var registerPointerlockChangeEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.pointerlockChangeEvent ||= _malloc(257);

		var pointerlockChangeEventHandlerFunc = (e = event) => {
			var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
			fillPointerlockChangeEventData(pointerlockChangeEvent);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					pointerlockChangeEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target,
			eventTypeString,
			callbackfunc,
			handlerFunc: pointerlockChangeEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_pointerlockchange_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		if (!document.body?.requestPointerLock) {
			return -1;
		}

		target = findEventTarget(target);
		if (!target) return -4;
		return registerPointerlockChangeEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			20,
			'pointerlockchange',
			targetThread
		);
	};
	_emscripten_set_pointerlockchange_callback_on_thread.sig = 'ippipp';

	var registerPointerlockErrorEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		var pointerlockErrorEventHandlerFunc = (e = event) => {
			if (getWasmTableEntry(callbackfunc)(eventTypeId, 0, userData))
				e.preventDefault();
		};

		var eventHandler = {
			target,
			eventTypeString,
			callbackfunc,
			handlerFunc: pointerlockErrorEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_pointerlockerror_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		if (!document.body?.requestPointerLock) {
			return -1;
		}

		target = findEventTarget(target);

		if (!target) return -4;
		return registerPointerlockErrorEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			38,
			'pointerlockerror',
			targetThread
		);
	};
	_emscripten_set_pointerlockerror_callback_on_thread.sig = 'ippipp';

	var _emscripten_get_pointerlock_status = (pointerlockStatus) => {
		if (pointerlockStatus)
			fillPointerlockChangeEventData(pointerlockStatus);
		if (!document.body?.requestPointerLock) {
			return -1;
		}
		return 0;
	};
	_emscripten_get_pointerlock_status.sig = 'ip';

	var requestPointerLock = (target) => {
		if (target.requestPointerLock) {
			target.requestPointerLock();
		} else {
			// document.body is known to accept pointer lock, so use that to differentiate if the user passed a bad element,
			// or if the whole browser just doesn't support the feature.
			if (document.body.requestPointerLock) {
				return -3;
			}
			return -1;
		}
		return 0;
	};

	var _emscripten_request_pointerlock = (
		target,
		deferUntilInEventHandler
	) => {
		target = findEventTarget(target);
		if (!target) return -4;
		if (!target.requestPointerLock) {
			return -1;
		}

		// Queue this function call if we're not currently in an event handler and
		// the user saw it appropriate to do so.
		if (!JSEvents.canPerformEventHandlerRequests()) {
			if (deferUntilInEventHandler) {
				JSEvents.deferCall(
					requestPointerLock,
					2 /* priority below fullscreen */,
					[target]
				);
				return 1;
			}
			return -2;
		}

		return requestPointerLock(target);
	};
	_emscripten_request_pointerlock.sig = 'ipi';

	var _emscripten_exit_pointerlock = () => {
		// Make sure no queued up calls will fire after this.
		JSEvents.removeDeferredCalls(requestPointerLock);
		if (!document.exitPointerLock) return -1;
		document.exitPointerLock();
		return 0;
	};
	_emscripten_exit_pointerlock.sig = 'i';

	var _emscripten_vibrate = (msecs) => {
		if (!navigator.vibrate) return -1;
		navigator.vibrate(msecs);
		return 0;
	};
	_emscripten_vibrate.sig = 'ii';

	var _emscripten_vibrate_pattern = (msecsArray, numEntries) => {
		if (!navigator.vibrate) return -1;

		var vibrateList = [];
		for (var i = 0; i < numEntries; ++i) {
			var msecs = HEAP32[(msecsArray + i * 4) >> 2];
			vibrateList.push(msecs);
		}
		navigator.vibrate(vibrateList);
		return 0;
	};
	_emscripten_vibrate_pattern.sig = 'ipi';

	var fillVisibilityChangeEventData = (eventStruct) => {
		var visibilityStates = ['hidden', 'visible', 'prerender', 'unloaded'];
		var visibilityState = visibilityStates.indexOf(
			document.visibilityState
		);

		// Assigning a boolean to HEAP32 with expected type coercion.
		/** @suppress{checkTypes} */
		HEAP8[eventStruct] = document.hidden;
		HEAP32[(eventStruct + 4) >> 2] = visibilityState;
	};

	var registerVisibilityChangeEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.visibilityChangeEvent ||= _malloc(8);

		var visibilityChangeEventHandlerFunc = (e = event) => {
			var visibilityChangeEvent = JSEvents.visibilityChangeEvent;

			fillVisibilityChangeEventData(visibilityChangeEvent);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					visibilityChangeEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target,
			eventTypeString,
			callbackfunc,
			handlerFunc: visibilityChangeEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_visibilitychange_callback_on_thread = (
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		if (!specialHTMLTargets[1]) {
			return -4;
		}
		return registerVisibilityChangeEventCallback(
			specialHTMLTargets[1],
			userData,
			useCapture,
			callbackfunc,
			21,
			'visibilitychange',
			targetThread
		);
	};
	_emscripten_set_visibilitychange_callback_on_thread.sig = 'ipipp';

	var _emscripten_get_visibility_status = (visibilityStatus) => {
		if (
			typeof document.visibilityState == 'undefined' &&
			typeof document.hidden == 'undefined'
		) {
			return -1;
		}
		fillVisibilityChangeEventData(visibilityStatus);
		return 0;
	};
	_emscripten_get_visibility_status.sig = 'ip';

	var registerTouchEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.touchEvent ||= _malloc(1552);

		target = findEventTarget(target);

		var touchEventHandlerFunc = (e) => {
			var t,
				touches = {},
				et = e.touches;
			// To ease marshalling different kinds of touches that browser reports (all touches are listed in e.touches,
			// only changed touches in e.changedTouches, and touches on target at a.targetTouches), mark a boolean in
			// each Touch object so that we can later loop only once over all touches we see to marshall over to Wasm.

			for (let t of et) {
				// Browser might recycle the generated Touch objects between each frame (Firefox on Android), so reset any
				// changed/target states we may have set from previous frame.
				t.isChanged = t.onTarget = 0;
				touches[t.identifier] = t;
			}
			// Mark which touches are part of the changedTouches list.
			for (let t of e.changedTouches) {
				t.isChanged = 1;
				touches[t.identifier] = t;
			}
			// Mark which touches are part of the targetTouches list.
			for (let t of e.targetTouches) {
				touches[t.identifier].onTarget = 1;
			}

			var touchEvent = JSEvents.touchEvent;
			HEAPF64[touchEvent >> 3] = e.timeStamp;
			HEAP8[touchEvent + 12] = e.ctrlKey;
			HEAP8[touchEvent + 13] = e.shiftKey;
			HEAP8[touchEvent + 14] = e.altKey;
			HEAP8[touchEvent + 15] = e.metaKey;
			var idx = touchEvent + 16;
			var targetRect = getBoundingClientRect(target);
			var numTouches = 0;
			for (let t of Object.values(touches)) {
				var idx32 = idx >> 2; // Pre-shift the ptr to index to HEAP32 to save code size
				HEAP32[idx32 + 0] = t.identifier;
				HEAP32[idx32 + 1] = t.screenX;
				HEAP32[idx32 + 2] = t.screenY;
				HEAP32[idx32 + 3] = t.clientX;
				HEAP32[idx32 + 4] = t.clientY;
				HEAP32[idx32 + 5] = t.pageX;
				HEAP32[idx32 + 6] = t.pageY;
				HEAP8[idx + 28] = t.isChanged;
				HEAP8[idx + 29] = t.onTarget;
				HEAP32[idx32 + 8] = t.clientX - (targetRect.left | 0);
				HEAP32[idx32 + 9] = t.clientY - (targetRect.top | 0);

				idx += 48;

				if (++numTouches > 31) {
					break;
				}
			}
			HEAP32[(touchEvent + 8) >> 2] = numTouches;

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					touchEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target,
			allowsDeferredCalls:
				eventTypeString == 'touchstart' ||
				eventTypeString == 'touchend',
			eventTypeString,
			callbackfunc,
			handlerFunc: touchEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_touchstart_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerTouchEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			22,
			'touchstart',
			targetThread
		);
	_emscripten_set_touchstart_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_touchend_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerTouchEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			23,
			'touchend',
			targetThread
		);
	_emscripten_set_touchend_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_touchmove_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerTouchEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			24,
			'touchmove',
			targetThread
		);
	_emscripten_set_touchmove_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_touchcancel_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) =>
		registerTouchEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			25,
			'touchcancel',
			targetThread
		);
	_emscripten_set_touchcancel_callback_on_thread.sig = 'ippipp';

	var fillGamepadEventData = (eventStruct, e) => {
		HEAPF64[eventStruct >> 3] = e.timestamp;
		for (var i = 0; i < e.axes.length; ++i) {
			HEAPF64[(eventStruct + i * 8 + 16) >> 3] = e.axes[i];
		}
		for (var i = 0; i < e.buttons.length; ++i) {
			if (typeof e.buttons[i] == 'object') {
				HEAPF64[(eventStruct + i * 8 + 528) >> 3] = e.buttons[i].value;
			} else {
				HEAPF64[(eventStruct + i * 8 + 528) >> 3] = e.buttons[i];
			}
		}
		for (var i = 0; i < e.buttons.length; ++i) {
			if (typeof e.buttons[i] == 'object') {
				HEAP8[eventStruct + i + 1040] = e.buttons[i].pressed;
			} else {
				// Assigning a boolean to HEAP32, that's ok, but Closure would like to warn about it:
				/** @suppress {checkTypes} */
				HEAP8[eventStruct + i + 1040] = e.buttons[i] == 1;
			}
		}
		HEAP8[eventStruct + 1104] = e.connected;
		HEAP32[(eventStruct + 1108) >> 2] = e.index;
		HEAP32[(eventStruct + 8) >> 2] = e.axes.length;
		HEAP32[(eventStruct + 12) >> 2] = e.buttons.length;
		stringToUTF8(e.id, eventStruct + 1112, 64);
		stringToUTF8(e.mapping, eventStruct + 1176, 64);
	};

	var registerGamepadEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.gamepadEvent ||= _malloc(1240);

		var gamepadEventHandlerFunc = (e = event) => {
			var gamepadEvent = JSEvents.gamepadEvent;
			fillGamepadEventData(gamepadEvent, e['gamepad']);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					gamepadEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target: findEventTarget(target),
			allowsDeferredCalls: true,
			eventTypeString,
			callbackfunc,
			handlerFunc: gamepadEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	/** @suppress {checkTypes} */
	var _emscripten_sample_gamepad_data = () => {
		try {
			if (navigator.getGamepads)
				return (JSEvents.lastGamepadState = navigator.getGamepads())
					? 0
					: -1;
		} catch (e) {
			navigator.getGamepads = null; // Disable getGamepads() so that it won't be attempted to be used again.
		}
		return -1;
	};
	_emscripten_sample_gamepad_data.sig = 'i';
	var _emscripten_set_gamepadconnected_callback_on_thread = (
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		if (_emscripten_sample_gamepad_data()) return -1;
		return registerGamepadEventCallback(
			2,
			userData,
			useCapture,
			callbackfunc,
			26,
			'gamepadconnected',
			targetThread
		);
	};
	_emscripten_set_gamepadconnected_callback_on_thread.sig = 'ipipp';

	var _emscripten_set_gamepaddisconnected_callback_on_thread = (
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		if (_emscripten_sample_gamepad_data()) return -1;
		return registerGamepadEventCallback(
			2,
			userData,
			useCapture,
			callbackfunc,
			27,
			'gamepaddisconnected',
			targetThread
		);
	};
	_emscripten_set_gamepaddisconnected_callback_on_thread.sig = 'ipipp';

	var _emscripten_get_num_gamepads = () => {
		// N.B. Do not call emscripten_get_num_gamepads() unless having first called emscripten_sample_gamepad_data(), and that has returned EMSCRIPTEN_RESULT_SUCCESS.
		// Otherwise the following line will throw an exception.
		return JSEvents.lastGamepadState.length;
	};
	_emscripten_get_num_gamepads.sig = 'i';

	var _emscripten_get_gamepad_status = (index, gamepadState) => {
		// INVALID_PARAM is returned on a Gamepad index that never was there.
		if (index < 0 || index >= JSEvents.lastGamepadState.length) return -5;

		// NO_DATA is returned on a Gamepad index that was removed.
		// For previously disconnected gamepads there should be an empty slot (null/undefined/false) at the index.
		// This is because gamepads must keep their original position in the array.
		// For example, removing the first of two gamepads produces [null/undefined/false, gamepad].
		if (!JSEvents.lastGamepadState[index]) return -7;

		fillGamepadEventData(gamepadState, JSEvents.lastGamepadState[index]);
		return 0;
	};
	_emscripten_get_gamepad_status.sig = 'iip';

	var registerBeforeUnloadEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString
	) => {
		var beforeUnloadEventHandlerFunc = (e = event) => {
			// Note: This is always called on the main browser thread, since it needs synchronously return a value!
			var confirmationMessage = getWasmTableEntry(callbackfunc)(
				eventTypeId,
				0,
				userData
			);

			if (confirmationMessage) {
				confirmationMessage = UTF8ToString(confirmationMessage);
			}
			if (confirmationMessage) {
				e.preventDefault();
				e.returnValue = confirmationMessage;
				return confirmationMessage;
			}
		};

		var eventHandler = {
			target: findEventTarget(target),
			eventTypeString,
			callbackfunc,
			handlerFunc: beforeUnloadEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_beforeunload_callback_on_thread = (
		userData,
		callbackfunc,
		targetThread
	) => {
		if (typeof onbeforeunload == 'undefined') return -1;
		// beforeunload callback can only be registered on the main browser thread, because the page will go away immediately after returning from the handler,
		// and there is no time to start proxying it anywhere.
		if (targetThread !== 1) return -5;
		return registerBeforeUnloadEventCallback(
			2,
			userData,
			true,
			callbackfunc,
			28,
			'beforeunload'
		);
	};
	_emscripten_set_beforeunload_callback_on_thread.sig = 'ippp';

	var fillBatteryEventData = (eventStruct, battery) => {
		HEAPF64[eventStruct >> 3] = battery.chargingTime;
		HEAPF64[(eventStruct + 8) >> 3] = battery.dischargingTime;
		HEAPF64[(eventStruct + 16) >> 3] = battery.level;
		HEAP8[eventStruct + 24] = battery.charging;
	};

	var hasBatteryAPI = () =>
		typeof navigator != 'undefined' && navigator.getBattery;

	var registerBatteryEventCallback = (
		battery,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		JSEvents.batteryEvent ||= _malloc(32);

		var batteryEventHandlerFunc = (e = event) => {
			var batteryEvent = JSEvents.batteryEvent;
			fillBatteryEventData(batteryEvent, battery);

			if (
				getWasmTableEntry(callbackfunc)(
					eventTypeId,
					batteryEvent,
					userData
				)
			)
				e.preventDefault();
		};

		var eventHandler = {
			target: battery,
			eventTypeString,
			callbackfunc,
			handlerFunc: batteryEventHandlerFunc,
			useCapture,
		};
		return JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_batterychargingchange_callback_on_thread = (
		userData,
		callbackfunc,
		targetThread
	) => {
		if (!hasBatteryAPI()) return -1;
		navigator.getBattery().then((b) => {
			registerBatteryEventCallback(
				b,
				userData,
				true,
				callbackfunc,
				29,
				'chargingchange',
				targetThread
			);
		});
	};
	_emscripten_set_batterychargingchange_callback_on_thread.sig = 'ippp';

	var _emscripten_set_batterylevelchange_callback_on_thread = (
		userData,
		callbackfunc,
		targetThread
	) => {
		if (!hasBatteryAPI()) return -1;
		navigator.getBattery().then((b) => {
			registerBatteryEventCallback(
				b,
				userData,
				true,
				callbackfunc,
				30,
				'levelchange',
				targetThread
			);
		});
	};
	_emscripten_set_batterylevelchange_callback_on_thread.sig = 'ippp';

	var batteryManager;

	var _emscripten_get_battery_status = (batteryState) => {
		if (!hasBatteryAPI()) return -1;
		if (!batteryManager) {
			navigator.getBattery().then((b) => {
				batteryManager = b;
			});
			return -7;
		}
		fillBatteryEventData(batteryState, batteryManager);
		return 0;
	};
	_emscripten_get_battery_status.sig = 'ip';

	var _emscripten_set_element_css_size = (target, width, height) => {
		target = findEventTarget(target);
		if (!target) return -4;

		target.style.width = width + 'px';
		target.style.height = height + 'px';

		return 0;
	};
	_emscripten_set_element_css_size.sig = 'ipdd';

	var _emscripten_get_element_css_size = (target, width, height) => {
		target = findEventTarget(target);
		if (!target) return -4;

		var rect = getBoundingClientRect(target);
		HEAPF64[width >> 3] = rect.width;
		HEAPF64[height >> 3] = rect.height;

		return 0;
	};
	_emscripten_get_element_css_size.sig = 'ippp';

	var _emscripten_html5_remove_all_event_listeners = () =>
		JSEvents.removeAllEventListeners();
	_emscripten_html5_remove_all_event_listeners.sig = 'v';

	var _emscripten_request_animation_frame = (cb, userData) =>
		requestAnimationFrame((timeStamp) =>
			getWasmTableEntry(cb)(timeStamp, userData)
		);
	_emscripten_request_animation_frame.sig = 'ipp';

	var _emscripten_cancel_animation_frame = (id) => cancelAnimationFrame(id);
	_emscripten_cancel_animation_frame.sig = 'vi';

	var _emscripten_request_animation_frame_loop = (cb, userData) => {
		function tick(timeStamp) {
			if (getWasmTableEntry(cb)(timeStamp, userData)) {
				requestAnimationFrame(tick);
			}
		}
		return requestAnimationFrame(tick);
	};
	_emscripten_request_animation_frame_loop.sig = 'vpp';

	var _emscripten_get_device_pixel_ratio = () => {
		return (typeof devicePixelRatio == 'number' && devicePixelRatio) || 1.0;
	};
	_emscripten_get_device_pixel_ratio.sig = 'd';

	var _emscripten_get_callstack = (flags, str, maxbytes) => {
		var callstack = getCallstack(flags);
		// User can query the required amount of bytes to hold the callstack.
		if (!str || maxbytes <= 0) {
			return lengthBytesUTF8(callstack) + 1;
		}
		// Output callstack string as C string to HEAP.
		var bytesWrittenExcludingNull = stringToUTF8(callstack, str, maxbytes);

		// Return number of bytes written, including null.
		return bytesWrittenExcludingNull + 1;
	};
	_emscripten_get_callstack.sig = 'iipi';

	/** @returns {number} */
	var convertFrameToPC = (frame) => {
		var match;

		if ((match = /\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(frame))) {
			// Wasm engines give the binary offset directly, so we use that as return address
			return +match[1];
		} else if ((match = /:(\d+):\d+(?:\)|$)/.exec(frame))) {
			// If we are in js, we can use the js line number as the "return address".
			// This should work for wasm2js.  We tag the high bit to distinguish this
			// from wasm addresses.
			return 0x80000000 | +match[1];
		}
		// return 0 if we can't find any
		return 0;
	};

	var _emscripten_return_address = (level) => {
		var callstack = jsStackTrace().split('\n');
		if (callstack[0] == 'Error') {
			callstack.shift();
		}
		// skip this function and the caller to get caller's return address
		var caller = callstack[level + 3];
		return convertFrameToPC(caller);
	};
	_emscripten_return_address.sig = 'pi';

	var UNWIND_CACHE = {};

	var saveInUnwindCache = (callstack) => {
		for (var line of callstack) {
			var pc = convertFrameToPC(line);
			if (pc) {
				UNWIND_CACHE[pc] = line;
			}
		}
	};

	var _emscripten_stack_snapshot = () => {
		var callstack = jsStackTrace().split('\n');
		if (callstack[0] == 'Error') {
			callstack.shift();
		}
		saveInUnwindCache(callstack);

		// Caches the stack snapshot so that emscripten_stack_unwind_buffer() can
		// unwind from this spot.
		UNWIND_CACHE.last_addr = convertFrameToPC(callstack[3]);
		UNWIND_CACHE.last_stack = callstack;
		return UNWIND_CACHE.last_addr;
	};
	_emscripten_stack_snapshot.sig = 'p';

	var _emscripten_stack_unwind_buffer = (addr, buffer, count) => {
		var stack;
		if (UNWIND_CACHE.last_addr == addr) {
			stack = UNWIND_CACHE.last_stack;
		} else {
			stack = jsStackTrace().split('\n');
			if (stack[0] == 'Error') {
				stack.shift();
			}
			saveInUnwindCache(stack);
		}

		var offset = 3;
		while (stack[offset] && convertFrameToPC(stack[offset]) != addr) {
			++offset;
		}

		for (var i = 0; i < count && stack[i + offset]; ++i) {
			HEAP32[(buffer + i * 4) >> 2] = convertFrameToPC(stack[i + offset]);
		}
		return i;
	};
	_emscripten_stack_unwind_buffer.sig = 'ippi';

	var _emscripten_pc_get_function = (pc) => {
		var frame = UNWIND_CACHE[pc];
		if (!frame) return 0;

		var name;
		var match;
		// First try to match foo.wasm.sym files explcitly. e.g.
		//
		//   at test_return_address.wasm.main (wasm://wasm/test_return_address.wasm-0012cc2a:wasm-function[26]:0x9f3
		//
		// Then match JS symbols which don't include that module name:
		//
		//   at invokeEntryPoint (.../test_return_address.js:1500:42)
		//
		// Finally match firefox format:
		//
		//   Object._main@http://server.com:4324:12'
		if ((match = /^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(frame))) {
			name = match[1];
		} else if ((match = /^\s+at (.*) \(.*\)$/.exec(frame))) {
			name = match[1];
		} else if ((match = /^(.+?)@/.exec(frame))) {
			name = match[1];
		} else {
			return 0;
		}

		_free(_emscripten_pc_get_function.ret ?? 0);
		_emscripten_pc_get_function.ret = stringToNewUTF8(name);
		return _emscripten_pc_get_function.ret;
	};
	_emscripten_pc_get_function.sig = 'pp';

	var convertPCtoSourceLocation = (pc) => {
		if (UNWIND_CACHE.last_get_source_pc == pc)
			return UNWIND_CACHE.last_source;

		var match;
		var source;

		if (!source) {
			var frame = UNWIND_CACHE[pc];
			if (!frame) return null;
			// Example: at callMain (a.out.js:6335:22)
			if ((match = /\((.*):(\d+):(\d+)\)$/.exec(frame))) {
				source = { file: match[1], line: match[2], column: match[3] };
				// Example: main@a.out.js:1337:42
			} else if ((match = /@(.*):(\d+):(\d+)/.exec(frame))) {
				source = { file: match[1], line: match[2], column: match[3] };
			}
		}
		UNWIND_CACHE.last_get_source_pc = pc;
		UNWIND_CACHE.last_source = source;
		return source;
	};

	var _emscripten_pc_get_file = (pc) => {
		var result = convertPCtoSourceLocation(pc);
		if (!result) return 0;

		_free(_emscripten_pc_get_file.ret ?? 0);
		_emscripten_pc_get_file.ret = stringToNewUTF8(result.file);
		return _emscripten_pc_get_file.ret;
	};
	_emscripten_pc_get_file.sig = 'pp';

	var _emscripten_pc_get_line = (pc) => {
		var result = convertPCtoSourceLocation(pc);
		return result ? result.line : 0;
	};
	_emscripten_pc_get_line.sig = 'ip';

	var _emscripten_pc_get_column = (pc) => {
		var result = convertPCtoSourceLocation(pc);
		return result ? result.column || 0 : 0;
	};
	_emscripten_pc_get_column.sig = 'ip';

	var _sched_yield = () => 0;
	_sched_yield.sig = 'i';

	var wasiRightsToMuslOFlags = (rights) => {
		if (rights & 2 && rights & 64) {
			return 2;
		}
		if (rights & 2) {
			return 0;
		}
		if (rights & 64) {
			return 1;
		}
		throw new FS.ErrnoError(28);
	};

	var wasiOFlagsToMuslOFlags = (oflags) => {
		var musl_oflags = 0;
		if (oflags & 1) {
			musl_oflags |= 64;
		}
		if (oflags & 8) {
			musl_oflags |= 512;
		}
		if (oflags & 2) {
			musl_oflags |= 65536;
		}
		if (oflags & 4) {
			musl_oflags |= 128;
		}
		return musl_oflags;
	};

	var _emscripten_unwind_to_js_event_loop = () => {
		throw 'unwind';
	};
	_emscripten_unwind_to_js_event_loop.sig = 'v';

	var setImmediateWrapped = (func) => {
		setImmediateWrapped.mapping ||= [];
		var id = setImmediateWrapped.mapping.length;
		setImmediateWrapped.mapping[id] = setImmediate(() => {
			setImmediateWrapped.mapping[id] = undefined;
			func();
		});
		return id;
	};

	var safeRequestAnimationFrame = (func) => {
		runtimeKeepalivePush();
		return MainLoop.requestAnimationFrame(() => {
			runtimeKeepalivePop();
			callUserCallback(func);
		});
	};

	var clearImmediateWrapped = (id) => {
		clearImmediate(setImmediateWrapped.mapping[id]);
		setImmediateWrapped.mapping[id] = undefined;
	};

	var emClearImmediate;
	var emSetImmediate;

	var emClearImmediate_deps = ['$emSetImmediate'];

	var _emscripten_set_immediate = (cb, userData) => {
		runtimeKeepalivePush();
		return emSetImmediate(() => {
			runtimeKeepalivePop();
			callUserCallback(() => getWasmTableEntry(cb)(userData));
		});
	};
	_emscripten_set_immediate.sig = 'ipp';

	var _emscripten_clear_immediate = (id) => {
		runtimeKeepalivePop();
		emClearImmediate(id);
	};
	_emscripten_clear_immediate.sig = 'vi';

	var _emscripten_set_immediate_loop = (cb, userData) => {
		function tick() {
			callUserCallback(() => {
				if (getWasmTableEntry(cb)(userData)) {
					emSetImmediate(tick);
				} else {
					runtimeKeepalivePop();
				}
			});
		}
		runtimeKeepalivePush();
		emSetImmediate(tick);
	};
	_emscripten_set_immediate_loop.sig = 'vpp';

	var _emscripten_set_timeout = (cb, msecs, userData) =>
		safeSetTimeout(() => getWasmTableEntry(cb)(userData), msecs);
	_emscripten_set_timeout.sig = 'ipdp';

	var _emscripten_clear_timeout = clearTimeout;
	_emscripten_clear_timeout.sig = 'vi';

	var _emscripten_set_timeout_loop = (cb, msecs, userData) => {
		function tick() {
			var t = _emscripten_get_now();
			var n = t + msecs;
			runtimeKeepalivePop();
			callUserCallback(() => {
				if (getWasmTableEntry(cb)(t, userData)) {
					runtimeKeepalivePush();
					// Save a little bit of code space: modern browsers should treat
					// negative setTimeout as timeout of 0
					// (https://stackoverflow.com/questions/8430966/is-calling-settimeout-with-a-negative-delay-ok)
					var remaining = n - _emscripten_get_now();
					// Recent revsions of node, however, give TimeoutNegativeWarning
					remaining = Math.max(0, remaining);
					setTimeout(tick, remaining);
				}
			});
		}
		runtimeKeepalivePush();
		return setTimeout(tick, 0);
	};
	_emscripten_set_timeout_loop.sig = 'vpdp';

	var _emscripten_set_interval = (cb, msecs, userData) => {
		runtimeKeepalivePush();
		return setInterval(() => {
			callUserCallback(() => getWasmTableEntry(cb)(userData));
		}, msecs);
	};
	_emscripten_set_interval.sig = 'ipdp';

	var _emscripten_clear_interval = (id) => {
		runtimeKeepalivePop();
		clearInterval(id);
	};
	_emscripten_clear_interval.sig = 'vi';

	var _emscripten_async_call = (func, arg, millis) => {
		var wrapper = () => getWasmTableEntry(func)(arg);

		if (
			millis >= 0 ||
			// node does not support requestAnimationFrame
			ENVIRONMENT_IS_NODE
		) {
			safeSetTimeout(wrapper, millis);
		} else {
			safeRequestAnimationFrame(wrapper);
		}
	};
	_emscripten_async_call.sig = 'vppi';

	var registerPostMainLoop = (f) => {
		// Does nothing unless $MainLoop is included/used.
		typeof MainLoop != 'undefined' && MainLoop.postMainLoop.push(f);
	};

	var registerPreMainLoop = (f) => {
		// Does nothing unless $MainLoop is included/used.
		typeof MainLoop != 'undefined' && MainLoop.preMainLoop.push(f);
	};

	var _emscripten_get_main_loop_timing = (mode, value) => {
		if (mode) HEAP32[mode >> 2] = MainLoop.timingMode;
		if (value) HEAP32[value >> 2] = MainLoop.timingValue;
	};
	_emscripten_get_main_loop_timing.sig = 'vpp';

	var _emscripten_set_main_loop = (func, fps, simulateInfiniteLoop) => {
		var iterFunc = getWasmTableEntry(func);
		setMainLoop(iterFunc, fps, simulateInfiniteLoop);
	};
	_emscripten_set_main_loop.sig = 'vpii';

	var _emscripten_set_main_loop_arg = (
		func,
		arg,
		fps,
		simulateInfiniteLoop
	) => {
		var iterFunc = () => getWasmTableEntry(func)(arg);
		setMainLoop(iterFunc, fps, simulateInfiniteLoop, arg);
	};
	_emscripten_set_main_loop_arg.sig = 'vppii';

	var _emscripten_cancel_main_loop = () => {
		MainLoop.pause();
		MainLoop.func = null;
	};
	_emscripten_cancel_main_loop.sig = 'v';

	var _emscripten_pause_main_loop = () => MainLoop.pause();
	_emscripten_pause_main_loop.sig = 'v';

	var _emscripten_resume_main_loop = () => MainLoop.resume();
	_emscripten_resume_main_loop.sig = 'v';

	var __emscripten_push_main_loop_blocker = (func, arg, name) => {
		MainLoop.queue.push({
			func: () => {
				getWasmTableEntry(func)(arg);
			},
			name: UTF8ToString(name),
			counted: true,
		});
		MainLoop.updateStatus();
	};
	__emscripten_push_main_loop_blocker.sig = 'vppp';

	var __emscripten_push_uncounted_main_loop_blocker = (func, arg, name) => {
		MainLoop.queue.push({
			func: () => {
				getWasmTableEntry(func)(arg);
			},
			name: UTF8ToString(name),
			counted: false,
		});
		MainLoop.updateStatus();
	};
	__emscripten_push_uncounted_main_loop_blocker.sig = 'vppp';

	var _emscripten_set_main_loop_expected_blockers = (num) => {
		MainLoop.expectedBlockers = num;
		MainLoop.remainingBlockers = num;
		MainLoop.updateStatus();
	};
	_emscripten_set_main_loop_expected_blockers.sig = 'vi';

	var idsToPromises = (idBuf, size) => {
		var promises = [];
		for (var i = 0; i < size; i++) {
			var id = HEAP32[(idBuf + i * 4) >> 2];
			promises[i] = getPromise(id);
		}
		return promises;
	};

	var makePromiseCallback = (callback, userData) => {
		return (value) => {
			runtimeKeepalivePop();
			var stack = stackSave();
			// Allocate space for the result value and initialize it to NULL.
			var resultPtr = stackAlloc(POINTER_SIZE);
			HEAPU32[resultPtr >> 2] = 0;
			try {
				var result = getWasmTableEntry(callback)(
					resultPtr,
					userData,
					value
				);
				var resultVal = HEAPU32[resultPtr >> 2];
			} catch (e) {
				// If the thrown value is potentially a valid pointer, use it as the
				// rejection reason. Otherwise use a null pointer as the reason. If we
				// allow arbitrary objects to be thrown here, we will get a TypeError in
				// MEMORY64 mode when they are later converted to void* rejection
				// values.
				if (typeof e != 'number') {
					throw 0;
				}
				throw e;
			} finally {
				// Thrown errors will reject the promise, but at least we will restore
				// the stack first.
				stackRestore(stack);
			}
			switch (result) {
				case 0:
					return resultVal;
				case 1:
					return getPromise(resultVal);
				case 2:
					var ret = getPromise(resultVal);
					_emscripten_promise_destroy(resultVal);
					return ret;
				case 3:
					throw resultVal;
			}
		};
	};

	var _emscripten_promise_then = (id, onFulfilled, onRejected, userData) => {
		runtimeKeepalivePush();
		var promise = getPromise(id);
		var newId = promiseMap.allocate({
			promise: promise.then(
				makePromiseCallback(onFulfilled, userData),
				makePromiseCallback(onRejected, userData)
			),
		});
		return newId;
	};
	_emscripten_promise_then.sig = 'ppppp';

	var _emscripten_promise_all = (idBuf, resultBuf, size) => {
		var promises = idsToPromises(idBuf, size);
		var id = promiseMap.allocate({
			promise: Promise.all(promises).then((results) => {
				if (resultBuf) {
					for (var i = 0; i < size; i++) {
						var result = results[i];
						HEAPU32[(resultBuf + i * 4) >> 2] = result;
					}
				}
				return resultBuf;
			}),
		});
		return id;
	};
	_emscripten_promise_all.sig = 'pppp';

	var setPromiseResult = (ptr, fulfill, value) => {
		var result = fulfill ? 0 : 3;
		HEAP32[ptr >> 2] = result;
		HEAPU32[(ptr + 4) >> 2] = value;
	};

	var _emscripten_promise_all_settled = (idBuf, resultBuf, size) => {
		var promises = idsToPromises(idBuf, size);
		var id = promiseMap.allocate({
			promise: Promise.allSettled(promises).then((results) => {
				if (resultBuf) {
					var offset = resultBuf;
					for (var i = 0; i < size; i++, offset += 8) {
						if (results[i].status === 'fulfilled') {
							setPromiseResult(offset, true, results[i].value);
						} else {
							setPromiseResult(offset, false, results[i].reason);
						}
					}
				}
				return resultBuf;
			}),
		});
		return id;
	};
	_emscripten_promise_all_settled.sig = 'pppp';

	var _emscripten_promise_any = (idBuf, errorBuf, size) => {
		var promises = idsToPromises(idBuf, size);
		var id = promiseMap.allocate({
			promise: Promise.any(promises).catch((err) => {
				if (errorBuf) {
					for (var i = 0; i < size; i++) {
						HEAPU32[(errorBuf + i * 4) >> 2] = err.errors[i];
					}
				}
				throw errorBuf;
			}),
		});
		return id;
	};
	_emscripten_promise_any.sig = 'pppp';

	var _emscripten_promise_race = (idBuf, size) => {
		var promises = idsToPromises(idBuf, size);
		var id = promiseMap.allocate({
			promise: Promise.race(promises),
		});
		return id;
	};
	_emscripten_promise_race.sig = 'ppp';

	var _emscripten_promise_await = (returnValuePtr, id) => {
		return Asyncify.handleAsync(() =>
			getPromise(id).then(
				(value) => setPromiseResult(returnValuePtr, true, value),
				(error) => setPromiseResult(returnValuePtr, false, error)
			)
		);
	};
	_emscripten_promise_await.sig = 'vpp';
	_emscripten_promise_await.isAsync = true;

	var getExceptionMessageCommon = (ptr) => {
		var sp = stackSave();
		var type_addr_addr = stackAlloc(4);
		var message_addr_addr = stackAlloc(4);
		___get_exception_message(ptr, type_addr_addr, message_addr_addr);
		var type_addr = HEAPU32[type_addr_addr >> 2];
		var message_addr = HEAPU32[message_addr_addr >> 2];
		var type = UTF8ToString(type_addr);
		_free(type_addr);
		var message;
		if (message_addr) {
			message = UTF8ToString(message_addr);
			_free(message_addr);
		}
		stackRestore(sp);
		return [type, message];
	};

	var getCppExceptionTag = () => ___cpp_exception;

	var getCppExceptionThrownObjectFromWebAssemblyException = (ex) => {
		// In Wasm EH, the value extracted from WebAssembly.Exception is a pointer
		// to the unwind header. Convert it to the actual thrown value.
		var unwind_header = ex.getArg(getCppExceptionTag(), 0);
		return ___thrown_object_from_unwind_exception(unwind_header);
	};

	var incrementExceptionRefcount = (ex) => {
		var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
		___cxa_increment_exception_refcount(ptr);
	};

	var decrementExceptionRefcount = (ex) => {
		var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
		___cxa_decrement_exception_refcount(ptr);
	};

	var getExceptionMessage = (ex) => {
		var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
		return getExceptionMessageCommon(ptr);
	};

	var Browser = {
		useWebGL: false,
		isFullscreen: false,
		pointerLock: false,
		moduleContextCreatedCallbacks: [],
		workers: [],
		preloadedImages: {},
		preloadedAudios: {},
		getCanvas: () => Module['canvas'],
		init() {
			if (Browser.initted) return;
			Browser.initted = true;

			// Support for plugins that can process preloaded files. You can add more of these to
			// your app by creating and appending to preloadPlugins.
			//
			// Each plugin is asked if it can handle a file based on the file's name. If it can,
			// it is given the file's raw data. When it is done, it calls a callback with the file's
			// (possibly modified) data. For example, a plugin might decompress a file, or it
			// might create some side data structure for use later (like an Image element, etc.).

			var imagePlugin = {};
			imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
				return (
					!Module['noImageDecoding'] &&
					/\.(jpg|jpeg|png|bmp|webp)$/i.test(name)
				);
			};
			imagePlugin['handle'] = async function imagePlugin_handle(
				byteArray,
				name
			) {
				var b = new Blob([byteArray], {
					type: Browser.getMimetype(name),
				});
				if (b.size !== byteArray.length) {
					// Safari bug #118630
					// Safari's Blob can only take an ArrayBuffer
					b = new Blob([new Uint8Array(byteArray).buffer], {
						type: Browser.getMimetype(name),
					});
				}
				var url = URL.createObjectURL(b);
				return new Promise((resolve, reject) => {
					var img = new Image();
					img.onload = () => {
						var canvas = /** @type {!HTMLCanvasElement} */ (
							document.createElement('canvas')
						);
						canvas.width = img.width;
						canvas.height = img.height;
						var ctx = canvas.getContext('2d');
						ctx.drawImage(img, 0, 0);
						Browser.preloadedImages[name] = canvas;
						URL.revokeObjectURL(url);
						resolve(byteArray);
					};
					img.onerror = (event) => {
						err(`Image ${url} could not be decoded`);
						reject();
					};
					img.src = url;
				});
			};
			preloadPlugins.push(imagePlugin);

			var audioPlugin = {};
			audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
				return (
					!Module['noAudioDecoding'] &&
					name.slice(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 }
				);
			};
			audioPlugin['handle'] = async function audioPlugin_handle(
				byteArray,
				name
			) {
				return new Promise((resolve, reject) => {
					var done = false;
					function finish(audio) {
						if (done) return;
						done = true;
						Browser.preloadedAudios[name] = audio;
						resolve(byteArray);
					}
					var b = new Blob([byteArray], {
						type: Browser.getMimetype(name),
					});
					var url = URL.createObjectURL(b); // XXX we never revoke this!
					var audio = new Audio();
					audio.addEventListener(
						'canplaythrough',
						() => finish(audio),
						false
					); // use addEventListener due to chromium bug 124926
					audio.onerror = function audio_onerror(event) {
						if (done) return;
						err(
							`warning: browser could not fully decode audio ${name}, trying slower base64 approach`
						);
						function encode64(data) {
							var BASE =
								'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
							var PAD = '=';
							var ret = '';
							var leftchar = 0;
							var leftbits = 0;
							for (var i = 0; i < data.length; i++) {
								leftchar = (leftchar << 8) | data[i];
								leftbits += 8;
								while (leftbits >= 6) {
									var curr =
										(leftchar >> (leftbits - 6)) & 0x3f;
									leftbits -= 6;
									ret += BASE[curr];
								}
							}
							if (leftbits == 2) {
								ret += BASE[(leftchar & 3) << 4];
								ret += PAD + PAD;
							} else if (leftbits == 4) {
								ret += BASE[(leftchar & 0xf) << 2];
								ret += PAD;
							}
							return ret;
						}
						audio.src =
							'data:audio/x-' +
							name.slice(-3) +
							';base64,' +
							encode64(byteArray);
						finish(audio); // we don't wait for confirmation this worked - but it's worth trying
					};
					audio.src = url;
					// workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
					safeSetTimeout(() => {
						finish(audio); // try to use it even though it is not necessarily ready to play
					}, 10000);
				});
			};
			preloadPlugins.push(audioPlugin);

			// Canvas event setup

			function pointerLockChange() {
				var canvas = Browser.getCanvas();
				Browser.pointerLock = document.pointerLockElement === canvas;
			}
			var canvas = Browser.getCanvas();
			if (canvas) {
				// forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
				// Module['forcedAspectRatio'] = 4 / 3;

				document.addEventListener(
					'pointerlockchange',
					pointerLockChange,
					false
				);

				if (Module['elementPointerLock']) {
					canvas.addEventListener(
						'click',
						(ev) => {
							if (
								!Browser.pointerLock &&
								Browser.getCanvas().requestPointerLock
							) {
								Browser.getCanvas().requestPointerLock();
								ev.preventDefault();
							}
						},
						false
					);
				}
			}
		},
		createContext(
			/** @type {HTMLCanvasElement} */ canvas,
			useWebGL,
			setInModule,
			webGLContextAttributes
		) {
			if (useWebGL && Module['ctx'] && canvas == Browser.getCanvas())
				return Module['ctx']; // no need to recreate GL context if it's already been created for this canvas.

			var ctx;
			var contextHandle;
			if (useWebGL) {
				// For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
				var contextAttributes = {
					antialias: false,
					alpha: false,
					majorVersion: 1,
				};

				if (webGLContextAttributes) {
					for (var attribute in webGLContextAttributes) {
						contextAttributes[attribute] =
							webGLContextAttributes[attribute];
					}
				}

				// This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
				// actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
				// Browser.createContext() should not even be emitted.
				if (typeof GL != 'undefined') {
					contextHandle = GL.createContext(canvas, contextAttributes);
					if (contextHandle) {
						ctx = GL.getContext(contextHandle).GLctx;
					}
				}
			} else {
				ctx = canvas.getContext('2d');
			}

			if (!ctx) return null;

			if (setInModule) {
				Module['ctx'] = ctx;
				if (useWebGL) GL.makeContextCurrent(contextHandle);
				Browser.useWebGL = useWebGL;
				Browser.moduleContextCreatedCallbacks.forEach((callback) =>
					callback()
				);
				Browser.init();
			}
			return ctx;
		},
		fullscreenHandlersInstalled: false,
		lockPointer: undefined,
		resizeCanvas: undefined,
		requestFullscreen(lockPointer, resizeCanvas) {
			Browser.lockPointer = lockPointer;
			Browser.resizeCanvas = resizeCanvas;
			if (typeof Browser.lockPointer == 'undefined')
				Browser.lockPointer = true;
			if (typeof Browser.resizeCanvas == 'undefined')
				Browser.resizeCanvas = false;

			var canvas = Browser.getCanvas();
			function fullscreenChange() {
				Browser.isFullscreen = false;
				var canvasContainer = canvas.parentNode;
				if (getFullscreenElement() === canvasContainer) {
					canvas.exitFullscreen = Browser.exitFullscreen;
					if (Browser.lockPointer) canvas.requestPointerLock();
					Browser.isFullscreen = true;
					if (Browser.resizeCanvas) {
						Browser.setFullscreenCanvasSize();
					} else {
						Browser.updateCanvasDimensions(canvas);
					}
				} else {
					// remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
					canvasContainer.parentNode.insertBefore(
						canvas,
						canvasContainer
					);
					canvasContainer.parentNode.removeChild(canvasContainer);

					if (Browser.resizeCanvas) {
						Browser.setWindowedCanvasSize();
					} else {
						Browser.updateCanvasDimensions(canvas);
					}
				}
				Module['onFullScreen']?.(Browser.isFullscreen);
				Module['onFullscreen']?.(Browser.isFullscreen);
			}

			if (!Browser.fullscreenHandlersInstalled) {
				Browser.fullscreenHandlersInstalled = true;
				document.addEventListener(
					'fullscreenchange',
					fullscreenChange,
					false
				);
				document.addEventListener(
					'mozfullscreenchange',
					fullscreenChange,
					false
				);
				document.addEventListener(
					'webkitfullscreenchange',
					fullscreenChange,
					false
				);
				document.addEventListener(
					'MSFullscreenChange',
					fullscreenChange,
					false
				);
			}

			// create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
			var canvasContainer = document.createElement('div');
			canvas.parentNode.insertBefore(canvasContainer, canvas);
			canvasContainer.appendChild(canvas);

			// use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
			canvasContainer.requestFullscreen =
				canvasContainer['requestFullscreen'] ||
				canvasContainer['mozRequestFullScreen'] ||
				canvasContainer['msRequestFullscreen'] ||
				(canvasContainer['webkitRequestFullscreen']
					? () =>
							canvasContainer['webkitRequestFullscreen'](
								Element['ALLOW_KEYBOARD_INPUT']
							)
					: null) ||
				(canvasContainer['webkitRequestFullScreen']
					? () =>
							canvasContainer['webkitRequestFullScreen'](
								Element['ALLOW_KEYBOARD_INPUT']
							)
					: null);

			canvasContainer.requestFullscreen();
		},
		exitFullscreen() {
			// This is workaround for chrome. Trying to exit from fullscreen
			// not in fullscreen state will cause "TypeError: Document not active"
			// in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
			if (!Browser.isFullscreen) {
				return false;
			}

			var CFS =
				document['exitFullscreen'] ||
				document['cancelFullScreen'] ||
				document['mozCancelFullScreen'] ||
				document['msExitFullscreen'] ||
				document['webkitCancelFullScreen'] ||
				(() => {});
			CFS.apply(document, []);
			return true;
		},
		safeSetTimeout(func, timeout) {
			// Legacy function, this is used by the SDL2 port so we need to keep it
			// around at least until that is updated.
			// See https://github.com/libsdl-org/SDL/pull/6304
			return safeSetTimeout(func, timeout);
		},
		getMimetype(name) {
			return {
				jpg: 'image/jpeg',
				jpeg: 'image/jpeg',
				png: 'image/png',
				bmp: 'image/bmp',
				ogg: 'audio/ogg',
				wav: 'audio/wav',
				mp3: 'audio/mpeg',
			}[name.slice(name.lastIndexOf('.') + 1)];
		},
		getUserMedia(func) {
			window.getUserMedia ||=
				navigator['getUserMedia'] || navigator['mozGetUserMedia'];
			window.getUserMedia(func);
		},
		getMovementX(event) {
			return (
				event['movementX'] ||
				event['mozMovementX'] ||
				event['webkitMovementX'] ||
				0
			);
		},
		getMovementY(event) {
			return (
				event['movementY'] ||
				event['mozMovementY'] ||
				event['webkitMovementY'] ||
				0
			);
		},
		getMouseWheelDelta(event) {
			var delta = 0;
			switch (event.type) {
				case 'DOMMouseScroll':
					// 3 lines make up a step
					delta = event.detail / 3;
					break;
				case 'mousewheel':
					// 120 units make up a step
					delta = event.wheelDelta / 120;
					break;
				case 'wheel':
					delta = event.deltaY;
					switch (event.deltaMode) {
						case 0:
							// DOM_DELTA_PIXEL: 100 pixels make up a step
							delta /= 100;
							break;
						case 1:
							// DOM_DELTA_LINE: 3 lines make up a step
							delta /= 3;
							break;
						case 2:
							// DOM_DELTA_PAGE: A page makes up 80 steps
							delta *= 80;
							break;
						default:
							abort(
								'unrecognized mouse wheel delta mode: ' +
									event.deltaMode
							);
					}
					break;
				default:
					abort('unrecognized mouse wheel event: ' + event.type);
			}
			return delta;
		},
		mouseX: 0,
		mouseY: 0,
		mouseMovementX: 0,
		mouseMovementY: 0,
		touches: {},
		lastTouches: {},
		calculateMouseCoords(pageX, pageY) {
			// Calculate the movement based on the changes
			// in the coordinates.
			var canvas = Browser.getCanvas();
			var rect = canvas.getBoundingClientRect();

			// Neither .scrollX or .pageXOffset are defined in a spec, but
			// we prefer .scrollX because it is currently in a spec draft.
			// (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
			var scrollX =
				typeof window.scrollX != 'undefined'
					? window.scrollX
					: window.pageXOffset;
			var scrollY =
				typeof window.scrollY != 'undefined'
					? window.scrollY
					: window.pageYOffset;
			var adjustedX = pageX - (scrollX + rect.left);
			var adjustedY = pageY - (scrollY + rect.top);

			// the canvas might be CSS-scaled compared to its backbuffer;
			// SDL-using content will want mouse coordinates in terms
			// of backbuffer units.
			adjustedX = adjustedX * (canvas.width / rect.width);
			adjustedY = adjustedY * (canvas.height / rect.height);

			return { x: adjustedX, y: adjustedY };
		},
		setMouseCoords(pageX, pageY) {
			const { x, y } = Browser.calculateMouseCoords(pageX, pageY);
			Browser.mouseMovementX = x - Browser.mouseX;
			Browser.mouseMovementY = y - Browser.mouseY;
			Browser.mouseX = x;
			Browser.mouseY = y;
		},
		calculateMouseEvent(event) {
			// event should be mousemove, mousedown or mouseup
			if (Browser.pointerLock) {
				// When the pointer is locked, calculate the coordinates
				// based on the movement of the mouse.
				// Workaround for Firefox bug 764498
				if (event.type != 'mousemove' && 'mozMovementX' in event) {
					Browser.mouseMovementX = Browser.mouseMovementY = 0;
				} else {
					Browser.mouseMovementX = Browser.getMovementX(event);
					Browser.mouseMovementY = Browser.getMovementY(event);
				}

				// add the mouse delta to the current absolute mouse position
				Browser.mouseX += Browser.mouseMovementX;
				Browser.mouseY += Browser.mouseMovementY;
			} else {
				if (
					event.type === 'touchstart' ||
					event.type === 'touchend' ||
					event.type === 'touchmove'
				) {
					var touch = event.touch;
					if (touch === undefined) {
						return; // the "touch" property is only defined in SDL
					}
					var coords = Browser.calculateMouseCoords(
						touch.pageX,
						touch.pageY
					);

					if (event.type === 'touchstart') {
						Browser.lastTouches[touch.identifier] = coords;
						Browser.touches[touch.identifier] = coords;
					} else if (
						event.type === 'touchend' ||
						event.type === 'touchmove'
					) {
						var last = Browser.touches[touch.identifier];
						last ||= coords;
						Browser.lastTouches[touch.identifier] = last;
						Browser.touches[touch.identifier] = coords;
					}
					return;
				}

				Browser.setMouseCoords(event.pageX, event.pageY);
			}
		},
		resizeListeners: [],
		updateResizeListeners() {
			var canvas = Browser.getCanvas();
			Browser.resizeListeners.forEach((listener) =>
				listener(canvas.width, canvas.height)
			);
		},
		setCanvasSize(width, height, noUpdates) {
			var canvas = Browser.getCanvas();
			Browser.updateCanvasDimensions(canvas, width, height);
			if (!noUpdates) Browser.updateResizeListeners();
		},
		windowedWidth: 0,
		windowedHeight: 0,
		setFullscreenCanvasSize() {
			// check if SDL is available
			if (typeof SDL != 'undefined') {
				var flags = HEAPU32[SDL.screen >> 2];
				flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
				HEAP32[SDL.screen >> 2] = flags;
			}
			Browser.updateCanvasDimensions(Browser.getCanvas());
			Browser.updateResizeListeners();
		},
		setWindowedCanvasSize() {
			// check if SDL is available
			if (typeof SDL != 'undefined') {
				var flags = HEAPU32[SDL.screen >> 2];
				flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
				HEAP32[SDL.screen >> 2] = flags;
			}
			Browser.updateCanvasDimensions(Browser.getCanvas());
			Browser.updateResizeListeners();
		},
		updateCanvasDimensions(canvas, wNative, hNative) {
			if (wNative && hNative) {
				canvas.widthNative = wNative;
				canvas.heightNative = hNative;
			} else {
				wNative = canvas.widthNative;
				hNative = canvas.heightNative;
			}
			var w = wNative;
			var h = hNative;
			if (Module['forcedAspectRatio'] > 0) {
				if (w / h < Module['forcedAspectRatio']) {
					w = Math.round(h * Module['forcedAspectRatio']);
				} else {
					h = Math.round(w / Module['forcedAspectRatio']);
				}
			}
			if (
				getFullscreenElement() === canvas.parentNode &&
				typeof screen != 'undefined'
			) {
				var factor = Math.min(screen.width / w, screen.height / h);
				w = Math.round(w * factor);
				h = Math.round(h * factor);
			}
			if (Browser.resizeCanvas) {
				if (canvas.width != w) canvas.width = w;
				if (canvas.height != h) canvas.height = h;
				if (typeof canvas.style != 'undefined') {
					canvas.style.removeProperty('width');
					canvas.style.removeProperty('height');
				}
			} else {
				if (canvas.width != wNative) canvas.width = wNative;
				if (canvas.height != hNative) canvas.height = hNative;
				if (typeof canvas.style != 'undefined') {
					if (w != wNative || h != hNative) {
						canvas.style.setProperty(
							'width',
							w + 'px',
							'important'
						);
						canvas.style.setProperty(
							'height',
							h + 'px',
							'important'
						);
					} else {
						canvas.style.removeProperty('width');
						canvas.style.removeProperty('height');
					}
				}
			}
		},
	};

	var requestFullscreen = Browser.requestFullscreen;

	var setCanvasSize = Browser.setCanvasSize;

	var getUserMedia = Browser.getUserMedia;

	var createContext = Browser.createContext;

	var _emscripten_run_preload_plugins = (file, onload, onerror) => {
		runtimeKeepalivePush();

		var _file = UTF8ToString(file);
		var data = FS.analyzePath(_file);
		if (!data.exists) return -1;
		FS.createPreloadedFile(
			PATH.dirname(_file),
			PATH.basename(_file),
			// TODO: This copy is not needed if the contents are already a Uint8Array,
			//       which they often are (and always are in WasmFS).
			new Uint8Array(data.object.contents),
			true,
			true,
			() => {
				runtimeKeepalivePop();
				if (onload) getWasmTableEntry(onload)(file);
			},
			() => {
				runtimeKeepalivePop();
				if (onerror) getWasmTableEntry(onerror)(file);
			},
			true // don'tCreateFile - it's already there
		);
		return 0;
	};
	_emscripten_run_preload_plugins.sig = 'ippp';

	var Browser_asyncPrepareDataCounter = 0;

	var _emscripten_run_preload_plugins_data = (
		data,
		size,
		suffix,
		arg,
		onload,
		onerror
	) => {
		runtimeKeepalivePush();

		var _suffix = UTF8ToString(suffix);
		var name =
			'prepare_data_' + Browser_asyncPrepareDataCounter++ + '.' + _suffix;
		var cname = stringToNewUTF8(name);
		FS.createPreloadedFile(
			'/',
			name,
			HEAPU8.subarray(data, data + size),
			true,
			true,
			() => {
				runtimeKeepalivePop();
				if (onload) getWasmTableEntry(onload)(arg, cname);
			},
			() => {
				runtimeKeepalivePop();
				if (onerror) getWasmTableEntry(onerror)(arg);
			},
			true // don'tCreateFile - it's already there
		);
	};
	_emscripten_run_preload_plugins_data.sig = 'vpipppp';

	var _emscripten_async_run_script = (script, millis) => {
		// TODO: cache these to avoid generating garbage
		safeSetTimeout(() => _emscripten_run_script(script), millis);
	};
	_emscripten_async_run_script.sig = 'vpi';

	var _emscripten_async_load_script = async (url, onload, onerror) => {
		url = UTF8ToString(url);
		runtimeKeepalivePush();

		var loadDone = () => {
			runtimeKeepalivePop();
			if (onload) {
				var onloadCallback = () =>
					callUserCallback(getWasmTableEntry(onload));
				if (runDependencies > 0) {
					dependenciesFulfilled = onloadCallback;
				} else {
					onloadCallback();
				}
			}
		};

		var loadError = () => {
			runtimeKeepalivePop();
			if (onerror) {
				callUserCallback(getWasmTableEntry(onerror));
			}
		};

		if (ENVIRONMENT_IS_NODE) {
			try {
				var data = await readAsync(url, false);
				eval(data);
				loadDone();
			} catch (e) {
				err(e);
				loadError();
			}
			return;
		}

		var script = document.createElement('script');
		script.onload = loadDone;
		script.onerror = loadError;
		script.src = url;
		document.body.appendChild(script);
	};
	_emscripten_async_load_script.sig = 'vppp';

	var _emscripten_get_window_title = () => {
		var buflen = 256;

		if (!_emscripten_get_window_title.buffer) {
			_emscripten_get_window_title.buffer = _malloc(buflen);
		}

		stringToUTF8(
			document.title,
			_emscripten_get_window_title.buffer,
			buflen
		);

		return _emscripten_get_window_title.buffer;
	};
	_emscripten_get_window_title.sig = 'p';

	var _emscripten_set_window_title = (title) =>
		(document.title = UTF8ToString(title));
	_emscripten_set_window_title.sig = 'vp';

	var _emscripten_get_screen_size = (width, height) => {
		HEAP32[width >> 2] = screen.width;
		HEAP32[height >> 2] = screen.height;
	};
	_emscripten_get_screen_size.sig = 'vpp';

	var _emscripten_hide_mouse = () => {
		var styleSheet = document.styleSheets[0];
		var rules = styleSheet.cssRules;
		for (var i = 0; i < rules.length; i++) {
			if (rules[i].cssText.startsWith('canvas')) {
				styleSheet.deleteRule(i);
				i--;
			}
		}
		styleSheet.insertRule(
			'canvas.emscripten { border: 1px solid black; cursor: none; }',
			0
		);
	};
	_emscripten_hide_mouse.sig = 'v';

	var _emscripten_set_canvas_size = (width, height) =>
		Browser.setCanvasSize(width, height);
	_emscripten_set_canvas_size.sig = 'vii';

	var _emscripten_get_canvas_size = (width, height, isFullscreen) => {
		var canvas = Browser.getCanvas();
		HEAP32[width >> 2] = canvas.width;
		HEAP32[height >> 2] = canvas.height;
		HEAP32[isFullscreen >> 2] = Browser.isFullscreen ? 1 : 0;
	};
	_emscripten_get_canvas_size.sig = 'vppp';

	var _emscripten_create_worker = (url) => {
		url = UTF8ToString(url);
		var id = Browser.workers.length;
		var info = {
			worker: new Worker(url),
			callbacks: [],
			awaited: 0,
			buffer: 0,
		};
		info.worker.onmessage = function info_worker_onmessage(msg) {
			if (ABORT) return;
			var info = Browser.workers[id];
			if (!info) return; // worker was destroyed meanwhile
			var callbackId = msg.data['callbackId'];
			var callbackInfo = info.callbacks[callbackId];
			if (!callbackInfo) return; // no callback or callback removed meanwhile
			// Don't trash our callback state if we expect additional calls.
			if (msg.data['finalResponse']) {
				info.awaited--;
				info.callbacks[callbackId] = null; // TODO: reuse callbackIds, compress this
				runtimeKeepalivePop();
			}
			var data = msg.data['data'];
			if (data) {
				if (!data.byteLength) data = new Uint8Array(data);
				info.buffer = _realloc(info.buffer, data.length);
				HEAPU8.set(data, info.buffer);
				callbackInfo.func(info.buffer, data.length, callbackInfo.arg);
			} else {
				callbackInfo.func(0, 0, callbackInfo.arg);
			}
		};
		Browser.workers.push(info);
		return id;
	};
	_emscripten_create_worker.sig = 'ip';

	var _emscripten_destroy_worker = (id) => {
		var info = Browser.workers[id];
		info.worker.terminate();
		_free(info.buffer);
		Browser.workers[id] = null;
	};
	_emscripten_destroy_worker.sig = 'vi';

	var _emscripten_call_worker = (id, funcName, data, size, callback, arg) => {
		funcName = UTF8ToString(funcName);
		var info = Browser.workers[id];
		var callbackId = -1;
		if (callback) {
			// If we are waiting for a response from the worker we need to keep
			// the runtime alive at least long enough to receive it.
			// The corresponding runtimeKeepalivePop is in the `finalResponse`
			// handler above.
			runtimeKeepalivePush();
			callbackId = info.callbacks.length;
			info.callbacks.push({
				func: getWasmTableEntry(callback),
				arg,
			});
			info.awaited++;
		}
		var transferObject = {
			funcName: funcName,
			callbackId: callbackId,
			data: data ? new Uint8Array(HEAPU8.subarray(data, data + size)) : 0,
		};
		if (data) {
			info.worker.postMessage(transferObject, [
				transferObject.data.buffer,
			]);
		} else {
			info.worker.postMessage(transferObject);
		}
	};
	_emscripten_call_worker.sig = 'vippipp';

	var _emscripten_get_worker_queue_size = (id) => {
		var info = Browser.workers[id];
		if (!info) return -1;
		return info.awaited;
	};
	_emscripten_get_worker_queue_size.sig = 'ii';

	var getPreloadedImageData = (path, w, h) => {
		path = PATH_FS.resolve(path);

		var canvas = /** @type {HTMLCanvasElement} */ (
			Browser.preloadedImages[path]
		);
		if (!canvas) return 0;

		var ctx = canvas.getContext('2d');
		var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
		var buf = _malloc(canvas.width * canvas.height * 4);

		HEAPU8.set(image.data, buf);

		HEAP32[w >> 2] = canvas.width;
		HEAP32[h >> 2] = canvas.height;
		return buf;
	};

	var _emscripten_get_preloaded_image_data = (path, w, h) =>
		getPreloadedImageData(UTF8ToString(path), w, h);
	_emscripten_get_preloaded_image_data.sig = 'pppp';

	var getPreloadedImageData__data = ['$PATH_FS', 'malloc'];

	var _emscripten_get_preloaded_image_data_from_FILE = (file, w, h) => {
		var fd = _fileno(file);
		var stream = FS.getStream(fd);
		if (stream) {
			return getPreloadedImageData(stream.path, w, h);
		}

		return 0;
	};
	_emscripten_get_preloaded_image_data_from_FILE.sig = 'pppp';

	var wget = {
		wgetRequests: {},
		nextWgetRequestHandle: 0,
		getNextWgetRequestHandle() {
			var handle = wget.nextWgetRequestHandle;
			wget.nextWgetRequestHandle++;
			return handle;
		},
	};

	/**
	 * @param {number=} mode Optionally, the mode to create in. Uses mkdir's
	 *                       default if not set.
	 */
	var FS_mkdirTree = (path, mode) => FS.mkdirTree(path, mode);

	var _emscripten_async_wget = (url, file, onload, onerror) => {
		runtimeKeepalivePush();

		var _url = UTF8ToString(url);
		var _file = UTF8ToString(file);
		_file = PATH_FS.resolve(_file);
		function doCallback(callback) {
			if (callback) {
				runtimeKeepalivePop();
				callUserCallback(() =>
					withStackSave(() =>
						getWasmTableEntry(callback)(stringToUTF8OnStack(_file))
					)
				);
			}
		}
		var destinationDirectory = PATH.dirname(_file);
		FS_preloadFile(
			destinationDirectory,
			PATH.basename(_file),
			_url,
			true,
			true,
			false, // dontCreateFile
			false, // canOwn
			() => {
				// preFinish
				// if a file exists there, we overwrite it
				try {
					FS_unlink(_file);
				} catch (e) {}
				// if the destination directory does not yet exist, create it
				FS_mkdirTree(destinationDirectory);
			}
		)
			.then(() => doCallback(onload))
			.catch(() => doCallback(onerror));
	};
	_emscripten_async_wget.sig = 'vpppp';

	var _emscripten_async_wget_data = async (
		url,
		userdata,
		onload,
		onerror
	) => {
		runtimeKeepalivePush();
		/* no need for run dependency, this is async but will not do any prepare etc. step */
		try {
			var byteArray = await asyncLoad(UTF8ToString(url));
			runtimeKeepalivePop();
			callUserCallback(() => {
				var buffer = _malloc(byteArray.length);
				HEAPU8.set(byteArray, buffer);
				getWasmTableEntry(onload)(userdata, buffer, byteArray.length);
				_free(buffer);
			});
		} catch (e) {
			if (onerror) {
				runtimeKeepalivePop();
				callUserCallback(() => {
					getWasmTableEntry(onerror)(userdata);
				});
			}
		}
	};
	_emscripten_async_wget_data.sig = 'vpppp';

	var _emscripten_async_wget2 = (
		url,
		file,
		request,
		param,
		userdata,
		onload,
		onerror,
		onprogress
	) => {
		runtimeKeepalivePush();

		var _url = UTF8ToString(url);
		var _file = UTF8ToString(file);
		_file = PATH_FS.resolve(_file);
		var _request = UTF8ToString(request);
		var _param = UTF8ToString(param);
		var index = _file.lastIndexOf('/');

		var http = new XMLHttpRequest();
		http.open(_request, _url, true);
		http.responseType = 'arraybuffer';

		var handle = wget.getNextWgetRequestHandle();

		var destinationDirectory = PATH.dirname(_file);

		// LOAD
		http.onload = (e) => {
			runtimeKeepalivePop();
			if (http.status >= 200 && http.status < 300) {
				// if a file exists there, we overwrite it
				try {
					FS.unlink(_file);
				} catch (e) {}
				// if the destination directory does not yet exist, create it
				FS.mkdirTree(destinationDirectory);

				FS.createDataFile(
					_file.slice(0, index),
					_file.slice(index + 1),
					new Uint8Array(/** @type{ArrayBuffer}*/ (http.response)),
					true,
					true,
					false
				);
				if (onload) {
					var sp = stackSave();
					getWasmTableEntry(onload)(
						handle,
						userdata,
						stringToUTF8OnStack(_file)
					);
					stackRestore(sp);
				}
			} else {
				if (onerror)
					getWasmTableEntry(onerror)(handle, userdata, http.status);
			}

			delete wget.wgetRequests[handle];
		};

		// ERROR
		http.onerror = (e) => {
			runtimeKeepalivePop();
			if (onerror)
				getWasmTableEntry(onerror)(handle, userdata, http.status);
			delete wget.wgetRequests[handle];
		};

		// PROGRESS
		http.onprogress = (e) => {
			if (
				e.lengthComputable ||
				(e.lengthComputable === undefined && e.total != 0)
			) {
				var percentComplete = (e.loaded / e.total) * 100;
				if (onprogress)
					getWasmTableEntry(onprogress)(
						handle,
						userdata,
						percentComplete
					);
			}
		};

		// ABORT
		http.onabort = (e) => {
			runtimeKeepalivePop();
			delete wget.wgetRequests[handle];
		};

		if (_request == 'POST') {
			//Send the proper header information along with the request
			http.setRequestHeader(
				'Content-type',
				'application/x-www-form-urlencoded'
			);
			http.send(_param);
		} else {
			http.send(null);
		}

		wget.wgetRequests[handle] = http;

		return handle;
	};
	_emscripten_async_wget2.sig = 'ipppppppp';

	var _emscripten_async_wget2_data = (
		url,
		request,
		param,
		userdata,
		free,
		onload,
		onerror,
		onprogress
	) => {
		var _url = UTF8ToString(url);
		var _request = UTF8ToString(request);
		var _param = UTF8ToString(param);

		var http = new XMLHttpRequest();
		http.open(_request, _url, true);
		http.responseType = 'arraybuffer';

		var handle = wget.getNextWgetRequestHandle();

		function onerrorjs() {
			if (onerror) {
				var sp = stackSave();
				var statusText = 0;
				if (http.statusText) {
					statusText = stringToUTF8OnStack(http.statusText);
				}
				getWasmTableEntry(onerror)(
					handle,
					userdata,
					http.status,
					statusText
				);
				stackRestore(sp);
			}
		}

		// LOAD
		http.onload = (e) => {
			if (
				(http.status >= 200 && http.status < 300) ||
				(http.status === 0 && _url.slice(0, 4).toLowerCase() != 'http')
			) {
				var byteArray = new Uint8Array(
					/** @type{ArrayBuffer} */ (http.response)
				);
				var buffer = _malloc(byteArray.length);
				HEAPU8.set(byteArray, buffer);
				if (onload)
					getWasmTableEntry(onload)(
						handle,
						userdata,
						buffer,
						byteArray.length
					);
				if (free) _free(buffer);
			} else {
				onerrorjs();
			}
			delete wget.wgetRequests[handle];
		};

		// ERROR
		http.onerror = (e) => {
			onerrorjs();
			delete wget.wgetRequests[handle];
		};

		// PROGRESS
		http.onprogress = (e) => {
			if (onprogress)
				getWasmTableEntry(onprogress)(
					handle,
					userdata,
					e.loaded,
					e.lengthComputable || e.lengthComputable === undefined
						? e.total
						: 0
				);
		};

		// ABORT
		http.onabort = (e) => {
			delete wget.wgetRequests[handle];
		};

		if (_request == 'POST') {
			//Send the proper header information along with the request
			http.setRequestHeader(
				'Content-type',
				'application/x-www-form-urlencoded'
			);
			http.send(_param);
		} else {
			http.send(null);
		}

		wget.wgetRequests[handle] = http;

		return handle;
	};
	_emscripten_async_wget2_data.sig = 'ippppippp';

	var _emscripten_async_wget2_abort = (handle) => {
		var http = wget.wgetRequests[handle];
		http?.abort();
	};
	_emscripten_async_wget2_abort.sig = 'vi';

	var ___asctime_r = (tmPtr, buf) => {
		var date = {
			tm_sec: HEAP32[tmPtr >> 2],
			tm_min: HEAP32[(tmPtr + 4) >> 2],
			tm_hour: HEAP32[(tmPtr + 8) >> 2],
			tm_mday: HEAP32[(tmPtr + 12) >> 2],
			tm_mon: HEAP32[(tmPtr + 16) >> 2],
			tm_year: HEAP32[(tmPtr + 20) >> 2],
			tm_wday: HEAP32[(tmPtr + 24) >> 2],
		};
		var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		var months = [
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec',
		];
		var s =
			days[date.tm_wday] +
			' ' +
			months[date.tm_mon] +
			(date.tm_mday < 10 ? '  ' : ' ') +
			date.tm_mday +
			(date.tm_hour < 10 ? ' 0' : ' ') +
			date.tm_hour +
			(date.tm_min < 10 ? ':0' : ':') +
			date.tm_min +
			(date.tm_sec < 10 ? ':0' : ':') +
			date.tm_sec +
			' ' +
			(1900 + date.tm_year) +
			'\n';

		// asctime_r is specced to behave in an undefined manner if the algorithm would attempt
		// to write out more than 26 bytes (including the null terminator).
		// See http://pubs.opengroup.org/onlinepubs/9699919799/functions/asctime.html
		// Our undefined behavior is to truncate the write to at most 26 bytes, including null terminator.
		stringToUTF8(s, buf, 26);
		return buf;
	};
	___asctime_r.sig = 'ppp';

	var _strptime_l = (buf, format, tm, locale) => _strptime(buf, format, tm);
	_strptime_l.sig = 'ppppp';

	function ___syscall_shutdown(fd, how) {
		try {
			getSocketFromFD(fd);
			return -52; // unsupported feature
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}
	___syscall_shutdown.sig = 'iiiiiii';

	var __dlsym_catchup_js = (handle, symbolIndex) => {
		var lib = LDSO.loadedLibsByHandle[handle];
		var symDict = lib.exports;
		var symName = Object.keys(symDict)[symbolIndex];
		var sym = symDict[symName];
		var result = addFunction(sym, sym.sig);
		return result;
	};
	__dlsym_catchup_js.sig = 'ppi';

	var FS_readFile = (...args) => FS.readFile(...args);

	var FS_root = (...args) => FS.root(...args);

	var FS_mounts = (...args) => FS.mounts(...args);

	var FS_devices = (...args) => FS.devices(...args);

	var FS_streams = (...args) => FS.streams(...args);

	var FS_nextInode = (...args) => FS.nextInode(...args);

	var FS_nameTable = (...args) => FS.nameTable(...args);

	var FS_currentPath = (...args) => FS.currentPath(...args);

	var FS_initialized = (...args) => FS.initialized(...args);

	var FS_ignorePermissions = (...args) => FS.ignorePermissions(...args);

	var FS_filesystems = (...args) => FS.filesystems(...args);

	var FS_syncFSRequests = (...args) => FS.syncFSRequests(...args);

	var FS_readFiles = (...args) => FS.readFiles(...args);

	var FS_lookupPath = (...args) => FS.lookupPath(...args);

	var FS_getPath = (...args) => FS.getPath(...args);

	var FS_hashName = (...args) => FS.hashName(...args);

	var FS_hashAddNode = (...args) => FS.hashAddNode(...args);

	var FS_hashRemoveNode = (...args) => FS.hashRemoveNode(...args);

	var FS_lookupNode = (...args) => FS.lookupNode(...args);

	var FS_createNode = (...args) => FS.createNode(...args);

	var FS_destroyNode = (...args) => FS.destroyNode(...args);

	var FS_isRoot = (...args) => FS.isRoot(...args);

	var FS_isMountpoint = (...args) => FS.isMountpoint(...args);

	var FS_isFile = (...args) => FS.isFile(...args);

	var FS_isDir = (...args) => FS.isDir(...args);

	var FS_isLink = (...args) => FS.isLink(...args);

	var FS_isChrdev = (...args) => FS.isChrdev(...args);

	var FS_isBlkdev = (...args) => FS.isBlkdev(...args);

	var FS_isFIFO = (...args) => FS.isFIFO(...args);

	var FS_isSocket = (...args) => FS.isSocket(...args);

	var FS_flagsToPermissionString = (...args) =>
		FS.flagsToPermissionString(...args);

	var FS_nodePermissions = (...args) => FS.nodePermissions(...args);

	var FS_mayLookup = (...args) => FS.mayLookup(...args);

	var FS_mayCreate = (...args) => FS.mayCreate(...args);

	var FS_mayDelete = (...args) => FS.mayDelete(...args);

	var FS_mayOpen = (...args) => FS.mayOpen(...args);

	var FS_checkOpExists = (...args) => FS.checkOpExists(...args);

	var FS_nextfd = (...args) => FS.nextfd(...args);

	var FS_getStreamChecked = (...args) => FS.getStreamChecked(...args);

	var FS_getStream = (...args) => FS.getStream(...args);

	var FS_createStream = (...args) => FS.createStream(...args);

	var FS_closeStream = (...args) => FS.closeStream(...args);

	var FS_dupStream = (...args) => FS.dupStream(...args);

	var FS_doSetAttr = (...args) => FS.doSetAttr(...args);

	var FS_chrdev_stream_ops = (...args) => FS.chrdev_stream_ops(...args);

	var FS_major = (...args) => FS.major(...args);

	var FS_minor = (...args) => FS.minor(...args);

	var FS_makedev = (...args) => FS.makedev(...args);

	var FS_registerDevice = (...args) => FS.registerDevice(...args);

	var FS_getDevice = (...args) => FS.getDevice(...args);

	var FS_getMounts = (...args) => FS.getMounts(...args);

	var FS_syncfs = (...args) => FS.syncfs(...args);

	var FS_mount = (...args) => FS.mount(...args);

	var FS_unmount = (...args) => FS.unmount(...args);

	var FS_lookup = (...args) => FS.lookup(...args);

	var FS_mknod = (...args) => FS.mknod(...args);

	var FS_statfs = (...args) => FS.statfs(...args);

	var FS_statfsStream = (...args) => FS.statfsStream(...args);

	var FS_statfsNode = (...args) => FS.statfsNode(...args);

	var FS_create = (...args) => FS.create(...args);

	var FS_mkdir = (...args) => FS.mkdir(...args);

	var FS_mkdev = (...args) => FS.mkdev(...args);

	var FS_symlink = (...args) => FS.symlink(...args);

	var FS_rename = (...args) => FS.rename(...args);

	var FS_rmdir = (...args) => FS.rmdir(...args);

	var FS_readdir = (...args) => FS.readdir(...args);

	var FS_readlink = (...args) => FS.readlink(...args);

	var FS_stat = (...args) => FS.stat(...args);

	var FS_fstat = (...args) => FS.fstat(...args);

	var FS_lstat = (...args) => FS.lstat(...args);

	var FS_doChmod = (...args) => FS.doChmod(...args);

	var FS_chmod = (...args) => FS.chmod(...args);

	var FS_lchmod = (...args) => FS.lchmod(...args);

	var FS_fchmod = (...args) => FS.fchmod(...args);

	var FS_doChown = (...args) => FS.doChown(...args);

	var FS_chown = (...args) => FS.chown(...args);

	var FS_lchown = (...args) => FS.lchown(...args);

	var FS_fchown = (...args) => FS.fchown(...args);

	var FS_doTruncate = (...args) => FS.doTruncate(...args);

	var FS_truncate = (...args) => FS.truncate(...args);

	var FS_ftruncate = (...args) => FS.ftruncate(...args);

	var FS_utime = (...args) => FS.utime(...args);

	var FS_open = (...args) => FS.open(...args);

	var FS_close = (...args) => FS.close(...args);

	var FS_isClosed = (...args) => FS.isClosed(...args);

	var FS_llseek = (...args) => FS.llseek(...args);

	var FS_read = (...args) => FS.read(...args);

	var FS_write = (...args) => FS.write(...args);

	var FS_mmap = (...args) => FS.mmap(...args);

	var FS_msync = (...args) => FS.msync(...args);

	var FS_ioctl = (...args) => FS.ioctl(...args);

	var FS_writeFile = (...args) => FS.writeFile(...args);

	var FS_cwd = (...args) => FS.cwd(...args);

	var FS_chdir = (...args) => FS.chdir(...args);

	var FS_createDefaultDirectories = (...args) =>
		FS.createDefaultDirectories(...args);

	var FS_createDefaultDevices = (...args) => FS.createDefaultDevices(...args);

	var FS_createSpecialDirectories = (...args) =>
		FS.createSpecialDirectories(...args);

	var FS_createStandardStreams = (...args) =>
		FS.createStandardStreams(...args);

	var FS_staticInit = (...args) => FS.staticInit(...args);

	var FS_init = (...args) => FS.init(...args);

	var FS_quit = (...args) => FS.quit(...args);

	var FS_findObject = (...args) => FS.findObject(...args);

	var FS_analyzePath = (...args) => FS.analyzePath(...args);

	var FS_createFile = (...args) => FS.createFile(...args);

	var FS_forceLoadFile = (...args) => FS.forceLoadFile(...args);

	var _setNetworkCallback = (event, userData, callback) => {
		function _callback(data) {
			callUserCallback(() => {
				if (event === 'error') {
					withStackSave(() => {
						var msg = stringToUTF8OnStack(data[2]);
						getWasmTableEntry(callback)(
							data[0],
							data[1],
							msg,
							userData
						);
					});
				} else {
					getWasmTableEntry(callback)(data, userData);
				}
			});
		}

		// FIXME(sbc): This has no corresponding Pop so will currently keep the
		// runtime alive indefinitely.
		runtimeKeepalivePush();
		SOCKFS.on(event, callback ? _callback : null);
	};

	var _emscripten_set_socket_error_callback = (userData, callback) =>
		_setNetworkCallback('error', userData, callback);
	_emscripten_set_socket_error_callback.sig = 'vpp';

	var _emscripten_set_socket_open_callback = (userData, callback) =>
		_setNetworkCallback('open', userData, callback);
	_emscripten_set_socket_open_callback.sig = 'vpp';

	var _emscripten_set_socket_listen_callback = (userData, callback) =>
		_setNetworkCallback('listen', userData, callback);
	_emscripten_set_socket_listen_callback.sig = 'vpp';

	var _emscripten_set_socket_connection_callback = (userData, callback) =>
		_setNetworkCallback('connection', userData, callback);
	_emscripten_set_socket_connection_callback.sig = 'vpp';

	var _emscripten_set_socket_message_callback = (userData, callback) =>
		_setNetworkCallback('message', userData, callback);
	_emscripten_set_socket_message_callback.sig = 'vpp';

	var _emscripten_set_socket_close_callback = (userData, callback) =>
		_setNetworkCallback('close', userData, callback);
	_emscripten_set_socket_close_callback.sig = 'vpp';

	var _emscripten_webgl_enable_ANGLE_instanced_arrays = (ctx) =>
		webgl_enable_ANGLE_instanced_arrays(GL.contexts[ctx].GLctx);
	_emscripten_webgl_enable_ANGLE_instanced_arrays.sig = 'ip';

	var _emscripten_webgl_enable_OES_vertex_array_object = (ctx) =>
		webgl_enable_OES_vertex_array_object(GL.contexts[ctx].GLctx);
	_emscripten_webgl_enable_OES_vertex_array_object.sig = 'ip';

	var _emscripten_webgl_enable_WEBGL_draw_buffers = (ctx) =>
		webgl_enable_WEBGL_draw_buffers(GL.contexts[ctx].GLctx);
	_emscripten_webgl_enable_WEBGL_draw_buffers.sig = 'ip';

	var _emscripten_webgl_enable_WEBGL_multi_draw = (ctx) =>
		webgl_enable_WEBGL_multi_draw(GL.contexts[ctx].GLctx);
	_emscripten_webgl_enable_WEBGL_multi_draw.sig = 'ip';

	var _emscripten_webgl_enable_EXT_polygon_offset_clamp = (ctx) =>
		webgl_enable_EXT_polygon_offset_clamp(GL.contexts[ctx].GLctx);
	_emscripten_webgl_enable_EXT_polygon_offset_clamp.sig = 'ip';

	var _emscripten_webgl_enable_EXT_clip_control = (ctx) =>
		webgl_enable_EXT_clip_control(GL.contexts[ctx].GLctx);
	_emscripten_webgl_enable_EXT_clip_control.sig = 'ip';

	var _emscripten_webgl_enable_WEBGL_polygon_mode = (ctx) =>
		webgl_enable_WEBGL_polygon_mode(GL.contexts[ctx].GLctx);
	_emscripten_webgl_enable_WEBGL_polygon_mode.sig = 'ip';

	var _glPixelStorei = _emscripten_glPixelStorei;
	_glPixelStorei.sig = 'vii';

	var _glGetString = _emscripten_glGetString;
	_glGetString.sig = 'pi';

	var _glGetIntegerv = _emscripten_glGetIntegerv;
	_glGetIntegerv.sig = 'vip';

	var _glGetFloatv = _emscripten_glGetFloatv;
	_glGetFloatv.sig = 'vip';

	var _glGetBooleanv = _emscripten_glGetBooleanv;
	_glGetBooleanv.sig = 'vip';

	var _glDeleteTextures = _emscripten_glDeleteTextures;
	_glDeleteTextures.sig = 'vip';

	var _glCompressedTexImage2D = _emscripten_glCompressedTexImage2D;
	_glCompressedTexImage2D.sig = 'viiiiiiip';

	var _glCompressedTexSubImage2D = _emscripten_glCompressedTexSubImage2D;
	_glCompressedTexSubImage2D.sig = 'viiiiiiiip';

	var _glTexImage2D = _emscripten_glTexImage2D;
	_glTexImage2D.sig = 'viiiiiiiip';

	var _glTexSubImage2D = _emscripten_glTexSubImage2D;
	_glTexSubImage2D.sig = 'viiiiiiiip';

	var _glReadPixels = _emscripten_glReadPixels;
	_glReadPixels.sig = 'viiiiiip';

	var _glBindTexture = _emscripten_glBindTexture;
	_glBindTexture.sig = 'vii';

	var _glGetTexParameterfv = _emscripten_glGetTexParameterfv;
	_glGetTexParameterfv.sig = 'viip';

	var _glGetTexParameteriv = _emscripten_glGetTexParameteriv;
	_glGetTexParameteriv.sig = 'viip';

	var _glTexParameterfv = _emscripten_glTexParameterfv;
	_glTexParameterfv.sig = 'viip';

	var _glTexParameteriv = _emscripten_glTexParameteriv;
	_glTexParameteriv.sig = 'viip';

	var _glIsTexture = _emscripten_glIsTexture;
	_glIsTexture.sig = 'ii';

	var _glGenBuffers = _emscripten_glGenBuffers;
	_glGenBuffers.sig = 'vip';

	var _glGenTextures = _emscripten_glGenTextures;
	_glGenTextures.sig = 'vip';

	var _glDeleteBuffers = _emscripten_glDeleteBuffers;
	_glDeleteBuffers.sig = 'vip';

	var _glGetBufferParameteriv = _emscripten_glGetBufferParameteriv;
	_glGetBufferParameteriv.sig = 'viip';

	var _glBufferData = _emscripten_glBufferData;
	_glBufferData.sig = 'vippi';

	var _glBufferSubData = _emscripten_glBufferSubData;
	_glBufferSubData.sig = 'vippp';

	var _glGenQueriesEXT = _emscripten_glGenQueriesEXT;

	var _glDeleteQueriesEXT = _emscripten_glDeleteQueriesEXT;

	var _glIsQueryEXT = _emscripten_glIsQueryEXT;

	var _glBeginQueryEXT = _emscripten_glBeginQueryEXT;

	var _glEndQueryEXT = _emscripten_glEndQueryEXT;

	var _glQueryCounterEXT = _emscripten_glQueryCounterEXT;

	var _glGetQueryivEXT = _emscripten_glGetQueryivEXT;

	var _glGetQueryObjectivEXT = _emscripten_glGetQueryObjectivEXT;

	var _glGetQueryObjectuivEXT = _emscripten_glGetQueryObjectivEXT;

	var _glGetQueryObjecti64vEXT = _emscripten_glGetQueryObjecti64vEXT;

	var _glGetQueryObjectui64vEXT = _emscripten_glGetQueryObjecti64vEXT;

	var _glIsBuffer = _emscripten_glIsBuffer;
	_glIsBuffer.sig = 'ii';

	var _glGenRenderbuffers = _emscripten_glGenRenderbuffers;
	_glGenRenderbuffers.sig = 'vip';

	var _glDeleteRenderbuffers = _emscripten_glDeleteRenderbuffers;
	_glDeleteRenderbuffers.sig = 'vip';

	var _glBindRenderbuffer = _emscripten_glBindRenderbuffer;
	_glBindRenderbuffer.sig = 'vii';

	var _glGetRenderbufferParameteriv =
		_emscripten_glGetRenderbufferParameteriv;
	_glGetRenderbufferParameteriv.sig = 'viip';

	var _glIsRenderbuffer = _emscripten_glIsRenderbuffer;
	_glIsRenderbuffer.sig = 'ii';

	var _glGetUniformfv = _emscripten_glGetUniformfv;
	_glGetUniformfv.sig = 'viip';

	var _glGetUniformiv = _emscripten_glGetUniformiv;
	_glGetUniformiv.sig = 'viip';

	var _glGetUniformLocation = _emscripten_glGetUniformLocation;
	_glGetUniformLocation.sig = 'iip';

	var _glGetVertexAttribfv = _emscripten_glGetVertexAttribfv;
	_glGetVertexAttribfv.sig = 'viip';

	var _glGetVertexAttribiv = _emscripten_glGetVertexAttribiv;
	_glGetVertexAttribiv.sig = 'viip';

	var _glGetVertexAttribPointerv = _emscripten_glGetVertexAttribPointerv;
	_glGetVertexAttribPointerv.sig = 'viip';

	var _glUniform1f = _emscripten_glUniform1f;
	_glUniform1f.sig = 'vif';

	var _glUniform2f = _emscripten_glUniform2f;
	_glUniform2f.sig = 'viff';

	var _glUniform3f = _emscripten_glUniform3f;
	_glUniform3f.sig = 'vifff';

	var _glUniform4f = _emscripten_glUniform4f;
	_glUniform4f.sig = 'viffff';

	var _glUniform1i = _emscripten_glUniform1i;
	_glUniform1i.sig = 'vii';

	var _glUniform2i = _emscripten_glUniform2i;
	_glUniform2i.sig = 'viii';

	var _glUniform3i = _emscripten_glUniform3i;
	_glUniform3i.sig = 'viiii';

	var _glUniform4i = _emscripten_glUniform4i;
	_glUniform4i.sig = 'viiiii';

	var _glUniform1iv = _emscripten_glUniform1iv;
	_glUniform1iv.sig = 'viip';

	var _glUniform2iv = _emscripten_glUniform2iv;
	_glUniform2iv.sig = 'viip';

	var _glUniform3iv = _emscripten_glUniform3iv;
	_glUniform3iv.sig = 'viip';

	var _glUniform4iv = _emscripten_glUniform4iv;
	_glUniform4iv.sig = 'viip';

	var _glUniform1fv = _emscripten_glUniform1fv;
	_glUniform1fv.sig = 'viip';

	var _glUniform2fv = _emscripten_glUniform2fv;
	_glUniform2fv.sig = 'viip';

	var _glUniform3fv = _emscripten_glUniform3fv;
	_glUniform3fv.sig = 'viip';

	var _glUniform4fv = _emscripten_glUniform4fv;
	_glUniform4fv.sig = 'viip';

	var _glUniformMatrix2fv = _emscripten_glUniformMatrix2fv;
	_glUniformMatrix2fv.sig = 'viiip';

	var _glUniformMatrix3fv = _emscripten_glUniformMatrix3fv;
	_glUniformMatrix3fv.sig = 'viiip';

	var _glUniformMatrix4fv = _emscripten_glUniformMatrix4fv;
	_glUniformMatrix4fv.sig = 'viiip';

	var _glBindBuffer = _emscripten_glBindBuffer;
	_glBindBuffer.sig = 'vii';

	var _glVertexAttrib1fv = _emscripten_glVertexAttrib1fv;
	_glVertexAttrib1fv.sig = 'vip';

	var _glVertexAttrib2fv = _emscripten_glVertexAttrib2fv;
	_glVertexAttrib2fv.sig = 'vip';

	var _glVertexAttrib3fv = _emscripten_glVertexAttrib3fv;
	_glVertexAttrib3fv.sig = 'vip';

	var _glVertexAttrib4fv = _emscripten_glVertexAttrib4fv;
	_glVertexAttrib4fv.sig = 'vip';

	var _glGetAttribLocation = _emscripten_glGetAttribLocation;
	_glGetAttribLocation.sig = 'iip';

	var _glGetActiveAttrib = _emscripten_glGetActiveAttrib;
	_glGetActiveAttrib.sig = 'viiipppp';

	var _glGetActiveUniform = _emscripten_glGetActiveUniform;
	_glGetActiveUniform.sig = 'viiipppp';

	var _glCreateShader = _emscripten_glCreateShader;
	_glCreateShader.sig = 'ii';

	var _glDeleteShader = _emscripten_glDeleteShader;
	_glDeleteShader.sig = 'vi';

	var _glGetAttachedShaders = _emscripten_glGetAttachedShaders;
	_glGetAttachedShaders.sig = 'viipp';

	var _glShaderSource = _emscripten_glShaderSource;
	_glShaderSource.sig = 'viipp';

	var _glGetShaderSource = _emscripten_glGetShaderSource;
	_glGetShaderSource.sig = 'viipp';

	var _glCompileShader = _emscripten_glCompileShader;
	_glCompileShader.sig = 'vi';

	var _glGetShaderInfoLog = _emscripten_glGetShaderInfoLog;
	_glGetShaderInfoLog.sig = 'viipp';

	var _glGetShaderiv = _emscripten_glGetShaderiv;
	_glGetShaderiv.sig = 'viip';

	var _glGetProgramiv = _emscripten_glGetProgramiv;
	_glGetProgramiv.sig = 'viip';

	var _glIsShader = _emscripten_glIsShader;
	_glIsShader.sig = 'ii';

	var _glCreateProgram = _emscripten_glCreateProgram;
	_glCreateProgram.sig = 'i';

	var _glDeleteProgram = _emscripten_glDeleteProgram;
	_glDeleteProgram.sig = 'vi';

	var _glAttachShader = _emscripten_glAttachShader;
	_glAttachShader.sig = 'vii';

	var _glDetachShader = _emscripten_glDetachShader;
	_glDetachShader.sig = 'vii';

	var _glGetShaderPrecisionFormat = _emscripten_glGetShaderPrecisionFormat;
	_glGetShaderPrecisionFormat.sig = 'viipp';

	var _glLinkProgram = _emscripten_glLinkProgram;
	_glLinkProgram.sig = 'vi';

	var _glGetProgramInfoLog = _emscripten_glGetProgramInfoLog;
	_glGetProgramInfoLog.sig = 'viipp';

	var _glUseProgram = _emscripten_glUseProgram;
	_glUseProgram.sig = 'vi';

	var _glValidateProgram = _emscripten_glValidateProgram;
	_glValidateProgram.sig = 'vi';

	var _glIsProgram = _emscripten_glIsProgram;
	_glIsProgram.sig = 'ii';

	var _glBindAttribLocation = _emscripten_glBindAttribLocation;
	_glBindAttribLocation.sig = 'viip';

	var _glBindFramebuffer = _emscripten_glBindFramebuffer;
	_glBindFramebuffer.sig = 'vii';

	var _glGenFramebuffers = _emscripten_glGenFramebuffers;
	_glGenFramebuffers.sig = 'vip';

	var _glDeleteFramebuffers = _emscripten_glDeleteFramebuffers;
	_glDeleteFramebuffers.sig = 'vip';

	var _glFramebufferRenderbuffer = _emscripten_glFramebufferRenderbuffer;
	_glFramebufferRenderbuffer.sig = 'viiii';

	var _glFramebufferTexture2D = _emscripten_glFramebufferTexture2D;
	_glFramebufferTexture2D.sig = 'viiiii';

	var _glGetFramebufferAttachmentParameteriv =
		_emscripten_glGetFramebufferAttachmentParameteriv;
	_glGetFramebufferAttachmentParameteriv.sig = 'viiip';

	var _glIsFramebuffer = _emscripten_glIsFramebuffer;
	_glIsFramebuffer.sig = 'ii';

	var _glGenVertexArrays = _emscripten_glGenVertexArrays;
	_glGenVertexArrays.sig = 'vip';

	var _glDeleteVertexArrays = _emscripten_glDeleteVertexArrays;
	_glDeleteVertexArrays.sig = 'vip';

	var _glBindVertexArray = _emscripten_glBindVertexArray;
	_glBindVertexArray.sig = 'vi';

	var _glIsVertexArray = _emscripten_glIsVertexArray;
	_glIsVertexArray.sig = 'ii';

	var _emscripten_glVertexPointer = (size, type, stride, ptr) =>
		abort(
			'Legacy GL function (glVertexPointer) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.'
		);
	_emscripten_glVertexPointer.sig = 'viiip';

	var _glVertexPointer = _emscripten_glVertexPointer;
	_glVertexPointer.sig = 'viiip';

	var _emscripten_glMatrixMode = () =>
		abort(
			'Legacy GL function (glMatrixMode) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.'
		);
	_emscripten_glMatrixMode.sig = 'vi';

	var _glMatrixMode = _emscripten_glMatrixMode;
	_glMatrixMode.sig = 'vi';

	var _emscripten_glBegin = () =>
		abort(
			'Legacy GL function (glBegin) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.'
		);
	_emscripten_glBegin.sig = 'vi';

	var _glBegin = _emscripten_glBegin;
	_glBegin.sig = 'vi';

	var _emscripten_glLoadIdentity = () =>
		abort(
			'Legacy GL function (glLoadIdentity) called. If you want legacy GL emulation, you need to compile with -sLEGACY_GL_EMULATION to enable legacy GL emulation.'
		);
	_emscripten_glLoadIdentity.sig = 'v';

	var _glLoadIdentity = _emscripten_glLoadIdentity;
	_glLoadIdentity.sig = 'v';

	var _glGenVertexArraysOES = _emscripten_glGenVertexArrays;
	_glGenVertexArraysOES.sig = 'vip';

	var _glDeleteVertexArraysOES = _emscripten_glDeleteVertexArrays;
	_glDeleteVertexArraysOES.sig = 'vip';

	var _glBindVertexArrayOES = _emscripten_glBindVertexArray;
	_glBindVertexArrayOES.sig = 'vi';

	var _glIsVertexArrayOES = _emscripten_glIsVertexArray;
	_glIsVertexArrayOES.sig = 'ii';

	var _glVertexAttribPointer = _emscripten_glVertexAttribPointer;
	_glVertexAttribPointer.sig = 'viiiiip';

	var _glEnableVertexAttribArray = _emscripten_glEnableVertexAttribArray;
	_glEnableVertexAttribArray.sig = 'vi';

	var _glDisableVertexAttribArray = _emscripten_glDisableVertexAttribArray;
	_glDisableVertexAttribArray.sig = 'vi';

	var _glDrawArrays = _emscripten_glDrawArrays;
	_glDrawArrays.sig = 'viii';

	var _glDrawElements = _emscripten_glDrawElements;
	_glDrawElements.sig = 'viiip';

	var _glShaderBinary = _emscripten_glShaderBinary;
	_glShaderBinary.sig = 'vipipi';

	var _glReleaseShaderCompiler = _emscripten_glReleaseShaderCompiler;
	_glReleaseShaderCompiler.sig = 'v';

	var _glGetError = _emscripten_glGetError;
	_glGetError.sig = 'i';

	var _glVertexAttribDivisor = _emscripten_glVertexAttribDivisor;
	_glVertexAttribDivisor.sig = 'vii';

	var _glDrawArraysInstanced = _emscripten_glDrawArraysInstanced;
	_glDrawArraysInstanced.sig = 'viiii';

	var _glDrawElementsInstanced = _emscripten_glDrawElementsInstanced;
	_glDrawElementsInstanced.sig = 'viiipi';

	var _emscripten_glVertexAttribDivisorNV = _emscripten_glVertexAttribDivisor;

	var _glVertexAttribDivisorNV = _emscripten_glVertexAttribDivisor;

	var _emscripten_glDrawArraysInstancedNV = _emscripten_glDrawArraysInstanced;

	var _glDrawArraysInstancedNV = _emscripten_glDrawArraysInstanced;

	var _emscripten_glDrawElementsInstancedNV =
		_emscripten_glDrawElementsInstanced;

	var _glDrawElementsInstancedNV = _emscripten_glDrawElementsInstanced;

	var _emscripten_glVertexAttribDivisorEXT =
		_emscripten_glVertexAttribDivisor;

	var _glVertexAttribDivisorEXT = _emscripten_glVertexAttribDivisor;

	var _emscripten_glDrawArraysInstancedEXT =
		_emscripten_glDrawArraysInstanced;

	var _glDrawArraysInstancedEXT = _emscripten_glDrawArraysInstanced;

	var _emscripten_glDrawElementsInstancedEXT =
		_emscripten_glDrawElementsInstanced;

	var _glDrawElementsInstancedEXT = _emscripten_glDrawElementsInstanced;

	var _emscripten_glVertexAttribDivisorARB =
		_emscripten_glVertexAttribDivisor;

	var _glVertexAttribDivisorARB = _emscripten_glVertexAttribDivisor;

	var _emscripten_glDrawArraysInstancedARB =
		_emscripten_glDrawArraysInstanced;

	var _glDrawArraysInstancedARB = _emscripten_glDrawArraysInstanced;

	var _emscripten_glDrawElementsInstancedARB =
		_emscripten_glDrawElementsInstanced;

	var _glDrawElementsInstancedARB = _emscripten_glDrawElementsInstanced;

	var _glVertexAttribDivisorANGLE = _emscripten_glVertexAttribDivisor;

	var _glDrawArraysInstancedANGLE = _emscripten_glDrawArraysInstanced;

	var _glDrawElementsInstancedANGLE = _emscripten_glDrawElementsInstanced;

	var _glDrawBuffers = _emscripten_glDrawBuffers;
	_glDrawBuffers.sig = 'vip';

	var _emscripten_glDrawBuffersEXT = _emscripten_glDrawBuffers;

	var _glDrawBuffersEXT = _emscripten_glDrawBuffers;

	var _glDrawBuffersWEBGL = _emscripten_glDrawBuffers;

	var _glColorMask = _emscripten_glColorMask;
	_glColorMask.sig = 'viiii';

	var _glDepthMask = _emscripten_glDepthMask;
	_glDepthMask.sig = 'vi';

	var _glSampleCoverage = _emscripten_glSampleCoverage;
	_glSampleCoverage.sig = 'vfi';

	var _emscripten_glMultiDrawArraysWEBGL = (
		mode,
		firsts,
		counts,
		drawcount
	) => {
		GLctx.multiDrawWebgl['multiDrawArraysWEBGL'](
			mode,
			HEAP32,
			firsts >> 2,
			HEAP32,
			counts >> 2,
			drawcount
		);
	};
	_emscripten_glMultiDrawArraysWEBGL.sig = 'vippi';
	var _emscripten_glMultiDrawArrays = _emscripten_glMultiDrawArraysWEBGL;
	_emscripten_glMultiDrawArrays.sig = 'vippi';

	var _glMultiDrawArrays = _emscripten_glMultiDrawArraysWEBGL;
	_glMultiDrawArrays.sig = 'vippi';

	var _emscripten_glMultiDrawArraysANGLE = _emscripten_glMultiDrawArraysWEBGL;

	var _glMultiDrawArraysANGLE = _emscripten_glMultiDrawArraysWEBGL;

	var _glMultiDrawArraysWEBGL = _emscripten_glMultiDrawArraysWEBGL;

	var _emscripten_glMultiDrawArraysInstancedWEBGL = (
		mode,
		firsts,
		counts,
		instanceCounts,
		drawcount
	) => {
		GLctx.multiDrawWebgl['multiDrawArraysInstancedWEBGL'](
			mode,
			HEAP32,
			firsts >> 2,
			HEAP32,
			counts >> 2,
			HEAP32,
			instanceCounts >> 2,
			drawcount
		);
	};
	_emscripten_glMultiDrawArraysInstancedWEBGL.sig = 'vipppi';
	var _emscripten_glMultiDrawArraysInstancedANGLE =
		_emscripten_glMultiDrawArraysInstancedWEBGL;

	var _glMultiDrawArraysInstancedANGLE =
		_emscripten_glMultiDrawArraysInstancedWEBGL;

	var _glMultiDrawArraysInstancedWEBGL =
		_emscripten_glMultiDrawArraysInstancedWEBGL;

	var _emscripten_glMultiDrawElementsWEBGL = (
		mode,
		counts,
		type,
		offsets,
		drawcount
	) => {
		GLctx.multiDrawWebgl['multiDrawElementsWEBGL'](
			mode,
			HEAP32,
			counts >> 2,
			type,
			HEAP32,
			offsets >> 2,
			drawcount
		);
	};
	_emscripten_glMultiDrawElementsWEBGL.sig = 'vipipi';
	var _emscripten_glMultiDrawElements = _emscripten_glMultiDrawElementsWEBGL;
	_emscripten_glMultiDrawElements.sig = 'vipipi';

	var _glMultiDrawElements = _emscripten_glMultiDrawElementsWEBGL;
	_glMultiDrawElements.sig = 'vipipi';

	var _emscripten_glMultiDrawElementsANGLE =
		_emscripten_glMultiDrawElementsWEBGL;

	var _glMultiDrawElementsANGLE = _emscripten_glMultiDrawElementsWEBGL;

	var _glMultiDrawElementsWEBGL = _emscripten_glMultiDrawElementsWEBGL;

	var _emscripten_glMultiDrawElementsInstancedWEBGL = (
		mode,
		counts,
		type,
		offsets,
		instanceCounts,
		drawcount
	) => {
		GLctx.multiDrawWebgl['multiDrawElementsInstancedWEBGL'](
			mode,
			HEAP32,
			counts >> 2,
			type,
			HEAP32,
			offsets >> 2,
			HEAP32,
			instanceCounts >> 2,
			drawcount
		);
	};
	_emscripten_glMultiDrawElementsInstancedWEBGL.sig = 'vipippi';
	var _emscripten_glMultiDrawElementsInstancedANGLE =
		_emscripten_glMultiDrawElementsInstancedWEBGL;

	var _glMultiDrawElementsInstancedANGLE =
		_emscripten_glMultiDrawElementsInstancedWEBGL;

	var _glMultiDrawElementsInstancedWEBGL =
		_emscripten_glMultiDrawElementsInstancedWEBGL;

	var _glPolygonOffsetClampEXT = _emscripten_glPolygonOffsetClampEXT;

	var _glClipControlEXT = _emscripten_glClipControlEXT;

	var _glPolygonModeWEBGL = _emscripten_glPolygonModeWEBGL;

	var _glFinish = _emscripten_glFinish;
	_glFinish.sig = 'v';

	var _glFlush = _emscripten_glFlush;
	_glFlush.sig = 'v';

	var _emscripten_glClearDepth = (x0) => GLctx.clearDepth(x0);
	_emscripten_glClearDepth.sig = 'vd';

	var _glClearDepth = _emscripten_glClearDepth;
	_glClearDepth.sig = 'vd';

	var _glClearDepthf = _emscripten_glClearDepthf;
	_glClearDepthf.sig = 'vf';

	var _glDepthFunc = _emscripten_glDepthFunc;
	_glDepthFunc.sig = 'vi';

	var _glEnable = _emscripten_glEnable;
	_glEnable.sig = 'vi';

	var _glDisable = _emscripten_glDisable;
	_glDisable.sig = 'vi';

	var _glFrontFace = _emscripten_glFrontFace;
	_glFrontFace.sig = 'vi';

	var _glCullFace = _emscripten_glCullFace;
	_glCullFace.sig = 'vi';

	var _glClear = _emscripten_glClear;
	_glClear.sig = 'vi';

	var _glLineWidth = _emscripten_glLineWidth;
	_glLineWidth.sig = 'vf';

	var _glClearStencil = _emscripten_glClearStencil;
	_glClearStencil.sig = 'vi';

	var _glStencilMask = _emscripten_glStencilMask;
	_glStencilMask.sig = 'vi';

	var _glCheckFramebufferStatus = _emscripten_glCheckFramebufferStatus;
	_glCheckFramebufferStatus.sig = 'ii';

	var _glGenerateMipmap = _emscripten_glGenerateMipmap;
	_glGenerateMipmap.sig = 'vi';

	var _glActiveTexture = _emscripten_glActiveTexture;
	_glActiveTexture.sig = 'vi';

	var _glBlendEquation = _emscripten_glBlendEquation;
	_glBlendEquation.sig = 'vi';

	var _glIsEnabled = _emscripten_glIsEnabled;
	_glIsEnabled.sig = 'ii';

	var _glBlendFunc = _emscripten_glBlendFunc;
	_glBlendFunc.sig = 'vii';

	var _glBlendEquationSeparate = _emscripten_glBlendEquationSeparate;
	_glBlendEquationSeparate.sig = 'vii';

	var _emscripten_glDepthRange = (x0, x1) => GLctx.depthRange(x0, x1);
	_emscripten_glDepthRange.sig = 'vdd';

	var _glDepthRange = _emscripten_glDepthRange;
	_glDepthRange.sig = 'vdd';

	var _glDepthRangef = _emscripten_glDepthRangef;
	_glDepthRangef.sig = 'vff';

	var _glStencilMaskSeparate = _emscripten_glStencilMaskSeparate;
	_glStencilMaskSeparate.sig = 'vii';

	var _glHint = _emscripten_glHint;
	_glHint.sig = 'vii';

	var _glPolygonOffset = _emscripten_glPolygonOffset;
	_glPolygonOffset.sig = 'vff';

	var _glVertexAttrib1f = _emscripten_glVertexAttrib1f;
	_glVertexAttrib1f.sig = 'vif';

	var _glTexParameteri = _emscripten_glTexParameteri;
	_glTexParameteri.sig = 'viii';

	var _glTexParameterf = _emscripten_glTexParameterf;
	_glTexParameterf.sig = 'viif';

	var _glVertexAttrib2f = _emscripten_glVertexAttrib2f;
	_glVertexAttrib2f.sig = 'viff';

	var _glStencilFunc = _emscripten_glStencilFunc;
	_glStencilFunc.sig = 'viii';

	var _glStencilOp = _emscripten_glStencilOp;
	_glStencilOp.sig = 'viii';

	var _glViewport = _emscripten_glViewport;
	_glViewport.sig = 'viiii';

	var _glClearColor = _emscripten_glClearColor;
	_glClearColor.sig = 'vffff';

	var _glScissor = _emscripten_glScissor;
	_glScissor.sig = 'viiii';

	var _glVertexAttrib3f = _emscripten_glVertexAttrib3f;
	_glVertexAttrib3f.sig = 'vifff';

	var _glRenderbufferStorage = _emscripten_glRenderbufferStorage;
	_glRenderbufferStorage.sig = 'viiii';

	var _glBlendFuncSeparate = _emscripten_glBlendFuncSeparate;
	_glBlendFuncSeparate.sig = 'viiii';

	var _glBlendColor = _emscripten_glBlendColor;
	_glBlendColor.sig = 'vffff';

	var _glStencilFuncSeparate = _emscripten_glStencilFuncSeparate;
	_glStencilFuncSeparate.sig = 'viiii';

	var _glStencilOpSeparate = _emscripten_glStencilOpSeparate;
	_glStencilOpSeparate.sig = 'viiii';

	var _glVertexAttrib4f = _emscripten_glVertexAttrib4f;
	_glVertexAttrib4f.sig = 'viffff';

	var _glCopyTexImage2D = _emscripten_glCopyTexImage2D;
	_glCopyTexImage2D.sig = 'viiiiiiii';

	var _glCopyTexSubImage2D = _emscripten_glCopyTexSubImage2D;
	_glCopyTexSubImage2D.sig = 'viiiiiiii';

	var writeGLArray = (arr, dst, dstLength, heapType) => {
		var len = arr.length;
		var writeLength = dstLength < len ? dstLength : len;
		var heap = heapType ? HEAPF32 : HEAP32;
		// Works because HEAPF32 and HEAP32 have the same bytes-per-element
		dst = dst >> 2;
		for (var i = 0; i < writeLength; ++i) {
			heap[dst + i] = arr[i];
		}
		return len;
	};

	var webglPowerPreferences = ['default', 'low-power', 'high-performance'];

	var _emscripten_webgl_do_create_context = (target, attributes) => {
		var attr32 = attributes >> 2;
		var powerPreference = HEAP32[attr32 + (8 >> 2)];
		var contextAttributes = {
			alpha: !!HEAP8[attributes + 0],
			depth: !!HEAP8[attributes + 1],
			stencil: !!HEAP8[attributes + 2],
			antialias: !!HEAP8[attributes + 3],
			premultipliedAlpha: !!HEAP8[attributes + 4],
			preserveDrawingBuffer: !!HEAP8[attributes + 5],
			powerPreference: webglPowerPreferences[powerPreference],
			failIfMajorPerformanceCaveat: !!HEAP8[attributes + 12],
			// The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
			majorVersion: HEAP32[attr32 + (16 >> 2)],
			minorVersion: HEAP32[attr32 + (20 >> 2)],
			enableExtensionsByDefault: HEAP8[attributes + 24],
			explicitSwapControl: HEAP8[attributes + 25],
			proxyContextToMainThread: HEAP32[attr32 + (28 >> 2)],
			renderViaOffscreenBackBuffer: HEAP8[attributes + 32],
		};

		var canvas = findCanvasEventTarget(target);

		if (!canvas) {
			return 0;
		}

		if (contextAttributes.explicitSwapControl) {
			return 0;
		}

		var contextHandle = GL.createContext(canvas, contextAttributes);
		return contextHandle;
	};
	_emscripten_webgl_do_create_context.sig = 'ppp';
	var _emscripten_webgl_create_context = _emscripten_webgl_do_create_context;
	_emscripten_webgl_create_context.sig = 'ppp';

	var _emscripten_webgl_do_get_current_context = () =>
		GL.currentContext ? GL.currentContext.handle : 0;
	_emscripten_webgl_do_get_current_context.sig = 'p';
	var _emscripten_webgl_get_current_context =
		_emscripten_webgl_do_get_current_context;
	_emscripten_webgl_get_current_context.sig = 'p';

	var _emscripten_webgl_do_commit_frame = () => {
		if (!GL.currentContext || !GL.currentContext.GLctx) {
			return -3;
		}

		if (!GL.currentContext.attributes.explicitSwapControl) {
			return -3;
		}
		// We would do GL.currentContext.GLctx.commit(); here, but the current implementation
		// in browsers has removed it - swap is implicit, so this function is a no-op for now
		// (until/unless the spec changes).
		return 0;
	};
	_emscripten_webgl_do_commit_frame.sig = 'i';
	var _emscripten_webgl_commit_frame = _emscripten_webgl_do_commit_frame;
	_emscripten_webgl_commit_frame.sig = 'i';

	var _emscripten_webgl_make_context_current = (contextHandle) => {
		var success = GL.makeContextCurrent(contextHandle);
		return success ? 0 : -5;
	};
	_emscripten_webgl_make_context_current.sig = 'ip';

	var _emscripten_webgl_get_drawing_buffer_size = (
		contextHandle,
		width,
		height
	) => {
		var GLContext = GL.getContext(contextHandle);

		if (!GLContext || !GLContext.GLctx || !width || !height) {
			return -5;
		}
		HEAP32[width >> 2] = GLContext.GLctx.drawingBufferWidth;
		HEAP32[height >> 2] = GLContext.GLctx.drawingBufferHeight;
		return 0;
	};
	_emscripten_webgl_get_drawing_buffer_size.sig = 'ippp';

	var _emscripten_webgl_get_context_attributes = (c, a) => {
		if (!a) return -5;
		c = GL.contexts[c];
		if (!c) return -3;
		var t = c.GLctx?.getContextAttributes();
		if (!t) return -3;

		HEAP8[a] = t.alpha;
		HEAP8[a + 1] = t.depth;
		HEAP8[a + 2] = t.stencil;
		HEAP8[a + 3] = t.antialias;
		HEAP8[a + 4] = t.premultipliedAlpha;
		HEAP8[a + 5] = t.preserveDrawingBuffer;
		var power =
			t['powerPreference'] &&
			webglPowerPreferences.indexOf(t['powerPreference']);
		HEAP32[(a + 8) >> 2] = power;
		HEAP8[a + 12] = t.failIfMajorPerformanceCaveat;
		HEAP32[(a + 16) >> 2] = c.version;
		HEAP32[(a + 20) >> 2] = 0;
		HEAP8[a + 24] = c.attributes.enableExtensionsByDefault;
		return 0;
	};
	_emscripten_webgl_get_context_attributes.sig = 'ipp';

	var _emscripten_webgl_destroy_context = (contextHandle) => {
		if (GL.currentContext == contextHandle) GL.currentContext = 0;
		GL.deleteContext(contextHandle);
	};
	_emscripten_webgl_destroy_context.sig = 'ip';

	var _emscripten_webgl_enable_extension = (contextHandle, extension) => {
		var context = GL.getContext(contextHandle);
		var extString = UTF8ToString(extension);
		if (extString.startsWith('GL_')) extString = extString.slice(3); // Allow enabling extensions both with "GL_" prefix and without.

		// Switch-board that pulls in code for all GL extensions, even if those are not used :/
		// Build with -sGL_SUPPORT_SIMPLE_ENABLE_EXTENSIONS=0 to avoid this.

		// Obtain function entry points to WebGL 1 extension related functions.
		if (extString == 'ANGLE_instanced_arrays')
			webgl_enable_ANGLE_instanced_arrays(GLctx);
		if (extString == 'OES_vertex_array_object')
			webgl_enable_OES_vertex_array_object(GLctx);
		if (extString == 'WEBGL_draw_buffers')
			webgl_enable_WEBGL_draw_buffers(GLctx);

		if (extString == 'WEBGL_multi_draw')
			webgl_enable_WEBGL_multi_draw(GLctx);
		if (extString == 'EXT_polygon_offset_clamp')
			webgl_enable_EXT_polygon_offset_clamp(GLctx);
		if (extString == 'EXT_clip_control')
			webgl_enable_EXT_clip_control(GLctx);
		if (extString == 'WEBGL_polygon_mode')
			webgl_enable_WEBGL_polygon_mode(GLctx);

		var ext = context.GLctx.getExtension(extString);
		return !!ext;
	};
	_emscripten_webgl_enable_extension.sig = 'ipp';

	var _emscripten_supports_offscreencanvas = () =>
		// TODO: Add a new build mode, e.g. OFFSCREENCANVAS_SUPPORT=2, which
		// necessitates OffscreenCanvas support at build time, and "return 1;" here in that build mode.
		0;
	_emscripten_supports_offscreencanvas.sig = 'i';

	var registerWebGlEventCallback = (
		target,
		userData,
		useCapture,
		callbackfunc,
		eventTypeId,
		eventTypeString,
		targetThread
	) => {
		var webGlEventHandlerFunc = (e = event) => {
			if (getWasmTableEntry(callbackfunc)(eventTypeId, 0, userData))
				e.preventDefault();
		};

		var eventHandler = {
			target: findEventTarget(target),
			eventTypeString,
			callbackfunc,
			handlerFunc: webGlEventHandlerFunc,
			useCapture,
		};
		JSEvents.registerOrRemoveHandler(eventHandler);
	};

	var _emscripten_set_webglcontextlost_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		registerWebGlEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			31,
			'webglcontextlost',
			targetThread
		);
		return 0;
	};
	_emscripten_set_webglcontextlost_callback_on_thread.sig = 'ippipp';

	var _emscripten_set_webglcontextrestored_callback_on_thread = (
		target,
		userData,
		useCapture,
		callbackfunc,
		targetThread
	) => {
		registerWebGlEventCallback(
			target,
			userData,
			useCapture,
			callbackfunc,
			32,
			'webglcontextrestored',
			targetThread
		);
		return 0;
	};
	_emscripten_set_webglcontextrestored_callback_on_thread.sig = 'ippipp';

	var _emscripten_is_webgl_context_lost = (contextHandle) =>
		!GL.contexts[contextHandle] ||
		GL.contexts[contextHandle].GLctx.isContextLost();
	_emscripten_is_webgl_context_lost.sig = 'ip';

	var _emscripten_webgl_get_supported_extensions = () =>
		stringToNewUTF8(GLctx.getSupportedExtensions().join(' '));
	_emscripten_webgl_get_supported_extensions.sig = 'p';

	var _emscripten_webgl_get_program_parameter_d = (program, param) =>
		GLctx.getProgramParameter(GL.programs[program], param);
	_emscripten_webgl_get_program_parameter_d.sig = 'dii';

	var _emscripten_webgl_get_program_info_log_utf8 = (program) =>
		stringToNewUTF8(GLctx.getProgramInfoLog(GL.programs[program]));
	_emscripten_webgl_get_program_info_log_utf8.sig = 'pi';

	var _emscripten_webgl_get_shader_parameter_d = (shader, param) =>
		GLctx.getShaderParameter(GL.shaders[shader], param);
	_emscripten_webgl_get_shader_parameter_d.sig = 'dii';

	var _emscripten_webgl_get_shader_info_log_utf8 = (shader) =>
		stringToNewUTF8(GLctx.getShaderInfoLog(GL.shaders[shader]));
	_emscripten_webgl_get_shader_info_log_utf8.sig = 'pi';

	var _emscripten_webgl_get_shader_source_utf8 = (shader) =>
		stringToNewUTF8(GLctx.getShaderSource(GL.shaders[shader]));
	_emscripten_webgl_get_shader_source_utf8.sig = 'pi';

	var _emscripten_webgl_get_vertex_attrib_d = (index, param) =>
		GLctx.getVertexAttrib(index, param);
	_emscripten_webgl_get_vertex_attrib_d.sig = 'dii';

	var _emscripten_webgl_get_vertex_attrib_o = (index, param) => {
		var obj = GLctx.getVertexAttrib(index, param);
		return obj?.name;
	};
	_emscripten_webgl_get_vertex_attrib_o.sig = 'iii';

	var _emscripten_webgl_get_vertex_attrib_v = (
		index,
		param,
		dst,
		dstLength,
		dstType
	) =>
		writeGLArray(
			GLctx.getVertexAttrib(index, param),
			dst,
			dstLength,
			dstType
		);
	_emscripten_webgl_get_vertex_attrib_v.sig = 'iiipii';

	var _emscripten_webgl_get_uniform_d = (program, location) =>
		GLctx.getUniform(
			GL.programs[program],
			webglGetUniformLocation(location)
		);
	_emscripten_webgl_get_uniform_d.sig = 'dii';

	var _emscripten_webgl_get_uniform_v = (
		program,
		location,
		dst,
		dstLength,
		dstType
	) =>
		writeGLArray(
			GLctx.getUniform(
				GL.programs[program],
				webglGetUniformLocation(location)
			),
			dst,
			dstLength,
			dstType
		);
	_emscripten_webgl_get_uniform_v.sig = 'iiipii';

	var _emscripten_webgl_get_parameter_v = (param, dst, dstLength, dstType) =>
		writeGLArray(GLctx.getParameter(param), dst, dstLength, dstType);
	_emscripten_webgl_get_parameter_v.sig = 'iipii';

	var _emscripten_webgl_get_parameter_d = (param) =>
		GLctx.getParameter(param);
	_emscripten_webgl_get_parameter_d.sig = 'di';

	var _emscripten_webgl_get_parameter_o = (param) => {
		var obj = GLctx.getParameter(param);
		return obj?.name;
	};
	_emscripten_webgl_get_parameter_o.sig = 'ii';

	var _emscripten_webgl_get_parameter_utf8 = (param) =>
		stringToNewUTF8(GLctx.getParameter(param));
	_emscripten_webgl_get_parameter_utf8.sig = 'pi';

	var _emscripten_webgl_get_parameter_i64v = (param, dst) =>
		writeI53ToI64(dst, GLctx.getParameter(param));
	_emscripten_webgl_get_parameter_i64v.sig = 'vip';

	var _glutPostRedisplay = () => {
		if (GLUT.displayFunc && !GLUT.requestedAnimationFrame) {
			GLUT.requestedAnimationFrame = true;
			MainLoop.requestAnimationFrame(() => {
				GLUT.requestedAnimationFrame = false;
				MainLoop.runIter(() => getWasmTableEntry(GLUT.displayFunc)());
			});
		}
	};
	_glutPostRedisplay.sig = 'v';

	var GLUT = {
		initTime: null,
		idleFunc: null,
		displayFunc: null,
		keyboardFunc: null,
		keyboardUpFunc: null,
		specialFunc: null,
		specialUpFunc: null,
		reshapeFunc: null,
		motionFunc: null,
		passiveMotionFunc: null,
		mouseFunc: null,
		buttons: 0,
		modifiers: 0,
		initWindowWidth: 256,
		initWindowHeight: 256,
		initDisplayMode: 18,
		windowX: 0,
		windowY: 0,
		windowWidth: 0,
		windowHeight: 0,
		requestedAnimationFrame: false,
		saveModifiers: (event) => {
			GLUT.modifiers = 0;
			if (event['shiftKey']) GLUT.modifiers += 1; /* GLUT_ACTIVE_SHIFT */
			if (event['ctrlKey']) GLUT.modifiers += 2; /* GLUT_ACTIVE_CTRL */
			if (event['altKey']) GLUT.modifiers += 4; /* GLUT_ACTIVE_ALT */
		},
		onMousemove: (event) => {
			/* Send motion event only if the motion changed, prevents
			 * spamming our app with uncessary callback call. It does happen in
			 * Chrome on Windows.
			 */
			var lastX = Browser.mouseX;
			var lastY = Browser.mouseY;
			Browser.calculateMouseEvent(event);
			var newX = Browser.mouseX;
			var newY = Browser.mouseY;
			if (newX == lastX && newY == lastY) return;

			if (
				GLUT.buttons == 0 &&
				event.target == Browser.getCanvas() &&
				GLUT.passiveMotionFunc
			) {
				event.preventDefault();
				GLUT.saveModifiers(event);
				getWasmTableEntry(GLUT.passiveMotionFunc)(lastX, lastY);
			} else if (GLUT.buttons != 0 && GLUT.motionFunc) {
				event.preventDefault();
				GLUT.saveModifiers(event);
				getWasmTableEntry(GLUT.motionFunc)(lastX, lastY);
			}
		},
		getSpecialKey: (keycode) => {
			var key = null;
			switch (keycode) {
				case 8:
					key = 120 /* backspace */;
					break;
				case 46:
					key = 111 /* delete */;
					break;

				case 0x70 /*DOM_VK_F1*/:
					key = 1 /* GLUT_KEY_F1 */;
					break;
				case 0x71 /*DOM_VK_F2*/:
					key = 2 /* GLUT_KEY_F2 */;
					break;
				case 0x72 /*DOM_VK_F3*/:
					key = 3 /* GLUT_KEY_F3 */;
					break;
				case 0x73 /*DOM_VK_F4*/:
					key = 4 /* GLUT_KEY_F4 */;
					break;
				case 0x74 /*DOM_VK_F5*/:
					key = 5 /* GLUT_KEY_F5 */;
					break;
				case 0x75 /*DOM_VK_F6*/:
					key = 6 /* GLUT_KEY_F6 */;
					break;
				case 0x76 /*DOM_VK_F7*/:
					key = 7 /* GLUT_KEY_F7 */;
					break;
				case 0x77 /*DOM_VK_F8*/:
					key = 8 /* GLUT_KEY_F8 */;
					break;
				case 0x78 /*DOM_VK_F9*/:
					key = 9 /* GLUT_KEY_F9 */;
					break;
				case 0x79 /*DOM_VK_F10*/:
					key = 10 /* GLUT_KEY_F10 */;
					break;
				case 0x7a /*DOM_VK_F11*/:
					key = 11 /* GLUT_KEY_F11 */;
					break;
				case 0x7b /*DOM_VK_F12*/:
					key = 12 /* GLUT_KEY_F12 */;
					break;
				case 0x25 /*DOM_VK_LEFT*/:
					key = 100 /* GLUT_KEY_LEFT */;
					break;
				case 0x26 /*DOM_VK_UP*/:
					key = 101 /* GLUT_KEY_UP */;
					break;
				case 0x27 /*DOM_VK_RIGHT*/:
					key = 102 /* GLUT_KEY_RIGHT */;
					break;
				case 0x28 /*DOM_VK_DOWN*/:
					key = 103 /* GLUT_KEY_DOWN */;
					break;
				case 0x21 /*DOM_VK_PAGE_UP*/:
					key = 104 /* GLUT_KEY_PAGE_UP */;
					break;
				case 0x22 /*DOM_VK_PAGE_DOWN*/:
					key = 105 /* GLUT_KEY_PAGE_DOWN */;
					break;
				case 0x24 /*DOM_VK_HOME*/:
					key = 106 /* GLUT_KEY_HOME */;
					break;
				case 0x23 /*DOM_VK_END*/:
					key = 107 /* GLUT_KEY_END */;
					break;
				case 0x2d /*DOM_VK_INSERT*/:
					key = 108 /* GLUT_KEY_INSERT */;
					break;

				case 16 /*DOM_VK_SHIFT*/:
				case 0x05 /*DOM_VK_LEFT_SHIFT*/:
					key = 112 /* GLUT_KEY_SHIFT_L */;
					break;
				case 0x06 /*DOM_VK_RIGHT_SHIFT*/:
					key = 113 /* GLUT_KEY_SHIFT_R */;
					break;

				case 17 /*DOM_VK_CONTROL*/:
				case 0x03 /*DOM_VK_LEFT_CONTROL*/:
					key = 114 /* GLUT_KEY_CONTROL_L */;
					break;
				case 0x04 /*DOM_VK_RIGHT_CONTROL*/:
					key = 115 /* GLUT_KEY_CONTROL_R */;
					break;

				case 18 /*DOM_VK_ALT*/:
				case 0x02 /*DOM_VK_LEFT_ALT*/:
					key = 116 /* GLUT_KEY_ALT_L */;
					break;
				case 0x01 /*DOM_VK_RIGHT_ALT*/:
					key = 117 /* GLUT_KEY_ALT_R */;
					break;
			}
			return key;
		},
		getASCIIKey: (event) => {
			if (event['ctrlKey'] || event['altKey'] || event['metaKey'])
				return null;

			var keycode = event['keyCode'];

			/* The exact list is soooo hard to find in a canonical place! */

			if (48 <= keycode && keycode <= 57) return keycode; // numeric  TODO handle shift?
			if (65 <= keycode && keycode <= 90)
				return event['shiftKey'] ? keycode : keycode + 32;
			if (96 <= keycode && keycode <= 105) return keycode - 48; // numpad numbers
			if (106 <= keycode && keycode <= 111) return keycode - 106 + 42; // *,+-./  TODO handle shift?

			switch (keycode) {
				case 9: // tab key
				case 13: // return key
				case 27: // escape
				case 32: // space
				case 61: // equal
					return keycode;
			}

			var s = event['shiftKey'];
			switch (keycode) {
				case 186:
					return s ? 58 : 59; // colon / semi-colon
				case 187:
					return s ? 43 : 61; // add / equal (these two may be wrong)
				case 188:
					return s ? 60 : 44; // less-than / comma
				case 189:
					return s ? 95 : 45; // dash
				case 190:
					return s ? 62 : 46; // greater-than / period
				case 191:
					return s ? 63 : 47; // forward slash
				case 219:
					return s ? 123 : 91; // open bracket
				case 220:
					return s ? 124 : 47; // back slash
				case 221:
					return s ? 125 : 93; // close bracket
				case 222:
					return s ? 34 : 39; // single quote
			}

			return null;
		},
		onKeydown: (event) => {
			if (GLUT.specialFunc || GLUT.keyboardFunc) {
				var key = GLUT.getSpecialKey(event['keyCode']);
				if (key !== null) {
					if (GLUT.specialFunc) {
						event.preventDefault();
						GLUT.saveModifiers(event);
						getWasmTableEntry(GLUT.specialFunc)(
							key,
							Browser.mouseX,
							Browser.mouseY
						);
					}
				} else {
					key = GLUT.getASCIIKey(event);
					if (key !== null && GLUT.keyboardFunc) {
						event.preventDefault();
						GLUT.saveModifiers(event);
						getWasmTableEntry(GLUT.keyboardFunc)(
							key,
							Browser.mouseX,
							Browser.mouseY
						);
					}
				}
			}
		},
		onKeyup: (event) => {
			if (GLUT.specialUpFunc || GLUT.keyboardUpFunc) {
				var key = GLUT.getSpecialKey(event['keyCode']);
				if (key !== null) {
					if (GLUT.specialUpFunc) {
						event.preventDefault();
						GLUT.saveModifiers(event);
						getWasmTableEntry(GLUT.specialUpFunc)(
							key,
							Browser.mouseX,
							Browser.mouseY
						);
					}
				} else {
					key = GLUT.getASCIIKey(event);
					if (key !== null && GLUT.keyboardUpFunc) {
						event.preventDefault();
						GLUT.saveModifiers(event);
						getWasmTableEntry(GLUT.keyboardUpFunc)(
							key,
							Browser.mouseX,
							Browser.mouseY
						);
					}
				}
			}
		},
		touchHandler: (event) => {
			if (event.target != Browser.getCanvas()) {
				return;
			}

			var touches = event.changedTouches,
				main = touches[0],
				type = '';

			switch (event.type) {
				case 'touchstart':
					type = 'mousedown';
					break;
				case 'touchmove':
					type = 'mousemove';
					break;
				case 'touchend':
					type = 'mouseup';
					break;
				default:
					return;
			}

			var simulatedEvent = document.createEvent('MouseEvent');
			simulatedEvent.initMouseEvent(
				type,
				true,
				true,
				window,
				1,
				main.screenX,
				main.screenY,
				main.clientX,
				main.clientY,
				false,
				false,
				false,
				false,
				0 /*main*/,
				null
			);

			main.target.dispatchEvent(simulatedEvent);
			event.preventDefault();
		},
		onMouseButtonDown: (event) => {
			Browser.calculateMouseEvent(event);

			GLUT.buttons |= 1 << event['button'];

			if (event.target == Browser.getCanvas() && GLUT.mouseFunc) {
				try {
					event.target.setCapture();
				} catch (e) {}
				event.preventDefault();
				GLUT.saveModifiers(event);
				getWasmTableEntry(GLUT.mouseFunc)(
					event['button'],
					0 /*GLUT_DOWN*/,
					Browser.mouseX,
					Browser.mouseY
				);
			}
		},
		onMouseButtonUp: (event) => {
			Browser.calculateMouseEvent(event);

			GLUT.buttons &= ~(1 << event['button']);

			if (GLUT.mouseFunc) {
				event.preventDefault();
				GLUT.saveModifiers(event);
				getWasmTableEntry(GLUT.mouseFunc)(
					event['button'],
					1 /*GLUT_UP*/,
					Browser.mouseX,
					Browser.mouseY
				);
			}
		},
		onMouseWheel: (event) => {
			Browser.calculateMouseEvent(event);

			// cross-browser wheel delta
			var e = window.event || event; // old IE support
			// Note the minus sign that flips browser wheel direction (positive direction scrolls page down) to native wheel direction (positive direction is mouse wheel up)
			var delta = -Browser.getMouseWheelDelta(event);
			delta =
				delta == 0
					? 0
					: delta > 0
						? Math.max(delta, 1)
						: Math.min(delta, -1); // Quantize to integer so that minimum scroll is at least +/- 1.

			var button = 3; // wheel up
			if (delta < 0) {
				button = 4; // wheel down
			}

			if (GLUT.mouseFunc) {
				event.preventDefault();
				GLUT.saveModifiers(event);
				getWasmTableEntry(GLUT.mouseFunc)(
					button,
					0 /*GLUT_DOWN*/,
					Browser.mouseX,
					Browser.mouseY
				);
			}
		},
		onFullscreenEventChange: (event) => {
			var width;
			var height;
			if (getFullscreenElement()) {
				width = screen['width'];
				height = screen['height'];
			} else {
				width = GLUT.windowWidth;
				height = GLUT.windowHeight;
				// TODO set position
				document.removeEventListener(
					'fullscreenchange',
					GLUT.onFullscreenEventChange,
					true
				);
				document.removeEventListener(
					'mozfullscreenchange',
					GLUT.onFullscreenEventChange,
					true
				);
				document.removeEventListener(
					'webkitfullscreenchange',
					GLUT.onFullscreenEventChange,
					true
				);
			}
			Browser.setCanvasSize(width, height, true); // N.B. GLUT.reshapeFunc is also registered as a canvas resize callback.
			// Just call it once here.
			/* Can't call _glutReshapeWindow as that requests cancelling fullscreen. */
			if (GLUT.reshapeFunc) {
				// out("GLUT.reshapeFunc (from FS): " + width + ", " + height);
				getWasmTableEntry(GLUT.reshapeFunc)(width, height);
			}
			_glutPostRedisplay();
		},
		onResize: () => {
			// Update canvas size to clientWidth and clientHeight, which include CSS scaling
			var canvas = Browser.getCanvas();
			Browser.setCanvasSize(
				canvas.clientWidth,
				canvas.clientHeight,
				/*noUpdates*/ false
			);
		},
	};

	var _glutGetModifiers = () => GLUT.modifiers;
	_glutGetModifiers.sig = 'i';

	var _glutInit = (argcp, argv) => {
		// Ignore arguments
		GLUT.initTime = Date.now();

		var isTouchDevice = 'ontouchstart' in document.documentElement;
		if (isTouchDevice) {
			// onMouseButtonDown, onMouseButtonUp and onMousemove handlers
			// depend on Browser.mouseX / Browser.mouseY fields. Those fields
			// don't get updated by touch events. So register a touchHandler
			// function that translates the touch events to mouse events.

			// GLUT doesn't support touch, mouse only, so from touch events we
			// are only looking at single finger touches to emulate left click,
			// so we can use workaround and convert all touch events in mouse
			// events. See touchHandler.
			window.addEventListener('touchmove', GLUT.touchHandler, true);
			window.addEventListener('touchstart', GLUT.touchHandler, true);
			window.addEventListener('touchend', GLUT.touchHandler, true);
		}

		window.addEventListener('keydown', GLUT.onKeydown, true);
		window.addEventListener('keyup', GLUT.onKeyup, true);
		window.addEventListener('mousemove', GLUT.onMousemove, true);
		window.addEventListener('mousedown', GLUT.onMouseButtonDown, true);
		window.addEventListener('mouseup', GLUT.onMouseButtonUp, true);
		// IE9, Chrome, Safari, Opera
		window.addEventListener('mousewheel', GLUT.onMouseWheel, true);
		// Firefox
		window.addEventListener('DOMMouseScroll', GLUT.onMouseWheel, true);

		// Resize callback stage 1: update canvas which notifies resizeListeners
		window.addEventListener('resize', GLUT.onResize, true);

		// Resize callback stage 2: updateResizeListeners notifies reshapeFunc
		Browser.resizeListeners.push((width, height) => {
			if (GLUT.reshapeFunc) {
				getWasmTableEntry(GLUT.reshapeFunc)(width, height);
			}
		});

		addOnExit(() => {
			if (isTouchDevice) {
				window.removeEventListener(
					'touchmove',
					GLUT.touchHandler,
					true
				);
				window.removeEventListener(
					'touchstart',
					GLUT.touchHandler,
					true
				);
				window.removeEventListener('touchend', GLUT.touchHandler, true);
			}

			window.removeEventListener('keydown', GLUT.onKeydown, true);
			window.removeEventListener('keyup', GLUT.onKeyup, true);
			window.removeEventListener('mousemove', GLUT.onMousemove, true);
			window.removeEventListener(
				'mousedown',
				GLUT.onMouseButtonDown,
				true
			);
			window.removeEventListener('mouseup', GLUT.onMouseButtonUp, true);
			// IE9, Chrome, Safari, Opera
			window.removeEventListener('mousewheel', GLUT.onMouseWheel, true);
			// Firefox
			window.removeEventListener(
				'DOMMouseScroll',
				GLUT.onMouseWheel,
				true
			);

			window.removeEventListener('resize', GLUT.onResize, true);

			var canvas = Browser.getCanvas();
			canvas.width = canvas.height = 1;
		});
	};
	_glutInit.sig = 'vpp';

	var _glutInitWindowSize = (width, height) => {
		Browser.setCanvasSize(
			(GLUT.initWindowWidth = width),
			(GLUT.initWindowHeight = height)
		);
	};
	_glutInitWindowSize.sig = 'vii';

	var _glutInitWindowPosition = (x, y) => {};
	_glutInitWindowPosition.sig = 'vii';

	var _glutGet = (type) => {
		switch (type) {
			case 100 /* GLUT_WINDOW_X */:
				return 0; /* TODO */
			case 101 /* GLUT_WINDOW_Y */:
				return 0; /* TODO */
			case 102 /* GLUT_WINDOW_WIDTH */:
				return Browser.getCanvas().width;
			case 103 /* GLUT_WINDOW_HEIGHT */:
				return Browser.getCanvas().height;
			case 200 /* GLUT_SCREEN_WIDTH */:
				return Browser.getCanvas().width;
			case 201 /* GLUT_SCREEN_HEIGHT */:
				return Browser.getCanvas().height;
			case 500 /* GLUT_INIT_WINDOW_X */:
				return 0; /* TODO */
			case 501 /* GLUT_INIT_WINDOW_Y */:
				return 0; /* TODO */
			case 502 /* GLUT_INIT_WINDOW_WIDTH */:
				return GLUT.initWindowWidth;
			case 503 /* GLUT_INIT_WINDOW_HEIGHT */:
				return GLUT.initWindowHeight;
			case 700 /* GLUT_ELAPSED_TIME */:
				var now = Date.now();
				return now - GLUT.initTime;
			case 0x0069 /* GLUT_WINDOW_STENCIL_SIZE */:
				return GLctx.getContextAttributes().stencil ? 8 : 0;
			case 0x006a /* GLUT_WINDOW_DEPTH_SIZE */:
				return GLctx.getContextAttributes().depth ? 8 : 0;
			case 0x006e /* GLUT_WINDOW_ALPHA_SIZE */:
				return GLctx.getContextAttributes().alpha ? 8 : 0;
			case 0x0078 /* GLUT_WINDOW_NUM_SAMPLES */:
				return GLctx.getContextAttributes().antialias ? 1 : 0;

			default:
				abort('glutGet(' + type + ') not implemented yet');
		}
	};
	_glutGet.sig = 'ii';

	var _glutIdleFunc = (func) => {
		function callback() {
			if (GLUT.idleFunc) {
				getWasmTableEntry(GLUT.idleFunc)();
				safeSetTimeout(callback, 4); // HTML spec specifies a 4ms minimum delay on the main thread; workers might get more, but we standardize here
			}
		}
		if (!GLUT.idleFunc) {
			safeSetTimeout(callback, 0);
		}
		GLUT.idleFunc = func;
	};
	_glutIdleFunc.sig = 'vp';

	var _glutTimerFunc = (msec, func, value) =>
		safeSetTimeout(() => getWasmTableEntry(func)(value), msec);
	_glutTimerFunc.sig = 'vipi';

	var _glutDisplayFunc = (func) => {
		GLUT.displayFunc = func;
	};
	_glutDisplayFunc.sig = 'vp';

	var _glutKeyboardFunc = (func) => {
		GLUT.keyboardFunc = func;
	};
	_glutKeyboardFunc.sig = 'vp';

	var _glutKeyboardUpFunc = (func) => {
		GLUT.keyboardUpFunc = func;
	};
	_glutKeyboardUpFunc.sig = 'vp';

	var _glutSpecialFunc = (func) => {
		GLUT.specialFunc = func;
	};
	_glutSpecialFunc.sig = 'vp';

	var _glutSpecialUpFunc = (func) => {
		GLUT.specialUpFunc = func;
	};
	_glutSpecialUpFunc.sig = 'vp';

	var _glutReshapeFunc = (func) => {
		GLUT.reshapeFunc = func;
	};
	_glutReshapeFunc.sig = 'vp';

	var _glutMotionFunc = (func) => {
		GLUT.motionFunc = func;
	};
	_glutMotionFunc.sig = 'vp';

	var _glutPassiveMotionFunc = (func) => {
		GLUT.passiveMotionFunc = func;
	};
	_glutPassiveMotionFunc.sig = 'vp';

	var _glutMouseFunc = (func) => {
		GLUT.mouseFunc = func;
	};
	_glutMouseFunc.sig = 'vp';

	var _glutSetCursor = (cursor) => {
		var cursorStyle = 'auto';
		switch (cursor) {
			case 0x0000 /* GLUT_CURSOR_RIGHT_ARROW */:
				// No equivalent css cursor style, fallback to 'auto'
				break;
			case 0x0001 /* GLUT_CURSOR_LEFT_ARROW */:
				// No equivalent css cursor style, fallback to 'auto'
				break;
			case 0x0002 /* GLUT_CURSOR_INFO */:
				cursorStyle = 'pointer';
				break;
			case 0x0003 /* GLUT_CURSOR_DESTROY */:
				// No equivalent css cursor style, fallback to 'auto'
				break;
			case 0x0004 /* GLUT_CURSOR_HELP */:
				cursorStyle = 'help';
				break;
			case 0x0005 /* GLUT_CURSOR_CYCLE */:
				// No equivalent css cursor style, fallback to 'auto'
				break;
			case 0x0006 /* GLUT_CURSOR_SPRAY */:
				// No equivalent css cursor style, fallback to 'auto'
				break;
			case 0x0007 /* GLUT_CURSOR_WAIT */:
				cursorStyle = 'wait';
				break;
			case 0x0008 /* GLUT_CURSOR_TEXT */:
				cursorStyle = 'text';
				break;
			case 0x0009: /* GLUT_CURSOR_CROSSHAIR */
			case 0x0066 /* GLUT_CURSOR_FULL_CROSSHAIR */:
				cursorStyle = 'crosshair';
				break;
			case 0x000a /* GLUT_CURSOR_UP_DOWN */:
				cursorStyle = 'ns-resize';
				break;
			case 0x000b /* GLUT_CURSOR_LEFT_RIGHT */:
				cursorStyle = 'ew-resize';
				break;
			case 0x000c /* GLUT_CURSOR_TOP_SIDE */:
				cursorStyle = 'n-resize';
				break;
			case 0x000d /* GLUT_CURSOR_BOTTOM_SIDE */:
				cursorStyle = 's-resize';
				break;
			case 0x000e /* GLUT_CURSOR_LEFT_SIDE */:
				cursorStyle = 'w-resize';
				break;
			case 0x000f /* GLUT_CURSOR_RIGHT_SIDE */:
				cursorStyle = 'e-resize';
				break;
			case 0x0010 /* GLUT_CURSOR_TOP_LEFT_CORNER */:
				cursorStyle = 'nw-resize';
				break;
			case 0x0011 /* GLUT_CURSOR_TOP_RIGHT_CORNER */:
				cursorStyle = 'ne-resize';
				break;
			case 0x0012 /* GLUT_CURSOR_BOTTOM_RIGHT_CORNER */:
				cursorStyle = 'se-resize';
				break;
			case 0x0013 /* GLUT_CURSOR_BOTTOM_LEFT_CORNER */:
				cursorStyle = 'sw-resize';
				break;
			case 0x0064 /* GLUT_CURSOR_INHERIT */:
				break;
			case 0x0065 /* GLUT_CURSOR_NONE */:
				cursorStyle = 'none';
				break;
			default:
				abort('glutSetCursor: Unknown cursor type: ' + cursor);
		}
		Browser.getCanvas().style.cursor = cursorStyle;
	};
	_glutSetCursor.sig = 'vi';

	var _glutCreateWindow = (name) => {
		var contextAttributes = {
			antialias:
				(GLUT.initDisplayMode & 0x0080) /*GLUT_MULTISAMPLE*/ != 0,
			depth: (GLUT.initDisplayMode & 0x0010) /*GLUT_DEPTH*/ != 0,
			stencil: (GLUT.initDisplayMode & 0x0020) /*GLUT_STENCIL*/ != 0,
			alpha: (GLUT.initDisplayMode & 0x0008) /*GLUT_ALPHA*/ != 0,
		};
		if (
			!Browser.createContext(
				Browser.getCanvas(),
				/*useWebGL=*/ true,
				/*setInModule=*/ true,
				contextAttributes
			)
		) {
			return 0; // failure
		}
		return 1; // a new GLUT window ID for the created context
	};
	_glutCreateWindow.sig = 'ip';

	var _glutDestroyWindow = (name) => {
		delete Module['ctx'];
		return 1;
	};
	_glutDestroyWindow.sig = 'vi';

	var _glutReshapeWindow = (width, height) => {
		Browser.exitFullscreen();
		Browser.setCanvasSize(width, height, true); // N.B. GLUT.reshapeFunc is also registered as a canvas resize callback.
		// Just call it once here.
		if (GLUT.reshapeFunc) {
			getWasmTableEntry(GLUT.reshapeFunc)(width, height);
		}
		_glutPostRedisplay();
	};
	_glutReshapeWindow.sig = 'vii';

	var _glutPositionWindow = (x, y) => {
		Browser.exitFullscreen();
		/* TODO */
		_glutPostRedisplay();
	};
	_glutPositionWindow.sig = 'vii';

	var _glutFullScreen = () => {
		GLUT.windowX = 0; // TODO
		GLUT.windowY = 0; // TODO
		var canvas = Browser.getCanvas();
		GLUT.windowWidth = canvas.width;
		GLUT.windowHeight = canvas.height;
		document.addEventListener(
			'fullscreenchange',
			GLUT.onFullscreenEventChange,
			true
		);
		document.addEventListener(
			'mozfullscreenchange',
			GLUT.onFullscreenEventChange,
			true
		);
		document.addEventListener(
			'webkitfullscreenchange',
			GLUT.onFullscreenEventChange,
			true
		);
		Browser.requestFullscreen(
			/*lockPointer=*/ false,
			/*resizeCanvas=*/ false
		);
	};
	_glutFullScreen.sig = 'v';

	var _glutInitDisplayMode = (mode) => (GLUT.initDisplayMode = mode);
	_glutInitDisplayMode.sig = 'vi';

	var _glutSwapBuffers = () => {};
	_glutSwapBuffers.sig = 'v';

	var _glutMainLoop = () => {
		// Do an initial resize, since there's no window resize event on startup
		GLUT.onResize();
		_glutPostRedisplay();
		throw 'unwind';
	};
	_glutMainLoop.sig = 'v';

	var _XOpenDisplay = (name) => 1;
	_XOpenDisplay.sig = 'pp';

	var _XCreateWindow = (
		display,
		parent,
		x,
		y,
		width,
		height,
		border_width,
		depth,
		class_,
		visual,
		valuemask,
		attributes
	) => {
		// All we can do is set the width and height
		Browser.setCanvasSize(width, height);
		return 2;
	};
	_XCreateWindow.sig = 'pppiiiiiiippp';

	var _XChangeWindowAttributes = (
		display,
		window,
		valuemask,
		attributes
	) => {};
	_XChangeWindowAttributes.sig = 'ipppp';

	var _XSetWMHints = (display, win, hints) => {};
	_XSetWMHints.sig = 'ippp';

	var _XMapWindow = (display, win) => {};
	_XMapWindow.sig = 'ipp';

	var _XStoreName = (display, win, name) => {};
	_XStoreName.sig = 'ippp';

	var _XInternAtom = (display, name_, hmm) => 0;
	_XInternAtom.sig = 'pppi';

	var _XSendEvent = (display, win, propagate, event_mask, even_send) => {};
	_XSendEvent.sig = 'ippipp';

	var _XPending = (display) => 0;
	_XPending.sig = 'ip';

	var EGL = {
		errorCode: 12288,
		defaultDisplayInitialized: false,
		currentContext: 0,
		currentReadSurface: 0,
		currentDrawSurface: 0,
		contextAttributes: {
			alpha: false,
			depth: false,
			stencil: false,
			antialias: false,
		},
		stringCache: {},
		setErrorCode(code) {
			EGL.errorCode = code;
		},
		chooseConfig(display, attribList, config, config_size, numConfigs) {
			if (display != 62000) {
				EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
				return 0;
			}

			if (attribList) {
				// read attribList if it is non-null
				for (;;) {
					var param = HEAP32[attribList >> 2];
					if (param == 0x3021 /*EGL_ALPHA_SIZE*/) {
						var alphaSize = HEAP32[(attribList + 4) >> 2];
						EGL.contextAttributes.alpha = alphaSize > 0;
					} else if (param == 0x3025 /*EGL_DEPTH_SIZE*/) {
						var depthSize = HEAP32[(attribList + 4) >> 2];
						EGL.contextAttributes.depth = depthSize > 0;
					} else if (param == 0x3026 /*EGL_STENCIL_SIZE*/) {
						var stencilSize = HEAP32[(attribList + 4) >> 2];
						EGL.contextAttributes.stencil = stencilSize > 0;
					} else if (param == 0x3031 /*EGL_SAMPLES*/) {
						var samples = HEAP32[(attribList + 4) >> 2];
						EGL.contextAttributes.antialias = samples > 0;
					} else if (param == 0x3032 /*EGL_SAMPLE_BUFFERS*/) {
						var samples = HEAP32[(attribList + 4) >> 2];
						EGL.contextAttributes.antialias = samples == 1;
					} else if (
						param == 0x3100 /*EGL_CONTEXT_PRIORITY_LEVEL_IMG*/
					) {
						var requestedPriority = HEAP32[(attribList + 4) >> 2];
						EGL.contextAttributes.lowLatency =
							requestedPriority !=
							0x3103 /*EGL_CONTEXT_PRIORITY_LOW_IMG*/;
					} else if (param == 0x3038 /*EGL_NONE*/) {
						break;
					}
					attribList += 8;
				}
			}

			if ((!config || !config_size) && !numConfigs) {
				EGL.setErrorCode(0x300c /* EGL_BAD_PARAMETER */);
				return 0;
			}
			if (numConfigs) {
				HEAP32[numConfigs >> 2] = 1; // Total number of supported configs: 1.
			}
			if (config && config_size > 0) {
				HEAPU32[config >> 2] = 62002;
			}

			EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
			return 1;
		},
	};

	var _eglGetDisplay = (nativeDisplayType) => {
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		// Emscripten EGL implementation "emulates" X11, and eglGetDisplay is
		// expected to accept/receive a pointer to an X11 Display object (or
		// EGL_DEFAULT_DISPLAY).
		if (
			nativeDisplayType != 0 /* EGL_DEFAULT_DISPLAY */ &&
			nativeDisplayType != 1 /* see library_xlib.js */
		) {
			return 0; // EGL_NO_DISPLAY
		}
		return 62000;
	};
	_eglGetDisplay.sig = 'pp';

	var _eglInitialize = (display, majorVersion, minorVersion) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		if (majorVersion) {
			HEAP32[majorVersion >> 2] = 1; // Advertise EGL Major version: '1'
		}
		if (minorVersion) {
			HEAP32[minorVersion >> 2] = 4; // Advertise EGL Minor version: '4'
		}
		EGL.defaultDisplayInitialized = true;
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1;
	};
	_eglInitialize.sig = 'ippp';

	var _eglTerminate = (display) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		EGL.currentContext = 0;
		EGL.currentReadSurface = 0;
		EGL.currentDrawSurface = 0;
		EGL.defaultDisplayInitialized = false;
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1;
	};
	_eglTerminate.sig = 'ip';

	var _eglGetConfigs = (display, configs, config_size, numConfigs) =>
		EGL.chooseConfig(display, 0, configs, config_size, numConfigs);
	_eglGetConfigs.sig = 'ippip';

	var _eglChooseConfig = (
		display,
		attrib_list,
		configs,
		config_size,
		numConfigs
	) =>
		EGL.chooseConfig(
			display,
			attrib_list,
			configs,
			config_size,
			numConfigs
		);
	_eglChooseConfig.sig = 'ipppip';

	var _eglGetConfigAttrib = (display, config, attribute, value) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		if (config != 62002) {
			EGL.setErrorCode(0x3005 /* EGL_BAD_CONFIG */);
			return 0;
		}
		if (!value) {
			EGL.setErrorCode(0x300c /* EGL_BAD_PARAMETER */);
			return 0;
		}
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		switch (attribute) {
			case 0x3020: // EGL_BUFFER_SIZE
				HEAP32[value >> 2] = EGL.contextAttributes.alpha ? 32 : 24;
				return 1;
			case 0x3021: // EGL_ALPHA_SIZE
				HEAP32[value >> 2] = EGL.contextAttributes.alpha ? 8 : 0;
				return 1;
			case 0x3022: // EGL_BLUE_SIZE
				HEAP32[value >> 2] = 8;
				return 1;
			case 0x3023: // EGL_GREEN_SIZE
				HEAP32[value >> 2] = 8;
				return 1;
			case 0x3024: // EGL_RED_SIZE
				HEAP32[value >> 2] = 8;
				return 1;
			case 0x3025: // EGL_DEPTH_SIZE
				HEAP32[value >> 2] = EGL.contextAttributes.depth ? 24 : 0;
				return 1;
			case 0x3026: // EGL_STENCIL_SIZE
				HEAP32[value >> 2] = EGL.contextAttributes.stencil ? 8 : 0;
				return 1;
			case 0x3027: // EGL_CONFIG_CAVEAT
				// We can return here one of EGL_NONE (0x3038), EGL_SLOW_CONFIG (0x3050) or EGL_NON_CONFORMANT_CONFIG (0x3051).
				HEAP32[value >> 2] = 0x3038;
				return 1;
			case 0x3028: // EGL_CONFIG_ID
				HEAP32[value >> 2] = 62002;
				return 1;
			case 0x3029: // EGL_LEVEL
				HEAP32[value >> 2] = 0;
				return 1;
			case 0x302a: // EGL_MAX_PBUFFER_HEIGHT
				HEAP32[value >> 2] = 4096;
				return 1;
			case 0x302b: // EGL_MAX_PBUFFER_PIXELS
				HEAP32[value >> 2] = 16777216;
				return 1;
			case 0x302c: // EGL_MAX_PBUFFER_WIDTH
				HEAP32[value >> 2] = 4096;
				return 1;
			case 0x302d: // EGL_NATIVE_RENDERABLE
				HEAP32[value >> 2] = 0;
				return 1;
			case 0x302e: // EGL_NATIVE_VISUAL_ID
				HEAP32[value >> 2] = 0;
				return 1;
			case 0x302f: // EGL_NATIVE_VISUAL_TYPE
				HEAP32[value >> 2] = 0x3038;
				return 1;
			case 0x3031: // EGL_SAMPLES
				HEAP32[value >> 2] = EGL.contextAttributes.antialias ? 4 : 0;
				return 1;
			case 0x3032: // EGL_SAMPLE_BUFFERS
				HEAP32[value >> 2] = EGL.contextAttributes.antialias ? 1 : 0;
				return 1;
			case 0x3033: // EGL_SURFACE_TYPE
				HEAP32[value >> 2] = 0x4;
				return 1;
			case 0x3034: // EGL_TRANSPARENT_TYPE
				// If this returns EGL_TRANSPARENT_RGB (0x3052), transparency is used through color-keying. No such thing applies to Emscripten canvas.
				HEAP32[value >> 2] = 0x3038;
				return 1;
			case 0x3035: // EGL_TRANSPARENT_BLUE_VALUE
			case 0x3036: // EGL_TRANSPARENT_GREEN_VALUE
			case 0x3037: // EGL_TRANSPARENT_RED_VALUE
				// "If EGL_TRANSPARENT_TYPE is EGL_NONE, then the values for EGL_TRANSPARENT_RED_VALUE, EGL_TRANSPARENT_GREEN_VALUE, and EGL_TRANSPARENT_BLUE_VALUE are undefined."
				HEAP32[value >> 2] = -1;
				return 1;
			case 0x3039: // EGL_BIND_TO_TEXTURE_RGB
			case 0x303a: // EGL_BIND_TO_TEXTURE_RGBA
				HEAP32[value >> 2] = 0;
				return 1;
			case 0x303b: // EGL_MIN_SWAP_INTERVAL
				HEAP32[value >> 2] = 0;
				return 1;
			case 0x303c: // EGL_MAX_SWAP_INTERVAL
				HEAP32[value >> 2] = 1;
				return 1;
			case 0x303d: // EGL_LUMINANCE_SIZE
			case 0x303e: // EGL_ALPHA_MASK_SIZE
				HEAP32[value >> 2] = 0;
				return 1;
			case 0x303f: // EGL_COLOR_BUFFER_TYPE
				// EGL has two types of buffers: EGL_RGB_BUFFER and EGL_LUMINANCE_BUFFER.
				HEAP32[value >> 2] = 0x308e;
				return 1;
			case 0x3040: // EGL_RENDERABLE_TYPE
				// A bit combination of EGL_OPENGL_ES_BIT,EGL_OPENVG_BIT,EGL_OPENGL_ES2_BIT and EGL_OPENGL_BIT.
				HEAP32[value >> 2] = 0x4;
				return 1;
			case 0x3042: // EGL_CONFORMANT
				// "EGL_CONFORMANT is a mask indicating if a client API context created with respect to the corresponding EGLConfig will pass the required conformance tests for that API."
				HEAP32[value >> 2] = 0;
				return 1;
			default:
				EGL.setErrorCode(0x3004 /* EGL_BAD_ATTRIBUTE */);
				return 0;
		}
	};
	_eglGetConfigAttrib.sig = 'ippip';

	var _eglCreateWindowSurface = (display, config, win, attrib_list) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		if (config != 62002) {
			EGL.setErrorCode(0x3005 /* EGL_BAD_CONFIG */);
			return 0;
		}
		// TODO: Examine attrib_list! Parameters that can be present there are:
		// - EGL_RENDER_BUFFER (must be EGL_BACK_BUFFER)
		// - EGL_VG_COLORSPACE (can't be set)
		// - EGL_VG_ALPHA_FORMAT (can't be set)
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 62006; /* Magic ID for Emscripten 'default surface' */
	};
	_eglCreateWindowSurface.sig = 'pppip';

	var _eglDestroySurface = (display, surface) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		if (
			surface !=
			62006 /* Magic ID for the only EGLSurface supported by Emscripten */
		) {
			EGL.setErrorCode(0x300d /* EGL_BAD_SURFACE */);
			return 1;
		}
		if (EGL.currentReadSurface == surface) {
			EGL.currentReadSurface = 0;
		}
		if (EGL.currentDrawSurface == surface) {
			EGL.currentDrawSurface = 0;
		}
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1; /* Magic ID for Emscripten 'default surface' */
	};
	_eglDestroySurface.sig = 'ipp';

	var _eglCreateContext = (display, config, hmm, contextAttribs) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}

		// EGL 1.4 spec says default EGL_CONTEXT_CLIENT_VERSION is GLES1, but this is not supported by Emscripten.
		// So user must pass EGL_CONTEXT_CLIENT_VERSION == 2 to initialize EGL.
		var glesContextVersion = 1;
		for (;;) {
			var param = HEAP32[contextAttribs >> 2];
			if (param == 0x3098 /*EGL_CONTEXT_CLIENT_VERSION*/) {
				glesContextVersion = HEAP32[(contextAttribs + 4) >> 2];
			} else if (param == 0x3038 /*EGL_NONE*/) {
				break;
			} else {
				/* EGL1.4 specifies only EGL_CONTEXT_CLIENT_VERSION as supported attribute */
				EGL.setErrorCode(0x3004 /*EGL_BAD_ATTRIBUTE*/);
				return 0;
			}
			contextAttribs += 8;
		}
		if (glesContextVersion != 2) {
			EGL.setErrorCode(0x3005 /* EGL_BAD_CONFIG */);
			return 0; /* EGL_NO_CONTEXT */
		}

		EGL.contextAttributes.majorVersion = glesContextVersion - 1; // WebGL 1 is GLES 2, WebGL2 is GLES3
		EGL.contextAttributes.minorVersion = 0;

		EGL.context = GL.createContext(
			Browser.getCanvas(),
			EGL.contextAttributes
		);

		if (EGL.context != 0) {
			EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);

			// Run callbacks so that GL emulation works
			GL.makeContextCurrent(EGL.context);
			Browser.useWebGL = true;
			Browser.moduleContextCreatedCallbacks.forEach((callback) =>
				callback()
			);

			// Note: This function only creates a context, but it shall not make it active.
			GL.makeContextCurrent(null);
			return 62004;
		} else {
			EGL.setErrorCode(0x3009 /* EGL_BAD_MATCH */); // By the EGL 1.4 spec, an implementation that does not support GLES2 (WebGL in this case), this error code is set.
			return 0; /* EGL_NO_CONTEXT */
		}
	};
	_eglCreateContext.sig = 'ppppp';

	var _eglDestroyContext = (display, context) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		if (context != 62004) {
			EGL.setErrorCode(0x3006 /* EGL_BAD_CONTEXT */);
			return 0;
		}

		GL.deleteContext(EGL.context);
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		if (EGL.currentContext == context) {
			EGL.currentContext = 0;
		}
		return 1 /* EGL_TRUE */;
	};
	_eglDestroyContext.sig = 'ipp';

	var _eglQuerySurface = (display, surface, attribute, value) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		if (surface != 62006 /* Magic ID for Emscripten 'default surface' */) {
			EGL.setErrorCode(0x300d /* EGL_BAD_SURFACE */);
			return 0;
		}
		if (!value) {
			EGL.setErrorCode(0x300c /* EGL_BAD_PARAMETER */);
			return 0;
		}
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		switch (attribute) {
			case 0x3028: // EGL_CONFIG_ID
				HEAP32[value >> 2] = 62002;
				return 1;
			case 0x3058: // EGL_LARGEST_PBUFFER
				// Odd EGL API: If surface is not a pbuffer surface, 'value' should not be written to. It's not specified as an error, so true should(?) be returned.
				// Existing Android implementation seems to do so at least.
				return 1;
			case 0x3057: // EGL_WIDTH
				HEAP32[value >> 2] = Browser.getCanvas().width;
				return 1;
			case 0x3056: // EGL_HEIGHT
				HEAP32[value >> 2] = Browser.getCanvas().height;
				return 1;
			case 0x3090: // EGL_HORIZONTAL_RESOLUTION
				HEAP32[value >> 2] = -1;
				return 1;
			case 0x3091: // EGL_VERTICAL_RESOLUTION
				HEAP32[value >> 2] = -1;
				return 1;
			case 0x3092: // EGL_PIXEL_ASPECT_RATIO
				HEAP32[value >> 2] = -1;
				return 1;
			case 0x3086: // EGL_RENDER_BUFFER
				// The main surface is bound to the visible canvas window - it's always backbuffered.
				// Alternative to EGL_BACK_BUFFER would be EGL_SINGLE_BUFFER.
				HEAP32[value >> 2] = 0x3084;
				return 1;
			case 0x3099: // EGL_MULTISAMPLE_RESOLVE
				HEAP32[value >> 2] = 0x309a;
				return 1;
			case 0x3093: // EGL_SWAP_BEHAVIOR
				// The two possibilities are EGL_BUFFER_PRESERVED and EGL_BUFFER_DESTROYED. Slightly unsure which is the
				// case for browser environment, but advertise the 'weaker' behavior to be sure.
				HEAP32[value >> 2] = 0x3095;
				return 1;
			case 0x3080: // EGL_TEXTURE_FORMAT
			case 0x3081: // EGL_TEXTURE_TARGET
			case 0x3082: // EGL_MIPMAP_TEXTURE
			case 0x3083: // EGL_MIPMAP_LEVEL
				// This is a window surface, not a pbuffer surface. Spec:
				// "Querying EGL_TEXTURE_FORMAT, EGL_TEXTURE_TARGET, EGL_MIPMAP_TEXTURE, or EGL_MIPMAP_LEVEL for a non-pbuffer surface is not an error, but value is not modified."
				// So pass-through.
				return 1;
			default:
				EGL.setErrorCode(0x3004 /* EGL_BAD_ATTRIBUTE */);
				return 0;
		}
	};
	_eglQuerySurface.sig = 'ippip';

	var _eglQueryContext = (display, context, attribute, value) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		//\todo An EGL_NOT_INITIALIZED error is generated if EGL is not initialized for dpy.
		if (context != 62004) {
			EGL.setErrorCode(0x3006 /* EGL_BAD_CONTEXT */);
			return 0;
		}
		if (!value) {
			EGL.setErrorCode(0x300c /* EGL_BAD_PARAMETER */);
			return 0;
		}

		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		switch (attribute) {
			case 0x3028: // EGL_CONFIG_ID
				HEAP32[value >> 2] = 62002;
				return 1;
			case 0x3097: // EGL_CONTEXT_CLIENT_TYPE
				HEAP32[value >> 2] = 0x30a0;
				return 1;
			case 0x3098: // EGL_CONTEXT_CLIENT_VERSION
				HEAP32[value >> 2] = EGL.contextAttributes.majorVersion + 1;
				return 1;
			case 0x3086: // EGL_RENDER_BUFFER
				// The context is bound to the visible canvas window - it's always backbuffered.
				// Alternative to EGL_BACK_BUFFER would be EGL_SINGLE_BUFFER.
				HEAP32[value >> 2] = 0x3084;
				return 1;
			default:
				EGL.setErrorCode(0x3004 /* EGL_BAD_ATTRIBUTE */);
				return 0;
		}
	};
	_eglQueryContext.sig = 'ippip';

	var _eglGetError = () => EGL.errorCode;
	_eglGetError.sig = 'i';

	var _eglQueryString = (display, name) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		//\todo An EGL_NOT_INITIALIZED error is generated if EGL is not initialized for dpy.
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		if (EGL.stringCache[name]) return EGL.stringCache[name];
		var ret;
		switch (name) {
			case 0x3053 /* EGL_VENDOR */:
				ret = stringToNewUTF8('Emscripten');
				break;
			case 0x3054 /* EGL_VERSION */:
				ret = stringToNewUTF8('1.4 Emscripten EGL');
				break;
			case 0x3055 /* EGL_EXTENSIONS */:
				ret = stringToNewUTF8('');
				break; // Currently not supporting any EGL extensions.
			case 0x308d /* EGL_CLIENT_APIS */:
				ret = stringToNewUTF8('OpenGL_ES');
				break;
			default:
				EGL.setErrorCode(0x300c /* EGL_BAD_PARAMETER */);
				return 0;
		}
		EGL.stringCache[name] = ret;
		return ret;
	};
	_eglQueryString.sig = 'ppi';

	var _eglBindAPI = (api) => {
		if (api == 0x30a0 /* EGL_OPENGL_ES_API */) {
			EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
			return 1;
		}
		// if (api == 0x30A1 /* EGL_OPENVG_API */ || api == 0x30A2 /* EGL_OPENGL_API */) {
		EGL.setErrorCode(0x300c /* EGL_BAD_PARAMETER */);
		return 0;
	};
	_eglBindAPI.sig = 'ii';

	var _eglQueryAPI = () => {
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 0x30a0; // EGL_OPENGL_ES_API
	};
	_eglQueryAPI.sig = 'i';

	var _eglWaitClient = () => {
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1;
	};
	_eglWaitClient.sig = 'i';

	var _eglWaitNative = (nativeEngineId) => {
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1;
	};
	_eglWaitNative.sig = 'ii';

	var _eglWaitGL = _eglWaitClient;
	_eglWaitGL.sig = 'i';

	var _eglSwapInterval = (display, interval) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0;
		}
		if (interval == 0) _emscripten_set_main_loop_timing(0, 0);
		else _emscripten_set_main_loop_timing(1, interval);

		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1;
	};
	_eglSwapInterval.sig = 'ipi';

	var _eglMakeCurrent = (display, draw, read, context) => {
		if (display != 62000) {
			EGL.setErrorCode(0x3008 /* EGL_BAD_DISPLAY */);
			return 0 /* EGL_FALSE */;
		}
		//\todo An EGL_NOT_INITIALIZED error is generated if EGL is not initialized for dpy.
		if (context != 0 && context != 62004) {
			EGL.setErrorCode(0x3006 /* EGL_BAD_CONTEXT */);
			return 0;
		}
		if (
			(read != 0 && read != 62006) ||
			(draw != 0 &&
				draw != 62006) /* Magic ID for Emscripten 'default surface' */
		) {
			EGL.setErrorCode(0x300d /* EGL_BAD_SURFACE */);
			return 0;
		}

		GL.makeContextCurrent(context ? EGL.context : null);

		EGL.currentContext = context;
		EGL.currentDrawSurface = draw;
		EGL.currentReadSurface = read;
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1 /* EGL_TRUE */;
	};
	_eglMakeCurrent.sig = 'ipppp';

	var _eglGetCurrentContext = () => EGL.currentContext;
	_eglGetCurrentContext.sig = 'p';

	var _eglGetCurrentSurface = (readdraw) => {
		if (readdraw == 0x305a /* EGL_READ */) {
			return EGL.currentReadSurface;
		} else if (readdraw == 0x3059 /* EGL_DRAW */) {
			return EGL.currentDrawSurface;
		} else {
			EGL.setErrorCode(0x300c /* EGL_BAD_PARAMETER */);
			return 0 /* EGL_NO_SURFACE */;
		}
	};
	_eglGetCurrentSurface.sig = 'pi';

	var _eglGetCurrentDisplay = () => (EGL.currentContext ? 62000 : 0);
	_eglGetCurrentDisplay.sig = 'p';

	var _eglSwapBuffers = (dpy, surface) => {
		if (!EGL.defaultDisplayInitialized) {
			EGL.setErrorCode(0x3001 /* EGL_NOT_INITIALIZED */);
		} else if (!GLctx) {
			EGL.setErrorCode(0x3002 /* EGL_BAD_ACCESS */);
		} else if (GLctx.isContextLost()) {
			EGL.setErrorCode(0x300e /* EGL_CONTEXT_LOST */);
		} else {
			// According to documentation this does an implicit flush.
			// Due to discussion at https://github.com/emscripten-core/emscripten/pull/1871
			// the flush was removed since this _may_ result in slowing code down.
			//_glFlush();
			EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
			return 1 /* EGL_TRUE */;
		}
		return 0 /* EGL_FALSE */;
	};
	_eglSwapBuffers.sig = 'ipp';

	var _eglReleaseThread = () => {
		// Equivalent to eglMakeCurrent with EGL_NO_CONTEXT and EGL_NO_SURFACE.
		EGL.currentContext = 0;
		EGL.currentReadSurface = 0;
		EGL.currentDrawSurface = 0;
		// EGL spec v1.4 p.55:
		// "calling eglGetError immediately following a successful call to eglReleaseThread should not be done.
		//  Such a call will return EGL_SUCCESS - but will also result in reallocating per-thread state."
		EGL.setErrorCode(0x3000 /* EGL_SUCCESS */);
		return 1 /* EGL_TRUE */;
	};
	_eglReleaseThread.sig = 'i';

	var _uuid_clear = (uu) => zeroMemory(uu, 16);
	_uuid_clear.sig = 'vp';

	var _uuid_compare = (uu1, uu2) => _memcmp(uu1, uu2, 16);
	_uuid_compare.sig = 'ipp';

	var _uuid_copy = (dst, src) => _memcpy(dst, src, 16);
	_uuid_copy.sig = 'vpp';

	var _uuid_generate = (out) => {
		// void uuid_generate(uuid_t out);
		var uuid = new Uint8Array(16);
		randomFill(uuid);

		// Makes uuid compliant to RFC-4122
		uuid[6] = (uuid[6] & 0x0f) | 0x40; // uuid version
		uuid[8] = (uuid[8] & 0x3f) | 0x80; // uuid variant
		writeArrayToMemory(uuid, out);
	};
	_uuid_generate.sig = 'vp';

	var _uuid_is_null = (uu) => {
		// int uuid_is_null(const uuid_t uu);
		for (var i = 0; i < 4; i++, uu = (uu + 4) | 0) {
			var val = HEAP32[uu >> 2];
			if (val) {
				return 0;
			}
		}
		return 1;
	};
	_uuid_is_null.sig = 'ip';

	var _uuid_parse = (inp, uu) => {
		// int uuid_parse(const char *in, uuid_t uu);
		inp = UTF8ToString(inp);
		if (inp.length === 36) {
			var i = 0;
			var uuid = new Array(16);
			inp.toLowerCase().replace(/[0-9a-f]{2}/g, function (byte) {
				if (i < 16) {
					uuid[i++] = parseInt(byte, 16);
				}
			});

			if (i < 16) {
				return -1;
			}
			writeArrayToMemory(uuid, uu);
			return 0;
		}
		return -1;
	};
	_uuid_parse.sig = 'ipp';

	/** @param {number|boolean=} upper */
	var _uuid_unparse = (uu, out, upper) => {
		// void uuid_unparse(const uuid_t uu, char *out);
		var i = 0;
		var uuid = 'xxxx-xx-xx-xx-xxxxxx'.replace(/[x]/g, function (c) {
			var r = upper
				? HEAPU8[uu + i].toString(16).toUpperCase()
				: HEAPU8[uu + i].toString(16);
			r = r.length === 1 ? '0' + r : r; // Zero pad single digit hex values
			i++;
			return r;
		});
		stringToUTF8(uuid, out, 37); // Always fixed 36 bytes of ASCII characters and a trailing \0.
	};
	_uuid_unparse.sig = 'vpp';

	var _uuid_unparse_lower = (uu, out) => {
		// void uuid_unparse_lower(const uuid_t uu, char *out);
		_uuid_unparse(uu, out);
	};
	_uuid_unparse_lower.sig = 'vpp';

	var _uuid_unparse_upper = (uu, out) => {
		// void uuid_unparse_upper(const uuid_t uu, char *out);
		_uuid_unparse(uu, out, true);
	};
	_uuid_unparse_upper.sig = 'vpp';

	var _uuid_type = (uu) => 4;
	_uuid_type.sig = 'ip';

	var _uuid_variant = (uu) => 1;
	_uuid_variant.sig = 'ip';

	var GLEW = {
		isLinaroFork: 1,
		extensions: null,
		error: {
			0: null,
			1: null,
			2: null,
			3: null,
			4: null,
			5: null,
			6: null,
			7: null,
			8: null,
		},
		version: {
			1: null,
			2: null,
			3: null,
			4: null,
		},
		errorStringConstantFromCode(error) {
			if (GLEW.isLinaroFork) {
				switch (error) {
					case 4:
						return 'OpenGL ES lib expected, found OpenGL lib'; // GLEW_ERROR_NOT_GLES_VERSION
					case 5:
						return 'OpenGL lib expected, found OpenGL ES lib'; // GLEW_ERROR_GLES_VERSION
					case 6:
						return 'Missing EGL version'; // GLEW_ERROR_NO_EGL_VERSION
					case 7:
						return 'EGL 1.1 and up are supported'; // GLEW_ERROR_EGL_VERSION_10_ONLY
					default:
						break;
				}
			}

			switch (error) {
				case 0:
					return 'No error'; // GLEW_OK || GLEW_NO_ERROR
				case 1:
					return 'Missing GL version'; // GLEW_ERROR_NO_GL_VERSION
				case 2:
					return 'GL 1.1 and up are supported'; // GLEW_ERROR_GL_VERSION_10_ONLY
				case 3:
					return 'GLX 1.2 and up are supported'; // GLEW_ERROR_GLX_VERSION_11_ONLY
				default:
					return null;
			}
		},
		errorString(error) {
			if (!GLEW.error[error]) {
				var string = GLEW.errorStringConstantFromCode(error);
				if (!string) {
					string = 'Unknown error';
					error = 8; // prevent array from growing more than this
				}
				GLEW.error[error] = stringToNewUTF8(string);
			}
			return GLEW.error[error];
		},
		versionStringConstantFromCode(name) {
			switch (name) {
				case 1:
					return '1.10.0'; // GLEW_VERSION
				case 2:
					return '1'; // GLEW_VERSION_MAJOR
				case 3:
					return '10'; // GLEW_VERSION_MINOR
				case 4:
					return '0'; // GLEW_VERSION_MICRO
				default:
					return null;
			}
		},
		versionString(name) {
			if (!GLEW.version[name]) {
				var string = GLEW.versionStringConstantFromCode(name);
				if (!string) return 0;
				GLEW.version[name] = stringToNewUTF8(string);
			}
			return GLEW.version[name];
		},
		extensionIsSupported(name) {
			GLEW.extensions ||= webglGetExtensions();

			if (GLEW.extensions.includes(name)) return 1;

			// extensions from GLEmulations do not come unprefixed
			// so, try with prefix
			return GLEW.extensions.includes('GL_' + name);
		},
	};

	var _glewInit = () => 0;
	_glewInit.sig = 'i';

	var _glewIsSupported = (name) => {
		var exts = UTF8ToString(name).split(' ');
		for (var ext of exts) {
			if (!GLEW.extensionIsSupported(ext)) return 0;
		}
		return 1;
	};
	_glewIsSupported.sig = 'ip';

	var _glewGetExtension = (name) =>
		GLEW.extensionIsSupported(UTF8ToString(name));
	_glewGetExtension.sig = 'ip';

	var _glewGetErrorString = (error) => GLEW.errorString(error);
	_glewGetErrorString.sig = 'pi';

	var _glewGetString = (name) => GLEW.versionString(name);
	_glewGetString.sig = 'pi';

	var IDBStore = {
		indexedDB() {
			return indexedDB;
		},
		DB_VERSION: 22,
		DB_STORE_NAME: 'FILE_DATA',
		dbs: {},
		blobs: [0],
		getDB(name, callback) {
			// check the cache first
			var db = IDBStore.dbs[name];
			if (db) {
				return callback(null, db);
			}
			var req;
			try {
				req = IDBStore.indexedDB().open(name, IDBStore.DB_VERSION);
			} catch (e) {
				return callback(e);
			}
			req.onupgradeneeded = (e) => {
				var db = /** @type {IDBDatabase} */ (e.target.result);
				var transaction = e.target.transaction;
				var fileStore;
				if (db.objectStoreNames.contains(IDBStore.DB_STORE_NAME)) {
					fileStore = transaction.objectStore(IDBStore.DB_STORE_NAME);
				} else {
					fileStore = db.createObjectStore(IDBStore.DB_STORE_NAME);
				}
			};
			req.onsuccess = () => {
				db = /** @type {IDBDatabase} */ (req.result);
				// add to the cache
				IDBStore.dbs[name] = db;
				callback(null, db);
			};
			req.onerror = function (event) {
				callback(event.target.error || 'unknown error');
				event.preventDefault();
			};
		},
		getStore(dbName, type, callback) {
			IDBStore.getDB(dbName, (error, db) => {
				if (error) return callback(error);
				var transaction = db.transaction(
					[IDBStore.DB_STORE_NAME],
					type
				);
				transaction.onerror = (event) => {
					callback(event.target.error || 'unknown error');
					event.preventDefault();
				};
				var store = transaction.objectStore(IDBStore.DB_STORE_NAME);
				callback(null, store);
			});
		},
		getFile(dbName, id, callback) {
			IDBStore.getStore(dbName, 'readonly', (err, store) => {
				if (err) return callback(err);
				var req = store.get(id);
				req.onsuccess = (event) => {
					var result = event.target.result;
					if (!result) {
						return callback(`file ${id} not found`);
					}
					return callback(null, result);
				};
				req.onerror = callback;
			});
		},
		setFile(dbName, id, data, callback) {
			IDBStore.getStore(dbName, 'readwrite', (err, store) => {
				if (err) return callback(err);
				var req = store.put(data, id);
				req.onsuccess = (event) => callback();
				req.onerror = callback;
			});
		},
		deleteFile(dbName, id, callback) {
			IDBStore.getStore(dbName, 'readwrite', (err, store) => {
				if (err) return callback(err);
				var req = store.delete(id);
				req.onsuccess = (event) => callback();
				req.onerror = callback;
			});
		},
		existsFile(dbName, id, callback) {
			IDBStore.getStore(dbName, 'readonly', (err, store) => {
				if (err) return callback(err);
				var req = store.count(id);
				req.onsuccess = (event) =>
					callback(null, event.target.result > 0);
				req.onerror = callback;
			});
		},
		clearStore(dbName, callback) {
			IDBStore.getStore(dbName, 'readwrite', (err, store) => {
				if (err) return callback(err);
				var req = store.clear();
				req.onsuccess = (event) => callback();
				req.onerror = callback;
			});
		},
	};

	var _emscripten_idb_async_load = (db, id, arg, onload, onerror) => {
		runtimeKeepalivePush();
		IDBStore.getFile(
			UTF8ToString(db),
			UTF8ToString(id),
			(error, byteArray) => {
				runtimeKeepalivePop();
				callUserCallback(() => {
					if (error) {
						if (onerror) getWasmTableEntry(onerror)(arg);
						return;
					}
					var buffer = _malloc(byteArray.length);
					HEAPU8.set(byteArray, buffer);
					getWasmTableEntry(onload)(arg, buffer, byteArray.length);
					_free(buffer);
				});
			}
		);
	};
	_emscripten_idb_async_load.sig = 'vppppp';

	var _emscripten_idb_async_store = (
		db,
		id,
		ptr,
		num,
		arg,
		onstore,
		onerror
	) => {
		// note that we copy the data here, as these are async operatins - changes
		// to HEAPU8 meanwhile should not affect us!
		runtimeKeepalivePush();
		IDBStore.setFile(
			UTF8ToString(db),
			UTF8ToString(id),
			new Uint8Array(HEAPU8.subarray(ptr, ptr + num)),
			(error) => {
				runtimeKeepalivePop();
				callUserCallback(() => {
					if (error) {
						if (onerror) getWasmTableEntry(onerror)(arg);
						return;
					}
					if (onstore) getWasmTableEntry(onstore)(arg);
				});
			}
		);
	};
	_emscripten_idb_async_store.sig = 'vpppippp';

	var _emscripten_idb_async_delete = (db, id, arg, ondelete, onerror) => {
		runtimeKeepalivePush();
		IDBStore.deleteFile(UTF8ToString(db), UTF8ToString(id), (error) => {
			runtimeKeepalivePop();
			callUserCallback(() => {
				if (error) {
					if (onerror) getWasmTableEntry(onerror)(arg);
					return;
				}
				if (ondelete) getWasmTableEntry(ondelete)(arg);
			});
		});
	};
	_emscripten_idb_async_delete.sig = 'vppppp';

	var _emscripten_idb_async_exists = (db, id, arg, oncheck, onerror) => {
		runtimeKeepalivePush();
		IDBStore.existsFile(
			UTF8ToString(db),
			UTF8ToString(id),
			(error, exists) => {
				runtimeKeepalivePop();
				callUserCallback(() => {
					if (error) {
						if (onerror) getWasmTableEntry(onerror)(arg);
						return;
					}
					if (oncheck) getWasmTableEntry(oncheck)(arg, exists);
				});
			}
		);
	};
	_emscripten_idb_async_exists.sig = 'vppppp';

	var _emscripten_idb_async_clear = (db, arg, onclear, onerror) => {
		runtimeKeepalivePush();
		IDBStore.clearStore(UTF8ToString(db), (error) => {
			runtimeKeepalivePop();
			callUserCallback(() => {
				if (error) {
					if (onerror) getWasmTableEntry(onerror)(arg);
					return;
				}
				if (onclear) getWasmTableEntry(onclear)(arg);
			});
		});
	};
	_emscripten_idb_async_clear.sig = 'vpppp';

	var _emscripten_idb_load = (db, id, pbuffer, pnum, perror) =>
		Asyncify.handleSleep((wakeUp) => {
			IDBStore.getFile(
				UTF8ToString(db),
				UTF8ToString(id),
				(error, byteArray) => {
					if (error) {
						HEAP32[perror >> 2] = 1;
						wakeUp();
						return;
					}
					var buffer = _malloc(byteArray.length); // must be freed by the caller!
					HEAPU8.set(byteArray, buffer);
					HEAPU32[pbuffer >> 2] = buffer;
					HEAP32[pnum >> 2] = byteArray.length;
					HEAP32[perror >> 2] = 0;
					wakeUp();
				}
			);
		});
	_emscripten_idb_load.sig = 'vppppp';
	_emscripten_idb_load.isAsync = true;

	var _emscripten_idb_store = (db, id, ptr, num, perror) =>
		Asyncify.handleSleep((wakeUp) => {
			IDBStore.setFile(
				UTF8ToString(db),
				UTF8ToString(id),
				new Uint8Array(HEAPU8.subarray(ptr, ptr + num)),
				(error) => {
					// Closure warns about storing booleans in TypedArrays.
					/** @suppress{checkTypes} */
					HEAP32[perror >> 2] = !!error;
					wakeUp();
				}
			);
		});
	_emscripten_idb_store.sig = 'vpppip';
	_emscripten_idb_store.isAsync = true;

	var _emscripten_idb_delete = (db, id, perror) =>
		Asyncify.handleSleep((wakeUp) => {
			IDBStore.deleteFile(UTF8ToString(db), UTF8ToString(id), (error) => {
				/** @suppress{checkTypes} */
				HEAP32[perror >> 2] = !!error;
				wakeUp();
			});
		});
	_emscripten_idb_delete.sig = 'vppp';
	_emscripten_idb_delete.isAsync = true;

	var _emscripten_idb_exists = (db, id, pexists, perror) =>
		Asyncify.handleSleep((wakeUp) => {
			IDBStore.existsFile(
				UTF8ToString(db),
				UTF8ToString(id),
				(error, exists) => {
					/** @suppress{checkTypes} */
					HEAP32[pexists >> 2] = !!exists;
					/** @suppress{checkTypes} */
					HEAP32[perror >> 2] = !!error;
					wakeUp();
				}
			);
		});
	_emscripten_idb_exists.sig = 'vpppp';
	_emscripten_idb_exists.isAsync = true;

	var _emscripten_idb_clear = (db, perror) =>
		Asyncify.handleSleep((wakeUp) => {
			IDBStore.clearStore(UTF8ToString(db), (error) => {
				/** @suppress{checkTypes} */
				HEAP32[perror >> 2] = !!error;
				wakeUp();
			});
		});
	_emscripten_idb_clear.sig = 'vpp';
	_emscripten_idb_clear.isAsync = true;

	var _emscripten_idb_load_blob = (db, id, pblob, perror) =>
		Asyncify.handleSleep((wakeUp) => {
			IDBStore.pending = (msg) => {
				IDBStore.pending = null;
				var blob = msg.blob;
				if (!blob) {
					HEAP32[perror >> 2] = 1;
					wakeUp();
					return;
				}
				var blobId = IDBStore.blobs.length;
				IDBStore.blobs.push(blob);
				HEAP32[pblob >> 2] = blobId;
				wakeUp();
			};
			postMessage({
				target: 'IDBStore',
				method: 'loadBlob',
				db: UTF8ToString(db),
				id: UTF8ToString(id),
			});
		});
	_emscripten_idb_load_blob.sig = 'vpppp';
	_emscripten_idb_load_blob.isAsync = true;

	var _emscripten_idb_store_blob = (db, id, ptr, num, perror) =>
		Asyncify.handleSleep((wakeUp) => {
			IDBStore.pending = (msg) => {
				IDBStore.pending = null;
				HEAP32[perror >> 2] = !!msg.error;
				wakeUp();
			};
			postMessage({
				target: 'IDBStore',
				method: 'storeBlob',
				db: UTF8ToString(db),
				id: UTF8ToString(id),
				blob: new Blob([
					new Uint8Array(HEAPU8.subarray(ptr, ptr + num)),
				]),
			});
		});
	_emscripten_idb_store_blob.sig = 'vpppip';
	_emscripten_idb_store_blob.isAsync = true;

	var _emscripten_idb_read_from_blob = (blobId, start, num, buffer) => {
		var blob = IDBStore.blobs[blobId];
		if (!blob) return 1;
		if (start + num > blob.size) return 2;
		var byteArray = new FileReaderSync().readAsArrayBuffer(
			blob.slice(start, start + num)
		);
		HEAPU8.set(new Uint8Array(byteArray), buffer);
		return 0;
	};
	_emscripten_idb_read_from_blob.sig = 'viiip';

	var _emscripten_idb_free_blob = (blobId) => {
		IDBStore.blobs[blobId] = null;
	};
	_emscripten_idb_free_blob.sig = 'vi';

	var _emscripten_scan_registers = (func) => {
		return Asyncify.handleSleep((wakeUp) => {
			// We must first unwind, so things are spilled to the stack. Then while
			// we are pausing we do the actual scan. After that we can resume. Note
			// how using a timeout here avoids unbounded call stack growth, which
			// could happen if we tried to scan the stack immediately after unwinding.
			safeSetTimeout(() => {
				var stackBegin = Asyncify.currData + 12;
				var stackEnd = HEAPU32[Asyncify.currData >> 2];
				getWasmTableEntry(func)(stackBegin, stackEnd);
				wakeUp();
			}, 0);
		});
	};
	_emscripten_scan_registers.sig = 'vp';
	_emscripten_scan_registers.isAsync = true;

	async function __load_secondary_module() {
		// Mark the module as loading for the wasm module (so it doesn't try to load it again).
		wasmExports['load_secondary_module_status'].value = 1;
		var imports = { primary: wasmRawExports };
		// Replace '.wasm' suffix with '.deferred.wasm'.
		var deferred = wasmBinaryFile.slice(0, -5) + '.deferred.wasm';
		await instantiateAsync(null, deferred, imports);
	}
	__load_secondary_module.sig = 'v';
	__load_secondary_module.isAsync = true;

	var Fibers = {
		nextFiber: 0,
		trampolineRunning: false,
		trampoline() {
			if (!Fibers.trampolineRunning && Fibers.nextFiber) {
				Fibers.trampolineRunning = true;
				do {
					var fiber = Fibers.nextFiber;
					Fibers.nextFiber = 0;
					Fibers.finishContextSwitch(fiber);
				} while (Fibers.nextFiber);
				Fibers.trampolineRunning = false;
			}
		},
		finishContextSwitch(newFiber) {
			var stack_base = HEAPU32[newFiber >> 2];
			var stack_max = HEAPU32[(newFiber + 4) >> 2];
			_emscripten_stack_set_limits(stack_base, stack_max);

			stackRestore(HEAPU32[(newFiber + 8) >> 2]);

			var entryPoint = HEAPU32[(newFiber + 12) >> 2];

			if (entryPoint !== 0) {
				Asyncify.currData = null;
				HEAPU32[(newFiber + 12) >> 2] = 0;

				var userData = HEAPU32[(newFiber + 16) >> 2];
				getWasmTableEntry(entryPoint)(userData);
			} else {
				var asyncifyData = newFiber + 20;
				Asyncify.currData = asyncifyData;

				Asyncify.state = Asyncify.State.Rewinding;
				_asyncify_start_rewind(asyncifyData);
				Asyncify.doRewind(asyncifyData);
			}
		},
	};

	var _emscripten_fiber_swap = (oldFiber, newFiber) => {
		if (ABORT) return;
		if (Asyncify.state === Asyncify.State.Normal) {
			Asyncify.state = Asyncify.State.Unwinding;

			var asyncifyData = oldFiber + 20;
			Asyncify.setDataRewindFunc(asyncifyData);
			Asyncify.currData = asyncifyData;

			_asyncify_start_unwind(asyncifyData);

			var stackTop = stackSave();
			HEAPU32[(oldFiber + 8) >> 2] = stackTop;

			Fibers.nextFiber = newFiber;
		} else {
			Asyncify.state = Asyncify.State.Normal;
			_asyncify_stop_rewind();
			Asyncify.currData = null;
		}
	};
	_emscripten_fiber_swap.sig = 'vpp';
	_emscripten_fiber_swap.isAsync = true;

	var _SDL_GetTicks = () => (Date.now() - SDL.startTime) | 0;
	_SDL_GetTicks.sig = 'i';

	var _SDL_LockSurface = (surf) => {
		var surfData = SDL.surfaces[surf];

		surfData.locked++;
		if (surfData.locked > 1) return 0;

		if (!surfData.buffer) {
			surfData.buffer = _malloc(surfData.width * surfData.height * 4);
			HEAPU32[(surf + 20) >> 2] = surfData.buffer;
		}

		// Mark in C/C++-accessible SDL structure
		// SDL_Surface has the following fields: Uint32 flags, SDL_PixelFormat *format; int w, h; Uint16 pitch; void *pixels; ...
		// So we have fields all of the same size, and 5 of them before us.
		// TODO: Use macros like in library.js
		HEAPU32[(surf + 20) >> 2] = surfData.buffer;

		if (surf == SDL.screen && Module.screenIsReadOnly && surfData.image)
			return 0;

		if (SDL.defaults.discardOnLock) {
			if (!surfData.image) {
				surfData.image = surfData.ctx.createImageData(
					surfData.width,
					surfData.height
				);
			}
			if (!SDL.defaults.opaqueFrontBuffer) return;
		} else {
			surfData.image = surfData.ctx.getImageData(
				0,
				0,
				surfData.width,
				surfData.height
			);
		}

		// Emulate desktop behavior and kill alpha values on the locked surface. (very costly!) Set SDL.defaults.opaqueFrontBuffer = false
		// if you don't want this.
		if (surf == SDL.screen && SDL.defaults.opaqueFrontBuffer) {
			var data = surfData.image.data;
			var num = data.length;
			for (var i = 0; i < num / 4; i++) {
				data[i * 4 + 3] = 255; // opacity, as canvases blend alpha
			}
		}

		if (SDL.defaults.copyOnLock && !SDL.defaults.discardOnLock) {
			// Copy pixel data to somewhere accessible to 'C/C++'
			if (surfData.isFlagSet(2097152)) {
				// If this is needed then
				// we should compact the data from 32bpp to 8bpp index.
				// I think best way to implement this is use
				// additional colorMap hash (color->index).
				// Something like this:
				//
				// var size = surfData.width * surfData.height;
				// var data = '';
				// for (var i = 0; i<size; i++) {
				//   var color = SDL.translateRGBAToColor(
				//     surfData.image.data[i*4   ],
				//     surfData.image.data[i*4 +1],
				//     surfData.image.data[i*4 +2],
				//     255);
				//   var index = surfData.colorMap[color];
				//   HEAP8[(surfData.buffer)+(i)] = index;
				// }
				abort(
					'CopyOnLock is not supported for SDL_LockSurface with SDL_HWPALETTE flag set'
				);
			} else {
				HEAPU8.set(surfData.image.data, surfData.buffer);
			}
		}

		return 0;
	};
	_SDL_LockSurface.sig = 'ip';

	var SDL = {
		defaults: {
			width: 320,
			height: 200,
			copyOnLock: true,
			discardOnLock: false,
			opaqueFrontBuffer: true,
		},
		version: null,
		surfaces: {},
		canvasPool: [],
		events: [],
		fonts: [null],
		audios: [null],
		rwops: [null],
		music: {
			audio: null,
			volume: 1,
		},
		mixerFrequency: 22050,
		mixerFormat: 32784,
		mixerNumChannels: 2,
		mixerChunkSize: 1024,
		channelMinimumNumber: 0,
		GL: false,
		glAttributes: {
			0: 3,
			1: 3,
			2: 2,
			3: 0,
			4: 0,
			5: 1,
			6: 16,
			7: 0,
			8: 0,
			9: 0,
			10: 0,
			11: 0,
			12: 0,
			13: 0,
			14: 0,
			15: 1,
			16: 0,
			17: 0,
			18: 0,
		},
		keyboardState: null,
		keyboardMap: {},
		canRequestFullscreen: false,
		isRequestingFullscreen: false,
		textInput: false,
		unicode: false,
		ttfContext: null,
		audio: null,
		startTime: null,
		initFlags: 0,
		buttonState: 0,
		modState: 0,
		DOMButtons: [0, 0, 0],
		DOMEventToSDLEvent: {},
		TOUCH_DEFAULT_ID: 0,
		eventHandler: null,
		eventHandlerContext: null,
		eventHandlerTemp: 0,
		keyCodes: {
			16: 1249,
			17: 1248,
			18: 1250,
			20: 1081,
			33: 1099,
			34: 1102,
			35: 1101,
			36: 1098,
			37: 1104,
			38: 1106,
			39: 1103,
			40: 1105,
			44: 316,
			45: 1097,
			46: 127,
			91: 1251,
			93: 1125,
			96: 1122,
			97: 1113,
			98: 1114,
			99: 1115,
			100: 1116,
			101: 1117,
			102: 1118,
			103: 1119,
			104: 1120,
			105: 1121,
			106: 1109,
			107: 1111,
			109: 1110,
			110: 1123,
			111: 1108,
			112: 1082,
			113: 1083,
			114: 1084,
			115: 1085,
			116: 1086,
			117: 1087,
			118: 1088,
			119: 1089,
			120: 1090,
			121: 1091,
			122: 1092,
			123: 1093,
			124: 1128,
			125: 1129,
			126: 1130,
			127: 1131,
			128: 1132,
			129: 1133,
			130: 1134,
			131: 1135,
			132: 1136,
			133: 1137,
			134: 1138,
			135: 1139,
			144: 1107,
			160: 94,
			161: 33,
			162: 34,
			163: 35,
			164: 36,
			165: 37,
			166: 38,
			167: 95,
			168: 40,
			169: 41,
			170: 42,
			171: 43,
			172: 124,
			173: 45,
			174: 123,
			175: 125,
			176: 126,
			181: 127,
			182: 129,
			183: 128,
			188: 44,
			190: 46,
			191: 47,
			192: 96,
			219: 91,
			220: 92,
			221: 93,
			222: 39,
			224: 1251,
		},
		scanCodes: {
			8: 42,
			9: 43,
			13: 40,
			27: 41,
			32: 44,
			35: 204,
			39: 53,
			44: 54,
			46: 55,
			47: 56,
			48: 39,
			49: 30,
			50: 31,
			51: 32,
			52: 33,
			53: 34,
			54: 35,
			55: 36,
			56: 37,
			57: 38,
			58: 203,
			59: 51,
			61: 46,
			91: 47,
			92: 49,
			93: 48,
			96: 52,
			97: 4,
			98: 5,
			99: 6,
			100: 7,
			101: 8,
			102: 9,
			103: 10,
			104: 11,
			105: 12,
			106: 13,
			107: 14,
			108: 15,
			109: 16,
			110: 17,
			111: 18,
			112: 19,
			113: 20,
			114: 21,
			115: 22,
			116: 23,
			117: 24,
			118: 25,
			119: 26,
			120: 27,
			121: 28,
			122: 29,
			127: 76,
			305: 224,
			308: 226,
			316: 70,
		},
		loadRect(rect) {
			return {
				x: HEAP32[rect >> 2],
				y: HEAP32[(rect + 4) >> 2],
				w: HEAP32[(rect + 8) >> 2],
				h: HEAP32[(rect + 12) >> 2],
			};
		},
		updateRect(rect, r) {
			HEAP32[rect >> 2] = r.x;
			HEAP32[(rect + 4) >> 2] = r.y;
			HEAP32[(rect + 8) >> 2] = r.w;
			HEAP32[(rect + 12) >> 2] = r.h;
		},
		intersectionOfRects(first, second) {
			var leftX = Math.max(first.x, second.x);
			var leftY = Math.max(first.y, second.y);
			var rightX = Math.min(first.x + first.w, second.x + second.w);
			var rightY = Math.min(first.y + first.h, second.y + second.h);

			return {
				x: leftX,
				y: leftY,
				w: Math.max(leftX, rightX) - leftX,
				h: Math.max(leftY, rightY) - leftY,
			};
		},
		checkPixelFormat(fmt) {},
		loadColorToCSSRGB(color) {
			var rgba = HEAP32[color >> 2];
			return (
				'rgb(' +
				(rgba & 255) +
				',' +
				((rgba >> 8) & 255) +
				',' +
				((rgba >> 16) & 255) +
				')'
			);
		},
		loadColorToCSSRGBA(color) {
			var rgba = HEAP32[color >> 2];
			return (
				'rgba(' +
				(rgba & 255) +
				',' +
				((rgba >> 8) & 255) +
				',' +
				((rgba >> 16) & 255) +
				',' +
				((rgba >> 24) & 255) / 255 +
				')'
			);
		},
		translateColorToCSSRGBA: (rgba) =>
			'rgba(' +
			(rgba & 0xff) +
			',' +
			((rgba >> 8) & 0xff) +
			',' +
			((rgba >> 16) & 0xff) +
			',' +
			(rgba >>> 24) / 0xff +
			')',
		translateRGBAToCSSRGBA: (r, g, b, a) =>
			'rgba(' +
			(r & 0xff) +
			',' +
			(g & 0xff) +
			',' +
			(b & 0xff) +
			',' +
			(a & 0xff) / 255 +
			')',
		translateRGBAToColor: (r, g, b, a) =>
			r | (g << 8) | (b << 16) | (a << 24),
		makeSurface(
			width,
			height,
			flags,
			usePageCanvas,
			source,
			rmask,
			gmask,
			bmask,
			amask
		) {
			var is_SDL_HWSURFACE = flags & 134217729;
			var is_SDL_HWPALETTE = flags & 2097152;
			var is_SDL_OPENGL = flags & 67108864;

			var surf = _malloc(60);
			var pixelFormat = _malloc(44);
			// surface with SDL_HWPALETTE flag is 8bpp surface (1 byte)
			var bpp = is_SDL_HWPALETTE ? 1 : 4;
			var buffer = 0;

			// preemptively initialize this for software surfaces,
			// otherwise it will be lazily initialized inside of SDL_LockSurface
			if (!is_SDL_HWSURFACE && !is_SDL_OPENGL) {
				buffer = _malloc(width * height * 4);
			}

			HEAP32[surf >> 2] = flags;
			HEAPU32[(surf + 4) >> 2] = pixelFormat;
			HEAP32[(surf + 8) >> 2] = width;
			HEAP32[(surf + 12) >> 2] = height;
			HEAP32[(surf + 16) >> 2] = width * bpp; // assuming RGBA or indexed for now,
			// since that is what ImageData gives us in browsers
			HEAPU32[(surf + 20) >> 2] = buffer;

			var canvas = Browser.getCanvas();
			HEAP32[(surf + 36) >> 2] = 0;
			HEAP32[(surf + 40) >> 2] = 0;
			HEAP32[(surf + 44) >> 2] = canvas.width;
			HEAP32[(surf + 48) >> 2] = canvas.height;

			HEAP32[(surf + 56) >> 2] = 1;

			HEAP32[pixelFormat >> 2] = -2042224636;
			HEAP32[(pixelFormat + 4) >> 2] = 0; // TODO
			HEAP8[pixelFormat + 8] = bpp * 8;
			HEAP8[pixelFormat + 9] = bpp;

			HEAP32[(pixelFormat + 12) >> 2] = rmask || 0x000000ff;
			HEAP32[(pixelFormat + 16) >> 2] = gmask || 0x0000ff00;
			HEAP32[(pixelFormat + 20) >> 2] = bmask || 0x00ff0000;
			HEAP32[(pixelFormat + 24) >> 2] = amask || 0xff000000;

			// Decide if we want to use WebGL or not
			SDL.GL = SDL.GL || is_SDL_OPENGL;
			if (!usePageCanvas) {
				if (SDL.canvasPool.length > 0) {
					canvas = SDL.canvasPool.pop();
				} else {
					canvas = document.createElement('canvas');
				}
				canvas.width = width;
				canvas.height = height;
			}

			var webGLContextAttributes = {
				antialias:
					SDL.glAttributes[13] != 0 && SDL.glAttributes[14] > 1,
				depth: SDL.glAttributes[6] > 0,
				stencil: SDL.glAttributes[7] > 0,
				alpha: SDL.glAttributes[3] > 0,
			};

			var ctx = Browser.createContext(
				canvas,
				is_SDL_OPENGL,
				usePageCanvas,
				webGLContextAttributes
			);

			SDL.surfaces[surf] = {
				width,
				height,
				canvas,
				ctx,
				surf,
				buffer,
				pixelFormat,
				alpha: 255,
				flags,
				locked: 0,
				usePageCanvas,
				source,

				isFlagSet: (flag) => flags & flag,
			};

			return surf;
		},
		copyIndexedColorData(surfData, rX, rY, rW, rH) {
			// HWPALETTE works with palette
			// set by SDL_SetColors
			if (!surfData.colors) {
				return;
			}

			var canvas = Browser.getCanvas();
			var fullWidth = canvas.width;
			var fullHeight = canvas.height;

			var startX = rX || 0;
			var startY = rY || 0;
			var endX = (rW || fullWidth - startX) + startX;
			var endY = (rH || fullHeight - startY) + startY;

			var buffer = surfData.buffer;

			if (!surfData.image.data32) {
				surfData.image.data32 = new Uint32Array(
					surfData.image.data.buffer
				);
			}
			var data32 = surfData.image.data32;

			var colors32 = surfData.colors32;

			for (var y = startY; y < endY; ++y) {
				var base = y * fullWidth;
				for (var x = startX; x < endX; ++x) {
					data32[base + x] = colors32[HEAPU8[buffer + (base + x)]];
				}
			}
		},
		freeSurface(surf) {
			var refcountPointer = surf + 56;
			var refcount = HEAP32[refcountPointer >> 2];
			if (refcount > 1) {
				HEAP32[refcountPointer >> 2] = refcount - 1;
				return;
			}

			var info = SDL.surfaces[surf];
			if (!info.usePageCanvas && info.canvas)
				SDL.canvasPool.push(info.canvas);
			_free(info.buffer);
			_free(info.pixelFormat);
			_free(surf);
			SDL.surfaces[surf] = null;

			if (surf === SDL.screen) {
				SDL.screen = null;
			}
		},
		blitSurface(src, srcrect, dst, dstrect, scale) {
			var srcData = SDL.surfaces[src];
			var dstData = SDL.surfaces[dst];
			var sr, dr;
			if (srcrect) {
				sr = SDL.loadRect(srcrect);
			} else {
				sr = { x: 0, y: 0, w: srcData.width, h: srcData.height };
			}
			if (dstrect) {
				dr = SDL.loadRect(dstrect);
			} else {
				dr = { x: 0, y: 0, w: srcData.width, h: srcData.height };
			}
			if (dstData.clipRect) {
				var widthScale = !scale || sr.w === 0 ? 1 : sr.w / dr.w;
				var heightScale = !scale || sr.h === 0 ? 1 : sr.h / dr.h;

				dr = SDL.intersectionOfRects(dstData.clipRect, dr);

				sr.w = dr.w * widthScale;
				sr.h = dr.h * heightScale;

				if (dstrect) {
					SDL.updateRect(dstrect, dr);
				}
			}
			var blitw, blith;
			if (scale) {
				blitw = dr.w;
				blith = dr.h;
			} else {
				blitw = sr.w;
				blith = sr.h;
			}
			if (sr.w === 0 || sr.h === 0 || blitw === 0 || blith === 0) {
				return 0;
			}
			var oldAlpha = dstData.ctx.globalAlpha;
			dstData.ctx.globalAlpha = srcData.alpha / 255;
			dstData.ctx.drawImage(
				srcData.canvas,
				sr.x,
				sr.y,
				sr.w,
				sr.h,
				dr.x,
				dr.y,
				blitw,
				blith
			);
			dstData.ctx.globalAlpha = oldAlpha;
			if (dst != SDL.screen) {
				// XXX As in IMG_Load, for compatibility we write out |pixels|
				warnOnce(
					'WARNING: copying canvas data to memory for compatibility'
				);
				_SDL_LockSurface(dst);
				dstData.locked--; // The surface is not actually locked in this hack
			}
			return 0;
		},
		downFingers: {},
		savedKeydown: null,
		receiveEvent(event) {
			function unpressAllPressedKeys() {
				// Un-press all pressed keys: TODO
				for (var keyCode of Object.values(SDL.keyboardMap)) {
					SDL.events.push({
						type: 'keyup',
						keyCode,
					});
				}
			}
			switch (event.type) {
				case 'touchstart':
				case 'touchmove': {
					event.preventDefault();

					var touches = [];

					// Clear out any touchstart events that we've already processed
					if (event.type === 'touchstart') {
						for (var touch of event.touches) {
							if (SDL.downFingers[touch.identifier] != true) {
								SDL.downFingers[touch.identifier] = true;
								touches.push(touch);
							}
						}
					} else {
						touches = event.touches;
					}

					var firstTouch = touches[0];
					if (firstTouch) {
						if (event.type == 'touchstart') {
							SDL.DOMButtons[0] = 1;
						}
						var mouseEventType;
						switch (event.type) {
							case 'touchstart':
								mouseEventType = 'mousedown';
								break;
							case 'touchmove':
								mouseEventType = 'mousemove';
								break;
						}
						var mouseEvent = {
							type: mouseEventType,
							button: 0,
							pageX: firstTouch.clientX,
							pageY: firstTouch.clientY,
						};
						SDL.events.push(mouseEvent);
					}

					for (var touch of touches) {
						SDL.events.push({
							type: event.type,
							touch,
						});
					}
					break;
				}
				case 'touchend': {
					event.preventDefault();

					// Remove the entry in the SDL.downFingers hash
					// because the finger is no longer down.
					for (var touch of event.changedTouches) {
						if (SDL.downFingers[touch.identifier] === true) {
							delete SDL.downFingers[touch.identifier];
						}
					}

					var mouseEvent = {
						type: 'mouseup',
						button: 0,
						pageX: event.changedTouches[0].clientX,
						pageY: event.changedTouches[0].clientY,
					};
					SDL.DOMButtons[0] = 0;
					SDL.events.push(mouseEvent);

					for (var touch of event.changedTouches) {
						SDL.events.push({
							type: 'touchend',
							touch,
						});
					}
					break;
				}
				case 'DOMMouseScroll':
				case 'mousewheel':
				case 'wheel':
					// Flip the wheel direction to translate from browser wheel direction
					// (+:down) to SDL direction (+:up)
					var delta = -Browser.getMouseWheelDelta(event);
					// Quantize to integer so that minimum scroll is at least +/- 1.
					delta =
						delta == 0
							? 0
							: delta > 0
								? Math.max(delta, 1)
								: Math.min(delta, -1);

					// Simulate old-style SDL events representing mouse wheel input as buttons
					// Subtract one since JS->C marshalling is defined to add one back.
					var button = (delta > 0 ? 4 : 5) - 1;
					SDL.events.push({
						type: 'mousedown',
						button,
						pageX: event.pageX,
						pageY: event.pageY,
					});
					SDL.events.push({
						type: 'mouseup',
						button,
						pageX: event.pageX,
						pageY: event.pageY,
					});

					// Pass a delta motion event.
					SDL.events.push({
						type: 'wheel',
						deltaX: 0,
						deltaY: delta,
					});
					// If we don't prevent this, then 'wheel' event will be sent again by
					// the browser as 'DOMMouseScroll' and we will receive this same event
					// the second time.
					event.preventDefault();
					break;
				case 'mousemove':
					if (SDL.DOMButtons[0] === 1) {
						SDL.events.push({
							type: 'touchmove',
							touch: {
								identifier: 0,
								deviceID: -1,
								pageX: event.pageX,
								pageY: event.pageY,
							},
						});
					}
					if (Browser.pointerLock) {
						// workaround for firefox bug 750111
						if ('mozMovementX' in event) {
							event['movementX'] = event['mozMovementX'];
							event['movementY'] = event['mozMovementY'];
						}
						// workaround for Firefox bug 782777
						if (
							event['movementX'] == 0 &&
							event['movementY'] == 0
						) {
							// ignore a mousemove event if it doesn't contain any movement info
							// (without pointer lock, we infer movement from pageX/pageY, so this check is unnecessary)
							event.preventDefault();
							return;
						}
					}
				// fall through
				case 'keydown':
				case 'keyup':
				case 'keypress':
				case 'mousedown':
				case 'mouseup':
					// If we preventDefault on keydown events, the subsequent keypress events
					// won't fire. However, it's fine (and in some cases necessary) to
					// preventDefault for keys that don't generate a character. Otherwise,
					// preventDefault is the right thing to do in general.
					if (
						event.type !== 'keydown' ||
						(!SDL.unicode && !SDL.textInput) ||
						event.key == 'Backspace' ||
						event.key == 'Tab'
					) {
						event.preventDefault();
					}

					if (event.type == 'mousedown') {
						SDL.DOMButtons[event.button] = 1;
						SDL.events.push({
							type: 'touchstart',
							touch: {
								identifier: 0,
								deviceID: -1,
								pageX: event.pageX,
								pageY: event.pageY,
							},
						});
					} else if (event.type == 'mouseup') {
						// ignore extra ups, can happen if we leave the canvas while pressing down, then return,
						// since we add a mouseup in that case
						if (!SDL.DOMButtons[event.button]) {
							return;
						}

						SDL.events.push({
							type: 'touchend',
							touch: {
								identifier: 0,
								deviceID: -1,
								pageX: event.pageX,
								pageY: event.pageY,
							},
						});
						SDL.DOMButtons[event.button] = 0;
					}

					// We can only request fullscreen as the result of user input.
					// Due to this limitation, we toggle a boolean on keydown which
					// SDL_WM_ToggleFullScreen will check and subsequently set another
					// flag indicating for us to request fullscreen on the following
					// keyup. This isn't perfect, but it enables SDL_WM_ToggleFullScreen
					// to work as the result of a keypress (which is an extremely
					// common use case).
					if (
						event.type === 'keydown' ||
						event.type === 'mousedown'
					) {
						SDL.canRequestFullscreen = true;
					} else if (
						event.type === 'keyup' ||
						event.type === 'mouseup'
					) {
						if (SDL.isRequestingFullscreen) {
							Module['requestFullscreen'](
								/*lockPointer=*/ true,
								/*resizeCanvas=*/ true
							);
							SDL.isRequestingFullscreen = false;
						}
						SDL.canRequestFullscreen = false;
					}

					// SDL expects a unicode character to be passed to its keydown events.
					// Unfortunately, the browser APIs only provide a charCode property on
					// keypress events, so we must backfill in keydown events with their
					// subsequent keypress event's charCode.
					if (event.type === 'keypress' && SDL.savedKeydown) {
						// charCode is read-only
						SDL.savedKeydown.keypressCharCode = event.charCode;
						SDL.savedKeydown = null;
					} else if (event.type === 'keydown') {
						SDL.savedKeydown = event;
					}

					// Don't push keypress events unless SDL_StartTextInput has been called.
					if (event.type !== 'keypress' || SDL.textInput) {
						SDL.events.push(event);
					}
					break;
				case 'mouseout':
					// Un-press all pressed mouse buttons, because we might miss the release outside of the canvas
					for (var i = 0; i < 3; i++) {
						if (SDL.DOMButtons[i]) {
							SDL.events.push({
								type: 'mouseup',
								button: i,
								pageX: event.pageX,
								pageY: event.pageY,
							});
							SDL.DOMButtons[i] = 0;
						}
					}
					event.preventDefault();
					break;
				case 'focus':
					SDL.events.push(event);
					event.preventDefault();
					break;
				case 'blur':
					SDL.events.push(event);
					unpressAllPressedKeys();
					event.preventDefault();
					break;
				case 'visibilitychange':
					SDL.events.push({
						type: 'visibilitychange',
						visible: !document.hidden,
					});
					unpressAllPressedKeys();
					event.preventDefault();
					break;
				case 'unload':
					if (MainLoop.runner) {
						SDL.events.push(event);
						// Force-run a main event loop, since otherwise this event will never be caught!
						MainLoop.runner();
					}
					return;
				case 'resize':
					SDL.events.push(event);
					// manually triggered resize event doesn't have a preventDefault member
					if (event.preventDefault) {
						event.preventDefault();
					}
					break;
			}
			if (SDL.events.length >= 10000) {
				err('SDL event queue full, dropping events');
				SDL.events = SDL.events.slice(0, 10000);
			}
			// If we have a handler installed, this will push the events to the app
			// instead of the app polling for them.
			SDL.flushEventsToHandler();
			return;
		},
		lookupKeyCodeForEvent(event) {
			var code = event.keyCode;
			if (code >= 65 && code <= 90) {
				// ASCII A-Z
				code += 32; // make lowercase for SDL
			} else {
				// Look up DOM code in the keyCodes table with fallback for ASCII codes
				// which can match between DOM codes and SDL keycodes (allows keyCodes
				// to be smaller).
				code = SDL.keyCodes[code] || (code < 128 ? code : 0);
				// If this is one of the modifier keys (224 | 1<<10 - 227 | 1<<10), and the event specifies that it is
				// a right key, add 4 to get the right key SDL key code.
				if (
					event.location ===
						2 /*KeyboardEvent.DOM_KEY_LOCATION_RIGHT*/ &&
					code >= (224 | (1 << 10)) &&
					code <= (227 | (1 << 10))
				) {
					code += 4;
				}
			}
			return code;
		},
		handleEvent(event) {
			if (event.handled) return;
			event.handled = true;

			switch (event.type) {
				case 'touchstart':
				case 'touchend':
				case 'touchmove': {
					Browser.calculateMouseEvent(event);
					break;
				}
				case 'keydown':
				case 'keyup': {
					var down = event.type === 'keydown';
					var code = SDL.lookupKeyCodeForEvent(event);
					// Ignore key events that we don't (yet) map to SDL keys
					if (!code) return;
					// Assigning a boolean to HEAP8, that's alright but Closure would like to warn about it.
					// TODO(https://github.com/emscripten-core/emscripten/issues/16311):
					// This is kind of ugly hack.  Perhaps we can find a better way?
					/** @suppress{checkTypes} */
					HEAP8[SDL.keyboardState + code] = down;
					// TODO: lmeta, rmeta, numlock, capslock, KMOD_MODE, KMOD_RESERVED
					SDL.modState =
						(HEAP8[SDL.keyboardState + 1248] ? 64 : 0) |
						(HEAP8[SDL.keyboardState + 1249] ? 1 : 0) |
						(HEAP8[SDL.keyboardState + 1250] ? 256 : 0) |
						(HEAP8[SDL.keyboardState + 1252] ? 128 : 0) |
						(HEAP8[SDL.keyboardState + 1253] ? 2 : 0) |
						(HEAP8[SDL.keyboardState + 1254] ? 512 : 0);
					if (down) {
						SDL.keyboardMap[code] = event.keyCode; // save the DOM input, which we can use to unpress it during blur
					} else {
						delete SDL.keyboardMap[code];
					}

					break;
				}
				case 'mousedown':
				case 'mouseup':
					if (event.type == 'mousedown') {
						// SDL_BUTTON(x) is defined as (1 << ((x)-1)).  SDL buttons are 1-3,
						// and DOM buttons are 0-2, so this means that the below formula is
						// correct.
						SDL.buttonState |= 1 << event.button;
					} else if (event.type == 'mouseup') {
						SDL.buttonState &= ~(1 << event.button);
					}
				// fall through
				case 'mousemove': {
					Browser.calculateMouseEvent(event);
					break;
				}
			}
		},
		flushEventsToHandler() {
			if (!SDL.eventHandler) return;

			while (SDL.pollEvent(SDL.eventHandlerTemp)) {
				getWasmTableEntry(SDL.eventHandler)(
					SDL.eventHandlerContext,
					SDL.eventHandlerTemp
				);
			}
		},
		pollEvent(ptr) {
			if (SDL.initFlags & 512 && SDL.joystickEventState) {
				// If SDL_INIT_JOYSTICK was supplied AND the joystick system is configured
				// to automatically query for events, query for joystick events.
				SDL.queryJoysticks();
			}
			if (ptr) {
				while (SDL.events.length > 0) {
					if (SDL.makeCEvent(SDL.events.shift(), ptr) !== false)
						return 1;
				}
				return 0;
			}
			// XXX: somewhat risky in that we do not check if the event is real or not
			// (makeCEvent returns false) if no pointer supplied
			return SDL.events.length > 0;
		},
		makeCEvent(event, ptr) {
			if (typeof event == 'number') {
				// This is a pointer to a copy of a native C event that was SDL_PushEvent'ed
				_memcpy(ptr, event, 28);
				_free(event); // the copy is no longer needed
				return;
			}

			SDL.handleEvent(event);

			switch (event.type) {
				case 'keydown':
				case 'keyup': {
					var down = event.type === 'keydown';
					var key = SDL.lookupKeyCodeForEvent(event);
					// Ignore key events that we don't (yet) map to SDL keys
					if (!key) return false;
					var scan;
					if (key >= 1024) {
						scan = key - 1024;
					} else {
						scan = SDL.scanCodes[key] || key;
					}

					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP8[ptr + 8] = down ? 1 : 0;
					HEAP8[ptr + 9] = 0; // TODO
					HEAP32[(ptr + 12) >> 2] = scan;
					HEAP32[(ptr + 16) >> 2] = key;
					HEAP16[(ptr + 20) >> 1] = SDL.modState;
					// some non-character keys (e.g. backspace and tab) won't have keypressCharCode set, fill in with the keyCode.
					HEAP32[(ptr + 24) >> 2] = event.keypressCharCode || key;

					break;
				}
				case 'keypress': {
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					// Not filling in windowID for now
					stringToUTF8(
						String.fromCharCode(event.charCode),
						ptr + 8,
						4
					);
					break;
				}
				case 'mousedown':
				case 'mouseup':
				case 'mousemove': {
					if (event.type != 'mousemove') {
						var down = event.type === 'mousedown';
						HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
						HEAP32[(ptr + 4) >> 2] = 0;
						HEAP32[(ptr + 8) >> 2] = 0;
						HEAP32[(ptr + 12) >> 2] = 0;
						HEAP8[ptr + 16] = event.button + 1; // DOM buttons are 0-2, SDL 1-3
						HEAP8[ptr + 17] = down ? 1 : 0;
						HEAP32[(ptr + 20) >> 2] = Browser.mouseX;
						HEAP32[(ptr + 24) >> 2] = Browser.mouseY;
					} else {
						HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
						HEAP32[(ptr + 4) >> 2] = 0;
						HEAP32[(ptr + 8) >> 2] = 0;
						HEAP32[(ptr + 12) >> 2] = 0;
						HEAP32[(ptr + 16) >> 2] = SDL.buttonState;
						HEAP32[(ptr + 20) >> 2] = Browser.mouseX;
						HEAP32[(ptr + 24) >> 2] = Browser.mouseY;
						HEAP32[(ptr + 28) >> 2] = Browser.mouseMovementX;
						HEAP32[(ptr + 32) >> 2] = Browser.mouseMovementY;
					}
					break;
				}
				case 'wheel': {
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP32[(ptr + 16) >> 2] = event.deltaX;
					HEAP32[(ptr + 20) >> 2] = event.deltaY;
					break;
				}
				case 'touchstart':
				case 'touchend':
				case 'touchmove': {
					var touch = event.touch;
					if (!Browser.touches[touch.identifier]) break;
					var canvas = Browser.getCanvas();
					var x = Browser.touches[touch.identifier].x / canvas.width;
					var y = Browser.touches[touch.identifier].y / canvas.height;
					var lx =
						Browser.lastTouches[touch.identifier].x / canvas.width;
					var ly =
						Browser.lastTouches[touch.identifier].y / canvas.height;
					var dx = x - lx;
					var dy = y - ly;
					if (touch['deviceID'] === undefined)
						touch.deviceID = SDL.TOUCH_DEFAULT_ID;
					if (dx === 0 && dy === 0 && event.type === 'touchmove')
						return false; // don't send these if nothing happened
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP32[(ptr + 4) >> 2] = _SDL_GetTicks();
					HEAP64[(ptr + 8) >> 3] = BigInt(touch.deviceID);
					HEAP64[(ptr + 16) >> 3] = BigInt(touch.identifier);
					HEAPF32[(ptr + 24) >> 2] = x;
					HEAPF32[(ptr + 28) >> 2] = y;
					HEAPF32[(ptr + 32) >> 2] = dx;
					HEAPF32[(ptr + 36) >> 2] = dy;
					if (touch.force !== undefined) {
						HEAPF32[(ptr + 40) >> 2] = touch.force;
					} else {
						// No pressure data, send a digital 0/1 pressure.
						HEAPF32[(ptr + 40) >> 2] =
							event.type == 'touchend' ? 0 : 1;
					}
					break;
				}
				case 'unload': {
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					break;
				}
				case 'resize': {
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP32[(ptr + 4) >> 2] = event.w;
					HEAP32[(ptr + 8) >> 2] = event.h;
					break;
				}
				case 'joystick_button_up':
				case 'joystick_button_down': {
					var state = event.type === 'joystick_button_up' ? 0 : 1;
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP8[ptr + 4] = event.index;
					HEAP8[ptr + 5] = event.button;
					HEAP8[ptr + 6] = state;
					break;
				}
				case 'joystick_axis_motion': {
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP8[ptr + 4] = event.index;
					HEAP8[ptr + 5] = event.axis;
					HEAP32[(ptr + 8) >> 2] = SDL.joystickAxisValueConversion(
						event.value
					);
					break;
				}
				case 'focus': {
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP32[(ptr + 4) >> 2] = 0;
					HEAP8[ptr + 8] = 12;
					break;
				}
				case 'blur': {
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP32[(ptr + 4) >> 2] = 0;
					HEAP8[ptr + 8] = 13;
					break;
				}
				case 'visibilitychange': {
					var visibilityEventID = event.visible ? 1 : 2;
					HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
					HEAP32[(ptr + 4) >> 2] = 0;
					HEAP8[ptr + 8] = visibilityEventID;
					break;
				}
				default:
					abort('Unhandled SDL event: ' + event.type);
			}
		},
		makeFontString(height, fontName) {
			if (fontName.charAt(0) != "'" && fontName.charAt(0) != '"') {
				// https://developer.mozilla.org/ru/docs/Web/CSS/font-family
				// Font family names containing whitespace should be quoted.
				// BTW, quote all font names is easier than searching spaces
				fontName = '"' + fontName + '"';
			}
			return height + 'px ' + fontName + ', serif';
		},
		estimateTextWidth(fontData, text) {
			var h = fontData.size;
			var fontString = SDL.makeFontString(h, fontData.name);
			var tempCtx = SDL.ttfContext;
			tempCtx.font = fontString;
			var ret = tempCtx.measureText(text).width | 0;
			return ret;
		},
		allocateChannels(num) {
			// called from Mix_AllocateChannels and init
			if (SDL.numChannels >= num && num != 0) return;
			SDL.numChannels = num;
			SDL.channels = [];
			for (var i = 0; i < num; i++) {
				SDL.channels[i] = {
					audio: null,
					volume: 1.0,
				};
			}
		},
		setGetVolume(info, volume) {
			if (!info) return 0;
			var ret = info.volume * 128; // MIX_MAX_VOLUME
			if (volume != -1) {
				info.volume = Math.min(Math.max(volume, 0), 128) / 128;
				if (info.audio) {
					try {
						info.audio.volume = info.volume; // For <audio> element
						if (info.audio.webAudioGainNode)
							info.audio.webAudioGainNode['gain']['value'] =
								info.volume; // For WebAudio playback
					} catch (e) {
						err(`setGetVolume failed to set audio volume: ${e}`);
					}
				}
			}
			return ret;
		},
		setPannerPosition(info, x, y, z) {
			info?.audio?.webAudioPannerNode?.['setPosition'](x, y, z);
		},
		playWebAudio(audio) {
			if (!audio) return;
			if (audio.webAudioNode) return; // This instance is already playing, don't start again.
			if (!SDL.webAudioAvailable()) return;
			try {
				var webAudio = audio.resource.webAudio;
				audio.paused = false;
				if (!webAudio.decodedBuffer) {
					if (webAudio.onDecodeComplete === undefined) {
						abort(
							'Cannot play back audio object that was not loaded'
						);
					}
					webAudio.onDecodeComplete.push(() => {
						if (!audio.paused) SDL.playWebAudio(audio);
					});
					return;
				}
				audio.webAudioNode = SDL.audioContext['createBufferSource']();
				audio.webAudioNode['buffer'] = webAudio.decodedBuffer;
				audio.webAudioNode['loop'] = audio.loop;
				audio.webAudioNode['onended'] = audio['onended']; // For <media> element compatibility, route the onended signal to the instance.

				audio.webAudioPannerNode = SDL.audioContext['createPanner']();
				// avoid Chrome bug
				// If posz = 0, the sound will come from only the right.
				// By posz = -0.5 (slightly ahead), the sound will come from right and left correctly.
				audio.webAudioPannerNode['setPosition'](0, 0, -0.5);
				audio.webAudioPannerNode['panningModel'] = 'equalpower';

				// Add an intermediate gain node to control volume.
				audio.webAudioGainNode = SDL.audioContext['createGain']();
				audio.webAudioGainNode['gain']['value'] = audio.volume;

				audio.webAudioNode['connect'](audio.webAudioPannerNode);
				audio.webAudioPannerNode['connect'](audio.webAudioGainNode);
				audio.webAudioGainNode['connect'](
					SDL.audioContext['destination']
				);

				audio.webAudioNode['start'](0, audio.currentPosition);
				audio.startTime =
					SDL.audioContext['currentTime'] - audio.currentPosition;
			} catch (e) {
				err(`playWebAudio failed: ${e}`);
			}
		},
		pauseWebAudio(audio) {
			if (!audio) return;
			if (audio.webAudioNode) {
				try {
					// Remember where we left off, so that if/when we resume, we can
					// restart the playback at a proper place.
					audio.currentPosition =
						(SDL.audioContext['currentTime'] - audio.startTime) %
						audio.resource.webAudio.decodedBuffer.duration;
					// Important: When we reach here, the audio playback is stopped by the
					// user. But when calling .stop() below, the Web Audio graph will send
					// the onended signal, but we don't want to process that, since
					// pausing should not clear/destroy the audio channel.
					audio.webAudioNode['onended'] = undefined;
					audio.webAudioNode.stop(0); // 0 is a default parameter, but WebKit is confused by it #3861
					audio.webAudioNode = undefined;
				} catch (e) {
					err(`pauseWebAudio failed: ${e}`);
				}
			}
			audio.paused = true;
		},
		openAudioContext() {
			// Initialize Web Audio API if we haven't done so yet. Note: Only
			// initialize Web Audio context ever once on the web page, since
			// initializing multiple times fails on Chrome saying 'audio resources
			// have been exhausted'.
			if (!SDL.audioContext) {
				if (typeof AudioContext != 'undefined') {
					SDL.audioContext = new AudioContext();
				} else if (typeof webkitAudioContext != 'undefined') {
					SDL.audioContext = new webkitAudioContext();
				}
			}
		},
		webAudioAvailable: () => !!SDL.audioContext,
		fillWebAudioBufferFromHeap(
			heapPtr,
			sizeSamplesPerChannel,
			dstAudioBuffer
		) {
			// The input audio data is interleaved across the channels, i.e. [L, R, L,
			// R, L, R, ...] and is either 8-bit, 16-bit or float as supported by the
			// SDL API. The output audio wave data for Web Audio API must be in planar
			// buffers of [-1,1]-normalized Float32 data, so perform a buffer
			// conversion for the data.
			var audio = SDL.audio;
			var numChannels = audio.channels;
			for (var c = 0; c < numChannels; ++c) {
				var channelData = dstAudioBuffer['getChannelData'](c);
				if (channelData.length != sizeSamplesPerChannel) {
					abort(
						'Web Audio output buffer length mismatch! Destination size: ' +
							channelData.length +
							' samples vs expected ' +
							sizeSamplesPerChannel +
							' samples!'
					);
				}
				if (audio.format == 32784) {
					for (var j = 0; j < sizeSamplesPerChannel; ++j) {
						channelData[j] =
							HEAP16[(heapPtr + (j * numChannels + c) * 2) >> 1] /
							0x8000;
					}
				} else if (audio.format == 8) {
					for (var j = 0; j < sizeSamplesPerChannel; ++j) {
						var v = HEAP8[heapPtr + (j * numChannels + c)];
						channelData[j] = (v >= 0 ? v - 128 : v + 128) / 128;
					}
				} else if (audio.format == 33056) {
					for (var j = 0; j < sizeSamplesPerChannel; ++j) {
						channelData[j] =
							HEAPF32[(heapPtr + (j * numChannels + c) * 4) >> 2];
					}
				} else {
					abort('Invalid SDL audio format ' + audio.format + '!');
				}
			}
		},
		joystickEventState: 1,
		lastJoystickState: {},
		joystickNamePool: {},
		recordJoystickState(joystick, state) {
			// Standardize button state.
			var buttons = [];
			for (var button of state.buttons) {
				buttons.push(SDL.getJoystickButtonState(button));
			}

			SDL.lastJoystickState[joystick] = {
				buttons,
				axes: state.axes.slice(0),
				timestamp: state.timestamp,
				index: state.index,
				id: state.id,
			};
		},
		getJoystickButtonState(button) {
			if (typeof button == 'object') {
				// Current gamepad API editor's draft (Firefox Nightly)
				// https://dvcs.w3.org/hg/gamepad/raw-file/default/gamepad.html#idl-def-GamepadButton
				return button['pressed'];
			}
			// Current gamepad API working draft (Firefox / Chrome Stable)
			// http://www.w3.org/TR/2012/WD-gamepad-20120529/#gamepad-interface
			return button > 0;
		},
		queryJoysticks() {
			for (var joystick in SDL.lastJoystickState) {
				var state = SDL.getGamepad(joystick - 1);
				var prevState = SDL.lastJoystickState[joystick];
				// If joystick was removed, state returns null.
				if (typeof state == 'undefined') return;
				if (state === null) return;
				// Check only if the timestamp has differed.
				// NOTE: Timestamp is not available in Firefox.
				// NOTE: Timestamp is currently not properly set for the GearVR controller
				//       on Samsung Internet: it is always zero.
				if (
					typeof state.timestamp != 'number' ||
					state.timestamp != prevState.timestamp ||
					!state.timestamp
				) {
					var i;
					for (i = 0; i < state.buttons.length; i++) {
						var buttonState = SDL.getJoystickButtonState(
							state.buttons[i]
						);
						// NOTE: The previous state already has a boolean representation of
						//       its button, so no need to standardize its button state here.
						if (buttonState !== prevState.buttons[i]) {
							// Insert button-press event.
							SDL.events.push({
								type: buttonState
									? 'joystick_button_down'
									: 'joystick_button_up',
								joystick,
								index: joystick - 1,
								button: i,
							});
						}
					}
					for (i = 0; i < state.axes.length; i++) {
						if (state.axes[i] !== prevState.axes[i]) {
							// Insert axes-change event.
							SDL.events.push({
								type: 'joystick_axis_motion',
								joystick,
								index: joystick - 1,
								axis: i,
								value: state.axes[i],
							});
						}
					}

					SDL.recordJoystickState(joystick, state);
				}
			}
		},
		joystickAxisValueConversion(value) {
			// Make sure value is properly clamped
			value = Math.min(1, Math.max(value, -1));
			// Ensures that 0 is 0, 1 is 32767, and -1 is 32768.
			return Math.ceil((value + 1) * 32767.5 - 32768);
		},
		getGamepads() {
			if (!navigator.getGamepads) {
				return [];
			}
			return navigator.getGamepads();
		},
		getGamepad(deviceIndex) {
			var gamepads = SDL.getGamepads();
			if (gamepads.length > deviceIndex && deviceIndex >= 0) {
				return gamepads[deviceIndex];
			}
			return null;
		},
	};

	var _SDL_Linked_Version = () => {
		if (SDL.version === null) {
			SDL.version = _malloc(3);
			HEAP8[SDL.version] = 1;
			HEAP8[SDL.version + 1] = 3;
			HEAP8[SDL.version + 2] = 0;
		}
		return SDL.version;
	};
	_SDL_Linked_Version.sig = 'p';

	/** @param{number} initFlags */
	var _SDL_Init = (initFlags) => {
		SDL.startTime = Date.now();
		SDL.initFlags = initFlags;

		// capture all key events. we just keep down and up, but also capture press to prevent default actions
		if (!Module['doNotCaptureKeyboard']) {
			var keyboardListeningElement =
				Module['keyboardListeningElement'] || document;
			keyboardListeningElement.addEventListener(
				'keydown',
				SDL.receiveEvent
			);
			keyboardListeningElement.addEventListener(
				'keyup',
				SDL.receiveEvent
			);
			keyboardListeningElement.addEventListener(
				'keypress',
				SDL.receiveEvent
			);
			window.addEventListener('focus', SDL.receiveEvent);
			window.addEventListener('blur', SDL.receiveEvent);
			document.addEventListener('visibilitychange', SDL.receiveEvent);
		}

		window.addEventListener('unload', SDL.receiveEvent);
		SDL.keyboardState = _calloc(0x10000, 1); // Our SDL needs 512, but 64K is safe for older SDLs
		// Initialize this structure carefully for closure
		SDL.DOMEventToSDLEvent['keydown'] = 768;
		SDL.DOMEventToSDLEvent['keyup'] = 769;
		SDL.DOMEventToSDLEvent['keypress'] = 771;
		SDL.DOMEventToSDLEvent['mousedown'] = 1025;
		SDL.DOMEventToSDLEvent['mouseup'] = 1026;
		SDL.DOMEventToSDLEvent['mousemove'] = 1024;
		SDL.DOMEventToSDLEvent['wheel'] = 1027;
		SDL.DOMEventToSDLEvent['touchstart'] = 1792;
		SDL.DOMEventToSDLEvent['touchend'] = 1793;
		SDL.DOMEventToSDLEvent['touchmove'] = 1794;
		SDL.DOMEventToSDLEvent['unload'] = 256;
		SDL.DOMEventToSDLEvent['resize'] = 28673;
		SDL.DOMEventToSDLEvent['visibilitychange'] = 512;
		SDL.DOMEventToSDLEvent['focus'] = 512;
		SDL.DOMEventToSDLEvent['blur'] = 512;

		// These are not technically DOM events; the HTML gamepad API is poll-based.
		// However, we define them here, as the rest of the SDL code assumes that
		// all SDL events originate as DOM events.
		SDL.DOMEventToSDLEvent['joystick_axis_motion'] = 1536;
		SDL.DOMEventToSDLEvent['joystick_button_down'] = 1539;
		SDL.DOMEventToSDLEvent['joystick_button_up'] = 1540;
		return 0; // success
	};
	_SDL_Init.sig = 'ii';

	var _SDL_WasInit = (flags) => {
		if (SDL.startTime === null) {
			_SDL_Init(0);
		}
		return 1;
	};
	_SDL_WasInit.sig = 'ii';

	var _SDL_GetVideoInfo = () => {
		var ret = _calloc(20, 1);
		var canvas = Browser.getCanvas();
		HEAP32[(ret + 12) >> 2] = canvas.width;
		HEAP32[(ret + 16) >> 2] = canvas.height;
		return ret;
	};
	_SDL_GetVideoInfo.sig = 'p';

	var _SDL_ListModes = (format, flags) => -1;
	_SDL_ListModes.sig = 'ppi';

	var _SDL_VideoModeOK = (width, height, depth, flags) => depth;
	_SDL_VideoModeOK.sig = 'iiiii';

	var _SDL_VideoDriverName = (buf, max_size) => {
		if (SDL.startTime === null) {
			return 0; //return NULL
		}
		//driverName - emscripten_sdl_driver
		var driverName = [
			101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 95, 115, 100, 108,
			95, 100, 114, 105, 118, 101, 114,
		];

		var index = 0;
		var size = driverName.length;

		if (max_size <= size) {
			size = max_size - 1; //-1 cause null-terminator
		}

		while (index < size) {
			var value = driverName[index];
			HEAP8[buf + index] = value;
			index++;
		}

		HEAP8[buf + index] = 0;
		return buf;
	};
	_SDL_VideoDriverName.sig = 'ppi';
	var _SDL_AudioDriverName = _SDL_VideoDriverName;
	_SDL_AudioDriverName.sig = 'ppi';

	var _SDL_SetVideoMode = (width, height, depth, flags) => {
		var canvas = Browser.getCanvas();

		[
			'touchstart',
			'touchend',
			'touchmove',
			'mousedown',
			'mouseup',
			'mousemove',
			'mousewheel',
			'wheel',
			'mouseout',
			'DOMMouseScroll',
		].forEach((e) => canvas.addEventListener(e, SDL.receiveEvent, true));

		// (0,0) means 'use fullscreen' in native; in Emscripten, use the current canvas size.
		if (width == 0 && height == 0) {
			width = canvas.width;
			height = canvas.height;
		}

		if (!SDL.addedResizeListener) {
			SDL.addedResizeListener = true;
			Browser.resizeListeners.push((w, h) => {
				if (!SDL.settingVideoMode) {
					SDL.receiveEvent({ type: 'resize', w, h });
				}
			});
		}

		SDL.settingVideoMode = true; // SetVideoMode itself should not trigger resize events
		Browser.setCanvasSize(width, height);
		SDL.settingVideoMode = false;

		// Free the old surface first if there is one
		if (SDL.screen) {
			SDL.freeSurface(SDL.screen);
		}

		if (SDL.GL) flags = flags | 67108864; // if we are using GL, then later calls to SetVideoMode may not mention GL, but we do need it. Once in GL mode, we never leave it.

		SDL.screen = SDL.makeSurface(width, height, flags, true, 'screen');

		return SDL.screen;
	};
	_SDL_SetVideoMode.sig = 'piiii';

	var _SDL_GetVideoSurface = () => SDL.screen;
	_SDL_GetVideoSurface.sig = 'p';

	var _SDL_AudioQuit = () => {
		for (var i = 0; i < SDL.numChannels; ++i) {
			var chan = /** @type {{ audio: (HTMLMediaElement|undefined) }} */ (
				SDL.channels[i]
			);
			if (chan.audio) {
				chan.audio.pause();
				chan.audio = undefined;
			}
		}
		var audio = /** @type {HTMLMediaElement} */ (SDL.music.audio);
		audio?.pause();
		SDL.music.audio = undefined;
	};
	_SDL_AudioQuit.sig = 'v';

	var _SDL_VideoQuit = () => out('SDL_VideoQuit called (and ignored)');
	_SDL_VideoQuit.sig = 'v';

	var _SDL_QuitSubSystem = (flags) =>
		out('SDL_QuitSubSystem called (and ignored)');
	_SDL_QuitSubSystem.sig = 'vi';

	var _SDL_Quit = () => {
		_SDL_AudioQuit();
		out('SDL_Quit called (and ignored)');
	};
	_SDL_Quit.sig = 'v';

	var _SDL_UnlockSurface = (surf) => {
		var surfData = SDL.surfaces[surf];

		if (!surfData.locked || --surfData.locked > 0) {
			return;
		}

		// Copy pixel data to image
		if (surfData.isFlagSet(2097152)) {
			SDL.copyIndexedColorData(surfData);
		} else if (!surfData.colors) {
			var data = surfData.image.data;
			var buffer = surfData.buffer;
			var src = buffer >> 2;
			var dst = 0;
			var isScreen = surf == SDL.screen;
			var num;
			if (
				typeof CanvasPixelArray != 'undefined' &&
				data instanceof CanvasPixelArray
			) {
				// IE10/IE11: ImageData objects are backed by the deprecated CanvasPixelArray,
				// not UInt8ClampedArray. These don't have buffers, so we need to revert
				// to copying a byte at a time. We do the undefined check because modern
				// browsers do not define CanvasPixelArray anymore.
				num = data.length;
				while (dst < num) {
					var val = HEAP32[src]; // This is optimized. Instead, we could do HEAP32[(((buffer)+(dst))>>2)];
					data[dst] = val & 0xff;
					data[dst + 1] = (val >> 8) & 0xff;
					data[dst + 2] = (val >> 16) & 0xff;
					data[dst + 3] = isScreen ? 0xff : (val >> 24) & 0xff;
					src++;
					dst += 4;
				}
			} else {
				var data32 = new Uint32Array(data.buffer);
				if (isScreen && SDL.defaults.opaqueFrontBuffer) {
					num = data32.length;
					// logically we need to do
					//      while (dst < num) {
					//          data32[dst++] = HEAP32[src++] | 0xff000000
					//      }
					// the following code is faster though, because
					// .set() is almost free - easily 10x faster due to
					// native memcpy efficiencies, and the remaining loop
					// just stores, not load + store, so it is faster
					data32.set(HEAP32.subarray(src, src + num));
					var data8 = new Uint8Array(data.buffer);
					var i = 3;
					var j = i + 4 * num;
					if (num % 8 == 0) {
						// unrolling gives big speedups
						while (i < j) {
							data8[i] = 0xff;
							i = (i + 4) | 0;
							data8[i] = 0xff;
							i = (i + 4) | 0;
							data8[i] = 0xff;
							i = (i + 4) | 0;
							data8[i] = 0xff;
							i = (i + 4) | 0;
							data8[i] = 0xff;
							i = (i + 4) | 0;
							data8[i] = 0xff;
							i = (i + 4) | 0;
							data8[i] = 0xff;
							i = (i + 4) | 0;
							data8[i] = 0xff;
							i = (i + 4) | 0;
						}
					} else {
						while (i < j) {
							data8[i] = 0xff;
							i = (i + 4) | 0;
						}
					}
				} else {
					data32.set(HEAP32.subarray(src, src + data32.length));
				}
			}
		} else {
			var canvas = Browser.getCanvas();
			var width = canvas.width;
			var height = canvas.height;
			var s = surfData.buffer;
			var data = surfData.image.data;
			var colors = surfData.colors; // TODO: optimize using colors32
			for (var y = 0; y < height; y++) {
				var base = y * width * 4;
				for (var x = 0; x < width; x++) {
					// See comment above about signs
					var val = HEAPU8[s++] * 4;
					var start = base + x * 4;
					data[start] = colors[val];
					data[start + 1] = colors[val + 1];
					data[start + 2] = colors[val + 2];
				}
				s += width * 3;
			}
		}
		// Copy to canvas
		surfData.ctx.putImageData(surfData.image, 0, 0);
		// Note that we save the image, so future writes are fast. But, memory is not yet released
	};
	_SDL_UnlockSurface.sig = 'vp';

	var _SDL_Flip = (surf) => {
		// We actually do this in Unlock, since the screen surface has as its canvas
		// backing the page canvas element
	};
	_SDL_Flip.sig = 'ip';

	var _SDL_UpdateRect = (surf, x, y, w, h) => {
		// We actually do the whole screen in Unlock...
	};
	_SDL_UpdateRect.sig = 'vpiiii';

	var _SDL_UpdateRects = (surf, numrects, rects) => {
		// We actually do the whole screen in Unlock...
	};
	_SDL_UpdateRects.sig = 'vpip';

	var _SDL_Delay = (delay) => _emscripten_sleep(delay);
	_SDL_Delay.sig = 'vi';
	_SDL_Delay.isAsync = true;

	var _SDL_WM_SetCaption = (title, icon) => {
		if (title) {
			_emscripten_set_window_title(title);
		}
		icon &&= UTF8ToString(icon);
	};
	_SDL_WM_SetCaption.sig = 'vpp';

	var _SDL_EnableKeyRepeat = (delay, interval) => {};
	_SDL_EnableKeyRepeat.sig = 'iii';

	/** @param {number} numKeys */
	var _SDL_GetKeyboardState = (numKeys) => {
		if (numKeys) {
			HEAP32[numKeys >> 2] = 65536;
		}
		return SDL.keyboardState;
	};
	_SDL_GetKeyboardState.sig = 'pp';

	var _SDL_GetKeyState = () => _SDL_GetKeyboardState(0);

	var _SDL_GetKeyName = (key) => {
		var name = '';
		/* ASCII A-Z or 0-9 */
		if ((key >= 97 && key <= 122) || (key >= 48 && key <= 57)) {
			name = String.fromCharCode(key);
		}
		var size = lengthBytesUTF8(name) + 1;
		SDL.keyName = _realloc(SDL.keyName, size);
		stringToUTF8(name, SDL.keyName, size);
		return SDL.keyName;
	};
	_SDL_GetKeyName.sig = 'pi';

	var _SDL_GetModState = () => SDL.modState;
	_SDL_GetModState.sig = 'i';

	var _SDL_GetMouseState = (x, y) => {
		if (x) HEAP32[x >> 2] = Browser.mouseX;
		if (y) HEAP32[y >> 2] = Browser.mouseY;
		return SDL.buttonState;
	};
	_SDL_GetMouseState.sig = 'ipp';

	var _SDL_WarpMouse = (x, y) => {
		return; // TODO: implement this in a non-buggy way. Need to keep relative mouse movements correct after calling this
		/*
      var rect = Browser.getCanvas().getBoundingClientRect();
      SDL.events.push({
        type: 'mousemove',
        pageX: x + (window.scrollX + rect.left),
        pageY: y + (window.scrollY + rect.top)
      });
      */
	};
	_SDL_WarpMouse.sig = 'vii';

	var _SDL_ShowCursor = (toggle) => {
		switch (toggle) {
			case 0: // SDL_DISABLE
				if (Browser.isFullscreen) {
					// only try to lock the pointer when in full screen mode
					Browser.getCanvas().requestPointerLock();
					return 0;
				}
				// else return SDL_ENABLE to indicate the failure
				return 1;
			case 1: // SDL_ENABLE
				document.exitPointerLock();
				return 1;
			case -1: // SDL_QUERY
				return !Browser.pointerLock;
			default:
				err(
					`SDL_ShowCursor called with unknown toggle parameter value: ${toggle}`
				);
				break;
		}
	};
	_SDL_ShowCursor.sig = 'ii';

	var _SDL_GetError = () => {
		SDL.errorMessage ||= stringToNewUTF8('unknown SDL-emscripten error');
		return SDL.errorMessage;
	};
	_SDL_GetError.sig = 'p';

	var _SDL_SetError = (fmt, varargs) => {};
	_SDL_SetError.sig = 'vpp';

	var _SDL_CreateRGBSurface = (
		flags,
		width,
		height,
		depth,
		rmask,
		gmask,
		bmask,
		amask
	) =>
		SDL.makeSurface(
			width,
			height,
			flags,
			false,
			'CreateRGBSurface',
			rmask,
			gmask,
			bmask,
			amask
		);
	_SDL_CreateRGBSurface.sig = 'piiiiiiii';

	var _SDL_CreateRGBSurfaceFrom = (
		pixels,
		width,
		height,
		depth,
		pitch,
		rmask,
		gmask,
		bmask,
		amask
	) => {
		var surf = SDL.makeSurface(
			width,
			height,
			0,
			false,
			'CreateRGBSurfaceFrom',
			rmask,
			gmask,
			bmask,
			amask
		);

		if (depth !== 32) {
			// TODO: Actually fill pixel data to created surface.
			// TODO: Take into account depth and pitch parameters.
			err(
				'TODO: Partially unimplemented SDL_CreateRGBSurfaceFrom called!'
			);
			return surf;
		}

		var data = SDL.surfaces[surf];
		var image = data.ctx.createImageData(width, height);
		var pitchOfDst = width * 4;

		for (var row = 0; row < height; ++row) {
			var baseOfSrc = row * pitch;
			var baseOfDst = row * pitchOfDst;

			for (var col = 0; col < width * 4; ++col) {
				image.data[baseOfDst + col] =
					HEAPU8[pixels + (baseOfDst + col)];
			}
		}

		data.ctx.putImageData(image, 0, 0);

		return surf;
	};
	_SDL_CreateRGBSurfaceFrom.sig = 'ppiiiiiiii';

	/** @param {number} format @param {number} flags */
	var _SDL_ConvertSurface = (surf, format, flags) => {
		if (format) {
			SDL.checkPixelFormat(format);
		}

		var oldData = SDL.surfaces[surf];
		var ret = SDL.makeSurface(
			oldData.width,
			oldData.height,
			oldData.flags,
			false,
			'copy:' + oldData.source
		);
		var newData = SDL.surfaces[ret];

		newData.ctx.globalCompositeOperation = 'copy';
		newData.ctx.drawImage(oldData.canvas, 0, 0);
		newData.ctx.globalCompositeOperation =
			oldData.ctx.globalCompositeOperation;
		return ret;
	};
	_SDL_ConvertSurface.sig = 'pppi';

	var _SDL_DisplayFormat = (surf) => _SDL_ConvertSurface(surf, 0, 0);
	_SDL_DisplayFormat.sig = 'pp';

	var _SDL_DisplayFormatAlpha = (surf) => _SDL_ConvertSurface(surf, 0, 0);
	_SDL_DisplayFormatAlpha.sig = 'pp';

	var _SDL_FreeSurface = (surf) => {
		if (surf) SDL.freeSurface(surf);
	};
	_SDL_FreeSurface.sig = 'vp';

	var _SDL_UpperBlit = (src, srcrect, dst, dstrect) =>
		SDL.blitSurface(src, srcrect, dst, dstrect, false);
	_SDL_UpperBlit.sig = 'ipppp';

	var _SDL_UpperBlitScaled = (src, srcrect, dst, dstrect) =>
		SDL.blitSurface(src, srcrect, dst, dstrect, true);
	_SDL_UpperBlitScaled.sig = 'ipppp';

	var _SDL_LowerBlit = _SDL_UpperBlit;
	_SDL_LowerBlit.sig = 'ipppp';

	var _SDL_LowerBlitScaled = _SDL_UpperBlitScaled;
	_SDL_LowerBlitScaled.sig = 'ipppp';

	var _SDL_GetClipRect = (surf, rect) => {
		var surfData = SDL.surfaces[surf];
		var r = surfData.clipRect || {
			x: 0,
			y: 0,
			w: surfData.width,
			h: surfData.height,
		};
		SDL.updateRect(rect, r);
	};
	_SDL_GetClipRect.sig = 'vpp';

	var _SDL_SetClipRect = (surf, rect) => {
		var surfData = SDL.surfaces[surf];

		if (rect) {
			surfData.clipRect = SDL.intersectionOfRects(
				{ x: 0, y: 0, w: surfData.width, h: surfData.height },
				SDL.loadRect(rect)
			);
		} else {
			delete surfData.clipRect;
		}
	};
	_SDL_SetClipRect.sig = 'ipp';

	var _SDL_FillRect = (surf, rect, color) => {
		var surfData = SDL.surfaces[surf];

		if (surfData.isFlagSet(2097152)) {
			//in SDL_HWPALETTE color is index (0..255)
			//so we should translate 1 byte value to
			//32 bit canvas
			color = surfData.colors32[color];
		}

		var r = rect
			? SDL.loadRect(rect)
			: { x: 0, y: 0, w: surfData.width, h: surfData.height };

		if (surfData.clipRect) {
			r = SDL.intersectionOfRects(surfData.clipRect, r);

			if (rect) {
				SDL.updateRect(rect, r);
			}
		}

		surfData.ctx.save();
		surfData.ctx.fillStyle = SDL.translateColorToCSSRGBA(color);
		surfData.ctx.fillRect(r.x, r.y, r.w, r.h);
		surfData.ctx.restore();
		return 0;
	};
	_SDL_FillRect.sig = 'ippi';

	var _zoomSurface = (src, x, y, smooth) => {
		var srcData = SDL.surfaces[src];
		var w = srcData.width * x;
		var h = srcData.height * y;
		var ret = SDL.makeSurface(
			Math.abs(w),
			Math.abs(h),
			srcData.flags,
			false,
			'zoomSurface'
		);
		var dstData = SDL.surfaces[ret];
		if (x >= 0 && y >= 0) {
			dstData.ctx.drawImage(srcData.canvas, 0, 0, w, h);
		} else {
			dstData.ctx.save();
			dstData.ctx.scale(x < 0 ? -1 : 1, y < 0 ? -1 : 1);
			dstData.ctx.drawImage(
				srcData.canvas,
				w < 0 ? w : 0,
				h < 0 ? h : 0,
				Math.abs(w),
				Math.abs(h)
			);
			// XXX I think this should work according to the spec, but currently
			// fails on FF: dstData.ctx.drawImage(srcData.canvas, 0, 0, w, h);
			dstData.ctx.restore();
		}
		return ret;
	};
	_zoomSurface.sig = 'ppddi';

	var _rotozoomSurface = (src, angle, zoom, smooth) => {
		if (angle % 360 === 0) {
			return _zoomSurface(src, zoom, zoom, smooth);
		}
		var srcData = SDL.surfaces[src];
		var w = srcData.width * zoom;
		var h = srcData.height * zoom;
		var diagonal = Math.ceil(Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2)));
		var ret = SDL.makeSurface(
			diagonal,
			diagonal,
			srcData.flags,
			false,
			'rotozoomSurface'
		);
		var dstData = SDL.surfaces[ret];
		dstData.ctx.translate(diagonal / 2, diagonal / 2);
		dstData.ctx.rotate((-angle * Math.PI) / 180);
		dstData.ctx.drawImage(srcData.canvas, -w / 2, -h / 2, w, h);
		return ret;
	};
	_rotozoomSurface.sig = 'ppddi';

	var _SDL_SetAlpha = (surf, flag, alpha) => {
		var surfData = SDL.surfaces[surf];
		surfData.alpha = alpha;

		if (!(flag & 65536)) {
			// !SDL_SRCALPHA
			surfData.alpha = 255;
		}
	};
	_SDL_SetAlpha.sig = 'ipii';

	var _SDL_SetColorKey = (surf, flag, key) => {
		// SetColorKey assigns one color to be rendered as transparent. I don't
		// think the canvas API allows for anything like this, and iterating through
		// each pixel to replace that color seems prohibitively expensive.
		warnOnce('SDL_SetColorKey is a no-op for performance reasons');
		return 0;
	};
	_SDL_SetColorKey.sig = 'ipii';

	var _SDL_PollEvent = (ptr) => SDL.pollEvent(ptr);
	_SDL_PollEvent.sig = 'ip';

	var _SDL_PushEvent = (ptr) => {
		var copy = _malloc(28);
		_memcpy(copy, ptr, 28);
		SDL.events.push(copy);
		return 0;
	};
	_SDL_PushEvent.sig = 'ip';

	var _SDL_PeepEvents = (events, requestedEventCount, action, from, to) => {
		switch (action) {
			case 2: {
				// SDL_GETEVENT
				// We only handle 1 event right now

				var index = 0;
				var retrievedEventCount = 0;
				// this should look through the entire queue until it has filled up the events
				// array
				while (
					index < SDL.events.length &&
					retrievedEventCount < requestedEventCount
				) {
					var event = SDL.events[index];
					var type = SDL.DOMEventToSDLEvent[event.type];
					if (from <= type && type <= to) {
						if (SDL.makeCEvent(event, events) === false) {
							index++;
						} else {
							SDL.events.splice(index, 1);
							retrievedEventCount++;
						}
					} else {
						index++;
					}
				}
				return retrievedEventCount;
			}
			default:
				abort(
					'SDL_PeepEvents does not yet support that action: ' + action
				);
		}
	};
	_SDL_PeepEvents.sig = 'ipiiii';

	var _SDL_PumpEvents = () => SDL.events.forEach(SDL.handleEvent);
	_SDL_PumpEvents.sig = 'v';

	var _emscripten_SDL_SetEventHandler = (handler, userdata) => {
		SDL.eventHandler = handler;
		SDL.eventHandlerContext = userdata;

		// All SDLEvents take the same amount of memory
		SDL.eventHandlerTemp ||= _malloc(28);
	};
	_emscripten_SDL_SetEventHandler.sig = 'vpp';

	var _SDL_SetColors = (surf, colors, firstColor, nColors) => {
		var surfData = SDL.surfaces[surf];

		// we should create colors array
		// only once cause client code
		// often wants to change portion
		// of palette not all palette.
		if (!surfData.colors) {
			var buffer = new ArrayBuffer(256 * 4); // RGBA, A is unused, but faster this way
			surfData.colors = new Uint8Array(buffer);
			surfData.colors32 = new Uint32Array(buffer);
		}

		for (var i = 0; i < nColors; ++i) {
			var index = (firstColor + i) * 4;
			surfData.colors[index] = HEAPU8[colors + i * 4];
			surfData.colors[index + 1] = HEAPU8[colors + (i * 4 + 1)];
			surfData.colors[index + 2] = HEAPU8[colors + (i * 4 + 2)];
			surfData.colors[index + 3] = 255; // opaque
		}

		return 1;
	};
	_SDL_SetColors.sig = 'ippii';

	var _SDL_SetPalette = (surf, flags, colors, firstColor, nColors) =>
		_SDL_SetColors(surf, colors, firstColor, nColors);
	_SDL_SetPalette.sig = 'ipipii';

	var _SDL_MapRGB = (fmt, r, g, b) => {
		SDL.checkPixelFormat(fmt);
		// We assume the machine is little-endian.
		return (r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | 0xff000000;
	};
	_SDL_MapRGB.sig = 'ipiii';

	var _SDL_MapRGBA = (fmt, r, g, b, a) => {
		SDL.checkPixelFormat(fmt);
		// We assume the machine is little-endian.
		return (
			(r & 0xff) |
			((g & 0xff) << 8) |
			((b & 0xff) << 16) |
			((a & 0xff) << 24)
		);
	};
	_SDL_MapRGBA.sig = 'ipiiii';

	var _SDL_GetRGB = (pixel, fmt, r, g, b) => {
		SDL.checkPixelFormat(fmt);
		// We assume the machine is little-endian.
		if (r) {
			HEAP8[r] = pixel & 0xff;
		}
		if (g) {
			HEAP8[g] = (pixel >> 8) & 0xff;
		}
		if (b) {
			HEAP8[b] = (pixel >> 16) & 0xff;
		}
	};
	_SDL_GetRGB.sig = 'vipppp';

	var _SDL_GetRGBA = (pixel, fmt, r, g, b, a) => {
		SDL.checkPixelFormat(fmt);
		// We assume the machine is little-endian.
		if (r) {
			HEAP8[r] = pixel & 0xff;
		}
		if (g) {
			HEAP8[g] = (pixel >> 8) & 0xff;
		}
		if (b) {
			HEAP8[b] = (pixel >> 16) & 0xff;
		}
		if (a) {
			HEAP8[a] = (pixel >> 24) & 0xff;
		}
	};
	_SDL_GetRGBA.sig = 'vippppp';

	var _SDL_GetAppState = () => {
		var state = 0;

		if (Browser.pointerLock) {
			state |= 1;
		}
		if (document.hasFocus()) {
			state |= 2;
		}
		state |= 4;

		return state;
	};
	_SDL_GetAppState.sig = 'i';

	var _SDL_WM_GrabInput = () => {};
	_SDL_WM_GrabInput.sig = 'ii';

	var _SDL_WM_ToggleFullScreen = (surf) => {
		if (Browser.exitFullscreen()) {
			return 1;
		}
		if (!SDL.canRequestFullscreen) {
			return 0;
		}
		SDL.isRequestingFullscreen = true;
		return 1;
	};
	_SDL_WM_ToggleFullScreen.sig = 'ip';

	var _IMG_Init = (flags) => flags;
	_IMG_Init.sig = 'ii';

	var _SDL_FreeRW = (rwopsID) => {
		SDL.rwops[rwopsID] = null;
		while (
			SDL.rwops.length > 0 &&
			SDL.rwops[SDL.rwops.length - 1] === null
		) {
			SDL.rwops.pop();
		}
	};
	_SDL_FreeRW.sig = 'vp';

	var _IMG_Load_RW = (rwopsID, freeSrc) => {
		var sp = stackSave();
		try {
			// stb_image integration support
			var cleanup = () => {
				stackRestore(sp);
				if (rwops && freeSrc) _SDL_FreeRW(rwopsID);
			};
			var addCleanup = (func) => {
				var old = cleanup;
				cleanup = () => {
					old();
					func();
				};
			};
			var callStbImage = (func, params) => {
				var x = stackAlloc(4);
				var y = stackAlloc(4);
				var comp = stackAlloc(4);
				var data = Module['_' + func](...params, x, y, comp, 0);
				if (!data) return null;
				addCleanup(() => Module['_stbi_image_free'](data));
				return {
					rawData: true,
					data,
					width: HEAP32[x >> 2],
					height: HEAP32[y >> 2],
					size: HEAP32[x >> 2] * HEAP32[y >> 2] * HEAP32[comp >> 2],
					bpp: HEAP32[comp >> 2],
				};
			};

			var rwops = SDL.rwops[rwopsID];
			if (rwops === undefined) {
				return 0;
			}

			var raw;
			var filename = rwops.filename;
			if (filename === undefined) {
				warnOnce(
					'Only file names that have been preloaded are supported for IMG_Load_RW. Consider using STB_IMAGE=1 if you want synchronous image decoding (see settings.js), or package files with --use-preload-plugins'
				);
				return 0;
			}

			if (!raw) {
				filename = PATH_FS.resolve(filename);
				raw = Browser.preloadedImages[filename];
				if (!raw) {
					if (raw === null)
						err(
							'Trying to reuse preloaded image, but freePreloadedMediaOnUse is set!'
						);
					warnOnce('Cannot find preloaded image ' + filename);
					warnOnce(
						'Cannot find preloaded image ' +
							filename +
							'. Consider using STB_IMAGE=1 if you want synchronous image decoding (see settings.js), or package files with --use-preload-plugins'
					);
					return 0;
				} else if (Module['freePreloadedMediaOnUse']) {
					Browser.preloadedImages[filename] = null;
				}
			}

			var surf = SDL.makeSurface(
				raw.width,
				raw.height,
				0,
				false,
				'load:' + filename
			);
			var surfData = SDL.surfaces[surf];
			surfData.ctx.globalCompositeOperation = 'copy';
			if (!raw.rawData) {
				surfData.ctx.drawImage(
					raw,
					0,
					0,
					raw.width,
					raw.height,
					0,
					0,
					raw.width,
					raw.height
				);
			} else {
				var imageData = surfData.ctx.getImageData(
					0,
					0,
					surfData.width,
					surfData.height
				);
				if (raw.bpp == 4) {
					// rgba
					imageData.data.set(
						HEAPU8.subarray(raw.data, raw.data + raw.size)
					);
				} else if (raw.bpp == 3) {
					// rgb
					var pixels = raw.size / 3;
					var data = imageData.data;
					var sourcePtr = raw.data;
					var destPtr = 0;
					for (var i = 0; i < pixels; i++) {
						data[destPtr++] = HEAPU8[sourcePtr++];
						data[destPtr++] = HEAPU8[sourcePtr++];
						data[destPtr++] = HEAPU8[sourcePtr++];
						data[destPtr++] = 255;
					}
				} else if (raw.bpp == 2) {
					// grayscale + alpha
					var pixels = raw.size;
					var data = imageData.data;
					var sourcePtr = raw.data;
					var destPtr = 0;
					for (var i = 0; i < pixels; i++) {
						var gray = HEAPU8[sourcePtr++];
						var alpha = HEAPU8[sourcePtr++];
						data[destPtr++] = gray;
						data[destPtr++] = gray;
						data[destPtr++] = gray;
						data[destPtr++] = alpha;
					}
				} else if (raw.bpp == 1) {
					// grayscale
					var pixels = raw.size;
					var data = imageData.data;
					var sourcePtr = raw.data;
					var destPtr = 0;
					for (var i = 0; i < pixels; i++) {
						var value = HEAPU8[sourcePtr++];
						data[destPtr++] = value;
						data[destPtr++] = value;
						data[destPtr++] = value;
						data[destPtr++] = 255;
					}
				} else {
					err(`cannot handle bpp ${raw.bpp}`);
					return 0;
				}
				surfData.ctx.putImageData(imageData, 0, 0);
			}
			surfData.ctx.globalCompositeOperation = 'source-over';
			// XXX SDL does not specify that loaded images must have available pixel data, in fact
			//     there are cases where you just want to blit them, so you just need the hardware
			//     accelerated version. However, code everywhere seems to assume that the pixels
			//     are in fact available, so we retrieve it here. This does add overhead though.
			_SDL_LockSurface(surf);
			surfData.locked--; // The surface is not actually locked in this hack
			if (SDL.GL) {
				// After getting the pixel data, we can free the canvas and context if we do not need to do 2D canvas blitting
				surfData.canvas = surfData.ctx = null;
			}
			return surf;
		} finally {
			cleanup();
		}
	};
	_IMG_Load_RW.sig = 'ppi';

	var _SDL_LoadBMP_RW = _IMG_Load_RW;
	_SDL_LoadBMP_RW.sig = 'ppi';

	/** @param {number} mode */
	var _SDL_RWFromFile = (_name, mode) => {
		var id = SDL.rwops.length; // TODO: recycle ids when they are null
		var filename = UTF8ToString(_name);
		SDL.rwops.push({ filename, mimetype: Browser.getMimetype(filename) });
		return id;
	};
	_SDL_RWFromFile.sig = 'ppp';

	var _IMG_Load = (filename) => {
		var rwops = _SDL_RWFromFile(filename, 0);
		var result = _IMG_Load_RW(rwops, 1);
		return result;
	};
	_IMG_Load.sig = 'pp';

	var _IMG_Quit = () => out('IMG_Quit called (and ignored)');
	_IMG_Quit.sig = 'v';

	var _SDL_OpenAudio = (desired, obtained) => {
		try {
			SDL.audio = {
				freq: HEAPU32[desired >> 2],
				format: HEAPU16[(desired + 4) >> 1],
				channels: HEAPU8[desired + 6],
				samples: HEAPU16[(desired + 8) >> 1], // Samples in the CB buffer per single sound channel.
				callback: HEAPU32[(desired + 16) >> 2],
				userdata: HEAPU32[(desired + 20) >> 2],
				paused: true,
				timer: null,
			};
			// The .silence field tells the constant sample value that corresponds to the safe un-skewed silence value for the wave data.
			if (SDL.audio.format == 8) {
				SDL.audio.silence = 128; // Audio ranges in [0, 255], so silence is half-way in between.
			} else if (SDL.audio.format == 32784) {
				SDL.audio.silence = 0; // Signed data in range [-32768, 32767], silence is 0.
			} else if (SDL.audio.format == 33056) {
				SDL.audio.silence = 0.0; // Float data in range [-1.0, 1.0], silence is 0.0
			} else {
				abort('Invalid SDL audio format ' + SDL.audio.format + '!');
			}
			// Round the desired audio frequency up to the next 'common' frequency value.
			// Web Audio API spec states 'An implementation must support sample-rates in at least the range 22050 to 96000.'
			if (SDL.audio.freq <= 0) {
				abort('Unsupported sound frequency ' + SDL.audio.freq + '!');
			} else if (SDL.audio.freq <= 22050) {
				SDL.audio.freq = 22050; // Take it safe and clamp everything lower than 22kHz to that.
			} else if (SDL.audio.freq <= 32000) {
				SDL.audio.freq = 32000;
			} else if (SDL.audio.freq <= 44100) {
				SDL.audio.freq = 44100;
			} else if (SDL.audio.freq <= 48000) {
				SDL.audio.freq = 48000;
			} else if (SDL.audio.freq <= 96000) {
				SDL.audio.freq = 96000;
			} else {
				abort(`Unsupported sound frequency ${SDL.audio.freq}!`);
			}
			if (SDL.audio.channels == 0) {
				SDL.audio.channels = 1; // In SDL both 0 and 1 mean mono.
			} else if (SDL.audio.channels < 0 || SDL.audio.channels > 32) {
				abort(
					`Unsupported number of audio channels for SDL audio: ${SDL.audio.channels}!`
				);
			} else if (SDL.audio.channels != 1 && SDL.audio.channels != 2) {
				// Unsure what SDL audio spec supports. Web Audio spec supports up to 32 channels.
				out(
					`Warning: Using untested number of audio channels ${SDL.audio.channels}`
				);
			}
			if (
				SDL.audio.samples < 128 ||
				SDL.audio.samples > 524288 /* arbitrary cap */
			) {
				abort(
					`Unsupported audio callback buffer size ${SDL.audio.samples}!`
				);
			} else if ((SDL.audio.samples & (SDL.audio.samples - 1)) != 0) {
				abort(
					`Audio callback buffer size ${SDL.audio.samples} must be a power-of-two!`
				);
			}

			var totalSamples = SDL.audio.samples * SDL.audio.channels;
			if (SDL.audio.format == 8) {
				SDL.audio.bytesPerSample = 1;
			} else if (SDL.audio.format == 32784) {
				SDL.audio.bytesPerSample = 2;
			} else if (SDL.audio.format == 33056) {
				SDL.audio.bytesPerSample = 4;
			} else {
				abort(`Invalid SDL audio format ${SDL.audio.format}!`);
			}
			SDL.audio.bufferSize = totalSamples * SDL.audio.bytesPerSample;
			// Duration of a single queued buffer in seconds.
			SDL.audio.bufferDurationSecs =
				SDL.audio.bufferSize /
				SDL.audio.bytesPerSample /
				SDL.audio.channels /
				SDL.audio.freq;
			// Audio samples are played with a constant delay of this many seconds to account for browser and jitter.
			SDL.audio.bufferingDelay = 50 / 1000;
			SDL.audio.buffer = _malloc(SDL.audio.bufferSize);

			// To account for jittering in frametimes, always have multiple audio
			// buffers queued up for the audio output device.
			// This helps that we won't starve that easily if a frame takes long to complete.
			SDL.audio.numSimultaneouslyQueuedBuffers =
				Module['SDL_numSimultaneouslyQueuedBuffers'] || 5;

			// Pulls and queues new audio data if appropriate. This function gets
			// "over-called" in both requestAnimationFrames and setTimeouts to ensure
			// that we get the finest granularity possible and as many chances from
			// the browser to fill new audio data. This is because setTimeouts alone
			// have very poor granularity for audio streaming purposes, but also the
			// application might not be using emscripten_set_main_loop to drive the
			// main loop, so we cannot rely on that alone.
			SDL.audio.queueNewAudioData = () => {
				if (!SDL.audio) return;

				for (
					var i = 0;
					i < SDL.audio.numSimultaneouslyQueuedBuffers;
					++i
				) {
					// Only queue new data if we don't have enough audio data already in queue. Otherwise skip this time slot
					// and wait to queue more in the next time the callback is run.
					var secsUntilNextPlayStart =
						SDL.audio.nextPlayTime -
						SDL.audioContext['currentTime'];
					if (
						secsUntilNextPlayStart >=
						SDL.audio.bufferingDelay +
							SDL.audio.bufferDurationSecs *
								SDL.audio.numSimultaneouslyQueuedBuffers
					)
						return;

					// Ask SDL audio data from the user code.
					getWasmTableEntry(SDL.audio.callback)(
						SDL.audio.userdata,
						SDL.audio.buffer,
						SDL.audio.bufferSize
					);
					// And queue it to be played after the currently playing audio stream.
					SDL.audio.pushAudio(SDL.audio.buffer, SDL.audio.bufferSize);
				}
			};

			var sleepCallback = () => {
				SDL.audio?.queueNewAudioData?.();
			};
			Asyncify.sleepCallbacks.push(sleepCallback);
			SDL.audio.callbackRemover = () => {
				Asyncify.sleepCallbacks = Asyncify.sleepCallbacks.filter(
					(callback) => callback !== sleepCallback
				);
			};

			// Create a callback function that will be routinely called to ask more audio data from the user application.
			SDL.audio.caller = () => {
				if (!SDL.audio) return;

				--SDL.audio.numAudioTimersPending;

				SDL.audio.queueNewAudioData();

				// Queue this callback function to be called again later to pull more audio data.
				var secsUntilNextPlayStart =
					SDL.audio.nextPlayTime - SDL.audioContext['currentTime'];

				// Queue the next audio frame push to be performed half-way when the previously queued buffer has finished playing.
				var preemptBufferFeedSecs = SDL.audio.bufferDurationSecs / 2.0;

				if (
					SDL.audio.numAudioTimersPending <
					SDL.audio.numSimultaneouslyQueuedBuffers
				) {
					++SDL.audio.numAudioTimersPending;
					SDL.audio.timer = safeSetTimeout(
						SDL.audio.caller,
						Math.max(
							0.0,
							1000.0 *
								(secsUntilNextPlayStart - preemptBufferFeedSecs)
						)
					);

					// If we are risking starving, immediately queue an extra buffer.
					if (
						SDL.audio.numAudioTimersPending <
						SDL.audio.numSimultaneouslyQueuedBuffers
					) {
						++SDL.audio.numAudioTimersPending;
						safeSetTimeout(SDL.audio.caller, 1.0);
					}
				}
			};

			SDL.audio.audioOutput = new Audio();

			// Initialize Web Audio API if we haven't done so yet. Note: Only initialize Web Audio context ever once on the web page,
			// since initializing multiple times fails on Chrome saying 'audio resources have been exhausted'.
			SDL.openAudioContext();
			if (!SDL.audioContext) abort('Web Audio API is not available!');
			autoResumeAudioContext(SDL.audioContext);
			SDL.audio.nextPlayTime = 0; // Time in seconds when the next audio block is due to start.

			// The pushAudio function with a new audio buffer whenever there is new
			// audio data to schedule to be played back on the device.
			SDL.audio.pushAudio = (ptr, sizeBytes) => {
				try {
					if (SDL.audio.paused) return;

					var sizeSamples = sizeBytes / SDL.audio.bytesPerSample; // How many samples fit in the callback buffer?
					var sizeSamplesPerChannel =
						sizeSamples / SDL.audio.channels; // How many samples per a single channel fit in the cb buffer?
					if (sizeSamplesPerChannel != SDL.audio.samples) {
						abort('Received mismatching audio buffer size!');
					}
					// Allocate new sound buffer to be played.
					var source = SDL.audioContext['createBufferSource']();
					var soundBuffer = SDL.audioContext['createBuffer'](
						SDL.audio.channels,
						sizeSamplesPerChannel,
						SDL.audio.freq
					);
					source['connect'](SDL.audioContext['destination']);

					SDL.fillWebAudioBufferFromHeap(
						ptr,
						sizeSamplesPerChannel,
						soundBuffer
					);
					// Workaround https://bugzil.la/883675 by setting the buffer only after filling. The order is important here!
					source['buffer'] = soundBuffer;

					// Schedule the generated sample buffer to be played out at the correct time right after the previously scheduled
					// sample buffer has finished.
					var curtime = SDL.audioContext['currentTime'];
					// Don't ever start buffer playbacks earlier from current time than a given constant 'SDL.audio.bufferingDelay', since a browser
					// may not be able to mix that audio clip in immediately, and there may be subsequent jitter that might cause the stream to starve.
					var playtime = Math.max(
						curtime + SDL.audio.bufferingDelay,
						SDL.audio.nextPlayTime
					);
					if (typeof source['start'] != 'undefined') {
						source['start'](playtime); // New Web Audio API: sound sources are started with a .start() call.
					} else if (typeof source['noteOn'] != 'undefined') {
						source['noteOn'](playtime); // Support old Web Audio API specification which had the .noteOn() API.
					}
					/*
            // Uncomment to debug SDL buffer feed starves.
            if (SDL.audio.curBufferEnd) {
              var thisBufferStart = Math.round(playtime * SDL.audio.freq);
              if (thisBufferStart != SDL.audio.curBufferEnd) out('SDL starved ' + (thisBufferStart - SDL.audio.curBufferEnd) + ' samples!');
            }
            SDL.audio.curBufferEnd = Math.round(playtime * SDL.audio.freq + sizeSamplesPerChannel);
            */

					SDL.audio.nextPlayTime =
						playtime + SDL.audio.bufferDurationSecs;
				} catch (e) {
					err(
						`Web Audio API error playing back audio: ${e.toString()}`
					);
				}
			};

			if (obtained) {
				// Report back the initialized audio parameters.
				HEAP32[obtained >> 2] = SDL.audio.freq;
				HEAP16[(obtained + 4) >> 1] = SDL.audio.format;
				HEAP8[obtained + 6] = SDL.audio.channels;
				HEAP8[obtained + 7] = SDL.audio.silence;
				HEAP16[(obtained + 8) >> 1] = SDL.audio.samples;
				HEAPU32[(obtained + 16) >> 2] = SDL.audio.callback;
				HEAPU32[(obtained + 20) >> 2] = SDL.audio.userdata;
			}
			SDL.allocateChannels(32);
		} catch (e) {
			err(
				`Initializing SDL audio threw an exception: "${e.toString()}"! Continuing without audio`
			);
			SDL.audio = null;
			SDL.allocateChannels(0);
			if (obtained) {
				HEAP32[obtained >> 2] = 0;
				HEAP16[(obtained + 4) >> 1] = 0;
				HEAP8[obtained + 6] = 0;
				HEAP8[obtained + 7] = 0;
				HEAP16[(obtained + 8) >> 1] = 0;
				HEAPU32[(obtained + 16) >> 2] = 0;
				HEAPU32[(obtained + 20) >> 2] = 0;
			}
		}
		if (!SDL.audio) {
			return -1;
		}
		return 0;
	};
	_SDL_OpenAudio.sig = 'ipp';

	var _SDL_PauseAudio = (pauseOn) => {
		if (!SDL.audio) {
			return;
		}
		if (pauseOn) {
			if (SDL.audio.timer !== undefined) {
				clearTimeout(SDL.audio.timer);
				SDL.audio.numAudioTimersPending = 0;
				SDL.audio.timer = undefined;
			}
		} else if (!SDL.audio.timer) {
			// Start the audio playback timer callback loop.
			SDL.audio.numAudioTimersPending = 1;
			SDL.audio.timer = safeSetTimeout(SDL.audio.caller, 1);
		}
		SDL.audio.paused = pauseOn;
	};
	_SDL_PauseAudio.sig = 'vi';

	var _SDL_CloseAudio = () => {
		if (SDL.audio) {
			if (SDL.audio.callbackRemover) {
				SDL.audio.callbackRemover();
				SDL.audio.callbackRemover = null;
			}
			_SDL_PauseAudio(1);
			_free(SDL.audio.buffer);
			SDL.audio = null;
			SDL.allocateChannels(0);
		}
	};
	_SDL_CloseAudio.sig = 'v';

	var _SDL_LockAudio = () => {};
	_SDL_LockAudio.sig = 'v';

	var _SDL_UnlockAudio = () => {};
	_SDL_UnlockAudio.sig = 'v';

	var _SDL_CreateMutex = () => 0;
	_SDL_CreateMutex.sig = 'p';

	var _SDL_mutexP = (mutex) => 0;
	_SDL_mutexP.sig = 'ip';

	var _SDL_mutexV = (mutex) => 0;
	_SDL_mutexV.sig = 'ip';

	var _SDL_DestroyMutex = (mutex) => {};
	_SDL_DestroyMutex.sig = 'vp';

	var _SDL_CreateCond = () => 0;
	_SDL_CreateCond.sig = 'p';

	var _SDL_CondSignal = (cond) => {};
	_SDL_CondSignal.sig = 'ip';

	var _SDL_CondWait = (cond, mutex) => {};
	_SDL_CondWait.sig = 'ipp';

	var _SDL_DestroyCond = (cond) => {};
	_SDL_DestroyCond.sig = 'vp';

	var _SDL_StartTextInput = () => {
		SDL.textInput = true;
	};
	_SDL_StartTextInput.sig = 'v';

	var _SDL_StopTextInput = () => {
		SDL.textInput = false;
	};
	_SDL_StopTextInput.sig = 'v';

	var _Mix_Init = (flags) => {
		if (!flags) return 0;
		return 8; /* MIX_INIT_OGG */
	};
	_Mix_Init.sig = 'ii';

	var _Mix_Quit = () => {};
	_Mix_Quit.sig = 'v';

	var _Mix_OpenAudio = (frequency, format, channels, chunksize) => {
		SDL.openAudioContext();
		autoResumeAudioContext(SDL.audioContext);
		SDL.allocateChannels(32);
		// Just record the values for a later call to Mix_QuickLoad_RAW
		SDL.mixerFrequency = frequency;
		SDL.mixerFormat = format;
		SDL.mixerNumChannels = channels;
		SDL.mixerChunkSize = chunksize;
		return 0;
	};
	_Mix_OpenAudio.sig = 'iiiii';

	var _Mix_CloseAudio = _SDL_CloseAudio;
	_Mix_CloseAudio.sig = 'v';

	var _Mix_AllocateChannels = (num) => {
		SDL.allocateChannels(num);
		return num;
	};
	_Mix_AllocateChannels.sig = 'ii';

	var _Mix_ChannelFinished = (func) => {
		SDL.channelFinished = func;
	};
	_Mix_ChannelFinished.sig = 'vp';

	var _Mix_Volume = (channel, volume) => {
		if (channel == -1) {
			for (var i = 0; i < SDL.numChannels - 1; i++) {
				_Mix_Volume(i, volume);
			}
			return _Mix_Volume(SDL.numChannels - 1, volume);
		}
		return SDL.setGetVolume(SDL.channels[channel], volume);
	};
	_Mix_Volume.sig = 'iii';

	var _Mix_SetPanning = (channel, left, right) => {
		// SDL API uses [0-255], while PannerNode has an (x, y, z) position.

		// Normalizing.
		left /= 255;
		right /= 255;

		// Set the z coordinate a little forward, otherwise there won't be any
		// smooth transition between left and right.
		SDL.setPannerPosition(SDL.channels[channel], right - left, 0, 0.1);
		return 1;
	};
	_Mix_SetPanning.sig = 'iiii';

	/** @param {number} freesrc */
	var _Mix_LoadWAV_RW = (rwopsID, freesrc) => {
		var rwops = SDL.rwops[rwopsID];

		if (rwops === undefined) return 0;

		var filename = '';
		var audio;
		var webAudio;
		var bytes;

		if (rwops.filename !== undefined) {
			filename = PATH_FS.resolve(rwops.filename);
			var raw = Browser.preloadedAudios[filename];
			if (!raw) {
				if (raw === null)
					err(
						'Trying to reuse preloaded audio, but freePreloadedMediaOnUse is set!'
					);
				if (!Module['noAudioDecoding'])
					warnOnce('Cannot find preloaded audio ' + filename);

				// see if we can read the file-contents from the in-memory FS
				try {
					bytes = FS.readFile(filename);
				} catch (e) {
					err(`Couldn't find file for: ${filename}`);
					return 0;
				}
			}
			if (Module['freePreloadedMediaOnUse']) {
				Browser.preloadedAudios[filename] = null;
			}
			audio = raw;
		} else if (rwops.bytes !== undefined) {
			// For Web Audio context buffer decoding, we must make a clone of the
			// audio data, but for <media> element, a view to existing data is
			// sufficient.
			if (SDL.webAudioAvailable()) {
				bytes = HEAPU8.buffer.slice(
					rwops.bytes,
					rwops.bytes + rwops.count
				);
			} else {
				bytes = HEAPU8.subarray(rwops.bytes, rwops.bytes + rwops.count);
			}
		} else {
			return 0;
		}

		var arrayBuffer = bytes ? bytes.buffer || bytes : bytes;

		// To allow user code to work around browser bugs with audio playback on <audio> elements an Web Audio, enable
		// the user code to hook in a callback to decide on a file basis whether each file should use Web Audio or <audio> for decoding and playback.
		// In particular, see https://bugzil.la/654787 and https://bugzil.la/1012801 for tradeoffs.
		var canPlayWithWebAudio =
			Module['SDL_canPlayWithWebAudio'] === undefined ||
			Module['SDL_canPlayWithWebAudio'](filename, arrayBuffer);

		if (
			bytes !== undefined &&
			SDL.webAudioAvailable() &&
			canPlayWithWebAudio
		) {
			audio = undefined;
			webAudio = {
				// The audio decoding process is asynchronous, which gives trouble if user
				// code plays the audio data back immediately after loading. Therefore
				// prepare an array of callback handlers to run when this audio decoding
				// is complete, which will then start the playback (with some delay).
				onDecodeComplete: [], // While this member array exists, decoding hasn't finished yet.
			};
			SDL.audioContext['decodeAudioData'](arrayBuffer, (data) => {
				webAudio.decodedBuffer = data;
				// Call all handlers that were waiting for this decode to finish, and
				// clear the handler list.
				webAudio.onDecodeComplete.forEach((e) => e());
				// Don't allow more callback handlers since audio has finished decoding.
				delete webAudio.onDecodeComplete;
			});
		} else if (audio === undefined && bytes) {
			// Here, we didn't find a preloaded audio but we either were passed a
			// filepath for which we loaded bytes, or we were passed some bytes
			var blob = new Blob([bytes], { type: rwops.mimetype });
			var url = URL.createObjectURL(blob);
			audio = new Audio();
			audio.src = url;
			audio.mozAudioChannelType = 'content'; // bugzilla 910340
		}

		var id = SDL.audios.length;
		// Keep the loaded audio in the audio arrays, ready for playback
		SDL.audios.push({
			source: filename,
			audio, // Points to the <audio> element, if loaded
			webAudio, // Points to a Web Audio -specific resource object, if loaded
		});
		return id;
	};
	_Mix_LoadWAV_RW.sig = 'ppi';

	var _Mix_LoadWAV = (filename) => {
		var rwops = _SDL_RWFromFile(filename, 0);
		var result = _Mix_LoadWAV_RW(rwops, 0);
		_SDL_FreeRW(rwops);
		return result;
	};
	_Mix_LoadWAV.sig = 'pp';

	var _Mix_QuickLoad_RAW = (mem, len) => {
		var audio;
		var webAudio;

		var numSamples = len >> 1; // len is the length in bytes, and the array contains 16-bit PCM values
		var buffer = new Float32Array(numSamples);
		for (var i = 0; i < numSamples; ++i) {
			buffer[i] = HEAP16[(mem + i * 2) >> 1] / 0x8000; // hardcoded 16-bit audio, signed (TODO: reSign if not ta2?)
		}

		if (SDL.webAudioAvailable()) {
			webAudio = { decodedBuffer: buffer };
		} else {
			audio = new Audio();
			audio.mozAudioChannelType = 'content'; // bugzilla 910340
			// Record the number of channels and frequency for later usage
			audio.numChannels = SDL.mixerNumChannels;
			audio.frequency = SDL.mixerFrequency;
			// FIXME: doesn't make sense to keep the audio element in the buffer
		}

		var id = SDL.audios.length;
		SDL.audios.push({
			source: '',
			audio,
			webAudio,
			buffer,
		});
		return id;
	};
	_Mix_QuickLoad_RAW.sig = 'ppi';

	var _Mix_FreeChunk = (id) => {
		SDL.audios[id] = null;
	};
	_Mix_FreeChunk.sig = 'vp';

	var _Mix_ReserveChannels = (num) => {
		SDL.channelMinimumNumber = num;
	};
	_Mix_ReserveChannels.sig = 'ii';

	var _Mix_HaltChannel = (channel) => {
		function halt(channel) {
			var info = /** @type {{ audio: HTMLMediaElement }} */ (
				SDL.channels[channel]
			);
			if (info.audio) {
				info.audio.pause();
				info.audio = null;
			}
			if (SDL.channelFinished) {
				getWasmTableEntry(SDL.channelFinished)(channel);
			}
		}
		if (channel != -1) {
			halt(channel);
		} else {
			for (var i = 0; i < SDL.channels.length; ++i) halt(i);
		}
		return 0;
	};
	_Mix_HaltChannel.sig = 'ii';

	var _Mix_PlayChannelTimed = (channel, id, loops, ticks) => {
		// TODO: handle fixed amount of N loops. Currently loops either 0 or infinite times.

		// Get the audio element associated with the ID
		var info = SDL.audios[id];
		if (!info) return -1;
		if (!info.audio && !info.webAudio) return -1;

		// If the user asks us to allocate a channel automatically, get the first
		// free one.
		if (channel == -1) {
			for (var i = SDL.channelMinimumNumber; i < SDL.numChannels; i++) {
				if (!SDL.channels[i].audio) {
					channel = i;
					break;
				}
			}
			if (channel == -1) {
				err(`All ${SDL.numChannels}  channels in use!`);
				return -1;
			}
		}
		var channelInfo = SDL.channels[channel];
		var audio;
		if (info.webAudio) {
			// Create an instance of the WebAudio object.
			// Make our instance look similar to the instance of a <media> to make api simple.
			audio = {
				resource: info, // This new object is an instance that refers to this existing resource.
				paused: false,
				currentPosition: 0,
				play() {
					SDL.playWebAudio(this);
				},
				pause() {
					SDL.pauseWebAudio(this);
				},
			};
		} else {
			// We clone the audio node to utilize the preloaded audio buffer, since
			// the browser has already preloaded the audio file.
			audio = info.audio.cloneNode(true);
			audio.numChannels = info.audio.numChannels;
			audio.frequency = info.audio.frequency;
		}
		audio['onended'] = function () {
			// TODO: cache these
			if (
				channelInfo.audio === this ||
				channelInfo.audio.webAudioNode === this
			) {
				channelInfo.audio.paused = true;
				channelInfo.audio = null;
			}
			if (SDL.channelFinished)
				getWasmTableEntry(SDL.channelFinished)(channel);
		};
		if (channelInfo.audio) {
			_Mix_HaltChannel(channel);
		}
		channelInfo.audio = audio;
		// TODO: handle N loops. Behavior matches Mix_PlayMusic
		audio.loop = loops != 0;
		audio.volume = channelInfo.volume;
		audio.play();
		return channel;
	};
	_Mix_PlayChannelTimed.sig = 'iipii';

	var _Mix_FadingChannel = (channel) => 0;
	_Mix_FadingChannel.sig = 'ii';

	var _Mix_HaltMusic = () => {
		var audio = /** @type {HTMLMediaElement} */ (SDL.music.audio);
		if (audio) {
			audio.src = audio.src; // rewind <media> element
			audio.currentPosition = 0; // rewind Web Audio graph playback.
			audio.pause();
		}
		SDL.music.audio = null;
		if (SDL.hookMusicFinished) {
			getWasmTableEntry(SDL.hookMusicFinished)();
		}
		return 0;
	};
	_Mix_HaltMusic.sig = 'i';

	var _Mix_HookMusicFinished = (func) => {
		SDL.hookMusicFinished = func;
		if (SDL.music.audio) {
			// ensure the callback will be called, if a music is already playing
			SDL.music.audio['onended'] = _Mix_HaltMusic;
		}
	};
	_Mix_HookMusicFinished.sig = 'vp';

	var _Mix_VolumeMusic = (volume) => SDL.setGetVolume(SDL.music, volume);
	_Mix_VolumeMusic.sig = 'ii';

	var _Mix_LoadMUS_RW = (filename) => _Mix_LoadWAV_RW(filename, 0);
	_Mix_LoadMUS_RW.sig = 'pp';

	var _Mix_LoadMUS = (filename) => {
		var rwops = _SDL_RWFromFile(filename, 0);
		var result = _Mix_LoadMUS_RW(rwops);
		_SDL_FreeRW(rwops);
		return result;
	};
	_Mix_LoadMUS.sig = 'pp';

	var _Mix_FreeMusic = _Mix_FreeChunk;
	_Mix_FreeMusic.sig = 'vp';

	var _Mix_PlayMusic = (id, loops) => {
		// Pause old music if it exists.
		if (SDL.music.audio) {
			if (!SDL.music.audio.paused)
				err(`Music is already playing. ${SDL.music.source}`);
			SDL.music.audio.pause();
		}
		var info = SDL.audios[id];
		var audio;
		if (info.webAudio) {
			// Play via Web Audio API
			// Create an instance of the WebAudio object.
			audio = {
				resource: info, // This new webAudio object is an instance that refers to this existing resource.
				paused: false,
				currentPosition: 0,
				play() {
					SDL.playWebAudio(this);
				},
				pause() {
					SDL.pauseWebAudio(this);
				},
			};
		} else if (info.audio) {
			// Play via the <audio> element
			audio = info.audio;
		}
		audio['onended'] = function () {
			if (
				SDL.music.audio === this ||
				SDL.music.audio?.webAudioNode === this
			) {
				_Mix_HaltMusic(); // will send callback
			}
		};
		audio.loop = loops != 0 && loops != 1; // TODO: handle N loops for finite N
		audio.volume = SDL.music.volume;
		SDL.music.audio = audio;
		audio.play();
		return 0;
	};
	_Mix_PlayMusic.sig = 'ipi';

	var _Mix_PauseMusic = () => {
		var audio = /** @type {HTMLMediaElement} */ (SDL.music.audio);
		audio?.pause();
	};
	_Mix_PauseMusic.sig = 'v';

	var _Mix_ResumeMusic = () => {
		var audio = SDL.music.audio;
		audio?.play();
	};
	_Mix_ResumeMusic.sig = 'v';

	var _Mix_FadeInMusicPos = _Mix_PlayMusic;
	_Mix_FadeInMusicPos.sig = 'ipiid';

	var _Mix_FadeOutMusic = _Mix_HaltMusic;
	_Mix_FadeOutMusic.sig = 'ii';

	var _Mix_PlayingMusic = () => SDL.music.audio && !SDL.music.audio.paused;
	_Mix_PlayingMusic.sig = 'i';

	var _Mix_Playing = (channel) => {
		if (channel === -1) {
			var count = 0;
			for (var i = 0; i < SDL.channels.length; i++) {
				count += _Mix_Playing(i);
			}
			return count;
		}
		var info = SDL.channels[channel];
		if (info?.audio && !info.audio.paused) {
			return 1;
		}
		return 0;
	};
	_Mix_Playing.sig = 'ii';

	var _Mix_Pause = (channel) => {
		if (channel === -1) {
			for (var i = 0; i < SDL.channels.length; i++) {
				_Mix_Pause(i);
			}
			return;
		}
		/** @type {{ audio: HTMLMediaElement }} */
		var info = SDL.channels[channel];
		if (info?.audio) {
			info.audio.pause();
		} else {
			//err(`Mix_Pause: no sound found for channel: ${channel}`);
		}
	};
	_Mix_Pause.sig = 'vi';

	var _Mix_Paused = (channel) => {
		if (channel === -1) {
			var pausedCount = 0;
			for (var i = 0; i < SDL.channels.length; i++) {
				pausedCount += _Mix_Paused(i);
			}
			return pausedCount;
		}
		var info = SDL.channels[channel];
		return info?.audio?.paused ? 1 : 0;
	};
	_Mix_Paused.sig = 'ii';

	var _Mix_PausedMusic = () => (SDL.music.audio?.paused ? 1 : 0);
	_Mix_PausedMusic.sig = 'i';

	var _Mix_Resume = (channel) => {
		if (channel === -1) {
			for (var i = 0; i < SDL.channels.length; i++) {
				_Mix_Resume(i);
			}
			return;
		}
		var info = SDL.channels[channel];
		if (info?.audio) info.audio.play();
	};
	_Mix_Resume.sig = 'vi';

	var _TTF_Init = () => {
		// OffscreenCanvas 2D is faster than Canvas for text operations, so we use
		// it if it's available.
		try {
			var offscreenCanvas = new OffscreenCanvas(0, 0);
			SDL.ttfContext = offscreenCanvas.getContext('2d');
		} catch (ex) {
			var canvas = /** @type {HTMLCanvasElement} */ (
				document.createElement('canvas')
			);
			SDL.ttfContext = canvas.getContext('2d');
		}
		return 0;
	};
	_TTF_Init.sig = 'i';

	var _TTF_OpenFont = (name, size) => {
		name = PATH.normalize(UTF8ToString(name));
		var id = SDL.fonts.length;
		SDL.fonts.push({
			name, // but we don't actually do anything with it..
			size,
		});
		return id;
	};
	_TTF_OpenFont.sig = 'ppi';

	var _TTF_CloseFont = (font) => {
		SDL.fonts[font] = null;
	};
	_TTF_CloseFont.sig = 'vp';

	var _TTF_RenderText_Solid = (font, text, color) => {
		// XXX the font and color are ignored
		text = UTF8ToString(text) || ' '; // if given an empty string, still return a valid surface
		var fontData = SDL.fonts[font];
		var w = SDL.estimateTextWidth(fontData, text);
		var h = fontData.size;
		color = SDL.loadColorToCSSRGB(color); // XXX alpha breaks fonts?
		var fontString = SDL.makeFontString(h, fontData.name);
		var surf = SDL.makeSurface(w, h, 0, false, 'text:' + text); // bogus numbers..
		var surfData = SDL.surfaces[surf];
		surfData.ctx.save();
		surfData.ctx.fillStyle = color;
		surfData.ctx.font = fontString;
		// use bottom alignment, because it works
		// same in all browsers, more info here:
		// https://bugzil.la/737852
		surfData.ctx.textBaseline = 'bottom';
		surfData.ctx.fillText(text, 0, h | 0);
		surfData.ctx.restore();
		return surf;
	};
	_TTF_RenderText_Solid.sig = 'pppp';

	var _TTF_RenderText_Blended = _TTF_RenderText_Solid;
	_TTF_RenderText_Blended.sig = 'pppp';

	var _TTF_RenderText_Shaded = _TTF_RenderText_Solid;
	_TTF_RenderText_Shaded.sig = 'ppppp';

	var _TTF_RenderUTF8_Solid = _TTF_RenderText_Solid;
	_TTF_RenderUTF8_Solid.sig = 'pppp';

	var _TTF_SizeText = (font, text, w, h) => {
		var fontData = SDL.fonts[font];
		if (w) {
			HEAP32[w >> 2] = SDL.estimateTextWidth(
				fontData,
				UTF8ToString(text)
			);
		}
		if (h) {
			HEAP32[h >> 2] = fontData.size;
		}
		return 0;
	};
	_TTF_SizeText.sig = 'ipppp';
	var _TTF_SizeUTF8 = _TTF_SizeText;
	_TTF_SizeUTF8.sig = 'ipppp';

	var _TTF_GlyphMetrics = (font, ch, minx, maxx, miny, maxy, advance) => {
		var fontData = SDL.fonts[font];
		var width = SDL.estimateTextWidth(fontData, String.fromCharCode(ch));

		if (advance) {
			HEAP32[advance >> 2] = width;
		}
		if (minx) {
			HEAP32[minx >> 2] = 0;
		}
		if (maxx) {
			HEAP32[maxx >> 2] = width;
		}
		if (miny) {
			HEAP32[miny >> 2] = 0;
		}
		if (maxy) {
			HEAP32[maxy >> 2] = fontData.size;
		}
	};
	_TTF_GlyphMetrics.sig = 'ipippppp';

	var _TTF_FontAscent = (font) => {
		var fontData = SDL.fonts[font];
		return (fontData.size * 0.98) | 0; // XXX
	};
	_TTF_FontAscent.sig = 'ip';

	var _TTF_FontDescent = (font) => {
		var fontData = SDL.fonts[font];
		return (fontData.size * 0.02) | 0; // XXX
	};
	_TTF_FontDescent.sig = 'ip';

	var _TTF_FontHeight = (font) => {
		var fontData = SDL.fonts[font];
		return fontData.size;
	};
	_TTF_FontHeight.sig = 'ip';

	var _TTF_FontLineSkip = _TTF_FontHeight;
	_TTF_FontLineSkip.sig = 'ip';

	var _TTF_Quit = () => out('TTF_Quit called (and ignored)');
	_TTF_Quit.sig = 'v';

	var SDL_gfx = {
		drawRectangle: (surf, x1, y1, x2, y2, action, cssColor) => {
			x1 = (x1 << 16) >> 16;
			y1 = (y1 << 16) >> 16;
			x2 = (x2 << 16) >> 16;
			y2 = (y2 << 16) >> 16;
			var surfData = SDL.surfaces[surf];
			// TODO: if ctx does not change, leave as is, and also do not re-set xStyle etc.
			var x = x1 < x2 ? x1 : x2;
			var y = y1 < y2 ? y1 : y2;
			var w = Math.abs(x2 - x1);
			var h = Math.abs(y2 - y1);
			surfData.ctx.save();
			surfData.ctx[action + 'Style'] = cssColor;
			surfData.ctx[action + 'Rect'](x, y, w, h);
			surfData.ctx.restore();
		},
		drawLine: (surf, x1, y1, x2, y2, cssColor) => {
			x1 = (x1 << 16) >> 16;
			y1 = (y1 << 16) >> 16;
			x2 = (x2 << 16) >> 16;
			y2 = (y2 << 16) >> 16;
			var surfData = SDL.surfaces[surf];
			surfData.ctx.save();
			surfData.ctx.strokeStyle = cssColor;
			surfData.ctx.beginPath();
			surfData.ctx.moveTo(x1, y1);
			surfData.ctx.lineTo(x2, y2);
			surfData.ctx.stroke();
			surfData.ctx.restore();
		},
		drawEllipse: (surf, x, y, rx, ry, action, cssColor) => {
			x = (x << 16) >> 16;
			y = (y << 16) >> 16;
			rx = (rx << 16) >> 16;
			ry = (ry << 16) >> 16;
			var surfData = SDL.surfaces[surf];

			surfData.ctx.save();
			surfData.ctx.beginPath();
			surfData.ctx.translate(x, y);
			surfData.ctx.scale(rx, ry);
			surfData.ctx.arc(0, 0, 1, 0, 2 * Math.PI);
			surfData.ctx.restore();

			surfData.ctx.save();
			surfData.ctx[action + 'Style'] = cssColor;
			surfData.ctx[action]();
			surfData.ctx.restore();
		},
		translateColorToCSSRGBA: (rgba) =>
			`rgba(${rgba >>> 24},${(rgba >> 16) & 0xff},${(rgba >> 8) & 0xff},${rgba & 0xff})`,
	};

	var _boxColor = (surf, x1, y1, x2, y2, color) =>
		SDL_gfx.drawRectangle(
			surf,
			x1,
			y1,
			x2,
			y2,
			'fill',
			SDL_gfx.translateColorToCSSRGBA(color)
		);
	_boxColor.sig = 'ipiiiii';

	var _boxRGBA = (surf, x1, y1, x2, y2, r, g, b, a) =>
		SDL_gfx.drawRectangle(
			surf,
			x1,
			y1,
			x2,
			y2,
			'fill',
			SDL.translateRGBAToCSSRGBA(r, g, b, a)
		);
	_boxRGBA.sig = 'ipiiiiiiii';

	var _rectangleColor = (surf, x1, y1, x2, y2, color) =>
		SDL_gfx.drawRectangle(
			surf,
			x1,
			y1,
			x2,
			y2,
			'stroke',
			SDL_gfx.translateColorToCSSRGBA(color)
		);
	_rectangleColor.sig = 'ipiiiii';

	var _rectangleRGBA = (surf, x1, y1, x2, y2, r, g, b, a) =>
		SDL_gfx.drawRectangle(
			surf,
			x1,
			y1,
			x2,
			y2,
			'stroke',
			SDL.translateRGBAToCSSRGBA(r, g, b, a)
		);
	_rectangleRGBA.sig = 'ipiiiiiiii';

	var _ellipseColor = (surf, x, y, rx, ry, color) =>
		SDL_gfx.drawEllipse(
			surf,
			x,
			y,
			rx,
			ry,
			'stroke',
			SDL_gfx.translateColorToCSSRGBA(color)
		);
	_ellipseColor.sig = 'ipiiiii';

	var _ellipseRGBA = (surf, x, y, rx, ry, r, g, b, a) =>
		SDL_gfx.drawEllipse(
			surf,
			x,
			y,
			rx,
			ry,
			'stroke',
			SDL.translateRGBAToCSSRGBA(r, g, b, a)
		);
	_ellipseRGBA.sig = 'ipiiiiiiii';

	var _filledEllipseColor = (surf, x, y, rx, ry, color) =>
		SDL_gfx.drawEllipse(
			surf,
			x,
			y,
			rx,
			ry,
			'fill',
			SDL_gfx.translateColorToCSSRGBA(color)
		);
	_filledEllipseColor.sig = 'ipiiiii';

	var _filledEllipseRGBA = (surf, x, y, rx, ry, r, g, b, a) =>
		SDL_gfx.drawEllipse(
			surf,
			x,
			y,
			rx,
			ry,
			'fill',
			SDL.translateRGBAToCSSRGBA(r, g, b, a)
		);
	_filledEllipseRGBA.sig = 'ipiiiiiiii';

	var _lineColor = (surf, x1, y1, x2, y2, color) =>
		SDL_gfx.drawLine(
			surf,
			x1,
			y1,
			x2,
			y2,
			SDL_gfx.translateColorToCSSRGBA(color)
		);
	_lineColor.sig = 'ipiiiii';

	var _lineRGBA = (surf, x1, y1, x2, y2, r, g, b, a) =>
		SDL_gfx.drawLine(
			surf,
			x1,
			y1,
			x2,
			y2,
			SDL.translateRGBAToCSSRGBA(r, g, b, a)
		);
	_lineRGBA.sig = 'ipiiiiiiii';

	var _pixelRGBA = (surf, x1, y1, r, g, b, a) =>
		_boxRGBA(surf, x1, y1, x1, y1, r, g, b, a);
	_pixelRGBA.sig = 'ipiiiiii';

	var _SDL_GL_SetAttribute = (attr, value) => {
		if (!(attr in SDL.glAttributes)) {
			abort(
				'Unknown SDL GL attribute (' +
					attr +
					'). Please check if your SDL version is supported.'
			);
		}

		SDL.glAttributes[attr] = value;
	};
	_SDL_GL_SetAttribute.sig = 'iii';

	var _SDL_GL_GetAttribute = (attr, value) => {
		if (!(attr in SDL.glAttributes)) {
			abort(
				'Unknown SDL GL attribute (' +
					attr +
					'). Please check if your SDL version is supported.'
			);
		}

		if (value) HEAP32[value >> 2] = SDL.glAttributes[attr];

		return 0;
	};
	_SDL_GL_GetAttribute.sig = 'iip';

	var _SDL_GL_SwapBuffers = () => Browser.doSwapBuffers?.();
	_SDL_GL_SwapBuffers.sig = 'v';

	var _SDL_GL_ExtensionSupported = (extension) =>
		GLctx?.getExtension(UTF8ToString(extension)) ? 1 : 0;
	_SDL_GL_ExtensionSupported.sig = 'ip';

	var _SDL_DestroyWindow = (window) => {};
	_SDL_DestroyWindow.sig = 'vp';

	var _SDL_DestroyRenderer = (renderer) => {};
	_SDL_DestroyRenderer.sig = 'vp';

	var _SDL_GetWindowFlags = (window) => {
		if (Browser.isFullscreen) {
			return 1;
		}

		return 0;
	};
	_SDL_GetWindowFlags.sig = 'ip';

	var _SDL_GL_SwapWindow = (window) => {};
	_SDL_GL_SwapWindow.sig = 'vp';

	var _SDL_GL_MakeCurrent = (window, context) => {};
	_SDL_GL_MakeCurrent.sig = 'ipp';

	var _SDL_GL_DeleteContext = (context) => {};
	_SDL_GL_DeleteContext.sig = 'vp';

	var _SDL_GL_GetSwapInterval = () => {
		if (MainLoop.timingMode == 1) {
			return MainLoop.timingValue;
		} else {
			return 0;
		}
	};
	_SDL_GL_GetSwapInterval.sig = 'i';

	var _SDL_GL_SetSwapInterval = (state) =>
		_emscripten_set_main_loop_timing(1, state);
	_SDL_GL_SetSwapInterval.sig = 'ii';

	var _SDL_SetWindowTitle = (window, title) => {
		if (title) document.title = UTF8ToString(title);
	};
	_SDL_SetWindowTitle.sig = 'vpp';

	var _SDL_GetWindowSize = (window, width, height) => {
		var canvas = Browser.getCanvas();
		if (width) HEAP32[width >> 2] = canvas.width;
		if (height) HEAP32[height >> 2] = canvas.height;
	};
	_SDL_GetWindowSize.sig = 'vppp';

	var _SDL_LogSetOutputFunction = (callback, userdata) => {};
	_SDL_LogSetOutputFunction.sig = 'vpp';

	var _SDL_SetWindowFullscreen = (window, fullscreen) => {
		if (Browser.isFullscreen) {
			Browser.getCanvas().exitFullscreen();
			return 1;
		}
		return 0;
	};
	_SDL_SetWindowFullscreen.sig = 'ipi';

	var _SDL_ClearError = () => {};
	_SDL_ClearError.sig = 'v';

	var _SDL_SetGamma = (r, g, b) => -1;
	_SDL_SetGamma.sig = 'ifff';

	var _SDL_SetGammaRamp = (redTable, greenTable, blueTable) => -1;
	_SDL_SetGammaRamp.sig = 'ippp';

	var _SDL_NumJoysticks = () => {
		var count = 0;
		var gamepads = SDL.getGamepads();
		// The length is not the number of gamepads; check which ones are defined.
		for (var gamepad of gamepads) {
			if (gamepad !== undefined) count++;
		}
		return count;
	};
	_SDL_NumJoysticks.sig = 'i';

	var _SDL_JoystickName = (deviceIndex) => {
		var gamepad = SDL.getGamepad(deviceIndex);
		if (gamepad) {
			var name = gamepad.id;
			if (SDL.joystickNamePool.hasOwnProperty(name)) {
				return SDL.joystickNamePool[name];
			}
			return (SDL.joystickNamePool[name] = stringToNewUTF8(name));
		}
		return 0;
	};
	_SDL_JoystickName.sig = 'pi';

	var _SDL_JoystickOpen = (deviceIndex) => {
		var gamepad = SDL.getGamepad(deviceIndex);
		if (gamepad) {
			// Use this as a unique 'pointer' for this joystick.
			var joystick = deviceIndex + 1;
			SDL.recordJoystickState(joystick, gamepad);
			return joystick;
		}
		return 0;
	};
	_SDL_JoystickOpen.sig = 'pi';

	var _SDL_JoystickOpened = (deviceIndex) =>
		SDL.lastJoystickState.hasOwnProperty(deviceIndex + 1) ? 1 : 0;
	_SDL_JoystickOpened.sig = 'ii';

	var _SDL_JoystickIndex = (joystick) => joystick - 1;
	_SDL_JoystickIndex.sig = 'ip';

	var _SDL_JoystickNumAxes = (joystick) => {
		var gamepad = SDL.getGamepad(joystick - 1);
		if (gamepad) {
			return gamepad.axes.length;
		}
		return 0;
	};
	_SDL_JoystickNumAxes.sig = 'ip';

	var _SDL_JoystickNumBalls = (joystick) => 0;
	_SDL_JoystickNumBalls.sig = 'ip';

	var _SDL_JoystickNumHats = (joystick) => 0;
	_SDL_JoystickNumHats.sig = 'ip';

	var _SDL_JoystickNumButtons = (joystick) => {
		var gamepad = SDL.getGamepad(joystick - 1);
		if (gamepad) {
			return gamepad.buttons.length;
		}
		return 0;
	};
	_SDL_JoystickNumButtons.sig = 'ip';

	var _SDL_JoystickUpdate = () => SDL.queryJoysticks();
	_SDL_JoystickUpdate.sig = 'v';

	var _SDL_JoystickEventState = (state) => {
		if (state < 0) {
			// SDL_QUERY: Return current state.
			return SDL.joystickEventState;
		}
		return (SDL.joystickEventState = state);
	};
	_SDL_JoystickEventState.sig = 'ii';

	var _SDL_JoystickGetAxis = (joystick, axis) => {
		var gamepad = SDL.getGamepad(joystick - 1);
		if (gamepad?.axes.length > axis) {
			return SDL.joystickAxisValueConversion(gamepad.axes[axis]);
		}
		return 0;
	};
	_SDL_JoystickGetAxis.sig = 'ipi';

	var _SDL_JoystickGetHat = (joystick, hat) => 0;
	_SDL_JoystickGetHat.sig = 'ipi';

	var _SDL_JoystickGetBall = (joystick, ball, dxptr, dyptr) => -1;
	_SDL_JoystickGetBall.sig = 'ipipp';

	var _SDL_JoystickGetButton = (joystick, button) => {
		var gamepad = SDL.getGamepad(joystick - 1);
		if (gamepad?.buttons.length > button) {
			return SDL.getJoystickButtonState(gamepad.buttons[button]) ? 1 : 0;
		}
		return 0;
	};
	_SDL_JoystickGetButton.sig = 'ipi';

	var _SDL_JoystickClose = (joystick) => {
		delete SDL.lastJoystickState[joystick];
	};
	_SDL_JoystickClose.sig = 'vp';

	var _SDL_InitSubSystem = (flags) => 0;
	_SDL_InitSubSystem.sig = 'ii';

	var _SDL_RWFromConstMem = (mem, size) => {
		var id = SDL.rwops.length; // TODO: recycle ids when they are null
		SDL.rwops.push({ bytes: mem, count: size });
		return id;
	};
	_SDL_RWFromConstMem.sig = 'ppi';

	var _SDL_RWFromMem = _SDL_RWFromConstMem;
	_SDL_RWFromMem.sig = 'ppi';

	var _SDL_GetNumAudioDrivers = () => 1;
	_SDL_GetNumAudioDrivers.sig = 'i';

	var _SDL_GetCurrentAudioDriver = () => stringToNewUTF8('Emscripten Audio');
	_SDL_GetCurrentAudioDriver.sig = 'p';

	var _SDL_GetScancodeFromKey = (key) => SDL.scanCodes[key];
	_SDL_GetScancodeFromKey.sig = 'ii';

	var _SDL_GetAudioDriver = (index) => _SDL_GetCurrentAudioDriver();
	_SDL_GetAudioDriver.sig = 'pi';

	var _SDL_EnableUNICODE = (on) => {
		var ret = SDL.unicode || 0;
		SDL.unicode = on;
		return ret;
	};
	_SDL_EnableUNICODE.sig = 'ii';

	var _SDL_AddTimer = (interval, callback, param) =>
		safeSetTimeout(
			() => getWasmTableEntry(callback)(interval, param),
			interval
		);
	_SDL_AddTimer.sig = 'iipp';

	var _SDL_RemoveTimer = (id) => {
		clearTimeout(id);
		return true;
	};
	_SDL_RemoveTimer.sig = 'ii';

	var _SDL_CreateThread = (fs, data, pfnBeginThread, pfnEndThread) =>
		abort(
			'SDL threads cannot be supported in the web platform because they assume shared state. See emscripten_create_worker etc. for a message-passing concurrency model that does let you run code in another thread.'
		);
	_SDL_CreateThread.sig = 'ppp';

	var _SDL_WaitThread = (thread, status) => abort('SDL_WaitThread: TODO');
	_SDL_WaitThread.sig = 'vpp';

	var _SDL_GetThreadID = (thread) => abort('SDL_GetThreadID: TODO');
	_SDL_GetThreadID.sig = 'pp';

	var _SDL_ThreadID = () => 0;
	_SDL_ThreadID.sig = 'p';

	var _SDL_AllocRW = () => abort('SDL_AllocRW: TODO');
	_SDL_AllocRW.sig = 'p';

	var _SDL_CondBroadcast = (cond) => abort('SDL_CondBroadcast: TODO');
	_SDL_CondBroadcast.sig = 'ip';

	var _SDL_CondWaitTimeout = (cond, mutex, ms) =>
		abort('SDL_CondWaitTimeout: TODO');
	_SDL_CondWaitTimeout.sig = 'ippi';

	var _SDL_WM_IconifyWindow = () => abort('SDL_WM_IconifyWindow TODO');
	_SDL_WM_IconifyWindow.sig = 'i';

	var _Mix_SetPostMix = (func, arg) => warnOnce('Mix_SetPostMix: TODO');
	_Mix_SetPostMix.sig = 'vpp';

	var _Mix_VolumeChunk = (chunk, volume) => abort('Mix_VolumeChunk: TODO');
	_Mix_VolumeChunk.sig = 'ipi';

	var _Mix_SetPosition = (channel, angle, distance) =>
		abort('Mix_SetPosition: TODO');
	_Mix_SetPosition.sig = 'iiii';

	var _Mix_QuerySpec = (frequency, format, channels) =>
		abort('Mix_QuerySpec: TODO');
	_Mix_QuerySpec.sig = 'ippp';

	var _Mix_FadeInChannelTimed = (channel, chunk, loop, ms, ticks) =>
		abort('Mix_FadeInChannelTimed');
	_Mix_FadeInChannelTimed.sig = 'iipiii';

	var _Mix_FadeOutChannel = () => abort('Mix_FadeOutChannel');
	_Mix_FadeOutChannel.sig = 'iii';

	var _Mix_Linked_Version = () => abort('Mix_Linked_Version: TODO');
	_Mix_Linked_Version.sig = 'p';

	var _SDL_SaveBMP_RW = (surface, dst, freedst) =>
		abort('SDL_SaveBMP_RW: TODO');
	_SDL_SaveBMP_RW.sig = 'ippi';

	var _SDL_WM_SetIcon = (icon, mask) => {};
	_SDL_WM_SetIcon.sig = 'vpp';

	var _SDL_HasRDTSC = () => 0;
	_SDL_HasRDTSC.sig = 'i';

	var _SDL_HasMMX = () => 0;
	_SDL_HasMMX.sig = 'i';

	var _SDL_HasMMXExt = () => 0;
	_SDL_HasMMXExt.sig = 'i';

	var _SDL_Has3DNow = () => 0;
	_SDL_Has3DNow.sig = 'i';

	var _SDL_Has3DNowExt = () => 0;
	_SDL_Has3DNowExt.sig = 'i';

	var _SDL_HasSSE = () => 0;
	_SDL_HasSSE.sig = 'i';

	var _SDL_HasSSE2 = () => 0;
	_SDL_HasSSE2.sig = 'i';

	var _SDL_HasAltiVec = () => 0;
	_SDL_HasAltiVec.sig = 'i';

	var ALLOC_NORMAL = 0;

	var ALLOC_STACK = 1;

	var allocate = (slab, allocator) => {
		var ret;

		if (allocator == ALLOC_STACK) {
			ret = stackAlloc(slab.length);
		} else {
			ret = _malloc(slab.length);
		}

		if (!slab.subarray && !slab.slice) {
			slab = new Uint8Array(slab);
		}
		HEAPU8.set(slab, ret);
		return ret;
	};

	/** @deprecated @param {boolean=} dontAddNull */
	var writeStringToMemory = (string, buffer, dontAddNull) => {
		warnOnce(
			'writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!'
		);

		var /** @type {number} */ lastChar, /** @type {number} */ end;
		if (dontAddNull) {
			// stringToUTF8 always appends null. If we don't want to do that, remember the
			// character that existed at the location where the null will be placed, and restore
			// that after the write (below).
			end = buffer + lengthBytesUTF8(string);
			lastChar = HEAP8[end];
		}
		stringToUTF8(string, buffer, Infinity);
		if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
	};

	/** @param {boolean=} dontAddNull */
	var writeAsciiToMemory = (str, buffer, dontAddNull) => {
		for (var i = 0; i < str.length; ++i) {
			HEAP8[buffer++] = str.charCodeAt(i);
		}
		// Null-terminate the string
		if (!dontAddNull) HEAP8[buffer] = 0;
	};

	var allocateUTF8 = (...args) => stringToNewUTF8(...args);

	var demangle = (func) => {
		// If demangle has failed before, stop demangling any further function names
		// This avoids an infinite recursion with malloc()->abort()->stackTrace()->demangle()->malloc()->...
		demangle.recursionGuard = (demangle.recursionGuard | 0) + 1;
		if (demangle.recursionGuard > 1) return func;
		return withStackSave(() => {
			try {
				var s = func;
				if (s.startsWith('__Z')) s = s.slice(1);
				var buf = stringToUTF8OnStack(s);
				var status = stackAlloc(4);
				var ret = ___cxa_demangle(buf, 0, 0, status);
				if (HEAP32[status >> 2] === 0 && ret) {
					return UTF8ToString(ret);
				}
				// otherwise, libcxxabi failed
			} catch (e) {
			} finally {
				_free(ret);
				if (demangle.recursionGuard < 2) --demangle.recursionGuard;
			}
			// failure when using libcxxabi, don't demangle
			return func;
		});
	};

	var stackTrace = () => {
		var js = jsStackTrace();
		if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
		return js;
	};

	var print = out;

	var printErr = err;

	var jstoi_s = Number;

	function getNativeTypeSize(type) {
		// prettier-ignore
		switch (type) {
      case 'i1': case 'i8': case 'u8': return 1;
      case 'i16': case 'u16': return 2;
      case 'i32': case 'u32': return 4;
      case 'i64': case 'u64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type.endsWith('*')) {
          return POINTER_SIZE;
        }
        if (type[0] === 'i') {
          const bits = Number(type.slice(1));
          // [FIXME] Cannot use assert here since this function is included directly
          // in the runtime JS library, where assert is not always available.
          // assert(bits % 8 === 0, `getNativeTypeSize invalid bits ${bits}, ${type} type`);
          return bits / 8;
        }
        return 0;
      }
    }
	}

	var _emscripten_is_main_browser_thread = () => !ENVIRONMENT_IS_WORKER;

	var _wasm_recv = function (sockfd, buffer, size, flags) {
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
	};

	var webSockets = new HandleAllocator();

	var WS = {
		socketEvent: null,
		getSocket(socketId) {
			if (!webSockets.has(socketId)) {
				return 0;
			}
			return webSockets.get(socketId);
		},
		getSocketEvent(socketId) {
			// Singleton event pointer.  Use EmscriptenWebSocketCloseEvent, which is
			// the largest event struct
			this.socketEvent ||= _malloc(520);
			HEAPU32[this.socketEvent >> 2] = socketId;
			return this.socketEvent;
		},
	};

	var _emscripten_websocket_get_ready_state = (socketId, readyState) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		HEAP16[readyState >> 1] = socket.readyState;
		return 0;
	};
	_emscripten_websocket_get_ready_state.sig = 'iip';

	var _emscripten_websocket_get_buffered_amount = (
		socketId,
		bufferedAmount
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		HEAPU32[bufferedAmount >> 2] = socket.bufferedAmount;
		return 0;
	};
	_emscripten_websocket_get_buffered_amount.sig = 'iip';

	var _emscripten_websocket_get_extensions = (
		socketId,
		extensions,
		extensionsLength
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}
		if (!extensions) return -5;
		stringToUTF8(socket.extensions, extensions, extensionsLength);
		return 0;
	};
	_emscripten_websocket_get_extensions.sig = 'iipi';

	var _emscripten_websocket_get_extensions_length = (
		socketId,
		extensionsLength
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}
		if (!extensionsLength) return -5;
		HEAP32[extensionsLength >> 2] = lengthBytesUTF8(socket.extensions) + 1;
		return 0;
	};
	_emscripten_websocket_get_extensions_length.sig = 'iip';

	var _emscripten_websocket_get_protocol = (
		socketId,
		protocol,
		protocolLength
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}
		if (!protocol) return -5;
		stringToUTF8(socket.protocol, protocol, protocolLength);
		return 0;
	};
	_emscripten_websocket_get_protocol.sig = 'iipi';

	var _emscripten_websocket_get_protocol_length = (
		socketId,
		protocolLength
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}
		if (!protocolLength) return -5;
		HEAP32[protocolLength >> 2] = lengthBytesUTF8(socket.protocol) + 1;
		return 0;
	};
	_emscripten_websocket_get_protocol_length.sig = 'iip';

	var _emscripten_websocket_get_url = (socketId, url, urlLength) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}
		if (!url) return -5;
		stringToUTF8(socket.url, url, urlLength);
		return 0;
	};
	_emscripten_websocket_get_url.sig = 'iipi';

	var _emscripten_websocket_get_url_length = (socketId, urlLength) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}
		if (!urlLength) return -5;
		HEAP32[urlLength >> 2] = lengthBytesUTF8(socket.url) + 1;
		return 0;
	};
	_emscripten_websocket_get_url_length.sig = 'iip';

	var _emscripten_websocket_set_onopen_callback_on_thread = (
		socketId,
		userData,
		callbackFunc,
		thread
	) => {
		// TODO:
		//    if (thread == 2 ||
		//      (thread == _pthread_self()) return emscripten_websocket_set_onopen_callback_on_calling_thread(socketId, userData, callbackFunc);
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		socket.onopen = function (e) {
			var eventPtr = WS.getSocketEvent(socketId);
			getWasmTableEntry(callbackFunc)(0 /*TODO*/, eventPtr, userData);
		};
		return 0;
	};
	_emscripten_websocket_set_onopen_callback_on_thread.sig = 'iippp';

	var _emscripten_websocket_set_onerror_callback_on_thread = (
		socketId,
		userData,
		callbackFunc,
		thread
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		socket.onerror = function (e) {
			var eventPtr = WS.getSocketEvent(socketId);
			getWasmTableEntry(callbackFunc)(0 /*TODO*/, eventPtr, userData);
		};
		return 0;
	};
	_emscripten_websocket_set_onerror_callback_on_thread.sig = 'iippp';

	var _emscripten_websocket_set_onclose_callback_on_thread = (
		socketId,
		userData,
		callbackFunc,
		thread
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		socket.onclose = function (e) {
			var eventPtr = WS.getSocketEvent(socketId);
			((HEAP8[eventPtr + 4] = e.wasClean),
				(HEAP16[(eventPtr + 6) >> 1] = e.code),
				stringToUTF8(e.reason, eventPtr + 8, 512));
			getWasmTableEntry(callbackFunc)(0 /*TODO*/, eventPtr, userData);
		};
		return 0;
	};
	_emscripten_websocket_set_onclose_callback_on_thread.sig = 'iippp';

	var _emscripten_websocket_set_onmessage_callback_on_thread = (
		socketId,
		userData,
		callbackFunc,
		thread
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		socket.onmessage = function (e) {
			var isText = typeof e.data == 'string';
			if (isText) {
				var buf = stringToNewUTF8(e.data);
				var len = lengthBytesUTF8(e.data) + 1;
			} else {
				var len = e.data.byteLength;
				var buf = _malloc(len);
				HEAP8.set(new Uint8Array(e.data), buf);
			}
			var eventPtr = WS.getSocketEvent(socketId);
			((HEAPU32[(eventPtr + 4) >> 2] = buf),
				(HEAP32[(eventPtr + 8) >> 2] = len),
				(HEAP8[eventPtr + 12] = isText),
				getWasmTableEntry(callbackFunc)(
					0 /*TODO*/,
					eventPtr,
					userData
				));
			_free(buf);
		};
		return 0;
	};
	_emscripten_websocket_set_onmessage_callback_on_thread.sig = 'iippp';

	var _emscripten_websocket_new = (createAttributes) => {
		if (!globalThis.WebSocket) {
			return -1;
		}
		if (!createAttributes) {
			return -5;
		}

		var url = UTF8ToString(HEAPU32[createAttributes >> 2]);
		var protocols = HEAPU32[(createAttributes + 4) >> 2];
		// TODO: Add support for createOnMainThread==false; currently all WebSocket connections are created on the main thread.
		// var createOnMainThread = HEAP8[createAttributes+2];

		var socket = protocols
			? new WebSocket(url, UTF8ToString(protocols).split(','))
			: new WebSocket(url);
		// We always marshal received WebSocket data back to Wasm, so enable receiving the data as arraybuffers for easy marshalling.
		socket.binaryType = 'arraybuffer';
		// TODO: While strictly not necessary, this ID would be good to be unique across all threads to avoid confusion.
		var socketId = webSockets.allocate(socket);

		return socketId;
	};
	_emscripten_websocket_new.sig = 'ip';

	var _emscripten_websocket_send_utf8_text = (socketId, textData) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		var str = UTF8ToString(textData);
		socket.send(str);
		return 0;
	};
	_emscripten_websocket_send_utf8_text.sig = 'iip';

	var _emscripten_websocket_send_binary = (
		socketId,
		binaryData,
		dataLength
	) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		socket.send(HEAPU8.subarray(binaryData, binaryData + dataLength));
		return 0;
	};
	_emscripten_websocket_send_binary.sig = 'iipi';

	var _emscripten_websocket_close = (socketId, code, reason) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		var reasonStr = reason ? UTF8ToString(reason) : undefined;
		// According to WebSocket specification, only close codes that are recognized have integer values
		// 1000-4999, with 3000-3999 and 4000-4999 denoting user-specified close codes:
		// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
		// Therefore be careful to call the .close() function with exact number and types of parameters.
		// Coerce code==0 to undefined, since Wasm->JS call can only marshal integers, and 0 is not allowed.
		if (reason) socket.close(code || undefined, UTF8ToString(reason));
		else if (code) socket.close(code);
		else socket.close();
		return 0;
	};
	_emscripten_websocket_close.sig = 'iiip';

	var _emscripten_websocket_delete = (socketId) => {
		var socket = WS.getSocket(socketId);
		if (!socket) {
			return -3;
		}

		socket.onopen =
			socket.onerror =
			socket.onclose =
			socket.onmessage =
				null;
		webSockets.free(socketId);
		return 0;
	};
	_emscripten_websocket_delete.sig = 'ii';

	var _emscripten_websocket_is_supported = () =>
		typeof WebSocket != 'undefined';
	_emscripten_websocket_is_supported.sig = 'i';

	var _emscripten_websocket_deinitialize = () => {
		for (var i in WS.sockets) {
			var socket = WS.sockets[i];
			if (socket) {
				socket.close();
				_emscripten_websocket_delete(i);
			}
		}
		WS.sockets = [];
	};
	_emscripten_websocket_deinitialize.sig = 'v';

	registerWasmPlugin();
	FS.createPreloadedFile = FS_createPreloadedFile;
	FS.preloadFile = FS_preloadFile;
	FS.staticInit();
	if (ENVIRONMENT_IS_NODE) {
		NODEFS.staticInit();
	}
	PHPWASM.init(PHPLoader?.phpWasmInitOptions);

	Module['requestAnimationFrame'] = MainLoop.requestAnimationFrame;
	Module['pauseMainLoop'] = MainLoop.pause;
	Module['resumeMainLoop'] = MainLoop.resume;
	MainLoop.init();
	for (let i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i));
	var miniTempWebGLFloatBuffersStorage = new Float32Array(288);
	// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
	for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
		miniTempWebGLFloatBuffers[i] =
			miniTempWebGLFloatBuffersStorage.subarray(0, i);
	}
	var miniTempWebGLIntBuffersStorage = new Int32Array(288);
	// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
	for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
		miniTempWebGLIntBuffers[i] = miniTempWebGLIntBuffersStorage.subarray(
			0,
			i
		);
	}

	if (globalThis.setImmediate) {
		emSetImmediate = setImmediateWrapped;
		emClearImmediate = clearImmediateWrapped;
	} else if (globalThis.addEventListener) {
		var __setImmediate_id_counter = 0;
		var __setImmediate_queue = [];
		var __setImmediate_message_id = '_si';
		/** @param {Event} e */
		var __setImmediate_cb = (e) => {
			if (e.data === __setImmediate_message_id) {
				e.stopPropagation();
				__setImmediate_queue.shift()();
				++__setImmediate_id_counter;
			}
		};
		addEventListener('message', __setImmediate_cb, true);
		emSetImmediate = (func) => {
			postMessage(__setImmediate_message_id, '*');
			return (
				__setImmediate_id_counter + __setImmediate_queue.push(func) - 1
			);
		};
		emClearImmediate = /**@type{function(number=)}*/ (
			(id) => {
				var index = id - __setImmediate_id_counter;
				// must preserve the order and count of elements in the queue, so replace the pending callback with an empty function
				if (index >= 0 && index < __setImmediate_queue.length)
					__setImmediate_queue[index] = () => {};
			}
		);
	}

	// Queue new audio data. This is important to be right after the main loop
	// invocation, so that we will immediately be able to queue the newest
	// produced audio samples.
	registerPostMainLoop(() => SDL.audio?.queueNewAudioData?.());
	// End JS library code

	// include: postlibrary.js
	// This file is included after the automatically-generated JS library code
	// but before the wasm module is created.

	{
		// Begin ATMODULES hooks
		if (Module['preloadPlugins']) preloadPlugins = Module['preloadPlugins'];
		if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];
		if (Module['print']) out = Module['print'];
		if (Module['printErr']) err = Module['printErr'];
		if (Module['dynamicLibraries'])
			dynamicLibraries = Module['dynamicLibraries'];
		if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
		// End ATMODULES hooks

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

	// Begin runtime exports
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
	// End runtime exports
	// Begin JS library exports
	Module['UTF8ToString'] = UTF8ToString;
	Module['lengthBytesUTF8'] = lengthBytesUTF8;
	Module['stringToUTF8'] = stringToUTF8;
	Module['FS'] = FS;
	Module['_exit'] = _exit;
	Module['_emscripten_sleep'] = _emscripten_sleep;
	Module['_setTempRet0'] = _setTempRet0;
	Module['_getTempRet0'] = _getTempRet0;
	Module['__Unwind_RaiseException'] = __Unwind_RaiseException;
	Module['__Unwind_DeleteException'] = __Unwind_DeleteException;
	Module['_sched_yield'] = _sched_yield;
	Module['___syscall_shutdown'] = ___syscall_shutdown;
	// End JS library exports

	// end include: postlibrary.js

	var ASM_CONSTS = {
		18472194: ($0) => {
			if (!$0) {
				AL.alcErr = 0xa004;
				return 1;
			}
		},
		18472242: ($0) => {
			if (!AL.currentCtx) {
				err('alGetProcAddress() called without a valid context');
				return 1;
			}
			if (!$0) {
				AL.currentCtx.err = 0xa003;
				return 1;
			}
		},
	};
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
			const POLLIN = 0x0001;
			const POLLPRI = 0x0002;
			const POLLOUT = 0x0004;
			const POLLERR = 0x0008;
			const POLLHUP = 0x0010;
			const POLLNVAL = 0x0020;
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
			var timeout = 5000;
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

	// Imports from the Wasm binary.
	var _memcmp,
		_free,
		_malloc,
		___errno_location,
		_fileno,
		_realloc,
		_strerror,
		_calloc,
		_wasm_popen,
		_wasm_php_exec,
		_php_pollfd_for,
		_htons,
		_ntohs,
		_htonl,
		_wasm_sleep,
		_fflush,
		_flock,
		_initgroups,
		_wasm_read,
		___wrap_usleep,
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
		_wasm_get_end_offset,
		___wrap_getpid,
		_wasm_trace,
		_memcpy,
		___funcs_on_exit,
		___dl_seterr,
		__emscripten_find_dylib,
		_emscripten_builtin_memalign,
		__emscripten_timeout,
		_emscripten_get_sbrk_ptr,
		___trap,
		__emscripten_tempret_set,
		__emscripten_tempret_get,
		_emscripten_stack_set_limits,
		__emscripten_stack_restore,
		__emscripten_stack_alloc,
		_emscripten_stack_get_current,
		___cxa_demangle,
		___cxa_decrement_exception_refcount,
		___cxa_throw,
		___cxa_increment_exception_refcount,
		___thrown_object_from_unwind_exception,
		___get_exception_message,
		memory,
		___stack_pointer,
		__indirect_function_table,
		___cpp_exception,
		wasmTable,
		wasmMemory;

	function assignWasmExports(wasmExports) {
		_memcmp = wasmExports['memcmp'];
		_free = PHPLoader['free'] = wasmExports['free'];
		_malloc =
			PHPLoader['malloc'] =
			Module['_malloc'] =
				wasmExports['malloc'];
		___errno_location = Module['___errno_location'] =
			wasmExports['__errno_location'];
		_fileno = wasmExports['fileno'];
		_realloc = wasmExports['realloc'];
		_strerror = wasmExports['strerror'];
		_calloc = wasmExports['calloc'];
		_wasm_popen = Module['_wasm_popen'] = wasmExports['wasm_popen'];
		_wasm_php_exec = Module['_wasm_php_exec'] =
			wasmExports['wasm_php_exec'];
		_php_pollfd_for = Module['_php_pollfd_for'] =
			wasmExports['php_pollfd_for'];
		_htons = wasmExports['htons'];
		_ntohs = wasmExports['ntohs'];
		_htonl = wasmExports['htonl'];
		_wasm_sleep = Module['_wasm_sleep'] = wasmExports['wasm_sleep'];
		_fflush = wasmExports['fflush'];
		_flock = Module['_flock'] = wasmExports['flock'];
		_initgroups = Module['_initgroups'] = wasmExports['initgroups'];
		_wasm_read = Module['_wasm_read'] = wasmExports['wasm_read'];
		___wrap_usleep = Module['___wrap_usleep'] =
			wasmExports['__wrap_usleep'];
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
		_wasm_free = Module['_wasm_free'] = wasmExports['wasm_free'];
		_wasm_get_end_offset = Module['_wasm_get_end_offset'] =
			wasmExports['wasm_get_end_offset'];
		___wrap_getpid = Module['___wrap_getpid'] =
			wasmExports['__wrap_getpid'];
		_wasm_trace = Module['_wasm_trace'] = wasmExports['wasm_trace'];
		_memcpy = wasmExports['memcpy'];
		___funcs_on_exit = wasmExports['__funcs_on_exit'];
		___dl_seterr = wasmExports['__dl_seterr'];
		__emscripten_find_dylib = wasmExports['_emscripten_find_dylib'];
		_emscripten_builtin_memalign =
			wasmExports['emscripten_builtin_memalign'];
		__emscripten_timeout = wasmExports['_emscripten_timeout'];
		_emscripten_get_sbrk_ptr = wasmExports['emscripten_get_sbrk_ptr'];
		___trap = wasmExports['__trap'];
		__emscripten_tempret_set = wasmExports['_emscripten_tempret_set'];
		__emscripten_tempret_get = wasmExports['_emscripten_tempret_get'];
		_emscripten_stack_set_limits =
			wasmExports['emscripten_stack_set_limits'];
		__emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
		__emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
		_emscripten_stack_get_current =
			wasmExports['emscripten_stack_get_current'];
		___cxa_demangle = wasmExports['__cxa_demangle'];
		___cxa_decrement_exception_refcount =
			wasmExports['__cxa_decrement_exception_refcount'];
		___cxa_throw = wasmExports['__cxa_throw'];
		___cxa_increment_exception_refcount =
			wasmExports['__cxa_increment_exception_refcount'];
		___thrown_object_from_unwind_exception =
			wasmExports['__thrown_object_from_unwind_exception'];
		___get_exception_message = wasmExports['__get_exception_message'];
		memory = wasmMemory = wasmExports['memory'];
		___stack_pointer = wasmExports['__stack_pointer'];
		__indirect_function_table = wasmTable =
			wasmExports['__indirect_function_table'];
		___cpp_exception = wasmExports['__cpp_exception'];
	}

	var ___heap_base = 20032480;

	var wasmImports = {
		/** @export */
		IMG_Init: _IMG_Init,
		/** @export */
		IMG_Load: _IMG_Load,
		/** @export */
		IMG_Load_RW: _IMG_Load_RW,
		/** @export */
		IMG_Quit: _IMG_Quit,
		/** @export */
		Mix_AllocateChannels: _Mix_AllocateChannels,
		/** @export */
		Mix_ChannelFinished: _Mix_ChannelFinished,
		/** @export */
		Mix_CloseAudio: _Mix_CloseAudio,
		/** @export */
		Mix_FadeInChannelTimed: _Mix_FadeInChannelTimed,
		/** @export */
		Mix_FadeInMusicPos: _Mix_FadeInMusicPos,
		/** @export */
		Mix_FadeOutChannel: _Mix_FadeOutChannel,
		/** @export */
		Mix_FadeOutMusic: _Mix_FadeOutMusic,
		/** @export */
		Mix_FadingChannel: _Mix_FadingChannel,
		/** @export */
		Mix_FreeChunk: _Mix_FreeChunk,
		/** @export */
		Mix_FreeMusic: _Mix_FreeMusic,
		/** @export */
		Mix_HaltChannel: _Mix_HaltChannel,
		/** @export */
		Mix_HaltMusic: _Mix_HaltMusic,
		/** @export */
		Mix_HookMusicFinished: _Mix_HookMusicFinished,
		/** @export */
		Mix_Init: _Mix_Init,
		/** @export */
		Mix_Linked_Version: _Mix_Linked_Version,
		/** @export */
		Mix_LoadMUS: _Mix_LoadMUS,
		/** @export */
		Mix_LoadMUS_RW: _Mix_LoadMUS_RW,
		/** @export */
		Mix_LoadWAV: _Mix_LoadWAV,
		/** @export */
		Mix_LoadWAV_RW: _Mix_LoadWAV_RW,
		/** @export */
		Mix_OpenAudio: _Mix_OpenAudio,
		/** @export */
		Mix_Pause: _Mix_Pause,
		/** @export */
		Mix_PauseMusic: _Mix_PauseMusic,
		/** @export */
		Mix_Paused: _Mix_Paused,
		/** @export */
		Mix_PausedMusic: _Mix_PausedMusic,
		/** @export */
		Mix_PlayChannelTimed: _Mix_PlayChannelTimed,
		/** @export */
		Mix_PlayMusic: _Mix_PlayMusic,
		/** @export */
		Mix_Playing: _Mix_Playing,
		/** @export */
		Mix_PlayingMusic: _Mix_PlayingMusic,
		/** @export */
		Mix_QuerySpec: _Mix_QuerySpec,
		/** @export */
		Mix_QuickLoad_RAW: _Mix_QuickLoad_RAW,
		/** @export */
		Mix_Quit: _Mix_Quit,
		/** @export */
		Mix_ReserveChannels: _Mix_ReserveChannels,
		/** @export */
		Mix_Resume: _Mix_Resume,
		/** @export */
		Mix_ResumeMusic: _Mix_ResumeMusic,
		/** @export */
		Mix_SetPanning: _Mix_SetPanning,
		/** @export */
		Mix_SetPosition: _Mix_SetPosition,
		/** @export */
		Mix_SetPostMix: _Mix_SetPostMix,
		/** @export */
		Mix_Volume: _Mix_Volume,
		/** @export */
		Mix_VolumeChunk: _Mix_VolumeChunk,
		/** @export */
		Mix_VolumeMusic: _Mix_VolumeMusic,
		/** @export */
		SDL_AddTimer: _SDL_AddTimer,
		/** @export */
		SDL_AllocRW: _SDL_AllocRW,
		/** @export */
		SDL_AudioDriverName: _SDL_AudioDriverName,
		/** @export */
		SDL_AudioQuit: _SDL_AudioQuit,
		/** @export */
		SDL_ClearError: _SDL_ClearError,
		/** @export */
		SDL_CloseAudio: _SDL_CloseAudio,
		/** @export */
		SDL_CondBroadcast: _SDL_CondBroadcast,
		/** @export */
		SDL_CondSignal: _SDL_CondSignal,
		/** @export */
		SDL_CondWait: _SDL_CondWait,
		/** @export */
		SDL_CondWaitTimeout: _SDL_CondWaitTimeout,
		/** @export */
		SDL_ConvertSurface: _SDL_ConvertSurface,
		/** @export */
		SDL_CreateCond: _SDL_CreateCond,
		/** @export */
		SDL_CreateMutex: _SDL_CreateMutex,
		/** @export */
		SDL_CreateRGBSurface: _SDL_CreateRGBSurface,
		/** @export */
		SDL_CreateRGBSurfaceFrom: _SDL_CreateRGBSurfaceFrom,
		/** @export */
		SDL_CreateThread: _SDL_CreateThread,
		/** @export */
		SDL_Delay: _SDL_Delay,
		/** @export */
		SDL_DestroyCond: _SDL_DestroyCond,
		/** @export */
		SDL_DestroyMutex: _SDL_DestroyMutex,
		/** @export */
		SDL_DestroyRenderer: _SDL_DestroyRenderer,
		/** @export */
		SDL_DestroyWindow: _SDL_DestroyWindow,
		/** @export */
		SDL_DisplayFormat: _SDL_DisplayFormat,
		/** @export */
		SDL_DisplayFormatAlpha: _SDL_DisplayFormatAlpha,
		/** @export */
		SDL_EnableKeyRepeat: _SDL_EnableKeyRepeat,
		/** @export */
		SDL_EnableUNICODE: _SDL_EnableUNICODE,
		/** @export */
		SDL_FillRect: _SDL_FillRect,
		/** @export */
		SDL_Flip: _SDL_Flip,
		/** @export */
		SDL_FreeRW: _SDL_FreeRW,
		/** @export */
		SDL_FreeSurface: _SDL_FreeSurface,
		/** @export */
		SDL_GL_DeleteContext: _SDL_GL_DeleteContext,
		/** @export */
		SDL_GL_ExtensionSupported: _SDL_GL_ExtensionSupported,
		/** @export */
		SDL_GL_GetAttribute: _SDL_GL_GetAttribute,
		/** @export */
		SDL_GL_GetSwapInterval: _SDL_GL_GetSwapInterval,
		/** @export */
		SDL_GL_MakeCurrent: _SDL_GL_MakeCurrent,
		/** @export */
		SDL_GL_SetAttribute: _SDL_GL_SetAttribute,
		/** @export */
		SDL_GL_SetSwapInterval: _SDL_GL_SetSwapInterval,
		/** @export */
		SDL_GL_SwapBuffers: _SDL_GL_SwapBuffers,
		/** @export */
		SDL_GL_SwapWindow: _SDL_GL_SwapWindow,
		/** @export */
		SDL_GetAppState: _SDL_GetAppState,
		/** @export */
		SDL_GetAudioDriver: _SDL_GetAudioDriver,
		/** @export */
		SDL_GetClipRect: _SDL_GetClipRect,
		/** @export */
		SDL_GetCurrentAudioDriver: _SDL_GetCurrentAudioDriver,
		/** @export */
		SDL_GetError: _SDL_GetError,
		/** @export */
		SDL_GetKeyName: _SDL_GetKeyName,
		/** @export */
		SDL_GetKeyState: _SDL_GetKeyState,
		/** @export */
		SDL_GetKeyboardState: _SDL_GetKeyboardState,
		/** @export */
		SDL_GetModState: _SDL_GetModState,
		/** @export */
		SDL_GetMouseState: _SDL_GetMouseState,
		/** @export */
		SDL_GetNumAudioDrivers: _SDL_GetNumAudioDrivers,
		/** @export */
		SDL_GetRGB: _SDL_GetRGB,
		/** @export */
		SDL_GetRGBA: _SDL_GetRGBA,
		/** @export */
		SDL_GetScancodeFromKey: _SDL_GetScancodeFromKey,
		/** @export */
		SDL_GetThreadID: _SDL_GetThreadID,
		/** @export */
		SDL_GetTicks: _SDL_GetTicks,
		/** @export */
		SDL_GetVideoInfo: _SDL_GetVideoInfo,
		/** @export */
		SDL_GetVideoSurface: _SDL_GetVideoSurface,
		/** @export */
		SDL_GetWindowFlags: _SDL_GetWindowFlags,
		/** @export */
		SDL_GetWindowSize: _SDL_GetWindowSize,
		/** @export */
		SDL_Has3DNow: _SDL_Has3DNow,
		/** @export */
		SDL_Has3DNowExt: _SDL_Has3DNowExt,
		/** @export */
		SDL_HasAltiVec: _SDL_HasAltiVec,
		/** @export */
		SDL_HasMMX: _SDL_HasMMX,
		/** @export */
		SDL_HasMMXExt: _SDL_HasMMXExt,
		/** @export */
		SDL_HasRDTSC: _SDL_HasRDTSC,
		/** @export */
		SDL_HasSSE: _SDL_HasSSE,
		/** @export */
		SDL_HasSSE2: _SDL_HasSSE2,
		/** @export */
		SDL_Init: _SDL_Init,
		/** @export */
		SDL_InitSubSystem: _SDL_InitSubSystem,
		/** @export */
		SDL_JoystickClose: _SDL_JoystickClose,
		/** @export */
		SDL_JoystickEventState: _SDL_JoystickEventState,
		/** @export */
		SDL_JoystickGetAxis: _SDL_JoystickGetAxis,
		/** @export */
		SDL_JoystickGetBall: _SDL_JoystickGetBall,
		/** @export */
		SDL_JoystickGetButton: _SDL_JoystickGetButton,
		/** @export */
		SDL_JoystickGetHat: _SDL_JoystickGetHat,
		/** @export */
		SDL_JoystickIndex: _SDL_JoystickIndex,
		/** @export */
		SDL_JoystickName: _SDL_JoystickName,
		/** @export */
		SDL_JoystickNumAxes: _SDL_JoystickNumAxes,
		/** @export */
		SDL_JoystickNumBalls: _SDL_JoystickNumBalls,
		/** @export */
		SDL_JoystickNumButtons: _SDL_JoystickNumButtons,
		/** @export */
		SDL_JoystickNumHats: _SDL_JoystickNumHats,
		/** @export */
		SDL_JoystickOpen: _SDL_JoystickOpen,
		/** @export */
		SDL_JoystickOpened: _SDL_JoystickOpened,
		/** @export */
		SDL_JoystickUpdate: _SDL_JoystickUpdate,
		/** @export */
		SDL_Linked_Version: _SDL_Linked_Version,
		/** @export */
		SDL_ListModes: _SDL_ListModes,
		/** @export */
		SDL_LoadBMP_RW: _SDL_LoadBMP_RW,
		/** @export */
		SDL_LockAudio: _SDL_LockAudio,
		/** @export */
		SDL_LockSurface: _SDL_LockSurface,
		/** @export */
		SDL_LogSetOutputFunction: _SDL_LogSetOutputFunction,
		/** @export */
		SDL_LowerBlit: _SDL_LowerBlit,
		/** @export */
		SDL_LowerBlitScaled: _SDL_LowerBlitScaled,
		/** @export */
		SDL_MapRGB: _SDL_MapRGB,
		/** @export */
		SDL_MapRGBA: _SDL_MapRGBA,
		/** @export */
		SDL_NumJoysticks: _SDL_NumJoysticks,
		/** @export */
		SDL_OpenAudio: _SDL_OpenAudio,
		/** @export */
		SDL_PauseAudio: _SDL_PauseAudio,
		/** @export */
		SDL_PeepEvents: _SDL_PeepEvents,
		/** @export */
		SDL_PollEvent: _SDL_PollEvent,
		/** @export */
		SDL_PumpEvents: _SDL_PumpEvents,
		/** @export */
		SDL_PushEvent: _SDL_PushEvent,
		/** @export */
		SDL_Quit: _SDL_Quit,
		/** @export */
		SDL_QuitSubSystem: _SDL_QuitSubSystem,
		/** @export */
		SDL_RWFromConstMem: _SDL_RWFromConstMem,
		/** @export */
		SDL_RWFromFile: _SDL_RWFromFile,
		/** @export */
		SDL_RWFromMem: _SDL_RWFromMem,
		/** @export */
		SDL_RemoveTimer: _SDL_RemoveTimer,
		/** @export */
		SDL_SaveBMP_RW: _SDL_SaveBMP_RW,
		/** @export */
		SDL_SetAlpha: _SDL_SetAlpha,
		/** @export */
		SDL_SetClipRect: _SDL_SetClipRect,
		/** @export */
		SDL_SetColorKey: _SDL_SetColorKey,
		/** @export */
		SDL_SetColors: _SDL_SetColors,
		/** @export */
		SDL_SetError: _SDL_SetError,
		/** @export */
		SDL_SetGamma: _SDL_SetGamma,
		/** @export */
		SDL_SetGammaRamp: _SDL_SetGammaRamp,
		/** @export */
		SDL_SetPalette: _SDL_SetPalette,
		/** @export */
		SDL_SetVideoMode: _SDL_SetVideoMode,
		/** @export */
		SDL_SetWindowFullscreen: _SDL_SetWindowFullscreen,
		/** @export */
		SDL_SetWindowTitle: _SDL_SetWindowTitle,
		/** @export */
		SDL_ShowCursor: _SDL_ShowCursor,
		/** @export */
		SDL_StartTextInput: _SDL_StartTextInput,
		/** @export */
		SDL_StopTextInput: _SDL_StopTextInput,
		/** @export */
		SDL_ThreadID: _SDL_ThreadID,
		/** @export */
		SDL_UnlockAudio: _SDL_UnlockAudio,
		/** @export */
		SDL_UnlockSurface: _SDL_UnlockSurface,
		/** @export */
		SDL_UpdateRect: _SDL_UpdateRect,
		/** @export */
		SDL_UpdateRects: _SDL_UpdateRects,
		/** @export */
		SDL_UpperBlit: _SDL_UpperBlit,
		/** @export */
		SDL_UpperBlitScaled: _SDL_UpperBlitScaled,
		/** @export */
		SDL_VideoDriverName: _SDL_VideoDriverName,
		/** @export */
		SDL_VideoModeOK: _SDL_VideoModeOK,
		/** @export */
		SDL_VideoQuit: _SDL_VideoQuit,
		/** @export */
		SDL_WM_GrabInput: _SDL_WM_GrabInput,
		/** @export */
		SDL_WM_IconifyWindow: _SDL_WM_IconifyWindow,
		/** @export */
		SDL_WM_SetCaption: _SDL_WM_SetCaption,
		/** @export */
		SDL_WM_SetIcon: _SDL_WM_SetIcon,
		/** @export */
		SDL_WM_ToggleFullScreen: _SDL_WM_ToggleFullScreen,
		/** @export */
		SDL_WaitThread: _SDL_WaitThread,
		/** @export */
		SDL_WarpMouse: _SDL_WarpMouse,
		/** @export */
		SDL_WasInit: _SDL_WasInit,
		/** @export */
		SDL_mutexP: _SDL_mutexP,
		/** @export */
		SDL_mutexV: _SDL_mutexV,
		/** @export */
		TTF_CloseFont: _TTF_CloseFont,
		/** @export */
		TTF_FontAscent: _TTF_FontAscent,
		/** @export */
		TTF_FontDescent: _TTF_FontDescent,
		/** @export */
		TTF_FontHeight: _TTF_FontHeight,
		/** @export */
		TTF_FontLineSkip: _TTF_FontLineSkip,
		/** @export */
		TTF_GlyphMetrics: _TTF_GlyphMetrics,
		/** @export */
		TTF_Init: _TTF_Init,
		/** @export */
		TTF_OpenFont: _TTF_OpenFont,
		/** @export */
		TTF_Quit: _TTF_Quit,
		/** @export */
		TTF_RenderText_Blended: _TTF_RenderText_Blended,
		/** @export */
		TTF_RenderText_Shaded: _TTF_RenderText_Shaded,
		/** @export */
		TTF_RenderText_Solid: _TTF_RenderText_Solid,
		/** @export */
		TTF_RenderUTF8_Solid: _TTF_RenderUTF8_Solid,
		/** @export */
		TTF_SizeText: _TTF_SizeText,
		/** @export */
		TTF_SizeUTF8: _TTF_SizeUTF8,
		/** @export */
		XChangeWindowAttributes: _XChangeWindowAttributes,
		/** @export */
		XCreateWindow: _XCreateWindow,
		/** @export */
		XInternAtom: _XInternAtom,
		/** @export */
		XMapWindow: _XMapWindow,
		/** @export */
		XOpenDisplay: _XOpenDisplay,
		/** @export */
		XPending: _XPending,
		/** @export */
		XSendEvent: _XSendEvent,
		/** @export */
		XSetWMHints: _XSetWMHints,
		/** @export */
		XStoreName: _XStoreName,
		/** @export */
		_Unwind_Backtrace: __Unwind_Backtrace,
		/** @export */
		_Unwind_FindEnclosingFunction: __Unwind_FindEnclosingFunction,
		/** @export */
		_Unwind_GetIPInfo: __Unwind_GetIPInfo,
		/** @export */
		__asctime_r: ___asctime_r,
		/** @export */
		__assert_fail: ___assert_fail,
		/** @export */
		__asyncjs__js_module_onMessage,
		/** @export */
		__asyncjs__js_popen_to_file,
		/** @export */
		__asyncjs__wasm_poll_socket,
		/** @export */
		__call_sighandler: ___call_sighandler,
		/** @export */
		__syscall__newselect: ___syscall__newselect,
		/** @export */
		__syscall_accept4: ___syscall_accept4,
		/** @export */
		__syscall_bind: ___syscall_bind,
		/** @export */
		__syscall_chdir: ___syscall_chdir,
		/** @export */
		__syscall_chmod: ___syscall_chmod,
		/** @export */
		__syscall_connect: ___syscall_connect,
		/** @export */
		__syscall_dup: ___syscall_dup,
		/** @export */
		__syscall_dup3: ___syscall_dup3,
		/** @export */
		__syscall_faccessat: ___syscall_faccessat,
		/** @export */
		__syscall_fadvise64: ___syscall_fadvise64,
		/** @export */
		__syscall_fallocate: ___syscall_fallocate,
		/** @export */
		__syscall_fchdir: ___syscall_fchdir,
		/** @export */
		__syscall_fchmod: ___syscall_fchmod,
		/** @export */
		__syscall_fchmodat2: ___syscall_fchmodat2,
		/** @export */
		__syscall_fchown32: ___syscall_fchown32,
		/** @export */
		__syscall_fchownat: ___syscall_fchownat,
		/** @export */
		__syscall_fcntl64: ___syscall_fcntl64,
		/** @export */
		__syscall_fdatasync: ___syscall_fdatasync,
		/** @export */
		__syscall_fstat64: ___syscall_fstat64,
		/** @export */
		__syscall_fstatfs64: ___syscall_fstatfs64,
		/** @export */
		__syscall_ftruncate64: ___syscall_ftruncate64,
		/** @export */
		__syscall_getcwd: ___syscall_getcwd,
		/** @export */
		__syscall_getdents64: ___syscall_getdents64,
		/** @export */
		__syscall_getpeername: ___syscall_getpeername,
		/** @export */
		__syscall_getsockname: ___syscall_getsockname,
		/** @export */
		__syscall_getsockopt: ___syscall_getsockopt,
		/** @export */
		__syscall_ioctl: ___syscall_ioctl,
		/** @export */
		__syscall_listen: ___syscall_listen,
		/** @export */
		__syscall_lstat64: ___syscall_lstat64,
		/** @export */
		__syscall_mkdirat: ___syscall_mkdirat,
		/** @export */
		__syscall_mknodat: ___syscall_mknodat,
		/** @export */
		__syscall_newfstatat: ___syscall_newfstatat,
		/** @export */
		__syscall_openat: ___syscall_openat,
		/** @export */
		__syscall_pipe: ___syscall_pipe,
		/** @export */
		__syscall_poll: ___syscall_poll,
		/** @export */
		__syscall_readlinkat: ___syscall_readlinkat,
		/** @export */
		__syscall_recvfrom: ___syscall_recvfrom,
		/** @export */
		__syscall_recvmsg: ___syscall_recvmsg,
		/** @export */
		__syscall_renameat: ___syscall_renameat,
		/** @export */
		__syscall_rmdir: ___syscall_rmdir,
		/** @export */
		__syscall_sendmsg: ___syscall_sendmsg,
		/** @export */
		__syscall_sendto: ___syscall_sendto,
		/** @export */
		__syscall_socket: ___syscall_socket,
		/** @export */
		__syscall_stat64: ___syscall_stat64,
		/** @export */
		__syscall_statfs64: ___syscall_statfs64,
		/** @export */
		__syscall_symlinkat: ___syscall_symlinkat,
		/** @export */
		__syscall_truncate64: ___syscall_truncate64,
		/** @export */
		__syscall_unlinkat: ___syscall_unlinkat,
		/** @export */
		__syscall_utimensat: ___syscall_utimensat,
		/** @export */
		_abort_js: __abort_js,
		/** @export */
		_dlopen_js: __dlopen_js,
		/** @export */
		_dlsym_catchup_js: __dlsym_catchup_js,
		/** @export */
		_dlsym_js: __dlsym_js,
		/** @export */
		_emscripten_dlopen_js: __emscripten_dlopen_js,
		/** @export */
		_emscripten_fs_load_embedded_files: __emscripten_fs_load_embedded_files,
		/** @export */
		_emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,
		/** @export */
		_emscripten_get_progname: __emscripten_get_progname,
		/** @export */
		_emscripten_log_formatted: __emscripten_log_formatted,
		/** @export */
		_emscripten_lookup_name: __emscripten_lookup_name,
		/** @export */
		_emscripten_push_main_loop_blocker: __emscripten_push_main_loop_blocker,
		/** @export */
		_emscripten_push_uncounted_main_loop_blocker:
			__emscripten_push_uncounted_main_loop_blocker,
		/** @export */
		_emscripten_runtime_keepalive_clear:
			__emscripten_runtime_keepalive_clear,
		/** @export */
		_emscripten_system: __emscripten_system,
		/** @export */
		_glGetActiveAttribOrUniform: __glGetActiveAttribOrUniform,
		/** @export */
		_gmtime_js: __gmtime_js,
		/** @export */
		_load_secondary_module: __load_secondary_module,
		/** @export */
		_localtime_js: __localtime_js,
		/** @export */
		_mktime_js: __mktime_js,
		/** @export */
		_mmap_js: __mmap_js,
		/** @export */
		_msync_js: __msync_js,
		/** @export */
		_munmap_js: __munmap_js,
		/** @export */
		_setitimer_js: __setitimer_js,
		/** @export */
		_timegm_js: __timegm_js,
		/** @export */
		_tzset_js: __tzset_js,
		/** @export */
		alBuffer3f: _alBuffer3f,
		/** @export */
		alBuffer3i: _alBuffer3i,
		/** @export */
		alBufferData: _alBufferData,
		/** @export */
		alBufferf: _alBufferf,
		/** @export */
		alBufferfv: _alBufferfv,
		/** @export */
		alBufferi: _alBufferi,
		/** @export */
		alBufferiv: _alBufferiv,
		/** @export */
		alDeleteBuffers: _alDeleteBuffers,
		/** @export */
		alDeleteSources: _alDeleteSources,
		/** @export */
		alDisable: _alDisable,
		/** @export */
		alDistanceModel: _alDistanceModel,
		/** @export */
		alDopplerFactor: _alDopplerFactor,
		/** @export */
		alDopplerVelocity: _alDopplerVelocity,
		/** @export */
		alEnable: _alEnable,
		/** @export */
		alGenBuffers: _alGenBuffers,
		/** @export */
		alGenSources: _alGenSources,
		/** @export */
		alGetBoolean: _alGetBoolean,
		/** @export */
		alGetBooleanv: _alGetBooleanv,
		/** @export */
		alGetBuffer3f: _alGetBuffer3f,
		/** @export */
		alGetBuffer3i: _alGetBuffer3i,
		/** @export */
		alGetBufferf: _alGetBufferf,
		/** @export */
		alGetBufferfv: _alGetBufferfv,
		/** @export */
		alGetBufferi: _alGetBufferi,
		/** @export */
		alGetBufferiv: _alGetBufferiv,
		/** @export */
		alGetDouble: _alGetDouble,
		/** @export */
		alGetDoublev: _alGetDoublev,
		/** @export */
		alGetEnumValue: _alGetEnumValue,
		/** @export */
		alGetError: _alGetError,
		/** @export */
		alGetFloat: _alGetFloat,
		/** @export */
		alGetFloatv: _alGetFloatv,
		/** @export */
		alGetInteger: _alGetInteger,
		/** @export */
		alGetIntegerv: _alGetIntegerv,
		/** @export */
		alGetListener3f: _alGetListener3f,
		/** @export */
		alGetListener3i: _alGetListener3i,
		/** @export */
		alGetListenerf: _alGetListenerf,
		/** @export */
		alGetListenerfv: _alGetListenerfv,
		/** @export */
		alGetListeneri: _alGetListeneri,
		/** @export */
		alGetListeneriv: _alGetListeneriv,
		/** @export */
		alGetSource3f: _alGetSource3f,
		/** @export */
		alGetSource3i: _alGetSource3i,
		/** @export */
		alGetSourcef: _alGetSourcef,
		/** @export */
		alGetSourcefv: _alGetSourcefv,
		/** @export */
		alGetSourcei: _alGetSourcei,
		/** @export */
		alGetSourceiv: _alGetSourceiv,
		/** @export */
		alGetString: _alGetString,
		/** @export */
		alIsBuffer: _alIsBuffer,
		/** @export */
		alIsEnabled: _alIsEnabled,
		/** @export */
		alIsExtensionPresent: _alIsExtensionPresent,
		/** @export */
		alIsSource: _alIsSource,
		/** @export */
		alListener3f: _alListener3f,
		/** @export */
		alListener3i: _alListener3i,
		/** @export */
		alListenerf: _alListenerf,
		/** @export */
		alListenerfv: _alListenerfv,
		/** @export */
		alListeneri: _alListeneri,
		/** @export */
		alListeneriv: _alListeneriv,
		/** @export */
		alSource3f: _alSource3f,
		/** @export */
		alSource3i: _alSource3i,
		/** @export */
		alSourcePause: _alSourcePause,
		/** @export */
		alSourcePausev: _alSourcePausev,
		/** @export */
		alSourcePlay: _alSourcePlay,
		/** @export */
		alSourcePlayv: _alSourcePlayv,
		/** @export */
		alSourceQueueBuffers: _alSourceQueueBuffers,
		/** @export */
		alSourceRewind: _alSourceRewind,
		/** @export */
		alSourceRewindv: _alSourceRewindv,
		/** @export */
		alSourceStop: _alSourceStop,
		/** @export */
		alSourceStopv: _alSourceStopv,
		/** @export */
		alSourceUnqueueBuffers: _alSourceUnqueueBuffers,
		/** @export */
		alSourcef: _alSourcef,
		/** @export */
		alSourcefv: _alSourcefv,
		/** @export */
		alSourcei: _alSourcei,
		/** @export */
		alSourceiv: _alSourceiv,
		/** @export */
		alSpeedOfSound: _alSpeedOfSound,
		/** @export */
		alcCaptureCloseDevice: _alcCaptureCloseDevice,
		/** @export */
		alcCaptureOpenDevice: _alcCaptureOpenDevice,
		/** @export */
		alcCaptureSamples: _alcCaptureSamples,
		/** @export */
		alcCaptureStart: _alcCaptureStart,
		/** @export */
		alcCaptureStop: _alcCaptureStop,
		/** @export */
		alcCloseDevice: _alcCloseDevice,
		/** @export */
		alcCreateContext: _alcCreateContext,
		/** @export */
		alcDestroyContext: _alcDestroyContext,
		/** @export */
		alcGetContextsDevice: _alcGetContextsDevice,
		/** @export */
		alcGetCurrentContext: _alcGetCurrentContext,
		/** @export */
		alcGetEnumValue: _alcGetEnumValue,
		/** @export */
		alcGetError: _alcGetError,
		/** @export */
		alcGetIntegerv: _alcGetIntegerv,
		/** @export */
		alcGetString: _alcGetString,
		/** @export */
		alcIsExtensionPresent: _alcIsExtensionPresent,
		/** @export */
		alcMakeContextCurrent: _alcMakeContextCurrent,
		/** @export */
		alcOpenDevice: _alcOpenDevice,
		/** @export */
		alcProcessContext: _alcProcessContext,
		/** @export */
		alcSuspendContext: _alcSuspendContext,
		/** @export */
		boxColor: _boxColor,
		/** @export */
		boxRGBA: _boxRGBA,
		/** @export */
		builtin_fcntl64: _builtin_fcntl64,
		/** @export */
		builtin_fd_close: _builtin_fd_close,
		/** @export */
		clock_res_get: _clock_res_get,
		/** @export */
		clock_time_get: _clock_time_get,
		/** @export */
		eglBindAPI: _eglBindAPI,
		/** @export */
		eglChooseConfig: _eglChooseConfig,
		/** @export */
		eglCreateContext: _eglCreateContext,
		/** @export */
		eglCreateWindowSurface: _eglCreateWindowSurface,
		/** @export */
		eglDestroyContext: _eglDestroyContext,
		/** @export */
		eglDestroySurface: _eglDestroySurface,
		/** @export */
		eglGetConfigAttrib: _eglGetConfigAttrib,
		/** @export */
		eglGetConfigs: _eglGetConfigs,
		/** @export */
		eglGetCurrentContext: _eglGetCurrentContext,
		/** @export */
		eglGetCurrentDisplay: _eglGetCurrentDisplay,
		/** @export */
		eglGetCurrentSurface: _eglGetCurrentSurface,
		/** @export */
		eglGetDisplay: _eglGetDisplay,
		/** @export */
		eglGetError: _eglGetError,
		/** @export */
		eglInitialize: _eglInitialize,
		/** @export */
		eglMakeCurrent: _eglMakeCurrent,
		/** @export */
		eglQueryAPI: _eglQueryAPI,
		/** @export */
		eglQueryContext: _eglQueryContext,
		/** @export */
		eglQueryString: _eglQueryString,
		/** @export */
		eglQuerySurface: _eglQuerySurface,
		/** @export */
		eglReleaseThread: _eglReleaseThread,
		/** @export */
		eglSwapBuffers: _eglSwapBuffers,
		/** @export */
		eglSwapInterval: _eglSwapInterval,
		/** @export */
		eglTerminate: _eglTerminate,
		/** @export */
		eglWaitClient: _eglWaitClient,
		/** @export */
		eglWaitGL: _eglWaitGL,
		/** @export */
		eglWaitNative: _eglWaitNative,
		/** @export */
		ellipseColor: _ellipseColor,
		/** @export */
		ellipseRGBA: _ellipseRGBA,
		/** @export */
		emscripten_SDL_SetEventHandler: _emscripten_SDL_SetEventHandler,
		/** @export */
		emscripten_alcDevicePauseSOFT: _emscripten_alcDevicePauseSOFT,
		/** @export */
		emscripten_alcDeviceResumeSOFT: _emscripten_alcDeviceResumeSOFT,
		/** @export */
		emscripten_alcGetStringiSOFT: _emscripten_alcGetStringiSOFT,
		/** @export */
		emscripten_alcResetDeviceSOFT: _emscripten_alcResetDeviceSOFT,
		/** @export */
		emscripten_asm_const_async_on_main_thread:
			_emscripten_asm_const_async_on_main_thread,
		/** @export */
		emscripten_asm_const_double: _emscripten_asm_const_double,
		/** @export */
		emscripten_asm_const_double_sync_on_main_thread:
			_emscripten_asm_const_double_sync_on_main_thread,
		/** @export */
		emscripten_asm_const_int: _emscripten_asm_const_int,
		/** @export */
		emscripten_asm_const_int_sync_on_main_thread:
			_emscripten_asm_const_int_sync_on_main_thread,
		/** @export */
		emscripten_asm_const_ptr: _emscripten_asm_const_ptr,
		/** @export */
		emscripten_asm_const_ptr_sync_on_main_thread:
			_emscripten_asm_const_ptr_sync_on_main_thread,
		/** @export */
		emscripten_async_call: _emscripten_async_call,
		/** @export */
		emscripten_async_load_script: _emscripten_async_load_script,
		/** @export */
		emscripten_async_run_script: _emscripten_async_run_script,
		/** @export */
		emscripten_async_wget: _emscripten_async_wget,
		/** @export */
		emscripten_async_wget2: _emscripten_async_wget2,
		/** @export */
		emscripten_async_wget2_abort: _emscripten_async_wget2_abort,
		/** @export */
		emscripten_async_wget2_data: _emscripten_async_wget2_data,
		/** @export */
		emscripten_async_wget_data: _emscripten_async_wget_data,
		/** @export */
		emscripten_call_worker: _emscripten_call_worker,
		/** @export */
		emscripten_cancel_animation_frame: _emscripten_cancel_animation_frame,
		/** @export */
		emscripten_cancel_main_loop: _emscripten_cancel_main_loop,
		/** @export */
		emscripten_clear_immediate: _emscripten_clear_immediate,
		/** @export */
		emscripten_clear_interval: _emscripten_clear_interval,
		/** @export */
		emscripten_clear_timeout: _emscripten_clear_timeout,
		/** @export */
		emscripten_console_error: _emscripten_console_error,
		/** @export */
		emscripten_console_log: _emscripten_console_log,
		/** @export */
		emscripten_console_trace: _emscripten_console_trace,
		/** @export */
		emscripten_console_warn: _emscripten_console_warn,
		/** @export */
		emscripten_create_worker: _emscripten_create_worker,
		/** @export */
		emscripten_date_now: _emscripten_date_now,
		/** @export */
		emscripten_debugger: _emscripten_debugger,
		/** @export */
		emscripten_destroy_worker: _emscripten_destroy_worker,
		/** @export */
		emscripten_enter_soft_fullscreen: _emscripten_enter_soft_fullscreen,
		/** @export */
		emscripten_err: _emscripten_err,
		/** @export */
		emscripten_errn: _emscripten_errn,
		/** @export */
		emscripten_exit_fullscreen: _emscripten_exit_fullscreen,
		/** @export */
		emscripten_exit_pointerlock: _emscripten_exit_pointerlock,
		/** @export */
		emscripten_exit_soft_fullscreen: _emscripten_exit_soft_fullscreen,
		/** @export */
		emscripten_exit_with_live_runtime: _emscripten_exit_with_live_runtime,
		/** @export */
		emscripten_fiber_swap: _emscripten_fiber_swap,
		/** @export */
		emscripten_force_exit: _emscripten_force_exit,
		/** @export */
		emscripten_get_battery_status: _emscripten_get_battery_status,
		/** @export */
		emscripten_get_callstack: _emscripten_get_callstack,
		/** @export */
		emscripten_get_canvas_element_size: _emscripten_get_canvas_element_size,
		/** @export */
		emscripten_get_canvas_size: _emscripten_get_canvas_size,
		/** @export */
		emscripten_get_compiler_setting: _emscripten_get_compiler_setting,
		/** @export */
		emscripten_get_device_pixel_ratio: _emscripten_get_device_pixel_ratio,
		/** @export */
		emscripten_get_devicemotion_status: _emscripten_get_devicemotion_status,
		/** @export */
		emscripten_get_deviceorientation_status:
			_emscripten_get_deviceorientation_status,
		/** @export */
		emscripten_get_element_css_size: _emscripten_get_element_css_size,
		/** @export */
		emscripten_get_fullscreen_status: _emscripten_get_fullscreen_status,
		/** @export */
		emscripten_get_gamepad_status: _emscripten_get_gamepad_status,
		/** @export */
		emscripten_get_heap_max: _emscripten_get_heap_max,
		/** @export */
		emscripten_get_main_loop_timing: _emscripten_get_main_loop_timing,
		/** @export */
		emscripten_get_mouse_status: _emscripten_get_mouse_status,
		/** @export */
		emscripten_get_now: _emscripten_get_now,
		/** @export */
		emscripten_get_now_res: _emscripten_get_now_res,
		/** @export */
		emscripten_get_num_gamepads: _emscripten_get_num_gamepads,
		/** @export */
		emscripten_get_orientation_status: _emscripten_get_orientation_status,
		/** @export */
		emscripten_get_pointerlock_status: _emscripten_get_pointerlock_status,
		/** @export */
		emscripten_get_preloaded_image_data:
			_emscripten_get_preloaded_image_data,
		/** @export */
		emscripten_get_preloaded_image_data_from_FILE:
			_emscripten_get_preloaded_image_data_from_FILE,
		/** @export */
		emscripten_get_screen_size: _emscripten_get_screen_size,
		/** @export */
		emscripten_get_visibility_status: _emscripten_get_visibility_status,
		/** @export */
		emscripten_get_window_title: _emscripten_get_window_title,
		/** @export */
		emscripten_get_worker_queue_size: _emscripten_get_worker_queue_size,
		/** @export */
		emscripten_glActiveTexture: _emscripten_glActiveTexture,
		/** @export */
		emscripten_glAttachShader: _emscripten_glAttachShader,
		/** @export */
		emscripten_glBegin: _emscripten_glBegin,
		/** @export */
		emscripten_glBeginQueryEXT: _emscripten_glBeginQueryEXT,
		/** @export */
		emscripten_glBindAttribLocation: _emscripten_glBindAttribLocation,
		/** @export */
		emscripten_glBindBuffer: _emscripten_glBindBuffer,
		/** @export */
		emscripten_glBindFramebuffer: _emscripten_glBindFramebuffer,
		/** @export */
		emscripten_glBindRenderbuffer: _emscripten_glBindRenderbuffer,
		/** @export */
		emscripten_glBindTexture: _emscripten_glBindTexture,
		/** @export */
		emscripten_glBindVertexArray: _emscripten_glBindVertexArray,
		/** @export */
		emscripten_glBindVertexArrayOES: _emscripten_glBindVertexArrayOES,
		/** @export */
		emscripten_glBlendColor: _emscripten_glBlendColor,
		/** @export */
		emscripten_glBlendEquation: _emscripten_glBlendEquation,
		/** @export */
		emscripten_glBlendEquationSeparate: _emscripten_glBlendEquationSeparate,
		/** @export */
		emscripten_glBlendFunc: _emscripten_glBlendFunc,
		/** @export */
		emscripten_glBlendFuncSeparate: _emscripten_glBlendFuncSeparate,
		/** @export */
		emscripten_glBufferData: _emscripten_glBufferData,
		/** @export */
		emscripten_glBufferSubData: _emscripten_glBufferSubData,
		/** @export */
		emscripten_glCheckFramebufferStatus:
			_emscripten_glCheckFramebufferStatus,
		/** @export */
		emscripten_glClear: _emscripten_glClear,
		/** @export */
		emscripten_glClearColor: _emscripten_glClearColor,
		/** @export */
		emscripten_glClearDepth: _emscripten_glClearDepth,
		/** @export */
		emscripten_glClearDepthf: _emscripten_glClearDepthf,
		/** @export */
		emscripten_glClearStencil: _emscripten_glClearStencil,
		/** @export */
		emscripten_glClipControlEXT: _emscripten_glClipControlEXT,
		/** @export */
		emscripten_glColorMask: _emscripten_glColorMask,
		/** @export */
		emscripten_glCompileShader: _emscripten_glCompileShader,
		/** @export */
		emscripten_glCompressedTexImage2D: _emscripten_glCompressedTexImage2D,
		/** @export */
		emscripten_glCompressedTexSubImage2D:
			_emscripten_glCompressedTexSubImage2D,
		/** @export */
		emscripten_glCopyTexImage2D: _emscripten_glCopyTexImage2D,
		/** @export */
		emscripten_glCopyTexSubImage2D: _emscripten_glCopyTexSubImage2D,
		/** @export */
		emscripten_glCreateProgram: _emscripten_glCreateProgram,
		/** @export */
		emscripten_glCreateShader: _emscripten_glCreateShader,
		/** @export */
		emscripten_glCullFace: _emscripten_glCullFace,
		/** @export */
		emscripten_glDeleteBuffers: _emscripten_glDeleteBuffers,
		/** @export */
		emscripten_glDeleteFramebuffers: _emscripten_glDeleteFramebuffers,
		/** @export */
		emscripten_glDeleteProgram: _emscripten_glDeleteProgram,
		/** @export */
		emscripten_glDeleteQueriesEXT: _emscripten_glDeleteQueriesEXT,
		/** @export */
		emscripten_glDeleteRenderbuffers: _emscripten_glDeleteRenderbuffers,
		/** @export */
		emscripten_glDeleteShader: _emscripten_glDeleteShader,
		/** @export */
		emscripten_glDeleteTextures: _emscripten_glDeleteTextures,
		/** @export */
		emscripten_glDeleteVertexArrays: _emscripten_glDeleteVertexArrays,
		/** @export */
		emscripten_glDeleteVertexArraysOES: _emscripten_glDeleteVertexArraysOES,
		/** @export */
		emscripten_glDepthFunc: _emscripten_glDepthFunc,
		/** @export */
		emscripten_glDepthMask: _emscripten_glDepthMask,
		/** @export */
		emscripten_glDepthRange: _emscripten_glDepthRange,
		/** @export */
		emscripten_glDepthRangef: _emscripten_glDepthRangef,
		/** @export */
		emscripten_glDetachShader: _emscripten_glDetachShader,
		/** @export */
		emscripten_glDisable: _emscripten_glDisable,
		/** @export */
		emscripten_glDisableVertexAttribArray:
			_emscripten_glDisableVertexAttribArray,
		/** @export */
		emscripten_glDrawArrays: _emscripten_glDrawArrays,
		/** @export */
		emscripten_glDrawArraysInstanced: _emscripten_glDrawArraysInstanced,
		/** @export */
		emscripten_glDrawArraysInstancedANGLE:
			_emscripten_glDrawArraysInstancedANGLE,
		/** @export */
		emscripten_glDrawArraysInstancedARB:
			_emscripten_glDrawArraysInstancedARB,
		/** @export */
		emscripten_glDrawArraysInstancedEXT:
			_emscripten_glDrawArraysInstancedEXT,
		/** @export */
		emscripten_glDrawArraysInstancedNV: _emscripten_glDrawArraysInstancedNV,
		/** @export */
		emscripten_glDrawBuffers: _emscripten_glDrawBuffers,
		/** @export */
		emscripten_glDrawBuffersEXT: _emscripten_glDrawBuffersEXT,
		/** @export */
		emscripten_glDrawBuffersWEBGL: _emscripten_glDrawBuffersWEBGL,
		/** @export */
		emscripten_glDrawElements: _emscripten_glDrawElements,
		/** @export */
		emscripten_glDrawElementsInstanced: _emscripten_glDrawElementsInstanced,
		/** @export */
		emscripten_glDrawElementsInstancedANGLE:
			_emscripten_glDrawElementsInstancedANGLE,
		/** @export */
		emscripten_glDrawElementsInstancedARB:
			_emscripten_glDrawElementsInstancedARB,
		/** @export */
		emscripten_glDrawElementsInstancedEXT:
			_emscripten_glDrawElementsInstancedEXT,
		/** @export */
		emscripten_glDrawElementsInstancedNV:
			_emscripten_glDrawElementsInstancedNV,
		/** @export */
		emscripten_glEnable: _emscripten_glEnable,
		/** @export */
		emscripten_glEnableVertexAttribArray:
			_emscripten_glEnableVertexAttribArray,
		/** @export */
		emscripten_glEndQueryEXT: _emscripten_glEndQueryEXT,
		/** @export */
		emscripten_glFinish: _emscripten_glFinish,
		/** @export */
		emscripten_glFlush: _emscripten_glFlush,
		/** @export */
		emscripten_glFramebufferRenderbuffer:
			_emscripten_glFramebufferRenderbuffer,
		/** @export */
		emscripten_glFramebufferTexture2D: _emscripten_glFramebufferTexture2D,
		/** @export */
		emscripten_glFrontFace: _emscripten_glFrontFace,
		/** @export */
		emscripten_glGenBuffers: _emscripten_glGenBuffers,
		/** @export */
		emscripten_glGenFramebuffers: _emscripten_glGenFramebuffers,
		/** @export */
		emscripten_glGenQueriesEXT: _emscripten_glGenQueriesEXT,
		/** @export */
		emscripten_glGenRenderbuffers: _emscripten_glGenRenderbuffers,
		/** @export */
		emscripten_glGenTextures: _emscripten_glGenTextures,
		/** @export */
		emscripten_glGenVertexArrays: _emscripten_glGenVertexArrays,
		/** @export */
		emscripten_glGenVertexArraysOES: _emscripten_glGenVertexArraysOES,
		/** @export */
		emscripten_glGenerateMipmap: _emscripten_glGenerateMipmap,
		/** @export */
		emscripten_glGetActiveAttrib: _emscripten_glGetActiveAttrib,
		/** @export */
		emscripten_glGetActiveUniform: _emscripten_glGetActiveUniform,
		/** @export */
		emscripten_glGetAttachedShaders: _emscripten_glGetAttachedShaders,
		/** @export */
		emscripten_glGetAttribLocation: _emscripten_glGetAttribLocation,
		/** @export */
		emscripten_glGetBooleanv: _emscripten_glGetBooleanv,
		/** @export */
		emscripten_glGetBufferParameteriv: _emscripten_glGetBufferParameteriv,
		/** @export */
		emscripten_glGetError: _emscripten_glGetError,
		/** @export */
		emscripten_glGetFloatv: _emscripten_glGetFloatv,
		/** @export */
		emscripten_glGetFramebufferAttachmentParameteriv:
			_emscripten_glGetFramebufferAttachmentParameteriv,
		/** @export */
		emscripten_glGetIntegerv: _emscripten_glGetIntegerv,
		/** @export */
		emscripten_glGetProgramInfoLog: _emscripten_glGetProgramInfoLog,
		/** @export */
		emscripten_glGetProgramiv: _emscripten_glGetProgramiv,
		/** @export */
		emscripten_glGetQueryObjecti64vEXT: _emscripten_glGetQueryObjecti64vEXT,
		/** @export */
		emscripten_glGetQueryObjectivEXT: _emscripten_glGetQueryObjectivEXT,
		/** @export */
		emscripten_glGetQueryObjectui64vEXT:
			_emscripten_glGetQueryObjectui64vEXT,
		/** @export */
		emscripten_glGetQueryObjectuivEXT: _emscripten_glGetQueryObjectuivEXT,
		/** @export */
		emscripten_glGetQueryivEXT: _emscripten_glGetQueryivEXT,
		/** @export */
		emscripten_glGetRenderbufferParameteriv:
			_emscripten_glGetRenderbufferParameteriv,
		/** @export */
		emscripten_glGetShaderInfoLog: _emscripten_glGetShaderInfoLog,
		/** @export */
		emscripten_glGetShaderPrecisionFormat:
			_emscripten_glGetShaderPrecisionFormat,
		/** @export */
		emscripten_glGetShaderSource: _emscripten_glGetShaderSource,
		/** @export */
		emscripten_glGetShaderiv: _emscripten_glGetShaderiv,
		/** @export */
		emscripten_glGetString: _emscripten_glGetString,
		/** @export */
		emscripten_glGetTexParameterfv: _emscripten_glGetTexParameterfv,
		/** @export */
		emscripten_glGetTexParameteriv: _emscripten_glGetTexParameteriv,
		/** @export */
		emscripten_glGetUniformLocation: _emscripten_glGetUniformLocation,
		/** @export */
		emscripten_glGetUniformfv: _emscripten_glGetUniformfv,
		/** @export */
		emscripten_glGetUniformiv: _emscripten_glGetUniformiv,
		/** @export */
		emscripten_glGetVertexAttribPointerv:
			_emscripten_glGetVertexAttribPointerv,
		/** @export */
		emscripten_glGetVertexAttribfv: _emscripten_glGetVertexAttribfv,
		/** @export */
		emscripten_glGetVertexAttribiv: _emscripten_glGetVertexAttribiv,
		/** @export */
		emscripten_glHint: _emscripten_glHint,
		/** @export */
		emscripten_glIsBuffer: _emscripten_glIsBuffer,
		/** @export */
		emscripten_glIsEnabled: _emscripten_glIsEnabled,
		/** @export */
		emscripten_glIsFramebuffer: _emscripten_glIsFramebuffer,
		/** @export */
		emscripten_glIsProgram: _emscripten_glIsProgram,
		/** @export */
		emscripten_glIsQueryEXT: _emscripten_glIsQueryEXT,
		/** @export */
		emscripten_glIsRenderbuffer: _emscripten_glIsRenderbuffer,
		/** @export */
		emscripten_glIsShader: _emscripten_glIsShader,
		/** @export */
		emscripten_glIsTexture: _emscripten_glIsTexture,
		/** @export */
		emscripten_glIsVertexArray: _emscripten_glIsVertexArray,
		/** @export */
		emscripten_glIsVertexArrayOES: _emscripten_glIsVertexArrayOES,
		/** @export */
		emscripten_glLineWidth: _emscripten_glLineWidth,
		/** @export */
		emscripten_glLinkProgram: _emscripten_glLinkProgram,
		/** @export */
		emscripten_glLoadIdentity: _emscripten_glLoadIdentity,
		/** @export */
		emscripten_glMatrixMode: _emscripten_glMatrixMode,
		/** @export */
		emscripten_glMultiDrawArrays: _emscripten_glMultiDrawArrays,
		/** @export */
		emscripten_glMultiDrawArraysANGLE: _emscripten_glMultiDrawArraysANGLE,
		/** @export */
		emscripten_glMultiDrawArraysInstancedANGLE:
			_emscripten_glMultiDrawArraysInstancedANGLE,
		/** @export */
		emscripten_glMultiDrawArraysInstancedWEBGL:
			_emscripten_glMultiDrawArraysInstancedWEBGL,
		/** @export */
		emscripten_glMultiDrawArraysWEBGL: _emscripten_glMultiDrawArraysWEBGL,
		/** @export */
		emscripten_glMultiDrawElements: _emscripten_glMultiDrawElements,
		/** @export */
		emscripten_glMultiDrawElementsANGLE:
			_emscripten_glMultiDrawElementsANGLE,
		/** @export */
		emscripten_glMultiDrawElementsInstancedANGLE:
			_emscripten_glMultiDrawElementsInstancedANGLE,
		/** @export */
		emscripten_glMultiDrawElementsInstancedWEBGL:
			_emscripten_glMultiDrawElementsInstancedWEBGL,
		/** @export */
		emscripten_glMultiDrawElementsWEBGL:
			_emscripten_glMultiDrawElementsWEBGL,
		/** @export */
		emscripten_glPixelStorei: _emscripten_glPixelStorei,
		/** @export */
		emscripten_glPolygonModeWEBGL: _emscripten_glPolygonModeWEBGL,
		/** @export */
		emscripten_glPolygonOffset: _emscripten_glPolygonOffset,
		/** @export */
		emscripten_glPolygonOffsetClampEXT: _emscripten_glPolygonOffsetClampEXT,
		/** @export */
		emscripten_glQueryCounterEXT: _emscripten_glQueryCounterEXT,
		/** @export */
		emscripten_glReadPixels: _emscripten_glReadPixels,
		/** @export */
		emscripten_glReleaseShaderCompiler: _emscripten_glReleaseShaderCompiler,
		/** @export */
		emscripten_glRenderbufferStorage: _emscripten_glRenderbufferStorage,
		/** @export */
		emscripten_glSampleCoverage: _emscripten_glSampleCoverage,
		/** @export */
		emscripten_glScissor: _emscripten_glScissor,
		/** @export */
		emscripten_glShaderBinary: _emscripten_glShaderBinary,
		/** @export */
		emscripten_glShaderSource: _emscripten_glShaderSource,
		/** @export */
		emscripten_glStencilFunc: _emscripten_glStencilFunc,
		/** @export */
		emscripten_glStencilFuncSeparate: _emscripten_glStencilFuncSeparate,
		/** @export */
		emscripten_glStencilMask: _emscripten_glStencilMask,
		/** @export */
		emscripten_glStencilMaskSeparate: _emscripten_glStencilMaskSeparate,
		/** @export */
		emscripten_glStencilOp: _emscripten_glStencilOp,
		/** @export */
		emscripten_glStencilOpSeparate: _emscripten_glStencilOpSeparate,
		/** @export */
		emscripten_glTexImage2D: _emscripten_glTexImage2D,
		/** @export */
		emscripten_glTexParameterf: _emscripten_glTexParameterf,
		/** @export */
		emscripten_glTexParameterfv: _emscripten_glTexParameterfv,
		/** @export */
		emscripten_glTexParameteri: _emscripten_glTexParameteri,
		/** @export */
		emscripten_glTexParameteriv: _emscripten_glTexParameteriv,
		/** @export */
		emscripten_glTexSubImage2D: _emscripten_glTexSubImage2D,
		/** @export */
		emscripten_glUniform1f: _emscripten_glUniform1f,
		/** @export */
		emscripten_glUniform1fv: _emscripten_glUniform1fv,
		/** @export */
		emscripten_glUniform1i: _emscripten_glUniform1i,
		/** @export */
		emscripten_glUniform1iv: _emscripten_glUniform1iv,
		/** @export */
		emscripten_glUniform2f: _emscripten_glUniform2f,
		/** @export */
		emscripten_glUniform2fv: _emscripten_glUniform2fv,
		/** @export */
		emscripten_glUniform2i: _emscripten_glUniform2i,
		/** @export */
		emscripten_glUniform2iv: _emscripten_glUniform2iv,
		/** @export */
		emscripten_glUniform3f: _emscripten_glUniform3f,
		/** @export */
		emscripten_glUniform3fv: _emscripten_glUniform3fv,
		/** @export */
		emscripten_glUniform3i: _emscripten_glUniform3i,
		/** @export */
		emscripten_glUniform3iv: _emscripten_glUniform3iv,
		/** @export */
		emscripten_glUniform4f: _emscripten_glUniform4f,
		/** @export */
		emscripten_glUniform4fv: _emscripten_glUniform4fv,
		/** @export */
		emscripten_glUniform4i: _emscripten_glUniform4i,
		/** @export */
		emscripten_glUniform4iv: _emscripten_glUniform4iv,
		/** @export */
		emscripten_glUniformMatrix2fv: _emscripten_glUniformMatrix2fv,
		/** @export */
		emscripten_glUniformMatrix3fv: _emscripten_glUniformMatrix3fv,
		/** @export */
		emscripten_glUniformMatrix4fv: _emscripten_glUniformMatrix4fv,
		/** @export */
		emscripten_glUseProgram: _emscripten_glUseProgram,
		/** @export */
		emscripten_glValidateProgram: _emscripten_glValidateProgram,
		/** @export */
		emscripten_glVertexAttrib1f: _emscripten_glVertexAttrib1f,
		/** @export */
		emscripten_glVertexAttrib1fv: _emscripten_glVertexAttrib1fv,
		/** @export */
		emscripten_glVertexAttrib2f: _emscripten_glVertexAttrib2f,
		/** @export */
		emscripten_glVertexAttrib2fv: _emscripten_glVertexAttrib2fv,
		/** @export */
		emscripten_glVertexAttrib3f: _emscripten_glVertexAttrib3f,
		/** @export */
		emscripten_glVertexAttrib3fv: _emscripten_glVertexAttrib3fv,
		/** @export */
		emscripten_glVertexAttrib4f: _emscripten_glVertexAttrib4f,
		/** @export */
		emscripten_glVertexAttrib4fv: _emscripten_glVertexAttrib4fv,
		/** @export */
		emscripten_glVertexAttribDivisor: _emscripten_glVertexAttribDivisor,
		/** @export */
		emscripten_glVertexAttribDivisorANGLE:
			_emscripten_glVertexAttribDivisorANGLE,
		/** @export */
		emscripten_glVertexAttribDivisorARB:
			_emscripten_glVertexAttribDivisorARB,
		/** @export */
		emscripten_glVertexAttribDivisorEXT:
			_emscripten_glVertexAttribDivisorEXT,
		/** @export */
		emscripten_glVertexAttribDivisorNV: _emscripten_glVertexAttribDivisorNV,
		/** @export */
		emscripten_glVertexAttribPointer: _emscripten_glVertexAttribPointer,
		/** @export */
		emscripten_glVertexPointer: _emscripten_glVertexPointer,
		/** @export */
		emscripten_glViewport: _emscripten_glViewport,
		/** @export */
		emscripten_has_asyncify: _emscripten_has_asyncify,
		/** @export */
		emscripten_hide_mouse: _emscripten_hide_mouse,
		/** @export */
		emscripten_html5_remove_all_event_listeners:
			_emscripten_html5_remove_all_event_listeners,
		/** @export */
		emscripten_idb_async_clear: _emscripten_idb_async_clear,
		/** @export */
		emscripten_idb_async_delete: _emscripten_idb_async_delete,
		/** @export */
		emscripten_idb_async_exists: _emscripten_idb_async_exists,
		/** @export */
		emscripten_idb_async_load: _emscripten_idb_async_load,
		/** @export */
		emscripten_idb_async_store: _emscripten_idb_async_store,
		/** @export */
		emscripten_idb_clear: _emscripten_idb_clear,
		/** @export */
		emscripten_idb_delete: _emscripten_idb_delete,
		/** @export */
		emscripten_idb_exists: _emscripten_idb_exists,
		/** @export */
		emscripten_idb_free_blob: _emscripten_idb_free_blob,
		/** @export */
		emscripten_idb_load: _emscripten_idb_load,
		/** @export */
		emscripten_idb_load_blob: _emscripten_idb_load_blob,
		/** @export */
		emscripten_idb_read_from_blob: _emscripten_idb_read_from_blob,
		/** @export */
		emscripten_idb_store: _emscripten_idb_store,
		/** @export */
		emscripten_idb_store_blob: _emscripten_idb_store_blob,
		/** @export */
		emscripten_is_main_browser_thread: _emscripten_is_main_browser_thread,
		/** @export */
		emscripten_is_webgl_context_lost: _emscripten_is_webgl_context_lost,
		/** @export */
		emscripten_lock_orientation: _emscripten_lock_orientation,
		/** @export */
		emscripten_math_acos: _emscripten_math_acos,
		/** @export */
		emscripten_math_acosh: _emscripten_math_acosh,
		/** @export */
		emscripten_math_asin: _emscripten_math_asin,
		/** @export */
		emscripten_math_asinh: _emscripten_math_asinh,
		/** @export */
		emscripten_math_atan: _emscripten_math_atan,
		/** @export */
		emscripten_math_atan2: _emscripten_math_atan2,
		/** @export */
		emscripten_math_atanh: _emscripten_math_atanh,
		/** @export */
		emscripten_math_cbrt: _emscripten_math_cbrt,
		/** @export */
		emscripten_math_cos: _emscripten_math_cos,
		/** @export */
		emscripten_math_cosh: _emscripten_math_cosh,
		/** @export */
		emscripten_math_exp: _emscripten_math_exp,
		/** @export */
		emscripten_math_expm1: _emscripten_math_expm1,
		/** @export */
		emscripten_math_fmod: _emscripten_math_fmod,
		/** @export */
		emscripten_math_hypot: _emscripten_math_hypot,
		/** @export */
		emscripten_math_log: _emscripten_math_log,
		/** @export */
		emscripten_math_log10: _emscripten_math_log10,
		/** @export */
		emscripten_math_log1p: _emscripten_math_log1p,
		/** @export */
		emscripten_math_log2: _emscripten_math_log2,
		/** @export */
		emscripten_math_pow: _emscripten_math_pow,
		/** @export */
		emscripten_math_random: _emscripten_math_random,
		/** @export */
		emscripten_math_round: _emscripten_math_round,
		/** @export */
		emscripten_math_sign: _emscripten_math_sign,
		/** @export */
		emscripten_math_sin: _emscripten_math_sin,
		/** @export */
		emscripten_math_sinh: _emscripten_math_sinh,
		/** @export */
		emscripten_math_sqrt: _emscripten_math_sqrt,
		/** @export */
		emscripten_math_tan: _emscripten_math_tan,
		/** @export */
		emscripten_math_tanh: _emscripten_math_tanh,
		/** @export */
		emscripten_notify_memory_growth: _emscripten_notify_memory_growth,
		/** @export */
		emscripten_out: _emscripten_out,
		/** @export */
		emscripten_outn: _emscripten_outn,
		/** @export */
		emscripten_pause_main_loop: _emscripten_pause_main_loop,
		/** @export */
		emscripten_pc_get_column: _emscripten_pc_get_column,
		/** @export */
		emscripten_pc_get_file: _emscripten_pc_get_file,
		/** @export */
		emscripten_pc_get_function: _emscripten_pc_get_function,
		/** @export */
		emscripten_pc_get_line: _emscripten_pc_get_line,
		/** @export */
		emscripten_performance_now: _emscripten_performance_now,
		/** @export */
		emscripten_print_double: _emscripten_print_double,
		/** @export */
		emscripten_promise_all: _emscripten_promise_all,
		/** @export */
		emscripten_promise_all_settled: _emscripten_promise_all_settled,
		/** @export */
		emscripten_promise_any: _emscripten_promise_any,
		/** @export */
		emscripten_promise_await: _emscripten_promise_await,
		/** @export */
		emscripten_promise_create: _emscripten_promise_create,
		/** @export */
		emscripten_promise_destroy: _emscripten_promise_destroy,
		/** @export */
		emscripten_promise_race: _emscripten_promise_race,
		/** @export */
		emscripten_promise_resolve: _emscripten_promise_resolve,
		/** @export */
		emscripten_promise_then: _emscripten_promise_then,
		/** @export */
		emscripten_random: _emscripten_random,
		/** @export */
		emscripten_request_animation_frame: _emscripten_request_animation_frame,
		/** @export */
		emscripten_request_animation_frame_loop:
			_emscripten_request_animation_frame_loop,
		/** @export */
		emscripten_request_fullscreen: _emscripten_request_fullscreen,
		/** @export */
		emscripten_request_fullscreen_strategy:
			_emscripten_request_fullscreen_strategy,
		/** @export */
		emscripten_request_pointerlock: _emscripten_request_pointerlock,
		/** @export */
		emscripten_resize_heap: _emscripten_resize_heap,
		/** @export */
		emscripten_resume_main_loop: _emscripten_resume_main_loop,
		/** @export */
		emscripten_return_address: _emscripten_return_address,
		/** @export */
		emscripten_run_preload_plugins: _emscripten_run_preload_plugins,
		/** @export */
		emscripten_run_preload_plugins_data:
			_emscripten_run_preload_plugins_data,
		/** @export */
		emscripten_run_script: _emscripten_run_script,
		/** @export */
		emscripten_run_script_int: _emscripten_run_script_int,
		/** @export */
		emscripten_run_script_string: _emscripten_run_script_string,
		/** @export */
		emscripten_runtime_keepalive_check: _emscripten_runtime_keepalive_check,
		/** @export */
		emscripten_runtime_keepalive_pop: _emscripten_runtime_keepalive_pop,
		/** @export */
		emscripten_runtime_keepalive_push: _emscripten_runtime_keepalive_push,
		/** @export */
		emscripten_sample_gamepad_data: _emscripten_sample_gamepad_data,
		/** @export */
		emscripten_scan_registers: _emscripten_scan_registers,
		/** @export */
		emscripten_set_batterychargingchange_callback_on_thread:
			_emscripten_set_batterychargingchange_callback_on_thread,
		/** @export */
		emscripten_set_batterylevelchange_callback_on_thread:
			_emscripten_set_batterylevelchange_callback_on_thread,
		/** @export */
		emscripten_set_beforeunload_callback_on_thread:
			_emscripten_set_beforeunload_callback_on_thread,
		/** @export */
		emscripten_set_blur_callback_on_thread:
			_emscripten_set_blur_callback_on_thread,
		/** @export */
		emscripten_set_canvas_element_size: _emscripten_set_canvas_element_size,
		/** @export */
		emscripten_set_canvas_size: _emscripten_set_canvas_size,
		/** @export */
		emscripten_set_click_callback_on_thread:
			_emscripten_set_click_callback_on_thread,
		/** @export */
		emscripten_set_dblclick_callback_on_thread:
			_emscripten_set_dblclick_callback_on_thread,
		/** @export */
		emscripten_set_devicemotion_callback_on_thread:
			_emscripten_set_devicemotion_callback_on_thread,
		/** @export */
		emscripten_set_deviceorientation_callback_on_thread:
			_emscripten_set_deviceorientation_callback_on_thread,
		/** @export */
		emscripten_set_element_css_size: _emscripten_set_element_css_size,
		/** @export */
		emscripten_set_focus_callback_on_thread:
			_emscripten_set_focus_callback_on_thread,
		/** @export */
		emscripten_set_focusin_callback_on_thread:
			_emscripten_set_focusin_callback_on_thread,
		/** @export */
		emscripten_set_focusout_callback_on_thread:
			_emscripten_set_focusout_callback_on_thread,
		/** @export */
		emscripten_set_fullscreenchange_callback_on_thread:
			_emscripten_set_fullscreenchange_callback_on_thread,
		/** @export */
		emscripten_set_gamepadconnected_callback_on_thread:
			_emscripten_set_gamepadconnected_callback_on_thread,
		/** @export */
		emscripten_set_gamepaddisconnected_callback_on_thread:
			_emscripten_set_gamepaddisconnected_callback_on_thread,
		/** @export */
		emscripten_set_immediate: _emscripten_set_immediate,
		/** @export */
		emscripten_set_immediate_loop: _emscripten_set_immediate_loop,
		/** @export */
		emscripten_set_interval: _emscripten_set_interval,
		/** @export */
		emscripten_set_keydown_callback_on_thread:
			_emscripten_set_keydown_callback_on_thread,
		/** @export */
		emscripten_set_keypress_callback_on_thread:
			_emscripten_set_keypress_callback_on_thread,
		/** @export */
		emscripten_set_keyup_callback_on_thread:
			_emscripten_set_keyup_callback_on_thread,
		/** @export */
		emscripten_set_main_loop: _emscripten_set_main_loop,
		/** @export */
		emscripten_set_main_loop_arg: _emscripten_set_main_loop_arg,
		/** @export */
		emscripten_set_main_loop_expected_blockers:
			_emscripten_set_main_loop_expected_blockers,
		/** @export */
		emscripten_set_main_loop_timing: _emscripten_set_main_loop_timing,
		/** @export */
		emscripten_set_mousedown_callback_on_thread:
			_emscripten_set_mousedown_callback_on_thread,
		/** @export */
		emscripten_set_mouseenter_callback_on_thread:
			_emscripten_set_mouseenter_callback_on_thread,
		/** @export */
		emscripten_set_mouseleave_callback_on_thread:
			_emscripten_set_mouseleave_callback_on_thread,
		/** @export */
		emscripten_set_mousemove_callback_on_thread:
			_emscripten_set_mousemove_callback_on_thread,
		/** @export */
		emscripten_set_mouseout_callback_on_thread:
			_emscripten_set_mouseout_callback_on_thread,
		/** @export */
		emscripten_set_mouseover_callback_on_thread:
			_emscripten_set_mouseover_callback_on_thread,
		/** @export */
		emscripten_set_mouseup_callback_on_thread:
			_emscripten_set_mouseup_callback_on_thread,
		/** @export */
		emscripten_set_orientationchange_callback_on_thread:
			_emscripten_set_orientationchange_callback_on_thread,
		/** @export */
		emscripten_set_pointerlockchange_callback_on_thread:
			_emscripten_set_pointerlockchange_callback_on_thread,
		/** @export */
		emscripten_set_pointerlockerror_callback_on_thread:
			_emscripten_set_pointerlockerror_callback_on_thread,
		/** @export */
		emscripten_set_resize_callback_on_thread:
			_emscripten_set_resize_callback_on_thread,
		/** @export */
		emscripten_set_scroll_callback_on_thread:
			_emscripten_set_scroll_callback_on_thread,
		/** @export */
		emscripten_set_socket_close_callback:
			_emscripten_set_socket_close_callback,
		/** @export */
		emscripten_set_socket_connection_callback:
			_emscripten_set_socket_connection_callback,
		/** @export */
		emscripten_set_socket_error_callback:
			_emscripten_set_socket_error_callback,
		/** @export */
		emscripten_set_socket_listen_callback:
			_emscripten_set_socket_listen_callback,
		/** @export */
		emscripten_set_socket_message_callback:
			_emscripten_set_socket_message_callback,
		/** @export */
		emscripten_set_socket_open_callback:
			_emscripten_set_socket_open_callback,
		/** @export */
		emscripten_set_timeout: _emscripten_set_timeout,
		/** @export */
		emscripten_set_timeout_loop: _emscripten_set_timeout_loop,
		/** @export */
		emscripten_set_touchcancel_callback_on_thread:
			_emscripten_set_touchcancel_callback_on_thread,
		/** @export */
		emscripten_set_touchend_callback_on_thread:
			_emscripten_set_touchend_callback_on_thread,
		/** @export */
		emscripten_set_touchmove_callback_on_thread:
			_emscripten_set_touchmove_callback_on_thread,
		/** @export */
		emscripten_set_touchstart_callback_on_thread:
			_emscripten_set_touchstart_callback_on_thread,
		/** @export */
		emscripten_set_visibilitychange_callback_on_thread:
			_emscripten_set_visibilitychange_callback_on_thread,
		/** @export */
		emscripten_set_webglcontextlost_callback_on_thread:
			_emscripten_set_webglcontextlost_callback_on_thread,
		/** @export */
		emscripten_set_webglcontextrestored_callback_on_thread:
			_emscripten_set_webglcontextrestored_callback_on_thread,
		/** @export */
		emscripten_set_wheel_callback_on_thread:
			_emscripten_set_wheel_callback_on_thread,
		/** @export */
		emscripten_set_window_title: _emscripten_set_window_title,
		/** @export */
		emscripten_sleep: _emscripten_sleep,
		/** @export */
		emscripten_stack_snapshot: _emscripten_stack_snapshot,
		/** @export */
		emscripten_stack_unwind_buffer: _emscripten_stack_unwind_buffer,
		/** @export */
		emscripten_supports_offscreencanvas:
			_emscripten_supports_offscreencanvas,
		/** @export */
		emscripten_throw_number: _emscripten_throw_number,
		/** @export */
		emscripten_throw_string: _emscripten_throw_string,
		/** @export */
		emscripten_unlock_orientation: _emscripten_unlock_orientation,
		/** @export */
		emscripten_unwind_to_js_event_loop: _emscripten_unwind_to_js_event_loop,
		/** @export */
		emscripten_vibrate: _emscripten_vibrate,
		/** @export */
		emscripten_vibrate_pattern: _emscripten_vibrate_pattern,
		/** @export */
		emscripten_webgl_commit_frame: _emscripten_webgl_commit_frame,
		/** @export */
		emscripten_webgl_create_context: _emscripten_webgl_create_context,
		/** @export */
		emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
		/** @export */
		emscripten_webgl_do_commit_frame: _emscripten_webgl_do_commit_frame,
		/** @export */
		emscripten_webgl_do_create_context: _emscripten_webgl_do_create_context,
		/** @export */
		emscripten_webgl_do_get_current_context:
			_emscripten_webgl_do_get_current_context,
		/** @export */
		emscripten_webgl_enable_ANGLE_instanced_arrays:
			_emscripten_webgl_enable_ANGLE_instanced_arrays,
		/** @export */
		emscripten_webgl_enable_EXT_clip_control:
			_emscripten_webgl_enable_EXT_clip_control,
		/** @export */
		emscripten_webgl_enable_EXT_polygon_offset_clamp:
			_emscripten_webgl_enable_EXT_polygon_offset_clamp,
		/** @export */
		emscripten_webgl_enable_OES_vertex_array_object:
			_emscripten_webgl_enable_OES_vertex_array_object,
		/** @export */
		emscripten_webgl_enable_WEBGL_draw_buffers:
			_emscripten_webgl_enable_WEBGL_draw_buffers,
		/** @export */
		emscripten_webgl_enable_WEBGL_multi_draw:
			_emscripten_webgl_enable_WEBGL_multi_draw,
		/** @export */
		emscripten_webgl_enable_WEBGL_polygon_mode:
			_emscripten_webgl_enable_WEBGL_polygon_mode,
		/** @export */
		emscripten_webgl_enable_extension: _emscripten_webgl_enable_extension,
		/** @export */
		emscripten_webgl_get_context_attributes:
			_emscripten_webgl_get_context_attributes,
		/** @export */
		emscripten_webgl_get_current_context:
			_emscripten_webgl_get_current_context,
		/** @export */
		emscripten_webgl_get_drawing_buffer_size:
			_emscripten_webgl_get_drawing_buffer_size,
		/** @export */
		emscripten_webgl_get_parameter_d: _emscripten_webgl_get_parameter_d,
		/** @export */
		emscripten_webgl_get_parameter_i64v:
			_emscripten_webgl_get_parameter_i64v,
		/** @export */
		emscripten_webgl_get_parameter_o: _emscripten_webgl_get_parameter_o,
		/** @export */
		emscripten_webgl_get_parameter_utf8:
			_emscripten_webgl_get_parameter_utf8,
		/** @export */
		emscripten_webgl_get_parameter_v: _emscripten_webgl_get_parameter_v,
		/** @export */
		emscripten_webgl_get_program_info_log_utf8:
			_emscripten_webgl_get_program_info_log_utf8,
		/** @export */
		emscripten_webgl_get_program_parameter_d:
			_emscripten_webgl_get_program_parameter_d,
		/** @export */
		emscripten_webgl_get_shader_info_log_utf8:
			_emscripten_webgl_get_shader_info_log_utf8,
		/** @export */
		emscripten_webgl_get_shader_parameter_d:
			_emscripten_webgl_get_shader_parameter_d,
		/** @export */
		emscripten_webgl_get_shader_source_utf8:
			_emscripten_webgl_get_shader_source_utf8,
		/** @export */
		emscripten_webgl_get_supported_extensions:
			_emscripten_webgl_get_supported_extensions,
		/** @export */
		emscripten_webgl_get_uniform_d: _emscripten_webgl_get_uniform_d,
		/** @export */
		emscripten_webgl_get_uniform_v: _emscripten_webgl_get_uniform_v,
		/** @export */
		emscripten_webgl_get_vertex_attrib_d:
			_emscripten_webgl_get_vertex_attrib_d,
		/** @export */
		emscripten_webgl_get_vertex_attrib_o:
			_emscripten_webgl_get_vertex_attrib_o,
		/** @export */
		emscripten_webgl_get_vertex_attrib_v:
			_emscripten_webgl_get_vertex_attrib_v,
		/** @export */
		emscripten_webgl_make_context_current:
			_emscripten_webgl_make_context_current,
		/** @export */
		emscripten_websocket_close: _emscripten_websocket_close,
		/** @export */
		emscripten_websocket_deinitialize: _emscripten_websocket_deinitialize,
		/** @export */
		emscripten_websocket_delete: _emscripten_websocket_delete,
		/** @export */
		emscripten_websocket_get_buffered_amount:
			_emscripten_websocket_get_buffered_amount,
		/** @export */
		emscripten_websocket_get_extensions:
			_emscripten_websocket_get_extensions,
		/** @export */
		emscripten_websocket_get_extensions_length:
			_emscripten_websocket_get_extensions_length,
		/** @export */
		emscripten_websocket_get_protocol: _emscripten_websocket_get_protocol,
		/** @export */
		emscripten_websocket_get_protocol_length:
			_emscripten_websocket_get_protocol_length,
		/** @export */
		emscripten_websocket_get_ready_state:
			_emscripten_websocket_get_ready_state,
		/** @export */
		emscripten_websocket_get_url: _emscripten_websocket_get_url,
		/** @export */
		emscripten_websocket_get_url_length:
			_emscripten_websocket_get_url_length,
		/** @export */
		emscripten_websocket_is_supported: _emscripten_websocket_is_supported,
		/** @export */
		emscripten_websocket_new: _emscripten_websocket_new,
		/** @export */
		emscripten_websocket_send_binary: _emscripten_websocket_send_binary,
		/** @export */
		emscripten_websocket_send_utf8_text:
			_emscripten_websocket_send_utf8_text,
		/** @export */
		emscripten_websocket_set_onclose_callback_on_thread:
			_emscripten_websocket_set_onclose_callback_on_thread,
		/** @export */
		emscripten_websocket_set_onerror_callback_on_thread:
			_emscripten_websocket_set_onerror_callback_on_thread,
		/** @export */
		emscripten_websocket_set_onmessage_callback_on_thread:
			_emscripten_websocket_set_onmessage_callback_on_thread,
		/** @export */
		emscripten_websocket_set_onopen_callback_on_thread:
			_emscripten_websocket_set_onopen_callback_on_thread,
		/** @export */
		emscripten_wget_data: _emscripten_wget_data,
		/** @export */
		endprotoent: _endprotoent,
		/** @export */
		environ_get: _environ_get,
		/** @export */
		environ_sizes_get: _environ_sizes_get,
		/** @export */
		exit: _exit,
		/** @export */
		fd_close: _fd_close,
		/** @export */
		fd_fdstat_get: _fd_fdstat_get,
		/** @export */
		fd_pread: _fd_pread,
		/** @export */
		fd_pwrite: _fd_pwrite,
		/** @export */
		fd_read: _fd_read,
		/** @export */
		fd_seek: _fd_seek,
		/** @export */
		fd_sync: _fd_sync,
		/** @export */
		fd_write: _fd_write,
		/** @export */
		filledEllipseColor: _filledEllipseColor,
		/** @export */
		filledEllipseRGBA: _filledEllipseRGBA,
		/** @export */
		getaddrinfo: _getaddrinfo,
		/** @export */
		getcontext: _getcontext,
		/** @export */
		getdtablesize: _getdtablesize,
		/** @export */
		getnameinfo: _getnameinfo,
		/** @export */
		getprotobyname: _getprotobyname,
		/** @export */
		getprotobynumber: _getprotobynumber,
		/** @export */
		getprotoent: _getprotoent,
		/** @export */
		glActiveTexture: _glActiveTexture,
		/** @export */
		glAttachShader: _glAttachShader,
		/** @export */
		glBegin: _glBegin,
		/** @export */
		glBeginQueryEXT: _glBeginQueryEXT,
		/** @export */
		glBindAttribLocation: _glBindAttribLocation,
		/** @export */
		glBindBuffer: _glBindBuffer,
		/** @export */
		glBindFramebuffer: _glBindFramebuffer,
		/** @export */
		glBindRenderbuffer: _glBindRenderbuffer,
		/** @export */
		glBindTexture: _glBindTexture,
		/** @export */
		glBindVertexArray: _glBindVertexArray,
		/** @export */
		glBindVertexArrayOES: _glBindVertexArrayOES,
		/** @export */
		glBlendColor: _glBlendColor,
		/** @export */
		glBlendEquation: _glBlendEquation,
		/** @export */
		glBlendEquationSeparate: _glBlendEquationSeparate,
		/** @export */
		glBlendFunc: _glBlendFunc,
		/** @export */
		glBlendFuncSeparate: _glBlendFuncSeparate,
		/** @export */
		glBufferData: _glBufferData,
		/** @export */
		glBufferSubData: _glBufferSubData,
		/** @export */
		glCheckFramebufferStatus: _glCheckFramebufferStatus,
		/** @export */
		glClear: _glClear,
		/** @export */
		glClearColor: _glClearColor,
		/** @export */
		glClearDepth: _glClearDepth,
		/** @export */
		glClearDepthf: _glClearDepthf,
		/** @export */
		glClearStencil: _glClearStencil,
		/** @export */
		glClipControlEXT: _glClipControlEXT,
		/** @export */
		glColorMask: _glColorMask,
		/** @export */
		glCompileShader: _glCompileShader,
		/** @export */
		glCompressedTexImage2D: _glCompressedTexImage2D,
		/** @export */
		glCompressedTexSubImage2D: _glCompressedTexSubImage2D,
		/** @export */
		glCopyTexImage2D: _glCopyTexImage2D,
		/** @export */
		glCopyTexSubImage2D: _glCopyTexSubImage2D,
		/** @export */
		glCreateProgram: _glCreateProgram,
		/** @export */
		glCreateShader: _glCreateShader,
		/** @export */
		glCullFace: _glCullFace,
		/** @export */
		glDeleteBuffers: _glDeleteBuffers,
		/** @export */
		glDeleteFramebuffers: _glDeleteFramebuffers,
		/** @export */
		glDeleteProgram: _glDeleteProgram,
		/** @export */
		glDeleteQueriesEXT: _glDeleteQueriesEXT,
		/** @export */
		glDeleteRenderbuffers: _glDeleteRenderbuffers,
		/** @export */
		glDeleteShader: _glDeleteShader,
		/** @export */
		glDeleteTextures: _glDeleteTextures,
		/** @export */
		glDeleteVertexArrays: _glDeleteVertexArrays,
		/** @export */
		glDeleteVertexArraysOES: _glDeleteVertexArraysOES,
		/** @export */
		glDepthFunc: _glDepthFunc,
		/** @export */
		glDepthMask: _glDepthMask,
		/** @export */
		glDepthRange: _glDepthRange,
		/** @export */
		glDepthRangef: _glDepthRangef,
		/** @export */
		glDetachShader: _glDetachShader,
		/** @export */
		glDisable: _glDisable,
		/** @export */
		glDisableVertexAttribArray: _glDisableVertexAttribArray,
		/** @export */
		glDrawArrays: _glDrawArrays,
		/** @export */
		glDrawArraysInstanced: _glDrawArraysInstanced,
		/** @export */
		glDrawArraysInstancedANGLE: _glDrawArraysInstancedANGLE,
		/** @export */
		glDrawArraysInstancedARB: _glDrawArraysInstancedARB,
		/** @export */
		glDrawArraysInstancedEXT: _glDrawArraysInstancedEXT,
		/** @export */
		glDrawArraysInstancedNV: _glDrawArraysInstancedNV,
		/** @export */
		glDrawBuffers: _glDrawBuffers,
		/** @export */
		glDrawBuffersEXT: _glDrawBuffersEXT,
		/** @export */
		glDrawBuffersWEBGL: _glDrawBuffersWEBGL,
		/** @export */
		glDrawElements: _glDrawElements,
		/** @export */
		glDrawElementsInstanced: _glDrawElementsInstanced,
		/** @export */
		glDrawElementsInstancedANGLE: _glDrawElementsInstancedANGLE,
		/** @export */
		glDrawElementsInstancedARB: _glDrawElementsInstancedARB,
		/** @export */
		glDrawElementsInstancedEXT: _glDrawElementsInstancedEXT,
		/** @export */
		glDrawElementsInstancedNV: _glDrawElementsInstancedNV,
		/** @export */
		glEnable: _glEnable,
		/** @export */
		glEnableVertexAttribArray: _glEnableVertexAttribArray,
		/** @export */
		glEndQueryEXT: _glEndQueryEXT,
		/** @export */
		glFinish: _glFinish,
		/** @export */
		glFlush: _glFlush,
		/** @export */
		glFramebufferRenderbuffer: _glFramebufferRenderbuffer,
		/** @export */
		glFramebufferTexture2D: _glFramebufferTexture2D,
		/** @export */
		glFrontFace: _glFrontFace,
		/** @export */
		glGenBuffers: _glGenBuffers,
		/** @export */
		glGenFramebuffers: _glGenFramebuffers,
		/** @export */
		glGenQueriesEXT: _glGenQueriesEXT,
		/** @export */
		glGenRenderbuffers: _glGenRenderbuffers,
		/** @export */
		glGenTextures: _glGenTextures,
		/** @export */
		glGenVertexArrays: _glGenVertexArrays,
		/** @export */
		glGenVertexArraysOES: _glGenVertexArraysOES,
		/** @export */
		glGenerateMipmap: _glGenerateMipmap,
		/** @export */
		glGetActiveAttrib: _glGetActiveAttrib,
		/** @export */
		glGetActiveUniform: _glGetActiveUniform,
		/** @export */
		glGetAttachedShaders: _glGetAttachedShaders,
		/** @export */
		glGetAttribLocation: _glGetAttribLocation,
		/** @export */
		glGetBooleanv: _glGetBooleanv,
		/** @export */
		glGetBufferParameteriv: _glGetBufferParameteriv,
		/** @export */
		glGetError: _glGetError,
		/** @export */
		glGetFloatv: _glGetFloatv,
		/** @export */
		glGetFramebufferAttachmentParameteriv:
			_glGetFramebufferAttachmentParameteriv,
		/** @export */
		glGetIntegerv: _glGetIntegerv,
		/** @export */
		glGetProgramInfoLog: _glGetProgramInfoLog,
		/** @export */
		glGetProgramiv: _glGetProgramiv,
		/** @export */
		glGetQueryObjecti64vEXT: _glGetQueryObjecti64vEXT,
		/** @export */
		glGetQueryObjectivEXT: _glGetQueryObjectivEXT,
		/** @export */
		glGetQueryObjectui64vEXT: _glGetQueryObjectui64vEXT,
		/** @export */
		glGetQueryObjectuivEXT: _glGetQueryObjectuivEXT,
		/** @export */
		glGetQueryivEXT: _glGetQueryivEXT,
		/** @export */
		glGetRenderbufferParameteriv: _glGetRenderbufferParameteriv,
		/** @export */
		glGetShaderInfoLog: _glGetShaderInfoLog,
		/** @export */
		glGetShaderPrecisionFormat: _glGetShaderPrecisionFormat,
		/** @export */
		glGetShaderSource: _glGetShaderSource,
		/** @export */
		glGetShaderiv: _glGetShaderiv,
		/** @export */
		glGetString: _glGetString,
		/** @export */
		glGetTexParameterfv: _glGetTexParameterfv,
		/** @export */
		glGetTexParameteriv: _glGetTexParameteriv,
		/** @export */
		glGetUniformLocation: _glGetUniformLocation,
		/** @export */
		glGetUniformfv: _glGetUniformfv,
		/** @export */
		glGetUniformiv: _glGetUniformiv,
		/** @export */
		glGetVertexAttribPointerv: _glGetVertexAttribPointerv,
		/** @export */
		glGetVertexAttribfv: _glGetVertexAttribfv,
		/** @export */
		glGetVertexAttribiv: _glGetVertexAttribiv,
		/** @export */
		glHint: _glHint,
		/** @export */
		glIsBuffer: _glIsBuffer,
		/** @export */
		glIsEnabled: _glIsEnabled,
		/** @export */
		glIsFramebuffer: _glIsFramebuffer,
		/** @export */
		glIsProgram: _glIsProgram,
		/** @export */
		glIsQueryEXT: _glIsQueryEXT,
		/** @export */
		glIsRenderbuffer: _glIsRenderbuffer,
		/** @export */
		glIsShader: _glIsShader,
		/** @export */
		glIsTexture: _glIsTexture,
		/** @export */
		glIsVertexArray: _glIsVertexArray,
		/** @export */
		glIsVertexArrayOES: _glIsVertexArrayOES,
		/** @export */
		glLineWidth: _glLineWidth,
		/** @export */
		glLinkProgram: _glLinkProgram,
		/** @export */
		glLoadIdentity: _glLoadIdentity,
		/** @export */
		glMatrixMode: _glMatrixMode,
		/** @export */
		glMultiDrawArrays: _glMultiDrawArrays,
		/** @export */
		glMultiDrawArraysANGLE: _glMultiDrawArraysANGLE,
		/** @export */
		glMultiDrawArraysInstancedANGLE: _glMultiDrawArraysInstancedANGLE,
		/** @export */
		glMultiDrawArraysInstancedWEBGL: _glMultiDrawArraysInstancedWEBGL,
		/** @export */
		glMultiDrawArraysWEBGL: _glMultiDrawArraysWEBGL,
		/** @export */
		glMultiDrawElements: _glMultiDrawElements,
		/** @export */
		glMultiDrawElementsANGLE: _glMultiDrawElementsANGLE,
		/** @export */
		glMultiDrawElementsInstancedANGLE: _glMultiDrawElementsInstancedANGLE,
		/** @export */
		glMultiDrawElementsInstancedWEBGL: _glMultiDrawElementsInstancedWEBGL,
		/** @export */
		glMultiDrawElementsWEBGL: _glMultiDrawElementsWEBGL,
		/** @export */
		glPixelStorei: _glPixelStorei,
		/** @export */
		glPolygonModeWEBGL: _glPolygonModeWEBGL,
		/** @export */
		glPolygonOffset: _glPolygonOffset,
		/** @export */
		glPolygonOffsetClampEXT: _glPolygonOffsetClampEXT,
		/** @export */
		glQueryCounterEXT: _glQueryCounterEXT,
		/** @export */
		glReadPixels: _glReadPixels,
		/** @export */
		glReleaseShaderCompiler: _glReleaseShaderCompiler,
		/** @export */
		glRenderbufferStorage: _glRenderbufferStorage,
		/** @export */
		glSampleCoverage: _glSampleCoverage,
		/** @export */
		glScissor: _glScissor,
		/** @export */
		glShaderBinary: _glShaderBinary,
		/** @export */
		glShaderSource: _glShaderSource,
		/** @export */
		glStencilFunc: _glStencilFunc,
		/** @export */
		glStencilFuncSeparate: _glStencilFuncSeparate,
		/** @export */
		glStencilMask: _glStencilMask,
		/** @export */
		glStencilMaskSeparate: _glStencilMaskSeparate,
		/** @export */
		glStencilOp: _glStencilOp,
		/** @export */
		glStencilOpSeparate: _glStencilOpSeparate,
		/** @export */
		glTexImage2D: _glTexImage2D,
		/** @export */
		glTexParameterf: _glTexParameterf,
		/** @export */
		glTexParameterfv: _glTexParameterfv,
		/** @export */
		glTexParameteri: _glTexParameteri,
		/** @export */
		glTexParameteriv: _glTexParameteriv,
		/** @export */
		glTexSubImage2D: _glTexSubImage2D,
		/** @export */
		glUniform1f: _glUniform1f,
		/** @export */
		glUniform1fv: _glUniform1fv,
		/** @export */
		glUniform1i: _glUniform1i,
		/** @export */
		glUniform1iv: _glUniform1iv,
		/** @export */
		glUniform2f: _glUniform2f,
		/** @export */
		glUniform2fv: _glUniform2fv,
		/** @export */
		glUniform2i: _glUniform2i,
		/** @export */
		glUniform2iv: _glUniform2iv,
		/** @export */
		glUniform3f: _glUniform3f,
		/** @export */
		glUniform3fv: _glUniform3fv,
		/** @export */
		glUniform3i: _glUniform3i,
		/** @export */
		glUniform3iv: _glUniform3iv,
		/** @export */
		glUniform4f: _glUniform4f,
		/** @export */
		glUniform4fv: _glUniform4fv,
		/** @export */
		glUniform4i: _glUniform4i,
		/** @export */
		glUniform4iv: _glUniform4iv,
		/** @export */
		glUniformMatrix2fv: _glUniformMatrix2fv,
		/** @export */
		glUniformMatrix3fv: _glUniformMatrix3fv,
		/** @export */
		glUniformMatrix4fv: _glUniformMatrix4fv,
		/** @export */
		glUseProgram: _glUseProgram,
		/** @export */
		glValidateProgram: _glValidateProgram,
		/** @export */
		glVertexAttrib1f: _glVertexAttrib1f,
		/** @export */
		glVertexAttrib1fv: _glVertexAttrib1fv,
		/** @export */
		glVertexAttrib2f: _glVertexAttrib2f,
		/** @export */
		glVertexAttrib2fv: _glVertexAttrib2fv,
		/** @export */
		glVertexAttrib3f: _glVertexAttrib3f,
		/** @export */
		glVertexAttrib3fv: _glVertexAttrib3fv,
		/** @export */
		glVertexAttrib4f: _glVertexAttrib4f,
		/** @export */
		glVertexAttrib4fv: _glVertexAttrib4fv,
		/** @export */
		glVertexAttribDivisor: _glVertexAttribDivisor,
		/** @export */
		glVertexAttribDivisorANGLE: _glVertexAttribDivisorANGLE,
		/** @export */
		glVertexAttribDivisorARB: _glVertexAttribDivisorARB,
		/** @export */
		glVertexAttribDivisorEXT: _glVertexAttribDivisorEXT,
		/** @export */
		glVertexAttribDivisorNV: _glVertexAttribDivisorNV,
		/** @export */
		glVertexAttribPointer: _glVertexAttribPointer,
		/** @export */
		glVertexPointer: _glVertexPointer,
		/** @export */
		glViewport: _glViewport,
		/** @export */
		glewGetErrorString: _glewGetErrorString,
		/** @export */
		glewGetExtension: _glewGetExtension,
		/** @export */
		glewGetString: _glewGetString,
		/** @export */
		glewInit: _glewInit,
		/** @export */
		glewIsSupported: _glewIsSupported,
		/** @export */
		glutCreateWindow: _glutCreateWindow,
		/** @export */
		glutDestroyWindow: _glutDestroyWindow,
		/** @export */
		glutDisplayFunc: _glutDisplayFunc,
		/** @export */
		glutFullScreen: _glutFullScreen,
		/** @export */
		glutGet: _glutGet,
		/** @export */
		glutGetModifiers: _glutGetModifiers,
		/** @export */
		glutIdleFunc: _glutIdleFunc,
		/** @export */
		glutInit: _glutInit,
		/** @export */
		glutInitDisplayMode: _glutInitDisplayMode,
		/** @export */
		glutInitWindowPosition: _glutInitWindowPosition,
		/** @export */
		glutInitWindowSize: _glutInitWindowSize,
		/** @export */
		glutKeyboardFunc: _glutKeyboardFunc,
		/** @export */
		glutKeyboardUpFunc: _glutKeyboardUpFunc,
		/** @export */
		glutMainLoop: _glutMainLoop,
		/** @export */
		glutMotionFunc: _glutMotionFunc,
		/** @export */
		glutMouseFunc: _glutMouseFunc,
		/** @export */
		glutPassiveMotionFunc: _glutPassiveMotionFunc,
		/** @export */
		glutPositionWindow: _glutPositionWindow,
		/** @export */
		glutPostRedisplay: _glutPostRedisplay,
		/** @export */
		glutReshapeFunc: _glutReshapeFunc,
		/** @export */
		glutReshapeWindow: _glutReshapeWindow,
		/** @export */
		glutSetCursor: _glutSetCursor,
		/** @export */
		glutSpecialFunc: _glutSpecialFunc,
		/** @export */
		glutSpecialUpFunc: _glutSpecialUpFunc,
		/** @export */
		glutSwapBuffers: _glutSwapBuffers,
		/** @export */
		glutTimerFunc: _glutTimerFunc,
		/** @export */
		js_fd_read,
		/** @export */
		js_flock: _js_flock,
		/** @export */
		js_getpid: _js_getpid,
		/** @export */
		js_open_process: _js_open_process,
		/** @export */
		js_process_status: _js_process_status,
		/** @export */
		js_release_file_locks: _js_release_file_locks,
		/** @export */
		js_waitpid: _js_waitpid,
		/** @export */
		js_wasm_trace: _js_wasm_trace,
		/** @export */
		lineColor: _lineColor,
		/** @export */
		lineRGBA: _lineRGBA,
		/** @export */
		makecontext: _makecontext,
		/** @export */
		pixelRGBA: _pixelRGBA,
		/** @export */
		proc_exit: _proc_exit,
		/** @export */
		random_get: _random_get,
		/** @export */
		rectangleColor: _rectangleColor,
		/** @export */
		rectangleRGBA: _rectangleRGBA,
		/** @export */
		rotozoomSurface: _rotozoomSurface,
		/** @export */
		setNetworkCallback: _setNetworkCallback,
		/** @export */
		setprotoent: _setprotoent,
		/** @export */
		stackAlloc: _stackAlloc,
		/** @export */
		stackRestore: _stackRestore,
		/** @export */
		stackSave: _stackSave,
		/** @export */
		strptime: _strptime,
		/** @export */
		strptime_l: _strptime_l,
		/** @export */
		swapcontext: _swapcontext,
		/** @export */
		uuid_clear: _uuid_clear,
		/** @export */
		uuid_compare: _uuid_compare,
		/** @export */
		uuid_copy: _uuid_copy,
		/** @export */
		uuid_generate: _uuid_generate,
		/** @export */
		uuid_is_null: _uuid_is_null,
		/** @export */
		uuid_parse: _uuid_parse,
		/** @export */
		uuid_type: _uuid_type,
		/** @export */
		uuid_unparse: _uuid_unparse,
		/** @export */
		uuid_unparse_lower: _uuid_unparse_lower,
		/** @export */
		uuid_unparse_upper: _uuid_unparse_upper,
		/** @export */
		uuid_variant: _uuid_variant,
		/** @export */
		wasm_close: _wasm_close,
		/** @export */
		wasm_recv: _wasm_recv,
		/** @export */
		wasm_setsockopt: _wasm_setsockopt,
		/** @export */
		wasm_shutdown: _wasm_shutdown,
		/** @export */
		zoomSurface: _zoomSurface,
	};

	// include: postamble.js
	// === Auto-generated postamble setup entry stuff ===

	async function callMain(args = []) {
		var entryFunction = resolveGlobalSymbol('main').sym;

		// Main modules can't tell if they have main() at compile time, since it may
		// arrive from a dynamic library.
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

			// The current spec of JSPI returns a promise only if the function suspends
			// and a plain value otherwise. This will likely change:
			// https://github.com/WebAssembly/js-promise-integration/issues/11
			ret = await ret;
			// if we're not running an evented main loop, it's time to exit
			exitJS(ret, /* implicit = */ true);
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

		// a preRun added a dependency, run will be called later
		if (runDependencies > 0) {
			dependenciesFulfilled = run;
			return;
		}

		async function doRun() {
			// run may have just been called through dependencies being fulfilled just in this very frame,
			// or while the async setStatus time below was happening
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

	// With async instantation wasmExports is assigned asynchronously when the
	// instance is received.
	createWasm();

	run();

	// end include: postamble.js

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
