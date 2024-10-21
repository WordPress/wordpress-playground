const oids = {
	// Algorithm OIDs
	'1.2.840.113549.1.1.1': 'rsaEncryption',
	'1.2.840.113549.1.1.4': 'md5WithRSAEncryption',
	'1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
	'1.2.840.113549.1.1.7': 'RSAES-OAEP',
	'1.2.840.113549.1.1.8': 'mgf1',
	'1.2.840.113549.1.1.9': 'pSpecified',
	'1.2.840.113549.1.1.10': 'RSASSA-PSS',
	'1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
	'1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
	'1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
	'1.3.101.112': 'EdDSA25519',
	'1.2.840.10040.4.3': 'dsa-with-sha1',
	'1.3.14.3.2.7': 'desCBC',
	'1.3.14.3.2.26': 'sha1',
	'1.3.14.3.2.29': 'sha1WithRSASignature',
	'2.16.840.1.101.3.4.2.1': 'sha256',
	'2.16.840.1.101.3.4.2.2': 'sha384',
	'2.16.840.1.101.3.4.2.3': 'sha512',
	'2.16.840.1.101.3.4.2.4': 'sha224',
	'2.16.840.1.101.3.4.2.5': 'sha512-224',
	'2.16.840.1.101.3.4.2.6': 'sha512-256',
	'1.2.840.113549.2.2': 'md2',
	'1.2.840.113549.2.5': 'md5',

	// pkcs#7 content types
	'1.2.840.113549.1.7.1': 'data',
	'1.2.840.113549.1.7.2': 'signedData',
	'1.2.840.113549.1.7.3': 'envelopedData',
	'1.2.840.113549.1.7.4': 'signedAndEnvelopedData',
	'1.2.840.113549.1.7.5': 'digestedData',
	'1.2.840.113549.1.7.6': 'encryptedData',

	// pkcs#9 oids
	'1.2.840.113549.1.9.1': 'emailAddress',
	'1.2.840.113549.1.9.2': 'unstructuredName',
	'1.2.840.113549.1.9.3': 'contentType',
	'1.2.840.113549.1.9.4': 'messageDigest',
	'1.2.840.113549.1.9.5': 'signingTime',
	'1.2.840.113549.1.9.6': 'counterSignature',
	'1.2.840.113549.1.9.7': 'challengePassword',
	'1.2.840.113549.1.9.8': 'unstructuredAddress',
	'1.2.840.113549.1.9.14': 'extensionRequest',
	'1.2.840.113549.1.9.20': 'friendlyName',
	'1.2.840.113549.1.9.21': 'localKeyId',
	'1.2.840.113549.1.9.22.1': 'x509Certificate',

	// pkcs#12 safe bags
	'1.2.840.113549.1.12.10.1.1': 'keyBag',
	'1.2.840.113549.1.12.10.1.2': 'pkcs8ShroudedKeyBag',
	'1.2.840.113549.1.12.10.1.3': 'certBag',
	'1.2.840.113549.1.12.10.1.4': 'crlBag',
	'1.2.840.113549.1.12.10.1.5': 'secretBag',
	'1.2.840.113549.1.12.10.1.6': 'safeContentsBag',

	// password-based-encryption for pkcs#12
	'1.2.840.113549.1.5.13': 'pkcs5PBES2',
	'1.2.840.113549.1.5.12': 'pkcs5PBKDF2',
	'1.2.840.113549.1.12.1.1': 'pbeWithSHAAnd128BitRC4',
	'1.2.840.113549.1.12.1.2': 'pbeWithSHAAnd40BitRC4',
	'1.2.840.113549.1.12.1.3': 'pbeWithSHAAnd3-KeyTripleDES-CBC',
	'1.2.840.113549.1.12.1.4': 'pbeWithSHAAnd2-KeyTripleDES-CBC',
	'1.2.840.113549.1.12.1.5': 'pbeWithSHAAnd128BitRC2-CBC',
	'1.2.840.113549.1.12.1.6': 'pbewithSHAAnd40BitRC2-CBC',

	// hmac OIDs
	'1.2.840.113549.2.7': 'hmacWithSHA1',
	'1.2.840.113549.2.8': 'hmacWithSHA224',
	'1.2.840.113549.2.9': 'hmacWithSHA256',
	'1.2.840.113549.2.10': 'hmacWithSHA384',
	'1.2.840.113549.2.11': 'hmacWithSHA512',

	// symmetric key algorithm oids
	'1.2.840.113549.3.7': 'des-EDE3-CBC',
	'2.16.840.1.101.3.4.1.2': 'aes128-CBC',
	'2.16.840.1.101.3.4.1.22': 'aes192-CBC',
	'2.16.840.1.101.3.4.1.42': 'aes256-CBC',

	// certificate issuer/subject OIDs
	'2.5.4.3': 'commonName',
	'2.5.4.4': 'surname',
	'2.5.4.5': 'serialNumber',
	'2.5.4.6': 'countryName',
	'2.5.4.7': 'localityName',
	'2.5.4.8': 'stateOrProvinceName',
	'2.5.4.9': 'streetAddress',
	'2.5.4.10': 'organizationName',
	'2.5.4.11': 'organizationalUnitName',
	'2.5.4.12': 'title',
	'2.5.4.13': 'description',
	'2.5.4.15': 'businessCategory',
	'2.5.4.17': 'postalCode',
	'2.5.4.42': 'givenName',
	'1.3.6.1.4.1.311.60.2.1.2':
		'jurisdictionOfIncorporationStateOrProvinceName',
	'1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionOfIncorporationCountryName',

	// X.509 extension OIDs
	'2.16.840.1.113730.1.1': 'nsCertType',
	'2.16.840.1.113730.1.13': 'nsComment',
	'2.5.29.14': 'subjectKeyIdentifier',
	'2.5.29.15': 'keyUsage',
	'2.5.29.17': 'subjectAltName',
	'2.5.29.18': 'issuerAltName',
	'2.5.29.19': 'basicConstraints',
	'2.5.29.31': 'cRLDistributionPoints',
	'2.5.29.32': 'certificatePolicies',
	'2.5.29.35': 'authorityKeyIdentifier',
	'2.5.29.37': 'extKeyUsage',

	// extKeyUsage purposes
	'1.3.6.1.4.1.11129.2.4.2': 'timestampList',
	'1.3.6.1.5.5.7.1.1': 'authorityInfoAccess',
	'1.3.6.1.5.5.7.3.1': 'serverAuth',
	'1.3.6.1.5.5.7.3.2': 'clientAuth',
	'1.3.6.1.5.5.7.3.3': 'codeSigning',
	'1.3.6.1.5.5.7.3.4': 'emailProtection',
	'1.3.6.1.5.5.7.3.8': 'timeStamping',
} as const;

