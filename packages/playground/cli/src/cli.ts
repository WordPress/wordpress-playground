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
	// without JSPI in this process.
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

		if (signal) {
			process.kill(process.pid, signal);
		} else {
			process.exit(code ?? 1);
		}
	});
} else {
	runCLI();
}
