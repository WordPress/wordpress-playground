import type { PHPRequest, StreamedPHPResponse } from '@php-wasm/universal';
import type { Request, Response } from 'express';
import express from 'express';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { RunCLIServer } from './run-cli';
import { logger } from '@php-wasm/logger';

export interface ServerOptions {
	port: number;
	onBind: (server: Server, port: number) => Promise<RunCLIServer | void>;
	/**
	 * Handler for requests. Always returns StreamedPHPResponse.
	 */
	handleRequest: (request: PHPRequest) => Promise<StreamedPHPResponse>;
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
			await handleStreamedResponse(response, res);
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

	// Cast needed: Web ReadableStream and Node.js ReadableStream types differ
	const nodeStream = Readable.fromWeb(streamedResponse.stdout as any);
	await pipeline(nodeStream, res);
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
