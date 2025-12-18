import { type PHPRequest, PHPResponse } from '@php-wasm/universal';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import { logger } from '@php-wasm/logger';
import http from 'http';

export interface ServerOptions {
	port: number;
	handleRequest: (request: PHPRequest) => Promise<PHPResponse>;
}

export async function startServer(options: ServerOptions) {
	const server = http.createServer();
	await new Promise<Server<typeof IncomingMessage, typeof ServerResponse>>(
		(resolve, reject) => {
			const server = http.createServer(async (req, res) => {
				let phpResponse: PHPResponse;
				try {
					phpResponse = await options.handleRequest({
						// TODO: Is there a time where req.url will not be set?
						url: req.url!,
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
			server.listen(options.port, () => {
				const address = server.address();
				if (address === null || typeof address === 'string') {
					reject(new Error('Server address is not available'));
				} else {
					resolve(server);
				}
			});
		}
	);

	return server;
}

const bufferRequestBody = async (req: IncomingMessage): Promise<Uint8Array> =>
	await new Promise((resolve) => {
		const body: Uint8Array[] = [];
		req.on('data', (chunk) => {
			body.push(chunk);
		});
		req.on('end', () => {
			resolve(new Uint8Array(Buffer.concat(body)));
		});
	});

const parseHeaders = (req: IncomingMessage): Record<string, string> => {
	const requestHeaders: Record<string, string> = {};
	if (req.rawHeaders && req.rawHeaders.length) {
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			requestHeaders[req.rawHeaders[i].toLowerCase()] =
				req.rawHeaders[i + 1];
		}
	}
	return requestHeaders;
};
