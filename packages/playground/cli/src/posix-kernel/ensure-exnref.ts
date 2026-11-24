export function shouldRespawnWithExnref(): boolean {
	const posixKernelRequested = process.argv.some(
		(arg) =>
			arg === '--experimental-posix-kernel' ||
			arg.startsWith('--experimental-posix-kernel=')
	);
	if (!posixKernelRequested) {
		return false;
	}

	if (process.versions['bun'] || 'Deno' in globalThis) {
		return false;
	}

	if (process.execArgv.includes('--experimental-wasm-exnref')) {
		return false;
	}

	return true;
}
