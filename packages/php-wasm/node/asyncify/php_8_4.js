// Emscripten generates code for Node.js that uses the `require` function.
// We need to explicitly create a require function to avoid errors when running
// this code in Node.js as an ES module.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Note: The path module is currently needed by code injected by the php-wasm Dockerfile.
import path from 'path';

const dependencyFilename = path.join(__dirname, '8_4_0', 'php_8_4.wasm');
export { dependencyFilename };
export const dependenciesTotalSize = 21815449;
export function init(RuntimeName, PHPLoader) {
	// The rest of the code comes from the built php.js file and esm-suffix.js
	// include: shell.js
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

	var ENVIRONMENT_IS_WORKER = RuntimeName === 'WORKER';

	var ENVIRONMENT_IS_NODE = RuntimeName === 'NODE';

	if (ENVIRONMENT_IS_NODE) {
	}

	// --pre-jses are emitted after the Module integration code, so that they can
	// refer to Module (if they choose; they can also define Module)
	// Sometimes an existing Module object exists with properties
	// meant to overwrite the default module functionality. Here
	// we collect those properties and reapply _after_ we configure
	// the current environment's defaults to avoid having to be so
	// defensive during initialization.
	var moduleOverrides = {
		...Module,
	};

	var arguments_ = [];

	var thisProgram = './this.program';

	var quit_ = (status, toThrow) => {
		throw toThrow;
	};

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
		var nodePath = require('path');
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
		if (!Module['thisProgram'] && process.argv.length > 1) {
			thisProgram = process.argv[1].replace(/\\/g, '/');
		}
		arguments_ = process.argv.slice(2);
		if (typeof module != 'undefined') {
			module['exports'] = Module;
		}
		quit_ = (status, toThrow) => {
			process.exitCode = status;
			throw toThrow;
		};
	} // Note that this includes Node.js workers when relevant (pthreads is enabled).
	// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
	// ENVIRONMENT_IS_NODE.
	else {
	}

	var out = Module['print'] || console.log.bind(console);

	var err = Module['printErr'] || console.error.bind(console);

	// Merge back in the overrides
	Object.assign(Module, moduleOverrides);

	// Free the object hierarchy contained in the overrides, this lets the GC
	// reclaim data used.
	moduleOverrides = null;

	// Emit code to handle expected values on the Module object. This applies Module.x
	// to the proper local x. This has two benefits: first, we only emit it if it is
	// expected to arrive, and second, by using a local everywhere else that can be
	// minified.
	if (Module['arguments']) arguments_ = Module['arguments'];

	if (Module['thisProgram']) thisProgram = Module['thisProgram'];
	if (Module['quit']) quit_ = Module['quit'];

	// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
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
	var wasmBinary = Module['wasmBinary'];

	// Wasm globals
	var wasmMemory;

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
	/** @type {function(*, string=)} */ function assert(condition, text) {
		if (!condition) {
			// This build was created without ASSERTIONS defined.  `assert()` should not
			// ever be called in this configuration but in case there are callers in
			// the wild leave this simple abort() implementation here for now.
			abort(text);
		}
	}

	// Memory management
	var /** @type {!Int8Array} */ HEAP8,
		/** @type {!Uint8Array} */ HEAPU8,
		/** @type {!Int16Array} */ HEAP16,
		/** @type {!Uint16Array} */ HEAPU16,
		/** @type {!Int32Array} */ HEAP32,
		/** @type {!Uint32Array} */ HEAPU32,
		/** @type {!Float32Array} */ HEAPF32,
		/* BigInt64Array type is not correctly defined in closure
/** not-@type {!BigInt64Array} */ HEAP64,
		/* BigUint64Array type is not correctly defined in closure
/** not-t@type {!BigUint64Array} */ HEAPU64,
		/** @type {!Float64Array} */ HEAPF64;

	var runtimeInitialized = false;

	var runtimeExited = false;

	/**
	 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
	 * @noinline
	 */ var isFileURI = (filename) => filename.startsWith('file://');

	// include: runtime_shared.js
	// include: runtime_stack_check.js
	// end include: runtime_stack_check.js
	// include: runtime_exceptions.js
	// end include: runtime_exceptions.js
	// include: runtime_debug.js
	// end include: runtime_debug.js
	// include: memoryprofiler.js
	// end include: memoryprofiler.js
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
		Module['HEAP64'] = HEAP64 = new BigInt64Array(b);
		Module['HEAPU64'] = HEAPU64 = new BigUint64Array(b);
	}

	// end include: runtime_shared.js
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
		SOCKFS.root = FS.mount(SOCKFS, {}, null);
		if (!Module['noFSInit'] && !FS.initialized) FS.init();
		TTY.init();
		PIPEFS.root = FS.mount(PIPEFS, {}, null);
		wasmExports['kb']();
		FS.ignorePermissions = false;
	}

	function exitRuntime() {
		___funcs_on_exit();
		// Native atexit() functions
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

	// A counter of dependencies for calling run(). If we need to
	// do asynchronous work before running, increment this and
	// decrement it. Incrementing must happen in a place like
	// Module.preRun (used by emcc to add file preloading).
	// Note that you can add dependencies in preRun, even though
	// it happens right before run - run will be postponed until
	// the dependencies are met.
	var runDependencies = 0;

	var dependenciesFulfilled = null;

	// overridden to take different actions when all run dependencies are fulfilled
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
			if (dependenciesFulfilled) {
				var callback = dependenciesFulfilled;
				dependenciesFulfilled = null;
				callback();
			}
		}
	}

	/** @param {string|number=} what */ function abort(what) {
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
		/** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(
			what
		);
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
		throw 'both async and sync fetching of the wasm failed';
	}

	async function getWasmBinary(binaryFile) {
		// If we don't have the binary yet, load it asynchronously using readAsync.
		if (!wasmBinary) {
			// Fetch the binary using readAsync
			try {
				var response = await readAsync(binaryFile);
				return new Uint8Array(response);
			} catch {}
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
			typeof WebAssembly.instantiateStreaming == 'function' &&
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
			}
		}
		return instantiateArrayBuffer(binaryFile, imports);
	}

	function getWasmImports() {
		// prepare imports
		return {
			a: wasmImports,
		};
	}

	// Create the wasm instance.
	// Receives the wasm imports, returns the exports.
	async function createWasm() {
		// Load the wasm module and create an instance of using native support in the JS engine.
		// handle a generated wasm instance, receiving its exports and
		// performing other necessary setup
		/** @param {WebAssembly.Module=} module*/ function receiveInstance(
			instance,
			module
		) {
			wasmExports = instance.exports;
			wasmExports = Asyncify.instrumentWasmExports(wasmExports);
			Module['wasmExports'] = wasmExports;
			wasmMemory = wasmExports['jb'];
			updateMemoryViews();
			wasmTable = wasmExports['lb'];
			removeRunDependency('wasm-instantiate');
			return wasmExports;
		}
		// wait for the pthread pool (if any)
		addRunDependency('wasm-instantiate');
		// Prefer streaming instantiation if available.
		function receiveInstantiationResult(result) {
			// 'result' is a ResultObject object which has both the module and instance.
			// receiveInstance() will swap in the exports (to Module.asm) so they can be called
			// TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
			// When the regression is fixed, can restore the above PTHREADS-enabled path.
			return receiveInstance(result['instance']);
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
				Module['instantiateWasm'](info, (mod, inst) => {
					receiveInstance(mod, inst);
					resolve(mod.exports);
				});
			});
		}
		wasmBinaryFile ??= findWasmBinary();
		var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
		var exports = receiveInstantiationResult(result);
		return exports;
	}

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

	var callRuntimeCallbacks = (callbacks) => {
		while (callbacks.length > 0) {
			// Pass the module as the first argument.
			callbacks.shift()(Module);
		}
	};

	var onPostRuns = [];

	var addOnPostRun = (cb) => onPostRuns.unshift(cb);

	var onPreRuns = [];

	var addOnPreRun = (cb) => onPreRuns.unshift(cb);

	var noExitRuntime = Module['noExitRuntime'] || false;

	var stackRestore = (val) => __emscripten_stack_restore(val);

	var stackSave = () => _emscripten_stack_get_current();

	var UTF8Decoder =
		typeof TextDecoder != 'undefined' ? new TextDecoder() : undefined;

	/**
	 * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
	 * array that contains uint8 values, returns a copy of that string as a
	 * Javascript String object.
	 * heapOrArray is either a regular array, or a JavaScript typed array view.
	 * @param {number=} idx
	 * @param {number=} maxBytesToRead
	 * @return {string}
	 */ var UTF8ArrayToString = (
		heapOrArray,
		idx = 0,
		maxBytesToRead = NaN
	) => {
		var endIdx = idx + maxBytesToRead;
		var endPtr = idx;
		// TextDecoder needs to know the byte length in advance, it doesn't stop on
		// null terminator by itself.  Also, use the length info to avoid running tiny
		// strings through TextDecoder, since .subarray() allocates garbage.
		// (As a tiny code save trick, compare endPtr against endIdx using a negation,
		// so that undefined/NaN means Infinity)
		while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
		if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
			return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
		}
		var str = '';
		// If building with TextDecoder, we have already computed the string length
		// above, so test loop end condition against that
		while (idx < endPtr) {
			// For UTF8 byte structure, see:
			// http://en.wikipedia.org/wiki/UTF-8#Description
			// https://www.ietf.org/rfc/rfc2279.txt
			// https://tools.ietf.org/html/rfc3629
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

	/**
	 * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
	 * emscripten HEAP, returns a copy of that string as a Javascript String object.
	 *
	 * @param {number} ptr
	 * @param {number=} maxBytesToRead - An optional length that specifies the
	 *   maximum number of bytes to read. You can omit this parameter to scan the
	 *   string until the first 0 byte. If maxBytesToRead is passed, and the string
	 *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
	 *   string will cut short at that byte index (i.e. maxBytesToRead will not
	 *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
	 *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
	 *   JS JIT optimizations off, so it is worth to consider consistently using one
	 * @return {string}
	 */ var UTF8ToString = (ptr, maxBytesToRead) =>
		ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';

	Module['UTF8ToString'] = UTF8ToString;

	var ___assert_fail = (condition, filename, line, func) =>
		abort(
			`Assertion failed: ${UTF8ToString(condition)}, at: ` +
				[
					filename ? UTF8ToString(filename) : 'unknown filename',
					line,
					func ? UTF8ToString(func) : 'unknown function',
				]
		);

	var ___call_sighandler = (fp, sig) => ((a1) => dynCall_vi(fp, a1))(sig);

	class ExceptionInfo {
		// excPtr - Thrown object pointer to wrap. Metadata pointer is calculated from it.
		constructor(excPtr) {
			this.excPtr = excPtr;
			this.ptr = excPtr - 24;
		}
		set_type(type) {
			HEAPU32[(this.ptr + 4) >> 2] = type;
		}
		get_type() {
			return HEAPU32[(this.ptr + 4) >> 2];
		}
		set_destructor(destructor) {
			HEAPU32[(this.ptr + 8) >> 2] = destructor;
		}
		get_destructor() {
			return HEAPU32[(this.ptr + 8) >> 2];
		}
		set_caught(caught) {
			caught = caught ? 1 : 0;
			HEAP8[this.ptr + 12] = caught;
		}
		get_caught() {
			return HEAP8[this.ptr + 12] != 0;
		}
		set_rethrown(rethrown) {
			rethrown = rethrown ? 1 : 0;
			HEAP8[this.ptr + 13] = rethrown;
		}
		get_rethrown() {
			return HEAP8[this.ptr + 13] != 0;
		}
		// Initialize native structure fields. Should be called once after allocated.
		init(type, destructor) {
			this.set_adjusted_ptr(0);
			this.set_type(type);
			this.set_destructor(destructor);
		}
		set_adjusted_ptr(adjustedPtr) {
			HEAPU32[(this.ptr + 16) >> 2] = adjustedPtr;
		}
		get_adjusted_ptr() {
			return HEAPU32[(this.ptr + 16) >> 2];
		}
	}

	var exceptionLast = 0;

	var uncaughtExceptionCount = 0;

	var ___cxa_throw = (ptr, type, destructor) => {
		var info = new ExceptionInfo(ptr);
		// Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
		info.init(type, destructor);
		exceptionLast = ptr;
		uncaughtExceptionCount++;
		throw exceptionLast;
	};

	var initRandomFill = () => (view) => crypto.getRandomValues(view);

	var randomFill = (view) => {
		// Lazily init on the first invocation.
		(randomFill = initRandomFill())(view);
	};

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
					return '';
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

	var lengthBytesUTF8 = (str) => {
		var len = 0;
		for (var i = 0; i < str.length; ++i) {
			// Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
			// unit, not a Unicode code point of the character! So decode
			// UTF16->UTF32->UTF8.
			// See http://unicode.org/faq/utf_bom.html#utf16-3
			var c = str.charCodeAt(i);
			// possibly a lead surrogate
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

	var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
		// Parameter maxBytesToWrite is not optional. Negative values, 0, null,
		// undefined and false each don't write out any bytes.
		if (!(maxBytesToWrite > 0)) return 0;
		var startIdx = outIdx;
		var endIdx = outIdx + maxBytesToWrite - 1;
		// -1 for string null terminator.
		for (var i = 0; i < str.length; ++i) {
			// Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
			// unit, not a Unicode code point of the character! So decode
			// UTF16->UTF32->UTF8.
			// See http://unicode.org/faq/utf_bom.html#utf16-3
			// For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
			// and https://www.ietf.org/rfc/rfc2279.txt
			// and https://tools.ietf.org/html/rfc3629
			var u = str.charCodeAt(i);
			// possibly a lead surrogate
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
		// Null-terminate the pointer to the buffer.
		heap[outIdx] = 0;
		return outIdx - startIdx;
	};

	/** @type {function(string, boolean=, number=)} */ var intArrayFromString =
		(stringy, dontAddNull, length) => {
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
				/** @suppress {missingProperties} */ var fd = process.stdin.fd;
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
		init() {},
		shutdown() {},
		register(dev, ops) {
			TTY.ttys[dev] = {
				input: [],
				output: [],
				ops,
			};
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
				// typical setting
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

	var alignMemory = (size, alignment) =>
		Math.ceil(size / alignment) * alignment;

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
				node.usedBytes = 0;
				// The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
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
				return node.contents.subarray(0, node.usedBytes);
			// Make sure to not return excess unused bytes.
			return new Uint8Array(node.contents);
		},
		expandFileStorage(node, newCapacity) {
			var prevCapacity = node.contents ? node.contents.length : 0;
			if (prevCapacity >= newCapacity) return;
			// No need to expand, the storage was already large enough.
			// Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
			// For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
			// avoid overshooting the allocation cap by a very large margin.
			var CAPACITY_DOUBLING_MAX = 1024 * 1024;
			newCapacity = Math.max(
				newCapacity,
				(prevCapacity *
					(prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>>
					0
			);
			if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
			// At minimum allocate 256b for each file when expanding.
			var oldContents = node.contents;
			node.contents = new Uint8Array(newCapacity);
			// Allocate new storage.
			if (node.usedBytes > 0)
				node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
		},
		resizeFileStorage(node, newSize) {
			if (node.usedBytes == newSize) return;
			if (newSize == 0) {
				node.contents = null;
				// Fully decommit when requesting a resize to zero.
				node.usedBytes = 0;
			} else {
				var oldContents = node.contents;
				node.contents = new Uint8Array(newSize);
				// Allocate new storage.
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
				return {
					ptr,
					allocated,
				};
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

	var asyncLoad = async (url) => {
		var arrayBuffer = await readAsync(url);
		return new Uint8Array(arrayBuffer);
	};

	asyncLoad.isAsync = true;

	var FS_createDataFile = (
		parent,
		name,
		fileData,
		canRead,
		canWrite,
		canOwn
	) => {
		FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
	};

	var preloadPlugins = Module['preloadPlugins'] || [];

	var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
		// Ensure plugins are ready.
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
		// TODO we should allow people to just pass in a complete filename instead
		// of parent and name being that we just join them anyways
		var fullname = name
			? PATH_FS.resolve(PATH.join2(parent, name))
			: parent;
		var dep = getUniqueRunDependency(`cp ${fullname}`);
		// might have several active requests for the same fullname
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
			asyncLoad(url).then(processData, onerror);
		} else {
			processData(url);
		}
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
			flags &= ~2097152;
			// Ignore this flag from musl, otherwise node.js fails to open the file.
			flags &= ~2048;
			// Ignore this flag from musl, otherwise node.js fails to open the file.
			flags &= ~32768;
			// Ignore this flag from musl, otherwise node.js fails to open the file.
			flags &= ~524288;
			// Some applications may pass it; it makes no sense for a single process.
			flags &= ~65536;
			// Node.js doesn't need this passed in, it errors.
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
						fs.writeFileSync(path, '', {
							mode: node.mode,
						});
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
				return {
					ptr,
					allocated: true,
				};
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
						current = current.parent;
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
							return {
								path: current_path,
							};
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
				return {
					path: current_path,
					node: current,
				};
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
					FS.flagsToPermissionString(flags) !== 'r' ||
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
		minor: (dev) => dev & 255,
		makedev: (ma, mi) => (ma << 8) | mi,
		registerDevice(dev, ops) {
			FS.devices[dev] = {
				stream_ops: ops,
			};
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
			mounts.forEach((mount) => {
				if (!mount.type.syncfs) {
					return done(null);
				}
				mount.type.syncfs(mount, populate, done);
			});
		},
		mount(type, opts, mountpoint) {
			var root = mountpoint === '/';
			var pseudo = !mountpoint;
			var node;
			if (root && FS.root) {
				throw new FS.ErrnoError(10);
			} else if (!root && !pseudo) {
				var lookup = FS.lookupPath(mountpoint, {
					follow_mount: false,
				});
				mountpoint = lookup.path;
				// use the absolute path
				node = lookup.node;
				if (FS.isMountpoint(node)) {
					throw new FS.ErrnoError(10);
				}
				if (!FS.isDir(node.mode)) {
					throw new FS.ErrnoError(54);
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
			var lookup = FS.lookupPath(mountpoint, {
				follow_mount: false,
			});
			if (!FS.isMountpoint(lookup.node)) {
				throw new FS.ErrnoError(28);
			}
			// destroy the nodes for this mount, and all its child mounts
			var node = lookup.node;
			var mount = node.mounted;
			var mounts = FS.getMounts(mount);
			Object.keys(FS.nameTable).forEach((hash) => {
				var current = FS.nameTable[hash];
				while (current) {
					var next = current.name_next;
					if (mounts.includes(current.mount)) {
						FS.destroyNode(current);
					}
					current = next;
				}
			});
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
			var lookup = FS.lookupPath(path, {
				parent: true,
			});
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
			return FS.statfsNode(
				FS.lookupPath(path, {
					follow: true,
				}).node
			);
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
				d += '/' + dir;
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
			var lookup = FS.lookupPath(newpath, {
				parent: true,
			});
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
			lookup = FS.lookupPath(old_path, {
				parent: true,
			});
			old_dir = lookup.node;
			lookup = FS.lookupPath(new_path, {
				parent: true,
			});
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
			} catch (e) {}
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
			var lookup = FS.lookupPath(path, {
				parent: true,
			});
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
			var lookup = FS.lookupPath(path, {
				follow: true,
			});
			var node = lookup.node;
			var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
			return readdir(node);
		},
		unlink(path) {
			var lookup = FS.lookupPath(path, {
				parent: true,
			});
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
			var lookup = FS.lookupPath(path, {
				follow: !dontFollow,
			});
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
				var lookup = FS.lookupPath(path, {
					follow: !dontFollow,
				});
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
			});
		},
		chown(path, uid, gid, dontFollow) {
			var node;
			if (typeof path == 'string') {
				var lookup = FS.lookupPath(path, {
					follow: !dontFollow,
				});
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
				var lookup = FS.lookupPath(path, {
					follow: true,
				});
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
			var lookup = FS.lookupPath(path, {
				follow: true,
			});
			var node = lookup.node;
			var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
			setattr(node, {
				atime,
				mtime,
			});
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
					node = FS.mknod(path, mode | 511, 0);
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
				path: FS.getPath(node),
				// we want the absolute path to the node
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
			// free readdir state
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
				throw new Error(`Invalid encoding type "${opts.encoding}"`);
			}
			var ret;
			var stream = FS.open(path, opts.flags);
			var stat = FS.stat(path);
			var length = stat.size;
			var buf = new Uint8Array(length);
			FS.read(stream, buf, 0, length, 0);
			if (opts.encoding === 'utf8') {
				ret = UTF8ArrayToString(buf);
			} else if (opts.encoding === 'binary') {
				ret = buf;
			}
			FS.close(stream);
			return ret;
		},
		writeFile(path, data, opts = {}) {
			opts.flags = opts.flags || 577;
			var stream = FS.open(path, opts.flags, opts.mode);
			if (typeof data == 'string') {
				var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
				var actualNumBytes = stringToUTF8Array(
					data,
					buf,
					0,
					buf.length
				);
				FS.write(
					stream,
					buf,
					0,
					actualNumBytes,
					undefined,
					opts.canOwn
				);
			} else if (ArrayBuffer.isView(data)) {
				FS.write(
					stream,
					data,
					0,
					data.byteLength,
					undefined,
					opts.canOwn
				);
			} else {
				throw new Error('Unsupported data type');
			}
			FS.close(stream);
		},
		cwd: () => FS.currentPath,
		chdir(path) {
			var lookup = FS.lookupPath(path, {
				follow: true,
			});
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
									mount: {
										mountpoint: 'fake',
									},
									node_ops: {
										readlink: () => stream.path,
									},
									id: fd + 1,
								};
								ret.parent = ret;
								// make it look like a simple root node
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
				var lookup = FS.lookupPath(path, {
					parent: true,
				});
				ret.parentExists = true;
				ret.parentPath = lookup.path;
				ret.parentObject = lookup.node;
				ret.name = PATH.basename(path);
				lookup = FS.lookupPath(path, {
					follow: !dontResolveLastLink,
				});
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
			if (typeof XMLHttpRequest != 'undefined') {
				throw new Error(
					'Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.'
				);
			} else {
				// Command-line.
				try {
					obj.contents = readBinary(obj.url);
					obj.usedBytes = obj.contents.length;
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
				chunks = [];
				// Loaded chunks. Index is the chunk number
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
						throw new Error(
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
					// Chunk size in bytes
					if (!hasByteServing) chunkSize = datalength;
					// Function to get a range from the remote URL.
					var doXHR = (from, to) => {
						if (from > to)
							throw new Error(
								'invalid range (' +
									from +
									', ' +
									to +
									') or no bytes requested!'
							);
						if (to > datalength - 1)
							throw new Error(
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
							throw new Error(
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
						var end = (chunkNum + 1) * chunkSize - 1;
						// including this byte
						end = Math.min(end, datalength - 1);
						// if datalength-1 is selected, this is the last block
						if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
							lazyArray.chunks[chunkNum] = doXHR(start, end);
						}
						if (typeof lazyArray.chunks[chunkNum] == 'undefined')
							throw new Error('doXHR failed!');
						return lazyArray.chunks[chunkNum];
					});
					if (usesGzip || !datalength) {
						// if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
						chunkSize = datalength = 1;
						// this will force getter(0)/doXHR do download the whole file
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
			if (typeof XMLHttpRequest != 'undefined') {
				if (!ENVIRONMENT_IS_WORKER)
					throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
				var lazyArray = new LazyUint8Array();
				var properties = {
					isDevice: false,
					contents: lazyArray,
				};
			} else {
				var properties = {
					isDevice: false,
					url,
				};
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
			var keys = Object.keys(node.stream_ops);
			keys.forEach((key) => {
				var fn = node.stream_ops[key];
				stream_ops[key] = (...args) => {
					FS.forceLoadFile(node);
					return fn(...args);
				};
			});
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
				return {
					ptr,
					allocated: true,
				};
			};
			node.stream_ops = stream_ops;
			return node;
		},
	};

	Module['FS'] = FS;

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
			type &= ~526336;
			// Some applications may pass it; it makes no sense for a single process.
			var streaming = type == 1;
			if (streaming && protocol && protocol != 6) {
				throw new FS.ErrnoError(66);
			}
			// create our internal socket structure
			var sock = {
				family,
				type,
				protocol,
				server: null,
				error: null,
				// Used in getsockopt for SOL_SOCKET/SO_ERROR test
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
			read(stream, buffer, offset, length, position) {
				var sock = stream.node.sock;
				var msg = sock.sock_ops.recvmsg(sock, length);
				if (!msg) {
					// socket is closed
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
					// for sockets that've already connected (e.g. we're the server)
					// we can inspect the _socket property for the address
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
					// create the actual websocket object and connect
					try {
						// The default value is 'ws://' the replace is needed because the compiler replaces '//' comments with '#'
						// comments without checking context, so we'd end up with ws:#, the replace swaps the '#' for '//' again.
						var url = 'ws://'.replace('#', '//');
						// Make the WebSocket subprotocol (Sec-WebSocket-Protocol) default to binary if no configuration is set.
						var subProtocols = 'binary';
						// The default value is 'binary'
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
						// not much we can do here in the way of proper error handling as we've already
						// lied and said this data was sent. shut it down.
						peer.socket.close();
					}
				};
				function handleMessage(data) {
					if (typeof data == 'string') {
						var encoder = new TextEncoder();
						// should be utf-8
						data = encoder.encode(data);
					} else {
						assert(data.byteLength !== undefined);
						// must receive an ArrayBuffer
						if (data.byteLength == 0) {
							// An empty ArrayBuffer will emit a pseudo disconnect event
							// as recv/recvmsg will return zero which indicates that a socket
							// has performed a shutdown although the connection has not been disconnected yet.
							return;
						}
						data = new Uint8Array(data);
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
						// Although the ws library may pass errors that may be more descriptive than
						// ECONNREFUSED they are not necessarily the expected error code e.g.
						// ENOTFOUND on getaddrinfo seems to be node.js specific, so using ECONNREFUSED
						// is still probably the most useful thing to do.
						sock.error = 14;
						// Used in getsockopt for SOL_SOCKET/SO_ERROR test.
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
						// The WebSocket spec only allows a 'simple event' to be thrown on error,
						// so we only really know as much as ECONNREFUSED.
						sock.error = 14;
						// Used in getsockopt for SOL_SOCKET/SO_ERROR test.
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
					throw new FS.ErrnoError(28);
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
					throw new FS.ErrnoError(28);
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
				});
				SOCKFS.emit('listen', sock.stream.fd);
				// Send Event with listen fd.
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
					sock.error = 23;
					// Used in getsockopt for SOL_SOCKET/SO_ERROR test.
					SOCKFS.emit('error', [
						sock.stream.fd,
						sock.error,
						'EHOSTUNREACH: Host is unreachable',
					]);
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
				return {
					addr,
					port,
				};
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
		var w, offset, z;
		/* http://home.deds.nl/~aeron/regex/ */ var valid6regx =
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
			str = str.replace('::', 'Z:');
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

	/** @param {number=} addrlen */ var writeSockaddr = (
		sa,
		family,
		addr,
		port,
		addrlen
	) => {
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

	var inetNtop4 = (addr) =>
		(addr & 255) +
		'.' +
		((addr >> 8) & 255) +
		'.' +
		((addr >> 16) & 255) +
		'.' +
		((addr >> 24) & 255);

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
			ints[0] & 65535,
			ints[0] >> 16,
			ints[1] & 65535,
			ints[1] >> 16,
			ints[2] & 65535,
			ints[2] >> 16,
			ints[3] & 65535,
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
				if (v4part === '0.0.0.0') v4part = '';
				// any/unspecified address
				if (v4part === '0.0.0.1') v4part = '1';
				// loopback address
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
						if (zstart === 0) str += ':';
					}
					continue;
				}
			}
			// converts 16-bit words from big-endian to little-endian before converting to hex string
			str += Number(_ntohs(parts[word] & 65535)).toString(16);
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
					return {
						errno: 28,
					};
				}
				addr = HEAP32[(sa + 4) >> 2];
				addr = inetNtop4(addr);
				break;

			case 10:
				if (salen !== 28) {
					return {
						errno: 28,
					};
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
				return {
					errno: 5,
				};
		}
		return {
			family,
			addr,
			port,
		};
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
			HEAP32[buf >> 2] = stat.dev;
			HEAP32[(buf + 4) >> 2] = stat.mode;
			HEAPU32[(buf + 8) >> 2] = stat.nlink;
			HEAP32[(buf + 12) >> 2] = stat.uid;
			HEAP32[(buf + 16) >> 2] = stat.gid;
			HEAP32[(buf + 20) >> 2] = stat.rdev;
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
			HEAP32[(buf + 4) >> 2] = stats.bsize;
			HEAP32[(buf + 40) >> 2] = stats.bsize;
			HEAP32[(buf + 8) >> 2] = stats.blocks;
			HEAP32[(buf + 12) >> 2] = stats.bfree;
			HEAP32[(buf + 16) >> 2] = stats.bavail;
			HEAP32[(buf + 20) >> 2] = stats.files;
			HEAP32[(buf + 24) >> 2] = stats.ffree;
			HEAP32[(buf + 28) >> 2] = stats.fsid;
			HEAP32[(buf + 44) >> 2] = stats.flags;
			// ST_NOSUID
			HEAP32[(buf + 36) >> 2] = stats.namelen;
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

	function ___syscall_dup(fd) {
		try {
			var old = SYSCALLS.getStreamFromFD(fd);
			return FS.dupStream(old).fd;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

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

	function ___syscall_faccessat(dirfd, path, amode, flags) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			if (amode & ~7) {
				// need a valid mode
				return -28;
			}
			var lookup = FS.lookupPath(path, {
				follow: true,
			});
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

	var INT53_MAX = 9007199254740992;

	var INT53_MIN = -9007199254740992;

	var bigintToI53Checked = (num) =>
		num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);

	function ___syscall_fallocate(fd, mode, offset, len) {
		offset = bigintToI53Checked(offset);
		len = bigintToI53Checked(len);
		try {
			if (isNaN(offset)) return 61;
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

	function ___syscall_fchmod(fd, mode) {
		try {
			FS.fchmod(fd, mode);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

	function ___syscall_fchown32(fd, owner, group) {
		try {
			FS.fchown(fd, owner, group);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

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

	/** @suppress {duplicate } */ var syscallGetVarargI = () => {
		// the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
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

				// FD_CLOEXEC makes no sense for a single process.
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

	function ___syscall_fdatasync(fd) {
		try {
			var stream = SYSCALLS.getStreamFromFD(fd);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

	function ___syscall_fstat64(fd, buf) {
		try {
			return SYSCALLS.writeStat(buf, FS.fstat(fd));
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

	function ___syscall_ftruncate64(fd, length) {
		length = bigintToI53Checked(length);
		try {
			if (isNaN(length)) return 61;
			FS.ftruncate(fd, length);
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

	var stringToUTF8 = (str, outPtr, maxBytesToWrite) =>
		stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);

	Module['stringToUTF8'] = stringToUTF8;

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
					var lookup = FS.lookupPath(stream.path, {
						parent: true,
					});
					id = lookup.node.id;
					type = 4;
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

	function ___syscall_getsockopt(fd, level, optname, optval, optlen, d1) {
		try {
			var sock = getSocketFromFD(fd);
			// Minimal getsockopt aimed at resolving https://github.com/emscripten-core/emscripten/issues/2211
			// so only supports SOL_SOCKET with SO_ERROR.
			if (level === 1) {
				if (optname === 4) {
					HEAP32[optval >> 2] = sock.error;
					HEAP32[optlen >> 2] = 4;
					sock.error = null;
					// Clear the error (The SO_ERROR option obtains and then clears this field).
					return 0;
				}
			}
			return -50;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

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
					return -28;
			}
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

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

	function ___syscall_lstat64(path, buf) {
		try {
			path = SYSCALLS.getStr(path);
			return SYSCALLS.writeStat(buf, FS.lstat(path));
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

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

	var PIPEFS = {
		BUCKET_BUFFER_SIZE: 8192,
		mount(mount) {
			// Do not pollute the real root directory or its child nodes with pipes
			// Looks like it is OK to create another pseudo-root node not linked to the FS.root hierarchy this way
			return FS.createNode(null, '/', 16384 | 511, 0);
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
					// Behave as if the read end is always non-blocking
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
				assert(currBucket.offset <= PIPEFS.BUCKET_BUFFER_SIZE);
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

	function ___syscall_recvfrom(fd, buf, len, flags, addr, addrlen) {
		try {
			var sock = getSocketFromFD(fd);
			var msg = sock.sock_ops.recvmsg(
				sock,
				len,
				typeof flags !== 'undefined' ? flags : 0
			);
			if (!msg) return 0;
			// socket is closed
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

	function ___syscall_socket(domain, type, protocol) {
		try {
			var sock = SOCKFS.createSocket(domain, type, protocol);
			return sock.stream.fd;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

	function ___syscall_stat64(path, buf) {
		try {
			path = SYSCALLS.getStr(path);
			return SYSCALLS.writeStat(buf, FS.stat(path));
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

	function ___syscall_statfs64(path, size, buf) {
		try {
			SYSCALLS.writeStatFs(buf, FS.statfs(SYSCALLS.getStr(path)));
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

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

	function ___syscall_unlinkat(dirfd, path, flags) {
		try {
			path = SYSCALLS.getStr(path);
			path = SYSCALLS.calculateAt(dirfd, path);
			if (flags === 0) {
				FS.unlink(path);
			} else if (flags === 512) {
				FS.rmdir(path);
			} else {
				abort('Invalid flags passed to unlinkat');
			}
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return -e.errno;
		}
	}

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

	var __abort_js = () => abort('');

	var __emscripten_lookup_name = (name) => {
		// uint32_t _emscripten_lookup_name(const char *name);
		var nameString = UTF8ToString(name);
		return inetPton4(DNS.lookup_name(nameString));
	};

	var runtimeKeepaliveCounter = 0;

	var __emscripten_runtime_keepalive_clear = () => {
		noExitRuntime = false;
		runtimeKeepaliveCounter = 0;
	};

	var __emscripten_throw_longjmp = () => {
		throw Infinity;
	};

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
		// -1 since it's days since Jan 1
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
			var dstOffset = Math.min(winterOffset, summerOffset);
			// DST is in December in South
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
					date.getTime() + (trueOffset - guessedOffset) * 6e4
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
			return timeMs / 1e3;
		})();
		return BigInt(ret);
	};

	function __mmap_js(len, prot, flags, fd, offset, allocated, addr) {
		offset = bigintToI53Checked(offset);
		try {
			if (isNaN(offset)) return 61;
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

	var timers = {};

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

	var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

	var _proc_exit = (code) => {
		EXITSTATUS = code;
		if (!keepRuntimeAlive()) {
			Module['onExit']?.(code);
			ABORT = true;
		}
		quit_(code, new ExitStatus(code));
	};

	/** @suppress {duplicate } */ /** @param {boolean|number=} implicit */ var exitJS =
		(status, implicit) => {
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

	var _emscripten_get_now = () => performance.now();

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
		timers[which] = {
			id,
			timeout_ms,
		};
		return 0;
	};

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

	var _emscripten_date_now = () => Date.now();

	var nowIsMonotonic = 1;

	var checkWasiClock = (clock_id) => clock_id >= 0 && clock_id <= 3;

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
		var nsec = Math.round(now * 1e3 * 1e3);
		HEAP64[ptime >> 3] = BigInt(nsec);
		return 0;
	}

	var getHeapMax = () =>
		// Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
		// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
		// for any code that deals with heap sizes, which would require special
		// casing all heap size related code to treat 0 specially.
		2147483648;

	var _emscripten_get_heap_max = () => getHeapMax();

	var growMemory = (size) => {
		var b = wasmMemory.buffer;
		var pages = ((size - b.byteLength + 65535) / 65536) | 0;
		try {
			// round size grow request up to wasm page size (fixed 64KB per spec)
			wasmMemory.grow(pages);
			// .grow() takes a delta compared to the previous size
			updateMemoryViews();
			return 1;
		} catch (e) {}
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
			var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
			// ensure geometric growth
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

	var runtimeKeepalivePush = () => {
		runtimeKeepaliveCounter += 1;
	};

	var runtimeKeepalivePop = () => {
		runtimeKeepaliveCounter -= 1;
	};

	/** @param {number=} timeout */ var safeSetTimeout = (func, timeout) => {
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
			// Default values.
			// Browser language detection #8751
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

	var stringToAscii = (str, buffer) => {
		for (var i = 0; i < str.length; ++i) {
			HEAP8[buffer++] = str.charCodeAt(i);
		}
		// Null-terminate the string
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

	/** @param {number=} offset */ var doReadv = (
		stream,
		iov,
		iovcnt,
		offset
	) => {
		var ret = 0;
		for (var i = 0; i < iovcnt; i++) {
			var ptr = HEAPU32[iov >> 2];
			var len = HEAPU32[(iov + 4) >> 2];
			iov += 8;
			var curr = FS.read(stream, HEAP8, ptr, len, offset);
			if (curr < 0) return -1;
			ret += curr;
			if (curr < len) break;
			// nothing more to read
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

	function _fd_seek(fd, offset, whence, newOffset) {
		offset = bigintToI53Checked(offset);
		try {
			if (isNaN(offset)) return 61;
			var stream = SYSCALLS.getStreamFromFD(fd);
			FS.llseek(stream, offset, whence);
			HEAP64[newOffset >> 3] = BigInt(stream.position);
			if (stream.getdents && offset === 0 && whence === 0)
				stream.getdents = null;
			// reset readdir state
			return 0;
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	}

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
					if (err) {
						wakeUp(29);
						return;
					}
					wakeUp(0);
				});
			});
		} catch (e) {
			if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
			return e.errno;
		}
	};

	_fd_sync.isAsync = true;

	/** @param {number=} offset */ var doWritev = (
		stream,
		iov,
		iovcnt,
		offset
	) => {
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
		// try as a numeric address
		node = UTF8ToString(node);
		addr = inetPton4(node);
		if (addr !== null) {
			// incoming node is a valid ipv4 address
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
		// try as a hostname
		// resolve the hostname to a temporary fake address
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

	var Protocols = {
		list: [],
		map: {},
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
			var aliasListBuf = _malloc((length + 1) * 4);
			// Use length + 1 so we have space for the terminating NULL ptr.
			for (var i = 0; i < length; i++, j += 4) {
				var alias = aliases[i];
				var aliasBuf = _malloc(alias.length + 1);
				stringToAscii(alias, aliasBuf);
				HEAPU32[(aliasListBuf + j) >> 2] = aliasBuf;
			}
			HEAPU32[(aliasListBuf + j) >> 2] = 0;
			// Terminating NULL pointer.
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

	var _getprotobyname = (name) => {
		// struct protoent *getprotobyname(const char *);
		name = UTF8ToString(name);
		_setprotoent(true);
		var result = Protocols.map[name];
		return result;
	};

	var _getprotobynumber = (number) => {
		// struct protoent *getprotobynumber(int proto);
		_setprotoent(true);
		var result = Protocols.map[number];
		return result;
	};

	var stackAlloc = (sz) => __emscripten_stack_alloc(sz);

	/** @suppress {duplicate } */ var stringToUTF8OnStack = (str) => {
		var size = lengthBytesUTF8(str) + 1;
		var ret = stackAlloc(size);
		stringToUTF8(str, ret, size);
		return ret;
	};

	var allocateUTF8OnStack = stringToUTF8OnStack;

	function _js_getpid() {
		return PHPLoader.processId ?? 42;
	}

	function _js_wasm_trace(format, ...args) {
		if (PHPLoader.trace instanceof Function) {
			PHPLoader.trace(_js_getpid(), format, ...args);
		}
	}

	var PHPWASM = {
		init: function () {
			Module['ENV'] = Module['ENV'] || {};
			// Ensure a platform-level bin directory for a fallback `php` binary.
			Module['ENV']['PATH'] = [
				Module['ENV']['PATH'],
				'/internal/shared/bin',
			]
				.filter(Boolean)
				.join(':');

			// The /internal directory is required by the C module. It's where the
			// stdout, stderr, and headers information are written for the JavaScript
			// code to read later on.
			FS.mkdir('/internal');
			// The files from the shared directory are shared between all the
			// PHP processes managed by PHPProcessManager.
			FS.mkdir('/internal/shared');
			// The files from the preload directory are preloaded using the
			// auto_prepend_file php.ini directive.
			FS.mkdir('/internal/shared/preload');
			// Platform-level bin directory for a fallback `php` binary. Without it,
			// PHP may not populate the PHP_BINARY constant.
			FS.mkdir('/internal/shared/bin');
			const originalOnRuntimeInitialized = Module['onRuntimeInitialized'];
			Module['onRuntimeInitialized'] = () => {
				// Dummy PHP binary for PHP to populate the PHP_BINARY constant.
				FS.writeFile(
					'/internal/shared/bin/php',
					new TextEncoder().encode('#!/bin/sh\nphp "$@"')
				);
				// It must be executable to be used by PHP.
				FS.chmod('/internal/shared/bin/php', 0o755);
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
			FS.mkdev('/internal/stdout', FS.makedev(64, 0));
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
			FS.mkdev('/internal/stderr', FS.makedev(63, 0));
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
			FS.mkdev('/internal/headers', FS.makedev(62, 0));
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
			// Clean up the fd -> childProcess mapping when the fd is closed:
			const originalClose = FS.close;
			FS.close = function (stream) {
				originalClose(stream);
				delete PHPWASM.child_proc_by_fd[stream.fd];
			};
			PHPWASM.child_proc_by_fd = {};
			PHPWASM.child_proc_by_pid = {};
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
				 */ if (val === 10) tty.output.push(val);
				return originalPutChar(tty, val);
			};
		},
		onHeaders: function (chunk) {
			if (Module['onHeaders']) {
				Module['onHeaders'](chunk);
				return;
			}
			console.log('headers', {
				chunk,
			});
		},
		onStdout: function (chunk) {
			if (Module['onStdout']) {
				Module['onStdout'](chunk);
				return;
			}
			if (ENVIRONMENT_IS_NODE) {
				process.stdout.write(chunk);
			} else {
				console.log('stdout', {
					chunk,
				});
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
				console.warn('stderr', {
					chunk,
				});
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
			devicePath,
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
				for (const fd of [
					// The child process exited. Let's clean up its output streams:
					ProcInfo.stdoutChildFd,
					ProcInfo.stderrChildFd,
				]) {
					if (FS.streams[fd] && !FS.isClosed(FS.streams[fd])) {
						FS.close(FS.streams[fd]);
					}
				}
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
			 */ try {
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
					 */ let resolved = false;
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
					 */ setTimeout(() => {
						if (resolved) return;
						resolved = true;
						reject(new Error('Process timed out'));
					}, 5e3);
				});
			} catch (e) {
				console.error(e);
				wakeUp(ProcInfo.pid);
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

	var _makecontext = () => abort('missing function: ${name}');

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
					year += year < 69 ? 2e3 : 1900;
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
        */ var fullDate = new Date(
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
			return buf + intArrayFromString(matches[0]).length - 1;
		}
		return 0;
	};

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

	/** @type {WebAssembly.Table} */ var wasmTable;

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
				/^(_dlopen_js|invoke_i|invoke_ii|invoke_iii|invoke_iiii|invoke_iiiii|invoke_iiiiii|invoke_iiiiiii|invoke_iiiiiiii|invoke_iiiiiiiiii|invoke_v|invoke_vi|invoke_vii|invoke_viidii|invoke_viii|invoke_viiii|invoke_viiiii|invoke_viiiiii|invoke_viiiiiii|invoke_viiiiiiiii|invoke_i|invoke_ii|invoke_iii|invoke_iiii|invoke_iiiii|invoke_iiiiii|invoke_iiiiiii|invoke_iiiiiiii|invoke_iiiiiiiiii|invoke_iij|invoke_iiji|invoke_iijii|invoke_iijiji|invoke_jii|invoke_jiii|invoke_viijii|invoke_vji|js_open_process|_js_open_process|_asyncjs__js_open_process|js_popen_to_file|_js_popen_to_file|_asyncjs__js_popen_to_file|__syscall_fcntl64|js_release_file_locks|js_flock|js_fd_read|_js_fd_read|_fd_close|js_module_onMessage|_js_module_onMessage|_asyncjs__js_module_onMessage|js_waitpid|_js_waitpid|_asyncjs__js_waitpid|wasm_poll_socket|_wasm_poll_socket|_asyncjs__wasm_poll_socket|_wasm_shutdown|_asyncjs__wasm_shutdown|__asyncjs__.*)$/;
			for (let [x, original] of Object.entries(imports)) {
				if (typeof original == 'function') {
					let isAsyncifyImport =
						original.isAsync || importPattern.test(x);
				}
			}
		},
		instrumentWasmExports(exports) {
			var ret = {};
			for (let [x, original] of Object.entries(exports)) {
				if (typeof original == 'function') {
					ret[x] = (...args) => {
						Asyncify.exportCallStack.push(x);
						try {
							return original(...args);
						} finally {
							if (!ABORT) {
								var y = Asyncify.exportCallStack.pop();
								Asyncify.maybeStopUnwind();
							}
						}
					};
				} else {
					ret[x] = original;
				}
			}
			return ret;
		},
		State: {
			Normal: 0,
			Unwinding: 1,
			Rewinding: 2,
			Disabled: 3,
		},
		state: 0,
		StackSize: 4096,
		currData: null,
		handleSleepReturnValue: 0,
		exportCallStack: [],
		callStackNameToId: {},
		callStackIdToName: {},
		callStackId: 0,
		asyncPromiseHandlers: null,
		sleepCallbacks: [],
		getCallStackId(funcName) {
			var id = Asyncify.callStackNameToId[funcName];
			if (id === undefined) {
				id = Asyncify.callStackId++;
				Asyncify.callStackNameToId[funcName] = id;
				Asyncify.callStackIdToName[id] = funcName;
			}
			return id;
		},
		maybeStopUnwind() {
			if (
				Asyncify.currData &&
				Asyncify.state === Asyncify.State.Unwinding &&
				Asyncify.exportCallStack.length === 0
			) {
				// We just finished unwinding.
				// Be sure to set the state before calling any other functions to avoid
				// possible infinite recursion here (For example in debug pthread builds
				// the dbg() function itself can call back into WebAssembly to get the
				// current pthread_self() pointer).
				Asyncify.state = Asyncify.State.Normal;
				runtimeKeepalivePush();
				// Keep the runtime alive so that a re-wind can be done later.
				runAndAbortIfError(_asyncify_stop_unwind);
				if (typeof Fibers != 'undefined') {
					Fibers.trampoline();
				}
			}
		},
		whenDone() {
			return new Promise((resolve, reject) => {
				Asyncify.asyncPromiseHandlers = {
					resolve,
					reject,
				};
			});
		},
		allocateData() {
			// An asyncify data structure has three fields:
			//  0  current stack pos
			//  4  max stack pos
			//  8  id of function at bottom of the call stack (callStackIdToName[id] == name of js function)
			// The Asyncify ABI only interprets the first two fields, the rest is for the runtime.
			// We also embed a stack in the same memory region here, right next to the structure.
			// This struct is also defined as asyncify_data_t in emscripten/fiber.h
			var ptr = _malloc(12 + Asyncify.StackSize);
			Asyncify.setDataHeader(ptr, ptr + 12, Asyncify.StackSize);
			Asyncify.setDataRewindFunc(ptr);
			return ptr;
		},
		setDataHeader(ptr, stack, stackSize) {
			HEAPU32[ptr >> 2] = stack;
			HEAPU32[(ptr + 4) >> 2] = stack + stackSize;
		},
		setDataRewindFunc(ptr) {
			var bottomOfCallStack = Asyncify.exportCallStack[0];
			var rewindId = Asyncify.getCallStackId(bottomOfCallStack);
			HEAP32[(ptr + 8) >> 2] = rewindId;
		},
		getDataRewindFuncName(ptr) {
			var id = HEAP32[(ptr + 8) >> 2];
			var name = Asyncify.callStackIdToName[id];
			return name;
		},
		getDataRewindFunc(name) {
			var func = wasmExports[name];
			return func;
		},
		doRewind(ptr) {
			var name = Asyncify.getDataRewindFuncName(ptr);
			var func = Asyncify.getDataRewindFunc(name);
			// Once we have rewound and the stack we no longer need to artificially
			// keep the runtime alive.
			runtimeKeepalivePop();
			return func();
		},
		handleSleep(startAsync) {
			if (ABORT) return;
			if (Asyncify.state === Asyncify.State.Normal) {
				// Prepare to sleep. Call startAsync, and see what happens:
				// if the code decided to call our callback synchronously,
				// then no async operation was in fact begun, and we don't
				// need to do anything.
				var reachedCallback = false;
				var reachedAfterCallback = false;
				startAsync((handleSleepReturnValue = 0) => {
					if (ABORT) return;
					Asyncify.handleSleepReturnValue = handleSleepReturnValue;
					reachedCallback = true;
					if (!reachedAfterCallback) {
						// We are happening synchronously, so no need for async.
						return;
					}
					Asyncify.state = Asyncify.State.Rewinding;
					runAndAbortIfError(() =>
						_asyncify_start_rewind(Asyncify.currData)
					);
					if (typeof MainLoop != 'undefined' && MainLoop.func) {
						MainLoop.resume();
					}
					var asyncWasmReturnValue,
						isError = false;
					try {
						asyncWasmReturnValue = Asyncify.doRewind(
							Asyncify.currData
						);
					} catch (err) {
						asyncWasmReturnValue = err;
						isError = true;
					}
					// Track whether the return value was handled by any promise handlers.
					var handled = false;
					if (!Asyncify.currData) {
						// All asynchronous execution has finished.
						// `asyncWasmReturnValue` now contains the final
						// return value of the exported async WASM function.
						// Note: `asyncWasmReturnValue` is distinct from
						// `Asyncify.handleSleepReturnValue`.
						// `Asyncify.handleSleepReturnValue` contains the return
						// value of the last C function to have executed
						// `Asyncify.handleSleep()`, where as `asyncWasmReturnValue`
						// contains the return value of the exported WASM function
						// that may have called C functions that
						// call `Asyncify.handleSleep()`.
						var asyncPromiseHandlers =
							Asyncify.asyncPromiseHandlers;
						if (asyncPromiseHandlers) {
							Asyncify.asyncPromiseHandlers = null;
							(isError
								? asyncPromiseHandlers.reject
								: asyncPromiseHandlers.resolve)(
								asyncWasmReturnValue
							);
							handled = true;
						}
					}
					if (isError && !handled) {
						// If there was an error and it was not handled by now, we have no choice but to
						// rethrow that error into the global scope where it can be caught only by
						// `onerror` or `onunhandledpromiserejection`.
						throw asyncWasmReturnValue;
					}
				});
				reachedAfterCallback = true;
				if (!reachedCallback) {
					// A true async operation was begun; start a sleep.
					Asyncify.state = Asyncify.State.Unwinding;
					// TODO: reuse, don't alloc/free every sleep
					Asyncify.currData = Asyncify.allocateData();
					if (typeof MainLoop != 'undefined' && MainLoop.func) {
						MainLoop.pause();
					}
					runAndAbortIfError(() =>
						_asyncify_start_unwind(Asyncify.currData)
					);
				}
			} else if (Asyncify.state === Asyncify.State.Rewinding) {
				// Stop a resume.
				Asyncify.state = Asyncify.State.Normal;
				runAndAbortIfError(_asyncify_stop_rewind);
				_free(Asyncify.currData);
				Asyncify.currData = null;
				// Call all sleep callbacks now that the sleep-resume is all done.
				Asyncify.sleepCallbacks.forEach(callUserCallback);
			} else {
				abort(`invalid state: ${Asyncify.state}`);
			}
			return Asyncify.handleSleepReturnValue;
		},
		handleAsync(startAsync) {
			return Asyncify.handleSleep((wakeUp) => {
				// TODO: add error handling as a second param when handleSleep implements it.
				startAsync().then(wakeUp);
			});
		},
	};

	var getCFunc = (ident) => {
		var func = Module['_' + ident];
		// closure exported function
		return func;
	};

	var writeArrayToMemory = (array, buffer) => {
		HEAP8.set(array, buffer);
	};

	/**
	 * @param {string|null=} returnType
	 * @param {Array=} argTypes
	 * @param {Arguments|Array=} args
	 * @param {Object=} opts
	 */ var ccall = (ident, returnType, argTypes, args, opts) => {
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
		// Data for a previous async operation that was in flight before us.
		var previousAsync = Asyncify.currData;
		var ret = func(...cArgs);
		function onDone(ret) {
			runtimeKeepalivePop();
			if (stack !== 0) stackRestore(stack);
			return convertReturnValue(ret);
		}
		var asyncMode = opts?.async;
		// Keep the runtime alive through all calls. Note that this call might not be
		// async, but for simplicity we push and pop in all calls.
		runtimeKeepalivePush();
		if (Asyncify.currData != previousAsync) {
			// This is a new async operation. The wasm is paused and has unwound its stack.
			// We need to return a Promise that resolves the return value
			// once the stack is rewound and execution finishes.
			return Asyncify.whenDone().then(onDone);
		}
		ret = onDone(ret);
		// If this is an async ccall, ensure we return a promise
		if (asyncMode) return Promise.resolve(ret);
		return ret;
	};

	var FS_createPath = FS.createPath;

	var FS_unlink = (path) => FS.unlink(path);

	var FS_createLazyFile = FS.createLazyFile;

	var FS_createDevice = FS.createDevice;

	FS.createPreloadedFile = FS_createPreloadedFile;

	FS.staticInit();

	// Set module methods based on EXPORTED_RUNTIME_METHODS
	Module['FS_createPath'] = FS.createPath;

	Module['FS_createDataFile'] = FS.createDataFile;

	Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

	Module['FS_unlink'] = FS.unlink;

	Module['FS_createLazyFile'] = FS.createLazyFile;

	Module['FS_createDevice'] = FS.createDevice;

	// This error may happen quite a bit. To avoid overhead we reuse it (and
	// suffer a lack of stack info).
	MEMFS.doesNotExistError = new FS.ErrnoError(44);

	/** @suppress {checkTypes} */ MEMFS.doesNotExistError.stack =
		'<generic error, no stack>';

	if (ENVIRONMENT_IS_NODE) {
		NODEFS.staticInit();
	}

	PHPWASM.init();

	// End JS library code
	function js_popen_to_file(command, mode, exitCodePtr) {
		const returnCallback = (resolver) => Asyncify.handleSleep(resolver);
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
					outByteArrays.reduce((acc, curr) => acc + curr.length, 0)
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
	}

	function wasm_poll_socket(socketd, events, timeout) {
		const returnCallback = (resolver) => Asyncify.handleSleep(resolver);
		const POLLIN = 1;
		const POLLPRI = 2;
		const POLLOUT = 4;
		const POLLERR = 8;
		const POLLHUP = 16;
		const POLLNVAL = 32;
		return returnCallback((wakeUp) => {
			const polls = [];
			if (FS.isSocket(FS.getStream(socketd)?.node.mode)) {
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
			} else if (socketd in PHPWASM.child_proc_by_fd) {
				const procInfo = PHPWASM.child_proc_by_fd[socketd];
				if (procInfo.exited) {
					wakeUp(0);
					return;
				}
				polls.push(PHPWASM.awaitEvent(procInfo.stdout, 'data'));
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
	}

	function js_fd_read(fd, iov, iovcnt, pnum) {
		const returnCallback = (resolver) => Asyncify.handleSleep(resolver);
		if (
			Asyncify?.State?.Normal === undefined ||
			Asyncify?.state === Asyncify?.State?.Normal
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
				if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) {
					throw e;
				}
				if (
					e.errno !== 6 ||
					!(stream?.fd in PHPWASM.child_proc_by_fd)
				) {
					HEAPU32[pnum >> 2] = 0;
					return returnCode;
				}
			}
		}
		return returnCallback((wakeUp) => {
			var retries = 0;
			var interval = 50;
			var timeout = 5e3;
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
				const failure =
					++retries > maxRetries ||
					!(fd in PHPWASM.child_proc_by_fd) ||
					PHPWASM.child_proc_by_fd[fd]?.exited ||
					FS.isClosed(stream);
				if (success) {
					HEAPU32[pnum >> 2] = num;
					wakeUp(0);
				} else if (failure) {
					HEAPU32[pnum >> 2] = 0;
					wakeUp(returnCode === 6 ? 0 : returnCode);
				} else {
					setTimeout(poll, interval);
				}
			}
			poll();
		});
	}

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

	var wasmImports = {
		/** @export */ o: ___assert_fail,
		/** @export */ da: __asyncjs__js_module_onMessage,
		/** @export */ ib: ___call_sighandler,
		/** @export */ W: ___cxa_throw,
		/** @export */ hb: ___syscall_accept4,
		/** @export */ gb: ___syscall_bind,
		/** @export */ fb: ___syscall_chdir,
		/** @export */ V: ___syscall_chmod,
		/** @export */ eb: ___syscall_connect,
		/** @export */ db: ___syscall_dup,
		/** @export */ cb: ___syscall_dup3,
		/** @export */ bb: ___syscall_faccessat,
		/** @export */ ab: ___syscall_fallocate,
		/** @export */ $a: ___syscall_fchmod,
		/** @export */ _a: ___syscall_fchown32,
		/** @export */ U: ___syscall_fchownat,
		/** @export */ n: ___syscall_fcntl64,
		/** @export */ Za: ___syscall_fdatasync,
		/** @export */ Ya: ___syscall_fstat64,
		/** @export */ Xa: ___syscall_ftruncate64,
		/** @export */ Wa: ___syscall_getcwd,
		/** @export */ Va: ___syscall_getdents64,
		/** @export */ Ua: ___syscall_getpeername,
		/** @export */ Ta: ___syscall_getsockname,
		/** @export */ Sa: ___syscall_getsockopt,
		/** @export */ E: ___syscall_ioctl,
		/** @export */ Ra: ___syscall_listen,
		/** @export */ Qa: ___syscall_lstat64,
		/** @export */ Pa: ___syscall_mkdirat,
		/** @export */ Oa: ___syscall_newfstatat,
		/** @export */ y: ___syscall_openat,
		/** @export */ Na: ___syscall_pipe,
		/** @export */ Ma: ___syscall_poll,
		/** @export */ La: ___syscall_readlinkat,
		/** @export */ Ka: ___syscall_recvfrom,
		/** @export */ Ja: ___syscall_renameat,
		/** @export */ T: ___syscall_rmdir,
		/** @export */ Ia: ___syscall_sendto,
		/** @export */ S: ___syscall_socket,
		/** @export */ Ha: ___syscall_stat64,
		/** @export */ Ga: ___syscall_statfs64,
		/** @export */ Fa: ___syscall_symlinkat,
		/** @export */ D: ___syscall_unlinkat,
		/** @export */ Ea: ___syscall_utimensat,
		/** @export */ xa: __abort_js,
		/** @export */ wa: __emscripten_lookup_name,
		/** @export */ va: __emscripten_runtime_keepalive_clear,
		/** @export */ ua: __emscripten_throw_longjmp,
		/** @export */ ta: __gmtime_js,
		/** @export */ sa: __localtime_js,
		/** @export */ ra: __mktime_js,
		/** @export */ qa: __mmap_js,
		/** @export */ pa: __munmap_js,
		/** @export */ P: __setitimer_js,
		/** @export */ oa: __tzset_js,
		/** @export */ Da: _clock_time_get,
		/** @export */ O: _emscripten_date_now,
		/** @export */ na: _emscripten_get_heap_max,
		/** @export */ x: _emscripten_get_now,
		/** @export */ ma: _emscripten_resize_heap,
		/** @export */ N: _emscripten_sleep,
		/** @export */ Ca: _environ_get,
		/** @export */ Ba: _environ_sizes_get,
		/** @export */ q: _exit,
		/** @export */ r: _fd_close,
		/** @export */ R: _fd_fdstat_get,
		/** @export */ Q: _fd_read,
		/** @export */ Aa: _fd_seek,
		/** @export */ za: _fd_sync,
		/** @export */ C: _fd_write,
		/** @export */ M: _getaddrinfo,
		/** @export */ la: _getcontext,
		/** @export */ ka: _getdtablesize,
		/** @export */ w: _getnameinfo,
		/** @export */ ja: _getprotobyname,
		/** @export */ ia: _getprotobynumber,
		/** @export */ k: invoke_i,
		/** @export */ c: invoke_ii,
		/** @export */ b: invoke_iii,
		/** @export */ g: invoke_iiii,
		/** @export */ h: invoke_iiiii,
		/** @export */ m: invoke_iiiiii,
		/** @export */ u: invoke_iiiiiii,
		/** @export */ v: invoke_iiiiiiii,
		/** @export */ L: invoke_iiiiiiiiii,
		/** @export */ B: invoke_iij,
		/** @export */ K: invoke_iiji,
		/** @export */ ha: invoke_iijii,
		/** @export */ ga: invoke_iijiji,
		/** @export */ J: invoke_jii,
		/** @export */ I: invoke_jiii,
		/** @export */ e: invoke_v,
		/** @export */ a: invoke_vi,
		/** @export */ d: invoke_vii,
		/** @export */ A: invoke_viidii,
		/** @export */ f: invoke_viii,
		/** @export */ l: invoke_viiii,
		/** @export */ j: invoke_viiiii,
		/** @export */ fa: invoke_viiiiiii,
		/** @export */ z: invoke_viiiiiiiii,
		/** @export */ i: invoke_viijii,
		/** @export */ H: invoke_vji,
		/** @export */ G: _js_create_input_device,
		/** @export */ ea: js_fd_read,
		/** @export */ F: _js_open_process,
		/** @export */ ca: js_popen_to_file,
		/** @export */ ba: _js_process_status,
		/** @export */ aa: _js_waitpid,
		/** @export */ $: _js_wasm_trace,
		/** @export */ _: _makecontext,
		/** @export */ ya: _proc_exit,
		/** @export */ Z: _strptime,
		/** @export */ Y: _swapcontext,
		/** @export */ s: _wasm_close,
		/** @export */ t: wasm_poll_socket,
		/** @export */ p: _wasm_setsockopt,
		/** @export */ X: _wasm_shutdown,
	};

	var wasmExports;

	createWasm();

	var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports['kb'])();

	var _free = (a0) => (_free = wasmExports['mb'])(a0);

	var _malloc = (a0) => (_malloc = wasmExports['nb'])(a0);

	var _wasm_popen = (Module['_wasm_popen'] = (a0, a1) =>
		(_wasm_popen = Module['_wasm_popen'] = wasmExports['ob'])(a0, a1));

	var _wasm_php_exec = (Module['_wasm_php_exec'] = (a0, a1, a2, a3) =>
		(_wasm_php_exec = Module['_wasm_php_exec'] = wasmExports['pb'])(
			a0,
			a1,
			a2,
			a3
		));

	var _php_pollfd_for = (Module['_php_pollfd_for'] = (a0, a1, a2) =>
		(_php_pollfd_for = Module['_php_pollfd_for'] = wasmExports['qb'])(
			a0,
			a1,
			a2
		));

	var _htons = (a0) => (_htons = wasmExports['rb'])(a0);

	var _ntohs = (a0) => (_ntohs = wasmExports['sb'])(a0);

	var _htonl = (a0) => (_htonl = wasmExports['tb'])(a0);

	var _wasm_sleep = (Module['_wasm_sleep'] = (a0) =>
		(_wasm_sleep = Module['_wasm_sleep'] = wasmExports['ub'])(a0));

	var _fflush = (a0) => (_fflush = wasmExports['vb'])(a0);

	var _wasm_read = (Module['_wasm_read'] = (a0, a1, a2) =>
		(_wasm_read = Module['_wasm_read'] = wasmExports['wb'])(a0, a1, a2));

	var ___wrap_select = (Module['___wrap_select'] = (a0, a1, a2, a3, a4) =>
		(___wrap_select = Module['___wrap_select'] = wasmExports['xb'])(
			a0,
			a1,
			a2,
			a3,
			a4
		));

	var _wasm_set_sapi_name = (Module['_wasm_set_sapi_name'] = (a0) =>
		(_wasm_set_sapi_name = Module['_wasm_set_sapi_name'] =
			wasmExports['yb'])(a0));

	var _wasm_set_phpini_path = (Module['_wasm_set_phpini_path'] = (a0) =>
		(_wasm_set_phpini_path = Module['_wasm_set_phpini_path'] =
			wasmExports['zb'])(a0));

	var _wasm_add_cli_arg = (Module['_wasm_add_cli_arg'] = (a0) =>
		(_wasm_add_cli_arg = Module['_wasm_add_cli_arg'] = wasmExports['Ab'])(
			a0
		));

	var _run_cli = (Module['_run_cli'] = () =>
		(_run_cli = Module['_run_cli'] = wasmExports['Bb'])());

	var _wasm_add_SERVER_entry = (Module['_wasm_add_SERVER_entry'] = (a0, a1) =>
		(_wasm_add_SERVER_entry = Module['_wasm_add_SERVER_entry'] =
			wasmExports['Cb'])(a0, a1));

	var _wasm_add_ENV_entry = (Module['_wasm_add_ENV_entry'] = (a0, a1) =>
		(_wasm_add_ENV_entry = Module['_wasm_add_ENV_entry'] =
			wasmExports['Db'])(a0, a1));

	var _wasm_set_query_string = (Module['_wasm_set_query_string'] = (a0) =>
		(_wasm_set_query_string = Module['_wasm_set_query_string'] =
			wasmExports['Eb'])(a0));

	var _wasm_set_path_translated = (Module['_wasm_set_path_translated'] = (
		a0
	) =>
		(_wasm_set_path_translated = Module['_wasm_set_path_translated'] =
			wasmExports['Fb'])(a0));

	var _wasm_set_skip_shebang = (Module['_wasm_set_skip_shebang'] = (a0) =>
		(_wasm_set_skip_shebang = Module['_wasm_set_skip_shebang'] =
			wasmExports['Gb'])(a0));

	var _wasm_set_request_uri = (Module['_wasm_set_request_uri'] = (a0) =>
		(_wasm_set_request_uri = Module['_wasm_set_request_uri'] =
			wasmExports['Hb'])(a0));

	var _wasm_set_request_method = (Module['_wasm_set_request_method'] = (a0) =>
		(_wasm_set_request_method = Module['_wasm_set_request_method'] =
			wasmExports['Ib'])(a0));

	var _wasm_set_request_host = (Module['_wasm_set_request_host'] = (a0) =>
		(_wasm_set_request_host = Module['_wasm_set_request_host'] =
			wasmExports['Jb'])(a0));

	var _wasm_set_content_type = (Module['_wasm_set_content_type'] = (a0) =>
		(_wasm_set_content_type = Module['_wasm_set_content_type'] =
			wasmExports['Kb'])(a0));

	var _wasm_set_request_body = (Module['_wasm_set_request_body'] = (a0) =>
		(_wasm_set_request_body = Module['_wasm_set_request_body'] =
			wasmExports['Lb'])(a0));

	var _wasm_set_content_length = (Module['_wasm_set_content_length'] = (a0) =>
		(_wasm_set_content_length = Module['_wasm_set_content_length'] =
			wasmExports['Mb'])(a0));

	var _wasm_set_cookies = (Module['_wasm_set_cookies'] = (a0) =>
		(_wasm_set_cookies = Module['_wasm_set_cookies'] = wasmExports['Nb'])(
			a0
		));

	var _wasm_set_request_port = (Module['_wasm_set_request_port'] = (a0) =>
		(_wasm_set_request_port = Module['_wasm_set_request_port'] =
			wasmExports['Ob'])(a0));

	var _wasm_sapi_request_shutdown = (Module['_wasm_sapi_request_shutdown'] =
		() =>
			(_wasm_sapi_request_shutdown = Module[
				'_wasm_sapi_request_shutdown'
			] =
				wasmExports['Pb'])());

	var _wasm_sapi_handle_request = (Module['_wasm_sapi_handle_request'] = () =>
		(_wasm_sapi_handle_request = Module['_wasm_sapi_handle_request'] =
			wasmExports['Qb'])());

	var _php_wasm_init = (Module['_php_wasm_init'] = () =>
		(_php_wasm_init = Module['_php_wasm_init'] = wasmExports['Rb'])());

	var _wasm_free = (Module['_wasm_free'] = (a0) =>
		(_wasm_free = Module['_wasm_free'] = wasmExports['Sb'])(a0));

	var _wasm_trace = (Module['_wasm_trace'] = (a0, a1) =>
		(_wasm_trace = Module['_wasm_trace'] = wasmExports['Tb'])(a0, a1));

	var ___funcs_on_exit = () => (___funcs_on_exit = wasmExports['Ub'])();

	var _emscripten_builtin_memalign = (a0, a1) =>
		(_emscripten_builtin_memalign = wasmExports['Vb'])(a0, a1);

	var __emscripten_timeout = (a0, a1) =>
		(__emscripten_timeout = wasmExports['Wb'])(a0, a1);

	var _setThrew = (a0, a1) => (_setThrew = wasmExports['Xb'])(a0, a1);

	var __emscripten_stack_restore = (a0) =>
		(__emscripten_stack_restore = wasmExports['Yb'])(a0);

	var __emscripten_stack_alloc = (a0) =>
		(__emscripten_stack_alloc = wasmExports['Zb'])(a0);

	var _emscripten_stack_get_current = () =>
		(_emscripten_stack_get_current = wasmExports['_b'])();

	var dynCall_iiii = (Module['dynCall_iiii'] = (a0, a1, a2, a3) =>
		(dynCall_iiii = Module['dynCall_iiii'] = wasmExports['$b'])(
			a0,
			a1,
			a2,
			a3
		));

	var dynCall_ii = (Module['dynCall_ii'] = (a0, a1) =>
		(dynCall_ii = Module['dynCall_ii'] = wasmExports['ac'])(a0, a1));

	var dynCall_vi = (Module['dynCall_vi'] = (a0, a1) =>
		(dynCall_vi = Module['dynCall_vi'] = wasmExports['bc'])(a0, a1));

	var dynCall_vii = (Module['dynCall_vii'] = (a0, a1, a2) =>
		(dynCall_vii = Module['dynCall_vii'] = wasmExports['cc'])(a0, a1, a2));

	var dynCall_viiiii = (Module['dynCall_viiiii'] = (a0, a1, a2, a3, a4, a5) =>
		(dynCall_viiiii = Module['dynCall_viiiii'] = wasmExports['dc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5
		));

	var dynCall_iii = (Module['dynCall_iii'] = (a0, a1, a2) =>
		(dynCall_iii = Module['dynCall_iii'] = wasmExports['ec'])(a0, a1, a2));

	var dynCall_iiiii = (Module['dynCall_iiiii'] = (a0, a1, a2, a3, a4) =>
		(dynCall_iiiii = Module['dynCall_iiiii'] = wasmExports['fc'])(
			a0,
			a1,
			a2,
			a3,
			a4
		));

	var dynCall_iiiiii = (Module['dynCall_iiiiii'] = (a0, a1, a2, a3, a4, a5) =>
		(dynCall_iiiiii = Module['dynCall_iiiiii'] = wasmExports['gc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5
		));

	var dynCall_viii = (Module['dynCall_viii'] = (a0, a1, a2, a3) =>
		(dynCall_viii = Module['dynCall_viii'] = wasmExports['hc'])(
			a0,
			a1,
			a2,
			a3
		));

	var dynCall_iij = (Module['dynCall_iij'] = (a0, a1, a2) =>
		(dynCall_iij = Module['dynCall_iij'] = wasmExports['ic'])(a0, a1, a2));

	var dynCall_v = (Module['dynCall_v'] = (a0) =>
		(dynCall_v = Module['dynCall_v'] = wasmExports['jc'])(a0));

	var dynCall_i = (Module['dynCall_i'] = (a0) =>
		(dynCall_i = Module['dynCall_i'] = wasmExports['kc'])(a0));

	var dynCall_viiii = (Module['dynCall_viiii'] = (a0, a1, a2, a3, a4) =>
		(dynCall_viiii = Module['dynCall_viiii'] = wasmExports['lc'])(
			a0,
			a1,
			a2,
			a3,
			a4
		));

	var dynCall_iiiiiii = (Module['dynCall_iiiiiii'] = (
		a0,
		a1,
		a2,
		a3,
		a4,
		a5,
		a6
	) =>
		(dynCall_iiiiiii = Module['dynCall_iiiiiii'] = wasmExports['mc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5,
			a6
		));

	var dynCall_iijii = (Module['dynCall_iijii'] = (a0, a1, a2, a3, a4) =>
		(dynCall_iijii = Module['dynCall_iijii'] = wasmExports['nc'])(
			a0,
			a1,
			a2,
			a3,
			a4
		));

	var dynCall_jii = (Module['dynCall_jii'] = (a0, a1, a2) =>
		(dynCall_jii = Module['dynCall_jii'] = wasmExports['oc'])(a0, a1, a2));

	var dynCall_jiii = (Module['dynCall_jiii'] = (a0, a1, a2, a3) =>
		(dynCall_jiii = Module['dynCall_jiii'] = wasmExports['pc'])(
			a0,
			a1,
			a2,
			a3
		));

	var dynCall_viiiiiiiii = (Module['dynCall_viiiiiiiii'] = (
		a0,
		a1,
		a2,
		a3,
		a4,
		a5,
		a6,
		a7,
		a8,
		a9
	) =>
		(dynCall_viiiiiiiii = Module['dynCall_viiiiiiiii'] = wasmExports['qc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5,
			a6,
			a7,
			a8,
			a9
		));

	var dynCall_viiiiiii = (Module['dynCall_viiiiiii'] = (
		a0,
		a1,
		a2,
		a3,
		a4,
		a5,
		a6,
		a7
	) =>
		(dynCall_viiiiiii = Module['dynCall_viiiiiii'] = wasmExports['rc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5,
			a6,
			a7
		));

	var dynCall_iiiiiiii = (Module['dynCall_iiiiiiii'] = (
		a0,
		a1,
		a2,
		a3,
		a4,
		a5,
		a6,
		a7
	) =>
		(dynCall_iiiiiiii = Module['dynCall_iiiiiiii'] = wasmExports['sc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5,
			a6,
			a7
		));

	var dynCall_iiiiiiiiii = (Module['dynCall_iiiiiiiiii'] = (
		a0,
		a1,
		a2,
		a3,
		a4,
		a5,
		a6,
		a7,
		a8,
		a9
	) =>
		(dynCall_iiiiiiiiii = Module['dynCall_iiiiiiiiii'] = wasmExports['tc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5,
			a6,
			a7,
			a8,
			a9
		));

	var dynCall_iiji = (Module['dynCall_iiji'] = (a0, a1, a2, a3) =>
		(dynCall_iiji = Module['dynCall_iiji'] = wasmExports['uc'])(
			a0,
			a1,
			a2,
			a3
		));

	var dynCall_viijii = (Module['dynCall_viijii'] = (a0, a1, a2, a3, a4, a5) =>
		(dynCall_viijii = Module['dynCall_viijii'] = wasmExports['vc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5
		));

	var dynCall_iijiji = (Module['dynCall_iijiji'] = (a0, a1, a2, a3, a4, a5) =>
		(dynCall_iijiji = Module['dynCall_iijiji'] = wasmExports['wc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5
		));

	var dynCall_vji = (Module['dynCall_vji'] = (a0, a1, a2) =>
		(dynCall_vji = Module['dynCall_vji'] = wasmExports['xc'])(a0, a1, a2));

	var dynCall_viidii = (Module['dynCall_viidii'] = (a0, a1, a2, a3, a4, a5) =>
		(dynCall_viidii = Module['dynCall_viidii'] = wasmExports['yc'])(
			a0,
			a1,
			a2,
			a3,
			a4,
			a5
		));

	var _asyncify_start_unwind = (a0) =>
		(_asyncify_start_unwind = wasmExports['zc'])(a0);

	var _asyncify_stop_unwind = () =>
		(_asyncify_stop_unwind = wasmExports['Ac'])();

	var _asyncify_start_rewind = (a0) =>
		(_asyncify_start_rewind = wasmExports['Bc'])(a0);

	var _asyncify_stop_rewind = () =>
		(_asyncify_stop_rewind = wasmExports['Cc'])();

	function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
		var sp = stackSave();
		try {
			return dynCall_iiiiiii(index, a1, a2, a3, a4, a5, a6);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_vi(index, a1) {
		var sp = stackSave();
		try {
			dynCall_vi(index, a1);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iiii(index, a1, a2, a3) {
		var sp = stackSave();
		try {
			return dynCall_iiii(index, a1, a2, a3);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iij(index, a1, a2) {
		var sp = stackSave();
		try {
			return dynCall_iij(index, a1, a2);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_vii(index, a1, a2) {
		var sp = stackSave();
		try {
			dynCall_vii(index, a1, a2);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_ii(index, a1) {
		var sp = stackSave();
		try {
			return dynCall_ii(index, a1);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_viii(index, a1, a2, a3) {
		var sp = stackSave();
		try {
			dynCall_viii(index, a1, a2, a3);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_v(index) {
		var sp = stackSave();
		try {
			dynCall_v(index);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iii(index, a1, a2) {
		var sp = stackSave();
		try {
			return dynCall_iii(index, a1, a2);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_i(index) {
		var sp = stackSave();
		try {
			return dynCall_i(index);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_viiii(index, a1, a2, a3, a4) {
		var sp = stackSave();
		try {
			dynCall_viiii(index, a1, a2, a3, a4);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_viiiii(index, a1, a2, a3, a4, a5) {
		var sp = stackSave();
		try {
			dynCall_viiiii(index, a1, a2, a3, a4, a5);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
		var sp = stackSave();
		try {
			return dynCall_iiiiii(index, a1, a2, a3, a4, a5);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iiiii(index, a1, a2, a3, a4) {
		var sp = stackSave();
		try {
			return dynCall_iiiii(index, a1, a2, a3, a4);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
		var sp = stackSave();
		try {
			return dynCall_iiiiiiiiii(
				index,
				a1,
				a2,
				a3,
				a4,
				a5,
				a6,
				a7,
				a8,
				a9
			);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_jii(index, a1, a2) {
		var sp = stackSave();
		try {
			return dynCall_jii(index, a1, a2);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
			return 0n;
		}
	}

	function invoke_vji(index, a1, a2) {
		var sp = stackSave();
		try {
			dynCall_vji(index, a1, a2);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_viijii(index, a1, a2, a3, a4, a5) {
		var sp = stackSave();
		try {
			dynCall_viijii(index, a1, a2, a3, a4, a5);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_viidii(index, a1, a2, a3, a4, a5) {
		var sp = stackSave();
		try {
			dynCall_viidii(index, a1, a2, a3, a4, a5);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_jiii(index, a1, a2, a3) {
		var sp = stackSave();
		try {
			return dynCall_jiii(index, a1, a2, a3);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
			return 0n;
		}
	}

	function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
		var sp = stackSave();
		try {
			dynCall_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iijii(index, a1, a2, a3, a4) {
		var sp = stackSave();
		try {
			return dynCall_iijii(index, a1, a2, a3, a4);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iijiji(index, a1, a2, a3, a4, a5) {
		var sp = stackSave();
		try {
			return dynCall_iijiji(index, a1, a2, a3, a4, a5);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
		var sp = stackSave();
		try {
			return dynCall_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_iiji(index, a1, a2, a3) {
		var sp = stackSave();
		try {
			return dynCall_iiji(index, a1, a2, a3);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
		var sp = stackSave();
		try {
			dynCall_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7);
		} catch (e) {
			stackRestore(sp);
			if (e !== e + 0) throw e;
			_setThrew(1, 0);
		}
	}

	// include: postamble.js
	// === Auto-generated postamble setup entry stuff ===
	Module['addRunDependency'] = addRunDependency;

	Module['removeRunDependency'] = removeRunDependency;

	Module['wasmExports'] = wasmExports;

	Module['ccall'] = ccall;

	Module['FS_createPreloadedFile'] = FS_createPreloadedFile;

	Module['FS_unlink'] = FS_unlink;

	Module['FS_createPath'] = FS_createPath;

	Module['FS_createDevice'] = FS_createDevice;

	Module['FS_createDataFile'] = FS_createDataFile;

	Module['FS_createLazyFile'] = FS_createLazyFile;

	Module['PROXYFS'] = PROXYFS;

	function run() {
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
		function doRun() {
			// run may have just been called through dependencies being fulfilled just in this very frame,
			// or while the async setStatus time below was happening
			Module['calledRun'] = true;
			if (ABORT) return;
			initRuntime();
			Module['onRuntimeInitialized']?.();
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

	if (typeof NODEFS === 'object') {
		// We override NODEFS.createNode() to add an `isSharedFS` flag to all NODEFS
		// nodes. This way we can tell whether file-locking is needed and possible
		// for an FS node, even if wrapped with PROXYFS.
		const originalCreateNode = NODEFS.createNode;
		NODEFS.createNode = function createNodeWithSharedFlag() {
			const node = originalCreateNode.apply(NODEFS, arguments);
			node.isSharedFS = true;
			return node;
		};

		var originalHashAddNode = FS.hashAddNode;
		FS.hashAddNode = function hashAddNodeIfNotSharedFS(node) {
			if (
				typeof locking === 'object' &&
				locking?.is_shared_fs_node(node)
			) {
				// Avoid caching shared VFS nodes so multiple instances
				// can access the same underlying filesystem without
				// conflicting caches.
				return;
			}
			return originalHashAddNode.apply(FS, arguments);
		};
	}

	return PHPLoader;

	// Close the opening bracket from esm-prefix.js:
}
