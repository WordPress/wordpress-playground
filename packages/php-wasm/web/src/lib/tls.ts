/**
 * To test:
 *
 * http://localhost:5400/website-server/#%7B%22landingPage%22:%22/network-test.php%22,%22preferredVersions%22:%7B%22php%22:%228.0%22,%22wp%22:%22latest%22%7D,%22phpExtensionBundles%22:%5B%22kitchen-sink%22%5D,%22steps%22:%5B%7B%22step%22:%22writeFile%22,%22path%22:%22/wordpress/network-test.php%22,%22data%22:%22%3C?php%20echo%20'Hello-dolly.zip%20downloaded%20from%20https://downloads.wordpress.org/plugin/hello-dolly.1.7.3.zip%20has%20this%20many%20bytes:%20';%20var_dump(strlen(file_get_contents('https://downloads.wordpress.org/plugin/hello-dolly.1.7.3.zip')));%22%7D%5D%7D
 */
import { ServerNameExtension } from './tls/0_server_name';
import { CipherSuites } from './tls/cipher-suites';
import { CipherSuitesNames } from './tls/cipher-suites';
import { ParsedExtension, parseHelloExtensions } from './tls/extensions';

/**
 * Implements TLS 1.2 server-side handshake.
 *
 * See https://datatracker.ietf.org/doc/html/rfc5246.
 */
export class TLS_1_2_Server {
	privateKey: CryptoKey;
	certificatesDER: Uint8Array[];
	receivedBuffer: Uint8Array = new Uint8Array();
	sendBytesToClient: (data: Uint8Array) => void;
	serverRandom: Uint8Array;

	securityParameters: SecurityParameters = {
		entity: ConnectionEnd.Server,
		prf_algorithm: PRFAlgorithm.SHA256,
		bulk_cipher_algorithm: BulkCipherAlgorithm.AES,
		cipher_type: CipherType.Stream,
		enc_key_length: 16,
		block_length: 16,
		fixed_iv_length: 16,
		record_iv_length: 16,
		mac_algorithm: MACAlgorithm.HMACSHA256,
		mac_length: 32,
		mac_key_length: 32,
		compression_algorithm: CompressionMethod.Null,
		master_secret: new Uint8Array(48),
		client_random: new Uint8Array(32),
		server_random: new Uint8Array(32),
	};

	constructor(
		privateKey: CryptoKey,
		certificatesDER: Uint8Array[],
		sendBytesToClient: (data: Uint8Array) => void
	) {
		this.privateKey = privateKey;
		this.certificatesDER = certificatesDER;
		this.sendBytesToClient = sendBytesToClient;
		this.serverRandom = crypto.getRandomValues(new Uint8Array(32));
	}

	receiveBytesFromClient(data: Uint8Array) {
		this.receivedBuffer = concatUint8Arrays([this.receivedBuffer, data]);
	}

	async readBytes(length: number) {
		console.log('Server pulling bytes', length);
		while (this.receivedBuffer.length < length) {
			// Patience is the key...
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		const requestedBytes = this.receivedBuffer.slice(0, length);
		this.receivedBuffer = this.receivedBuffer.slice(length);
		return requestedBytes;
	}

	/**
	 * TLS handshake as per RFC 5246.
	 *
	 * https://datatracker.ietf.org/doc/html/rfc5246#section-7.4
	 */
	async handleTLSHandshake(): Promise<void> {
		const handshakeMessages: Uint8Array[] = [];
		const clientHelloRecord =
			await this.readHandshakeMessage<ClientHello>();
		if (clientHelloRecord.msg_type !== HandshakeType.ClientHello) {
			throw new Error('Expected ClientHello message');
		}
		if (!clientHelloRecord.body.cipher_suites.length) {
			throw new Error(
				'Client did not propose any supported cipher suites.'
			);
		}
		handshakeMessages.push(clientHelloRecord.raw);

		// Step 2: Send ServerHello
		const serverRandom = crypto.getRandomValues(new Uint8Array(32));
		const serverHello = this.serverHelloMessage(clientHelloRecord.body);
		handshakeMessages.push(serverHello);
		this.writeTLSRecord(ContentType.Handshake, serverHello);

		// // Step 3: Send Certificate
		const certificateMessage = this.certificateMessage(
			this.certificatesDER
		);
		handshakeMessages.push(certificateMessage);
		this.writeTLSRecord(ContentType.Handshake, certificateMessage);

		// Step 4: Send ServerHelloDone
		const serverHelloDone = new Uint8Array([
			HandshakeType.ServerHelloDone,
			0x00,
			0x00,
			0x00,
		]);
		handshakeMessages.push(serverHelloDone);
		this.writeTLSRecord(ContentType.Handshake, serverHelloDone);

		// // Step 5: Receive ClientKeyExchange
		const clientKeyExchangeRecord =
			await this.readHandshakeMessage<ClientKeyExchange>();
		if (
			clientKeyExchangeRecord.msg_type !== HandshakeType.ClientKeyExchange
		) {
			throw new Error('Expected ClientKeyExchange message');
		}
		handshakeMessages.push(clientKeyExchangeRecord.raw);

		console.log('this.privateKey', this.privateKey);
		// Decrypt PreMasterSecret and derive masterSecret...
		const preMasterSecret = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: serverRandom },
			this.privateKey,
			clientKeyExchangeRecord.body.exchange_keys
		);
		const preMasterSecretBytes = new Uint8Array(preMasterSecret);

