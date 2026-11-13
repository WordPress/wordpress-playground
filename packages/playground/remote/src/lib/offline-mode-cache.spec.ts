import type * as OfflineCache from './offline-mode-cache';

vi.mock('virtual:remote-config', () => ({ buildVersion: 'test' }));
vi.mock('./config', () => ({
	playgroundOrigin: 'https://playground.test:9443',
	assetBaseUrl: new URL('https://playground.test:9443/releases/release.B/'),
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

describe('offline release retention', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('removes unused releases and old build caches without touching unrelated storage', async () => {
		vi.resetModules();
		const assets = new Map([
			[
				'https://playground.test:9443/releases/release.A/old.js',
				new Response('old'),
			],
			[
				'https://playground.test:9443/releases/release.B/app.js',
				new Response('current'),
			],
			[
				'https://playground.test:9443/bootstrap.js',
				new Response('bootstrap'),
			],
		]);
		const deleteCache = vi.fn();
		vi.stubGlobal('caches', {
			open: async () => ({
				keys: async () =>
					[...assets.keys()].map((url) => new Request(url)),
				delete: async (request: Request) => assets.delete(request.url),
			}),
			keys: async () => [
				'playground-cache-previous-build',
				'playground-cache-release-assets-v1',
				'saved-sites',
			],
			delete: deleteCache,
		});
		const { pruneOfflineModeCaches } = await import('./offline-mode-cache');
		await pruneOfflineModeCaches(
			new Set(['/releases/release.A/', '/releases/release.B/']),
			false
		);
		expect(assets.size).toBe(3);
		expect(deleteCache).not.toHaveBeenCalled();
		await pruneOfflineModeCaches(new Set(['/releases/release.B/']), true);
		expect([...assets.keys()]).toEqual([
			'https://playground.test:9443/releases/release.B/app.js',
			'https://playground.test:9443/bootstrap.js',
		]);
		expect(deleteCache.mock.calls).toEqual([
			['playground-cache-previous-build'],
		]);
	});
});
