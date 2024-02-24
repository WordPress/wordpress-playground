import {
	BasePHP,
	DataModule,
	EmscriptenOptions,
	loadPHPRuntime,
	PHPRequestHandlerConfiguration,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { getPHPLoaderModule } from './get-php-loader-module';
import * as forge from 'node-forge';
import { Certificate } from 'crypto';

export interface PHPWebLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	downloadMonitor?: EmscriptenDownloadMonitor;
	requestHandler?: PHPRequestHandlerConfiguration;
	dataModules?: Array<DataModule | Promise<DataModule>>;
	/** @deprecated To be replaced with `extensions` in the future */
	loadAllExtensions?: boolean;
}

/**
 * Fake a websocket connection to prevent errors in the web app
 * from cascading and breaking the Playground.
 */
const fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor: any) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						console.log('Called constructor()!');
						try {
							super();
						} catch (e) {
							// pass
						}
					}

					send() {
						console.log('Called send()!');
						return null;
					}
				};
			},
		},
	};
};

async function generateKeys() {
	const keyPair = await crypto.subtle.generateKey(
		{
			name: 'ECDH',
			namedCurve: 'P-256',
		},
		true,
		['deriveKey']
	);
	return keyPair;
}

function createCertificate({ commonName }) {
	// create certificate
	var pki = forge.pki;
	var keys = pki.rsa.generateKeyPair(2048);
	var cert = pki.createCertificate();
	cert.publicKey = keys.publicKey;
	// alternatively set public key from a csr
	//cert.publicKey = csr.publicKey;
	// NOTE: serialNumber is the hex encoded value of an ASN.1 INTEGER.
	// Conforming CAs should ensure serialNumber is:
	// - no more than 20 octets
	// - non-negative (prefix a '00' if your value starts with a '1' bit)
	cert.serialNumber = '01';
	cert.validity.notBefore = new Date();
	cert.validity.notAfter = new Date();
	cert.validity.notAfter.setFullYear(
		cert.validity.notBefore.getFullYear() + 1
	);
	var attrs = [
		{
			name: 'commonName',
			value: commonName,
		},
		{
			name: 'countryName',
			value: 'US',
		},
		{
			shortName: 'ST',
			value: 'Virginia',
		},
		{
			name: 'localityName',
			value: 'Blacksburg',
		},
		{
			name: 'organizationName',
			value: 'Test',
		},
		{
			shortName: 'OU',
			value: 'Test',
		},
	];
	cert.setSubject(attrs);
	// alternatively set subject from a csr
	//cert.setSubject(csr.subject.attributes);
	cert.setIssuer(attrs);
	cert.setExtensions([
		{
			name: 'basicConstraints',
			cA: true,
		},
		{
			name: 'keyUsage',
			keyCertSign: true,
			digitalSignature: true,
			nonRepudiation: true,
			keyEncipherment: true,
			dataEncipherment: true,
		},
		{
			name: 'extKeyUsage',
			serverAuth: true,
			clientAuth: true,
			codeSigning: true,
			emailProtection: true,
			timeStamping: true,
		},
		{
			name: 'nsCertType',
			client: true,
			server: true,
			email: true,
			objsign: true,
			sslCA: true,
			emailCA: true,
			objCA: true,
		},
		{
			name: 'subjectAltName',
			altNames: [
				{
					type: 6, // URI
					value: '*.org',
				},
				{
					type: 7, // IP
					ip: '127.0.0.1',
				},
			],
		},
		{
			name: 'subjectKeyIdentifier',
		},
	]);
	// FIXME: add subjectKeyIdentifier extension
	// FIXME: add authorityKeyIdentifier extension
	cert.publicKey = keys.publicKey;

	// self-sign certificate
	cert.sign(keys.privateKey);

	// console.log('certificate created for \"' + forge.pki.certificateToPem(cert) + '\": \n' + forge.pki.privateKeyToPem(keys.privateKey));
	return { certificate: cert, privateKey: keys.privateKey };
}

// Introduce artificial delay to test the race
// condition when initializing the Playground client.
// for (let i = 0; i < 2; i++) {
// 	createCertificate();
// }

// @TODO: Create these certificates in FetchWebsocketConstructor based on the requested host
const { certificate, privateKey } = createCertificate({
	commonName: 'downloads.wordpress.org', //wsUrl.searchParams.get('host') || ''
});
const CAPair = { certificate, privateKey };
// const CAPair = createCertificate({
// 	commonName: ''
// });
export const CAPem = forge.pki.certificateToPem(CAPair.certificate);
/**
 * Websocket that buffers the received bytes and translates them into
 * a fetch() call.
 */
