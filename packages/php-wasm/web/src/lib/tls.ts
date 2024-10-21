/**
 * To test:
 *
 * http://localhost:5400/website-server/#%7B%22landingPage%22:%22/network-test.php%22,%22preferredVersions%22:%7B%22php%22:%228.0%22,%22wp%22:%22latest%22%7D,%22phpExtensionBundles%22:%5B%22kitchen-sink%22%5D,%22steps%22:%5B%7B%22step%22:%22writeFile%22,%22path%22:%22/wordpress/network-test.php%22,%22data%22:%22%3C?php%20echo%20'Hello-dolly.zip%20downloaded%20from%20https://downloads.wordpress.org/plugin/hello-dolly.1.7.3.zip%20has%20this%20many%20bytes:%20';%20var_dump(strlen(file_get_contents('https://downloads.wordpress.org/plugin/hello-dolly.1.7.3.zip')));%22%7D%5D%7D
 */
import { ServerNameExtension } from './tls/0_server_name';
import { CipherSuitesNames } from './tls/cipher-suites';
import { CipherSuites } from './tls/cipher-suites';
import { SupportedGroupsExtension } from './tls/10_supported_groups';
import { ECPointFormatsExtension } from './tls/11_ec_point_formats';
import { ParsedExtension, parseHelloExtensions } from './tls/extensions';
import { flipObject } from './tls/utils';
import {
	HashAlgorithms,
	SignatureAlgorithms,
	SignatureAlgorithmsExtension,
} from './tls/13_signature_algorithms';
import { stringToArrayBuffer, tls12Prf } from './tls/prf';

class TLSConnectionClosed extends Error {}

/**
 * Implements TLS 1.2 server-side handshake.
 *
 * See https://datatracker.ietf.org/doc/html/rfc5246.
 */
