import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	fetch: vi.fn(),
}));

vi.mock('@wp-playground/common', async (importOriginal) => ({
	...(await importOriginal()),
	createMemoizedFetch: () => mocks.fetch,
}));

const { getWordPressStableVersions } = await import('../wordpress-releases');

describe('getWordPressStableVersions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns every version key from the official catalog', async () => {
		mocks.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				'6.7.5': 'outdated',
				'6.8.5': 'outdated',
				'6.9': 'latest',
			}),
		});

		await expect(getWordPressStableVersions()).resolves.toEqual([
			'6.7.5',
			'6.8.5',
			'6.9',
		]);
		expect(mocks.fetch).toHaveBeenCalledWith(
			'https://api.wordpress.org/core/stable-check/1.0/'
		);
	});

	it('rejects failed catalog requests', async () => {
		mocks.fetch.mockResolvedValue({
			ok: false,
			status: 503,
			statusText: 'Service Unavailable',
		});

		await expect(getWordPressStableVersions()).rejects.toThrow(
			'Could not load the WordPress release catalog: 503 Service Unavailable'
		);
	});

	it('rejects malformed catalog responses', async () => {
		mocks.fetch.mockResolvedValue({
			ok: true,
			json: async () => [],
		});

		await expect(getWordPressStableVersions()).rejects.toThrow(
			'The WordPress release catalog returned invalid data.'
		);
	});
});
