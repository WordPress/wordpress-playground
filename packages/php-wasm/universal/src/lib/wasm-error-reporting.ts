const UNREACHABLE_ERROR = `
"unreachable" WASM instruction executed. The typical reason is not listing all
the PHP functions that can yield to JavaScript event loop in the ASYNCIFY_ONLY
during the PHP compilation process. How to proceed? Find the "ASYNCIFY" section in
Dockerfile in the WordPress Playground repository.

Below is a list of all the PHP functions found in the stack trace.
If they're all listed in the Dockerfile, you'll need to trigger this error
again with long stack traces enabled. In node.js, you can do it using
the --stack-trace-limit=100 CLI option: \n\n`;

type Runtime = {
	asm: Record<string, unknown>;
};

/**
 * Wraps WASM function calls with try/catch that
 * provides better error reporting.
 *
 * @param runtime
 */
export function improveWASMErrorReporting(runtime: Runtime) {
	let logged = false;
	for (const key in runtime.asm) {
		if (typeof runtime.asm[key] == 'function') {
			const original = runtime.asm[key] as any;
			runtime.asm[key] = function (...args: any[]) {
				try {
					return original(...args);
				} catch (e) {
					if (logged || !(e instanceof Object)) {
						throw e;
					}
					logged = true;
					let betterMessage = UNREACHABLE_ERROR;
					if ('message' in e && e.message === 'unreachable') {
						for (const fn of extractPHPFunctionsFromTrace(e)) {
							betterMessage += `    * ${fn}\n`;
						}
					}
					errorBox(betterMessage);
					throw e;
				}
			};
		}
	}
}
// ANSI escape codes for CLI colors and formats
const redBg = '\x1b[41m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';
const eol = '\x1B[K';

function errorBox(message: string) {
	console.log(`${redBg}\n${eol}\n${bold}  WASM ERROR${reset}${redBg}`);
	for (const line of message.split('\n')) {
		console.log(`${eol}  ${line} `);
	}
	console.log(`${reset}`);
}

function extractPHPFunctionsFromTrace(e: any) {
	if (!e || !('stack' in e)) {
		return [];
	}
	try {
		return (e.stack as string)
			.split('\n')
			.slice(1)
			.map((line) => {
				const [fn, source] = line
					.trim()
					.substring('at '.length)
					.split(' ');
				const filename = source.split(':')[0].split('/').pop() || '';
				return {
					fn,
					isJs:
						filename.endsWith('.js') ||
						filename.endsWith('.cjs') ||
						filename.endsWith('.mjs'),
				};
			})
			.filter(
				({ fn, isJs }) =>
					!isJs &&
					!fn.startsWith('dynCall_') &&
					!fn.startsWith('dynCall_ii')
			)
			.map(({ fn }) => fn);
	} catch (err) {
		return [];
	}
}
