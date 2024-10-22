import { TLS_1_2_Connection } from './tls/1_2/connection';
import { generateCertificate, GeneratedCertificate } from './tls/certificates';
import { concatUint8Arrays } from './tls/utils';
import { ContentTypes } from './tls/1_2/types';

export type TCPOverFetchOptions = {
	CAroot: GeneratedCertificate;
};

/**
 * Websocket that buffers the received bytes and translates them into
 * a fetch() call.
 */
export const tcpOverFetchWebsocket = (tcpOptions: TCPOverFetchOptions) => {
	return {
		websocket: {
			url: (_: any, host: string, port: string) => {
				const query = new URLSearchParams({
					host,
					port,
				}).toString();
				return `ws://playground.internal/?${query}`;
			},
			subprotocol: 'binary',
			decorator: () => {
				return class extends TCPOverFetchWebsocket {
					constructor(url: string, wsOptions: string[]) {
						super(url, wsOptions, tcpOptions.CAroot);
					}
				};
			},
		},
	};
};

class TCPOverFetchWebsocket {
	CONNECTING = 0;
	OPEN = 1;
	CLOSING = 2;
	CLOSED = 3;
	readyState = this.CONNECTING;
	binaryType = 'blob';
	bufferedAmount = 0;
	extensions = '';
	protocol = 'ws';
	host = '';
	port = 0;
	listeners = new Map<string, any>();

	clientUpstream = new TransformStream();
	clientUpstreamWriter = this.clientUpstream.writable.getWriter();
	clientDownstream = new TransformStream();
	fetchInitiated = false;
	bufferedBytesFromClient: Uint8Array = new Uint8Array(0);

	constructor(
		public url: string,
		public options: string[],
		public CAroot: GeneratedCertificate
	) {
		const wsUrl = new URL(url);
		this.host = wsUrl.searchParams.get('host')!;
		this.port = parseInt(wsUrl.searchParams.get('port')!, 10);
		this.binaryType = 'arraybuffer';

		this.clientDownstream.readable.pipeTo(
			new WritableStream(
				/**
				 * Workaround a PHP.wasm issue – if the WebSocket is
				 * closed asynchronously after the last chunk is received,
				 * the PHP.wasm runtime enters an infinite polling loop.
				 *
				 * The root cause of the problem is unclear at the time
				 * of writing this comment.
				 *
				 * The workaround is to call this.close() without yielding
				 * to the event loop after receiving the last data chunk.
				 */
				synchronouslyClosedSink({
					write: (chunk) => {
						/**
						 * Emscripten expects the message event to be emitted
						 * so let's emit it.
						 */
						this.emit('message', { data: chunk });
					},
					close: () => {
						this.close();
					},
				})
			)
		);
		this.readyState = this.OPEN;
		this.emit('open');
	}

	on(eventName: string, callback: (e: any) => void) {
		this.addEventListener(eventName, callback);
	}

	once(eventName: string, callback: (e: any) => void) {
		const wrapper = (e: any) => {
			callback(e);
			this.removeEventListener(eventName, wrapper);
		};
		this.addEventListener(eventName, wrapper);
	}

