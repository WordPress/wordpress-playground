import { describe, expect, it } from 'vitest';
import { PHPResponse, StreamedPHPResponse } from './php-response';

/**
 * Creates a ReadableStream from a string.
 */
function streamFromString(text: string): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			if (text.length > 0) {
				controller.enqueue(new TextEncoder().encode(text));
			}
			controller.close();
		},
	});
}

/**
 * Creates a ReadableStream from a Uint8Array.
 */
function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			if (bytes.length > 0) {
				controller.enqueue(bytes);
			}
			controller.close();
		},
	});
}

/**
 * Creates an empty ReadableStream.
 */
function emptyStream(): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.close();
		},
	});
}

describe('StreamedPHPResponse', () => {
	describe('fromPHPResponse()', () => {
		it('preserves httpStatusCode, headers, body bytes, and exitCode', async () => {
			const body = new TextEncoder().encode('Hello World');
			const original = new PHPResponse(
				201,
				{ 'content-type': ['text/plain'] },
				body,
				'',
				0
			);

			const streamed = StreamedPHPResponse.fromPHPResponse(original);

			expect(await streamed.httpStatusCode).toBe(201);
			expect(await streamed.headers).toEqual({
				'content-type': ['text/plain'],
			});
			expect(await streamed.stdoutBytes).toEqual(body);
			expect(await streamed.exitCode).toBe(0);
		});

		it('handles empty body', async () => {
			const original = new PHPResponse(204, {}, new Uint8Array(0), '', 0);

			const streamed = StreamedPHPResponse.fromPHPResponse(original);

			expect(await streamed.stdoutBytes).toEqual(new Uint8Array(0));
			expect(await streamed.stdoutText).toBe('');
		});

		it('handles error responses (non-zero exit code, stderr)', async () => {
			const original = new PHPResponse(
				500,
				{},
				new TextEncoder().encode('error output'),
				'Fatal error on line 5',
				1
			);

			const streamed = StreamedPHPResponse.fromPHPResponse(original);

			expect(await streamed.httpStatusCode).toBe(500);
			expect(await streamed.exitCode).toBe(1);
			expect(await streamed.stdoutText).toBe('error output');
		});
	});

	describe('forHttpCode()', () => {
		it('returns correct status code for 404', async () => {
			const response = StreamedPHPResponse.forHttpCode(404);
			expect(await response.httpStatusCode).toBe(404);
		});

		it('returns correct status code for 500', async () => {
			const response = StreamedPHPResponse.forHttpCode(500);
			expect(await response.httpStatusCode).toBe(500);
		});

		it('returns correct status code for 502', async () => {
			const response = StreamedPHPResponse.forHttpCode(502);
			expect(await response.httpStatusCode).toBe(502);
		});

		it('includes default status text in body', async () => {
			const response = StreamedPHPResponse.forHttpCode(404);
			expect(await response.stdoutText).toBe('Not Found');
		});

		it('accepts custom text parameter', async () => {
			const response = StreamedPHPResponse.forHttpCode(
				500,
				'Custom Error'
			);
			expect(await response.stdoutText).toBe('Custom Error');
		});
	});

	describe('instance properties', () => {
		it('headers resolves to parsed headers from header stream', async () => {
			const headersJson = JSON.stringify({
				headers: ['Content-Type: text/html', 'X-Custom: value'],
				status: 200,
			});

			const streamed = new StreamedPHPResponse(
				streamFromString(headersJson),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			const headers = await streamed.headers;
			expect(headers['content-type']).toEqual(['text/html']);
			expect(headers['x-custom']).toEqual(['value']);
		});

		it('httpStatusCode resolves correctly', async () => {
			const headersJson = JSON.stringify({
				headers: [],
				status: 302,
			});

			const streamed = new StreamedPHPResponse(
				streamFromString(headersJson),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			expect(await streamed.httpStatusCode).toBe(302);
		});

		it('httpStatusCode falls back to 200 when headers stream is empty', async () => {
			const streamed = new StreamedPHPResponse(
				emptyStream(),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			expect(await streamed.httpStatusCode).toBe(200);
		});

		it('httpStatusCode falls back to 200 for unparseable headers', async () => {
			const streamed = new StreamedPHPResponse(
				streamFromString('not valid json'),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			expect(await streamed.httpStatusCode).toBe(200);
		});

		it('stdoutBytes returns correct bytes', async () => {
			const body = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

			const streamed = new StreamedPHPResponse(
				emptyStream(),
				streamFromBytes(body),
				emptyStream(),
				Promise.resolve(0)
			);

			expect(await streamed.stdoutBytes).toEqual(body);
		});

		it('stdoutText returns decoded text', async () => {
			const streamed = new StreamedPHPResponse(
				emptyStream(),
				streamFromString('Hello World'),
				emptyStream(),
				Promise.resolve(0)
			);

			expect(await streamed.stdoutText).toBe('Hello World');
		});

		it('stderrText returns decoded stderr', async () => {
			const streamed = new StreamedPHPResponse(
				emptyStream(),
				emptyStream(),
				streamFromString('Warning: something happened'),
				Promise.resolve(0)
			);

			expect(await streamed.stderrText).toBe(
				'Warning: something happened'
			);
		});

		it('ok() returns true for 200-399', async () => {
			for (const code of [200, 201, 301, 302, 399]) {
				const response = StreamedPHPResponse.forHttpCode(code);
				expect(await response.ok()).toBe(true);
			}
		});

		it('ok() returns false for 400+', async () => {
			for (const code of [400, 404, 500, 502]) {
				const response = StreamedPHPResponse.forHttpCode(code);
				expect(await response.ok()).toBe(false);
			}
		});

		it('finished resolves after exitCode settles', async () => {
			let resolveExitCode!: (value: number) => void;
			const exitCodePromise = new Promise<number>((resolve) => {
				resolveExitCode = resolve;
			});

			const streamed = new StreamedPHPResponse(
				emptyStream(),
				emptyStream(),
				emptyStream(),
				exitCodePromise
			);

			let finished = false;
			streamed.finished.then(() => {
				finished = true;
			});

			// Give microtask queue a chance to run
			await new Promise((r) => setTimeout(r, 10));
			expect(finished).toBe(false);

			resolveExitCode(0);
			await streamed.finished;
			expect(finished).toBe(true);
		});

		it('stdoutBytes caching - calling twice returns same promise', () => {
			const streamed = new StreamedPHPResponse(
				emptyStream(),
				streamFromString('test'),
				emptyStream(),
				Promise.resolve(0)
			);

			const first = streamed.stdoutBytes;
			const second = streamed.stdoutBytes;
			expect(first).toBe(second);
		});
	});

	describe('header stream parsing', () => {
		it('parses JSON header format correctly', async () => {
			const headersJson = JSON.stringify({
				headers: [
					'Content-Type: application/json',
					'X-Powered-By: PHP/8.0',
					'Set-Cookie: session=abc123',
				],
				status: 200,
			});

			const streamed = new StreamedPHPResponse(
				streamFromString(headersJson),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			const headers = await streamed.headers;
			expect(headers['content-type']).toEqual(['application/json']);
			expect(headers['x-powered-by']).toEqual(['PHP/8.0']);
			expect(headers['set-cookie']).toEqual(['session=abc123']);
			expect(await streamed.httpStatusCode).toBe(200);
		});

		it('handles malformed header stream (defaults to {} headers and 200 status)', async () => {
			const streamed = new StreamedPHPResponse(
				streamFromString('{invalid json'),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			expect(await streamed.headers).toEqual({});
			expect(await streamed.httpStatusCode).toBe(200);
		});

		it('handles empty header stream (defaults to {} headers and 200 status)', async () => {
			const streamed = new StreamedPHPResponse(
				emptyStream(),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			expect(await streamed.headers).toEqual({});
			expect(await streamed.httpStatusCode).toBe(200);
		});

		it('skips invalid header lines without colon-space separator', async () => {
			const headersJson = JSON.stringify({
				headers: [
					'Content-Type: text/html',
					'InvalidHeaderNoColon',
					'X-Valid: yes',
				],
				status: 200,
			});

			const streamed = new StreamedPHPResponse(
				streamFromString(headersJson),
				emptyStream(),
				emptyStream(),
				Promise.resolve(0)
			);

			const headers = await streamed.headers;
			expect(headers['content-type']).toEqual(['text/html']);
			expect(headers['x-valid']).toEqual(['yes']);
			expect(Object.keys(headers)).toHaveLength(2);
		});
	});
});

describe('PHPResponse', () => {
	describe('fromStreamedResponse()', () => {
		it('converts StreamedPHPResponse back to PHPResponse preserving all fields', async () => {
			const body = new TextEncoder().encode('Response body');
			const original = new PHPResponse(
				201,
				{
					'content-type': ['text/plain'],
					'x-custom': ['val1', 'val2'],
				},
				body,
				'some stderr',
				0
			);

			const streamed = StreamedPHPResponse.fromPHPResponse(original);
			const converted =
				await PHPResponse.fromStreamedResponse(streamed);

			expect(converted.httpStatusCode).toBe(201);
			expect(converted.headers).toEqual({
				'content-type': ['text/plain'],
				'x-custom': ['val1', 'val2'],
			});
			expect(converted.bytes).toEqual(body);
			expect(converted.exitCode).toBe(0);
		});

		it('round-trip: PHPResponse -> StreamedPHPResponse -> PHPResponse preserves data', async () => {
			const original = new PHPResponse(
				404,
				{ 'content-type': ['text/html'] },
				new TextEncoder().encode('Not Found'),
				'error log entry',
				1
			);

			const streamed = StreamedPHPResponse.fromPHPResponse(original);
			const roundTripped =
				await PHPResponse.fromStreamedResponse(streamed);

			expect(roundTripped.httpStatusCode).toBe(original.httpStatusCode);
			expect(roundTripped.headers).toEqual(original.headers);
			expect(roundTripped.bytes).toEqual(original.bytes);
			expect(roundTripped.errors).toBe('');
			expect(roundTripped.exitCode).toBe(original.exitCode);
			expect(roundTripped.text).toBe(original.text);
		});
	});
});
