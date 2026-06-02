import {
	redactSensitiveText,
	redactSensitiveUrl,
} from '../lib/redact-sensitive-url';

describe('sensitive URL redaction', () => {
	it('redacts user info and token-like query params', () => {
		const url = redactSensitiveUrl(
			'https://user:pass@example.com/file.zip?access_token=secret&keep=1'
		);

		expect(url).toContain('REDACTED');
		expect(url).toContain('keep=1');
		expect(url).not.toContain('user:pass');
		expect(url).not.toContain('access_token=secret');
	});

	it('redacts nested URL-valued query params', () => {
		const text = redactSensitiveText(
			'Fetch https://proxy.example/?url=https://user:pass@example.com/file.zip?token=secret&keep=1'
		);

		expect(text).toContain('REDACTED');
		expect(text).toContain('keep=1');
		expect(text).not.toContain('user:pass');
		expect(text).not.toContain('token=secret');
	});

	it('redacts proxied URLs embedded in a URL path', () => {
		const text = redactSensitiveText(
			'Fetch https://proxy.example/https://user:pass@example.com/file.zip?token=secret'
		);

		expect(text).toContain('REDACTED');
		expect(text).not.toContain('user:pass');
		expect(text).not.toContain('token=secret');
	});
});
