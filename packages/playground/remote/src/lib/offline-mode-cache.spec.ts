vi.mock('virtual:remote-config', () => ({ buildVersion: 'test' }));

vi.stubGlobal('caches', {
	open: vi.fn().mockResolvedValue({}),
});
vi.stubGlobal('self', {
	location: { hostname: 'example.com' },
});

export {};

const { shouldCacheUrl } = await import('./offline-mode-cache');

describe('shouldCacheUrl', () => {
	it('does not cache dynamic WordPress REST API responses', () => {
		expect(shouldCacheUrl(new URL('https://example.com/wp-json'))).toBe(
			false
		);
		expect(
			shouldCacheUrl(
				new URL('https://example.com/wp-json/example/v1/resource?ref=a')
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
