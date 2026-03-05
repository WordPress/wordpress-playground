import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import type { PHPRequest, StreamedPHPResponse } from '@php-wasm/universal';
import type { Request, Response } from 'express';
import express from 'express';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { RunCLIServer } from './run-cli';
import { logger } from '@php-wasm/logger';

const exec = promisify(execCb);

export interface ServerOptions {
	port: number;
	onBind: (server: Server, port: number) => Promise<RunCLIServer | void>;
	/**
	 * Handler for requests. Always returns StreamedPHPResponse.
	 */
	handleRequest: (request: PHPRequest) => Promise<StreamedPHPResponse>;
}

export function isPortInUse(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		if (port === 0) return resolve(false);

		const server = express().listen(port);

		server.once('listening', () => server.close(() => resolve(false)));
		server.once('error', (error: NodeJS.ErrnoException) =>
			resolve(error.code === 'EADDRINUSE')
		);
	});
}

export async function startServer(
	options: ServerOptions
): Promise<RunCLIServer | void> {
	const app = express();

	const server = await new Promise<
		Server<typeof IncomingMessage, typeof ServerResponse>
	>((resolve, reject) => {
		const server = app
			.listen(options.port, () => {
				const address = server.address();
				if (address === null || typeof address === 'string') {
					reject(new Error('Server address is not available'));
				} else {
					resolve(server);
				}
			})
			.once('error', reject);
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

	// Codespaces ports default to private, breaking CORS.
	// Publish once the tunnel is ready.
	const codespaceName = process.env['CODESPACE_NAME'];
	if (codespaceName) {
		setCodespacesPortPublic(port, codespaceName);
	}

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

async function setCodespacesPortPublic(
	port: number,
	codespaceName: string
) {
	logger.log(`Publishing port ${port}...`);
	const cmd = `gh codespace ports visibility ${port}:public -c ${codespaceName}`;
	for (let i = 0; i < 10; i++) {
		try {
			await exec(cmd);
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

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
