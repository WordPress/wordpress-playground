/**
 * HTTP/HTTPS connector using fetch() API.
 *
 * Handles HTTP and HTTPS connections by translating raw TCP bytes
 * into fetch() calls. For HTTPS, performs TLS handshake using
 * auto-generated certificates.
 */

import type { GeneratedCertificate } from '../tls/certificates';
import { generateCertificate } from '../tls/certificates';
import { TLS_1_2_Connection } from '../tls/1_2/connection';
import { fetchWithCorsProxy } from '../fetch-with-cors-proxy';
import { ChunkedDecoderStream } from '../chunked-decoder';
import {
	concatUint8Arrays,
	type ConnectionInfo,
	type NetworkConnection,
	type NetworkConnector,
} from '@php-wasm/util';

export interface HttpFetchConnectorOptions {
	/**
	 * Root CA certificate for TLS connections.
	 * Required for HTTPS support.
	 */
	CAroot?: GeneratedCertificate;

	/**
	 * Optional CORS proxy URL for cross-origin requests.
	 */
	corsProxyUrl?: string;
}

const HTTP_METHODS = [
	'GET',
	'POST',
	'HEAD',
	'PATCH',
	'OPTIONS',
	'DELETE',
	'PUT',
	'TRACE',
];

/**
 * Creates an HTTP/HTTPS connector that uses the fetch() API.
 */
export function createHttpConnector(
	options: HttpFetchConnectorOptions = {}
): NetworkConnector {
	return {
		name: 'HTTP/HTTPS Fetch',
		matches: (info: ConnectionInfo) => {
			return info.port === 80 || info.port === 443;
		},
		connect: async (connection: NetworkConnection) => {
			const reader = connection.upstream.getReader();
			const writer = connection.downstream.getWriter();

			// Buffer initial bytes to detect protocol
			let bufferedBytes = new Uint8Array(0);
			let protocol: 'http' | 'https' | null = null;

			try {
				// Read initial bytes to detect protocol
				while (protocol === null && bufferedBytes.length < 8) {
					const { done, value } = await reader.read();
					if (done) {
						throw new Error(
							'Connection closed before protocol detection'
						);
					}
					bufferedBytes = concatUint8Arrays([bufferedBytes, value]);
					protocol = guessProtocol(connection.port, bufferedBytes);
				}

				reader.releaseLock();

				// Recreate upstream with buffered bytes
				const upstreamWithBuffer = new ReadableStream<Uint8Array>({
					async start(controller) {
						controller.enqueue(bufferedBytes);
					},
					async pull(controller) {
						const newReader = connection.upstream.getReader();
						const { done, value } = await newReader.read();
						if (done) {
							controller.close();
						} else {
							controller.enqueue(value);
						}
						newReader.releaseLock();
					},
				});

				if (protocol === 'https') {
					await handleHttps(
						connection.host,
						upstreamWithBuffer,
						writer,
						options
					);
				} else {
					await handleHttp(
						connection.host,
						upstreamWithBuffer,
						writer,
						options.corsProxyUrl
					);
				}
			} catch (error) {
				console.error('HTTP connector error:', error);
				try {
					await writer.close();
				} catch {
					// Already closed
				}
			}
		},
	};
}

/**
 * Detects whether the connection uses HTTP or HTTPS based on initial bytes.
 */
function guessProtocol(
	port: number,
	data: Uint8Array
): 'http' | 'https' | null {
	if (data.length < 8) {
		return null;
	}

	// TLS handshake detection
	const looksLikeTls =
		port === 443 &&
		data[0] === 0x16 && // ContentTypes.Handshake
		data[1] === 0x03 && // TLS version major
		data[2] >= 0x01 &&
		data[2] <= 0x03; // TLS version minor (1.0-1.2)

	if (looksLikeTls) {
		return 'https';
	}

	// HTTP method detection
	const decodedFirstLine = new TextDecoder('latin1', {
		fatal: true,
	}).decode(data);
	const looksLikeHttp = HTTP_METHODS.some((method) =>
		decodedFirstLine.startsWith(method + ' ')
	);

	if (looksLikeHttp) {
		return 'http';
	}

	return null;
}

/**
 * Handles HTTP connections using fetch().
 */
