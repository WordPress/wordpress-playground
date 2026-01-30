import {
	type PHPRequest,
	PHPResponse,
	StreamedPHPResponse,
} from '@php-wasm/universal';
import type { Request, Response } from 'express';
import express from 'express';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import type { RunCLIServer } from './run-cli';
import { logger } from '@php-wasm/logger';

/**
 * Threshold in bytes above which responses are streamed.
 * Default: 100MB
 */
const STREAMING_THRESHOLD_BYTES = 100 * 1024 * 1024;

/**
 * Duck-type check for StreamedPHPResponse.
 * We can't use instanceof because objects don't preserve their prototype
 * chain when crossing Comlink worker boundaries.
 */
function isStreamedResponse(
	response: StreamedPHPResponse | PHPResponse
): response is StreamedPHPResponse {
	return (
		'stdout' in response &&
		'stderr' in response &&
		'finished' in response &&
		response.stdout instanceof ReadableStream
	);
}

export interface ServerOptions {
	port: number;
	onBind: (server: Server, port: number) => Promise<RunCLIServer | void>;
	/**
	 * Handler for streaming requests. Returns StreamedPHPResponse for
	 * large file downloads, allowing incremental processing.
	 */
	handleRequestStreamed: (
		request: PHPRequest
	) => Promise<StreamedPHPResponse | PHPResponse>;
}

export async function startServer(
	options: ServerOptions
): Promise<RunCLIServer | void> {
	const app = express();

	const server = await new Promise<
		Server<typeof IncomingMessage, typeof ServerResponse>
	>((resolve, reject) => {
		const server = app.listen(options.port, () => {
			const address = server.address();
			if (address === null || typeof address === 'string') {
				reject(new Error('Server address is not available'));
			} else {
				resolve(server);
			}
		});
	});

	app.use('/', async (req, res) => {
		try {
			const phpRequest: PHPRequest = {
				url: req.url,
				headers: parseHeaders(req),
				method: req.method as any,
				body: await bufferRequestBody(req),
			};

			const response = await options.handleRequestStreamed(phpRequest);

			// Use duck typing to detect StreamedPHPResponse since instanceof
			// doesn't work across Comlink worker boundaries
			if (isStreamedResponse(response)) {
				await handleStreamedResponse(response, res);
			} else {
				handleBufferedResponse(response as PHPResponse, res);
			}
		} catch (error) {
			logger.error(error);
			if (!res.headersSent) {
				res.statusCode = 500;
				res.end('Internal Server Error');
			}
		}
	});

	const address = server.address();
	const port = (address! as AddressInfo).port;
	return await options.onBind(server, port);
}

/**
 * Determines if a response should be streamed based on its headers.
 *
 * A response should be streamed if:
 * - It has a Content-Disposition: attachment header (file download)
 * - It has a large Content-Length (> threshold)
 * - It has a binary content type (application/octet-stream, application/zip, etc.)
 * - Content-Length is missing (unknown size - stream to be safe)
 */
function shouldStreamResponse(headers: Record<string, string[]>): boolean {
	// Check Content-Disposition for file downloads
	const contentDisposition = headers['content-disposition']?.[0] || '';
	if (contentDisposition.toLowerCase().includes('attachment')) {
		return true;
	}

	// Check Content-Length for large responses
	const contentLengthHeader = headers['content-length']?.[0];
	const contentLength = parseInt(contentLengthHeader || '0', 10);
	if (contentLength > STREAMING_THRESHOLD_BYTES) {
		return true;
	}

	// Check Content-Type for binary data
	const contentType = headers['content-type']?.[0] || '';
	const binaryTypes = [
		'application/octet-stream',
		'application/zip',
		'application/x-gzip',
		'application/x-tar',
		'application/x-rar',
		'application/x-7z-compressed',
		'application/wpress', // All-in-One WP Migration backup format
	];
	if (binaryTypes.some((type) => contentType.includes(type))) {
		return true;
	}

	// If Content-Length is missing or 0, we can't know the response size upfront.
	// Stream to be safe, since buffering an unknown-size response could fail
	// for very large responses (e.g., >2GB file downloads).
	// Only buffer when we have a small, known Content-Length.
	if (!contentLengthHeader || contentLength === 0) {
		return true;
	}

	return false;
}

