import { spawn } from 'node:child_process';
import { shouldRespawnWithJSPI } from './ensure-jspi';

if (shouldRespawnWithJSPI()) {
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

	child.on('close', (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
		} else {
			process.exit(code ?? 1);
		}
	});
} else {
	// The CLI args are after the original command and the script name
	const args = process.argv.slice(2);
	// Dynamic import avoids loading run-cli when we're about to respawn.
	// Do not await — top-level await is not supported in all environments.
	import('./run-cli').then(({ parseOptionsAndRunCLI }) => {
		parseOptionsAndRunCLI(args);
	});
}
