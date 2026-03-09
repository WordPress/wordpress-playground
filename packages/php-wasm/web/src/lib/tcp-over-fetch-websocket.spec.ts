import {
	TCPOverFetchWebsocket,
	RawBytesFetch,
} from './tcp-over-fetch-websocket';
import express, { type Express } from 'express';
import http from 'http';
import https from 'https';
import tls from 'tls';
import { Duplex } from 'stream';
import type { AddressInfo } from 'net';
import zlib from 'zlib';
import { generateCertificate as generateCACertificate } from './tls/certificates';
import type { GeneratedCertificate } from './tls/certificates';
import {
	generateCertificate,
	cleanupCertificate,
} from './test-utils/generate-certificate';

const pygmalion = `PREFACE TO PYGMALION.

A Professor of Phonetics.

As will be seen later on, Pygmalion needs, not a preface, but a sequel,
which I have supplied in its due place. The English have no respect for
their language, and will not teach their children to speak it. They
spell it so abominably that no man can teach himself what it sounds
like. It is impossible for an Englishman to open his mouth without
making some other Englishman hate or despise him. German and Spanish
are accessible to foreigners: English is not accessible even to
Englishmen. The reformer England needs today is an energetic phonetic
enthusiast: that is why I have made such a one the hero of a popular
play. There have been heroes of that kind crying in the wilderness for
many years past. When I became interested in the subject towards the
end of the eighteen-seventies, Melville Bell was dead; but Alexander J.
Ellis was still a living patriarch, with an impressive head always
covered by a velvet skull cap, for which he would apologize to public
meetings in a very courtly manner. He and Tito Pagliardini, another
phonetic veteran, were men whom it was impossible to dislike. Henry
Sweet, then a young man, lacked their sweetness of character: he was
about as conciliatory to conventional mortals as Ibsen or Samuel
Butler. His great ability as a phonetician (he was, I think, the best
of them all at his job) would have entitled him to high official
recognition, and perhaps enabled him to popularize his subject, but for
his Satanic contempt for all academic dignitaries and persons in
general who thought more of Greek than of phonetics. Once, in the days
when the Imperial Institute rose in South Kensington, and Joseph
Chamberlain was booming the Empire, I induced the editor of a leading
monthly review to commission an article from Sweet on the imperial
importance of his subject. When it arrived, it contained nothing but a
savagely derisive attack on a professor of language and literature
whose chair Sweet regarded as proper to a phonetic expert only. The
article, being libelous, had to be returned as impossible; and I had to
renounce my dream of dragging its author into the limelight. When I met
him afterwards, for the first time for many years, I found to my
astonishment that he, who had been a quite tolerably presentable young
man, had actually managed by sheer scorn to alter his personal
appearance until he had become a sort of walking repudiation of Oxford
and all its traditions. It must have been largely in his own despite
that he was squeezed into something called a Readership of phonetics
there. The future of phonetics rests probably with his pupils, who all
swore by him; but nothing could bring the man himself into any sort of
compliance with the university, to which he nevertheless clung by
divine right in an intensely Oxonian way. I daresay his papers, if he
has left any, include some satires that may be published without too
destructive results fifty years hence. He was, I believe, not in the
least an ill-natured man: very much the opposite, I should say; but he
would not suffer fools gladly.`;

function createTestApp(): Express {
	const app = express();

	// Set up all routes BEFORE creating the server
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

	app.get('/gzipped', (req, res) => {
		const gzip = zlib.createGzip();
		gzip.write(pygmalion);
		gzip.end();

		const gzippedChunks: Uint8Array[] = [];
		gzip.on('data', (chunk) => {
			gzippedChunks.push(chunk);
		});
		gzip.on('end', () => {
			const length = gzippedChunks.reduce(
				(acc, chunk) => acc + chunk.length,
				0
			);
			res.setHeader('Content-Encoding', 'gzip');
			res.setHeader('Content-Length', length.toString());
			for (const chunk of gzippedChunks) {
				res.write(chunk);
			}
			res.end();
		});
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

	app.post('/upload', (req, res) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			const body = Buffer.concat(chunks).toString('utf-8');
			res.json({
				contentType: req.headers['content-type'] || '',
				bodyLength: body.length,
				body,
			});
		});
	});

	app.get('/error', (req, res) => {
		res.status(500).send('Internal Server Error');
	});

	return app;
}

