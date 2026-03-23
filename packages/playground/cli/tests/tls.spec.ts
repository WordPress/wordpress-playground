import { describe, it, expect, vi, beforeAll } from 'vitest';
import type * as ChildProcessModule from 'child_process';
import { X509Certificate } from 'crypto';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
	generateSelfSignedCert,
	resolveTlsCertificate,
	type TlsCertificate,
} from '../src/tls';

vi.mock('@php-wasm/logger', () => ({
	logger: { log: vi.fn(), error: vi.fn() },
}));

describe('generateSelfSignedCert', () => {
	let cert: TlsCertificate;

	beforeAll(() => {
		cert = generateSelfSignedCert();
	});

	it('returns valid PEM key and cert', () => {
		expect(cert.key).toContain('-----BEGIN PRIVATE KEY-----');
		expect(cert.cert).toContain('-----BEGIN CERTIFICATE-----');
	});

	it('cert covers localhost and 127.0.0.1', () => {
		const x509 = new X509Certificate(cert.cert);
		const san = x509.subjectAltName ?? '';
		expect(san).toContain('DNS:localhost');
		expect(san).toContain('IP Address:127.0.0.1');
	});

	it('cert has CN=localhost', () => {
		const x509 = new X509Certificate(cert.cert);
		expect(x509.subject).toContain('CN=localhost');
	});
});

describe('getMkcertCaRoot', () => {
	it('returns null when mkcert is not installed', async () => {
		vi.resetModules();
		vi.doMock('child_process', async (importOriginal) => {
			const actual = await importOriginal<typeof ChildProcessModule>();
			return {
				...actual,
				execSync: (cmd: string, ...args: any[]) => {
					if (typeof cmd === 'string' && cmd.includes('mkcert')) {
						throw new Error('command not found: mkcert');
					}
					return actual.execSync(cmd, ...args);
				},
			};
		});

		const { getMkcertCaRoot } = await import('../src/tls');
		const result = getMkcertCaRoot();
		expect(result).toBeNull();
		vi.doUnmock('child_process');
	});
});

describe('resolveTlsCertificate', () => {
	it('reads user-supplied cert and key files', () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'tls-test-'));
		const cert = generateSelfSignedCert();
		const certPath = join(tempDir, 'cert.pem');
		const keyPath = join(tempDir, 'key.pem');
		writeFileSync(certPath, cert.cert);
		writeFileSync(keyPath, cert.key);

		const result = resolveTlsCertificate({
			sslCert: certPath,
			sslKey: keyPath,
		});
		expect(result.cert).toBe(cert.cert);
		expect(result.key).toBe(cert.key);
	});

	it('falls back to self-signed cert when no user certs and no mkcert', async () => {
		vi.resetModules();
		vi.doMock('child_process', async (importOriginal) => {
			const actual = await importOriginal<typeof ChildProcessModule>();
			return {
				...actual,
				execSync: (cmd: string, ...args: any[]) => {
					if (typeof cmd === 'string' && cmd.includes('mkcert')) {
						throw new Error('command not found: mkcert');
					}
					return actual.execSync(cmd, ...args);
				},
			};
		});

		const { resolveTlsCertificate: freshResolve } =
			await import('../src/tls');
		const result = freshResolve({});
		expect(result.key).toContain('-----BEGIN PRIVATE KEY-----');
		expect(result.cert).toContain('-----BEGIN CERTIFICATE-----');
		vi.doUnmock('child_process');
	});
});
