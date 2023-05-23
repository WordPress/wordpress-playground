/*
 * Test for isValidWordpressVersion
 */
import { isValidWordPressVersion } from '../is-valid-wordpress-version';

test('isValidWordPressVersion', () => {
	// Accepted versions
	// Check https://wordpress.org/download/releases/
	expect(isValidWordPressVersion('latest')).toBe(true);
	expect(isValidWordPressVersion('6.2')).toBe(true);
	expect(isValidWordPressVersion('6.0.1')).toBe(true);
	expect(isValidWordPressVersion('6.2-beta1')).toBe(true);
	expect(isValidWordPressVersion('6.2-RC1')).toBe(true);
	// Rejected versions
	expect(isValidWordPressVersion('v6.2')).toBe(false);
	expect(isValidWordPressVersion('6.2-rc1')).toBe(false);
});
