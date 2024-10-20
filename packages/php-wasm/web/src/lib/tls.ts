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
	private encryptionActive = false;

	constructor(
		privateKey: CryptoKey,
		certificatesDER: Uint8Array[],
		sendBytesToClient: (data: Uint8Array) => void
	) {
		this.privateKey = privateKey;
		this.certificatesDER = certificatesDER;
		this.sendBytesToClient = sendBytesToClient;
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
		this.writeTLSRecord(ContentTypes.Handshake, serverHello);

		// Step 3: Send Certificate
		const certificateMessage = this.certificateMessage(
			this.certificatesDER
		);
		this.writeTLSRecord(ContentTypes.Handshake, certificateMessage);

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
		this.writeTLSRecord(ContentTypes.Handshake, serverKeyExchange);

		// Step 4: Send ServerHelloDone
		const serverHelloDone = new Uint8Array([
			HandshakeType.ServerHelloDone,
			...as3Bytes(0),
		]);
		this.writeTLSRecord(ContentTypes.Handshake, serverHelloDone);

		// Step 5: Receive ClientKeyExchange
		const clientKeyExchangeRecord = await this.readHandshakeMessage(
			HandshakeType.ClientKeyExchange
		);
		this.clientPublicKey = await crypto.subtle.importKey(
			'raw',
			clientKeyExchangeRecord.body.exchange_keys,
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			[]
		);

		await this.readNextMessage(ContentTypes.ChangeCipherSpec);
		this.sessionKeys = await this.deriveSessionKeys();

		// Step 6: Receive ClientFinished

		console.log({ SessionKeys: this.sessionKeys });
		// const preMasterSecret = await computePreMasterSecret(
		// 	this.ecdheKeyPair.privateKey,
		// 	clientPublicKey
		// );
		// this.securityParameters.master_secret = await computeMasterSecret(
		// 	preMasterSecret,
		// 	this.securityParameters.client_random,
		// 	this.securityParameters.server_random
		// );

		const clientFinished = await this.readNextTLSRecord(
			ContentTypes.Handshake
		);
		console.log({ clientFinished });
		const iv = new Uint8Array([
			...this.sessionKeys.clientIV,
			...clientFinished.fragment.slice(0, 8),
		]);

		let clientVerifyData;
		try {
			clientVerifyData = await crypto.subtle.decrypt(
				{
					name: 'AES-GCM',
					iv: iv,
				},
				this.sessionKeys.clientWriteKey,
				clientFinished.fragment.slice(8)
			);
		} catch (e) {
			console.error('Decryption failed:', e);
			return false;
		}

		console.log({ clientVerifyData });

		this.encryptionActive = true;

		console.log({
			masterSecret: this.securityParameters.master_secret,
		});
		return;

		// console.log('=============> Session keys', this.sessionKeys, {
		// 	preMasterSecret,
		// });

		// const clientFinished = await this.readNextMessage(
		// 	ContentTypes.Handshake
		// );
		// console.log({ clientFinished });
		// const verified = await this.verifyClientFinishedMessage(
		// 	clientFinished.body.verify_data
		// );

		// console.log({ handshakeMessages });
		// console.log({ clientFinished, verified });
		// const finishedMessage = await this.createFinishedMessage(
		// 	concatUint8Arrays(handshakeMessages)
		// );
		// this.writeTLSRecord(ContentTypes.Handshake, finishedMessage);

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

	async verifyClientFinishedMessage(
		encryptedMessage: Uint8Array
	): Promise<boolean> {
		const subtle = crypto.subtle;

		/**
		 * The IV derived from the session keys in TLS 1.2 with AES-GCM is used for
		 * data encryption and decryption during the actual communication, but **not
		 * for the Finished message itself**.
		 */
		const finishedMessageIV = encryptedMessage.slice(0, 12);
		const ciphertext = new Uint8Array(encryptedMessage.slice(12, -16));
		const authTag = new Uint8Array(encryptedMessage.slice(-16));

		// Decrypt
		console.log({ finishedMessageIV, ciphertext, authTag });
		try {
			const decrypted = await subtle.decrypt(
				{
					name: 'AES-GCM',
					iv: finishedMessageIV,
					tagLength: 128,
				},
				this.sessionKeys!.clientWriteKey,
				new Uint8Array([...ciphertext, ...authTag])
			);
			console.log({ decrypted });
			return true;
		} catch (e) {
			console.error('Failed to decrypt Finished message', e);
			return false;
		}
	}

	async createFinishedMessage(
		handshakeMessages: Uint8Array
	): Promise<Uint8Array> {
		const hash = await crypto.subtle.digest('SHA-256', handshakeMessages); // Hash of all handshake messages

		// Step 2: Encrypt the hash using the server write key (AES-GCM)
		const iv = crypto.getRandomValues(new Uint8Array(12)); // Generate an IV for AES-GCM
		const encrypted = await crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv: iv, // Initialization vector
			},
			this.sessionKeys!.serverWriteKey, // Server write key
			hash // The Finished message (hash of the handshake messages)
		);

		// Return the encrypted Finished message along with the IV
		return new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
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
		const message = await this.readNextMessage<HandshakeMessage<any>>(
			ContentTypes.Handshake
		);
		if (message.msg_type !== messageType) {
			throw new Error(`Expected ${messageType} message`);
		}
		this.handshakeMessages.push(message.raw);
		return message;
	}

	async readNextMessage<Message extends TLSMessage>(
		requestedType: ContentType
	): Promise<Message> {
		const record = await this.readNextTLSRecord(requestedType);
		return (await this.parseTLSRecord(record)) as Message;
	}

	awaitingTLSRecords: Array<TLSRecord> = [];
	async readNextTLSRecord(requestedType: ContentType): Promise<TLSRecord> {
		while (true) {
			for (let i = 0; i < this.awaitingTLSRecords.length; i++) {
				const record = this.awaitingTLSRecords[i];
				if (record.type === requestedType) {
					const record = this.awaitingTLSRecords[i];
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
			console.log('NEW TLS RECORD', record);
		}
	}

	async parseTLSRecord(record: TLSRecord): Promise<TLSMessage> {
		if (this.encryptionActive) {
			record.fragment = await this.decryptData(
				record.fragment as Uint8Array
			);
		}
		const plaintext = record as TLSPlaintext;
		switch (record.type) {
			case ContentTypes.Handshake: {
				return this.parseClientHandshakeMessage(plaintext.fragment);
			}
			case ContentTypes.Alert: {
				return {
					type: record.type,
					level: AlertLevelNames[plaintext.fragment[0]],
					description: AlertDescriptionNames[plaintext.fragment[1]],
				};
			}
			case ContentTypes.ChangeCipherSpec: {
				return {
					type: record.type,
					body: {} as any,
					raw: record.fragment as Uint8Array,
				};
			}
			default:
				throw new Error(`Unsupported record type ${record.type}`);
		}
	}

	bufferedRecords: Partial<Record<ContentType, Uint8Array>> = {};
	async processTLSRecord(record: TLSRecord): Promise<boolean> {
		switch (record.type) {
			case ContentTypes.Handshake: {
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
			case ContentTypes.Alert: {
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
			case ContentTypes.ChangeCipherSpec: {
				return true;
			}
			default:
				throw new Error(`Unsupported record type ${record.type}`);
		}
	}

	parseClientHandshakeMessage<T extends HandshakeMessageBody>(
		message: Uint8Array
	): HandshakeMessage<T> {
		let msg_type = message[0];
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
					raw: message,
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
			default:
				throw new Error(`Invalid handshake type ${msg_type}`);
		}
		return {
			type: ContentTypes.Handshake,
			msg_type,
			length,
			body: body as T,
			raw: message,
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

	// HMAC-based PRF function using SHA-256
	async tlsPrf(
		secret: ArrayBuffer,
		label: Uint8Array,
		seed: Uint8Array,
		outputLength: number
	): Promise<Uint8Array> {
		const labelSeed = concatUint8Arrays([label, seed]);
		const key = await crypto.subtle.importKey(
			'raw',
			secret,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);

		const result = new Uint8Array(outputLength);
		let currentBlock = new Uint8Array();

		while (outputLength > 0) {
			const hmacInput = concatUint8Arrays([
				currentBlock.length === 0 ? labelSeed : currentBlock,
				labelSeed,
			]);
			currentBlock = new Uint8Array(
				await crypto.subtle.sign('HMAC', key, hmacInput)
			);

			const blockLength = Math.min(outputLength, currentBlock.length);
			result.set(
				currentBlock.slice(0, blockLength),
				result.length - outputLength
			);
			outputLength -= blockLength;
		}
		return result;
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
		console.log(this.securityParameters.master_secret);

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

	async decryptData(encryptedMessage: Uint8Array): Promise<Uint8Array> {
		const iv = encryptedMessage.slice(0, 12); // Extract the IV (first 12 bytes)
		const ciphertext = encryptedMessage.slice(12); // The rest is the ciphertext

		try {
			const decryptedData = await crypto.subtle.decrypt(
				{
					name: 'AES-GCM',
					iv: iv, // Initialization vector (extracted from the message)
				},
				this.sessionKeys!.clientWriteKey, // Use the client write key to decrypt data
				ciphertext
			);

			return new Uint8Array(decryptedData); // Return the decrypted data
		} catch (e) {
			console.error('Error decrypting data', e);
			throw e;
		}
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
			hash: { name: 'SHA-256' },
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

type FragmentType =
	| GenericStreamCipher
	| GenericBlockCipher
	| GenericAEADCipher;
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
	| ChangeCipherSpecMessage;
// | ApplicationDataMessage;

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

const ContentTypes = {
	ChangeCipherSpec: 20,
	Alert: 21,
	Handshake: 22,
	ApplicationData: 23,
} as const;
type ContentType = (typeof ContentTypes)[keyof typeof ContentTypes];

const ContentTypeNames = flipObject(ContentTypes);

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
	raw: Uint8Array;
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

const ECPointFormats = {
	uncompressed: 0,
	ansiX962_compressed_prime: 1,
	ansiX962_compressed_char2: 2,
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

function as4Bytes(value: number): Uint8Array {
	return new Uint8Array([
		(value >> 24) & 0xff,
		(value >> 16) & 0xff,
		(value >> 8) & 0xff,
		value & 0xff,
	]);
}

type SessionKeys = {
	clientWriteKey: CryptoKey;
	serverWriteKey: CryptoKey;
	clientIV: Uint8Array;
	serverIV: Uint8Array;
};

//
const subtle = crypto.subtle;
async function computePreMasterSecret(
	serverPrivateKey: CryptoKey,
	clientPublicKey: CryptoKey
): Promise<ArrayBuffer> {
	return await subtle.deriveBits(
		{
			name: 'ECDH',
			public: clientPublicKey,
		},
		serverPrivateKey,
		256
	);
	// Derive the pre-master secret using ECDH
	const key = await subtle.deriveKey(
		{
			name: 'ECDH',
			public: clientPublicKey,
		},
		serverPrivateKey,
		{ name: 'AES-GCM', length: 256 },
		true,
		['deriveBits']
	);
	return await subtle.exportKey('raw', key);
}

// PRF (Pseudo-Random Function) implementation
async function prf(
	secret: ArrayBuffer,
	label: string,
	seed: ArrayBuffer,
	outputLength: number
): Promise<Uint8Array> {
	// Convert label to ArrayBuffer
	const labelBuffer = new TextEncoder().encode(label);
	const seedBuffer = new Uint8Array(labelBuffer.byteLength + seed.byteLength);
	seedBuffer.set(new Uint8Array(labelBuffer), 0);
	seedBuffer.set(new Uint8Array(seed), labelBuffer.byteLength);

	// Derive keying material using HMAC-SHA256
	const key = await subtle.importKey(
		'raw',
		secret,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const hmac = await subtle.sign('HMAC', key, seedBuffer);

	return new Uint8Array(hmac.slice(0, outputLength));
}

// Helper function to compare two ArrayBuffers for equality using crypto.subtle.digest
async function buffersEqual(
	buf1: ArrayBuffer,
	buf2: ArrayBuffer
): Promise<boolean> {
	if (buf1.byteLength !== buf2.byteLength) return false;

	// Use subtle.digest to compute hashes and compare them
	const hash1 = await subtle.digest('SHA-256', buf1);
	const hash2 = await subtle.digest('SHA-256', buf2);

	const view1 = new Uint8Array(hash1);
	const view2 = new Uint8Array(hash2);

	for (let i = 0; i < view1.length; i++) {
		if (view1[i] !== view2[i]) return false;
	}
	return true;
}

async function verifyClientFinished(
	masterSecret: ArrayBuffer,
	handshakeMessages: ArrayBuffer,
	encryptedClientVerifyData: ArrayBuffer,
	clientRandom: ArrayBuffer,
	serverRandom: ArrayBuffer
): Promise<boolean> {
	// Derive the key for AES-GCM decryption
	const label = 'key expansion';
	const seedBuffer = new Uint8Array(
		clientRandom.byteLength + serverRandom.byteLength
	);
	seedBuffer.set(new Uint8Array(clientRandom), 0);
	seedBuffer.set(new Uint8Array(serverRandom), clientRandom.byteLength);

	// Derive AES-GCM key for Finished message decryption
	const derivedKeyMaterial = await prf(masterSecret, label, seedBuffer, 32); // 32 bytes for AES-256 key length
	const key = await subtle.importKey(
		'raw',
		derivedKeyMaterial,
		{ name: 'AES-GCM' },
		false,
		['decrypt']
	);

	// Use an appropriate IV for AES-GCM decryption
	const iv = encryptedClientVerifyData.slice(0, 12);

	let clientVerifyData;
	try {
		clientVerifyData = await subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: iv,
			},
			key,
			encryptedClientVerifyData.slice(12)
		);
	} catch (e) {
		console.error('Decryption failed:', e);
		return false;
	}

	// TLS PRF (Pseudo-Random Function) to derive keying material.
	// You will need to use an HMAC-based function (e.g., HMAC-SHA256).
	const finishedLabel = 'client finished';
	const verifyDataLength = 12; // Length of verify data for Finished message
	const finishedHash = await prf(
		masterSecret,
		finishedLabel,
		handshakeMessages,
		verifyDataLength
	);

	// Compare the computed finished hash to the decrypted client verify data.
	return await buffersEqual(clientVerifyData, finishedHash);
}