	addEventListener(eventName: string, callback: (e: any) => void) {
		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, new Set());
		}
		this.listeners.get(eventName).add(callback);
	}

	removeListener(eventName: string, callback: (e: any) => void) {
		this.removeEventListener(eventName, callback);
	}

	removeEventListener(eventName: string, callback: (e: any) => void) {
		const listeners = this.listeners.get(eventName);
		if (listeners) {
			listeners.delete(callback);
		}
	}

	emit(eventName: string, data: any = {}) {
		if (eventName === 'message') {
			this.onmessage(data);
		} else if (eventName === 'close') {
			this.onclose(data);
		} else if (eventName === 'error') {
			this.onerror(data);
		} else if (eventName === 'open') {
			this.onopen(data);
		}
		const listeners = this.listeners.get(eventName);
		if (listeners) {
			for (const listener of listeners) {
				listener(eventName, data);
			}
		}
	}

	// Default event handlers that can be overridden by the user
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onclose(data: any) {}
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onerror(data: any) {}
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onmessage(data: any) {}
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onopen(data: any) {}

	/**
	 * Emscripten calls this method whenever the WASM module
	 * writes bytes to the TCP socket.
	 */
	send(data: ArrayBuffer) {
		if (
			this.readyState === this.CLOSING ||
			this.readyState === this.CLOSED
		) {
			return;
		}

		this.clientUpstreamWriter.write(new Uint8Array(data));

		if (this.fetchInitiated) {
			return;
		}

		// Guess the protocol type first so we can learn
		// what to do with the incoming bytes.
		this.bufferedBytesFromClient = concatUint8Arrays([
			this.bufferedBytesFromClient,
			new Uint8Array(data),
		]);
		switch (guessProtocol(this.port, this.bufferedBytesFromClient)) {
			case false:
				// Not enough data to classify the protocol,
				// let's wait for more.
				return;
			case 'other':
				this.close();
				throw new Error('Unsupported protocol');
			case 'tls':
				this.fetchOverTLS();
				this.fetchInitiated = true;
				break;
			case 'http':
				this.fetchOverHTTP();
				this.fetchInitiated = true;
				break;
		}
	}

	async fetchOverTLS() {
		const siteCert = await generateCertificate(
			{
				subject: {
					commonName: this.host,
					organizationName: this.host,
					countryName: 'US',
				},
				issuer: this.CAroot.tbsDescription.subject,
			},
			this.CAroot.keyPair
		);

		const tlsConnection = new TLS_1_2_Connection();

		// Connect this WebSocket's client end to the TLS connection.
		// Forward the encrypted bytes from the WebSocket to the TLS connection.
		this.clientUpstream.readable.pipeTo(
			tlsConnection.clientEnd.upstream.writable
		);

		// Forward the decrypted bytes from the TLS connection to this WebSocket.
		tlsConnection.clientEnd.downstream.readable.pipeTo(
			this.clientDownstream.writable
		);

		// Perform the TLS handshake
		await tlsConnection.TLSHandshake(siteCert.keyPair.privateKey, [
			siteCert.certificate,
			this.CAroot.certificate,
		]);

		// Connect the TLS server end to the fetch() request
		await RawBytesFetch.fetchRawResponseBytes(
			await RawBytesFetch.parseHttpRequest(
				tlsConnection.serverEnd.upstream.readable,
				this.host,
				'https'
			)
		).pipeTo(tlsConnection.serverEnd.downstream.writable);
	}

	async fetchOverHTTP() {
		// Connect this WebSocket's client end to the fetch() request
		await RawBytesFetch.fetchRawResponseBytes(
			await RawBytesFetch.parseHttpRequest(
				this.clientUpstream.readable,
				this.host,
				'http'
			)
		).pipeTo(this.clientDownstream.writable);
	}

	close() {
		this.readyState = this.CLOSING;
		this.emit('close');
		this.readyState = this.CLOSED;
	}
}

/**
 * Calls the underlying sink's close method synchronously after the last
 * chunk is received. This assumes that the upstream source is closed
 * synchronously once the last chunk is received.
 *
 * This is a workaround for a PHP.wasm issue – if the WebSocket is closed
 * asynchronously after the last chunk is received, the PHP.wasm runtime
 * enters an infinite polling loop.
 */