		const masterSecret = await this.PRF(
			preMasterSecretBytes,
			'master secret',
			concatUint8Arrays([clientHelloRecord.body.random, serverRandom]),
			48
		);

		// // Generate Key Material...
		const keyBlockLength = 128; // Total length of key material
		const keyBlock = await this.PRF(
			masterSecret,
			'key expansion',
			concatUint8Arrays([serverRandom, clientHelloRecord.body.random]),
			keyBlockLength
		);

		// Partition the key block
		let offset = 0;

		const clientMACKey = keyBlock.slice(offset, offset + 32); // 32 bytes
		offset += 32;

		const serverMACKey = keyBlock.slice(offset, offset + 32); // 32 bytes
		offset += 32;

		const clientWriteKey = keyBlock.slice(offset, offset + 16); // 16 bytes
		offset += 16;

		const serverWriteKey = keyBlock.slice(offset, offset + 16); // 16 bytes

		// // Step 6: Receive ChangeCipherSpec
		const changeCipherSpecRecord =
			await this.readNextMessage<ChangeCipherSpecMessage>(
				ContentType.ChangeCipherSpec
			);

		// Step 7: Receive and Decrypt Client Finished
		const clientFinishedRecord = await this.readNextMessage<
			HandshakeMessage<Finished>
		>(ContentType.Handshake);

		console.log({ clientFinishedRecord });

		// Decrypt client's Finished message...
		// const decryptedClientFinished = await this.decryptTLSRecord(
		// 	clientFinishedRecord,
		// 	clientWriteKey,
		// 	clientMACKey
		// );

		// // Verify client's Finished message
		// const clientFinishedPayload = decryptedClientFinished.payload;
		// handshakeMessages.push(clientFinishedPayload); // Include the client's Finished message

		// const concatenatedHandshakeMessages = concatUint8Arrays(
		// 	handshakeMessages.slice(0, -1)
		// ); // Exclude client's Finished
		// const expectedClientVerifyData = await this.buildVerifyData(
		// 	masterSecret,
		// 	'client finished',
		// 	concatenatedHandshakeMessages
		// );

		// const clientVerifyData = clientFinishedPayload.slice(4); // Remove handshake header
		// if (!arraysEqual(clientVerifyData, expectedClientVerifyData)) {
		// 	throw new Error('Client Finished verify_data does not match');
		// }

		// // Step 8: Send ChangeCipherSpec
		// const serverChangeCipherSpec = new Uint8Array([0x01]);
		// this.writeTLSRecord(20, serverChangeCipherSpec);

		// // Step 9: Send Server Finished
		// const concatenatedHandshakeMessagesForServer =
		// 	concatUint8Arrays(handshakeMessages);
		// const serverFinishedMessage = await this.buildFinishedMessage(
		// 	masterSecret,
		// 	'server finished',
		// 	concatenatedHandshakeMessagesForServer
		// );

		// // Encrypt the Finished message...
		// const encryptedServerFinished = await this.encryptTLSRecord(
		// 	serverFinishedMessage,
		// 	serverWriteKey,
		// 	serverMACKey
		// );
		// this.writeTLSRecord(22, encryptedServerFinished);

