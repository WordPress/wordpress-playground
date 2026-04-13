import { ErrorEvent } from './error-event-polyfill';
import { isExitCode } from './is-exit-code';
import { logger } from '@php-wasm/logger';

type Runtime = {
	wasmExports: Record<string, unknown>;
	lastAsyncifyStackSource?: Error;
};

export class UnhandledRejectionsTarget extends EventTarget {
	listenersCount = 0;
	override addEventListener(
		type: unknown,
		callback: unknown,
		options?: boolean | AddEventListenerOptions
	): void {
		++this.listenersCount;
		super.addEventListener(
			type as string,
			callback as EventListener,
			options
		);
	}
	override removeEventListener(
		type: unknown,
		callback: unknown,
		options?: boolean | EventListenerOptions
	): void {
		--this.listenersCount;
		super.removeEventListener(
			type as string,
			callback as EventListener,
			options
		);
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
	const target = new UnhandledRejectionsTarget();
	for (const key in runtime.wasmExports) {
		if (typeof runtime.wasmExports[key] == 'function') {
			const original = runtime.wasmExports[key] as any;
			runtime.wasmExports[key] = function (...args: any[]) {
				try {
					return original(...args);
				} catch (e) {
					if (!(e instanceof Error)) {
						throw e;
					}

					if (runtime.lastAsyncifyStackSource) {
						e.cause = runtime.lastAsyncifyStackSource;
					}

					const clearMessage = clarifyErrorMessage(
						e,
						runtime.lastAsyncifyStackSource?.stack
					);

					if (target.hasListeners()) {
						e.message = clearMessage;
						const event = new ErrorEvent('error', { error: e });
						target.dispatchEvent(event);
						throw e;
					}

					if (!isExitCode(e) || e.status !== 0) {
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
	const isWasmTrap =
		crypticError.message === 'unreachable' ||
		crypticError.message?.includes('memory access out of bounds');
	if (!isWasmTrap) {
		return crypticError.message;
	}

	// Extract PHP functions from the entire error chain. These help
	// diagnose Asyncify issues (missing ASYNCIFY_ONLY entries).
	const uniqueFunctions = new Set<string>(
		extractPHPFunctionsFromStack(asyncifyStack || '')
	);
	let lastError = crypticError;
	do {
		for (const fn of extractPHPFunctionsFromStack(lastError.stack || '')) {
			uniqueFunctions.add(fn);
		}
		lastError = lastError.cause as Error;
	} while (lastError);
	functionsMaybeMissingFromAsyncify = Array.from(uniqueFunctions);

	let message = WASM_TRAP_ERROR;
	if (uniqueFunctions.size > 0) {
		message +=
			`PHP functions found in the stack trace (may help if this\n` +
			`is an Asyncify issue — see above):\n\n`;
		for (const fn of uniqueFunctions) {
			message += `    * ${fn}\n`;
		}
		message += '\n';
	}
	message += `Original error message: ${crypticError.message}\n`;
	return message;
}

const WASM_TRAP_ERROR = `\
WASM runtime error.

The PHP runtime encountered a fatal WebAssembly trap. Common causes:

* A PHP function missing from the ASYNCIFY_ONLY list (build issue)
* Corrupt or malformed data (e.g. truncated gzip from a network
  response) causing a C library to access memory out of bounds
* Running out of WASM memory (allocation failure)

The current PHP request has failed. If runtime rotation is enabled,
the PHP runtime will automatically recover on the next request.

If this is an Asyncify issue, the fix is to add the missing function
to the ASYNCIFY_ONLY list. Run 'npm run fix-asyncify' in the
WordPress Playground repository.

Please file an issue and paste this error message:
https://github.com/WordPress/wordpress-playground/issues/new

`;

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
					isWasm: line.includes('wasm:/'),
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
	} catch {
		return [];
	}
}
