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
			let rejectCacheWrite!: (reason: unknown) => void;
			const cacheWrite = new Promise<void>((_resolve, reject) => {
				rejectCacheWrite = reject;
			});
			const cacheWriteCatch = vi.spyOn(cacheWrite, 'catch');
			const cachePut = vi.fn().mockReturnValue(cacheWrite);
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

			rejectCacheWrite(
				new DOMException(
					'Cache.put() encountered a network error',
					'NetworkError'
				)
			);
			await Promise.resolve();
		}
	);
});