function synchronouslyClosedSink<T>(underlyingSink: UnderlyingSink<T>) {
	const chunks: T[] = [];
	let shouldClose = false;
	return {
		...underlyingSink,
		write: (chunk: T, controller: WritableStreamDefaultController) => {
			chunks.unshift(chunk);
			setTimeout(() => {
				while (chunks.length > 0) {
					const emittedChunk = chunks.pop()!;
					underlyingSink.write?.(emittedChunk, controller);
				}
				if (shouldClose) {
					underlyingSink.close?.();
				}
			}, 5); // 0 is enough, but using 5 for good measure
		},
		close: () => {
			shouldClose = true;
		},
	};
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

function guessProtocol(port: number, data: Uint8Array) {
	if (data.length < 8) {
		// Not enough data to classify the protocol, let's wait for more.
		return false;
	}

	// Assume TLS if we're on the usual HTTPS port and the
	// first three bytes look like a TLS handshake record.
	const looksLikeTls =
		port === 443 &&
		data[0] === ContentTypes.Handshake &&
		// TLS versions between 1.0 and 1.2
		data[1] === 0x03 &&
		data[2] >= 0x01 &&
		data[2] <= 0x03;
	if (looksLikeTls) {
		return 'tls';
	}

	// Assume HTTP if we're on the usual HTTP port and the
	// first starts with an HTTP method and a space.
	const decodedFirstLine = new TextDecoder('latin1', {
		fatal: true,
	}).decode(data);
	const looksLikeHttp = HTTP_METHODS.some((method) =>
		decodedFirstLine.startsWith(method + ' ')
	);
	if (looksLikeHttp) {
		return 'http';
	}

	return 'other';
}

class RawBytesFetch {
	static fetchRawResponseBytes(request: Request) {
		const stream = new TransformStream({
			async start(controller) {
				const response = await fetch(request);
				controller.enqueue(RawBytesFetch.headersAsBytes(response));
				response.body?.pipeTo(stream.writable);
			},
		});
		return stream.readable;
	}

	private static headersAsBytes(response: Response) {
		const status = `HTTP/1.1 ${response.status} ${response.statusText}`;

		const headers: string[] = [];
		response.headers.forEach((value, name) => {
			headers.push(`${name}: ${value}`);
		});
		const string = [status, ...headers].join('\r\n') + '\r\n\r\n';
		return new TextEncoder().encode(string);
	}

	static async parseHttpRequest(
		requestBytesStream: ReadableStream<Uint8Array>,
		host: string,
		protocol: 'http' | 'https'
	) {
		let inputBuffer: Uint8Array = new Uint8Array(0);

		let headersEndIndex = -1;
		const requestBytesReader = requestBytesStream.getReader();
		while (headersEndIndex === -1) {
			const { done, value } = await requestBytesReader.read();
			if (done) {
				break;
			}
			inputBuffer = concatUint8Arrays([inputBuffer, value]);
			// Find the end of the headers (\r\n\r\n). This is
			// not optimal as we may end up scanning the same
			// bytes multiple times, but the overhead is negligible
			// and the code is much simpler this way.
			headersEndIndex = findSequenceInBuffer(
				inputBuffer,
				new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a])
			);
		}
		requestBytesReader.releaseLock();

		const headersBuffer = inputBuffer.slice(0, headersEndIndex);
		const parsedHeaders = RawBytesFetch.parseRequestHeaders(headersBuffer);

		const bodyBytes = inputBuffer.slice(
			headersEndIndex + 4 /* Skip \r\n\r\n */
		);
		let outboundBodyStream = undefined;
		if (parsedHeaders.method !== 'GET') {
			outboundBodyStream = new TransformStream();
			if (bodyBytes.length > 0) {
				const outboundBodyWriter =
					outboundBodyStream.writable.getWriter();
				await outboundBodyWriter.write(bodyBytes);
				outboundBodyWriter.releaseLock();
			}
			requestBytesStream.pipeTo(outboundBodyStream.writable);
		}

		/**
		 * Prefer the Host header to the host from the URL used in a PHP
		 * function call.
		 *
		 * There are tradeoffs involved in this decision.
		 *
		 * The URL from the PHP function call is the actual network location
		 * the caller intended to reach, e.g. `http://192.168.1.100` or
		 * `http://127.0.0.1`.
		 *
		 * The Host header is what the developer wanted to provide to the
		 * web server, e.g. `wordpress.org` or `localhost`.
		 *
		 * The Host header is not a reliable indication of the target URL.
		 * However, `fetch()` does not support Host spoofing. Furthermore,
		 * a webserver running on 127.0.0.1 may only respond correctly
		 * when it is provided with the Host header `localhost`.
		 *
		 * Prefering the Host header over the host from the PHP function call
		 * is not perfect, but it seems like the lesser of two evils.
		 */
		const hostname = parsedHeaders.headers.get('Host') ?? host;
		const url = new URL(parsedHeaders.path, protocol + '://' + hostname);
		url.pathname = parsedHeaders.path;

		return new Request(url.toString(), {
			method: parsedHeaders.method,
			headers: parsedHeaders.headers,
			body: outboundBodyStream?.readable,
		});
	}

	private static parseRequestHeaders(httpRequestBytes: Uint8Array) {
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
}

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
