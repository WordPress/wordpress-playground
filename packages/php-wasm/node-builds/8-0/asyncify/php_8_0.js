// Emscripten generates code for Node.js that uses the `require` function.
// We need to explicitly create a require function to avoid errors when running
// this code in Node.js as an ES module.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Note: The path and url modules are currently needed by code injected by the php-wasm Dockerfile.
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the current directory path. In CJS mode, __dirname is available.
// In ESM mode, we derive it from import.meta.url.
const currentDirPath =
	typeof __dirname !== 'undefined'
		? __dirname
		: path.dirname(fileURLToPath(import.meta.url));
const dependencyFilename = path.join(currentDirPath, '8_0_30', 'php_8_0.wasm');
export { dependencyFilename }; 
export const dependenciesTotalSize = 19057813; 
const phpVersionString = '8.0.30';
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
var Module = typeof PHPLoader != "undefined" ? PHPLoader : {};

var ENVIRONMENT_IS_WORKER=RuntimeName==="WORKER";

var ENVIRONMENT_IS_NODE=RuntimeName==="NODE";

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

var _scriptName;

if (typeof __filename != "undefined") {
  // Node
  _scriptName = __filename;
} else /*no-op*/ {}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require("fs");
  scriptDirectory = currentDirPath + "/";
  // include: node_shell_read.js
  readBinary = filename => {
    // We need to re-wrap `file://` strings to URLs.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename);
    return ret;
  };
  readAsync = async (filename, binary = true) => {
    // See the comment in the `readBinary` function.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
    return ret;
  };
  // end include: node_shell_read.js
  if (process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, "/");
  }
  arguments_ = process.argv.slice(2);
  // MODULARIZE will export the module in the proper place outside, we don't need to export here
  if (typeof module != "undefined") {
    module["exports"] = Module;
  }
  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };
} else // Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
{}

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

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */ var isFileURI = filename => filename.startsWith("file://");

// include: runtime_common.js
// include: runtime_stack_check.js
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
// end include: runtime_debug.js
// Memory management
var /** @type {!Int8Array} */ HEAP8, /** @type {!Uint8Array} */ HEAPU8, /** @type {!Int16Array} */ HEAP16, /** @type {!Uint16Array} */ HEAPU16, /** @type {!Int32Array} */ HEAP32, /** @type {!Uint32Array} */ HEAPU32, /** @type {!Float32Array} */ HEAPF32, /** @type {!Float64Array} */ HEAPF64;

// BigInt64Array type is not correctly defined in closure
var /** not-@type {!BigInt64Array} */ HEAP64, /* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */ HEAPU64;

var runtimeInitialized = false;

var runtimeExited = false;

function updateMemoryViews() {
  var b = wasmMemory.buffer;
  HEAP8 = new Int8Array(b);
  HEAP16 = new Int16Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  HEAPU16 = new Uint16Array(b);
  HEAP32 = new Int32Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
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
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
}

function initRuntime() {
  runtimeInitialized = true;
  callRuntimeCallbacks(__RELOC_FUNCS__);
  // Begin ATINITS hooks
  callRuntimeCallbacks(onInits);
  if (!Module["noFSInit"] && !FS.initialized) FS.init();
  TTY.init();
  SOCKFS.root = FS.mount(SOCKFS, {}, null);
  PIPEFS.root = FS.mount(PIPEFS, {}, null);
  // End ATINITS hooks
  wasmExports["__wasm_call_ctors"]();
  // Begin ATPOSTCTORS hooks
  callRuntimeCallbacks(onPostCtors);
  FS.ignorePermissions = false;
}

function preMain() {}

function exitRuntime() {
  // PThreads reuse the runtime from the main thread.
  ___funcs_on_exit();
  // Native atexit() functions
  // Begin ATEXITS hooks
  FS.quit();
  TTY.shutdown();
  // End ATEXITS hooks
  runtimeExited = true;
}

function postRun() {
  // PThreads reuse the runtime from the main thread.
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
}

/** @param {string|number=} what */ function abort(what) {
  Module["onAbort"]?.(what);
  what = "Aborted(" + what + ")";
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  what += ". Build with -sASSERTIONS for more info.";
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
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
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
  throw "both async and sync fetching of the wasm failed";
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
  if (!binary && !ENVIRONMENT_IS_NODE) {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  var imports = {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports,
    "GOT.mem": new Proxy(wasmImports, GOTHandler),
    "GOT.func": new Proxy(wasmImports, GOTHandler)
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    // No relocation needed here.. but calling this just so that updateGOT is
    // called.
    var origExports = wasmExports = relocateExports(wasmExports);
    wasmExports = Asyncify.instrumentWasmExports(wasmExports);
    mergeLibSymbols(wasmExports, "main");
    var metadata = getDylinkMetadata(module);
    if (metadata.neededDynlibs) {
      dynamicLibraries = metadata.neededDynlibs.concat(dynamicLibraries);
    }
    assignWasmExports(wasmExports);
    updateGOT(origExports);
    Module["wasmExports"] = wasmExports;
    LDSO.init();
    loadDylibs();
    updateMemoryViews();
    removeRunDependency("wasm-instantiate");
    return wasmExports;
  }
  addRunDependency("wasm-instantiate");
  // Prefer streaming instantiation if available.
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    return receiveInstance(result["instance"], result["module"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module["instantiateWasm"]) {
    return new Promise((resolve, reject) => {
      Module["instantiateWasm"](info, (inst, mod) => {
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
  name="ExitStatus";
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
      rtn = GOT[symName] = new WebAssembly.Global({
        "value": "i32",
        "mutable": true
      }, -1);
    }
    if (!currentModuleWeakSymbols.has(symName)) {
      // Any non-weak reference to a symbol marks it as `required`, which
      // enabled `reportUndefinedSymbols` to report undefined symbol errors
      // correctly.
      rtn.required = true;
    }
    return rtn;
  }
};

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var onPostRuns = [];

var addOnPostRun = cb => onPostRuns.push(cb);

var onPreRuns = [];

var addOnPreRun = cb => onPreRuns.push(cb);

var runDependencies = 0;

var dependenciesFulfilled = null;

var removeRunDependency = id => {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (runDependencies == 0) {
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
};

var addRunDependency = id => {
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
};

var dynCalls = {};

var dynCallLegacy = (sig, ptr, args) => {
  sig = sig.replace(/p/g, "i");
  var f = dynCalls[sig];
  return f(ptr, ...args);
};

var dynCall = (sig, ptr, args = [], promising = false) => {
  var rtn = dynCallLegacy(sig, ptr, args);
  function convert(rtn) {
    return rtn;
  }
  return convert(rtn);
};

var UTF8Decoder = globalThis.TextDecoder && new TextDecoder;

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
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
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
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

var getDylinkMetadata = binary => {
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
      ret += ((byte & 127) * mul);
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
  /** @param {string=} message */ function failIf(condition, message) {
    if (condition) throw new Error(message);
  }
  if (binary instanceof WebAssembly.Module) {
    var dylinkSection = WebAssembly.Module.customSections(binary, "dylink.0");
    failIf(dylinkSection.length === 0, "need dylink section");
    binary = new Uint8Array(dylinkSection[0]);
    end = binary.length;
  } else {
    var int32View = new Uint32Array(new Uint8Array(binary.subarray(0, 24)).buffer);
    var magicNumberFound = int32View[0] == 1836278016;
    failIf(!magicNumberFound, "need to see wasm magic number");
    // \0asm
    // we should see the dylink custom section right after the magic number and wasm version
    failIf(binary[8] !== 0, "need the dylink section to be first");
    offset = 9;
    var section_size = getLEB();
    //section size
    end = offset + section_size;
    var name = getString();
    failIf(name !== "dylink.0");
  }
  var customSection = {
    neededDynlibs: [],
    tlsExports: new Set,
    weakImports: new Set,
    runtimePaths: []
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
        if ((flags & WASM_SYMBOL_BINDING_MASK) == WASM_SYMBOL_BINDING_WEAK) {
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

var newDSO = (name, handle, syms) => {
  var dso = {
    refcount: Infinity,
    name,
    exports: syms,
    global: true
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
    newDSO("__main__", 0, wasmImports);
  }
};

var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;

var getMemory = size => {
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
  HEAPU32[((sbrk_ptr) >> 2)] = end;
  return ret;
};

var isInternalSym = symName => [ "memory", "__memory_base", "__table_base", "__stack_pointer", "__indirect_function_table", "__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js" ].includes(symName) || symName.startsWith("__em_js__");

var wasmTableMirror = [];

var getWasmTableEntry = funcPtr => {
  var func = wasmTableMirror[funcPtr];
  if (!func) {
    /** @suppress {checkTypes} */ wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
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

var getFunctionAddress = func => {
  // First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap;
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
  return wasmTable["grow"](1);
};

var setWasmTableEntry = (idx, func) => {
  /** @suppress {checkTypes} */ wasmTable.set(idx, func);
  // With ABORT_ON_WASM_EXCEPTIONS wasmTable.get is overridden to return wrapped
  // functions so we need to call it here to retrieve the potential wrapper correctly
  // instead of just storing 'func' directly into wasmTableMirror
  /** @suppress {checkTypes} */ wasmTableMirror[idx] = wasmTable.get(idx);
};

var uleb128EncodeWithLen = arr => {
  const n = arr.length;
  // Note: this LEB128 length encoding produces extra byte for n < 128,
  // but we don't care as it's only used in a temporary representation.
  return [ (n % 128) | 128, n >> 7, ...arr ];
};

var wasmTypeCodes = {
  "i": 127,
  // i32
  "p": 127,
  // i32
  "j": 126,
  // i64
  "f": 125,
  // f32
  "d": 124,
  // f64
  "e": 111
};

var generateTypePack = types => uleb128EncodeWithLen(Array.from(types, type => {
  var code = wasmTypeCodes[type];
  return code;
}));

var convertJsFunctionToWasm = (func, sig) => {
  // Rest of the module is static
  var bytes = Uint8Array.of(0, 97, 115, 109, // magic ("\0asm")
  1, 0, 0, 0, // version: 1
  1, // Type section code
  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  ...uleb128EncodeWithLen([ 1, // count: 1
  96, // param types
  ...generateTypePack(sig.slice(1)), // return types (for now only supporting [] if `void` and single [T] otherwise)
  ...generateTypePack(sig[0] === "v" ? "" : sig[0]) ]), // The rest of the module is static
  2, 7, // import section
  // (import "e" "f" (func 0 (type 0)))
  1, 1, 101, 1, 102, 0, 0, 7, 5, // export section
  // (export "f" (func 0 (type 0)))
  1, 1, 102, 0, 0);
  // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    "e": {
      "f": func
    }
  });
  var wrappedFunc = instance.exports["f"];
  return wrappedFunc;
};

/** @param {string=} sig */ var addFunction = (func, sig) => {
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

/** @param {boolean=} replace */ var updateGOT = (exports, replace) => {
  for (var symName in exports) {
    if (isInternalSym(symName)) {
      continue;
    }
    var value = exports[symName];
    var existingEntry = GOT[symName] && GOT[symName].value != -1;
    if (replace || !existingEntry) {
      var newValue;
      if (typeof value == "function") {
        newValue = addFunction(value);
      } else if (typeof value == "number") {
        newValue = value;
      } else {
        // The GOT can only contain addresses (i.e data addresses or function
        // addresses so we currently ignore other types export here.
        continue;
      }
      GOT[symName] ??= new WebAssembly.Global({
        "value": "i32",
        "mutable": true
      });
      GOT[symName].value = newValue;
    }
  }
};

var isImmutableGlobal = val => {
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

var isSymbolDefined = symName => {
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

var createNamedFunction = (name, func) => Object.defineProperty(func, "name", {
  value: name
});

var stackSave = () => _emscripten_stack_get_current();

var stackRestore = val => __emscripten_stack_restore(val);

var createInvokeFunction = sig => (ptr, ...args) => {
  var sp = stackSave();
  try {
    return dynCall(sig, ptr, args);
  } catch (e) {
    stackRestore(sp);
    // Create a try-catch guard that rethrows the Emscripten EH exception.
    // Exceptions thrown from C++ will be a pointer (number) and longjmp
    // will throw the number Infinity. Use the compact and fast "e !== e+0"
    // test to check if e was not a Number.
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
    // In theory this if statement could be done on
    // creating the function, but I just added this to
    // save wasting code space as it only happens on exception.
    if (sig[0] == "j") return 0n;
  }
};

var resolveGlobalSymbol = (symName, direct = false) => {
  var sym;
  if (isSymbolDefined(symName)) {
    sym = wasmImports[symName];
  } else if (symName.startsWith("invoke_")) {
    // Create (and cache) new invoke_ functions on demand.
    sym = wasmImports[symName] = createNamedFunction(symName, createInvokeFunction(symName.split("_")[1]));
  }
  return {
    sym,
    name: symName
  };
};

var onPostCtors = [];

var addOnPostCtor = cb => onPostCtors.push(cb);

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
     */ var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : "";

/**
      * @param {string=} libName
      * @param {Object=} localScope
      * @param {number=} handle
      */ var loadWebAssemblyModule = (binary, flags, libName, localScope, handle) => {
  var metadata = getDylinkMetadata(binary);
  // loadModule loads the wasm module after all its dependencies have been loaded.
  // can be called both sync/async.
  function loadModule() {
    // alignments are powers of 2
    var memAlign = Math.pow(2, metadata.memoryAlign);
    // prepare memory
    var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
    // TODO: add to cleanups
    var tableBase = metadata.tableSize ? wasmTable.length : 0;
    if (handle) {
      HEAP8[(handle) + (8)] = 1;
      HEAPU32[(((handle) + (12)) >> 2)] = memoryBase;
      HEAP32[(((handle) + (16)) >> 2)] = metadata.memorySize;
      HEAPU32[(((handle) + (20)) >> 2)] = tableBase;
      HEAP32[(((handle) + (24)) >> 2)] = metadata.tableSize;
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
         case "__memory_base":
          return memoryBase;

         case "__table_base":
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
      }
    };
    var proxy = new Proxy({}, proxyHandler);
    currentModuleWeakSymbols = metadata.weakImports;
    var info = {
      "GOT.mem": new Proxy({}, GOTHandler),
      "GOT.func": new Proxy({}, GOTHandler),
      "env": proxy,
      "wasi_snapshot_preview1": proxy
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
        for (var arity = 0; ;arity++) {
          var argName = "$" + arity;
          if (!body.includes(argName)) break;
          args.push(argName);
        }
        args = args.join(",");
        var func = `(${args}) => { ${body} };`;
        ASM_CONSTS[start] = eval(func);
      }
      // Add any EM_ASM function that exist in the side module
      if ("__start_em_asm" in moduleExports) {
        var start = moduleExports["__start_em_asm"];
        var stop = moduleExports["__stop_em_asm"];
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
        if (cSig != "void") {
          cSig = cSig.split(",");
          for (var arg of cSig) {
            var jsArg = arg.split(" ").pop();
            jsArgs.push(jsArg.replace("*", ""));
          }
        }
        var func = `(${jsArgs}) => ${body};`;
        moduleExports[name] = eval(func);
      }
      for (var name in moduleExports) {
        if (name.startsWith("__em_js__")) {
          var start = moduleExports[name];
          var jsString = UTF8ToString(start);
          // EM_JS strings are stored in the data section in the form
          // SIG<::>BODY.
          var [sig, body] = jsString.split("<::>");
          addEmJs(name.replace("__em_js__", ""), sig, body);
          delete moduleExports[name];
        }
      }
      // initialize the module
      var applyRelocs = moduleExports["__wasm_apply_data_relocs"];
      if (applyRelocs) {
        if (runtimeInitialized) {
          applyRelocs();
        } else {
          __RELOC_FUNCS__.push(applyRelocs);
        }
      }
      var init = moduleExports["__wasm_call_ctors"];
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
          (((({module: binary, instance} = await WebAssembly.instantiate(binary, info)))));
        }
        return postInstantiation(binary, instance);
      })();
    }
    var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
    var instance = new WebAssembly.Instance(module, info);
    return postInstantiation(module, instance);
  }
  // We need to set rpath in flags based on the current library's rpath.
  // We can't mutate flags or else if a depends on b and c and b depends on d,
  // then c will be loaded with b's rpath instead of a's.
  flags = {
    ...flags,
    rpath: {
      parentLibPath: libName,
      paths: metadata.runtimePaths
    }
  };
  // now load needed libraries and the module itself.
  if (flags.loadAsync) {
    return metadata.neededDynlibs.reduce((chain, dynNeeded) => chain.then(() => loadDynamicLibrary(dynNeeded, flags, localScope)), Promise.resolve()).then(loadModule);
  }
  for (var needed of metadata.neededDynlibs) {
    loadDynamicLibrary(needed, flags, localScope);
  }
  return loadModule();
};

var mergeLibSymbols = (exports, libName) => {
  registerDynCallSymbols(exports);
  // add symbols into global namespace TODO: weak linking etc.
  for (var [sym, exp] of Object.entries(exports)) {
    // When RTLD_GLOBAL is enabled, the symbols defined by this shared object
    // will be made available for symbol resolution of subsequently loaded
    // shared objects.
    // We should copy the symbols (which include methods and variables) from
    // SIDE_MODULE to MAIN_MODULE.
    const setImport = target => {
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
    const main_alias = "__main_argc_argv";
    if (sym == "main") {
      setImport(main_alias);
    }
    if (sym == main_alias) {
      setImport("main");
    }
  }
};

var asyncLoad = async url => {
  var arrayBuffer = await readAsync(url);
  return new Uint8Array(arrayBuffer);
};

var preloadPlugins = [];

var registerWasmPlugin = () => {
  // Use string keys here for public methods to avoid minification since the
  // plugin consumer also uses string keys.
  var wasmPlugin = {
    promiseChainEnd: Promise.resolve(),
    "canHandle": name => !Module["noWasmDecoding"] && name.endsWith(".so"),
    "handle": async (byteArray, name) => // loadWebAssemblyModule can not load modules out-of-order, so rather
    // than just running the promises in parallel, this makes a chain of
    // promises to run in series.
    wasmPlugin.promiseChainEnd = wasmPlugin.promiseChainEnd.then(async () => {
      try {
        var exports = await loadWebAssemblyModule(byteArray, {
          loadAsync: true,
          nodelete: true
        }, name, {});
      } catch (error) {
        throw new Error(`failed to instantiate wasm: ${name}: ${error}`);
      }
      preloadedWasm[name] = exports;
      return byteArray;
    })
  };
  preloadPlugins.push(wasmPlugin);
};

var preloadedWasm = {};

var PATH = {
  isAbs: path => path.charAt(0) === "/",
  splitPath: filename => {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (;up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: path => {
    var isAbsolute = PATH.isAbs(path), trailingSlash = path.slice(-1) === "/";
    // Normalize the path
    path = PATH.normalizeArray(path.split("/").filter(p => !!p), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: path => {
    var result = PATH.splitPath(path), root = result[0], dir = result[1];
    if (!root && !dir) {
      // No dirname whatsoever
      return ".";
    }
    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.slice(0, -1);
    }
    return root + dir;
  },
  basename: path => path && path.match(/([^\/]+|\/)\/*$/)[1],
  join: (...paths) => PATH.normalize(paths.join("/")),
  join2: (l, r) => PATH.normalize(l + "/" + r)
};

var replaceORIGIN = (parentLibName, rpath) => {
  if (rpath.startsWith("$ORIGIN")) {
    // TODO: what to do if we only know the relative path of the file? It will return "." here.
    var origin = PATH.dirname(parentLibName);
    return rpath.replace("$ORIGIN", origin);
  }
  return rpath;
};

var withStackSave = f => {
  var stack = stackSave();
  var ret = f();
  stackRestore(stack);
  return ret;
};

var stackAlloc = sz => __emscripten_stack_alloc(sz);

var lengthBytesUTF8 = str => {
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

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
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
      // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
      // We need to manually skip over the second code unit for correct iteration.
      i++;
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
};

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);

var stringToUTF8OnStack = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8(str, ret, size);
  return ret;
};

var initRandomFill = () => view => crypto.getRandomValues(view);

var randomFill = view => {
  // Lazily init on the first invocation.
  (randomFill = initRandomFill())(view);
};

var PATH_FS = {
  resolve: (...args) => {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? args[i] : FS.cwd();
      // Skip empty and invalid entries
      if (typeof path != "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p => !!p), !resolvedAbsolute).join("/");
    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).slice(1);
    to = PATH_FS.resolve(to).slice(1);
    function trim(arr) {
      var start = 0;
      for (;start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (;end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
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
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
};

var FS_stdin_getChar_buffer = [];

/** @type {function(string, boolean=, number=)} */ var intArrayFromString = (stringy, dontAddNull, length) => {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
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
        if (e.toString().includes("EOF")) bytesRead = 0; else throw e;
      }
      if (bytesRead > 0) {
        result = buf.slice(0, bytesRead).toString("utf-8");
      }
    } else {}
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
      ops
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
    }
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
        c_cc: [ 3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
      };
    },
    ioctl_tcsets(tty, optional_actions, data) {
      // currently just ignore
      return 0;
    },
    ioctl_tiocgwinsz(tty) {
      return [ 24, 80 ];
    }
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
    }
  }
};

var zeroMemory = (ptr, size) => HEAPU8.fill(0, ptr, ptr + size);

var mmapAlloc = size => {
  size = alignMemory(size, 65536);
  var ptr = _emscripten_builtin_memalign(65536, size);
  if (ptr) zeroMemory(ptr, size);
  return ptr;
};

var MEMFS = {
  ops_table: null,
  mount(mount) {
    return MEMFS.createNode(null, "/", 16895, 0);
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
          symlink: MEMFS.node_ops.symlink
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek
        }
      },
      file: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek,
          read: MEMFS.stream_ops.read,
          write: MEMFS.stream_ops.write,
          mmap: MEMFS.stream_ops.mmap,
          msync: MEMFS.stream_ops.msync
        }
      },
      link: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          readlink: MEMFS.node_ops.readlink
        },
        stream: {}
      },
      chrdev: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: FS.chrdev_stream_ops
      }
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
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
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
    newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0);
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    // At minimum allocate 256b for each file when expanding.
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    // Allocate new storage.
    if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
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
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
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
      for (const key of [ "mode", "atime", "mtime", "ctime" ]) {
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
        /** @suppress {checkTypes} */ MEMFS.doesNotExistError.stack = "<generic error, no stack>";
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
      new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
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
      return [ ".", "..", ...Object.keys(node.contents) ];
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
    }
  },
  stream_ops: {
    read(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      if (size > 8 && contents.subarray) {
        // non-trivial, and typed array
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
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
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        // This write is from a typed array to a typed array?
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
          node.contents = buffer.slice(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          // Writing to an already allocated and used subrange of the file?
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) {
        // Use typed array write which is available.
        node.contents.set(buffer.subarray(offset, offset + length), position);
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
      if (!(flags & 2) && contents && contents.buffer === HEAP8.buffer) {
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
          if (position > 0 || position + length < contents.length) {
            if (contents.subarray) {
              contents = contents.subarray(position, position + length);
            } else {
              contents = Array.prototype.slice.call(contents, position, position + length);
            }
          }
          HEAP8.set(contents, ptr);
        }
      }
      return {
        ptr,
        allocated
      };
    },
    msync(stream, buffer, offset, length, mmapFlags) {
      MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      // should we check if bytesWritten and length are the same?
      return 0;
    }
  }
};

