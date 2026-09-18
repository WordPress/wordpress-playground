---
name: compile-php-wasm
description: Compile PHP.wasm main modules and side modules (dynamic extensions) for Node.js and web platforms. Use when recompiling PHP, adding Emscripten flags, modifying Dockerfiles, building extensions as SIDE_MODULE, upgrading Emscripten, or troubleshooting compilation failures.
---

# Compiling PHP.wasm

Patterns for compiling PHP.wasm main modules and dynamic extension side
modules in the WordPress Playground repository.

**Requires:** Docker, Node.js (version from `.nvmrc`), npm

## Quick Reference

````bash
```bash
# Recompile a specific version for ALL platforms and modes (web+node, jspi+asyncify)
npx nx recompile-php:all php-wasm-web -- --PHP_VERSION=8.5
npx nx recompile-php:all php-wasm-node -- --PHP_VERSION=8.5

# Recompile a specific version + platform + single mode
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.5
npx nx recompile-php:asyncify php-wasm-web -- --PHP_VERSION=8.5
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.5
npx nx recompile-php:asyncify php-wasm-node -- --PHP_VERSION=8.5

# Recompile all PHP versions for a platform
npm run recompile:php:web
npm run recompile:php:node

# Debug build (DWARF info)
# Use when you need to step through WASM in a debugger (Chrome DevTools DWARF
# support) or need better stack traces with C function names. Helpful for
# crashes like `RuntimeError: unreachable` where you need to identify which
# C function is involved. Produces much larger binaries.
npx nx recompile-php:all php-wasm-web -- --WITH_DEBUG=yes
npx nx recompile-php:all php-wasm-node -- --WITH_DEBUG=yes

# Source maps
# Use when you want to map JS glue code back to its Emscripten-generated
# source locations. Lighter weight than DWARF but only covers the JS side,
# not the WASM internals.
npx nx recompile-php:all php-wasm-web -- --WITH_SOURCEMAPS=yes
npx nx recompile-php:all php-wasm-node -- --WITH_SOURCEMAPS=yes

# Reset caches before rebuilding
node node_modules/.bin/nx reset
docker rmi php-wasm:latest

## Build Pipeline Overview

The build system lives in `packages/php-wasm/compile/`. The pipeline is:

````

Dockerfile (Emscripten + PHP source + patches)
↓ docker build
.wasm binary + .js glue file
↓ post-link Dockerfile patches (replace.sh)
Patched .js glue file
↓ NX executor copies to dist/
Final artifacts in package dist/

````

Key files:

| File | Purpose |
|------|---------|
| `Dockerfile` | Main build — downloads PHP source, applies patches, runs `emcc` |
| `Makefile` | Orchestrates Docker builds per PHP version |
| `build.js` | Node script invoked by NX executors |
| `.emcc-php-wasm-flags` | Emscripten linker flags (generated during build) |
| `.emcc-php-wasm-sources` | Source/library paths for linking (generated during build) |
| `replace.sh` / Dockerfile `RUN sed` | Post-link patches to the compiled JS glue file |

## Main Module Compilation

### Emscripten flags that matter

| Flag | Purpose |
|------|---------|
| `ASYNCIFY` | Enables Asyncify (unwind/rewind for async JS calls) |
| `ASYNCIFY_ONLY=[func1,func2,...]` | Whitelist of functions Asyncify instruments (critical for binary size) |
| `JSPI` | Enables JSPI (V8 native stack switching, replaces Asyncify) |
| `JSPI_IMPORTS=[func1,...]` | JS imports wrapped with `WebAssembly.Suspending` |
| `JSPI_EXPORTS=[func1,...]` | WASM exports wrapped with `WebAssembly.promising` |
| `MAIN_MODULE=1` | Enables `dlopen` — exports all symbols for dynamic linking |
| `MAIN_MODULE=2` | Like `=1` but only exports explicitly listed symbols |
| `EXPORTED_FUNCTIONS=[...]` | C functions accessible from JS |
| `EXPORTED_RUNTIME_METHODS=[...]` | Emscripten runtime helpers accessible from JS |
| `ENVIRONMENT=web,worker` | Target environments (affects code generation) |
| `INITIAL_MEMORY=256MB` | Starting linear memory size |

### MAIN_MODULE for dynamic extensions

When adding `dlopen` support (`MAIN_MODULE=1`):

- **Never use `-l` flags for C libraries.** Library directories contain both
  `.a` (static) and `.so` (WASM side module) files. With `MAIN_MODULE`, PIC
  mode makes the linker prefer `.so`. When `wasm-ld` encounters a `.so`
  under `--whole-archive`, it crashes with SIGSEGV. Fix: use explicit `.a`
  paths in `.emcc-php-wasm-sources` instead of `-l` flags.

- **`MAIN_MODULE=1` has linker limitations.** `wasm-ld` cannot handle
  `--whole-archive` + `--experimental-pic` on archives as large as
  `libphp.a`. This is a fundamental limitation. Start with `=1` (exports
  all symbols), then consider `=2` for optimization.

- **ENVIRONMENT=web,worker changes code generation.** With a single
  environment, Emscripten hardcodes booleans (`ENVIRONMENT_IS_WEB = true`).
  With multiple, it generates runtime detection. Post-processing regex
  patterns in the Dockerfile must handle both forms.

### Post-link Dockerfile patches

The Dockerfile uses `sed` / `replace.sh` to modify the compiled JS glue
file after Emscripten runs. Common patches:

- **Inject `_malloc` binding** when it's not auto-exposed:
  ```js
  PHPLoader['malloc'] = wasmExports['malloc'];
  // Injected right after assignWasmExports() in the glue file
