/**
 * TLS server_name extension
 * https://www.rfc-editor.org/rfc/rfc6066.html
 */

import { ArrayBufferReader, ArrayBufferWriter } from '../utils';
import { ExtensionTypes } from './types';
import { flipObject } from '../utils';

/**
 * A list of supported signature algorithms,
 * one byte per algorithm.
 */
export type SignatureAlgorithms = Uint8Array;

/**
 * Signature algorithms from
 * https://datatracker.ietf.org/doc/html/rfc5246#section-7.4.1.4.1
 */
export const SignatureAlgorithms = {
	anonymous: 0,
	rsa: 1,
	dsa: 2,
	ecdsa: 3,
};
export type SignatureAlgorithm = keyof typeof SignatureAlgorithms;
export const SignatureAlgorithmsNames = flipObject(SignatureAlgorithms);

/**
 * Hash algorithms from
 * https://datatracker.ietf.org/doc/html/rfc5246#section-7.4.1.4.1
 */
export const HashAlgorithms = {
	none: 0,
	md5: 1,
	sha1: 2,
	sha224: 3,
	sha256: 4,
	sha384: 5,
	sha512: 6,
};
export type HashAlgorithm = keyof typeof HashAlgorithms;
export const HashAlgorithmsNames = flipObject(HashAlgorithms);

export type ParsedSignatureAlgorithm = {
	hash: HashAlgorithm;
	algorithm: SignatureAlgorithm;
};

/**
 * Handles the signature algorithms extension as defined in
 * https://www.rfc-editor.org/rfc/rfc8446.html#page-41
 */
export class SignatureAlgorithmsExtension {
	/**
	 * Binary layout:
	 *
	 * +------------------------------------+
	 * | Payload Length              [2B]   |
	 * +------------------------------------+
	 * | Hash Algorithm 1            [1B]   |
	 * | Signature Algorithm 1       [1B]   |
	 * +------------------------------------+
	 * | Hash Algorithm 2            [1B]   |
	 * | Signature Algorithm 2       [1B]   |
	 * +------------------------------------+
	 * | ...                                |
	 * +------------------------------------+
	 */
	static decodeFromClient(data: Uint8Array): ParsedSignatureAlgorithm[] {
		const reader = new ArrayBufferReader(data.buffer);
		reader.readUint16(); // Skip algorithms length
		const parsedAlgorithms: ParsedSignatureAlgorithm[] = [];
		while (!reader.isFinished()) {
			const hash = reader.readUint8();
			const algorithm = reader.readUint8();
			if (!SignatureAlgorithmsNames[algorithm]) {
				console.warn(`Unknown signature algorithm: ${algorithm}`);
				continue;
			}
			if (!HashAlgorithmsNames[hash]) {
				console.warn(`Unknown hash algorithm: ${hash}`);
				continue;
			}
			parsedAlgorithms.push({
				algorithm: SignatureAlgorithmsNames[algorithm],
				hash: HashAlgorithmsNames[hash],
			});
		}
		console.log({ parsedAlgorithms });
		return parsedAlgorithms;
	}

	/**
	 * +--------------------------------------------------+
	 * | Extension Type (signature_algorithms)     [2B]   |
	 * | 0x00 0x0D                                        |
	 * +--------------------------------------------------+
	 * | Body Length                               [2B]   |
	 * +--------------------------------------------------+
	 * | Hash Algorithm                            [1B]   |
	 * | Signature Algorithm                       [1B]   |
	 * +--------------------------------------------------+
	 */
	static encodeforClient(
		hash: HashAlgorithm,
		algorithm: SignatureAlgorithm
	): Uint8Array {
		const writer = new ArrayBufferWriter(6);
		writer.writeUint16(ExtensionTypes.signature_algorithms);
		writer.writeUint16(2);
		writer.writeUint8(HashAlgorithms[hash]);
		writer.writeUint8(SignatureAlgorithms[algorithm]);
		return writer.uint8Array;
	}
}
