# JSPI Polyfill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Eliminate the Asyncify WASM build by polyfilling JSPI on browsers
that lack native support, using SharedArrayBuffer + Atomics.wait/notify to
synchronously block the worker thread while async operations complete on
the main thread.

**Architecture:** The JSPI binary is a normal, untransformed WASM binary —
JSPI is purely a JS-glue concern (`WebAssembly.Suspending` and
`WebAssembly.promising`). The polyfill replaces these two primitives with
no-ops and instead provides synchronous import function implementations
that delegate async work to the main thread via a SharedArrayBuffer-based
communication channel. The worker blocks on `Atomics.wait()` while the
main thread executes async operations and signals completion via
`Atomics.notify()`.

**Tech Stack:** TypeScript, SharedArrayBuffer, Atomics, Web Workers,
Emscripten, WebAssembly

---

## Key Architectural Insight

The Emscripten-generated JSPI glue (`php_8_4.js`) has an `Asyncify` object
that wraps import functions with `new WebAssembly.Suspending(fn)` and
export functions with `WebAssembly.promising(fn)`. The import functions
use `Asyncify.handleSleep(callback)` and `Asyncify.handleAsync(fn)` to
create Promises that suspend the WASM stack.

The polyfill cannot simply block the worker with `Atomics.wait()` after
calling the original import function, because the function's Promise
resolution depends on the worker's event loop — which is frozen by
`Atomics.wait()`. **Deadlock.**

The solution: replace `Asyncify.handleSleep` and `Asyncify.handleAsync`
with versions that forward async primitives to the main thread (whose
event loop is free), block on `Atomics.wait()`, and resume when the main
thread signals completion. Meanwhile, `WebAssembly.Suspending` becomes an
identity wrapper (no-op) and `WebAssembly.promising` wraps the export in
`Promise.resolve()`.

## Communication Protocol

A SharedArrayBuffer serves as the communication channel:

```
Offset  Size   Field
0       4      status: 0=idle, 1=request, 2=response
4       4      requestType (enum)
8       4      responseError: 0=ok, 1=error
12      4      responseLength (bytes)
16      4      i32 param/result slot 0
20      4      i32 param/result slot 1
24      4      i32 param/result slot 2
28      4      i32 param/result slot 3
32      N      data payload (variable length)
```

- Worker writes request → sets status=1 → `Atomics.wait(status, 1)`
- Main thread reads request → executes async op → writes response →
  sets status=2 → `Atomics.notify()`
- Worker wakes → reads response → sets status=0

`postMessage` carries the SharedArrayBuffer reference during setup. For
large data payloads (network recv buffers), a secondary data SAB is used.

## Scope: What Functions Need Polyfill Handlers

From the `importPattern` in the generated JS:

| Function | Truly async? | Polyfill approach |
|----------|-------------|-------------------|
| `_emscripten_sleep` | Yes (setTimeout) | Forward sleep duration to main thread |
| `_emscripten_wget_data` | Yes (fetch) | Forward URL to main thread, get data back via SAB |
| `_fd_sync` | Yes (FS syncfs) | Forward to main thread |
| `js_open_process` | Yes (complex) | Forward spawn request; stdin pump on main thread |
| `js_fd_read` | Yes (polling) | Forward poll request to main thread |
| `js_waitpid` | Yes (polling) | Forward poll request to main thread |
| `js_process_status` | **No** | No-op polyfill — runs synchronously as-is |
| `js_create_input_device` | Unknown/stub | No-op |
| `wasm_setsockopt` | **No** | Runs synchronously as-is |
| `wasm_shutdown` | **No** | Runs synchronously as-is |
| `wasm_close` | **No** | Runs synchronously as-is |
| `wasm_recv` | Yes (polling) | Forward recv request to main thread |
| `wasm_connect` | Yes (WebSocket) | Forward connect+wait to main thread |
| `recv` | Alias | Delegates to wasm_recv |
| `setsockopt` | Alias | Delegates to wasm_setsockopt |
| `__syscall_fcntl64` | Mostly no | Runs synchronously (uses sync remote calls) |
| `js_flock` | Mostly no | Runs synchronously |
| `js_release_file_locks` | **No** | Runs synchronously |

