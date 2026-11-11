import { vi } from 'vitest';

const config = vi.hoisted(() => ({
	playgroundOrigin: 'https://my.wordpress.net',
	wordPressSiteUrl: 'https://wpsandbox.wordpress.net',
}));

vi.mock('./config', () => config);

describe('WordPress popup loopback permission', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it.each([
		['https://my.wordpress.net', true],
		['https://playground.wordpress.net', false],
		['https://example.com', false],
	])('limits delegation on %s to Personal WP', async (origin, allowed) => {
		config.playgroundOrigin = origin;
		const frame = { allow: '', src: '' };
		vi.stubGlobal('location', {
			hash: '#https://wpsandbox.wordpress.net/scope:popup/wp-admin/',
		});
		vi.stubGlobal('document', { querySelector: () => frame });

		await import('./wordpress-popup');

		expect(frame.allow).toBe(
			allowed ? 'loopback-network https://wpsandbox.wordpress.net' : ''
		);
		expect(frame.src).toBe(
			'https://wpsandbox.wordpress.net/scope:popup/wp-admin/'
		);
	});
});
