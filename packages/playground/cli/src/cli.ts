import { execFileSync } from 'child_process';
import { parseOptionsAndRunCLI } from './run-cli';

/**
 * Re-execute the current process with JSPI flags if the Node.js version
 * supports them but they were not passed on the command line.
 *
 * JSPI (JavaScript Promise Integration) provides reliable async WASM
 * operations. Without it, the CLI falls back to Asyncify which crashes
 * on certain PHP functions like proc_open(). Node.js 23+ ships V8 with
 * JSPI support but requires explicit flags to enable it.
 */
function reexecWithJspiIfNeeded(): boolean {
	const majorVersion = parseInt(process.versions.node.split('.')[0], 10);
	if (majorVersion < 23) {
		return false;
	}

	const jspiFlags = [
		'--experimental-wasm-jspi',
		'--experimental-wasm-stack-switching',
	];
	const currentFlags = process.execArgv;
	const missingFlags = jspiFlags.filter(
		(flag) => !currentFlags.includes(flag)
	);

	if (missingFlags.length === 0) {
		return false;
	}

	try {
		execFileSync(
			process.execPath,
			[...currentFlags, ...missingFlags, ...process.argv.slice(1)],
			{
				stdio: 'inherit',
				env: process.env,
			}
		);
		process.exit(0);
	} catch (error: unknown) {
		if (
			error instanceof Error &&
			'status' in error &&
			typeof (error as any).status === 'number'
		) {
			process.exit((error as any).status);
		}
		if (
			error instanceof Error &&
			'signal' in error &&
			(error as any).signal
		) {
			process.kill(process.pid, (error as any).signal);
		}
		process.exit(1);
	}
}

if (!reexecWithJspiIfNeeded()) {
	// The CLI args are after the original command and the script name
	const args = process.argv.slice(2);

	// Do not await this as top-level await is not supported in all environments.
	parseOptionsAndRunCLI(args);
}
