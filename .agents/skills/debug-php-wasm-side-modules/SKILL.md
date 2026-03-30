---
name: debug-php-wasm-side-modules
description: Debug WASM side modules (dynamic PHP extensions) including dlopen failures, SIDE_MODULE loading, JSPI suspension crashes in extensions, C++ weak symbol issues, and extension runtime errors. Use when working with dynamic extensions like Xdebug, intl, or GD built as WASM side modules.
---

# Debugging PHP.wasm Side Modules

Patterns for diagnosing and fixing issues with dynamic PHP extensions
built as WASM side modules and loaded via `dlopen`.

## `_dlopen_js` Must Be Synchronous

Emscripten marks `_dlopen_js` as async by default (`isAsync = true`).
With JSPI, this wraps the import with `WebAssembly.Suspending`. Even when
the implementation returns a plain value (not a Promise), the JSPI wrapper
corrupts the WASM call stack — V8's native stack bookkeeping
desynchronizes `__stack_pointer` in linear memory, causing heap corruption
that manifests later as `zend_mm_panic` in `_efree`.

**Fix:** Set `_dlopen_js__async: false` in the Emscripten JS library
(`phpwasm-emscripten-library-dynamic-linking.js`).

**Symptoms:** `zend_extension=` in `php.ini` crashes PHP on ANY
subsequent code. `dl()` at runtime works fine. Neutering `_dlopen_js` to
`return 0` still crashes — the corruption is in the JSPI wrapping, not
the function's implementation.

## Side Module JSPI Suspension Pattern

Side modules import functions from the main module. When a side module
calls a blocking C function (e.g. `recv`), the call resolves to the main
module's compiled WASM implementation — NOT a JS import, so it cannot be
wrapped with `WebAssembly.Suspending`. The call returns immediately
(EAGAIN) instead of waiting for data.

The general fix has three parts:

1. **JS wrapper** in `phpwasm-emscripten-library.js`:
   ```js
   wasm_recv: function(sockfd, buf, len, flags) {
       // Try synchronous recv; if EAGAIN, return Promise
   },
   wasm_recv__async: true,
   ```

2. **JSPI_IMPORTS** — add `wasm_recv` to the Dockerfile so the main
   module imports it from JS.

3. **Preprocessor redirect** — compile the side module with
   `-Drecv=wasm_recv` so C `recv()` calls become `wasm_recv()`, resolving
   to the JS import instead of the main module's WASM function.

This pattern applies to ANY blocking C function a side module needs to
suspend on: `recv`, `select`, `sleep`, `read`, `connect`, etc.

## Extension Loading Lifecycle

Files (`.so` binary, ini config) must be written at a specific point:

```
loadNodeRuntime()  →  WASM loads, FS ready
new PHP(runtime)   →  initializeRuntime(), writes default php.ini
                      *** WRITE FILES HERE ***
php.run()          →  php_wasm_init() → php_module_startup() → reads ini
```

Two traps:
- **`loadNodeRuntime` overwrites `onRuntimeInitialized`** — it spreads
  user options then sets its own callback AFTER the spread. Files written
  in a user-provided callback are silently lost. No error, the extension
  just never loads.
- **`preRun`** fires before `initRuntime()` / FS init. Writing files
  there crashes.

Use `php.writeFile()` / `php.readFileAsText()` after `new PHP(runtime)`.

## Asyncify + SIDE_MODULE: `ASYNCIFY_IMPORTS` Is Required

When compiling a side module with `-sASYNCIFY` and the module uses custom
renamed imports (e.g. `-Drecv=wasm_recv`), you MUST pass
`-sASYNCIFY_IMPORTS=<custom_name>`.

Binaryen's Asyncify pass only knows about its default async imports
(`emscripten_sleep`, etc.). Custom import names are unknown to it. Without
`-sASYNCIFY_IMPORTS`, Binaryen won't instrument the call sites — no
save/restore of locals around the call.

```dockerfile
export EMCC_FLAGS="-sSIDE_MODULE -sASYNCIFY -sASYNCIFY_IMPORTS=wasm_recv"
```

**Symptom:** `table index is out of bounds` during Asyncify **rewind**
(not unwind) at a side module offset that doesn't appear in the original
stack trace. Corrupt locals used as `call_indirect` table indices.

Do NOT add `ASYNCIFY_EXPORTS` for imported functions — that flag is for
functions the module *exports*.

### Verifying instrumentation

Disassemble the `.so` before and after adding `ASYNCIFY_IMPORTS`:

```bash
wasm-opt --print module.so | grep -c '__asyncify_state'
```

A correctly instrumented module has significantly more `__asyncify_state`
checks than an uninstrumented one.

## Asyncify Shared Globals

Side modules need to import `__asyncify_state` and `__asyncify_data` as
shared globals from the main module. The main module provides them as
`WebAssembly.Global` objects. Verify with:

```js
WebAssembly.Module.imports(mod)
    .filter(i => i.name.includes('asyncify'))
```

If these imports are missing, the side module's Asyncify instrumentation
has no shared state with the main module — unwind/rewind will silently
malfunction.

