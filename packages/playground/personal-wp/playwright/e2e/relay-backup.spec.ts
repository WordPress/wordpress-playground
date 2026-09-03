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
	const result = await wordpress.locator('body').evaluate(
		() =>
			new Promise<{ statuses: string[]; error?: string }>((resolve) => {
				const requestId = 'e2e-backup-request';
				const statuses: string[] = [];
				window.addEventListener('message', (event) => {
					const data = event.data;
					if (
						!data ||
						data.type !== 'relay' ||
						data.relayType !== 'backup-site-result' ||
						data.requestId !== requestId
					) {
						return;
					}
					statuses.push(data.status);
					if (data.status !== 'started') {
						resolve({ statuses, error: data.error });
					}
				});
				window.parent.postMessage(
					{ type: 'relay', relayType: 'backup-site', requestId },
					'*'
				);
			})
	);

	// 'started' is what tells a caller the message was understood at all.
	expect(result).toEqual({ statuses: ['started', 'success'] });

	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/-backup-.*\.zip$/);
});
