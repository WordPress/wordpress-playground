import type {
	PHPRequest,
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
	 * Handler for requests. Returns StreamedPHPResponse for PHP requests,
	 * or PHPResponse for static files.
	 */
	handleRequest: (
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

			const response = await options.handleRequest(phpRequest);

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
 * Used for static files which are returned as PHPResponse.
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