async function handleHttp(
	host: string,
	upstream: ReadableStream<Uint8Array>,
	writer: WritableStreamDefaultWriter<Uint8Array>,
	corsProxyUrl?: string
) {
	try {
		const request = await parseHttpRequest(upstream, host, 'http');
		const responseStream = fetchRawResponseBytes(request, corsProxyUrl);
		await responseStream.pipeTo(
			new WritableStream({
				write: async (chunk) => {
					await writer.write(chunk);
				},
				close: async () => {
					await writer.close();
				},
				abort: async (error) => {
					console.error('HTTP response stream aborted:', error);
					await writer.close();
				},
			})
		);
	} catch (error) {
		console.error('HTTP handling error:', error);
		throw error;
	}
}

/**
 * Handles HTTPS connections using TLS and fetch().
 */
async function handleHttps(
	host: string,
	upstream: ReadableStream<Uint8Array>,
	writer: WritableStreamDefaultWriter<Uint8Array>,
	options: HttpFetchConnectorOptions
) {
	if (!options.CAroot) {
		throw new Error(
			'HTTPS connector requires CAroot certificate in options'
		);
	}

	try {
		// Generate site certificate
		const siteCert = await generateCertificate(
			{
				subject: {
					commonName: host,
					organizationName: host,
					countryName: 'US',
				},
				issuer: options.CAroot.tbsDescription.subject,
			},
			options.CAroot.keyPair
		);

		// Create TLS connection
		const tlsConnection = new TLS_1_2_Connection();

		// Pipe encrypted bytes to TLS connection
		upstream.pipeTo(tlsConnection.clientEnd.upstream.writable).catch(() => {
			// Ignore pipeTo errors
		});

		// Pipe decrypted bytes from TLS connection to output
		tlsConnection.clientEnd.downstream.readable
			.pipeTo(
				new WritableStream({
					write: async (chunk) => {
						await writer.write(chunk);
					},
					close: async () => {
						await writer.close();
					},
					abort: async () => {
						await writer.close();
					},
				})
			)
			.catch(() => {
				// Ignore pipeTo errors
			});

		// Perform TLS handshake
		await tlsConnection.TLSHandshake(siteCert.keyPair.privateKey, [
			siteCert.certificate,
			options.CAroot.certificate,
		]);

		// Parse HTTP request from decrypted stream
		const request = await parseHttpRequest(
			tlsConnection.serverEnd.upstream.readable,
			host,
			'https'
		);

		// Fetch response and pipe to TLS connection
		await fetchRawResponseBytes(request, options.corsProxyUrl).pipeTo(
			tlsConnection.serverEnd.downstream.writable
		);
	} catch (error) {
		console.error('HTTPS handling error:', error);
		throw error;
	}
}

/**
 * Parses a raw HTTP request from a byte stream.
 */
async function parseHttpRequest(
	requestBytesStream: ReadableStream<Uint8Array>,
	host: string,
	protocol: 'http' | 'https'
): Promise<Request> {
	let inputBuffer: Uint8Array = new Uint8Array(0);
	let requestDataExhausted = false;
	let headersEndIndex = -1;
	const requestBytesReader = requestBytesStream.getReader();

	// Read until we find headers end (\r\n\r\n)
	while (headersEndIndex === -1) {
		const { done, value } = await requestBytesReader.read();
		if (done) {
			requestDataExhausted = true;
			break;
		}
		inputBuffer = concatUint8Arrays([inputBuffer, value]);
		headersEndIndex = findSequenceInBuffer(
			inputBuffer,
			new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a])
		);
	}
	requestBytesReader.releaseLock();

	const headersBuffer = inputBuffer.slice(0, headersEndIndex);
	const parsedHeaders = parseRequestHeaders(headersBuffer);
	const terminationMode =
		parsedHeaders.headers.get('Transfer-Encoding') !== null
			? 'chunked'
			: 'content-length';
	const contentLength =
		parsedHeaders.headers.get('Content-Length') !== null
			? parseInt(parsedHeaders.headers.get('Content-Length')!, 10)
			: undefined;

	const bodyBytes = inputBuffer.slice(headersEndIndex + 4);
	let outboundBodyStream: ReadableStream<Uint8Array> | undefined;

	if (parsedHeaders.method !== 'GET') {
		const requestBytesReader = requestBytesStream.getReader();
		let seenBytes = bodyBytes.length;
		let last5Bytes = bodyBytes.slice(-6);
		const emptyChunk = new TextEncoder().encode('0\r\n\r\n');

		outboundBodyStream = new ReadableStream<Uint8Array>({
			async start(controller) {
				if (bodyBytes.length > 0) {
					controller.enqueue(bodyBytes);
				}
				if (requestDataExhausted) {
					controller.close();
				}
			},
			async pull(controller) {
				const { done, value } = await requestBytesReader.read();
				seenBytes += value?.length || 0;
				if (value) {
					controller.enqueue(value);
					last5Bytes = concatUint8Arrays([
						last5Bytes,
						value || new Uint8Array(),
					]).slice(-5);
				}
				const shouldTerminate =
					done ||
					(terminationMode === 'content-length' &&
						contentLength !== undefined &&
						seenBytes >= contentLength) ||
					(terminationMode === 'chunked' &&
						last5Bytes.every(
							(byte, index) => byte === emptyChunk[index]
						));
				if (shouldTerminate) {
					controller.close();
					return;
				}
			},
		});

		if (terminationMode === 'chunked') {
			outboundBodyStream = outboundBodyStream.pipeThrough(
				new ChunkedDecoderStream()
			);
		}
	}

	const hostname = parsedHeaders.headers.get('Host') ?? host;
	const url = new URL(parsedHeaders.path, protocol + '://' + hostname);

	return new Request(url.toString(), {
		method: parsedHeaders.method,
		headers: parsedHeaders.headers,
		body: outboundBodyStream,
		// @ts-expect-error - duplex required in Node.js
		duplex: 'half',
	});
}

