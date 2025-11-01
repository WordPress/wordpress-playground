import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the WordPress API response
const mockApiResponse = {
	offers: [
		{
			version: '6.8.3',
			download: 'https://wordpress.org/wordpress-6.8.3.zip',
			response: 'autoupdate',
		},
		{
			version: '6.8',
			download: 'https://wordpress.org/wordpress-6.8.zip',
			response: 'autoupdate',
		},
		{
			version: '6.7.1',
			download: 'https://wordpress.org/wordpress-6.7.1.zip',
			response: 'autoupdate',
		},
		{
			version: '6.6.2',
			download: 'https://wordpress.org/wordpress-6.6.2.zip',
			response: 'autoupdate',
		},
		{
			version: '6.9-beta1',
			download: 'https://wordpress.org/wordpress-6.9-beta1.zip',
			response: 'autoupdate',
		},
	],
};

// Mock the fetch function before importing the module
const mockFetch = vi.fn(() =>
	Promise.resolve({
		json: () => Promise.resolve(mockApiResponse),
	} as Response)
);

// Mock the common module to bypass memoization
vi.mock('@wp-playground/common', async () => {
	const actual = await vi.importActual('@wp-playground/common');
	return {
		...actual,
		createMemoizedFetch: () => mockFetch,
	};
});

// Import after mocks are set up
const { resolveWordPressRelease } = await import('../index');

describe('resolveWordPressRelease', () => {
	beforeEach(() => {
		mockFetch.mockClear();
	});

	it('resolves latest to the first non-beta version', async () => {
		const result = await resolveWordPressRelease('latest');
		expect(result.version).toBe('6.8.3');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/wordpress-6.8.3.zip'
		);
		expect(result.source).toBe('api');
	});

	it('resolves beta to a beta version', async () => {
		const result = await resolveWordPressRelease('beta');
		expect(result.version).toBe('6.9-beta1');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/wordpress-6.9-beta1.zip'
		);
		expect(result.source).toBe('api');
	});

	it('resolves exact version match for minor release with .0 suffix', async () => {
		const result = await resolveWordPressRelease('6.8.0');
		expect(result.version).toBe('6.8');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/wordpress-6.8.zip'
		);
		expect(result.source).toBe('inferred');
	});

	it('resolves exact version match for minor release without .0 suffix', async () => {
		const result = await resolveWordPressRelease('6.8');
		expect(result.version).toMatch(/^6\.8\.(?!0$)\d+$/);
		expect(result.releaseUrl).toMatch(
			/^https:\/\/wordpress\.org\/wordpress-6\.8\.(?!0$)\d+\.zip$/
		);
		expect(result.source).toBe('api');
	});

	it('falls back to substring matching when no exact match exists', async () => {
		// 6.7 doesn't exist exactly, but 6.7.1 does (starts with 6.7)
		const result = await resolveWordPressRelease('6.7');
		expect(result.version).toBe('6.7.1');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/wordpress-6.7.1.zip'
		);
		expect(result.source).toBe('api');
	});

	it('resolves specific patch version', async () => {
		const result = await resolveWordPressRelease('6.6.2');
		expect(result.version).toBe('6.6.2');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/wordpress-6.6.2.zip'
		);
		expect(result.source).toBe('api');
	});

	it('returns inferred URL for version not in API', async () => {
		const result = await resolveWordPressRelease('5.0');
		expect(result.version).toBe('5.0');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/wordpress-5.0.zip'
		);
		expect(result.source).toBe('inferred');
	});

	it('normalizes .0 suffix for version not in API', async () => {
		const result = await resolveWordPressRelease('5.0.0');
		expect(result.version).toBe('5.0');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/wordpress-5.0.zip'
		);
		expect(result.source).toBe('inferred');
	});

	it('resolves trunk to nightly build', async () => {
		const result = await resolveWordPressRelease('trunk');
		expect(result.version).toContain('nightly-');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/nightly-builds/wordpress-latest.zip'
		);
		expect(result.source).toBe('inferred');
	});

	it('resolves nightly to nightly build', async () => {
		const result = await resolveWordPressRelease('nightly');
		expect(result.version).toContain('nightly-');
		expect(result.releaseUrl).toBe(
			'https://wordpress.org/nightly-builds/wordpress-latest.zip'
		);
		expect(result.source).toBe('inferred');
	});

	it('resolves custom URL with HTTPS', async () => {
		const customUrl = 'https://example.com/my-wordpress.zip';
		const result = await resolveWordPressRelease(customUrl);
		expect(result.version).toContain('custom-');
		expect(result.releaseUrl).toBe(customUrl);
		expect(result.source).toBe('inferred');
	});

	it('resolves custom URL with HTTP', async () => {
		const customUrl = 'http://example.com/my-wordpress.zip';
		const result = await resolveWordPressRelease(customUrl);
		expect(result.version).toContain('custom-');
		expect(result.releaseUrl).toBe(customUrl);
		expect(result.source).toBe('inferred');
	});
});
