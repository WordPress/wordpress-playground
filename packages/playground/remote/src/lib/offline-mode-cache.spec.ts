describe('offline mode cache', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('self', {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		['cache first', 'cacheFirstFetch'],
		['network first', 'networkFirstFetch'],
	] as const)(
		'settles failed background writes for the %s strategy',
		async (_strategy, fetchFunctionName) => {
			const cacheWriteError = new DOMException(
				'Cache.put() encountered a network error',
				'NetworkError'
			);
			const cacheWriteCatch = vi.fn((onRejected) =>
				Promise.resolve(onRejected(cacheWriteError))
			);
			const cachePut = vi.fn().mockReturnValue({
				catch: cacheWriteCatch,
			});
			vi.stubGlobal('caches', {
				open: vi.fn().mockResolvedValue({
					match: vi.fn().mockResolvedValue(undefined),
					put: cachePut,
				}),
			});
			const response = new Response('response body');
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
			const offlineModeCache = await import('./offline-mode-cache');

			await expect(
				offlineModeCache[fetchFunctionName](
					new Request('https://playground.wordpress.net/asset.js')
				)
			).resolves.toBe(response);

			expect(cachePut).toHaveBeenCalledOnce();
			expect(cacheWriteCatch).toHaveBeenCalledOnce();
		}
	);
});