function oidByName(requestedName: OIDName): OID {
	for (const [oid, name] of Object.entries(oids)) {
		if (name === requestedName) {
			return oid as OID;
		}
	}
	throw new Error(`OID not found for name: ${requestedName}`);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	arrays.forEach((a) => (totalLength += a.length));
	const result = new Uint8Array(totalLength);
	let offset = 0;
	arrays.forEach((a) => {
		result.set(a, offset);
		offset += a.length;
	});
	return result;
}

export const ASN1Tags = {
	EOC: 0,
	Boolean: 1,
	Integer: 2,
	BitString: 3,
	OctetString: 4,
	Null: 5,
	OID: 6,
	ObjectDescriptor: 7,
	External: 8,
	Real: 9, // float
	Enumeration: 10,
	PDV: 11,
	Utf8String: 12,
	RelativeOID: 13,
	Sequence: 16,
	Set: 17,
	NumericString: 18,
	PrintableString: 19,
	T61String: 20,
	VideotexString: 21,
	IA5String: 22,
	UTCTime: 23,
	GeneralizedTime: 24,
	GraphicString: 25,
	VisibleString: 26,
	GeneralString: 28,
	UniversalString: 29,
	CharacterString: 30,
	BMPString: 31,
	Constructor: 32,
	Context: 128,
};