		// Handshake complete
	}

	async createDecipher(key: Uint8Array): Promise<CryptoKey> {
		return crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, [
			'decrypt',
		]);
	}

	async createCipher(key: Uint8Array): Promise<CryptoKey> {
		return crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, [
			'encrypt',
		]);
	}

	awaitingTLSMessages: Array<TLSMessage> = [];

	async readHandshakeMessage<BodyType extends HandshakeMessageBody>() {
		return await this.readNextMessage<HandshakeMessage<BodyType>>(
			ContentType.Handshake
		);
	}

	async readNextMessage<Message extends TLSMessage>(
		requestedType: ContentType
	): Promise<Message> {
		while (true) {
			for (let i = 0; i < this.awaitingTLSMessages.length; i++) {
				const message = this.awaitingTLSMessages[i];
				if (message.type === requestedType) {
					const message = this.awaitingTLSMessages[i];
					this.awaitingTLSMessages.splice(i, 1);
					return message as Message;
				}
			}
			const record = await this.readTLSRecord();
			const gotCompleteRecord = await this.processTLSRecord(record);
			if (!gotCompleteRecord) {
				continue;
			}
			switch (record.type) {
				case ContentType.Handshake: {
					const plaintext = record as TLSPlaintext;
					this.awaitingTLSMessages.push(
						this.parseHandshakeMessage(plaintext.fragment)
					);
					break;
				}
				case ContentType.Alert: {
					const alert = record as TLSPlaintext;
					this.awaitingTLSMessages.push({
						type: record.type,
						level: alert.fragment[0],
						description: alert.fragment[1],
					});
					break;
				}
			}
			console.log(
				'NEW TLS MESSAGE',
				this.awaitingTLSMessages[this.awaitingTLSMessages.length - 1]
			);
		}
	}

	bufferedRecords: Partial<Record<ContentType, Uint8Array>> = {};
	async processTLSRecord(record: TLSRecord): Promise<boolean> {
		switch (record.type) {
			case ContentType.Handshake: {
				const plaintext = record as TLSPlaintext;
				const message = concatUint8Arrays([
					this.bufferedRecords[record.type] || new Uint8Array(),
					plaintext.fragment,
				]);
				this.bufferedRecords[record.type] = message;
				// We don't have the message header yet, let's wait for more data.
				if (message.length < 4) {
					return false;
				}
				const length = (message[1] << 8) | message[2];
				if (message.length < 3 + length) {
					return false;
				}
				return true;
			}
			case ContentType.Alert: {
				const plaintext = record as TLSPlaintext;
				const message = concatUint8Arrays([
					this.bufferedRecords[record.type] || new Uint8Array(),
					plaintext.fragment,
				]);
				if (message.length < 2) {
					return false;
				}
				return true;
			}
			default:
				throw new Error(`Unsupported record type ${record.type}`);
		}
	}

	parseHandshakeMessage<T extends HandshakeMessageBody>(
		message: Uint8Array
	): HandshakeMessage<T> {
		const msg_type = message[0];
		const length = (message[1] << 16) | (message[2] << 8) | message[3];
		const bodyBytes = message.slice(4);
		let body: HandshakeMessageBody | undefined = undefined;
		switch (msg_type) {
			case HandshakeType.HelloRequest:
				body = {} as HelloRequest;
				break;
			/*
				Offset  Size    Field
				(bytes) (bytes)
				+------+------+---------------------------+
				| 0000 |  1   | Handshake Type (1 = ClientHello)
				+------+------+---------------------------+
				| 0001 |  3   | Length of ClientHello
				+------+------+---------------------------+
				| 0004 |  2   | Protocol Version
				+------+------+---------------------------+
				| 0006 |  32  | Client Random
				|      |      | (4 bytes timestamp +
				|      |      |  28 bytes random)
				+------+------+---------------------------+
				| 0038 |  1   | Session ID Length
				+------+------+---------------------------+
				| 0039 |  0+  | Session ID (variable)
				|      |      | (0-32 bytes)
				+------+------+---------------------------+
				| 003A*|  2   | Cipher Suites Length
				+------+------+---------------------------+
				| 003C*|  2+  | Cipher Suites
				|      |      | (2 bytes each)
				+------+------+---------------------------+
				| xxxx |  1   | Compression Methods Length
				+------+------+---------------------------+
				| xxxx |  1+  | Compression Methods
				|      |      | (1 byte each)
				+------+------+---------------------------+
				| xxxx |  2   | Extensions Length
				+------+------+---------------------------+
				| xxxx |  2   | Extension Type
				+------+------+---------------------------+
				| xxxx |  2   | Extension Length
				+------+------+---------------------------+
				| xxxx |  v   | Extension Data
				+------+------+---------------------------+
				|      |      | (Additional extensions...)
				+------+------+---------------------------+
				*/
			case HandshakeType.ClientHello: {
				const reader = new ArrayBufferReader(bodyBytes.buffer);

				const buff: Partial<ClientHello> = {
					client_version: reader.readUint8Array(2),
					random: {
						gmtUnixTime: reader.readUint32(),
						randomBytes: reader.readUint8Array(28),
					},
				};
				const sessionIdLength = reader.readUint8();
				buff.session_id = reader.readUint8Array(sessionIdLength);

				const cipherSuitesLength = reader.readUint16();
				buff.cipher_suites = parseCipherSuites(
					reader.readUint8Array(cipherSuitesLength).buffer
				);

				const compressionMethodsLength = reader.readUint8();
				buff.compression_methods = reader.readUint8Array(
					compressionMethodsLength
				);

				const extensionsLength = reader.readUint16();
				buff.extensions = parseHelloExtensions(
					reader.readUint8Array(extensionsLength)
				);
				return {
					type: ContentType.Handshake,
					msg_type,
					length,
					body: buff as T,
					raw: message,
				} as HandshakeMessage<T>;
			}
			case HandshakeType.Certificate:
				body = {
					certificate_list: [bodyBytes.slice(0, bodyBytes.length)],
				} as Certificate;
				break;
			case HandshakeType.ServerKeyExchange:
				body = {
					params: bodyBytes.slice(0, bodyBytes.length),
					signed_params: bodyBytes.slice(0, bodyBytes.length),
				} as ServerKeyExchange;
				break;
			case HandshakeType.CertificateRequest:
				body = {
					certificate_types: bodyBytes.slice(0, bodyBytes.length),
					supported_signature_algorithms: bodyBytes.slice(
						0,
						bodyBytes.length
					),
					certificate_authorities: bodyBytes.slice(
						0,
						bodyBytes.length
					),
				} as CertificateRequest;
				break;
			case HandshakeType.ServerHelloDone:
				body = {};
				break;
			case HandshakeType.CertificateVerify:
				body = {
					algorithm: bodyBytes.slice(0, 2),
					signature: bodyBytes.slice(2, bodyBytes.length),
				} as CertificateVerify;
				break;
			case HandshakeType.ClientKeyExchange:
				body = {
					exchange_keys: bodyBytes.slice(0, bodyBytes.length),
				} as ClientKeyExchange;
				break;
			case HandshakeType.Finished:
				body = {
					verify_data: bodyBytes.slice(0, bodyBytes.length),
				} as Finished;
				break;
			default:
				throw new Error('Invalid handshake type');
		}
		return {
			type: ContentType.Handshake,
			msg_type,
			length,
			body: body as T,
			raw: message,
		};
	}

	async readTLSRecord(): Promise<TLSRecord> {
		// Read the TLS record header (5 bytes)
		const header = await this.readBytes(5);
		const type = header[0];
		const version = {
			major: header[1],
			minor: header[2],
		};
		const length = (header[3] << 8) | header[4];

		switch (type) {
			case ContentType.Alert:
			case ContentType.Handshake:
			case ContentType.ChangeCipherSpec:
				return {
					type,
					version,
					length,
					fragment: await this.readBytes(length),
				} as TLSPlaintext;
			// case ContentType.ApplicationData:
			// 	return {
			// 		type,
			// 		version,
			// 		length,
			// 		fragment: await this.readTLSCipherFragment(
			// 			this.securityParameters.cipher_type,
			// 			length
			// 		),
			// 	};
			default:
				throw new Error(`Unsupported record type ${type}`);
		}
	}

	async readTLSCipherFragment<T extends CipherFragmentPair>(
		cipherType: T['cipherType'],
		length: number
	): Promise<T['fragment']> {
		switch (cipherType) {
			case CipherType.Stream:
				return {
					content: await this.readBytes(length),
					MAC: await this.readBytes(32),
				};
			case CipherType.Block:
				return {
					IV: await this.readBytes(16),
					block_ciphered: {
						content: await this.readBytes(length),
						MAC: await this.readBytes(32),
						padding: await this.readBytes(1),
						padding_length: 0,
					},
				};
			case CipherType.AEAD:
				return {
					nonce_explicit: await this.readBytes(12),
					aead_encrypted: await this.readBytes(length),
				};
			default:
				throw new Error(`Unsupported cipher type ${cipherType}`);
		}
	}

	// Function to write a TLS record
	writeTLSRecord(contentType: number, data: Uint8Array): void {
		const version = [0x03, 0x03]; // TLS 1.2
		const length = data.length;
		const header = new Uint8Array(5);
		header[0] = contentType;
		header[1] = version[0];
		header[2] = version[1];
		header[3] = (length >> 8) & 0xff;
		header[4] = length & 0xff;

		const record = concatUint8Arrays([header, data]);
		this.sendBytesToClient(record);
	}

	// Function to build ServerHello message
	private serverHelloMessage(clientHello: ClientHello): Uint8Array {
		const extensionsParts: Uint8Array[] = [];
		for (const extension of clientHello.extensions) {
			switch (extension['type']) {
				case 'server_name':
					/**
					 * The server SHALL include an extension of type "server_name" in the
					 * (extended) server hello.  The "extension_data" field of this extension
					 * SHALL be empty.
					 *
					 * Source: dfile:///Users/cloudnik/Library/Application%20Support/Dash/User%20Contributed/RFCs/RFCs.docset/Contents/Resources/Documents/rfc6066.html#section-3
					 */
					ServerNameExtension.encode();
					break;
			}
		}
		const extensions = concatUint8Arrays(extensionsParts);

		const bodyParts: Uint8Array[] = [
			// Version field – 0x03, 0x03 means TLS 1.2
			new Uint8Array([0x03, 0x03]),

			this.serverRandom,

			new Uint8Array([clientHello.session_id.length]),
			clientHello.session_id,

			// CipherSuite: TLS_RSA_WITH_AES_128_CBC_SHA,
			// new Uint8Array([0x00, 0x2f]),
			new Uint8Array([
				(CipherSuites.TLS1_CK_RSA_WITH_AES_128_GCM_SHA256 >> 8) & 0xff,
				CipherSuites.TLS1_CK_RSA_WITH_AES_128_GCM_SHA256 & 0xff,
			]),

			// Compression method: No compression
			new Uint8Array([0x00]),

			// Extensions length (2 bytes)
			new Uint8Array([extensions.length << 8, extensions.length]),
			extensions,
		];

		const body = concatUint8Arrays(bodyParts);
		const header = new Uint8Array([
			HandshakeType.ServerHello,

			// Body length is encoded using 3 bytes:
			(body.length >> 16) & 0xff,
			(body.length >> 8) & 0xff,
			body.length & 0xff,
		]);

		return concatUint8Arrays([header, body]);
	}

	private certificateMessage(certificates: Uint8Array[]): Uint8Array {
		const certsBytesLength = certificates.reduce(
			(acc, cert) => acc + cert.length,
			0
		);
		const certsWithHeadersLength =
			certsBytesLength + 3 * certificates.length;

		const body = new Uint8Array(certsWithHeadersLength + 3);
		body[0] = (certsWithHeadersLength >> 16) & 0xff;
		body[1] = (certsWithHeadersLength >> 8) & 0xff;
		body[2] = certsWithHeadersLength & 0xff;

		let offset = 3;
		for (const cert of certificates) {
			body[offset] = (cert.length >> 16) & 0xff;
			body[offset + 1] = (cert.length >> 8) & 0xff;
			body[offset + 2] = cert.length & 0xff;
			offset += 3;
			body.set(cert, offset);
			offset += cert.length;
		}

		const length = body.length;
		const header = new Uint8Array([
			HandshakeType.Certificate,
			(length >> 16) & 0xff,
			(length >> 8) & 0xff,
			length & 0xff,
		]);

		return concatUint8Arrays([header, body]);
	}

	async PRF(
		secret: Uint8Array,
		label: string,
		seed: Uint8Array,
		size: number
	): Promise<Uint8Array> {
		const labelBytes = new TextEncoder().encode(label);
		const seedBytes = seed;
		const concatenatedSeed = concatUint8Arrays([labelBytes, seedBytes]);
		const hashAlg = 'SHA-256'; // For TLS 1.2 with SHA-256
		return await this.P_hash(hashAlg, secret, concatenatedSeed, size);
	}

	// P_hash function used in TLS PRF
	async P_hash(
		hashAlg: string,
		secret: Uint8Array,
		seed: Uint8Array,
		size: number
	): Promise<Uint8Array> {
		let A = seed;
		let result = new Uint8Array(0);

		while (result.length < size) {
			A = await this.HMAC(hashAlg, secret, A);
			const output = await this.HMAC(
				hashAlg,
				secret,
				concatUint8Arrays([A, seed])
			);
			result = concatUint8Arrays([result, output]);
		}

		return result.slice(0, size);
	}

	// HMAC function
	async HMAC(
		hashAlg: string,
		key: Uint8Array,
		data: Uint8Array
	): Promise<Uint8Array> {
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			key,
			{
				name: 'HMAC',
				hash: { name: hashAlg },
			},
			false,
			['sign']
		);

		const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
		return new Uint8Array(signature);
	}

	// Function to build Finished message
	async buildFinishedMessage(
		masterSecret: Uint8Array,
		label: string, // "client finished" or "server finished"
		handshakeMessages: Uint8Array
	): Promise<Uint8Array> {
		// Compute verify_data
		const verifyData = await this.buildVerifyData(
			masterSecret,
			label,
			handshakeMessages
		);

		// Build the Finished message
		const handshakeType = 0x14; // Finished message type
		const length = verifyData.length;
		const header = new Uint8Array([
			handshakeType,
			(length >> 16) & 0xff,
			(length >> 8) & 0xff,
			length & 0xff,
		]);

		return concatUint8Arrays([header, verifyData]);
	}

	async buildVerifyData(
		masterSecret: Uint8Array,
		label: string, // "client finished" or "server finished"
		handshakeMessages: Uint8Array
	): Promise<Uint8Array> {
		// Compute the hash of the handshake messages
		const hashAlg = 'SHA-256'; // Assuming SHA-256 for TLS 1.2
		const hashBuffer = await crypto.subtle.digest(
			hashAlg,
			handshakeMessages
		);
		const handshakeHash = new Uint8Array(hashBuffer);

		// Compute verify_data using PRF
		const verifyData = await this.PRF(
			masterSecret,
			label,
			handshakeHash,
			12 // verify_data length is 12 bytes
		);

		return verifyData;
	}

	async encryptTLSRecord(
		plaintext: Uint8Array,
		writeKey: Uint8Array,
		macKey: Uint8Array
	): Promise<Uint8Array> {
		// Compute MAC (HMAC)
		const mac = await this.HMAC('SHA-256', macKey, plaintext);

		// Append MAC to plaintext
		const plaintextWithMac = concatUint8Arrays([plaintext, mac]);

		// Encrypt using AES-CBC
		const iv = crypto.getRandomValues(new Uint8Array(16));
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			writeKey,
			{ name: 'AES-CBC' },
			false,
			['encrypt']
		);
		const encryptedData = await crypto.subtle.encrypt(
			{ name: 'AES-CBC', iv },
			cryptoKey,
			plaintextWithMac
		);

		// Build TLS record
		const encryptedPayload = new Uint8Array(encryptedData);
		const recordHeader = new Uint8Array(5);
		recordHeader[0] = 22; // ContentType: Handshake
		recordHeader[1] = 0x03; // TLS 1.2
		recordHeader[2] = 0x03;
		const length = iv.length + encryptedPayload.length;
		recordHeader[3] = (length >> 8) & 0xff;
		recordHeader[4] = length & 0xff;

		// Build final record
		return concatUint8Arrays([recordHeader, iv, encryptedPayload]);
	}

	async decryptTLSRecord(
		record: { contentType: number; payload: Uint8Array },
		readKey: Uint8Array,
		macKey: Uint8Array
	): Promise<{ payload: Uint8Array }> {
		const iv = record.payload.slice(0, 16);
		const encryptedData = record.payload.slice(16);

		// Decrypt using AES-CBC
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			readKey,
			{ name: 'AES-CBC' },
			false,
			['decrypt']
		);
		const decryptedData = await crypto.subtle.decrypt(
			{ name: 'AES-CBC', iv },
			cryptoKey,
			encryptedData.buffer
		);
		const decryptedBytes = new Uint8Array(decryptedData);

		// Separate plaintext and MAC
		const macLength = 32; // For HMAC-SHA256
		const plaintextLength = decryptedBytes.length - macLength;
		const plaintext = decryptedBytes.slice(0, plaintextLength);
		const receivedMac = decryptedBytes.slice(plaintextLength);

		// Verify MAC
		const expectedMac = await this.HMAC('SHA-256', macKey, plaintext);
		if (!arraysEqual(receivedMac, expectedMac)) {
			throw new Error('Invalid MAC in decrypted TLS record');
		}

		return { payload: plaintext };
	}
}

