export type ReprintKeyPair = { privateKey: string; publicKey: string };

/**
 * Generate Reprint's RSA key format before the clone has a PHP runtime.
 * Only the public half is enrolled on the live site. Reprint's PHP client
 * signs requests with the private half; the browser does not implement its
 * authentication protocol. Neither key is part of the downloaded site.
 */
export async function generateReprintKeyPair(): Promise<ReprintKeyPair> {
	const pair = await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 3072,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256',
		},
		true,
		['sign', 'verify']
	);
	const privateBytes = await crypto.subtle.exportKey(
		'pkcs8',
		pair.privateKey
	);
	const publicBytes = await crypto.subtle.exportKey('spki', pair.publicKey);
	const privateBase64 = btoa(
		String.fromCharCode(...new Uint8Array(privateBytes))
	);
	return {
		privateKey: `-----BEGIN PRIVATE KEY-----\n${privateBase64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`,
		publicKey: btoa(String.fromCharCode(...new Uint8Array(publicBytes))),
	};
}

/** Remove PEM blocks before displaying errors or taking a diagnostic log's tail. */
export function redactReprintPrivateKeys(message: string): string {
	// Match raw PEM and JSON-escaped newlines, including keys from upstream errors.
	return message.replace(
		/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/g,
		'[redacted]'
	);
}
