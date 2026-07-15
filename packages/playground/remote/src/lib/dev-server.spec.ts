import { isDevServer } from './dev-server';

describe('isDevServer', () => {
	it('recognizes local website dev server origins', () => {
		expect(isDevServer(new URL('http://127.0.0.1:5400/'))).toBe(true);
		expect(isDevServer(new URL('http://localhost:5400/'))).toBe(true);
	});

	it('recognizes local Personal WP dev server origins', () => {
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
