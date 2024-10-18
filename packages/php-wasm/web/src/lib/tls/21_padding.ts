/**
 * TLS server_name extension
 * https://www.rfc-editor.org/rfc/rfc6066.html
 */

export type Padding = null;

export class PaddingExtension {
	static decode(): Padding {
		return null;
	}

	static encode(): Uint8Array {
		throw new Error('Not implemented yet');
	}
}