describe('TCPOverFetchWebsocket', () => {
	let server: https.Server;
	let host: string;
	let port: number;
	let CAroot: GeneratedCertificate;
	let originalRejectUnauthorized: string | undefined;

	beforeAll(async () => {
		// Allow self-signed certificates for testing
		originalRejectUnauthorized =
			process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
		process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

		CAroot = await generateCACertificate({
			subject: {
				countryName: 'US',
				organizationName: 'Test CA',
				commonName: 'test-ca.local',
			},
			basicConstraints: {
				ca: true,
			},
		});

		const app = createTestApp();
		const { cert, key } = await generateCertificate();
		server = https.createServer({ cert, key }, app);

		// Wait for server to start listening
		await new Promise<void>((resolve) => {
			server.listen(0, () => resolve());
		});

		const address = server.address() as AddressInfo;
		host = '127.0.0.1';
		port = address.port;
	});

	afterAll(() => {
		server.close();
		cleanupCertificate();
		// Restore original NODE_TLS_REJECT_UNAUTHORIZED value
		if (originalRejectUnauthorized !== undefined) {
			process.env['NODE_TLS_REJECT_UNAUTHORIZED'] =
				originalRejectUnauthorized;
		} else {
			delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
		}
	});

	it('should handle a simple HTTPS request via TLS path', async () => {
		const socket = new TCPOverFetchWebsocket(
			`ws://playground.internal/?host=${host}&port=443`,
			[],
			{ CAroot, outputType: 'stream' }
		);

		const duplexStream = new Duplex({
			read() {},
			write(chunk, encoding, callback) {
				socket.send(chunk);
				callback();
			},
		});

		const reader = socket.clientDownstream.readable.getReader();
		(async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						duplexStream.push(null);
						break;
					}
					duplexStream.push(value);
				}
			} catch {
				duplexStream.destroy();
			}
		})();

		const crypto = await import('crypto');
		const tlsSocket = tls.connect({
			socket: duplexStream,
			rejectUnauthorized: false,
			secureOptions:
				crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
		});

		const response = await new Promise<string>((resolve, reject) => {
			let data = '';

			tlsSocket.on('secureConnect', () => {
				const request = `GET /simple HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`;
				tlsSocket.write(request);
			});

			tlsSocket.on('data', (chunk) => {
				data += chunk.toString();
				if (data.includes('Hello, World!')) {
					tlsSocket.end();
					resolve(data);
				}
			});

			tlsSocket.on('error', reject);
			tlsSocket.on('end', () => resolve(data));
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Hello, World!');
	});
});

