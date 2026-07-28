import { afterEach, describe, expect, it, vi } from 'vitest';

describe('cacheOfflineModeAssetsForCurrentRelease', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('deduplicates manifest URLs before adding them to CacheStorage', async () => {
		const addAll = vi.fn<Cache['addAll']>();
		const fetch = vi.fn(async () => ({
			json: async () => ['/sw.js', '/sw.js', '/remote.html', '/'],
		}));

		vi.stubGlobal('caches', {
			open: vi.fn(async () => ({
				addAll,
			})),
		});
		vi.stubGlobal('fetch', fetch);
		vi.stubGlobal('Request', FakeRequest);

		const { cacheOfflineModeAssetsForCurrentRelease } =
			await import('./offline-mode-cache');

		await cacheOfflineModeAssetsForCurrentRelease();

		expect(fetch).toHaveBeenCalledWith(
			'/assets-required-for-offline-mode.json',
			{
				cache: 'no-store',
			}
		);
		expect(addAll).toHaveBeenCalledTimes(1);
		const requests = addAll.mock.calls[0][0] as unknown as FakeRequest[];
		expect(requests.map((request) => request.url)).toEqual([
			'https://my.wordpress.net/',
			'https://my.wordpress.net/sw.js',
			'https://my.wordpress.net/remote.html',
		]);
		expect(requests.map((request) => request.cache)).toEqual([
			'no-store',
			'no-store',
			'no-store',
		]);
	});
});

class FakeRequest {
	url: string;
	cache?: RequestCache;

	constructor(url: string, init?: RequestInit) {
		this.url = new URL(url, 'https://my.wordpress.net').href;
		this.cache = init?.cache;
	}
}
