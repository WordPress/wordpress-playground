import { getWordPressDevelopmentOrigin } from './dev-server';

vi.mock('./dev-server', () => ({ getWordPressDevelopmentOrigin: vi.fn() }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.resetAllMocks();
});

describe('WordPress origin configuration', () => {
	it.each([
		'',
		'?reprint',
		'?reprint=0',
		'?reprint=https://untrusted.example',
	])(
		'uses the configured sandbox independently of startup flags: %s',
		async (search) => {
			vi.resetModules();
			vi.stubEnv(
				'VITE_WORDPRESS_SITE_URL',
				'https://wpsandbox.wordpress.net'
			);
			vi.stubGlobal(
				'location',
				new URL('https://playground.wordpress.net/remote.html' + search)
			);
			const { wordPressSiteUrl } = await import('./config');
			expect(wordPressSiteUrl).toBe('https://wpsandbox.wordpress.net');
		}
	);

	it('keeps one origin for builds without a sandbox', async () => {
		vi.resetModules();
		vi.stubEnv('DEV', false);
		vi.stubEnv('VITE_WORDPRESS_SITE_URL', undefined);
		const { playgroundOrigin, wordPressSiteUrl } = await import('./config');
		expect(wordPressSiteUrl).toBe(playgroundOrigin);
	});

	it('uses the development WordPress port without a query flag', async () => {
		vi.resetModules();
		vi.stubEnv('DEV', true);
		vi.stubEnv('VITE_WORDPRESS_SITE_URL', undefined);
		vi.mocked(getWordPressDevelopmentOrigin).mockReturnValue(
			'http://127.0.0.1:4400'
		);
		const { wordPressSiteUrl } = await import('./config');
		expect(wordPressSiteUrl).toBe('http://127.0.0.1:4400');
	});
});