class ASN1Encoder {
	// Helper functions for ASN.1 DER encoding
	static length_(length: number): Uint8Array {
		if (length < 0x80) {
			// Short form: single byte length
			return new Uint8Array([length]);
		} else {
			// Long form: first byte is 0x80 + number of length bytes
			// Subsequent bytes are the length, big-endian
			let tempLength = length;
			const lengthBytesArray: number[] = [];
			while (tempLength > 0) {
				lengthBytesArray.unshift(tempLength & 0xff);
				tempLength >>= 8;
			}
			const numLengthBytes = lengthBytesArray.length;
			const result = new Uint8Array(1 + numLengthBytes);
			result[0] = 0x80 | numLengthBytes;
			for (let i = 0; i < numLengthBytes; i++) {
				result[i + 1] = lengthBytesArray[i];
			}
			return result;
		}
	}

	static ASN1(tag: number, data: Uint8Array): Uint8Array {
		const lengthBytes = ASN1Encoder.length_(data.length);
		const result = new Uint8Array(1 + lengthBytes.length + data.length);
		result[0] = tag;
		result.set(lengthBytes, 1);
		result.set(data, 1 + lengthBytes.length);
		return result;
	}

	static integer(number: Uint8Array): Uint8Array {
		// Ensure number is positive and first bit is 0
		if (number[0] > 0x7f) {
			const extendedNumber = new Uint8Array(number.length + 1);
			extendedNumber[0] = 0x00;
			extendedNumber.set(number, 1);
			number = extendedNumber;
		}
		return ASN1Encoder.ASN1(0x02, number); // INTEGER tag
	}

	static bitString(data: Uint8Array): Uint8Array {
		const unusedBits = new Uint8Array([0x00]);
		const combined = new Uint8Array(unusedBits.length + data.length);
		combined.set(unusedBits);
		combined.set(data, unusedBits.length);
		return ASN1Encoder.ASN1(0x03, combined); // BIT STRING tag
	}

	static octetString(data: Uint8Array): Uint8Array {
		return ASN1Encoder.ASN1(0x04, data); // OCTET STRING tag
	}

	static null(): Uint8Array {
		return ASN1Encoder.ASN1(0x05, new Uint8Array(0)); // NULL tag
	}

	static objectIdentifier(oid: string): Uint8Array {
		const oidParts = oid.split('.').map(Number);
		const firstByte = oidParts[0] * 40 + oidParts[1];
		const encodedParts = [firstByte];
		for (let i = 2; i < oidParts.length; i++) {
			let value = oidParts[i];
			const bytes: number[] = [];
			do {
				bytes.unshift(value & 0x7f);
				value >>= 7;
			} while (value > 0);
			for (let j = 0; j < bytes.length - 1; j++) {
				bytes[j] |= 0x80;
			}
			encodedParts.push(...bytes);
		}
		return ASN1Encoder.ASN1(0x06, new Uint8Array(encodedParts)); // OBJECT IDENTIFIER tag
	}

	static utf8String(str: string): Uint8Array {
		const utf8Bytes = new TextEncoder().encode(str);
		return ASN1Encoder.ASN1(0x0c, utf8Bytes); // UTF8String tag
	}

	static printableString(str: string): Uint8Array {
		const utf8Bytes = new TextEncoder().encode(str);
		return ASN1Encoder.ASN1(0x13, utf8Bytes); // PrintableString tag
	}

	static sequence(items: Uint8Array[]): Uint8Array {
		return ASN1Encoder.ASN1(0x30, concatUint8Arrays(items)); // SEQUENCE tag
	}

	static set(items: Uint8Array[]): Uint8Array {
		return ASN1Encoder.ASN1(0x31, concatUint8Arrays(items)); // SET tag
	}

	static ia5String(str: string): Uint8Array {
		const utf8Bytes = new TextEncoder().encode(str);
		return ASN1Encoder.ASN1(0x16, utf8Bytes); // IA5String tag
	}

	static contextSpecific(
		tagNumber: number,
		data: Uint8Array,
		constructed = false
	): Uint8Array {
		const tag = (constructed ? 0xa0 : 0x80) | tagNumber;
		return ASN1Encoder.ASN1(tag, data);
	}

	static boolean(value: boolean): Uint8Array {
		return ASN1Encoder.ASN1(0x01, new Uint8Array([value ? 0xff : 0x00])); // BOOLEAN tag
	}
}

export class ASN1Decoder {
	static decode(data: Uint8Array): any {
		const view = new DataView(data.buffer);
		const tag = view.getUint8(0);
		const length = view.getUint16(1);
		const value = data.slice(3, 3 + length);
		return {
			tag,
			length,
			value,
		};
	}
}

