import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import type { PHPRequest, StreamedPHPResponse } from '@php-wasm/universal';
import express from 'express';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { RunCLIServer } from './run-cli';
import { logger } from '@php-wasm/logger';
import http2 from 'http2';
import type { TlsCertificates } from './tls';

const exec = promisify(execCb);

export interface ServerOptions {
	port: number;
	onBind: (server: Server, port: number) => Promise<RunCLIServer | void>;
	/**
	 * Handler for requests. Always returns StreamedPHPResponse.
	 */
	handleRequest: (request: PHPRequest) => Promise<StreamedPHPResponse>;
	http2?: boolean;
	tlsCertificates?: TlsCertificates;
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
	const requestListener = createRequestListener(options.handleRequest);

	// TODO: Remove Express path when HTTP/2 becomes the default
	const server = options.http2
		? await startHttp2Server(options, requestListener)
		: await startExpressServer(options, requestListener);

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

type RequestListener = (
	req: { url?: string; method?: string; headers: Record<string, any> } & {
		on: (event: string, cb: (...args: any[]) => void) => void;
	},
	res: {
		statusCode: number;
		headersSent: boolean;
		setHeader: (name: string, value: string) => void;
		end: (data?: string) => void;
	} & NodeJS.WritableStream
) => Promise<void>;

function createRequestListener(
	handleRequest: ServerOptions['handleRequest']
): RequestListener {
	return async (req, res) => {
		try {
			const phpRequest: PHPRequest = {
				url: req.url ?? '/',
				headers: parseHeaders(req.headers),
				method: (req.method ?? 'GET') as any,
				body: await bufferRequestBody(req),
			};

			const response = await handleRequest(phpRequest);
			await handleStreamedResponse(response, res as any);
		} catch (error) {
			logger.error(error);
			if (!res.headersSent) {
				res.statusCode = 500;
				res.end('Internal Server Error');
			}
		}
	};
}

async function startExpressServer(
	options: ServerOptions,
	requestListener: RequestListener
): Promise<Server<typeof IncomingMessage, typeof ServerResponse>> {
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

	app.use('/', (req, res) => {
		requestListener(req, res);
	});

	return server;
}

async function startHttp2Server(
	options: ServerOptions,
	requestListener: RequestListener
): Promise<Server> {
	if (!options.tlsCertificates) {
		throw new Error('TLS certificates are required for HTTP/2.');
	}

	const server = await new Promise<http2.Http2SecureServer>(
		(resolve, reject) => {
			const h2Server = http2.createSecureServer(
				{
					key: options.tlsCertificates!.key,
					cert: options.tlsCertificates!.cert,
					allowHTTP1: true,
				},
				(req, res) => {
					requestListener(req, res);
				}
			);

			h2Server
				.listen(options.port, () => {
					const address = h2Server.address();
					if (address === null || typeof address === 'string') {
						reject(new Error('Server address is not available'));
					} else {
						resolve(h2Server);
					}
				})
				.once('error', reject);
		}
	);

	return server as unknown as Server;
}

/**
 * Handles a StreamedPHPResponse by piping the stdout stream directly
 * to the HTTP response, avoiding buffering the entire response in memory.
 */
async function handleStreamedResponse(
	streamedResponse: StreamedPHPResponse,
	res: { statusCode: number; setHeader(name: string, value: string): void } & NodeJS.WritableStream
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
	try {
		await pipeline(nodeStream, res);
	} catch (error: unknown) {
		// Ignore client-disconnect errors. These occur when the browser
		// navigates away or refreshes before the response finishes:
		// - ERR_STREAM_PREMATURE_CLOSE: stream was open but closed early
		// - ERR_STREAM_UNABLE_TO_PIPE: stream was already destroyed
		if (
			error instanceof Error &&
			'code' in error &&
			(error.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
				error.code === 'ERR_STREAM_UNABLE_TO_PIPE')
		) {
			return;
		}
		throw error;
	}
}

const bufferRequestBody = async (
	req: { on(event: string, cb: (...args: any[]) => void): void }
): Promise<Uint8Array> =>
	await new Promise((resolve) => {
		const body: Uint8Array[] = [];
		req.on('data', (chunk: Buffer) => {
			body.push(chunk);
		});
		req.on('end', () => {
			resolve(new Uint8Array(Buffer.concat(body)));
		});
	});

async function setCodespacesPortPublic(port: number, codespaceName: string) {
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

/**
 * Parses headers from an HTTP request object into a flat record.
 * Filters out HTTP/2 pseudo-headers (keys starting with `:`) since
 * PHP doesn't understand them.
 */
const parseHeaders = (
	headers: Record<string, any>
): Record<string, string> => {
	const requestHeaders: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (key.startsWith(':')) {
			continue;
		}
		if (value !== undefined) {
			requestHeaders[key.toLowerCase()] = String(value);
		}
	}
	return requestHeaders;
};
