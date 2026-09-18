---
name: debug-php-wasm-main-module
description: Debug PHP.wasm main module crashes including Asyncify errors (unreachable, memory access out of bounds), JSPI errors (SuspendError, trying to suspend JS frames), WASM memory growth bugs, and runtime traps. Use when investigating RuntimeError, null function or signature mismatch, or other WASM-related crashes in the main PHP binary.
---

# Debugging PHP.wasm Main Module

Patterns for diagnosing and fixing crashes in the main PHP.wasm binary —
Asyncify unwind/rewind failures, JSPI suspension errors, memory growth
bugs, and runtime WASM traps.

## Error Message Interpretation

### Asyncify errors

| Error message | Likely cause |
|---------------|-------------|
| `RuntimeError: unreachable` | A function on the call stack is missing from `ASYNCIFY_ONLY` |
| `memory access out of bounds` | An **opcode handler** is missing — Asyncify corrupts the stack during rewind |
| `null function or signature mismatch` | Missing `ASYNCIFY_ONLY` function elsewhere on the stack — corrupted Asyncify state causes this to manifest in a *different* function than the one actually missing |
| `table index is out of bounds` | Missing opcode handler (variant of the above) |

Secondary errors (undefined variable, corrupted state) after any of these
are red herrings caused by the corrupted Asyncify rewind.

### JSPI errors

| Error message | Likely cause |
|---------------|-------------|
| `SuspendError: trying to suspend JS frames` | A JS frame sits between two WASM frames in the call stack. JSPI can only suspend pure WASM stacks. Common causes: (1) JS trampoline in the call chain; (2) C++ side module weak symbol `env` imports resolved through JS closure stubs |
| `SuspendError: trying to suspend without WebAssembly.promising` | The WASM function calling a suspending JS import is not in `JSPI_EXPORTS` |
| `null function or function signature mismatch` (after side module load) | Side module loading corrupted the function table — check Emscripten version match between main and side module |

### Same root cause, different errors across PHP versions

A single missing `ASYNCIFY_ONLY` function produces different WASM error
types depending on the PHP version:

- PHP 5.6: `table index is out of bounds`
- PHP 7.0: `null function or function signature mismatch`
- PHP 7.2/8.2: `memory access out of bounds`
- PHP 7.4/8.0/8.1: `unreachable` or `memory access out of bounds`

Each PHP version compiles to different WASM code for the same opcode
handler. Don't assume different error messages mean different bugs — always
check the function at the top of the WASM stack trace.

## Asyncify Crash Debugging Strategy

### Step-by-step process

1. **Run the test** with `--stack-trace-limit=200` (default 10 is too
   shallow for Asyncify crashes)
2. **Identify the async trigger** in the stack trace (e.g.
   `_emscripten_sleep`, `_wasm_recv`)
3. **Work backwards** through the call chain from the trigger
4. **Start with the opcode handler** — it's usually the critical missing
   function. Adding deeper utility functions first won't help if the
   opcode handler isn't instrumented.
5. **Add one function at a time** to `ASYNCIFY_ONLY`. Recompile and
   re-test after each addition. This reveals which function was actually
   needed and whether deeper functions are now exposed.
6. **Repeat** until the crash is fixed or a new crash surfaces (often
   deeper in the stack — fixing one crash reveals the next)

### What needs ASYNCIFY_ONLY

Every function on the call stack **at the moment of the async call** needs
Asyncify instrumentation. This includes:

- **Opcode handlers** (`ZEND_*_SPEC_*_HANDLER`) — always check these first
- **Bridge functions** between the opcode and the async call (e.g.
  `zend_user_it_get_new_iterator` for iterator creation)
- **Cleanup functions** that run in the same scope before the suspension
  point (`var_destroy`, `_efree_large`, `php_var_unserialize_destroy`) —
  these are NOT just post-crash artifacts

### What does NOT need ASYNCIFY_ONLY

- Functions that run **after** the async operation returns
- Error formatting functions (`xbuf_format_converter`,
  `php_printf_to_smart_str`) that appear because the failed rewind
  triggered `zend_error` — these are red herrings

### Common function categories to instrument

