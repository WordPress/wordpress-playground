vi.mock('virtual:website-config', () => ({ buildVersion: 'test' }));

afterEach(() => vi.unstubAllGlobals());

describe('trusted PHP iframe URL', () => {
	it.each(['', '?reprint', '?reprint=0'])(
		'keeps PHP on the app origin regardless of the Reprint flag: %s',
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
			expect(getRemoteUrl().searchParams.has('reprint')).toBe(false);
			expect(getRemoteUrl().searchParams.get('v')).toBe('test');
			expect(getRemoteUrl().origin).toBe(location.origin);
			expect(getRemoteUrl().pathname).toBe('/remote.html');
		}
	);
});
