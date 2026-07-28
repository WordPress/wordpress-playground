import { describe, expect, it, vi } from 'vitest';
import {
	APP_VERSION_ENDPOINT,
	APP_VERSION_SCHEMA,
	checkAppVersion,
} from './app-version';

describe('checkAppVersion', () => {
	it('returns current when the deployed version matches', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						schema: APP_VERSION_SCHEMA,
						buildVersion: 'current-build',
					})
				)
		);

		await expect(
			checkAppVersion({
				currentVersion: 'current-build',
				fetchImpl,
				now: () => 123,
			})
		).resolves.toEqual({
			status: 'current',
			currentVersion: 'current-build',
			deployedVersion: 'current-build',
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			expect.stringContaining(`${APP_VERSION_ENDPOINT}?_=123`),
			expect.objectContaining({
				cache: 'no-store',
			})
		);
	});

	it('returns update-available when the deployed version differs', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						schema: APP_VERSION_SCHEMA,
						buildVersion: 'deployed-build',
					})
				)
		);

		await expect(
			checkAppVersion({
				currentVersion: 'current-build',
				fetchImpl,
			})
		).resolves.toEqual({
			status: 'update-available',
			currentVersion: 'current-build',
			deployedVersion: 'deployed-build',
		});
	});

	it('returns unknown for invalid payloads', async () => {
		const fetchImpl = vi.fn(
			async () => new Response(JSON.stringify({ buildVersion: 'next' }))
		);

		await expect(
			checkAppVersion({
				currentVersion: 'current-build',
				fetchImpl,
			})
		).resolves.toEqual({
			status: 'unknown',
			currentVersion: 'current-build',
			reason: 'invalid-payload',
		});
	});

	it('returns unknown for failed requests', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('offline');
		});

		await expect(
			checkAppVersion({
				currentVersion: 'current-build',
				fetchImpl,
			})
		).resolves.toEqual({
			status: 'unknown',
			currentVersion: 'current-build',
			reason: 'fetch-failed',
		});
	});

	it('returns unknown for unsuccessful responses', async () => {
		const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));

		await expect(
			checkAppVersion({
				currentVersion: 'current-build',
				fetchImpl,
			})
		).resolves.toEqual({
			status: 'unknown',
			currentVersion: 'current-build',
			reason: 'not-ok',
		});
	});
});