var FS_modeStringToFlags = str => {
  var flagModes = {
    "r": 0,
    "r+": 2,
    "w": 512 | 64 | 1,
    "w+": 512 | 64 | 2,
    "a": 1024 | 64 | 1,
    "a+": 1024 | 64 | 2
  };
  var flags = flagModes[str];
  if (typeof flags == "undefined") {
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
  "EPERM": 63,
  "ENOENT": 44,
  "ESRCH": 71,
  "EINTR": 27,
  "EIO": 29,
  "ENXIO": 60,
  "E2BIG": 1,
  "ENOEXEC": 45,
  "EBADF": 8,
  "ECHILD": 12,
  "EAGAIN": 6,
  "EWOULDBLOCK": 6,
  "ENOMEM": 48,
  "EACCES": 2,
  "EFAULT": 21,
  "ENOTBLK": 105,
  "EBUSY": 10,
  "EEXIST": 20,
  "EXDEV": 75,
  "ENODEV": 43,
  "ENOTDIR": 54,
  "EISDIR": 31,
  "EINVAL": 28,
  "ENFILE": 41,
  "EMFILE": 33,
  "ENOTTY": 59,
  "ETXTBSY": 74,
  "EFBIG": 22,
  "ENOSPC": 51,
  "ESPIPE": 70,
  "EROFS": 69,
  "EMLINK": 34,
  "EPIPE": 64,
  "EDOM": 18,
  "ERANGE": 68,
  "ENOMSG": 49,
  "EIDRM": 24,
  "ECHRNG": 106,
  "EL2NSYNC": 156,
  "EL3HLT": 107,
  "EL3RST": 108,
  "ELNRNG": 109,
  "EUNATCH": 110,
  "ENOCSI": 111,
  "EL2HLT": 112,
  "EDEADLK": 16,
  "ENOLCK": 46,
  "EBADE": 113,
  "EBADR": 114,
  "EXFULL": 115,
  "ENOANO": 104,
  "EBADRQC": 103,
  "EBADSLT": 102,
  "EDEADLOCK": 16,
  "EBFONT": 101,
  "ENOSTR": 100,
  "ENODATA": 116,
  "ETIME": 117,
  "ENOSR": 118,
  "ENONET": 119,
  "ENOPKG": 120,
  "EREMOTE": 121,
  "ENOLINK": 47,
  "EADV": 122,
  "ESRMNT": 123,
  "ECOMM": 124,
  "EPROTO": 65,
  "EMULTIHOP": 36,
  "EDOTDOT": 125,
  "EBADMSG": 9,
  "ENOTUNIQ": 126,
  "EBADFD": 127,
  "EREMCHG": 128,
  "ELIBACC": 129,
  "ELIBBAD": 130,
  "ELIBSCN": 131,
  "ELIBMAX": 132,
  "ELIBEXEC": 133,
  "ENOSYS": 52,
  "ENOTEMPTY": 55,
  "ENAMETOOLONG": 37,
  "ELOOP": 32,
  "EOPNOTSUPP": 138,
  "EPFNOSUPPORT": 139,
  "ECONNRESET": 15,
  "ENOBUFS": 42,
  "EAFNOSUPPORT": 5,
  "EPROTOTYPE": 67,
  "ENOTSOCK": 57,
  "ENOPROTOOPT": 50,
  "ESHUTDOWN": 140,
  "ECONNREFUSED": 14,
  "EADDRINUSE": 3,
  "ECONNABORTED": 13,
  "ENETUNREACH": 40,
  "ENETDOWN": 38,
  "ETIMEDOUT": 73,
  "EHOSTDOWN": 142,
  "EHOSTUNREACH": 23,
  "EINPROGRESS": 26,
  "EALREADY": 7,
  "EDESTADDRREQ": 17,
  "EMSGSIZE": 35,
  "EPROTONOSUPPORT": 66,
  "ESOCKTNOSUPPORT": 137,
  "EADDRNOTAVAIL": 4,
  "ENETRESET": 39,
  "EISCONN": 30,
  "ENOTCONN": 53,
  "ETOOMANYREFS": 141,
  "EUSERS": 136,
  "EDQUOT": 19,
  "ESTALE": 72,
  "ENOTSUP": 138,
  "ENOMEDIUM": 148,
  "EILSEQ": 25,
  "EOVERFLOW": 61,
  "ECANCELED": 11,
  "ENOTRECOVERABLE": 56,
  "EOWNERDEAD": 62,
  "ESTRPIPE": 135
};

var NODEFS = {
  isWindows: false,
  staticInit() {
    NODEFS.isWindows = !!process.platform.match(/^win/);
    var flags = process.binding("constants")["fs"];
    NODEFS.flagsForNodeMap = {
      1024: flags["O_APPEND"],
      64: flags["O_CREAT"],
      128: flags["O_EXCL"],
      256: flags["O_NOCTTY"],
      0: flags["O_RDONLY"],
      2: flags["O_RDWR"],
      4096: flags["O_SYNC"],
      512: flags["O_TRUNC"],
      1: flags["O_WRONLY"],
      131072: flags["O_NOFOLLOW"]
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
      if (e.code === "UNKNOWN") throw new FS.ErrnoError(28);
      throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
    }
  },
  mount(mount) {
    return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
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
        stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
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
      blocks: stat.blocks
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
      if (typeof (attr.atime ?? attr.mtime) === "number") {
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
      NODEFS.setattr(path, node, attr, fs.chmodSync, fs.utimesSync, fs.truncateSync, fs.lstatSync);
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
          fs.writeFileSync(path, "", {
            mode: node.mode
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
    }
  },
  stream_ops: {
    getattr(stream) {
      return NODEFS.getattr(() => fs.fstatSync(stream.nfd), stream.node);
    },
    setattr(stream, attr) {
      NODEFS.setattr(stream.nfd, stream.node, attr, fs.fchmodSync, fs.futimesSync, fs.ftruncateSync, fs.fstatSync);
    },
    open(stream) {
      var path = NODEFS.realPath(stream.node);
      NODEFS.tryFSOperation(() => {
        stream.shared.refcount = 1;
        stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
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
      return NODEFS.tryFSOperation(() => fs.readSync(stream.nfd, new Int8Array(buffer.buffer, offset, length), 0, length, position));
    },
    write(stream, buffer, offset, length, position) {
      return NODEFS.tryFSOperation(() => fs.writeSync(stream.nfd, new Int8Array(buffer.buffer, offset, length), 0, length, position));
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
        allocated: true
      };
    },
    msync(stream, buffer, offset, length, mmapFlags) {
      NODEFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      // should we check if bytesWritten and length are the same?
      return 0;
    }
  }
};

var PROXYFS = {
  mount(mount) {
    return PROXYFS.createNode(null, "/", mount.opts.fs.lstat(mount.opts.root).mode, 0);
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
        blocks: stat.blocks
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
          node.mount.opts.fs.writeFile(path, "", {
            mode: node.mode
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
    }
  },
  stream_ops: {
    open(stream) {
      var path = PROXYFS.realPath(stream.node);
      try {
        stream.nfd = stream.node.mount.opts.fs.open(path, stream.flags);
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
        return stream.node.mount.opts.fs.read(stream.nfd, buffer, offset, length, position);
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    write(stream, buffer, offset, length, position) {
      try {
        return stream.node.mount.opts.fs.write(stream.nfd, buffer, offset, length, position);
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
            var stat = stream.node.node_ops.getattr(stream.node);
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
    }
  }
};

var FS_createDataFile = (...args) => FS.createDataFile(...args);

var getUniqueRunDependency = id => id;

var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
  // Ensure plugins are ready.
  if (typeof Browser != "undefined") Browser.init();
  for (var plugin of preloadPlugins) {
    if (plugin["canHandle"](fullname)) {
      return plugin["handle"](byteArray, fullname);
    }
  }
  // In no plugin handled this file then return the original/unmodified
  // byteArray.
  return byteArray;
};

var FS_preloadFile = async (parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) => {
  // TODO we should allow people to just pass in a complete filename instead
  // of parent and name being that we just join them anyways
  var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency(`cp ${fullname}`);
  // might have several active requests for the same fullname
  addRunDependency(dep);
  try {
    var byteArray = url;
    if (typeof url == "string") {
      byteArray = await asyncLoad(url);
    }
    byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
    preFinish?.();
    if (!dontCreateFile) {
      FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
    }
  } finally {
    removeRunDependency(dep);
  }
};

var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
  FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish).then(onload).catch(onerror);
};

var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  filesystems: null,
  syncFSRequests: 0,
  readFiles: {},
  ErrnoError: class {
    name="ErrnoError";
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
    shared={};
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
      return (this.flags & 1024);
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
    node_ops={};
    stream_ops={};
    readMode=292 | 73;
    writeMode=146;
    mounted=null;
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
      val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
    }
    get write() {
      return (this.mode & this.writeMode) === this.writeMode;
    }
    set write(val) {
      val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
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
      path = FS.cwd() + "/" + path;
    }
    // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
    linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
      // split the absolute path
      var parts = path.split("/").filter(p => !!p);
      // start at the root
      var current = FS.root;
      var current_path = "/";
      for (var i = 0; i < parts.length; i++) {
        var islast = (i === parts.length - 1);
        if (islast && opts.parent) {
          // stop resolving
          break;
        }
        if (parts[i] === ".") {
          continue;
        }
        if (parts[i] === "..") {
          current_path = PATH.dirname(current_path);
          if (FS.isRoot(current)) {
            path = current_path + "/" + parts.slice(i + 1).join("/");
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
          if ((e?.errno === 44) && islast && opts.noent_okay) {
            return {
              path: current_path
            };
          }
          throw e;
        }
        // jump to the mount's root node if this is a mountpoint
        if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
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
            link = PATH.dirname(current_path) + "/" + link;
          }
          path = link + "/" + parts.slice(i + 1).join("/");
          continue linkloop;
        }
      }
      return {
        path: current_path,
        node: current
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
        return mount[mount.length - 1] !== "/" ? `${mount}/${path}` : mount + path;
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
    var perms = [ "r", "w", "rw" ][flag & 3];
    if ((flag & 512)) {
      perms += "w";
    }
    return perms;
  },
  nodePermissions(node, perms) {
    if (FS.ignorePermissions) {
      return 0;
    }
    // return 0 if any user, group or owner bits are set.
    if (perms.includes("r") && !(node.mode & 292)) {
      return 2;
    } else if (perms.includes("w") && !(node.mode & 146)) {
      return 2;
    } else if (perms.includes("x") && !(node.mode & 73)) {
      return 2;
    }
    return 0;
  },
  mayLookup(dir) {
    if (!FS.isDir(dir.mode)) return 54;
    var errCode = FS.nodePermissions(dir, "x");
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
    return FS.nodePermissions(dir, "wx");
  },
  mayDelete(dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var errCode = FS.nodePermissions(dir, "wx");
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
      if (FS.flagsToPermissionString(flags) !== "r" || (flags & (512 | 64))) {
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
  getStream: fd => FS.streams[fd],
  createStream(stream, fd = -1) {
    // clone it, so we can return an instance of FSStream
    stream = Object.assign(new FS.FSStream, stream);
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
    }
  },
  major: dev => ((dev) >> 8),
  minor: dev => ((dev) & 255),
  makedev: (ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
    FS.devices[dev] = {
      stream_ops: ops
    };
  },
  getDevice: dev => FS.devices[dev],
  getMounts(mount) {
    var mounts = [];
    var check = [ mount ];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push(...m.mounts);
    }
    return mounts;
  },
  syncfs(populate, callback) {
    if (typeof populate == "function") {
      callback = populate;
      populate = false;
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
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
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(10);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      mountpoint = lookup.path;
      // use the absolute path
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(10);
      }
      
    }
    var mount = {
      type,
      opts,
      mountpoint,
      mounts: []
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
      follow_mount: false
    });
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
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name) {
      throw new FS.ErrnoError(28);
    }
    if (name === "." || name === "..") {
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
    return FS.statfsNode(FS.lookupPath(path, {
      follow: true
    }).node);
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
      namelen: 255
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
    var dirs = path.split("/");
    var d = "";
    for (var dir of dirs) {
      if (!dir) continue;
      if (d || PATH.isAbs(path)) d += "/";
      d += dir;
      try {
        FS.mkdir(d, mode);
      } catch (e) {
        if (e.errno != 20) throw e;
      }
    }
  },
  mkdev(path, mode, dev) {
    if (typeof dev == "undefined") {
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
      parent: true
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
      parent: true
    });
    old_dir = lookup.node;
    lookup = FS.lookupPath(new_path, {
      parent: true
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
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(28);
    }
    // new path should not be an ancestor of the old path
    relative = PATH_FS.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
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
    errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(10);
    }
    // if we are going to change the parent, check write permissions
    if (new_dir !== old_dir) {
      errCode = FS.nodePermissions(old_dir, "w");
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
      parent: true
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
      follow: true
    });
    var node = lookup.node;
    var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
    return readdir(node);
  },
  unlink(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
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
      follow: !dontFollow
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
      dontFollow
    });
  },
  chmod(path, mode, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
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
      dontFollow
    });
  },
  chown(path, uid, gid, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
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
    var errCode = FS.nodePermissions(node, "w");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.doSetAttr(stream, node, {
      size: len,
      timestamp: Date.now()
    });
  },
  truncate(path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(28);
    }
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: true
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
      follow: true
    });
    var node = lookup.node;
    var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
    setattr(node, {
      atime,
      mtime
    });
  },
  open(path, flags, mode = 438) {
    if (path === "") {
      throw new FS.ErrnoError(44);
    }
    flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
    if ((flags & 64)) {
      mode = (mode & 4095) | 32768;
    } else {
      mode = 0;
    }
    var node;
    var isDirPath;
    if (typeof path == "object") {
      node = path;
    } else {
      isDirPath = path.endsWith("/");
      // noent_okay makes it so that if the final component of the path
      // doesn't exist, lookupPath returns `node: undefined`. `path` will be
      // updated to point to the target of all symlinks.
      var lookup = FS.lookupPath(path, {
        follow: !(flags & 131072),
        noent_okay: true
      });
      node = lookup.node;
      path = lookup.path;
    }
    // perhaps we need to create the node
    var created = false;
    if ((flags & 64)) {
      if (node) {
        // if O_CREAT and O_EXCL are set, error out if the node already exists
        if ((flags & 128)) {
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
    if ((flags & 65536) && !FS.isDir(node.mode)) {
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
    if ((flags & 512) && !created) {
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
      error: false
    });
    // call the new stream's open function
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (created) {
      FS.chmod(node, mode & 511);
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
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
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
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
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
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
    if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
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
    return stream.stream_ops.mmap(stream, length, position, prot, flags);
  },
  msync(stream, buffer, offset, length, mmapFlags) {
    if (!stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
  },
  ioctl(stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(59);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
  },
  readFile(path, opts = {}) {
    opts.flags = opts.flags || 0;
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      abort(`Invalid encoding type "${opts.encoding}"`);
    }
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      buf = UTF8ArrayToString(buf);
    }
    FS.close(stream);
    return buf;
  },
  writeFile(path, data, opts = {}) {
    opts.flags = opts.flags || 577;
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data == "string") {
      data = new Uint8Array(intArrayFromString(data, true));
    }
    if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
    } else {
      abort("Unsupported data type");
    }
    FS.close(stream);
  },
  cwd: () => FS.currentPath,
  chdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    if (lookup.node === null) {
      throw new FS.ErrnoError(44);
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(54);
    }
    var errCode = FS.nodePermissions(lookup.node, "x");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.currentPath = lookup.path;
  },
  createDefaultDirectories() {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user");
  },
  createDefaultDevices() {
    // create /dev
    FS.mkdir("/dev");
    // setup /dev/null
    FS.registerDevice(FS.makedev(1, 3), {
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => length,
      llseek: () => 0
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    // setup /dev/tty and /dev/tty1
    // stderr needs to print output using err() rather than out()
    // so we register a second tty just for it.
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    // setup /dev/[u]random
    // use a buffer to avoid overhead of individual crypto calls per byte
    var randomBuffer = new Uint8Array(1024), randomLeft = 0;
    var randomByte = () => {
      if (randomLeft === 0) {
        randomFill(randomBuffer);
        randomLeft = randomBuffer.byteLength;
      }
      return randomBuffer[--randomLeft];
    };
    FS.createDevice("/dev", "random", randomByte);
    FS.createDevice("/dev", "urandom", randomByte);
    // we're not going to emulate the actual shm device,
    // just create the tmp dirs that reside in it commonly
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp");
  },
  createSpecialDirectories() {
    // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
    // name of the stream for fd 6 (see test_unistd_ttyname)
    FS.mkdir("/proc");
    var proc_self = FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount({
      mount() {
        var node = FS.createNode(proc_self, "fd", 16895, 73);
        node.stream_ops = {
          llseek: MEMFS.stream_ops.llseek
        };
        node.node_ops = {
          lookup(parent, name) {
            var fd = +name;
            var stream = FS.getStreamChecked(fd);
            var ret = {
              parent: null,
              mount: {
                mountpoint: "fake"
              },
              node_ops: {
                readlink: () => stream.path
              },
              id: fd + 1
            };
            ret.parent = ret;
            // make it look like a simple root node
            return ret;
          },
          readdir() {
            return Array.from(FS.streams.entries()).filter(([k, v]) => v).map(([k, v]) => k.toString());
          }
        };
        return node;
      }
    }, {}, "/proc/self/fd");
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
      FS.createDevice("/dev", "stdin", input);
    } else {
      FS.symlink("/dev/tty", "/dev/stdin");
    }
    if (output) {
      FS.createDevice("/dev", "stdout", null, output);
    } else {
      FS.symlink("/dev/tty", "/dev/stdout");
    }
    if (error) {
      FS.createDevice("/dev", "stderr", null, error);
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr");
    }
    // open default streams for the stdin, stdout and stderr devices
    var stdin = FS.open("/dev/stdin", 0);
    var stdout = FS.open("/dev/stdout", 1);
    var stderr = FS.open("/dev/stderr", 1);
  },
  staticInit() {
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = {
      "MEMFS": MEMFS,
      "NODEFS": NODEFS,
      "PROXYFS": PROXYFS
    };
  },
  init(input, output, error) {
    FS.initialized = true;
    // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
    input ??= Module["stdin"];
    output ??= Module["stdout"];
    error ??= Module["stderr"];
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
        follow: !dontResolveLastLink
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
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/";
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  },
  createPath(parent, path, canRead, canWrite) {
    parent = typeof parent == "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
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
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(canRead, canWrite);
    return FS.create(path, mode);
  },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
    var path = name;
    if (parent) {
      parent = typeof parent == "string" ? parent : FS.getPath(parent);
      path = name ? PATH.join2(parent, name) : parent;
    }
    var mode = FS_getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data == "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
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
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
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
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  forceLoadFile(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    if (globalThis.XMLHttpRequest) {
      abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
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
      lengthKnown=false;
      chunks=[];
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
        var xhr = new XMLHttpRequest;
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
        var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
        var chunkSize = 1024 * 1024;
        // Chunk size in bytes
        if (!hasByteServing) chunkSize = datalength;
        // Function to get a range from the remote URL.
        var doXHR = (from, to) => {
          if (from > to) abort("invalid range (" + from + ", " + to + ") or no bytes requested!");
          if (to > datalength - 1) abort("only " + datalength + " bytes available! programmer error!");
          // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          // Some hints to the browser that we want binary data.
          xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
          }
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(/** @type{Array<number>} */ (xhr.response || []));
          }
          return intArrayFromString(xhr.responseText || "", true);
        };
        var lazyArray = this;
        lazyArray.setDataGetter(chunkNum => {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          // including this byte
          end = Math.min(end, datalength - 1);
          // if datalength-1 is selected, this is the last block
          if (typeof lazyArray.chunks[chunkNum] == "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end);
          }
          if (typeof lazyArray.chunks[chunkNum] == "undefined") abort("doXHR failed!");
          return lazyArray.chunks[chunkNum];
        });
        if (usesGzip || !datalength) {
          // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
          chunkSize = datalength = 1;
          // this will force getter(0)/doXHR do download the whole file
          datalength = this.getter(0).length;
          chunkSize = datalength;
          out("LazyFiles on gzip forces download of the whole file when length is accessed");
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
      if (!ENVIRONMENT_IS_WORKER) abort("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");
      var lazyArray = new LazyUint8Array;
      var properties = {
        isDevice: false,
        contents: lazyArray
      };
    } else {
      var properties = {
        isDevice: false,
        url
      };
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
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
        get: function() {
          return this.contents.length;
        }
      }
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
      return {
        ptr,
        allocated: true
      };
    };
    node.stream_ops = stream_ops;
    return node;
  }
};

var findLibraryFS = (libName, rpath) => {
  // If we're preloading a dynamic library, the runtime is not ready to call
  // __wasmfs_identify or __emscripten_find_dylib. So just quit out.
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
  var rpathResolved = (rpath?.paths || []).map(p => replaceORIGIN(rpath?.parentLibPath, p));
  return withStackSave(() => {
    // In dylink.c we use: `char buf[2*NAME_MAX+2];` and NAME_MAX is 255.
    // So we use the same size here.
    var bufSize = 2 * 255 + 2;
    var buf = stackAlloc(bufSize);
    var rpathC = stringToUTF8OnStack(rpathResolved.join(":"));
    var libNameC = stringToUTF8OnStack(libName);
    var resLibNameC = __emscripten_find_dylib(buf, rpathC, libNameC, bufSize);
    return resLibNameC ? UTF8ToString(resLibNameC) : undefined;
  });
};

var registerDynCallSymbols = exports => {
  for (var [sym, exp] of Object.entries(exports)) {
    if (sym.startsWith("dynCall_")) {
      var sig = sym.substring(8);
      if (!dynCalls.hasOwnProperty(sig)) {
        dynCalls[sig] = exp;
      }
    }
  }
};

