/**
 * TLS server_name extension
 * https://www.rfc-editor.org/rfc/rfc6066.html
 */

/**
 * A list of supported signature algorithms,
 * one byte per algorithm.
 */
export type SignatureAlgorithms = Uint8Array;

export class SignatureAlgorithmsExtension {
	static decode(data: Uint8Array): SignatureAlgorithms {
		console.log({ data });
		return data;
	}

	static encode(): Uint8Array {
		throw new Error('Not implemented yet');
	}
}