## JSPI + C++ Side Modules: Weak Symbol Crashes

C++ libraries may call syscalls like `close()` during internal operations
(e.g. after memory-mapping data files). When a side module makes such a
call, it can trigger JSPI suspension. This fails with
`SuspendError: trying to suspend JS frames` because C++ weak symbol `env`
imports are resolved through JS closure stubs in the dynamic linker, and
those JS frames block JSPI suspension.

### Root cause

When a side module imports C++ weak symbols (templates, inline functions,
virtual destructors) NOT present in the main module, Emscripten's dynamic
linker creates JS closure stubs that resolve lazily. Any JSPI suspension
in a call chain that includes these stubs fails.

### Fix: two-pass instantiation (JSPI only)

1. Instantiate the side module to get its exports
2. Add exports to `wasmImports`
3. Instantiate again with the enriched imports

This pre-populates weak-symbol GOT entries, eliminating JS stubs.

### Fix: patch C/C++ source (alternative)

If the triggering syscall is non-essential (e.g. `close(fd)` on a file
descriptor only needed temporarily for `mmap`), patch the source to
remove it. Apply the patch in the extension's Dockerfile before
compilation.

### Asyncify is NOT affected

Asyncify's unwind/rewind mechanism operates within WASM code only — JS
closure stubs on the native call stack don't interfere. C++ side modules
with weak symbol `env` imports work correctly under Asyncify without
two-pass instantiation or source patching.

## Web Platform: Dynamic Extension Loading

On the web, `.so` files cannot be read from the filesystem. They must be
fetched via HTTP and written to the WASM virtual FS:

```typescript
const extensionUrl = await getExtensionModule(version);
const extension = await (await fetch(extensionUrl)).arrayBuffer();
phpRuntime.FS.writeFile(
    '/internal/shared/extensions/extension.so',
    new Uint8Array(extension)
);
```

Key differences from Node.js:
- **`fetch()` instead of `fs.readFileSync()`** for loading `.so` bytes
- **URL resolution via bundler** — use `assetsInclude: ['**/*.so']` in
  Vite config so the bundler serves `.so` files
- **`MAIN_MODULE` required** — web builds need it too (was previously
  node-only)
- **`ENVIRONMENT=web,worker`** — include `worker` so the PHP runtime
  works in Web Workers

## Verifying Extensions Actually Work

`extension_loaded()` returning true only means MINIT succeeded. It does
NOT mean runtime features work. Always test actual functionality:

- **Debugger (Xdebug):** set a breakpoint, verify it hits
- **intl:** run a collation or formatting operation
- **GD:** create an image, verify output bytes

Simple operations may pass while complex ones crash. Different code paths
exercise different internal functions.

## Version Coupling

Each PHP version needs its own side module build. Zend API version
mismatch gives a clear error: "Extension requires Zend Engine API version
X, installed version is Y."

The main module and side module MUST be compiled with the same Emscripten
version. Version mismatch causes function table corruption after `dlopen`.

## Debugging Commands

```bash
# Inspect side module symbols
wasm-objdump -x extension.so

# Check what a side module imports/exports
node -e "
  const fs = require('fs');
  const mod = new WebAssembly.Module(fs.readFileSync('extension.so'));
  console.log('exports:', WebAssembly.Module.exports(mod).map(e => e.name));
  console.log('imports:', WebAssembly.Module.imports(mod).map(i => i.name));
"

# Verify Asyncify shared globals are imported
node -e "
  const fs = require('fs');
  const mod = new WebAssembly.Module(fs.readFileSync('extension.so'));
  console.log(WebAssembly.Module.imports(mod)
    .filter(i => i.name.includes('asyncify')));
"

# Check object files in C++ library build (libtool often misses subdirs)
find . -path '*/.libs/*.o' -print

# Verify the extension loads
node -e "
  const { PHP } = require('@php-wasm/node');
  // ... load runtime, write .so, run php.run({ code: '<?php var_dump(extension_loaded(\"xdebug\")); ?>' })
"
```

## Diagnostic Cheat Sheet

| Situation | Action |
|-----------|--------|
| `zend_mm_panic` after `zend_extension=` in ini | `_dlopen_js` is wrongly async — set `__async: false` |
| `dl()` works but ini loading crashes | Same cause — `_dlopen_js` async wrapping |
| `SuspendError: trying to suspend JS frames` from side module | C++ weak symbol stubs — use two-pass instantiation (JSPI) or patch source |
| `table index is out of bounds` during Asyncify rewind | Missing `ASYNCIFY_IMPORTS` in side module EMCC_FLAGS |
| `extension_loaded()` true but features crash | Test actual functionality, not just MINIT |
| `bad export type` during `dlopen` | Side module missing required symbol exports (`get_module`, `zif_*`) |
| Extension silently not loaded | Check file writing lifecycle — files may be written too early or overwritten |
| `Zend Engine API version mismatch` | Rebuild side module for the correct PHP version |
| Function table corruption after `dlopen` | Emscripten version mismatch between main and side module |
| `R_WASM_MEMORY_ADDR_SLEB` relocation error | Pre-built archive not PIC — rebuild from source |