export interface CertificateIssuer {
	countryName?: string;
	organizationName?: string;
	commonName?: string;
	localityName?: string;
	stateOrProvinceName?: string;
	streetAddress?: string;
	postalCode?: string;
	emailAddress?: string;
	organizationalUnitName?: string;
	title?: string;
	description?: string;
	businessCategory?: string;
}

export type Validity = {
	notBefore: Date;
	notAfter: Date;
};

export type OID = keyof typeof oids;
export type OIDName = (typeof oids)[OID];

export interface BasicConstraints {
	ca: boolean;
	pathLenConstraint?: number;
}

export interface KeyUsage {
	digitalSignature?: boolean;
	nonRepudiation?: boolean;
	keyEncipherment?: boolean;
	dataEncipherment?: boolean;
	keyAgreement?: boolean;
	keyCertSign?: boolean;
	cRLSign?: boolean;
	encipherOnly?: boolean;
	decipherOnly?: boolean;
}

export interface ExtKeyUsage {
	serverAuth?: boolean;
	clientAuth?: boolean;
	codeSigning?: boolean;
	emailProtection?: boolean;
	timeStamping?: boolean;
}

export interface NSCertType {
	client?: boolean;
	server?: boolean;
	email?: boolean;
	objsign?: boolean;
	sslCA?: boolean;
	emailCA?: boolean;
	objCA?: boolean;
}

export interface SubjectAltNames {
	dnsNames?: string[];
	ipAddresses?: string[];
}

export interface TBSCertificateDescription {
	version?: number;
	serialNumber?: Uint8Array;
	signatureAlgorithm?: OIDName;
	issuer?: CertificateIssuer;
	validity?: Validity;
	subject: CertificateIssuer;
	basicConstraints?: BasicConstraints;
	keyUsage?: KeyUsage;
	extKeyUsage?: ExtKeyUsage;
	subjectAltNames?: SubjectAltNames;
	nsCertType?: NSCertType;
	authorityKeyIdentifier?: AuthorityKeyIdentifier;
	subjectKeyIdentifier?: SubjectKeyIdentifier;
}
export type TBSCertificate = Uint8Array;

export type AuthorityKeyIdentifier = {
	keyIdentifier: Uint8Array | boolean;
	issuerName?: string;
	serialNumber?: Uint8Array;
};

export type SubjectKeyIdentifier = {
	keyIdentifier: Uint8Array | boolean;
	issuerName?: string;
	serialNumber?: Uint8Array;
};

export type GeneratedCertificate = {
	keyPair: CryptoKeyPair;
	tbsCertificate: TBSCertificate;
	certificate: Uint8Array;
};

export class CertificateGenerator {
	static async generateCertificate(
		description: TBSCertificateDescription,
		issuerKeyPair?: CryptoKeyPair
	) {
		const keyPair = await crypto.subtle.generateKey(
			{
				name: 'RSASSA-PKCS1-v1_5',
				hash: 'SHA-256',
				modulusLength: 2048,
				publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			},
			true, // extractable
			['sign', 'verify']
		);
		const tbsCertificate = await this.signingRequest(
			description,
			keyPair.publicKey,
			issuerKeyPair?.publicKey ?? keyPair.publicKey
		);
		const certificate = await this.sign(
			tbsCertificate,
			issuerKeyPair?.privateKey ?? keyPair.privateKey
		);
		return {
			keyPair,
			tbsCertificate,
			certificate,
		};
	}

	static async sign(
		tbsCertificate: TBSCertificate,
		privateKey: CryptoKey
	): Promise<Uint8Array> {
		// Step 3: Sign the TBSCertificate
		const signature = await crypto.subtle.sign(
			{
				name: 'RSASSA-PKCS1-v1_5',
				hash: 'SHA-256',
			},
			privateKey,
			tbsCertificate.buffer
		);

		// Step 4: Build the final Certificate sequence
		const certificate = ASN1Encoder.sequence([
			new Uint8Array(tbsCertificate.buffer),
			this.signatureAlgorithm('sha256WithRSAEncryption'),
			ASN1Encoder.bitString(new Uint8Array(signature)),
		]);
		return certificate;
	}