/**
       * @param {number=} handle
       * @param {Object=} localScope
       */ function loadDynamicLibrary(libName, flags = {
  global: true,
  nodelete: true
}, localScope, handle) {
  // when loadDynamicLibrary did not have flags, libraries were loaded
  // globally & permanently
  var dso = LDSO.loadedLibsByName[libName];
  if (dso) {
    // the library is being loaded or has been loaded already.
    if (!flags.global) {
      if (localScope) {
        Object.assign(localScope, dso.exports);
      }
      registerDynCallSymbols(dso.exports);
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
  dso = newDSO(libName, handle, "loading");
  dso.refcount = flags.nodelete ? Infinity : 1;
  dso.global = flags.global;
  // libName -> libData
  function loadLibData() {
    // for wasm, we can use fetch for async, but for fs mode we can only imitate it
    if (handle) {
      var data = HEAPU32[(((handle) + (28)) >> 2)];
      var dataSize = HEAPU32[(((handle) + (32)) >> 2)];
      if (data && dataSize) {
        var libData = HEAP8.slice(data, data + dataSize);
        return flags.loadAsync ? Promise.resolve(libData) : libData;
      }
    }
    var f = findLibraryFS(libName, flags.rpath);
    if (f) {
      var libData = FS.readFile(f, {
        encoding: "binary"
      });
      return flags.loadAsync ? Promise.resolve(libData) : libData;
    }
    var libFile = locateFile(libName);
    if (flags.loadAsync) {
      return asyncLoad(libFile);
    }
    // load the binary synchronously
    if (!readBinary) {
      throw new Error(`${libFile}: file not found, and synchronous loading of external files is not available`);
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
      return loadLibData().then(libData => loadWebAssemblyModule(libData, flags, libName, localScope, handle));
    }
    return loadWebAssemblyModule(loadLibData(), flags, libName, localScope, handle);
  }
  // module for lib is loaded - update the dso & global namespace
  function moduleLoaded(exports) {
    if (dso.global) {
      mergeLibSymbols(exports, libName);
    } else if (localScope) {
      Object.assign(localScope, exports);
      registerDynCallSymbols(exports);
    }
    dso.exports = exports;
  }
  if (flags.loadAsync) {
    return getExports().then(exports => {
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
      if (typeof value == "function") {
        /** @suppress {checkTypes} */ entry.value = addFunction(value, value.sig);
      } else if (typeof value == "number") {
        entry.value = value;
      } else {
        throw new Error(`bad export type for '${symName}': ${typeof value} (${value})`);
      }
    }
  }
};

var loadDylibs = async () => {
  if (!dynamicLibraries.length) {
    reportUndefinedSymbols();
    return;
  }
  addRunDependency("loadDylibs");
  // Load binaries asynchronously
  for (var lib of dynamicLibraries) {
    await loadDynamicLibrary(lib, {
      loadAsync: true,
      global: true,
      nodelete: true,
      allowUndefined: true
    });
  }
  // we got them all, wonderful
  reportUndefinedSymbols();
  removeRunDependency("loadDylibs");
};

var noExitRuntime = false;

var ___assert_fail = (condition, filename, line, func) => abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [ filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function" ]);

___assert_fail.sig = "vppip";

var ___asyncify_data = new WebAssembly.Global({
  "value": "i32",
  "mutable": true
}, 0);

var ___asyncify_state = new WebAssembly.Global({
  "value": "i32",
  "mutable": true
}, 0);

var ___call_sighandler = (fp, sig) => (a1 => dynCall_vi(fp, a1))(sig);

___call_sighandler.sig = "vpi";

var exceptionLast = 0;

class ExceptionInfo {
  // excPtr - Thrown object pointer to wrap. Metadata pointer is calculated from it.
  constructor(excPtr) {
    this.excPtr = excPtr;
    this.ptr = excPtr - 24;
  }
  set_type(type) {
    HEAPU32[(((this.ptr) + (4)) >> 2)] = type;
  }
  get_type() {
    return HEAPU32[(((this.ptr) + (4)) >> 2)];
  }
  set_destructor(destructor) {
    HEAPU32[(((this.ptr) + (8)) >> 2)] = destructor;
  }
  get_destructor() {
    return HEAPU32[(((this.ptr) + (8)) >> 2)];
  }
  set_caught(caught) {
    caught = caught ? 1 : 0;
    HEAP8[(this.ptr) + (12)] = caught;
  }
  get_caught() {
    return HEAP8[(this.ptr) + (12)] != 0;
  }
  set_rethrown(rethrown) {
    rethrown = rethrown ? 1 : 0;
    HEAP8[(this.ptr) + (13)] = rethrown;
  }
  get_rethrown() {
    return HEAP8[(this.ptr) + (13)] != 0;
  }
  // Initialize native structure fields. Should be called once after allocated.
  init(type, destructor) {
    this.set_adjusted_ptr(0);
    this.set_type(type);
    this.set_destructor(destructor);
  }
  set_adjusted_ptr(adjustedPtr) {
    HEAPU32[(((this.ptr) + (16)) >> 2)] = adjustedPtr;
  }
  get_adjusted_ptr() {
    return HEAPU32[(((this.ptr) + (16)) >> 2)];
  }
}

var setTempRet0 = val => __emscripten_tempret_set(val);

var findMatchingCatch = args => {
  var thrown = exceptionLast;
  if (!thrown) {
    // just pass through the null ptr
    setTempRet0(0);
    return 0;
  }
  var info = new ExceptionInfo(thrown);
  info.set_adjusted_ptr(thrown);
  var thrownType = info.get_type();
  if (!thrownType) {
    // just pass through the thrown ptr
    setTempRet0(0);
    return thrown;
  }
  // can_catch receives a **, add indirection
  // The different catch blocks are denoted by different types.
  // Due to inheritance, those types may not precisely match the
  // type of the thrown object. Find one which matches, and
  // return the type of the catch block which should be called.
  for (var caughtType of args) {
    if (caughtType === 0 || caughtType === thrownType) {
      // Catch all clause matched or exactly the same type is caught
      break;
    }
    var adjusted_ptr_addr = info.ptr + 16;
    if (___cxa_can_catch(caughtType, thrownType, adjusted_ptr_addr)) {
      setTempRet0(caughtType);
      return thrown;
    }
  }
  setTempRet0(thrownType);
  return thrown;
};

var ___cxa_find_matching_catch_2 = () => findMatchingCatch([]);

___cxa_find_matching_catch_2.sig = "p";

var ___resumeException = ptr => {
  if (!exceptionLast) {
    exceptionLast = ptr;
  }
  throw exceptionLast;
};

___resumeException.sig = "vp";

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
    SOCKFS.websocketArgs = Module["websocket"] || {};
    // Add the Event registration mechanism to the exported websocket configuration
    // object so we can register network callbacks from native JavaScript too.
    // For more documentation see system/include/emscripten/emscripten.h
    (Module["websocket"] ??= {})["on"] = SOCKFS.on;
    return FS.createNode(null, "/", 16895, 0);
  },
  createSocket(family, type, protocol) {
    // Emscripten only supports AF_INET
    if (family != 2) {
      throw new FS.ErrnoError(5);
    }
    type &= ~526336;
    // Some applications may pass it; it makes no sense for a single process.
    // Emscripten only supports SOCK_STREAM and SOCK_DGRAM
    if (type != 1 && type != 2) {
      throw new FS.ErrnoError(28);
    }
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
      sock_ops: SOCKFS.websocket_sock_ops
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
      stream_ops: SOCKFS.stream_ops
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
    }
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
      if (typeof addr == "object") {
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
            throw new Error("WebSocket URL must be in the format ws(s)://address:port");
          }
          addr = result[1];
          port = parseInt(result[2], 10);
        }
      } else {
        // create the actual websocket object and connect
        try {
          // The default value is 'ws://' the replace is needed because the compiler replaces '//' comments with '#'
          // comments without checking context, so we'd end up with ws:#, the replace swaps the '#' for '//' again.
          var url = "ws://".replace("#", "//");
          // Make the WebSocket subprotocol (Sec-WebSocket-Protocol) default to binary if no configuration is set.
          var subProtocols = "binary";
          // The default value is 'binary'
          // The default WebSocket options
          var opts = undefined;
          // Fetch runtime WebSocket URL config.
          if("function"===typeof SOCKFS.websocketArgs["url"]) {
url = SOCKFS.websocketArgs["url"](...arguments);
}else if ("string" === typeof SOCKFS.websocketArgs["url"]) {
            url = SOCKFS.websocketArgs["url"];
          }
          // Fetch runtime WebSocket subprotocol config.
          if (SOCKFS.websocketArgs["subprotocol"]) {
            subProtocols = SOCKFS.websocketArgs["subprotocol"];
          } else if (SOCKFS.websocketArgs["subprotocol"] === null) {
            subProtocols = "null";
          }
          if (url === "ws://" || url === "wss://") {
            // Is the supplied URL config just a prefix, if so complete it.
            var parts = addr.split("/");
            url = url + parts[0] + ":" + port + "/" + parts.slice(1).join("/");
          }
          if (subProtocols !== "null") {
            // The regex trims the string (removes spaces at the beginning and end, then splits the string by
            // <any space>,<any space> into an Array. Whitespace removal is important for Websockify and ws.
            subProtocols = subProtocols.replace(/^ +| +$/g, "").split(/ *, */);
            opts = subProtocols;
          }
          // If node we use the ws library.
          var WebSocketConstructor;
          if (ENVIRONMENT_IS_NODE) {
            WebSocketConstructor = /** @type{(typeof WebSocket)} */ (require("ws"));
          } else {
            WebSocketConstructor = WebSocket;
          }
          if (Module['websocket']['decorator']) {WebSocketConstructor = Module['websocket']['decorator'](WebSocketConstructor);}ws = new WebSocketConstructor(url, opts);
          ws.binaryType = "arraybuffer";
        } catch (e) {
          throw new FS.ErrnoError(23);
        }
      }
      var peer = {
        addr,
        port,
        socket: ws,
        msg_send_queue: []
      };
      SOCKFS.websocket_sock_ops.addPeer(sock, peer);
      SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
      // if this is a bound dgram socket, send the port number first to allow
      // us to override the ephemeral port reported to us by remotePort on the
      // remote end.
      if (sock.type === 2 && typeof sock.sport != "undefined") {
        peer.msg_send_queue.push(new Uint8Array([ 255, 255, 255, 255, "p".charCodeAt(0), "o".charCodeAt(0), "r".charCodeAt(0), "t".charCodeAt(0), ((sock.sport & 65280) >> 8), (sock.sport & 255) ]));
      }
      return peer;
    },
    getPeer(sock, addr, port) {
      return sock.peers[addr + ":" + port];
    },
    addPeer(sock, peer) {
      sock.peers[peer.addr + ":" + peer.port] = peer;
    },
    removePeer(sock, peer) {
      delete sock.peers[peer.addr + ":" + peer.port];
    },
    handlePeerEvents(sock, peer) {
      var first = true;
      var handleOpen = function() {
        sock.connecting = false;
        SOCKFS.emit("open", sock.stream.fd);
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
        if (typeof data == "string") {
          var encoder = new TextEncoder;
          // should be utf-8
          data = encoder.encode(data);
        } else {
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
        if (wasfirst && data.length === 10 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === "p".charCodeAt(0) && data[5] === "o".charCodeAt(0) && data[6] === "r".charCodeAt(0) && data[7] === "t".charCodeAt(0)) {
          // update the peer's port and it's key in the peer map
          var newport = ((data[8] << 8) | data[9]);
          SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          peer.port = newport;
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          return;
        }
        sock.recv_queue.push({
          addr: peer.addr,
          port: peer.port,
          data
        });
        SOCKFS.emit("message", sock.stream.fd);
      }
      if (ENVIRONMENT_IS_NODE) {
        peer.socket.on("open", handleOpen);
        peer.socket.on("message", function(data, isBinary) {
          if (!isBinary) {
            return;
          }
          handleMessage((new Uint8Array(data)).buffer);
        });
        peer.socket.on("close", function() {
          SOCKFS.emit("close", sock.stream.fd);
        });
        peer.socket.on("error", function(error) {
          // Although the ws library may pass errors that may be more descriptive than
          // ECONNREFUSED they are not necessarily the expected error code e.g.
          // ENOTFOUND on getaddrinfo seems to be node.js specific, so using ECONNREFUSED
          // is still probably the most useful thing to do.
          sock.error = 14;
          // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
          SOCKFS.emit("error", [ sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused" ]);
        });
      } else {
        peer.socket.onopen = handleOpen;
        peer.socket.onclose = function() {
          SOCKFS.emit("close", sock.stream.fd);
        };
        peer.socket.onmessage = function peer_socket_onmessage(event) {
          handleMessage(event.data);
        };
        peer.socket.onerror = function(error) {
          // The WebSocket spec only allows a 'simple event' to be thrown on error,
          // so we only really know as much as ECONNREFUSED.
          sock.error = 14;
          // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
          SOCKFS.emit("error", [ sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused" ]);
        };
      }
    },
    poll(sock) {
      if (sock.type === 1 && sock.server) {
        // listen sockets should only say they're available for reading
        // if there are pending clients.
        return sock.pending.length ? (64 | 1) : 0;
      }
      var mask = 0;
      var dest = sock.type === 1 ? // we only care about the socket state for connection-based sockets
      SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) : null;
      if (sock.recv_queue.length || !dest || // connection-less sockets are always ready to read
      (dest && dest.socket.readyState === dest.socket.CLOSING) || (dest && dest.socket.readyState === dest.socket.CLOSED)) {
        // let recv return 0 once closed
        mask |= (64 | 1);
      }
      if (!dest || // connection-less sockets are always ready to write
      (dest && dest.socket.readyState === dest.socket.OPEN)) {
        mask |= 4;
      }
      if ((dest && dest.socket.readyState === dest.socket.CLOSING) || (dest && dest.socket.readyState === dest.socket.CLOSED)) {
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
        HEAP32[((arg) >> 2)] = bytes;
        return 0;

       case 21537:
        var on = HEAP32[((arg) >> 2)];
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
      if (typeof sock.saddr != "undefined" || typeof sock.sport != "undefined") {
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
          if (!(e.name === "ErrnoError")) throw e;
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
      if (typeof sock.daddr != "undefined" && typeof sock.dport != "undefined") {
        var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
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
      var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
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
      var WebSocketServer = require("ws").Server;
      var host = sock.saddr;
      if (Module['websocket']['serverDecorator']) {WebSocketServer = Module['websocket']['serverDecorator'](WebSocketServer);}sock.server = new WebSocketServer({
        host,
        port: sock.sport
      });
      SOCKFS.emit("listen", sock.stream.fd);
      // Send Event with listen fd.
      sock.server.on("connection", function(ws) {
        if (sock.type === 1) {
          var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
          // create a peer on the new socket
          var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
          newsock.daddr = peer.addr;
          newsock.dport = peer.port;
          // push to queue for accept to pick up
          sock.pending.push(newsock);
          SOCKFS.emit("connection", newsock.stream.fd);
        } else {
          // create a peer on the listen socket so calling sendto
          // with the listen socket and an address will resolve
          // to the correct client
          SOCKFS.websocket_sock_ops.createPeer(sock, ws);
          SOCKFS.emit("connection", sock.stream.fd);
        }
      });
      sock.server.on("close", function() {
        SOCKFS.emit("close", sock.stream.fd);
        sock.server = null;
      });
      sock.server.on("error", function(error) {
        // Although the ws library may pass errors that may be more descriptive than
        // ECONNREFUSED they are not necessarily the expected error code e.g.
        // ENOTFOUND on getaddrinfo seems to be node.js specific, so using EHOSTUNREACH
        // is still probably the most useful thing to do. This error shouldn't
        // occur in a well written app as errors should get trapped in the compiled
        // app's own getaddrinfo call.
        sock.error = 23;
        // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
        SOCKFS.emit("error", [ sock.stream.fd, sock.error, "EHOSTUNREACH: Host is unreachable" ]);
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
        port
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
        if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
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
          if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
            dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
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
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
          if (!dest) {
            // if we have a destination address but are not connected, error out
            throw new FS.ErrnoError(53);
          }
          if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
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
        buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
        addr: queued.addr,
        port: queued.port
      };
      // push back any unread data for TCP connections
      if (flags&2) {bytesRead = 0;} if (sock.type === 1 && bytesRead < queuedLength) {
        var bytesRemaining = queuedLength - bytesRead;
        queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
        sock.recv_queue.unshift(queued);
      }
      return res;
    }
  }
};

var getSocketFromFD = fd => {
  var socket = SOCKFS.getSocket(fd);
  if (!socket) throw new FS.ErrnoError(8);
  return socket;
};

var inetPton4 = str => {
  var b = str.split(".");
  for (var i = 0; i < 4; i++) {
    var tmp = Number(b[i]);
    if (isNaN(tmp)) return null;
    b[i] = tmp;
  }
  return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
};

var inetPton6 = str => {
  var words;
  var w, offset, z;
  /* http://home.deds.nl/~aeron/regex/ */ var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
  var parts = [];
  if (!valid6regx.test(str)) {
    return null;
  }
  if (str === "::") {
    return [ 0, 0, 0, 0, 0, 0, 0, 0 ];
  }
  // Z placeholder to keep track of zeros when splitting the string on ":"
  if (str.startsWith("::")) {
    str = str.replace("::", "Z:");
  } else {
    str = str.replace("::", ":Z:");
  }
  if (str.indexOf(".") > 0) {
    // parse IPv4 embedded stress
    str = str.replace(new RegExp("[.]", "g"), ":");
    words = str.split(":");
    words[words.length - 4] = Number(words[words.length - 4]) + Number(words[words.length - 3]) * 256;
    words[words.length - 3] = Number(words[words.length - 2]) + Number(words[words.length - 1]) * 256;
    words = words.slice(0, words.length - 2);
  } else {
    words = str.split(":");
  }
  offset = 0;
  z = 0;
  for (w = 0; w < words.length; w++) {
    if (typeof words[w] == "string") {
      if (words[w] === "Z") {
        // compressed zeros - write appropriate number of zero words
        for (z = 0; z < (8 - words.length + 1); z++) {
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
  return [ (parts[1] << 16) | parts[0], (parts[3] << 16) | parts[2], (parts[5] << 16) | parts[4], (parts[7] << 16) | parts[6] ];
};

/** @param {number=} addrlen */ var writeSockaddr = (sa, family, addr, port, addrlen) => {
  switch (family) {
   case 2:
    addr = inetPton4(addr);
    zeroMemory(sa, 16);
    if (addrlen) {
      HEAP32[((addrlen) >> 2)] = 16;
    }
    HEAP16[((sa) >> 1)] = family;
    HEAP32[(((sa) + (4)) >> 2)] = addr;
    HEAP16[(((sa) + (2)) >> 1)] = _htons(port);
    break;

   case 10:
    addr = inetPton6(addr);
    zeroMemory(sa, 28);
    if (addrlen) {
      HEAP32[((addrlen) >> 2)] = 28;
    }
    HEAP32[((sa) >> 2)] = family;
    HEAP32[(((sa) + (8)) >> 2)] = addr[0];
    HEAP32[(((sa) + (12)) >> 2)] = addr[1];
    HEAP32[(((sa) + (16)) >> 2)] = addr[2];
    HEAP32[(((sa) + (20)) >> 2)] = addr[3];
    HEAP16[(((sa) + (2)) >> 1)] = _htons(port);
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
    names: {}
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
      addr = "172.29." + (id & 255) + "." + (id & 65280);
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
  }
};

function ___syscall_accept4(fd, addr, addrlen, flags, d1, d2) {
  try {
    var sock = getSocketFromFD(fd);
    var newsock = sock.sock_ops.accept(sock);
    if (addr) {
      var errno = writeSockaddr(addr, newsock.family, DNS.lookup_name(newsock.daddr), newsock.dport, addrlen);
    }
    return newsock.stream.fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_accept4.sig = "iippiii";

var inetNtop4 = addr => (addr & 255) + "." + ((addr >> 8) & 255) + "." + ((addr >> 16) & 255) + "." + ((addr >> 24) & 255);

var inetNtop6 = ints => {
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
  var str = "";
  var word = 0;
  var longest = 0;
  var lastzero = 0;
  var zstart = 0;
  var len = 0;
  var i = 0;
  var parts = [ ints[0] & 65535, (ints[0] >> 16), ints[1] & 65535, (ints[1] >> 16), ints[2] & 65535, (ints[2] >> 16), ints[3] & 65535, (ints[3] >> 16) ];
  // Handle IPv4-compatible, IPv4-mapped, loopback and any/unspecified addresses
  var hasipv4 = true;
  var v4part = "";
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
      str = "::ffff:";
      str += v4part;
      return str;
    }
    // IPv4-compatible IPv6 address if 16-bit value (bytes 11 and 12) == 0x0000 (6th word)
    if (parts[5] === 0) {
      str = "::";
      //special case IPv6 addresses
      if (v4part === "0.0.0.0") v4part = "";
      // any/unspecified address
      if (v4part === "0.0.0.1") v4part = "1";
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
      if (parts[word] === 0 && word >= zstart && word < (zstart + longest)) {
        if (word === zstart) {
          str += ":";
          if (zstart === 0) str += ":";
        }
        continue;
      }
    }
    // converts 16-bit words from big-endian to little-endian before converting to hex string
    str += Number(_ntohs(parts[word] & 65535)).toString(16);
    str += word < 7 ? ":" : "";
  }
  return str;
};

var readSockaddr = (sa, salen) => {
  // family / port offsets are common to both sockaddr_in and sockaddr_in6
  var family = HEAP16[((sa) >> 1)];
  var port = _ntohs(HEAPU16[(((sa) + (2)) >> 1)]);
  var addr;
  switch (family) {
   case 2:
    if (salen !== 16) {
      return {
        errno: 28
      };
    }
    addr = HEAP32[(((sa) + (4)) >> 2)];
    addr = inetNtop4(addr);
    break;

   case 10:
    if (salen !== 28) {
      return {
        errno: 28
      };
    }
    addr = [ HEAP32[(((sa) + (8)) >> 2)], HEAP32[(((sa) + (12)) >> 2)], HEAP32[(((sa) + (16)) >> 2)], HEAP32[(((sa) + (20)) >> 2)] ];
    addr = inetNtop6(addr);
    break;

   default:
    return {
      errno: 5
    };
  }
  return {
    family,
    addr,
    port
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
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_bind.sig = "iippiii";

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
    return dir + "/" + path;
  },
  writeStat(buf, stat) {
    HEAPU32[((buf) >> 2)] = stat.dev;
    HEAPU32[(((buf) + (4)) >> 2)] = stat.mode;
    HEAPU32[(((buf) + (8)) >> 2)] = stat.nlink;
    HEAPU32[(((buf) + (12)) >> 2)] = stat.uid;
    HEAPU32[(((buf) + (16)) >> 2)] = stat.gid;
    HEAPU32[(((buf) + (20)) >> 2)] = stat.rdev;
    HEAP64[(((buf) + (24)) >> 3)] = BigInt(stat.size);
    HEAP32[(((buf) + (32)) >> 2)] = 4096;
    HEAP32[(((buf) + (36)) >> 2)] = stat.blocks;
    var atime = stat.atime.getTime();
    var mtime = stat.mtime.getTime();
    var ctime = stat.ctime.getTime();
    HEAP64[(((buf) + (40)) >> 3)] = BigInt(Math.floor(atime / 1e3));
    HEAPU32[(((buf) + (48)) >> 2)] = (atime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (56)) >> 3)] = BigInt(Math.floor(mtime / 1e3));
    HEAPU32[(((buf) + (64)) >> 2)] = (mtime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (72)) >> 3)] = BigInt(Math.floor(ctime / 1e3));
    HEAPU32[(((buf) + (80)) >> 2)] = (ctime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (88)) >> 3)] = BigInt(stat.ino);
    return 0;
  },
  writeStatFs(buf, stats) {
    HEAPU32[(((buf) + (4)) >> 2)] = stats.bsize;
    HEAPU32[(((buf) + (60)) >> 2)] = stats.bsize;
    HEAP64[(((buf) + (8)) >> 3)] = BigInt(stats.blocks);
    HEAP64[(((buf) + (16)) >> 3)] = BigInt(stats.bfree);
    HEAP64[(((buf) + (24)) >> 3)] = BigInt(stats.bavail);
    HEAP64[(((buf) + (32)) >> 3)] = BigInt(stats.files);
    HEAP64[(((buf) + (40)) >> 3)] = BigInt(stats.ffree);
    HEAPU32[(((buf) + (48)) >> 2)] = stats.fsid;
    HEAPU32[(((buf) + (64)) >> 2)] = stats.flags;
    // ST_NOSUID
    HEAPU32[(((buf) + (56)) >> 2)] = stats.namelen;
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
  }
};

function ___syscall_chdir(path) {
  try {
    path = SYSCALLS.getStr(path);
    FS.chdir(path);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_chdir.sig = "ip";

function ___syscall_chmod(path, mode) {
  try {
    path = SYSCALLS.getStr(path);
    FS.chmod(path, mode);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_chmod.sig = "ipi";

var allocateUTF8OnStack = (...args) => stringToUTF8OnStack(...args);

var onInits = [];

var addOnInit = cb => onInits.push(cb);

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
  init: function() {
    // TODO: Move this to a library function that is made an onInit callback by the `__postset` suffix.
    if (PHPLoader.bindUserSpace) {
      /**
  				 * We need to add an onInit callback to bind the user-space API
  				 * because some dependencies like wasmImports and wasmExports
  				 * are not yet assigned.
  				 */ addOnInit(() => {
        if (typeof PHPLoader.processId !== "number") {
          throw new Error("PHPLoader.processId must be set before init");
        }
        Module["userSpace"] = PHPLoader.bindUserSpace({
          pid: PHPLoader.processId,
          constants: {
            F_GETFL: Number("3"),
            O_ACCMODE: Number("2097155"),
            O_RDONLY: Number("0"),
            O_WRONLY: Number("1"),
            O_APPEND: Number("1024"),
            O_NONBLOCK: Number("2048"),
            F_SETFL: Number("4"),
            F_GETLK: Number("12"),
            F_SETLK: Number("13"),
            F_SETLKW: Number("14"),
            SEEK_SET: Number("0"),
            SEEK_CUR: Number("1"),
            SEEK_END: Number("2"),
            F_GETFL: Number("3"),
            O_ACCMODE: Number("2097155"),
            O_RDONLY: Number("0"),
            O_WRONLY: Number("1"),
            O_APPEND: Number("1024"),
            O_NONBLOCK: Number("2048"),
            F_SETFL: Number("4"),
            F_GETLK: Number("12"),
            F_SETLK: Number("13"),
            F_SETLKW: Number("14"),
            SEEK_SET: Number("0"),
            SEEK_CUR: Number("1"),
            SEEK_END: Number("2"),
            // From:
            // https://github.com/emscripten-core/emscripten/blob/66d2137b0381ac35f7e2346b2d6a90abd0f1211a/system/lib/libc/musl/include/fcntl.h#L58-L60
            F_RDLCK: 0,
            F_WRLCK: 1,
            F_UNLCK: 2,
            // From:
            // https://github.com/emscripten-core/emscripten/blob/81bbaa42a7827d88a71bd89701245052c622428c/system/lib/libc/musl/include/sys/file.h#L7-L10
            LOCK_SH: 1,
            LOCK_EX: 2,
            LOCK_NB: 4,
            // Non-blocking lock
            LOCK_UN: 8
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
              get(offset) {
                return HEAP8[offset];
              },
              set(offset, value) {
                HEAP8[offset] = value;
              }
            },
            HEAPU8: {
              get(offset) {
                return HEAPU8[offset];
              },
              set(offset, value) {
                HEAPU8[offset] = value;
              }
            },
            HEAP16: {
              get(offset) {
                return HEAP16[offset];
              },
              set(offset, value) {
                HEAP16[offset] = value;
              }
            },
            HEAPU16: {
              get(offset) {
                return HEAPU16[offset];
              },
              set(offset, value) {
                HEAPU16[offset] = value;
              }
            },
            HEAP32: {
              get(offset) {
                return HEAP32[offset];
              },
              set(offset, value) {
                HEAP32[offset] = value;
              }
            },
            HEAPU32: {
              get(offset) {
                return HEAPU32[offset];
              },
              set(offset, value) {
                HEAPU32[offset] = value;
              }
            },
            HEAPF32: {
              get(offset) {
                return HEAPF32[offset];
              },
              set(offset, value) {
                HEAPF32[offset] = value;
              }
            },
            HEAP64: {
              get(offset) {
                return HEAP64[offset];
              },
              set(offset, value) {
                HEAP64[offset] = value;
              }
            },
            HEAPU64: {
              get(offset) {
                return HEAPU64[offset];
              },
              set(offset, value) {
                HEAPU64[offset] = value;
              }
            },
            HEAPF64: {
              get(offset) {
                return HEAPF64[offset];
              },
              set(offset, value) {
                HEAPF64[offset] = value;
              }
            }
          },
          wasmImports: Object.assign({}, wasmImports, typeof _builtin_fd_close === "function" ? {
            builtin_fd_close: _builtin_fd_close
          } : {}, typeof _builtin_fcntl64 === "function" ? {
            builtin_fcntl64: _builtin_fcntl64
          } : {}),
          wasmExports,
          syscalls: SYSCALLS,
          FS,
          PROXYFS,
          NODEFS
        });
      });
    }
    Module["ENV"] = Module["ENV"] || {};
    // Ensure a platform-level bin directory for a fallback `php` binary.
    Module["ENV"]["PATH"] = [ Module["ENV"]["PATH"], "/internal/shared/bin" ].filter(Boolean).join(":");
    // The /request directory is required by the C module. It's where the
    // stdout, stderr, and headers information are written for the JavaScript
    // code to read later on. This is per-request state that is isolated to a
    // single PHP process.
    FS.mkdir("/request");
    // The /internal directory is shared amongst all PHP processes
    // and contains the php.ini, constants definitions, etc.
    FS.mkdir("/internal");
    if (PHPLoader.nativeInternalDirPath) {
      FS.mount(FS.filesystems.NODEFS, {
        root: PHPLoader.nativeInternalDirPath
      }, "/internal");
    }
    // The files from the shared directory are shared between all the
    // PHP processes managed by PHPProcessManager.
    FS.mkdirTree("/internal/shared");
    // The files from the preload directory are preloaded using the
    // auto_prepend_file php.ini directive.
    FS.mkdirTree("/internal/shared/preload");
    // Platform-level bin directory for a fallback `php` binary. Without it,
    // PHP may not populate the PHP_BINARY constant.
    FS.mkdirTree("/internal/shared/bin");
    const originalOnRuntimeInitialized = Module["onRuntimeInitialized"];
    Module["onRuntimeInitialized"] = () => {
      const {node: phpBinaryNode} = FS.lookupPath("/internal/shared/bin/php", {
        noent_okay: true
      });
      if (!phpBinaryNode) {
        // Dummy PHP binary for PHP to populate the PHP_BINARY constant.
        FS.writeFile("/internal/shared/bin/php", (new TextEncoder).encode('#!/bin/sh\nphp "$@"'));
        // It must be executable to be used by PHP.
        FS.chmod("/internal/shared/bin/php", 493);
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
      }
    });
    FS.mkdev("/request/stdout", FS.makedev(64, 0));
    FS.registerDevice(FS.makedev(63, 0), {
      open: () => {},
      close: () => {},
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => {
        const chunk = buffer.subarray(offset, offset + length);
        PHPWASM.onStderr(chunk);
        return length;
      }
    });
    FS.mkdev("/request/stderr", FS.makedev(63, 0));
    FS.registerDevice(FS.makedev(62, 0), {
      open: () => {},
      close: () => {},
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => {
        const chunk = buffer.subarray(offset, offset + length);
        PHPWASM.onHeaders(chunk);
        return length;
      }
    });
    FS.mkdev("/request/headers", FS.makedev(62, 0));
    // Handle events.
    PHPWASM.EventEmitter = ENVIRONMENT_IS_NODE ? require("events").EventEmitter : class EventEmitter {
      constructor() {
        this.listeners = {};
      }
      emit(eventName, data) {
        if (this.listeners[eventName]) {
          this.listeners[eventName].forEach(callback => {
            callback(data);
          });
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
          const idx = this.listeners[eventName].indexOf(callback);
          if (idx !== -1) {
            this.listeners[eventName].splice(idx, 1);
          }
        }
      }
    };
    PHPWASM.processTable = {};
    PHPWASM.input_devices = {};
    const originalWrite = TTY.stream_ops.write;
    TTY.stream_ops.write = function(stream, ...rest) {
      const retval = originalWrite(stream, ...rest);
      // Implicit flush since PHP's fflush() doesn't seem to trigger the fsync event
      // @TODO: Fix this at the wasm level
      stream.tty.ops.fsync(stream.tty);
      return retval;
    };
    const originalPutChar = TTY.stream_ops.put_char;
    TTY.stream_ops.put_char = function(tty, val) {
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
  onHeaders: function(chunk) {
    if (Module["onHeaders"]) {
      Module["onHeaders"](chunk);
      return;
    }
    console.log("headers", {
      chunk
    });
  },
  onStdout: function(chunk) {
    if (Module["onStdout"]) {
      Module["onStdout"](chunk);
      return;
    }
    if (ENVIRONMENT_IS_NODE) {
      process.stdout.write(chunk);
    } else {
      console.log("stdout", {
        chunk
      });
    }
  },
  onStderr: function(chunk) {
    if (Module["onStderr"]) {
      Module["onStderr"](chunk);
      return;
    }
    if (ENVIRONMENT_IS_NODE) {
      process.stderr.write(chunk);
    } else {
      console.warn("stderr", {
        chunk
      });
    }
  },
  getAllWebSockets: function(sock) {
    const webSockets = new Set;
    if (sock.server) {
      sock.server.clients.forEach(ws => {
        webSockets.add(ws);
      });
    }
    for (const peer of PHPWASM.getAllPeers(sock)) {
      webSockets.add(peer.socket);
    }
    return Array.from(webSockets);
  },
  getAllPeers: function(sock) {
    const peers = new Set;
    if (sock.server) {
      sock.pending.filter(pending => pending.peers).forEach(pending => {
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
  awaitData: function(ws) {
    return PHPWASM.awaitEvent(ws, "message");
  },
  awaitConnection: function(ws) {
    if (ws.OPEN === ws.readyState) {
      return [ Promise.resolve(), PHPWASM.noop ];
    }
    return PHPWASM.awaitEvent(ws, "open");
  },
  awaitClose: function(ws) {
    if ([ ws.CLOSING, ws.CLOSED ].includes(ws.readyState)) {
      return [ Promise.resolve(), PHPWASM.noop ];
    }
    return PHPWASM.awaitEvent(ws, "close");
  },
  awaitError: function(ws) {
    if ([ ws.CLOSING, ws.CLOSED ].includes(ws.readyState)) {
      return [ Promise.resolve(), PHPWASM.noop ];
    }
    return PHPWASM.awaitEvent(ws, "error");
  },
  awaitEvent: function(ws, event) {
    let resolve;
    const listener = () => {
      resolve();
    };
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
    return [ promise, cancel ];
  },
  noop: function() {},
  spawnProcess: function(command, args, options) {
    if (Module["spawnProcess"]) {
      const spawned = Module["spawnProcess"](command, args, /**
  					 * We're providing the same extra options we would pass to child_process.spawn().
  					 *
  					 * Why?
  					 *
  					 * spawnProcess() follows the same interface as child_process.spawn()
  					 * and some consumers pass `child_process.spawn` directly to php.setSpawnHandler()
  					 */ {
        ...options,
        shell: true,
        stdio: [ "pipe", "pipe", "pipe" ]
      });
      if (spawned && !("then" in spawned) && "on" in spawned) {
        /**
  					 * If we get the child process directly, return it immediately.
  					 * Delaying it to the next tick via Promise.resolve() would create
  					 * a race condition where it might emit some events before the
  					 * caller has a chance to bind event listeners to them.
  					 *
  					 * Without this condition, this callback would be at least flaky:
  					 *
  					 *    php.setSpawnHandler(require('child_process').spawn);
  					 */ return spawned;
      }
      return Promise.resolve(spawned).then(function(spawned) {
        if (!spawned || !spawned.on) {
          throw new Error("spawnProcess() must return an EventEmitter but returned a different type.");
        }
        return spawned;
      });
    }
    const e = new Error("popen(), proc_open() etc. are unsupported on this PHP instance. Call php.setSpawnHandler() " + "and provide a callback to handle spawning processes, or disable a popen(), proc_open() " + "and similar functions via php.ini.");
    e.code = "SPAWN_UNSUPPORTED";
    throw e;
  },
  shutdownSocket: function(socketd, how) {
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
      console.log("Socket shutdown error", e);
      return -1;
    }
  }
};

function _wasm_connect(sockfd, addr, addrlen) {
  /**
  		 * Use a synchronous connect() call when Asyncify is used.
  		 *
  		 * The async version was originally introduced to support the Memcached and Redis extensions,
  		 * and both are only available with JSPI. Asyncify is too difficult to maintain and
  		 * it's not getting that upgrade.
  		 */ if (!("Suspending" in WebAssembly)) {
    var sock = getSocketFromFD(sockfd);
    var info = getSocketAddress(addr, addrlen);
    sock.sock_ops.connect(sock, info.addr, info.port);
    return 0;
  }
  return Asyncify.handleSleep(wakeUp => {
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
      if (typeof FS == "undefined" || !(e.name === "ErrnoError")) {
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
      if (typeof FS == "undefined" || !(e.name === "ErrnoError")) {
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
    const timeout = 3e4;
    // 30 second timeout
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
        ws.removeEventListener("error", handleError);
        ws.removeEventListener("close", handleClose);
        wakeUp(0);
      }
    };
    const handleError = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        ws.removeEventListener("open", handleOpen);
        ws.removeEventListener("close", handleClose);
        wakeUp(-ERRNO_CODES.ECONNREFUSED);
      }
    };
    const handleClose = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        ws.removeEventListener("open", handleOpen);
        ws.removeEventListener("error", handleError);
        wakeUp(-ERRNO_CODES.ECONNREFUSED);
      }
    };
    ws.addEventListener("open", handleOpen);
    ws.addEventListener("error", handleError);
    ws.addEventListener("close", handleClose);
  });
}

function ___syscall_connect(sockfd, addr, addrlen, d1, d2, d3) {
  return _wasm_connect(sockfd, addr, addrlen);
}

___syscall_connect.sig = "iippiii";

function ___syscall_dup(fd) {
  try {
    var old = SYSCALLS.getStreamFromFD(fd);
    return FS.dupStream(old).fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_dup.sig = "ii";

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
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_dup3.sig = "iiii";

function ___syscall_faccessat(dirfd, path, amode, flags) {
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (amode & ~7) {
      // need a valid mode
      return -28;
    }
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    if (!node) {
      return -44;
    }
    var perms = "";
    if (amode & 4) perms += "r";
    if (amode & 2) perms += "w";
    if (amode & 1) perms += "x";
    if (perms && FS.nodePermissions(node, perms)) {
      return -2;
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_faccessat.sig = "iipii";

var INT53_MAX = 9007199254740992;

var INT53_MIN = -9007199254740992;

var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);

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
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fallocate.sig = "iiijj";

function ___syscall_fchmod(fd, mode) {
  try {
    FS.fchmod(fd, mode);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fchmod.sig = "iii";

function ___syscall_fchown32(fd, owner, group) {
  try {
    FS.fchown(fd, owner, group);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fchown32.sig = "iiii";

function ___syscall_fchownat(dirfd, path, owner, group, flags) {
  try {
    path = SYSCALLS.getStr(path);
    var nofollow = flags & 256;
    flags = flags & (~256);
    path = SYSCALLS.calculateAt(dirfd, path);
    (nofollow ? FS.lchown : FS.chown)(path, owner, group);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fchownat.sig = "iipiii";

var syscallGetVarargI = () => {
  // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
  var ret = HEAP32[((+SYSCALLS.varargs) >> 2)];
  SYSCALLS.varargs += 4;
  return ret;
};

var syscallGetVarargP = syscallGetVarargI;

function _fd_close(fd) {
  if (typeof Module["userSpace"] === "undefined") {
    return _builtin_fd_close(fd);
  }
  return Module["userSpace"].fd_close(fd);
}

_fd_close.sig = "ii";

function _builtin_fd_close(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

function _builtin_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (cmd) {
     case 0:
      {
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

     case 4:
      {
        var arg = syscallGetVarargI();
        stream.flags |= arg;
        return 0;
      }

     case 12:
      {
        var arg = syscallGetVarargP();
        var offset = 0;
        // We're always unlocked.
        HEAP16[(((arg) + (offset)) >> 1)] = 2;
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
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

function ___syscall_fcntl64(fd, cmd, varargs) {
  if (typeof Module["userSpace"] === "undefined") {
    return _builtin_fcntl64(fd, cmd, varargs);
  }
  return Module["userSpace"].fcntl64(fd, cmd, varargs);
}

___syscall_fcntl64.sig = "iiip";

function ___syscall_fstat64(fd, buf) {
  try {
    return SYSCALLS.writeStat(buf, FS.fstat(fd));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fstat64.sig = "iip";

function ___syscall_ftruncate64(fd, length) {
  length = bigintToI53Checked(length);
  try {
    if (isNaN(length)) return -61;
    FS.ftruncate(fd, length);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_ftruncate64.sig = "iij";

function ___syscall_getcwd(buf, size) {
  try {
    if (size === 0) return -28;
    var cwd = FS.cwd();
    var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
    if (size < cwdLengthInBytes) return -68;
    stringToUTF8(cwd, buf, size);
    return cwdLengthInBytes;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getcwd.sig = "ipp";

function ___syscall_getdents64(fd, dirp, count) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    stream.getdents ||= FS.readdir(stream.path);
    var struct_size = 280;
    var pos = 0;
    var off = FS.llseek(stream, 0, 1);
    var startIdx = Math.floor(off / struct_size);
    var endIdx = Math.min(stream.getdents.length, startIdx + Math.floor(count / struct_size));
    for (var idx = startIdx; idx < endIdx; idx++) {
      var id;
      var type;
      var name = stream.getdents[idx];
      if (name === ".") {
        id = stream.node.id;
        type = 4;
      } else if (name === "..") {
        var lookup = FS.lookupPath(stream.path, {
          parent: true
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
        type = FS.isChrdev(child.mode) ? 2 : // DT_CHR, character device.
        FS.isDir(child.mode) ? 4 : // DT_DIR, directory.
        FS.isLink(child.mode) ? 10 : // DT_LNK, symbolic link.
        8;
      }
      HEAP64[((dirp + pos) >> 3)] = BigInt(id);
      HEAP64[(((dirp + pos) + (8)) >> 3)] = BigInt((idx + 1) * struct_size);
      HEAP16[(((dirp + pos) + (16)) >> 1)] = 280;
      HEAP8[(dirp + pos) + (18)] = type;
      stringToUTF8(name, dirp + pos + 19, 256);
      pos += struct_size;
    }
    FS.llseek(stream, idx * struct_size, 0);
    return pos;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getdents64.sig = "iipp";

function ___syscall_getpeername(fd, addr, addrlen, d1, d2, d3) {
  try {
    var sock = getSocketFromFD(fd);
    if (!sock.daddr) {
      return -53;
    }
    var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(sock.daddr), sock.dport, addrlen);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getpeername.sig = "iippiii";

function ___syscall_getsockname(fd, addr, addrlen, d1, d2, d3) {
  try {
    var sock = getSocketFromFD(fd);
    // TODO: sock.saddr should never be undefined, see TODO in websocket_sock_ops.getname
    var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(sock.saddr || "0.0.0.0"), sock.sport, addrlen);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getsockname.sig = "iippiii";

function ___syscall_getsockopt(fd, level, optname, optval, optlen, d1) {
  try {
    var sock = getSocketFromFD(fd);
    // Minimal getsockopt aimed at resolving https://github.com/emscripten-core/emscripten/issues/2211
    // so only supports SOL_SOCKET with SO_ERROR.
    if (level === 1) {
      if (optname === 4) {
        HEAP32[((optval) >> 2)] = sock.error;
        HEAP32[((optlen) >> 2)] = 4;
        sock.error = null;
        // Clear the error (The SO_ERROR option obtains and then clears this field).
        return 0;
      }
    }
    return -50;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getsockopt.sig = "iiiippi";

function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (op) {
     case 21509:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     case 21505:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcgets) {
          var termios = stream.tty.ops.ioctl_tcgets(stream);
          var argp = syscallGetVarargP();
          HEAP32[((argp) >> 2)] = termios.c_iflag || 0;
          HEAP32[(((argp) + (4)) >> 2)] = termios.c_oflag || 0;
          HEAP32[(((argp) + (8)) >> 2)] = termios.c_cflag || 0;
          HEAP32[(((argp) + (12)) >> 2)] = termios.c_lflag || 0;
          for (var i = 0; i < 32; i++) {
            HEAP8[(argp + i) + (17)] = termios.c_cc[i] || 0;
          }
          return 0;
        }
        return 0;
      }

     case 21510:
     case 21511:
     case 21512:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     case 21506:
     case 21507:
     case 21508:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcsets) {
          var argp = syscallGetVarargP();
          var c_iflag = HEAP32[((argp) >> 2)];
          var c_oflag = HEAP32[(((argp) + (4)) >> 2)];
          var c_cflag = HEAP32[(((argp) + (8)) >> 2)];
          var c_lflag = HEAP32[(((argp) + (12)) >> 2)];
          var c_cc = [];
          for (var i = 0; i < 32; i++) {
            c_cc.push(HEAP8[(argp + i) + (17)]);
          }
          return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
            c_iflag,
            c_oflag,
            c_cflag,
            c_lflag,
            c_cc
          });
        }
        return 0;
      }

     case 21519:
      {
        if (!stream.tty) return -59;
        var argp = syscallGetVarargP();
        HEAP32[((argp) >> 2)] = 0;
        return 0;
      }

     case 21520:
      {
        if (!stream.tty) return -59;
        return -28;
      }

     case 21537:
     case 21531:
      {
        var argp = syscallGetVarargP();
        return FS.ioctl(stream, op, argp);
      }

     case 21523:
      {
        // TODO: in theory we should write to the winsize struct that gets
        // passed in, but for now musl doesn't read anything on it
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tiocgwinsz) {
          var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
          var argp = syscallGetVarargP();
          HEAP16[((argp) >> 1)] = winsize[0];
          HEAP16[(((argp) + (2)) >> 1)] = winsize[1];
        }
        return 0;
      }

     case 21524:
      {
        // TODO: technically, this ioctl call should change the window size.
        // but, since emscripten doesn't have any concept of a terminal window
        // yet, we'll just silently throw it away as we do TIOCGWINSZ
        if (!stream.tty) return -59;
        return 0;
      }

     case 21515:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     default:
      return -28;
    }
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_ioctl.sig = "iiip";

function ___syscall_listen(fd, backlog) {
  try {
    var sock = getSocketFromFD(fd);
    sock.sock_ops.listen(sock, backlog);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_listen.sig = "iiiiiii";

function ___syscall_lstat64(path, buf) {
  try {
    path = SYSCALLS.getStr(path);
    return SYSCALLS.writeStat(buf, FS.lstat(path));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_lstat64.sig = "ipp";

function ___syscall_mkdirat(dirfd, path, mode) {
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    FS.mkdir(path, mode, 0);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_mkdirat.sig = "iipi";

function ___syscall_newfstatat(dirfd, path, buf, flags) {
  try {
    path = SYSCALLS.getStr(path);
    var nofollow = flags & 256;
    var allowEmpty = flags & 4096;
    flags = flags & (~6400);
    path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
    return SYSCALLS.writeStat(buf, nofollow ? FS.lstat(path) : FS.stat(path));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_newfstatat.sig = "iippi";

function ___syscall_openat(dirfd, path, flags, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    var mode = varargs ? syscallGetVarargI() : 0;
    return FS.open(path, flags, mode).fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_openat.sig = "iipip";

var PIPEFS = {
  BUCKET_BUFFER_SIZE: 8192,
  mount(mount) {
    // Do not pollute the real root directory or its child nodes with pipes
    // Looks like it is OK to create another pseudo-root node not linked to the FS.root hierarchy this way
    return FS.createNode(null, "/", 16384 | 511, 0);
  },
  createPipe() {
    var pipe = {
      buckets: [],
      // refcnt 2 because pipe has a read end and a write end. We need to be
      // able to read from the read end after write end is closed.
      refcnt: 2,
      timestamp: new Date
    };
    pipe.buckets.push({
      buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
      offset: 0,
      roffset: 0
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
      stream_ops: PIPEFS.stream_ops
    });
    rNode.stream = readableStream;
    var writableStream = FS.createStream({
      path: wName,
      node: wNode,
      flags: 1,
      seekable: false,
      stream_ops: PIPEFS.stream_ops
    });
    wNode.stream = writableStream;
    return {
      readable_fd: readableStream.fd,
      writable_fd: writableStream.fd
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
        blocks: 0
      };
    },
    poll(stream) {
      var pipe = stream.node.pipe;
      if ((stream.flags & 2097155) === 1) {
        return (256 | 4);
      }
      for (var bucket of pipe.buckets) {
        if (bucket.offset - bucket.roffset > 0) {
          return (64 | 1);
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
      if(currentLength==0){if(pipe.refcnt<2){return 0;}throw new FS.ErrnoError(6);
      }
      var toRead = Math.min(currentLength, length);
      var totalRead = toRead;
      var toRemove = 0;
      for (var bucket of pipe.buckets) {
        var bucketSize = bucket.offset - bucket.roffset;
        if (toRead <= bucketSize) {
          var tmpSlice = bucket.buffer.subarray(bucket.roffset, bucket.offset);
          if (toRead < bucketSize) {
            tmpSlice = tmpSlice.subarray(0, toRead);
            bucket.roffset += toRead;
          } else {
            toRemove++;
          }
          data.set(tmpSlice);
          break;
        } else {
          var tmpSlice = bucket.buffer.subarray(bucket.roffset, bucket.offset);
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
          roffset: 0
        };
        pipe.buckets.push(currBucket);
      } else {
        currBucket = pipe.buckets[pipe.buckets.length - 1];
      }
      var freeBytesInCurrBuffer = PIPEFS.BUCKET_BUFFER_SIZE - currBucket.offset;
      if (freeBytesInCurrBuffer >= dataLen) {
        currBucket.buffer.set(data, currBucket.offset);
        currBucket.offset += dataLen;
        return dataLen;
      } else if (freeBytesInCurrBuffer > 0) {
        currBucket.buffer.set(data.subarray(0, freeBytesInCurrBuffer), currBucket.offset);
        currBucket.offset += freeBytesInCurrBuffer;
        data = data.subarray(freeBytesInCurrBuffer, data.byteLength);
      }
      var numBuckets = (data.byteLength / PIPEFS.BUCKET_BUFFER_SIZE) | 0;
      var remElements = data.byteLength % PIPEFS.BUCKET_BUFFER_SIZE;
      for (var i = 0; i < numBuckets; i++) {
        var newBucket = {
          buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
          offset: PIPEFS.BUCKET_BUFFER_SIZE,
          roffset: 0
        };
        pipe.buckets.push(newBucket);
        newBucket.buffer.set(data.subarray(0, PIPEFS.BUCKET_BUFFER_SIZE));
        data = data.subarray(PIPEFS.BUCKET_BUFFER_SIZE, data.byteLength);
      }
      if (remElements > 0) {
        var newBucket = {
          buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
          offset: data.byteLength,
          roffset: 0
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
    }
  },
  nextname() {
    if (!PIPEFS.nextname.current) {
      PIPEFS.nextname.current = 0;
    }
    return "pipe[" + (PIPEFS.nextname.current++) + "]";
  }
};

function ___syscall_pipe(fdPtr) {
  try {
    if (fdPtr == 0) {
      throw new FS.ErrnoError(21);
    }
    var res = PIPEFS.createPipe();
    HEAP32[((fdPtr) >> 2)] = res.readable_fd;
    HEAP32[(((fdPtr) + (4)) >> 2)] = res.writable_fd;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_pipe.sig = "ip";

function ___syscall_poll(fds, nfds, timeout) {
  try {
    var nonzero = 0;
    for (var i = 0; i < nfds; i++) {
      var pollfd = fds + 8 * i;
      var fd = HEAP32[((pollfd) >> 2)];
      var events = HEAP16[(((pollfd) + (4)) >> 1)];
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
      HEAP16[(((pollfd) + (6)) >> 1)] = mask;
    }
    return nonzero;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_poll.sig = "ipii";

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
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_readlinkat.sig = "iippp";

function ___syscall_recvfrom(fd, buf, len, flags, addr, addrlen) {
  try {
    var sock = getSocketFromFD(fd);
    var msg = sock.sock_ops.recvmsg(sock, len, typeof flags !== "undefined" ? flags : 0);
    if (!msg) return 0;
    // socket is closed
    if (addr) {
      var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(msg.addr), msg.port, addrlen);
    }
    HEAPU8.set(msg.buffer, buf);
    return msg.buffer.byteLength;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_recvfrom.sig = "iippipp";

function ___syscall_renameat(olddirfd, oldpath, newdirfd, newpath) {
  try {
    oldpath = SYSCALLS.getStr(oldpath);
    newpath = SYSCALLS.getStr(newpath);
    oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
    newpath = SYSCALLS.calculateAt(newdirfd, newpath);
    FS.rename(oldpath, newpath);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_renameat.sig = "iipip";

function ___syscall_rmdir(path) {
  try {
    path = SYSCALLS.getStr(path);
    FS.rmdir(path);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_rmdir.sig = "ip";

function ___syscall_sendto(fd, message, length, flags, addr, addr_len) {
  try {
    var sock = getSocketFromFD(fd);
    if (!addr) {
      // send, no address provided
      return FS.write(sock.stream, HEAP8, message, length);
    }
    var dest = getSocketAddress(addr, addr_len);
    // sendto an address
    return sock.sock_ops.sendmsg(sock, HEAP8, message, length, dest.addr, dest.port);
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_sendto.sig = "iippipp";

function ___syscall_socket(domain, type, protocol) {
  try {
    var sock = SOCKFS.createSocket(domain, type, protocol);
    return sock.stream.fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_socket.sig = "iiiiiii";

function ___syscall_stat64(path, buf) {
  try {
    path = SYSCALLS.getStr(path);
    return SYSCALLS.writeStat(buf, FS.stat(path));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_stat64.sig = "ipp";

function ___syscall_statfs64(path, size, buf) {
  try {
    SYSCALLS.writeStatFs(buf, FS.statfs(SYSCALLS.getStr(path)));
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_statfs64.sig = "ippp";

function ___syscall_symlinkat(target, dirfd, linkpath) {
  try {
    target = SYSCALLS.getStr(target);
    linkpath = SYSCALLS.getStr(linkpath);
    linkpath = SYSCALLS.calculateAt(dirfd, linkpath);
    FS.symlink(target, linkpath);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_symlinkat.sig = "ipip";

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
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_unlinkat.sig = "iipi";

var readI53FromI64 = ptr => HEAPU32[((ptr) >> 2)] + HEAP32[(((ptr) + (4)) >> 2)] * 4294967296;

function ___syscall_utimensat(dirfd, path, times, flags) {
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path, true);
    var now = Date.now(), atime, mtime;
    if (!times) {
      atime = now;
      mtime = now;
    } else {
      var seconds = readI53FromI64(times);
      var nanoseconds = HEAP32[(((times) + (8)) >> 2)];
      if (nanoseconds == 1073741823) {
        atime = now;
      } else if (nanoseconds == 1073741822) {
        atime = null;
      } else {
        atime = (seconds * 1e3) + (nanoseconds / (1e3 * 1e3));
      }
      times += 16;
      seconds = readI53FromI64(times);
      nanoseconds = HEAP32[(((times) + (8)) >> 2)];
      if (nanoseconds == 1073741823) {
        mtime = now;
      } else if (nanoseconds == 1073741822) {
        mtime = null;
      } else {
        mtime = (seconds * 1e3) + (nanoseconds / (1e3 * 1e3));
      }
    }
    // null here means UTIME_OMIT was passed. If both were set to UTIME_OMIT then
    // we can skip the call completely.
    if ((mtime ?? atime) !== null) {
      FS.utime(path, atime, mtime);
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_utimensat.sig = "iippi";

var __abort_js = () => abort("");

__abort_js.sig = "v";

var dlSetError = msg => {
  var sp = stackSave();
  var cmsg = stringToUTF8OnStack(msg);
  ___dl_seterr(cmsg, 0);
  stackRestore(sp);
};

var dlopenInternal = (handle, jsflags) => {
  // void *dlopen(const char *file, int mode);
  // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlopen.html
  var filename = UTF8ToString(handle + 36);
  var flags = HEAP32[(((handle) + (4)) >> 2)];
  filename = PATH.normalize(filename);
  var global = Boolean(flags & 256);
  var localScope = global ? null : {};
  // We don't care about RTLD_NOW and RTLD_LAZY.
  var combinedFlags = {
    global,
    nodelete: Boolean(flags & 4096),
    loadAsync: jsflags.loadAsync
  };
  if (jsflags.loadAsync) {
    return loadDynamicLibrary(filename, combinedFlags, localScope, handle);
  }
  try {
    return loadDynamicLibrary(filename, combinedFlags, localScope, handle);
  } catch (e) {
    dlSetError(`could not load dynamic lib: ${filename}\n${e}`);
    return 0;
  }
};

function __dlopen_js(handle) {
  var jsflags = {
    loadAsync: false
  };
  return dlopenInternal(handle, jsflags);
}

__dlopen_js.sig = "pp";

var __dlsym_js = (handle, symbol, symbolIndex) => {
  // void *dlsym(void *restrict handle, const char *restrict name);
  // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlsym.html
  symbol = UTF8ToString(symbol);
  var result;
  var newSymIndex;
  var lib = LDSO.loadedLibsByHandle[handle];
  newSymIndex = Object.keys(lib.exports).indexOf(symbol);
  if (newSymIndex == -1 || lib.exports[symbol].stub) {
    dlSetError(`Tried to lookup unknown symbol "${symbol}" in dynamic lib: ${lib.name}`);
    return 0;
  }
  result = lib.exports[symbol];
  if (typeof result == "function") {
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
      HEAPU32[((symbolIndex) >> 2)] = newSymIndex;
    }
  }
  return result;
};

__dlsym_js.sig = "pppp";

var __emscripten_lookup_name = name => {
  // uint32_t _emscripten_lookup_name(const char *name);
  var nameString = UTF8ToString(name);
  return inetPton4(DNS.lookup_name(nameString));
};

__emscripten_lookup_name.sig = "ip";

var runtimeKeepaliveCounter = 0;

var __emscripten_runtime_keepalive_clear = () => {
  noExitRuntime = false;
  runtimeKeepaliveCounter = 0;
};

__emscripten_runtime_keepalive_clear.sig = "v";

var __emscripten_system = command => {
  if (ENVIRONMENT_IS_NODE) {
    if (!command) return 1;
    // shell is available
    var cmdstr = UTF8ToString(command);
    if (!cmdstr.length) return 0;
    // this is what glibc seems to do (shell works test?)
    var cp = require("child_process");
    var ret = cp.spawnSync(cmdstr, [], {
      shell: true,
      stdio: "inherit"
    });
    var _W_EXITCODE = (ret, sig) => ((ret) << 8 | (sig));
    // this really only can happen if process is killed by signal
    if (ret.status === null) {
      // sadly node doesn't expose such function
      var signalToNumber = sig => {
        // implement only the most common ones, and fallback to SIGINT
        switch (sig) {
         case "SIGHUP":
          return 1;

         case "SIGQUIT":
          return 3;

         case "SIGFPE":
          return 8;

         case "SIGKILL":
          return 9;

         case "SIGALRM":
          return 14;

         case "SIGTERM":
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
  if (!command) return 0;
  // no shell available
  return -52;
};

__emscripten_system.sig = "ip";

var __emscripten_throw_longjmp = () => {
  throw Infinity;
};

__emscripten_throw_longjmp.sig = "v";

function __gmtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  var date = new Date(time * 1e3);
  HEAP32[((tmPtr) >> 2)] = date.getUTCSeconds();
  HEAP32[(((tmPtr) + (4)) >> 2)] = date.getUTCMinutes();
  HEAP32[(((tmPtr) + (8)) >> 2)] = date.getUTCHours();
  HEAP32[(((tmPtr) + (12)) >> 2)] = date.getUTCDate();
  HEAP32[(((tmPtr) + (16)) >> 2)] = date.getUTCMonth();
  HEAP32[(((tmPtr) + (20)) >> 2)] = date.getUTCFullYear() - 1900;
  HEAP32[(((tmPtr) + (24)) >> 2)] = date.getUTCDay();
  var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
  HEAP32[(((tmPtr) + (28)) >> 2)] = yday;
}

__gmtime_js.sig = "vjp";

var isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

var MONTH_DAYS_LEAP_CUMULATIVE = [ 0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335 ];

var MONTH_DAYS_REGULAR_CUMULATIVE = [ 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 ];

var ydayFromDate = date => {
  var leap = isLeapYear(date.getFullYear());
  var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
  var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
  // -1 since it's days since Jan 1
  return yday;
};

function __localtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  var date = new Date(time * 1e3);
  HEAP32[((tmPtr) >> 2)] = date.getSeconds();
  HEAP32[(((tmPtr) + (4)) >> 2)] = date.getMinutes();
  HEAP32[(((tmPtr) + (8)) >> 2)] = date.getHours();
  HEAP32[(((tmPtr) + (12)) >> 2)] = date.getDate();
  HEAP32[(((tmPtr) + (16)) >> 2)] = date.getMonth();
  HEAP32[(((tmPtr) + (20)) >> 2)] = date.getFullYear() - 1900;
  HEAP32[(((tmPtr) + (24)) >> 2)] = date.getDay();
  var yday = ydayFromDate(date) | 0;
  HEAP32[(((tmPtr) + (28)) >> 2)] = yday;
  HEAP32[(((tmPtr) + (36)) >> 2)] = -(date.getTimezoneOffset() * 60);
  // Attention: DST is in December in South, and some regions don't have DST at all.
  var start = new Date(date.getFullYear(), 0, 1);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
  HEAP32[(((tmPtr) + (32)) >> 2)] = dst;
}

__localtime_js.sig = "vjp";

var __mktime_js = function(tmPtr) {
  var ret = (() => {
    var date = new Date(HEAP32[(((tmPtr) + (20)) >> 2)] + 1900, HEAP32[(((tmPtr) + (16)) >> 2)], HEAP32[(((tmPtr) + (12)) >> 2)], HEAP32[(((tmPtr) + (8)) >> 2)], HEAP32[(((tmPtr) + (4)) >> 2)], HEAP32[((tmPtr) >> 2)], 0);
    // There's an ambiguous hour when the time goes back; the tm_isdst field is
    // used to disambiguate it.  Date() basically guesses, so we fix it up if it
    // guessed wrong, or fill in tm_isdst with the guess if it's -1.
    var dst = HEAP32[(((tmPtr) + (32)) >> 2)];
    var guessedOffset = date.getTimezoneOffset();
    var start = new Date(date.getFullYear(), 0, 1);
    var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    var winterOffset = start.getTimezoneOffset();
    var dstOffset = Math.min(winterOffset, summerOffset);
    // DST is in December in South
    if (dst < 0) {
      // Attention: some regions don't have DST at all.
      HEAP32[(((tmPtr) + (32)) >> 2)] = Number(summerOffset != winterOffset && dstOffset == guessedOffset);
    } else if ((dst > 0) != (dstOffset == guessedOffset)) {
      var nonDstOffset = Math.max(winterOffset, summerOffset);
      var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
      // Don't try setMinutes(date.getMinutes() + ...) -- it's messed up.
      date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4);
    }
    HEAP32[(((tmPtr) + (24)) >> 2)] = date.getDay();
    var yday = ydayFromDate(date) | 0;
    HEAP32[(((tmPtr) + (28)) >> 2)] = yday;
    // To match expected behavior, update fields from date
    HEAP32[((tmPtr) >> 2)] = date.getSeconds();
    HEAP32[(((tmPtr) + (4)) >> 2)] = date.getMinutes();
    HEAP32[(((tmPtr) + (8)) >> 2)] = date.getHours();
    HEAP32[(((tmPtr) + (12)) >> 2)] = date.getDate();
    HEAP32[(((tmPtr) + (16)) >> 2)] = date.getMonth();
    HEAP32[(((tmPtr) + (20)) >> 2)] = date.getYear();
    var timeMs = date.getTime();
    if (isNaN(timeMs)) {
      return -1;
    }
    // Return time in microseconds
    return timeMs / 1e3;
  })();
  return BigInt(ret);
};

__mktime_js.sig = "jp";

function __mmap_js(len, prot, flags, fd, offset, allocated, addr) {
  offset = bigintToI53Checked(offset);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var res = FS.mmap(stream, len, offset, prot, flags);
    var ptr = res.ptr;
    HEAP32[((allocated) >> 2)] = res.allocated;
    HEAPU32[((addr) >> 2)] = ptr;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

__mmap_js.sig = "ipiiijpp";

function __munmap_js(addr, len, prot, flags, fd, offset) {
  offset = bigintToI53Checked(offset);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    if (prot & 2) {
      SYSCALLS.doMsync(addr, stream, len, flags, offset);
    }
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

__munmap_js.sig = "ippiiij";

var timers = {};

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  quit_(1, e);
};

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var _proc_exit = code => {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
};

_proc_exit.sig = "vi";

/** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  if (!keepRuntimeAlive()) {
    exitRuntime();
  }
  _proc_exit(status);
};

var _exit = exitJS;

_exit.sig = "vi";

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

var callUserCallback = func => {
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

_emscripten_get_now.sig = "d";

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
    callUserCallback(() => __emscripten_timeout(which, _emscripten_get_now()));
  }, timeout_ms);
  timers[which] = {
    id,
    timeout_ms
  };
  return 0;
};

__setitimer_js.sig = "iid";

var __tzset_js = (timezone, daylight, std_name, dst_name) => {
  // TODO: Use (malleable) environment variables instead of system settings.
  var currentYear = (new Date).getFullYear();
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
  HEAPU32[((timezone) >> 2)] = stdTimezoneOffset * 60;
  HEAP32[((daylight) >> 2)] = Number(winterOffset != summerOffset);
  var extractZone = timezoneOffset => {
    // Why inverse sign?
    // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    var sign = timezoneOffset >= 0 ? "-" : "+";
    var absOffset = Math.abs(timezoneOffset);
    var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    var minutes = String(absOffset % 60).padStart(2, "0");
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

__tzset_js.sig = "vpppp";

var _emscripten_date_now = () => Date.now();

_emscripten_date_now.sig = "d";

var nowIsMonotonic = 1;

var checkWasiClock = clock_id => clock_id >= 0 && clock_id <= 3;

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
  HEAP64[((ptime) >> 3)] = BigInt(nsec);
  return 0;
}

_clock_time_get.sig = "iijp";

var getHeapMax = () => // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
// for any code that deals with heap sizes, which would require special
// casing all heap size related code to treat 0 specially.
2147483648;

var _emscripten_get_heap_max = () => getHeapMax();

_emscripten_get_heap_max.sig = "p";

var growMemory = size => {
  var oldHeapSize = wasmMemory.buffer.byteLength;
  var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(pages);
    // .grow() takes a delta compared to the previous size
    updateMemoryViews();
    return 1;
  } catch (e) {}
};

var _emscripten_resize_heap = requestedSize => {
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
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var replacement = growMemory(newSize);
    if (replacement) {
      return true;
    }
  }
  return false;
};

_emscripten_resize_heap.sig = "ip";

var runtimeKeepalivePush = () => {
  runtimeKeepaliveCounter += 1;
};

runtimeKeepalivePush.sig = "v";

var runtimeKeepalivePop = () => {
  runtimeKeepaliveCounter -= 1;
};

runtimeKeepalivePop.sig = "v";

/** @param {number=} timeout */ var safeSetTimeout = (func, timeout) => {
  runtimeKeepalivePush();
  return setTimeout(() => {
    runtimeKeepalivePop();
    callUserCallback(func);
  }, timeout);
};

var _emscripten_sleep = ms => Asyncify.handleSleep(wakeUp => safeSetTimeout(wakeUp, ms));

_emscripten_sleep.sig = "vi";

_emscripten_sleep.isAsync = true;

var ENV = PHPLoader.ENV || {};

var getExecutableName = () => thisProgram || "./this.program";

var getEnvStrings = () => {
  if (!getEnvStrings.strings) {
    // Default values.
    // Browser language detection #8751
    var lang = ((typeof navigator == "object" && navigator.language) || "C").replace("-", "_") + ".UTF-8";
    var env = {
      "USER": "web_user",
      "LOGNAME": "web_user",
      "PATH": "/",
      "PWD": "/",
      "HOME": "/home/web_user",
      "LANG": lang,
      "_": getExecutableName()
    };
    // Apply the user-provided values, if any.
    for (var x in ENV) {
      // x is a key in ENV; if ENV[x] is undefined, that means it was
      // explicitly set to be so. We allow user code to do that to
      // force variables with default values to remain unset.
      if (ENV[x] === undefined) delete env[x]; else env[x] = ENV[x];
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
    HEAPU32[(((__environ) + (envp)) >> 2)] = ptr;
    bufSize += stringToUTF8(string, ptr, Infinity) + 1;
    envp += 4;
  }
  return 0;
};

_environ_get.sig = "ipp";

var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
  var strings = getEnvStrings();
  HEAPU32[((penviron_count) >> 2)] = strings.length;
  var bufSize = 0;
  for (var string of strings) {
    bufSize += lengthBytesUTF8(string) + 1;
  }
  HEAPU32[((penviron_buf_size) >> 2)] = bufSize;
  return 0;
};

_environ_sizes_get.sig = "ipp";

function _fd_fdstat_get(fd, pbuf) {
  try {
    var rightsBase = 0;
    var rightsInheriting = 0;
    var flags = 0;
    {
      var stream = SYSCALLS.getStreamFromFD(fd);
      // All character devices are terminals (other things a Linux system would
      // assume is a character device, like the mouse, we have special APIs for).
      var type = stream.tty ? 2 : FS.isDir(stream.mode) ? 3 : FS.isLink(stream.mode) ? 7 : 4;
    }
    HEAP8[pbuf] = type;
    HEAP16[(((pbuf) + (2)) >> 1)] = flags;
    HEAP64[(((pbuf) + (8)) >> 3)] = BigInt(rightsBase);
    HEAP64[(((pbuf) + (16)) >> 3)] = BigInt(rightsInheriting);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_fdstat_get.sig = "iip";

/** @param {number=} offset */ var doReadv = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >> 2)];
    var len = HEAPU32[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.read(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) break;
    // nothing more to read
    if (typeof offset != "undefined") {
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
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_pread.sig = "iippjp";

/** @param {number=} offset */ var doWritev = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >> 2)];
    var len = HEAPU32[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.write(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) {
      // No more space to write.
      break;
    }
    if (typeof offset != "undefined") {
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
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_pwrite.sig = "iippjp";

function _fd_read(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doReadv(stream, iov, iovcnt);
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_read.sig = "iippp";

function _fd_seek(fd, offset, whence, newOffset) {
  offset = bigintToI53Checked(offset);
  try {
    if (isNaN(offset)) return 61;
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.llseek(stream, offset, whence);
    HEAP64[((newOffset) >> 3)] = BigInt(stream.position);
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    // reset readdir state
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_seek.sig = "iijip";

var _fd_sync = function(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    return Asyncify.handleSleep(wakeUp => {
      var mount = stream.node.mount;
      if (!mount.type.syncfs) {
        // We write directly to the file system, so there's nothing to do here.
        wakeUp(0);
        return;
      }
      mount.type.syncfs(mount, false, err => {
        wakeUp(err ? 29 : 0);
      });
    });
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
};

_fd_sync.sig = "ii";

_fd_sync.isAsync = true;

function _fd_write(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doWritev(stream, iov, iovcnt);
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_write.sig = "iippp";

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
    HEAP32[(((ai) + (4)) >> 2)] = family;
    HEAP32[(((ai) + (8)) >> 2)] = type;
    HEAP32[(((ai) + (12)) >> 2)] = proto;
    HEAPU32[(((ai) + (24)) >> 2)] = canon;
    HEAPU32[(((ai) + (20)) >> 2)] = sa;
    if (family === 10) {
      HEAP32[(((ai) + (16)) >> 2)] = 28;
    } else {
      HEAP32[(((ai) + (16)) >> 2)] = 16;
    }
    HEAP32[(((ai) + (28)) >> 2)] = 0;
    return ai;
  }
  if (hint) {
    flags = HEAP32[((hint) >> 2)];
    family = HEAP32[(((hint) + (4)) >> 2)];
    type = HEAP32[(((hint) + (8)) >> 2)];
    proto = HEAP32[(((hint) + (12)) >> 2)];
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
  if (hint !== 0 && (HEAP32[((hint) >> 2)] & 2) && !node) {
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
        addr = [ 0, 0, 0, _htonl(1) ];
      }
    }
    ai = allocaddrinfo(family, type, proto, null, addr, port);
    HEAPU32[((out) >> 2)] = ai;
    return 0;
  }
  // try as a numeric address
  node = UTF8ToString(node);
  addr = inetPton4(node);
  if (addr !== null) {
    // incoming node is a valid ipv4 address
    if (family === 0 || family === 2) {
      family = 2;
    } else if (family === 10 && (flags & 8)) {
      addr = [ 0, 0, _htonl(65535), addr ];
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
    HEAPU32[((out) >> 2)] = ai;
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
    addr = [ 0, 0, _htonl(65535), addr ];
  }
  ai = allocaddrinfo(family, type, proto, null, addr, port);
  HEAPU32[((out) >> 2)] = ai;
  return 0;
};

_getaddrinfo.sig = "ipppp";

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
    if ((flags & 1) || !(lookup = DNS.lookup_addr(addr))) {
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
    port = "" + port;
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

_getnameinfo.sig = "ipipipii";

var Protocols = {
  list: [],
  map: {}
};

var stringToAscii = (str, buffer) => {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++] = str.charCodeAt(i);
  }
  // Null-terminate the string
  HEAP8[buffer] = 0;
};

var _setprotoent = stayopen => {
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
      HEAPU32[(((aliasListBuf) + (j)) >> 2)] = aliasBuf;
    }
    HEAPU32[(((aliasListBuf) + (j)) >> 2)] = 0;
    // Terminating NULL pointer.
    // generate protoent
    var pe = _malloc(12);
    HEAPU32[((pe) >> 2)] = nameBuf;
    HEAPU32[(((pe) + (4)) >> 2)] = aliasListBuf;
    HEAP32[(((pe) + (8)) >> 2)] = proto;
    return pe;
  }
  // Populate the protocol 'database'. The entries are limited to tcp and udp, though it is fairly trivial
  // to add extra entries from /etc/protocols if desired - though not sure if that'd actually be useful.
  var list = Protocols.list;
  var map = Protocols.map;
  if (list.length === 0) {
    var entry = allocprotoent("tcp", 6, [ "TCP" ]);
    list.push(entry);
    map["tcp"] = map["6"] = entry;
    entry = allocprotoent("udp", 17, [ "UDP" ]);
    list.push(entry);
    map["udp"] = map["17"] = entry;
  }
  _setprotoent.index = 0;
};

_setprotoent.sig = "vi";

var _getprotobyname = name => {
  // struct protoent *getprotobyname(const char *);
  name = UTF8ToString(name);
  _setprotoent(true);
  var result = Protocols.map[name];
  return result;
};

_getprotobyname.sig = "pp";

var _getprotobynumber = number => {
  // struct protoent *getprotobynumber(int proto);
  _setprotoent(true);
  var result = Protocols.map[number];
  return result;
};

_getprotobynumber.sig = "pi";

function _js_flock(fd, op) {
  if (typeof Module["userSpace"] === "undefined") {
    // In the absence of a real locking facility,
    // return success by default as Emscripten does.
    return 0;
  }
  return Module["userSpace"].flock(fd, op);
}

function _js_open_process(command, argsPtr, argsLength, descriptorsPtr, descriptorsLength, cwdPtr, cwdLength, envPtr, envLength) {
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
      const splitAt = envEntry.indexOf("=");
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
      parent: HEAPU32[(descriptorPtr + 8) >> 2]
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
      if (e.code === "SPAWN_UNSUPPORTED") {
        ___errno_location(ERRNO_CODES.ENOSYS);
        return -1;
      }
      if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
      ___errno_location(e.code);
      return -1;
    }
    const ProcInfo = {
      pid: cp.pid,
      exited: false
    };
    PHPWASM.processTable[ProcInfo.pid] = ProcInfo;
    const stdinParentFd = std[0]?.parent, stdinChildFd = std[0]?.child, stdoutChildFd = std[1]?.child, stdoutParentFd = std[1]?.parent, stderrChildFd = std[2]?.child, stderrParentFd = std[2]?.parent;
    const detachPipeDataListeners = [];
    cp.on("exit", function(code) {
      for (const detach of detachPipeDataListeners) {
        detach();
      }
      for (const fd of [ // The child process exited. Let's clean up its output streams:
      stdoutChildFd, stderrChildFd, stdinChildFd ]) {
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
      const onStdoutData = function(data) {
        try {
          stdoutStream.stream_ops.write(stdoutStream, data, 0, data.length, stdoutAt);
          stdoutAt += data.length;
        } catch {
          // PHP may close the child pipe before Node finishes
          // draining already-buffered stdout data. Late chunks are
          // no longer deliverable, so detach the listener and stop.
          cp.stdout.off("data", onStdoutData);
        }
      };
      cp.stdout.on("data", onStdoutData);
      detachPipeDataListeners.push(() => cp.stdout.off("data", onStdoutData));
    }
    // Pass data from child process's stderr to PHP's end of the stdout pipe.
    if (stderrChildFd) {
      const stderrStream = SYSCALLS.getStreamFromFD(stderrChildFd);
      let stderrAt = 0;
      const onStderrData = function(data) {
        try {
          stderrStream.stream_ops.write(stderrStream, data, 0, data.length, stderrAt);
          stderrAt += data.length;
        } catch {
          cp.stderr.off("data", onStderrData);
        }
      };
      cp.stderr.on("data", onStderrData);
      detachPipeDataListeners.push(() => cp.stderr.off("data", onStderrData));
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
        cp.on("spawn", () => {
          if (resolved) return;
          resolved = true;
          resolve();
        });
        cp.on("error", e => {
          if (resolved) return;
          resolved = true;
          reject(e);
        });
        cp.on("exit", function(code) {
          if (resolved) return;
          resolved = true;
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Process exited with code ${code}`));
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
          reject(new Error("Process timed out"));
        }, 5e3);
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
      // We are the ones responsible for pumping the data from the stdinChildFd
      // into the child process. There is no concurrent task operating on the
      // piped data or polling the file descriptors, etc. Nothing will ever
      // read from the stdinChildFd if we don't do it here.
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
      const iov = _malloc(16);
      // Space for iovec structure
      const pnum = _malloc(4);
      // Space for number of bytes read
      const buffer = _malloc(CHUNK_SIZE);
      // Set up iovec structure pointing to our buffer
      HEAPU32[iov >> 2] = buffer;
      // iov_base
      HEAPU32[(iov + 4) >> 2] = CHUNK_SIZE;
      // iov_len
      function pump() {
        try {
          while (true) {
            if (cp.killed) {
              stopPumpingAndCloseStdin();
              return;
            }
            const result = js_fd_read(stdinChildFd, iov, 1, pnum, false);
            const bytesRead = HEAPU32[pnum >> 2];
            if (result === 0 && bytesRead > 0) {
              const wrote = HEAPU8.subarray(buffer, buffer + bytesRead);
              cp.stdin.write(wrote);
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
          if (typeof FS == "undefined" || !(e.name === "ErrnoError")) {
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
      // pump() can never alter the result of this function.
      // Even when it fails, we still return the pid.
      // Why?
      // Because the process already started. We wouldn't backtrack
      // with fork(), we won't backtrack here. Let's give PHP the pid,
      // and let it think it's the parent process. It will clean up the
      // resources as needed.
      // stdin may be non-blocking – let's check for updates periodically.
      // If we exhaust it at any point, pump() will self-terminate.
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

function _js_release_file_locks() {
  if (typeof Module["userSpace"] === "undefined") {
    return;
  }
  return Module["userSpace"].js_release_file_locks();
}

function _js_waitpid(pid, exitCodePtr) {
  if (!PHPWASM.processTable[pid]) {
    return -1;
  }
  return Asyncify.handleSleep(wakeUp => {
    const poll = function() {
      if (PHPWASM.processTable[pid]?.exited) {
        HEAPU32[exitCodePtr >> 2] = PHPWASM.processTable[pid].exitCode;
        wakeUp(pid);
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}

function _random_get(buffer, size) {
  try {
    randomFill(HEAPU8.subarray(buffer, buffer + size));
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_random_get.sig = "ipp";

var arraySum = (array, index) => {
  var sum = 0;
  for (var i = 0; i <= index; sum += array[i++]) {}
  return sum;
};

var MONTH_DAYS_LEAP = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

var MONTH_DAYS_REGULAR = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

var addDays = (date, days) => {
  var newDate = new Date(date.getTime());
  while (days > 0) {
    var leap = isLeapYear(newDate.getFullYear());
    var currentMonth = newDate.getMonth();
    var daysInCurrentMonth = (leap ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[currentMonth];
    if (days > daysInCurrentMonth - newDate.getDate()) {
      // we spill over to next month
      days -= (daysInCurrentMonth - newDate.getDate() + 1);
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
  var SPECIAL_CHARS = "\\!@#$^&*()+=-[]/{}|:<>?,.";
  for (var i = 0, ii = SPECIAL_CHARS.length; i < ii; ++i) {
    pattern = pattern.replace(new RegExp("\\" + SPECIAL_CHARS[i], "g"), "\\" + SPECIAL_CHARS[i]);
  }
  // reduce number of matchers
  var EQUIVALENT_MATCHERS = {
    "A": "%a",
    "B": "%b",
    "c": "%a %b %d %H:%M:%S %Y",
    "D": "%m\\/%d\\/%y",
    "e": "%d",
    "F": "%Y-%m-%d",
    "h": "%b",
    "R": "%H\\:%M",
    "r": "%I\\:%M\\:%S\\s%p",
    "T": "%H\\:%M\\:%S",
    "x": "%m\\/%d\\/(?:%y|%Y)",
    "X": "%H\\:%M\\:%S"
  };
  // TODO: take care of locale
  var DATE_PATTERNS = {
    /* weekday name */ "a": "(?:Sun(?:day)?)|(?:Mon(?:day)?)|(?:Tue(?:sday)?)|(?:Wed(?:nesday)?)|(?:Thu(?:rsday)?)|(?:Fri(?:day)?)|(?:Sat(?:urday)?)",
    /* month name */ "b": "(?:Jan(?:uary)?)|(?:Feb(?:ruary)?)|(?:Mar(?:ch)?)|(?:Apr(?:il)?)|May|(?:Jun(?:e)?)|(?:Jul(?:y)?)|(?:Aug(?:ust)?)|(?:Sep(?:tember)?)|(?:Oct(?:ober)?)|(?:Nov(?:ember)?)|(?:Dec(?:ember)?)",
    /* century */ "C": "\\d\\d",
    /* day of month */ "d": "0[1-9]|[1-9](?!\\d)|1\\d|2\\d|30|31",
    /* hour (24hr) */ "H": "\\d(?!\\d)|[0,1]\\d|20|21|22|23",
    /* hour (12hr) */ "I": "\\d(?!\\d)|0\\d|10|11|12",
    /* day of year */ "j": "00[1-9]|0?[1-9](?!\\d)|0?[1-9]\\d(?!\\d)|[1,2]\\d\\d|3[0-6]\\d",
    /* month */ "m": "0[1-9]|[1-9](?!\\d)|10|11|12",
    /* minutes */ "M": "0\\d|\\d(?!\\d)|[1-5]\\d",
    /* whitespace */ "n": " ",
    /* AM/PM */ "p": "AM|am|PM|pm|A\\.M\\.|a\\.m\\.|P\\.M\\.|p\\.m\\.",
    /* seconds */ "S": "0\\d|\\d(?!\\d)|[1-5]\\d|60",
    /* week number */ "U": "0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53",
    /* week number */ "W": "0\\d|\\d(?!\\d)|[1-4]\\d|50|51|52|53",
    /* weekday number */ "w": "[0-6]",
    /* 2-digit year */ "y": "\\d\\d",
    /* 4-digit year */ "Y": "\\d\\d\\d\\d",
    /* whitespace */ "t": " ",
    /* time zone */ "z": "Z|(?:[\\+\\-]\\d\\d:?(?:\\d\\d)?)"
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
    DEC: 11
  };
  var DAY_NUMBERS_SUN_FIRST = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6
  };
  var DAY_NUMBERS_MON_FIRST = {
    MON: 0,
    TUE: 1,
    WED: 2,
    THU: 3,
    FRI: 4,
    SAT: 5,
    SUN: 6
  };
  var capture = [];
  var pattern_out = pattern.replace(/%(.)/g, (m, c) => EQUIVALENT_MATCHERS[c] || m).replace(/%(.)/g, (_, c) => {
    let pat = DATE_PATTERNS[c];
    if (pat) {
      capture.push(c);
      return `(${pat})`;
    } else {
      return c;
    }
  }).replace(// any number of space or tab characters match zero or more spaces
  /\s+/g, "\\s*");
  var matches = new RegExp("^" + pattern_out, "i").exec(UTF8ToString(buf));
  function initDate() {
    function fixup(value, min, max) {
      return (typeof value != "number" || isNaN(value)) ? min : (value >= min ? (value <= max ? value : max) : min);
    }
    return {
      year: fixup(HEAP32[(((tm) + (20)) >> 2)] + 1900, 1970, 9999),
      month: fixup(HEAP32[(((tm) + (16)) >> 2)], 0, 11),
      day: fixup(HEAP32[(((tm) + (12)) >> 2)], 1, 31),
      hour: fixup(HEAP32[(((tm) + (8)) >> 2)], 0, 23),
      min: fixup(HEAP32[(((tm) + (4)) >> 2)], 0, 59),
      sec: fixup(HEAP32[((tm) >> 2)], 0, 59),
      gmtoff: 0
    };
  }
  if (matches) {
    var date = initDate();
    var value;
    var getMatch = symbol => {
      var pos = capture.indexOf(symbol);
      // check if symbol appears in regexp
      if (pos >= 0) {
        // return matched value or null (falsy!) for non-matches
        return matches[pos + 1];
      }
      return;
    };
    // seconds
    if ((value = getMatch("S"))) {
      date.sec = Number(value);
    }
    // minutes
    if ((value = getMatch("M"))) {
      date.min = Number(value);
    }
    // hours
    if ((value = getMatch("H"))) {
      // 24h clock
      date.hour = Number(value);
    } else if ((value = getMatch("I"))) {
      // AM/PM clock
      var hour = Number(value);
      if ((value = getMatch("p"))) {
        hour += value.toUpperCase()[0] === "P" ? 12 : 0;
      }
      date.hour = hour;
    }
    // year
    if ((value = getMatch("Y"))) {
      // parse from four-digit year
      date.year = Number(value);
    } else if ((value = getMatch("y"))) {
      // parse from two-digit year...
      var year = Number(value);
      if ((value = getMatch("C"))) {
        // ...and century
        year += Number(value) * 100;
      } else {
        // ...and rule-of-thumb
        year += year < 69 ? 2e3 : 1900;
      }
      date.year = year;
    }
    // month
    if ((value = getMatch("m"))) {
      // parse from month number
      date.month = Number(value) - 1;
    } else if ((value = getMatch("b"))) {
      // parse from month name
      date.month = MONTH_NUMBERS[value.substring(0, 3).toUpperCase()] || 0;
    }
    // day
    if ((value = getMatch("d"))) {
      // get day of month directly
      date.day = Number(value);
    } else if ((value = getMatch("j"))) {
      // get day of month from day of year ...
      var day = Number(value);
      var leapYear = isLeapYear(date.year);
      for (var month = 0; month < 12; ++month) {
        var daysUntilMonth = arraySum(leapYear ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, month - 1);
        if (day <= daysUntilMonth + (leapYear ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[month]) {
          date.day = day - daysUntilMonth;
        }
      }
    } else if ((value = getMatch("a"))) {
      // get day of month from weekday ...
      var weekDay = value.substring(0, 3).toUpperCase();
      if ((value = getMatch("U"))) {
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
          endDate = addDays(janFirst, weekDayNumber + 7 * (weekNumber - 1));
        } else {
          // Jan 1st is not a Sunday, and, hence still in the 0th CW
          endDate = addDays(janFirst, 7 - janFirst.getDay() + weekDayNumber + 7 * (weekNumber - 1));
        }
        date.day = endDate.getDate();
        date.month = endDate.getMonth();
      } else if ((value = getMatch("W"))) {
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
          endDate = addDays(janFirst, weekDayNumber + 7 * (weekNumber - 1));
        } else {
          // Jan 1st is not a Monday, and, hence still in the 0th CW
          endDate = addDays(janFirst, 7 - janFirst.getDay() + 1 + weekDayNumber + 7 * (weekNumber - 1));
        }
        date.day = endDate.getDate();
        date.month = endDate.getMonth();
      }
    }
    // time zone
    if ((value = getMatch("z"))) {
      // GMT offset as either 'Z' or +-HH:MM or +-HH or +-HHMM
      if (value.toLowerCase() === "z") {
        date.gmtoff = 0;
      } else {
        var match = value.match(/^((?:\-|\+)\d\d):?(\d\d)?/);
        date.gmtoff = match[1] * 3600;
        if (match[2]) {
          date.gmtoff += date.gmtoff > 0 ? match[2] * 60 : -match[2] * 60;
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
        */ var fullDate = new Date(date.year, date.month, date.day, date.hour, date.min, date.sec, 0);
    HEAP32[((tm) >> 2)] = fullDate.getSeconds();
    HEAP32[(((tm) + (4)) >> 2)] = fullDate.getMinutes();
    HEAP32[(((tm) + (8)) >> 2)] = fullDate.getHours();
    HEAP32[(((tm) + (12)) >> 2)] = fullDate.getDate();
    HEAP32[(((tm) + (16)) >> 2)] = fullDate.getMonth();
    HEAP32[(((tm) + (20)) >> 2)] = fullDate.getFullYear() - 1900;
    HEAP32[(((tm) + (24)) >> 2)] = fullDate.getDay();
    HEAP32[(((tm) + (28)) >> 2)] = arraySum(isLeapYear(fullDate.getFullYear()) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, fullDate.getMonth() - 1) + fullDate.getDate() - 1;
    HEAP32[(((tm) + (32)) >> 2)] = 0;
    HEAP32[(((tm) + (36)) >> 2)] = date.gmtoff;
    // we need to convert the matched sequence into an integer array to take care of UTF-8 characters > 0x7F
    // TODO: not sure that intArrayFromString handles all unicode characters correctly
    return buf + lengthBytesUTF8(matches[0]);
  }
  return 0;
};

_strptime.sig = "pppp";

function _wasm_close(socketd) {
  return PHPWASM.shutdownSocket(socketd, 2);
}

function _wasm_setsockopt(socketd, level, optionName, optionValuePtr, optionLen) {
  const optionValue = HEAPU8[optionValuePtr];
  const SOL_SOCKET = 1;
  const SO_KEEPALIVE = 9;
  const SO_RCVTIMEO = 66;
  const SO_SNDTIMEO = 67;
  const IPPROTO_TCP = 6;
  const TCP_NODELAY = 1;
  // Options that we can forward to the WebSocket proxy
  const isForwardable = (level === SOL_SOCKET && optionName === SO_KEEPALIVE) || (level === IPPROTO_TCP && optionName === TCP_NODELAY);
  // Options that we acknowledge but don't actually implement
  // (WebSocket connections handle timeouts differently)
  const isIgnorable = level === SOL_SOCKET && (optionName === SO_RCVTIMEO || optionName === SO_SNDTIMEO);
  if (!isForwardable && !isIgnorable) {
    console.warn(`Unsupported socket option: ${level}, ${optionName}, ${optionValue}`);
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
}

function _wasm_shutdown(socketd, how) {
  return PHPWASM.shutdownSocket(socketd, how);
}

var runAndAbortIfError = func => {
  try {
    return func();
  } catch (e) {
    abort(e);
  }
};

var Asyncify = {
  instrumentWasmImports(imports) {
    var importPattern = /^(invoke_i|invoke_ii|invoke_iii|invoke_iiii|invoke_iiiii|invoke_iiiiii|invoke_iiiiiii|invoke_iiiiiiii|invoke_iiiiiiiii|invoke_iiiiiiiiii|invoke_v|invoke_vi|invoke_vii|invoke_viidii|invoke_viii|invoke_viiii|invoke_viiiii|invoke_viiiiii|invoke_viiiiiii|invoke_viiiiiiiii|invoke_i|invoke_ii|invoke_iii|invoke_iiii|invoke_iiiii|invoke_iiiiii|invoke_iiiiiii|invoke_iiiiiiii|invoke_iiiiiiiiii|invoke_iij|invoke_iiji|invoke_iiij|invoke_iijii|invoke_iijiji|invoke_jii|invoke_jiii|invoke_viijii|invoke_vji|js_open_process|_js_open_process|_asyncjs__js_open_process|js_popen_to_file|_js_popen_to_file|_asyncjs__js_popen_to_file|__syscall_fcntl64|___syscall_fcntl64|_asyncjs___syscall_fcntl64|js_release_file_locks|_js_release_file_locks|_async_js_release_file_locks|js_flock|_js_flock|_async_js_flock|js_fd_read|_js_fd_read|fd_close|_fd_close|_asyncjs__fd_close|close|_close|js_module_onMessage|zend_hash_str_find|_js_module_onMessage|_asyncjs__js_module_onMessage|js_waitpid|_js_waitpid|_asyncjs__js_waitpid|wasm_poll_socket|_wasm_poll_socket|_asyncjs__wasm_poll_socket|_wasm_shutdown|_asyncjs__wasm_shutdown|recv|_recv|setsockopt|_setsockopt|wasm_connect|_wasm_connect|__asyncjs__.*)$/;
    for (let [x, original] of Object.entries(imports)) {
      if (typeof original == "function") {
        let isAsyncifyImport = original.isAsync || importPattern.test(x);
      }
    }
  },
  instrumentFunction(original) {
    var wrapper = (...args) => {
      Asyncify.exportCallStack.push(original);
      try {
        return original(...args);
      } finally {
        if (!ABORT) {
          var top = Asyncify.exportCallStack.pop();
          Asyncify.maybeStopUnwind();
        }
      }
    };
    Asyncify.funcWrappers.set(original, wrapper);
    wrapper.orig = original;
    return wrapper;
  },
  instrumentWasmExports(exports) {
    var ret = {};
    for (let [x, original] of Object.entries(exports)) {
      if (typeof original == "function") {
        var wrapper = Asyncify.instrumentFunction(original);
        ret[x] = wrapper;
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
    Disabled: 3
  },
  state: 0,
  StackSize: 4096,
  currData: null,
  handleSleepReturnValue: 0,
  exportCallStack: [],
  callstackFuncToId: new Map,
  callStackIdToFunc: new Map,
  funcWrappers: new Map,
  callStackId: 0,
  asyncPromiseHandlers: null,
  sleepCallbacks: [],
  getCallStackId(func) {
    if (!Asyncify.callstackFuncToId.has(func)) {
      var id = Asyncify.callStackId++;
      Asyncify.callstackFuncToId.set(func, id);
      Asyncify.callStackIdToFunc.set(id, func);
    }
    return Asyncify.callstackFuncToId.get(func);
  },
  maybeStopUnwind() {
    if (Asyncify.currData && Asyncify.state === Asyncify.State.Unwinding && Asyncify.exportCallStack.length === 0) {
      // We just finished unwinding.
      // Be sure to set the state before calling any other functions to avoid
      // possible infinite recursion here (For example in debug pthread builds
      // the dbg() function itself can call back into WebAssembly to get the
      // current pthread_self() pointer).
      Asyncify.state = Asyncify.State.Normal;
      runtimeKeepalivePush();
      // Keep the runtime alive so that a re-wind can be done later.
      runAndAbortIfError(_asyncify_stop_unwind);
      if (typeof Fibers != "undefined") {
        Fibers.trampoline();
      }
    }
  },
  whenDone() {
    return new Promise((resolve, reject) => {
      Asyncify.asyncPromiseHandlers = {
        resolve,
        reject
      };
    });
  },
  allocateData() {
    // An asyncify data structure has three fields:
    //  0  current stack pos
    //  4  max stack pos
    //  8  id of function at bottom of the call stack (callStackIdToFunc[id] == wasm func)
    // The Asyncify ABI only interprets the first two fields, the rest is for the runtime.
    // We also embed a stack in the same memory region here, right next to the structure.
    // This struct is also defined as asyncify_data_t in emscripten/fiber.h
    var ptr = _malloc(12 + Asyncify.StackSize);
    Asyncify.setDataHeader(ptr, ptr + 12, Asyncify.StackSize);
    Asyncify.setDataRewindFunc(ptr);
    return ptr;
  },
  setDataHeader(ptr, stack, stackSize) {
    HEAPU32[((ptr) >> 2)] = stack;
    HEAPU32[(((ptr) + (4)) >> 2)] = stack + stackSize;
  },
  setDataRewindFunc(ptr) {
    var bottomOfCallStack = Asyncify.exportCallStack[0];
    var rewindId = Asyncify.getCallStackId(bottomOfCallStack);
    HEAP32[(((ptr) + (8)) >> 2)] = rewindId;
  },
  getDataRewindFunc(ptr) {
    var id = HEAP32[(((ptr) + (8)) >> 2)];
    var func = Asyncify.callStackIdToFunc.get(id);
    return func;
  },
  doRewind(ptr) {
    var original = Asyncify.getDataRewindFunc(ptr);
    var func = Asyncify.funcWrappers.get(original);
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
        runAndAbortIfError(() => _asyncify_start_rewind(Asyncify.currData));
        if (typeof MainLoop != "undefined" && MainLoop.func) {
          MainLoop.resume();
        }
        var asyncWasmReturnValue, isError = false;
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
            (isError ? asyncPromiseHandlers.reject : asyncPromiseHandlers.resolve)(asyncWasmReturnValue);
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
        if (!Asyncify._cachedData) { Asyncify._cachedData = Asyncify.allocateData(); } else { Asyncify.setDataHeader(Asyncify._cachedData, Asyncify._cachedData + 12, Asyncify.StackSize); Asyncify.setDataRewindFunc(Asyncify._cachedData); } Asyncify.currData = Asyncify._cachedData;
        if (typeof MainLoop != "undefined" && MainLoop.func) {
          MainLoop.pause();
        }
        runAndAbortIfError(() => _asyncify_start_unwind(Asyncify.currData));
      }
    } else if (Asyncify.state === Asyncify.State.Rewinding) {
      // Stop a resume.
      Asyncify.state = Asyncify.State.Normal;
      runAndAbortIfError(_asyncify_stop_rewind);
      Asyncify.currData = null;
      // Call all sleep callbacks now that the sleep-resume is all done.
      Asyncify.sleepCallbacks.forEach(callUserCallback);
    } else {
      abort(`invalid state: ${Asyncify.state}`);
    }
    return Asyncify.handleSleepReturnValue;
  },
  handleAsync: startAsync => Asyncify.handleSleep(wakeUp => {
    // TODO: add error handling as a second param when handleSleep implements it.
    startAsync().then(wakeUp);
  })
};

var getCFunc = ident => {
  var func = Module["_" + ident];
  // closure exported function
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
     */ var ccall = (ident, returnType, argTypes, args, opts) => {
  // For fast lookup of conversion functions
  var toC = {
    "string": str => {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        // null string
        ret = stringToUTF8OnStack(str);
      }
      return ret;
    },
    "array": arr => {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };
  function convertReturnValue(ret) {
    if (returnType === "string") {
      return UTF8ToString(ret);
    }
    if (returnType === "boolean") return Boolean(ret);
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

var FS_createPath = (...args) => FS.createPath(...args);

var FS_unlink = (...args) => FS.unlink(...args);

var FS_createLazyFile = (...args) => FS.createLazyFile(...args);

var FS_createDevice = (...args) => FS.createDevice(...args);

var _setTempRet0 = setTempRet0;

var getTempRet0 = val => __emscripten_tempret_get();

var _getTempRet0 = getTempRet0;

var uncaughtExceptionCount = 0;

var ___cxa_throw = (ptr, type, destructor) => {
  var info = new ExceptionInfo(ptr);
  // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
  info.init(type, destructor);
  exceptionLast = ptr;
  uncaughtExceptionCount++;
  throw exceptionLast;
};

___cxa_throw.sig = "vppp";

var _wasm_recv = function(sockfd, buffer, size, flags) {
  return Asyncify.handleSleep(wakeUp => {
    const poll = function() {
      let newl = ___syscall_recvfrom(sockfd, buffer, size, flags, null, null);
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

registerWasmPlugin();

FS.createPreloadedFile = FS_createPreloadedFile;

FS.preloadFile = FS_preloadFile;

FS.staticInit();

if (ENVIRONMENT_IS_NODE) {
  NODEFS.staticInit();
}

PHPWASM.init();

// End JS library code
// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.
{
  // Begin ATMODULES hooks
  if (Module["preloadPlugins"]) preloadPlugins = Module["preloadPlugins"];
  if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
  if (Module["print"]) out = Module["print"];
  if (Module["printErr"]) err = Module["printErr"];
  if (Module["dynamicLibraries"]) dynamicLibraries = Module["dynamicLibraries"];
  if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
  // End ATMODULES hooks
  if (Module["arguments"]) arguments_ = Module["arguments"];
  if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
if (Module["quit"]) quit_=Module["quit"];
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
    while (Module["preInit"].length > 0) {
      Module["preInit"].shift()();
    }
  }
}

// Begin runtime exports
Module["wasmExports"] = wasmExports;

Module["addRunDependency"] = addRunDependency;

Module["removeRunDependency"] = removeRunDependency;

Module["ccall"] = ccall;

Module["UTF8ToString"] = UTF8ToString;

Module["stringToUTF8"] = stringToUTF8;

Module["lengthBytesUTF8"] = lengthBytesUTF8;

Module["FS_preloadFile"] = FS_preloadFile;

Module["FS_unlink"] = FS_unlink;

Module["FS_createPath"] = FS_createPath;

Module["FS_createDevice"] = FS_createDevice;

Module["FS_createDataFile"] = FS_createDataFile;

Module["FS_createLazyFile"] = FS_createLazyFile;

Module["PROXYFS"] = PROXYFS;

// End runtime exports
// Begin JS library exports
Module["UTF8ToString"] = UTF8ToString;

Module["lengthBytesUTF8"] = lengthBytesUTF8;

Module["stringToUTF8"] = stringToUTF8;

Module["FS"] = FS;

Module["___asyncify_data"] = ___asyncify_data;

Module["___asyncify_state"] = ___asyncify_state;

Module["_exit"] = _exit;

Module["_emscripten_sleep"] = _emscripten_sleep;

Module["_getaddrinfo"] = _getaddrinfo;

Module["_wasm_setsockopt"] = _wasm_setsockopt;

Module["_setTempRet0"] = _setTempRet0;

Module["_getTempRet0"] = _getTempRet0;

Module["___cxa_throw"] = ___cxa_throw;

Module["_wasm_recv"] = _wasm_recv;

// End JS library exports
// end include: postlibrary.js
var ASM_CONSTS = {};

function js_popen_to_file(command, mode, exitCodePtr) {
  const returnCallback = resolver => Asyncify.handleSleep(resolver);
  if (!command) return 1;
  const cmdstr = UTF8ToString(command);
  if (!cmdstr.length) return 0;
  const modestr = UTF8ToString(mode);
  if (!modestr.length) return 0;
  if (modestr === "w") {
    console.error('popen($cmd, "w") is not implemented yet');
  }
  return returnCallback(async wakeUp => {
    let cp;
    try {
      cp = PHPWASM.spawnProcess(cmdstr, []);
      if (cp instanceof Promise) {
        cp = await cp;
      }
    } catch (e) {
      console.error(e);
      if (e.code === "SPAWN_UNSUPPORTED") {
        return 1;
      }
      throw e;
    }
    const outByteArrays = [];
    cp.stdout.on("data", function(data) {
      outByteArrays.push(data);
    });
    const outputPath = "/tmp/popen_output";
    cp.on("exit", function(exitCode) {
      const outBytes = new Uint8Array(outByteArrays.reduce((acc, curr) => acc + curr.length, 0));
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

js_popen_to_file.sig = "iiii";

function wasm_poll_socket(socketd, events, timeout) {
  const returnCallback = resolver => Asyncify.handleSleep(resolver);
  const POLLIN = 1;
  const POLLPRI = 2;
  const POLLOUT = 4;
  const POLLERR = 8;
  const POLLHUP = 16;
  const POLLNVAL = 32;
  return returnCallback(wakeUp => {
    const polls = [];
    const stream = FS.getStream(socketd);
    if (FS.isSocket(stream?.node.mode)) {
      const sock = getSocketFromFD(socketd);
      if (!sock) {
        wakeUp(0);
        return;
      }
      const lookingFor = new Set;
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
          lookingFor.add("POLLIN");
        }
        if (events & POLLOUT) {
          polls.push(PHPWASM.awaitConnection(ws));
          lookingFor.add("POLLOUT");
        }
        if (events & POLLHUP || events & POLLIN || events & POLLOUT || events & POLLERR) {
          polls.push(PHPWASM.awaitClose(ws));
          lookingFor.add("POLLHUP");
        }
        if (events & POLLERR || events & POLLNVAL) {
          polls.push(PHPWASM.awaitError(ws));
          lookingFor.add("POLLERR");
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
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } catch (e) {
          if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
          return -e.errno;
        }
      }
      polls.push([ poll(), () => {
        interrupted = true;
      } ]);
    } else {
      setTimeout(function() {
        wakeUp(1);
      }, timeout);
      return;
    }
    if (polls.length === 0) {
      console.warn("Unsupported poll event " + events + ", defaulting to setTimeout().");
      setTimeout(function() {
        wakeUp(0);
      }, timeout);
      return;
    }
    const promises = polls.map(([promise]) => promise);
    const clearPolling = () => polls.forEach(([, clear]) => clear());
    let awaken = false;
    let timeoutId;
    Promise.race(promises).then(function(results) {
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
      timeoutId = setTimeout(function() {
        if (!awaken) {
          awaken = true;
          wakeUp(0);
          clearPolling();
        }
      }, timeout);
    }
  });
}

wasm_poll_socket.sig = "iiii";

function js_fd_read(fd, iov, iovcnt, pnum) {
  const returnCallback = resolver => Asyncify.handleSleep(resolver);
  const pollAsync = arguments[4] === undefined ? true : !!arguments[4];
  if (Asyncify?.State?.Normal === undefined || Asyncify?.state === Asyncify?.State?.Normal) {
    var stream;
    try {
      stream = SYSCALLS.getStreamFromFD(fd);
      HEAPU32[pnum >> 2] = doReadv(stream, iov, iovcnt);
      return 0;
    } catch (e) {
      if (typeof FS == "undefined" || !(e.name === "ErrnoError")) {
        throw e;
      }
      if (e.errno !== ERRNO_CODES.EWOULDBLOCK && e.errno !== ERRNO_CODES.EAGAIN) {
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
  return returnCallback(async wakeUp => {
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
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) {
          console.error(e);
          throw e;
        }
        returnCode = e.errno;
      }
      if (returnCode === 0) {
        HEAPU32[pnum >> 2] = num;
        return wakeUp(0);
      }
      if (++retries > maxRetries || !stream || FS.isClosed(stream) || returnCode !== ERRNO_CODES.EWOULDBLOCK || ("pipe" in stream.node && stream.node.pipe.refcnt < 2)) {
        HEAPU32[pnum >> 2] = num;
        return wakeUp(returnCode);
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  });
}

js_fd_read.sig = "iiiii";

function __asyncjs__js_module_onMessage(data, response_buffer) {
  return Asyncify.handleAsync(async () => {
    if (Module["onMessage"]) {
      const dataStr = UTF8ToString(data);
      return Module["onMessage"](dataStr).then(response => {
        const responseBytes = typeof response === "string" ? (new TextEncoder).encode(response) : response;
        const responseSize = responseBytes.byteLength;
        const responsePtr = _malloc(responseSize + 1);
        HEAPU8.set(responseBytes, responsePtr);
        HEAPU8[responsePtr + responseSize] = 0;
        HEAPU8[response_buffer] = responsePtr;
        HEAPU8[response_buffer + 1] = responsePtr >> 8;
        HEAPU8[response_buffer + 2] = responsePtr >> 16;
        HEAPU8[response_buffer + 3] = responsePtr >> 24;
        return responseSize;
      }).catch(e => {
        console.error(e);
        return -1;
      });
    }
  });
}

__asyncjs__js_module_onMessage.sig = "iii";

// Imports from the Wasm binary.
var _php_date_get_date_ce, _php_date_get_interface_ce, _php_date_get_timezone_ce, _get_timezone_info, _php_setcookie, _php_escape_html_entities, _php_info_print_table_header, _php_info_print_table_row, _php_info_print_table_start, _php_info_print_table_end, _php_info_print_table_colspan_header, _php_combined_lcg, _php_strtolower, _php_str_to_str, _php_addcslashes_str, _php_addcslashes, _php_get_module_initialized, _php_log_err_with_severity, _php_printf, _php_error_docref, _ap_php_snprintf, _ap_php_slprintf, _ap_php_vsnprintf, _php_printf_to_smart_str, _display_ini_entries, _sapi_header_op, _php_socket_strerror, _php_output_write, __php_stream_free, __php_stream_eof, __php_stream_get_line, __php_stream_open_wrapper_ex, __emalloc_24, __emalloc_32, __emalloc_40, __emalloc_48, __emalloc_56, __emalloc_112, __emalloc_128, __emalloc_320, __emalloc_1280, __efree_56, __emalloc, __efree, __erealloc, __safe_emalloc, ___zend_malloc, __safe_erealloc, __ecalloc, __estrdup, __estrndup, _zend_set_memory_limit, _zend_memory_usage, _zend_memory_peak_usage, _zend_type_to_string, _zend_unmangle_property_name_ex, _zend_is_auto_global_str, _zend_get_compiled_variable_name, _zend_register_long_constant, _zend_register_string_constant, _zend_get_constant_str, _get_active_class_name, _get_active_function_name, _zend_get_executed_filename, _zend_get_executed_filename_ex, _zend_get_executed_lineno, _zend_get_executed_scope, __call_user_function_impl, _zend_call_function, _zend_call_known_function, _zend_call_known_instance_method_with_2_params, _zend_eval_string, _zend_set_timeout, _zend_unset_timeout, _zend_fetch_class, _zend_rebuild_symbol_table, _zend_html_puts, __is_numeric_string_ex, _convert_to_long, _zval_get_long_func, _convert_to_double, __convert_to_string, __try_convert_to_string, _zval_get_double_func, _zval_get_string_func, _zend_binary_strcmp, _numeric_compare_function, _compare_function, _instanceof_function_slow, _zend_str_tolower_copy, _zend_binary_strcasecmp, _zend_memnstr_ex, _rc_dtor_func, _zval_ptr_dtor, _zval_add_ref, _zend_vspprintf, _zend_spprintf, _zend_strpprintf, _zend_make_printable_zval, __zend_bailout, _zend_error, _zend_throw_error, _zend_argument_count_error, __zend_get_parameters_array_ex, _zend_wrong_param_count, _zend_wrong_parameters_none_error, _zend_wrong_parameters_count_error, _zend_wrong_parameter_error, _zend_argument_type_error, _zend_argument_value_error, _zend_argument_error, _zend_parse_arg_long_slow, _zend_parse_arg_str_slow, _zend_parse_arg_str_or_long_slow, _zend_release_fcall_info_cache, _zend_parse_parameters, _zend_parse_method_parameters, _object_properties_init, _object_init_ex, _add_assoc_long_ex, _add_assoc_null_ex, _add_assoc_bool_ex, _add_assoc_double_ex, _add_assoc_str_ex, _add_assoc_string_ex, _add_assoc_stringl_ex, _add_assoc_zval_ex, _add_index_long, _add_index_null, _add_index_string, _add_index_stringl, _add_next_index_long, _add_next_index_str, _add_next_index_string, _add_next_index_stringl, _zend_startup_module, _zend_register_internal_class_ex, _zend_register_internal_class, _zend_class_implements, _zend_fcall_info_init, _zend_get_module_version, _zend_try_assign_typed_ref_long, _zend_try_assign_typed_ref_arr, _zend_declare_property_null, _zend_declare_class_constant_null, _zend_declare_class_constant_long, _zend_declare_class_constant_double, _zend_declare_class_constant_string, _zend_update_property, _zend_read_property_ex, _zend_read_property, _zend_replace_error_handling, _zend_restore_error_handling, _zend_get_resource_handle, _zend_hash_str_find, __zend_hash_init, __zend_new_array_0, __zend_new_array, _zend_array_dup, _zend_hash_update, _zend_hash_str_update, _zend_hash_next_index_insert, _zend_hash_index_update, _zend_hash_destroy, _zend_array_destroy, _zend_hash_apply_with_arguments, _zend_hash_copy, _zend_hash_find, _zend_hash_index_find, _zend_hash_sort_ex, __zend_handle_numeric_str_ex, _zend_rsrc_list_get_rsrc_type, _execute_internal, _zend_set_user_opcode_handler, _zend_get_user_opcode_handler, _zend_get_zval_ptr, _zend_register_ini_entries, _zend_unregister_ini_entries, _zend_alter_ini_entry, _zend_ini_string_ex, _zend_ini_string, _zend_ini_boolean_displayer_cb, _OnUpdateBool, _OnUpdateLong, _OnUpdateString, _OnUpdateStringUnempty, _zend_sort, _zend_iterator_init, _zend_iterator_dtor, _zend_call_method, _zend_class_serialize_deny, _zend_class_unserialize_deny, _zend_create_internal_iterator_zval, _zend_get_exception_base, _zend_is_unwind_exit, _zend_clear_exception, _zend_throw_exception, _zend_throw_exception_ex, _zend_throw_error_exception, _zend_strtod, _gc_enabled, _gc_possible_root, _zend_gc_get_status, _zend_get_closure_method_def, _virtual_file_ex, _tsrm_realpath, _zend_object_std_init, _zend_object_std_dtor, _zend_objects_destroy_object, _zend_objects_clone_members, _zend_std_read_property, _zend_std_write_property, _zend_std_get_property_ptr_ptr, _zend_std_get_method, _zend_class_init_statics, _zend_std_compare_objects, _zend_get_properties_for, _zend_objects_store_mark_destructed, _zend_objects_store_del, _smart_str_erealloc, __smart_string_alloc, _strlen, _munmap, _fiprintf, _free, _memcmp, _fileno, _isatty, _fread, _fclose, _strcmp, _malloc, ___wasm_setjmp, ___wasm_setjmp_test, _emscripten_longjmp, _strcasecmp, _atoi, _memchr, _strncasecmp, _snprintf, _dlopen, _dlsym, _dlclose, _getenv, _strrchr, _realloc, ___errno_location, _strchr, _strncmp, _isxdigit, _tolower, _strtok_r, _strstr, _strpbrk, _strdup, _getcwd, _stat, _fopen, _open, _strncpy, _close, _write, _strerror, _fwrite, _wasm_read, _feof, _fflush, _fcntl, _flock, _mmap, _gettimeofday, _iprintf, _puts, _putchar, _siprintf, _strtol, _pow, _strtod, _strftime, _sin, _cos, _atan2, _acos, _localtime_r, _strtoull, _tan, _asin, _atan, _log, _log2, _fmod, _wasm_popen, _wasm_php_exec, _socket, _freeaddrinfo, _connect, _php_pollfd_for, _htons, _ntohs, _getpeername, _htonl, _strcpy, _strcat, _strtoul, _clock_gettime, _setlocale, _tzset, _wasm_sleep, _fputs, _expf, ___small_fprintf, _qsort, _vfprintf, _rewind, _fgets, _calloc, _initgroups, _atol, _strncat, _abort, ___wrap_usleep, _poll, ___wrap_select, _wasm_set_sapi_name, _wasm_set_phpini_path, _wasm_add_cli_arg, _run_cli, _wasm_add_SERVER_entry, _wasm_add_ENV_entry, _wasm_set_query_string, _wasm_set_path_translated, _wasm_set_skip_shebang, _wasm_set_request_uri, _wasm_set_request_method, _wasm_set_request_host, _wasm_set_content_type, _wasm_set_request_body, _wasm_set_content_length, _wasm_set_cookies, _wasm_set_request_port, _wasm_sapi_request_shutdown, _wasm_sapi_handle_request, _php_wasm_init, _wasm_free, _wasm_get_end_offset, ___wrap_getpid, _wasm_trace, _modf, _gmtime, ___ctype_get_mb_cur_max, ___extenddftf2, ___letf2, ___floatunditf, _div, ___funcs_on_exit, ___cxa_atexit, ___dl_seterr, __emscripten_find_dylib, _freopen, _isdigit, _mbstowcs, _emscripten_builtin_memalign, _round, __emscripten_timeout, _strtok, _tanhf, _wcstombs, _emscripten_get_sbrk_ptr, _setThrew, __emscripten_tempret_set, __emscripten_tempret_get, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, __ZNSt3__211__call_onceERVmPvPFvS2_E, __ZNSt3__218condition_variable10notify_allEv, __ZNSt3__25mutex4lockEv, __ZNSt3__25mutex6unlockEv, ___cxa_bad_typeid, ___cxa_allocate_exception, ___cxa_pure_virtual, ___dynamic_cast, ___cxa_can_catch, __ZNSt20bad_array_new_lengthD1Ev, __ZNSt12length_errorD1Ev, dynCall_iiii, dynCall_ii, dynCall_vi, dynCall_vii, dynCall_viiiii, dynCall_iii, dynCall_iiiii, dynCall_iiiiiii, dynCall_iiiiii, dynCall_i, dynCall_iijii, dynCall_viii, dynCall_viiii, dynCall_ji, dynCall_viiiiiiii, dynCall_v, dynCall_iiiiiiiiii, dynCall_jiii, dynCall_vjiii, dynCall_iiji, dynCall_iidddd, dynCall_vijii, dynCall_viiiiiiiii, dynCall_dd, dynCall_iijji, dynCall_iij, dynCall_iiiiiiiiiiij, dynCall_iiiiiiiiiii, dynCall_iiiij, dynCall_iiiiiiii, dynCall_iiiiiiiiiiii, dynCall_iiiiiiiii, dynCall_jiiii, dynCall_viiiiiii, dynCall_jii, dynCall_vji, dynCall_iijj, dynCall_iiij, dynCall_iijiji, dynCall_jiji, dynCall_viiij, dynCall_viiiiii, dynCall_vidi, dynCall_viijii, dynCall_viidii, dynCall_jiiji, dynCall_jj, dynCall_jiiiji, dynCall_jiij, dynCall_iiiji, dynCall_ij, dynCall_iiiiiij, dynCall_iiid, dynCall_dii, dynCall_vid, dynCall_vij, dynCall_di, dynCall_iiiiijii, dynCall_j, dynCall_iiiiji, dynCall_iiiijii, dynCall_viiji, dynCall_iiiijji, dynCall_ddd, dynCall_diiii, dynCall_diiiiiiii, dynCall_fi, dynCall_fii, dynCall_jiiiii, dynCall_ddi, dynCall_iiijj, dynCall_id, dynCall_iifi, dynCall_viid, dynCall_viidddddddd, dynCall_iidiiii, _asyncify_start_unwind, _asyncify_stop_unwind, _asyncify_start_rewind, _asyncify_stop_rewind, memory, ___stack_pointer, __indirect_function_table, wasmTable, wasmMemory;

function assignWasmExports(wasmExports) {
  _php_date_get_date_ce = Module["_php_date_get_date_ce"] = wasmExports["php_date_get_date_ce"];
  _php_date_get_interface_ce = Module["_php_date_get_interface_ce"] = wasmExports["php_date_get_interface_ce"];
  _php_date_get_timezone_ce = Module["_php_date_get_timezone_ce"] = wasmExports["php_date_get_timezone_ce"];
  _get_timezone_info = Module["_get_timezone_info"] = wasmExports["get_timezone_info"];
  _php_setcookie = Module["_php_setcookie"] = wasmExports["php_setcookie"];
  _php_escape_html_entities = Module["_php_escape_html_entities"] = wasmExports["php_escape_html_entities"];
  _php_info_print_table_header = Module["_php_info_print_table_header"] = wasmExports["php_info_print_table_header"];
  _php_info_print_table_row = Module["_php_info_print_table_row"] = wasmExports["php_info_print_table_row"];
  _php_info_print_table_start = Module["_php_info_print_table_start"] = wasmExports["php_info_print_table_start"];
  _php_info_print_table_end = Module["_php_info_print_table_end"] = wasmExports["php_info_print_table_end"];
  _php_info_print_table_colspan_header = Module["_php_info_print_table_colspan_header"] = wasmExports["php_info_print_table_colspan_header"];
  _php_combined_lcg = Module["_php_combined_lcg"] = wasmExports["php_combined_lcg"];
  _php_strtolower = Module["_php_strtolower"] = wasmExports["php_strtolower"];
  _php_str_to_str = Module["_php_str_to_str"] = wasmExports["php_str_to_str"];
  _php_addcslashes_str = Module["_php_addcslashes_str"] = wasmExports["php_addcslashes_str"];
  _php_addcslashes = Module["_php_addcslashes"] = wasmExports["php_addcslashes"];
  _php_get_module_initialized = Module["_php_get_module_initialized"] = wasmExports["php_get_module_initialized"];
  _php_log_err_with_severity = Module["_php_log_err_with_severity"] = wasmExports["php_log_err_with_severity"];
  _php_printf = Module["_php_printf"] = wasmExports["php_printf"];
  _php_error_docref = Module["_php_error_docref"] = wasmExports["php_error_docref"];
  _ap_php_snprintf = Module["_ap_php_snprintf"] = wasmExports["ap_php_snprintf"];
  _ap_php_slprintf = Module["_ap_php_slprintf"] = wasmExports["ap_php_slprintf"];
  _ap_php_vsnprintf = Module["_ap_php_vsnprintf"] = wasmExports["ap_php_vsnprintf"];
  _php_printf_to_smart_str = Module["_php_printf_to_smart_str"] = wasmExports["php_printf_to_smart_str"];
  _display_ini_entries = Module["_display_ini_entries"] = wasmExports["display_ini_entries"];
  _sapi_header_op = Module["_sapi_header_op"] = wasmExports["sapi_header_op"];
  _php_socket_strerror = Module["_php_socket_strerror"] = wasmExports["php_socket_strerror"];
  _php_output_write = Module["_php_output_write"] = wasmExports["php_output_write"];
  __php_stream_free = Module["__php_stream_free"] = wasmExports["_php_stream_free"];
  __php_stream_eof = Module["__php_stream_eof"] = wasmExports["_php_stream_eof"];
  __php_stream_get_line = Module["__php_stream_get_line"] = wasmExports["_php_stream_get_line"];
  __php_stream_open_wrapper_ex = Module["__php_stream_open_wrapper_ex"] = wasmExports["_php_stream_open_wrapper_ex"];
  __emalloc_24 = Module["__emalloc_24"] = wasmExports["_emalloc_24"];
  __emalloc_32 = Module["__emalloc_32"] = wasmExports["_emalloc_32"];
  __emalloc_40 = Module["__emalloc_40"] = wasmExports["_emalloc_40"];
  __emalloc_48 = Module["__emalloc_48"] = wasmExports["_emalloc_48"];
  __emalloc_56 = Module["__emalloc_56"] = wasmExports["_emalloc_56"];
  __emalloc_112 = Module["__emalloc_112"] = wasmExports["_emalloc_112"];
  __emalloc_128 = Module["__emalloc_128"] = wasmExports["_emalloc_128"];
  __emalloc_320 = Module["__emalloc_320"] = wasmExports["_emalloc_320"];
  __emalloc_1280 = Module["__emalloc_1280"] = wasmExports["_emalloc_1280"];
  __efree_56 = Module["__efree_56"] = wasmExports["_efree_56"];
  __emalloc = Module["__emalloc"] = wasmExports["_emalloc"];
  __efree = Module["__efree"] = wasmExports["_efree"];
  __erealloc = Module["__erealloc"] = wasmExports["_erealloc"];
  __safe_emalloc = Module["__safe_emalloc"] = wasmExports["_safe_emalloc"];
  ___zend_malloc = Module["___zend_malloc"] = wasmExports["__zend_malloc"];
  __safe_erealloc = Module["__safe_erealloc"] = wasmExports["_safe_erealloc"];
  __ecalloc = Module["__ecalloc"] = wasmExports["_ecalloc"];
  __estrdup = Module["__estrdup"] = wasmExports["_estrdup"];
  __estrndup = Module["__estrndup"] = wasmExports["_estrndup"];
  _zend_set_memory_limit = Module["_zend_set_memory_limit"] = wasmExports["zend_set_memory_limit"];
  _zend_memory_usage = Module["_zend_memory_usage"] = wasmExports["zend_memory_usage"];
  _zend_memory_peak_usage = Module["_zend_memory_peak_usage"] = wasmExports["zend_memory_peak_usage"];
  _zend_type_to_string = Module["_zend_type_to_string"] = wasmExports["zend_type_to_string"];
  _zend_unmangle_property_name_ex = Module["_zend_unmangle_property_name_ex"] = wasmExports["zend_unmangle_property_name_ex"];
  _zend_is_auto_global_str = Module["_zend_is_auto_global_str"] = wasmExports["zend_is_auto_global_str"];
  _zend_get_compiled_variable_name = Module["_zend_get_compiled_variable_name"] = wasmExports["zend_get_compiled_variable_name"];
  _zend_register_long_constant = Module["_zend_register_long_constant"] = wasmExports["zend_register_long_constant"];
  _zend_register_string_constant = Module["_zend_register_string_constant"] = wasmExports["zend_register_string_constant"];
  _zend_get_constant_str = Module["_zend_get_constant_str"] = wasmExports["zend_get_constant_str"];
  _get_active_class_name = Module["_get_active_class_name"] = wasmExports["get_active_class_name"];
  _get_active_function_name = Module["_get_active_function_name"] = wasmExports["get_active_function_name"];
  _zend_get_executed_filename = Module["_zend_get_executed_filename"] = wasmExports["zend_get_executed_filename"];
  _zend_get_executed_filename_ex = Module["_zend_get_executed_filename_ex"] = wasmExports["zend_get_executed_filename_ex"];
  _zend_get_executed_lineno = Module["_zend_get_executed_lineno"] = wasmExports["zend_get_executed_lineno"];
  _zend_get_executed_scope = Module["_zend_get_executed_scope"] = wasmExports["zend_get_executed_scope"];
  __call_user_function_impl = Module["__call_user_function_impl"] = wasmExports["_call_user_function_impl"];
  _zend_call_function = Module["_zend_call_function"] = wasmExports["zend_call_function"];
  _zend_call_known_function = Module["_zend_call_known_function"] = wasmExports["zend_call_known_function"];
  _zend_call_known_instance_method_with_2_params = Module["_zend_call_known_instance_method_with_2_params"] = wasmExports["zend_call_known_instance_method_with_2_params"];
  _zend_eval_string = Module["_zend_eval_string"] = wasmExports["zend_eval_string"];
  _zend_set_timeout = Module["_zend_set_timeout"] = wasmExports["zend_set_timeout"];
  _zend_unset_timeout = Module["_zend_unset_timeout"] = wasmExports["zend_unset_timeout"];
  _zend_fetch_class = Module["_zend_fetch_class"] = wasmExports["zend_fetch_class"];
  _zend_rebuild_symbol_table = Module["_zend_rebuild_symbol_table"] = wasmExports["zend_rebuild_symbol_table"];
  _zend_html_puts = Module["_zend_html_puts"] = wasmExports["zend_html_puts"];
  __is_numeric_string_ex = Module["__is_numeric_string_ex"] = wasmExports["_is_numeric_string_ex"];
  _convert_to_long = Module["_convert_to_long"] = wasmExports["convert_to_long"];
  _zval_get_long_func = Module["_zval_get_long_func"] = wasmExports["zval_get_long_func"];
  _convert_to_double = Module["_convert_to_double"] = wasmExports["convert_to_double"];
  __convert_to_string = Module["__convert_to_string"] = wasmExports["_convert_to_string"];
  __try_convert_to_string = Module["__try_convert_to_string"] = wasmExports["_try_convert_to_string"];
  _zval_get_double_func = Module["_zval_get_double_func"] = wasmExports["zval_get_double_func"];
  _zval_get_string_func = Module["_zval_get_string_func"] = wasmExports["zval_get_string_func"];
  _zend_binary_strcmp = Module["_zend_binary_strcmp"] = wasmExports["zend_binary_strcmp"];
  _numeric_compare_function = Module["_numeric_compare_function"] = wasmExports["numeric_compare_function"];
  _compare_function = Module["_compare_function"] = wasmExports["compare_function"];
  _instanceof_function_slow = Module["_instanceof_function_slow"] = wasmExports["instanceof_function_slow"];
  _zend_str_tolower_copy = Module["_zend_str_tolower_copy"] = wasmExports["zend_str_tolower_copy"];
  _zend_binary_strcasecmp = Module["_zend_binary_strcasecmp"] = wasmExports["zend_binary_strcasecmp"];
  _zend_memnstr_ex = Module["_zend_memnstr_ex"] = wasmExports["zend_memnstr_ex"];
  _rc_dtor_func = Module["_rc_dtor_func"] = wasmExports["rc_dtor_func"];
  _zval_ptr_dtor = Module["_zval_ptr_dtor"] = wasmExports["zval_ptr_dtor"];
  _zval_add_ref = Module["_zval_add_ref"] = wasmExports["zval_add_ref"];
  _zend_vspprintf = Module["_zend_vspprintf"] = wasmExports["zend_vspprintf"];
  _zend_spprintf = Module["_zend_spprintf"] = wasmExports["zend_spprintf"];
  _zend_strpprintf = Module["_zend_strpprintf"] = wasmExports["zend_strpprintf"];
  _zend_make_printable_zval = Module["_zend_make_printable_zval"] = wasmExports["zend_make_printable_zval"];
  __zend_bailout = Module["__zend_bailout"] = wasmExports["_zend_bailout"];
  _zend_error = Module["_zend_error"] = wasmExports["zend_error"];
  _zend_throw_error = Module["_zend_throw_error"] = wasmExports["zend_throw_error"];
  _zend_argument_count_error = Module["_zend_argument_count_error"] = wasmExports["zend_argument_count_error"];
  __zend_get_parameters_array_ex = Module["__zend_get_parameters_array_ex"] = wasmExports["_zend_get_parameters_array_ex"];
  _zend_wrong_param_count = Module["_zend_wrong_param_count"] = wasmExports["zend_wrong_param_count"];
  _zend_wrong_parameters_none_error = Module["_zend_wrong_parameters_none_error"] = wasmExports["zend_wrong_parameters_none_error"];
  _zend_wrong_parameters_count_error = Module["_zend_wrong_parameters_count_error"] = wasmExports["zend_wrong_parameters_count_error"];
  _zend_wrong_parameter_error = Module["_zend_wrong_parameter_error"] = wasmExports["zend_wrong_parameter_error"];
  _zend_argument_type_error = Module["_zend_argument_type_error"] = wasmExports["zend_argument_type_error"];
  _zend_argument_value_error = Module["_zend_argument_value_error"] = wasmExports["zend_argument_value_error"];
  _zend_argument_error = Module["_zend_argument_error"] = wasmExports["zend_argument_error"];
  _zend_parse_arg_long_slow = Module["_zend_parse_arg_long_slow"] = wasmExports["zend_parse_arg_long_slow"];
  _zend_parse_arg_str_slow = Module["_zend_parse_arg_str_slow"] = wasmExports["zend_parse_arg_str_slow"];
  _zend_parse_arg_str_or_long_slow = Module["_zend_parse_arg_str_or_long_slow"] = wasmExports["zend_parse_arg_str_or_long_slow"];
  _zend_release_fcall_info_cache = Module["_zend_release_fcall_info_cache"] = wasmExports["zend_release_fcall_info_cache"];
  _zend_parse_parameters = Module["_zend_parse_parameters"] = wasmExports["zend_parse_parameters"];
  _zend_parse_method_parameters = Module["_zend_parse_method_parameters"] = wasmExports["zend_parse_method_parameters"];
  _object_properties_init = Module["_object_properties_init"] = wasmExports["object_properties_init"];
  _object_init_ex = Module["_object_init_ex"] = wasmExports["object_init_ex"];
  _add_assoc_long_ex = Module["_add_assoc_long_ex"] = wasmExports["add_assoc_long_ex"];
  _add_assoc_null_ex = Module["_add_assoc_null_ex"] = wasmExports["add_assoc_null_ex"];
  _add_assoc_bool_ex = Module["_add_assoc_bool_ex"] = wasmExports["add_assoc_bool_ex"];
  _add_assoc_double_ex = Module["_add_assoc_double_ex"] = wasmExports["add_assoc_double_ex"];
  _add_assoc_str_ex = Module["_add_assoc_str_ex"] = wasmExports["add_assoc_str_ex"];
  _add_assoc_string_ex = Module["_add_assoc_string_ex"] = wasmExports["add_assoc_string_ex"];
  _add_assoc_stringl_ex = Module["_add_assoc_stringl_ex"] = wasmExports["add_assoc_stringl_ex"];
  _add_assoc_zval_ex = Module["_add_assoc_zval_ex"] = wasmExports["add_assoc_zval_ex"];
  _add_index_long = Module["_add_index_long"] = wasmExports["add_index_long"];
  _add_index_null = Module["_add_index_null"] = wasmExports["add_index_null"];
  _add_index_string = Module["_add_index_string"] = wasmExports["add_index_string"];
  _add_index_stringl = Module["_add_index_stringl"] = wasmExports["add_index_stringl"];
  _add_next_index_long = Module["_add_next_index_long"] = wasmExports["add_next_index_long"];
  _add_next_index_str = Module["_add_next_index_str"] = wasmExports["add_next_index_str"];
  _add_next_index_string = Module["_add_next_index_string"] = wasmExports["add_next_index_string"];
  _add_next_index_stringl = Module["_add_next_index_stringl"] = wasmExports["add_next_index_stringl"];
  _zend_startup_module = Module["_zend_startup_module"] = wasmExports["zend_startup_module"];
  _zend_register_internal_class_ex = Module["_zend_register_internal_class_ex"] = wasmExports["zend_register_internal_class_ex"];
  _zend_register_internal_class = Module["_zend_register_internal_class"] = wasmExports["zend_register_internal_class"];
  _zend_class_implements = Module["_zend_class_implements"] = wasmExports["zend_class_implements"];
  _zend_fcall_info_init = Module["_zend_fcall_info_init"] = wasmExports["zend_fcall_info_init"];
  _zend_get_module_version = Module["_zend_get_module_version"] = wasmExports["zend_get_module_version"];
  _zend_try_assign_typed_ref_long = Module["_zend_try_assign_typed_ref_long"] = wasmExports["zend_try_assign_typed_ref_long"];
  _zend_try_assign_typed_ref_arr = Module["_zend_try_assign_typed_ref_arr"] = wasmExports["zend_try_assign_typed_ref_arr"];
  _zend_declare_property_null = Module["_zend_declare_property_null"] = wasmExports["zend_declare_property_null"];
  _zend_declare_class_constant_null = Module["_zend_declare_class_constant_null"] = wasmExports["zend_declare_class_constant_null"];
  _zend_declare_class_constant_long = Module["_zend_declare_class_constant_long"] = wasmExports["zend_declare_class_constant_long"];
  _zend_declare_class_constant_double = Module["_zend_declare_class_constant_double"] = wasmExports["zend_declare_class_constant_double"];
  _zend_declare_class_constant_string = Module["_zend_declare_class_constant_string"] = wasmExports["zend_declare_class_constant_string"];
  _zend_update_property = Module["_zend_update_property"] = wasmExports["zend_update_property"];
  _zend_read_property_ex = Module["_zend_read_property_ex"] = wasmExports["zend_read_property_ex"];
  _zend_read_property = Module["_zend_read_property"] = wasmExports["zend_read_property"];
  _zend_replace_error_handling = Module["_zend_replace_error_handling"] = wasmExports["zend_replace_error_handling"];
  _zend_restore_error_handling = Module["_zend_restore_error_handling"] = wasmExports["zend_restore_error_handling"];
  _zend_get_resource_handle = Module["_zend_get_resource_handle"] = wasmExports["zend_get_resource_handle"];
  _zend_hash_str_find = Module["_zend_hash_str_find"] = wasmExports["zend_hash_str_find"];
  __zend_hash_init = Module["__zend_hash_init"] = wasmExports["_zend_hash_init"];
  __zend_new_array_0 = Module["__zend_new_array_0"] = wasmExports["_zend_new_array_0"];
  __zend_new_array = Module["__zend_new_array"] = wasmExports["_zend_new_array"];
  _zend_array_dup = Module["_zend_array_dup"] = wasmExports["zend_array_dup"];
  _zend_hash_update = Module["_zend_hash_update"] = wasmExports["zend_hash_update"];
  _zend_hash_str_update = Module["_zend_hash_str_update"] = wasmExports["zend_hash_str_update"];
  _zend_hash_next_index_insert = Module["_zend_hash_next_index_insert"] = wasmExports["zend_hash_next_index_insert"];
  _zend_hash_index_update = Module["_zend_hash_index_update"] = wasmExports["zend_hash_index_update"];
  _zend_hash_destroy = Module["_zend_hash_destroy"] = wasmExports["zend_hash_destroy"];
  _zend_array_destroy = Module["_zend_array_destroy"] = wasmExports["zend_array_destroy"];
  _zend_hash_apply_with_arguments = Module["_zend_hash_apply_with_arguments"] = wasmExports["zend_hash_apply_with_arguments"];
  _zend_hash_copy = Module["_zend_hash_copy"] = wasmExports["zend_hash_copy"];
  _zend_hash_find = Module["_zend_hash_find"] = wasmExports["zend_hash_find"];
  _zend_hash_index_find = Module["_zend_hash_index_find"] = wasmExports["zend_hash_index_find"];
  _zend_hash_sort_ex = Module["_zend_hash_sort_ex"] = wasmExports["zend_hash_sort_ex"];
  __zend_handle_numeric_str_ex = Module["__zend_handle_numeric_str_ex"] = wasmExports["_zend_handle_numeric_str_ex"];
  _zend_rsrc_list_get_rsrc_type = Module["_zend_rsrc_list_get_rsrc_type"] = wasmExports["zend_rsrc_list_get_rsrc_type"];
  _execute_internal = Module["_execute_internal"] = wasmExports["execute_internal"];
  _zend_set_user_opcode_handler = Module["_zend_set_user_opcode_handler"] = wasmExports["zend_set_user_opcode_handler"];
  _zend_get_user_opcode_handler = Module["_zend_get_user_opcode_handler"] = wasmExports["zend_get_user_opcode_handler"];
  _zend_get_zval_ptr = Module["_zend_get_zval_ptr"] = wasmExports["zend_get_zval_ptr"];
  _zend_register_ini_entries = Module["_zend_register_ini_entries"] = wasmExports["zend_register_ini_entries"];
  _zend_unregister_ini_entries = Module["_zend_unregister_ini_entries"] = wasmExports["zend_unregister_ini_entries"];
  _zend_alter_ini_entry = Module["_zend_alter_ini_entry"] = wasmExports["zend_alter_ini_entry"];
  _zend_ini_string_ex = Module["_zend_ini_string_ex"] = wasmExports["zend_ini_string_ex"];
  _zend_ini_string = Module["_zend_ini_string"] = wasmExports["zend_ini_string"];
  _zend_ini_boolean_displayer_cb = Module["_zend_ini_boolean_displayer_cb"] = wasmExports["zend_ini_boolean_displayer_cb"];
  _OnUpdateBool = Module["_OnUpdateBool"] = wasmExports["OnUpdateBool"];
  _OnUpdateLong = Module["_OnUpdateLong"] = wasmExports["OnUpdateLong"];
  _OnUpdateString = Module["_OnUpdateString"] = wasmExports["OnUpdateString"];
  _OnUpdateStringUnempty = Module["_OnUpdateStringUnempty"] = wasmExports["OnUpdateStringUnempty"];
  _zend_sort = Module["_zend_sort"] = wasmExports["zend_sort"];
  _zend_iterator_init = Module["_zend_iterator_init"] = wasmExports["zend_iterator_init"];
  _zend_iterator_dtor = Module["_zend_iterator_dtor"] = wasmExports["zend_iterator_dtor"];
  _zend_call_method = Module["_zend_call_method"] = wasmExports["zend_call_method"];
  _zend_class_serialize_deny = Module["_zend_class_serialize_deny"] = wasmExports["zend_class_serialize_deny"];
  _zend_class_unserialize_deny = Module["_zend_class_unserialize_deny"] = wasmExports["zend_class_unserialize_deny"];
  _zend_create_internal_iterator_zval = Module["_zend_create_internal_iterator_zval"] = wasmExports["zend_create_internal_iterator_zval"];
  _zend_get_exception_base = Module["_zend_get_exception_base"] = wasmExports["zend_get_exception_base"];
  _zend_is_unwind_exit = Module["_zend_is_unwind_exit"] = wasmExports["zend_is_unwind_exit"];
  _zend_clear_exception = Module["_zend_clear_exception"] = wasmExports["zend_clear_exception"];
  _zend_throw_exception = Module["_zend_throw_exception"] = wasmExports["zend_throw_exception"];
  _zend_throw_exception_ex = Module["_zend_throw_exception_ex"] = wasmExports["zend_throw_exception_ex"];
  _zend_throw_error_exception = Module["_zend_throw_error_exception"] = wasmExports["zend_throw_error_exception"];
  _zend_strtod = Module["_zend_strtod"] = wasmExports["zend_strtod"];
  _gc_enabled = Module["_gc_enabled"] = wasmExports["gc_enabled"];
  _gc_possible_root = Module["_gc_possible_root"] = wasmExports["gc_possible_root"];
  _zend_gc_get_status = Module["_zend_gc_get_status"] = wasmExports["zend_gc_get_status"];
  _zend_get_closure_method_def = Module["_zend_get_closure_method_def"] = wasmExports["zend_get_closure_method_def"];
  _virtual_file_ex = Module["_virtual_file_ex"] = wasmExports["virtual_file_ex"];
  _tsrm_realpath = Module["_tsrm_realpath"] = wasmExports["tsrm_realpath"];
  _zend_object_std_init = Module["_zend_object_std_init"] = wasmExports["zend_object_std_init"];
  _zend_object_std_dtor = Module["_zend_object_std_dtor"] = wasmExports["zend_object_std_dtor"];
  _zend_objects_destroy_object = Module["_zend_objects_destroy_object"] = wasmExports["zend_objects_destroy_object"];
  _zend_objects_clone_members = Module["_zend_objects_clone_members"] = wasmExports["zend_objects_clone_members"];
  _zend_std_read_property = Module["_zend_std_read_property"] = wasmExports["zend_std_read_property"];
  _zend_std_write_property = Module["_zend_std_write_property"] = wasmExports["zend_std_write_property"];
  _zend_std_get_property_ptr_ptr = Module["_zend_std_get_property_ptr_ptr"] = wasmExports["zend_std_get_property_ptr_ptr"];
  _zend_std_get_method = Module["_zend_std_get_method"] = wasmExports["zend_std_get_method"];
  _zend_class_init_statics = Module["_zend_class_init_statics"] = wasmExports["zend_class_init_statics"];
  _zend_std_compare_objects = Module["_zend_std_compare_objects"] = wasmExports["zend_std_compare_objects"];
  _zend_get_properties_for = Module["_zend_get_properties_for"] = wasmExports["zend_get_properties_for"];
  _zend_objects_store_mark_destructed = Module["_zend_objects_store_mark_destructed"] = wasmExports["zend_objects_store_mark_destructed"];
  _zend_objects_store_del = Module["_zend_objects_store_del"] = wasmExports["zend_objects_store_del"];
  _smart_str_erealloc = Module["_smart_str_erealloc"] = wasmExports["smart_str_erealloc"];
  __smart_string_alloc = Module["__smart_string_alloc"] = wasmExports["_smart_string_alloc"];
  _strlen = Module["_strlen"] = wasmExports["strlen"];
  _munmap = Module["_munmap"] = wasmExports["munmap"];
  _fiprintf = Module["_fiprintf"] = wasmExports["fiprintf"];
  _free = Module["_free"] = wasmExports["free"];
  _memcmp = Module["_memcmp"] = wasmExports["memcmp"];
  _fileno = Module["_fileno"] = wasmExports["fileno"];
  _isatty = Module["_isatty"] = wasmExports["isatty"];
  _fread = Module["_fread"] = wasmExports["fread"];
  _fclose = Module["_fclose"] = wasmExports["fclose"];
  _strcmp = Module["_strcmp"] = wasmExports["strcmp"];
  _malloc = PHPLoader['malloc'] = Module['_malloc'] = wasmExports["malloc"];
  ___wasm_setjmp = Module["___wasm_setjmp"] = wasmExports["__wasm_setjmp"];
  ___wasm_setjmp_test = Module["___wasm_setjmp_test"] = wasmExports["__wasm_setjmp_test"];
  _emscripten_longjmp = Module["_emscripten_longjmp"] = wasmExports["emscripten_longjmp"];
  _strcasecmp = Module["_strcasecmp"] = wasmExports["strcasecmp"];
  _atoi = Module["_atoi"] = wasmExports["atoi"];
  _memchr = Module["_memchr"] = wasmExports["memchr"];
  _strncasecmp = Module["_strncasecmp"] = wasmExports["strncasecmp"];
  _snprintf = Module["_snprintf"] = wasmExports["snprintf"];
  _dlopen = Module["_dlopen"] = wasmExports["dlopen"];
  _dlsym = Module["_dlsym"] = wasmExports["dlsym"];
  _dlclose = Module["_dlclose"] = wasmExports["dlclose"];
  _getenv = Module["_getenv"] = wasmExports["getenv"];
  _strrchr = Module["_strrchr"] = wasmExports["strrchr"];
  _realloc = Module["_realloc"] = wasmExports["realloc"];
  ___errno_location = Module["___errno_location"] = wasmExports["__errno_location"];
  _strchr = Module["_strchr"] = wasmExports["strchr"];
  _strncmp = Module["_strncmp"] = wasmExports["strncmp"];
  _isxdigit = Module["_isxdigit"] = wasmExports["isxdigit"];
  _tolower = Module["_tolower"] = wasmExports["tolower"];
  _strtok_r = Module["_strtok_r"] = wasmExports["strtok_r"];
  _strstr = Module["_strstr"] = wasmExports["strstr"];
  _strpbrk = Module["_strpbrk"] = wasmExports["strpbrk"];
  _strdup = Module["_strdup"] = wasmExports["strdup"];
  _getcwd = Module["_getcwd"] = wasmExports["getcwd"];
  _stat = Module["_stat"] = wasmExports["stat"];
  _fopen = Module["_fopen"] = wasmExports["fopen"];
  _open = Module["_open"] = wasmExports["open"];
  _strncpy = Module["_strncpy"] = wasmExports["strncpy"];
  _close = Module["_close"] = wasmExports["close"];
  _write = Module["_write"] = wasmExports["write"];
  _strerror = Module["_strerror"] = wasmExports["strerror"];
  _fwrite = Module["_fwrite"] = wasmExports["fwrite"];
  _wasm_read = Module["_wasm_read"] = wasmExports["wasm_read"];
  _feof = Module["_feof"] = wasmExports["feof"];
  _fflush = Module["_fflush"] = wasmExports["fflush"];
  _fcntl = Module["_fcntl"] = wasmExports["fcntl"];
  _flock = Module["_flock"] = wasmExports["flock"];
  _mmap = Module["_mmap"] = wasmExports["mmap"];
  _gettimeofday = Module["_gettimeofday"] = wasmExports["gettimeofday"];
  _iprintf = Module["_iprintf"] = wasmExports["iprintf"];
  _puts = Module["_puts"] = wasmExports["puts"];
  _putchar = Module["_putchar"] = wasmExports["putchar"];
  _siprintf = Module["_siprintf"] = wasmExports["siprintf"];
  _strtol = Module["_strtol"] = wasmExports["strtol"];
  _pow = Module["_pow"] = wasmExports["pow"];
  _strtod = Module["_strtod"] = wasmExports["strtod"];
  _strftime = Module["_strftime"] = wasmExports["strftime"];
  _sin = Module["_sin"] = wasmExports["sin"];
  _cos = Module["_cos"] = wasmExports["cos"];
  _atan2 = Module["_atan2"] = wasmExports["atan2"];
  _acos = Module["_acos"] = wasmExports["acos"];
  _localtime_r = Module["_localtime_r"] = wasmExports["localtime_r"];
  _strtoull = Module["_strtoull"] = wasmExports["strtoull"];
  _tan = Module["_tan"] = wasmExports["tan"];
  _asin = Module["_asin"] = wasmExports["asin"];
  _atan = Module["_atan"] = wasmExports["atan"];
  _log = Module["_log"] = wasmExports["log"];
  _log2 = Module["_log2"] = wasmExports["log2"];
  _fmod = Module["_fmod"] = wasmExports["fmod"];
  _wasm_popen = Module["_wasm_popen"] = wasmExports["wasm_popen"];
  _wasm_php_exec = Module["_wasm_php_exec"] = wasmExports["wasm_php_exec"];
  _socket = Module["_socket"] = wasmExports["socket"];
  _freeaddrinfo = Module["_freeaddrinfo"] = wasmExports["freeaddrinfo"];
  _connect = Module["_connect"] = wasmExports["connect"];
  _php_pollfd_for = Module["_php_pollfd_for"] = wasmExports["php_pollfd_for"];
  _htons = wasmExports["htons"];
  _ntohs = wasmExports["ntohs"];
  _getpeername = Module["_getpeername"] = wasmExports["getpeername"];
  _htonl = wasmExports["htonl"];
  _strcpy = Module["_strcpy"] = wasmExports["strcpy"];
  _strcat = Module["_strcat"] = wasmExports["strcat"];
  _strtoul = Module["_strtoul"] = wasmExports["strtoul"];
  _clock_gettime = Module["_clock_gettime"] = wasmExports["clock_gettime"];
  _setlocale = Module["_setlocale"] = wasmExports["setlocale"];
  _tzset = Module["_tzset"] = wasmExports["tzset"];
  _wasm_sleep = Module["_wasm_sleep"] = wasmExports["wasm_sleep"];
  _fputs = Module["_fputs"] = wasmExports["fputs"];
  _expf = Module["_expf"] = wasmExports["expf"];
  ___small_fprintf = Module["___small_fprintf"] = wasmExports["__small_fprintf"];
  _qsort = Module["_qsort"] = wasmExports["qsort"];
  _vfprintf = Module["_vfprintf"] = wasmExports["vfprintf"];
  _rewind = Module["_rewind"] = wasmExports["rewind"];
  _fgets = Module["_fgets"] = wasmExports["fgets"];
  _calloc = Module["_calloc"] = wasmExports["calloc"];
  _initgroups = Module["_initgroups"] = wasmExports["initgroups"];
  _atol = Module["_atol"] = wasmExports["atol"];
  _strncat = Module["_strncat"] = wasmExports["strncat"];
  _abort = Module["_abort"] = wasmExports["abort"];
  ___wrap_usleep = Module["___wrap_usleep"] = wasmExports["__wrap_usleep"];
  _poll = Module["_poll"] = wasmExports["poll"];
  ___wrap_select = Module["___wrap_select"] = wasmExports["__wrap_select"];
  _wasm_set_sapi_name = Module["_wasm_set_sapi_name"] = wasmExports["wasm_set_sapi_name"];
  _wasm_set_phpini_path = Module["_wasm_set_phpini_path"] = wasmExports["wasm_set_phpini_path"];
  _wasm_add_cli_arg = Module["_wasm_add_cli_arg"] = wasmExports["wasm_add_cli_arg"];
  _run_cli = Module["_run_cli"] = wasmExports["run_cli"];
  _wasm_add_SERVER_entry = Module["_wasm_add_SERVER_entry"] = wasmExports["wasm_add_SERVER_entry"];
  _wasm_add_ENV_entry = Module["_wasm_add_ENV_entry"] = wasmExports["wasm_add_ENV_entry"];
  _wasm_set_query_string = Module["_wasm_set_query_string"] = wasmExports["wasm_set_query_string"];
  _wasm_set_path_translated = Module["_wasm_set_path_translated"] = wasmExports["wasm_set_path_translated"];
  _wasm_set_skip_shebang = Module["_wasm_set_skip_shebang"] = wasmExports["wasm_set_skip_shebang"];
  _wasm_set_request_uri = Module["_wasm_set_request_uri"] = wasmExports["wasm_set_request_uri"];
  _wasm_set_request_method = Module["_wasm_set_request_method"] = wasmExports["wasm_set_request_method"];
  _wasm_set_request_host = Module["_wasm_set_request_host"] = wasmExports["wasm_set_request_host"];
  _wasm_set_content_type = Module["_wasm_set_content_type"] = wasmExports["wasm_set_content_type"];
  _wasm_set_request_body = Module["_wasm_set_request_body"] = wasmExports["wasm_set_request_body"];
  _wasm_set_content_length = Module["_wasm_set_content_length"] = wasmExports["wasm_set_content_length"];
  _wasm_set_cookies = Module["_wasm_set_cookies"] = wasmExports["wasm_set_cookies"];
  _wasm_set_request_port = Module["_wasm_set_request_port"] = wasmExports["wasm_set_request_port"];
  _wasm_sapi_request_shutdown = Module["_wasm_sapi_request_shutdown"] = wasmExports["wasm_sapi_request_shutdown"];
  _wasm_sapi_handle_request = Module["_wasm_sapi_handle_request"] = wasmExports["wasm_sapi_handle_request"];
  _php_wasm_init = Module["_php_wasm_init"] = wasmExports["php_wasm_init"];
  _wasm_free = PHPLoader['free'] = Module['_wasm_free'] = wasmExports["wasm_free"];
  _wasm_get_end_offset = Module["_wasm_get_end_offset"] = wasmExports["wasm_get_end_offset"];
  ___wrap_getpid = Module["___wrap_getpid"] = wasmExports["__wrap_getpid"];
  _wasm_trace = Module["_wasm_trace"] = wasmExports["wasm_trace"];
  _modf = Module["_modf"] = wasmExports["modf"];
  _gmtime = Module["_gmtime"] = wasmExports["gmtime"];
  ___ctype_get_mb_cur_max = Module["___ctype_get_mb_cur_max"] = wasmExports["__ctype_get_mb_cur_max"];
  ___extenddftf2 = Module["___extenddftf2"] = wasmExports["__extenddftf2"];
  ___letf2 = Module["___letf2"] = wasmExports["__letf2"];
  ___floatunditf = Module["___floatunditf"] = wasmExports["__floatunditf"];
  _div = Module["_div"] = wasmExports["div"];
  ___funcs_on_exit = wasmExports["__funcs_on_exit"];
  ___cxa_atexit = Module["___cxa_atexit"] = wasmExports["__cxa_atexit"];
  ___dl_seterr = wasmExports["__dl_seterr"];
  __emscripten_find_dylib = wasmExports["_emscripten_find_dylib"];
  _freopen = Module["_freopen"] = wasmExports["freopen"];
  _isdigit = Module["_isdigit"] = wasmExports["isdigit"];
  _mbstowcs = Module["_mbstowcs"] = wasmExports["mbstowcs"];
  _emscripten_builtin_memalign = wasmExports["emscripten_builtin_memalign"];
  _round = Module["_round"] = wasmExports["round"];
  __emscripten_timeout = wasmExports["_emscripten_timeout"];
  _strtok = Module["_strtok"] = wasmExports["strtok"];
  _tanhf = Module["_tanhf"] = wasmExports["tanhf"];
  _wcstombs = Module["_wcstombs"] = wasmExports["wcstombs"];
  _emscripten_get_sbrk_ptr = wasmExports["emscripten_get_sbrk_ptr"];
  _setThrew = wasmExports["setThrew"];
  __emscripten_tempret_set = wasmExports["_emscripten_tempret_set"];
  __emscripten_tempret_get = wasmExports["_emscripten_tempret_get"];
  __emscripten_stack_restore = wasmExports["_emscripten_stack_restore"];
  __emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"];
  _emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"];
  __ZNSt3__211__call_onceERVmPvPFvS2_E = Module["__ZNSt3__211__call_onceERVmPvPFvS2_E"] = wasmExports["_ZNSt3__211__call_onceERVmPvPFvS2_E"];
  __ZNSt3__218condition_variable10notify_allEv = Module["__ZNSt3__218condition_variable10notify_allEv"] = wasmExports["_ZNSt3__218condition_variable10notify_allEv"];
  __ZNSt3__25mutex4lockEv = Module["__ZNSt3__25mutex4lockEv"] = wasmExports["_ZNSt3__25mutex4lockEv"];
  __ZNSt3__25mutex6unlockEv = Module["__ZNSt3__25mutex6unlockEv"] = wasmExports["_ZNSt3__25mutex6unlockEv"];
  ___cxa_bad_typeid = Module["___cxa_bad_typeid"] = wasmExports["__cxa_bad_typeid"];
  ___cxa_allocate_exception = Module["___cxa_allocate_exception"] = wasmExports["__cxa_allocate_exception"];
  ___cxa_pure_virtual = Module["___cxa_pure_virtual"] = wasmExports["__cxa_pure_virtual"];
  ___dynamic_cast = Module["___dynamic_cast"] = wasmExports["__dynamic_cast"];
  ___cxa_can_catch = wasmExports["__cxa_can_catch"];
  __ZNSt20bad_array_new_lengthD1Ev = Module["__ZNSt20bad_array_new_lengthD1Ev"] = wasmExports["_ZNSt20bad_array_new_lengthD1Ev"];
  __ZNSt12length_errorD1Ev = Module["__ZNSt12length_errorD1Ev"] = wasmExports["_ZNSt12length_errorD1Ev"];
  dynCall_iiii = dynCalls["iiii"] = wasmExports["dynCall_iiii"];
  dynCall_ii = dynCalls["ii"] = wasmExports["dynCall_ii"];
  dynCall_vi = dynCalls["vi"] = wasmExports["dynCall_vi"];
  dynCall_vii = dynCalls["vii"] = wasmExports["dynCall_vii"];
  dynCall_viiiii = dynCalls["viiiii"] = wasmExports["dynCall_viiiii"];
  dynCall_iii = dynCalls["iii"] = wasmExports["dynCall_iii"];
  dynCall_iiiii = dynCalls["iiiii"] = wasmExports["dynCall_iiiii"];
  dynCall_iiiiiii = dynCalls["iiiiiii"] = wasmExports["dynCall_iiiiiii"];
  dynCall_iiiiii = dynCalls["iiiiii"] = wasmExports["dynCall_iiiiii"];
  dynCall_i = dynCalls["i"] = wasmExports["dynCall_i"];
  dynCall_iijii = dynCalls["iijii"] = wasmExports["dynCall_iijii"];
  dynCall_viii = dynCalls["viii"] = wasmExports["dynCall_viii"];
  dynCall_viiii = dynCalls["viiii"] = wasmExports["dynCall_viiii"];
  dynCall_ji = dynCalls["ji"] = wasmExports["dynCall_ji"];
  dynCall_viiiiiiii = dynCalls["viiiiiiii"] = wasmExports["dynCall_viiiiiiii"];
  dynCall_v = dynCalls["v"] = wasmExports["dynCall_v"];
  dynCall_iiiiiiiiii = dynCalls["iiiiiiiiii"] = wasmExports["dynCall_iiiiiiiiii"];
  dynCall_jiii = dynCalls["jiii"] = wasmExports["dynCall_jiii"];
  dynCall_vjiii = dynCalls["vjiii"] = wasmExports["dynCall_vjiii"];
  dynCall_iiji = dynCalls["iiji"] = wasmExports["dynCall_iiji"];
  dynCall_iidddd = dynCalls["iidddd"] = wasmExports["dynCall_iidddd"];
  dynCall_vijii = dynCalls["vijii"] = wasmExports["dynCall_vijii"];
  dynCall_viiiiiiiii = dynCalls["viiiiiiiii"] = wasmExports["dynCall_viiiiiiiii"];
  dynCall_dd = dynCalls["dd"] = wasmExports["dynCall_dd"];
  dynCall_iijji = dynCalls["iijji"] = wasmExports["dynCall_iijji"];
  dynCall_iij = dynCalls["iij"] = wasmExports["dynCall_iij"];
  dynCall_iiiiiiiiiiij = dynCalls["iiiiiiiiiiij"] = wasmExports["dynCall_iiiiiiiiiiij"];
  dynCall_iiiiiiiiiii = dynCalls["iiiiiiiiiii"] = wasmExports["dynCall_iiiiiiiiiii"];
  dynCall_iiiij = dynCalls["iiiij"] = wasmExports["dynCall_iiiij"];
  dynCall_iiiiiiii = dynCalls["iiiiiiii"] = wasmExports["dynCall_iiiiiiii"];
  dynCall_iiiiiiiiiiii = dynCalls["iiiiiiiiiiii"] = wasmExports["dynCall_iiiiiiiiiiii"];
  dynCall_iiiiiiiii = dynCalls["iiiiiiiii"] = wasmExports["dynCall_iiiiiiiii"];
  dynCall_jiiii = dynCalls["jiiii"] = wasmExports["dynCall_jiiii"];
  dynCall_viiiiiii = dynCalls["viiiiiii"] = wasmExports["dynCall_viiiiiii"];
  dynCall_jii = dynCalls["jii"] = wasmExports["dynCall_jii"];
  dynCall_vji = dynCalls["vji"] = wasmExports["dynCall_vji"];
  dynCall_iijj = dynCalls["iijj"] = wasmExports["dynCall_iijj"];
  dynCall_iiij = dynCalls["iiij"] = wasmExports["dynCall_iiij"];
  dynCall_iijiji = dynCalls["iijiji"] = wasmExports["dynCall_iijiji"];
  dynCall_jiji = dynCalls["jiji"] = wasmExports["dynCall_jiji"];
  dynCall_viiij = dynCalls["viiij"] = wasmExports["dynCall_viiij"];
  dynCall_viiiiii = dynCalls["viiiiii"] = wasmExports["dynCall_viiiiii"];
  dynCall_vidi = dynCalls["vidi"] = wasmExports["dynCall_vidi"];
  dynCall_viijii = dynCalls["viijii"] = wasmExports["dynCall_viijii"];
  dynCall_viidii = dynCalls["viidii"] = wasmExports["dynCall_viidii"];
  dynCall_jiiji = dynCalls["jiiji"] = wasmExports["dynCall_jiiji"];
  dynCall_jj = dynCalls["jj"] = wasmExports["dynCall_jj"];
  dynCall_jiiiji = dynCalls["jiiiji"] = wasmExports["dynCall_jiiiji"];
  dynCall_jiij = dynCalls["jiij"] = wasmExports["dynCall_jiij"];
  dynCall_iiiji = dynCalls["iiiji"] = wasmExports["dynCall_iiiji"];
  dynCall_ij = dynCalls["ij"] = wasmExports["dynCall_ij"];
  dynCall_iiiiiij = dynCalls["iiiiiij"] = wasmExports["dynCall_iiiiiij"];
  dynCall_iiid = dynCalls["iiid"] = wasmExports["dynCall_iiid"];
  dynCall_dii = dynCalls["dii"] = wasmExports["dynCall_dii"];
  dynCall_vid = dynCalls["vid"] = wasmExports["dynCall_vid"];
  dynCall_vij = dynCalls["vij"] = wasmExports["dynCall_vij"];
  dynCall_di = dynCalls["di"] = wasmExports["dynCall_di"];
  dynCall_iiiiijii = dynCalls["iiiiijii"] = wasmExports["dynCall_iiiiijii"];
  dynCall_j = dynCalls["j"] = wasmExports["dynCall_j"];
  dynCall_iiiiji = dynCalls["iiiiji"] = wasmExports["dynCall_iiiiji"];
  dynCall_iiiijii = dynCalls["iiiijii"] = wasmExports["dynCall_iiiijii"];
  dynCall_viiji = dynCalls["viiji"] = wasmExports["dynCall_viiji"];
  dynCall_iiiijji = dynCalls["iiiijji"] = wasmExports["dynCall_iiiijji"];
  dynCall_ddd = dynCalls["ddd"] = wasmExports["dynCall_ddd"];
  dynCall_diiii = dynCalls["diiii"] = wasmExports["dynCall_diiii"];
  dynCall_diiiiiiii = dynCalls["diiiiiiii"] = wasmExports["dynCall_diiiiiiii"];
  dynCall_fi = dynCalls["fi"] = wasmExports["dynCall_fi"];
  dynCall_fii = dynCalls["fii"] = wasmExports["dynCall_fii"];
  dynCall_jiiiii = dynCalls["jiiiii"] = wasmExports["dynCall_jiiiii"];
  dynCall_ddi = dynCalls["ddi"] = wasmExports["dynCall_ddi"];
  dynCall_iiijj = dynCalls["iiijj"] = wasmExports["dynCall_iiijj"];
  dynCall_id = dynCalls["id"] = wasmExports["dynCall_id"];
  dynCall_iifi = dynCalls["iifi"] = wasmExports["dynCall_iifi"];
  dynCall_viid = dynCalls["viid"] = wasmExports["dynCall_viid"];
  dynCall_viidddddddd = dynCalls["viidddddddd"] = wasmExports["dynCall_viidddddddd"];
  dynCall_iidiiii = dynCalls["iidiiii"] = wasmExports["dynCall_iidiiii"];
  _asyncify_start_unwind = wasmExports["asyncify_start_unwind"];
  _asyncify_stop_unwind = wasmExports["asyncify_stop_unwind"];
  _asyncify_start_rewind = wasmExports["asyncify_start_rewind"];
  _asyncify_stop_rewind = wasmExports["asyncify_stop_rewind"];
  memory = wasmMemory = wasmExports["memory"];
  ___stack_pointer = Module["___stack_pointer"] = wasmExports["__stack_pointer"];
  __indirect_function_table = wasmTable = wasmExports["__indirect_function_table"];
}

var _core_globals = Module["_core_globals"] = 12133472;

var _php_ini_opened_path = Module["_php_ini_opened_path"] = 11990880;

var _php_ini_scanned_path = Module["_php_ini_scanned_path"] = 11990884;

var _php_ini_scanned_files = Module["_php_ini_scanned_files"] = 11990888;

var _sapi_module = Module["_sapi_module"] = 12074316;

var _sapi_globals = Module["_sapi_globals"] = 12074464;

var _compiler_globals = Module["_compiler_globals"] = 12136224;

var _executor_globals = Module["_executor_globals"] = 12136600;

var _zend_compile_file = Module["_zend_compile_file"] = 12137760;

var _zend_execute_ex = Module["_zend_execute_ex"] = 12136112;

var _zend_execute_internal = Module["_zend_execute_internal"] = 12136116;

var _zend_write = Module["_zend_write"] = 12136152;

var _zend_error_cb = Module["_zend_error_cb"] = 12136160;

var _zend_post_startup_cb = Module["_zend_post_startup_cb"] = 12136132;

var _module_registry = Module["_module_registry"] = 12135e3;

var _zend_extensions = Module["_zend_extensions"] = 12134328;

var _zend_pass_function = Module["_zend_pass_function"] = 11630588;

var _zend_ce_aggregate = Module["_zend_ce_aggregate"] = 11986440;

var _zend_ce_iterator = Module["_zend_ce_iterator"] = 11986444;

var _zend_ce_countable = Module["_zend_ce_countable"] = 11986456;

var _zend_ce_exception = Module["_zend_ce_exception"] = 12134520;

var _zend_ce_error = Module["_zend_ce_error"] = 12134636;

var _zend_ce_throwable = Module["_zend_ce_throwable"] = 12134504;

var _zend_throw_exception_hook = Module["_zend_throw_exception_hook"] = 12134516;

var _gc_collect_cycles = Module["_gc_collect_cycles"] = 11986004;

var _zend_ce_closure = Module["_zend_ce_closure"] = 12131192;

var _zend_empty_string = Module["_zend_empty_string"] = 11984864;

var _zend_known_strings = Module["_zend_known_strings"] = 11984868;

var _zend_string_init_interned = Module["_zend_string_init_interned"] = 11984932;

var _std_object_handlers = Module["_std_object_handlers"] = 11644772;

var ___memory_base = Module["___memory_base"] = 0;

var ___table_base = Module["___table_base"] = 1;

var _stderr = Module["_stderr"] = 11978048;

var ___THREW__ = Module["___THREW__"] = 12185732;

var ___threwValue = Module["___threwValue"] = 12185736;

var _stdout = Module["_stdout"] = 11978352;

var _timezone = Module["_timezone"] = 12172624;

var _tzname = Module["_tzname"] = 12172632;

var ___heap_base = 13234416;

var __ZNSt3__25ctypeIcE2idE = Module["__ZNSt3__25ctypeIcE2idE"] = 12185820;

var __ZTVN10__cxxabiv120__si_class_type_infoE = Module["__ZTVN10__cxxabiv120__si_class_type_infoE"] = 11978600;

var __ZTVN10__cxxabiv117__class_type_infoE = Module["__ZTVN10__cxxabiv117__class_type_infoE"] = 11978560;

var __ZTVN10__cxxabiv121__vmi_class_type_infoE = Module["__ZTVN10__cxxabiv121__vmi_class_type_infoE"] = 11978652;

var __ZTISt20bad_array_new_length = Module["__ZTISt20bad_array_new_length"] = 11978724;

var __ZTVSt12length_error = Module["__ZTVSt12length_error"] = 11978768;

var __ZTISt12length_error = Module["__ZTISt12length_error"] = 11978788;

var wasmImports = {
  /** @export */ __assert_fail: ___assert_fail,
  /** @export */ __asyncify_data: ___asyncify_data,
  /** @export */ __asyncify_state: ___asyncify_state,
  /** @export */ __asyncjs__js_module_onMessage,
  /** @export */ __call_sighandler: ___call_sighandler,
  /** @export */ __cxa_find_matching_catch_2: ___cxa_find_matching_catch_2,
  /** @export */ __resumeException: ___resumeException,
  /** @export */ __syscall_accept4: ___syscall_accept4,
  /** @export */ __syscall_bind: ___syscall_bind,
  /** @export */ __syscall_chdir: ___syscall_chdir,
  /** @export */ __syscall_chmod: ___syscall_chmod,
  /** @export */ __syscall_connect: ___syscall_connect,
  /** @export */ __syscall_dup: ___syscall_dup,
  /** @export */ __syscall_dup3: ___syscall_dup3,
  /** @export */ __syscall_faccessat: ___syscall_faccessat,
  /** @export */ __syscall_fallocate: ___syscall_fallocate,
  /** @export */ __syscall_fchmod: ___syscall_fchmod,
  /** @export */ __syscall_fchown32: ___syscall_fchown32,
  /** @export */ __syscall_fchownat: ___syscall_fchownat,
  /** @export */ __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */ __syscall_fstat64: ___syscall_fstat64,
  /** @export */ __syscall_ftruncate64: ___syscall_ftruncate64,
  /** @export */ __syscall_getcwd: ___syscall_getcwd,
  /** @export */ __syscall_getdents64: ___syscall_getdents64,
  /** @export */ __syscall_getpeername: ___syscall_getpeername,
  /** @export */ __syscall_getsockname: ___syscall_getsockname,
  /** @export */ __syscall_getsockopt: ___syscall_getsockopt,
  /** @export */ __syscall_ioctl: ___syscall_ioctl,
  /** @export */ __syscall_listen: ___syscall_listen,
  /** @export */ __syscall_lstat64: ___syscall_lstat64,
  /** @export */ __syscall_mkdirat: ___syscall_mkdirat,
  /** @export */ __syscall_newfstatat: ___syscall_newfstatat,
  /** @export */ __syscall_openat: ___syscall_openat,
  /** @export */ __syscall_pipe: ___syscall_pipe,
  /** @export */ __syscall_poll: ___syscall_poll,
  /** @export */ __syscall_readlinkat: ___syscall_readlinkat,
  /** @export */ __syscall_recvfrom: ___syscall_recvfrom,
  /** @export */ __syscall_renameat: ___syscall_renameat,
  /** @export */ __syscall_rmdir: ___syscall_rmdir,
  /** @export */ __syscall_sendto: ___syscall_sendto,
  /** @export */ __syscall_socket: ___syscall_socket,
  /** @export */ __syscall_stat64: ___syscall_stat64,
  /** @export */ __syscall_statfs64: ___syscall_statfs64,
  /** @export */ __syscall_symlinkat: ___syscall_symlinkat,
  /** @export */ __syscall_unlinkat: ___syscall_unlinkat,
  /** @export */ __syscall_utimensat: ___syscall_utimensat,
  /** @export */ _abort_js: __abort_js,
  /** @export */ _dlopen_js: __dlopen_js,
  /** @export */ _dlsym_js: __dlsym_js,
  /** @export */ _emscripten_lookup_name: __emscripten_lookup_name,
  /** @export */ _emscripten_runtime_keepalive_clear: __emscripten_runtime_keepalive_clear,
  /** @export */ _emscripten_system: __emscripten_system,
  /** @export */ _emscripten_throw_longjmp: __emscripten_throw_longjmp,
  /** @export */ _gmtime_js: __gmtime_js,
  /** @export */ _localtime_js: __localtime_js,
  /** @export */ _mktime_js: __mktime_js,
  /** @export */ _mmap_js: __mmap_js,
  /** @export */ _munmap_js: __munmap_js,
  /** @export */ _setitimer_js: __setitimer_js,
  /** @export */ _tzset_js: __tzset_js,
  /** @export */ clock_time_get: _clock_time_get,
  /** @export */ emscripten_date_now: _emscripten_date_now,
  /** @export */ emscripten_get_heap_max: _emscripten_get_heap_max,
  /** @export */ emscripten_get_now: _emscripten_get_now,
  /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */ emscripten_sleep: _emscripten_sleep,
  /** @export */ environ_get: _environ_get,
  /** @export */ environ_sizes_get: _environ_sizes_get,
  /** @export */ exit: _exit,
  /** @export */ fd_close: _fd_close,
  /** @export */ fd_fdstat_get: _fd_fdstat_get,
  /** @export */ fd_pread: _fd_pread,
  /** @export */ fd_pwrite: _fd_pwrite,
  /** @export */ fd_read: _fd_read,
  /** @export */ fd_seek: _fd_seek,
  /** @export */ fd_sync: _fd_sync,
  /** @export */ fd_write: _fd_write,
  /** @export */ getaddrinfo: _getaddrinfo,
  /** @export */ getnameinfo: _getnameinfo,
  /** @export */ getprotobyname: _getprotobyname,
  /** @export */ getprotobynumber: _getprotobynumber,
  /** @export */ invoke_dii,
  /** @export */ invoke_i,
  /** @export */ invoke_id,
  /** @export */ invoke_ii,
  /** @export */ invoke_iifi,
  /** @export */ invoke_iii,
  /** @export */ invoke_iiii,
  /** @export */ invoke_iiiii,
  /** @export */ invoke_iiiiii,
  /** @export */ invoke_iiiiiii,
  /** @export */ invoke_iiiiiiii,
  /** @export */ invoke_iiiiiiiii,
  /** @export */ invoke_iiiiiiiiii,
  /** @export */ invoke_iiiiiiiiiii,
  /** @export */ invoke_iiij,
  /** @export */ invoke_iiijj,
  /** @export */ invoke_iij,
  /** @export */ invoke_iiji,
  /** @export */ invoke_iijii,
  /** @export */ invoke_iijiji,
  /** @export */ invoke_ji,
  /** @export */ invoke_jii,
  /** @export */ invoke_jiii,
  /** @export */ invoke_jiji,
  /** @export */ invoke_v,
  /** @export */ invoke_vi,
  /** @export */ invoke_vii,
  /** @export */ invoke_viid,
  /** @export */ invoke_viidddddddd,
  /** @export */ invoke_viidii,
  /** @export */ invoke_viii,
  /** @export */ invoke_viiii,
  /** @export */ invoke_viiiii,
  /** @export */ invoke_viiiiii,
  /** @export */ invoke_viiiiiii,
  /** @export */ invoke_viiiiiiiii,
  /** @export */ invoke_viiij,
  /** @export */ invoke_viijii,
  /** @export */ invoke_vij,
  /** @export */ invoke_vji,
  /** @export */ js_fd_read,
  /** @export */ js_flock: _js_flock,
  /** @export */ js_getpid: _js_getpid,
  /** @export */ js_open_process: _js_open_process,
  /** @export */ js_popen_to_file,
  /** @export */ js_process_status: _js_process_status,
  /** @export */ js_release_file_locks: _js_release_file_locks,
  /** @export */ js_waitpid: _js_waitpid,
  /** @export */ js_wasm_trace: _js_wasm_trace,
  /** @export */ proc_exit: _proc_exit,
  /** @export */ random_get: _random_get,
  /** @export */ strptime: _strptime,
  /** @export */ wasm_close: _wasm_close,
  /** @export */ wasm_poll_socket,
  /** @export */ wasm_setsockopt: _wasm_setsockopt,
  /** @export */ wasm_recv: _wasm_recv,
  /** @export */ wasm_shutdown: _wasm_shutdown
};

function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return dynCalls["iiiiiii"](index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vi(index, a1) {
  var sp = stackSave();
  try {
    dynCalls["vi"](index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iii(index, a1, a2) {
  var sp = stackSave();
  try {
    return dynCalls["iii"](index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCalls["iiiii"](index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_ii(index, a1) {
  var sp = stackSave();
  try {
    return dynCalls["ii"](index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCalls["iiii"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCalls["viiii"](index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave();
  try {
    return dynCalls["iiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vii(index, a1, a2) {
  var sp = stackSave();
  try {
    dynCalls["vii"](index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_ji(index, a1) {
  var sp = stackSave();
  try {
    return dynCalls["ji"](index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
    return 0n;
  }
}

function invoke_i(index) {
  var sp = stackSave();
  try {
    return dynCalls["i"](index);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    dynCalls["viii"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    dynCalls["v"](index);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vji(index, a1, a2) {
  var sp = stackSave();
  try {
    dynCalls["vji"](index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    dynCalls["viiiiii"](index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viijii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    dynCalls["viijii"](index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viidii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    dynCalls["viidii"](index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_jiii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCalls["jiii"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
    return 0n;
  }
}

function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return dynCalls["iiiiii"](index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    dynCalls["viiiii"](index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave();
  try {
    dynCalls["viiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_jii(index, a1, a2) {
  var sp = stackSave();
  try {
    return dynCalls["jii"](index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
    return 0n;
  }
}

function invoke_iijii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCalls["iijii"](index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iijiji(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return dynCalls["iijiji"](index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    return dynCalls["iiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiji(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCalls["iiji"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iij(index, a1, a2) {
  var sp = stackSave();
  try {
    return dynCalls["iij"](index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiij(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCalls["viiij"](index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  var sp = stackSave();
  try {
    return dynCalls["iiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiij(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCalls["iiij"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    dynCalls["viiiiiii"](index, a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_jiji(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCalls["jiji"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
    return 0n;
  }
}

function invoke_iiijj(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCalls["iiijj"](index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vij(index, a1, a2) {
  var sp = stackSave();
  try {
    dynCalls["vij"](index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_dii(index, a1, a2) {
  var sp = stackSave();
  try {
    return dynCalls["dii"](index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viid(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    dynCalls["viid"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viidddddddd(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    dynCalls["viidddddddd"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    return dynCalls["iiiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_id(index, a1) {
  var sp = stackSave();
  try {
    return dynCalls["id"](index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iifi(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCalls["iifi"](index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
function callMain(args = []) {
  var entryFunction = resolveGlobalSymbol("main").sym;
  // Main modules can't tell if they have main() at compile time, since it may
  // arrive from a dynamic library.
  if (!entryFunction) return;
  args.unshift(thisProgram);
  var argc = args.length;
  var argv = stackAlloc((argc + 1) * 4);
  var argv_ptr = argv;
  for (var arg of args) {
    HEAPU32[((argv_ptr) >> 2)] = stringToUTF8OnStack(arg);
    argv_ptr += 4;
  }
  HEAPU32[((argv_ptr) >> 2)] = 0;
  try {
    var ret = entryFunction(argc, argv);
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
  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    preMain();
    Module["onRuntimeInitialized"]?.();
    var noInitialRun = Module["noInitialRun"] || true;
    if (!noInitialRun) callMain(args);
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(() => {
      setTimeout(() => Module["setStatus"](""), 1);
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
if (PHPLoader.debug && typeof Asyncify !== "undefined") {
    const originalHandleSleep = Asyncify.handleSleep;
    Asyncify.handleSleep = function (startAsync) {
        if (!ABORT) {
            Module["lastAsyncifyStackSource"] = new Error();
        }
        return originalHandleSleep(startAsync);
    }
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
}

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
    const [ major, minor, patch ] = phpVersionString.split('.').map(Number);
    return { major, minor, patch };
})();

return PHPLoader;

// Close the opening bracket from esm-prefix.js:
}
