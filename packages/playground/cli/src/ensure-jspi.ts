/**
 * Determines whether the current process should respawn itself with
 * the --experimental-wasm-jspi flag to enable JSPI support.
 *
 * Returns true only when all of these hold:
 *  1. JSPI is not already available in this runtime.
 *  2. The flag hasn't already been passed (avoids infinite loops).
 *  3. The Node.js version is >= 22 (older versions don't have the flag).
 */
export function shouldRespawnWithJSPI(): boolean {
	// JSPI is already usable — nothing to do.
	if ('Suspending' in WebAssembly) {
		return false;
	}

	// We already tried — the flag didn't help (e.g. Node 22 where
	// the flag exists but JSPI is non-functional). Don't loop.
	if (process.execArgv.includes('--experimental-wasm-jspi')) {
		return false;
	}

	// The flag doesn't exist before Node 22.
	const major = parseInt(process.versions.node.split('.')[0], 10);
	if (major < 22) {
		return false;
	}

	return true;
}
