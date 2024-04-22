import express, { Request } from 'express';
// import compression from 'compression';
// import compressible from 'compressible';
import { addTrailingSlash } from './middleware/add-trailing-slash';
import { PHPRequestHandler } from '@php-wasm/universal';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { createPhp } from './setup-php';
import { defineSiteUrl } from '@wp-playground/blueprints';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

export interface ServerOptions {
	mounts?: Mount[];
}

// function shouldCompress(_, res) {
// 	const types = res.getHeader('content-type');
// 	const type = Array.isArray(types) ? types[0] : types;
// 	return type && compressible(type);
// }

export async function startServer(options: ServerOptions) {
	const app = express();
	// app.use(compression({ filter: shouldCompress }));
	app.use(addTrailingSlash('/wp-admin'));

	const server = await new Promise<
		Server<typeof IncomingMessage, typeof ServerResponse>
	>((resolve, reject) => {
		const server = app.listen(9400, () => {
			const address = server.address();
			if (address === null || typeof address === 'string') {
				reject(new Error('Server address is not available'));
			} else {
				resolve(server);
			}
		});
	});

	const address = server.address();
	const port = (address! as AddressInfo).port;
	const absoluteUrl = `http://127.0.0.1:${port}`;
	console.log({ port });
	console.log(`Server is running on ${absoluteUrl}`);
	// open(absoluteUrl); // Open the URL in the default browser

	const requestHandler = new PHPRequestHandler({
		phpFactory: async () => await createPhp(options.mounts || []),
		documentRoot: '/wordpress',
		absoluteUrl,
	});
	const primaryPhp = await requestHandler.getPrimaryPhp();
	console.log({ primaryPhp });

	await defineSiteUrl(primaryPhp, {
		siteUrl: absoluteUrl,
	});

	console.log('PHP started', { absoluteUrl });

	app.use('/', async (req, res) => {
		const phpResponse = await requestHandler.request({
			url: req.url,
			headers: parseHeaders(req),
			method: req.method as any,
			body: await bufferRequestBody(req),
		});

		res.statusCode = phpResponse.httpStatusCode;
		for (const key in phpResponse.headers) {
			res.setHeader(key, phpResponse.headers[key]);
		}

		res.end(phpResponse.text);
	});
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