export class ArrayBufferReader {
	private view: DataView;
	offset = 0;
	constructor(private buffer: ArrayBuffer) {
		this.view = new DataView(buffer);
	}

	readUint8(): number {
		const value = this.view.getUint8(this.offset);
		this.offset += 1;
		return value;
	}
	readUint16(): number {
		const value = this.view.getUint16(this.offset);
		this.offset += 2;
		return value;
	}
	readUint32(): number {
		const value = this.view.getUint32(this.offset);
		this.offset += 4;
		return value;
	}
	readUint8Array(length: number): Uint8Array {
		const value = this.buffer.slice(this.offset, this.offset + length);
		this.offset += length;
		return new Uint8Array(value);
	}

	isFinished() {
		return this.offset >= this.buffer.byteLength;
	}
}

/**
 * Parses the cipher suites from the server hello message.
 *
 * The cipher suites are encoded as a list of 2-byte values.
 *
 * Binary layout:
 *
 * +----------------------------+
 * | Cipher Suites Length       |  2 bytes
 * +----------------------------+
 * | Cipher Suite 1             |  2 bytes
 * +----------------------------+
 * | Cipher Suite 2             |  2 bytes
 * +----------------------------+
 * | ...                        |
 * +----------------------------+
 * | Cipher Suite n             |  2 bytes
 * +----------------------------+
 *
 *
 * The full list of supported cipher suites values is available at:
 *
 * https://www.iana.org/assignments/tls-parameters/tls-parameters.xhtml#tls-parameters-4
 */