const fetchingWebsocket = (phpModuleArgs: EmscriptenOptions = {}) => {
	return {
		websocket: {
			...(phpModuleArgs['websocket'] || {}),
			url: (_: any, host: string, port: string) => {
				const query = new URLSearchParams({
					host,
					port,
				}).toString();
				return `ws://playground.internal/?${query}`;
			},
			subprotocol: 'binary',
			decorator: () => {
				return class FetchWebsocketConstructor {
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
					sslServer: any;
					isPlaintext: boolean | null = null;

					constructor(public url: string, public options: string[]) {
						const wsUrl = new URL(url);
						this.host = wsUrl.searchParams.get('host')!;
						this.port = parseInt(
							wsUrl.searchParams.get('port')!,
							10
						);

						const ws = this;
						try {
							this.sslServer = forge.tls.createConnection({
								server: true,
								caStore: forge.pki.createCaStore([
									CAPair.certificate,
								]),
								sessionCache: {},
								// supported cipher suites in order of preference
								cipherSuites: [
									forge.tls.CipherSuites
										.TLS_RSA_WITH_AES_128_CBC_SHA,
									forge.tls.CipherSuites
										.TLS_RSA_WITH_AES_256_CBC_SHA,
								],
								// require a client-side certificate if you want
								verifyClient: false,
								verify: function (
									connection,
									verified,
									depth,
									certs
								) {
									console.log('Verify ');
									if (depth === 0) {
										var cn =
											certs[0].subject.getField(
												'CN'
											).value;
										if (cn !== 'the-client') {
											verified = {
												alert: forge.tls.Alert
													.Description
													.bad_certificate,
												message:
													'Certificate common name does not match expected client.',
											};
										}
									}
									return verified;
								},
								connected: function (connection) {
									console.log(
										'Sending an encrypted message back to the client!'
									);
									// send message to client

									console.log({ connection });

									// connection.prepare(forge.util.encodeUtf8(
									// 	`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 12\r\n\r\nHello World!`
									// ));

									/* NOTE: experimental, start heartbeat retransmission timer
									myHeartbeatTimer = setInterval(function() {
									  connection.prepareHeartbeatRequest(forge.util.createBuffer('1234'));
									}, 5*60*1000);*/
								},
								getCertificate: function (connection, hint) {
									console.log('====> getCertificate');
									// return certificate;
									// This should return Pem, I think
									return forge.pki.certificateToPem(
										certificate
									);
								},
								getPrivateKey: function (connection, cert) {
									console.log('====> getPrivateKey');
									// return privateKey;
									// This should return Pem, I think
									return forge.pki.privateKeyToPem(
										privateKey
									);
								},
								tlsDataReady: function (connection) {
									console.log('TLS data ready to be sent');
									console.log({ connection });
									const byteString =
										connection.tlsData.getBytes();
									const byteArray = new Uint8Array(
										byteString.length
									);
									for (
										let i = 0;
										i < byteString.length;
										i++
									) {
										byteArray[i] = byteString.charCodeAt(i);
									}
									// TLS data (encrypted) is ready to be sent to the client
									ws.emit('message', { data: byteArray });
									// if you were communicating with the client above you'd do:
									// client.process(connection.tlsData.getBytes());
								},
								dataReady: function (connection) {
									// clear data from the client is ready
									const receivedData = forge.util.decodeUtf8(
										connection.data.getBytes()
									);
									if (receivedData === '') {
										return;
									}
									console.log(
										'Clear data received: ' + receivedData
									);

									// @TODO: stream data from multiple dataReady calls in case the
									//        client, say, uploads a large file
									setTimeout(() => {
										httpRequestToFetch(
											ws.host,
											ws.port,
											receivedData,
											(data) =>
												connection.prepare(
													uint8ArrayToBinaryString(
														new Uint8Array(data)
													)
												),
											() => connection.close()
										);
									});
									console.log({ connection });

									// close connection
									// connection.close();
								},
								/* NOTE: experimental
								heartbeatReceived: function(connection, payload) {
								  // restart retransmission timer, look at payload
								  clearInterval(myHeartbeatTimer);
								  myHeartbeatTimer = setInterval(function() {
									connection.prepareHeartbeatRequest(forge.util.createBuffer('1234'));
								  }, 5*60*1000);
								  payload.getBytes();
								},*/
								closed: function (connection) {
									console.log('disconnected');
								},
								error: function (connection, error) {
									console.log(connection);
									console.log('uh oh', error);
								},
							});
						} catch (e) {
							console.error(e);
						}
						setTimeout(() => {
							this.readyState = this.OPEN;
							this.emit('open');
						});
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

					addEventListener(
						eventName: string,
						callback: (e: any) => void
					) {
						// console.log("Adding listener for ", eventName, " event");
						if (!this.listeners.has(eventName)) {
							this.listeners.set(eventName, new Set());
						}
						this.listeners.get(eventName).add(callback);
					}

					removeListener(
						eventName: string,
						callback: (e: any) => void
					) {
						this.removeEventListener(eventName, callback);
					}

					removeEventListener(
						eventName: string,
						callback: (e: any) => void
					) {
						const listeners = this.listeners.get(eventName);
						if (listeners) {
							listeners.delete(callback);
						}
					}

					emit(eventName: string, data: any = {}) {
						// console.log("dispatching ", eventName, " event");
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

					onclose(data: any) {}
					onerror(data: any) {}
					onmessage(data: any) {}
					onopen(data: any) {}

					send(data: ArrayBuffer) {
						console.log('Send called with ', data);
						try {
							if (this.isPlaintext === null) {
								// If it's a HTTP request, we can just fetch it
								// @TODO: This is very naive. Let's find a more robust way of detecting if
								//        it's a HTTP request
								const string = new TextDecoder().decode(data);
								const firstLine = string.split('\n')[0];
								const [, , version] = firstLine.split(' ');
								this.isPlaintext = version?.startsWith('HTTP');
							}
							if (this.isPlaintext) {
								this.close();
								// httpRequestToFetch(
								// 	this.host,
								// 	this.port,
								// 	new TextDecoder().decode(data),
								// 	(data) => this.emit('message', { data }),
								// 	() => this.close()
								// );
								// console.log('fetch() sent');
								return;
							} else {
								// If it's a HTTPS request, we'll pretend to be the server
								// and negotiate a secure connection
								console.log(new TextDecoder().decode(data));
								this.sslServer.process(
									uint8ArrayToBinaryString(
										new Uint8Array(data)
									)
								);
							}
							return null;
						} catch (e) {
							console.log('Failed to fetch');
							console.error(e);
						}
					}

					close() {
						console.log('Called close()!');
						this.readyState = this.CLOSING;
						this.emit('close');
						this.readyState = this.CLOSED;
					}
				};
			},
		},
	};
};

function httpRequestToFetch(
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
		console.log({ name, value });
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
	console.log({ httpRequest, method, url });

	return fetch(url, {
		method,
		headers,
	})
		.then((response) => {
			console.log('====> Got fetch() response!', response);
			const reader = response.body?.getReader();
			if (reader) {
				const responseHeader = new TextEncoder().encode(
					`HTTP/1.1 ${response.status} ${response.statusText}\r\n${[
						...response.headers,
					]
						.map(([name, value]) => `${name}: ${value}`)
						.join('\r\n')}\r\n\r\n`
				);

				// @TODO: calling onData() and waiting for more reader chunks
				//        passes the control back to PHP.wasm and never yields
				//        the control back to JavaScript. It's likely a polling
				//        issue, or perhaps something specific to a Symfony HTTP
				//        client. Either way, PHP blocks the thread and the
				//        read().then() callback is never called.
				//        We should find a way to yield the control back to
				//        JavaScript after each onData() call.
				//
				//        One clue is PHP runs out of memory when onData() blocks
				//        the event loop. Then it fails with a regular PHP fatal error
				//        message. Perhaps there's an infinite loop somewhere that
				//        fails to correctly poll and increases the memory usage indefinitely.
				const buffer = [responseHeader.buffer];
				const read = () => {
					console.log('Attempt to read the response stream');
					reader
						.read()
						.then(({ done, value }) => {
							// console.log("got some data", value);
							if (done) {
								// @TODO let's stream the chunks as they
								//       arrive without buffering them
								for (const chunk of buffer) {
									onData(chunk);
								}
								onDone();
								return;
							}
							buffer.push(value.buffer);
							read();
						})
						.catch((e) => {
							console.error(e);
						});
				};
				read();
			}
		})
		.catch((e) => {
			console.log('Could not fetch ', url);
			console.error(e);
			throw e;
		});
}

function uint8ArrayToBinaryString(bytes: Uint8Array) {
	const binary = [];
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary.push(String.fromCharCode(bytes[i]));
	}
	return binary.join('');
}

export class WebPHP extends BasePHP {
	/**
	 * Creates a new PHP instance.
	 *
	 * Dynamically imports the PHP module, initializes the runtime,
	 * and sets up networking. It's a shorthand for the lower-level
	 * functions like `getPHPLoaderModule`, `loadPHPRuntime`, and
	 * `PHP.initializeRuntime`
	 *
	 * @param phpVersion The PHP Version to load
	 * @param options The options to use when loading PHP
	 * @returns A new PHP instance
	 */
	static async load(
		phpVersion: SupportedPHPVersion,
		options: PHPWebLoaderOptions = {}
	) {
		return new WebPHP(
			await WebPHP.loadRuntime(phpVersion, options),
			options.requestHandler
		);
	}

	static async loadRuntime(
		phpVersion: SupportedPHPVersion,
		options: PHPWebLoaderOptions = {}
	) {
		// Determine which variant to load based on the requested extensions
		const variant = options.loadAllExtensions ? 'kitchen-sink' : 'light';

		const phpLoaderModule = await getPHPLoaderModule(phpVersion, variant);
		options.downloadMonitor?.expectAssets({
			[phpLoaderModule.dependencyFilename]:
				phpLoaderModule.dependenciesTotalSize,
		});
		return await loadPHPRuntime(phpLoaderModule, {
			...(options.emscriptenOptions || {}),
			...fetchingWebsocket(),
		});
	}
}
