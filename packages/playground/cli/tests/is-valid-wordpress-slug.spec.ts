import { describe, it, expect } from 'vitest';
import { isValidWordPressSlug } from '../src/is-valid-wordpress-slug';

describe('isValidWordPressSlug', () => {
	it('should accept "latest"', () => {
		expect(isValidWordPressSlug('latest')).toBe(true);
	});

	it('should accept "beta"', () => {
		expect(isValidWordPressSlug('beta')).toBe(true);
	});

	it('should accept "trunk"', () => {
		expect(isValidWordPressSlug('trunk')).toBe(true);
	});

	it('should accept "nightly"', () => {
		expect(isValidWordPressSlug('nightly')).toBe(true);
	});

	it('should accept version with major and minor (e.g., "6.2")', () => {
		expect(isValidWordPressSlug('6.2')).toBe(true);
		expect(isValidWordPressSlug('5.9')).toBe(true);
	});

	it('should accept version with major, minor, and patch (e.g., "6.2.1")', () => {
		expect(isValidWordPressSlug('6.2.1')).toBe(true);
		expect(isValidWordPressSlug('5.9.3')).toBe(true);
	});

	it('should accept version with beta suffix (e.g., "6.2-beta1")', () => {
		expect(isValidWordPressSlug('6.2-beta1')).toBe(true);
		expect(isValidWordPressSlug('6.2.1-beta1')).toBe(true);
		expect(isValidWordPressSlug('6.2-beta')).toBe(true);
	});

	it('should accept version with RC suffix (e.g., "6.2-RC1")', () => {
		expect(isValidWordPressSlug('6.2-RC1')).toBe(true);
		expect(isValidWordPressSlug('6.2.1-RC1')).toBe(true);
		expect(isValidWordPressSlug('6.2-RC')).toBe(true);
	});

	it('should reject invalid version strings', () => {
		expect(isValidWordPressSlug('brazil')).toBe(false);
		expect(isValidWordPressSlug('invalid')).toBe(false);
		expect(isValidWordPressSlug('beta1')).toBe(false);
		expect(isValidWordPressSlug('RC1')).toBe(false);
		expect(isValidWordPressSlug('6')).toBe(false);
		expect(isValidWordPressSlug('6.x')).toBe(false);
		expect(isValidWordPressSlug('6.2.x')).toBe(false);
		expect(isValidWordPressSlug('')).toBe(false);
	});

	it('should reject version with invalid format', () => {
		expect(isValidWordPressSlug('6.2.1.2')).toBe(false);
		expect(isValidWordPressSlug('v6.2')).toBe(false);
		expect(isValidWordPressSlug('6.2-alpha')).toBe(false);
		expect(isValidWordPressSlug('6.2-beta-1')).toBe(false);
	});
});
