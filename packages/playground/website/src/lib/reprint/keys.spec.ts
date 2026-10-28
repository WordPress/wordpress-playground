import { createPrivateKey, createPublicKey } from 'node:crypto';
import { generateReprintKeyPair, redactReprintPrivateKeys } from './keys';

// Reprint accepts RSA private PEM and a one-line base64 SPKI public key.
// Check the shared key, not just the two strings returned by the form.
describe('Reprint keys', () => {
	it('generates matching RSA keys in the format Reprint accepts', async () => {
		const pair = await generateReprintKeyPair();
		const privateKey = createPrivateKey(pair.privateKey);
		expect(privateKey.asymmetricKeyType).toBe('rsa');
		expect(privateKey.asymmetricKeyDetails?.modulusLength).toBe(3072);
		expect(
			createPublicKey(privateKey)
				.export({ type: 'spki', format: 'der' })
				.toString('base64')
		).toBe(pair.publicKey);
	});

	it.each(['\n', '\\n'])(
		'redacts raw or JSON-escaped PEM before a log tail is taken',
		(newline) => {
			const key = [
				'-----BEGIN PRIVATE KEY-----',
				'private-body',
				'-----END PRIVATE KEY-----',
			].join(newline);
			expect(redactReprintPrivateKeys(`error: ${key}`)).toBe(
				'error: [redacted]'
			);
		}
	);
});
