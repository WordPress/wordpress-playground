import fs from 'fs';
import WPNow, { WPNowOptions } from './wp-now';
import { HTTPMethod } from '@php-wasm/universal';
import express from 'express';
import fileUpload from 'express-fileupload';
import { portFinder } from './port-finder';
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';

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
	wpNow: WPNow;
}

function openInDefaultBrowser(port: number) {
	const url = `http://127.0.0.1:${port}`;
	let cmd: string, args: string[] | SpawnOptionsWithoutStdio;
	switch (process.platform) {
		case 'darwin':
			cmd = 'open';
			args = [url];
			break;
		case 'linux':
			cmd = 'xdg-open';
			args = [url];
			break;
		case 'win32':
			cmd = 'cmd';
			args = ['/c', `start ${url}`];
			break;
		default:
			console.log(`Platform '${process.platform}' not supported`);
			return;
	}
	spawn(cmd, args);
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
	const wpNow = await WPNow.create(options);
	await wpNow.start();

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
			const resp = await wpNow.php.request(data);
			res.statusCode = resp.httpStatusCode;
			Object.keys(resp.headers).forEach((key) => {
				res.setHeader(key, resp.headers[key]);
			});
			res.end(resp.bytes);
		} catch (e) {
			console.trace(e);
		}
	});

	const url = `http://127.0.0.1:${port}/`;
	app.listen(port, () => {
		console.log(`Server running at ${url}`);
		openInDefaultBrowser(port);
	});

	return {
		url,
		wpNow,
	};
}
