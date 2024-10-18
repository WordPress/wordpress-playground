/**
 * TLS certificate_authorities extension
 * https://www.iana.org/go/rfc8446
 */

import { decodeASN1 } from './asn_1';

export interface CertificateAuthorities {
	certificate_authorities: Uint8Array[];
}

export class CertificateAuthoritiesExtension {
	static decode(data: Uint8Array): CertificateAuthorities {
		return { certificate_authorities: decodeASN1(data) } as any;
	}

	static encode(data: CertificateAuthorities): Uint8Array {
		const view = new DataView(new ArrayBuffer(2));
		let offset = 0;

		const length = data.certificate_authorities.reduce(
			(acc, ca) => acc + ca.length,
			0
		);
		view.setUint16(offset, length);
		offset += 2;

		for (const certificateAuthority of data.certificate_authorities) {
			view.setUint16(offset, certificateAuthority.length);
			offset += 2;

			for (const byte of certificateAuthority) {
				view.setUint8(offset, byte);
				offset += 1;
			}
		}
		return new Uint8Array(view.buffer);
	}
}
