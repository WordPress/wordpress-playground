vi.mock('virtual:website-config', () => ({ buildVersion: 'test' }));

afterEach(() => vi.unstubAllGlobals());

describe('remote iframe startup mode', () => {
	it.each(['', '?reprint', '?reprint=0'])(
		'keeps the startup choice after SPA navigation: %s',
		async (search) => {
			vi.resetModules();
			const location = {
				origin: 'https://playground.wordpress.net',
				search,
			};
			vi.stubGlobal('location', location);
			vi.stubGlobal('window', { location });
			const { getRemoteUrl } = await import('./config');
			location.search = '?site-slug=another-site';
			expect(getRemoteUrl().searchParams.has('reprint')).toBe(
				Boolean(search)
			);
			expect(getRemoteUrl().origin).toBe(location.origin);
			expect(getRemoteUrl().pathname).toBe('/remote.html');
		}
	);
});
