import { getWordPressDevelopmentOrigin, isDevServer } from './dev-server';

describe('isDevServer', () => {
	it('recognizes local website dev server origins', () => {
		expect(isDevServer(new URL('http://127.0.0.1:5400/'))).toBe(true);
		expect(isDevServer(new URL('http://localhost:5400/'))).toBe(true);
	});

	it('recognizes local application dev server origins', () => {
		expect(isDevServer(new URL('http://127.0.0.1:5401/'))).toBe(true);
		expect(isDevServer(new URL('http://localhost:5401/'))).toBe(true);
	});

	it('recognizes local Playground HTTPS hosts', () => {
		expect(isDevServer(new URL('https://playground.test/'))).toBe(true);
	});

	it('recognizes dev server paths on tunnel hosts', () => {
		expect(
			isDevServer(
				new URL('https://example.trycloudflare.com/website-server/')
			)
		).toBe(true);
	});

	it('ignores production URLs', () => {
		expect(isDevServer(new URL('https://playground.wordpress.net/'))).toBe(
			false
		);
		expect(isDevServer(new URL('https://my.wordpress.net/'))).toBe(false);
	});
});

describe('getWordPressDevelopmentOrigin', () => {
	it.each(['127.0.0.1', 'localhost'])(
		'uses the remote port for the website on %s',
		(host) => {
			expect(
				getWordPressDevelopmentOrigin(
					new URL(`http://${host}:5400/website-server/`)
				)
			).toBe(`http://${host}:4400`);
		}
	);

	it.each([
		'http://127.0.0.1:4400/remote.html',
		'http://127.0.0.1:5401/',
		'http://127.0.0.1:9500/',
		'https://127.0.0.1:5400/',
		'https://playground.test/',
		'https://example.trycloudflare.com/website-server/',
		'https://playground.wordpress.net/',
	])(
		'does not change standalone, preview, or forwarded origins: %s',
		(url) => {
			expect(getWordPressDevelopmentOrigin(new URL(url))).toBeUndefined();
		}
	);
});
