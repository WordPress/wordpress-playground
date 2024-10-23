import { TCPOverFetchWebsocket } from './tcp-over-fetch-websocket';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

describe('TCPOverFetchWebsocket', () => {
	let server: http.Server;
	let host: string;
	let port: number;

	beforeAll(async () => {
		const app = express();
		server = app.listen(0);
		const address = server.address() as AddressInfo;
		host = `127.0.0.1`;
		port = address.port;
		app.get('/simple', (req, res) => {
			res.send('Hello, World!');
		});

		app.get('/slow', (req, res) => {
			setTimeout(() => {
				res.send('Slow response');
			}, 1000);
		});

		app.get('/stream', (req, res) => {
			res.flushHeaders();
			res.write('Part 1');
			setTimeout(() => {
				res.write('Part 2');
				res.end();
			}, 1500);
		});

		app.get('/headers', (req, res) => {
			res.set('X-Custom-Header', 'TestValue');
			res.send('OK');
		});

		app.post('/echo', (req, res) => {
			// Set appropriate headers
			res.setHeader(
				'Content-Type',
				req.headers['content-type'] || 'text/plain'
			);
			res.setHeader('Transfer-Encoding', 'chunked');
			// Create readable stream from request body
			const stream = req;

			// Pipe the input stream directly to the response
			stream.pipe(res);

			// Handle errors
			stream.on('error', (error) => {
				console.error('Stream error:', error);
				res.status(500).end();
			});
		});

		app.get('/error', (req, res) => {
			res.status(500).send('Internal Server Error');
		});
	});

	afterAll(() => {
		server.close();
	});

	it('should handle a simple HTTP request', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/simple',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Hello, World!');
	});

	it('should handle a slow response', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/slow',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Slow response');
	});

	it('should handle a streaming response', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/stream',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Part 1Part 2');
	});

	it('should handle an error response', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/error',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 500 Internal Server Error');
		expect(response).toContain('Internal Server Error');
	});

	it('should handle a request with a large payload', async () => {
		const largePayload = 'X'.repeat(1024 * 1024); // 1MB of data
		const socket = await makeRequest({
			host,
			port,
			path: '/echo',
			method: 'POST',
			body: largePayload,
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain(largePayload);
	});

	it('should handle a basic POST request', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/echo',
			method: 'POST',
			body: 'Hello, World!',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Hello, World!');
	});

	it('should handle a request with paused streaming', async () => {
		const socket = new TCPOverFetchWebsocket(
			`ws://playground.internal/?host=${host}&port=${port}`,
			[],
			{ outputType: 'stream' }
		);
		const headers = `POST /echo HTTP/1.1\r\nHost: ${host}:${port}\r\nContent-Length: 18\r\n\r\n`;
		socket.send(new TextEncoder().encode(headers));
		socket.send(new TextEncoder().encode(`Part 1`));

		const responseStream = socket.clientDownstream.readable.pipeThrough(
			new TextDecoderStream()
		);

		const reader = responseStream.getReader();

		const responseHeaders = await reader.read();
		expect(responseHeaders.value).toContain('HTTP/1.1 200 OK');
		expect(responseHeaders.done).toBe(false);

		const responseBodyPart1 = await reader.read();
		expect(responseBodyPart1.value).toContain('Part 1');
		expect(responseBodyPart1.done).toBe(false);

		// Wait for a bit, ensure the connection remains open
		await new Promise((resolve) => setTimeout(resolve, 500));

		socket.send(new TextEncoder().encode(`Part 2`));
		const responseBodyPart2 = await reader.read();
		expect(responseBodyPart2.value).toContain('Part 2');
		expect(responseBodyPart2.done).toBe(false);

		socket.send(new TextEncoder().encode(`Part 3`));
		const responseBodyPart3 = await reader.read();
		expect(responseBodyPart3.done).toBe(false);
		expect(responseBodyPart3.value).toContain('Part 3');

		const responseBodyPart4 = await reader.read();
		expect(responseBodyPart4.done).toBe(true);
	});

	it('should handle a non-existent endpoint', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/non-existent',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 404 Not Found');
	});

	it('should handle a malformed request', async () => {
		const socket = new TCPOverFetchWebsocket(
			`ws://playground.internal/?host=${host}&port=${port}`,
			[]
		);

		const promise = new Promise((resolve) => {
			socket.on('error', (error) => {
				resolve(error);
			});
		});
		socket.send(new TextEncoder().encode('INVALID REQUEST\r\n\r\n'));
		expect(promise).resolves.toEqual(new Error('Unsupported protocol'));
	});

	it('should handle connection to a non-existent server', async () => {
		const badHost = 'non-existent-server.local';
		const badPort = 1;
		const socket = new TCPOverFetchWebsocket(
			`ws://playground.internal/?host=${badHost}&port=${badPort}`,
			[]
		);
		const promise = new Promise((resolve) => {
			socket.on('error', (error) => {
				resolve(error);
			});
		});
		const request = `GET /non-existent HTTP/1.1\r\nHost: ${badHost}:${badPort}\r\n\r\n`;
		socket.send(new TextEncoder().encode(request));

		await expect(promise).resolves.toEqual(new Error('ECONNREFUSED'));
	});

	it('should handle a request with custom headers', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/headers',
			method: 'GET',
			additionalHeaders: 'X-Custom-Header: TestValue\r\n',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('x-custom-header: TestValue');
	});
});

type MakeRequestOptions = {
	host: string;
	port: number;
	path: string;
	method?: string;
	body?: string;
	additionalHeaders?: string;
	outputType?: 'messages' | 'stream';
};
async function makeRequest({
	host,
	port,
	path,
	method = 'GET',
	body = '',
	additionalHeaders = '',
	outputType = 'messages',
}: MakeRequestOptions) {
	const socket = new TCPOverFetchWebsocket(
		`ws://playground.internal/?host=${host}&port=${port}`,
		[],
		{ outputType }
	);
	const request = `${method} ${path} HTTP/1.1\r\nHost: ${host}:${port}\r\n${additionalHeaders}${
		body ? `Content-Length: ${body.length}\r\n` : ''
	}\r\n${body}`;
	socket.send(new TextEncoder().encode(request));
	return socket;
}

async function bufferResponse(socket: TCPOverFetchWebsocket) {
	return new Promise((resolve) => {
		let response = '';
		socket.clientDownstream.readable.pipeTo(
			new WritableStream({
				write(chunk) {
					response += new TextDecoder().decode(chunk);
				},
				close() {
					resolve(response);
				},
			})
		);
	});
}
