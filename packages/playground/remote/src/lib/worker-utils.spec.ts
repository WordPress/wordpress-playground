import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@php-wasm/logger';

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
});
