import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Protect HTTP reuse on CacheStorage misses: an accidental return to fetchFresh
// would download the same immutable asset again on every new site origin.
describe('shared asset HTTP caching', () => {
	const base = 'http://static.playground.localhost:9400/release-a/';
	const cache = { match: vi.fn(), put: vi.fn() };

	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('self', {
			location: new URL(
				'http://site-aaaa.playground.localhost:9400/release-a/sw.js'
			),
		});
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue(cache) });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('asset'))
		);
		vi.stubEnv('BASE_URL', base);
		cache.match.mockReset();
		cache.put.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('fills a site cache from the shared HTTP cache when available', async () => {
		const { cacheFirstFetch, shouldCacheUrl } =
			await import('./offline-mode-cache');
		const request = new Request(`${base}assets/php.wasm`);
		expect(shouldCacheUrl(new URL(request.url))).toBe(true);
		await cacheFirstFetch(request);
		expect(fetch).toHaveBeenCalledWith(request, { cache: 'default' });
		expect(cache.put).toHaveBeenCalledWith(request, expect.any(Response));
	});

	it('does not fetch again when this site already has the asset', async () => {
		const { cacheFirstFetch } = await import('./offline-mode-cache');
		const response = new Response('cached');
		cache.match.mockResolvedValue(response);
		expect(await cacheFirstFetch(new Request(`${base}app.js`))).toBe(
			response
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('uses a new cache for a local rebuild even when the Git version stays the same', async () => {
		await import('./offline-mode-cache');
		const firstName = vi.mocked(caches.open).mock.calls[0][0];
		vi.resetModules();
		vi.stubEnv(
			'BASE_URL',
			'http://static.playground.localhost:9400/release-b/'
		);
		await import('./offline-mode-cache');
		expect(vi.mocked(caches.open).mock.calls[1][0]).not.toBe(firstName);
	});

	it.each([
		'http://static.playground.localhost:9400/release-old/app.js',
		'http://static.playground.localhost:9400/release-a-other/app.js',
		'http://static.playground.localhost:9401/release-a/app.js',
		'http://site-bbbb.playground.localhost:9400/release-a/app.js',
		'http://site-aaaa.playground.localhost:9400/scope:123/index.php',
	])('does not treat %s as an immutable shared asset', async (href) => {
		const { shouldCacheUrl } = await import('./offline-mode-cache');
		expect(shouldCacheUrl(new URL(href))).toBe(false);
	});

	it('caches only its own shell and release-specific entry wrappers', async () => {
		const { shouldCacheUrl } = await import('./offline-mode-cache');
		const origin = 'http://site-aaaa.playground.localhost:9400';
		expect(shouldCacheUrl(new URL('/remote.html', origin))).toBe(true);
		expect(
			shouldCacheUrl(new URL('/release-a/assets/worker-abc.js', origin))
		).toBe(true);
		expect(
			shouldCacheUrl(new URL('/release-old/assets/worker-abc.js', origin))
		).toBe(false);
		expect(shouldCacheUrl(new URL('/scope:123/index.php', origin))).toBe(
			false
		);
		expect(
			shouldCacheUrl(
				new URL(
					'http://site-bbbb.playground.localhost:9400/remote.html'
				)
			)
		).toBe(false);
	});

	it('keeps the deployed unversioned URLs out of the HTTP cache', async () => {
		vi.stubGlobal('self', {
			location: new URL('https://playground.wordpress.net/sw.js'),
		});
		vi.stubEnv('BASE_URL', '/');
		const { cacheFirstFetch, networkFirstFetch } =
			await import('./offline-mode-cache');
		const asset = new Request('https://playground.wordpress.net/app.js');
		await cacheFirstFetch(asset);
		expect(fetch).toHaveBeenLastCalledWith(asset, { cache: 'no-store' });
		const document = new Request('https://playground.wordpress.net/');
		await networkFirstFetch(document);
		expect(fetch).toHaveBeenLastCalledWith(document, { cache: 'no-store' });
	});
});
