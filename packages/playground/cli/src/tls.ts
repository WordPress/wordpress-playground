import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '@php-wasm/logger';

export interface TlsCertificates {
	key: string;
	cert: string;
}

/**
 * Generates an ephemeral self-signed TLS certificate and private key
 * using the system's OpenSSL (or LibreSSL) installation.
 *
 * The certificate is valid for localhost and 127.0.0.1, expires in
 * 30 days, and is intended for local development only.
 */
export function generateSelfSignedCert(): TlsCertificates {
	const tempDir = mkdtempSync(join(tmpdir(), 'playground-tls-'));
	const keyPath = join(tempDir, 'key.pem');
	const certPath = join(tempDir, 'cert.pem');
	const confPath = join(tempDir, 'openssl.cnf');

	const opensslConf = `[req]
distinguished_name = req_dn
x509_extensions = v3_req
prompt = no

[req_dn]
CN = localhost

[v3_req]
subjectAltName = DNS:localhost,IP:127.0.0.1
`;

	try {
		writeFileSync(confPath, opensslConf);
		execFileSync('openssl', [
			'req',
			'-x509',
			'-newkey',
			'rsa:2048',
			'-nodes',
			'-keyout',
			keyPath,
			'-out',
			certPath,
			'-days',
			'30',
			'-config',
			confPath,
		]);
		return {
			key: readFileSync(keyPath, 'utf8'),
			cert: readFileSync(certPath, 'utf8'),
		};
	} finally {
		try {
			unlinkSync(keyPath);
		} catch {
			// ignore
		}
		try {
			unlinkSync(certPath);
		} catch {
			// ignore
		}
		try {
			unlinkSync(confPath);
		} catch {
			// ignore
		}
	}
}

/**
 * Checks whether mkcert is installed and has a trusted CA root.
 * Returns the CA root path if available, or null if mkcert is not
 * usable.
 */
export function getMkcertCaRoot(): string | null {
	try {
		const caRoot = execSync('mkcert -CAROOT', {
			stdio: ['pipe', 'pipe', 'pipe'],
		})
			.toString()
			.trim();
		if (!caRoot) {
			return null;
		}
		try {
			readFileSync(join(caRoot, 'rootCA.pem'));
			return caRoot;
		} catch {
			return null;
		}
	} catch {
		return null;
	}
}

/**
 * Generates a locally-trusted TLS certificate using mkcert.
 * Requires mkcert to be installed with its CA root set up.
 */
export function generateMkcertCert(): TlsCertificates {
	const tempDir = mkdtempSync(join(tmpdir(), 'playground-tls-'));
	const keyPath = join(tempDir, 'key.pem');
	const certPath = join(tempDir, 'cert.pem');

	try {
		execFileSync('mkcert', [
			'-key-file',
			keyPath,
			'-cert-file',
			certPath,
			'localhost',
			'127.0.0.1',
		]);
		return {
			key: readFileSync(keyPath, 'utf8'),
			cert: readFileSync(certPath, 'utf8'),
		};
	} finally {
		try {
			unlinkSync(keyPath);
		} catch {
			// ignore
		}
		try {
			unlinkSync(certPath);
		} catch {
			// ignore
		}
	}
}

/**
 * Resolves TLS certificates using a priority chain:
 * 1. User-supplied certs (--ssl-cert / --ssl-key)
 * 2. mkcert (if installed with trusted CA)
 * 3. Self-signed fallback
 */
export function resolveTlsCertificates(options: {
	sslCert?: string;
	sslKey?: string;
}): TlsCertificates {
	if (options.sslCert && options.sslKey) {
		logger.log('Using user-supplied TLS certificates.');
		return {
			key: readFileSync(options.sslKey, 'utf8'),
			cert: readFileSync(options.sslCert, 'utf8'),
		};
	}

	const caRoot = getMkcertCaRoot();
	if (caRoot) {
		logger.log('Using mkcert for locally-trusted TLS certificates.');
		return generateMkcertCert();
	}

	logger.log('Generating self-signed TLS certificate for HTTPS.');
	logger.log(
		'Tip: Install mkcert (https://github.com/FiloSottile/mkcert) for warning-free HTTPS.'
	);
	return generateSelfSignedCert();
}
