#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = process.argv[2];
const port = Number(process.argv[3] || 5410);

if (!directory || !Number.isInteger(port) || port <= 0) {
	console.error('Usage: serve-zips.mjs <directory> [port]');
	process.exit(1);
}

const server = createServer(async (request, response) => {
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
	response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (request.method === 'OPTIONS') {
		response.writeHead(204);
		response.end();
		return;
	}

	if (request.method !== 'GET' && request.method !== 'HEAD') {
		response.writeHead(405);
		response.end('Method not allowed');
		return;
	}

	const requestUrl = new URL(request.url ?? '/', 'http://localhost');
	const filename = getRequestedFilename(requestUrl);
	if (!/^wordpress-[A-Za-z0-9.-]+\.zip$/.test(filename)) {
		response.writeHead(404);
		response.end('Not found');
		return;
	}

	const filePath = join(directory, filename);
	let stats;
	try {
		stats = await stat(filePath);
	} catch {
		response.writeHead(404);
		response.end('Not found');
		return;
	}

	if (!stats.isFile()) {
		response.writeHead(404);
		response.end('Not found');
		return;
	}

	response.statusCode = 200;
	response.setHeader('Content-Length', stats.size);
	response.setHeader('Content-Type', 'application/zip');
	if (request.method === 'HEAD') {
		response.end();
		return;
	}
	const fileStream = createReadStream(filePath);
	fileStream.on('error', (error) => {
		if (response.headersSent) {
			response.destroy(error);
			return;
		}
		response.statusCode = 500;
		response.removeHeader('Content-Length');
		response.setHeader('Content-Type', 'text/plain');
		response.end('Failed to read file');
	});
	response.on('error', () => {
		fileStream.destroy();
	});
	fileStream.pipe(response);
});

function getRequestedFilename(requestUrl) {
	return basename(requestUrl.pathname.slice(1) || requestUrl.pathname);
}

server.listen(port, '127.0.0.1', () => {
	const script = fileURLToPath(import.meta.url);
	console.log(`${script} serving ${directory} at http://127.0.0.1:${port}/`);
});