````

- **Cache Asyncify buffers** to prevent `memory.grow()` corruption during
  `handleSleep()` (see debug-php-wasm-main-module skill for details)
- **Guard `ENVIRONMENT_IS_*` substitution** for multi-environment builds

### Emscripten version upgrade checklist

When upgrading Emscripten, expect these categories of breakage:

1. **Removed/renamed APIs:**
    - `setErrNo()` removed — use `HEAP32[___errno_location() >> 2] = code`
    - `_malloc`/`_free` no longer auto-exposed — add to `EXPORTED_FUNCTIONS`
    - `HEAPU8`/`HEAPU32` need explicit `EXPORTED_RUNTIME_METHODS`

2. **Stricter Clang compiler:**
    - `-Wincompatible-pointer-types` becomes an error. Fix: correct the
      types, not the warning level.
    - PHP version checks like `#if PHP_MAJOR_VERSION >= 8` may be too broad
      (e.g. `zend_file_handle.filename` is `const char *` in 8.0 but
      `zend_string *` in 8.1+)

3. **JSPI behavioral changes:**
    - WASI syscall wrappers (e.g. `fd_close`) may gain JS intermediate
      frames, breaking JSPI suspension. Symptom: startup hangs silently.
      Fix: remove from `JSPI_IMPORTS`/`JSPI_EXPORTS`.
    - `exitRuntime()` → `__funcs_on_exit()` may trigger JSPI suspension.
      Add to `JSPI_EXPORTS` and `EXPORTED_FUNCTIONS`.

4. **Debugging approach:**
    - Build PHP 8.4 first (fewest compatibility issues)
    - Fix build errors, then run JSPI tests
    - Once 8.4 passes, test 8.0 and 7.4 for version-specific issues
    - Patch PHP source files (`php*.patch`) for older versions as needed

## Side Module Compilation

Side modules are PHP extensions (Xdebug, intl, GD, etc.) compiled as
WASM shared libraries loaded via `dlopen`.

### Build requirements

The extension build needs a minimal PHP installation (for `phpize` and
headers). Key Emscripten-specific requirements:

