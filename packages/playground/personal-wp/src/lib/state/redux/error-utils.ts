import { FirewallInterferenceError } from '@php-wasm/web-service-worker';

const MAX_CAUSE_CHAIN_DEPTH = 100;

/**
 * Search through an error's cause chain to find a FirewallInterferenceError.
 * Checks both instanceof and the error's name property to handle cases where
 * instanceof fails due to module boundaries or error serialization.
 *
 * Returns the FirewallInterferenceError if found, or undefined if not.
 */
export function findFirewallErrorInCauseChain(
	error: unknown
): FirewallInterferenceError | Error | undefined {
	let current: unknown = error;
	const seen = new Set<Error>();
	let depth = 0;
	while (current && depth < MAX_CAUSE_CHAIN_DEPTH) {
		if (current instanceof Error) {
			if (seen.has(current)) {
				break;
			}
			seen.add(current);
		}
		if (current instanceof FirewallInterferenceError) {
			return current;
		}
		if (
			current instanceof Error &&
			current.name === 'FirewallInterferenceError'
		) {
			return current;
		}
		current =
			current instanceof Error ? (current as Error).cause : undefined;
		depth++;
	}
	return undefined;
}

/**
 * Known error message patterns that indicate a network/download failure.
 * These cover fetch failures, dynamic import failures, and WebAssembly
 * compile errors (which happen when a non-WASM response like an HTML
 * error page is returned).
 */
const DOWNLOAD_ERROR_PATTERNS = [
	// Standard fetch API failure
	'Failed to fetch',
	// Safari module import failure
	'Importing a module script failed',
	// Chrome/Firefox dynamic import failure
	'error loading dynamically imported module',
	// Firefox fetch failure
	'NetworkError when attempting to fetch',
	// Safari fetch failure
	'Load failed',
];

/**
 * Error class names that indicate a download/network problem.
 * WebAssembly.CompileError and LinkError occur when the browser tries
 * to compile a non-WASM response (e.g. an HTML error page) as WASM.
 */
const DOWNLOAD_ERROR_CLASS_NAMES = ['CompileError', 'LinkError'];

/**
 * Search through an error's cause chain to find a network/download error.
 * Checks error messages against known patterns and error class names
 * against WebAssembly compilation errors.
 *
 * Handles both native Error objects and Comlink-serialized errors
 * (which use `originalErrorClassName` instead of the native class name).
 *
 * Returns the matching error if found, or undefined if not.
 */
export function findDownloadErrorInCauseChain(
	error: unknown
): Error | undefined {
	let current: unknown = error;
	const seen = new Set<Error>();
	let depth = 0;
	while (current && depth < MAX_CAUSE_CHAIN_DEPTH) {
		if (current instanceof Error) {
			if (seen.has(current)) {
				break;
			}
			seen.add(current);
			const message = current.message || '';
			for (const pattern of DOWNLOAD_ERROR_PATTERNS) {
				if (message.toLowerCase().includes(pattern.toLowerCase())) {
					return current;
				}
			}
			const className =
				(current as any).originalErrorClassName || current.name;
			if (className && DOWNLOAD_ERROR_CLASS_NAMES.includes(className)) {
				return current;
			}
		}
		current = current instanceof Error ? current.cause : undefined;
		depth++;
	}
	return undefined;
}
