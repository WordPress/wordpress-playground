import type { FrameLocator } from '@playwright/test';
import { test, expect } from '../playground-fixtures';

// The `backup-site` relay message lets a WordPress page (e.g. the My Apps
// "move to hosting" guide) start the same site backup the Site Tools panel
// offers, without the user hunting for it.
test('should download a site backup requested by a relay message', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');
	// WordPress renders behind the loading screen, so a non-empty frame body
	// is not yet a booted site: while the loading screen is up, a backup is
	// refused the same way the Site Tools button is unavailable. Wait for it
	// to go away.
	await expect(
		website.page.getByRole('progressbar', { name: 'Loading WordPress' })
	).toHaveCount(0);

	const downloadPromise = website.page.waitForEvent('download');
	const [result] = await requestBackups(wordpress, 1);

	// 'started' is what tells a caller the message was understood at all.
	expect(result).toEqual({ statuses: ['started', 'success'] });

	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/-backup-.*\.zip$/);
});

// Two requests in the same turn read the same React state, so only a lock the
// hook holds itself can keep them from zipping the site twice.
test('should run one backup for two requests made in the same turn', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');
	await expect(
		website.page.getByRole('progressbar', { name: 'Loading WordPress' })
	).toHaveCount(0);

	const downloads: string[] = [];
	website.page.on('download', (download) =>
		downloads.push(download.suggestedFilename())
	);

	const results = await requestBackups(wordpress, 2);

	expect(results.map((result) => result.statuses.at(-1)).sort()).toEqual([
		'error',
		'success',
	]);
	expect(downloads).toHaveLength(1);
});

/**
 * Post `count` backup requests from the WordPress frame in one turn and
 * resolve once each has reported a final status.
 */
function requestBackups(wordpress: FrameLocator, count: number) {
	return wordpress.locator('body').evaluate(
		(_body, requestCount: number) =>
			Promise.all(
				Array.from(
					{ length: requestCount },
					(_, index) =>
						new Promise<{ statuses: string[]; error?: string }>(
							(resolve) => {
								const requestId = `e2e-backup-request-${index}`;
								const statuses: string[] = [];
								window.addEventListener('message', (event) => {
									const data = event.data;
									if (
										!data ||
										data.type !== 'relay' ||
										data.relayType !==
											'backup-site-result' ||
										data.requestId !== requestId
									) {
										return;
									}
									statuses.push(data.status);
									if (data.status !== 'started') {
										resolve({
											statuses,
											error: data.error,
										});
									}
								});
								window.parent.postMessage(
									{
										type: 'relay',
										relayType: 'backup-site',
										requestId,
									},
									'*'
								);
							}
						)
				)
			),
		count
	);
}
