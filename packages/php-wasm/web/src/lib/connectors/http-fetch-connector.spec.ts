import {
	createHttpConnector,
	type HttpFetchConnectorOptions,
} from './http-fetch-connector';
import express from 'express';
import type http from 'http';
import type { AddressInfo } from 'net';
import zlib from 'zlib';
import { concatUint8Arrays } from '@php-wasm/util';
import * as fetchWithCorsProxyModule from '../fetch-with-cors-proxy';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

afterEach(() => {
	vi.restoreAllMocks();
});

describe('createHttpConnector', () => {
	let server: http.Server;
	let host: string;
	let port: number;

	beforeAll(async () => {
		const app = express();
		server = app.listen(0);
		const address = server.address() as AddressInfo;
		host = '127.0.0.1';
		port = address.port;

		app.get('/simple', (_req, res) => {
			res.send('Hello, World!');
		});

		app.get('/slow', (_req, res) => {
			setTimeout(() => {
				res.send('Slow response');
			}, 1000);
		});

		app.get('/stream', (_req, res) => {
			res.flushHeaders();
			res.write('Part 1');
			setTimeout(() => {
				res.write('Part 2');
				res.end();
			}, 1500);
		});

		app.get('/headers', (_req, res) => {
			res.set('X-Custom-Header', 'TestValue');
			res.send('OK');
		});

		app.get('/gzipped', (_req, res) => {
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
			const contentType =
				req.headers['content-type'] || 'text/plain; charset=utf-8';
			res.setHeader('Content-Type', contentType);
			res.setHeader('Transfer-Encoding', 'chunked');
			req.pipe(res);
			req.on('error', () => {
				res.status(500).end();
			});
		});

		app.get('/error', (_req, res) => {
			res.status(500).send('Internal Server Error');
		});
	});

	afterAll(() => {
		server.close();
	});

	it('should handle a simple HTTP request', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/simple',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Hello, World!');
	});

	it('should handle a slow response', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/slow',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Slow response');
	});

	it('should handle a streaming response', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/stream',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Part 1');
		expect(response).toContain('Part 2');
	});

	it('should handle an error response', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/error',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 500 Internal Server Error');
		expect(response).toContain('Internal Server Error');
	});

	it('should handle a large POST payload', async () => {
		const largePayload = 'X'.repeat(1024 * 1024);
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				method: 'POST',
				path: '/echo',
				hostHeader: `${host}:${port}`,
				body: largePayload,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response.length).toBeGreaterThanOrEqual(largePayload.length);
	});

	it('should forward POST request bodies', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				method: 'POST',
				path: '/echo',
				hostHeader: `${host}:${port}`,
				body: 'Hello, World!',
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Hello, World!');
	});

	it('should handle a request with paused streaming', async () => {
		const totalBody = 'Part 1Part 2Part 3';
		const headers = buildHttpRequest({
			method: 'POST',
			path: '/echo',
			hostHeader: `${host}:${port}`,
			body: '',
			additionalHeaders: `Content-Length: ${totalBody.length}\r\n`,
			skipContentLength: true,
		});
		const response = await runConnector({
			connectionHost: host,
			connectionPort: port,
			send: async (writer) => {
				await writer.write(encoder.encode(headers));
				await writer.write(encoder.encode('Part 1'));
				await new Promise((resolve) => setTimeout(resolve, 200));
				await writer.write(encoder.encode('Part 2'));
				await new Promise((resolve) => setTimeout(resolve, 200));
				await writer.write(encoder.encode('Part 3'));
			},
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('Part 1');
		expect(response).toContain('Part 2');
		expect(response).toContain('Part 3');
	});

	it('should surface response headers', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/headers',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).toContain('x-custom-header: TestValue');
	});

	it('should handle a gzipped response', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/gzipped',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 200 OK');
		expect(response).not.toContain('content-length');
		expect(response).toContain('transfer-encoding: chunked');
		expect(response.length).toBeGreaterThan(pygmalion.length);
		expect(response).toContain(pygmalion.slice(-100));
	});

	it('should handle a non-existent endpoint', async () => {
		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/non-existent',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 404 Not Found');
	});

	it('should emit a 400 response when fetch fails', async () => {
		vi.spyOn(
			fetchWithCorsProxyModule,
			'fetchWithCorsProxy'
		).mockRejectedValue(new Error('Network error'));

		const response = await sendRawHttpRequest({
			request: buildHttpRequest({
				path: '/simple',
				hostHeader: `${host}:${port}`,
			}),
			connectionHost: host,
			connectionPort: port,
		});

		expect(response).toContain('HTTP/1.1 400 Bad Request');
	});
});

