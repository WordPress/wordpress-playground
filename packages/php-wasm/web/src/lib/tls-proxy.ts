import { EmscriptenOptions } from '@php-wasm/universal';
import { ContentTypes, TLS_1_2_Server } from './tls';
import { CertificateGenerator } from './tls/asn_1';

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

	const response = await fetch(url, {
		method,
		headers,
	});

	console.log('====> Got fetch() response!', response);
	const reader = response.body?.getReader();

	if (!reader) {
		throw new Error('No reader');
	}

	const responseHeader = new TextEncoder().encode(
		`HTTP/1.1 ${response.status} ${response.statusText}\r\n${[
			...response.headers,
		]
			.map(([name, value]) => `${name}: ${value}`)
			.join('\r\n')}\r\n\r\n`
	);

	onData(responseHeader.buffer);
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		await new Promise((resolve) => setTimeout(resolve, 1));
		onData(value.buffer);
	}
	// If there's any sleep() between onData() and onDone(), JavaScript
	// will yield the control back to PHP.wasm where a blocking loop will
	// block the event loop and never get to onDone().
	onDone();
}

/**
 * Websocket that buffers the received bytes and translates them into
 * a fetch() call.
 */
export const fetchingWebsocket = (phpModuleArgs: EmscriptenOptions = {}) => {
	console.log('fetching ');
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
			decorator: (original) => {
				console.log('Decorator!', { original, phpModuleArgs });
				const CAroot = phpModuleArgs['CAroot'];

				async function startTLS(ws: any) {
					const host = ws.host;
					const publicKeyBuffer = await crypto.subtle.exportKey(
						'spki',
						CAroot.keyPair.publicKey
					);
					const publicKeyArray = new Uint8Array(publicKeyBuffer);
					const sha1 = await crypto.subtle.digest(
						'SHA-1',
						publicKeyArray
					);
					const sha1Array = new Uint8Array(sha1);
					const sha1Hex = Array.from(sha1Array)
						.map((b) => b.toString(16).padStart(2, '0'))
						.join('');
					console.log('SHA-1 of CAroot public key:', sha1Hex);
					const siteCert =
						await CertificateGenerator.generateCertificate(
							{
								subject: {
									commonName: host,
									organizationName: 'Playground Site',
									countryName: 'US',
								},
								issuer: {
									commonName: 'PlaygroundCA',
									organizationName: 'PlaygroundCA',
									countryName: 'US',
								},
								// authorityKeyIdentifier: {
								// 	keyIdentifier: sha1Array,
								// },
							}
							// CAroot.keyPair.privateKey
						);

					ws.sslServer = new TLS_1_2_Server(
						siteCert.keyPair.privateKey,
						[siteCert.certificate]
					);
					// ws.sslServer = new TLS_1_2_Server(
					// 	CAroot.keyPair.privateKey,
					// 	[CAroot.certificate]
					// );
					ws.sslServer.addEventListener(
						'pass-tls-bytes-to-client',
						(e: CustomEvent) => {
							console.log('Server -> Client: ', e.detail);
							ws.binaryType = 'arraybuffer';
							ws.emit('message', { data: e.detail });
						}
					);
					ws.sslServer.addEventListener(
						'decrypted-bytes-from-client',
						(e: CustomEvent) => {
							console.log('data', e.detail);
							console.log(
								'data',
								new TextDecoder().decode(e.detail)
							);

							httpRequestToFetch(
								ws.host,
								ws.port,
								new TextDecoder().decode(e.detail),
								async (data) => {
									console.log(
										'Got response',
										new TextDecoder().decode(data)
									);
									await ws.sslServer.writeTLSRecord(
										ContentTypes.ApplicationData,
										new Uint8Array(data)
									);
								},
								() => {
									console.log('Closing the connection');
									ws.close();
									ws.sslServer.close();
								}
							);
							console.log('fetch() sent');
						}
					);

					ws.readyState = ws.OPEN;
					ws.emit('open');
					await ws.sslServer.start();
				}

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

						startTLS(this);
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
						console.log('Client -> Server: ', new Uint8Array(data));
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
									this.isPlaintext =
										version?.startsWith('HTTP');
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
								console.log(new TextDecoder().decode(data));
								this.sslServer.receiveBytesFromClient(
									new Uint8Array(data)
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

function uint8ArrayToBinaryString(bytes: Uint8Array) {
	const binary = [];
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary.push(String.fromCharCode(bytes[i]));
	}
	return binary.join('');
}

// async function setupForgeServer(ws: any) {
// 	console.log('setupForgeServer');
// 	try {
// 		ws.sslServer = forge.tls.createConnection({
// 			server: true,
// 			caStore: forge.pki.createCaStore([forgeCert]),
// 			sessionCache: {},
// 			// supported cipher suites in order of preference
// 			cipherSuites: [
// 				forge.tls.CipherSuites
// 					.TLS_RSA_WITH_AES_128_CBC_SHA,
// 				forge.tls.CipherSuites
// 					.TLS_RSA_WITH_AES_256_CBC_SHA,
// 			],
// 			// require a client-side certificate if you want
// 			verifyClient: false,
// 			verify: function (
// 				connection,
// 				verified,
// 				depth,
// 				certs
// 			) {
// 				console.log('Verify ', {
// 					verified,
// 					depth,
// 					certs,
// 				});
// 				return true;
// 				if (depth === 0) {
// 					var cn =
// 						certs[0].subject.getField('CN').value;
// 					if (cn !== 'the-client') {
// 						verified = {
// 							alert: forge.tls.Alert.Description
// 								.bad_certificate,
// 							message:
// 								'Certificate common name does not match expected client.',
// 						};
// 					}
// 				}
// 				return verified;
// 			},
// 			connected: function (connection) {
// 				console.log(
// 					'Sending an encrypted message back to the client!'
// 				);
// 				// send message to client

// 				console.log({ connection });

// 				// connection.prepare(forge.util.encodeUtf8(
// 				// 	`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 12\r\n\r\nHello World!`
// 				// ));

// 				/* NOTE: experimental, start heartbeat retransmission timer
// 				myHeartbeatTimer = setInterval(function() {
// 				  connection.prepareHeartbeatRequest(forge.util.createBuffer('1234'));
// 				}, 5*60*1000);*/
// 			},
// 			getCertificate: function (connection, hint) {
// 				console.log('====> getCertificate');
// 				// return certificate;
// 				// This should return Pem, I think
// 				return caPair.caPem;
// 				// return forgeCert;
// 			},
// 			getPrivateKey: function (connection, cert) {
// 				console.log('====> getPrivateKey');
// 				// return privateKey;
// 				// This should return Pem, I think
// 				return caPair.caKeyPem;
// 				// return forgePrivateKey;
// 			},
// 			tlsDataReady: function (connection) {
// 				console.log('TLS data ready to be sent');
// 				console.log({ connection });
// 				const byteString =
// 					connection.tlsData.getBytes();
// 				const byteArray = new Uint8Array(
// 					byteString.length
// 				);
// 				for (let i = 0; i < byteString.length; i++) {
// 					byteArray[i] = byteString.charCodeAt(i);
// 				}
// 				// TLS data (encrypted) is ready to be sent to the client
// 				ws.emit('message', { data: byteArray });
// 				// if you were communicating with the client above you'd do:
// 				// client.process(connection.tlsData.getBytes());
// 			},
// 			dataReady: function (connection) {
// 				// clear data from the client is ready
// 				const receivedData = forge.util.decodeUtf8(
// 					connection.data.getBytes()
// 				);
// 				if (receivedData === '') {
// 					return;
// 				}
// 				console.log(
// 					'Clear data received: ' + receivedData
// 				);

// 				// @TODO: stream data from multiple dataReady calls in case the
// 				//        client, say, uploads a large file
// 				setTimeout(() => {
// 					httpRequestToFetch(
// 						ws.host,
// 						ws.port,
// 						receivedData,
// 						(data) =>
// 							connection.prepare(
// 								uint8ArrayToBinaryString(
// 									new Uint8Array(data)
// 								)
// 							),
// 						() => connection.close()
// 					);
// 				});
// 				console.log({ connection });

// 				// close connection
// 				// connection.close();
// 			},
// 			/* NOTE: experimental
// 			heartbeatReceived: function(connection, payload) {
// 			  // restart retransmission timer, look at payload
// 			  clearInterval(myHeartbeatTimer);
// 			  myHeartbeatTimer = setInterval(function() {
// 				connection.prepareHeartbeatRequest(forge.util.createBuffer('1234'));
// 			  }, 5*60*1000);
// 			  payload.getBytes();
// 			},*/
// 			closed: function (connection) {
// 				console.log('disconnected');
// 			},
// 			error: function (connection, error) {
// 				console.log(connection);
// 				console.log('uh oh', error);
// 			},
// 		});
// 	} catch (e) {
// 		console.error(e);
// 	}
// 	setTimeout(() => {
// 		ws.readyState = ws.OPEN;
// 		ws.emit('open');
// 	});
// }
