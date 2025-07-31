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
