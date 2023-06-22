import { joinPaths } from './join-paths';

describe('joinPaths', () => {
	it('should join paths correctly', () => {
		expect(joinPaths('wordpress', 'wp-content')).toEqual(
			'wordpress/wp-content'
		);
		expect(joinPaths('/wordpress', 'wp-content')).toEqual(
			'/wordpress/wp-content'
		);
		expect(joinPaths('wordpress', 'wp-content/')).toEqual(
			'wordpress/wp-content/'
		);
		expect(joinPaths('wordpress/', '/wp-content')).toEqual(
			'wordpress/wp-content'
		);
		expect(joinPaths('wordpress', '..', 'wp-content')).toEqual(
			'wp-content'
		);
		expect(joinPaths('wordpress', '..', '..', 'wp-content')).toEqual(
			'../wp-content'
		);
	});
});
