import { HttpCookieStore } from './http-cookie-store';

describe('HTTPCookieStore', () => {
	it('should store and retrieve cookies', () => {
		const store = new HttpCookieStore();
		store.rememberCookiesFromResponseHeaders({
			'set-cookie': ['cookie1=value1', 'cookie2=value2'],
		});
		expect(store.getCookieRequestHeader()).toBe(
			'cookie1=value1; cookie2=value2'
		);
	});

	it('should ignore invalid cookies', () => {
		const store = new HttpCookieStore();
		store.rememberCookiesFromResponseHeaders({
			'set-cookie': ['cookie1=value1', 'cookie2'],
		});
		expect(store.getCookieRequestHeader()).toBe('cookie1=value1');
	});
});