	static async signingRequest(
		description: TBSCertificateDescription,
		subjectPublicKey: CryptoKey,
		issuerPublicKey: CryptoKey
	): Promise<TBSCertificate> {
		const extensions: Uint8Array[] = [];
		if (0 && description.keyUsage) {
			extensions.push(this.keyUsage(description.keyUsage));
		}
		if (0 && description.extKeyUsage) {
			extensions.push(this.extKeyUsage(description.extKeyUsage));
		}
		if (0 && description.subjectAltNames) {
			extensions.push(this.subjectAltName(description.subjectAltNames));
		}
		// if (description.nsCertType) {
		// 	extensions.push(this.nsCertType(description.nsCertType));
		// }
		if (description.basicConstraints) {
			extensions.push(
				this.basicConstraints(description.basicConstraints)
			);
		}
		if (0 && description.subjectKeyIdentifier) {
			const subjectKeyHash = await crypto.subtle.digest(
				'SHA-1',
				await crypto.subtle.exportKey('spki', subjectPublicKey)
			);
			const sk = {
				...description.subjectKeyIdentifier,
			};
			if (description.subjectKeyIdentifier.keyIdentifier === true) {
				sk.keyIdentifier = new Uint8Array(subjectKeyHash).slice(0, 20);
			}
			extensions.push(this.subjectKeyIdentifier(sk));
		}
		if (0 && description.authorityKeyIdentifier) {
			const aki = {
				...description.authorityKeyIdentifier,
			};
			if (description.authorityKeyIdentifier.keyIdentifier === true) {
				// console.log(
				// 	'authorityKeyIdentifier',
				// 	description.authorityKeyIdentifier
				// );
				const issuerPublicKeyBuffer = await crypto.subtle.exportKey(
					'spki',
					issuerPublicKey
				);
				const authorityKeyHash = await crypto.subtle.digest(
					'SHA-256',
					issuerPublicKeyBuffer
				);
				aki.keyIdentifier = new Uint8Array(authorityKeyHash).slice(
					0,
					18
				);
			}
			extensions.push(this.authorityKeyIdentifier(aki));
		}
		const tbsCertificate = ASN1Encoder.sequence([
			this.version(description.version),
			this.serialNumber(description.serialNumber),
			this.signatureAlgorithm(description.signatureAlgorithm),
			this.distinguishedName(description.issuer ?? description.subject),
			this.validity(description.validity),
			this.distinguishedName(description.subject),
			await this.subjectPublicKeyInfo(subjectPublicKey),
			this.extensions(extensions),
		]);
		return tbsCertificate;
	}

	private static version(version = 0x02) {
		// [0] EXPLICIT Version: 2 (v3)
		return ASN1Encoder.ASN1(
			0xa0,
			ASN1Encoder.integer(new Uint8Array([version]))
		);
	}

	private static serialNumber(
		serialNumber = crypto.getRandomValues(new Uint8Array(2))
		// serialNumber = crypto.getRandomValues(new Uint8Array(19))
	) {
		return ASN1Encoder.integer(serialNumber);
	}