describe('TCPOverFetchWebsocket over HTTP', () => {
	let server: http.Server;
	let host: string;
	let port: number;

	beforeAll(async () => {
		const app = createTestApp();
		server = http.createServer(app);

		await new Promise<void>((resolve) => {
			server.listen(0, () => resolve());
		});

		const address = server.address() as AddressInfo;
		host = `127.0.0.1`;
		port = address.port;
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
		expect(response).toContain('Part 1');
		expect(response).toContain('Part 2');
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
		expect(response.length).toBeGreaterThanOrEqual(largePayload.length);
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
		// The body is fully buffered before fetch() is called (HTTP/1.1
		// compatibility), so we send all parts up front and then read
		// the complete response.
		const bodyParts = ['Part 1', 'Part 2', 'Part 3'];
		const fullBody = bodyParts.join('');
		const socket = new TCPOverFetchWebsocket(
			`ws://playground.internal/?host=${host}&port=${port}`,
			[],
			{ outputType: 'stream' }
		);
		const headers = `POST /echo HTTP/1.1\r\nHost: ${host}:${port}\r\nContent-Length: ${fullBody.length}\r\n\r\n`;
		socket.send(new TextEncoder().encode(headers));
		for (const part of bodyParts) {
			socket.send(new TextEncoder().encode(part));
		}

		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain(fullBody);
	});

	it('should handle a multipart/form-data POST request', async () => {
		const boundary = '----curlTestBoundary123';
		const fileContent = 'Hello from CURLFile upload test!';
		const body = [
			`--${boundary}\r\n`,
			`Content-Disposition: form-data; name="field1"\r\n\r\n`,
			`value1\r\n`,
			`--${boundary}\r\n`,
			`Content-Disposition: form-data; name="myfile"; filename="test.txt"\r\n`,
			`Content-Type: text/plain\r\n\r\n`,
			`${fileContent}\r\n`,
			`--${boundary}--\r\n`,
		].join('');

		const socket = await makeRequest({
			host,
			port,
			path: '/upload',
			method: 'POST',
			body,
			additionalHeaders: `Content-Type: multipart/form-data; boundary=${boundary}\r\n`,
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain(fileContent);
		expect(response).toContain('multipart/form-data');
	});

	it('should handle a multipart POST with Expect: 100-continue (body sent only after 100 Continue)', async () => {
		const boundary = '----curlTestBoundary456';
		const fileContent = 'File content sent after 100 Continue';
		const body = [
			`--${boundary}\r\n`,
			`Content-Disposition: form-data; name="file"; filename="delayed.txt"\r\n`,
			`Content-Type: text/plain\r\n\r\n`,
			`${fileContent}\r\n`,
			`--${boundary}--\r\n`,
		].join('');

		const contentType = `multipart/form-data; boundary=${boundary}`;
		const headers =
			`POST /upload HTTP/1.1\r\n` +
			`Host: ${host}:${port}\r\n` +
			`Content-Type: ${contentType}\r\n` +
			`Content-Length: ${body.length}\r\n` +
			`Expect: 100-continue\r\n` +
			`\r\n`;

		const socket = new TCPOverFetchWebsocket(
			`ws://playground.internal/?host=${host}&port=${port}`,
			[],
			{ outputType: 'stream' }
		);

		// Faithfully simulate curl's Expect: 100-continue behavior:
		// 1. Send headers only
		// 2. Wait for the "100 Continue" response before sending the body
		// 3. Only then send the body
		// If the code doesn't send 100 Continue back, this test will
		// deadlock and time out — proving the fix is necessary.
		socket.send(new TextEncoder().encode(headers));

		// Read from downstream until we see "100 Continue"
		const downstreamReader = socket.clientDownstream.readable.getReader();
		let accumulated = '';
		while (!accumulated.includes('100 Continue')) {
			const { done, value } = await downstreamReader.read();
			if (done) {
				throw new Error('Stream closed before receiving 100 Continue');
			}
			accumulated += new TextDecoder().decode(value);
		}
		downstreamReader.releaseLock();

		// Now send the body, just like curl would after receiving 100 Continue
		socket.send(new TextEncoder().encode(body));

		// Buffer the rest of the response (after the 100 Continue)
		const restOfResponse = await new Promise<string>((resolve, reject) => {
			let response = accumulated;
			socket.clientDownstream.readable
				.pipeTo(
					new WritableStream({
						write(chunk) {
							response += new TextDecoder().decode(chunk);
						},
						close() {
							resolve(response);
						},
						abort(error) {
							reject(error);
						},
					})
				)
				.catch(reject);
		});
		expect(restOfResponse).toContain('HTTP/1.1 200 OK');
		expect(restOfResponse).toContain(fileContent);
		expect(restOfResponse).toContain('multipart/form-data');
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

	it('should handle a gzipped response', async () => {
		const socket = await makeRequest({
			host,
			port,
			path: '/gzipped',
			outputType: 'stream',
		});
		const response = await bufferResponse(socket);
		expect(response).toContain('HTTP/1.1 200 OK');
		// Confirm we're using transfer-encoding: chunked
		expect(response).not.toContain('content-length');
		expect(response).toContain('transfer-encoding: chunked');
		// The browser decompresses the body, so Content-Encoding must
		// be stripped to avoid telling PHP the body is still compressed.
		expect(response).not.toContain('content-encoding');

		// Confirm the response is not truncated
		expect(response.length).toBeGreaterThan(pygmalion.length);
		expect(response).toContain(pygmalion.slice(-100));
	});
});

describe('TCPOverFetchWebsocket with CORS proxy', () => {
	let targetServer: http.Server;
	let corsProxyServer: http.Server;
	let targetPort: number;
	let corsProxyPort: number;

	beforeAll(async () => {
		// Target server that echoes the POST body
		const targetApp = createTestApp();
		targetServer = http.createServer(targetApp);
		await new Promise<void>((resolve) => {
			targetServer.listen(0, () => resolve());
		});
		targetPort = (targetServer.address() as AddressInfo).port;

		// Mock CORS proxy: rewrites the target URL to our local server
		// and forwards the request. In real life, the CORS proxy would
		// forward to the original URL, but since we use a fake hostname
		// to trigger the proxy path, we need to rewrite to localhost.
		const proxyApp = express();
		proxyApp.post('*', (req, res) => {
			// Extract the path from the target URL embedded in the
			// request URL. E.g., /https://remote-server.example/upload → /upload
			let targetPath = '/';
			try {
				const embeddedUrl = new URL(req.url.slice(1));
				targetPath = embeddedUrl.pathname;
			} catch {
				targetPath = '/';
			}

			// Forward to the local target server
			const targetReq = http.request(
				`http://127.0.0.1:${targetPort}${targetPath}`,
				{
					method: 'POST',
					headers: {
						'content-type':
							req.headers['content-type'] || 'text/plain',
					},
				},
				(targetRes) => {
					res.setHeader('X-Playground-Cors-Proxy', 'true');
					res.writeHead(targetRes.statusCode || 200);
					targetRes.pipe(res);
				}
			);
			req.pipe(targetReq);
			targetReq.on('error', (err) => {
				res.setHeader('X-Playground-Cors-Proxy', 'true');
				res.writeHead(502);
				res.end('Bad Gateway: ' + err.message);
			});
		});
		corsProxyServer = http.createServer(proxyApp);
		await new Promise<void>((resolve) => {
			corsProxyServer.listen(0, () => resolve());
		});
		corsProxyPort = (corsProxyServer.address() as AddressInfo).port;
	});

	afterAll(() => {
		targetServer.close();
		corsProxyServer.close();
	});

	it('should handle Expect: 100-continue through CORS proxy', async () => {
		const boundary = '----curlTestBoundary789';
		const fileContent = 'CURLFile content through CORS proxy!';
		const body = [
			`--${boundary}\r\n`,
			`Content-Disposition: form-data; name="file"; filename="proxy-test.txt"\r\n`,
			`Content-Type: text/plain\r\n\r\n`,
			`${fileContent}\r\n`,
			`--${boundary}--\r\n`,
		].join('');

		const corsProxyUrl = `http://127.0.0.1:${corsProxyPort}/`;
		const contentType = `multipart/form-data; boundary=${boundary}`;

		// Use a non-localhost Host header so that fetchWithCorsProxy
		// doesn't bypass the proxy. The direct fetch to this fake host
		// will fail (DNS error), triggering the CORS proxy path.
		const fakeHost = 'remote-server.example';
		const headers =
			`POST /upload HTTP/1.1\r\n` +
			`Host: ${fakeHost}\r\n` +
			`Content-Type: ${contentType}\r\n` +
			`Content-Length: ${body.length}\r\n` +
			`Expect: 100-continue\r\n` +
			`\r\n`;

		const socket = new TCPOverFetchWebsocket(
			`ws://playground.internal/?host=${fakeHost}&port=80`,
			[],
			{ corsProxyUrl, outputType: 'stream' }
		);

		// Send headers first (simulating curl Expect: 100-continue)
		socket.send(new TextEncoder().encode(headers));

		// Wait for the 100 Continue response before sending body
		const downstreamReader = socket.clientDownstream.readable.getReader();
		let accumulated = '';
		while (!accumulated.includes('100 Continue')) {
			const { done, value } = await downstreamReader.read();
			if (done) {
				throw new Error(
					'Stream closed before receiving 100 Continue. Got: ' +
						accumulated
				);
			}
			accumulated += new TextDecoder().decode(value);
		}
		downstreamReader.releaseLock();

		// Now send the body, just like curl would after receiving 100 Continue
		socket.send(new TextEncoder().encode(body));

		// Buffer the rest of the response
		const restOfResponse = await new Promise<string>((resolve, reject) => {
			let response = accumulated;
			socket.clientDownstream.readable
				.pipeTo(
					new WritableStream({
						write(chunk) {
							response += new TextDecoder().decode(chunk);
						},
						close() {
							resolve(response);
						},
						abort(error) {
							reject(error);
						},
					})
				)
				.catch(reject);
		});
		expect(restOfResponse).toContain('HTTP/1.1 200');
		expect(restOfResponse).toContain(fileContent);
		expect(restOfResponse).toContain('multipart/form-data');
	});
});

describe('RawBytesFetch', () => {
	it('fetchRawResponseBytes should strip content-encoding from response headers', async () => {
		// Simulate a response where the browser has already decompressed
		// the body but the Content-Encoding header is still present.
		const bodyText = 'decompressed body content';
		const mockResponse = new Response(bodyText, {
			status: 200,
			statusText: 'OK',
			headers: {
				'Content-Type': 'text/plain',
				'Content-Encoding': 'br',
				'X-Custom': 'kept',
			},
		});

		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => mockResponse;
		try {
			const stream = RawBytesFetch.fetchRawResponseBytes(
				new Request('https://example.com/test')
			);
			const reader = stream.getReader();
			let raw = '';
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				raw += new TextDecoder().decode(value);
			}

			// The raw HTTP response should NOT contain content-encoding
			const headerSection = raw.split('\r\n\r\n')[0].toLowerCase();
			expect(headerSection).not.toContain('content-encoding');
			// Other headers should still be present
			expect(headerSection).toContain('x-custom: kept');
			expect(headerSection).toContain('transfer-encoding: chunked');
			// Body should be present (chunked encoded)
			expect(raw).toContain(bodyText);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('parseHttpRequest should handle an transfer-encoding: chunked POST requests', async () => {
		const encodedBodyBytes = 'abcde';
		const encodedChunkedBodyBytes = `${encodedBodyBytes.length}\r\n${encodedBodyBytes}\r\n0\r\n\r\n`;
		const requestBytes = `POST /echo HTTP/1.1\r\nHost: playground.internal\r\ntransfer-encoding: chunked\r\n\r\n${encodedChunkedBodyBytes}`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'playground.internal',
			'http'
		);
		const parsedRequestBody = await request.body?.getReader().read();
		const decodedRequestBody = new TextDecoder().decode(
			parsedRequestBody?.value
		);
		expect(decodedRequestBody).toEqual(encodedBodyBytes);
	});

	it('parseHttpRequest should handle a path and query string', async () => {
		const requestBytes = `GET /core/version-check/1.7/?channel=beta HTTP/1.1\r\nHost: playground.internal\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'playground.internal',
			'http'
		);
		expect(request.url).toEqual(
			'http://playground.internal/core/version-check/1.7/?channel=beta'
		);
	});

	it('parseHttpRequest should handle a simple path without query string', async () => {
		const requestBytes = `GET /api/users HTTP/1.1\r\nHost: example.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'example.com',
			'http'
		);
		expect(request.url).toEqual('http://example.com/api/users');
	});

	it('parseHttpRequest should handle root path', async () => {
		const requestBytes = `GET / HTTP/1.1\r\nHost: example.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'example.com',
			'https'
		);
		expect(request.url).toEqual('https://example.com/');
	});

	it('parseHttpRequest should handle URL-encoded characters in path', async () => {
		const requestBytes = `GET /search/hello%20world HTTP/1.1\r\nHost: example.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'example.com',
			'http'
		);
		expect(request.url).toEqual('http://example.com/search/hello%20world');
	});

	it('parseHttpRequest should handle URL-encoded characters in query string', async () => {
		const requestBytes = `GET /search?q=hello+world&filter=a%26b HTTP/1.1\r\nHost: example.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'example.com',
			'http'
		);
		expect(request.url).toEqual(
			'http://example.com/search?q=hello+world&filter=a%26b'
		);
	});

	it('parseHttpRequest should handle empty query parameter values', async () => {
		const requestBytes = `GET /api?key1=&key2=value2 HTTP/1.1\r\nHost: example.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'example.com',
			'http'
		);
		expect(request.url).toEqual('http://example.com/api?key1=&key2=value2');
	});

	it('parseHttpRequest should handle path with hash fragment', async () => {
		// Note: Hash fragments are typically not sent in HTTP requests,
		// but if they are, the URL constructor should handle them
		const requestBytes = `GET /page#section HTTP/1.1\r\nHost: example.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'example.com',
			'http'
		);
		expect(request.url).toEqual('http://example.com/page#section');
	});

	it('parseHttpRequest should handle path with query and hash', async () => {
		const requestBytes = `GET /page?param=value#section HTTP/1.1\r\nHost: example.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'example.com',
			'http'
		);
		expect(request.url).toEqual(
			'http://example.com/page?param=value#section'
		);
	});

	it('parseHttpRequest should preserve Host header over default host', async () => {
		const requestBytes = `GET /api HTTP/1.1\r\nHost: custom.host.com\r\n\r\n`;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(requestBytes));
					controller.close();
				},
			}),
			'default.host.com', // Different from Host header
			'https'
		);
		// Should use the Host header, not the default host parameter
		expect(request.url).toEqual('https://custom.host.com/api');
	});

	/**
	 * Regression test: when the full body arrives with the headers
	 * in a single chunk (small POST bodies without Expect:
	 * 100-continue), the body stream must close immediately.
	 * Previously, pull() would block forever waiting for upstream
	 * data that would never arrive, causing a deadlock when the
	 * consumer tried to read the full body (e.g. arrayBuffer()).
	 */
	it('parseHttpRequest should close body stream when full body arrives with headers', async () => {
		const body = 'hello=world&from=playground';
		const requestBytes =
			`POST /echo HTTP/1.1\r\n` +
			`Host: example.com\r\n` +
			`Content-Length: ${body.length}\r\n` +
			`\r\n` +
			body;
		const { request } = await RawBytesFetch.parseHttpRequest(
			new ReadableStream({
				start(controller) {
					// Send headers + body in a single chunk, then
					// leave the stream open (simulating a keep-alive
					// connection that doesn't close after the request).
					controller.enqueue(new TextEncoder().encode(requestBytes));
				},
			}),
			'example.com',
			'http'
		);
		// This must resolve quickly. Before the fix, it would hang
		// forever because the body stream's pull() waited for data
		// from the upstream that never arrived.
		const requestBody = await new Response(request.body).text();
		expect(requestBody).toEqual(body);
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

async function bufferResponse(socket: TCPOverFetchWebsocket): Promise<string> {
	return new Promise((resolve, reject) => {
		let response = '';

		// Add error listener
		socket.on('error', (error) => {
			reject(error);
		});

		socket.clientDownstream.readable
			.pipeTo(
				new WritableStream({
					write(chunk) {
						response += new TextDecoder().decode(chunk);
					},
					close() {
						resolve(response);
					},
					abort(error) {
						reject(error);
					},
				})
			)
			.catch((error) => {
				reject(error);
			});
	});
}
