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

// Cache failures and the HTTP transport are independent. These tests force and
// observe the failing call so successful downloads cannot hide a missing fault.
describe('optional offline cache', () => {
	const asset = 'https://playground.test:9443/assets/app.js';
	let cache: {
		match: ReturnType<typeof vi.fn>;
		put: ReturnType<typeof vi.fn>;
	};
	let storage: {
		open: ReturnType<typeof vi.fn>;
		keys: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	let fetchAsset: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		cache = { match: vi.fn(), put: vi.fn() };
		storage = {
			open: vi.fn().mockResolvedValue(cache),
			keys: vi.fn().mockResolvedValue(['playground-cache-old']),
			delete: vi.fn(),
		};
		fetchAsset = vi.fn().mockResolvedValue(new Response('JavaScript'));
		vi.stubGlobal('caches', storage);
		vi.stubGlobal('fetch', fetchAsset);
		vi.stubGlobal('self', {
			location: new URL('https://playground.test:9443'),
		});
	});

	afterEach(() => vi.unstubAllGlobals());

	it.each(['open', 'match'] as const)(
		'loads from HTTP when cache %s rejects',
		async (method) => {
			const failingCall = method === 'open' ? storage.open : cache.match;
			failingCall.mockRejectedValue(
				new DOMException('Storage denied', 'SecurityError')
			);
			const { cacheFirstFetch } = await import('./offline-mode-cache');
			const response = await cacheFirstFetch(new Request(asset));
			expect(await response.text()).toBe('JavaScript');
			expect(failingCall).toHaveBeenCalled();
			expect(fetchAsset).toHaveBeenCalledOnce();
		}
	);

	it('settles a failed cache write without rejecting its caller', async () => {
		cache.put.mockRejectedValue(
			new DOMException('Cache full', 'QuotaExceededError')
		);
		const { putCachedResponse } = await import('./offline-mode-cache');
		await expect(
			putCachedResponse(asset, new Response('JavaScript'))
		).resolves.toBeUndefined();
		expect(cache.put).toHaveBeenCalledOnce();
	});

	it.each(['keys', 'delete'] as const)(
		'finishes old-cache cleanup when %s rejects',
		async (method) => {
			storage[method].mockRejectedValue(
				new DOMException('Storage denied', 'SecurityError')
			);
			const { purgeEverythingFromPreviousRelease } =
				await import('./offline-mode-cache');
			await expect(
				purgeEverythingFromPreviousRelease()
			).resolves.toBeUndefined();
			expect(storage[method]).toHaveBeenCalled();
		}
	);

	it.each([401, 403, 503])(
		'preserves a warm entry after HTTP %s',
		async (status) => {
			cache.match.mockResolvedValue(new Response('Cached document'));
			fetchAsset.mockResolvedValue(
				new Response('Unavailable', { status })
			);
			const { networkFirstFetch } = await import('./offline-mode-cache');
			expect(
				await (await networkFirstFetch(new Request(asset))).text()
			).toBe('Cached document');
		}
	);

	it.each([401, 403, 503])(
		'returns the original HTTP %s without a warm entry',
		async (status) => {
			fetchAsset.mockResolvedValue(
				new Response('Unavailable', { status })
			);
			const { networkFirstFetch } = await import('./offline-mode-cache');
			expect((await networkFirstFetch(new Request(asset))).status).toBe(
				status
			);
		}
	);

	it('does not cache a denied asset, allowing the next HTTP request to succeed', async () => {
		fetchAsset.mockResolvedValueOnce(
			new Response('Challenge', { status: 403 })
		);
		const { cacheFirstFetch } = await import('./offline-mode-cache');
		expect((await cacheFirstFetch(new Request(asset))).status).toBe(403);
		expect(cache.put).not.toHaveBeenCalled();
		expect(await (await cacheFirstFetch(new Request(asset))).text()).toBe(
			'JavaScript'
		);
		expect(fetchAsset).toHaveBeenCalledTimes(2);
	});
});
