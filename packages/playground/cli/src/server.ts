import express, { Request } from 'express';
import { PHPRequest, PHPResponse } from '@php-wasm/universal';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';

export interface ServerOptions {
	port: number;
	onBind: (port: number) => Promise<any>;
	handleRequest: (request: PHPRequest) => Promise<PHPResponse>;
}

export async function startServer(options: ServerOptions) {
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
		const phpResponse = await options.handleRequest({
			url: req.url,
			headers: parseHeaders(req),
			method: req.method as any,
			body: await bufferRequestBody(req),
		});

		res.statusCode = phpResponse.httpStatusCode;
		for (const key in phpResponse.headers) {
			res.setHeader(key, phpResponse.headers[key]);
		}
		res.end(phpResponse.bytes);
	});

	const address = server.address();
	const port = (address! as AddressInfo).port;
	await options.onBind(port);
}

const bufferRequestBody = async (req: Request): Promise<Uint8Array> =>
	await new Promise((resolve) => {
		const body: Uint8Array[] = [];
		req.on('data', (chunk) => {
			body.push(chunk);
		});
		req.on('end', () => {
			resolve(Buffer.concat(body));
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