**Iterator operations** (spread, foreach, array unpack):
- `ZEND_ADD_ARRAY_UNPACK_SPEC_HANDLER`, `ZEND_FE_FETCH_R_SPEC_VAR_HANDLER`
- `zend_user_it_get_new_iterator`, `zend_user_it_move_forward`

**Stream operations:**
- `_php_stream_make_seekable`, `_php_stream_copy_to_stream_ex`
- `_php_stream_flush`, `_php_stream_cast`, `zif_stream_select`

**Object operations:**
- `zend_std_write_property`, `zend_std_cast_object_tostring`
- `zend_objects_clone_obj`, `zend_objects_clone_members`

**Error/exception handling:**
- `zend_error`, `zend_error_zstr`, `zend_throw_exception`
- `zend_undefined_index`

**Serialization:**
- `zif_serialize`, `zif_unserialize`, `php_var_unserialize_destroy`

## JSPI Debugging

### Vitest must have `--experimental-wasm-jspi`

Node.js requires this flag for JSPI. Without it, `wasm-feature-detect`'s
`jspi()` returns false and `getPHPLoaderModule` silently loads the
**asyncify** build. All JSPI bugs become invisible.

Add to `vite.config.ts`:
```ts
poolOptions: {
    forks: {
        execArgv: ['--expose-gc', '--experimental-wasm-jspi'],
    },
},
```

Always verify which build is loaded by adding a `console.log` to the JS
glue file.

### Gate JSPI vs Asyncify paths

Use `wasm-feature-detect`'s `jspi()` function to branch between JSPI
(dynamic extensions) and Asyncify (static extensions) code paths — both
in runtime loading and in test files.

### Synchronous JS imports must NOT be marked async

When a WASM JS import has `isAsync = true`, JSPI wraps it with
`WebAssembly.Suspending`. Even if the implementation never suspends
(returns a value, not a Promise), the wrapper corrupts the WASM call
stack — V8's native stack bookkeeping desynchronizes `__stack_pointer`,
causing heap corruption that manifests later as `zend_mm_panic` in
`_efree`.

**Symptoms:** crash only during PHP startup (`php_module_startup`), heap
corruption in unrelated code (`zend_hash_destroy`, `zend_file_handle_dtor`).

**Debugging strategy:** neuter the JS import (return 0 immediately). If
the crash persists, the problem is the JSPI wrapping, not the import's
implementation. Check `functionName.isAsync` in the compiled JS glue. Fix
by setting `functionName__async: false` in the Emscripten JS library.

### Check JSPI wrapping in compiled glue

Search the compiled JS glue for:
- `instrumentWasmImports` → `importPattern` regex (imports wrapped with
  `WebAssembly.Suspending`)
- `instrumentWasmExports` → `exportPattern` regex (exports wrapped with
  `WebAssembly.promising`)

A function in the import pattern that shouldn't suspend causes heap
corruption. A function that needs to suspend but isn't in the pattern
returns immediately instead of waiting.

## PHP Startup Lifecycle in WASM

```
loadNodeRuntime() / loadWebRuntime()  →  WASM module loads, FS ready
new PHP(runtime)                      →  initializeRuntime(), writes default php.ini
php.run()                             →  php_wasm_init() → php_module_startup()
                                         → parses ini, initializes modules
```

Crashes only during step 3 (startup) but not at runtime point to
WASM-JS boundary issues (JSPI wrapping, calling conventions) rather than
PHP logic bugs.

## WASM Memory Growth Bugs

`memory.grow()` detaches the old `ArrayBuffer`. Emscripten's
`updateMemoryViews()` replaces module-scoped HEAP variables, but any JS
code that captured a typed array reference (object literal, destructuring,
closure) now points to a detached buffer.

**Symptoms:** `SQLITE_IOERR` from file locking, reads return zero, writes
are silent no-ops — all appearing after the WASM module has been running
for a while (memory grew).

### Fix pattern

Never expose raw typed arrays across module boundaries. Use accessor
objects:

```js
memory: {
    HEAP16: {
        get(offset) { return HEAP16[offset]; },
        set(offset, value) { HEAP16[offset] = value; },
    }
}
```

This makes stale capture structurally impossible. Property getters
(`get HEAP16() { return HEAP16; }`) still expose the typed array, which
callers can capture — accessor objects are safer.

