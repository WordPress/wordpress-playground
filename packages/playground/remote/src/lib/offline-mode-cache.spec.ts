import type * as OfflineCache from './offline-mode-cache';

vi.mock('virtual:remote-config', () => ({ buildVersion: 'test' }));

describe('offline asset scope', () => {
	let shouldCacheUrl: typeof OfflineCache.shouldCacheUrl;
	beforeAll(async () => {
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({}) });
		vi.stubGlobal('self', {
			location: new URL('https://playground.test:9443'),
		});
		({ shouldCacheUrl } = await import('./offline-mode-cache'));
	});
	afterAll(() => vi.unstubAllGlobals());

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
