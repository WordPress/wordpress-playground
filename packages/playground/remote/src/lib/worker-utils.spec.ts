import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@php-wasm/logger';

vi.mock('@wp-playground/wordpress', () => ({
	getLoadedWordPressVersion: vi.fn(async () => '6.9'),
}));

describe('worker-utils', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('does not crash when checking static asset cache before a request handler is available', async () => {
		vi.stubGlobal('caches', {
			open: vi.fn(async () => ({
				match: vi.fn(),
			})),
		});
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
		const { hasCachedStaticFilesRemovedFromMinifiedBuild } =
			await import('./worker-utils');

		await expect(
			hasCachedStaticFilesRemovedFromMinifiedBuild(undefined as any)
		).resolves.toBe(false);
		expect(warn).toHaveBeenCalledWith('No PHP request handler available');
	});

	it('does not crash when backfilling static assets before a request handler is available', async () => {
		vi.stubGlobal('caches', {
			open: vi.fn(async () => ({
				match: vi.fn(),
			})),
		});
		vi.spyOn(logger, 'warn').mockImplementation(() => {});
		const { backfillStaticFilesRemovedFromMinifiedBuild } =
			await import('./worker-utils');

		await expect(
			backfillStaticFilesRemovedFromMinifiedBuild(undefined as any)
		).resolves.toBeUndefined();
	});

	it('does not build a WordPress static assets URL without a request handler', async () => {
		vi.stubGlobal('caches', {
			open: vi.fn(async () => ({
				match: vi.fn(),
			})),
		});
		vi.spyOn(logger, 'warn').mockImplementation(() => {});
		const { getWordPressStaticZipUrl } = await import('./worker-utils');

		await expect(getWordPressStaticZipUrl({} as any)).resolves.toBe(false);
	});

	it('builds the static assets ZIP URL for a loaded minified WordPress version', async () => {
		vi.stubGlobal('caches', {
			open: vi.fn(async () => ({
				match: vi.fn(),
			})),
		});
		const { getWordPressStaticZipUrl } = await import('./worker-utils');

		await expect(
			getWordPressStaticZipUrl({
				requestHandler: { documentRoot: '/wordpress' },
				isFile: vi.fn(() => true),
			} as any)
		).resolves.toBe('/wp-6.9/wordpress-static.zip');
	});
});