	private static signatureAlgorithm(
		algorithm: OIDName = 'sha256WithRSAEncryption'
	) {
		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName(algorithm)),
			ASN1Encoder.null(),
		]);
	}

	private static async subjectPublicKeyInfo(publicKey: CryptoKey) {
		// ExportKey already returns data in ASN.1 DER format, we don't
		// need to wrap it in a sequence agin.
		return new Uint8Array(await crypto.subtle.exportKey('spki', publicKey));
	}

	private static extensions(extensions: Uint8Array[]) {
		return ASN1Encoder.ASN1(0xa3, ASN1Encoder.sequence(extensions));
	}

	private static distinguishedName(nameInfo: CertificateIssuer) {
		const values = [];
		for (const [oidName, value] of Object.entries(nameInfo)) {
			const entry = [
				ASN1Encoder.objectIdentifier(oidByName(oidName as OIDName)),
			];
			switch (oidName) {
				case 'countryName':
					entry.push(ASN1Encoder.printableString(value));
					break;
				default:
					entry.push(ASN1Encoder.utf8String(value));
			}
			values.push(ASN1Encoder.set([ASN1Encoder.sequence(entry)]));
		}
		return ASN1Encoder.sequence(values);
	}

	private static validity(validity?: Validity) {
		return ASN1Encoder.sequence([
			ASN1Encoder.ASN1(
				0x17,
				new TextEncoder().encode(
					formatDateASN1(validity?.notBefore ?? new Date())
				)
			),
			ASN1Encoder.ASN1(
				0x17,
				new TextEncoder().encode(
					formatDateASN1(
						validity?.notAfter ?? addYears(new Date(), 10)
					)
				)
			),
		]);
	}

	private static basicConstraints({
		ca = true,
		pathLenConstraint = undefined,
	}: BasicConstraints) {
		const sequence = [ASN1Encoder.boolean(ca)];
		if (pathLenConstraint !== undefined) {
			sequence.push(
				ASN1Encoder.integer(new Uint8Array([pathLenConstraint]))
			);
		}
		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName('basicConstraints')),
			// ASN1Encoder.boolean(true), // Critical
			ASN1Encoder.octetString(ASN1Encoder.sequence(sequence)),
		]);
	}

	private static keyUsage(keyUsage?: KeyUsage) {
		const keyUsageBits = new Uint8Array([0b00000000]);
		if (keyUsage?.digitalSignature) {
			keyUsageBits[0] |= 0b00000001;
		}
		if (keyUsage?.nonRepudiation) {
			keyUsageBits[0] |= 0b00000010;
		}
		if (keyUsage?.keyEncipherment) {
			keyUsageBits[0] |= 0b00000100;
		}
		if (keyUsage?.dataEncipherment) {
			keyUsageBits[0] |= 0b00001000;
		}
		if (keyUsage?.keyAgreement) {
			keyUsageBits[0] |= 0b00010000;
		}
		if (keyUsage?.keyCertSign) {
			keyUsageBits[0] |= 0b00100000;
		}
		if (keyUsage?.cRLSign) {
			keyUsageBits[0] |= 0b01000000;
		}
		if (keyUsage?.encipherOnly) {
			keyUsageBits[0] |= 0b10000000;
		}
		if (keyUsage?.decipherOnly) {
			keyUsageBits[0] |= 0b01000000;
		}
		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName('keyUsage')),
			ASN1Encoder.boolean(true), // Critical
			ASN1Encoder.octetString(ASN1Encoder.bitString(keyUsageBits)),
		]);
	}

	private static extKeyUsage(extKeyUsage: ExtKeyUsage = {}) {
		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName('extKeyUsage')),
			ASN1Encoder.boolean(true), // Critical
			ASN1Encoder.octetString(
				ASN1Encoder.sequence(
					Object.entries(extKeyUsage).map(([oidName, value]) => {
						if (value) {
							return ASN1Encoder.objectIdentifier(
								oidByName(oidName as OIDName)
							);
						}
						return ASN1Encoder.null();
					})
				)
			),
		]);
	}

	private static nsCertType(nsCertType: NSCertType) {
		const bits = new Uint8Array([0x00]);
		if (nsCertType.client) {
			bits[0] |= 0x01;
		}
		if (nsCertType.server) {
			bits[0] |= 0x02;
		}
		if (nsCertType.email) {
			bits[0] |= 0x04;
		}
		if (nsCertType.objsign) {
			bits[0] |= 0x08;
		}
		if (nsCertType.sslCA) {
			bits[0] |= 0x10;
		}
		if (nsCertType.emailCA) {
			bits[0] |= 0x20;
		}
		if (nsCertType.objCA) {
			bits[0] |= 0x40;
		}
		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName('nsCertType')),
			ASN1Encoder.octetString(bits),
		]);
	}

	private static subjectAltName(altNames: SubjectAltNames) {
		const generalNames =
			altNames.dnsNames?.map((name) => {
				const dnsName = ASN1Encoder.ia5String(name); // IA5String encoding
				return ASN1Encoder.contextSpecific(2, dnsName); // [2] dNSName
			}) || [];
		const ipAddresses =
			altNames.ipAddresses?.map((ip) => {
				const ipAddress = ASN1Encoder.ia5String(ip); // IA5String encoding
				return ASN1Encoder.contextSpecific(7, ipAddress); // [7] iPAddress
			}) || [];
		const sanExtensionValue = ASN1Encoder.octetString(
			ASN1Encoder.sequence([...generalNames, ...ipAddresses])
		);
		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName('subjectAltName')),
			ASN1Encoder.boolean(true),
			sanExtensionValue,
		]);
	}

	private static subjectKeyIdentifier(
		subjectKeyIdentifier: SubjectKeyIdentifier
	) {
		const { keyIdentifier, issuerName, serialNumber } =
			subjectKeyIdentifier;
		const values = [
			ASN1Encoder.contextSpecific(
				0,
				ASN1Encoder.octetString(keyIdentifier)
				// true
			),
		];
		// console.log(
		// 	'key identifier: ' +
		// 		ASN1Encoder.octetString(keyIdentifier).map((v) =>
		// 			v.toString(16)
		// 		)
		// );
		// if (issuerName) {
		// 	values.push(
		// 		ASN1Encoder.contextSpecific(
		// 			1,
		// 			new TextEncoder().encode(issuerName),
		// 			true
		// 		)
		// 	);
		// }
		// if (serialNumber) {
		// 	values.push(ASN1Encoder.contextSpecific(2, serialNumber, true));
		// }

		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName('subjectKeyIdentifier')),
			// ASN1Encoder.boolean(true), // Critical
			// ASN1Encoder.octetString(ASN1Encoder.sequence(values)),
			ASN1Encoder.octetString(ASN1Encoder.octetString(keyIdentifier)),
			// new Uint8Array([
			// 	0x04, 0x16,
			// 	0x04, 0x14, 0xA9, 0x6A, 0xE2, 0x13, 0x67, 0xE1,
			// 	0x78, 0x8C, 0x95, 0x8E, 0x9D, 0xCA, 0x11, 0x0C,
			// 	0xF9, 0x10, 0x68, 0x04, 0x03, 0xB3,
			// ])
		]);
	}

	private static authorityKeyIdentifier(
		authorityKeyIdentifier: AuthorityKeyIdentifier
	) {
		const { keyIdentifier, issuerName, serialNumber } =
			authorityKeyIdentifier;
		const values = [
			ASN1Encoder.contextSpecific(
				0,
				ASN1Encoder.octetString(keyIdentifier),
				true
			),
		];
		if (issuerName) {
			values.push(
				ASN1Encoder.contextSpecific(
					1,
					ASN1Encoder.octetString(
						new TextEncoder().encode(issuerName)
					),
					true
				)
			);
		}
		if (serialNumber) {
			values.push(ASN1Encoder.contextSpecific(2, serialNumber, true));
		}

		const authorityKeyIdentifierValue = ASN1Encoder.sequence(values);

		return ASN1Encoder.sequence([
			ASN1Encoder.objectIdentifier(oidByName('authorityKeyIdentifier')),
			ASN1Encoder.octetString(authorityKeyIdentifierValue),
		]);
	}
}

