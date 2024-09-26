import { UrlResource } from './resources';

describe('UrlResource', () => {
	it('should create a new instance of UrlResource', () => {
		const resource = new UrlResource({
			resource: 'url',
			url: 'https://example.com',
			caption: 'Example',
		});
		expect(resource).toBeInstanceOf(UrlResource);
	});

	it('should translate github.com URLs into raw.githubusercontent.com URLs', () => {
		const resource = new UrlResource({
			resource: 'url',
			url: 'https://github.com/WordPress/wordpress-develop/blob/trunk/src/wp-includes/version.php',
			caption: 'Example',
		});
		expect(resource.getURL()).toBe(
			'https://raw.githubusercontent.com/WordPress/wordpress-develop/trunk/src/wp-includes/version.php'
		);
	});
});
