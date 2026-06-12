import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	ResourceDownloadError,
	InvalidAssetSlugError,
	CorePluginResource,
	CoreThemeResource,
} from './resources';

vi.mock('@php-wasm/web-service-worker', () => ({
	fetchWithCorsProxy: vi.fn(),
}));

import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';

const mockFetch = fetchWithCorsProxy as ReturnType<typeof vi.fn>;

function makeOkResponse() {
	return {
		ok: true,
		status: 200,
		headers: { get: () => null },
		arrayBuffer: async () => new ArrayBuffer(4),
		clone: function () {
			return this;
		},
	} as unknown as Response;
}

function makeErrorResponse(status: number) {
	return {
		ok: false,
		status,
		statusText: String(status),
	} as unknown as Response;
}

describe('ResourceDownloadError', () => {
	it('carries statusCode when provided', () => {
		const err = new ResourceDownloadError('msg', 'https://example.com', {
			statusCode: 404,
		});
		expect(err.statusCode).toBe(404);
		expect(err.url).toBe('https://example.com');
		expect(err.name).toBe('ResourceDownloadError');
	});

	it('statusCode is undefined when not provided', () => {
		const err = new ResourceDownloadError('msg', 'https://example.com');
		expect(err.statusCode).toBeUndefined();
	});
});

describe('InvalidAssetSlugError', () => {
	it('is a subclass of ResourceDownloadError', () => {
		const err = new InvalidAssetSlugError(
			'bad-slug',
			'plugin',
			'https://downloads.wordpress.org/plugin/bad-slug.latest-stable.zip'
		);
		expect(err).toBeInstanceOf(ResourceDownloadError);
		expect(err.name).toBe('InvalidAssetSlugError');
		expect(err.slug).toBe('bad-slug');
		expect(err.assetType).toBe('plugin');
		expect(err.statusCode).toBe(404);
		expect(err.message).toContain('bad-slug');
		expect(err.message).toContain('plugin');
	});
});

describe('CorePluginResource', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('throws InvalidAssetSlugError on a 404 response', async () => {
		mockFetch.mockResolvedValue(makeErrorResponse(404));
		const resource = new CorePluginResource({
			resource: 'wordpress.org/plugins',
			slug: 'nonexistent-plugin-xyz',
		});
		await expect(resource.resolve()).rejects.toThrow(InvalidAssetSlugError);
		await expect(resource.resolve()).rejects.toMatchObject({
			slug: 'nonexistent-plugin-xyz',
			assetType: 'plugin',
		});
	});

	it('throws ResourceDownloadError (not InvalidAssetSlugError) on a 403 response', async () => {
		mockFetch.mockResolvedValue(makeErrorResponse(403));
		const resource = new CorePluginResource({
			resource: 'wordpress.org/plugins',
			slug: 'some-plugin',
		});
		await expect(resource.resolve()).rejects.toThrow(ResourceDownloadError);
		await expect(resource.resolve()).rejects.not.toThrow(
			InvalidAssetSlugError
		);
	});

	it('resolves successfully on a 200 response', async () => {
		mockFetch.mockResolvedValue(makeOkResponse());
		const resource = new CorePluginResource({
			resource: 'wordpress.org/plugins',
			slug: 'my-plugin',
		});
		const file = await resource.resolve();
		expect(file).toBeInstanceOf(File);
	});
});

describe('CoreThemeResource', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('throws InvalidAssetSlugError on a 404 response', async () => {
		mockFetch.mockResolvedValue(makeErrorResponse(404));
		const resource = new CoreThemeResource({
			resource: 'wordpress.org/themes',
			slug: 'nonexistent-theme-xyz',
		});
		await expect(resource.resolve()).rejects.toThrow(InvalidAssetSlugError);
		await expect(resource.resolve()).rejects.toMatchObject({
			slug: 'nonexistent-theme-xyz',
			assetType: 'theme',
		});
	});

	it('resolves successfully on a 200 response', async () => {
		mockFetch.mockResolvedValue(makeOkResponse());
		const resource = new CoreThemeResource({
			resource: 'wordpress.org/themes',
			slug: 'twentytwenty',
		});
		const file = await resource.resolve();
		expect(file).toBeInstanceOf(File);
	});
});
