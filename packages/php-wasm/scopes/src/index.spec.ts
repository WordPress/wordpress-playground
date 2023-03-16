import { getURLScope, isURLScoped, removeURLScope, setURLScope } from './index';

describe('getURLScope', () => {
	it('should return the scope from a scoped URL', () => {
		const url = new URL('http://localhost/scope:12345/index.php');
		expect(getURLScope(url)).toBe('12345');
	});

	it('should return null from a non-scoped URL', () => {
		const url = new URL('http://localhost/index.php');
		expect(getURLScope(url)).toBeNull();
	});
});

describe('isURLScoped', () => {
	it('should return true for a scoped URL', () => {
		const url = new URL('http://localhost/scope:12345/index.php');
		expect(isURLScoped(url)).toBe(true);
	});

	it('should return false for a non-scoped URL', () => {
		const url = new URL('http://localhost/index.php');
		expect(isURLScoped(url)).toBe(false);
	});
});

describe('removeURLScope', () => {
	it('should remove the scope from a scoped URL', () => {
		const url = new URL('http://localhost/scope:12345/index.php');
		expect(removeURLScope(url).href).toBe('http://localhost/index.php');
	});

	it('should return the same URL for a non-scoped URL', () => {
		const url = new URL('http://localhost/index.php');
		expect(removeURLScope(url)).toBe(url);
	});
});

describe('setURLScope', () => {
	it('should add the scope to a non-scoped URL', () => {
		const url = new URL('http://localhost/index.php');
		expect(setURLScope(url, '12345').href).toBe(
			'http://localhost/scope:12345/index.php'
		);
	});

	it('should replace the scope in a scoped URL', () => {
		const url = new URL('http://localhost/scope:12345/index.php');
		expect(setURLScope(url, '67890').href).toBe(
			'http://localhost/scope:67890/index.php'
		);
	});

	it('should remove the scope from a URL when the scope is null', () => {
		const url = new URL('http://localhost/scope:12345/index.php');
		expect(setURLScope(url, null).href).toBe('http://localhost/index.php');
	});
});
