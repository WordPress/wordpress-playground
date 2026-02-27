# JSPI Polyfill via Atomics.wait() + SharedArrayBuffer — Analysis

## Is the assumption correct?

**Yes, partially.** PHP always runs in a Web Worker in the browser, which is the key requirement. `Atomics.wait()` can only block worker threads (it throws on the main thread), so the fact that PHP is already in a worker is essential.

However, the architecture is more nuanced than "just use Atomics.wait()."

## How JSPI currently works

JSPI wraps ~12 "suspending imports" — JS functions that PHP WASM calls and that may return Promises (`js_open_process`, `wasm_recv`, `js_fd_read`, etc.). When a WASM function calls one of these and it returns a Promise, the engine suspends the WASM stack, returns a Promise to the caller, and resumes when the Promise resolves. This is native stack switching — zero transformation of the WASM binary.

**Asyncify**, by contrast, instruments the entire WASM binary with unwind/rewind code for ~200+ C functions, roughly doubling binary size and adding runtime overhead.

## The core polyfill idea

Instead of native stack switching, when WASM calls a suspending import:

1. The worker posts a message to the main thread: "execute this async operation"
2. The worker calls `Atomics.wait()` on a SharedArrayBuffer — **blocking the worker thread**
3. The main thread performs the async operation (fetch, I/O, etc.)
4. The main thread writes the result to the SharedArrayBuffer and calls `Atomics.notify()`
5. The worker resumes from `Atomics.wait()`, reads the result, returns it to WASM synchronously

From WASM's perspective, the call was synchronous — no stack switching or Asyncify needed.

## What we're polyfilling

In the Emscripten-generated JSPI binary (`php_8_4.js`), there are exactly two JSPI API calls:

1. **`new WebAssembly.Suspending(fn)`** — wraps each async import function. When WASM calls this import and the wrapped function returns a Promise, WASM suspends.
2. **`WebAssembly.promising(fn)`** — wraps each async export function. Makes the WASM export return a Promise instead of blocking.

The polyfill needs to replace these two primitives.

## Architecture: Helper on main thread

```
Worker (WASM + PHP)          Main Thread
  │                            │
  ├── call js_fd_read() ──────>│
  │   (postMessage)            ├── execute async op
  │                            │   (fetch, I/O, etc.)
  ├── Atomics.wait() ◄─────────┤
  │   (blocks)                 ├── write result to SAB
  │                            ├── Atomics.notify()
  ├── resume ◄─────────────────┤
  │   (reads result from SAB)  │
  └── return to WASM           │
```

## The deadlock challenge

The import functions (`_emscripten_sleep`, `wasm_recv`, etc.) use `Asyncify.handleSleep(wakeUp => ...)` or `Asyncify.handleAsync(async () => ...)`. In the JSPI build, `handleSleep` maps to `handleAsync(() => new Promise(startAsync))`.

The actual async operations inside these functions use `setTimeout`, `fetch`, WebSocket operations, etc. — all depending on the event loop.

**The fundamental problem:** If the import function creates a Promise in the worker, and the worker is then blocked on `Atomics.wait()`, the worker's event loop is frozen — the Promise can never resolve. **Deadlock.**

**Solution:** The import function wrapper doesn't call the original function at all in the worker. Instead, it serializes the call request and delegates everything to the main thread:

1. The main thread sends a message to the worker: "call this WASM export"
2. The worker calls the WASM export synchronously
3. When an import function needs to do async work, the wrapper:
   - Posts a message to the main thread: "I need async operation X with params Y"
   - Calls `Atomics.wait()` — blocks the worker
4. The main thread receives the request, executes the async operation, writes result to SAB, calls `Atomics.notify()`
5. Worker resumes, passes result to WASM

## The WASM memory challenge

Import functions access WASM memory (`HEAP8`, `HEAP32`, etc.) which lives in the worker. If we forward the call to the main thread, the main thread needs access to that memory.

Options:
- Keep WASM memory in a SharedArrayBuffer (Emscripten supports this with `-sSHARED_MEMORY`)
- Serialize the needed heap data as part of the message

