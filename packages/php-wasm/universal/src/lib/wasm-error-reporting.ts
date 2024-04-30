import { ErrorEvent } from './error-event-polyfill';
import { isExitCodeZero } from './is-exit-code-zero';
import { logger } from '@php-wasm/logger';

type Runtime = {
	asm: Record<string, unknown>;
	lastAsyncifyStackSource?: Error;
};

export class UnhandledRejectionsTarget extends EventTarget {
	listenersCount = 0;
	override addEventListener(type: unknown, callback: unknown): void {
		++this.listenersCount;
		super.addEventListener(type as string, callback as EventListener);
	}
	override removeEventListener(type: unknown, callback: unknown): void {
		--this.listenersCount;
		super.removeEventListener(type as string, callback as EventListener);
	}
	hasListeners() {
		return this.listenersCount > 0;
	}
}

/**
 * Creates Asyncify errors listener.
 *
 * Emscripten turns Asyncify errors into unhandled rejections by
 * throwing them outside of the context of the original function call.
 *
 * With this listener, we can catch and rethrow them in a proper context,
 * or at least log them in a more readable way.
 *
 * @param runtime
 */
export function improveWASMErrorReporting(runtime: Runtime) {
	runtime.asm = {
		...runtime.asm,
	};
	const target = new UnhandledRejectionsTarget();
	for (const key in runtime.asm) {
		if (typeof runtime.asm[key] == 'function') {
			const original = runtime.asm[key] as any;
			runtime.asm[key] = function (...args: any[]) {
				try {
					return original(...args);
				} catch (e) {
					if (!(e instanceof Error)) {
						throw e;
					}
					const clearMessage = clarifyErrorMessage(
						e,
						runtime.lastAsyncifyStackSource?.stack
					);

					if (runtime.lastAsyncifyStackSource) {
						e.cause = runtime.lastAsyncifyStackSource;
					}

					if (target.hasListeners()) {
						target.dispatchEvent(
							new ErrorEvent('error', {
								error: e,
								message: clearMessage,
							})
						);
						return;
					}

					if (!isExitCodeZero(e)) {
						showCriticalErrorBox(clearMessage);
					}
					throw e;
				}
			};
		}
	}
	return target;
}

let functionsMaybeMissingFromAsyncify: string[] = [];
export function getFunctionsMaybeMissingFromAsyncify() {
	return functionsMaybeMissingFromAsyncify;
}

export function clarifyErrorMessage(
	crypticError: Error,
	asyncifyStack?: string
) {
	if (crypticError.message === 'unreachable') {
		let betterMessage = UNREACHABLE_ERROR;
		if (!asyncifyStack) {
			betterMessage +=
				`\n\nThis stack trace is lacking. For a better one initialize \n` +
				`the PHP runtime with { debug: true }, e.g. PHPNode.load('8.1', { debug: true }).\n\n`;
		}
		functionsMaybeMissingFromAsyncify = extractPHPFunctionsFromStack(
			asyncifyStack || crypticError.stack || ''
		);
		for (const fn of functionsMaybeMissingFromAsyncify) {
			betterMessage += `    * ${fn}\n`;
		}
		return betterMessage;
	}
	return crypticError.message;
}

const UNREACHABLE_ERROR = `
"unreachable" WASM instruction executed.

The typical reason is a PHP function missing from the ASYNCIFY_ONLY
list when building PHP.wasm.

You will need to file a new issue in the WordPress Playground repository
and paste this error message there:

https://github.com/WordPress/wordpress-playground/issues/new

If you're a core developer, the typical fix is to:

* Isolate a minimal reproduction of the error
* Add a reproduction of the error to php-asyncify.spec.ts in the WordPress Playground repository
* Run 'npm run fix-asyncify'
* Commit the changes, push to the repo, release updated NPM packages

Below is a list of all the PHP functions found in the stack trace to
help with the minimal reproduction. If they're all already listed in
the Dockerfile, you'll need to trigger this error again with long stack
traces enabled. In node.js, you can do it using the --stack-trace-limit=100
CLI option: \n\n`;

// ANSI escape codes for CLI colors and formats
const redBg = '\x1b[41m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';
const eol = '\x1B[K';

let logged = false;
export function showCriticalErrorBox(message: string) {
	if (logged) {
		return;
	}
	logged = true;
	if (message?.trim().startsWith('Program terminated with exit')) {
		return;
	}
	logger.log(`${redBg}\n${eol}\n${bold}  WASM ERROR${reset}${redBg}`);
	for (const line of message.split('\n')) {
		logger.log(`${eol}  ${line} `);
	}
	logger.log(`${reset}`);
}

function extractPHPFunctionsFromStack(stack: string) {
	try {
		const names = stack
			.split('\n')
			.slice(1)
			.map((line) => {
				const parts = line.trim().substring('at '.length).split(' ');
				return {
					fn: parts.length >= 2 ? parts[0] : '<unknown>',
					isWasm: line.includes('wasm://'),
				};
			})
			.filter(
				({ fn, isWasm }) =>
					isWasm &&
					!fn.startsWith('dynCall_') &&
					!fn.startsWith('invoke_')
			)
			.map(({ fn }) => fn);
		return Array.from(new Set(names));
	} catch (err) {
		return [];
	}
}