export function certificateToPEM(certificate: Uint8Array): string {
	const certificateBase64 = bufferToBase64(certificate.buffer);
	return `-----BEGIN CERTIFICATE-----\n${formatPEM(
		certificateBase64
	)}\n-----END CERTIFICATE-----`;
}

export async function privateKeyToPEM(privateKey: CryptoKey): Promise<string> {
	const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
	const pkcs8B64 = bufferToBase64(pkcs8);
	const pkcs8PEM = `-----BEGIN PRIVATE KEY-----\n${formatPEM(
		pkcs8B64
	)}\n-----END PRIVATE KEY-----`;
	return pkcs8PEM;
}

// Helper functions
function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function formatPEM(pemString: string): string {
	return pemString.match(/.{1,64}/g)?.join('\n') || pemString;
}

function formatDateASN1(date: Date): string {
	// Format date to YYMMDDHHMMSSZ for UTCTime
	const year = date.getUTCFullYear().toString().substr(2);
	const month = padNumber(date.getUTCMonth() + 1);
	const day = padNumber(date.getUTCDate());
	const hours = padNumber(date.getUTCHours());
	const minutes = padNumber(date.getUTCMinutes());
	const seconds = padNumber(date.getUTCSeconds());
	return `${year}${month}${day}${hours}${minutes}${seconds}Z`;
}

function padNumber(num: number): string {
	return num.toString().padStart(2, '0');
}

function addYears(date: Date, years: number): Date {
	const newDate = new Date(date);
	newDate.setUTCFullYear(newDate.getUTCFullYear() + years);
	return newDate;
}