/**
 * Handles a StreamedPHPResponse by piping the stdout stream directly
 * to the HTTP response, avoiding buffering the entire response in memory.
 */
async function handleStreamedResponse(
	streamedResponse: StreamedPHPResponse,
	res: Response
): Promise<void> {
	// Wait for headers to be available
	const [headers, httpStatusCode] = await Promise.all([
		streamedResponse.headers,
		streamedResponse.httpStatusCode,
	]);

	// Determine if we should actually stream or buffer based on headers
	if (!shouldStreamResponse(headers)) {
		// For small/non-file responses, buffer and send normally
		// This avoids streaming overhead for regular page requests
		try {
			const bytes = await streamedResponse.stdoutBytes;
			res.statusCode = httpStatusCode;
			for (const key in headers) {
				res.setHeader(key, headers[key]);
			}
			res.end(bytes);
		} catch (error) {
			logger.error('Error buffering response:', error);
			if (!res.headersSent) {
				res.statusCode = 500;
				res.end('Internal Server Error');
			}
		}
		return;
	}

	// Set response headers
	res.statusCode = httpStatusCode;
	for (const key in headers) {
		res.setHeader(key, headers[key]);
	}

	// Set up cleanup on client disconnect
	let streamCancelled = false;
	res.on('close', () => {
		streamCancelled = true;
	});

	// Stream the response body
	const reader = streamedResponse.stdout.getReader();
	try {
		while (!streamCancelled) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (value && value.byteLength > 0) {
				// Write chunk to response
				const writeSuccessful = res.write(value);
				if (!writeSuccessful) {
					// Backpressure: wait for drain event before continuing
					await new Promise<void>((resolve) =>
						res.once('drain', resolve)
					);
				}
			}
		}
		res.end();
	} catch (error) {
		logger.error('Error streaming response:', error);
		// If we haven't sent headers yet, we can send an error response
		if (!res.headersSent) {
			res.statusCode = 500;
			res.end('Stream error');
		} else {
			// Headers already sent, just close the connection
			res.destroy();
		}
	} finally {
		// Ensure the reader is released
		try {
			reader.releaseLock();
		} catch {
			// Ignore errors during cleanup
		}
	}

	// Wait for the PHP process to finish and check exit code
	try {
		const exitCode = await streamedResponse.exitCode;
		if (exitCode !== 0) {
			logger.warn(`PHP process exited with code ${exitCode}`);
		}
	} catch (error) {
		logger.error('Error waiting for PHP process:', error);
	}
}

/**
 * Handles a regular PHPResponse by sending the buffered response.
 */
function handleBufferedResponse(response: PHPResponse, res: Response): void {
	res.statusCode = response.httpStatusCode;
	for (const key in response.headers) {
		res.setHeader(key, response.headers[key]);
	}
	res.end(response.bytes);
}

const bufferRequestBody = async (req: Request): Promise<Uint8Array> =>
	await new Promise((resolve) => {
		const body: Uint8Array[] = [];
		req.on('data', (chunk) => {
			body.push(chunk);
		});
		req.on('end', () => {
			resolve(new Uint8Array(Buffer.concat(body)));
		});
	});

const parseHeaders = (req: Request): Record<string, string> => {
	const requestHeaders: Record<string, string> = {};
	if (req.rawHeaders && req.rawHeaders.length) {
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			requestHeaders[req.rawHeaders[i].toLowerCase()] =
				req.rawHeaders[i + 1];
		}
	}
	return requestHeaders;
};