Truly async functions requiring main-thread delegation: **~8 functions**.
Many "async imports" are actually synchronous and just need the
`WebAssembly.Suspending` no-op.

---

## Phase 0: Infrastructure — SharedArrayBuffer Channel

### Task 0.1: Create the SAB communication module

**Files:**
- Create: `packages/php-wasm/web/src/lib/jspi-polyfill/shared-channel.ts`
- Test: `packages/php-wasm/web/src/lib/jspi-polyfill/shared-channel.spec.ts`

This module defines the SharedArrayBuffer layout and provides read/write
helpers used by both the worker side and the main-thread side.

```ts
// shared-channel.ts

// SAB layout offsets (in bytes)
const STATUS_OFFSET = 0;      // Int32: 0=idle, 1=request, 2=response
const REQUEST_TYPE_OFFSET = 4; // Int32: operation type enum
const ERROR_OFFSET = 8;        // Int32: 0=ok, 1=error
const RESPONSE_LEN_OFFSET = 12;// Int32: response data length
const PARAM_OFFSET = 16;       // 4x Int32 param/result slots (16 bytes)
const DATA_OFFSET = 32;        // Variable-length data payload

const HEADER_SIZE = 32;
const DEFAULT_DATA_SIZE = 1024 * 1024; // 1MB for data payloads
const TOTAL_SIZE = HEADER_SIZE + DEFAULT_DATA_SIZE;

// Status values
const STATUS_IDLE = 0;
const STATUS_REQUEST = 1;
const STATUS_RESPONSE = 2;

// Request type enum — add entries as we implement each function
const REQUEST_SLEEP = 1;
const REQUEST_WGET_DATA = 2;
const REQUEST_FD_SYNC = 3;
// ... more to come in later phases

export function createSharedChannel() {
  const sab = new SharedArrayBuffer(TOTAL_SIZE);
  return { sab, headerView: new Int32Array(sab, 0, HEADER_SIZE / 4),
           dataView: new Uint8Array(sab, DATA_OFFSET) };
}

// Worker side: send request, block until response
export function sendRequest(
  headerView: Int32Array,
  requestType: number,
  params: number[]  // up to 4 i32 params
) {
  Atomics.store(headerView, REQUEST_TYPE_OFFSET / 4, requestType);
  for (let i = 0; i < params.length && i < 4; i++) {
    Atomics.store(headerView, PARAM_OFFSET / 4 + i, params[i]);
  }
  // Signal request and block
  Atomics.store(headerView, STATUS_OFFSET / 4, STATUS_REQUEST);
  Atomics.notify(headerView, STATUS_OFFSET / 4);  // wake main thread
  Atomics.wait(headerView, STATUS_OFFSET / 4, STATUS_REQUEST);
  // Read response
  const error = Atomics.load(headerView, ERROR_OFFSET / 4);
  const responseLen = Atomics.load(headerView, RESPONSE_LEN_OFFSET / 4);
  // Reset to idle
  Atomics.store(headerView, STATUS_OFFSET / 4, STATUS_IDLE);
  return { error, responseLen };
}

// Main thread side: wait for request (non-blocking)
export function waitForRequest(headerView: Int32Array):
  Promise<{ requestType: number; params: number[] }>
{
  return new Promise(resolve => {
    // Use Atomics.waitAsync for non-blocking wait on main thread
    const result = Atomics.waitAsync(headerView, STATUS_OFFSET / 4,
                                      STATUS_IDLE);
    if (result.async) {
      result.value.then(() => resolve(readRequest(headerView)));
    } else {
      resolve(readRequest(headerView));
    }
  });
}

function readRequest(headerView: Int32Array) {
  const requestType = Atomics.load(headerView, REQUEST_TYPE_OFFSET / 4);
  const params = [];
  for (let i = 0; i < 4; i++) {
    params.push(Atomics.load(headerView, PARAM_OFFSET / 4 + i));
  }
  return { requestType, params };
}

// Main thread side: send response, wake worker
export function sendResponse(
  headerView: Int32Array,
  error: number,
  responseLen: number
) {
  Atomics.store(headerView, ERROR_OFFSET / 4, error);
  Atomics.store(headerView, RESPONSE_LEN_OFFSET / 4, responseLen);
  Atomics.store(headerView, STATUS_OFFSET / 4, STATUS_RESPONSE);
  Atomics.notify(headerView, STATUS_OFFSET / 4);
}
```

