import fs from 'fs';
import { WPNowOptions } from './config';
import { HTTPMethod } from '@php-wasm/universal';
import express from 'express';
import fileUpload from 'express-fileupload';
import { portFinder } from './port-finder';
import { NodePHP } from '@php-wasm/node';
import startWPNow from './wp-now';
import { output } from './output';

function requestBodyToMultipartFormData(json, boundary) {
	let multipartData = '';
	const eol = '\r\n';

	for (const key in json) {
		multipartData += `--${boundary}${eol}`;
		multipartData += `Content-Disposition: form-data; name="${key}"${eol}${eol}`;
		multipartData += `${json[key]}${eol}`;
	}

	multipartData += `--${boundary}--${eol}`;
	return multipartData;
}

const requestBodyToString = async (req) =>
	await new Promise((resolve) => {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk.toString(); // convert Buffer to string
		});
		req.on('end', () => {
			resolve(body);
		});
	});

export interface WPNowServer {
	url: string;
	php: NodePHP;
	options: WPNowOptions;
}

export async function startServer(
	options: WPNowOptions = {}
): Promise<WPNowServer> {
	if (!fs.existsSync(options.projectPath)) {
		throw new Error(
			`The given path "${options.projectPath}" does not exist.`
		);
	}
	const app = express();
	app.use(fileUpload());
	const port = await portFinder.getOpenPort();
	const { php, options: wpNowOptions } = await startWPNow(options);

	app.use('/', async (req, res) => {
		try {
			const requestHeaders = {};
			if (req.rawHeaders && req.rawHeaders.length) {
				for (let i = 0; i < req.rawHeaders.length; i += 2) {
					requestHeaders[req.rawHeaders[i].toLowerCase()] =
						req.rawHeaders[i + 1];
				}
			}

			const body = requestHeaders['content-type']?.startsWith(
				'multipart/form-data'
			)
				? requestBodyToMultipartFormData(
						req.body,
						requestHeaders['content-type'].split('; boundary=')[1]
				  )
				: await requestBodyToString(req);

			const data = {
				url: req.url,
				headers: requestHeaders,
				method: req.method as HTTPMethod,
				files: Object.fromEntries(
					Object.entries((req as any).files || {}).map<any>(
						([key, file]: any) => [
							key,
							{
								key,
								name: file.name,
								size: file.size,
								type: file.mimetype,
								arrayBuffer: () => file.data.buffer,
							},
						]
					)
				),
				body: body as string,
			};
			const resp = await php.request(data);
			res.statusCode = resp.httpStatusCode;
			Object.keys(resp.headers).forEach((key) => {
				res.setHeader(key, resp.headers[key]);
			});
			res.end(resp.bytes);
		} catch (e) {
			output?.trace(e);
		}
	});

	const url = `http://localhost:${port}/`;
	app.listen(port, () => {
		output?.log(`Server running at ${url}`);
	});

	return {
		url,
		php,
		options: wpNowOptions,
	};
}
