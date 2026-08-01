vi.mock('virtual:remote-config', () => ({ buildVersion: 'test' }));

vi.stubGlobal('caches', {
	open: vi.fn().mockResolvedValue({}),
});
vi.stubGlobal('self', {
	location: { hostname: 'example.com' },
	registration: { scope: 'https://example.com/' },
});

export {};

const { shouldCacheUrl } = await import('./offline-mode-cache');

describe('shouldCacheUrl', () => {
	it('does not cache dynamic WordPress REST API responses', () => {
		const baseUrl = 'https://example.com/wordpress/';
		expect(
			shouldCacheUrl(
				new URL('https://example.com/wordpress/wp-json'),
				baseUrl
			)
		).toBe(false);
		expect(
			shouldCacheUrl(
				new URL(
					'https://example.com/wordpress/wp-json/example/v1/resource?ref=a'
				),
				baseUrl
			)
		).toBe(false);
		expect(
			shouldCacheUrl(
				new URL(
					'https://example.com/wordpress/?rest_route=/example/v1/resource&ref=a'
				),
				baseUrl
			)
		).toBe(false);
	});

	it('continues to cache same-origin static assets', () => {
		expect(
			shouldCacheUrl(
				new URL('https://example.com/assets/remote.js?version=1')
			)
		).toBe(true);
	});
});