/**
 * Parses HTTP request headers from raw bytes.
 */
function parseRequestHeaders(httpRequestBytes: Uint8Array) {
	const httpRequest = new TextDecoder().decode(httpRequestBytes);
	const statusLineMaybe = httpRequest.split('\n')[0];
	const [method, path] = statusLineMaybe.split(' ');

	const headers = new Headers();
	for (const line of httpRequest.split('\r\n').slice(1)) {
		if (line === '') {
			break;
		}
		const [name, value] = line.split(': ');
		headers.set(name, value);
	}

	return { method, path, headers };
}

/**
 * Fetches a response and returns it as a raw byte stream.
 */
function fetchRawResponseBytes(
	request: Request,
	corsProxyUrl?: string
): ReadableStream<Uint8Array> {
	return new ReadableStream({
		async start(controller) {
			let response: Response;
			try {
				response = await fetchWithCorsProxy(
					request,
					undefined,
					corsProxyUrl
				);
			} catch {
				// Return 400 Bad Request on fetch failure
				controller.enqueue(
					new TextEncoder().encode(
						'HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n'
					)
				);
				controller.close();
				return;
			}

			controller.enqueue(headersAsBytes(response));
			const reader = response.body?.getReader();
			if (!reader) {
				controller.close();
				return;
			}

			const encoder = new TextEncoder();
			while (true) {
				const { done, value } = await reader.read();
				if (value) {
					// Use chunked transfer encoding
					controller.enqueue(
						encoder.encode(`${value.length.toString(16)}\r\n`)
					);
					controller.enqueue(value);
					controller.enqueue(encoder.encode('\r\n'));
				}
				if (done) {
					controller.enqueue(encoder.encode('0\r\n\r\n'));
					controller.close();
					return;
				}
			}
		},
	});
}

/**
 * Converts HTTP response headers to raw bytes.
 */
function headersAsBytes(response: Response): Uint8Array {
	const status = `HTTP/1.1 ${response.status} ${response.statusText}`;

	const headersObject: Record<string, string> = {};
	response.headers.forEach((value, name) => {
		headersObject[name.toLowerCase()] = value;
	});

	// Strip content-length and use chunked encoding instead
	delete headersObject['content-length'];
	headersObject['transfer-encoding'] = 'chunked';

	const headers: string[] = [];
	for (const [name, value] of Object.entries(headersObject)) {
		headers.push(`${name}: ${value}`);
	}
	const string = [status, ...headers].join('\r\n') + '\r\n\r\n';
	return new TextEncoder().encode(string);
}

/**
 * Finds a byte sequence in a buffer.
 */
function findSequenceInBuffer(
	buffer: Uint8Array,
	sequence: Uint8Array
): number {
	const bufferLength = buffer.length;
	const sequenceLength = sequence.length;
	const lastPossibleIndex = bufferLength - sequenceLength;

	for (let i = 0; i <= lastPossibleIndex; i++) {
		let found = true;
		for (let j = 0; j < sequenceLength; j++) {
			if (buffer[i + j] !== sequence[j]) {
				found = false;
				break;
			}
		}
		if (found) {
			return i;
		}
	}
	return -1;
}