**Tests:** Unit tests for the channel protocol using two Workers (one
blocks, other responds). Verify round-trip works, verify timeout
behavior.

**Step 1:** Write failing tests for `createSharedChannel`, `sendRequest`,
`sendResponse` round-trip.

**Step 2:** Run tests — expect failure (module doesn't exist).

**Step 3:** Implement `shared-channel.ts`.

**Step 4:** Run tests — expect pass.

**Step 5:** Commit: `Add SharedArrayBuffer communication channel for JSPI polyfill`

---

## Phase 1: Minimal PoC — emscripten_sleep

### Task 1.1: Polyfill WebAssembly.Suspending and WebAssembly.promising

**Files:**
- Create: `packages/php-wasm/web/src/lib/jspi-polyfill/jspi-polyfill.ts`
- Test: `packages/php-wasm/web/src/lib/jspi-polyfill/jspi-polyfill.spec.ts`

The core polyfill that patches `WebAssembly.Suspending` and
`WebAssembly.promising` when native JSPI is unavailable.

```ts
// jspi-polyfill.ts

import { jspi } from 'wasm-feature-detect';

export async function needsJspiPolyfill(): Promise<boolean> {
  return !(await jspi());
}

export function installJspiPolyfill() {
  // WebAssembly.Suspending becomes identity — the import function
  // is already synchronous (it blocks via Atomics.wait internally)
  (WebAssembly as any).Suspending = function(fn: Function) {
    return fn;
  };

  // WebAssembly.promising wraps the export so it returns a Promise,
  // but since all imports are synchronous now, the export runs
  // synchronously too. We just wrap in Promise.resolve for API compat.
  (WebAssembly as any).promising = function(fn: Function) {
    return (...args: any[]) => Promise.resolve(fn(...args));
  };
}
```

**Tests:** Verify that after `installJspiPolyfill()`:
- `new WebAssembly.Suspending(fn)` returns the original `fn`
- `WebAssembly.promising(fn)(...args)` returns a Promise resolving to
  `fn(...args)`

**Step 1:** Write failing tests.
**Step 2:** Run tests — expect failure.
**Step 3:** Implement.
**Step 4:** Run tests — expect pass.
**Step 5:** Commit: `Add WebAssembly.Suspending/promising polyfill stubs`

### Task 1.2: Polyfill handleSleep for emscripten_sleep

**Files:**
- Modify: `packages/php-wasm/web/src/lib/jspi-polyfill/jspi-polyfill.ts`
- Create: `packages/php-wasm/web/src/lib/jspi-polyfill/main-thread-handler.ts`
- Test: integration test

The Emscripten-generated code has:
```js
var _emscripten_sleep = (ms) =>
  Asyncify.handleSleep((wakeUp) => safeSetTimeout(wakeUp, ms));
```

In polyfill mode, we replace `Asyncify.handleSleep` with a version that
forwards the async work to the main thread.

**Approach:** We can't generically forward arbitrary closures. Instead,
we provide an `Asyncify.handleSleep` replacement that:

1. Calls the original `startAsync(wakeUp)` — this registers the async
   callback (e.g., `setTimeout(wakeUp, ms)`)
2. The `wakeUp` function is replaced with one that writes the result to
   the SAB and calls `Atomics.notify()`
3. **But wakeUp runs as an async callback which needs the event loop...**

This won't work if the worker is blocked. We need a different approach
for `handleSleep`:

**Revised approach — patch at the Emscripten module level:**

Instead of replacing `handleSleep`, we hook into the Emscripten module
initialization and replace the *specific* import functions. The
`loadPHPRuntime` function accepts `EmscriptenOptions` which include
arbitrary properties that get merged into the Emscripten `Module` object.

We use the `onRuntimeInitialized` or pre-initialization hooks to patch
the Asyncify object.

Actually, the cleanest approach: **patch the Emscripten module's
`Asyncify` object before WASM instantiation.** The `init()` function
returns the Module object. We can intercept it.

Looking at `load-php-runtime.ts:136`:
```ts
const PHPRuntime = phpLoaderModule.init(currentJsRuntime, { ... });
```

The `init()` function returns the Module. We can wrap `init()` to patch
Module.Asyncify after init but before WASM starts.

Actually, looking more carefully at the generated code, `Asyncify` is a
local variable inside the `init()` function — not on the Module object.
We can't directly patch it from outside.

**Better approach: Use `instantiateWasm` hook.**

The `EmscriptenOptions` type includes `instantiateWasm`. The generated
code at line 220 checks `Module['instantiateWasm']`. If provided, it's
called with `(info, receiveInstance)` where `info` is the WASM imports
object. We can intercept the imports here and replace the async functions
with our synchronous SAB-based versions.

```ts
// In polyfill mode, provide instantiateWasm that intercepts imports
emscriptenOptions.instantiateWasm = (info, receiveInstance) => {
  // info.env contains the import functions
  // Replace async imports with SAB-based synchronous versions
  patchAsyncImports(info.env, sharedChannel);

  // Instantiate WASM normally with patched imports
  WebAssembly.instantiate(wasmModule, info).then(instance => {
    receiveInstance(instance);
  });
};
```

Wait — but `instrumentWasmImports` is called BEFORE `instantiateWasm` at
line 186-219:
```js
function getWasmImports() {
  Asyncify.instrumentWasmImports(wasmImports);  // wraps with Suspending
  var imports = { env: wasmImports, ... };
  // ...
}
var info = getWasmImports();
if (Module['instantiateWasm']) {
  Module['instantiateWasm'](info, receiveInstance);
}
```

So by the time `instantiateWasm` is called, the imports have already been
wrapped with `WebAssembly.Suspending`. If we polyfill `Suspending` as
identity BEFORE init, the wrapping becomes a no-op. Then in
`instantiateWasm`, the imports are the original unwrapped functions.

We need our synchronous replacements to be in place BEFORE
`instrumentWasmImports` runs. Options:

**Option A:** Install the `WebAssembly.Suspending` polyfill (identity)
before calling `phpLoaderModule.init()`. Then the wrapping is a no-op.
The import functions still use `handleSleep`/`handleAsync` internally
which create Promises — so we also need to replace those specific
functions.

**Option B:** In `instantiateWasm`, replace the import functions in
`info.env` after they've been (no-op) wrapped.

Option A is cleaner. The sequence:

1. Check `needsJspiPolyfill()`
2. If yes: `installJspiPolyfill()` (patches WebAssembly.Suspending/promising)
3. Call `phpLoaderModule.init()` — Emscripten wraps imports with
   (no-op) Suspending, wraps exports with (Promise.resolve) promising
4. Via `instantiateWasm` hook: replace the specific async import
   functions in `info.env` with SAB-based synchronous versions

**Main thread handler:**

```ts
// main-thread-handler.ts

export function createMainThreadHandler(sab: SharedArrayBuffer) {
  const headerView = new Int32Array(sab, 0, 8);
  const dataView = new Uint8Array(sab, 32);

  async function handleRequests() {
    while (true) {
      // Wait for a request (non-blocking on main thread)
      await Atomics.waitAsync(headerView, 0, 0).value;

      const requestType = Atomics.load(headerView, 1);
      const params = [
        Atomics.load(headerView, 4),
        Atomics.load(headerView, 5),
        Atomics.load(headerView, 6),
        Atomics.load(headerView, 7),
      ];

      try {
        await dispatchRequest(requestType, params, headerView, dataView);
      } catch (e) {
        // Send error response
        sendResponse(headerView, 1, 0);
      }
    }
  }

  return { handleRequests };
}

async function dispatchRequest(
  type: number, params: number[],
  headerView: Int32Array, dataView: Uint8Array
) {
  switch (type) {
    case REQUEST_SLEEP:
      await new Promise(r => setTimeout(r, params[0]));
      sendResponse(headerView, 0, 0);
      break;
    // ... more handlers in later phases
  }
}
```

**Integration point:**

In `spawnPHPWorkerThread` or its caller, when the worker is created:

1. Create a SharedArrayBuffer
2. Post it to the worker via `postMessage`
3. Start the main-thread handler loop
4. Worker receives the SAB and passes it to the polyfill setup

**Step 1:** Write an integration test that loads PHP with polyfill mode
and calls `emscripten_sleep(100)`.
**Step 2:** Implement `main-thread-handler.ts`.
**Step 3:** Wire up the SAB channel between main thread and worker.
**Step 4:** Implement the `emscripten_sleep` polyfill handler.
**Step 5:** Run integration test.
**Step 6:** Commit: `Implement JSPI polyfill for emscripten_sleep via SAB channel`

### Task 1.3: Enable COOP/COEP headers in the service worker

**Files:**
- Modify: `packages/playground/remote/service-worker.ts`

SharedArrayBuffer requires cross-origin isolation. The service worker
already handles Document-Isolation-Policy rewriting for Gutenberg. We
need to add COOP/COEP header injection for browsers that need the polyfill
(Firefox, Safari) and don't support Document-Isolation-Policy.

The service worker should:
1. Inject `Cross-Origin-Opener-Policy: same-origin` on HTML responses
2. Inject `Cross-Origin-Embedder-Policy: credentialless` on HTML responses
3. Only do this when JSPI is not natively available (feature detection
   via message from the client)

`credentialless` is less restrictive than `require-corp` and should not
break existing cross-origin resource loading.

**Step 1:** Add a message handler in the service worker for JSPI polyfill
mode detection.
**Step 2:** Inject COOP/COEP headers on HTML responses when polyfill mode
is active.
**Step 3:** Test that `self.crossOriginIsolated` is `true` in the worker
after header injection.
**Step 4:** Commit: `Inject COOP/COEP headers for JSPI polyfill SharedArrayBuffer support`

### Task 1.4: Wire up the full polyfill pipeline

**Files:**
- Modify: `packages/php-wasm/web/src/lib/load-runtime.ts`
- Modify: `packages/php-wasm/web/src/lib/get-php-loader-module.ts`
- Modify: `packages/php-wasm/web-builds/8-4/src/index.ts` (and other versions)
- Modify: `packages/php-wasm/web/src/lib/worker-thread/spawn-php-worker-thread.ts`

**Changes:**

1. `get-php-loader-module.ts` or the individual `web-builds/*/src/index.ts`
   files: Always load the JSPI binary. Remove the Asyncify fallback.
   ```ts
   export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
     return await import('../jspi/php_8_4.js');
   }
   ```

2. `spawn-php-worker-thread.ts`: After creating the worker, send the
   SharedArrayBuffer to the worker and start the main-thread handler.
   ```ts
   if (await needsJspiPolyfill()) {
     const sab = new SharedArrayBuffer(TOTAL_SIZE);
     worker.postMessage({ type: 'jspi-polyfill-sab', sab });
     createMainThreadHandler(sab).handleRequests();
   }
   ```

3. `load-runtime.ts`: In polyfill mode, install the polyfill before
   calling `loadPHPRuntime`. Pass the SAB reference through
   EmscriptenOptions so the import function replacements can use it.
   ```ts
   if (needsPolyfill) {
     installJspiPolyfill();
     options.instantiateWasm = createPolyfillInstantiateWasm(sab);
   }
   ```

**Step 1:** Modify `web-builds/8-4/src/index.ts` to always load JSPI.
**Step 2:** Add SAB setup to worker spawning.
**Step 3:** Wire up polyfill installation in `load-runtime.ts`.
**Step 4:** Test end-to-end with PHP executing `sleep(1)` in a browser
without JSPI.
**Step 5:** Commit: `Wire up JSPI polyfill pipeline end-to-end`

---

## Phase 2: Network Operations

### Task 2.1: Polyfill wasm_connect

Forward WebSocket connection + event waiting to the main thread.

The function (`phpwasm-emscripten-library.js:1041-1162`) does:
1. Parse sockaddr to get host/port (sync, accesses WASM memory)
2. Call `sock.sock_ops.connect()` (sync, Emscripten socket layer)
3. Wait for WebSocket 'open'/'error'/'close' events (async)

Polyfill approach: Steps 1-2 run in the worker. Step 3 is forwarded to
the main thread — the worker tells the main thread "wait for this
WebSocket to open" and blocks. The main thread monitors the events.

Challenge: The WebSocket object lives in the worker. The main thread
can't directly listen on it. Solutions:
- Transfer the WebSocket to the main thread (not possible — not transferable)
- Have the worker set up event listeners BEFORE blocking... but callbacks
  can't fire while blocked
- Create the WebSocket on the main thread instead

**Revised approach:** The connect function needs restructuring. Instead
of using Emscripten's built-in socket layer, the polyfill version:
1. Reads host/port from WASM memory (in worker)
2. Sends "connect(host, port)" to main thread
3. Main thread creates the WebSocket and waits for open/error
4. Main thread reports success/failure back
5. Worker associates the socket FD with the main-thread WebSocket
   (via a proxy mechanism)

This is more involved. The socket operations (`recv`, `connect`, `send`)
would all need to be proxied to the main thread where the actual
WebSocket lives.

**Alternative:** Since Playground uses `tcpOverFetchWebsocket` (all TCP
goes through fetch via a service worker), the WebSocket is actually a
`TCPOverFetchWebSocket` proxy. The async part is just a `fetch()` call.
We could have the polyfill intercept at the fetch level rather than the
WebSocket level.

This needs more investigation during implementation. For now, plan the
task at a high level and fill in details during the PoC.

**Step 1:** Study `tcp-over-fetch-websocket.ts` to understand the actual
async primitives used.
**Step 2:** Design the proxy protocol for socket operations.
**Step 3:** Implement worker-side stubs for `wasm_connect`, `wasm_recv`.
**Step 4:** Implement main-thread handlers for socket operations.
**Step 5:** Integration test with PHP making an HTTP request.
**Step 6:** Commit: `Implement JSPI polyfill for network socket operations`

### Task 2.2: Polyfill wasm_recv

Forward socket receive to main thread. Similar pattern to connect —
the actual network data comes from a fetch/WebSocket that lives on the
main thread (or via service worker).

### Task 2.3: Polyfill _emscripten_wget_data

The function (`php_8_4.js:12909-12923`) does:
1. Read URL from WASM memory via `UTF8ToString(url)`
2. `await asyncLoad(url)` — fetches the URL
3. Allocate buffer in WASM memory, copy data, write pointers

Polyfill approach:
1. Worker reads URL string from WASM memory
2. Posts "fetch(url)" request to main thread with URL string in SAB data
3. Blocks on `Atomics.wait()`
4. Main thread fetches the URL, writes response bytes to SAB data section
5. Notifies worker
6. Worker reads data from SAB, allocates WASM buffer (`_malloc`), copies
   data, writes output pointers to WASM memory

**Step 1:** Implement worker-side wget handler (URL extraction, blocking).
**Step 2:** Implement main-thread fetch handler.
**Step 3:** Test with PHP `file_get_contents('http://...')`.
**Step 4:** Commit: `Implement JSPI polyfill for emscripten_wget_data`

---

## Phase 3: Process & File Operations

### Task 3.1: Polyfill js_open_process

The most complex function. It spawns a child process (PHP's `proc_open`)
and sets up stdin/stdout/stderr piping with a continuous `setInterval`
pump.

Since the process management is entirely virtual (Playground doesn't have
real processes), the polyfill can forward the entire process lifecycle to
the main thread:
1. Worker sends "spawn(command, args, env, cwd)" to main thread
2. Main thread manages the virtual process
3. Worker blocks until the process is spawned
4. Subsequent I/O (js_fd_read, js_waitpid) also goes through the main
   thread

This requires the main thread to maintain the process table and stdin/
stdout/stderr state, while the worker only sends/receives data.

### Task 3.2: Polyfill js_fd_read

Forward file descriptor reads to main thread for process-related FDs
(pipes). For regular file FDs, this is synchronous and doesn't need
polyfilling.

### Task 3.3: Polyfill js_waitpid

Simple polling: the worker asks "is process X done?" and the main thread
checks the process table. The main thread can either poll or wait for the
actual process exit event before responding.

### Task 3.4: Polyfill _fd_sync

Forward FS sync to main thread. The function
(`php_8_4.js:13103-13122`) calls `mount.type.syncfs()` which is async
for some mount types (e.g., IDBFS). The polyfill forwards the sync
request to the main thread.

---

## Phase 4: Integration & Testing

### Task 4.1: Update all web-builds to always use JSPI binary

**Files:**
- Modify: `packages/php-wasm/web-builds/*/src/index.ts` (all versions)

Remove the `jspi()` feature detection branch. Always load the JSPI binary.
The polyfill handles browsers without native support.

### Task 4.2: Cross-browser testing

- Test in Chrome (native JSPI — polyfill not activated)
- Test in Firefox (polyfill activated)
- Test in Safari (polyfill activated)
- Test core operations: page load, plugin install, network requests,
  `proc_open` (if used), `sleep()`

### Task 4.3: Performance benchmarking

Compare:
- Native JSPI (Chrome)
- Polyfilled JSPI (Chrome with polyfill forced on)
- Asyncify (current fallback)

Measure: page load time, PHP request handling time, network request
latency.

---

## Phase 5: Cleanup (after validation)

### Task 5.1: Remove Asyncify builds

- Delete `packages/php-wasm/web-builds/*/asyncify/` directories
- Remove Asyncify compilation targets from Dockerfile/Makefile
- Remove `ASYNCIFY_IMPORTS`, `ASYNCIFY_ONLY` lists
- Remove `fix-asyncify` tooling

### Task 5.2: Remove Asyncify-related code

- Remove Asyncify error detection in `wasm-error-reporting.ts`
- Clean up runtime selection code that switches between JSPI/Asyncify
- Update documentation

### Task 5.3: Remove Asyncify node builds

- Same as 5.1 but for `packages/php-wasm/node-builds/*/asyncify/`

---

## Open Questions

1. **Socket proxy architecture:** How exactly should WebSocket operations
   be proxied to the main thread? This depends on whether
   `tcpOverFetchWebsocket` can be leveraged.

2. **Process management on main thread:** Moving the process table and
   stdin pump to the main thread is complex. Is there a simpler approach?
   Could we avoid `proc_open` entirely in polyfill mode?

3. **SAB size limits:** 1MB might not be enough for large network
   responses. Should we use growable SABs or a streaming protocol?

4. **Atomics.waitAsync browser support:** The main-thread handler uses
   `Atomics.waitAsync()` which requires Chrome 87+, Firefox 110+,
   Safari 16.4+. Need to verify coverage. Alternative: polling with
   `setInterval`.

5. **Nested worker architecture:** The current architecture has
   Main Thread → Remote Worker → PHP Worker. The SAB communication needs
   to cross the right boundary. Which thread runs the main-thread handler
   — the main thread or the remote worker?

## Recommended Implementation Order

Start with Phase 0 and Phase 1 to validate the approach end-to-end with
`emscripten_sleep`. This is the minimal PoC that proves the architecture
works. If it works, proceed to Phase 2-3 for full coverage. Phase 4-5
are post-validation cleanup.

The PoC should be testable within a few days. Full implementation depends
on the complexity of socket and process proxying discovered during Phase 2.
