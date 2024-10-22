import { TLS_1_2_Connection } from './tls/1_2/connection';
import { generateCertificate, GeneratedCertificate } from './tls/certificates';
import { logger } from '@php-wasm/logger';

type TCPOverFetchOptions = {
	CAroot: GeneratedCertificate;
};

/**
 * Websocket that buffers the received bytes and translates them into
 * a fetch() call.
 */
export const tcpOverFetchWebsocket = (options: TCPOverFetchOptions) => {
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
				const CAroot = options.CAroot;
				return class SpecificTLSToFetchWebsocket extends TLSToFetchWebsocket {
					constructor(url: string, options: string[]) {
						super(url, options, CAroot, startTLS);
					}
				};
			},
		},
	};
};

async function startTLS(ws: any) {
	const tlsConnection = new TLS_1_2_Connection();
	tlsConnection.addEventListener(
		'pass-tls-bytes-to-client',
		(e: CustomEvent) => {
			logger.debug('Server -> Client: ', e.detail);
			ws.binaryType = 'arraybuffer';
			ws.emit('message', { data: e.detail });
		}
	);
	tlsConnection.addEventListener(
		'decrypted-bytes-from-client',
		(e: CustomEvent) => {
			logger.debug('data', e.detail);
			logger.debug('data', new TextDecoder().decode(e.detail));

			httpRequestToFetch(
				ws.host,
				ws.port,
				new TextDecoder().decode(e.detail),
				async (data) => {
					logger.debug(
						'Got response',
						new TextDecoder().decode(data)
					);
					await tlsConnection.sendDataToClient(new Uint8Array(data));
				},
				() => {
					logger.debug('Closing the connection');
					ws.close();
					tlsConnection.close();
				}
			);
			logger.debug('fetch() sent');
		}
	);
	return tlsConnection;
}

class TLSToFetchWebsocket {
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
	tlsConnection: Promise<TLS_1_2_Connection>;
	isPlaintext: boolean | null = null;

	constructor(
		public url: string,
		public options: string[],
		CAroot: GeneratedCertificate,
		tlsFactory: (ws: TLSToFetchWebsocket) => Promise<TLS_1_2_Connection>
	) {
		const wsUrl = new URL(url);
		this.host = wsUrl.searchParams.get('host')!;
		this.port = parseInt(wsUrl.searchParams.get('port')!, 10);

		this.tlsConnection = tlsFactory(this);
		// Intentionally not awaiting this, we're in a constructor
		// after all.
		this.startTLSConnection(CAroot);
	}

	async startTLSConnection(CAroot: GeneratedCertificate) {
		this.readyState = this.OPEN;
		this.emit('open');

		const connection = await this.tlsConnection;
		const siteCert = await generateCertificate(
			{
				subject: {
					commonName: this.host,
					organizationName: 'abc',
					countryName: 'PL',
				},
				issuer: CAroot.tbsDescription.subject,
			},
			CAroot.keyPair
		);
		await connection.TLSHandshake(siteCert.keyPair.privateKey, [
			siteCert.certificate,
			CAroot.certificate,
		]);
		connection.startEmitingApplicationData();
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
		// logger.log("Adding listener for ", eventName, " event");
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
		// logger.log("dispatching ", eventName, " event");
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

	send(data: ArrayBuffer) {
		logger.log('Client -> Server: ', new Uint8Array(data));
		try {
			if (this.isPlaintext === null) {
				// If it's a HTTP request, we can just fetch it
				// @TODO: This is very naive. Let's find a more robust way of detecting if
				//        it's a HTTP request
				try {
					// Throw a TypeError instead of replacing indecipherable octects with `�`.
					const string = new TextDecoder('latin1', {
						fatal: true,
					}).decode(data);
					const firstLine = string.split('\n')[0];
					const [, , version] = firstLine.split(' ');
					this.isPlaintext = version?.startsWith('HTTP');
				} catch (e) {
					this.isPlaintext = false;
				}
			}
			if (this.isPlaintext) {
				this.close();
				return;
			} else {
				// If it's a HTTPS request, we'll pretend to be the server
				// and negotiate a secure connection
				logger.log(new TextDecoder().decode(data));
				this.tlsConnection.then((tlsConnection) => {
					tlsConnection.onClientBytes(new Uint8Array(data));
				});
			}
		} catch (e) {
			logger.log('Failed to fetch');
			logger.error(e);
		}
		return null;
	}

	close() {
		logger.log('Called close()!');
		this.readyState = this.CLOSING;
		this.emit('close');
		this.readyState = this.CLOSED;
	}
}

export async function httpRequestToFetch(
	host: string,
	port: number,
	httpRequest: string,
	onData: (data: ArrayBuffer) => void,
	onDone: () => void
) {
	const firstLine = httpRequest.split('\n')[0];
	const [method, path] = firstLine.split(' ');

	const headers = new Headers();
	for (const line of httpRequest.split('\r\n').slice(1)) {
		if (line === '') {
			break;
		}
		const [name, value] = line.split(': ');
		logger.log({ name, value });
		headers.set(name, value);
	}
	// This is a naive implementation that doesn't handle
	// PHP writing arbitrary Host headers to IP addresses,
	// but it's the best we can do in the browser.
	const protocol = port === 443 ? 'https' : 'http';
	// @TODO: Decide which host to use. The header is less reliable,
	//        but in some cases it's more useful. E.g. the Host header
	//        may be `localhost` when `host` is 127.0.0.1, and, to
	//        run the fetch() request, we need to use the former since
	//        the latter may not respond to requests. Similarly,
	//        PHP may run requests to arbitrary IP addresses with
	//        the Host header set to a domain name, and we need to
	//        pass a valid domain to fetch().
	const hostname = headers.get('Host')
		? headers.get('Host')
		: [80, 443].includes(port)
		? host
		: `${host}:${port}`;
	const url = new URL(path, protocol + '://' + hostname).toString();
	logger.log({ httpRequest, method, url });

	const response = await fetch(url, {
		method,
		headers,
	});

	logger.log('====> Got fetch() response!', response);
	const reader = response.body?.getReader();

	if (!reader) {
		throw new Error('No reader');
	}

	// Sleep to let PHP.wasm process the data it already received.
	// @TODO: Explain the exact reason why it's needed.
	await new Promise((resolve) => setTimeout(resolve, 1));
	onData(new TextEncoder().encode(responseHeaderToString(response)));

	let buffer = new Uint8Array(0);
	let readerDone = false;
	// 16K. 32K is too much for the cipher suite used by TLS_1_2_Connection.
	const CHUNK_SIZE = 1024 * 16;
	while (!readerDone || buffer.length) {
		if (!readerDone) {
			const { done, value } = await reader.read();
			if (value) {
				buffer = new Uint8Array([...buffer, ...value]);
			}
			if (done) {
				readerDone = true;
				continue;
			}
		}
		// Sleep to let PHP.wasm process the data it already received.
		await new Promise((resolve) => setTimeout(resolve, 1));
		onData(buffer.slice(0, CHUNK_SIZE));
		buffer = buffer.slice(CHUNK_SIZE);
	}
	// If there's any sleep() between onData() and onDone(), JavaScript
	// will yield the control back to PHP.wasm where a blocking loop will
	// block the event loop and never get to onDone().
	onDone();
}

function responseHeaderToString(response: Response) {
	const status = `HTTP/1.1 ${response.status} ${response.statusText}`;

	const headers: string[] = [];
	response.headers.forEach((value, name) => {
		headers.push(`${name}: ${value}`);
	});
	return [status, ...headers].join('\r\n') + '\r\n\r\n';
}
