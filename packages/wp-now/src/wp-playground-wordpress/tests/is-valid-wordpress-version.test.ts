/*
 * Test for isValidWordpressVersion
 */
import { isValidWordpressVersion } from '../is-valid-wordpress-version';

test('isValidWordpressVersion', () => {
	// Accepted versions
	// Check https://wordpress.org/download/releases/
	expect(isValidWordpressVersion('latest')).toBe(true);
	expect(isValidWordpressVersion('6.2')).toBe(true);
	expect(isValidWordpressVersion('6.0.1')).toBe(true);
	expect(isValidWordpressVersion('6.2-beta1')).toBe(true);
	expect(isValidWordpressVersion('6.2-RC1')).toBe(true);
	// Rejected versions
	expect(isValidWordpressVersion('v6.2')).toBe(false);
	expect(isValidWordpressVersion('6.2-rc1')).toBe(false);
});