function parseCipherSuites(buffer: ArrayBuffer): string[] {
	const reader = new ArrayBufferReader(buffer);
	// Skip the length of the cipher suites
	reader.readUint16();

	const cipherSuites = [];
	while (!reader.isFinished()) {
		const suite = reader.readUint16();
		if (suite in CipherSuitesNames) {
			cipherSuites.push(CipherSuitesNames[suite]);
		} else {
			console.log('cipherSuite', suite);
		}
	}
	return cipherSuites;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	arrays.forEach((arr) => {
		totalLength += arr.length;
	});
	const result = new Uint8Array(totalLength);
	let offset = 0;
	arrays.forEach((arr) => {
		result.set(arr, offset);
		offset += arr.length;
	});
	return result;
}

/**
 * TLS 1.2 Record layer types defined after the structs
 * from the TLS 1.2 RFC.
 * https://datatracker.ietf.org/doc/html/rfc5246#section-6.2
 */

type SecurityParameters = {
	entity: ConnectionEnd;
	prf_algorithm: PRFAlgorithm;
	bulk_cipher_algorithm: BulkCipherAlgorithm;
	cipher_type: CipherType;
	enc_key_length: number;
	block_length: number;
	fixed_iv_length: number;
	record_iv_length: number;
	mac_algorithm: MACAlgorithm;
	mac_length: number;
	mac_key_length: number;
	compression_algorithm: CompressionMethod;
	master_secret: Uint8Array; // 48 bytes
	client_random: Uint8Array; // 32 bytes
	server_random: Uint8Array; // 32 bytes
};

