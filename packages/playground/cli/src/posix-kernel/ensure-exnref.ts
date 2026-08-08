/**
 * Determines whether the current process should respawn itself with
 * the --experimental-wasm-exnref flag.
 *
 * kandelo's kernel.wasm uses the WebAssembly exception-handling `exn`
 * value type, which Node 24's V8 keeps behind a flag. Without it the
 * kernel worker dies with "WebAssembly.compile(): invalid value type
 * 'exn'", php-fpm never starts, and nginx answers every request with a
 * 502. Only --experimental-posix-kernel needs the flag, so it stays off
 * for every other command.
 *
 * Returns true only when all of these hold:
 *  1. --experimental-posix-kernel was requested.
 *  2. We're running on Node.js (not Bun, Deno, or another runtime).
 *  3. The flag hasn't already been passed (avoids infinite loops).
 */
export function shouldRespawnWithExnref(): boolean {
	const posixKernelRequested = process.argv.some(
		(arg) =>
			arg === '--experimental-posix-kernel' ||
			arg.startsWith('--experimental-posix-kernel=')
	);
	if (!posixKernelRequested) {
		return false;
	}

	// The --experimental-wasm-exnref flag is Node.js-specific. Other
	// runtimes (Bun, Deno) set process.versions.node for compat but
	// don't support Node's V8 flags.
	if (process.versions['bun'] || 'Deno' in globalThis) {
		return false;
	}

	// We already tried — the flag didn't help. Don't loop.
	if (process.execArgv.includes('--experimental-wasm-exnref')) {
		return false;
	}

	return true;
}