| Requirement                | Detail                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Inline assembly patches    | `HAVE_ASM_GOTO`, `ZEND_USE_ASM_ARITHMETIC`, `__GNUC__`, `__clang__` — same patches as main Dockerfile |
| `--without-pcre-jit`       | SLJIT uses x86 assembly, unavailable in WASM                                                          |
| PHP 8.4 flag change        | `--disable-libxml` became `--without-libxml`                                                          |
| Remove `-lm` from Makefile | Math library is in the main module                                                                    |
| EMCC_FLAGS                 | `-sSIDE_MODULE -D__x86_64__ -sWASM_BIGINT`                                                            |
| `wasm-opt` path            | `/root/emsdk/upstream/bin/wasm-opt` (not on PATH)                                                     |

### Asyncify side modules

When the side module uses custom renamed imports (e.g. `-Drecv=wasm_recv`),
you MUST pass `-sASYNCIFY_IMPORTS=<custom_name>`:

```dockerfile
export EMCC_FLAGS="-sSIDE_MODULE -sASYNCIFY -sASYNCIFY_IMPORTS=wasm_recv"
```

Without this, Binaryen won't instrument call sites for those imports —
locals won't be saved/restored, causing `table index is out of bounds`
during Asyncify rewind.

### Libtool issues

Libtool refuses to create WASM shared libraries. Two workarounds:

1. **Patch libtool's `archive_cmds`** — replace `$CC` with
   `emcc $EMCC_FLAGS -shared --whole-archive <static archives> --no-whole-archive`
2. **Bypass libtool entirely** — manually link with `em++`, discovering all
   `.o` files recursively (`find . -path '*/.libs/*.o'`)

When using approach 2, check subdirectories — C++ libraries often produce
`.o` files in nested paths that build scripts miss.

### Pre-compiled artifacts

ICU `.a` archives and other pre-built artifacts committed to the repo may
not match current build flags. When `MAIN_MODULE=1` requires PIC,
pre-built non-PIC archives cause `R_WASM_MEMORY_ADDR_SLEB` relocation
errors. Rebuild from source if flags changed.

## Cache Busting

Docker BuildKit caches aggressively. Before rebuilding:

```bash
# Remove the image to force a true rebuild
docker rmi php-wasm:latest

# docker builder prune alone is NOT sufficient — BuildKit reuses
# intermediate layers from existing images

# Also reset NX cache
node node_modules/.bin/nx reset
```

## WASM Binary Inspection

When the build produces `.wasm` files that don't work correctly:

```bash
# List exports and imports
wasm-objdump -x module.wasm

# Disassemble
wasm-objdump -d module.wasm

# Print WAT form (verify Asyncify instrumentation)
wasm-opt --print module.so

# From JavaScript — inspect a side module
node -e "
  const fs = require('fs');
  const mod = new WebAssembly.Module(fs.readFileSync('module.so'));
  console.log('exports:', WebAssembly.Module.exports(mod).map(e => e.name));
  console.log('imports:', WebAssembly.Module.imports(mod).map(i => i.name));
"
```

Cross-reference symbol lists with:

- The `ASYNCIFY_ONLY` function list (main module)
- `EXPORTED_FUNCTIONS` in the Emscripten build flags
- `SIDE_MODULE` / `MAIN_MODULE` dynamic linking expectations

## Diagnostic Cheat Sheet

| Situation                          | Action                                                        |
| ---------------------------------- | ------------------------------------------------------------- |
| Build fails with compiler error    | Read the error, fix C/Makefile, retry                         |
| Build succeeds but WASM won't load | List imports — runtime is missing something                   |
| Build succeeds but runtime crashes | List exports + check Asyncify/JSPI function lists             |
| Behavior is wrong but no error     | Add `printf` to C code, rebuild, trace                        |
| Extension fails as SIDE_MODULE     | Check dynamic linking flags, verify symbol visibility         |
| Linker SIGSEGV with MAIN_MODULE    | Switch `-l` flags to explicit `.a` paths                      |
| `R_WASM_MEMORY_ADDR_SLEB` error    | Pre-built archive not compiled with PIC — rebuild from source |
| Don't know what a build step does  | Read the Dockerfile/Makefile line by line                     |