const enum ConnectionEnd {
	Client = 0,
	Server = 1,
}

const enum PRFAlgorithm {
	SHA256 = 0,
}

const enum BulkCipherAlgorithm {
	Null = 0,
	AES = 1,
}

const enum CipherType {
	Stream = 0,
	Block = 1,
	AEAD = 2,
}

const enum MACAlgorithm {
	Null = 0,
	HMACSHA256 = 1,
}

const enum CompressionMethod {
	Null = 0,
	Deflate = 1,
}

/**
 * TLS 1.2 Record layer types defined after the structs
 * from the TLS 1.2 RFC.
 * https://datatracker.ietf.org/doc/html/rfc5246#section-6.2.1
 */

const enum ContentType {
	ChangeCipherSpec = 20,
	Alert = 21,
	Handshake = 22,
	ApplicationData = 23,
}

type FragmentType =
	| GenericStreamCipher
	| GenericBlockCipher
	| GenericAEADCipher;
type CipherFragmentPair =
	| { cipherType: CipherType.Stream; fragment: GenericStreamCipher }
	| { cipherType: CipherType.Block; fragment: GenericBlockCipher }
	| { cipherType: CipherType.AEAD; fragment: GenericAEADCipher };

interface TLSCiphertext<T extends FragmentType> {
	type: ContentType; // 1 byte
	version: ProtocolVersion; // 2 bytes
	length: number; // 2 bytes
	fragment: T; // variable length
}

