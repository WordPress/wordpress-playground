/**
 * Renegotiation Info Extension (RFC 5746)
 * https://datatracker.ietf.org/doc/html/rfc5746
 *
 * This extension is used to prevent MITM attacks during TLS renegotiation.
 * For initial connections (not renegotiations), the client sends an empty
 * renegotiated_connection field, and the server responds with the same.
 *
 * struct {
 *    opaque renegotiated_connection<0..255>;
 * } RenegotiationInfo;
 */

import { ExtensionTypes } from './types';

export type RenegotiationInfo = {
	renegotiatedConnection: Uint8Array;
};

export const RenegotiationInfoExtension = {
	decodeFromClient(data: Uint8Array): RenegotiationInfo {
		// First byte is the length of the renegotiated_connection field
		const length = data[0] ?? 0;
		return {
			renegotiatedConnection: data.slice(1, 1 + length),
		};
	},

	/**
	 * For an initial connection (not a renegotiation), the server responds
	 * with an empty renegotiated_connection field.
	 */
	encodeForClient(): Uint8Array {
		const extensionType = ExtensionTypes.renegotiation_info;
		// Extension data: 1 byte length (0) for empty renegotiated_connection
		const extensionData = new Uint8Array([0]);
		return new Uint8Array([
			(extensionType >> 8) & 0xff,
			extensionType & 0xff,
			0,
			extensionData.length,
			...extensionData,
		]);
	},
};
