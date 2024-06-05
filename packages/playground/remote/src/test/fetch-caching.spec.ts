import { addCache, getCache, isValidFile } from '../lib/fetch-caching';

describe('Valid files', () => {
	it('Should return true for valid files', () => {
		expect(isValidFile('/index.html')).toBe(false);
		expect(isValidFile('/')).toBe(false);

		expect(isValidFile('/assets/wp-6.4.zip')).toBe(true);
		expect(isValidFile('/assets/wp-6.4.1.zip')).toBe(true);
		expect(isValidFile('/assets/wp-6.4.1-cache_key.zip')).toBe(true);
		expect(
			isValidFile('https://playground.wordpress.net/assets/wp-6.4.zip')
		).toBe(true);

		expect(isValidFile('/assets/php_8_0.wasm')).toBe(true);
		expect(isValidFile('/assets/php_8_0_0.wasm')).toBe(true);
		expect(isValidFile('/assets/php_8_0_0-cache_key.wasm')).toBe(true);
		expect(
			isValidFile('https://playground.wordpress.net/assets/php_8_0.wasm')
		).toBe(true);

		expect(isValidFile('/assets/sqlite-database-integration.zip')).toBe(
			true
		);
		expect(
			isValidFile('/assets/sqlite-database-integration-cache_key.zip')
		).toBe(true);
		expect(
			isValidFile(
				'https://playground.wordpress.net/assets/sqlite-database-integration.zip'
			)
		).toBe(true);
	});
});
