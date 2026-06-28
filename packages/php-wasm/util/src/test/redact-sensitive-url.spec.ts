import {
	hasSensitiveUrlData,
	redactSensitiveText,
	redactSensitiveUrl,
} from '../lib/redact-sensitive-url';

describe('sensitive URL redaction', () => {
	it('redacts user info and token-like query params', () => {
		const url = redactSensitiveUrl(
			'https://user:pass@example.com/file.zip?access_token=secret&api_key=private&keep=1'
		);

		expect(url).toContain('REDACTED');
		expect(url).toContain('keep=1');
		expect(url).not.toContain('user:pass');
		expect(url).not.toContain('access_token=secret');
		expect(url).not.toContain('api_key=private');
	});

	it('redacts signed and OAuth query params without substring matches', () => {
		const url = redactSensitiveUrl(
			'https://example.com/file.zip?oauth_token=a&x-amz-signature=b&x-amz-credential=c&private_token=d&AWSAccessKeyId=e&keyboard=visible'
		);

		expect(url).toContain('keyboard=visible');
		expect(url).not.toContain('oauth_token=a');
		expect(url).not.toContain('x-amz-signature=b');
		expect(url).not.toContain('x-amz-credential=c');
		expect(url).not.toContain('private_token=d');
		expect(url).not.toContain('AWSAccessKeyId=e');
	});

	it.each([
		'accessToken',
		'apiKey',
		'authToken',
		'clientSecret',
		'client-secret',
		'consumerKey',
		'consumer-key',
		'idToken',
		'id-token',
		'oauthToken',
		'password',
		'privateToken',
		'refreshToken',
		'sessionToken',
		'signature',
		'sig',
		'csrfToken',
	])('redacts the %s query param', (paramName) => {
		const url = redactSensitiveUrl(
			`https://example.com/file.zip?${paramName}=secret&keep=1`
		);

		expect(url).toContain('keep=1');
		expect(url).not.toContain(`${paramName}=secret`);
	});

	it('keeps query params whose names only contain sensitive words', () => {
		const url = redactSensitiveUrl(
			'https://example.com/?keyboard=visible&monkey=banana&keep=1'
		);

		expect(url).toContain('keyboard=visible');
		expect(url).toContain('monkey=banana');
		expect(url).toContain('keep=1');
		expect(url).not.toContain('REDACTED');
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

	it('redacts sensitive URL fragments', () => {
		const url = redactSensitiveUrl(
			'https://example.com/repo.git#access_token=secret&keep=1'
		);

		expect(url).toContain('keep=1');
		expect(url).not.toContain('access_token=secret');
		expect(url).toContain('access_token=REDACTED');
	});

	it('redacts likely secrets in malformed URLs', () => {
		const url = redactSensitiveUrl(
			'https://user:pass@example .com/repo.git?token=secret&keep=1'
		);

		expect(url).toContain('token=REDACTED');
		expect(url).toContain('keep=1');
		expect(url).not.toContain('user:pass');
		expect(url).not.toContain('token=secret');
	});

	it('redacts nested URLs embedded in fragments', () => {
		const url = redactSensitiveUrl(
			'https://proxy.example/#url=https://user:pass@example.com/repo.git?sessionToken=secret&keep=1'
		);

		expect(url).toContain('REDACTED');
		expect(url).toContain('keep=1');
		expect(url).not.toContain('user:pass');
		expect(url).not.toContain('sessionToken=secret');
	});

	it('reports whether a URL contains sensitive data', () => {
		expect(hasSensitiveUrlData('https://user@example.com/repo.git')).toBe(
			true
		);
		expect(
			hasSensitiveUrlData(
				'https://example.com/repo.git?oauth_token=secret'
			)
		).toBe(true);
		expect(
			hasSensitiveUrlData(
				'https://proxy.example/?url=https://example.com/repo.git?token=secret'
			)
		).toBe(true);
		expect(
			hasSensitiveUrlData(
				'https://example.com/repo.git#access_token=secret'
			)
		).toBe(true);
		expect(
			hasSensitiveUrlData(
				'https://proxy.example/#url=https://example.com/repo.git?token=secret'
			)
		).toBe(true);
		expect(hasSensitiveUrlData('https://example.com/repo.git')).toBe(false);
		expect(
			hasSensitiveUrlData('https://example.com/repo.git?keyboard=visible')
		).toBe(false);
		expect(
			hasSensitiveUrlData('https://example.com/repo.git#keyboard=visible')
		).toBe(false);
	});
});
