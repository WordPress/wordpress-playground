import { spawn } from 'child_process';
import { shouldRespawnWithJSPI } from './ensure-jspi';

function runCLI() {
	const args = process.argv.slice(2);
	// Dynamic import avoids loading run-cli when we're about to respawn.
	// Do not await — top-level await is not supported in all environments.
	import('./run-cli').then(({ parseOptionsAndRunCLI }) => {
		parseOptionsAndRunCLI(args);
	});
}

if (shouldRespawnWithJSPI()) {
	const spawnedAt = Date.now();
	const child = spawn(
		process.execPath,
		[
			'--experimental-wasm-jspi',
			...process.execArgv,
			...process.argv.slice(1),
		],
		{ stdio: 'inherit' }
	);

	// Forward SIGINT/SIGTERM so Ctrl+C and kill work as expected.
	for (const sig of ['SIGINT', 'SIGTERM'] as const) {
		process.on(sig, () => child.kill(sig));
	}

	// If spawn() itself fails (e.g. ENOENT), fall back to running
	// without JSPI in this process. We might be inside of a non-Node
	// JavaScript runtime that refuses to boot when the `--experimental-wasm-jspi`
	// flag is present.
	child.on('error', () => {
		runCLI();
	});

	child.on('close', (code, signal) => {
		// If the child exited almost immediately with an error, the
		// --experimental-wasm-jspi flag was likely rejected by the
		// runtime. Fall back to running without JSPI in this process
		// instead of propagating the failure.
		if (code !== 0 && !signal && Date.now() - spawnedAt < 1000) {
			runCLI();
			return;
		}

		/**
		 * We should always get either a code or a signal as per
		 * https://nodejs.org/api/child_process.html#event-close:
		 *
		 * > If the process exited, code is the final exit code of the
		 * > process, otherwise null. If the process terminated due to
		 * > receipt of a signal, signal is the string name of the signal,
		 * > otherwise null. **One of the two will always be non-null.**
		 */
		if (signal) {
			process.kill(process.pid, signal);
		} else {
			process.exit(code);
		}
	});
} else {
	runCLI();
}