## COOP/COEP headers

SharedArrayBuffer requires cross-origin isolation:
- `Cross-Origin-Opener-Policy: same-origin` (COOP)
- `Cross-Origin-Embedder-Policy: require-corp` or `credentialless` (COEP)

**Playground's service worker can inject these headers.** It already handles `Document-Isolation-Policy` rewriting for Gutenberg's SharedArrayBuffer needs. Adding COOP/COEP injection is a natural extension.

## Three approaches considered

### Approach 1: Polyfill at the Emscripten import level (recommended)

Intercept the JSPI import wrapping. Instead of `WebAssembly.Suspending`, wrap each import function so that when it returns a Promise, the worker serializes the call to the main thread, blocks on `Atomics.wait()`, and resumes when the main thread resolves it.

- No recompilation needed — uses the existing JSPI binary
- The existing `comlink-sync.ts` already implements the SharedArrayBuffer + Atomics.wait pattern for Node.js
- Eliminates Asyncify entirely

### Approach 2: Compile a third WASM variant using Emscripten's PROXY_TO_PTHREAD

Emscripten natively supports running `main()` in a pthread with `PROXY_TO_PTHREAD`. Background thread blocks via `emscripten_futex_wait()` (maps to `Atomics.wait()`) until proxied async operation completes.

- Build-time approach — requires recompilation
- Adds a third build variant
- Uses Emscripten's proven infrastructure

### Approach 3: Service Worker + synchronous XHR fallback

Use synchronous `XMLHttpRequest` from the worker, intercepted by a Service Worker.

- No COOP/COEP needed
- Sync XHR is deprecated
- Much higher latency
- Can't handle non-HTTP async operations

## JSPI import functions to handle (~12 functions)

From the Emscripten-generated import pattern:
- `js_open_process` — spawn child processes
- `js_fd_read` — read from file descriptors
- `js_waitpid` — wait for process completion
- `js_process_status` — check process status
- `js_create_input_device` — create input devices
- `wasm_setsockopt` — set socket options
- `wasm_shutdown`, `wasm_close` — socket management
- `wasm_recv`, `wasm_connect` — socket I/O
- `recv`, `setsockopt` — socket syscalls
- `__syscall_fcntl64` — file descriptor control
- `js_flock`, `js_release_file_locks` — file locking

Plus functions marked with `.isAsync = true`:
- `_emscripten_sleep` — setTimeout
- `_emscripten_wget_data` — fetch data
- `_fd_sync` — file descriptor sync

## Existing prior art

- **WordPress Playground's `comlink-sync.ts`** — already implements SharedArrayBuffer + Atomics.wait for Node.js sync communication
- **WebReflection/coincident** — Atomics-based synchronous cross-thread function calls, ~50,000 roundtrips/sec
- **WebReflection/sabayon** — SharedArrayBuffer polyfill using sync XHR + Service Worker
- **Builder.io/Partytown** — runs third-party scripts in worker with sync DOM access via Atomics (10x faster) or sync XHR fallback
- **jimmywarting/await-sync** — async→sync via Worker + SharedArrayBuffer + Atomics.wait
- **Emscripten PROXY_TO_PTHREAD** — built-in support for running main() in a pthread with sync blocking

## Evaluation

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Feasibility** | Medium-High | The pattern works and is proven. Main complexity is handling import functions that access WASM memory. |
| **Effort** | Medium | ~2-4 weeks of focused work. Need to handle ~12 import functions, SAB protocol, COOP/COEP headers. |
| **Risk** | Medium | Deadlock potential, debugging difficulty across threads, WASM memory sharing. |
| **Benefit** | High | Eliminates Asyncify entirely — no more double-sized binaries, no more maintaining 200+ function lists, no more "unreachable" errors. Single JSPI binary serves all browsers. |
| **Performance** | Good | Faster than Asyncify (no binary bloat), slower than native JSPI (roundtrip overhead per async call). |
| **Browser support** | Excellent | SharedArrayBuffer + COOP/COEP works in Chrome, Firefox, and Safari. |
