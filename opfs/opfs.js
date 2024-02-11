// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
	throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE =
	typeof process == 'object' &&
	typeof process.versions == 'object' &&
	typeof process.versions.node == 'string';
var ENVIRONMENT_IS_SHELL =
	!ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
	throw new Error(
		'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)'
	);
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
var read_, readAsync, readBinary, setWindowTitle;

if (ENVIRONMENT_IS_NODE) {
	if (
		typeof process == 'undefined' ||
		!process.release ||
		process.release.name !== 'node'
	)
		throw new Error(
			'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
		);

	var nodeVersion = process.versions.node;
	var numericVersion = nodeVersion.split('.').slice(0, 3);
	numericVersion =
		numericVersion[0] * 10000 +
		numericVersion[1] * 100 +
		numericVersion[2].split('-')[0] * 1;
	var minVersion = 160000;
	if (numericVersion < 160000) {
		throw new Error(
			'This emscripten-generated code requires node v16.0.0 (detected v' +
				nodeVersion +
				')'
		);
	}

	// `require()` is no-op in an ESM module, use `createRequire()` to construct
	// the require()` function.  This is only necessary for multi-environment
	// builds, `-sENVIRONMENT=node` emits a static import declaration instead.
	// TODO: Swap all `require()`'s with `import()`'s?
	// These modules will usually be used on Node.js. Load them eagerly to avoid
	// the complexity of lazy-loading.
	var fs = require('fs');
	var nodePath = require('path');

	if (ENVIRONMENT_IS_WORKER) {
		scriptDirectory = nodePath.dirname(scriptDirectory) + '/';
	} else {
		scriptDirectory = __dirname + '/';
	}

	// include: node_shell_read.js
	read_ = (filename, binary) => {
		// We need to re-wrap `file://` strings to URLs. Normalizing isn't
		// necessary in that case, the path should already be absolute.
		filename = isFileURI(filename)
			? new URL(filename)
			: nodePath.normalize(filename);
		return fs.readFileSync(filename, binary ? undefined : 'utf8');
	};

	readBinary = (filename) => {
		var ret = read_(filename, true);
		if (!ret.buffer) {
			ret = new Uint8Array(ret);
		}
		assert(ret.buffer);
		return ret;
	};

	readAsync = (filename, onload, onerror, binary = true) => {
		// See the comment in the `read_` function.
		filename = isFileURI(filename)
			? new URL(filename)
			: nodePath.normalize(filename);
		fs.readFile(filename, binary ? undefined : 'utf8', (err, data) => {
			if (err) onerror(err);
			else onload(binary ? data.buffer : data);
		});
	};
	// end include: node_shell_read.js
	if (!Module['thisProgram'] && process.argv.length > 1) {
		thisProgram = process.argv[1].replace(/\\/g, '/');
	}

	arguments_ = process.argv.slice(2);

	if (typeof module != 'undefined') {
		module['exports'] = Module;
	}

	process.on('uncaughtException', (ex) => {
		// suppress ExitStatus exceptions from showing an error
		if (
			ex !== 'unwind' &&
			!(ex instanceof ExitStatus) &&
			!(ex.context instanceof ExitStatus)
		) {
			throw ex;
		}
	});

	quit_ = (status, toThrow) => {
		process.exitCode = status;
		throw toThrow;
	};

	Module['inspect'] = () => '[Emscripten Module object]';
} else if (ENVIRONMENT_IS_SHELL) {
	if (
		(typeof process == 'object' && typeof require === 'function') ||
		typeof window == 'object' ||
		typeof importScripts == 'function'
	)
		throw new Error(
			'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
		);

	if (typeof read != 'undefined') {
		read_ = (f) => {
			return read(f);
		};
	}

	readBinary = (f) => {
		let data;
		if (typeof readbuffer == 'function') {
			return new Uint8Array(readbuffer(f));
		}
		data = read(f, 'binary');
		assert(typeof data == 'object');
		return data;
	};

	readAsync = (f, onload, onerror) => {
		setTimeout(() => onload(readBinary(f)));
	};

	if (typeof clearTimeout == 'undefined') {
		globalThis.clearTimeout = (id) => {};
	}

	if (typeof setTimeout == 'undefined') {
		// spidermonkey lacks setTimeout but we use it above in readAsync.
		globalThis.setTimeout = (f) => (typeof f == 'function' ? f() : abort());
	}

	if (typeof scriptArgs != 'undefined') {
		arguments_ = scriptArgs;
	} else if (typeof arguments != 'undefined') {
		arguments_ = arguments;
	}

	if (typeof quit == 'function') {
		quit_ = (status, toThrow) => {
			// Unlike node which has process.exitCode, d8 has no such mechanism. So we
			// have no way to set the exit code and then let the program exit with
			// that code when it naturally stops running (say, when all setTimeouts
			// have completed). For that reason, we must call `quit` - the only way to
			// set the exit code - but quit also halts immediately.  To increase
			// consistency with node (and the web) we schedule the actual quit call
			// using a setTimeout to give the current stack and any exception handlers
			// a chance to run.  This enables features such as addOnPostRun (which
			// expected to be able to run code after main returns).
			setTimeout(() => {
				if (!(toThrow instanceof ExitStatus)) {
					let toLog = toThrow;
					if (
						toThrow &&
						typeof toThrow == 'object' &&
						toThrow.stack
					) {
						toLog = [toThrow, toThrow.stack];
					}
					err(`exiting due to exception: ${toLog}`);
				}
				quit(status);
			});
			throw toThrow;
		};
	}

	if (typeof print != 'undefined') {
		// Prefer to use print/printErr where they exist, as they usually work better.
		if (typeof console == 'undefined')
			console = /** @type{!Console} */ ({});
		console.log = /** @type{!function(this:Console, ...*): undefined} */ (
			print
		);
		console.warn = console.error =
			/** @type{!function(this:Console, ...*): undefined} */ (
				typeof printErr != 'undefined' ? printErr : print
			);
	}
}

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
	if (ENVIRONMENT_IS_WORKER) {
		// Check worker, not web, since window could be polyfilled
		scriptDirectory = self.location.href;
	} else if (typeof document != 'undefined' && document.currentScript) {
		// web
		scriptDirectory = document.currentScript.src;
	}
	// blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
	// otherwise, slice off the final part of the url to find the script directory.
	// if scriptDirectory does not contain a slash, lastIndexOf will return -1,
	// and scriptDirectory will correctly be replaced with an empty string.
	// If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
	// they are removed because they could contain a slash.
	if (scriptDirectory.indexOf('blob:') !== 0) {
		scriptDirectory = scriptDirectory.substr(
			0,
			scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1
		);
	} else {
		scriptDirectory = '';
	}

	if (!(typeof window == 'object' || typeof importScripts == 'function'))
		throw new Error(
			'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
		);

	// Differentiate the Web Worker from the Node Worker case, as reading must
	// be done differently.
	{
		// include: web_or_worker_shell_read.js
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
				return new Uint8Array(
					/** @type{!ArrayBuffer} */ (xhr.response)
				);
			};
		}

		readAsync = (url, onload, onerror) => {
			var xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			xhr.responseType = 'arraybuffer';
			xhr.onload = () => {
				if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
					// file URLs can return 0
					onload(xhr.response);
					return;
				}
				onerror();
			};
			xhr.onerror = onerror;
			xhr.send(null);
		};

		// end include: web_or_worker_shell_read.js
	}

	setWindowTitle = (title) => (document.title = title);
} else {
	throw new Error('environment detection error');
}

var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.error.bind(console);

// Merge back in the overrides
Object.assign(Module, moduleOverrides);
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;
checkIncomingModuleAPI();

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];
legacyModuleProp('arguments', 'arguments_');

if (Module['thisProgram']) thisProgram = Module['thisProgram'];
legacyModuleProp('thisProgram', 'thisProgram');

if (Module['quit']) quit_ = Module['quit'];
legacyModuleProp('quit', 'quit_');

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(
	typeof Module['memoryInitializerPrefixURL'] == 'undefined',
	'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead'
);
assert(
	typeof Module['pthreadMainPrefixURL'] == 'undefined',
	'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead'
);
assert(
	typeof Module['cdInitializerPrefixURL'] == 'undefined',
	'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead'
);
assert(
	typeof Module['filePackagePrefixURL'] == 'undefined',
	'Module.filePackagePrefixURL option was removed, use Module.locateFile instead'
);
assert(
	typeof Module['read'] == 'undefined',
	'Module.read option was removed (modify read_ in JS)'
);
assert(
	typeof Module['readAsync'] == 'undefined',
	'Module.readAsync option was removed (modify readAsync in JS)'
);
assert(
	typeof Module['readBinary'] == 'undefined',
	'Module.readBinary option was removed (modify readBinary in JS)'
);
assert(
	typeof Module['setWindowTitle'] == 'undefined',
	'Module.setWindowTitle option was removed (modify setWindowTitle in JS)'
);
assert(
	typeof Module['TOTAL_MEMORY'] == 'undefined',
	'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY'
);
legacyModuleProp('read', 'read_');
legacyModuleProp('readAsync', 'readAsync');
legacyModuleProp('readBinary', 'readBinary');
legacyModuleProp('setWindowTitle', 'setWindowTitle');
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS =
	'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS =
	'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

assert(
	!ENVIRONMENT_IS_SHELL,
	"shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable."
);

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

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
legacyModuleProp('wasmBinary', 'wasmBinary');
var noExitRuntime = Module['noExitRuntime'] || true;
legacyModuleProp('noExitRuntime', 'noExitRuntime');

if (typeof WebAssembly != 'object') {
	abort('no native wasm support detected');
}

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

/** @type {function(*, string=)} */
function assert(condition, text) {
	if (!condition) {
		abort('Assertion failed' + (text ? ': ' + text : ''));
	}
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

// Memory management

var HEAP,
	/** @type {!Int8Array} */
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

function updateMemoryViews() {
	var b = wasmMemory.buffer;
	Module['HEAP8'] = HEAP8 = new Int8Array(b);
	Module['HEAP16'] = HEAP16 = new Int16Array(b);
	Module['HEAP32'] = HEAP32 = new Int32Array(b);
	Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
	Module['HEAPU16'] = HEAPU16 = new Uint16Array(b);
	Module['HEAPU32'] = HEAPU32 = new Uint32Array(b);
	Module['HEAPF32'] = HEAPF32 = new Float32Array(b);
	Module['HEAPF64'] = HEAPF64 = new Float64Array(b);
}

assert(
	!Module['STACK_SIZE'],
	'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time'
);

assert(
	typeof Int32Array != 'undefined' &&
		typeof Float64Array !== 'undefined' &&
		Int32Array.prototype.subarray != undefined &&
		Int32Array.prototype.set != undefined,
	'JS engine does not provide full typed array support'
);

// If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
assert(
	!Module['wasmMemory'],
	'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally'
);
assert(
	!Module['INITIAL_MEMORY'],
	'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically'
);

// include: runtime_init_table.js
// In regular non-RELOCATABLE mode the table is exported
// from the wasm module and this will be assigned once
// the exports are available.
var wasmTable;
// end include: runtime_init_table.js
// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
	var max = _emscripten_stack_get_end();
	assert((max & 3) == 0);
	// If the stack ends at address zero we write our cookies 4 bytes into the
	// stack.  This prevents interference with SAFE_HEAP and ASAN which also
	// monitor writes to address zero.
	if (max == 0) {
		max += 4;
	}
	// The stack grow downwards towards _emscripten_stack_get_end.
	// We write cookies to the final two words in the stack and detect if they are
	// ever overwritten.
	HEAPU32[max >> 2] = 0x02135467;
	HEAPU32[(max + 4) >> 2] = 0x89bacdfe;
	// Also test the global address 0 for integrity.
	HEAPU32[0 >> 2] = 1668509029;
}