interface TLSPlaintext {
	type: ContentType; // 1 byte
	version: ProtocolVersion; // 2 bytes
	length: number; // 2 bytes
	fragment: Uint8Array; // variable length
}

interface TLSCompressed {
	type: ContentType;
	version: ProtocolVersion;
	length: number;
	fragment: Uint8Array;
}

type TLSRecord = TLSPlaintext | TLSCiphertext<FragmentType> | TLSCompressed;

interface ProtocolVersion {
	major: number;
	minor: number;
}

interface GenericStreamCipher {
	content: Uint8Array;
	MAC: Uint8Array;
}

interface GenericBlockCipher {
	IV: Uint8Array;
	block_ciphered: BlockCiphered;
}

interface BlockCiphered {
	content: Uint8Array;
	MAC: Uint8Array;
	padding: Uint8Array;
	padding_length: number;
}

interface GenericAEADCipher {
	nonce_explicit: Uint8Array;
	aead_encrypted: Uint8Array;
}

/**
 * TLS 1.2 Handshake types defined after the structs
 * from the TLS 1.2 RFC.
 * https://datatracker.ietf.org/doc/html/rfc5246#section-7.4
 */

type TLSMessage =
	| AlertMessage
	| HandshakeMessage<any>
	| ChangeCipherSpecMessage;
