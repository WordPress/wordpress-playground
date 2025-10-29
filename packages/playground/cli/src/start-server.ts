import { type PHPRequest, PHPResponse } from '@php-wasm/universal';
import type { Request } from 'express';
import express from 'express';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import type { RunCLIServer } from './run-cli';
import { logger } from '@php-wasm/logger';

export interface ServerOptions {
	port: number;
	onBind: (server: Server, port: number) => Promise<RunCLIServer | void>;
	handleRequest: (request: PHPRequest) => Promise<PHPResponse>;
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
		let phpResponse: PHPResponse;
		try {
			phpResponse = await options.handleRequest({
				url: req.url,
				headers: parseHeaders(req),
				method: req.method as any,
				body: await bufferRequestBody(req),
			});
		} catch (error) {
			logger.error(error);
			phpResponse = PHPResponse.forHttpCode(500);
		}

		res.statusCode = phpResponse.httpStatusCode;
		for (const key in phpResponse.headers) {
			res.setHeader(key, phpResponse.headers[key]);
		}
		res.end(phpResponse.bytes);
	});

	const address = server.address();
	const port = (address! as AddressInfo).port;
	return await options.onBind(server, port);
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