function checkStackCookie() {
	if (ABORT) return;
	var max = _emscripten_stack_get_end();
	// See writeStackCookie().
	if (max == 0) {
		max += 4;
	}
	var cookie1 = HEAPU32[max >> 2];
	var cookie2 = HEAPU32[(max + 4) >> 2];
	if (cookie1 != 0x02135467 || cookie2 != 0x89bacdfe) {
		abort(
			`Stack overflow! Stack cookie has been overwritten at ${ptrToString(
				max
			)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(
				cookie2
			)} ${ptrToString(cookie1)}`
		);
	}
	// Also test the global address 0 for integrity.
	if (HEAPU32[0 >> 2] != 0x63736d65 /* 'emsc' */) {
		abort(
			'Runtime error: The application has corrupted its heap memory area (address zero)!'
		);
	}
}
// end include: runtime_stack_check.js
// include: runtime_assertions.js
// Endianness check
(function () {
	var h16 = new Int16Array(1);
	var h8 = new Int8Array(h16.buffer);
	h16[0] = 0x6373;
	if (h8[0] !== 0x73 || h8[1] !== 0x63)
		throw 'Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__ = []; // functions called before the runtime is initialized
var __ATINIT__ = []; // functions called during startup
var __ATMAIN__ = []; // functions called when main() is to be run
var __ATEXIT__ = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;

var runtimeKeepaliveCounter = 0;

function keepRuntimeAlive() {
	return noExitRuntime || runtimeKeepaliveCounter > 0;
}

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
	assert(!runtimeInitialized);
	runtimeInitialized = true;

	checkStackCookie();

	callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
	checkStackCookie();

	callRuntimeCallbacks(__ATMAIN__);
}

function postRun() {
	checkStackCookie();

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

function addOnPreMain(cb) {
	__ATMAIN__.unshift(cb);
}

function addOnExit(cb) {}

function addOnPostRun(cb) {
	__ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(
	Math.imul,
	'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
	Math.fround,
	'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
	Math.clz32,
	'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
	Math.trunc,
	'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
	var orig = id;
	while (1) {
		if (!runDependencyTracking[id]) return id;
		id = orig + Math.random();
	}
}

function addRunDependency(id) {
	runDependencies++;

	if (Module['monitorRunDependencies']) {
		Module['monitorRunDependencies'](runDependencies);
	}

	if (id) {
		assert(!runDependencyTracking[id]);
		runDependencyTracking[id] = 1;
		if (
			runDependencyWatcher === null &&
			typeof setInterval != 'undefined'
		) {
			// Check for missing dependencies every few seconds
			runDependencyWatcher = setInterval(() => {
				if (ABORT) {
					clearInterval(runDependencyWatcher);
					runDependencyWatcher = null;
					return;
				}
				var shown = false;
				for (var dep in runDependencyTracking) {
					if (!shown) {
						shown = true;
						err('still waiting on run dependencies:');
					}
					err('dependency: ' + dep);
				}
				if (shown) {
					err('(end of list)');
				}
			}, 10000);
		}
	} else {
		err('warning: run dependency added without ID');
	}
}

function removeRunDependency(id) {
	runDependencies--;

	if (Module['monitorRunDependencies']) {
		Module['monitorRunDependencies'](runDependencies);
	}

	if (id) {
		assert(runDependencyTracking[id]);
		delete runDependencyTracking[id];
	} else {
		err('warning: run dependency removed without ID');
	}
	if (runDependencies == 0) {
		if (runDependencyWatcher !== null) {
			clearInterval(runDependencyWatcher);
			runDependencyWatcher = null;
		}
		if (dependenciesFulfilled) {
			var callback = dependenciesFulfilled;
			dependenciesFulfilled = null;
			callback(); // can add another dependenciesFulfilled
		}
	}
}

/** @param {string|number=} what */
function abort(what) {
	if (Module['onAbort']) {
		Module['onAbort'](what);
	}

	what = 'Aborted(' + what + ')';
	// TODO(sbc): Should we remove printing and leave it up to whoever
	// catches the exception?
	err(what);

	ABORT = true;
	EXITSTATUS = 1;

	if (what.indexOf('RuntimeError: unreachable') >= 0) {
		what +=
			'. "unreachable" may be due to ASYNCIFY_STACK_SIZE not being large enough (try increasing it)';
	}

	// Use a wasm runtime error, because a JS error might be seen as a foreign
	// exception, which means we'd run destructors on it. We need the error to
	// simply make the program stop.
	// FIXME This approach does not work in Wasm EH because it currently does not assume
	// all RuntimeErrors are from traps; it decides whether a RuntimeError is from
	// a trap or not based on a hidden field within the object. So at the moment
	// we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
	// allows this in the wasm spec.

	// Suppress closure compiler warning here. Closure compiler's builtin extern
	// defintion for WebAssembly.RuntimeError claims it takes no arguments even
	// though it can.
	// TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
	/** @suppress {checkTypes} */
	var e = new WebAssembly.RuntimeError(what);

	// Throw the error whether or not MODULARIZE is set because abort is used
	// in code paths apart from instantiation where an exception is expected
	// to be thrown when abort is called.
	throw e;
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
	// Prefix of data URIs emitted by SINGLE_FILE and related options.
	return filename.startsWith(dataURIPrefix);
}

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
	return filename.startsWith('file://');
}
// end include: URIUtils.js
/** @param {boolean=} fixedasm */
function createExportWrapper(name, fixedasm) {
	return function () {
		var displayName = name;
		var asm = fixedasm;
		if (!fixedasm) {
			asm = Module['asm'];
		}
		assert(
			runtimeInitialized,
			'native function `' +
				displayName +
				'` called before runtime initialization'
		);
		if (!asm[name]) {
			assert(
				asm[name],
				'exported native function `' + displayName + '` not found'
			);
		}
		return asm[name].apply(null, arguments);
	};
}

// include: runtime_exceptions.js
// end include: runtime_exceptions.js
var wasmBinaryFile;
wasmBinaryFile = 'opfs.wasm';
if (!isDataURI(wasmBinaryFile)) {
	wasmBinaryFile = locateFile(wasmBinaryFile);
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

function getBinaryPromise(binaryFile) {
	// If we don't have the binary yet, try to load it asynchronously.
	// Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
	// See https://github.com/github/fetch/pull/92#issuecomment-140665932
	// Cordova or Electron apps are typically loaded from a file:// url.
	// So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
	if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
		if (typeof fetch == 'function' && !isFileURI(binaryFile)) {
			return fetch(binaryFile, { credentials: 'same-origin' })
				.then((response) => {
					if (!response['ok']) {
						throw (
							"failed to load wasm binary file at '" +
							binaryFile +
							"'"
						);
					}
					return response['arrayBuffer']();
				})
				.catch(() => getBinarySync(binaryFile));
		} else if (readAsync) {
			// fetch is not available or url is file => try XHR (readAsync uses XHR internally)
			return new Promise((resolve, reject) => {
				readAsync(
					binaryFile,
					(response) =>
						resolve(
							new Uint8Array(
								/** @type{!ArrayBuffer} */ (response)
							)
						),
					reject
				);
			});
		}
	}

	// Otherwise, getBinarySync should be able to get it synchronously
	return Promise.resolve().then(() => getBinarySync(binaryFile));
}

function instantiateArrayBuffer(binaryFile, imports, receiver) {
	return getBinaryPromise(binaryFile)
		.then((binary) => {
			return WebAssembly.instantiate(binary, imports);
		})
		.then((instance) => {
			return instance;
		})
		.then(receiver, (reason) => {
			err('failed to asynchronously prepare wasm: ' + reason);

			// Warn on some common problems.
			if (isFileURI(wasmBinaryFile)) {
				err(
					'warning: Loading from a file URI (' +
						wasmBinaryFile +
						') is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing'
				);
			}
			abort(reason);
		});
}

function instantiateAsync(binary, binaryFile, imports, callback) {
	if (
		!binary &&
		typeof WebAssembly.instantiateStreaming == 'function' &&
		!isDataURI(binaryFile) &&
		// Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
		!isFileURI(binaryFile) &&
		// Avoid instantiateStreaming() on Node.js environment for now, as while
		// Node.js v18.1.0 implements it, it does not have a full fetch()
		// implementation yet.
		//
		// Reference:
		//   https://github.com/emscripten-core/emscripten/pull/16917
		!ENVIRONMENT_IS_NODE &&
		typeof fetch == 'function'
	) {
		return fetch(binaryFile, { credentials: 'same-origin' }).then(
			(response) => {
				// Suppress closure warning here since the upstream definition for
				// instantiateStreaming only allows Promise<Repsponse> rather than
				// an actual Response.
				// TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure is fixed.
				/** @suppress {checkTypes} */
				var result = WebAssembly.instantiateStreaming(
					response,
					imports
				);

				return result.then(callback, function (reason) {
					// We expect the most common failure cause to be a bad MIME type for the binary,
					// in which case falling back to ArrayBuffer instantiation should work.
					err('wasm streaming compile failed: ' + reason);
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

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
	// prepare imports
	var info = {
		env: wasmImports,
		wasi_snapshot_preview1: wasmImports,
	};
	// Load the wasm module and create an instance of using native support in the JS engine.
	// handle a generated wasm instance, receiving its exports and
	// performing other necessary setup
	/** @param {WebAssembly.Module=} module*/
	function receiveInstance(instance, module) {
		var exports = instance.exports;

		exports = Asyncify.instrumentWasmExports(exports);

		Module['asm'] = exports;

		wasmMemory = Module['asm']['memory'];
		assert(wasmMemory, 'memory not found in wasm exports');
		// This assertion doesn't hold when emscripten is run in --post-link
		// mode.
		// TODO(sbc): Read INITIAL_MEMORY out of the wasm file in post-link mode.
		//assert(wasmMemory.buffer.byteLength === 16777216);
		updateMemoryViews();

		wasmTable = Module['asm']['__indirect_function_table'];
		assert(wasmTable, 'table not found in wasm exports');

		addOnInit(Module['asm']['__wasm_call_ctors']);

		removeRunDependency('wasm-instantiate');
		return exports;
	}
	// wait for the pthread pool (if any)
	addRunDependency('wasm-instantiate');

	// Prefer streaming instantiation if available.
	// Async compilation can be confusing when an error on the page overwrites Module
	// (for example, if the order of elements is wrong, and the one defining Module is
	// later), so we save Module and check it later.
	var trueModule = Module;
	function receiveInstantiationResult(result) {
		// 'result' is a ResultObject object which has both the module and instance.
		// receiveInstance() will swap in the exports (to Module.asm) so they can be called
		assert(
			Module === trueModule,
			'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?'
		);
		trueModule = null;
		// TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
		// When the regression is fixed, can restore the above PTHREADS-enabled path.
		receiveInstance(result['instance']);
	}

	// User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
	// to manually instantiate the Wasm module themselves. This allows pages to
	// run the instantiation parallel to any other async startup actions they are
	// performing.
	// Also pthreads and wasm workers initialize the wasm instance through this
	// path.
	if (Module['instantiateWasm']) {
		try {
			return Module['instantiateWasm'](info, receiveInstance);
		} catch (e) {
			err('Module.instantiateWasm callback failed with error: ' + e);
			return false;
		}
	}

	instantiateAsync(
		wasmBinary,
		wasmBinaryFile,
		info,
		receiveInstantiationResult
	);
	return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// include: runtime_debug.js
function legacyModuleProp(prop, newName) {
	if (!Object.getOwnPropertyDescriptor(Module, prop)) {
		Object.defineProperty(Module, prop, {
			configurable: true,
			get() {
				abort(
					'Module.' +
						prop +
						' has been replaced with plain ' +
						newName +
						' (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)'
				);
			},
		});
	}
}

function ignoredModuleProp(prop) {
	if (Object.getOwnPropertyDescriptor(Module, prop)) {
		abort(
			'`Module.' +
				prop +
				'` was supplied but `' +
				prop +
				'` not included in INCOMING_MODULE_JS_API'
		);
	}
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
	return (
		name === 'FS_createPath' ||
		name === 'FS_createDataFile' ||
		name === 'FS_createPreloadedFile' ||
		name === 'FS_unlink' ||
		name === 'addRunDependency' ||
		name === 'removeRunDependency'
	);
}

function missingGlobal(sym, msg) {
	if (typeof globalThis !== 'undefined') {
		Object.defineProperty(globalThis, sym, {
			configurable: true,
			get() {
				warnOnce(
					'`' + sym + '` is not longer defined by emscripten. ' + msg
				);
				return undefined;
			},
		});
	}
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer');

function missingLibrarySymbol(sym) {
	if (
		typeof globalThis !== 'undefined' &&
		!Object.getOwnPropertyDescriptor(globalThis, sym)
	) {
		Object.defineProperty(globalThis, sym, {
			configurable: true,
			get() {
				// Can't `abort()` here because it would break code that does runtime
				// checks.  e.g. `if (typeof SDL === 'undefined')`.
				var msg =
					'`' +
					sym +
					'` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line';
				// DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
				// library.js, which means $name for a JS name with no prefix, or name
				// for a JS name like _name.
				var librarySymbol = sym;
				if (!librarySymbol.startsWith('_')) {
					librarySymbol = '$' + sym;
				}
				msg +=
					" (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='" +
					librarySymbol +
					"')";
				if (isExportedByForceFilesystem(sym)) {
					msg +=
						'. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
				}
				warnOnce(msg);
				return undefined;
			},
		});
	}
	// Any symbol that is not included from the JS libary is also (by definition)
	// not exported on the Module object.
	unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
	if (!Object.getOwnPropertyDescriptor(Module, sym)) {
		Object.defineProperty(Module, sym, {
			configurable: true,
			get() {
				var msg =
					"'" +
					sym +
					"' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)";
				if (isExportedByForceFilesystem(sym)) {
					msg +=
						'. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
				}
				abort(msg);
			},
		});
	}
}

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(text) {
	// TODO(sbc): Make this configurable somehow.  Its not always convenient for
	// logging to show up as warnings.
	console.warn.apply(console, arguments);
}
// end include: runtime_debug.js
// === Body ===

// end include: preamble.js

/** @constructor */
function ExitStatus(status) {
	this.name = 'ExitStatus';
	this.message = `Program terminated with exit(${status})`;
	this.status = status;
}

var callRuntimeCallbacks = (callbacks) => {
	while (callbacks.length > 0) {
		// Pass the module as the first argument.
		callbacks.shift()(Module);
	}
};

/**
 * @param {number} ptr
 * @param {string} type
 */
function getValue(ptr, type = 'i8') {
	if (type.endsWith('*')) type = '*';
	switch (type) {
		case 'i1':
			return HEAP8[ptr >> 0];
		case 'i8':
			return HEAP8[ptr >> 0];
		case 'i16':
			return HEAP16[ptr >> 1];
		case 'i32':
			return HEAP32[ptr >> 2];
		case 'i64':
			abort('to do getValue(i64) use WASM_BIGINT');
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

var ptrToString = (ptr) => {
	assert(typeof ptr === 'number');
	// With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
	ptr >>>= 0;
	return '0x' + ptr.toString(16).padStart(8, '0');
};

/**
 * @param {number} ptr
 * @param {number} value
 * @param {string} type
 */
function setValue(ptr, value, type = 'i8') {
	if (type.endsWith('*')) type = '*';
	switch (type) {
		case 'i1':
			HEAP8[ptr >> 0] = value;
			break;
		case 'i8':
			HEAP8[ptr >> 0] = value;
			break;
		case 'i16':
			HEAP16[ptr >> 1] = value;
			break;
		case 'i32':
			HEAP32[ptr >> 2] = value;
			break;
		case 'i64':
			abort('to do setValue(i64) use WASM_BIGINT');
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

var warnOnce = (text) => {
	if (!warnOnce.shown) warnOnce.shown = {};
	if (!warnOnce.shown[text]) {
		warnOnce.shown[text] = 1;
		if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
		err(text);
	}
};

var UTF8Decoder =
	typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
 * array that contains uint8 values, returns a copy of that string as a
 * Javascript String object.
 * heapOrArray is either a regular array, or a JavaScript typed array view.
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
	var endIdx = idx + maxBytesToRead;
	var endPtr = idx;
	// TextDecoder needs to know the byte length in advance, it doesn't stop on
	// null terminator by itself.  Also, use the length info to avoid running tiny
	// strings through TextDecoder, since .subarray() allocates garbage.
	// (As a tiny code save trick, compare endPtr against endIdx using a negation,
	// so that undefined means Infinity)
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
			if ((u0 & 0xf8) != 0xf0)
				warnOnce(
					'Invalid UTF-8 leading byte ' +
						ptrToString(u0) +
						' encountered when deserializing a UTF-8 string in wasm memory to a JS string!'
				);
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
 */
var UTF8ToString = (ptr, maxBytesToRead) => {
	assert(typeof ptr == 'number');
	return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
};
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

var nowIsMonotonic = true;
var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;

function __wasmfs_copy_preloaded_file_data(index, buffer) {
	HEAPU8.set(wasmFSPreloadedFiles[index].fileData, buffer);
}

var wasmFSPreloadedDirs = [];
function __wasmfs_get_num_preloaded_dirs() {
	return wasmFSPreloadedDirs.length;
}

var wasmFSPreloadedFiles = [];

var wasmFSPreloadingFlushed = false;
function __wasmfs_get_num_preloaded_files() {
	// When this method is called from WasmFS it means that we are about to
	// flush all the preloaded data, so mark that. (There is no call that
	// occurs at the end of that flushing, which would be more natural, but it
	// is fine to mark the flushing here as during the flushing itself no user
	// code can run, so nothing will check whether we have flushed or not.)
	wasmFSPreloadingFlushed = true;
	return wasmFSPreloadedFiles.length;
}

function __wasmfs_get_preloaded_child_path(index, childNameBuffer) {
	var s = wasmFSPreloadedDirs[index].childName;
	var len = lengthBytesUTF8(s) + 1;
	stringToUTF8(s, childNameBuffer, len);
}

function __wasmfs_get_preloaded_file_mode(index) {
	return wasmFSPreloadedFiles[index].mode;
}

function __wasmfs_get_preloaded_file_size(index) {
	return wasmFSPreloadedFiles[index].fileData.length;
}

function __wasmfs_get_preloaded_parent_path(index, parentPathBuffer) {
	var s = wasmFSPreloadedDirs[index].parentPath;
	var len = lengthBytesUTF8(s) + 1;
	stringToUTF8(s, parentPathBuffer, len);
}

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
	assert(typeof str === 'string');
	// Parameter maxBytesToWrite is not optional. Negative values, 0, null,
	// undefined and false each don't write out any bytes.
	if (!(maxBytesToWrite > 0)) return 0;

	var startIdx = outIdx;
	var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
	for (var i = 0; i < str.length; ++i) {
		// Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
		// unit, not a Unicode code point of the character! So decode
		// UTF16->UTF32->UTF8.
		// See http://unicode.org/faq/utf_bom.html#utf16-3
		// For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
		// and https://www.ietf.org/rfc/rfc2279.txt
		// and https://tools.ietf.org/html/rfc3629
		var u = str.charCodeAt(i); // possibly a lead surrogate
		if (u >= 0xd800 && u <= 0xdfff) {
			var u1 = str.charCodeAt(++i);
			u = (0x10000 + ((u & 0x3ff) << 10)) | (u1 & 0x3ff);
		}
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
			if (u > 0x10ffff)
				warnOnce(
					'Invalid Unicode code point ' +
						ptrToString(u) +
						' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).'
				);
			heap[outIdx++] = 0xf0 | (u >> 18);
			heap[outIdx++] = 0x80 | ((u >> 12) & 63);
			heap[outIdx++] = 0x80 | ((u >> 6) & 63);
			heap[outIdx++] = 0x80 | (u & 63);
		}
	}
	// Null-terminate the pointer to the buffer.
	heap[outIdx] = 0;
	return outIdx - startIdx;
};
var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
	assert(
		typeof maxBytesToWrite == 'number',
		'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
	);
	return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
};
function __wasmfs_get_preloaded_path_name(index, fileNameBuffer) {
	var s = wasmFSPreloadedFiles[index].pathName;
	var len = lengthBytesUTF8(s) + 1;
	stringToUTF8(s, fileNameBuffer, len);
}

function handleAllocatorInit() {
	Object.assign(
		HandleAllocator.prototype,
		/** @lends {HandleAllocator.prototype} */ {
			get(id) {
				assert(
					this.allocated[id] !== undefined,
					`invalid handle: ${id}`
				);
				return this.allocated[id];
			},
			has(id) {
				return this.allocated[id] !== undefined;
			},
			allocate(handle) {
				var id = this.freelist.pop() || this.allocated.length;
				this.allocated[id] = handle;
				return id;
			},
			free(id) {
				assert(this.allocated[id] !== undefined);
				// Set the slot to `undefined` rather than using `delete` here since
				// apparently arrays with holes in them can be less efficient.
				this.allocated[id] = undefined;
				this.freelist.push(id);
			},
		}
	);
}
/** @constructor */
function HandleAllocator() {
	// Reserve slot 0 so that 0 is always an invalid handle
	this.allocated = [undefined];
	this.freelist = [];
}
var wasmfsOPFSAccessHandles = new HandleAllocator();

function wasmfsOPFSProxyFinish(ctx) {
	// When using pthreads the proxy needs to know when the work is finished.
	// When used with JSPI the work will be executed in an async block so there
	// is no need to notify when done.
}
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
function __wasmfs_opfs_close_blob(blobID) {
	wasmfsOPFSBlobs.free(blobID);
}

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
function __wasmfs_opfs_free_directory(dirID) {
	wasmfsOPFSDirectoryHandles.free(dirID);
}

var wasmfsOPFSFileHandles = new HandleAllocator();
function __wasmfs_opfs_free_file(fileID) {
	wasmfsOPFSFileHandles.free(fileID);
}

async function wasmfsOPFSGetOrCreateFile(parent, name, create) {
	let parentHandle = wasmfsOPFSDirectoryHandles.get(parent);
	let fileHandle;
	try {
		fileHandle = await parentHandle.getFileHandle(name, { create: create });
	} catch (e) {
		if (e.name === 'NotFoundError') {
			return -20;
		}
		if (e.name === 'TypeMismatchError') {
			return -31;
		}
		err('unexpected error:', e, e.stack);
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
		err('unexpected error:', e, e.stack);
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

var withStackSave = (f) => {
	var stack = stackSave();
	var ret = f();
	stackRestore(stack);
	return ret;
};

var __wasmfs_opfs_get_entries = async function (
	ctx,
	dirID,
	entriesPtr,
	errPtr
) {
	let dirHandle = wasmfsOPFSDirectoryHandles.get(dirID);

	// TODO: Use 'for await' once Acorn supports that.
	try {
		let iter = dirHandle.entries();
		for (let entry; (entry = await iter.next()), !entry.done; ) {
			let [name, child] = entry.value;
			withStackSave(() => {
				let namePtr = stringToUTF8OnStack(name);
				let type = child.kind == 'file' ? 1 : 2;
				__wasmfs_opfs_record_entry(entriesPtr, namePtr, type);
			});
		}
	} catch {
		let err = -29;
		HEAP32[errPtr >> 2] = err;
	}
	wasmfsOPFSProxyFinish(ctx);
};
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
		+Math.abs(tempDouble) >= 1.0
			? tempDouble > 0.0
				? +Math.floor(tempDouble / 4294967296.0) >>> 0
				: ~~+Math.ceil(
						(tempDouble - +(~~tempDouble >>> 0)) / 4294967296.0
				  ) >>> 0
			: 0),
	]),
		(HEAP32[sizePtr >> 2] = tempI64[0]),
		(HEAP32[(sizePtr + 4) >> 2] = tempI64[1]);
	wasmfsOPFSProxyFinish(ctx);
}
__wasmfs_opfs_get_size_access.isAsync = true;

function __wasmfs_opfs_get_size_blob(blobID) {
	// This cannot fail.
	return wasmfsOPFSBlobs.get(blobID).size;
}

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
		+Math.abs(tempDouble) >= 1.0
			? tempDouble > 0.0
				? +Math.floor(tempDouble / 4294967296.0) >>> 0
				: ~~+Math.ceil(
						(tempDouble - +(~~tempDouble >>> 0)) / 4294967296.0
				  ) >>> 0
			: 0),
	]),
		(HEAP32[sizePtr >> 2] = tempI64[0]),
		(HEAP32[(sizePtr + 4) >> 2] = tempI64[1]);
	wasmfsOPFSProxyFinish(ctx);
}
__wasmfs_opfs_get_size_file.isAsync = true;

async function __wasmfs_opfs_init_root_directory(ctx) {
	// allocated.length starts off as 1 since 0 is a reserved handle
	if (wasmfsOPFSDirectoryHandles.allocated.length == 1) {
		// Closure compiler errors on this as it does not recognize the OPFS
		// API yet, it seems. Unfortunately an existing annotation for this is in
		// the closure compiler codebase, and cannot be overridden in user code
		// (it complains on a duplicate type annotation), so just suppress it.
		/** @suppress {checkTypes} */
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
	// This class implements the same interface as the sync version, but has
	// async reads and writes. Hopefully this will one day be implemented by the
	// platform so we can remove it.
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
		// The end position may be past the end of the file, but slice truncates
		// it.
		let slice = await file.slice(options.at, options.at + buffer.length);
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
function wasmfsOPFSCreateAsyncAccessHandle(fileHandle) {
	return new FileSystemAsyncAccessHandle(fileHandle);
}
async function __wasmfs_opfs_open_access(ctx, fileID, accessIDPtr) {
	let fileHandle = wasmfsOPFSFileHandles.get(fileID);
	let accessID;
	try {
		let accessHandle;
		accessHandle = await wasmfsOPFSCreateAsyncAccessHandle(fileHandle);
		accessID = wasmfsOPFSAccessHandles.allocate(accessHandle);
	} catch (e) {
		// TODO: Presumably only one of these will appear in the final API?
		if (
			e.name === 'InvalidStateError' ||
			e.name === 'NoModificationAllowedError'
		) {
			accessID = -2;
		} else {
			err('unexpected error:', e, e.stack);
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
			err('unexpected error:', e, e.stack);
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
		err('unexpected error:', e, e.stack);
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
		// TODO: Use ReadableStreamBYOBReader once
		// https://bugs.chromium.org/p/chromium/issues/detail?id=1189621 is
		// resolved.
		let buf = await slice.arrayBuffer();
		let data = new Uint8Array(buf);
		HEAPU8.set(data, bufPtr);
		nread += data.length;
	} catch (e) {
		if (e instanceof RangeError) {
			nread = -21;
		} else {
			err('unexpected error:', e, e.stack);
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

function convertI32PairToI53Checked(lo, hi) {
	assert(lo == lo >>> 0 || lo == (lo | 0)); // lo should either be a i32 or a u32
	assert(hi === (hi | 0)); // hi should be a i32
	return (hi + 0x200000) >>> 0 < 0x400001 - !!lo
		? (lo >>> 0) + hi * 4294967296
		: NaN;
}
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
		err('unexpected error:', e, e.stack);
		return -29;
	}
}
__wasmfs_opfs_write_access.isAsync = true;

var FS_stdin_getChar_buffer = [];

/** @type {function(string, boolean=, number=)} */
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
				bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, -1);
			} catch (e) {
				// Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
				// reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
				if (e.toString().includes('EOF')) bytesRead = 0;
				else throw e;
			}

			if (bytesRead > 0) {
				result = buf.slice(0, bytesRead).toString('utf-8');
			} else {
				result = null;
			}
		} else if (
			typeof window != 'undefined' &&
			typeof window.prompt == 'function'
		) {
			// Browser.
			result = window.prompt('Input: '); // returns null on cancel
			if (result !== null) {
				result += '\n';
			}
		} else if (typeof readline == 'function') {
			// Command line.
			result = readline();
			if (result !== null) {
				result += '\n';
			}
		}
		if (!result) {
			return null;
		}
		FS_stdin_getChar_buffer = intArrayFromString(result, true);
	}
	return FS_stdin_getChar_buffer.shift();
};
var __wasmfs_stdin_get_char = () => {
	// Return the read character, or -1 to indicate EOF.
	var c = FS_stdin_getChar();
	if (typeof c === 'number') {
		return c;
	}
	return -1;
};

var _abort = () => {
	abort('native code called abort()');
};

var _emscripten_console_error = (str) => {
	assert(typeof str == 'number');
	console.error(UTF8ToString(str));
};

var _emscripten_console_log = (str) => {
	assert(typeof str == 'number');
	console.log(UTF8ToString(str));
};

function _emscripten_date_now() {
	return Date.now();
}

var _emscripten_err = (str) => err(UTF8ToString(str));

var _emscripten_get_now;
// Modern environment where performance.now() is supported:
// N.B. a shorter form "_emscripten_get_now = performance.now;" is
// unfortunately not allowed even in current browsers (e.g. FF Nightly 75).
_emscripten_get_now = () => performance.now();
var _emscripten_has_asyncify = () => 1;

function _emscripten_is_main_browser_thread() {
	return !ENVIRONMENT_IS_WORKER;
}

var _emscripten_memcpy_big = (dest, src, num) =>
	HEAPU8.copyWithin(dest, src, src + num);

var _emscripten_out = (str) => out(UTF8ToString(str));

var getHeapMax = () => HEAPU8.length;

var abortOnCannotGrowMemory = (requestedSize) => {
	abort(
		`Cannot enlarge memory arrays to size ${requestedSize} bytes (OOM). Either (1) compile with -sINITIAL_MEMORY=X with X higher than the current value ${HEAP8.length}, (2) compile with -sALLOW_MEMORY_GROWTH which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with -sABORTING_MALLOC=0`
	);
};
var _emscripten_resize_heap = (requestedSize) => {
	var oldSize = HEAPU8.length;
	// With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
	requestedSize >>>= 0;
	abortOnCannotGrowMemory(requestedSize);
};

var initRandomFill = () => {
	if (
		typeof crypto == 'object' &&
		typeof crypto['getRandomValues'] == 'function'
	) {
		// for modern web browsers
		return (view) => crypto.getRandomValues(view);
	} else if (ENVIRONMENT_IS_NODE) {
		// for nodejs with or without crypto support included
		try {
			var crypto_module = require('crypto');
			var randomFillSync = crypto_module['randomFillSync'];
			if (randomFillSync) {
				// nodejs with LTS crypto support
				return (view) => crypto_module['randomFillSync'](view);
			}
			// very old nodejs with the original crypto API
			var randomBytes = crypto_module['randomBytes'];
			return (view) => (
				view.set(randomBytes(view.byteLength)),
				// Return the original view to match modern native implementations.
				view
			);
		} catch (e) {
			// nodejs doesn't have crypto support
		}
	}
	// we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
	abort(
		'no cryptographic support found for randomDevice. consider polyfilling it if you want to use something insecure like Math.random(), e.g. put this in a --pre-js: var crypto = { getRandomValues: (array) => { for (var i = 0; i < array.length; i++) array[i] = (Math.random()*256)|0 } };'
	);
};
var randomFill = (view) => {
	// Lazily init on the first invocation.
	return (randomFill = initRandomFill())(view);
};
var _getentropy = (buffer, size) => {
	randomFill(HEAPU8.subarray(buffer, buffer + size));
	return 0;
};

var _proc_exit = (code) => {
	EXITSTATUS = code;
	if (!keepRuntimeAlive()) {
		if (Module['onExit']) Module['onExit'](code);
		ABORT = true;
	}
	quit_(code, new ExitStatus(code));
};
/** @param {boolean|number=} implicit */
var exitJS = (status, implicit) => {
	EXITSTATUS = status;

	checkUnflushedContent();

	// if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
	if (keepRuntimeAlive() && !implicit) {
		var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
		err(msg);
	}

	_proc_exit(status);
};

var handleException = (e) => {
	// Certain exception types we do not treat as errors since they are used for
	// internal control flow.
	// 1. ExitStatus, which is thrown by exit()
	// 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
	//    that wish to return to JS event loop.
	if (e instanceof ExitStatus || e == 'unwind') {
		return EXITSTATUS;
	}
	checkStackCookie();
	if (e instanceof WebAssembly.RuntimeError) {
		if (_emscripten_stack_get_current() <= 0) {
			err(
				'Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)'
			);
		}
	}
	quit_(1, e);
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
			trailingSlash = path.substr(-1) === '/';
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
			dir = dir.substr(0, dir.length - 1);
		}
		return root + dir;
	},
	basename: (path) => {
		// EMSCRIPTEN return '/'' for '/', not an empty string
		if (path === '/') return '/';
		path = PATH.normalize(path);
		path = path.replace(/\/$/, '');
		var lastSlash = path.lastIndexOf('/');
		if (lastSlash === -1) return path;
		return path.substr(lastSlash + 1);
	},
	join: function () {
		var paths = Array.prototype.slice.call(arguments);
		return PATH.normalize(paths.join('/'));
	},
	join2: (l, r) => {
		return PATH.normalize(l + '/' + r);
	},
};

var stringToUTF8OnStack = (str) => {
	var size = lengthBytesUTF8(str) + 1;
	var ret = stackAlloc(size);
	stringToUTF8(str, ret, size);
	return ret;
};

function readI53FromI64(ptr) {
	return HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296;
}

function readI53FromU64(ptr) {
	return HEAPU32[ptr >> 2] + HEAPU32[(ptr + 4) >> 2] * 4294967296;
}

/** @param {boolean=} noRunDep */
var asyncLoad = (url, onload, onerror, noRunDep) => {
	var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : '';
	readAsync(
		url,
		(arrayBuffer) => {
			assert(
				arrayBuffer,
				`Loading data file "${url}" failed (no arrayBuffer).`
			);
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
	resolve: function () {
		var resolvedPath = '',
			resolvedAbsolute = false;
		for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
			var path = i >= 0 ? arguments[i] : FS.cwd();
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
function FS_handledByPreloadPlugin(byteArray, fullname, finish, onerror) {
	// Ensure plugins are ready.
	if (typeof Browser != 'undefined') Browser.init();

	var handled = false;
	preloadPlugins.forEach(function (plugin) {
		if (handled) return;
		if (plugin['canHandle'](fullname)) {
			plugin['handle'](byteArray, fullname, finish, onerror);
			handled = true;
		}
	});
	return handled;
}
function FS_createPreloadedFile(
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
	// TODO we should allow people to just pass in a complete filename instead
	// of parent and name being that we just join them anyways
	var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
	var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
	function processData(byteArray) {
		function finish(byteArray) {
			if (preFinish) preFinish();
			if (!dontCreateFile) {
				FS.createDataFile(
					parent,
					name,
					byteArray,
					canRead,
					canWrite,
					canOwn
				);
			}
			if (onload) onload();
			removeRunDependency(dep);
		}
		if (
			FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
				if (onerror) onerror();
				removeRunDependency(dep);
			})
		) {
			return;
		}
		finish(byteArray);
	}
	addRunDependency(dep);
	if (typeof url == 'string') {
		asyncLoad(url, (byteArray) => processData(byteArray), onerror);
	} else {
		processData(url);
	}
}

function FS_getMode(canRead, canWrite) {
	var mode = 0;
	if (canRead) mode |= 292 | 73;
	if (canWrite) mode |= 146;
	return mode;
}

function FS_modeStringToFlags(str) {
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
}

var FS = {
	init: () => {
		FS.ensureErrnoError();
	},
	ErrnoError: null,
	handleError: (returnValue) => {
		// Assume errors correspond to negative returnValues
		// since some functions like _wasmfs_open() return positive
		// numbers on success (some callers of this function may need to negate the parameter).
		if (returnValue < 0) {
			throw new FS.ErrnoError(-returnValue);
		}

		return returnValue;
	},
	ensureErrnoError: () => {
		if (FS.ErrnoError) return;
		FS.ErrnoError = /** @this{Object} */ function ErrnoError(code) {
			this.errno = code;
			this.message = 'FS error';
			this.name = 'ErrnoError';
		};
		FS.ErrnoError.prototype = new Error();
		FS.ErrnoError.prototype.constructor = FS.ErrnoError;
	},
	createDataFile: (parent, name, fileData, canRead, canWrite, canOwn) => {
		var pathName = name ? parent + '/' + name : parent;
		var mode = FS_getMode(canRead, canWrite);

		if (!wasmFSPreloadingFlushed) {
			// WasmFS code in the wasm is not ready to be called yet. Cache the
			// files we want to create here in JS, and WasmFS will read them
			// later.
			wasmFSPreloadedFiles.push({ pathName, fileData, mode });
		} else {
			// WasmFS is already running, so create the file normally.
			FS.create(pathName, mode);
			FS.writeFile(pathName, fileData);
		}
	},
	createPath: (parent, path, canRead, canWrite) => {
		// Cache file path directory names.
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
	readFile: (path, opts = {}) => {
		opts.encoding = opts.encoding || 'binary';
		if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
			throw new Error('Invalid encoding type "' + opts.encoding + '"');
		}

		// Copy the file into a JS buffer on the heap.
		var buf = withStackSave(() =>
			__wasmfs_read_file(stringToUTF8OnStack(path))
		);

		// The signed integer length resides in the first 8 bytes of the buffer.
		var length = readI53FromI64(buf);

		// Default return type is binary.
		// The buffer contents exist 8 bytes after the returned pointer.
		var ret = new Uint8Array(HEAPU8.subarray(buf + 8, buf + 8 + length));
		if (opts.encoding === 'utf8') {
			ret = UTF8ArrayToString(ret, 0);
		}

		return ret;
	},
	cwd: () => UTF8ToString(__wasmfs_get_cwd()),
	analyzePath: (path) => {
		// TODO: Consider simplifying this API, which for now matches the JS FS.
		var exists = !!FS.findObject(path);
		return {
			exists,
			object: {
				contents: exists ? FS.readFile(path) : null,
			},
		};
	},
	mkdir: (path, mode) =>
		FS.handleError(
			withStackSave(() => {
				mode = mode !== undefined ? mode : 511 /* 0777 */;
				var buffer = stringToUTF8OnStack(path);
				return __wasmfs_mkdir(buffer, mode);
			})
		),
	mkdirTree: (path, mode) => {
		var dirs = path.split('/');
		var d = '';
		for (var i = 0; i < dirs.length; ++i) {
			if (!dirs[i]) continue;
			d += '/' + dirs[i];
			try {
				FS.mkdir(d, mode);
			} catch (e) {
				if (e.errno != 20) throw e;
			}
		}
	},
	rmdir: (path) =>
		FS.handleError(
			withStackSave(() => __wasmfs_rmdir(stringToUTF8OnStack(path)))
		),
	open: (path, flags, mode) =>
		withStackSave(() => {
			flags =
				typeof flags == 'string' ? FS_modeStringToFlags(flags) : flags;
			mode = typeof mode == 'undefined' ? 438 /* 0666 */ : mode;
			var buffer = stringToUTF8OnStack(path);
			var fd = FS.handleError(__wasmfs_open(buffer, flags, mode));
			return { fd: fd };
		}),
	create: (path, mode) => {
		// Default settings copied from the legacy JS FS API.
		mode = mode !== undefined ? mode : 438 /* 0666 */;
		mode &= 4095;
		mode |= 32768;
		return FS.mknod(path, mode, 0);
	},
	close: (stream) => FS.handleError(-__wasmfs_close(stream.fd)),
	unlink: (path) =>
		withStackSave(() => {
			var buffer = stringToUTF8OnStack(path);
			return __wasmfs_unlink(buffer);
		}),
	chdir: (path) =>
		withStackSave(() => {
			var buffer = stringToUTF8OnStack(path);
			return __wasmfs_chdir(buffer);
		}),
	read: (stream, buffer, offset, length, position) => {
		var seeking = typeof position != 'undefined';

		var dataBuffer = _malloc(length);

		var bytesRead;
		if (seeking) {
			bytesRead = __wasmfs_pread(stream.fd, dataBuffer, length, position);
		} else {
			bytesRead = __wasmfs_read(stream.fd, dataBuffer, length);
		}
		bytesRead = FS.handleError(bytesRead);

		for (var i = 0; i < length; i++) {
			buffer[offset + i] = HEAP8[(dataBuffer + i) >> 0];
		}

		_free(dataBuffer);
		return bytesRead;
	},
	write: (stream, buffer, offset, length, position, canOwn) => {
		var seeking = typeof position != 'undefined';

		var dataBuffer = _malloc(length);
		for (var i = 0; i < length; i++) {
			HEAP8[(dataBuffer + i) >> 0] = buffer[offset + i];
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
	allocate: (stream, offset, length) => {
		return FS.handleError(
			__wasmfs_allocate(
				stream.fd,
				offset >>> 0,
				((tempDouble = offset),
				+Math.abs(tempDouble) >= 1.0
					? tempDouble > 0.0
						? +Math.floor(tempDouble / 4294967296.0) >>> 0
						: ~~+Math.ceil(
								(tempDouble - +(~~tempDouble >>> 0)) /
									4294967296.0
						  ) >>> 0
					: 0),
				length >>> 0,
				((tempDouble = length),
				+Math.abs(tempDouble) >= 1.0
					? tempDouble > 0.0
						? +Math.floor(tempDouble / 4294967296.0) >>> 0
						: ~~+Math.ceil(
								(tempDouble - +(~~tempDouble >>> 0)) /
									4294967296.0
						  ) >>> 0
					: 0)
			)
		);
	},
	writeFile: (path, data) =>
		withStackSave(() => {
			var pathBuffer = stringToUTF8OnStack(path);
			if (typeof data == 'string') {
				var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
				var actualNumBytes = stringToUTF8Array(
					data,
					buf,
					0,
					buf.length
				);
				data = buf.slice(0, actualNumBytes);
			}
			var dataBuffer = _malloc(data.length);
			assert(dataBuffer);
			for (var i = 0; i < data.length; i++) {
				HEAP8[(dataBuffer + i) >> 0] = data[i];
			}
			var ret = __wasmfs_write_file(pathBuffer, dataBuffer, data.length);
			_free(dataBuffer);
			return ret;
		}),
	symlink: (target, linkpath) =>
		withStackSave(() =>
			__wasmfs_symlink(
				stringToUTF8OnStack(target),
				stringToUTF8OnStack(linkpath)
			)
		),
	readlink: (path) => {
		var readBuffer = FS.handleError(
			withStackSave(() => __wasmfs_readlink(stringToUTF8OnStack(path)))
		);
		return UTF8ToString(readBuffer);
	},
	statBufToObject: (statBuf) => {
		// i53/u53 are enough for times and ino in practice.
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
	stat: (path) => {
		var statBuf = _malloc(96);
		FS.handleError(
			withStackSave(() => {
				return __wasmfs_stat(stringToUTF8OnStack(path), statBuf);
			})
		);
		var stats = FS.statBufToObject(statBuf);
		_free(statBuf);

		return stats;
	},
	lstat: (path) => {
		var statBuf = _malloc(96);
		FS.handleError(
			withStackSave(() => {
				return __wasmfs_lstat(stringToUTF8OnStack(path), statBuf);
			})
		);
		var stats = FS.statBufToObject(statBuf);
		_free(statBuf);

		return stats;
	},
	chmod: (path, mode) => {
		return FS.handleError(
			withStackSave(() => {
				var buffer = stringToUTF8OnStack(path);
				return __wasmfs_chmod(buffer, mode);
			})
		);
	},
	lchmod: (path, mode) => {
		return FS.handleError(
			withStackSave(() => {
				var buffer = stringToUTF8OnStack(path);
				return __wasmfs_lchmod(buffer, mode);
			})
		);
	},
	fchmod: (fd, mode) => {
		return FS.handleError(__wasmfs_fchmod(fd, mode));
	},
	utime: (path, atime, mtime) =>
		FS.handleError(
			withStackSave(() =>
				__wasmfs_utime(stringToUTF8OnStack(path), atime, mtime)
			)
		),
	truncate: (path, len) => {
		return FS.handleError(
			withStackSave(() =>
				__wasmfs_truncate(
					stringToUTF8OnStack(path),
					len >>> 0,
					((tempDouble = len),
					+Math.abs(tempDouble) >= 1.0
						? tempDouble > 0.0
							? +Math.floor(tempDouble / 4294967296.0) >>> 0
							: ~~+Math.ceil(
									(tempDouble - +(~~tempDouble >>> 0)) /
										4294967296.0
							  ) >>> 0
						: 0)
				)
			)
		);
	},
	ftruncate: (fd, len) => {
		return FS.handleError(
			__wasmfs_ftruncate(
				fd,
				len >>> 0,
				((tempDouble = len),
				+Math.abs(tempDouble) >= 1.0
					? tempDouble > 0.0
						? +Math.floor(tempDouble / 4294967296.0) >>> 0
						: ~~+Math.ceil(
								(tempDouble - +(~~tempDouble >>> 0)) /
									4294967296.0
						  ) >>> 0
					: 0)
			)
		);
	},
	findObject: (path) => {
		var result = withStackSave(() =>
			__wasmfs_identify(stringToUTF8OnStack(path))
		);
		if (result == 44) {
			return null;
		}
		return {
			isFolder: result == 31,
			isDevice: false, // TODO: wasmfs support for devices
		};
	},
	readdir: (path) =>
		withStackSave(() => {
			var pathBuffer = stringToUTF8OnStack(path);
			var entries = [];
			var state = __wasmfs_readdir_start(pathBuffer);
			if (!state) {
				// TODO: The old FS threw an ErrnoError here.
				throw new Error('No such directory');
			}
			var entry;
			while ((entry = __wasmfs_readdir_get(state))) {
				entries.push(UTF8ToString(entry));
			}
			__wasmfs_readdir_finish(state);
			return entries;
		}),
	mknod: (path, mode, dev) => {
		return FS.handleError(
			withStackSave(() => {
				var pathBuffer = stringToUTF8OnStack(path);
				return __wasmfs_mknod(pathBuffer, mode, dev);
			})
		);
	},
	rename: (oldPath, newPath) => {
		return FS.handleError(
			withStackSave(() => {
				var oldPathBuffer = stringToUTF8OnStack(oldPath);
				var newPathBuffer = stringToUTF8OnStack(newPath);
				return __wasmfs_rename(oldPathBuffer, newPathBuffer);
			})
		);
	},
	llseek: (stream, offset, whence) => {
		return FS.handleError(
			__wasmfs_llseek(
				stream.fd,
				offset >>> 0,
				((tempDouble = offset),
				+Math.abs(tempDouble) >= 1.0
					? tempDouble > 0.0
						? +Math.floor(tempDouble / 4294967296.0) >>> 0
						: ~~+Math.ceil(
								(tempDouble - +(~~tempDouble >>> 0)) /
									4294967296.0
						  ) >>> 0
					: 0),
				whence
			)
		);
	},
};

function runAndAbortIfError(func) {
	try {
		return func();
	} catch (e) {
		abort(e);
	}
}

var _exit = exitJS;

var maybeExit = () => {
	if (!keepRuntimeAlive()) {
		try {
			_exit(EXITSTATUS);
		} catch (e) {
			handleException(e);
		}
	}
};
var callUserCallback = (func) => {
	if (ABORT) {
		err(
			'user callback triggered after runtime exited or application aborted.  Ignoring.'
		);
		return;
	}
	try {
		func();
		maybeExit();
	} catch (e) {
		handleException(e);
	}
};

function sigToWasmTypes(sig) {
	assert(
		!sig.includes('j'),
		'i64 not permitted in function signatures when WASM_BIGINT is disabled'
	);
	var typeNames = {
		i: 'i32',
		j: 'i64',
		f: 'f32',
		d: 'f64',
		p: 'i32',
	};
	var type = {
		parameters: [],
		results: sig[0] == 'v' ? [] : [typeNames[sig[0]]],
	};
	for (var i = 1; i < sig.length; ++i) {
		assert(sig[i] in typeNames, 'invalid signature char: ' + sig[i]);
		type.parameters.push(typeNames[sig[i]]);
	}
	return type;
}

var runtimeKeepalivePush = () => {
	runtimeKeepaliveCounter += 1;
};

var runtimeKeepalivePop = () => {
	assert(runtimeKeepaliveCounter > 0);
	runtimeKeepaliveCounter -= 1;
};

var Asyncify = {
	instrumentWasmImports: function (imports) {
		var importPatterns = [
			/^_main$/,
			/^_create_file$/,
			/^_open$/,
			/^__syscall_openat$/,
			/^fd_sync$/,
			/^__wasi_fd_sync$/,
			/^__asyncjs__.*$/,
			/^emscripten_promise_await$/,
			/^_wasmfs_jsimpl_async_alloc_file$/,
			/^_wasmfs_jsimpl_async_free_file$/,
			/^_wasmfs_jsimpl_async_write$/,
			/^_wasmfs_jsimpl_async_read$/,
			/^_wasmfs_jsimpl_async_get_size$/,
			/^_wasmfs_create_fetch_backend_js$/,
			/^_wasmfs_opfs_init_root_directory$/,
			/^$wasmfsOPFSGetOrCreateFile$/,
			/^$wasmfsOPFSGetOrCreateDir$/,
			/^_wasmfs_opfs_get_child$/,
			/^_wasmfs_opfs_get_entries$/,
			/^_wasmfs_opfs_insert_file$/,
			/^_wasmfs_opfs_insert_directory$/,
			/^_wasmfs_opfs_move_file$/,
			/^_wasmfs_opfs_remove_child$/,
			/^_wasmfs_opfs_open_access$/,
			/^_wasmfs_opfs_open_blob$/,
			/^_wasmfs_opfs_close_access$/,
			/^_wasmfs_opfs_read_access$/,
			/^_wasmfs_opfs_read_blob$/,
			/^_wasmfs_opfs_write_access$/,
			/^_wasmfs_opfs_get_size_access$/,
			/^_wasmfs_opfs_get_size_file$/,
			/^_wasmfs_opfs_set_size_access$/,
			/^_wasmfs_opfs_set_size_file$/,
			/^_wasmfs_opfs_flush_access$/,
			/^emscripten_idb_load$/,
			/^emscripten_idb_store$/,
			/^emscripten_idb_delete$/,
			/^emscripten_idb_exists$/,
			/^emscripten_idb_load_blob$/,
			/^emscripten_idb_store_blob$/,
			/^emscripten_sleep$/,
			/^emscripten_wget_data$/,
			/^emscripten_scan_registers$/,
			/^emscripten_lazy_load_code$/,
			/^_load_secondary_module$/,
			/^emscripten_fiber_swap$/,
			/^SDL_Delay$/,
		];

		for (var x in imports) {
			(function (x) {
				var original = imports[x];
				var sig = original.sig;
				if (typeof original == 'function') {
					var isAsyncifyImport =
						original.isAsync ||
						importPatterns.some((pattern) => !!x.match(pattern));
					imports[x] = function () {
						var originalAsyncifyState = Asyncify.state;
						try {
							return original.apply(null, arguments);
						} finally {
							// Only asyncify-declared imports are allowed to change the
							// state.
							// Changing the state from normal to disabled is allowed (in any
							// function) as that is what shutdown does (and we don't have an
							// explicit list of shutdown imports).
							var changedToDisabled =
								originalAsyncifyState ===
									Asyncify.State.Normal &&
								Asyncify.state === Asyncify.State.Disabled;
							// invoke_* functions are allowed to change the state if we do
							// not ignore indirect calls.
							var ignoredInvoke =
								x.startsWith('invoke_') && false;
							if (
								Asyncify.state !== originalAsyncifyState &&
								!isAsyncifyImport &&
								!changedToDisabled &&
								!ignoredInvoke
							) {
								throw new Error(
									`import ${x} was not in ASYNCIFY_IMPORTS, but changed the state`
								);
							}
						}
					};
				}
			})(x);
		}
	},
	instrumentWasmExports: function (exports) {
		var ret = {};
		for (var x in exports) {
			(function (x) {
				var original = exports[x];
				if (typeof original == 'function') {
					ret[x] = function () {
						Asyncify.exportCallStack.push(x);
						try {
							return original.apply(null, arguments);
						} finally {
							if (!ABORT) {
								var y = Asyncify.exportCallStack.pop();
								assert(y === x);
								Asyncify.maybeStopUnwind();
							}
						}
					};
				} else {
					ret[x] = original;
				}
			})(x);
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
	getCallStackId: function (funcName) {
		var id = Asyncify.callStackNameToId[funcName];
		if (id === undefined) {
			id = Asyncify.callStackId++;
			Asyncify.callStackNameToId[funcName] = id;
			Asyncify.callStackIdToName[id] = funcName;
		}
		return id;
	},
	maybeStopUnwind: function () {
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

			// Keep the runtime alive so that a re-wind can be done later.
			runAndAbortIfError(_asyncify_stop_unwind);
			if (typeof Fibers != 'undefined') {
				Fibers.trampoline();
			}
		}
	},
	whenDone: function () {
		assert(
			Asyncify.currData,
			'Tried to wait for an async operation when none is in progress.'
		);
		assert(
			!Asyncify.asyncPromiseHandlers,
			'Cannot have multiple async operations in flight at once'
		);
		return new Promise((resolve, reject) => {
			Asyncify.asyncPromiseHandlers = { resolve, reject };
		});
	},
	allocateData: function () {
		// An asyncify data structure has three fields:
		//  0  current stack pos
		//  4  max stack pos
		//  8  id of function at bottom of the call stack (callStackIdToName[id] == name of js function)
		//
		// The Asyncify ABI only interprets the first two fields, the rest is for the runtime.
		// We also embed a stack in the same memory region here, right next to the structure.
		// This struct is also defined as asyncify_data_t in emscripten/fiber.h
		var ptr = _malloc(12 + Asyncify.StackSize);
		Asyncify.setDataHeader(ptr, ptr + 12, Asyncify.StackSize);
		Asyncify.setDataRewindFunc(ptr);
		return ptr;
	},
	setDataHeader: function (ptr, stack, stackSize) {
		HEAP32[ptr >> 2] = stack;
		HEAP32[(ptr + 4) >> 2] = stack + stackSize;
	},
	setDataRewindFunc: function (ptr) {
		var bottomOfCallStack = Asyncify.exportCallStack[0];
		var rewindId = Asyncify.getCallStackId(bottomOfCallStack);
		HEAP32[(ptr + 8) >> 2] = rewindId;
	},
	getDataRewindFunc: function (ptr) {
		var id = HEAP32[(ptr + 8) >> 2];
		var name = Asyncify.callStackIdToName[id];
		var func = Module['asm'][name];
		return func;
	},
	doRewind: function (ptr) {
		var start = Asyncify.getDataRewindFunc(ptr);
		// Once we have rewound and the stack we no longer need to artificially
		// keep the runtime alive.

		return start();
	},
	handleSleep: function (startAsync) {
		assert(
			Asyncify.state !== Asyncify.State.Disabled,
			'Asyncify cannot be done during or after the runtime exits'
		);
		if (ABORT) return;
		if (Asyncify.state === Asyncify.State.Normal) {
			// Prepare to sleep. Call startAsync, and see what happens:
			// if the code decided to call our callback synchronously,
			// then no async operation was in fact begun, and we don't
			// need to do anything.
			var reachedCallback = false;
			var reachedAfterCallback = false;
			startAsync((handleSleepReturnValue = 0) => {
				assert(
					!handleSleepReturnValue ||
						typeof handleSleepReturnValue == 'number' ||
						typeof handleSleepReturnValue == 'boolean'
				); // old emterpretify API supported other stuff
				if (ABORT) return;
				Asyncify.handleSleepReturnValue = handleSleepReturnValue;
				reachedCallback = true;
				if (!reachedAfterCallback) {
					// We are happening synchronously, so no need for async.
					return;
				}
				// This async operation did not happen synchronously, so we did
				// unwind. In that case there can be no compiled code on the stack,
				// as it might break later operations (we can rewind ok now, but if
				// we unwind again, we would unwind through the extra compiled code
				// too).
				assert(
					!Asyncify.exportCallStack.length,
					'Waking up (starting to rewind) must be done from JS, without compiled code on the stack.'
				);
				Asyncify.state = Asyncify.State.Rewinding;
				runAndAbortIfError(() =>
					_asyncify_start_rewind(Asyncify.currData)
				);
				if (typeof Browser != 'undefined' && Browser.mainLoop.func) {
					Browser.mainLoop.resume();
				}
				var asyncWasmReturnValue,
					isError = false;
				try {
					asyncWasmReturnValue = Asyncify.doRewind(Asyncify.currData);
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
					//
					// Note: `asyncWasmReturnValue` is distinct from
					// `Asyncify.handleSleepReturnValue`.
					// `Asyncify.handleSleepReturnValue` contains the return
					// value of the last C function to have executed
					// `Asyncify.handleSleep()`, where as `asyncWasmReturnValue`
					// contains the return value of the exported WASM function
					// that may have called C functions that
					// call `Asyncify.handleSleep()`.
					var asyncPromiseHandlers = Asyncify.asyncPromiseHandlers;
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
				if (typeof Browser != 'undefined' && Browser.mainLoop.func) {
					Browser.mainLoop.pause();
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
			Asyncify.sleepCallbacks.forEach((func) => callUserCallback(func));
		} else {
			abort(`invalid state: ${Asyncify.state}`);
		}
		return Asyncify.handleSleepReturnValue;
	},
	handleAsync: function (startAsync) {
		return Asyncify.handleSleep((wakeUp) => {
			// TODO: add error handling as a second param when handleSleep implements it.
			startAsync().then(wakeUp);
		});
	},
};

function getCFunc(ident) {
	var func = Module['_' + ident]; // closure exported function
	assert(
		func,
		'Cannot call unknown function ' + ident + ', make sure it is exported'
	);
	return func;
}

var writeArrayToMemory = (array, buffer) => {
	assert(
		array.length >= 0,
		'writeArrayToMemory array must have a length (should be an array or typed array)'
	);
	HEAP8.set(array, buffer);
};

/**
 * @param {string|null=} returnType
 * @param {Array=} argTypes
 * @param {Arguments|Array=} args
 * @param {Object=} opts
 */
var ccall = function (ident, returnType, argTypes, args, opts) {
	// For fast lookup of conversion functions
	var toC = {
		string: (str) => {
			var ret = 0;
			if (str !== null && str !== undefined && str !== 0) {
				// null string
				// at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
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
	assert(returnType !== 'array', 'Return type should not be "array".');
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
	var ret = func.apply(null, cArgs);
	function onDone(ret) {
		runtimeKeepalivePop();
		if (stack !== 0) stackRestore(stack);
		return convertReturnValue(ret);
	}
	var asyncMode = opts && opts.async;

	// Keep the runtime alive through all calls. Note that this call might not be
	// async, but for simplicity we push and pop in all calls.
	runtimeKeepalivePush();
	if (Asyncify.currData != previousAsync) {
		// A change in async operation happened. If there was already an async
		// operation in flight before us, that is an error: we should not start
		// another async operation while one is active, and we should not stop one
		// either. The only valid combination is to have no change in the async
		// data (so we either had one in flight and left it alone, or we didn't have
		// one), or to have nothing in flight and to start one.
		assert(
			!(previousAsync && Asyncify.currData),
			'We cannot start an async operation when one is already flight'
		);
		assert(
			!(previousAsync && !Asyncify.currData),
			'We cannot stop an async operation in flight'
		);
		// This is a new async operation. The wasm is paused and has unwound its stack.
		// We need to return a Promise that resolves the return value
		// once the stack is rewound and execution finishes.
		assert(
			asyncMode,
			'The call to ' +
				ident +
				' is running asynchronously. If this was intended, add the async option to the ccall/cwrap call.'
		);
		return Asyncify.whenDone().then(onDone);
	}

	ret = onDone(ret);
	// If this is an async ccall, ensure we return a promise
	if (asyncMode) return Promise.resolve(ret);
	return ret;
};

handleAllocatorInit();

FS.init();
FS.createPreloadedFile = FS_createPreloadedFile;
function checkIncomingModuleAPI() {
	ignoredModuleProp('fetchSettings');
}
var wasmImports = {
	__assert_fail: ___assert_fail,
	_emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,
	_wasmfs_copy_preloaded_file_data: __wasmfs_copy_preloaded_file_data,
	_wasmfs_get_num_preloaded_dirs: __wasmfs_get_num_preloaded_dirs,
	_wasmfs_get_num_preloaded_files: __wasmfs_get_num_preloaded_files,
	_wasmfs_get_preloaded_child_path: __wasmfs_get_preloaded_child_path,
	_wasmfs_get_preloaded_file_mode: __wasmfs_get_preloaded_file_mode,
	_wasmfs_get_preloaded_file_size: __wasmfs_get_preloaded_file_size,
	_wasmfs_get_preloaded_parent_path: __wasmfs_get_preloaded_parent_path,
	_wasmfs_get_preloaded_path_name: __wasmfs_get_preloaded_path_name,
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
	abort: _abort,
	emscripten_console_error: _emscripten_console_error,
	emscripten_console_log: _emscripten_console_log,
	emscripten_date_now: _emscripten_date_now,
	emscripten_err: _emscripten_err,
	emscripten_get_now: _emscripten_get_now,
	emscripten_has_asyncify: _emscripten_has_asyncify,
	emscripten_is_main_browser_thread: _emscripten_is_main_browser_thread,
	emscripten_memcpy_big: _emscripten_memcpy_big,
	emscripten_out: _emscripten_out,
	emscripten_resize_heap: _emscripten_resize_heap,
	getentropy: _getentropy,
};
Asyncify.instrumentWasmImports(wasmImports);
var asm = createWasm();
/** @type {function(...*):?} */
var ___wasm_call_ctors = createExportWrapper('__wasm_call_ctors');
/** @type {function(...*):?} */
var _create_file = (Module['_create_file'] =
	createExportWrapper('create_file'));
/** @type {function(...*):?} */
var _main = (Module['_main'] = createExportWrapper('main'));
/** @type {function(...*):?} */
var ___errno_location = createExportWrapper('__errno_location');
/** @type {function(...*):?} */
var _fflush = (Module['_fflush'] = createExportWrapper('fflush'));
/** @type {function(...*):?} */
var _malloc = createExportWrapper('malloc');
/** @type {function(...*):?} */
var _free = createExportWrapper('free');
/** @type {function(...*):?} */
var _emscripten_stack_init = function () {
	return (_emscripten_stack_init =
		Module['asm']['emscripten_stack_init']).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_set_limits = function () {
	return (_emscripten_stack_set_limits =
		Module['asm']['emscripten_stack_set_limits']).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_free = function () {
	return (_emscripten_stack_get_free =
		Module['asm']['emscripten_stack_get_free']).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_base = function () {
	return (_emscripten_stack_get_base =
		Module['asm']['emscripten_stack_get_base']).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_end = function () {
	return (_emscripten_stack_get_end =
		Module['asm']['emscripten_stack_get_end']).apply(null, arguments);
};

/** @type {function(...*):?} */
var stackSave = createExportWrapper('stackSave');
/** @type {function(...*):?} */
var stackRestore = createExportWrapper('stackRestore');
/** @type {function(...*):?} */
var stackAlloc = createExportWrapper('stackAlloc');
/** @type {function(...*):?} */
var _emscripten_stack_get_current = function () {
	return (_emscripten_stack_get_current =
		Module['asm']['emscripten_stack_get_current']).apply(null, arguments);
};

/** @type {function(...*):?} */
var __wasmfs_read_file = createExportWrapper('_wasmfs_read_file');
/** @type {function(...*):?} */
var __wasmfs_write_file = createExportWrapper('_wasmfs_write_file');
/** @type {function(...*):?} */
var __wasmfs_mkdir = createExportWrapper('_wasmfs_mkdir');
/** @type {function(...*):?} */
var __wasmfs_rmdir = createExportWrapper('_wasmfs_rmdir');
/** @type {function(...*):?} */
var __wasmfs_open = createExportWrapper('_wasmfs_open');
/** @type {function(...*):?} */
var __wasmfs_allocate = createExportWrapper('_wasmfs_allocate');
/** @type {function(...*):?} */
var __wasmfs_mknod = createExportWrapper('_wasmfs_mknod');
/** @type {function(...*):?} */
var __wasmfs_unlink = createExportWrapper('_wasmfs_unlink');
/** @type {function(...*):?} */
var __wasmfs_chdir = createExportWrapper('_wasmfs_chdir');
/** @type {function(...*):?} */
var __wasmfs_symlink = createExportWrapper('_wasmfs_symlink');
/** @type {function(...*):?} */
var __wasmfs_readlink = createExportWrapper('_wasmfs_readlink');
/** @type {function(...*):?} */
var __wasmfs_write = createExportWrapper('_wasmfs_write');
/** @type {function(...*):?} */
var __wasmfs_pwrite = createExportWrapper('_wasmfs_pwrite');
/** @type {function(...*):?} */
var __wasmfs_chmod = createExportWrapper('_wasmfs_chmod');
/** @type {function(...*):?} */
var __wasmfs_fchmod = createExportWrapper('_wasmfs_fchmod');
/** @type {function(...*):?} */
var __wasmfs_lchmod = createExportWrapper('_wasmfs_lchmod');
/** @type {function(...*):?} */
var __wasmfs_llseek = createExportWrapper('_wasmfs_llseek');
/** @type {function(...*):?} */
var __wasmfs_rename = createExportWrapper('_wasmfs_rename');
/** @type {function(...*):?} */
var __wasmfs_read = createExportWrapper('_wasmfs_read');
/** @type {function(...*):?} */
var __wasmfs_pread = createExportWrapper('_wasmfs_pread');
/** @type {function(...*):?} */
var __wasmfs_truncate = createExportWrapper('_wasmfs_truncate');
/** @type {function(...*):?} */
var __wasmfs_ftruncate = createExportWrapper('_wasmfs_ftruncate');
/** @type {function(...*):?} */
var __wasmfs_close = createExportWrapper('_wasmfs_close');
/** @type {function(...*):?} */
var __wasmfs_utime = createExportWrapper('_wasmfs_utime');
/** @type {function(...*):?} */
var __wasmfs_stat = createExportWrapper('_wasmfs_stat');
/** @type {function(...*):?} */
var __wasmfs_lstat = createExportWrapper('_wasmfs_lstat');
/** @type {function(...*):?} */
var __wasmfs_identify = createExportWrapper('_wasmfs_identify');
/** @type {function(...*):?} */
var __wasmfs_readdir_start = createExportWrapper('_wasmfs_readdir_start');
/** @type {function(...*):?} */
var __wasmfs_readdir_get = createExportWrapper('_wasmfs_readdir_get');
/** @type {function(...*):?} */
var __wasmfs_readdir_finish = createExportWrapper('_wasmfs_readdir_finish');
/** @type {function(...*):?} */
var __wasmfs_get_cwd = createExportWrapper('_wasmfs_get_cwd');
/** @type {function(...*):?} */
var __wasmfs_opfs_record_entry = createExportWrapper(
	'_wasmfs_opfs_record_entry'
);
/** @type {function(...*):?} */
var _wasmfs_flush = createExportWrapper('wasmfs_flush');
/** @type {function(...*):?} */
var dynCall_vi = (Module['dynCall_vi'] = createExportWrapper('dynCall_vi'));
/** @type {function(...*):?} */
var dynCall_ii = (Module['dynCall_ii'] = createExportWrapper('dynCall_ii'));
/** @type {function(...*):?} */
var dynCall_iiii = (Module['dynCall_iiii'] =
	createExportWrapper('dynCall_iiii'));
/** @type {function(...*):?} */
var dynCall_jiji = (Module['dynCall_jiji'] =
	createExportWrapper('dynCall_jiji'));
/** @type {function(...*):?} */
var dynCall_iidiiii = (Module['dynCall_iidiiii'] =
	createExportWrapper('dynCall_iidiiii'));
/** @type {function(...*):?} */
var dynCall_vii = (Module['dynCall_vii'] = createExportWrapper('dynCall_vii'));
/** @type {function(...*):?} */
var dynCall_viiiiii = (Module['dynCall_viiiiii'] =
	createExportWrapper('dynCall_viiiiii'));
/** @type {function(...*):?} */
var dynCall_viiiii = (Module['dynCall_viiiii'] =
	createExportWrapper('dynCall_viiiii'));
/** @type {function(...*):?} */
var dynCall_viiii = (Module['dynCall_viiii'] =
	createExportWrapper('dynCall_viiii'));
/** @type {function(...*):?} */
var dynCall_viii = (Module['dynCall_viii'] =
	createExportWrapper('dynCall_viii'));
/** @type {function(...*):?} */
var dynCall_iii = (Module['dynCall_iii'] = createExportWrapper('dynCall_iii'));
/** @type {function(...*):?} */
var dynCall_ji = (Module['dynCall_ji'] = createExportWrapper('dynCall_ji'));
/** @type {function(...*):?} */
var dynCall_v = (Module['dynCall_v'] = createExportWrapper('dynCall_v'));
/** @type {function(...*):?} */
var dynCall_iiiij = (Module['dynCall_iiiij'] =
	createExportWrapper('dynCall_iiiij'));
/** @type {function(...*):?} */
var dynCall_iij = (Module['dynCall_iij'] = createExportWrapper('dynCall_iij'));
/** @type {function(...*):?} */
var _asyncify_start_unwind = createExportWrapper('asyncify_start_unwind');
/** @type {function(...*):?} */
var _asyncify_stop_unwind = createExportWrapper('asyncify_stop_unwind');
/** @type {function(...*):?} */
var _asyncify_start_rewind = createExportWrapper('asyncify_start_rewind');
/** @type {function(...*):?} */
var _asyncify_stop_rewind = createExportWrapper('asyncify_stop_rewind');

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

// include: base64Utils.js
// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
	if (typeof ENVIRONMENT_IS_NODE != 'undefined' && ENVIRONMENT_IS_NODE) {
		var buf = Buffer.from(s, 'base64');
		return new Uint8Array(
			buf['buffer'],
			buf['byteOffset'],
			buf['byteLength']
		);
	}

	try {
		var decoded = atob(s);
		var bytes = new Uint8Array(decoded.length);
		for (var i = 0; i < decoded.length; ++i) {
			bytes[i] = decoded.charCodeAt(i);
		}
		return bytes;
	} catch (_) {
		throw new Error('Converting base64 string to bytes failed.');
	}
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
	if (!isDataURI(filename)) {
		return;
	}

	return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}
// end include: base64Utils.js
Module['addRunDependency'] = addRunDependency;
Module['removeRunDependency'] = removeRunDependency;
Module['FS_createPath'] = FS.createPath;
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_unlink'] = FS.unlink;
Module['ccall'] = ccall;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;
Module['FS'] = FS;
var missingLibrarySymbols = [
	'writeI53ToI64',
	'writeI53ToI64Clamped',
	'writeI53ToI64Signaling',
	'writeI53ToU64Clamped',
	'writeI53ToU64Signaling',
	'convertI32PairToI53',
	'convertU32PairToI53',
	'zeroMemory',
	'growMemory',
	'isLeapYear',
	'ydayFromDate',
	'arraySum',
	'addDays',
	'setErrNo',
	'inetPton4',
	'inetNtop4',
	'inetPton6',
	'inetNtop6',
	'readSockaddr',
	'writeSockaddr',
	'getHostByName',
	'traverseStack',
	'getCallstack',
	'emscriptenLog',
	'convertPCtoSourceLocation',
	'readEmAsmArgs',
	'jstoi_q',
	'jstoi_s',
	'getExecutableName',
	'listenOnce',
	'autoResumeAudioContext',
	'dynCallLegacy',
	'getDynCaller',
	'dynCall',
	'safeSetTimeout',
	'asmjsMangle',
	'alignMemory',
	'mmapAlloc',
	'getNativeTypeSize',
	'STACK_SIZE',
	'STACK_ALIGN',
	'POINTER_SIZE',
	'ASSERTIONS',
	'cwrap',
	'uleb128Encode',
	'generateFuncType',
	'convertJsFunctionToWasm',
	'getEmptyTableSlot',
	'updateTableMap',
	'getFunctionAddress',
	'addFunction',
	'removeFunction',
	'reallyNegative',
	'unSign',
	'strLen',
	'reSign',
	'formatString',
	'intArrayToString',
	'AsciiToString',
	'stringToAscii',
	'UTF16ToString',
	'stringToUTF16',
	'lengthBytesUTF16',
	'UTF32ToString',
	'stringToUTF32',
	'lengthBytesUTF32',
	'stringToNewUTF8',
	'registerKeyEventCallback',
	'maybeCStringToJsString',
	'findEventTarget',
	'findCanvasEventTarget',
	'getBoundingClientRect',
	'fillMouseEventData',
	'registerMouseEventCallback',
	'registerWheelEventCallback',
	'registerUiEventCallback',
	'registerFocusEventCallback',
	'fillDeviceOrientationEventData',
	'registerDeviceOrientationEventCallback',
	'fillDeviceMotionEventData',
	'registerDeviceMotionEventCallback',
	'screenOrientation',
	'fillOrientationChangeEventData',
	'registerOrientationChangeEventCallback',
	'fillFullscreenChangeEventData',
	'registerFullscreenChangeEventCallback',
	'JSEvents_requestFullscreen',
	'JSEvents_resizeCanvasForFullscreen',
	'registerRestoreOldStyle',
	'hideEverythingExceptGivenElement',
	'restoreHiddenElements',
	'setLetterbox',
	'softFullscreenResizeWebGLRenderTarget',
	'doRequestFullscreen',
	'fillPointerlockChangeEventData',
	'registerPointerlockChangeEventCallback',
	'registerPointerlockErrorEventCallback',
	'requestPointerLock',
	'fillVisibilityChangeEventData',
	'registerVisibilityChangeEventCallback',
	'registerTouchEventCallback',
	'fillGamepadEventData',
	'registerGamepadEventCallback',
	'registerBeforeUnloadEventCallback',
	'fillBatteryEventData',
	'battery',
	'registerBatteryEventCallback',
	'setCanvasElementSize',
	'getCanvasElementSize',
	'demangle',
	'demangleAll',
	'jsStackTrace',
	'stackTrace',
	'getEnvStrings',
	'checkWasiClock',
	'flush_NO_FILESYSTEM',
	'wasiRightsToMuslOFlags',
	'wasiOFlagsToMuslOFlags',
	'createDyncallWrapper',
	'setImmediateWrapped',
	'clearImmediateWrapped',
	'polyfillSetImmediate',
	'getPromise',
	'makePromise',
	'idsToPromises',
	'makePromiseCallback',
	'ExceptionInfo',
	'setMainLoop',
	'wasmfsNodeConvertNodeCode',
	'wasmfsNodeFixStat',
	'wasmfsNodeLstat',
	'wasmfsNodeFstat',
	'heapObjectForWebGLType',
	'heapAccessShiftForWebGLHeap',
	'webgl_enable_ANGLE_instanced_arrays',
	'webgl_enable_OES_vertex_array_object',
	'webgl_enable_WEBGL_draw_buffers',
	'webgl_enable_WEBGL_multi_draw',
	'emscriptenWebGLGet',
	'computeUnpackAlignedImageSize',
	'colorChannelsInGlTextureFormat',
	'emscriptenWebGLGetTexPixelData',
	'__glGenObject',
	'emscriptenWebGLGetUniform',
	'webglGetUniformLocation',
	'webglPrepareUniformLocationsBeforeFirstUse',
	'webglGetLeftBracePos',
	'emscriptenWebGLGetVertexAttrib',
	'__glGetActiveAttribOrUniform',
	'writeGLArray',
	'registerWebGlEventCallback',
	'SDL_unicode',
	'SDL_ttfContext',
	'SDL_audio',
	'GLFW_Window',
	'ALLOC_NORMAL',
	'ALLOC_STACK',
	'allocate',
	'writeStringToMemory',
	'writeAsciiToMemory',
];
missingLibrarySymbols.forEach(missingLibrarySymbol);

var unexportedSymbols = [
	'run',
	'addOnPreRun',
	'addOnInit',
	'addOnPreMain',
	'addOnExit',
	'addOnPostRun',
	'FS_createFolder',
	'FS_createLazyFile',
	'FS_createLink',
	'FS_createDevice',
	'out',
	'err',
	'callMain',
	'abort',
	'keepRuntimeAlive',
	'wasmMemory',
	'stackAlloc',
	'stackSave',
	'stackRestore',
	'getTempRet0',
	'setTempRet0',
	'writeStackCookie',
	'checkStackCookie',
	'readI53FromI64',
	'readI53FromU64',
	'convertI32PairToI53Checked',
	'ptrToString',
	'exitJS',
	'getHeapMax',
	'abortOnCannotGrowMemory',
	'ENV',
	'MONTH_DAYS_REGULAR',
	'MONTH_DAYS_LEAP',
	'MONTH_DAYS_REGULAR_CUMULATIVE',
	'MONTH_DAYS_LEAP_CUMULATIVE',
	'ERRNO_CODES',
	'ERRNO_MESSAGES',
	'DNS',
	'Protocols',
	'Sockets',
	'initRandomFill',
	'randomFill',
	'timers',
	'warnOnce',
	'UNWIND_CACHE',
	'readEmAsmArgsArray',
	'handleException',
	'runtimeKeepalivePush',
	'runtimeKeepalivePop',
	'callUserCallback',
	'maybeExit',
	'asyncLoad',
	'handleAllocatorInit',
	'HandleAllocator',
	'getCFunc',
	'sigToWasmTypes',
	'freeTableIndexes',
	'functionsInTableMap',
	'setValue',
	'getValue',
	'PATH',
	'PATH_FS',
	'UTF8Decoder',
	'UTF8ArrayToString',
	'UTF8ToString',
	'stringToUTF8Array',
	'stringToUTF8',
	'lengthBytesUTF8',
	'intArrayFromString',
	'UTF16Decoder',
	'stringToUTF8OnStack',
	'writeArrayToMemory',
	'JSEvents',
	'specialHTMLTargets',
	'currentFullscreenStrategy',
	'restoreOldWindowedStyle',
	'ExitStatus',
	'promiseMap',
	'uncaughtExceptionCount',
	'exceptionLast',
	'exceptionCaught',
	'Browser',
	'wget',
	'preloadPlugins',
	'FS_modeStringToFlags',
	'FS_getMode',
	'FS_stdin_getChar_buffer',
	'FS_stdin_getChar',
	'wasmFSPreloadedFiles',
	'wasmFSPreloadedDirs',
	'wasmFSPreloadingFlushed',
	'wasmFS$JSMemoryFiles',
	'wasmFS$backends',
	'wasmfsNodeIsWindows',
	'wasmfsOPFSDirectoryHandles',
	'wasmfsOPFSFileHandles',
	'wasmfsOPFSAccessHandles',
	'wasmfsOPFSBlobs',
	'FileSystemAsyncAccessHandle',
	'wasmfsOPFSCreateAsyncAccessHandle',
	'wasmfsOPFSProxyFinish',
	'wasmfsOPFSGetOrCreateFile',
	'wasmfsOPFSGetOrCreateDir',
	'tempFixedLengthArray',
	'miniTempWebGLFloatBuffers',
	'miniTempWebGLIntBuffers',
	'GL',
	'emscripten_webgl_power_preferences',
	'AL',
	'GLUT',
	'EGL',
	'GLEW',
	'IDBStore',
	'runAndAbortIfError',
	'Asyncify',
	'Fibers',
	'SDL',
	'SDL_gfx',
	'GLFW',
	'allocateUTF8',
	'allocateUTF8OnStack',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);

var calledRun;

dependenciesFulfilled = function runCaller() {
	// If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
	if (!calledRun) run();
	if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function callMain() {
	assert(
		runDependencies == 0,
		'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])'
	);
	assert(
		__ATPRERUN__.length == 0,
		'cannot call main when preRun functions remain to be called'
	);

	var entryFunction = _main;

	var argc = 0;
	var argv = 0;

	try {
		var ret = entryFunction(argc, argv);

		// if we're not running an evented main loop, it's time to exit
		exitJS(ret, /* implicit = */ true);
		return ret;
	} catch (e) {
		return handleException(e);
	}
}

function stackCheckInit() {
	// This is normally called automatically during __wasm_call_ctors but need to
	// get these values before even running any of the ctors so we call it redundantly
	// here.
	_emscripten_stack_init();
	// TODO(sbc): Move writeStackCookie to native to to avoid this.
	writeStackCookie();
}

function run() {
	if (runDependencies > 0) {
		return;
	}

	stackCheckInit();

	preRun();

	// a preRun added a dependency, run will be called later
	if (runDependencies > 0) {
		return;
	}

	function doRun() {
		// run may have just been called through dependencies being fulfilled just in this very frame,
		// or while the async setStatus time below was happening
		if (calledRun) return;
		calledRun = true;
		Module['calledRun'] = true;

		if (ABORT) return;

		initRuntime();

		preMain();

		if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

		if (shouldRunNow) callMain();

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
	checkStackCookie();
}

function checkUnflushedContent() {
	// Compiler settings do not allow exiting the runtime, so flushing
	// the streams is not possible. but in ASSERTIONS mode we check
	// if there was something to flush, and if so tell the user they
	// should request that the runtime be exitable.
	// Normally we would not even include flush() at all, but in ASSERTIONS
	// builds we do so just for this check, and here we see if there is any
	// content to flush, that is, we check if there would have been
	// something a non-ASSERTIONS build would have not seen.
	// How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
	// mode (which has its own special function for this; otherwise, all
	// the code is inside libc)
	var oldOut = out;
	var oldErr = err;
	var has = false;
	out = err = (x) => {
		has = true;
	};
	try {
		// it doesn't matter if it fails
		// In WasmFS we must also flush the WasmFS internal buffers, for this check
		// to work.
		_wasmfs_flush();
	} catch (e) {}
	out = oldOut;
	err = oldErr;
	if (has) {
		warnOnce(
			'stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.'
		);
		warnOnce(
			'(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)'
		);
	}
}

if (Module['preInit']) {
	if (typeof Module['preInit'] == 'function')
		Module['preInit'] = [Module['preInit']];
	while (Module['preInit'].length > 0) {
		Module['preInit'].pop()();
	}
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;

if (Module['noInitialRun']) shouldRunNow = false;

run();

// end include: postamble.js
