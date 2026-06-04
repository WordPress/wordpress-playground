import { getDefaultPhpVersionForWordPress } from './wordpress-version-compatibility';

describe('getDefaultPhpVersionForWordPress', () => {
	it('should infer PHP 5.2 for legacy WordPress versions', () => {
		expect(getDefaultPhpVersionForWordPress('2.0')).toBe('5.2');
	});

	it('should infer PHP 7.4 for older non-minified WordPress versions', () => {
		expect(getDefaultPhpVersionForWordPress('5.9')).toBe('7.4');
	});

	it('should use the recommended PHP version for modern WordPress versions', () => {
		expect(getDefaultPhpVersionForWordPress('6.3')).toBe('8.3');
	});
});
