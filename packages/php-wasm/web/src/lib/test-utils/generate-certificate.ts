import selfsigned from 'selfsigned';

let cachedCertificate: { cert: string; key: string; certPath: string } | null =
	null;

export function generateCertificate(): {
	cert: string;
	key: string;
	certPath: string;
} {
	// Return cached certificate if already generated
	if (cachedCertificate) {
		return cachedCertificate;
	}

	const attrs = [{ name: 'commonName', value: 'localhost' }];
	const options = {
		days: 365,
		keySize: 2048,
		algorithm: 'sha256',
		extensions: [
			{
				name: 'subjectAltName',
				altNames: [
					{ type: 2, value: 'localhost' }, // DNS name
					{ type: 7, ip: '127.0.0.1' }, // IP address
				],
			},
		],
	};
	const pems = selfsigned.generate(attrs, options);

	// Cache the certificate for reuse
	// Note: We don't create a certificate file because NODE_EXTRA_CA_CERTS
	// can't be set dynamically. Instead, we rely on NODE_TLS_REJECT_UNAUTHORIZED=0
	cachedCertificate = {
		cert: pems.cert,
		key: pems.private,
		certPath: '', // Not used, but kept for interface compatibility
	};

	return cachedCertificate;
}

export function cleanupCertificate(): void {
	cachedCertificate = null;
}