// | ApplicationDataMessage;

interface AlertMessage {
	type: ContentType.Alert;
	level: AlertLevel;
	description: AlertDescription;
}

const enum AlertLevel {
	Warning = 1,
	Fatal = 2,
}

const enum AlertDescription {
	CloseNotify = 0,
	UnexpectedMessage = 10,
	BadRecordMac = 20,
	DecryptionFailed = 21,
	RecordOverflow = 22,
	DecompressionFailure = 30,
	HandshakeFailure = 40,
	NoCertificate = 41,
	BadCertificate = 42,
	UnsupportedCertificate = 43,
	CertificateRevoked = 44,
	CertificateExpired = 45,
	CertificateUnknown = 46,
	IllegalParameter = 47,
	UnknownCa = 48,
	AccessDenied = 49,
	DecodeError = 50,
	DecryptError = 51,
	ExportRestriction = 60,
	ProtocolVersion = 70,
	InsufficientSecurity = 71,
	InternalError = 80,
	UserCanceled = 90,
	NoRenegotiation = 100,
	UnsupportedExtension = 110,
}

interface ChangeCipherSpecMessage {
	type: ContentType.ChangeCipherSpec;
	body: Uint8Array;
}

const enum HandshakeType {
	HelloRequest = 0,
	ClientHello = 1,
	ServerHello = 2,
	Certificate = 11,
	ServerKeyExchange = 12,
	CertificateRequest = 13,
	ServerHelloDone = 14,
	CertificateVerify = 15,
	ClientKeyExchange = 16,
	Finished = 20,
}

type HandshakeMessageBody =
	| HelloRequest
	| ClientHello
	| ServerHello
	| Certificate
	| ServerKeyExchange
	| CertificateRequest
	| ServerHelloDone
	| CertificateVerify
	| ClientKeyExchange
	| Finished;

interface HandshakeMessage<Body extends HandshakeMessageBody> {
	type: ContentType.Handshake;
	msg_type: HandshakeType; // 1 byte
	length: number; // 2 bytes
	// Custom property to hold the raw body of the message
	body: Body;
	raw: Uint8Array;
}

// Specific Handshake Message Types
interface HelloRequest {} // Empty for TLS 1.2

/**
 * 1 byte
 */
type SessionId = Uint8Array;
type Random = {
	/**
	 * 4 bytes
	 */
	gmtUnixTime: Number;
	/**
	 * 28 bytes
	 */
	randomBytes: Uint8Array;
};
interface ClientHello {
	client_version: Uint8Array; // 2 bytes
	random: Random; // 32 bytes
	session_id: SessionId;
	cipher_suites: string[];
	compression_methods: Uint8Array;
	extensions: ParsedExtension[];
}

interface ServerHello {
	server_version: Uint8Array; // 2 bytes
	random: Uint8Array; // 32 bytes
	session_id: Uint8Array;
	cipher_suite: Uint8Array; // 2 bytes
	compression_method: number;
	extensions?: Uint8Array;
}

interface Certificate {
	certificate_list: Uint8Array[];
}

interface ServerKeyExchange {
	params: Uint8Array;
	signed_params: Uint8Array;
}

interface CertificateRequest {
	certificate_types: Uint8Array;
	supported_signature_algorithms: Uint8Array;
	certificate_authorities: Uint8Array;
}

interface ServerHelloDone {} // Empty for TLS 1.2

interface CertificateVerify {
	algorithm: Uint8Array;
	signature: Uint8Array;
}

interface ClientKeyExchange {
	exchange_keys: Uint8Array;
}

interface Finished {
	verify_data: Uint8Array;
}
