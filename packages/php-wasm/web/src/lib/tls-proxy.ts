import * as forge from 'node-forge';
import { Certificate } from 'crypto';
import { EmscriptenOptions } from '@php-wasm/universal';

export async function generateKeys() {
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

export function createCertificate({ commonName }) {
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
export const fetchingWebsocket = (phpModuleArgs: EmscriptenOptions = {}) => {
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

function uint8ArrayToBinaryString(bytes: Uint8Array) {
	const binary = [];
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary.push(String.fromCharCode(bytes[i]));
	}
	return binary.join('');
}
