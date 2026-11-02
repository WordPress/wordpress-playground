import type * as OfflineCache from './offline-mode-cache';

vi.mock('virtual:remote-config', () => ({ buildVersion: 'test' }));
vi.mock('./config', () => ({
	playgroundOrigin: 'https://playground.test:9443',
}));

describe('offline asset scope', () => {
	let shouldCacheUrl: typeof OfflineCache.shouldCacheUrl;
	beforeEach(async () => {
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({}) });
		vi.stubGlobal('self', {
			location: new URL('https://playground.test:9443'),
		});
		({ shouldCacheUrl } = await import('./offline-mode-cache'));
	});
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		'https://wp.playground.test:9443/wordpress-bridge.html?scope=another-site',
		'https://wp.playground.test:9443/assets/worker.js?playground-site-thumbnail-worker=1',
		'https://playground.test:9443/assets/app.js',
		'https://playground.test:9443/wp-6.9/wordpress-static.zip',
	])('does not trust WordPress CacheStorage for %s', (url) => {
		vi.stubGlobal('self', {
			location: new URL('https://wp.playground.test:9443'),
		});
		expect(shouldCacheUrl(new URL(url))).toBe(false);
	});

	it('keeps shared app-origin downloads cacheable', () => {
		expect(
			shouldCacheUrl(
				new URL('https://playground.test:9443/assets/php.wasm')
			)
		).toBe(true);
		expect(
			shouldCacheUrl(
				new URL(
					'https://playground.test:9443/wp-6.9/wordpress-static.zip'
				)
			)
		).toBe(true);
	});

	it('does not replay API responses from a WordPress site on another port', () => {
		expect(
			shouldCacheUrl(new URL('https://playground.test:9443/app.js'))
		).toBe(true);
		expect(
			shouldCacheUrl(new URL('https://playground.test:9417/?reprint-api'))
		).toBe(false);
		expect(
			shouldCacheUrl(new URL('http://playground.test:9443/?reprint-api'))
		).toBe(false);
	});
});