### Asyncify allocation bug

Emscripten's `handleSleep()` calls `_malloc()` on every async unwind. If
that triggers `memory.grow()`, Asyncify state corrupts. Fix: cache
`allocateData()` result, reuse across sleeps. Apply via Dockerfile
`replace.sh` (Asyncify-only, not JSPI).

### Reproducing without recompilation

`INITIAL_MEMORY` is baked into the WASM binary (typically 256MB). Force
growth from PHP:
```php
str_repeat('x', 300 * 1024 * 1024);
```

Or set a low `INITIAL_MEMORY` (64MB) during compilation to force earlier
growth.

## Tracing the WASM-JS Boundary

When a PHP.wasm feature silently fails (no crash, no error, just doesn't
work):

### Instrument JS imports in the compiled glue

Add `console.log` to JS functions in the compiled glue file
(`php_8_4.js`). Search for `function ___` (triple underscore) to find
Emscripten's syscall wrappers. Log arguments to see what WASM is passing.

If a C function is called in the source but the corresponding JS wrapper
never fires, the symbol resolution is wrong.

### Inspect WASM module imports and exports

```js
const mod = new WebAssembly.Module(fs.readFileSync('path/to/module.wasm'));
console.log(WebAssembly.Module.imports(mod).map(i => i.name));
console.log(WebAssembly.Module.exports(mod).map(e => e.name));
```

A function in the C source but NOT in the module's imports list was
inlined, stubbed, or resolved statically — it won't call through to JS.

### Add printf to C source

When the JS glue is not enough, add `fprintf(stderr, ...)` statements to
the PHP C source code and rebuild. This traces the actual execution path
through the WASM binary. Use this when:
- The error message is ambiguous
- You need to know what values are passed at SAPI/extension boundaries
- Execution diverges from expectation with no visible error

## Test Infrastructure Gotchas

- **`assertNoCrash` silently swallows errors** when `FIX_DOCKERFILE` is
  not set. Always add a re-throw after the catch block.
- **Floating promises + `php.exit()` = unhandled rejections.** Always
  `return` or `await` calls to `assertNoCrash()`.
- **Vitest misattributes unhandled rejections** to the wrong test (test N
  rejection surfaces during test N+1).
- **PHP 8.4 deprecation notices** break `expect(result.text).toBe('')`.
  Fix: add proper return types or wrap with `ob_start()`/`ob_end_clean()`.
- **WASM fires secondary crashes** from `sapi_send_headers` as uncaught
  exceptions (not promise rejections). Tests must handle both
  `unhandledRejection` and `uncaughtException`.
- **HTTPS tests need the CA cert in WASM FS.** Write the cert file and set
  `openssl.cafile` via `setPhpIniEntries`.

## Testing Commands

```bash
# Run tests for specific PHP version + mode
PHP=8.0 npm run test-group-3-asyncify

# Filter tests by name
npx nx test php-wasm-node --testFile=php.spec.ts -- --test-name-pattern='Magic Methods'

# Increase stack trace depth (critical for Asyncify crashes)
NODE_OPTIONS='--stack-trace-limit=200' npx nx test php-wasm-node

# Verbose output
npx nx test php-wasm-node -- --reporter=verbose
```

## Diagnostic Cheat Sheet

| Situation | Action |
|-----------|--------|
| `unreachable` / `memory access out of bounds` | Asyncify crash — find missing `ASYNCIFY_ONLY` function |
| `SuspendError: trying to suspend JS frames` | JS frame in WASM call stack — eliminate JS trampoline |
| `SuspendError: ... without WebAssembly.promising` | Add function to `JSPI_EXPORTS` |
| `zend_mm_panic` in `_efree` | Check for wrongly-async JS imports (JSPI wrapping issue) |
| Startup hang (all tests time out) | JSPI syscall wrapper gained JS frame — remove from JSPI lists |
| `SQLITE_IOERR` after running a while | Stale HEAP reference after `memory.grow()` |
| Different errors across PHP versions | Same root cause — check function at top of WASM stack |
| Silent failure (no crash, no error) | Trace WASM-JS boundary — instrument glue file |
| Test passes but shouldn't | Check for `assertNoCrash` swallowing errors |