describe('HTTP request parsing', () => {
	it('should decode chunked POST bodies before forwarding', async () => {
		const captured = await captureParsedRequest(
			`POST /echo HTTP/1.1\r\nHost: playground.internal\r\ntransfer-encoding: chunked\r\n\r\n5\r\nabcde\r\n0\r\n\r\n`
		);

		expect(captured.method).toBe('POST');
		expect(captured.body).toBe('abcde');
	});

	it('should preserve path and query string', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/core/version-check/1.7/?channel=beta',
				hostHeader: 'playground.internal',
			})
		);

		expect(captured.url).toBe(
			'http://playground.internal/core/version-check/1.7/?channel=beta'
		);
	});

	it('should handle a simple path without query', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/api/users',
				hostHeader: 'example.com',
			})
		);

		expect(captured.url).toBe('http://example.com/api/users');
	});

	it('should handle the root path', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/',
				hostHeader: 'example.com',
			})
		);

		expect(captured.url).toBe('http://example.com/');
	});

	it('should preserve URL-encoded characters in path', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/search/hello%20world',
				hostHeader: 'example.com',
			})
		);

		expect(captured.url).toBe('http://example.com/search/hello%20world');
	});

	it('should preserve URL-encoded characters in query string', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/search?q=hello+world&filter=a%26b',
				hostHeader: 'example.com',
			})
		);

		expect(captured.url).toBe(
			'http://example.com/search?q=hello+world&filter=a%26b'
		);
	});

	it('should preserve empty query parameter values', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/api?key1=&key2=value2',
				hostHeader: 'example.com',
			})
		);

		expect(captured.url).toBe('http://example.com/api?key1=&key2=value2');
	});

	it('should handle paths with hash fragments', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/page#section',
				hostHeader: 'example.com',
			})
		);

		expect(captured.url).toBe('http://example.com/page#section');
	});

	it('should handle path with query and hash fragments', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/page?param=value#section',
				hostHeader: 'example.com',
			})
		);

		expect(captured.url).toBe(
			'http://example.com/page?param=value#section'
		);
	});

	it('should prefer the Host header over the connection host', async () => {
		const captured = await captureParsedRequest(
			buildHttpRequest({
				path: '/api',
				hostHeader: 'custom.host.com',
			}),
			{
				connectionHost: 'default.host.com',
			}
		);

		expect(captured.url).toBe('http://custom.host.com/api');
	});
});

type RunConnectorOptions = {
	connectionHost: string;
	connectionPort: number;
	connectorOptions?: HttpFetchConnectorOptions;
	send: (
		writer: WritableStreamDefaultWriter<Uint8Array>
	) => Promise<void> | void;
};

type SendRawHttpRequestOptions = {
	request: string;
	connectionHost: string;
	connectionPort: number;
	connectorOptions?: HttpFetchConnectorOptions;
};

type CaptureOptions = {
	connectionHost?: string;
	connectionPort?: number;
	connectorOptions?: HttpFetchConnectorOptions;
};

async function runConnector({
	connectionHost,
	connectionPort,
	connectorOptions,
	send,
}: RunConnectorOptions): Promise<string> {
	const connector = createHttpConnector(connectorOptions);
	const upstream = new TransformStream<Uint8Array>();
	const upstreamWriter = upstream.writable.getWriter();

	const responseChunks: Uint8Array[] = [];
	const downstream = new WritableStream<Uint8Array>({
		write(chunk) {
			responseChunks.push(chunk);
		},
	});

	const connectPromise = connector.connect({
		host: connectionHost,
		port: connectionPort,
		upstream: upstream.readable,
		downstream,
	});

	await send(upstreamWriter);
	await upstreamWriter.close();

	await connectPromise;

	return decodeResponseChunks(responseChunks);
}

async function sendRawHttpRequest({
	request,
	connectionHost,
	connectionPort,
	connectorOptions,
}: SendRawHttpRequestOptions): Promise<string> {
	return runConnector({
		connectionHost,
		connectionPort,
		connectorOptions,
		send: async (writer) => {
			await writer.write(encoder.encode(request));
		},
	});
}

async function captureParsedRequest(
	request: string,
	options: CaptureOptions = {}
) {
	let captured:
		| {
				url: string;
				method: string;
				headers: Headers;
				body?: string;
		  }
		| undefined;

	vi.spyOn(fetchWithCorsProxyModule, 'fetchWithCorsProxy').mockImplementation(
		async (input: RequestInfo) => {
			const req = typeof input === 'string' ? new Request(input) : input;
			const clone = req.clone();
			const body =
				clone.method === 'GET' || clone.method === 'HEAD'
					? undefined
					: await clone.text();
			captured = {
				url: clone.url,
				method: clone.method,
				headers: clone.headers,
				body,
			};
			return new Response('OK');
		}
	);

	await sendRawHttpRequest({
		request,
		connectionHost: options.connectionHost ?? 'playground.internal',
		connectionPort: options.connectionPort ?? 80,
		connectorOptions: options.connectorOptions,
	});

	if (!captured) {
		throw new Error('Expected fetchWithCorsProxy to be called');
	}

	return captured;
}

type BuildHttpRequestOptions = {
	method?: string;
	path: string;
	hostHeader: string;
	body?: string;
	additionalHeaders?: string;
	skipContentLength?: boolean;
};

function buildHttpRequest({
	method = 'GET',
	path,
	hostHeader,
	body = '',
	additionalHeaders = '',
	skipContentLength = false,
}: BuildHttpRequestOptions): string {
	const contentLengthHeader =
		!skipContentLength && body.length > 0
			? `Content-Length: ${encoder.encode(body).length}\r\n`
			: '';
	return `${method} ${path} HTTP/1.1\r\nHost: ${hostHeader}\r\n${additionalHeaders}${contentLengthHeader}\r\n${body}`;
}

function decodeResponseChunks(chunks: Uint8Array[]): string {
	if (chunks.length === 0) {
		return '';
	}
	return decoder.decode(concatUint8Arrays(chunks));
}
