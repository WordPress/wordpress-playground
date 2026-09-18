/**
 * Determines whether the current process should respawn itself with
 * the --experimental-wasm-jspi flag to enable JSPI support.
 *
 * Returns true only when all of these hold:
 *  1. JSPI is not already available in this runtime.
 *  2. We're running on Node.js (not Bun, Deno, or another runtime).
 *  3. The flag hasn't already been passed (avoids infinite loops).
 *  4. The Node.js version is >= 23 (the first version whose V8 has
 *     the current JSPI spec with WebAssembly.Suspending).
 *
 * Why not Node 22? It ships V8 12.4 which only exposes the old,
 * since-removed JSPI API (WebAssembly.Suspender). The new API
 * (WebAssembly.Suspending) arrived in V8 12.6 = Node 23.
 */
export function shouldRespawnWithJSPI(): boolean {
	// JSPI is already usable — nothing to do.
	if ('Suspending' in WebAssembly) {
		return false;
	}

	// Explicit opt-out. The `unbuilt-asyncify` NX target sets this
	// to prevent the respawn on Node versions that support JSPI.
	if (process.env['PLAYGROUND_NO_JSPI_RESPAWN']) {
		return false;
	}

	// The --experimental-wasm-jspi flag is Node.js-specific. Other
	// runtimes (Bun, Deno) set process.versions.node for compat but
	// don't support Node's V8 flags.
	if (process.versions['bun'] || 'Deno' in globalThis) {
		return false;
	}

	// We already tried — the flag didn't help. Don't loop.
	if (process.execArgv.includes('--experimental-wasm-jspi')) {
		return false;
	}

	// Node 22 and below: V8 is too old for the current JSPI spec.
	// The flag exists in Node 22, but it only enables the old API
	// (WebAssembly.Suspender) which we don't use.
	const major = parseInt(process.versions.node.split('.')[0], 10);
	if (major < 23) {
		return false;
	}

	return true;
}
