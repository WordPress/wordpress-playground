import type { StreamedPHPResponse } from './php-response';
import { PHPResponse } from './php-response';

export async function printDebugDetails(
	e: any,
	streamedResponse?: StreamedPHPResponse
) {
	if (streamedResponse) {
		printResponseDebugDetails(
			await PHPResponse.fromStreamedResponse(streamedResponse)
		);
	}
	await prettyPrintFullStackTrace(e);
}

/**
 * Pretty prints the full stack trace of the error and all its causes.
 * Includes debug details for each error in the chain.
 * This is needed
 *
 * @param e
 */
export async function prettyPrintFullStackTrace(e: any) {
	let current = e;
	let isFirst = true;
	while (current) {
		if (!isFirst) {
			process.stderr.write('\nCaused by:\n\n');
		}

		process.stderr.write(current.originalErrorClassName ?? current.name);
		process.stderr.write(': ' + current.message + '\n');
		process.stderr.write(
			(current.stack + '').split('\n').slice(1).join('\n')
		);
		process.stderr.write(`\n`);
		if (current.response) {
			printResponseDebugDetails(current.response);
		}
		if (current.phpLogs) {
			process.stderr.write(`\n\n==== PHP error log ====\n\n`);
			process.stderr.write(current.phpLogs);
		}
		current = current.cause;
		isFirst = false;
	}
	process.stderr.write('\n');
}

/**
 * Describe an error for display. Handles Error instances, Comlink-serialized
 * plain objects (which lose their Error prototype during worker thread
 * transfer), and arbitrary values.
 */
export function describeError(
	error: unknown,
	seen = new WeakSet<object>(),
	depth = 0,
	options: { suppressGenericErrorName?: boolean } = {}
): string {
	if (depth > 10) {
		return '[Max error cause depth exceeded]';
	}
	if (error instanceof Error) {
		if (error.message) {
			return error.message;
		}
		return describeErrorObject(error, seen, depth, {
			...options,
			suppressGenericErrorName: true,
		});
	}
	if (error && typeof error === 'object') {
		return describeErrorObject(error, seen, depth, options);
	}
	return String(error);
}

type ErrorLikeObject = object & {
	name?: unknown;
	message?: unknown;
	cause?: unknown;
	errno?: unknown;
	code?: unknown;
	stack?: unknown;
};

function describeErrorObject(
	error: ErrorLikeObject,
	seen: WeakSet<object>,
	depth: number,
	options: { suppressGenericErrorName?: boolean } = {}
): string {
	if (seen.has(error)) {
		return '[Circular error cause]';
	}
	seen.add(error);

	// Comlink-serialized errors arrive as plain objects like
	// { name: 'ErrnoError', errno: 20 } with no .message.
	const parts = [];
	if (
		error['name'] &&
		!(options.suppressGenericErrorName && error['name'] === 'Error')
	) {
		parts.push(String(error['name']));
	}
	if (error['message']) {
		parts.push(String(error['message']));
	}
	if (error['errno'] !== undefined) {
		parts.push(`errno: ${error['errno']}`);
	}
	if (error['code'] !== undefined) {
		parts.push(`code: ${error['code']}`);
	}
	if (error['cause']) {
		parts.push(
			`caused by: ${describeError(
				error['cause'],
				seen,
				depth + 1,
				options
			)}`
		);
	}
	if (parts.length > 0) {
		return parts.join(' — ');
	}
	if (typeof error['stack'] === 'string') {
		return error['stack'];
	}
	// Last resort: JSON-serialize the object so we at least see
	// what fields it has.
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

export function printResponseDebugDetails(response: PHPResponse) {
	// Print a short summary of what we have:
	process.stderr.write(
		`\n    exitCode=${response.exitCode} httpStatusCode=${response.httpStatusCode} `
	);
	const hasHeaders =
		response.headers && Object.keys(response.headers).length > 0;
	if (!hasHeaders) {
		process.stderr.write(`responseHeaders=(empty) `);
	}
	if (!response.text) {
		process.stderr.write(`stdout=(empty) `);
	}
	if (!response.errors) {
		process.stderr.write(`stderr=(empty) `);
	}
	process.stderr.write(`\n`);

	// Print all the extended information in a separate section:
	if (hasHeaders) {
		process.stderr.write(
			`\n==== PHP response headers ====\n\n${JSON.stringify(
				response.headers,
				null,
				2
			)}\n\n`
		);
	}

	if (response.text) {
		process.stderr.write(`\n==== PHP stdout ====\n\n`);
		process.stderr.write(response.text);
	}

	if (response.errors) {
		process.stderr.write(`\n==== PHP stderr ====\n\n`);
		process.stderr.write(response.errors);
	}
	process.stderr.write(`\n`);
}