export class TLS_1_2_Server extends EventTarget {
	privateKey: CryptoKey;
	certificatesDER: Uint8Array[];
	receivedBuffer: Uint8Array = new Uint8Array();
	handshakeMessages: Uint8Array[] = [];

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
		server_random: crypto.getRandomValues(new Uint8Array(32)),
	};

	private clientPublicKey: CryptoKey | undefined;
	private ecdheKeyPair: CryptoKeyPair | undefined;
	private sessionKeys: SessionKeys | undefined;
	private closed = false;

	constructor(privateKey: CryptoKey, certificatesDER: Uint8Array[]) {
		super();
		this.privateKey = privateKey;
		this.certificatesDER = certificatesDER;
	}

	sendBytesToClient(data: Uint8Array) {
		this.dispatchEvent(
			new CustomEvent('pass-tls-bytes-to-client', {
				detail: data,
			})
		);
	}

	receiveBytesFromClient(data: Uint8Array) {
		this.receivedBuffer = concatUint8Arrays([this.receivedBuffer, data]);
	}

	async start() {
		await this.handleTLSHandshake();
		this.startEmitingApplicationData();
	}

	close() {
		this.closed = true;
	}

	/**
	 * TLS handshake as per RFC 5246.
	 *
	 * https://datatracker.ietf.org/doc/html/rfc5246#section-7.4
	 */
	async handleTLSHandshake(): Promise<void> {
		const clientHelloRecord = await this.readHandshakeMessage(
			HandshakeType.ClientHello
		);
		if (!clientHelloRecord.body.cipher_suites.length) {
			throw new Error(
				'Client did not propose any supported cipher suites.'
			);
		}
		this.securityParameters.client_random = clientHelloRecord.body.random;

		// Step 2: Send ServerHello
		const serverHello = this.serverHelloMessage(clientHelloRecord.body);
		await this.writeTLSRecord(ContentTypes.Handshake, serverHello);

		// Step 3: Send Certificate
		const certificateMessage = this.certificateMessage();
		await this.writeTLSRecord(ContentTypes.Handshake, certificateMessage);

		// Step 4: Send ServerKeyExchange
		this.ecdheKeyPair = await crypto.subtle.generateKey(
			{
				name: 'ECDH',
				namedCurve: 'P-256', // Use secp256r1 curve
			},
			true, // Extractable
			['deriveKey', 'deriveBits'] // Key usage
		);
		const serverKeyExchange = await generateECDHEServerKeyExchange(
			this.securityParameters.client_random,
			this.securityParameters.server_random,
			this.ecdheKeyPair,
			this.privateKey
		);
		await this.writeTLSRecord(ContentTypes.Handshake, serverKeyExchange);
		console.log('serverKeyExchange', serverKeyExchange);

		// Step 4: Send ServerHelloDone
		const serverHelloDone = new Uint8Array([
			HandshakeType.ServerHelloDone,
			...as3Bytes(0),
		]);
		await this.writeTLSRecord(ContentTypes.Handshake, serverHelloDone);
		console.log('serverHelloDone', serverHelloDone);

		// Step 5: Receive ClientKeyExchange
		const clientKeyExchangeRecord = await this.readHandshakeMessage(
			HandshakeType.ClientKeyExchange
		);
		console.log('clientKeyExchangeRecord', clientKeyExchangeRecord);
		this.clientPublicKey = await crypto.subtle.importKey(
			'raw',
			clientKeyExchangeRecord.body.exchange_keys,
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			[]
		);

		await this.readNextMessage(ContentTypes.ChangeCipherSpec);
		console.log('changeCipherSpec');
		this.sessionKeys = await this.deriveSessionKeys();
		await this.readHandshakeMessage(HandshakeType.Finished);
		console.log('finished');
		// We're not actually verifying the hash provided by client
		// as we're not concerned with the client's identity.

		await this.writeTLSRecord(
			ContentTypes.ChangeCipherSpec,
			new Uint8Array([0x01])
		);
		await this.writeTLSRecord(
			ContentTypes.Handshake,
			await this.createFinishedMessage()
		);
	}

	async startEmitingApplicationData() {
		try {
			while (true) {
				const appData = await this.readNextMessage(
					ContentTypes.ApplicationData
				);
				this.dispatchEvent(
					new CustomEvent('decrypted-bytes-from-client', {
						detail: appData.body,
					})
				);
			}
		} catch (e) {
			if (e instanceof TLSConnectionClosed) {
				// Connection closed, no more application data to emit.
				return;
			}
			throw e;
		}
	}

	/**
	 * Server finished message.
	 * The structure is defined in:
	 * https://datatracker.ietf.org/doc/html/rfc5246#section-7.4.9
	 *
	 * struct {
	 *     opaque verify_data[verify_data_length];
	 * } Finished;
	 *
	 * verify_data
	 *    PRF(master_secret, finished_label, Hash(handshake_messages))
	 *       [0..verify_data_length-1];
	 *
	 * finished_label
	 *    For Finished messages sent by the client, the string
	 *    "client finished".  For Finished messages sent by the server,
	 *    the string "server finished".
	 */
	async createFinishedMessage(): Promise<Uint8Array> {
		// Step 1: Compute the hash of the handshake messages
		const handshakeHash = await crypto.subtle.digest(
			'SHA-256',
			concatUint8Arrays(this.handshakeMessages)
		);

		// Step 2: Compute the verify_data using the PRF
		const verifyData = new Uint8Array(
			await tls12Prf(
				this.securityParameters.master_secret,
				stringToArrayBuffer('server finished'),
				handshakeHash,
				// verify_data length. TLS 1.2 specifies 12 bytes for verify_data
				12
			)
		);

		// Step 3: Construct the Finished message
		return new Uint8Array([
			HandshakeType.Finished,
			...as3Bytes(verifyData.length),
			...verifyData,
		]);
	}

	async readHandshakeMessage(
		messageType: HandshakeType.ClientHello
	): Promise<HandshakeMessage<ClientHello>>;
	async readHandshakeMessage(
		messageType: HandshakeType.ClientKeyExchange
	): Promise<HandshakeMessage<ClientKeyExchange>>;
	async readHandshakeMessage(
		messageType: HandshakeType.Finished
	): Promise<HandshakeMessage<Finished>>;
	async readHandshakeMessage(
		messageType:
			| HandshakeType.ClientHello
			| HandshakeType.ClientKeyExchange
			| HandshakeType.Finished
	): Promise<HandshakeMessage<any>> {
		const message = await this.readNextMessage(ContentTypes.Handshake);
		if (message.msg_type !== messageType) {
			throw new Error(`Expected ${messageType} message`);
		}
		return message;
	}

	async readNextMessage(
		requestedType: (typeof ContentTypes)['Handshake']
	): Promise<HandshakeMessage<any>>;
	async readNextMessage(
		requestedType: (typeof ContentTypes)['ApplicationData']
	): Promise<ApplicationDataMessage>;
	async readNextMessage(
		requestedType: (typeof ContentTypes)['Alert']
	): Promise<AlertMessage>;
	async readNextMessage(
		requestedType: (typeof ContentTypes)['ChangeCipherSpec']
	): Promise<ChangeCipherSpecMessage>;
	async readNextMessage<Message extends TLSMessage>(
		requestedType: ContentType
	): Promise<Message> {
		const record = await this.readNextTLSRecord(requestedType);
		const message = (await this.parseTLSRecord(record)) as Message;
		if (message.type === ContentTypes.Handshake) {
			this.handshakeMessages.push(record.fragment);
		}
		console.log('message', message);
		return message;
	}

	awaitingTLSRecords: Array<TLSRecord> = [];
	async readNextTLSRecord(requestedType: ContentType): Promise<TLSRecord> {
		while (true) {
			for (let i = 0; i < this.awaitingTLSRecords.length; i++) {
				const record = this.awaitingTLSRecords[i];
				if (record.type === ContentTypes.Alert) {
					throw new Error(
						`Alert message received: ${
							AlertLevelNames[record.fragment[0]]
						} ${AlertDescriptionNames[record.fragment[1]]}`
					);
				}
				if (record.type === requestedType) {
					this.awaitingTLSRecords.splice(i, 1);
					return record;
				}
			}

			// Read the TLS record header (5 bytes)
			const header = await this.readBytes(5);
			const length = (header[3] << 8) | header[4];
			const record = {
				type: header[0],
				version: {
					major: header[1],
					minor: header[2],
				},
				length,
				fragment: await this.readBytes(length),
			} as TLSRecord;

			const gotCompleteRecord = await this.processTLSRecord(record);
			if (!gotCompleteRecord) {
				continue;
			}
			this.awaitingTLSRecords.push(record);
		}
	}

	async readBytes(length: number) {
		while (this.receivedBuffer.length < length) {
			// Patience is the key...
			await new Promise((resolve) => setTimeout(resolve, 100));
			if (this.closed) {
				throw new TLSConnectionClosed();
			}
		}
		const requestedBytes = this.receivedBuffer.slice(0, length);
		this.receivedBuffer = this.receivedBuffer.slice(length);
		return requestedBytes;
	}

	async parseTLSRecord(record: TLSRecord): Promise<TLSMessage> {
		if (this.sessionKeys && record.type !== ContentTypes.ChangeCipherSpec) {
			record.fragment = await this.decryptData(
				record.type,
				record.fragment as Uint8Array
			);
		}
		switch (record.type) {
			case ContentTypes.Handshake: {
				return this.parseClientHandshakeMessage(record.fragment);
			}
			case ContentTypes.Alert: {
				return {
					type: record.type,
					level: AlertLevelNames[record.fragment[0]],
					description: AlertDescriptionNames[record.fragment[1]],
				};
			}
			case ContentTypes.ChangeCipherSpec: {
				return {
					type: record.type,
					body: {} as any,
				};
			}
			case ContentTypes.ApplicationData: {
				return {
					type: record.type,
					body: record.fragment,
				};
			}
			default:
				throw new Error(`Unsupported record type ${record.type}`);
		}
	}

	private receivedRecordSequenceNumber = 0;
	private sentRecordSequenceNumber = 0;
	private async decryptData(
		contentType: number,
		payload: Uint8Array
	): Promise<Uint8Array> {
		const iv = new Uint8Array([
			...this.sessionKeys!.clientIV,
			...payload.slice(0, 8),
		]);

		console.log('decrypting', payload);
		const decrypted = await crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: iv,
				additionalData: new Uint8Array([
					// Sequence number
					...as8Bytes(this.receivedRecordSequenceNumber),
					// Content type
					contentType,
					// Protocol version
					0x03,
					0x03,
					// Length without IV and tag
					...as2Bytes(payload.length - 8 - 16),
				]),
				tagLength: 128,
			},
			this.sessionKeys!.clientWriteKey,
			payload.slice(8)
		);
		++this.receivedRecordSequenceNumber;

		return new Uint8Array(decrypted);
	}

	private async encryptData(
		contentType: number,
		payload: Uint8Array
	): Promise<Uint8Array> {
		// Generate a unique explicit IV (8 bytes)
		const explicitIV = crypto.getRandomValues(new Uint8Array(8));
		const iv = new Uint8Array([
			...this.sessionKeys!.serverIV,
			...explicitIV,
		]);

		const additionalData = new Uint8Array([
			// Sequence number
			...as8Bytes(this.sentRecordSequenceNumber),
			// Content type
			contentType,
			// Protocol version
			0x03,
			0x03,
			// Payload length
			...as2Bytes(payload.length),
		]);
		const ciphertextWithTag = await crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv,
				additionalData,
				tagLength: 128,
			},
			this.sessionKeys!.serverWriteKey,
			payload
		);
		++this.sentRecordSequenceNumber;

		const encrypted = concatUint8Arrays([
			explicitIV,
			new Uint8Array(ciphertextWithTag),
		]);

		return encrypted;
	}

	bufferedRecords: Partial<Record<ContentType, Uint8Array>> = {};
	async processTLSRecord(record: TLSRecord): Promise<boolean> {
		switch (record.type) {
			case ContentTypes.Handshake: {
				const message = concatUint8Arrays([
					this.bufferedRecords[record.type] || new Uint8Array(),
					record.fragment,
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
			case ContentTypes.Alert: {
				const message = concatUint8Arrays([
					this.bufferedRecords[record.type] || new Uint8Array(),
					record.fragment,
				]);
				if (message.length < 2) {
					return false;
				}
				return true;
			}
			case ContentTypes.ChangeCipherSpec: {
				return true;
			}
			case ContentTypes.ApplicationData: {
				return true;
			}
			default:
				throw new Error(`Unsupported record type ${record.type}`);
		}
	}

	parseClientHandshakeMessage<T extends HandshakeMessageBody>(
		message: Uint8Array
	): HandshakeMessage<T> {
		const msg_type = message[0];
		const length = (message[1] << 16) | (message[2] << 8) | message[3];
		const bodyBytes = message.slice(4);
		const reader = new ArrayBufferReader(bodyBytes.buffer);
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
				const buff: Partial<ClientHello> = {
					client_version: reader.readUint8Array(2),
					/**
					 * Technically this consists of a GMT timestamp
					 * and 28 random bytes, but we don't need to
					 * parse this further.
					 */
					random: reader.readUint8Array(32),
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
					type: ContentTypes.Handshake,
					msg_type,
					length,
					body: buff as T,
				} as HandshakeMessage<T>;
			}
			/**
			 * Binary layout:
			 *
				+------------------------------------+
				| ECDH Client Public Key Length [1B] |
				+------------------------------------+
				| ECDH Client Public Key   [variable]|
				+------------------------------------+
			 */
			case HandshakeType.ClientKeyExchange:
				body = {
					// Skip the first byte, which is the length of the public key
					exchange_keys: bodyBytes.slice(1, bodyBytes.length),
				} as ClientKeyExchange;
				break;
			case HandshakeType.Finished:
				body = {
					verify_data: bodyBytes,
				} as Finished;
				break;
			default:
				throw new Error(`Invalid handshake type ${msg_type}`);
		}
		return {
			type: ContentTypes.Handshake,
			msg_type,
			length,
			body: body as T,
		};
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
	async writeTLSRecord(
		contentType: number,
		payload: Uint8Array
	): Promise<void> {
		if (contentType === ContentTypes.Handshake) {
			this.handshakeMessages.push(payload);
		}
		if (this.sessionKeys && contentType !== ContentTypes.ChangeCipherSpec) {
			payload = await this.encryptData(contentType, payload);
		}

		const version = [0x03, 0x03]; // TLS 1.2
		const length = payload.length;
		const header = new Uint8Array(5);
		header[0] = contentType;
		header[1] = version[0];
		header[2] = version[1];
		header[3] = (length >> 8) & 0xff;
		header[4] = length & 0xff;

		const record = concatUint8Arrays([header, payload]);
		this.sendBytesToClient(record);
	}

	/**
	 * +------------------------------------+
	 * | Content Type (Handshake)     [1B]  |
	 * | 0x16                               |
	 * +------------------------------------+
	 * | Version (TLS 1.2)            [2B]  |
	 * | 0x03 0x03                          |
	 * +------------------------------------+
	 * | Length                       [2B]  |
	 * +------------------------------------+
	 * | Handshake Type (ServerHello) [1B]  |
	 * | 0x02                               |
	 * +------------------------------------+
	 * | Handshake Length             [3B]  |
	 * +------------------------------------+
	 * | Server Version               [2B]  |
	 * +------------------------------------+
	 * | Server Random               [32B]  |
	 * +------------------------------------+
	 * | Session ID Length            [1B]  |
	 * +------------------------------------+
	 * | Session ID             [0-32B]     |
	 * +------------------------------------+
	 * | Cipher Suite                 [2B]  |
	 * +------------------------------------+
	 * | Compression Method           [1B]  |
	 * +------------------------------------+
	 * | Extensions Length            [2B]  |
	 * +------------------------------------+
	 * | Extension: ec_point_formats        |
	 * |   Type (0x00 0x0B)           [2B]  |
	 * |   Length                     [2B]  |
	 * |   EC Point Formats Length    [1B]  |
	 * |   EC Point Format            [1B]  |
	 * +------------------------------------+
	 * | Other Extensions...                |
	 * +------------------------------------+
	 */
	private serverHelloMessage(clientHello: ClientHello): Uint8Array {
		const extensionsParts: Uint8Array[] = clientHello.extensions
			.map((extension) => {
				switch (extension['type']) {
					case 'server_name':
						/**
						 * The server SHALL include an extension of type "server_name" in the
						 * (extended) server hello.  The "extension_data" field of this extension
						 * SHALL be empty.
						 *
						 * Source: dfile:///Users/cloudnik/Library/Application%20Support/Dash/User%20Contributed/RFCs/RFCs.docset/Contents/Resources/Documents/rfc6066.html#section-3
						 */
						return ServerNameExtension.encode();
					case 'supported_groups':
						return SupportedGroupsExtension.encode('secp256r1');
					case 'ec_point_formats':
						return ECPointFormatsExtension.encode('uncompressed');
					case 'signature_algorithms':
						return SignatureAlgorithmsExtension.encode(
							'sha256',
							'rsa'
						);
				}
				return undefined;
			})
			.filter((x): x is Uint8Array => x !== undefined);
		const extensions = concatUint8Arrays(extensionsParts);

		const body = new Uint8Array([
			// Version field – 0x03, 0x03 means TLS 1.2
			...TLS_Version_1_2,

			...this.securityParameters.server_random,

			clientHello.session_id.length,
			...clientHello.session_id,

			...as2Bytes(CipherSuites.TLS1_CK_ECDHE_RSA_WITH_AES_128_GCM_SHA256),

			this.securityParameters.compression_algorithm,

			// Extensions length (2 bytes)
			...as2Bytes(extensions.length),

			...extensions,
		]);

		return new Uint8Array([
			HandshakeType.ServerHello,
			...as3Bytes(body.length),
			...body,
		]);
	}

	// Full key derivation function
	async deriveSessionKeys(): Promise<SessionKeys> {
		const preMasterSecret = await crypto.subtle.deriveBits(
			{
				name: 'ECDH',
				public: this.clientPublicKey!, // Client's ECDHE public key
			},
			this.ecdheKeyPair!.privateKey, // Server's ECDHE private key
			256 // Length of the derived secret (256 bits for P-256)
		);
		this.securityParameters.master_secret = new Uint8Array(
			await tls12Prf(
				preMasterSecret,
				stringToArrayBuffer('master secret'),
				concatUint8Arrays([
					this.securityParameters.client_random,
					this.securityParameters.server_random,
				]),
				48
			)
		);

		const keyBlock = await tls12Prf(
			this.securityParameters.master_secret,
			stringToArrayBuffer('key expansion'),
			concatUint8Arrays([
				this.securityParameters.server_random,
				this.securityParameters.client_random,
			]),
			// Client key, server key, client IV, server IV
			16 + 16 + 4 + 4
		);

		const reader = new ArrayBufferReader(keyBlock);
		const clientWriteKey = reader.readUint8Array(16);
		const serverWriteKey = reader.readUint8Array(16);
		const clientIV = reader.readUint8Array(4);
		const serverIV = reader.readUint8Array(4);

		return {
			clientWriteKey: await crypto.subtle.importKey(
				'raw',
				clientWriteKey,
				{ name: 'AES-GCM' },
				false,
				['encrypt', 'decrypt']
			),
			serverWriteKey: await crypto.subtle.importKey(
				'raw',
				serverWriteKey,
				{ name: 'AES-GCM' },
				false,
				['encrypt', 'decrypt']
			),
			clientIV,
			serverIV,
		};
	}

	private certificateMessage(): Uint8Array {
		const certsBodies: Uint8Array[] = [];
		for (const cert of this.certificatesDER) {
			certsBodies.push(as3Bytes(cert.byteLength));
			certsBodies.push(cert);
		}
		const certsBody = concatUint8Arrays(certsBodies);
		const body = new Uint8Array([
			...as3Bytes(certsBody.byteLength),
			...certsBody,
		]);
		return new Uint8Array([
			HandshakeType.Certificate,
			...as3Bytes(body.length),
			...body,
		]);
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

export class ArrayBufferWriter {
	buffer: ArrayBuffer;
	view: DataView;
	uint8Array: Uint8Array;

	private offset = 0;

	constructor(length: number) {
		this.buffer = new ArrayBuffer(length);
		this.uint8Array = new Uint8Array(this.buffer);
		this.view = new DataView(this.buffer);
	}

	writeUint8(value: number) {
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}

	writeUint16(value: number) {
		this.view.setUint16(this.offset, value);
		this.offset += 2;
	}

	writeUint32(value: number) {
		this.view.setUint32(this.offset, value);
		this.offset += 4;
	}

	writeUint8Array(value: Uint8Array) {
		this.uint8Array.set(value, this.offset);
		this.offset += value.length;
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

/*
 * Byte layout of the ServerKeyExchange message:
 *
 * +-----------------------------------+
 * |    ServerKeyExchange Message      |
 * +-----------------------------------+
 * | Handshake type (1 byte)           |
 * +-----------------------------------+
 * | Length (3 bytes)                  |
 * +-----------------------------------+
 * | Curve Type (1 byte)               |
 * +-----------------------------------+
 * | Named Curve (2 bytes)             |
 * +-----------------------------------+
 * | EC Point Format (1 byte)          |
 * +-----------------------------------+
 * | Public Key Length (1 byte)        |
 * +-----------------------------------+
 * | Public Key (variable)             |
 * +-----------------------------------+
 * | Signature Algorithm (2 bytes)     |
 * +-----------------------------------+
 * | Signature Length (2 bytes)        |
 * +-----------------------------------+
 * | Signature (variable)              |
 * +-----------------------------------+
 */
async function generateECDHEServerKeyExchange(
	clientRandom: Uint8Array, // 32 bytes from ClientHello
	serverRandom: Uint8Array, // 32 bytes from ServerHello
	ecdheKeyPair: CryptoKeyPair,
	rsaPrivateKey: CryptoKey // RSA private key for signing
): Promise<Uint8Array> {
	// Step 2: Export the ECDHE public key (raw format)
	const ecdhePublicKey = await crypto.subtle.exportKey(
		'raw',
		ecdheKeyPair.publicKey
	);

	// Step 3: Prepare the key exchange parameters
	const curveType = new Uint8Array([ECCurveTypes.NamedCurve]);
	const curveName = as2Bytes(ECNamedCurves.secp256r1);
	const publicKey = new Uint8Array(ecdhePublicKey); // 65 bytes (04 followed by x and y coordinates)

	// Step 4: Concatenate clientRandom, serverRandom, and publicKey for signing

	/*
   The ServerKeyExchange message is extended as follows.

        enum { ec_diffie_hellman } KeyExchangeAlgorithm;

   ec_diffie_hellman:   Indicates the ServerKeyExchange message contains
      an ECDH public key.

        select (KeyExchangeAlgorithm) {
            case ec_diffie_hellman:
                ServerECDHParams    params;
                Signature           signed_params;
        } ServerKeyExchange;

   params:   Specifies the ECDH public key and associated domain
      parameters.

   signed_params:   A hash of the params, with the signature appropriate
      to that hash applied.  The private key corresponding to the
      certified public key in the server's Certificate message is used
      for signing.

          enum { ecdsa } SignatureAlgorithm;

          select (SignatureAlgorithm) {
              case ecdsa:
                  digitally-signed struct {
                      opaque sha_hash[sha_size];
                  };
          } Signature;


        ServerKeyExchange.signed_params.sha_hash
            SHA(ClientHello.random + ServerHello.random +
                                              ServerKeyExchange.params);
	*/
	/**
	 * select (KeyExchangeAlgorithm) {
	 *     case ec_diffie_hellman:
	 *         ServerECDHParams    params;
	 *         Signature           signed_params;
	 * } ServerKeyExchange;
	 *
	 * struct {
	 *   ECParameters    curve_params;
	 *   ECPoint         public;
	 * } ServerECDHParams;
	 *
	 * struct {
	 *   ECCurveType    curve_type;
	 *   select (curve_type) {
	 *       case explicit_prime:
	 *           opaque      prime_p <1..2^8-1>;
	 *           ECCurve     curve;
	 *           ECPoint     base;
	 *           opaque      order <1..2^8-1>;
	 *           opaque      cofactor <1..2^8-1>;
	 *       case explicit_char2:
	 *          uint16      m;
	 *          ECBasisType basis;
	 *          select (basis) {
	 *              case ec_trinomial:
	 *                   opaque  k <1..2^8-1>;
	 *               case ec_pentanomial:
	 *                   opaque  k1 <1..2^8-1>;
	 *                   opaque  k2 <1..2^8-1>;
	 *                   opaque  k3 <1..2^8-1>;
	 *           };
	 *           ECCurve     curve;
	 *           ECPoint     base;
	 *           opaque      order <1..2^8-1>;
	 *           opaque      cofactor <1..2^8-1>;
	 *       case named_curve:
	 *           NamedCurve namedcurve;
	 *    };
	 * } ECParameters;
	 */
	const dataToSign = new Uint8Array([
		...clientRandom,
		...serverRandom,
		...curveType,
		...curveName,
		publicKey.byteLength,
		...publicKey,
	]);

	// Step 5: Sign the concatenated data using RSA private key and SHA-256
	const signature = await crypto.subtle.sign(
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256',
		},
		rsaPrivateKey, // Server's RSA private key
		dataToSign
	);

	const signatureBytes = new Uint8Array(signature);

	// Step 6: Construct the complete Server Key Exchange message
	const body = new Uint8Array([
		...curveType, // Curve type (1 byte)
		...curveName, // Curve name (2 bytes)

		publicKey.byteLength, // Public key length (1 byte)
		...publicKey, // Public key (65 bytes, uncompressed format)

		/**
		 * NOTE: SignatureAlgorithm is "rsa" for the ECDHE_RSA key exchange
		 * These cases are defined in TLS [RFC2246].
		 */
		HashAlgorithms.sha256,
		SignatureAlgorithms.rsa,

		...as2Bytes(signatureBytes.length),
		...signatureBytes,
	]);

	return new Uint8Array([
		HandshakeType.ServerKeyExchange,
		...as3Bytes(body.length),
		...body,
	]);
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
type CipherFragmentPair =
	| { cipherType: CipherType.Stream; fragment: GenericStreamCipher }
	| { cipherType: CipherType.Block; fragment: GenericBlockCipher }
	| { cipherType: CipherType.AEAD; fragment: GenericAEADCipher };

interface TLSRecord {
	type: ContentType; // 1 byte
	version: ProtocolVersion; // 2 bytes
	length: number; // 2 bytes
	fragment: Uint8Array; // variable length
}

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
	| ChangeCipherSpecMessage
	| ApplicationDataMessage;

interface AlertMessage {
	type: typeof ContentTypes.Alert;
	level: AlertLevel;
	description: AlertDescription;
}

const AlertLevels = {
	Warning: 1,
	Fatal: 2,
} as const;
type AlertLevel = (typeof AlertLevels)[keyof typeof AlertLevels];
const AlertLevelNames = flipObject(AlertLevels);

const AlertDescriptions = {
	CloseNotify: 0,
	UnexpectedMessage: 10,
	BadRecordMac: 20,
	DecryptionFailed: 21,
	RecordOverflow: 22,
	DecompressionFailure: 30,
	HandshakeFailure: 40,
	NoCertificate: 41,
	BadCertificate: 42,
	UnsupportedCertificate: 43,
	CertificateRevoked: 44,
	CertificateExpired: 45,
	CertificateUnknown: 46,
	IllegalParameter: 47,
	UnknownCa: 48,
	AccessDenied: 49,
	DecodeError: 50,
	DecryptError: 51,
	ExportRestriction: 60,
	ProtocolVersion: 70,
	InsufficientSecurity: 71,
	InternalError: 80,
	UserCanceled: 90,
	NoRenegotiation: 100,
	UnsupportedExtension: 110,
} as const;
type AlertDescription =
	(typeof AlertDescriptions)[keyof typeof AlertDescriptions];
const AlertDescriptionNames = flipObject(AlertDescriptions);

interface ChangeCipherSpecMessage {
	type: typeof ContentTypes.ChangeCipherSpec;
	body: Uint8Array;
}

interface ApplicationDataMessage {
	type: typeof ContentTypes.ApplicationData;
	body: Uint8Array;
}

export const ContentTypes = {
	ChangeCipherSpec: 20,
	Alert: 21,
	Handshake: 22,
	ApplicationData: 23,
} as const;
type ContentType = (typeof ContentTypes)[keyof typeof ContentTypes];

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
	type: typeof ContentTypes.Handshake;
	msg_type: HandshakeType; // 1 byte
	length: number; // 2 bytes
	// Custom property to hold the raw body of the message
	body: Body;
}

// Specific Handshake Message Types
interface HelloRequest {} // Empty for TLS 1.2

/**
 * 1 byte
 */
type SessionId = Uint8Array;
interface ClientHello {
	client_version: Uint8Array; // 2 bytes
	random: Uint8Array; // 32 bytes
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

/**
 * ECCurveType from
 * https://datatracker.ietf.org/doc/html/rfc4492#section-5.4
 */
const ECCurveTypes = {
	/**
	 * Indicates the elliptic curve domain parameters are
	 * conveyed verbosely, and the underlying finite field is a prime
	 * field.
	 */
	ExplicitPrime: 1,
	/**
	 * Indicates the elliptic curve domain parameters are
	 * conveyed verbosely, and the underlying finite field is a
	 * characteristic-2 field.
	 */
	ExplicitChar2: 2,
	/**
	 * Indicates that a named curve is used.  This option
	 * SHOULD be used when applicable.
	 */
	NamedCurve: 3,
	/**
	 * Values 248 through 255 are reserved for private use.
	 */
};

/**
 * Named elliptic curves from
 * https://datatracker.ietf.org/doc/html/rfc4492#section-5.1.1
 */
const ECNamedCurves = {
	sect163k1: 1,
	sect163r1: 2,
	sect163r2: 3,
	sect193r1: 4,
	sect193r2: 5,
	sect233k1: 6,
	sect233r1: 7,
	sect239k1: 8,
	sect283k1: 9,
	sect283r1: 10,
	sect409k1: 11,
	sect409r1: 12,
	secp256k1: 22,
	secp256r1: 23,
	secp384r1: 24,
	secp521r1: 25,
	arbitrary_explicit_prime_curves: 0xff01,
	arbitrary_explicit_char2_curves: 0xff02,
};

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

const TLS_Version_1_2 = new Uint8Array([0x03, 0x03]);

function as2Bytes(value: number): Uint8Array {
	return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function as3Bytes(value: number): Uint8Array {
	return new Uint8Array([
		(value >> 16) & 0xff,
		(value >> 8) & 0xff,
		value & 0xff,
	]);
}

function as8Bytes(value: number): Uint8Array {
	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setBigUint64(0, BigInt(value), false); // false for big-endian
	return new Uint8Array(buffer);
}

type SessionKeys = {
	clientWriteKey: CryptoKey;
	serverWriteKey: CryptoKey;
	clientIV: Uint8Array;
	serverIV: Uint8Array;
};
