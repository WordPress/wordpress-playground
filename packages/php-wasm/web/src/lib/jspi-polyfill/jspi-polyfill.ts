/**
 * Polyfills WebAssembly.Suspending and WebAssembly.promising
 * for browsers that lack native JSPI support (Safari, Firefox).
 *
 * When installed, the polyfill makes:
 * - `new WebAssembly.Suspending(fn)` return `fn` unchanged
 *   (identity wrapper / no-op).
 * - `WebAssembly.promising(fn)` return a wrapper that calls
 *   `fn` and wraps the result in `Promise.resolve()`.
 *
 * This works because the companion sync XHR import
 * replacements in load-runtime.ts turn all async imports
 * into synchronous ones. With synchronous imports, the
 * Emscripten `Asyncify.instrumentWasmImports()` wrapping
 * via `new WebAssembly.Suspending(fn)` becomes a no-op,
 * and `instrumentWasmExports()` wrapping via
 * `WebAssembly.promising(fn)` just needs to return a
 * Promise for API compatibility.
 *
 * Must be installed BEFORE the Emscripten module's
 * `init()` function is called.
 */

import { jspi } from 'wasm-feature-detect';

let polyfillInstalled = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let originalSuspending: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let originalPromising: any;
let originalSuspendingExisted = false;
let originalPromisingExisted = false;

/**
 * Returns `true` if the browser does not support native
 * JSPI and the polyfill is needed.
 */
export async function needsJspiPolyfill(): Promise<boolean> {
	return !(await jspi());
}

/**
 * Patches the global `WebAssembly` object with polyfilled
 * `Suspending` and `promising` implementations.
 *
 * - `Suspending`: identity constructor (returns the
 *   function unchanged).
 * - `promising`: wraps the function so its return value
 *   is wrapped in `Promise.resolve()`.
 */
export function installJspiPolyfill(): void {
	if (!polyfillInstalled) {
		saveOriginals();
		polyfillInstalled = true;
	}

	// Always (re-)install both polyfills. patchAsyncImports()
	// deletes Suspending after each WASM instantiation so
	// that runtime code (e.g. _wasm_connect) takes sync
	// paths. A subsequent instantiation (runtime rotation)
	// needs Suspending again for instrumentWasmImports().
	(WebAssembly as any).Suspending = createSuspendingPolyfill();
	(WebAssembly as any).promising = createPromisingPolyfill();
}

/**
 * Restores the original `WebAssembly.Suspending` and
 * `WebAssembly.promising` (or removes them if they did
 * not exist before the polyfill was installed).
 */
export function uninstallJspiPolyfill(): void {
	if (!polyfillInstalled) {
		return;
	}

	if (originalSuspendingExisted) {
		(WebAssembly as any).Suspending = originalSuspending;
	} else {
		delete (WebAssembly as any).Suspending;
	}

	if (originalPromisingExisted) {
		(WebAssembly as any).promising = originalPromising;
	} else {
		delete (WebAssembly as any).promising;
	}

	polyfillInstalled = false;
	originalSuspending = undefined;
	originalPromising = undefined;
	originalSuspendingExisted = false;
	originalPromisingExisted = false;
}

/**
 * Returns whether the polyfill is currently installed.
 */
export function isJspiPolyfillInstalled(): boolean {
	return polyfillInstalled;
}

// --- Private helpers ---

function saveOriginals(): void {
	originalSuspendingExisted = 'Suspending' in WebAssembly;
	originalPromisingExisted = 'promising' in WebAssembly;

	if (originalSuspendingExisted) {
		originalSuspending = (WebAssembly as any).Suspending;
	}
	if (originalPromisingExisted) {
		originalPromising = (WebAssembly as any).promising;
	}
}

/**
 * Identity constructor: `new WebAssembly.Suspending(fn)`
 * returns `fn` unchanged.
 *
 * Implemented as a class whose constructor returns the
 * argument directly, which is valid ES — a constructor
 * can return an object to override `this`.
 */
function createSuspendingPolyfill() {
	return class Suspending {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		constructor(fn: (...args: any[]) => any) {
			// Returning a non-primitive from a constructor
			// overrides the default `this` value.
			return fn as any;
		}
	};
}

/**
 * Wraps a function so that calling it returns a Promise
 * resolving to the original return value.
 *
 * Native JSPI's `WebAssembly.promising` always returns a
 * Promise — even when the WASM function throws synchronously
 * (e.g. PHP's `exit(0)` → Emscripten's `ExitStatus`). We
 * must match that: catch synchronous throws and convert them
 * to rejected Promises so that callers like Emscripten's
 * `ccall({ async: true })` always receive a thenable.
 */
function createPromisingPolyfill() {
	return function promising<A extends any[], R>(
		fn: (...args: A) => R
	): (...args: A) => Promise<R> {
		return (...args: A) => {
			try {
				return Promise.resolve(fn(...args));
			} catch (e) {
				return Promise.reject(e);
			}
		};
	};
}
